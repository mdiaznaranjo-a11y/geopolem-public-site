# Sprint 10 — Detalle enriquecido público, mapa con filtros avanzados y relaciones energéticas

> Rama: `sprint-10-public-enriched-detail-map-filters` · Base: `sprint-9-cms-persistence-relations-staging`
> Arquitectura preservada: **API real v1 → JSON estático `/api/v1/*.json` → fallback local `data.js`/FOCOS**.
> PWA, GitHub Pages y fallbacks intactos. Sin secretos reales. Sin tocar producción.

## 1. Alcance

Integrar el **detalle enriquecido** (Sprints 6–9) en la **experiencia pública** web/PWA y en el mapa,
sin romper el fallback local ni la arquitectura de datos:

1. **Ficha pública de conflicto enriquecida**: título, región, país, severidad, resumen, estado,
   coordenadas, fuentes, actores, recursos energéticos, chokepoints y `causal_links`.
2. **Filtros avanzados del mapa**, no destructivos y auto-derivados de los datos.
3. **Renderizado de relaciones energéticas** (actor↔conflicto, recurso↔conflicto,
   chokepoint↔conflicto y causa→efecto) en formato legible.
4. **Accesibilidad y rendimiento PWA**: estados loading/error/empty; sin `localStorage`/`sessionStorage`/
   `indexedDB`/cookies; service worker y manifest intactos.
5. **Tests y validadores** para normalización, relaciones, filtros y fallback vacío.

## 2. Cambios

### Nuevo módulo PURO (raíz): `public-enriched.mjs`
Lógica sin DOM, testeable en Node y consumida por `app.js` (browser). No duplica lógica entre orígenes.

- `normalizeEnrichedDetail(detail)` → view-model estable. Tolera **3 formas de origen**:
  1. Detalle **rico** del contrato v1/DB (`actors {state,non_state}[{name,role,alignment,…}]`,
     `resources[{name,relevance_level,critical_mineral,…}]`, `chokepoints[{name,risk_level,energy_flow_relevance}]`,
     `causal_links[{link_type,title,explanation,strength}]`, `sources[{title,url,publisher}]`).
  2. Detalle **simple** (arrays de strings o `{name}`).
  3. **Foco local** de `data.js` (`actores {gobiernos,empresas,organismos,armados,sociedad}` → actores;
     recursos/chokepoints/causal quedan **vacíos**, sin inventar datos).
  - Expone flags `has.*` para que el renderer muestre/oculte secciones sin recalcular.
- `hasAnyEnrichment(vm)` → ¿hay alguna relación enriquecida?
- `toRelationRows(vm, conflictName)` → filas legibles por tipo (actor / recurso / chokepoint / causa→efecto).
- `deriveFilterFacets(focos)` → facetas disponibles; **una dimensión sin valores se omite** (se oculta).
- `applyAdvancedFilters(focos, selected)` → filtrado **no destructivo**; `all`/vacío se ignora;
  **dimensión desconocida nunca rompe ni descarta** focos.
- `focoFacetValues(foco)` → extracción tolerante de facetas por foco.
- `loadEnrichedDetail(idOrSlug, { localFoco, config })` → carga con fallback
  **API `/api/v1/conflicts/:id` → JSON estático enriquecido → foco local**. Devuelve siempre
  `{ detail, source, error }` (`source` ∈ `api|static|local`). Reutiliza banderas `window.GEOP_*`.

### `app.js` (aditivo, no invasivo)
- Import del nuevo módulo.
- `EnrichedDetail` (React): ficha enriquecida con estados **loading/error/empty**, indicador de `origen`,
  metadatos (estado, país, severidad, coordenadas), 4 grupos de relaciones y lista de fuentes.
  Hidrata desde `loadEnrichedDetail` (con `USE_API=false` resuelve local de inmediato, sin red).
- `MapFilters` + `MapExplorer` (React): filtros avanzados del mapa (región, tipo, severidad, estado,
  recurso, actor, chokepoint), contador `n/total`, botón *Limpiar* y estado vacío. Sólo aparecen las
  dimensiones con datos. `WorldMap` recibe la lista **ya filtrada** (no se modifica su API).
- Montaje: `EnrichedDetail` en dashboard y en el mapa; el mapa usa `MapExplorer`.

### `service-worker.js`
- `CACHE_NAME` `v1.17.0 → v1.18.0` y `public-enriched.mjs` añadido al App Shell.

