# Sprint 12 — Analítica de uso, KPIs y salud de contenidos

**Rama:** `sprint-12-analytics-kpis-content-health` (basada en `sprint-11-static-detail-deeplinks-offline-map`)
**PR:** #12 (analítica no invasiva + colector opcional + KPIs + reporte de salud de contenidos)

---

## 1. Alcance

Sprint técnico de **medición post-lanzamiento** sin comprometer privacidad ni la
arquitectura existente (API real → JSON estático → fallback local `data.js`/FOCOS).
Se añade:

1. **Analítica de eventos no invasiva** (cliente PURO `analytics.mjs`).
2. **Colector opcional** `POST /api/v1/analytics/events` (desactivado por defecto).
3. **KPIs de uso** (colector) y **KPIs editoriales / salud de contenidos**
   (`content-health.mjs` + `scripts/content-health-report.mjs`).
4. **Instrumentación frontend** segura (no-op offline / sin endpoint).
5. **Tests** de sanitización, no-op/offline, envío opcional, KPIs y salud.

Se mantiene compatibilidad total con Sprint 11: `data.js`/FOCOS, PWA, GitHub
Pages y todos los fallbacks quedan intactos. No se introducen secretos reales.

---

## 2. Contratos de eventos (analítica pública)

Vocabulario **cerrado** (`EVENT_TYPES` en `analytics.mjs`). Cualquier tipo fuera
de la lista se descarta:

| Evento               | Cuándo se emite                                             | Props típicas                         |
|----------------------|------------------------------------------------------------|---------------------------------------|
| `view_conflict`      | Se abre/visualiza la ficha de un conflicto                 | `conflict`                            |
| `select_filter`      | Se aplica un filtro del mapa                               | `dimension`, `value`                  |
| `clear_filter`       | Se limpia un filtro / se reinician todos                   | `dimension` \| `reason`               |
| `open_deeplink`      | La app se abre con un deep-link activo (hash con estado)    | `view`, `conflict`                    |
| `load_static_detail` | El detalle se sirvió desde el puente estático JSON         | `conflict`, `source=static`           |
| `fallback_local`     | Se degradó al respaldo local (`data.js`/FOCOS)            | `source=local`, `reason`              |
| `map_empty_state`    | Un conjunto de filtros deja el mapa sin resultados        | `count=0`                             |
| `api_error`          | Una llamada a la API falló (se recupera con fallback)     | `endpoint`, `conflict`                |

**Forma del evento** (tras sanitizar): `{ type, ts (ISO), props }`.

**Allow-list de `props`** (todo lo demás se descarta → anti-PII):
`conflict`, `view`, `dimension`, `value`, `source`, `count`, `code`, `endpoint`, `reason`.

Sanitización defensiva: sólo escalares; cadenas truncadas a 120 chars; objetos/
arrays anidados descartados; máximo 12 claves.

---

## 3. Variables de entorno (colector opcional, `api-server`)

| Variable                   | Defecto | Efecto                                                              |
|----------------------------|---------|--------------------------------------------------------------------|
| `GEOP_ANALYTICS_ENABLED`   | `false` | Habilita `POST /api/v1/analytics/events`. Off → el endpoint da 404. |
| `GEOP_ANALYTICS_MAX_EVENTS`| `5000`  | Tamaño del buffer circular en memoria (KPIs recientes; no persiste). |
| `GEOP_ANALYTICS_LOG`       | `false` | Emite 1 línea JSON por evento aceptado (agregable en Loki/CloudWatch).|

Front-end (opcional, vía `window`):

| Global                        | Defecto | Efecto                                             |
|-------------------------------|---------|----------------------------------------------------|
| `window.GEOP_ANALYTICS_ENDPOINT` | (vacío) | URL del colector. Vacío → cliente en modo NO-OP.  |
| `window.GEOP_ANALYTICS_ENABLED`  | `true`  | Interruptor maestro del cliente.                   |

**Rate limiting:** el endpoint queda bajo el rate limiting existente
(`GEOP_RATE_LIMIT_MAX` / `GEOP_RATE_LIMIT_WINDOW_MS`). `/health` y `/metrics`
siguen exentos. Límite de lote defensivo: 50 eventos por petición; cuerpo ≤ 1 MiB.

---

## 4. Privacidad (no invasiva por diseño)

- **Sin almacenamiento del navegador:** el cliente NO usa `localStorage`,
  `sessionStorage`, `indexedDB` ni cookies. No hay identificadores persistentes
  ni fingerprinting. (Verificado por test.)
- **Sin PII:** allow-list estricta de props + truncado de cadenas + descarte de
  estructuras anidadas. Re-sanitización en el servidor (defensa en profundidad).
- **Sin credenciales:** el transporte usa `sendBeacon`/`fetch keepalive` con
  `credentials: 'omit'`. Fire-and-forget: no bloquea la UI.
- **Off por defecto en el servidor:** sin `GEOP_ANALYTICS_ENABLED=true` no existe
  superficie de escritura (404). En memoria sólo se guardan **agregados**
  numéricos; los eventos individuales viven en un buffer circular acotado.
- **Degradación offline:** sin `navigator`/red o sin endpoint, el cliente es
  no-op limpio (compatibilidad PWA/offline).

---

## 5. KPIs

### 5.1 KPIs de uso (colector — `computeUsageKpis`)
- `conflict_views`, `conflicts_viewed_unique`
- `filters_used`, `filters_cleared`, `filter_dimensions` (por dimensión)
- `deeplinks_opened`
- `static_details_loaded`, `fallbacks_local`
- `map_empty_states`, `api_errors`
- `source_mix`: recuentos y **ratios API/estático/local** (señal de origen de datos).

