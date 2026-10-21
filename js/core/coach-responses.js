import { COACH_RESPONSES } from '../../data/coach-responses.js';
import { validCoachInput } from '../intelligence/coach-contract.js';
export function contextualResponses(context) {
  if (!validCoachInput(context)) return COACH_RESPONSES.general;
  if (['settings', 'model', 'diagnostics'].includes(context.screen)) return COACH_RESPONSES.settings;
  if (context.screen === 'backup') return COACH_RESPONSES.backup;
  if (context.screen === 'memory') return COACH_RESPONSES.memory;
  if (context.recentResult === 'challenging') return COACH_RESPONSES.challenging;
  if (context.screen === 'progress') return context.weeklyVisits >= 3 ? COACH_RESPONSES.weekly : COACH_RESPONSES.progress;
  if (context.screen === 'session') return COACH_RESPONSES[context.recentDomain] || COACH_RESPONSES.general;
  return COACH_RESPONSES.general;
}
export function createCoachPacer({ now = Date.now, intervalMs = 90000, historySize = 8 } = {}) {
  let lastShown = -Infinity; const recent = [];
  return {
    next(context, { force = false } = {}) {
      if (!force && now() - lastShown < intervalMs) return null;
      const choices = contextualResponses(context);
      const quote = choices.find(line => !recent.includes(line)) || [...choices].sort((a,b) => recent.indexOf(a) - recent.indexOf(b))[0];
      if (quote === recent.at(-1)) return null;
      const prior = recent.indexOf(quote); if (prior >= 0) recent.splice(prior, 1);
      recent.push(quote); if (recent.length > historySize) recent.shift(); lastShown = now();
      return quote;
    }
  };
}
