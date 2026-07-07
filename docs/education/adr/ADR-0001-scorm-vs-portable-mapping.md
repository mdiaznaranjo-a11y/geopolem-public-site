---
id: ADR-0001
title: SCORM real vs mapping portable xAPI/SCORM
status: accepted
date: 2026-07-07
sprint: 28
decision: portable-mapping
production: { is_production: false, activates_production_gate: false, contains_secrets: false }
---

# ADR-0001 — Empaquetado SCORM real vs mapping portable xAPI/SCORM

## Estado

**Aceptada** (Sprint 28). Decisión: **mantener el mapping portable** xAPI/SCORM
como mecanismo canónico de interoperabilidad LMS y **preparar un adaptador
futuro opcional**, en lugar de generar paquetes SCORM cerrados ahora.

## Contexto

GEOPÓLEM publica materiales docentes (módulos, casos, rúbricas) descritos por un
manifiesto LMS portable (`docs/education/lms-export/lms.manifest.json`) y un
mapeo conceptual opcional hacia xAPI y elementos CMI de SCORM
(`docs/education/xapi-scorm-mapping/mapping.json`, Sprint 27).

La pregunta técnica es si el proyecto debe **generar paquetes SCORM reales**
(un ZIP con `imsmanifest.xml`, esquemas XSD y recursos empaquetados) para
importarlos directamente en un LMS, o **mantener el mapa portable** que cada
institución implementa en su plataforma.

Restricciones del proyecto que condicionan la decisión:

- Producción sigue **bloqueada**: nada debe activar gates de producción.
- Arquitectura **reversible**: API real v1 → JSON estático → fallback local.
- **Sin dependencias propietarias** ni librerías pesadas injustificadas.
- **Sin datos personales**: la identidad del actor es anónima/sintética.
- Los artefactos deben ser **deterministas y validables** en CI, sin navegador
  ni servicios externos.

## Opciones consideradas

### Opción A — Generar SCORM real (paquete cerrado)

Construir un empaquetador que produzca un ZIP SCORM 1.2/2004 con
`imsmanifest.xml`, esquemas de control de secuencia y recursos.

- **Pros**: importación directa "un clic" en LMS que soportan SCORM; formato
  reconocido en contextos académicos tradicionales.
- **Contras**:
  - Ata el material a un empaquetador y a supuestos de plataforma (versión
    SCORM, perfil de secuencia), rompiendo la portabilidad.
  - Introduce complejidad de build (XML/XSD, ZIP determinista) y probable
    dependencia de librerías pesadas → contra las restricciones del proyecto.
  - Los paquetes cerrados son difíciles de validar en CI de forma determinista.
  - SCORM está en declive frente a xAPI/LRS; invertir en empaquetado cerrado es
    deuda técnica orientada a un formato heredado.

### Opción B — Mantener el mapping portable (elegida)

Publicar y validar el **mapa** conceptual (LMS manifest ↔ xAPI ↔ CMI SCORM). Cada
institución lo implementa en su LMS/LRS (Moodle, Canvas, un LRS xAPI…).

- **Pros**:
  - Portabilidad total y **cero dependencia propietaria**.
  - Coherente con la arquitectura reversible y con los datos canónicos (no
    duplica ni reempaqueta el contenido geopolítico).
  - Determinista y **validable en CI** (`education:xapi`), sin navegador.
  - Preserva la política de **identidad anónima**.
- **Contras**:
  - Requiere que la institución realice el último tramo de integración.
  - No ofrece importación "un clic" para LMS estrictamente SCORM.

### Opción C — Preparar un adaptador futuro opcional

Documentar un **contrato de adaptador** (fuera del núcleo) que, si en el futuro
alguna institución lo necesita, transforme el mapa portable en un paquete SCORM.
No se implementa ahora; se deja el punto de extensión definido.

- **Pros**: mantiene la puerta abierta sin asumir el coste ni el riesgo hoy.
- **Contras**: es sólo diseño; no aporta capacidad inmediata.

## Decisión

Se adopta la **Opción B** como mecanismo canónico y se reconoce la **Opción C**
como evolución futura. **No** se implementa la Opción A.

Criterios que sustentan la decisión:

| Criterio | SCORM real | Mapping portable |
|---|---|---|
| Seguridad (sin secretos, sin PII) | riesgo de acoplar identidad a CMI | anónimo por diseño |
| Portabilidad | baja (atado a versión/perfil) | alta (cualquier LMS/LRS) |
| Mantenimiento | alto (XML/XSD/ZIP, libs pesadas) | bajo (JSON validable) |
| Uso académico | importación directa en LMS SCORM | requiere integración institucional |
| Dependencia propietaria | probable | ninguna |
| Validable en CI (sin navegador) | difícil | sí (`education:xapi`) |

El mapping portable gana en cinco de seis criterios; el único punto a favor de
SCORM real (importación directa) se mitiga con el adaptador futuro de la Opción C.

## Consecuencias

- El mapa portable (`mapping.json`) sigue siendo la fuente canónica de
  interoperabilidad y se valida en CI.
- Si se implementa el adaptador (Opción C), **debe** ser opcional, no
  propietario, determinista y no añadir librerías pesadas sin justificación.
- Cualquier futuro paquete SCORM **no** debe incorporar datos personales ni
  activar gates de producción.

## Referencias

- `docs/education/xapi-scorm-mapping/mapping.json`
- `docs/education/xapi-scorm-mapping/README.md`
- `docs/education/lms-export/lms.manifest.json`
- `scripts/xapi-scorm-mapping.mjs` (validador del mapa portable)
