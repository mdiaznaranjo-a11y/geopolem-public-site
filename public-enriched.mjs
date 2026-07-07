// GEOPÓLEM — Capa pública de detalle enriquecido y filtros (Sprint 10)
// ---------------------------------------------------------------------------
// Objetivo: llevar el DETALLE ENRIQUECIDO (actores, recursos energéticos,
// chokepoints, causal_links, sources) y los FILTROS AVANZADOS del mapa a la
// experiencia pública web/PWA SIN romper el fallback local ni la arquitectura.
//
// Regla de oro heredada (Sprint 1): "Si la API falla, la web no se rompe."
// Este módulo es PURO y aditivo:
//   • No toca el DOM (lógica testeable en Node, consumida por un renderer React).
//   • No inventa datos: toda relación ausente degrada a [] y su sección se oculta.
//   • Tolera 3 formas de origen sin duplicar lógica en el consumidor:
//       1) Detalle rico de la API/DB v1 (actors {state,non_state}[{name,role,...}],
//          resources[{name,relevance_level,...}], chokepoints[{name,risk_level,...}],
//          causal_links[{link_type,title,explanation,...}], sources[{title,url,...}]).
//       2) Detalle "prepared" simple (arrays de strings o {name}).
//       3) Foco LOCAL de data.js (actores {gobiernos,empresas,...}; sin recursos
//          ni chokepoints ni causal_links → esas secciones quedan vacías).
//
// Orden de fallback del detalle (igual espíritu que api-adapter.js):
//   API `/api/v1/conflicts/:id` → JSON estático enriquecido → foco local (vacío).
// ---------------------------------------------------------------------------

/* ========================================================================
   Utilidades puras
   ======================================================================== */
function asArray(v) { return Array.isArray(v) ? v : []; }

function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function nameOf(entry) {
  if (typeof entry === 'string') return entry.trim();
  if (entry && typeof entry === 'object' && typeof entry.name === 'string') return entry.name.trim();
  return '';
}

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Normaliza un actor admitiendo string o {name, role, alignment, involvement_level}.
function normActor(entry) {
  const name = nameOf(entry);
  if (!name) return null;
  if (typeof entry === 'string') return { name, role: null, alignment: null };
  return {
    name,
    role: str(entry.role) || null,
    alignment: str(entry.alignment) || null,
  };
}

// actors admite { state, non_state }, array plano, o el foco local con
// `actores` {gobiernos, empresas, organismos, armados, sociedad}.
const LOCAL_ACTOR_GROUPS = [
  ['gobiernos', 'gobierno', 'state'],
  ['organismos', 'organismo', 'state'],
  ['empresas', 'empresa', 'non_state'],
  ['armados', 'grupo armado', 'non_state'],
  ['sociedad', 'sociedad civil', 'non_state'],
];

function normalizeActors(actors) {
  if (Array.isArray(actors)) {
    return { state: actors.map(normActor).filter(Boolean), non_state: [] };
  }
  if (actors && typeof actors === 'object') {
    // Forma rica del contrato v1.
    if ('state' in actors || 'non_state' in actors) {
      return {
        state: asArray(actors.state).map(normActor).filter(Boolean),
        non_state: asArray(actors.non_state).map(normActor).filter(Boolean),
      };
    }
    // Forma local de data.js (grupos temáticos) → sin inventar datos, sólo
    // reetiquetamos el grupo como `role` para que la ficha sea legible.
    const state = [];
    const non_state = [];
    for (const [group, label, bucket] of LOCAL_ACTOR_GROUPS) {
      for (const raw of asArray(actors[group])) {
        const name = nameOf(raw);
        if (!name) continue;
        (bucket === 'state' ? state : non_state).push({ name, role: label, alignment: null });
      }
    }
    if (state.length || non_state.length) return { state, non_state };
  }
  return { state: [], non_state: [] };
}

function normalizeResources(resources) {
  return asArray(resources)
    .map((r) => {
      const name = nameOf(r);
      if (!name) return null;
      if (typeof r === 'string') return { name, relevance: null, strategic: null, critical: false };
      return {
        name,
        relevance: numOrNull(r.relevance_level),
        strategic: numOrNull(r.strategic_importance),
        critical: Boolean(r.critical_mineral),
      };
    })
    .filter(Boolean);
}

