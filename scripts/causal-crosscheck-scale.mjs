// GEOPÓLEM — Cross-check causal AMPLIADO a todos los conflictos (Sprint 28)
// ---------------------------------------------------------------------------
// Extiende la validación causal del Sprint 26 (matrices ↔ causal_links) para
// cubrir TODOS los conflictos disponibles en el contrato v1 del stage indicado
// (canonical | staging | rc), no sólo los que ya tienen matriz en el banco
// educativo. Enumera desde el lado del CONTRATO y clasifica cada conflicto:
//
//   • checked        — tiene matriz y la fuente respalda todos sus enlaces.
//   • divergent      — tiene matriz pero hay divergencias de severidad error.
//   • pending_matrix — la fuente declara causal_links pero NO existe matriz
//                      educativa (brecha accionable: falta construir la matriz).
//   • not_applicable — la fuente no declara causal_links y no hay matriz
//                      (nada que validar; no se inventan relaciones).
//
// Produce un REPORTE + BACKLOG determinista con severidad, conflicto, tipo de
// brecha, acción recomendada y estado. NO inventa relaciones causales: cuando
// falta la matriz reporta el estado, nunca genera enlaces.
//
// Uso:
//   node scripts/causal-crosscheck-scale.mjs                 (resumen)
//   node scripts/causal-crosscheck-scale.mjs --json           (informe JSON)
//   node scripts/causal-crosscheck-scale.mjs --stage=canonical (stage a barrer)
//   node scripts/causal-crosscheck-scale.mjs --write           (escribe artefactos)
//   node scripts/causal-crosscheck-scale.mjs --check           (verifica al día)
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSourceLinks, crosscheckMatrix, STAGES } from './validate-causal-crosscheck.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

export const SCALE_CONTRACT = 'sprint-28-causal-crosscheck-scale-v1';
const MATRICES_DIR = 'docs/education/case-bank/matrices';
const OUT_DIR = 'docs/education/causal-scale';

const abs = (rel) => resolve(REPO_ROOT, rel);

// Enumera los ids de conflicto disponibles en el contrato para un stage dado,
// en orden determinista. Lee sólo lo versionado; no toca DB ni red.
export function listConflictIds(stage, { repoRoot = REPO_ROOT } = {}) {
  const absR = (rel) => resolve(repoRoot, rel);
  const ids = new Set();
  if (stage === 'canonical') {
    const dir = absR('api/v1/conflicts');
    if (existsSync(dir)) {
      for (const f of readdirSync(dir)) if (f.endsWith('.json')) ids.add(f.replace(/\.json$/, ''));
    }
  } else if (stage === 'staging') {
    const dir = absR('api/v1/staging/conflicts');
    if (existsSync(dir)) {
      for (const f of readdirSync(dir)) if (f.endsWith('.json')) ids.add(f.replace(/\.json$/, ''));
    }
    const enr = absR('api/v1/staging/conflicts.enriched.json');
    if (existsSync(enr)) for (const k of Object.keys(JSON.parse(readFileSync(enr, 'utf8')).data || {})) ids.add(k);
  } else { // rc
    const f = absR('api/v1/conflicts.verified.enriched.json');
    if (existsSync(f)) for (const k of Object.keys(JSON.parse(readFileSync(f, 'utf8')).data || {})) ids.add(k);
  }
  return [...ids].filter((id) => id !== 'active').sort();
}

const matrixRelFor = (id) => `${MATRICES_DIR}/${id}.matrix.json`;

