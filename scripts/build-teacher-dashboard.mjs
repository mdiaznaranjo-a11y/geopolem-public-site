// GEOPÓLEM — Panel docente AGREGADO no individualizado (Sprint 29)
// ---------------------------------------------------------------------------
// Compone en un ÚNICO panel agregado los outputs ya deterministas de la capa
// educativa (Sprint 27/28/29), pensado para operación docente de cohorte SIN
// seguimiento individual ni datos personales. Reúne:
//
//   • Distribución por banda + medias/medianas  (analítica agregada, Sprint 28).
//   • Criterios más débiles / más fuertes        (analítica agregada, Sprint 28).
//   • Evaluaciones válidas / rechazadas + motivos (analítica agregada, Sprint 28).
//   • Casos con mayor necesidad de revisión       (cola editorial causal, S29).
//   • Estado de cobertura i18n (ES/EN ampliado)   (validador i18n, Sprint 28/29).
//   • Estado causal agregado                       (cross-check ampliado, S28).
//
// Garantías (idénticas al resto de artefactos educativos):
//   • AGREGADO: no expone resultados por evaluación ni identidades. Hereda el
//     rechazo de PII de la analítica; no copia contenido personal.
//   • Determinista (sin timestamps) → admite --check en CI.
//   • Sólo COMPONE fuentes existentes: no recalcula ni inventa datos.
//   • No activa producción ni contiene secretos.
//
// Artefactos (en docs/education/dashboard/):
//   • teacher-dashboard.json — panel máquina-legible.
//   • teacher-dashboard.md   — panel navegable para el equipo docente.
//
// Uso:
//   node scripts/build-teacher-dashboard.mjs            (resumen)
//   node scripts/build-teacher-dashboard.mjs --json      (panel JSON)
//   node scripts/build-teacher-dashboard.mjs --write      (escribe artefactos)
//   node scripts/build-teacher-dashboard.mjs --check      (verifica al día)
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeCohort } from './education-analytics.mjs';
import { loadEvaluations, loadRubricsById } from './score-rubric-batch.mjs';
import { validateI18n } from './validate-i18n-coverage.mjs';
import { crosscheckScale } from './causal-crosscheck-scale.mjs';
import { buildCausalQueue } from './build-causal-queue.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

export const DASHBOARD_CONTRACT = 'sprint-29-education-teacher-dashboard-v1';
const FIXTURES_DIR = 'docs/education/batch/fixtures';
const OUT_DIR = 'docs/education/dashboard';
const I18N_SPRINT29_MANIFEST = 'docs/education/i18n/i18n.sprint29.manifest.json';
const I18N_SPRINT29_CONTRACT = 'sprint-29-education-i18n-v1';

const abs = (rel) => resolve(REPO_ROOT, rel);

