# Sprint 26 — Motor de puntuación de rúbricas, export LMS y validación cruzada causal

> **Material de FORMACIÓN.** Ninguno de estos artefactos sustituye la revisión
> editorial final ni activa producción. Producción sigue **BLOQUEADA** por diseño.
> No se introducen secretos ni datos personales.

## 1. Alcance

Sprint 26 construye sobre el banco de casos, las fichas docentes, el laboratorio
offline y las 6 rúbricas máquina-legibles del Sprint 25, añadiendo:

1. **Motor de puntuación de rúbricas** (`scripts/score-rubric.mjs`).
2. **Exportador LMS portable** (`scripts/export-lms.mjs`).
3. **Validación cruzada matrices ↔ `causal_links`** del contrato v1
   (`scripts/validate-causal-crosscheck.mjs`), integrada en `education:validate` y CI.
4. **Paquetes docentes distribuibles** (`docs/education/packages/`): curso corto y
   seminario ejecutivo.
5. **Pruebas** completas (`api-server/test/sprint26-*.test.mjs`) y este reporte.

Arquitectura respetada: **API real v1 → JSON estático → fallback local**. Todos
los validadores funcionan **sin base de datos ni navegador**.

## 2. Bloques implementados

### 2.1 Motor de puntuación de rúbricas

- Módulo puro y CLI. Toma una rúbrica `sprint-25-rubric-v1` y una **evaluación
  anónima** (`sprint-26-rubric-evaluation-v1`) y calcula subpuntajes por criterio
  (nivel × ponderación), total ponderado, normalización 0–100, banda de logro y
  feedback textual (descriptor del nivel + sugerencia hacia el siguiente).
- **Validaciones:** reutiliza el validador de rúbricas del Sprint 25 (pesos suman
  1.0, descriptor por nivel); comprueba que cada criterio se puntúa una vez, que
  el nivel existe en la escala y que no hay criterios desconocidos.
- **Sin datos personales:** rechaza payloads con claves que parezcan identificar a
  una persona (nombre, email, DNI, teléfono, dirección, matrícula…). No persiste
  nada; no maneja notas reales.
- Uso:
  ```
  node scripts/score-rubric.mjs --rubric=docs/education/rubrics/rubrica-causalidad.json \
       --evaluation=docs/education/rubrics/samples/evaluacion-ejemplo-causalidad.json
  node scripts/score-rubric.mjs --rubric=<ruta> --sample --json
  ```
  npm: `education:score`.

### 2.2 Exportador LMS

- Empaqueta módulos/formatos, casos (con matriz), rúbricas y fichas en un formato
  **portable e independiente de plataforma**:
  - `docs/education/lms-export/lms.manifest.json` — manifiesto máquina-legible.
  - `docs/education/lms-export/lms-package.md` — paquete navegable.
  - `docs/education/lms-export/rubrics.csv` — criterios/niveles/descriptores planos.
- **Determinista** (sin timestamps en los ficheros) para permitir `--check` byte a byte.
  No genera binarios pesados: sólo referencias y texto.
- Uso / npm: `education:lms`, `education:lms:write`, `education:lms:check`, `education:lms:json`.

### 2.3 Validación cruzada matrices ↔ `causal_links`

- Compara cada matriz del banco (`sprint-25-causal-matrix-v1`) con los
  `causal_links` reales del contrato v1 en el stage indicado (`rc`|`staging`|`canonical`).
- **Severidades:**
  - `error` — la matriz afirma algo que la fuente no respalda (nº de enlaces
    distinto; `link_type`/título/evidencia/`source_slugs` que no coinciden;
    conflicto ausente). Rompe `--check`/CI.
  - `warning` — nodo sin respaldo en actores/recursos/chokepoints reales, o fuente demo.
  - `info` — deriva de `--compare-staging`: drift entre stages del contrato.
- **No inventa datos:** sólo compara lo declarado.
- Integrada en `education:validate` (checks `sprint26`) y añadida a CI como
  `education:crosscheck:check`.
- Uso / npm: `education:crosscheck`, `education:crosscheck:json`.

### 2.4 Paquetes docentes distribuibles

`docs/education/packages/` con índice `packages.index.json`
(`sprint-26-education-packages-v1`) y dos paquetes completos:

