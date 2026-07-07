# Paquete de revisión de instructor (Sprint 27)

> Material de **formación**. No sustituye la revisión editorial final, no activa
> producción y no maneja datos personales. Toda evaluación procesada es
> **anónima y sintética**.

Esta guía acompaña al instructor/a en la revisión de las evaluaciones producidas
con las rúbricas máquina-legibles (`docs/education/rubrics/`) y el motor de
puntuación del Sprint 26 (`scripts/score-rubric.mjs`, `scripts/score-rubric-batch.mjs`).

## Propósito

- Estandarizar cómo un instructor **revisa, acepta o rechaza** una evaluación.
- Conectar la puntuación automática con el **juicio pedagógico humano**.
- Garantizar que ninguna evaluación contenga **datos personales** (PII).
- Mantener la trazabilidad hacia el **banco de casos** y la **validación causal**.

## Componentes

| Documento | Uso |
|---|---|
| [`checklist-instructor.md`](checklist-instructor.md) | Lista de verificación previa a aceptar una evaluación. |
| [`flujo-sesion.md`](flujo-sesion.md) | Flujo recomendado antes / durante / después de una sesión. |
| [`criterios-aceptacion.md`](criterios-aceptacion.md) | Criterios objetivos para aceptar, rechazar o diferir. |
| [`instructor-review.manifest.json`](instructor-review.manifest.json) | Manifiesto máquina-legible del paquete (validable en CI). |

## Alineación

- **Rúbricas**: cada revisión se ancla en una rúbrica de `rubrics.index.json`
  (dimensión, criterios, niveles `insuficiente…excelente`).
- **Banco de casos**: la evidencia analizada procede de casos reales del banco
  (`docs/education/case-bank/`), derivados del contrato v1 (RC).
- **Validación causal**: las observaciones sobre matrices se apoyan en el
  backlog causal (`docs/education/causal-backlog/`), nunca en datos inventados.

## Garantías

- No se persiste ninguna nota real ni identidad de estudiante.
- La entrada del motor se **rechaza** si contiene claves con aspecto de PII.
- Arquitectura reversible intacta: API v1 → JSON estático → fallback local.
