// GEOPÓLEM — Exportador de fichas docentes desde el contrato v1 (Sprint 25)
// ---------------------------------------------------------------------------
// Genera FICHAS DOCENTES (Markdown + JSON) a partir del detalle de conflicto
// del contrato v1, siguiendo la arquitectura del proyecto:
//     API real v1  →  JSON estático  →  fallback local
// Aquí trabajamos SIEMPRE contra los artefactos JSON versionados (offline):
//   • canonical → api/v1/conflicts/<id>.json          (detalle canónico v1)
//   • staging   → api/v1/staging/conflicts/<id>.json  (preview de staging)
//   • rc        → api/v1/conflicts.verified.enriched.json (RC verificado)
//
// Reglas de oro (idénticas al resto del pipeline educativo):
//   • NO inventa datos. Si un campo falta o está vacío, se marca como
//     `pending`/`empty` y se lista en `pending_fields`; nunca se fabrica hecho.
//   • Determinista y versionado: misma entrada ⇒ misma salida (salvo el sello
//     `generated_at`, ignorado por `--check`).
//   • Materiales de FORMACIÓN: no activan producción ni contienen secretos.
//   • Las actividades/preguntas son ANDAMIAJE pedagógico que referencia campos
//     y valores REALES de la ficha; no añaden afirmaciones sobre el conflicto.
//
// Uso:
//   node scripts/export-education-fiches.mjs --id=red-sea            (md+json a stdout resumen)
//   node scripts/export-education-fiches.mjs --id=red-sea --stage=rc --format=md
//   node scripts/export-education-fiches.mjs --all --stage=rc --out=docs/education/case-bank
//   node scripts/export-education-fiches.mjs --all --stage=rc --write   (escribe ficheros)
//   node scripts/export-education-fiches.mjs --id=red-sea --json        (ficha JSON por stdout)
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

export const FICHE_CONTRACT = 'sprint-25-education-fiche-v1';

export const STAGES = ['canonical', 'staging', 'rc'];

const PENDING = '(pendiente / empty)';

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// --- Localización de la fuente de datos por stage --------------------------
export function stagePaths(stage) {
  switch (stage) {
    case 'canonical':
      return { kind: 'per-file', dir: 'api/v1/conflicts' };
    case 'staging':
      return { kind: 'per-file', dir: 'api/v1/staging/conflicts' };
    case 'rc':
      return { kind: 'map', file: 'api/v1/conflicts.verified.enriched.json' };
    default:
      throw new Error(`stage desconocido: ${stage}`);
  }
}

// Extrae el objeto de conflicto "plano" (sin envoltorio {data,meta}) para un id.
export function loadConflict(id, stage, { repoRoot = REPO_ROOT } = {}) {
  const paths = stagePaths(stage);
  if (paths.kind === 'per-file') {
    const p = resolve(repoRoot, paths.dir, `${id}.json`);
    if (!existsSync(p)) return { conflict: null, source_file: `${paths.dir}/${id}.json` };
    const raw = readJson(p);
    return { conflict: raw && raw.data ? raw.data : raw, source_file: `${paths.dir}/${id}.json` };
  }
  const p = resolve(repoRoot, paths.file);
  if (!existsSync(p)) return { conflict: null, source_file: paths.file };
  const raw = readJson(p);
  const map = raw && raw.data ? raw.data : {};
  return { conflict: map[id] || null, source_file: paths.file };
}

// --- Helpers de normalización (NO inventan; sólo proyectan) -----------------
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const nonEmptyArr = (v) => (Array.isArray(v) ? v : []);

function labelPair(v) {
  if (!v || typeof v !== 'object') return null;
  const slug = str(v.slug) || null;
  const label = str(v.label) || null;
  if (!slug && !label) return null;
  return { slug, label };
}

function normActors(actors) {
  const one = (a) => ({
    slug: str(a.slug) || null,
    name: str(a.name) || null,
    role: str(a.role) || null,
    alignment: a.alignment ?? null,
    involvement_level: a.involvement_level ?? null,
  });
  return {
    state: nonEmptyArr(actors && actors.state).map(one),
    non_state: nonEmptyArr(actors && actors.non_state).map(one),
  };
}

function normResources(res) {
  return nonEmptyArr(res).map((r) => ({
    slug: str(r.slug) || null,
    name: str(r.name) || null,
    relevance_level: r.relevance_level ?? null,
    strategic_importance: r.strategic_importance ?? null,
    critical_mineral: Boolean(r.critical_mineral),
  }));
}

function normChokepoints(cps) {
  return nonEmptyArr(cps).map((c) => ({
    slug: str(c.slug) || null,
    name: str(c.name) || null,
    risk_level: c.risk_level ?? null,
    strategic_importance: c.strategic_importance ?? null,
    energy_flow_relevance: Boolean(c.energy_flow_relevance),
  }));
}

