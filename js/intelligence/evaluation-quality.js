import { GOLDEN, HOLDOUT } from './evaluation.js';
import { MODEL_PROFILE } from './model-manifest.js';
import { PROMPTS, canonicalJSON, validateOutput } from './prompt-registry.js';

export const FULL_DATASET = Object.freeze([...GOLDEN, ...HOLDOUT]);
export const SMOKE_DATASET = Object.freeze(GOLDEN.slice(0, 3));
export const QUALITY = Object.freeze({ repeats: 3, maxP95Ms: 3000, maxTaskMs: 10000 });
const requireQuality = (condition, message) => { if (!condition) throw new Error(`Eval quality: ${message}`); };

export function checkEvaluation(evaluation, { dataset = FULL_DATASET, repeats = QUALITY.repeats, source = 'model', artifactIdentity, maxP95Ms = QUALITY.maxP95Ms } = {}) {
  const count = dataset.length * repeats;
  requireQuality(evaluation?.version === 'sharp-eval-v1' && evaluation.cancelled === false, 'missing or cancelled evaluation');
  requireQuality(evaluation.results?.length === count && evaluation.count === count, `expected ${count} results`);
  const prompt = PROMPTS['arithmetic-explanation'];
  const artifact = `${MODEL_PROFILE.runtime}:${MODEL_PROFILE.weightsRevision}:${MODEL_PROFILE.libraryRevision}`;
  for (let index = 0; index < count; index++) {
    const result = evaluation.results[index], fixture = dataset[index % dataset.length];
    requireQuality(result.fixtureId === fixture.id && result.repeat === Math.floor(index / dataset.length), 'fixture coverage/order');
    requireQuality(result.status === 'success' && result.source === source && result.acceptedProviderOutput === true && result.valid === true, `${fixture.id}: rejected, fallback or wrong provider`);
    requireQuality(validateOutput(result.output, fixture.input), `${fixture.id}: schema or arithmetic failed`);
    requireQuality(result.taskId === 'arithmetic-explanation' && result.promptVersion === prompt.version && result.validatorVersion === prompt.validatorVersion, 'prompt/validator identity');
    requireQuality(result.artifact === (artifactIdentity || (source === 'model' ? artifact : 'sharp-stub-v1')), 'artifact identity');
    requireQuality(Number.isFinite(result.timings?.totalMs) && result.timings.totalMs >= 0 && result.timings.totalMs <= QUALITY.maxTaskMs, 'task latency');
  }
  const times = evaluation.results.map((result) => result.timings.totalMs).sort((a, b) => a - b);
  const p50 = times[Math.floor((count - 1) * .5)], p95 = times[Math.floor((count - 1) * .95)];
  requireQuality(evaluation.accepted === count && evaluation.acceptedRate === 1 && evaluation.fallbackCount === 0, 'acceptance totals');
  requireQuality(evaluation.p50Ms === p50 && evaluation.p95Ms === p95, 'latency totals');
  requireQuality(p95 <= maxP95Ms, `p95 exceeds ${maxP95Ms}ms`);
  return { count, p95Ms: p95 };
}
export function checkModelReport(report, inputs, evaluationOptions) {
  requireQuality(report?.version === 'sharp-model-benchmark-v3', 'record a fresh v3 browser report');
  requireQuality(report.inputFingerprint === inputs.fingerprint && canonicalJSON(report.inputFiles) === canonicalJSON(inputs.files), 'model evidence is stale; rerun the browser benchmark');
  requireQuality(canonicalJSON(report.profile) === canonicalJSON(MODEL_PROFILE), 'model profile changed');
  return checkEvaluation(report.evaluation, evaluationOptions);
}

export function checkFreshModelRun(report, inputs, { full, runId, startedAt, completedAt }) {
  requireQuality(typeof runId === 'string' && runId.length > 0 && report?.commitRun?.runId === runId, 'a new model run is required for this commit');
  requireQuality(report.commitRun.mode === (full ? 'full' : 'smoke'), 'incorrect live evaluation scope');
  requireQuality(Number.isFinite(report.evaluation?.startedAt) && Number.isFinite(report.evaluation?.completedAt) &&
    report.evaluation.startedAt >= startedAt && report.evaluation.completedAt >= report.evaluation.startedAt &&
    report.evaluation.completedAt <= completedAt, 'model run is outside this invocation');
  return checkModelReport(report, inputs, { dataset: full ? FULL_DATASET : SMOKE_DATASET, repeats: full ? QUALITY.repeats : 1 });
}

// The isolated pilot changes this one flag; evidence still binds to release source.
export function normalizeEvaluationInput(name, bytes) {
  if (name !== 'js/core/feature-flags.js') return bytes;
  return new TextEncoder().encode(new TextDecoder().decode(bytes).replace('browserInference: true', 'browserInference: false'));
}
export async function fingerprintInputs(files, readBytes) {
  const hashes = [];
  for (const name of [...files].sort()) {
    const bytes = normalizeEvaluationInput(name, await readBytes(name));
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    hashes.push([name, [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')]);
  }
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJSON(hashes)));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function captureEvaluationInputs() {
  const root = new URL('../../', import.meta.url);
  const response = await fetch(new URL('evaluation-inputs.json', root), { cache: 'no-store' });
  if (!response.ok) throw new Error('Prepare a fresh isolated pilot to record model evidence.');
  const inputs = await response.json();
  if (!Array.isArray(inputs.files) || inputs.files.some((name) => typeof name !== 'string' || name.includes('..') || name.startsWith('/') || name.includes(':'))) throw new Error('Invalid evaluation inputs.');
  const fingerprint = await fingerprintInputs(inputs.files, async (name) => {
    const file = await fetch(new URL(name, root), { cache: 'no-store' });
    if (!file.ok) throw new Error(`Missing evaluation input: ${name}`);
    return new Uint8Array(await file.arrayBuffer());
  });
  if (fingerprint !== inputs.fingerprint) throw new Error('Pilot source changed. Prepare a fresh pilot.');
  return { inputFingerprint: fingerprint, inputFiles: inputs.files };
}
