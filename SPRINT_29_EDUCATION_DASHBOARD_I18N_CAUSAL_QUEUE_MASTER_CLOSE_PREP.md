# Sprint 29 — Panel docente agregado, i18n ampliada, cola editorial causal y preparación del cierre maestro

## Resumen

Sprint 29 añade una **capa educativa de consolidación** sobre el Sprint 28, sin
romper web, PWA, mapa ni rutas, y manteniendo la arquitectura reversible
(API real v1 → JSON estático → fallback local). Producción sigue **bloqueada**:
ningún artefacto activa gates, agrega secretos, usa datos personales ni depende
de servicios externos propietarios.

Cuatro entregables:

1. **Panel docente agregado no individualizado** que compone las salidas del
   Sprint 28 (analítica, i18n, causal) sin exponer resultados por evaluación.
2. **Expansión i18n ES/EN** de paquetes clave (syllabus, dashboard) con
   validador escalable y compatibilidad con el default del Sprint 28.
3. **Cola editorial causal normalizada** a partir de los backlogs Sprint 27/28,
   determinista y sin datos inventados.
4. **Preparación del cierre maestro Sprint 30** (checklist técnico/educativo/
   editorial + registro de riesgos abiertos). PREPARA, no ejecuta.

## Rama, base y commit

- **Rama nueva**: `sprint-29-education-dashboard-i18n-causal-queue-master-close-prep`
- **Base**: `sprint-28-education-analytics-i18n-causal-scale-scorm-decision` (PR #28)
- **Commit base**: `b65de3d`
- **PR**: ver sección final (creado si la infraestructura lo permite).

## 1) Panel docente agregado no individualizado

- Script: `scripts/build-teacher-dashboard.mjs` (contrato
  `sprint-29-education-teacher-dashboard-v1`).
- **Compone** salidas ya validadas: `analyzeCohort` (analítica Sprint 28),
  `validateI18n` (manifiesto Sprint 29 con fallback al Sprint 28),
  `crosscheckScale` y `buildCausalQueue`. No recalcula ni duplica lógica.
- Muestra: distribución por banda, criterios más débiles/fuertes, evaluaciones
  válidas/rechazadas, cobertura i18n, estado causal agregado por conflicto y
  casos que **necesitan revisión** (`review_needed`).
- Garantías: **sólo agregado** (sin `results` ni ítems por evaluación → sin
  tracking individual), **rechaza PII** apoyándose en la analítica y no copia su
  contenido, **determinista** (`--check` en CI).
- Artefactos: `docs/education/dashboard/teacher-dashboard.{json,md}`.
- Scripts npm: `education:dashboard[:json|:write|:check]`.

## 2) Expansión i18n ES/EN de paquetes clave

- Manifiesto ampliado `docs/education/i18n/i18n.sprint29.manifest.json`
  (contrato `sprint-29-education-i18n-v1`), base `es`, locales `es`/`en`,
  namespaces: **glossary, feedback, instructor_guide, syllabus, dashboard**.
- Nuevos namespaces:
  - `syllabus.{es,en}.json` — referencia los IDs de paquete como claves
    (`packages.curso-corto.*`, `packages.seminario-ejecutivo.*`); **no duplica
    datos geopolíticos**, sólo traduce etiquetas/descripciones.
  - `dashboard.{es,en}.json` — títulos, secciones y etiquetas del panel docente.
- Validador `scripts/validate-i18n-coverage.mjs` refactorizado para aceptar
  `--manifest=` y `--contract=`; el **default del Sprint 28 sigue intacto**
  (compatibilidad verificada en tests).
- Cobertura: **100%** en los cinco namespaces.
- Scripts npm: `education:i18n:scale[:json|:check]`.

## 3) Cola editorial causal normalizada

- Script: `scripts/build-causal-queue.mjs` (contrato
  `sprint-29-causal-editorial-queue-v1`).
- **Compone** `buildCausalBacklog` (Sprint 27) y el backlog del cross-check
  ampliado (Sprint 28), y **normaliza** cada ítem a un esquema editorial estable:
  `id (Q-###)`, `conflict_id`, `origin`, `editorial_status`, `priority`
  (P1/P2/P3), `action_type`, `blocking`, `requires_source`, `suggested_owner`,
  relación a conflicto/fuente.
- Determinista: deduplica por clave, ordena por prioridad/conflicto/acción y
  reasigna `Q-###` secuencial; `blocking` = severidad `error`.
- **No inventa datos**: los ítems salen de señales reales.
- Estado actual: **11 ítems, 0 bloqueantes** (stage `rc`).
- Artefactos: `docs/education/causal-queue/queue.{json,md}`.
- Scripts npm: `education:queue[:json|:write|:check]`.

## 4) Preparación del cierre maestro Sprint 30

- Script: `scripts/build-master-close-prep.mjs` (contrato
  `sprint-29-master-close-prep-v1`).
- Genera un **checklist** (áreas técnica/educativa/editorial, 9 ítems) con estado
  derivado de **señales en vivo deterministas** (cobertura i18n, divergencias del
  cross-check ampliado, ítems/bloqueantes de la cola, decisión ADR).
- **Registro de riesgos** (7): `pr-chain`, `pr28-vs-main`, `production-blocked`
  (by_design), `canonical-causal-links` (open — documenta que el cross-check y la
  cola usan `rc` por defecto porque `canonical` carece de `causal_links`),
  `scorm-real` (deferred), `i18n-incomplete`, `human-curation`.
- **PREPARA, no ejecuta**: no cierra la serie ni activa producción.
- Estado actual: **9 ítems, 0 bloqueantes, 4/7 riesgos abiertos, close_ready=true**.
- Serie declarada: **sprints 3–30** sobre `main`.
- Artefactos: `docs/education/close-prep/sprint-30-close-checklist.{json,md}`.
- Scripts npm: `education:close-prep[:json|:write|:check]`.

## Archivos nuevos

- `scripts/build-teacher-dashboard.mjs`
- `scripts/build-causal-queue.mjs`
- `scripts/build-master-close-prep.mjs`
- `docs/education/i18n/i18n.sprint29.manifest.json`
- `docs/education/i18n/syllabus.{es,en}.json`
- `docs/education/i18n/dashboard.{es,en}.json`
- `docs/education/dashboard/teacher-dashboard.{json,md}`
- `docs/education/causal-queue/queue.{json,md}`
- `docs/education/close-prep/sprint-30-close-checklist.{json,md}`
- `docs/education/education.sprint29.manifest.json`
- `api-server/test/sprint29-dashboard-i18n-causal-queue-master-close.test.mjs`
- `SPRINT_29_EDUCATION_DASHBOARD_I18N_CAUSAL_QUEUE_MASTER_CLOSE_PREP.md`

## Archivos modificados

- `scripts/validate-i18n-coverage.mjs` — soporte `--manifest`/`--contract`
  (retrocompatible con el default del Sprint 28).
- `api-server/package.json` — nuevos scripts npm del Sprint 29.
- `.github/workflows/ci.yml` — 4 nuevos pasos de CI (queue/i18n-scale/dashboard/close-prep).

## Pruebas ejecutadas

- Suite Sprint 29: **15 tests, 0 fallos** (dashboard agregado/sin PII/determinista,
  i18n ampliada + default intacto, cola normalizada/determinista, close-prep
  prepara-no-ejecuta con 7 riesgos, garantías transversales).
- Suite educativa completa (Sprint 24–29): **96 tests, 0 fallos**.
- Checks: `education:queue:check`, `education:i18n:scale:check`,
  `education:dashboard:check`, `education:close-prep:check` → todos **OK**.
- Working tree limpio tras los `--check` (artefactos deterministas).

## Garantías de seguridad

- Ningún artefacto activa gates de producción ni contiene secretos
  (`production.*` en `false` en todos los JSON generados).
- Panel docente **sólo agregado**: sin resultados por evaluación, sin PII, sin
  tracking individual.
- Cola causal **no inventa datos**: normaliza señales reales existentes.
- Close-prep **prepara, no ejecuta**: no cierra la serie ni habilita producción.
- Sin dependencias nuevas ni servicios externos; todo determinista y offline.

## Decisiones de diseño

- **Composición sobre recomputación**: los cuatro entregables reutilizan las
  funciones puras exportadas de sprints previos en vez de duplicar lógica.
- Validador i18n retrocompatible: `--manifest`/`--contract` opcionales; el
  default Sprint 28 no cambia.
- i18n de syllabus por **referencias a IDs de paquete**, evitando duplicar datos
  geopolíticos canónicos.
- Artefactos deterministas (sin timestamps) para habilitar `--check` en CI.
- Close-prep con estado derivado de señales en vivo → el checklist refleja el
  estado real sin intervención manual.

## Riesgos y próximos pasos

- **Canonical sin `causal_links`** (riesgo `canonical-causal-links`, open): el
  cross-check ampliado y la cola usan `rc` por defecto porque `canonical` diverge
  por ausencia de `causal_links`. Poblar `causal_links` en canonical antes de
  promover.
- **Cadena de PRs y PR #28 vs main**: ordenar/fusionar por dependencia antes del
  cierre maestro (Sprint 30).
- **Curaduría humana pendiente**: los ítems de la cola editorial requieren
  revisión humana; resolver o aceptar antes del cierre.
- **i18n incompleta** más allá de los namespaces clave: ampliar reusando el
  validador escalable.
- **SCORM real diferido**: mantener el mapping portable (ADR-0001).
- **Sign-off editorial humano** del cierre de la serie: acción de Sprint 30.
