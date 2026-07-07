// GEOPÓLEM API v1 (Sprint 3) — repositorio con estrategia de fallback.
// ---------------------------------------------------------------------------
// Regla de oro del proyecto (arquitectura reversible por capas):
//   1) API real PostgreSQL/PostGIS  →  2) JSON estático /api/v1/*.json  →
//   (3) el frontend además conserva su data.js/FOCOS local).
//
// Este módulo intenta la DB y, ante CUALQUIER fallo o ausencia de DATABASE_URL,
// cae al puente estático. Devuelve siempre datos renderizables. Cada respuesta
// incluye `source` ('database' | 'static') para trazabilidad en meta.
// ---------------------------------------------------------------------------

import { queryLayer } from './db.mjs';
import { staticConflicts, staticMeta } from './static-source.mjs';
import { CONFIG } from './config.mjs';

async function useDb() {
  try {
    return await queryLayer.available();
  } catch {
    return false;
  }
}

// --- Filtrado/paginación en memoria para el modo estático -------------------
function applyStaticFilters(items, filters) {
  return items.filter((c) => {
    if (filters.status && c.status !== filters.status) return false;
    if (filters.region && c.primary_region?.slug !== filters.region) return false;
    if (filters.conflict_type && c.conflict_type?.slug !== filters.conflict_type) return false;
    if (filters.intensity_min != null && !(c.intensity_level >= filters.intensity_min)) return false;
    if (filters.intensity_max != null && !(c.intensity_level <= filters.intensity_max)) return false;
    if (filters.energy_dimension != null && c.energy_dimension !== filters.energy_dimension) return false;
    if (filters.territorial_dimension != null && c.territorial_dimension !== filters.territorial_dimension) return false;
    if (filters.external_involvement != null && c.external_involvement !== filters.external_involvement) return false;
    return true;
  });
}

function sortStatic(items, sort, order) {
  const dir = order === 'asc' ? 1 : -1;
  const key = ['updated_at', 'intensity_level', 'escalation_risk', 'name', 'slug'].includes(sort) ? sort : 'intensity_level';
  return [...items].sort((a, b) => {
    const av = a[key]; const bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

// --- API del repositorio ----------------------------------------------------

export async function listConflicts(filters, pageOpts) {
  if (await useDb()) {
    try {
      const { items, total } = await queryLayer.listConflicts(filters, pageOpts);
      return { items, total, source: 'database' };
    } catch (err) {
      logFallback('listConflicts', err);
    }
  }
  const all = applyStaticFilters(await staticConflicts(), filters);
  const sorted = sortStatic(all, pageOpts.sort, pageOpts.order);
  const start = (pageOpts.page - 1) * pageOpts.pageSize;
  const items = sorted.slice(start, start + pageOpts.pageSize);
  return { items, total: all.length, source: 'static' };
}

export async function getConflict(idOrSlug) {
  if (await useDb()) {
    try {
      const found = await queryLayer.getConflict(idOrSlug);
      if (found) return { conflict: buildDetail(found), source: 'database' };
      return { conflict: null, source: 'database' };
    } catch (err) {
      logFallback('getConflict', err);
    }
  }
  const items = await staticConflicts();
  const found = items.find((c) => c.slug === idOrSlug || c.id === idOrSlug) || null;
  return { conflict: found ? buildDetail(found) : null, source: 'static' };
}

export async function activeConflictsMap(filters) {
  if (await useDb()) {
    try {
      const features = await queryLayer.activeConflictsMap(filters);
      return { features, source: 'database' };
    } catch (err) {
      logFallback('activeConflictsMap', err);
    }
  }
  const items = applyStaticFilters(await staticConflicts(), { ...filters, status: 'active' });
  const features = items
    .filter((c) => c.location && c.location.longitude != null && c.location.latitude != null)
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
        primary_region: c.primary_region?.label ?? null,
      },
    }));
  return { features, source: 'static' };
}

export async function getFilters() {
  if (await useDb()) {
    try {
      return { filters: await queryLayer.filters(), source: 'database' };
    } catch (err) {
      logFallback('getFilters', err);
    }
  }
  const items = await staticConflicts();
  const regions = dedupeRef(items.map((c) => c.primary_region));
  const types = dedupeRef(items.map((c) => c.conflict_type));
  const statuses = [...new Set(items.map((c) => c.status).filter(Boolean))].sort();
  const intensities = items.map((c) => c.intensity_level).filter((n) => Number.isFinite(n));
  return {
    filters: {
      regions,
      conflict_types: types,
      statuses,
      intensity: {
        min: intensities.length ? Math.min(...intensities) : null,
        max: intensities.length ? Math.max(...intensities) : null,
      },
    },
    source: 'static',
  };
}

export async function health() {
  const dbHealth = await queryLayer.health();
  const sMeta = await staticMeta().catch(() => ({ generated_at: null }));
  const active = dbHealth.database === 'reachable' ? 'database' : 'static';
  return {
    status: 'ok',
    service: CONFIG.serviceName,
    api_version: CONFIG.apiVersion,
    active_source: active,
    database: dbHealth.database,
    postgis: dbHealth.postgis,
    database_detail: dbHealth.reason,
    static_fallback: { available: true, generated_at: sMeta.generated_at },
  };
}

// Detalle: expande un ConflictListItem al shape de ficha del contrato.
// Sin relaciones en el puente estático → arrays vacíos (no se inventan datos).
function buildDetail(c) {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    summary: c.summary,
    conflict_type: c.conflict_type,
    primary_region: c.primary_region,
    status: c.status,
    metrics: {
      intensity_level: c.intensity_level,
      escalation_risk: c.escalation_risk,
      humanitarian_impact: c.humanitarian_impact,
    },
    dimensions: {
      energy: Boolean(c.energy_dimension),
      territorial: Boolean(c.territorial_dimension),
      external_involvement: Boolean(c.external_involvement),
    },
    location: c.location,
    actors: { state: [], non_state: [] },
    resources: [],
    chokepoints: [],
    causal_links: [],
    sources: [],
    updated_at: c.updated_at,
  };
}

function dedupeRef(refs) {
  const map = new Map();
  for (const r of refs) {
    if (r && r.slug && !map.has(r.slug)) map.set(r.slug, { slug: r.slug, label: r.label });
  }
  return [...map.values()].sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

function logFallback(op, err) {
  console.warn(`[geopolem-api] "${op}" cayó a respaldo estático:`, err?.message || err);
}
