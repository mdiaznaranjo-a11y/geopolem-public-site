// GEOPÓLEM — Banco de casos con matrices causales pre-rellenas (Sprint 25)
// ---------------------------------------------------------------------------
// Genera un BANCO DE CASOS docente bajo docs/education/case-bank/ a partir de
// conflictos SEGUROS (con fuente verificada) del contrato v1. Para cada caso:
//   • Ficha docente (Markdown + JSON) vía export-education-fiches.mjs.
//   • Matriz causal pre-rellenada (JSON) derivada de `causal_links` reales;
//     los campos sin dato en el contrato (p. ej. nivel de confianza) se marcan
//     como `pending`. NO se fabrica topología ni evidencia.
//   • Un índice máquina-legible (case-bank.index.json) y un README navegable.
//
// "Caso seguro" = conflicto con al menos una fuente `verified` en el RC
// (`api/v1/conflicts.verified.enriched.json`); nunca se usan datos de demo ni
// se activa producción.
//
// Uso:
//   node scripts/build-case-bank.mjs            (imprime resumen; no escribe)
//   node scripts/build-case-bank.mjs --write    (escribe banco de casos)
//   node scripts/build-case-bank.mjs --json      (índice por stdout)
//   node scripts/build-case-bank.mjs --check     (exit!=0 si el índice difiere)
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportFiche, buildFiche, loadConflict } from './export-education-fiches.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const CASE_BANK_DIR = 'docs/education/case-bank';
const RC_SOURCE = 'api/v1/conflicts.verified.enriched.json';

export const CASE_BANK_CONTRACT = 'sprint-25-case-bank-v1';
export const CAUSAL_MATRIX_CONTRACT = 'sprint-25-causal-matrix-v1';

const args = new Set(process.argv.slice(2));
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// --- Selección de casos seguros (fuente verificada, no demo) ----------------
export function safeConflictIds({ repoRoot = REPO_ROOT } = {}) {
  const p = resolve(repoRoot, RC_SOURCE);
  if (!existsSync(p)) return [];
  const map = readJson(p).data || {};
  return Object.keys(map)
    .filter((id) => (map[id].sources || []).some((s) => s && s.verification === 'verified' && s.demo !== true))
    .sort();
}

// --- Matriz causal pre-rellenada (PURA respecto de la ficha) ----------------
// Deriva NODOS a partir de entidades reales (actores/recursos/chokepoints) y
// ENLACES a partir de `causal_links`. El "nivel de confianza" no existe en el
// contrato v1: se marca como pendiente para que lo complete el analista.
export function buildCausalMatrix(fiche) {
  const nodes = [];
  const seen = new Set();
  const addNode = (id, label, kind) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    nodes.push({ id, label: label || id, kind });
  };
  for (const a of fiche.actors.state) addNode(a.slug, a.name, 'actor_state');
  for (const a of fiche.actors.non_state) addNode(a.slug, a.name, 'actor_non_state');
  for (const r of fiche.resources) addNode(r.slug, r.name, 'resource');
  for (const c of fiche.chokepoints) addNode(c.slug, c.name, 'chokepoint');

  const links = fiche.causal_links.map((l, i) => ({
    id: `link-${i + 1}`,
    link_type: l.link_type || null,
    title: l.title || null,
    evidence: l.explanation || null,
    source_slugs: l.source_slugs,
    confidence: null, // no existe en el contrato v1 → pendiente de clasificación
    pending: Boolean(l.pending) || l.source_slugs.length === 0 || !l.link_type,
  }));

  const pending_fields = [];
  if (!nodes.length) pending_fields.push('nodes');
  if (!links.length) pending_fields.push('links');
  if (links.some((l) => l.confidence == null)) pending_fields.push('confidence');

  return {
    contract: CAUSAL_MATRIX_CONTRACT,
    conflict_id: fiche.conflict_id,
    data_stage: fiche.data_stage,
    source_file: fiche.source_file,
    notice:
      'Matriz causal pre-rellenada desde `causal_links` verificados (Sprint 25). Material docente: el nivel de confianza y los nodos/enlaces faltantes quedan `pending` para su completado analítico. No activa producción.',
    production: { is_production: false, activates_production_gate: false, contains_secrets: false },
    nodes,
    links,
    pending_fields,
  };
}

