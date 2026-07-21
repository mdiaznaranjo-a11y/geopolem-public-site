# Sprint 7 — CMS/Admin API, emisión/rotación JWT, relaciones enriquecidas y alertas

Rama: `sprint-7-cms-admin-jwt-alerts-relations` (sobre Sprint 6).

Este sprint añade la **superficie de escritura CMS/Admin** de la API v1, la
**emisión y rotación segura de JWT**, el **enriquecimiento de relaciones** en el
detalle de conflicto, **alertas operativas** de ejemplo y la **exportación de un
mapa enriquecido** — todo **sin tocar producción, sin secretos en el repo y sin
romper la PWA** (arquitectura reversible por capas: PostgreSQL/PostGIS → JSON
estático `api/v1/*.json` → `data.js`/FOCOS en el navegador).

Principio rector: **no inventar datos persistentes**. Las escrituras operan por
defecto en modo *prepared* (validan el contrato pero **no** persisten) hasta que
se activa explícitamente la persistencia contra una DB alcanzable.

---

## 1. Alcance

| Bloque | Entregable |
| ------ | ---------- |
| 1. CMS/Admin API | Endpoints `POST/PUT/PATCH /api/v1/admin/conflicts[/:id][/status]` protegidos por JWT+scope (siempre, aun en `public`). Validación de contrato (422), ciclo editorial y modo *prepared* por defecto. |
| 2. Emisión/rotación JWT | CLI `scripts/issue-jwt.mjs` (secreto sólo por entorno) + `signJwt`/`verifyJwtWithRotation` (ventana de solapamiento `JWT_SECRET`/`JWT_SECRET_PREVIOUS`) + `docs/jwt-rotation.md` (HS256 hoy, RS256/JWKS futuro). |
| 3. Relaciones enriquecidas | Detalle de conflicto con `actors/resources/chokepoints/causal_links/sources` desde la DB; fallback estático con arrays vacíos + tests de contrato. |
| 4. Alertas operativas | `docs/observability-alerts.example.yml` (reglas Prometheus sobre métricas del Sprint 6) + ejemplo de enrutado Alertmanager. Sin servicios externos. |
| 5. Mapa enriquecido | `map.enriched.json` aditivo (superconjunto compatible del mapa base) generado desde la DB con `--with-enriched-map`. |
| 6. Reporte | Este documento. |

---

## 2. Cambios realizados

### Nuevos archivos
- `api-server/src/validation.mjs` — validación pura del contrato de conflicto (crear/editar parcial), vocabulario CMS (`draft/review/published/archived`), tabla de transiciones y mapeo al enum persistente.
- `api-server/src/admin-repository.mjs` — capa de escritura: DB real (si `GEOP_ADMIN_WRITES=true` + DB alcanzable) o modo *prepared* seguro (sin persistir, sin inventar `id`).
- `api-server/src/admin-handlers.mjs` — handlers HTTP de creación/edición/cambio de estado (200 prepared / 201 persistido / 422 validación).
- `api-server/scripts/issue-jwt.mjs` — CLI de emisión de JWT HS256 (secreto sólo por entorno; nunca por argumento ni impreso).
- `api-server/db/migrations/0001_cms_status.sql` — migración **opcional y aditiva** (`ALTER TYPE … ADD VALUE`) para persistir `review`/`published` si se adopta; no requerida.
- `docs/jwt-rotation.md` — emisión, rotación HS256 sin caída y ruta futura RS256/JWKS.
- `docs/observability-alerts.example.yml` — reglas de alerta Prometheus de ejemplo.
- `api-server/test/validation.test.mjs`, `test/admin-api.test.mjs`, `test/jwt-rotation.test.mjs`, `test/jwt-issue.test.mjs`, `test/enriched-map.test.mjs`.
- `SPRINT_7_CMS_ADMIN_JWT_ALERTS_RELATIONS.md` (este documento).

