// GEOPÓLEM API v1 (Sprint 9) — runner de migraciones relacionales.
// ---------------------------------------------------------------------------
// Aplica, en orden lexicográfico, los ficheros SQL de db/migrations/*.sql sobre
// la base indicada por DATABASE_URL. Están pensados para ser IDEMPOTENTES y NO
// DESTRUCTIVOS (ver cada .sql). El esquema base (db/schema.sql) NO lo aplica
// este runner: es responsabilidad del operador / CI (psql -f db/schema.sql),
// para no reejecutar por accidente el DDL completo.
//
// Modos:
//   (por defecto)  Requiere DATABASE_URL. Aplica cada migración en su propia
//                  conexión/transacción. Falla (exit 1) sin tocar nada más si
//                  una migración da error.
//   --check        NO usa DB. Lint estático de las migraciones: verifica que
//                  existen, que no contienen sentencias DESTRUCTIVAS y que usan
//                  guardas idempotentes. Útil en CI sin Postgres.
//   --list         Lista las migraciones detectadas y sale.
//   --help
//
// Uso:
//   DATABASE_URL=postgres://... node scripts/migrate.mjs
//   node scripts/migrate.mjs --check
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, '..', 'db', 'migrations');

// Patrones que consideramos DESTRUCTIVOS: una migración de este proyecto nunca
// debe borrar datos ni estructuras. `DROP INDEX`/`DROP VIEW` sobre objetos
// propios podría ser legítimo, pero para máxima seguridad los prohibimos aquí y
// preferimos CREATE OR REPLACE / IF NOT EXISTS.
const DESTRUCTIVE = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+SCHEMA\b/i,
  /\bDROP\s+DATABASE\b/i,
  /\bDROP\s+TYPE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bALTER\s+TYPE\s+\w+\s+DROP\b/i,
];

// Marca de idempotencia esperada (al menos una por fichero).
const IDEMPOTENT_HINTS = [
  /IF\s+NOT\s+EXISTS/i,
  /CREATE\s+OR\s+REPLACE/i,
  /ADD\s+VALUE\s+IF\s+NOT\s+EXISTS/i,
  /DO\s+\$\$/i,
];

function log(msg) { console.log(`[migrate] ${msg}`); }

// Ignora comentarios de línea para el lint (evita falsos positivos por texto
// explicativo dentro de -- comentarios).
function stripLineComments(sql) {
  return sql.split('\n').map((line) => {
    const idx = line.indexOf('--');
    return idx >= 0 ? line.slice(0, idx) : line;
  }).join('\n');
}

export function listMigrations() {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => resolve(MIGRATIONS_DIR, f));
}

// Lint estático de un fichero SQL. Devuelve { ok, errors[], warnings[] }.
export function lintMigrationSql(sql, name = 'migration') {
  const errors = [];
  const warnings = [];
  const code = stripLineComments(sql);

  for (const re of DESTRUCTIVE) {
    if (re.test(code)) errors.push(`${name}: contiene sentencia destructiva (${re.source}).`);
  }
  if (!IDEMPOTENT_HINTS.some((re) => re.test(code))) {
    warnings.push(`${name}: no se detectó guarda de idempotencia (IF NOT EXISTS / CREATE OR REPLACE / DO $$).`);
  }
  if (code.trim().length === 0) errors.push(`${name}: fichero vacío.`);

  return { ok: errors.length === 0, errors, warnings };
}

function runCheck() {
  const files = listMigrations();
  if (files.length === 0) {
    log('ERROR: no se encontraron migraciones en db/migrations/.');
    return 1;
  }
  let failed = false;
  for (const file of files) {
    const name = basename(file);
    const { ok, errors, warnings } = lintMigrationSql(readFileSync(file, 'utf8'), name);
    for (const w of warnings) log(`AVISO  ${w}`);
    if (!ok) { failed = true; for (const e of errors) log(`FALLO  ${e}`); }
    else log(`OK     ${name} (idempotente, no destructiva).`);
  }
  if (failed) { log('Lint de migraciones FALLIDO.'); return 1; }
  log(`Lint OK: ${files.length} migración(es) verificada(s).`);
  return 0;
}

async function runApply() {
  if (!process.env.DATABASE_URL) {
    log('ERROR: DATABASE_URL no está definida. Define la conexión o usa --check '
      + 'para el lint estático sin base de datos. No se aplicó ninguna migración.');
    return 1;
  }
  let pg;
  try {
    pg = await import('pg');
  } catch {
    log('ERROR: el paquete "pg" no está instalado. Ejecuta `npm install` en api-server/.');
    return 1;
  }
  const { Client } = pg.default || pg;

  const files = listMigrations();
  if (files.length === 0) { log('No hay migraciones que aplicar.'); return 0; }

  for (const file of files) {
    const name = basename(file);
    const sql = readFileSync(file, 'utf8');
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: String(process.env.PG_SSL).toLowerCase() === 'true' ? { rejectUnauthorized: false } : undefined,
    });
    try {
      await client.connect();
      log(`Aplicando ${name}…`);
      await client.query(sql);
      log(`OK ${name}`);
    } catch (err) {
      log(`ERROR aplicando ${name}: ${err.message}`);
      await client.end().catch(() => {});
      return 1;
    }
    await client.end().catch(() => {});
  }
  log(`Migraciones aplicadas: ${files.length}.`);
  return 0;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--help') || args.has('-h')) {
    console.log(`Uso: node scripts/migrate.mjs [--check|--list]
  (sin flags)  Aplica db/migrations/*.sql sobre DATABASE_URL (idempotente).
  --check      Lint estático (sin DB): no destructivas + idempotentes.
  --list       Lista las migraciones detectadas.`);
    return 0;
  }
  if (args.has('--list')) {
    for (const f of listMigrations()) log(basename(f));
    return 0;
  }
  if (args.has('--check')) return runCheck();
  return runApply();
}

// Sólo ejecuta main() al invocar como script (no al importar en tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => process.exit(code)).catch((err) => {
    console.error('[migrate] error no controlado:', err?.message || err);
    process.exit(1);
  });
}
