// GEOPÓLEM (Sprint 24) — Materiales docentes y estructura curricular.
// ---------------------------------------------------------------------------
// Cubre las garantías del sprint (sin DB ni navegador):
//   • ESTRUCTURA: el manifiesto declara 6 formatos, 7 plantillas y >=2 casos,
//     y todos los ficheros existen en disco.
//   • PLANTILLAS COMPLETAS: cada plantilla contiene sus secciones requeridas.
//   • ALINEACIÓN: la alineación taxonómica sólo referencia campos reales del
//     contrato v1 (derivados de api/v1/conflicts/istanbul.json).
//   • CASOS: usan conflict_id existentes en el inventario, llevan advertencia
//     editorial y citan fuente verificada; no son producción.
//   • NO PRODUCCIÓN / NO SECRETS: el validador dedicado pasa (exit 0) y el
//     manifiesto declara is_production=false.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const abs = (rel) => resolve(REPO_ROOT, rel);
const readJson = (rel) => JSON.parse(readFileSync(abs(rel), 'utf8'));
const readText = (rel) => readFileSync(abs(rel), 'utf8');

const manifest = readJson('docs/education/education.manifest.json');

/* ==================== 1) ESTRUCTURA ==================================== */

test('manifiesto: contrato y flags de no-producción', () => {
  assert.equal(manifest.contract, 'sprint-24-education-manifest-v1');
  assert.equal(manifest.production.is_production, false);
  assert.equal(manifest.production.activates_production_gate, false);
  assert.equal(manifest.production.contains_secrets, false);
});

test('estructura: 6 formatos declarados y existentes', () => {
  assert.equal(manifest.formats.length, 6);
  for (const f of manifest.formats) assert.ok(existsSync(abs(f.file)), f.file);
});

test('estructura: 7 plantillas declaradas y existentes', () => {
  assert.equal(manifest.templates.length, 7);
  for (const t of manifest.templates) assert.ok(existsSync(abs(t.file)), t.file);
});

test('estructura: índice, modelo y alineación existen', () => {
  assert.ok(existsSync(abs(manifest.index_file)));
  assert.ok(existsSync(abs(manifest.pedagogical_model_file)));
  assert.ok(existsSync(abs(manifest.taxonomy_alignment_file)));
});

/* ==================== 2) PLANTILLAS COMPLETAS ========================== */

const headingSet = (text) =>
  new Set(
    text.split('\n').filter((l) => /^#{1,6}\s/.test(l)).map((l) => l.replace(/^#{1,6}\s+/, '').trim())
  );

test('plantillas: todas las secciones requeridas presentes', () => {
  for (const t of manifest.templates) {
    const headings = headingSet(readText(t.file));
    for (const s of t.required_sections) {
      assert.ok(headings.has(s), `${t.id} falta sección "${s}"`);
    }
  }
});

/* ==================== 3) ALINEACIÓN TAXONÓMICA ======================== */

const flattenPaths = (obj, prefix = '') => {
  const out = new Set();
  for (const [k, v] of Object.entries(obj || {})) {
    const path = prefix ? `${prefix}.${k}` : k;
    out.add(path);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const p of flattenPaths(v, path)) out.add(p);
    }
  }
  return out;
};

test('alineación: campos referenciados existen en el contrato v1', () => {
  const schema = readJson(manifest.schema_reference);
  const validPaths = flattenPaths(schema.data || {});
  const alignment = readJson(manifest.taxonomy_alignment_file);
  for (const [entity, def] of Object.entries(alignment.entities)) {
    for (const field of def.fields) {
      assert.ok(validPaths.has(field), `${entity}: campo inexistente ${field}`);
    }
  }
});

/* ==================== 4) CASOS DE ESTUDIO ============================= */

test('casos: usan IDs reales del inventario, con advertencia y fuente', () => {
  const inventoryIds = new Set(readJson(manifest.taxonomy_source).conflicts.map((c) => c.id));
  assert.ok(manifest.case_studies.length >= 2);
  for (const cs of manifest.case_studies) {
    assert.ok(existsSync(abs(cs.file)), cs.file);
    assert.ok(inventoryIds.has(cs.conflict_id), `id inexistente ${cs.conflict_id}`);
    const text = readText(cs.file);
    assert.match(text, /Advertencia editorial/i);
    assert.ok(text.includes(cs.conflict_id));
    assert.match(text, /verified/i);
    assert.match(text, /https?:\/\//);
    assert.match(text, /RC|staging/i);
  }
});

/* ==================== 5) VALIDADOR DEDICADO (exit 0) ================== */

test('validate-education-materials.mjs: exit 0 y sin fallos', () => {
  const out = execFileSync('node', ['scripts/validate-education-materials.mjs', '--json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const summary = JSON.parse(out);
  assert.equal(summary.failed, 0, `fallos: ${summary.failed}`);
  assert.ok(summary.passed >= 40);
});

test('materiales: sin secretos ni activación de producción (barrido)', () => {
  const files = [
    ...manifest.formats.map((f) => f.file),
    ...manifest.templates.map((t) => t.file),
    ...manifest.case_studies.map((c) => c.file),
    manifest.index_file,
    manifest.pedagogical_model_file,
  ];
  const secret = /-----BEGIN[A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[0-9A-Za-z]{20,}/;
  const prod = /"is_production"\s*:\s*true|NODE_ENV\s*=\s*production/;
  for (const rel of files) {
    const text = readText(rel);
    assert.ok(!secret.test(text), `secreto en ${rel}`);
    assert.ok(!prod.test(text), `producción en ${rel}`);
  }
});