export function renderMatrixMarkdown(m) {
  const esc = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const L = [];
  L.push(`### Matriz causal — \`${m.conflict_id}\``);
  L.push('');
  L.push('**Nodos**');
  L.push('');
  if (m.nodes.length) {
    L.push('| id | etiqueta | tipo |');
    L.push('|---|---|---|');
    for (const n of m.nodes) L.push(`| \`${n.id}\` | ${esc(n.label)} | ${n.kind} |`);
  } else {
    L.push('_(pendiente / empty) — sin nodos derivables de actores/recursos/chokepoints._');
  }
  L.push('');
  L.push('**Enlaces causales**');
  L.push('');
  if (m.links.length) {
    L.push('| id | tipo (link_type) | título | evidencia | fuentes | confianza | pending |');
    L.push('|---|---|---|---|---|---|---|');
    for (const l of m.links) {
      L.push(`| ${l.id} | \`${l.link_type || ''}\` | ${esc(l.title)} | ${esc(l.evidence)} | ${l.source_slugs.map((s) => `\`${s}\``).join(', ') || '—'} | ${l.confidence == null ? '(pendiente)' : l.confidence} | ${l.pending} |`);
    }
  } else {
    L.push('_(pendiente / empty) — sin `causal_links` en la fuente._');
  }
  L.push('');
  return `${L.join('\n')}\n`;
}

// --- Construcción del banco completo (objetos en memoria) -------------------
export function buildCaseBank({ repoRoot = REPO_ROOT } = {}) {
  const ids = safeConflictIds({ repoRoot });
  const cases = ids.map((id) => {
    const { fiche, markdown } = exportFiche(id, 'rc', { repoRoot });
    const matrix = buildCausalMatrix(fiche);
    return { id, fiche, ficheMarkdown: markdown, matrix };
  });
  const index = {
    contract: CASE_BANK_CONTRACT,
    generated_at: new Date().toISOString(),
    notice:
      'Índice del banco de casos docente GEOPÓLEM (Sprint 25). Casos derivados de conflictos con fuente verificada (RC). Determinista y versionado. No sustituye la revisión editorial ni activa producción.',
    production: { is_production: false, activates_production_gate: false, contains_secrets: false },
    data_stage: 'rc',
    source_file: RC_SOURCE,
    totals: {
      cases: cases.length,
      with_causal_links: cases.filter((c) => c.matrix.links.length > 0).length,
      with_pending_fields: cases.filter((c) => c.fiche.pending_fields.length > 0).length,
    },
    cases: cases.map((c) => ({
      id: c.id,
      title: c.fiche.title,
      conflict_type: c.fiche.conflict_type ? c.fiche.conflict_type.slug : null,
      region: c.fiche.region ? c.fiche.region.slug : null,
      fiche_md: `${CASE_BANK_DIR}/fichas/${c.id}.rc.md`,
      fiche_json: `${CASE_BANK_DIR}/fichas/${c.id}.rc.json`,
      matrix_json: `${CASE_BANK_DIR}/matrices/${c.id}.matrix.json`,
      causal_links: c.matrix.links.length,
      pending_fields: c.fiche.pending_fields,
    })),
  };
  return { index, cases };
}

function renderReadme(index) {
  const L = [];
  L.push('# Banco de casos GEOPÓLEM (Sprint 25)');
  L.push('');
  L.push('> **Advertencia editorial.** Casos docentes derivados automáticamente del');
  L.push('> RC verificado (`' + RC_SOURCE + '`). **No sustituyen la revisión');
  L.push('> editorial final** ni activan producción. Los campos sin dato en el');
  L.push('> contrato v1 se marcan como pendientes; no se añaden hechos nuevos.');
  L.push('');
  L.push(`- **Casos:** ${index.totals.cases}`);
  L.push(`- **Con enlaces causales:** ${index.totals.with_causal_links}`);
  L.push(`- **Con campos pendientes:** ${index.totals.with_pending_fields}`);
  L.push('- **Fase de datos:** `rc` (verificado, no producción)');
  L.push('');
  L.push('## Casos');
  L.push('');
  L.push('| conflict_id | Título | Tipo | Región | Enlaces causales | Pendientes |');
  L.push('|---|---|---|---|---|---|');
  for (const c of index.cases) {
    L.push(`| [\`${c.id}\`](fichas/${c.id}.rc.md) | ${c.title || '(pendiente)'} | \`${c.conflict_type || 's/d'}\` | \`${c.region || 's/d'}\` | ${c.causal_links} | ${c.pending_fields.length ? c.pending_fields.join(', ') : '—'} |`);
  }
  L.push('');
  L.push('## Estructura');
  L.push('');
  L.push('- `fichas/<id>.rc.md` · `fichas/<id>.rc.json` — fichas docentes por conflicto.');
  L.push('- `matrices/<id>.matrix.json` — matrices causales pre-rellenadas.');
  L.push('- `case-bank.index.json` — índice máquina-legible.');
  L.push('');
  L.push('## Regeneración');
  L.push('');
  L.push('```bash');
  L.push('node scripts/export-education-fiches.mjs --all --stage=rc --write --out=docs/education/case-bank/fichas');
  L.push('node scripts/build-case-bank.mjs --write');
  L.push('```');
  L.push('');
  return `${L.join('\n')}\n`;
}

