// GEOPÓLEM — Resolución técnica de bloqueos del RC con evidencia alternativa (Sprint 21)
// ---------------------------------------------------------------------------
// Módulo PURO (sin disco/red: la IO se inyecta) que construye SOBRE la gobernanza
// editorial del Sprint 20 (editorial-governance.mjs) para intentar RESOLVER
// TÉCNICAMENTE los 8 bloqueos del Release Candidate mediante FUENTES ALTERNATIVAS
// VERIFICABLES, sin publicar producción y sin aprobar como humano.
//
// Entradas:
//   • data/editorial-review-queue.rc.json               (cola RC clasificada, Sprint 19 — INTACTA)
//   • data/editorial-alternative-evidence.sprint21.json (evidencia alternativa verificada, Sprint 21)
//   • api/v1/staging/conflicts/<id>.json                (fuentes/causal_links reales)
//
// Produce:
//   1) COLA RESUELTA (overlay)  — cada pendiente con {previous_state, new_state,
//      transition, resolution} y las fuentes alternativas normalizadas. NUNCA
//      muta la cola RC del Sprint 19.
//   2) EVIDENCIA AMPLIADA        — paquete por pendiente que extiende el del Sprint
//      20 con las fuentes alternativas (URL, publisher, título, accessed_at,
//      accessed_via, tipo de evidencia, recomendación) y la traza de transición.
//   3) GO/NO-GO ACTUALIZADO      — veredicto equivalente que refleja los estados
//      nuevos (evidence_ready) pero mantiene el TOTAL en NO-GO: 'evidence_ready'
//      NO es GO; sólo una decisión 'approved' firmada lo sería, y este sprint NO
//      firma ni aprueba nada.
//
// REGLA DE ORO (invariantes duros, probados):
//   • NO AUTO-APROBACIÓN: el estado objetivo máximo es 'evidence_ready'. El módulo
//     NUNCA emite un estado de decisión terminal (approved/rejected/deferred),
//     ignore lo que ignore la entrada.
//   • Si no hay evidencia alternativa válida, el estado se MANTIENE (un
//     blocked_by_source sigue blocked_by_source).
//   • Determinista, sin datos inventados, sin secretos.
//   • Producción sigue DESHABILITADA por política (independiente de este módulo).
// ---------------------------------------------------------------------------

import {
  GOVERNANCE_STATES, DECISION_STATES,
  canTransition, initialStateFromClassification, buildEvidencePackage,
} from './editorial-governance.mjs';

export const RESOLUTION_CONTRACT = 'sprint-21-editorial-blocker-resolution-v1';
export const ALT_EVIDENCE_CONTRACT = 'sprint-21-alternative-evidence-v1';
export const RESOLVED_QUEUE_CONTRACT = 'sprint-21-editorial-review-queue-resolved-v1';
export const RESOLUTION_EVIDENCE_CONTRACT = 'sprint-21-editorial-resolution-evidence-v1';
export const RESOLUTION_GONOGO_CONTRACT = 'sprint-21-editorial-go-no-go-resolved-v1';

// Único estado al que este sprint puede AVANZAR un pendiente. Preparar evidencia
// nunca equivale a decidir: las decisiones (approved/rejected/deferred) son de un
// humano en un sprint posterior. Este techo es un invariante del módulo.
export const MAX_TARGET_STATE = 'evidence_ready';

const SECRET_HINTS = ['token', 'secret', 'password', 'passwd', 'apikey', 'api_key', 'private_key', 'bearer'];

function isPlainObject(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }
function str(v) { return typeof v === 'string' ? v.trim() : ''; }
function asArray(v) { return Array.isArray(v) ? v : []; }
function looksLikeSecret(text) {
  const low = String(text).toLowerCase();
  return SECRET_HINTS.some((h) => low.includes(h));
}

/* ==================== Índice de evidencia alternativa ==================== */

// Indexa las entradas de evidencia alternativa por clave de pendiente.
export function indexAlternativeEvidence(alt) {
  const byKey = {};
  for (const e of asArray(alt?.entries)) {
    const k = str(e.key);
    if (k) byKey[k] = e;
  }
  return byKey;
}

// Normaliza una fuente alternativa a la ficha ampliada esperada (campos estables).
function normalizeAltSource(s) {
  return {
    slug: str(s?.slug) || null,
    title: str(s?.title) || null,
    url: str(s?.url) || null,
    publisher: str(s?.publisher) || null,
    accessed_at: str(s?.accessed_at) || null,
    accessed_via: str(s?.accessed_via) || null,
    http_result: str(s?.http_result) || null,
    evidence_type: str(s?.evidence_type) || null,
    supports: str(s?.supports) || null,
    residual_for_human: str(s?.residual_for_human) || null,
    recommendation: str(s?.recommendation) || null,
  };
}