// Clasifica un único conflicto (PURO respecto a la fuente ya cargada).
export function classifyConflict(conflictId, stage, { repoRoot = REPO_ROOT } = {}) {
  const matrixRel = matrixRelFor(conflictId);
  const hasMatrix = existsSync(resolve(repoRoot, matrixRel));
  const source = loadSourceLinks(conflictId, stage, { repoRoot });
  const sourceLinks = (source.causal_links || []).length;

  if (hasMatrix) {
    const matrix = JSON.parse(readFileSync(resolve(repoRoot, matrixRel), 'utf8'));
    const divergences = crosscheckMatrix(matrix, source);
    const errors = divergences.filter((d) => d.severity === 'error').length;
    return {
      conflict_id: conflictId,
      status: errors ? 'divergent' : 'checked',
      severity: errors ? 'error' : 'ok',
      has_matrix: true,
      source_links: sourceLinks,
      matrix_file: matrixRel,
      source_file: source.source_file,
      gap_type: errors ? 'matrix_source_divergence' : 'none',
      recommended_action: errors
        ? 'Revisar la matriz frente a la fuente y ejecutar education:crosscheck para el detalle.'
        : 'Sin acción: matriz coherente con la fuente.',
      divergences,
    };
  }

  if (sourceLinks > 0) {
    return {
      conflict_id: conflictId,
      status: 'pending_matrix',
      severity: 'warning',
      has_matrix: false,
      source_links: sourceLinks,
      matrix_file: null,
      source_file: source.source_file,
      gap_type: 'missing_matrix',
      recommended_action: `Construir la matriz educativa (${matrixRel}) a partir de los ${sourceLinks} causal_links de la fuente.`,
      divergences: [],
    };
  }

  return {
    conflict_id: conflictId,
    status: 'not_applicable',
    severity: 'info',
    has_matrix: false,
    source_links: 0,
    matrix_file: null,
    source_file: source.source_file,
    gap_type: 'no_causal_data',
    recommended_action: 'Sin acción: la fuente no declara causal_links; no se inventan relaciones.',
    divergences: [],
  };
}

// Barrido de todos los conflictos del stage.
export function crosscheckScale({ repoRoot = REPO_ROOT, stage = 'rc' } = {}) {
  const ids = listConflictIds(stage, { repoRoot });
  const cases = ids.map((id) => classifyConflict(id, stage, { repoRoot }));
  const byStatus = { checked: 0, divergent: 0, pending_matrix: 0, not_applicable: 0 };
  for (const c of cases) byStatus[c.status] = (byStatus[c.status] || 0) + 1;
  const validable = byStatus.checked + byStatus.divergent;
  const coverage = validable ? Math.round((byStatus.checked / validable) * 10000) / 100 : 100;

  return {
    contract: SCALE_CONTRACT,
    notice:
      'Cross-check causal ampliado a todos los conflictos del contrato v1 (Sprint 28). No inventa relaciones: reporta estado cuando falta la matriz. No activa producción ni contiene secretos.',
    production: { is_production: false, activates_production_gate: false, contains_secrets: false },
    source_stage: stage,
    totals: {
      conflicts: ids.length,
      by_status: byStatus,
      coverage_percentage: coverage,
    },
    cases,
  };
}

// Backlog accionable = casos que NO están 'checked' ni 'not_applicable'
// más los 'pending_matrix'. Determinista, ordenado por severidad y id.
export function buildScaleBacklog(report) {
  const rank = { error: 0, warning: 1, info: 2, ok: 3 };
  const items = report.cases
    .filter((c) => c.status === 'divergent' || c.status === 'pending_matrix')
    .map((c) => ({
      conflict_id: c.conflict_id,
      status: c.status,
      severity: c.severity,
      gap_type: c.gap_type,
      recommended_action: c.recommended_action,
    }))
    .sort((a, b) => (rank[a.severity] - rank[b.severity]) || a.conflict_id.localeCompare(b.conflict_id));
  return {
    contract: SCALE_CONTRACT,
    production: report.production,
    source_stage: report.source_stage,
    total_items: items.length,
    items,
  };
}

