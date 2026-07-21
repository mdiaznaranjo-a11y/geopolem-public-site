# Sprint 14 — Fuentes verificadas y promoción controlada del enriquecimiento

## 1. Alcance y motivación

El Sprint 13 dejó la deuda editorial **estructurada pero sin verificar**: los 10
conflictos tenían relaciones de conocimiento público y `sources` como **fixtures
DEMO** (`demo:true`, URLs `example.org`), excluidas de todo artefacto publicable.

Este sprint **sustituye las fixtures demo por fuentes reales verificadas** cuando
es posible, revisa los `causal_links`, y prepara una **promoción controlada** del
enriquecimiento real a un artefacto de preview no canónico. Principio rector
(heredado): _no inventar datos_. Lo que no se puede verificar queda **pending
explícito** y documentado.

En este entorno **sí hubo acceso web fiable** (WebSearch + WebFetch), por lo que se
verificaron fuentes institucionales una a una (título exacto, URL, publisher, fecha
de acceso). Los casos no verificables se dejaron pendientes en lugar de fabricarlos.

## 2. Cambios (archivos)

Nuevos:
- `data/conflicts.inventory.json` — inventario exacto y versionado de los 10 conflictos
  (contrato `sprint-14-inventory-v1`), derivado de `api/v1/conflicts.json`.
- `scripts/build-inventory.mjs` — generador determinista del inventario (`--check`, `--json`).
- `data/conflict-relations.verified.seed.json` — semilla **VERIFICADA** (contrato
  `sprint-14-verified-v1`) con fuentes reales y `causal_links` con trazabilidad.
- `data/source-research.todo.json` — cola de investigación editorial (pendientes explícitos).
- `conflict-sources.mjs` — módulo **PURO** Sprint 14: validación de fuentes verificadas,
  **regla causal_links-exigen-fuente**, cobertura verificada, y builder del preview.
- `scripts/verified-sources-report.mjs` — CLI de validación/reporte y generador del
  preview verificado.
- `api/v1/conflicts.verified.enriched.json` — artefacto de **PREVIEW verificado**
  (contrato `sprint-14-verified-enriched-v1`); merge no destructivo, **sólo verified**.
- `api-server/test/sprint14-verified-sources.test.mjs` — tests (23 nuevos).

Modificados:
- `api-server/package.json` — scripts `inventory:build|inventory:check|verified:report|verified:report:json|verified:check|verified:enriched`.
- `.github/workflows/ci.yml` — pasos `inventory:check` y `verified:check` (sin DB).

**NO se modifican** (producción intacta): `data.js`/FOCOS, `api/v1/conflicts.json`,
`api/v1/conflicts/active/map*.json`, los detalles canónicos `api/v1/conflicts/{id}.json`,
ni la semilla demo del Sprint 13 (`data/conflict-relations.seed.json`, tests intactos).

## 3. Inventario exacto de conflictos (Bloque 1)

`data/conflicts.inventory.json` proyecta los 10 focos actuales:

| id | tipo | región | intensidad | detalle canónico | fuente verificada |
|----|------|--------|-----------|------------------|-------------------|
| rearme-global | defensa | global | 4 | sí | 1 |
| ukr-rus | conflicto | europa_del_este | 5 | sí | 1 |
| isr-gaza-irn | conflicto | mena | — | sí | 1 |
| sahel | conflicto | sahel | — | sí | 1 |
| red-sea | chokepoint | mena | — | sí | 1 |
| istanbul | chokepoint | eurasia | — | sí | 0 (pending) |
| mena-agua | agua | mena | — | sí | 1 |
| asia-agua | agua | asia_del_sur | — | sí | 1 |
| stablecoins | ia | global | — | sí | 1 |
| ia-narrativa | ia | global | — | sí | 0 (pending) |

El generador es determinista; `npm run inventory:check` falla en CI si el inventario
queda desactualizado respecto de los canónicos.

## 4. Sustitución de fuentes demo (Bloque 2) — fuentes verificadas

Se verificaron **8 de 10** conflictos con fuentes institucionales reales (método de
verificación indicado en `accessed_via`):

