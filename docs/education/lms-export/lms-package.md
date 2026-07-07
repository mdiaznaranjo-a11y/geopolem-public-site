# Paquete LMS GEOPÓLEM (Sprint 26)

> Material de **formación**. No sustituye la revisión editorial final ni activa producción.
> Portable e independiente de plataforma: importa las referencias en tu LMS (Moodle, Canvas, etc.).

- Módulos/formatos: **6**
- Casos: **10**
- Rúbricas: **6**

## Módulos

- **Curso corto GEOPÓLEM** — `docs/education/formatos/curso-corto.md`
- **Seminario ejecutivo** — `docs/education/formatos/seminario-ejecutivo.md`
- **Dossier docente** — `docs/education/formatos/dossier-docente.md`
- **Laboratorio de mapa interactivo** — `docs/education/formatos/laboratorio-mapa-interactivo.md`
- **Formato de caso de estudio** — `docs/education/formatos/caso-de-estudio.md`
- **Guía de evaluación** — `docs/education/formatos/guia-de-evaluacion.md`

## Casos

| id | título | tipo | región | ficha | matriz | enlaces |
|---|---|---|---|---|---|---|
| `asia-agua` | Asia del Sur — Glaciares e Indo | agua | asia_del_sur | `docs/education/case-bank/fichas/asia-agua.rc.md` | `docs/education/case-bank/matrices/asia-agua.matrix.json` | 1 |
| `ia-narrativa` | IA / Riesgo narrativo global | ia | global | `docs/education/case-bank/fichas/ia-narrativa.rc.md` | `docs/education/case-bank/matrices/ia-narrativa.matrix.json` | 1 |
| `isr-gaza-irn` | Israel – Gaza – Irán | conflicto | mena | `docs/education/case-bank/fichas/isr-gaza-irn.rc.md` | `docs/education/case-bank/matrices/isr-gaza-irn.matrix.json` | 1 |
| `istanbul` | Canal de Estambul / Bósforo | chokepoint | eurasia | `docs/education/case-bank/fichas/istanbul.rc.md` | `docs/education/case-bank/matrices/istanbul.matrix.json` | 1 |
| `mena-agua` | MENA — Estrés hídrico estructural | agua | mena | `docs/education/case-bank/fichas/mena-agua.rc.md` | `docs/education/case-bank/matrices/mena-agua.matrix.json` | 1 |
| `rearme-global` | Rearme global — gasto militar récord | defensa | global | `docs/education/case-bank/fichas/rearme-global.rc.md` | `docs/education/case-bank/matrices/rearme-global.matrix.json` | 1 |
| `red-sea` | Mar Rojo / Bab el-Mandeb | chokepoint | mena | `docs/education/case-bank/fichas/red-sea.rc.md` | `docs/education/case-bank/matrices/red-sea.matrix.json` | 1 |
| `sahel` | Sahel — Juntas militares y yihadismo | conflicto | sahel | `docs/education/case-bank/fichas/sahel.rc.md` | `docs/education/case-bank/matrices/sahel.matrix.json` | 1 |
| `stablecoins` | Stablecoins / desinformación financiera | ia | global | `docs/education/case-bank/fichas/stablecoins.rc.md` | `docs/education/case-bank/matrices/stablecoins.matrix.json` | 1 |
| `ukr-rus` | Ucrania – Rusia | conflicto | europa_del_este | `docs/education/case-bank/fichas/ukr-rus.rc.md` | `docs/education/case-bank/matrices/ukr-rus.matrix.json` | 1 |

## Rúbricas

- **Rúbrica de análisis geopolítico** (`rubrica-analisis-geopolitico`, dimensión: analisis-geopolitico) — criterios: contexto, actores, intereses, trazabilidad; niveles: insuficiente, suficiente, notable, excelente
- **Rúbrica de política energética** (`rubrica-politica-energetica`, dimensión: politica-energetica) — criterios: recursos, chokepoints, impacto, trazabilidad; niveles: insuficiente, suficiente, notable, excelente
- **Rúbrica de validación de fuentes** (`rubrica-validacion-fuentes`, dimensión: validacion-fuentes) — criterios: identificacion, verificacion, trazabilidad, sesgo; niveles: insuficiente, suficiente, notable, excelente
- **Rúbrica de razonamiento causal** (`rubrica-causalidad`, dimensión: causalidad) — criterios: nodos, enlaces, evidencia, confianza; niveles: insuficiente, suficiente, notable, excelente
- **Rúbrica de uso del mapa interactivo** (`rubrica-uso-mapa`, dimensión: uso-mapa) — criterios: localizacion, filtros, deeplinks, offline; niveles: insuficiente, suficiente, notable, excelente
- **Rúbrica de comunicación analítica** (`rubrica-comunicacion`, dimensión: comunicacion) — criterios: claridad, estructura, evidencia, honestidad; niveles: insuficiente, suficiente, notable, excelente

## Puntuación

Usa `node scripts/score-rubric.mjs --rubric=<ruta> --evaluation=<ruta>` para calcular puntajes.
El export `rubrics.csv` de esta carpeta lista criterios, niveles y descriptores para importadores.

