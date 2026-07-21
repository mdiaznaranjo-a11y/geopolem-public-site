// GEOPÓLEM API v1 — fuente estática (respaldo permanente, Sprint 2 → Sprint 3).
// ---------------------------------------------------------------------------
// Lee el puente estático `api/v1/conflicts.json` (generado desde data.js en el
// Sprint 2) para servir la API SIN base de datos. Es el último eslabón de la
// cadena de fallback: API PostgreSQL → JSON estático → (frontend además tiene
// su propio FOCOS local). Nunca inventa datos; sólo reexpone lo generado.
// ---------------------------------------------------------------------------

import { readFile } from 'node:fs/promises';
import { CONFIG } from './config.mjs';

let cache = null;

async function loadBridge() {
  if (cache) return cache;
  const raw = await readFile(CONFIG.staticConflictsPath, 'utf8');
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed?.data) ? parsed.data : [];
  cache = { items, generatedAt: parsed?.meta?.generated_at || null };
  return cache;
}

// Devuelve todos los ConflictListItem del puente estático.
export async function staticConflicts() {
  const { items } = await loadBridge();
  return items;
}

// Metadatos del puente (para health / trazabilidad).
export async function staticMeta() {
  const { generatedAt } = await loadBridge();
  return { generated_at: generatedAt };
}

// Sólo para tests: limpia la caché en memoria.
export function _resetStaticCache() {
  cache = null;
}