| conflicto | fuente verificada | publisher | verificación |
|-----------|-------------------|-----------|--------------|
| rearme-global | Global military spending rise continues… (2025: 2.887 bn USD) | SIPRI | web-fetch |
| ukr-rus | Update 356 – IAEA DG Statement on Situation in Ukraine | IAEA | web-search |
| isr-gaza-irn | Occupied Palestinian Territory | OCHA | web-search |
| sahel | Sahel emergency | UNHCR | web-search |
| red-sea | Navigating troubled waters (Red Sea/Suez) | UNCTAD | web-fetch |
| mena-agua | Water Scarcity in MENA Requires Bold Actions | World Bank | web-fetch |
| asia-agua | Fact Sheet: The Indus Waters Treaty 1960 | World Bank | web-fetch |
| stablecoins | High-level Recommendations… Global Stablecoin Arrangements | FSB | web-fetch |

`accessed_via='web-fetch'` = URL recuperada y contenido confirmado directamente;
`accessed_via='web-search'` = existencia y contenido confirmados vía buscador (los
dominios iaea.org / unocha.org / unhcr.org devolvieron 402/403 al fetch directo por
el proxy). Todas las fuentes verificadas llevan `verification:"verified"`, `demo:false`
y `accessed_at:"2026-07-07"`.

**Pendientes explícitos** (`data/source-research.todo.json`): `istanbul` (régimen del
Bósforo / Convención de Montreux) e `ia-narrativa` (riesgo narrativo por IA) — sin
fuente institucional única verificable en este entorno; se dejan **sin fuente** en
lugar de inventarla.

## 5. Causal links y relaciones (Bloque 3)

Cada `causal_link` real (`pending:false`) referencia ahora al menos una fuente
publicable (`source_slugs`). Resultado:

- **4 causal_links verificados** (`pending:false` + fuente que respalda la afirmación):
  `rearme-global`, `ukr-rus`, `red-sea`, `mena-agua`.
- **4 con fuente de contexto pero causal aún pendiente** (`pending:true` + `source_slugs`):
  `isr-gaza-irn`, `sahel`, `asia-agua`, `stablecoins` — la fuente respalda el contexto
  del conflicto pero **no** la afirmación causal concreta, que requiere sign-off humano.
- **2 totalmente pendientes**: `istanbul`, `ia-narrativa`.

**Regla de validación nueva** (`validateCausalLinksHaveSources` + `validateVerifiedSeed`):
un `causal_link` con `pending:false` **DEBE** tener `source_slugs` que resuelvan a una
fuente publicable del mismo conflicto, o la validación falla (`npm run verified:check`,
exit≠0 en CI). Esto **impide publicar relaciones causales reales sin respaldo**.

## 6. Promoción controlada (Bloque 4)

- Se genera el preview **no canónico** `api/v1/conflicts.verified.enriched.json`
  (`npm run verified:enriched`): merge NO destructivo de la semilla verificada sobre el
  detalle v1, **sólo fuentes verificadas**. Cada entrada valida contra `validateDetail`
  (mismo validador del exportador) → compatible con el contrato v1.
- **Cobertura verificada: 80%** (8/10 conflictos con fuente verificada).
- **NO se promociona a canónico** (`conflicts.json`, `map*.json`, detalles): los
  conflictos con fuente pasan a `editorial_status:"review"` (no `published`). La
  promoción a producción exige **sign-off editorial humano** y no rompe la separación
  preview/canónico verificada por los tests.

Criterios de promoción a canónico (propuestos, aún no alcanzados de forma autónoma):
1. `verified:check` en verde (semilla válida + regla causal cumplida). **✓ hoy**
2. Todas las fuentes `verification:"verified"` con `accessed_via` confirmado por revisor.
3. Los `causal_links` con `pending:true` revisados → `pending:false` con fuente que
   respalde la afirmación causal concreta.
4. `editorial_status` elevado a `published` por un editor humano.

## 7. Reglas editoriales (validadores Sprint 14)

1. **Fuente verificada**: estructura válida (title+url+publisher) **+** `verification:"verified"`
   **+** `accessed_at` **+** URL no-placeholder (no `example.org/.com/.net`) **+** no `demo`.
