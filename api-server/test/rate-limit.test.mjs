// GEOPÓLEM API v1 (Sprint 6) — tests de rate limiting.
// ---------------------------------------------------------------------------
// Verifica (sin sockets ni relojes reales) la ventana fija pura `evaluate`, el
// `RateLimitStore` y la integración con el router (429 + Retry-After), sin
// romper el modo public por defecto (max=0 → desactivado).
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';

delete process.env.DATABASE_URL;

const { evaluate, RateLimitStore } = await import('../src/rate-limit.mjs');
const { CONFIG } = await import('../src/config.mjs');
CONFIG.obsLog = false;
const { route } = await import('../src/router.mjs');

function call(path, context = {}) {
  const url = new URL(`http://x${path}`);
  return route('GET', url.pathname, url.searchParams, context);
}

test('evaluate: abre nueva ventana y permite', () => {
  const r = evaluate(undefined, { max: 2, windowMs: 1000, now: 1000 });
  assert.equal(r.allowed, true);
  assert.equal(r.remaining, 1);
  assert.deepEqual(r.state, { count: 1, windowStart: 1000 });
});

test('evaluate: bloquea al superar max dentro de la ventana', () => {
  let s = evaluate(undefined, { max: 2, windowMs: 1000, now: 0 }).state;
  s = evaluate(s, { max: 2, windowMs: 1000, now: 100 }).state;
  const r = evaluate(s, { max: 2, windowMs: 1000, now: 200 });
  assert.equal(r.allowed, false);
  assert.equal(r.remaining, 0);
  assert.ok(r.retryAfterSec >= 1);
});

test('evaluate: reinicia la ventana cuando expira', () => {
  const first = evaluate(undefined, { max: 1, windowMs: 1000, now: 0 });
  const blocked = evaluate(first.state, { max: 1, windowMs: 1000, now: 500 });
  assert.equal(blocked.allowed, false);
  const reopened = evaluate(blocked.state, { max: 1, windowMs: 1000, now: 1500 });
  assert.equal(reopened.allowed, true);
});

test('RateLimitStore: deshabilitado si max<=0', () => {
  const store = new RateLimitStore({ max: 0, windowMs: 1000 });
  assert.equal(store.enabled, false);
  const r = store.hit('k', 0);
  assert.equal(r.allowed, true);
  assert.equal(r.remaining, Infinity);
});

test('RateLimitStore: cuenta por clave y limita', () => {
  const store = new RateLimitStore({ max: 2, windowMs: 1000 });
  assert.equal(store.hit('a', 0).allowed, true);
  assert.equal(store.hit('a', 10).allowed, true);
  assert.equal(store.hit('a', 20).allowed, false);
  // Otra clave no se ve afectada.
  assert.equal(store.hit('b', 20).allowed, true);
});

test('router: modo public (max=0) no limita', async () => {
  CONFIG.rateLimitMax = 0;
  for (let i = 0; i < 10; i++) {
    const { status } = await call('/api/v1/conflicts', { clientId: 'ip1' });
    assert.equal(status, 200);
  }
});

test('router: con límite, devuelve 429 y Retry-After; /health y /metrics exentos', async () => {
  CONFIG.rateLimitMax = 3;
  CONFIG.rateLimitWindowMs = 60000;
  try {
    let last;
    for (let i = 0; i < 5; i++) {
      last = await call('/api/v1/conflicts', { clientId: 'ip-burst' });
    }
    assert.equal(last.status, 429);
    assert.equal(last.body.error.code, 'rate_limited');
    assert.ok(last.headers && last.headers['Retry-After']);

    // health y metrics nunca se limitan.
    for (let i = 0; i < 5; i++) {
      assert.equal((await call('/api/v1/health', { clientId: 'ip-burst' })).status, 200);
      assert.equal((await call('/api/v1/metrics', { clientId: 'ip-burst' })).status, 200);
    }
  } finally {
    CONFIG.rateLimitMax = 0;
  }
});
