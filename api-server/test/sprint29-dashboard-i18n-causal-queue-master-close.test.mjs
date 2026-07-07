// GEOPÓLEM (Sprint 29) — Panel docente agregado, i18n ampliada, cola editorial
// causal normalizada y preparación del cierre maestro Sprint 30.
// ---------------------------------------------------------------------------
// Cubre (sin DB ni navegador):
//   • DASHBOARD: panel AGREGADO no individualizado; compone analítica/i18n/causal;
//     no expone por-evaluación; RECHAZA PII sin copiar contenido; determinista.
//   • I18N-SCALE: manifiesto ampliado ES/EN al 100 % con nuevos namespaces; el
//     validador sigue siendo escalable y el default Sprint 28 no se rompe.
//   • CAUSAL-QUEUE: normaliza los backlogs Sprint 27/28 en una cola determinista
//     con estado/prioridad/acción/bloqueo/fuente/relación; no inventa datos.
//   • CLOSE-PREP: checklist técnico/educativo/editorial + riesgos abiertos; PREPARA
//     sin ejecutar cierre ni producción; señales en vivo deterministas.
//   • GARANTÍAS: artefactos Sprint 29 sin secretos ni activación de producción.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildTeacherDashboard, buildDashboardPackage } from '../../scripts/build-teacher-dashboard.mjs';
import { validateI18n } from '../../scripts/validate-i18n-coverage.mjs';
import { buildCausalQueue, buildQueuePackage } from '../../scripts/build-causal-queue.mjs';
import { buildClosePrep, buildClosePrepPackage } from '../../scripts/build-master-close-prep.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const abs = (rel) => resolve(REPO_ROOT, rel);
const readJson = (rel) => JSON.parse(readFileSync(abs(rel), 'utf8'));

const I18N_SPRINT29 = 'docs/education/i18n/i18n.sprint29.manifest.json';
const I18N_SPRINT29_CONTRACT = 'sprint-29-education-i18n-v1';

/* ==================== 1) PANEL DOCENTE AGREGADO ======================= */

test('dashboard: compone cohorte, i18n y estado causal agregados', () => {
  const d = buildTeacherDashboard({ repoRoot: REPO_ROOT });
  assert.equal(d.contract, 'sprint-29-education-teacher-dashboard-v1');
  assert.equal(d.production.is_production, false);
  assert.ok(d.cohort.submitted >= 5);
  assert.equal(d.cohort.valid, d.cohort.submitted - d.cohort.rejected);
  assert.ok(d.by_band.length >= 1);
  assert.equal(d.i18n.coverage_percentage, 100);
  assert.ok(d.causal.conflicts >= 10);
  assert.equal(typeof d.causal.queue_items, 'number');
});

test('dashboard: es AGREGADO (no expone resultados por evaluación)', () => {
  const pkg = buildDashboardPackage({ repoRoot: REPO_ROOT });
  assert.ok(!('results' in pkg.dashboard), 'el panel no debe exponer resultados por evaluación');
  assert.ok(!('items' in pkg.dashboard), 'el panel no debe exponer ítems por evaluación');
  assert.match(pkg.markdown, /Panel docente agregado/);
});

test('dashboard: RECHAZA PII y NO copia su contenido', () => {
  // Se apoya en la analítica, que rechaza PII; el panel no debe filtrarla nunca.
  const pkg = buildDashboardPackage({ repoRoot: REPO_ROOT });
  assert.ok(!JSON.stringify(pkg.dashboard).toLowerCase().includes('nombre'));
});

test('dashboard: artefactos escritos están al día (--check pasaría)', () => {
  const pkg = buildDashboardPackage({ repoRoot: REPO_ROOT });
  const onDisk = readJson('docs/education/dashboard/teacher-dashboard.json');
  assert.deepEqual(onDisk, pkg.dashboard);
});

test('dashboard: determinista (dos construcciones idénticas)', () => {
  const a = buildTeacherDashboard({ repoRoot: REPO_ROOT });
  const b = buildTeacherDashboard({ repoRoot: REPO_ROOT });
  assert.deepEqual(a, b);
});

/* ==================== 2) I18N AMPLIADA ES/EN ========================== */

test('i18n-scale: manifiesto ampliado cubre ES/EN al 100 % con nuevos namespaces', () => {
  const r = validateI18n({ repoRoot: REPO_ROOT, manifestRel: I18N_SPRINT29, expectedContract: I18N_SPRINT29_CONTRACT });
  assert.equal(r.contract, I18N_SPRINT29_CONTRACT);
  assert.equal(r.ok, true, `errores i18n: ${r.errors.join(' | ')}`);
  assert.equal(r.coverage_percentage, 100);
  const ids = r.namespaces.map((n) => n.id);
  assert.ok(ids.includes('syllabus'), 'debe incluir el namespace syllabus');
  assert.ok(ids.includes('dashboard'), 'debe incluir el namespace dashboard');
  assert.ok(ids.includes('instructor_guide') && ids.includes('feedback'));
});

