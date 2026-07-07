// GEOPÓLEM API v1 (Sprint 7) — repositorio de escritura CMS/Admin.
// ---------------------------------------------------------------------------
// Orquesta la escritura de conflictos con DOS modos, elegidos de forma segura:
//
//   'database'  → sólo si GEOP_ADMIN_WRITES=true Y la DB es alcanzable. Ejecuta
//                 INSERT/UPDATE parametrizados (writeLayer en db.mjs).
//   'prepared'  → por defecto. Valida el contrato y DEVUELVE la entidad
//                 normalizada que se PERSISTIRÍA, con `persisted:false`. NO
//                 escribe en la DB ni en el puente estático, y NO inventa datos
//                 (no genera ids ni timestamps falsos). Es un stub seguro de
//                 contrato para que el frontend/CLI integren sin riesgo hasta
//                 que la escritura real se habilite en staging.
//
// Regla de oro preservada: la LECTURA pública (repository.mjs → DB→estático)
// no se toca. Aquí sólo vive la superficie de escritura administrativa.
// ---------------------------------------------------------------------------

import { CONFIG, adminWritesConfigState } from './config.mjs';
import { cmsStatusToDbStatus } from './validation.mjs';

// Resuelve el estado EFECTIVO de la escritura en tiempo de ejecución,
// combinando la configuración (adminWritesConfigState) con la alcanzabilidad
// real de la DB (Sprint 9, fail-closed):
//   'prepared'     → escritura deshabilitada (por defecto): sólo valida contrato.
//   'misconfigured'→ escritura ACTIVADA por el operador pero falta DATABASE_URL.
//   'unavailable'  → escritura ACTIVADA y con DATABASE_URL, pero la DB no es
//                    alcanzable (o falta el paquete "pg").
//   'database'     → escritura ACTIVADA y DB alcanzable: se persiste de verdad.
//
// La diferencia clave frente a Sprint 7/8: cuando el operador PIDE escritura
// real y el entorno está incompleto, NO degradamos silenciosamente a 'prepared'
// (que devolvía 200 fingiendo éxito). En su lugar señalamos el problema para que
// el handler responda 503 y el guardado no se dé por hecho.
export async function writesConfigState() {
  const cfg = adminWritesConfigState();
  if (cfg !== 'enabled') return cfg; // 'prepared' | 'misconfigured'
  try {
    const { writeLayer } = await import('./db.mjs');
    return (await writeLayer.available()) ? 'database' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

// ¿Podemos escribir de verdad? Requiere el interruptor explícito y DB viva.
// Se mantiene por compatibilidad; delega en writesConfigState().
export async function writesEnabled() {
  return (await writesConfigState()) === 'database';
}

// Respuesta uniforme del repositorio: { conflict, persisted, mode, note? }.
function prepared(conflict, note) {
  return { conflict, persisted: false, mode: 'prepared', note };
}
function persistedResult(conflict) {
  return { conflict, persisted: true, mode: 'database' };
}

// Resultado fail-closed cuando la escritura fue solicitada pero el entorno está
// incompleto. `mode` distingue el motivo para diagnóstico del operador.
function unavailableResult(state) {
  const reason = state === 'misconfigured'
    ? 'GEOP_ADMIN_WRITES=true pero falta DATABASE_URL: escritura no persistida (fail-closed).'
    : 'GEOP_ADMIN_WRITES=true pero la base de datos no es alcanzable: escritura no persistida (fail-closed).';
  return { conflict: null, persisted: false, mode: 'unavailable', state, reason };
}

const PREPARED_NOTE = 'Escritura no habilitada (GEOP_ADMIN_WRITES=false): '
  + 'contrato validado, entidad NO persistida.';

// Crea un conflicto (o devuelve la entidad preparada sin persistir).
export async function createConflict(input) {
  const cmsStatus = input.status || 'draft';
  const dbStatus = cmsStatusToDbStatus(cmsStatus);

  const state = await writesConfigState();
  if (state === 'misconfigured' || state === 'unavailable') return unavailableResult(state);

  if (state === 'database') {
    const { writeLayer } = await import('./db.mjs');
    const conflict = await writeLayer.createConflict(input, dbStatus);
    return persistedResult({ ...conflict, cms_status: cmsStatus });
  }

  // Modo prepared: eco normalizado, sin id ni timestamps fabricados.
  return prepared({
    id: null,
    slug: input.slug,
    name: input.name,
    summary: input.summary ?? null,
    conflict_type: input.conflict_type ?? null,
    primary_region: input.primary_region ?? null,
    status: dbStatus,
    cms_status: cmsStatus,
    metrics: {
      intensity_level: input.intensity_level ?? null,
      escalation_risk: input.escalation_risk ?? null,
      humanitarian_impact: input.humanitarian_impact ?? null,
    },
    dimensions: {
      energy: input.energy_dimension ?? false,
      territorial: input.territorial_dimension ?? false,
      external_involvement: input.external_involvement ?? false,
    },
    location: input.location ?? null,
  }, PREPARED_NOTE);
}

// Actualiza un conflicto (o prepara el patch sin persistir).
export async function updateConflict(idOrSlug, patch) {
  const cmsStatus = patch.status;
  const dbStatus = cmsStatus ? cmsStatusToDbStatus(cmsStatus) : null;

  const state = await writesConfigState();
  if (state === 'misconfigured' || state === 'unavailable') return unavailableResult(state);

  if (state === 'database') {
    const { writeLayer } = await import('./db.mjs');
    const conflict = await writeLayer.updateConflict(idOrSlug, patch, dbStatus);
    if (!conflict) return { conflict: null, persisted: false, mode: 'database' };
    return persistedResult({ ...conflict, ...(cmsStatus ? { cms_status: cmsStatus } : {}) });
  }

  return prepared({
    id: null,
    ref: idOrSlug,
    patch,
    ...(cmsStatus ? { cms_status: cmsStatus, status: dbStatus } : {}),
  }, PREPARED_NOTE);
}

// Cambia el estado editorial (o prepara la transición sin persistir).
// `fromStatus` (opcional) sólo se conoce con persistencia real.
export async function setConflictStatus(idOrSlug, toCmsStatus) {
  const dbStatus = cmsStatusToDbStatus(toCmsStatus);

  const state = await writesConfigState();
  if (state === 'misconfigured' || state === 'unavailable') return unavailableResult(state);

  if (state === 'database') {
    const { writeLayer } = await import('./db.mjs');
    const conflict = await writeLayer.setStatus(idOrSlug, dbStatus);
    if (!conflict) return { conflict: null, persisted: false, mode: 'database' };
    return persistedResult({ ...conflict, cms_status: toCmsStatus });
  }

  return prepared({
    id: null,
    ref: idOrSlug,
    cms_status: toCmsStatus,
    status: dbStatus,
  }, PREPARED_NOTE);
}

// Lee el estado editorial actual de un conflicto para validar transiciones.
// Devuelve el estado editorial (draft/review/published/archived) o null si no
// se conoce (modo prepared / sin DB): en ese caso la transición no se valida
// estrictamente (ver validateStatusTransition).
export async function currentCmsStatus(idOrSlug) {
  if (!(await writesEnabled())) return null;
  try {
    const { queryLayer } = await import('./db.mjs');
    const found = await queryLayer.getConflict(idOrSlug);
    if (!found) return null;
    const { dbStatusToCmsStatus } = await import('./validation.mjs');
    return dbStatusToCmsStatus(found.status);
  } catch {
    return null;
  }
}
