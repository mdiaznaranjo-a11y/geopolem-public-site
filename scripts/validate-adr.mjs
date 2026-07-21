// GEOPÓLEM — Validador de ADRs educativos (Sprint 28)
// ---------------------------------------------------------------------------
// Verifica que las decisiones técnicas (Architecture Decision Records) del área
// educativa (docs/education/adr/*.md) sean completas, coherentes y sin producción:
//   • Frontmatter con claves requeridas: id, title, status, date, decision.
//   • `status` en {proposed, accepted, superseded, rejected}.
//   • El bloque `production` declara is_production/activates_production_gate/
//     contains_secrets todos en false.
//   • Presencia de las SECCIONES requeridas (Estado, Contexto, Opciones,
//     Decisión, Consecuencias).
//   • No introduce dependencias propietarias en la decisión adoptada.
//
// NO ejecuta nada externo; sólo lee ficheros versionados. Determinista.
//
// Uso:
//   node scripts/validate-adr.mjs            (PASS/FAIL + exit)
//   node scripts/validate-adr.mjs --json      (informe JSON)
// ---------------------------------------------------------------------------

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

export const ADR_CONTRACT = 'sprint-28-education-adr-v1';
const ADR_DIR = 'docs/education/adr';

const REQUIRED_FRONTMATTER = ['id', 'title', 'status', 'date', 'decision'];
const VALID_STATUS = new Set(['proposed', 'accepted', 'superseded', 'rejected']);
const REQUIRED_SECTIONS = ['## Estado', '## Contexto', '## Opciones', '## Decisión', '## Consecuencias'];

// Extrae el bloque de frontmatter (--- ... ---) y el cuerpo. Parseo simple
// key: value de nivel superior; devuelve también el texto crudo del bloque.
export function parseAdr(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { frontmatter: {}, raw: '', body: text, hasFrontmatter: false };
  const raw = m[1];
  const body = m[2];
  const fm = {};
  for (const line of raw.split('\n')) {
    const mm = line.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
    if (mm) fm[mm[1]] = mm[2].trim();
  }
  return { frontmatter: fm, raw, body, hasFrontmatter: true };
}

// Validación PURA de un ADR ya leído.
export function validateAdr(text) {
  const errors = [];
  const { frontmatter, raw, body, hasFrontmatter } = parseAdr(text);
  if (!hasFrontmatter) {
    errors.push('sin frontmatter YAML (--- ... ---)');
    return { frontmatter, errors };
  }
  for (const k of REQUIRED_FRONTMATTER) {
    if (!frontmatter[k]) errors.push(`falta la clave de frontmatter "${k}"`);
  }
  if (frontmatter.status && !VALID_STATUS.has(frontmatter.status)) {
    errors.push(`status inválido: "${frontmatter.status}" (usa: ${[...VALID_STATUS].join(', ')})`);
  }
  // Bloque production: todos los flags en false.
  const prod = raw.match(/production:\s*\{([^}]*)\}/);
  if (!prod) {
    errors.push('falta el bloque "production" en el frontmatter');
  } else {
    const p = prod[1];
    for (const flag of ['is_production', 'activates_production_gate', 'contains_secrets']) {
      if (!new RegExp(`${flag}:\\s*false`).test(p)) errors.push(`production.${flag} debe ser false`);
    }
  }
  for (const s of REQUIRED_SECTIONS) {
    if (!body.includes(s)) errors.push(`falta la sección "${s}"`);
  }
  // La decisión adoptada no debe introducir dependencia propietaria.
  if (/dependencia propietaria/i.test(body) && !/sin dependencia propietaria|ninguna|no propietari/i.test(body)) {
    errors.push('la decisión parece introducir dependencia propietaria');
  }
  return { frontmatter, errors };
}

export function validateAllAdrs({ repoRoot = REPO_ROOT } = {}) {
  const dir = resolve(repoRoot, ADR_DIR);
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => /^ADR-.*\.md$/.test(f)).sort() : [];
  const results = files.map((f) => {
    const text = readFileSync(resolve(dir, f), 'utf8');
    const { frontmatter, errors } = validateAdr(text);
    return { file: `${ADR_DIR}/${f}`, id: frontmatter.id || null, status: frontmatter.status || null, decision: frontmatter.decision || null, errors };
  });
  const errorCount = results.reduce((s, r) => s + r.errors.length, 0);
  return {
    contract: ADR_CONTRACT,
    production: { is_production: false, activates_production_gate: false, contains_secrets: false },
    totals: { adrs: files.length, errors: errorCount },
    ok: errorCount === 0 && files.length > 0,
    results,
  };
}

// --- CLI --------------------------------------------------------------------
function main() {
  const json = process.argv.slice(2).includes('--json');
  const report = validateAllAdrs();
  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.ok ? 0 : 1;
  }
  for (const r of report.results) {
    if (r.errors.length) {
      console.log(`FAIL  ${r.file}`);
      for (const e of r.errors) console.log(`      - ${e}`);
    } else {
      console.log(`PASS  ${r.file} (${r.id}, ${r.status}, decision=${r.decision})`);
    }
  }
  console.log(`\nADRs: ${report.totals.adrs} · errores: ${report.totals.errors} · ${report.ok ? 'OK' : 'FALLOS'}`);
  return report.ok ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
