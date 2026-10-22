// Subscription validation and local-time delivery policy.
import { bytes } from './crypto.js';

export function localClock(timezone, now = Date.now()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}
export function validateRegistration(input) {
  const sub = input?.subscription;
  if (!sub || typeof sub.endpoint !== 'string' || sub.endpoint.length > 4096)
    throw new Error('Invalid subscription');
  const url = new URL(sub.endpoint);
  const domains = [
    'fcm.googleapis.com',
    'updates.push.services.mozilla.com',
    'web.push.apple.com',
    'notify.windows.com',
  ];
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    !domains.some(
      (d) => url.hostname === d || (d === 'notify.windows.com' && url.hostname.endsWith('.' + d))
    )
  )
    throw new Error('Unsupported push provider');
  if (
    !/^[A-Za-z0-9_-]{87}=?$/.test(sub.keys?.p256dh || '') ||
    bytes(sub.keys.p256dh).length !== 65 ||
    bytes(sub.keys.p256dh)[0] !== 4 ||
    !/^[A-Za-z0-9_-]{22}={0,2}$/.test(sub.keys?.auth || '') ||
    bytes(sub.keys.auth).length !== 16
  )
    throw new Error('Invalid push keys');
  const time = input.reminderTime || '08:30';
  if (!/^(?:0[89]|1\d|20):[0-5]\d$/.test(time))
    throw new Error('Choose a reminder time between 08:00 and 20:59');
  if (typeof input.timezone !== 'string' || input.timezone.length > 80)
    throw new Error('Invalid timezone');
  localClock(input.timezone);
  const memoryReadyAt = input.memoryReadyAt == null ? null : input.memoryReadyAt;
  if (
    memoryReadyAt !== null &&
    (!Number.isSafeInteger(memoryReadyAt) ||
      memoryReadyAt < 0 ||
      memoryReadyAt > Date.now() + 7 * 86400000)
  )
    throw new Error('Invalid recall time');
  const completedDate = input.completedDate || null;
  if (completedDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(completedDate))
    throw new Error('Invalid completion date');
  return {
    subscription: { endpoint: url.href, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
    reminderTime: time,
    timezone: input.timezone,
    memoryReadyAt,
    completedDate,
  };
}
export function due(record, now = Date.now()) {
  const clock = localClock(record.timezone, now),
    [h, m] = record.reminderTime.split(':').map(Number);
  if (
    clock.minute < Math.max(480, h * 60 + m) ||
    clock.minute >= 1260 ||
    record.lastAttemptDay === clock.day
  )
    return null;
  if (record.memoryReadyAt !== null && record.memoryReadyAt > now) return null;
  if (record.memoryReadyAt !== null && record.memoryReadyAt <= now)
    return { day: clock.day, kind: 'recall' };
  return record.completedDate === clock.day ? null : { day: clock.day, kind: 'study' };
}
