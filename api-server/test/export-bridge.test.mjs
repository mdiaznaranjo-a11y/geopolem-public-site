// GEOPÓLEM API v1 (Sprint 5) — tests del exportador DB → puente estático.
// ---------------------------------------------------------------------------
// Prueba las funciones puras del exportador con un fixture de ConflictListItem
// (sin necesidad de PostgreSQL): construcción del contrato y validación.
//   - buildConflictsPayload envuelve con pagination + meta correctos.
//   - buildActiveMapPayload deriva una FeatureCollection consistente.
//   - validateBridge acepta contenido correcto y rechaza el corrupto.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';

const {
  buildConflictsPayload,
  buildActiveMapPayload,
  validateBridge,
} = await import('../scripts/export-static-bridge.mjs');

// Fixture: dos activos (uno sin coords) y uno resuelto. Imita el shape que
// devuelve queryLayer.listConflicts (ConflictListItem del contrato v1).
const FIXTURE = [
  {
    id: 'ukr-rus', slug: 'ukr-rus', name: 'Ucrania – Rusia', summary: 'x',
    conflict_type: { slug: 'conflicto', label: 'Conflictos' },
    primary_region: { slug: 'europa_del_este', label: 'Europa del Este' },
    status: 'active', intensity_level: 5, escalation_risk: null, humanitarian_impact: null,
    energy_dimension: false, territorial_dimension: null, external_involvement: null,
    location: { latitude: 49, longitude: 32 }, updated_at: null,
  },
  {
    id: 'sin-coords', slug: 'sin-coords', name: 'Foco sin coordenadas', summary: 'y',
    conflict_type: { slug: 'ia', label: 'IA / Narrativa' },
    primary_region: { slug: 'global', label: 'Global' },
    status: 'active', intensity_level: 3, escalation_risk: null, humanitarian_impact: null,
    energy_dimension: false, territorial_dimension: null, external_involvement: null,
    location: { latitude: null, longitude: null }, updated_at: null,
  },
  {
    id: 'resuelto', slug: 'resuelto', name: 'Conflicto resuelto', summary: 'z',
    conflict_type: { slug: 'conflicto', label: 'Conflictos' },
    primary_region: { slug: 'global', label: 'Global' },
    status: 'resolved', intensity_level: 1, escalation_risk: null, humanitarian_impact: null,
    energy_dimension: false, territorial_dimension: null, external_involvement: null,
    location: { latitude: 10, longitude: 10 }, updated_at: null,
  },
];

test('buildConflictsPayload: pagination y meta correctos', () => {
  const p = buildConflictsPayload(FIXTURE, '2026-07-07T00:00:00.000Z');
  assert.equal(p.data.length, 3);
  assert.equal(p.pagination.total, 3);
  assert.equal(p.pagination.total_pages, 1);
  assert.equal(p.meta.api_version, 'v1');
  assert.equal(p.meta.generated_at, '2026-07-07T00:00:00.000Z');
  assert.match(p.meta.source, /postgres/);
});

test('buildActiveMapPayload: sólo activos con coords → features', () => {
  const m = buildActiveMapPayload(FIXTURE);
  assert.equal(m.type, 'FeatureCollection');
  // Sólo ukr-rus: 'sin-coords' se excluye (sin coords), 'resuelto' no es active.
  assert.equal(m.features.length, 1);
  assert.equal(m.features[0].properties.slug, 'ukr-rus');
  assert.deepEqual(m.features[0].geometry.coordinates, [32, 49]);
  assert.equal(m.features[0].properties.primary_region, 'Europa del Este');
});

test('validateBridge: contenido correcto pasa', () => {
  const list = buildConflictsPayload(FIXTURE);
  const map = buildActiveMapPayload(FIXTURE);
  const { ok, errors } = validateBridge(list, map);
  assert.equal(ok, true, errors.join('; '));
});

test('validateBridge: data vacío falla', () => {
  const list = buildConflictsPayload([]);
  const map = buildActiveMapPayload([]);
  const { ok, errors } = validateBridge(list, map);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => /vac/.test(e)));
});

test('validateBridge: campo requerido faltante falla', () => {
  const bad = JSON.parse(JSON.stringify(FIXTURE));
  delete bad[0].summary;
  const { ok, errors } = validateBridge(buildConflictsPayload(bad), buildActiveMapPayload(bad));
  assert.equal(ok, false);
  assert.ok(errors.some((e) => /summary/.test(e)));
});

test('validateBridge: slug duplicado falla', () => {
  const dup = JSON.parse(JSON.stringify(FIXTURE));
  dup[1].slug = dup[0].slug;
  const { ok, errors } = validateBridge(buildConflictsPayload(dup), buildActiveMapPayload(dup));
  assert.equal(ok, false);
  assert.ok(errors.some((e) => /duplicado/.test(e)));
});
