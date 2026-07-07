// GEOPÓLEM API v1 (Sprint 5) — regeneración del puente estático desde PostgreSQL.
// ---------------------------------------------------------------------------
// Lee la base de datos PostgreSQL/PostGIS (misma capa que la API real,
// `src/db.mjs`) y REGENERA los JSON del puente estático con EL MISMO contrato
// del Sprint 2:
//     api/v1/conflicts.json            (data + pagination + meta)
//     api/v1/conflicts/active/map.json (FeatureCollection GeoJSON)
//
// Con esto el puente estático (fallback permanente que sirve la PWA y GitHub
// Pages) deja de depender de `data.js` y pasa a reflejar la DB canónica, sin
// romper `api-adapter.js` ni el service worker: el shape de salida es idéntico.
//
// Seguridad de datos (NUNCA corromper el JSON existente):
//   • Sin DATABASE_URL → falla claramente (exit 1) y NO toca los archivos.
//   • Escritura ATÓMICA: se escribe un `.tmp` y sólo se renombra sobre el
//     destino tras validar el contenido en memoria.
//   • Si la DB devuelve 0 conflictos → se aborta (no se sobreescribe con vacío).
//   • Validación post-export del JSON en disco antes de dar éxito.
//
// Modos (banderas):
//   (por defecto)  lee DB, valida y ESCRIBE atómicamente los dos JSON.
//   --dry-run      lee DB y valida, pero NO escribe (imprime resumen).
//   --check        NO usa DB: valida los JSON que ya están en disco (para CI).
//   --help         ayuda.
//
// Uso:
//   DATABASE_URL=postgres://... node scripts/export-static-bridge.mjs
//   DATABASE_URL=postgres://... node scripts/export-static-bridge.mjs --dry-run
//   node scripts/export-static-bridge.mjs --check
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const LIST_PATH = resolve(REPO_ROOT, 'api/v1/conflicts.json');
const MAP_PATH = resolve(REPO_ROOT, 'api/v1/conflicts/active/map.json');
// Mapa ENRIQUECIDO (Sprint 7): archivo ADITIVO y separado. No sustituye a
// map.json (la PWA sigue consumiendo el mapa base sin cambios); añade metadatos
// mínimos por feature para vistas ricas cuando la DB real esté disponible.
const MAP_ENRICHED_PATH = resolve(REPO_ROOT, 'api/v1/conflicts/active/map.enriched.json');
// Detalle estático por conflicto (Sprint 11): un archivo `api/v1/conflicts/{id}.json`
// por conflicto, con el MISMO contrato de ficha que devuelve la API real
// `/api/v1/conflicts/:id`. Aditivo: habilita deep-links y navegación offline.
const DETAILS_DIR = resolve(REPO_ROOT, 'api/v1/conflicts');

const API_VERSION = 'v1';
const SOURCE_LABEL = 'postgres (static bridge, Sprint 5)';
// Etiqueta para exports derivados del propio puente estático (sin DB): Sprint 11.
const SOURCE_LABEL_STATIC = 'static-bridge (derived, Sprint 11)';

// --- Constructores del contrato (idénticos en forma al Sprint 2) ------------

// Envuelve una lista de ConflictListItem en el payload de /conflicts.
export function buildConflictsPayload(items, generatedAt = new Date().toISOString()) {
  return {
    data: items,
    pagination: {
      page: 1,
      page_size: items.length,
      total: items.length,
      total_pages: 1,
    },
    meta: {
      request_id: 'static_bridge',
      api_version: API_VERSION,
      generated_at: generatedAt,
      source: SOURCE_LABEL,
    },
  };
}

// FeatureCollection GeoJSON equivalente a /conflicts/active/map, derivada de
// los mismos items (status='active' + coords presentes) para garantizar que
// lista y mapa nunca divergen.
export function buildActiveMapPayload(items, generatedAt = new Date().toISOString()) {
  return {
    type: 'FeatureCollection',
    features: items
      .filter((c) => c.status === 'active'
        && c.location && c.location.longitude != null && c.location.latitude != null)
      .map((c) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.location.longitude, c.location.latitude] },
        properties: {
          id: c.id,
          slug: c.slug,
          name: c.name,
          intensity_level: c.intensity_level,
          escalation_risk: c.escalation_risk,
          energy_dimension: c.energy_dimension,
          primary_region: c.primary_region?.label ?? null,
        },
      })),
    meta: {
      api_version: API_VERSION,
      generated_at: generatedAt,
      source: SOURCE_LABEL,
    },
  };
}

