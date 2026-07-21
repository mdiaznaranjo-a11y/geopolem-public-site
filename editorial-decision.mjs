// GEOPÓLEM — Flujo de decisión editorial humana (Sprint 22)
// ---------------------------------------------------------------------------
// Módulo PURO (sin disco/red: la IO se inyecta; el hashing sha256 es
// determinista) que formaliza la DECISIÓN EDITORIAL HUMANA sobre los 8 paquetes
// `evidence_ready` que dejó el Sprint 21. Construye sobre la gobernanza del
// Sprint 20 (editorial-governance.mjs) y NO inventa datos:
//   • editorial-review/sprint21/manifest.json      (evidencia ampliada, Sprint 21)
//   • data/editorial-review-queue.sprint21.json    (cola resuelta a evidence_ready)
//
// Aporta cinco piezas complementarias:
//   1) MODELO DE DECISIÓN  — estructura por item con firma de rol individual:
//      item_id, decision, rationale, decided_by_role, decided_at,
//      evidence_manifest_hash, source_hashes, optional_conditions.
//   2) INTEGRIDAD/HASH     — un hash determinista de la evidencia vigente por
//      item y del manifiesto completo; una decisión que no case con el hash
//      actual se considera OBSOLETA y no cuenta (no se aprueba evidencia rancia).
//   3) REGLAS DE ROLES     — approved final exige las 3 firmas (reviewer+editor
//      +owner, con owner presente); rejected/deferred son terminales y auditables
//      con una sola firma de rol requerido.
//   4) VALIDACIÓN          — detecta decisiones incompletas, roles duplicados,
//      rationale vacío, hash de manifiesto/fuente no coincidente, secretos y
//      cualquier intento de auto-aprobación por parte del tooling.
//   5) GO/NO-GO            — veredicto auditable por item y total. La publicación
//      real a producción permanece DESHABILITADA por política; sin decisiones
//      reales el total es NO-GO.
//
// REGLA DE ORO: determinista (mismas entradas → misma salida), sin datos
// inventados, sin secretos. El tooling NUNCA firma por un humano: sólo valida
// firmas declaradas y calcula el veredicto.
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import { ROLES, DECISION_STATES, GO_STATES, GOVERNANCE_STATES } from './editorial-governance.mjs';

export const DECISION_CONTRACT = 'sprint-22-editorial-decision-v1';
export const DECISION_GONOGO_CONTRACT = 'sprint-22-editorial-decision-go-no-go-v1';

// El estado `evidence_ready` es el único punto de partida legítimo para decidir.
export const DECIDABLE_STATE = 'evidence_ready';

// Regla de aprobación: TODOS los roles deben firmar `approved` y `owner` debe
// estar entre ellos ("owner final"). Cualquier firma `rejected`/`deferred` de un
// rol requerido es terminal y auditable por sí sola.
export const REQUIRED_APPROVAL_ROLES = Object.freeze([...ROLES]);
export const FINAL_AUTHORITY_ROLE = 'owner';

const SECRET_HINTS = ['token', 'secret', 'password', 'passwd', 'apikey', 'api_key', 'private_key', 'bearer'];

function isPlainObject(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }
function str(v) { return typeof v === 'string' ? v.trim() : ''; }
function asArray(v) { return Array.isArray(v) ? v : []; }
function looksLikeSecret(text) {
  const low = String(text).toLowerCase();
  return SECRET_HINTS.some((h) => low.includes(h));
}
function sha256Hex(text) { return createHash('sha256').update(text, 'utf8').digest('hex'); }

/* ==================== 1) INTEGRIDAD / HASH DE EVIDENCIA ================== */

// Proyección canónica y estable de una fuente alternativa (orden de campos fijo).
// Sólo campos verificables/materiales: cambiar cualquiera cambia el hash.
function projectSource(s) {
  return {
    slug: str(s?.slug),
    url: str(s?.url),
    http_result: str(s?.http_result),
    evidence_type: str(s?.evidence_type),
    supports: str(s?.supports),
  };
}

