// GEOPÓLEM — Validación de materiales docentes (Sprint 24).
// ---------------------------------------------------------------------------
// Ejecuta:
//   node scripts/validate-education-materials.mjs          (PASS/FAIL + exit)
//   node scripts/validate-education-materials.mjs --json    (salida JSON)
//
// Verifica, SIN base de datos ni navegador:
//   1. Estructura declarada en docs/education/education.manifest.json existe
//      (índice, modelo pedagógico, formatos, plantillas, casos, alineación).
//   2. Cada plantilla contiene TODAS sus secciones requeridas.
//   3. La alineación taxonómica referencia campos REALES del contrato v1
//      (derivados de api/v1/conflicts/istanbul.json) y gobernanza real.
//   4. Cada caso de estudio usa un conflict_id EXISTENTE en el inventario y
//      lleva advertencia editorial + fuente verificada.
//   5. NO hay activación de producción ni secretos en los materiales.
//
// Sale con código != 0 si algo falla (apto para CI/precommit).
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const JSON_OUT = process.argv.includes('--json');

const results = [];
let failures = 0;
function check(name, cond, detail) {
  const ok = !!cond;
  results.push({ name, ok, detail: detail || null });
  if (!ok) failures++;
  if (!JSON_OUT) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  — ${detail}` : ''}`);
  }
}

const abs = (rel) => resolve(repoRoot, rel);
const readText = (rel) => readFileSync(abs(rel), 'utf8');
const readJson = (rel) => JSON.parse(readText(rel));

// --- 0. Manifiesto ----------------------------------------------------------
const MANIFEST_REL = 'docs/education/education.manifest.json';
check('manifiesto de educación existe', existsSync(abs(MANIFEST_REL)), MANIFEST_REL);
if (failures) { finish(); }

const manifest = readJson(MANIFEST_REL);
check('manifiesto: contrato esperado', manifest.contract === 'sprint-24-education-manifest-v1', manifest.contract);

// --- 1. Estructura declarada existe ----------------------------------------
check('índice curricular (README) existe', existsSync(abs(manifest.index_file)), manifest.index_file);
check('modelo pedagógico existe', existsSync(abs(manifest.pedagogical_model_file)), manifest.pedagogical_model_file);
check('alineación taxonómica existe', existsSync(abs(manifest.taxonomy_alignment_file)), manifest.taxonomy_alignment_file);

check('manifiesto: 6 formatos declarados', Array.isArray(manifest.formats) && manifest.formats.length === 6, `${manifest.formats?.length}`);
for (const f of manifest.formats || []) {
  check(`formato existe: ${f.id}`, existsSync(abs(f.file)), f.file);
}

check('manifiesto: 7 plantillas declaradas', Array.isArray(manifest.templates) && manifest.templates.length === 7, `${manifest.templates?.length}`);
check('manifiesto: >=2 casos de estudio', Array.isArray(manifest.case_studies) && manifest.case_studies.length >= 2, `${manifest.case_studies?.length}`);

