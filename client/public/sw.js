/* Sweety service worker: offline app shell, cached static assets, and push notifications.
 * API calls are never cached - glucose data must always come fresh from the server. */
const CACHE = 'sweety-v1';
const SHELL = ['/', '/favicon.svg', '/manifest.webmanifest', '/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Only fingerprinted build output, icons and fonts are cached (never Vite dev modules or /api).
const isStatic = (url) =>
  url.pathname.startsWith('/assets/') ||
  /\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname) ||
  url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com';

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  // Pages: network first so deploys show up immediately, cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('/', copy));
        return res;
      }).catch(() => caches.match('/').then((r) => r || Response.error())),
    );
    return;
  }

  // Static files: serve from cache instantly, refresh in the background.
  if (isStatic(url)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req).then((res) => {
          if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || network;
      }),
    );
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'Sweety', body: event.data?.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Sweety', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'sweety',
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => w.url.startsWith(self.location.origin));
      return open ? open.focus().then(() => open.navigate(target)) : self.clients.openWindow(target);
    }),
  );
});
