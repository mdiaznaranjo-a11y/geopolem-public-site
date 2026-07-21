# Sprint 15 — Cierre editorial 100% y promoción canónica controlada a *staging*

## 1. Alcance y motivación

El Sprint 14 dejó cobertura verificada **8/10**, dos pendientes explícitos
(`istanbul`, `ia-narrativa`), fuentes con acceso indirecto (`accessed_via:"web-search"`)
sin marcar para revisión, y un preview no canónico (`api/v1/conflicts.verified.enriched.json`).

Este sprint:

1. **Cierra la cobertura editorial al 100%** con fuentes reales verificadas por
   *fetch directo* para los 2 pendientes.
2. **Revisa las fuentes con acceso indirecto** y las marca `needs_human_review:true`
   sin borrar la transparencia.
3. **Promueve de forma controlada** el enriquecimiento verificado a **artefactos
   canónicos de STAGING** (`api/v1/staging/**`), separados de producción, con
   **gates editoriales** y **rollback**.

Principio rector (heredado): _no inventar datos_. Lo no verificable queda pendiente
y documentado; ningún artefacto de producción (`data.js`/FOCOS, `api/v1/conflicts.json`,
`api/v1/conflicts/{id}.json`, `map*.json`) se toca.

## 2. Cambios (archivos)

**Nuevos:**
- `conflict-promotion.mjs` — módulo **PURO** Sprint 15: gate de promoción
  (`validatePromotionReadiness`), builders de staging (`buildStagingDetails`,
  `buildStagingMap`, `buildPromotionBundle`), extracción de pendientes justificados
  y flags de revisión.
- `scripts/promote-canonical-staging.mjs` — CLI: gate + escritura de staging +
  rollback (`--write-staging`, `--check`, `--json`, `--rollback`, `--min-coverage=`).
- `api/v1/staging/conflicts.enriched.json` — bundle de staging (contrato `sprint-15-staging-canonical-v1`).
- `api/v1/staging/conflicts/{id}.json` — 10 detalles de staging (contrato de detalle v1).
- `api/v1/staging/conflicts/active/map.enriched.json` — mapa enriquecido de staging
  (contrato `sprint-15-staging-map-v1`) con trazabilidad de fuentes.
- `api/v1/staging/coverage-report.json` — cobertura antes/después + gate.
- `api-server/test/sprint15-canonical-promotion.test.mjs` — **19 tests nuevos**.
- `.gitignore` — excluye `api/v1/staging/.rollback/` (respaldos efímeros).

**Modificados:**
- `data/conflict-relations.verified.seed.json` — 2 fuentes verificadas nuevas
  (istanbul, ia-narrativa), `editorial_status` draft→review, 3 fuentes con
  `needs_human_review:true`, versión 1.1.0.
- `data/source-research.todo.json` — refleja cierre + bloque `needs_human_review`.
- `data/conflicts.inventory.json` — regenerado (10/10 con fuente verificada).
- `api/v1/conflicts.verified.enriched.json` — regenerado (preview con las 2 fuentes nuevas).
- `api-server/package.json` — scripts `promote:report|report:json|check|staging|rollback`.
- `api-server/test/sprint14-verified-sources.test.mjs` — asserts actualizados al
  nuevo estado (100%), pues Sprint 15 cierra intencionadamente los pendientes.
- `.github/workflows/ci.yml` — paso `promote:check` (gate sin DB).

## 3. Bloque 1 — Cierre de fuentes pendientes (cobertura 100%)

| conflicto | fuente verificada | publisher | URL | accessed_via |
|-----------|-------------------|-----------|-----|--------------|
| `istanbul` | Implementation of the Montreux Convention | Republic of Türkiye MFA | mfa.gov.tr/implementation-of-the-montreux-convention.en.mfa | **web-fetch** |
| `ia-narrativa` | Artificial Intelligence (AI) \| United Nations | United Nations | un.org/en/global-issues/artificial-intelligence | **web-fetch** |

Ambas se recuperaron por **fetch directo** (contenido confirmado). Cobertura de fuente
verificada: **10/10 = 100%**. Se elevó `editorial_status` de ambas a `review`.

**Honestidad causal (no se fabrica cobertura falsa):**
- `ia-narrativa`: la página de la ONU afirma explícitamente que *"AI-powered
  disinformation is already endangering UN peace and humanitarian operations"* →
  el `causal_link` pasa a `pending:false` con `source_slugs:["un-ai-global-issues"]`.
- `istanbul`: la fuente MFA respalda el **régimen de los Estrechos (Montreux)**, pero
  no la afirmación causal concreta sobre flujos de energía/grano → el `causal_link`
  queda `pending:true` **con** fuente de contexto (`turkiye-mfa-montreux`),
  categoría *sourced-context-pending-causal*, como los otros 4.

Resultado causal: **5 verificados** (`pending:false`), **5 con fuente de contexto
pendientes** de sign-off humano. **0 conflictos sin fuente**.

## 4. Bloque 2 — Revisión de fuentes indirectas

Las 3 fuentes `accessed_via:"web-search"` del Sprint 14 se **reintentaron por fetch
directo**; el proxy las sigue bloqueando:

| fuente | dominio | resultado fetch | acción |
|--------|---------|-----------------|--------|
| `iaea-ukraine-update-356` | iaea.org | HTTP 402 | `needs_human_review:true` |
| `ocha-opt` | unocha.org | HTTP 403 | `needs_human_review:true` |
| `unhcr-sahel-emergency` | unhcr.org | HTTP 403 | `needs_human_review:true` |

Se **preserva la transparencia**: conservan `verification:"verified"`, `accessed_via`
y se añade `review_reason`. `data/source-research.todo.json` gana un bloque
`needs_human_review` con las 3. No se elimina ninguna fuente.

