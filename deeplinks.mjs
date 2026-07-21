// GEOPÓLEM — Deep-links de navegación pública por URL (Sprint 11)
// ---------------------------------------------------------------------------
// Permite abrir un foco/conflicto y preservar los filtros del mapa mediante la
// URL, de forma NO destructiva y compatible con GitHub Pages y la PWA.
//
// Reglas de oro:
//   • SIN almacenamiento: no usa localStorage, sessionStorage ni cookies. El
//     único estado persistido vive en el hash de la URL (compartible, offline).
//   • Basado en HASH (`#clave=valor&…`): funciona en hosting estático sin
//     rewrites de servidor y no provoca recargas de página.
//   • Aditivo y tolerante: claves desconocidas se preservan/ignoran sin romper;
//     valores vacíos, 'all' o inválidos se omiten (degradación limpia).
//   • Módulo PURO en su núcleo (parse/serialize testeable en Node); los helpers
//     que tocan `window`/`history` están aislados y protegidos.
//
// Formato del hash (ejemplos):
//   #foco=ukr-rus
//   #view=map&foco=isr-gaza-irn&region=MENA&severity=4
//   #view=map&resource=Petróleo&chokepoint=Ormuz
// ---------------------------------------------------------------------------

// Dimensiones de filtro reconocidas (alineadas con public-enriched.mjs).
export const FILTER_KEYS = ['region', 'type', 'status', 'severity', 'resource', 'actor', 'chokepoint'];
// Clave del foco/conflicto seleccionado (aceptamos alias `conflict`).
const FOCUS_KEYS = ['foco', 'conflict'];
const NUMERIC_FILTERS = new Set(['severity']);

function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}

// Un valor de filtro es "activo" si aporta selección real.
function isActiveValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  const s = str(value);
  return s !== '' && s.toLowerCase() !== 'all';
}

// Normaliza un string de entrada (hash o query) a URLSearchParams.
// Acepta: '#a=b&c=d', '?a=b', 'a=b', o un objeto {hash, search}.
function toSearchParams(input) {
  if (input == null) return new URLSearchParams();
  if (typeof input === 'object') {
    const hash = str(input.hash);
    const search = str(input.search);
    // Preferimos el hash (fuente canónica de deep-links); si no, el query.
    const raw = hash || search;
    return toSearchParams(raw);
  }
  let s = String(input).trim();
  if (!s) return new URLSearchParams();
  // Quita el prefijo # o ? y un posible '#/' de rutas hash existentes.
  s = s.replace(/^[#?]/, '').replace(/^\/+/, '');
  return new URLSearchParams(s);
}

/* --------------------------------------------------------------------------
   parseDeepLink: URL/hash → estado { view, focus, filters }
   Nunca lanza. Devuelve siempre la forma estable.
-------------------------------------------------------------------------- */
export function parseDeepLink(input, options = {}) {
  const params = toSearchParams(input);
  const knownViews = Array.isArray(options.knownViews) ? options.knownViews : null;

  let view = null;
  const rawView = str(params.get('view'));
  if (rawView && (!knownViews || knownViews.includes(rawView))) view = rawView;

  let focus = null;
  for (const key of FOCUS_KEYS) {
    const v = str(params.get(key));
    if (v) { focus = v; break; }
  }

  const filters = {};
  for (const key of FILTER_KEYS) {
    if (!params.has(key)) continue;
    const raw = params.get(key);
    if (!isActiveValue(raw)) continue;
    if (NUMERIC_FILTERS.has(key)) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) filters[key] = n;
    } else {
      filters[key] = str(raw);
    }
  }

  return { view, focus, filters };
}

/* --------------------------------------------------------------------------
   serializeDeepLink: estado → hash ('#…' o '' si no hay nada activo)
   Orden estable (view, foco, filtros) para URLs deterministas y compartibles.
-------------------------------------------------------------------------- */
export function serializeDeepLink(state, options = {}) {
  const s = state && typeof state === 'object' ? state : {};
  const withHash = options.withHash !== false;
  const params = new URLSearchParams();

  if (isActiveValue(s.view)) params.set('view', str(s.view));
  if (isActiveValue(s.focus)) params.set('foco', str(s.focus));

  const filters = s.filters && typeof s.filters === 'object' ? s.filters : {};
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (!isActiveValue(value)) continue;
    params.set(key, NUMERIC_FILTERS.has(key) ? String(Number(value)) : str(value));
  }

  const qs = params.toString();
  if (!qs) return '';
  return withHash ? `#${qs}` : qs;
}

// Igualdad estructural de dos estados de deep-link (para evitar escrituras
// redundantes en el historial del navegador).
export function deepLinkEquals(a, b) {
  return serializeDeepLink(a, { withHash: false }) === serializeDeepLink(b, { withHash: false });
}

/* --------------------------------------------------------------------------
   Helpers de navegador (aislados y protegidos). No-op fuera del navegador.
-------------------------------------------------------------------------- */
function hasWindow() {
  return typeof window !== 'undefined' && typeof window.location !== 'undefined';
}

// Lee el estado actual desde window.location (hash prioritario, query fallback).
export function readDeepLink(options = {}) {
  if (!hasWindow()) return { view: null, focus: null, filters: {} };
  return parseDeepLink({ hash: window.location.hash, search: window.location.search }, options);
}

// Escribe el estado en la URL SIN recargar. Usa replaceState por defecto
// (no ensucia el historial); pasa { push: true } para crear una entrada.
// Nunca lanza; si history no está disponible, degrada a location.hash.
export function writeDeepLink(state, options = {}) {
  if (!hasWindow()) return '';
  const hash = serializeDeepLink(state);
  const current = str(window.location.hash);
  // Si no cambia nada, no tocar el historial.
  if (current === hash || (!hash && !current)) return hash;
  try {
    const base = window.location.pathname + window.location.search;
    const target = hash ? `${base}${hash}` : base;
    if (options.push && window.history?.pushState) {
      window.history.pushState(null, '', target);
    } else if (window.history?.replaceState) {
      window.history.replaceState(null, '', target);
    } else {
      window.location.hash = hash;
    }
  } catch {
    try { window.location.hash = hash; } catch { /* último recurso: no-op */ }
  }
  return hash;
}

// Suscribe a cambios de hash (back/forward). Devuelve función para desuscribir.
export function onDeepLinkChange(handler, options = {}) {
  if (!hasWindow() || typeof handler !== 'function') return () => {};
  const listener = () => handler(readDeepLink(options));
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}
