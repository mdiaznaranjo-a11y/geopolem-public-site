// GEOPÓLEM — Manifiesto del Release Candidate (Sprint 19)
// ---------------------------------------------------------------------------
// Módulo PURO (sin disco/red: la IO se inyecta) que construye y verifica el
// MANIFIESTO de un Release Candidate. El RC NO es producción: sólo APUNTA a los
// artefactos de STAGING ya validados (api/v1/staging/**) mediante ruta relativa +
// checksum sha256, de modo que sea REPRODUCIBLE y NO DESTRUCTIVO (no duplica ni
// reescribe canónicos). Vive bajo api/v1/rc/ para que sea cacheable por el
// service-worker (mismo criterio /api/v1/*.json) y elegible offline en la PWA,
// sin romper GitHub Pages.
//
// El manifiesto reúne todo lo necesario para un go/no-go auditable:
//   • artifacts[]          — staging referenciado con sha256 (integridad).
//   • checksum             — sha256 del conjunto de artefactos (huella del RC).
//   • coverage             — gate de cobertura (desde coverage-report).
//   • build                — metadatos deterministas (contrato, generated_at).
//   • source_review        — resumen de la clasificación editorial (Sprint 19).
//   • rollback_pointer     — plan de rollback de canónicos por si se promoviera.
//   • production           — estado del gate de producción (DESHABILITADO).
//
// REGLA DE ORO: determinista (mismas entradas → mismo manifiesto) y no toca
// producción. `generated_at` lo fija el llamante (heredado de staging) para
// artefactos no-diff.
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto';

export const RC_CONTRACT = 'sprint-19-release-candidate-v1';
export const RC_BASE = 'api/v1/rc';

export function rcManifestPath() { return `${RC_BASE}/manifest.json`; }

function isPlainObject(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }
function str(v) { return typeof v === 'string' ? v.trim() : ''; }
function asArray(v) { return Array.isArray(v) ? v : []; }

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

// Ninguna ruta del RC debe apuntar a un canónico de producción: el RC sólo
// referencia staging (separación estricta, producción intacta).
export function isCanonicalProductionPath(relPath) {
  const p = String(relPath);
  return /^api\/v1\/conflicts(\.|\/)/.test(p) && !/^api\/v1\/staging\//.test(p);
}

// Checksum agregado, estable e independiente del orden de entrada: se ordena por
// path y se concatena `path:sha256`. Huella reproducible del conjunto del RC.
export function aggregateChecksum(artifacts) {
  const lines = asArray(artifacts)
    .map((a) => `${str(a.path)}:${str(a.sha256)}`)
    .sort();
  return sha256(lines.join('\n'));
}

