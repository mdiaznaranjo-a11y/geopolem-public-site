// GEOPÓLEM — Validador de rúbricas máquina-legibles (Sprint 25)
// ---------------------------------------------------------------------------
// Verifica, SIN base de datos ni navegador, que las rúbricas del Sprint 25 son
// máquina-legibles y consistentes:
//   1. El índice `rubrics.index.json` existe y declara 6 rúbricas.
//   2. Cada rúbrica existe, usa el contrato `sprint-25-rubric-v1` y declara
//      escala, criterios y descriptores.
//   3. Las ponderaciones (`weight`) de cada rúbrica suman 1.0 (±0.001).
//   4. Cada criterio tiene un descriptor por cada nivel de la escala.
//   5. Los ids de criterio son únicos dentro de la rúbrica.
//   6. Ninguna rúbrica activa producción ni contiene secretos.
//
// Uso:
//   node scripts/validate-education-rubrics.mjs           (PASS/FAIL + exit)
//   node scripts/validate-education-rubrics.mjs --json     (salida JSON)
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const INDEX_REL = 'docs/education/rubrics/rubrics.index.json';
const EXPECTED_RUBRICS = 6;

const JSON_OUT = process.argv.includes('--json');
const abs = (rel) => resolve(REPO_ROOT, rel);
const readText = (rel) => readFileSync(abs(rel), 'utf8');
const readJson = (rel) => JSON.parse(readText(rel));

const SECRET_PATTERNS = [
  /-----BEGIN[A-Z ]*PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /gh[pousr]_[0-9A-Za-z]{20,}/,
  /xox[baprs]-[0-9A-Za-z-]{10,}/,
];
const PROD_PATTERNS = [/"is_production"\s*:\s*true/, /activates_production_gate"\s*:\s*true/, /NODE_ENV\s*=\s*production/];

// Validación PURA de una rúbrica: devuelve lista de errores (vacía = OK).
export function validateRubric(rubric) {
  const errors = [];
  if (rubric.contract !== 'sprint-25-rubric-v1') errors.push(`contrato inesperado: ${rubric.contract}`);
  if (!rubric.id) errors.push('falta id');
  if (!rubric.title) errors.push('falta title');

  const levels = (rubric.scale && Array.isArray(rubric.scale.levels)) ? rubric.scale.levels : [];
  if (!levels.length) errors.push('escala sin niveles');
  const levelIds = levels.map((l) => l.id);
  if (new Set(levelIds).size !== levelIds.length) errors.push('niveles de escala duplicados');
  for (const l of levels) {
    if (!Number.isFinite(l.points)) errors.push(`nivel ${l.id}: points no numérico`);
  }

  const criteria = Array.isArray(rubric.criteria) ? rubric.criteria : [];
  if (!criteria.length) errors.push('sin criterios');

  const ids = criteria.map((c) => c.id);
  if (new Set(ids).size !== ids.length) errors.push('ids de criterio duplicados');

  let weightSum = 0;
  for (const c of criteria) {
    if (!c.id) errors.push('criterio sin id');
    if (!c.title) errors.push(`criterio ${c.id}: sin title`);
    if (!Number.isFinite(c.weight)) errors.push(`criterio ${c.id}: weight no numérico`);
    else weightSum += c.weight;
    const descriptors = c.descriptors || {};
    for (const lid of levelIds) {
      if (!descriptors[lid] || !String(descriptors[lid]).trim()) {
        errors.push(`criterio ${c.id}: falta descriptor para nivel "${lid}"`);
      }
    }
  }
  if (criteria.length && Math.abs(weightSum - 1) > 0.001) {
    errors.push(`las ponderaciones suman ${weightSum.toFixed(3)} (se espera 1.000)`);
  }
  return errors;
}

function main() {
  const results = [];
  let failures = 0;
  const check = (name, cond, detail) => {
    const ok = !!cond;
    results.push({ name, ok, detail: detail || null });
    if (!ok) failures++;
    if (!JSON_OUT) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  — ${detail}` : ''}`);
  };

  check('índice de rúbricas existe', existsSync(abs(INDEX_REL)), INDEX_REL);
  if (failures) return finish(results, failures);

  const index = readJson(INDEX_REL);
  check('índice: contrato esperado', index.contract === 'sprint-25-rubrics-index-v1', index.contract);
  check(`índice: ${EXPECTED_RUBRICS} rúbricas declaradas`, Array.isArray(index.rubrics) && index.rubrics.length === EXPECTED_RUBRICS, `${index.rubrics?.length}`);
  check('índice: no activa producción', index.production?.is_production === false && index.production?.activates_production_gate === false);

  const dimensions = new Set();
  for (const entry of index.rubrics || []) {
    const ok = existsSync(abs(entry.file));
    check(`rúbrica existe: ${entry.id}`, ok, entry.file);
    if (!ok) continue;
    const rubric = readJson(entry.file);
    check(`rúbrica id coincide con índice: ${entry.id}`, rubric.id === entry.id, rubric.id);
    const errs = validateRubric(rubric);
    check(`rúbrica válida: ${entry.id}`, errs.length === 0, errs.join('; '));
    dimensions.add(entry.dimension);

    const text = readText(entry.file);
    check(`rúbrica sin secretos: ${entry.id}`, !SECRET_PATTERNS.some((re) => re.test(text)));
    check(`rúbrica sin activación de producción: ${entry.id}`, !PROD_PATTERNS.some((re) => re.test(text)));
  }

  const requiredDimensions = ['analisis-geopolitico', 'politica-energetica', 'validacion-fuentes', 'causalidad', 'uso-mapa', 'comunicacion'];
  for (const d of requiredDimensions) {
    check(`dimensión cubierta: ${d}`, dimensions.has(d));
  }

  return finish(results, failures);
}

function finish(results, failures) {
  const summary = {
    contract: 'sprint-25-rubrics-validation-v1',
    total: results.length,
    passed: results.filter((r) => r.ok).length,
    failed: failures,
    checks: results,
  };
  if (JSON_OUT) console.log(JSON.stringify(summary, null, 2));
  else console.log(`\n${failures === 0 ? 'OK' : 'FALLOS'}: ${summary.passed}/${summary.total} comprobaciones correctas.`);
  process.exit(failures === 0 ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