function normalizeChokepoints(chokepoints) {
  return asArray(chokepoints)
    .map((c) => {
      const name = nameOf(c);
      if (!name) return null;
      if (typeof c === 'string') return { name, risk: null, strategic: null, energyFlow: false };
      return {
        name,
        risk: numOrNull(c.risk_level),
        strategic: numOrNull(c.strategic_importance),
        energyFlow: Boolean(c.energy_flow_relevance),
      };
    })
    .filter(Boolean);
}

function normalizeSources(sources) {
  return asArray(sources)
    .map((s) => {
      if (!s || typeof s !== 'object') {
        const url = str(s);
        return url ? { title: url, url, publisher: null } : null;
      }
      const title = str(s.title);
      const url = str(s.url);
      if (!title && !url) return null;
      return { title: title || url, url: url || null, publisher: str(s.publisher) || null };
    })
    .filter(Boolean);
}

// causal_links admite {from,to,relation} (forma simple) y
// {link_type,title,explanation,mechanism,strength,...} (forma rica v1).
function normalizeCausalLinks(links) {
  return asArray(links)
    .map((l) => {
      if (!l || typeof l !== 'object') return null;
      const from = str(l.from);
      const to = str(l.to);
      const title = str(l.title);
      const explanation = str(l.explanation);
      const type = str(l.link_type) || str(l.relation) || null;
      // Debe existir algo legible: o par causa/efecto, o título/explicación.
      if (!from && !to && !title && !explanation) return null;
      return {
        type,
        from: from || null,
        to: to || null,
        title: title || null,
        explanation: explanation || null,
        strength: numOrNull(l.strength),
      };
    })
    .filter(Boolean);
}

function normalizeCoords(detail) {
  const lat = numOrNull(detail?.location?.latitude ?? detail?.coords?.lat);
  const lng = numOrNull(detail?.location?.longitude ?? detail?.coords?.lng);
  if (lat === null && lng === null) return null;
  return { lat: lat ?? 0, lng: lng ?? 0 };
}

/* ========================================================================
   Normalizador principal del detalle enriquecido → VIEW-MODEL estable.
   Nunca lanza. Rellena defaults seguros y expone flags `has.*`.
   ======================================================================== */
export function normalizeEnrichedDetail(detail) {
  const d = detail && typeof detail === 'object' ? detail : {};
  const actors = normalizeActors(d.actors ?? d.actores);
  const resources = normalizeResources(d.resources);
  const chokepoints = normalizeChokepoints(d.chokepoints);
  const causalLinks = normalizeCausalLinks(d.causal_links);
  const sources = normalizeSources(d.sources);

  const region = str(d?.primary_region?.label) || str(d.region) || null;
  const country = str(d.country) || str(d?.location?.country) || null;
  const severity = numOrNull(d.intensity_level ?? d.intensity);
  const status = str(d.status) || str(d?._api?.status) || null;

  return {
    id: d.id ?? d.slug ?? null,
    slug: d.slug ?? d.id ?? null,
    name: str(d.name) || str(d.title) || null,
    summary: str(d.summary),
    region,
    country,
    severity,
    status,
    coords: normalizeCoords(d),
    actors,
    resources,
    chokepoints,
    causalLinks,
    sources,
    has: {
      actors: actors.state.length > 0 || actors.non_state.length > 0,
      resources: resources.length > 0,
      chokepoints: chokepoints.length > 0,
      causalLinks: causalLinks.length > 0,
      sources: sources.length > 0,
    },
  };
}

// ¿El view-model trae alguna relación enriquecida (más allá de metadatos)?
export function hasAnyEnrichment(viewModel) {
  const h = viewModel?.has;
  return Boolean(h && (h.actors || h.resources || h.chokepoints || h.causalLinks || h.sources));
}

/* ========================================================================
   Relaciones legibles (actor↔conflicto, recurso↔conflicto, chokepoint↔
   conflicto, causa→efecto). Devuelve filas planas listas para renderizar,
   evitando duplicar lógica en el consumidor (React/tests).
   ======================================================================== */
