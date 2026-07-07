// GEOPÓLEM API v1 (Sprint 5) — observabilidad de meta.source.
// ---------------------------------------------------------------------------
// Registra, por cada respuesta, DE DÓNDE salieron los datos:
//   'database' → API real PostgreSQL/PostGIS.
//   'static'   → puente estático api/v1/*.json (fallback permanente).
//   'error'    → error no controlado (500).
//
// Dos señales, sin dependencias ni almacenamiento externo:
//   1) Log estructurado (una línea JSON por respuesta) → apto para agregación
//      (Loki/CloudWatch/journald). Desactivable con GEOP_OBS_LOG=false.
//   2) Contadores in-memory acumulados por endpoint y por origen, expuestos en
//      GET /api/v1/health (bloque `observability`). NO exponen datos sensibles:
//      sólo agregados numéricos y timestamps.
//
// Uso para decidir promociones staging→producción: si tras apuntar
// DATABASE_URL al staging el ratio `by_source.database / total` no sube a ~1.0
// (o `last_static_at` sigue avanzando), la DB no está sirviendo y NO debe
// promoverse. Ver SPRINT_5_STATIC_OBSERVABILITY_JWT.md.
// ---------------------------------------------------------------------------

import { CONFIG } from './config.mjs';

const startedAt = new Date().toISOString();

// Contadores acumulados desde el arranque del proceso.
const counters = {
  total: 0,
  by_source: { database: 0, static: 0, error: 0 },
  by_endpoint: Object.create(null), // { [endpoint]: { database, static, error } }
  last_source: null,
  last_database_at: null,
  last_static_at: null,
  last_error_at: null,
};

function ensureEndpoint(endpoint) {
  if (!counters.by_endpoint[endpoint]) {
    counters.by_endpoint[endpoint] = { database: 0, static: 0, error: 0 };
  }
  return counters.by_endpoint[endpoint];
}

// Registra el origen de una respuesta. Devuelve el `source` recibido para
// permitir encadenar en el handler sin variables extra.
export function recordSource(endpoint, source, requestId) {
  const src = source === 'database' || source === 'static' || source === 'error'
    ? source
    : 'static';

  counters.total += 1;
  counters.by_source[src] += 1;
  ensureEndpoint(endpoint)[src] += 1;
  counters.last_source = src;
  const nowIso = new Date().toISOString();
  if (src === 'database') counters.last_database_at = nowIso;
  else if (src === 'static') counters.last_static_at = nowIso;
  else counters.last_error_at = nowIso;

  if (CONFIG.obsLog) {
    // Una sola línea JSON: fácil de filtrar (event=api_response) y agregar.
    process.stdout.write(`${JSON.stringify({
      ts: nowIso,
      level: 'info',
      event: 'api_response',
      service: CONFIG.serviceName,
      api_version: CONFIG.apiVersion,
      endpoint,
      source: src,
      request_id: requestId || null,
    })}\n`);
  }
  return src;
}

// Instantánea de contadores para el endpoint de salud/diagnóstico.
export function snapshot() {
  const db = counters.by_source.database;
  const total = counters.total;
  return {
    started_at: startedAt,
    total,
    by_source: { ...counters.by_source },
    by_endpoint: JSON.parse(JSON.stringify(counters.by_endpoint)),
    last_source: counters.last_source,
    last_database_at: counters.last_database_at,
    last_static_at: counters.last_static_at,
    last_error_at: counters.last_error_at,
    // Fracción de respuestas servidas por la DB (señal de promoción).
    database_ratio: total > 0 ? Number((db / total).toFixed(4)) : null,
  };
}

// Sólo para tests: reinicia contadores en memoria.
export function _resetObservability() {
  counters.total = 0;
  counters.by_source = { database: 0, static: 0, error: 0 };
  counters.by_endpoint = Object.create(null);
  counters.last_source = null;
  counters.last_database_at = null;
  counters.last_static_at = null;
  counters.last_error_at = null;
}
