# Plantilla de decisión editorial humana (GEOPÓLEM — Sprint 22)

> **NO PRODUCTIVO.** Este documento describe cómo un humano aprueba, rechaza o
> difiere los 8 paquetes `evidence_ready` que dejó el Sprint 21. Ni la plantilla
> ni el ejemplo versionado habilitan producción. La publicación real permanece
> **DESHABILITADA por política** (`PRODUCTION_PUBLISH_ENABLED=false`). El tooling
> **nunca firma por un humano**: sólo valida firmas declaradas y calcula el
> veredicto GO/NO-GO.

## 1. Qué se decide

El Sprint 21 llevó los 8 pendientes del Release Candidate a `evidence_ready`
(evidencia alternativa verificada, sin aprobar nada). El Sprint 22 formaliza la
**decisión humana** sobre cada uno:

```
evidence_ready ─▶ approved   (GO del item; exige reviewer + editor + owner)
               ├▶ rejected   (NO-GO; terminal; ≥1 firma de rol requerido)
               └▶ deferred   (NO-GO; pospuesto; ≥1 firma de rol requerido)
```

Sólo `approved` cuenta como **GO** de un item. `rejected`/`deferred` son
decisiones tomadas y auditables, pero el contenido no entra en este ciclo.

## 2. Modelo de decisión (por firma de rol)

Cada entrada del set de decisiones es la **firma de UN rol sobre UN item**:

| Campo | Descripción |
|-------|-------------|
| `item_id` | Clave del pendiente (la misma del manifiesto de evidencia). |
| `decision` | `approved` \| `rejected` \| `deferred`. |
| `rationale` | Justificación **no vacía** de la decisión. |
| `decided_by_role` | `reviewer` \| `editor` \| `owner`. |
| `decided_at` | Fecha `YYYY-MM-DD`. |
| `evidence_manifest_hash` | Hash de la evidencia vigente contra la que se decidió. |
| `source_hashes` | Mapa `slug → sha256` de las fuentes revisadas del item. |
| `optional_conditions` | Lista opcional de condiciones/salvedades. |

### Reglas de roles

| Rol | Responsabilidad |
|-----|-----------------|
| `reviewer` | Verifica la evidencia. |
| `editor` | Decide editorialmente. |
| `owner` | Autoridad final del producto. |

- **APPROVED final** exige las **3 firmas** (`reviewer` + `editor` + `owner`),
  todas con `decision: approved` y con `owner` presente ("owner final").
- **REJECTED/DEFERRED final** es terminal con **una** firma válida de rol
  requerido (cualquier rol puede vetar/posponer, con justificación).
- Un mismo rol **no** puede firmar dos veces el mismo item (rol duplicado → inválido).
- Una aprobación con firmas incompletas **no** cuenta: el item sigue `evidence_ready`.

## 3. Integridad: no aprobar evidencia obsoleta

Cada firma queda **ligada por hash** a la evidencia que el humano revisó:

- `evidence_manifest_hash` debe coincidir con el hash del manifiesto vigente.
- `source_hashes` debe cubrir **exactamente** las fuentes vigentes del item y
  coincidir con su hash.

Si la evidencia se regenera y cambia, el hash cambia y las firmas previas quedan
**OBSOLETAS**: dejan de contar hasta re-firmar sobre la evidencia nueva. Así se
evita aprobar evidencia rancia o alterada.

Obtén el hash vigente con:

```bash
npm run decisions:hash
```

## 4. Cómo decidir (no productivo)

1. Revisa la evidencia de cada pendiente:
   - Índice: `editorial-review/sprint21/manifest.json`
   - Fichas: `editorial-review/sprint21/evidence/*.md`

2. Copia el ejemplo versionado a un archivo **NO versionado**:

   ```bash
   cp .editorial-decisions.example.json .editorial-decisions.json
   ```

3. En `.editorial-decisions.json`:
   - Cambia `is_example` a `false` (un ejemplo **nunca** cuenta como decisión real).
   - Sustituye cada `rationale` por la justificación real de cada rol.
   - Ajusta la `decision` de cada firma (`approved` | `rejected` | `deferred`).
   - Confirma que `evidence_manifest_hash` y cada `source_hashes` coinciden con
     `npm run decisions:hash` y el manifiesto vigente.
   - **No** incluyas secretos (tokens/claves): el validador los rechaza.

   Alternativamente, exporta `GEOP_EDITORIAL_DECISIONS` con el mismo JSON en una
   sola variable de entorno (no en CI).

4. Evalúa el GO/NO-GO con las decisiones resueltas:

   ```bash
   npm run decisions           # texto legible
   npm run decisions:json      # JSON auditable
   npm run decisions:write     # escribe api/v1/rc/go-no-go.sprint22.json
   ```

## 5. Producción sigue bloqueada

Aunque los 8 items queden `approved` y firmados por los 3 roles:

- `PRODUCTION_PUBLISH_ENABLED=false` mantiene la publicación real **deshabilitada**.
- El reporte `api/v1/rc/go-no-go.sprint22.json` mostrará `decision: "NO-GO"`
  mientras la publicación esté deshabilitada, con independencia de las firmas.
- Habilitar la publicación real es una decisión de un sprint futuro, documentada
  explícitamente y sujeta al doble gate ya existente (Sprint 17/18).