### Archivos modificados
- `api-server/src/config.mjs` — `jwtSecretPrevious` (rotación) y `adminWritesEnabled` (persistencia de escrituras, OFF por defecto).
- `api-server/src/auth.mjs` — `signJwt()`, `verifyJwtWithRotation()`, `isAdminPath()` y `authorize()` reescrito: las rutas admin exigen SIEMPRE token+scope (aun en `public`); *fail-closed* 500 si falta el secreto.
- `api-server/src/db.mjs` — relación `sources` en `getConflictRelations`; `writeLayer` (crear/editar/cambiar estado, parametrizado) y `taxonomyIdBySlug`.
- `api-server/src/router.mjs` — dispatch admin (`routeAdmin`), `405` por método, lectura pública sólo `GET/HEAD`.
- `api-server/server.mjs` — parseo seguro de cuerpo JSON (límite 1 MiB → 413; JSON inválido → 400), CORS con métodos de escritura, etiquetas de métricas para endpoints admin.
- `api-server/scripts/export-static-bridge.mjs` — `buildEnrichedMapPayload`/`validateEnrichedMap` y flag `--with-enriched-map` (aditivo; valida en `--check`).
- `api-server/package.json` — scripts `issue:jwt` y `export:static:enriched`.
- `api-server/.env.example`, `.env.staging.example` — nuevas variables (`JWT_SECRET_PREVIOUS`, `GEOP_ADMIN_WRITES`).

---

## 3. Variables de entorno (nuevas en Sprint 7)

| Variable | Por defecto | Descripción |
| -------- | ----------- | ----------- |
| `JWT_SECRET_PREVIOUS` | *(vacío)* | Secreto HS256 **anterior** aceptado durante la ventana de rotación. Vacío fuera de rotación. |
| `GEOP_ADMIN_WRITES` | `false` | `false` = modo *prepared* (valida, **no** persiste, no inventa datos). `true` = persiste contra la DB (requiere `DATABASE_URL` alcanzable). |

Heredadas y relevantes: `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`,
`JWT_LEEWAY_SEC`, `GEOP_API_AUTH_MODE`, `GEOP_SCOPE_ADMIN` (`admin`),
`GEOP_SCOPE_CMS` (`cms:write`), `DATABASE_URL`, `PG_SSL`.

**Ningún secreto está en el repo.** `JWT_SECRET`/`JWT_SECRET_PREVIOUS`/`DATABASE_URL`
se inyectan por el entorno o los Secrets del proveedor.

---

## 4. Contrato de la API CMS/Admin

Prefijo protegido: `/api/v1/admin/*` (scope `admin`). Todos exigen
`Authorization: Bearer <jwt>` con scope suficiente, **incluso en modo public**.

| Método | Ruta | Acción |
| ------ | ---- | ------ |
| `POST` | `/api/v1/admin/conflicts` | Crear conflicto. |
| `PUT`/`PATCH` | `/api/v1/admin/conflicts/:idOrSlug` | Editar conflicto (parcial). |
| `POST`/`PUT` | `/api/v1/admin/conflicts/:idOrSlug/status` | Cambiar estado editorial. |

Ciclo editorial CMS: `draft → review → published → archived` (con retornos
válidos). Mapeo al enum persistente `geopolem_status` (sin migrar la DB):
`published → active`, `review → draft`, `draft → draft`, `archived → archived`.

Respuestas:
- **200** `meta.mode="prepared"`, `meta.persisted=false` — contrato válido, sin persistir (por defecto).
- **201** `meta.persisted=true`, `meta.mode="database"` — persistido (sólo con `GEOP_ADMIN_WRITES=true` + DB).
- **422** `error.code="validation_error"` con `details.errors[]`.
- **401/403** token ausente/ inválido / scope insuficiente. **500** *fail-closed* si falta `JWT_SECRET`.
- **405** método no permitido en la ruta.

Emisión de token (secreto sólo por entorno):
```bash
JWT_SECRET="$SECRET" npm run issue:jwt -- --sub ops@geopolem --scope admin --ttl 3600
```

---

## 5. Pasos de operación

### 5.1 Habilitar CMS/Admin en staging
1. Emitir un token admin con `issue:jwt` (ver §4) usando el `JWT_SECRET` del entorno.
2. Ejercitar en modo *prepared* (por defecto): valida el contrato sin escribir.
3. Cuando el ciclo editorial esté validado, activar `GEOP_ADMIN_WRITES=true`
   (requiere `DATABASE_URL` alcanzable) para persistir.
4. (Opcional) Si se adopta `published`/`review` como estados persistentes, aplicar
   `db/migrations/0001_cms_status.sql` en su propia sesión psql y actualizar el
   mapeo a identidad (documentado en la migración).

### 5.2 Rotación de JWT sin caída
Procedimiento de solapamiento (`JWT_SECRET` nuevo + `JWT_SECRET_PREVIOUS` anterior)
en `docs/jwt-rotation.md` §3. Vigilar `geopolem_auth_denials_total` durante la ventana.

