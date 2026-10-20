import { validateInput, validateOutput, fallback } from './prompt-registry.js';
export const GOLDEN = Object.freeze([
  { id: 'add-zero', input: { a: 0, b: 12, op: '+', answer: 12 } },
  { id: 'negative', input: { a: 7, b: 18, op: '-', answer: -11 } },
  { id: 'multiply', input: { a: 23, b: 14, op: '*', answer: 322 } },
  { id: 'carry', input: { a: 987, b: 65, op: '+', answer: 1052 } }
]);
export const HOLDOUT = Object.freeze([
  { id: 'holdout-zero-product', input: { a: 0, b: 9999, op: '*', answer: 0 } },
  { id: 'holdout-borrow', input: { a: 1000, b: 997, op: '-', answer: 3 } },
  { id: 'holdout-negative-product', input: { a: -13, b: 17, op: '*', answer: -221 } }
]);
export async function runEvaluation(service, { dataset = GOLDEN, repeats = 3, deadlineMs = 10000, signal, onResult = () => {} } = {}) {
  const results = []; const started = Date.now();
  for (let repeat = 0; repeat < repeats; repeat++) for (const fixture of dataset) {
    if (signal?.aborted) return summarize(results, started, true);
    const result = await service.runTask({ taskId: 'arithmetic-explanation', input: fixture.input }, { deadlineMs, signal, bypassCache: true, captureLocalPayload: true });
    const record = { fixtureId: fixture.id, repeat, valid: validateOutput(result.output, fixture.input),
      acceptedProviderOutput: result.status === 'success' && result.source !== 'curated-fallback', ...result };
    results.push(record); onResult(record);
  }
  return summarize(results, started, false);
}
function summarize(results, started, cancelled) {
  const times = results.map((r) => r.timings.totalMs).sort((a, b) => a - b);
  const accepted = results.filter((r) => r.acceptedProviderOutput).length;
  return { version: 'sharp-eval-v1', startedAt: started, completedAt: Date.now(), cancelled, count: results.length,
    accepted, fallbackCount: results.filter((r) => r.status === 'fallback').length,
    acceptedRate: results.length ? accepted / results.length : null,
    p50Ms: times.length ? times[Math.floor((times.length - 1) * .5)] : null,
    p95Ms: times.length ? times[Math.floor((times.length - 1) * .95)] : null,
    qualification: 'Fixture evaluation only; this does not certify physical devices.', results };
}
export function regressionFromTrace(trace) {
  if (!validateInput(trace.fixtureInput)) throw new Error('This trace has no approved local fixture input.');
  return { version: 1, taskId: 'arithmetic-explanation', input: trace.fixtureInput, expected: fallback(trace.fixtureInput),
    regressionReason: trace.reason || 'review', promptVersion: trace.promptVersion, validatorVersion: trace.validatorVersion };
}
