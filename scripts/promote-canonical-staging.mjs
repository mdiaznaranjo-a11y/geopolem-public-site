// GEOPÓLEM — Promoción canónica controlada a STAGING (Sprint 15, endurecido Sprint 17)
// ---------------------------------------------------------------------------
// Lee la semilla VERIFICADA, el inventario, el puente estático v1, los detalles
// canónicos y la cola de investigación (source-research.todo.json), ejecuta el
// GATE editorial de promoción y, según el MODO, reporta, simula (dry-run) o
// ESCRIBE los artefactos de STAGING bajo api/v1/staging/** (detalles por
// conflicto + mapa enriquecido + reporte de cobertura). Con rollback.
//
// NUNCA escribe fuera de api/v1/staging/: los canónicos de producción
// (api/v1/conflicts.json, api/v1/conflicts/{id}.json, map*.json) y data.js/FOCOS
// quedan intactos. La promoción a PRODUCCIÓN exige sign-off editorial humano
// explícito (promotion-signoff.mjs) y aquí SÓLO se ofrece como dry-run auditable.
//
// MODOS (mutuamente excluyentes; se elige el primero presente):
//   --rollback            restaura el respaldo de staging (.rollback)
//   --promote-production  PREPARA la promoción a producción: exige sign-off y
//                         SIEMPRE se comporta como dry-run (no escribe producción)
//   --dry-run             simula la promoción a staging: resume qué se ESCRIBIRÍA
//                         sin tocar disco (auditable). NO-WRITE / NO-DIFF.
//   --check               sólo valida el gate; exit!=0 si BLOQUEADO. NO-WRITE.
//   --write-staging       (alias --staging-generate) ESCRIBE artefactos staging
//   (sin modo)            reporte de texto del gate. NO-WRITE.
//
// Flags auxiliares:
//   --json                salida JSON (reporte / dry-run / check)
//   --min-coverage=N      umbral de cobertura (def. 100)
//   --generated-at=ISO    timestamp determinista para las escrituras (tests/CI)
//
// Sobrescribible por entorno (aislamiento de tests): GEOP_STAGING_ROOT apunta el
// directorio raíz de staging a un tempdir en lugar de api/v1/staging.
// ---------------------------------------------------------------------------

import {
  readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, copyFileSync, readdirSync, rmSync,
} from 'node:fs';
import { dirname, resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validatePromotionReadiness, buildPromotionBundle, collectJustifiedPendingIds,
  summarizePromotion, DEFAULT_MIN_COVERAGE_PCT,
} from '../conflict-promotion.mjs';
import { resolveSignoff, SIGNOFF_FILE, SIGNOFF_ENV_VAR } from '../promotion-signoff.mjs';
import {
  resolveReleaseConfirmation, evaluateProductionRelease, CONFIRM_FILE, CONFIRM_ENV_VAR,
} from '../release-confirmation.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SEED_PATH = resolve(REPO_ROOT, 'data/conflict-relations.verified.seed.json');
const INVENTORY_PATH = resolve(REPO_ROOT, 'data/conflicts.inventory.json');
const TODO_PATH = resolve(REPO_ROOT, 'data/source-research.todo.json');
const LIST_PATH = resolve(REPO_ROOT, 'api/v1/conflicts.json');
const DETAILS_DIR = resolve(REPO_ROOT, 'api/v1/conflicts');
const SIGNOFF_PATH = resolve(REPO_ROOT, SIGNOFF_FILE);
const CONFIRM_PATH = resolve(REPO_ROOT, CONFIRM_FILE);

// Raíz de staging (sobrescribible por entorno para aislar escrituras en tests).
const STAGING_ROOT = process.env.GEOP_STAGING_ROOT
  ? resolve(process.env.GEOP_STAGING_ROOT)
  : resolve(REPO_ROOT, 'api/v1/staging');
const STAGING_DETAILS_DIR = resolve(STAGING_ROOT, 'conflicts');
const stagingDetailPath = (id) => resolve(STAGING_DETAILS_DIR, `${id}.json`);
const STAGING_MAP_PATH = resolve(STAGING_ROOT, 'conflicts/active/map.enriched.json');
const STAGING_BUNDLE_PATH = resolve(STAGING_ROOT, 'conflicts.enriched.json');
const STAGING_COVERAGE_PATH = resolve(STAGING_ROOT, 'coverage-report.json');
const ROLLBACK_DIR = resolve(STAGING_ROOT, '.rollback');

