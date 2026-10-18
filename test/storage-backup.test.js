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
