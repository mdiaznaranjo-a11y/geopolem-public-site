// GEOPÓLEM (Sprint 23) — evalúa el DISEÑO del gate de habilitación de producción
// y produce un reporte auditable. NO activa producción.
// ---------------------------------------------------------------------------
// Ensambla api/v1/rc/production-gate.sprint23.json reuniendo:
//   • la decisión editorial GO/NO-GO (Sprint 22, evaluate-editorial-decisions),
//   • el sign-off editorial (Sprint 20, env/archivo no versionado),
//   • la segunda confirmación de release (Sprint 18, env/archivo no versionado),
//   • el resumen de firmas criptográficas OPCIONALES (Sprint 23),
//   • la bandera global PRODUCTION_PUBLISH_ENABLED.
//
// `generated_at` se HEREDA del manifiesto de evidencia para ser reproducible.
// El gate está CERRADO por diseño: aunque todo lo demás se cumpla,
// PRODUCTION_PUBLISH_ENABLED=false mantiene production_enabled:false.
//
// MODOS:
//   (sin modo)  imprime el reporte en texto. NO escribe.
//   --json      imprime el reporte JSON. NO escribe.
//   --write     escribe api/v1/rc/production-gate.sprint23.json (atómico).
//   --check     exit!=0 si el reporte versionado NO coincide o si production_enabled!=false.
// ---------------------------------------------------------------------------

import {
  readFileSync, writeFileSync, renameSync, mkdirSync, existsSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveDecisionSet, buildDecisionGoNoGo, DECISIONS_FILE,
} from '../editorial-decision.mjs';
import { resolveSignoff, SIGNOFF_FILE } from '../promotion-signoff.mjs';
import { resolveReleaseConfirmation, CONFIRM_FILE, PRODUCTION_PUBLISH_ENABLED } from '../release-confirmation.mjs';
import { loadPublicKeyRegistry, summarizeDecisionSignatures } from '../editorial-signature.mjs';
import { evaluateProductionGate } from '../production-gate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const MANIFEST_PATH = resolve(REPO_ROOT, 'editorial-review/sprint21/manifest.json');
const RC_MANIFEST_PATH = resolve(REPO_ROOT, 'api/v1/rc/manifest.json');
const DECISIONS_PATH = resolve(REPO_ROOT, DECISIONS_FILE);
const SIGNOFF_PATH = resolve(REPO_ROOT, SIGNOFF_FILE);
const CONFIRM_PATH = resolve(REPO_ROOT, CONFIRM_FILE);
// Registro de claves PÚBLICAS reales (no versionado). El ejemplo no se autocarga.
const KEYS_PATH = resolve(REPO_ROOT, 'editorial-signature-keys.json');
const KEYS_ENV_VAR = 'GEOP_EDITORIAL_SIGNATURE_KEYS';
const OUT_PATH = resolve(REPO_ROOT, 'api/v1/rc/production-gate.sprint23.json');

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const fileExists = (p) => existsSync(p);
const readFile = (p) => readFileSync(p, 'utf8');

function resolveRegistry() {
  const raw = process.env[KEYS_ENV_VAR];
  let parsed = null;
  if (typeof raw === 'string' && raw.trim() !== '') {
    try { parsed = JSON.parse(raw); } catch { return null; }
  } else if (existsSync(KEYS_PATH)) {
    try { parsed = readJson(KEYS_PATH); } catch { return null; }
  }
  if (!parsed) return null;
  return loadPublicKeyRegistry(parsed);
}

function compute() {
  const manifest = readJson(MANIFEST_PATH);
  const coverage = existsSync(RC_MANIFEST_PATH) ? readJson(RC_MANIFEST_PATH).coverage : null;

  const decisionEval = resolveDecisionSet({
    env: process.env, decisionsPath: DECISIONS_PATH, fileExists, readFile, manifest,
  });
  const generatedAt = typeof manifest.generated_at === 'string' ? manifest.generated_at : null;
  const decisionGoNoGo = buildDecisionGoNoGo({
    manifest, decisionEval, coverage, publishEnabled: PRODUCTION_PUBLISH_ENABLED, generatedAt,
  });

  const signoff = resolveSignoff({ env: process.env, signoffPath: SIGNOFF_PATH, fileExists, readFile });
  const confirmation = resolveReleaseConfirmation({ env: process.env, confirmPath: CONFIRM_PATH, fileExists, readFile });

  // Firmas opcionales: sólo se resumen si hay set de decisiones resuelto y un
  // registro de claves públicas real. El ejemplo versionado NO se autocarga.
  const registry = resolveRegistry();
  let signatureSummary = null;
  const rawDecisions = process.env.GEOP_EDITORIAL_DECISIONS;
  let decisionSet = null;
  if (typeof rawDecisions === 'string' && rawDecisions.trim() !== '') {
    try { decisionSet = JSON.parse(rawDecisions); } catch { decisionSet = null; }
  } else if (existsSync(DECISIONS_PATH)) {
    try { decisionSet = readJson(DECISIONS_PATH); } catch { decisionSet = null; }
  }
  if (decisionSet) signatureSummary = summarizeDecisionSignatures(decisionSet, { registry });

  return evaluateProductionGate({
    decisionGoNoGo, signoff, confirmation, signatureSummary,
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
  L.push('GEOPÓLEM — Gate de habilitación de PRODUCCIÓN (DISEÑO, Sprint 23)');
  L.push('='.repeat(72));
  L.push(`Decisión del gate:       ${r.decision}`);
  L.push(`Producción habilitada:   ${r.production_enabled}  (invariante: false)`);
  L.push(`Gate abierto:            ${r.gate_open}`);
  L.push(`Listo para publicar:     ${r.ready_to_publish}`);
  L.push(`Bandera publish_enabled: ${r.publish_enabled}`);
  L.push('');
  L.push('Condiciones:');
  for (const [k, v] of Object.entries(r.conditions)) L.push(`  [${v ? 'OK' : '  '}] ${k}`);
  L.push('');
  L.push('Blockers:');
  for (const b of r.blockers) L.push(`  · ${b}`);
  return L.join('\n');
}

function main() {
  const args = new Set(process.argv.slice(2));
  if (!existsSync(MANIFEST_PATH)) {
    process.stderr.write('[gate] FALTA editorial-review/sprint21/manifest.json.\n');
    return 1;
  }
  const report = compute();

  if (args.has('--check')) {
    if (!existsSync(OUT_PATH)) {
      process.stderr.write('[gate] FALTA api/v1/rc/production-gate.sprint23.json; ejecuta --write.\n');
      return 1;
    }
    if (readFileSync(OUT_PATH, 'utf8') !== serialize(report)) {
      process.stderr.write('[gate] DESACTUALIZADO: el reporte no coincide; ejecuta --write.\n');
      return 1;
    }
    if (report.production_enabled !== false) {
      process.stderr.write('[gate] ERROR: production_enabled != false.\n');
      return 1;
    }
    process.stdout.write(`[gate] OK: reporte al día (${report.decision}; gate_open=${report.gate_open}).\n`);
    return 0;
  }

  if (args.has('--write')) {
    writeJsonAtomic(OUT_PATH, report);
    process.stderr.write(`[gate] escrito → ${OUT_PATH} (${report.decision}).\n`);
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
