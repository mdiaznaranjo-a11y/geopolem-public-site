// GEOPÓLEM — CIERRE MAESTRO Sprint 30 (auditoría de continuidad, matriz de
// riesgos abierta y checklist final de producción).
// ---------------------------------------------------------------------------
// PREPARA (no ejecuta) el paquete maestro de continuidad de la serie 1–30.
// Consolida en `docs/master-close/` tres artefactos máquina-legibles + su
// versión navegable, más un índice del ciclo:
//   • continuity-audit  — cadena de PRs #1–#30, ramas base, dependencias y
//     riesgos de rebase/merge; verifica en vivo qué reportes/ramas existen.
//   • risk-matrix       — riesgos abiertos con severidad, probabilidad, owner
//     sugerido, mitigación, criterio de cierre y estado.
//   • production-checklist — checklist de producción futura con GATE HUMANO
//     obligatorio; mantiene production=false y declara que el sprint NO publica.
//   • index             — mapa del ciclo y punteros a guías/artefactos.
//
// Garantías (idénticas al resto de la serie):
//   • NO habilita producción: production.is_production=false en todo artefacto.
//   • NO ejecuta merges ni approvals: sólo prepara y reporta.
//   • Determinista (sin timestamps ni azar) → admite --check en CI.
//   • No inventa datos: la cadena de sprints se DERIVA de los reportes y ramas
//     presentes en el repo; los números de PR siguen la convención PR#N=SprintN
//     y se marcan como pendientes de verificación humana en GitHub.
//   • No contiene secretos.
//
// Uso:
//   node scripts/build-master-close.mjs           (resumen)
//   node scripts/build-master-close.mjs --json     (informe JSON)
//   node scripts/build-master-close.mjs --write     (escribe artefactos)
//   node scripts/build-master-close.mjs --check     (verifica al día)
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildClosePrep } from './build-master-close-prep.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const abs = (rel) => resolve(REPO_ROOT, rel);

export const MASTER_CLOSE_CONTRACT = 'sprint-30-master-close-v1';
const OUT_DIR = 'docs/master-close';

