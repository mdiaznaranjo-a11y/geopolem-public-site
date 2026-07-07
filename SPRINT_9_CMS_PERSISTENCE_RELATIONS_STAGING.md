# Sprint 9 — Persistencia controlada del CMS, relaciones y staging

**Proyecto:** GEOPÓLEM — web/app/PWA geopolítica y energética
**Rama:** `sprint-9-cms-persistence-relations-staging` (basada en `sprint-8-admin-ui-editorial-flow-e2e`)
**Fecha:** 2026-07-07

## 1. Alcance

Convertir el CMS preparado (Sprint 7/8) en **persistencia controlada de staging**
sobre PostgreSQL/PostGIS, endureciendo la política de escritura a **fail-closed**,
preparando **migraciones relacionales idempotentes** para actores, recursos,
chokepoints, `causal_links` y `sources`, y validando el **flujo editorial
publicable** sin afectar producción ni romper la PWA.

Se respeta la arquitectura reversible por capas del proyecto:

> API real PostgreSQL/PostGIS → JSON estático `/api/v1/*.json` → `data.js`/FOCOS.

No se toca `data.js`/FOCOS, ni los fallbacks, ni la PWA, ni GitHub Pages. No se
introducen secretos reales. No se usa `localStorage`/`sessionStorage`/
`indexedDB`/`cookies`.

## 2. Cambios realizados

### 2.1 Persistencia real controlada (fail-closed)

El estado del Sprint 8 degradaba silenciosamente a modo `prepared` (200 fingiendo
guardado) cuando la escritura estaba activada pero el entorno estaba incompleto.
Sprint 9 lo corrige:

- **`src/config.mjs`** — nueva `adminWritesConfigState()` → `prepared` |
  `misconfigured` | `enabled` (según `GEOP_ADMIN_WRITES` y `DATABASE_URL`).
- **`src/admin-repository.mjs`** — nueva `writesConfigState()` que combina la
  configuración con la **alcanzabilidad real de la DB** en tiempo de ejecución:
  `prepared` | `misconfigured` | `unavailable` | `database`.
  - `create/update/setConflictStatus` devuelven `mode:'unavailable'` cuando la
    escritura fue solicitada pero el entorno está incompleto (no persisten y no
    inventan datos). Sólo con estado `database` ejecutan los `INSERT/UPDATE`
    parametrizados (usando id/UUID/serial reales del esquema).
  - `writesEnabled()` se conserva por compatibilidad (delega en el nuevo estado).
- **`src/admin-handlers.mjs`** — traducen `mode:'unavailable'` a **HTTP 503
  `service_unavailable`** con el motivo y `details.state`. La validación de
  contrato (422) sigue ejecutándose **antes** que cualquier intento de persistir.
- **`src/response.mjs`** — se añade el mapeo `service_unavailable → 503`.

Por defecto (`GEOP_ADMIN_WRITES=false`) el comportamiento es idéntico al de
Sprint 8: modo `prepared`, 200, `meta.persisted=false`. Compatibilidad total.

### 2.2 Migraciones relacionales (idempotentes, no destructivas)

El esquema base (`db/schema.sql`) ya define **todas** las tablas relacionales
(`conflict_state_actors`, `conflict_non_state_actors`, `conflict_resources`,
`conflict_chokepoints`, `causal_links`, `sources`, `source_links`). Por tanto
Sprint 9 aporta migraciones **aditivas** de índices/constraints y una vista
opcional, sin recrear tablas:

- **`db/migrations/0002_relational_integrity.sql`** — índices de apoyo a los
  filtros/orden de lectura y a las consultas del detalle enriquecido; constraints
  defensivos `CHECK` (slug/name no vacíos, `causal_links` sin auto-referencia)
  añadidos como `NOT VALID` y validados de forma diferida. Todo con
  `IF NOT EXISTS` o bloques `DO $$` guardados contra el catálogo → **re-ejecutable**.
- **`db/migrations/0003_publish_view.sql`** — redefine `v_active_conflicts_map`
  para incluir `status IN ('active','published')` **sólo si** el enum tiene el
  valor `published` (complementa a `0001_cms_status.sql`). Si no existe, es un
  **no-op** seguro. `CREATE OR REPLACE VIEW`, idempotente.

Compatibilidad PostgreSQL 13+/PostGIS. No usan `CONCURRENTLY` para poder correr
dentro de un runner transaccional.

### 2.3 Runner de migraciones

