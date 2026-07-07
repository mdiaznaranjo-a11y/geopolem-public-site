# Plan de integración de PRs — Cierre maestro GEOPÓLEM (serie #1–#30)

> **PREPARA, no ejecuta.** Este documento describe cómo integrar la cadena de
> PRs sin romperla. **No se ejecuta ningún merge ni approval** como parte del
> Sprint 30. Toda integración exige **sign-off humano**. Producción sigue
> **bloqueada**.

## Principio rector

Cada sprint depende **funcionalmente del anterior**, no de `main`. `main`
diverge de la cadena (contiene trabajo editorial de contenido, p. ej. el
carrusel de láminas, que no está en la serie). Por tanto:

- **No** fusionar PRs de la serie directamente a `main` fuera de orden.
- Integrar en **orden ascendente de sprint** (`#1 → #30`), rebasando/retargeteando
  cada rama sobre la anterior **ya integrada**.
- Tras cada merge, ejecutar los validadores `--check` y los tests (CI verde)
  **antes** de continuar con el siguiente.

## Riesgo destacado: Sprint 28 vs Sprint 27

El PR del **Sprint 28 (#28)** se planteó contra `main` pero depende
funcionalmente del **Sprint 27 (#27)**. Fusionar `#28` antes que `#27`, o
contra `main` sin la base de `#27`, deja el árbol sin sus dependencias
(referencias a backlog/scoring del Sprint 27) y provoca conflictos de rebase o
un estado incoherente.

**Acción:** integrar `#27` antes que `#28`, o **re-apuntar (retarget)** `#28` a
la rama del Sprint 27 antes de fusionar. Verificar con `npm run
education:backlog:check` y la suite educativa `--check`.

## Orden recomendado

1. Confirmar en GitHub la correspondencia real `PR#N ↔ Sprint N` (la convención
   está declarada en la auditoría de continuidad, pero **no verificada**).
2. Integrar por tramos, cada uno con CI verde antes del siguiente:
   - **Plataforma**: sprints 1–12 (adaptador → API v1 → CMS/admin → detalle/mapa).
   - **Editorial**: sprints 13–23 (fuentes/canonical → gobernanza → gate diseño).
   - **Educación**: sprints 24–30 (materiales → scoring/LMS → analítica/i18n → cierre).
3. Dentro de cada tramo, respetar el orden ascendente y la dependencia `N → N+1`.

## Estrategia de rebase / retarget

- Rebase de la rama `sprint-(N)` sobre `sprint-(N-1)` una vez integrada:
  - `git checkout sprint-(N)-... && git rebase sprint-(N-1)-...`
  - Resolver conflictos **conservando** la evolución de artefactos versionados
    (nunca descartar trabajo; ver riesgos de la auditoría).
- Si un PR apunta a `main` pero depende de otro sprint, **retarget** a la rama
  base correcta antes de fusionar.

## Verificaciones antes de cada merge

- `cd api-server && npm test` (suite completa, sin DB).
- Validadores `--check` relevantes al tramo, como mínimo:
  - Plataforma: `npm run export:static:check`, `npm run verify:static-routes`,
    `npm run migrate:check`.
  - Editorial: `npm run seed:check`, `npm run verified:check`,
    `npm run promote:check`, `npm run decisions:check`, `npm run gate:check`.
  - Educación: `npm run education:crosscheck:check`, `education:lms:check`,
    `education:batch:check`, `education:analytics:check`, `education:i18n:check`,
    `education:causal-scale:check`, `education:adr:check`, `education:queue:check`,
    `education:i18n:scale:check`, `education:dashboard:check`,
    `education:close-prep:check`.
  - Cierre: `npm run master-close:check` y `npm run verify:no-production`.
- `npm run verify:clean-tree` (garantía NO-WRITE/NO-DIFF de las validaciones).

## Verificaciones después de cada merge

- Re-ejecutar la suite y los `--check` del tramo sobre la rama integrada.
- Confirmar que **no** aparecieron flags de producción ni secretos
  (`npm run verify:no-production`).
- Regenerar y `--check` el paquete de cierre si cambió la cadena
  (`npm run master-close:write && npm run master-close:check`).

## Smoke tests

- API en modo fallback: `cd api-server && npm run smoke`.
- Rutas/detalle estático y deep-links: `npm run verify:static-routes`.
- PWA/offline y rutas del RC: `npm run qa:rc:json`.

## Rollback

- Artefactos canónicos: `npm run canonical:rollback:plan` /
  `canonical:rollback:backup` / `canonical:rollback:restore` /
  `canonical:rollback:verify`.
- Puente estático: regenerar desde la fuente (`npm run export:static`) o
  restaurar el artefacto versionado previo.
- Git: revertir el merge problemático (`git revert -m 1 <merge>`) en lugar de
  reescribir historia compartida; **no** usar `reset --hard`/force-push sobre
  ramas publicadas sin autorización humana.

## Sign-off humano (obligatorio)

Ningún merge/approval se ejecuta automáticamente. El cierre de la serie y
cualquier habilitación de producción requieren la decisión humana descrita en
`production-checklist.md` (gate humano) y en las condiciones de desbloqueo de
`continuity-audit.md`.
