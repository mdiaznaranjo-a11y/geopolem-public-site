# Sprint 5 — Puente estático desde PostgreSQL, observabilidad de `meta.source` y JWT

Sprint **técnico y aditivo**. Cierra el círculo de la arquitectura reversible por
capas de GEOPÓLEM añadiendo tres piezas de operación, sin reconstruir nada y sin
romper la web/PWA:

1. **Regeneración automática** del puente estático (`api/v1/*.json`) **desde
   PostgreSQL/PostGIS**, con el mismo contrato del Sprint 2.
2. **Observabilidad de `meta.source`**: logs estructurados + contadores in-memory
   para saber si cada respuesta salió de la DB o del fallback estático.
3. **Políticas JWT (HS256)** activables por entorno, **sin romper el acceso
   público por defecto**.

> Depende de PR #1 (adaptador), PR #2 (puente estático), PR #3 (API v1
> PostgreSQL-ready) y PR #4 (staging PostgreSQL). Esta rama
> (`sprint-5-static-bridge-observability-jwt`) parte de `sprint-4-staging-postgres-api`.
> Orden de merge recomendado: **#1 → #2 → #3 → #4 → #5**.

---

## 1. Arquitectura antes / después

### Regla de oro (se conserva intacta)

```
1) API real PostgreSQL/PostGIS  →  2) JSON estático /api/v1/*.json  →  3) data.js / FOCOS (navegador)
```

### Antes (Sprint 2–4)

- El puente estático `api/v1/conflicts.json` se generaba **desde `data.js`**
  (`scripts/generate-conflicts-json.mjs`).
- La API (Sprint 3/4) leía de PostgreSQL y caía al puente estático, pero **no
  había forma de regenerar el puente desde la DB** ni de observar qué origen
  servía cada respuesta.
- La API era 100% pública, sin capa de auth.

### Después (Sprint 5)

- Nuevo exportador **DB → puente estático** (`api-server/scripts/export-static-bridge.mjs`):
  el JSON estático puede reflejar la **DB canónica**, no sólo `data.js`.
- Cada respuesta registra su `source` (`database`/`static`/`error`) en **logs
  estructurados** y **contadores** expuestos en `/api/v1/health`.
- Auth JWT **opcional por entorno** (`public`/`optional`/`required`), con
  `public` por defecto.

```
                    ┌─────────────────────────────────────────────┐
 PostgreSQL/PostGIS │  export-static-bridge.mjs  (Sprint 5, NUEVO) │
   (canónico)  ─────┤    lee DB → valida → escribe atómicamente     │
                    └───────────────┬─────────────────────────────┘
                                    ▼
                    api/v1/conflicts.json  +  api/v1/conflicts/active/map.json
                                    ▼
        api-adapter.js  →  app.js / mapa / watchlist / filtros (PWA, GitHub Pages)
```

---

## 2. Flujo DB → static bridge → PWA

1. `export-static-bridge.mjs` abre la misma capa de consulta de la API real
   (`api-server/src/db.mjs`, `queryLayer.listConflicts`). **No duplica SQL.**
2. Convierte cada fila al `ConflictListItem` del contrato v1 (idéntico shape que
   el Sprint 2) y deriva la `FeatureCollection` del mapa **de los mismos items**
   (lista y mapa nunca divergen).
3. Valida el contrato **en memoria**; si falla, **no toca el disco**.
4. Escribe **atómicamente** (`.tmp` + `rename`) sobre `api/v1/conflicts.json` y
   `api/v1/conflicts/active/map.json`.
5. Revalida leyendo de disco (round-trip real).
6. La PWA/`api-adapter.js` consume esos JSON exactamente igual que antes: **el
   shape no cambia**, sólo cambia el `meta.source` a `postgres (static bridge,
   Sprint 5)` para trazabilidad.

---

## 3. Comandos de exportación

Desde `api-server/`:

| Comando | Efecto |
|---|---|
| `npm run export:static` | Lee `DATABASE_URL`, valida y **escribe** los JSON atómicamente. |
| `npm run export:static:dry` | Lee DB y valida, pero **no escribe** (`--dry-run`). |
| `npm run export:static:check` | **Sin DB**: valida los JSON ya presentes en disco (para CI). |

