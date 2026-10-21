import test from 'node:test';
import assert from 'node:assert/strict';
import { weeklyJourney, coachContext, curatedQuote } from '../js/core/engagement.js';
import { validQuote } from '../js/coach.js';
test('weekly rewards count distinct completed local days and exclude practice, incomplete and previous weeks', () => {
  const state = { workouts: { a: { completedAt: 1, completedDate: '2026-10-19' }, b: { completedAt: 2, completedDate: '2026-10-19' }, c: { completedAt: 3, completedDate: '2026-10-20', practice: true }, d: { date: '2026-10-21' }, e: { completedAt: 4, completedDate: '2026-10-18' } } };
  const journey = weeklyJourney(state, new Date('2026-10-21T12:00:00'));
  assert.equal(journey.count, 1); assert.equal(journey.days[0].key, '2026-10-19'); assert.equal(journey.days[2].today, true);
  assert.equal(weeklyJourney(state, new Date('2026-10-25T12:00:00')).days[6].key, '2026-10-25');
  assert.equal(weeklyJourney(state, new Date('2026-10-26T12:00:00')).count, 0);
});
test('coach receives coarse context without answers, names or raw question text', () => {
  const state = { workouts: {}, rounds: { a: { timestamp: 1, domain: 'logic', count: 10, score: 2, prompt: 'private question' } } };
  const context = coachContext(state, 'session/private-id'); assert.equal(context.screen, 'session'); assert.equal(context.recentResult, 'challenging');
  assert.ok(!JSON.stringify(context).includes('private')); assert.match(curatedQuote(context), /explanation|strategy/);
});
test('coach rejects oversized, markup, malformed and prohibited model outputs', () => {
  assert.ok(validQuote({ quote: 'Try one small puzzle and look for a new clue.' }, { screen: 'today', recentDomain: 'mixed', recentResult: 'new', weeklyVisits: 0 }));
  for (const value of [{ quote: '<script>hello world</script>' }, { quote: 'x'.repeat(221) }, { quote: 'This will cure your condition.' }, { quote: 'hello there my friend', extra: true }, null]) assert.ok(!validQuote(value));
});
