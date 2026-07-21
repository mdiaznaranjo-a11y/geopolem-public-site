// GEOPÓLEM API v1 (Sprint 9) — flujo editorial publicable y regla de visibilidad.
// ---------------------------------------------------------------------------
// Verifica, con funciones puras (sin DB), que:
//   • El ciclo draft → review → published → archived es transitable por pasos
//     permitidos y bloquea saltos ilegales.
//   • Sólo `published` (→ enum 'active') es públicamente visible.
//   • El export estático materializa esa regla: sólo items 'active' entran al
//     mapa activo, coherente con isPubliclyVisible / dbStatusIsPublic.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';

const {
  validateStatusTransition, cmsStatusToDbStatus, isPubliclyVisible,
  dbStatusIsPublic, PUBLISHABLE_CMS_STATUSES, CMS_STATUSES,
} = await import('../src/validation.mjs');
const { buildActiveMapPayload, buildConflictsPayload } = await import('../scripts/export-static-bridge.mjs');

test('ciclo completo draft→review→published→archived transita paso a paso', () => {
  const path = ['draft', 'review', 'published', 'archived'];
  for (let i = 0; i < path.length - 1; i++) {
    const t = validateStatusTransition(path[i], path[i + 1]);
    assert.ok(t.valid, `transición ${path[i]}→${path[i + 1]} debería ser válida: ${JSON.stringify(t.errors)}`);
  }
});

test('saltos ilegales del ciclo se rechazan', () => {
  // published no puede volver directamente a draft (debe pasar por review/archived)
  assert.equal(validateStatusTransition('published', 'draft').valid, false);
  // archived sólo puede reabrirse a draft
  assert.equal(validateStatusTransition('archived', 'published').valid, false);
});

test('published es el único estado editorial público', () => {
  assert.deepEqual(PUBLISHABLE_CMS_STATUSES, ['published']);
  assert.equal(isPubliclyVisible('published'), true);
  for (const s of CMS_STATUSES.filter((x) => x !== 'published')) {
    assert.equal(isPubliclyVisible(s), false, `${s} no debe ser público`);
  }
});

test('mapeo editorial→enum y visibilidad del enum son coherentes', () => {
  // published → active (enum) y active es público.
  assert.equal(cmsStatusToDbStatus('published'), 'active');
  assert.equal(dbStatusIsPublic('active'), true);
  assert.equal(dbStatusIsPublic('published'), true); // si se persiste tal cual (migración 0001)
  assert.equal(dbStatusIsPublic('draft'), false);
  assert.equal(dbStatusIsPublic('archived'), false);
});

test('export estático: sólo conflictos active (=published) entran al mapa', () => {
  const items = [
    { id: '1', slug: 'a', name: 'A', status: 'active', intensity_level: 3, escalation_risk: 2,
      energy_dimension: true, primary_region: { label: 'MENA' },
      location: { latitude: 10, longitude: 20 } },
    { id: '2', slug: 'b', name: 'B', status: 'draft', intensity_level: 4, escalation_risk: 3,
      energy_dimension: false, primary_region: { label: 'Asia' },
      location: { latitude: 11, longitude: 21 } },
    { id: '3', slug: 'c', name: 'C', status: 'archived', intensity_level: 2, escalation_risk: 1,
      energy_dimension: false, primary_region: { label: 'Europa' },
      location: { latitude: 12, longitude: 22 } },
  ];
  const map = buildActiveMapPayload(items);
  assert.equal(map.features.length, 1);
  assert.equal(map.features[0].properties.slug, 'a');

  // La lista sí materializa el catálogo entero (draft/archived incluidos): la
  // regla de visibilidad pública aplica al MAPA activo, no al inventario.
  const listPayload = buildConflictsPayload(items);
  assert.equal(listPayload.data.length, 3);
});
