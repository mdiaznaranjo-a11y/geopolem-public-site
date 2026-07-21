// GEOPÓLEM (Sprint 8) — tests de la validación editorial + contrato con servidor.
// ---------------------------------------------------------------------------
// Verifica el validador editorial (admin/editorial-validation.mjs) y que NO
// diverge del contrato de escritura del servidor Sprint 7 (src/validation.mjs).
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';

const ed = await import('../../admin/editorial-validation.mjs');
const server = await import('../src/validation.mjs');

test('contrato: CMS_STATUSES idéntico al servidor', () => {
  assert.deepEqual(ed.CMS_STATUSES, server.CMS_STATUSES);
});

test('contrato: STATUS_TRANSITIONS idéntico al servidor', () => {
  assert.deepEqual(ed.STATUS_TRANSITIONS, server.STATUS_TRANSITIONS);
});

test('creación: payload mínimo válido', () => {
  const r = ed.validateEditorialConflict({ slug: 'foco-test', name: 'Foco de prueba' }, { partial: false });
  assert.equal(r.valid, true);
  assert.equal(r.value.slug, 'foco-test');
  assert.equal(r.value.status, 'draft'); // default en creación
});

test('creación: faltan slug y name → inválido', () => {
  const r = ed.validateEditorialConflict({}, { partial: false });
  assert.equal(r.valid, false);
  const fields = r.errors.map((e) => e.field);
  assert.ok(fields.includes('slug'));
  assert.ok(fields.includes('name'));
});

test('coordenadas fuera de rango → error', () => {
  const r = ed.validateEditorialConflict({ slug: 'x', name: 'Nombre válido', location: { latitude: 120, longitude: 200 } });
  assert.equal(r.valid, false);
  const fields = r.errors.map((e) => e.field);
  assert.ok(fields.includes('location.latitude'));
  assert.ok(fields.includes('location.longitude'));
});

test('sources: exige title y url http(s)', () => {
  const bad = ed.validateEditorialConflict({ slug: 'x', name: 'Nombre válido', sources: [{ title: '', url: 'ftp://no' }] });
  assert.equal(bad.valid, false);
  const ok = ed.validateEditorialConflict({ slug: 'x', name: 'Nombre válido', sources: [{ title: 'T', url: 'https://a.org' }] });
  assert.equal(ok.valid, true);
  assert.equal(ok.value.sources[0].url, 'https://a.org');
});

test('causal_links: rechaza auto-lazo y relación inválida', () => {
  const selfLoop = ed.validateEditorialConflict({ slug: 'x', name: 'Nombre válido', causal_links: [{ from: 'a', to: 'a' }] });
  assert.equal(selfLoop.valid, false);
  const badRel = ed.validateEditorialConflict({ slug: 'x', name: 'Nombre válido', causal_links: [{ from: 'a', to: 'b', relation: 'nope' }] });
  assert.equal(badRel.valid, false);
  const good = ed.validateEditorialConflict({ slug: 'x', name: 'Nombre válido', causal_links: [{ from: 'a', to: 'b', relation: 'causes' }] });
  assert.equal(good.valid, true);
  assert.equal(good.value.causal_links[0].from, 'a');
});

test('actors: normaliza strings y objetos a { name }', () => {
  const r = ed.validateEditorialConflict({ slug: 'x', name: 'Nombre válido', actors: { state: ['A', { name: 'B' }], non_state: [] } });
  assert.equal(r.valid, true);
  assert.deepEqual(r.value.actors.state, [{ name: 'A' }, { name: 'B' }]);
});

test('toServerWritePayload: filtra metadatos editoriales', () => {
  const { value } = ed.validateEditorialConflict({
    slug: 'x', name: 'Nombre válido', country: 'Yemen',
    sources: [{ title: 'T', url: 'https://a.org' }], intensity_level: 3,
  });
  const write = ed.toServerWritePayload(value);
  assert.ok('slug' in write && 'name' in write && 'intensity_level' in write);
  assert.ok(!('country' in write));
  assert.ok(!('sources' in write));
});

test('transición: sin origen conocido acepta cualquier destino válido', () => {
  assert.equal(ed.validateStatusTransition(null, 'published').valid, true);
  assert.equal(ed.validateStatusTransition('published', 'draft').valid, false);
  assert.equal(ed.validateStatusTransition('draft', 'review').valid, true);
});

test('isHttpUrl: sólo http(s)', () => {
  assert.equal(ed.isHttpUrl('https://x.org'), true);
  assert.equal(ed.isHttpUrl('http://x.org'), true);
  assert.equal(ed.isHttpUrl('javascript:alert(1)'), false);
  assert.equal(ed.isHttpUrl(''), false);
});
