// GEOPÓLEM API v1 (Sprint 3) — handlers de endpoints.
// ---------------------------------------------------------------------------
// Parsean parámetros de la especificación, invocan el repositorio (DB→estático)
// y devuelven `{ status, body }`. Sin dependencias de framework.
// ---------------------------------------------------------------------------

import { CONFIG } from './config.mjs';
import { ok, list, apiError, paginate } from './response.mjs';
import * as repo from './repository.mjs';
import { recordSource, snapshot as observabilitySnapshot } from './observability.mjs';

function parseBool(v) {
  if (v == null) return null;
  const s = String(v).toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return null;
}

function parseIntInRange(v, min, max) {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function parsePageOpts(sp) {
  let page = parseIntInRange(sp.get('page'), 1, Number.MAX_SAFE_INTEGER) ?? 1;
  let pageSize = parseIntInRange(sp.get('page_size'), 1, CONFIG.maxPageSize) ?? CONFIG.defaultPageSize;
  const sort = sp.get('sort') || 'intensity_level';
  const order = (sp.get('order') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
  return { page, pageSize, sort, order };
}

function parseConflictFilters(sp) {
  const filters = {};
  if (sp.get('status')) filters.status = sp.get('status');
  if (sp.get('region')) filters.region = sp.get('region');
  if (sp.get('conflict_type')) filters.conflict_type = sp.get('conflict_type');
  const iMin = parseIntInRange(sp.get('intensity_min'), 1, 5);
  const iMax = parseIntInRange(sp.get('intensity_max'), 1, 5);
  if (iMin != null) filters.intensity_min = iMin;
  if (iMax != null) filters.intensity_max = iMax;
  const energy = parseBool(sp.get('energy_dimension'));
  if (energy != null) filters.energy_dimension = energy;
  const terr = parseBool(sp.get('territorial_dimension'));
  if (terr != null) filters.territorial_dimension = terr;
  const ext = parseBool(sp.get('external_involvement'));
  if (ext != null) filters.external_involvement = ext;
  if (sp.get('updated_after')) filters.updated_after = sp.get('updated_after');
  return filters;
}

// GET /api/v1/health  (incluye contadores de observabilidad de meta.source)
export async function handleHealth() {
  const data = await repo.health();
  data.observability = observabilitySnapshot();
  return { status: 200, body: ok(data) };
}

// GET /api/v1/conflicts
export async function handleConflicts(sp) {
  const filters = parseConflictFilters(sp);
  const pageOpts = parsePageOpts(sp);
  const { items, total, source } = await repo.listConflicts(filters, pageOpts);
  const body = list(items, paginate(total, pageOpts.page, pageOpts.pageSize), { source });
  recordSource('conflicts', source, body.meta.request_id);
  return { status: 200, body };
}

// GET /api/v1/conflicts/active/map  (siempre GeoJSON FeatureCollection)
export async function handleActiveMap(sp) {
  const filters = {};
  if (sp.get('region')) filters.region = sp.get('region');
  const iMin = parseIntInRange(sp.get('intensity_min'), 1, 5);
  if (iMin != null) filters.intensity_min = iMin;
  const energy = parseBool(sp.get('energy_dimension'));
  if (energy != null) filters.energy_dimension = energy;

  const { features, source } = await repo.activeConflictsMap(filters);
  recordSource('conflicts_active_map', source, null);
  return {
    status: 200,
    body: {
      type: 'FeatureCollection',
      features,
      meta: { api_version: CONFIG.apiVersion, source },
    },
  };
}

// GET /api/v1/conflicts/:id
export async function handleConflictDetail(idOrSlug) {
  const { conflict, source } = await repo.getConflict(idOrSlug);
  if (!conflict) {
    const e = apiError('not_found', 'No existe un conflicto con ese id/slug.', { field: 'id', value: idOrSlug });
    return { status: e.status, body: e.body };
  }
  const body = ok(conflict, { source });
  recordSource('conflict_detail', source, body.meta.request_id);
  return { status: 200, body };
}

// GET /api/v1/filters
export async function handleFilters() {
  const { filters, source } = await repo.getFilters();
  const body = ok(filters, { source });
  recordSource('filters', source, body.meta.request_id);
  return { status: 200, body };
}
