// GEOPÓLEM (Sprint 26) — Motor de puntuación, export LMS, validación cruzada
// causal y paquetes docentes distribuibles.
// ---------------------------------------------------------------------------
// Cubre (sin DB ni navegador):
//   • SCORING: puntúa rúbricas reales, valida pesos/niveles/rangos, rechaza
//     evaluaciones con datos personales o criterios/niveles inválidos.
//   • LMS: manifiesto + Markdown + CSV portables, deterministas y al día.
//   • CROSSCHECK: matrices del banco ↔ causal_links del contrato v1; detecta
//     divergencias con severidad y no inventa datos.
//   • PAQUETES: curso corto y seminario ejecutivo completos y coherentes.
//   • GARANTÍAS: artefactos Sprint 26 sin secretos ni activación de producción.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { scoreRubric, validateEvaluation, findPIIKeys, sampleEvaluation, normalizeScores } from '../../scripts/score-rubric.mjs';
import { buildLmsManifest, buildLmsPackage, renderRubricsCsv } from '../../scripts/export-lms.mjs';
import { crosscheckAll, crosscheckMatrix, loadSourceLinks } from '../../scripts/validate-causal-crosscheck.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const abs = (rel) => resolve(REPO_ROOT, rel);
const readJson = (rel) => JSON.parse(readFileSync(abs(rel), 'utf8'));
const readText = (rel) => readFileSync(abs(rel), 'utf8');

const CAUSAL_RUBRIC = 'docs/education/rubrics/rubrica-causalidad.json';

/* ==================== 1) MOTOR DE PUNTUACIÓN =========================== */

test('scoring: total ponderado y % correctos para la rúbrica de causalidad', () => {
  const rubric = readJson(CAUSAL_RUBRIC);
  const evaluation = {
    contract: 'sprint-26-rubric-evaluation-v1',
    rubric_id: 'rubrica-causalidad',
    scores: { nodos: 'notable', enlaces: 'excelente', evidencia: 'suficiente', confianza: 'notable' },
  };
  const r = scoreRubric(rubric, evaluation);
  // 0.2*3 + 0.3*4 + 0.3*2 + 0.2*3 = 0.6+1.2+0.6+0.6 = 3.0
  assert.equal(r.total, 3);
  assert.equal(r.max_total, 4);
  assert.equal(r.min_total, 1);
  // (3-1)/(4-1)*100 = 66.67
  assert.equal(r.percentage, 66.67);
  assert.equal(r.overall_level, 'suficiente');
  assert.equal(r.production.is_production, false);
  assert.equal(r.criteria.length, 4);
});

test('scoring: nivel máximo en todos los criterios da 100% y banda excelente', () => {
  const rubric = readJson(CAUSAL_RUBRIC);
  const r = scoreRubric(rubric, sampleEvaluation(rubric, 'excelente'));
  assert.equal(r.total, r.max_total);
  assert.equal(r.percentage, 100);
  assert.equal(r.overall_level, 'excelente');
});

test('scoring: nivel mínimo en todos los criterios da 0% e insuficiente', () => {
  const rubric = readJson(CAUSAL_RUBRIC);
  const r = scoreRubric(rubric, sampleEvaluation(rubric, 'insuficiente'));
  assert.equal(r.percentage, 0);
  assert.equal(r.overall_level, 'insuficiente');
});

test('scoring: feedback propone el siguiente nivel salvo en el máximo', () => {
  const rubric = readJson(CAUSAL_RUBRIC);
  const r = scoreRubric(rubric, { scores: { nodos: 'notable', enlaces: 'excelente', evidencia: 'notable', confianza: 'notable' } });
  const enlaces = r.criteria.find((c) => c.id === 'enlaces');
  assert.match(enlaces.feedback, /máximo/i);
  const nodos = r.criteria.find((c) => c.id === 'nodos');
  assert.match(nodos.feedback, /avanzar/i);
});

test('scoring: rechaza evaluación con datos personales', () => {
  const rubric = readJson(CAUSAL_RUBRIC);
  const evaluation = { nombre_alumno: 'X', email: 'a@b.c', scores: { nodos: 'notable', enlaces: 'notable', evidencia: 'notable', confianza: 'notable' } };
  const errs = validateEvaluation(rubric, evaluation);
  assert.ok(errs.some((e) => /datos personales/i.test(e)));
  assert.throws(() => scoreRubric(rubric, evaluation), /evaluación inválida/);
});

