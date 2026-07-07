// GEOPÓLEM — DISEÑO del gate de habilitación de PRODUCCIÓN (Sprint 23)
// ---------------------------------------------------------------------------
// Módulo PURO que MODELA (no activa) el gate explícito de habilitación de
// producción. Reúne en un ÚNICO veredicto auditable todas las condiciones que
// tendrían que cumplirse para publicar, integrando el trabajo de sprints previos:
//
//   • Decisión editorial humana GO 8/8 (Sprint 22, editorial-decision.mjs).
//   • Cobertura de staging ok (Sprint 15/16).
//   • Sign-off editorial (Sprint 20, promotion-signoff.mjs).
//   • Segunda confirmación de release, no-CI (Sprint 18, release-confirmation.mjs).
//   • Firmas criptográficas opcionales sin ninguna inválida (Sprint 23).
//   • La BANDERA GLOBAL PRODUCTION_PUBLISH_ENABLED (release-confirmation.mjs).
//
// GARANTÍA CENTRAL: en este sprint el gate está CERRADO por diseño. Aunque TODAS
// las demás condiciones se cumplieran (incluso con firmas de EJEMPLO), la bandera
// PRODUCTION_PUBLISH_ENABLED=false mantiene `production_enabled:false` y el gate
// CERRADO. Habilitar producción es una decisión de un sprint futuro que exige
// cambiar esa bandera con escritura canónica y rollback; este módulo sólo diseña
// y prueba el gate, nunca publica.
// ---------------------------------------------------------------------------

import { PRODUCTION_PUBLISH_ENABLED } from './release-confirmation.mjs';

export const PRODUCTION_GATE_CONTRACT = 'sprint-23-production-gate-design-v1';

function isPlainObject(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }
function str(v) { return typeof v === 'string' ? v.trim() : ''; }

// Las condiciones DURAS del gate. Todas deben ser verdaderas para ABRIR el gate;
// además, la publicación real exige la bandera global (segunda barrera).
export const GATE_CONDITIONS = Object.freeze([
  'decisions_go',        // 8/8 items approved con integridad (Sprint 22)
  'decisions_valid',     // set de decisiones válido (no ejemplo, no obsoleto)
  'coverage_ok',         // cobertura de staging completa
  'editorial_signoff',   // sign-off editorial (Sprint 20)
  'second_confirmation', // segunda confirmación no-CI (Sprint 18)
  'signatures_ok',       // ninguna firma criptográfica presente e inválida (Sprint 23)
]);

