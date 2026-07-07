// GEOPÓLEM (Sprint 12) — tests de salud de contenidos (content-health.mjs).
// ---------------------------------------------------------------------------
// Verifica el cálculo PURO de KPIs editoriales: distribución por región/tipo/
// severidad/estado, detección de contenidos sin fuentes y sin relaciones, y el
// conteo tolerante de relaciones (varias formas de detalle). También comprueba
// el reporte contra el puente estático real del repo.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const {
  computeContentHealth, countRelations, formatContentHealth,
} = await import('../../content-health.mjs');

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');

/* --------------------------------------------------------------- countRelations */

test('countRelations soporta actors {state,non_state} y arrays', () => {
  const a = countRelations({
    actors: { state: [{ name: 'X' }], non_state: [{ name: 'Y' }] },
    resources: [{ name: 'Petróleo' }],
    chokepoints: [],
    causal_links: [{ title: 'c' }],
  });
  assert.equal(a.actors, 2);
  assert.equal(a.resources, 1);
  assert.equal(a.causal_links, 1);
  assert.equal(a.total, 4);
});

test('countRelations con detalle vacío/nulo → ceros', () => {
  assert.equal(countRelations(null).total, 0);
  assert.equal(countRelations({}).total, 0);
});

/* ------------------------------------------------------------ computeContentHealth */

test('computeContentHealth distribuye por región/tipo/severidad y detecta carencias', () => {
  const items = [
    { id: 'a', primary_region: { label: 'MENA' }, conflict_type: { label: 'Agua' }, status: 'active', intensity_level: 4 },
    { id: 'b', primary_region: { label: 'MENA' }, conflict_type: { label: 'Conflicto' }, status: 'active', intensity_level: 5 },
    { id: 'c', primary_region: { label: 'Global' }, conflict_type: { label: 'Defensa' }, status: 'active', intensity_level: 2 },
  ];
  const details = {
    a: { sources: [{ title: 's' }], resources: [{ name: 'Agua' }] },
    b: { sources: [], actors: { state: [], non_state: [] } }, // sin sources ni relaciones
    // c: ausente → cuenta como sin sources y sin relaciones + missing_detail
  };
  const r = computeContentHealth(items, details);
  assert.equal(r.totals.conflicts, 3);
  assert.equal(r.totals.missing_details, 1);
  assert.equal(r.distribution.by_region.MENA, 2);
  assert.equal(r.distribution.by_severity['4'], 1);
  assert.deepEqual(r.content_gaps.without_sources.sort(), ['b', 'c']);
  assert.deepEqual(r.content_gaps.without_relations.sort(), ['b', 'c']);
  assert.equal(r.content_gaps.without_sources_count, 2);
});

test('computeContentHealth con detalle enriquecido no marca carencias', () => {
  const items = [{ id: 'x', primary_region: { label: 'MENA' }, intensity_level: 3 }];
  const details = { x: { sources: [{ title: 's' }], resources: [{ name: 'r' }] } };
  const r = computeContentHealth(items, details);
  assert.equal(r.content_gaps.without_sources_count, 0);
  assert.equal(r.content_gaps.without_relations_count, 0);
});

test('formatContentHealth produce texto legible sin lanzar', () => {
  const r = computeContentHealth([{ id: 'a', intensity_level: 4 }], {});
  const txt = formatContentHealth(r);
  assert.match(txt, /salud de contenidos/i);
  assert.match(txt, /Conflictos totales/);
});

/* -------------------------------------------- integración con puente estático real */

test('reporte sobre el puente estático real del repo es coherente', () => {
  const listDoc = JSON.parse(readFileSync(resolve(REPO_ROOT, 'api/v1/conflicts.json'), 'utf8'));
  const items = listDoc.data;
  const details = {};
  for (const it of items) {
    const id = it.id || it.slug;
    const p = resolve(REPO_ROOT, `api/v1/conflicts/${id}.json`);
    if (existsSync(p)) details[id] = JSON.parse(readFileSync(p, 'utf8')).data;
  }
  const r = computeContentHealth(items, details);
  assert.equal(r.totals.conflicts, items.length);
  assert.ok(r.totals.conflicts > 0);
  // La distribución total por estado debe sumar el nº de conflictos.
  const statusSum = Object.values(r.distribution.by_status).reduce((a, b) => a + b, 0);
  assert.equal(statusSum, items.length);
});
