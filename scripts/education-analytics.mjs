// GEOPÓLEM — Analítica pedagógica AGREGADA y ANÓNIMA (Sprint 28)
// ---------------------------------------------------------------------------
// Resume resultados de evaluaciones ANÓNIMAS/SINTÉTICAS reutilizando el motor de
// scoring por lotes del Sprint 27 (`scoreBatch`) y añade una capa de analítica
// pedagógica de ESCALAMIENTO, sin datos personales:
//   • Distribución por banda (conteo + porcentaje).
//   • Media y MEDIANA global y por rúbrica (si procede).
//   • Criterios más DÉBILES y más FUERTES (ranking por media de puntos
//     normalizada a la escala de cada rúbrica).
//   • Conteo de evaluaciones válidas/rechazadas y motivos de rechazo agregados.
//
// Garantías (idénticas al resto de artefactos educativos):
//   • Sólo acepta entradas anónimas/sintéticas: RECHAZA cualquier payload con
//     claves con aspecto de PII (reutiliza `findPIIKeys`) SIN copiar su contenido.
//   • No persiste datos personales ni crea tracking individual: la salida es
//     puramente AGREGADA (no incluye por-evaluación identificable).
//   • Determinista (sin timestamps en los ficheros escritos) → admite --check.
//   • No activa producción ni contiene secretos.
//
// Artefactos (en docs/education/analytics/):
//   • analytics-report.json   — informe máquina-legible.
//   • analytics-report.md     — informe navegable para el instructor.
//   • analytics-criteria.csv  — una fila por criterio con su media normalizada.
//
// Uso:
//   node scripts/education-analytics.mjs                (resumen)
//   node scripts/education-analytics.mjs --json          (informe JSON)
//   node scripts/education-analytics.mjs --dir=<carpeta> (fuente de evaluaciones)
//   node scripts/education-analytics.mjs --write          (escribe artefactos)
//   node scripts/education-analytics.mjs --check          (verifica al día)
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreRubric, findPIIKeys } from './score-rubric.mjs';
import { loadEvaluations, loadRubricsById } from './score-rubric-batch.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

export const ANALYTICS_CONTRACT = 'sprint-28-education-analytics-v1';
const FIXTURES_DIR = 'docs/education/batch/fixtures';
const OUT_DIR = 'docs/education/analytics';

const abs = (rel) => resolve(REPO_ROOT, rel);
const round2 = (n) => Math.round(n * 100) / 100;

// Mediana determinista de una lista de números (ordenada ascendente).
export function median(values) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? round2(s[mid]) : round2((s[mid - 1] + s[mid]) / 2);
}

