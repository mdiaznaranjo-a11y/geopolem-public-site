// GEOPÓLEM — Gobernanza editorial: estados, firmas, evidencia y go/no-go (Sprint 20)
// ---------------------------------------------------------------------------
// Módulo PURO (sin disco/red: la IO se inyecta) que formaliza la GOBERNANZA
// EDITORIAL necesaria para resolver/firmar los pendientes del Release Candidate
// (Sprint 19) sin publicar producción. Construye sobre los artefactos ya
// existentes y NO inventa datos:
//   • data/editorial-review-queue.rc.json  (clasificación accionable, Sprint 19)
//   • api/v1/staging/conflicts/<id>.json   (fuentes/causal_links reales)
//
// Aporta cuatro piezas complementarias:
//   1) MODELO DE ESTADOS  — máquina de estados cerrada del ciclo de vida de un
//      pendiente editorial, con roles/firmas esperadas (reviewer/editor/owner).
//   2) EVIDENCIA           — paquete revisable por humano por cada pendiente
//      (conflicto, tipo, fuentes disponibles, razón de bloqueo, acción y decisión
//      requerida), derivado SÓLO de lo que existe en el repo.
//   3) SIGN-OFF EDITORIAL  — validador de un sign-off editorial NO productivo. Un
//      EJEMPLO (`is_example:true`) jamás cuenta como firma real ni habilita nada.
//   4) GO/NO-GO            — veredicto auditable por item y total del RC.
//
// REGLA DE ORO: determinista (mismas entradas → misma salida), sin datos
// inventados, sin secretos, y la publicación real a producción permanece
// DESHABILITADA por política aunque todos los gates se satisfagan.
// ---------------------------------------------------------------------------

export const GOVERNANCE_CONTRACT = 'sprint-20-editorial-governance-v1';
export const EVIDENCE_CONTRACT = 'sprint-20-editorial-evidence-v1';
export const SIGNOFF_CONTRACT = 'sprint-20-editorial-signoff-v1';
export const GONOGO_CONTRACT = 'sprint-20-editorial-go-no-go-v1';

// Estados formales del ciclo de vida de un pendiente editorial (taxonomía cerrada).
//   pending             — recién ingresado, sin evidencia preparada.
//   evidence_ready      — paquete de evidencia revisable listo para decisión humana.
//   approved            — decisión humana firmada: el pendiente se acepta/cierra.
//   rejected            — decisión humana firmada: el pendiente se rechaza.
//   deferred            — pospuesto deliberadamente a un sprint futuro.
//   blocked_by_source   — la fuente externa es inaccesible con el tooling actual.
//   needs_human_review  — requiere criterio/acción de un editor humano.
export const GOVERNANCE_STATES = Object.freeze([
  'pending',
  'evidence_ready',
  'approved',
  'rejected',
  'deferred',
  'blocked_by_source',
  'needs_human_review',
]);

// Estados de DECISIÓN humana terminal (un item "firmado" está en uno de estos).
export const DECISION_STATES = Object.freeze(['approved', 'rejected', 'deferred']);

// Sólo `approved` cuenta como GO para producción; rejected/deferred son NO-GO
// (decisión tomada, pero el contenido no entra en este ciclo).
export const GO_STATES = Object.freeze(['approved']);

// Roles/firmas esperadas (SIN auth real: son declaraciones auditables).
//   reviewer — prepara/verifica la evidencia.
//   editor   — decide editorialmente (aprobar/rechazar/posponer).
//   owner    — autoriza la decisión a nivel de producto.
export const ROLES = Object.freeze(['reviewer', 'editor', 'owner']);

// Transiciones permitidas de la máquina de estados. Los estados de decisión son
// terminales (no salen). needs_human_review/blocked_by_source pueden avanzar a
// evidence_ready (cuando hay paquete) o a deferred.
const TRANSITIONS = Object.freeze({
  pending: ['evidence_ready', 'needs_human_review', 'blocked_by_source', 'deferred'],
  needs_human_review: ['evidence_ready', 'deferred', 'blocked_by_source'],
  blocked_by_source: ['evidence_ready', 'deferred'],
  evidence_ready: ['approved', 'rejected', 'deferred', 'needs_human_review'],
  approved: [],
  rejected: [],
  deferred: [],
});