Comportamiento de seguridad (no corromper datos):

- **Sin `DATABASE_URL`** → error claro, **exit 1**, y **no modifica ningún
  archivo** (verificado en local).
- **DB con 0 conflictos** → aborta (no sobrescribe con vacío).
- **Fallo de validación** (en memoria o post-escritura) → aborta / reporta.

Ejemplo staging (proveedor gestionado):

```bash
cd api-server
npm install                       # instala el driver opcional `pg`
DATABASE_URL=postgres://USER:PASS@host/geopolem PG_SSL=true \
  npm run export:static:dry       # verificar primero
DATABASE_URL=... PG_SSL=true npm run export:static   # regenerar el puente
git diff api/v1/                  # revisar el cambio antes de commitear
```

---

## 4. Observabilidad de `meta.source`

Módulo `api-server/src/observability.mjs`.

### Señal 1 — logs estructurados (una línea JSON por respuesta)

```json
{"ts":"2026-07-07T09:00:00.000Z","level":"info","event":"api_response",
 "service":"geopolem-api","api_version":"v1","endpoint":"conflicts",
 "source":"database","request_id":"req_ab12cd34ef56"}
```

- Filtrable por `event=api_response` y agregable por `source`.
- `request_id` reutiliza el ya existente en `meta.request_id` (Sprint 3).
- Desactivable con `GEOP_OBS_LOG=false` (p. ej. en tests).

### Señal 2 — contadores in-memory en `/api/v1/health`

```jsonc
"observability": {
  "started_at": "…",
  "total": 128,
  "by_source": { "database": 120, "static": 8, "error": 0 },
  "by_endpoint": { "conflicts": { "database": 100, "static": 5, "error": 0 }, … },
  "last_source": "database",
  "last_database_at": "…", "last_static_at": "…", "last_error_at": null,
  "database_ratio": 0.9375
}
```

No expone secretos ni datos de conflictos: sólo **agregados numéricos** y
timestamps.

### Cómo decidir promover staging → producción

Tras apuntar `DATABASE_URL` al staging y generar tráfico de prueba:

- **`database_ratio` → ~1.0** y `last_static_at` **deja de avanzar** ⇒ la DB
  está sirviendo de forma estable ⇒ **candidato a promover**.
- Si `by_source.static` sigue creciendo (o `database_ratio` baja), la API está
  **cayendo al fallback** ⇒ **NO promover**; investigar conexión/SSL/esquema con
  `npm run validate:staging`.
- `by_source.error > 0` ⇒ hay errores no controlados ⇒ **bloquear** promoción.

---

## 5. Política JWT

Módulo `api-server/src/auth.mjs`. Verificación **HS256 con `node:crypto`** (sin
dependencias nuevas).

| `GEOP_API_AUTH_MODE` | Comportamiento | Uso |
|---|---|---|
| `public` (por defecto) | Sin auth. Acceso de lectura anónimo. | **Producción actual / PWA / GitHub Pages** — no rompe nada. |
| `optional` | Si llega `Authorization: Bearer <jwt>`, se valida (401 si es inválido/expirado). Sin token, se permite. | **Staging**: probar tokens sin romper el acceso público. |
| `required` | Todo endpoint de datos exige Bearer token válido → 401. | Entornos internos/privados. |

Reglas:

- **`/api/v1/health` SIEMPRE es público** (healthcheck de contenedor y oncall,
  observabilidad).
- **Fail-closed**: si el modo != `public` y falta `JWT_SECRET`, se responde
  **500** (no se sirve dato sin poder verificar).
- Errores estructurados reutilizando el contrato: `401 unauthorized`,
  `500 internal_error`.
- Se validan `exp`, `nbf` (con holgura `JWT_LEEWAY_SEC`), y opcionalmente `iss`
  (`JWT_ISSUER`) y `aud` (`JWT_AUDIENCE`). Sólo se admite `alg: HS256`
  (rechaza `none` y algoritmos asimétricos).
- **Sin secretos hardcodeados**: `JWT_SECRET` viene del entorno.

### Variables de entorno (Sprint 5)

