// GEOPÓLEM API v1 (Sprint 3) — router puro (sin node:http) para testeo directo.
// ---------------------------------------------------------------------------
// Resuelve (method, path, searchParams) → { status, body }. Se usa tanto desde
// el servidor HTTP (server.mjs) como desde los tests de contrato, sin sockets.
// ---------------------------------------------------------------------------

import {
  handleHealth,
  handleMetrics,
  handleConflicts,
  handleActiveMap,
  handleConflictDetail,
  handleFilters,
} from './handlers.mjs';
import { apiError } from './response.mjs';
import { authorize } from './auth.mjs';
import { CONFIG } from './config.mjs';
import { RateLimitStore } from './rate-limit.mjs';

const BASE = '/api/v1';

// Rutas siempre exentas de rate limiting (observabilidad/arranque).
const RATE_LIMIT_EXEMPT = new Set([`${BASE}/health`, `${BASE}/metrics`]);

// Store de rate limiting reconstruido si cambia la configuración (tests).
let rlStore = null;
function rateLimitStore() {
  if (!rlStore || rlStore.max !== CONFIG.rateLimitMax || rlStore.windowMs !== CONFIG.rateLimitWindowMs) {
    rlStore = new RateLimitStore({ max: CONFIG.rateLimitMax, windowMs: CONFIG.rateLimitWindowMs });
  }
  return rlStore;
}

// `context` transporta metadatos de la petición (p. ej. la cabecera
// Authorization) desde server.mjs. Es opcional para que los tests puedan
// invocar el router sin sockets ni cabeceras.
export async function route(method, pathname, searchParams = new URLSearchParams(), context = {}) {
  if (method !== 'GET' && method !== 'HEAD') {
    const e = apiError('bad_request', 'Sólo se admite GET en la API pública de lectura.');
    return { status: 405, body: e.body };
  }

  // Normaliza barra final.
  const path = pathname.replace(/\/+$/, '') || '/';

  // Política de auth JWT (no-op en modo public; /health siempre público).
  const denied = authorize(path, context);
  if (denied) return denied;

  // Rate limiting (no-op si max<=0; /health y /metrics siempre exentos).
  const store = rateLimitStore();
  if (store.enabled && !RATE_LIMIT_EXEMPT.has(path)) {
    const sub = context.claims?.sub ? String(context.claims.sub) : '-';
    const key = `${context.clientId || 'anon'}|${sub}`;
    const rl = store.hit(key);
    if (!rl.allowed) {
      const e = apiError('rate_limited', 'Demasiadas peticiones. Inténtalo más tarde.');
      return { status: e.status, body: e.body, headers: { 'Retry-After': String(rl.retryAfterSec) } };
    }
  }

  if (path === `${BASE}/health`) return handleHealth();
  if (path === `${BASE}/metrics`) return handleMetrics();
  if (path === `${BASE}/filters`) return handleFilters();
  if (path === `${BASE}/conflicts`) return handleConflicts(searchParams);
  if (path === `${BASE}/conflicts/active/map`) return handleActiveMap(searchParams);

  // /conflicts/:id  (evita chocar con /conflicts/active/map)
  const m = path.match(new RegExp(`^${BASE}/conflicts/([^/]+)$`));
  if (m) return handleConflictDetail(decodeURIComponent(m[1]));

  const e = apiError('not_found', `Ruta no encontrada: ${pathname}`);
  return { status: e.status, body: e.body };
}
