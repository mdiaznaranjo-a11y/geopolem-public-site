// GEOPÓLEM (Sprint 18) — CLI de respaldo/restauración de canónicos de producción.
// ---------------------------------------------------------------------------
// PREPARA el rollback de los artefactos canónicos de producción para una futura
// promoción autorizada. NO ejecuta ninguna promoción ni publica producción: sólo
// copia (respaldo) y restaura archivos ya existentes, con verificación de
// integridad sha256. La raíz es sobrescribible por entorno (GEOP_CANONICAL_ROOT)
// para aislar pruebas/simulacros en un tempdir o fixtures.
//
// MODOS (mutuamente excluyentes):
//   --backup     copia los canónicos a .canonical-rollback/ + manifest.json
//   --restore    restaura los canónicos desde .canonical-rollback/
//   --verify     comprueba que los canónicos actuales coinciden con el manifiesto
//   (sin modo)   lista el plan de respaldo (qué canónicos existen). NO escribe.
//
// Flags:
//   --json       salida JSON
//
// Entorno:
//   GEOP_CANONICAL_ROOT   raíz alternativa (tempdir/fixtures) para aislar pruebas.
// ---------------------------------------------------------------------------

import {
  readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, copyFileSync, readdirSync, rmSync,
} from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  planCanonicalBackup, sha256, diffManifests,
  CANONICAL_ROLLBACK_DIR, CANONICAL_MANIFEST, ROLLBACK_CONTRACT,
} from '../canonical-rollback.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');

// Raíz de canónicos (sobrescribible por entorno para aislar pruebas/simulacros).
const ROOT = process.env.GEOP_CANONICAL_ROOT ? resolve(process.env.GEOP_CANONICAL_ROOT) : REPO_ROOT;
const BACKUP_ROOT = resolve(ROOT, CANONICAL_ROLLBACK_DIR);
const MANIFEST_PATH = resolve(BACKUP_ROOT, CANONICAL_MANIFEST);

const abs = (rel) => resolve(ROOT, rel);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

function writeJsonAtomic(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
  renameSync(tmp, path);
}

function copyAtomic(src, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  const tmp = `${dest}.tmp`;
  copyFileSync(src, tmp);
  renameSync(tmp, dest);
}

// Lista los ids de conflicto desde la lista canónica (para expandir detalles).
export function conflictIdsFromRoot(root = ROOT) {
  const listPath = resolve(root, 'api/v1/conflicts.json');
  if (!existsSync(listPath)) return [];
  try {
    const list = JSON.parse(readFileSync(listPath, 'utf8'));
    return (list.data || []).map((c) => c && (c.id || c.slug)).filter(Boolean);
  } catch { return []; }
}

function buildPlan() {
  return planCanonicalBackup({
    conflictIds: conflictIdsFromRoot(ROOT),
    fileExists: (rel) => existsSync(abs(rel)),
  });
}

// Respalda los canónicos presentes → .canonical-rollback/ + manifest con sha256.
export function doBackup() {
  const plan = buildPlan();
  const checksums = {};
  let copied = 0;
  for (const { path: rel } of plan.files) {
    const src = abs(rel);
    if (!existsSync(src)) continue;
    const buf = readFileSync(src);
    checksums[rel] = sha256(buf);
    copyAtomic(src, join(BACKUP_ROOT, rel));
    copied += 1;
  }
  const manifest = {
    contract: ROLLBACK_CONTRACT,
    created_at: new Date().toISOString(),
    root: relative(REPO_ROOT, ROOT) || '.',
    count: copied,
    checksums,
  };
  writeJsonAtomic(MANIFEST_PATH, manifest);
  return { ok: true, action: 'backup', copied, manifest_path: relative(ROOT, MANIFEST_PATH), files: Object.keys(checksums) };
}

// Restaura los canónicos desde el respaldo y verifica integridad contra manifest.
export function doRestore() {
  if (!existsSync(MANIFEST_PATH)) {
    return { ok: false, action: 'restore', reason: 'no hay manifiesto de respaldo (.canonical-rollback/manifest.json)' };
  }
  const manifest = readJson(MANIFEST_PATH);
  const checksums = manifest.checksums || {};
  const restored = [];
  const mismatch = [];
  for (const rel of Object.keys(checksums)) {
    const backupFile = join(BACKUP_ROOT, rel);
    if (!existsSync(backupFile)) { mismatch.push(rel); continue; }
    copyAtomic(backupFile, abs(rel));
    const after = sha256(readFileSync(abs(rel)));
    if (after !== checksums[rel]) mismatch.push(rel);
    else restored.push(rel);
  }
  return { ok: mismatch.length === 0, action: 'restore', restored: restored.length, mismatch };
}

