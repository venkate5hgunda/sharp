import { localDayKey, shiftLocalDay } from '../core/calendar.js';
import { DEFAULT_RATINGS, calculateRatingDelta } from '../adaptive-engine.js';

export const METRIC_VERSION = 'progress-v2';
export const RATING_VERSION = 'elo-heuristic-v1';
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
  const days = new Set(Object.values(state.workouts).filter((w) => w.completedAt && !w.practice).map((w) => w.date));
  // Keep UTC legacy evidence labelled and separate; never rewrite its date labels as local dates.
  const sorted = [...days].sort(); let longest = 0, run = 0, previous;
  for (const day of sorted) { const before = localDayKey(shiftLocalDay(new Date(`${day}T12:00:00`), -1)); run = previous === before ? run + 1 : 1; longest = Math.max(longest, run); previous = day; }
  const today = localDayKey(now), yesterday = localDayKey(shiftLocalDay(now, -1));
  let current = 0, cursor = days.has(today) ? today : yesterday;
  while (days.has(cursor)) { current++; cursor = localDayKey(shiftLocalDay(new Date(`${cursor}T12:00:00`), -1)); }
  const { ratings, transitions } = projectRatings(state);
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
    startedCount: Object.keys(state.workouts).length,
    legacyRoundCount: state.legacy.session_history?.length || 0,
    legacyStreak: state.legacy.streaks || null,
    trend: binary.length < 20 ? 'Insufficient data: complete 20 comparable attempts in a skill before comparing trends.' : 'Choose a skill and tier to compare response times fairly.' };
}
