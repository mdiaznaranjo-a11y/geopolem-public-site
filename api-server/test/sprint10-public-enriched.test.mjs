// GEOPÓLEM (Sprint 10) — tests del módulo público enriquecido.
// ---------------------------------------------------------------------------
// Cubre normalización del detalle (API rica / simple / foco local), relaciones
// legibles, filtros avanzados no destructivos y fallback de carga a local.
// Módulo PURO en la raíz del repo, consumido por app.js (browser) y por Node.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';

const {
  normalizeEnrichedDetail, toRelationRows, hasAnyEnrichment,
  deriveFilterFacets, applyAdvancedFilters, focoFacetValues, loadEnrichedDetail,
} = await import('../../public-enriched.mjs');

/* ---------------------------------------------------------------- normalize */

test('detalle vacío → relaciones vacías, has=false, sin lanzar', () => {
  const vm = normalizeEnrichedDetail(undefined);
  assert.deepEqual(vm.actors, { state: [], non_state: [] });
  assert.deepEqual(vm.resources, []);
  assert.deepEqual(vm.chokepoints, []);
  assert.deepEqual(vm.causalLinks, []);
  assert.deepEqual(vm.sources, []);
  assert.equal(hasAnyEnrichment(vm), false);
});

test('detalle rico del contrato v1 → normaliza actores/recursos/chokepoints/causal/sources', () => {
  const vm = normalizeEnrichedDetail({
    slug: 'x', name: 'X', summary: 's', status: 'active', intensity_level: 4,
    primary_region: { label: 'MENA' }, location: { latitude: 12.6, longitude: 43.3 },
    actors: {
      state: [{ name: 'Estado A', role: 'beligerante', alignment: 'rival', involvement_level: 5 }],
      non_state: [{ name: 'Grupo B' }],
    },
    resources: [{ name: 'Petróleo', relevance_level: 5, critical_mineral: false }],
    chokepoints: [{ name: 'Ormuz', risk_level: 5, energy_flow_relevance: true }],
    causal_links: [{ link_type: 'trigger', title: 'Bloqueo', explanation: 'corte de flujo', strength: 4 }],
    sources: [{ title: 'Informe', url: 'https://e.org', publisher: 'E' }],
  });
  assert.equal(vm.region, 'MENA');
  assert.equal(vm.severity, 4);
  assert.equal(vm.status, 'active');
  assert.deepEqual(vm.coords, { lat: 12.6, lng: 43.3 });
  assert.equal(vm.actors.state[0].name, 'Estado A');
  assert.equal(vm.actors.state[0].role, 'beligerante');
  assert.equal(vm.actors.non_state[0].name, 'Grupo B');
  assert.equal(vm.resources[0].name, 'Petróleo');
  assert.equal(vm.chokepoints[0].energyFlow, true);
  assert.equal(vm.causalLinks[0].type, 'trigger');
  assert.equal(vm.sources[0].url, 'https://e.org');
  assert.equal(hasAnyEnrichment(vm), true);
});

test('detalle simple (arrays de strings / {name}) → tolerado', () => {
  const vm = normalizeEnrichedDetail({
    slug: 'y', name: 'Y',
    actors: ['A', { name: 'B' }],
    resources: ['gas'],
    chokepoints: ['Malaca'],
    causal_links: [{ from: 'a', to: 'b', relation: 'causes' }],
    sources: [{ title: 'T', url: 'https://a.org' }],
  });
  assert.deepEqual(vm.actors.state.map(a => a.name), ['A', 'B']);
  assert.equal(vm.resources[0].name, 'gas');
  assert.equal(vm.causalLinks[0].from, 'a');
  assert.equal(vm.causalLinks[0].to, 'b');
  assert.equal(hasAnyEnrichment(vm), true);
});

test('foco LOCAL (data.js) → actores por grupos se mapean; recursos/chokepoints vacíos', () => {
  const vm = normalizeEnrichedDetail({
    id: 'ukr-rus', title: 'Ucrania – Rusia', region: 'Europa del Este', intensity: 5,
    coords: { lat: 49, lng: 32 },
    actores: {
      gobiernos: ['Rusia', 'Ucrania'], empresas: ['Gazprom'],
      organismos: ['OTAN'], armados: ['Wagner'], sociedad: ['ONGs'],
    },
  });
  assert.equal(vm.name, 'Ucrania – Rusia');
  assert.equal(vm.region, 'Europa del Este');
  assert.equal(vm.severity, 5);
  assert.ok(vm.actors.state.some(a => a.name === 'Rusia'));
  assert.ok(vm.actors.non_state.some(a => a.name === 'Gazprom'));
  assert.deepEqual(vm.resources, []);
  assert.deepEqual(vm.chokepoints, []);
  assert.equal(vm.has.actors, true);
  assert.equal(vm.has.resources, false);
});

/* --------------------------------------------------------------- relations */

test('toRelationRows genera relaciones legibles por tipo', () => {
  const vm = normalizeEnrichedDetail({
    name: 'Ormuz',
    actors: { state: [{ name: 'Irán', role: 'actor' }], non_state: [] },
    resources: [{ name: 'Petróleo', relevance_level: 5, critical_mineral: true }],
    chokepoints: [{ name: 'Estrecho de Ormuz', risk_level: 5, energy_flow_relevance: true }],
    causal_links: [{ from: 'Bloqueo naval', to: 'Alza del crudo', strength: 4 }],
  });
  const rel = toRelationRows(vm, vm.name);
  assert.equal(rel.actorLinks[0].label, 'Irán ↔ Ormuz');
  assert.equal(rel.resourceLinks[0].label, 'Petróleo ↔ Ormuz');
  assert.equal(rel.resourceLinks[0].detail, 'mineral crítico');
  assert.equal(rel.chokepointLinks[0].label, 'Estrecho de Ormuz ↔ Ormuz');
  assert.equal(rel.causalChain[0].label, 'Bloqueo naval → Alza del crudo');
});

