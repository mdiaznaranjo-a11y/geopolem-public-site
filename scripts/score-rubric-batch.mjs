// GEOPÓLEM — Puntuación por lotes de rúbricas (Sprint 27)
// ---------------------------------------------------------------------------
// Procesa MÚLTIPLES evaluaciones ANÓNIMAS/SINTÉTICAS reutilizando el motor puro
// del Sprint 26 (`scoreRubric`) y produce una salida AGREGADA:
//   • JSON      — informe máquina-legible (totales, bandas, medias por rúbrica y
//                 por criterio, rechazos).
//   • Markdown  — informe navegable para el instructor.
//   • CSV       — una fila por evaluación puntuada (para importadores/hoja).
//
// Garantías:
//   • RECHAZA/marca cualquier evaluación con claves con aspecto de datos
//     personales (PII) reutilizando `findPIIKeys`; NO copia su contenido a la
//     salida (sólo el índice/id y el motivo).
//   • NO persiste notas reales ni identidades: las entradas son sintéticas.
//   • Determinista (sin timestamps en los ficheros escritos) → admite --check.
//   • No activa producción ni contiene secretos.
//
// Uso:
//   node scripts/score-rubric-batch.mjs --dir=<carpeta>            (resumen)
//   node scripts/score-rubric-batch.mjs --dir=<carpeta> --json      (informe JSON)
//   node scripts/score-rubric-batch.mjs --write                     (escribe fixtures)
//   node scripts/score-rubric-batch.mjs --check                     (verifica al día)
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreRubric, findPIIKeys, normalizeScores } from './score-rubric.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

export const BATCH_CONTRACT = 'sprint-27-batch-scoring-v1';
const RUBRICS_INDEX = 'docs/education/rubrics/rubrics.index.json';
const FIXTURES_DIR = 'docs/education/batch/fixtures';
const OUT_DIR = 'docs/education/batch';

const abs = (rel) => resolve(REPO_ROOT, rel);
const readJson = (rel) => JSON.parse(readFileSync(abs(rel), 'utf8'));

// Carga las rúbricas del índice en un mapa { rubric_id: rubricDoc }.
export function loadRubricsById({ repoRoot = REPO_ROOT } = {}) {
  const idxPath = resolve(repoRoot, RUBRICS_INDEX);
  const idx = existsSync(idxPath) ? JSON.parse(readFileSync(idxPath, 'utf8')) : { rubrics: [] };
  const map = {};
  for (const entry of idx.rubrics || []) {
    const p = resolve(repoRoot, entry.file);
    if (existsSync(p)) map[entry.id] = JSON.parse(readFileSync(p, 'utf8'));
  }
  return map;
}

// Lee todas las evaluaciones *.json de una carpeta, en orden determinista.
export function loadEvaluations(dirRel, { repoRoot = REPO_ROOT } = {}) {
  const dir = resolve(repoRoot, dirRel);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ id: basename(f, '.json'), payload: JSON.parse(readFileSync(resolve(dir, f), 'utf8')) }));
}

const round2 = (n) => Math.round(n * 100) / 100;

