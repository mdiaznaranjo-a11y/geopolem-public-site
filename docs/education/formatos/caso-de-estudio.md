# Formato: Caso de estudio

> Material de formación. No sustituye la revisión editorial final ni activa
> producción.

- **Duración:** 1.5–3 h.
- **Público:** estudiantes, equipos de análisis.
- **Plantilla base:** `plantillas/caso-de-estudio.template.md`.

## Objetivo

Analizar un foco real del repositorio de principio a fin: contexto, actores,
recursos y chokepoints, cadena causal y fuentes, cerrando con preguntas de
análisis y una decisión razonada.

## Reglas del formato

- Se parte de un **ID de conflicto existente** en `data/conflicts.inventory.json`.
- Se usan datos del **RC/staging** o del contrato v1 verificado; **nunca**
  producción.
- **No se inventan hechos**: toda afirmación remite a una fuente ya verificada
  del proyecto (`sources[].verification = "verified"`).
- Todo caso incluye una **advertencia editorial** explícita.

## Estructura (según plantilla)

1. Identificación del conflicto (ID, taxonomía).
2. Contexto.
3. Actores (`actors.state` / `actors.non_state`).
4. Recursos y chokepoints.
5. Cadena causal (`causal_links`, tipo y explicación).
6. Fuentes (verificadas).
7. Preguntas de análisis.
8. Advertencia editorial.

## Casos ya disponibles

- [`casos/caso-red-sea-bab-el-mandeb.md`](../casos/caso-red-sea-bab-el-mandeb.md)
- [`casos/caso-ukr-rus-energia.md`](../casos/caso-ukr-rus-energia.md)

## Evaluación

Rúbrica de caso (ver `plantillas/rubrica-evaluacion.template.md`): trazabilidad,
corrección taxonómica, calidad causal y claridad de la comunicación.
