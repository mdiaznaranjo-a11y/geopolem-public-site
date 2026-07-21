// GEOPÓLEM (Sprint 22) — Flujo de decisión editorial humana.
// ---------------------------------------------------------------------------
// Cubre las garantías del sprint:
//   • MODELO/ROLES: approved final exige las 3 firmas (reviewer+editor+owner);
//     rejected/deferred son terminales con una firma de rol requerido.
//   • VALIDACIÓN: detecta rationale vacío, rol inválido/duplicado, decisión
//     incompleta y firmas para claves desconocidas.
//   • INTEGRIDAD/HASH: una decisión con evidence_manifest_hash o source_hash que
//     no case con la evidencia vigente es OBSOLETA y no cuenta.
//   • NO AUTO-APROBACIÓN: el tooling nunca firma; sin decisiones → NO-GO.
//   • EJEMPLO NO PRODUCTIVO: el ejemplo versionado nunca habilita GO total.
//   • GO PARCIAL / GO TOTAL: demostrados en memoria/tempdir con fixtures, sin
//     tocar producción.
//   • PRODUCCIÓN BLOQUEADA: aun con 8/8 approved, publishEnabled=false → NO-GO.
//   • ARTEFACTO AL DÍA y CLEAN-TREE: el go/no-go.sprint22 versionado coincide y
//     los scripts en modo lectura no dejan diffs.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mod = await import('../../editorial-decision.mjs');
const {
  DECISION_CONTRACT, DECISION_GONOGO_CONTRACT, DECIDABLE_STATE,
  REQUIRED_APPROVAL_ROLES, FINAL_AUTHORITY_ROLE,
  computeEvidenceManifestHash, computeItemSourceHashes, indexEvidenceItems,
  validateDecisionEntry, evaluateItemDecision, validateDecisionSet,
  resolveDecisionSet, buildDecisionGoNoGo,
} = mod;

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const MANIFEST = readJson(resolve(REPO_ROOT, 'editorial-review/sprint21/manifest.json'));
const HASH = computeEvidenceManifestHash(MANIFEST);
const COVERAGE = { coverage_pct: 100, ok: true, coverage_ok: true };

const evItem = (key) => indexEvidenceItems(MANIFEST)[key];
const SOURCE_KEY = 'ukr-rus::source::iaea-ukraine-update-356';
const CAUSAL_KEY = 'stablecoins::causal::Riesgo de estabilidad financiera por stablecoins';

// Construye la firma de UN rol sobre un item, ligada a la evidencia vigente.
function signOff(key, role, decision = 'approved', overrides = {}) {
  const item = evItem(key);
  return {
    item_id: key,
    decision,
    rationale: `justificación real del ${role}`,
    decided_by_role: role,
    decided_at: '2026-07-07',
    evidence_manifest_hash: HASH,
    source_hashes: computeItemSourceHashes(item),
    optional_conditions: [],
    ...overrides,
  };
}
// Las 3 firmas de un item.
function fullApproval(key, decision = 'approved') {
  return REQUIRED_APPROVAL_ROLES.map((r) => signOff(key, r, decision));
}
function decisionSet(decisions) {
  return { contract: DECISION_CONTRACT, is_example: false, evidence_manifest_hash: HASH, decisions };
}

/* ==================== 1) MODELO / REGLAS DE ROLES ====================== */

test('approved final exige las 3 firmas (reviewer+editor+owner) con owner presente', () => {
  const res = evaluateItemDecision(SOURCE_KEY, fullApproval(SOURCE_KEY), { evidenceItem: evItem(SOURCE_KEY), manifestHash: HASH });
  assert.equal(res.final_decision, 'approved');
  assert.equal(res.go, true);
  assert.equal(res.complete, true);
  assert.deepEqual(res.roles_present.sort(), ['editor', 'owner', 'reviewer']);
});

