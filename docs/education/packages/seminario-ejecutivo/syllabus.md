# Syllabus — Seminario ejecutivo: Riesgo geoeconómico y decisión

> Material de **formación**. No sustituye la revisión editorial final ni activa producción.

## Datos del seminario

- **Audiencia:** directivos, analistas senior y responsables de riesgo.
- **Duración:** 1 jornada intensiva (6 h).
- **Modalidad:** presencial; laboratorio de mapa offline como apoyo.
- **Enfoque:** de la evidencia geopolítica a la decisión, con trazabilidad.

## Resultados de aprendizaje

1. Leer un foco geoeconómico en clave de riesgo y exposición.
2. Interpretar una matriz causal ya construida y cuestionar sus supuestos.
3. Traducir el análisis en una recomendación ejecutiva breve y defendible.
4. Exigir trazabilidad de fuentes en la toma de decisiones.

## Estructura (jornada única)

| Bloque | Tema | Caso | Actividad | Rúbrica |
|---|---|---|---|---|
| 1 (90') | Marco de riesgo geoeconómico | — | Discusión dirigida | `rubrica-politica-energetica` |
| 2 (90') | Stablecoins y soberanía monetaria | `stablecoins` | Lectura crítica de matriz | `rubrica-causalidad` |
| 3 (90') | Rearme global y cadenas críticas | `rearme-global` | Escenarios de decisión | `rubrica-politica-energetica` |
| 4 (90') | Comunicación ejecutiva | ambos | Nota de decisión (1 página) | `rubrica-comunicacion` |

## Casos incluidos

- **`stablecoins`** — ficha: `docs/education/case-bank/fichas/stablecoins.rc.md`; matriz: `docs/education/case-bank/matrices/stablecoins.matrix.json`.
- **`rearme-global`** — ficha: `docs/education/case-bank/fichas/rearme-global.rc.md`; matriz: `docs/education/case-bank/matrices/rearme-global.matrix.json`.

## Evaluación

Rúbricas máquina-legibles puntuadas con el motor de Sprint 26. La entrada es
**anónima**: no se registran datos personales ni notas reales.

```
node scripts/score-rubric.mjs --rubric=docs/education/rubrics/rubrica-comunicacion.json --sample
```
