# Checklist del OWNER (GEOPÓLEM — Sprint 23)

> **NO PRODUCTIVO.** Rellenar sólo en el material de decisión **no versionado**
> (`.editorial-decisions.json`). El tooling no firma por ti. Ningún check habilita
> producción (`PRODUCTION_PUBLISH_ENABLED=false`).

Responsabilidad del `owner`: autoridad **final** del producto. Su firma
`approved` es obligatoria para cualquier GO de item. Repite la lista para los 8 items.

## Por cada item (`item_id`)

- [ ] Existen las firmas independientes de `reviewer` y `editor`.
- [ ] Reviewer y editor son **personas distintas** (sin suplantación de roles).
- [ ] No hay riesgos legales/reputacionales sin mitigar.
- [ ] Las `optional_conditions` del editor (si las hay) son aceptables o resueltas.
- [ ] La evidencia sigue vigente (hashes coinciden; no obsoleta).
- [ ] En caso de duda razonable → `deferred`; ante impedimento → `rejected`.

## Integridad y trazabilidad de mi firma

- [ ] `decision` es mi decisión final (`approved` sólo si todo lo anterior se cumple).
- [ ] `rationale` es una justificación real (≥12 caracteres).
- [ ] `decided_by` contiene **mi identidad** (distinta de reviewer y editor).
- [ ] `decided_by_role` = `owner`.
- [ ] `decided_at` es vigente.
- [ ] No incluyo secretos ni claves privadas.
- [ ] (Opcional) Firma criptográfica con mi clave privada (fuera del repo).

## Gate de producción (límite crítico)

- [ ] Entiendo que un GO 8/8 firmado **NO** publica: el gate exige además sign-off
      editorial (Sprint 20) y segunda confirmación no-CI (Sprint 18).
- [ ] Entiendo que, aun con todo lo anterior, `PRODUCTION_PUBLISH_ENABLED=false`
      mantiene el gate **cerrado** en este sprint. Habilitar producción es una
      decisión explícita, documentada y de un sprint futuro.
- [ ] He revisado `api/v1/rc/production-gate.sprint23.json` y confirmo
      `production_enabled:false`.
