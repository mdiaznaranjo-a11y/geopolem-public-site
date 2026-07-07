// GEOPÓLEM — Exportador LMS portable (Sprint 26)
// ---------------------------------------------------------------------------
// Empaqueta los materiales docentes (formatos/cursos, banco de casos, rúbricas
// y fichas) en un formato PORTABLE e independiente de plataforma:
//   • lms.manifest.json — manifiesto máquina-legible (módulos, casos, rúbricas,
//     recursos) con rutas relativas al repo.
//   • lms-package.md    — paquete navegable en Markdown (índice + resúmenes).
//   • rubrics.csv       — export plano de criterios/niveles para importadores LMS.
//
// Determinista (sin timestamps en los ficheros escritos) para permitir --check.
// No empaqueta binarios: sólo referencias y texto. No activa producción.
//
// Uso:
//   node scripts/export-lms.mjs             (resumen; no escribe)
//   node scripts/export-lms.mjs --json       (manifiesto por stdout)
//   node scripts/export-lms.mjs --write      (escribe docs/education/lms-export/)
//   node scripts/export-lms.mjs --check      (exit!=0 si lo escrito difiere)
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const OUT_DIR = 'docs/education/lms-export';

export const LMS_MANIFEST_CONTRACT = 'sprint-26-lms-manifest-v1';

const EDU_MANIFEST = 'docs/education/education.manifest.json';
const S25_MANIFEST = 'docs/education/education.sprint25.manifest.json';
const CASE_BANK_INDEX = 'docs/education/case-bank/case-bank.index.json';
const RUBRICS_INDEX = 'docs/education/rubrics/rubrics.index.json';

const abs = (rel) => resolve(REPO_ROOT, rel);
const readJson = (rel) => JSON.parse(readFileSync(abs(rel), 'utf8'));

// --- Construcción del manifiesto LMS (PURA) ---------------------------------
export function buildLmsManifest({ repoRoot = REPO_ROOT } = {}) {
  const rj = (rel) => JSON.parse(readFileSync(resolve(repoRoot, rel), 'utf8'));
  const edu = existsSync(resolve(repoRoot, EDU_MANIFEST)) ? rj(EDU_MANIFEST) : { formats: [] };
  const caseBank = existsSync(resolve(repoRoot, CASE_BANK_INDEX)) ? rj(CASE_BANK_INDEX) : { cases: [] };
  const rubricsIdx = existsSync(resolve(repoRoot, RUBRICS_INDEX)) ? rj(RUBRICS_INDEX) : { rubrics: [] };

  const modules = (edu.formats || []).map((f) => ({ id: f.id, title: f.title || f.id, file: f.file }));

  const rubrics = (rubricsIdx.rubrics || []).map((r) => {
    const doc = existsSync(resolve(repoRoot, r.file)) ? rj(r.file) : {};
    return {
      id: r.id,
      dimension: r.dimension,
      file: r.file,
      title: doc.title || null,
      criteria: (doc.criteria || []).map((c) => c.id),
      levels: ((doc.scale && doc.scale.levels) || []).map((l) => l.id),
    };
  });

  const cases = (caseBank.cases || []).map((c) => ({
    id: c.id,
    title: c.title,
    conflict_type: c.conflict_type,
    region: c.region,
    fiche_md: c.fiche_md,
    fiche_json: c.fiche_json,
    matrix_json: c.matrix_json,
    causal_links: c.causal_links,
  }));

  return {
    contract: LMS_MANIFEST_CONTRACT,
    notice:
      'Paquete LMS portable GEOPÓLEM (Sprint 26). Formato independiente de plataforma: referencias + texto, sin binarios. Material de FORMACIÓN: no sustituye la revisión editorial ni activa producción.',
    production: { is_production: false, activates_production_gate: false, contains_secrets: false },
    source: { education_manifest: EDU_MANIFEST, sprint25_manifest: S25_MANIFEST, case_bank_index: CASE_BANK_INDEX, rubrics_index: RUBRICS_INDEX },
    totals: { modules: modules.length, cases: cases.length, rubrics: rubrics.length },
    modules,
    rubrics,
    cases,
  };
}

