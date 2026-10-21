import { FULL_DATASET } from '../js/intelligence/evaluation-quality.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkReleasePolicy } from '../js/intelligence/release-policy.js';
import { IntelligenceService } from '../js/intelligence/service.js';
import { runEvaluation } from '../js/intelligence/evaluation.js';
import { MODEL_PROFILE } from '../js/intelligence/model-manifest.js';
import { evaluateCoach, reviewedFixtureProvider } from '../js/intelligence/coach-evaluation.js';
const inputs = { fingerprint: 'synthetic-test-only', files: ['synthetic.js'] };
async function syntheticEvidence() {
  const service = new IntelligenceService();
  const evaluation = await runEvaluation(service, { dataset: FULL_DATASET, repeats: 3 }); service.dispose();
  for (const row of evaluation.results) { row.source = 'model'; row.artifact = `${MODEL_PROFILE.runtime}:${MODEL_PROFILE.weightsRevision}:${MODEL_PROFILE.libraryRevision}`; row.timings.totalMs = 100; }
  evaluation.p50Ms = evaluation.p95Ms = 100;
  const coachEvaluation = await evaluateCoach(reviewedFixtureProvider(), { source: 'fixture' });
  for (const row of coachEvaluation.results) { row.source = 'model'; row.totalMs = 100; }
  return { version: 'sharp-model-benchmark-v3', profile: MODEL_PROFILE, inputFingerprint: inputs.fingerprint, inputFiles: inputs.files, evaluation, coachEvaluation };
}
test('disabled, unqualified development needs neither GPU nor model baseline', () => {
  assert.equal(checkReleasePolicy({ inferenceEnabled: false, qualified: false }).evidenceRequired, false);
});
test('inference cannot be enabled with an unqualified profile, and explicit release rejects it', () => {
  assert.throws(() => checkReleasePolicy({ inferenceEnabled: true, qualified: false }), /qualified/);
  assert.throws(() => checkReleasePolicy({ inferenceEnabled: false, qualified: false, requireQualification: true }), /not qualified/);
});
test('qualified or enabled deployments require full source-matched arithmetic and coach evidence', async () => {
  const report = await syntheticEvidence();
  for (const inferenceEnabled of [false, true]) {
    assert.equal(checkReleasePolicy({ inferenceEnabled, qualified: true, report, inputs }).status, 'evidence-verified');
    for (const mutate of [r => r.inputFingerprint = 'stale', r => delete r.coachEvaluation, r => r.coachEvaluation.results.pop(), r => r.coachEvaluation.results[0].source = 'fixture', r => r.evaluation.results[0].source = 'stub']) {
      const broken = structuredClone(report); mutate(broken);
      assert.throws(() => checkReleasePolicy({ inferenceEnabled, qualified: true, report: broken, inputs }));
    }
    assert.throws(() => checkReleasePolicy({ inferenceEnabled, qualified: true, report: null, inputs }));
  }
});
test('portable CLI succeeds without installed browsers; explicit release stays blocked', async () => {
  const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const cwd = fileURLToPath(new URL('../', import.meta.url));
  const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '/tmp/sharp-no-browsers-required' };
  const development = spawnSync(process.execPath, ['scripts/check-evals.mjs', '--commit'], { cwd, env, encoding: 'utf8' });
  assert.equal(development.status, 0, development.stderr); assert.match(development.stdout, /GPU qualification is separate/);
  const release = spawnSync(process.execPath, ['scripts/check-evals.mjs', '--release'], { cwd, env, encoding: 'utf8' });
  assert.notEqual(release.status, 0); assert.match(release.stderr, /profile is not qualified/);
  const conflict = spawnSync(process.execPath, ['scripts/check-evals.mjs', '--real', '--regression-only'], { cwd, env, encoding: 'utf8' });
  assert.notEqual(conflict.status, 0); assert.match(conflict.stderr, /must run separately/);
});
