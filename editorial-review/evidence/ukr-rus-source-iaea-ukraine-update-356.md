# Evidencia editorial — ukr-rus / fuente `iaea-ukraine-update-356`

> Paquete revisable por humano (GEOPÓLEM Sprint 20). Derivado sin inventar datos
> desde la cola RC y los artefactos de staging. NO habilita producción.

| Campo | Valor |
|-------|-------|
| Clave | `ukr-rus::source::iaea-ukraine-update-356` |
| Conflicto | `ukr-rus` |
| Tipo de pendiente | `source-review` |
| Clasificación (RC) | `blocked_by_source` |
| Estado de gobernanza | `blocked_by_source` |
| Gate que bloquea | `source-access` |

## Razón de bloqueo

Fuente iaea-ukraine-update-356 accedida vía web-search; el fetch directo sigue bloqueado por el proxy externo, por lo que no es cerrable con el tooling disponible. Requiere revisor humano con acceso directo o fuente equivalente accesible. Evidencia Sprint 19: intento de acceso directo (web-fetch) → HTTP 402.

## Evidencia de acceso a la fuente

- Intento: `web-fetch`
- Resultado: `HTTP 402`
- Observado: iaea.org devolvió 402 Payment Required al fetch directo vía proxy (idéntico a Sprint 15/18).

## Fuentes disponibles

- `iaea-ukraine-update-356` — Update 356 – IAEA Director General Statement on Situation in Ukraine — <https://www.iaea.org/newscenter/pressreleases/update-356-iaea-director-general-statement-on-situation-in-ukraine> — (verified)

## Acción recomendada

Reconfirmar la URL con acceso directo (fetch) o sustituir por una fuente equivalente accesible; luego retirar needs_human_review.

## Decisión requerida

Reconfirmar la URL con acceso directo o sustituir por fuente equivalente accesible; luego approve/reject.

Firmas esperadas: `reviewer`, `editor`, `owner`.
