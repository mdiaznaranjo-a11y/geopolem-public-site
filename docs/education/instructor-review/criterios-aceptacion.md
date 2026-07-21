# Criterios para aceptar, rechazar o diferir una evaluación

> Decisión pedagógica humana apoyada en la puntuación automática.
> Material de formación: sin producción ni datos personales.

Cada evaluación revisada termina en uno de tres estados. La puntuación es una
**ayuda**, no una sentencia: el instructor decide.

## Aceptar

Se acepta cuando **todas** estas condiciones se cumplen:

- La evaluación es anónima y el motor no reportó PII.
- La rúbrica y los niveles son válidos (sin criterios faltantes/desconocidos).
- La banda global es coherente con la evidencia observada.
- Las afirmaciones causales coinciden con la fuente (sin errores en el backlog).

## Rechazar

Se rechaza (y se descarta el contenido) cuando **alguna** condición se da:

- Contiene datos personales o cualquier identificador (rechazo automático + humano).
- Referencia una rúbrica inexistente o niveles inválidos irreparables.
- Afirma enlaces causales que **contradicen** la fuente verificada
  (divergencia de severidad `error` en el backlog causal).
- Incluye activación de producción o secretos.

## Diferir

Se difiere (revisión posterior, estado `pendiente`) cuando:

- El caso tiene campos `pending` relevantes aún sin evidencia.
- Existe una advertencia (`warning`) causal no resuelta pero no contradictoria.
- Falta contexto para juzgar la coherencia pedagógica.

## Trazabilidad

| Estado | Acción registrada | Dónde |
|---|---|---|
| Aceptar | feedback docente generado | `feedback-templates/` |
| Rechazar | motivo (PII / causal `error` / producción) | nota del instructor |
| Diferir | observación con estado `pendiente` | `causal-backlog/backlog.md` |

Ninguna de estas acciones persiste notas reales ni identidades.
