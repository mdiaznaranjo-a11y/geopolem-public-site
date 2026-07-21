-- GEOPÓLEM — Migración OPCIONAL (Sprint 7): estados editoriales CMS
-- ===========================================================================
-- El esquema base (db/schema.sql) define el enum `geopolem_status` con los
-- valores: draft, active, archived, deprecated.
--
-- El ciclo editorial del CMS (Sprint 7) usa: draft → review → published →
-- archived. Por defecto, la capa de validación mapea ese vocabulario al enum
-- existente SIN tocar la base (src/validation.mjs → cmsStatusToDbStatus):
--     review    → draft   (revisión = borrador no publicado)
--     published → active
--
-- Esta migración es ADITIVA y OPCIONAL: sólo aplícala si deseas persistir los
-- estados editoriales tal cual en la columna `status`. `ALTER TYPE ... ADD
-- VALUE` es aditivo y NO rompe filas ni vistas existentes. No elimina valores.
--
-- IMPORTANTE:
--   • Ejecuta esta migración FUERA de una transacción con otras sentencias que
--     usen los nuevos valores (PostgreSQL exige commit del ADD VALUE antes de
--     usarlo). En psql, ejecútala en su propia sesión.
--   • Si aplicas esta migración, actualiza cmsStatusToDbStatus() para mapear
--     review→'review' y published→'published' (identidad) y ajusta la vista
--     v_active_conflicts_map para incluir status='published' si procede.
--   • NO es necesaria para operar en Sprint 7: el mapeo por defecto ya funciona.
-- ===========================================================================

ALTER TYPE geopolem_status ADD VALUE IF NOT EXISTS 'review' AFTER 'draft';
ALTER TYPE geopolem_status ADD VALUE IF NOT EXISTS 'published' AFTER 'review';

-- Si adoptas 'published' como estado visible, considera esta vista alternativa
-- (revisar antes de aplicar en producción):
--
--   CREATE OR REPLACE VIEW v_active_conflicts_map AS
--   SELECT ... FROM conflicts c ...
--   WHERE c.status IN ('active', 'published');