| Variable | Defecto | Descripción |
|---|---|---|
| `GEOP_API_AUTH_MODE` | `public` | `public` \| `optional` \| `required`. |
| `JWT_SECRET` | *(vacío)* | Secreto HS256. Obligatorio si el modo != `public`. |
| `JWT_LEEWAY_SEC` | `30` | Holgura de reloj para `exp`/`nbf`. |
| `JWT_ISSUER` | *(vacío)* | Si se define, se valida `iss`. |
| `JWT_AUDIENCE` | *(vacío)* | Si se define, se valida `aud`. |
| `GEOP_OBS_LOG` | `true` | Emite la línea JSON de observabilidad por respuesta. |

Ver `api-server/.env.example` y `api-server/.env.staging.example` (sin secretos
reales).

---

## 6. Impacto en la PWA y preservación de integridad

- **Por defecto no cambia nada para el usuario**: `GEOP_API_AUTH_MODE=public` y
  el `data`-shape de `api/v1/*.json` es idéntico.
- No se tocaron `data.js`/`FOCOS`, `api-adapter.js`, `app.js`, `index.html`,
  `manifest.webmanifest` ni `service-worker.js`.
- El exportador **escribe atómicamente** y **valida** antes y después: nunca deja
  un JSON a medias que rompa el service worker o el mapa.
- La cascada **API real → JSON estático → data.js/FOCOS** se conserva.
- Los validadores Sprint 1/2 y los tests Sprint 3 siguen verdes (el round-trip
  del adaptador se ejecuta sin cambios).

Checklist de integridad al regenerar el puente desde la DB:

- [ ] `npm run export:static:dry` pasa (contrato válido) antes de escribir.
- [ ] `npm run export:static` termina con `OK: puente regenerado y validado`.
- [ ] `node scripts/validate-conflicts-json.mjs` (raíz) pasa el round-trip.
- [ ] `git diff api/v1/` revisado: sólo cambian datos esperados + `meta`.
- [ ] `slug` de cada item = `id` (las URLs de detalle siguen resolviendo).

---

## 7. Cambios de esquema / SQL

**No hay cambios de esquema en este Sprint.** El exportador reutiliza el esquema
y las consultas existentes (`api-server/db/schema.sql`, `queries.sql`,
`src/db.mjs`) tal cual: sólo **lee** (`SELECT` read-only). La auth y la
observabilidad son de capa de aplicación (no persisten nada). Por eso **no se
incluye ninguna migración**: añadir SQL sería innecesario y aumentaría el riesgo
sin beneficio.

---

## 8. Rollback

Todo es reversible y aditivo:

- **Observabilidad**: `GEOP_OBS_LOG=false` silencia los logs; los contadores son
  in-memory (desaparecen al reiniciar) y no afectan al contrato de datos.
- **JWT**: `GEOP_API_AUTH_MODE=public` (o quitar la variable) restaura el acceso
  público inmediato. No hay estado persistido.
- **Exportador**: si un puente regenerado no convence, `git checkout -- api/v1/`
  restaura el JSON previo (o regenerar desde `data.js` con
  `node scripts/generate-conflicts-json.mjs`, que sigue existiendo).
- **Código**: revertir el merge de PR #5 no afecta a PR #1–#4.

---

## 9. Archivos

| Archivo | Estado | Rol |
|---|---|---|
| `api-server/src/config.mjs` | Modificado | Config de auth (`GEOP_API_AUTH_MODE`, `JWT_*`) y observabilidad (`GEOP_OBS_LOG`). |
| `api-server/src/observability.mjs` | **Nuevo** | Contadores + logs estructurados de `meta.source`. |
| `api-server/src/auth.mjs` | **Nuevo** | Verificación JWT HS256 + política `authorize`. |
| `api-server/src/router.mjs` | Modificado | Aplica `authorize` (context con `Authorization`). |
| `api-server/src/handlers.mjs` | Modificado | Registra `source` por respuesta; `/health` expone observabilidad. |
| `api-server/server.mjs` | Modificado | Pasa la cabecera `Authorization`; log de arranque; error→observabilidad. |
| `api-server/scripts/export-static-bridge.mjs` | **Nuevo** | Regenera el puente estático DESDE PostgreSQL (atómico + validado). |
| `api-server/test/auth.test.mjs` | **Nuevo** | Tests de política JWT y `verifyJwt`. |
| `api-server/test/observability.test.mjs` | **Nuevo** | Tests de contadores y `/health`. |
| `api-server/test/export-bridge.test.mjs` | **Nuevo** | Tests del exportador con fixtures (sin DB). |
| `api-server/package.json` | Modificado | Scripts `export:static[:dry|:check]`. |
| `api-server/.env.example` | Modificado | Vars Sprint 5 (sin secretos). |
| `api-server/.env.staging.example` | Modificado | Vars Sprint 5 para staging (sin secretos). |
| `.github/workflows/ci.yml` | Modificado | Valida puente en disco (sin DB) y export dry-run (con PostGIS). |
| `SPRINT_5_STATIC_OBSERVABILITY_JWT.md` | **Nuevo** | Este documento. |

