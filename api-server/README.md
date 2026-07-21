# GEOPÓLEM — API v1 (Sprint 3)

Servidor REST **read-only**, **PostgreSQL/PostGIS-ready**, para alimentar la web,
la PWA y el mapa de GEOPÓLEM desde la base de datos oficial — **sin romper el
sitio estático de GitHub Pages ni la app existente**.

Es un scaffold **aditivo y reversible**: vive en `api-server/` y no toca el sitio
estático. GitHub Pages sigue sirviendo el repo tal cual; este servidor es un
proceso Node aparte que se despliega en un backend (Render, Fly, Railway, VPS…).

## Arquitectura reversible por capas

El proyecto mantiene esta cascada de datos (regla técnica obligatoria):

```
1) API real PostgreSQL/PostGIS   (este servidor, con DATABASE_URL)
        │  ↓ si falla o no hay DB
2) JSON estático /api/v1/*.json   (puente Sprint 2, en el repo)
        │  ↓ (en el navegador, además)
3) data.js / FOCOS local          (respaldo permanente del frontend)
```

Este servidor implementa **las dos primeras capas**: intenta PostgreSQL y, ante
cualquier error o ausencia de `DATABASE_URL`, **cae automáticamente** al puente
estático `api/v1/conflicts.json` (generado desde `data.js` en el Sprint 2). Cada
respuesta incluye `meta.source` (`database` | `static`) para trazabilidad.

## Endpoints (contrato v1)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/health` | Estado del servicio, DB y PostGIS. Responde **sin DB**. |
| GET | `/api/v1/conflicts` | Lista paginada de conflictos (filtros + orden). |
| GET | `/api/v1/conflicts/active/map` | `FeatureCollection` GeoJSON de conflictos activos. |
| GET | `/api/v1/conflicts/:id` | Detalle por `slug` o UUID. `404` si no existe. |
| GET | `/api/v1/filters` | Facetas para la UI (regiones, tipos, estados, intensidad). |

### Parámetros de `/conflicts`

`region`, `conflict_type`, `status`, `intensity_min`, `intensity_max`,
`energy_dimension`, `territorial_dimension`, `external_involvement`,
`updated_after`, `page`, `page_size` (máx. 100), `sort`, `order`.

### Formatos de respuesta

- Objeto: `{ "data": {…}, "meta": { "request_id", "api_version", "source" } }`
- Lista: `{ "data": [], "pagination": { page, page_size, total, total_pages }, "meta": {…} }`
- Mapa: `{ "type": "FeatureCollection", "features": [], "meta": {…} }`
- Error: `{ "error": { "code", "message", "details?" }, "meta": {…} }`

## Ejecutar localmente

Requiere Node ≥ 18. **No hace falta `npm install`** para el modo estático
(cero dependencias en runtime; `pg` es opcional).

```bash
cd api-server

# Modo fallback estático (sin base de datos):
npm start
#  → http://localhost:8787/api/v1/health

# Pruebas de contrato (sin red ni DB):
npm test

# Smoke test HTTP end-to-end (levanta el servidor real):
npm run smoke
```

Prueba rápida:

```bash
curl http://localhost:8787/api/v1/health
curl "http://localhost:8787/api/v1/conflicts?page=1&page_size=5"
curl http://localhost:8787/api/v1/conflicts/active/map
curl http://localhost:8787/api/v1/conflicts/ukr-rus
curl http://localhost:8787/api/v1/filters
```

## Variables de entorno

Ver `.env.example`. Las principales:

| Variable | Por defecto | Uso |
|---|---|---|
| `PORT` | `8787` | Puerto de escucha. |
| `HOST` | `0.0.0.0` | Interfaz. |
| `CORS_ORIGIN` | `*` | Origen permitido (restríngelo en prod). |
| `DATABASE_URL` | *(vacío)* | Conexión Postgres. Vacío ⇒ fallback estático. |
| `PG_SSL` | `false` | `true` para proveedores gestionados. |
| `PG_POOL_MAX` | `5` | Tamaño del pool. |
| `API_DEFAULT_PAGE_SIZE` / `API_MAX_PAGE_SIZE` | `20` / `100` | Paginación. |

## Conectar PostgreSQL/PostGIS

1. Crea la base y aplica el esquema + semilla incluidos:

   ```bash
   createdb geopolem
   psql "$DATABASE_URL" -f db/schema.sql   # tablas, vistas, PostGIS
   psql "$DATABASE_URL" -f db/seed.sql      # datos semilla
   ```

   `db/schema.sql` y `db/seed.sql` son copias de los ficheros oficiales
   (`esquema_base_datos_geopolem.sql`, `carga_semilla_geopolem.sql`).
   `db/queries.sql` documenta, para revisión, las consultas read-only que usa
   el servidor (las mismas que implementa `src/db.mjs`, parametrizadas).

2. Instala el driver y arranca con DB:

   ```bash
   npm install            # instala `pg` (optionalDependency)
   DATABASE_URL=postgres://user:pass@host:5432/geopolem PG_SSL=true npm start
   ```

3. Comprueba: `GET /api/v1/health` debe devolver
   `database: "reachable"` y `postgis: true`.

### PostGIS-ready

La capa de consulta deriva la ubicación con `COALESCE(ST_Y(geom), latitude)` /
`COALESCE(ST_X(geom), longitude)`, de modo que funciona tanto si los datos
traen geometría PostGIS como si sólo traen columnas `latitude`/`longitude`. El
mapa usa la vista `v_active_conflicts_map` del esquema oficial.

## Activar staging (conectar el frontend)

El frontend **ya está preparado** (adaptador Sprint 1). Para que consuma esta
API en un entorno de staging, define en `index.html` (antes de cargar `app.js`):

```html
<script>
  window.GEOP_USE_API = true;
  window.GEOP_API_BASE = 'https://staging-api.geopolem.com'; // host de este servidor
  window.GEOP_CONFLICTS_STATIC = './api/v1/conflicts.json';  // respaldo si la API cae
</script>
```

Con esto: API real → JSON estático → FOCOS local. Si no se define nada,
`GEOP_USE_API` sigue en `false` y **el sitio se comporta exactamente igual que
hoy** (sin tocar la API). Nada de esto es necesario para GitHub Pages.

## Tests

- `npm test` — contrato v1 en modo fallback (10 pruebas, `node:test`, sin DB).
- `npm run smoke` — arranque HTTP real y verificación de los 5 endpoints.

## Dependencia de sprints previos

Este Sprint 3 se basa en la rama `sprint-2-conflicts-static-api` y **depende**
del puente estático que allí se generó (`api/v1/conflicts.json`), que a su vez
depende del adaptador del Sprint 1.

Orden de merge recomendado: **PR #1 → PR #2 → PR #3**.
