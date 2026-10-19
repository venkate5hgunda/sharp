import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createId } from '../js/core/identity.js';
import { FEATURES, FEATURE_CONFIG_VERSION } from '../js/core/feature-flags.js';

function calendarInZone(zone, instants, offsets = [0]) {
  const source = `import { localDayKey, shiftLocalDay } from './js/core/calendar.js';
    console.log(JSON.stringify(${JSON.stringify(instants)}.map((instant) => {
      const date = new Date(instant);
      return [localDayKey(date), ...${JSON.stringify(offsets)}.map((days) => localDayKey(shiftLocalDay(date, days)))];
    })));`;
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: new URL('..', import.meta.url), env: { ...process.env, TZ: zone }, encoding: 'utf8'
  }));
}

test('calendar keys use local midnight on both sides of UTC', () => {
  assert.deepEqual(calendarInZone('America/Los_Angeles', ['2026-10-20T02:00:00Z']), [['2026-10-19', '2026-10-19']]);
  assert.deepEqual(calendarInZone('Asia/Kolkata', ['2026-10-19T20:00:00Z']), [['2026-10-20', '2026-10-20']]);
});

test('calendar shifts preserve adjacent days through spring and fall DST transitions', () => {
  assert.deepEqual(calendarInZone('America/Los_Angeles', ['2026-03-09T07:30:00Z', '2026-11-02T07:30:00Z'], [-1, 1]), [
    ['2026-03-09', '2026-03-08', '2026-03-10'],
    ['2026-11-01', '2026-10-31', '2026-11-02']
  ]);
});

test('record IDs are unique under rapid creation and remain valid backup identities', () => {
  const ids = Array.from({ length: 1000 }, () => createId('sess'));
  assert.equal(new Set(ids).size, 1000);
  ids.forEach((id) => assert.match(id, /^[\w:-]{1,160}$/));
  assert.throws(() => createId('unsafe prefix'), TypeError);
});

test('workout streaks advance by local calendar day across DST and count repeat workouts once per day', () => {
  const source = `import { recordWorkoutCompletion } from './js/analytics.js';
    import { saveJSON } from './js/storage.js';
    saveJSON('streaks', {current:3,longest:3,lastWorkoutDate:'2026-03-08',history:{'2026-03-08':1},calendarPolicy:'local-v1'});
    const now = new Date('2026-03-09T07:30:00Z');
    const first = recordWorkoutCompletion(now);
    const second = recordWorkoutCompletion(now);
    console.log(JSON.stringify([first,second]));`;
  const [first, second] = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: new URL('..', import.meta.url), env: { ...process.env, TZ: 'America/Los_Angeles' }, encoding: 'utf8'
  }));
  assert.equal(first.streaks.current, 4);
  assert.equal(first.streaks.lastWorkoutDate, '2026-03-09');
  assert.equal(first.isNewDay, true);
  assert.equal(second.streaks.current, 4);
  assert.equal(second.streaks.history['2026-03-09'], 2);
  assert.equal(second.isNewDay, false);
});

test('inference and all remote transport flags are immutable and disabled', () => {
  assert.equal(FEATURE_CONFIG_VERSION, 1);
  assert.equal(Object.isFrozen(FEATURES), true);
  assert.equal(Object.values(FEATURES).every((enabled) => enabled === false), true);
  assert.throws(() => { FEATURES.browserInference = true; }, TypeError);
});

test('legacy UTC streaks retain their day policy instead of resetting at a local boundary', () => {
  const source = `import { recordWorkoutCompletion, getStreaks, getWorkoutDay } from './js/analytics.js';
    import { saveJSON } from './js/storage.js';
    saveJSON('streaks', {current:7,longest:7,lastWorkoutDate:'2026-10-20',history:{'2026-10-20':1}});
    const now = new Date('2026-10-20T02:00:00Z');
    console.log(JSON.stringify([getWorkoutDay(getStreaks(),now),recordWorkoutCompletion(now)]));`;
  const [day, result] = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: new URL('..', import.meta.url), env: { ...process.env, TZ: 'America/Los_Angeles' }, encoding: 'utf8'
  }));
  assert.equal(day, '2026-10-20');
  assert.equal(result.streaks.current, 7);
  assert.equal(result.streaks.calendarPolicy, 'utc-legacy');
  assert.equal(result.isNewDay, false);
});
