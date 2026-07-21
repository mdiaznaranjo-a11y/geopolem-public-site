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

// --- Métricas duraderas de tráfico (Sprint 6) ------------------------------
// Contadores de nivel HTTP, independientes del origen de datos. Alimentan el
// endpoint Prometheus y el bloque `observability.http` de /health.
const httpMetrics = {
  requests_total: 0,
  errors_total: 0,           // respuestas con status >= 500
  client_errors_total: 0,    // respuestas 4xx (incluye auth y rate limit)
  auth_denials_total: 0,     // respuestas 401 (token ausente/ inválido)
  rate_limited_total: 0,     // respuestas 429
  latency_ms_sum: 0,         // suma de latencias (para media/summary)
  latency_ms_count: 0,
  by_status: Object.create(null), // { [statusCode]: count }
  by_endpoint: Object.create(null), // { [endpoint]: { requests, errors, latency_ms_sum } }
};

function ensureHttpEndpoint(endpoint) {
  if (!httpMetrics.by_endpoint[endpoint]) {
    httpMetrics.by_endpoint[endpoint] = { requests: 0, errors: 0, latency_ms_sum: 0 };
  }
  return httpMetrics.by_endpoint[endpoint];
}

// Registra una respuesta HTTP completa (llamado desde server.mjs tras enrutar).
// `durationMs` es opcional; si no se pasa, no altera la latencia acumulada.
export function recordRequest(endpoint, status, durationMs) {
  const label = endpoint || 'unknown';
  httpMetrics.requests_total += 1;
  httpMetrics.by_status[status] = (httpMetrics.by_status[status] || 0) + 1;
  const ep = ensureHttpEndpoint(label);
  ep.requests += 1;

  if (status >= 500) { httpMetrics.errors_total += 1; ep.errors += 1; }
  else if (status >= 400) {
    httpMetrics.client_errors_total += 1;
    if (status === 401) httpMetrics.auth_denials_total += 1;
    if (status === 429) httpMetrics.rate_limited_total += 1;
  }

  if (Number.isFinite(durationMs) && durationMs >= 0) {
    httpMetrics.latency_ms_sum += durationMs;
    httpMetrics.latency_ms_count += 1;
    ep.latency_ms_sum += durationMs;
  }
}

// Registra explícitamente una denegación de autorización (uso opcional; el
// conteo principal se deriva del status en recordRequest).
export function recordAuthDenial() {
  httpMetrics.auth_denials_total += 1;
}

export function httpSnapshot() {
  const { requests_total, latency_ms_sum, latency_ms_count } = httpMetrics;
  return {
    requests_total,
    errors_total: httpMetrics.errors_total,
    client_errors_total: httpMetrics.client_errors_total,
    auth_denials_total: httpMetrics.auth_denials_total,
    rate_limited_total: httpMetrics.rate_limited_total,
    latency_ms_avg: latency_ms_count > 0
      ? Number((latency_ms_sum / latency_ms_count).toFixed(3))
      : null,
    by_status: { ...httpMetrics.by_status },
  };
}

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

// --- Exposición Prometheus (Sprint 6) --------------------------------------
// Formato de exposición de texto de Prometheus (v0.0.4), construido a mano
// para NO añadir dependencias. Compatible con scraping estándar y con
// colectores OpenTelemetry que ingieren el endpoint /metrics de Prometheus.
// Sólo expone agregados numéricos: nunca datos sensibles.
function escapeLabel(v) {
  return String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

export function prometheus() {
  const s = snapshot();
  const lines = [];
  const push = (name, help, type, samples) => {
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} ${type}`);
    for (const [labels, value] of samples) {
      lines.push(labels ? `${name}{${labels}} ${value}` : `${name} ${value}`);
    }
  };

  push('geopolem_requests_total', 'Total de respuestas HTTP servidas.', 'counter',
    [['', httpMetrics.requests_total]]);
  push('geopolem_errors_total', 'Respuestas con error de servidor (5xx).', 'counter',
    [['', httpMetrics.errors_total]]);
  push('geopolem_client_errors_total', 'Respuestas de error de cliente (4xx).', 'counter',
    [['', httpMetrics.client_errors_total]]);
  push('geopolem_auth_denials_total', 'Peticiones denegadas por auth (401).', 'counter',
    [['', httpMetrics.auth_denials_total]]);
  push('geopolem_rate_limited_total', 'Peticiones limitadas por rate limiting (429).', 'counter',
    [['', httpMetrics.rate_limited_total]]);

  // Latencia como summary (sum + count) → permite rate() y media en Prometheus.
  lines.push('# HELP geopolem_request_latency_ms Latencia de respuesta en milisegundos.');
  lines.push('# TYPE geopolem_request_latency_ms summary');
  lines.push(`geopolem_request_latency_ms_sum ${httpMetrics.latency_ms_sum}`);
  lines.push(`geopolem_request_latency_ms_count ${httpMetrics.latency_ms_count}`);

  // Respuestas por código de estado.
  const statusSamples = Object.entries(httpMetrics.by_status)
    .map(([code, n]) => [`code="${escapeLabel(code)}"`, n]);
  if (statusSamples.length) {
    push('geopolem_responses_by_status_total', 'Respuestas por código HTTP.', 'counter', statusSamples);
  }

  // Origen de datos (database|static|error) → señal de promoción.
  push('geopolem_responses_by_source_total', 'Respuestas por origen de datos.', 'counter', [
    ['source="database"', counters.by_source.database],
    ['source="static"', counters.by_source.static],
    ['source="error"', counters.by_source.error],
  ]);
  const ratio = s.database_ratio == null ? 0 : s.database_ratio;
  push('geopolem_database_source_ratio', 'Fracción de respuestas servidas por la DB (0..1).', 'gauge',
    [['', ratio]]);

  // Requests por endpoint (cardinalidad acotada: 5 endpoints v1).
  const epSamples = Object.entries(httpMetrics.by_endpoint)
    .map(([ep, m]) => [`endpoint="${escapeLabel(ep)}"`, m.requests]);
  if (epSamples.length) {
    push('geopolem_requests_by_endpoint_total', 'Peticiones por endpoint.', 'counter', epSamples);
  }

  return `${lines.join('\n')}\n`;
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

  httpMetrics.requests_total = 0;
  httpMetrics.errors_total = 0;
  httpMetrics.client_errors_total = 0;
  httpMetrics.auth_denials_total = 0;
  httpMetrics.rate_limited_total = 0;
  httpMetrics.latency_ms_sum = 0;
  httpMetrics.latency_ms_count = 0;
  httpMetrics.by_status = Object.create(null);
  httpMetrics.by_endpoint = Object.create(null);
}
