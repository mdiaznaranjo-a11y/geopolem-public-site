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

  // --- Autenticación JWT (Sprint 5) --------------------------------------
  // Modo de auth de la API v1. Por defecto 'public' para NO romper la PWA ni
  // GitHub Pages (acceso de lectura anónimo). Activable por entorno:
  //   public   → sin auth (comportamiento histórico, por defecto).
  //   optional → si viene Bearer token se valida (401 si es inválido); sin
  //              token se permite igualmente.
  //   required → todo endpoint de datos exige Bearer token válido (401 si no).
  // /api/v1/health queda SIEMPRE público (healthcheck de contenedor/oncall).
  authMode: (process.env.GEOP_API_AUTH_MODE || 'public').toLowerCase(),
  // Secreto HS256. NUNCA hardcodear: se lee de entorno. Vacío en modo public.
  jwtSecret: process.env.JWT_SECRET || '',
  // Holgura para exp/nbf (segundos) ante desfase de reloj.
  jwtLeewaySec: num(process.env.JWT_LEEWAY_SEC, 30),
  // Emisor/audiencia esperados (opcionales; si se definen, se validan).
  jwtIssuer: process.env.JWT_ISSUER || '',
  jwtAudience: process.env.JWT_AUDIENCE || '',
  // Secreto HS256 ANTERIOR (Sprint 7): habilita rotación sin caída. Durante la
  // ventana de rotación se aceptan tokens firmados con el secreto nuevo O el
  // anterior. Vacío por defecto (sin rotación en curso). Ver docs/jwt-rotation.md.
  jwtSecretPrevious: process.env.JWT_SECRET_PREVIOUS || '',

  // --- Observabilidad de meta.source (Sprint 5) --------------------------
  // Emite una línea JSON estructurada por respuesta con el origen de datos
  // (database|static|error). Desactivable en tests/entornos ruidosos.
  obsLog: bool(process.env.GEOP_OBS_LOG, true),

  // --- Métricas duraderas / Prometheus (Sprint 6) ------------------------
  // Expone GET /api/v1/metrics en formato de exposición Prometheus (texto)
  // con contadores acumulados (requests, errores, latencia, auth denials,
  // ratio de origen). Cero dependencias: se construye el texto a mano.
  // /metrics queda SIEMPRE público (scraping del recolector), igual que health.
  metricsEnabled: bool(process.env.GEOP_METRICS_ENABLED, true),

  // --- Rate limiting simple (Sprint 6) -----------------------------------
  // Ventana fija en memoria (cero dependencias). Pensado para endpoints de
  // datos cuando la auth está activa; NO afecta al modo public por defecto
  // (rateLimitMax=0 → desactivado). /health y /metrics quedan siempre exentos.
  //   GEOP_RATE_LIMIT_MAX        → nº máx. de peticiones por ventana (0 = off).
  //   GEOP_RATE_LIMIT_WINDOW_MS  → tamaño de la ventana en ms (por defecto 60s).
  rateLimitMax: num(process.env.GEOP_RATE_LIMIT_MAX, 0),
  rateLimitWindowMs: num(process.env.GEOP_RATE_LIMIT_WINDOW_MS, 60000),

  // --- Scopes/roles JWT (Sprint 6) ---------------------------------------
  // Claim de scopes admitido en el JWT: string separada por espacios (estilo
  // OAuth2 `scope`) y/o array `scopes`. Diferencia lectura pública, CMS futuro
  // y administración sin bloquear el diseño actual:
  //   • Endpoints de lectura v1: por defecto NO exigen scope (lectura abierta).
  //     Si GEOP_SCOPE_READ se define y la auth está activa con token, ese scope
  //     pasa a ser obligatorio en los endpoints de datos.
  //   • Endpoints CMS/Admin (Sprint 7): mapa ROUTE_SCOPES ya preparado.
  scopeRead: process.env.GEOP_SCOPE_READ || '',
  scopeCms: process.env.GEOP_SCOPE_CMS || 'cms:write',
  scopeAdmin: process.env.GEOP_SCOPE_ADMIN || 'admin',

  // --- CMS / Admin API (Sprint 7) ----------------------------------------
  // Interruptor maestro de ESCRITURA real. Por defecto FALSE: los endpoints
  // administrativos existen y validan el contrato, pero operan en modo
  // "prepared" (no persisten). Sólo con GEOP_ADMIN_WRITES=true Y una DB
  // alcanzable se ejecutan INSERT/UPDATE parametrizados. Esto evita datos
  // falsos persistentes y protege producción por defecto.
  adminWritesEnabled: bool(process.env.GEOP_ADMIN_WRITES, false),

  // --- Colector de analítica de uso (Sprint 12) --------------------------
  // Endpoint OPCIONAL POST /api/v1/analytics/events que recibe eventos de
  // interacción pública ya sanitizados por el cliente (analytics.mjs). Está
  // DESACTIVADO por defecto (fail-safe): sin él, el endpoint responde 404 y no
  // hay superficie de escritura extra. Al activarlo, los eventos se agregan en
  // memoria (contadores por tipo/origen, sin PII) y opcionalmente se registran
  // como log estructurado. Nunca se persisten datos personales.
  //   GEOP_ANALYTICS_ENABLED     → 'true' habilita el endpoint (por defecto off).
  //   GEOP_ANALYTICS_MAX_EVENTS  → tamaño del buffer circular en memoria.
  //   GEOP_ANALYTICS_LOG         → emite una línea JSON por evento aceptado.
  analyticsEnabled: bool(process.env.GEOP_ANALYTICS_ENABLED, false),
  analyticsMaxEvents: num(process.env.GEOP_ANALYTICS_MAX_EVENTS, 5000),
  analyticsLog: bool(process.env.GEOP_ANALYTICS_LOG, false),

  // Rutas del puente estático (Sprint 2) usadas como respaldo permanente.
  staticConflictsPath: resolve(REPO_ROOT, 'api/v1/conflicts.json'),
  staticMapPath: resolve(REPO_ROOT, 'api/v1/conflicts/active/map.json'),

  apiVersion: 'v1',
  serviceName: 'geopolem-api',
};

export function hasDatabase() {
  return Boolean(CONFIG.databaseUrl);
}

// ¿La auth está activa? (optional|required). En 'public' no se aplica.
export function authEnabled() {
  return CONFIG.authMode === 'optional' || CONFIG.authMode === 'required';
}

// Estado de CONFIGURACIÓN de la escritura CMS/Admin (Sprint 9). Sólo evalúa el
// entorno (no comprueba la conexión real a la DB, que es responsabilidad de la
// capa de escritura en tiempo de ejecución). Sirve para aplicar la política
// "fail-closed": si un operador ACTIVA la escritura pero el entorno está
// incompleto, la superficie admin NO debe fingir un guardado ("prepared") sino
// señalar la mala configuración.
//   'prepared'      → GEOP_ADMIN_WRITES=false (por defecto, seguro): sólo valida.
//   'misconfigured' → GEOP_ADMIN_WRITES=true pero falta DATABASE_URL.
//   'enabled'       → GEOP_ADMIN_WRITES=true y hay DATABASE_URL (la alcanzabilidad
//                     de la DB se verifica aparte al ejecutar la escritura).
export function adminWritesConfigState() {
  if (!CONFIG.adminWritesEnabled) return 'prepared';
  if (!CONFIG.databaseUrl) return 'misconfigured';
  return 'enabled';
}