// --- Motor de agregación (PURO) ---------------------------------------------
// evaluations: [{ id, payload }]  ·  rubricsById: { rubric_id: rubricDoc }
export function scoreBatch(evaluations, rubricsById) {
  const results = [];
  const rejected = [];
  const bandCounts = {};
  // Acumuladores por rúbrica y por criterio (para medias).
  const byRubricAcc = {};
  const critAcc = {}; // key `${rubric_id}::${criterion_id}` -> { sum, n, title }

  for (const { id, payload } of evaluations) {
    // 1) Rechazo por PII: NO se copia el contenido, sólo el id y el motivo.
    const pii = findPIIKeys(payload);
    if (pii.length) {
      rejected.push({ id, reason: 'pii', detail: `claves con aspecto de datos personales: ${pii.join(', ')}` });
      continue;
    }
    // 2) Resolver rúbrica.
    const rubricId = payload.rubric_id;
    const rubric = rubricId && rubricsById[rubricId];
    if (!rubric) {
      rejected.push({ id, reason: 'rubric_not_found', detail: `rubric_id ausente o desconocido: ${rubricId ?? '—'}` });
      continue;
    }
    // 3) Puntuar (el motor valida criterios/niveles y vuelve a rechazar PII).
    let scored;
    try {
      scored = scoreRubric(rubric, payload);
    } catch (e) {
      rejected.push({ id, reason: 'invalid', detail: e.message });
      continue;
    }

    results.push({
      id,
      rubric_id: rubricId,
      total: scored.total,
      max_total: scored.max_total,
      percentage: scored.percentage,
      overall_level: scored.overall_level,
    });
    bandCounts[scored.overall_level] = (bandCounts[scored.overall_level] || 0) + 1;

    const acc = (byRubricAcc[rubricId] ||= { rubric_id: rubricId, n: 0, sumPct: 0 });
    acc.n += 1;
    acc.sumPct += scored.percentage;

    for (const c of scored.criteria) {
      const key = `${rubricId}::${c.id}`;
      const ca = (critAcc[key] ||= { rubric_id: rubricId, criterion_id: c.id, title: c.title, sum: 0, n: 0 });
      ca.sum += c.points;
      ca.n += 1;
    }
  }

  const by_rubric = Object.values(byRubricAcc)
    .sort((a, b) => a.rubric_id.localeCompare(b.rubric_id))
    .map((a) => ({ rubric_id: a.rubric_id, scored: a.n, mean_percentage: round2(a.sumPct / a.n) }));

  const criteria_averages = Object.values(critAcc)
    .sort((a, b) => (a.rubric_id + a.criterion_id).localeCompare(b.rubric_id + b.criterion_id))
    .map((c) => ({ rubric_id: c.rubric_id, criterion_id: c.criterion_id, title: c.title, mean_points: round2(c.sum / c.n) }));

  const scoredPcts = results.map((r) => r.percentage);
  const mean_percentage = scoredPcts.length ? round2(scoredPcts.reduce((s, n) => s + n, 0) / scoredPcts.length) : 0;

  return {
    contract: BATCH_CONTRACT,
    notice:
      'Informe AGREGADO de puntuación por lotes (Sprint 27). Entradas anónimas y sintéticas: no corresponde a ninguna persona ni a notas reales. No persiste datos personales ni activa producción.',
    production: { is_production: false, activates_production_gate: false, contains_secrets: false },
    totals: {
      submitted: evaluations.length,
      scored: results.length,
      rejected: rejected.length,
      mean_percentage,
    },
    by_band: bandCounts,
    by_rubric,
    criteria_averages,
    rejected,
    results: results.sort((a, b) => a.id.localeCompare(b.id)),
  };
}

