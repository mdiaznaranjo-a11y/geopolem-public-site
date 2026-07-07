# Cierre maestro GEOPÓLEM — Índice del ciclo (serie 1–30)

> **PREPARA, no ejecuta.** Producción **bloqueada**. Este paquete consolida
> la auditoría de continuidad, la matriz de riesgos y el checklist final de
> producción con gate humano, más las guías de operación e integración.

## Artefactos

| artefacto | máquina | navegable |
|---|---|---|
| Auditoría de continuidad | [continuity-audit.json](continuity-audit.json) | [continuity-audit.md](continuity-audit.md) |
| Matriz de riesgos abierta | [risk-matrix.json](risk-matrix.json) | [risk-matrix.md](risk-matrix.md) |
| Checklist final de producción | [production-checklist.json](production-checklist.json) | [production-checklist.md](production-checklist.md) |
| Guía de operación anual | — | [annual-operations-guide.md](annual-operations-guide.md) |
| Plan de integración de PRs | — | [pr-integration-plan.md](pr-integration-plan.md) |
| Mapa de artefactos / cómo retomar | — | [artifact-map.md](artifact-map.md) |

## Resumen

- Sprints en la cadena: **30**
- Riesgos de rebase/merge: **3**
- Riesgos abiertos: **8** de **11**
- Ítems bloqueantes del checklist de producción: **8**
- Estado de producción: **blocked** (este sprint NO publica).

## Cómo retomar cada área

- **Plataforma (API/DB/CMS/mapa)**: `api-server/` (API v1, JWT, observabilidad,
  migraciones), `service-worker.js`/`app.js` (PWA/mapa). Arquitectura reversible
  API real v1 → JSON estático → fallback local. Ver `artifact-map.md`.
- **Editorial**: validadores de fuentes/relaciones/canonical y gobernanza de
  sign-off en `scripts/` (`verified:*`, `promote:*`, `decisions:*`, `gate:*`).
- **Educación**: `scripts/*education*` y `docs/education/` (rúbricas, casebank,
  analítica, i18n, cola causal, panel docente, ADR SCORM).

