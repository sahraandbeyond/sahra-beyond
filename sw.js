/* Sahra & Beyond service worker — offline app shell + content caching */
const CACHE = 'sahra-v2';
const SHELL = [
  '/', '/?platform=android', '/index.html', '/manifest.json',
  '/icon.svg', '/icon-maskable.svg',
  '/icon-192.png', '/icon-512.png', '/icon-maskable-192.png', '/icon-maskable-512.png',
  '/content/settings.json',
  '/content/locations/big-red.json', '/content/locations/wadi-shab.json',
  '/content/locations/jebel-hafeet.json', '/content/locations/liwa.json',
  '/content/locations/hatta.json', '/content/locations/dibba.json',
  '/content/blog/2024-03-sunrise-at-big-red.json',
  '/content/blog/2023-10-wadi-shab-cave.json',
  '/content/blog/2024-01-liwa-milky-way.json'
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

  // Content JSON: network-first so edits show, fall back to cache offline.
  if (url.pathname.startsWith('/content/')) {
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return r;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // App shell: cache-first, then network, with index fallback for navigations.
  e.respondWith(
    caches.match(req).then(c => c || fetch(req).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(ca => ca.put(req, copy));
      return r;
    }).catch(() => req.mode === 'navigate' ? caches.match('/index.html') : undefined))
  );
});
