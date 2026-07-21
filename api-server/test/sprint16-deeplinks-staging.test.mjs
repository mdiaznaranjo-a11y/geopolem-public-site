// GEOPÓLEM (Sprint 16) — QA de deep-links y filtros con DATOS DE STAGING.
// ---------------------------------------------------------------------------
// Sin navegador: construye "focos" a partir de los detalles reales de staging
// y ejercita el mismo motor de filtros y deep-links de la app pública:
//   • deriveFilterFacets / applyAdvancedFilters (public-enriched.mjs)
//   • parseDeepLink / serializeDeepLink (deeplinks.mjs)
// Cubre región, tipo, severidad, recurso, actor, chokepoint y la serialización
// de URL (round-trip) para abrir un foco con filtros. Datos reales de staging.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { deriveFilterFacets, applyAdvancedFilters } from '../../public-enriched.mjs';
import { parseDeepLink, serializeDeepLink, deepLinkEquals, FILTER_KEYS } from '../../deeplinks.mjs';
import { stagingBundlePath, stagingDetailPath, unwrap } from '../../staging-consume.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const abs = (rel) => resolve(REPO_ROOT, rel);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// Construye un "foco" (forma data.js que consumen los filtros) desde un detalle
// enriquecido de staging. Alinea claves: primary_region→region, conflict_type→
// category, metrics.intensity_level→intensity. Relaciones pasan tal cual (las
// normaliza focoFacetValues internamente).
function focoFromStaging(detail) {
  const d = unwrap(detail);
  return {
    id: d.id,
    slug: d.slug,
    region: d.primary_region?.label ?? null,
    category: d.conflict_type?.label ?? null,
    intensity: d.metrics?.intensity_level ?? null,
    status: d.status ?? null,
    resources: d.resources ?? [],
    chokepoints: d.chokepoints ?? [],
    actors: d.actors ?? { state: [], non_state: [] },
  };
}

const bundle = readJson(abs(stagingBundlePath()));
const ids = Object.keys(bundle.data);
const focos = ids.map((id) => focoFromStaging(readJson(abs(stagingDetailPath(id)))));

test('las facetas derivadas de staging cubren las 7 dimensiones de filtro', () => {
  const facets = deriveFilterFacets(focos);
  assert.ok(facets.region?.includes('MENA'));
  assert.ok(facets.type?.includes('Chokepoint'));
  assert.deepEqual(facets.severity, [1, 2, 3, 4, 5]);
  assert.ok(facets.resource?.includes('Petróleo'));
  assert.ok(facets.actor?.includes('Rusia'));
  assert.ok(facets.chokepoint?.includes('Bab el-Mandeb'));
});

test('filtro por región (MENA) selecciona sólo focos de esa región', () => {
  const out = applyAdvancedFilters(focos, { region: 'MENA' });
  assert.ok(out.length >= 2);
  assert.ok(out.every((f) => f.region === 'MENA'));
  assert.ok(out.some((f) => f.id === 'red-sea'));
});

test('filtro por tipo (Chokepoint) y por severidad mínima', () => {
  const chok = applyAdvancedFilters(focos, { type: 'Chokepoint' });
  assert.ok(chok.every((f) => f.category === 'Chokepoint'));

  const severe = applyAdvancedFilters(focos, { severity: 5 });
  assert.ok(severe.length >= 1);
  assert.ok(severe.every((f) => f.intensity >= 5));
  assert.ok(severe.some((f) => f.id === 'ukr-rus'));
});

test('filtro por recurso, actor y chokepoint contra datos de staging', () => {
  const petro = applyAdvancedFilters(focos, { resource: 'Petróleo' });
  assert.ok(petro.some((f) => f.id === 'red-sea'));

  const rusia = applyAdvancedFilters(focos, { actor: 'Rusia' });
  assert.ok(rusia.some((f) => f.id === 'ukr-rus'));
  assert.ok(rusia.every((f) => f.actors.state.some((a) => a.name === 'Rusia')));

  const bab = applyAdvancedFilters(focos, { chokepoint: 'Bab el-Mandeb' });
  assert.ok(bab.some((f) => f.id === 'red-sea'));
});

test('filtros combinados (región + severidad) se aplican de forma AND', () => {
  const out = applyAdvancedFilters(focos, { region: 'MENA', severity: 4 });
  assert.ok(out.length >= 1);
  assert.ok(out.every((f) => f.region === 'MENA' && f.intensity >= 4));
});

test('una dimensión desconocida o vacía nunca descarta focos', () => {
  assert.equal(applyAdvancedFilters(focos, { unknown: 'x' }).length, focos.length);
  assert.equal(applyAdvancedFilters(focos, { region: 'all', type: '' }).length, focos.length);
});

test('deep-link: abrir un foco de staging con filtros y round-trip de URL', () => {
  const state = {
    view: 'map',
    focus: 'red-sea',
    filters: { region: 'MENA', type: 'Chokepoint', severity: 4, resource: 'Petróleo' },
  };
  const hash = serializeDeepLink(state);
  assert.match(hash, /^#/);
  const parsed = parseDeepLink(hash, { knownViews: ['map', 'list'] });
  assert.equal(parsed.focus, 'red-sea');
  assert.equal(parsed.view, 'map');
  assert.equal(parsed.filters.region, 'MENA');
  assert.equal(parsed.filters.severity, 4);
  assert.ok(deepLinkEquals(state, parsed));
});

test('deep-link: cada conflicto de staging es direccionable por #foco={id}', () => {
  for (const id of ids) {
    const parsed = parseDeepLink(`#foco=${id}`);
    assert.equal(parsed.focus, id);
    assert.ok(bundle.data[parsed.focus], `el foco ${id} existe en el bundle de staging`);
  }
});

test('deep-link: el alias ?conflict= y el hash producen el mismo foco', () => {
  const fromHash = parseDeepLink('#foco=ukr-rus');
  const fromQuery = parseDeepLink({ search: '?conflict=ukr-rus' });
  assert.equal(fromHash.focus, fromQuery.focus);
});

test('deep-link: aplicar filtros parseados de una URL sobre focos de staging', () => {
  // Simula compartir una URL con filtros y reconstruir la vista filtrada.
  const parsed = parseDeepLink('#view=map&region=MENA&severity=4');
  const out = applyAdvancedFilters(focos, parsed.filters);
  assert.ok(out.length >= 1);
  assert.ok(out.every((f) => f.region === 'MENA' && f.intensity >= 4));
  // FILTER_KEYS del deeplink cubre las dimensiones de filtro avanzadas.
  for (const k of ['region', 'type', 'severity', 'resource', 'actor', 'chokepoint']) {
    assert.ok(FILTER_KEYS.includes(k), `FILTER_KEYS debe incluir ${k}`);
  }
});
