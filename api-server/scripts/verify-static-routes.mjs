// GEOPÓLEM (Sprint 11) — verificación SIN navegador de rutas/archivos estáticos.
// ---------------------------------------------------------------------------
// Comprueba que el sitio estático publicable tiene coherentes:
//   • api/v1/conflicts.json  (lista)
//   • api/v1/conflicts/active/map.json  (mapa base)
//   • api/v1/conflicts/active/map.enriched.json  (mapa enriquecido, si existe)
//   • api/v1/conflicts/{id}.json  (detalle por conflicto activo)
// Simula los deep-links (#foco={id}) resolviendo cada uno a su archivo estático.
// No usa red ni navegador: sólo lee el disco. Salida exit 0/1 para CI.
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const LIST_PATH = resolve(REPO_ROOT, 'api/v1/conflicts.json');
const MAP_PATH = resolve(REPO_ROOT, 'api/v1/conflicts/active/map.json');
const MAP_ENRICHED_PATH = resolve(REPO_ROOT, 'api/v1/conflicts/active/map.enriched.json');
const DETAILS_DIR = resolve(REPO_ROOT, 'api/v1/conflicts');

function log(msg) { console.log(`[verify-static-routes] ${msg}`); }
function readJson(p) { return JSON.parse(readFileSync(p, 'utf8')); }

async function main() {
  const errors = [];
  const fail = (m) => errors.push(m);

  if (!existsSync(LIST_PATH)) { log('ERROR: falta conflicts.json'); return 1; }
  if (!existsSync(MAP_PATH)) { log('ERROR: falta map.json'); return 1; }

  const list = readJson(LIST_PATH);
  const items = Array.isArray(list?.data) ? list.data : [];
  if (!items.length) { log('ERROR: conflicts.json sin data'); return 1; }

  const { validateDetail, validateBridge, validateEnrichedMap } =
    await import('./export-static-bridge.mjs');

  // 1) Puente base.
  const base = validateBridge(list, readJson(MAP_PATH));
  if (!base.ok) base.errors.forEach((e) => fail(`bridge: ${e}`));

  // 2) Mapa enriquecido (opcional pero, si existe, debe validar).
  let enrichedFeatures = 0;
  if (existsSync(MAP_ENRICHED_PATH)) {
    const enr = readJson(MAP_ENRICHED_PATH);
    const r = validateEnrichedMap(enr);
    if (!r.ok) r.errors.forEach((e) => fail(`enriched-map: ${e}`));
    enrichedFeatures = Array.isArray(enr.features) ? enr.features.length : 0;
  } else {
    log('AVISO: no hay map.enriched.json (opcional).');
  }

  // 3) Detalle por conflicto + simulación de deep-link #foco={id}.
  let detailCount = 0;
  let deepLinksOk = 0;
  const active = items.filter((c) => c.status === 'active'
    && c.location && c.location.latitude != null && c.location.longitude != null);
  for (const item of items) {
    const p = resolve(DETAILS_DIR, `${item.id}.json`);
    if (!existsSync(p)) {
      // Los focos activos con coords DEBEN tener detalle (deep-link navegable).
      if (active.some((a) => a.id === item.id)) fail(`falta detalle para foco activo #foco=${item.id}`);
      continue;
    }
    const { ok, errors: derr } = validateDetail(readJson(p), item.id);
    if (!ok) derr.forEach((e) => fail(`detail(${item.id}): ${e}`));
    else { detailCount += 1; deepLinksOk += 1; }
  }

  if (errors.length) {
    log(`FALLÓ la verificación (${errors.length} problema/s):`);
    for (const e of errors) log(`  - ${e}`);
    return 1;
  }

  log(`OK: lista=${items.length}, activos=${active.length}, `
    + `detalles=${detailCount}, deep-links resueltos=${deepLinksOk}, `
    + `features enriquecidas=${enrichedFeatures}.`);
  return 0;
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error('[verify-static-routes] error no controlado:', err?.message || err);
  process.exit(1);
});