// Verifica que los canónicos actuales coinciden con el manifiesto respaldado.
export function doVerify() {
  if (!existsSync(MANIFEST_PATH)) {
    return { ok: false, action: 'verify', reason: 'no hay manifiesto de respaldo que verificar' };
  }
  const manifest = readJson(MANIFEST_PATH);
  const expected = manifest.checksums || {};
  const actual = {};
  for (const rel of Object.keys(expected)) {
    if (existsSync(abs(rel))) actual[rel] = sha256(readFileSync(abs(rel)));
  }
  const diff = diffManifests(expected, actual);
  return { ok: diff.ok, action: 'verify', ...diff };
}

/* --------------------------------------------------------------------------
   simulateRollbackRoundtrip: prueba de humo AISLADA del rollback de canónicos.
   Crea un workdir temporal con fixtures mínimas, respalda, MUTA los canónicos,
   restaura y verifica que el contenido volvió a su estado original. No toca el
   repo real: opera enteramente dentro de `workDir`. Devuelve un informe.

   deps IO inyectadas para no requerir esta misma raíz:
     workDir   — directorio de trabajo (tempdir) donde viven fixtures + respaldo
     fixtures  — { relPath: contenidoString }  (por defecto una fixture mínima)
-------------------------------------------------------------------------- */
export function simulateRollbackRoundtrip({ workDir, fixtures } = {}) {
  if (!workDir) throw new Error('simulateRollbackRoundtrip requiere workDir (tempdir)');
  const fx = fixtures || {
    'api/v1/conflicts.json': `${JSON.stringify({ data: [{ id: 'demo-sim', slug: 'demo-sim', name: 'Simulacro' }] }, null, 2)}\n`,
    'api/v1/conflicts/demo-sim.json': `${JSON.stringify({ data: { id: 'demo-sim', name: 'Simulacro' } }, null, 2)}\n`,
  };
  const wabs = (rel) => resolve(workDir, rel);
  const backupRoot = resolve(workDir, CANONICAL_ROLLBACK_DIR);
  const manifestPath = resolve(backupRoot, CANONICAL_MANIFEST);

  // 1) Escribe fixtures (estado "canónico" original).
  const originalHashes = {};
  for (const [rel, content] of Object.entries(fx)) {
    mkdirSync(dirname(wabs(rel)), { recursive: true });
    writeFileSync(wabs(rel), content, 'utf8');
    originalHashes[rel] = sha256(Buffer.from(content));
  }

  // 2) Respaldo.
  const checksums = {};
  for (const rel of Object.keys(fx)) {
    const buf = readFileSync(wabs(rel));
    checksums[rel] = sha256(buf);
    const dest = join(backupRoot, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(wabs(rel), dest);
  }
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify({ contract: ROLLBACK_CONTRACT, checksums }, null, 2)}\n`, 'utf8');

  // 3) MUTA los canónicos (simula una promoción fallida que los corrompe).
  for (const rel of Object.keys(fx)) {
    writeFileSync(wabs(rel), '{"corrupted":true}\n', 'utf8');
  }
  const mutatedOk = Object.keys(fx).every((rel) => sha256(readFileSync(wabs(rel))) !== originalHashes[rel]);

  // 4) Restaura desde el respaldo.
  for (const rel of Object.keys(checksums)) {
    copyFileSync(join(backupRoot, rel), wabs(rel));
  }

  // 5) Verifica que volvimos al estado original.
  const restoredHashes = {};
  for (const rel of Object.keys(fx)) restoredHashes[rel] = sha256(readFileSync(wabs(rel)));
  const diff = diffManifests(originalHashes, restoredHashes);

  return {
    ok: mutatedOk && diff.ok,
    files: Object.keys(fx).length,
    mutated_detected: mutatedOk,
    restored_ok: diff.ok,
    mismatched: diff.mismatched,
  };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const asJson = args.has('--json');
  let result;
  if (args.has('--backup')) result = doBackup();
  else if (args.has('--restore')) result = doRestore();
  else if (args.has('--verify')) result = doVerify();
  else result = { ok: true, action: 'plan', ...buildPlan() };

  if (asJson) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else {
    const L = [`GEOPÓLEM — Canonical rollback (${result.action})`, '='.repeat(56)];
    if (result.action === 'plan') {
      L.push(`Canónicos presentes: ${result.count}`);
      for (const f of result.files) L.push(`  ${f.present ? '•' : '×'} ${f.path}`);
      L.push('', 'NOTA: este comando NO respalda ni publica. Usa --backup / --restore / --verify.');
    } else {
      L.push(`Resultado: ${result.ok ? 'OK' : 'FALLÓ'}`);
      for (const [k, v] of Object.entries(result)) {
        if (['ok', 'action'].includes(k)) continue;
        L.push(`  ${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : v}`);
      }
    }
    process.stdout.write(`${L.join('\n')}\n`);
  }
  return result.ok ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
