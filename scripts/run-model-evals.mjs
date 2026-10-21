import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir, rm, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prepareInferencePilot } from './prepare-inference-pilot.mjs';
import { checkCoachEvaluation } from '../js/intelligence/coach-evaluation.js';
import { checkFreshModelRun } from '../js/intelligence/evaluation-quality.js';

const PORT = 8794; // Stable localhost origin preserves WebLLM's artifact cache across commits.
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm' };
export async function runModelEvaluations({ full, inputs, cacheDir }) {
  const runId = randomUUID(), startedAt = Date.now();
  const { destination } = await prepareInferencePilot();
  let context, timer, capability = null;
  const server = createServer(async (request, response) => {
    try {
      if (request.url === '/__sharp_eval__/') {
        response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
        response.end('<!doctype html><html lang="en"><title>Sharp commit evaluation</title><body>Sharp commit evaluation</body></html>'); return;
      }
      const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = path.resolve(destination, `.${name}`);
      if (!file.startsWith(destination + path.sep)) throw new Error('Invalid path');
      const bytes = await readFile(file);
      response.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); response.end(bytes);
    } catch { response.writeHead(404); response.end('Not found'); }
  });
  try {
    await mkdir(cacheDir, { recursive: true, mode: 0o700 });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(PORT, '127.0.0.1', resolve);
    }).catch((error) => { throw new Error(error.code === 'EADDRINUSE' ? `Model eval port ${PORT} is busy; wait for the other evaluation to finish.` : error.message); });
    console.log(`Real model: starting ${full ? '21-case full suite' : '3-case smoke'} (cached browser profile).`);
    // No personal browser profile, user tabs, remote debugging, software GPU or result-cache substitute.
    context = await chromium.launchPersistentContext(path.join(cacheDir, 'browser'), {
      channel: 'chromium', headless: true, serviceWorkers: 'block', args: ['--enable-unsafe-webgpu'], timeout: 30000
    });
    const page = await context.newPage();
    let lastProgress = 0;
    page.on('console', (message) => {
      if (message.text().startsWith('Sharp model:') && Date.now() - lastProgress >= 5000) { console.log(message.text()); lastProgress = Date.now(); }
    });
    await page.goto(`http://127.0.0.1:${PORT}/__sharp_eval__/`, { timeout: 10000 });
    capability = await page.evaluate(async () => {
      const { probeCapabilities } = await import('/js/core/capabilities.js');
      return probeCapabilities();
    });
    await writeFile(path.join(cacheDir, 'latest-capability-report.json'), JSON.stringify({ runId, observedAt: Date.now(), capability }, null, 2) + '\n', { mode: 0o600 });
    if (!capability.eligible) throw new Error(`WebGPU admission failed: ${capability.reason}`);
    const pending = page.evaluate(async ({ full, runId }) => {
      const [{ IntelligenceService }, { WebLLMProvider }, { MODEL_PROFILE }, { runEvaluation }, quality] = await Promise.all([
        import('/js/intelligence/service.js'), import('/js/intelligence/webllm-provider.js'), import('/js/intelligence/model-manifest.js'),
        import('/js/intelligence/evaluation.js'), import('/js/intelligence/evaluation-quality.js')
      ]);
      const service = new IntelligenceService({ provider: new WebLLMProvider({ enabled: true }) });
      try {
        const preparation = await service.prepare(MODEL_PROFILE, { consent: true, allowUnqualified: true,
          onProgress: (progress) => console.log(`Sharp model: ${progress.text || progress.phase}`) });
        const source = await quality.captureEvaluationInputs();
        const { evaluateCoach } = await import('/js/intelligence/coach-evaluation.js');
        const coachEvaluation = await evaluateCoach(service.provider, { full });
        const evaluation = await runEvaluation(service, { dataset: full ? quality.FULL_DATASET : quality.SMOKE_DATASET,
          repeats: full ? quality.QUALITY.repeats : 1 });
        return { version: 'sharp-model-benchmark-v3', profile: MODEL_PROFILE, preparation, ...source, evaluation, coachEvaluation,
          commitRun: { runId, mode: full ? 'full' : 'smoke' }, environment: { userAgent: navigator.userAgent } };
      } finally { service.dispose(); }
    }, { full, runId });
    const report = await Promise.race([pending, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Real-model evaluation exceeded its total deadline.')), full ? 1200000 : 300000);
    })]);
    // Save even failing output for diagnosis; only independently validated results can pass the hook.
    const latest = path.join(cacheDir, 'latest-model-report.json'), temporary = `${latest}.${runId}.tmp`;
    await writeFile(temporary, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 }); await rename(temporary, latest);
    const coach = checkCoachEvaluation(report.coachEvaluation, { full });
    if (report.coachEvaluation.startedAt < startedAt || report.coachEvaluation.completedAt > Date.now()) throw new Error('Coach run outside invocation');
    console.log(`Coach model: ${coach.count}/${coach.count} accepted; p95 ${coach.p95Ms}ms.`);
    const result = checkFreshModelRun(report, inputs, { full, runId, startedAt, completedAt: Date.now() });
    console.log(`Real model: ${result.count}/${result.count} accepted, zero fallbacks; p95 ${result.p95Ms}ms. Report: ${latest}`);
    return report;
  } catch (error) {
    await mkdir(cacheDir, { recursive: true, mode: 0o700 }).catch(() => {});
    await writeFile(path.join(cacheDir, 'latest-failed-run.json'), JSON.stringify({ version: 'sharp-model-failed-run-v1', runId, startedAt, completedAt: Date.now(), inputFingerprint: inputs.fingerprint, inputFiles: inputs.files, mode: full ? 'full' : 'smoke', status: 'blocked', capability, reason: error.message, realModelSamples: capability && !capability.eligible ? 0 : null }, null, 2) + '\n', { mode: 0o600 }).catch(() => {});
    throw new Error(`Real-model gate failed: ${error.message}\nInstall the test browser with: npx playwright install chromium. A working WebGPU device and model artifacts are required. No cached report can replace this run.`);
  } finally {
    clearTimeout(timer);
    await context?.close().catch(() => {});
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
    await rm(destination, { recursive: true, force: true });
  }
}
