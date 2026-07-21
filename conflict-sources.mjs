// GEOPÓLEM — Fuentes verificadas y promoción controlada (Sprint 14)
// ---------------------------------------------------------------------------
// Módulo PURO (sin disco/red) que gobierna la semilla VERIFICADA del Sprint 14
// (`data/conflict-relations.verified.seed.json`). Reutiliza los validadores puros
// del Sprint 13 (conflict-relations.mjs) y añade las reglas nuevas del sprint:
//
//   • Una `source` con verification='verified' NO puede ser demo ni usar URLs de
//     ejemplo (example.org/example.com) y DEBE tener fecha de acceso (accessed_at).
//   • REGLA CLAVE Sprint 14: todo `causal_link` REAL (pending=false) DEBE
//     referenciar (source_slugs) al menos una `source` PUBLICABLE del mismo
//     conflicto. Esto impide publicar relaciones causales sin respaldo.
//   • Cobertura verificada vs. pendiente por conflicto (para reporte/promoción).
//   • Construcción del artefacto de PREVIEW verificado (merge NO destructivo,
//     sólo fuentes verificadas), separado de los canónicos.
//
// Regla de oro (heredada): no inventar datos. Lo que no se puede verificar queda
// pending y se documenta en data/source-research.todo.json.
// ---------------------------------------------------------------------------

import {
  validateSource, isPublishableSource, normalizeSeedRelations, mergeRelations,
  EDITORIAL_STATUSES,
} from './conflict-relations.mjs';

export const VERIFIED_SEED_CONTRACT = 'sprint-14-verified-v1';
export const VERIFIED_ENRICHED_CONTRACT = 'sprint-14-verified-enriched-v1';
export const EXAMPLE_URL_RE = /(^|\.)(example\.org|example\.com|example\.net)([/:]|$)/i;

function asArray(v) { return Array.isArray(v) ? v : []; }
function isPlainObject(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }
function str(v) { return typeof v === 'string' ? v.trim() : ''; }

// ¿Es una URL de ejemplo/placeholder (no admisible para verified)?
export function isExampleUrl(url) {
  const s = str(url);
  if (!s) return false;
  try {
    const host = new URL(s).hostname;
    return EXAMPLE_URL_RE.test(host);
  } catch {
    return EXAMPLE_URL_RE.test(s);
  }
}

/* --------------------------------------------------------------------------
   validateVerifiedSource: además de la estructura base (Sprint 13), exige que
   una fuente marcada verified tenga fecha de acceso y NO sea placeholder/demo.
   Devuelve { ok, errors[] } (no lanza).
-------------------------------------------------------------------------- */
export function validateVerifiedSource(src, where = 'source') {
  const base = validateSource(src, where);
  const errors = [...base.errors];
  if (isPlainObject(src) && src.verification === 'verified') {
    if (src.demo === true) errors.push(`${where}: verified no puede ser demo`);
    if (isExampleUrl(src.url)) errors.push(`${where}.url: verified no puede usar URL de ejemplo`);
    if (!str(src.accessed_at) && !str(src.date)) errors.push(`${where}: verified requiere accessed_at`);
  }
  return { ok: errors.length === 0, errors };
}

/* --------------------------------------------------------------------------
   validateCausalLinksHaveSources: REGLA CLAVE del Sprint 14. Para cada conflicto,
   todo causal_link con pending=false DEBE tener source_slugs que resuelvan a ≥1
   fuente PUBLICABLE del mismo conflicto. Devuelve { ok, violations[] } donde cada
   violación es { conflict, index, title, reason }. No lanza.
-------------------------------------------------------------------------- */
export function validateCausalLinksHaveSources(seed) {
  const violations = [];
  const conflicts = isPlainObject(seed) && isPlainObject(seed.conflicts) ? seed.conflicts : {};
  for (const [id, entry] of Object.entries(conflicts)) {
    if (!isPlainObject(entry)) continue;
    const sources = asArray(entry.sources);
    const publishableSlugs = new Set(
      sources.filter(isPublishableSource).map((s) => str(s.slug)).filter(Boolean),
    );
    asArray(entry.causal_links).forEach((link, index) => {
      if (!isPlainObject(link)) return;
      const isReal = link.pending === false;
      if (!isReal) return;
      const refs = asArray(link.source_slugs).map(str).filter(Boolean);
      const title = str(link.title) || `causal_links[${index}]`;
      if (refs.length === 0) {
        violations.push({ conflict: id, index, title, reason: 'causal_link no-pending sin source_slugs' });
        return;
      }
      const resolved = refs.some((slug) => publishableSlugs.has(slug));
      if (!resolved) {
        violations.push({ conflict: id, index, title, reason: 'source_slugs no resuelven a ninguna fuente publicable' });
      }
    });
  }
  return { ok: violations.length === 0, violations };
}

