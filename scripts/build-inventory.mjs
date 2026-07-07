// GEOPÓLEM — Inventario exacto de conflictos/focos (Sprint 14)
// ---------------------------------------------------------------------------
// Deriva un INVENTARIO versionado y determinista de los conflictos actuales a
// partir del artefacto canónico v1 (`api/v1/conflicts.json`). No inventa datos:
// sólo proyecta id/slug/name/tipo/región/estado/energía y comprueba la presencia
// del detalle canónico y de la semilla verificada por conflicto.
//
// Uso:
//   node scripts/build-inventory.mjs            (escribe data/conflicts.inventory.json)
//   node scripts/build-inventory.mjs --check    (no escribe; exit!=0 si difiere/roto)
//   node scripts/build-inventory.mjs --json     (imprime el inventario por stdout)
//
// NUNCA toca los artefactos canónicos ni la semilla.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const LIST_PATH = resolve(REPO_ROOT, 'api/v1/conflicts.json');
const DETAILS_DIR = resolve(REPO_ROOT, 'api/v1/conflicts');
const VERIFIED_SEED_PATH = resolve(REPO_ROOT, 'data/conflict-relations.verified.seed.json');
const DEMO_SEED_PATH = resolve(REPO_ROOT, 'data/conflict-relations.seed.json');
const OUT_PATH = resolve(REPO_ROOT, 'data/conflicts.inventory.json');

export const INVENTORY_CONTRACT = 'sprint-14-inventory-v1';

const args = new Set(process.argv.slice(2));
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

function labelOf(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'object') return (v.slug || v.label || null);
  return null;
}

// Construye el inventario (PURO respecto de la entrada). Devuelve el documento.
export function buildInventory(list, { hasDetail = () => false, verifiedSeed = null, demoSeed = null } = {}) {
  const items = (list && Array.isArray(list.data)) ? list.data : [];
  const vConf = verifiedSeed && verifiedSeed.conflicts ? verifiedSeed.conflicts : {};
  const dConf = demoSeed && demoSeed.conflicts ? demoSeed.conflicts : {};
  const conflicts = items.map((c) => {
    const id = c.id || c.slug;
    const vEntry = vConf[id];
    const publishableSources = vEntry && Array.isArray(vEntry.sources)
      ? vEntry.sources.filter((s) => s && s.verification === 'verified' && s.demo !== true).length
      : 0;
    return {
      id,
      slug: c.slug || id,
      name: c.name || null,
      conflict_type: labelOf(c.conflict_type),
      conflict_type_label: (c.conflict_type && c.conflict_type.label) || null,
      primary_region: labelOf(c.primary_region),
      primary_region_label: (c.primary_region && c.primary_region.label) || null,
      status: c.status || null,
      intensity_level: Number.isFinite(c.intensity_level) ? c.intensity_level : null,
      energy_dimension: Boolean(c.energy_dimension),
      has_canonical_detail: Boolean(hasDetail(id)),
      in_verified_seed: Boolean(vEntry),
      in_demo_seed: Boolean(dConf[id]),
      verified_sources: publishableSources,
      editorial_status: (vEntry && vEntry.editorial_status) || 'draft',
    };
  });
  return {
    contract: INVENTORY_CONTRACT,
    generated_at: new Date().toISOString(),
    notice: 'Inventario derivado de api/v1/conflicts.json (Sprint 14). Determinista y versionado. No sustituye a los artefactos canónicos.',
    totals: {
      conflicts: conflicts.length,
      with_canonical_detail: conflicts.filter((c) => c.has_canonical_detail).length,
      with_verified_sources: conflicts.filter((c) => c.verified_sources > 0).length,
    },
    conflicts,
  };
}

function writeJsonAtomic(path, obj) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
  renameSync(tmp, path);
}

function main() {
  if (!existsSync(LIST_PATH)) {
    process.stderr.write(`[inventory] no existe ${LIST_PATH}\n`);
    return 1;
  }
  const list = readJson(LIST_PATH);
  const verifiedSeed = existsSync(VERIFIED_SEED_PATH) ? readJson(VERIFIED_SEED_PATH) : null;
  const demoSeed = existsSync(DEMO_SEED_PATH) ? readJson(DEMO_SEED_PATH) : null;
  const hasDetail = (id) => id != null && existsSync(resolve(DETAILS_DIR, `${id}.json`));
  const inventory = buildInventory(list, { hasDetail, verifiedSeed, demoSeed });

  if (args.has('--json')) {
    process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
  }

  if (args.has('--check')) {
    if (!existsSync(OUT_PATH)) {
      process.stderr.write('[inventory] --check: falta data/conflicts.inventory.json\n');
      return 2;
    }
    const current = readJson(OUT_PATH);
    // Compara ignorando generated_at (no determinista).
    const norm = (o) => JSON.stringify({ ...o, generated_at: null });
    if (norm(current) !== norm(inventory)) {
      process.stderr.write('[inventory] --check: el inventario está desactualizado. Regenera con `node scripts/build-inventory.mjs`.\n');
      return 3;
    }
    process.stdout.write('[inventory] --check: OK (inventario al día)\n');
    return 0;
  }

  writeJsonAtomic(OUT_PATH, inventory);
  process.stderr.write(`[inventory] escrito → ${OUT_PATH} (${inventory.totals.conflicts} conflictos)\n`);
  return 0;
}

// Sólo ejecuta si se invoca como script (permite importar buildInventory en tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
