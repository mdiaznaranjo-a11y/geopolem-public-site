const CACHE_NAME = 'geopolem-command-v1.30.0';
const CONFLICTS_DIR = './conflictos-activos/';
const CONFLICTS_SHELL = CONFLICTS_DIR + 'index.html';
const WATCHLIST_DIR = './conflict-watchlist-2026/';
const WATCHLIST_SHELL = WATCHLIST_DIR + 'index.html';
const WATCHLIST_VENDOR = WATCHLIST_DIR + 'vendor/leaflet-1.9.4/';
// The runtime dependency the shell is useless without, named once so the precache
// list and the navigation gate below can never drift apart.
const WATCHLIST_LEAFLET = WATCHLIST_VENDOR + 'leaflet.js';
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
  WATCHLIST_VENDOR + 'leaflet.css',
  WATCHLIST_LEAFLET
];
const APP_SHELL = [
  './',
  './index.html',
  './talasocracia/index.html',
  './app.html',
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

function situationRoom() {
  // Serving the root HTML at the watchlist's depth would break its relative paths,
  // so hand the user back to the situation room by URL instead.
  return Response.redirect(new URL('app.html', self.registration.scope).href, 302);
}

// Every watchlist navigation is answered here, ahead of the generic branch. The
// network is tried first so a fresh shell is never withheld, and the cached shell
// is only served offline. The directory URL and the shell URL are separate cache
// keys, so a visitor who browsed here online leaves a runtime-cached entry for
// whichever one they used; Leaflet is checked before any cached HTML is returned,
// because a shell without it renders a dead board.
async function watchlistNavigation(request) {
  try {
    return await cacheThrough(request);
  } catch (error) {
    if (await caches.match(WATCHLIST_LEAFLET)) {
      const cached = (await caches.match(request)) || (await caches.match(WATCHLIST_SHELL));
      if (cached) return cached;
    }
    return situationRoom();
  }
}

// Fetch from the network and refresh the cache entry on the way past. Rejects when
// offline so callers can pick their own fallback.
async function cacheThrough(request) {
  const response = await fetch(request);
  if (response && response.status === 200 && new URL(request.url).origin === self.location.origin) {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
  }
  return response;
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

  if (request.mode === 'navigate' && url.pathname.includes('/conflict-watchlist-2026/')) {
    event.respondWith(watchlistNavigation(request));
    return;
  }

  // Network-first, cache as the offline fallback. Cache-first was pinning the
  // editorial data indefinitely: the cache name was the only thing that invalidated
  // it, so any deploy that did not bump it left visitors on a stale data.js while the
  // HTML around it moved on — which is what left the KPI cards on their placeholders.
  event.respondWith(
    cacheThrough(request).catch(async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode !== 'navigate') return Response.error();
      if (url.pathname.includes('/conflictos-activos/')) {
        if (await conflictsBundleCached()) {
          const shell = await caches.match(CONFLICTS_SHELL);
          if (shell) return shell;
        }
        // The shell is useless without its bundle, so hand the user back to the
        // situation room instead of rendering a blank page.
        return situationRoom();
      }
      return (await caches.match('./index.html')) || Response.error();
    })
  );
});
