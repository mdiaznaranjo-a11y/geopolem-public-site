# Sprint 17 — Promoción dry-run auditable, no-write/no-diff y sign-off humano

- **Rama:** `sprint-17-promotion-dry-run-no-diff-signoff` (basada en Sprint 16, `5f1d7bd`)
- **Principio rector (heredado):** _no inventar datos_; **no publicar producción**;
  no romper PWA/GitHub Pages/fallbacks; sin secretos.
- **Estado tras el sprint:** `npm test` → **316 pass / 0 fail**; árbol Git limpio
  tras ejecutar las validaciones (`npm run verify:clean-tree` → OK).

---

## 1. Alcance y motivación

El Sprint 16 detectó que la ruta de promoción **ensuciaba el árbol Git** al validar
(reescritura de `generated_at` en artefactos de `api/v1/staging/**`). Esto contamina
los PR y difumina la separación entre _validar_ y _escribir_.

Sprint 17 corrige esto de raíz y refuerza los controles humanos antes de cualquier
promoción a producción:

1. **`promote:check` estrictamente no-write/no-diff.**
2. **Dry-run auditable** que resume qué se escribiría **sin tocar disco**.
3. **Gate de sign-off humano** obligatorio para producción (nunca en CI).
4. **Prueba/So script de limpieza del árbol Git** antes/después de validar.
5. **Reporte** (este documento) y **tests** de todo lo anterior.

---

## 2. Cambios

### 2.1 CLI de promoción — `scripts/promote-canonical-staging.mjs` (endurecido)

Modos **mutuamente excluyentes** y claramente separados:

| Modo | Escribe | Descripción |
|------|:------:|-------------|
| _(sin modo)_ / `--json` | no | Reporte de texto/JSON del gate editorial. |
| `--check` | **no** | Sólo valida; `exit≠0` si hay bloqueos. Garantía no-write. |
| `--dry-run` | **no** | Simula la promoción a staging: resume qué se escribiría (paths, conteos, cobertura, bloqueos, warnings, checklist pendiente) **en memoria**. |
| `--write-staging` (alias `--staging-generate`) | sí (staging) | Escribe artefactos bajo `api/v1/staging/**` con respaldo/rollback. |
| `--promote-production` | **no** | Prepara la promoción a producción: **exige sign-off** y **siempre** se comporta como dry-run (jamás publica). |
| `--rollback` | restaura | Restaura el respaldo `.rollback` de staging. |

Flags auxiliares nuevos:

- `--generated-at=ISO` — timestamp **determinista** para escrituras reproducibles
  (elimina la fuente de diffs por `generated_at`).
- Guardas: `--check` + `--write-staging` es un error explícito (mutuamente excluyentes).
- Entorno `GEOP_STAGING_ROOT` — redirige la raíz de staging a un **tempdir** para
  aislar escrituras en tests/experimentos sin tocar los artefactos versionados.

### 2.2 Resumen puro — `conflict-promotion.mjs` → `summarizePromotion()`

Función **pura** (sin disco) que, a partir del bundle + gate + rutas destino,
produce el objeto auditable del dry-run: `would_write[]` (cada destino con
`canonical:false`), `counts`, `blockers`, `warnings`, `review_flags`,
`pending_checklist`, y las banderas `touches_disk:false` / `touches_canonical:false`.

### 2.3 Sign-off humano — `promotion-signoff.mjs` (módulo nuevo, puro)

- `resolveSignoff({ env, signoffPath, fileExists, readFile })`.
- Fuentes: variable de entorno `GEOP_PROMOTION_SIGNOFF` **o** archivo local no
  versionado `.promotion-signoff.json` (añadido a `.gitignore`).
- Formato env: `approver=NOMBRE;scope=production;date=YYYY-MM-DD`.
- Validación: exige `approver` y `scope=production`; valida formato de fecha; y
  **rechaza** cualquier valor que aparente un secreto (token/clave/password…).
- **No contiene secretos reales**: es una declaración auditable de autorización.

### 2.4 Garantía de limpieza — `scripts/check-clean-tree.mjs` (script nuevo)

Ejecuta sólo comandos read-only (`promote:check`, `promote --dry-run`,
`validate:staging-artifacts`) y comprueba, vía `git status --porcelain`, que
**no dejan diffs** en archivos versionados. `exit 1` si alguna validación ensucia
el repo; `exit 2` si `git` no está disponible (no da falso OK).