// --- Render Markdown ---------------------------------------------------------
export function renderBatchMarkdown(report) {
  const L = [];
  L.push('# Informe de puntuación por lotes (Sprint 27)');
  L.push('');
  L.push('> Entradas **anónimas y sintéticas**. No corresponde a personas ni notas reales.');
  L.push('> No persiste datos personales ni activa producción.');
  L.push('');
  L.push(`- Enviadas: **${report.totals.submitted}**`);
  L.push(`- Puntuadas: **${report.totals.scored}**`);
  L.push(`- Rechazadas: **${report.totals.rejected}**`);
  L.push(`- Media global: **${report.totals.mean_percentage}%**`);
  L.push('');
  L.push('## Distribución por banda');
  L.push('');
  const bands = Object.keys(report.by_band).sort();
  if (bands.length) {
    L.push('| banda | evaluaciones |');
    L.push('|---|---|');
    for (const b of bands) L.push(`| ${b} | ${report.by_band[b]} |`);
  } else {
    L.push('_(sin puntuaciones)_');
  }
  L.push('');
  L.push('## Media por rúbrica');
  L.push('');
  if (report.by_rubric.length) {
    L.push('| rúbrica | puntuadas | media % |');
    L.push('|---|---|---|');
    for (const r of report.by_rubric) L.push(`| \`${r.rubric_id}\` | ${r.scored} | ${r.mean_percentage} |`);
  } else {
    L.push('_(sin rúbricas)_');
  }
  L.push('');
  L.push('## Media por criterio (puntos)');
  L.push('');
  if (report.criteria_averages.length) {
    L.push('| rúbrica | criterio | título | media puntos |');
    L.push('|---|---|---|---|');
    for (const c of report.criteria_averages) L.push(`| \`${c.rubric_id}\` | \`${c.criterion_id}\` | ${c.title} | ${c.mean_points} |`);
  } else {
    L.push('_(sin criterios)_');
  }
  L.push('');
  L.push('## Rechazos');
  L.push('');
  if (report.rejected.length) {
    L.push('| id | motivo | detalle |');
    L.push('|---|---|---|');
    for (const r of report.rejected) L.push(`| \`${r.id}\` | ${r.reason} | ${r.detail} |`);
  } else {
    L.push('_(sin rechazos)_');
  }
  L.push('');
  return `${L.join('\n')}\n`;
}

// --- Render CSV (una fila por evaluación puntuada) --------------------------
export function renderBatchCsv(report) {
  const esc = (s) => {
    const v = String(s == null ? '' : s);
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const rows = [['id', 'rubric_id', 'total', 'max_total', 'percentage', 'overall_level']];
  for (const r of report.results) rows.push([r.id, r.rubric_id, r.total, r.max_total, r.percentage, r.overall_level]);
  return `${rows.map((r) => r.map(esc).join(',')).join('\n')}\n`;
}

export function buildBatchPackage({ repoRoot = REPO_ROOT, dir = FIXTURES_DIR } = {}) {
  const evaluations = loadEvaluations(dir, { repoRoot });
  const rubricsById = loadRubricsById({ repoRoot });
  const report = scoreBatch(evaluations, rubricsById);
  return { report, markdown: renderBatchMarkdown(report), csv: renderBatchCsv(report) };
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
  const dir = opts.dir || FIXTURES_DIR;
  const pkg = buildBatchPackage({ dir });
  const files = {
    [`${OUT_DIR}/batch-report.json`]: `${JSON.stringify(pkg.report, null, 2)}\n`,
    [`${OUT_DIR}/batch-report.md`]: pkg.markdown,
    [`${OUT_DIR}/batch-report.csv`]: pkg.csv,
  };

  if (flags.has('json')) {
    process.stdout.write(`${JSON.stringify(pkg.report, null, 2)}\n`);
    return 0;
  }
  if (flags.has('check')) {
    const diffs = [];
    for (const [rel, content] of Object.entries(files)) {
      const p = abs(rel);
      if (!existsSync(p) || readFileSync(p, 'utf8') !== content) diffs.push(rel);
    }
    if (diffs.length) {
      process.stderr.write(`[batch] desactualizado: ${diffs.join(', ')}\n[batch] ejecuta: npm run education:batch:write\n`);
      return 1;
    }
    process.stdout.write('[batch] OK: informe por lotes al día.\n');
    return 0;
  }
  if (flags.has('write')) {
    for (const [rel, content] of Object.entries(files)) writeAtomic(abs(rel), content);
    process.stderr.write(`[batch] escrito informe por lotes en ${OUT_DIR} (${Object.keys(files).length} ficheros).\n`);
    return 0;
  }
  const t = pkg.report.totals;
  process.stdout.write(`Lote: ${t.submitted} enviadas · ${t.scored} puntuadas · ${t.rejected} rechazadas · media ${t.mean_percentage}%.\n`);
  process.stdout.write(`Usa --json para el informe, --write para escribir en ${OUT_DIR}, --check para verificar.\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
