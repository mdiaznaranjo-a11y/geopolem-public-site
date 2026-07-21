// GEOPÓLEM — Salud de contenidos y KPIs editoriales (Sprint 12)
// ---------------------------------------------------------------------------
// Módulo PURO que evalúa la SALUD de los contenidos publicados a partir del
// contrato v1 (lista + detalles por conflicto), tal como los sirve el puente
// estático JSON o la API. No toca disco ni red: recibe los objetos ya cargados
// y devuelve un reporte serializable. Reutilizado por:
//   • scripts/content-health-report.mjs (CLI de reporte offline).
//   • tests (cálculo determinista de KPIs).
//
// KPIs cubiertos (post-lanzamiento):
//   • conflictos publicados totales y por región/tipo/severidad.
//   • contenidos SIN sources (riesgo editorial: afirmaciones sin respaldo).
//   • contenidos SIN relaciones enriquecidas (actores/recursos/chokepoints/
//     causal_links) → oportunidad de enriquecimiento.
//   • integridad: detalles ausentes/rotos respecto de la lista.
// ---------------------------------------------------------------------------

function asArray(v) { return Array.isArray(v) ? v : []; }

function labelOf(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'object') {
    if (typeof v.label === 'string' && v.label.trim()) return v.label.trim();
    if (typeof v.slug === 'string' && v.slug.trim()) return v.slug.trim();
  }
  return null;
}

// Extrae el nivel de intensidad/severidad admitiendo forma de lista o detalle.
function severityOf(item) {
  if (item == null || typeof item !== 'object') return null;
  if (Number.isFinite(item.intensity_level)) return item.intensity_level;
  if (item.metrics && Number.isFinite(item.metrics.intensity_level)) return item.metrics.intensity_level;
  if (Number.isFinite(item.severity)) return item.severity;
  return null;
}

// Cuenta relaciones enriquecidas de un detalle (0 si no hay ninguna).
export function countRelations(detail) {
  if (!detail || typeof detail !== 'object') {
    return { actors: 0, resources: 0, chokepoints: 0, causal_links: 0, total: 0 };
  }
  const actors = detail.actors && typeof detail.actors === 'object'
    ? asArray(detail.actors.state).length + asArray(detail.actors.non_state).length
    : asArray(detail.actors).length;
  const resources = asArray(detail.resources).length;
  const chokepoints = asArray(detail.chokepoints).length;
  const causal = asArray(detail.causal_links).length;
  return {
    actors,
    resources,
    chokepoints,
    causal_links: causal,
    total: actors + resources + chokepoints + causal,
  };
}

function bump(map, key) {
  if (key == null) return;
  map[key] = (map[key] || 0) + 1;
}

/* --------------------------------------------------------------------------
   computeContentHealth: (listItems, detailsById) → reporte de salud (PURA).
     listItems    → array de ConflictListItem (data de conflicts.json).
     detailsById  → objeto { [id]: detailData } (data de cada detalle). Opcional:
                    si falta un id, se cuenta como "detalle ausente".
-------------------------------------------------------------------------- */
export function computeContentHealth(listItems, detailsById = {}) {
  const items = asArray(listItems);
  const details = detailsById && typeof detailsById === 'object' ? detailsById : {};

  const byRegion = Object.create(null);
  const byType = Object.create(null);
  const bySeverity = Object.create(null);
  const byStatus = Object.create(null);

  const withoutSources = [];
  const withoutRelations = [];
  const missingDetails = [];
  // Desglose por conflicto (Sprint 13): nº de sources y relaciones por id, para
  // el reporte editorial/técnico de cobertura. Aditivo (no rompe consumidores).
  const byConflict = Object.create(null);

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const id = item.id || item.slug;
    bump(byRegion, labelOf(item.primary_region) || 'sin_region');
    bump(byType, labelOf(item.conflict_type) || 'sin_tipo');
    bump(byStatus, (typeof item.status === 'string' && item.status) || 'sin_estado');
    const sev = severityOf(item);
    bump(bySeverity, sev == null ? 'sin_severidad' : String(sev));

    const detail = id != null ? details[id] : undefined;
    if (id != null && detail === undefined) {
      missingDetails.push(id);
      // Sin detalle no podemos afirmar sources/relaciones: se cuentan como carencias.
      withoutSources.push(id);
      withoutRelations.push(id);
      if (id != null) {
        byConflict[id] = {
          detail_present: false, sources: 0,
          actors: 0, resources: 0, chokepoints: 0, causal_links: 0, relations_total: 0,
        };
      }
      continue;
    }
    const src = asArray(detail && detail.sources);
    if (src.length === 0) withoutSources.push(id);
    const rel = countRelations(detail);
    if (rel.total === 0) withoutRelations.push(id);
    if (id != null) {
      byConflict[id] = {
        detail_present: true,
        sources: src.length,
        actors: rel.actors,
        resources: rel.resources,
        chokepoints: rel.chokepoints,
        causal_links: rel.causal_links,
        relations_total: rel.total,
      };
    }
  }

  const total = items.length;
  const pct = (n) => (total > 0 ? Number(((n / total) * 100).toFixed(1)) : 0);

  return {
    generated_at: new Date().toISOString(),
    totals: {
      conflicts: total,
      details_available: Object.keys(details).length,
      missing_details: missingDetails.length,
    },
    distribution: {
      by_region: { ...byRegion },
      by_type: { ...byType },
      by_severity: { ...bySeverity },
      by_status: { ...byStatus },
    },
    content_gaps: {
      without_sources: withoutSources,
      without_sources_count: withoutSources.length,
      without_sources_pct: pct(withoutSources.length),
      without_relations: withoutRelations,
      without_relations_count: withoutRelations.length,
      without_relations_pct: pct(withoutRelations.length),
      missing_details: missingDetails,
    },
    by_conflict: { ...byConflict },
  };
}

// Formatea el reporte a texto legible para consola/CI (sin dependencias).
export function formatContentHealth(report) {
  const L = [];
  const r = report || {};
  const t = r.totals || {};
  const g = r.content_gaps || {};
  const d = r.distribution || {};
  L.push('GEOPÓLEM — Reporte de salud de contenidos (Sprint 12)');
  L.push('='.repeat(60));
  L.push(`Generado: ${r.generated_at || '-'}`);
  L.push('');
  L.push(`Conflictos totales:        ${t.conflicts ?? 0}`);
  L.push(`Detalles disponibles:      ${t.details_available ?? 0}`);
  L.push(`Detalles ausentes:         ${t.missing_details ?? 0}`);
  L.push('');
  L.push(`Sin fuentes (sources):     ${g.without_sources_count ?? 0} (${g.without_sources_pct ?? 0}%)`);
  L.push(`Sin relaciones:            ${g.without_relations_count ?? 0} (${g.without_relations_pct ?? 0}%)`);
  L.push('');
  const table = (title, obj) => {
    L.push(`${title}:`);
    const entries = Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);
    if (!entries.length) { L.push('  (sin datos)'); return; }
    for (const [k, v] of entries) L.push(`  ${String(k).padEnd(22)} ${v}`);
  };
  table('Por región', d.by_region);
  L.push('');
  table('Por tipo', d.by_type);
  L.push('');
  table('Por severidad', d.by_severity);
  L.push('');
  table('Por estado', d.by_status);
  if (Array.isArray(g.without_sources) && g.without_sources.length) {
    L.push('');
    L.push(`IDs sin fuentes: ${g.without_sources.join(', ')}`);
  }
  return L.join('\n');
}
