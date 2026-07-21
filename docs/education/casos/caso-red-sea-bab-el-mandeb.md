# Caso de estudio: Mar Rojo / Bab el-Mandeb

> **Advertencia editorial.** Material docente basado en datos del RC/staging del
> repositorio GEOPÓLEM. **No sustituye la revisión editorial final** ni implica
> publicación/aprobación de contenido. La producción permanece bloqueada por
> política. Todos los datos proceden de fuentes ya verificadas del proyecto; no
> se añaden hechos nuevos.

## Identificación del conflicto

- **conflict_id:** `red-sea`
- **name:** Mar Rojo / Bab el-Mandeb
- **conflict_type:** `chokepoint` — Chokepoint
- **primary_region:** `mena` — MENA
- **status:** `active`
- **intensity_level:** 4
- **Fase de datos:** RC / v1 verificado (`api/v1/conflicts.verified.enriched.json`)

## Contexto

Los ataques contra la navegación en el estrecho de Bab el-Mandeb han reducido de
forma marcada el tráfico y han empujado a las navieras a desviar buques por el
Cabo de Buena Esperanza, con incrementos de fletes y primas de seguro y tiempos
de tránsito 10–14 días mayores. Es un caso arquetípico de **cuello de botella**
con impacto sobre cadenas de suministro globales.

## Actores

- **Estatales (`actors.state`):** — (no registrados en el dato verificado)
- **No estatales (`actors.non_state`):** Hutíes (rol: grupo armado).

## Recursos y chokepoints

- **Recursos (`resources`):** Petróleo.
- **Chokepoints (`chokepoints`):**
  - Bab el-Mandeb — `energy_flow_relevance = true`.
  - Canal de Suez — `energy_flow_relevance = true`.

## Cadena causal

| Enlace (`link_type`) | Título | Explicación | Fuente |
|---|---|---|---|
| `causes` | Ataques a navegación y desvío de rutas | UNCTAD documenta caídas del tráfico por el Canal de Suez y el desvío masivo de portacontenedores por el Cabo de Buena Esperanza, con encarecimiento de fletes y emisiones. | `unctad-navigating-troubled-waters` |

## Fuentes

| Slug | Título | Editor | URL | accessed_at | verification |
|---|---|---|---|---|---|
| `unctad-navigating-troubled-waters` | Navigating troubled waters: Impact to global trade of disruption of shipping routes in the Red Sea, Black Sea and Panama Canal | UNCTAD — UN Trade and Development | https://unctad.org/publication/navigating-troubled-waters-impact-global-trade-disruption-shipping-routes-red-sea-black | 2026-07-07 | verified |

## Preguntas de análisis

1. ¿Por qué un chokepoint marítimo con `energy_flow_relevance = true` amplifica
   el efecto de un actor no estatal sobre el comercio global?
2. Relaciona el desvío por el Cabo de Buena Esperanza con el `intensity_level`
   asignado (4): ¿qué evidencia lo sostiene?
3. ¿Qué otra fuente independiente buscarías para **triangular** la afirmación de
   UNCTAD? Aplica la checklist de fuentes.
4. Traslada la cadena causal a la matriz de causalidad y asígnale un nivel de
   confianza justificado.

## Actividad sugerida

Completar la **ficha de conflicto** y la **matriz de causalidad** para
`red-sea`, y localizar Bab el-Mandeb y Suez en el **laboratorio de mapa**.
