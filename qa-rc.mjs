// GEOPÓLEM — QA funcional del Release Candidate (Sprint 19)
// ---------------------------------------------------------------------------
// Módulo PURO (sin red ni navegador; la IO se inyecta) que valida los CONTRATOS
// de las rutas clave de la PWA consumiendo el RC/staging, y comprueba la
// elegibilidad PWA/offline. Es la QA que corre SIEMPRE en CI (sin dependencias
// pesadas); un QA visual con navegador (Playwright) es OPT-IN y complementario.
//
// Rutas clave cubiertas (contratos, no píxeles):
//   • home      — app-shell presente y cacheable (index + app.js + SW + manifest).
//   • map       — mapa enriquecido de staging consumible (FeatureCollection).
//   • ficha     — detalle por conflicto resoluble (envoltorio {data}).
//   • deep-link — #foco={id} parsea a focus e ida-vuelta estable.
//   • filtros   — claves de filtro parsean y serializan de forma estable.
//
// PWA/offline:
//   • Elegibilidad de caché del service-worker para RC/staging (/api/v1/*.json).
//   • Degradación limpia staging → canónico → local (resolveStagingDetail).
//   • Compatibilidad GitHub Pages: rutas relativas, .nojekyll, manifest.
// ---------------------------------------------------------------------------

import {
  parseDeepLink, serializeDeepLink, deepLinkEquals, FILTER_KEYS,
} from './deeplinks.mjs';
import {
  isCacheableBridgeJson, resolveStagingDetail, validateStagingMap,
  stagingBundlePath, stagingDetailPath, stagingMapPath,
} from './staging-consume.mjs';
import { rcManifestPath } from './rc-package.mjs';

export const QA_RC_CONTRACT = 'sprint-19-qa-rc-v1';

// App-shell mínimo que la PWA debe poder servir offline (subconjunto del
// APP_SHELL del service-worker; fuente de verdad testeable).
export const REQUIRED_APP_SHELL = ['./index.html', './app.js', './service-worker.js', './manifest.webmanifest'];

function ok(name, extra = {}) { return { name, ok: true, ...extra }; }
function ko(name, reason, extra = {}) { return { name, ok: false, reason, ...extra }; }

/* ---------------------------- rutas clave -------------------------------- */

