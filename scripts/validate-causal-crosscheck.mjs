// GEOPÓLEM — Validación cruzada matrices ↔ causal_links (Sprint 26)
// ---------------------------------------------------------------------------
// Compara, SIN base de datos ni navegador, las MATRICES CAUSALES del banco de
// casos docente (docs/education/case-bank/matrices/*.matrix.json) con los
// `causal_links` REALES del contrato v1 en el stage indicado (rc | staging |
// canonical) y reporta divergencias con SEVERIDAD:
//
//   • error   — la matriz afirma algo que la fuente NO respalda (nº de enlaces
//               distinto, link_type/título/evidencia/fuentes que no coinciden,
//               o conflicto ausente en la fuente). Rompe --check/CI.
//   • warning — nodo de la matriz sin respaldo en actores/recursos/chokepoints
//               reales, o deriva de datos de demo.
//   • info    — divergencia informativa entre stages del contrato (p. ej. la
//               matriz se generó desde RC y staging difiere).
//
// NO inventa datos: sólo compara lo declarado. Determinista.
//
// Uso:
//   node scripts/validate-causal-crosscheck.mjs            (PASS/FAIL + exit)
//   node scripts/validate-causal-crosscheck.mjs --json      (informe JSON)
//   node scripts/validate-causal-crosscheck.mjs --stage=rc  (fuente a comparar)
//   node scripts/validate-causal-crosscheck.mjs --compare-staging  (drift info)
// ---------------------------------------------------------------------------

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

export const CROSSCHECK_CONTRACT = 'sprint-26-causal-crosscheck-v1';
const MATRICES_DIR = 'docs/education/case-bank/matrices';
export const STAGES = ['canonical', 'staging', 'rc'];

const abs = (rel) => resolve(REPO_ROOT, rel);
const readJson = (rel) => JSON.parse(readFileSync(abs(rel), 'utf8'));

// --- Carga de `causal_links` de la fuente para un conflicto y stage ---------
// Devuelve { found, causal_links, entities:{actors,resources,chokepoints}, demo, source_file }.
export function loadSourceLinks(conflictId, stage, { repoRoot = REPO_ROOT } = {}) {
  const absR = (rel) => resolve(repoRoot, rel);
  const readJ = (rel) => JSON.parse(readFileSync(absR(rel), 'utf8'));
  let conflict = null;
  let source_file = null;

  if (stage === 'rc') {
    source_file = 'api/v1/conflicts.verified.enriched.json';
    if (existsSync(absR(source_file))) conflict = (readJ(source_file).data || {})[conflictId] || null;
  } else if (stage === 'staging') {
    const per = `api/v1/staging/conflicts/${conflictId}.json`;
    if (existsSync(absR(per))) { source_file = per; conflict = readJ(per).data || null; }
    else {
      source_file = 'api/v1/staging/conflicts.enriched.json';
      if (existsSync(absR(source_file))) conflict = (readJ(source_file).data || {})[conflictId] || null;
    }
  } else { // canonical
    const per = `api/v1/conflicts/${conflictId}.json`;
    if (existsSync(absR(per))) { source_file = per; conflict = (readJ(per).data || readJ(per)) || null; }
  }

  if (!conflict) return { found: false, causal_links: [], entities: null, demo: false, source_file };

  const slugSet = (arr) => new Set((arr || []).map((x) => x.slug).filter(Boolean));
  const entities = {
    actors: new Set([
      ...slugSet(conflict.actors && conflict.actors.state),
      ...slugSet(conflict.actors && conflict.actors.non_state),
    ]),
    resources: slugSet(conflict.resources),
    chokepoints: slugSet(conflict.chokepoints),
  };
  const demo = (conflict.sources || []).some((s) => s && s.demo === true);
  return { found: true, causal_links: conflict.causal_links || [], entities, demo, source_file };
}

function normLink(l) {
  return {
    link_type: l.link_type || null,
    title: l.title || null,
    evidence: (l.evidence != null ? l.evidence : l.explanation) || null,
    source_slugs: [...(l.source_slugs || [])].sort(),
  };
}

