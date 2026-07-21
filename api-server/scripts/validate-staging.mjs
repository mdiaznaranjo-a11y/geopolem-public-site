// GEOPÓLEM API v1 (Sprint 4) — validación de staging (DB + endpoints).
// ---------------------------------------------------------------------------
// Comprueba, de forma degradable y sin romper, que el entorno de staging está
// bien montado. Se adapta a lo que haya disponible:
//
//   • Si DATABASE_URL está definida y `pg` instalado:
//       - PostGIS disponible (postgis_version()).
//       - Esquema aplicado (tablas conflicts/taxonomies y vista del mapa).
//       - Semilla aplicada (conflicts > 0).
//   • Si API_BASE está definida (host del api-server ya arrancado):
//       - /api/v1/health responde 200 y refleja el origen activo.
//       - Con DATABASE_URL alcanzable: espera database:"reachable" y postgis:true.
//       - /conflicts, /conflicts/active/map, /conflicts/:id, /filters responden.
//   • Si NADA está definido: arranca el servidor en modo FALLBACK (sin DB) en un
//       puerto efímero y verifica que responde con source:"static". Así el script
//       siempre puede correr en CI sin infraestructura.
//
// Uso:
//   node scripts/validate-staging.mjs                 # modo fallback autónomo
//   API_BASE=http://localhost:8787 node scripts/validate-staging.mjs
//   DATABASE_URL=postgres://... PG_SSL=true node scripts/validate-staging.mjs
//   DATABASE_URL=... API_BASE=... node scripts/validate-staging.mjs   # completo
//
// Sale con código != 0 si alguna aserción falla (apto para CI).
// ---------------------------------------------------------------------------

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = resolve(__dirname, '..', 'server.mjs');

