// GEOPÓLEM API v1 (Sprint 7) — handlers CMS/Admin.
// ---------------------------------------------------------------------------
// Traducen las peticiones de escritura (ya autenticadas y autorizadas por
// scope en el router/auth) a llamadas del admin-repository, y devuelven el
// envoltorio estándar `{ status, body }`. La autorización JWT/scope se resuelve
// ANTES de llegar aquí (auth.authorize), por lo que estos handlers asumen una
// identidad válida en `context.claims`.
//
// Contrato de respuesta de escritura:
//   • Persistido en DB:  201 (create) / 200 (update|status), meta.persisted=true.
//   • Modo prepared:      200, meta.persisted=false, meta.mode='prepared'.
//   • Validación:         422 validation_error con details[].
//   • Body ausente/roto:  400 bad_request (lo marca el servidor/rúter).
// ---------------------------------------------------------------------------

import { ok, apiError } from './response.mjs';
import {
  validateConflictInput, validateStatusTransition, CMS_STATUSES,
} from './validation.mjs';
import * as admin from './admin-repository.mjs';

function validationError(errors) {
  const e = apiError('validation_error', 'El payload no cumple el contrato.', { errors });
  return { status: e.status, body: e.body };
}

function writeMeta(result) {
  return {
    persisted: result.persisted,
    mode: result.mode,
    ...(result.note ? { note: result.note } : {}),
  };
}

// Fail-closed (Sprint 9): la escritura se solicitó (GEOP_ADMIN_WRITES=true) pero
// el entorno está incompleto (sin DATABASE_URL) o la DB no es alcanzable. NO se
// finge un guardado: se responde 503 con el motivo. Devuelve null si el
// resultado no es de tipo 'unavailable'.
function unavailableError(result) {
  if (result.mode !== 'unavailable') return null;
  const e = apiError('service_unavailable', result.reason, { state: result.state });
  return { status: e.status, body: e.body };
}

// POST /api/v1/admin/conflicts
export async function handleCreateConflict(body) {
  const { valid, errors, value } = validateConflictInput(body, { partial: false });
  if (!valid) return validationError(errors);

  const result = await admin.createConflict(value);
  const unavailable = unavailableError(result);
  if (unavailable) return unavailable;
  const status = result.persisted ? 201 : 200;
  return { status, body: ok(result.conflict, writeMeta(result)) };
}

// PUT|PATCH /api/v1/admin/conflicts/:id
export async function handleUpdateConflict(idOrSlug, body) {
  const { valid, errors, value } = validateConflictInput(body, { partial: true });
  if (!valid) return validationError(errors);

  // Si el patch trae status, valida la transición contra el estado actual
  // (sólo comprobable con persistencia real; en prepared se acepta cualquiera).
  if (value.status) {
    const from = await admin.currentCmsStatus(idOrSlug);
    const t = validateStatusTransition(from, value.status);
    if (!t.valid) return validationError(t.errors);
  }

  const result = await admin.updateConflict(idOrSlug, value);
  const unavailable = unavailableError(result);
  if (unavailable) return unavailable;
  if (result.mode === 'database' && !result.conflict) {
    const e = apiError('not_found', 'No existe un conflicto con ese id/slug.', { field: 'id', value: idOrSlug });
    return { status: e.status, body: e.body };
  }
  return { status: 200, body: ok(result.conflict, writeMeta(result)) };
}

// POST|PUT /api/v1/admin/conflicts/:id/status   body: { status }
export async function handleSetConflictStatus(idOrSlug, body) {
  const to = body && typeof body === 'object' ? body.status : undefined;
  if (!CMS_STATUSES.includes(to)) {
    return validationError([{ field: 'status', message: `status es obligatorio. Válidos: ${CMS_STATUSES.join(', ')}.` }]);
  }

  const from = await admin.currentCmsStatus(idOrSlug);
  const t = validateStatusTransition(from, to);
  if (!t.valid) return validationError(t.errors);

  const result = await admin.setConflictStatus(idOrSlug, to);
  const unavailable = unavailableError(result);
  if (unavailable) return unavailable;
  if (result.mode === 'database' && !result.conflict) {
    const e = apiError('not_found', 'No existe un conflicto con ese id/slug.', { field: 'id', value: idOrSlug });
    return { status: e.status, body: e.body };
  }
  return { status: 200, body: ok(result.conflict, writeMeta(result)) };
}
