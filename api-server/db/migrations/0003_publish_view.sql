-- GEOPÓLEM — Migración 0003 (Sprint 9): vista pública consciente de 'published'.
-- ===========================================================================
-- OPCIONAL, IDEMPOTENTE y NO DESTRUCTIVA. Complementa a 0001_cms_status.sql.
--
-- Regla de publicación (Sprint 9, ver src/validation.mjs):
--   Sólo el estado editorial `published` alimenta las vistas públicas.
--   Con el mapeo por defecto, published → enum 'active', por lo que la vista
--   original v_active_conflicts_map (WHERE status='active') YA es correcta y no
--   necesita cambios.
--
-- Esta migración sólo tiene efecto SI previamente aplicaste 0001_cms_status.sql
-- (que añade el valor 'published' al enum geopolem_status) y decides persistir
-- los estados editoriales tal cual. En ese caso, redefine la vista para incluir
-- también las filas con status='published'. Si el valor 'published' NO existe en
-- el enum, la migración NO toca nada (bloque guardado) y es un no-op seguro.
--
-- Compatibilidad: PostgreSQL/PostGIS. CREATE OR REPLACE VIEW conserva la firma.
-- ===========================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'geopolem_status'
       AND e.enumlabel = 'published'
  ) THEN
    EXECUTE $view$
      CREATE OR REPLACE VIEW v_active_conflicts_map AS
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
      WHERE c.status IN ('active', 'published')
    $view$;
    RAISE NOTICE 'Migración 0003: v_active_conflicts_map ahora incluye status IN (active, published).';
  ELSE
    RAISE NOTICE 'Migración 0003: no-op (el enum geopolem_status no tiene el valor published; aplica 0001 primero si lo deseas).';
  END IF;
END $$;
