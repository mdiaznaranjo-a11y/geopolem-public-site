-- GEOPÓLEM — Migración 0002 (Sprint 9): integridad e índices relacionales.
-- ===========================================================================
-- ADITIVA, IDEMPOTENTE y NO DESTRUCTIVA. Endurece el esquema relacional que ya
-- existe en db/schema.sql (actores, recursos, chokepoints, causal_links,
-- sources y sus tablas puente) SIN recrear tablas ni borrar datos.
--
-- Puede aplicarse sobre una base creada con schema.sql o sobre una base previa
-- que aún no tuviera estos índices/constraints. Todas las sentencias usan
-- `IF NOT EXISTS` o bloques DO guardados contra el catálogo, de modo que
-- ejecutarla varias veces es seguro (re-runnable).
--
-- Compatibilidad: PostgreSQL 13+ (CREATE INDEX IF NOT EXISTS) y PostGIS. No usa
-- CONCURRENTLY para poder ejecutarse dentro de un script transaccional del
-- runner; si se aplica en caliente sobre una base grande, considera lanzar los
-- índices con CONCURRENTLY manualmente.
-- ===========================================================================

-- --- Índices de apoyo a filtros/orden de la API de lectura -----------------
-- (buildConflictFilters / SORTABLE en src/db.mjs usan estas columnas)
CREATE INDEX IF NOT EXISTS idx_conflicts_updated_at    ON conflicts (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conflicts_intensity     ON conflicts (intensity_level);
CREATE INDEX IF NOT EXISTS idx_conflicts_escalation    ON conflicts (escalation_risk);
CREATE INDEX IF NOT EXISTS idx_conflicts_status_region ON conflicts (status, primary_region_id);

-- --- Índices para el detalle enriquecido (getConflictRelations) -------------
-- Cada consulta enriquecida filtra por conflict_id / entity_id; reforzamos.
CREATE INDEX IF NOT EXISTS idx_conflict_resources_relevance
  ON conflict_resources (conflict_id, relevance_level DESC);
CREATE INDEX IF NOT EXISTS idx_conflict_chokepoints_risk
  ON conflict_chokepoints (conflict_id, risk_level DESC);
CREATE INDEX IF NOT EXISTS idx_conflict_state_actors_involvement
  ON conflict_state_actors (conflict_id, involvement_level DESC);
CREATE INDEX IF NOT EXISTS idx_conflict_non_state_actors_involvement
  ON conflict_non_state_actors (conflict_id, involvement_level DESC);

-- causal_links se consulta por ambos extremos (source/target); un índice por
-- par (type,id) acelera el OR polimórfico usado en el detalle.
CREATE INDEX IF NOT EXISTS idx_causal_links_source_pair
  ON causal_links (source_entity_type, source_entity_id, link_type);
CREATE INDEX IF NOT EXISTS idx_causal_links_target_pair
  ON causal_links (target_entity_type, target_entity_id, link_type);

-- source_links se consulta por (entity_type, entity_id); reforzamos verificación.
CREATE INDEX IF NOT EXISTS idx_source_links_entity_verification
  ON source_links (entity_type, entity_id, verification);

-- --- Constraints defensivos (idempotentes vía catálogo) ---------------------
-- No romper filas existentes: sólo añadimos CHECKs que las filas legales ya
-- cumplen. Guardados contra pg_constraint para no fallar en re-ejecución.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_conflicts_slug_not_blank') THEN
    ALTER TABLE conflicts
      ADD CONSTRAINT chk_conflicts_slug_not_blank CHECK (length(btrim(slug)) > 0) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_conflicts_name_not_blank') THEN
    ALTER TABLE conflicts
      ADD CONSTRAINT chk_conflicts_name_not_blank CHECK (length(btrim(name_es)) > 0) NOT VALID;
  END IF;
END $$;

-- causal_links no debe apuntar a sí mismo (source == target del mismo tipo/id).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_causal_links_no_self_ref') THEN
    ALTER TABLE causal_links
      ADD CONSTRAINT chk_causal_links_no_self_ref
      CHECK (NOT (source_entity_type = target_entity_type AND source_entity_id = target_entity_id))
      NOT VALID;
  END IF;
END $$;

-- Validación diferida de los CHECK añadidos como NOT VALID. Es segura: sólo
-- comprueba filas existentes y no bloquea escrituras nuevas. Si alguna fila
-- legada no cumpliera, VALIDATE fallaría de forma explícita (no destructiva).
DO $$
BEGIN
  BEGIN
    ALTER TABLE conflicts    VALIDATE CONSTRAINT chk_conflicts_slug_not_blank;
    ALTER TABLE conflicts    VALIDATE CONSTRAINT chk_conflicts_name_not_blank;
    ALTER TABLE causal_links VALIDATE CONSTRAINT chk_causal_links_no_self_ref;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'Migración 0002: constraints añadidos como NOT VALID; hay filas legadas que no cumplen. Revísalas y ejecuta VALIDATE CONSTRAINT manualmente.';
  END;
END $$;
