# Ficha docente: Canal de Estambul / Bósforo

> **Advertencia editorial.** Ficha generada automáticamente desde el
> contrato v1 GEOPÓLEM para uso docente (RC/staging). **No sustituye la
> revisión editorial final** ni implica publicación/aprobación. La
> producción permanece bloqueada por política. No se añaden hechos: los
> campos ausentes se marcan como pendientes.

## Identificación

- **conflict_id:** `istanbul`
- **title (name):** Canal de Estambul / Bósforo
- **conflict_type:** `chokepoint` — Chokepoint
- **region (primary_region):** `eurasia` — Eurasia
- **status:** `active`
- **intensity_level:** 2
- **energy_dimension:** false
- **Fase de datos (data_stage):** `rc` (`api/v1/conflicts.verified.enriched.json`)

## Resumen

Proyecto canal paralelo TR + Convención de Montreux: cuello de botella crítico para grano y petróleo Mar Negro.

## Actores

| Ámbito | Slug | Nombre | Rol |
|---|---|---|---|
| estatal | `turquia` | Turquía | Estado ribereño |

## Recursos

| Slug | Nombre | Mineral crítico |
|---|---|---|
| `petroleo` | Petróleo | false |
| `grano` | Grano | false |

## Chokepoints

| Slug | Nombre | Relevancia flujo energético |
|---|---|---|
| `estrecho-del-bosforo` | Estrecho del Bósforo | true |
| `dardanelos` | Dardanelos | true |

## Cadena causal (causal_links)

| Enlace (link_type) | Título | Explicación | Fuentes (source_slugs) | pending |
|---|---|---|---|---|
| `contributes_to` | Régimen del Bósforo y tránsito por los Estrechos | La Convención de Montreux (1936) rige el régimen de los Estrechos Turcos (Bósforo y Dardanelos) y es, según el Ministerio de Exteriores turco, el elemento esencial para la seguridad y estabilidad del Mar Negro; la afirmación causal concreta sobre el impacto en flujos de energía y grano requiere verificación editorial adicional. | `turkiye-mfa-montreux` | true |

## Fuentes

| Slug | Título | Editor | URL | accessed_at | verification |
|---|---|---|---|---|---|
| `turkiye-mfa-montreux` | Implementation of the Montreux Convention | Republic of Türkiye Ministry of Foreign Affairs | https://www.mfa.gov.tr/implementation-of-the-montreux-convention.en.mfa | 2026-07-07 | verified |

## Actividades docentes

1. Completar la **matriz de causalidad** del caso `istanbul` a partir de los enlaces registrados y marcar explícitamente los nodos/enlaces pendientes.
2. Localizar el foco `istanbul` en el **laboratorio de mapa offline** usando el deep-link `#foco=istanbul` y contrastar sus filtros (región, tipo, severidad) con otros focos del inventario.
3. Rellenar la **checklist de fuentes** para cada fuente citada y proponer, en su caso, fuentes adicionales que cubran los campos pendientes.

## Preguntas docentes

1. Justifica el tipo de enlace causal `contributes_to` del vínculo «Régimen del Bósforo y tránsito por los Estrechos» a partir de su explicación y de la(s) fuente(s) `turkiye-mfa-montreux`.
2. El foco declara `intensity_level = 2`: ¿qué factores del caso sostienen esa valoración y cuáles podrían revisarla?
3. Relaciona cada recurso y/o chokepoint listado con un canal de impacto global concreto (energético, alimentario, comercial o financiero).
4. Aplica la checklist de fuentes a `turkiye-mfa-montreux`: ¿son primarias?, ¿cómo las triangularías?

## Campos pendientes

- Ninguno: todos los campos del contrato v1 están presentes en esta fase.

