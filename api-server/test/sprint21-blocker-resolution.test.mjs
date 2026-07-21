// GEOPÓLEM (Sprint 21) — Resolución técnica de bloqueos con evidencia alternativa.
// ---------------------------------------------------------------------------
// Cubre las garantías del sprint:
//   • TRANSICIÓN: un pendiente con evidencia alternativa verificada avanza a
//     'evidence_ready' (y sólo hasta ahí). La transición es válida en la máquina
//     de estados y queda trazada (from/to/reasons).
//   • NO AUTO-APROBACIÓN: cualquier target_state de decisión terminal
//     (approved/rejected/deferred) se REFUSA; el estado se mantiene.
//   • BLOQUEO MANTENIDO: sin fuente alternativa utilizable, un blocked_by_source
//     sigue blocked_by_source (no se inventa evidencia).
//   • GO/NO-GO ACTUALIZADO: refleja evidence_ready pero go=0 y total NO-GO;
//     producción bloqueada por política (is_production=false).
//   • ARTEFACTOS AL DÍA: la cola resuelta, el manifiesto, los .md y el go/no-go
//     versionados coinciden con lo generado (--check).
//   • CLEAN-TREE: los scripts de resolución en modo lectura no dejan diffs.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const res = await import('../../editorial-blocker-resolution.mjs');
const {
  RESOLVED_QUEUE_CONTRACT, RESOLUTION_EVIDENCE_CONTRACT, RESOLUTION_GONOGO_CONTRACT,
  ALT_EVIDENCE_CONTRACT, MAX_TARGET_STATE,
  indexAlternativeEvidence, resolveItemState, buildResolvedItem, buildResolvedQueue,
  buildResolutionEvidencePackage, renderResolutionEvidenceMarkdown, resolutionEvidenceFileName,
  buildResolutionEvidenceManifest, validateResolutionEvidenceManifest,
  validateAlternativeEvidence, buildResolvedGoNoGo,
} = res;

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const RC = readJson(resolve(REPO_ROOT, 'data/editorial-review-queue.rc.json'));
const ALT = readJson(resolve(REPO_ROOT, 'data/editorial-alternative-evidence.sprint21.json'));

const rcItem = (key) => RC.items.find((i) => i.key === key);
const altEntry = (key) => indexAlternativeEvidence(ALT)[key];

const SOURCE_KEY = 'ukr-rus::source::iaea-ukraine-update-356';
const CAUSAL_KEY = 'stablecoins::causal::Riesgo de estabilidad financiera por stablecoins';

/* ==================== 1) TRANSICIÓN DE ESTADO =========================== */

test('resolveItemState: blocked_by_source con evidencia verificada → evidence_ready', () => {
  const st = resolveItemState(rcItem(SOURCE_KEY), altEntry(SOURCE_KEY));
  assert.equal(st.from, 'blocked_by_source');
  assert.equal(st.to, 'evidence_ready');
  assert.equal(st.changed, true);
  assert.equal(st.valid, true);
  assert.equal(st.resolution, 'resolved_via_alternative_source');
});

test('resolveItemState: needs_human_review con evidencia verificada → evidence_ready', () => {
  const st = resolveItemState(rcItem(CAUSAL_KEY), altEntry(CAUSAL_KEY));
  assert.equal(st.from, 'needs_human_review');
  assert.equal(st.to, 'evidence_ready');
  assert.equal(st.changed, true);
});

test('resolveItemState: el estado objetivo máximo es evidence_ready (nunca decisión)', () => {
  assert.equal(MAX_TARGET_STATE, 'evidence_ready');
});

/* ==================== 2) NO AUTO-APROBACIÓN ============================= */

test('resolveItemState: target_state=approved se REFUSA (no auto-aprobación)', () => {
  const poisoned = { ...altEntry(SOURCE_KEY), target_state: 'approved' };
  const st = resolveItemState(rcItem(SOURCE_KEY), poisoned);
  assert.equal(st.changed, false);
  assert.equal(st.valid, false);
  assert.equal(st.to, 'blocked_by_source'); // se mantiene
  assert.equal(st.resolution, 'auto_approval_refused');
  assert.ok(st.reasons.some((r) => /REFUSADA/.test(r)));
});

test('resolveItemState: rejected/deferred como objetivo también se refusan', () => {
  for (const target of ['rejected', 'deferred']) {
    const poisoned = { ...altEntry(CAUSAL_KEY), target_state: target };
    const st = resolveItemState(rcItem(CAUSAL_KEY), poisoned);
    assert.equal(st.changed, false, `${target} no debe avanzar`);
    assert.equal(st.to, 'needs_human_review');
  }
});

