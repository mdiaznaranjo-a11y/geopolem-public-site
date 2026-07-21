# Formato: Laboratorio de mapa interactivo

> Material de formación. No sustituye la revisión editorial final ni activa
> producción.

- **Duración:** 2–3 h.
- **Público:** estudiantes, analistas OSINT.
- **Plantilla base:** `plantillas/actividad-mapa.template.md`.

## Objetivo

Aprender a leer el mapa GEOPÓLEM como instrumento analítico: localizar focos,
filtrar por región y tipo, y relacionar chokepoints con flujos energéticos.

## Datos y herramientas

- Mapa estático: `api/v1/conflicts/active/map.json` (FeatureCollection).
- Mapa enriquecido: `api/v1/conflicts/active/map.enriched.json`.
- App/PWA local (`index.html`, `worldmap.js`) en modo **fallback**, sin DB ni
  red. No se activa producción.

## Competencias trabajadas

C1, C5, C6.

## Secuencia

1. **Cargar** el mapa en modo local/fallback.
2. **Localizar** los focos por `location.latitude/longitude`.
3. **Filtrar** por `primary_region` y `conflict_type`.
4. **Identificar** chokepoints con `energy_flow_relevance = true`.
5. **Contrastar** intensidad (`metrics.intensity_level`) entre regiones.
6. **Documentar** hallazgos en la plantilla de actividad de mapa.

## Entregable

Actividad de mapa cumplimentada + captura o descripción de al menos un patrón
regional y un patrón energético observados, con referencia a los IDs de foco.

## Evaluación

Rúbrica rápida incluida en `plantillas/actividad-mapa.template.md` (lectura del
dato, corrección taxonómica, calidad de la interpretación).
