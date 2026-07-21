// GEOPÓLEM (Sprint 20) — construye/verifica el reporte GO/NO-GO del RC.
// ---------------------------------------------------------------------------
// Ensambla api/v1/rc/go-no-go.json a partir de:
//   • la cola RC clasificada (data/editorial-review-queue.rc.json),
//   • la cobertura del manifiesto RC (api/v1/rc/manifest.json),
//   • el sign-off editorial resuelto (env/archivo, si existe; un EJEMPLO nunca
//     cuenta) y la segunda confirmación (doble gate, Sprint 18).
//
// Es un reporte SEPARADO que NO modifica el manifiesto RC. El total es NO-GO
// mientras la publicación esté deshabilitada por política. `generated_at` se
// HEREDA de la cola RC para ser reproducible/no-diff.
//
// MODOS:
//   (sin modo)   imprime el reporte en texto. NO escribe.
//   --json       imprime el reporte JSON. NO escribe.
//   --write      escribe api/v1/rc/go-no-go.json (atómico).
//   --check      exit!=0 si el reporte versionado NO coincide con lo generado.
// ---------------------------------------------------------------------------

import {
  readFileSync, writeFileSync, renameSync, mkdirSync, existsSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGoNoGoReport, resolveEditorialSignoff, SIGNOFF_FILE } from '../editorial-governance.mjs';
import {
  resolveSignoff, SIGNOFF_FILE as PROMO_SIGNOFF_FILE,
} from '../promotion-signoff.mjs';
import {
  resolveReleaseConfirmation, evaluateProductionRelease, CONFIRM_FILE,
  PRODUCTION_PUBLISH_ENABLED,
} from '../release-confirmation.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const RC_PATH = resolve(REPO_ROOT, 'data/editorial-review-queue.rc.json');
const MANIFEST_PATH = resolve(REPO_ROOT, 'api/v1/rc/manifest.json');
const OUT_PATH = resolve(REPO_ROOT, 'api/v1/rc/go-no-go.json');

const abs = (rel) => resolve(REPO_ROOT, rel);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const fileExists = (rel) => existsSync(abs(rel));
const readFile = (rel) => readFileSync(abs(rel), 'utf8');

function compute() {
  const rc = readJson(RC_PATH);
  const coverage = existsSync(MANIFEST_PATH) ? readJson(MANIFEST_PATH).coverage : null;
  const requiredKeys = (rc.items || []).map((i) => i.key).filter(Boolean);

  // Sign-off editorial (Sprint 20): env/archivo, no versionado. Un EJEMPLO no cuenta.
  const editorialSignoff = resolveEditorialSignoff({
    env: process.env, signoffPath: SIGNOFF_FILE, fileExists, readFile, requiredKeys,
  });

  // Doble gate (Sprint 17/18): sign-off de promoción + segunda confirmación.
  const promoSignoff = resolveSignoff({
    env: process.env, signoffPath: PROMO_SIGNOFF_FILE, fileExists, readFile,
  });
  const confirmation = resolveReleaseConfirmation({
    env: process.env, confirmPath: CONFIRM_FILE, fileExists, readFile,
  });
  const doubleGate = evaluateProductionRelease({ signoff: promoSignoff, confirmation });

  const generatedAt = typeof rc.generated_at === 'string' ? rc.generated_at : null;
  return buildGoNoGoReport({
    rc, coverage, signoffEval: editorialSignoff, doubleGate,
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
  L.push('GEOPÓLEM — Reporte GO/NO-GO del Release Candidate (Sprint 20)');
  L.push('='.repeat(72));
  L.push(`Decisión total:          ${r.decision}`);
  L.push(`Items GO / NO-GO:        ${r.summary.go} / ${r.summary.no_go} (total ${r.summary.total})`);
  L.push(`Cobertura ok:            ${r.summary.coverage_ok}`);
  L.push(`Sign-off editorial ok:   ${r.summary.signoff_ok}`);
  L.push(`Doble gate ok:           ${r.summary.double_gate_ok}`);
  L.push(`Publicación habilitada:  ${r.summary.publish_enabled}`);
  L.push('');
  L.push('Blockers:');
  for (const b of r.blockers) L.push(`  · ${b}`);
  L.push('');
  for (const it of r.items) {
    L.push(`[${it.go ? 'GO' : 'NO-GO'}] ${it.conflict} (${it.type}) — decisión: ${it.decision || '—'}`);
    for (const reason of it.reasons) L.push(`    ${reason}`);
  }
  return L.join('\n');
}

function main() {
  const args = new Set(process.argv.slice(2));
  if (!existsSync(RC_PATH)) {
    process.stderr.write('[go-no-go] FALTA data/editorial-review-queue.rc.json; ejecuta review:rc:write.\n');
    return 1;
  }
  const report = compute();

  if (args.has('--check')) {
    if (!existsSync(OUT_PATH)) {
      process.stderr.write('[go-no-go] FALTA api/v1/rc/go-no-go.json; ejecuta --write.\n');
      return 1;
    }
    if (readFileSync(OUT_PATH, 'utf8') !== serialize(report)) {
      process.stderr.write('[go-no-go] DESACTUALIZADO: el reporte no coincide con la cola RC; ejecuta --write.\n');
      return 1;
    }
    if (report.is_production !== false) {
      process.stderr.write('[go-no-go] ERROR: is_production != false.\n');
      return 1;
    }
    process.stdout.write(`[go-no-go] OK: reporte al día (${report.decision}; ${report.summary.go}/${report.summary.total} GO).\n`);
    return 0;
  }

  if (args.has('--write')) {
    writeJsonAtomic(OUT_PATH, report);
    process.stderr.write(`[go-no-go] escrito → ${OUT_PATH} (${report.decision}).\n`);
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
