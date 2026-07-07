# Syllabus — Curso corto: Análisis geopolítico de focos energéticos

> Material de **formación**. No sustituye la revisión editorial final ni activa producción.

## Datos del curso

- **Audiencia:** estudiantes de grado / formación continua.
- **Duración:** 4 sesiones de 2 h.
- **Modalidad:** presencial u online; laboratorio de mapa 100 % offline.
- **Prerrequisitos:** ninguno; se recomienda lectura básica de actualidad internacional.

## Resultados de aprendizaje

Al finalizar, el participante será capaz de:

1. Identificar actores, recursos y chokepoints de un foco geopolítico a partir de fuentes verificadas.
2. Construir y justificar una **matriz causal** (nodos y `link_type`) sobre evidencia real.
3. Valorar la calidad de las fuentes y distinguir dato verificado de dato pendiente.
4. Comunicar un análisis breve y trazable.

## Estructura por sesiones

| Sesión | Tema | Caso | Actividad | Rúbrica de evaluación |
|---|---|---|---|---|
| 1 | Marco de análisis y taxonomía | — | Lectura del modelo pedagógico | `rubrica-analisis-geopolitico` |
| 2 | Caso Ucrania–Rusia (energía) | `ukr-rus` | Completar matriz causal | `rubrica-causalidad` |
| 3 | Caso Mar Rojo / Bab el-Mandeb | `red-sea` | Laboratorio de mapa offline | `rubrica-analisis-geopolitico` |
| 4 | Validación de fuentes y cierre | ambos | Checklist de fuentes + síntesis | `rubrica-validacion-fuentes` |

## Casos incluidos

- **`ukr-rus`** — ficha: `docs/education/case-bank/fichas/ukr-rus.rc.md`; matriz: `docs/education/case-bank/matrices/ukr-rus.matrix.json`.
- **`red-sea`** — ficha: `docs/education/case-bank/fichas/red-sea.rc.md`; matriz: `docs/education/case-bank/matrices/red-sea.matrix.json`.

## Evaluación

Las rúbricas son máquina-legibles y se puntúan con el motor de Sprint 26:

```
node scripts/score-rubric.mjs --rubric=docs/education/rubrics/rubrica-causalidad.json --evaluation=<evaluacion.json>
```

La evaluación de entrada es **anónima**: no se registran datos personales ni notas reales.