// Proyección canónica de un item de evidencia (Sprint 21): estado + fuentes
// alternativas ordenadas por slug. Determinista e independiente del formato.
function projectItem(item) {
  const sources = asArray(item?.alternative_sources)
    .map(projectSource)
    .sort((a, b) => a.slug.localeCompare(b.slug));
  return {
    key: str(item?.key),
    governance_state: str(item?.governance_state) || str(item?.state),
    alternative_sources: sources,
  };
}

// Hash sha256 (prefijado) de las fuentes de UN item: liga la decisión a la
// evidencia concreta que un humano revisó. Se expone por slug para trazabilidad.
export function computeItemSourceHashes(item) {
  const out = {};
  for (const s of asArray(item?.alternative_sources)) {
    const slug = str(s?.slug);
    if (!slug) continue;
    out[slug] = `sha256:${sha256Hex(JSON.stringify(projectSource(s)))}`;
  }
  return out;
}

// Hash sha256 (prefijado) del manifiesto de evidencia completo: liga la decisión
// al lote de evidencia vigente. Si la evidencia se regenera con cambios, el hash
// cambia y las decisiones previas quedan OBSOLETAS.
export function computeEvidenceManifestHash(manifest) {
  const items = asArray(manifest?.items)
    .map(projectItem)
    .sort((a, b) => a.key.localeCompare(b.key));
  return `sha256:${sha256Hex(JSON.stringify(items))}`;
}

// Indexa los items del manifiesto de evidencia por su clave (item_id).
export function indexEvidenceItems(manifest) {
  const idx = {};
  for (const it of asArray(manifest?.items)) {
    const key = str(it?.key);
    if (key) idx[key] = it;
  }
  return idx;
}

/* ==================== 2) VALIDACIÓN DE UNA FIRMA ======================== */

/* --------------------------------------------------------------------------
   validateDecisionEntry: valida la ESTRUCTURA de una firma de decisión por rol.

   Estructura (una entrada = la firma de UN rol sobre UN item):
     { item_id, decision, rationale, decided_by_role, decided_at,
       evidence_manifest_hash, source_hashes:{slug:hash}, optional_conditions:[] }

   No comprueba integridad de hash aquí (eso exige el manifiesto vigente); sólo
   forma. Devuelve { ok, item_id, role, decision, errors[] }.
-------------------------------------------------------------------------- */
export function validateDecisionEntry(entry) {
  const errors = [];
  const itemId = str(entry?.item_id);
  const role = str(entry?.decided_by_role).toLowerCase();
  const decision = str(entry?.decision).toLowerCase();

  if (!itemId) errors.push('decisión sin "item_id"');
  if (!ROLES.includes(role)) {
    errors.push(`"${itemId || '∅'}" decided_by_role inválido "${role || '∅'}" (esperado ${ROLES.join('|')})`);
  }
  if (!DECISION_STATES.includes(decision)) {
    errors.push(`"${itemId || '∅'}" decision debe ser ${DECISION_STATES.join('|')} (recibido "${decision || '∅'}")`);
  }
  if (!str(entry?.rationale)) {
    errors.push(`"${itemId || '∅'}" (${role || '∅'}) rationale vacío: toda decisión exige justificación`);
  }
  const decidedAt = str(entry?.decided_at);
  if (!decidedAt) errors.push(`"${itemId || '∅'}" (${role || '∅'}) falta decided_at`);
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(decidedAt)) errors.push(`"${itemId || '∅'}" decided_at debe ser YYYY-MM-DD`);

  if (!str(entry?.evidence_manifest_hash)) {
    errors.push(`"${itemId || '∅'}" (${role || '∅'}) falta evidence_manifest_hash (liga la firma a la evidencia)`);
  }
  if (!isPlainObject(entry?.source_hashes) || Object.keys(entry.source_hashes).length === 0) {
    errors.push(`"${itemId || '∅'}" (${role || '∅'}) falta source_hashes (liga la firma a las fuentes)`);
  }
  if (entry?.optional_conditions != null && !Array.isArray(entry.optional_conditions)) {
    errors.push(`"${itemId || '∅'}" optional_conditions debe ser una lista`);
  }
  if (looksLikeSecret(JSON.stringify(entry ?? {}))) {
    errors.push(`"${itemId || '∅'}" aparenta contener un secreto (token/clave/password): rechazado`);
  }

  return { ok: errors.length === 0, item_id: itemId, role, decision, errors };
}

