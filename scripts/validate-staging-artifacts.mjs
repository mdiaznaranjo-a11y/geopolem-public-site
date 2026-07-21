// GEOPÓLEM (Sprint 16) — validación E2E de artefactos de STAGING, sin producción.
// ---------------------------------------------------------------------------
// Comprueba SIN red ni navegador que los artefactos enriquecidos de staging
// (`api/v1/staging/**`) son CONSUMIBLES y que STAGING NO altera los canónicos
// públicos (producción intacta). Salida exit 0/1 para CI.
//
// Valida:
//   1) bundle de staging (contrato sprint-15-staging-canonical-v1)
//   2) los 10 detalles de staging (envoltorio {data} v1) + deep-link #foco={id}
//   3) mapa enriquecido de staging (contrato sprint-15-staging-map-v1)
//   4) coverage-report (gate + review_flags)
//   5) SEPARACIÓN canónica: cada detalle de staging tiene su homólogo canónico
//      distinto en disco; el bundle declara canonical:false; y ningún artefacto
//      canónico se ha marcado como staging.
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDetail } from '../api-server/scripts/export-static-bridge.mjs';
import {
  validateStagingBundle, validateStagingMap, validateCoverageReport,
  stagingBundlePath, stagingDetailPath, stagingMapPath, stagingCoveragePath,
  canonicalDetailPath,
} from '../staging-consume.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');

function log(msg) { console.log(`[validate-staging-artifacts] ${msg}`); }
function readJson(p) { return JSON.parse(readFileSync(p, 'utf8')); }
const abs = (rel) => resolve(REPO_ROOT, rel);

async function main() {
  const errors = [];
  const fail = (m) => errors.push(m);

  // 1) Bundle de staging.
  const bundlePath = abs(stagingBundlePath());
  if (!existsSync(bundlePath)) { log('ERROR: falta el bundle de staging'); return 1; }
  const bundle = readJson(bundlePath);
  const bres = validateStagingBundle(bundle);
  if (!bres.ok) bres.errors.forEach((e) => fail(`bundle: ${e}`));
  const ids = bundle.data && typeof bundle.data === 'object' ? Object.keys(bundle.data) : [];

  // 2) Detalles de staging + simulación de deep-link #foco={id}.
  let detailCount = 0;
  for (const id of ids) {
    const p = abs(stagingDetailPath(id));
    if (!existsSync(p)) { fail(`falta detalle staging para #foco=${id}`); continue; }
    const detail = readJson(p);
    const { ok, errors: derr } = validateDetail(detail, id);
    if (!ok) derr.forEach((e) => fail(`staging-detail(${id}): ${e}`));
    else detailCount += 1;
  }

  // 3) Mapa enriquecido de staging.
  const mapPath = abs(stagingMapPath());
  if (!existsSync(mapPath)) fail('falta el mapa enriquecido de staging');
  else {
    const mres = validateStagingMap(readJson(mapPath));
    if (!mres.ok) mres.errors.forEach((e) => fail(`staging-map: ${e}`));
  }

  // 4) Coverage report.
  const covPath = abs(stagingCoveragePath());
  if (!existsSync(covPath)) fail('falta coverage-report de staging');
  else {
    const cres = validateCoverageReport(readJson(covPath));
    if (!cres.ok) cres.errors.forEach((e) => fail(`coverage-report: ${e}`));
  }

  // 5) Separación canónica: producción intacta y distinta de staging.
  if (bundle.canonical !== false || bundle.staging !== true) {
    fail('separación: el bundle de staging no se declara staging/no-canónico');
  }
  let separationChecked = 0;
  for (const id of ids) {
    const canonPath = abs(canonicalDetailPath(id));
    if (!existsSync(canonPath)) {
      fail(`separación: falta el detalle CANÓNICO de ${id} (producción debería existir aparte)`);
      continue;
    }
    // El canónico no debe declararse como staging.
    const canon = readJson(canonPath);
    if (canon?.staging === true || canon?.data?.staging === true) {
      fail(`separación: el detalle canónico ${id} se marcó staging (contaminación)`);
    }
    separationChecked += 1;
  }
  // El bundle canónico de lista/mapa no debe vivir bajo staging/.
  const canonList = abs('api/v1/conflicts.json');
  if (existsSync(canonList)) {
    const list = readJson(canonList);
    if (list?.staging === true) fail('separación: conflicts.json canónico marcado staging');
  }

  if (errors.length) {
    log(`FALLÓ la validación de staging (${errors.length} problema/s):`);
    for (const e of errors) log(`  - ${e}`);
    return 1;
  }

  log(`OK: bundle=1, detalles staging=${detailCount}/${ids.length}, `
    + `mapa enriquecido=1, coverage-report=1, separación canónica verificada=${separationChecked}. `
    + 'Producción intacta.');
  return 0;
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error('[validate-staging-artifacts] error no controlado:', err?.message || err);
  process.exit(1);
});