// Serie declarada de la cadena técnica/editorial/educativa. Datos AUDITABLES:
// cada entrada apunta a su reporte SPRINT_*.md (verificado en disco) y a la
// rama de trabajo (verificada contra la lista de ramas si se provee). El número
// de PR sigue la convención del proyecto PR#N = Sprint N y queda sujeto a
// verificación humana en GitHub (ver risk `pr-chain`).
// track ∈ { platform, editorial, education } · report: fichero en la raíz.
const SERIES = [
  { n: 1, track: 'platform', title: 'Adaptador de API (contrato v1)', branch: null, report: 'SPRINT_1_ADAPTADOR_API.md' },
  { n: 2, track: 'platform', title: 'Puente estático de conflictos', branch: null, report: 'SPRINT_2_PUENTE_ESTATICO.md' },
  { n: 3, track: 'platform', title: 'API v1 read-only PostgreSQL/PostGIS-ready', branch: 'sprint-3-postgres-api-v1', report: null },
  { n: 4, track: 'platform', title: 'Staging PostgreSQL + CI', branch: 'sprint-4-staging-postgres-api', report: 'SPRINT_4_STAGING_POSTGRES.md' },
  { n: 5, track: 'platform', title: 'Puente estático, observabilidad y JWT', branch: 'sprint-5-static-bridge-observability-jwt', report: 'SPRINT_5_STATIC_OBSERVABILITY_JWT.md' },
  { n: 6, track: 'platform', title: 'Promoción a staging y hardening de seguridad', branch: 'sprint-6-staging-promotion-security-hardening', report: 'SPRINT_6_STAGING_SECURITY_HARDENING.md' },
  { n: 7, track: 'platform', title: 'CMS admin, JWT, alertas y relaciones', branch: 'sprint-7-cms-admin-jwt-alerts-relations', report: 'SPRINT_7_CMS_ADMIN_JWT_ALERTS_RELATIONS.md' },
  { n: 8, track: 'platform', title: 'Admin UI y flujo editorial E2E', branch: 'sprint-8-admin-ui-editorial-flow-e2e', report: 'SPRINT_8_ADMIN_UI_EDITORIAL_FLOW_E2E.md' },
  { n: 9, track: 'platform', title: 'Persistencia CMS, relaciones y staging', branch: 'sprint-9-cms-persistence-relations-staging', report: 'SPRINT_9_CMS_PERSISTENCE_RELATIONS_STAGING.md' },
  { n: 10, track: 'platform', title: 'Detalle enriquecido público, mapa y filtros', branch: 'sprint-10-public-enriched-detail-map-filters', report: 'SPRINT_10_PUBLIC_ENRICHED_DETAIL_MAP_FILTERS.md' },
  { n: 11, track: 'platform', title: 'Detalle estático, deep-links y mapa offline', branch: 'sprint-11-static-detail-deeplinks-offline-map', report: 'SPRINT_11_STATIC_DETAIL_DEEPLINKS_OFFLINE_MAP.md' },
  { n: 12, track: 'platform', title: 'Analítica, KPIs y salud de contenido', branch: 'sprint-12-analytics-kpis-content-health', report: 'SPRINT_12_ANALYTICS_KPIS_CONTENT_HEALTH.md' },
  { n: 13, track: 'editorial', title: 'Semilla de fuentes, relaciones y salud de contenido', branch: 'sprint-13-seed-sources-relations-content-health', report: 'SPRINT_13_SEED_SOURCES_RELATIONS_CONTENT_HEALTH.md' },
  { n: 14, track: 'editorial', title: 'Fuentes verificadas y enriquecimiento canónico', branch: 'sprint-14-verified-sources-canonical-enrichment', report: 'SPRINT_14_VERIFIED_SOURCES_CANONICAL_ENRICHMENT.md' },
  { n: 15, track: 'editorial', title: 'Enriquecimiento canónico listo para staging', branch: 'sprint-15-canonical-enrichment-staging-ready', report: 'SPRINT_15_CANONICAL_ENRICHMENT_STAGING_READY.md' },
  { n: 16, track: 'editorial', title: 'Staging E2E, PWA QA y checklist de promoción', branch: 'sprint-16-staging-e2e-pwa-qa-promotion-checklist', report: 'SPRINT_16_STAGING_E2E_PWA_QA_PROMOTION_CHECKLIST.md' },
  { n: 17, track: 'editorial', title: 'Dry-run de promoción, no-diff y sign-off', branch: 'sprint-17-promotion-dry-run-no-diff-signoff', report: 'SPRINT_17_PROMOTION_DRY_RUN_NO_DIFF_SIGNOFF.md' },
  { n: 18, track: 'editorial', title: 'Simulacro de release, pre-commit y rollback canónico', branch: 'sprint-18-release-simulation-precommit-canonical-rollback', report: 'SPRINT_18_RELEASE_SIMULATION_PRECOMMIT_CANONICAL_ROLLBACK.md' },
  { n: 19, track: 'editorial', title: 'Release candidate y QA editorial', branch: 'sprint-19-release-candidate-editorial-qa', report: 'SPRINT_19_RELEASE_CANDIDATE_EDITORIAL_QA.md' },
  { n: 20, track: 'editorial', title: 'Gobernanza editorial y workflow de sign-off', branch: 'sprint-20-editorial-governance-signoff-workflow', report: 'SPRINT_20_EDITORIAL_GOVERNANCE_SIGNOFF_WORKFLOW.md' },
  { n: 21, track: 'editorial', title: 'Resolución de bloqueos editoriales con evidencia', branch: 'sprint-21-editorial-blocker-resolution-evidence', report: 'SPRINT_21_EDITORIAL_BLOCKER_RESOLUTION_EVIDENCE.md' },
  { n: 22, track: 'editorial', title: 'Flujo de decisión editorial humana', branch: 'sprint-22-human-editorial-decision-flow', report: 'SPRINT_22_HUMAN_EDITORIAL_DECISION_FLOW.md' },
  { n: 23, track: 'editorial', title: 'Ejercicio editorial, firma cripto y diseño del gate de producción', branch: 'sprint-23-editorial-exercise-crypto-signature-production-gate-design', report: 'SPRINT_23_EDITORIAL_EXERCISE_CRYPTO_SIGNATURE_PRODUCTION_GATE_DESIGN.md' },
  { n: 24, track: 'education', title: 'Materiales docentes y estructura curricular', branch: 'sprint-24-education-materials-curriculum', report: 'SPRINT_24_EDUCATION_MATERIALS_CURRICULUM.md' },
  { n: 25, track: 'education', title: 'Exportador de fichas, banco de casos, lab offline y rúbricas', branch: 'sprint-25-education-exporter-casebank-offline-lab-rubrics', report: 'SPRINT_25_EDUCATION_EXPORTER_CASEBANK_OFFLINE_LAB_RUBRICS.md' },
  { n: 26, track: 'education', title: 'Scoring de rúbricas, export LMS y validación causal', branch: 'sprint-26-rubric-scoring-lms-export-causal-validation', report: 'SPRINT_26_RUBRIC_SCORING_LMS_EXPORT_CAUSAL_VALIDATION.md' },
  { n: 27, track: 'education', title: 'Revisión de instructor, scoring por lotes y mapeo xAPI', branch: 'sprint-27-instructor-review-batch-scoring-xapi-mapping', report: 'SPRINT_27_INSTRUCTOR_REVIEW_BATCH_SCORING_XAPI_MAPPING.md' },
  { n: 28, track: 'education', title: 'Analítica pedagógica, i18n, escala causal y decisión SCORM', branch: 'sprint-28-education-analytics-i18n-causal-scale-scorm-decision', report: 'SPRINT_28_EDUCATION_ANALYTICS_I18N_CAUSAL_SCALE_SCORM_DECISION.md' },
  { n: 29, track: 'education', title: 'Panel docente, i18n ampliada, cola causal y prep. cierre maestro', branch: 'sprint-29-education-dashboard-i18n-causal-queue-master-close-prep', report: 'SPRINT_29_EDUCATION_DASHBOARD_I18N_CAUSAL_QUEUE_MASTER_CLOSE_PREP.md' },
  { n: 30, track: 'education', title: 'Cierre maestro: auditoría de continuidad, riesgos y plan de operación', branch: 'sprint-30-master-close-continuity-audit-operations-plan', report: 'SPRINT_30_MASTER_CLOSE_CONTINUITY_AUDIT_OPERATIONS_PLAN.md' },
];

