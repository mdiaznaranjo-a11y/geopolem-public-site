// GEOPÓLEM (Sprint 11) — compatibilidad hacia atrás del mapa enriquecido.
// ---------------------------------------------------------------------------
// map.enriched.json debe ser un SUPERCONJUNTO de map.json: mismas features
// (por slug/coords) y mismas propiedades base, más metadatos añadidos. Un
// cliente que sólo lea el shape base (PWA, 10 focos locales) sigue funcionando.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const { validateEnrichedMap, buildEnrichedMapPayload, buildActiveMapPayload } =
  await import('../scripts/export-static-bridge.mjs');

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const MAP_PATH = resolve(REPO_ROOT, 'api/v1/conflicts/active/map.json');
const MAP_ENRICHED_PATH = resolve(REPO_ROOT, 'api/v1/conflicts/active/map.enriched.json');

const BASE_PROPS = ['id', 'slug', 'name', 'intensity_level', 'escalation_risk', 'energy_dimension', 'primary_region'];

test('mapa enriquecido en disco valida y es superconjunto del base', () => {
  assert.ok(existsSync(MAP_PATH), 'falta map.json');
  assert.ok(existsSync(MAP_ENRICHED_PATH), 'falta map.enriched.json');
  const base = JSON.parse(readFileSync(MAP_PATH, 'utf8'));
  const enr = JSON.parse(readFileSync(MAP_ENRICHED_PATH, 'utf8'));

  assert.equal(validateEnrichedMap(enr).ok, true);
  assert.equal(enr.type, 'FeatureCollection');
  assert.equal(enr.meta.enriched, true);
  // Mismo conjunto de features (por slug).
  const baseSlugs = base.features.map((f) => f.properties.slug).sort();
  const enrSlugs = enr.features.map((f) => f.properties.slug).sort();
  assert.deepEqual(enrSlugs, baseSlugs);

  const baseBySlug = new Map(base.features.map((f) => [f.properties.slug, f]));
  for (const f of enr.features) {
    const b = baseBySlug.get(f.properties.slug);
    assert.ok(b, `feature enriquecida sin equivalente base: ${f.properties.slug}`);
    // Coordenadas idénticas (no se mueven los focos).
    assert.deepEqual(f.geometry.coordinates, b.geometry.coordinates);
    // Todas las propiedades base se conservan con el mismo valor.
    for (const p of BASE_PROPS) {
      assert.deepEqual(f.properties[p], b.properties[p], `prop ${p} difiere en ${f.properties.slug}`);
    }
    // Enriquecimiento adicional presente.
    assert.ok('conflict_type' in f.properties);
    assert.ok('updated_at' in f.properties);
  }
});

test('buildEnrichedMapPayload deriva superconjunto de buildActiveMapPayload', () => {
  const items = [{
    id: 'x', slug: 'x', name: 'X', status: 'active', intensity_level: 4,
    escalation_risk: null, energy_dimension: true,
    conflict_type: { label: 'Energía' }, primary_region: { label: 'MENA' },
    territorial_dimension: true, external_involvement: false,
    humanitarian_impact: 3, updated_at: '2026-01-01',
    location: { latitude: 12, longitude: 43 },
  }];
  const base = buildActiveMapPayload(items, 'T');
  const enr = buildEnrichedMapPayload(items, 'T');
  assert.equal(base.features.length, enr.features.length);
  const bp = base.features[0].properties;
  const ep = enr.features[0].properties;
  for (const p of BASE_PROPS) assert.deepEqual(ep[p], bp[p]);
  assert.equal(ep.conflict_type, 'Energía');
  assert.equal(ep.territorial_dimension, true);
  assert.equal(enr.meta.enriched, true);
});
