// GEOPÓLEM API v1 (Sprint 3) — capa de consulta PostgreSQL/PostGIS.
// ---------------------------------------------------------------------------
// Traduce el esquema `esquema_base_datos_geopolem.sql` al contrato v1 de
// `especificacion_api_geopolem.md`. Es PostGIS-ready: la ubicación se deriva
// con `ST_Y(geom)/ST_X(geom)` y cae a las columnas latitude/longitude cuando
// no hay geometría. Todas las consultas son read-only y parametrizadas.
//
// `pg` es una dependencia OPCIONAL: se importa dinámicamente sólo si hay
// DATABASE_URL. Sin DB (o sin `pg` instalado) esta capa no se usa y el
// repositorio cae al puente estático (ver repository.mjs / static-source.mjs).
// ---------------------------------------------------------------------------

import { CONFIG } from './config.mjs';

let pool = null;
let pgUnavailableReason = null;

// Inicializa el pool `pg` de forma perezosa. Devuelve null si no es posible
// (sin DATABASE_URL, o el paquete `pg` no está instalado).
async function getPool() {
  if (pool) return pool;
  if (!CONFIG.databaseUrl) return null;
  if (pgUnavailableReason) return null;

  let pg;
  try {
    pg = await import('pg');
  } catch (err) {
    pgUnavailableReason = `paquete "pg" no instalado (${err.code || err.message})`;
    return null;
  }

  const { Pool } = pg.default || pg;
  pool = new Pool({
    connectionString: CONFIG.databaseUrl,
    max: CONFIG.pgPoolMax,
    connectionTimeoutMillis: CONFIG.pgConnectTimeoutMs,
    statement_timeout: CONFIG.pgStatementTimeoutMs,
    ssl: CONFIG.pgSsl ? { rejectUnauthorized: false } : undefined,
  });
  pool.on('error', () => { /* el healthcheck reporta el estado; no crashear */ });
  return pool;
}

async function query(text, params = []) {
  const p = await getPool();
  if (!p) throw new Error('no_database');
  return p.query(text, params);
}

// SELECT reutilizable: conflicto → ConflictListItem del contrato v1.
// COALESCE con ST_Y/ST_X hace la capa PostGIS-ready sin exigir geom presente.
const CONFLICT_SELECT = `
  SELECT
    c.id::text                                   AS id,
    c.slug                                        AS slug,
    c.name_es                                     AS name,
    c.summary                                     AS summary,
    ct.slug                                       AS conflict_type_slug,
    ct.label_es                                   AS conflict_type_label,
    rg.slug                                        AS region_slug,
    rg.label_es                                   AS region_label,
    c.status::text                                AS status,
    c.intensity_level                             AS intensity_level,
    c.escalation_risk                             AS escalation_risk,
    c.humanitarian_impact                         AS humanitarian_impact,
    c.energy_dimension                            AS energy_dimension,
    c.territorial_dimension                       AS territorial_dimension,
    c.external_involvement                        AS external_involvement,
    COALESCE(ST_Y(c.geom), c.latitude)::float8    AS latitude,
    COALESCE(ST_X(c.geom), c.longitude)::float8   AS longitude,
    to_char(c.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
  FROM conflicts c
  LEFT JOIN taxonomies ct ON c.conflict_type_id = ct.id
  LEFT JOIN taxonomies rg ON c.primary_region_id = rg.id
`;

function rowToConflict(r) {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    summary: r.summary,
    conflict_type: r.conflict_type_slug
      ? { slug: r.conflict_type_slug, label: r.conflict_type_label }
      : null,
    primary_region: r.region_slug
      ? { slug: r.region_slug, label: r.region_label }
      : null,
    status: r.status,
    intensity_level: r.intensity_level,
    escalation_risk: r.escalation_risk,
    humanitarian_impact: r.humanitarian_impact,
    energy_dimension: r.energy_dimension,
    territorial_dimension: r.territorial_dimension,
    external_involvement: r.external_involvement,
    location: {
      latitude: r.latitude ?? null,
      longitude: r.longitude ?? null,
    },
    updated_at: r.updated_at,
  };
}

// Construye WHERE dinámico y parametrizado a partir de filtros soportados.
function buildConflictFilters(filters = {}) {
  const clauses = [];
  const params = [];
  const add = (sql, value) => { params.push(value); clauses.push(sql.replace('$?', `$${params.length}`)); };

  if (filters.status) add('c.status = $?::geopolem_status', filters.status);
  if (filters.region) add('rg.slug = $?', filters.region);
  if (filters.conflict_type) add('ct.slug = $?', filters.conflict_type);
  if (filters.intensity_min != null) add('c.intensity_level >= $?', filters.intensity_min);
  if (filters.intensity_max != null) add('c.intensity_level <= $?', filters.intensity_max);
  if (filters.energy_dimension != null) add('c.energy_dimension = $?', filters.energy_dimension);
  if (filters.territorial_dimension != null) add('c.territorial_dimension = $?', filters.territorial_dimension);
  if (filters.external_involvement != null) add('c.external_involvement = $?', filters.external_involvement);
  if (filters.updated_after) add('c.updated_at >= $?', filters.updated_after);

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { where, params };
}

