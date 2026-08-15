// Service worker — app-shell caching (stale-while-revalidate).
// __SW_CACHE_VERSION__ is replaced at build time (from the repo's VERSION file)
// by the "Prepare web assets (www/)" step in build.yml — every version bump
// automatically invalidates the old cache, so this file never needs manual edits.
const CACHE_NAME = 'dreamlife-shell-__SW_CACHE_VERSION__';

// Only the app shell — static, same-origin files needed to boot the UI offline.
// Deliberately NOT included: Supabase requests, CDN fonts/scripts (cross-origin,
// must stay live), and any user data — none of that belongs in this cache.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((err) => console.warn('SW precache failed', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only ever intercept same-origin GETs. Everything else (Supabase API calls,
  // jsdelivr/Google Fonts, POST/PUT, etc.) goes straight to the network untouched.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  // Stale-while-revalidate: serve the cached shell instantly (fast + works
  // offline), and in the background fetch a fresh copy for next time.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached); // offline and not cached: nothing we can do

      return cached || network;
    })
  );
});
