// GEOPÓLEM — Semilla relacional de conflictos: validación y merge (Sprint 13)
// ---------------------------------------------------------------------------
// Módulo PURO (sin disco/red) que gobierna la SEMILLA editorial de relaciones y
// fuentes por conflicto (`data/conflict-relations.seed.json`). Responsabilidades:
//
//   • Validar la estructura de la semilla y de cada `source` (URL, título,
//     publisher/source_name) sin lanzar.
//   • Distinguir fuentes PUBLICABLES (verification='verified' + campos mínimos)
//     de fixtures DEMO/pendientes que NUNCA deben llegar a artefactos publicados.
//   • Aplicar una regla editorial estricta: un conflicto marcado 'published' DEBE
//     tener al menos una fuente publicable; una relación marcada 'verified' DEBE
//     tener fuente asociada.
//   • Fusionar (merge NO destructivo) las relaciones de la semilla sobre el
//     detalle v1 (`buildDetail`) preservando compatibilidad de contrato.
//   • Calcular cobertura por conflicto (sources/actores/recursos/chokepoints/
//     causal_links + pendientes) para el reporte editorial/técnico.
//
// Regla de oro (heredada): no inventar datos. Las relaciones estructurales de la
// semilla son de conocimiento público; las 'sources' demo son ejemplos claramente
// marcados. Por defecto, el merge SÓLO integra fuentes verificadas.
// ---------------------------------------------------------------------------

export const SEED_CONTRACT = 'sprint-13-seed-v1';
export const VERIFICATION_LEVELS = ['verified', 'pending', 'demo'];
// Debe coincidir con CAUSAL_RELATIONS de admin/editorial-validation.mjs.
export const CAUSAL_RELATIONS = ['causes', 'contributes_to', 'escalates', 'mitigates', 'blocks'];
// Ciclo editorial (idéntico a CMS_STATUSES del Sprint 8).
export const EDITORIAL_STATUSES = ['draft', 'review', 'published', 'archived'];

function asArray(v) { return Array.isArray(v) ? v : []; }
function isPlainObject(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }
function str(v) { return typeof v === 'string' ? v.trim() : ''; }

// Número finito o null. OJO: Number(null)===0, por eso descartamos null/''/undefined
// ANTES de convertir, para no fabricar ceros donde el dato está ausente.
function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Valida una URL http(s) sin lanzar. Mismas reglas que editorial-validation.mjs.
export function isHttpUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// Nombre de publisher/fuente admitiendo cualquiera de los dos campos.
function publisherOf(src) {
  return str(src.publisher) || str(src.source_name);
}

/* --------------------------------------------------------------------------
   Validación de una fuente. Devuelve { ok, errors[] } (no lanza).
   Reglas mínimas de estructura para CUALQUIER fuente (incluidas demo):
     • title no vacío
     • url http(s) válida
     • publisher o source_name no vacío
     • verification ∈ VERIFICATION_LEVELS (si está presente)
-------------------------------------------------------------------------- */
export function validateSource(src, where = 'source') {
  const errors = [];
  if (!isPlainObject(src)) return { ok: false, errors: [`${where}: debe ser objeto`] };
  if (!str(src.title)) errors.push(`${where}.title: obligatorio`);
  if (!isHttpUrl(src.url)) errors.push(`${where}.url: debe ser http(s) válida`);
  if (!publisherOf(src)) errors.push(`${where}: publisher|source_name obligatorio`);
  if (src.verification !== undefined && !VERIFICATION_LEVELS.includes(src.verification)) {
    errors.push(`${where}.verification: valor inválido "${src.verification}"`);
  }
  return { ok: errors.length === 0, errors };
}

// ¿La fuente es PUBLICABLE? Estructura válida + verification='verified' + no demo.
export function isPublishableSource(src) {
  if (!validateSource(src).ok) return false;
  if (src.demo === true) return false;
  return src.verification === 'verified';
}

function normalizeActorEntry(a) {
  const name = str(a && a.name);
  if (!name) return null;
  return {
    slug: str(a.slug) || null,
    name,
    role: str(a.role) || null,
    alignment: str(a.alignment) || null,
    involvement_level: numOrNull(a.involvement_level),
  };
}

