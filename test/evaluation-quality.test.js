import test from 'node:test';
import assert from 'node:assert/strict';
import { IntelligenceService } from '../js/intelligence/service.js';
import { runEvaluation } from '../js/intelligence/evaluation.js';
import { MODEL_PROFILE, modelAppConfig } from '../js/intelligence/model-manifest.js';
import { checkEvaluation, checkModelReport, FULL_DATASET, SMOKE_DATASET, checkFreshModelRun, fingerprintInputs } from '../js/intelligence/evaluation-quality.js';
import { needsFullEvaluation, evaluationInputs } from '../scripts/evaluation-inputs.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

async function fixtureReport({ dataset = FULL_DATASET, repeats = 3 } = {}) {
  const service = new IntelligenceService();
  try {
    await service.prepare();
    const evaluation = await runEvaluation(service, { dataset, repeats });
    checkEvaluation(evaluation, { source: 'stub', dataset, repeats });
    // Synthetic report used only for adversarial validator tests, never saved as model evidence.
    for (const result of evaluation.results) {
      result.source = 'model';
      result.artifact = `${MODEL_PROFILE.runtime}:${MODEL_PROFILE.weightsRevision}:${MODEL_PROFILE.libraryRevision}`;
      result.timings.totalMs = 100;
    }
    evaluation.p50Ms = evaluation.p95Ms = 100;
    return { version: 'sharp-model-benchmark-v3', profile: MODEL_PROFILE, inputFingerprint: 'test-only', inputFiles: ['fixture.js'], evaluation };
  } finally { service.dispose(); }
}
const inputs = { fingerprint: 'test-only', files: ['fixture.js'] };
test('quality bar independently checks outputs, coverage, provenance, latency, totals and source freshness', async () => {
  const valid = await fixtureReport(); assert.equal(checkModelReport(valid, inputs).count, 21);
  const mutations = [
    (r) => { r.inputFingerprint = 'old'; },
    (r) => { r.inputFiles = []; },
    (r) => { r.profile = { ...MODEL_PROFILE, modelId: 'other' }; },
    (r) => { r.version = 'sharp-model-benchmark-v2'; },
    (r) => { r.evaluation.cancelled = true; },
    (r) => { r.evaluation.results.pop(); },
    (r) => { r.evaluation.results[0].fixtureId = 'unknown'; },
    (r) => { r.evaluation.results[0].repeat = 1; },
    (r) => { r.evaluation.results[0].source = 'stub'; },
    (r) => { r.evaluation.results[0].source = 'validated-cache'; },
    (r) => { r.evaluation.results[0].status = 'fallback'; },
    (r) => { r.evaluation.results[0].output.answer++; },
    (r) => { r.evaluation.results[0].output.extra = 'unwanted'; },
    (r) => { r.evaluation.results[0].artifact = 'different'; },
    (r) => { r.evaluation.results[0].validatorVersion = 'old'; },
    (r) => { r.evaluation.results[0].timings.totalMs = -1; },
    (r) => { r.evaluation.results[0].timings.totalMs = 10001; },
    (r) => { r.evaluation.acceptedRate = .9; },
    (r) => { r.evaluation.fallbackCount = 1; },
    (r) => { r.evaluation.p95Ms = 99; },
    (r) => { for (const result of r.evaluation.results) result.timings.totalMs = 3001; r.evaluation.p50Ms = r.evaluation.p95Ms = 3001; }
  ];
  for (const mutate of mutations) { const report = structuredClone(valid); mutate(report); assert.throws(() => checkModelReport(report, inputs), /Eval quality/); }
});
test('fingerprints bind file names and bytes, ignoring only the pilot enable flag', async () => {
  const bytes = (value) => new TextEncoder().encode(value);
  const hash = (files, value) => fingerprintInputs(files, async () => bytes(value));
  assert.notEqual(await hash(['a.js'], 'one'), await hash(['a.js'], 'two'));
  assert.notEqual(await hash(['a.js'], 'one'), await hash(['b.js'], 'one'));
  assert.equal(await hash(['js/core/feature-flags.js'], 'browserInference: false'), await hash(['js/core/feature-flags.js'], 'browserInference: true'));
});
test('model and runtime changes trigger full evaluations, including deletions and lock updates', () => {
  for (const file of ['js/intelligence/new-model.js', 'js/views/model-view.js', 'js/core/capabilities.js', 'assets/optional-runtime/worker.js', 'package-lock.json', 'scripts/build-inference.mjs', 'test/webllm-provider.test.js', '.githooks/pre-commit']) assert.equal(needsFullEvaluation([file]), true, file);
  assert.equal(needsFullEvaluation(['README.md', 'css/style.css']), false);
});
test('source fingerprint includes transitive runtime and validation dependencies', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const inputs = await evaluationInputs(root);
  for (const file of ['js/intelligence/prompt-registry.js', 'js/content-validation.js', 'js/core/capabilities.js', 'js/persistence/repository.js', 'js/intelligence/probe-worker.js', 'assets/optional-runtime/webllm-0.2.86-worker.js', 'package-lock.json']) assert.ok(inputs.files.includes(file), file);
  assert.equal(inputs.fingerprint.length, 64);
  const source = await readFile(new URL('../js/intelligence/webllm-provider.js', import.meta.url), 'utf8');
  assert.match(source, /profile !== MODEL_PROFILE/);
  assert.equal(modelAppConfig().model_list.length, 1);
  assert.throws(() => modelAppConfig({ ...MODEL_PROFILE }), /shared model/);
});

test('explicit hardware qualification needs fresh inference; cached reports, stubs and wrong scope fail', async () => {
  for (const full of [false, true]) {
    const startedAt = Date.now();
    const report = await fixtureReport({ dataset: full ? FULL_DATASET : SMOKE_DATASET, repeats: full ? 3 : 1 });
    report.commitRun = { runId: 'current-invocation', mode: full ? 'full' : 'smoke' };
    const options = { full, runId: 'current-invocation', startedAt, completedAt: Date.now() };
    assert.equal(checkFreshModelRun(report, inputs, options).count, full ? 21 : 3);
    assert.throws(() => checkFreshModelRun(report, inputs, { ...options, runId: 'next-commit' }), /new model run/);
    assert.throws(() => checkFreshModelRun(report, inputs, { ...options, full: !full }), /scope/);
    assert.throws(() => checkFreshModelRun(report, inputs, { ...options, startedAt: Date.now() + 1000 }), /outside/);
    assert.throws(() => checkFreshModelRun(report, inputs, { ...options, completedAt: startedAt - 1000 }), /outside/);
    report.evaluation.results[0].source = 'stub';
    assert.throws(() => checkFreshModelRun(report, inputs, options), /wrong provider/);
  }
});
