// GEOPÓLEM — Analítica de uso no invasiva (Sprint 12)
// ---------------------------------------------------------------------------
// Módulo PURO para eventos de interacción pública/editorial. Diseñado bajo las
// mismas reglas de oro del proyecto (deeplinks.mjs, public-enriched.mjs):
//
//   • SIN almacenamiento del navegador: no usa localStorage, sessionStorage,
//     indexedDB ni cookies. No hay identificadores persistentes ni fingerprint.
//   • NO invasivo: no captura PII. Cada payload pasa por un sanitizador que
//     recorta claves/valores a una lista corta y segura, descarta objetos
//     anidados profundos y trunca cadenas largas (evita URLs con tokens, texto
//     libre con datos personales, etc.).
//   • NO bloquea la UI: el envío es "fire-and-forget" y siempre degrada a no-op
//     si no hay endpoint configurado, si el navegador está offline, o ante error.
//   • Modo NO-OP por defecto: sin endpoint, `track()` sólo valida/sanitiza y
//     descarta. Con endpoint, envía por `sendBeacon` (o fetch keepalive) sin
//     esperar la respuesta.
//   • Núcleo testeable en Node: sanitización y construcción del evento son
//     funciones puras; los helpers que tocan `navigator`/`window` están aislados.
//
// Contrato de eventos públicos (type):
//   view_conflict     → se abre/visualiza la ficha de un conflicto.
//   select_filter     → se aplica un filtro del mapa (dimensión+valor).
//   clear_filter      → se limpian filtros del mapa.
//   open_deeplink     → se entra por una URL con deep-link (hash con estado).
//   load_static_detail→ el detalle se sirvió desde el puente estático JSON.
//   fallback_local    → se degradó al respaldo local (data.js/FOCOS).
//   map_empty_state   → un conjunto de filtros deja el mapa sin resultados.
//   api_error         → una llamada a la API falló (se recupera con fallback).
// ---------------------------------------------------------------------------

// Vocabulario cerrado de eventos admitidos. Un `type` fuera de esta lista se
// descarta (no se inventan eventos ni se filtra PII "por si acaso").
export const EVENT_TYPES = Object.freeze([
  'view_conflict',
  'select_filter',
  'clear_filter',
  'open_deeplink',
  'load_static_detail',
  'fallback_local',
  'map_empty_state',
  'api_error',
]);

const EVENT_TYPE_SET = new Set(EVENT_TYPES);

// Claves permitidas en `props` (allow-list estricta). Cualquier otra clave se
// descarta silenciosamente. Se eligen dimensiones de baja cardinalidad y sin
// PII: identificadores de conflicto (slug), dimensión/valor de filtro, origen
// de datos (api|static|local), vista y códigos de error.
const ALLOWED_PROP_KEYS = new Set([
  'conflict',   // slug/id de conflicto (no es PII)
  'view',       // vista de la app (map, watchlist…)
  'dimension',  // dimensión de filtro (region, type, severity…)
  'value',      // valor del filtro seleccionado
  'source',     // origen de datos: api | static | local
  'count',      // nº de resultados (p. ej. 0 en map_empty_state)
  'code',       // código de error/estado (string corto o número)
  'endpoint',   // etiqueta de endpoint de baja cardinalidad (no URL completa)
  'reason',     // motivo corto de fallback (string corto)
]);

// Límites defensivos de sanitización.
const MAX_STRING = 120;   // trunca cadenas largas (evita URLs con tokens, PII).
const MAX_PROPS = 12;     // nº máx. de claves tras el filtrado.
const MAX_TYPE = 40;

function isPlainString(v) {
  return typeof v === 'string';
}

// Recorta y normaliza un valor escalar seguro. Devuelve `undefined` si el valor
// no es escalar (objetos/arrays/funciones se descartan → sin datos anidados).
function sanitizeScalar(value) {
  if (value === null) return null;
  const t = typeof value;
  if (t === 'number') return Number.isFinite(value) ? value : undefined;
  if (t === 'boolean') return value;
  if (t === 'string') {
    const s = value.trim();
    if (!s) return undefined;
    return s.length > MAX_STRING ? s.slice(0, MAX_STRING) : s;
  }
  // objetos, arrays, funciones, symbol, undefined → descartados.
  return undefined;
}

/* --------------------------------------------------------------------------
   sanitizeProps: objeto arbitrario → objeto seguro (allow-list + escalado).
   Nunca lanza. Descarta claves no permitidas, valores no escalares y PII
   accidental (cadenas largas se truncan). Devuelve siempre un objeto plano.
-------------------------------------------------------------------------- */
export function sanitizeProps(props) {
  const out = {};
  if (!props || typeof props !== 'object' || Array.isArray(props)) return out;
  let n = 0;
  for (const key of Object.keys(props)) {
    if (n >= MAX_PROPS) break;
    if (!ALLOWED_PROP_KEYS.has(key)) continue;
    const clean = sanitizeScalar(props[key]);
    if (clean === undefined) continue;
    out[key] = clean;
    n += 1;
  }
  return out;
}

