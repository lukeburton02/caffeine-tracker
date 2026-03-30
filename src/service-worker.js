// Caffeine Tracker - Service Worker
// No caching — always load fresh files from network
// Keeps PWA installability without stale cache issues

const CACHE_NAME = 'caffeine-tracker-v5';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
    // Delete all old caches
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// No fetch handler — all requests go straight to network