const sameSlugs = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// --- Comparación de una matriz contra la fuente (PURA) ----------------------
export function crosscheckMatrix(matrix, source) {
  const divergences = [];
  const add = (severity, code, detail) => divergences.push({ severity, code, detail });

  if (matrix.contract !== 'sprint-25-causal-matrix-v1') {
    add('error', 'contract_mismatch', `contrato de matriz inesperado: ${matrix.contract}`);
  }
  if (!source.found) {
    add('error', 'conflict_missing_in_source', `el conflicto "${matrix.conflict_id}" no existe en la fuente (${source.source_file})`);
    return divergences;
  }

  const mLinks = (matrix.links || []).map(normLink);
  const sLinks = (source.causal_links || []).map(normLink);

  if (mLinks.length !== sLinks.length) {
    add('error', 'link_count_mismatch', `la matriz declara ${mLinks.length} enlaces y la fuente ${sLinks.length}`);
  }

  // Empareja enlaces por título; compara los campos.
  const sByTitle = new Map(sLinks.map((l) => [l.title, l]));
  for (const ml of mLinks) {
    const sl = sByTitle.get(ml.title);
    if (!sl) {
      add('error', 'link_not_in_source', `enlace "${ml.title}" de la matriz no existe en la fuente`);
      continue;
    }
    if (ml.link_type !== sl.link_type) {
      add('error', 'link_type_mismatch', `enlace "${ml.title}": link_type matriz="${ml.link_type}" ≠ fuente="${sl.link_type}"`);
    }
    if (ml.evidence !== sl.evidence) {
      add('error', 'evidence_mismatch', `enlace "${ml.title}": la evidencia de la matriz no coincide con la explanation de la fuente`);
    }
    if (!sameSlugs(ml.source_slugs, sl.source_slugs)) {
      add('error', 'sources_mismatch', `enlace "${ml.title}": source_slugs matriz=[${ml.source_slugs}] ≠ fuente=[${sl.source_slugs}]`);
    }
  }
  // Enlaces en la fuente que la matriz no representa.
  const mTitles = new Set(mLinks.map((l) => l.title));
  for (const sl of sLinks) {
    if (!mTitles.has(sl.title)) add('error', 'link_missing_in_matrix', `enlace "${sl.title}" de la fuente no está en la matriz`);
  }

  // Nodos sin respaldo en entidades reales de la fuente.
  const known = new Set([...source.entities.actors, ...source.entities.resources, ...source.entities.chokepoints]);
  for (const n of matrix.nodes || []) {
    if (!known.has(n.id)) add('warning', 'node_without_source', `nodo "${n.id}" (${n.kind}) no aparece en actores/recursos/chokepoints de la fuente`);
  }
  if (source.demo) add('warning', 'source_is_demo', `la fuente de "${matrix.conflict_id}" contiene datos marcados como demo`);

  return divergences;
}

// --- Barrido de todas las matrices ------------------------------------------
export function crosscheckAll({ repoRoot = REPO_ROOT, stage = 'rc', compareStaging = false } = {}) {
  const dir = resolve(repoRoot, MATRICES_DIR);
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.matrix.json')).sort() : [];
  const cases = [];
  const bySeverity = { error: 0, warning: 0, info: 0 };
  let linksChecked = 0;

  for (const f of files) {
    const rel = `${MATRICES_DIR}/${f}`;
    const matrix = JSON.parse(readFileSync(resolve(repoRoot, rel), 'utf8'));
    const source = loadSourceLinks(matrix.conflict_id, stage, { repoRoot });
    const divergences = crosscheckMatrix(matrix, source);
    linksChecked += (matrix.links || []).length;

    if (compareStaging && stage !== 'staging') {
      const staging = loadSourceLinks(matrix.conflict_id, 'staging', { repoRoot });
      if (staging.found) {
        const a = (source.causal_links || []).map(normLink);
        const b = (staging.causal_links || []).map(normLink);
        if (a.length !== b.length || JSON.stringify(a) !== JSON.stringify(b)) {
          divergences.push({ severity: 'info', code: 'stage_drift', detail: `los causal_links de ${stage} y staging difieren para "${matrix.conflict_id}"` });
        }
      }
    }

    for (const d of divergences) bySeverity[d.severity] = (bySeverity[d.severity] || 0) + 1;
    cases.push({ conflict_id: matrix.conflict_id, matrix_file: rel, source_file: source.source_file, divergences });
  }

  return {
    contract: CROSSCHECK_CONTRACT,
    generated_at: new Date().toISOString(),
    production: { is_production: false, activates_production_gate: false, contains_secrets: false },
    source_stage: stage,
    totals: {
      matrices: files.length,
      links_checked: linksChecked,
      divergences: bySeverity.error + bySeverity.warning + bySeverity.info,
      by_severity: bySeverity,
    },
    cases,
  };
}

// --- CLI --------------------------------------------------------------------
function parseArgs(argv) {
  const out = { flags: new Set(), opts: {} };
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v === undefined) out.flags.add(k);
      else out.opts[k] = v;
    }
  }
  return out;
}

function main() {
  const { flags, opts } = parseArgs(process.argv.slice(2));
  const stage = opts.stage || 'rc';
  if (!STAGES.includes(stage)) {
    process.stderr.write(`[crosscheck] stage inválido: ${stage} (usa: ${STAGES.join(', ')})\n`);
    return 2;
  }
  const report = crosscheckAll({ stage, compareStaging: flags.has('compare-staging') });

  if (flags.has('json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    for (const c of report.cases) {
      if (!c.divergences.length) {
        console.log(`PASS  ${c.conflict_id} (${c.source_file})`);
      } else {
        for (const d of c.divergences) {
          console.log(`${d.severity.toUpperCase().padEnd(7)} ${c.conflict_id}  [${d.code}] ${d.detail}`);
        }
      }
    }
    const t = report.totals;
    console.log(`\nMatrices: ${t.matrices} · enlaces: ${t.links_checked} · errores: ${t.by_severity.error} · avisos: ${t.by_severity.warning} · info: ${t.by_severity.info}`);
    console.log(t.by_severity.error === 0 ? 'OK: sin divergencias de severidad error.' : 'FALLOS: hay divergencias de severidad error.');
  }
  return report.totals.by_severity.error === 0 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
