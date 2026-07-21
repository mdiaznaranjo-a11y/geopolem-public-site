// GEOPÓLEM (Sprint 16) — PWA/offline: cacheo del puente y fallback de detalle.
// ---------------------------------------------------------------------------
// Sin navegador: verifica que
//   • el service-worker cachea los JSON de staging igual que el puente estático
//     (mismo criterio `/api/v1/.+\.json$`) sin romper la caché pública;
//   • resolveStagingDetail degrada limpio staging → canónico → foco local → none
//     y nunca lanza, cubriendo el caso "no existe detalle de staging".
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isCacheableBridgeJson, isStagingPath, resolveStagingDetail,
  stagingBundlePath, stagingDetailPath, stagingMapPath, stagingCoveragePath,
  canonicalDetailPath,
} from '../../staging-consume.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const SW = readFileSync(resolve(REPO_ROOT, 'service-worker.js'), 'utf8');

test('el criterio de cacheo del puente cubre TODOS los artefactos de staging', () => {
  for (const p of [stagingBundlePath(), stagingDetailPath('ukr-rus'), stagingMapPath(), stagingCoveragePath()]) {
    const pathname = `/${p}`;
    assert.ok(isCacheableBridgeJson(pathname), `${pathname} debe ser cacheable`);
    assert.ok(isStagingPath(pathname), `${pathname} debe reconocerse como staging`);
  }
});

test('los canónicos también son cacheables, y los no-JSON / dinámicos NO', () => {
  assert.ok(isCacheableBridgeJson('/api/v1/conflicts.json'));
  assert.ok(isCacheableBridgeJson(`/${canonicalDetailPath('red-sea')}`));
  // Dinámico o no-JSON: fuera del puente estático (sólo-red en el SW).
  assert.equal(isCacheableBridgeJson('/api/v1/admin/conflicts'), false);
  assert.equal(isCacheableBridgeJson('/api/v1/health'), false);
  assert.equal(isCacheableBridgeJson('/index.html'), false);
  assert.equal(isStagingPath('/api/v1/conflicts/red-sea.json'), false);
});

test('el service-worker conserva el patrón del puente estático (fuente única)', () => {
  // El SW no es importable; garantizamos que sigue usando el mismo regex que
  // replica isCacheableBridgeJson, para que staging quede cacheado offline.
  assert.match(SW, /\\\/api\\\/v1\\\/\.\+\\\.json\$/);
  assert.match(SW, /network-first/i);
});

test('fallback: usa STAGING cuando el detalle de staging existe', async () => {
  const r = await resolveStagingDetail('ukr-rus', {
    loadStaging: async () => ({ data: { id: 'ukr-rus', name: 'S' } }),
    loadCanonical: async () => ({ data: { id: 'ukr-rus', name: 'C' } }),
    localFoco: { id: 'ukr-rus', name: 'L' },
  });
  assert.equal(r.source, 'staging');
  assert.equal(r.detail.name, 'S');
});

test('fallback: si NO existe detalle de staging, cae a CANÓNICO', async () => {
  const r = await resolveStagingDetail('ukr-rus', {
    loadStaging: async () => null, // staging ausente
    loadCanonical: async () => ({ data: { id: 'ukr-rus', name: 'C' } }),
    localFoco: { id: 'ukr-rus', name: 'L' },
  });
  assert.equal(r.source, 'canonical');
  assert.equal(r.detail.name, 'C');
});

test('fallback: si staging y canónico fallan, cae al FOCO LOCAL (offline)', async () => {
  const r = await resolveStagingDetail('ukr-rus', {
    loadStaging: async () => { throw new Error('offline'); },
    loadCanonical: async () => { throw new Error('offline'); },
    localFoco: { id: 'ukr-rus', name: 'L' },
  });
  assert.equal(r.source, 'local');
  assert.equal(r.detail.name, 'L');
  assert.ok(r.error instanceof Error);
});

test('fallback: sin ninguna fuente devuelve source "none" sin lanzar', async () => {
  const r = await resolveStagingDetail('x', {});
  assert.equal(r.source, 'none');
  assert.equal(r.detail, null);
});

test('fallback: id vacío no intenta cargar y degrada al foco local', async () => {
  let called = false;
  const r = await resolveStagingDetail('', {
    loadStaging: async () => { called = true; return { data: {} }; },
    localFoco: { id: 'z', name: 'L' },
  });
  assert.equal(called, false);
  assert.equal(r.source, 'local');
});
