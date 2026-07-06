// GEOPÓLEM — Capa de adaptador de datos (Sprint 1)
// ---------------------------------------------------------------------------
// Objetivo: permitir que la watchlist / mapa consuman progresivamente la API
// pública `/api/v1/conflicts` SIN romper la experiencia actual.
//
// Regla de oro (plan de migración, Sprint 1):
//   "La web puede funcionar con datos locales o API sin cambiar la
//    experiencia visual. Si la API falla, la web no se rompe."
//
// Por eso este módulo:
//   1. Mantiene `data.js` (FOCOS) como respaldo local permanente.
//   2. Sólo intenta la API cuando `USE_API` está activado.
//   3. SIEMPRE cae en cascada al respaldo local ante cualquier error.
//
// Orden de fallback:
//   API `/api/v1/conflicts`  →  JSON estático `/api/v1/conflicts.json`  →  FOCOS locales
//
// No borra ni reemplaza `data.js`: es aditivo y reversible (bandera USE_API).
// ---------------------------------------------------------------------------

import { FOCOS } from './data.js';

/* ========================================================================
   Configuración por entorno (local / staging / producción)
   Se puede sobreescribir desde `index.html` con variables `window.GEOP_*`
   antes de cargar `app.js`, sin tocar este archivo.
   ======================================================================== */
export const ADAPTER_CONFIG = {
  // Bandera maestra. `false` = comportamiento actual intacto (solo datos locales).
  // Se activa cuando la API v1 esté estable (ver Sprint 2).
  useApi: readFlag(window.GEOP_USE_API, false),

  // Base de la API. Reutiliza la base ya definida en index.html si existe.
  apiBase: (typeof window.GEOP_API_BASE === 'string' ? window.GEOP_API_BASE : '').replace(/\/$/, ''),

  // Ruta del contrato de conflictos v1.
  conflictsPath: window.GEOP_CONFLICTS_PATH || '/api/v1/conflicts',

  // Respaldo estático opcional (útil en GitHub Pages sin backend):
  // deja un archivo `./api/v1/conflicts.json` con la misma forma que la API.
  staticFallbackPath: window.GEOP_CONFLICTS_STATIC || null,

  // Timeout de red para no colgar la UI si el backend está dormido (Render free tier).
  timeoutMs: Number(window.GEOP_API_TIMEOUT_MS) || 8000,
};

function readFlag(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() === 'true' || String(value) === '1';
}

/* ========================================================================
   Mapeo de taxonomías API → categorías/regiones que hoy usa el frontend.
   El contrato v1 usa slugs/labels ricos; la UI actual usa un conjunto fijo.
   ======================================================================== */
const CATEGORY_BY_KEYWORD = [
  [/energ|petrol|gas|lng|oil|nuclear/i, 'energia'],
  [/agua|water|clima|climate|hidr/i, 'agua'],
  [/migra|refug|despla/i, 'migracion'],
  [/salud|health|pandem|epidem/i, 'salud'],
  [/derechos|human|ddhh|rights/i, 'ddhh'],
  [/ia\b|inteligencia artificial|narrativa|disinfo|desinfo|ai\b/i, 'ia'],
  [/choke|estrecho|strait|canal|paso/i, 'chokepoint'],
  [/rearme|defensa|militar|defence|defense|arms/i, 'defensa'],
  [/sistema|systemic|orden mundial|world.?system/i, 'sistema'],
];

const VALID_CATEGORIES = new Set([
  'conflicto', 'agua', 'energia', 'ia', 'migracion',
  'salud', 'ddhh', 'sistema', 'chokepoint', 'defensa',
]);

const REGION_BY_KEYWORD = [
  [/europa del este|europa oriental|eastern europe|ucrania|ukraine/i, 'Europa del Este'],
  [/mena|medio oriente|oriente medio|norte de[ãa]frica|golfo|mar rojo|middle east/i, 'MENA'],
  [/sahel/i, 'Sahel'],
  [/cuerno de[ãa]frica|horn of africa/i, 'Cuerno de África'],
  [/asia del sur|south asia|india|pakist/i, 'Asia del Sur'],
  [/asia.?pac[ií]fico|indo.?pac|asia-pacific|china|taiw[aá]n/i, 'Asia-Pacífico'],
  [/am[eé]rica latina|latin|latam|caribe|venezuela/i, 'América Latina'],
  [/norteam[eé]rica|north america|ee\.?uu|estados unidos|canad/i, 'Norteamérica'],
  [/eurasia|rusia|russia/i, 'Eurasia'],
];

function mapCategory(conflict) {
  const hay = [
    conflict?.conflict_type?.slug,
    conflict?.conflict_type?.label,
    conflict?.name,
    conflict?.summary,
  ].filter(Boolean).join(' ');
  if (conflict?.energy_dimension) return 'energia';
  for (const [re, cat] of CATEGORY_BY_KEYWORD) if (re.test(hay)) return cat;
  return 'conflicto';
}

