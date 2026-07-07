# Sprint 27 — Revisión de instructor, scoring por lotes, plantillas de feedback, backlog causal accionable y mapeo opcional xAPI/SCORM

## Metadatos

- **Rama**: `sprint-27-instructor-review-batch-scoring-xapi-mapping`
- **Base**: `sprint-26-rubric-scoring-lms-export-causal-validation` (commit `347c290`)
- **PR**: (ver enlace en el resumen de entrega / sección PR)
- **Producción**: **BLOQUEADA**. Sin gates, sin secretos, sin datos personales, sin servicios externos propietarios.
- **Arquitectura**: reversible intacta (API v1 → JSON estático → fallback local). No se tocan web, PWA, mapa ni rutas.

## Objetivo

Empaquetar el material técnico-educativo de **revisión de instructor**, **scoring por
lotes**, **plantillas de feedback**, **backlog accionable de advertencias causales** y
**mapeo opcional xAPI/SCORM**, reutilizando el motor del Sprint 26 y sin depender de
ninguna plataforma LMS propietaria.

## Alcance implementado

### 1. Paquete de revisión de instructor
`docs/education/instructor-review/`
- `README.md` — guía de revisión y propósito.
- `checklist-instructor.md` — checklist previa a aceptar una evaluación.
- `flujo-sesion.md` — flujo antes / durante / después de la sesión.
- `criterios-aceptacion.md` — criterios objetivos para **aceptar / rechazar / diferir**.
- `instructor-review.manifest.json` — manifiesto máquina-legible (contrato `sprint-27-instructor-review-v1`).

Alineado con las rúbricas máquina-legibles (`rubrics.index.json`) y el banco de casos.

### 2. Scoring por lotes
`scripts/score-rubric-batch.mjs` (contrato `sprint-27-batch-scoring-v1`)
- Reutiliza el motor puro del Sprint 26 (`scoreRubric`, `findPIIKeys`) — **no duplica lógica**.
- Procesa múltiples evaluaciones anónimas/sintéticas de una carpeta.
- **Rechaza/marca PII** sin copiar el contenido personal a la salida; rechaza `rubric_id`
  desconocido y evaluaciones inválidas.
- Salida agregada **JSON + Markdown + CSV** (bandas, medias por rúbrica y por criterio, rechazos).
- Determinista → admite `--check`.
- Fixtures sintéticos sin PII en `docs/education/batch/fixtures/` (5 evaluaciones anónimas).
- Informe generado en `docs/education/batch/batch-report.{json,md,csv}`.

### 3. Plantillas de feedback
`docs/education/feedback-templates/`
- `feedback.template.json` (contrato `sprint-27-feedback-template-v1`) — recomendación por
  **banda de logro** y por **nivel de criterio**.
- `feedback.template.md` — plantilla navegable con marcadores.
- `scripts/render-feedback.mjs` — integra la plantilla con el motor de puntuación
  (individual) y produce feedback docente por criterio.

### 4. Backlog accionable de advertencias causales
`scripts/build-causal-backlog.mjs` (contrato `sprint-27-causal-backlog-v1`)
- Deriva determinísticamente de `crosscheckAll` (Sprint 26) **+** campos `pending` del banco de casos.
- Cada ítem: caso · tipo de advertencia · severidad · acción recomendada · responsable sugerido · estado.
- **No inventa datos causales**: si falta evidencia → estado `pendiente` y acción de revisión.
- Salida `docs/education/causal-backlog/backlog.{json,md}`; determinista → `--check`.

### 5. Mapeo opcional xAPI/SCORM
`docs/education/xapi-scorm-mapping/`
- `README.md` — declara explícitamente que es **opcional** y **no depende de plataforma**.
- `mapping.json` (contrato `sprint-27-xapi-scorm-mapping-v1`) — correspondencia conceptual
  del manifiesto LMS portable → verbos/actividades xAPI y elementos CMI de SCORM.
  No genera paquetes cerrados (ZIP, `imsmanifest.xml`).
- `scripts/xapi-scorm-mapping.mjs` — valida que cada `source_concept` exista en el manifiesto
  LMS real y que la política de actor sea anónima.

### 6. Validación y CI
- Nuevo test: `api-server/test/sprint27-instructor-review-batch-scoring-xapi-mapping.test.mjs` (19 pruebas).
- `scripts/validate-education-materials.mjs` extendido con la sección Sprint 27 (`education:validate`).
- Nuevos scripts npm: `education:batch(:json|:write|:check)`, `education:feedback`,
  `education:backlog(:json|:write|:check)`, `education:xapi(:json|:check)`.
- CI (`.github/workflows/ci.yml`): 3 pasos nuevos (`education:batch:check`,
  `education:backlog:check`, `education:xapi:check`).

## Pruebas ejecutadas (resultados exactos)

- Suite completa: **511/511** (`node --test test/`, antes 492 → +19).
- `education:validate`: **112/112** comprobaciones (antes 79 → +33).
- `education:batch:check` → OK (informe por lotes al día).
- `education:backlog:check` → OK (backlog causal al día).
- `education:xapi:check` → OK (mapeo coherente, opcional, sin producción).
- `education:crosscheck:check` → OK (10 matrices, 0 errores).
- `education:lms:check` → OK (paquete LMS al día).

## Garantías de seguridad

- **Producción bloqueada**: todos los artefactos declaran `is_production=false`,
  `activates_production_gate=false`, `contains_secrets=false`. Barridos de secretos y de
  activación de producción sobre los artefactos Sprint 27 (en test y en `education:validate`).
- **Sin datos personales**: el batch y el motor rechazan payloads con claves con aspecto de PII;
  el contenido personal nunca se copia a la salida; los fixtures son sintéticos y anónimos.
- **Sin dependencias externas propietarias**: el mapeo xAPI/SCORM es portable y opcional.
- **Determinismo**: informes sin timestamps → verificables con `--check` en CI.

## Decisiones de diseño

- **Reutilización sobre duplicación**: batch, feedback y backlog importan las funciones puras
  de Sprint 26 (`scoreRubric`, `findPIIKeys`, `crosscheckAll`) en vez de reimplementarlas.
- **Backlog anclado en datos reales**: se combina crosscheck (divergencias) con `pending_fields`
  del banco de casos; nunca se generan afirmaciones causales nuevas.
- **Mapeo portable en vez de paquete cerrado**: se publica el mapa conceptual, no un empaquetador,
  para no atar el material a una plataforma ni añadir complejidad.
- **Consistencia con el patrón del repo**: cada generador ofrece `--json/--write/--check` como
  los scripts existentes, y se integra en `education:validate` como Sprint 25/26.

## Riesgos y mitigaciones

- *Deriva de artefactos generados*: mitigada con `--check` en CI (batch, backlog, LMS, crosscheck).
- *Introducción accidental de PII en fixtures*: mitigada con test dedicado + rechazo del motor.
- *Divergencias causales futuras*: el backlog las reflejará automáticamente por severidad; los
  errores (`error`) quedan como `bloqueante` y el crosscheck ya rompe CI.

## Próximos pasos recomendados

- Añadir un exportador opcional que, a partir del `mapping.json`, emita **statements xAPI de ejemplo**
  (sintéticos, anónimos) para pruebas de integración con un LRS de laboratorio.
- Extender el batch con umbrales configurables de banda para informes por cohorte (sin PII).
- Conectar el backlog causal con la cola editorial para priorización conjunta.
