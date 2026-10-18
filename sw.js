// Sharp PWA Service Worker — Offline-First Architecture
const STATIC_CACHE = 'sharp:static:v1';
const RUNTIME_CACHE = 'sharp:runtime:v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/favicon.svg',
  './assets/logo.svg',
  './assets/wordmark.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-192-maskable.png',
  './assets/icons/icon-512-maskable.png',
  './css/styles.css',
  './css/components.css',
  './css/games.css',
  './js/app.js',
  './js/router.js',
  './js/storage.js',
  './js/theme.js',
  './js/audio.js',
  './js/haptics.js',
  './js/notifications.js',
  './js/adaptive-engine.js',
  './js/analytics.js',
  './js/backup.js',
  './js/celebration.js',
  './js/modal.js',
  './js/games/catalog.js',
  './js/games/delayed-memory.js',
  './js/games/pattern-flash.js',
  './js/games/math-challenge.js',
  './js/games/logic-deduction.js',
  './js/games/comprehension-inference.js',
  './js/games/corsi-span.js',
  './js/views/workout-view.js',
  './js/views/catalog-view.js',
  './js/views/analytics-view.js',
  './js/views/backup-view.js',
  './js/views/settings-view.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== RUNTIME_CACHE) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // For same-origin requests, prioritize cache, fallback to network
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Revalidate in background for HTML/JS
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, networkResponse));
            }
          }).catch(() => { /* Offline; ignore */ });
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        }).catch(() => {
          // If HTML navigation fails, return cached index.html
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
    );
  } else {
    // Cross-origin (e.g. Google Fonts)
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          if (response && response.status === 200) {
            const respClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, respClone));
          }
          return response;
        }).catch(() => caches.match(request));
      })
    );
  }
});

// Notifications click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || './index.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('sharp') && 'focus' in client) {
          if ('navigate' in client) client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
