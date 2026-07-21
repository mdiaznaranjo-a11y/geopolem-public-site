// GEOPÓLEM — Validación REFORZADA de roles y trazabilidad (Sprint 23)
// ---------------------------------------------------------------------------
// Módulo PURO que añade comprobaciones REFORZADAS sobre el flujo de decisión del
// Sprint 22 (editorial-decision.mjs) SIN alterar su contrato. Se aplica como una
// capa adicional: primero se valida con validateDecisionSet (Sprint 22) y luego
// se refuerza aquí. Cubre exactamente lo pedido en el Sprint 23:
//
//   1) SEPARACIÓN DE ROLES POR IDENTIDAD: una misma persona (`decided_by`) no
//      puede rellenar más de un rol requerido del MISMO item (p. ej. el `owner`
//      no puede suplantar a `reviewer`/`editor`), salvo que una regla EXPLÍCITA
//      lo permita (allowMultiRoleSigner=true, desaconsejado y auditado).
//   2) TRAZABILIDAD SUFICIENTE: cada firma de una aprobación exige identidad
//      (`decided_by`) para poder auditar quién decidió.
//   3) VIGENCIA POR FECHA: `decided_at` no puede ser anterior a la fecha de la
//      evidencia vigente (no se decide sobre evidencia que aún no existía) ni
//      posterior a `today` (no se firma en el futuro).
//   4) RATIONALE MÍNIMO: la justificación debe superar un umbral de longitud
//      (no basta un carácter); refuerza la exigencia de rationale no vacío.
//
// El hash de manifiesto/fuentes (evidencia no obsoleta) ya lo garantiza el
// Sprint 22; aquí se re-expone su estado para un informe único. NO habilita
// producción y NO firma nada.
// ---------------------------------------------------------------------------

import { ROLES } from './editorial-governance.mjs';
import { REQUIRED_APPROVAL_ROLES } from './editorial-decision.mjs';

export const ROLE_VALIDATION_CONTRACT = 'sprint-23-editorial-role-validation-v1';

// Longitud mínima de rationale (tras recortar espacios). Un rationale más corto
// se considera insuficiente para justificar una decisión editorial.
export const RATIONALE_MIN_LEN = 12;

function isPlainObject(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }
function str(v) { return typeof v === 'string' ? v.trim() : ''; }
function asArray(v) { return Array.isArray(v) ? v : []; }

// Extrae YYYY-MM-DD de un timestamp ISO o de una fecha ya en formato fecha.
function toDateOnly(text) {
  const s = str(text);
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : '';
}

/* --------------------------------------------------------------------------
   reinforcedValidateDecisions: aplica las comprobaciones reforzadas sobre las
   firmas de un set de decisiones.

   deps:
     decisions            — array de firmas (decisionSet.decisions).
     evidenceGeneratedAt  — generated_at del manifiesto de evidencia vigente
                            (para la vigencia por fecha).
     today                — fecha YYYY-MM-DD de referencia (no se firma en futuro).
     allowMultiRoleSigner — regla EXPLÍCITA (default false): si true, una misma
                            identidad puede firmar varios roles del mismo item
                            (se audita como advertencia; desaconsejado).

   Devuelve { ok, errors[], warnings[], per_item{ item_id: { signers[],
              multi_role_identities[] } } }.
-------------------------------------------------------------------------- */
export function reinforcedValidateDecisions({
  decisions = [], evidenceGeneratedAt = null, today = null, allowMultiRoleSigner = false,
} = {}) {
  const errors = [];
  const warnings = [];
  const perItem = {};

  const evidenceDate = toDateOnly(evidenceGeneratedAt);
  const todayDate = toDateOnly(today);

  // identidad → roles firmados, agrupado por item.
  const identityRolesByItem = new Map();

  for (const entry of asArray(decisions)) {
    const itemId = str(entry?.item_id);
    const role = str(entry?.decided_by_role).toLowerCase();
    const identity = str(entry?.decided_by);
    const rationale = str(entry?.rationale);
    const decidedAt = str(entry?.decided_at);
    const tag = `"${itemId || '∅'}" (${role || '∅'}${identity ? `/${identity}` : ''})`;

    if (!perItem[itemId]) perItem[itemId] = { signers: [], multi_role_identities: [] };
    perItem[itemId].signers.push({ role, identity: identity || null, decision: str(entry?.decision).toLowerCase() });

    // 2) Trazabilidad: identidad obligatoria.
    if (!identity) {
      errors.push(`${tag} falta "decided_by" (identidad): sin trazabilidad suficiente`);
    }

    // 4) Rationale mínimo.
    if (rationale && rationale.length < RATIONALE_MIN_LEN) {
      errors.push(`${tag} rationale demasiado corto (${rationale.length}<${RATIONALE_MIN_LEN}): justificación insuficiente`);
    }

    // 3) Vigencia por fecha.
    if (/^\d{4}-\d{2}-\d{2}$/.test(decidedAt)) {
      if (evidenceDate && decidedAt < evidenceDate) {
        errors.push(`${tag} decided_at ${decidedAt} es anterior a la evidencia vigente (${evidenceDate}): decisión sobre evidencia inexistente`);
      }
      if (todayDate && decidedAt > todayDate) {
        errors.push(`${tag} decided_at ${decidedAt} está en el futuro (> ${todayDate}): firma no vigente`);
      }
    }

    // 1) Separación de roles por identidad (acumular).
    if (identity && ROLES.includes(role)) {
      const key = itemId;
      if (!identityRolesByItem.has(key)) identityRolesByItem.set(key, new Map());
      const idMap = identityRolesByItem.get(key);
      if (!idMap.has(identity)) idMap.set(identity, new Set());
      idMap.get(identity).add(role);
    }
  }

  // 1) Evaluar identidades que firman múltiples roles requeridos del mismo item.
  for (const [itemId, idMap] of identityRolesByItem.entries()) {
    for (const [identity, roleSet] of idMap.entries()) {
      const requiredRoles = [...roleSet].filter((r) => REQUIRED_APPROVAL_ROLES.includes(r));
      if (requiredRoles.length > 1) {
        perItem[itemId].multi_role_identities.push({ identity, roles: requiredRoles.sort() });
        const msg = `"${itemId}" la identidad "${identity}" firma múltiples roles requeridos (${requiredRoles.sort().join(', ')}): una persona no puede suplantar varios roles`;
        if (allowMultiRoleSigner) warnings.push(`${msg} [permitido por regla explícita]`);
        else errors.push(msg);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings, per_item: perItem };
}
