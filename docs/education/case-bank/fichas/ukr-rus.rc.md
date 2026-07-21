# Ficha docente: Ucrania – Rusia

> **Advertencia editorial.** Ficha generada automáticamente desde el
> contrato v1 GEOPÓLEM para uso docente (RC/staging). **No sustituye la
> revisión editorial final** ni implica publicación/aprobación. La
> producción permanece bloqueada por política. No se añaden hechos: los
> campos ausentes se marcan como pendientes.

## Identificación

- **conflict_id:** `ukr-rus`
- **title (name):** Ucrania – Rusia
- **conflict_type:** `conflicto` — Conflictos
- **region (primary_region):** `europa_del_este` — Europa del Este
- **status:** `active`
- **intensity_level:** 5
- **energy_dimension:** false
- **Fase de datos (data_stage):** `rc` (`api/v1/conflicts.verified.enriched.json`)

## Resumen

Guerra de desgaste con frente estabilizado, presión sobre infraestructura energética y campañas híbridas (cíber, drones, narrativa).

## Actores

| Ámbito | Slug | Nombre | Rol |
|---|---|---|---|
| estatal | `rusia` | Rusia | Parte beligerante |
| estatal | `ucrania` | Ucrania | Parte beligerante |

## Recursos

| Slug | Nombre | Mineral crítico |
|---|---|---|
| `gas-natural` | Gas natural | false |
| `trigo` | Trigo | false |

## Chokepoints

| Slug | Nombre | Relevancia flujo energético |
|---|---|---|
| `estrecho-de-kerch` | Estrecho de Kerch | false |

## Cadena causal (causal_links)

| Enlace (link_type) | Título | Explicación | Fuentes (source_slugs) | pending |
|---|---|---|---|---|
| `escalates` | Riesgo sobre infraestructura energética (nuclear) | El OIEA documenta pérdidas repetidas de energía externa y daños en líneas eléctricas de la central de Zaporiyia por la actividad militar, con impacto directo en la seguridad de la infraestructura energética. | `iaea-ukraine-update-356` | false |

## Fuentes

| Slug | Título | Editor | URL | accessed_at | verification |
|---|---|---|---|---|---|
| `iaea-ukraine-update-356` | Update 356 – IAEA Director General Statement on Situation in Ukraine | International Atomic Energy Agency (IAEA) | https://www.iaea.org/newscenter/pressreleases/update-356-iaea-director-general-statement-on-situation-in-ukraine | 2026-07-07 | verified |

## Actividades docentes

1. Completar la **matriz de causalidad** del caso `ukr-rus` a partir de los enlaces registrados y marcar explícitamente los nodos/enlaces pendientes.
2. Localizar el foco `ukr-rus` en el **laboratorio de mapa offline** usando el deep-link `#foco=ukr-rus` y contrastar sus filtros (región, tipo, severidad) con otros focos del inventario.
3. Rellenar la **checklist de fuentes** para cada fuente citada y proponer, en su caso, fuentes adicionales que cubran los campos pendientes.

## Preguntas docentes

1. Justifica el tipo de enlace causal `escalates` del vínculo «Riesgo sobre infraestructura energética (nuclear)» a partir de su explicación y de la(s) fuente(s) `iaea-ukraine-update-356`.
2. El foco declara `intensity_level = 5`: ¿qué factores del caso sostienen esa valoración y cuáles podrían revisarla?
3. Relaciona cada recurso y/o chokepoint listado con un canal de impacto global concreto (energético, alimentario, comercial o financiero).
4. Aplica la checklist de fuentes a `iaea-ukraine-update-356`: ¿son primarias?, ¿cómo las triangularías?

## Campos pendientes

- Ninguno: todos los campos del contrato v1 están presentes en esta fase.

