// GEOPÓLEM (Sprint 20) — Gobernanza editorial: estados, sign-off, evidencia,
// go/no-go y producción bloqueada por política.
// ---------------------------------------------------------------------------
// Cubre las garantías del sprint:
//   • MODELO DE ESTADOS: taxonomía cerrada, máquina de estados coherente, estado
//     inicial derivado de la clasificación del RC, roles esperados.
//   • EVIDENCIA: paquete por cada uno de los 8 pendientes, derivado del repo
//     (sin inventar), manifiesto que cubre exactamente la cola RC, artefacto al día.
//   • SIGN-OFF: validador de esquema/roles; un EJEMPLO nunca cuenta; secretos
//     rechazados; el ejemplo versionado NO habilita producción.
//   • GO/NO-GO: agregación por item y total; producción NO-GO por política aun con
//     firmas y doble gate; artefacto versionado al día.
//   • Los scripts de gobernanza en modo lectura dejan el árbol Git limpio.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const gov = await import('../../editorial-governance.mjs');
const {
  GOVERNANCE_STATES, DECISION_STATES, ROLES, GOVERNANCE_CONTRACT, EVIDENCE_CONTRACT,
  SIGNOFF_CONTRACT, GONOGO_CONTRACT,
  canTransition, initialStateFromClassification, buildGovernanceItem,
  buildEvidencePackage, renderEvidenceMarkdown, buildEvidenceManifest,
  validateEvidenceManifest, evidenceFileName,
  validateEditorialSignoff, resolveEditorialSignoff,
  buildGoNoGoReport,
} = gov;

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const RC = readJson(resolve(REPO_ROOT, 'data/editorial-review-queue.rc.json'));
const RC_KEYS = RC.items.map((i) => i.key);

function realSignoff() {
  const ex = readJson(resolve(REPO_ROOT, '.editorial-signoff.example.json'));
  const real = JSON.parse(JSON.stringify(ex));
  real.is_example = false;
  return real;
}

/* ==================== 1) MODELO DE ESTADOS =============================== */

test('GOVERNANCE_STATES: taxonomía cerrada esperada (7 estados)', () => {
  assert.deepEqual([...GOVERNANCE_STATES].sort(), [
    'approved', 'blocked_by_source', 'deferred', 'evidence_ready',
    'needs_human_review', 'pending', 'rejected',
  ]);
  assert.deepEqual([...DECISION_STATES], ['approved', 'rejected', 'deferred']);
  assert.deepEqual([...ROLES], ['reviewer', 'editor', 'owner']);
});

test('canTransition: transiciones válidas y estados de decisión terminales', () => {
  assert.equal(canTransition('needs_human_review', 'evidence_ready'), true);
  assert.equal(canTransition('blocked_by_source', 'evidence_ready'), true);
  assert.equal(canTransition('evidence_ready', 'approved'), true);
  assert.equal(canTransition('evidence_ready', 'deferred'), true);
  // terminales no salen
  assert.equal(canTransition('approved', 'rejected'), false);
  assert.equal(canTransition('rejected', 'approved'), false);
  // saltos ilegales
  assert.equal(canTransition('pending', 'approved'), false);
  assert.equal(canTransition('blocked_by_source', 'approved'), false);
  assert.equal(canTransition('foo', 'approved'), false);
});

test('initialStateFromClassification: mapea clasificación RC → estado inicial', () => {
  assert.equal(initialStateFromClassification('needs_human_review'), 'needs_human_review');
  assert.equal(initialStateFromClassification('blocked_by_source'), 'blocked_by_source');
  assert.equal(initialStateFromClassification('resolved'), 'evidence_ready');
  assert.equal(initialStateFromClassification('deferred'), 'deferred');
  assert.equal(initialStateFromClassification('blocked_by_policy'), 'pending');
});

