# Sprint 18 — Simulacro de release, pre-commit clean-tree y rollback de canónicos

- **Rama:** `sprint-18-release-simulation-precommit-canonical-rollback` (basada en Sprint 17, `cc017d7`)
- **Principio rector (heredado):** _no inventar datos_; **no publicar producción**;
  no romper PWA/GitHub Pages/fallbacks; sin secretos.
- **Estado tras el sprint:** `npm test` → **338 pass / 0 fail** (316 heredados + 22
  nuevos); `npm run verify:clean-tree` → OK (árbol Git limpio);
  `npm run release:simulate` → 7/7 etapas OK, sin publicar producción.

---

## 1. Alcance y motivación

Sprint 17 dejó la promoción a producción **bloqueada** tras un sign-off editorial y
un dry-run auditable no-write/no-diff. Sprint 18 **prepara el simulacro completo de
un release gated** sin tocar producción, cerrando las recomendaciones de Sprint 17:

1. **Segunda confirmación** de release, independiente del sign-off editorial.
2. **Rollback de canónicos** preparado (respaldo/restauración con integridad).
3. **Hook pre-commit opcional** que ejecuta `verify:clean-tree`.
4. **Resolución/documentación** de la revisión editorial residual
   (`needs_human_review` + `causal_link.pending`).
5. **Simulacro de release end-to-end** con reporte JSON/Markdown y árbol limpio.
6. Este **reporte** y **tests** de todo lo anterior.

Producción sigue **DESHABILITADA por diseño**: aunque el doble gate esté satisfecho,
`PRODUCTION_PUBLISH_ENABLED = false` y ninguna herramienta publica canónicos.

---

## 2. Cambios

### 2.1 Segunda confirmación — `release-confirmation.mjs` (módulo nuevo, puro)