/* --------------------------------------------------------------------------
   evaluateProductionGate: veredicto auditable del gate de producción.

   deps:
     decisionGoNoGo   — salida de buildDecisionGoNoGo (Sprint 22).
     signoff          — salida de resolveEditorialSignoff/promotion-signoff.
     confirmation     — salida de resolveReleaseConfirmation (Sprint 18).
     signatureSummary — salida de summarizeDecisionSignatures (Sprint 23).
     requireSignatures— regla EXPLÍCITA (default false): si true, exige que TODAS
                        las firmas requeridas estén presentes y verificadas.
     publishEnabled   — bandera global (default = PRODUCTION_PUBLISH_ENABLED=false).
     generatedAt      — timestamp determinista heredado.

   Devuelve un reporte con:
     production_enabled — SIEMPRE false en este sprint (por la bandera).
     gate_open          — ¿se cumplen TODAS las condiciones duras?
     ready_to_publish   — gate_open && publish_enabled (SIEMPRE false aquí).
     conditions{}       — estado de cada condición.
     blockers[]         — motivos legibles de por qué NO se puede publicar.
-------------------------------------------------------------------------- */
export function evaluateProductionGate({
  decisionGoNoGo = null, signoff = null, confirmation = null, signatureSummary = null,
  requireSignatures = false, publishEnabled = PRODUCTION_PUBLISH_ENABLED, generatedAt = null,
} = {}) {
  const summary = isPlainObject(decisionGoNoGo?.summary) ? decisionGoNoGo.summary : {};
  const total = Number(summary.total) || 0;
  const noGo = Number(summary.no_go) || 0;

  const decisionsGo = total > 0 && noGo === 0;
  const decisionsValid = summary.decision_ok === true;
  const coverageOk = summary.coverage_ok === true;
  const signoffOk = Boolean(signoff && signoff.ok === true);
  const confirmationOk = Boolean(confirmation && confirmation.ok === true);

  // Firmas: son OPCIONALES. La condición se cumple si no hay ninguna firma
  // PRESENTE e INVÁLIDA. Si requireSignatures=true, además exige cobertura total
  // de firmas verificadas (una por decisión).
  const noInvalidSignatures = !signatureSummary || signatureSummary.ok === true;
  let signaturesOk = noInvalidSignatures;
  if (requireSignatures) {
    const signed = Number(signatureSummary?.verified) || 0;
    const totalDecisions = Number(signatureSummary?.total_decisions) || 0;
    signaturesOk = noInvalidSignatures && totalDecisions > 0 && signed === totalDecisions;
  }

  const conditions = {
    decisions_go: decisionsGo,
    decisions_valid: decisionsValid,
    coverage_ok: coverageOk,
    editorial_signoff: signoffOk,
    second_confirmation: confirmationOk,
    signatures_ok: signaturesOk,
  };

  const gateOpen = GATE_CONDITIONS.every((c) => conditions[c] === true);
  const enabled = publishEnabled === true;
  const readyToPublish = gateOpen && enabled;

  const blockers = [];
  if (!decisionsGo) blockers.push(`decisión editorial no es GO 8/8 (${total - noGo}/${total} GO)`);
  if (!decisionsValid) blockers.push('set de decisiones ausente/ inválido (o es un EJEMPLO)');
  if (!coverageOk) blockers.push('cobertura de staging incompleta');
  if (!signoffOk) blockers.push(`sign-off editorial ausente/ inválido: ${(signoff && signoff.reason) || 'no provisto'}`);
  if (!confirmationOk) blockers.push(`segunda confirmación ausente/ inválida: ${(confirmation && confirmation.reason) || 'no provista'}`);
  if (!signaturesOk) {
    blockers.push(requireSignatures
      ? 'firmas criptográficas requeridas incompletas o inválidas'
      : 'hay firmas criptográficas presentes pero inválidas');
  }
  // La segunda barrera SIEMPRE se reporta cuando la bandera está en false.
  if (!enabled) {
    blockers.push('publicación a producción DESHABILITADA por política (PRODUCTION_PUBLISH_ENABLED=false)');
  }

  return {
    contract: PRODUCTION_GATE_CONTRACT,
    generated_at: generatedAt,
    // Invariante de seguridad del sprint: nunca true.
    production_enabled: false,
    gate_open: gateOpen,
    ready_to_publish: readyToPublish,
    publish_enabled: enabled,
    require_signatures: requireSignatures === true,
    decision: readyToPublish ? 'ENABLE-PRODUCTION' : 'PRODUCTION-DISABLED',
    notice: 'DISEÑO del gate de habilitación de producción (Sprint 23). Reúne todas las condiciones necesarias para publicar pero NO activa producción: PRODUCTION_PUBLISH_ENABLED=false mantiene el gate CERRADO aunque el resto se cumpla, incluso con firmas de ejemplo. Habilitar producción es una decisión explícita de un sprint futuro.',
    conditions,
    blockers,
    inputs: {
      decision_source: str(decisionGoNoGo?.decision_source) || 'none',
      decision_total: total,
      decision_no_go: noGo,
      signoff_source: str(signoff?.source) || 'none',
      confirmation_source: str(confirmation?.source) || 'none',
      signatures_signed: Number(signatureSummary?.signed) || 0,
      signatures_verified: Number(signatureSummary?.verified) || 0,
      signatures_invalid: Number(signatureSummary?.invalid) || 0,
    },
  };
}