- **`scripts/migrate.mjs`** — aplica `db/migrations/*.sql` en orden sobre
  `DATABASE_URL` (import dinámico de `pg`, cada migración en su conexión). Modos:
  - (por defecto) aplica migraciones (requiere `DATABASE_URL` + `pg`).
  - `--check` → **lint estático sin DB**: rechaza sentencias destructivas
    (`DROP TABLE/COLUMN/TYPE/SCHEMA`, `TRUNCATE`, `DELETE FROM`, `ALTER TYPE ...
    DROP`) e informa si falta guarda de idempotencia. Ignora comentarios.
  - `--list` → lista las migraciones detectadas.
- **`package.json`** — scripts `migrate`, `migrate:check`, `migrate:list`.

### 2.4 Repositorio/queries enriquecidas reales

`src/db.mjs::queryLayer.getConflictRelations` (actores estatales/no estatales,
recursos, chokepoints, `causal_links`, `sources`) ya existía y es parametrizado y
tolerante. Sprint 9 añade **cobertura de contrato** (ver 2.6) que ejercita la ruta
DB simulada y el **fallback a arrays vacíos** sin necesidad de PostgreSQL.

### 2.5 Flujo editorial publicable

- **`src/validation.mjs`** — nuevas funciones puras y única fuente de verdad de la
  regla de publicación: `PUBLISHABLE_CMS_STATUSES = ['published']`,
  `isPubliclyVisible()`, `publicDbStatuses()`, `dbStatusIsPublic()`.
- Regla coherente con toda la arquitectura: `published → 'active'`;
  `v_active_conflicts_map` filtra `status='active'`; el export estático sólo emite
  features con `status==='active'`. Sólo `published` alimenta vistas públicas/mapa.
- Transiciones `draft → review → published → archived` (y las permitidas inversas)
  ya definidas en `STATUS_TRANSITIONS`; Sprint 9 añade tests del ciclo completo.

### 2.6 Pruebas (sin Docker/DB real) + CI PostGIS

Nuevos tests `node:test` (DB-free):

- `test/sprint9-admin-persistence.test.mjs` — fail-closed (503 misconfigured/
  unavailable), prepared por defecto, 422 antes de persistir, lectura intacta.
- `test/sprint9-editorial-publish.test.mjs` — ciclo editorial, visibilidad
  `published`, mapeo enum, filtrado del export.
- `test/sprint9-migrations.test.mjs` — lint de migraciones (existencia, orden,
  no destructivas, idempotencia).
- `test/sprint9-enriched-contract.test.mjs` — detalle enriquecido desde DB
  simulada (monkeypatch de `queryLayer`) + fallback a arrays vacíos.

CI (`.github/workflows/ci.yml`):

- Job sin DB: añade `migrate:check` y `e2e:editorial`.
- Job PostGIS: aplica `db/schema.sql` → **migraciones** (dos veces, para verificar
  idempotencia) → semilla, e invoca `npm run migrate` vía runner con `pg`.

## 3. Archivos creados / modificados

**Creados**
- `api-server/db/migrations/0002_relational_integrity.sql`
- `api-server/db/migrations/0003_publish_view.sql`
- `api-server/scripts/migrate.mjs`
- `api-server/test/sprint9-admin-persistence.test.mjs`
- `api-server/test/sprint9-editorial-publish.test.mjs`
- `api-server/test/sprint9-migrations.test.mjs`
- `api-server/test/sprint9-enriched-contract.test.mjs`
- `SPRINT_9_CMS_PERSISTENCE_RELATIONS_STAGING.md`

**Modificados**
- `api-server/src/config.mjs` (adminWritesConfigState)
- `api-server/src/admin-repository.mjs` (writesConfigState + fail-closed)
- `api-server/src/admin-handlers.mjs` (503 service_unavailable)
- `api-server/src/response.mjs` (mapeo 503)
- `api-server/src/validation.mjs` (helpers de publicación)
- `api-server/package.json` (scripts migrate*)
- `api-server/.env.example`, `api-server/.env.staging.example` (docs fail-closed)
- `.github/workflows/ci.yml` (migraciones + lint + e2e)

## 4. Variables de entorno

| Variable | Efecto Sprint 9 |
|---|---|
| `GEOP_ADMIN_WRITES` | `false` (defecto) = prepared. `true` = persistencia real; **requiere** `DATABASE_URL` alcanzable, si no → 503 fail-closed. |
| `DATABASE_URL` | Conexión PostgreSQL/PostGIS. Ausente → lectura por puente estático y escritura no habilitada. |
| `PG_SSL` | `true` para proveedores gestionados (usado también por el runner). |

Sin secretos reales en el repositorio.

## 5. Guía de uso en staging

