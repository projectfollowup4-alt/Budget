const CACHE_NAME = 'budget-app-v5';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './icon.png',
  './logo.png'
];

// Main Logic Files that should always be fresh
const NETWORK_FIRST = [
  './app.js',
  './index.html'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
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
  const url = new URL(event.request.url);
  const isNetworkFirst = NETWORK_FIRST.some(path => url.pathname.endsWith(path.replace('./', '')));

  if (isNetworkFirst) {
    // Network First Strategy
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clonedResponse);
          });
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache First Strategy
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});
