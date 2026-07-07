# Ficha docente: MENA — Estrés hídrico estructural

> **Advertencia editorial.** Ficha generada automáticamente desde el
> contrato v1 GEOPÓLEM para uso docente (RC/staging). **No sustituye la
> revisión editorial final** ni implica publicación/aprobación. La
> producción permanece bloqueada por política. No se añaden hechos: los
> campos ausentes se marcan como pendientes.

## Identificación

- **conflict_id:** `mena-agua`
- **title (name):** MENA — Estrés hídrico estructural
- **conflict_type:** `agua` — Agua / Clima
- **region (primary_region):** `mena` — MENA
- **status:** `active`
- **intensity_level:** 4
- **energy_dimension:** false
- **Fase de datos (data_stage):** `rc` (`api/v1/conflicts.verified.enriched.json`)

## Resumen

Jordán, Eufrates–Tigris, Nilo, acuíferos fósiles agotándose. 12 de 17 países con mayor estrés hídrico del mundo están en MENA.

## Actores

| Ámbito | Slug | Nombre | Rol |
|---|---|---|---|
| estatal | `egipto` | Egipto | Estado ribereño (Nilo) |
| estatal | `etiopia` | Etiopía | Estado ribereño (Nilo) |

## Recursos

| Slug | Nombre | Mineral crítico |
|---|---|---|
| `agua-dulce` | Agua dulce | false |

## Chokepoints

_(pendiente / empty) — sin `chokepoints`._

## Cadena causal (causal_links)

| Enlace (link_type) | Título | Explicación | Fuentes (source_slugs) | pending |
|---|---|---|---|---|
| `contributes_to` | Estrés hídrico estructural | El Banco Mundial advierte que la disponibilidad de agua per cápita en MENA caerá por debajo del umbral de escasez absoluta (500 m³/persona/año), agravando tensiones estructurales. | `worldbank-mena-water-scarcity` | false |

## Fuentes

| Slug | Título | Editor | URL | accessed_at | verification |
|---|---|---|---|---|---|
| `worldbank-mena-water-scarcity` | Water Scarcity in MENA Requires Bold Actions, Says World Bank Report | World Bank | https://www.worldbank.org/en/news/press-release/2023/04/27/water-scarcity-in-mena-requires-bold-actions-says-world-bank-report | 2026-07-07 | verified |

## Actividades docentes

1. Completar la **matriz de causalidad** del caso `mena-agua` a partir de los enlaces registrados y marcar explícitamente los nodos/enlaces pendientes.
2. Localizar el foco `mena-agua` en el **laboratorio de mapa offline** usando el deep-link `#foco=mena-agua` y contrastar sus filtros (región, tipo, severidad) con otros focos del inventario.
3. Rellenar la **checklist de fuentes** para cada fuente citada y proponer, en su caso, fuentes adicionales que cubran los campos pendientes.

## Preguntas docentes

1. Justifica el tipo de enlace causal `contributes_to` del vínculo «Estrés hídrico estructural» a partir de su explicación y de la(s) fuente(s) `worldbank-mena-water-scarcity`.
2. El foco declara `intensity_level = 4`: ¿qué factores del caso sostienen esa valoración y cuáles podrían revisarla?
3. Relaciona cada recurso y/o chokepoint listado con un canal de impacto global concreto (energético, alimentario, comercial o financiero).
4. Aplica la checklist de fuentes a `worldbank-mena-water-scarcity`: ¿son primarias?, ¿cómo las triangularías?

## Campos pendientes

- `chokepoints` — (pendiente / empty)