```bash
cd api-server
# 1) Esquema base (una vez)
psql "$DATABASE_URL" -f db/schema.sql
# 2) Migraciones relacionales idempotentes (Sprint 9)
npm install                 # instala el driver pg (optionalDependency)
npm run migrate             # aplica 0001..0003
npm run migrate:check       # lint estático (sin DB), también en CI
# 3) Semilla opcional
psql "$DATABASE_URL" -f db/seed.sql
# 4) Activar escritura CMS real (staging)
export GEOP_ADMIN_WRITES=true
export GEOP_API_AUTH_MODE=required JWT_SECRET=... 
npm start
```

**Ciclo editorial → público (CMS → API → export → PWA):**

1. `POST /api/v1/admin/conflicts` (scope `admin`) crea en `draft`.
2. Transiciones `draft → review → published` vía
   `POST /api/v1/admin/conflicts/:id/status` (validadas contra el estado actual).
3. `published` mapea a enum `active`; la lectura pública y `v_active_conflicts_map`
   ya lo exponen.
4. `npm run export:static` regenera `api/v1/conflicts.json` y
   `conflicts/active/map.json` desde la DB (sólo `active`/publicados en el mapa).
5. La PWA consume el mismo contrato vía `api-adapter.js` (fallback intacto).

## 6. Criterios de aceptación

- [x] Escritura real controlada: sólo con `GEOP_ADMIN_WRITES=true` **y** DB viva.
- [x] Fail-closed ante config incompleta (503, no se finge guardado).
- [x] Sin IDs/timestamps inventados en `prepared`; IDs reales en `database`.
- [x] Migraciones relacionales idempotentes y no destructivas (lint + doble apply).
- [x] Queries enriquecidas reales + fallback a arrays vacíos (contrato testeado).
- [x] Transiciones `draft→review→published→archived` validadas; sólo `published`
      alimenta vistas públicas/export.
- [x] Tests locales sin Docker/DB (143 pasan); CI PostGIS ejercita la ruta real.
- [x] PWA, `data.js`/FOCOS, fallbacks y GitHub Pages intactos.
- [x] Sin `localStorage`/`sessionStorage`/`indexedDB`/`cookies`; sin secretos.

## 7. Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npm test` | **143/143 OK** (121 previas + 22 nuevas Sprint 9) |
| `npm run e2e:editorial` | OK (validación → admin prepared → enriched → export → PWA) |
| `npm run smoke` | OK (0 aserciones fallidas) |
| `npm run export:static:check` | OK (puente en disco válido) |
| `npm run migrate:check` | OK (3 migraciones, no destructivas, idempotentes) |
| `npm run migrate:list` | OK (0001, 0002, 0003) |

Nota de entorno: no hay PostgreSQL ni el paquete `pg` instalado en este entorno,
por lo que la **aplicación real** de migraciones y la persistencia `database` se
validan en el job PostGIS de CI. Los tests locales cubren la lógica fail-closed,
el lint de migraciones y el contrato enriquecido mediante mocks (sin DB).

## 8. Riesgos

- **Extensión del enum (`0001`)**: `ALTER TYPE ... ADD VALUE` debe ir en su propia
  transacción; `0003` es no-op salvo que `published` exista. Documentado.
- **`VALIDATE CONSTRAINT`** en `0002` podría avisar si hay filas legadas inválidas;
  se captura `check_violation` y se deja el constraint como `NOT VALID` (no rompe).
- **Activar `GEOP_ADMIN_WRITES=true` en un entorno equivocado**: mitigado por
  fail-closed (503) y por exigir siempre token+scope en `/admin`.

## 9. Rollback

- Revertir el merge de la rama restaura Sprint 8 (código puro; sin cambios en
  producción ni en datos).
- Las migraciones son aditivas: para deshacer índices/constraints basta
  `DROP INDEX IF EXISTS ...` / `ALTER TABLE ... DROP CONSTRAINT IF EXISTS ...`
  (operación manual y controlada; no incluida como script para evitar destructivos
  accidentales).
- Poner `GEOP_ADMIN_WRITES=false` devuelve la superficie admin a modo `prepared`.

## 10. Recomendaciones para Sprint 10

1. **Escritura de relaciones** (actores/recursos/chokepoints/`causal_links`/
   `sources`) desde el CMS, no sólo del conflicto base, con validación editorial.
2. **Tabla de migraciones aplicadas** (`schema_migrations`) para versionado y
   evitar reejecución innecesaria.
3. **Persistir el ciclo editorial nativo** aplicando `0001`/`0003` y mapear
   `review`/`published` a valores propios del enum (identidad).
4. **Auditoría CMS** (quién/cuándo/qué transición) y previsualización de `draft`.
5. **Tests de integración PG** dedicados (job que corre `node:test` contra la DB).
