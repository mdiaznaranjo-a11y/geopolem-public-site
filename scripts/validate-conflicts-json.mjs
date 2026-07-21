// GEOPÓLEM — Validación del puente estático de conflictos (Sprint 2).
// ---------------------------------------------------------------------------
// Ejecuta:  node scripts/validate-conflicts-json.mjs
//
// Verifica, sin navegador ni dependencias:
//   1. Forma del contrato v1 en `api/v1/conflicts.json` (data + pagination).
//   2. Cada ConflictListItem tiene los campos esperados y tipos correctos.
//   3. Round-trip real a través del adaptador Sprint 1: cargar el JSON con
//      GEOP_USE_API=true + GEOP_CONFLICTS_STATIC devuelve los MISMOS focos
//      (id/región/categoría/intensidad/coords) que `data.js` local.
//   4. El GeoJSON de mapa (`active/map.json`) es una FeatureCollection válida.
//
// Sale con código != 0 si algo falla (apto para CI/precheck).
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

let failures = 0;
function check(name, cond) {
  const ok = !!cond;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failures++;
}

function readJson(rel) {
  return JSON.parse(readFileSync(resolve(repoRoot, rel), 'utf8'));
}

// --- 1. Contrato de lista ---------------------------------------------------
const list = readJson('api/v1/conflicts.json');
check('conflicts.json: data es array', Array.isArray(list.data));
check('conflicts.json: no vacío', list.data.length > 0);
check('conflicts.json: pagination.total = data.length', list.pagination?.total === list.data.length);
check('conflicts.json: meta.api_version = v1', list.meta?.api_version === 'v1');

const REQUIRED_FIELDS = [
  'id', 'slug', 'name', 'summary', 'conflict_type', 'primary_region',
  'status', 'intensity_level', 'escalation_risk', 'humanitarian_impact',
  'energy_dimension', 'territorial_dimension', 'external_involvement',
  'location', 'updated_at',
];

const seenSlugs = new Set();
let fieldsOk = true;
let typesOk = true;
let slugsUnique = true;
for (const c of list.data) {
  for (const f of REQUIRED_FIELDS) {
    if (!(f in c)) { fieldsOk = false; console.log(`   falta campo "${f}" en ${c.id}`); }
  }
  if (typeof c.id !== 'string' || typeof c.slug !== 'string' || typeof c.name !== 'string') typesOk = false;
  if (c.conflict_type && typeof c.conflict_type.slug !== 'string') typesOk = false;
  if (c.primary_region && typeof c.primary_region.label !== 'string') typesOk = false;
  if (c.intensity_level != null && !(Number.isFinite(c.intensity_level) && c.intensity_level >= 1 && c.intensity_level <= 5)) typesOk = false;
  if (typeof c.energy_dimension !== 'boolean') typesOk = false;
  if (!c.location || (c.location.latitude != null && typeof c.location.latitude !== 'number')) typesOk = false;
  if (seenSlugs.has(c.slug)) slugsUnique = false;
  seenSlugs.add(c.slug);
}
check('conflicts.json: todos los campos requeridos presentes', fieldsOk);
check('conflicts.json: tipos correctos (id/slug/name/intensity/energy/location)', typesOk);
check('conflicts.json: slugs únicos', slugsUnique);

// --- 2. GeoJSON de mapa -----------------------------------------------------
const map = readJson('api/v1/conflicts/active/map.json');
check('map.json: type = FeatureCollection', map.type === 'FeatureCollection');
check('map.json: features es array', Array.isArray(map.features));
const geomOk = map.features.every(
  (f) => f.type === 'Feature' &&
    f.geometry?.type === 'Point' &&
    Array.isArray(f.geometry.coordinates) &&
    f.geometry.coordinates.length === 2 &&
    typeof f.properties?.slug === 'string',
);
check('map.json: features con geometría Point [lng,lat] válida', geomOk);

// --- 3. Round-trip a través del adaptador Sprint 1 --------------------------
// Simula entorno navegador y `fetch` sirviendo el JSON estático desde disco.
globalThis.window = globalThis.window || {};
window.GEOP_USE_API = true;
window.GEOP_CONFLICTS_STATIC = 'api/v1/conflicts.json';

globalThis.fetch = async (url) => {
  // El adaptador primero intenta la API "en vivo"; la hacemos fallar para
  // forzar el paso al respaldo estático, que servimos desde disco.
  const u = String(url);
  if (u.endsWith('api/v1/conflicts.json')) {
    return { ok: true, status: 200, json: async () => list };
  }
  throw new Error('sin backend en validación (forzando estático)');
};

const { loadWatchlistFocos, ADAPTER_CONFIG } = await import('../api-adapter.js');
ADAPTER_CONFIG.useApi = true;
ADAPTER_CONFIG.staticFallbackPath = 'api/v1/conflicts.json';

const { FOCOS } = await import('../data.js');
const res = await loadWatchlistFocos({ localFocos: FOCOS });

check('adaptador: source = static', res.source === 'static');
check('adaptador: mismo número de focos que data.js', res.focos.length === FOCOS.length);

// Comparación campo a campo del round-trip contra data.js local.
const localById = new Map(FOCOS.map((f) => [f.id, f]));
let roundTripOk = true;
for (const foco of res.focos) {
  const local = localById.get(foco.id);
  if (!local) { roundTripOk = false; console.log(`   id inesperado tras round-trip: ${foco.id}`); continue; }
  if (foco.region !== local.region) { roundTripOk = false; console.log(`   región difiere en ${foco.id}: ${foco.region} != ${local.region}`); }
  if (foco.category !== local.category) { roundTripOk = false; console.log(`   categoría difiere en ${foco.id}: ${foco.category} != ${local.category}`); }
  if (foco.intensity !== local.intensity) { roundTripOk = false; console.log(`   intensidad difiere en ${foco.id}: ${foco.intensity} != ${local.intensity}`); }
  if (foco.coords.lat !== local.coords.lat || foco.coords.lng !== local.coords.lng) { roundTripOk = false; console.log(`   coords difieren en ${foco.id}`); }
}
check('adaptador: round-trip conserva región/categoría/intensidad/coords', roundTripOk);
check('adaptador: focos marcados como _source=api (vía estático)', res.focos.every((f) => f._source === 'api'));

console.log(`\n${failures === 0 ? 'OK' : 'FALLOS'}: ${failures} aserción(es) fallida(s).`);
process.exit(failures === 0 ? 0 : 1);
