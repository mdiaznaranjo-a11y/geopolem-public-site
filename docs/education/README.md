# GEOPÓLEM — Materiales docentes y estructura curricular (Sprint 24)

> **Aviso.** Estos son materiales de **formación**. Reutilizan la arquitectura,
> los datos, el mapa, la taxonomía y la gobernanza editorial de GEOPÓLEM con
> fines docentes y profesionales. **No sustituyen la revisión editorial final**
> ni activan producción. La producción sigue **bloqueada por política**
> (ver `docs/production-gate-design.md`).

Esta carpeta convierte la plataforma GEOPÓLEM en un programa formativo
reutilizable: cursos, seminarios, dossiers, laboratorios de mapa, casos de
estudio y guías de evaluación, todos alineados con la taxonomía y la base de
datos del proyecto.

## Mapa de la carpeta

```
docs/education/
├── README.md                      # este índice
├── education.manifest.json        # índice máquina-legible (lo valida el script)
├── taxonomia-alineacion.json      # alineación materiales ↔ taxonomía v1
├── modelo-pedagogico.md           # modelo pedagógico integral
├── formatos/                      # 6 formatos docentes
│   ├── curso-corto.md
│   ├── seminario-ejecutivo.md
│   ├── dossier-docente.md
│   ├── laboratorio-mapa-interactivo.md
│   ├── caso-de-estudio.md
│   └── guia-de-evaluacion.md
├── plantillas/                    # 7 plantillas reutilizables (+ índice)
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
```

## Formatos docentes

| Formato | Duración | Público | Ficha |
|---|---|---|---|
| Curso corto | 12–16 h | Grado, analistas junior | [formatos/curso-corto.md](formatos/curso-corto.md) |
| Seminario ejecutivo | 4–6 h | Dirección, riesgo/compliance | [formatos/seminario-ejecutivo.md](formatos/seminario-ejecutivo.md) |
| Dossier docente | Lectura | Docentes, formadores | [formatos/dossier-docente.md](formatos/dossier-docente.md) |
| Laboratorio de mapa | 2–3 h | Analistas OSINT | [formatos/laboratorio-mapa-interactivo.md](formatos/laboratorio-mapa-interactivo.md) |
| Caso de estudio | 1.5–3 h | Equipos de análisis | [formatos/caso-de-estudio.md](formatos/caso-de-estudio.md) |
| Guía de evaluación | Transversal | Docentes, evaluadores | [formatos/guia-de-evaluacion.md](formatos/guia-de-evaluacion.md) |

## Alineación con la taxonomía GEOPÓLEM

Cada formato y plantilla se apoya en el contrato de datos **v1** real
(`api/v1/conflicts/*.json`, `data/conflicts.inventory.json`). Las entidades y
campos cubiertos —`conflict_type`, `primary_region`, `metrics`, `dimensions`,
`actors`, `resources`, `chokepoints`, `causal_links`, `sources` y la gobernanza
editorial— se declaran en [`taxonomia-alineacion.json`](taxonomia-alineacion.json)
y se comprueban con el validador.

## Validación (sin DB ni web)

```bash
node scripts/validate-education-materials.mjs        # PASS/FAIL + exit code
node scripts/validate-education-materials.mjs --json  # salida máquina-legible
```

El validador comprueba que la estructura existe, que las plantillas están
completas, que la alineación taxonómica referencia campos **reales** del
contrato v1, que los casos usan IDs de conflicto existentes y que **no** hay
activación de producción ni secretos.

## Cómo usar estos materiales

1. Elige un **formato** según el público y la duración.
2. Instancia las **plantillas** necesarias (syllabus, ficha, caso, rúbrica…).
3. Ancla toda afirmación a una **fuente verificada** (checklist de fuentes).
4. Trabaja la **causalidad** con la matriz y el mapa interactivo.
5. Evalúa con la **rúbrica** y la guía de evaluación.

## Ruta académica / profesional

Ver [`modelo-pedagogico.md`](modelo-pedagogico.md), sección *Hoja de ruta*.
