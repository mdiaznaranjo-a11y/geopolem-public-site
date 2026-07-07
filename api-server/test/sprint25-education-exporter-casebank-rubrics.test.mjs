// GEOPÓLEM (Sprint 25) — Exportador de fichas, banco de casos, laboratorio
// offline y rúbricas máquina-legibles.
// ---------------------------------------------------------------------------
// Cubre las garantías del sprint (sin DB ni navegador):
//   • EXPORTADOR: construye fichas desde el contrato v1, marca campos ausentes
//     como pending y NO inventa datos; incluye actividades y preguntas docentes.
//   • BANCO DE CASOS: selecciona casos seguros (fuente verificada), genera
//     matrices causales pre-rellenadas y un índice coherente y determinista.
//   • LABORATORIO OFFLINE: guía existe y se alinea con deep-links/filtros/PWA.
//   • RÚBRICAS: 6 rúbricas válidas (pesos suman 1.0, descriptor por nivel); el
//     validador detecta rúbricas mal formadas.
//   • INTEGRACIÓN: education:validate y el validador de rúbricas salen con 0.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildFiche, exportFiche, loadConflict, STAGES } from '../../scripts/export-education-fiches.mjs';
import { buildCausalMatrix, buildCaseBank, safeConflictIds } from '../../scripts/build-case-bank.mjs';
import { validateRubric } from '../../scripts/validate-education-rubrics.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const abs = (rel) => resolve(REPO_ROOT, rel);
const readJson = (rel) => JSON.parse(readFileSync(abs(rel), 'utf8'));
const readText = (rel) => readFileSync(abs(rel), 'utf8');

/* ==================== 1) EXPORTADOR ==================================== */

test('exportador: stages soportados', () => {
  assert.deepEqual(STAGES, ['canonical', 'staging', 'rc']);
});

test('exportador: ficha desde RC tiene todos los campos y datos reales', () => {
  const { fiche, found } = exportFiche('red-sea', 'rc', { repoRoot: REPO_ROOT });
  assert.ok(found);
  for (const f of ['title', 'region', 'actors', 'resources', 'chokepoints', 'causal_links', 'sources', 'activities', 'teaching_questions', 'pending_fields']) {
    assert.ok(f in fiche, `falta campo ${f}`);
  }
  assert.equal(fiche.conflict_id, 'red-sea');
  assert.equal(fiche.contract, 'sprint-25-education-fiche-v1');
  // No inventa: el título coincide con el dato de la fuente.
  const raw = loadConflict('red-sea', 'rc', { repoRoot: REPO_ROOT }).conflict;
  assert.equal(fiche.title, raw.name);
  assert.ok(fiche.sources.length >= 1);
  assert.equal(fiche.production.is_production, false);
});

test('exportador: marca campos faltantes como pending (canonical vacío)', () => {
  const { fiche } = exportFiche('red-sea', 'canonical', { repoRoot: REPO_ROOT });
  // El detalle canónico tiene arrays vacíos → deben aparecer como pendientes.
  assert.ok(fiche.pending_fields.includes('actors'));
  assert.ok(fiche.pending_fields.includes('sources'));
  assert.ok(fiche.pending_fields.includes('causal_links'));
});

test('exportador: conflicto inexistente produce ficha pendiente sin lanzar', () => {
  const { fiche, found } = exportFiche('__no-existe__', 'rc', { repoRoot: REPO_ROOT });
  assert.equal(found, false);
  assert.equal(fiche.title, null);
  assert.ok(fiche.pending_fields.length > 0);
  assert.ok(Array.isArray(fiche.teaching_questions) && fiche.teaching_questions.length > 0);
});

test('exportador: buildFiche es puro y no fabrica actores', () => {
  const fiche = buildFiche({ id: 'x', name: 'X', actors: { state: [], non_state: [] } }, { id: 'x', stage: 'rc' });
  assert.equal(fiche.actors.state.length, 0);
  assert.ok(fiche.pending_fields.includes('actors'));
});

/* ==================== 2) BANCO DE CASOS =============================== */

test('banco de casos: sólo casos con fuente verificada', () => {
  const ids = safeConflictIds({ repoRoot: REPO_ROOT });
  assert.ok(ids.length >= 2);
  const rc = readJson('api/v1/conflicts.verified.enriched.json').data;
  for (const id of ids) {
    assert.ok((rc[id].sources || []).some((s) => s.verification === 'verified' && s.demo !== true), id);
  }
});

test('banco de casos: matriz causal pre-rellenada desde causal_links', () => {
  const { fiche } = exportFiche('red-sea', 'rc', { repoRoot: REPO_ROOT });
  const m = buildCausalMatrix(fiche);
  assert.equal(m.contract, 'sprint-25-causal-matrix-v1');
  assert.ok(m.links.length >= 1);
  // La evidencia de la matriz procede del dato real (explanation del enlace).
  assert.equal(m.links[0].evidence, fiche.causal_links[0].explanation);
  // El nivel de confianza no existe en el contrato v1 → pendiente.
  assert.equal(m.links[0].confidence, null);
  assert.ok(m.pending_fields.includes('confidence'));
  // Los nodos derivan de entidades reales.
  const names = m.nodes.map((n) => n.label);
  assert.ok(names.includes('Bab el-Mandeb'));
});

