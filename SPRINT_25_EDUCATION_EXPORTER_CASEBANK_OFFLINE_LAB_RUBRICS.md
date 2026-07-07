# Sprint 25 — Exportador de fichas docentes, banco de casos, laboratorio de mapa offline y rúbricas máquina-legibles

> **Material de FORMACIÓN.** Nada de lo aquí descrito activa producción ni
> introduce secretos. La producción permanece **bloqueada por política**. Toda
> la generación es determinista, versionada y offline (sin base de datos ni
> navegador). No se inventan datos: los campos ausentes se marcan como
> `pending`/`empty`.

## 1. Alcance

Sprint técnico-educativo que construye sobre el modelo pedagógico y las
plantillas del Sprint 24. Añade cuatro bloques y su integración en el validador
educativo:

1. **Exportador de fichas docentes** desde el contrato v1 (`api/v1/conflicts/<id>.json`
   y equivalentes de staging/RC).
2. **Banco de casos** con matrices causales pre-rellenadas.
3. **Cuaderno de laboratorio de mapa offline** (PWA, deep-links, filtros, fuentes).
4. **Rúbricas máquina-legibles** con su validador.
5. **Integración** en `education:validate`.
6. **Pruebas** y ejecución de la suite completa.

## 2. Arquitectura de datos respetada

`API real v1 → JSON estático → fallback local`. El exportador trabaja siempre
contra los **artefactos JSON versionados** (offline), seleccionables por `stage`:

| stage | fuente | notas |
|---|---|---|
| `canonical` | `api/v1/conflicts/<id>.json` | detalle canónico v1 (arrays a menudo vacíos → pendientes) |
| `staging` | `api/v1/staging/conflicts/<id>.json` | preview de staging |
| `rc` | `api/v1/conflicts.verified.enriched.json` | RC verificado (fuente por defecto del banco de casos) |

## 3. Bloques implementados

### 3.1 Exportador de fichas docentes — `scripts/export-education-fiches.mjs`

- Contrato de ficha: `sprint-25-education-fiche-v1`.
- Exporta **Markdown y JSON** con: `title`, `region`, `conflict_type`, `status`,
  `intensity_level`, `actors`, `resources`, `chokepoints`, `causal_links`,
  `sources`, más **actividades** y **preguntas docentes** (andamiaje que sólo
  referencia campos/valores reales de la ficha).
- **No inventa datos:** cada campo ausente se lista en `pending_fields` y se
  renderiza como `(pendiente / empty)`.
- Funciones puras exportadas (`buildFiche`, `renderFicheMarkdown`, `exportFiche`,
  `loadConflict`) para test e integración.

Uso:

```bash
node scripts/export-education-fiches.mjs --id=red-sea --stage=rc --format=md
node scripts/export-education-fiches.mjs --id=red-sea --json
node scripts/export-education-fiches.mjs --all --stage=rc --write --out=docs/education/case-bank/fichas
```

### 3.2 Banco de casos — `scripts/build-case-bank.mjs` → `docs/education/case-bank/`

- Contratos: `sprint-25-case-bank-v1` (índice), `sprint-25-causal-matrix-v1` (matrices).
- **Caso seguro** = conflicto con al menos una fuente `verified` (no demo) en el RC.
- Genera por caso: ficha (`fichas/<id>.rc.md` + `.json`) y **matriz causal
  pre-rellenada** (`matrices/<id>.matrix.json`) con nodos derivados de entidades
  reales (actores/recursos/chokepoints) y enlaces desde `causal_links`.
- El **nivel de confianza** no existe en el contrato v1 → se marca `pending` para
  completado analítico; nunca se fabrica.
- `README.md` navegable + `case-bank.index.json` máquina-legible.
- Determinista: `--check` falla si el índice en disco difiere del regenerado.

Estructura generada:

```
docs/education/case-bank/
├── README.md
├── case-bank.index.json
├── fichas/<id>.rc.md · <id>.rc.json      (10 casos)
└── matrices/<id>.matrix.json             (10 matrices)
```

### 3.3 Cuaderno de laboratorio de mapa offline — `docs/education/formatos/cuaderno-laboratorio-mapa-offline.md`

- Notebook Markdown con estaciones (acción / entrada / registro) para trabajar el
  mapa **sin red**: preparación PWA, localización de focos, **deep-links**,
  **filtros**, fuentes y cadena causal, y trabajo offline sostenido.
- Alineado con los módulos existentes: `deeplinks.mjs` (claves `foco`, `region`,
  `type`, `status`, `severity`, `resource`, `actor`, `chokepoint`),
  `public-enriched.mjs`, `service-worker.js`, `worldmap.js`.
