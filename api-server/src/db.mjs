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

  // GET /conflicts/:id (enriquecido) — relaciones del conflicto.
  // Devuelve { actors: {state[], non_state[]}, resources[], chokepoints[],
  // causal_links[] }. Cada consulta es read-only, parametrizada y tolerante:
  // si una tabla de relación estuviera vacía, devuelve arrays vacíos.
  async getConflictRelations(conflictId) {
    const [stateActors, nonStateActors, resources, chokepoints, causal, sources] = await Promise.all([
      query(
        `SELECT sa.slug, sa.official_name_es AS name,
                csa.alignment::text AS alignment, csa.involvement_level, csa.role_id,
                rt.label_es AS role
           FROM conflict_state_actors csa
           JOIN state_actors sa ON csa.state_actor_id = sa.id
           LEFT JOIN taxonomies rt ON csa.role_id = rt.id
          WHERE csa.conflict_id = $1
          ORDER BY csa.involvement_level DESC NULLS LAST, sa.official_name_es`,
        [conflictId],
      ),
      query(
        `SELECT nsa.slug, nsa.name_es AS name,
                cnsa.alignment::text AS alignment, cnsa.involvement_level,
                rt.label_es AS role
           FROM conflict_non_state_actors cnsa
           JOIN non_state_actors nsa ON cnsa.non_state_actor_id = nsa.id
           LEFT JOIN taxonomies rt ON cnsa.role_id = rt.id
          WHERE cnsa.conflict_id = $1
          ORDER BY cnsa.involvement_level DESC NULLS LAST, nsa.name_es`,
        [conflictId],
      ),
      query(
        `SELECT er.slug, er.name_es AS name, cr.relevance_level,
                er.strategic_importance, er.critical_mineral
           FROM conflict_resources cr
           JOIN energy_resources er ON cr.resource_id = er.id
          WHERE cr.conflict_id = $1
          ORDER BY cr.relevance_level DESC NULLS LAST, er.name_es`,
        [conflictId],
      ),
      query(
        `SELECT cp.slug, cp.name_es AS name, cc.risk_level,
                cp.strategic_importance, cp.energy_flow_relevance
           FROM conflict_chokepoints cc
           JOIN chokepoints cp ON cc.chokepoint_id = cp.id
          WHERE cc.conflict_id = $1
          ORDER BY cc.risk_level DESC NULLS LAST, cp.name_es`,
        [conflictId],
      ),
      query(
        `SELECT link_type::text AS link_type, title, explanation, mechanism,
                strength, confidence_score
           FROM causal_links
          WHERE (source_entity_type = 'conflict' AND source_entity_id = $1)
             OR (target_entity_type = 'conflict' AND target_entity_id = $1)
          ORDER BY strength DESC NULLS LAST, title`,
        [conflictId],
      ),
      query(
        `SELECT s.slug, s.title, s.url, s.publisher,
                sl.claim, sl.confidence_score,
                sl.verification::text AS verification
           FROM source_links sl
           JOIN sources s ON sl.source_id = s.id
          WHERE sl.entity_type = 'conflict' AND sl.entity_id = $1
          ORDER BY s.publication_date DESC NULLS LAST, s.title`,
        [conflictId],
      ),
    ]);

    return {
      actors: {
        state: stateActors.rows.map((r) => ({
          slug: r.slug, name: r.name, role: r.role ?? null,
          alignment: r.alignment ?? null, involvement_level: r.involvement_level ?? null,
        })),
        non_state: nonStateActors.rows.map((r) => ({
          slug: r.slug, name: r.name, role: r.role ?? null,
          alignment: r.alignment ?? null, involvement_level: r.involvement_level ?? null,
        })),
      },
      resources: resources.rows.map((r) => ({
        slug: r.slug, name: r.name, relevance_level: r.relevance_level ?? null,
        strategic_importance: r.strategic_importance ?? null,
        critical_mineral: Boolean(r.critical_mineral),
      })),
      chokepoints: chokepoints.rows.map((r) => ({
        slug: r.slug, name: r.name, risk_level: r.risk_level ?? null,
        strategic_importance: r.strategic_importance ?? null,
        energy_flow_relevance: Boolean(r.energy_flow_relevance),
      })),
      causal_links: causal.rows.map((r) => ({
        link_type: r.link_type, title: r.title, explanation: r.explanation,
        mechanism: r.mechanism ?? null, strength: r.strength ?? null,
        confidence_score: r.confidence_score ?? null,
      })),
      sources: sources.rows.map((r) => ({
        slug: r.slug, title: r.title, url: r.url ?? null,
        publisher: r.publisher ?? null, claim: r.claim ?? null,
        confidence_score: r.confidence_score ?? null,
        verification: r.verification ?? null,
      })),
    };
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

// --- Capa de ESCRITURA CMS/Admin (Sprint 7) --------------------------------
// Consultas parametrizadas de escritura. SÓLO se invocan cuando la escritura
// real está habilitada (GEOP_ADMIN_WRITES=true) y hay DB alcanzable; el
// repositorio administrativo aplica esa guarda (ver admin-repository.mjs).
// El estado editorial (draft/review/published/archived) llega YA mapeado al
// enum persistente `geopolem_status` desde la capa de validación.

async function taxonomyIdBySlug(slug) {
  if (!slug) return null;
  const res = await query('SELECT id FROM taxonomies WHERE slug = $1 LIMIT 1', [slug]);
  return res.rowCount ? res.rows[0].id : null;
}

export const writeLayer = {
  async available() {
    return Boolean(await getPool());
  },

  // INSERT de un conflicto. `input` ya validado/normalizado; `dbStatus` es el
  // enum persistente. Devuelve el ConflictListItem creado (mismo shape lectura).
  async createConflict(input, dbStatus) {
    const conflictTypeId = await taxonomyIdBySlug(input.conflict_type);
    const regionId = await taxonomyIdBySlug(input.primary_region);
    const loc = input.location || {};
    const res = await query(
      `INSERT INTO conflicts
         (slug, name_es, summary, conflict_type_id, primary_region_id, status,
          intensity_level, escalation_risk, humanitarian_impact,
          energy_dimension, territorial_dimension, external_involvement,
          latitude, longitude)
       VALUES ($1,$2,$3,$4,$5,$6::geopolem_status,$7,$8,$9,
               COALESCE($10,false),COALESCE($11,false),COALESCE($12,false),$13,$14)
       RETURNING id::text AS id`,
      [
        input.slug, input.name, input.summary ?? null, conflictTypeId, regionId, dbStatus,
        input.intensity_level ?? null, input.escalation_risk ?? null, input.humanitarian_impact ?? null,
        input.energy_dimension ?? null, input.territorial_dimension ?? null, input.external_involvement ?? null,
        loc.latitude ?? null, loc.longitude ?? null,
      ],
    );
    return queryLayer.getConflict(res.rows[0].id);
  },

  // UPDATE parcial de un conflicto por id/slug. `patch` sólo trae campos
  // presentes; `dbStatus` (opcional) fija el estado si se incluyó en el patch.
  async updateConflict(idOrSlug, patch, dbStatus) {
    const sets = [];
    const params = [];
    const add = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };

    if ('name' in patch) add('name_es', patch.name);
    if ('summary' in patch) add('summary', patch.summary ?? null);
    if ('intensity_level' in patch) add('intensity_level', patch.intensity_level ?? null);
    if ('escalation_risk' in patch) add('escalation_risk', patch.escalation_risk ?? null);
    if ('humanitarian_impact' in patch) add('humanitarian_impact', patch.humanitarian_impact ?? null);
    if ('energy_dimension' in patch) add('energy_dimension', patch.energy_dimension);
    if ('territorial_dimension' in patch) add('territorial_dimension', patch.territorial_dimension);
    if ('external_involvement' in patch) add('external_involvement', patch.external_involvement);
    if ('conflict_type' in patch) add('conflict_type_id', await taxonomyIdBySlug(patch.conflict_type));
    if ('primary_region' in patch) add('primary_region_id', await taxonomyIdBySlug(patch.primary_region));
    if (patch.location?.latitude != null) add('latitude', patch.location.latitude);
    if (patch.location?.longitude != null) add('longitude', patch.location.longitude);
    if (dbStatus) add('status', dbStatus); // cast implícito a geopolem_status

    if (!sets.length) return queryLayer.getConflict(idOrSlug);

    params.push(idOrSlug);
    const res = await query(
      `UPDATE conflicts SET ${sets.join(', ')}
        WHERE slug = $${params.length} OR id::text = $${params.length}
        RETURNING id::text AS id`,
      params,
    );
    if (!res.rowCount) return null;
    return queryLayer.getConflict(res.rows[0].id);
  },

  // Fija el estado editorial (ya mapeado a enum persistente) de un conflicto.
  async setStatus(idOrSlug, dbStatus) {
    const res = await query(
      `UPDATE conflicts SET status = $1::geopolem_status
        WHERE slug = $2 OR id::text = $2
        RETURNING id::text AS id, status::text AS status`,
      [dbStatus, idOrSlug],
    );
    if (!res.rowCount) return null;
    return queryLayer.getConflict(res.rows[0].id);
  },
};
