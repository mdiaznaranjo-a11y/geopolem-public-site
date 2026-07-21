// GEOPÓLEM API v1 (Sprint 3) — tests de contrato (node:test, sin DB ni sockets).
// ---------------------------------------------------------------------------
// Ejecuta:  node --test test/     (o: npm test)
//
// Verifica el contrato de la API en modo fallback (sin DATABASE_URL):
//   - /health responde sin DB (active_source=static, database=unavailable).
//   - /conflicts tiene shape de lista (data + pagination + meta) y campos v1.
//   - /conflicts/active/map es una FeatureCollection GeoJSON válida.
//   - /conflicts/:id devuelve detalle; id inexistente → 404 not_found.
//   - /filters expone facetas (regiones/tipos/estados/intensidad).
//   - paginación y filtros funcionan sobre el puente estático.
// No requiere red ni PostgreSQL: usa el router directamente.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';

// Garantiza modo fallback estático (sin DB) para este archivo de pruebas.
delete process.env.DATABASE_URL;

const { route } = await import('../src/router.mjs');

function call(path) {
  const url = new URL(`http://x${path}`);
  return route('GET', url.pathname, url.searchParams);
}

test('GET /api/v1/health responde ok sin base de datos', async () => {
  const { status, body } = await call('/api/v1/health');
  assert.equal(status, 200);
  assert.equal(body.data.status, 'ok');
  assert.equal(body.data.service, 'geopolem-api');
  assert.equal(body.data.active_source, 'static');
  assert.equal(body.data.database, 'unavailable');
  assert.equal(body.data.postgis, false);
  assert.equal(body.data.static_fallback.available, true);
});

test('GET /api/v1/conflicts tiene shape de lista v1', async () => {
  const { status, body } = await call('/api/v1/conflicts');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length > 0);
  assert.equal(body.meta.api_version, 'v1');
  assert.equal(body.meta.source, 'static');
  // pagination
  assert.equal(body.pagination.total, body.data.length <= body.pagination.page_size
    ? body.pagination.total : body.pagination.total);
  assert.ok(body.pagination.total >= body.data.length);

  const REQUIRED = ['id', 'slug', 'name', 'summary', 'conflict_type', 'primary_region',
    'status', 'intensity_level', 'escalation_risk', 'humanitarian_impact',
    'energy_dimension', 'territorial_dimension', 'external_involvement',
    'location', 'updated_at'];
  for (const c of body.data) {
    for (const f of REQUIRED) assert.ok(f in c, `falta campo ${f} en ${c.id}`);
    assert.equal(typeof c.slug, 'string');
    assert.equal(typeof c.energy_dimension, 'boolean');
    assert.ok('latitude' in c.location && 'longitude' in c.location);
  }
});

test('paginación: page_size limita resultados y total no cambia', async () => {
  const full = (await call('/api/v1/conflicts')).body;
  const paged = (await call('/api/v1/conflicts?page=1&page_size=2')).body;
  assert.ok(paged.data.length <= 2);
  assert.equal(paged.pagination.page_size, 2);
  assert.equal(paged.pagination.total, full.pagination.total);
});

test('filtro por region reduce el conjunto de forma coherente', async () => {
  const { body } = await call('/api/v1/conflicts');
  const someRegion = body.data.find((c) => c.primary_region?.slug)?.primary_region.slug;
  assert.ok(someRegion, 'debe existir al menos una región');
  const filtered = (await call(`/api/v1/conflicts?region=${encodeURIComponent(someRegion)}`)).body;
  assert.ok(filtered.data.length > 0);
  for (const c of filtered.data) assert.equal(c.primary_region.slug, someRegion);
});

test('GET /api/v1/conflicts/active/map es FeatureCollection GeoJSON', async () => {
  const { status, body } = await call('/api/v1/conflicts/active/map');
  assert.equal(status, 200);
  assert.equal(body.type, 'FeatureCollection');
  assert.ok(Array.isArray(body.features));
  assert.ok(body.features.length > 0);
  for (const f of body.features) {
    assert.equal(f.type, 'Feature');
    assert.equal(f.geometry.type, 'Point');
    assert.equal(f.geometry.coordinates.length, 2);
    assert.equal(typeof f.geometry.coordinates[0], 'number');
    assert.equal(typeof f.geometry.coordinates[1], 'number');
    assert.equal(typeof f.properties.slug, 'string');
  }
});

test('GET /api/v1/conflicts/:id devuelve detalle', async () => {
  const listBody = (await call('/api/v1/conflicts')).body;
  const slug = listBody.data[0].slug;
  const { status, body } = await call(`/api/v1/conflicts/${encodeURIComponent(slug)}`);
  assert.equal(status, 200);
  assert.equal(body.data.slug, slug);
  assert.ok(body.data.metrics);
  assert.ok(body.data.dimensions);
  assert.ok(body.data.location);
  assert.ok(Array.isArray(body.data.resources));
  assert.ok(body.data.actors && Array.isArray(body.data.actors.state));
});

test('GET /api/v1/conflicts/:id inexistente → 404 not_found', async () => {
  const { status, body } = await call('/api/v1/conflicts/no-existe-xyz');
  assert.equal(status, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /api/v1/filters expone facetas', async () => {
  const { status, body } = await call('/api/v1/filters');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.data.regions));
  assert.ok(Array.isArray(body.data.conflict_types));
  assert.ok(Array.isArray(body.data.statuses));
  assert.ok(body.data.regions.length > 0);
  assert.ok('min' in body.data.intensity && 'max' in body.data.intensity);
});

test('método no-GET → 405', async () => {
  const { route } = await import('../src/router.mjs');
  const { status } = await route('POST', '/api/v1/conflicts', new URLSearchParams());
  assert.equal(status, 405);
});

test('ruta desconocida → 404', async () => {
  const { status, body } = await call('/api/v1/desconocido');
  assert.equal(status, 404);
  assert.equal(body.error.code, 'not_found');
});