function normCausalLinks(links) {
  return nonEmptyArr(links).map((l) => ({
    link_type: str(l.link_type) || null,
    title: str(l.title) || null,
    explanation: str(l.explanation) || null,
    pending: Boolean(l.pending),
    source_slugs: nonEmptyArr(l.source_slugs).map(String),
  }));
}

function normSources(sources) {
  return nonEmptyArr(sources).map((s) => ({
    slug: str(s.slug) || null,
    title: str(s.title) || null,
    url: str(s.url) || null,
    publisher: str(s.publisher) || null,
    source_name: str(s.source_name) || null,
    accessed_at: str(s.accessed_at) || null,
    verification: str(s.verification) || null,
  }));
}

// --- Andamiaje pedagógico: preguntas y actividades derivadas de campos ------
// Sólo referencian campos/valores REALES presentes en la ficha. Cuando un
// campo está vacío, la pregunta se convierte en una consigna de método (cómo
// obtener/verificar ese dato), sin afirmar nada sobre el conflicto.
function buildTeachingQuestions(f) {
  const q = [];
  if (f.causal_links.length) {
    const first = f.causal_links[0];
    q.push(
      `Justifica el tipo de enlace causal \`${first.link_type || 's/d'}\` del vínculo «${first.title || 's/d'}» a partir de su explicación y de la(s) fuente(s) ${first.source_slugs.map((s) => `\`${s}\``).join(', ') || '(sin fuente asociada)'}.`
    );
  } else {
    q.push('No hay `causal_links` registrados: propón una hipótesis causal y describe qué evidencia verificable la confirmaría o refutaría.');
  }
  if (Number.isFinite(f.intensity_level)) {
    q.push(`El foco declara \`intensity_level = ${f.intensity_level}\`: ¿qué factores del caso sostienen esa valoración y cuáles podrían revisarla?`);
  } else {
    q.push('El campo `intensity_level` está vacío: define los criterios que usarías para asignarlo de forma trazable.');
  }
  if (f.resources.length || f.chokepoints.length) {
    q.push('Relaciona cada recurso y/o chokepoint listado con un canal de impacto global concreto (energético, alimentario, comercial o financiero).');
  } else {
    q.push('No constan `resources` ni `chokepoints`: identifica cuáles serían relevantes y cómo los documentarías con fuentes verificables.');
  }
  if (f.sources.length) {
    q.push(`Aplica la checklist de fuentes a ${f.sources.map((s) => `\`${s.slug}\``).join(', ')}: ¿son primarias?, ¿cómo las triangularías?`);
  } else {
    q.push('La ficha no cita fuentes verificadas: describe el proceso de búsqueda y verificación que aplicarías antes de publicar.');
  }
  return q;
}

function buildActivities(f) {
  const a = [];
  a.push(`Completar la **matriz de causalidad** del caso \`${f.conflict_id}\` a partir de los enlaces registrados y marcar explícitamente los nodos/enlaces pendientes.`);
  a.push(`Localizar el foco \`${f.conflict_id}\` en el **laboratorio de mapa offline** usando el deep-link \`#foco=${f.conflict_id}\` y contrastar sus filtros (región, tipo, severidad) con otros focos del inventario.`);
  a.push('Rellenar la **checklist de fuentes** para cada fuente citada y proponer, en su caso, fuentes adicionales que cubran los campos pendientes.');
  return a;
}

// --- Construcción de la ficha (PURA respecto de la entrada) ------------------
export function buildFiche(conflict, { id, stage, source_file } = {}) {
  const c = conflict || {};
  const fiche = {
    contract: FICHE_CONTRACT,
    generated_at: new Date().toISOString(),
    conflict_id: id || str(c.id) || null,
    data_stage: stage || null,
    source_file: source_file || null,
    notice:
      'Ficha docente derivada del contrato v1 GEOPÓLEM (Sprint 25). Material de FORMACIÓN: no sustituye la revisión editorial final ni activa producción. No añade hechos: los campos ausentes se marcan como pendientes.',
    production: { is_production: false, activates_production_gate: false, contains_secrets: false },
    title: str(c.name) || null,
    summary: str(c.summary) || null,
    conflict_type: labelPair(c.conflict_type),
    region: labelPair(c.primary_region),
    status: str(c.status) || null,
    intensity_level: Number.isFinite(c && c.metrics && c.metrics.intensity_level)
      ? c.metrics.intensity_level
      : null,
    energy_dimension: Boolean(c && c.dimensions && c.dimensions.energy),
    actors: normActors(c.actors),
    resources: normResources(c.resources),
    chokepoints: normChokepoints(c.chokepoints),
    causal_links: normCausalLinks(c.causal_links),
    sources: normSources(c.sources),
    activities: [],
    teaching_questions: [],
    pending_fields: [],
  };

  // Campos pendientes (sin dato en la fuente elegida).
  if (!fiche.title) fiche.pending_fields.push('title');
  if (!fiche.region) fiche.pending_fields.push('region');
  if (!fiche.actors.state.length && !fiche.actors.non_state.length) fiche.pending_fields.push('actors');
  if (!fiche.resources.length) fiche.pending_fields.push('resources');
  if (!fiche.chokepoints.length) fiche.pending_fields.push('chokepoints');
  if (!fiche.causal_links.length) fiche.pending_fields.push('causal_links');
  if (!fiche.sources.length) fiche.pending_fields.push('sources');

  fiche.teaching_questions = buildTeachingQuestions(fiche);
  fiche.activities = buildActivities(fiche);
  return fiche;
}

