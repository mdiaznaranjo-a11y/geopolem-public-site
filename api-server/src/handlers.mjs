// GEOPÓLEM API v1 (Sprint 3) — handlers de endpoints.
// ---------------------------------------------------------------------------
// Parsean parámetros de la especificación, invocan el repositorio (DB→estático)
// y devuelven `{ status, body }`. Sin dependencias de framework.
// ---------------------------------------------------------------------------

import { CONFIG } from './config.mjs';
import { ok, list, apiError, paginate } from './response.mjs';
import * as repo from './repository.mjs';
import { recordSource, snapshot as observabilitySnapshot, httpSnapshot, prometheus } from './observability.mjs';
import { getCollector } from './analytics.mjs';

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
  data.observability.http = httpSnapshot();
  data.analytics = CONFIG.analyticsEnabled
    ? { enabled: true, ...getCollector().snapshot() }
    : { enabled: false };
  return { status: 200, body: ok(data) };
}

// GET /api/v1/metrics  (exposición Prometheus en texto plano; siempre pública)
export async function handleMetrics() {
  if (!CONFIG.metricsEnabled) {
    const e = apiError('not_found', 'Métricas deshabilitadas (GEOP_METRICS_ENABLED=false).');
    return { status: e.status, body: e.body };
  }
  let text = prometheus();
  if (CONFIG.analyticsEnabled) {
    text += analyticsPrometheus(getCollector().snapshot());
  }
  return {
    status: 200,
    body: text,
    contentType: 'text/plain; version=0.0.4; charset=utf-8',
  };
}

// Líneas Prometheus para los contadores de analítica (agregados, sin PII).
function analyticsPrometheus(snap) {
  const lines = [];
  lines.push('# HELP geopolem_analytics_events_total Eventos de analítica recibidos.');
  lines.push('# TYPE geopolem_analytics_events_total counter');
  lines.push(`geopolem_analytics_events_total ${snap.total}`);
  lines.push('# HELP geopolem_analytics_events_accepted_total Eventos aceptados tras sanitizar.');
  lines.push('# TYPE geopolem_analytics_events_accepted_total counter');
  lines.push(`geopolem_analytics_events_accepted_total ${snap.accepted}`);
  lines.push('# HELP geopolem_analytics_events_rejected_total Eventos descartados (contrato inválido).');
  lines.push('# TYPE geopolem_analytics_events_rejected_total counter');
  lines.push(`geopolem_analytics_events_rejected_total ${snap.rejected}`);
  const typeSamples = Object.entries(snap.by_type);
  if (typeSamples.length) {
    lines.push('# HELP geopolem_analytics_events_by_type_total Eventos por tipo.');
    lines.push('# TYPE geopolem_analytics_events_by_type_total counter');
    for (const [t, n] of typeSamples) {
      const label = String(t).replace(/[^a-z_]/g, '');
      lines.push(`geopolem_analytics_events_by_type_total{type="${label}"} ${n}`);
    }
  }
  return `${lines.join('\n')}\n`;
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

// GET /api/v1/conflicts/:id  (detalle enriquecido con relaciones si hay DB)
export async function handleConflictDetail(idOrSlug) {
  const { conflict, source } = await repo.getConflict(idOrSlug, { withRelations: true });
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

// POST /api/v1/analytics/events  (colector opcional; Sprint 12)
// Desactivado por defecto (GEOP_ANALYTICS_ENABLED=false → 404, sin superficie
// extra). Acepta UN evento (objeto) o un LOTE (array). Re-sanitiza en servidor,
// agrega en memoria y NUNCA persiste PII. Responde 202 con contadores agregados.
export async function handleAnalyticsIngest(body) {
  if (!CONFIG.analyticsEnabled) {
    const e = apiError('not_found', 'Colector de analítica deshabilitado (GEOP_ANALYTICS_ENABLED=false).');
    return { status: e.status, body: e.body };
  }
  if (body == null || (typeof body !== 'object')) {
    const e = apiError('bad_request', 'Se espera un evento JSON o un array de eventos.');
    return { status: e.status, body: e.body };
  }
  const collector = getCollector();
  const items = Array.isArray(body) ? body : [body];
  // Límite defensivo de tamaño de lote (evita abuso puntual).
  const MAX_BATCH = 50;
  const batch = items.slice(0, MAX_BATCH);
  let accepted = 0;
  let rejected = 0;
  for (const raw of batch) {
    const res = collector.ingest(raw);
    if (res.accepted) {
      accepted += 1;
      if (CONFIG.analyticsLog && res.event) {
        process.stdout.write(`${JSON.stringify({
          ts: res.event.ts,
          level: 'info',
          event: 'analytics_event',
          service: CONFIG.serviceName,
          type: res.event.type,
          props: res.event.props,
        })}\n`);
      }
    } else {
      rejected += 1;
    }
  }
  return {
    status: 202,
    body: ok({ accepted, rejected, received: items.length }),
  };
}
