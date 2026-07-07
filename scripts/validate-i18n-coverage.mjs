// GEOPÓLEM — Validador de cobertura i18n ES/EN (Sprint 28)
// ---------------------------------------------------------------------------
// Verifica, SIN base de datos ni red, que la internacionalización de los
// materiales docentes clave sea COMPLETA y COHERENTE:
//   • El locale base (`es`, canónico) define el conjunto de claves de cada
//     espacio de nombres del manifiesto.
//   • Cada locale objetivo (p. ej. `en`) DEBE cubrir exactamente esas claves:
//       - `missing`  — clave presente en base y ausente en el objetivo (error).
//       - `extra`    — clave presente en el objetivo y ausente en base (error).
//       - `empty`    — clave presente pero con valor vacío (error).
//   • Ningún fichero de traducción debe contener claves con aspecto de PII.
//   • No activa producción ni contiene secretos.
//
// Patrón ESCALABLE: descubre namespaces y locales desde el manifiesto; añadir un
// idioma o un espacio de nombres no requiere tocar este validador. El manifiesto
// y el contrato esperado son parametrizables, de modo que el Sprint 29 puede
// validar un manifiesto AMPLIADO (más paquetes clave) reutilizando este motor.
//
// Uso:
//   node scripts/validate-i18n-coverage.mjs            (PASS/FAIL + exit)
//   node scripts/validate-i18n-coverage.mjs --json      (informe JSON)
//   node scripts/validate-i18n-coverage.mjs --manifest=<rel> --contract=<id>
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPIIKeys } from './score-rubric.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

export const I18N_CONTRACT = 'sprint-28-education-i18n-v1';
const I18N_DIR = 'docs/education/i18n';
const MANIFEST = `${I18N_DIR}/i18n.manifest.json`;

const abs = (rel) => resolve(REPO_ROOT, rel);

// Aplana un objeto a claves con notación de puntos, ignorando metadatos de
// nivel superior (locale/namespace) que no forman parte del contenido traducible.
export function flattenKeys(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (!prefix && (k === 'locale' || k === 'namespace')) continue;
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flattenKeys(v, key));
    else out[key] = v;
  }
  return out;
}

// Devuelve sólo el contenido traducible (excluye metadatos locale/namespace),
// para no confundir el detector de PII con la clave literal "namespace".
function contentOnly(obj) {
  const { locale, namespace, ...rest } = obj || {};
  return rest;
}

// Validación PURA de un namespace: compara base vs objetivo.
export function diffNamespace(baseObj, targetObj) {
  const base = flattenKeys(baseObj);
  const target = flattenKeys(targetObj);
  const baseKeys = Object.keys(base);
  const targetKeys = new Set(Object.keys(target));
  const missing = baseKeys.filter((k) => !targetKeys.has(k)).sort();
  const extra = [...targetKeys].filter((k) => !(k in base)).sort();
  const empty = Object.keys(target)
    .filter((k) => k in base && (target[k] == null || String(target[k]).trim() === ''))
    .sort();
  const covered = baseKeys.filter((k) => targetKeys.has(k)).length;
  return { total: baseKeys.length, covered, missing, extra, empty };
}

export function validateI18n({ repoRoot = REPO_ROOT, manifestRel = MANIFEST, expectedContract = I18N_CONTRACT } = {}) {
  const absR = (rel) => resolve(repoRoot, rel);
  const manifest = JSON.parse(readFileSync(absR(manifestRel), 'utf8'));
  const i18nDir = dirname(manifestRel);
  const errors = [];
  if (manifest.contract !== expectedContract) errors.push(`contrato inesperado en manifiesto: ${manifest.contract}`);
  const p = manifest.production || {};
  if (p.is_production !== false || p.activates_production_gate !== false || p.contains_secrets !== false) {
    errors.push('el manifiesto i18n no debe activar producción ni declarar secretos');
  }

  const base = manifest.base_locale;
  const targets = (manifest.locales || []).filter((l) => l !== base);
  const namespaces = [];
  let totalKeys = 0;
  let totalCovered = 0;

  for (const ns of manifest.namespaces || []) {
    const basePathRel = `${i18nDir}/${ns.files[base]}`;
    if (!existsSync(absR(basePathRel))) {
      errors.push(`namespace "${ns.id}": falta el fichero base ${basePathRel}`);
      continue;
    }
    const baseObj = JSON.parse(readFileSync(absR(basePathRel), 'utf8'));
    const piiBase = findPIIKeys(contentOnly(baseObj));
    if (piiBase.length) errors.push(`namespace "${ns.id}" (${base}): claves con aspecto de PII: ${piiBase.join(', ')}`);

    const perLocale = [];
    for (const loc of targets) {
      const rel = ns.files[loc] ? `${i18nDir}/${ns.files[loc]}` : null;
      if (!rel || !existsSync(absR(rel))) {
        errors.push(`namespace "${ns.id}": falta el fichero de locale ${loc} (${rel ?? '—'})`);
        perLocale.push({ locale: loc, file: rel, total: 0, covered: 0, missing: ['<file-missing>'], extra: [], empty: [] });
        continue;
      }
      const targetObj = JSON.parse(readFileSync(absR(rel), 'utf8'));
      const piiT = findPIIKeys(contentOnly(targetObj));
      if (piiT.length) errors.push(`namespace "${ns.id}" (${loc}): claves con aspecto de PII: ${piiT.join(', ')}`);
      const d = diffNamespace(baseObj, targetObj);
      totalKeys += d.total;
      totalCovered += d.covered;
      if (d.missing.length) errors.push(`namespace "${ns.id}" (${loc}): claves ausentes: ${d.missing.join(', ')}`);
      if (d.extra.length) errors.push(`namespace "${ns.id}" (${loc}): claves sobrantes: ${d.extra.join(', ')}`);
      if (d.empty.length) errors.push(`namespace "${ns.id}" (${loc}): claves vacías: ${d.empty.join(', ')}`);
      perLocale.push({ locale: loc, file: rel, ...d });
    }
    namespaces.push({ id: ns.id, base_file: basePathRel, locales: perLocale });
  }

  const coverage = totalKeys ? Math.round((totalCovered / totalKeys) * 10000) / 100 : 100;
  return {
    contract: expectedContract,
    production: { is_production: false, activates_production_gate: false, contains_secrets: false },
    base_locale: base,
    target_locales: targets,
    coverage_percentage: coverage,
    ok: errors.length === 0,
    errors,
    namespaces,
  };
}

// --- CLI --------------------------------------------------------------------
function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const opts = {};
  for (const a of argv) {
    if (a.startsWith('--') && a.includes('=')) {
      const [k, v] = a.slice(2).split('=');
      opts[k] = v;
    }
  }
  const report = validateI18n({
    manifestRel: opts.manifest,
    expectedContract: opts.contract,
  });
  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.ok ? 0 : 1;
  }
  for (const ns of report.namespaces) {
    for (const l of ns.locales) {
      const status = l.missing.length || l.extra.length || l.empty.length ? 'FAIL' : 'PASS';
      console.log(`${status.padEnd(5)} ${ns.id} [${l.locale}] cubiertas ${l.covered}/${l.total}`);
    }
  }
  if (report.errors.length) {
    console.log('');
    for (const e of report.errors) console.log(`  - ${e}`);
  }
  console.log(`\nCobertura i18n: ${report.coverage_percentage}% · ${report.ok ? 'OK' : 'FALLOS'}`);
  return report.ok ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