// --- Render Markdown del paquete --------------------------------------------
export function renderLmsMarkdown(man) {
  const L = [];
  L.push('# Paquete LMS GEOPÓLEM (Sprint 26)');
  L.push('');
  L.push('> Material de **formación**. No sustituye la revisión editorial final ni activa producción.');
  L.push('> Portable e independiente de plataforma: importa las referencias en tu LMS (Moodle, Canvas, etc.).');
  L.push('');
  L.push(`- Módulos/formatos: **${man.totals.modules}**`);
  L.push(`- Casos: **${man.totals.cases}**`);
  L.push(`- Rúbricas: **${man.totals.rubrics}**`);
  L.push('');
  L.push('## Módulos');
  L.push('');
  for (const m of man.modules) L.push(`- **${m.title}** — \`${m.file}\``);
  L.push('');
  L.push('## Casos');
  L.push('');
  if (man.cases.length) {
    L.push('| id | título | tipo | región | ficha | matriz | enlaces |');
    L.push('|---|---|---|---|---|---|---|');
    for (const c of man.cases) {
      L.push(`| \`${c.id}\` | ${c.title} | ${c.conflict_type} | ${c.region} | \`${c.fiche_md}\` | \`${c.matrix_json}\` | ${c.causal_links} |`);
    }
  } else {
    L.push('_(sin casos)_');
  }
  L.push('');
  L.push('## Rúbricas');
  L.push('');
  for (const r of man.rubrics) {
    L.push(`- **${r.title || r.id}** (\`${r.id}\`, dimensión: ${r.dimension}) — criterios: ${r.criteria.join(', ') || '—'}; niveles: ${r.levels.join(', ') || '—'}`);
  }
  L.push('');
  L.push('## Puntuación');
  L.push('');
  L.push('Usa `node scripts/score-rubric.mjs --rubric=<ruta> --evaluation=<ruta>` para calcular puntajes.');
  L.push('El export `rubrics.csv` de esta carpeta lista criterios, niveles y descriptores para importadores.');
  L.push('');
  return `${L.join('\n')}\n`;
}

// --- Render CSV de rúbricas (plano) -----------------------------------------
export function renderRubricsCsv(man, { repoRoot = REPO_ROOT } = {}) {
  const esc = (s) => {
    const v = String(s == null ? '' : s);
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const rows = [['rubric_id', 'criterion_id', 'criterion_title', 'weight', 'level_id', 'level_points', 'descriptor']];
  for (const r of man.rubrics) {
    const doc = existsSync(resolve(repoRoot, r.file)) ? JSON.parse(readFileSync(resolve(repoRoot, r.file), 'utf8')) : {};
    const levels = (doc.scale && doc.scale.levels) || [];
    for (const c of doc.criteria || []) {
      for (const lvl of levels) {
        rows.push([r.id, c.id, c.title, c.weight, lvl.id, lvl.points, (c.descriptors && c.descriptors[lvl.id]) || '']);
      }
    }
  }
  return `${rows.map((r) => r.map(esc).join(',')).join('\n')}\n`;
}

export function buildLmsPackage({ repoRoot = REPO_ROOT } = {}) {
  const manifest = buildLmsManifest({ repoRoot });
  return {
    manifest,
    markdown: renderLmsMarkdown(manifest),
    csv: renderRubricsCsv(manifest, { repoRoot }),
  };
}

// --- CLI --------------------------------------------------------------------
function writeAtomic(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, path);
}

function parseArgs(argv) {
  const flags = new Set();
  const opts = {};
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v === undefined) flags.add(k); else opts[k] = v;
    }
  }
  return { flags, opts };
}

function main() {
  const { flags, opts } = parseArgs(process.argv.slice(2));
  const outDir = opts.out || OUT_DIR;
  const pkg = buildLmsPackage();
  const files = {
    [`${outDir}/lms.manifest.json`]: `${JSON.stringify(pkg.manifest, null, 2)}\n`,
    [`${outDir}/lms-package.md`]: pkg.markdown,
    [`${outDir}/rubrics.csv`]: pkg.csv,
  };

  if (flags.has('json')) {
    process.stdout.write(`${JSON.stringify(pkg.manifest, null, 2)}\n`);
    return 0;
  }
  if (flags.has('check')) {
    const diffs = [];
    for (const [rel, content] of Object.entries(files)) {
      const p = abs(rel);
      if (!existsSync(p) || readFileSync(p, 'utf8') !== content) diffs.push(rel);
    }
    if (diffs.length) {
      process.stderr.write(`[lms] desactualizado: ${diffs.join(', ')}\n[lms] ejecuta: npm run education:lms:write\n`);
      return 1;
    }
    process.stdout.write('[lms] OK: paquete LMS al día.\n');
    return 0;
  }
  if (flags.has('write')) {
    for (const [rel, content] of Object.entries(files)) writeAtomic(abs(rel), content);
    process.stderr.write(`[lms] escrito paquete LMS en ${outDir} (${Object.keys(files).length} ficheros).\n`);
    return 0;
  }
  const t = pkg.manifest.totals;
  process.stdout.write(`Paquete LMS: ${t.modules} módulos · ${t.cases} casos · ${t.rubrics} rúbricas.\n`);
  process.stdout.write(`Usa --write para escribir en ${outDir}, --json para el manifiesto, --check para verificar.\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
