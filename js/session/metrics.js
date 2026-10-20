import { localDayKey, shiftLocalDay } from '../core/calendar.js';
import { DEFAULT_RATINGS, calculateRatingDelta } from '../adaptive-engine.js';

export const METRIC_VERSION = 'progress-v2';
export const RATING_VERSION = 'elo-heuristic-v1';
const median = (values) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[Math.ceil(sorted.length / 2) - 1] : null; };
export function comparableSlices(attempts) {
  const groups = new Map();
  attempts.filter((a) => a.scoring === 'binary-v1' && a.skill && !a.practice && !a.interrupted).forEach((a) => {
    const key = [a.game, a.skill, a.tier, a.contentVersion, a.inputMode || 'unknown', a.timingPolicy || 'active-v1'].join(':');
    if (!groups.has(key)) groups.set(key, []); groups.get(key).push(a);
  });
  return [...groups.values()].map((items) => {
    items.sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
    const windows = [items.slice(-20, -10), items.slice(-10)];
    const enough = items.length >= 20;
    const scores = windows.map((w) => w.length ? w.reduce((n, a) => n + a.score, 0) / w.length : null);
    const correctTimes = windows.map((w) => w.filter((a) => a.score === 1).map((a) => a.activeMs));
    return { game: items[0].game, skill: items[0].skill, tier: items[0].tier, inputMode: items[0].inputMode || 'unknown',
      count: items.length, enough, previousAccuracy: enough ? scores[0] : null, recentAccuracy: enough ? scores[1] : null,
      previousMs: enough && correctTimes.every((t) => t.length >= 5) ? median(correctTimes[0]) : null,
      recentMs: enough && correctTimes.every((t) => t.length >= 5) ? median(correctTimes[1]) : null,
      correctCounts: correctTimes.map((t) => t.length), distinctItems: new Set(items.map((a) => a.itemId)).size };
  }).sort((a, b) => b.count - a.count);
}
export function projectRatings(state) {
  const ratings = { ...DEFAULT_RATINGS, ...state.ratingsBaseline };
  const transitions = {};
  Object.values(state.rounds).sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id)).forEach((round) => {
    if (round.practice || !round.count) return;
    const before = ratings[round.domain];
    const result = calculateRatingDelta(before, round.tier, round.score / round.count, round.latencyMs, round.expectedMs);
    ratings[round.domain] = result.newRating;
    transitions[round.id] = { before, after: result.newRating, delta: result.delta };
  });
  return { ratings, transitions };
}
export function progressMetrics(state, now = new Date()) {
  const attempts = Object.values(state.attempts).filter((a) => !a.practice && !a.interrupted);
  const binary = attempts.filter((a) => a.scoring === 'binary-v1');
  const correct = binary.filter((a) => a.score === 1);
  const partial = attempts.filter((a) => a.scoring !== 'binary-v1');
  const times = correct.map((a) => a.activeMs).sort((a, b) => a - b);
  const percentile = (p) => times.length ? times[Math.min(times.length - 1, Math.ceil(times.length * p) - 1)] : null;
  const days = new Set(Object.values(state.workouts).filter((w) => w.completedAt && !w.practice).map((w) => w.completedDate || w.date));
  // Keep UTC legacy evidence labelled and separate; never rewrite its date labels as local dates.
  const sorted = [...days].sort(); let longest = 0, run = 0, previous;
  for (const day of sorted) { const before = localDayKey(shiftLocalDay(new Date(`${day}T12:00:00`), -1)); run = previous === before ? run + 1 : 1; longest = Math.max(longest, run); previous = day; }
  const today = localDayKey(now), yesterday = localDayKey(shiftLocalDay(now, -1));
  let current = 0, cursor = days.has(today) ? today : yesterday;
  while (days.has(cursor)) { current++; cursor = localDayKey(shiftLocalDay(new Date(`${cursor}T12:00:00`), -1)); }
  const { ratings, transitions } = projectRatings(state);
  const slices = comparableSlices(attempts);
  const snapshots = new Map(), running = { ...DEFAULT_RATINGS, ...state.ratingsBaseline };
  Object.values(state.rounds).filter((r) => !r.practice).sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id)).forEach((r) => {
    running[r.domain] = transitions[r.id]?.after || running[r.domain];
    snapshots.set(r.date, Math.round(Object.values(running).reduce((a, b) => a + b, 0) / 5));
  });
  return { version: METRIC_VERSION, ratings, transitions, correct: correct.length, eligible: binary.length,
    accuracy: binary.length ? correct.length / binary.length : null,
    partialScore: partial.length ? partial.reduce((sum, a) => sum + a.score, 0) / partial.length : null,
    medianMs: percentile(.5), p90Ms: percentile(.9), speedCount: times.length, currentStreak: current, longestStreak: longest,
    dailyScores: [...snapshots].map(([date, score]) => ({ date, score })),
    workoutCount: Object.values(state.workouts).filter((w) => w.completedAt && !w.practice).length,
    startedCount: Object.values(state.workouts).filter((w) => !w.practice).length,
    legacyRoundCount: state.legacy.session_history?.length || 0,
    legacyStreak: state.legacy.streaks || null, slices,
    trend: slices.some((s) => s.enough) ? 'Comparable practice windows are shown below with their sample sizes.' : 'Insufficient data: complete 20 comparable attempts in a skill before comparing trends.' };
}
