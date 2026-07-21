// GEOPÓLEM (Sprint 18) — Simulacro de release GATED end-to-end (sin producción).
// ---------------------------------------------------------------------------
// Orquesta, en secuencia y SIN tocar producción, todas las etapas de un release
// controlado y produce un reporte auditable (JSON + Markdown):
//
//   1) checks            gate editorial de promoción           (promote:check)
//   2) dry_run           resumen auditable no-write             (promote --dry-run --json)
//   3) staging_validation consumo E2E de artefactos de staging  (validate-staging-artifacts)
//   4) clean_tree        garantía NO-WRITE/NO-DIFF              (check-clean-tree)
//   5) rollback_sim      roundtrip de rollback de canónicos     (tempdir, fixtures)
//   6) editorial_queue   cola de revisión residual al día       (editorial-review-queue --check)
//   7) release_gate      doble gate (sign-off + 2ª confirmación) — producción DESHABILITADA
//
// GARANTÍAS: todas las etapas son read-only sobre el repo o trabajan en un
// tempdir; el simulacro DEJA EL ÁRBOL LIMPIO. Por defecto imprime a stdout; con
// --out-dir=DIR escribe report.json + report.md (DIR debería estar gitignorado,
// p.ej. .release-sim/). NUNCA publica producción.
//
// Flags: --json (imprime JSON), --md (imprime Markdown, por defecto),
//        --out-dir=DIR (además, escribe report.json + report.md).
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import {
  mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync,
} from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { simulateRollbackRoundtrip } from './canonical-rollback.mjs';
import { resolveSignoff } from '../promotion-signoff.mjs';
import { resolveReleaseConfirmation, evaluateProductionRelease } from '../release-confirmation.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');

// Ejecuta un script node y captura salida/estado sin lanzar.
function runNode(scriptRel, argsArr = [], cwd = REPO_ROOT) {
  try {
    const stdout = execFileSync('node', [resolve(REPO_ROOT, scriptRel), ...argsArr], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, code: 0, stdout };
  } catch (e) {
    return { ok: false, code: e.status ?? 1, stdout: e.stdout?.toString() ?? '', stderr: e.stderr?.toString() ?? '' };
  }
}

function stepChecks() {
  const r = runNode('scripts/promote-canonical-staging.mjs', ['--check', '--json']);
  let gate = null;
  try { gate = JSON.parse(r.stdout).gate; } catch { /* noop */ }
  return { name: 'checks', ok: r.ok, detail: gate ? { authorized: Boolean(gate.ok && gate.coverage_ok), coverage_pct: gate.coverage_pct, blockers: gate.blockers.length } : null };
}

function stepDryRun() {
  const r = runNode('scripts/promote-canonical-staging.mjs', ['--dry-run', '--json']);
  let summary = null;
  try { summary = JSON.parse(r.stdout).summary; } catch { /* noop */ }
  const ok = r.ok && summary && summary.touches_disk === false && summary.touches_canonical === false;
  return {
    name: 'dry_run', ok: Boolean(ok),
    detail: summary ? { files_would_write: summary.counts.files_would_write, touches_disk: summary.touches_disk, touches_canonical: summary.touches_canonical } : null,
  };
}

function stepStagingValidation() {
  const r = runNode('scripts/validate-staging-artifacts.mjs', []);
  return { name: 'staging_validation', ok: r.ok, detail: { exit: r.code } };
}

function stepCleanTree() {
  const r = runNode('scripts/check-clean-tree.mjs', []);
  return { name: 'clean_tree', ok: r.ok, detail: { exit: r.code } };
}

function stepRollbackSim() {
  const work = mkdtempSync(join(tmpdir(), 'geop-relsim-rollback-'));
  try {
    const res = simulateRollbackRoundtrip({ workDir: work });
    return { name: 'rollback_sim', ok: res.ok, detail: { files: res.files, mutated_detected: res.mutated_detected, restored_ok: res.restored_ok } };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function stepEditorialQueue() {
  const r = runNode('scripts/editorial-review-queue.mjs', ['--check']);
  return { name: 'editorial_queue', ok: r.ok, detail: { up_to_date: r.ok } };
}

// Estado del doble gate a producción (report-only; producción DESHABILITADA).
function stepReleaseGate() {
  const signoff = resolveSignoff({
    env: process.env,
    signoffPath: resolve(REPO_ROOT, '.promotion-signoff.json'),
    fileExists: existsSync,
    readFile: (p) => readFileSync(p, 'utf8'),
  });
  const confirmation = resolveReleaseConfirmation({
    env: process.env,
    confirmPath: resolve(REPO_ROOT, '.release-confirmation.json'),
    fileExists: existsSync,
    readFile: (p) => readFileSync(p, 'utf8'),
  });
  const release = evaluateProductionRelease({ signoff, confirmation });
  // La etapa se considera OK si el gate se EVALUÓ correctamente: la producción
  // sigue deshabilitada por diseño, lo cual es el resultado esperado del simulacro.
  return {
    name: 'release_gate', ok: release.ready_for_real_release === false,
    detail: {
      signoff_ok: release.signoff_ok,
      confirmation_ok: release.confirmation_ok,
      double_gate_ok: release.double_gate_ok,
      publish_enabled: release.publish_enabled,
      ready_for_real_release: release.ready_for_real_release,
    },
  };
}

function buildReport() {
  const steps = [
    stepChecks(),
    stepDryRun(),
    stepStagingValidation(),
    stepCleanTree(),
    stepRollbackSim(),
    stepEditorialQueue(),
    stepReleaseGate(),
  ];
  const passed = steps.filter((s) => s.ok).length;
  return {
    contract: 'sprint-18-release-simulation-v1',
    generated_at: new Date().toISOString(),
    production_published: false,
    ok: steps.every((s) => s.ok),
    summary: { total: steps.length, passed, failed: steps.length - passed },
    steps,
  };
}

function toMarkdown(rep) {
  const L = [];
  L.push('# GEOPÓLEM — Simulacro de release (Sprint 18)');
  L.push('');
  L.push(`- **Estado global:** ${rep.ok ? '✅ OK' : '❌ FALLÓ'} (${rep.summary.passed}/${rep.summary.total})`);
  L.push(`- **Producción publicada:** NO (simulacro; producción deshabilitada por diseño)`);
  L.push(`- **Generado:** ${rep.generated_at}`);
  L.push('');
  L.push('| Etapa | Resultado | Detalle |');
  L.push('|-------|:---------:|---------|');
  for (const s of rep.steps) {
    L.push(`| ${s.name} | ${s.ok ? '✅' : '❌'} | ${s.detail ? '`' + JSON.stringify(s.detail) + '`' : '—'} |`);
  }
  L.push('');
  L.push('> El simulacro es NO-WRITE sobre producción y deja el árbol Git limpio.');
  return L.join('\n');
}

function main() {
  const args = new Set(process.argv.slice(2));
  const outArg = process.argv.slice(2).find((a) => a.startsWith('--out-dir='));
  const rep = buildReport();

  if (args.has('--json')) process.stdout.write(`${JSON.stringify(rep, null, 2)}\n`);
  else process.stdout.write(`${toMarkdown(rep)}\n`);

  if (outArg) {
    const dir = resolve(REPO_ROOT, outArg.split('=')[1]);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'report.json'), `${JSON.stringify(rep, null, 2)}\n`, 'utf8');
    writeFileSync(join(dir, 'report.md'), `${toMarkdown(rep)}\n`, 'utf8');
    process.stderr.write(`[release-simulation] reporte escrito en ${dir} (report.json + report.md)\n`);
  }
  return rep.ok ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}

export { buildReport, toMarkdown };
