# Caso de estudio: Ucrania – Rusia (dimensión energética)

> **Advertencia editorial.** Material docente basado en datos del RC/staging del
> repositorio GEOPÓLEM. **No sustituye la revisión editorial final** ni implica
> publicación/aprobación de contenido. La producción permanece bloqueada por
> política. Todos los datos proceden de fuentes ya verificadas del proyecto; no
> se añaden hechos nuevos.

## Identificación del conflicto

- **conflict_id:** `ukr-rus`
- **name:** Ucrania – Rusia
- **conflict_type:** `conflicto` — Conflictos
- **primary_region:** `europa_del_este` — Europa del Este
- **status:** `active`
- **intensity_level:** 5
- **Fase de datos:** RC / v1 verificado (`api/v1/conflicts.verified.enriched.json`)

## Contexto

Guerra de desgaste con frente estabilizado y presión sostenida sobre la
infraestructura energética, acompañada de campañas híbridas (ciber, drones,
narrativa). El caso permite estudiar cómo un conflicto convencional proyecta
**riesgo sobre la seguridad energética**, incluida la infraestructura nuclear.

## Actores

- **Estatales (`actors.state`):** Rusia (parte beligerante), Ucrania (parte
  beligerante).
- **No estatales (`actors.non_state`):** — (no registrados en el dato verificado)

## Recursos y chokepoints

- **Recursos (`resources`):** Gas natural, Trigo.
- **Chokepoints (`chokepoints`):** Estrecho de Kerch — `energy_flow_relevance =
  false`.

## Cadena causal

| Enlace (`link_type`) | Título | Explicación | Fuente |
|---|---|---|---|
| `escalates` | Riesgo sobre infraestructura energética (nuclear) | El OIEA documenta pérdidas repetidas de energía externa y daños en líneas eléctricas de la central de Zaporiyia por la actividad militar, con impacto directo en la seguridad de la infraestructura energética. | `iaea-ukraine-update-356` |

## Fuentes

| Slug | Título | Editor | URL | accessed_at | verification |
|---|---|---|---|---|---|
| `iaea-ukraine-update-356` | Update 356 – IAEA Director General Statement on Situation in Ukraine | International Atomic Energy Agency (IAEA) | https://www.iaea.org/newscenter/pressreleases/update-356-iaea-director-general-statement-on-situation-in-ukraine | 2026-07-07 | verified |

## Preguntas de análisis

1. ¿Por qué el enlace causal es de tipo `escalates` y no `causes`? Justifícalo
   con la explicación y la fuente.
2. El foco tiene `intensity_level = 5`: ¿qué papel juega la amenaza a la
   infraestructura nuclear en esa valoración?
3. Gas natural y trigo aparecen como recursos: relaciona cada uno con un canal
   de impacto global distinto (energía vs. seguridad alimentaria).
4. Aplica la checklist de fuentes al comunicado del OIEA: ¿es fuente primaria?
   ¿cómo la triangularías?

## Actividad sugerida

Completar la **matriz de causalidad** para `ukr-rus`, distinguiendo el efecto
energético del alimentario, y contrastar `intensity_level` con el de otros focos
del inventario en el **laboratorio de mapa**.
