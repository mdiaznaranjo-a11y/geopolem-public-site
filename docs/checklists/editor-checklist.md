# Checklist del EDITOR (GEOPÓLEM — Sprint 23)

> **NO PRODUCTIVO.** Rellenar sólo en el material de decisión **no versionado**
> (`.editorial-decisions.json`). El tooling no firma por ti. Ningún check habilita
> producción (`PRODUCTION_PUBLISH_ENABLED=false`).

Responsabilidad del `editor`: decidir **editorialmente** que el contenido es
coherente con la línea del producto, **de forma independiente** del reviewer.
Repite la lista para cada uno de los 8 items.

## Por cada item (`item_id`)

- [ ] He leído la ficha de evidencia y (si existe) la firma del `reviewer`.
- [ ] Mi decisión es **independiente**: no me limito a copiar al reviewer.
- [ ] El encuadre editorial es correcto (tono, alcance, contexto geopolítico).
- [ ] La afirmación es proporcional a la evidencia (ni exagera ni minimiza).
- [ ] No hay conflictos con otras piezas publicadas o en cola.
- [ ] Si el encuadre necesita ajustes → `deferred` con condiciones en `optional_conditions`.
- [ ] `evidence_manifest_hash` y `source_hashes` coinciden con la evidencia vigente.

## Integridad y trazabilidad de mi firma

- [ ] `decision` refleja mi juicio editorial real.
- [ ] `rationale` es una justificación real (≥12 caracteres).
- [ ] `decided_by` contiene **mi identidad** (distinta del reviewer y del owner).
- [ ] `decided_by_role` = `editor`.
- [ ] `decided_at` es vigente (no anterior a la evidencia ni en el futuro).
- [ ] No incluyo secretos ni claves privadas.
- [ ] (Opcional) Firma criptográfica con mi clave privada (fuera del repo).

## Límites

- [ ] Un GO exige las 3 firmas; mi `approved` es necesario pero no suficiente.
- [ ] No puedo firmar además como `reviewer` u `owner` (una persona = un rol).
