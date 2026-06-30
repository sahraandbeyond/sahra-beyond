/* Sahra & Beyond service worker — offline app shell + content caching */
const CACHE = 'sahra-v6';
const SHELL = [
  '/', '/?platform=android', '/index.html', '/manifest.json',
  '/icon.svg', '/icon-maskable.svg',
  '/icon-192.png', '/icon-512.png', '/icon-maskable-192.png', '/icon-maskable-512.png',
  '/feed.json',
  '/content/settings.json',
  '/content/locations/snoopy-island.json', '/content/locations/al-quaa-desert.json',
  '/content/locations/half-desert.json', '/content/locations/mleiha-desert.json',
  '/content/locations/wadi-showka.json', '/content/locations/jabal-yanas.json',
  '/content/locations/crescent-moon-lake.json', '/content/locations/desert-camping-lake-view.json',
  '/content/locations/love-lake.json', '/content/locations/shuweihat-island.json',
  '/content/locations/sir-bani-yas-island.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Only handle same-origin requests; let weather/maps/ads APIs go to network.
  if (url.origin !== self.location.origin) return;

  // Never cache the admin CMS or API routes (avoids stale config / OAuth issues).
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api')) return;

  // Content JSON & the location feed: network-first so edits show, fall back to cache offline.
  if (url.pathname.startsWith('/content/') || url.pathname === '/feed.json') {
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return r;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // HTML pages & navigations: network-first so the latest version always loads when online;
  // fall back to cache (then the app shell) only when offline. This stops the "old version on first open" issue.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return r;
      }).catch(() => caches.match(req).then(c => c || caches.match('/index.html')))
    );
    return;
  }

  // Other static assets (icons, fonts, manifest): cache-first for speed, then network.
  e.respondWith(
    caches.match(req).then(c => c || fetch(req).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(ca => ca.put(req, copy));
      return r;
    }))
  );
});