function writeAtomic(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, path);
}

function main() {
  const { index, cases } = buildCaseBank();

  if (args.has('--json')) process.stdout.write(`${JSON.stringify(index, null, 2)}\n`);

  if (args.has('--check')) {
    const idxPath = resolve(REPO_ROOT, CASE_BANK_DIR, 'case-bank.index.json');
    if (!existsSync(idxPath)) {
      process.stderr.write('[case-bank] --check: falta case-bank.index.json\n');
      return 2;
    }
    const norm = (o) => JSON.stringify({ ...o, generated_at: null });
    if (norm(readJson(idxPath)) !== norm(index)) {
      process.stderr.write('[case-bank] --check: índice desactualizado. Regenera con --write.\n');
      return 3;
    }
    process.stdout.write('[case-bank] --check: OK\n');
    return 0;
  }

  if (args.has('--write')) {
    for (const c of cases) {
      writeAtomic(resolve(REPO_ROOT, CASE_BANK_DIR, 'fichas', `${c.id}.rc.md`), c.ficheMarkdown);
      writeAtomic(resolve(REPO_ROOT, CASE_BANK_DIR, 'fichas', `${c.id}.rc.json`), `${JSON.stringify(c.fiche, null, 2)}\n`);
      writeAtomic(resolve(REPO_ROOT, CASE_BANK_DIR, 'matrices', `${c.id}.matrix.json`), `${JSON.stringify(c.matrix, null, 2)}\n`);
    }
    writeAtomic(resolve(REPO_ROOT, CASE_BANK_DIR, 'case-bank.index.json'), `${JSON.stringify(index, null, 2)}\n`);
    writeAtomic(resolve(REPO_ROOT, CASE_BANK_DIR, 'README.md'), renderReadme(index));
    process.stderr.write(`[case-bank] escrito banco con ${index.totals.cases} casos → ${CASE_BANK_DIR}\n`);
    return 0;
  }

  process.stdout.write(`[case-bank] ${index.totals.cases} casos seguros (${index.totals.with_causal_links} con enlaces causales). Usa --write para materializar.\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
