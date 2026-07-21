# Sprint 6 — Promoción a staging y endurecimiento de seguridad/observabilidad

Rama: `sprint-6-staging-promotion-security-hardening` (sobre Sprint 5).

Este sprint prepara GEOPÓLEM para una **promoción controlada a staging real** y
endurece **seguridad y observabilidad** de la API v1, **sin tocar producción ni
exponer secretos** y **sin romper la PWA** (arquitectura reversible por capas:
API real → JSON estático `api/v1/*.json` → `data.js`/FOCOS en el navegador).

---

## 1. Alcance

| Bloque | Entregable |
| ------ | ---------- |
| 1. Regeneración estática programada | Workflow `static-bridge-refresh.yml` (DB→JSON) con `workflow_dispatch` + `schedule`, validación y PR automático (no destructivo). |
| 2. Promoción a staging | Script `staging-verify.mjs` (GO/NO-GO sin secretos en repo) + checklist operativo. |
| 3. Métricas duraderas | Endpoint `GET /api/v1/metrics` en formato Prometheus (cero dependencias) + bloque `observability.http` en `/health`. |
| 4. Seguridad API v1 | Rate limiting simple configurable + scopes/claims JWT (lectura/CMS/admin). |
| 5. Datos enriquecidos | Detalle de conflicto con relaciones (actores/recursos/chokepoints/causal_links) desde la DB; fallback estático con arrays vacíos + tests de contrato. |
| 6. Reporte | Este documento. |

---

## 2. Cambios realizados

### Nuevos archivos
- `.github/workflows/static-bridge-refresh.yml` — regeneración programada DB→estático + PR automático.
- `api-server/src/rate-limit.mjs` — rate limiting de ventana fija en memoria (cero deps).
- `api-server/scripts/staging-verify.mjs` — verificación de promoción (GO/NO-GO) contra un despliegue.
- `api-server/test/metrics.test.mjs`, `test/rate-limit.test.mjs`, `test/scopes.test.mjs`, `test/enriched-detail.test.mjs`.
- `SPRINT_6_STAGING_SECURITY_HARDENING.md` (este documento).

### Archivos modificados
- `api-server/src/config.mjs` — nuevas variables (métricas, rate limit, scopes).
- `api-server/src/observability.mjs` — contadores HTTP duraderos + exposición Prometheus.
- `api-server/src/auth.mjs` — parseo de scopes, comodín `admin`, mapa de scopes por ruta, autorización por scope.
- `api-server/src/handlers.mjs` — `handleMetrics()` + `observability.http` en health + detalle enriquecido.
- `api-server/src/router.mjs` — ruta `/api/v1/metrics`, hook de rate limiting (con exenciones).
- `api-server/src/repository.mjs` — merge de relaciones en el detalle (solo DB).
- `api-server/src/db.mjs` — `queryLayer.getConflictRelations()` (read-only, parametrizada).
- `api-server/server.mjs` — timing por petición, `recordRequest`, `clientId`, content-type de texto y cabeceras extra.
- `.github/workflows/ci.yml` — paso `verify:staging` contra la DB real (job PostGIS).
- `api-server/package.json` — script `verify:staging`.
- `api-server/.env.example`, `.env.staging.example` — documentación de las nuevas variables.

---

## 3. Variables de entorno (nuevas en Sprint 6)

| Variable | Por defecto | Descripción |
| -------- | ----------- | ----------- |
| `GEOP_METRICS_ENABLED` | `true` | Expone `GET /api/v1/metrics` (Prometheus). Público, como `/health`. |
| `GEOP_RATE_LIMIT_MAX` | `0` | Máx. peticiones por ventana. `0` = **desactivado** (modo public intacto). |
| `GEOP_RATE_LIMIT_WINDOW_MS` | `60000` | Tamaño de la ventana fija (ms). |
| `GEOP_SCOPE_READ` | *(vacío)* | Si se define y la auth está activa, los endpoints de lectura exigen este scope. Vacío = lectura abierta. |
| `GEOP_SCOPE_CMS` | `cms:write` | Scope exigido en `/api/v1/cms/*` (Sprint 7). |
| `GEOP_SCOPE_ADMIN` | `admin` | Scope exigido en `/api/v1/admin/*` (Sprint 7). Comodín de acceso total. |

Heredadas de Sprint 5 relevantes para staging: `DATABASE_URL`, `PG_SSL`,
`GEOP_API_AUTH_MODE` (`public`|`optional`|`required`), `JWT_SECRET`,
`JWT_ISSUER`, `JWT_AUDIENCE`, `CORS_ORIGIN`, `GEOP_OBS_LOG`.

**Ninguna variable contiene secretos en el repo.** Los secretos (DATABASE_URL,
JWT_SECRET) se inyectan en el panel del proveedor o en GitHub Actions Secrets.

---

## 4. Pasos de operación

