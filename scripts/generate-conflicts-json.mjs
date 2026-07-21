// GEOPÓLEM — Generador del puente estático de conflictos (Sprint 2).
// ---------------------------------------------------------------------------
// Convierte los focos locales de `data.js` (FOCOS) en un JSON compatible con
// el contrato de lista de la API v1 (`GET /api/v1/conflicts`) y lo escribe en
// `api/v1/conflicts.json`. También genera `api/v1/conflicts/active/map.json`
// (FeatureCollection GeoJSON) equivalente a `GET /api/v1/conflicts/active/map`.
//
// Objetivo (plan de migración, Sprint 2): permitir que el adaptador Sprint 1
// consuma un origen "API-compatible" en GitHub Pages SIN backend, sin romper
// watchlist/mapa/filtros/export y sin borrar el respaldo local `data.js`.
//
// Uso:
//   node scripts/generate-conflicts-json.mjs
//
// Reproducibilidad: NO editar a mano los JSON de salida. Regenerar siempre
// desde `data.js` con este script (única fuente de verdad local).
//
// Nota sobre "hechos": sólo se derivan campos presentes o estructuralmente
// deducibles de `data.js`. Los campos sin dato local (escalation_risk,
// humanitarian_impact, territorial_dimension, external_involvement, updated_at)
// se emiten como `null` explícito; NO se inventan valores precisos.
// ---------------------------------------------------------------------------

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOCOS, CATEGORIES } from '../data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const API_VERSION = 'v1';
const GENERATED_AT = new Date().toISOString();

// Convierte texto a slug ASCII estable (para primary_region.slug).
function slugify(text) {
  return String(text || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function categoryLabel(categoryId) {
  return CATEGORIES?.[categoryId]?.label || categoryId || null;
}

// foco (data.js) → ConflictListItem (contrato v1).
function focoToConflict(foco) {
  const category = foco.category || 'conflicto';
  const lat = Number(foco?.coords?.lat);
  const lng = Number(foco?.coords?.lng);

  return {
    // Sin base de datos aún: id y slug comparten el identificador local.
    // El adaptador usa `slug || id`, por lo que slug DEBE igualar foco.id
    // para que la watchlist/URLs de detalle sigan resolviendo igual.
    id: String(foco.id),
    slug: String(foco.id),
    name: foco.title || String(foco.id),
    summary: foco.summary || '',

    // La "categoría" del frontend viaja como conflict_type.slug (valor válido
    // para la UI); el adaptador Sprint 2 lo reconoce como atajo de fidelidad.
    conflict_type: { slug: category, label: categoryLabel(category) },

    // Región canónica del frontend, con slug ASCII derivado.
    primary_region: { slug: slugify(foco.region), label: foco.region || 'Global' },

    // Todos los focos actuales son hotspots activos.
    status: 'active',

    intensity_level: Number.isFinite(Number(foco.intensity)) ? Number(foco.intensity) : null,

    // Sin dato local fiable → null explícito (no inventar).
    escalation_risk: null,
    humanitarian_impact: null,

    // Dimensión energética: derivable de la categoría local.
    energy_dimension: category === 'energia',
    // Sin dato local → null explícito.
    territorial_dimension: null,
    external_involvement: null,

    location: {
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
    },

    // No hay fecha editorial local; se documenta la fecha de generación aparte.
    updated_at: null,
  };
}

function buildConflictsList() {
  const data = FOCOS.map(focoToConflict);
  return {
    data,
    pagination: {
      page: 1,
      page_size: data.length,
      total: data.length,
      total_pages: 1,
    },
    meta: {
      request_id: 'static_bridge',
      api_version: API_VERSION,
      generated_at: GENERATED_AT,
      source: 'data.js:FOCOS (static bridge, Sprint 2)',
    },
  };
}

// FeatureCollection GeoJSON equivalente a /conflicts/active/map.
function buildActiveMapGeoJson(conflicts) {
  return {
    type: 'FeatureCollection',
    features: conflicts
      .filter((c) => c.status === 'active' && c.location && c.location.longitude != null && c.location.latitude != null)
      .map((c) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.location.longitude, c.location.latitude] },
        properties: {
          id: c.id,
          slug: c.slug,
          name: c.name,
          intensity_level: c.intensity_level,
          escalation_risk: c.escalation_risk,
          energy_dimension: c.energy_dimension,
          primary_region: c.primary_region.label,
        },
      })),
    meta: {
      api_version: API_VERSION,
      generated_at: GENERATED_AT,
      source: 'data.js:FOCOS (static bridge, Sprint 2)',
    },
  };
}

function writeJson(relPath, obj) {
  const outPath = resolve(repoRoot, relPath);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  return outPath;
}

const listPayload = buildConflictsList();
const mapPayload = buildActiveMapGeoJson(listPayload.data);

const p1 = writeJson('api/v1/conflicts.json', listPayload);
const p2 = writeJson('api/v1/conflicts/active/map.json', mapPayload);

console.log(`[generate] ${listPayload.data.length} conflictos → ${p1}`);
console.log(`[generate] ${mapPayload.features.length} features   → ${p2}`);
console.log(`[generate] generated_at=${GENERATED_AT}`);
