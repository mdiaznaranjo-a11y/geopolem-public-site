// GEOPÓLEM — Clasificación accionable de la cola editorial para el Release Candidate (Sprint 19)
// ---------------------------------------------------------------------------
// Módulo PURO (sin disco/red) que toma la cola de revisión editorial residual
// (contrato sprint-18-editorial-review-queue-v1, producida por editorial-review.mjs)
// y asigna a cada pendiente una CLASIFICACIÓN accionable dentro de una taxonomía
// cerrada, junto con la razón y el gate que bloquea. NO inventa datos ni resuelve
// nada por su cuenta: la clasificación se deriva de forma determinista de los
// campos ya presentes en cada item (tipo, resolvable_in_repo) y, opcionalmente,
// de la EVIDENCIA de intentos de verificación aportada por el llamante.
//
// Taxonomía (cerrada):
//   • resolved            — verificable/cerrable con la evidencia disponible.
//   • needs_human_review  — requiere criterio/acción de un editor humano.
//   • deferred            — pospuesto deliberadamente a un sprint futuro.
//   • blocked_by_source   — la fuente externa es inaccesible con el tooling actual
//                           (p.ej. fetch directo devuelve 402/403 vía proxy).
//   • blocked_by_policy   — bloqueado por una política del proyecto (p.ej.
//                           publicación a producción DESHABILITADA).
//
// REGLA DE ORO: sin datos inventados. Si un pendiente no puede cerrarse con
// evidencia del repo, se mantiene pendiente con una razón clara y trazable.
// ---------------------------------------------------------------------------

export const EDITORIAL_RC_CONTRACT = 'sprint-19-editorial-review-rc-v1';

export const CLASSIFICATIONS = Object.freeze([
  'resolved',
  'needs_human_review',
  'deferred',
  'blocked_by_source',
  'blocked_by_policy',
]);

function isPlainObject(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }
function str(v) { return typeof v === 'string' ? v.trim() : ''; }
function asArray(v) { return Array.isArray(v) ? v : []; }

// Clave estable de un item para casarlo con la evidencia de verificación.
export function itemKey(item) {
  if (!isPlainObject(item)) return '';
  const conflict = str(item.conflict);
  if (item.type === 'source-review') return `${conflict}::source::${str(item.source_slug)}`;
  return `${conflict}::causal::${str(item.title)}`;
}

// Indexa la evidencia de verificación por clave de item. Cada entrada documenta un
// intento REAL de acceso (p.ej. re-fetch de la URL) con su resultado observado.
function indexEvidence(evidence) {
  const byKey = new Map();
  for (const e of asArray(evidence)) {
    if (!isPlainObject(e)) continue;
    const key = str(e.key) || itemKey(e);
    if (key) byKey.set(key, e);
  }
  return byKey;
}

