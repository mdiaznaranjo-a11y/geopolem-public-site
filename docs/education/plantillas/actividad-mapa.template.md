# Plantilla: Actividad de mapa interactivo

> Plantilla reutilizable. Se opera en modo local/fallback, sin DB ni red y sin
> activar producción.

## Objetivo

`<Qué debe descubrir el estudiante con el mapa: p. ej. relacionar chokepoints
con la dimensión energética.>`

## Datos de partida

- Mapa: `api/v1/conflicts/active/map.json` (o `.enriched.json`).
- Campos clave: `location`, `primary_region`, `conflict_type`,
  `metrics.intensity_level`, `chokepoints.energy_flow_relevance`.

## Consigna

`<Instrucción concreta para el estudiante.>`

## Pasos

1. Cargar el mapa en modo fallback (`index.html` / `worldmap.js`).
2. Filtrar por `<primary_region / conflict_type>`.
3. Localizar los focos por coordenadas.
4. Identificar chokepoints con `energy_flow_relevance = true`.
5. Comparar intensidades entre regiones.

## Entregable

`<Descripción del entregable: mapa anotado, tabla de hallazgos con IDs, etc.>`

## Rúbrica rápida

| Criterio | Insuficiente | Competente | Avanzado |
|---|---|---|---|
| Lectura del dato | No localiza focos | Localiza y filtra | Cruza dimensiones |
| Corrección taxonómica | Errores de clasificación | Clasifica bien | Justifica clasificación |
| Interpretación | Descriptiva | Identifica un patrón | Explica patrón con fuente |