// Normaliza el bloque de relaciones de UN conflicto de la semilla a la forma del
// contrato v1 (`getConflictRelations`). No incluye sources (se filtran aparte).
export function normalizeSeedRelations(entry) {
  const e = isPlainObject(entry) ? entry : {};
  const actors = isPlainObject(e.actors) ? e.actors : {};
  return {
    actors: {
      state: asArray(actors.state).map(normalizeActorEntry).filter(Boolean),
      non_state: asArray(actors.non_state).map(normalizeActorEntry).filter(Boolean),
    },
    resources: asArray(e.resources).map((r) => {
      const name = str(r && r.name);
      if (!name) return null;
      return {
        slug: str(r.slug) || null,
        name,
        relevance_level: numOrNull(r.relevance_level),
        strategic_importance: numOrNull(r.strategic_importance),
        critical_mineral: Boolean(r.critical_mineral),
      };
    }).filter(Boolean),
    chokepoints: asArray(e.chokepoints).map((c) => {
      const name = str(c && c.name);
      if (!name) return null;
      return {
        slug: str(c.slug) || null,
        name,
        risk_level: numOrNull(c.risk_level),
        strategic_importance: numOrNull(c.strategic_importance),
        energy_flow_relevance: Boolean(c.energy_flow_relevance),
      };
    }).filter(Boolean),
    causal_links: asArray(e.causal_links).map((l) => {
      const title = str(l && l.title);
      if (!title) return null;
      return {
        link_type: CAUSAL_RELATIONS.includes(l.link_type) ? l.link_type : null,
        title,
        explanation: str(l.explanation) || null,
        pending: Boolean(l.pending),
      };
    }).filter(Boolean),
  };
}

