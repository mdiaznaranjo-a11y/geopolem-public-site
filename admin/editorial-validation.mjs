// GEOPÓLEM Admin/CMS (Sprint 8) — validación editorial (módulo PURO, isomórfico).
// ---------------------------------------------------------------------------
// Valida y normaliza el payload editorial de un conflicto ANTES de enviarlo a la
// API admin del Sprint 7. Es un SUPERCONJUNTO no destructivo del contrato de
// escritura del servidor (`api-server/src/validation.mjs`):
//
//   • Campos base (slug, name, status, métricas, dimensiones, location…) se
//     validan con LAS MISMAS reglas que el servidor. Un test de contrato
//     (sprint8-editorial-validation.test.mjs) verifica que CMS_STATUSES y
//     STATUS_TRANSITIONS no divergen de la fuente del servidor.
//   • Campos editoriales enriquecidos (country, sources, actors, resources,
//     chokepoints, causal_links) se validan aquí para el flujo editorial. El
//     servidor Sprint 7 IGNORA estos campos (sólo copia los reconocidos), por lo
//     que enviarlos es seguro: el contrato de escritura no se rompe.
//
// Sin dependencias: no importa DOM, ni `window`, ni código del servidor. Se
// importa tanto desde el navegador (admin-ui.js) como desde los tests de Node.
// No usa localStorage/sessionStorage/cookies (no persiste nada).
// ---------------------------------------------------------------------------

// Ciclo editorial (idéntico al servidor Sprint 7). Si esto cambia en el
// servidor, el test de contrato falla y obliga a sincronizar.
export const CMS_STATUSES = ['draft', 'review', 'published', 'archived'];

export const STATUS_TRANSITIONS = {
  draft: ['review', 'published', 'archived'],
  review: ['draft', 'published', 'archived'],
  published: ['review', 'archived'],
  archived: ['draft'],
};

// Relaciones causales admitidas (contrato documentado para Sprint 9/DB).
export const CAUSAL_RELATIONS = ['causes', 'contributes_to', 'escalates', 'mitigates', 'blocks'];

