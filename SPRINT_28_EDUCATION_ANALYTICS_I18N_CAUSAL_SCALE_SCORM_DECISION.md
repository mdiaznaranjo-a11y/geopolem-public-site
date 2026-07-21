# Sprint 28 — Analítica educativa, i18n ES/EN, cross-check causal ampliado y decisión SCORM

## Resumen

Sprint 28 añade una **capa educativa de escalamiento** sobre el trabajo del
Sprint 27, sin romper web, PWA, mapa ni rutas, y manteniendo la arquitectura
reversible (API real v1 → JSON estático → fallback local). Producción sigue
**bloqueada**: ningún artefacto activa gates, agrega secretos, usa datos
personales ni depende de servicios externos propietarios.

Cuatro entregables:

1. **Analítica pedagógica agregada y anónima** sobre evaluaciones sintéticas.
2. **i18n ES/EN** de materiales docentes clave con validador de cobertura.
3. **Cross-check causal ampliado** a todos los conflictos del contrato v1.
4. **Decisión SCORM real vs mapping portable** (ADR) con validador.

## Rama, base y commit

- **Rama nueva**: `sprint-28-education-analytics-i18n-causal-scale-scorm-decision`
- **Base**: `sprint-27-instructor-review-batch-scoring-xapi-mapping` (PR #27)
- **Commit base**: `b01f075648eb151e01a812875ee4b3222a926118`
- **PR**: ver sección final (creado si la infraestructura lo permite).

## 1) Analítica pedagógica agregada y anónima

- Script: `scripts/education-analytics.mjs` (reutiliza `scoreRubric` y el motor
  de lotes del Sprint 27).
- Produce artefactos **deterministas** en `docs/education/analytics/`:
  - `analytics-report.json`, `analytics-report.md`, `analytics-criteria.csv`.
- Métricas: distribución por banda (conteo + %), **media y mediana** global y
  por rúbrica, **criterios más débiles/fuertes** (normalizados a la escala de
  cada rúbrica), conteo de válidas/rechazadas y **motivos de rechazo agregados**.
- Garantías: sólo acepta entradas anónimas/sintéticas; **RECHAZA PII** con
  `findPIIKeys` sin copiar el contenido; salida **puramente agregada** (no expone
  resultados por evaluación → sin tracking individual).
- Scripts npm: `education:analytics[:json|:write|:check]`.

## 2) i18n educativo ES/EN

- Estructura en `docs/education/i18n/` con patrón **escalable** por namespaces:
  - `i18n.manifest.json` (locale base `es`, locales `es`/`en`, namespaces).
  - `glossary.{es,en}.json` — glosario educativo y taxonómico (15 términos).
  - `feedback.{es,en}.json` — plantillas de feedback por banda y nivel.
  - `instructor-guide.{es,en}.json` — guía de instructor.
- Validador de cobertura: `scripts/validate-i18n-coverage.mjs` — descubre
  namespaces/locales desde el manifiesto, aplana claves y detecta **faltantes,
  sobrantes y vacías**; verifica ausencia de PII y de producción.
- Contenido **canónico**: los identificadores taxonómicos no se duplican; la
  traducción sólo afecta a etiquetas y descripciones.
- Cobertura actual: **100%** (48 claves por locale). Scripts npm:
  `education:i18n[:json|:check]`.

## 3) Cross-check causal ampliado

- Script: `scripts/causal-crosscheck-scale.mjs` (reutiliza `loadSourceLinks` y
  `crosscheckMatrix` del Sprint 26).
- **Enumera desde el contrato** (canonical | staging | rc) TODOS los conflictos,
  no sólo los que tienen matriz, y clasifica cada uno:
  - `checked` — matriz coherente con la fuente.
  - `divergent` — matriz con divergencias de severidad error.
  - `pending_matrix` — la fuente declara `causal_links` pero falta la matriz
    (brecha accionable).
  - `not_applicable` — sin `causal_links` y sin matriz (nada que validar; **no
    se inventan relaciones**).
- Reporte + **backlog determinista** con severidad, conflicto, tipo de brecha,
  acción recomendada y estado, en `docs/education/causal-scale/`.
- Stage por defecto `rc` (banco educativo): **10 conflictos, todos `checked`**,
  0 divergencias. Scripts npm: `education:causal-scale[:json|:write|:check]`.

## 4) Decisión SCORM real vs mapping portable

- ADR: `docs/education/adr/ADR-0001-scorm-vs-portable-mapping.md`.
- Evalúa tres opciones (SCORM real / mapping portable / adaptador futuro) con
  criterios de seguridad, portabilidad, mantenimiento, uso académico y ausencia
  de dependencia propietaria.
- **Decisión (accepted): mantener el mapping portable** como mecanismo canónico
  y **preparar un adaptador futuro opcional**; no se genera SCORM cerrado ahora.
- Validador: `scripts/validate-adr.mjs` — frontmatter y secciones requeridas,
  `production=false`, decisión no propietaria. Scripts npm:
  `education:adr[:json|:check]`.

## Archivos nuevos

- `scripts/education-analytics.mjs`
- `scripts/validate-i18n-coverage.mjs`
- `scripts/causal-crosscheck-scale.mjs`
- `scripts/validate-adr.mjs`
- `docs/education/analytics/analytics-report.{json,md}`, `analytics-criteria.csv`
- `docs/education/i18n/i18n.manifest.json`, `glossary.{es,en}.json`,
  `feedback.{es,en}.json`, `instructor-guide.{es,en}.json`
- `docs/education/causal-scale/crosscheck-scale.{json,md}`,
  `crosscheck-scale.backlog.json`
- `docs/education/adr/ADR-0001-scorm-vs-portable-mapping.md`
- `docs/education/education.sprint28.manifest.json`
- `api-server/test/sprint28-education-analytics-i18n-causal-scale-scorm.test.mjs`
- `SPRINT_28_EDUCATION_ANALYTICS_I18N_CAUSAL_SCALE_SCORM_DECISION.md`

## Archivos modificados

- `api-server/package.json` — nuevos scripts npm del Sprint 28.
- `.github/workflows/ci.yml` — 4 nuevos pasos de CI (analytics/i18n/causal-scale/adr).

## Pruebas ejecutadas

- Suite completa: `node --test test/` → **527 tests, 0 fallos**.
- Suite Sprint 28: **16 tests, 0 fallos** (analítica, PII, i18n, causal-scale,
  ADR y garantías transversales).
- Checks: `education:analytics:check`, `education:i18n:check`,
  `education:causal-scale:check`, `education:adr:check` → todos **OK**.
- Regresión de checks existentes: `education:validate`, `education:crosscheck:check`,
  `education:batch:check`, `education:xapi:check` → todos **OK**.
- Working tree limpio tras los `--check` (artefactos deterministas).

## Garantías de seguridad

- Ningún artefacto activa gates de producción ni contiene secretos
  (`production.*` en `false` en todos los JSON generados).
- Analítica: sólo entradas anónimas/sintéticas; PII rechazada sin copiarse;
  salida agregada sin tracking individual.
- Cross-check no inventa relaciones causales: reporta estado cuando falta matriz.
- Sin dependencias nuevas ni servicios externos; todo determinista y offline.

## Decisiones de diseño

- Reutilización de motores puros existentes (scoring, PII, crosscheck) en vez de
  duplicar lógica.
- Artefactos deterministas (sin timestamps) para habilitar `--check` en CI y
  mantener el árbol limpio.
- i18n por namespaces con locale base canónico → añadir idiomas o namespaces no
  requiere tocar el validador.
- Cross-check enumerado desde el contrato (no desde las matrices) para detectar
  conflictos sin matriz.

## Riesgos y próximos pasos

- **Canonical sin `causal_links`**: en stage `canonical` las matrices divergen
  porque la base no está enriquecida; por eso el check usa `rc` por defecto.
  Próximo paso: enriquecer causal_links en canonical o documentar el drift.
- **i18n**: ampliar a más namespaces (rúbricas, fichas) reutilizando el patrón.
- **Analítica**: alimentar con cohortes sintéticas mayores para tendencias.
- **SCORM**: si surge demanda académica, implementar el adaptador opcional de la
  Opción C del ADR (no propietario, determinista).
