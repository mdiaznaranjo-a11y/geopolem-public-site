# Sprint 16 — Validación E2E de *staging*, QA de navegación/PWA y checklist de promoción

## 1. Alcance y motivación

El Sprint 15 dejó artefactos enriquecidos **staging-ready** bajo `api/v1/staging/**`
(bundle, 10 detalles, mapa enriquecido y coverage-report), con cobertura editorial
100%, gates y rollback, y **producción intacta**. La promoción a producción exige
revisión humana explícita.

Este sprint **valida end-to-end** esos artefactos y prepara el terreno para una
promoción segura, **sin tocar producción**:

1. Validación E2E de que staging es **consumible** y **no altera** los canónicos.
2. QA sin navegador de **deep-links y filtros** (región/tipo/severidad/recurso/
   actor/chokepoint) con **datos reales de staging** y serialización de URL.
3. Compatibilidad **PWA/offline**: cacheo del puente estático para staging y
   **fallback** de detalle staging → canónico → foco local.
4. **Checklist versionado** editorial/técnica de promoción.
5. Tests para cada bloque y wiring en CI.

**Principio rector (heredado):** _no inventar datos_. No se promueve producción.
No se introducen secretos. No se rompen PWA/GitHub Pages/fallbacks.

## 2. Rama y base

- **Base:** `sprint-15-canonical-enrichment-staging-ready`.
- **Rama:** `sprint-16-staging-e2e-pwa-qa-promotion-checklist`.

## 3. Cambios (archivos)

**Nuevos:**
- `staging-consume.mjs` — módulo **PURO** Sprint 16: rutas de staging, `unwrap`,
  `isCacheableBridgeJson`/`isStagingPath` (espejo del criterio del service-worker,
  fuente única testeable), `resolveStagingDetail` (fallback
  staging→canónico→local→none, nunca lanza) y validadores consumibles
  (`validateStagingBundle`, `validateStagingMap`, `validateCoverageReport`).
- `scripts/validate-staging-artifacts.mjs` — CLI E2E: valida bundle + 10 detalles
  + mapa + coverage-report y la **separación canónica** (producción intacta).
  Salida exit 0/1 para CI.
- `api-server/test/sprint16-staging-e2e.test.mjs` — 9 tests: consumo de staging y
  separación/producción-intacta.
- `api-server/test/sprint16-deeplinks-staging.test.mjs` — 10 tests: facetas,
  filtros por las 7 dimensiones y deep-links con datos de staging.
- `api-server/test/sprint16-pwa-offline.test.mjs` — 7 tests: cacheo del puente
  para staging y fallback offline del detalle.
- `docs/promotion-checklist.md` — checklist versionado STAGING→PRODUCCIÓN (v1.0.0).
- `SPRINT_16_STAGING_E2E_PWA_QA_PROMOTION_CHECKLIST.md` — este reporte.

**Modificados:**
- `api-server/package.json` — script `validate:staging-artifacts`.
- `.github/workflows/ci.yml` — paso Sprint 16 (`validate:staging-artifacts`).

**No modificados (garantía):** ningún artefacto canónico de producción
(`data.js`/FOCOS, `api/v1/conflicts.json`, `api/v1/conflicts/{id}.json`,
`api/v1/conflicts/active/map*.json`) ni el contenido de `api/v1/staging/**`.

## 4. Bloque 1 — Validación E2E de staging sin producción

`scripts/validate-staging-artifacts.mjs` (`npm run validate:staging-artifacts`)
lee `api/v1/staging/**` y comprueba:

- **Bundle** (`sprint-15-staging-canonical-v1`): `staging:true`, `canonical:false`,
  `gate.ok:true`, 10 conflictos con `id`/`name` coherentes.
- **10 detalles** (envoltorio `{data}` v1): validados con `validateDetail` del
  puente estático (mismos contratos que producción) + deep-link `#foco={id}`.
- **Mapa enriquecido** (`sprint-15-staging-map-v1`): FeatureCollection con
  `has_verified_source` y `needs_human_review` por feature (trazabilidad).
- **coverage-report**: `gate.ok:true`, `coverage_pct:100`, `review_flags` presente.
- **Separación canónica**: cada conflicto tiene su detalle **canónico aparte** en
  `api/v1/conflicts/{id}.json`; ningún canónico marcado `staging`.

Resultado: `OK: bundle=1, detalles staging=10/10, mapa enriquecido=1,
coverage-report=1, separación canónica verificada=10. Producción intacta.`

## 5. Bloque 2 — QA de navegación / deep-links / filtros (datos de staging)

Sin navegador, se construyen "focos" desde los detalles reales de staging y se
ejercita el **mismo motor** de la app pública (`public-enriched.mjs` +
`deeplinks.mjs`):