// --- Composición del panel (PURA salvo lectura de ficheros) ------------------
export function buildTeacherDashboard({ repoRoot = REPO_ROOT, stage = 'rc', dir = FIXTURES_DIR } = {}) {
  // 1) Analítica pedagógica agregada (reusa el motor del Sprint 28).
  const evaluations = loadEvaluations(dir, { repoRoot });
  const rubricsById = loadRubricsById({ repoRoot });
  const analytics = analyzeCohort(evaluations, rubricsById);

  // 2) Cobertura i18n ampliada ES/EN (Sprint 29), con fallback al set Sprint 28.
  const i18n = existsSync(resolve(repoRoot, I18N_SPRINT29_MANIFEST))
    ? validateI18n({ repoRoot, manifestRel: I18N_SPRINT29_MANIFEST, expectedContract: I18N_SPRINT29_CONTRACT })
    : validateI18n({ repoRoot });

  // 3) Estado causal agregado (cross-check ampliado, Sprint 28).
  const scale = crosscheckScale({ repoRoot, stage });

  // 4) Cola editorial causal normalizada (Sprint 29) → casos a revisar.
  const queue = buildCausalQueue({ repoRoot, stage });

  // Casos con mayor necesidad de revisión: agregado por conflicto/caso desde la
  // cola (ordenado por prioridad máxima y nº de acciones). Determinista.
  const perCase = {};
  for (const it of queue.items) {
    const c = (perCase[it.conflict_id] ||= { conflict_id: it.conflict_id, open_actions: 0, blocking: 0, top_priority: 'P3' });
    c.open_actions += 1;
    if (it.blocking) c.blocking += 1;
    if (it.priority < c.top_priority) c.top_priority = it.priority; // 'P1' < 'P2' < 'P3'
  }
  const priRank = { P1: 0, P2: 1, P3: 2 };
  const review_needed = Object.values(perCase)
    .sort((a, b) =>
      (priRank[a.top_priority] - priRank[b.top_priority]) ||
      (b.open_actions - a.open_actions) ||
      a.conflict_id.localeCompare(b.conflict_id))
    .slice(0, 10);

  return {
    contract: DASHBOARD_CONTRACT,
    notice:
      'Panel docente AGREGADO no individualizado (Sprint 29). Compone outputs deterministas de la capa educativa: sin seguimiento individual, sin datos personales. No activa producción ni contiene secretos.',
    production: { is_production: false, activates_production_gate: false, contains_secrets: false },
    source_stage: stage,
    cohort: {
      submitted: analytics.totals.submitted,
      valid: analytics.totals.valid,
      rejected: analytics.totals.rejected,
      mean_percentage: analytics.totals.mean_percentage,
      median_percentage: analytics.totals.median_percentage,
      reject_reasons: analytics.reject_reasons,
    },
    by_band: analytics.by_band,
    weakest_criteria: analytics.weakest_criteria,
    strongest_criteria: analytics.strongest_criteria,
    i18n: {
      contract: i18n.contract,
      base_locale: i18n.base_locale,
      target_locales: i18n.target_locales,
      coverage_percentage: i18n.coverage_percentage,
      ok: i18n.ok,
      namespaces: i18n.namespaces.map((n) => n.id),
    },
    causal: {
      conflicts: scale.totals.conflicts,
      by_status: scale.totals.by_status,
      coverage_percentage: scale.totals.coverage_percentage,
      queue_items: queue.totals.items,
      queue_blocking: queue.totals.blocking,
      queue_by_priority: queue.totals.by_priority,
    },
    review_needed,
  };
}

