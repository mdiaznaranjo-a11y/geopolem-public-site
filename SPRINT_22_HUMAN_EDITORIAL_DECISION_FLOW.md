# Sprint 22 — Flujo de decisión editorial humana

> **Estado: NO-GO (producción bloqueada).** Este sprint construye el mecanismo
> para que un humano **apruebe, rechace o difiera** los 8 paquetes
> `evidence_ready` que dejó el Sprint 21, con firmas de rol (`reviewer`,
> `editor`, `owner`) y trazabilidad por hash. **No aprueba nada
> automáticamente** y **no publica producción.**

## 1. Contexto

- El Sprint 21 resolvió técnicamente los 8 bloqueos del Release Candidate con
  evidencia alternativa verificada y los dejó todos en `evidence_ready`
  (ver `editorial-review/sprint21/manifest.json`).
- `evidence_ready` **no** es GO: significa "hay evidencia lista para que un
  humano decida". Faltaba precisamente ese paso humano.
- El Sprint 22 aporta el **flujo de decisión editorial humana**: modelo,
  plantillas seguras, CLI de evaluación, integridad por hash y reporte GO/NO-GO
  actualizado. Producción sigue **NO-GO** (`go=0`) por diseño.

## 2. Flujo

```
Sprint 21 (evidence_ready) ─▶ revisión humana de la evidencia
                            ─▶ firma por rol (reviewer / editor / owner)
                            ─▶ evaluación de integridad + reglas de rol
                            ─▶ GO/NO-GO por item y total
                            ─▶ (producción DESHABILITADA por política)
```

Cada pendiente recorre:

```
evidence_ready ─▶ approved   (GO del item; exige reviewer + editor + owner)
               ├▶ rejected   (NO-GO; terminal; ≥1 firma de rol requerido)
               └▶ deferred   (NO-GO; pospuesto; ≥1 firma de rol requerido)
```

## 3. Modelo de decisión

Cada entrada del set de decisiones es la **firma de UN rol sobre UN item**:

| Campo | Descripción |
|-------|-------------|
| `item_id` | Clave del pendiente (idéntica a la del manifiesto de evidencia). |
| `decision` | `approved` \| `rejected` \| `deferred`. |
| `rationale` | Justificación **no vacía**. |
| `decided_by_role` | `reviewer` \| `editor` \| `owner`. |
| `decided_at` | Fecha `YYYY-MM-DD`. |
| `evidence_manifest_hash` | Hash de la evidencia vigente contra la que se decidió. |
| `source_hashes` | Mapa `slug → sha256` de las fuentes revisadas del item. |
| `optional_conditions` | Lista opcional de condiciones/salvedades. |

### Reglas de roles

- **APPROVED final** exige las **3 firmas** (`reviewer` + `editor` + `owner`),
  todas `approved`, con `owner` presente ("owner final").
- **REJECTED/DEFERRED final** es terminal con **una** firma válida de rol
  requerido. `rejected` prevalece sobre `deferred` y sobre aprobaciones parciales.
- Un mismo rol **no** puede firmar dos veces el mismo item.
- Aprobación con firmas incompletas → el item permanece `evidence_ready` (NO-GO).

No hay auth real: las firmas son **declaraciones auditables**. El tooling nunca
firma por un humano.

## 4. Formato y uso por humano

1. Revisa la evidencia: `editorial-review/sprint21/manifest.json` y las fichas
   `editorial-review/sprint21/evidence/*.md`.
2. Copia el ejemplo a un archivo **NO versionado** (gitignored):

   ```bash
   cp .editorial-decisions.example.json .editorial-decisions.json
   ```

3. Edita `.editorial-decisions.json`: `is_example:false`, firmas reales,
   `decision` por rol, y verifica los hashes con `npm run decisions:hash`.
   (Alternativa: `GEOP_EDITORIAL_DECISIONS` con el mismo JSON.)
