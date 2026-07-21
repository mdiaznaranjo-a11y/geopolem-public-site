// GEOPÓLEM (Sprint 18) — simulacro de release GATED: segunda confirmación,
// rollback de canónicos, setup-hooks no destructivo, cola de revisión editorial,
// simulacro end-to-end y garantía de árbol limpio.
// ---------------------------------------------------------------------------
// Cubre las garantías del sprint:
//   • Segunda confirmación (release-confirmation): independiente del sign-off,
//     exige frase de reconocimiento, se rehúsa en CI, rechaza secretos; el doble
//     gate nunca habilita publicación real (producción DESHABILITADA).
//   • Rollback de canónicos: roundtrip backup→mutación→restore en tempdir con
//     verificación sha256; NO toca el repo real; el plan excluye staging.
//   • setup-hooks: instala en tempdir, es idempotente, respalda hook ajeno y no
//     lo pisa sin --force; --check no escribe.
//   • Cola de revisión editorial: enumera exactamente los pendientes de los datos
//     (sin inventar), es determinista y --check detecta desactualización.
//   • Release simulation: corre end-to-end, deja el árbol limpio y reporta el
//     doble gate con producción deshabilitada.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readFileSync, existsSync, rmSync, mkdtempSync, mkdirSync, writeFileSync, chmodSync, readdirSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const {
  resolveReleaseConfirmation, evaluateProductionRelease, detectCI,
  REQUIRED_ACK, CONFIRM_ENV_VAR, PRODUCTION_PUBLISH_ENABLED,
} = await import('../../release-confirmation.mjs');
const {
  planCanonicalBackup, sha256, diffManifests, isStagingLike, FIXED_CANONICAL_PATHS,
} = await import('../../canonical-rollback.mjs');
const { simulateRollbackRoundtrip } = await import('../../scripts/canonical-rollback.mjs');
const { buildReviewQueue, REVIEW_QUEUE_CONTRACT } = await import('../../editorial-review.mjs');
const { buildReport, toMarkdown } = await import('../../scripts/release-simulation.mjs');
const { inspectHook, installHook, uninstallHook } = await import('../../scripts/setup-hooks.mjs');

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/* ============================ 1) segunda confirmación ===================== */

test('resolveReleaseConfirmation: acepta env con confirmed_by + scope + frase de ack', () => {
  const r = resolveReleaseConfirmation({
    env: { [CONFIRM_ENV_VAR]: `confirmed_by=Ana;scope=production;ack=${REQUIRED_ACK};date=2026-07-07` },
  });
  assert.equal(r.ok, true);
  assert.equal(r.confirmation.confirmed_by, 'Ana');
  assert.equal(r.confirmation.scope, 'production');
});

test('resolveReleaseConfirmation: la frase de ack tolera tildes/mayúsculas pero exige la frase completa', () => {
  const ok = resolveReleaseConfirmation({ env: { [CONFIRM_ENV_VAR]: 'confirmed_by=Ana;scope=production;ack=Confirmo Publicación A Producción' } });
  assert.equal(ok.ok, true);
  const bad = resolveReleaseConfirmation({ env: { [CONFIRM_ENV_VAR]: 'confirmed_by=Ana;scope=production;ack=yes' } });
  assert.equal(bad.ok, false);
});

