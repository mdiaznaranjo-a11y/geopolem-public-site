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
import { exportFiche } from './export-education-fiches.mjs';
import { validateRubric } from './validate-education-rubrics.mjs';
import { scoreRubric, sampleEvaluation } from './score-rubric.mjs';
import { crosscheckAll } from './validate-causal-crosscheck.mjs';
import { buildBatchPackage } from './score-rubric-batch.mjs';
import { renderFeedback } from './render-feedback.mjs';
import { buildBacklogPackage } from './build-causal-backlog.mjs';
import { loadMapping, validateMapping } from './xapi-scorm-mapping.mjs';

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

// --- 6. Sprint 25: exportador, banco de casos, laboratorio offline, rúbricas -
const SPRINT25_MANIFEST_REL = 'docs/education/education.sprint25.manifest.json';
if (existsSync(abs(SPRINT25_MANIFEST_REL))) {
  const s25 = readJson(SPRINT25_MANIFEST_REL);
  check('sprint25: contrato del manifiesto', s25.contract === 'sprint-25-education-manifest-v1', s25.contract);
  check('sprint25: no activa producción', s25.production?.is_production === false && s25.production?.activates_production_gate === false && s25.production?.contains_secrets === false);

  // 6.1 Exportador: script existe y produce ficha completa marcando pendientes.
  check('sprint25: exportador existe', existsSync(abs(s25.exporter.script)), s25.exporter.script);
  try {
    const firstId = [...inventoryIds][0];
    const { fiche } = exportFiche(firstId, 'rc');
    const missing = (s25.exporter.required_fields || []).filter((f) => !(f in fiche));
    check('sprint25: ficha exportada tiene todos los campos', missing.length === 0, missing.join(', '));
    check('sprint25: ficha declara pending_fields', Array.isArray(fiche.pending_fields));
    check('sprint25: ficha no activa producción', fiche.production?.is_production === false);
    // Verifica marcado de faltantes: canonical suele tener arrays vacíos → pendientes.
    const { fiche: canon } = exportFiche(firstId, 'canonical');
    check('sprint25: exportador marca campos faltantes como pending', canon.pending_fields.length > 0, `${canon.conflict_id}`);
  } catch (e) {
    check('sprint25: exportador ejecuta sin error', false, String(e && e.message));
  }

  // 6.2 Banco de casos: índice + fichas + matrices coherentes.
  const cbIndexRel = s25.case_bank.index;
  const cbOk = existsSync(abs(cbIndexRel));
  check('sprint25: índice del banco de casos existe', cbOk, cbIndexRel);
  if (cbOk) {
    const cb = readJson(cbIndexRel);
    check('sprint25: banco de casos contrato', cb.contract === 'sprint-25-case-bank-v1', cb.contract);
    check('sprint25: banco de casos con >=1 caso', Array.isArray(cb.cases) && cb.cases.length >= 1, `${cb.cases?.length}`);
    let cbFilesOk = true, cbBad = [];
    let matrixOk = true, matrixBad = [];
    for (const c of cb.cases || []) {
      for (const rel of [c.fiche_md, c.fiche_json, c.matrix_json]) {
        if (!existsSync(abs(rel))) { cbFilesOk = false; cbBad.push(rel); }
      }
      // Caso usa un conflict_id real del inventario.
      if (!inventoryIds.has(c.id)) { cbFilesOk = false; cbBad.push(`id inexistente: ${c.id}`); }
      if (existsSync(abs(c.matrix_json))) {
        const m = readJson(c.matrix_json);
        if (m.contract !== 'sprint-25-causal-matrix-v1') { matrixOk = false; matrixBad.push(c.id); }
      }
    }
    check('sprint25: ficheros del banco de casos existen y usan IDs reales', cbFilesOk, cbBad.join(', '));
    check('sprint25: matrices causales usan el contrato correcto', matrixOk, matrixBad.join(', '));
  }

  // 6.3 Cuaderno de laboratorio offline.
  const labRel = s25.offline_lab.file;
  const labOk = existsSync(abs(labRel));
  check('sprint25: cuaderno de laboratorio offline existe', labOk, labRel);
  if (labOk) {
    const labText = readText(labRel);
    check('sprint25: laboratorio menciona deep-links y offline/PWA', /deep-link/i.test(labText) && /offline/i.test(labText) && /PWA/i.test(labText));
    const alignedOk = (s25.offline_lab.aligned_modules || []).every((m) => labText.includes(m));
    check('sprint25: laboratorio referencia módulos alineados', alignedOk);
    check('sprint25: laboratorio lleva advertencia editorial', /Advertencia editorial/i.test(labText));
  }

  // 6.4 Rúbricas máquina-legibles.
  const rIndexRel = s25.rubrics.index;
  const rOk = existsSync(abs(rIndexRel));
  check('sprint25: índice de rúbricas existe', rOk, rIndexRel);
  if (rOk) {
    const rIdx = readJson(rIndexRel);
    check('sprint25: 6 rúbricas declaradas', Array.isArray(rIdx.rubrics) && rIdx.rubrics.length === 6, `${rIdx.rubrics?.length}`);
    const dims = new Set();
    let rubricsValid = true, rubricsBad = [];
    for (const entry of rIdx.rubrics || []) {
      if (!existsSync(abs(entry.file))) { rubricsValid = false; rubricsBad.push(entry.file); continue; }
      const errs = validateRubric(readJson(entry.file));
      if (errs.length) { rubricsValid = false; rubricsBad.push(`${entry.id}: ${errs.join('/')}`); }
      dims.add(entry.dimension);
    }
    check('sprint25: todas las rúbricas son válidas (pesos, descriptores)', rubricsValid, rubricsBad.join('; '));
    const reqDims = s25.rubrics.required_dimensions || [];
    check('sprint25: rúbricas cubren todas las dimensiones requeridas', reqDims.every((d) => dims.has(d)), reqDims.filter((d) => !dims.has(d)).join(', '));
  }

  // 6.5 Barrido de secretos/producción sobre artefactos Sprint 25.
  const s25Files = [
    SPRINT25_MANIFEST_REL,
    s25.offline_lab.file,
    s25.rubrics.index,
    s25.case_bank.index,
    ...(existsSync(abs(s25.rubrics.index)) ? readJson(s25.rubrics.index).rubrics.map((r) => r.file) : []),
  ].filter((rel) => existsSync(abs(rel)));
  let s25Secrets = [], s25Prod = [];
  for (const rel of s25Files) {
    const text = readText(rel);
    for (const p of SECRET_PATTERNS) if (p.re.test(text)) s25Secrets.push(`${rel}: ${p.name}`);
    for (const p of PROD_PATTERNS) if (p.re.test(text)) s25Prod.push(`${rel}: ${p.name}`);
  }
  check('sprint25: artefactos sin secretos embebidos', s25Secrets.length === 0, s25Secrets.join('; '));
  check('sprint25: artefactos sin activación de producción', s25Prod.length === 0, s25Prod.join('; '));

  // --- 7. Sprint 26: puntuación de rúbricas + validación cruzada causal -----
  // 7.1 El motor de puntuación puntúa cada rúbrica con una evaluación sintética.
  const rIndexRel26 = s25.rubrics.index;
  if (existsSync(abs(rIndexRel26))) {
    let scoringOk = true, scoringBad = [];
    for (const entry of readJson(rIndexRel26).rubrics || []) {
      if (!existsSync(abs(entry.file))) continue;
      const rubric = readJson(entry.file);
      try {
        const result = scoreRubric(rubric, sampleEvaluation(rubric));
        if (!(result.percentage >= 0 && result.percentage <= 100)) { scoringOk = false; scoringBad.push(`${entry.id}: % fuera de rango`); }
        if (result.total > result.max_total + 1e-9) { scoringOk = false; scoringBad.push(`${entry.id}: total > max`); }
        if (result.production.is_production !== false) { scoringOk = false; scoringBad.push(`${entry.id}: activa producción`); }
      } catch (e) {
        scoringOk = false; scoringBad.push(`${entry.id}: ${e.message}`);
      }
    }
    check('sprint26: motor de puntuación válido para todas las rúbricas', scoringOk, scoringBad.join('; '));
  }

  // 7.2 Validación cruzada matrices ↔ causal_links (RC): sin errores de severidad.
  const cross = crosscheckAll({ stage: 'rc' });
  check('sprint26: validación cruzada matrices↔causal_links sin errores', cross.totals.by_severity.error === 0,
    `errores=${cross.totals.by_severity.error} avisos=${cross.totals.by_severity.warning}`);
  check('sprint26: validación cruzada no activa producción', cross.production.is_production === false);

  // 7.3 Paquetes docentes distribuibles (curso corto + seminario ejecutivo).
  const PACKAGES_INDEX_REL = 'docs/education/packages/packages.index.json';
  if (existsSync(abs(PACKAGES_INDEX_REL))) {
    const pkgIdx = readJson(PACKAGES_INDEX_REL);
    check('sprint26: índice de paquetes contrato', pkgIdx.contract === 'sprint-26-education-packages-v1', pkgIdx.contract);
    check('sprint26: >=2 paquetes declarados', Array.isArray(pkgIdx.packages) && pkgIdx.packages.length >= 2, `${pkgIdx.packages?.length}`);
    let pkgOk = true, pkgBad = [];
    for (const p of pkgIdx.packages || []) {
      if (!existsSync(abs(p.manifest))) { pkgOk = false; pkgBad.push(`falta manifest: ${p.id}`); continue; }
      const man = readJson(p.manifest);
      for (const rel of [man.syllabus, ...(man.rubrics || []), ...(man.cases || []).map((c) => c.matrix), man.lab_guide]) {
        if (rel && !existsSync(abs(rel))) { pkgOk = false; pkgBad.push(`${p.id}: falta ${rel}`); }
      }
    }
    check('sprint26: paquetes docentes completos (syllabus, rúbricas, casos, laboratorio)', pkgOk, pkgBad.join('; '));
  }
}

