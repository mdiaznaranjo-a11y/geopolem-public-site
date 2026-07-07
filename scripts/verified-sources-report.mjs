// GEOPÓLEM — Reporte de fuentes verificadas y promoción controlada (Sprint 14)
// ---------------------------------------------------------------------------
// Lee la semilla VERIFICADA (`data/conflict-relations.verified.seed.json`), el
// inventario (`data/conflicts.inventory.json`) y el puente estático v1, y produce:
//   • Validación estricta Sprint 14 (estructura + regla causal_links-exigen-fuente).
//   • Reporte de COBERTURA verificada vs. pendiente por conflicto.
//   • Opcionalmente, el artefacto de PREVIEW verificado
//     `api/v1/conflicts.verified.enriched.json` (merge NO destructivo, sólo
//     fuentes verificadas), separado de los canónicos.
//
// NUNCA reescribe conflicts.json, map*.json ni los detalles canónicos: la
// promoción a canónico exige sign-off editorial humano.
//
// Uso:
//   node scripts/verified-sources-report.mjs                     (texto)
//   node scripts/verified-sources-report.mjs --json              (JSON)
//   node scripts/verified-sources-report.mjs --write-enriched    (escribe preview)
//   node scripts/verified-sources-report.mjs --check             (exit!=0 si inválida)
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateVerifiedSeed, validateCausalLinksHaveSources, computeVerifiedCoverage,
  buildVerifiedDetail, VERIFIED_ENRICHED_CONTRACT,
} from '../conflict-sources.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SEED_PATH = resolve(REPO_ROOT, 'data/conflict-relations.verified.seed.json');
const INVENTORY_PATH = resolve(REPO_ROOT, 'data/conflicts.inventory.json');
const LIST_PATH = resolve(REPO_ROOT, 'api/v1/conflicts.json');
const DETAILS_DIR = resolve(REPO_ROOT, 'api/v1/conflicts');
const ENRICHED_PATH = resolve(REPO_ROOT, 'api/v1/conflicts.verified.enriched.json');

const args = new Set(process.argv.slice(2));
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

function writeJsonAtomic(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
  renameSync(tmp, path);
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

function buildVerifiedPreview(items, details, seed) {
  const out = {};
  for (const it of items) {
    const id = it.id || it.slug;
    if (!id) continue;
    const detail = details[id] || { data: { id, slug: id, name: it.name } };
    out[id] = buildVerifiedDetail(detail, seed.conflicts?.[id]);
  }
  return {
    contract: VERIFIED_ENRICHED_CONTRACT,
    generated_at: new Date().toISOString(),
    include_demo: false,
    notice: 'PREVIEW VERIFICADO (Sprint 14). Merge no destructivo de la semilla verificada sobre el detalle v1: SÓLO fuentes verificadas (institucionales/periodísticas). NO es un artefacto canónico; la promoción a producción exige sign-off editorial humano.',
    data: out,
    meta: { api_version: 'v1', source: 'verified-seed-merge (Sprint 14)', seed_include_demo: false },
  };
}

function formatReport(seedCheck, causal, coverage, origin) {
  const L = [];
  L.push('GEOPÓLEM — Reporte de fuentes verificadas y promoción (Sprint 14)');
  L.push('='.repeat(64));
  L.push(`Generado: ${coverage.generated_at}`);
  L.push(`Origen:   ${origin}`);
  L.push(`Contrato: ${coverage.contract}`);
  L.push('');
  L.push(`Semilla verificada válida:        ${seedCheck.ok ? 'sí' : 'NO'}`);
  if (!seedCheck.ok) for (const e of seedCheck.errors) L.push(`  ! ${e}`);
  L.push(`Advertencias:                     ${seedCheck.warnings.length}`);
  L.push(`Regla causal_links-exigen-fuente: ${causal.ok ? 'CUMPLE' : 'VIOLADA'}`);
  if (!causal.ok) for (const v of causal.violations) L.push(`  ! ${v.conflict}[${v.index}] "${v.title}": ${v.reason}`);
  L.push('');
  const t = coverage.totals;
  L.push(`Conflictos:                       ${t.conflicts}`);
  L.push(`Con fuente verificada:            ${t.with_verified_source} (${coverage.coverage_pct}%)`);
  L.push(`Totalmente pendientes:            ${t.fully_pending}`);
  L.push(`Causal_links (total):             ${t.causal_links_total}`);
  L.push(`Causal_links verificados:         ${t.causal_links_verified}`);
  L.push(`Causal_links pendientes:          ${t.causal_links_pending}`);
  L.push(`Fuentes verificadas (total):      ${t.verified_sources}`);
  if (coverage.missing_from_seed.length) {
    L.push('');
    L.push(`AVISO: conflictos del inventario ausentes en la semilla: ${coverage.missing_from_seed.join(', ')}`);
  }
  L.push('');
  L.push('Cobertura por conflicto (act/rec/cho/cau, cauV=causal verificados, srcV=fuentes verificadas):');
  for (const [id, r] of Object.entries(coverage.by_conflict)) {
    L.push(`  ${id.padEnd(16)} [${r.editorial_status.padEnd(8)}] `
      + `act=${r.actors} rec=${r.resources} cho=${r.chokepoints} cau=${r.causal_links} `
      + `cauV=${r.causal_links_verified} srcV=${r.verified_sources}`);
  }
  L.push('');
  L.push('PENDIENTES: ver data/source-research.todo.json (fuentes por investigar).');
  return L.join('\n');
}

function main() {
  if (!existsSync(SEED_PATH)) {
    process.stderr.write(`[verified-report] no existe la semilla verificada: ${SEED_PATH}\n`);
    return 1;
  }
  const seed = readJson(SEED_PATH);
  const inventoryIds = existsSync(INVENTORY_PATH)
    ? (readJson(INVENTORY_PATH).conflicts || []).map((c) => c.id)
    : null;
  const seedCheck = validateVerifiedSeed(seed);
  const causal = validateCausalLinksHaveSources(seed);
  const coverage = computeVerifiedCoverage(seed, inventoryIds);

  let origin = `verified-seed (${SEED_PATH})`;
  if (existsSync(LIST_PATH)) {
    const items = readJson(LIST_PATH).data || [];
    const details = loadDetails(items);
    origin += ` + static (${items.length} conflictos, ${Object.keys(details).length} detalles)`;
    if (args.has('--write-enriched')) {
      const preview = buildVerifiedPreview(items, details, seed);
      writeJsonAtomic(ENRICHED_PATH, preview);
      process.stderr.write(`[verified-report] preview verificado escrito → ${ENRICHED_PATH}\n`);
    }
  }

  if (args.has('--json')) {
    process.stdout.write(`${JSON.stringify({ seed_valid: seedCheck.ok, seed_errors: seedCheck.errors, seed_warnings: seedCheck.warnings, causal, coverage, origin }, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatReport(seedCheck, causal, coverage, origin)}\n`);
  }

  if (args.has('--check')) {
    if (!seedCheck.ok) { process.stderr.write('[verified-report] semilla verificada inválida (--check).\n'); return 2; }
    if (!causal.ok) { process.stderr.write('[verified-report] causal_links reales sin fuente (--check).\n'); return 3; }
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
