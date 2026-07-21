# Sprint 19 — Release Candidate, cola editorial accionable y QA

**Rama:** `sprint-19-release-candidate-editorial-qa` (basada en `sprint-18-release-simulation-precommit-canonical-rollback`)
**Estado global:** ✅ artefactos generados y verificados · **producción NO publicada** (deshabilitada por diseño)
**Regla de oro respetada:** sin datos inventados; sin secretos; sin promoción real.

Este sprint clasifica de forma accionable la cola editorial residual (8 pendientes),
empaqueta un **Release Candidate reproducible y no destructivo** que apunta a los
artefactos de *staging* ya validados, y añade **QA funcional (sin navegador, en CI)**
más un **QA visual opt-in con navegador** como evidencia complementaria.

---

## 1) Cola editorial accionable

Se leyó la cola existente `data/editorial-review-queue.json` (8 pendientes, contrato
`sprint-18-editorial-review-queue-v1`) y se clasificó cada ítem dentro de una
**taxonomía cerrada**: `resolved | needs_human_review | deferred | blocked_by_source | blocked_by_policy`.

La clasificación es **determinista** y se deriva de los campos ya presentes en cada
pendiente (tipo + `resolvable_in_repo`), reforzada con **evidencia de verificación
real del Sprint 19**: se reintentó el *fetch* directo de las 3 fuentes bloqueadas y
**todas volvieron a fallar** con el mismo estado documentado en Sprint 15/18.

| Conflicto | Pendiente | Clasificación | Gate | Evidencia Sprint 19 |
|-----------|-----------|---------------|------|---------------------|
| ukr-rus | fuente `iaea-ukraine-update-356` | **blocked_by_source** | source-access | `web-fetch → HTTP 402` (iaea.org) |
| isr-gaza-irn | fuente `ocha-opt` | **blocked_by_source** | source-access | `web-fetch → HTTP 403` (unocha.org) |
| sahel | fuente `unhcr-sahel-emergency` | **blocked_by_source** | source-access | `web-fetch → HTTP 403` (unhcr.org) |
| asia-agua | causal "Tratado de Aguas del Indo" | **needs_human_review** | editorial-signoff | requiere fuente causal específica |
| isr-gaza-irn | causal "Crisis humanitaria y escalada" | **needs_human_review** | editorial-signoff | requiere fuente causal específica |
| istanbul | causal "Régimen del Bósforo" | **needs_human_review** | editorial-signoff | requiere fuente causal específica |
| sahel | causal "Violencia armada y desplazamiento" | **needs_human_review** | editorial-signoff | requiere fuente causal específica |
| stablecoins | causal "Estabilidad financiera" | **needs_human_review** | editorial-signoff | requiere fuente causal específica |

**Resumen:** `needs_human_review=5`, `blocked_by_source=3`, `resolved=0`, `deferred=0`.
**8/8 siguen bloqueando producción.** Ninguno es resoluble sólo con el repo, por lo
que se mantienen pendientes con razón clara y trazable (no se inventaron fuentes).

- Artefacto: **`data/editorial-review-queue.rc.json`** (contrato `sprint-19-editorial-review-rc-v1`).
- `generated_at` heredado de la cola de origen ⇒ **no-diff** (regenerable sin ruido).
- Verificación: `npm run review:rc:check` (en CI).

> Además, un **gate de política** global marca `blocked_by_policy`: aunque se cerrasen
> todos los pendientes editoriales, la publicación real sigue deshabilitada
> (`PRODUCTION_PUBLISH_ENABLED=false`).

---

## 2) Paquete Release Candidate

Manifiesto **`api/v1/rc/manifest.json`** (contrato `sprint-19-release-candidate-v1`).
Vive bajo `api/v1/rc/` para ser **cacheable por el service-worker** (`/api/v1/*.json`)
y **elegible offline**, sin romper GitHub Pages.

Características:
- **Apunta** a los 13 artefactos de *staging* validados (bundle + 10 detalles + mapa +
  coverage) por **ruta relativa + `sha256`** — no duplica ni reescribe canónicos.
- **`checksum.aggregate`**: huella `sha256` estable e independiente del orden.
- **`coverage`**: gate 100% (desde `coverage-report.json`).
- **`source_review`**: resumen de la clasificación editorial (Bloque 1).
- **`rollback_pointer`**: plan de respaldo de los 14 canónicos de producción (Sprint 18),
  para un hipotético rollback — **no se ejecuta**.
- **`production`**: `publish_enabled=false`, `ready_for_promotion=false` con **blockers**
  explícitos (8 pendientes editoriales + política deshabilitada).
- **`is_production: false`** siempre.

Reproducible: `generated_at` heredado del `coverage-report` de *staging* ⇒ **no-diff**.
Verificación con **integridad real** (recalcula `sha256` de cada artefacto y el agregado):
`npm run rc:build:check` (en CI). Manipular un checksum o insertar una ruta canónica de
producción hace fallar `verifyRcManifest`.

---

## 3) QA visual/funcional

Dos niveles, complementarios:

### 3a) QA funcional sin navegador — **obligatoria en CI**
`scripts/qa-rc-routes.mjs` (módulo puro `qa-rc.mjs`, contrato `sprint-19-qa-rc-v1`).
Valida **contratos de ruta** consumiendo el RC/staging real: **7/7 rutas OK**.

