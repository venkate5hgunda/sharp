import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { Repository, digest } from '../js/persistence/repository.js';
import { SessionController } from '../js/session/controller.js';
import { exportBackup, readBackup, restoreBackup, validateState } from '../js/persistence/backup-v2.js';
import { progressMetrics } from '../js/session/metrics.js';
import { reminderCalendar, dueReminder } from '../js/core/reminders.js';
async function setup() { return new Repository({ factory: new IDBFactory() }).open(); }
test('v2 export restores active quiz and memory atomically, rejects corruption and future schemas', async () => {
  const repo = await setup(), controller = new SessionController(repo); const id = await controller.start('story-math');
  await controller.begin(id); await controller.answer(id, repo.snapshot().sessions[id].rounds[0].items[0].correctOptionId, { activeMs: 1250, readingMs: 100 });
  assert.equal(validateState(repo.snapshot()), null);
  const exported = await exportBackup(repo), imported = await readBackup(JSON.stringify(exported));
  await restoreBackup(repo, imported.data);
  assert.equal(repo.snapshot().sessions[id].owner, null);
  assert.equal(repo.snapshot().sessions[id].rounds[0].phase, 'feedback');
  assert.equal(Object.keys(repo.snapshot().attempts).length, 1);
  exported.data.attempts[Object.keys(exported.data.attempts)[0]].score = 0;
  await assert.rejects(readBackup(JSON.stringify(exported)), /checksum/);
  exported.schemaVersion = 3; await assert.rejects(readBackup(JSON.stringify(exported)), /schema/);
  const before = repo.snapshot(), bad = structuredClone(before); bad.attempts[Object.keys(bad.attempts)[0]].score = 2;
  await assert.rejects(restoreBackup(repo, bad), /attempt/); assert.deepEqual(repo.snapshot(), before); repo.close();
});
test('merge replays rating evidence instead of taking maximum snapshots and rejects broken references', async () => {
  const repo = await setup(), c = new SessionController(repo); const id = await c.start('logic-deduction'); await c.begin(id);
  for (const q of repo.snapshot().sessions[id].rounds[0].items) { await c.answer(id, q.correctOptionId, { activeMs: 1200 }); await c.next(id); }
  const incoming = repo.snapshot(), rating = progressMetrics(incoming).ratings.logic;
  await restoreBackup(repo, incoming, { mode: 'merge' });
  assert.equal(progressMetrics(repo.snapshot()).ratings.logic, rating); assert.equal(Object.keys(repo.snapshot().rounds).length, 1);
  const broken = repo.snapshot(); broken.sessions = {}; assert.match(validateState(broken), /attempt|round/); repo.close();
});
test('weighted accuracy and five-domain snapshots match hand-calculated fixtures', () => {
  const state = { ratingsBaseline: { memory: 1000, math: 1000, logic: 1000, comprehension: 1000, focus: 1000 },
    attempts: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, { scoring: 'binary-v1', score: i < 9 ? 1 : 0, activeMs: 1000 + i * 100 }])),
    rounds: { a: { id: 'a', timestamp: 1, date: '2026-10-19', domain: 'math', tier: 2, score: 1, count: 1, latencyMs: 1000, expectedMs: 4500 } }, workouts: {}, legacy: {} };
  const m = progressMetrics(state); assert.equal(m.accuracy, .9); assert.equal(m.medianMs, 1400); assert.equal(m.p90Ms, 1800);
  assert.equal(m.dailyScores[0].score, Math.round((4000 + m.ratings.math) / 5));
  assert.equal(progressMetrics({ ...state, attempts: {}, rounds: {} }).accuracy, null);
});
test('calendar export uses local recurring times and foreground reminders respect opt-in and actual readiness', () => {
  const calendar = reminderCalendar({ morningTime: '09:15', eveningTime: '20:45' }, new Date('2026-10-19T12:00:00'));
  assert.match(calendar, /DTSTART:20261019T091500/); assert.match(calendar, /RRULE:FREQ=DAILY/); assert.match(calendar, /BEGIN:VALARM/);
  const state = { preferences: { onboarded: true, foregroundReminders: true }, memory: { status: 'committed', readyAt: 1 } };
  assert.equal(dueReminder(state, new Date('2026-10-19T21:00:00')).id, '2026-10-19:recall');
  state.preferences.foregroundReminders = false; assert.equal(dueReminder(state), null);
});
test('skill trends compare like-for-like windows and withhold sparse or mixed-tier evidence', async () => {
  const { comparableSlices } = await import('../js/session/metrics.js');
  const attempts = Array.from({ length: 20 }, (_, i) => ({ id: String(i), timestamp: i, itemId: `q${i % 12}`, game: 'story-math', skill: 'quantity_tracking', tier: 2, contentVersion: 1,
    inputMode: 'keyboard', scoring: 'binary-v1', score: i < 5 ? 0 : 1, activeMs: i < 10 ? 2000 : 1000 }));
  const [slice] = comparableSlices(attempts); assert.equal(slice.previousAccuracy, .5); assert.equal(slice.recentAccuracy, 1);
  assert.equal(slice.previousMs, 2000); assert.equal(slice.recentMs, 1000); assert.equal(slice.distinctItems, 12);
  assert.ok(comparableSlices(attempts.map((a, i) => ({ ...a, tier: 1 + i % 2 }))).every((s) => !s.enough));
  assert.equal(comparableSlices(attempts.map((a) => ({ ...a, practice: true }))).length, 0);
});
