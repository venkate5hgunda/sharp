import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuestionTimer } from '../js/session/timing.js';

test('reading intervals do not inflate active answer time', () => {
  let time = 0;
  const timer = createQuestionTimer({ reading: true, now: () => time });
  time = 1000;
  timer.setReading(false);
  time = 1400;
  timer.setReading(true);
  time = 1900;
  timer.setReading(false);
  time = 2200;
  assert.deepEqual(timer.read(), { activeMs: 700, readingMs: 1500, hiddenMs: 0, pausedMs: 0 });
});

test('resumed question timing preserves saved intervals and reads do not double count', () => {
  let time = 0;
  const timer = createQuestionTimer({ initial: { activeMs: 300, readingMs: 1000, hiddenMs: 400, pausedMs: 500 }, now: () => time });
  time = 200;
  assert.equal(timer.read().activeMs, 500);
  assert.equal(timer.read().activeMs, 500);
  time = 600;
  assert.deepEqual(timer.read(), { activeMs: 900, readingMs: 1000, hiddenMs: 400, pausedMs: 500 });
});
