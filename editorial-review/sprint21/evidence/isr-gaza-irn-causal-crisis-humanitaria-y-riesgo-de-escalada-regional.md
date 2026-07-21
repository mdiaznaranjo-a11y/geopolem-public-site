# Evidencia editorial ampliada — isr-gaza-irn / causal "Crisis humanitaria y riesgo de escalada regional"

> Paquete revisable por humano (GEOPÓLEM Sprint 21). Resolución técnica de
> bloqueos con fuentes alternativas verificadas. NO aprueba ni habilita producción.

| Campo | Valor |
|-------|-------|
| Clave | `isr-gaza-irn::causal::Crisis humanitaria y riesgo de escalada regional` |
| Conflicto | `isr-gaza-irn` |
| Tipo de pendiente | `causal-link-pending` |
| Clasificación (RC) | `needs_human_review` |
| Estado anterior | `needs_human_review` |
| Estado nuevo | `evidence_ready` |
| Resolución | `resolved_via_alternative_source` |
| Gate que bloquea | `editorial-signoff` |

## Transición de estado

- `needs_human_review` → `evidence_ready` (cambiado: `true`, válida: `true`)
- evidencia alternativa verificada (2 fuente/s): needs_human_review→evidence_ready

## Razón de bloqueo (original)

El vínculo causal "Crisis humanitaria y riesgo de escalada regional" tiene fuente de contexto verificada, pero la afirmación causal concreta exige una fuente específica que la respalde. Aportarla es una decisión editorial humana; no es inventable.

## Fuentes alternativas verificadas

### OCHA: Humanitarian Situation Update #351 - Gaza Strip

- URL: <https://www.un.org/unispal/document/ocha-humanitarian-situation-update-351-gaza-strip/>
- Publisher: OCHA vía UN (un.org/unispal)
- Accessed at: `2026-07-07`
- Accessed via: `web-fetch`
- Resultado HTTP: `HTTP 200`
- Tipo de evidencia: `corroborating-institutional-mirror`
- Respalda: Respalda la parte 'crisis humanitaria' del vínculo (actualización humanitaria OCHA sobre Gaza), accesible en un.org.
- Pendiente de juicio humano: Contenido servido truncado; abrir la actualización para el dato exacto.
- Recomendación: Respalda el componente humanitario del vínculo causal.

### Live Updates: US-Israeli Attacks on Iran and Global Energy Impacts

- URL: <https://www.energypolicy.columbia.edu/us-israeli-attacks-on-iran-and-global-energy-impacts/>
- Publisher: Center on Global Energy Policy, Columbia University SIPA
- Accessed at: `2026-07-07`
- Accessed via: `web-fetch`
- Resultado HTTP: `HTTP 200`
- Tipo de evidencia: `supporting-analysis`
- Respalda: Vincula la escalada Israel–Irán con la restricción del Estrecho de Ormuz —punto de tránsito de ~20% del petróleo y GNL mundial— y las disrupciones de mercado energético. Respalda la parte 'riesgo de escalada regional' + chokepoint energético del vínculo.
- Pendiente de juicio humano: Un editor puede preferir una fuente institucional (IEA/UNCTAD) para el dato de tránsito; ambas estaban bloqueadas por fetch directo en este entorno (403), por lo que se usa CGEP (Columbia), accesible y de alta autoridad.
- Recomendación: Respalda el componente de escalada regional y chokepoint energético del vínculo causal.

## Decisión requerida (humano, sprint posterior)

Aportar la fuente que respalde específicamente el vínculo causal; luego approve/reject/defer.

Firmas esperadas: `reviewer`, `editor`, `owner`.
