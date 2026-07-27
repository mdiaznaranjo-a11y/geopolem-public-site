const CACHE_NAME = 'geopolem-command-v1.24.0';
const CONFLICTS_DIR = './conflictos-activos/';
const CONFLICTS_SHELL = CONFLICTS_DIR + 'index.html';
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
      try {
        await cache.addAll(await conflictsAssets());
      } catch (error) {
        // Best effort: addAll is atomic, so keeping the optional sub-page out of
        // APP_SHELL stops one missing dashboard file from taking the whole install
        // — and the site's offline support — down with it.
      }
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
          return caches.match('./index.html');
        });
    })
  );
});
