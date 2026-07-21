// GEOPÓLEM API v1 (Sprint 7) — CLI de emisión de JWT (scripts/issue-jwt.mjs).
// ---------------------------------------------------------------------------
// Ejercita el CLI como subproceso (contrato real de operación):
//   • Sin JWT_SECRET en el entorno → error, no emite y no filtra secreto.
//   • Con secreto + --sub → emite un token que verifyJwt del servidor acepta.
//   • --scope/--ttl/--iss/--aud se reflejan en los claims.
//   • El secreto NUNCA aparece en stdout/stderr.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, '../scripts/issue-jwt.mjs');
const SECRET = 'secreto-cli-hs256-suficientemente-largo-para-test';

const { verifyJwt } = await import('../src/auth.mjs');

function run(args, env = {}) {
  return new Promise((res) => {
    execFile('node', [SCRIPT, ...args], {
      env: { ...process.env, ...env },
    }, (error, stdout, stderr) => {
      res({ code: error ? error.code ?? 1 : 0, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

test('sin JWT_SECRET → error, no emite token', async () => {
  const { code, stdout, stderr } = await run(['--sub', 'ops', '--scope', 'admin'], { JWT_SECRET: '' });
  assert.notEqual(code, 0);
  assert.equal(stdout, '');
  assert.match(stderr, /JWT_SECRET/);
});

test('sin --sub → error de uso', async () => {
  const { code, stderr } = await run(['--scope', 'admin'], { JWT_SECRET: SECRET });
  assert.notEqual(code, 0);
  assert.match(stderr, /--sub/);
});

test('emite un token que el servidor (verifyJwt) acepta', async () => {
  const { code, stdout, stderr } = await run(
    ['--sub', 'ops@geopolem', '--scope', 'admin', '--ttl', '3600'],
    { JWT_SECRET: SECRET },
  );
  assert.equal(code, 0);
  const token = stdout;
  const r = verifyJwt(token, SECRET);
  assert.equal(r.valid, true);
  assert.equal(r.payload.sub, 'ops@geopolem');
  assert.equal(r.payload.scope, 'admin');
  assert.ok(r.payload.exp > r.payload.iat);
  // El secreto no debe aparecer en ninguna salida.
  assert.equal(stdout.includes(SECRET), false);
  assert.equal(stderr.includes(SECRET), false);
});

test('--iss/--aud/--jti se reflejan en los claims y se validan', async () => {
  const { code, stdout } = await run(
    ['--sub', 'ed', '--scope', 'cms:write', '--iss', 'geopolem', '--aud', 'geopolem-api', '--jti', 'abc-123'],
    { JWT_SECRET: SECRET },
  );
  assert.equal(code, 0);
  const r = verifyJwt(stdout, SECRET, { issuer: 'geopolem', audience: 'geopolem-api' });
  assert.equal(r.valid, true);
  assert.equal(r.payload.iss, 'geopolem');
  assert.equal(r.payload.aud, 'geopolem-api');
  assert.equal(r.payload.jti, 'abc-123');
});

test('--json imprime {token, claims} parseable', async () => {
  const { code, stdout } = await run(
    ['--sub', 'ops', '--scope', 'admin', '--json'],
    { JWT_SECRET: SECRET },
  );
  assert.equal(code, 0);
  const parsed = JSON.parse(stdout);
  assert.ok(parsed.token && parsed.claims);
  assert.equal(parsed.claims.sub, 'ops');
  const r = verifyJwt(parsed.token, SECRET);
  assert.equal(r.valid, true);
});