/* --------------------------------------------------------------------------
   buildEvent: (type, props, opts) → evento sanitizado | null
   Función PURA. Devuelve null si el `type` no está en el vocabulario cerrado.
   `opts.now` inyecta el timestamp para tests deterministas.
-------------------------------------------------------------------------- */
export function buildEvent(type, props = {}, opts = {}) {
  const t = isPlainString(type) ? type.trim().slice(0, MAX_TYPE) : '';
  if (!EVENT_TYPE_SET.has(t)) return null;
  const ts = typeof opts.now === 'number'
    ? new Date(opts.now).toISOString()
    : new Date().toISOString();
  const event = { type: t, ts, props: sanitizeProps(props) };
  return event;
}

/* --------------------------------------------------------------------------
   Detección de entorno de navegador (aislada; no-op fuera del navegador).
-------------------------------------------------------------------------- */
function hasNavigator() {
  return typeof navigator !== 'undefined' && navigator != null;
}

// ¿El navegador se declara online? Sin `navigator` (Node), asumimos offline
// para forzar el modo no-op en entornos sin red controlada (tests).
export function isOnline() {
  if (!hasNavigator()) return false;
  // navigator.onLine === false es señal fiable de offline; true/undefined → online.
  return navigator.onLine !== false;
}

/* --------------------------------------------------------------------------
   Transporte: envío fire-and-forget. Devuelve true si se DELEGÓ el envío al
   navegador (no garantiza entrega); false si operó en no-op. Nunca lanza.
-------------------------------------------------------------------------- */
function deliver(endpoint, event) {
  if (!endpoint || typeof endpoint !== 'string') return false;
  if (!isOnline()) return false;
  const payload = JSON.stringify(event);
  try {
    // Preferimos sendBeacon: no bloquea, sobrevive a la descarga de la página
    // y no espera respuesta (ideal para telemetría no crítica).
    if (hasNavigator() && typeof navigator.sendBeacon === 'function') {
      const blob = typeof Blob !== 'undefined'
        ? new Blob([payload], { type: 'application/json' })
        : payload;
      return navigator.sendBeacon(endpoint, blob) === true;
    }
    // Respaldo: fetch keepalive (no await → fire-and-forget). Silencia errores.
    if (typeof fetch === 'function') {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
        // Telemetría anónima: sin credenciales ni cookies.
        credentials: 'omit',
        mode: 'cors',
      }).catch(() => {});
      return true;
    }
  } catch {
    return false; // cualquier fallo → no-op limpio.
  }
  return false;
}

/* --------------------------------------------------------------------------
   createAnalytics: fábrica del cliente de analítica.
   config:
     endpoint  → URL del colector (POST). Vacío/omitido → modo no-op.
     enabled   → interruptor maestro (por defecto true, pero sin endpoint es
                 no-op de todas formas).
     onEvent   → callback opcional (para tests/instrumentación) que recibe cada
                 evento sanitizado ANTES de intentar el envío. No debe lanzar.
   Devuelve { track, flush?, isNoop }. `track(type, props)` nunca lanza y nunca
   bloquea. Devuelve el evento sanitizado (o null si se descartó), útil en tests.
-------------------------------------------------------------------------- */
export function createAnalytics(config = {}) {
  const endpoint = isPlainString(config.endpoint) ? config.endpoint.trim() : '';
  const enabled = config.enabled !== false;
  const onEvent = typeof config.onEvent === 'function' ? config.onEvent : null;
  const noop = !enabled || !endpoint;

  function track(type, props = {}, opts = {}) {
    const event = buildEvent(type, props, opts);
    if (!event) return null; // type inválido → descartado (nunca lanza).
    if (onEvent) {
      try { onEvent(event); } catch { /* observador no debe romper la app */ }
    }
    if (noop) return event; // sin endpoint/deshabilitado: sólo se sanitiza.
    deliver(endpoint, event);
    return event;
  }

  return {
    track,
    isNoop: noop,
    endpoint: endpoint || null,
  };
}

// Cliente por defecto en modo NO-OP (sin endpoint). La app lo reemplaza si
// `window.GEOP_ANALYTICS_ENDPOINT` está definido. Importable directamente para
// instrumentar sin configurar nada (degrada a no-op sin efectos secundarios).
export const analytics = createAnalytics(
  typeof window !== 'undefined'
    ? {
        endpoint: window.GEOP_ANALYTICS_ENDPOINT || '',
        enabled: window.GEOP_ANALYTICS_ENABLED !== false,
      }
    : {},
);