- Facetas derivadas cubren las 7 dimensiones (región/tipo/severidad/recurso/
  actor/chokepoint).
- Filtros individuales y combinados (AND), con degradación limpia ante
  dimensiones desconocidas o vacías (`all`/`''`).
- Deep-links: round-trip `serializeDeepLink`↔`parseDeepLink`, alias `?conflict=`,
  y direccionabilidad de los 10 conflictos por `#foco={id}`.

Ejemplos verificados con datos reales: `region=MENA` ⊇ {red-sea, mena-agua};
`type=Chokepoint` ⊇ {red-sea}; `severity=5` ⊇ {ukr-rus}; `resource=Petróleo`,
`actor=Rusia`, `chokepoint=Bab el-Mandeb`.

**Limitación declarada:** este entorno no dispone de navegador/Playwright; el QA
se cubre con **tests de módulo** puros que usan exactamente los módulos que
consume la UI. Un QA manual con navegador queda listado en el checklist (§5).

## 6. Bloque 3 — PWA / offline

- El service-worker (`service-worker.js`) cachea **network-first** los JSON del
  puente estático con el criterio `/api/v1/.+\.json$`, que **ya incluye**
  `api/v1/staging/**`; el resto de `/api/` sigue sólo-red y los MP4 nunca entran
  al app-shell. `isCacheableBridgeJson` replica ese criterio como fuente única
  testeable y un test verifica que el regex sigue presente en el SW.
- `resolveStagingDetail` implementa el **fallback** staging → canónico → foco
  local (`data.js`) → `none`, nunca lanza; cubre explícitamente el caso
  "**no existe detalle de staging**" y el modo **offline** (ambas cargas fallan →
  foco local).

## 7. Bloque 4 — Checklist de promoción

`docs/promotion-checklist.md` (v1.0.0), versionado en git. Incluye:
preparación automatizable, cobertura/fuentes, revisión de `needs_human_review`
(BLOQUEANTE), `causal_link.pending` (BLOQUEANTE), sign-off editorial, QA de
navegación/PWA/offline, separación e integridad de producción, rollback ensayado
y los **criterios obligatorios** con autorización humana explícita para promover.

Estado actual reflejado en el checklist (informativo, no promueve):
- **3 fuentes `needs_human_review`**: `ukr-rus/iaea-ukraine-update-356`,
  `isr-gaza-irn/ocha-opt`, `sahel/unhcr-sahel-emergency` (fetch directo bloqueado
  por el proxy; reconfirmación humana pendiente).
- **5 `causal_link.pending:true`**: `isr-gaza-irn`, `istanbul`, `sahel`,
  `asia-agua`, `stablecoins` (fuente de contexto presente; sign-off causal
  pendiente).

## 8. Pruebas

- **Suite completa `api-server`:** `303 tests, 303 pass, 0 fail` (277 previos +
  **26 nuevos** Sprint 16). Sin regresiones.
- **Validadores CLI (sin DB):**
  - `npm run validate:staging-artifacts` → OK (separación verificada).
  - `npm run promote:check` → AUTORIZA, cobertura 100%.
  - `npm run verify:static-routes` → 10 deep-links resueltos.

## 9. Riesgos y mitigaciones

- **QA sin navegador:** mitigado con tests de módulo que usan los módulos reales
  de la UI; QA manual listado en el checklist para el paso de promoción.
- **Fuentes indirectas:** siguen bloqueadas por el proxy; documentadas como
  bloqueantes en el checklist, sin fabricar cobertura.
- **Deriva del criterio de caché:** un test ata `isCacheableBridgeJson` al regex
  presente en el service-worker para detectar divergencias.
- **Contaminación de producción:** `validate:staging-artifacts` + tests de
  separación fallan si un canónico se marca `staging` o si falta su homólogo.

## 10. Recomendaciones Sprint 17

1. **Promoción a producción con sign-off humano**: completar el checklist §8 y
   abrir un PR de promoción revisado por un editor (no autónomo).
2. **Reconfirmar las 3 fuentes `needs_human_review`** con acceso directo, o
   sustituirlas, para levantar los bloqueos.
3. **Cerrar los 5 `causal_link.pending`** con sign-off causal o reformulación.
4. **QA E2E con navegador (Playwright)** en un entorno con soporte, reusando los
   deep-links/filtros ya validados aquí.
5. Considerar **precache selectivo** de los JSON de staging en el SW para primera
   carga offline determinista (opt-in, sin inflar el app-shell).

## 11. Cumplimiento de invariantes

- ✅ No se promueve producción; canónicos intactos (verificado por tests y CLI).
- ✅ Sin secretos; PWA/GitHub Pages/fallbacks preservados.
- ✅ Arquitectura respetada: API real v1 → JSON estático → fallback local.
- ✅ Módulos nuevos PUROS y testeables; separación staging/producción garantizada.