test('toRelationRows nunca lanza con view-model vacío', () => {
  const rel = toRelationRows(null, null);
  assert.deepEqual(rel.actorLinks, []);
  assert.deepEqual(rel.causalChain, []);
});

/* ----------------------------------------------------------------- filters */

const LOCAL_FOCOS = [
  { id: 'a', region: 'MENA', category: 'energia', intensity: 5, _api: { status: 'active' } },
  { id: 'b', region: 'Europa del Este', category: 'conflicto', intensity: 3 },
  { id: 'c', region: 'MENA', category: 'chokepoint', intensity: 4 },
];

const ENRICHED_FOCOS = [
  {
    id: 'e1', region: 'MENA', category: 'energia', intensity: 5, status: 'active',
    resources: [{ name: 'Petróleo' }], chokepoints: [{ name: 'Ormuz' }],
    actors: { state: [{ name: 'Irán' }], non_state: [] },
  },
  {
    id: 'e2', region: 'Asia-Pacífico', category: 'chokepoint', intensity: 4, status: 'monitoring',
    resources: [{ name: 'GNL' }], chokepoints: [{ name: 'Malaca' }],
    actors: { state: [{ name: 'China' }], non_state: [] },
  },
];

test('deriveFilterFacets: dimensiones sin datos se omiten (local sin recursos)', () => {
  const facets = deriveFilterFacets(LOCAL_FOCOS);
  assert.deepEqual(facets.region, ['Europa del Este', 'MENA']);
  assert.ok(facets.type.includes('energia'));
  assert.deepEqual(facets.severity, [1, 2, 3, 4, 5]);
  assert.ok(facets.status.includes('active'));
  assert.equal(facets.resource, undefined); // no hay recursos → oculto
  assert.equal(facets.chokepoint, undefined);
  assert.equal(facets.actor, undefined);
});

test('deriveFilterFacets: dataset enriquecido expone recurso/actor/chokepoint', () => {
  const facets = deriveFilterFacets(ENRICHED_FOCOS);
  assert.deepEqual(facets.resource, ['GNL', 'Petróleo']);
  assert.deepEqual(facets.chokepoint, ['Malaca', 'Ormuz']);
  assert.deepEqual(facets.actor, ['China', 'Irán']);
});

test('applyAdvancedFilters: sin filtros devuelve todo (copia)', () => {
  const out = applyAdvancedFilters(LOCAL_FOCOS, {});
  assert.equal(out.length, 3);
  assert.notEqual(out, LOCAL_FOCOS);
});

test('applyAdvancedFilters: región + severidad mínima', () => {
  const out = applyAdvancedFilters(LOCAL_FOCOS, { region: 'MENA', severity: 5 });
  assert.deepEqual(out.map(f => f.id), ['a']);
});

test('applyAdvancedFilters: "all" y valores vacíos se ignoran', () => {
  const out = applyAdvancedFilters(LOCAL_FOCOS, { region: 'all', type: '', status: null });
  assert.equal(out.length, 3);
});

test('applyAdvancedFilters: dimensión desconocida no rompe ni descarta', () => {
  const out = applyAdvancedFilters(LOCAL_FOCOS, { galaxia: 'via-lactea' });
  assert.equal(out.length, 3);
});

test('applyAdvancedFilters: filtro por recurso enriquecido', () => {
  const out = applyAdvancedFilters(ENRICHED_FOCOS, { resource: 'Petróleo' });
  assert.deepEqual(out.map(f => f.id), ['e1']);
});

test('focoFacetValues tolera foco vacío', () => {
  const v = focoFacetValues(null);
  assert.equal(v.region, null);
  assert.deepEqual(v.resources, []);
});

/* -------------------------------------------------------- loadEnrichedDetail */

test('loadEnrichedDetail: useApi=false → normaliza foco local, source=local', async () => {
  const foco = { id: 'z', title: 'Z', region: 'Global', intensity: 2 };
  const { detail, source, error } = await loadEnrichedDetail('z', {
    localFoco: foco, config: { useApi: false },
  });
  assert.equal(source, 'local');
  assert.equal(error, null);
  assert.equal(detail.name, 'Z');
});

test('loadEnrichedDetail: fallo de red → cae a local sin romper', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('network down'); };
  try {
    const foco = { id: 'z', title: 'Z' };
    const { detail, source, error } = await loadEnrichedDetail('z', {
      localFoco: foco,
      config: { useApi: true, apiBase: '', detailPath: '/api/v1/conflicts/:id', detailStaticPath: null, timeoutMs: 500 },
    });
    assert.equal(source, 'local');
    assert.equal(detail.name, 'Z');
    assert.ok(error);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('loadEnrichedDetail: API responde envuelto en {data} → source=api', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ data: { slug: 'api-x', name: 'API X', resources: [{ name: 'Uranio' }] } }),
  });
  try {
    const { detail, source } = await loadEnrichedDetail('api-x', {
      localFoco: { id: 'api-x', title: 'local' },
      config: { useApi: true, apiBase: '', detailPath: '/api/v1/conflicts/:id', detailStaticPath: null, timeoutMs: 500 },
    });
    assert.equal(source, 'api');
    assert.equal(detail.name, 'API X');
    assert.equal(detail.resources[0].name, 'Uranio');
  } finally {
    globalThis.fetch = origFetch;
  }
});
