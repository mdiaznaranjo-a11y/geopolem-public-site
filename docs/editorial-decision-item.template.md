# Hoja de trabajo por item — decisión editorial (GEOPÓLEM — Sprint 23)

> **NO PRODUCTIVO / PLANTILLA VACÍA.** Copia esta hoja por cada uno de los 8
> items en tu material **no versionado**. No la rellenes en el repositorio ni la
> versiones con decisiones reales. No habilita producción.

---

- **item_id:** `___________________________________________`
- **conflicto / tipo:** `_______________ / (causal | source)`
- **estado de partida:** `evidence_ready`
- **evidence_manifest_hash vigente:** `sha256:__________` (de `decisions:hash`)

## Evidencia revisada

| slug de fuente | url | http_result | ¿soporta? | source_hash coincide |
|----------------|-----|-------------|-----------|----------------------|
| `__________`   | ``  | ``          | sí / no   | sí / no              |

## Decisión por rol (una firma por rol; personas distintas)

| Rol | Identidad (`decided_by`) | Decisión | Rationale (≥12) | Fecha | Firma cripto (opc.) |
|-----|--------------------------|----------|-----------------|-------|---------------------|
| reviewer | `__________` | approved / rejected / deferred | `__________` | `YYYY-MM-DD` | key_id: `______` |
| editor   | `__________` | approved / rejected / deferred | `__________` | `YYYY-MM-DD` | key_id: `______` |
| owner    | `__________` | approved / rejected / deferred | `__________` | `YYYY-MM-DD` | key_id: `______` |

## Condiciones / salvedades (`optional_conditions`)

- `__________________________________________________`

## Resultado del item

- [ ] **GO** — las 3 firmas `approved`, integridad de hash correcta, identidades distintas.
- [ ] **NO-GO** — `rejected` / `deferred` / firmas incompletas.

> Recordatorio: un GO de item **no** publica. La publicación real permanece
> deshabilitada por política en este sprint.
