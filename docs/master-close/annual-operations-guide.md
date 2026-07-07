# Guía de operación anual — GEOPÓLEM

> Guía **accionable** para operar y mantener GEOPÓLEM durante un ciclo anual,
> conectada a los scripts y artefactos existentes del repo. **No habilita
> producción**: cualquier publicación/desbloqueo exige el gate humano descrito
> en `production-checklist.md`.

## Cadencia general (resumen)

| Frecuencia | Foco | Comandos/artefactos clave |
|---|---|---|
| Semanal | QA técnica + salud de contenido | `npm test`, `npm run content:health`, `npm run verify:clean-tree` |
| Quincenal | Revisión editorial / cola causal | `npm run review:queue`, `npm run education:queue`, `npm run education:backlog` |
| Mensual | Cadence editorial + i18n | `npm run verified:report`, `npm run education:i18n:scale`, `npm run decisions` |
| Trimestral | Revisión docente + rúbricas/LMS | `npm run education:rubrics:validate`, `npm run education:lms`, `npm run education:analytics` |
| Trimestral | Seguridad + DR | revisión JWT/roles, ensayo de backups/restore, `npm run canonical:rollback:verify` |
| Semestral | Actualización DB/API | `npm run migrate:check`, `npm run export:static:check`, contract tests |
| Anual | Cierre/renovación de serie | `npm run master-close:write && npm run master-close:check` |

## 1) Cadence editorial

- Planificar publicaciones respetando **published-exige-fuente** y
  **causal_links-exigen-fuente** (ya en CI: `npm run seed:check`,
  `npm run verified:check`).
- Curaduría de la cola editorial causal: `npm run review:queue` /
  `npm run education:queue` / `npm run education:backlog`. No inventar fuentes.
- Decisiones editoriales con firma de rol: `npm run decisions` /
  `npm run decisions:check`.

## 2) Revisión docente

- Validar materiales y rúbricas: `npm run education:validate`,
  `npm run education:rubrics:validate`.
- Scoring por lotes anónimo (sin PII): `npm run education:batch` /
  `education:batch:check`.
- Panel docente **agregado** (sin tracking individual):
  `npm run education:dashboard` / `education:dashboard:check`.
- Revisar decisión SCORM vs mapping portable (ADR-0001):
  `npm run education:adr:check`.

## 3) QA técnica

- Suite completa sin DB: `cd api-server && npm test`.
- Smoke y rutas estáticas: `npm run smoke`, `npm run verify:static-routes`.
- QA del RC (PWA/offline): `npm run qa:rc:json`.
- Garantía NO-WRITE/NO-DIFF de validadores: `npm run verify:clean-tree`.

## 4) Actualización de DB/API

- Migraciones idempotentes: `npm run migrate:check` (sin DB) y `npm run migrate`
  (con DB en CI/staging PostGIS).
- Puente estático al día: `npm run export:static:check`; regenerar con
  `npm run export:static` cuando cambie la fuente.
- Mantener la **arquitectura reversible**: API real v1 → JSON estático →
  fallback local. Nunca romper web/PWA/mapa/rutas.

## 5) Revisión de seguridad

- Revisar JWT/roles/scopes y rotación de claves (tests: `auth.test.mjs`,
  `jwt-rotation.test.mjs`, `scopes.test.mjs`).
- Secretos **fuera del repo**; ningún artefacto debe contenerlos
  (`npm run verify:no-production` sobre el cierre maestro).
- Rate limiting y observabilidad: revisar `api-server/src/rate-limit.mjs` y
  `observability.mjs`.

## 6) Contenidos multicanal

- Redes sociales **no** se conectan automáticamente: requieren aprobación
  humana y credenciales seguras (riesgo `social-not-connected`).
- Reutilizar fichas/casebank exportables: `npm run education:export`,
  `npm run education:casebank`.

## 7) Analítica

- Analítica pedagógica agregada y anónima: `npm run education:analytics` /
  `education:analytics:check`.
- KPIs y salud de contenido: `npm run content:health`.

## 8) Backups y DR

- Plan/backup/restore/verify canónico: `npm run canonical:rollback:*`.
- Ensayar restauración DR en staging al menos trimestralmente.
- Backups reales de DB dependen de infraestructura fuera del repo (riesgo
  `backups-dr`).

## 9) Release windows

- Toda promoción es **GATED** y sin producción por defecto:
  `npm run release:simulate:json`, `npm run go-no-go:check`,
  `npm run gate:check`.
- Ventanas de release sólo tras superar el **checklist final de producción**
  con gate humano (`production-checklist.md`).
- Antes de cualquier ventana: CI verde, `master-close:check`,
  `verify:no-production` y sign-off humano.

## Calendario anual sugerido

- **Q1**: revisión de seguridad + ensayo DR; actualización de dependencias.
- **Q2**: revisión docente + rúbricas/LMS; ampliación i18n.
- **Q3**: actualización DB/API + migraciones; auditoría de fuentes editoriales.
- **Q4**: cierre/renovación de la serie (`master-close:*`), planificación del
  siguiente ciclo y revisión del gate de producción.
