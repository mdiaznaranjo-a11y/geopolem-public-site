// GEOPÓLEM (Sprint 8) — normalizador del detalle enriquecido (módulo PURO).
// ---------------------------------------------------------------------------
// El detalle de conflicto del contrato v1 (Sprint 6/7) SIEMPRE trae las
// relaciones como arrays presentes (vacíos en fallback estático, poblados con
// DB): actors {state, non_state}, resources, chokepoints, causal_links, sources.
//
// Este módulo convierte ese detalle (o el eco "prepared" del admin) en un
// VIEW-MODEL estable y seguro para renderizar, SIN romper nada:
//   • Tolera ausencias: cualquier relación faltante → [] / defaults.
//   • No inventa datos: si no hay relaciones, las secciones quedan vacías y el
//     consumidor decide si ocultarlas.
//   • No toca el DOM: es lógica pura, testeable en Node. Un renderer de UI
//     (público o admin) consume `toEnrichedViewModel()` y decide la
//     presentación. Así preparamos el frontend público para el detalle
//     enriquecido de forma ADITIVA y reversible, sin editar app.js.
// ---------------------------------------------------------------------------

function asArray(v) { return Array.isArray(v) ? v : []; }

function nameOf(entry) {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object' && typeof entry.name === 'string') return entry.name;
  return null;
}

function namedList(list) {
  return asArray(list).map(nameOf).filter((n) => typeof n === 'string' && n.trim() !== '');
}

// Normaliza actors admitiendo tanto { state, non_state } como un array plano.
function normalizeActors(actors) {
  if (Array.isArray(actors)) return { state: namedList(actors), non_state: [] };
  if (actors && typeof actors === 'object') {
    return { state: namedList(actors.state), non_state: namedList(actors.non_state) };
  }
  return { state: [], non_state: [] };
}

function normalizeSources(sources) {
  return asArray(sources)
    .map((s) => {
      if (!s || typeof s !== 'object') return null;
      const title = typeof s.title === 'string' ? s.title.trim() : '';
      const url = typeof s.url === 'string' ? s.url.trim() : '';
      if (!title && !url) return null;
      return { title: title || url, url: url || null };
    })
    .filter(Boolean);
}

function normalizeCausalLinks(links) {
  return asArray(links)
    .map((l) => {
      if (!l || typeof l !== 'object') return null;
      const from = typeof l.from === 'string' ? l.from.trim() : '';
      const to = typeof l.to === 'string' ? l.to.trim() : '';
      if (!from || !to) return null;
      return { from, to, relation: typeof l.relation === 'string' ? l.relation : null };
    })
    .filter(Boolean);
}

// Detalle → view-model enriquecido estable. Nunca lanza.
export function toEnrichedViewModel(detail) {
  const d = detail && typeof detail === 'object' ? detail : {};
  const actors = normalizeActors(d.actors);
  const resources = namedList(d.resources);
  const chokepoints = namedList(d.chokepoints);
  const causalLinks = normalizeCausalLinks(d.causal_links);
  const sources = normalizeSources(d.sources);

  return {
    id: d.id ?? null,
    slug: d.slug ?? null,
    name: d.name ?? d.title ?? null,
    summary: d.summary ?? '',
    actors,
    resources,
    chokepoints,
    causalLinks,
    sources,
    // Flags para que un renderer decida mostrar/ocultar secciones sin recalcular.
    has: {
      actors: actors.state.length > 0 || actors.non_state.length > 0,
      resources: resources.length > 0,
      chokepoints: chokepoints.length > 0,
      causalLinks: causalLinks.length > 0,
      sources: sources.length > 0,
    },
  };
}

// ¿El view-model tiene alguna relación enriquecida? Útil para decidir si se
// muestra el bloque "Detalle enriquecido" en la UI pública.
export function hasAnyEnrichment(viewModel) {
  const h = viewModel?.has;
  return Boolean(h && (h.actors || h.resources || h.chokepoints || h.causalLinks || h.sources));
}
