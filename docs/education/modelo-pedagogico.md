# Modelo pedagógico GEOPÓLEM

> Material de formación. No sustituye la revisión editorial final ni activa
> producción.

Este documento define el modelo pedagógico que integra **análisis
geopolítico**, **política energética**, **OSINT responsable**, **validación de
fuentes**, **causalidad** y **visualización de datos** sobre la base de la
plataforma GEOPÓLEM (arquitectura API v1 → JSON estático → fallback local).

## 1. Fundamento

GEOPÓLEM no es solo un mapa de conflictos: es una **cadena de trazabilidad**
que va del hecho a la fuente verificada, de la fuente al enlace causal, y del
enlace causal a la visualización. El modelo pedagógico reproduce esa cadena
como itinerario de aprendizaje: el estudiante no memoriza conclusiones, sino
que **reconstruye la evidencia** con las mismas reglas de la redacción.

Principios rectores:

- **Trazabilidad primero.** Ninguna afirmación sin fuente (regla
  *published-exige-fuente* / *causal_links-exigen-fuente* del repositorio).
- **OSINT responsable.** Solo fuentes abiertas, citadas y verificables; sin
  técnicas intrusivas ni datos personales.
- **Causalidad explícita.** Distinguir correlación de causa; declarar el tipo
  de enlace (`causes`, `escalates`, …) y su nivel de confianza.
- **No producción.** El trabajo del aula opera sobre datos RC/staging; nunca
  publica ni aprueba contenido real.

## 2. Competencias

| Código | Competencia |
|---|---|
| C1 | Clasificar un foco según la taxonomía GEOPÓLEM (`conflict_type`, `primary_region`, `dimensions`). |
| C2 | Evaluar y verificar fuentes abiertas con criterios OSINT responsables. |
| C3 | Construir cadenas causales trazables ancladas a fuentes. |
| C4 | Interpretar métricas de intensidad, riesgo de escalada e impacto humanitario. |
| C5 | Analizar chokepoints y su relevancia para los flujos energéticos. |
| C6 | Visualizar y comunicar el análisis con el mapa y los artefactos de datos. |
| C7 | Aplicar gobernanza editorial: estados, revisión, evidencia y separación de producción. |

## 3. Objetivos de aprendizaje

Al finalizar, el participante será capaz de:

1. **Describir** la arquitectura de datos GEOPÓLEM (API real → JSON estático →
   fallback) y por qué garantiza resiliencia y trazabilidad.
2. **Fichar** un conflicto usando el contrato v1 real, sin inventar campos.
3. **Verificar** una fuente y decidir si es utilizable (checklist de fuentes).
4. **Modelar** la causalidad de un foco con la matriz de causalidad.
5. **Operar** el laboratorio de mapa para leer patrones regionales y energéticos.
6. **Evaluar** trabajo propio y ajeno con rúbricas alineadas a competencias.

## 4. Ejes integradores

### 4.1 Análisis geopolítico
Marco de actores (`actors.state` / `actors.non_state`), regiones
(`primary_region`) y tipos de conflicto (`conflict_type`).

### 4.2 Política energética
Lectura de `dimensions.energy`, `resources` (p. ej. petróleo, gas natural) y
`chokepoints` con `energy_flow_relevance`. Los cuellos de botella (Ormuz, Bab
el-Mandeb, Suez, Bósforo, Kerch) se estudian como variables de oferta.

### 4.3 OSINT responsable y validación de fuentes
Solo fuentes abiertas y citables. Cada fuente lleva `url`, `publisher`,
`accessed_at` y `verification`. La checklist descarta rumores y contenido no
verificable.

### 4.4 Causalidad
La matriz de causalidad obliga a declarar nodo origen → enlace tipado → nodo
destino, con la fuente que lo sostiene y un nivel de confianza.

### 4.5 Visualización de datos
El mapa (`api/v1/conflicts/active/map.json`, `worldmap.js`) y las fichas
enriquecidas traducen los datos a lectura espacial y comparada.

## 5. Metodología

Ciclo de cuatro pasos por unidad, replicando la redacción:

1. **Observar** — datos crudos del RC/staging y del mapa.
2. **Verificar** — pasar cada fuente por la checklist.
3. **Explicar** — construir la matriz de causalidad.
4. **Comunicar** — ficha/caso + visualización, evaluados con rúbrica.

## 6. Actividades tipo

- Ficha de conflicto a partir de un ID real del inventario.
- Auditoría de fuentes de un foco (verified vs. demo).
- Reconstrucción de una cadena causal con la matriz.
- Laboratorio de mapa: filtrar por región / dimensión energética.
- Caso de estudio guiado (ver `casos/`).

## 7. Evaluación

Evaluación por competencias con rúbricas (ver
`plantillas/rubrica-evaluacion.template.md` y `formatos/guia-de-evaluacion.md`).
Se puntúa **trazabilidad**, **rigor OSINT**, **calidad causal** y
**comunicación visual**, no la mera cantidad de contenido.

## 8. Hoja de ruta académica / profesional

| Nivel | Perfil | Itinerario |
|---|---|---|
| Iniciación | Estudiante de grado | Curso corto + 1 caso guiado + laboratorio de mapa. |
| Intermedio | Analista junior | Curso corto + 2 casos + auditoría de fuentes + matriz causal propia. |
| Avanzado | Analista / OSINT | Dossier docente + caso original (RC) + defensa con rúbrica avanzada. |
| Ejecutivo | Dirección, riesgo | Seminario ejecutivo (lectura de riesgos y chokepoints energéticos). |
| Formador | Docente | Guía de evaluación + adaptación de plantillas + gobernanza editorial. |

## 9. Integración con la plataforma

- **Datos:** contrato v1 real y RC/staging; nunca producción.
- **Taxonomía:** ver [`taxonomia-alineacion.json`](taxonomia-alineacion.json).
- **Gobernanza:** estados editoriales y evidencia (Sprints 20–23) como material
  de aula sobre *cómo se decide qué se publica*.
- **Validación:** `scripts/validate-education-materials.mjs` (sin DB ni web).
