// GEOPÓLEM — Reporte de salud de contenidos desde JSON estático o API (Sprint 12)
// ---------------------------------------------------------------------------
// Ejecuta:
//   node scripts/content-health-report.mjs                 (lee api/v1/*.json)
//   node scripts/content-health-report.mjs --json          (salida JSON)
//   node scripts/content-health-report.mjs --fail-on-gaps  (exit!=0 si hay
//                                                            carencias de sources)
//   GEOP_HEALTH_API_BASE=http://host node scripts/content-health-report.mjs
//                                                          (lee de una API v1)
//
// Sin dependencias externas. Usa el contrato v1 (lista + detalle por conflicto)
// del puente estático o de una API compatible. Cae limpio si un detalle falta
// (se contabiliza como carencia, no rompe). Reutiliza la lógica PURA de
// content-health.mjs para el cálculo de KPIs/salud.
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeContentHealth, formatContentHealth } from '../content-health.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const LIST_PATH = resolve(REPO_ROOT, 'api/v1/conflicts.json');
const DETAILS_DIR = resolve(REPO_ROOT, 'api/v1/conflicts');

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const failOnGaps = args.has('--fail-on-gaps');
const apiBase = process.env.GEOP_HEALTH_API_BASE || '';

function readJsonFile(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json();
}

// Carga lista + detalles desde el puente estático en disco.
function loadFromStatic() {
  const listDoc = readJsonFile(LIST_PATH);
  const items = Array.isArray(listDoc.data) ? listDoc.data : [];
  const details = {};
  for (const item of items) {
    const id = item.id || item.slug;
    if (!id) continue;
    const path = resolve(DETAILS_DIR, `${id}.json`);
    if (!existsSync(path)) continue; // detalle ausente → lo detecta el cálculo.
    try {
      const doc = readJsonFile(path);
      details[id] = doc.data || doc;
    } catch { /* JSON roto → se trata como ausente */ }
  }
  return { items, details, origin: `static (${LIST_PATH})` };
}

// Carga lista + detalles desde una API v1 compatible.
async function loadFromApi(base) {
  const listDoc = await fetchJson(`${base}/api/v1/conflicts?page_size=100`);
  const items = Array.isArray(listDoc.data) ? listDoc.data : [];
  const details = {};
  for (const item of items) {
    const id = item.id || item.slug;
    if (!id) continue;
    try {
      const doc = await fetchJson(`${base}/api/v1/conflicts/${encodeURIComponent(id)}`);
      details[id] = doc.data || doc;
    } catch { /* detalle inaccesible → ausente */ }
  }
  return { items, details, origin: `api (${base})` };
}

async function main() {
  const { items, details, origin } = apiBase
    ? await loadFromApi(apiBase.replace(/\/+$/, ''))
    : loadFromStatic();

  const report = computeContentHealth(items, details);
  report.origin = origin;

  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatContentHealth(report)}\n\nOrigen: ${origin}\n`);
  }

  if (failOnGaps && report.content_gaps.without_sources_count > 0) {
    process.stderr.write(
      `\n[content-health] ${report.content_gaps.without_sources_count} contenido(s) sin fuentes → fallo solicitado (--fail-on-gaps).\n`,
    );
    process.exit(2);
  }
}

main().catch((err) => {
  process.stderr.write(`[content-health] error: ${err.message}\n`);
  process.exit(1);
});