2. **causal_links-exigen-fuente**: todo `causal_link` `pending:false` con `source_slugs`
   resolviendo a fuente publicable del mismo conflicto.
3. **source_slugs íntegros**: toda referencia debe existir en `sources` del conflicto.
4. **published exige fuente** (heredada): sin fuente publicable → falla.
5. **Merge seguro** (heredado): por defecto sólo integra fuentes verificadas.

## 8. Cobertura post-Sprint 14 (reporte)

`npm run verified:report` resume por conflicto. Estado hoy:

- Conflictos: **10**; con fuente verificada: **8 (80%)**; totalmente pendientes: **2**.
- Causal_links: **10** (verificados **4**, pendientes **6**).
- Fuentes verificadas totales: **8**; fuentes demo en artefactos publicables: **0**.
- Semilla verificada válida: **sí**; regla causal_links-exigen-fuente: **CUMPLE**.

## 9. Pruebas (Bloque 6)

- **258 tests** verdes (235 del Sprint 1–13 intactos + **23 nuevos** del Sprint 14).
- Cobertura nueva: inventario (build + on-disk), `isExampleUrl`, `validateVerifiedSource`,
  regla causal_links-exigen-fuente (4 casos), `validateVerifiedSeed`, cobertura verificada,
  `buildVerifiedDetail`, preview↔contrato v1, separación preview/canónico, content-health
  sobre el preview verificado.
- Gates CI sin DB verdes: `inventory:check`, `verified:check`, `seed:check` (Sprint 13),
  `validate-adapter`, `validate-conflicts-json`.

Reproducción:
```bash
cd api-server
npm test                 # 258 tests
npm run inventory:build  # regenera data/conflicts.inventory.json
npm run verified:report  # cobertura verificada vs. pendiente
npm run verified:enriched # regenera api/v1/conflicts.verified.enriched.json (sólo verified)
npm run inventory:check && npm run verified:check  # gates CI
```

## 10. Riesgos y mitigaciones

- **Riesgo**: URLs institucionales que roten (deep-links a informes datados). →
  **Mitigación**: se priorizaron páginas de aterrizaje/publicación estables; `accessed_at`
  y `accessed_via` documentan la verificación; `source-research.todo.json` lista lo frágil.
- **Riesgo**: confundir "fuente de contexto" con "fuente que respalda la causa". →
  **Mitigación**: 4 causal_links quedan `pending:true` pese a tener fuente, hasta revisión.
- **Riesgo**: promocionar a canónico sin criterio. → **Mitigación**: preview separado,
  `editorial_status:"review"` (no published), tests de separación preview/canónico.
- **Riesgo**: verificación `web-search` menos fuerte que `web-fetch`. → **Mitigación**:
  campo `accessed_via` explícito; el revisor humano puede re-confirmar los 3 casos.

## 11. Rollback

Todo es aditivo y vive en artefactos propios. Para revertir: eliminar los archivos
nuevos, los scripts de `package.json` y los 2 pasos de CI. Los canónicos y la semilla
demo del Sprint 13 no cambiaron → producción intacta.

## 12. Recomendaciones para Sprint 15

1. **Cerrar pendientes**: verificar `istanbul` (Montreux/Bósforo) e `ia-narrativa`
   (informe multilateral sobre integridad de la información) → 100% cobertura.
2. **Promover causal_links de contexto**: revisar los 4 `pending:true` con fuente y
   sustituir por fuentes que respalden la afirmación causal concreta.
3. **Re-confirmar `web-search` → `web-fetch`**: IAEA/OCHA/UNHCR con acceso directo.
4. **Promoción a canónico**: con `verified:check` verde y sign-off editorial, permitir
   merge del preview hacia los detalles canónicos (o vía DB `export:static:details`).
5. **UI pública**: badge de trazabilidad (verificada vs. pendiente) y enlace a la fuente
   en la ficha del conflicto, consumiendo el preview verificado.
6. **Gate de cobertura**: elevar `verified:check` para exigir cobertura mínima antes de
   permitir `published` por conflicto.
