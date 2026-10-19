import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSimpleChecksum, validateAndMigrateBackup } from '../js/backup.js';

test('computeSimpleChecksum generates deterministic hex hashes', () => {
  const str1 = '{"appName":"sharp","version":1}';
  const str2 = '{"appName":"sharp","version":1}';
  const str3 = '{"appName":"sharp","version":2}';

  const hash1 = computeSimpleChecksum(str1);
  const hash2 = computeSimpleChecksum(str2);
  const hash3 = computeSimpleChecksum(str3);

  assert.equal(hash1, hash2, 'Identical strings must have identical checksums');
  assert.notEqual(hash1, hash3, 'Different strings must produce different checksums');
  assert.equal(hash1.length, 8, 'Checksum should be 8-character hex string');
});

test('validateAndMigrateBackup validates structure and rejects corrupted payloads', () => {
  // Test invalid JSON
  const invalidJsonRes = validateAndMigrateBackup('{ broken json');
  assert.equal(invalidJsonRes.valid, false);

  // Test wrong app
  const wrongAppRes = validateAndMigrateBackup(JSON.stringify({ appName: 'other', schemaVersion: 1 }));
  assert.equal(wrongAppRes.valid, false);

  // Test valid payload
  const validPayload = {
    appName: 'sharp',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    exportDate: '2026-10-18',
    data: {
      ratings: { memory: 1050, math: 1100 },
      streaks: { current: 5, longest: 10 },
      session_history: [{ id: '1', score: 100 }]
    }
  };
  const validRes = validateAndMigrateBackup(validPayload);
  assert.equal(validRes.valid, true);
  assert.equal(validRes.summary.sessionCount, 1);
  assert.equal(validRes.summary.streak, 5);
});

import { beforeEach, after } from 'node:test';
import { applyBackup, generateBackupPayload } from '../js/backup.js';
import { loadJSON, saveJSON, getAllSharpData } from '../js/storage.js';
import { escapeHTML } from '../js/content-validation.js';

let store;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
beforeEach(() => {
  const values = new Map();
  store = {
    values, failWrite: () => false,
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (this.failWrite(key)) throw new Error('Quota exceeded');
      values.set(key, String(value));
    },
    removeItem: (key) => values.delete(key),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; }
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: store });
});
after(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
});
const legacyBackup = (data = {}) => ({ appName: 'sharp', schemaVersion: 1, exportedAt: '2026-10-19T00:00:00.000Z', data });

test('backup export verifies and detects changed or empty checksums', () => {
  saveJSON('ratings', { math: 1100 });
  const backup = generateBackupPayload();
  assert.equal(validateAndMigrateBackup(JSON.stringify(backup)).integrityVerified, true);
  backup.data.ratings.math = 1200;
  assert.match(validateAndMigrateBackup(backup).error, /checksum/);
  backup.checksum = '';
  assert.equal(validateAndMigrateBackup(backup).valid, false);
  const legacy = validateAndMigrateBackup(legacyBackup());
  assert.equal(legacy.valid, true);
  assert.equal(legacy.integrityVerified, false);
  assert.equal(legacy.warnings.length, 1);
});

test('unsupported schemas and malformed records cannot reach restore', () => {
  for (const version of [0, 1.5, 2, '1']) {
    assert.equal(validateAndMigrateBackup({ ...legacyBackup(), schemaVersion: version }).valid, false);
  }
  for (const data of [null, [], { ratings: null }, { ratings: { math: '1100' } },
    { ratings: { math: Infinity } }, { ratings: { math: 599 } }, { unknown: {} },
    { streaks: { current: -1 } }, { streaks: { lastWorkoutDate: '2026-02-30' } },
    { session_history: [{ id: 'one', accuracy: '0.7' }] },
    { session_history: [{ id: 'one' }, { id: 'one' }] },
    { preferences: { morningTime: '25:30' } }, { delayed_memory: { status: 'committed' } },
    { profile: { name: '<img src=x onerror=alert(1)>' } },
    JSON.parse('{"profile":{"__proto__":{"polluted":true}}}')]) {
    assert.equal(validateAndMigrateBackup(legacyBackup(data)).valid, false, JSON.stringify(data));
    assert.equal(applyBackup(data).success, false);
  }
  assert.equal({}.polluted, undefined);
});

test('restore replaces only Sharp data and merge deduplicates sessions', () => {
  saveJSON('ratings', { math: 1100 });
  saveJSON('preferences', { sound: false });
  saveJSON('session_history', [{ id: 'same', score: 10 }]);
  store.setItem('another-app', 'keep');
  assert.equal(applyBackup({ ratings: { math: 1200 }, session_history: [{ id: 'same', score: 20 }, { id: 'new' }] }, 'merge').success, true);
  assert.equal(loadJSON('session_history').length, 2);
  assert.equal(loadJSON('session_history')[0].score, 10);
  assert.equal(loadJSON('preferences').sound, false);
  assert.equal(applyBackup({ ratings: { memory: 1050 } }).success, true);
  assert.deepEqual(loadJSON('ratings'), { memory: 1050 });
  assert.equal(loadJSON('preferences'), null);
  assert.equal(store.getItem('another-app'), 'keep');
  assert.equal(store.getItem('sharp:__restore_journal'), null);
});

test('mid-restore storage failure rolls back the complete previous snapshot', () => {
  saveJSON('ratings', { math: 1150 });
  saveJSON('preferences', { sound: false });
  const before = getAllSharpData();
  let failed = false;
  store.failWrite = (key) => {
    if (key === 'sharp:streaks' && !failed) { failed = true; return true; }
    return false;
  };
  const result = applyBackup({ ratings: { math: 1400 }, streaks: { current: 3 } });
  assert.equal(result.success, false);
  assert.deepEqual(getAllSharpData(), before);
  assert.equal(store.getItem('sharp:__restore_journal'), null);
});

test('full storage preserves reads and fails restore before replacing progress', () => {
  saveJSON('ratings', { memory: 1250 });
  store.failWrite = () => true;
  assert.deepEqual(loadJSON('ratings'), { memory: 1250 });
  assert.equal(saveJSON('ratings', { memory: 1300 }), false);
  assert.equal(applyBackup({ ratings: { memory: 1400 } }).success, false);
  assert.deepEqual(loadJSON('ratings'), { memory: 1250 });
});

test('interrupted restore recovers on next access, including newly added keys', () => {
  saveJSON('ratings', { math: 1100 });
  const old = Object.fromEntries(store.values);
  store.setItem('sharp:__restore_journal', JSON.stringify(old));
  store.setItem('sharp:ratings', JSON.stringify({ math: 1400 }));
  store.setItem('sharp:streaks', JSON.stringify({ current: 4 }));
  assert.deepEqual(loadJSON('ratings'), { math: 1100 });
  assert.equal(loadJSON('streaks'), null);
  assert.equal(store.getItem('sharp:__restore_journal'), null);
});

test('plain text escaping protects quotes and markup in rendered choices', () => {
  assert.equal(escapeHTML('a" onclick="x <b>&\'z'), 'a&quot; onclick=&quot;x &lt;b&gt;&amp;&#39;z');
});