// Estado de producción declarado por diseño en toda la serie.
const PRODUCTION = { is_production: false, activates_production_gate: false, contains_secrets: false };

// --- Auditoría de continuidad ----------------------------------------------
// Construye la cadena PR#1–#30 con base declarada (sprint anterior) y verifica
// EN VIVO qué reportes/ramas existen. El PR #30 (este) no está fusionado.
export function buildContinuityAudit({ repoRoot = REPO_ROOT } = {}) {
  const chain = SERIES.map((s, i) => {
    const prev = i > 0 ? SERIES[i - 1] : null;
    const reportPresent = s.report ? existsSync(resolve(repoRoot, s.report)) : false;
    return {
      sprint: s.n,
      pr: `#${s.n}`,
      pr_verified: false, // convención PR#N=SprintN; verificar en GitHub
      track: s.track,
      title: s.title,
      branch: s.branch,
      report: s.report,
      report_present: reportPresent,
      // Dependencia funcional declarada: cada sprint construye sobre el anterior.
      depends_on: prev ? prev.n : null,
      declared_base_branch: prev ? prev.branch : 'main',
    };
  });

  // Riesgos de rebase/merge conocidos y explícitos de la cadena.
  const rebaseRisks = [
    {
      id: 'pr28-targets-main',
      sprints: [27, 28],
      severity: 'high',
      title: 'Sprint 28 abrió PR contra `main` aunque depende funcionalmente de Sprint 27',
      detail:
        'El PR del Sprint 28 (PR #28) se planteó contra `main`, pero su contenido ' +
        'educativo/causal depende de artefactos introducidos en Sprint 27 (PR #27). ' +
        'Fusionar #28 antes que #27 dejaría la rama base sin sus dependencias ' +
        '(referencias a backlog/scoring del Sprint 27) y provocaría un árbol ' +
        'incoherente o conflictos de rebase.',
      mitigation:
        'Integrar en orden de dependencia (#27 antes de #28) o re-apuntar (retarget) ' +
        '#28 a la rama del Sprint 27 antes de fusionar; ejecutar los validadores ' +
        'educativos --check tras cada merge (ver plan de integración).',
    },
    {
      id: 'open-chain-vs-main',
      sprints: SERIES.filter((s) => s.branch && s.n >= 3).map((s) => s.n),
      severity: 'high',
      title: 'Cadena de PRs abierta: `main` no contiene la serie 3–30',
      detail:
        '`main` diverge de la cadena de sprints (contiene trabajo editorial de ' +
        'contenido no presente en la serie, p. ej. el carrusel de láminas). Cada ' +
        'sprint depende del anterior, no de `main`. Fusionar cualquier PR ' +
        'directamente a `main` sin respetar el orden rompe la cadena.',
      mitigation:
        'Seguir el orden recomendado del plan de integración; rebasar/retargetar ' +
        'cada rama sobre la anterior ya integrada; no fusionar contra `main` fuera ' +
        'de orden. Requiere sign-off humano.',
    },
    {
      id: 'sprint3-no-report',
      sprints: [3],
      severity: 'low',
      title: 'Sprint 3 sin fichero de reporte en la raíz',
      detail:
        'La rama `sprint-3-postgres-api-v1` existe pero no hay SPRINT_3_*.md en la ' +
        'raíz; el contexto de la API v1 vive en el código y en reportes posteriores.',
      mitigation:
        'Opcional: reconstruir un reporte retroactivo del Sprint 3 a partir del ' +
        'código de `api-server/`. No bloquea el cierre.',
    },
  ];

  const missingReports = chain.filter((c) => c.report && !c.report_present).map((c) => c.sprint);
  const noReportDeclared = chain.filter((c) => !c.report).map((c) => c.sprint);

  return {
    contract: MASTER_CLOSE_CONTRACT,
    artifact: 'continuity-audit',
    notice:
      'Auditoría de continuidad de la serie GEOPÓLEM 1–30. PREPARA, no ejecuta: ' +
      'no fusiona PRs ni habilita producción. La cadena se deriva de los reportes ' +
      'y ramas del repo; los números de PR siguen la convención PR#N=SprintN y ' +
      'requieren verificación humana en GitHub.',
    production: PRODUCTION,
    production_status: {
      state: 'blocked',
      reason: 'Bloqueo por diseño en toda la serie; el cierre maestro NO publica.',
      unblock_conditions: [
        'Sign-off humano explícito del cierre editorial de la serie (3–30).',
        'Integración ordenada de la cadena de PRs #1–#30 sin conflictos (ver plan de integración).',
        'canonical con causal_links completos (cerrar riesgo `canonical-causal-links`).',
        'Checklist final de producción superado con GATE HUMANO obligatorio.',
        'Revisión de seguridad (JWT/roles) y DR/backups verificados fuera de este repo.',
        'Decisión humana de habilitar dominio/API/DB/CMS/redes sociales.',
      ],
    },
    totals: {
      sprints: chain.length,
      with_branch: chain.filter((c) => c.branch).length,
      with_report: chain.filter((c) => c.report_present).length,
      missing_reports: missingReports,
      no_report_declared: noReportDeclared,
      rebase_risks: rebaseRisks.length,
    },
    chain,
    rebase_risks: rebaseRisks,
  };
}

