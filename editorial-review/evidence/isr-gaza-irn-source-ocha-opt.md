# Evidencia editorial — isr-gaza-irn / fuente `ocha-opt`

> Paquete revisable por humano (GEOPÓLEM Sprint 20). Derivado sin inventar datos
> desde la cola RC y los artefactos de staging. NO habilita producción.

| Campo | Valor |
|-------|-------|
| Clave | `isr-gaza-irn::source::ocha-opt` |
| Conflicto | `isr-gaza-irn` |
| Tipo de pendiente | `source-review` |
| Clasificación (RC) | `blocked_by_source` |
| Estado de gobernanza | `blocked_by_source` |
| Gate que bloquea | `source-access` |

## Razón de bloqueo

Fuente ocha-opt accedida vía web-search; el fetch directo sigue bloqueado por el proxy externo, por lo que no es cerrable con el tooling disponible. Requiere revisor humano con acceso directo o fuente equivalente accesible. Evidencia Sprint 19: intento de acceso directo (web-fetch) → HTTP 403.

## Evidencia de acceso a la fuente

- Intento: `web-fetch`
- Resultado: `HTTP 403`
- Observado: unocha.org devolvió 403 Forbidden al fetch directo vía proxy (idéntico a Sprint 15/18).

## Fuentes disponibles

- `ocha-opt` — Occupied Palestinian Territory | OCHA — <https://www.unocha.org/occupied-palestinian-territory> — (verified)

## Acción recomendada

Reconfirmar la URL con acceso directo (fetch) o sustituir por una fuente equivalente accesible; luego retirar needs_human_review.

## Decisión requerida

Reconfirmar la URL con acceso directo o sustituir por fuente equivalente accesible; luego approve/reject.

Firmas esperadas: `reviewer`, `editor`, `owner`.
