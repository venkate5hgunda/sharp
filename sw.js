// Each worker serves one complete shell snapshot. Updates activate after old tabs close.
importScripts('./offline-manifest.js');

const scope = self.registration.scope;
const ownedPrefix = `sharp:shell:${scope}:`;
const shellCache = ownedPrefix + self.SHARP_OFFLINE.version;
const assetURLs = new Set(self.SHARP_OFFLINE.assets.map((asset) => new URL(asset, scope).href));
const indexURL = new URL('index.html', scope).href;
const optionalRuntimeURLs = new Set(['client', 'worker'].map((name) => new URL(`assets/optional-runtime/webllm-0.2.86-${name}.js`, scope).href));
const optionalRuntimeCache = `sharp:models:runtime:${scope}:0.2.86`;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(shellCache);
    await cache.addAll([...assetURLs].map((url) => new Request(url, { cache: 'reload' })));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) =>
      (key.startsWith(ownedPrefix) && key !== shellCache) ||
      key === 'sharp:static:v1' || key === 'sharp:runtime:v1'
    ).map((key) => caches.delete(key)));
    // No skipWaiting/claim: an existing page must finish on its own release.
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== new URL(scope).origin || !url.href.startsWith(scope)) return;
  url.search = '';
  url.hash = '';
  if (optionalRuntimeURLs.has(url.href)) {
    // Populated only by an explicit download choice. Shell installation never fetches it.
    event.respondWith(caches.open(optionalRuntimeCache).then(async (cache) => (await cache.match(url.href)) || fetch(request)));
    return;
  }
  if (!assetURLs.has(url.href) && request.mode !== 'navigate') return;

  event.respondWith((async () => {
    const cache = await caches.open(shellCache);
    const cached = await cache.match(request.mode === 'navigate' ? indexURL : url.href);
    if (cached) return cached;
    // Storage may have been cleared. Never use another app/release's cache.
    return fetch(request);
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || 'index.html', scope);
  if (target.origin !== new URL(scope).origin || !target.href.startsWith(scope)) return;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = clients.find((candidate) => candidate.url.startsWith(scope));
    if (client) {
      if ('navigate' in client) await client.navigate(target.href);
      return client.focus();
    }
    return self.clients.openWindow?.(target.href);
  })());
});

// Push payloads select a local destination; never open a URL supplied by a remote sender.
self.addEventListener('push', (event) => {
  let payload = {}; try { payload = event.data?.json() || {}; } catch {}
  const recall = payload.kind === 'recall';
  event.waitUntil(self.registration.showNotification('Pip has a tiny quest for you ✦', {
    body: recall ? 'Your time capsule is ready. Which memories made the journey?' : 'A little practice. A new discovery. Your daily expedition is ready.',
    icon: new URL('assets/icons/icon-192.png', scope).href,
    tag: 'sharp-daily', data: { url: recall ? 'index.html#/games/delayed-memory' : 'index.html#/today' }
  }));
});