function mapRegion(conflict) {
  const hay = [
    conflict?.primary_region?.label,
    conflict?.primary_region?.slug,
  ].filter(Boolean).join(' ');
  for (const [re, region] of REGION_BY_KEYWORD) if (re.test(hay)) return region;
  return 'Global';
}

function clampIntensity(level) {
  const n = Number(level);
  if (!Number.isFinite(n)) return 3;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/* ========================================================================
   Adaptador principal: objeto conflicto API v1 → forma `foco` del frontend.
   Rellena defaults seguros para foda/pestel/actores/risks/scenarios para que
   las vistas de detalle NO se rompan aunque la API sólo devuelva la lista.
   ======================================================================== */
export function mapConflictToFoco(conflict) {
  if (!conflict || typeof conflict !== 'object') return null;
  const id = conflict.slug || conflict.id;
  if (!id) return null;

  const lat = conflict.location?.latitude;
  const lng = conflict.location?.longitude;

  return {
    id: String(id),
    title: conflict.name || conflict.slug || 'Conflicto sin título',
    region: mapRegion(conflict),
    category: normalizeCategory(mapCategory(conflict)),
    intensity: clampIntensity(conflict.intensity_level),
    coords: {
      lat: Number.isFinite(Number(lat)) ? Number(lat) : 0,
      lng: Number.isFinite(Number(lng)) ? Number(lng) : 0,
    },
    summary: conflict.summary || '',
    // Defaults seguros — la vista de detalle accede a estas estructuras.
    foda: { F: [], O: [], D: [], A: [] },
    pestel: { P: '', E: '', S: '', T: '', A: '', L: '' },
    actores: { gobiernos: [], empresas: [], organismos: [], armados: [], sociedad: [] },
    risks: [],
    scenarios: {},
    // Trazabilidad: marca el origen y conserva metadatos crudos de la API.
    _source: 'api',
    _api: {
      escalation_risk: conflict.escalation_risk ?? null,
      humanitarian_impact: conflict.humanitarian_impact ?? null,
      status: conflict.status ?? null,
      updated_at: conflict.updated_at ?? null,
    },
  };
}

function normalizeCategory(cat) {
  return VALID_CATEGORIES.has(cat) ? cat : 'conflicto';
}

/* ========================================================================
   Cliente HTTP mínimo con timeout. No lanza para respuestas vacías.
   ======================================================================== */
async function fetchJson(url, { timeoutMs } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || ADAPTER_CONFIG.timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// El contrato v1 envuelve las listas en `{ data: [...] }`.
function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function fetchConflictsFromApi() {
  // Sin `apiBase`, la ruta se resuelve relativa al origen actual.
  const url = `${ADAPTER_CONFIG.apiBase}${ADAPTER_CONFIG.conflictsPath}`;
  const payload = await fetchJson(url);
  return unwrapList(payload);
}

async function fetchConflictsFromStatic() {
  if (!ADAPTER_CONFIG.staticFallbackPath) return [];
  const payload = await fetchJson(ADAPTER_CONFIG.staticFallbackPath);
  return unwrapList(payload);
}

/* ========================================================================
   API pública del adaptador.
   ======================================================================== */

// Convierte una lista de conflictos v1 en focos válidos (descarta inválidos).
export function adaptConflicts(list) {
  return (list || []).map(mapConflictToFoco).filter(Boolean);
}

// Punto de entrada que usa el frontend. Devuelve SIEMPRE algo renderizable.
// `{ focos, source, error }` — `source` ∈ 'api' | 'static' | 'local'.
export async function loadWatchlistFocos(options = {}) {
  const localFocos = options.localFocos || FOCOS;

  if (!ADAPTER_CONFIG.useApi) {
    return { focos: localFocos, source: 'local', error: null };
  }

  let lastError = null;

  // 1) API en vivo.
  try {
    const adapted = adaptConflicts(await fetchConflictsFromApi());
    if (adapted.length) return { focos: adapted, source: 'api', error: null };
  } catch (err) {
    lastError = err;
    reportFallback('api', err);
  }

  // 2) JSON estático (GitHub Pages sin backend).
  try {
    const adapted = adaptConflicts(await fetchConflictsFromStatic());
    if (adapted.length) return { focos: adapted, source: 'static', error: null };
  } catch (err) {
    lastError = err;
    reportFallback('static', err);
  }

  // 3) Respaldo local permanente — la web nunca se rompe.
  return { focos: localFocos, source: 'local', error: lastError };
}

function reportFallback(stage, err) {
  if (typeof console !== 'undefined' && console.warn) {
    console.warn(`[GEOPÓLEM adapter] fallback desde "${stage}" a respaldo local:`, err?.message || err);
  }
}