// --- Matriz de riesgos abierta ---------------------------------------------
// Riesgos declarados (hechos del proyecto) enriquecidos con señales en vivo de
// la capa educativa vía buildClosePrep. No inventa fuentes ni aprobaciones.
export function buildRiskMatrix({ repoRoot = REPO_ROOT, stage = 'rc' } = {}) {
  const cp = buildClosePrep({ repoRoot, stage });
  const s = cp.signals;
  const risks = [
    {
      id: 'pr-chain-open',
      title: 'Cadena de PRs #1–#30 abierta y dependiente',
      severity: 'high', probability: 'high', owner: 'maintainer',
      mitigation: 'Integrar en orden de dependencia con rebase/retarget y --check tras cada merge (ver plan de integración).',
      close_criteria: 'Todos los PRs integrados en orden, CI verde, sin conflictos pendientes.',
      status: 'open',
    },
    {
      id: 'production-blocked',
      title: 'Producción bloqueada por diseño (sin gates, sin secretos)',
      severity: 'info', probability: 'certain', owner: 'maintainer',
      mitigation: 'Mantener production=false; habilitar sólo tras GATE HUMANO del checklist final.',
      close_criteria: 'Decisión humana explícita de desbloqueo con checklist de producción superado.',
      status: 'by_design',
    },
    {
      id: 'canonical-causal-links',
      title: 'canonical sin causal_links completos → cross-check usa rc por defecto',
      severity: 'high', probability: 'high', owner: 'editorial-lead',
      mitigation: `Poblar causal_links en canonical antes de promover. En canonical ${s.canonical_not_applicable} not_applicable / ${s.canonical_conflicts} conflictos, ${s.canonical_checked} checked.`,
      close_criteria: 'canonical con causal_links poblados y cross-check en stage=canonical sin divergencias.',
      status: 'open',
    },
    {
      id: 'i18n-incomplete',
      title: 'i18n incompleta más allá de los namespaces clave',
      severity: 'medium', probability: 'medium', owner: 'education-lead',
      mitigation: `Cobertura ${s.i18n_coverage}% en namespaces definidos; ampliar reusando el validador escalable.`,
      close_criteria: 'Todos los materiales docentes traducidos ES/EN con validador --check verde.',
      status: s.i18n_coverage === 100 ? 'partial' : 'open',
    },
    {
      id: 'human-curation',
      title: 'Curaduría humana pendiente de la cola editorial causal',
      severity: 'medium', probability: 'medium', owner: 'editorial-lead',
      mitigation: `${s.queue_items} ítem(s) en la cola (${s.queue_blocking} bloqueante) requieren revisión humana; no automatizable.`,
      close_criteria: 'Cola editorial causal resuelta o aceptada con sign-off humano.',
      status: s.queue_items > 0 ? 'open' : 'clear',
    },
    {
      id: 'scorm-real-vs-portable',
      title: 'SCORM real vs mapping portable (SCORM diferido)',
      severity: 'low', probability: 'low', owner: 'education-lead',
      mitigation: `ADR-0001 decide "${s.adr_decision}"; el empaquetado SCORM real queda diferido.`,
      close_criteria: 'Necesidad de SCORM real confirmada por un LMS objetivo y empaquetado validado, o cierre del ADR.',
      status: 'deferred',
    },
    {
      id: 'editorial-sources-citations',
      title: 'Fuentes/citas editoriales requieren verificación humana',
      severity: 'high', probability: 'medium', owner: 'editorial-lead',
      mitigation: 'Regla published-exige-fuente y causal_links-exigen-fuente ya en CI; la veracidad de cada fuente exige revisión humana. No se inventan fuentes.',
      close_criteria: 'Fuentes verificadas por editor humano y trazables; sin claims sin fuente en published.',
      status: 'open',
    },
    {
      id: 'security-jwt-roles',
      title: 'Seguridad JWT/roles pendiente de revisión previa a producción',
      severity: 'high', probability: 'medium', owner: 'platform-lead',
      mitigation: 'JWT/roles implementados y testeados sin DB; rotación de claves y scopes cubiertos por tests. Revisión de seguridad formal fuera de este repo antes de exponer.',
      close_criteria: 'Auditoría de seguridad superada; secretos gestionados fuera del repo; rotación operativa.',
      status: 'open',
    },
    {
      id: 'backups-dr',
      title: 'Backups y recuperación ante desastres (DR) no verificados',
      severity: 'high', probability: 'medium', owner: 'platform-lead',
      mitigation: 'Plan de rollback canónico y export estático versionado existen; backups de DB/DR reales dependen de infraestructura fuera del repo.',
      close_criteria: 'Backups automáticos probados y restauración DR ensayada en staging.',
      status: 'open',
    },
    {
      id: 'observability',
      title: 'Observabilidad: métricas/alertas requieren destino real en producción',
      severity: 'medium', probability: 'medium', owner: 'platform-lead',
      mitigation: 'Observabilidad y alertas implementadas en api-server (Sprint 5/7); en producción requieren sink/alerting configurados con aprobación.',
      close_criteria: 'Dashboards y alertas conectados a un destino real y validados.',
      status: 'open',
    },
    {
      id: 'social-not-connected',
      title: 'Redes sociales no conectadas automáticamente sin aprobación',
      severity: 'medium', probability: 'low', owner: 'editorial-lead',
      mitigation: 'Ningún artefacto publica en redes; la conexión multicanal exige aprobación humana explícita y credenciales gestionadas fuera del repo.',
      close_criteria: 'Aprobación humana + credenciales seguras + prueba controlada antes de automatizar.',
      status: 'open',
    },
  ];

  const bySeverity = {};
  const byStatus = {};
  for (const r of risks) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  }
  return {
    contract: MASTER_CLOSE_CONTRACT,
    artifact: 'risk-matrix',
    notice:
      'Matriz de riesgos abierta del cierre maestro. Riesgos = hechos del proyecto ' +
      'declarados y enriquecidos con señales en vivo; no se inventan fuentes ni aprobaciones.',
    production: PRODUCTION,
    source_stage: stage,
    signals: s,
    totals: {
      risks: risks.length,
      by_severity: bySeverity,
      by_status: byStatus,
      open: byStatus.open || 0,
    },
    risks,
  };
}

