// GEOPÓLEM API v1 (Sprint 7) — rotación de JWT_SECRET sin caída.
// ---------------------------------------------------------------------------
// verifyJwtWithRotation acepta el secreto ACTUAL o, durante la ventana de
// rotación, el ANTERIOR (JWT_SECRET_PREVIOUS). Verifica también que un token
// firmado con un secreto ajeno se rechaza y que signJwt aplica exp/nbf.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';

delete process.env.DATABASE_URL;

const { CONFIG } = await import('../src/config.mjs');
CONFIG.obsLog = false;
const { signJwt, verifyJwt, verifyJwtWithRotation } = await import('../src/auth.mjs');

const CURRENT = 'secreto-actual-hs256-suficientemente-largo-000';
const PREVIOUS = 'secreto-anterior-hs256-suficientemente-largo-11';
const FOREIGN = 'secreto-ajeno-no-configurado-en-el-servidor-222';

function baseClaims() {
  return { sub: 'ops', scope: 'admin' };
}
function resetSecrets() {
  CONFIG.jwtSecret = '';
  CONFIG.jwtSecretPrevious = '';
  CONFIG.jwtLeewaySec = 0;
  CONFIG.jwtIssuer = '';
  CONFIG.jwtAudience = '';
}

test('token firmado con el secreto ACTUAL valida', () => {
  resetSecrets();
  CONFIG.jwtSecret = CURRENT;
  const token = signJwt(baseClaims(), CURRENT, { expiresInSec: 3600 });
  const r = verifyJwtWithRotation(token);
  assert.equal(r.valid, true);
  assert.equal(r.payload.sub, 'ops');
  resetSecrets();
});

test('token firmado con el secreto ANTERIOR valida durante la ventana', () => {
  resetSecrets();
  CONFIG.jwtSecret = CURRENT;
  CONFIG.jwtSecretPrevious = PREVIOUS;
  const token = signJwt(baseClaims(), PREVIOUS, { expiresInSec: 3600 });
  const r = verifyJwtWithRotation(token);
  assert.equal(r.valid, true);
  resetSecrets();
});

test('sin JWT_SECRET_PREVIOUS, un token del secreto anterior NO valida', () => {
  resetSecrets();
  CONFIG.jwtSecret = CURRENT; // ventana cerrada
  const token = signJwt(baseClaims(), PREVIOUS, { expiresInSec: 3600 });
  const r = verifyJwtWithRotation(token);
  assert.equal(r.valid, false);
  resetSecrets();
});

test('token firmado con un secreto AJENO se rechaza aun con rotación abierta', () => {
  resetSecrets();
  CONFIG.jwtSecret = CURRENT;
  CONFIG.jwtSecretPrevious = PREVIOUS;
  const token = signJwt(baseClaims(), FOREIGN, { expiresInSec: 3600 });
  const r = verifyJwtWithRotation(token);
  assert.equal(r.valid, false);
  resetSecrets();
});

test('signJwt aplica exp: un token ya expirado se rechaza', () => {
  const token = signJwt({ ...baseClaims(), exp: Math.floor(Date.now() / 1000) - 10 }, CURRENT);
  const r = verifyJwt(token, CURRENT);
  assert.equal(r.valid, false);
  assert.match(r.reason, /expirado/);
});

test('signJwt aplica nbf: un token aún no válido se rechaza', () => {
  const token = signJwt(baseClaims(), CURRENT, { expiresInSec: 3600, notBeforeSec: 3600 });
  const r = verifyJwt(token, CURRENT);
  assert.equal(r.valid, false);
  assert.match(r.reason, /nbf/);
});

test('signJwt exige secreto y payload objeto', () => {
  assert.throws(() => signJwt({ sub: 'x' }, ''));
  assert.throws(() => signJwt(null, CURRENT));
});