/* ==================== 3) DECISIÓN AGREGADA POR ITEM ===================== */

/* --------------------------------------------------------------------------
   evaluateItemDecision: agrega las firmas de un item y calcula su decisión
   final aplicando las reglas de roles e integridad.

   Reglas:
     • El item debe partir de `evidence_ready` (si no, no es decidible).
     • Cada firma debe casar con el evidence_manifest_hash VIGENTE y con los
       source_hashes de la evidencia actual (si no, es obsoleta y no cuenta).
     • Roles duplicados (mismo rol firma dos veces el item) → inválido.
     • APPROVED final: las 3 firmas (reviewer+editor+owner) con decision
       `approved` e integridad correcta; owner debe estar presente.
     • REJECTED final: ≥1 firma válida de rol requerido con `rejected`.
     • DEFERRED final: ≥1 firma válida `deferred` y ninguna `rejected`.
     • En cualquier otro caso: incompleto → el item permanece evidence_ready.

   deps:
     evidenceItem   — item del manifiesto de evidencia vigente (para hashes).
     manifestHash   — hash del manifiesto vigente (computeEvidenceManifestHash).

   Devuelve { item_id, final_decision, go, complete, roles_present[],
              missing_roles[], errors[], sign_offs[] }.
-------------------------------------------------------------------------- */
export function evaluateItemDecision(itemId, entries, { evidenceItem = null, manifestHash = null } = {}) {
  const errors = [];
  const validSignOffs = [];
  const rolesSeen = new Map();

  const state = str(evidenceItem?.governance_state) || str(evidenceItem?.state);
  if (!evidenceItem) {
    errors.push(`"${itemId}" no existe en la evidencia vigente: decisión sin objeto`);
  } else if (state !== DECIDABLE_STATE) {
    errors.push(`"${itemId}" no es decidible (estado "${state || '∅'}"; se exige ${DECIDABLE_STATE})`);
  }

  const currentSourceHashes = evidenceItem ? computeItemSourceHashes(evidenceItem) : {};
  const currentSlugs = new Set(Object.keys(currentSourceHashes));

  for (const entry of asArray(entries)) {
    const struct = validateDecisionEntry(entry);
    if (!struct.ok) { errors.push(...struct.errors); continue; }

    // Rol duplicado sobre el mismo item.
    if (rolesSeen.has(struct.role)) {
      errors.push(`"${itemId}" rol duplicado "${struct.role}": cada rol firma una sola vez`);
      continue;
    }
    rolesSeen.set(struct.role, struct.decision);

    // Integridad del hash de manifiesto (evidencia no obsoleta).
    if (manifestHash && str(entry.evidence_manifest_hash) !== manifestHash) {
      errors.push(`"${itemId}" (${struct.role}) evidence_manifest_hash no coincide con la evidencia vigente: decisión OBSOLETA`);
      continue;
    }

    // Integridad de source_hashes: debe cubrir EXACTAMENTE las fuentes vigentes.
    const declared = isPlainObject(entry.source_hashes) ? entry.source_hashes : {};
    const declaredSlugs = new Set(Object.keys(declared).map(str).filter(Boolean));
    let sourceOk = true;
    for (const slug of currentSlugs) {
      if (!declaredSlugs.has(slug)) {
        errors.push(`"${itemId}" (${struct.role}) falta source_hash para "${slug}" (evidencia vigente sin revisar)`);
        sourceOk = false;
      } else if (str(declared[slug]) !== currentSourceHashes[slug]) {
        errors.push(`"${itemId}" (${struct.role}) source_hash de "${slug}" no coincide: fuente OBSOLETA/alterada`);
        sourceOk = false;
      }
    }
    for (const slug of declaredSlugs) {
      if (!currentSlugs.has(slug)) {
        errors.push(`"${itemId}" (${struct.role}) source_hash para fuente desconocida "${slug}"`);
        sourceOk = false;
      }
    }
    if (!sourceOk) continue;

    validSignOffs.push({
      role: struct.role,
      decision: struct.decision,
      decided_at: str(entry.decided_at),
      rationale: str(entry.rationale),
      optional_conditions: asArray(entry.optional_conditions).map(str).filter(Boolean),
    });
  }

  const decisionsByRole = new Map(validSignOffs.map((s) => [s.role, s.decision]));
  const hasRejected = validSignOffs.some((s) => s.decision === 'rejected');
  const hasDeferred = validSignOffs.some((s) => s.decision === 'deferred');
  const approvedRoles = validSignOffs.filter((s) => s.decision === 'approved').map((s) => s.role);
  const missingApprovalRoles = REQUIRED_APPROVAL_ROLES.filter((r) => !approvedRoles.includes(r));

  let finalDecision = null;
  let complete = false;
  if (errors.length === 0) {
    if (hasRejected) { finalDecision = 'rejected'; complete = true; }
    else if (hasDeferred) { finalDecision = 'deferred'; complete = true; }
    else if (missingApprovalRoles.length === 0 && decisionsByRole.get(FINAL_AUTHORITY_ROLE) === 'approved') {
      finalDecision = 'approved'; complete = true;
    } else if (approvedRoles.length > 0) {
      errors.push(`"${itemId}" aprobación incompleta: faltan firmas de rol ${missingApprovalRoles.join(', ')}`);
    }
  }

  return {
    item_id: itemId,
    final_decision: finalDecision,
    go: GO_STATES.includes(finalDecision),
    complete,
    roles_present: [...decisionsByRole.keys()],
    missing_roles: finalDecision === 'approved' ? [] : missingApprovalRoles,
    errors,
    sign_offs: validSignOffs,
  };
}

