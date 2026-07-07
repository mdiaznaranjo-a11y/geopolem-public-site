# Sprint 1 — Adaptador API con respaldo local

Capa de datos que permite a la watchlist y al mapa de GEOPÓLEM consumir
progresivamente el contrato público `/api/v1/conflicts` **sin romper** la
experiencia actual. Es aditiva y reversible: `data.js` (FOCOS) se conserva como
respaldo permanente.

Cumple los criterios de salida del Sprint 1 del
[plan de migración](../plan_migracion_tecnico_geopolem.md):

> La web puede funcionar con datos locales o API sin cambiar la experiencia
> visual. Si la API falla, la web no se rompe.

---

## Archivos

| Archivo | Rol |
|---|---|
| `api-adapter.js` | Cliente API + mapeo `conflict → foco` + lógica de fallback. |
| `app.js` | Consume el adaptador vía `loadWatchlistFocos()` y alimenta `allFocos`. |
| `index.html` | Configuración por entorno (`window.GEOP_*`). |
| `service-worker.js` | Precachea `api-adapter.js`; ya ignora las rutas `/api/`. |
| `scripts/validate-adapter.mjs` | Validación sin navegador (mapeo + fallback). |

---

## Cómo funciona

`app.js` llama a `loadWatchlistFocos({ localFocos: FOCOS })` al montar. El
resultado alimenta el estado `baseFocos`, que se fusiona con las fichas
editoriales (`customFocos`) para producir `allFocos` — la fuente única que ya
usaban la watchlist y el mapa. Nada más cambió en el render.

### Orden de fallback (siempre devuelve algo renderizable)

```
USE_API = false  ─────────────────────────────►  FOCOS locales (data.js)

USE_API = true
   1. GET {apiBase}/api/v1/conflicts   ── éxito ─►  conflictos adaptados
        │ error / vacío
        ▼
   2. GET {staticFallbackPath}          ── éxito ─►  conflictos adaptados
        │ error / vacío / no configurado
        ▼
   3. FOCOS locales (data.js)           ─────────►  respaldo permanente
```

El resultado incluye `source` (`'api' | 'static' | 'local'`) para trazabilidad;
`app.js` lo guarda en el estado `dataSource`.

---

## Configuración por entorno

Definir en `index.html` (o inyectar antes de cargar `app.js`). Valores por
defecto pensados para **no cambiar** el comportamiento actual:

```js
window.GEOP_USE_API        = false;                      // API-first on/off
window.GEOP_API_BASE       = "https://geopolem-api.onrender.com";
window.GEOP_CONFLICTS_PATH = "/api/v1/conflicts";
// window.GEOP_CONFLICTS_STATIC = "./api/v1/conflicts.json"; // opcional (GitHub Pages)
// window.GEOP_API_TIMEOUT_MS   = 8000;                       // opcional
```

| Entorno | `GEOP_USE_API` | `GEOP_API_BASE` |
|---|---|---|
| Local | `true` | `http://127.0.0.1:8000` |
| Staging | `true` | URL de staging |
| Producción (hoy) | `false` | — (usa datos locales) |
| Producción (Sprint 2) | `true` | `https://api.geopolem.com` |

> El adaptador es independiente del backend editorial autenticado (`/api/focos`,
> `/api/login`, …) que ya usaba `app.js`. Ese flujo no se modificó.

---

## Mapeo de compatibilidad `conflict` (API v1) → `foco` (frontend)

| Campo API v1 | Campo `foco` | Notas |
|---|---|---|
| `slug` (o `id`) | `id` | Sin id/slug → el objeto se descarta. |
| `name` | `title` | |
| `summary` | `summary` | |
| `intensity_level` | `intensity` | Acotado a `1..5`. |
| `location.latitude/longitude` | `coords.lat/lng` | |
| `primary_region.label/slug` | `region` | Heurística → conjunto fijo de la UI; default `Global`. |
| `conflict_type` + `energy_dimension` | `category` | Heurística → categorías de la UI; default `conflicto`. |
| — | `foda`,`pestel`,`actores`,`risks`,`scenarios` | Defaults seguros para que el detalle no se rompa. |
| `escalation_risk`,`status`,`updated_at`,… | `_api` | Metadatos crudos conservados. |

El contrato mínimo de referencia está en
[`especificacion_api_geopolem.md`](../especificacion_api_geopolem.md)
(sección "Contrato mínimo para frontend existente").

---

## Validación

```bash
node scripts/validate-adapter.mjs   # mapeo + orden de fallback (sin navegador)
node --check api-adapter.js         # sintaxis
node --check app.js
```

Prueba manual en navegador:

1. Servir la carpeta (`python3 -m http.server`) y abrir la app → watchlist/mapa
   idénticos (fuente `local`).
2. Poner `window.GEOP_USE_API = true` con `GEOP_API_BASE` apuntando a un backend
   caído → la app sigue funcionando con datos locales (ver aviso en consola).
3. Con la API v1 en línea → la watchlist se puebla desde `/api/v1/conflicts`.

---

## Reversibilidad

- **Desactivar API:** `window.GEOP_USE_API = false` (o quitar la línea). Vuelve al
  100% de datos locales.
- **Revertir todo el Sprint:** revertir el commit de la rama `sprint-1-api-adapter`.
  `data.js` nunca se tocó.

---

## Siguiente paso (Sprint 2)

1. Publicar `/api/v1/conflicts` estable (PostgreSQL/PostGIS) o un
   `./api/v1/conflicts.json` estático como puente.
2. Activar `GEOP_USE_API = true` en staging y validar watchlist + mapa.
3. Migrar los 15 focos locales a la tabla `conflicts` (mapeo id→slug) y conectar
   filtros a `/api/v1/regions` y `/api/v1/taxonomies`.
4. Sólo cuando la API sea estable y verificada, retirar `data.js` (regla Sprint 0:
   no borrar el respaldo local antes de tiempo).
