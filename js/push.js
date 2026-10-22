import { localDayKey } from './core/calendar.js';
// Subscription API stores only explicitly consented scheduling metadata; private VAPID keys stay server-side.
export const PUSH_CONFIG = Object.freeze({
  subscriptionEndpoint: 'https://sharp-push.cheeryowl513.chatgpt.site/v1/subscriptions',
  applicationServerKey:
    'BPkehe0TAhCWYcuhlTQ7gnDQyAZMR0-vK8RAFzpguo62UiH7qZUac50-zPnC81TRNiKM9fCA5Gw50aITknNLySs',
});
let lastSynced = '';
const b64 = (data) =>
  btoa(String.fromCharCode(...data))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
function pushBody(repo, subscription) {
  const state = repo.snapshot(),
    today = localDayKey();
  return {
    subscription: subscription.toJSON(),
    reminderTime: state.preferences.pushTime || '08:30',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    completedDate: Object.values(state.workouts).some(
      (w) => w.completedAt && !w.practice && (w.completedDate || w.date) === today
    )
      ? today
      : null,
    memoryReadyAt: state.memory?.status === 'committed' ? state.memory.readyAt : null,
  };
}
async function serviceRequest(config, token, body, method = 'POST') {
  const endpoint = new URL(config.subscriptionEndpoint, location.href);
  if (
    endpoint.protocol !== 'https:' ||
    !['https://sharp-push.cheeryowl513.chatgpt.site', location.origin].includes(endpoint.origin)
  )
    throw new Error('Untrusted push service');
  const response = await fetch(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    let details;
    try {
      details = await response.json();
    } catch {}
    throw new Error(details?.error || 'Push service could not save your settings.');
  }
  return response.json();
}
export function pushAvailable(config = PUSH_CONFIG) {
  return Boolean(
    config.subscriptionEndpoint &&
      config.applicationServerKey &&
      globalThis.isSecureContext &&
      'serviceWorker' in navigator &&
      'PushManager' in window
  );
}
export async function enableBrowserAlerts(repo) {
  if (!('Notification' in window) || !('serviceWorker' in navigator))
    throw new Error('Browser alerts are unavailable. Try calendar reminders.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted')
    throw new Error('Alerts are not enabled. You can change this in browser settings.');
  await repo.setPreferences({ browserAlerts: true, foregroundReminders: true });
}
export async function showBrowserReminder(preferences, due, { preview = false } = {}) {
  if (
    (preferences.pushSubscribed && !preview) ||
    (!preferences.browserAlerts && !preview) ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  )
    return false;
  const registration = await navigator.serviceWorker?.getRegistration?.();
  if (!registration?.active) return false;
  await registration.showNotification(due.title || 'Pip has a tiny quest for you ✦', {
    body: due.text,
    icon: 'assets/icons/icon-192.png',
    tag: preview ? 'sharp-preview' : 'sharp-daily',
    data: { url: `index.html#/${due.route || 'today'}` },
  });
  return true;
}
export async function subscribePush(repo, config = PUSH_CONFIG) {
  if (!pushAvailable(config))
    throw new Error(
      'Background push needs a configured push service. Calendar alerts work when Sharp is closed.'
    );
  await enableBrowserAlerts(repo);
  const registration = await navigator.serviceWorker.ready;
  const padded = config.applicationServerKey.replace(/-/g, '+').replace(/_/g, '/');
  const applicationServerKey = Uint8Array.from(
    atob(padded + '='.repeat((4 - (padded.length % 4)) % 4)),
    (ch) => ch.charCodeAt(0)
  );
  let token = repo.snapshot().preferences.pushManagementToken;
  if (!token) {
    token = b64(crypto.getRandomValues(new Uint8Array(32)));
    await repo.setPreferences({ pushManagementToken: token });
  }
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }));
  try {
    const body = pushBody(repo, subscription);
    await serviceRequest(config, token, body);
    lastSynced = JSON.stringify(body);
  } catch (error) {
    if (!existing) await subscription.unsubscribe();
    throw error;
  }
  await repo.setPreferences({ pushSubscribed: true });
}
export async function syncPushState(repo, config = PUSH_CONFIG) {
  const p = repo.snapshot().preferences;
  if (!config.subscriptionEndpoint || !p.pushManagementToken) return false;
  if (p.pushDeletionPending) {
    await serviceRequest(
      config,
      p.pushManagementToken,
      { endpoint: p.pushDeletionPending },
      'DELETE'
    );
    await repo.setPreferences({ pushDeletionPending: null, pushManagementToken: null });
    return true;
  }
  if (!p.pushSubscribed) return false;
  const registration = await navigator.serviceWorker?.getRegistration?.(),
    subscription = await registration?.pushManager?.getSubscription();
  if (!subscription) {
    await repo.setPreferences({ pushSubscribed: false });
    return false;
  }
  const body = pushBody(repo, subscription),
    encoded = JSON.stringify(body);
  if (encoded === lastSynced) return false;
  await serviceRequest(config, p.pushManagementToken, body);
  lastSynced = encoded;
  return true;
}
export async function disableAlerts(repo, config = PUSH_CONFIG) {
  const registration = await navigator.serviceWorker?.getRegistration?.(),
    subscription = await registration?.pushManager?.getSubscription();
  const p = repo.snapshot().preferences;
  if (subscription && !(await subscription.unsubscribe()))
    throw new Error('Could not unsubscribe. Please retry.');
  await repo.setPreferences({
    browserAlerts: false,
    pushSubscribed: false,
    pushDeletionPending:
      subscription && p.pushManagementToken ? subscription.endpoint : p.pushDeletionPending || null,
  });
  lastSynced = '';
  try {
    await syncPushState(repo, config);
  } catch {
    throw new Error('Browser alerts are off. Server deletion will retry when you reconnect.');
  }
}