/* ==================== 4) SET DE DECISIONES COMPLETO ===================== */

/* --------------------------------------------------------------------------
   validateDecisionSet: valida un archivo/objeto de decisiones completo contra
   el manifiesto de evidencia vigente.

   Reglas de seguridad:
     • Un set de EJEMPLO (`is_example:true`) NUNCA cuenta como decisión real:
       se valida estructuralmente pero `ok:false` con motivo "ejemplo".
     • contract debe ser el del Sprint 22.
     • Se rechazan secretos.

   Devuelve { ok, is_example, errors[], per_item{item_id: evaluateItemDecision} }.
-------------------------------------------------------------------------- */
export function validateDecisionSet(decisionSet, { manifest = null } = {}) {
  const errors = [];
  const fail = (m) => errors.push(m);
  if (!isPlainObject(decisionSet)) {
    return { ok: false, is_example: false, errors: ['decisiones: no es objeto'], per_item: {} };
  }

  const isExample = decisionSet.is_example === true;
  if (decisionSet.contract !== DECISION_CONTRACT) fail(`decisiones: contract != ${DECISION_CONTRACT}`);
  if (looksLikeSecret(JSON.stringify(decisionSet))) fail('decisiones: aparenta contener un secreto: rechazado');

  const manifestHash = manifest ? computeEvidenceManifestHash(manifest) : null;
  const evIndex = indexEvidenceItems(manifest);
  const requiredKeys = new Set(Object.keys(evIndex));

  // Agrupa las firmas por item_id.
  const byItem = new Map();
  for (const entry of asArray(decisionSet.decisions)) {
    const id = str(entry?.item_id);
    if (!byItem.has(id)) byItem.set(id, []);
    byItem.get(id).push(entry);
  }

  // Firmas para claves desconocidas (no en la evidencia vigente).
  for (const id of byItem.keys()) {
    if (id && !requiredKeys.has(id)) fail(`decisiones: firma para item desconocido "${id}"`);
  }

  const perItem = {};
  for (const id of requiredKeys) {
    perItem[id] = evaluateItemDecision(id, byItem.get(id) || [], {
      evidenceItem: evIndex[id], manifestHash,
    });
    for (const e of perItem[id].errors) fail(e);
  }

  // Un ejemplo nunca es un set válido, aunque su estructura lo sea.
  if (isExample) fail('decisiones: es un EJEMPLO (is_example=true); no cuenta como decisión real');

  return {
    ok: errors.length === 0 && !isExample,
    is_example: isExample,
    manifest_hash: manifestHash,
    errors,
    per_item: perItem,
  };
}

