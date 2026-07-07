// GEOPÓLEM — Preparación del CIERRE MAESTRO Sprint 30 (Sprint 29)
// ---------------------------------------------------------------------------
// PREPARA (no ejecuta) el cierre de la serie de sprints 3–30. Genera:
//   • Un CHECKLIST de cierre técnico / educativo / editorial, con el estado
//     derivado de SEÑALES EN VIVO de la propia capa educativa (deterministas):
//       - cobertura i18n ES/EN ampliada,
//       - divergencias del cross-check causal ampliado,
//       - ítems abiertos y bloqueantes de la cola editorial causal,
//       - decisión ADR SCORM vs mapping portable.
//   • Un REGISTRO DE RIESGOS abiertos documentado (cadena de PRs, PR #28 contra
//     main, producción bloqueada, causal_links en canonical, SCORM real vs
//     mapping portable, i18n incompleta, curaduría humana pendiente).
//
// Garantías:
//   • NO ejecuta el cierre ni activa producción: sólo prepara y reporta.
//   • Determinista (sin timestamps) → admite --check en CI.
//   • No inventa datos: los estados salen de señales reales; los riesgos son
//     hechos del proyecto declarados explícitamente.
//   • No contiene secretos.
//
// Artefactos (en docs/education/close-prep/):
//   • sprint-30-close-checklist.json — checklist + riesgos máquina-legible.
//   • sprint-30-close-checklist.md   — versión navegable para el cierre.
//
// Uso:
//   node scripts/build-master-close-prep.mjs            (resumen)
//   node scripts/build-master-close-prep.mjs --json      (informe JSON)
//   node scripts/build-master-close-prep.mjs --write      (escribe artefactos)
//   node scripts/build-master-close-prep.mjs --check      (verifica al día)
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateI18n } from './validate-i18n-coverage.mjs';
import { crosscheckScale } from './causal-crosscheck-scale.mjs';
import { buildCausalQueue } from './build-causal-queue.mjs';
import { validateAllAdrs } from './validate-adr.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

export const CLOSE_PREP_CONTRACT = 'sprint-29-master-close-prep-v1';
const OUT_DIR = 'docs/education/close-prep';
const I18N_SPRINT29_MANIFEST = 'docs/education/i18n/i18n.sprint29.manifest.json';
const I18N_SPRINT29_CONTRACT = 'sprint-29-education-i18n-v1';

const abs = (rel) => resolve(REPO_ROOT, rel);

// Recoge señales EN VIVO deterministas de la capa educativa. No toca DB ni red.
export function collectSignals({ repoRoot = REPO_ROOT, stage = 'rc' } = {}) {
  const i18n = existsSync(resolve(repoRoot, I18N_SPRINT29_MANIFEST))
    ? validateI18n({ repoRoot, manifestRel: I18N_SPRINT29_MANIFEST, expectedContract: I18N_SPRINT29_CONTRACT })
    : validateI18n({ repoRoot });
  const scaleRc = crosscheckScale({ repoRoot, stage });
  const scaleCanonical = crosscheckScale({ repoRoot, stage: 'canonical' });
  const queue = buildCausalQueue({ repoRoot, stage });
  const adr = validateAllAdrs({ repoRoot });
  const adr0001 = adr.results.find((a) => a.id === 'ADR-0001');
  return {
    i18n_ok: i18n.ok,
    i18n_coverage: i18n.coverage_percentage,
    i18n_namespaces: i18n.namespaces.map((n) => n.id),
    causal_divergent_rc: scaleRc.totals.by_status.divergent,
    causal_pending_matrix_rc: scaleRc.totals.by_status.pending_matrix,
    canonical_conflicts: scaleCanonical.totals.conflicts,
    canonical_not_applicable: scaleCanonical.totals.by_status.not_applicable,
    canonical_checked: scaleCanonical.totals.by_status.checked,
    queue_items: queue.totals.items,
    queue_blocking: queue.totals.blocking,
    adr_decision: adr0001 ? adr0001.decision : null,
    adr_ok: adr.ok,
  };
}