// Mapa ENRIQUECIDO (Sprint 7): mismo GeoJSON base + propiedades adicionales
// derivadas EXCLUSIVAMENTE de los campos ya presentes en cada item (sin
// inventar datos). Superconjunto compatible: un cliente que sólo lea las
// propiedades base (id, slug, name, intensity_level…) sigue funcionando igual.
export function buildEnrichedMapPayload(items, generatedAt = new Date().toISOString()) {
  return {
    type: 'FeatureCollection',
    features: items
      .filter((c) => c.status === 'active'
        && c.location && c.location.longitude != null && c.location.latitude != null)
      .map((c) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.location.longitude, c.location.latitude] },
        properties: {
          id: c.id,
          slug: c.slug,
          name: c.name,
          intensity_level: c.intensity_level,
          escalation_risk: c.escalation_risk,
          energy_dimension: c.energy_dimension,
          primary_region: c.primary_region?.label ?? null,
          // Enriquecimiento mínimo (sólo campos existentes del item):
          conflict_type: c.conflict_type?.label ?? null,
          territorial_dimension: c.territorial_dimension ?? null,
          external_involvement: c.external_involvement ?? null,
          humanitarian_impact: c.humanitarian_impact ?? null,
          updated_at: c.updated_at ?? null,
        },
      })),
    meta: {
      api_version: API_VERSION,
      generated_at: generatedAt,
      source: SOURCE_LABEL,
      enriched: true,
    },
  };
}

// Valida el mapa enriquecido: mismas invariantes GeoJSON que el base más la
// marca meta.enriched. No lanza. Devuelve { ok, errors[] }.
export function validateEnrichedMap(map) {
  const errors = [];
  const fail = (msg) => errors.push(msg);
  if (!map || map.type !== 'FeatureCollection') fail('map.enriched.json: type != FeatureCollection');
  else if (!Array.isArray(map.features)) fail('map.enriched.json: features no es array');
  else if (map.meta?.enriched !== true) fail('map.enriched.json: falta meta.enriched=true');
  else {
    for (const f of map.features) {
      const geomOk = f.type === 'Feature'
        && f.geometry?.type === 'Point'
        && Array.isArray(f.geometry.coordinates)
        && f.geometry.coordinates.length === 2
        && typeof f.properties?.slug === 'string'
        && 'conflict_type' in f.properties;
      if (!geomOk) { fail(`map.enriched.json: feature inválida (${f?.properties?.slug})`); break; }
    }
  }
  return { ok: errors.length === 0, errors };
}

/* --------------------------------------------------------------------------
   Detalle estático por conflicto (Sprint 11)
   --------------------------------------------------------------------------
   Espeja el contrato de ficha de la API real (`buildDetail` en
   src/repository.mjs): metrics/dimensions anidados + relaciones. Sin DB las
   relaciones llegan vacías (no se inventan datos); con DB se rellenan desde
   `getConflictRelations`. Se replica aquí (no se importa) para mantener el
   exportador autónomo, igual que buildConflictsPayload.
-------------------------------------------------------------------------- */
export function buildConflictDetail(item, relations = null, generatedAt = new Date().toISOString(), source = SOURCE_LABEL) {
  return {
    data: {
      id: item.id,
      slug: item.slug,
      name: item.name,
      summary: item.summary,
      conflict_type: item.conflict_type ?? null,
      primary_region: item.primary_region ?? null,
      status: item.status,
      metrics: {
        intensity_level: item.intensity_level ?? null,
        escalation_risk: item.escalation_risk ?? null,
        humanitarian_impact: item.humanitarian_impact ?? null,
      },
      dimensions: {
        energy: Boolean(item.energy_dimension),
        territorial: item.territorial_dimension ?? null,
        external_involvement: item.external_involvement ?? null,
      },
      location: item.location ?? null,
      actors: relations?.actors ?? { state: [], non_state: [] },
      resources: relations?.resources ?? [],
      chokepoints: relations?.chokepoints ?? [],
      causal_links: relations?.causal_links ?? [],
      sources: relations?.sources ?? [],
      updated_at: item.updated_at ?? null,
    },
    meta: {
      api_version: API_VERSION,
      generated_at: generatedAt,
      source,
    },
  };
}

