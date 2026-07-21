// GEOPÓLEM API v1 — envoltorios de respuesta (contrato especificacion_api_geopolem.md).
// ---------------------------------------------------------------------------
// Formatos estables: data + meta, listas con pagination, errores con code.
// No dependen de framework: se usan tanto con DB como con fallback estático.
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
import { CONFIG } from './config.mjs';

export function requestId() {
  return `req_${randomUUID().slice(0, 12)}`;
}

function baseMeta(extra = {}) {
  return { request_id: requestId(), api_version: CONFIG.apiVersion, ...extra };
}

// Respuesta de objeto: { data, meta }.
export function ok(data, metaExtra = {}) {
  return { data, meta: baseMeta(metaExtra) };
}

// Respuesta de lista: { data, pagination, meta }.
export function list(data, pagination, metaExtra = {}) {
  return { data, pagination, meta: baseMeta(metaExtra) };
}

// Error estándar con código HTTP recomendado.
export function apiError(code, message, details = null) {
  const map = {
    bad_request: 400,
    unauthorized: 401,
    forbidden: 403,
    not_found: 404,
    conflict: 409,
    validation_error: 422,
    rate_limited: 429,
    internal_error: 500,
  };
  return {
    status: map[code] || 500,
    body: {
      error: { code, message, ...(details ? { details } : {}) },
      meta: baseMeta(),
    },
  };
}

// Construye el bloque pagination a partir de total y parámetros.
export function paginate(total, page, pageSize) {
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  return { page, page_size: pageSize, total, total_pages: totalPages };
}
