# Sprint 30 — Cierre maestro: auditoría de continuidad, matriz de riesgos, plan de operación e integración

## Resumen

Sprint 30 **cierra la serie técnica/editorial/educativa** de GEOPÓLEM (1–30) con
un **paquete maestro de continuidad**, sin romper web, PWA, mapa ni rutas y
manteniendo la arquitectura reversible **API real v1 → JSON estático → fallback
local**. **Cierre maestro preparado; producción NO habilitada.** Ningún artefacto
activa gates, agrega secretos, usa datos personales ni depende de servicios
externos propietarios. **No se fusionan PRs ni se aprueban/cierran issues.**

Entregables:

1. **Auditoría de continuidad** de la cadena PR #1–#30 (dependencias, ramas base,
   riesgos de rebase/merge, estado de producción y condiciones de desbloqueo).
2. **Paquete final de documentación** consolidado en `docs/master-close/`.
3. **Matriz de riesgos abierta** con severidad, probabilidad, owner, mitigación,
   criterio de cierre y estado.
4. **Guía de operación anual** accionable, conectada a scripts/artefactos.
5. **Plan de integración de PRs** paso a paso (orden, rebase/retarget, smoke,
   rollback, sign-off humano).
6. **Checklist final de producción** con **gate humano obligatorio** y
   `production=false`.
7. **Validadores + CI + tests** deterministas y sin producción.

## Rama, base y commit