test('aprobación con sólo 2 firmas es INCOMPLETA: item no es GO y sigue evidence_ready', () => {
  const res = evaluateItemDecision(SOURCE_KEY, [signOff(SOURCE_KEY, 'reviewer'), signOff(SOURCE_KEY, 'editor')], { evidenceItem: evItem(SOURCE_KEY), manifestHash: HASH });
  assert.equal(res.final_decision, null);
  assert.equal(res.go, false);
  assert.ok(res.errors.some((e) => /incompleta/.test(e)));
  assert.ok(res.missing_roles.includes(FINAL_AUTHORITY_ROLE));
});

test('rejected es terminal con una sola firma de rol requerido (auditable)', () => {
  const res = evaluateItemDecision(CAUSAL_KEY, [signOff(CAUSAL_KEY, 'owner', 'rejected')], { evidenceItem: evItem(CAUSAL_KEY), manifestHash: HASH });
  assert.equal(res.final_decision, 'rejected');
  assert.equal(res.go, false);
  assert.equal(res.complete, true);
});

test('deferred es terminal (NO-GO) con una firma; rejected prevalece sobre approved', () => {
  const deferred = evaluateItemDecision(CAUSAL_KEY, [signOff(CAUSAL_KEY, 'editor', 'deferred')], { evidenceItem: evItem(CAUSAL_KEY), manifestHash: HASH });
  assert.equal(deferred.final_decision, 'deferred');
  const mixed = evaluateItemDecision(CAUSAL_KEY, [signOff(CAUSAL_KEY, 'reviewer', 'approved'), signOff(CAUSAL_KEY, 'editor', 'approved'), signOff(CAUSAL_KEY, 'owner', 'rejected')], { evidenceItem: evItem(CAUSAL_KEY), manifestHash: HASH });
  assert.equal(mixed.final_decision, 'rejected');
});

/* ==================== 2) VALIDACIÓN ESTRUCTURAL ======================= */

test('validateDecisionEntry: rationale vacío es rechazado', () => {
  const v = validateDecisionEntry(signOff(SOURCE_KEY, 'reviewer', 'approved', { rationale: '   ' }));
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /rationale vac/.test(e)));
});

test('validateDecisionEntry: rol inválido es rechazado', () => {
  const v = validateDecisionEntry(signOff(SOURCE_KEY, 'admin'));
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /decided_by_role inv/.test(e)));
});

test('rol duplicado sobre el mismo item es inválido', () => {
  const res = evaluateItemDecision(SOURCE_KEY, [signOff(SOURCE_KEY, 'reviewer'), signOff(SOURCE_KEY, 'reviewer'), signOff(SOURCE_KEY, 'editor'), signOff(SOURCE_KEY, 'owner')], { evidenceItem: evItem(SOURCE_KEY), manifestHash: HASH });
  assert.ok(res.errors.some((e) => /rol duplicado/.test(e)));
  assert.equal(res.final_decision, null);
});

test('firma para item_id desconocido es rechazada por el set', () => {
  const set = decisionSet([signOff(SOURCE_KEY, 'reviewer'), { ...signOff(SOURCE_KEY, 'editor'), item_id: 'inexistente::x::y' }]);
  const v = validateDecisionSet(set, { manifest: MANIFEST });
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /item desconocido/.test(e)));
});

/* ==================== 3) INTEGRIDAD / HASH ============================= */

test('evidence_manifest_hash que no coincide → decisión OBSOLETA, no cuenta', () => {
  const res = evaluateItemDecision(SOURCE_KEY, fullApproval(SOURCE_KEY).map((e) => ({ ...e, evidence_manifest_hash: 'sha256:stale' })), { evidenceItem: evItem(SOURCE_KEY), manifestHash: HASH });
  assert.equal(res.final_decision, null);
  assert.ok(res.errors.some((e) => /OBSOLETA/.test(e)));
});