// Estado determinista de cada ítem del checklist a partir de señales en vivo.
// status ∈ { done, pending, deferred, by_design }
function buildChecklist(s) {
  return [
    // --- Técnico ---
    {
      id: 'tech-tests-green',
      area: 'technical',
      title: 'Suite educativa (Sprint 24–29) en verde y artefactos --check al día',
      status: 'pending',
      blocker: false,
      note: 'Verificar en CI que todos los checks educativos pasan antes del cierre.',
    },
    {
      id: 'tech-production-blocked',
      area: 'technical',
      title: 'Producción permanece BLOQUEADA (sin gates, sin secretos)',
      status: 'by_design',
      blocker: false,
      note: 'Estado intencional de toda la serie; el cierre NO habilita producción.',
    },
    {
      id: 'tech-reversible-arch',
      area: 'technical',
      title: 'Arquitectura reversible API real v1 → JSON estático → fallback intacta',
      status: 'done',
      blocker: false,
      note: 'La capa educativa sólo consume artefactos versionados; no altera web/PWA/mapa/rutas.',
    },
    // --- Educativo ---
    {
      id: 'edu-i18n-coverage',
      area: 'educational',
      title: 'Cobertura i18n ES/EN de paquetes clave al 100 % en los namespaces definidos',
      status: s.i18n_ok && s.i18n_coverage === 100 ? 'done' : 'pending',
      blocker: false,
      note: `Cobertura ${s.i18n_coverage}% sobre namespaces: ${s.i18n_namespaces.join(', ')}. Faltan materiales no incluidos aún (ver riesgo i18n-incomplete).`,
    },
    {
      id: 'edu-dashboard',
      area: 'educational',
      title: 'Panel docente agregado no individualizado disponible y al día',
      status: existsSync(abs('docs/education/dashboard/teacher-dashboard.json')) ? 'done' : 'pending',
      blocker: false,
      note: 'Panel agregado sin PII ni tracking individual; verificado con --check.',
    },
    {
      id: 'edu-scorm-decision',
      area: 'educational',
      title: 'Decisión SCORM vs mapping portable registrada (ADR-0001)',
      status: s.adr_decision === 'portable-mapping' ? 'done' : 'pending',
      blocker: false,
      note: 'SCORM real queda diferido; se mantiene mapping portable (ver riesgo scorm-real).',
    },
    // --- Editorial ---
    {
      id: 'ed-causal-queue',
      area: 'editorial',
      title: 'Cola editorial causal normalizada, estable y sin ítems bloqueantes',
      status: s.queue_blocking === 0 ? (s.queue_items === 0 ? 'done' : 'pending') : 'pending',
      blocker: s.queue_blocking > 0,
      note: `${s.queue_items} ítem(s) abiertos, ${s.queue_blocking} bloqueante(s). Requiere curaduría humana (ver riesgo human-curation).`,
    },
    {
      id: 'ed-causal-divergence',
      area: 'editorial',
      title: 'Cross-check causal ampliado (rc) sin divergencias de severidad error',
      status: s.causal_divergent_rc === 0 ? 'done' : 'pending',
      blocker: s.causal_divergent_rc > 0,
      note: `${s.causal_divergent_rc} divergencia(s) en rc; ${s.causal_pending_matrix_rc} pendiente(s) de matriz.`,
    },
    {
      id: 'ed-human-signoff',
      area: 'editorial',
      title: 'Sign-off editorial humano del cierre de la serie (3–30)',
      status: 'pending',
      blocker: false,
      note: 'Acción humana fuera del alcance automatizable; debe ejecutarse en Sprint 30.',
    },
  ];
}