export function toRelationRows(viewModel, conflictName) {
  const vm = viewModel || normalizeEnrichedDetail({});
  const subject = str(conflictName) || vm.name || 'Conflicto';

  const actorLinks = [...vm.actors.state, ...vm.actors.non_state].map((a) => ({
    kind: 'actor',
    label: `${a.name} ↔ ${subject}`,
    detail: a.role || null,
    meta: a.alignment || null,
  }));

  const resourceLinks = vm.resources.map((r) => ({
    kind: 'resource',
    label: `${r.name} ↔ ${subject}`,
    detail: r.critical ? 'mineral crítico' : null,
    meta: r.relevance != null ? `relevancia ${r.relevance}/5` : null,
  }));

  const chokepointLinks = vm.chokepoints.map((c) => ({
    kind: 'chokepoint',
    label: `${c.name} ↔ ${subject}`,
    detail: c.energyFlow ? 'flujo energético' : null,
    meta: c.risk != null ? `riesgo ${c.risk}/5` : null,
  }));

  const causalChain = vm.causalLinks.map((l) => {
    const cause = l.from || l.title || subject;
    const effect = l.to || l.explanation || '';
    return {
      kind: 'causal',
      label: effect ? `${cause} → ${effect}` : cause,
      detail: l.type || null,
      meta: l.strength != null ? `fuerza ${l.strength}/5` : null,
    };
  });

  return { actorLinks, resourceLinks, chokepointLinks, causalChain };
}

/* ========================================================================
   Filtros avanzados NO destructivos del mapa.
   Cada dimensión sólo aparece si el dataset la trae; si falta, se omite y su
   filtro nunca descarta focos (degradación limpia). Compatible con los 10
   focos locales (region/type/severity/status) y con datos enriquecidos
   (añade resource/actor/chokepoint cuando existen).
   ======================================================================== */

// Extrae los valores de faceta de un foco (tolerante a ausencias).
export function focoFacetValues(foco) {
  const f = foco && typeof foco === 'object' ? foco : {};
  const resources = normalizeResources(f.resources).map((r) => r.name);
  const chokepoints = normalizeChokepoints(f.chokepoints).map((c) => c.name);
  const actorsVm = normalizeActors(f.actors); // sólo forma enriquecida v1
  const actors = [...actorsVm.state, ...actorsVm.non_state].map((a) => a.name);
  return {
    region: str(f.region) || null,
    type: str(f.category) || null,
    severity: numOrNull(f.intensity),
    status: str(f.status) || str(f?._api?.status) || null,
    resources,
    chokepoints,
    actors,
  };
}

function addAll(set, values) {
  for (const v of values) if (v) set.add(v);
}

// Deriva las facetas disponibles a partir de la lista de focos. Devuelve sólo
// las dimensiones con al menos un valor (las vacías se omiten → se ocultan).
export function deriveFilterFacets(focos) {
  const list = asArray(focos);
  const region = new Set();
  const type = new Set();
  const status = new Set();
  const resource = new Set();
  const actor = new Set();
  const chokepoint = new Set();
  let hasSeverity = false;

  for (const foco of list) {
    const v = focoFacetValues(foco);
    if (v.region) region.add(v.region);
    if (v.type) type.add(v.type);
    if (v.status) status.add(v.status);
    if (v.severity != null) hasSeverity = true;
    addAll(resource, v.resources);
    addAll(actor, v.actors);
    addAll(chokepoint, v.chokepoints);
  }

  const facets = {};
  const sorted = (s) => [...s].sort((a, b) => a.localeCompare(b));
  if (region.size) facets.region = sorted(region);
  if (type.size) facets.type = sorted(type);
  if (status.size) facets.status = sorted(status);
  if (resource.size) facets.resource = sorted(resource);
  if (actor.size) facets.actor = sorted(actor);
  if (chokepoint.size) facets.chokepoint = sorted(chokepoint);
  if (hasSeverity) facets.severity = [1, 2, 3, 4, 5];
  return facets;
}

