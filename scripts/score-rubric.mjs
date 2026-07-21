// GEOPÓLEM — Motor de puntuación de rúbricas (Sprint 26)
// ---------------------------------------------------------------------------
// Toma una rúbrica máquina-legible (`sprint-25-rubric-v1`) y una EVALUACIÓN de
// ejemplo (`sprint-26-rubric-evaluation-v1`) y calcula, de forma PURA y
// determinista:
//   • Subpuntajes por criterio (nivel elegido × ponderación).
//   • Puntaje total ponderado y su normalización 0–100.
//   • Banda de logro global y feedback textual por criterio (descriptor del
//     nivel + sugerencia hacia el siguiente nivel si no es el máximo).
//
// Garantías:
//   • Valida la rúbrica (pesos, niveles, descriptores) reutilizando el
//     validador del Sprint 25 antes de puntuar.
//   • Valida la evaluación: cada criterio cubierto exactamente una vez, cada
//     nivel existe en la escala, sin criterios desconocidos.
//   • NO almacena datos personales ni notas reales: rechaza payloads con claves
//     que parezcan identificar a una persona (nombre, email, DNI, etc.).
//   • No activa producción ni contiene secretos.
//
// Uso:
//   node scripts/score-rubric.mjs --rubric=<ruta> --evaluation=<ruta> [--json]
//   node scripts/score-rubric.mjs --rubric=<ruta> --sample [--json]
//     (--sample puntúa una evaluación de ejemplo sintética, todo "notable")
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRubric } from './validate-education-rubrics.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

export const EVALUATION_CONTRACT = 'sprint-26-rubric-evaluation-v1';
export const SCORING_CONTRACT = 'sprint-26-rubric-scoring-v1';

// Claves que sugieren datos personales: la evaluación debe ser ANÓNIMA.
const PII_KEY_PATTERNS = [
  /nombre/i, /name/i, /apellid/i, /surname/i,
  /email/i, /correo/i, /e-?mail/i,
  /dni|nif|nie|passport|pasaporte|ssn/i,
  /tel[eé]fono|phone|m[oó]vil/i,
  /direcci[oó]n|address/i,
  /student_id|alumno_id|matr[ií]cula/i,
];

const CANONICAL_BANDS = [
  { id: 'insuficiente', min: 0 },
  { id: 'suficiente', min: 50 },
  { id: 'notable', min: 70 },
  { id: 'excelente', min: 90 },
];

// --- Utilidades de escala ---------------------------------------------------
function levelIndexById(levels, id) {
  return levels.findIndex((l) => l.id === id);
}

function scaleBounds(levels) {
  const pts = levels.map((l) => l.points);
  return { min: Math.min(...pts), max: Math.max(...pts) };
}

// Recorre recursivamente el payload buscando claves con aspecto de PII.
export function findPIIKeys(obj, path = '') {
  const hits = [];
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => hits.push(...findPIIKeys(v, `${path}[${i}]`)));
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (PII_KEY_PATTERNS.some((re) => re.test(k))) hits.push(path ? `${path}.${k}` : k);
      hits.push(...findPIIKeys(v, path ? `${path}.${k}` : k));
    }
  }
  return hits;
}

// Normaliza `scores` a un mapa { criterionId: levelId } admitiendo:
//   • objeto:  { "nodos": "notable", ... }
//   • array:   [ { "criterion": "nodos", "level": "notable" }, ... ]
export function normalizeScores(scores) {
  if (Array.isArray(scores)) {
    const map = {};
    for (const s of scores) {
      if (s && s.criterion != null) map[s.criterion] = s.level;
    }
    return map;
  }
  if (scores && typeof scores === 'object') return { ...scores };
  return {};
}

// --- Validación de la evaluación (PURA) -------------------------------------
export function validateEvaluation(rubric, evaluation) {
  const errors = [];
  if (!evaluation || typeof evaluation !== 'object') {
    return ['evaluación ausente o no es un objeto'];
  }
  if (evaluation.contract && evaluation.contract !== EVALUATION_CONTRACT) {
    errors.push(`contrato de evaluación inesperado: ${evaluation.contract}`);
  }
  const pii = findPIIKeys(evaluation);
  if (pii.length) errors.push(`la evaluación contiene claves con aspecto de datos personales: ${pii.join(', ')}`);

  const levels = (rubric.scale && Array.isArray(rubric.scale.levels)) ? rubric.scale.levels : [];
  const levelIds = new Set(levels.map((l) => l.id));
  const criteria = Array.isArray(rubric.criteria) ? rubric.criteria : [];
  const critIds = criteria.map((c) => c.id);

  const scores = normalizeScores(evaluation.scores);
  const scored = Object.keys(scores);

  for (const c of critIds) {
    if (!(c in scores)) errors.push(`falta puntuación para el criterio "${c}"`);
  }
  for (const c of scored) {
    if (!critIds.includes(c)) errors.push(`criterio desconocido en la evaluación: "${c}"`);
    else if (!levelIds.has(scores[c])) errors.push(`nivel inválido "${scores[c]}" para el criterio "${c}"`);
  }
  return errors;
}

function bandFor(percentage) {
  let band = CANONICAL_BANDS[0].id;
  for (const b of CANONICAL_BANDS) if (percentage >= b.min) band = b.id;
  return band;
}

