# SENTINEL — Feed de eventos de conflicto (GDELT)

Este directorio contiene el feed estático que alimenta el panel **SENTINEL** de
GEOPÓLEM con datos de conflicto global frescos, sin intervención manual.

## Archivos

| Archivo                 | Descripción                                                      |
| ----------------------- | ---------------------------------------------------------------- |
| `conflict-events.json`  | Eventos de conflicto puntuados y filtrados. Lo regenera el CI.   |

La regeneración la hace `scripts/sentinel_gdelt.py`, disparado a diario por el
workflow `.github/workflows/sentinel-gdelt.yml` (06:17 UTC) y también a demanda
con **workflow_dispatch**. El job solo hace commit si el contenido cambió.

## Cómo lo consume el frontend SENTINEL

El sitio es estático (GitHub Pages). SENTINEL debe hacer `fetch` del JSON con
ruta relativa a la raíz publicada — **no** usar `window.GEOP_API_BASE` (ese es
para la API privada del editor, no para este feed):

```js
async function loadSentinelFeed() {
  const res = await fetch('./data/sentinel/conflict-events.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`SENTINEL feed ${res.status}`);
  const feed = await res.json();
  // feed.generated_at, feed.total_events, feed.tier_counts, feed.events[...]
  return feed;
}
```

Sugerencias de render en el panel:

- Ordena por `tier` (`high` → `medium` → `monitor`) y dentro por `score`.
- Colorea por `tier` reutilizando la paleta: `high` → `alert`, `medium` →
  `risk`, `monitor` → `radar`.
- Mapea `region` (ya alineada con `REGIONS` de `data.js`) para situar puntos en
  el mapa o agrupar por zona.
- Muestra `generated_at` como sello de frescura y `score_breakdown` como
  justificación auditable (anti-amarillista: el porqué del ranking es visible).

## Esquema del JSON

```jsonc
{
  "generated_at": "2026-06-17T06:17:00Z", // ISO-8601 UTC
  "source": "GDELT 2.0 DOC API",
  "query_window": "last 24h",
  "total_events": 42,
  "tier_counts": { "high": 7, "medium": 18, "monitor": 17 },
  "filters": {
    "version": "1.0.0",                   // sube al cambiar metodología/esquema
    "tiers": { "high": 6.0, "medium": 3.5, "monitor": 1.5 },
    "tone_negative_threshold": -5.0,
    "query": "(conflict OR war OR ...)",
    "max_records": 250
  },
  "events": [
    {
      "id": "evt_<sha1>",                 // estable → de-duplicación entre runs
      "title": "...",
      "url": "https://...",
      "domain": "example.org",
      "source_country": "Ukraine",
      "language": "English",
      "seen_date": "20260617T060000Z",
      "region": "Europa del Este",        // taxonomía GEOPÓLEM (REGIONS)
      "tone": -7.2,                        // V2Tone de GDELT (negativo = malo)
      "score": 9.5,
      "tier": "high",                      // high | medium | monitor
      "matched_themes": ["shelling", "offensive"],
      "matched_regions": ["ukraine"],
      "score_breakdown": { "themes": 6.0, "region": 2.0, "tone": 1.5 },
      "actors": ["Ukraine"]
    }
  ]
}
```

## Cómo afinar la relevancia

Todo se controla en las constantes de **CONFIGURACIÓN** al inicio de
`scripts/sentinel_gdelt.py`:

- `CONFLICT_THEMES` — palabras de conflicto/violencia/seguridad y su peso.
- `REGION_KEYWORDS` — países/regiones → etiqueta GEOPÓLEM + peso.
- `TONE_NEGATIVE_THRESHOLD` / `TONE_NEGATIVE_BONUS` — premio por tono negativo.
- `TIER_HIGH` / `TIER_MEDIUM` / `TIER_MONITOR` — umbrales de los tiers. Súbelos
  para un SENTINEL más estricto; bájalos para capturar más señal débil.
- `GDELT_QUERY` — la consulta enviada a GDELT.
- `MAX_RECORDS` (tope 250) y `MAX_EVENTS_OUT` — volumen de entrada/salida.

Al cambiar pesos, umbrales o el esquema, **incrementa `FILTERS_VERSION`** para
que el frontend pueda invalidar caché y registrar el cambio de metodología.

## Verificación local

```bash
# Sin red: genera una muestra sintética (útil en CI sin acceso externo).
python3 scripts/sentinel_gdelt.py --dry-run

# Con red real (24h por defecto):
python3 scripts/sentinel_gdelt.py --window-hours 24
```

Sin eventos relevantes el script **no** falla (exit 0); un fallo real de
red/API/runtime sí devuelve exit != 0 y rompe el build a propósito.
