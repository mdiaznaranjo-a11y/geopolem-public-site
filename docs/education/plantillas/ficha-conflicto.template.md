# Plantilla: Ficha de conflicto GEOPÓLEM

> Plantilla reutilizable alineada 1:1 con el contrato v1
> (`api/v1/conflicts/<id>.json`). Material de formación: no sustituye la
> revisión editorial final ni activa producción.

## Identificación

- **id:** `<id>`
- **slug:** `<slug>`
- **name:** `<name>`
- **summary:** `<summary>`

## Clasificación taxonómica

- **conflict_type:** `<slug — label>`
- **primary_region:** `<slug — label>`
- **status:** `<active | ...>`

## Métricas

- **intensity_level (1–5):** `<n>`
- **escalation_risk:** `<valor | null>`
- **humanitarian_impact:** `<valor | null>`

## Dimensiones

- **energy:** `<true | false>`
- **territorial:** `<valor | null>`
- **external_involvement:** `<valor | null>`

## Relaciones

- **actors.state:** `<...>`
- **actors.non_state:** `<...>`
- **resources:** `<...>`
- **chokepoints:** `<...>`
- **causal_links:** `<resumen — ver matriz de causalidad>`

## Fuentes

| Slug | Título | URL | verification |
|---|---|---|---|
| `<slug>` | `<title>` | `<url>` | `<verified | demo>` |

## Estado editorial

- **editorial_status:** `<review | approved | ...>` (informativo; el material
  docente no modifica estados).
