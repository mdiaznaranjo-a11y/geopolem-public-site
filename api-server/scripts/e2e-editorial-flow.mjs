// GEOPÓLEM (Sprint 8) — E2E técnico del flujo editorial (sin navegador).
// ---------------------------------------------------------------------------
// Valida, de extremo a extremo y sin sockets, el circuito de datos:
//
//   (1) Payload editorial válido           → editorial-validation.mjs
//   (2) API admin (prepared/persistable)   → router.mjs (Sprint 7, modo prepared)
//   (3) Vista enriquecida a partir del eco → enriched-detail-view.mjs
//   (4) Export static check                → export-static-bridge.mjs (--check)
//   (5) JSON compatible con PWA/mapa        → forma que consume api-adapter.js
//
// Corre en Node puro (sin DB, sin red). Sale 0 si el circuito completo pasa; 1
// si algún paso falla, imprimiendo el motivo. Pensado para CI y para verificar
// la reversibilidad/compatibilidad sin tocar producción.
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const LIST_PATH = resolve(REPO_ROOT, 'api/v1/conflicts.json');
const MAP_PATH = resolve(REPO_ROOT, 'api/v1/conflicts/active/map.json');

// Sin DB: forzamos el modo estático/prepared del servidor.
delete process.env.DATABASE_URL;

const { validateEditorialConflict } = await import('../../admin/editorial-validation.mjs');
const { toEnrichedViewModel, hasAnyEnrichment } = await import('../../admin/enriched-detail-view.mjs');
const { validateBridge } = await import('./export-static-bridge.mjs');
const { CONFIG } = await import('../src/config.mjs');
CONFIG.obsLog = false;
const { route } = await import('../src/router.mjs');

const SECRET = 'e2e-sprint8-secret-hs256-suficientemente-largo';

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
  return signJwt({ sub: 'e2e', scope: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
}

function log(step, msg) { console.log(`[e2e] ${step}  ${msg}`); }
function fail(step, msg) { console.error(`[e2e] ✗ ${step}: ${msg}`); process.exit(1); }

const SAMPLE = {
  slug: 'e2e-conflicto-demo',
  name: 'Conflicto E2E de demostración',
  summary: 'Payload de prueba del flujo editorial Sprint 8.',
  country: 'Yemen',
  status: 'published',
  primary_region: 'mena',
  conflict_type: 'energia',
  intensity_level: 4,
  escalation_risk: 3,
  humanitarian_impact: 5,
  energy_dimension: true,
  territorial_dimension: false,
  external_involvement: true,
  location: { latitude: 12.6, longitude: 43.3 },
  actors: { state: ['Estado A'], non_state: ['Grupo B'] },
  resources: ['petróleo', 'gas'],
  chokepoints: ['Bab el-Mandeb'],
  causal_links: [{ from: 'bloqueo', to: 'subida-precios', relation: 'causes' }],
  sources: [{ title: 'Informe de referencia', url: 'https://ejemplo.org/informe' }],
};

async function main() {
  // (1) Validación editorial del payload.
  const v = validateEditorialConflict(SAMPLE, { partial: false });
  if (!v.valid) fail('paso 1 validación', JSON.stringify(v.errors));
  log('paso 1', `payload editorial válido (${Object.keys(v.value).length} campos normalizados).`);

  // (2) API admin en modo prepared (Sprint 7). Auth exigida siempre en /admin.
  CONFIG.authMode = 'public';
  CONFIG.jwtSecret = SECRET;
  CONFIG.adminWritesEnabled = false; // prepared: NO persiste (protege producción)
  const url = new URL('http://x/api/v1/admin/conflicts');
  const res = await route('POST', url.pathname, url.searchParams, {
    authorization: `Bearer ${adminToken()}`,
    body: SAMPLE,
  });
  if (res.status !== 200 && res.status !== 201) fail('paso 2 API admin', `status ${res.status}: ${JSON.stringify(res.body?.error || res.body?.meta)}`);
  if (res.body?.meta?.persisted !== false) fail('paso 2 API admin', 'se esperaba meta.persisted=false en modo prepared.');
  if (res.body?.meta?.mode !== 'prepared') fail('paso 2 API admin', `se esperaba meta.mode=prepared, got ${res.body?.meta?.mode}.`);
  if (res.body?.data?.cms_status !== 'published' || res.body?.data?.status !== 'active') {
    fail('paso 2 API admin', 'el mapeo editorial published→active no coincide.');
  }
  log('paso 2', `API admin OK (status ${res.status}, prepared, cms_status=published→status=active).`);

  // (3) Vista enriquecida a partir del eco + del detalle SAMPLE (relaciones).
  const vm = toEnrichedViewModel({ ...res.body.data, ...SAMPLE });
  if (!hasAnyEnrichment(vm)) fail('paso 3 enriched view', 'la vista enriquecida no detectó relaciones.');
  if (vm.actors.state.length !== 1 || vm.sources.length !== 1 || vm.causalLinks.length !== 1) {
    fail('paso 3 enriched view', 'las relaciones no se normalizaron como se esperaba.');
  }
  log('paso 3', `vista enriquecida OK (actors, resources, chokepoints, causal_links, sources presentes).`);

  // (4) Export static check: el puente en disco DEBE seguir válido (no lo tocamos).
  if (!existsSync(LIST_PATH) || !existsSync(MAP_PATH)) fail('paso 4 export check', 'faltan los JSON del puente estático.');
  const list = JSON.parse(readFileSync(LIST_PATH, 'utf8'));
  const map = JSON.parse(readFileSync(MAP_PATH, 'utf8'));
  const check = validateBridge(list, map);
  if (!check.ok) fail('paso 4 export check', check.errors.join('; '));
  log('paso 4', `puente estático válido (${list.data.length} conflictos, ${map.features.length} features).`);

  // (5) Compatibilidad con PWA/mapa: la forma que consume api-adapter.js.
  //     data[] con slug/name/location; map = FeatureCollection de Points.
  const first = list.data[0];
  const pwaCompatible = Array.isArray(list.data)
    && typeof first?.slug === 'string' && typeof first?.name === 'string'
    && first?.location && 'latitude' in first.location && 'longitude' in first.location
    && map.type === 'FeatureCollection' && Array.isArray(map.features);
  if (!pwaCompatible) fail('paso 5 compat PWA', 'el JSON no cumple la forma esperada por api-adapter.js.');
  log('paso 5', 'JSON compatible con PWA/mapa (adaptador y GeoJSON).');

  console.log('[e2e] ✓ circuito editorial completo: validación → admin(prepared) → enriched → export → PWA.');
  return 0;
}

main().then((c) => process.exit(c)).catch((e) => { console.error('[e2e] error no controlado:', e?.message || e); process.exit(1); });
