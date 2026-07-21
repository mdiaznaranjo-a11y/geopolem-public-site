# Sprint 8 — Admin/CMS UI, flujo editorial y E2E técnico

Rama: `sprint-8-admin-ui-editorial-flow-e2e` (basada en `sprint-7-cms-admin-jwt-alerts-relations`).

## 1. Objetivo

Materializar una **interfaz Admin/CMS mínima** y validar el **flujo editorial
controlado** de extremo a extremo: desde el formulario de conflicto hasta la API
admin del Sprint 7, la exportación estática y el mapa/PWA — manteniendo todo
**reversible, seguro y compatible** con lo ya construido.

Regla de oro preservada: `API real v1 → JSON estático /api/v1/*.json → fallback
local data.js/FOCOS`. Nada de esto se toca. La lectura pública y la PWA siguen
funcionando exactamente igual.

## 2. Alcance y cambios realizados

### 2.1 Interfaz Admin/CMS mínima (bloque 1)
- **`admin/index.html`** — pantalla admin **separada** de la experiencia
  pública (no se enlaza desde `index.html`, no está en el `manifest` ni en el
  app-shell del `service-worker.js`, lleva `robots: noindex,nofollow`).
  Captura los campos alineados con la taxonomía/DB: título, slug, región, país,
  tipo de conflicto, estado editorial, severidad/intensidad, riesgo, impacto,
  dimensiones (energética/territorial/externa), coordenadas, resumen y las
  relaciones enriquecidas (actores, recursos, chokepoints, causal_links, sources).
- **`admin/admin-ui.js`** — glue de navegador (sólo UI). Recoge el formulario,
  valida en cliente, llama al cliente admin y renderiza resultado + errores +
  vista enriquecida. **Gate**: la UI avisa que está desactivada salvo
  `window.GEOP_ADMIN_ENABLED=true` o token presente; el **modo DEMO** siempre
  está disponible para validar el contrato sin credenciales.

### 2.2 Cliente admin/API (bloque 2)
- **`admin/admin-client.mjs`** — cliente **isomórfico** (navegador + Node) de los
  endpoints admin del Sprint 7. Token en memoria (campo manual o
  `window.GEOP_ADMIN_TOKEN`); **sin** localStorage/sessionStorage/indexedDB/
  cookies. `fetch` inyectable para tests. Manejo **explícito** de errores con
  `AdminApiError` tipado: `auth` (401), `forbidden` (403), `validation` (422 con
  `details`), `rate_limit` (429 con `Retry-After`), `server` (5xx), `network`.
  **Modo DEMO/prepared** si falta baseUrl o token: valida y previsualiza sin red,
  espejando el modo `prepared` del servidor (no inventa persistencia).

### 2.3 Flujo editorial y validación (bloque 3)
- **`admin/editorial-validation.mjs`** — validadores **puros** e isomórficos,
  superconjunto no destructivo del contrato de escritura del servidor
  (`api-server/src/validation.mjs`): campos obligatorios, slug kebab-case,
  coordenadas en rango, métricas 1–5, `sources` con `title` + URL http(s),
  `causal_links` consistentes (sin auto-lazo, relación del vocabulario, sin
  duplicados), actores/recursos/chokepoints normalizados.
  Estados editoriales reutilizados de Sprint 7: **draft → review → published →
  archived**. `toServerWritePayload()` extrae sólo el subconjunto que el servidor
  reconoce (los metadatos editoriales quedan en el cliente).
- Un **test de contrato** verifica que `CMS_STATUSES` y `STATUS_TRANSITIONS` no
  divergen de la fuente del servidor (previene drift).

### 2.4 E2E técnico del flujo de datos (bloque 4)
- **`api-server/scripts/e2e-editorial-flow.mjs`** (npm `e2e:editorial`) — valida
  el circuito sin navegador ni DB: payload editorial válido → API admin
  (prepared) → vista enriquecida → export static check → JSON compatible con
  PWA/mapa. Sale 0/1.
- **`api-server/test/sprint8-e2e-flow.test.mjs`** — el mismo circuito como test
  de integración dentro de `npm test`.

### 2.5 Preparación de frontend para detalle enriquecido (bloque 5)
- **`admin/enriched-detail-view.mjs`** — normalizador **puro** que convierte el
  detalle del contrato v1 (o el eco prepared) en un view-model estable para
  actores/recursos/chokepoints/causal_links/sources, tolerante a ausencias y sin
  inventar datos. **Aditivo y reversible**: no edita `app.js`; un renderer futuro
  (público o admin) lo consume vía `toEnrichedViewModel()` / `hasAnyEnrichment()`.

## 3. Archivos

Nuevos:
- `admin/index.html`
- `admin/admin-ui.js`
- `admin/admin-client.mjs`
- `admin/editorial-validation.mjs`
- `admin/enriched-detail-view.mjs`
- `api-server/scripts/e2e-editorial-flow.mjs`
- `api-server/test/sprint8-editorial-validation.test.mjs`
- `api-server/test/sprint8-admin-client.test.mjs`
- `api-server/test/sprint8-enriched-view.test.mjs`
- `api-server/test/sprint8-e2e-flow.test.mjs`
- `SPRINT_8_ADMIN_UI_EDITORIAL_FLOW_E2E.md`