export function renderDashboardMarkdown(d) {
  const L = [];
  L.push('# Panel docente agregado (Sprint 29)');
  L.push('');
  L.push('> Vista **agregada y anónima** de cohorte: sin seguimiento individual ni');
  L.push('> datos personales. Compone artefactos deterministas de la capa educativa.');
  L.push('> No activa producción ni contiene secretos.');
  L.push('');
  L.push(`- Stage: **${d.source_stage}**`);
  L.push('');
  L.push('## Resumen de la cohorte');
  L.push('');
  L.push(`- Enviadas: **${d.cohort.submitted}** · válidas: **${d.cohort.valid}** · rechazadas: **${d.cohort.rejected}**`);
  L.push(`- Media global: **${d.cohort.mean_percentage}%** · mediana global: **${d.cohort.median_percentage}%**`);
  if (d.cohort.reject_reasons.length) {
    L.push(`- Motivos de rechazo: ${d.cohort.reject_reasons.map((r) => `${r.reason} (${r.count})`).join(', ')}`);
  }
  L.push('');
  L.push('## Distribución por banda');
  L.push('');
  if (d.by_band.length) {
    L.push('| banda | evaluaciones | % |');
    L.push('|---|---|---|');
    for (const b of d.by_band) L.push(`| ${b.band} | ${b.count} | ${b.percentage} |`);
  } else L.push('_(sin puntuaciones)_');
  L.push('');
  L.push('## Criterios más débiles');
  L.push('');
  if (d.weakest_criteria.length) {
    L.push('| rúbrica | criterio | normalizado |');
    L.push('|---|---|---|');
    for (const c of d.weakest_criteria) L.push(`| \`${c.rubric_id}\` | ${c.title} | ${c.normalized} |`);
  } else L.push('_(sin criterios)_');
  L.push('');
  L.push('## Criterios más fuertes');
  L.push('');
  if (d.strongest_criteria.length) {
    L.push('| rúbrica | criterio | normalizado |');
    L.push('|---|---|---|');
    for (const c of d.strongest_criteria) L.push(`| \`${c.rubric_id}\` | ${c.title} | ${c.normalized} |`);
  } else L.push('_(sin criterios)_');
  L.push('');
  L.push('## Casos con mayor necesidad de revisión');
  L.push('');
  if (d.review_needed.length) {
    L.push('| conflicto/caso | prioridad máx. | acciones abiertas | bloqueantes |');
    L.push('|---|---|---|---|');
    for (const c of d.review_needed) L.push(`| \`${c.conflict_id}\` | ${c.top_priority} | ${c.open_actions} | ${c.blocking} |`);
  } else L.push('_(sin casos pendientes de revisión)_');
  L.push('');
  L.push('## Estado de cobertura i18n');
  L.push('');
  L.push(`- Contrato: \`${d.i18n.contract}\` · base **${d.i18n.base_locale}** → destinos **${d.i18n.target_locales.join(', ')}**`);
  L.push(`- Cobertura: **${d.i18n.coverage_percentage}%** · ${d.i18n.ok ? 'OK' : 'FALLOS'}`);
  L.push(`- Namespaces: ${d.i18n.namespaces.map((n) => `\`${n}\``).join(', ')}`);
  L.push('');
  L.push('## Estado causal agregado');
  L.push('');
  const s = d.causal.by_status;
  L.push(`- Conflictos: **${d.causal.conflicts}** · checked **${s.checked}** · divergent **${s.divergent}** · pending_matrix **${s.pending_matrix}** · n/a **${s.not_applicable}**`);
  L.push(`- Cobertura causal sobre validables: **${d.causal.coverage_percentage}%**`);
  L.push(`- Cola editorial: **${d.causal.queue_items}** ítems (P1 ${d.causal.queue_by_priority.P1} · P2 ${d.causal.queue_by_priority.P2} · P3 ${d.causal.queue_by_priority.P3}) · bloqueantes **${d.causal.queue_blocking}**`);
  L.push('');
  return `${L.join('\n')}\n`;
}

export function buildDashboardPackage({ repoRoot = REPO_ROOT, stage = 'rc', dir = FIXTURES_DIR } = {}) {
  const dashboard = buildTeacherDashboard({ repoRoot, stage, dir });
  return { dashboard, markdown: renderDashboardMarkdown(dashboard) };
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
  const pkg = buildDashboardPackage({ stage: opts.stage || 'rc', dir: opts.dir || FIXTURES_DIR });
  const files = {
    [`${OUT_DIR}/teacher-dashboard.json`]: `${JSON.stringify(pkg.dashboard, null, 2)}\n`,
    [`${OUT_DIR}/teacher-dashboard.md`]: pkg.markdown,
  };

  if (flags.has('json')) {
    process.stdout.write(`${JSON.stringify(pkg.dashboard, null, 2)}\n`);
    return 0;
  }
  if (flags.has('check')) {
    const diffs = [];
    for (const [rel, content] of Object.entries(files)) {
      const p = abs(rel);
      if (!existsSync(p) || readFileSync(p, 'utf8') !== content) diffs.push(rel);
    }
    if (diffs.length) {
      process.stderr.write(`[dashboard] desactualizado: ${diffs.join(', ')}\n[dashboard] ejecuta: npm run education:dashboard:write\n`);
      return 1;
    }
    process.stdout.write('[dashboard] OK: panel docente agregado al día.\n');
    return 0;
  }
  if (flags.has('write')) {
    for (const [rel, content] of Object.entries(files)) writeAtomic(abs(rel), content);
    process.stderr.write(`[dashboard] escrito panel docente en ${OUT_DIR} (${Object.keys(files).length} ficheros).\n`);
    return 0;
  }
  const d = pkg.dashboard;
  process.stdout.write(`Panel docente: ${d.cohort.valid}/${d.cohort.submitted} válidas · i18n ${d.i18n.coverage_percentage}% · causal cobertura ${d.causal.coverage_percentage}% · cola ${d.causal.queue_items} ítems.\n`);
  process.stdout.write(`Usa --json para el panel, --write para escribir en ${OUT_DIR}, --check para verificar.\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