const SORTABLE = new Set(['updated_at', 'intensity_level', 'escalation_risk', 'name_es', 'slug']);

export const queryLayer = {
  // ¿Podemos usar la DB? (sin efectos: sólo revisa config/paquete)
  async available() {
    return Boolean(await getPool());
  },

  // Healthcheck real: SELECT 1 y comprobación de PostGIS.
  async health() {
    const p = await getPool();
    if (!p) {
      return {
        database: 'unavailable',
        postgis: false,
        reason: pgUnavailableReason || (CONFIG.databaseUrl ? 'sin conexión' : 'DATABASE_URL no configurada'),
      };
    }
    try {
      await p.query('SELECT 1');
      let postgis = false;
      try {
        const res = await p.query("SELECT extname FROM pg_extension WHERE extname = 'postgis'");
        postgis = res.rowCount > 0;
      } catch { postgis = false; }
      return { database: 'reachable', postgis, reason: null };
    } catch (err) {
      return { database: 'unreachable', postgis: false, reason: err.message };
    }
  },

  // GET /conflicts — lista paginada + total.
  async listConflicts(filters, { page, pageSize, sort, order }) {
    const { where, params } = buildConflictFilters(filters);
    const sortCol = SORTABLE.has(sort) ? sort : 'updated_at';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';

    const countRes = await query(
      `SELECT count(*)::int AS total FROM conflicts c
       LEFT JOIN taxonomies ct ON c.conflict_type_id = ct.id
       LEFT JOIN taxonomies rg ON c.primary_region_id = rg.id ${where}`,
      params,
    );
    const total = countRes.rows[0]?.total ?? 0;

    const limit = pageSize;
    const offset = (page - 1) * pageSize;
    const rowsRes = await query(
      `${CONFLICT_SELECT} ${where}
       ORDER BY ${sortCol === 'name_es' || sortCol === 'slug' ? 'c.' + sortCol : 'c.' + sortCol} ${sortDir} NULLS LAST
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    return { items: rowsRes.rows.map(rowToConflict), total };
  },

  // GET /conflicts/:id — detalle por slug (o id UUID).
  async getConflict(idOrSlug) {
    const res = await query(
      `${CONFLICT_SELECT} WHERE c.slug = $1 OR c.id::text = $1 LIMIT 1`,
      [idOrSlug],
    );
    if (!res.rowCount) return null;
    return rowToConflict(res.rows[0]);
  },

  // GET /conflicts/active/map — FeatureCollection GeoJSON desde la vista.
  async activeConflictsMap(filters = {}) {
    // Usa la vista v_active_conflicts_map (status='active' ya aplicado).
    const clauses = [];
    const params = [];
    const add = (sql, value) => { params.push(value); clauses.push(sql.replace('$?', `$${params.length}`)); };
    if (filters.region) add('v.primary_region = $?', filters.region);
    if (filters.intensity_min != null) add('v.intensity_level >= $?', filters.intensity_min);
    if (filters.energy_dimension != null) add('v.energy_dimension = $?', filters.energy_dimension);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const res = await query(
      `SELECT
         v.id::text AS id, v.slug, v.name_es AS name,
         v.intensity_level, v.escalation_risk, v.energy_dimension,
         v.primary_region,
         COALESCE(ST_Y(v.geom), v.latitude)::float8  AS latitude,
         COALESCE(ST_X(v.geom), v.longitude)::float8 AS longitude
       FROM v_active_conflicts_map v ${where}`,
      params,
    );
    return res.rows
      .filter((r) => r.longitude != null && r.latitude != null)
      .map((r) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
        properties: {
          id: r.id,
          slug: r.slug,
          name: r.name,
          intensity_level: r.intensity_level,
          escalation_risk: r.escalation_risk,
          energy_dimension: r.energy_dimension,
          primary_region: r.primary_region,
        },
      }));
  },

  // GET /filters — facetas derivadas de la DB (regiones/tipos/estados/rango).
  async filters() {
    const regions = await query(
      `SELECT DISTINCT rg.slug, rg.label_es AS label
         FROM conflicts c JOIN taxonomies rg ON c.primary_region_id = rg.id
        ORDER BY rg.label_es`,
    );
    const types = await query(
      `SELECT DISTINCT ct.slug, ct.label_es AS label
         FROM conflicts c JOIN taxonomies ct ON c.conflict_type_id = ct.id
        ORDER BY ct.label_es`,
    );
    const statuses = await query(
      `SELECT DISTINCT c.status::text AS status FROM conflicts c ORDER BY 1`,
    );
    const range = await query(
      `SELECT min(intensity_level) AS min, max(intensity_level) AS max FROM conflicts`,
    );
    return {
      regions: regions.rows.map((r) => ({ slug: r.slug, label: r.label })),
      conflict_types: types.rows.map((r) => ({ slug: r.slug, label: r.label })),
      statuses: statuses.rows.map((r) => r.status),
      intensity: { min: range.rows[0]?.min ?? null, max: range.rows[0]?.max ?? null },
    };
  },

  async close() {
    if (pool) { await pool.end(); pool = null; }
  },
};
