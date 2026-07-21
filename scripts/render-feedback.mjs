// GEOPÓLEM — Render de feedback docente (Sprint 27)
// ---------------------------------------------------------------------------
// Toma el resultado del motor de puntuación (Sprint 26) y una PLANTILLA de
// feedback (`docs/education/feedback-templates/feedback.template.json`) y produce
// feedback docente en Markdown, POR CRITERIO, con:
//   • banda de logro global + recomendación pedagógica de banda,
//   • para cada criterio: descriptor/feedback del motor + recomendación según su
//     nivel (`insuficiente…excelente`).
//
// Garantías:
//   • Reutiliza `scoreRubric` (no duplica lógica de puntuación).
//   • La evaluación de entrada se valida y se rechaza si contiene PII.
//   • No persiste datos personales ni activa producción.
//
// Uso:
//   node scripts/render-feedback.mjs --rubric=<ruta> --evaluation=<ruta>
//   node scripts/render-feedback.mjs --rubric=<ruta> --evaluation=<ruta> --json
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreRubric } from './score-rubric.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

export const FEEDBACK_TEMPLATE_CONTRACT = 'sprint-27-feedback-template-v1';
const DEFAULT_TEMPLATE = 'docs/education/feedback-templates/feedback.template.json';

const abs = (rel) => resolve(REPO_ROOT, rel);
const readJson = (rel) => JSON.parse(readFileSync(abs(rel), 'utf8'));

export function loadFeedbackTemplate({ repoRoot = REPO_ROOT, file = DEFAULT_TEMPLATE } = {}) {
  return JSON.parse(readFileSync(resolve(repoRoot, file), 'utf8'));
}

// Construye el objeto de feedback (PURO) a partir de un resultado de puntuación.
export function buildFeedback(scoreResult, template) {
  const band = (template.bands && template.bands[scoreResult.overall_level]) || { headline: '', recommendation: '' };
  const levelRecs = template.level_recommendations || {};
  return {
    contract: 'sprint-27-feedback-v1',
    production: { is_production: false, activates_production_gate: false, contains_secrets: false },
    rubric_id: scoreResult.rubric_id,
    rubric_title: scoreResult.rubric_title,
    percentage: scoreResult.percentage,
    overall_level: scoreResult.overall_level,
    band_headline: band.headline,
    band_recommendation: band.recommendation,
    criteria: scoreResult.criteria.map((c) => ({
      id: c.id,
      title: c.title,
      level: c.level,
      points: c.points,
      feedback: c.feedback,
      level_recommendation: levelRecs[c.level] || '',
    })),
  };
}

export function renderFeedbackMarkdown(fb) {
  const L = [];
  L.push(`## Feedback — ${fb.rubric_title}`);
  L.push('');
  L.push(`- **Rúbrica**: \`${fb.rubric_id}\``);
  L.push(`- **Banda global**: **${fb.overall_level}** (${fb.percentage}%) — ${fb.band_headline}`);
  L.push(`- **Recomendación general**: ${fb.band_recommendation}`);
  L.push('');
  L.push('### Por criterio');
  L.push('');
  for (const c of fb.criteria) {
    L.push(`- **${c.title}** — nivel \`${c.level}\` (${c.points} pts)`);
    L.push(`  - ${c.feedback}`);
    L.push(`  - Recomendación pedagógica: ${c.level_recommendation}`);
  }
  L.push('');
  L.push('_Feedback determinista sobre una evaluación anónima y sintética. No corresponde a ninguna persona ni a una nota real._');
  L.push('');
  return `${L.join('\n')}\n`;
}

// Conveniencia: rúbrica + evaluación → feedback renderizado.
export function renderFeedback(rubric, evaluation, template) {
  return renderFeedbackMarkdown(buildFeedback(scoreRubric(rubric, evaluation), template));
}

// --- CLI --------------------------------------------------------------------
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
  if (!opts.rubric || !opts.evaluation) {
    process.stderr.write('[feedback] indica --rubric=<ruta> y --evaluation=<ruta>\n');
    return 2;
  }
  if (!existsSync(abs(opts.rubric)) || !existsSync(abs(opts.evaluation))) {
    process.stderr.write('[feedback] rúbrica o evaluación no encontrada\n');
    return 2;
  }
  const rubric = readJson(opts.rubric);
  const evaluation = readJson(opts.evaluation);
  const template = loadFeedbackTemplate({ file: opts.template || DEFAULT_TEMPLATE });

  let fb;
  try {
    fb = buildFeedback(scoreRubric(rubric, evaluation), template);
  } catch (e) {
    process.stderr.write(`[feedback] ${e.message}\n`);
    return 1;
  }
  if (flags.has('json')) process.stdout.write(`${JSON.stringify(fb, null, 2)}\n`);
  else process.stdout.write(renderFeedbackMarkdown(fb));
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
