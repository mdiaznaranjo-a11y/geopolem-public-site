// GEOPÓLEM API v1 (Sprint 6) — tests de contrato del detalle enriquecido.
// ---------------------------------------------------------------------------
// El detalle de conflicto declara relaciones (actores/recursos/chokepoints/
// causal_links). En modo estático (sin DB) son arrays vacíos pero SIEMPRE
// presentes: contrato estable para el frontend y para Sprint 7. Con DB, la capa
// `getConflictRelations` los rellena (verificado aquí a nivel de forma, ya que
// el CI con PostGIS ejercita la ruta real).
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';

delete process.env.DATABASE_URL;

const { CONFIG } = await import('../src/config.mjs');
CONFIG.obsLog = false;
const { route } = await import('../src/router.mjs');
const { queryLayer } = await import('../src/db.mjs');

function call(path) {
  const url = new URL(`http://x${path}`);
  return route('GET', url.pathname, url.searchParams);
}

test('detalle (static): relaciones presentes como arrays vacíos', async () => {
  const listBody = (await call('/api/v1/conflicts')).body;
  const slug = listBody.data[0].slug;
  const { status, body } = await call(`/api/v1/conflicts/${encodeURIComponent(slug)}`);
  assert.equal(status, 200);
  const d = body.data;
  assert.ok(d.actors && Array.isArray(d.actors.state) && Array.isArray(d.actors.non_state));
  assert.ok(Array.isArray(d.resources));
  assert.ok(Array.isArray(d.chokepoints));
  assert.ok(Array.isArray(d.causal_links));
  assert.ok(Array.isArray(d.sources));
  // En fallback no se inventan datos: vacío.
  assert.equal(d.actors.state.length, 0);
  assert.equal(d.resources.length, 0);
});

test('la capa DB expone getConflictRelations (contrato para Sprint 7)', () => {
  assert.equal(typeof queryLayer.getConflictRelations, 'function');
});