// Campos que el servidor Sprint 7 reconoce en el contrato de escritura. El
// cliente envía sólo este subconjunto a la API; el resto es metadato editorial.
export const SERVER_WRITE_FIELDS = [
  'slug', 'name', 'summary', 'status', 'conflict_type', 'primary_region',
  'intensity_level', 'escalation_risk', 'humanitarian_impact',
  'energy_dimension', 'territorial_dimension', 'external_involvement', 'location',
];

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function intInRange(value, min, max) {
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

// Valida una URL http(s) sin lanzar. Devuelve boolean.
export function isHttpUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// Normaliza un actor/recurso/chokepoint a { name } (acepta string u objeto).
function normalizeNamed(entry) {
  if (typeof entry === 'string') {
    const name = entry.trim();
    return name ? { name } : null;
  }
  if (isPlainObject(entry) && typeof entry.name === 'string' && entry.name.trim()) {
    return { name: entry.name.trim() };
  }
  return null;
}

// --- Validadores de relaciones editoriales ---------------------------------

// sources: array de { title, url } con URL http(s) y título no vacío.
export function validateSources(sources, fail, value) {
  if (sources === undefined) return;
  if (!Array.isArray(sources)) { fail('sources', 'sources debe ser un array.'); return; }
  const out = [];
  sources.forEach((s, i) => {
    if (!isPlainObject(s)) { fail(`sources[${i}]`, 'cada fuente debe ser { title, url }.'); return; }
    const title = typeof s.title === 'string' ? s.title.trim() : '';
    if (!title) fail(`sources[${i}].title`, 'title es obligatorio.');
    if (!isHttpUrl(s.url)) fail(`sources[${i}].url`, 'url debe ser http(s) válida.');
    if (title && isHttpUrl(s.url)) out.push({ title, url: s.url.trim() });
  });
  if (out.length) value.sources = out;
}

// actors: { state: [], non_state: [] } con nombres no vacíos.
export function validateActors(actors, fail, value) {
  if (actors === undefined) return;
  if (!isPlainObject(actors)) { fail('actors', 'actors debe ser { state, non_state }.'); return; }
  const out = { state: [], non_state: [] };
  for (const group of ['state', 'non_state']) {
    if (actors[group] === undefined) continue;
    if (!Array.isArray(actors[group])) { fail(`actors.${group}`, `${group} debe ser un array.`); continue; }
    actors[group].forEach((a, i) => {
      const n = normalizeNamed(a);
      if (!n) fail(`actors.${group}[${i}]`, 'actor sin nombre válido.');
      else out[group].push(n);
    });
  }
  if (out.state.length || out.non_state.length) value.actors = out;
}

// Lista simple de entidades con nombre (resources, chokepoints).
function validateNamedList(field, list, fail, value) {
  if (list === undefined) return;
  if (!Array.isArray(list)) { fail(field, `${field} debe ser un array.`); return; }
  const out = [];
  list.forEach((e, i) => {
    const n = normalizeNamed(e);
    if (!n) fail(`${field}[${i}]`, `${field}: entrada sin nombre válido.`);
    else out.push(n);
  });
  if (out.length) value[field] = out;
}

// causal_links: array de { from, to, relation? }. Consistencia: from/to no
// vacíos, sin auto-lazo (from !== to) y relación dentro del vocabulario si viene.
export function validateCausalLinks(links, fail, value) {
  if (links === undefined) return;
  if (!Array.isArray(links)) { fail('causal_links', 'causal_links debe ser un array.'); return; }
  const out = [];
  const seen = new Set();
  links.forEach((l, i) => {
    if (!isPlainObject(l)) { fail(`causal_links[${i}]`, 'cada enlace debe ser { from, to }.'); return; }
    const from = typeof l.from === 'string' ? l.from.trim() : '';
    const to = typeof l.to === 'string' ? l.to.trim() : '';
    if (!from) fail(`causal_links[${i}].from`, 'from es obligatorio.');
    if (!to) fail(`causal_links[${i}].to`, 'to es obligatorio.');
    if (from && to && from === to) fail(`causal_links[${i}]`, 'un enlace causal no puede apuntarse a sí mismo (from === to).');
    let relation;
    if (l.relation !== undefined) {
      if (!CAUSAL_RELATIONS.includes(l.relation)) {
        fail(`causal_links[${i}].relation`, `relation inválida. Válidas: ${CAUSAL_RELATIONS.join(', ')}.`);
      } else {
        relation = l.relation;
      }
    }
    if (from && to && from !== to) {
      const key = `${from}→${to}`;
      if (seen.has(key)) fail(`causal_links[${i}]`, `enlace causal duplicado: ${key}.`);
      seen.add(key);
      out.push({ from, to, ...(relation ? { relation } : {}) });
    }
  });
  if (out.length) value.causal_links = out;
}

// --- Validador principal ----------------------------------------------------
// `opts.partial=true` (edición) sólo valida los campos presentes; en creación
// exige slug y name. Devuelve { valid, errors:[{field,message}], value }.
// `value` incluye tanto el subconjunto de escritura del servidor como los
// metadatos editoriales normalizados (para el flujo/enriched view).
export function validateEditorialConflict(payload, opts = {}) {
  const partial = Boolean(opts.partial);
  const errors = [];
  const value = {};
  const fail = (field, message) => errors.push({ field, message });

  if (!isPlainObject(payload)) {
    return { valid: false, errors: [{ field: 'body', message: 'El cuerpo debe ser un objeto JSON.' }], value: {} };
  }

  // slug
  if (payload.slug !== undefined) {
    if (typeof payload.slug !== 'string' || !SLUG_RE.test(payload.slug)) {
      fail('slug', 'slug inválido: minúsculas, dígitos y guiones (kebab-case).');
    } else value.slug = payload.slug;
  } else if (!partial) fail('slug', 'slug es obligatorio.');

  // name
  if (payload.name !== undefined) {
    if (typeof payload.name !== 'string' || payload.name.trim().length < 3) {
      fail('name', 'name es obligatorio (mínimo 3 caracteres).');
    } else value.name = payload.name.trim();
  } else if (!partial) fail('name', 'name es obligatorio.');

  // summary (opcional)
  if (payload.summary !== undefined) {
    if (payload.summary !== null && typeof payload.summary !== 'string') fail('summary', 'summary debe ser texto.');
    else value.summary = payload.summary ?? null;
  }

  // country (opcional, metadato editorial; el servidor lo ignora)
  if (payload.country !== undefined) {
    if (payload.country !== null && typeof payload.country !== 'string') fail('country', 'country debe ser texto.');
    else if (payload.country) value.country = payload.country.trim();
  }

  // status editorial
  if (payload.status !== undefined) {
    if (!CMS_STATUSES.includes(payload.status)) fail('status', `status inválido. Válidos: ${CMS_STATUSES.join(', ')}.`);
    else value.status = payload.status;
  } else if (!partial) value.status = 'draft';

  // referencias por slug (opcionales)
  for (const field of ['conflict_type', 'primary_region']) {
    if (payload[field] === undefined) continue;
    if (payload[field] === null) { value[field] = null; continue; }
    if (typeof payload[field] !== 'string' || !SLUG_RE.test(payload[field])) {
      fail(field, `${field} debe ser un slug de taxonomía válido.`);
    } else value[field] = payload[field];
  }

  // métricas 1..5 (severidad, riesgo, impacto)
  for (const field of ['intensity_level', 'escalation_risk', 'humanitarian_impact']) {
    if (payload[field] === undefined || payload[field] === null) continue;
    const n = intInRange(payload[field], 1, 5);
    if (n == null) fail(field, `${field} debe ser un entero entre 1 y 5.`);
    else value[field] = n;
  }

  // dimensiones booleanas
  for (const field of ['energy_dimension', 'territorial_dimension', 'external_involvement']) {
    if (payload[field] === undefined) continue;
    if (typeof payload[field] !== 'boolean') fail(field, `${field} debe ser booleano.`);
    else value[field] = payload[field];
  }

  // location (coordenadas)
  if (payload.location !== undefined && payload.location !== null) {
    if (!isPlainObject(payload.location)) {
      fail('location', 'location debe ser { latitude, longitude }.');
    } else {
      const { latitude, longitude } = payload.location;
      const loc = {};
      if (latitude !== undefined && latitude !== null) {
        const lat = Number(latitude);
        if (!Number.isFinite(lat) || lat < -90 || lat > 90) fail('location.latitude', 'latitude fuera de rango [-90, 90].');
        else loc.latitude = lat;
      }
      if (longitude !== undefined && longitude !== null) {
        const lng = Number(longitude);
        if (!Number.isFinite(lng) || lng < -180 || lng > 180) fail('location.longitude', 'longitude fuera de rango [-180, 180].');
        else loc.longitude = lng;
      }
      if (Object.keys(loc).length) value.location = loc;
    }
  }

  // relaciones editoriales enriquecidas (metadatos; el servidor las ignora)
  validateSources(payload.sources, fail, value);
  validateActors(payload.actors, fail, value);
  validateNamedList('resources', payload.resources, fail, value);
  validateNamedList('chokepoints', payload.chokepoints, fail, value);
  validateCausalLinks(payload.causal_links, fail, value);

  if (partial && Object.keys(value).length === 0 && errors.length === 0) {
    fail('body', 'No se proporcionó ningún campo editable.');
  }

  return { valid: errors.length === 0, errors, value };
}

// Valida una transición de estado editorial. Igual semántica que el servidor:
// sin estado origen conocido (prepared/sin DB) se acepta cualquier destino válido.
export function validateStatusTransition(from, to) {
  const errors = [];
  if (!CMS_STATUSES.includes(to)) {
    errors.push({ field: 'status', message: `status destino inválido. Válidos: ${CMS_STATUSES.join(', ')}.` });
    return { valid: false, errors, value: null };
  }
  if (from && CMS_STATUSES.includes(from)) {
    if (from === to) errors.push({ field: 'status', message: `El conflicto ya está en estado "${to}".` });
    else if (!STATUS_TRANSITIONS[from]?.includes(to)) {
      errors.push({ field: 'status', message: `Transición no permitida: ${from} → ${to}.` });
    }
  }
  return { valid: errors.length === 0, errors, value: to };
}

// Extrae SOLO el subconjunto de campos que el servidor Sprint 7 reconoce, para
// enviarlo a la API admin sin ruido. Los metadatos editoriales (country,
// sources, actors, …) quedan fuera del payload de escritura por diseño.
export function toServerWritePayload(value) {
  const out = {};
  for (const f of SERVER_WRITE_FIELDS) {
    if (value[f] !== undefined) out[f] = value[f];
  }
  return out;
}
