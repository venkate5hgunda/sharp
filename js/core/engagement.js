import { contextualResponses } from './coach-responses.js';
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
  const lines = contextualResponses(context);
  return lines[Math.abs(variation) % lines.length];
}
