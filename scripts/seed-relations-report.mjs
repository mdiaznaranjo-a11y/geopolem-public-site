// GEOPÓLEM — Reporte de semilla relacional y salud post-enriquecimiento (Sprint 13)
// ---------------------------------------------------------------------------
// Lee la semilla editorial (`data/conflict-relations.seed.json`) y el puente
// estático v1 en disco, y produce:
//   • Un reporte de COBERTURA por conflicto (sources/actores/recursos/
//     chokepoints/causal_links + pendientes) combinando semilla y detalle real.
//   • La validación estricta de la semilla y de la regla "published exige fuente".
//   • Opcionalmente, el artefacto de PREVIEW enriquecido
//     `api/v1/conflicts.seed.enriched.json` (merge NO destructivo de la semilla
//     sobre los detalles v1; por defecto sólo fuentes verificadas, o TODAS con
//     --include-demo para vista previa claramente marcada como demo).
//
// NUNCA reescribe conflicts.json, map.json, map.enriched.json ni los detalles
// canónicos api/v1/conflicts/{id}.json: la semilla vive en su propio artefacto.
//
// Uso:
//   node scripts/seed-relations-report.mjs                 (texto)
//   node scripts/seed-relations-report.mjs --json          (JSON)
//   node scripts/seed-relations-report.mjs --write-enriched [--include-demo]
//   node scripts/seed-relations-report.mjs --fail-on-unsourced-published
//   node scripts/seed-relations-report.mjs --check         (valida semilla; exit!=0 si inválida)
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateSeed, validatePublishedHaveSources, computeSeedCoverage, mergeRelations,
} from '../conflict-relations.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SEED_PATH = resolve(REPO_ROOT, 'data/conflict-relations.seed.json');
const LIST_PATH = resolve(REPO_ROOT, 'api/v1/conflicts.json');
const DETAILS_DIR = resolve(REPO_ROOT, 'api/v1/conflicts');
const ENRICHED_PATH = resolve(REPO_ROOT, 'api/v1/conflicts.seed.enriched.json');

const args = new Set(process.argv.slice(2));

function readJson(p) { return JSON.parse(readFileSync(p, 'utf8')); }

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
    try { details[id] = readJson(p).data || readJson(p); } catch { /* roto → ausente */ }
  }
  return details;
}

// Construye el documento de preview enriquecido a partir de la lista + detalles.
function buildEnrichedPreview(items, details, seed, { includeDemo }) {
  const out = {};
  for (const it of items) {
    const id = it.id || it.slug;
    if (!id) continue;
    const detail = details[id] || { data: { id, slug: id, name: it.name } };
    const wrapped = detail.data ? detail : { data: detail };
    out[id] = mergeRelations(wrapped, seed.conflicts?.[id], { includeDemo }).data;
  }
  return {
    contract: 'sprint-13-seed-enriched-v1',
    generated_at: new Date().toISOString(),
    include_demo: Boolean(includeDemo),
    notice: includeDemo
      ? 'PREVIEW con fuentes DEMO incluidas. NO publicar: contiene fixtures de ejemplo, no citaciones verificadas.'
      : 'PREVIEW con sólo fuentes verificadas. Merge no destructivo de la semilla sobre el detalle v1.',
    data: out,
    meta: { api_version: 'v1', source: 'seed-merge (Sprint 13)', seed_include_demo: Boolean(includeDemo) },
  };
}

function formatReport(seedCheck, published, coverage, origin) {
  const L = [];
  L.push('GEOPÓLEM — Reporte de semilla relacional y salud (Sprint 13)');
  L.push('='.repeat(62));
  L.push(`Generado: ${coverage.generated_at}`);
  L.push(`Origen:   ${origin}`);
  L.push(`Contrato: ${coverage.contract}`);
  L.push('');
  L.push(`Semilla válida:            ${seedCheck.ok ? 'sí' : 'NO'}`);
  if (!seedCheck.ok) for (const e of seedCheck.errors) L.push(`  ! ${e}`);
  L.push(`Advertencias (demo/pend.): ${seedCheck.warnings.length}`);
  L.push('');
  const t = coverage.totals;
  L.push(`Conflictos en semilla:            ${t.conflicts}`);
  L.push(`Con fuente publicable (verified): ${t.with_publishable_source}`);
  L.push(`Con alguna fuente (incl. demo):   ${t.with_any_source}`);
  L.push(`Publicados:                       ${t.published}`);
  L.push(`Publicados SIN fuente:            ${t.published_without_source}`);
  L.push(`Causal_links pendientes:          ${t.pending_causal_links}`);
  L.push(`Fuentes demo (no publicables):    ${t.demo_sources}`);
  L.push('');
  L.push(`Regla 'published exige fuente':    ${published.ok ? 'CUMPLE' : 'VIOLADA'}`);
  if (!published.ok) L.push(`  Conflictos en violación: ${published.violations.join(', ')}`);
  L.push('');
  L.push('Cobertura por conflicto (act=actores, rec=recursos, cho=chokepoints, cau=causal, src/pub):');
  const rows = Object.entries(coverage.by_conflict);
  for (const [id, r] of rows) {
    L.push(`  ${id.padEnd(16)} [${r.editorial_status.padEnd(9)}] `
      + `act=${r.actors} rec=${r.resources} cho=${r.chokepoints} cau=${r.causal_links} `
      + `src=${r.sources_total}(pub=${r.sources_publishable},demo=${r.sources_demo}) pend=${r.pending_causal_links}`);
  }
  L.push('');
  L.push('PENDIENTES EDITORIALES: sustituir fixtures demo por fuentes verificadas');
  L.push('(title+url+publisher, verification=verified) antes de marcar published.');
  return L.join('\n');
}

function main() {
  if (!existsSync(SEED_PATH)) {
    process.stderr.write(`[seed-report] no existe la semilla: ${SEED_PATH}\n`);
    return 1;
  }
  const seed = readJson(SEED_PATH);
  const seedCheck = validateSeed(seed);
  const published = validatePublishedHaveSources(seed);
  const coverage = computeSeedCoverage(seed);

  // Combina la cobertura de la semilla con el estado real del detalle en disco.
  let origin = `seed (${SEED_PATH})`;
  if (existsSync(LIST_PATH)) {
    const items = readJson(LIST_PATH).data || [];
    const details = loadDetails(items);
    origin += ` + static (${items.length} conflictos, ${Object.keys(details).length} detalles)`;

    if (args.has('--write-enriched')) {
      const includeDemo = args.has('--include-demo');
      const preview = buildEnrichedPreview(items, details, seed, { includeDemo });
      writeJsonAtomic(ENRICHED_PATH, preview);
      process.stderr.write(`[seed-report] preview enriquecido escrito → ${ENRICHED_PATH} (include_demo=${includeDemo})\n`);
    }
  }

  if (args.has('--json')) {
    process.stdout.write(`${JSON.stringify({ seed_valid: seedCheck.ok, seed_errors: seedCheck.errors, seed_warnings: seedCheck.warnings, published, coverage, origin }, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatReport(seedCheck, published, coverage, origin)}\n`);
  }

  // Códigos de salida para CI.
  if (args.has('--check') && !seedCheck.ok) {
    process.stderr.write('[seed-report] semilla inválida (--check).\n');
    return 2;
  }
  if (args.has('--fail-on-unsourced-published') && !published.ok) {
    process.stderr.write('[seed-report] hay conflictos published sin fuente publicable.\n');
    return 3;
  }
  return 0;
}

process.exit(main());
