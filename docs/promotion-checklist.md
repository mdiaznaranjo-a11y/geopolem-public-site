# GEOPÓLEM — Checklist de promoción STAGING → PRODUCCIÓN

- **Versión:** 1.0.0 (Sprint 16)
- **Contrato staging:** `sprint-15-staging-canonical-v1` (bundle) · `sprint-15-staging-map-v1` (mapa)
- **Principio rector:** _no inventar datos_. Lo no verificable queda pendiente y
  documentado. La promoción a producción **exige sign-off editorial humano**.
- **Alcance:** este documento gobierna el paso de `api/v1/staging/**` a los
  artefactos canónicos de producción (`api/v1/conflicts.json`,
  `api/v1/conflicts/{id}.json`, `api/v1/conflicts/active/map*.json`, `data.js`/FOCOS).

> ⚠️ **Este sprint (16) NO promueve producción.** Es la lista de verificación que
> un revisor humano debe completar **antes** de autorizar cualquier promoción.

---

## 0. Preparación (automatizable, sin producción)

- [ ] `cd api-server && npm ci` (o `npm install`) sin errores.
- [ ] `npm test` en verde (incluye tests Sprint 16).
- [ ] `npm run validate:staging-artifacts` → OK (bundle, 10 detalles, mapa,
      coverage-report consumibles; separación canónica verificada).
- [ ] `npm run promote:check` → **AUTORIZA promoción: sí** y cobertura **100%**.
- [ ] `npm run verify:static-routes` → deep-links canónicos resueltos.

## 1. Cobertura y fuentes

- [ ] Cobertura de fuente verificada **10/10 (100%)** en `coverage-report.json`.
- [ ] Cada conflicto del bundle tiene al menos **una fuente `verification:"verified"`**.
- [ ] Ninguna fuente es `demo`, `example`, placeholder ni URL de ejemplo.

## 2. Revisión de fuentes `needs_human_review` (BLOQUEANTE)

Fuentes con acceso indirecto (`accessed_via:"web-search"`) recuperadas por
buscador pero **bloqueadas al fetch directo** por el proxy. Un revisor humano
debe **reconfirmar la URL con acceso directo** y quitar el flag, o sustituir la
fuente:

- [ ] `ukr-rus` / `iaea-ukraine-update-356` (IAEA) — reconfirmar URL.
- [ ] `isr-gaza-irn` / `ocha-opt` (OCHA oPt) — reconfirmar URL.
- [ ] `sahel` / `unhcr-sahel-emergency` (UNHCR) — reconfirmar URL.

> La lista viva está en `api/v1/staging/coverage-report.json → review_flags` y en
> `data/source-research.todo.json`. **No promover** mientras queden flags sin
> resolver salvo decisión editorial explícita registrada.

## 3. Enlaces causales pendientes (`causal_link.pending:true`) (BLOQUEANTE)

Tienen **fuente de contexto** pero la afirmación causal concreta **no** está
respaldada por la fuente (categoría _sourced-context-pending-causal_). Requieren
sign-off causal humano o reformulación:

- [ ] `isr-gaza-irn`
- [ ] `istanbul`
- [ ] `sahel`
- [ ] `asia-agua`
- [ ] `stablecoins`

> Verificados (`pending:false`): `rearme-global`, `ukr-rus`, `red-sea`,
> `mena-agua`, `ia-narrativa`. Confirmar que este recuento sigue vigente antes de
> promover.

## 4. Sign-off editorial

- [ ] Revisor editorial asignado y nombrado: `__________`.
- [ ] Fecha de revisión: `__________`.
- [ ] Cada `summary`, `name` y etiqueta de conflicto revisados (tono, exactitud).
- [ ] Decisión registrada para cada flag de §2 y cada pendiente de §3
      (resuelto / aceptado con justificación / bloqueado).
- [ ] `editorial_status` elevado de `review` según proceda.

## 5. QA de navegación pública / PWA (sin regresiones)

- [ ] Deep-links `#foco={id}` abren el detalle correcto para los 10 conflictos.
- [ ] Filtros por **región / tipo / severidad / recurso / actor / chokepoint**
      operan y la **URL serializa/restaura** el estado (round-trip).
- [ ] Service-worker cachea los JSON del puente (`/api/v1/*.json`) sin romper la
      caché pública; el resto de `/api/` permanece sólo-red.
- [ ] **Offline:** con red caída, el detalle degrada limpio
      staging → canónico → foco local (`data.js`) sin pantalla en blanco.
- [ ] (Si hay entorno) QA manual con Playwright/navegador; si no, cubierto por
      tests de módulo (`sprint16-deeplinks-staging`, `sprint16-pwa-offline`).

## 6. Separación e integridad de producción

- [ ] `api/v1/staging/**` **no** ha modificado ningún canónico
      (verificado por `validate:staging-artifacts` y por `git diff`).
- [ ] El bundle de staging declara `staging:true` / `canonical:false`.
- [ ] Ningún artefacto canónico quedó marcado `staging:true`.
- [ ] Sin secretos introducidos; PWA/GitHub Pages/fallbacks intactos.

## 7. Rollback (ensayado antes de promover)

- [ ] `npm run promote:staging` regenera staging de forma reproducible.
- [ ] `npm run promote:rollback` restaura el estado previo de staging.
- [ ] Plan de reversión de **producción** documentado (los canónicos viven en
      git; revertir = `git revert` del commit de promoción).

## 8. Criterios de PROMOCIÓN a producción (todos obligatorios)

- [ ] §1 cobertura 100% ✔
- [ ] §2 sin `needs_human_review` pendientes (o excepción firmada) ✔
- [ ] §3 sin `causal_link.pending` sin sign-off (o excepción firmada) ✔
- [ ] §4 sign-off editorial registrado ✔
- [ ] §5 QA navegación/PWA/offline sin regresiones ✔
- [ ] §6 producción intacta y separación garantizada ✔
- [ ] §7 rollback ensayado ✔
- [ ] Autorización humana explícita registrada: `__________` (nombre, fecha)

> Sólo con **todas** las casillas de §8 marcadas se puede abrir el PR de
> promoción a producción. La promoción **no** es responsabilidad de un agente
> autónomo.