/* --------------------------------------------------------------------------
   classifyItem: decide la clasificación de un único pendiente de forma
   determinista. La lógica NO inventa nada; se apoya en:
     • item.resolvable_in_repo === true  → 'resolved'
     • item.type === 'source-review'     → 'blocked_by_source' (fuente inaccesible)
     • item.type === 'causal-link-pending' → 'needs_human_review'
   La evidencia aportada (si la hay) sólo REFUERZA la razón; nunca "resuelve" por
   su cuenta un item cuya fuente sigue bloqueada.
-------------------------------------------------------------------------- */
export function classifyItem(item, evidenceEntry = null) {
  const conflict = str(item?.conflict);
  const type = str(item?.type);
  const base = {
    conflict,
    type,
    classification: 'needs_human_review',
    blocking_gate: 'editorial-signoff',
    resolvable_in_repo: item?.resolvable_in_repo === true,
    rationale: '',
    recommended_action: str(item?.recommended_action) || null,
    evidence: evidenceEntry ? {
      attempted_via: str(evidenceEntry.attempted_via) || null,
      result: str(evidenceEntry.result) || null,
      observed: str(evidenceEntry.observed) || null,
    } : null,
  };

  if (item?.resolvable_in_repo === true) {
    return { ...base, classification: 'resolved', blocking_gate: null, rationale: 'Verificable con las fuentes presentes en el repo; no requiere acceso externo.' };
  }

  if (type === 'source-review') {
    const via = str(item?.accessed_via) || 'web-search';
    const ev = evidenceEntry && str(evidenceEntry.result)
      ? ` Evidencia Sprint 19: intento de acceso directo (${str(evidenceEntry.attempted_via) || 'web-fetch'}) → ${str(evidenceEntry.result)}.`
      : '';
    return {
      ...base,
      classification: 'blocked_by_source',
      blocking_gate: 'source-access',
      rationale: `Fuente ${str(item?.source_slug)} accedida vía ${via}; el fetch directo sigue bloqueado por el proxy externo, por lo que no es cerrable con el tooling disponible. Requiere revisor humano con acceso directo o fuente equivalente accesible.${ev}`,
    };
  }

  if (type === 'causal-link-pending') {
    return {
      ...base,
      classification: 'needs_human_review',
      blocking_gate: 'editorial-signoff',
      rationale: `El vínculo causal "${str(item?.title)}" tiene fuente de contexto verificada, pero la afirmación causal concreta exige una fuente específica que la respalde. Aportarla es una decisión editorial humana; no es inventable.`,
    };
  }

  return { ...base, classification: 'needs_human_review', rationale: 'Tipo de pendiente no reconocido; requiere revisión humana.' };
}

/* --------------------------------------------------------------------------
   classifyReviewQueue: consolida la clasificación de toda la cola editorial.
   Determinista: preserva el orden de la cola de entrada y no usa Date.now().

   deps:
     queue        — objeto de la cola editorial (buildReviewQueue / artefacto).
     evidence     — array opcional de intentos de verificación reales:
                    { key?, conflict?, type?, source_slug?, title?, attempted_via,
                      result, observed }
     generatedAt  — timestamp determinista heredado (para artefactos no-diff).
     policyGate   — { publish_enabled:boolean, note } estado del gate de producción.
-------------------------------------------------------------------------- */
export function classifyReviewQueue({ queue, evidence = [], generatedAt = null, policyGate = null } = {}) {
  const items = isPlainObject(queue) ? asArray(queue.items) : [];
  const byKey = indexEvidence(evidence);

  const classified = items.map((it) => {
    const key = itemKey(it);
    return { key, title: str(it.title) || null, source_slug: str(it.source_slug) || null, ...classifyItem(it, byKey.get(key) || null) };
  });

  const counts = Object.fromEntries(CLASSIFICATIONS.map((c) => [c, 0]));
  for (const c of classified) counts[c.classification] += 1;

  const publishEnabled = policyGate ? policyGate.publish_enabled === true : false;
  const blockingProduction = classified.filter((c) => c.classification !== 'resolved').length;

  return {
    contract: EDITORIAL_RC_CONTRACT,
    generated_at: generatedAt,
    source_contract: isPlainObject(queue) ? (str(queue.contract) || null) : null,
    notice: 'Clasificación accionable de la cola editorial residual para el Release Candidate (Sprint 19). Derivada SIN inventar datos desde data/editorial-review-queue.json. La verificación de fuentes bloqueadas se reintentó en Sprint 19 y siguió fallando (402/403 vía proxy). Ningún pendiente se cierra sin sign-off humano; la publicación a producción permanece deshabilitada por política.',
    summary: {
      total: classified.length,
      by_classification: counts,
      resolved: counts.resolved,
      blocking_production: blockingProduction,
      conflicts_affected: [...new Set(classified.map((c) => c.conflict))].sort(),
    },
    policy_gate: {
      publish_enabled: publishEnabled,
      classification: publishEnabled ? null : 'blocked_by_policy',
      note: policyGate && str(policyGate.note)
        ? str(policyGate.note)
        : 'Publicación a producción DESHABILITADA por diseño (PRODUCTION_PUBLISH_ENABLED=false). Aunque se cerrasen todos los pendientes editoriales, la publicación real sigue bloqueada por política hasta un sprint futuro.',
    },
    items: classified,
  };
}