/* --------------------------------------------------------------------------
   resolveDecisionSet: resuelve el set de decisiones desde entorno/archivo
   (inyectados) y lo valida contra el manifiesto vigente. NO firma nada.

   deps: env, decisionsPath, fileExists, readFile, manifest.
-------------------------------------------------------------------------- */
export const DECISIONS_ENV_VAR = 'GEOP_EDITORIAL_DECISIONS';
export const DECISIONS_FILE = '.editorial-decisions.json';

export function resolveDecisionSet({
  env = {}, decisionsPath = null, fileExists = () => false, readFile = () => '', manifest = null,
} = {}) {
  const raw = env[DECISIONS_ENV_VAR];
  if (typeof raw === 'string' && raw.trim() !== '') {
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) {
      return { ok: false, source: `env:${DECISIONS_ENV_VAR}`, is_example: false, reason: `decisiones ilegibles: ${e.message}`, errors: [e.message], per_item: {} };
    }
    const res = validateDecisionSet(parsed, { manifest });
    return { ...res, source: `env:${DECISIONS_ENV_VAR}`, reason: res.ok ? null : res.errors.join('; ') };
  }
  if (decisionsPath && fileExists(decisionsPath)) {
    let parsed;
    try { parsed = JSON.parse(readFile(decisionsPath)); } catch (e) {
      return { ok: false, source: `file:${DECISIONS_FILE}`, is_example: false, reason: `decisiones ilegibles: ${e.message}`, errors: [e.message], per_item: {} };
    }
    const res = validateDecisionSet(parsed, { manifest });
    return { ...res, source: `file:${DECISIONS_FILE}`, reason: res.ok ? null : res.errors.join('; ') };
  }
  return {
    ok: false,
    source: 'none',
    is_example: false,
    reason: `sin decisiones editoriales: define ${DECISIONS_ENV_VAR} o crea ${DECISIONS_FILE} (no versionado)`,
    errors: ['decisiones editoriales ausentes'],
    per_item: {},
  };
}

/* ==================== 5) GO / NO-GO ACTUALIZADO ======================== */