const SECRET_HINTS = ['token', 'secret', 'password', 'passwd', 'apikey', 'api_key', 'private_key', 'bearer'];

function isPlainObject(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }
function str(v) { return typeof v === 'string' ? v.trim() : ''; }
function asArray(v) { return Array.isArray(v) ? v : []; }
function looksLikeSecret(text) {
  const low = String(text).toLowerCase();
  return SECRET_HINTS.some((h) => low.includes(h));
}

/* ==================== 1) MODELO DE ESTADOS =============================== */

// ¿Es válida una transición from→to según la máquina de estados?
export function canTransition(from, to) {
  if (!GOVERNANCE_STATES.includes(from) || !GOVERNANCE_STATES.includes(to)) return false;
  return asArray(TRANSITIONS[from]).includes(to);
}

// Estado inicial de gobernanza derivado de la clasificación del RC (Sprint 19).
// La clasificación es el punto de partida; la gobernanza modela qué falta para
// firmar. `resolved` (verificable en repo) entra ya como evidence_ready.
export function initialStateFromClassification(classification) {
  switch (str(classification)) {
    case 'resolved': return 'evidence_ready';
    case 'needs_human_review': return 'needs_human_review';
    case 'blocked_by_source': return 'blocked_by_source';
    case 'deferred': return 'deferred';
    default: return 'pending';
  }
}

// Roles cuya firma se ESPERA para que la decisión de un item sea válida.
// Todos los roles deben firmar una decisión terminal (reviewer+editor+owner).
export function requiredRolesForItem() {
  return [...ROLES];
}

// Construye el "item de gobernanza" a partir de un item clasificado del RC.
export function buildGovernanceItem(rcItem) {
  const classification = str(rcItem?.classification);
  return {
    key: str(rcItem?.key) || null,
    conflict: str(rcItem?.conflict) || null,
    type: str(rcItem?.type) || null,
    title: str(rcItem?.title) || null,
    source_slug: str(rcItem?.source_slug) || null,
    classification: classification || null,
    state: initialStateFromClassification(classification),
    blocking_gate: str(rcItem?.blocking_gate) || null,
    required_roles: requiredRolesForItem(),
    recommended_action: str(rcItem?.recommended_action) || null,
  };
}

/* ==================== 2) EVIDENCIA REVISABLE ============================= */

// Extrae, del detalle de staging del conflicto (si se aporta), las fuentes
// disponibles REALES y —para causal-link-pending— el vínculo causal concreto.
// NO inventa nada: si no hay detalle, devuelve lo mínimo trazable del propio item.
function gatherContext(rcItem, conflictDetail) {
  const d = isPlainObject(conflictDetail)
    ? (isPlainObject(conflictDetail.data) ? conflictDetail.data : conflictDetail)
    : null;
  const sources = d ? asArray(d.sources) : [];
  const causal = d ? asArray(d.causal_links) : [];

  if (str(rcItem?.type) === 'source-review') {
    const slug = str(rcItem?.source_slug);
    const match = sources.find((s) => str(s.slug) === slug) || null;
    return {
      available_sources: match ? [{
        slug: str(match.slug),
        title: str(match.title) || null,
        url: str(match.url) || null,
        publisher: str(match.publisher) || str(match.source_name) || null,
        verification: str(match.verification) || null,
        accessed_via: str(match.accessed_via) || null,
      }] : [],
      causal_link: null,
    };
  }

  if (str(rcItem?.type) === 'causal-link-pending') {
    const title = str(rcItem?.title);
    const link = causal.find((c) => str(c.title) === title) || null;
    const linkSlugs = link ? asArray(link.source_slugs).map(str).filter(Boolean) : [];
    const contextSources = sources
      .filter((s) => linkSlugs.includes(str(s.slug)))
      .map((s) => ({ slug: str(s.slug), title: str(s.title) || null, url: str(s.url) || null }));
    return {
      available_sources: contextSources,
      causal_link: link ? {
        title: str(link.title),
        link_type: str(link.link_type) || null,
        explanation: str(link.explanation) || null,
        pending: link.pending === true,
        context_source_slugs: linkSlugs,
      } : null,
    };
  }

  return { available_sources: [], causal_link: null };
}

