import { evaluateCoach, checkCoachEvaluation, reviewedFixtureProvider } from '../js/intelligence/coach-evaluation.js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { evaluationInputs } from './evaluation-inputs.mjs';
import { IntelligenceService } from '../js/intelligence/service.js';
import { runEvaluation } from '../js/intelligence/evaluation.js';
import { checkEvaluation, FULL_DATASET, QUALITY } from '../js/intelligence/evaluation-quality.js';
import { checkReleasePolicy } from '../js/intelligence/release-policy.js';
import { FEATURES } from '../js/core/feature-flags.js';
import { MODEL_PROFILE } from '../js/intelligence/model-manifest.js';

const root = fileURLToPath(new URL('../', import.meta.url));
try {
  const args = new Set(process.argv.slice(2));
  for (const arg of args) if (!['--commit', '--regression-only', '--full', '--real', '--release'].includes(arg)) throw new Error(`Unknown evaluation option: ${arg}`);
  if (args.has('--real') && (args.has('--commit') || args.has('--regression-only') || args.has('--release'))) throw new Error('Real-model qualification must run separately from commit/regression/release verification.');
  const coachHarness = await evaluateCoach(reviewedFixtureProvider(), { source: 'fixture' });
  console.log(`Coach deterministic harness: ${checkCoachEvaluation(coachHarness, { source: 'fixture' }).count} cases passed (not model evidence).`);
  const service = new IntelligenceService();
  try {
    await service.prepare();
    const evaluation = await runEvaluation(service, { dataset: FULL_DATASET, repeats: QUALITY.repeats });
    checkEvaluation(evaluation, { dataset: FULL_DATASET, repeats: QUALITY.repeats, source: 'stub' });
    console.log(`Arithmetic deterministic harness: ${evaluation.count}/${evaluation.count} passed (not model evidence).`);
  } finally { service.dispose(); }
  if (args.has('--real')) {
    // Only explicit qualification launches Chromium/downloads weights. No fallback on failure.
    const { runModelEvaluations } = await import('./run-model-evals.mjs');
    await runModelEvaluations({ full: true, inputs: await evaluationInputs(root), cacheDir: process.env.SHARP_EVAL_CACHE_DIR || path.join(root, '.cache/sharp-evals') });
    console.log('Fresh full qualification completed. Record its report with eval:record; enablement remains a separate reviewed change.');
  } else {
    const evidenceRequired = FEATURES.browserInference || MODEL_PROFILE.qualified || args.has('--release');
    const report = evidenceRequired ? JSON.parse(await readFile(path.join(root, 'evals/model-baseline.json'), 'utf8').catch(() => 'null')) : null;
    const result = checkReleasePolicy({ inferenceEnabled: FEATURES.browserInference, qualified: MODEL_PROFILE.qualified,
      report, inputs: evidenceRequired ? await evaluationInputs(root) : null, requireQualification: args.has('--release') });
    console.log(result.evidenceRequired ? 'Release evidence: current full arithmetic and coach model reports verified.' : 'Development gate: inference disabled and profile unqualified; GPU qualification is separate (npm run eval:full).');
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
