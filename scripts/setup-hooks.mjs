// GEOPÓLEM (Sprint 18) — instalador OPCIONAL y NO destructivo de hooks de git.
// ---------------------------------------------------------------------------
// Instala/verifica un hook pre-commit que ejecuta `verify:clean-tree` (garantía
// NO-WRITE/NO-DIFF) para atajar diffs accidentales antes del commit. Es OPT-IN:
// el usuario decide instalarlo; nada se instala automáticamente.
//
// Sin dependencias externas (sólo Node + git). NO sobrescribe un hook ajeno
// preexistente salvo --force: si detecta un pre-commit que NO es el nuestro,
// lo respalda a pre-commit.local antes de instalar (no se pierde trabajo).
//
// MODOS:
//   (sin modo) / --check   informa el estado (instalado / ausente / ajeno). NO escribe.
//   --install              instala el hook (idempotente).
//   --uninstall            elimina el hook gestionado por GEOPÓLEM (restaura backup).
//
// Flags:
//   --force                sobrescribe un hook ajeno (previo respaldo).
//   --json                 salida JSON.
//
// Entorno (aislamiento de pruebas):
//   GEOP_HOOKS_DIR   directorio de hooks destino (por defecto: `git rev-parse
//                    --git-path hooks`). Permite instalar en un tempdir en tests.
// ---------------------------------------------------------------------------

import {
  readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync, copyFileSync, rmSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const TEMPLATE = resolve(REPO_ROOT, '.githooks/pre-commit');
const MANAGED_MARKER = 'GEOPOLEM-MANAGED-HOOK';

function resolveHooksDir() {
  if (process.env.GEOP_HOOKS_DIR) return resolve(process.env.GEOP_HOOKS_DIR);
  try {
    const p = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
    return resolve(REPO_ROOT, p);
  } catch {
    return null;
  }
}

function isManaged(content) {
  return typeof content === 'string' && content.includes(MANAGED_MARKER);
}

// Estado del hook pre-commit destino sin modificar nada.
export function inspectHook(hooksDir) {
  const hookPath = hooksDir ? join(hooksDir, 'pre-commit') : null;
  if (!hookPath || !existsSync(hookPath)) {
    return { installed: false, managed: false, foreign: false, hook_path: hookPath };
  }
  const content = readFileSync(hookPath, 'utf8');
  const managed = isManaged(content);
  return { installed: true, managed, foreign: !managed, hook_path: hookPath };
}

export function installHook({ hooksDir, force = false } = {}) {
  if (!hooksDir) return { ok: false, action: 'install', reason: 'no se pudo resolver el directorio de hooks (¿git disponible?)' };
  if (!existsSync(TEMPLATE)) return { ok: false, action: 'install', reason: `falta la plantilla ${TEMPLATE}` };
  mkdirSync(hooksDir, { recursive: true });
  const hookPath = join(hooksDir, 'pre-commit');
  const state = inspectHook(hooksDir);

  // Hook ajeno preexistente: respaldar antes de sobrescribir, y sólo con --force.
  let backedUp = null;
  if (state.installed && state.foreign) {
    if (!force) {
      return {
        ok: false, action: 'install', reason: 'existe un pre-commit ajeno; usa --force para respaldarlo e instalar',
        hook_path: hookPath,
      };
    }
    const backup = `${hookPath}.local`;
    copyFileSync(hookPath, backup);
    backedUp = backup;
  }

  const content = readFileSync(TEMPLATE, 'utf8');
  writeFileSync(hookPath, content, 'utf8');
  chmodSync(hookPath, 0o755);
  return {
    ok: true, action: 'install', installed: true, managed: true, hook_path: hookPath,
    backed_up: backedUp, idempotent: state.managed,
  };
}

export function uninstallHook({ hooksDir } = {}) {
  if (!hooksDir) return { ok: false, action: 'uninstall', reason: 'no se pudo resolver el directorio de hooks' };
  const hookPath = join(hooksDir, 'pre-commit');
  const state = inspectHook(hooksDir);
  if (!state.installed) return { ok: true, action: 'uninstall', removed: false, reason: 'no había hook instalado' };
  if (state.foreign) return { ok: false, action: 'uninstall', removed: false, reason: 'el pre-commit no está gestionado por GEOPÓLEM; no se toca' };
  rmSync(hookPath, { force: true });
  // Restaura un backup previo si existe.
  const backup = `${hookPath}.local`;
  let restored = false;
  if (existsSync(backup)) { copyFileSync(backup, hookPath); chmodSync(hookPath, 0o755); rmSync(backup, { force: true }); restored = true; }
  return { ok: true, action: 'uninstall', removed: true, restored_backup: restored };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const asJson = args.has('--json');
  const hooksDir = resolveHooksDir();
  let result;

  if (args.has('--install')) result = installHook({ hooksDir, force: args.has('--force') });
  else if (args.has('--uninstall')) result = uninstallHook({ hooksDir });
  else result = { ok: true, action: 'check', ...inspectHook(hooksDir) };

  if (asJson) { process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); return result.ok ? 0 : 1; }

  const L = [`GEOPÓLEM — setup-hooks (${result.action})`, '='.repeat(48)];
  if (result.action === 'check') {
    L.push(`Ruta del hook:       ${result.hook_path || '(desconocido)'}`);
    L.push(`Instalado:           ${result.installed ? 'sí' : 'no'}`);
    L.push(`Gestionado GEOPÓLEM: ${result.managed ? 'sí' : 'no'}`);
    if (result.foreign) L.push('Aviso: hay un pre-commit ajeno (usa --install --force para respaldarlo).');
    if (!result.installed) L.push('', 'Para instalar (opcional): node scripts/setup-hooks.mjs --install');
  } else {
    L.push(`Resultado: ${result.ok ? 'OK' : 'FALLÓ'}`);
    for (const [k, v] of Object.entries(result)) {
      if (['ok', 'action'].includes(k)) continue;
      L.push(`  ${k}: ${v}`);
    }
  }
  process.stdout.write(`${L.join('\n')}\n`);
  return result.ok ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
