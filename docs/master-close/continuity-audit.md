# Auditoría de continuidad — Cierre maestro GEOPÓLEM (serie 1–30)

> **PREPARA, no ejecuta.** No fusiona PRs ni habilita producción. La
> cadena se deriva de reportes y ramas del repo; los números de PR siguen
> la convención `PR#N = Sprint N` y **requieren verificación humana en GitHub**.

- Sprints en la cadena: **30** · con rama: **28** · con reporte presente: **29**
- Estado de producción: **blocked** — Bloqueo por diseño en toda la serie; el cierre maestro NO publica.

## Cadena de PRs #1–#30

| sprint | PR | vía | título | rama | reporte | depende de | base declarada |
|---|---|---|---|---|---|---|---|
| 1 | #1 | platform | Adaptador de API (contrato v1) | — | ✓ | — | `main` |
| 2 | #2 | platform | Puente estático de conflictos | — | ✓ | 1 | — |
| 3 | #3 | platform | API v1 read-only PostgreSQL/PostGIS-ready | `sprint-3-postgres-api-v1` | — | 2 | — |
| 4 | #4 | platform | Staging PostgreSQL + CI | `sprint-4-staging-postgres-api` | ✓ | 3 | `sprint-3-postgres-api-v1` |
| 5 | #5 | platform | Puente estático, observabilidad y JWT | `sprint-5-static-bridge-observability-jwt` | ✓ | 4 | `sprint-4-staging-postgres-api` |
| 6 | #6 | platform | Promoción a staging y hardening de seguridad | `sprint-6-staging-promotion-security-hardening` | ✓ | 5 | `sprint-5-static-bridge-observability-jwt` |
| 7 | #7 | platform | CMS admin, JWT, alertas y relaciones | `sprint-7-cms-admin-jwt-alerts-relations` | ✓ | 6 | `sprint-6-staging-promotion-security-hardening` |
| 8 | #8 | platform | Admin UI y flujo editorial E2E | `sprint-8-admin-ui-editorial-flow-e2e` | ✓ | 7 | `sprint-7-cms-admin-jwt-alerts-relations` |
| 9 | #9 | platform | Persistencia CMS, relaciones y staging | `sprint-9-cms-persistence-relations-staging` | ✓ | 8 | `sprint-8-admin-ui-editorial-flow-e2e` |
| 10 | #10 | platform | Detalle enriquecido público, mapa y filtros | `sprint-10-public-enriched-detail-map-filters` | ✓ | 9 | `sprint-9-cms-persistence-relations-staging` |
| 11 | #11 | platform | Detalle estático, deep-links y mapa offline | `sprint-11-static-detail-deeplinks-offline-map` | ✓ | 10 | `sprint-10-public-enriched-detail-map-filters` |
| 12 | #12 | platform | Analítica, KPIs y salud de contenido | `sprint-12-analytics-kpis-content-health` | ✓ | 11 | `sprint-11-static-detail-deeplinks-offline-map` |
| 13 | #13 | editorial | Semilla de fuentes, relaciones y salud de contenido | `sprint-13-seed-sources-relations-content-health` | ✓ | 12 | `sprint-12-analytics-kpis-content-health` |
| 14 | #14 | editorial | Fuentes verificadas y enriquecimiento canónico | `sprint-14-verified-sources-canonical-enrichment` | ✓ | 13 | `sprint-13-seed-sources-relations-content-health` |
| 15 | #15 | editorial | Enriquecimiento canónico listo para staging | `sprint-15-canonical-enrichment-staging-ready` | ✓ | 14 | `sprint-14-verified-sources-canonical-enrichment` |
| 16 | #16 | editorial | Staging E2E, PWA QA y checklist de promoción | `sprint-16-staging-e2e-pwa-qa-promotion-checklist` | ✓ | 15 | `sprint-15-canonical-enrichment-staging-ready` |
| 17 | #17 | editorial | Dry-run de promoción, no-diff y sign-off | `sprint-17-promotion-dry-run-no-diff-signoff` | ✓ | 16 | `sprint-16-staging-e2e-pwa-qa-promotion-checklist` |
| 18 | #18 | editorial | Simulacro de release, pre-commit y rollback canónico | `sprint-18-release-simulation-precommit-canonical-rollback` | ✓ | 17 | `sprint-17-promotion-dry-run-no-diff-signoff` |
| 19 | #19 | editorial | Release candidate y QA editorial | `sprint-19-release-candidate-editorial-qa` | ✓ | 18 | `sprint-18-release-simulation-precommit-canonical-rollback` |
| 20 | #20 | editorial | Gobernanza editorial y workflow de sign-off | `sprint-20-editorial-governance-signoff-workflow` | ✓ | 19 | `sprint-19-release-candidate-editorial-qa` |
| 21 | #21 | editorial | Resolución de bloqueos editoriales con evidencia | `sprint-21-editorial-blocker-resolution-evidence` | ✓ | 20 | `sprint-20-editorial-governance-signoff-workflow` |
| 22 | #22 | editorial | Flujo de decisión editorial humana | `sprint-22-human-editorial-decision-flow` | ✓ | 21 | `sprint-21-editorial-blocker-resolution-evidence` |
| 23 | #23 | editorial | Ejercicio editorial, firma cripto y diseño del gate de producción | `sprint-23-editorial-exercise-crypto-signature-production-gate-design` | ✓ | 22 | `sprint-22-human-editorial-decision-flow` |
| 24 | #24 | education | Materiales docentes y estructura curricular | `sprint-24-education-materials-curriculum` | ✓ | 23 | `sprint-23-editorial-exercise-crypto-signature-production-gate-design` |
| 25 | #25 | education | Exportador de fichas, banco de casos, lab offline y rúbricas | `sprint-25-education-exporter-casebank-offline-lab-rubrics` | ✓ | 24 | `sprint-24-education-materials-curriculum` |
| 26 | #26 | education | Scoring de rúbricas, export LMS y validación causal | `sprint-26-rubric-scoring-lms-export-causal-validation` | ✓ | 25 | `sprint-25-education-exporter-casebank-offline-lab-rubrics` |
| 27 | #27 | education | Revisión de instructor, scoring por lotes y mapeo xAPI | `sprint-27-instructor-review-batch-scoring-xapi-mapping` | ✓ | 26 | `sprint-26-rubric-scoring-lms-export-causal-validation` |
| 28 | #28 | education | Analítica pedagógica, i18n, escala causal y decisión SCORM | `sprint-28-education-analytics-i18n-causal-scale-scorm-decision` | ✓ | 27 | `sprint-27-instructor-review-batch-scoring-xapi-mapping` |
| 29 | #29 | education | Panel docente, i18n ampliada, cola causal y prep. cierre maestro | `sprint-29-education-dashboard-i18n-causal-queue-master-close-prep` | ✓ | 28 | `sprint-28-education-analytics-i18n-causal-scale-scorm-decision` |
| 30 | #30 | education | Cierre maestro: auditoría de continuidad, riesgos y plan de operación | `sprint-30-master-close-continuity-audit-operations-plan` | ✓ | 29 | `sprint-29-education-dashboard-i18n-causal-queue-master-close-prep` |

