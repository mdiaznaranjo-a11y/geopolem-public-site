// GEOPÓLEM — Consumo de artefactos de STAGING (Sprint 16)
// ---------------------------------------------------------------------------
// Módulo PURO (testeable en Node, sin red ni navegador) que centraliza cómo se
// LEEN los artefactos enriquecidos de staging (`api/v1/staging/**`) y cómo se
// resuelve un detalle con degradación limpia hacia producción/local.
//
// Reglas de oro (heredadas de Sprint 15):
//   • STAGING no es producción: separado de `api/v1/conflicts/{id}.json`. Este
//     módulo sólo LEE staging; nunca escribe ni toca canónicos.
//   • Degradación limpia: staging → canónico estático → foco local (data.js).
//     Nunca lanza; siempre devuelve algo renderizable con su `source`.
//   • Sin almacenamiento: no usa localStorage/cookies. Alineado con deeplinks.
//
// Contratos de staging (Sprint 15):
//   • bundle: `sprint-15-staging-canonical-v1`  → api/v1/staging/conflicts.enriched.json
//   • detalle: envoltorio `{ data }` v1         → api/v1/staging/conflicts/{id}.json
//   • mapa:   `sprint-15-staging-map-v1`        → api/v1/staging/conflicts/active/map.enriched.json
//   • cobertura:                                → api/v1/staging/coverage-report.json
// ---------------------------------------------------------------------------

export const STAGING_BASE = 'api/v1/staging';
export const STAGING_BUNDLE_CONTRACT = 'sprint-15-staging-canonical-v1';
export const STAGING_MAP_CONTRACT = 'sprint-15-staging-map-v1';

// Rutas relativas (publicables junto al sitio, compatibles con GitHub Pages).
export function stagingBundlePath() {
  return `${STAGING_BASE}/conflicts.enriched.json`;
}
export function stagingDetailPath(idOrSlug) {
  return `${STAGING_BASE}/conflicts/${encodeURIComponent(String(idOrSlug ?? ''))}.json`;
}
export function stagingMapPath() {
  return `${STAGING_BASE}/conflicts/active/map.enriched.json`;
}
export function stagingCoveragePath() {
  return `${STAGING_BASE}/coverage-report.json`;
}

// Ruta canónica de producción por conflicto (respaldo, NO staging).
export function canonicalDetailPath(idOrSlug) {
  return `api/v1/conflicts/${encodeURIComponent(String(idOrSlug ?? ''))}.json`;
}

// Quita el envoltorio `{ data }` habitual de los artefactos v1.
export function unwrap(payload) {
  if (payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object') {
    return payload.data;
  }
  return payload;
}

// ¿Este pathname lo cachea el service-worker como "puente estático" (Sprint 11)?
// Es el MISMO criterio que `isStaticBridgeJson` en service-worker.js: cualquier
// `.json` bajo `/api/v1/` — lo que incluye `api/v1/staging/**`. Se replica aquí
// (fuente única de verdad testeable) porque el SW no es un módulo importable.
export function isCacheableBridgeJson(pathname) {
  const p = typeof pathname === 'string' ? pathname : '';
  return /\/api\/v1\/.+\.json$/.test(p);
}

// ¿La ruta pertenece al árbol de staging?
export function isStagingPath(pathname) {
  const p = typeof pathname === 'string' ? pathname : '';
  return /\/api\/v1\/staging\/.+\.json$/.test(p) || p.startsWith(`${STAGING_BASE}/`);
}

/* --------------------------------------------------------------------------
   resolveStagingDetail: resuelve un detalle con degradación limpia.

   Inyección de dependencias (todas OPCIONALES) para poder testear sin red:
     • loadStaging(id)   → devuelve el JSON de staging (o null / lanza).
     • loadCanonical(id) → devuelve el JSON canónico estático (o null / lanza).
     • localFoco         → objeto foco de data.js como último respaldo.

   Devuelve SIEMPRE { detail, source, error } con
     source ∈ 'staging' | 'canonical' | 'local' | 'none'.
   Nunca lanza: los errores de cada paso se capturan y se degrada al siguiente.
-------------------------------------------------------------------------- */
export async function resolveStagingDetail(idOrSlug, options = {}) {
  const id = String(idOrSlug ?? '').trim();
  const loadStaging = typeof options.loadStaging === 'function' ? options.loadStaging : null;
  const loadCanonical = typeof options.loadCanonical === 'function' ? options.loadCanonical : null;
  const localFoco = options.localFoco || null;
  let lastError = null;

  if (id && loadStaging) {
    try {
      const raw = unwrap(await loadStaging(id));
      if (raw && typeof raw === 'object') return { detail: raw, source: 'staging', error: null };
    } catch (err) {
      lastError = err;
    }
  }

  if (id && loadCanonical) {
    try {
      const raw = unwrap(await loadCanonical(id));
      if (raw && typeof raw === 'object') return { detail: raw, source: 'canonical', error: null };
    } catch (err) {
      lastError = err;
    }
  }

  if (localFoco && typeof localFoco === 'object') {
    return { detail: localFoco, source: 'local', error: lastError };
  }

  return { detail: null, source: 'none', error: lastError };
}