| Paquete | Audiencia | Casos | Rúbricas |
|---|---|---|---|
| `curso-corto` | grado / formación continua | `ukr-rus`, `red-sea` | análisis, causalidad, validación-fuentes |
| `seminario-ejecutivo` | directivos / analistas senior | `stablecoins`, `rearme-global` | política-energética, causalidad, comunicación |

Cada paquete incluye **manifest, syllabus, casos (ficha + matriz), rúbricas y guía
de laboratorio**. Las guías apuntan al validador cruzado para exigir trazabilidad.

## 3. Validaciones y pruebas

- `npm test` (api-server): **492/492** pruebas OK, incluidas **21 nuevas** de
  Sprint 26 (`sprint26-rubric-scoring-lms-causal-validation.test.mjs`).
- `npm run education:validate`: **79/79** comprobaciones OK (incluye los checks
  `sprint26` de scoring, cross-check y paquetes).
- `npm run education:crosscheck:check`: 10 matrices, 0 errores.
- `npm run education:lms:check`: paquete LMS al día (determinista).
- `npm run verify:clean-tree`: árbol sin diffs tras validaciones read-only.

Cobertura de pruebas nuevas: cálculo de puntajes y bandas; rechazo de PII y de
evaluaciones malformadas; determinismo y frescura del export LMS; detección de
divergencias causales (link_type, enlace inventado/faltante, conflicto ausente,
nodo sin respaldo); integridad de los paquetes; ausencia de secretos/producción.

## 4. Garantías

- **Producción bloqueada:** todos los artefactos declaran
  `is_production=false`, `activates_production_gate=false`, `contains_secrets=false`;
  las pruebas y `education:validate` lo verifican.
- **Sin secretos:** barrido por patrones (PEM, AWS, GitHub, Slack) en artefactos Sprint 26.
- **Sin datos personales:** el motor de puntuación rechaza payloads con claves PII;
  no persiste evaluaciones ni notas.
- **Sin invención de datos:** matrices, cross-check y export sólo reflejan el
  contrato v1; los campos sin dato quedan `pending`.
- **Sin infraestructura:** todo corre sin DB ni navegador; apto para CI/precommit.

## 5. Archivos creados / modificados

**Nuevos**
- `scripts/score-rubric.mjs`
- `scripts/export-lms.mjs`
- `scripts/validate-causal-crosscheck.mjs`
- `docs/education/rubrics/samples/evaluacion-ejemplo-causalidad.json`
- `docs/education/lms-export/{lms.manifest.json,lms-package.md,rubrics.csv}`
- `docs/education/packages/packages.index.json`
- `docs/education/packages/curso-corto/{package.manifest.json,syllabus.md,guia-laboratorio.md}`
- `docs/education/packages/seminario-ejecutivo/{package.manifest.json,syllabus.md,guia-laboratorio.md}`
- `api-server/test/sprint26-rubric-scoring-lms-causal-validation.test.mjs`
- `SPRINT_26_RUBRIC_SCORING_LMS_EXPORT_CAUSAL_VALIDATION.md`

**Modificados**
- `scripts/validate-education-materials.mjs` (checks `sprint26`)
- `api-server/package.json` (scripts `education:score|crosscheck|lms`)
- `.github/workflows/ci.yml` (pasos cross-check y LMS)

## 6. Riesgos y limitaciones

- El cross-check empareja enlaces **por título**; si dos enlaces comparten título
  exacto la comparación podría solaparse (hoy no ocurre en el banco).
- El export LMS es un formato propio portable, **no** un paquete SCORM/xAPI: la
  importación a un LMS concreto requiere un adaptador específico (Sprint 27).
- Las bandas de logro (`insuficiente/suficiente/notable/excelente`) usan cortes
  canónicos 0/50/70/90; son orientativas y deberían revisarse con el equipo docente.
- El drift `staging↔rc` sólo se reporta como `info`; no bloquea (por diseño).

## 7. Recomendaciones Sprint 27

1. **Adaptador SCORM/xAPI** sobre el manifiesto LMS para importación directa.
2. **Cross-check causal completo del contrato**: validar todos los conflictos
   (no sólo los del banco) y publicar un informe versionado.
3. **Calibración de rúbricas** con el equipo docente y validación de cortes de banda.
4. **Recolección anónima y agregada** de resultados de puntuación (sin PII) para
   analítica pedagógica, respetando la política de no persistir datos personales.
5. **Internacionalización** de fichas/rúbricas (ES/EN) para distribución profesional.
