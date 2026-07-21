// GEOPÓLEM API v1 (Sprint 6) — tests de scopes/claims JWT.
// ---------------------------------------------------------------------------
// Verifica el parseo de scopes (string OAuth2 y/o array), el comodín 'admin',
// el mapa de scopes por ruta (CMS/Admin preparado para Sprint 7) y que la
// lectura pública NO exige scope por defecto (sin romper Sprint 5).
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

delete process.env.DATABASE_URL;

const { CONFIG } = await import('../src/config.mjs');
CONFIG.obsLog = false;
const {
  tokenScopes, hasScope, requiredScopeForPath,
} = await import('../src/auth.mjs');
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
function call(path, context = {}) {
  const url = new URL(`http://x${path}`);
  return route('GET', url.pathname, url.searchParams, context);
}
function resetAuth() {
  CONFIG.authMode = 'public';
  CONFIG.jwtSecret = '';
  CONFIG.scopeRead = '';
}

test('tokenScopes: parsea string OAuth2 y array, deduplica', () => {
  assert.deepEqual(tokenScopes({ scope: 'a b c' }).sort(), ['a', 'b', 'c']);
  assert.deepEqual(tokenScopes({ scopes: ['x', 'y'] }).sort(), ['x', 'y']);
  assert.deepEqual(tokenScopes({ scope: 'a b', scopes: ['b', 'c'] }).sort(), ['a', 'b', 'c']);
  assert.deepEqual(tokenScopes(null), []);
});

test('hasScope: sin requisito permite; admin es comodín', () => {
  assert.equal(hasScope({ scope: '' }, null), true);
  assert.equal(hasScope({ scope: 'admin' }, 'cms:write'), true);
  assert.equal(hasScope({ scope: 'cms:write' }, 'cms:write'), true);
  assert.equal(hasScope({ scope: 'otro' }, 'cms:write'), false);
});

test('requiredScopeForPath: mapa CMS/Admin y lectura por defecto', () => {
  resetAuth();
  assert.equal(requiredScopeForPath('/api/v1/admin/x'), CONFIG.scopeAdmin);
  assert.equal(requiredScopeForPath('/api/v1/cms/x'), CONFIG.scopeCms);
  assert.equal(requiredScopeForPath('/api/v1/conflicts'), null); // lectura abierta
});

test('lectura pública NO exige scope aunque haya token válido', async () => {
  CONFIG.authMode = 'required';
  CONFIG.jwtSecret = SECRET;
  CONFIG.scopeRead = '';
  const token = signJwt({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 3600 });
  const { status } = await call('/api/v1/conflicts', { authorization: `Bearer ${token}` });
  assert.equal(status, 200);
  resetAuth();
});

test('con GEOP_SCOPE_READ definido, token sin scope → 403; con scope → 200', async () => {
  CONFIG.authMode = 'required';
  CONFIG.jwtSecret = SECRET;
  CONFIG.scopeRead = 'conflicts:read';
  const exp = Math.floor(Date.now() / 1000) + 3600;

  const noScope = signJwt({ sub: 'u1', exp });
  const denied = await call('/api/v1/conflicts', { authorization: `Bearer ${noScope}` });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error.code, 'forbidden');

  const withScope = signJwt({ sub: 'u1', exp, scope: 'conflicts:read' });
  const ok = await call('/api/v1/conflicts', { authorization: `Bearer ${withScope}` });
  assert.equal(ok.status, 200);
  resetAuth();
});