// Paquete de evidencia por item: todo lo que un humano necesita para decidir.
// Determinista y derivado sólo de lo existente en repo.
export function buildEvidencePackage(rcItem, { conflictDetail = null } = {}) {
  const gov = buildGovernanceItem(rcItem);
  const ctx = gatherContext(rcItem, conflictDetail);
  const isSource = gov.type === 'source-review';
  const decisionRequired = isSource
    ? 'Reconfirmar la URL con acceso directo o sustituir por fuente equivalente accesible; luego approve/reject.'
    : 'Aportar la fuente que respalde específicamente el vínculo causal; luego approve/reject/defer.';

  return {
    contract: EVIDENCE_CONTRACT,
    key: gov.key,
    conflict: gov.conflict,
    pending_type: gov.type,
    classification: gov.classification,
    state: gov.state,
    blocking_gate: gov.blocking_gate,
    title: gov.title,
    source_slug: gov.source_slug,
    available_sources: ctx.available_sources,
    causal_link: ctx.causal_link,
    block_reason: str(rcItem?.rationale) || null,
    source_access_evidence: isPlainObject(rcItem?.evidence) && str(rcItem.evidence.result) ? {
      attempted_via: str(rcItem.evidence.attempted_via) || null,
      result: str(rcItem.evidence.result) || null,
      observed: str(rcItem.evidence.observed) || null,
    } : null,
    recommended_action: gov.recommended_action,
    decision_required: decisionRequired,
    required_roles: gov.required_roles,
  };
}