// home: el app-shell existe (fileExists inyectado) y sus JSON de puente serían
// cacheables offline. No renderiza; valida el contrato de disponibilidad.
export function checkHomeRoute({ fileExists = () => false } = {}) {
  const checks = [];
  for (const rel of REQUIRED_APP_SHELL) {
    const clean = rel.replace(/^\.\//, '');
    checks.push(fileExists(clean) ? ok(`shell:${clean}`) : ko(`shell:${clean}`, 'ausente'));
  }
  // El manifiesto RC y el bundle de staging deben ser cacheables por el SW.
  for (const rel of [rcManifestPath(), stagingBundlePath()]) {
    checks.push(isCacheableBridgeJson(`/${rel}`) ? ok(`cacheable:${rel}`) : ko(`cacheable:${rel}`, 'no cacheable por el SW'));
  }
  return { route: 'home', ok: checks.every((c) => c.ok), checks };
}

// map: el mapa enriquecido de staging es consumible (contrato FeatureCollection).
export function checkMapRoute({ loadMap } = {}) {
  const checks = [];
  let map = null;
  try { map = typeof loadMap === 'function' ? loadMap() : null; } catch (e) { return { route: 'map', ok: false, checks: [ko('load', e.message)] }; }
  if (!map) return { route: 'map', ok: false, checks: [ko('load', 'mapa de staging ausente')] };
  const res = validateStagingMap(map);
  checks.push(res.ok ? ok('map-contract', { features: (map.features || []).length }) : ko('map-contract', res.errors.join('; ')));
  return { route: 'map', ok: checks.every((c) => c.ok), checks };
}

// ficha: cada detalle referenciado resuelve vía staging (degradación limpia).
export async function checkDetailRoute({ ids = [], loadStaging } = {}) {
  const checks = [];
  for (const id of ids) {
    const { detail, source } = await resolveStagingDetail(id, { loadStaging });
    if (detail && source === 'staging') checks.push(ok(`ficha:${id}`, { source }));
    else checks.push(ko(`ficha:${id}`, `no resuelto desde staging (source=${source})`));
  }
  return { route: 'ficha', ok: checks.length > 0 && checks.every((c) => c.ok), checks };
}

// deep-link: #foco={id} parsea a focus e ida-vuelta estable.
export function checkDeepLinkRoute({ ids = [] } = {}) {
  const checks = [];
  for (const id of ids) {
    const state = parseDeepLink(`#foco=${id}`);
    const roundtrip = parseDeepLink(serializeDeepLink({ focus: id }));
    const good = state.focus === id && roundtrip.focus === id;
    checks.push(good ? ok(`deeplink:${id}`) : ko(`deeplink:${id}`, `focus=${state.focus}`));
  }
  // view+foco+filtro combinados.
  const combo = { view: 'map', focus: ids[0] || 'ukr-rus', filters: { region: 'MENA', severity: 4 } };
  const back = parseDeepLink(serializeDeepLink(combo));
  const comboOk = back.focus === combo.focus && back.filters.region === 'MENA' && back.filters.severity === 4;
  checks.push(comboOk ? ok('deeplink:combo') : ko('deeplink:combo', JSON.stringify(back)));
  return { route: 'deep-link', ok: checks.every((c) => c.ok), checks };
}

// filtros: cada clave de filtro parsea y serializa de forma estable e idempotente.
export function checkFiltersRoute() {
  const checks = [];
  const sample = { region: 'MENA', type: 'agua', status: 'active', severity: 3, resource: 'Petroleo', actor: 'OTAN', chokepoint: 'Ormuz' };
  for (const key of FILTER_KEYS) {
    const value = sample[key];
    const parsed = parseDeepLink(serializeDeepLink({ filters: { [key]: value } }));
    const got = parsed.filters[key];
    const good = String(got) === String(value);
    checks.push(good ? ok(`filtro:${key}`) : ko(`filtro:${key}`, `esperado ${value}, obtenido ${got}`));
  }
  // 'all' y vacíos se omiten (degradación limpia).
  const empty = parseDeepLink(serializeDeepLink({ filters: { region: 'all', type: '' } }));
  checks.push(Object.keys(empty.filters).length === 0 ? ok('filtro:omite-vacios') : ko('filtro:omite-vacios', JSON.stringify(empty.filters)));
  // Idempotencia de serialización.
  const once = serializeDeepLink({ view: 'map', filters: sample });
  const twice = serializeDeepLink(parseDeepLink(once));
  checks.push(deepLinkEquals(parseDeepLink(once), parseDeepLink(twice)) ? ok('filtro:idempotente') : ko('filtro:idempotente', 'roundtrip inestable'));
  return { route: 'filtros', ok: checks.every((c) => c.ok), checks };
}

/* ---------------------------- PWA / offline ------------------------------ */

// Elegibilidad de caché del SW + degradación limpia + compatibilidad Pages.
export function checkPwaOffline({ fileExists = () => false, ids = [] } = {}) {
  const checks = [];
  // 1) Todos los JSON del RC/staging son cacheables por el SW.
  const cacheable = [rcManifestPath(), stagingBundlePath(), stagingMapPath(), ...ids.map((id) => stagingDetailPath(id))];
  for (const rel of cacheable) {
    checks.push(isCacheableBridgeJson(`/${rel}`) ? ok(`cache:${rel}`) : ko(`cache:${rel}`, 'no cacheable'));
  }
  // 2) La ruta dinámica de la API NO debe cachearse como puente (sólo /api/v1/*.json).
  checks.push(!isCacheableBridgeJson('/api/v1/health') ? ok('cache:health-solo-red') : ko('cache:health-solo-red', 'health no debe cachearse'));
  // 3) Compatibilidad GitHub Pages: .nojekyll y manifest presentes.
  checks.push(fileExists('.nojekyll') ? ok('pages:nojekyll') : ko('pages:nojekyll', 'falta .nojekyll'));
  checks.push(fileExists('manifest.webmanifest') ? ok('pages:manifest') : ko('pages:manifest', 'falta manifest'));
  // 4) El RC vive bajo api/v1/rc/ (relativo, sin rutas absolutas del host).
  checks.push(/^api\/v1\/rc\//.test(rcManifestPath()) ? ok('pages:rc-relativo') : ko('pages:rc-relativo', 'ruta RC no relativa'));
  return { route: 'pwa-offline', ok: checks.every((c) => c.ok), checks };
}

// Degradación limpia sin red: cuando staging falla, cae a canónico; si no, a local.
export async function checkOfflineFallback() {
  const checks = [];
  // staging OK.
  const a = await resolveStagingDetail('x', { loadStaging: () => ({ data: { id: 'x' } }) });
  checks.push(a.source === 'staging' ? ok('fallback:staging') : ko('fallback:staging', a.source));
  // staging cae → canónico.
  const b = await resolveStagingDetail('x', { loadStaging: () => { throw new Error('sin red'); }, loadCanonical: () => ({ data: { id: 'x' } }) });
  checks.push(b.source === 'canonical' ? ok('fallback:canonical') : ko('fallback:canonical', b.source));
  // todo cae → local.
  const c = await resolveStagingDetail('x', { loadStaging: () => { throw new Error('sin red'); }, loadCanonical: () => { throw new Error('sin red'); }, localFoco: { id: 'x' } });
  checks.push(c.source === 'local' ? ok('fallback:local') : ko('fallback:local', c.source));
  // sin nada → 'none' (no lanza).
  const d = await resolveStagingDetail('x', {});
  checks.push(d.source === 'none' && d.detail === null ? ok('fallback:none-no-lanza') : ko('fallback:none-no-lanza', d.source));
  return { route: 'offline-fallback', ok: checks.every((c) => c.ok), checks };
}

/* ---------------------------- orquestación ------------------------------- */

// Ejecuta toda la QA funcional del RC y devuelve un reporte determinista.
export async function runQaContracts({ fileExists, loadMap, loadStaging, ids = [], generatedAt = null } = {}) {
  const routes = [
    checkHomeRoute({ fileExists }),
    checkMapRoute({ loadMap }),
    await checkDetailRoute({ ids, loadStaging }),
    checkDeepLinkRoute({ ids }),
    checkFiltersRoute(),
    checkPwaOffline({ fileExists, ids }),
    await checkOfflineFallback(),
  ];
  const passed = routes.filter((r) => r.ok).length;
  return {
    contract: QA_RC_CONTRACT,
    generated_at: generatedAt,
    browser: false,
    note: 'QA funcional del RC sin navegador (contratos de ruta + PWA/offline). El QA visual con Playwright es opt-in y complementario.',
    summary: { total: routes.length, passed, failed: routes.length - passed },
    ok: routes.every((r) => r.ok),
    routes,
  };
}
