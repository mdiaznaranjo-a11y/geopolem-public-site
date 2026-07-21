// GEOPÓLEM — Respaldo/restauración de artefactos CANÓNICOS de producción (Sprint 18)
// ---------------------------------------------------------------------------
// Módulo PURO de contratos (sin efectos de red; la IO se inyecta) que PREPARA el
// rollback de los canónicos de producción por si una futura promoción se
// autoriza. En este sprint NO se ejecuta ninguna promoción real: estas utilidades
// permiten respaldar los canónicos ANTES de una hipotética escritura y
// restaurarlos si algo sale mal, con verificación de integridad (sha256).
//
// Canónicos protegidos (producción, NUNCA staging):
//   • api/v1/conflicts.json                       (lista canónica)
//   • api/v1/conflicts/{id}.json                  (detalle por conflicto)
//   • api/v1/conflicts/active/map.json            (mapa activo, si existe)
//   • api/v1/conflicts.seed.enriched.json         (bundle enriquecido, si existe)
//   • api/v1/conflicts.verified.enriched.json     (bundle verificado, si existe)
//
// El árbol de staging (api/v1/staging/**) NO forma parte de este rollback: tiene
// su propio respaldo (.rollback) en la promoción a staging (Sprint 15/17).
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto';

export const CANONICAL_ROLLBACK_DIR = '.canonical-rollback';
export const CANONICAL_MANIFEST = 'manifest.json';
export const ROLLBACK_CONTRACT = 'sprint-18-canonical-rollback-v1';

// Rutas canónicas FIJAS (independientes de conflictos concretos), relativas al
// root del repo. Las de detalle por conflicto se añaden dinámicamente.
export const FIXED_CANONICAL_PATHS = [
  'api/v1/conflicts.json',
  'api/v1/conflicts/active/map.json',
  'api/v1/conflicts.seed.enriched.json',
  'api/v1/conflicts.verified.enriched.json',
];

function asArray(v) { return Array.isArray(v) ? v : []; }
function str(v) { return typeof v === 'string' ? v.trim() : ''; }

// Ningún path del manifiesto debe apuntar a staging (separación estricta).
export function isStagingLike(relPath) {
  return /(^|\/)api\/v1\/staging\//.test(String(relPath));
}

/* --------------------------------------------------------------------------
   planCanonicalBackup: dado el listado de conflictos (para expandir los detalles
   por id) y un verificador de existencia inyectado, produce el MANIFIESTO de
   rutas canónicas que se respaldarían. No toca disco.

   deps:
     conflictIds  — string[] de ids de conflicto (para api/v1/conflicts/{id}.json)
     fileExists   — (relPath) => boolean  (relativo al root)
     includeMissing — si true, incluye rutas ausentes marcándolas present:false
-------------------------------------------------------------------------- */
export function planCanonicalBackup({ conflictIds = [], fileExists = () => true, includeMissing = false } = {}) {
  const rels = [...FIXED_CANONICAL_PATHS];
  for (const id of asArray(conflictIds).map(str).filter(Boolean)) {
    rels.push(`api/v1/conflicts/${id}.json`);
  }
  // Dedup preservando orden y excluyendo cualquier ruta de staging (seguridad).
  const seen = new Set();
  const entries = [];
  for (const rel of rels) {
    if (seen.has(rel) || isStagingLike(rel)) continue;
    seen.add(rel);
    const present = Boolean(fileExists(rel));
    if (present || includeMissing) entries.push({ path: rel, present });
  }
  return {
    contract: ROLLBACK_CONTRACT,
    count: entries.length,
    files: entries,
  };
}

// sha256 hex de un contenido (string o Buffer). Utilidad pura para verificar
// integridad de respaldos/restauraciones.
export function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

/* --------------------------------------------------------------------------
   diffManifests: compara dos manifiestos de checksums { path -> sha256 } y
   devuelve las diferencias. Útil para verificar que una restauración devolvió
   los canónicos a su estado original (mismatch vacío => restauración perfecta).
-------------------------------------------------------------------------- */
export function diffManifests(expected = {}, actual = {}) {
  const mismatched = [];
  const missing = [];
  for (const [path, hash] of Object.entries(expected)) {
    if (!(path in actual)) missing.push(path);
    else if (actual[path] !== hash) mismatched.push(path);
  }
  const extra = Object.keys(actual).filter((p) => !(p in expected));
  return { ok: mismatched.length === 0 && missing.length === 0, mismatched, missing, extra };
}