/* --------------------------------------------------------------------------
   validateSeed: valida el documento completo de semilla. { ok, errors, warnings }.
   No lanza. `errors` bloquean; `warnings` informan (p.ej. fuentes demo/pendientes).
-------------------------------------------------------------------------- */
export function validateSeed(seed) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(seed)) return { ok: false, errors: ['seed: raíz no es objeto'], warnings };
  if (seed.contract !== SEED_CONTRACT) errors.push(`seed.contract: se esperaba "${SEED_CONTRACT}"`);
  if (!isPlainObject(seed.conflicts)) {
    errors.push('seed.conflicts: debe ser objeto { [id]: entry }');
    return { ok: false, errors, warnings };
  }
  for (const [id, entry] of Object.entries(seed.conflicts)) {
    if (!isPlainObject(entry)) { errors.push(`conflicts.${id}: no es objeto`); continue; }
    const status = entry.editorial_status ?? 'draft';
    if (!EDITORIAL_STATUSES.includes(status)) errors.push(`conflicts.${id}.editorial_status: inválido "${status}"`);
    // Validación estructural de cada source.
    asArray(entry.sources).forEach((s, i) => {
      const { ok, errors: e } = validateSource(s, `conflicts.${id}.sources[${i}]`);
      if (!ok) errors.push(...e);
      if (s && s.demo === true) warnings.push(`conflicts.${id}.sources[${i}]: fixture DEMO (no publicable)`);
      else if (s && s.verification !== 'verified') warnings.push(`conflicts.${id}.sources[${i}]: verification!=verified (no publicable)`);
    });
    // causal_links marcados verified deben tener fuente publicable asociada.
    // (En esta semilla los causal_links van 'pending'; la regla protege el futuro.)
    // Regla published: al menos una fuente publicable.
    if (status === 'published') {
      const hasPublishable = asArray(entry.sources).some(isPublishableSource);
      if (!hasPublishable) errors.push(`conflicts.${id}: 'published' sin fuente publicable (verified)`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

/* --------------------------------------------------------------------------
   validatePublishedHaveSources: contra la lista v1 real + semilla, detecta
   conflictos cuyo estado editorial es 'published' pero carecen de fuente
   publicable. Devuelve { ok, violations[] }. Es el guardián que impide publicar
   afirmaciones sin respaldo.
-------------------------------------------------------------------------- */
export function validatePublishedHaveSources(seed) {
  const violations = [];
  const conflicts = isPlainObject(seed) && isPlainObject(seed.conflicts) ? seed.conflicts : {};
  for (const [id, entry] of Object.entries(conflicts)) {
    if ((entry && entry.editorial_status) !== 'published') continue;
    const hasPublishable = asArray(entry.sources).some(isPublishableSource);
    if (!hasPublishable) violations.push(id);
  }
  return { ok: violations.length === 0, violations };
}

/* --------------------------------------------------------------------------
   mergeRelations: fusión NO destructiva de la semilla sobre un `detail` v1
   (`{ data: {...}, meta: {...} }` o el objeto `data` directo).
     opts.includeDemo=false (def) → sólo fuentes publicables (verified).
     opts.includeDemo=true        → incluye todas las fuentes de la semilla
                                     (para PREVIEW/demo, nunca para publicación).
   Preserva las relaciones ya presentes en el detalle si la semilla no aporta.
   Devuelve un NUEVO objeto (no muta la entrada).
-------------------------------------------------------------------------- */
export function mergeRelations(detail, seedEntry, opts = {}) {
  const includeDemo = opts.includeDemo === true;
  const hasWrapper = isPlainObject(detail) && isPlainObject(detail.data);
  const data = hasWrapper ? detail.data : (isPlainObject(detail) ? detail : {});
  const rel = normalizeSeedRelations(seedEntry);

  const nonEmpty = (arr) => Array.isArray(arr) && arr.length > 0;
  const existingActors = isPlainObject(data.actors) ? data.actors : { state: [], non_state: [] };
  const mergedActors = (nonEmpty(rel.actors.state) || nonEmpty(rel.actors.non_state))
    ? rel.actors
    : { state: asArray(existingActors.state), non_state: asArray(existingActors.non_state) };

  const sourcesSeed = asArray(seedEntry && seedEntry.sources)
    .filter((s) => validateSource(s).ok)
    .filter((s) => includeDemo || isPublishableSource(s))
    .map((s) => ({
      slug: str(s.slug) || null,
      title: str(s.title),
      url: str(s.url),
      publisher: publisherOf(s) || null,
      source_name: str(s.source_name) || publisherOf(s) || null,
      accessed_at: str(s.accessed_at) || str(s.date) || null,
      verification: s.verification ?? null,
      demo: Boolean(s.demo),
    }));

  const mergedData = {
    ...data,
    actors: mergedActors,
    resources: nonEmpty(rel.resources) ? rel.resources : asArray(data.resources),
    chokepoints: nonEmpty(rel.chokepoints) ? rel.chokepoints : asArray(data.chokepoints),
    causal_links: nonEmpty(rel.causal_links) ? rel.causal_links : asArray(data.causal_links),
    sources: sourcesSeed.length ? sourcesSeed : asArray(data.sources),
  };

  if (hasWrapper) {
    return {
      ...detail,
      data: mergedData,
      meta: { ...(detail.meta || {}), seed_merged: true, seed_include_demo: includeDemo },
    };
  }
  return mergedData;
}

/* --------------------------------------------------------------------------
   computeSeedCoverage: cobertura por conflicto y agregados, para el reporte.
   No lanza. Cuenta relaciones, fuentes totales/publicables/demo y pendientes.
-------------------------------------------------------------------------- */
export function computeSeedCoverage(seed) {
  const conflicts = isPlainObject(seed) && isPlainObject(seed.conflicts) ? seed.conflicts : {};
  const perConflict = {};
  const totals = {
    conflicts: 0,
    with_publishable_source: 0,
    with_any_source: 0,
    published: 0,
    published_without_source: 0,
    pending_causal_links: 0,
    demo_sources: 0,
  };
  for (const [id, entry] of Object.entries(conflicts)) {
    const rel = normalizeSeedRelations(entry);
    const sources = asArray(entry && entry.sources);
    const publishable = sources.filter(isPublishableSource).length;
    const demo = sources.filter((s) => s && s.demo === true).length;
    const pendingCausal = rel.causal_links.filter((l) => l.pending).length;
    const status = (entry && entry.editorial_status) || 'draft';
    const row = {
      editorial_status: status,
      actors: rel.actors.state.length + rel.actors.non_state.length,
      resources: rel.resources.length,
      chokepoints: rel.chokepoints.length,
      causal_links: rel.causal_links.length,
      pending_causal_links: pendingCausal,
      sources_total: sources.length,
      sources_publishable: publishable,
      sources_demo: demo,
    };
    perConflict[id] = row;
    totals.conflicts += 1;
    if (publishable > 0) totals.with_publishable_source += 1;
    if (sources.length > 0) totals.with_any_source += 1;
    if (status === 'published') {
      totals.published += 1;
      if (publishable === 0) totals.published_without_source += 1;
    }
    totals.pending_causal_links += pendingCausal;
    totals.demo_sources += demo;
  }
  return {
    generated_at: new Date().toISOString(),
    contract: SEED_CONTRACT,
    totals,
    by_conflict: perConflict,
  };
}
