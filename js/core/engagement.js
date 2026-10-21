import { validCoachInput } from '../intelligence/coach-contract.js';
import { localDayKey, shiftLocalDay } from './calendar.js';
export const EXPEDITIONS = ['Pattern planet', 'Number nebula', 'Logic lagoon', 'Story summit', 'Memory meadow', 'Focus forest', 'Discovery day'];
export function weeklyJourney(state, now = new Date()) {
  const monday = shiftLocalDay(now, -((now.getDay() + 6) % 7));
  const completed = new Set(Object.values(state.workouts).filter(w => w.completedAt && !w.practice).map(w => w.completedDate || w.date));
  const days = Array.from({ length: 7 }, (_, i) => { const date = shiftLocalDay(monday, i); const key = localDayKey(date); return { key, label: date.toLocaleDateString('en', { weekday: 'short' }), done: completed.has(key), today: key === localDayKey(now) }; });
  return { days, count: days.filter(d => d.done).length, theme: EXPEDITIONS[(now.getDay() + 6) % 7] };
}
export function coachContext(state, route = 'today') {
  const rounds = Object.values(state.rounds).sort((a,b) => b.timestamp - a.timestamp);
  const latest = Object.values(state.attempts || {}).sort((a,b) => b.timestamp - a.timestamp)[0];
  const rawScreen = route.split('/')[0];
  const screen = rawScreen === 'games' ? 'memory' : ['today', 'session', 'exercises', 'progress', 'settings', 'backup', 'model', 'diagnostics'].includes(rawScreen) ? rawScreen : 'today';
  const context = { screen, recentDomain: rounds[0]?.domain || 'mixed', recentResult: latest ? latest.score >= .7 ? 'steady' : 'challenging' : rounds[0]?.count ? rounds[0].score / rounds[0].count >= .7 ? 'steady' : 'challenging' : 'new', weeklyVisits: weeklyJourney(state).count };
  if (!validCoachInput(context)) return { screen, recentDomain: 'mixed', recentResult: 'new', weeklyVisits: context.weeklyVisits };
  return context;
}
export function curatedQuote(context, variation = 0) {
  const lines = context.screen === 'session' && context.recentResult === 'challenging' ? ['That one was tricky. Check the explanation and try a different strategy.', 'Pause for a breath. The next clue is a fresh start.'] : context.screen === 'session' ? ['One puzzle at a time. Look for the small clue.', 'Take a breath. A thoughtful answer beats a rushed guess.', 'Try a new strategy; mistakes are useful feedback.'] : context.recentResult === 'challenging' ? ['That was a stretch. Try an untimed round and explore a different strategy.', 'A tricky round is a good moment to pause, then try again.'] : ['Your next small discovery is one puzzle away.', 'Show up curious. Leave with a little more practice.', 'Plant a memory now. See what grows when you recall it later.'];
  return lines[variation % lines.length];
}
