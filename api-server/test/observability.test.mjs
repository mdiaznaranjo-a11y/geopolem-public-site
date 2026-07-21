// GEOPÓLEM API v1 (Sprint 5) — tests de observabilidad de meta.source.
// ---------------------------------------------------------------------------
// Verifica (sin DB ni sockets) que:
//   - recordSource incrementa contadores globales y por endpoint.
//   - snapshot() calcula database_ratio y timestamps.
//   - /api/v1/health expone el bloque `observability`.
//   - una petición a /conflicts (source=static en fallback) queda contabilizada.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';

delete process.env.DATABASE_URL;

const { CONFIG } = await import('../src/config.mjs');
CONFIG.obsLog = false; // sin ruido en stdout durante los tests

const { recordSource, snapshot, _resetObservability } = await import('../src/observability.mjs');
const { route } = await import('../src/router.mjs');

function call(path) {
  const url = new URL(`http://x${path}`);
  return route('GET', url.pathname, url.searchParams);
}

test('recordSource incrementa total y by_source', () => {
  _resetObservability();
  recordSource('conflicts', 'static', 'req_1');
  recordSource('conflicts', 'static', 'req_2');
  recordSource('filters', 'database', 'req_3');
  const s = snapshot();
  assert.equal(s.total, 3);
  assert.equal(s.by_source.static, 2);
  assert.equal(s.by_source.database, 1);
  assert.equal(s.by_endpoint.conflicts.static, 2);
  assert.equal(s.by_endpoint.filters.database, 1);
});

test('database_ratio se calcula correctamente', () => {
  _resetObservability();
  recordSource('conflicts', 'database', 'a');
  recordSource('conflicts', 'database', 'b');
  recordSource('conflicts', 'static', 'c');
  const s = snapshot();
  assert.equal(s.total, 3);
  assert.equal(s.database_ratio, Number((2 / 3).toFixed(4)));
  assert.equal(s.last_source, 'static');
  assert.ok(s.last_database_at);
  assert.ok(s.last_static_at);
});

test('origen desconocido se normaliza a static', () => {
  _resetObservability();
  recordSource('x', 'lo-que-sea', null);
  assert.equal(snapshot().by_source.static, 1);
});

test('errores se contabilizan aparte', () => {
  _resetObservability();
  recordSource('unhandled', 'error', null);
  const s = snapshot();
  assert.equal(s.by_source.error, 1);
  assert.ok(s.last_error_at);
});

test('/api/v1/health expone bloque observability', async () => {
  _resetObservability();
  const { status, body } = await call('/api/v1/health');
  assert.equal(status, 200);
  assert.ok(body.data.observability, 'health debe incluir observability');
  assert.ok('total' in body.data.observability);
  assert.ok('by_source' in body.data.observability);
  assert.ok('database_ratio' in body.data.observability);
});

test('una petición /conflicts en fallback queda contabilizada como static', async () => {
  _resetObservability();
  await call('/api/v1/conflicts');
  const s = snapshot();
  assert.equal(s.by_source.static, 1);
  assert.equal(s.by_endpoint.conflicts.static, 1);
});