// Renderiza un paquete de evidencia a Markdown revisable por humano.
export function renderEvidenceMarkdown(pkg) {
  const L = [];
  const label = pkg.pending_type === 'source-review'
    ? `${pkg.conflict} / fuente \`${pkg.source_slug}\``
    : `${pkg.conflict} / causal "${pkg.title}"`;
  L.push(`# Evidencia editorial — ${label}`);
  L.push('');
  L.push('> Paquete revisable por humano (GEOPÓLEM Sprint 20). Derivado sin inventar datos');
  L.push('> desde la cola RC y los artefactos de staging. NO habilita producción.');
  L.push('');
  L.push('| Campo | Valor |');
  L.push('|-------|-------|');
  L.push(`| Clave | \`${pkg.key}\` |`);
  L.push(`| Conflicto | \`${pkg.conflict}\` |`);
  L.push(`| Tipo de pendiente | \`${pkg.pending_type}\` |`);
  L.push(`| Clasificación (RC) | \`${pkg.classification}\` |`);
  L.push(`| Estado de gobernanza | \`${pkg.state}\` |`);
  L.push(`| Gate que bloquea | \`${pkg.blocking_gate || '—'}\` |`);
  L.push('');
  L.push('## Razón de bloqueo');
  L.push('');
  L.push(pkg.block_reason || '_(sin razón registrada)_');
  L.push('');
  if (pkg.source_access_evidence) {
    L.push('## Evidencia de acceso a la fuente');
    L.push('');
    L.push(`- Intento: \`${pkg.source_access_evidence.attempted_via}\``);
    L.push(`- Resultado: \`${pkg.source_access_evidence.result}\``);
    if (pkg.source_access_evidence.observed) L.push(`- Observado: ${pkg.source_access_evidence.observed}`);
    L.push('');
  }
  L.push('## Fuentes disponibles');
  L.push('');
  if (pkg.available_sources.length) {
    for (const s of pkg.available_sources) {
      const bits = [`\`${s.slug}\``];
      if (s.title) bits.push(s.title);
      if (s.url) bits.push(`<${s.url}>`);
      if (s.verification) bits.push(`(${s.verification})`);
      L.push(`- ${bits.join(' — ')}`);
    }
  } else {
    L.push('_(sin fuentes disponibles en el detalle de staging)_');
  }
  L.push('');
  if (pkg.causal_link) {
    L.push('## Vínculo causal');
    L.push('');
    L.push(`- Título: ${pkg.causal_link.title}`);
    if (pkg.causal_link.link_type) L.push(`- Tipo: \`${pkg.causal_link.link_type}\``);
    if (pkg.causal_link.explanation) L.push(`- Explicación: ${pkg.causal_link.explanation}`);
    L.push(`- Pendiente: \`${pkg.causal_link.pending}\``);
    L.push('');
  }
  L.push('## Acción recomendada');
  L.push('');
  L.push(pkg.recommended_action || '_(sin acción recomendada)_');
  L.push('');
  L.push('## Decisión requerida');
  L.push('');
  L.push(pkg.decision_required);
  L.push('');
  L.push(`Firmas esperadas: ${pkg.required_roles.map((r) => `\`${r}\``).join(', ')}.`);
  L.push('');
  return `${L.join('\n')}`;
}

// Nombre de archivo estable/seguro para el .md de un item (derivado de la clave).
export function evidenceFileName(key) {
  return `${String(key).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()}.md`;
}

// Manifiesto de los paquetes de evidencia de toda la cola RC. Determinista.
export function buildEvidenceManifest({ rc, conflictDetails = {}, generatedAt = null } = {}) {
  const items = isPlainObject(rc) ? asArray(rc.items) : [];
  const packages = items.map((it) => {
    const pkg = buildEvidencePackage(it, { conflictDetail: conflictDetails[str(it.conflict)] || null });
    return { ...pkg, evidence_file: `evidence/${evidenceFileName(pkg.key)}` };
  });
  const byState = Object.fromEntries(GOVERNANCE_STATES.map((s) => [s, 0]));
  for (const p of packages) byState[p.state] += 1;

  return {
    contract: EVIDENCE_CONTRACT,
    generated_at: generatedAt,
    source_contract: isPlainObject(rc) ? (str(rc.contract) || null) : null,
    notice: 'Paquetes de evidencia revisables por humano para los pendientes del Release Candidate. Derivados sin inventar datos desde la cola RC y los artefactos de staging. NO habilitan producción.',
    summary: {
      total: packages.length,
      by_state: byState,
      conflicts_affected: [...new Set(packages.map((p) => p.conflict))].filter(Boolean).sort(),
    },
    items: packages,
  };
}

// Verifica que el manifiesto de evidencia cubre exactamente la cola RC.
export function validateEvidenceManifest(manifest, rc) {
  const errors = [];
  const fail = (m) => errors.push(m);
  if (!isPlainObject(manifest)) { fail('evidence: no es objeto'); return { ok: false, errors }; }
  if (manifest.contract !== EVIDENCE_CONTRACT) fail(`evidence: contract != ${EVIDENCE_CONTRACT}`);
  const rcKeys = new Set(asArray(rc?.items).map((i) => str(i.key)).filter(Boolean));
  const evKeys = new Set(asArray(manifest.items).map((i) => str(i.key)).filter(Boolean));
  if (evKeys.size !== rcKeys.size) fail(`evidence: nº de items (${evKeys.size}) != cola RC (${rcKeys.size})`);
  for (const k of rcKeys) if (!evKeys.has(k)) fail(`evidence: falta paquete para "${k}"`);
  for (const it of asArray(manifest.items)) {
    if (!str(it.evidence_file)) fail(`evidence: item "${str(it.key)}" sin evidence_file`);
    if (!GOVERNANCE_STATES.includes(str(it.state))) fail(`evidence: item "${str(it.key)}" estado inválido "${str(it.state)}"`);
  }
  return { ok: errors.length === 0, errors };
}

/* ==================== 3) SIGN-OFF EDITORIAL ============================== */

export const SIGNOFF_ENV_VAR = 'GEOP_EDITORIAL_SIGNOFF';
export const SIGNOFF_FILE = '.editorial-signoff.json';

// Valida la estructura de una firma de decisión de un item.
function validateDecision(dec) {
  const errors = [];
  const key = str(dec?.key);
  const decision = str(dec?.decision).toLowerCase();
  if (!key) errors.push('decisión sin "key"');
  if (!DECISION_STATES.includes(decision)) {
    errors.push(`"decision" de "${key || '∅'}" debe ser uno de ${DECISION_STATES.join('|')} (recibido: "${decision || '∅'}")`);
  }
  const sigs = isPlainObject(dec?.signatures) ? dec.signatures : {};
  for (const role of ROLES) {
    if (!str(sigs[role])) errors.push(`"${key || '∅'}" falta firma de rol "${role}"`);
  }
  const date = str(dec?.date);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push(`"${key || '∅'}" date debe ser YYYY-MM-DD`);
  return { key, decision, errors };
}

/* --------------------------------------------------------------------------
   validateEditorialSignoff: valida un sign-off editorial completo.

   Reglas de seguridad:
     • Un sign-off de EJEMPLO (`is_example:true`) NUNCA es válido para gobernanza
       real: se acepta estructuralmente pero `ok:false` con motivo "ejemplo".
     • Se rechaza cualquier valor que aparente contener un secreto.
     • Debe cubrir EXACTAMENTE las claves requeridas (todos los pendientes), cada
       una con decisión válida y las 3 firmas esperadas (reviewer/editor/owner).

   Devuelve { ok, is_example, errors[], decisions_by_key }.
-------------------------------------------------------------------------- */
export function validateEditorialSignoff(signoff, { requiredKeys = [] } = {}) {
  const errors = [];
  const fail = (m) => errors.push(m);
  if (!isPlainObject(signoff)) return { ok: false, is_example: false, errors: ['sign-off: no es objeto'], decisions_by_key: {} };

  const isExample = signoff.is_example === true;
  if (signoff.contract !== SIGNOFF_CONTRACT) fail(`sign-off: contract != ${SIGNOFF_CONTRACT}`);
  if (looksLikeSecret(JSON.stringify(signoff))) fail('sign-off: aparenta contener un secreto (token/clave/password): rechazado');

  const decisions = asArray(signoff.decisions);
  const byKey = {};
  for (const dec of decisions) {
    const res = validateDecision(dec);
    for (const e of res.errors) fail(e);
    if (res.key) byKey[res.key] = res.decision;
  }

  const required = asArray(requiredKeys).map(str).filter(Boolean);
  for (const k of required) {
    if (!(k in byKey)) fail(`sign-off: falta decisión para el pendiente "${k}"`);
  }
  for (const k of Object.keys(byKey)) {
    if (required.length && !required.includes(k)) fail(`sign-off: decisión para clave desconocida "${k}"`);
  }

  // Un ejemplo nunca es un sign-off válido, aunque su estructura sea correcta.
  if (isExample) fail('sign-off: es un EJEMPLO (is_example=true); no cuenta como firma real');

  return { ok: errors.length === 0 && !isExample, is_example: isExample, errors, decisions_by_key: byKey };
}

/* --------------------------------------------------------------------------
   resolveEditorialSignoff: resuelve el sign-off editorial desde entorno/archivo
   (inyectados) y lo valida. NO firma ni cierra nada; sólo informa.

   deps: env, signoffPath, fileExists, readFile, requiredKeys.
-------------------------------------------------------------------------- */
export function resolveEditorialSignoff({
  env = {}, signoffPath = null, fileExists = () => false, readFile = () => '', requiredKeys = [],
} = {}) {
  const raw = env[SIGNOFF_ENV_VAR];
  if (typeof raw === 'string' && raw.trim() !== '') {
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) {
      return { ok: false, source: `env:${SIGNOFF_ENV_VAR}`, is_example: false, reason: `sign-off ilegible: ${e.message}`, errors: [e.message], decisions_by_key: {} };
    }
    const res = validateEditorialSignoff(parsed, { requiredKeys });
    return { ...res, source: `env:${SIGNOFF_ENV_VAR}`, reason: res.ok ? null : res.errors.join('; ') };
  }
  if (signoffPath && fileExists(signoffPath)) {
    let parsed;
    try { parsed = JSON.parse(readFile(signoffPath)); } catch (e) {
      return { ok: false, source: `file:${SIGNOFF_FILE}`, is_example: false, reason: `sign-off ilegible: ${e.message}`, errors: [e.message], decisions_by_key: {} };
    }
    const res = validateEditorialSignoff(parsed, { requiredKeys });
    return { ...res, source: `file:${SIGNOFF_FILE}`, reason: res.ok ? null : res.errors.join('; ') };
  }
  return {
    ok: false,
    source: 'none',
    is_example: false,
    reason: `sin sign-off editorial: define ${SIGNOFF_ENV_VAR} o crea ${SIGNOFF_FILE} (no versionado)`,
    errors: ['sign-off editorial ausente'],
    decisions_by_key: {},
  };
}

/* ==================== 4) GO / NO-GO ===================================== */

/* --------------------------------------------------------------------------
   buildGoNoGoReport: veredicto auditable del RC, por item y total.

   deps:
     rc             — cola RC clasificada (data/editorial-review-queue.rc.json).
     coverage       — bloque coverage del manifiesto RC { coverage_pct, ok, coverage_ok }.
     signoffEval    — salida de validateEditorialSignoff/resolveEditorialSignoff.
     doubleGate     — salida de evaluateProductionRelease (Sprint 18), opcional.
     publishEnabled — bandera global (false en este ciclo).
     generatedAt    — timestamp determinista heredado.

   Un item es GO sólo si su decisión firmada es `approved`. El total es GO sólo si
   TODOS los items son GO, la cobertura es 100%/ok, el doble gate está satisfecho
   y la publicación está habilitada. Como la publicación está DESHABILITADA por
   política, el total es SIEMPRE NO-GO en este ciclo.
-------------------------------------------------------------------------- */
export function buildGoNoGoReport({
  rc, coverage = null, signoffEval = null, doubleGate = null,
  publishEnabled = false, generatedAt = null,
} = {}) {
  const items = isPlainObject(rc) ? asArray(rc.items) : [];
  const decisions = isPlainObject(signoffEval) && isPlainObject(signoffEval.decisions_by_key)
    ? signoffEval.decisions_by_key : {};

  const perItem = items.map((it) => {
    const gov = buildGovernanceItem(it);
    const decision = str(decisions[gov.key]) || null;
    const state = decision && DECISION_STATES.includes(decision) ? decision : gov.state;
    const go = GO_STATES.includes(state);
    const reasons = [];
    if (!decision) reasons.push(`sin decisión firmada (estado: ${gov.state})`);
    else if (!go) reasons.push(`decisión "${decision}" no es GO`);
    return {
      key: gov.key,
      conflict: gov.conflict,
      type: gov.type,
      classification: gov.classification,
      decision,
      state,
      go,
      reasons,
    };
  });

  const goCount = perItem.filter((i) => i.go).length;
  const noGoCount = perItem.length - goCount;
  const coverageOk = Boolean(coverage && coverage.ok === true && coverage.coverage_ok === true);
  const signoffOk = Boolean(signoffEval && signoffEval.ok === true);
  const doubleGateOk = Boolean(doubleGate && doubleGate.double_gate_ok === true);

  const blockers = [];
  if (noGoCount > 0) blockers.push(`${noGoCount} pendiente/s sin decisión GO firmada`);
  if (!coverageOk) blockers.push('cobertura de staging incompleta o gate no ok');
  if (!signoffOk) blockers.push(`sign-off editorial ausente/ inválido${signoffEval?.is_example ? ' (es un EJEMPLO)' : ''}`);
  if (doubleGate && !doubleGateOk) blockers.push('doble gate (sign-off + segunda confirmación) no satisfecho');
  if (!publishEnabled) blockers.push('publicación a producción DESHABILITADA por política (PRODUCTION_PUBLISH_ENABLED=false)');

  const overallGo = noGoCount === 0 && coverageOk && signoffOk && publishEnabled
    && (doubleGate ? doubleGateOk : true);

  // Cortes de trazabilidad para el revisor humano.
  const sourcesNeedingReview = perItem
    .filter((i) => i.type === 'source-review' && !i.go)
    .map((i) => ({ conflict: i.conflict, key: i.key }));
  const causalLinksPending = perItem
    .filter((i) => i.type === 'causal-link-pending' && !i.go)
    .map((i) => ({ conflict: i.conflict, key: i.key }));

  return {
    contract: GONOGO_CONTRACT,
    generated_at: generatedAt,
    is_production: false,
    decision: overallGo ? 'GO' : 'NO-GO',
    notice: 'Reporte go/no-go del Release Candidate (Sprint 20). Auditable y determinista; NO publica producción. El total es NO-GO mientras la publicación esté deshabilitada por política, aunque se firmen todos los pendientes.',
    summary: {
      total: perItem.length,
      go: goCount,
      no_go: noGoCount,
      coverage_ok: coverageOk,
      signoff_ok: signoffOk,
      double_gate_ok: doubleGate ? doubleGateOk : null,
      publish_enabled: publishEnabled,
    },
    coverage: coverage ? {
      coverage_pct: coverage.coverage_pct ?? null,
      ok: coverage.ok === true,
      coverage_ok: coverage.coverage_ok === true,
    } : null,
    blockers,
    traceability: {
      sources_needing_human_review: sourcesNeedingReview,
      causal_links_pending: causalLinksPending,
    },
    items: perItem,
  };
}
