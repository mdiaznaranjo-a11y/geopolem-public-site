// GEOPÓLEM (Sprint 28) — Analítica pedagógica agregada, i18n ES/EN, cross-check
// causal ampliado y decisión SCORM vs mapping portable.
// ---------------------------------------------------------------------------
// Cubre (sin DB ni navegador):
//   • ANALÍTICA: agrega bandas/medias/medianas y criterios débiles/fuertes de
//     evaluaciones ANÓNIMAS; RECHAZA PII sin copiar contenido; salida agregada.
//   • I18N: cobertura ES/EN completa por namespace; detecta claves faltantes.
//   • CAUSAL-SCALE: enumera TODOS los conflictos del contrato; clasifica en
//     checked/divergent/pending_matrix/not_applicable sin inventar relaciones.
//   • ADR: frontmatter y secciones requeridas; sin producción; decisión portable.
//   • GARANTÍAS: artefactos Sprint 28 sin secretos ni activación de producción.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeCohort, median, buildAnalyticsPackage } from '../../scripts/education-analytics.mjs';
import { loadEvaluations, loadRubricsById } from '../../scripts/score-rubric-batch.mjs';
import { validateI18n, diffNamespace, flattenKeys } from '../../scripts/validate-i18n-coverage.mjs';
import { crosscheckScale, listConflictIds, classifyConflict, buildScaleBacklog } from '../../scripts/causal-crosscheck-scale.mjs';
import { validateAllAdrs, validateAdr } from '../../scripts/validate-adr.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const abs = (rel) => resolve(REPO_ROOT, rel);
const readJson = (rel) => JSON.parse(readFileSync(abs(rel), 'utf8'));
const FIXTURES_DIR = 'docs/education/batch/fixtures';

/* ==================== 1) ANALÍTICA PEDAGÓGICA ========================== */

test('analytics: agrega bandas, medias y medianas de fixtures sintéticos', () => {
  const evals = loadEvaluations(FIXTURES_DIR, { repoRoot: REPO_ROOT });
  const rubrics = loadRubricsById({ repoRoot: REPO_ROOT });
  const r = analyzeCohort(evals, rubrics);
  assert.equal(r.contract, 'sprint-28-education-analytics-v1');
  assert.ok(r.totals.submitted >= 5);
  assert.equal(r.totals.valid, r.totals.submitted - r.totals.rejected);
  assert.equal(r.production.is_production, false);
  assert.ok(r.by_band.length >= 1);
  // Los porcentajes de banda suman ~100.
  const sumPct = r.by_band.reduce((s, b) => s + b.percentage, 0);
  assert.ok(Math.abs(sumPct - 100) < 0.5);
  // Débiles/fuertes ordenados por normalizado.
  assert.ok(r.weakest_criteria.length >= 1);
  assert.ok(r.strongest_criteria[0].normalized >= r.weakest_criteria[0].normalized);
});

test('analytics: median() es determinista para par/impar', () => {
  assert.equal(median([]), 0);
  assert.equal(median([5]), 5);
  assert.equal(median([1, 3]), 2);
  assert.equal(median([3, 1, 2]), 2);
});

test('analytics: RECHAZA evaluación con PII y NO copia su contenido', () => {
  const evals = [
    { id: 'con-pii', payload: { rubric_id: 'rubrica-causalidad', nombre: 'Ada', scores: { nodos: 'notable', enlaces: 'notable', evidencia: 'notable', confianza: 'notable' } } },
  ];
  const rubrics = loadRubricsById({ repoRoot: REPO_ROOT });
  const r = analyzeCohort(evals, rubrics);
  assert.equal(r.totals.rejected, 1);
  assert.equal(r.totals.valid, 0);
  const reason = r.reject_reasons.find((x) => x.reason === 'pii');
  assert.ok(reason && reason.count === 1);
  // El contenido PII no aparece en ninguna parte del informe.
  assert.ok(!JSON.stringify(r).includes('Ada'));
});

test('analytics: la salida es agregada (no incluye por-evaluación identificable)', () => {
  const pkg = buildAnalyticsPackage({ repoRoot: REPO_ROOT });
  assert.ok(!('results' in pkg.report), 'la analítica no debe exponer resultados por evaluación');
  assert.match(pkg.markdown, /Analítica pedagógica agregada/);
});

test('analytics: artefactos escritos están al día (--check pasaría)', () => {
  const pkg = buildAnalyticsPackage({ repoRoot: REPO_ROOT });
  const onDisk = readJson('docs/education/analytics/analytics-report.json');
  assert.deepEqual(onDisk, pkg.report);
});

/* ==================== 2) I18N ES/EN ==================================== */