### 5.3 Alertas operativas
Cargar `docs/observability-alerts.example.yml` en Prometheus
(`rule_files:`) sobre `GET /api/v1/metrics`. Ajustar umbrales por entorno y
enrutar a Alertmanager (ejemplo comentado al final del archivo).

### 5.4 Mapa enriquecido
`npm run export:static:enriched` (requiere `DATABASE_URL`) genera
`api/v1/conflicts/active/map.enriched.json` como **superconjunto compatible** del
mapa base. `npm run export:static:check` valida ambos si existen en disco.

---

## 6. Criterios de aceptación

- [x] `npm test` verde (93 pruebas, sin DB). +18 nuevas: validación, admin-api, rotación JWT, CLI de emisión, mapa enriquecido.
- [x] `npm run smoke` verde (HTTP end-to-end sin DB).
- [x] `npm run export:static:check` valida el puente en disco.
- [x] Endpoints admin exigen token+scope **también** en `GEOP_API_AUTH_MODE=public` (401/403/500 fail-closed).
- [x] Escritura por defecto en modo *prepared* (`persisted=false`, sin inventar `id`); persistencia sólo con `GEOP_ADMIN_WRITES=true` + DB.
- [x] Validación de contrato → 422 con `details.errors[]`; método incorrecto → 405.
- [x] Lectura pública intacta: `GET /api/v1/conflicts` sin token → 200.
- [x] CLI `issue-jwt` lee el secreto sólo del entorno; nunca lo imprime; emite tokens que la API acepta.
- [x] Rotación: `verifyJwtWithRotation` acepta secreto actual y anterior; rechaza secretos ajenos.
- [x] Detalle enriquecido expone siempre `actors/resources/chokepoints/causal_links/sources`.
- [x] Mapa enriquecido aditivo (compatible con el mapa base / PWA). `data.js`/FOCOS y fallback intactos. Sin secretos en el repo.

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
| ------ | ---------- |
| Escrituras que "inventen" datos. | Modo *prepared* por defecto: valida sin persistir y devuelve `id: null`; persistencia gated por `GEOP_ADMIN_WRITES=true` + DB alcanzable. |
| Divergencia vocabulario CMS ↔ enum DB. | Capa de mapeo (`cmsStatusToDbStatus`) sin tocar la DB; migración aditiva opcional documentada. |
| Exposición accidental de la superficie de escritura. | `authorize()` exige token+scope en rutas admin aun en `public`; *fail-closed* 500 sin secreto. |
| Cuerpos de petición abusivos. | Límite 1 MiB (413) y parseo estricto (400) en `server.mjs`. |
| Rotación mal configurada. | Ventana de solapamiento documentada; alerta `GeopolemAuthDenialSpike` sobre 401. |
| Mapa enriquecido rompiendo la PWA. | Superconjunto aditivo validado por `validateEnrichedMap` + tests; el cliente base ignora campos extra. |

## 8. Rollback

- **CMS/Admin**: `GEOP_ADMIN_WRITES=false` (vuelve a *prepared* sin redeploy de código). La superficie admin puede ignorarse por completo: la lectura pública no cambia.
- **Rotación JWT**: eliminar `JWT_SECRET_PREVIOUS` cierra la ventana.
- **Mapa enriquecido**: es aditivo; borrar `map.enriched.json` no afecta al mapa base ni a la PWA.
- **Migración de estados**: es `ADD VALUE` (no destructiva); no aplicarla mantiene el mapeo por defecto.
- **Global**: el frontend con `GEOP_USE_API=false` sigue sirviendo del puente estático/`data.js`. Todo Sprint 7 es aditivo y reversible por variable de entorno.

## 9. Recomendaciones para Sprint 8

- Exponer un endpoint de login/servicio que emita tokens (hoy CLI) y explorar RS256/JWKS (ver `docs/jwt-rotation.md` §4).
- Escrituras de relaciones (actores/recursos/chokepoints/causal_links) además de los campos base del conflicto.
- UI de administración mínima que consuma la API CMS/Admin.
- Persistir el vocabulario editorial completo (aplicar la migración opcional) y ajustar `v_active_conflicts_map`.
- Integrar `docs/observability-alerts.example.yml` en el stack real y añadir alertas específicas de la superficie de escritura (p. ej. ratio 4xx en `/admin`).
- Rate limiting distribuido (Redis) si se despliega multi-instancia.
