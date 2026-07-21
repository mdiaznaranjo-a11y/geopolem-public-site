# Sprint 11 — Detalle estático por conflicto, deep-links por URL y mapa offline enriquecido

> Rama: `sprint-11-static-detail-deeplinks-offline-map` (basada en
> `sprint-10-public-enriched-detail-map-filters`).
> Arquitectura preservada: **API real v1 → JSON estático `/api/v1/*.json` → fallback local `data.js`/`FOCOS`**.
> No se rompe PWA, GitHub Pages ni los fallbacks. No se introducen secretos reales.

---

## 1. Alcance

Sprint 11 lleva el detalle enriquecido y los filtros del mapa (Sprints 7–10) al
plano **estático/offline y compartible**:

1. **Detalle estático por conflicto** — el exportador produce
   `api/v1/conflicts/{id}.json` con el mismo contrato de ficha que la API real.
2. **`map.enriched.json`** — mapa superconjunto del base para filtros
   (recursos, actores, chokepoints y metadatos), compatible hacia atrás.
3. **Deep-links por URL** — abrir foco/conflicto y preservar filtros del mapa en
   el hash, sin `localStorage`/`sessionStorage`/cookies, válido en GitHub Pages.
4. **Compatibilidad offline/PWA** — el service worker cachea los nuevos JSON
   estáticos y la app degrada a fallback local si no están disponibles.
5. **Validación de navegación pública** — tests de deep-links, detalle estático y
   compatibilidad del mapa enriquecido + un verificador sin navegador.

---

## 2. Cambios

### Archivos nuevos
| Archivo | Propósito |
|---|---|
| `deeplinks.mjs` | Módulo PURO de deep-links por URL (parse/serialize + helpers de navegador aislados). Sin almacenamiento. |
| `api-server/scripts/verify-static-routes.mjs` | Verificación **sin navegador** de rutas/archivos estáticos y deep-links (`#foco={id}` → archivo). |
| `api-server/test/sprint11-deeplinks.test.mjs` | Tests de parse/serialize/round-trip, tolerancia a basura y "sin almacenamiento". |
| `api-server/test/sprint11-static-detail.test.mjs` | Tests del builder/validador de ficha y carga estática con fallback local. |
| `api-server/test/sprint11-enriched-map-compat.test.mjs` | Tests de superconjunto del mapa enriquecido vs. base. |
| `api/v1/conflicts/{id}.json` (×10) | Detalle estático por conflicto (derivado del puente sin DB). |
| `api/v1/conflicts/active/map.enriched.json` | Mapa enriquecido (superconjunto del base). |

### Archivos modificados
| Archivo | Cambio |
|---|---|
| `api-server/scripts/export-static-bridge.mjs` | `buildConflictDetail`/`validateDetail`; modos `--from-static` y `--with-details`; `--check` valida detalle+mapa enriquecido. |
| `public-enriched.mjs` | `loadEnrichedDetail` consume el detalle **estático aunque `GEOP_USE_API=false`**; no degrada el foco local si el estático viene sin relaciones. |
| `app.js` | Deep-links no destructivos: estado inicial desde la URL, sincronización `view/foco/filtros → hash`, `hashchange` (back/forward); `MapExplorer` con filtros controlados. |
| `index.html` | `window.GEOP_CONFLICT_DETAIL_STATIC = "./api/v1/conflicts/:id.json"`. |
| `service-worker.js` | `v1.19.0`; caché *network-first* de `/api/v1/*.json`; `deeplinks.mjs` en el app-shell. |
| `api-server/package.json` | Scripts `export:static:details`, `export:static:from-static`, `verify:static-routes`. |
| `.github/workflows/ci.yml` | Paso `verify:static-routes` (sin DB). |
| `.github/workflows/static-bridge-refresh.yml` | Regeneración DB usa `export:static:details` + verificación de rutas. |

---

## 3. Guía de uso

### Regenerar detalle + mapa enriquecido **sin DB** (desde el propio puente)
```bash
cd api-server
npm run export:static:from-static     # escribe map.enriched.json y {id}.json
npm run export:static:from-static -- --dry-run   # sólo valida, no escribe
```

### Regenerar **desde PostgreSQL** (con relaciones reales)
```bash
cd api-server
DATABASE_URL=postgres://… npm run export:static:details   # base + enriquecido + detalle
```

### Validar en disco y verificar rutas (CI, sin navegador)
```bash
cd api-server
npm run export:static:check      # valida lista + mapa + enriquecido + detalles
npm run verify:static-routes     # comprueba deep-links #foco={id} → archivo
```

### Deep-links (navegador / PWA)
```
#foco=ukr-rus
#view=map&foco=isr-gaza-irn&region=MENA&severity=4
#view=map&resource=Petróleo&chokepoint=Ormuz
```
Los valores por defecto (`view=dashboard`, `foco=ukr-rus`) se **omiten** para no
ensuciar la URL. Back/forward del navegador restauran vista, foco y filtros.

---

## 4. Contratos JSON

