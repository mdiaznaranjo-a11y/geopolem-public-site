# Mapa de artefactos y cómo retomar cada área — GEOPÓLEM

> Mapa técnico/editorial/educativo de la serie 1–30 y guía para **retomar** cada
> línea de trabajo. Conecta la arquitectura API/DB/CMS/mapa con las líneas
> editorial y educativa. Producción **bloqueada**.

## Arquitectura reversible (invariante de toda la serie)

**API real v1 → JSON estático → fallback local.** La capa educativa/editorial
sólo consume artefactos versionados; **no** altera web, PWA, mapa ni rutas.

- Web/PWA/mapa: `index.html`, `app.js`, `service-worker.js`, `worldmap.js`,
  `manifest.webmanifest`, `data.js`, `videos.js`.
- Adaptador y puente estático: `api-adapter.js`, `scripts/validate-adapter.mjs`,
  `scripts/validate-conflicts-json.mjs`.

## Plataforma (API / DB / CMS / mapa)

- **API v1**: `api-server/server.mjs`, `api-server/src/` (`router.mjs`,
  `handlers.mjs`, `repository.mjs`, `static-source.mjs`, `response.mjs`,
  `validation.mjs`).
- **Seguridad/observabilidad**: `src/auth.mjs`, `src/rate-limit.mjs`,
  `src/observability.mjs`, `src/config.mjs`.
- **DB (PostgreSQL/PostGIS-ready)**: `api-server/db/schema.sql`, `seed.sql`,
  `queries.sql`, `db/migrations/`. Runner: `scripts/migrate.mjs`.
- **CMS/admin**: `src/admin-handlers.mjs`, `src/admin-repository.mjs`,
  `admin/` (cliente y validación editorial).
- **Cómo retomar**: `cd api-server && npm test` → `npm run smoke` →
  `npm run export:static:check` → `npm run verify:static-routes`. Con DB:
  workflow `api-server-postgis` en `.github/workflows/ci.yml`.

## Editorial

- **Fuentes/relaciones/canonical**: `scripts/seed-relations-report.mjs`,
  `verified-sources-report.mjs`, `promote-canonical-staging.mjs`,
  `build-inventory.mjs`, `canonical-rollback.mjs`.
- **Gobernanza y sign-off**: `scripts/evaluate-editorial-decisions.mjs`,
  `editorial-governance.mjs`, `editorial-decision.mjs`,
  `editorial-blocker-resolution.mjs`, `editorial-signature.mjs`,
  `production-gate.mjs` (diseño del gate, **no** activación).
- **RC / release**: `scripts/build-rc-package.mjs`, `qa-rc-routes.mjs`,
  `release-simulation.mjs`, `build-go-no-go.mjs`, `build-evidence-packages.mjs`.
- **Reglas en CI**: published-exige-fuente y causal_links-exigen-fuente
  (`seed:check`, `verified:check`).
- **Cómo retomar**: `npm run verified:report` → `promote:dry-run` →
  `decisions:check` → `gate:check` (todo sin producción).

## Educación

- **Materiales/currículo**: `docs/education/` (`education.manifest.json`,
  `modelo-pedagogico.md`, `taxonomia-alineacion.json`, `packages/`).
- **Fichas/casebank/lab**: `scripts/export-education-fiches.mjs`,
  `build-case-bank.mjs`; `docs/education/case-bank/`, `casos/`.
- **Rúbricas/scoring/LMS**: `scripts/validate-education-rubrics.mjs`,
  `score-rubric.mjs`, `score-rubric-batch.mjs`, `export-lms.mjs`;
  `docs/education/rubrics/`, `batch/`, `lms-export/`.
- **Causal/analítica/i18n**: `validate-causal-crosscheck.mjs`,
  `causal-crosscheck-scale.mjs`, `build-causal-queue.mjs`,
  `build-causal-backlog.mjs`, `education-analytics.mjs`,
  `validate-i18n-coverage.mjs`; `docs/education/{causal-scale,causal-queue,analytics,i18n}/`.
- **Panel docente / ADR / xAPI**: `build-teacher-dashboard.mjs`,
  `validate-adr.mjs`, `xapi-scorm-mapping.mjs`;
  `docs/education/{dashboard,adr,xapi-scorm-mapping}/`.
- **Cómo retomar**: ejecutar los `education:*:check` (ver guía anual) y revisar
  la cola causal (`education:queue`) y el ADR SCORM (`education:adr:check`).

## Conexión entre líneas

- La **plataforma** expone conflictos y relaciones (API/DB) → el **puente
  estático** los versiona → la **línea editorial** verifica fuentes/canonical y
  gobierna sign-off → la **línea educativa** consume artefactos canónicos/rc
  (matrices ↔ `causal_links`) para rúbricas, casebank, analítica e i18n.
- El **cross-check causal** (`education:crosscheck`, `causal-scale`) es el puente
  de integridad entre datos editoriales y materiales educativos.

## Cierre maestro (Sprint 30)

- Generador: `scripts/build-master-close.mjs` → `docs/master-close/`.
- Guardián: `scripts/verify-no-production.mjs`.
- Preparación (Sprint 29): `scripts/build-master-close-prep.mjs` →
  `docs/education/close-prep/`.
- Ver `README.md`, `continuity-audit.md`, `risk-matrix.md`,
  `production-checklist.md`, `pr-integration-plan.md`,
  `annual-operations-guide.md`.
