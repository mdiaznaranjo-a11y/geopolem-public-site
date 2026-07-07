# Preparación del cierre maestro — Sprint 30 (Sprint 29)

> **PREPARA, no ejecuta.** No cierra la serie de sprints 3–30 ni activa
> producción. Estados derivados de señales en vivo deterministas; los
> riesgos son hechos del proyecto declarados explícitamente.

- Serie: **sprints 3–30** sobre `main`
- Ítems de checklist: **9** · bloqueantes: **0**
- Riesgos: **7** (abiertos: **4**)
- ¿Listo para cierre (sin bloqueantes)?: **sí**

## Checklist de cierre

| id | área | ítem | estado | bloqueante |
|---|---|---|---|---|
| tech-tests-green | technical | Suite educativa (Sprint 24–29) en verde y artefactos --check al día | pending | no |
| tech-production-blocked | technical | Producción permanece BLOQUEADA (sin gates, sin secretos) | by_design | no |
| tech-reversible-arch | technical | Arquitectura reversible API real v1 → JSON estático → fallback intacta | done | no |
| edu-i18n-coverage | educational | Cobertura i18n ES/EN de paquetes clave al 100 % en los namespaces definidos | done | no |
| edu-dashboard | educational | Panel docente agregado no individualizado disponible y al día | done | no |
| edu-scorm-decision | educational | Decisión SCORM vs mapping portable registrada (ADR-0001) | done | no |
| ed-causal-queue | editorial | Cola editorial causal normalizada, estable y sin ítems bloqueantes | pending | no |
| ed-causal-divergence | editorial | Cross-check causal ampliado (rc) sin divergencias de severidad error | done | no |
| ed-human-signoff | editorial | Sign-off editorial humano del cierre de la serie (3–30) | pending | no |

### Notas del checklist

- **tech-tests-green**: Verificar en CI que todos los checks educativos pasan antes del cierre.
- **tech-production-blocked**: Estado intencional de toda la serie; el cierre NO habilita producción.
- **tech-reversible-arch**: La capa educativa sólo consume artefactos versionados; no altera web/PWA/mapa/rutas.
- **edu-i18n-coverage**: Cobertura 100% sobre namespaces: glossary, feedback, instructor_guide, syllabus, dashboard. Faltan materiales no incluidos aún (ver riesgo i18n-incomplete).
- **edu-dashboard**: Panel agregado sin PII ni tracking individual; verificado con --check.
- **edu-scorm-decision**: SCORM real queda diferido; se mantiene mapping portable (ver riesgo scorm-real).
- **ed-causal-queue**: 11 ítem(s) abiertos, 0 bloqueante(s). Requiere curaduría humana (ver riesgo human-curation).
- **ed-causal-divergence**: 0 divergencia(s) en rc; 0 pendiente(s) de matriz.
- **ed-human-signoff**: Acción humana fuera del alcance automatizable; debe ejecutarse en Sprint 30.

## Registro de riesgos abiertos

| id | riesgo | severidad | estado |
|---|---|---|---|
| pr-chain | Cadena de PRs dependientes de la serie de sprints | medium | open |
| pr28-vs-main | PR #28 pendiente de integración contra main | medium | open |
| production-blocked | Producción bloqueada por diseño en toda la serie | info | by_design |
| canonical-causal-links | canonical carece de causal_links → el cross-check usa rc por defecto | high | open |
| scorm-real | SCORM real vs mapping portable (SCORM diferido) | low | deferred |
| i18n-incomplete | i18n incompleta más allá de los namespaces clave | medium | partial |
| human-curation | Curaduría humana pendiente de la cola editorial causal | medium | open |

### Mitigaciones

- **pr-chain**: Ordenar y fusionar los PRs por dependencia antes del cierre maestro; documentar el orden en Sprint 30.
- **pr28-vs-main**: Confirmar el estado de PR #28 (base del Sprint 29) y su fusión a main como paso previo al cierre.
- **production-blocked**: El cierre NO debe habilitar producción; mantener gates desactivados y sin secretos.
- **canonical-causal-links**: Riesgo heredado del Sprint 28. En canonical 0/10 conflictos quedan sin datos causales (not_applicable) y sólo 0 checked; por eso el barrido ampliado y la cola usan stage=rc. Poblar causal_links en canonical antes de promover.
- **scorm-real**: ADR-0001 decide "portable-mapping". El empaquetado SCORM real queda diferido; el mapping portable es suficiente para la serie.
- **i18n-incomplete**: Cobertura 100% en los namespaces definidos (glossary, feedback, instructor_guide, syllabus, dashboard), pero no todos los materiales docentes están traducidos. Ampliar namespaces en futuros sprints reusando el validador escalable.
- **human-curation**: 11 ítem(s) en la cola requieren revisión editorial/datos humana; no automatizable. Resolver o aceptar antes del cierre.