// --- Render Markdown de la ficha -------------------------------------------
const mdEsc = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function renderFicheMarkdown(f) {
  const L = [];
  L.push(`# Ficha docente: ${f.title || PENDING}`);
  L.push('');
  L.push('> **Advertencia editorial.** Ficha generada automáticamente desde el');
  L.push('> contrato v1 GEOPÓLEM para uso docente (RC/staging). **No sustituye la');
  L.push('> revisión editorial final** ni implica publicación/aprobación. La');
  L.push('> producción permanece bloqueada por política. No se añaden hechos: los');
  L.push('> campos ausentes se marcan como pendientes.');
  L.push('');
  L.push('## Identificación');
  L.push('');
  L.push(`- **conflict_id:** \`${f.conflict_id || PENDING}\``);
  L.push(`- **title (name):** ${f.title || PENDING}`);
  L.push(`- **conflict_type:** ${f.conflict_type ? `\`${f.conflict_type.slug}\` — ${f.conflict_type.label}` : PENDING}`);
  L.push(`- **region (primary_region):** ${f.region ? `\`${f.region.slug}\` — ${f.region.label}` : PENDING}`);
  L.push(`- **status:** ${f.status ? `\`${f.status}\`` : PENDING}`);
  L.push(`- **intensity_level:** ${Number.isFinite(f.intensity_level) ? f.intensity_level : PENDING}`);
  L.push(`- **energy_dimension:** ${f.energy_dimension}`);
  L.push(`- **Fase de datos (data_stage):** \`${f.data_stage}\` (\`${f.source_file}\`)`);
  L.push('');
  if (f.summary) {
    L.push('## Resumen');
    L.push('');
    L.push(f.summary);
    L.push('');
  }
  // Actores
  L.push('## Actores');
  L.push('');
  const st = f.actors.state, ns = f.actors.non_state;
  if (st.length || ns.length) {
    L.push('| Ámbito | Slug | Nombre | Rol |');
    L.push('|---|---|---|---|');
    for (const a of st) L.push(`| estatal | \`${a.slug || ''}\` | ${mdEsc(a.name)} | ${mdEsc(a.role) || '—'} |`);
    for (const a of ns) L.push(`| no estatal | \`${a.slug || ''}\` | ${mdEsc(a.name)} | ${mdEsc(a.role) || '—'} |`);
  } else {
    L.push(`_${PENDING} — sin actores registrados en \`actors.state\`/\`actors.non_state\`._`);
  }
  L.push('');
  // Recursos
  L.push('## Recursos');
  L.push('');
  if (f.resources.length) {
    L.push('| Slug | Nombre | Mineral crítico |');
    L.push('|---|---|---|');
    for (const r of f.resources) L.push(`| \`${r.slug || ''}\` | ${mdEsc(r.name)} | ${r.critical_mineral} |`);
  } else {
    L.push(`_${PENDING} — sin \`resources\`._`);
  }
  L.push('');
  // Chokepoints
  L.push('## Chokepoints');
  L.push('');
  if (f.chokepoints.length) {
    L.push('| Slug | Nombre | Relevancia flujo energético |');
    L.push('|---|---|---|');
    for (const c of f.chokepoints) L.push(`| \`${c.slug || ''}\` | ${mdEsc(c.name)} | ${c.energy_flow_relevance} |`);
  } else {
    L.push(`_${PENDING} — sin \`chokepoints\`._`);
  }
  L.push('');
  // Cadena causal
  L.push('## Cadena causal (causal_links)');
  L.push('');
  if (f.causal_links.length) {
    L.push('| Enlace (link_type) | Título | Explicación | Fuentes (source_slugs) | pending |');
    L.push('|---|---|---|---|---|');
    for (const l of f.causal_links) {
      L.push(`| \`${l.link_type || ''}\` | ${mdEsc(l.title)} | ${mdEsc(l.explanation)} | ${l.source_slugs.map((s) => `\`${s}\``).join(', ') || '—'} | ${l.pending} |`);
    }
  } else {
    L.push(`_${PENDING} — sin \`causal_links\`._`);
  }
  L.push('');
  // Fuentes
  L.push('## Fuentes');
  L.push('');
  if (f.sources.length) {
    L.push('| Slug | Título | Editor | URL | accessed_at | verification |');
    L.push('|---|---|---|---|---|---|');
    for (const s of f.sources) {
      L.push(`| \`${s.slug || ''}\` | ${mdEsc(s.title)} | ${mdEsc(s.publisher)} | ${s.url || '—'} | ${s.accessed_at || '—'} | ${s.verification || '—'} |`);
    }
  } else {
    L.push(`_${PENDING} — sin \`sources\` verificadas._`);
  }
  L.push('');
  // Actividades
  L.push('## Actividades docentes');
  L.push('');
  f.activities.forEach((a, i) => L.push(`${i + 1}. ${a}`));
  L.push('');
  // Preguntas
  L.push('## Preguntas docentes');
  L.push('');
  f.teaching_questions.forEach((q, i) => L.push(`${i + 1}. ${q}`));
  L.push('');
  // Campos pendientes
  L.push('## Campos pendientes');
  L.push('');
  if (f.pending_fields.length) {
    for (const p of f.pending_fields) L.push(`- \`${p}\` — ${PENDING}`);
  } else {
    L.push('- Ninguno: todos los campos del contrato v1 están presentes en esta fase.');
  }
  L.push('');
  return `${L.join('\n')}\n`;
}