test('buildGovernanceItem: hereda clasificación y exige las 3 firmas', () => {
  const item = buildGovernanceItem(RC.items[0]);
  assert.ok(GOVERNANCE_STATES.includes(item.state));
  assert.deepEqual(item.required_roles, ['reviewer', 'editor', 'owner']);
});

/* ==================== 2) EVIDENCIA ====================================== */

test('buildEvidenceManifest: cubre los 8 pendientes y es determinista', () => {
  const details = {};
  for (const it of RC.items) {
    const rel = `api/v1/staging/conflicts/${it.conflict}.json`;
    if (!details[it.conflict] && existsSync(resolve(REPO_ROOT, rel))) {
      details[it.conflict] = readJson(resolve(REPO_ROOT, rel));
    }
  }
  const a = buildEvidenceManifest({ rc: RC, conflictDetails: details, generatedAt: RC.generated_at });
  const b = buildEvidenceManifest({ rc: RC, conflictDetails: details, generatedAt: RC.generated_at });
  assert.deepEqual(a, b);
  assert.equal(a.contract, EVIDENCE_CONTRACT);
  assert.equal(a.summary.total, 8);
  assert.equal(a.summary.by_state.blocked_by_source, 3);
  assert.equal(a.summary.by_state.needs_human_review, 5);
  assert.equal(validateEvidenceManifest(a, RC).ok, true);
});

test('buildEvidencePackage: source-review incluye la fuente REAL de staging (no inventada)', () => {
  const detail = readJson(resolve(REPO_ROOT, 'api/v1/staging/conflicts/ukr-rus.json'));
  const item = RC.items.find((i) => i.key === 'ukr-rus::source::iaea-ukraine-update-356');
  const pkg = buildEvidencePackage(item, { conflictDetail: detail });
  assert.equal(pkg.pending_type, 'source-review');
  assert.equal(pkg.available_sources.length, 1);
  assert.equal(pkg.available_sources[0].slug, 'iaea-ukraine-update-356');
  assert.match(pkg.available_sources[0].url, /iaea\.org/);
  assert.ok(pkg.source_access_evidence && /402/.test(pkg.source_access_evidence.result));
  assert.match(pkg.decision_required, /approve\/reject/);
});

test('buildEvidencePackage: causal-link-pending referencia el vínculo causal real', () => {
  const detail = readJson(resolve(REPO_ROOT, 'api/v1/staging/conflicts/asia-agua.json'));
  const item = RC.items.find((i) => i.type === 'causal-link-pending' && i.conflict === 'asia-agua');
  const pkg = buildEvidencePackage(item, { conflictDetail: detail });
  assert.equal(pkg.pending_type, 'causal-link-pending');
  assert.ok(pkg.causal_link);
  assert.equal(pkg.causal_link.title, item.title);
});

