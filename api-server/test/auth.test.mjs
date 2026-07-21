// GEOPÓLEM API v1 (Sprint 5) — tests de autenticación JWT (HS256).
// ---------------------------------------------------------------------------
// Verifica la política GEOP_API_AUTH_MODE sobre el router (sin sockets ni DB):
//   - public   → todo accesible sin token (comportamiento histórico).
//   - required → 401 sin token / con token inválido / expirado; 200 con válido.
//   - optional → sin token OK; con token inválido 401.
//   - /health SIEMPRE público, incluso en required.
//   - verifyJwt: firma, expiración, nbf, alg no soportado.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

delete process.env.DATABASE_URL;

const { CONFIG } = await import('../src/config.mjs');
const { route } = await import('../src/router.mjs');
const { verifyJwt, extractBearer } = await import('../src/auth.mjs');

// Silencia logs de observabilidad durante los tests.
CONFIG.obsLog = false;

const SECRET = 'test-secret-para-hs256-suficientemente-largo';

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Firma un JWT HS256 de juguete para las pruebas.
function signJwt(payload, secret = SECRET, header = { alg: 'HS256', typ: 'JWT' }) {
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac('sha256', secret).update(`${h}.${p}`).digest());
  return `${h}.${p}.${sig}`;
}

function call(path, context = {}) {
  const url = new URL(`http://x${path}`);
  return route('GET', url.pathname, url.searchParams, context);
}

// Restaura el modo public tras cada test para no contaminar otros archivos.
function resetAuth() {
  CONFIG.authMode = 'public';
  CONFIG.jwtSecret = '';
  CONFIG.jwtIssuer = '';
  CONFIG.jwtAudience = '';
}

test('extractBearer parsea "Bearer <token>" (case-insensitive)', () => {
  assert.equal(extractBearer('Bearer abc.def.ghi'), 'abc.def.ghi');
  assert.equal(extractBearer('bearer xyz'), 'xyz');
  assert.equal(extractBearer('Basic zzz'), null);
  assert.equal(extractBearer(null), null);
});

test('verifyJwt: token válido pasa', () => {
  const token = signJwt({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 3600 });
  const r = verifyJwt(token, SECRET, { leewaySec: 30 });
  assert.equal(r.valid, true);
  assert.equal(r.payload.sub, 'u1');
});

test('verifyJwt: firma inválida falla', () => {
  const token = signJwt({ sub: 'u1' }, 'otro-secreto');
  const r = verifyJwt(token, SECRET);
  assert.equal(r.valid, false);
});

test('verifyJwt: token expirado falla', () => {
  const token = signJwt({ sub: 'u1', exp: Math.floor(Date.now() / 1000) - 100 });
  const r = verifyJwt(token, SECRET, { leewaySec: 0 });
  assert.equal(r.valid, false);
  assert.match(r.reason, /expirado/);
});

test('verifyJwt: alg no soportado (none) falla', () => {
  const token = signJwt({ sub: 'u1' }, SECRET, { alg: 'none', typ: 'JWT' });
  const r = verifyJwt(token, SECRET);
  assert.equal(r.valid, false);
  assert.match(r.reason, /alg/);
});

test('modo public: /conflicts accesible sin token', async () => {
  resetAuth();
  const { status } = await call('/api/v1/conflicts');
  assert.equal(status, 200);
  resetAuth();
});

test('modo required: sin token → 401', async () => {
  CONFIG.authMode = 'required';
  CONFIG.jwtSecret = SECRET;
  const { status, body } = await call('/api/v1/conflicts');
  assert.equal(status, 401);
  assert.equal(body.error.code, 'unauthorized');
  resetAuth();
});

test('modo required: token válido → 200', async () => {
  CONFIG.authMode = 'required';
  CONFIG.jwtSecret = SECRET;
  const token = signJwt({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 3600 });
  const { status } = await call('/api/v1/conflicts', { authorization: `Bearer ${token}` });
  assert.equal(status, 200);
  resetAuth();
});

test('modo required: token expirado → 401', async () => {
  CONFIG.authMode = 'required';
  CONFIG.jwtSecret = SECRET;
  const token = signJwt({ sub: 'u1', exp: Math.floor(Date.now() / 1000) - 100 });
  const { status } = await call('/api/v1/conflicts', { authorization: `Bearer ${token}` });
  assert.equal(status, 401);
  resetAuth();
});

test('modo required: /health SIEMPRE público (sin token → 200)', async () => {
  CONFIG.authMode = 'required';
  CONFIG.jwtSecret = SECRET;
  const { status, body } = await call('/api/v1/health');
  assert.equal(status, 200);
  assert.equal(body.data.status, 'ok');
  resetAuth();
});

test('modo required sin JWT_SECRET → 500 fail-closed', async () => {
  CONFIG.authMode = 'required';
  CONFIG.jwtSecret = '';
  const { status, body } = await call('/api/v1/conflicts');
  assert.equal(status, 500);
  assert.equal(body.error.code, 'internal_error');
  resetAuth();
});

test('modo optional: sin token → 200; con token inválido → 401', async () => {
  CONFIG.authMode = 'optional';
  CONFIG.jwtSecret = SECRET;
  const anon = await call('/api/v1/conflicts');
  assert.equal(anon.status, 200);

  const bad = await call('/api/v1/conflicts', { authorization: 'Bearer no.es.valido' });
  assert.equal(bad.status, 401);
  resetAuth();
});