test('buildResolvedItem: nunca emite decisión; decision queda null', () => {
  const it = buildResolvedItem(rcItem(SOURCE_KEY), altEntry(SOURCE_KEY));
  assert.equal(it.decision, null);
  assert.equal(it.governance_state, 'evidence_ready');
});

/* ==================== 3) BLOQUEO MANTENIDO SIN EVIDENCIA ================ */

test('resolveItemState: sin entrada de evidencia, el bloqueo se mantiene', () => {
  const st = resolveItemState(rcItem(SOURCE_KEY), null);
  assert.equal(st.to, 'blocked_by_source');
  assert.equal(st.changed, false);
  assert.equal(st.resolution, 'unresolved_kept_blocked');
});

test('resolveItemState: fuente sin url/accessed_via/http_result NO es utilizable → bloqueo mantenido', () => {
  const unusable = {
    key: SOURCE_KEY,
    resolution: 'resolved_via_alternative_source',
    target_state: 'evidence_ready',
    alternative_sources: [{ slug: 'x', title: 'sin trazabilidad' }],
  };
  const st = resolveItemState(rcItem(SOURCE_KEY), unusable);
  assert.equal(st.changed, false);
  assert.equal(st.to, 'blocked_by_source');
  assert.equal(st.resolution, 'unresolved_kept_blocked');
});

/* ==================== 4) COLA RESUELTA (overlay) ======================== */

test('buildResolvedQueue: 8/8 a evidence_ready, 0 aprobados, determinista, RC intacta', () => {
  const a = buildResolvedQueue({ rc: RC, alt: ALT, generatedAt: RC.generated_at });
  const b = buildResolvedQueue({ rc: RC, alt: ALT, generatedAt: RC.generated_at });
  assert.deepEqual(a, b);
  assert.equal(a.contract, RESOLVED_QUEUE_CONTRACT);
  assert.equal(a.summary.total, 8);
  assert.equal(a.summary.resolved_via_alternative_source, 8);
  assert.equal(a.summary.by_state.evidence_ready, 8);
  assert.equal(a.summary.approved, 0);
  assert.equal(a.summary.auto_approvals, 0);
  // La cola RC original no se muta.
  assert.equal(RC.items[0].classification, 'needs_human_review');
});

/* ==================== 5) EVIDENCIA AMPLIADA ============================= */

test('buildResolutionEvidenceManifest: cubre exactamente la cola RC y no hay decisiones terminales', () => {
  const man = buildResolutionEvidenceManifest({ rc: RC, alt: ALT, conflictDetails: {}, generatedAt: RC.generated_at });
  assert.equal(man.contract, RESOLUTION_EVIDENCE_CONTRACT);
  assert.equal(man.summary.total, 8);
  assert.equal(man.summary.by_state.evidence_ready, 8);
  const v = validateResolutionEvidenceManifest(man, RC);
  assert.equal(v.ok, true, v.errors.join('; '));
});

test('renderResolutionEvidenceMarkdown: incluye transición, fuentes alternativas y metadatos', () => {
  const pkg = buildResolutionEvidencePackage(rcItem(SOURCE_KEY), { conflictDetail: null, altEntry: altEntry(SOURCE_KEY) });
  const md = renderResolutionEvidenceMarkdown(pkg);
  assert.match(md, /## Transición de estado/);
  assert.match(md, /blocked_by_source.*evidence_ready/);
  assert.match(md, /## Fuentes alternativas verificadas/);
  assert.match(md, /URL: <https:\/\/news\.un\.org/);
  assert.match(md, /Resultado HTTP: `HTTP 200`/);
  assert.match(md, /NO aprueba ni habilita producción/);
});

test('resolutionEvidenceFileName: nombre estable/seguro derivado de la clave', () => {
  assert.equal(resolutionEvidenceFileName('ukr-rus::source::iaea-x'), 'ukr-rus-source-iaea-x.md');
});

/* ==================== 6) VALIDACIÓN DE EVIDENCIA ALTERNATIVA ============ */

test('validateAlternativeEvidence: el dataset versionado es válido y cubre claves RC', () => {
  const v = validateAlternativeEvidence(ALT, RC);
  assert.equal(v.ok, true, v.errors.join('; '));
  assert.equal(ALT.contract, ALT_EVIDENCE_CONTRACT);
});

test('validateAlternativeEvidence: rechaza target_state de decisión (no auto-aprobación)', () => {
  const bad = JSON.parse(JSON.stringify(ALT));
  bad.entries[0].target_state = 'approved';
  const v = validateAlternativeEvidence(bad, RC);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /decisión humana/.test(e)));
});

