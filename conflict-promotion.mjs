// GEOPÓLEM — Promoción canónica controlada a STAGING (Sprint 15)
// ---------------------------------------------------------------------------
// Módulo PURO (sin disco/red) que decide y construye la promoción del
// enriquecimiento VERIFICADO (Sprint 14) hacia artefactos canónicos de STAGING
// (detalles por conflicto + mapa enriquecido), separados de los canónicos de
// producción (api/v1/conflicts.json, api/v1/conflicts/{id}.json, map*.json) y de
// data.js/FOCOS, que NUNCA se tocan aquí.
//
// GATES editoriales (validatePromotionReadiness). La promoción se BLOQUEA si:
//   • la semilla verificada es inválida (reusa validateVerifiedSeed);
//   • un causal_link real (pending=false) no tiene fuente publicable (regla S14);
//   • una fuente publicable es demo o usa URL de ejemplo (example.org);
//   • un conflicto 'published' no tiene fuente publicable;
//   • un conflicto sin fuente verificada NO está justificado como pendiente
//     (debe figurar en la cola de investigación source-research.todo.json).
//
// Además exige una cobertura mínima (por defecto 100%) para AUTORIZAR la
// promoción; si no se alcanza, se documenta el bloqueo y sólo se permite preview.
//
// Regla de oro (heredada): no inventar datos y mantener rollback. Los artefactos
// de staging son DERIVADOS y viven bajo api/v1/staging/**.
// ---------------------------------------------------------------------------

import { isPublishableSource } from './conflict-relations.mjs';
import {
  validateVerifiedSeed, validateCausalLinksHaveSources, computeVerifiedCoverage,
  buildVerifiedDetail, isExampleUrl,
} from './conflict-sources.mjs';

export const STAGING_DETAILS_CONTRACT = 'sprint-15-staging-canonical-v1';
export const STAGING_MAP_CONTRACT = 'sprint-15-staging-map-v1';
export const DEFAULT_MIN_COVERAGE_PCT = 100;

function asArray(v) { return Array.isArray(v) ? v : []; }
function isPlainObject(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }
function str(v) { return typeof v === 'string' ? v.trim() : ''; }

/* --------------------------------------------------------------------------
   collectJustifiedPendingIds: extrae de la cola de investigación editorial
   (source-research.todo.json) los ids de conflicto que están explícitamente
   documentados como pendientes/en investigación. Un pendiente NO listado aquí
   se considera "no justificado" y bloquea la promoción.
-------------------------------------------------------------------------- */
export function collectJustifiedPendingIds(todo) {
  const ids = new Set();
  if (!isPlainObject(todo)) return ids;
  for (const it of asArray(todo.items)) {
    const id = isPlainObject(it) ? str(it.id) : '';
    if (id) ids.add(id);
  }
  return ids;
}

/* --------------------------------------------------------------------------
   collectReviewFlags: enumera las fuentes publicables marcadas
   needs_human_review:true (transparencia de fuentes con acceso indirecto).
   No bloquea la promoción a staging, pero se reporta como advertencia y debe
   resolverse antes del sign-off a producción.
-------------------------------------------------------------------------- */
export function collectReviewFlags(seed) {
  const flags = [];
  const conflicts = isPlainObject(seed) && isPlainObject(seed.conflicts) ? seed.conflicts : {};
  for (const [id, entry] of Object.entries(conflicts)) {
    if (!isPlainObject(entry)) continue;
    for (const s of asArray(entry.sources)) {
      if (isPlainObject(s) && s.needs_human_review === true) {
        flags.push({
          conflict: id,
          source_slug: str(s.slug),
          accessed_via: str(s.accessed_via),
          reason: str(s.review_reason) || 'needs_human_review',
        });
      }
    }
  }
  return flags;
}

