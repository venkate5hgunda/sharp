import { COACH_POLICY, coachChoices, validQuote, runCoachTask } from './coach-contract.js';
const input = (screen, recentDomain, recentResult, weeklyVisits = 0) => ({ screen, recentDomain, recentResult, weeklyVisits });
const domains = ['memory', 'math', 'logic', 'comprehension', 'focus', 'mixed'];
export const COACH_GOLDEN = domains.flatMap(domain => ['steady', 'challenging'].map(result => ({ id: `golden.session.${domain}.${result}`, input: input('session', domain, result) })));
export const COACH_HOLDOUT = [...domains.map(domain => ({ id: `holdout.new.${domain}`, input: input('session', domain, 'new', 7) })),
  ...['today', 'exercises', 'progress', 'memory', 'settings', 'backup', 'model', 'diagnostics'].map((screen, i) => ({ id: `holdout.screen.${screen}`, input: input(screen, 'mixed', i % 2 ? 'challenging' : 'steady', i % 2 ? 0 : 3) })),
  { id: 'holdout.weekly.complete', input: input('progress', 'logic', 'steady', 7) }];
export const COACH_FULL = [...COACH_GOLDEN, ...COACH_HOLDOUT];
export const COACH_SMOKE = [COACH_GOLDEN[0], COACH_GOLDEN[3], COACH_HOLDOUT.at(-1)];
export async function evaluateCoach(provider, { full = true, source = 'model', signal, onResult = () => {} } = {}) {
  const fixtures = full ? COACH_FULL : COACH_SMOKE, repeats = full ? COACH_POLICY.repeats : 1;
  const startedAt = Date.now(), results = [];
  for (let repeat = 0; repeat < repeats; repeat++) for (const fixture of fixtures) {
    if (signal?.aborted) throw new Error('cancelled');
    const result = await runCoachTask(provider, fixture.input, { signal, requestId: `eval-coach-${repeat}-${fixture.id}` });
    onResult({ fixtureId: fixture.id, repeat, ...result });
    results.push({ ...result, source: result.source === 'model' ? source : result.source, fixtureId: fixture.id, repeat });
  }
  return { version: 'sharp-coach-eval-v1', promptVersion: COACH_POLICY.version, validatorVersion: COACH_POLICY.validatorVersion, startedAt, completedAt: Date.now(), results };
}
export function checkCoachEvaluation(evaluation, { full = true, source = 'model', maxP95Ms = COACH_POLICY.maxP95Ms } = {}) {
  const fail = text => { throw new Error(`Coach qualification: ${text}`); };
  const fixtures = full ? COACH_FULL : COACH_SMOKE, count = fixtures.length * (full ? COACH_POLICY.repeats : 1);
  if (evaluation?.version !== 'sharp-coach-eval-v1' || evaluation.promptVersion !== COACH_POLICY.version || evaluation.validatorVersion !== COACH_POLICY.validatorVersion || evaluation.results?.length !== count) fail('identity or coverage');
  if (!Number.isFinite(evaluation.startedAt) || !Number.isFinite(evaluation.completedAt) || evaluation.completedAt < evaluation.startedAt) fail('invalid timestamps');
  const times = [];
  for (let i = 0; i < count; i++) {
    const result = evaluation.results[i], fixture = fixtures[i % fixtures.length];
    if (result.fixtureId !== fixture.id || result.repeat !== Math.floor(i / fixtures.length)) fail('fixture order or repetition');
    if (result.source !== source || result.status !== 'success' || result.reason !== null || !validQuote(result.output, fixture.input)) fail(`${fixture.id}: unaccepted, fallback, wrong source or invalid contextual quote`);
    if (!Number.isFinite(result.totalMs) || result.totalMs < 0 || result.totalMs > COACH_POLICY.maxTaskMs) fail('task deadline');
    times.push(result.totalMs);
  }
  times.sort((a,b) => a-b); const p95Ms = times[Math.ceil(count * .95) - 1];
  if (p95Ms > maxP95Ms) fail('p95 latency');
  return { count, p95Ms, maxMs: times.at(-1), accepted: count, fallbacks: 0 };
}
// Useful only for testing the harness. Never produces real-model evidence.
export const reviewedFixtureProvider = () => ({ runTask: async request => JSON.stringify({ quote: coachChoices(request.input.context)[0] }), cancel() {} });