// Aplica filtros seleccionados de forma NO destructiva. `selected` puede traer
// region/type/status (igualdad), severity (mínimo), resource/actor/chokepoint
// (pertenencia). Valores vacíos, null, undefined o 'all' se ignoran. Una
// dimensión desconocida NUNCA rompe ni descarta focos.
const KNOWN_DIMENSIONS = new Set(['region', 'type', 'status', 'severity', 'resource', 'actor', 'chokepoint']);

function isActive(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '' && value !== 'all';
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  return false;
}

export function applyAdvancedFilters(focos, selected) {
  const list = asArray(focos);
  const sel = selected && typeof selected === 'object' ? selected : {};
  // Filtros activos y reconocidos.
  const active = Object.entries(sel).filter(([k, v]) => KNOWN_DIMENSIONS.has(k) && isActive(v));
  if (!active.length) return list.slice();

  return list.filter((foco) => {
    const v = focoFacetValues(foco);
    for (const [dim, value] of active) {
      switch (dim) {
        case 'region': if (v.region !== value) return false; break;
        case 'type': if (v.type !== value) return false; break;
        case 'status': if (v.status !== value) return false; break;
        case 'severity': if (v.severity == null || v.severity < Number(value)) return false; break;
        case 'resource': if (!v.resources.includes(value)) return false; break;
        case 'actor': if (!v.actors.includes(value)) return false; break;
        case 'chokepoint': if (!v.chokepoints.includes(value)) return false; break;
        default: break; // dimensión desconocida: no filtra
      }
    }
    return true;
  });
}

/* ========================================================================
   Carga del detalle enriquecido con fallback API → estático → local.
   Reutiliza las banderas `window.GEOP_*` sin exigir backend.
   ======================================================================== */
function readFlag(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() === 'true' || String(value) === '1';
}

const G = typeof window !== 'undefined' ? window : {};

export const ENRICHED_CONFIG = {
  useApi: readFlag(G.GEOP_USE_API, false),
  apiBase: (typeof G.GEOP_API_BASE === 'string' ? G.GEOP_API_BASE : '').replace(/\/$/, ''),
  // Template de detalle: `:id` se sustituye por el slug/id del conflicto.
  detailPath: G.GEOP_CONFLICT_DETAIL_PATH || '/api/v1/conflicts/:id',
  // Fallback estático opcional (mismo template con `:id`).
  detailStaticPath: G.GEOP_CONFLICT_DETAIL_STATIC || null,
  timeoutMs: Number(G.GEOP_API_TIMEOUT_MS) || 8000,
};

function unwrap(payload) {
  if (payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object') {
    return payload.data;
  }
  return payload;
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || ENRICHED_CONFIG.timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Devuelve SIEMPRE algo renderizable: `{ detail, source, error }`,
// `source` ∈ 'api' | 'static' | 'local'.
export async function loadEnrichedDetail(idOrSlug, options = {}) {
  const cfg = options.config || ENRICHED_CONFIG;
  const localFoco = options.localFoco || null;
  const id = encodeURIComponent(String(idOrSlug ?? (localFoco && (localFoco.slug || localFoco.id)) ?? ''));

  const local = () => ({ detail: normalizeEnrichedDetail(localFoco || {}), source: 'local', error: null });

  if (!cfg.useApi || !id) return local();

  let lastError = null;

  try {
    const url = `${cfg.apiBase}${cfg.detailPath.replace(':id', id)}`;
    const raw = unwrap(await fetchJson(url, cfg.timeoutMs));
    if (raw) return { detail: normalizeEnrichedDetail(raw), source: 'api', error: null };
  } catch (err) {
    lastError = err;
    reportFallback('api', err);
  }

  if (cfg.detailStaticPath) {
    try {
      const url = cfg.detailStaticPath.replace(':id', id);
      const raw = unwrap(await fetchJson(url, cfg.timeoutMs));
      if (raw) return { detail: normalizeEnrichedDetail(raw), source: 'static', error: null };
    } catch (err) {
      lastError = err;
      reportFallback('static', err);
    }
  }

  return { detail: normalizeEnrichedDetail(localFoco || {}), source: 'local', error: lastError };
}

function reportFallback(stage, err) {
  if (typeof console !== 'undefined' && console.warn) {
    console.warn(`[GEOPÓLEM enriched] fallback desde "${stage}" a respaldo local:`, err?.message || err);
  }
}
