// GEOPÓLEM API v1 (Sprint 9) — lint estático de migraciones relacionales.
// ---------------------------------------------------------------------------
// Sin base de datos: valida que las migraciones existen, son NO DESTRUCTIVAS y
// usan guardas de idempotencia. Así el contrato de migración se verifica en CI
// local incluso sin PostgreSQL. La ejecución real se prueba en el job PostGIS.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const { listMigrations, lintMigrationSql } = await import('../scripts/migrate.mjs');

test('se detectan las migraciones esperadas en orden', () => {
  const names = listMigrations().map((f) => basename(f));
  assert.ok(names.includes('0001_cms_status.sql'));
  assert.ok(names.includes('0002_relational_integrity.sql'));
  assert.ok(names.includes('0003_publish_view.sql'));
  // Orden lexicográfico estable.
  assert.deepEqual(names, [...names].sort());
});

test('todas las migraciones pasan el lint (no destructivas, idempotentes)', () => {
  for (const file of listMigrations()) {
    const name = basename(file);
    const { ok, errors } = lintMigrationSql(readFileSync(file, 'utf8'), name);
    assert.ok(ok, `${name} no pasó el lint: ${errors.join('; ')}`);
  }
});

test('el lint detecta sentencias destructivas', () => {
  const bad = 'DROP TABLE conflicts;';
  const { ok, errors } = lintMigrationSql(bad, 'bad.sql');
  assert.equal(ok, false);
  assert.ok(errors.some((e) => /destructiva/i.test(e)));
});

test('el lint ignora palabras destructivas dentro de comentarios', () => {
  const sql = '-- esto NO debe: DROP TABLE x\nCREATE INDEX IF NOT EXISTS idx_x ON t (a);';
  const { ok } = lintMigrationSql(sql, 'ok.sql');
  assert.equal(ok, true);
});

test('el lint avisa si falta guarda de idempotencia', () => {
  const sql = 'CREATE INDEX idx_y ON t (a);';
  const { ok, warnings } = lintMigrationSql(sql, 'warn.sql');
  assert.equal(ok, true); // no es error, sólo aviso
  assert.ok(warnings.some((w) => /idempotencia/i.test(w)));
});