4. Evalúa:

   | Comando | Efecto |
   |---------|--------|
   | `npm run decisions` | Reporte en texto (no escribe). |
   | `npm run decisions:json` | Reporte JSON auditable (no escribe). |
   | `npm run decisions:hash` | Hash de la evidencia vigente. |
   | `npm run decisions:write` | Escribe `api/v1/rc/go-no-go.sprint22.json`. |
   | `npm run decisions:check` | Falla si el reporte versionado está desactualizado. |

## 5. Garantías (verificadas por tests)

- **No auto-aprobación:** el tooling nunca firma; sin decisiones reales → NO-GO,
  `go=0`.
- **Ejemplo no productivo:** `.editorial-decisions.example.json` tiene
  `is_example:true`; aunque esté completo con 8×3 firmas, **nunca** habilita GO
  total.
- **Integridad / no aprobar evidencia obsoleta:** cada firma se liga por hash al
  manifiesto y a las fuentes vigentes; un `evidence_manifest_hash` o un
  `source_hash` que no case marca la decisión como **OBSOLETA** y no cuenta.
- **Validación:** se detectan `rationale` vacío, rol inválido, rol duplicado,
  aprobación incompleta, firmas para claves desconocidas y secretos aparentes.
- **GO parcial / GO total simulado:** demostrados con fixtures en memoria/tempdir
  (4/8 → go parcial; 8/8 + `publishEnabled=true` → GO), **sin** tocar producción.
- **Producción bloqueada:** aun con 8/8 `approved`, `PRODUCTION_PUBLISH_ENABLED=false`
  fuerza `NO-GO` e `is_production:false`.
- **Determinismo y clean-tree:** el reporte es reproducible (hereda `generated_at`)
  y los modos de sólo lectura no dejan diffs.

## 6. Estado GO/NO-GO actual

`api/v1/rc/go-no-go.sprint22.json`:

- `decision: "NO-GO"`, `is_production: false`
- `summary.go: 0`, `summary.pending: 8`
- Blockers: 8 pendientes sin decisión GO firmada; decisiones editoriales
  ausentes; publicación DESHABILITADA por política.

Producción permanece **NO-GO** porque no existe aprobación humana real (correcto
y deseado en este sprint).

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Aprobar evidencia obsoleta tras regenerarla. | Ligadura por hash (manifiesto + fuentes); firmas obsoletas dejan de contar. |
| Auto-aprobación por el tooling. | El tooling solo valida; sin firmas humanas → NO-GO. Cubierto por tests. |
| Un ejemplo cuente como decisión real. | `is_example:true` invalida el set y bloquea GO total. |
| Filtrado de secretos en las firmas. | Rechazo de valores que aparenten tokens/claves. |
| Publicación accidental. | `PRODUCTION_PUBLISH_ENABLED=false`: NO-GO garantizado. |

## 8. Archivos

- `editorial-decision.mjs` — módulo puro (modelo, hash, reglas, validación, go/no-go).
- `scripts/evaluate-editorial-decisions.mjs` — CLI (`decisions[:json|:hash|:write|:check]`).
- `docs/editorial-decision.template.md` — plantilla segura de uso humano.
- `.editorial-decisions.example.json` — ejemplo versionado (no productivo).
- `api/v1/rc/go-no-go.sprint22.json` — reporte GO/NO-GO actualizado (NO-GO).
- `api-server/test/sprint22-human-editorial-decision.test.mjs` — 21 tests.
- `.gitignore` — ignora `.editorial-decisions.json` (decisiones reales).

## 9. Recomendaciones para el Sprint 23

1. **Aportar las fuentes causales/reconfirmaciones residuales** que los paquetes
   de evidencia marcan como `residual_for_human` (p. ej. fuente hidrológica
   primaria para el mecanismo del Indo, reconfirmación directa de OCHA/UNHCR/IAEA).
2. **Ejercicio de decisión real** (no versionado) por parte de reviewer/editor/
   owner sobre `.editorial-decisions.json`, verificando el reporte NO-GO por
   política.
3. **Firma criptográfica opcional** de las decisiones (más allá de la declaración
   auditable) si se requiere no repudio.
4. **Diseñar el gate de habilitación de producción** (`PRODUCTION_PUBLISH_ENABLED`)
   como decisión explícita y documentada, integrada con el doble gate existente
   (Sprint 17/18).