// Rutas destino en forma relativa al repo, para reportes auditables.
const rel = (p) => relative(REPO_ROOT, p);
const TARGETS = {
  bundle: rel(STAGING_BUNDLE_PATH),
  map: rel(STAGING_MAP_PATH),
  coverage: rel(STAGING_COVERAGE_PATH),
  detail: (id) => rel(stagingDetailPath(id)),
};

const argv = process.argv.slice(2);
const args = new Set(argv);
const minCovArg = argv.find((a) => a.startsWith('--min-coverage='));
const MIN_COVERAGE = minCovArg ? Number(minCovArg.split('=')[1]) : DEFAULT_MIN_COVERAGE_PCT;
const genAtArg = argv.find((a) => a.startsWith('--generated-at='));
const GENERATED_AT = genAtArg ? genAtArg.split('=')[1] : null;

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

function writeJsonAtomic(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
  renameSync(tmp, path);
}

// Respalda un archivo existente en .rollback/ (preservando ruta relativa) antes
// de sobrescribirlo, para poder revertir con --rollback.
function backupIfExists(path) {
  if (!existsSync(path)) return;
  const r = relative(STAGING_ROOT, path);
  if (r.startsWith('..')) return; // sólo respaldamos dentro de staging
  const dest = join(ROLLBACK_DIR, r);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(path, dest);
}

function loadDetails(items) {
  const details = {};
  for (const it of items) {
    const id = it.id || it.slug;
    if (!id) continue;
    const p = resolve(DETAILS_DIR, `${id}.json`);
    if (!existsSync(p)) continue;
    try { const j = readJson(p); details[id] = j.data ? j : { data: j }; } catch { /* roto → ausente */ }
  }
  return details;
}

function collectFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name);
    if (name.isDirectory()) collectFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

function doRollback() {
  if (!existsSync(ROLLBACK_DIR)) {
    process.stderr.write('[promote] no hay respaldo (.rollback) que restaurar.\n');
    return 0;
  }
  const files = collectFiles(ROLLBACK_DIR);
  let restored = 0;
  for (const f of files) {
    const r = relative(ROLLBACK_DIR, f);
    const dest = join(STAGING_ROOT, r);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(f, dest);
    restored += 1;
  }
  rmSync(ROLLBACK_DIR, { recursive: true, force: true });
  process.stderr.write(`[promote] rollback: ${restored} archivo(s) restaurado(s) desde .rollback.\n`);
  return 0;
}

function writeStaging(bundle) {
  mkdirSync(STAGING_DETAILS_DIR, { recursive: true });
  // Respalda artefactos previos antes de sobrescribir (rollback).
  backupIfExists(STAGING_BUNDLE_PATH);
  backupIfExists(STAGING_MAP_PATH);
  backupIfExists(STAGING_COVERAGE_PATH);
  for (const id of Object.keys(bundle.detailsDoc.data)) {
    backupIfExists(stagingDetailPath(id));
  }
  // Escribe detalles por conflicto (contrato v1) + bundle + mapa + cobertura.
  for (const [id, data] of Object.entries(bundle.detailsDoc.data)) {
    writeJsonAtomic(stagingDetailPath(id), {
      data,
      meta: { api_version: 'v1', staging: true, source: 'verified-seed-merge (Sprint 15 staging)' },
    });
  }
  writeJsonAtomic(STAGING_BUNDLE_PATH, bundle.detailsDoc);
  writeJsonAtomic(STAGING_MAP_PATH, bundle.mapDoc);
  writeJsonAtomic(STAGING_COVERAGE_PATH, bundle.coverageReport);
}

// Construye el gate a partir de las fuentes de datos del repo.
function computeGate() {
  const seed = readJson(SEED_PATH);
  const inventoryIds = existsSync(INVENTORY_PATH)
    ? (readJson(INVENTORY_PATH).conflicts || []).map((c) => c.id)
    : null;
  const todo = existsSync(TODO_PATH) ? readJson(TODO_PATH) : {};
  const justifiedPendingIds = collectJustifiedPendingIds(todo);
  const gate = validatePromotionReadiness(seed, { minCoveragePct: MIN_COVERAGE, justifiedPendingIds, inventoryIds });
  return { seed, gate };
}