/* --------------------------------------------------------------------------
   buildRcManifest: ensambla el manifiesto del RC de forma determinista.

   deps:
     artifacts      — [{ path, sha256, contract? }] de staging (ruta relativa).
     coverage       — objeto coverage-report de staging (para extraer el gate).
     editorialSummary — resumen de data/editorial-review-queue.rc.json.
     rollbackPlan   — salida de planCanonicalBackup (manifiesto de canónicos).
     conflictIds    — ids incluidos en el RC (para trazabilidad).
     generatedAt    — timestamp determinista heredado de staging.
     publishEnabled — bandera del gate de producción (false en este ciclo).
-------------------------------------------------------------------------- */
export function buildRcManifest({
  artifacts = [], coverage = null, editorialSummary = null, rollbackPlan = null,
  conflictIds = [], generatedAt = null, publishEnabled = false,
} = {}) {
  const cleanArtifacts = asArray(artifacts)
    .filter((a) => isPlainObject(a) && str(a.path) && str(a.sha256))
    .map((a) => ({ path: str(a.path), sha256: str(a.sha256), ...(str(a.contract) ? { contract: str(a.contract) } : {}) }))
    .sort((x, y) => (x.path < y.path ? -1 : x.path > y.path ? 1 : 0));

  const gate = isPlainObject(coverage) && isPlainObject(coverage.gate) ? coverage.gate : null;
  const editorialBlocking = isPlainObject(editorialSummary)
    ? Number(editorialSummary.blocking_production ?? 0) : null;

  // Un RC está "listo para promoción" (aún bajo doble gate humano) cuando:
  //   • la cobertura es 100% y su gate ok,
  //   • hay artefactos con integridad,
  //   • y no hay pendientes editoriales que bloqueen producción.
  // NUNCA implica publicar: la publicación real permanece deshabilitada.
  const coverageOk = Boolean(gate && gate.ok === true && gate.coverage_ok === true);
  const editorialClear = editorialBlocking === 0;
  const readyForPromotion = coverageOk && cleanArtifacts.length > 0 && editorialClear;

  const blockers = [];
  if (!coverageOk) blockers.push('cobertura de staging incompleta o gate no ok');
  if (cleanArtifacts.length === 0) blockers.push('sin artefactos de staging referenciados');
  if (!editorialClear) blockers.push(`${editorialBlocking} pendiente/s editorial/es bloquean producción`);
  if (!publishEnabled) blockers.push('publicación a producción DESHABILITADA por política (PRODUCTION_PUBLISH_ENABLED=false)');

  return {
    contract: RC_CONTRACT,
    generated_at: generatedAt,
    is_production: false,
    notice: 'Release Candidate (Sprint 19). Apunta a artefactos de STAGING validados vía checksum sha256; NO es producción y NO modifica canónicos. Reproducible y no destructivo. La promoción real exige doble gate humano y sigue DESHABILITADA por política.',
    build: {
      artifact_count: cleanArtifacts.length,
      conflict_ids: [...asArray(conflictIds).map(str).filter(Boolean)].sort(),
      source_tree: 'api/v1/staging',
    },
    checksum: {
      algo: 'sha256',
      aggregate: aggregateChecksum(cleanArtifacts),
    },
    coverage: gate ? {
      coverage_pct: gate.coverage_pct ?? null,
      ok: gate.ok === true,
      coverage_ok: gate.coverage_ok === true,
    } : null,
    source_review: isPlainObject(editorialSummary) ? {
      total: editorialSummary.total ?? null,
      by_classification: editorialSummary.by_classification ?? null,
      resolved: editorialSummary.resolved ?? null,
      blocking_production: editorialBlocking,
    } : null,
    rollback_pointer: isPlainObject(rollbackPlan) ? {
      contract: str(rollbackPlan.contract) || null,
      count: rollbackPlan.count ?? asArray(rollbackPlan.files).length,
      files: asArray(rollbackPlan.files).map((f) => str(f.path)).filter(Boolean),
      note: 'Plan de respaldo de canónicos de producción para un hipotético rollback. NO se ejecuta en este RC.',
    } : null,
    production: {
      publish_enabled: publishEnabled,
      ready_for_promotion: readyForPromotion,
      blockers,
    },
    artifacts: cleanArtifacts,
  };
}

/* --------------------------------------------------------------------------
   verifyRcManifest: valida estructura del manifiesto y, si se aporta un lector
   de checksums, re-verifica la integridad de cada artefacto referenciado y el
   checksum agregado. NO toca disco por sí mismo; `readSha256(path)` se inyecta.

   Devuelve { ok, errors[] } (nunca lanza).
-------------------------------------------------------------------------- */
export function verifyRcManifest(manifest, { readSha256 = null } = {}) {
  const errors = [];
  const fail = (m) => errors.push(m);
  if (!isPlainObject(manifest)) { fail('manifest: no es objeto'); return { ok: false, errors }; }
  if (manifest.contract !== RC_CONTRACT) fail(`manifest: contract != ${RC_CONTRACT}`);
  if (manifest.is_production !== false) fail('manifest: is_production != false (el RC NO es producción)');
  const artifacts = asArray(manifest.artifacts);
  if (artifacts.length === 0) fail('manifest: sin artefactos');

  for (const a of artifacts) {
    const p = str(a.path);
    if (!p) { fail('manifest: artefacto sin path'); continue; }
    if (isCanonicalProductionPath(p)) fail(`manifest: el artefacto ${p} apunta a un canónico de producción (prohibido)`);
    if (!/^api\/v1\/staging\//.test(p)) fail(`manifest: el artefacto ${p} no vive bajo api/v1/staging/`);
    if (!str(a.sha256)) fail(`manifest: artefacto ${p} sin sha256`);
    if (readSha256) {
      let actual = null;
      try { actual = readSha256(p); } catch (e) { fail(`manifest: no se pudo leer ${p}: ${e.message}`); continue; }
      if (actual !== str(a.sha256)) fail(`manifest: checksum de ${p} no coincide (esperado ${str(a.sha256).slice(0, 12)}…, actual ${String(actual).slice(0, 12)}…)`);
    }
  }

  const expectedAggregate = aggregateChecksum(artifacts);
  if (str(manifest.checksum?.aggregate) !== expectedAggregate) {
    fail('manifest: checksum agregado no coincide con los artefactos');
  }

  if (!isPlainObject(manifest.production)) fail('manifest: falta bloque production');
  else if (manifest.production.publish_enabled !== false) fail('manifest: production.publish_enabled debe ser false en este ciclo');

  return { ok: errors.length === 0, errors };
}