// --- Motor de analítica (PURO) ----------------------------------------------
// evaluations: [{ id, payload }]  ·  rubricsById: { rubric_id: rubricDoc }
export function analyzeCohort(evaluations, rubricsById) {
  const scoredPcts = [];
  const bandCounts = {};
  const rejectReasons = {};
  let rejected = 0;
  // Acumuladores por rúbrica y por criterio (normalizado a la escala).
  const byRubricPcts = {};
  const critAcc = {}; // `${rubric_id}::${criterion_id}` -> { sum, n, title, scaleMin, scaleMax }

  for (const { payload } of evaluations) {
    // Rechazo por PII: NO copiamos el contenido, sólo contamos el motivo.
    if (findPIIKeys(payload).length) {
      rejected += 1;
      rejectReasons.pii = (rejectReasons.pii || 0) + 1;
      continue;
    }
    const rubric = payload.rubric_id && rubricsById[payload.rubric_id];
    if (!rubric) {
      rejected += 1;
      rejectReasons.rubric_not_found = (rejectReasons.rubric_not_found || 0) + 1;
      continue;
    }
    let scored;
    try {
      scored = scoreRubric(rubric, payload);
    } catch {
      rejected += 1;
      rejectReasons.invalid = (rejectReasons.invalid || 0) + 1;
      continue;
    }

    scoredPcts.push(scored.percentage);
    bandCounts[scored.overall_level] = (bandCounts[scored.overall_level] || 0) + 1;
    (byRubricPcts[payload.rubric_id] ||= []).push(scored.percentage);

    for (const c of scored.criteria) {
      const key = `${payload.rubric_id}::${c.id}`;
      const ca = (critAcc[key] ||= {
        rubric_id: payload.rubric_id,
        criterion_id: c.id,
        title: c.title,
        sum: 0,
        n: 0,
        scaleMin: scored.scale.min_points,
        scaleMax: scored.scale.max_points,
      });
      ca.sum += c.points;
      ca.n += 1;
    }
  }

  const scored = scoredPcts.length;
  const submitted = evaluations.length;
  const totalBands = Object.values(bandCounts).reduce((s, n) => s + n, 0) || 1;

  const by_band = Object.keys(bandCounts)
    .sort()
    .map((band) => ({
      band,
      count: bandCounts[band],
      percentage: round2((bandCounts[band] / totalBands) * 100),
    }));

  const by_rubric = Object.keys(byRubricPcts)
    .sort()
    .map((rid) => {
      const pcts = byRubricPcts[rid];
      return {
        rubric_id: rid,
        scored: pcts.length,
        mean_percentage: round2(pcts.reduce((s, n) => s + n, 0) / pcts.length),
        median_percentage: median(pcts),
      };
    });

  // Media de cada criterio normalizada a [0,1] sobre su escala → comparable
  // entre rúbricas con escalas distintas.
  const criteria = Object.values(critAcc)
    .map((c) => {
      const meanPoints = c.sum / c.n;
      const span = c.scaleMax - c.scaleMin;
      const normalized = span === 0 ? 1 : (meanPoints - c.scaleMin) / span;
      return {
        rubric_id: c.rubric_id,
        criterion_id: c.criterion_id,
        title: c.title,
        n: c.n,
        mean_points: round2(meanPoints),
        normalized: round2(normalized),
      };
    })
    .sort((a, b) =>
      a.normalized !== b.normalized
        ? a.normalized - b.normalized
        : (a.rubric_id + a.criterion_id).localeCompare(b.rubric_id + b.criterion_id),
    );

  const rank = (arr) => arr.map((c) => ({
    rubric_id: c.rubric_id,
    criterion_id: c.criterion_id,
    title: c.title,
    normalized: c.normalized,
    mean_points: c.mean_points,
  }));

  return {
    contract: ANALYTICS_CONTRACT,
    notice:
      'Analítica pedagógica AGREGADA (Sprint 28). Entradas anónimas y sintéticas: no corresponde a ninguna persona ni a notas reales. Salida agregada, sin tracking individual ni datos personales.',
    production: { is_production: false, activates_production_gate: false, contains_secrets: false },
    totals: {
      submitted,
      valid: scored,
      rejected,
      mean_percentage: scored ? round2(scoredPcts.reduce((s, n) => s + n, 0) / scored) : 0,
      median_percentage: median(scoredPcts),
    },
    reject_reasons: Object.keys(rejectReasons)
      .sort()
      .map((reason) => ({ reason, count: rejectReasons[reason] })),
    by_band,
    by_rubric,
    weakest_criteria: rank(criteria.slice(0, 3)),
    strongest_criteria: rank([...criteria].reverse().slice(0, 3)),
    criteria,
  };
}

