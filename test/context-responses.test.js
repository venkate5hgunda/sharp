import test from 'node:test';
import assert from 'node:assert/strict';
import { COACH_RESPONSES } from '../data/coach-responses.js';
import { contextualResponses, createCoachPacer } from '../js/core/coach-responses.js';
const context = { screen: 'session', recentDomain: 'math', recentResult: 'steady', weeklyVisits: 0 };
test('offline repository contains distinct reviewed, bounded contextual messages', () => {
  const lines = Object.values(COACH_RESPONSES).flat(); assert.equal(lines.length, 48); assert.equal(new Set(lines).size, 48);
  for (const line of lines) { assert.ok(line.split(/\s+/).length >= 8 && line.split(/\s+/).length <= 30, line); assert.ok(!/[<>\r\n]/.test(line)); }
  assert.equal(contextualResponses(context), COACH_RESPONSES.math);
  assert.equal(contextualResponses({ ...context, recentResult: 'challenging' }), COACH_RESPONSES.challenging);
  assert.equal(contextualResponses({ ...context, screen: 'progress', weeklyVisits: 2 }), COACH_RESPONSES.progress);
  assert.equal(contextualResponses({ ...context, screen: 'progress', weeklyVisits: 3 }), COACH_RESPONSES.weekly);
  assert.equal(contextualResponses(null), COACH_RESPONSES.general);
});
test('automatic encouragement waits 90 seconds across contexts; explicit requests rotate without immediate repeats', () => {
  let time = 0; const pacer = createCoachPacer({ now: () => time });
  const first = pacer.next(context); assert.ok(first);
  assert.equal(pacer.next({ ...context, recentResult: 'challenging' }), null);
  time = 89999; assert.equal(pacer.next(context), null); time = 90000;
  assert.notEqual(pacer.next(context), first);
  let previous;
  for (let i = 0; i < 30; i++) { const line = pacer.next(context, { force: true }); assert.ok(line); assert.notEqual(line, previous); previous = line; }
  assert.equal(pacer.next(context), null);
});