// ¿Es "utilizable" una fuente alternativa? Debe llevar URL, cómo se accedió y el
// resultado HTTP observado (trazabilidad mínima para no inventar datos).
function isUsableAltSource(s) {
  return Boolean(str(s?.url) && str(s?.accessed_via) && str(s?.http_result));
}

/* ==================== 1) Transición de estado ============================ */

/* --------------------------------------------------------------------------
   resolveItemState: decide el estado nuevo de un pendiente dado su ítem RC y su
   entrada de evidencia alternativa (si existe).

   Invariantes:
     • from = estado de gobernanza inicial (derivado de la clasificación RC).
     • Sólo se avanza a 'evidence_ready' y sólo si:
         - la entrada marca resolution === 'resolved_via_alternative_source',
         - hay ≥1 fuente alternativa utilizable (url + accessed_via + http_result),
         - la transición from→evidence_ready es válida en la máquina de estados.
     • Cualquier target_state que sea una DECISIÓN terminal se REFUSA (no
       auto-aprobación): el estado se mantiene y se registra el motivo.
     • Sin evidencia válida ⇒ el estado se MANTIENE (p.ej. blocked_by_source).
-------------------------------------------------------------------------- */
export function resolveItemState(rcItem, altEntry = null) {
  const from = initialStateFromClassification(str(rcItem?.classification));
  const reasons = [];

  if (!isPlainObject(altEntry)) {
    reasons.push('sin evidencia alternativa aportada: estado mantenido');
    return { from, to: from, valid: true, changed: false, resolution: 'unresolved_kept_blocked', reasons };
  }

  const requested = str(altEntry.target_state) || MAX_TARGET_STATE;
  if (DECISION_STATES.includes(requested)) {
    reasons.push(`auto-aprobación REFUSADA: "${requested}" es una decisión humana; el estado se mantiene`);
    return { from, to: from, valid: false, changed: false, resolution: 'auto_approval_refused', reasons };
  }
  if (requested !== MAX_TARGET_STATE) {
    reasons.push(`estado objetivo no permitido "${requested}"; el máximo es "${MAX_TARGET_STATE}"; estado mantenido`);
    return { from, to: from, valid: false, changed: false, resolution: 'unresolved_kept_blocked', reasons };
  }

  const usable = asArray(altEntry.alternative_sources).filter(isUsableAltSource);
  const resolvedFlag = str(altEntry.resolution) === 'resolved_via_alternative_source';
  if (!resolvedFlag || usable.length === 0) {
    reasons.push('sin fuente alternativa utilizable (falta url/accessed_via/http_result) o no marcada como resuelta: estado mantenido');
    return { from, to: from, valid: true, changed: false, resolution: 'unresolved_kept_blocked', reasons };
  }

  if (!canTransition(from, MAX_TARGET_STATE)) {
    reasons.push(`transición ${from}→${MAX_TARGET_STATE} no permitida por la máquina de estados: estado mantenido`);
    return { from, to: from, valid: false, changed: false, resolution: 'unresolved_kept_blocked', reasons };
  }

  reasons.push(`evidencia alternativa verificada (${usable.length} fuente/s): ${from}→${MAX_TARGET_STATE}`);
  return { from, to: MAX_TARGET_STATE, valid: true, changed: true, resolution: 'resolved_via_alternative_source', reasons };
}

/* ==================== 2) Cola resuelta (overlay) ========================= */

// Construye un ítem de la cola resuelta con traza completa antes/después.
export function buildResolvedItem(rcItem, altEntry = null) {
  const st = resolveItemState(rcItem, altEntry);
  const altSources = st.changed ? asArray(altEntry?.alternative_sources).map(normalizeAltSource) : [];
  return {
    key: str(rcItem?.key) || null,
    conflict: str(rcItem?.conflict) || null,
    type: str(rcItem?.type) || null,
    title: str(rcItem?.title) || null,
    source_slug: str(rcItem?.source_slug) || null,
    classification: str(rcItem?.classification) || null,
    previous_state: st.from,
    governance_state: st.to,
    transition: { from: st.from, to: st.to, valid: st.valid, changed: st.changed, reasons: st.reasons },
    resolution: st.resolution,
    supersedes_source_slug: st.changed ? (str(altEntry?.supersedes_source_slug) || null) : null,
    alternative_sources: altSources,
    // Nunca hay decisión en este sprint: dejamos el campo explícito para el humano.
    decision: null,
  };
}

