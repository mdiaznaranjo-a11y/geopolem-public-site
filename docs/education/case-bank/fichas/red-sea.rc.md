# Ficha docente: Mar Rojo / Bab el-Mandeb

> **Advertencia editorial.** Ficha generada automáticamente desde el
> contrato v1 GEOPÓLEM para uso docente (RC/staging). **No sustituye la
> revisión editorial final** ni implica publicación/aprobación. La
> producción permanece bloqueada por política. No se añaden hechos: los
> campos ausentes se marcan como pendientes.

## Identificación

- **conflict_id:** `red-sea`
- **title (name):** Mar Rojo / Bab el-Mandeb
- **conflict_type:** `chokepoint` — Chokepoint
- **region (primary_region):** `mena` — MENA
- **status:** `active`
- **intensity_level:** 4
- **energy_dimension:** false
- **Fase de datos (data_stage):** `rc` (`api/v1/conflicts.verified.enriched.json`)

## Resumen

Ataques Houthi a navegación reducen tráfico ~50%, fletes y primas suben, desvíos por Cabo de Buena Esperanza añaden 10-14 días.

## Actores

| Ámbito | Slug | Nombre | Rol |
|---|---|---|---|
| no estatal | `huties` | Hutíes | Grupo armado |

## Recursos

| Slug | Nombre | Mineral crítico |
|---|---|---|
| `petroleo` | Petróleo | false |

## Chokepoints

| Slug | Nombre | Relevancia flujo energético |
|---|---|---|
| `bab-el-mandeb` | Bab el-Mandeb | true |
| `canal-de-suez` | Canal de Suez | true |

## Cadena causal (causal_links)

| Enlace (link_type) | Título | Explicación | Fuentes (source_slugs) | pending |
|---|---|---|---|---|
| `causes` | Ataques a navegación y desvío de rutas | UNCTAD documenta caídas del tráfico por el Canal de Suez y el desvío masivo de portacontenedores por el Cabo de Buena Esperanza, con encarecimiento de fletes y emisiones. | `unctad-navigating-troubled-waters` | false |

## Fuentes

| Slug | Título | Editor | URL | accessed_at | verification |
|---|---|---|---|---|---|
| `unctad-navigating-troubled-waters` | Navigating troubled waters: Impact to global trade of disruption of shipping routes in the Red Sea, Black Sea and Panama Canal | UNCTAD — UN Trade and Development | https://unctad.org/publication/navigating-troubled-waters-impact-global-trade-disruption-shipping-routes-red-sea-black | 2026-07-07 | verified |

## Actividades docentes

1. Completar la **matriz de causalidad** del caso `red-sea` a partir de los enlaces registrados y marcar explícitamente los nodos/enlaces pendientes.
2. Localizar el foco `red-sea` en el **laboratorio de mapa offline** usando el deep-link `#foco=red-sea` y contrastar sus filtros (región, tipo, severidad) con otros focos del inventario.
3. Rellenar la **checklist de fuentes** para cada fuente citada y proponer, en su caso, fuentes adicionales que cubran los campos pendientes.

## Preguntas docentes

1. Justifica el tipo de enlace causal `causes` del vínculo «Ataques a navegación y desvío de rutas» a partir de su explicación y de la(s) fuente(s) `unctad-navigating-troubled-waters`.
2. El foco declara `intensity_level = 4`: ¿qué factores del caso sostienen esa valoración y cuáles podrían revisarla?
3. Relaciona cada recurso y/o chokepoint listado con un canal de impacto global concreto (energético, alimentario, comercial o financiero).
4. Aplica la checklist de fuentes a `unctad-navigating-troubled-waters`: ¿son primarias?, ¿cómo las triangularías?

## Campos pendientes

- Ninguno: todos los campos del contrato v1 están presentes en esta fase.