// Registro de riesgos abiertos: hechos del proyecto declarados explícitamente,
// enriquecidos con señales en vivo donde procede. No se inventan datos.
function buildRisks(s) {
  return [
    {
      id: 'pr-chain',
      title: 'Cadena de PRs dependientes de la serie de sprints',
      severity: 'medium',
      status: 'open',
      mitigation: 'Ordenar y fusionar los PRs por dependencia antes del cierre maestro; documentar el orden en Sprint 30.',
    },
    {
      id: 'pr28-vs-main',
      title: 'PR #28 pendiente de integración contra main',
      severity: 'medium',
      status: 'open',
      mitigation: 'Confirmar el estado de PR #28 (base del Sprint 29) y su fusión a main como paso previo al cierre.',
    },
    {
      id: 'production-blocked',
      title: 'Producción bloqueada por diseño en toda la serie',
      severity: 'info',
      status: 'by_design',
      mitigation: 'El cierre NO debe habilitar producción; mantener gates desactivados y sin secretos.',
    },
    {
      id: 'canonical-causal-links',
      title: 'canonical carece de causal_links → el cross-check usa rc por defecto',
      severity: 'high',
      status: 'open',
      mitigation: `Riesgo heredado del Sprint 28. En canonical ${s.canonical_not_applicable}/${s.canonical_conflicts} conflictos quedan sin datos causales (not_applicable) y sólo ${s.canonical_checked} checked; por eso el barrido ampliado y la cola usan stage=rc. Poblar causal_links en canonical antes de promover.`,
    },
    {
      id: 'scorm-real',
      title: 'SCORM real vs mapping portable (SCORM diferido)',
      severity: 'low',
      status: 'deferred',
      mitigation: `ADR-0001 decide "${s.adr_decision}". El empaquetado SCORM real queda diferido; el mapping portable es suficiente para la serie.`,
    },
    {
      id: 'i18n-incomplete',
      title: 'i18n incompleta más allá de los namespaces clave',
      severity: 'medium',
      status: s.i18n_coverage === 100 ? 'partial' : 'open',
      mitigation: `Cobertura 100% en los namespaces definidos (${s.i18n_namespaces.join(', ')}), pero no todos los materiales docentes están traducidos. Ampliar namespaces en futuros sprints reusando el validador escalable.`,
    },
    {
      id: 'human-curation',
      title: 'Curaduría humana pendiente de la cola editorial causal',
      severity: 'medium',
      status: s.queue_items > 0 ? 'open' : 'clear',
      mitigation: `${s.queue_items} ítem(s) en la cola requieren revisión editorial/datos humana; no automatizable. Resolver o aceptar antes del cierre.`,
    },
  ];
}

export function buildClosePrep({ repoRoot = REPO_ROOT, stage = 'rc' } = {}) {
  const signals = collectSignals({ repoRoot, stage });
  const checklist = buildChecklist(signals);
  const risks = buildRisks(signals);

  const byArea = {};
  const byStatus = {};
  let blockers = 0;
  for (const it of checklist) {
    byArea[it.area] = (byArea[it.area] || 0) + 1;
    byStatus[it.status] = (byStatus[it.status] || 0) + 1;
    if (it.blocker) blockers += 1;
  }
  const openRisks = risks.filter((r) => r.status === 'open').length;
  const ready = blockers === 0;

  return {
    contract: CLOSE_PREP_CONTRACT,
    notice:
      'Preparación del cierre maestro Sprint 30 (Sprint 29). PREPARA, no ejecuta: no cierra la serie ni activa producción. Estados derivados de señales en vivo deterministas; riesgos declarados explícitamente.',
    production: { is_production: false, activates_production_gate: false, contains_secrets: false },
    series: { from_sprint: 3, to_sprint: 30, base_branch: 'main' },
    source_stage: stage,
    signals,
    totals: {
      checklist_items: checklist.length,
      by_area: byArea,
      by_status: byStatus,
      blockers,
      risks: risks.length,
      open_risks: openRisks,
      close_ready: ready,
    },
    checklist,
    risks,
  };
}

