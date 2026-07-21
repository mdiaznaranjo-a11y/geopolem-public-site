const CACHE_NAME = 'geopolem-command-v1.20.0';
const APP_SHELL = [
  './',
  './index.html',
  './app.js',
  './api-adapter.js',
  './public-enriched.mjs',
  './deeplinks.mjs',
  './analytics.mjs',
  './data.js',
  './videos.js',
  './worldmap.js',
  './manifest.webmanifest',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './icons/icon-maskable.svg'
];

// Puente estático (Sprint 2 → Sprint 11): archivos JSON servidos junto al sitio
// bajo /api/v1/*.json (lista, mapa, mapa enriquecido y detalle por conflicto).
// Estos SÍ deben cachearse para navegación offline; la API dinámica (resto de
// /api/) sigue siendo sólo-red. Reconocidos por pathname .json bajo /api/v1/.
function isStaticBridgeJson(url) {
  return /\/api\/v1\/.+\.json$/.test(url.pathname);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
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

  // Puente estático JSON: network-first con respaldo a caché (offline-friendly).
  // Se guarda una copia fresca cuando la red responde 200; si no hay red, se
  // sirve la última versión cacheada. Degrada limpio si nunca se cacheó.
  if (isStaticBridgeJson(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && url.origin === self.location.origin) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Resto de la API (dinámica) y puertos de desarrollo: sólo-red, sin caché.
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
        .catch(() => {
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return caches.match(request);
        });
    })
  );
});