test('source_hash alterado de una fuente → fuente OBSOLETA/alterada, no cuenta', () => {
  const poisoned = fullApproval(SOURCE_KEY).map((e) => ({ ...e, source_hashes: { ...e.source_hashes, 'unnews-znpp-power-1166016': 'sha256:tampered' } }));
  const res = evaluateItemDecision(SOURCE_KEY, poisoned, { evidenceItem: evItem(SOURCE_KEY), manifestHash: HASH });
  assert.equal(res.final_decision, null);
  assert.ok(res.errors.some((e) => /no coincide|OBSOLETA|alterada/.test(e)));
});

test('falta el source_hash de una fuente vigente → evidencia sin revisar, no cuenta', () => {
  const missing = fullApproval(SOURCE_KEY).map((e) => ({ ...e, source_hashes: { otra: 'sha256:x' } }));
  const res = evaluateItemDecision(SOURCE_KEY, missing, { evidenceItem: evItem(SOURCE_KEY), manifestHash: HASH });
  assert.equal(res.final_decision, null);
  assert.ok(res.errors.some((e) => /falta source_hash|desconocida/.test(e)));
});

test('secretos aparentes en el set son rechazados', () => {
  const set = decisionSet(fullApproval(SOURCE_KEY).map((e) => ({ ...e, optional_conditions: ['api_key=deadbeef'] })));
  const v = validateDecisionSet(set, { manifest: MANIFEST });
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /secreto/.test(e)));
});

/* ==================== 4) NO AUTO-APROBACIÓN / SIN DECISIONES =========== */

test('sin decisiones el total es NO-GO (el tooling no firma)', () => {
  const ev = validateDecisionSet(decisionSet([]), { manifest: MANIFEST });
  const r = buildDecisionGoNoGo({ manifest: MANIFEST, decisionEval: ev, coverage: COVERAGE, publishEnabled: false, generatedAt: MANIFEST.generated_at });
  assert.equal(r.decision, 'NO-GO');
  assert.equal(r.summary.go, 0);
  assert.equal(r.summary.pending, 8);
});

test('resolveDecisionSet sin env ni archivo → ausente, NO-GO', () => {
  const res = resolveDecisionSet({ env: {}, decisionsPath: null, manifest: MANIFEST });
  assert.equal(res.ok, false);
  assert.equal(res.source, 'none');
});

/* ==================== 5) EJEMPLO NO PRODUCTIVO ======================== */

test('el ejemplo versionado NUNCA habilita GO total (is_example=true)', () => {
  const example = readJson(resolve(REPO_ROOT, '.editorial-decisions.example.json'));
  assert.equal(example.is_example, true);
  const ev = validateDecisionSet(example, { manifest: MANIFEST });
  assert.equal(ev.ok, false);
  assert.equal(ev.is_example, true);
  assert.ok(ev.errors.some((e) => /EJEMPLO/.test(e)));
  // Aun forzando publishEnabled=true, el ejemplo no produce GO total.
  const r = buildDecisionGoNoGo({ manifest: MANIFEST, decisionEval: ev, coverage: COVERAGE, publishEnabled: true, generatedAt: MANIFEST.generated_at });
  assert.equal(r.decision, 'NO-GO');
  assert.equal(r.summary.decision_ok, false);
});

/* ==================== 6) GO PARCIAL / GO TOTAL SIMULADO =============== */

test('GO PARCIAL: 4/8 aprobados con integridad correcta (go parcial, total NO-GO)', () => {
  const decisions = [];
  MANIFEST.items.slice(0, 4).forEach((it) => decisions.push(...fullApproval(it.key)));
  const ev = validateDecisionSet(decisionSet(decisions), { manifest: MANIFEST });
  const r = buildDecisionGoNoGo({ manifest: MANIFEST, decisionEval: ev, coverage: COVERAGE, publishEnabled: true, generatedAt: MANIFEST.generated_at });
  assert.equal(r.summary.go, 4);
  assert.equal(r.summary.no_go, 4);
  assert.equal(r.decision, 'NO-GO'); // faltan items → total NO-GO
});