### 2.5 Scripts `npm` (`api-server/package.json`)

```
promote:dry-run          → --dry-run
promote:dry-run:json     → --dry-run --json
promote:production:dry   → --promote-production   (bloqueado sin sign-off)
verify:clean-tree        → node ../scripts/check-clean-tree.mjs
```

### 2.6 CI (`.github/workflows/ci.yml`)

Dos pasos nuevos en el job `api-server` (sin DB): `promote:dry-run` y
`verify:clean-tree`. CI **nunca** define `GEOP_PROMOTION_SIGNOFF`.

### 2.7 Docs

`docs/promotion-checklist.md` → v1.1.0: añade `promote:dry-run`, `verify:clean-tree`
y el **sign-off técnico** en la sección de criterios de promoción.

---

## 3. Comandos

```bash
cd api-server
npm test                     # 316 pass / 0 fail
npm run promote:check        # gate, NO escribe (no-write/no-diff)
npm run promote:dry-run      # resumen auditable de qué se escribiría (sin disco)
npm run promote:dry-run:json # idem, JSON
npm run verify:clean-tree    # confirma que las validaciones no dejan diffs

# Producción: BLOQUEADA sin sign-off humano explícito
npm run promote:production:dry                       # exit 3 (bloqueado)
GEOP_PROMOTION_SIGNOFF="approver=NOMBRE;scope=production;date=2026-07-07" \
  npm run promote:production:dry                     # acepta sign-off → dry-run (NO publica)

# Escritura de staging aislada (no toca artefactos versionados)
GEOP_STAGING_ROOT=/tmp/geop-staging \
  node ../scripts/promote-canonical-staging.mjs --write-staging --generated-at=2020-01-01T00:00:00.000Z
```

---

## 4. Garantías no-write / no-diff

- `promote:check` y `promote:dry-run` **no escriben** ningún archivo y **no dejan
  diffs** versionados (probado con `git status --porcelain` antes/después).
- El bug de Sprint 15/16 (`generated_at` reescrito al validar) queda **cerrado**:
  las validaciones no construyen ni escriben bundles; las escrituras admiten
  `--generated-at` determinista.
- El test de rollback (Sprint 15) ahora escribe en un **tempdir** (`GEOP_STAGING_ROOT`)
  y ya **no ensucia** `api/v1/staging` versionado.
- `verify:clean-tree` es la red de seguridad automatizada (local y en CI).

## 5. Sign-off humano

- **Ningún comando** puede promover producción sin sign-off explícito
  (`--promote-production` → `exit 3` si falta).
- Con sign-off válido, la herramienta **sólo** ejecuta un dry-run auditable:
  **no publica producción** en este sprint.
- El sign-off **no debe automatizarse en CI** (documentado en el checklist y en el
  encabezado del módulo). CI no define la variable.

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Un futuro comando escriba producción sin gate | El único punto de promoción a producción exige `resolveSignoff().ok`; producción sólo hace dry-run. Ampliar aquí requiere pasar el mismo gate. |
| Sign-off usado como vector de secretos | `resolveSignoff` rechaza valores que aparenten credenciales; `.promotion-signoff.json` está en `.gitignore`. |
| Escrituras futuras reintroduzcan `generated_at` no determinista | `--generated-at` disponible; `verify:clean-tree` en CI detecta cualquier regresión. |
| `git` ausente en algún entorno de test | `check-clean-tree` aborta con `exit 2` (no da falso OK); los tests usan `git status` directamente. |

## 7. Rollback

- Cambios de Sprint 17 son **aditivos** (nuevos módulos/scripts/tests + flags):
  revertir = `git revert` del commit del sprint.
- Los artefactos de staging **no se modifican** por este PR (garantizado por los
  tests y `verify:clean-tree`).

## 8. Recomendaciones Sprint 18

1. **Promoción a producción real, aún gated**: implementar la escritura canónica
   detrás de `resolveSignoff().ok` **más** una segunda confirmación explícita, con
   respaldo/rollback de canónicos y `git revert` documentado. Mantener prohibido en CI.
2. Resolver los `needs_human_review` (IAEA/OCHA/UNHCR) y los `causal_link.pending`
   pendientes del checklist §2/§3 antes de cualquier promoción.
3. Firmar/verificar el sign-off (p. ej. hash del commit + aprobador) para trazabilidad.
4. Añadir `verify:clean-tree` al pre-commit local (hook opcional) para atajar diffs
   accidentales antes del push.
