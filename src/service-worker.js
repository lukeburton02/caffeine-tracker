// Caffeine Tracker - Service Worker
// Cache-first strategy for offline support

const CACHE_NAME = 'caffeine-tracker-v3';
const ASSETS = [
    '/',
    '/index.html',
    '/app.js',
    '/styles.css',
    '/manifest.json',
    '/icon.svg'
];

// Install: cache all app shell assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: serve from cache, fall back to network
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cached => cached || fetch(event.request))
    );
});