/* --------------------------------------------------------------------------
   buildDecisionGoNoGo: veredicto auditable del RC tras la decisión humana.

   deps:
     manifest       — manifiesto de evidencia vigente (Sprint 21).
     decisionEval   — salida de validateDecisionSet/resolveDecisionSet.
     coverage       — bloque coverage { coverage_pct, ok, coverage_ok }.
     publishEnabled — bandera global (false en producción real).
     generatedAt    — timestamp determinista heredado.

   Un item es GO sólo si su decisión final es `approved` con integridad correcta.
   El total es GO sólo si TODOS los items son GO, la cobertura es ok, hay decisión
   válida (no ejemplo) y la publicación está habilitada. Como la publicación está
   DESHABILITADA por política, el total es SIEMPRE NO-GO en este ciclo.
-------------------------------------------------------------------------- */
export function buildDecisionGoNoGo({
  manifest = null, decisionEval = null, coverage = null,
  publishEnabled = false, generatedAt = null,
} = {}) {
  const evItems = asArray(manifest?.items);
  const perItemEval = isPlainObject(decisionEval?.per_item) ? decisionEval.per_item : {};
  const manifestHash = str(decisionEval?.manifest_hash) || computeEvidenceManifestHash(manifest);

  const items = evItems.map((it) => {
    const key = str(it.key);
    const ev = perItemEval[key] || null;
    const finalDecision = ev ? ev.final_decision : null;
    const go = Boolean(ev && ev.go);
    const reasons = [];
    if (!ev || (!finalDecision && (!ev.sign_offs || ev.sign_offs.length === 0))) {
      reasons.push(`sin decisión (estado: ${DECIDABLE_STATE})`);
    } else if (!finalDecision) {
      reasons.push(`decisión incompleta: faltan firmas de rol ${ev.missing_roles.join(', ') || '—'}`);
    } else if (!go) {
      reasons.push(`decisión "${finalDecision}" no es GO`);
    }
    return {
      key,
      conflict: str(it.conflict),
      type: str(it.pending_type) || str(it.type),
      state: finalDecision && DECISION_STATES.includes(finalDecision) ? finalDecision : DECIDABLE_STATE,
      decision: finalDecision,
      go,
      roles_present: ev ? ev.roles_present : [],
      reasons,
    };
  });

  const goCount = items.filter((i) => i.go).length;
  const noGoCount = items.length - goCount;
  const coverageOk = Boolean(coverage && coverage.ok === true && coverage.coverage_ok === true);
  const decisionOk = Boolean(decisionEval && decisionEval.ok === true);

  const blockers = [];
  if (noGoCount > 0) blockers.push(`${noGoCount} pendiente/s sin decisión GO (approved) firmada`);
  if (!decisionOk) {
    blockers.push(`decisiones editoriales ausentes/ inválidas${decisionEval?.is_example ? ' (es un EJEMPLO)' : ''}`);
  }
  if (!coverageOk) blockers.push('cobertura de staging incompleta o gate no ok');
  if (!publishEnabled) blockers.push('publicación a producción DESHABILITADA por política (PRODUCTION_PUBLISH_ENABLED=false)');

  const overallGo = noGoCount === 0 && coverageOk && decisionOk && publishEnabled;

  // Cortes por decisión para trazabilidad del revisor.
  const approved = items.filter((i) => i.decision === 'approved').map((i) => ({ conflict: i.conflict, key: i.key }));
  const rejected = items.filter((i) => i.decision === 'rejected').map((i) => ({ conflict: i.conflict, key: i.key }));
  const deferred = items.filter((i) => i.decision === 'deferred').map((i) => ({ conflict: i.conflict, key: i.key }));
  const pending = items.filter((i) => !i.decision).map((i) => ({ conflict: i.conflict, key: i.key }));

  return {
    contract: DECISION_GONOGO_CONTRACT,
    generated_at: generatedAt,
    is_production: false,
    decision: overallGo ? 'GO' : 'NO-GO',
    evidence_manifest_hash: manifestHash,
    decision_source: str(decisionEval?.source) || 'none',
    notice: 'Reporte GO/NO-GO del Release Candidate tras la DECISIÓN EDITORIAL HUMANA (Sprint 22). Auditable y determinista; NO publica producción. Cada decisión GO exige las 3 firmas de rol e integridad de hash con la evidencia vigente. El total es NO-GO mientras la publicación esté deshabilitada por política, aunque se firmen todos los pendientes.',
    summary: {
      total: items.length,
      go: goCount,
      no_go: noGoCount,
      approved: approved.length,
      rejected: rejected.length,
      deferred: deferred.length,
      pending: pending.length,
      coverage_ok: coverageOk,
      decision_ok: decisionOk,
      publish_enabled: publishEnabled,
    },
    coverage: coverage ? {
      coverage_pct: coverage.coverage_pct ?? null,
      ok: coverage.ok === true,
      coverage_ok: coverage.coverage_ok === true,
    } : null,
    blockers,
    traceability: { approved, rejected, deferred, pending },
    items,
  };
}
