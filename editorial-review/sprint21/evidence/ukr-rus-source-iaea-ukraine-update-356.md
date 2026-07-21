# Evidencia editorial ampliada — ukr-rus / fuente `iaea-ukraine-update-356`

> Paquete revisable por humano (GEOPÓLEM Sprint 21). Resolución técnica de
> bloqueos con fuentes alternativas verificadas. NO aprueba ni habilita producción.

| Campo | Valor |
|-------|-------|
| Clave | `ukr-rus::source::iaea-ukraine-update-356` |
| Conflicto | `ukr-rus` |
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

Fuente iaea-ukraine-update-356 accedida vía web-search; el fetch directo sigue bloqueado por el proxy externo, por lo que no es cerrable con el tooling disponible. Requiere revisor humano con acceso directo o fuente equivalente accesible. Evidencia Sprint 19: intento de acceso directo (web-fetch) → HTTP 402.

## Evidencia de acceso a la fuente original

- Intento: `web-fetch`
- Resultado: `HTTP 402`
- Observado: iaea.org devolvió 402 Payment Required al fetch directo vía proxy (idéntico a Sprint 15/18).

> Fuente original inaccesible corroborada/sustituida: `iaea-ukraine-update-356`.

## Fuentes alternativas verificadas

### Ukraine: IAEA engaging to get power restored at Zaporizhzhia Nuclear Power Plant

- URL: <https://news.un.org/en/story/2025/10/1166016>
- Publisher: UN News (United Nations)
- Accessed at: `2026-07-07`
- Accessed via: `web-fetch`
- Resultado HTTP: `HTTP 200`
- Tipo de evidencia: `corroborating-institutional-mirror`
- Respalda: Reproduce la declaración del Director General del OIEA (Grossi): la ZNPP perdió toda la energía externa el 23-sep-2025 (10ª vez desde 2022) y opera con generadores diésel de emergencia. Corrobora el contenido de la Update 356 del OIEA que estaba bloqueada por fetch directo.
- Pendiente de juicio humano: Un revisor con acceso directo puede reconfirmar la URL canónica del OIEA (Update 356) si se requiere la fuente primaria exacta; la fuente alternativa de la ONU corrobora el mismo hecho.
- Recomendación: Sustituir/corroborar la fuente inaccesible por la nota de UN News; suficiente para preparar la decisión editorial.

## Decisión requerida (humano, sprint posterior)

Reconfirmar la URL con acceso directo o sustituir por fuente equivalente accesible; luego approve/reject.

Firmas esperadas: `reviewer`, `editor`, `owner`.
