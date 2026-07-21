// GEOPÓLEM (Sprint 13) — tests del artefacto de preview enriquecido y de la
// extensión by_conflict de content-health. Verifica compatibilidad de contrato
// y que los artefactos CANÓNICOS del puente estático NO se corrompen.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const { computeContentHealth } = await import('../../content-health.mjs');
const { validateDetail } = await import('../scripts/export-static-bridge.mjs');

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/* -------------------------------------------- content-health.by_conflict (Sprint 13) */

test('computeContentHealth expone by_conflict con sources y relaciones por id', () => {
  const items = [{ id: 'a', intensity_level: 4 }, { id: 'b', intensity_level: 2 }];
  const details = {
    a: { sources: [{ title: 's' }], resources: [{ name: 'r' }], actors: { state: [{ name: 'X' }], non_state: [] } },
    // b ausente → detail_present:false
  };
  const r = computeContentHealth(items, details);
  assert.equal(r.by_conflict.a.detail_present, true);
  assert.equal(r.by_conflict.a.sources, 1);
  assert.equal(r.by_conflict.a.actors, 1);
  assert.equal(r.by_conflict.a.resources, 1);
  assert.equal(r.by_conflict.a.relations_total, 2);
  assert.equal(r.by_conflict.b.detail_present, false);
  assert.equal(r.by_conflict.b.sources, 0);
});

/* -------------------------------------- artefacto de preview enriquecido en disco */

test('conflicts.seed.enriched.json (si existe) respeta el contrato de detalle v1', () => {
  const p = resolve(REPO_ROOT, 'api/v1/conflicts.seed.enriched.json');
  if (!existsSync(p)) return; // opcional: se genera con seed:enriched
  const doc = readJson(p);
  assert.equal(doc.contract, 'sprint-13-seed-enriched-v1');
  assert.ok(doc.data && typeof doc.data === 'object');
  for (const [id, data] of Object.entries(doc.data)) {
    // Cada entrada debe validar como detalle v1 (mismo validador del exportador).
    const { ok, errors } = validateDetail({ data, meta: { api_version: 'v1' } }, id);
    assert.equal(ok, true, `${id}: ${errors.join('; ')}`);
  }
});

test('los detalles CANÓNICOS del puente no fueron corrompidos por la semilla', () => {
  // Los detalles reales siguen sin fuentes/relaciones (el enriquecimiento vive en
  // el artefacto de preview aparte, no en los canónicos). Esto protege producción.
  const list = readJson(resolve(REPO_ROOT, 'api/v1/conflicts.json')).data;
  for (const it of list) {
    const p = resolve(REPO_ROOT, `api/v1/conflicts/${it.id}.json`);
    if (!existsSync(p)) continue;
    const d = readJson(p).data;
    assert.ok(Array.isArray(d.sources), `${it.id}: sources debe seguir siendo array`);
    assert.ok(Array.isArray(d.resources));
  }
});
