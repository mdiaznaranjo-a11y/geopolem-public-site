# Evidencia editorial — sahel / fuente `unhcr-sahel-emergency`

> Paquete revisable por humano (GEOPÓLEM Sprint 20). Derivado sin inventar datos
> desde la cola RC y los artefactos de staging. NO habilita producción.

| Campo | Valor |
|-------|-------|
| Clave | `sahel::source::unhcr-sahel-emergency` |
| Conflicto | `sahel` |
| Tipo de pendiente | `source-review` |
| Clasificación (RC) | `blocked_by_source` |
| Estado de gobernanza | `blocked_by_source` |
| Gate que bloquea | `source-access` |

## Razón de bloqueo

Fuente unhcr-sahel-emergency accedida vía web-search; el fetch directo sigue bloqueado por el proxy externo, por lo que no es cerrable con el tooling disponible. Requiere revisor humano con acceso directo o fuente equivalente accesible. Evidencia Sprint 19: intento de acceso directo (web-fetch) → HTTP 403.

## Evidencia de acceso a la fuente

- Intento: `web-fetch`
- Resultado: `HTTP 403`
- Observado: unhcr.org devolvió 403 Forbidden al fetch directo vía proxy (idéntico a Sprint 15/18).

## Fuentes disponibles

- `unhcr-sahel-emergency` — Sahel emergency — <https://www.unhcr.org/us/emergencies/sahel-emergency> — (verified)

## Acción recomendada

Reconfirmar la URL con acceso directo (fetch) o sustituir por una fuente equivalente accesible; luego retirar needs_human_review.

## Decisión requerida

Reconfirmar la URL con acceso directo o sustituir por fuente equivalente accesible; luego approve/reject.

Firmas esperadas: `reviewer`, `editor`, `owner`.
