# Sprint 13 — Semilla de fuentes/relaciones y salud de contenidos

## 1. Alcance y motivación

El content-health del Sprint 12 detectó una **deuda editorial**: los 10 conflictos
actuales están **100% sin `sources` y 100% sin relaciones enriquecidas** (actores,
recursos energéticos, chokepoints, causal_links).

Este sprint corrige esa deuda **sin inventar datos** y **sin tocar producción**:
aporta la **infraestructura semilla + validadores + reporte** para enriquecer los
conflictos de forma trazable, dejando los artefactos canónicos intactos hasta que
exista verificación humana de fuentes.

Principio rector (heredado del Sprint 1): _"si la API/semilla falla, la web no se
rompe"_. Todo lo añadido es **aditivo, puro y fail-safe**.

## 2. Cambios (archivos)

Nuevos:
- `data/conflict-relations.seed.json` — semilla versionada (contrato `sprint-13-seed-v1`)
  con relaciones + fuentes por conflicto para los 10 focos actuales.
- `conflict-relations.mjs` — módulo **PURO** (sin disco/red): validación de fuentes,
  regla "published exige fuente", merge no destructivo, cobertura.
- `scripts/seed-relations-report.mjs` — CLI de reporte/validación y generador del
  artefacto de preview enriquecido.
- `api/v1/conflicts.seed.enriched.json` — artefacto de **PREVIEW** (merge semilla→detalle),
  separado de los canónicos; regenerable, marcado como demo cuando incluye fixtures.
- `api-server/test/sprint13-seed-relations.test.mjs` y
  `api-server/test/sprint13-enriched-artifact.test.mjs` — tests.

Modificados:
- `content-health.mjs` — añade `by_conflict` (nº de sources y relaciones por id). Aditivo.
- `api-server/package.json` — scripts `seed:report|seed:report:json|seed:check|seed:enriched|seed:enriched:demo`.
- `.github/workflows/ci.yml` — paso `npm run seed:check` (sin DB).

**NO se modifican**: `data.js`/FOCOS, `api/v1/conflicts.json`, `api/v1/conflicts/active/map.json`,
`api/v1/conflicts/active/map.enriched.json`, ni los detalles canónicos `api/v1/conflicts/{id}.json`.

## 3. Contrato de la semilla (`sprint-13-seed-v1`)

```jsonc
{
  "contract": "sprint-13-seed-v1",
  "version": "1.0.0",
  "conflicts": {
    "<id>": {
      "editorial_status": "draft|review|published|archived",   // default draft
      "actors": { "state": [ {slug,name,role,alignment,involvement_level,evidence} ],
                  "non_state": [ ... ] },
      "resources":  [ {slug,name,relevance_level,strategic_importance,critical_mineral,evidence} ],
      "chokepoints":[ {slug,name,risk_level,strategic_importance,energy_flow_relevance,evidence} ],
      "causal_links":[ {link_type,title,explanation,evidence,pending} ],
      "sources": [ {slug,title,url,source_name,publisher,accessed_at,verification,demo,relation} ]
    }
  }
}
```

Campos mínimos de una `source`: **title**, **url** (http/https), **source_name|publisher**,
**accessed_at**/date, y **verification** ∈ `verified|pending|demo`.

## 4. Reglas editoriales (validadores)

1. **Estructura de fuente**: title no vacío + URL http(s) válida + publisher/source_name.
2. **Fuente publicable** = estructura válida **+ `verification="verified"` + `demo!=true`**.
3. **published exige fuente**: un conflicto `editorial_status="published"` **DEBE** tener
   ≥1 fuente publicable, o la validación falla (`validateSeed`, `validatePublishedHaveSources`,
   y `npm run seed:check` en CI).
4. **Merge seguro**: por defecto el merge integra **sólo fuentes verificadas**. Las fixtures
   demo sólo entran con `--include-demo`, y el artefacto queda marcado `include_demo=true`
   con `notice` de "NO publicar".
5. **No fabricar ceros**: los campos numéricos ausentes se preservan como `null`.

## 5. Estado actual de datos (honesto)

En este entorno **no hay verificación de fuentes en vivo** (sin red/DB). Por prudencia:

- Las relaciones estructurales (actores/recursos/chokepoints) recogen vínculos
  **geográfico-políticos de conocimiento público** (p.ej. `red-sea`→Bab el-Mandeb;
  `isr-gaza-irn`→Ormuz; `ukr-rus`→Rusia/Ucrania). Van marcadas `evidence:"public-knowledge"`.
