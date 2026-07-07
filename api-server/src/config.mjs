// GEOPÓLEM API v1 (Sprint 3) — configuración por entorno.
// ---------------------------------------------------------------------------
// Toda la configuración viene de variables de entorno. Sin DATABASE_URL el
// servidor arranca igual y sirve desde el puente estático JSON (Sprint 2),
// de modo que la API es ejecutable en local sin PostgreSQL.
// ---------------------------------------------------------------------------

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Raíz del repositorio (api-server/src → repo root).
export const REPO_ROOT = resolve(__dirname, '..', '..');

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true' || String(value) === '1';
}

export const CONFIG = {
  port: num(process.env.PORT, 8787),
  host: process.env.HOST || '0.0.0.0',

  // Conexión PostgreSQL/PostGIS. Si está vacío → modo fallback estático.
  databaseUrl: process.env.DATABASE_URL || '',

  // Pool / consultas.
  pgPoolMax: num(process.env.PG_POOL_MAX, 5),
  pgStatementTimeoutMs: num(process.env.PG_STATEMENT_TIMEOUT_MS, 5000),
  pgConnectTimeoutMs: num(process.env.PG_CONNECT_TIMEOUT_MS, 4000),

  // SSL para proveedores gestionados (Render, Supabase, Neon...).
  pgSsl: bool(process.env.PG_SSL, false),

  // CORS: por defecto abierto (API pública read-only). Restríngelo en prod.
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Paginación (alineada con especificacion_api_geopolem.md).
  defaultPageSize: num(process.env.API_DEFAULT_PAGE_SIZE, 20),
  maxPageSize: num(process.env.API_MAX_PAGE_SIZE, 100),

  // Rutas del puente estático (Sprint 2) usadas como respaldo permanente.
  staticConflictsPath: resolve(REPO_ROOT, 'api/v1/conflicts.json'),
  staticMapPath: resolve(REPO_ROOT, 'api/v1/conflicts/active/map.json'),

  apiVersion: 'v1',
  serviceName: 'geopolem-api',
};

export function hasDatabase() {
  return Boolean(CONFIG.databaseUrl);
}