/* --------------------------------------------------------------------------
   buildResolvedQueue: overlay determinista de la cola RC con estados resueltos.
   NO muta la cola RC. `generated_at` se hereda para ser reproducible/no-diff.
-------------------------------------------------------------------------- */
export function buildResolvedQueue({ rc, alt, generatedAt = null } = {}) {
  const items = isPlainObject(rc) ? asArray(rc.items) : [];
  const byKey = indexAlternativeEvidence(alt);
  const resolved = items.map((it) => buildResolvedItem(it, byKey[str(it.key)] || null));

  const byState = Object.fromEntries(GOVERNANCE_STATES.map((s) => [s, 0]));
  for (const r of resolved) byState[r.governance_state] += 1;

  const resolvedCount = resolved.filter((r) => r.resolution === 'resolved_via_alternative_source').length;
  const keptCount = resolved.length - resolvedCount;

  return {
    contract: RESOLVED_QUEUE_CONTRACT,
    generated_at: generatedAt,
    source_contract: isPlainObject(rc) ? (str(rc.contract) || null) : null,
    alt_evidence_contract: isPlainObject(alt) ? (str(alt.contract) || null) : null,
    notice: 'Cola RC con resolución técnica de bloqueos (Sprint 21). Overlay determinista derivado de la cola RC (intacta) y de evidencia alternativa verificada. Ningún pendiente se APRUEBA: el estado máximo es evidence_ready. Producción sigue bloqueada por política.',
    summary: {
      total: resolved.length,
      resolved_via_alternative_source: resolvedCount,
      kept_blocked: keptCount,
      by_state: byState,
      // Recordatorio explícito: preparar evidencia no aprueba nada.
      approved: 0,
      auto_approvals: 0,
    },
    items: resolved,
  };
}

/* ==================== 3) Evidencia ampliada ============================= */

/* --------------------------------------------------------------------------
   buildResolutionEvidencePackage: extiende el paquete de evidencia del Sprint 20
   con la resolución del Sprint 21 (transición + fuentes alternativas ampliadas).
-------------------------------------------------------------------------- */
export function buildResolutionEvidencePackage(rcItem, { conflictDetail = null, altEntry = null } = {}) {
  const base = buildEvidencePackage(rcItem, { conflictDetail });
  const resolved = buildResolvedItem(rcItem, altEntry);
  return {
    contract: RESOLUTION_EVIDENCE_CONTRACT,
    key: base.key,
    conflict: base.conflict,
    pending_type: base.pending_type,
    classification: base.classification,
    previous_state: resolved.previous_state,
    governance_state: resolved.governance_state,
    transition: resolved.transition,
    resolution: resolved.resolution,
    blocking_gate: base.blocking_gate,
    title: base.title,
    source_slug: base.source_slug,
    original_available_sources: base.available_sources,
    causal_link: base.causal_link,
    block_reason: base.block_reason,
    source_access_evidence: base.source_access_evidence,
    supersedes_source_slug: resolved.supersedes_source_slug,
    alternative_sources: resolved.alternative_sources,
    recommended_action: base.recommended_action,
    decision_required: base.decision_required,
    required_roles: base.required_roles,
    decision: null,
  };
}

