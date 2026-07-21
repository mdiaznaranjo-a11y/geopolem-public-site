// GEOPÓLEM API v1 (Sprint 7) — mapa enriquecido (export-static-bridge).
// ---------------------------------------------------------------------------
// buildEnrichedMapPayload es un SUPERCONJUNTO compatible del mapa base: mismo
// GeoJSON (Point + coords), propiedades base intactas y campos adicionales
// derivados SÓLO de los datos ya presentes (sin inventar). validateEnrichedMap
// comprueba las invariantes. No toca disco ni red: funciones puras.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';

const { buildEnrichedMapPayload, validateEnrichedMap } = await import('../scripts/export-static-bridge.mjs');

function sampleItems() {
  return [
    {
      id: 1, slug: 'conflicto-a', name: 'Conflicto A', status: 'active',
      intensity_level: 4, escalation_risk: 3, energy_dimension: true,
      territorial_dimension: false, external_involvement: true, humanitarian_impact: 5,
      updated_at: '2026-01-01T00:00:00.000Z',
      primary_region: { label: 'Europa' }, conflict_type: { label: 'Energético' },
      location: { longitude: -3.7, latitude: 40.4 },
    },
    {
      id: 2, slug: 'conflicto-inactivo', name: 'Inactivo', status: 'archived',
      location: { longitude: 1, latitude: 1 },
    },
    {
      id: 3, slug: 'conflicto-sin-geo', name: 'Sin Geo', status: 'active',
      location: null,
    },
  ];
}

test('sólo incluye conflictos active con coordenadas', () => {
  const map = buildEnrichedMapPayload(sampleItems(), '2026-07-07T00:00:00.000Z');
  assert.equal(map.type, 'FeatureCollection');
  assert.equal(map.features.length, 1);
  assert.equal(map.features[0].properties.slug, 'conflicto-a');
});

test('meta.enriched=true y coordenadas [lng, lat]', () => {
  const map = buildEnrichedMapPayload(sampleItems());
  assert.equal(map.meta.enriched, true);
  const f = map.features[0];
  assert.equal(f.geometry.type, 'Point');
  assert.deepEqual(f.geometry.coordinates, [-3.7, 40.4]);
});

test('propiedades base intactas + enriquecimiento derivado de campos existentes', () => {
  const props = buildEnrichedMapPayload(sampleItems()).features[0].properties;
  // Base (compatibilidad con el mapa base / PWA):
  assert.equal(props.id, 1);
  assert.equal(props.intensity_level, 4);
  assert.equal(props.energy_dimension, true);
  assert.equal(props.primary_region, 'Europa');
  // Enriquecimiento aditivo:
  assert.equal(props.conflict_type, 'Energético');
  assert.equal(props.territorial_dimension, false);
  assert.equal(props.external_involvement, true);
  assert.equal(props.humanitarian_impact, 5);
  assert.equal(props.updated_at, '2026-01-01T00:00:00.000Z');
});

test('no se inventan datos: campos ausentes → null', () => {
  const items = [{
    id: 9, slug: 'minimo', name: 'Mínimo', status: 'active',
    intensity_level: 2, location: { longitude: 0, latitude: 0 },
  }];
  const props = buildEnrichedMapPayload(items).features[0].properties;
  assert.equal(props.conflict_type, null);
  assert.equal(props.primary_region, null);
  assert.equal(props.humanitarian_impact, null);
  assert.equal(props.updated_at, null);
});

test('validateEnrichedMap acepta un payload correcto', () => {
  const map = buildEnrichedMapPayload(sampleItems());
  assert.equal(validateEnrichedMap(map).ok, true);
});

test('validateEnrichedMap rechaza payload sin meta.enriched o con geometría inválida', () => {
  const noMeta = buildEnrichedMapPayload(sampleItems());
  noMeta.meta.enriched = false;
  assert.equal(validateEnrichedMap(noMeta).ok, false);

  const badGeom = buildEnrichedMapPayload(sampleItems());
  badGeom.features[0].geometry.coordinates = [0];
  assert.equal(validateEnrichedMap(badGeom).ok, false);

  assert.equal(validateEnrichedMap({ type: 'X' }).ok, false);
});
