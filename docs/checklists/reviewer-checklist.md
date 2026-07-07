# Checklist del REVIEWER (GEOPÓLEM — Sprint 23)

> **NO PRODUCTIVO.** Rellenar sólo en el material de decisión **no versionado**
> (`.editorial-decisions.json`). El tooling no firma por ti. Ningún check habilita
> producción (`PRODUCTION_PUBLISH_ENABLED=false`).

Responsabilidad del `reviewer`: verificar que la **evidencia existe, es pertinente
y las fuentes soportan la afirmación**. Repite la lista para cada uno de los 8 items.

## Por cada item (`item_id`)

- [ ] Localizo la ficha de evidencia en `editorial-review/sprint21/evidence/`.
- [ ] El estado del item es `evidence_ready` (único estado decidible).
- [ ] Cada fuente alternativa tiene `url`, `http_result` y `evidence_type` verificables.
- [ ] La(s) fuente(s) **soportan** realmente la afirmación (`supports` es correcto).
- [ ] No hay fuentes rotas, caducadas o irrelevantes.
- [ ] `evidence_manifest_hash` coincide con `npm --prefix api-server run decisions:hash`.
- [ ] `source_hashes` cubre **exactamente** las fuentes vigentes del item.
- [ ] Si la evidencia es insuficiente → `deferred` o `rejected` con motivo claro.

## Integridad y trazabilidad de mi firma

- [ ] `decision` refleja mi juicio real (`approved` / `rejected` / `deferred`).
- [ ] `rationale` es una justificación real (no un placeholder; ≥12 caracteres).
- [ ] `decided_by` contiene **mi identidad** (trazabilidad).
- [ ] `decided_by_role` = `reviewer`.
- [ ] `decided_at` es hoy (no anterior a la evidencia ni en el futuro).
- [ ] No incluyo secretos ni claves privadas en ningún campo.
- [ ] (Opcional) Firmo criptográficamente con **mi** clave privada (fuera del repo)
      y registro sólo mi clave pública.

## Límites

- [ ] Entiendo que mi `approved` **no** basta: un GO exige también `editor` + `owner`.
- [ ] Entiendo que **no** puedo firmar además como `editor` u `owner` (misma persona,
      varios roles = suplantación, prohibido salvo regla explícita).
