// GEOPÓLEM API v1 (Sprint 12) — colector de analítica en memoria + KPIs.
// ---------------------------------------------------------------------------
// Recibe eventos de interacción pública YA sanitizados por el cliente
// (analytics.mjs en la raíz) y los agrega SIN PII en un buffer circular en
// memoria. Cero dependencias y cero persistencia por defecto:
//
//   • Re-sanitiza en el servidor (defensa en profundidad): confía pero verifica
//     el vocabulario de eventos y la allow-list de props del cliente.
//   • Agrega contadores por tipo de evento y por origen de datos (api|static|
//     local) → alimenta KPIs de ratio API/estático/local, deep-links, filtros,
//     errores… sin exponer datos individuales.
//   • Buffer circular acotado (GEOP_ANALYTICS_MAX_EVENTS) para poder derivar
//     KPIs recientes sin crecer sin límite. Se puede vaciar en tests.
//
// Las funciones de KPI (computeUsageKpis) son PURAS y se reutilizan también
// desde el reporte de salud de contenidos (scripts/content-health-report.mjs).
// ---------------------------------------------------------------------------

import { CONFIG } from './config.mjs';
import { sanitizeProps, EVENT_TYPES } from '../../analytics.mjs';

const EVENT_TYPE_SET = new Set(EVENT_TYPES);
const DATA_SOURCES = ['api', 'static', 'local'];

// Re-valida un evento entrante en el servidor. Devuelve el evento normalizado
// { type, ts, props } o null si no cumple el contrato. Nunca lanza.
export function normalizeIncomingEvent(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const type = typeof raw.type === 'string' ? raw.type.trim() : '';
  if (!EVENT_TYPE_SET.has(type)) return null;
  const props = sanitizeProps(raw.props);
  // El timestamp del cliente no es de confianza para orden/seguridad: usamos el
  // de recepción del servidor (ISO). Se conserva sólo si es una fecha válida.
  let ts;
  if (typeof raw.ts === 'string' && !Number.isNaN(Date.parse(raw.ts))) {
    ts = new Date(raw.ts).toISOString();
  } else {
    ts = new Date(now).toISOString();
  }
  return { type, ts, props };
}

export class AnalyticsCollector {
  constructor({ maxEvents = 5000 } = {}) {
    this.maxEvents = Number.isFinite(maxEvents) && maxEvents > 0 ? Math.trunc(maxEvents) : 5000;
    this.buffer = []; // buffer circular (FIFO al desbordar).
    this.counters = {
      total: 0,
      accepted: 0,
      rejected: 0,
      by_type: Object.create(null),
      by_source: { api: 0, static: 0, local: 0, unknown: 0 },
      first_at: null,
      last_at: null,
    };
  }

  // Ingesta un evento crudo. Devuelve { accepted, event } o { accepted:false }.
  ingest(raw, now = Date.now()) {
    this.counters.total += 1;
    const event = normalizeIncomingEvent(raw, now);
    if (!event) {
      this.counters.rejected += 1;
      return { accepted: false, event: null };
    }
    this.counters.accepted += 1;
    this.counters.by_type[event.type] = (this.counters.by_type[event.type] || 0) + 1;
    const src = DATA_SOURCES.includes(event.props.source) ? event.props.source : 'unknown';
    this.counters.by_source[src] += 1;
    if (!this.counters.first_at) this.counters.first_at = event.ts;
    this.counters.last_at = event.ts;

    this.buffer.push(event);
    if (this.buffer.length > this.maxEvents) this.buffer.shift();
    return { accepted: true, event };
  }

  // Instantánea de contadores agregados (sin eventos individuales → sin PII).
  snapshot() {
    return {
      total: this.counters.total,
      accepted: this.counters.accepted,
      rejected: this.counters.rejected,
      buffered: this.buffer.length,
      max_events: this.maxEvents,
      by_type: { ...this.counters.by_type },
      by_source: { ...this.counters.by_source },
      first_at: this.counters.first_at,
      last_at: this.counters.last_at,
    };
  }

  // KPIs derivados de los eventos en buffer (ventana reciente).
  kpis() {
    return computeUsageKpis(this.buffer);
  }

  reset() {
    this.buffer = [];
    this.counters = {
      total: 0,
      accepted: 0,
      rejected: 0,
      by_type: Object.create(null),
      by_source: { api: 0, static: 0, local: 0, unknown: 0 },
      first_at: null,
      last_at: null,
    };
  }
}

/* --------------------------------------------------------------------------
   computeUsageKpis: [eventos] → KPIs de uso público/editorial (PURA).
   No asume orden ni exige campos; degrada a 0 cuando faltan datos.
-------------------------------------------------------------------------- */
export function computeUsageKpis(events) {
  const list = Array.isArray(events) ? events : [];
  const byType = Object.create(null);
  const bySource = { api: 0, static: 0, local: 0 };
  const conflictsViewed = new Set();
  const filterDimensions = Object.create(null);

  for (const ev of list) {
    if (!ev || typeof ev !== 'object') continue;
    const type = ev.type;
    if (!EVENT_TYPE_SET.has(type)) continue;
    byType[type] = (byType[type] || 0) + 1;
    const props = ev.props && typeof ev.props === 'object' ? ev.props : {};

    if (DATA_SOURCES.includes(props.source)) bySource[props.source] += 1;
    if (type === 'view_conflict' && typeof props.conflict === 'string') {
      conflictsViewed.add(props.conflict);
    }
    if (type === 'select_filter' && typeof props.dimension === 'string') {
      filterDimensions[props.dimension] = (filterDimensions[props.dimension] || 0) + 1;
    }
  }

  const totalSourced = bySource.api + bySource.static + bySource.local;
  const ratio = (n) => (totalSourced > 0 ? Number((n / totalSourced).toFixed(4)) : null);

  return {
    events_total: list.length,
    conflicts_viewed_unique: conflictsViewed.size,
    conflict_views: byType.view_conflict || 0,
    filters_used: byType.select_filter || 0,
    filters_cleared: byType.clear_filter || 0,
    deeplinks_opened: byType.open_deeplink || 0,
    static_details_loaded: byType.load_static_detail || 0,
    fallbacks_local: byType.fallback_local || 0,
    map_empty_states: byType.map_empty_state || 0,
    api_errors: byType.api_error || 0,
    by_type: { ...byType },
    filter_dimensions: { ...filterDimensions },
    source_mix: {
      api: bySource.api,
      static: bySource.static,
      local: bySource.local,
      api_ratio: ratio(bySource.api),
      static_ratio: ratio(bySource.static),
      local_ratio: ratio(bySource.local),
    },
  };
}

// --- Instancia compartida por proceso (lazy) -------------------------------
let sharedCollector = null;
export function getCollector() {
  if (!sharedCollector || sharedCollector.maxEvents !== CONFIG.analyticsMaxEvents) {
    sharedCollector = new AnalyticsCollector({ maxEvents: CONFIG.analyticsMaxEvents });
  }
  return sharedCollector;
}

// Sólo para tests.
export function _resetCollector() {
  sharedCollector = null;
}
