// GEOPÓLEM — Validación del adaptador de datos (Sprint 1).
// Ejecuta:  node scripts/validate-adapter.mjs
//
// No requiere navegador ni dependencias. Simula `window` y `fetch` para probar:
//   1. El mapeo conflicto API v1 → forma `foco` del frontend.
//   2. El orden de fallback: API → estático → local.
//
// Sale con código != 0 si alguna aserción falla (apto para CI/precheck).

// --- Shim mínimo de entorno de navegador -----------------------------------
globalThis.window = globalThis.window || {};
window.GEOP_USE_API = false; // por defecto: sólo local, como en producción hoy

const { mapConflictToFoco, adaptConflicts, loadWatchlistFocos, ADAPTER_CONFIG } =
  await import('../api-adapter.js');

let failures = 0;
function check(name, cond) {
  const ok = !!cond;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failures++;
}

// --- Ejemplo tomado de especificacion_api_geopolem.md ----------------------
const sampleConflict = {
  id: 'uuid-1',
  slug: 'crisis_mar_rojo_yemen',
  name: 'Crisis del Mar Rojo y Yemen',
  summary: 'Crisis logística y de seguridad marítima en el Mar Rojo.',
  conflict_type: { slug: 'crisis_logistica', label: 'Crisis logística' },
  primary_region: { slug: 'mar_rojo', label: 'Mar Rojo' },
  status: 'active',
  intensity_level: 4,
  escalation_risk: 4,
  humanitarian_impact: 4,
  energy_dimension: true,
  territorial_dimension: true,
  external_involvement: true,
  location: { latitude: 12.5833, longitude: 43.3333 },
  updated_at: '2026-07-06T00:00:00Z',
};

const foco = mapConflictToFoco(sampleConflict);

check('foco tiene id (usa slug)', foco.id === 'crisis_mar_rojo_yemen');
check('foco conserva título', foco.title === 'Crisis del Mar Rojo y Yemen');
check('coords mapeadas correctamente', foco.coords.lat === 12.5833 && foco.coords.lng === 43.3333);
check('intensity clamped 1..5', foco.intensity === 4);
check('region mapeada a MENA', foco.region === 'MENA');
check('energy_dimension → categoría energia', foco.category === 'energia');
check('categoría es válida para la UI', typeof foco.category === 'string');
check('foda con defaults seguros', Array.isArray(foco.foda.F) && Array.isArray(foco.foda.A));
check('pestel con defaults seguros', typeof foco.pestel.P === 'string');
check('actores con defaults seguros', Array.isArray(foco.actores.gobiernos));
check('risks default array', Array.isArray(foco.risks));
check('trazabilidad _source=api', foco._source === 'api');

// --- Robustez del adaptador ------------------------------------------------
check('conflicto nulo → null', mapConflictToFoco(null) === null);
check('conflicto sin id/slug → null', mapConflictToFoco({ name: 'x' }) === null);
check('adaptConflicts descarta inválidos', adaptConflicts([sampleConflict, null, {}]).length === 1);

// --- Fallback: USE_API=false devuelve local --------------------------------
const localSample = [{ id: 'local-1', title: 'Local', region: 'Global', category: 'conflicto', intensity: 2, coords: { lat: 0, lng: 0 }, summary: '' }];
const resLocal = await loadWatchlistFocos({ localFocos: localSample });
check('USE_API=false → source local', resLocal.source === 'local');
check('USE_API=false → devuelve focos locales', resLocal.focos === localSample);

// --- Fallback: API falla → cae a local -------------------------------------
ADAPTER_CONFIG.useApi = true;
ADAPTER_CONFIG.apiBase = 'https://example.invalid';
globalThis.fetch = async () => { throw new Error('network down'); };
const resFail = await loadWatchlistFocos({ localFocos: localSample });
check('API caída → source local (no rompe)', resFail.source === 'local');
check('API caída → conserva focos locales', resFail.focos === localSample);

// --- Éxito: API responde con contrato v1 -----------------------------------
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({ data: [sampleConflict] }),
});
const resApi = await loadWatchlistFocos({ localFocos: localSample });
check('API OK → source api', resApi.source === 'api');
check('API OK → focos adaptados', resApi.focos.length === 1 && resApi.focos[0].id === 'crisis_mar_rojo_yemen');

console.log(`\n${failures === 0 ? 'OK' : 'FALLOS'}: ${failures} aserción(es) fallida(s).`);
process.exit(failures === 0 ? 0 : 1);