// Construye el bundle en memoria (sin escribir). generatedAt determinista si se
// pasó --generated-at, para garantizar salidas reproducibles (no-diff).
function computeBundle(seed, gate) {
  if (!existsSync(LIST_PATH)) return null;
  const items = readJson(LIST_PATH).data || [];
  const details = loadDetails(items);
  return buildPromotionBundle({ items, details, seed, gate, generatedAt: GENERATED_AT || undefined });
}

function formatReport(gate) {
  const L = [];
  L.push('GEOPÓLEM — Promoción canónica a STAGING (gate)');
  L.push('='.repeat(64));
  L.push(`Cobertura verificada:   ${gate.coverage_pct}% (mínimo requerido: ${gate.min_coverage_pct}%)`);
  L.push(`Gate sin bloqueos:      ${gate.ok ? 'sí' : 'NO'}`);
  L.push(`Cobertura suficiente:   ${gate.coverage_ok ? 'sí' : 'NO'}`);
  L.push(`AUTORIZA promoción:     ${gate.ok && gate.coverage_ok ? 'sí (staging listo)' : 'NO (sólo preview / bloqueado)'}`);
  if (gate.blockers.length) {
    L.push('');
    L.push('BLOQUEOS:');
    for (const b of gate.blockers) L.push(`  ✗ ${b}`);
  }
  if (gate.warnings.length) {
    L.push('');
    L.push('Advertencias:');
    for (const w of gate.warnings) L.push(`  ! ${w}`);
  }
  if (gate.review_flags.length) {
    L.push('');
    L.push('Fuentes con needs_human_review (acceso indirecto):');
    for (const f of gate.review_flags) L.push(`  • ${f.conflict}/${f.source_slug} (${f.accessed_via})`);
  }
  return L.join('\n');
}

function formatDrySummary(summary, signoff, release) {
  const L = [];
  L.push(`GEOPÓLEM — DRY-RUN de promoción (${summary.scope}) — NO-WRITE / NO-DIFF`);
  L.push('='.repeat(64));
  L.push(`Toca disco:             no`);
  L.push(`Toca canónicos:         no`);
  L.push(`Timestamp del bundle:   ${summary.generated_at}`);
  L.push(`AUTORIZA (gate):        ${summary.authorized ? 'sí' : 'NO'} (cobertura ${summary.coverage_pct}%)`);
  if (signoff) {
    L.push(`Sign-off humano:        ${signoff.ok ? `sí (${signoff.source}: ${signoff.signoff.approver})` : `NO — ${signoff.reason}`}`);
  }
  if (release) {
    L.push(`Segunda confirmación:   ${release.confirmation_ok ? 'sí' : 'NO'}`);
    L.push(`Doble gate:             ${release.double_gate_ok ? 'sí' : 'NO'}`);
    L.push(`Publicación real:       DESHABILITADA (no se publica producción en este sprint)`);
  }
  L.push('');
  L.push(`Se ESCRIBIRÍAN ${summary.counts.files_would_write} archivo(s) (${summary.counts.details} detalle/s):`);
  for (const w of summary.would_write) L.push(`  + ${w.path}  [${w.kind}${w.id ? ` ${w.id}` : ''}, canonical=${w.canonical}]`);
  if (summary.blockers.length) {
    L.push('');
    L.push('BLOQUEOS:');
    for (const b of summary.blockers) L.push(`  ✗ ${b}`);
  }
  if (summary.warnings.length) {
    L.push('');
    L.push('Advertencias:');
    for (const w of summary.warnings) L.push(`  ! ${w}`);
  }
  if (summary.pending_checklist.length) {
    L.push('');
    L.push('Checklist pendiente (gates humanos):');
    for (const c of summary.pending_checklist) L.push(`  ☐ ${c}`);
  }
  return L.join('\n');
}

// --- MODO: dry-run de staging (no escribe) ---------------------------------
function runDryRun() {
  const { seed, gate } = computeGate();
  const bundle = computeBundle(seed, gate);
  const summary = summarizePromotion({ bundle, gate, targets: TARGETS, scope: 'staging' });
  if (args.has('--json')) process.stdout.write(`${JSON.stringify({ summary }, null, 2)}\n`);
  else process.stdout.write(`${formatDrySummary(summary)}\n`);
  return 0;
}