Expuestos en `GET /api/v1/health` (`analytics`) y `GET /api/v1/metrics`
(`geopolem_analytics_*`) cuando el colector está activo.

### 5.2 KPIs editoriales / salud de contenidos (`computeContentHealth`)
- Conflictos publicados **totales** y por **región / tipo / severidad / estado**.
- **Contenidos sin `sources`** (riesgo editorial) — recuento, %, IDs.
- **Contenidos sin relaciones** (actores/recursos/chokepoints/causal_links) — recuento, %, IDs.
- **Integridad:** detalles ausentes/rotos respecto de la lista.

**Reporte:** `node scripts/content-health-report.mjs` (texto) / `--json` /
`--fail-on-gaps` (exit≠0 si hay contenidos sin fuentes, apto para CI).
Fuente por defecto: puente estático `api/v1/*.json`; alternativa API con
`GEOP_HEALTH_API_BASE`. Scripts npm: `content:health`, `content:health:json`.

> Estado actual del contenido (puente estático): 10 conflictos, **100% sin
> fuentes y sin relaciones enriquecidas** → objetivo prioritario de Sprint 13.

---

## 6. Archivos creados / modificados

**Creados**
- `analytics.mjs` — cliente PURO de analítica (sanitización, no-op, transporte).
- `content-health.mjs` — cálculo PURO de salud de contenidos / KPIs editoriales.
- `scripts/content-health-report.mjs` — CLI de reporte (estático o API).
- `api-server/src/analytics.mjs` — colector en memoria + `computeUsageKpis`.
- `api-server/test/sprint12-analytics-client.test.mjs`
- `api-server/test/sprint12-analytics-collector.test.mjs`
- `api-server/test/sprint12-content-health.test.mjs`
- `SPRINT_12_ANALYTICS_KPIS_CONTENT_HEALTH.md`

**Modificados**
- `app.js` — instrumentación no bloqueante (import + `trackEvent` en ficha, filtros, deep-links, watchlist).
- `service-worker.js` — `analytics.mjs` en el app-shell; cache `v1.20.0`.
- `api-server/src/config.mjs` — flags `analytics*`.
- `api-server/src/handlers.mjs` — `handleAnalyticsIngest` + bloque `analytics` en health/metrics.
- `api-server/src/router.mjs` — ruta `POST /api/v1/analytics/events`.
- `api-server/server.mjs` — etiqueta de endpoint `analytics_events`.
- `api-server/.env.example` — documentación de las nuevas variables.
- `api-server/package.json` — scripts `content:health*`.

---

## 7. Pruebas ejecutadas

- `npm test` (api-server): **214/214 OK** (185 previos + 29 nuevos). Sin regresiones.
- `node scripts/validate-conflicts-json.mjs`: **0 aserciones fallidas** (puente estático intacto).
- `node scripts/content-health-report.mjs [--json]`: ejecuta y reporta correctamente.
- Smoke manual del router: endpoint 404 por defecto; 202 al activar; 405 en GET;
  sanitización elimina claves no permitidas y trunca cadenas largas; health/metrics
  reflejan agregados.

**Limitaciones:** `app.js` importa React vía `esm.sh` (sin build step); no es
ejecutable en Node, por lo que la instrumentación se validó por revisión + syntax
check (`node --check`) y por tests del módulo puro subyacente. El envío real por
`sendBeacon` requiere navegador (no se prueba en Node; el cliente degrada a no-op).

---

## 8. Criterios de aceptación

- [x] Eventos con vocabulario cerrado y sanitización anti-PII.
- [x] Cliente NO-OP por defecto; envío sólo con endpoint configurado; offline-safe.
- [x] Sin `localStorage`/`sessionStorage`/`indexedDB`/cookies/fingerprint.
- [x] Colector opcional, off por defecto, rate-limited, sin persistencia de PII.
- [x] KPIs de uso y editoriales calculables; reporte de salud de contenidos.
- [x] Instrumentación frontend no bloqueante; no rompe navegación ni PWA.
- [x] `data.js`/FOCOS y fallbacks intactos; compatibilidad Sprint 11.
- [x] Tests nuevos + suite existente en verde.

---

## 9. Riesgos y rollback

**Riesgos**
- Activar el colector expone una superficie de escritura pública → mitigado por
  off-por-defecto, rate limiting, allow-list, límite de lote/cuerpo y agregación en memoria.
- Cardinalidad de métricas Prometheus por tipo de evento → acotada (vocabulario fijo).
- El buffer en memoria se pierde al reiniciar (por diseño; no es almacén analítico).

**Rollback**
- Servidor: `GEOP_ANALYTICS_ENABLED=false` (default) desactiva el endpoint sin desplegar.
- Frontend: sin `window.GEOP_ANALYTICS_ENDPOINT` el cliente es no-op; revertir el
  commit elimina la instrumentación sin afectar la app.
- Todo el sprint es aditivo: no altera contratos previos ni el puente estático.

---

## 10. Recomendaciones para Sprint 13

- **Persistencia analítica** (opt-in): contrato DB para `analytics_events`
  (tabla append-only, retención/anonimización), o export a un colector externo
  (OTel/Prometheus remote-write) manteniendo el off-por-defecto.
- **Cerrar las carencias de contenido** que revela el reporte: poblar `sources`
  y relaciones enriquecidas (100% vacías hoy) y añadir `content:health --fail-on-gaps` a CI.
- **Consentimiento/DNT**: respetar `navigator.doNotTrack` / Global Privacy Control
  en el cliente antes de cualquier envío, aunque siga siendo anónimo.
- **Dashboards**: panel operacional (Grafana) sobre `geopolem_analytics_*` y un
  informe editorial periódico (workflow programado) del reporte de salud.
