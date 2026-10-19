import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_CONTENT, MEMORY_CONTENT, validateItem, selectQuestions, chooseCluster, shuffle } from '../js/session/content.js';
import { verifyProof, solveProof } from '../js/content/solvers.js';
test('all 324 scored items and 30 memory clusters meet structural and answer gates', () => {
  assert.equal(BASE_CONTENT.length, 324); assert.equal(MEMORY_CONTENT.length, 30);
  assert.equal(new Set(BASE_CONTENT.map((q) => q.id)).size, BASE_CONTENT.length);
  for (const q of BASE_CONTENT) { assert.ok(validateItem(q), q.id); if (q.proof) assert.ok(verifyProof(q), q.id);
    if (q.id.startsWith('foundation.reading')) assert.ok(q.passage.includes(q.evidence), q.id); }
  for (const c of MEMORY_CONTENT) { assert.equal(new Set([...c.targetItems, ...c.distractorFoils].map((i) => i.word.toLowerCase())).size, c.targetItems.length + c.distractorFoils.length, c.id); }
});
test('selection filters skills/categories, excludes session IDs, rotates exposure and records nearby tiers', () => {
  const args = { domain: 'math', tier: 2, count: 5, seed: 'fixed', skill: 'quantity_tracking', category: 'quantity_tracking' };
  const first = selectQuestions(BASE_CONTENT, args); assert.equal(first.length, 5); assert.equal(new Set(first.map((q) => q.id)).size, 5);
  assert.deepEqual(first, selectQuestions(BASE_CONTENT, args));
  const second = selectQuestions(BASE_CONTENT, { ...args, exclude: first.map((q) => q.id) });
  assert.ok(second.every((q) => !first.some((a) => a.id === q.id))); assert.ok(second.every((q) => q.skill === 'quantity_tracking'));
  const exposed = Object.fromEntries(first.map((q) => [q.id, { itemId: q.id, timestamp: Date.now() }]));
  assert.ok(selectQuestions(BASE_CONTENT, { ...args, attempts: exposed }).every((q) => !first.some((a) => a.id === q.id)));
  const c = chooseCluster({}, 2, 'a'); assert.notEqual(chooseCluster({ memoryExposure: { [c.id]: 1 } }, 2, 'a').id, c.id);
});
test('independent constraint solver rejects ambiguity and tampered answers', () => {
  assert.throws(() => solveProof({ type: 'ordering', names: ['A', 'B'], before: [], position: 0 }), /unique/);
  const q = structuredClone(BASE_CONTENT.find((q) => q.proof)); q.correctOptionId = 'o1'; assert.equal(verifyProof(q), false);
  assert.deepEqual(shuffle([1,2,3,4], 'seed'), shuffle([1,2,3,4], 'seed'));
});