// Valida un archivo de detalle por conflicto. No lanza. { ok, errors[] }.
export function validateDetail(detail, expectedId = null) {
  const errors = [];
  const fail = (msg) => errors.push(msg);
  const d = detail?.data;
  if (!d || typeof d !== 'object') { fail('detail: falta data'); return { ok: false, errors }; }
  if (typeof d.id !== 'string' || typeof d.slug !== 'string' || typeof d.name !== 'string') {
    fail(`detail: tipos id/slug/name inválidos (${d.id})`);
  }
  if (expectedId != null && d.id !== expectedId) fail(`detail: id "${d.id}" != esperado "${expectedId}"`);
  if (!d.metrics || typeof d.metrics !== 'object') fail(`detail: falta metrics en ${d.id}`);
  if (!d.dimensions || typeof d.dimensions !== 'object') fail(`detail: falta dimensions en ${d.id}`);
  if (!d.actors || !Array.isArray(d.actors.state) || !Array.isArray(d.actors.non_state)) {
    fail(`detail: actors.state/non_state deben ser arrays en ${d.id}`);
  }
  for (const f of ['resources', 'chokepoints', 'causal_links', 'sources']) {
    if (!Array.isArray(d[f])) fail(`detail: ${f} no es array en ${d.id}`);
  }
  if (detail.meta?.api_version !== API_VERSION) fail(`detail: meta.api_version != v1 en ${d.id}`);
  return { ok: errors.length === 0, errors };
}

// --- Validación de contrato (post-export) -----------------------------------

const REQUIRED_FIELDS = [
  'id', 'slug', 'name', 'summary', 'conflict_type', 'primary_region',
  'status', 'intensity_level', 'escalation_risk', 'humanitarian_impact',
  'energy_dimension', 'territorial_dimension', 'external_involvement',
  'location', 'updated_at',
];

// Valida el par (list, map). Devuelve { ok, errors[] }. No lanza.
export function validateBridge(list, map) {
  const errors = [];
  const fail = (msg) => errors.push(msg);

  if (!list || !Array.isArray(list.data)) fail('conflicts.json: data no es array');
  else {
    if (list.data.length === 0) fail('conflicts.json: data vacío');
    if (list.meta?.api_version !== API_VERSION) fail('conflicts.json: meta.api_version != v1');
    if (list.pagination?.total !== list.data.length) fail('conflicts.json: pagination.total != data.length');
    const seen = new Set();
    for (const c of list.data) {
      for (const f of REQUIRED_FIELDS) {
        if (!(f in c)) fail(`conflicts.json: falta campo "${f}" en ${c?.id}`);
      }
      if (typeof c.id !== 'string' || typeof c.slug !== 'string' || typeof c.name !== 'string') {
        fail(`conflicts.json: tipos id/slug/name inválidos en ${c?.id}`);
      }
      if (typeof c.energy_dimension !== 'boolean') fail(`conflicts.json: energy_dimension no booleano en ${c?.id}`);
      if (c.intensity_level != null && !(Number.isFinite(c.intensity_level) && c.intensity_level >= 1 && c.intensity_level <= 5)) {
        fail(`conflicts.json: intensity_level fuera de rango en ${c?.id}`);
      }
      if (!c.location || !('latitude' in c.location) || !('longitude' in c.location)) {
        fail(`conflicts.json: location inválida en ${c?.id}`);
      }
      if (seen.has(c.slug)) fail(`conflicts.json: slug duplicado "${c.slug}"`);
      seen.add(c.slug);
    }
  }

  if (!map || map.type !== 'FeatureCollection') fail('map.json: type != FeatureCollection');
  else if (!Array.isArray(map.features)) fail('map.json: features no es array');
  else {
    for (const f of map.features) {
      const geomOk = f.type === 'Feature'
        && f.geometry?.type === 'Point'
        && Array.isArray(f.geometry.coordinates)
        && f.geometry.coordinates.length === 2
        && typeof f.properties?.slug === 'string';
      if (!geomOk) { fail(`map.json: feature inválida (${f?.properties?.slug})`); break; }
    }
  }

  return { ok: errors.length === 0, errors };
}

// --- Escritura atómica ------------------------------------------------------

