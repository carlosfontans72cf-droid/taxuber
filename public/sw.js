const CACHE_NAME = 'taxuber-v1';

const urlsToCache = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/auth.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.all(
        urlsToCache.map(url => {
          return fetch(url).then(response => {
            if (response.ok) return cache.put(url, response);
          }).catch(() => {});
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  if (
    url.includes('maps.googleapis.com') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com') ||
    url.includes('openstreetmap.org') ||
    url.includes('unpkg.com') ||
    url.includes('cdn.sheetjs.com') ||
    url.includes('/js/') ||
    url.includes('/api/')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
