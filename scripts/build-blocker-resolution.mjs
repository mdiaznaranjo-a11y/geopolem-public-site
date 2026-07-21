// GEOPÓLEM (Sprint 21) — construye/verifica la resolución técnica de bloqueos del RC.
// ---------------------------------------------------------------------------
// Ensambla, de forma determinista y sin inventar datos, los artefactos del Sprint 21:
//   • data/editorial-review-queue.sprint21.json          (cola RC resuelta, overlay)
//   • editorial-review/sprint21/manifest.json            (evidencia ampliada)
//   • editorial-review/sprint21/evidence/*.md            (una ficha por pendiente)
//   • api/v1/rc/go-no-go.sprint21.json                   (GO/NO-GO actualizado)
//
// A partir de:
//   • data/editorial-review-queue.rc.json                (cola RC — INTACTA)
//   • data/editorial-alternative-evidence.sprint21.json  (evidencia alternativa verificada)
//   • api/v1/rc/manifest.json                            (cobertura)
//   • api/v1/staging/conflicts/<id>.json                 (fuentes/causal_links reales)
//
// `generated_at` se HEREDA de la cola RC para ser reproducible/no-diff. El total del
// GO/NO-GO sigue NO-GO: evidence_ready no es GO y la publicación está deshabilitada.
//
// MODOS:
//   (sin modo)   imprime el manifiesto de evidencia (JSON). NO escribe.
//   --json       igual (JSON explícito). NO escribe.
//   --write      escribe los 4 artefactos (atómico).
//   --check      exit!=0 si algún artefacto versionado NO coincide con lo generado.
// ---------------------------------------------------------------------------

import {
  readFileSync, writeFileSync, renameSync, mkdirSync, existsSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildResolvedQueue, buildResolutionEvidenceManifest, renderResolutionEvidenceMarkdown,
  buildResolvedGoNoGo, validateResolutionEvidenceManifest, validateAlternativeEvidence,
} from '../editorial-blocker-resolution.mjs';
import { resolveEditorialSignoff, SIGNOFF_FILE } from '../editorial-governance.mjs';
import { PRODUCTION_PUBLISH_ENABLED } from '../release-confirmation.mjs';
import { stagingDetailPath } from '../staging-consume.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const RC_PATH = resolve(REPO_ROOT, 'data/editorial-review-queue.rc.json');
const ALT_PATH = resolve(REPO_ROOT, 'data/editorial-alternative-evidence.sprint21.json');
const MANIFEST_RC_PATH = resolve(REPO_ROOT, 'api/v1/rc/manifest.json');
const RESOLVED_QUEUE_PATH = resolve(REPO_ROOT, 'data/editorial-review-queue.sprint21.json');
const EVIDENCE_DIR = resolve(REPO_ROOT, 'editorial-review/sprint21');
const EVIDENCE_MANIFEST_PATH = resolve(EVIDENCE_DIR, 'manifest.json');
const GONOGO_PATH = resolve(REPO_ROOT, 'api/v1/rc/go-no-go.sprint21.json');

const abs = (rel) => resolve(REPO_ROOT, rel);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const fileExists = (rel) => existsSync(abs(rel));
const readFile = (rel) => readFileSync(abs(rel), 'utf8');

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
  const alt = readJson(ALT_PATH);
  const conflictDetails = loadConflictDetails(rc);
  const generatedAt = typeof rc.generated_at === 'string' ? rc.generated_at : null;
  const coverage = existsSync(MANIFEST_RC_PATH) ? readJson(MANIFEST_RC_PATH).coverage : null;

  const resolvedQueue = buildResolvedQueue({ rc, alt, generatedAt });
  const evidenceManifest = buildResolutionEvidenceManifest({ rc, alt, conflictDetails, generatedAt });

  // Sign-off editorial (Sprint 20): env/archivo, no versionado. Un EJEMPLO no cuenta.
  const requiredKeys = (rc.items || []).map((i) => i.key).filter(Boolean);
  const editorialSignoff = resolveEditorialSignoff({
    env: process.env, signoffPath: SIGNOFF_FILE, fileExists, readFile, requiredKeys,
  });

  const goNoGo = buildResolvedGoNoGo({
    resolvedQueue, coverage, signoffEval: editorialSignoff,
    publishEnabled: PRODUCTION_PUBLISH_ENABLED, generatedAt,
  });

  return { rc, alt, resolvedQueue, evidenceManifest, goNoGo };
}

function serialize(obj) { return `${JSON.stringify(obj, null, 2)}\n`; }

