import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { CPUProvider } from './cpu-provider.mjs';
import { CPU_PROFILE } from './cpu-profile.mjs';
import { IntelligenceService } from '../js/intelligence/service.js';
import { runEvaluation } from '../js/intelligence/evaluation.js';
import { FULL_DATASET, SMOKE_DATASET, QUALITY, checkEvaluation } from '../js/intelligence/evaluation-quality.js';
import { evaluateCoach, checkCoachEvaluation } from '../js/intelligence/coach-evaluation.js';
export function checkCPUReport(report, inputs, { full = true } = {}) {
  if (report?.version !== 'sharp-cpu-eval-v1' || report.backend !== 'cpu' || JSON.stringify(report.profile) !== JSON.stringify(CPU_PROFILE) || report.inputFingerprint !== inputs.fingerprint || JSON.stringify(report.inputFiles) !== JSON.stringify(inputs.files)) throw new Error('Invalid or stale CPU model evidence');
  const arithmetic = checkEvaluation(report.evaluation, { dataset: full ? FULL_DATASET : SMOKE_DATASET, repeats: full ? QUALITY.repeats : 1, source: 'model-cpu', maxP95Ms: CPU_PROFILE.maxP95Ms, artifactIdentity: `${CPU_PROFILE.runtime}:${CPU_PROFILE.modelSHA256}` });
  const coach = checkCoachEvaluation(report.coachEvaluation, { full, source: 'model-cpu', maxP95Ms: CPU_PROFILE.maxP95Ms });
  return { arithmetic, coach };
}
export async function runCPUEvaluations({ full = true, inputs, cacheDir, reason = 'explicit_cpu' }) {
  await mkdir(cacheDir, { recursive: true });
  const provider = new CPUProvider(cacheDir), service = new IntelligenceService({ provider });
  const runId = randomUUID(), startedAt = Date.now();
  console.log(`Real CPU inference: ${full ? '102' : '6'} outputs; pinned SmolLM2 GGUF, GPU layers=0. Reason: ${reason}`);
  try {
    await provider.prepare();
    const evaluation = await runEvaluation(service, { dataset: full ? FULL_DATASET : SMOKE_DATASET, repeats: full ? QUALITY.repeats : 1, onResult: result => console.log(`CPU arithmetic ${result.fixtureId} repeat ${result.repeat}: ${result.source} ${result.timings.totalMs}ms`) });
    for (const row of evaluation.results) if (row.source === 'model') row.source = 'model-cpu';
    const coachEvaluation = await evaluateCoach(provider, { full, source: 'model-cpu', onResult: result => console.log(`CPU coach ${result.fixtureId} repeat ${result.repeat}: ${result.source} ${result.totalMs}ms`) });
    const report = { version: 'sharp-cpu-eval-v1', backend: 'cpu', profile: CPU_PROFILE, runId, reason, startedAt, completedAt: Date.now(), inputFingerprint: inputs.fingerprint, inputFiles: inputs.files, evaluation, coachEvaluation };
    const name = path.join(cacheDir, 'latest-cpu-report.json'); await writeFile(name, JSON.stringify(report, null, 2) + '\n');
    const result = checkCPUReport(report, inputs, { full });
    console.log(`CPU model: arithmetic ${result.arithmetic.count}/${result.arithmetic.count}, coach ${result.coach.count}/${result.coach.count}; all accepted. Report: ${name}`);
    return report;
  } finally { service.dispose(); }
}
