// A static host cannot schedule Web Push. Configure a same-origin subscription API to enable it.
export const PUSH_CONFIG = Object.freeze({ subscriptionEndpoint: '', applicationServerKey: '' });
export function pushAvailable(config = PUSH_CONFIG) { return Boolean(config.subscriptionEndpoint && config.applicationServerKey && globalThis.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window); }
export async function enableBrowserAlerts(repo) {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) throw new Error('Browser alerts are unavailable. Try calendar reminders.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Alerts are not enabled. You can change this in browser settings.');
  await repo.setPreferences({ browserAlerts: true, foregroundReminders: true });
}
export async function showBrowserReminder(preferences, due, { preview = false } = {}) {
  if ((!preferences.browserAlerts && !preview) || !('Notification' in window) || Notification.permission !== 'granted') return false;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration?.active) return false;
  await registration.showNotification(due.title || 'Pip has a tiny quest for you ✦', { body: due.text, icon: 'assets/icons/icon-192.png', tag: preview ? 'sharp-preview' : 'sharp-daily', data: { url: `index.html#/${due.route || 'today'}` } });
  return true;
}
export async function subscribePush(repo, config = PUSH_CONFIG) {
  if (!pushAvailable(config)) throw new Error('Background push needs a configured push service. Calendar alerts work when Sharp is closed.');
  const endpoint = new URL(config.subscriptionEndpoint, location.href);
  if (endpoint.origin !== location.origin) throw new Error('Push registration must use a same-origin endpoint.');
  await enableBrowserAlerts(repo);
  const registration = await navigator.serviceWorker.ready;
  const padded = config.applicationServerKey.replace(/-/g, '+').replace(/_/g, '/');
  const applicationServerKey = Uint8Array.from(atob(padded + '='.repeat((4 - padded.length % 4) % 4)), ch => ch.charCodeAt(0));
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
  try { const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription, morningTime: repo.snapshot().preferences.morningTime || '08:30', eveningTime: repo.snapshot().preferences.eveningTime || '19:30', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }) }); if (!response.ok) throw new Error('Push service could not save your subscription.'); }
  catch (error) { if (!existing) await subscription.unsubscribe(); throw error; }
  await repo.setPreferences({ pushSubscribed: true });
}
export async function disableAlerts(repo) {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager?.getSubscription();
  if (subscription && !await subscription.unsubscribe()) throw new Error('Could not unsubscribe. Please retry.');
  await repo.setPreferences({ browserAlerts: false, pushSubscribed: false });
}
