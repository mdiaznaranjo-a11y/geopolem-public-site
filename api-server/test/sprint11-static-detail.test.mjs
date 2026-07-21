// GEOPÓLEM (Sprint 11) — tests del detalle estático por conflicto.
// ---------------------------------------------------------------------------
// Verifica el constructor/validador de ficha del exportador (buildConflictDetail
// / validateDetail) con fixtures (sin DB), y que los archivos por conflicto
// realmente presentes en disco cumplen el contrato y su id coincide con la
// lista `conflicts.json`. Sin PostgreSQL: se ejercita la ruta --from-static.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const {
  buildConflictDetail, validateDetail,
} = await import('../scripts/export-static-bridge.mjs');
const { loadEnrichedDetail } = await import('../../public-enriched.mjs');

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const LIST_PATH = resolve(REPO_ROOT, 'api/v1/conflicts.json');
const DETAILS_DIR = resolve(REPO_ROOT, 'api/v1/conflicts');

const FIXTURE_ITEM = {
  id: 'demo', slug: 'demo', name: 'Demo', summary: 'resumen',
  conflict_type: { slug: 'energia', label: 'Energía' },
  primary_region: { slug: 'mena', label: 'MENA' },
  status: 'active', intensity_level: 4, escalation_risk: 3, humanitarian_impact: 2,
  energy_dimension: true, territorial_dimension: true, external_involvement: false,
  location: { latitude: 12.6, longitude: 43.3 }, updated_at: '2026-01-01T00:00:00Z',
};

/* --------------------------------------------------------- build/validate */

test('buildConflictDetail sin relaciones → relaciones vacías presentes', () => {
  const d = buildConflictDetail(FIXTURE_ITEM);
  assert.equal(d.data.id, 'demo');
  assert.equal(d.data.metrics.intensity_level, 4);
  assert.equal(d.data.dimensions.energy, true);
  assert.deepEqual(d.data.actors, { state: [], non_state: [] });
  assert.deepEqual(d.data.resources, []);
  assert.deepEqual(d.data.chokepoints, []);
  assert.deepEqual(d.data.causal_links, []);
  assert.deepEqual(d.data.sources, []);
  assert.equal(d.meta.api_version, 'v1');
});

test('buildConflictDetail con relaciones DB → se preservan', () => {
  const relations = {
    actors: { state: [{ name: 'Estado A', role: 'beligerante' }], non_state: [] },
    resources: [{ name: 'Petróleo', relevance_level: 5 }],
    chokepoints: [{ name: 'Ormuz', risk_level: 5 }],
    causal_links: [{ link_type: 'trigger', title: 'Bloqueo' }],
    sources: [{ title: 'Informe', url: 'https://e.org' }],
  };
  const d = buildConflictDetail(FIXTURE_ITEM, relations);
  assert.equal(d.data.actors.state[0].name, 'Estado A');
  assert.equal(d.data.resources[0].name, 'Petróleo');
  assert.equal(d.data.chokepoints[0].name, 'Ormuz');
  assert.equal(d.data.causal_links[0].title, 'Bloqueo');
  assert.equal(d.data.sources[0].url, 'https://e.org');
  const { ok } = validateDetail(d, 'demo');
  assert.equal(ok, true);
});

test('validateDetail detecta contrato roto', () => {
  assert.equal(validateDetail({}).ok, false);
  assert.equal(validateDetail({ data: { id: 1 } }).ok, false); // tipos inválidos
  const bad = buildConflictDetail(FIXTURE_ITEM);
  bad.data.resources = 'no-array';
  assert.equal(validateDetail(bad).ok, false);
  const mism = buildConflictDetail(FIXTURE_ITEM);
  assert.equal(validateDetail(mism, 'otro-id').ok, false); // id no coincide
});

/* ------------------------------------------------------------ disco (real) */

test('los detalles en disco cumplen contrato y su id coincide con la lista', () => {
  assert.ok(existsSync(LIST_PATH), 'falta conflicts.json');
  const list = JSON.parse(readFileSync(LIST_PATH, 'utf8'));
  assert.ok(Array.isArray(list.data) && list.data.length > 0);
  let checked = 0;
  for (const item of list.data) {
    const p = resolve(DETAILS_DIR, `${item.id}.json`);
    if (!existsSync(p)) continue;
    const detail = JSON.parse(readFileSync(p, 'utf8'));
    const { ok, errors } = validateDetail(detail, item.id);
    assert.ok(ok, `detalle inválido ${item.id}: ${errors.join('; ')}`);
    // El detalle estático debe espejar la lista en campos clave.
    assert.equal(detail.data.slug, item.slug);
    assert.equal(detail.data.name, item.name);
    checked += 1;
  }
  assert.ok(checked > 0, 'no se encontró ningún detalle por conflicto en disco');
});

/* ------------------------------------------- carga estática (sin API) */

const STATIC_CFG = {
  useApi: false, apiBase: '', detailPath: '/api/v1/conflicts/:id',
  detailStaticPath: '/api/v1/conflicts/:id.json', timeoutMs: 500,
};

test('loadEnrichedDetail: detalle estático se consume aunque useApi=false', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({
    data: { slug: 's', name: 'Estático', resources: [{ name: 'Litio' }] },
  }) });
  try {
    const { detail, source } = await loadEnrichedDetail('s', {
      localFoco: { id: 's', title: 'local' }, config: STATIC_CFG,
    });
    assert.equal(source, 'static');
    assert.equal(detail.name, 'Estático');
    assert.equal(detail.resources[0].name, 'Litio');
  } finally { globalThis.fetch = orig; }
});

test('loadEnrichedDetail: estático SIN relaciones no degrada el foco local enriquecido', async () => {
  const orig = globalThis.fetch;
  // Estático vacío (export sin DB) pero el foco local trae actores de data.js.
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({
    data: { slug: 'ukr-rus', name: 'Ucrania – Rusia' },
  }) });
  try {
    const local = { id: 'ukr-rus', title: 'Ucrania – Rusia',
      actores: { gobiernos: ['Ucrania', 'Rusia'], empresas: [], organismos: [], armados: [], sociedad: [] } };
    const { detail, source } = await loadEnrichedDetail('ukr-rus', { localFoco: local, config: STATIC_CFG });
    assert.equal(source, 'local'); // se prefiere local por tener enriquecimiento
    assert.ok(detail.actors.state.length > 0);
  } finally { globalThis.fetch = orig; }
});

test('loadEnrichedDetail: estático ausente (404/ENOENT) degrada a local', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
  try {
    const { detail, source, error } = await loadEnrichedDetail('nope', {
      localFoco: { id: 'nope', title: 'Fallback' }, config: STATIC_CFG,
    });
    assert.equal(source, 'local');
    assert.equal(detail.name, 'Fallback');
    assert.ok(error);
  } finally { globalThis.fetch = orig; }
});

test('cada foco activo con coords tiene su detalle estático', () => {
  const list = JSON.parse(readFileSync(LIST_PATH, 'utf8'));
  const active = list.data.filter((c) => c.status === 'active'
    && c.location && c.location.latitude != null && c.location.longitude != null);
  for (const c of active) {
    const p = resolve(DETAILS_DIR, `${c.id}.json`);
    assert.ok(existsSync(p), `falta detalle estático para foco activo ${c.id}`);
  }
});
