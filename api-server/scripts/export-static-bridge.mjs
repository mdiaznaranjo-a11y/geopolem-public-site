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

const API_VERSION = 'v1';
const SOURCE_LABEL = 'postgres (static bridge, Sprint 5)';

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

// --- Orquestación -----------------------------------------------------------

function log(msg) { console.log(`[export-static-bridge] ${msg}`); }

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--help') || args.has('-h')) {
    console.log(`Uso: node scripts/export-static-bridge.mjs [--dry-run|--check]
  (sin flags)  Lee DATABASE_URL, valida y ESCRIBE atómicamente los JSON.
  --dry-run    Lee DB y valida, pero NO escribe.
  --check      No usa DB: valida los JSON ya presentes en disco (CI).
`);
    return 0;
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

  const generatedAt = new Date().toISOString();
  const listPayload = buildConflictsPayload(items, generatedAt);
  const mapPayload = buildActiveMapPayload(items, generatedAt);

  // Validación en memoria ANTES de tocar el disco.
  const pre = validateBridge(listPayload, mapPayload);
  if (!pre.ok) {
    log('ERROR: el contenido generado no pasa la validación de contrato. '
      + 'No se modificó ningún archivo:');
    for (const e of pre.errors) log(`  - ${e}`);
    return 1;
  }

  if (dryRun) {
    log(`--dry-run: ${listPayload.data.length} conflictos, ${mapPayload.features.length} features. `
      + 'Contrato válido. NO se escribió nada.');
    return 0;
  }

  writeJsonAtomic(LIST_PATH, listPayload);
  writeJsonAtomic(MAP_PATH, mapPayload);
  log(`Escrito ${listPayload.data.length} conflictos → ${LIST_PATH}`);
  log(`Escrito ${mapPayload.features.length} features   → ${MAP_PATH}`);

  // Validación post-export leyendo de disco (round-trip real).
  const post = validateBridge(readJson(LIST_PATH), readJson(MAP_PATH));
  if (!post.ok) {
    log('ERROR CRÍTICO: el JSON en disco no valida tras escribir:');
    for (const e of post.errors) log(`  - ${e}`);
    return 1;
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