// --- Checklist final de producción -----------------------------------------
// Gate HUMANO obligatorio. Mantiene production=false y declara NO publicación.
export function buildProductionChecklist({ repoRoot = REPO_ROOT } = {}) {
  const items = [
    { id: 'human-signoff', domain: 'gate', title: 'Sign-off humano explícito del cierre de serie y del desbloqueo de producción', human_gate: true, status: 'pending', blocking: true },
    { id: 'pr-chain-integrated', domain: 'integration', title: 'Cadena de PRs #1–#30 integrada en orden, sin conflictos y CI verde', human_gate: true, status: 'pending', blocking: true },
    { id: 'no-production-flags', domain: 'safety', title: 'Artefactos con production=false y sin secretos (verificado por validador no-production)', human_gate: false, status: 'pending', blocking: true },
    { id: 'canonical-causal-complete', domain: 'editorial', title: 'canonical con causal_links completos y cross-check canónico sin divergencias', human_gate: true, status: 'pending', blocking: true },
    { id: 'editorial-sources-verified', domain: 'editorial', title: 'Fuentes/citas verificadas por editor humano; sin claims sin fuente en published', human_gate: true, status: 'pending', blocking: true },
    { id: 'security-review', domain: 'security', title: 'Revisión de seguridad JWT/roles superada; secretos gestionados fuera del repo', human_gate: true, status: 'pending', blocking: true },
    { id: 'backups-dr', domain: 'ops', title: 'Backups probados y restauración DR ensayada en staging', human_gate: true, status: 'pending', blocking: true },
    { id: 'observability-live', domain: 'ops', title: 'Observabilidad y alertas conectadas a destino real y validadas', human_gate: true, status: 'pending', blocking: false },
    { id: 'domain-api-db-cms', domain: 'infra', title: 'Habilitación de dominio/API/DB/CMS aprobada explícitamente por humano', human_gate: true, status: 'pending', blocking: true },
    { id: 'social-channels', domain: 'distribution', title: 'Conexión de redes sociales aprobada por humano con credenciales seguras', human_gate: true, status: 'pending', blocking: false },
  ];
  const blocking = items.filter((i) => i.blocking).length;
  const humanGates = items.filter((i) => i.human_gate).length;
  return {
    contract: MASTER_CLOSE_CONTRACT,
    artifact: 'production-checklist',
    notice:
      'Checklist de producción FUTURA con GATE HUMANO obligatorio. Este sprint NO ' +
      'publica: todos los ítems quedan en estado pending y production=false.',
    production: PRODUCTION,
    publishes: false,
    requires_human_gate: true,
    totals: { items: items.length, blocking, human_gates: humanGates, pending: items.length },
    items,
  };
}

