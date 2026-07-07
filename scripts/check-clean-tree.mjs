// GEOPÓLEM (Sprint 17) — Garantía NO-WRITE / NO-DIFF de las validaciones.
// ---------------------------------------------------------------------------
// Ejecuta los comandos de VALIDACIÓN (no de escritura) que deben ser inocuos
// sobre el árbol Git y comprueba, vía `git status --porcelain`, que NINGUNO deja
// diffs en archivos versionados. Diseñado para CI: exit 0 si el árbol queda
// limpio; exit 1 si alguna validación ensucia el repo (regresión del bug del
// Sprint 15/16 en el que la validación reescribía `generated_at`).
//
// Sólo ejecuta comandos declaradamente read-only:
//   • promote:check                (gate, sin escritura)
//   • promote dry-run              (resumen en memoria, sin escritura)
//   • validate:staging-artifacts   (validación E2E de consumo, sin escritura)
//
// NUNCA ejecuta --write-staging ni promociones. Requiere `git` disponible; si no
// lo está, aborta con mensaje claro (exit 2) sin dar un falso OK.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const API_DIR = resolve(REPO_ROOT, 'api-server');

function log(msg) { console.log(`[check-clean-tree] ${msg}`); }

function git(argsArr) {
  return execFileSync('git', argsArr, { cwd: REPO_ROOT, encoding: 'utf8' });
}

// Estado porcelain filtrado a archivos versionados (ignora untracked '??').
function trackedStatus() {
  const out = git(['status', '--porcelain', '--untracked-files=no']);
  return out.split('\n').map((l) => l.trim()).filter(Boolean);
}

const CHECKS = [
  { name: 'promote:check', cmd: ['node', '../scripts/promote-canonical-staging.mjs', '--check'] },
  { name: 'promote dry-run', cmd: ['node', '../scripts/promote-canonical-staging.mjs', '--dry-run', '--json'] },
  { name: 'validate:staging-artifacts', cmd: ['node', '../scripts/validate-staging-artifacts.mjs'] },
  // Sprint 20: gobernanza editorial (read-only): evidencia y go/no-go.
  { name: 'evidence:build --check', cmd: ['node', '../scripts/build-evidence-packages.mjs', '--check'] },
  { name: 'go-no-go --check', cmd: ['node', '../scripts/build-go-no-go.mjs', '--check'] },
  // Sprint 21: resolución técnica de bloqueos (read-only): cola resuelta + evidencia + go/no-go.
  { name: 'resolution:build --check', cmd: ['node', '../scripts/build-blocker-resolution.mjs', '--check'] },
];

function main() {
  try {
    git(['rev-parse', '--is-inside-work-tree']);
  } catch {
    log('ERROR: git no disponible o no es un repositorio; no puedo garantizar NO-DIFF.');
    return 2;
  }

  const before = trackedStatus();
  for (const c of CHECKS) {
    try {
      execFileSync(c.cmd[0], c.cmd.slice(1), { cwd: API_DIR, stdio: 'ignore' });
      log(`ejecutado (read-only): ${c.name}`);
    } catch (e) {
      // --check devuelve exit!=0 si hay bloqueos editoriales; eso NO es "ensuciar
      // el árbol". Lo registramos pero seguimos comprobando limpieza.
      log(`aviso: "${c.name}" devolvió exit ${e.status ?? '?'} (no implica escritura).`);
    }
  }
  const after = trackedStatus();

  const beforeSet = new Set(before);
  const newDiffs = after.filter((l) => !beforeSet.has(l));

  if (newDiffs.length) {
    log(`FALLÓ: las validaciones dejaron ${newDiffs.length} cambio(s) en archivos versionados:`);
    for (const d of newDiffs) log(`  ${d}`);
    log('Las validaciones DEBEN ser no-write/no-diff. Revisa que ningún check escriba artefactos.');
    return 1;
  }

  log(`OK: ${CHECKS.length} validación/es ejecutada/s; árbol Git sin diffs nuevos en archivos versionados.`);
  return 0;
}

process.exit(main());
