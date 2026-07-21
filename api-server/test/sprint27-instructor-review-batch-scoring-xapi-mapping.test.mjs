// GEOPÓLEM (Sprint 27) — Revisión de instructor, scoring por lotes, plantillas
// de feedback, backlog causal accionable y mapeo opcional xAPI/SCORM.
// ---------------------------------------------------------------------------
// Cubre (sin DB ni navegador):
//   • BATCH: puntúa varias evaluaciones anónimas reutilizando el motor Sprint 26;
//     agrega bandas/medias; RECHAZA PII y payloads inválidos sin copiar contenido.
//   • FEEDBACK: plantilla por banda y nivel; render integrado con la puntuación.
//   • BACKLOG: derivado determinísticamente de crosscheck + campos pending;
//     no inventa divergencias causales.
//   • XAPI/SCORM: mapeo opcional, portable y coherente con el manifiesto LMS.
//   • REVISIÓN INSTRUCTOR: documentos con secciones requeridas.
//   • GARANTÍAS: artefactos Sprint 27 sin secretos ni activación de producción.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { scoreBatch, loadEvaluations, loadRubricsById, buildBatchPackage, renderBatchCsv } from '../../scripts/score-rubric-batch.mjs';
import { buildFeedback, renderFeedback, loadFeedbackTemplate } from '../../scripts/render-feedback.mjs';
import { scoreRubric, sampleEvaluation } from '../../scripts/score-rubric.mjs';
import { buildCausalBacklog, buildBacklogPackage } from '../../scripts/build-causal-backlog.mjs';
import { crosscheckAll } from '../../scripts/validate-causal-crosscheck.mjs';
import { loadMapping, validateMapping } from '../../scripts/xapi-scorm-mapping.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const abs = (rel) => resolve(REPO_ROOT, rel);
const readJson = (rel) => JSON.parse(readFileSync(abs(rel), 'utf8'));
const readText = (rel) => readFileSync(abs(rel), 'utf8');

const CAUSAL_RUBRIC = 'docs/education/rubrics/rubrica-causalidad.json';
const FIXTURES_DIR = 'docs/education/batch/fixtures';

/* ==================== 1) SCORING POR LOTES ============================= */

test('batch: agrega puntuaciones de los fixtures sintéticos', () => {
  const evals = loadEvaluations(FIXTURES_DIR, { repoRoot: REPO_ROOT });
  const rubrics = loadRubricsById({ repoRoot: REPO_ROOT });
  const report = scoreBatch(evals, rubrics);
  assert.equal(report.contract, 'sprint-27-batch-scoring-v1');
  assert.ok(report.totals.submitted >= 5);
  assert.equal(report.totals.scored, report.totals.submitted - report.totals.rejected);
  assert.equal(report.production.is_production, false);
  assert.ok(report.by_rubric.length >= 1);
  // Media por rúbrica dentro de rango.
  for (const r of report.by_rubric) assert.ok(r.mean_percentage >= 0 && r.mean_percentage <= 100);
});

test('batch: RECHAZA evaluación con PII y no copia su contenido', () => {
  const evals = [
    { id: 'con-pii', payload: { rubric_id: 'rubrica-causalidad', email: 'a@b.c', scores: { nodos: 'notable', enlaces: 'notable', evidencia: 'notable', confianza: 'notable' } } },
  ];
  const rubrics = loadRubricsById({ repoRoot: REPO_ROOT });
  const report = scoreBatch(evals, rubrics);
  assert.equal(report.totals.scored, 0);
  assert.equal(report.totals.rejected, 1);
  assert.equal(report.rejected[0].reason, 'pii');
  // El contenido personal NO aparece en la salida serializada.
  assert.ok(!JSON.stringify(report).includes('a@b.c'));
});

test('batch: rechaza rubric_id desconocido y evaluación inválida', () => {
  const rubrics = loadRubricsById({ repoRoot: REPO_ROOT });
  const report = scoreBatch([
    { id: 'sin-rubrica', payload: { rubric_id: 'no-existe', scores: {} } },
    { id: 'nivel-malo', payload: { rubric_id: 'rubrica-causalidad', scores: { nodos: 'no-existe', enlaces: 'notable', evidencia: 'notable', confianza: 'notable' } } },
  ], rubrics);
  assert.equal(report.totals.scored, 0);
  assert.ok(report.rejected.some((r) => r.reason === 'rubric_not_found'));
  assert.ok(report.rejected.some((r) => r.reason === 'invalid'));
});

