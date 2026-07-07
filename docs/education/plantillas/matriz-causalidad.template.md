# Plantilla: Matriz de causalidad GEOPÓLEM

> Plantilla reutilizable alineada con `causal_links` del contrato v1. Todo
> enlace exige una fuente de soporte. Material de formación: no sustituye la
> revisión editorial final ni activa producción.

## Nodos

Enumera los nodos (factores, hechos, efectos) del análisis:

- **N1:** `<nodo>`
- **N2:** `<nodo>`
- **N3:** `<nodo>`

## Enlaces causales

| # | Origen | Destino | Título (`title`) | Explicación (`explanation`) |
|---|---|---|---|---|
| 1 | `<N_>` | `<N_>` | `<title>` | `<explanation>` |

## Tipo de enlace

Usa el vocabulario del contrato (`link_type`): `causes`, `escalates`,
`enables`, `mitigates`, `correlates`.

| # | `link_type` |
|---|---|
| 1 | `<causes | escalates | ...>` |

## Evidencia de soporte

Cada enlace debe citar al menos una fuente (`source_slugs`).

| # | `source_slugs` | verification |
|---|---|---|
| 1 | `<slug>` | `<verified>` |

## Nivel de confianza

| # | Confianza | Justificación |
|---|---|---|
| 1 | `<alta | media | baja>` | `<por qué>` |