### `api/v1/conflicts/{id}.json` (detalle, espeja la API real)
```jsonc
{
  "data": {
    "id": "ukr-rus", "slug": "ukr-rus", "name": "Ucrania – Rusia", "summary": "…",
    "conflict_type": { "slug": "…", "label": "…" },
    "primary_region": { "slug": "…", "label": "…" },
    "status": "active",
    "metrics": { "intensity_level": 5, "escalation_risk": null, "humanitarian_impact": null },
    "dimensions": { "energy": false, "territorial": null, "external_involvement": null },
    "location": { "latitude": 49, "longitude": 32 },
    "actors": { "state": [], "non_state": [] },
    "resources": [], "chokepoints": [], "causal_links": [], "sources": [],
    "updated_at": null
  },
  "meta": { "api_version": "v1", "generated_at": "…", "source": "static-bridge (derived, Sprint 11)" }
}
```
Sin DB, las relaciones son arrays **vacíos pero presentes** (no se inventan
datos). Con DB, `--with-details` los rellena vía `getConflictRelations`.

### `api/v1/conflicts/active/map.enriched.json` (superconjunto del base)
Mismas features y propiedades base que `map.json` **más**: `conflict_type`,
`territorial_dimension`, `external_involvement`, `humanitarian_impact`,
`updated_at` y `meta.enriched=true`. Un cliente que sólo lea el shape base
sigue funcionando idéntico.

---

## 5. Compatibilidad offline / PWA

- **Service worker `v1.19.0`**: `/api/v1/*.json` pasa a *network-first con
  respaldo a caché* (antes: sólo-red). Online sirve fresco y guarda copia;
  offline sirve la última versión cacheada. El resto de `/api/` sigue sólo-red.
- **Degradación**: si un `{id}.json` no existe (404/ENOENT), `loadEnrichedDetail`
  cae al **foco local** de `data.js` sin romper la ficha.
- **No regresión**: si el detalle estático llega **sin relaciones** pero el foco
  local sí las trae, se prefiere el local (no se pierden actores de `data.js`).
- **Deep-links sin almacenamiento**: sólo se usa el hash de la URL (compartible
  y offline), nunca `localStorage`/`sessionStorage`/cookies.

---

## 6. Criterios de aceptación

- [x] Exportador produce `api/v1/conflicts/{id}.json` válido (dry/check con y sin DB).
- [x] `map.enriched.json` es superconjunto verificado de `map.json`.
- [x] Deep-links parse/serialize con round-trip estable y tolerantes a basura.
- [x] La app abre foco/conflicto y conserva filtros por URL (no destructivo).
- [x] SW cachea los nuevos JSON sin romper versiones anteriores.
- [x] Fallback local intacto; `data.js`/`FOCOS` sin tocar.
- [x] Suite completa verde: **185/185 tests**; `verify:static-routes` OK (10 deep-links).

---

## 7. Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `node --test test/` (api-server) | **185/185 pass**, 0 fail |
| `npm run export:static:check` | OK: lista + mapa + enriquecido + 10 detalles |
| `npm run export:static:from-static` | OK: 10 features + 10 detalles escritos |
| `npm run verify:static-routes` | OK: 10 activos, 10 detalles, 10 deep-links resueltos |
| `node --check` (app.js, deeplinks.mjs, public-enriched.mjs, service-worker.js) | OK |
| Smoke `loadEnrichedDetail` (API off) | detalle estático consumido; ausente → fallback local |

**Limitaciones**: sin PostgreSQL en el entorno, el detalle estático se derivó de
`conflicts.json` (relaciones vacías). La ruta DB (`--with-details`) está
implementada y cubierta por tests con fixtures/mocks, pero su ejecución real
requiere `DATABASE_URL` (job `api-server-postgis` de CI / workflow programado).
La UI no se validó en navegador en este entorno headless; el wiring es aditivo y
está cubierto por `node --check` + tests puros.

---

## 8. Riesgos y rollback

**Riesgos**
- SW *network-first* para `/api/v1/*.json`: primer acceso offline sin caché
  previa devuelve el fallback local (comportamiento esperado, no error).
- Deep-links con `view` desconocida: se ignora y se usa la vista por defecto.

**Rollback**
- Revertir el commit del Sprint 11: la app vuelve al comportamiento del Sprint 10
  (los nuevos JSON quedan huérfanos e inertes; nadie los referencia).
- O parcial: restaurar `service-worker.js` (SW cae a la versión previa por el
  cambio de `CACHE_NAME`) y/o quitar `window.GEOP_CONFLICT_DETAIL_STATIC` en
  `index.html` (el detalle vuelve a resolverse sólo con el foco local).

---

## 9. Recomendaciones para Sprint 12

1. **Detalle con relaciones reales**: ejecutar el workflow programado contra la
   DB de staging para materializar `{id}.json` con actores/recursos/chokepoints.
2. **Prefetch selectivo**: precachear en el SW sólo los detalles de focos activos
   visibles para acelerar la primera navegación offline.
3. **Deep-links de detalle profundo**: extender el hash a sub-secciones de la
   ficha (p. ej. `#foco=…&section=causal`) y a rangos temporales.
4. **Sitemap/OG estático** por conflicto para compartir enlaces con vista previa.
5. **i18n en la URL** (`lang=EN`) preservando el resto del deep-link.
