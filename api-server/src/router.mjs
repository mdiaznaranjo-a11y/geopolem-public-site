// GEOPÓLEM API v1 (Sprint 3) — router puro (sin node:http) para testeo directo.
// ---------------------------------------------------------------------------
// Resuelve (method, path, searchParams) → { status, body }. Se usa tanto desde
// el servidor HTTP (server.mjs) como desde los tests de contrato, sin sockets.
// ---------------------------------------------------------------------------

import {
  handleHealth,
  handleConflicts,
  handleActiveMap,
  handleConflictDetail,
  handleFilters,
} from './handlers.mjs';
import { apiError } from './response.mjs';
import { authorize } from './auth.mjs';

const BASE = '/api/v1';

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

  if (path === `${BASE}/health`) return handleHealth();
  if (path === `${BASE}/filters`) return handleFilters();
  if (path === `${BASE}/conflicts`) return handleConflicts(searchParams);
  if (path === `${BASE}/conflicts/active/map`) return handleActiveMap(searchParams);

  // /conflicts/:id  (evita chocar con /conflicts/active/map)
  const m = path.match(new RegExp(`^${BASE}/conflicts/([^/]+)$`));
  if (m) return handleConflictDetail(decodeURIComponent(m[1]));

  const e = apiError('not_found', `Ruta no encontrada: ${pathname}`);
  return { status: e.status, body: e.body };
}