export function renderScaleMarkdown(report, backlog) {
  const L = [];
  L.push('# Cross-check causal ampliado (Sprint 28)');
  L.push('');
  L.push('> Cubre **todos los conflictos** del contrato v1. No inventa relaciones: cuando falta la matriz reporta el estado.');
  L.push('');
  L.push(`- Stage: **${report.source_stage}**`);
  L.push(`- Conflictos: **${report.totals.conflicts}**`);
  const s = report.totals.by_status;
  L.push(`- Con matriz coherente (checked): **${s.checked}** · divergentes: **${s.divergent}**`);
  L.push(`- Pendientes de matriz: **${s.pending_matrix}** · no aplicables: **${s.not_applicable}**`);
  L.push(`- Cobertura sobre validables: **${report.totals.coverage_percentage}%**`);
  L.push('');
  L.push('## Estado por conflicto');
  L.push('');
  L.push('| conflicto | estado | severidad | enlaces fuente | brecha |');
  L.push('|---|---|---|---|---|');
  for (const c of report.cases) L.push(`| \`${c.conflict_id}\` | ${c.status} | ${c.severity} | ${c.source_links} | ${c.gap_type} |`);
  L.push('');
  L.push('## Backlog accionable');
  L.push('');
  if (backlog.items.length) {
    L.push('| conflicto | estado | severidad | brecha | acción recomendada |');
    L.push('|---|---|---|---|---|');
    for (const it of backlog.items) L.push(`| \`${it.conflict_id}\` | ${it.status} | ${it.severity} | ${it.gap_type} | ${it.recommended_action} |`);
  } else {
    L.push('_(sin acciones pendientes)_');
  }
  L.push('');
  return `${L.join('\n')}\n`;
}

// --- CLI --------------------------------------------------------------------
function writeAtomic(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, path);
}

function parseArgs(argv) {
  const flags = new Set();
  const opts = {};
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v === undefined) flags.add(k); else opts[k] = v;
    }
  }
  return { flags, opts };
}

function main() {
  const { flags, opts } = parseArgs(process.argv.slice(2));
  const stage = opts.stage || 'rc';
  if (!STAGES.includes(stage)) {
    process.stderr.write(`[causal-scale] stage inválido: ${stage} (usa: ${STAGES.join(', ')})\n`);
    return 2;
  }
  const report = crosscheckScale({ stage });
  const backlog = buildScaleBacklog(report);
  const files = {
    [`${OUT_DIR}/crosscheck-scale.json`]: `${JSON.stringify(report, null, 2)}\n`,
    [`${OUT_DIR}/crosscheck-scale.backlog.json`]: `${JSON.stringify(backlog, null, 2)}\n`,
    [`${OUT_DIR}/crosscheck-scale.md`]: renderScaleMarkdown(report, backlog),
  };

  if (flags.has('json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.totals.by_status.divergent === 0 ? 0 : 1;
  }
  if (flags.has('check')) {
    const diffs = [];
    for (const [rel, content] of Object.entries(files)) {
      const p = abs(rel);
      if (!existsSync(p) || readFileSync(p, 'utf8') !== content) diffs.push(rel);
    }
    if (diffs.length) {
      process.stderr.write(`[causal-scale] desactualizado: ${diffs.join(', ')}\n[causal-scale] ejecuta: npm run education:causal-scale:write\n`);
      return 1;
    }
    if (report.totals.by_status.divergent > 0) {
      process.stderr.write(`[causal-scale] hay ${report.totals.by_status.divergent} conflicto(s) divergente(s).\n`);
      return 1;
    }
    process.stdout.write('[causal-scale] OK: cross-check ampliado al día y sin divergencias.\n');
    return 0;
  }
  if (flags.has('write')) {
    for (const [rel, content] of Object.entries(files)) writeAtomic(abs(rel), content);
    process.stderr.write(`[causal-scale] escritos artefactos en ${OUT_DIR} (${Object.keys(files).length} ficheros).\n`);
    return 0;
  }
  const s = report.totals.by_status;
  process.stdout.write(`Stage ${stage}: ${report.totals.conflicts} conflictos · checked ${s.checked} · divergent ${s.divergent} · pending_matrix ${s.pending_matrix} · n/a ${s.not_applicable}.\n`);
  process.stdout.write(`Usa --json para el informe, --write para escribir en ${OUT_DIR}, --check para verificar.\n`);
  return report.totals.by_status.divergent === 0 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