/* --------------------------------------------------------------------------
   validateVerifiedSeed: valida el documento completo de la semilla verificada.
   { ok, errors, warnings }. Combina estructura + reglas Sprint 14. No lanza.
-------------------------------------------------------------------------- */
export function validateVerifiedSeed(seed) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(seed)) return { ok: false, errors: ['seed: raíz no es objeto'], warnings };
  if (seed.contract !== VERIFIED_SEED_CONTRACT) errors.push(`seed.contract: se esperaba "${VERIFIED_SEED_CONTRACT}"`);
  if (!isPlainObject(seed.conflicts)) {
    errors.push('seed.conflicts: debe ser objeto { [id]: entry }');
    return { ok: false, errors, warnings };
  }
  for (const [id, entry] of Object.entries(seed.conflicts)) {
    if (!isPlainObject(entry)) { errors.push(`conflicts.${id}: no es objeto`); continue; }
    const status = entry.editorial_status ?? 'draft';
    if (!EDITORIAL_STATUSES.includes(status)) errors.push(`conflicts.${id}.editorial_status: inválido "${status}"`);
    const sourceSlugs = new Set();
    asArray(entry.sources).forEach((s, i) => {
      const { ok, errors: e } = validateVerifiedSource(s, `conflicts.${id}.sources[${i}]`);
      if (!ok) errors.push(...e);
      const slug = isPlainObject(s) ? str(s.slug) : '';
      if (slug) {
        if (sourceSlugs.has(slug)) errors.push(`conflicts.${id}.sources: slug duplicado "${slug}"`);
        sourceSlugs.add(slug);
      }
      if (isPlainObject(s) && s.verification !== 'verified') {
        warnings.push(`conflicts.${id}.sources[${i}]: verification!=verified (no publicable)`);
      }
    });
    // Referencias de causal_links deben existir dentro del propio conflicto.
    asArray(entry.causal_links).forEach((link, i) => {
      asArray(isPlainObject(link) ? link.source_slugs : []).forEach((ref) => {
        if (str(ref) && !sourceSlugs.has(str(ref))) {
          errors.push(`conflicts.${id}.causal_links[${i}].source_slugs: "${ref}" no existe en sources`);
        }
      });
    });
    if (asArray(entry.sources).length === 0 && status !== 'draft') {
      warnings.push(`conflicts.${id}: sin fuentes y estado "${status}" (esperado draft mientras pending)`);
    }
    // Regla published: al menos una fuente publicable.
    if (status === 'published') {
      const hasPublishable = asArray(entry.sources).some(isPublishableSource);
      if (!hasPublishable) errors.push(`conflicts.${id}: 'published' sin fuente publicable (verified)`);
    }
  }
  // Regla clave: causal_links reales exigen fuente.
  const causal = validateCausalLinksHaveSources(seed);
  if (!causal.ok) {
    for (const v of causal.violations) {
      errors.push(`conflicts.${v.conflict}.causal_links[${v.index}] ("${v.title}"): ${v.reason}`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

/* --------------------------------------------------------------------------
   computeVerifiedCoverage: cobertura verificada vs. pendiente por conflicto y
   agregados, para el reporte y la decisión de promoción. No lanza.
   Si se pasa `inventoryIds`, comprueba que todos estén presentes en la semilla.
-------------------------------------------------------------------------- */
export function computeVerifiedCoverage(seed, inventoryIds = null) {
  const conflicts = isPlainObject(seed) && isPlainObject(seed.conflicts) ? seed.conflicts : {};
  const perConflict = {};
  const totals = {
    conflicts: 0,
    with_verified_source: 0,
    fully_pending: 0,
    causal_links_total: 0,
    causal_links_verified: 0,
    causal_links_pending: 0,
    verified_sources: 0,
  };
  for (const [id, entry] of Object.entries(conflicts)) {
    const rel = normalizeSeedRelations(entry);
    const sources = asArray(entry && entry.sources);
    const verified = sources.filter(isPublishableSource).length;
    const causalTotal = asArray(entry && entry.causal_links).length;
    const causalVerified = asArray(entry && entry.causal_links).filter((l) => isPlainObject(l) && l.pending === false).length;
    const causalPending = causalTotal - causalVerified;
    const row = {
      editorial_status: (entry && entry.editorial_status) || 'draft',
      actors: rel.actors.state.length + rel.actors.non_state.length,
      resources: rel.resources.length,
      chokepoints: rel.chokepoints.length,
      causal_links: causalTotal,
      causal_links_verified: causalVerified,
      causal_links_pending: causalPending,
      verified_sources: verified,
      total_sources: sources.length,
    };
    perConflict[id] = row;
    totals.conflicts += 1;
    if (verified > 0) totals.with_verified_source += 1;
    if (verified === 0) totals.fully_pending += 1;
    totals.causal_links_total += causalTotal;
    totals.causal_links_verified += causalVerified;
    totals.causal_links_pending += causalPending;
    totals.verified_sources += verified;
  }
  const missingFromSeed = [];
  if (Array.isArray(inventoryIds)) {
    for (const id of inventoryIds) if (!(id in conflicts)) missingFromSeed.push(id);
  }
  return {
    generated_at: new Date().toISOString(),
    contract: VERIFIED_SEED_CONTRACT,
    totals,
    coverage_pct: totals.conflicts > 0
      ? Number(((totals.with_verified_source / totals.conflicts) * 100).toFixed(1))
      : 0,
    missing_from_seed: missingFromSeed,
    by_conflict: perConflict,
  };
}

/* --------------------------------------------------------------------------
   buildVerifiedDetail: aplica el merge NO destructivo (sólo fuentes verificadas)
   de la semilla verificada sobre un detalle v1, y preserva la trazabilidad de
   los causal_links (source_slugs) que el normalizador base descarta.
   Devuelve el objeto `data` enriquecido (no muta la entrada).
-------------------------------------------------------------------------- */
export function buildVerifiedDetail(detailWrapped, seedEntry) {
  const merged = mergeRelations(detailWrapped, seedEntry, { includeDemo: false });
  const data = merged.data;
  // Reinyecta source_slugs y pending de los causal_links de la semilla por título.
  const seedCausal = new Map(
    asArray(seedEntry && seedEntry.causal_links)
      .filter(isPlainObject)
      .map((l) => [str(l.title), l]),
  );
  data.causal_links = asArray(data.causal_links).map((l) => {
    const src = seedCausal.get(str(l && l.title));
    if (!src) return l;
    return {
      ...l,
      pending: src.pending === false ? false : Boolean(l.pending),
      source_slugs: asArray(src.source_slugs).map(str).filter(Boolean),
    };
  });
  return data;
}
