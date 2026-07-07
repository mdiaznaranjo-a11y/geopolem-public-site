# Matriz de riesgos abierta — Cierre maestro GEOPÓLEM

> Riesgos = hechos del proyecto declarados, enriquecidos con señales en
> vivo. No se inventan fuentes ni aprobaciones. Producción bloqueada.

- Riesgos: **11** · abiertos: **8**

| id | riesgo | sev. | prob. | owner sugerido | estado |
|---|---|---|---|---|---|
| pr-chain-open | Cadena de PRs #1–#30 abierta y dependiente | high | high | maintainer | open |
| production-blocked | Producción bloqueada por diseño (sin gates, sin secretos) | info | certain | maintainer | by_design |
| canonical-causal-links | canonical sin causal_links completos → cross-check usa rc por defecto | high | high | editorial-lead | open |
| i18n-incomplete | i18n incompleta más allá de los namespaces clave | medium | medium | education-lead | partial |
| human-curation | Curaduría humana pendiente de la cola editorial causal | medium | medium | editorial-lead | open |
| scorm-real-vs-portable | SCORM real vs mapping portable (SCORM diferido) | low | low | education-lead | deferred |
| editorial-sources-citations | Fuentes/citas editoriales requieren verificación humana | high | medium | editorial-lead | open |
| security-jwt-roles | Seguridad JWT/roles pendiente de revisión previa a producción | high | medium | platform-lead | open |
| backups-dr | Backups y recuperación ante desastres (DR) no verificados | high | medium | platform-lead | open |
| observability | Observabilidad: métricas/alertas requieren destino real en producción | medium | medium | platform-lead | open |
| social-not-connected | Redes sociales no conectadas automáticamente sin aprobación | medium | low | editorial-lead | open |

## Mitigación y criterio de cierre

### pr-chain-open — Cadena de PRs #1–#30 abierta y dependiente
- Mitigación: Integrar en orden de dependencia con rebase/retarget y --check tras cada merge (ver plan de integración).
- Criterio de cierre: Todos los PRs integrados en orden, CI verde, sin conflictos pendientes.
- Estado: **open**

### production-blocked — Producción bloqueada por diseño (sin gates, sin secretos)
- Mitigación: Mantener production=false; habilitar sólo tras GATE HUMANO del checklist final.
- Criterio de cierre: Decisión humana explícita de desbloqueo con checklist de producción superado.
- Estado: **by_design**

### canonical-causal-links — canonical sin causal_links completos → cross-check usa rc por defecto
- Mitigación: Poblar causal_links en canonical antes de promover. En canonical 0 not_applicable / 10 conflictos, 0 checked.
- Criterio de cierre: canonical con causal_links poblados y cross-check en stage=canonical sin divergencias.
- Estado: **open**

### i18n-incomplete — i18n incompleta más allá de los namespaces clave
- Mitigación: Cobertura 100% en namespaces definidos; ampliar reusando el validador escalable.
- Criterio de cierre: Todos los materiales docentes traducidos ES/EN con validador --check verde.
- Estado: **partial**

### human-curation — Curaduría humana pendiente de la cola editorial causal
- Mitigación: 11 ítem(s) en la cola (0 bloqueante) requieren revisión humana; no automatizable.
- Criterio de cierre: Cola editorial causal resuelta o aceptada con sign-off humano.
- Estado: **open**

### scorm-real-vs-portable — SCORM real vs mapping portable (SCORM diferido)
- Mitigación: ADR-0001 decide "portable-mapping"; el empaquetado SCORM real queda diferido.
- Criterio de cierre: Necesidad de SCORM real confirmada por un LMS objetivo y empaquetado validado, o cierre del ADR.
- Estado: **deferred**

### editorial-sources-citations — Fuentes/citas editoriales requieren verificación humana
- Mitigación: Regla published-exige-fuente y causal_links-exigen-fuente ya en CI; la veracidad de cada fuente exige revisión humana. No se inventan fuentes.
- Criterio de cierre: Fuentes verificadas por editor humano y trazables; sin claims sin fuente en published.
- Estado: **open**

### security-jwt-roles — Seguridad JWT/roles pendiente de revisión previa a producción
- Mitigación: JWT/roles implementados y testeados sin DB; rotación de claves y scopes cubiertos por tests. Revisión de seguridad formal fuera de este repo antes de exponer.
- Criterio de cierre: Auditoría de seguridad superada; secretos gestionados fuera del repo; rotación operativa.
- Estado: **open**

### backups-dr — Backups y recuperación ante desastres (DR) no verificados
- Mitigación: Plan de rollback canónico y export estático versionado existen; backups de DB/DR reales dependen de infraestructura fuera del repo.
- Criterio de cierre: Backups automáticos probados y restauración DR ensayada en staging.
- Estado: **open**

### observability — Observabilidad: métricas/alertas requieren destino real en producción
- Mitigación: Observabilidad y alertas implementadas en api-server (Sprint 5/7); en producción requieren sink/alerting configurados con aprobación.
- Criterio de cierre: Dashboards y alertas conectados a un destino real y validados.
- Estado: **open**

### social-not-connected — Redes sociales no conectadas automáticamente sin aprobación
- Mitigación: Ningún artefacto publica en redes; la conexión multicanal exige aprobación humana explícita y credenciales gestionadas fuera del repo.
- Criterio de cierre: Aprobación humana + credenciales seguras + prueba controlada antes de automatizar.
- Estado: **open**

