// GEOPÓLEM (Sprint 8) — E2E de integración del flujo editorial (sin sockets/DB).
// ---------------------------------------------------------------------------
// Circuito completo dentro de `npm test`:
//   payload editorial válido → API admin (prepared) → vista enriquecida →
//   puente estático válido → forma compatible con la PWA/mapa.
// No persiste, no toca la red, no modifica los JSON del puente.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

delete process.env.DATABASE_URL;

const { validateEditorialConflict, toServerWritePayload } = await import('../../admin/editorial-validation.mjs');
const { toEnrichedViewModel, hasAnyEnrichment } = await import('../../admin/enriched-detail-view.mjs');
const { validateBridge } = await import('../scripts/export-static-bridge.mjs');
const { CONFIG } = await import('../src/config.mjs');
CONFIG.obsLog = false;
const { route } = await import('../src/router.mjs');

const SECRET = 'e2e-test-secret-hs256-suficientemente-largo';
function b64url(b) { return Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }
function token() {
  const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64url(JSON.stringify({ sub: 'e2e', scope: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 }));
  const s = b64url(createHmac('sha256', SECRET).update(`${h}.${p}`).digest());
  return `${h}.${p}.${s}`;
}

const SAMPLE = {
  slug: 'e2e-test-foco', name: 'Foco E2E', summary: 'demo', country: 'Yemen',
  status: 'published', primary_region: 'mena', conflict_type: 'energia',
  intensity_level: 4, escalation_risk: 3, humanitarian_impact: 5,
  energy_dimension: true, location: { latitude: 12.6, longitude: 43.3 },
  actors: { state: ['Estado A'], non_state: ['Grupo B'] },
  resources: ['petróleo'], chokepoints: ['Bab el-Mandeb'],
  causal_links: [{ from: 'bloqueo', to: 'precios', relation: 'causes' }],
  sources: [{ title: 'Informe', url: 'https://ejemplo.org/x' }],
};

test('E2E paso 1: validación editorial pasa', () => {
  const r = validateEditorialConflict(SAMPLE, { partial: false });
  assert.equal(r.valid, true);
  assert.ok('slug' in toServerWritePayload(r.value));
});

test('E2E paso 2: API admin devuelve prepared sin persistir', async () => {
  CONFIG.authMode = 'public';
  CONFIG.jwtSecret = SECRET;
  CONFIG.adminWritesEnabled = false;
  const url = new URL('http://x/api/v1/admin/conflicts');
  const res = await route('POST', url.pathname, url.searchParams, { authorization: `Bearer ${token()}`, body: SAMPLE });
  assert.equal(res.status, 200);
  assert.equal(res.body.meta.persisted, false);
  assert.equal(res.body.meta.mode, 'prepared');
  assert.equal(res.body.data.cms_status, 'published');
  assert.equal(res.body.data.status, 'active');
  CONFIG.jwtSecret = '';
});

test('E2E paso 3: vista enriquecida detecta todas las relaciones', () => {
  const vm = toEnrichedViewModel(SAMPLE);
  assert.equal(hasAnyEnrichment(vm), true);
  assert.equal(vm.actors.state.length, 1);
  assert.equal(vm.sources.length, 1);
  assert.equal(vm.causalLinks.length, 1);
});

test('E2E paso 4-5: puente estático válido y compatible con PWA', () => {
  const list = JSON.parse(readFileSync(resolve(REPO_ROOT, 'api/v1/conflicts.json'), 'utf8'));
  const map = JSON.parse(readFileSync(resolve(REPO_ROOT, 'api/v1/conflicts/active/map.json'), 'utf8'));
  const check = validateBridge(list, map);
  assert.equal(check.ok, true, check.errors.join('; '));
  const first = list.data[0];
  assert.equal(typeof first.slug, 'string');
  assert.equal(typeof first.name, 'string');
  assert.ok('latitude' in first.location && 'longitude' in first.location);
  assert.equal(map.type, 'FeatureCollection');
});