// --- 8. Sprint 27: revisión instructor, batch, feedback, backlog, xAPI/SCORM -
const S27_MANIFEST_REL = 'docs/education/education.sprint27.manifest.json';
if (existsSync(abs(S27_MANIFEST_REL))) {
  const s27 = readJson(S27_MANIFEST_REL);
  check('sprint27: contrato del manifiesto', s27.contract === 'sprint-27-education-manifest-v1', s27.contract);
  check('sprint27: no activa producción', s27.production?.is_production === false && s27.production?.activates_production_gate === false && s27.production?.contains_secrets === false);

  // 8.1 Paquete de revisión de instructor: manifest + documentos con secciones.
  const irManRel = s27.instructor_review.manifest;
  const irOk = existsSync(abs(irManRel));
  check('sprint27: manifiesto de revisión de instructor existe', irOk, irManRel);
  if (irOk) {
    const ir = readJson(irManRel);
    check('sprint27: contrato revisión instructor', ir.contract === 'sprint-27-instructor-review-v1', ir.contract);
    check('sprint27: índice de revisión existe', existsSync(abs(ir.index_file)), ir.index_file);
    for (const d of ir.documents || []) {
      const dok = existsSync(abs(d.file));
      check(`sprint27: documento revisión existe: ${d.id}`, dok, d.file);
      if (!dok) continue;
      const headings = headingSet(readText(d.file));
      const missing = (d.required_sections || []).filter((sname) => !headings.has(sname));
      check(`sprint27: documento revisión completo: ${d.id}`, missing.length === 0, missing.join(', '));
    }
  }

  // 8.2 Scoring por lotes: fixtures anónimos, informe al día, sin PII.
  const bs = s27.batch_scoring;
  check('sprint27: script de scoring por lotes existe', existsSync(abs(bs.script)), bs.script);
  try {
    const pkg = buildBatchPackage({ dir: bs.fixtures_dir });
    check('sprint27: batch procesa >=1 evaluación', pkg.report.totals.submitted >= 1, `${pkg.report.totals.submitted}`);
    check('sprint27: batch no rechaza fixtures sintéticos por PII', pkg.report.rejected.every((r) => r.reason !== 'pii'), pkg.report.rejected.map((r) => r.id).join(', '));
    check('sprint27: informe batch al día',
      existsSync(abs(bs.report_json)) && readText(bs.report_json) === `${JSON.stringify(pkg.report, null, 2)}\n`
      && existsSync(abs(bs.report_md)) && readText(bs.report_md) === pkg.markdown
      && existsSync(abs(bs.report_csv)) && readText(bs.report_csv) === pkg.csv,
      'ejecuta npm run education:batch:write');
    check('sprint27: informe batch no activa producción', pkg.report.production.is_production === false);
  } catch (e) {
    check('sprint27: batch ejecuta sin error', false, String(e && e.message));
  }

  // 8.3 Plantillas de feedback: JSON con bandas y recomendaciones por nivel.
  const ft = s27.feedback_templates;
  const ftOk = existsSync(abs(ft.json));
  check('sprint27: plantilla de feedback JSON existe', ftOk, ft.json);
  check('sprint27: plantilla de feedback Markdown existe', existsSync(abs(ft.markdown)), ft.markdown);
  if (ftOk) {
    const tpl = readJson(ft.json);
    check('sprint27: contrato de plantilla de feedback', tpl.contract === 'sprint-27-feedback-template-v1', tpl.contract);
    const bandsOk = ['insuficiente', 'suficiente', 'notable', 'excelente'].every((b) => tpl.bands && tpl.bands[b] && tpl.bands[b].recommendation);
    check('sprint27: plantilla cubre las 4 bandas con recomendación', bandsOk);
    const levelsOk = ['insuficiente', 'suficiente', 'notable', 'excelente'].every((l) => tpl.level_recommendations && tpl.level_recommendations[l]);
    check('sprint27: plantilla cubre recomendaciones por nivel', levelsOk);
    // Integración con el motor de puntuación: render sin error para la rúbrica de causalidad.
    try {
      const rubric = readJson('docs/education/rubrics/rubrica-causalidad.json');
      const md = renderFeedback(rubric, sampleEvaluation(rubric), tpl);
      check('sprint27: feedback renderiza banda y criterios', /Banda global/.test(md) && /Por criterio/.test(md));
    } catch (e) {
      check('sprint27: feedback renderiza sin error', false, String(e && e.message));
    }
  }

  // 8.4 Backlog causal accionable: al día, sin severidad error inventada.
  const cbk = s27.causal_backlog;
  check('sprint27: script de backlog causal existe', existsSync(abs(cbk.script)), cbk.script);
  try {
    const bpkg = buildBacklogPackage({ stage: 'rc' });
    check('sprint27: backlog causal contrato', bpkg.backlog.contract === 'sprint-27-causal-backlog-v1', bpkg.backlog.contract);
    check('sprint27: backlog causal al día',
      existsSync(abs(cbk.json)) && readText(cbk.json) === `${JSON.stringify(bpkg.backlog, null, 2)}\n`
      && existsSync(abs(cbk.markdown)) && readText(cbk.markdown) === bpkg.markdown,
      'ejecuta npm run education:backlog:write');
    // Coherencia con el crosscheck: los ítems de crosscheck no superan sus divergencias.
    const cross = crosscheckAll({ stage: 'rc' });
    const crossItems = bpkg.backlog.items.filter((i) => i.source === 'crosscheck').length;
    check('sprint27: backlog no inventa divergencias causales', crossItems === cross.totals.divergences, `${crossItems} vs ${cross.totals.divergences}`);
    check('sprint27: backlog no activa producción', bpkg.backlog.production.is_production === false);
  } catch (e) {
    check('sprint27: backlog ejecuta sin error', false, String(e && e.message));
  }

  // 8.5 Mapeo opcional xAPI/SCORM coherente con el manifiesto LMS.
  const xm = s27.xapi_scorm_mapping;
  check('sprint27: mapeo xAPI/SCORM declarado opcional', xm.optional === true && xm.platform_independent === true);
  check('sprint27: README del mapeo existe', existsSync(abs(xm.readme)), xm.readme);
  const mapOk = existsSync(abs(xm.mapping));
  check('sprint27: mapping.json existe', mapOk, xm.mapping);
  if (mapOk && existsSync(abs('docs/education/lms-export/lms.manifest.json'))) {
    const mapping = loadMapping();
    const lms = readJson('docs/education/lms-export/lms.manifest.json');
    const errs = validateMapping(mapping, lms);
    check('sprint27: mapeo xAPI/SCORM coherente con el manifiesto LMS', errs.length === 0, errs.join('; '));
  }

  // 8.6 Barrido de secretos/producción sobre artefactos Sprint 27.
  const s27Files = [
    S27_MANIFEST_REL,
    s27.instructor_review.manifest,
    ...(existsSync(abs(s27.instructor_review.manifest)) ? readJson(s27.instructor_review.manifest).documents.map((d) => d.file) : []),
    ft.json, ft.markdown, cbk.json, cbk.markdown, xm.readme, xm.mapping,
    bs.report_json, bs.report_csv,
  ].filter((rel) => rel && existsSync(abs(rel)));
  let s27Secrets = [], s27Prod = [];
  for (const rel of s27Files) {
    const text = readText(rel);
    for (const p of SECRET_PATTERNS) if (p.re.test(text)) s27Secrets.push(`${rel}: ${p.name}`);
    for (const p of PROD_PATTERNS) if (p.re.test(text)) s27Prod.push(`${rel}: ${p.name}`);
  }
  check('sprint27: artefactos sin secretos embebidos', s27Secrets.length === 0, s27Secrets.join('; '));
  check('sprint27: artefactos sin activación de producción', s27Prod.length === 0, s27Prod.join('; '));
}

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
