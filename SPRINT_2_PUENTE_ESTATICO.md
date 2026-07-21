# Sprint 2 — Puente estático de conflictos (API v1)

Migra los focos locales de `data.js` hacia un **origen compatible con la API v1**
sin backend: un JSON estático servido en GitHub Pages en
`api/v1/conflicts.json`, más su equivalente GeoJSON de mapa. El adaptador del
[Sprint 1](./SPRINT_1_ADAPTADOR_API.md) lo consume sin cambiar la experiencia
de watchlist / mapa / filtros / export.

Es **aditivo y reversible**: `data.js` (FOCOS) se conserva como respaldo local
permanente y el modo API sigue desactivado por defecto (`GEOP_USE_API = false`).

> Depende de la infraestructura del Sprint 1 (PR #1, rama `sprint-1-api-adapter`).
> Esta rama parte de ese trabajo, no de `main`.

---

## Archivos

| Archivo | Rol |
|---|---|
| `api/v1/conflicts.json` | **Generado.** Lista de conflictos con forma del contrato v1 (`data` + `pagination` + `meta`). |
| `api/v1/conflicts/active/map.json` | **Generado.** `FeatureCollection` GeoJSON (equivale a `/conflicts/active/map`). |
| `scripts/generate-conflicts-json.mjs` | Generador: `data.js` (FOCOS) → JSON estático. Única fuente de verdad local. |
| `scripts/validate-conflicts-json.mjs` | Validación sin navegador: forma del contrato + round-trip real por el adaptador. |
| `api-adapter.js` | Ampliación retro-compatible: atajos de fidelidad para categoría/región. |
| `index.html` | Cablea `GEOP_CONFLICTS_STATIC` al puente (sin efecto mientras `GEOP_USE_API = false`). |

Los JSON de `api/` **no se editan a mano**: se regeneran desde `data.js`.

---

## Cómo regenerar el puente

```bash
node scripts/generate-conflicts-json.mjs
```

Reescribe `api/v1/conflicts.json` y `api/v1/conflicts/active/map.json` a partir
de `FOCOS`. Ejecutar siempre que cambie `data.js`.

---

## Mapeo `foco` (data.js) → `ConflictListItem` (API v1)

| Campo API v1 | Origen local | Nota |
|---|---|---|
| `id` | `foco.id` | Sin base de datos todavía; id y slug comparten identificador local. |
| `slug` | `foco.id` | **Debe** igualar `foco.id`: el adaptador usa `slug \|\| id`, así las URLs de detalle resuelven igual. |
| `name` | `foco.title` | |
| `summary` | `foco.summary` | |
| `conflict_type` | `{ slug: foco.category, label: CATEGORIES[cat].label }` | La categoría del frontend viaja como `conflict_type.slug`. |
| `primary_region` | `{ slug: slugify(foco.region), label: foco.region }` | Label = región canónica del frontend. |
| `status` | `"active"` | Todos los focos actuales son hotspots activos. |
| `intensity_level` | `foco.intensity` | Entero 1–5. |
| `energy_dimension` | `foco.category === 'energia'` | Derivado estructural de la categoría. |
| `location` | `{ latitude: coords.lat, longitude: coords.lng }` | |

### Campos sin dato local (defaults explícitos)

Estos campos del contrato v1 **no existen** en `data.js`. Para no inventar
hechos precisos, se emiten como `null` explícito y se rellenarán cuando la API
real (PostgreSQL/PostGIS) esté disponible:

- `escalation_risk`
- `humanitarian_impact`
- `territorial_dimension`
- `external_involvement`
- `updated_at` (la fecha de generación del puente va en `meta.generated_at`, no como fecha editorial)

---

## Fidelidad del round-trip (por qué se amplió el adaptador)

El adaptador Sprint 1 deriva la **categoría** y la **región** del frontend por
heurística de palabras clave sobre los textos de la API real. Ese mapeo es
lossy: p.ej. el resumen de Ucrania menciona "energética" y activaría la
categoría `energia` en vez de `conflicto`.

Como el puente estático ya está alineado con la taxonomía del frontend, se
añadieron dos **atajos de fidelidad retro-compatibles** en `api-adapter.js`:

1. **Categoría** — si `conflict_type.slug` ya es una categoría válida del
   frontend (`VALID_CATEGORIES`), se usa tal cual.
2. **Región** — si `primary_region.label` ya es una región canónica
   (`CANONICAL_REGIONS`), se usa tal cual.

La API v1 real usa slugs/labels ricos (`crisis_logistica`, `"Mar Rojo"`) que
**no** están en esos conjuntos, así que siguen cayendo a la heurística por
palabras clave existente. Ningún comportamiento previo cambia: la validación del
Sprint 1 (`scripts/validate-adapter.mjs`) sigue en verde.

Resultado: cargar el puente por el adaptador reconstruye exactamente los mismos
`id / región / categoría / intensidad / coords` que `data.js` local.

---

## Activar el modo API en staging (QA manual)

Por defecto la web usa datos locales. Para probar la cascada API-first contra el
puente estático, en la consola del navegador (o antes de cargar `app.js`):

```js
window.GEOP_USE_API = true;   // recargar la página
```

Cascada resultante:

```
API en vivo (GEOP_API_BASE)  →  ./api/v1/conflicts.json  →  data.js local
```

- Si el backend Render responde el contrato v1 → `source: 'api'`.
- Si el backend no responde → cae al puente estático → `source: 'static'`.
- Si tampoco hay puente → `source: 'local'` (la web nunca se rompe).

Verificación esperada: la watchlist, el mapa, los filtros por categoría/región y
el export deben verse **idénticos** al modo local, porque el puente round-trippea
a los mismos focos.

---

## Validación

```bash
node scripts/validate-conflicts-json.mjs   # forma del contrato + round-trip por el adaptador
node scripts/validate-adapter.mjs          # regresión del adaptador Sprint 1
node --check app.js                        # sintaxis
```

`validate-conflicts-json.mjs` simula `window`/`fetch`, sirve el JSON desde disco,
fuerza el fallback estático del adaptador y compara campo a campo el resultado
contra `data.js`.

---

## Notas de riesgo / caveats

- **GitHub Pages** sirve `api/v1/*.json` como ficheros estáticos; el `.nojekyll`
  del repo evita el procesado Jekyll. No es una API real: no hay paginación por
  query, filtros server-side ni `include=`.
- El **service worker** trata las rutas `/api/` como *network-only* (no las
  cachea), por diseño del Sprint 1. Offline, la cascada cae a `data.js`. No se
  modificó para preservar esa semántica.
- Campos `null` (riesgo de escalada, impacto humanitario, dimensiones) son
  esperados hasta que exista la base de datos; no confundir con "0".

---

## Siguiente paso (Sprint 3)

Levantar la API v1 real (PostgreSQL/PostGIS) según
[`especificacion_api_geopolem.md`](../especificacion_api_geopolem.md) y
[`esquema_base_datos_geopolem.sql`](../esquema_base_datos_geopolem.sql),
sembrando `conflicts` con `carga_semilla_geopolem.sql`, y cablear el endpoint
`GET /api/v1/conflicts/active/map` (GeoJSON) directamente al mapa para poblar los
campos hoy en `null` (escalation_risk, humanitarian_impact, dimensiones,
updated_at). El puente estático queda entonces como respaldo intermedio de la
cascada.