test('banco de casos: índice coherente y determinista', () => {
  const a = buildCaseBank({ repoRoot: REPO_ROOT }).index;
  const b = buildCaseBank({ repoRoot: REPO_ROOT }).index;
  const norm = (o) => JSON.stringify({ ...o, generated_at: null });
  assert.equal(norm(a), norm(b));
  assert.equal(a.contract, 'sprint-25-case-bank-v1');
  assert.ok(a.cases.length >= 2);
  const inventoryIds = new Set(readJson('data/conflicts.inventory.json').conflicts.map((c) => c.id));
  for (const c of a.cases) assert.ok(inventoryIds.has(c.id), `id inexistente ${c.id}`);
});

test('banco de casos: artefactos escritos existen en disco', () => {
  const idx = readJson('docs/education/case-bank/case-bank.index.json');
  assert.ok(idx.cases.length >= 2);
  for (const c of idx.cases) {
    assert.ok(existsSync(abs(c.fiche_md)), c.fiche_md);
    assert.ok(existsSync(abs(c.fiche_json)), c.fiche_json);
    assert.ok(existsSync(abs(c.matrix_json)), c.matrix_json);
  }
});

/* ==================== 3) LABORATORIO OFFLINE ========================== */

test('laboratorio offline: existe y se alinea con deep-links/filtros/PWA', () => {
  const rel = 'docs/education/formatos/cuaderno-laboratorio-mapa-offline.md';
  assert.ok(existsSync(abs(rel)));
  const text = readText(rel);
  assert.match(text, /Advertencia editorial/i);
  assert.match(text, /deep-link/i);
  assert.match(text, /offline/i);
  assert.match(text, /PWA/i);
  for (const mod of ['deeplinks.mjs', 'public-enriched.mjs', 'service-worker.js']) {
    assert.ok(text.includes(mod), `falta referencia a ${mod}`);
  }
});

/* ==================== 4) RÚBRICAS ===================================== */

test('rúbricas: índice declara 6 rúbricas y todas son válidas', () => {
  const idx = readJson('docs/education/rubrics/rubrics.index.json');
  assert.equal(idx.rubrics.length, 6);
  for (const entry of idx.rubrics) {
    assert.ok(existsSync(abs(entry.file)), entry.file);
    const errs = validateRubric(readJson(entry.file));
    assert.equal(errs.length, 0, `${entry.id}: ${errs.join('; ')}`);
  }
});

test('rúbricas: el validador detecta pesos que no suman 1.0', () => {
  const bad = {
    contract: 'sprint-25-rubric-v1',
    id: 'bad',
    title: 'bad',
    scale: { levels: [{ id: 'a', label: 'A', points: 1 }, { id: 'b', label: 'B', points: 2 }] },
    criteria: [
      { id: 'c1', title: 'c1', weight: 0.5, descriptors: { a: 'x', b: 'y' } },
      { id: 'c2', title: 'c2', weight: 0.2, descriptors: { a: 'x', b: 'y' } },
    ],
  };
  const errs = validateRubric(bad);
  assert.ok(errs.some((e) => /ponderaciones suman/.test(e)), errs.join('; '));
});

test('rúbricas: el validador detecta descriptor de nivel ausente', () => {
  const bad = {
    contract: 'sprint-25-rubric-v1',
    id: 'bad2',
    title: 'bad2',
    scale: { levels: [{ id: 'a', label: 'A', points: 1 }, { id: 'b', label: 'B', points: 2 }] },
    criteria: [{ id: 'c1', title: 'c1', weight: 1.0, descriptors: { a: 'x' } }],
  };
  const errs = validateRubric(bad);
  assert.ok(errs.some((e) => /falta descriptor/.test(e)), errs.join('; '));
});

/* ==================== 5) INTEGRACIÓN (exit 0) ======================== */

test('validate-education-materials.mjs: exit 0 e incluye checks Sprint 25', () => {
  const out = execFileSync('node', ['scripts/validate-education-materials.mjs', '--json'], { cwd: REPO_ROOT, encoding: 'utf8' });
  const summary = JSON.parse(out);
  assert.equal(summary.failed, 0, `fallos: ${summary.failed}`);
  assert.ok(summary.checks.some((c) => c.name.startsWith('sprint25:')), 'faltan checks sprint25');
  assert.ok(summary.passed >= 70);
});

test('validate-education-rubrics.mjs: exit 0 sin fallos', () => {
  const out = execFileSync('node', ['scripts/validate-education-rubrics.mjs', '--json'], { cwd: REPO_ROOT, encoding: 'utf8' });
  const summary = JSON.parse(out);
  assert.equal(summary.failed, 0, `fallos: ${summary.failed}`);
});

test('build-case-bank.mjs --check: el banco en disco está al día', () => {
  // No debe lanzar (exit 0) si el índice coincide con lo generado.
  execFileSync('node', ['scripts/build-case-bank.mjs', '--check'], { cwd: REPO_ROOT, encoding: 'utf8' });
});