test('renderEvidenceMarkdown: incluye secciones clave y firmas esperadas', () => {
  const pkg = buildEvidencePackage(RC.items[0], { conflictDetail: null });
  const md = renderEvidenceMarkdown(pkg);
  assert.match(md, /# Evidencia editorial/);
  assert.match(md, /## Razón de bloqueo/);
  assert.match(md, /## Decisión requerida/);
  assert.match(md, /reviewer.*editor.*owner/);
});

test('evidenceFileName: nombre estable/seguro derivado de la clave', () => {
  assert.equal(evidenceFileName('ukr-rus::source::iaea-x'), 'ukr-rus-source-iaea-x.md');
});

test('build-evidence-packages --check: manifiesto y .md versionados al día', () => {
  const SCRIPT = resolve(REPO_ROOT, 'scripts/build-evidence-packages.mjs');
  const out = execFileSync('node', [SCRIPT, '--check'], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.match(out, /al día/);
  const man = readJson(resolve(REPO_ROOT, 'editorial-review/manifest.json'));
  assert.equal(man.contract, EVIDENCE_CONTRACT);
  for (const it of man.items) {
    assert.ok(existsSync(resolve(REPO_ROOT, 'editorial-review', it.evidence_file)), `falta ${it.evidence_file}`);
  }
});

/* ==================== 3) SIGN-OFF EDITORIAL ============================= */

test('validateEditorialSignoff: el EJEMPLO versionado NO es una firma válida', () => {
  const ex = readJson(resolve(REPO_ROOT, '.editorial-signoff.example.json'));
  const r = validateEditorialSignoff(ex, { requiredKeys: RC_KEYS });
  assert.equal(r.is_example, true);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /EJEMPLO/.test(e)));
});

test('validateEditorialSignoff: un sign-off real, completo y con 3 firmas es válido', () => {
  const r = validateEditorialSignoff(realSignoff(), { requiredKeys: RC_KEYS });
  assert.equal(r.ok, true);
  assert.equal(r.is_example, false);
  assert.equal(Object.keys(r.decisions_by_key).length, 8);
});

test('validateEditorialSignoff: falta una firma de rol ⇒ inválido', () => {
  const s = realSignoff();
  delete s.decisions[0].signatures.owner;
  const r = validateEditorialSignoff(s, { requiredKeys: RC_KEYS });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /falta firma de rol "owner"/.test(e)));
});

test('validateEditorialSignoff: decisión inválida y cobertura incompleta ⇒ inválido', () => {
  const s = realSignoff();
  s.decisions[1].decision = 'maybe';
  s.decisions.pop(); // deja de cubrir una clave
  const r = validateEditorialSignoff(s, { requiredKeys: RC_KEYS });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /decision/.test(e)));
  assert.ok(r.errors.some((e) => /falta decisión/.test(e)));
});

test('validateEditorialSignoff: rechaza valores que aparentan secretos', () => {
  const s = realSignoff();
  s.decisions[0].signatures.reviewer = 'bearer_token_abc';
  const r = validateEditorialSignoff(s, { requiredKeys: RC_KEYS });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /secreto/.test(e)));
});

test('resolveEditorialSignoff: sin env ni archivo ⇒ ausente (producción no habilitada)', () => {
  const r = resolveEditorialSignoff({ env: {}, requiredKeys: RC_KEYS });
  assert.equal(r.ok, false);
  assert.equal(r.source, 'none');
});

test('resolveEditorialSignoff: lee el EJEMPLO por archivo pero NO lo acepta', () => {
  const r = resolveEditorialSignoff({
    env: {},
    signoffPath: '.editorial-signoff.example.json',
    fileExists: (rel) => existsSync(resolve(REPO_ROOT, rel)),
    readFile: (rel) => readFileSync(resolve(REPO_ROOT, rel), 'utf8'),
    requiredKeys: RC_KEYS,
  });
  assert.equal(r.is_example, true);
  assert.equal(r.ok, false);
});

/* ==================== 4) GO / NO-GO ==================================== */

test('buildGoNoGoReport: sin sign-off ⇒ 0 GO, total NO-GO, 8 pendientes', () => {
  const r = buildGoNoGoReport({
    rc: RC, coverage: { coverage_pct: 100, ok: true, coverage_ok: true },
    signoffEval: null, publishEnabled: false, generatedAt: 'T',
  });
  assert.equal(r.contract, GONOGO_CONTRACT);
  assert.equal(r.is_production, false);
  assert.equal(r.decision, 'NO-GO');
  assert.equal(r.summary.go, 0);
  assert.equal(r.summary.no_go, 8);
  assert.equal(r.traceability.sources_needing_human_review.length, 3);
  assert.equal(r.traceability.causal_links_pending.length, 5);
});

