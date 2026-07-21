// GEOPÓLEM (Sprint 13) — tests de la semilla relacional y sus validadores.
// ---------------------------------------------------------------------------
// Verifica el módulo PURO conflict-relations.mjs: validación de fuentes, regla
// "published exige fuente", merge NO destructivo (con y sin demo), cobertura, y
// la coherencia de la semilla real del repo (data/conflict-relations.seed.json).
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const {
  SEED_CONTRACT, validateSource, isPublishableSource, validateSeed,
  validatePublishedHaveSources, mergeRelations, normalizeSeedRelations,
  computeSeedCoverage, isHttpUrl,
} = await import('../../conflict-relations.mjs');

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const SEED = JSON.parse(readFileSync(resolve(REPO_ROOT, 'data/conflict-relations.seed.json'), 'utf8'));

const goodSource = {
  title: 'Informe X', url: 'https://example.org/x', publisher: 'Pub', verification: 'verified',
};

/* ----------------------------------------------------------- validateSource */

test('validateSource acepta fuente con title+url+publisher', () => {
  assert.equal(validateSource(goodSource).ok, true);
});

test('validateSource rechaza url no http y falta de title/publisher', () => {
  assert.equal(validateSource({ title: '', url: 'ftp://x', }).ok, false);
  const r = validateSource({ url: 'https://ok.org/a' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /title/.test(e)));
  assert.ok(r.errors.some((e) => /publisher/.test(e)));
});

test('validateSource acepta source_name como alternativa a publisher', () => {
  assert.equal(validateSource({ title: 't', url: 'https://a.org', source_name: 'SN', verification: 'verified' }).ok, true);
});

test('validateSource rechaza verification inválida', () => {
  assert.equal(validateSource({ ...goodSource, verification: 'bogus' }).ok, false);
});

test('isHttpUrl valida http/https y rechaza el resto', () => {
  assert.equal(isHttpUrl('https://a.org'), true);
  assert.equal(isHttpUrl('http://a.org'), true);
  assert.equal(isHttpUrl('ftp://a.org'), false);
  assert.equal(isHttpUrl(''), false);
});

/* -------------------------------------------------------- isPublishableSource */

test('isPublishableSource sólo con verified y no demo', () => {
  assert.equal(isPublishableSource(goodSource), true);
  assert.equal(isPublishableSource({ ...goodSource, verification: 'pending' }), false);
  assert.equal(isPublishableSource({ ...goodSource, demo: true }), false);
  assert.equal(isPublishableSource({ ...goodSource, url: 'nope' }), false);
});

/* ---------------------------------------------------------------- validateSeed */

test('validateSeed acepta la semilla real del repo y emite warnings demo', () => {
  const r = validateSeed(SEED);
  assert.equal(r.ok, true, r.errors.join('; '));
  assert.ok(r.warnings.length > 0); // fixtures demo → warnings, no errores
});

test('validateSeed exige contrato correcto', () => {
  const r = validateSeed({ contract: 'otro', conflicts: {} });
  assert.equal(r.ok, false);
});

test('validateSeed falla si published sin fuente publicable', () => {
  const bad = {
    contract: SEED_CONTRACT,
    conflicts: { x: { editorial_status: 'published', sources: [{ ...goodSource, verification: 'pending' }] } },
  };
  const r = validateSeed(bad);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /published/.test(e)));
});

test('validateSeed permite published con fuente verificada', () => {
  const ok = {
    contract: SEED_CONTRACT,
    conflicts: { x: { editorial_status: 'published', sources: [goodSource] } },
  };
  assert.equal(validateSeed(ok).ok, true);
});

/* ------------------------------------------------ validatePublishedHaveSources */

test('validatePublishedHaveSources sobre la semilla real: sin violaciones (todo draft)', () => {
  const r = validatePublishedHaveSources(SEED);
  assert.equal(r.ok, true);
  assert.deepEqual(r.violations, []);
});

test('validatePublishedHaveSources detecta violación', () => {
  const seed = { contract: SEED_CONTRACT, conflicts: { y: { editorial_status: 'published', sources: [] } } };
  const r = validatePublishedHaveSources(seed);
  assert.equal(r.ok, false);
  assert.deepEqual(r.violations, ['y']);
});

/* ------------------------------------------------------------- normalizeSeed */

test('normalizeSeedRelations preserva null numérico (no fabrica ceros)', () => {
  const rel = normalizeSeedRelations(SEED.conflicts['red-sea']);
  assert.equal(rel.chokepoints[0].risk_level, null);
  assert.equal(rel.chokepoints[0].energy_flow_relevance, true);
  assert.ok(rel.chokepoints.length >= 2);
});

/* --------------------------------------------------------------- mergeRelations */

test('mergeRelations sin demo NO añade fuentes demo (published-safe)', () => {
  const detail = { data: { id: 'red-sea', slug: 'red-sea', sources: [], resources: [], chokepoints: [], causal_links: [], actors: { state: [], non_state: [] } } };
  const merged = mergeRelations(detail, SEED.conflicts['red-sea']); // includeDemo=false
  assert.equal(merged.data.sources.length, 0); // demo excluidas
  assert.ok(merged.data.chokepoints.length >= 2); // relaciones estructurales sí
  assert.equal(merged.meta.seed_merged, true);
  assert.equal(merged.meta.seed_include_demo, false);
});

test('mergeRelations con includeDemo añade las fuentes demo marcadas', () => {
  const detail = { data: { id: 'red-sea', slug: 'red-sea', sources: [] } };
  const merged = mergeRelations(detail, SEED.conflicts['red-sea'], { includeDemo: true });
  assert.equal(merged.data.sources.length, 1);
  assert.equal(merged.data.sources[0].demo, true);
  assert.equal(merged.data.sources[0].verification, 'demo');
});

test('mergeRelations es no destructivo: preserva campos base del detalle', () => {
  const detail = { data: { id: 'ukr-rus', slug: 'ukr-rus', name: 'Ucrania – Rusia', summary: 'S', status: 'active' } };
  const merged = mergeRelations(detail, SEED.conflicts['ukr-rus'], { includeDemo: true });
  assert.equal(merged.data.name, 'Ucrania – Rusia');
  assert.equal(merged.data.summary, 'S');
  assert.equal(merged.data.status, 'active');
  assert.ok(merged.data.actors.state.length >= 2);
});

test('mergeRelations mantiene relaciones existentes si la semilla no aporta', () => {
  const detail = { data: { id: 'nope', sources: [], resources: [{ name: 'ya' }], actors: { state: [{ name: 'A' }], non_state: [] } } };
  const merged = mergeRelations(detail, undefined, { includeDemo: true });
  assert.equal(merged.data.resources.length, 1);
  assert.equal(merged.data.actors.state.length, 1);
});

/* -------------------------------------------------------------- computeCoverage */

test('computeSeedCoverage agrega totales y desglosa por conflicto', () => {
  const cov = computeSeedCoverage(SEED);
  assert.equal(cov.contract, SEED_CONTRACT);
  assert.equal(cov.totals.conflicts, Object.keys(SEED.conflicts).length);
  assert.equal(cov.totals.with_publishable_source, 0); // todo demo aún
  assert.equal(cov.totals.published, 0);
  assert.ok(cov.totals.demo_sources > 0);
  assert.ok(cov.by_conflict['red-sea'].chokepoints >= 2);
});