---

## 10. Validaciones ejecutadas

Todas en local, sin infraestructura externa (Node v20):

| Validación | Resultado |
|---|---|
| `npm test` (contrato + auth + observabilidad + export) | **34/34 PASS** |
| `npm run smoke` (HTTP end-to-end, sin DB) | **PASS** |
| `npm run validate:staging` (fallback autónomo) | **5/5 PASS** |
| `npm run export:static:check` (puente en disco) | **PASS** |
| `npm run export:static` sin `DATABASE_URL` | **exit 1, sin tocar archivos** |
| `node scripts/validate-adapter.mjs` (Sprint 1) | **PASS** |
| `node scripts/validate-conflicts-json.mjs` (Sprint 2) | **PASS** |

Pendiente de infraestructura (se ejercita en CI job `api-server-postgis`):

- Exportación real contra PostgreSQL/PostGIS (`npm run export:static:dry` con
  `DATABASE_URL`). Requiere DB con esquema + semilla; **no hay Docker/psql en el
  entorno de desarrollo actual**, por eso se delega a CI.

---

## 11. Qué queda manual (requiere DB real, proveedor o secretos)

- Ejecutar `npm run export:static` contra la **DB de staging real** y commitear
  el `api/v1/*.json` resultante (requiere `DATABASE_URL` + `PG_SSL`).
- Definir `JWT_SECRET` en el **panel del proveedor** (nunca en el repo) y elegir
  el `GEOP_API_AUTH_MODE` por entorno.
- Emitir los JWT (servicio emisor / iss / aud) si se activa `optional`/`required`.
- Decidir la promoción staging→producción leyendo `database_ratio` en `/health`.

---

## 12. Riesgos / bloqueos

- **Sin DB en el entorno de dev**: la ruta DB→static del exportador no se pudo
  probar localmente; queda cubierta por unit tests (funciones puras) y por CI
  con PostGIS.
- **HS256 (simétrico)**: el secreto debe distribuirse a emisor y verificador. Si
  se necesita rotación o multi-cliente, considerar RS256 en un Sprint futuro.
- **Contadores in-memory**: se reinician con el proceso y no agregan entre
  réplicas. Suficiente como señal de promoción; para métricas duraderas,
  exportar a Prometheus/OpenTelemetry en el futuro.

---

## 13. Recomendación para Sprint 6 técnico

1. **Promoción real a staging**: apuntar `DATABASE_URL` al proveedor gestionado,
   ejecutar `export:static` real, activar `GEOP_API_AUTH_MODE=optional` y validar
   `database_ratio→1.0` durante 24–48 h antes de producción.
2. **Automatizar la regeneración del puente**: workflow programado
   (`schedule`/`workflow_dispatch`) que ejecute `export:static` contra la DB y
   abra un PR con el `api/v1/*.json` actualizado (mantiene GitHub Pages fresco
   sin backend en caliente).
3. **Métricas duraderas**: exportar los contadores de observabilidad a
   Prometheus/OpenTelemetry y añadir un panel (retención más allá del proceso).
4. **Endurecer auth**: evaluar RS256 + rotación de claves y scopes por ruta si se
   abre la API a terceros; añadir rate-limiting (`429 rate_limited`, ya en el
   contrato de errores).
5. **Detalle enriquecido**: poblar `actors/resources/chokepoints/causal_links`
   del endpoint de detalle desde las tablas de relación (ya existen en el
   esquema) para superar el detalle "plano" del fallback estático.
