// GEOPÓLEM (Sprint 8) — tests del normalizador de detalle enriquecido.
// ---------------------------------------------------------------------------
// Preparación no destructiva del frontend público para actores/recursos/
// chokepoints/causal_links/sources. Tolerante a ausencias, sin inventar datos.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';

const { toEnrichedViewModel, hasAnyEnrichment } = await import('../../admin/enriched-detail-view.mjs');

test('detalle vacío/estático: relaciones vacías, has=false', () => {
  const vm = toEnrichedViewModel({ slug: 'x', name: 'X' });
  assert.deepEqual(vm.actors, { state: [], non_state: [] });
  assert.deepEqual(vm.resources, []);
  assert.deepEqual(vm.sources, []);
  assert.equal(hasAnyEnrichment(vm), false);
});

test('detalle poblado: normaliza y marca flags', () => {
  const vm = toEnrichedViewModel({
    slug: 'x', name: 'X',
    actors: { state: ['A'], non_state: [{ name: 'B' }] },
    resources: ['petróleo', { name: 'gas' }],
    chokepoints: ['Ormuz'],
    causal_links: [{ from: 'a', to: 'b', relation: 'causes' }],
    sources: [{ title: 'T', url: 'https://a.org' }],
  });
  assert.deepEqual(vm.actors.state, ['A']);
  assert.deepEqual(vm.actors.non_state, ['B']);
  assert.deepEqual(vm.resources, ['petróleo', 'gas']);
  assert.equal(vm.causalLinks[0].relation, 'causes');
  assert.equal(vm.sources[0].url, 'https://a.org');
  assert.equal(hasAnyEnrichment(vm), true);
  assert.deepEqual(vm.has, { actors: true, resources: true, chokepoints: true, causalLinks: true, sources: true });
});

test('tolera entradas basura sin lanzar', () => {
  const vm = toEnrichedViewModel({ actors: 'no-obj', resources: null, causal_links: [{ from: '' }], sources: [42] });
  assert.deepEqual(vm.actors, { state: [], non_state: [] });
  assert.deepEqual(vm.resources, []);
  assert.deepEqual(vm.causalLinks, []);
  assert.deepEqual(vm.sources, []);
});

test('actors admite array plano → state', () => {
  const vm = toEnrichedViewModel({ actors: ['A', 'B'] });
  assert.deepEqual(vm.actors.state, ['A', 'B']);
});

test('input null/no-objeto → view-model seguro', () => {
  const vm = toEnrichedViewModel(null);
  assert.equal(vm.slug, null);
  assert.equal(hasAnyEnrichment(vm), false);
});
