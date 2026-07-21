// GEOPÓLEM — Validador del mapeo opcional xAPI/SCORM (Sprint 27)
// ---------------------------------------------------------------------------
// Valida que el mapeo CONCEPTUAL (`docs/education/xapi-scorm-mapping/mapping.json`)
// sea coherente con el manifiesto LMS portable del Sprint 26 y con las garantías
// del proyecto:
//   • Cada `source_concept` mapeado (xapi.mappings[] y scorm.cmi[]) existe como
//     sección real del manifiesto LMS (modules/cases/rubrics/rubrics.criteria).
//   • El mapeo se declara OPCIONAL e independiente de plataforma.
//   • La política de identidad del actor es anónima.
//   • No activa producción ni contiene secretos.
//
// NO genera paquetes SCORM/xAPI: sólo valida el mapa portable.
//
// Uso:
//   node scripts/xapi-scorm-mapping.mjs            (PASS/FAIL + exit)
//   node scripts/xapi-scorm-mapping.mjs --json      (informe JSON)
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

export const MAPPING_CONTRACT = 'sprint-27-xapi-scorm-mapping-v1';
const MAPPING_FILE = 'docs/education/xapi-scorm-mapping/mapping.json';
const LMS_MANIFEST = 'docs/education/lms-export/lms.manifest.json';

const abs = (rel) => resolve(REPO_ROOT, rel);

export function loadMapping({ repoRoot = REPO_ROOT, file = MAPPING_FILE } = {}) {
  return JSON.parse(readFileSync(resolve(repoRoot, file), 'utf8'));
}

// Conceptos que el manifiesto LMS puede respaldar (secciones reales).
function manifestConcepts(lms) {
  const set = new Set();
  if (Array.isArray(lms.modules) && lms.modules.length) set.add('modules');
  if (Array.isArray(lms.cases) && lms.cases.length) set.add('cases');
  if (Array.isArray(lms.rubrics) && lms.rubrics.length) {
    set.add('rubrics');
    if (lms.rubrics.some((r) => Array.isArray(r.criteria) && r.criteria.length)) set.add('rubrics.criteria');
  }
  return set;
}

// Validación PURA: devuelve lista de errores (vacía = OK).
export function validateMapping(mapping, lms) {
  const errors = [];
  if (mapping.contract !== MAPPING_CONTRACT) errors.push(`contrato inesperado: ${mapping.contract}`);
  if (mapping.optional !== true) errors.push('el mapeo debe declararse optional=true');
  if (mapping.platform_independent !== true) errors.push('el mapeo debe declararse platform_independent=true');
  if (!mapping.identity || mapping.identity.actor_policy !== 'anonymous') {
    errors.push('la política de identidad del actor debe ser "anonymous"');
  }
  const p = mapping.production || {};
  if (p.is_production !== false || p.activates_production_gate !== false || p.contains_secrets !== false) {
    errors.push('el mapeo no debe activar producción ni declarar secretos');
  }

  const concepts = manifestConcepts(lms);
  const xMappings = (mapping.xapi && mapping.xapi.mappings) || [];
  if (!xMappings.length) errors.push('xapi.mappings vacío');
  for (const m of xMappings) {
    if (!concepts.has(m.source_concept)) {
      errors.push(`xapi: source_concept "${m.source_concept}" no existe en el manifiesto LMS`);
    }
    if (!m.verb || !(mapping.xapi.verbs || {})[m.verb]) {
      errors.push(`xapi: verbo no declarado para "${m.source_concept}": ${m.verb}`);
    }
    if (!m.activity_type || !(mapping.xapi.activity_types || {})[m.activity_type]) {
      errors.push(`xapi: activity_type no declarado para "${m.source_concept}": ${m.activity_type}`);
    }
  }
  const cmi = (mapping.scorm && mapping.scorm.cmi) || [];
  if (!cmi.length) errors.push('scorm.cmi vacío');
  for (const c of cmi) {
    if (!concepts.has(c.source_concept)) {
      errors.push(`scorm: source_concept "${c.source_concept}" no existe en el manifiesto LMS`);
    }
    if (!c.cmi_element) errors.push(`scorm: falta cmi_element para "${c.source_concept}"`);
  }
  return errors;
}

// --- CLI --------------------------------------------------------------------
function main() {
  const jsonOut = process.argv.includes('--json');
  if (!existsSync(abs(MAPPING_FILE))) {
    process.stderr.write(`[xapi] mapeo no encontrado: ${MAPPING_FILE}\n`);
    return 2;
  }
  if (!existsSync(abs(LMS_MANIFEST))) {
    process.stderr.write(`[xapi] manifiesto LMS no encontrado: ${LMS_MANIFEST} (ejecuta npm run education:lms:write)\n`);
    return 2;
  }
  const mapping = loadMapping();
  const lms = JSON.parse(readFileSync(abs(LMS_MANIFEST), 'utf8'));
  const errors = validateMapping(mapping, lms);

  if (jsonOut) {
    process.stdout.write(`${JSON.stringify({ contract: MAPPING_CONTRACT, ok: errors.length === 0, errors }, null, 2)}\n`);
  } else if (errors.length) {
    for (const e of errors) process.stderr.write(`FAIL  ${e}\n`);
    process.stderr.write(`\n[xapi] ${errors.length} error(es) en el mapeo.\n`);
  } else {
    process.stdout.write('[xapi] OK: mapeo xAPI/SCORM coherente con el manifiesto LMS, opcional y sin producción.\n');
  }
  return errors.length === 0 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