let failures = 0;
let checks = 0;
function check(name, cond, detail) {
  checks++;
  const ok = !!cond;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? `  — ${detail}` : ''}`);
  if (!ok) failures++;
}
function info(msg) { console.log(`····  ${msg}`); }

async function getJson(base, path) {
  const res = await fetch(`${base}${path}`);
  const contentType = res.headers.get('content-type') || '';
  let body = null;
  try { body = await res.json(); } catch { /* respuesta no-JSON */ }
  return { status: res.status, body, contentType };
}

// --- 1. Validación de base de datos (opcional, requiere pg) ------------------
async function validateDatabase(databaseUrl) {
  console.log('\n== Base de datos (DATABASE_URL definida) ==');
  let pg;
  try {
    pg = await import('pg');
  } catch {
    info('paquete "pg" no instalado: se omite validación directa de DB (usa `npm install`).');
    return;
  }
  const { Pool } = pg.default || pg;
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS) || 5000,
    ssl: String(process.env.PG_SSL).toLowerCase() === 'true' ? { rejectUnauthorized: false } : undefined,
  });
  try {
    const ping = await pool.query('SELECT 1 AS ok');
    check('DB: conexión establecida (SELECT 1)', ping.rows[0]?.ok === 1);

    let postgis = false;
    let version = null;
    try {
      const r = await pool.query('SELECT postgis_version() AS v');
      version = r.rows[0]?.v || null;
      postgis = Boolean(version);
    } catch { postgis = false; }
    check('DB: PostGIS disponible (postgis_version)', postgis, 'la extensión postgis no está instalada');
    if (version) info(`PostGIS versión: ${version}`);

    const tables = await pool.query(
      `SELECT to_regclass('public.conflicts')  AS conflicts,
              to_regclass('public.taxonomies') AS taxonomies,
              to_regclass('public.v_active_conflicts_map') AS map_view`,
    );
    const t = tables.rows[0] || {};
    check('DB: esquema aplicado — tabla conflicts', t.conflicts != null);
    check('DB: esquema aplicado — tabla taxonomies', t.taxonomies != null);
    check('DB: esquema aplicado — vista v_active_conflicts_map', t.map_view != null);

    if (t.conflicts != null) {
      const seed = await pool.query('SELECT count(*)::int AS n FROM conflicts');
      const n = seed.rows[0]?.n ?? 0;
      check('DB: semilla aplicada — conflicts > 0', n > 0, `count=${n}`);
      info(`conflicts en DB: ${n}`);
    }
  } catch (err) {
    check('DB: conexión establecida', false, err?.message || String(err));
  } finally {
    await pool.end().catch(() => {});
  }
}

// --- 2. Validación de endpoints contra un api-server ya en marcha -----------
async function validateEndpoints(base, { expectDatabase }) {
  console.log(`\n== Endpoints (API_BASE=${base}) ==`);
  const health = await getJson(base, '/api/v1/health');
  check('health: 200', health.status === 200);
  check('health: status ok', health.body?.data?.status === 'ok');
  const activeSource = health.body?.data?.active_source;
  info(`active_source=${activeSource} database=${health.body?.data?.database} postgis=${health.body?.data?.postgis}`);
  if (expectDatabase) {
    check('health: database reachable', health.body?.data?.database === 'reachable',
      'DATABASE_URL definida pero la DB no es alcanzable desde la API');
    check('health: postgis true', health.body?.data?.postgis === true);
    check('health: active_source database', activeSource === 'database');
  }

  const conflicts = await getJson(base, '/api/v1/conflicts?page=1&page_size=5');
  check('conflicts: 200', conflicts.status === 200);
  check('conflicts: data no vacía', Array.isArray(conflicts.body?.data) && conflicts.body.data.length > 0);
  const src = conflicts.body?.meta?.source;
  info(`conflicts meta.source=${src}`);
  if (expectDatabase) check('conflicts: source=database', src === 'database');

  const map = await getJson(base, '/api/v1/conflicts/active/map');
  check('map: FeatureCollection', map.body?.type === 'FeatureCollection');
  check('map: geo+json content-type', /geo\+json/.test(map.contentType));

  const slug = conflicts.body?.data?.[0]?.slug;
  if (slug) {
    const detail = await getJson(base, `/api/v1/conflicts/${encodeURIComponent(slug)}`);
    check('detail: 200 y slug coincide', detail.status === 200 && detail.body?.data?.slug === slug);
  }
  const notFound = await getJson(base, '/api/v1/conflicts/no-existe-xyz');
  check('detail inexistente: 404', notFound.status === 404);

  const filters = await getJson(base, '/api/v1/filters');
  check('filters: regiones presentes', Array.isArray(filters.body?.data?.regions) && filters.body.data.regions.length > 0);
}

// --- 3. Modo autónomo: arranca servidor en fallback y valida source=static --
async function validateFallbackSelfContained() {
  console.log('\n== Fallback autónomo (sin DATABASE_URL) ==');
  const PORT = 8811;
  const proc = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: String(PORT), DATABASE_URL: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const base = `http://127.0.0.1:${PORT}`;
  try {
    for (let i = 0; i < 40; i++) {
      try { await getJson(base, '/api/v1/health'); break; } catch { await sleep(100); }
    }
    const health = await getJson(base, '/api/v1/health');
    check('fallback health: 200 y status ok', health.status === 200 && health.body?.data?.status === 'ok');
    check('fallback health: active_source=static', health.body?.data?.active_source === 'static');
    check('fallback health: static_fallback.available', health.body?.data?.static_fallback?.available === true);

    const conflicts = await getJson(base, '/api/v1/conflicts?page=1&page_size=5');
    check('fallback conflicts: source=static', conflicts.body?.meta?.source === 'static');
    check('fallback conflicts: data no vacía', Array.isArray(conflicts.body?.data) && conflicts.body.data.length > 0);
  } finally {
    proc.kill('SIGTERM');
  }
}

// --- Orquestación -----------------------------------------------------------
const databaseUrl = process.env.DATABASE_URL || '';
const apiBase = process.env.API_BASE || '';

console.log('GEOPÓLEM — validate-staging');
if (databaseUrl) await validateDatabase(databaseUrl);
if (apiBase) await validateEndpoints(apiBase, { expectDatabase: Boolean(databaseUrl) });
if (!apiBase) await validateFallbackSelfContained();

console.log(`\n${failures === 0 ? 'OK' : 'FALLOS'}: ${failures}/${checks} aserción(es) fallida(s).`);
process.exit(failures === 0 ? 0 : 1);
