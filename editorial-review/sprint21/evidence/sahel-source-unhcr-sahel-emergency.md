# Evidencia editorial ampliada — sahel / fuente `unhcr-sahel-emergency`

> Paquete revisable por humano (GEOPÓLEM Sprint 21). Resolución técnica de
> bloqueos con fuentes alternativas verificadas. NO aprueba ni habilita producción.

| Campo | Valor |
|-------|-------|
| Clave | `sahel::source::unhcr-sahel-emergency` |
| Conflicto | `sahel` |
| Tipo de pendiente | `source-review` |
| Clasificación (RC) | `blocked_by_source` |
| Estado anterior | `blocked_by_source` |
| Estado nuevo | `evidence_ready` |
| Resolución | `resolved_via_alternative_source` |
| Gate que bloquea | `source-access` |

## Transición de estado

- `blocked_by_source` → `evidence_ready` (cambiado: `true`, válida: `true`)
- evidencia alternativa verificada (1 fuente/s): blocked_by_source→evidence_ready

## Razón de bloqueo (original)

Fuente unhcr-sahel-emergency accedida vía web-search; el fetch directo sigue bloqueado por el proxy externo, por lo que no es cerrable con el tooling disponible. Requiere revisor humano con acceso directo o fuente equivalente accesible. Evidencia Sprint 19: intento de acceso directo (web-fetch) → HTTP 403.

## Evidencia de acceso a la fuente original

- Intento: `web-fetch`
- Resultado: `HTTP 403`
- Observado: unhcr.org devolvió 403 Forbidden al fetch directo vía proxy (idéntico a Sprint 15/18).

> Fuente original inaccesible corroborada/sustituida: `unhcr-sahel-emergency`.

## Fuentes alternativas verificadas

### In Africa's Sahel, conflict and climate change force millions from their homes

- URL: <https://news.un.org/en/story/2025/10/1166076>
- Publisher: UN News (United Nations)
- Accessed at: `2026-07-07`
- Accessed via: `web-fetch`
- Resultado HTTP: `HTTP 200`
- Tipo de evidencia: `corroborating-institutional`
- Respalda: Reproduce las cifras de ACNUR (UNHCR): ~4 millones de desplazados en el Sahel, llamamiento 2025 de 409,7 M USD financiado al 32%, y cita al Director Regional de ACNUR Abdouraouf Gnon-Kondé. Corrobora la 'Sahel emergency' de ACNUR cuyo fetch directo sigue bloqueado (403).
- Pendiente de juicio humano: La página de emergencia de ACNUR (unhcr.org) es la fuente primaria; la nota de la ONU la corrobora con las mismas cifras.
- Recomendación: Sustituir/corroborar la fuente inaccesible por la nota de UN News; suficiente para preparar la decisión editorial.

## Decisión requerida (humano, sprint posterior)

Reconfirmar la URL con acceso directo o sustituir por fuente equivalente accesible; luego approve/reject.

Firmas esperadas: `reviewer`, `editor`, `owner`.