/* --------------------------------------------------------------------------
   validatePromotionReadiness: GATE editorial de promoción a staging/producción.
   Devuelve { ok, coverage_ok, coverage_pct, blockers[], warnings[], coverage,
   review_flags[] }. No lanza. `ok` = sin blockers; `authorized` (derivado en el
   CLI) = ok && coverage_ok.
-------------------------------------------------------------------------- */
export function validatePromotionReadiness(seed, opts = {}) {
  const {
    minCoveragePct = DEFAULT_MIN_COVERAGE_PCT,
    justifiedPendingIds = new Set(),
    inventoryIds = null,
  } = opts;
  const justified = justifiedPendingIds instanceof Set
    ? justifiedPendingIds
    : new Set(asArray(justifiedPendingIds).map(str));
  const blockers = [];
  const warnings = [];

  const seedCheck = validateVerifiedSeed(seed);
  if (!seedCheck.ok) for (const e of seedCheck.errors) blockers.push(`semilla inválida: ${e}`);
  for (const w of seedCheck.warnings) warnings.push(`semilla: ${w}`);

  const causal = validateCausalLinksHaveSources(seed);
  if (!causal.ok) {
    for (const v of causal.violations) {
      blockers.push(`causal_link real sin fuente: ${v.conflict}[${v.index}] "${v.title}": ${v.reason}`);
    }
  }

  const conflicts = isPlainObject(seed) && isPlainObject(seed.conflicts) ? seed.conflicts : {};
  for (const [id, entry] of Object.entries(conflicts)) {
    if (!isPlainObject(entry)) continue;
    for (const s of asArray(entry.sources)) {
      if (!isPublishableSource(s)) continue;
      if (s.demo === true) blockers.push(`fuente demo publicable: ${id}/${str(s.slug)}`);
      if (isExampleUrl(s.url)) blockers.push(`fuente con URL de ejemplo: ${id}/${str(s.slug)}`);
    }
    const status = str(entry.editorial_status) || 'draft';
    if (status === 'published' && !asArray(entry.sources).some(isPublishableSource)) {
      blockers.push(`conflicto 'published' sin fuente publicable: ${id}`);
    }
  }

  const coverage = computeVerifiedCoverage(seed, inventoryIds);
  for (const [id, row] of Object.entries(coverage.by_conflict)) {
    if (row.verified_sources === 0 && !justified.has(id)) {
      blockers.push(`pendiente sin justificar en source-research.todo.json: ${id}`);
    }
  }
  for (const id of coverage.missing_from_seed) {
    blockers.push(`conflicto del inventario ausente en la semilla: ${id}`);
  }

  const coverageOk = coverage.coverage_pct >= minCoveragePct;
  if (!coverageOk) {
    warnings.push(`cobertura ${coverage.coverage_pct}% < mínimo requerido ${minCoveragePct}% (sólo preview, no promoción)`);
  }

  const review_flags = collectReviewFlags(seed);
  for (const f of review_flags) {
    warnings.push(`fuente needs_human_review: ${f.conflict}/${f.source_slug} (${f.accessed_via})`);
  }

  return {
    ok: blockers.length === 0,
    coverage_ok: coverageOk,
    coverage_pct: coverage.coverage_pct,
    min_coverage_pct: minCoveragePct,
    blockers,
    warnings,
    coverage,
    review_flags,
  };
}

/* --------------------------------------------------------------------------
   buildStagingDetails: construye el conjunto de detalles canónicos de STAGING,
   uno por conflicto, reutilizando el merge no destructivo (sólo verified) del
   Sprint 14. Idéntico contrato de detalle v1 → intercambiable con el canónico.
   No muta las entradas.
-------------------------------------------------------------------------- */
export function buildStagingDetails(items, details, seed) {
  const out = {};
  const seedConflicts = isPlainObject(seed) && isPlainObject(seed.conflicts) ? seed.conflicts : {};
  for (const it of asArray(items)) {
    const id = str(it && (it.id || it.slug));
    if (!id) continue;
    const detail = (details && details[id]) || { data: { id, slug: id, name: it && it.name } };
    const seedEntry = seedConflicts[id];
    const data = buildVerifiedDetail(detail, seedEntry);
    // El merge base normaliza y descarta la trazabilidad de acceso; la
    // reinyectamos por slug para conservar accessed_via/needs_human_review en
    // el artefacto de staging (transparencia de fuentes con acceso indirecto).
    const seedSources = new Map(
      asArray(seedEntry && seedEntry.sources)
        .filter(isPlainObject)
        .map((s) => [str(s.slug), s]),
    );
    data.editorial_status = str(seedEntry && seedEntry.editorial_status) || data.editorial_status || 'draft';
    data.sources = asArray(data.sources).map((s) => {
      const src = seedSources.get(str(s && s.slug));
      if (!src) return s;
      const extra = {};
      if (str(src.accessed_via)) extra.accessed_via = str(src.accessed_via);
      if (str(src.relation)) extra.relation = str(src.relation);
      if (src.needs_human_review === true) {
        extra.needs_human_review = true;
        if (str(src.review_reason)) extra.review_reason = str(src.review_reason);
      }
      return { ...s, ...extra };
    });
    out[id] = data;
  }
  return out;
}

