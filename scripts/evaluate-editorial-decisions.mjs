// GEOPÓLEM (Sprint 22) — evalúa las decisiones editoriales humanas y produce el
// reporte GO/NO-GO actualizado.
// ---------------------------------------------------------------------------
// Ensambla api/v1/rc/go-no-go.sprint22.json a partir de:
//   • el manifiesto de evidencia vigente (editorial-review/sprint21/manifest.json),
//   • la cobertura del manifiesto RC (api/v1/rc/manifest.json),
//   • el set de decisiones editoriales (env/archivo NO versionado; un EJEMPLO
//     nunca cuenta), validado contra el hash de la evidencia vigente.
//
// Es un reporte SEPARADO que NO modifica la evidencia ni la cola. `generated_at`
// se HEREDA del manifiesto de evidencia para ser reproducible/no-diff. Sin
// decisiones reales el total es NO-GO; y aun con todas firmadas, la publicación
// real permanece DESHABILITADA por política (PRODUCTION_PUBLISH_ENABLED=false).
//
// MODOS:
//   (sin modo)   imprime el reporte en texto. NO escribe.
//   --json       imprime el reporte JSON. NO escribe.
//   --hash       imprime el hash del manifiesto de evidencia vigente. NO escribe.
//   --write      escribe api/v1/rc/go-no-go.sprint22.json (atómico).
//   --check      exit!=0 si el reporte versionado NO coincide con lo generado.
// ---------------------------------------------------------------------------

import {
  readFileSync, writeFileSync, renameSync, mkdirSync, existsSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeEvidenceManifestHash, resolveDecisionSet, buildDecisionGoNoGo, DECISIONS_FILE,
} from '../editorial-decision.mjs';
import { PRODUCTION_PUBLISH_ENABLED } from '../release-confirmation.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const MANIFEST_PATH = resolve(REPO_ROOT, 'editorial-review/sprint21/manifest.json');
const RC_MANIFEST_PATH = resolve(REPO_ROOT, 'api/v1/rc/manifest.json');
const DECISIONS_PATH = resolve(REPO_ROOT, DECISIONS_FILE);
const OUT_PATH = resolve(REPO_ROOT, 'api/v1/rc/go-no-go.sprint22.json');

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const fileExists = (p) => existsSync(p);
const readFile = (p) => readFileSync(p, 'utf8');

function compute() {
  const manifest = readJson(MANIFEST_PATH);
  const coverage = existsSync(RC_MANIFEST_PATH) ? readJson(RC_MANIFEST_PATH).coverage : null;

  // Decisiones editoriales (Sprint 22): env/archivo, no versionado. Un EJEMPLO no cuenta.
  const decisionEval = resolveDecisionSet({
    env: process.env, decisionsPath: DECISIONS_PATH, fileExists, readFile, manifest,
  });

  const generatedAt = typeof manifest.generated_at === 'string' ? manifest.generated_at : null;
  return buildDecisionGoNoGo({
    manifest, decisionEval, coverage,
    publishEnabled: PRODUCTION_PUBLISH_ENABLED, generatedAt,
  });
}

function serialize(obj) { return `${JSON.stringify(obj, null, 2)}\n`; }

function writeJsonAtomic(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, serialize(obj), 'utf8');
  renameSync(tmp, path);
}

function formatText(r) {
  const L = [];
  L.push('GEOPÓLEM — GO/NO-GO tras decisión editorial humana (Sprint 22)');
  L.push('='.repeat(72));
  L.push(`Decisión total:          ${r.decision}`);
  L.push(`Items GO / NO-GO:        ${r.summary.go} / ${r.summary.no_go} (total ${r.summary.total})`);
  L.push(`Aprobados/Rechaz/Difer:  ${r.summary.approved} / ${r.summary.rejected} / ${r.summary.deferred}`);
  L.push(`Sin decisión:            ${r.summary.pending}`);
  L.push(`Cobertura ok:            ${r.summary.coverage_ok}`);
  L.push(`Decisiones válidas:      ${r.summary.decision_ok} (fuente: ${r.decision_source})`);
  L.push(`Publicación habilitada:  ${r.summary.publish_enabled}`);
  L.push(`Hash evidencia vigente:  ${r.evidence_manifest_hash}`);
  L.push('');
  L.push('Blockers:');
  for (const b of r.blockers) L.push(`  · ${b}`);
  L.push('');
  for (const it of r.items) {
    L.push(`[${it.go ? 'GO' : 'NO-GO'}] ${it.conflict} (${it.type}) — decisión: ${it.decision || '—'} — roles: ${it.roles_present.join('+') || '—'}`);
    for (const reason of it.reasons) L.push(`    ${reason}`);
  }
  return L.join('\n');
}

function main() {
  const args = new Set(process.argv.slice(2));
  if (!existsSync(MANIFEST_PATH)) {
    process.stderr.write('[decisions] FALTA editorial-review/sprint21/manifest.json; ejecuta resolution:build:write.\n');
    return 1;
  }

  if (args.has('--hash')) {
    process.stdout.write(`${computeEvidenceManifestHash(readJson(MANIFEST_PATH))}\n`);
    return 0;
  }

  const report = compute();

  if (args.has('--check')) {
    if (!existsSync(OUT_PATH)) {
      process.stderr.write('[decisions] FALTA api/v1/rc/go-no-go.sprint22.json; ejecuta --write.\n');
      return 1;
    }
    if (readFileSync(OUT_PATH, 'utf8') !== serialize(report)) {
      process.stderr.write('[decisions] DESACTUALIZADO: el reporte no coincide con la evidencia/decisiones; ejecuta --write.\n');
      return 1;
    }
    if (report.is_production !== false) {
      process.stderr.write('[decisions] ERROR: is_production != false.\n');
      return 1;
    }
    process.stdout.write(`[decisions] OK: reporte al día (${report.decision}; ${report.summary.go}/${report.summary.total} GO).\n`);
    return 0;
  }

  if (args.has('--write')) {
    writeJsonAtomic(OUT_PATH, report);
    process.stderr.write(`[decisions] escrito → ${OUT_PATH} (${report.decision}).\n`);
    return 0;
  }

  if (args.has('--json')) process.stdout.write(serialize(report));
  else process.stdout.write(`${formatText(report)}\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}

export { compute };
