# Checklist final de producción — GATE HUMANO obligatorio

> **Este sprint NO publica.** Todos los ítems quedan `pending` y
> `production=false`. La habilitación de producción exige decisión humana
> explícita; ningún paso se automatiza sin aprobación.

- Ítems: **10** · bloqueantes: **8** · con gate humano: **9**

| id | dominio | ítem | gate humano | bloqueante | estado |
|---|---|---|---|---|---|
| human-signoff | gate | Sign-off humano explícito del cierre de serie y del desbloqueo de producción | sí | sí | pending |
| pr-chain-integrated | integration | Cadena de PRs #1–#30 integrada en orden, sin conflictos y CI verde | sí | sí | pending |
| no-production-flags | safety | Artefactos con production=false y sin secretos (verificado por validador no-production) | no | sí | pending |
| canonical-causal-complete | editorial | canonical con causal_links completos y cross-check canónico sin divergencias | sí | sí | pending |
| editorial-sources-verified | editorial | Fuentes/citas verificadas por editor humano; sin claims sin fuente en published | sí | sí | pending |
| security-review | security | Revisión de seguridad JWT/roles superada; secretos gestionados fuera del repo | sí | sí | pending |
| backups-dr | ops | Backups probados y restauración DR ensayada en staging | sí | sí | pending |
| observability-live | ops | Observabilidad y alertas conectadas a destino real y validadas | sí | no | pending |
| domain-api-db-cms | infra | Habilitación de dominio/API/DB/CMS aprobada explícitamente por humano | sí | sí | pending |
| social-channels | distribution | Conexión de redes sociales aprobada por humano con credenciales seguras | sí | no | pending |

