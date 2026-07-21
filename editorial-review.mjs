// GEOPÓLEM — Cola de revisión editorial residual (Sprint 18)
// ---------------------------------------------------------------------------
// Módulo PURO (sin disco/red) que consolida, a partir de las fuentes YA EXISTENTES
// del repo (semilla verificada + cola de investigación), los pendientes de
// revisión humana que quedan antes de cualquier promoción a producción:
//
//   1) Fuentes marcadas needs_human_review:true (acceso indirecto/web-search cuyo
//      fetch directo sigue bloqueado por el proxy → reconfirmar URL).
//   2) causal_links con pending:true (afirmación causal por confirmar con una
//      fuente específica que la respalde).
//
// REGLA DE ORO: no inventar datos. Este módulo NO resuelve nada por su cuenta;
// sólo enumera lo pendiente de forma accionable y marca si algo es verificable
// con las fuentes presentes en el repo (`resolvable_in_repo`). En la práctica,
// ambas categorías requieren acceso EXTERNO (reconfirmar URL / fuente causal), de
// modo que se mantienen `pending` de forma honesta hasta la revisión humana.
// ---------------------------------------------------------------------------

export const REVIEW_QUEUE_CONTRACT = 'sprint-18-editorial-review-queue-v1';

function asArray(v) { return Array.isArray(v) ? v : []; }
function isPlainObject(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }
function str(v) { return typeof v === 'string' ? v.trim() : ''; }

// Indexa la cola de investigación (source-research.todo.json) por id de conflicto
// para poder adjuntar el motivo/estado documentado a cada pendiente.
function indexTodo(todo) {
  const byNeedsReview = new Map(); // `${id}::${slug}` -> item
  const byPendingItem = new Map(); // id -> item (causal pendiente)
  if (!isPlainObject(todo)) return { byNeedsReview, byPendingItem };
  for (const nr of asArray(todo.needs_human_review)) {
    if (!isPlainObject(nr)) continue;
    byNeedsReview.set(`${str(nr.id)}::${str(nr.source_slug)}`, nr);
  }
  for (const it of asArray(todo.items)) {
    if (!isPlainObject(it)) continue;
    byPendingItem.set(str(it.id), it);
  }
  return { byNeedsReview, byPendingItem };
}

/* --------------------------------------------------------------------------
   buildReviewQueue: consolida los pendientes editoriales desde la semilla y la
   cola de investigación. Determinista: ordena por (conflict, type, key). No usa
   `Date.now()`; el `generated_at` lo fija el llamante (para artefactos no-diff).

   Devuelve { contract, generated_at, summary, items[] } donde cada item es:
     { type: 'source-review'|'causal-link-pending', conflict, ... , status,
       reason, recommended_action, resolvable_in_repo:boolean }
-------------------------------------------------------------------------- */
export function buildReviewQueue({ seed, todo, generatedAt = null } = {}) {
  const { byNeedsReview, byPendingItem } = indexTodo(todo);
  const conflicts = isPlainObject(seed) && isPlainObject(seed.conflicts) ? seed.conflicts : {};
  const items = [];

  for (const [id, entry] of Object.entries(conflicts)) {
    if (!isPlainObject(entry)) continue;

    // 1) Fuentes needs_human_review:true.
    for (const s of asArray(entry.sources)) {
      if (!isPlainObject(s) || s.needs_human_review !== true) continue;
      const slug = str(s.slug);
      const todoNr = byNeedsReview.get(`${id}::${slug}`);
      items.push({
        type: 'source-review',
        conflict: id,
        source_slug: slug,
        accessed_via: str(s.accessed_via) || null,
        url: str(s.url) || null,
        reason: str(s.review_reason) || (todoNr && str(todoNr.reason)) || 'needs_human_review',
        status: 'pending-human-review',
        recommended_action: 'Reconfirmar la URL con acceso directo (fetch) o sustituir por una fuente equivalente accesible; luego retirar needs_human_review.',
        // Requiere acceso externo (la URL falló por proxy): NO resoluble sólo con el repo.
        resolvable_in_repo: false,
      });
    }

    // 2) causal_links con pending:true.
    for (const cl of asArray(entry.causal_links)) {
      if (!isPlainObject(cl) || cl.pending !== true) continue;
      const title = str(cl.title);
      const todoItem = byPendingItem.get(id);
      items.push({
        type: 'causal-link-pending',
        conflict: id,
        title: title || null,
        status: 'pending-causal-confirmation',
        reason: (todoItem && str(todoItem.reason)) || 'afirmación causal por confirmar con fuente específica',
        recommended_action: 'Aportar una fuente que respalde específicamente el vínculo causal; luego marcar pending:false.',
        // Requiere una fuente causal externa específica: NO resoluble sólo con el repo.
        resolvable_in_repo: false,
      });
    }
  }

  // Orden determinista para salidas reproducibles (no-diff).
  items.sort((a, b) => {
    const ka = `${a.conflict}::${a.type}::${a.source_slug || a.title || ''}`;
    const kb = `${b.conflict}::${b.type}::${b.source_slug || b.title || ''}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  const sourceReview = items.filter((i) => i.type === 'source-review');
  const causalPending = items.filter((i) => i.type === 'causal-link-pending');
  return {
    contract: REVIEW_QUEUE_CONTRACT,
    generated_at: generatedAt,
    notice: 'Cola de revisión editorial residual (Sprint 18). Consolidada SIN inventar datos desde data/conflict-relations.verified.seed.json y data/source-research.todo.json. Todos los pendientes requieren acceso/verificación EXTERNA y sign-off humano antes de cualquier promoción a producción.',
    summary: {
      total: items.length,
      source_review: sourceReview.length,
      causal_link_pending: causalPending.length,
      resolvable_in_repo: items.filter((i) => i.resolvable_in_repo).length,
      blocking_production: items.length, // todos bloquean el sign-off a producción
      conflicts_affected: [...new Set(items.map((i) => i.conflict))].sort(),
    },
    items,
  };
}