## 5. Bloque 3 — Promoción canónica controlada a *staging*

Con el gate en verde y cobertura 100%, `npm run promote:staging` genera artefactos
**derivados y separados** bajo `api/v1/staging/**`:

- 10 detalles por conflicto (contrato de detalle v1, intercambiables con el canónico).
- `conflicts.enriched.json` (bundle con `staging:true`, `canonical:false`, `authorized:true`).
- `conflicts/active/map.enriched.json` (GeoJSON con `sources_count`,
  `has_verified_source`, `needs_human_review` por feature).
- `coverage-report.json` (antes: 0/10 con fuente en producción; después: 10/10).

**No se promociona a producción**: `data.js`/FOCOS y los canónicos v1 quedan intactos
(verificado por diff vacío y por tests de separación). La promoción a producción exige
**sign-off editorial humano**.

**Rollback**: la CLI respalda en `api/v1/staging/.rollback/` cualquier artefacto que
vaya a sobrescribir y `--rollback` restaura y limpia el respaldo (probado en tests).
Como staging es 100% regenerable desde la semilla, el rollback es seguro.

## 6. Bloque 4 — Gates editoriales

`validatePromotionReadiness` **BLOQUEA** (`gate.ok=false`) si:
1. la semilla verificada es inválida (reusa `validateVerifiedSeed`);
2. un `causal_link` real (`pending:false`) no tiene fuente publicable;
3. una fuente publicable es **demo** o usa **URL de ejemplo** (`example.org`);
4. un conflicto **`published`** no tiene fuente publicable;
5. un conflicto **sin fuente** no está **justificado** en `source-research.todo.json`;
6. un conflicto del inventario está **ausente** en la semilla.

Además exige **cobertura mínima** (defecto 100%): si no se alcanza, `coverage_ok=false`
→ **sólo preview, no promoción** (documentado, no fabricado). El **reporte de cobertura
antes/después** se emite en `coverage-report.json` y en `promote:report`.

Gate en CI sin DB: **`npm run promote:check`** (nuevo paso en `.github/workflows/ci.yml`).

## 7. Cobertura final (antes → después)

| métrica | Sprint 14 | Sprint 15 |
|---------|-----------|-----------|
| Conflictos con fuente verificada | 8/10 (80%) | **10/10 (100%)** |
| Totalmente pendientes | 2 | **0** |
| Causal_links verificados | 4 | **5** |
| Causal_links pendientes (con/sin fuente) | 6 | **5** (todos con fuente de contexto) |
| Fuentes verificadas totales | 8 | **10** |
| Fuentes `needs_human_review` | 0 (sin marcar) | **3** (marcadas) |
| Fuentes demo en publicables | 0 | **0** |

## 8. Pruebas (Bloque 6)

- **277 tests** verdes (258 previos + **19 nuevos** Sprint 15). 4 asserts del Sprint 14
  se actualizaron al estado 100% (cambio intencional del sprint, no regresión).
- Cobertura nueva: cierre 100%, no-fabricación causal, `collectReviewFlags`,
  transparencia de `needs_human_review`, `collectJustifiedPendingIds`, gate autorizado
  (real) + 5 escenarios de bloqueo (demo, causal-sin-fuente, published-sin-fuente,
  pendiente-no-justificado, cobertura-insuficiente), builders de staging + validación
  v1, separación preview/staging/canónico, **rollback** (integración CLI).

Reproducción:
```bash
cd api-server
npm test                    # 277 tests
npm run verified:report     # cobertura verificada (100%)
npm run promote:report      # gate de promoción + review flags
npm run promote:staging     # regenera api/v1/staging/**
npm run promote:rollback    # restaura respaldo de staging
npm run inventory:check && npm run verified:check && npm run promote:check  # gates CI
```

## 9. Riesgos y mitigaciones

- **Fetch bloqueado por proxy** en dominios ONU (IAEA/OCHA/UNHCR) → mitigado con
  `needs_human_review:true` + `review_reason`; el revisor humano reconfirma con acceso directo.
- **Confundir fuente de contexto con fuente causal** → `istanbul` y otros 4 quedan
  `pending:true` con fuente hasta sign-off humano; el gate no los cuenta como causal verificado.
- **URLs institucionales que roten** → `accessed_at`/`accessed_via` documentan la
  verificación; staging es regenerable.
- **Promover a producción sin criterio** → staging separado, `authorized` explícito,
  ningún conflicto `published`, tests de separación + gate `promote:check` en CI.
- **Churn de `generated_at`** en artefactos derivados → aceptable (regenerables);
  `.rollback` excluido de git.

## 10. Rollback

Todo es **aditivo o derivado**. Para revertir por completo: eliminar `conflict-promotion.mjs`,
`scripts/promote-canonical-staging.mjs`, `api/v1/staging/**`, los scripts `promote:*`
de `package.json`, el paso `promote:check` de CI y el test Sprint 15; revertir la
semilla/inventario/preview/todo al estado Sprint 14. Producción nunca cambió.
Rollback parcial de staging: `npm run promote:rollback`.

## 11. Recomendaciones para Sprint 16

1. **Sign-off editorial humano**: reconfirmar las 3 fuentes `needs_human_review` con
   acceso directo y promover los 5 `causal_links` de contexto a `pending:false` con
   fuente que respalde la afirmación causal concreta.
2. **Promoción a producción**: con sign-off, permitir el merge de `api/v1/staging/**`
   hacia los detalles canónicos (o vía DB `export:static:details`), con backup previo.
3. **UI pública**: badge de trazabilidad (verificada / needs-review) y enlace a fuente
   en la ficha del conflicto, consumiendo staging.
4. **Gate por conflicto**: exigir fuente causal verificada (no sólo de contexto) antes
   de permitir `published` individual.