function writeAtomic(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, path);
}

function markdownFiles(evidenceManifest) {
  return evidenceManifest.items.map((it) => ({
    path: resolve(EVIDENCE_DIR, it.evidence_file),
    content: renderResolutionEvidenceMarkdown(it),
  }));
}

function checkFile(path, expected, label) {
  if (!existsSync(path)) {
    process.stderr.write(`[resolution] FALTA ${label}; ejecuta --write.\n`);
    return false;
  }
  if (readFileSync(path, 'utf8') !== expected) {
    process.stderr.write(`[resolution] DESACTUALIZADO: ${label} no coincide; ejecuta --write.\n`);
    return false;
  }
  return true;
}

function main() {
  const args = new Set(process.argv.slice(2));
  if (!existsSync(RC_PATH)) {
    process.stderr.write('[resolution] FALTA data/editorial-review-queue.rc.json; ejecuta review:rc:write.\n');
    return 1;
  }
  if (!existsSync(ALT_PATH)) {
    process.stderr.write('[resolution] FALTA data/editorial-alternative-evidence.sprint21.json.\n');
    return 1;
  }
  const { rc, alt, resolvedQueue, evidenceManifest, goNoGo } = compute();

  // Validaciones estructurales (siempre): evidencia alternativa y manifiesto ampliado.
  const altVer = validateAlternativeEvidence(alt, rc);
  const evVer = validateResolutionEvidenceManifest(evidenceManifest, rc);

  if (args.has('--check')) {
    if (!altVer.ok) {
      process.stderr.write('[resolution] VALIDACIÓN evidencia alternativa FALLIDA:\n');
      for (const e of altVer.errors) process.stderr.write(`  - ${e}\n`);
      return 1;
    }
    if (!evVer.ok) {
      process.stderr.write('[resolution] VALIDACIÓN manifiesto de evidencia FALLIDA:\n');
      for (const e of evVer.errors) process.stderr.write(`  - ${e}\n`);
      return 1;
    }
    let ok = true;
    ok = checkFile(RESOLVED_QUEUE_PATH, serialize(resolvedQueue), 'data/editorial-review-queue.sprint21.json') && ok;
    ok = checkFile(EVIDENCE_MANIFEST_PATH, serialize(evidenceManifest), 'editorial-review/sprint21/manifest.json') && ok;
    for (const f of markdownFiles(evidenceManifest)) {
      ok = checkFile(f.path, f.content, f.path) && ok;
    }
    ok = checkFile(GONOGO_PATH, serialize(goNoGo), 'api/v1/rc/go-no-go.sprint21.json') && ok;
    if (!ok) return 1;
    if (goNoGo.is_production !== false) {
      process.stderr.write('[resolution] ERROR: is_production != false.\n');
      return 1;
    }
    if (goNoGo.summary.go !== 0 || goNoGo.decision !== 'NO-GO') {
      process.stderr.write('[resolution] ERROR: el Sprint 21 no aprueba ni habilita producción (go debe ser 0 y NO-GO).\n');
      return 1;
    }
    process.stdout.write(`[resolution] OK: ${resolvedQueue.summary.resolved_via_alternative_source}/${resolvedQueue.summary.total} resuelto/s a evidence_ready; total ${goNoGo.decision} (go=${goNoGo.summary.go}).\n`);
    return 0;
  }

  if (args.has('--write')) {
    if (!altVer.ok || !evVer.ok) {
      process.stderr.write('[resolution] NO escribo: validación fallida.\n');
      for (const e of [...altVer.errors, ...evVer.errors]) process.stderr.write(`  - ${e}\n`);
      return 1;
    }
    writeAtomic(RESOLVED_QUEUE_PATH, serialize(resolvedQueue));
    writeAtomic(EVIDENCE_MANIFEST_PATH, serialize(evidenceManifest));
    for (const f of markdownFiles(evidenceManifest)) writeAtomic(f.path, f.content);
    writeAtomic(GONOGO_PATH, serialize(goNoGo));
    process.stderr.write(`[resolution] escrito → data/ + editorial-review/sprint21/ + api/v1/rc/go-no-go.sprint21.json (${resolvedQueue.summary.resolved_via_alternative_source}/${resolvedQueue.summary.total} resuelto/s; ${goNoGo.decision}).\n`);
    return 0;
  }

  if (args.has('--json')) process.stdout.write(serialize({ resolvedQueue, evidenceManifest, goNoGo }));
  else process.stdout.write(serialize(evidenceManifest));
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}

export { compute };