test('validateAlternativeEvidence: rechaza valores que aparentan secretos', () => {
  const bad = JSON.parse(JSON.stringify(ALT));
  bad.entries[0].alternative_sources[0].note = 'api_key=deadbeef';
  const v = validateAlternativeEvidence(bad, RC);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /secreto/.test(e)));
});

/* ==================== 7) GO / NO-GO ACTUALIZADO ======================== */

test('buildResolvedGoNoGo: evidence_ready NO es GO; go=0, total NO-GO, producción bloqueada', () => {
  const resolvedQueue = buildResolvedQueue({ rc: RC, alt: ALT, generatedAt: RC.generated_at });
  const r = buildResolvedGoNoGo({
    resolvedQueue,
    coverage: { coverage_pct: 100, ok: true, coverage_ok: true },
    signoffEval: null, publishEnabled: false, generatedAt: RC.generated_at,
  });
  assert.equal(r.contract, RESOLUTION_GONOGO_CONTRACT);
  assert.equal(r.is_production, false);
  assert.equal(r.decision, 'NO-GO');
  assert.equal(r.summary.go, 0);
  assert.equal(r.summary.evidence_ready, 8);
  assert.equal(r.summary.still_blocked, 0);
  assert.ok(r.blockers.some((b) => /DESHABILITADA por política/.test(b)));
  assert.ok(r.blockers.some((b) => /evidence_ready/.test(b)));
});

/* ==================== 8) ARTEFACTOS VERSIONADOS AL DÍA ================== */

test('resolution:build --check: cola resuelta, manifiesto, .md y go/no-go al día', () => {
  const SCRIPT = resolve(REPO_ROOT, 'scripts/build-blocker-resolution.mjs');
  const out = execFileSync('node', [SCRIPT, '--check'], {
    cwd: REPO_ROOT, encoding: 'utf8',
    env: { ...process.env, GEOP_EDITORIAL_SIGNOFF: '', GEOP_PROMOTION_SIGNOFF: '', GEOP_RELEASE_CONFIRM: '' },
  });
  assert.match(out, /NO-GO/);
  const q = readJson(resolve(REPO_ROOT, 'data/editorial-review-queue.sprint21.json'));
  assert.equal(q.contract, RESOLVED_QUEUE_CONTRACT);
  assert.equal(q.summary.by_state.evidence_ready, 8);
  const man = readJson(resolve(REPO_ROOT, 'editorial-review/sprint21/manifest.json'));
  for (const it of man.items) {
    assert.ok(existsSync(resolve(REPO_ROOT, 'editorial-review/sprint21', it.evidence_file)), `falta ${it.evidence_file}`);
  }
  const g = readJson(resolve(REPO_ROOT, 'api/v1/rc/go-no-go.sprint21.json'));
  assert.equal(g.is_production, false);
  assert.equal(g.decision, 'NO-GO');
  assert.equal(g.summary.go, 0);
});

/* ==================== 9) RC INTACTO Y ÁRBOL LIMPIO ===================== */

test('la cola RC del Sprint 19 sigue intacta (Sprint 21 es overlay, no la muta)', () => {
  const rc = readJson(resolve(REPO_ROOT, 'data/editorial-review-queue.rc.json'));
  assert.equal(rc.contract, 'sprint-19-editorial-review-rc-v1');
  assert.equal(rc.summary.total, 8);
  assert.equal(rc.summary.by_classification.blocked_by_source, 3);
  assert.equal(rc.summary.by_classification.needs_human_review, 5);
});

test('los scripts de resolución en modo lectura NO dejan diffs versionados', () => {
  const status = () => execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: REPO_ROOT, encoding: 'utf8' });
  const before = status();
  for (const a of [['--check'], ['--json']]) {
    execFileSync('node', [resolve(REPO_ROOT, 'scripts/build-blocker-resolution.mjs'), ...a], {
      cwd: REPO_ROOT, stdio: 'ignore',
      env: { ...process.env, GEOP_EDITORIAL_SIGNOFF: '', GEOP_PROMOTION_SIGNOFF: '', GEOP_RELEASE_CONFIRM: '' },
    });
  }
  assert.equal(status(), before, 'los checks de resolución deben ser no-write/no-diff');
});
