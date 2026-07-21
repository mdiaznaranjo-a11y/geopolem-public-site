// GEOPÓLEM API v1 (Sprint 7) — tests de validación del contrato de escritura.
// ---------------------------------------------------------------------------
// Funciones puras: no tocan DB ni red. Verifican el contrato de creación/edición
// de conflictos, el ciclo de estados editoriales y el mapeo al enum persistente.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';

const {
  validateConflictInput, validateStatusTransition,
  cmsStatusToDbStatus, dbStatusToCmsStatus,
  CMS_STATUSES, STATUS_TRANSITIONS,
} = await import('../src/validation.mjs');

test('createInput: slug y name obligatorios', () => {
  const r = validateConflictInput({}, { partial: false });
  assert.equal(r.valid, false);
  const fields = r.errors.map((e) => e.field);
  assert.ok(fields.includes('slug'));
  assert.ok(fields.includes('name'));
});

test('createInput: payload mínimo válido normaliza y default status=draft', () => {
  const r = validateConflictInput({ slug: 'conflicto-x', name: 'Conflicto X' }, { partial: false });
  assert.equal(r.valid, true);
  assert.equal(r.value.slug, 'conflicto-x');
  assert.equal(r.value.name, 'Conflicto X');
  assert.equal(r.value.status, 'draft');
});

test('createInput: slug inválido rechazado', () => {
  const r = validateConflictInput({ slug: 'No Válido', name: 'X' }, { partial: false });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.field === 'slug'));
});

test('createInput: métricas fuera de rango y dimensiones no booleanas fallan', () => {
  const r = validateConflictInput({
    slug: 'c', name: 'Nombre', intensity_level: 9, energy_dimension: 'sí',
  }, { partial: false });
  assert.equal(r.valid, false);
  const fields = r.errors.map((e) => e.field);
  assert.ok(fields.includes('intensity_level'));
  assert.ok(fields.includes('energy_dimension'));
});

test('createInput: location valida rangos geográficos', () => {
  const bad = validateConflictInput({
    slug: 'c', name: 'Nombre', location: { latitude: 120, longitude: 0 },
  }, { partial: false });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.some((e) => e.field === 'location.latitude'));

  const good = validateConflictInput({
    slug: 'c', name: 'Nombre', location: { latitude: 40.4, longitude: -3.7 },
  }, { partial: false });
  assert.equal(good.valid, true);
  assert.deepEqual(good.value.location, { latitude: 40.4, longitude: -3.7 });
});

test('updateInput (partial): sin campos → error; con un campo → ok', () => {
  const empty = validateConflictInput({}, { partial: true });
  assert.equal(empty.valid, false);

  const one = validateConflictInput({ name: 'Nuevo nombre' }, { partial: true });
  assert.equal(one.valid, true);
  assert.equal(one.value.name, 'Nuevo nombre');
  assert.equal('slug' in one.value, false);
});

test('mapeo de estados editoriales ↔ enum persistente', () => {
  assert.equal(cmsStatusToDbStatus('published'), 'active');
  assert.equal(cmsStatusToDbStatus('review'), 'draft');
  assert.equal(cmsStatusToDbStatus('draft'), 'draft');
  assert.equal(cmsStatusToDbStatus('archived'), 'archived');
  assert.equal(dbStatusToCmsStatus('active'), 'published');
  assert.equal(dbStatusToCmsStatus('deprecated'), 'archived');
});

test('transiciones: draft→published permitida; published→draft no', () => {
  assert.equal(validateStatusTransition('draft', 'published').valid, true);
  assert.equal(validateStatusTransition('published', 'draft').valid, false);
  assert.equal(validateStatusTransition('published', 'archived').valid, true);
});

test('transiciones: mismo estado no permitido; destino inválido falla', () => {
  assert.equal(validateStatusTransition('draft', 'draft').valid, false);
  assert.equal(validateStatusTransition('draft', 'no-existe').valid, false);
});

test('transiciones: sin estado origen conocido (prepared) acepta cualquier destino válido', () => {
  const r = validateStatusTransition(null, 'published');
  assert.equal(r.valid, true);
  assert.equal(r.value, 'published');
});

test('vocabulario CMS y tabla de transiciones coherentes', () => {
  assert.deepEqual(CMS_STATUSES, ['draft', 'review', 'published', 'archived']);
  for (const from of Object.keys(STATUS_TRANSITIONS)) {
    for (const to of STATUS_TRANSITIONS[from]) {
      assert.ok(CMS_STATUSES.includes(to), `${to} debe ser un estado válido`);
    }
  }
});