// --- Render Markdown ---------------------------------------------------------
export function renderAnalyticsMarkdown(r) {
  const L = [];
  L.push('# Analítica pedagógica agregada (Sprint 28)');
  L.push('');
  L.push('> Entradas **anónimas y sintéticas**. Salida **agregada**: sin tracking individual ni datos personales.');
  L.push('');
  L.push(`- Evaluaciones enviadas: **${r.totals.submitted}**`);
  L.push(`- Válidas: **${r.totals.valid}** · Rechazadas: **${r.totals.rejected}**`);
  L.push(`- Media global: **${r.totals.mean_percentage}%** · Mediana global: **${r.totals.median_percentage}%**`);
  L.push('');
  L.push('## Distribución por banda');
  L.push('');
  if (r.by_band.length) {
    L.push('| banda | evaluaciones | % |');
    L.push('|---|---|---|');
    for (const b of r.by_band) L.push(`| ${b.band} | ${b.count} | ${b.percentage} |`);
  } else L.push('_(sin puntuaciones)_');
  L.push('');
  L.push('## Media y mediana por rúbrica');
  L.push('');
  if (r.by_rubric.length) {
    L.push('| rúbrica | válidas | media % | mediana % |');
    L.push('|---|---|---|---|');
    for (const x of r.by_rubric) L.push(`| \`${x.rubric_id}\` | ${x.scored} | ${x.mean_percentage} | ${x.median_percentage} |`);
  } else L.push('_(sin rúbricas)_');
  L.push('');
  L.push('## Criterios más débiles (menor dominio, normalizado 0–1)');
  L.push('');
  if (r.weakest_criteria.length) {
    L.push('| rúbrica | criterio | título | normalizado |');
    L.push('|---|---|---|---|');
    for (const c of r.weakest_criteria) L.push(`| \`${c.rubric_id}\` | \`${c.criterion_id}\` | ${c.title} | ${c.normalized} |`);
  } else L.push('_(sin criterios)_');
  L.push('');
  L.push('## Criterios más fuertes (mayor dominio, normalizado 0–1)');
  L.push('');
  if (r.strongest_criteria.length) {
    L.push('| rúbrica | criterio | título | normalizado |');
    L.push('|---|---|---|---|');
    for (const c of r.strongest_criteria) L.push(`| \`${c.rubric_id}\` | \`${c.criterion_id}\` | ${c.title} | ${c.normalized} |`);
  } else L.push('_(sin criterios)_');
  L.push('');
  L.push('## Rechazos por motivo');
  L.push('');
  if (r.reject_reasons.length) {
    L.push('| motivo | conteo |');
    L.push('|---|---|');
    for (const x of r.reject_reasons) L.push(`| ${x.reason} | ${x.count} |`);
  } else L.push('_(sin rechazos)_');
  L.push('');
  return `${L.join('\n')}\n`;
}

// --- Render CSV (una fila por criterio) -------------------------------------
export function renderAnalyticsCsv(r) {
  const esc = (s) => {
    const v = String(s == null ? '' : s);
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const rows = [['rubric_id', 'criterion_id', 'title', 'n', 'mean_points', 'normalized']];
  for (const c of r.criteria) rows.push([c.rubric_id, c.criterion_id, c.title, c.n, c.mean_points, c.normalized]);
  return `${rows.map((row) => row.map(esc).join(',')).join('\n')}\n`;
}

export function buildAnalyticsPackage({ repoRoot = REPO_ROOT, dir = FIXTURES_DIR } = {}) {
  const evaluations = loadEvaluations(dir, { repoRoot });
  const rubricsById = loadRubricsById({ repoRoot });
  const report = analyzeCohort(evaluations, rubricsById);
  return { report, markdown: renderAnalyticsMarkdown(report), csv: renderAnalyticsCsv(report) };
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
  const pkg = buildAnalyticsPackage({ dir });
  const files = {
    [`${OUT_DIR}/analytics-report.json`]: `${JSON.stringify(pkg.report, null, 2)}\n`,
    [`${OUT_DIR}/analytics-report.md`]: pkg.markdown,
    [`${OUT_DIR}/analytics-criteria.csv`]: pkg.csv,
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
      process.stderr.write(`[analytics] desactualizado: ${diffs.join(', ')}\n[analytics] ejecuta: npm run education:analytics:write\n`);
      return 1;
    }
    process.stdout.write('[analytics] OK: analítica pedagógica al día.\n');
    return 0;
  }
  if (flags.has('write')) {
    for (const [rel, content] of Object.entries(files)) writeAtomic(abs(rel), content);
    process.stderr.write(`[analytics] escrita analítica en ${OUT_DIR} (${Object.keys(files).length} ficheros).\n`);
    return 0;
  }
  const t = pkg.report.totals;
  process.stdout.write(`Analítica: ${t.submitted} enviadas · ${t.valid} válidas · ${t.rejected} rechazadas · media ${t.mean_percentage}% · mediana ${t.median_percentage}%.\n`);
  process.stdout.write(`Usa --json para el informe, --write para escribir en ${OUT_DIR}, --check para verificar.\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