// --- Exportación de una ficha (objeto + markdown) ---------------------------
export function exportFiche(id, stage, { repoRoot = REPO_ROOT } = {}) {
  const { conflict, source_file } = loadConflict(id, stage, { repoRoot });
  const fiche = buildFiche(conflict, { id, stage, source_file });
  return { fiche, markdown: renderFicheMarkdown(fiche), found: conflict != null };
}

// --- CLI --------------------------------------------------------------------
function parseArgs(argv) {
  const out = { flags: new Set(), opts: {} };
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v === undefined) out.flags.add(k);
      else out.opts[k] = v;
    }
  }
  return out;
}

function allConflictIds(repoRoot) {
  const invPath = resolve(repoRoot, 'data/conflicts.inventory.json');
  if (existsSync(invPath)) return readJson(invPath).conflicts.map((c) => c.id);
  const listPath = resolve(repoRoot, 'api/v1/conflicts.json');
  if (existsSync(listPath)) return (readJson(listPath).data || []).map((c) => c.id || c.slug);
  return [];
}

function writeAtomic(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, path);
}

function main() {
  const { flags, opts } = parseArgs(process.argv.slice(2));
  const stage = opts.stage || 'canonical';
  if (!STAGES.includes(stage)) {
    process.stderr.write(`[export] stage inválido: ${stage} (usa: ${STAGES.join(', ')})\n`);
    return 2;
  }
  const format = opts.format || 'both';
  const outDir = opts.out || 'docs/education/case-bank/fichas';
  const ids = flags.has('all') ? allConflictIds(REPO_ROOT) : (opts.id ? [opts.id] : []);
  if (!ids.length) {
    process.stderr.write('[export] indica --id=<conflict_id> o --all\n');
    return 2;
  }

  const summaries = [];
  for (const id of ids) {
    const { fiche, markdown, found } = exportFiche(id, stage);
    if (!found) process.stderr.write(`[export] aviso: sin datos para ${id} en stage ${stage} (ficha marcada como pendiente)\n`);
    summaries.push({ id, stage, pending_fields: fiche.pending_fields, found });

    if (flags.has('json')) {
      process.stdout.write(`${JSON.stringify(fiche, null, 2)}\n`);
    }
    if (flags.has('write')) {
      if (format === 'md' || format === 'both') {
        writeAtomic(resolve(REPO_ROOT, outDir, `${id}.${stage}.md`), markdown);
      }
      if (format === 'json' || format === 'both') {
        writeAtomic(resolve(REPO_ROOT, outDir, `${id}.${stage}.json`), `${JSON.stringify(fiche, null, 2)}\n`);
      }
    } else if (!flags.has('json')) {
      if (format === 'md') process.stdout.write(markdown);
      else if (format === 'json') process.stdout.write(`${JSON.stringify(fiche, null, 2)}\n`);
    }
  }

  if (flags.has('write')) {
    process.stderr.write(`[export] escritas ${summaries.length} fichas (stage=${stage}, format=${format}) → ${outDir}\n`);
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