test('i18n-scale: el default Sprint 28 sigue intacto (compatibilidad)', () => {
  const r = validateI18n({ repoRoot: REPO_ROOT });
  assert.equal(r.contract, 'sprint-28-education-i18n-v1');
  assert.equal(r.ok, true);
  assert.equal(r.coverage_percentage, 100);
});

/* ==================== 3) COLA EDITORIAL CAUSAL ======================= */

test('causal-queue: normaliza con esquema editorial estable y determinista', () => {
  const q = buildCausalQueue({ repoRoot: REPO_ROOT, stage: 'rc' });
  assert.equal(q.contract, 'sprint-29-causal-editorial-queue-v1');
  assert.equal(q.production.is_production, false);
  assert.equal(q.totals.items, q.items.length);
  for (const it of q.items) {
    assert.ok(/^Q-\d{3}$/.test(it.id));
    assert.ok(['P1', 'P2', 'P3'].includes(it.priority));
    assert.ok(['blocked', 'needs_source', 'needs_matrix', 'needs_review'].includes(it.editorial_status));
    assert.ok(['reconcile_matrix', 'build_matrix', 'add_source', 'complete_field', 'review'].includes(it.action_type));
    assert.equal(typeof it.blocking, 'boolean');
    assert.equal(typeof it.requires_source, 'boolean');
    assert.ok(it.conflict_id.length > 0);
  }
});

test('causal-queue: orden determinista por prioridad y bloqueantes = severidad error', () => {
  const q = buildCausalQueue({ repoRoot: REPO_ROOT, stage: 'rc' });
  const rank = { P1: 0, P2: 1, P3: 2 };
  for (let i = 1; i < q.items.length; i += 1) {
    assert.ok(rank[q.items[i - 1].priority] <= rank[q.items[i].priority]);
  }
  for (const it of q.items) assert.equal(it.blocking, it.severity === 'error');
  // Reconstrucción idéntica → determinista.
  assert.deepEqual(buildCausalQueue({ repoRoot: REPO_ROOT, stage: 'rc' }), q);
});

test('causal-queue: artefactos escritos están al día (--check pasaría)', () => {
  const pkg = buildQueuePackage({ repoRoot: REPO_ROOT, stage: 'rc' });
  const onDisk = readJson('docs/education/causal-queue/queue.json');
  assert.deepEqual(onDisk, pkg.queue);
  assert.match(pkg.markdown, /Cola editorial causal normalizada/);
});

/* ==================== 4) CIERRE MAESTRO SPRINT 30 ==================== */

test('close-prep: PREPARA sin ejecutar cierre ni producción', () => {
  const cp = buildClosePrep({ repoRoot: REPO_ROOT });
  assert.equal(cp.contract, 'sprint-29-master-close-prep-v1');
  assert.equal(cp.production.is_production, false);
  assert.equal(cp.production.activates_production_gate, false);
  assert.equal(cp.series.from_sprint, 3);
  assert.equal(cp.series.to_sprint, 30);
});

test('close-prep: checklist cubre técnico/educativo/editorial', () => {
  const cp = buildClosePrep({ repoRoot: REPO_ROOT });
  const areas = new Set(cp.checklist.map((c) => c.area));
  assert.ok(areas.has('technical') && areas.has('educational') && areas.has('editorial'));
  assert.ok(cp.checklist.length >= 6);
});

test('close-prep: registra los riesgos abiertos heredados', () => {
  const cp = buildClosePrep({ repoRoot: REPO_ROOT });
  const ids = cp.risks.map((r) => r.id);
  for (const req of ['pr-chain', 'pr28-vs-main', 'production-blocked', 'canonical-causal-links', 'scorm-real', 'i18n-incomplete', 'human-curation']) {
    assert.ok(ids.includes(req), `falta el riesgo ${req}`);
  }
  // El riesgo canónico está declarado y no marcado como cerrado.
  const canon = cp.risks.find((r) => r.id === 'canonical-causal-links');
  assert.equal(canon.status, 'open');
});

test('close-prep: artefactos escritos están al día (--check pasaría)', () => {
  const pkg = buildClosePrepPackage({ repoRoot: REPO_ROOT });
  const onDisk = readJson('docs/education/close-prep/sprint-30-close-checklist.json');
  assert.deepEqual(onDisk, pkg.closePrep);
});

/* ==================== 5) GARANTÍAS TRANSVERSALES ===================== */

test('garantías: los artefactos Sprint 29 no activan producción ni secretos', () => {
  const arts = [
    'docs/education/dashboard/teacher-dashboard.json',
    'docs/education/causal-queue/queue.json',
    'docs/education/close-prep/sprint-30-close-checklist.json',
    'docs/education/i18n/i18n.sprint29.manifest.json',
    'docs/education/education.sprint29.manifest.json',
  ];
  for (const rel of arts) {
    const j = readJson(rel);
    assert.equal(j.production.is_production, false, rel);
    assert.equal(j.production.activates_production_gate, false, rel);
    assert.equal(j.production.contains_secrets, false, rel);
  }
});
