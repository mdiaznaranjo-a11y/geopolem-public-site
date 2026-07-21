// GEOPÓLEM API v1 (Sprint 6) — verificación de promoción a staging.
// ---------------------------------------------------------------------------
// Comprueba, contra un api-server YA DESPLEGADO, que el entorno de staging está
// realmente sirviendo desde la base de datos y con la postura de seguridad
// esperada, SIN requerir secretos en el repositorio: sólo consume los endpoints
// públicos de observabilidad (/health, /metrics) y las rutas de datos.
//
// A diferencia de validate-staging.mjs (que puede tocar la DB directamente y/o
// arrancar un servidor en fallback), este script es un "smoke de promoción":
// se ejecuta contra la URL pública de staging y decide GO / NO-GO.
//
// Uso:
//   API_BASE=https://staging-api.geopolem.com node scripts/staging-verify.mjs
//
// Variables opcionales:
//   EXPECT_SOURCE=database   → exige que los datos vengan de la DB (por defecto).
//                              Usa "static" para aceptar el modo fallback.
//   MIN_DB_RATIO=0.9         → ratio mínimo de respuestas servidas por la DB.
//   EXPECT_AUTH=optional     → modo de auth esperado (informativo): comprueba
//                              que /health es público y, si "required", que
//                              /conflicts responde 401 sin token.
//   BEARER=<jwt>             → si se define, valida acceso autenticado.
//
// Sale con código != 0 si alguna comprobación crítica falla (apto para CI/CD).
// ---------------------------------------------------------------------------

const API_BASE = process.env.API_BASE || '';
const EXPECT_SOURCE = (process.env.EXPECT_SOURCE || 'database').toLowerCase();
const MIN_DB_RATIO = Number(process.env.MIN_DB_RATIO ?? 0.9);
const EXPECT_AUTH = (process.env.EXPECT_AUTH || '').toLowerCase();
const BEARER = process.env.BEARER || '';

let failures = 0;
let checks = 0;
function check(name, cond, detail) {
  checks++;
  const ok = !!cond;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? `  — ${detail}` : ''}`);
  if (!ok) failures++;
}
function info(msg) { console.log(`····  ${msg}`); }

async function getJson(path, headers = {}) {
  const res = await fetch(`${API_BASE}${path}`, { headers });
  const contentType = res.headers.get('content-type') || '';
  let body = null;
  try { body = await res.json(); } catch { /* no-JSON */ }
  return { status: res.status, body, contentType };
}

async function getText(path, headers = {}) {
  const res = await fetch(`${API_BASE}${path}`, { headers });
  return { status: res.status, text: await res.text(), contentType: res.headers.get('content-type') || '' };
}

if (!API_BASE) {
  console.error('ERROR: define API_BASE con la URL pública del api-server de staging.');
  console.error('Ej: API_BASE=https://staging-api.geopolem.com node scripts/staging-verify.mjs');
  process.exit(2);
}

console.log(`GEOPÓLEM — staging-verify  (API_BASE=${API_BASE})\n`);

// 1) Salud y origen activo -----------------------------------------------------
const health = await getJson('/api/v1/health');
check('health: 200', health.status === 200, `status=${health.status}`);
check('health: status ok', health.body?.data?.status === 'ok');
const activeSource = health.body?.data?.active_source;
const dbState = health.body?.data?.database;
info(`active_source=${activeSource} database=${dbState} postgis=${health.body?.data?.postgis}`);

if (EXPECT_SOURCE === 'database') {
  check('health: database reachable', dbState === 'reachable',
    'DATABASE_URL apuntando a staging pero la DB no es alcanzable');
  check('health: active_source=database', activeSource === 'database');
}

// 2) Ratio de origen (observabilidad Sprint 5/6) ------------------------------
const ratioBefore = health.body?.data?.observability?.database_ratio;
info(`database_ratio (histórico del proceso)=${ratioBefore}`);

// 3) Rutas principales ---------------------------------------------------------
const conflicts = await getJson('/api/v1/conflicts?page=1&page_size=5');
check('conflicts: 200 y data no vacía',
  conflicts.status === 200 && Array.isArray(conflicts.body?.data) && conflicts.body.data.length > 0);
const cSource = conflicts.body?.meta?.source;
info(`conflicts meta.source=${cSource}`);
if (EXPECT_SOURCE === 'database') check('conflicts: source=database', cSource === 'database');

const map = await getJson('/api/v1/conflicts/active/map');
check('map: FeatureCollection', map.body?.type === 'FeatureCollection');
check('map: content-type geo+json', /geo\+json/.test(map.contentType));

const filters = await getJson('/api/v1/filters');
check('filters: regiones presentes',
  Array.isArray(filters.body?.data?.regions) && filters.body.data.regions.length > 0);

const slug = conflicts.body?.data?.[0]?.slug;
if (slug) {
  const detail = await getJson(`/api/v1/conflicts/${encodeURIComponent(slug)}`);
  check('detail: 200 y slug coincide', detail.status === 200 && detail.body?.data?.slug === slug);
  check('detail: shape enriquecido (actors/resources/chokepoints/causal_links)',
    !!detail.body?.data?.actors && Array.isArray(detail.body?.data?.resources)
    && Array.isArray(detail.body?.data?.chokepoints) && Array.isArray(detail.body?.data?.causal_links));
}

// 4) Métricas Prometheus -------------------------------------------------------
const metrics = await getText('/api/v1/metrics');
check('metrics: 200', metrics.status === 200, `status=${metrics.status}`);
check('metrics: formato Prometheus', /geopolem_requests_total/.test(metrics.text));
const ratioMatch = metrics.text.match(/geopolem_database_source_ratio\s+([0-9.]+)/);
if (ratioMatch) {
  const ratio = Number(ratioMatch[1]);
  info(`geopolem_database_source_ratio=${ratio}`);
  if (EXPECT_SOURCE === 'database') {
    check(`metrics: database_source_ratio >= ${MIN_DB_RATIO}`, ratio >= MIN_DB_RATIO,
      `ratio=${ratio} — la DB no está sirviendo la mayoría del tráfico`);
  }
}

// 5) Postura de autenticación --------------------------------------------------
if (EXPECT_AUTH) {
  info(`EXPECT_AUTH=${EXPECT_AUTH}`);
  const healthPublic = await getJson('/api/v1/health');
  check('auth: /health SIEMPRE público', healthPublic.status === 200);

  if (EXPECT_AUTH === 'required') {
    const anon = await getJson('/api/v1/conflicts');
    check('auth required: /conflicts sin token → 401', anon.status === 401, `status=${anon.status}`);
    if (BEARER) {
      const authed = await getJson('/api/v1/conflicts', { Authorization: `Bearer ${BEARER}` });
      check('auth required: /conflicts con token → 200', authed.status === 200, `status=${authed.status}`);
    } else {
      info('BEARER no definido: se omite la comprobación de acceso autenticado.');
    }
  } else if (EXPECT_AUTH === 'optional') {
    const anon = await getJson('/api/v1/conflicts');
    check('auth optional: /conflicts sin token → 200', anon.status === 200, `status=${anon.status}`);
    if (BEARER) {
      const authed = await getJson('/api/v1/conflicts', { Authorization: `Bearer ${BEARER}` });
      check('auth optional: /conflicts con token válido → 200', authed.status === 200);
    }
  }
}

console.log(`\n${failures === 0 ? 'GO' : 'NO-GO'}: ${failures}/${checks} comprobación(es) crítica(s) fallida(s).`);
process.exit(failures === 0 ? 0 : 1);