// --- 2. Plantillas completas (todas las secciones requeridas) ---------------
const headingSet = (text) =>
  new Set(
    text
      .split('\n')
      .filter((l) => /^#{1,6}\s/.test(l))
      .map((l) => l.replace(/^#{1,6}\s+/, '').trim())
  );

for (const t of manifest.templates || []) {
  const ok = existsSync(abs(t.file));
  check(`plantilla existe: ${t.id}`, ok, t.file);
  if (!ok) continue;
  const headings = headingSet(readText(t.file));
  const missing = (t.required_sections || []).filter((s) => !headings.has(s));
  check(`plantilla completa: ${t.id}`, missing.length === 0, missing.length ? `faltan: ${missing.join(', ')}` : null);
}

// Índice de plantillas coherente con el manifiesto.
const templatesIndexRel = 'docs/education/plantillas/plantillas.index.json';
if (existsSync(abs(templatesIndexRel))) {
  const idx = readJson(templatesIndexRel);
  const idxIds = new Set((idx.templates || []).map((x) => x.id));
  const manIds = (manifest.templates || []).map((x) => x.id);
  check('índice de plantillas cubre las del manifiesto', manIds.every((id) => idxIds.has(id)),
    manIds.filter((id) => !idxIds.has(id)).join(', '));
} else {
  check('índice de plantillas existe', false, templatesIndexRel);
}

// --- 3. Alineación taxonómica referencia campos reales del contrato v1 ------
const flattenPaths = (obj, prefix = '') => {
  const out = new Set();
  for (const [k, v] of Object.entries(obj || {})) {
    const path = prefix ? `${prefix}.${k}` : k;
    out.add(path);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const p of flattenPaths(v, path)) out.add(p);
    }
  }
  return out;
};

const schemaOk = existsSync(abs(manifest.schema_reference));
check('esquema v1 de referencia existe', schemaOk, manifest.schema_reference);
const inventoryOk = existsSync(abs(manifest.taxonomy_source));
check('inventario de conflictos existe', inventoryOk, manifest.taxonomy_source);

if (schemaOk && inventoryOk) {
  const schema = readJson(manifest.schema_reference);
  const validPaths = flattenPaths(schema.data || {});
  const alignment = readJson(manifest.taxonomy_alignment_file);

  let allFieldsReal = true;
  const unknown = [];
  for (const [entity, def] of Object.entries(alignment.entities || {})) {
    for (const field of def.fields || []) {
      if (!validPaths.has(field)) { allFieldsReal = false; unknown.push(`${entity}:${field}`); }
    }
  }
  check('alineación: todos los campos existen en el contrato v1', allFieldsReal, unknown.join(', '));

  // Cada entidad de la alineación debe mapear a formatos/plantillas existentes.
  const knownFormatIds = new Set((manifest.formats || []).map((f) => f.id));
  const knownTemplateIds = new Set((manifest.templates || []).map((t) => t.id));
  const extraCovers = new Set(['modelo-pedagogico']);
  let coversOk = true;
  const badCovers = [];
  for (const [entity, def] of Object.entries(alignment.entities || {})) {
    for (const c of def.covered_by || []) {
      if (!knownFormatIds.has(c) && !knownTemplateIds.has(c) && !extraCovers.has(c)) {
        coversOk = false; badCovers.push(`${entity}->${c}`);
      }
    }
  }
  check('alineación: cobertura apunta a formatos/plantillas reales', coversOk, badCovers.join(', '));

  // Gobernanza: editorial_status es campo real del inventario; verification real.
  const inventory = readJson(manifest.taxonomy_source);
  const invConflict = (inventory.conflicts || [])[0] || {};
  check('gobernanza: editorial_status existe en el inventario', 'editorial_status' in invConflict);
}

// --- 4. Casos de estudio: IDs reales + advertencia + fuente -----------------
const inventoryIds = inventoryOk
  ? new Set((readJson(manifest.taxonomy_source).conflicts || []).map((c) => c.id))
  : new Set();

for (const cs of manifest.case_studies || []) {
  const ok = existsSync(abs(cs.file));
  check(`caso existe: ${cs.id}`, ok, cs.file);
  if (!ok) continue;
  check(`caso usa conflict_id real: ${cs.conflict_id}`, inventoryIds.has(cs.conflict_id), cs.conflict_id);
  const text = readText(cs.file);
  check(`caso lleva advertencia editorial: ${cs.id}`, /Advertencia editorial/i.test(text));
  check(`caso menciona su conflict_id: ${cs.id}`, text.includes(cs.conflict_id));
  check(`caso cita fuente verificada: ${cs.id}`, /verified/i.test(text) && /https?:\/\//.test(text));
  check(`caso no es producción: ${cs.id}`, /RC|staging/i.test(text));
}

// --- 5. Sin activación de producción ni secretos ----------------------------
check('manifiesto: is_production=false', manifest.production?.is_production === false);
check('manifiesto: no activa gate de producción', manifest.production?.activates_production_gate === false);
check('manifiesto: declara ausencia de secretos', manifest.production?.contains_secrets === false);

const eduFiles = [
  manifest.index_file,
  manifest.pedagogical_model_file,
  manifest.taxonomy_alignment_file,
  MANIFEST_REL,
  templatesIndexRel,
  ...(manifest.formats || []).map((f) => f.file),
  ...(manifest.templates || []).map((t) => t.file),
  ...(manifest.case_studies || []).map((c) => c.file),
].filter((rel) => existsSync(abs(rel)));

const SECRET_PATTERNS = [
  { re: /-----BEGIN[A-Z ]*PRIVATE KEY-----/, name: 'clave privada PEM' },
  { re: /AKIA[0-9A-Z]{16}/, name: 'AWS access key' },
  { re: /(secret|password|passwd|api[_-]?key|access[_-]?token)\s*[:=]\s*["'][A-Za-z0-9/+=_-]{16,}["']/i, name: 'secreto embebido' },
  { re: /xox[baprs]-[0-9A-Za-z-]{10,}/, name: 'token Slack' },
  { re: /gh[pousr]_[0-9A-Za-z]{20,}/, name: 'token GitHub' },
];
const PROD_PATTERNS = [
  { re: /"is_production"\s*:\s*true/, name: 'is_production true' },
  { re: /activates_production_gate"\s*:\s*true/, name: 'activa gate de producción' },
  { re: /NODE_ENV\s*=\s*production/, name: 'NODE_ENV=production' },
  { re: /production_gate"\s*:\s*"open"/, name: 'gate de producción abierto' },
];

let secretsFound = [];
let prodFound = [];
for (const rel of eduFiles) {
  const text = readText(rel);
  for (const p of SECRET_PATTERNS) if (p.re.test(text)) secretsFound.push(`${rel}: ${p.name}`);
  for (const p of PROD_PATTERNS) if (p.re.test(text)) prodFound.push(`${rel}: ${p.name}`);
}
check('materiales sin secretos embebidos', secretsFound.length === 0, secretsFound.join('; '));
check('materiales sin activación de producción', prodFound.length === 0, prodFound.join('; '));

finish();

function finish() {
  const summary = {
    contract: 'sprint-24-education-validation-v1',
    total: results.length,
    passed: results.filter((r) => r.ok).length,
    failed: failures,
    checks: results,
  };
  if (JSON_OUT) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`\n${failures === 0 ? 'OK' : 'FALLOS'}: ${summary.passed}/${summary.total} comprobaciones correctas.`);
  }
  process.exit(failures === 0 ? 0 : 1);
}
