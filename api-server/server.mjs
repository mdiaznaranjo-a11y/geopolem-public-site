// GEOPÓLEM API v1 (Sprint 3) — servidor HTTP read-only.
// ---------------------------------------------------------------------------
// Servidor mínimo basado en node:http (cero dependencias en tiempo de
// ejecución; `pg` es opcional y sólo se carga si hay DATABASE_URL). Sirve el
// contrato v1 alimentando web/PWA/mapa. Sin DB usa el puente estático.
//
// Arranque:   node server.mjs      (o: npm start)
// Puerto:     PORT (por defecto 8787)
// ---------------------------------------------------------------------------

import { createServer } from 'node:http';
import { CONFIG, hasDatabase } from './src/config.mjs';
import { route } from './src/router.mjs';
import { recordSource, recordRequest } from './src/observability.mjs';

function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', CONFIG.corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
}

// Límite defensivo del cuerpo de escritura (1 MiB): evita payloads abusivos.
const MAX_BODY_BYTES = 1024 * 1024;
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH']);

// Lee y parsea el cuerpo JSON en métodos de escritura. Devuelve
// { body } o { bodyError } (JSON inválido) o { tooLarge }.
async function readJsonBody(req) {
  if (!WRITE_METHODS.has(req.method)) return { body: null };
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) return { tooLarge: true };
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return { body: null };
  try {
    return { body: JSON.parse(raw) };
  } catch {
    return { bodyError: true };
  }
}

function isGeoJson(body) {
  return body && typeof body === 'object' && body.type === 'FeatureCollection';
}

// Etiqueta de endpoint estable (baja cardinalidad) para métricas por ruta.
function endpointLabel(pathname) {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (!p.startsWith('/api/v1')) return 'other';
  const rest = p.slice('/api/v1'.length) || '/';
  if (rest === '/health') return 'health';
  if (rest === '/metrics') return 'metrics';
  if (rest === '/filters') return 'filters';
  if (rest === '/conflicts') return 'conflicts';
  if (rest === '/conflicts/active/map') return 'conflicts_active_map';
  if (rest === '/analytics/events') return 'analytics_events';
  if (rest === '/admin/conflicts') return 'admin_conflicts';
  if (/^\/admin\/conflicts\/[^/]+\/status$/.test(rest)) return 'admin_conflict_status';
  if (/^\/admin\/conflicts\/[^/]+$/.test(rest)) return 'admin_conflict_detail';
  if (/^\/conflicts\/[^/]+$/.test(rest)) return 'conflict_detail';
  return 'other';
}

// IP del cliente para el rate limiting (respeta X-Forwarded-For tras proxy).
function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

const server = createServer(async (req, res) => {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const startedAt = process.hrtime.bigint();
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let result;
  try {
    const parsed = await readJsonBody(req);
    if (parsed.tooLarge) {
      result = { status: 413, body: { error: { code: 'bad_request', message: 'Cuerpo demasiado grande.' } } };
    } else if (parsed.bodyError) {
      result = { status: 400, body: { error: { code: 'bad_request', message: 'JSON del cuerpo inválido.' } } };
    } else {
      const context = {
        authorization: req.headers['authorization'] || null,
        clientId: clientIp(req),
        body: parsed.body,
      };
      result = await route(req.method, url.pathname, url.searchParams, context);
    }
  } catch (err) {
    console.error('[geopolem-api] error no controlado:', err);
    recordSource('unhandled', 'error', null);
    result = {
      status: 500,
      body: { error: { code: 'internal_error', message: 'Error interno del servidor.' } },
    };
  }

  // Cuerpos de texto (p. ej. /metrics) se envían tal cual; el resto como JSON.
  const isText = typeof result.body === 'string';
  const contentType = result.contentType
    || (isGeoJson(result.body)
      ? 'application/geo+json; charset=utf-8'
      : 'application/json; charset=utf-8');
  const headers = { 'Content-Type': contentType, ...(result.headers || {}) };
  res.writeHead(result.status, headers);
  const payload = isText ? result.body : JSON.stringify(result.body);
  res.end(req.method === 'HEAD' ? undefined : payload);

  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  recordRequest(endpointLabel(url.pathname), result.status, durationMs);
});

server.listen(CONFIG.port, CONFIG.host, () => {
  const mode = hasDatabase() ? 'PostgreSQL (con fallback estático)' : 'JSON estático (sin DATABASE_URL)';
  console.log(`GEOPÓLEM API v1 escuchando en http://${CONFIG.host}:${CONFIG.port}${''}`);
  console.log(`Modo de datos: ${mode}`);
  console.log(`Modo de auth: ${CONFIG.authMode}${CONFIG.authMode !== 'public' && !CONFIG.jwtSecret ? ' (¡falta JWT_SECRET! → 500 fail-closed)' : ''}`);
  console.log(`Observabilidad meta.source: logs ${CONFIG.obsLog ? 'ON' : 'OFF'}, contadores en /api/v1/health`);
  console.log(`Métricas Prometheus: ${CONFIG.metricsEnabled ? 'ON (/api/v1/metrics)' : 'OFF'}`);
  console.log(`Rate limiting: ${CONFIG.rateLimitMax > 0 ? `${CONFIG.rateLimitMax}/${CONFIG.rateLimitWindowMs}ms` : 'OFF (modo public)'}`);
  console.log('Endpoints:');
  console.log('  GET /api/v1/health');
  console.log('  GET /api/v1/metrics');
  console.log('  GET /api/v1/conflicts');
  console.log('  GET /api/v1/conflicts/active/map');
  console.log('  GET /api/v1/conflicts/:id');
  console.log('  GET /api/v1/filters');
  console.log(`Admin CMS (JWT scope requerido): escritura ${CONFIG.adminWritesEnabled ? 'REAL (GEOP_ADMIN_WRITES=true)' : 'PREPARED (no persiste)'}`);
  console.log('  POST  /api/v1/admin/conflicts');
  console.log('  PUT   /api/v1/admin/conflicts/:id');
  console.log('  POST  /api/v1/admin/conflicts/:id/status');
});

// Cierre ordenado.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
  });
}