- Enlaza las rúbricas de evaluación del propio sprint.

### 3.4 Rúbricas máquina-legibles — `docs/education/rubrics/` + `scripts/validate-education-rubrics.mjs`

- Contrato: `sprint-25-rubric-v1`; índice `sprint-25-rubrics-index-v1`.
- Seis rúbricas (dimensiones): `analisis-geopolitico`, `politica-energetica`,
  `validacion-fuentes`, `causalidad`, `uso-mapa`, `comunicacion`.
- Escala común de 4 niveles (`insuficiente`/`suficiente`/`notable`/`excelente`);
  cada criterio tiene descriptor por nivel y **ponderaciones que suman 1.0**.
- Validador dedicado (`validateRubric` puro): contrato, escala, unicidad de ids,
  suma de pesos, descriptor por nivel, ausencia de secretos/producción.

## 4. Validaciones

| Comando | Resultado |
|---|---|
| `npm run education:validate` (api-server) | **73/73** PASS, exit 0 (incluye checks `sprint25:`) |
| `npm run education:rubrics:validate` | **40/40** PASS, exit 0 |
| `npm run education:casebank:check` | OK (índice al día, determinista) |
| `npm test` (api-server) | **471/471** PASS (16 nuevos del Sprint 25) |

El validador educativo se **extendió** (no se reescribió): se añadió un bloque
que lee `docs/education/education.sprint25.manifest.json` y verifica exportador
(campos + marcado de pendientes), banco de casos (índice, ficheros, IDs reales,
contrato de matrices), laboratorio offline (deep-links/PWA/módulos alineados) y
rúbricas (validez + dimensiones), más un barrido de secretos/producción.

## 5. Ficheros creados / modificados

**Creados**

- `scripts/export-education-fiches.mjs`
- `scripts/build-case-bank.mjs`
- `scripts/validate-education-rubrics.mjs`
- `docs/education/education.sprint25.manifest.json`
- `docs/education/formatos/cuaderno-laboratorio-mapa-offline.md`
- `docs/education/rubrics/rubrica-analisis-geopolitico.json`
- `docs/education/rubrics/rubrica-politica-energetica.json`
- `docs/education/rubrics/rubrica-validacion-fuentes.json`
- `docs/education/rubrics/rubrica-causalidad.json`
- `docs/education/rubrics/rubrica-uso-mapa.json`
- `docs/education/rubrics/rubrica-comunicacion.json`
- `docs/education/rubrics/rubrics.index.json`
- `docs/education/case-bank/` (README, índice, 10 fichas ×2, 10 matrices)
- `api-server/test/sprint25-education-exporter-casebank-rubrics.test.mjs`

**Modificados**

- `scripts/validate-education-materials.mjs` (bloque de checks Sprint 25).
- `api-server/package.json` (scripts `education:export*`, `education:casebank*`,
  `education:rubrics:validate*`).

## 6. Garantías

- **Sin producción:** todos los manifiestos/artefactos declaran
  `is_production=false` y `activates_production_gate=false`; el validador lo
  comprueba con patrones de barrido.
- **Sin secretos:** barrido de patrones (PEM, AWS, GitHub, Slack) sobre todos los
  artefactos educativos (Sprint 24 + 25).
- **No se inventan datos:** los campos ausentes quedan `pending`; las matrices no
  fabrican confianza ni topología.
- **Determinismo:** salidas reproducibles (sello `generated_at` ignorado por
  `--check`).

## 7. Riesgos y limitaciones

- Las **actividades/preguntas** son andamiaje pedagógico generado; aunque sólo
  referencian campos reales, requieren revisión docente antes de su uso en aula.
- El **nivel de confianza** de las matrices queda pendiente por diseño (no existe
  en el contrato v1); su completado es responsabilidad analítica.
- El banco de casos depende del RC verificado; si cambian las fuentes verificadas,
  hay que **regenerar** (`education:casebank:write`) y el `--check` lo detectará.

## 8. Recomendaciones Sprint 26

1. **Exportador multi-idioma** (ES/EN) y export a formatos LMS (SCORM/QTI) de las
   rúbricas máquina-legibles.
2. **Motor de puntuación** que aplique las rúbricas a entregables y produzca
   informes agregados (sin persistencia sensible).
3. **Validación cruzada** entre matrices causales del banco y los `causal_links`
   canónicos como *content-health* educativo en CI.
4. **Cierre de pendientes**: flujo para que la revisión editorial complete campos
   `pending` (confianza, actores) con trazabilidad a fuente.
5. Integrar `education:validate` + `education:rubrics:validate` en el hook de
   pre-commit ya existente.
