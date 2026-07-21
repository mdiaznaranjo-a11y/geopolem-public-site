# Sprint 24 — Materiales docentes y estructura curricular

> **Estado: NO-GO (producción bloqueada).** Este sprint convierte la
> arquitectura, los datos, el mapa, la taxonomía y la gobernanza editorial de
> GEOPÓLEM en **materiales de formación** reutilizables (cursos, seminarios,
> dossiers, laboratorios de mapa, casos y guías de evaluación). **No activa
> producción, no aprueba contenido, no introduce secretos.** Todo el material
> es de aula y **no sustituye la revisión editorial final**. No rompe
> PWA/GitHub Pages ni los fallbacks.

## 1. Contexto

Los Sprints 1–23 construyeron la plataforma (API v1 → JSON estático → fallback),
la taxonomía, el mapa, las fuentes verificadas y la gobernanza editorial
(revisión, evidencia, firma, diseño del gate de producción). El Sprint 24 no
añade capacidades de plataforma: **explota lo existente con fines docentes y
profesionales**, respetando la regla de oro del proyecto —trazabilidad primero,
producción bloqueada por política—.

## 2. Estructura de entrega

```
docs/education/
├── README.md                      # índice curricular
├── education.manifest.json        # índice máquina-legible (contrato del validador)
├── taxonomia-alineacion.json      # alineación materiales ↔ contrato v1
├── modelo-pedagogico.md           # modelo pedagógico integral
├── formatos/                      # 6 formatos docentes
│   ├── curso-corto.md
│   ├── seminario-ejecutivo.md
│   ├── dossier-docente.md
│   ├── laboratorio-mapa-interactivo.md
│   ├── caso-de-estudio.md
│   └── guia-de-evaluacion.md
├── plantillas/                    # 7 plantillas reutilizables + índice
│   ├── plantillas.index.json
│   ├── syllabus.template.md
│   ├── caso-de-estudio.template.md
│   ├── ficha-conflicto.template.md
│   ├── actividad-mapa.template.md
│   ├── rubrica-evaluacion.template.md
│   ├── checklist-fuentes.template.md
│   └── matriz-causalidad.template.md
└── casos/                         # casos de estudio basados en datos RC/staging
    ├── caso-red-sea-bab-el-mandeb.md
    └── caso-ukr-rus-energia.md

scripts/validate-education-materials.mjs   # validador sin DB ni web
api-server/test/sprint24-education-materials.test.mjs
```

## 3. Bloques implementados

### 3.1 Estructura curricular (Bloque 1)
Seis formatos alineados con la taxonomía: **curso corto**, **seminario
ejecutivo**, **dossier docente**, **laboratorio de mapa interactivo**, **caso de
estudio** y **guía de evaluación**. Cada formato declara duración, público,
competencias y actividad, y mapea a entidades del contrato v1 (`conflict_type`,
`primary_region`, `metrics`, `dimensions`, `actors`, `resources`, `chokepoints`,
`causal_links`, `sources`).

### 3.2 Modelo pedagógico (Bloque 2)
`docs/education/modelo-pedagogico.md` integra análisis geopolítico, política
energética, OSINT responsable, validación de fuentes, causalidad y visualización
de datos. Incluye competencias (C1–C7), objetivos de aprendizaje, metodología
(observar → verificar → explicar → comunicar), evaluación y hoja de ruta
académica/profesional por nivel.

### 3.3 Plantillas docentes (Bloque 3)
Siete plantillas Markdown reutilizables + índice JSON: **syllabus**, **caso de
estudio**, **ficha de conflicto** (1:1 con el contrato v1), **actividad de
mapa**, **rúbrica de evaluación**, **checklist de fuentes** (OSINT responsable) y
**matriz de causalidad**. El validador comprueba que cada plantilla contiene
todas sus secciones requeridas.

### 3.4 Casos de estudio basados en datos RC/staging (Bloque 4)
Dos casos no productivos con IDs y datos **reales** del repositorio, sin inventar
hechos:

- **`caso-red-sea-bab-el-mandeb.md`** (`red-sea`, chokepoint, MENA): desvío de
  rutas y fletes; fuente verificada UNCTAD.
- **`caso-ukr-rus-energia.md`** (`ukr-rus`, conflicto, Europa del Este): riesgo
  sobre infraestructura energética/nuclear; fuente verificada OIEA/IAEA.

Ambos llevan **advertencia editorial** explícita y citan fuentes con
`verification = verified`.

### 3.5 Integración operativa (Bloque 5)
`scripts/validate-education-materials.mjs` valida —**sin DB ni web**— que la
estructura existe, que las plantillas están completas, que la alineación
taxonómica referencia campos **reales** del contrato v1, que los casos usan IDs
existentes del inventario y que **no** hay producción ni secretos. Expuesto como
`npm run education:validate` y añadido al job de validadores estáticos de CI.

### 3.6 Reporte (Bloque 6)
Este documento.

### 3.7 Pruebas (Bloque 7)
`api-server/test/sprint24-education-materials.test.mjs` (node:test, 9 pruebas)
cubre estructura, plantillas completas, alineación taxonómica, casos con IDs
reales/advertencia/fuente y ausencia de producción/secrets, e invoca el
validador dedicado exigiendo exit 0.

## 4. Alineación con la taxonomía y la base de datos

`docs/education/taxonomia-alineacion.json` mapea cada entidad/campo de la
taxonomía al material que la cubre, referenciando el esquema real
(`api/v1/conflicts/istanbul.json`) y el inventario
(`data/conflicts.inventory.json`). El validador **falla** si algún campo
declarado no existe en el contrato v1, evitando divergencias con la base de
datos.

## 5. Garantías

- **No producción:** `education.manifest.json` declara `is_production=false` y
  `activates_production_gate=false`; el validador rechaza marcas de activación.
- **No secretos:** barrido de patrones (PEM, AWS, GitHub, Slack, secretos
  embebidos) sobre todos los materiales; 0 hallazgos.
- **No inventa hechos:** los casos usan IDs y fuentes verificadas ya presentes en
  el repo.
- **No rompe la plataforma:** solo se añaden docs, un script de validación, un
  test y un paso de CI; sin tocar app/PWA/fallbacks.

## 6. Verificación

```bash
node scripts/validate-education-materials.mjs        # 51/51 PASS, exit 0
cd api-server && npm test                             # suite completa verde
```

## 7. Uso académico / profesional

- **Académico:** grado y posgrado (curso corto, casos, laboratorio de mapa).
- **Profesional:** analistas OSINT (plantillas + matriz causal + checklist) y
  dirección (seminario ejecutivo).
- **Formación de formadores:** dossier docente + guía de evaluación.

## 8. Recomendaciones Sprint 25

1. **Exportador de fichas de conflicto** desde `api/v1/conflicts/<id>.json` a la
   plantilla de ficha (generación determinista, sin DB), para autogenerar
   material a partir de datos verificados.
2. **Banco de casos ampliado** con los focos restantes del inventario, cada uno
   con su matriz de causalidad pre-rellena a partir de `causal_links`.
3. **Cuaderno del laboratorio de mapa** interactivo servido como PWA offline
   (reutilizando `worldmap.js`), en modo formación.
4. **Trazabilidad de aprendizaje**: rúbricas máquina-legibles (JSON) para
   integrarlas con analítica educativa sin exponer datos personales.
