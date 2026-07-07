// GEOPÓLEM API v1 (Sprint 9) — persistencia controlada del CMS: fail-closed.
// ---------------------------------------------------------------------------
// Verifica la política de escritura endurecida:
//   • Por defecto (GEOP_ADMIN_WRITES=false) → modo 'prepared' (no persiste, 200).
//   • Activada pero SIN DATABASE_URL → 503 service_unavailable (misconfigured):
//     NO se finge un guardado (fail-closed).
//   • Activada CON DATABASE_URL pero DB/pg no disponibles → 503 (unavailable).
// La lectura pública no se toca. No se usa DB real en este test.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

delete process.env.DATABASE_URL;

const { CONFIG, adminWritesConfigState } = await import('../src/config.mjs');
CONFIG.obsLog = false;
const { route } = await import('../src/router.mjs');
const admin = await import('../src/admin-repository.mjs');

const SECRET = 'sprint9-secret-hs256-suficientemente-largo-xxxxx';

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function signJwt(payload) {
  const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac('sha256', SECRET).update(`${h}.${p}`).digest());
  return `${h}.${p}.${sig}`;
}
function adminToken() {
  return signJwt({ sub: 'ops', scope: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
}
function req(method, path, body) {
  const url = new URL(`http://x${path}`);
  return route(method, url.pathname, url.searchParams, { authorization: `Bearer ${adminToken()}`, body });
}
function reset() {
  CONFIG.authMode = 'public';
  CONFIG.jwtSecret = SECRET;
  CONFIG.adminWritesEnabled = false;
  CONFIG.databaseUrl = '';
}

const VALID = { slug: 'sprint9-demo', name: 'Conflicto Sprint 9', status: 'draft', intensity_level: 2 };

test('adminWritesConfigState refleja el entorno', () => {
  reset();
  assert.equal(adminWritesConfigState(), 'prepared');
  CONFIG.adminWritesEnabled = true;
  assert.equal(adminWritesConfigState(), 'misconfigured'); // sin DATABASE_URL
  CONFIG.databaseUrl = 'postgres://x/y';
  assert.equal(adminWritesConfigState(), 'enabled');
  reset();
});

test('por defecto (prepared): crear conflicto → 200 no persistido', async () => {
  reset();
  const { status, body } = await req('POST', '/api/v1/admin/conflicts', VALID);
  assert.equal(status, 200);
  assert.equal(body.meta.persisted, false);
  assert.equal(body.meta.mode, 'prepared');
  assert.equal(body.data.id, null);
  reset();
});

test('escritura activada sin DATABASE_URL → 503 (fail-closed, misconfigured)', async () => {
  reset();
  CONFIG.adminWritesEnabled = true; // sin databaseUrl
  const { status, body } = await req('POST', '/api/v1/admin/conflicts', VALID);
  assert.equal(status, 503);
  assert.equal(body.error.code, 'service_unavailable');
  assert.equal(body.error.details.state, 'misconfigured');
  reset();
});

test('escritura activada con DATABASE_URL pero DB/pg no disponible → 503 (unavailable)', async () => {
  reset();
  CONFIG.adminWritesEnabled = true;
  CONFIG.databaseUrl = 'postgres://noexiste:5432/db'; // pg no instalado / inalcanzable
  const { status, body } = await req('POST', '/api/v1/admin/conflicts', VALID);
  assert.equal(status, 503);
  assert.equal(body.error.code, 'service_unavailable');
  assert.equal(body.error.details.state, 'unavailable');
  reset();
});

test('fail-closed también en editar (PATCH) y cambio de estado', async () => {
  reset();
  CONFIG.adminWritesEnabled = true; // misconfigured
  const upd = await req('PATCH', '/api/v1/admin/conflicts/sprint9-demo', { summary: 'nuevo' });
  assert.equal(upd.status, 503);
  const st = await req('POST', '/api/v1/admin/conflicts/sprint9-demo/status', { status: 'published' });
  assert.equal(st.status, 503);
  reset();
});

test('validación sigue antes que la persistencia: payload inválido → 422 aunque esté misconfigured', async () => {
  reset();
  CONFIG.adminWritesEnabled = true;
  const { status, body } = await req('POST', '/api/v1/admin/conflicts', { name: 'X' }); // slug ausente
  assert.equal(status, 422);
  assert.equal(body.error.code, 'validation_error');
  reset();
});

test('writesEnabled() sigue siendo false salvo estado database', async () => {
  reset();
  assert.equal(await admin.writesEnabled(), false); // prepared
  CONFIG.adminWritesEnabled = true;
  assert.equal(await admin.writesEnabled(), false); // misconfigured
  reset();
});

test('la lectura pública no se ve afectada por la config de escritura', async () => {
  reset();
  CONFIG.adminWritesEnabled = true; // misconfigured para escritura
  const url = new URL('http://x/api/v1/conflicts');
  const { status } = await route('GET', url.pathname, url.searchParams);
  assert.equal(status, 200);
  reset();
});
