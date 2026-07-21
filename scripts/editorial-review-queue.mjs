// GEOPÓLEM (Sprint 18) — genera/verifica la cola de revisión editorial residual.
// ---------------------------------------------------------------------------
// Consolida los pendientes de revisión humana (fuentes needs_human_review y
// causal_links pending) desde las fuentes YA EXISTENTES del repo y produce un
// reporte accionable en data/editorial-review-queue.json. NO inventa datos.
//
// El `generated_at` del artefacto es DETERMINISTA (se toma de la cola de
// investigación source-research.todo.json), de modo que regenerar no produce
// diffs espurios: `--check` puede verificar que el artefacto está al día.
//
// MODOS:
//   (sin modo)   imprime el reporte en texto. NO escribe.
//   --json       imprime el reporte JSON. NO escribe.
//   --write      escribe data/editorial-review-queue.json (atómico).
//   --check      exit!=0 si el artefacto versionado NO coincide con lo generado.
// ---------------------------------------------------------------------------

import {
  readFileSync, writeFileSync, renameSync, mkdirSync, existsSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReviewQueue } from '../editorial-review.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const SEED_PATH = resolve(REPO_ROOT, 'data/conflict-relations.verified.seed.json');
const TODO_PATH = resolve(REPO_ROOT, 'data/source-research.todo.json');
const OUT_PATH = resolve(REPO_ROOT, 'data/editorial-review-queue.json');

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

function writeJsonAtomic(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
  renameSync(tmp, path);
}

function compute() {
  const seed = readJson(SEED_PATH);
  const todo = existsSync(TODO_PATH) ? readJson(TODO_PATH) : {};
  // generated_at determinista: hereda el de la cola de investigación (origen del
  // pendiente editorial) para evitar diffs por timestamp.
  const generatedAt = (todo && typeof todo.generated_at === 'string') ? todo.generated_at : null;
  return buildReviewQueue({ seed, todo, generatedAt });
}

function serialize(obj) { return `${JSON.stringify(obj, null, 2)}\n`; }

function formatText(q) {
  const L = [];
  L.push('GEOPÓLEM — Cola de revisión editorial residual (Sprint 18)');
  L.push('='.repeat(64));
  L.push(`Total pendientes:       ${q.summary.total}`);
  L.push(`  · fuentes a revisar:  ${q.summary.source_review}`);
  L.push(`  · causal_links pend.: ${q.summary.causal_link_pending}`);
  L.push(`Resolubles con el repo: ${q.summary.resolvable_in_repo}`);
  L.push(`Conflictos afectados:   ${q.summary.conflicts_affected.join(', ')}`);
  L.push('');
  for (const it of q.items) {
    if (it.type === 'source-review') {
      L.push(`✗ [source-review] ${it.conflict}/${it.source_slug} (${it.accessed_via || 'n/d'})`);
    } else {
      L.push(`✗ [causal-pending] ${it.conflict}: "${it.title}"`);
    }
    L.push(`    ${it.reason}`);
    L.push(`    → ${it.recommended_action}`);
  }
  return L.join('\n');
}

function main() {
  const args = new Set(process.argv.slice(2));
  const q = compute();

  if (args.has('--check')) {
    if (!existsSync(OUT_PATH)) {
      process.stderr.write('[editorial-review-queue] FALTA data/editorial-review-queue.json; ejecuta --write.\n');
      return 1;
    }
    const onDisk = readFileSync(OUT_PATH, 'utf8');
    if (onDisk !== serialize(q)) {
      process.stderr.write('[editorial-review-queue] DESACTUALIZADO: el artefacto no coincide con las fuentes; ejecuta --write.\n');
      return 1;
    }
    process.stdout.write(`[editorial-review-queue] OK: al día (${q.summary.total} pendiente/s).\n`);
    return 0;
  }

  if (args.has('--write')) {
    writeJsonAtomic(OUT_PATH, q);
    process.stderr.write(`[editorial-review-queue] escrito → ${OUT_PATH} (${q.summary.total} pendiente/s).\n`);
    return 0;
  }

  if (args.has('--json')) process.stdout.write(serialize(q));
  else process.stdout.write(`${formatText(q)}\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
