// GEOPÓLEM API v1 (Sprint 6) — tests de métricas duraderas / Prometheus.
// ---------------------------------------------------------------------------
// Verifica los contadores HTTP (requests/errores/auth denials/latencia), la
// exposición en formato Prometheus y el endpoint /api/v1/metrics del router.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';

delete process.env.DATABASE_URL;

const { CONFIG } = await import('../src/config.mjs');
CONFIG.obsLog = false;

const {
  recordRequest, recordSource, httpSnapshot, prometheus, _resetObservability,
} = await import('../src/observability.mjs');
const { route } = await import('../src/router.mjs');

function call(path, context = {}) {
  const url = new URL(`http://x${path}`);
  return route('GET', url.pathname, url.searchParams, context);
}

test('recordRequest acumula requests, errores, auth denials y latencia', () => {
  _resetObservability();
  recordRequest('conflicts', 200, 5);
  recordRequest('conflicts', 200, 15);
  recordRequest('conflicts', 401, 1);
  recordRequest('conflicts', 429, 1);
  recordRequest('unhandled', 500, 2);
  const s = httpSnapshot();
  assert.equal(s.requests_total, 5);
  assert.equal(s.errors_total, 1);
  assert.equal(s.client_errors_total, 2);
  assert.equal(s.auth_denials_total, 1);
  assert.equal(s.rate_limited_total, 1);
  assert.equal(s.latency_ms_avg, Number(((5 + 15 + 1 + 1 + 2) / 5).toFixed(3)));
  assert.equal(s.by_status['200'], 2);
});

test('prometheus() emite formato de exposición válido', () => {
  _resetObservability();
  recordRequest('conflicts', 200, 10);
  recordSource('conflicts', 'database', 'r1');
  recordSource('conflicts', 'static', 'r2');
  const text = prometheus();
  assert.match(text, /# HELP geopolem_requests_total/);
  assert.match(text, /# TYPE geopolem_requests_total counter/);
  assert.match(text, /geopolem_requests_total 1/);
  assert.match(text, /geopolem_request_latency_ms_count 1/);
  assert.match(text, /geopolem_responses_by_source_total\{source="database"\} 1/);
  assert.match(text, /geopolem_database_source_ratio 0\.5/);
  assert.ok(text.endsWith('\n'));
});

test('GET /api/v1/metrics devuelve texto Prometheus', async () => {
  _resetObservability();
  const res = await call('/api/v1/metrics');
  assert.equal(res.status, 200);
  assert.equal(typeof res.body, 'string');
  assert.match(res.contentType, /text\/plain/);
  assert.match(res.body, /geopolem_requests_total/);
});

test('/api/v1/health incluye observability.http', async () => {
  _resetObservability();
  const { body } = await call('/api/v1/health');
  assert.ok(body.data.observability.http, 'health debe incluir observability.http');
  assert.ok('requests_total' in body.data.observability.http);
  assert.ok('auth_denials_total' in body.data.observability.http);
});
