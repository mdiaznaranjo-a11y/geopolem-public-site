# Flujo recomendado de sesión

> Guía de proceso para el instructor. Material de formación: sin producción,
> sin datos personales. Todas las evaluaciones son anónimas y sintéticas.

## Antes de la sesión

1. **Seleccionar caso** del banco (`docs/education/case-bank/case-bank.index.json`)
   coherente con la dimensión a evaluar.
2. **Elegir rúbrica** de `rubrics.index.json` (una dimensión por rúbrica).
3. **Revisar el backlog causal** (`docs/education/causal-backlog/backlog.md`) para
   conocer advertencias y campos `pending` del caso.
4. **Preparar plantilla de feedback** (`docs/education/feedback-templates/`).
5. Confirmar que el material NO exige credenciales ni servicios externos.

## Durante la sesión

1. El alumnado produce una evaluación **anónima** por criterio de la rúbrica.
2. Se recogen respuestas sin identificadores personales (usar códigos sintéticos).
3. Puntuación individual opcional en vivo:
   `node scripts/score-rubric.mjs --rubric=<ruta> --evaluation=<ruta> --json`.

## Después de la sesión

1. **Puntuación por lotes** de todas las evaluaciones anónimas:
   `node scripts/score-rubric-batch.mjs --dir=<carpeta> --json`.
2. Revisar el informe agregado (bandas, medias por rúbrica y criterio).
3. Aplicar el [checklist](checklist-instructor.md) a cada evaluación.
4. Decidir **aceptar / rechazar / diferir** según
   [criterios-aceptacion.md](criterios-aceptacion.md).
5. Generar feedback docente con
   `node scripts/render-feedback.mjs --rubric=<ruta> --evaluation=<ruta>`.
6. Registrar observaciones causales pendientes en el backlog (sin inventar datos).

## Regla de oro

Si una evaluación contiene cualquier dato personal, **se rechaza y se descarta**;
el motor de puntuación ya la bloquea, pero la responsabilidad última es humana.