// --- MODO: promoción a producción (SIEMPRE dry-run; exige sign-off) ---------
function runPromoteProduction() {
  const signoff = resolveSignoff({
    env: process.env,
    signoffPath: SIGNOFF_PATH,
    fileExists: (p) => existsSync(p),
    readFile: (p) => readFileSync(p, 'utf8'),
  });
  if (!signoff.ok) {
    process.stderr.write(
      `[promote] PRODUCCIÓN BLOQUEADA: falta sign-off humano.\n`
      + `          ${signoff.reason}\n`
      + `          Ejemplo: ${SIGNOFF_ENV_VAR}="approver=NOMBRE;scope=production;date=YYYY-MM-DD"\n`
      + `          Esta autorización NO debe automatizarse en CI.\n`,
    );
    return 3;
  }
  // Con sign-off válido, en este sprint SÓLO se ofrece dry-run auditable:
  // nunca se escriben canónicos de producción desde esta herramienta.
  //
  // Sprint 18: además del sign-off editorial, evaluamos la SEGUNDA CONFIRMACIÓN
  // de release (gate independiente, no automatizable en CI). El doble gate se
  // informa de forma auditable, pero la publicación real sigue DESHABILITADA:
  // aunque ambos gates estén satisfechos, NO se publica producción.
  const confirmation = resolveReleaseConfirmation({
    env: process.env,
    confirmPath: CONFIRM_PATH,
    fileExists: (p) => existsSync(p),
    readFile: (p) => readFileSync(p, 'utf8'),
  });
  const release = evaluateProductionRelease({ signoff, confirmation });
  const { seed, gate } = computeGate();
  const bundle = computeBundle(seed, gate);
  const summary = summarizePromotion({ bundle, gate, targets: TARGETS, scope: 'production' });
  process.stderr.write(`[promote] sign-off aceptado (${signoff.source}: ${signoff.signoff.approver}); ejecutando DRY-RUN de producción (no se publica).\n`);
  if (release.confirmation_ok) {
    process.stderr.write(`[promote] segunda confirmación aceptada (${confirmation.source}: ${confirmation.confirmation.confirmed_by}). Doble gate satisfecho; publicación real DESHABILITADA en este sprint.\n`);
  } else {
    process.stderr.write(`[promote] segunda confirmación de release AUSENTE/INVÁLIDA: ${confirmation.reason}\n          Ejemplo: ${CONFIRM_ENV_VAR}="confirmed_by=NOMBRE;scope=production;ack=<frase>;date=YYYY-MM-DD"\n`);
  }
  if (args.has('--json')) {
    process.stdout.write(`${JSON.stringify({
      summary,
      signoff: { ok: true, source: signoff.source, approver: signoff.signoff.approver },
      confirmation: { ok: release.confirmation_ok, source: confirmation.source },
      release,
    }, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatDrySummary(summary, signoff, release)}\n`);
  }
  // Aunque el gate autorice, haya sign-off y segunda confirmación, NO se publica
  // producción aquí (ready_for_real_release es siempre false en este sprint).
  return summary.authorized ? 0 : 2;
}

function main() {
  // Modos mutuamente excluyentes (orden de prioridad).
  if (args.has('--rollback')) return doRollback();
  if (args.has('--promote-production')) return runPromoteProduction();
  if (args.has('--dry-run')) return runDryRun();

  if (!existsSync(SEED_PATH)) {
    process.stderr.write(`[promote] no existe la semilla verificada: ${SEED_PATH}\n`);
    return 1;
  }
  const { gate } = computeGate();
  const isWrite = args.has('--write-staging') || args.has('--staging-generate');

  // Guardas de no-escritura: check y reporte JAMÁS escriben.
  if (args.has('--check') && isWrite) {
    process.stderr.write('[promote] --check y --write-staging son mutuamente excluyentes.\n');
    return 1;
  }

  let wrote = false;
  if (isWrite && existsSync(LIST_PATH)) {
    const { seed } = computeGate();
    const bundle = computeBundle(seed, gate);
    writeStaging(bundle);
    wrote = true;
    process.stderr.write(`[promote] artefactos de staging escritos → ${STAGING_ROOT}\n`);
  }

  if (args.has('--json')) {
    process.stdout.write(`${JSON.stringify({ gate, wrote, min_coverage: MIN_COVERAGE }, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatReport(gate)}\n`);
  }

  if (args.has('--check')) {
    if (!gate.ok) { process.stderr.write('[promote] GATE con bloqueos (--check).\n'); return 2; }
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