| Ruta | Qué valida |
|------|------------|
| home | app-shell presente (`index.html`, `app.js`, SW, manifest) + JSON cacheables |
| map | mapa enriquecido de staging consumible (FeatureCollection) |
| ficha | los 10 detalles resuelven desde staging (envoltorio `{data}`) |
| deep-link | `#foco={id}` e ida-vuelta `view+foco+filtros` estables |
| filtros | las 7 claves de filtro parsean/serializan; omite vacíos; idempotente |
| pwa-offline | elegibilidad de caché RC/staging; `health` sólo-red; `.nojekyll`/manifest |
| offline-fallback | degradación limpia staging → canónico → local → none (no lanza) |

Ejecutar: `npm run qa:rc` · `npm run qa:rc:json`.
**Limitación (documentada):** valida **contratos** (datos/rutas/caché), **no píxeles**.

### 3b) QA visual con navegador — **opt-in, evidencia complementaria**
`scripts/qa-visual-rc.mjs`: sirve el repo con un servidor efímero de `node:http` (sin
dependencias) y abre Chromium **headless** vía **import dinámico** de Playwright. Si
Playwright o los navegadores no están disponibles, **hace *skip* limpio (exit 0)** — no
añade dependencias al proyecto ni rompe CI.

**Ejecutado en este entorno: OK 4/4** (home, mapa, ficha, deep-link+filtros) — cada
ruta montó `#root` sin errores de consola. Screenshots en `.rc-qa/` (gitignored).
Ejecutar: `npm run qa:rc:visual`.

---

## 4) Validación PWA/Offline del RC

Cubierta por la ruta `pwa-offline` y `offline-fallback` de la QA funcional:
- **Service-worker / caché:** todo `api/v1/rc/*.json` y `api/v1/staging/*.json` cumple el
  criterio de puente estático cacheable; `api/v1/health` permanece **sólo-red**.
- **Fallback local:** `resolveStagingDetail` degrada staging → canónico → `data.js` local
  y nunca lanza (devuelve `source:'none'` como último recurso).
- **GitHub Pages / PWA:** `.nojekyll` y `manifest.webmanifest` presentes; el RC usa rutas
  relativas bajo `api/v1/rc/` ⇒ **no rompe Pages ni la PWA**.

---

## 5) Pruebas

- Suite completa: **358 tests OK** (314 previos + 24 hidratados por sparse-checkout +
  **20 nuevos** de Sprint 19). `cd api-server && npm test`.
- Nuevo archivo: `api-server/test/sprint19-release-candidate.test.mjs` cubre:
  clasificación editorial (taxonomía, determinismo, evidencia), manifiesto RC
  (reproducibilidad, checksum, `verifyRcManifest` anti-manipulación y anti-canónico),
  QA de rutas/PWA/offline, y **garantía de árbol limpio** (los checks RC son no-write).
- CI (`.github/workflows/ci.yml`): 3 pasos nuevos — `review:rc:check`, `rc:build:check`,
  `qa:rc:json`.

---

## 6) Riesgos y condiciones Go / No-Go

**Riesgos:**
- 3 fuentes institucionales (IAEA/OCHA/UNHCR) siguen inaccesibles por *fetch* directo
  (402/403 vía proxy). Confirmadas por buscador, pero **requieren revisor humano** con
  acceso directo antes de producción.
- 5 vínculos causales tienen fuente de contexto pero **falta la fuente causal específica**
  (decisión editorial, no automatizable).
- El QA visual depende del entorno (Playwright/navegadores); por eso es opt-in y la QA
  obligatoria en CI es la de contratos.

**NO-GO a producción (todas activas):**
1. 8 pendientes editoriales sin resolver (5 `needs_human_review` + 3 `blocked_by_source`).
2. Falta **doble gate humano**: sign-off editorial + segunda confirmación.
3. **Política:** `PRODUCTION_PUBLISH_ENABLED=false`.

**GO (cumplidas para el RC):**
- Cobertura de *staging* 100%; artefactos íntegros (checksum verificado).
- QA funcional 7/7 y QA visual 4/4; PWA/offline OK; producción intacta; árbol limpio.

---

## 7) Recomendaciones Sprint 20

1. **Cierre editorial humano:** reconfirmar las 3 URLs bloqueadas con acceso directo (o
   sustituir por fuentes equivalentes accesibles) y aportar las 5 fuentes causales
   específicas; luego regenerar cola + RC (`review:rc:write`, `rc:build:write`).
2. **Promoción de RC → canónico con rollback:** cuando el doble gate humano exista y la
   política lo habilite, escribir canónicos usando `rollback_pointer` (backup previo).
3. **QA visual en CI (opcional):** *job* separado que instale Playwright y publique las
   screenshots como artefactos, manteniéndolo fuera de la ruta obligatoria.
4. **Firma del RC:** considerar firmar `checksum.aggregate` (p.ej. cosign) para trazar la
   procedencia del candidato.

---

## Entregables

| Tipo | Ruta |
|------|------|
| Módulo puro | `editorial-rc.mjs`, `rc-package.mjs`, `qa-rc.mjs` |
| Script | `scripts/editorial-review-rc.mjs`, `scripts/build-rc-package.mjs`, `scripts/qa-rc-routes.mjs`, `scripts/qa-visual-rc.mjs` |
| Artefacto | `data/editorial-review-queue.rc.json`, `api/v1/rc/manifest.json` |
| Test | `api-server/test/sprint19-release-candidate.test.mjs` |
| Config | `api-server/package.json` (scripts), `.github/workflows/ci.yml`, `.gitignore` |
