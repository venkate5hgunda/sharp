import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { Repository, migrateLegacy } from '../js/persistence/repository.js';

function storage(entries) {
  const items = Object.entries(entries);
  return { length: items.length, key: (i) => items[i][0], getItem: (key) => entries[key] };
}
test('migration snapshots every legacy byte, quarantines malformed keys, and retries idempotently', async () => {
  const legacy = storage({ 'sharp:ratings': '{"math":1234}', 'sharp:preferences': '{"sound":false}',
    'sharp:streaks': '{"current":3,"longest":4,"lastWorkoutDate":"2026-10-18","history":{"2026-10-18":1}}',
    'sharp:unknown': 'not json' });
  const factory = new IDBFactory();
  const first = await new Repository({ factory, legacyStorage: legacy }).open();
  const migrated = first.snapshot();
  assert.equal(migrated.ratingsBaseline.math, 1234);
  assert.equal(migrated.preferences.sound, false);
  assert.deepEqual(migrated.migration.quarantine, ['sharp:unknown']);
  assert.equal(migrated.migration.calendarPolicy, 'utc-legacy');
  assert.equal(migrated.migration.raw['sharp:unknown'], 'not json');
  assert.match(migrated.migration.digest, /^[a-f0-9]{64}$/);
  await first.setPreferences({ theme: 'dark' });
  const second = await new Repository({ factory, legacyStorage: storage({}) }).open();
  assert.equal(second.snapshot().preferences.theme, 'dark');
  assert.deepEqual(second.snapshot().migration, migrated.migration);
  first.close(); second.close();
});
test('concurrent tabs transact against the latest state; aborted writes preserve all stores', async () => {
  const factory = new IDBFactory();
  const a = await new Repository({ factory }).open();
  const b = await new Repository({ factory }).open();
  await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? a : b).update((state) => {
    state.attempts['a' + i] = { score: 1 }; return state;
  })));
  assert.equal(Object.keys((await a.refresh()).attempts).length, 20);
  const before = a.snapshot();
  await assert.rejects(a.update((state) => { state.attempts = {}; state.rounds.x = {}; throw new Error('quota fixture'); }), /quota fixture/);
  assert.deepEqual(await a.refresh(), before);
  a.close(); b.close();
});
test('migration preserves active delayed memory including readyAt and study identity', async () => {
  const memory = { id: 'dm_123', status: 'committed', createdAt: 1000, readyAt: 21601000,
    items: [{ word: 'Polaris', icon: 'star', category: 'star', cue: 'North' }] };
  const state = await migrateLegacy(storage({ 'sharp:delayed_memory': JSON.stringify(memory) }));
  assert.deepEqual(state.memory, { ...memory, migrated: true });
});
