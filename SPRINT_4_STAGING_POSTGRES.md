# GEOPÓLEM — Sprint 4: Staging PostgreSQL/PostGIS + despliegue api-server

Sprint aditivo y reversible que deja el repositorio **listo para desplegar en
staging** el `api-server` de Sprint 3 contra una base **PostgreSQL/PostGIS**
(gestionada o local), validar la conexión, correr CI y **activar de forma
controlada** el frontend contra la API real — **sin romper ningún fallback**.

No despliega nada en servicios externos ni activa producción: prepara todo lo
necesario para que un humano lo ejecute con credenciales reales.

## Dependencias de sprints previos

- **Sprint 1** (PR #1, `sprint-1-api-adapter`): adaptador `api-adapter.js`.
- **Sprint 2** (PR #2, `sprint-2-conflicts-static-api`): puente estático
  `api/v1/conflicts.json` + `api/v1/conflicts/active/map.json`.
- **Sprint 3** (PR #3, `sprint-3-postgres-api-v1`): `api-server/` REST v1
  PostgreSQL/PostGIS-ready con fallback estático.
- **Este Sprint 4** (`sprint-4-staging-postgres-api`) se basa en Sprint 3.

Orden de merge recomendado: **PR #1 → PR #2 → PR #3 → PR #4**.

## Arquitectura de staging

```
   ┌──────────────────────────┐        ┌──────────────────────────────┐
   │  Frontend (GitHub Pages)  │        │  api-server (Node, Sprint 3)  │
   │  index.html + app.js      │──API──▶│  /api/v1/*  (read-only)       │
   │  window.GEOP_USE_API=true │        │                               │
   └──────────┬───────────────┘        └───────────────┬──────────────┘
              │ si API cae                              │ si DB cae / no hay DATABASE_URL
              ▼                                         ▼
   ./api/v1/conflicts.json  (puente estático)   ./api/v1/conflicts.json (mismo puente)
              │                                         │
              ▼                                         ▼
      data.js / FOCOS local                    (respuesta siempre renderizable)
```

Cascada de datos (regla técnica obligatoria):

1. **API real PostgreSQL/PostGIS** (`api-server` con `DATABASE_URL`).
2. **JSON estático** `/api/v1/*.json` (puente Sprint 2, en el repo).
3. **`data.js` / FOCOS local** (respaldo permanente del frontend).

Cada respuesta incluye `meta.source` (`database` | `static`) para trazabilidad.

## Archivos añadidos en este Sprint

| Archivo | Propósito |
|---|---|
| `api-server/.env.staging.example` | Variables de staging (sin secretos) + doc de vars del frontend. |
| `api-server/Dockerfile` | Imagen Node del api-server con `HEALTHCHECK`. Contexto de build = raíz del repo. |
| `docker-compose.staging.yml` | PostGIS + api-server local, con esquema y semilla auto-aplicados. |
| `.dockerignore` | Reduce el contexto de build (excluye assets/vídeos del sitio). |
| `api-server/scripts/validate-staging.mjs` | Valida DB (PostGIS/esquema/semilla) y endpoints (DB o fallback). |
| `api-server/scripts/healthcheck.mjs` | Healthcheck de contenedor (consulta `/api/v1/health`). |
| `.github/workflows/ci.yml` | CI: validadores estáticos + api-server sin DB + job PostGIS opcional. |
| `docs/staging-frontend-activation.example.html` | Ejemplo (no cargado) para activar el frontend en staging. |
| `SPRINT_4_STAGING_POSTGRES.md` | Este documento. |

No se modifica `data.js`, `FOCOS`, `api-adapter.js`, `app.js`, ni el puente
estático: el sprint es puramente aditivo.

## Variables de entorno (api-server)

| Variable | Ejemplo staging | Uso |
|---|---|---|
| `PORT` / `HOST` | `8787` / `0.0.0.0` | Escucha del servidor. |
| `DATABASE_URL` | `postgres://user:pass@host:5432/geopolem` | Conexión Postgres. **Vacío ⇒ fallback estático.** |
| `PG_SSL` | `true` (gestionado) / `false` (local) | SSL para Neon/Supabase/Render. |
| `PG_POOL_MAX` | `5` | Tamaño del pool. |
| `PG_STATEMENT_TIMEOUT_MS` / `PG_CONNECT_TIMEOUT_MS` | `5000` / `4000` | Timeouts de consulta/conexión. |
| `CORS_ORIGIN` | `https://mdiaznaranjo-a11y.github.io` | Origen permitido (restríngelo en prod). |
| `API_DEFAULT_PAGE_SIZE` / `API_MAX_PAGE_SIZE` | `20` / `100` | Paginación del contrato v1. |

Variables del **frontend** (se definen en `index.html` con `window.*`, no en el
servidor): `GEOP_USE_API`, `GEOP_API_MODE` (alias documental), `GEOP_API_BASE`,
`GEOP_CONFLICTS_STATIC`, `GEOP_API_TIMEOUT_MS`. Ver
`docs/staging-frontend-activation.example.html`.

## Comandos

### 1. Staging local reproducible con Docker (PostGIS + API)

```bash
# Levanta DB PostGIS (esquema + semilla auto-aplicados) y el api-server:
docker compose -f docker-compose.staging.yml up --build

# Verifica que la API usa la DB real:
curl http://localhost:8787/api/v1/health
#  → { "data": { "database": "reachable", "postgis": true, "active_source": "database", ... } }

curl "http://localhost:8787/api/v1/conflicts?page=1&page_size=5"   # meta.source: "database"
curl http://localhost:8787/api/v1/conflicts/active/map

# Limpieza (incluye el volumen de datos):
docker compose -f docker-compose.staging.yml down -v
```

### 2. Validación de staging (sin Docker)

```bash
cd api-server

# a) Modo fallback autónomo (arranca el server sin DB y valida source=static):
npm run validate:staging

# b) Contra una DB gestionada (valida PostGIS + esquema + semilla):
npm install                       # instala el driver `pg`
DATABASE_URL='postgres://...' PG_SSL=true npm run validate:staging

# c) Contra un api-server ya en marcha (valida endpoints DB/​fallback):
API_BASE='https://staging-api.geopolem.com' npm run validate:staging

# d) Completo (DB + endpoints, esperando database:"reachable"):
DATABASE_URL='postgres://...' API_BASE='http://localhost:8787' npm run validate:staging
```

### 3. Aplicar esquema y semilla en un proveedor gestionado

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f api-server/db/schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f api-server/db/seed.sql
```

### 4. Despliegue del api-server (genérico, cualquier proveedor)

- **Build**: contexto = raíz del repo, `-f api-server/Dockerfile`.
- **Comando de arranque**: `node server.mjs` (o `npm start` en `api-server/`).
- **Puerto**: `PORT` (por defecto 8787).
- **Healthcheck del proveedor**: `GET /api/v1/health` (responde con o sin DB).
- **Variables**: las de la tabla anterior; define `DATABASE_URL` y `PG_SSL=true`.

Notas por proveedor (sin secretos aquí, configúralos en su panel):

- **Neon / Supabase**: Postgres con PostGIS. Usa `sslmode=require` / `PG_SSL=true`.
- **Render / Railway / Fly.io**: crea el Postgres gestionado, aplica
  `schema.sql` + `seed.sql`, y despliega el contenedor apuntando a `DATABASE_URL`.

## Activación controlada del frontend

1. Despliega el `api-server` en staging y confirma
   `GET /api/v1/health → database:"reachable", postgis:true`.
2. En **staging** (NO producción), añade en `index.html` **antes** de cargar
   `app.js` el bloque de `docs/staging-frontend-activation.example.html`:
   `GEOP_USE_API=true`, `GEOP_API_BASE=<host staging>`,
   `GEOP_CONFLICTS_STATIC='./api/v1/conflicts.json'`.
3. Verifica en el navegador que la watchlist/mapa cargan y que, al apagar la API,
   el sitio cae al JSON estático y luego a FOCOS sin romperse.
4. **Producción permanece en `GEOP_USE_API=false` por defecto** hasta que haya
   autorización humana explícita. Sin definir nada, el sitio funciona como hoy.

## Checklist de puesta en staging

- [ ] PR #1 → #2 → #3 fusionadas (o base correcta encadenada).
- [ ] Provisionar Postgres con PostGIS (gestionado o `docker-compose.staging.yml`).
- [ ] Aplicar `db/schema.sql` y `db/seed.sql`.
- [ ] `DATABASE_URL` (+ `PG_SSL`) configurada en el entorno del proveedor (nunca en git).
- [ ] `CORS_ORIGIN` restringido al origen del frontend de staging.
- [ ] Desplegar api-server; `GET /api/v1/health` → `database:"reachable"`, `postgis:true`.
- [ ] `npm run validate:staging` con `DATABASE_URL` y `API_BASE` en verde.
- [ ] Activar `GEOP_USE_API=true` sólo en staging; verificar fallbacks.
- [ ] Producción intacta (`GEOP_USE_API=false`).

## Rollback

Todo es reversible y aislado; ningún paso toca datos existentes de producción:

1. **Frontend**: poner `GEOP_USE_API=false` (o quitar el bloque `window.GEOP_*`).
   El sitio vuelve al comportamiento 100% estático inmediatamente.
2. **API**: si la DB falla, el api-server ya cae solo al puente estático
   (`meta.source:"static"`); no requiere intervención.
3. **Despliegue**: detener/eliminar el servicio del api-server. GitHub Pages no
   depende de él.
4. **Base de datos**: `docker compose -f docker-compose.staging.yml down -v`
   (local) o eliminar la instancia gestionada. El esquema/semilla se re-aplican
   de forma idempotente sobre una base vacía.
5. **Código**: revertir el merge del PR #4 (aditivo) no afecta a Sprints 1–3.

## Riesgos y notas

- El puente estático **debe** existir (`api/v1/conflicts.json`, de Sprint 2)
  para que el fallback y el contenedor funcionen; el Dockerfile lo copia.
- `pg` es dependencia **opcional**: sin instalar, el servidor sirve en estático.
  El job PostGIS de CI ejecuta `npm install` para probar la ruta real.
- La semilla es **prototipo editorial**; revisar fuentes antes de producción.
- `CORS_ORIGIN=*` sólo para desarrollo; en staging/prod restríngelo.

## Qué queda manual (requiere humano/proveedor)

- Crear la instancia PostgreSQL/PostGIS gestionada y sus **credenciales**.
- Definir `DATABASE_URL`/`PG_SSL` en el panel del proveedor (fuera de git).
- Desplegar el contenedor del api-server en el proveedor elegido.
- Editar `index.html` de staging para activar `GEOP_USE_API` (paso deliberado).
- Autorización humana para activar la API en **producción**.

## Recomendación para Sprint 5

Con staging validado, Sprint 5 debería: (1) automatizar la **regeneración del
puente estático** desde la DB (job que exporta `conflicts.json`/`map.json` para
mantener el fallback siempre fresco); (2) añadir **observabilidad** (logs
estructurados + métricas de `meta.source` para medir cuánto se usa DB vs.
estático); (3) endurecer seguridad (rate-limiting, `CORS_ORIGIN` fijo, cabeceras);
y (4) preparar la **promoción controlada a producción** con feature flag y plan
de rollback documentado.