### 4.1 Activar la API real en staging
1. Provisionar PostgreSQL/PostGIS gestionado (Neon/Supabase/Render…).
2. Aplicar `api-server/db/schema.sql` y `api-server/db/seed.sql`.
3. Desplegar `api-server` (Dockerfile ya existente) con variables:
   ```
   DATABASE_URL=postgres://…            # secreto del proveedor
   PG_SSL=true                          # gestionados
   GEOP_API_AUTH_MODE=optional          # probar tokens sin romper acceso público
   JWT_SECRET=<secreto largo aleatorio> # secreto del proveedor
   CORS_ORIGIN=https://mdiaznaranjo-a11y.github.io
   GEOP_METRICS_ENABLED=true
   GEOP_OBS_LOG=true
   ```
4. Verificar la promoción (sin secretos en repo):
   ```
   API_BASE=https://staging-api… EXPECT_SOURCE=database MIN_DB_RATIO=0.9 \
     EXPECT_AUTH=optional npm run verify:staging
   ```
   El script devuelve **GO** solo si `/health` reporta DB alcanzable,
   `meta.source=database`, `database_source_ratio ≥ MIN_DB_RATIO`, las rutas
   principales responden y la postura de auth es la esperada.

### 4.2 Regeneración del puente estático desde la DB
- Manual: Actions → *Static bridge refresh (DB → JSON)* → `Run workflow`
  (opción `dry_run` para validar sin escribir).
- Programada: cron diario `17 5 * * *` (UTC), conservador.
- Requiere Secrets `DATABASE_URL` (y opcional `PG_SSL`). Si faltan, el job se
  **salta limpiamente** (no falla). Si hay cambios en `api/v1/*.json`, abre un
  **PR automático** (`automation/static-bridge-refresh`) para revisión humana;
  **nunca** hace push a `main` ni fusiona/aprueba.

### 4.3 Rate limiting (endurecimiento progresivo)
- En `public` (por defecto) permanece **OFF** — la PWA no se ve afectada.
- Al promover a `required`, activar `GEOP_RATE_LIMIT_MAX` (p. ej. `120`) para
  proteger los endpoints de datos. `/health` y `/metrics` quedan siempre exentos.

---

## 5. Criterios de aceptación

- [x] `npm test` verde (52 pruebas, sin DB). Incluye métricas, rate limit, scopes y detalle enriquecido.
- [x] `npm run smoke` verde (HTTP end-to-end sin DB).
- [x] `npm run validate:staging` verde en modo fallback autónomo.
- [x] `npm run export:static:check` valida el puente en disco.
- [x] `GET /api/v1/metrics` responde texto Prometheus (`text/plain; version=0.0.4`).
- [x] Rate limiting devuelve `429` + `Retry-After` al superar el límite; `/health` y `/metrics` exentos.
- [x] Scopes: lectura abierta por defecto; `403` cuando `GEOP_SCOPE_READ` se exige y falta el scope.
- [x] Detalle de conflicto expone siempre `actors/resources/chokepoints/causal_links/sources`.
- [x] `data.js`/FOCOS y el fallback de la PWA intactos. Sin secretos en el repo.

---

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
| ------ | ---------- |
| Rate limiting en memoria no se comparte entre instancias. | Suficiente para staging/una instancia; documentar migración a store compartido (Redis) si se escala horizontalmente. |
| Cardinalidad de métricas por endpoint. | Acotada: etiquetas mapeadas a un conjunto fijo de endpoints v1 (no se usa el path crudo). |
| Regeneración estática con DB vacía. | El exportador aborta si la DB devuelve 0 conflictos (no sobreescribe con vacío) — heredado de Sprint 5. |
| PR automático genera ruido. | `concurrency` + rama fija reutilizada + `dry_run` disponible; requiere revisión humana. |
| `create-pull-request` action externa. | Solo en el workflow programado; permisos mínimos (`contents: write`, `pull-requests: write`); nunca toca `main`. |
| Enriquecimiento sin datos de relación en la DB. | Consultas tolerantes → arrays vacíos; contrato estable garantizado por tests. |

## 7. Rollback

- **Rate limiting**: `GEOP_RATE_LIMIT_MAX=0` (desactiva sin redeploy de código).
- **Métricas**: `GEOP_METRICS_ENABLED=false` (oculta `/metrics`).
- **Auth/scopes**: `GEOP_API_AUTH_MODE=public` (revierte a acceso anónimo) y/o `GEOP_SCOPE_READ=` vacío.
- **Datos**: revertir el PR automático del puente estático (no toca `main` sin merge).
- **Global**: el frontend sigue con `GEOP_USE_API=false` → sirve del puente estático/`data.js`. Todo Sprint 6 es aditivo y reversible por variable de entorno.

## 8. Recomendaciones para Sprint 7

- Implementar endpoints CMS/Admin reales (`/api/v1/cms/*`, `/api/v1/admin/*`) — el enforcement de scopes ya está preparado.
- Poblar las tablas de relación (actores/recursos/chokepoints/causal_links) y exponer el detalle enriquecido en el frontend.
- Rate limiting distribuido (Redis) si se despliega multi-instancia.
- Exportar el mapa completo (chokepoints, rutas, recursos) al puente estático con nuevas vistas.
- Emisión de JWT (endpoint de login/servicio) y rotación de `JWT_SECRET`.
- Alertas sobre `geopolem_database_source_ratio` y `geopolem_errors_total` en el recolector.