- Los `causal_links` van `pending:true` (explicación, sin fuente verificada aún).
- Las `sources` son **fixtures DEMO** (`demo:true`, `verification:"demo"`, URL `example.org`),
  **claramente marcadas** y **excluidas** de cualquier artefacto publicable.
- **Ningún conflicto está `published`** → la regla published-exige-fuente **se cumple**.

Resultado: la deuda queda **estructurada y medible**, sin introducir datos falsos.

## 6. Cobertura post-enriquecimiento (reporte)

`npm run seed:report` (en `api-server/`) resume por conflicto: actores/recursos/
chokepoints/causal_links + fuentes (total/publicables/demo) + pendientes. Estado hoy:

| conflicto | act | rec | cho | cau | src(pub/demo) |
|-----------|-----|-----|-----|-----|---------------|
| rearme-global | 3 | 0 | 0 | 1 | 1 (0/1) |
| ukr-rus | 2 | 2 | 1 | 1 | 1 (0/1) |
| isr-gaza-irn | 4 | 1 | 1 | 1 | 1 (0/1) |
| sahel | 4 | 2 | 0 | 1 | 1 (0/1) |
| red-sea | 1 | 1 | 2 | 1 | 1 (0/1) |
| istanbul | 1 | 2 | 2 | 1 | 1 (0/1) |
| mena-agua | 2 | 1 | 0 | 1 | 1 (0/1) |
| asia-agua | 2 | 1 | 0 | 1 | 1 (0/1) |
| stablecoins | 0 | 0 | 0 | 1 | 1 (0/1) |
| ia-narrativa | 0 | 0 | 0 | 1 | 1 (0/1) |

Fuentes publicables totales: **0** (todo pendiente de verificación). Publicados: **0**.

## 7. Integración con export estático / API

El merge se materializa en `api/v1/conflicts.seed.enriched.json` (preview), **sin** tocar
los canónicos. Regeneración:

```bash
cd api-server
npm run seed:enriched          # sólo fuentes verificadas (vacío hoy)
npm run seed:enriched:demo     # incluye fixtures demo (preview marcado)
```

Cuando existan fuentes verificadas, la vía de promoción a los detalles canónicos es:
marcar `verification="verified"` en la semilla → subir `editorial_status` → el merge las
integrará y `seed:check` seguirá protegiendo la regla published-exige-fuente. La forma de
cada relación ya coincide con `getConflictRelations` (DB) y `validateDetail` (exportador),
por lo que es compatible con `map.enriched.json` y `api/v1/conflicts/{id}.json`.

## 8. Criterios de aceptación

- [x] Semilla versionada para los 10 conflictos con contrato explícito.
- [x] Validadores de fuentes (URL/title/publisher) y regla published-exige-fuente.
- [x] `content-health` mide sources/relaciones por conflicto (`by_conflict`).
- [x] Reporte de cobertura + pendientes (texto y `--json`).
- [x] Merge seguro sin corromper canónicos ni romper compatibilidad.
- [x] Tests nuevos verdes + suite Sprint 1–12 intacta (235 tests).
- [x] Sin secretos, sin tocar `data.js`/FOCOS ni fallbacks.

## 9. Riesgos y mitigaciones

- **Riesgo**: confundir fixtures demo con datos reales. → **Mitigación**: `demo:true`,
  URLs `example.org`, `notice` en artefactos, exclusión del merge por defecto.
- **Riesgo**: publicar sin fuente. → **Mitigación**: `seed:check` en CI (exit≠0).
- **Riesgo**: divergencia de contrato con la DB/exportador. → **Mitigación**: shapes
  alineados con `getConflictRelations` y `validateDetail`; test que valida el preview.

## 10. Rollback

Todo es aditivo. Para revertir: eliminar los archivos nuevos, el bloque `by_conflict`
de `content-health.mjs`, los scripts de `package.json` y el paso de CI. Los canónicos
no cambiaron, así que producción no se ve afectada en ningún caso.

## 11. Recomendaciones para Sprint 14

1. **Verificación editorial**: sustituir fixtures demo por fuentes reales
   (`verification="verified"`), una a una, con revisión humana.
2. **Promoción**: una vez con fuentes, permitir merge hacia detalles canónicos
   (o vía DB real con `export:static:details`).
3. **Cobertura como gate**: elevar `seed:check` para exigir cobertura mínima por conflicto
   antes de permitir `published`.
4. **UI pública**: mostrar badge de trazabilidad (fuente verificada vs. pendiente) en la ficha.
