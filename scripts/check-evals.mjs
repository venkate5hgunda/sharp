import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { evaluationInputs, needsFullEvaluation } from './evaluation-inputs.mjs';
import { IntelligenceService } from '../js/intelligence/service.js';
import { runEvaluation } from '../js/intelligence/evaluation.js';
import { checkEvaluation, checkModelReport, FULL_DATASET, SMOKE_DATASET, QUALITY } from '../js/intelligence/evaluation-quality.js';

const root = fileURLToPath(new URL('../', import.meta.url));
try {
  const inputs = await evaluationInputs(root);
  const report = JSON.parse(await readFile(new URL('../evals/model-baseline.json', import.meta.url), 'utf8').catch(() => 'null'));
  const changed = JSON.parse(process.env.SHARP_EVAL_CHANGED_FILES || '[]');
  const full = needsFullEvaluation(changed) || process.argv.includes('--full') || process.env.SHARP_EVAL_FULL === '1' || report?.inputFingerprint !== inputs.fingerprint;
  const service = new IntelligenceService();
  try {
    await service.prepare();
    const dataset = full ? FULL_DATASET : SMOKE_DATASET, repeats = full ? QUALITY.repeats : 1;
    const evaluation = await runEvaluation(service, { dataset, repeats });
    checkEvaluation(evaluation, { dataset, repeats, source: 'stub' });
    console.log(`Eval ${full ? 'full regression' : 'smoke'}: ${evaluation.count}/${evaluation.count} deterministic samples passed.`);
  } finally { service.dispose(); }
  // Check evidence integrity on every commit; a changed fingerprint requires a new actual-model run.
  const quality = checkModelReport(report, inputs);
  console.log(`Model evidence: ${quality.count}/${quality.count} accepted; p95 ${quality.p95Ms}ms; source fingerprint matches.`);
  if (full) {
    const tests = spawnSync(process.execPath, ['--test', 'test/intelligence.test.js', 'test/webllm-provider.test.js', 'test/evaluation-quality.test.js', 'test/eval-hook.test.js'], { cwd: root, stdio: 'inherit' });
    if (tests.status !== 0) throw new Error('Full evaluation regression tests failed.');
  }
} catch (error) {
  console.error(`${error.message}\nTo refresh evidence: npm run prepare:inference-pilot; run the full browser benchmark; npm run eval:record -- /path/to/report.json; stage evals/model-baseline.json.`);
  process.exitCode = 1;
}