test('scoring: findPIIKeys detecta claves anidadas', () => {
  const hits = findPIIKeys({ scores: {}, meta: { telefono: '600' }, alumno: { dni: 'x' } });
  assert.ok(hits.includes('meta.telefono'));
  assert.ok(hits.some((h) => h.includes('dni')));
});

test('scoring: detecta criterio faltante, desconocido y nivel inválido', () => {
  const rubric = readJson(CAUSAL_RUBRIC);
  const errs = validateEvaluation(rubric, { scores: { nodos: 'no-existe', desconocido: 'notable' } });
  assert.ok(errs.some((e) => /falta puntuación/i.test(e)));
  assert.ok(errs.some((e) => /desconocido/i.test(e)));
  assert.ok(errs.some((e) => /nivel inválido/i.test(e)));
});

test('scoring: normalizeScores admite objeto y array', () => {
  assert.deepEqual(normalizeScores({ a: 'x' }), { a: 'x' });
  assert.deepEqual(normalizeScores([{ criterion: 'a', level: 'x' }]), { a: 'x' });
});

test('scoring: todas las rúbricas del índice son puntuables', () => {
  for (const entry of readJson('docs/education/rubrics/rubrics.index.json').rubrics) {
    const rubric = readJson(entry.file);
    const r = scoreRubric(rubric, sampleEvaluation(rubric));
    assert.ok(r.percentage >= 0 && r.percentage <= 100, `${entry.id} % fuera de rango`);
    assert.ok(r.total <= r.max_total + 1e-9);
  }
});

/* ==================== 2) EXPORT LMS ==================================== */

test('lms: manifiesto declara módulos, casos y rúbricas', () => {
  const man = buildLmsManifest({ repoRoot: REPO_ROOT });
  assert.equal(man.contract, 'sprint-26-lms-manifest-v1');
  assert.equal(man.production.is_production, false);
  assert.ok(man.totals.modules >= 1);
  assert.ok(man.totals.cases >= 1);
  assert.equal(man.totals.rubrics, 6);
});

test('lms: el paquete es determinista (dos construcciones idénticas)', () => {
  const a = buildLmsPackage({ repoRoot: REPO_ROOT });
  const b = buildLmsPackage({ repoRoot: REPO_ROOT });
  assert.equal(JSON.stringify(a.manifest), JSON.stringify(b.manifest));
  assert.equal(a.markdown, b.markdown);
  assert.equal(a.csv, b.csv);
});

test('lms: CSV tiene cabecera y una fila por criterio×nivel', () => {
  const man = buildLmsManifest({ repoRoot: REPO_ROOT });
  const csv = renderRubricsCsv(man, { repoRoot: REPO_ROOT });
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], 'rubric_id,criterion_id,criterion_title,weight,level_id,level_points,descriptor');
  assert.ok(lines.length > 1);
});

test('lms: los ficheros escritos en disco están al día', () => {
  const pkg = buildLmsPackage({ repoRoot: REPO_ROOT });
  assert.equal(readText('docs/education/lms-export/lms.manifest.json'), `${JSON.stringify(pkg.manifest, null, 2)}\n`);
  assert.equal(readText('docs/education/lms-export/lms-package.md'), pkg.markdown);
  assert.equal(readText('docs/education/lms-export/rubrics.csv'), pkg.csv);
});

/* ==================== 3) VALIDACIÓN CRUZADA CAUSAL ===================== */

test('crosscheck: todas las matrices RC coinciden con la fuente (0 errores)', () => {
  const report = crosscheckAll({ repoRoot: REPO_ROOT, stage: 'rc' });
  assert.equal(report.totals.by_severity.error, 0, JSON.stringify(report.cases.filter((c) => c.divergences.some((d) => d.severity === 'error')), null, 2));
  assert.ok(report.totals.matrices >= 1);
});

test('crosscheck: detecta link_type divergente', () => {
  const source = loadSourceLinks('ukr-rus', 'rc', { repoRoot: REPO_ROOT });
  const matrix = readJson('docs/education/case-bank/matrices/ukr-rus.matrix.json');
  const mutated = structuredClone(matrix);
  mutated.links[0].link_type = 'causes-INVENTADO';
  const divs = crosscheckMatrix(mutated, source);
  assert.ok(divs.some((d) => d.code === 'link_type_mismatch' && d.severity === 'error'));
});

