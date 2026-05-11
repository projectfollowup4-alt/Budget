const CACHE_NAME = 'budget-app-v4';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './icon.png',
  './logo.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force update immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