## Riesgos de rebase/merge

### Sprint 28 abrió PR contra `main` aunque depende funcionalmente de Sprint 27 (`pr28-targets-main`, severidad high)
- Sprints: 27, 28
- Detalle: El PR del Sprint 28 (PR #28) se planteó contra `main`, pero su contenido educativo/causal depende de artefactos introducidos en Sprint 27 (PR #27). Fusionar #28 antes que #27 dejaría la rama base sin sus dependencias (referencias a backlog/scoring del Sprint 27) y provocaría un árbol incoherente o conflictos de rebase.
- Mitigación: Integrar en orden de dependencia (#27 antes de #28) o re-apuntar (retarget) #28 a la rama del Sprint 27 antes de fusionar; ejecutar los validadores educativos --check tras cada merge (ver plan de integración).

### Cadena de PRs abierta: `main` no contiene la serie 3–30 (`open-chain-vs-main`, severidad high)
- Sprints: 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30
- Detalle: `main` diverge de la cadena de sprints (contiene trabajo editorial de contenido no presente en la serie, p. ej. el carrusel de láminas). Cada sprint depende del anterior, no de `main`. Fusionar cualquier PR directamente a `main` sin respetar el orden rompe la cadena.
- Mitigación: Seguir el orden recomendado del plan de integración; rebasar/retargetar cada rama sobre la anterior ya integrada; no fusionar contra `main` fuera de orden. Requiere sign-off humano.

### Sprint 3 sin fichero de reporte en la raíz (`sprint3-no-report`, severidad low)
- Sprints: 3
- Detalle: La rama `sprint-3-postgres-api-v1` existe pero no hay SPRINT_3_*.md en la raíz; el contexto de la API v1 vive en el código y en reportes posteriores.
- Mitigación: Opcional: reconstruir un reporte retroactivo del Sprint 3 a partir del código de `api-server/`. No bloquea el cierre.

## Producción: condiciones de desbloqueo humano

- [ ] Sign-off humano explícito del cierre editorial de la serie (3–30).
- [ ] Integración ordenada de la cadena de PRs #1–#30 sin conflictos (ver plan de integración).
- [ ] canonical con causal_links completos (cerrar riesgo `canonical-causal-links`).
- [ ] Checklist final de producción superado con GATE HUMANO obligatorio.
- [ ] Revisión de seguridad (JWT/roles) y DR/backups verificados fuera de este repo.
- [ ] Decisión humana de habilitar dominio/API/DB/CMS/redes sociales.