### Tests: `api-server/test/sprint10-public-enriched.test.mjs`
17 casos: normalización (vacío/rico/simple/local), relaciones legibles, facetas
(omisión de dimensiones sin datos), filtros (mínimos, `all`, desconocidos, por recurso) y
carga con fallback (local, fallo de red, respuesta API `{data}`).

## 3. Guía de uso

- **GitHub Pages / local sin backend (por defecto)**: `GEOP_USE_API=false`. La ficha enriquecida
  muestra lo derivable del foco local (actores por grupos, metadatos) y **oculta** recursos/chokepoints/
  causal si no existen. Los filtros del mapa muestran región/tipo/severidad/estado.
- **Con API/JSON enriquecido**: definir en `index.html` antes de `app.js`:
  ```html
  <script>
    window.GEOP_USE_API = true;
    window.GEOP_API_BASE = 'https://tu-backend';           // o '' para mismo origen
    window.GEOP_CONFLICT_DETAIL_PATH = '/api/v1/conflicts/:id';   // opcional
    window.GEOP_CONFLICT_DETAIL_STATIC = './api/v1/conflicts/:id.json'; // opcional (Pages)
  </script>
  ```
  Con relaciones reales, la ficha añade recursos energéticos, chokepoints, causa→efecto y fuentes;
  el mapa habilita automáticamente los filtros recurso/actor/chokepoint.

## 4. Compatibilidad API / JSON / local

| Origen | Ficha enriquecida | Filtros mapa | Notas |
|---|---|---|---|
| API v1 (`/conflicts/:id` con relaciones) | Completa | Todos | `source=api`; degrada a estático/local ante error |
| JSON estático enriquecido | Completa | Todos | `source=static` |
| Fallback local `data.js`/FOCOS | Metadatos + actores | región/tipo/severidad/estado | `source=local`; recursos/chokepoints/causal ocultos |

Los 10 focos locales y el `api/v1/conflicts.json` actual siguen funcionando sin cambios.

## 5. Criterios de aceptación

- [x] Ficha pública con título/región/país/severidad/resumen/estado/coordenadas/sources/actores/
      recursos/chokepoints/causal_links.
- [x] Funciona con API real, JSON estático enriquecido y fallback a arrays vacíos/local.
- [x] Filtros avanzados no destructivos; dimensión ausente se oculta/degrada sin romper.
- [x] Compatibilidad con los 10 focos locales y el JSON actual.
- [x] Relaciones actor/recurso/chokepoint/causa→efecto legibles vía normalizador puro.
- [x] Estados loading/error/empty; móvil usable; sin storage/cookies; SW/manifest intactos.
- [x] Tests nuevos (17) + suite existente (160) + validadores raíz en verde.

## 6. Pruebas ejecutadas

```
api-server$ npm test                 → 160/160 OK (incluye sprint10: 17/17)
$ node scripts/validate-adapter.mjs           → OK (0 fallos)
$ node scripts/validate-conflicts-json.mjs    → OK (0 fallos)
$ node --check app.js                         → OK
$ node --check public-enriched.mjs            → OK
```

## 7. Riesgos

- **MIME de `.mjs` en hosting**: GitHub Pages sirve `.mjs` como JavaScript (ya usado por `admin/*.mjs`).
  En otros hostings, verificar el `Content-Type`.
- **Cardinalidad de facetas**: con datasets muy grandes, `actor` podría generar muchos valores. Mitigado:
  la faceta `actor` sólo se deriva de la forma enriquecida v1 (no de los grupos locales), evitando listas
  gigantes con los focos locales.
- **Latencia de API**: la ficha muestra el respaldo local de inmediato y `loadEnrichedDetail` hidrata en
  segundo plano con timeout; ante fallo, permanece el local (`error` informado en UI).

## 8. Rollback

- Reversible y aditivo. Para desactivar sin revertir código: mantener `GEOP_USE_API=false`
  (comportamiento local) — la ficha enriquecida y los filtros siguen operando sólo con datos locales.
- Rollback total: revertir el commit de la rama; `data.js`/FOCOS y `api-adapter.js` no fueron modificados.

## 9. Recomendaciones para Sprint 11

- Exponer detalle enriquecido **estático por conflicto** (`api/v1/conflicts/<slug>.json`) desde el
  exportador DB→vistas, para habilitar la ficha completa en GitHub Pages sin backend.
- Enriquecer `api/v1/conflicts/active/map.json` con `resource/actor/chokepoint` para activar filtros
  avanzados también en modo estático.
- Sincronizar el estado de filtros con la URL (query params) para enlaces compartibles, respetando la
  restricción de no usar almacenamiento local.
- Deep-link a la ficha de un conflicto (`?foco=<slug>`).