function writeJsonAtomic(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
  renameSync(tmp, path);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// --- Lectura de la DB (todas las filas) -------------------------------------

async function fetchAllFromDb() {
  const { queryLayer } = await import('../src/db.mjs');
  const available = await queryLayer.available().catch(() => false);
  if (!available) {
    throw new Error('DATABASE_URL definida pero la DB no es alcanzable (o falta el paquete "pg"). '
      + 'Instala dependencias con `npm install` y verifica la conexión.');
  }
  // Una sola página amplia: el puente estático materializa el catálogo entero.
  const { items } = await queryLayer.listConflicts({}, {
    page: 1,
    pageSize: 100000,
    sort: 'intensity_level',
    order: 'desc',
  });
  await queryLayer.close().catch(() => {});
  return items;
}

// Intenta leer relaciones enriquecidas por conflicto desde la DB. Devuelve un
// Map<id, relations> o Map vacío si la capa no las expone. Nunca lanza.
async function fetchRelationsMap(items) {
  const rel = new Map();
  try {
    const { queryLayer } = await import('../src/db.mjs');
    if (typeof queryLayer.getConflictRelations !== 'function') return rel;
    for (const item of items) {
      try {
        const r = await queryLayer.getConflictRelations(item.id);
        if (r) rel.set(item.id, r);
      } catch { /* sin relaciones para este id: se degrada a vacío */ }
    }
  } catch { /* sin DB: relaciones vacías */ }
  return rel;
}

// Escribe (o valida en dry-run) un archivo de detalle por conflicto. Devuelve
// { count, errors[] }. Escritura atómica e individual: un archivo corrupto
// nunca deja a medias los demás (se valida en memoria antes de renombrar).
function exportDetails(items, relationsMap, generatedAt, source, { dryRun = false } = {}) {
  const errors = [];
  let count = 0;
  for (const item of items) {
    if (!item || typeof item.id !== 'string') { errors.push(`detail: item sin id`); continue; }
    const detail = buildConflictDetail(item, relationsMap.get(item.id) ?? null, generatedAt, source);
    const check = validateDetail(detail, item.id);
    if (!check.ok) { errors.push(...check.errors); continue; }
    if (!dryRun) {
      writeJsonAtomic(resolve(DETAILS_DIR, `${item.id}.json`), detail);
      // Round-trip: re-lee y valida lo escrito.
      const post = validateDetail(readJson(resolve(DETAILS_DIR, `${item.id}.json`)), item.id);
      if (!post.ok) { errors.push(...post.errors.map((e) => `post-export ${e}`)); continue; }
    }
    count += 1;
  }
  return { count, errors };
}

// --- Orquestación -----------------------------------------------------------

function log(msg) { console.log(`[export-static-bridge] ${msg}`); }

// Modo --from-static (Sprint 11, SIN DB): deriva el mapa enriquecido y el
// detalle por conflicto A PARTIR del propio `conflicts.json` ya validado en
// disco. No inventa relaciones (llegan vacías) y NO reescribe conflicts.json
// ni map.json. Habilita deep-links + navegación offline en GitHub Pages/PWA.
function runFromStatic({ dryRun = false } = {}) {
  if (!existsSync(LIST_PATH)) {
    log('ERROR: no existe conflicts.json en disco. No se modificó ningún archivo.');
    return 1;
  }
  const list = readJson(LIST_PATH);
  const items = Array.isArray(list?.data) ? list.data : [];
  if (items.length === 0) {
    log('ERROR: conflicts.json no tiene data. Se aborta para no escribir vacíos.');
    return 1;
  }
  const base = validateBridge(list, readJson(MAP_PATH));
  if (!base.ok) {
    log('ERROR: el puente base en disco no valida; se aborta la derivación:');
    for (const e of base.errors) log(`  - ${e}`);
    return 1;
  }
  const generatedAt = new Date().toISOString();
  const enriched = buildEnrichedMapPayload(items, generatedAt);
  enriched.meta.source = SOURCE_LABEL_STATIC;
  const preEnr = validateEnrichedMap(enriched);
  if (!preEnr.ok) {
    log('ERROR: mapa enriquecido derivado no valida:');
    for (const e of preEnr.errors) log(`  - ${e}`);
    return 1;
  }
  const details = exportDetails(items, new Map(), generatedAt, SOURCE_LABEL_STATIC, { dryRun });
  if (details.errors.length) {
    log('ERROR: detalle por conflicto derivado no valida (no se modificó nada crítico):');
    for (const e of details.errors) log(`  - ${e}`);
    return 1;
  }
  if (dryRun) {
    log(`--from-static --dry-run: ${enriched.features.length} features enriquecidas, `
      + `${details.count} detalles válidos. NO se escribió nada.`);
    return 0;
  }
  writeJsonAtomic(MAP_ENRICHED_PATH, enriched);
  const postEnr = validateEnrichedMap(readJson(MAP_ENRICHED_PATH));
  if (!postEnr.ok) {
    log('ERROR CRÍTICO: mapa enriquecido en disco no valida tras escribir:');
    for (const e of postEnr.errors) log(`  - ${e}`);
    return 1;
  }
  log(`OK (--from-static): ${enriched.features.length} features → ${MAP_ENRICHED_PATH}`);
  log(`OK (--from-static): ${details.count} detalles → ${DETAILS_DIR}/{id}.json`);
  return 0;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--help') || args.has('-h')) {
    console.log(`Uso: node scripts/export-static-bridge.mjs [--dry-run|--check|--from-static|--with-enriched-map|--with-details]
  (sin flags)         Lee DATABASE_URL, valida y ESCRIBE atómicamente los JSON.
  --dry-run           Lee DB (o --from-static) y valida, pero NO escribe.
  --check             No usa DB: valida los JSON ya presentes en disco (CI).
  --from-static       No usa DB (Sprint 11): deriva map.enriched.json y el detalle
                      por conflicto api/v1/conflicts/{id}.json DESDE conflicts.json.
                      No reescribe conflicts.json ni map.json.
  --with-enriched-map Además del mapa base, genera api/v1/conflicts/active/map.enriched.json
                      (aditivo, no sustituye al base; requiere DB salvo en --check).
  --with-details      Además, exporta el detalle por conflicto api/v1/conflicts/{id}.json
                      (Sprint 11; con relaciones de DB si están disponibles).
`);
    return 0;
  }

  // Modo --from-static (Sprint 11): deriva detalle+mapa enriquecido sin DB.
  if (args.has('--from-static')) {
    return runFromStatic({ dryRun: args.has('--dry-run') });
  }

  // Modo --check: valida el disco, sin DB.
  if (args.has('--check')) {
    if (!existsSync(LIST_PATH) || !existsSync(MAP_PATH)) {
      log('ERROR: no existen los JSON del puente en disco.');
      return 1;
    }
    const { ok, errors } = validateBridge(readJson(LIST_PATH), readJson(MAP_PATH));
    if (!ok) {
      log('VALIDACIÓN FALLIDA del puente en disco:');
      for (const e of errors) log(`  - ${e}`);
      return 1;
    }
    // Si existe el mapa enriquecido en disco, valídalo también (aditivo).
    if (existsSync(MAP_ENRICHED_PATH)) {
      const enr = validateEnrichedMap(readJson(MAP_ENRICHED_PATH));
      if (!enr.ok) {
        log('VALIDACIÓN FALLIDA del mapa enriquecido en disco:');
        for (const e of enr.errors) log(`  - ${e}`);
        return 1;
      }
      log('OK: mapa enriquecido en disco válido.');
    }
    // Detalle por conflicto (Sprint 11): si existen archivos {id}.json, valida
    // que cada uno cumpla el contrato y que su id coincida con la lista.
    const listData = readJson(LIST_PATH)?.data ?? [];
    let detailCount = 0;
    for (const item of listData) {
      const p = resolve(DETAILS_DIR, `${item.id}.json`);
      if (!existsSync(p)) continue;
      const { ok: dok, errors: derr } = validateDetail(readJson(p), item.id);
      if (!dok) {
        log(`VALIDACIÓN FALLIDA del detalle ${item.id}.json:`);
        for (const e of derr) log(`  - ${e}`);
        return 1;
      }
      detailCount += 1;
    }
    if (detailCount) log(`OK: ${detailCount} detalles por conflicto en disco válidos.`);
    log('OK: puente estático en disco válido.');
    return 0;
  }

  // Modos que requieren DB.
  const dryRun = args.has('--dry-run');
  if (!process.env.DATABASE_URL) {
    log('ERROR: DATABASE_URL no está definida. Este script regenera el puente '
      + 'DESDE PostgreSQL. Define DATABASE_URL, o usa --check para validar el '
      + 'JSON existente sin DB. No se modificó ningún archivo.');
    return 1;
  }

  log('Leyendo conflictos desde PostgreSQL…');
  const items = await fetchAllFromDb();
  if (!Array.isArray(items) || items.length === 0) {
    log('ERROR: la DB devolvió 0 conflictos. Se aborta para NO sobreescribir el '
      + 'puente con datos vacíos. No se modificó ningún archivo.');
    return 1;
  }
  log(`Leídos ${items.length} conflictos.`);

  const withEnriched = args.has('--with-enriched-map');
  const withDetails = args.has('--with-details');
  const generatedAt = new Date().toISOString();
  const listPayload = buildConflictsPayload(items, generatedAt);
  const mapPayload = buildActiveMapPayload(items, generatedAt);
  const enrichedPayload = withEnriched ? buildEnrichedMapPayload(items, generatedAt) : null;
  const relationsMap = withDetails ? await fetchRelationsMap(items) : new Map();

  // Validación en memoria ANTES de tocar el disco.
  const pre = validateBridge(listPayload, mapPayload);
  if (!pre.ok) {
    log('ERROR: el contenido generado no pasa la validación de contrato. '
      + 'No se modificó ningún archivo:');
    for (const e of pre.errors) log(`  - ${e}`);
    return 1;
  }
  if (enrichedPayload) {
    const preEnr = validateEnrichedMap(enrichedPayload);
    if (!preEnr.ok) {
      log('ERROR: el mapa enriquecido generado no valida. No se modificó ningún archivo:');
      for (const e of preEnr.errors) log(`  - ${e}`);
      return 1;
    }
  }

  // Detalle por conflicto (validación en memoria antes de escribir nada).
  if (withDetails) {
    const preDetails = exportDetails(items, relationsMap, generatedAt, SOURCE_LABEL, { dryRun: true });
    if (preDetails.errors.length) {
      log('ERROR: el detalle por conflicto no valida. No se modificó ningún archivo:');
      for (const e of preDetails.errors) log(`  - ${e}`);
      return 1;
    }
  }

  if (dryRun) {
    log(`--dry-run: ${listPayload.data.length} conflictos, ${mapPayload.features.length} features`
      + `${enrichedPayload ? `, ${enrichedPayload.features.length} features enriquecidas` : ''}`
      + `${withDetails ? `, ${items.length} detalles` : ''}. `
      + 'Contrato válido. NO se escribió nada.');
    return 0;
  }

  writeJsonAtomic(LIST_PATH, listPayload);
  writeJsonAtomic(MAP_PATH, mapPayload);
  log(`Escrito ${listPayload.data.length} conflictos → ${LIST_PATH}`);
  log(`Escrito ${mapPayload.features.length} features   → ${MAP_PATH}`);
  if (enrichedPayload) {
    writeJsonAtomic(MAP_ENRICHED_PATH, enrichedPayload);
    log(`Escrito ${enrichedPayload.features.length} features   → ${MAP_ENRICHED_PATH}`);
  }
  if (withDetails) {
    const det = exportDetails(items, relationsMap, generatedAt, SOURCE_LABEL);
    if (det.errors.length) {
      log('ERROR CRÍTICO: fallo al escribir/validar detalles:');
      for (const e of det.errors) log(`  - ${e}`);
      return 1;
    }
    log(`Escrito ${det.count} detalles   → ${DETAILS_DIR}/{id}.json`);
  }

  // Validación post-export leyendo de disco (round-trip real).
  const post = validateBridge(readJson(LIST_PATH), readJson(MAP_PATH));
  if (!post.ok) {
    log('ERROR CRÍTICO: el JSON en disco no valida tras escribir:');
    for (const e of post.errors) log(`  - ${e}`);
    return 1;
  }
  if (enrichedPayload) {
    const postEnr = validateEnrichedMap(readJson(MAP_ENRICHED_PATH));
    if (!postEnr.ok) {
      log('ERROR CRÍTICO: el mapa enriquecido en disco no valida tras escribir:');
      for (const e of postEnr.errors) log(`  - ${e}`);
      return 1;
    }
  }
  log(`OK: puente regenerado y validado. generated_at=${generatedAt}`);
  return 0;
}

// Sólo ejecuta main() cuando se invoca como script (no al importar en tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => process.exit(code)).catch((err) => {
    console.error('[export-static-bridge] error no controlado:', err?.message || err);
    process.exit(1);
  });
}
