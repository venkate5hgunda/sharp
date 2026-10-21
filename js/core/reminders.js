import { localDayKey, shiftLocalDay } from './calendar.js';
export function reminderCalendar({ morningTime = '08:30', eveningTime = '19:30' }, now = new Date()) {
  const date = localDayKey(now).replaceAll('-', '');
  const stamp = new Date(now).toISOString().replace(/[-:]|\.\d{3}/g, '');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sharp//Local practice//EN',
    ...[['study', 'Sharp memory study', morningTime], ['recall', 'Sharp memory recall', eveningTime]].flatMap(([id, title, time]) => {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Invalid reminder time.');
      return ['BEGIN:VEVENT', `UID:sharp-${id}-${date}@local`, `DTSTAMP:${stamp}`, `DTSTART:${date}T${time.replace(':', '')}00`, 'DURATION:PT10M', 'RRULE:FREQ=DAILY', `SUMMARY:${title}`, 'DESCRIPTION:Open Sharp to practise. Recall availability depends on the actual study time.', 'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'END:VALARM', 'END:VEVENT'];
    }), 'END:VCALENDAR', ''].join('\r\n');
}
export function dueReminder(state, now = new Date()) {
  const p = state.preferences; if (!p.foregroundReminders || !p.onboarded) return null;
  const minute = now.getHours() * 60 + now.getMinutes(), date = localDayKey(now);
  for (const [kind, time] of [['recall', p.eveningTime || '19:30'], ['study', p.morningTime || '08:30']]) {
    const [hour, min] = time.split(':').map(Number), id = `${date}:${kind}`;
    if (minute < hour * 60 + min || p.lastReminder === id) continue;
    if (kind === 'recall' && state.memory?.status === 'committed' && state.memory.readyAt <= now.getTime()) return { id, text: 'Your time capsule is ready to open ✦ See which memories made the journey.', route: 'games/delayed-memory' };
    if (kind === 'study' && state.memory?.status !== 'committed') return { id, text: 'Pip packed a tiny memory adventure. Plant a few words now; rediscover them later.', route: 'games/delayed-memory' };
  }
  return null;
}