Gate **independiente** del sign-off (separa "el contenido está listo" de "procede
publicar ahora"). `resolveReleaseConfirmation({ env, confirmPath, fileExists, readFile })`.

- Fuentes: env `GEOP_RELEASE_CONFIRM` **o** archivo no versionado `.release-confirmation.json`.
- Formato env: `confirmed_by=NOMBRE;scope=production;ack=<frase>;date=YYYY-MM-DD`.
- **Anti-automatización accidental:**
  - exige una **frase de reconocimiento exacta** (`REQUIRED_ACK = "confirmo publicacion
    a produccion"`), tolerante a tildes/mayúsculas pero no a valores triviales;
  - **se rehúsa en CI** (`CI`, `GITHUB_ACTIONS`, …): la confirmación jamás nace de un pipeline;
  - **rechaza secretos** (token/clave/password…).
- `evaluateProductionRelease({ signoff, confirmation })` → veredicto del **doble gate**:
  `ready_for_real_release` es **siempre `false`** en este sprint.

Integrado en `scripts/promote-canonical-staging.mjs --promote-production`: con
sign-off válido informa además el estado de la segunda confirmación, pero **sigue
siendo dry-run** y no publica producción (comportamiento y exit codes de Sprint 17
preservados; los cambios son aditivos).

### 2.2 Rollback de canónicos — `canonical-rollback.mjs` + `scripts/canonical-rollback.mjs`

Módulo **puro** de contratos: `planCanonicalBackup()`, `sha256()`, `diffManifests()`,
`isStagingLike()`. Canónicos protegidos: `api/v1/conflicts.json`,
`api/v1/conflicts/{id}.json`, `api/v1/conflicts/active/map.json` y los bundles
enriquecidos. **Nunca** incluye `api/v1/staging/**` (tiene su propio `.rollback`).

CLI con modos `--backup` / `--restore` / `--verify` / (plan). Copias **atómicas** y
manifiesto con **sha256** para verificar integridad. Raíz redirigible con
`GEOP_CANONICAL_ROOT` (tempdir/fixtures) para aislar pruebas. `simulateRollbackRoundtrip()`
ejecuta backup→mutación→restore→verificación enteramente en un tempdir.

**No ejecuta promoción real.** Es la red de seguridad para una futura promoción autorizada.

### 2.3 Hook pre-commit / clean-tree — `.githooks/pre-commit` + `scripts/setup-hooks.mjs`

Plantilla versionada `.githooks/pre-commit` que corre `check-clean-tree.mjs`
(saltable con `GEOP_SKIP_HOOKS=1`; degrada con aviso si falta `node`). Instalador
**opt-in y no destructivo** `setup-hooks.mjs`:

- `--check` (por defecto) informa el estado; **no escribe**.
- `--install` instala (idempotente); **respalda** un pre-commit ajeno a `pre-commit.local`
  y sólo lo sobrescribe con `--force`.
- `--uninstall` elimina sólo el hook gestionado por GEOPÓLEM y restaura el backup.
- `GEOP_HOOKS_DIR` redirige el destino (tests). Sin dependencias externas.

### 2.4 Cola de revisión editorial — `editorial-review.mjs` + `scripts/editorial-review-queue.mjs`

`buildReviewQueue({ seed, todo, generatedAt })` **consolida sin inventar datos** los
pendientes desde `data/conflict-relations.verified.seed.json` y
`data/source-research.todo.json`:

- **3** fuentes `needs_human_review:true` (IAEA/OCHA/UNHCR, acceso `web-search` con
  fetch directo bloqueado por proxy).
- **5** `causal_links` con `pending:true` (afirmación causal por confirmar con fuente
  específica).

Cada item incluye `status`, `reason` y `recommended_action`. **Todos requieren acceso
EXTERNO** (reconfirmar URL / fuente causal) → `resolvable_in_repo:false`; se mantienen
`pending` de forma honesta. Artefacto **determinista** (`generated_at` heredado del todo)
en `data/editorial-review-queue.json`; `--check` detecta desactualización (patrón `inventory:check`).

### 2.5 Simulacro de release end-to-end — `scripts/release-simulation.mjs`

Orquesta 7 etapas y produce reporte **JSON + Markdown**:

| # | Etapa | Qué valida |
|---|-------|------------|
| 1 | `checks` | gate editorial de promoción (no-write) |
| 2 | `dry_run` | resumen auditable, `touches_disk=false`, `touches_canonical=false` |
| 3 | `staging_validation` | consumo E2E de artefactos de staging |
| 4 | `clean_tree` | garantía NO-WRITE/NO-DIFF |
| 5 | `rollback_sim` | roundtrip de rollback de canónicos en tempdir |
| 6 | `editorial_queue` | cola de revisión residual al día |
| 7 | `release_gate` | doble gate (sign-off + 2ª confirmación) — producción DESHABILITADA |

Read-only sobre el repo o trabaja en tempdir: **deja el árbol limpio**. Por defecto
imprime a stdout; `--out-dir=DIR` escribe `report.json`+`report.md` (DIR gitignorado).

### 2.6 Scripts `npm` (`api-server/package.json`)

```
canonical:rollback:plan|backup|restore|verify   → scripts/canonical-rollback.mjs
hooks:setup | hooks:check                         → scripts/setup-hooks.mjs
review:queue | :json | :write | :check           → scripts/editorial-review-queue.mjs
release:simulate | :json                          → scripts/release-simulation.mjs
```

### 2.7 CI (`.github/workflows/ci.yml`)

Dos pasos nuevos en `api-server` (sin DB): `review:queue:check` y
`release:simulate:json`. CI nunca define `GEOP_PROMOTION_SIGNOFF` ni
`GEOP_RELEASE_CONFIRM` (la segunda confirmación además se **rehúsa** en CI por diseño).

---

## 3. Comandos

```bash
cd api-server
npm test                      # 338 pass / 0 fail
npm run verify:clean-tree     # árbol limpio tras validar
npm run review:queue          # cola de revisión editorial residual (texto)
npm run review:queue:check    # verifica que el artefacto está al día
npm run release:simulate      # simulacro end-to-end (Markdown), no publica producción
npm run release:simulate:json # idem, JSON

# Rollback de canónicos (aislado; NO promueve)
GEOP_CANONICAL_ROOT=/tmp/geop-canon npm run canonical:rollback:backup
GEOP_CANONICAL_ROOT=/tmp/geop-canon npm run canonical:rollback:verify

# Hook pre-commit opcional
npm run hooks:check
npm run hooks:setup           # instala verify:clean-tree como pre-commit (opt-in)

# Producción: BLOQUEADA. Ni con sign-off + 2ª confirmación se publica.
GEOP_PROMOTION_SIGNOFF="approver=NOMBRE;scope=production;date=2026-07-07" \
GEOP_RELEASE_CONFIRM="confirmed_by=NOMBRE;scope=production;ack=confirmo publicacion a produccion" \
  npm run promote:production:dry   # dry-run auditable; ready_for_real_release=false
```

---

## 4. Garantías

- **No se publica producción.** `PRODUCTION_PUBLISH_ENABLED=false`; el doble gate
  nunca habilita escritura de canónicos. `--promote-production` sigue siendo dry-run.
- **Doble gate humano.** Sign-off editorial (Sprint 17) **y** segunda confirmación
  (Sprint 18), independientes; la segunda se rehúsa en CI y exige frase deliberada.
- **Árbol limpio.** El simulacro y todas las validaciones son no-write/no-diff sobre
  versionados (probado con `git status --porcelain` y `verify:clean-tree`).
- **Rollback con integridad.** Respaldo/restauración de canónicos verificados por
  sha256; probado con roundtrip en tempdir. No toca staging ni el repo real en tests.
- **Sin secretos.** Sign-off y confirmación rechazan valores que aparenten credenciales;
  `.promotion-signoff.json` y `.release-confirmation.json` están gitignorados.
- **Sin datos inventados.** La cola de revisión sólo consolida lo ya presente en el repo.

## 5. Pendientes editoriales (accionables)

Consolidados en `data/editorial-review-queue.json` (8 pendientes; ninguno resoluble
sólo con el repo → requieren revisión humana antes del sign-off a producción):

- **Fuentes `needs_human_review` (3):** `ukr-rus/iaea-ukraine-update-356`,
  `isr-gaza-irn/ocha-opt`, `sahel/unhcr-sahel-emergency` — reconfirmar URL con acceso
  directo (fetch bloqueado por proxy: 402/403) o sustituir por fuente equivalente.
- **`causal_links` pendientes (5):** `isr-gaza-irn`, `sahel`, `istanbul`, `asia-agua`,
  `stablecoins` — aportar fuente que respalde específicamente el vínculo causal.

## 6. Rollback (de este PR)

- Cambios **aditivos** (módulos/scripts/tests + flags + artefacto de datos): revertir =
  `git revert` del commit del sprint.
- No se modifican canónicos de producción ni artefactos de staging (garantizado por
  `verify:clean-tree` y los tests).

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Que un futuro comando publique producción | `PRODUCTION_PUBLISH_ENABLED=false` + doble gate; ampliar exige pasar sign-off **y** 2ª confirmación **y** habilitar la bandera explícitamente. |
| Segunda confirmación disparada en CI | `detectCI()` la rehúsa; CI no define las variables. |
| Rollback restaure datos corruptos | Manifiesto con sha256 + verificación post-restore (`diffManifests`). |
| Cola editorial se desactualice | `review:queue:check` en CI; `generated_at` determinista evita diffs espurios. |
| Hook pise trabajo del usuario | `setup-hooks` es opt-in, idempotente y respalda hooks ajenos (no sobrescribe sin `--force`). |

## 8. Recomendaciones Sprint 19

1. **Escritura canónica real gated** detrás de `ready_for_real_release` (habilitar la
   bandera con doble gate + backup canónico obligatorio previo + `git revert` documentado).
   Mantener prohibido en CI.
2. **Resolver los 8 pendientes** de `editorial-review-queue.json` (reconfirmar URLs
   IAEA/OCHA/UNHCR y aportar fuentes causales) antes de cualquier promoción.
3. **Firmar la trazabilidad** del release: incluir hash del commit + aprobador +
   confirmador en un registro auditable de despliegues.
4. **Automatizar el backup canónico** como prerrequisito duro de cualquier escritura de
   producción (fail-closed si el manifiesto no verifica).