// --- Motor de puntuación (PURO) ---------------------------------------------
export function scoreRubric(rubric, evaluation) {
  const rubricErrors = validateRubric(rubric);
  if (rubricErrors.length) {
    const err = new Error(`rúbrica inválida: ${rubricErrors.join('; ')}`);
    err.rubricErrors = rubricErrors;
    throw err;
  }
  const evalErrors = validateEvaluation(rubric, evaluation);
  if (evalErrors.length) {
    const err = new Error(`evaluación inválida: ${evalErrors.join('; ')}`);
    err.evalErrors = evalErrors;
    throw err;
  }

  const levels = rubric.scale.levels;
  const { min: minPts, max: maxPts } = scaleBounds(levels);
  const scores = normalizeScores(evaluation.scores);

  const criteria = rubric.criteria.map((c) => {
    const levelId = scores[c.id];
    const level = levels[levelIndexById(levels, levelId)];
    const weight = c.weight;
    const weighted = round4(weight * level.points);
    const idx = levelIndexById(levels, levelId);
    const nextLevel = idx < levels.length - 1 ? levels[idx + 1] : null;
    const descriptor = (c.descriptors && c.descriptors[levelId]) || null;
    const nextDescriptor = nextLevel && c.descriptors ? c.descriptors[nextLevel.id] : null;
    const feedback = nextLevel
      ? `Nivel actual "${level.label}": ${descriptor} Para avanzar a "${nextLevel.label}": ${nextDescriptor}`
      : `Nivel máximo alcanzado ("${level.label}"): ${descriptor}`;
    return {
      id: c.id,
      title: c.title,
      weight,
      level: levelId,
      level_label: level.label,
      points: level.points,
      weighted,
      max_weighted: round4(weight * maxPts),
      descriptor,
      feedback,
    };
  });

  const total = round4(criteria.reduce((s, c) => s + c.weighted, 0));
  const maxTotal = round4(criteria.reduce((s, c) => s + c.max_weighted, 0));
  const minTotal = round4(rubric.criteria.reduce((s, c) => s + c.weight * minPts, 0));
  const percentage = maxTotal === minTotal ? 100 : round2(((total - minTotal) / (maxTotal - minTotal)) * 100);

  return {
    contract: SCORING_CONTRACT,
    rubric_id: rubric.id,
    rubric_title: rubric.title,
    production: { is_production: false, activates_production_gate: false, contains_secrets: false },
    scale: { min_points: minPts, max_points: maxPts, levels: levels.map((l) => l.id) },
    criteria,
    total,
    min_total: minTotal,
    max_total: maxTotal,
    percentage,
    overall_level: bandFor(percentage),
    feedback: criteria.map((c) => `• ${c.title}: ${c.feedback}`),
  };
}

// Evaluación de ejemplo sintética: asigna a cada criterio el nivel indicado
// (por defecto el penúltimo, "notable") — útil para demos y pruebas.
export function sampleEvaluation(rubric, levelId) {
  const levels = rubric.scale.levels;
  const chosen = levelId || (levels[Math.max(0, levels.length - 2)] || levels[0]).id;
  return {
    contract: EVALUATION_CONTRACT,
    rubric_id: rubric.id,
    notice: 'Evaluación SINTÉTICA de ejemplo (Sprint 26). No corresponde a ninguna persona real.',
    production: { is_production: false, activates_production_gate: false, contains_secrets: false },
    scores: Object.fromEntries(rubric.criteria.map((c) => [c.id, chosen])),
  };
}

const round2 = (n) => Math.round(n * 100) / 100;
const round4 = (n) => Math.round(n * 10000) / 10000;

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

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

function main() {
  const { flags, opts } = parseArgs(process.argv.slice(2));
  const jsonOut = flags.has('json');
  if (!opts.rubric) {
    process.stderr.write('[score] indica --rubric=<ruta a la rúbrica JSON>\n');
    return 2;
  }
  const rubricPath = resolve(REPO_ROOT, opts.rubric);
  if (!existsSync(rubricPath)) {
    process.stderr.write(`[score] rúbrica no encontrada: ${opts.rubric}\n`);
    return 2;
  }
  const rubric = readJson(rubricPath);

  let evaluation;
  if (flags.has('sample')) {
    evaluation = sampleEvaluation(rubric, opts.level);
  } else if (opts.evaluation) {
    const evalPath = resolve(REPO_ROOT, opts.evaluation);
    if (!existsSync(evalPath)) {
      process.stderr.write(`[score] evaluación no encontrada: ${opts.evaluation}\n`);
      return 2;
    }
    evaluation = readJson(evalPath);
  } else {
    process.stderr.write('[score] indica --evaluation=<ruta> o usa --sample\n');
    return 2;
  }

  let result;
  try {
    result = scoreRubric(rubric, evaluation);
  } catch (e) {
    process.stderr.write(`[score] ${e.message}\n`);
    return 1;
  }

  if (jsonOut) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`Rúbrica: ${result.rubric_title} (${result.rubric_id})\n`);
    for (const c of result.criteria) {
      process.stdout.write(`  - ${c.title}: ${c.level_label} (${c.points} pts × ${c.weight} = ${c.weighted})\n`);
    }
    process.stdout.write(`Total ponderado: ${result.total} / ${result.max_total}  →  ${result.percentage}%  [${result.overall_level}]\n`);
    process.stdout.write('\nFeedback:\n');
    for (const f of result.feedback) process.stdout.write(`  ${f}\n`);
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
