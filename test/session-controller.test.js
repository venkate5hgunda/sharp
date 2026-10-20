import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { Repository } from '../js/persistence/repository.js';
import { SessionController } from '../js/session/controller.js';
import { progressMetrics } from '../js/session/metrics.js';

async function setup() { const factory = new IDBFactory(); const repo = await new Repository({ factory }).open();
  return { factory, repo, controller: new SessionController(repo, { owner: 'one' }) }; }
test('quiz reload preserves options and feedback; repeated answers/commits apply once', async () => {
  const { factory, repo, controller } = await setup();
  const id = await controller.start('math-arithmetic');
  await controller.begin(id);
  let round = repo.snapshot().sessions[id].rounds[0];
  const stimulus = structuredClone(round.items);
  const response = round.items[0].correctOptionId;
  await Promise.all([controller.answer(id, response, { activeMs: 1000 }), controller.answer(id, response, { activeMs: 1000 })]);
  const reloaded = await new Repository({ factory }).open();
  assert.deepEqual(reloaded.snapshot().sessions[id].rounds[0].items, stimulus);
  assert.equal(reloaded.snapshot().sessions[id].rounds[0].phase, 'feedback');
  assert.equal(Object.keys(reloaded.snapshot().attempts).length, 1);
  await controller.next(id);
  await assert.rejects(controller.answer(id, response, {}, { roundIndex: 0, position: 0 }), /earlier/);
  for (let i = 1; i < 8; i++) {
    round = repo.snapshot().sessions[id].rounds[0];
    await controller.answer(id, round.items[i].correctOptionId, { activeMs: 1000 });
    await controller.next(id);
  }
  await controller.next(id);
  assert.equal(Object.keys(repo.snapshot().rounds).length, 1);
  assert.equal(progressMetrics(repo.snapshot()).correct, 8);
  assert.equal(repo.snapshot().sessions[id].status, 'completed');
  repo.close(); reloaded.close();
});
test('a second tab cannot commit until takeover, then the old owner cannot write', async () => {
  const { factory, repo, controller } = await setup();
  const id = await controller.start('logic-deduction'); await controller.begin(id);
  const other = await new Repository({ factory }).open();
  const contender = new SessionController(other, { owner: 'two' });
  await assert.rejects(contender.claim(id), /Another tab/);
  await contender.claim(id, true);
  await assert.rejects(controller.answer(id, 'o0'), /another tab/);
  await contender.answer(id, other.snapshot().sessions[id].rounds[0].items[0].correctOptionId);
  assert.equal(Object.keys(other.snapshot().attempts).length, 1);
  repo.close(); other.close();
});
test('timed interruption replays stimulus without a failure and workout completion commits only after four rounds', async () => {
  const { repo, controller } = await setup(); const id = await controller.start();
  await controller.begin(id); const stimulus = repo.snapshot().sessions[id].rounds[0].items;
  await controller.interrupt(id);
  assert.equal(repo.snapshot().sessions[id].rounds[0].phase, 'intro');
  assert.deepEqual(repo.snapshot().sessions[id].rounds[0].items, stimulus);
  assert.equal(Object.keys(repo.snapshot().attempts).length, 0);
  assert.equal(progressMetrics(repo.snapshot()).workoutCount, 0);
  for (let step = 0; step < 4; step++) {
    await controller.begin(id);
    const round = repo.snapshot().sessions[id].rounds[step];
    for (const item of round.items) { await controller.answer(id, round.game === 'pattern-flash' ? item.sequence : item.correctOptionId); await controller.next(id); }
    if (step < 3) { assert.equal(progressMetrics(repo.snapshot()).workoutCount, 0); await controller.nextRound(id); }
  }
  assert.equal(progressMetrics(repo.snapshot()).workoutCount, 1);
  assert.equal(progressMetrics(repo.snapshot()).currentStreak, 1);
  repo.close();
});
test('practice is retained separately and cannot change ratings', async () => {
  const { repo, controller } = await setup(); const id = await controller.start('logic-deduction', { practice: true });
  await controller.begin(id); for (const q of repo.snapshot().sessions[id].rounds[0].items) { await controller.answer(id, q.correctOptionId); await controller.next(id); }
  const metrics = progressMetrics(repo.snapshot()); assert.equal(metrics.eligible, 0); assert.equal(metrics.ratings.logic, 1000); repo.close();
});
test('same-tab reload can rotate ownership without waiting for an unload write; stale page loses permission', async () => {
  const { repo, controller } = await setup(); const id = await controller.start('logic-deduction');
  const reloaded = new SessionController(repo, { owner: 'new-page', previousOwner: 'one' }); await reloaded.claim(id);
  await assert.rejects(controller.begin(id), /another tab/); await reloaded.begin(id); repo.close();
});
test('paused and hidden intervals are stored separately from monotonic active response time', async () => {
  const { repo } = await setup(); let time = 100000;
  const controller = new SessionController(repo, { owner: 'clock', now: () => time });
  const id = await controller.start('logic-deduction'); await controller.begin(id);
  await controller.interrupt(id, { activeMs: 1000, readingMs: 300, hiddenMs: 0, pausedMs: 0 }, true); time += 120000;
  await controller.claim(id); const round = repo.snapshot().sessions[id].rounds[0];
  assert.equal(round.pendingTiming.hiddenMs, 120000); assert.equal(round.pendingTiming.activeMs, 1000);
  await controller.answer(id, round.items[0].correctOptionId, { ...round.pendingTiming, activeMs: 1500 });
  const attempt = Object.values(repo.snapshot().attempts)[0]; assert.equal(attempt.activeMs, 1500); assert.equal(attempt.hiddenMs, 120000); repo.close();
});