test('buildGoNoGoReport: producción BLOQUEADA por política aun con firmas + doble gate', () => {
  const signoffEval = validateEditorialSignoff(realSignoff(), { requiredKeys: RC_KEYS });
  const r = buildGoNoGoReport({
    rc: RC, coverage: { coverage_pct: 100, ok: true, coverage_ok: true },
    signoffEval, doubleGate: { double_gate_ok: true }, publishEnabled: false, generatedAt: 'T',
  });
  // Cada item aprobado es GO, pero el TOTAL sigue NO-GO por política.
  assert.equal(r.summary.go, 8);
  assert.equal(r.decision, 'NO-GO');
  assert.ok(r.blockers.some((b) => /DESHABILITADA por política/.test(b)));
});

test('buildGoNoGoReport: sólo con publish habilitado + firmas + doble gate ⇒ GO', () => {
  const signoffEval = validateEditorialSignoff(realSignoff(), { requiredKeys: RC_KEYS });
  const r = buildGoNoGoReport({
    rc: RC, coverage: { coverage_pct: 100, ok: true, coverage_ok: true },
    signoffEval, doubleGate: { double_gate_ok: true }, publishEnabled: true, generatedAt: 'T',
  });
  assert.equal(r.decision, 'GO');
});

test('buildGoNoGoReport: un EJEMPLO como sign-off nunca produce GO total', () => {
  const ex = readJson(resolve(REPO_ROOT, '.editorial-signoff.example.json'));
  const signoffEval = validateEditorialSignoff(ex, { requiredKeys: RC_KEYS });
  const r = buildGoNoGoReport({
    rc: RC, coverage: { coverage_pct: 100, ok: true, coverage_ok: true },
    signoffEval, doubleGate: { double_gate_ok: true }, publishEnabled: true, generatedAt: 'T',
  });
  assert.equal(r.decision, 'NO-GO');
  assert.ok(r.blockers.some((b) => /EJEMPLO/.test(b)));
});

test('build-go-no-go --check: el reporte versionado está al día y no es producción', () => {
  const SCRIPT = resolve(REPO_ROOT, 'scripts/build-go-no-go.mjs');
  const out = execFileSync('node', [SCRIPT, '--check'], { cwd: REPO_ROOT, encoding: 'utf8', env: { ...process.env, GEOP_EDITORIAL_SIGNOFF: '', GEOP_PROMOTION_SIGNOFF: '', GEOP_RELEASE_CONFIRM: '' } });
  assert.match(out, /al día/);
  const r = readJson(resolve(REPO_ROOT, 'api/v1/rc/go-no-go.json'));
  assert.equal(r.contract, GONOGO_CONTRACT);
  assert.equal(r.is_production, false);
  assert.equal(r.decision, 'NO-GO');
});

/* ==================== 5) RC intacto y árbol limpio ===================== */

test('el manifiesto RC (Sprint 19) sigue intacto: is_production=false, no toca canónicos', () => {
  const m = readJson(resolve(REPO_ROOT, 'api/v1/rc/manifest.json'));
  assert.equal(m.is_production, false);
  assert.equal(m.production.publish_enabled, false);
  for (const a of m.artifacts) assert.match(a.path, /^api\/v1\/staging\//);
});

test('los scripts de gobernanza en modo lectura NO dejan diffs versionados', () => {
  const status = () => execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: REPO_ROOT, encoding: 'utf8' });
  const before = status();
  for (const [s, a] of [
    ['scripts/build-evidence-packages.mjs', ['--check']],
    ['scripts/build-go-no-go.mjs', ['--check']],
    ['scripts/build-evidence-packages.mjs', ['--json']],
    ['scripts/build-go-no-go.mjs', ['--json']],
  ]) {
    execFileSync('node', [resolve(REPO_ROOT, s), ...a], { cwd: REPO_ROOT, stdio: 'ignore', env: { ...process.env, GEOP_EDITORIAL_SIGNOFF: '', GEOP_PROMOTION_SIGNOFF: '', GEOP_RELEASE_CONFIRM: '' } });
  }
  assert.equal(status(), before, 'los checks de gobernanza deben ser no-write/no-diff');
});