- **Rama nueva**: `sprint-30-master-close-continuity-audit-operations-plan`
- **Base**: `sprint-29-education-dashboard-i18n-causal-queue-master-close-prep`
  (PR #29), **commit base** `16b047a`.
- **Dependencia documentada**: la rama base existe localmente; `main` (`4827e4e`)
  **diverge** de la cadena de sprints (contiene el carrusel de láminas, no la
  serie 3–30). Sprint 30 se basa en `16b047a`, **no** en `main`. Este hecho es
  el riesgo `open-chain-vs-main` de la auditoría.

## 1) Auditoría de continuidad

- Generador: `scripts/build-master-close.mjs` (contrato `sprint-30-master-close-v1`).
- Artefacto: `docs/master-close/continuity-audit.{json,md}`.
- Cadena **#1–#30** derivada de reportes/ramas del repo; dependencia funcional
  `N → N+1`; verificación **en vivo** de qué reportes existen (`report_present`).
- Riesgos de rebase/merge explícitos, incluido **Sprint 28 (PR #28) contra `main`
  aunque depende funcionalmente de Sprint 27 (PR #27)** (`pr28-targets-main`),
  la **cadena abierta vs `main`** (`open-chain-vs-main`) y `sprint-3-no-report`.
- Estado de producción: **`blocked`** con **condiciones explícitas de desbloqueo
  humano** (sign-off, integración ordenada, causal_links canónicos, checklist de
  producción, seguridad/DR, decisión humana de habilitar dominio/API/DB/CMS/social).
- Nota honesta: los números de PR siguen la convención `PR#N = Sprint N` y quedan
  marcados `pr_verified:false` (verificación humana en GitHub).

## 2) Paquete final de documentación (`docs/master-close/`)

- `README.md` (índice del ciclo, resumen y **cómo retomar cada área**).
- `index.json` (mapa máquina-legible de artefactos).
- `artifact-map.md` (mapa técnico/editorial/educativo; conecta API/DB/CMS/mapa con
  las líneas editorial y educativa, y el cross-check causal como puente de integridad).
- Guías: `annual-operations-guide.md`, `pr-integration-plan.md`.
- Artefactos generados: `continuity-audit.*`, `risk-matrix.*`, `production-checklist.*`.

## 3) Matriz de riesgos abierta

- Artefacto: `docs/master-close/risk-matrix.{json,md}`.
- **11 riesgos** con severidad/probabilidad/owner sugerido/mitigación/criterio de
  cierre/estado, enriquecidos con **señales en vivo** (`buildClosePrep`): cadena
  de PRs, producción bloqueada, canonical sin causal_links, i18n incompleta,
  curaduría humana, SCORM real vs mapping portable, fuentes/citas editoriales,
  seguridad JWT/roles, backups/DR, observabilidad, redes sociales no conectadas.
- **No inventa datos**: fuentes y aprobaciones quedan como riesgos pendientes de
  verificación humana.

## 4) Guía de operación anual

- `docs/master-close/annual-operations-guide.md`: cadence editorial, revisión
  docente, QA técnica, actualización DB/API, revisión de seguridad, contenidos
  multicanal, analítica, backups/DR y **release windows**. Cada sección enlaza a
  comandos npm reales del repo. Incluye calendario Q1–Q4.

## 5) Plan de integración de PRs

- `docs/master-close/pr-integration-plan.md`: principio rector (dependencia
  `N→N+1`, no fusionar a `main` fuera de orden), riesgo destacado Sprint 28↔27,
  orden recomendado por tramos, estrategia de rebase/retarget, verificaciones
  antes/después, smoke tests, rollback y **sign-off humano obligatorio**.
- **No ejecuta merges ni approvals.**

## 6) Checklist final de producción

- Artefacto: `docs/master-close/production-checklist.{json,md}`.
- **10 ítems** con **gate humano obligatorio** (`requires_human_gate:true`,
  `publishes:false`, todos `pending`, `production=false`). Cubre sign-off,
  integración de la cadena, ausencia de flags de producción/secretos, causal_links
  canónicos, fuentes verificadas, seguridad, backups/DR, observabilidad y la
  habilitación humana de dominio/API/DB/CMS/redes sociales.

## 7) Validación y CI

- **Guardián NO-PRODUCTION**: `scripts/verify-no-production.mjs` (contrato
  `sprint-30-no-production-guard-v1`) verifica `production.*===false` y ausencia de
  patrones de secretos en los JSON del cierre.
- **npm scripts** (en `api-server/package.json`): `master-close[:json|:write|:check]`,
  `verify:no-production[:json]`.
- **CI** (`.github/workflows/ci.yml`, job `api-server`): dos pasos nuevos —
  `master-close:check` y `verify:no-production`.
- **Test**: `api-server/test/sprint30-master-close.test.mjs` (12 casos).

### Pruebas ejecutadas (resultados exactos)

- `cd api-server && npm test` → **554 tests, 0 fallos** (542 previos + 12 nuevos).
- `npm run master-close:check` → `OK: paquete de cierre maestro Sprint 30 al día.`
- `npm run verify:no-production` → `OK: 4 artefactos sin producción ni secretos.`
- `npm run education:close-prep:check` → `OK` (Sprint 29 intacto).
- Determinismo verificado (build idéntico entre ejecuciones; artefactos en disco
  == build). Working tree limpio salvo los archivos nuevos/modificados de este sprint.

## Archivos nuevos / modificados

**Nuevos**
- `scripts/build-master-close.mjs`
- `scripts/verify-no-production.mjs`
- `api-server/test/sprint30-master-close.test.mjs`
- `docs/master-close/README.md`, `index.json`, `continuity-audit.{json,md}`,
  `risk-matrix.{json,md}`, `production-checklist.{json,md}`,
  `annual-operations-guide.md`, `pr-integration-plan.md`, `artifact-map.md`
- `SPRINT_30_MASTER_CLOSE_CONTINUITY_AUDIT_OPERATIONS_PLAN.md` (este reporte)

**Modificados**
- `api-server/package.json` (scripts `master-close:*`, `verify:no-production*`)
- `.github/workflows/ci.yml` (2 pasos de verificación Sprint 30)

## Garantías de seguridad

- `production.is_production=false`, `activates_production_gate=false`,
  `contains_secrets=false` en **todos** los artefactos, verificado por validador.
- Sin secretos, sin datos personales, sin dependencias de servicios externos.
- Arquitectura reversible intacta; no se tocan web/PWA/mapa/rutas ni `app.js`.
- Deterministas (`--check` en CI), sin timestamps ni azar.

## Decisiones de diseño

- **Reutilización**: el generador consume `buildClosePrep` (Sprint 29) para las
  señales en vivo en lugar de recalcular; sigue el patrón `json/write/check` del
  resto de validadores de la serie.
- **Auditabilidad sin invención**: la cadena se deriva de reportes/ramas reales;
  los PR quedan `pr_verified:false`. No se fabrican fuentes ni aprobaciones.
- **Un solo generador** para auditoría + riesgos + checklist + índice, más un
  guardián de seguridad separado y guías estáticas accionables.

## Riesgos (resumen) y próximos pasos

- Riesgos abiertos clave: cadena de PRs abierta, canonical sin causal_links,
  fuentes editoriales, seguridad JWT/roles, backups/DR (ver `risk-matrix.md`).
- **Próximos pasos = revisión humana**: revisar y ordenar la integración de
  PRs #1–#30 (plan adjunto), ejecutar merges/retargets con sign-off humano y, sólo
  entonces, evaluar el desbloqueo de producción mediante el checklist con gate
  humano. **Este sprint NO publica.**

## PR

Ver sección de entrega (creado si la infraestructura/autorización lo permite).