test('batch: es determinista y el informe en disco está al día', () => {
  const a = buildBatchPackage({ repoRoot: REPO_ROOT, dir: FIXTURES_DIR });
  const b = buildBatchPackage({ repoRoot: REPO_ROOT, dir: FIXTURES_DIR });
  assert.equal(JSON.stringify(a.report), JSON.stringify(b.report));
  assert.equal(readText('docs/education/batch/batch-report.json'), `${JSON.stringify(a.report, null, 2)}\n`);
  assert.equal(readText('docs/education/batch/batch-report.md'), a.markdown);
  assert.equal(readText('docs/education/batch/batch-report.csv'), a.csv);
});

test('batch: CSV tiene cabecera y una fila por evaluación puntuada', () => {
  const pkg = buildBatchPackage({ repoRoot: REPO_ROOT, dir: FIXTURES_DIR });
  const lines = renderBatchCsv(pkg.report).trim().split('\n');
  assert.equal(lines[0], 'id,rubric_id,total,max_total,percentage,overall_level');
  assert.equal(lines.length - 1, pkg.report.results.length);
});

test('batch: fixtures en disco son anónimos (sin PII)', () => {
  const evals = loadEvaluations(FIXTURES_DIR, { repoRoot: REPO_ROOT });
  const rubrics = loadRubricsById({ repoRoot: REPO_ROOT });
  const report = scoreBatch(evals, rubrics);
  assert.ok(report.rejected.every((r) => r.reason !== 'pii'), 'ningún fixture debe tener PII');
  assert.ok(report.totals.submitted > 0);
});

/* ==================== 2) PLANTILLAS DE FEEDBACK ======================== */

test('feedback: plantilla cubre 4 bandas y 4 niveles', () => {
  const tpl = loadFeedbackTemplate({ repoRoot: REPO_ROOT });
  assert.equal(tpl.contract, 'sprint-27-feedback-template-v1');
  for (const b of ['insuficiente', 'suficiente', 'notable', 'excelente']) {
    assert.ok(tpl.bands[b] && tpl.bands[b].recommendation, `banda ${b}`);
    assert.ok(tpl.level_recommendations[b], `nivel ${b}`);
  }
});

test('feedback: integra la puntuación (banda global + recomendación por criterio)', () => {
  const rubric = readJson(CAUSAL_RUBRIC);
  const tpl = loadFeedbackTemplate({ repoRoot: REPO_ROOT });
  const evaluation = { rubric_id: 'rubrica-causalidad', scores: { nodos: 'notable', enlaces: 'excelente', evidencia: 'suficiente', confianza: 'notable' } };
  const fb = buildFeedback(scoreRubric(rubric, evaluation), tpl);
  assert.equal(fb.overall_level, 'suficiente');
  assert.equal(fb.band_recommendation, tpl.bands.suficiente.recommendation);
  const evidencia = fb.criteria.find((c) => c.id === 'evidencia');
  assert.equal(evidencia.level_recommendation, tpl.level_recommendations.suficiente);
});

test('feedback: render Markdown contiene secciones esperadas', () => {
  const rubric = readJson(CAUSAL_RUBRIC);
  const tpl = loadFeedbackTemplate({ repoRoot: REPO_ROOT });
  const md = renderFeedback(rubric, sampleEvaluation(rubric, 'excelente'), tpl);
  assert.match(md, /Banda global/);
  assert.match(md, /Por criterio/);
  assert.match(md, /excelente/);
});

/* ==================== 3) BACKLOG CAUSAL ================================ */

test('backlog: derivado del crosscheck sin inventar divergencias', () => {
  const backlog = buildCausalBacklog({ repoRoot: REPO_ROOT, stage: 'rc' });
  const cross = crosscheckAll({ repoRoot: REPO_ROOT, stage: 'rc' });
  const crossItems = backlog.items.filter((i) => i.source === 'crosscheck').length;
  assert.equal(crossItems, cross.totals.divergences);
  assert.equal(backlog.contract, 'sprint-27-causal-backlog-v1');
  assert.equal(backlog.production.is_production, false);
});

test('backlog: los campos pending del banco son ítems de estado pendiente', () => {
  const backlog = buildCausalBacklog({ repoRoot: REPO_ROOT, stage: 'rc' });
  const pend = backlog.items.filter((i) => i.source === 'case_bank');
  assert.ok(pend.length >= 1);
  for (const it of pend) {
    assert.equal(it.warning_type, 'pending_field');
    assert.equal(it.status, 'pendiente');
    assert.match(it.recommended_action, /no inferir sin evidencia/i);
  }
});

test('backlog: cada ítem tiene acción, responsable y estado', () => {
  const backlog = buildCausalBacklog({ repoRoot: REPO_ROOT, stage: 'rc' });
  for (const it of backlog.items) {
    assert.ok(it.case && it.warning_type && it.severity);
    assert.ok(it.recommended_action && it.suggested_owner && it.status);
  }
});

