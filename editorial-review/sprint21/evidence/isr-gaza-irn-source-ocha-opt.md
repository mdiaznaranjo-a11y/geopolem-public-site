# Evidencia editorial ampliada — isr-gaza-irn / fuente `ocha-opt`

> Paquete revisable por humano (GEOPÓLEM Sprint 21). Resolución técnica de
> bloqueos con fuentes alternativas verificadas. NO aprueba ni habilita producción.

| Campo | Valor |
|-------|-------|
| Clave | `isr-gaza-irn::source::ocha-opt` |
| Conflicto | `isr-gaza-irn` |
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

Fuente ocha-opt accedida vía web-search; el fetch directo sigue bloqueado por el proxy externo, por lo que no es cerrable con el tooling disponible. Requiere revisor humano con acceso directo o fuente equivalente accesible. Evidencia Sprint 19: intento de acceso directo (web-fetch) → HTTP 403.

## Evidencia de acceso a la fuente original

- Intento: `web-fetch`
- Resultado: `HTTP 403`
- Observado: unocha.org devolvió 403 Forbidden al fetch directo vía proxy (idéntico a Sprint 15/18).

> Fuente original inaccesible corroborada/sustituida: `ocha-opt`.

## Fuentes alternativas verificadas

### OCHA: Humanitarian Situation Update #351 - Gaza Strip

- URL: <https://www.un.org/unispal/document/ocha-humanitarian-situation-update-351-gaza-strip/>
- Publisher: OCHA vía UN (un.org/unispal — Question of Palestine)
- Accessed at: `2026-07-07`
- Accessed via: `web-fetch`
- Resultado HTTP: `HTTP 200`
- Tipo de evidencia: `corroborating-institutional-mirror`
- Respalda: El dominio un.org (accesible) aloja las actualizaciones humanitarias de OCHA sobre Gaza. Corrobora la existencia y autoría OCHA de la fuente ocha-opt cuyo fetch directo en unocha.org sigue bloqueado (403).
- Pendiente de juicio humano: El contenido detallado se sirvió truncado; un editor puede abrir la actualización específica para el dato humanitario exacto que quiera citar.
- Recomendación: Sustituir/corroborar la fuente inaccesible por el mirror en un.org; suficiente para preparar la decisión editorial.

## Decisión requerida (humano, sprint posterior)

Reconfirmar la URL con acceso directo o sustituir por fuente equivalente accesible; luego approve/reject.

Firmas esperadas: `reviewer`, `editor`, `owner`.