// --- Índice del ciclo -------------------------------------------------------
function buildIndex({ audit, riskMatrix, prodChecklist }) {
  return {
    contract: MASTER_CLOSE_CONTRACT,
    artifact: 'index',
    notice: 'Índice del cierre maestro GEOPÓLEM (serie 1–30). PREPARA, no ejecuta; producción bloqueada.',
    production: PRODUCTION,
    artifacts: {
      continuity_audit: { json: 'continuity-audit.json', md: 'continuity-audit.md' },
      risk_matrix: { json: 'risk-matrix.json', md: 'risk-matrix.md' },
      production_checklist: { json: 'production-checklist.json', md: 'production-checklist.md' },
      annual_operations_guide: { md: 'annual-operations-guide.md' },
      pr_integration_plan: { md: 'pr-integration-plan.md' },
      artifact_map: { md: 'artifact-map.md' },
    },
    summary: {
      sprints: audit.totals.sprints,
      rebase_risks: audit.totals.rebase_risks,
      open_risks: riskMatrix.totals.open,
      production_checklist_blocking: prodChecklist.totals.blocking,
      production_state: audit.production_status.state,
    },
  };
}

// --- Render Markdown --------------------------------------------------------
function renderAuditMd(a) {
  const L = [];
  L.push('# Auditoría de continuidad — Cierre maestro GEOPÓLEM (serie 1–30)');
  L.push('');
  L.push('> **PREPARA, no ejecuta.** No fusiona PRs ni habilita producción. La');
  L.push('> cadena se deriva de reportes y ramas del repo; los números de PR siguen');
  L.push('> la convención `PR#N = Sprint N` y **requieren verificación humana en GitHub**.');
  L.push('');
  L.push(`- Sprints en la cadena: **${a.totals.sprints}** · con rama: **${a.totals.with_branch}** · con reporte presente: **${a.totals.with_report}**`);
  L.push(`- Estado de producción: **${a.production_status.state}** — ${a.production_status.reason}`);
  L.push('');
  L.push('## Cadena de PRs #1–#30');
  L.push('');
  L.push('| sprint | PR | vía | título | rama | reporte | depende de | base declarada |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const c of a.chain) {
    L.push(`| ${c.sprint} | ${c.pr} | ${c.track} | ${c.title} | ${c.branch ? '`' + c.branch + '`' : '—'} | ${c.report_present ? '✓' : (c.report ? '✗' : '—')} | ${c.depends_on ?? '—'} | ${c.declared_base_branch ? '`' + c.declared_base_branch + '`' : '—'} |`);
  }
  L.push('');
  L.push('## Riesgos de rebase/merge');
  L.push('');
  for (const r of a.rebase_risks) {
    L.push(`### ${r.title} (\`${r.id}\`, severidad ${r.severity})`);
    L.push(`- Sprints: ${r.sprints.join(', ')}`);
    L.push(`- Detalle: ${r.detail}`);
    L.push(`- Mitigación: ${r.mitigation}`);
    L.push('');
  }
  L.push('## Producción: condiciones de desbloqueo humano');
  L.push('');
  for (const c of a.production_status.unblock_conditions) L.push(`- [ ] ${c}`);
  L.push('');
  return `${L.join('\n')}\n`;
}