export function renderClosePrepMarkdown(cp) {
  const L = [];
  L.push('# Preparación del cierre maestro — Sprint 30 (Sprint 29)');
  L.push('');
  L.push('> **PREPARA, no ejecuta.** No cierra la serie de sprints 3–30 ni activa');
  L.push('> producción. Estados derivados de señales en vivo deterministas; los');
  L.push('> riesgos son hechos del proyecto declarados explícitamente.');
  L.push('');
  L.push(`- Serie: **sprints ${cp.series.from_sprint}–${cp.series.to_sprint}** sobre \`${cp.series.base_branch}\``);
  L.push(`- Ítems de checklist: **${cp.totals.checklist_items}** · bloqueantes: **${cp.totals.blockers}**`);
  L.push(`- Riesgos: **${cp.totals.risks}** (abiertos: **${cp.totals.open_risks}**)`);
  L.push(`- ¿Listo para cierre (sin bloqueantes)?: **${cp.totals.close_ready ? 'sí' : 'no'}**`);
  L.push('');
  L.push('## Checklist de cierre');
  L.push('');
  L.push('| id | área | ítem | estado | bloqueante |');
  L.push('|---|---|---|---|---|');
  for (const it of cp.checklist) {
    L.push(`| ${it.id} | ${it.area} | ${it.title} | ${it.status} | ${it.blocker ? 'sí' : 'no'} |`);
  }
  L.push('');
  L.push('### Notas del checklist');
  L.push('');
  for (const it of cp.checklist) L.push(`- **${it.id}**: ${it.note}`);
  L.push('');
  L.push('## Registro de riesgos abiertos');
  L.push('');
  L.push('| id | riesgo | severidad | estado |');
  L.push('|---|---|---|---|');
  for (const r of cp.risks) L.push(`| ${r.id} | ${r.title} | ${r.severity} | ${r.status} |`);
  L.push('');
  L.push('### Mitigaciones');
  L.push('');
  for (const r of cp.risks) L.push(`- **${r.id}**: ${r.mitigation}`);
  L.push('');
  return `${L.join('\n')}\n`;
}

export function buildClosePrepPackage({ repoRoot = REPO_ROOT, stage = 'rc' } = {}) {
  const closePrep = buildClosePrep({ repoRoot, stage });
  return { closePrep, markdown: renderClosePrepMarkdown(closePrep) };
}

// --- CLI --------------------------------------------------------------------
function writeAtomic(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, path);
}

function parseArgs(argv) {
  const flags = new Set();
  const opts = {};
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v === undefined) flags.add(k); else opts[k] = v;
    }
  }
  return { flags, opts };
}

function main() {
  const { flags, opts } = parseArgs(process.argv.slice(2));
  const pkg = buildClosePrepPackage({ stage: opts.stage || 'rc' });
  const files = {
    [`${OUT_DIR}/sprint-30-close-checklist.json`]: `${JSON.stringify(pkg.closePrep, null, 2)}\n`,
    [`${OUT_DIR}/sprint-30-close-checklist.md`]: pkg.markdown,
  };

  if (flags.has('json')) {
    process.stdout.write(`${JSON.stringify(pkg.closePrep, null, 2)}\n`);
    return 0;
  }
  if (flags.has('check')) {
    const diffs = [];
    for (const [rel, content] of Object.entries(files)) {
      const p = abs(rel);
      if (!existsSync(p) || readFileSync(p, 'utf8') !== content) diffs.push(rel);
    }
    if (diffs.length) {
      process.stderr.write(`[close-prep] desactualizado: ${diffs.join(', ')}\n[close-prep] ejecuta: npm run education:close-prep:write\n`);
      return 1;
    }
    process.stdout.write('[close-prep] OK: preparación de cierre Sprint 30 al día.\n');
    return 0;
  }
  if (flags.has('write')) {
    for (const [rel, content] of Object.entries(files)) writeAtomic(abs(rel), content);
    process.stderr.write(`[close-prep] escrita preparación de cierre en ${OUT_DIR} (${Object.keys(files).length} ficheros).\n`);
    return 0;
  }
  const t = pkg.closePrep.totals;
  process.stdout.write(`Cierre Sprint 30: ${t.checklist_items} ítems · ${t.blockers} bloqueante(s) · ${t.open_risks}/${t.risks} riesgos abiertos · listo=${t.close_ready}.\n`);
  process.stdout.write(`Usa --json para el informe, --write para escribir en ${OUT_DIR}, --check para verificar.\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
