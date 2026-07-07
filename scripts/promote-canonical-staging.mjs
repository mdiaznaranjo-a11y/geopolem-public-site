// GEOPÓLEM — Promoción canónica controlada a STAGING (Sprint 15, CLI)
// ---------------------------------------------------------------------------
// Lee la semilla VERIFICADA, el inventario, el puente estático v1, los detalles
// canónicos y la cola de investigación (source-research.todo.json), ejecuta el
// GATE editorial de promoción y, si se solicita, ESCRIBE los artefactos de
// STAGING bajo api/v1/staging/** (detalles por conflicto + mapa enriquecido +
// reporte de cobertura). Con rollback (respaldo de lo sobrescrito).
//
// NUNCA escribe fuera de api/v1/staging/: los canónicos de producción
// (api/v1/conflicts.json, api/v1/conflicts/{id}.json, map*.json) y data.js/FOCOS
// quedan intactos. La promoción a producción exige sign-off editorial humano.
//
// Uso:
//   node scripts/promote-canonical-staging.mjs                 (reporte texto)
//   node scripts/promote-canonical-staging.mjs --json          (reporte JSON)
//   node scripts/promote-canonical-staging.mjs --write-staging (escribe staging)
//   node scripts/promote-canonical-staging.mjs --check         (exit!=0 si BLOQUEADO)
//   node scripts/promote-canonical-staging.mjs --rollback      (restaura respaldo)
//   node scripts/promote-canonical-staging.mjs --min-coverage=100
// ---------------------------------------------------------------------------

import {
  readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, copyFileSync, readdirSync, rmSync,
} from 'node:fs';
import { dirname, resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validatePromotionReadiness, buildPromotionBundle, collectJustifiedPendingIds,
  DEFAULT_MIN_COVERAGE_PCT,
} from '../conflict-promotion.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SEED_PATH = resolve(REPO_ROOT, 'data/conflict-relations.verified.seed.json');
const INVENTORY_PATH = resolve(REPO_ROOT, 'data/conflicts.inventory.json');
const TODO_PATH = resolve(REPO_ROOT, 'data/source-research.todo.json');
const LIST_PATH = resolve(REPO_ROOT, 'api/v1/conflicts.json');
const DETAILS_DIR = resolve(REPO_ROOT, 'api/v1/conflicts');
const STAGING_ROOT = resolve(REPO_ROOT, 'api/v1/staging');
const STAGING_DETAILS_DIR = resolve(STAGING_ROOT, 'conflicts');
const STAGING_MAP_PATH = resolve(STAGING_ROOT, 'conflicts/active/map.enriched.json');
const STAGING_BUNDLE_PATH = resolve(STAGING_ROOT, 'conflicts.enriched.json');
const STAGING_COVERAGE_PATH = resolve(STAGING_ROOT, 'coverage-report.json');
const ROLLBACK_DIR = resolve(STAGING_ROOT, '.rollback');

const argv = process.argv.slice(2);
const args = new Set(argv);
const minCovArg = argv.find((a) => a.startsWith('--min-coverage='));
const MIN_COVERAGE = minCovArg ? Number(minCovArg.split('=')[1]) : DEFAULT_MIN_COVERAGE_PCT;

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
  const rel = relative(STAGING_ROOT, path);
  if (rel.startsWith('..')) return; // sólo respaldamos dentro de staging
  const dest = join(ROLLBACK_DIR, rel);
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
    const rel = relative(ROLLBACK_DIR, f);
    const dest = join(STAGING_ROOT, rel);
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
    backupIfExists(resolve(STAGING_DETAILS_DIR, `${id}.json`));
  }
  // Escribe detalles por conflicto (contrato v1) + bundle + mapa + cobertura.
  for (const [id, data] of Object.entries(bundle.detailsDoc.data)) {
    writeJsonAtomic(resolve(STAGING_DETAILS_DIR, `${id}.json`), {
      data,
      meta: { api_version: 'v1', staging: true, source: 'verified-seed-merge (Sprint 15 staging)' },
    });
  }
  writeJsonAtomic(STAGING_BUNDLE_PATH, bundle.detailsDoc);
  writeJsonAtomic(STAGING_MAP_PATH, bundle.mapDoc);
  writeJsonAtomic(STAGING_COVERAGE_PATH, bundle.coverageReport);
}

function formatReport(gate) {
  const L = [];
  L.push('GEOPÓLEM — Promoción canónica a STAGING (Sprint 15)');
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

function main() {
  if (args.has('--rollback')) return doRollback();
  if (!existsSync(SEED_PATH)) {
    process.stderr.write(`[promote] no existe la semilla verificada: ${SEED_PATH}\n`);
    return 1;
  }
  const seed = readJson(SEED_PATH);
  const inventoryIds = existsSync(INVENTORY_PATH)
    ? (readJson(INVENTORY_PATH).conflicts || []).map((c) => c.id)
    : null;
  const todo = existsSync(TODO_PATH) ? readJson(TODO_PATH) : {};
  const justifiedPendingIds = collectJustifiedPendingIds(todo);

  const gate = validatePromotionReadiness(seed, {
    minCoveragePct: MIN_COVERAGE,
    justifiedPendingIds,
    inventoryIds,
  });

  let wrote = false;
  if (args.has('--write-staging') && existsSync(LIST_PATH)) {
    const items = readJson(LIST_PATH).data || [];
    const details = loadDetails(items);
    const bundle = buildPromotionBundle({ items, details, seed, gate });
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