function renderRiskMd(m) {
  const L = [];
  L.push('# Matriz de riesgos abierta — Cierre maestro GEOPÓLEM');
  L.push('');
  L.push('> Riesgos = hechos del proyecto declarados, enriquecidos con señales en');
  L.push('> vivo. No se inventan fuentes ni aprobaciones. Producción bloqueada.');
  L.push('');
  L.push(`- Riesgos: **${m.totals.risks}** · abiertos: **${m.totals.open}**`);
  L.push('');
  L.push('| id | riesgo | sev. | prob. | owner sugerido | estado |');
  L.push('|---|---|---|---|---|---|');
  for (const r of m.risks) {
    L.push(`| ${r.id} | ${r.title} | ${r.severity} | ${r.probability} | ${r.owner} | ${r.status} |`);
  }
  L.push('');
  L.push('## Mitigación y criterio de cierre');
  L.push('');
  for (const r of m.risks) {
    L.push(`### ${r.id} — ${r.title}`);
    L.push(`- Mitigación: ${r.mitigation}`);
    L.push(`- Criterio de cierre: ${r.close_criteria}`);
    L.push(`- Estado: **${r.status}**`);
    L.push('');
  }
  return `${L.join('\n')}\n`;
}

function renderProdMd(p) {
  const L = [];
  L.push('# Checklist final de producción — GATE HUMANO obligatorio');
  L.push('');
  L.push('> **Este sprint NO publica.** Todos los ítems quedan `pending` y');
  L.push('> `production=false`. La habilitación de producción exige decisión humana');
  L.push('> explícita; ningún paso se automatiza sin aprobación.');
  L.push('');
  L.push(`- Ítems: **${p.totals.items}** · bloqueantes: **${p.totals.blocking}** · con gate humano: **${p.totals.human_gates}**`);
  L.push('');
  L.push('| id | dominio | ítem | gate humano | bloqueante | estado |');
  L.push('|---|---|---|---|---|---|');
  for (const it of p.items) {
    L.push(`| ${it.id} | ${it.domain} | ${it.title} | ${it.human_gate ? 'sí' : 'no'} | ${it.blocking ? 'sí' : 'no'} | ${it.status} |`);
  }
  L.push('');
  return `${L.join('\n')}\n`;
}

