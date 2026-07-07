// GEOPÓLEM API v1 (Sprint 7) — validación del contrato de escritura CMS/Admin.
// ---------------------------------------------------------------------------
// Funciones PURAS (sin efectos, sin DB) que validan y normalizan el payload de
// creación/edición de conflictos y las transiciones de estado del ciclo
// editorial. Se usan tanto por los handlers administrativos como por los tests.
//
// Ciclo editorial (Sprint 7):  draft → review → published → archived
//   • draft      borrador en edición, no visible en lectura pública.
//   • review     en revisión editorial, no visible aún.
//   • published  publicado (visible en la API de lectura y en el mapa).
//   • archived   retirado del flujo activo.
//
// El esquema persistente (`geopolem_status`) admite draft/active/archived/
// deprecated. Se mapea el vocabulario editorial al enum de la DB con
// cmsStatusToDbStatus() para no requerir migración destructiva; la migración
// aditiva opcional (db/migrations/0001_cms_status.sql) documenta cómo extender
// el enum si se desea persistir los estados editoriales tal cual.
// ---------------------------------------------------------------------------

export const CMS_STATUSES = ['draft', 'review', 'published', 'archived'];

// Transiciones permitidas del ciclo editorial. Clave = estado origen.
export const STATUS_TRANSITIONS = {
  draft: ['review', 'published', 'archived'],
  review: ['draft', 'published', 'archived'],
  published: ['review', 'archived'],
  archived: ['draft'],
};

// Mapea el estado editorial (contrato API) → enum persistente geopolem_status.
export function cmsStatusToDbStatus(cmsStatus) {
  switch (cmsStatus) {
    case 'published': return 'active';
    case 'review': return 'draft';   // sin columna dedicada: revisión = borrador no publicado
    case 'draft': return 'draft';
    case 'archived': return 'archived';
    default: return null;
  }
}

// Mapea el enum persistente → estado editorial (inverso, best-effort).
export function dbStatusToCmsStatus(dbStatus) {
  switch (dbStatus) {
    case 'active': return 'published';
    case 'draft': return 'draft';
    case 'archived': return 'archived';
    case 'deprecated': return 'archived';
    default: return 'draft';
  }
}

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

// Valida un payload de conflicto. `opts.partial=true` (edición) sólo valida los
// campos presentes; en creación exige slug y name. Devuelve
// { valid, errors: [{field, message}], value } — `value` es el payload
// normalizado (sólo campos reconocidos), sin datos inventados.
export function validateConflictInput(payload, opts = {}) {
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
      fail('slug', 'slug inválido: usa minúsculas, dígitos y guiones (kebab-case).');
    } else {
      value.slug = payload.slug;
    }
  } else if (!partial) {
    fail('slug', 'slug es obligatorio.');
  }

  // name
  if (payload.name !== undefined) {
    if (typeof payload.name !== 'string' || payload.name.trim().length < 3) {
      fail('name', 'name es obligatorio (mínimo 3 caracteres).');
    } else {
      value.name = payload.name.trim();
    }
  } else if (!partial) {
    fail('name', 'name es obligatorio.');
  }

  // summary (opcional)
  if (payload.summary !== undefined) {
    if (payload.summary !== null && typeof payload.summary !== 'string') {
      fail('summary', 'summary debe ser texto.');
    } else {
      value.summary = payload.summary ?? null;
    }
  }

  // status editorial (opcional; por defecto draft en creación)
  if (payload.status !== undefined) {
    if (!CMS_STATUSES.includes(payload.status)) {
      fail('status', `status inválido. Válidos: ${CMS_STATUSES.join(', ')}.`);
    } else {
      value.status = payload.status;
    }
  } else if (!partial) {
    value.status = 'draft';
  }

  // referencias por slug (opcionales)
  for (const field of ['conflict_type', 'primary_region']) {
    if (payload[field] !== undefined) {
      if (payload[field] === null) { value[field] = null; continue; }
      if (typeof payload[field] !== 'string' || !SLUG_RE.test(payload[field])) {
        fail(field, `${field} debe ser un slug de taxonomía válido.`);
      } else {
        value[field] = payload[field];
      }
    }
  }

  // métricas 1..5 (opcionales)
  for (const field of ['intensity_level', 'escalation_risk', 'humanitarian_impact']) {
    if (payload[field] !== undefined && payload[field] !== null) {
      const n = intInRange(payload[field], 1, 5);
      if (n == null) fail(field, `${field} debe ser un entero entre 1 y 5.`);
      else value[field] = n;
    }
  }

  // dimensiones booleanas (opcionales)
  for (const field of ['energy_dimension', 'territorial_dimension', 'external_involvement']) {
    if (payload[field] !== undefined) {
      if (typeof payload[field] !== 'boolean') fail(field, `${field} debe ser booleano.`);
      else value[field] = payload[field];
    }
  }

  // location (opcional)
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

  if (partial && Object.keys(value).length === 0 && errors.length === 0) {
    fail('body', 'No se proporcionó ningún campo editable.');
  }

  return { valid: errors.length === 0, errors, value };
}

// Valida una transición de estado editorial. Devuelve { valid, errors, value }.
export function validateStatusTransition(from, to) {
  const errors = [];
  if (!CMS_STATUSES.includes(to)) {
    errors.push({ field: 'status', message: `status destino inválido. Válidos: ${CMS_STATUSES.join(', ')}.` });
    return { valid: false, errors, value: null };
  }
  // Si no conocemos el estado origen (p. ej. modo prepared sin DB), permitimos
  // fijar cualquier estado válido: la validación de transición estricta requiere
  // conocer el estado actual, que sólo existe con persistencia real.
  if (from && CMS_STATUSES.includes(from)) {
    if (from === to) {
      errors.push({ field: 'status', message: `El conflicto ya está en estado "${to}".` });
    } else if (!STATUS_TRANSITIONS[from]?.includes(to)) {
      errors.push({ field: 'status', message: `Transición no permitida: ${from} → ${to}.` });
    }
  }
  return { valid: errors.length === 0, errors, value: to };
}