Modificados:
- `api-server/package.json` — añade el script `e2e:editorial`.

No se tocó: `data.js`, `FOCOS`, `api-adapter.js`, `service-worker.js`,
`manifest.webmanifest`, `index.html`, `api/v1/*.json`, ni la capa de lectura del
servidor.

## 4. Variables de entorno / configuración

Frontend admin (inyectables antes de cargar el módulo, p. ej. desde el HTML de
staging o el proxy):

| Variable | Efecto | Defecto |
|---|---|---|
| `window.GEOP_API_BASE` | Base de la API admin | `""` (modo DEMO) |
| `window.GEOP_ADMIN_ENABLED` | Habilita la UI en el entorno | `false` |
| `window.GEOP_ADMIN_TOKEN` | JWT de staging inyectado (opcional) | `""` |

Backend (Sprint 7, sin cambios; recordatorio operativo):

| Variable | Efecto |
|---|---|
| `JWT_SECRET` | Secreto HS256 (obligatorio para rutas admin) |
| `GEOP_SCOPE_ADMIN` / `GEOP_SCOPE_CMS` | Scopes exigidos (`admin` / `cms:write`) |
| `GEOP_ADMIN_WRITES` | `true` + DB alcanzable ⇒ persistencia real; si no, `prepared` |

## 5. Guía de uso admin en staging

1. Servir el sitio estático (incluye `admin/`) y arrancar la API Sprint 7 con
   `JWT_SECRET` y, si se quiere persistir, `GEOP_ADMIN_WRITES=true` + `DATABASE_URL`.
2. Emitir un token con scope admin: `npm run issue:jwt` (en `api-server/`).
3. Abrir `/admin/`. Definir `window.GEOP_ADMIN_ENABLED=true` (o inyectar
   `GEOP_ADMIN_TOKEN`). Rellenar API base y pegar el JWT en el campo manual (sólo
   memoria).
4. **Validar** para comprobar el contrato; **Crear conflicto** para enviar.
   - Sin API base/token ⇒ **DEMO** (valida y previsualiza, no persiste).
   - Con API + token + servidor en `prepared` ⇒ 200 `persisted=false`.
   - Con `GEOP_ADMIN_WRITES=true` + DB ⇒ 201/200 `persisted=true`.

## 6. Pruebas ejecutadas

```
cd api-server && npm test        → 121/121 OK (93 previos + 28 nuevos)
npm run e2e:editorial            → OK (circuito completo)
npm run export:static:check      → OK (puente estático intacto)
```

## 7. Criterios de aceptación

- [x] UI admin mínima, separada de lo público, desactivada por defecto sin JWT.
- [x] Cliente admin con manejo explícito de auth/scope/validación/rate limit.
- [x] Sin localStorage/sessionStorage/indexedDB/cookies (token sólo en memoria).
- [x] Validación editorial: obligatorios, coordenadas, sources URL/título,
      causal consistente; estados draft/review/published/archived.
- [x] E2E: payload → admin(prepared) → enriched → export check → PWA-compatible.
- [x] Preparación no destructiva del detalle enriquecido (sin tocar `app.js`).
- [x] `data.js`/FOCOS/fallbacks y PWA intactos. Sin secretos reales.
- [x] Suite completa + E2E en verde.

## 8. Riesgos y mitigaciones

- **Deriva de contrato** entre validador editorial y servidor → test de contrato
  que compara `CMS_STATUSES`/`STATUS_TRANSITIONS`.
- **Runtime-cache del SW** podría cachear `/admin/` si se navega; no hay secretos
  en el HTML y no está en el app-shell. Mitigable con una regla `bypass /admin/`
  en Sprint 9 si se desea.
- **Token en campo manual**: por diseño en memoria; recordar no compartir pantalla.
- **Persistencia real** desactivada por defecto (`GEOP_ADMIN_WRITES=false`):
  producción protegida.

## 9. Rollback

Cambios puramente aditivos. Para revertir: eliminar el directorio `admin/`, los
tests `sprint8-*.test.mjs`, `api-server/scripts/e2e-editorial-flow.mjs`, el script
`e2e:editorial` de `package.json` y este documento. Ningún archivo existente
cambia de comportamiento.

## 10. Recomendaciones para Sprint 9

- Persistir en DB los campos editoriales enriquecidos (actors/resources/
  chokepoints/causal_links/sources) y exponerlos en el detalle real.
- Regla en el service worker para excluir `/admin/` del runtime-cache.
- Listado/edición admin (GET admin de conflictos) y borrado con confirmación.
- Renderer público del bloque "Detalle enriquecido" consumiendo
  `toEnrichedViewModel()` cuando la DB lo pueble.
- Pruebas E2E con navegador real (Playwright) contra staging.
