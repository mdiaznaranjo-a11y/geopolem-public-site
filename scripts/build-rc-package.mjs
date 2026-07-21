// GEOPÓLEM (Sprint 19) — construye/verifica el paquete Release Candidate.
// ---------------------------------------------------------------------------
// Ensambla api/v1/rc/manifest.json a partir de los artefactos de STAGING ya
// validados (bundle + 10 detalles + mapa enriquecido + coverage-report),
// calculando el sha256 de cada uno. El RC sólo APUNTA a staging: no toca
// producción ni duplica canónicos. El `generated_at` se HEREDA del
// coverage-report de staging para que el manifiesto sea reproducible y no-diff.
//
// MODOS:
//   (sin modo)   imprime el manifiesto JSON. NO escribe.
//   --json       igual (JSON explícito). NO escribe.
//   --write      escribe api/v1/rc/manifest.json (atómico).
//   --check      exit!=0 si el manifiesto versionado NO coincide o su integridad
//                (checksums de artefactos) no verifica.
// ---------------------------------------------------------------------------

import {
  readFileSync, writeFileSync, renameSync, mkdirSync, existsSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRcManifest, verifyRcManifest, sha256, rcManifestPath,
} from '../rc-package.mjs';
import { planCanonicalBackup } from '../canonical-rollback.mjs';
import { PRODUCTION_PUBLISH_ENABLED } from '../release-confirmation.mjs';
import {
  stagingBundlePath, stagingDetailPath, stagingMapPath, stagingCoveragePath,
} from '../staging-consume.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const OUT_PATH = resolve(REPO_ROOT, rcManifestPath());
const RC_EDITORIAL = resolve(REPO_ROOT, 'data/editorial-review-queue.rc.json');

const abs = (rel) => resolve(REPO_ROOT, rel);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
function sha256File(rel) { return sha256(readFileSync(abs(rel))); }

function collectArtifacts(bundle) {
  const ids = bundle && isObj(bundle.data) ? Object.keys(bundle.data) : [];
  const rels = [stagingBundlePath(), stagingMapPath(), stagingCoveragePath()];
  for (const id of ids) rels.push(stagingDetailPath(id));
  const artifacts = [];
  for (const rel of rels) {
    if (!existsSync(abs(rel))) continue;
    let contract = null;
    try { contract = readJson(abs(rel)).contract || null; } catch { /* no-json contract */ }
    artifacts.push({ path: rel, sha256: sha256File(rel), ...(contract ? { contract } : {}) });
  }
  return { artifacts, ids };
}

function isObj(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }

function compute() {
  const bundle = readJson(abs(stagingBundlePath()));
  const coverage = readJson(abs(stagingCoveragePath()));
  const { artifacts, ids } = collectArtifacts(bundle);
  const editorial = existsSync(RC_EDITORIAL) ? readJson(RC_EDITORIAL).summary : null;
  const rollbackPlan = planCanonicalBackup({ conflictIds: ids, fileExists: (rel) => existsSync(abs(rel)) });
  // generated_at determinista: heredado del coverage-report de staging.
  const generatedAt = typeof coverage.generated_at === 'string' ? coverage.generated_at : null;
  return buildRcManifest({
    artifacts, coverage, editorialSummary: editorial, rollbackPlan,
    conflictIds: ids, generatedAt, publishEnabled: PRODUCTION_PUBLISH_ENABLED,
  });
}

function serialize(obj) { return `${JSON.stringify(obj, null, 2)}\n`; }

function writeJsonAtomic(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, serialize(obj), 'utf8');
  renameSync(tmp, path);
}

function main() {
  const args = new Set(process.argv.slice(2));
  if (!existsSync(abs(stagingBundlePath()))) {
    process.stderr.write('[build-rc-package] FALTA el bundle de staging; no puedo construir el RC.\n');
    return 1;
  }
  const manifest = compute();

  if (args.has('--check')) {
    if (!existsSync(OUT_PATH)) {
      process.stderr.write('[build-rc-package] FALTA api/v1/rc/manifest.json; ejecuta --write.\n');
      return 1;
    }
    if (readFileSync(OUT_PATH, 'utf8') !== serialize(manifest)) {
      process.stderr.write('[build-rc-package] DESACTUALIZADO: el manifiesto no coincide con staging; ejecuta --write.\n');
      return 1;
    }
    const onDisk = readJson(OUT_PATH);
    const ver = verifyRcManifest(onDisk, { readSha256: (rel) => sha256File(rel) });
    if (!ver.ok) {
      process.stderr.write('[build-rc-package] INTEGRIDAD FALLIDA:\n');
      for (const e of ver.errors) process.stderr.write(`  - ${e}\n`);
      return 1;
    }
    process.stdout.write(`[build-rc-package] OK: RC al día e íntegro (${manifest.build.artifact_count} artefacto/s, cobertura ${manifest.coverage?.coverage_pct ?? '?'}%).\n`);
    return 0;
  }

  if (args.has('--write')) {
    writeJsonAtomic(OUT_PATH, manifest);
    process.stderr.write(`[build-rc-package] escrito → ${OUT_PATH} (${manifest.build.artifact_count} artefacto/s).\n`);
    return 0;
  }

  process.stdout.write(serialize(manifest));
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}

export { compute };