test('crosscheck: detecta enlace inventado y enlace faltante', () => {
  const source = loadSourceLinks('ukr-rus', 'rc', { repoRoot: REPO_ROOT });
  const matrix = readJson('docs/education/case-bank/matrices/ukr-rus.matrix.json');
  const mutated = structuredClone(matrix);
  mutated.links[0].title = 'Enlace que no existe en la fuente';
  const divs = crosscheckMatrix(mutated, source);
  assert.ok(divs.some((d) => d.code === 'link_not_in_source'));
  assert.ok(divs.some((d) => d.code === 'link_missing_in_matrix'));
});

test('crosscheck: conflicto ausente en la fuente es error', () => {
  const source = loadSourceLinks('__no-existe__', 'rc', { repoRoot: REPO_ROOT });
  const divs = crosscheckMatrix({ contract: 'sprint-25-causal-matrix-v1', conflict_id: '__no-existe__', links: [], nodes: [] }, source);
  assert.ok(divs.some((d) => d.code === 'conflict_missing_in_source' && d.severity === 'error'));
});

test('crosscheck: nodo sin respaldo en la fuente es warning', () => {
  const source = loadSourceLinks('ukr-rus', 'rc', { repoRoot: REPO_ROOT });
  const matrix = readJson('docs/education/case-bank/matrices/ukr-rus.matrix.json');
  const mutated = structuredClone(matrix);
  mutated.nodes.push({ id: 'nodo-fantasma', label: 'Fantasma', kind: 'actor_state' });
  const divs = crosscheckMatrix(mutated, source);
  assert.ok(divs.some((d) => d.code === 'node_without_source' && d.severity === 'warning'));
});

/* ==================== 4) PAQUETES DOCENTES ============================= */

test('paquetes: índice declara >=2 paquetes con contrato correcto', () => {
  const idx = readJson('docs/education/packages/packages.index.json');
  assert.equal(idx.contract, 'sprint-26-education-packages-v1');
  assert.ok(idx.packages.length >= 2);
  assert.ok(idx.packages.some((p) => p.id === 'curso-corto'));
  assert.ok(idx.packages.some((p) => p.id === 'seminario-ejecutivo'));
});

test('paquetes: cada paquete referencia ficheros existentes y coherentes', () => {
  const idx = readJson('docs/education/packages/packages.index.json');
  for (const p of idx.packages) {
    assert.ok(existsSync(abs(p.manifest)), `falta manifest ${p.id}`);
    const man = readJson(p.manifest);
    assert.equal(man.contract, 'sprint-26-education-package-v1');
    assert.equal(man.production.is_production, false);
    assert.ok(existsSync(abs(man.syllabus)), `${p.id}: syllabus`);
    assert.ok(existsSync(abs(man.lab_guide)), `${p.id}: lab_guide`);
    assert.ok(man.rubrics.length >= 1);
    for (const r of man.rubrics) assert.ok(existsSync(abs(r)), `${p.id}: rúbrica ${r}`);
    assert.ok(man.cases.length >= 1);
    for (const c of man.cases) {
      assert.ok(existsSync(abs(c.fiche)), `${p.id}: ficha ${c.fiche}`);
      assert.ok(existsSync(abs(c.matrix)), `${p.id}: matriz ${c.matrix}`);
    }
  }
});

/* ==================== 5) SIN SECRETOS / PRODUCCIÓN ===================== */

test('garantías: artefactos Sprint 26 sin secretos ni activación de producción', () => {
  const files = [
    'scripts/score-rubric.mjs',
    'scripts/export-lms.mjs',
    'scripts/validate-causal-crosscheck.mjs',
    'docs/education/rubrics/samples/evaluacion-ejemplo-causalidad.json',
    'docs/education/packages/packages.index.json',
    'docs/education/packages/curso-corto/package.manifest.json',
    'docs/education/packages/seminario-ejecutivo/package.manifest.json',
    'docs/education/lms-export/lms.manifest.json',
    'docs/education/lms-export/rubrics.csv',
  ];
  const SECRET = [/-----BEGIN[A-Z ]*PRIVATE KEY-----/, /AKIA[0-9A-Z]{16}/, /gh[pousr]_[0-9A-Za-z]{20,}/, /xox[baprs]-[0-9A-Za-z-]{10,}/];
  // is_production/activates_production_gate en TRUE (los valores false son legítimos).
  const PROD = [/"is_production"\s*:\s*true/, /activates_production_gate"\s*:\s*true/, /NODE_ENV\s*=\s*production/];
  for (const rel of files) {
    const text = readText(rel);
    for (const re of SECRET) assert.ok(!re.test(text), `secreto en ${rel}`);
    for (const re of PROD) assert.ok(!re.test(text), `activación de producción en ${rel}`);
  }
});
