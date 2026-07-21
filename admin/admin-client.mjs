// GEOPÓLEM Admin/CMS (Sprint 8) — cliente de la API admin (isomórfico).
// ---------------------------------------------------------------------------
// Cliente mínimo para los endpoints de escritura del Sprint 7:
//   POST  /api/v1/admin/conflicts
//   PATCH /api/v1/admin/conflicts/:id
//   POST  /api/v1/admin/conflicts/:id/status
//
// Diseño y garantías:
//   • SIN almacenamiento: no usa localStorage/sessionStorage/indexedDB/cookies.
//     El token JWT se pasa en memoria (parámetro/campo manual del formulario o
//     `window.GEOP_ADMIN_TOKEN` inyectado por el entorno de staging).
//   • Inyección de `fetch`: en el navegador usa el global; en Node/tests se pasa
//     un `fetchImpl` simulado. Isomórfico y testeable sin sockets.
//   • Manejo EXPLÍCITO de errores: 401 (auth), 403 (scope), 422 (validación con
//     details), 429 (rate limit con Retry-After). Nunca "traga" el error.
//   • Modo DEMO/prepared: si no hay baseUrl NI token, no hace red. Devuelve una
//     respuesta simulada equivalente al modo "prepared" del servidor (meta.mode=
//     'prepared', persisted:false) validando el contrato localmente. Así la UI
//     funciona en GitHub Pages / offline sin API real, sin inventar persistencia.
// ---------------------------------------------------------------------------

import {
  validateEditorialConflict, validateStatusTransition, toServerWritePayload,
} from './editorial-validation.mjs';

// Error tipado para que la UI distinga la causa sin parsear strings.
export class AdminApiError extends Error {
  constructor(kind, message, { status = 0, details = null, retryAfterSec = null } = {}) {
    super(message);
    this.name = 'AdminApiError';
    this.kind = kind; // 'auth' | 'forbidden' | 'validation' | 'rate_limit' | 'not_found' | 'server' | 'network'
    this.status = status;
    this.details = details;
    this.retryAfterSec = retryAfterSec;
  }
}

const KIND_BY_CODE = {
  unauthorized: 'auth',
  forbidden: 'forbidden',
  validation_error: 'validation',
  rate_limited: 'rate_limit',
  not_found: 'not_found',
  bad_request: 'validation',
  internal_error: 'server',
};

function mapErrorResponse(status, body, headers) {
  const code = body?.error?.code || (status >= 500 ? 'internal_error' : 'bad_request');
  const kind = KIND_BY_CODE[code] || (status >= 500 ? 'server' : 'validation');
  const retryAfterSec = headers ? Number(headers.get?.('Retry-After')) || null : null;
  return new AdminApiError(kind, body?.error?.message || `HTTP ${status}`, {
    status,
    details: body?.error?.details || null,
    retryAfterSec,
  });
}

// Respuesta simulada del modo prepared (espejo del admin-repository del servidor).
const DEMO_NOTE = 'Modo DEMO cliente (sin API): contrato validado, entidad NO persistida.';

function demoCreate(value) {
  const cmsStatus = value.status || 'draft';
  return {
    status: 200,
    body: {
      data: {
        id: null,
        slug: value.slug,
        name: value.name,
        summary: value.summary ?? null,
        conflict_type: value.conflict_type ?? null,
        primary_region: value.primary_region ?? null,
        status: cmsStatus === 'published' ? 'active' : (cmsStatus === 'review' ? 'draft' : cmsStatus),
        cms_status: cmsStatus,
        metrics: {
          intensity_level: value.intensity_level ?? null,
          escalation_risk: value.escalation_risk ?? null,
          humanitarian_impact: value.humanitarian_impact ?? null,
        },
        dimensions: {
          energy: value.energy_dimension ?? false,
          territorial: value.territorial_dimension ?? false,
          external_involvement: value.external_involvement ?? false,
        },
        location: value.location ?? null,
      },
      meta: { persisted: false, mode: 'prepared', note: DEMO_NOTE, demo: true },
    },
  };
}

export function createAdminClient(options = {}) {
  const baseUrl = (options.baseUrl || '').replace(/\/$/, '');
  const token = options.token || '';
  const fetchImpl = options.fetchImpl
    || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  const timeoutMs = Number(options.timeoutMs) || 8000;

  // DEMO si no hay a dónde/quién llamar. No se inventa persistencia real.
  const demoMode = !baseUrl || !token;

  async function request(method, path, jsonBody) {
    if (!fetchImpl) throw new AdminApiError('network', 'No hay implementación fetch disponible.');
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    let res;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: jsonBody === undefined ? undefined : JSON.stringify(jsonBody),
        signal: controller?.signal,
      });
    } catch (err) {
      throw new AdminApiError('network', `Fallo de red: ${err?.message || err}`);
    } finally {
      if (timer) clearTimeout(timer);
    }

    let body = null;
    try { body = await res.json(); } catch { body = null; }
    if (!res.ok) throw mapErrorResponse(res.status, body, res.headers);
    return { status: res.status, body };
  }

  return {
    demoMode,

    // Crea un conflicto. Valida en cliente ANTES de enviar; envía sólo el
    // subconjunto reconocido por el servidor (los metadatos editoriales quedan
    // en el cliente para el flujo/enriched view). Devuelve { status, body }.
    async createConflict(editorialPayload) {
      const { valid, errors, value } = validateEditorialConflict(editorialPayload, { partial: false });
      if (!valid) throw new AdminApiError('validation', 'El payload editorial no es válido.', { status: 422, details: { errors } });
      if (demoMode) return demoCreate(value);
      return request('POST', '/api/v1/admin/conflicts', toServerWritePayload(value));
    },

    // Edita un conflicto (patch parcial).
    async updateConflict(idOrSlug, editorialPatch) {
      const { valid, errors, value } = validateEditorialConflict(editorialPatch, { partial: true });
      if (!valid) throw new AdminApiError('validation', 'El patch editorial no es válido.', { status: 422, details: { errors } });
      if (demoMode) {
        return { status: 200, body: { data: { id: null, ref: idOrSlug, patch: toServerWritePayload(value) }, meta: { persisted: false, mode: 'prepared', note: DEMO_NOTE, demo: true } } };
      }
      return request('PATCH', `/api/v1/admin/conflicts/${encodeURIComponent(idOrSlug)}`, toServerWritePayload(value));
    },

    // Cambia el estado editorial. `fromStatus` opcional para validar la
    // transición en cliente (en prepared/sin DB no siempre se conoce).
    async setStatus(idOrSlug, toStatus, fromStatus = null) {
      const t = validateStatusTransition(fromStatus, toStatus);
      if (!t.valid) throw new AdminApiError('validation', 'Transición de estado inválida.', { status: 422, details: { errors: t.errors } });
      if (demoMode) {
        return { status: 200, body: { data: { id: null, ref: idOrSlug, cms_status: toStatus, status: toStatus === 'published' ? 'active' : (toStatus === 'review' ? 'draft' : toStatus) }, meta: { persisted: false, mode: 'prepared', note: DEMO_NOTE, demo: true } } };
      }
      return request('POST', `/api/v1/admin/conflicts/${encodeURIComponent(idOrSlug)}/status`, { status: toStatus });
    },
  };
}
