const CACHE_NAME = 'geopolem-command-v1.27.0';
const CONFLICTS_DIR = './conflictos-activos/';
const CONFLICTS_SHELL = CONFLICTS_DIR + 'index.html';
const WATCHLIST_DIR = './conflict-watchlist-2026/';
const WATCHLIST_SHELL = WATCHLIST_DIR + 'index.html';
// Hand-authored static page: filenames are stable, so unlike the hashed dashboard
// bundle they can be listed here. Leaflet is vendored rather than loaded from a CDN
// precisely so it can live in this list — an offline shell without it renders a dead
// board, which is worse than not serving the shell at all.
const WATCHLIST_ASSETS = [
  WATCHLIST_SHELL,
  WATCHLIST_DIR + 'styles.css',
  WATCHLIST_DIR + 'app.js',
  WATCHLIST_DIR + 'data.js',
  WATCHLIST_DIR + 'favicon.svg',
  WATCHLIST_DIR + 'vendor/leaflet-1.9.4/leaflet.css',
  WATCHLIST_DIR + 'vendor/leaflet-1.9.4/leaflet.js'
];
const APP_SHELL = [
  './',
  './index.html',
  './app.js',
  './api-adapter.js',
  './data.js',
  './videos.js',
  './worldmap.js',
  './manifest.webmanifest',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './icons/icon-maskable.svg'
];

// The dashboard bundle carries a content hash that changes on every rebuild, so its
// filenames are read out of the shell at install time rather than hardcoded here —
// hardcoded hashes would silently go stale and leave the shell cached without its
// bundle, which renders a blank page offline.
async function conflictsAssets() {
  const response = await fetch(CONFLICTS_SHELL, { cache: 'reload' });
  if (!response.ok) throw new Error(`shell ${response.status}`);
  const html = await response.text();
  const assets = [...html.matchAll(/(?:src|href)="\.\/(assets\/[^"]+)"/g)].map((m) => CONFLICTS_DIR + m[1]);
  return [CONFLICTS_SHELL, ...assets];
}

async function conflictsBundleCached() {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  return keys.some((r) => new URL(r.url).pathname.includes('/conflictos-activos/assets/'));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);
      // Best effort, one try per sub-page: addAll is atomic, so keeping the optional
      // sub-pages out of APP_SHELL — and apart from each other — stops one missing
      // file from taking the whole install, and the site's offline support, down.
      try {
        await cache.addAll(await conflictsAssets());
      } catch (error) { /* dashboard stays network-only */ }
      try {
        await cache.addAll(WATCHLIST_ASSETS);
      } catch (error) { /* watchlist stays network-only */ }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => key !== CACHE_NAME ? caches.delete(key) : null)))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.includes('/api/') || url.pathname.includes('/port/')) {
    event.respondWith(fetch(request));
    return;
  }
  // Stream videos directly from the network — never put MP4s into the app-shell cache.
  if (url.pathname.endsWith('.mp4') || request.destination === 'video') {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          const isAppAsset = new URL(request.url).origin === self.location.origin;
          if (isAppAsset && response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          if (request.mode !== 'navigate') return caches.match(request);
          if (url.pathname.includes('/conflictos-activos/')) {
            if (await conflictsBundleCached()) {
              const shell = await caches.match(CONFLICTS_SHELL);
              if (shell) return shell;
            }
            // The shell is useless without its bundle, and serving the root HTML at
            // this depth would break its relative paths — so hand the user back to
            // the situation room by URL instead of rendering a blank page.
            return Response.redirect(new URL('index.html', self.registration.scope).href, 302);
          }
          if (url.pathname.includes('/conflict-watchlist-2026/')) {
            // The install precaches the shell and Leaflet together, but the runtime
            // cache can hold the shell alone if a visitor browsed here after a failed
            // install — and a shell without Leaflet renders a dead board. Only serve it
            // once its runtime dependency is there; otherwise hand the user back to the
            // situation room, since the root HTML at this depth would break its own
            // relative paths.
            const [shell, leaflet] = await Promise.all([
              caches.match(WATCHLIST_SHELL),
              caches.match(WATCHLIST_DIR + 'vendor/leaflet-1.9.4/leaflet.js')
            ]);
            if (shell && leaflet) return shell;
            return Response.redirect(new URL('index.html', self.registration.scope).href, 302);
          }
          return caches.match('./index.html');
        });
    })
  );
});