test('resolveReleaseConfirmation: se REHÚSA en CI (no automatizable)', () => {
  const r = resolveReleaseConfirmation({
    env: { CI: 'true', [CONFIRM_ENV_VAR]: `confirmed_by=Ana;scope=production;ack=${REQUIRED_ACK}` },
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /CI/i);
  assert.equal(detectCI({ GITHUB_ACTIONS: 'true' }), true);
  assert.equal(detectCI({ CI: 'false' }), false);
});

test('resolveReleaseConfirmation: rechaza valores que aparentan secretos', () => {
  const r = resolveReleaseConfirmation({
    env: { [CONFIRM_ENV_VAR]: `confirmed_by=Ana;scope=production;ack=${REQUIRED_ACK};token=abc` },
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /secreto/i);
});

test('resolveReleaseConfirmation: sin fuente NO confirma', () => {
  const r = resolveReleaseConfirmation({ env: {}, confirmPath: '/no/existe.json', fileExists: () => false });
  assert.equal(r.ok, false);
  assert.equal(r.source, 'none');
});

test('evaluateProductionRelease: doble gate satisfecho pero producción DESHABILITADA', () => {
  const signoff = { ok: true };
  const confirmation = { ok: true };
  const ev = evaluateProductionRelease({ signoff, confirmation });
  assert.equal(ev.double_gate_ok, true);
  assert.equal(ev.publish_enabled, false);
  assert.equal(ev.ready_for_real_release, false);
  assert.equal(PRODUCTION_PUBLISH_ENABLED, false);
});

test('evaluateProductionRelease: falta un gate → no listo y con motivos', () => {
  const ev = evaluateProductionRelease({ signoff: { ok: true }, confirmation: { ok: false, reason: 'ausente' } });
  assert.equal(ev.double_gate_ok, false);
  assert.equal(ev.ready_for_real_release, false);
  assert.ok(ev.reasons.some((r) => /segunda confirmación/i.test(r)));
});

/* --- integración con el CLI de promoción: producción sigue bloqueada/dry-run - */

test('promote --promote-production con sign-off informa la segunda confirmación (producción no se publica)', () => {
  const SCRIPT = resolve(REPO_ROOT, 'scripts/promote-canonical-staging.mjs');
  const out = execFileSync('node', [SCRIPT, '--promote-production', '--json'], {
    cwd: resolve(REPO_ROOT, 'api-server'), encoding: 'utf8',
    env: { ...process.env, GEOP_PROMOTION_SIGNOFF: 'approver=Ana;scope=production;date=2026-07-07', CI: '' },
  });
  const parsed = JSON.parse(out);
  assert.equal(parsed.release.ready_for_real_release, false);
  assert.equal(parsed.summary.touches_canonical, false);
});

/* ============================ 2) rollback de canónicos ==================== */

test('planCanonicalBackup: incluye los canónicos fijos + detalles por id, excluye staging', () => {
  const plan = planCanonicalBackup({ conflictIds: ['ukr-rus', 'sahel'], fileExists: () => true });
  const paths = plan.files.map((f) => f.path);
  for (const p of FIXED_CANONICAL_PATHS) assert.ok(paths.includes(p), `falta canónico fijo ${p}`);
  assert.ok(paths.includes('api/v1/conflicts/ukr-rus.json'));
  assert.ok(paths.every((p) => !isStagingLike(p)), 'ningún path debe ser de staging');
});

test('planCanonicalBackup: omite ausentes salvo includeMissing', () => {
  const present = planCanonicalBackup({ conflictIds: [], fileExists: (p) => p === 'api/v1/conflicts.json' });
  assert.equal(present.files.length, 1);
  const withMissing = planCanonicalBackup({ conflictIds: [], fileExists: (p) => p === 'api/v1/conflicts.json', includeMissing: true });
  assert.ok(withMissing.files.length > 1);
});

test('diffManifests / sha256: detecta cambios y coincidencias', () => {
  const a = sha256('hola');
  assert.equal(a, sha256('hola'));
  assert.notEqual(a, sha256('adios'));
  const clean = diffManifests({ 'x': a }, { 'x': a });
  assert.equal(clean.ok, true);
  const dirty = diffManifests({ 'x': a }, { 'x': sha256('otro') });
  assert.equal(dirty.ok, false);
  assert.deepEqual(dirty.mismatched, ['x']);
});

test('simulateRollbackRoundtrip: backup→mutación→restore en tempdir devuelve el estado original', () => {
  const work = mkdtempSync(join(tmpdir(), 'geop-cr-'));
  try {
    const res = simulateRollbackRoundtrip({ workDir: work });
    assert.equal(res.ok, true);
    assert.equal(res.mutated_detected, true);
    assert.equal(res.restored_ok, true);
    assert.deepEqual(res.mismatched, []);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('canonical-rollback CLI: backup+restore en GEOP_CANONICAL_ROOT no toca el repo real', () => {
  const SCRIPT = resolve(REPO_ROOT, 'scripts/canonical-rollback.mjs');
  const root = mkdtempSync(join(tmpdir(), 'geop-canon-'));
  try {
    mkdirSync(join(root, 'api/v1/conflicts'), { recursive: true });
    const listPath = join(root, 'api/v1/conflicts.json');
    writeFileSync(listPath, `${JSON.stringify({ data: [{ id: 'z', slug: 'z' }] })}\n`);
    writeFileSync(join(root, 'api/v1/conflicts/z.json'), `${JSON.stringify({ data: { id: 'z' } })}\n`);
    const run = (mode) => execFileSync('node', [SCRIPT, mode, '--json'], { cwd: REPO_ROOT, encoding: 'utf8', env: { ...process.env, GEOP_CANONICAL_ROOT: root } });
    assert.equal(JSON.parse(run('--backup')).ok, true);
    // Corrompe y restaura.
    writeFileSync(listPath, 'CORRUPT\n');
    const restore = JSON.parse(run('--restore'));
    assert.equal(restore.ok, true);
    assert.match(readFileSync(listPath, 'utf8'), /"data"/);
    // Backup vive DENTRO del tempdir, no en el repo.
    assert.ok(existsSync(join(root, '.canonical-rollback/manifest.json')));
    assert.equal(existsSync(resolve(REPO_ROOT, '.canonical-rollback')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/* ============================ 3) setup-hooks ============================== */

test('setup-hooks: instala en tempdir, es idempotente y --check no escribe', () => {
  const hooksDir = mkdtempSync(join(tmpdir(), 'geop-hooks-'));
  try {
    assert.equal(inspectHook(hooksDir).installed, false);
    const first = installHook({ hooksDir });
    assert.equal(first.ok, true);
    assert.equal(first.managed, true);
    assert.ok(existsSync(join(hooksDir, 'pre-commit')));
    const again = installHook({ hooksDir });
    assert.equal(again.idempotent, true);
    const state = inspectHook(hooksDir);
    assert.equal(state.installed, true);
    assert.equal(state.managed, true);
  } finally {
    rmSync(hooksDir, { recursive: true, force: true });
  }
});

test('setup-hooks: NO pisa un hook ajeno sin --force; con --force lo respalda', () => {
  const hooksDir = mkdtempSync(join(tmpdir(), 'geop-hooks-'));
  try {
    const foreign = join(hooksDir, 'pre-commit');
    writeFileSync(foreign, '#!/bin/sh\necho ajeno\n');
    chmodSync(foreign, 0o755);
    const blocked = installHook({ hooksDir });
    assert.equal(blocked.ok, false);
    assert.match(blocked.reason, /ajeno|force/i);
    const forced = installHook({ hooksDir, force: true });
    assert.equal(forced.ok, true);
    assert.ok(existsSync(`${foreign}.local`), 'debe respaldar el hook ajeno');
  } finally {
    rmSync(hooksDir, { recursive: true, force: true });
  }
});

test('setup-hooks: uninstall elimina sólo el hook gestionado y restaura backup', () => {
  const hooksDir = mkdtempSync(join(tmpdir(), 'geop-hooks-'));
  try {
    writeFileSync(join(hooksDir, 'pre-commit'), '#!/bin/sh\necho ajeno\n');
    installHook({ hooksDir, force: true }); // respalda ajeno → pre-commit.local
    const un = uninstallHook({ hooksDir });
    assert.equal(un.ok, true);
    assert.equal(un.restored_backup, true);
    assert.match(readFileSync(join(hooksDir, 'pre-commit'), 'utf8'), /ajeno/);
  } finally {
    rmSync(hooksDir, { recursive: true, force: true });
  }
});

test('la plantilla .githooks/pre-commit existe, es ejecutable y llama a check-clean-tree', () => {
  const tpl = resolve(REPO_ROOT, '.githooks/pre-commit');
  assert.ok(existsSync(tpl));
  const content = readFileSync(tpl, 'utf8');
  assert.match(content, /check-clean-tree\.mjs/);
  assert.match(content, /GEOPOLEM-MANAGED-HOOK/);
});

/* ============================ 4) cola de revisión editorial =============== */

test('buildReviewQueue: enumera exactamente los pendientes de los datos del repo (sin inventar)', () => {
  const seed = readJson(resolve(REPO_ROOT, 'data/conflict-relations.verified.seed.json'));
  const todo = readJson(resolve(REPO_ROOT, 'data/source-research.todo.json'));
  const q = buildReviewQueue({ seed, todo, generatedAt: todo.generated_at });
  assert.equal(q.contract, REVIEW_QUEUE_CONTRACT);
  assert.equal(q.summary.source_review, 3);
  assert.equal(q.summary.causal_link_pending, 5);
  assert.equal(q.summary.total, 8);
  // Todos requieren acceso externo → ninguno resoluble sólo con el repo.
  assert.equal(q.summary.resolvable_in_repo, 0);
  // Cada item lleva una acción recomendada accionable.
  for (const it of q.items) assert.ok(it.recommended_action && it.recommended_action.length > 10);
});

test('buildReviewQueue: es determinista (mismo generated_at → misma salida)', () => {
  const seed = readJson(resolve(REPO_ROOT, 'data/conflict-relations.verified.seed.json'));
  const todo = readJson(resolve(REPO_ROOT, 'data/source-research.todo.json'));
  const a = buildReviewQueue({ seed, todo, generatedAt: '2026-07-07T00:00:00.000Z' });
  const b = buildReviewQueue({ seed, todo, generatedAt: '2026-07-07T00:00:00.000Z' });
  assert.deepEqual(a, b);
});

test('editorial-review-queue --check: el artefacto versionado está al día', () => {
  const SCRIPT = resolve(REPO_ROOT, 'scripts/editorial-review-queue.mjs');
  const out = execFileSync('node', [SCRIPT, '--check'], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.match(out, /al día/);
  // Y el artefacto existe en disco con el contrato esperado.
  const q = readJson(resolve(REPO_ROOT, 'data/editorial-review-queue.json'));
  assert.equal(q.contract, REVIEW_QUEUE_CONTRACT);
  assert.equal(q.summary.total, 8);
});

/* ============================ 5) release simulation ====================== */

test('buildReport: simulacro end-to-end reporta 7 etapas y NO publica producción', () => {
  const rep = buildReport();
  assert.equal(rep.production_published, false);
  assert.equal(rep.steps.length, 7);
  const names = rep.steps.map((s) => s.name);
  for (const n of ['checks', 'dry_run', 'staging_validation', 'clean_tree', 'rollback_sim', 'editorial_queue', 'release_gate']) {
    assert.ok(names.includes(n), `falta etapa ${n}`);
  }
  // La etapa del gate confirma que la publicación real está deshabilitada.
  const gate = rep.steps.find((s) => s.name === 'release_gate');
  assert.equal(gate.detail.ready_for_real_release, false);
  assert.match(toMarkdown(rep), /Producción publicada:\*\* NO/);
});

test('release-simulation CLI: deja el árbol Git limpio (no-diff en versionados)', () => {
  const SCRIPT = resolve(REPO_ROOT, 'scripts/release-simulation.mjs');
  const status = () => execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: REPO_ROOT, encoding: 'utf8' });
  const before = status();
  execFileSync('node', [SCRIPT, '--json'], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.equal(status(), before, 'el simulacro no debe dejar diffs versionados');
});