// Renderiza el paquete de evidencia ampliada a Markdown revisable por humano.
export function renderResolutionEvidenceMarkdown(pkg) {
  const L = [];
  const label = pkg.pending_type === 'source-review'
    ? `${pkg.conflict} / fuente \`${pkg.source_slug}\``
    : `${pkg.conflict} / causal "${pkg.title}"`;
  L.push(`# Evidencia editorial ampliada — ${label}`);
  L.push('');
  L.push('> Paquete revisable por humano (GEOPÓLEM Sprint 21). Resolución técnica de');
  L.push('> bloqueos con fuentes alternativas verificadas. NO aprueba ni habilita producción.');
  L.push('');
  L.push('| Campo | Valor |');
  L.push('|-------|-------|');
  L.push(`| Clave | \`${pkg.key}\` |`);
  L.push(`| Conflicto | \`${pkg.conflict}\` |`);
  L.push(`| Tipo de pendiente | \`${pkg.pending_type}\` |`);
  L.push(`| Clasificación (RC) | \`${pkg.classification}\` |`);
  L.push(`| Estado anterior | \`${pkg.previous_state}\` |`);
  L.push(`| Estado nuevo | \`${pkg.governance_state}\` |`);
  L.push(`| Resolución | \`${pkg.resolution}\` |`);
  L.push(`| Gate que bloquea | \`${pkg.blocking_gate || '—'}\` |`);
  L.push('');
  L.push('## Transición de estado');
  L.push('');
  L.push(`- \`${pkg.transition.from}\` → \`${pkg.transition.to}\` (cambiado: \`${pkg.transition.changed}\`, válida: \`${pkg.transition.valid}\`)`);
  for (const r of pkg.transition.reasons) L.push(`- ${r}`);
  L.push('');
  L.push('## Razón de bloqueo (original)');
  L.push('');
  L.push(pkg.block_reason || '_(sin razón registrada)_');
  L.push('');
  if (pkg.source_access_evidence) {
    L.push('## Evidencia de acceso a la fuente original');
    L.push('');
    L.push(`- Intento: \`${pkg.source_access_evidence.attempted_via}\``);
    L.push(`- Resultado: \`${pkg.source_access_evidence.result}\``);
    if (pkg.source_access_evidence.observed) L.push(`- Observado: ${pkg.source_access_evidence.observed}`);
    L.push('');
  }
  if (pkg.supersedes_source_slug) {
    L.push(`> Fuente original inaccesible corroborada/sustituida: \`${pkg.supersedes_source_slug}\`.`);
    L.push('');
  }
  L.push('## Fuentes alternativas verificadas');
  L.push('');
  if (pkg.alternative_sources.length) {
    for (const s of pkg.alternative_sources) {
      L.push(`### ${s.title || s.slug || '(fuente)'}`);
      L.push('');
      if (s.url) L.push(`- URL: <${s.url}>`);
      if (s.publisher) L.push(`- Publisher: ${s.publisher}`);
      if (s.accessed_at) L.push(`- Accessed at: \`${s.accessed_at}\``);
      if (s.accessed_via) L.push(`- Accessed via: \`${s.accessed_via}\``);
      if (s.http_result) L.push(`- Resultado HTTP: \`${s.http_result}\``);
      if (s.evidence_type) L.push(`- Tipo de evidencia: \`${s.evidence_type}\``);
      if (s.supports) L.push(`- Respalda: ${s.supports}`);
      if (s.residual_for_human) L.push(`- Pendiente de juicio humano: ${s.residual_for_human}`);
      if (s.recommendation) L.push(`- Recomendación: ${s.recommendation}`);
      L.push('');
    }
  } else {
    L.push('_(sin fuentes alternativas verificadas: el bloqueo se mantiene)_');
    L.push('');
  }
  L.push('## Decisión requerida (humano, sprint posterior)');
  L.push('');
  L.push(pkg.decision_required);
  L.push('');
  L.push(`Firmas esperadas: ${pkg.required_roles.map((r) => `\`${r}\``).join(', ')}.`);
  L.push('');
  return `${L.join('\n')}`;
}

// Nombre de archivo estable/seguro para el .md de un item (derivado de la clave).
export function resolutionEvidenceFileName(key) {
  return `${String(key).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()}.md`;
}

// Manifiesto de los paquetes de evidencia ampliada de toda la cola RC. Determinista.
export function buildResolutionEvidenceManifest({ rc, alt, conflictDetails = {}, generatedAt = null } = {}) {
  const items = isPlainObject(rc) ? asArray(rc.items) : [];
  const byKey = indexAlternativeEvidence(alt);
  const packages = items.map((it) => {
    const pkg = buildResolutionEvidencePackage(it, {
      conflictDetail: conflictDetails[str(it.conflict)] || null,
      altEntry: byKey[str(it.key)] || null,
    });
    return { ...pkg, evidence_file: `evidence/${resolutionEvidenceFileName(pkg.key)}` };
  });
  const byState = Object.fromEntries(GOVERNANCE_STATES.map((s) => [s, 0]));
  for (const p of packages) byState[p.governance_state] += 1;

  return {
    contract: RESOLUTION_EVIDENCE_CONTRACT,
    generated_at: generatedAt,
    source_contract: isPlainObject(rc) ? (str(rc.contract) || null) : null,
    alt_evidence_contract: isPlainObject(alt) ? (str(alt.contract) || null) : null,
    notice: 'Paquetes de evidencia AMPLIADA (Sprint 21): resolución técnica de bloqueos con fuentes alternativas verificadas. Derivados sin inventar datos. NO aprueban ni habilitan producción.',
    summary: {
      total: packages.length,
      by_state: byState,
      resolved_via_alternative_source: packages.filter((p) => p.resolution === 'resolved_via_alternative_source').length,
      conflicts_affected: [...new Set(packages.map((p) => p.conflict))].filter(Boolean).sort(),
    },
    items: packages,
  };
}

// Verifica que el manifiesto de evidencia ampliada cubre exactamente la cola RC.
export function validateResolutionEvidenceManifest(manifest, rc) {
  const errors = [];
  const fail = (m) => errors.push(m);
  if (!isPlainObject(manifest)) { fail('resolution-evidence: no es objeto'); return { ok: false, errors }; }
  if (manifest.contract !== RESOLUTION_EVIDENCE_CONTRACT) fail(`resolution-evidence: contract != ${RESOLUTION_EVIDENCE_CONTRACT}`);
  const rcKeys = new Set(asArray(rc?.items).map((i) => str(i.key)).filter(Boolean));
  const evKeys = new Set(asArray(manifest.items).map((i) => str(i.key)).filter(Boolean));
  if (evKeys.size !== rcKeys.size) fail(`resolution-evidence: nº de items (${evKeys.size}) != cola RC (${rcKeys.size})`);
  for (const k of rcKeys) if (!evKeys.has(k)) fail(`resolution-evidence: falta paquete para "${k}"`);
  for (const it of asArray(manifest.items)) {
    if (!str(it.evidence_file)) fail(`resolution-evidence: item "${str(it.key)}" sin evidence_file`);
    if (!GOVERNANCE_STATES.includes(str(it.governance_state))) fail(`resolution-evidence: item "${str(it.key)}" estado inválido "${str(it.governance_state)}"`);
    // INVARIANTE: nunca un estado de decisión terminal en este sprint.
    if (DECISION_STATES.includes(str(it.governance_state))) fail(`resolution-evidence: item "${str(it.key)}" no puede estar en decisión terminal en Sprint 21`);
  }
  return { ok: errors.length === 0, errors };
}

/* ==================== 4) Validación de la evidencia alternativa ========== */

/* --------------------------------------------------------------------------
   validateAlternativeEvidence: valida el dataset curado de evidencia alternativa.
     • contrato correcto,
     • sin valores que aparenten secretos,
     • cada entrada referencia una clave real de la cola RC,
     • ningún target_state es una decisión terminal (no auto-aprobación),
     • las entradas "resueltas" llevan ≥1 fuente utilizable (url+accessed_via+http_result).
-------------------------------------------------------------------------- */
export function validateAlternativeEvidence(alt, rc) {
  const errors = [];
  const fail = (m) => errors.push(m);
  if (!isPlainObject(alt)) { fail('alt-evidence: no es objeto'); return { ok: false, errors }; }
  if (alt.contract !== ALT_EVIDENCE_CONTRACT) fail(`alt-evidence: contract != ${ALT_EVIDENCE_CONTRACT}`);
  if (looksLikeSecret(JSON.stringify(alt))) fail('alt-evidence: aparenta contener un secreto (token/clave/password): rechazado');

  const rcKeys = new Set(asArray(rc?.items).map((i) => str(i.key)).filter(Boolean));
  for (const e of asArray(alt.entries)) {
    const k = str(e.key);
    if (!k) { fail('alt-evidence: entrada sin "key"'); continue; }
    if (rcKeys.size && !rcKeys.has(k)) fail(`alt-evidence: clave desconocida "${k}" (no está en la cola RC)`);
    const target = str(e.target_state) || MAX_TARGET_STATE;
    if (DECISION_STATES.includes(target)) fail(`alt-evidence: "${k}" target_state "${target}" es una decisión humana (no auto-aprobación)`);
    if (str(e.resolution) === 'resolved_via_alternative_source') {
      const usable = asArray(e.alternative_sources).filter(isUsableAltSource);
      if (usable.length === 0) fail(`alt-evidence: "${k}" marcada resuelta pero sin fuente utilizable (url+accessed_via+http_result)`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/* ==================== 5) GO / NO-GO actualizado ========================= */

/* --------------------------------------------------------------------------
   buildResolvedGoNoGo: veredicto GO/NO-GO equivalente que refleja los estados
   resueltos (evidence_ready), pero mantiene el TOTAL en NO-GO.

   Un item es GO SÓLO si su decisión firmada es 'approved'. Este sprint NO firma
   ni aprueba nada, así que go=0 SIEMPRE. El total es GO sólo si todos los items
   son GO, la cobertura es ok, hay sign-off válido y la publicación está habilitada
   — condición imposible en este ciclo (publicación deshabilitada por política).
-------------------------------------------------------------------------- */
export function buildResolvedGoNoGo({
  resolvedQueue, coverage = null, signoffEval = null,
  publishEnabled = false, generatedAt = null,
} = {}) {
  const items = isPlainObject(resolvedQueue) ? asArray(resolvedQueue.items) : [];
  const decisions = isPlainObject(signoffEval) && isPlainObject(signoffEval.decisions_by_key)
    ? signoffEval.decisions_by_key : {};

  const perItem = items.map((it) => {
    const decision = str(decisions[str(it.key)]) || null;
    // El estado efectivo es la decisión firmada (si la hay) o el estado de gobernanza resuelto.
    const state = decision && DECISION_STATES.includes(decision) ? decision : str(it.governance_state);
    const go = state === 'approved';
    const reasons = [];
    if (!decision) reasons.push(`sin decisión firmada (estado: ${state})`);
    else if (!go) reasons.push(`decisión "${decision}" no es GO`);
    return {
      key: str(it.key) || null,
      conflict: str(it.conflict) || null,
      type: str(it.type) || null,
      classification: str(it.classification) || null,
      previous_state: str(it.previous_state) || null,
      state,
      decision,
      go,
      evidence_ready: state === 'evidence_ready',
      reasons,
    };
  });

  const goCount = perItem.filter((i) => i.go).length;
  const noGoCount = perItem.length - goCount;
  const evidenceReadyCount = perItem.filter((i) => i.evidence_ready).length;
  const stillBlockedCount = perItem.filter((i) => i.state === 'blocked_by_source' || i.state === 'needs_human_review').length;
  const coverageOk = Boolean(coverage && coverage.ok === true && coverage.coverage_ok === true);
  const signoffOk = Boolean(signoffEval && signoffEval.ok === true);

  const blockers = [];
  if (evidenceReadyCount > 0) blockers.push(`${evidenceReadyCount} pendiente/s en evidence_ready a la espera de decisión humana (approve/reject/defer)`);
  if (stillBlockedCount > 0) blockers.push(`${stillBlockedCount} pendiente/s aún bloqueado/s sin evidencia alternativa`);
  if (noGoCount > 0) blockers.push(`${noGoCount} pendiente/s sin decisión GO firmada`);
  if (!coverageOk) blockers.push('cobertura de staging incompleta o gate no ok');
  if (!signoffOk) blockers.push(`sign-off editorial ausente/ inválido${signoffEval?.is_example ? ' (es un EJEMPLO)' : ''}`);
  if (!publishEnabled) blockers.push('publicación a producción DESHABILITADA por política (PRODUCTION_PUBLISH_ENABLED=false)');

  const overallGo = noGoCount === 0 && coverageOk && signoffOk && publishEnabled;

  return {
    contract: RESOLUTION_GONOGO_CONTRACT,
    generated_at: generatedAt,
    is_production: false,
    decision: overallGo ? 'GO' : 'NO-GO',
    notice: 'Reporte GO/NO-GO ACTUALIZADO del Release Candidate (Sprint 21). Refleja la resolución técnica de bloqueos (evidence_ready) pero el TOTAL sigue NO-GO: evidence_ready NO es GO, no hay firmas y la publicación está deshabilitada por política. La aprobación humana es de un sprint posterior.',
    summary: {
      total: perItem.length,
      go: goCount,
      no_go: noGoCount,
      evidence_ready: evidenceReadyCount,
      still_blocked: stillBlockedCount,
      coverage_ok: coverageOk,
      signoff_ok: signoffOk,
      publish_enabled: publishEnabled,
    },
    coverage: coverage ? {
      coverage_pct: coverage.coverage_pct ?? null,
      ok: coverage.ok === true,
      coverage_ok: coverage.coverage_ok === true,
    } : null,
    blockers,
    traceability: {
      evidence_ready: perItem.filter((i) => i.evidence_ready).map((i) => ({ conflict: i.conflict, key: i.key, from: i.previous_state })),
      still_blocked: perItem.filter((i) => i.state === 'blocked_by_source' || i.state === 'needs_human_review').map((i) => ({ conflict: i.conflict, key: i.key, state: i.state })),
    },
    items: perItem,
  };
}
