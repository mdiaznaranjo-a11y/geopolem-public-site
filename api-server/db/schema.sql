-- GEOPÓLEM - Esquema relacional inicial
-- Base objetivo: PostgreSQL 15+ con PostGIS opcional
-- Propósito: CMS, mapa interactivo, conflictos, actores, recursos energéticos, chokepoints y fuentes

-- Extensiones recomendadas
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- 1. Tipos controlados
-- ============================================================

CREATE TYPE geopolem_status AS ENUM (
    'draft',
    'active',
    'archived',
    'deprecated'
);

CREATE TYPE verification_status AS ENUM (
    'unverified',
    'partially_verified',
    'verified',
    'disputed'
);

CREATE TYPE geometry_kind AS ENUM (
    'point',
    'line',
    'polygon',
    'multi_point',
    'multi_line',
    'multi_polygon',
    'mixed'
);

CREATE TYPE actor_alignment AS ENUM (
    'ally',
    'rival',
    'partner',
    'adversary',
    'neutral',
    'contested',
    'unknown'
);

CREATE TYPE causal_link_type AS ENUM (
    'root_cause',
    'trigger',
    'accelerator',
    'constraint',
    'consequence',
    'feedback_loop',
    'risk_indicator'
);

-- ============================================================
-- 2. Taxonomía maestra
-- ============================================================

CREATE TABLE taxonomies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    label_es TEXT NOT NULL,
    label_en TEXT,
    description TEXT,
    taxonomy_group TEXT NOT NULL,
    parent_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    scope TEXT NOT NULL DEFAULT 'global',
    cms_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    map_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    sql_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    status geopolem_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_taxonomies_group ON taxonomies(taxonomy_group);
CREATE INDEX idx_taxonomies_parent ON taxonomies(parent_id);
CREATE INDEX idx_taxonomies_status ON taxonomies(status);

-- ============================================================
-- 3. Fuentes y trazabilidad
-- ============================================================

CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_type_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    url TEXT,
    publisher TEXT,
    author TEXT,
    language_code TEXT DEFAULT 'es',
    publication_date DATE,
    accessed_at TIMESTAMPTZ DEFAULT now(),
    reliability_score SMALLINT CHECK (reliability_score BETWEEN 1 AND 5),
    bias_notes TEXT,
    citation_text TEXT,
    archive_url TEXT,
    status geopolem_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sources_type ON sources(source_type_id);
CREATE INDEX idx_sources_publication_date ON sources(publication_date);

-- Enlace polimórfico entre fuentes y entidades.
-- entity_type acepta valores como conflict, state_actor, non_state_actor,
-- energy_resource, chokepoint, event, causal_link, map_layer, content.
CREATE TABLE source_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    claim TEXT,
    evidence_quote TEXT,
    confidence_score SMALLINT CHECK (confidence_score BETWEEN 1 AND 5),
    verification verification_status NOT NULL DEFAULT 'unverified',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source_id, entity_type, entity_id, claim)
);

CREATE INDEX idx_source_links_entity ON source_links(entity_type, entity_id);
CREATE INDEX idx_source_links_source ON source_links(source_id);

-- ============================================================
-- 4. Geografía base
-- ============================================================

CREATE TABLE countries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    iso2 CHAR(2) UNIQUE,
    iso3 CHAR(3) UNIQUE,
    name_es TEXT NOT NULL,
    name_en TEXT,
    capital TEXT,
    region_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    subregion_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    geom GEOMETRY(MULTIPOLYGON, 4326),
    status geopolem_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_countries_region ON countries(region_id);
CREATE INDEX idx_countries_geom ON countries USING GIST(geom);

CREATE TABLE geo_places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name_es TEXT NOT NULL,
    name_en TEXT,
    place_type_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
    region_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    geom GEOMETRY(GEOMETRY, 4326),
    geometry_type geometry_kind,
    description TEXT,
    status geopolem_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_geo_places_country ON geo_places(country_id);
CREATE INDEX idx_geo_places_region ON geo_places(region_id);
CREATE INDEX idx_geo_places_geom ON geo_places USING GIST(geom);

-- ============================================================
-- 5. Actores estatales
-- ============================================================