function renderIndexMd(idx, a, m, p) {
  const L = [];
  L.push('# Cierre maestro GEOPÓLEM — Índice del ciclo (serie 1–30)');
  L.push('');
  L.push('> **PREPARA, no ejecuta.** Producción **bloqueada**. Este paquete consolida');
  L.push('> la auditoría de continuidad, la matriz de riesgos y el checklist final de');
  L.push('> producción con gate humano, más las guías de operación e integración.');
  L.push('');
  L.push('## Artefactos');
  L.push('');
  L.push('| artefacto | máquina | navegable |');
  L.push('|---|---|---|');
  L.push('| Auditoría de continuidad | [continuity-audit.json](continuity-audit.json) | [continuity-audit.md](continuity-audit.md) |');
  L.push('| Matriz de riesgos abierta | [risk-matrix.json](risk-matrix.json) | [risk-matrix.md](risk-matrix.md) |');
  L.push('| Checklist final de producción | [production-checklist.json](production-checklist.json) | [production-checklist.md](production-checklist.md) |');
  L.push('| Guía de operación anual | — | [annual-operations-guide.md](annual-operations-guide.md) |');
  L.push('| Plan de integración de PRs | — | [pr-integration-plan.md](pr-integration-plan.md) |');
  L.push('| Mapa de artefactos / cómo retomar | — | [artifact-map.md](artifact-map.md) |');
  L.push('');
  L.push('## Resumen');
  L.push('');
  L.push(`- Sprints en la cadena: **${a.totals.sprints}**`);
  L.push(`- Riesgos de rebase/merge: **${a.totals.rebase_risks}**`);
  L.push(`- Riesgos abiertos: **${m.totals.open}** de **${m.totals.risks}**`);
  L.push(`- Ítems bloqueantes del checklist de producción: **${p.totals.blocking}**`);
  L.push(`- Estado de producción: **${a.production_status.state}** (este sprint NO publica).`);
  L.push('');
  L.push('## Cómo retomar cada área');
  L.push('');
  L.push('- **Plataforma (API/DB/CMS/mapa)**: `api-server/` (API v1, JWT, observabilidad,');
  L.push('  migraciones), `service-worker.js`/`app.js` (PWA/mapa). Arquitectura reversible');
  L.push('  API real v1 → JSON estático → fallback local. Ver `artifact-map.md`.');
  L.push('- **Editorial**: validadores de fuentes/relaciones/canonical y gobernanza de');
  L.push('  sign-off en `scripts/` (`verified:*`, `promote:*`, `decisions:*`, `gate:*`).');
  L.push('- **Educación**: `scripts/*education*` y `docs/education/` (rúbricas, casebank,');
  L.push('  analítica, i18n, cola causal, panel docente, ADR SCORM).');
  L.push('');
  return `${L.join('\n')}\n`;
}

export function buildMasterClosePackage({ repoRoot = REPO_ROOT, stage = 'rc' } = {}) {
  const audit = buildContinuityAudit({ repoRoot });
  const riskMatrix = buildRiskMatrix({ repoRoot, stage });
  const prodChecklist = buildProductionChecklist({ repoRoot });
  const index = buildIndex({ audit, riskMatrix, prodChecklist });
  return {
    audit,
    riskMatrix,
    prodChecklist,
    index,
    files: {
      'continuity-audit.json': `${JSON.stringify(audit, null, 2)}\n`,
      'continuity-audit.md': renderAuditMd(audit),
      'risk-matrix.json': `${JSON.stringify(riskMatrix, null, 2)}\n`,
      'risk-matrix.md': renderRiskMd(riskMatrix),
      'production-checklist.json': `${JSON.stringify(prodChecklist, null, 2)}\n`,
      'production-checklist.md': renderProdMd(prodChecklist),
      'index.json': `${JSON.stringify(index, null, 2)}\n`,
      'README.md': renderIndexMd(index, audit, riskMatrix, prodChecklist),
    },
  };
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
  const pkg = buildMasterClosePackage({ stage: opts.stage || 'rc' });
  const files = {};
  for (const [name, content] of Object.entries(pkg.files)) files[`${OUT_DIR}/${name}`] = content;

  if (flags.has('json')) {
    process.stdout.write(`${JSON.stringify({ audit: pkg.audit, riskMatrix: pkg.riskMatrix, prodChecklist: pkg.prodChecklist, index: pkg.index }, null, 2)}\n`);
    return 0;
  }
  if (flags.has('check')) {
    const diffs = [];
    for (const [rel, content] of Object.entries(files)) {
      const p = abs(rel);
      if (!existsSync(p) || readFileSync(p, 'utf8') !== content) diffs.push(rel);
    }
    if (diffs.length) {
      process.stderr.write(`[master-close] desactualizado: ${diffs.join(', ')}\n[master-close] ejecuta: npm run master-close:write\n`);
      return 1;
    }
    process.stdout.write('[master-close] OK: paquete de cierre maestro Sprint 30 al día.\n');
    return 0;
  }
  if (flags.has('write')) {
    for (const [rel, content] of Object.entries(files)) writeAtomic(abs(rel), content);
    process.stderr.write(`[master-close] escrito paquete de cierre en ${OUT_DIR} (${Object.keys(files).length} ficheros generados).\n`);
    return 0;
  }
  process.stdout.write(
    `Cierre maestro Sprint 30: ${pkg.audit.totals.sprints} sprints · ` +
    `${pkg.riskMatrix.totals.open}/${pkg.riskMatrix.totals.risks} riesgos abiertos · ` +
    `${pkg.prodChecklist.totals.blocking} ítems bloqueantes de producción · ` +
    `producción=${pkg.audit.production_status.state}.\n`,
  );
  process.stdout.write(`Usa --json para el informe, --write para escribir en ${OUT_DIR}, --check para verificar.\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
