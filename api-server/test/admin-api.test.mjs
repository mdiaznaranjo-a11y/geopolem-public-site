// GEOPÓLEM API v1 (Sprint 7) — tests de la superficie CMS/Admin.
// ---------------------------------------------------------------------------
// Ejercita el router (sin sockets ni DB) para verificar:
//   • Los endpoints admin exigen SIEMPRE token + scope, incluso en modo public.
//   • La lectura pública sigue funcionando sin cambios.
//   • Validación de contrato (422) y modo "prepared" (no persiste) por defecto.
//   • El control de método por ruta.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

delete process.env.DATABASE_URL;

const { CONFIG } = await import('../src/config.mjs');
CONFIG.obsLog = false;
const { route } = await import('../src/router.mjs');

const SECRET = 'test-secret-para-hs256-suficientemente-largo';

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function signJwt(payload) {
  const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac('sha256', SECRET).update(`${h}.${p}`).digest());
  return `${h}.${p}.${sig}`;
}
function req(method, path, { context = {}, body } = {}) {
  const url = new URL(`http://x${path}`);
  return route(method, url.pathname, url.searchParams, { ...context, body });
}
function adminToken(scope = 'admin') {
  return signJwt({ sub: 'ops', scope, exp: Math.floor(Date.now() / 1000) + 3600 });
}
function resetAuth() {
  CONFIG.authMode = 'public';
  CONFIG.jwtSecret = '';
  CONFIG.scopeRead = '';
  CONFIG.adminWritesEnabled = false;
}

test('admin en modo public: sin token → 500 fail-closed si no hay secreto', async () => {
  resetAuth(); // public, sin secreto
  const { status, body } = await req('POST', '/api/v1/admin/conflicts', { body: { slug: 'x', name: 'X' } });
  assert.equal(status, 500);
  assert.equal(body.error.code, 'internal_error');
  resetAuth();
});

test('admin con secreto pero sin token → 401 aunque el modo sea public', async () => {
  resetAuth();
  CONFIG.jwtSecret = SECRET;
  const { status, body } = await req('POST', '/api/v1/admin/conflicts', { body: { slug: 'x', name: 'X' } });
  assert.equal(status, 401);
  assert.equal(body.error.code, 'unauthorized');
  resetAuth();
});

test('admin con token pero scope insuficiente → 403', async () => {
  resetAuth();
  CONFIG.jwtSecret = SECRET;
  const token = signJwt({ sub: 'u', scope: 'conflicts:read', exp: Math.floor(Date.now() / 1000) + 3600 });
  const { status, body } = await req('POST', '/api/v1/admin/conflicts', {
    context: { authorization: `Bearer ${token}` },
    body: { slug: 'x', name: 'Nombre válido' },
  });
  assert.equal(status, 403);
  assert.equal(body.error.code, 'forbidden');
  resetAuth();
});

test('crear conflicto: token admin + payload válido → 200 prepared (no persiste)', async () => {
  resetAuth();
  CONFIG.jwtSecret = SECRET;
  const { status, body } = await req('POST', '/api/v1/admin/conflicts', {
    context: { authorization: `Bearer ${adminToken()}` },
    body: { slug: 'conflicto-nuevo', name: 'Conflicto Nuevo', status: 'draft', intensity_level: 3 },
  });
  assert.equal(status, 200);
  assert.equal(body.meta.persisted, false);
  assert.equal(body.meta.mode, 'prepared');
  assert.equal(body.data.id, null); // no se inventa id
  assert.equal(body.data.slug, 'conflicto-nuevo');
  assert.equal(body.data.cms_status, 'draft');
  assert.equal(body.data.status, 'draft');
  resetAuth();
});

test('crear conflicto: payload inválido → 422 con details', async () => {
  resetAuth();
  CONFIG.jwtSecret = SECRET;
  const { status, body } = await req('POST', '/api/v1/admin/conflicts', {
    context: { authorization: `Bearer ${adminToken()}` },
    body: { name: 'X' }, // falta slug, name muy corto
  });
  assert.equal(status, 422);
  assert.equal(body.error.code, 'validation_error');
  assert.ok(Array.isArray(body.error.details.errors));
  resetAuth();
});

test('cambiar estado: published mapea a active en prepared', async () => {
  resetAuth();
  CONFIG.jwtSecret = SECRET;
  const { status, body } = await req('POST', '/api/v1/admin/conflicts/conflicto-x/status', {
    context: { authorization: `Bearer ${adminToken()}` },
    body: { status: 'published' },
  });
  assert.equal(status, 200);
  assert.equal(body.meta.persisted, false);
  assert.equal(body.data.cms_status, 'published');
  assert.equal(body.data.status, 'active');
  resetAuth();
});

test('cambiar estado: status inválido → 422', async () => {
  resetAuth();
  CONFIG.jwtSecret = SECRET;
  const { status } = await req('POST', '/api/v1/admin/conflicts/c/status', {
    context: { authorization: `Bearer ${adminToken()}` },
    body: { status: 'no-existe' },
  });
  assert.equal(status, 422);
  resetAuth();
});

test('editar conflicto: PATCH parcial válido → 200 prepared', async () => {
  resetAuth();
  CONFIG.jwtSecret = SECRET;
  const { status, body } = await req('PATCH', '/api/v1/admin/conflicts/conflicto-x', {
    context: { authorization: `Bearer ${adminToken()}` },
    body: { summary: 'Resumen actualizado' },
  });
  assert.equal(status, 200);
  assert.equal(body.meta.mode, 'prepared');
  assert.equal(body.data.patch.summary, 'Resumen actualizado');
  resetAuth();
});

test('método no permitido en ruta admin → 405', async () => {
  resetAuth();
  CONFIG.jwtSecret = SECRET;
  const { status } = await req('DELETE', '/api/v1/admin/conflicts/conflicto-x', {
    context: { authorization: `Bearer ${adminToken()}` },
  });
  assert.equal(status, 405);
  resetAuth();
});

test('scope cms:write basta para el prefijo /cms pero NO para /admin', async () => {
  resetAuth();
  CONFIG.jwtSecret = SECRET;
  const cmsTok = signJwt({ sub: 'ed', scope: 'cms:write', exp: Math.floor(Date.now() / 1000) + 3600 });
  // /admin exige scope admin → 403 con sólo cms:write
  const denied = await req('POST', '/api/v1/admin/conflicts', {
    context: { authorization: `Bearer ${cmsTok}` },
    body: { slug: 'c', name: 'Nombre válido' },
  });
  assert.equal(denied.status, 403);
  resetAuth();
});

test('la LECTURA pública sigue intacta (GET /conflicts sin token → 200)', async () => {
  resetAuth();
  const { status } = await req('GET', '/api/v1/conflicts');
  assert.equal(status, 200);
  resetAuth();
});

test('POST a ruta pública de lectura → 405', async () => {
  resetAuth();
  const { status } = await req('POST', '/api/v1/conflicts', { body: {} });
  assert.equal(status, 405);
  resetAuth();
});
