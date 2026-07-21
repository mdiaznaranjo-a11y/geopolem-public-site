-- GEOPÓLEM API v1 (Sprint 3) — consultas read-only de referencia.
-- ---------------------------------------------------------------------------
-- Estas son las consultas que implementa `src/db.mjs` de forma parametrizada.
-- Se documentan aquí para revisión, para `psql` manual y para que el equipo de
-- datos pueda validarlas contra `schema.sql` + `seed.sql`. Son PostGIS-ready:
-- la ubicación usa ST_Y/ST_X(geom) con fallback a las columnas lat/long.
-- ---------------------------------------------------------------------------

-- 1) GET /api/v1/conflicts  → ConflictListItem[]
--    (los filtros WHERE se añaden dinámicamente y parametrizados)
SELECT
    c.id::text                                   AS id,
    c.slug                                        AS slug,
    c.name_es                                     AS name,
    c.summary                                     AS summary,
    ct.slug                                        AS conflict_type_slug,
    ct.label_es                                    AS conflict_type_label,
    rg.slug                                        AS region_slug,
    rg.label_es                                    AS region_label,
    c.status::text                                 AS status,
    c.intensity_level,
    c.escalation_risk,
    c.humanitarian_impact,
    c.energy_dimension,
    c.territorial_dimension,
    c.external_involvement,
    COALESCE(ST_Y(c.geom), c.latitude)::float8     AS latitude,
    COALESCE(ST_X(c.geom), c.longitude)::float8    AS longitude,
    to_char(c.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
FROM conflicts c
LEFT JOIN taxonomies ct ON c.conflict_type_id = ct.id
LEFT JOIN taxonomies rg ON c.primary_region_id = rg.id
-- WHERE c.status = $1::geopolem_status AND rg.slug = $2 ...
ORDER BY c.intensity_level DESC NULLS LAST
LIMIT 20 OFFSET 0;

-- 2) GET /api/v1/conflicts/:id  → detalle por slug o UUID
SELECT c.*, ct.slug AS conflict_type_slug, rg.slug AS region_slug
FROM conflicts c
LEFT JOIN taxonomies ct ON c.conflict_type_id = ct.id
LEFT JOIN taxonomies rg ON c.primary_region_id = rg.id
WHERE c.slug = $1 OR c.id::text = $1
LIMIT 1;

-- 2b) Relaciones para el detalle (include=actors,resources,chokepoints).
--     Actores estatales del conflicto:
SELECT sa.slug, sa.official_name_es AS name, csa.involvement_level, csa.alignment
FROM conflict_state_actors csa
JOIN state_actors sa ON csa.state_actor_id = sa.id
WHERE csa.conflict_id = $1;
--     Actores no estatales del conflicto:
SELECT nsa.slug, nsa.name_es AS name, cnsa.involvement_level, cnsa.alignment
FROM conflict_non_state_actors cnsa
JOIN non_state_actors nsa ON cnsa.non_state_actor_id = nsa.id
WHERE cnsa.conflict_id = $1;
--     Recursos del conflicto:
SELECT er.slug, er.name_es AS name, cr.relevance_level
FROM conflict_resources cr
JOIN energy_resources er ON cr.resource_id = er.id
WHERE cr.conflict_id = $1;
--     Chokepoints del conflicto:
SELECT cp.slug, cp.name_es AS name, cc.risk_level
FROM conflict_chokepoints cc
JOIN chokepoints cp ON cc.chokepoint_id = cp.id
WHERE cc.conflict_id = $1;

-- 3) GET /api/v1/conflicts/active/map  → FeatureCollection (usa la vista)
SELECT
    v.id::text AS id, v.slug, v.name_es AS name,
    v.intensity_level, v.escalation_risk, v.energy_dimension, v.primary_region,
    COALESCE(ST_Y(v.geom), v.latitude)::float8  AS latitude,
    COALESCE(ST_X(v.geom), v.longitude)::float8 AS longitude
FROM v_active_conflicts_map v
-- WHERE v.primary_region = $1 AND v.intensity_level >= $2 ...
;

-- 4) GET /api/v1/filters  → facetas para la UI
SELECT DISTINCT rg.slug, rg.label_es AS label
FROM conflicts c JOIN taxonomies rg ON c.primary_region_id = rg.id
ORDER BY rg.label_es;

SELECT DISTINCT ct.slug, ct.label_es AS label
FROM conflicts c JOIN taxonomies ct ON c.conflict_type_id = ct.id
ORDER BY ct.label_es;

SELECT DISTINCT c.status::text AS status FROM conflicts c ORDER BY 1;

SELECT min(intensity_level) AS min, max(intensity_level) AS max FROM conflicts;

-- 5) GET /api/v1/health  → comprobación de conexión + PostGIS
SELECT 1;
SELECT extname FROM pg_extension WHERE extname = 'postgis';