test('i18n: cobertura completa ES/EN y sin errores', () => {
  const r = validateI18n({ repoRoot: REPO_ROOT });
  assert.equal(r.contract, 'sprint-28-education-i18n-v1');
  assert.equal(r.ok, true, `errores i18n: ${r.errors.join(' | ')}`);
  assert.equal(r.coverage_percentage, 100);
  assert.equal(r.base_locale, 'es');
  assert.ok(r.target_locales.includes('en'));
});

test('i18n: diffNamespace detecta faltantes, sobrantes y vacíos', () => {
  const base = { a: '1', grp: { b: '2', c: '3' } };
  const target = { a: 'x', grp: { b: '', d: '4' } };
  const d = diffNamespace(base, target);
  assert.deepEqual(d.missing, ['grp.c']);
  assert.deepEqual(d.extra, ['grp.d']);
  assert.deepEqual(d.empty, ['grp.b']);
});

test('i18n: flattenKeys ignora metadatos locale/namespace', () => {
  const flat = flattenKeys({ locale: 'es', namespace: 'x', terms: { k: { term: 'T', definition: 'D' } } });
  assert.deepEqual(Object.keys(flat).sort(), ['terms.k.definition', 'terms.k.term']);
});

/* ==================== 3) CROSS-CHECK CAUSAL AMPLIADO =================== */

test('causal-scale: enumera todos los conflictos del contrato (rc)', () => {
  const ids = listConflictIds('rc', { repoRoot: REPO_ROOT });
  assert.ok(ids.length >= 10);
  // Determinista y sin 'active'.
  assert.deepEqual(ids, [...ids].sort());
  assert.ok(!ids.includes('active'));
});

test('causal-scale: en rc todas las matrices existentes quedan checked', () => {
  const report = crosscheckScale({ repoRoot: REPO_ROOT, stage: 'rc' });
  assert.equal(report.contract, 'sprint-28-causal-crosscheck-scale-v1');
  assert.equal(report.production.is_production, false);
  assert.equal(report.totals.by_status.divergent, 0);
  assert.ok(report.totals.by_status.checked >= 10);
});

test('causal-scale: conflicto inexistente => not_applicable, sin inventar', () => {
  const c = classifyConflict('conflicto-que-no-existe', 'rc', { repoRoot: REPO_ROOT });
  assert.equal(c.status, 'not_applicable');
  assert.equal(c.has_matrix, false);
  assert.equal(c.source_links, 0);
  assert.equal(c.divergences.length, 0);
});

test('causal-scale: backlog sólo recoge divergent/pending_matrix', () => {
  const report = crosscheckScale({ repoRoot: REPO_ROOT, stage: 'rc' });
  const backlog = buildScaleBacklog(report);
  for (const it of backlog.items) assert.ok(['divergent', 'pending_matrix'].includes(it.status));
  assert.equal(backlog.total_items, backlog.items.length);
});

/* ==================== 4) ADR SCORM vs PORTABLE ======================== */

test('adr: el registro de ADRs es válido y sin producción', () => {
  const r = validateAllAdrs({ repoRoot: REPO_ROOT });
  assert.equal(r.contract, 'sprint-28-education-adr-v1');
  assert.equal(r.ok, true, `errores ADR: ${JSON.stringify(r.results)}`);
  assert.ok(r.totals.adrs >= 1);
});

test('adr: ADR-0001 decide mapping portable', () => {
  const r = validateAllAdrs({ repoRoot: REPO_ROOT });
  const adr = r.results.find((x) => x.id === 'ADR-0001');
  assert.ok(adr);
  assert.equal(adr.decision, 'portable-mapping');
  assert.equal(adr.status, 'accepted');
});

test('adr: validateAdr exige secciones y production=false', () => {
  const bad = '---\nid: ADR-9\ntitle: x\nstatus: accepted\ndate: 2026-01-01\ndecision: y\n---\n\n## Estado\n';
  const { errors } = validateAdr(bad);
  assert.ok(errors.some((e) => /production/.test(e)));
  assert.ok(errors.some((e) => /Contexto/.test(e)));
});

/* ==================== 5) GARANTÍAS TRANSVERSALES ====================== */

test('garantías: los artefactos Sprint 28 no activan producción ni secretos', () => {
  const arts = [
    'docs/education/analytics/analytics-report.json',
    'docs/education/causal-scale/crosscheck-scale.json',
    'docs/education/causal-scale/crosscheck-scale.backlog.json',
    'docs/education/i18n/i18n.manifest.json',
  ];
  for (const rel of arts) {
    const j = readJson(rel);
    assert.equal(j.production.is_production, false, rel);
    assert.equal(j.production.activates_production_gate, false, rel);
    assert.equal(j.production.contains_secrets, false, rel);
  }
});
