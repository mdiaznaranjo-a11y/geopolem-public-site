// GEOPÓLEM (Sprint 16) — E2E de consumo de STAGING y separación canónica.
// ---------------------------------------------------------------------------
// Valida, leyendo los artefactos reales de `api/v1/staging/**`, que:
//   • el bundle, los 10 detalles, el mapa enriquecido y el coverage-report son
//     CONSUMIBLES (contratos v1 + validateDetail del puente estático).
//   • STAGING no altera producción: cada conflicto tiene su detalle canónico
//     APARTE en `api/v1/conflicts/{id}.json`, el bundle se declara
//     canonical:false/staging:true y ningún canónico se marca staging.
// No usa red ni DB: sólo lee disco.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validateStagingBundle, validateStagingMap, validateCoverageReport,
  stagingBundlePath, stagingDetailPath, stagingMapPath, stagingCoveragePath,
  canonicalDetailPath, unwrap, STAGING_BUNDLE_CONTRACT, STAGING_MAP_CONTRACT,
} from '../../staging-consume.mjs';
import { validateDetail } from '../scripts/export-static-bridge.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const abs = (rel) => resolve(REPO_ROOT, rel);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const bundle = readJson(abs(stagingBundlePath()));
const ids = Object.keys(bundle.data);

test('el bundle de staging es consumible y respeta el contrato v1', () => {
  const { ok, errors } = validateStagingBundle(bundle);
  assert.ok(ok, `errores: ${errors.join('; ')}`);
  assert.equal(bundle.contract, STAGING_BUNDLE_CONTRACT);
  assert.equal(ids.length, 10);
});

test('los 10 detalles de staging validan como detalle enriquecido v1', () => {
  let count = 0;
  for (const id of ids) {
    const p = abs(stagingDetailPath(id));
    assert.ok(existsSync(p), `falta detalle staging ${id}`);
    const detail = readJson(p);
    const { ok, errors } = validateDetail(detail, id);
    assert.ok(ok, `detalle ${id}: ${errors.join('; ')}`);
    // El envoltorio {data} se desenvuelve limpio.
    assert.equal(unwrap(detail).id, id);
    count += 1;
  }
  assert.equal(count, 10);
});

test('el mapa enriquecido de staging es consumible con trazabilidad de fuentes', () => {
  const map = readJson(abs(stagingMapPath()));
  const { ok, errors } = validateStagingMap(map);
  assert.ok(ok, `errores: ${errors.join('; ')}`);
  assert.equal(map.features.length, ids.length);
  // Trazabilidad: cada feature declara si tiene fuente verificada y revisión.
  for (const f of map.features) {
    assert.equal(typeof f.properties.has_verified_source, 'boolean');
    assert.equal(typeof f.properties.needs_human_review, 'boolean');
  }
});

test('el coverage-report es consumible y declara gate autorizado al 100%', () => {
  const cov = readJson(abs(stagingCoveragePath()));
  const { ok, errors } = validateCoverageReport(cov);
  assert.ok(ok, `errores: ${errors.join('; ')}`);
  assert.equal(cov.gate.coverage_pct, 100);
  assert.equal(cov.after.conflicts_with_sources, cov.after.total_conflicts);
});

test('SEPARACIÓN canónica: cada conflicto de staging tiene detalle canónico APARTE', () => {
  for (const id of ids) {
    const stagingP = abs(stagingDetailPath(id));
    const canonP = abs(canonicalDetailPath(id));
    assert.ok(existsSync(canonP), `producción debe tener ${id} aparte`);
    assert.notEqual(stagingP, canonP, 'staging y canónico no pueden ser el mismo archivo');
    const canon = readJson(canonP);
    // El canónico NO debe declararse staging (sin contaminación).
    assert.notEqual(canon.staging, true);
    assert.notEqual(canon.data?.staging, true);
  }
});

test('el bundle de staging se declara NO canónico y separado de producción', () => {
  assert.equal(bundle.staging, true);
  assert.equal(bundle.canonical, false);
  assert.match(bundle.notice, /NO es producción/i);
});

test('producción (conflicts.json) permanece intacta y no marcada como staging', () => {
  const list = readJson(abs('api/v1/conflicts.json'));
  assert.notEqual(list.staging, true);
  assert.ok(Array.isArray(list.data) && list.data.length === 10);
});

test('el mapa de staging usa su propio contrato, distinto del canónico', () => {
  const map = readJson(abs(stagingMapPath()));
  assert.equal(map.contract, STAGING_MAP_CONTRACT);
  assert.equal(map.staging, true);
  // El canónico enriquecido existe aparte y no se confunde con el de staging.
  const canonMap = abs('api/v1/conflicts/active/map.enriched.json');
  assert.ok(existsSync(canonMap), 'el mapa canónico enriquecido debe existir aparte');
});
