// GEOPÓLEM (Sprint 19) — QA funcional del RC (contratos de ruta + PWA/offline).
// ---------------------------------------------------------------------------
// Ejecuta la QA funcional del Release Candidate SIN navegador ni red: valida los
// contratos de las rutas clave (home, mapa, ficha, deep-link, filtros) y la
// elegibilidad PWA/offline consumiendo los artefactos de STAGING referenciados
// por el RC. Diseñado para CI: exit 0 si todo pasa; exit 1 si algún contrato falla.
//
// LIMITACIÓN documentada: esta QA valida CONTRATOS (datos consumibles, rutas,
// caché), no PÍXELES. El QA visual con navegador (Playwright) se ejecuta aparte
// con scripts/qa-visual-rc.mjs y es OPT-IN (no añade dependencias al proyecto).
//
// Flags: --json (imprime el reporte JSON; por defecto imprime texto).
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runQaContracts } from '../qa-rc.mjs';
import {
  stagingBundlePath, stagingDetailPath, stagingMapPath, stagingCoveragePath,
} from '../staging-consume.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const abs = (rel) => resolve(REPO_ROOT, rel);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

function main() {
  const args = new Set(process.argv.slice(2));
  const bundle = readJson(abs(stagingBundlePath()));
  const ids = bundle && bundle.data && typeof bundle.data === 'object' ? Object.keys(bundle.data) : [];
  // generated_at determinista: heredado del coverage-report de staging.
  let generatedAt = null;
  try { generatedAt = readJson(abs(stagingCoveragePath())).generated_at || null; } catch { /* opcional */ }

  return runQaContracts({
    ids,
    generatedAt,
    fileExists: (rel) => existsSync(abs(rel)),
    loadMap: () => readJson(abs(stagingMapPath())),
    loadStaging: (id) => readJson(abs(stagingDetailPath(id))),
  }).then((rep) => {
    if (args.has('--json')) {
      process.stdout.write(`${JSON.stringify(rep, null, 2)}\n`);
    } else {
      process.stdout.write(`GEOPÓLEM — QA funcional del RC (Sprint 19) — ${rep.ok ? 'OK' : 'FALLÓ'} (${rep.summary.passed}/${rep.summary.total})\n`);
      for (const r of rep.routes) {
        const failed = r.checks.filter((c) => !c.ok);
        process.stdout.write(`  ${r.ok ? '✓' : '✗'} ${r.route} (${r.checks.length} check/s)\n`);
        for (const f of failed) process.stdout.write(`      ✗ ${f.name}: ${f.reason}\n`);
      }
      process.stdout.write('  (QA de contratos, sin navegador; visual opt-in vía qa-visual-rc.mjs)\n');
    }
    return rep.ok ? 0 : 1;
  });
}

main().then((code) => process.exit(code)).catch((err) => {
  process.stderr.write(`[qa-rc-routes] error no controlado: ${err?.message || err}\n`);
  process.exit(1);
});