/* --------------------------------------------------------------------------
   validateStagingBundle: valida que el bundle de staging es consumible.
   Devuelve { ok, errors } (nunca lanza).
-------------------------------------------------------------------------- */
export function validateStagingBundle(bundle) {
  const errors = [];
  const fail = (m) => errors.push(m);
  if (!bundle || typeof bundle !== 'object') { fail('bundle: no es objeto'); return { ok: false, errors }; }
  if (bundle.contract !== STAGING_BUNDLE_CONTRACT) fail(`bundle: contract != ${STAGING_BUNDLE_CONTRACT}`);
  if (bundle.staging !== true) fail('bundle: staging != true');
  if (bundle.canonical !== false) fail('bundle: canonical != false (staging NO es producción)');
  if (!bundle.gate || typeof bundle.gate !== 'object') fail('bundle: falta gate');
  else if (bundle.gate.ok !== true) fail('bundle: gate.ok != true');
  const data = bundle.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('bundle: data no es mapa de conflictos');
  else {
    const ids = Object.keys(data);
    if (ids.length === 0) fail('bundle: data vacío');
    for (const id of ids) {
      const c = data[id];
      if (!c || c.id !== id) fail(`bundle: data["${id}"].id incoherente`);
      if (typeof c?.name !== 'string' || !c.name) fail(`bundle: ${id} sin name`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/* --------------------------------------------------------------------------
   validateStagingMap: valida el mapa enriquecido de staging (contrato v1).
-------------------------------------------------------------------------- */
export function validateStagingMap(map) {
  const errors = [];
  const fail = (m) => errors.push(m);
  if (!map || typeof map !== 'object') { fail('map: no es objeto'); return { ok: false, errors }; }
  if (map.type !== 'FeatureCollection') fail('map: type != FeatureCollection');
  if (!Array.isArray(map.features)) { fail('map: features no es array'); return { ok: false, errors }; }
  if (map.features.length === 0) fail('map: sin features');
  for (const f of map.features) {
    const geomOk = f?.type === 'Feature'
      && f.geometry?.type === 'Point'
      && Array.isArray(f.geometry.coordinates)
      && f.geometry.coordinates.length === 2;
    const propsOk = typeof f?.properties?.slug === 'string'
      && typeof f.properties.id === 'string'
      && 'has_verified_source' in f.properties
      && 'needs_human_review' in f.properties;
    if (!geomOk || !propsOk) { fail(`map: feature inválida (${f?.properties?.id ?? '?'})`); break; }
  }
  return { ok: errors.length === 0, errors };
}

/* --------------------------------------------------------------------------
   validateCoverageReport: valida el reporte de cobertura de staging.
-------------------------------------------------------------------------- */
export function validateCoverageReport(report) {
  const errors = [];
  const fail = (m) => errors.push(m);
  if (!report || typeof report !== 'object') { fail('coverage: no es objeto'); return { ok: false, errors }; }
  if (!report.gate || typeof report.gate !== 'object') fail('coverage: falta gate');
  else {
    if (typeof report.gate.coverage_pct !== 'number') fail('coverage: gate.coverage_pct no numérico');
    if (report.gate.ok !== true) fail('coverage: gate.ok != true');
  }
  if (!report.after || typeof report.after.conflicts_with_sources !== 'number') {
    fail('coverage: falta after.conflicts_with_sources');
  }
  if (!Array.isArray(report.review_flags)) fail('coverage: review_flags no es array');
  return { ok: errors.length === 0, errors };
}