test('GO TOTAL SIMULADO: 8/8 aprobados + publishEnabled=true → GO (sólo en fixture)', () => {
  const decisions = [];
  MANIFEST.items.forEach((it) => decisions.push(...fullApproval(it.key)));
  const ev = validateDecisionSet(decisionSet(decisions), { manifest: MANIFEST });
  assert.equal(ev.ok, true, ev.errors.join('; '));
  const go = buildDecisionGoNoGo({ manifest: MANIFEST, decisionEval: ev, coverage: COVERAGE, publishEnabled: true, generatedAt: MANIFEST.generated_at });
  assert.equal(go.decision, 'GO');
  assert.equal(go.summary.go, 8);
  assert.equal(go.summary.approved, 8);
});

/* ==================== 7) PRODUCCIÓN BLOQUEADA POR POLÍTICA ============ */

test('8/8 aprobados pero publishEnabled=false → NO-GO (producción bloqueada)', () => {
  const decisions = [];
  MANIFEST.items.forEach((it) => decisions.push(...fullApproval(it.key)));
  const ev = validateDecisionSet(decisionSet(decisions), { manifest: MANIFEST });
  const r = buildDecisionGoNoGo({ manifest: MANIFEST, decisionEval: ev, coverage: COVERAGE, publishEnabled: false, generatedAt: MANIFEST.generated_at });
  assert.equal(r.decision, 'NO-GO');
  assert.equal(r.is_production, false);
  assert.ok(r.blockers.some((b) => /DESHABILITADA por política/.test(b)));
});

/* ==================== 8) DETERMINISMO Y CONTRATOS ===================== */

test('buildDecisionGoNoGo es determinista y expone los contratos del Sprint 22', () => {
  const ev = validateDecisionSet(decisionSet([]), { manifest: MANIFEST });
  const a = buildDecisionGoNoGo({ manifest: MANIFEST, decisionEval: ev, coverage: COVERAGE, publishEnabled: false, generatedAt: MANIFEST.generated_at });
  const b = buildDecisionGoNoGo({ manifest: MANIFEST, decisionEval: ev, coverage: COVERAGE, publishEnabled: false, generatedAt: MANIFEST.generated_at });
  assert.deepEqual(a, b);
  assert.equal(a.contract, DECISION_GONOGO_CONTRACT);
  assert.equal(a.evidence_manifest_hash, HASH);
  assert.equal(DECIDABLE_STATE, 'evidence_ready');
});

/* ==================== 9) ARTEFACTO VERSIONADO AL DÍA ================== */

test('decisions:check: el go/no-go.sprint22 versionado está al día y es NO-GO', () => {
  const SCRIPT = resolve(REPO_ROOT, 'scripts/evaluate-editorial-decisions.mjs');
  const out = execFileSync('node', [SCRIPT, '--check'], {
    cwd: REPO_ROOT, encoding: 'utf8',
    env: { ...process.env, GEOP_EDITORIAL_DECISIONS: '' },
  });
  assert.match(out, /NO-GO/);
  const g = readJson(resolve(REPO_ROOT, 'api/v1/rc/go-no-go.sprint22.json'));
  assert.equal(g.contract, DECISION_GONOGO_CONTRACT);
  assert.equal(g.is_production, false);
  assert.equal(g.decision, 'NO-GO');
  assert.equal(g.summary.go, 0);
  assert.equal(g.evidence_manifest_hash, HASH);
});

/* ==================== 10) CLEAN-TREE ================================== */

test('los scripts de decisión en modo lectura NO dejan diffs versionados', () => {
  const status = () => execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: REPO_ROOT, encoding: 'utf8' });
  const before = status();
  for (const a of [['--check'], ['--json'], ['--hash']]) {
    execFileSync('node', [resolve(REPO_ROOT, 'scripts/evaluate-editorial-decisions.mjs'), ...a], {
      cwd: REPO_ROOT, stdio: 'ignore',
      env: { ...process.env, GEOP_EDITORIAL_DECISIONS: '' },
    });
  }
  assert.equal(status(), before, 'los checks de decisión deben ser no-write/no-diff');
});