CREATE TABLE state_actors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    official_name_es TEXT NOT NULL,
    official_name_en TEXT,
    short_name_es TEXT,
    country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
    actor_type_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    government_type_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    strategic_orientation TEXT,
    energy_profile TEXT,
    military_profile TEXT,
    economic_profile TEXT,
    influence_level SMALLINT CHECK (influence_level BETWEEN 1 AND 5),
    energy_relevance BOOLEAN NOT NULL DEFAULT FALSE,
    military_relevance BOOLEAN NOT NULL DEFAULT FALSE,
    economic_relevance BOOLEAN NOT NULL DEFAULT FALSE,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    geom GEOMETRY(GEOMETRY, 4326),
    status geopolem_status NOT NULL DEFAULT 'active',
    last_reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_state_actors_country ON state_actors(country_id);
CREATE INDEX idx_state_actors_type ON state_actors(actor_type_id);
CREATE INDEX idx_state_actors_geom ON state_actors USING GIST(geom);

-- ============================================================
-- 6. Actores no estatales
-- ============================================================

CREATE TABLE non_state_actors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name_es TEXT NOT NULL,
    name_en TEXT,
    actor_type_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    primary_region_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    primary_country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
    ideology_or_motivation TEXT,
    objectives TEXT,
    capabilities TEXT,
    funding_sources TEXT,
    territorial_control TEXT,
    energy_relevance BOOLEAN NOT NULL DEFAULT FALSE,
    military_relevance BOOLEAN NOT NULL DEFAULT FALSE,
    economic_relevance BOOLEAN NOT NULL DEFAULT FALSE,
    influence_level SMALLINT CHECK (influence_level BETWEEN 1 AND 5),
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    area_of_operation GEOMETRY(GEOMETRY, 4326),
    status geopolem_status NOT NULL DEFAULT 'active',
    last_reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_non_state_actors_region ON non_state_actors(primary_region_id);
CREATE INDEX idx_non_state_actors_country ON non_state_actors(primary_country_id);
CREATE INDEX idx_non_state_actors_type ON non_state_actors(actor_type_id);
CREATE INDEX idx_non_state_actors_geom ON non_state_actors USING GIST(area_of_operation);

-- ============================================================
-- 7. Recursos energéticos y estratégicos
-- ============================================================

CREATE TABLE energy_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name_es TEXT NOT NULL,
    name_en TEXT,
    resource_type_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    category_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    description TEXT,
    strategic_importance SMALLINT CHECK (strategic_importance BETWEEN 1 AND 5),
    market_relevance TEXT,
    energy_transition_relevance BOOLEAN NOT NULL DEFAULT FALSE,
    supply_security_relevance BOOLEAN NOT NULL DEFAULT FALSE,
    critical_mineral BOOLEAN NOT NULL DEFAULT FALSE,
    unit_of_measure TEXT,
    status geopolem_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_energy_resources_type ON energy_resources(resource_type_id);
CREATE INDEX idx_energy_resources_category ON energy_resources(category_id);

CREATE TABLE resource_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES energy_resources(id) ON DELETE CASCADE,
    country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
    place_id UUID REFERENCES geo_places(id) ON DELETE SET NULL,
    location_name TEXT,
    production_role TEXT,
    reserve_or_capacity_estimate TEXT,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    geom GEOMETRY(GEOMETRY, 4326),
    source_confidence SMALLINT CHECK (source_confidence BETWEEN 1 AND 5),
    status geopolem_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_resource_locations_resource ON resource_locations(resource_id);
CREATE INDEX idx_resource_locations_country ON resource_locations(country_id);
CREATE INDEX idx_resource_locations_geom ON resource_locations USING GIST(geom);

-- ============================================================
-- 8. Chokepoints y rutas estratégicas
-- ============================================================

CREATE TABLE chokepoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name_es TEXT NOT NULL,
    name_en TEXT,
    chokepoint_type_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    primary_region_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    description TEXT,
    strategic_importance SMALLINT CHECK (strategic_importance BETWEEN 1 AND 5),
    risk_level SMALLINT CHECK (risk_level BETWEEN 1 AND 5),
    energy_flow_relevance BOOLEAN NOT NULL DEFAULT FALSE,
    trade_flow_relevance BOOLEAN NOT NULL DEFAULT FALSE,
    military_relevance BOOLEAN NOT NULL DEFAULT FALSE,
    main_risks TEXT,
    controlled_or_influenced_by TEXT,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    geom GEOMETRY(GEOMETRY, 4326),
    geometry_type geometry_kind DEFAULT 'point',
    status geopolem_status NOT NULL DEFAULT 'active',
    last_reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chokepoints_region ON chokepoints(primary_region_id);