/* --------------------------------------------------------------------------
   buildStagingMap: construye el mapa enriquecido de STAGING (GeoJSON) a partir
   de los detalles de staging: cada feature añade trazabilidad de fuentes
   verificadas (sources_count, has_verified_source, editorial_status) sin tocar
   el mapa canónico de producción.
-------------------------------------------------------------------------- */
export function buildStagingMap(stagingDetails) {
  const details = isPlainObject(stagingDetails) ? stagingDetails : {};
  const features = [];
  for (const [id, data] of Object.entries(details)) {
    if (!isPlainObject(data)) continue;
    const loc = isPlainObject(data.location) ? data.location : {};
    const lat = typeof loc.latitude === 'number' ? loc.latitude : null;
    const lon = typeof loc.longitude === 'number' ? loc.longitude : null;
    const sources = asArray(data.sources).filter(isPublishableSource);
    const feature = {
      type: 'Feature',
      geometry: (lat != null && lon != null)
        ? { type: 'Point', coordinates: [lon, lat] }
        : null,
      properties: {
        id,
        slug: str(data.slug) || id,
        name: str(data.name) || id,
        intensity_level: (isPlainObject(data.metrics) ? data.metrics.intensity_level : null) ?? null,
        energy_dimension: (isPlainObject(data.dimensions) ? data.dimensions.energy : null) ?? null,
        editorial_status: str(data.editorial_status) || null,
        sources_count: sources.length,
        has_verified_source: sources.length > 0,
        needs_human_review: sources.some((s) => s.needs_human_review === true),
      },
    };
    features.push(feature);
  }
  return { type: 'FeatureCollection', features };
}

/* --------------------------------------------------------------------------
   buildPromotionBundle: ensambla el paquete de staging completo (detalles +
   mapa + reporte de cobertura antes/después + gate) listo para escribir a disco.
   `before` es la cobertura de los canónicos de producción (sin enriquecer);
   `after` es la cobertura del staging enriquecido.
-------------------------------------------------------------------------- */
export function buildPromotionBundle({ items, details, seed, gate, generatedAt }) {
  const stagingDetails = buildStagingDetails(items, details, seed);
  const stagingMap = buildStagingMap(stagingDetails);
  const ts = generatedAt || new Date().toISOString();
  const beforeSources = countSources(details);
  const afterSources = countSources(wrap(stagingDetails));
  return {
    generated_at: ts,
    detailsDoc: {
      contract: STAGING_DETAILS_CONTRACT,
      generated_at: ts,
      staging: true,
      canonical: false,
      notice: 'STAGING canónico (Sprint 15). Detalles por conflicto derivados del merge verificado (sólo fuentes verified). NO es producción: separado de api/v1/conflicts/{id}.json. La promoción a producción exige sign-off editorial humano.',
      authorized: Boolean(gate && gate.ok && gate.coverage_ok),
      gate: gate ? { ok: gate.ok, coverage_ok: gate.coverage_ok, coverage_pct: gate.coverage_pct, blockers: gate.blockers, warnings: gate.warnings } : null,
      data: stagingDetails,
      meta: { api_version: 'v1', source: 'verified-seed-merge (Sprint 15 staging)' },
    },
    mapDoc: {
      ...stagingMap,
      contract: STAGING_MAP_CONTRACT,
      generated_at: ts,
      staging: true,
    },
    coverageReport: {
      generated_at: ts,
      before: { conflicts_with_sources: beforeSources.withSources, total_conflicts: beforeSources.total },
      after: { conflicts_with_sources: afterSources.withSources, total_conflicts: afterSources.total },
      gate: gate ? { ok: gate.ok, coverage_ok: gate.coverage_ok, coverage_pct: gate.coverage_pct, authorized: Boolean(gate.ok && gate.coverage_ok) } : null,
      review_flags: gate ? gate.review_flags : [],
    },
  };
}

function wrap(detailsMap) {
  const out = {};
  for (const [id, data] of Object.entries(isPlainObject(detailsMap) ? detailsMap : {})) {
    out[id] = { data };
  }
  return out;
}

function countSources(detailsWrapped) {
  const d = isPlainObject(detailsWrapped) ? detailsWrapped : {};
  let withSources = 0;
  let total = 0;
  for (const entry of Object.values(d)) {
    total += 1;
    const data = isPlainObject(entry) && isPlainObject(entry.data) ? entry.data : entry;
    const sources = asArray(data && data.sources).filter(isPublishableSource);
    if (sources.length > 0) withSources += 1;
  }
  return { withSources, total };
}
