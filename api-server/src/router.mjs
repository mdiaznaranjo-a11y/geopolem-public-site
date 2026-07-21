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
import {
  handleCreateConflict,
  handleUpdateConflict,
  handleSetConflictStatus,
} from './admin-handlers.mjs';
import { apiError } from './response.mjs';
import { authorize, isAdminPath } from './auth.mjs';
import { CONFIG } from './config.mjs';
import { RateLimitStore } from './rate-limit.mjs';

const BASE = '/api/v1';
const ADMIN_BASE = `${BASE}/admin`;

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
function methodNotAllowed(msg = 'Método no permitido para esta ruta.') {
  const e = apiError('bad_request', msg);
  return { status: 405, body: e.body };
}

export async function route(method, pathname, searchParams = new URLSearchParams(), context = {}) {
  // Normaliza barra final.
  const path = pathname.replace(/\/+$/, '') || '/';
  const admin = isAdminPath(path);

  // Política de auth JWT. En rutas admin SIEMPRE exige token+scope (incluso en
  // modo public); en lectura pública es no-op salvo GEOP_API_AUTH_MODE activo.
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

  // --- Superficie administrativa CMS/Admin (Sprint 7) ----------------------
  if (admin) return routeAdmin(method, path, context);

  // --- API pública de LECTURA (sólo GET/HEAD) ------------------------------
  if (method !== 'GET' && method !== 'HEAD') {
    return methodNotAllowed('Sólo se admite GET en la API pública de lectura.');
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

// Enrutado de escritura CMS/Admin. La autenticación/scope ya se resolvió en
// authorize(); aquí sólo se despacha por método+ruta. El cuerpo JSON llega en
// `context.body` (parseado por server.mjs).
async function routeAdmin(method, path, context) {
  const body = context.body ?? null;

  // POST /admin/conflicts  (crear)
  if (path === `${ADMIN_BASE}/conflicts`) {
    if (method === 'POST') return handleCreateConflict(body);
    return methodNotAllowed('Usa POST para crear un conflicto.');
  }

  // POST|PUT /admin/conflicts/:id/status  (transición de estado)
  const mStatus = path.match(new RegExp(`^${ADMIN_BASE}/conflicts/([^/]+)/status$`));
  if (mStatus) {
    if (method === 'POST' || method === 'PUT') {
      return handleSetConflictStatus(decodeURIComponent(mStatus[1]), body);
    }
    return methodNotAllowed('Usa POST o PUT para cambiar el estado.');
  }

  // PUT|PATCH /admin/conflicts/:id  (editar)
  const mId = path.match(new RegExp(`^${ADMIN_BASE}/conflicts/([^/]+)$`));
  if (mId) {
    if (method === 'PUT' || method === 'PATCH') {
      return handleUpdateConflict(decodeURIComponent(mId[1]), body);
    }
    return methodNotAllowed('Usa PUT o PATCH para editar un conflicto.');
  }

  const e = apiError('not_found', `Ruta administrativa no encontrada: ${path}`);
  return { status: e.status, body: e.body };
}
