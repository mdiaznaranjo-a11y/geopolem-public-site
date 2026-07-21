// GEOPÓLEM (Sprint 20) — construye/verifica los paquetes de evidencia editorial.
// ---------------------------------------------------------------------------
// Lee la cola RC clasificada (data/editorial-review-queue.rc.json) y los detalles
// de staging de cada conflicto, y genera para cada pendiente un paquete de
// evidencia REVISABLE POR HUMANO: JSON manifiesto (editorial-review/manifest.json)
// + un Markdown por item (editorial-review/evidence/*.md). Derivado SÓLO de lo
// existente en el repo (sin inventar datos). `generated_at` se HEREDA de la cola
// RC para que regenerar no produzca diffs espurios.
//
// MODOS:
//   (sin modo)   imprime el manifiesto JSON. NO escribe.
//   --json       igual (JSON explícito). NO escribe.
//   --write      escribe manifest.json + evidence/*.md (atómico).
//   --check      exit!=0 si el manifiesto o algún .md versionado NO coinciden.
// ---------------------------------------------------------------------------

import {
  readFileSync, writeFileSync, renameSync, mkdirSync, existsSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildEvidenceManifest, renderEvidenceMarkdown, validateEvidenceManifest,
} from '../editorial-governance.mjs';
import { stagingDetailPath } from '../staging-consume.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const RC_PATH = resolve(REPO_ROOT, 'data/editorial-review-queue.rc.json');
const OUT_DIR = resolve(REPO_ROOT, 'editorial-review');
const MANIFEST_PATH = resolve(OUT_DIR, 'manifest.json');

const abs = (rel) => resolve(REPO_ROOT, rel);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

function loadConflictDetails(rc) {
  const details = {};
  for (const it of rc.items || []) {
    const id = it.conflict;
    if (!id || details[id]) continue;
    const rel = stagingDetailPath(id);
    if (existsSync(abs(rel))) details[id] = readJson(abs(rel));
  }
  return details;
}

function compute() {
  const rc = readJson(RC_PATH);
  const conflictDetails = loadConflictDetails(rc);
  const generatedAt = typeof rc.generated_at === 'string' ? rc.generated_at : null;
  return buildEvidenceManifest({ rc, conflictDetails, generatedAt });
}

function serialize(obj) { return `${JSON.stringify(obj, null, 2)}\n`; }

function writeAtomic(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, path);
}

// Contenido esperado de cada .md (por clave de item) para comparar en --check.
function markdownFiles(manifest) {
  return manifest.items.map((it) => ({
    path: resolve(OUT_DIR, it.evidence_file),
    content: renderEvidenceMarkdown(it),
  }));
}

function main() {
  const args = new Set(process.argv.slice(2));
  if (!existsSync(RC_PATH)) {
    process.stderr.write('[build-evidence] FALTA data/editorial-review-queue.rc.json; ejecuta review:rc:write.\n');
    return 1;
  }
  const manifest = compute();

  if (args.has('--check')) {
    if (!existsSync(MANIFEST_PATH)) {
      process.stderr.write('[build-evidence] FALTA editorial-review/manifest.json; ejecuta --write.\n');
      return 1;
    }
    if (readFileSync(MANIFEST_PATH, 'utf8') !== serialize(manifest)) {
      process.stderr.write('[build-evidence] DESACTUALIZADO: el manifiesto no coincide con la cola RC; ejecuta --write.\n');
      return 1;
    }
    for (const f of markdownFiles(manifest)) {
      if (!existsSync(f.path) || readFileSync(f.path, 'utf8') !== f.content) {
        process.stderr.write(`[build-evidence] DESACTUALIZADO: ${f.path} no coincide; ejecuta --write.\n`);
        return 1;
      }
    }
    const rc = readJson(RC_PATH);
    const ver = validateEvidenceManifest(manifest, rc);
    if (!ver.ok) {
      process.stderr.write('[build-evidence] VALIDACIÓN FALLIDA:\n');
      for (const e of ver.errors) process.stderr.write(`  - ${e}\n`);
      return 1;
    }
    process.stdout.write(`[build-evidence] OK: ${manifest.summary.total} paquete/s de evidencia al día.\n`);
    return 0;
  }

  if (args.has('--write')) {
    writeAtomic(MANIFEST_PATH, serialize(manifest));
    for (const f of markdownFiles(manifest)) writeAtomic(f.path, f.content);
    process.stderr.write(`[build-evidence] escrito → editorial-review/ (${manifest.summary.total} paquete/s).\n`);
    return 0;
  }

  process.stdout.write(serialize(manifest));
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}

export { compute };