test('backlog: determinista y al día en disco', () => {
  const a = buildBacklogPackage({ repoRoot: REPO_ROOT, stage: 'rc' });
  const b = buildBacklogPackage({ repoRoot: REPO_ROOT, stage: 'rc' });
  assert.equal(JSON.stringify(a.backlog), JSON.stringify(b.backlog));
  assert.equal(readText('docs/education/causal-backlog/backlog.json'), `${JSON.stringify(a.backlog, null, 2)}\n`);
  assert.equal(readText('docs/education/causal-backlog/backlog.md'), a.markdown);
});

/* ==================== 4) MAPEO xAPI/SCORM ============================== */

test('xapi: mapeo declarado opcional y portable', () => {
  const mapping = loadMapping({ repoRoot: REPO_ROOT });
  assert.equal(mapping.contract, 'sprint-27-xapi-scorm-mapping-v1');
  assert.equal(mapping.optional, true);
  assert.equal(mapping.platform_independent, true);
  assert.equal(mapping.identity.actor_policy, 'anonymous');
});

test('xapi: validación coherente con el manifiesto LMS real', () => {
  const mapping = loadMapping({ repoRoot: REPO_ROOT });
  const lms = readJson('docs/education/lms-export/lms.manifest.json');
  assert.deepEqual(validateMapping(mapping, lms), []);
});

test('xapi: detecta source_concept inexistente en el manifiesto', () => {
  const mapping = loadMapping({ repoRoot: REPO_ROOT });
  const lms = readJson('docs/education/lms-export/lms.manifest.json');
  const mutated = structuredClone(mapping);
  mutated.xapi.mappings[0].source_concept = 'concepto-inventado';
  const errs = validateMapping(mutated, lms);
  assert.ok(errs.some((e) => /concepto-inventado/.test(e)));
});

test('xapi: exige política de actor anónima', () => {
  const mapping = loadMapping({ repoRoot: REPO_ROOT });
  const lms = readJson('docs/education/lms-export/lms.manifest.json');
  const mutated = structuredClone(mapping);
  mutated.identity.actor_policy = 'email';
  const errs = validateMapping(mutated, lms);
  assert.ok(errs.some((e) => /anonymous/.test(e)));
});

/* ==================== 5) PAQUETE DE REVISIÓN DE INSTRUCTOR ============= */

test('instructor-review: manifiesto y documentos con secciones requeridas', () => {
  const ir = readJson('docs/education/instructor-review/instructor-review.manifest.json');
  assert.equal(ir.contract, 'sprint-27-instructor-review-v1');
  assert.ok(existsSync(abs(ir.index_file)));
  const headingSet = (text) => new Set(text.split('\n').filter((l) => /^#{1,6}\s/.test(l)).map((l) => l.replace(/^#{1,6}\s+/, '').trim()));
  for (const d of ir.documents) {
    assert.ok(existsSync(abs(d.file)), `falta ${d.id}`);
    const headings = headingSet(readText(d.file));
    for (const s of d.required_sections) assert.ok(headings.has(s), `${d.id}: falta sección ${s}`);
  }
});

/* ==================== 6) SIN SECRETOS / PRODUCCIÓN ===================== */

test('garantías: artefactos Sprint 27 sin secretos ni activación de producción', () => {
  const files = [
    'scripts/score-rubric-batch.mjs',
    'scripts/render-feedback.mjs',
    'scripts/build-causal-backlog.mjs',
    'scripts/xapi-scorm-mapping.mjs',
    'docs/education/education.sprint27.manifest.json',
    'docs/education/feedback-templates/feedback.template.json',
    'docs/education/causal-backlog/backlog.json',
    'docs/education/xapi-scorm-mapping/mapping.json',
    'docs/education/batch/batch-report.json',
    'docs/education/batch/batch-report.csv',
  ];
  const SECRET = [/-----BEGIN[A-Z ]*PRIVATE KEY-----/, /AKIA[0-9A-Z]{16}/, /gh[pousr]_[0-9A-Za-z]{20,}/, /xox[baprs]-[0-9A-Za-z-]{10,}/];
  const PROD = [/"is_production"\s*:\s*true/, /activates_production_gate"\s*:\s*true/, /NODE_ENV\s*=\s*production/];
  for (const rel of files) {
    const text = readText(rel);
    for (const re of SECRET) assert.ok(!re.test(text), `secreto en ${rel}`);
    for (const re of PROD) assert.ok(!re.test(text), `activación de producción en ${rel}`);
  }
});