CREATE INDEX idx_chokepoints_type ON chokepoints(chokepoint_type_id);
CREATE INDEX idx_chokepoints_geom ON chokepoints USING GIST(geom);

CREATE TABLE strategic_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name_es TEXT NOT NULL,
    name_en TEXT,
    route_type_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    primary_region_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    description TEXT,
    origin_place_id UUID REFERENCES geo_places(id) ON DELETE SET NULL,
    destination_place_id UUID REFERENCES geo_places(id) ON DELETE SET NULL,
    geom GEOMETRY(GEOMETRY, 4326),
    geometry_type geometry_kind DEFAULT 'line',
    strategic_importance SMALLINT CHECK (strategic_importance BETWEEN 1 AND 5),
    risk_level SMALLINT CHECK (risk_level BETWEEN 1 AND 5),
    status geopolem_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_strategic_routes_region ON strategic_routes(primary_region_id);
CREATE INDEX idx_strategic_routes_type ON strategic_routes(route_type_id);
CREATE INDEX idx_strategic_routes_geom ON strategic_routes USING GIST(geom);

CREATE TABLE chokepoint_resource_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chokepoint_id UUID NOT NULL REFERENCES chokepoints(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES energy_resources(id) ON DELETE CASCADE,
    flow_direction TEXT,
    estimated_volume TEXT,
    importance_note TEXT,
    source_confidence SMALLINT CHECK (source_confidence BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (chokepoint_id, resource_id, flow_direction)
);

CREATE INDEX idx_chokepoint_resource_flows_chokepoint ON chokepoint_resource_flows(chokepoint_id);
CREATE INDEX idx_chokepoint_resource_flows_resource ON chokepoint_resource_flows(resource_id);

-- ============================================================
-- 9. Conflictos
-- ============================================================

CREATE TABLE conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name_es TEXT NOT NULL,
    name_en TEXT,
    summary TEXT,
    conflict_type_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    primary_region_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    primary_country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
    status geopolem_status NOT NULL DEFAULT 'active',
    intensity_level SMALLINT CHECK (intensity_level BETWEEN 1 AND 5),
    escalation_risk SMALLINT CHECK (escalation_risk BETWEEN 1 AND 5),
    humanitarian_impact SMALLINT CHECK (humanitarian_impact BETWEEN 1 AND 5),
    energy_dimension BOOLEAN NOT NULL DEFAULT FALSE,
    territorial_dimension BOOLEAN NOT NULL DEFAULT FALSE,
    external_involvement BOOLEAN NOT NULL DEFAULT FALSE,
    start_date DATE,
    end_date DATE,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    geom GEOMETRY(GEOMETRY, 4326),
    geometry_type geometry_kind DEFAULT 'point',
    background TEXT,
    current_status TEXT,
    analytical_assessment TEXT,
    source_confidence SMALLINT CHECK (source_confidence BETWEEN 1 AND 5),
    verification verification_status NOT NULL DEFAULT 'partially_verified',
    last_reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conflicts_type ON conflicts(conflict_type_id);
CREATE INDEX idx_conflicts_region ON conflicts(primary_region_id);
CREATE INDEX idx_conflicts_country ON conflicts(primary_country_id);
CREATE INDEX idx_conflicts_status ON conflicts(status);
CREATE INDEX idx_conflicts_geom ON conflicts USING GIST(geom);

-- ============================================================
-- 10. Relaciones entre conflictos, actores, recursos y rutas
-- ============================================================

CREATE TABLE conflict_state_actors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conflict_id UUID NOT NULL REFERENCES conflicts(id) ON DELETE CASCADE,
    state_actor_id UUID NOT NULL REFERENCES state_actors(id) ON DELETE CASCADE,
    role_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    alignment actor_alignment DEFAULT 'unknown',
    involvement_level SMALLINT CHECK (involvement_level BETWEEN 1 AND 5),
    description TEXT,
    start_date DATE,
    end_date DATE,
    source_confidence SMALLINT CHECK (source_confidence BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (conflict_id, state_actor_id, role_id)
);

CREATE INDEX idx_conflict_state_actors_conflict ON conflict_state_actors(conflict_id);
CREATE INDEX idx_conflict_state_actors_actor ON conflict_state_actors(state_actor_id);

CREATE TABLE conflict_non_state_actors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conflict_id UUID NOT NULL REFERENCES conflicts(id) ON DELETE CASCADE,
    non_state_actor_id UUID NOT NULL REFERENCES non_state_actors(id) ON DELETE CASCADE,
    role_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    alignment actor_alignment DEFAULT 'unknown',
    involvement_level SMALLINT CHECK (involvement_level BETWEEN 1 AND 5),
    description TEXT,
    start_date DATE,
    end_date DATE,
    source_confidence SMALLINT CHECK (source_confidence BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (conflict_id, non_state_actor_id, role_id)
);

CREATE INDEX idx_conflict_non_state_actors_conflict ON conflict_non_state_actors(conflict_id);
CREATE INDEX idx_conflict_non_state_actors_actor ON conflict_non_state_actors(non_state_actor_id);

CREATE TABLE conflict_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conflict_id UUID NOT NULL REFERENCES conflicts(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES energy_resources(id) ON DELETE CASCADE,
    relationship_type_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    relevance_level SMALLINT CHECK (relevance_level BETWEEN 1 AND 5),
    description TEXT,
    source_confidence SMALLINT CHECK (source_confidence BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (conflict_id, resource_id, relationship_type_id)
);

CREATE INDEX idx_conflict_resources_conflict ON conflict_resources(conflict_id);
CREATE INDEX idx_conflict_resources_resource ON conflict_resources(resource_id);

CREATE TABLE conflict_chokepoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conflict_id UUID NOT NULL REFERENCES conflicts(id) ON DELETE CASCADE,
    chokepoint_id UUID NOT NULL REFERENCES chokepoints(id) ON DELETE CASCADE,
    relationship_type_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    risk_level SMALLINT CHECK (risk_level BETWEEN 1 AND 5),
    description TEXT,
    source_confidence SMALLINT CHECK (source_confidence BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (conflict_id, chokepoint_id, relationship_type_id)
);

CREATE INDEX idx_conflict_chokepoints_conflict ON conflict_chokepoints(conflict_id);
CREATE INDEX idx_conflict_chokepoints_chokepoint ON conflict_chokepoints(chokepoint_id);

-- Relación causa-efecto para conflictos, eventos, recursos y chokepoints.
CREATE TABLE causal_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_entity_type TEXT NOT NULL,
    source_entity_id UUID NOT NULL,
    target_entity_type TEXT NOT NULL,
    target_entity_id UUID NOT NULL,
    link_type causal_link_type NOT NULL,
    title TEXT NOT NULL,
    explanation TEXT NOT NULL,
    mechanism TEXT,
    direction TEXT DEFAULT 'source_to_target',
    strength SMALLINT CHECK (strength BETWEEN 1 AND 5),
    confidence_score SMALLINT CHECK (confidence_score BETWEEN 1 AND 5),
    start_date DATE,
    end_date DATE,
    status geopolem_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_causal_links_source ON causal_links(source_entity_type, source_entity_id);
CREATE INDEX idx_causal_links_target ON causal_links(target_entity_type, target_entity_id);
CREATE INDEX idx_causal_links_type ON causal_links(link_type);

-- ============================================================
-- 11. Eventos y cronologías
-- ============================================================

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    title_es TEXT NOT NULL,
    title_en TEXT,
    event_type_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    event_date DATE NOT NULL,
    event_time TIME,
    conflict_id UUID REFERENCES conflicts(id) ON DELETE SET NULL,
    primary_region_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
    place_id UUID REFERENCES geo_places(id) ON DELETE SET NULL,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    geom GEOMETRY(GEOMETRY, 4326),
    geometry_type geometry_kind DEFAULT 'point',
    description TEXT,
    immediate_impact TEXT,
    strategic_significance TEXT,
    impact_level SMALLINT CHECK (impact_level BETWEEN 1 AND 5),
    verification verification_status NOT NULL DEFAULT 'unverified',
    source_confidence SMALLINT CHECK (source_confidence BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_type ON events(event_type_id);
CREATE INDEX idx_events_conflict ON events(conflict_id);
CREATE INDEX idx_events_region ON events(primary_region_id);
CREATE INDEX idx_events_geom ON events USING GIST(geom);

-- ============================================================
-- 12. Etiquetado transversal
-- ============================================================

CREATE TABLE entity_taxonomies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    taxonomy_id UUID NOT NULL REFERENCES taxonomies(id) ON DELETE CASCADE,
    relevance_score SMALLINT DEFAULT 100 CHECK (relevance_score BETWEEN 1 AND 100),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(entity_type, entity_id, taxonomy_id)
);

CREATE INDEX idx_entity_taxonomies_entity ON entity_taxonomies(entity_type, entity_id);
CREATE INDEX idx_entity_taxonomies_taxonomy ON entity_taxonomies(taxonomy_id);
CREATE INDEX idx_entity_taxonomies_primary ON entity_taxonomies(entity_type, entity_id, is_primary);

-- ============================================================
-- 13. Capas del mapa interactivo
-- ============================================================

CREATE TABLE map_layers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    label_es TEXT NOT NULL,
    label_en TEXT,
    layer_type_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    theme_id UUID REFERENCES taxonomies(id) ON DELETE SET NULL,
    description TEXT,
    geometry_type geometry_kind NOT NULL,
    data_source_entity_type TEXT,
    data_source_ref TEXT,
    default_visible BOOLEAN NOT NULL DEFAULT FALSE,
    style_token TEXT,
    min_zoom SMALLINT DEFAULT 1,
    max_zoom SMALLINT DEFAULT 20,
    refresh_frequency TEXT,
    status geopolem_status NOT NULL DEFAULT 'active',
    last_updated TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_map_layers_type ON map_layers(layer_type_id);
CREATE INDEX idx_map_layers_theme ON map_layers(theme_id);

-- ============================================================
-- 14. Vistas útiles para mapa y CMS
-- ============================================================

CREATE VIEW v_active_conflicts_map AS
SELECT
    c.id,
    c.slug,
    c.name_es,
    c.summary,
    c.intensity_level,
    c.escalation_risk,
    c.energy_dimension,
    c.territorial_dimension,
    c.latitude,
    c.longitude,
    c.geom,
    c.geometry_type,
    t.label_es AS conflict_type,
    r.label_es AS primary_region,
    c.updated_at
FROM conflicts c
LEFT JOIN taxonomies t ON c.conflict_type_id = t.id
LEFT JOIN taxonomies r ON c.primary_region_id = r.id
WHERE c.status = 'active';

CREATE VIEW v_chokepoints_map AS
SELECT
    cp.id,
    cp.slug,
    cp.name_es,
    cp.description,
    cp.strategic_importance,
    cp.risk_level,
    cp.energy_flow_relevance,
    cp.trade_flow_relevance,
    cp.latitude,
    cp.longitude,
    cp.geom,
    cp.geometry_type,
    r.label_es AS primary_region,
    cp.updated_at
FROM chokepoints cp
LEFT JOIN taxonomies r ON cp.primary_region_id = r.id
WHERE cp.status = 'active';

CREATE VIEW v_energy_resource_locations_map AS
SELECT
    rl.id,
    er.slug AS resource_slug,
    er.name_es AS resource_name,
    er.strategic_importance,
    er.energy_transition_relevance,
    er.supply_security_relevance,
    rl.location_name,
    rl.production_role,
    rl.reserve_or_capacity_estimate,
    rl.latitude,
    rl.longitude,
    rl.geom,
    c.name_es AS country_name,
    rl.updated_at
FROM resource_locations rl
JOIN energy_resources er ON rl.resource_id = er.id
LEFT JOIN countries c ON rl.country_id = c.id
WHERE rl.status = 'active'
  AND er.status = 'active';

-- ============================================================
-- 15. Triggers de actualización
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_taxonomies_updated_at
BEFORE UPDATE ON taxonomies
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sources_updated_at
BEFORE UPDATE ON sources
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_countries_updated_at
BEFORE UPDATE ON countries
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_geo_places_updated_at
BEFORE UPDATE ON geo_places
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_state_actors_updated_at
BEFORE UPDATE ON state_actors
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_non_state_actors_updated_at
BEFORE UPDATE ON non_state_actors
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_energy_resources_updated_at
BEFORE UPDATE ON energy_resources
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_resource_locations_updated_at
BEFORE UPDATE ON resource_locations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_chokepoints_updated_at
BEFORE UPDATE ON chokepoints
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_strategic_routes_updated_at
BEFORE UPDATE ON strategic_routes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_conflicts_updated_at
BEFORE UPDATE ON conflicts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_causal_links_updated_at
BEFORE UPDATE ON causal_links
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_events_updated_at
BEFORE UPDATE ON events
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

