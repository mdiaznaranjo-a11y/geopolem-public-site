// GEOPÓLEM API v1 (Sprint 9) — contrato del detalle enriquecido desde "DB".
// ---------------------------------------------------------------------------
// Sin PostgreSQL real: se sustituyen (monkeypatch) los métodos de queryLayer que
// usa el repositorio para simular una DB alcanzable y comprobar que:
//   • Con relaciones reales, el detalle las expone (actores/recursos/chokepoints/
//     causal_links/sources) con source='database'.
//   • Si la consulta de relaciones falla, el detalle NO se rompe: cae a arrays
//     vacíos (no se inventan datos) conservando el conflicto.
//   • Sin withRelations, las relaciones son arrays vacíos.
// Es un test de CONTRATO de la capa repository, complementario al job PostGIS.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';

delete process.env.DATABASE_URL;

const { CONFIG } = await import('../src/config.mjs');
CONFIG.obsLog = false;
const { queryLayer } = await import('../src/db.mjs');
const repository = await import('../src/repository.mjs');

const FAKE_CONFLICT = {
  id: '11111111-1111-1111-1111-111111111111',
  slug: 'test-conflicto',
  name: 'Conflicto de prueba',
  summary: 'resumen',
  conflict_type: { slug: 'energia', label: 'Energía' },
  primary_region: { slug: 'mena', label: 'MENA' },
  status: 'active',
  intensity_level: 4,
  escalation_risk: 3,
  humanitarian_impact: 5,
  energy_dimension: true,
  territorial_dimension: false,
  external_involvement: true,
  location: { latitude: 12.6, longitude: 43.3 },
  updated_at: '2026-01-01T00:00:00Z',
};

const FAKE_RELATIONS = {
  actors: {
    state: [{ slug: 'estado-a', name: 'Estado A', role: 'beligerante', alignment: 'rival', involvement_level: 5 }],
    non_state: [{ slug: 'grupo-b', name: 'Grupo B', role: null, alignment: 'unknown', involvement_level: 3 }],
  },
  resources: [{ slug: 'petroleo', name: 'Petróleo', relevance_level: 5, strategic_importance: 5, critical_mineral: false }],
  chokepoints: [{ slug: 'ormuz', name: 'Ormuz', risk_level: 5, strategic_importance: 5, energy_flow_relevance: true }],
  causal_links: [{ link_type: 'trigger', title: 'Bloqueo', explanation: 'x', mechanism: null, strength: 4, confidence_score: 3 }],
  sources: [{ slug: 's1', title: 'Informe', url: 'https://e.org', publisher: 'E', claim: null, confidence_score: 4, verification: 'verified' }],
};

// Guarda los originales para restaurarlos.
const orig = {
  available: queryLayer.available,
  getConflict: queryLayer.getConflict,
  getConflictRelations: queryLayer.getConflictRelations,
};
function restore() {
  queryLayer.available = orig.available;
  queryLayer.getConflict = orig.getConflict;
  queryLayer.getConflictRelations = orig.getConflictRelations;
}

test('detalle enriquecido desde DB simulada expone todas las relaciones', async () => {
  queryLayer.available = async () => true;
  queryLayer.getConflict = async () => ({ ...FAKE_CONFLICT });
  queryLayer.getConflictRelations = async () => FAKE_RELATIONS;

  const { conflict, source } = await repository.getConflict('test-conflicto', { withRelations: true });
  assert.equal(source, 'database');
  assert.equal(conflict.slug, 'test-conflicto');
  assert.equal(conflict.actors.state.length, 1);
  assert.equal(conflict.actors.state[0].slug, 'estado-a');
  assert.equal(conflict.actors.non_state.length, 1);
  assert.equal(conflict.resources[0].slug, 'petroleo');
  assert.equal(conflict.chokepoints[0].slug, 'ormuz');
  assert.equal(conflict.causal_links[0].link_type, 'trigger');
  assert.equal(conflict.sources[0].slug, 's1');
  restore();
});

test('si la consulta de relaciones falla, el detalle cae a arrays vacíos sin romper', async () => {
  queryLayer.available = async () => true;
  queryLayer.getConflict = async () => ({ ...FAKE_CONFLICT });
  queryLayer.getConflictRelations = async () => { throw new Error('relación caída'); };

  const { conflict, source } = await repository.getConflict('test-conflicto', { withRelations: true });
  assert.equal(source, 'database');
  assert.equal(conflict.slug, 'test-conflicto'); // el conflicto se conserva
  assert.deepEqual(conflict.actors, { state: [], non_state: [] });
  assert.deepEqual(conflict.resources, []);
  assert.deepEqual(conflict.causal_links, []);
  assert.deepEqual(conflict.sources, []);
  restore();
});

test('sin withRelations, las relaciones son arrays vacíos aun con DB', async () => {
  let relationsCalled = false;
  queryLayer.available = async () => true;
  queryLayer.getConflict = async () => ({ ...FAKE_CONFLICT });
  queryLayer.getConflictRelations = async () => { relationsCalled = true; return FAKE_RELATIONS; };

  const { conflict } = await repository.getConflict('test-conflicto'); // sin opts
  assert.equal(relationsCalled, false);
  assert.deepEqual(conflict.actors, { state: [], non_state: [] });
  assert.deepEqual(conflict.resources, []);
  restore();
});

test('conflicto inexistente en DB simulada → null con source database', async () => {
  queryLayer.available = async () => true;
  queryLayer.getConflict = async () => null;

  const { conflict, source } = await repository.getConflict('no-existe', { withRelations: true });
  assert.equal(source, 'database');
  assert.equal(conflict, null);
  restore();
});
