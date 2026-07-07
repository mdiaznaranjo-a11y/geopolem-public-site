# Plantilla de sign-off editorial (GEOPÓLEM — Sprint 20)

> **NO PRODUCTIVO.** Este documento describe cómo firmar editorialmente los
> pendientes del Release Candidate. Ni la plantilla ni el ejemplo versionado
> habilitan producción. La publicación real a producción permanece
> **DESHABILITADA por política** (`PRODUCTION_PUBLISH_ENABLED=false`) y, además,
> exige una **segunda confirmación** independiente (doble gate, Sprint 18).

## 1. Modelo de gobernanza

Cada pendiente editorial recorre una máquina de estados cerrada:

```
pending ─▶ needs_human_review ─▶ evidence_ready ─▶ approved
        └▶ blocked_by_source  ┘                  ├▶ rejected
                                                  └▶ deferred
```

- **pending** — recién ingresado, sin evidencia preparada.
- **needs_human_review** — requiere criterio/acción de un editor humano.
- **blocked_by_source** — la fuente externa es inaccesible con el tooling actual.
- **evidence_ready** — hay un paquete de evidencia revisable listo para decisión.
- **approved / rejected / deferred** — decisión humana terminal firmada.

Sólo `approved` cuenta como **GO** para un item; `rejected`/`deferred` son NO-GO
(decisión tomada, pero el contenido no entra en este ciclo).

### Roles y firmas esperadas

Toda decisión terminal requiere las **tres firmas** (sin auth real; son
declaraciones auditables):

| Rol | Responsabilidad |
|-----|-----------------|
| `reviewer` | Prepara/verifica la evidencia. |
| `editor` | Decide editorialmente (aprobar/rechazar/posponer). |
| `owner` | Autoriza la decisión a nivel de producto. |

## 2. Evidencia revisable

Antes de firmar, revisa el paquete de evidencia de cada pendiente:

- Índice/manifiesto: `editorial-review/manifest.json`
- Fichas por item: `editorial-review/evidence/*.md`

Cada ficha incluye: conflicto, tipo de pendiente, clasificación, estado,
fuentes disponibles, razón de bloqueo, evidencia de acceso a la fuente (si
aplica), acción recomendada y la **decisión requerida**.

Regenerar/validar: `npm run evidence:build:check`.

## 3. Cómo firmar (no productivo)

1. Copia el ejemplo versionado a un archivo **NO versionado**:

   ```bash
   cp .editorial-signoff.example.json .editorial-signoff.json
   ```

2. En `.editorial-signoff.json`:
   - Cambia `is_example` a `false` (un ejemplo **nunca** cuenta como firma real).
   - Reemplaza `NOMBRE_REVIEWER` / `NOMBRE_EDITOR` / `NOMBRE_OWNER` por firmas reales.
   - Ajusta la `decision` de cada item (`approved` | `rejected` | `deferred`).
   - **No** incluyas secretos (tokens/claves): el validador los rechaza.

   Alternativamente, exporta `GEOP_EDITORIAL_SIGNOFF` con el mismo JSON en una
   sola variable de entorno (no en CI).

3. Evalúa el go/no-go con el sign-off resuelto:

   ```bash
   npm run go-no-go        # texto legible
   npm run go-no-go:json   # JSON auditable
   ```

## 4. Doble gate: producción sigue bloqueada

Aunque las 8 decisiones queden `approved` y firmadas:

- El **sign-off editorial** (este documento) es sólo el primer gate.
- Se requiere una **segunda confirmación** independiente (`.release-confirmation.json`
  o `GEOP_RELEASE_CONFIRM`, Sprint 18), que **no puede originarse en CI**.
- Y aun con el doble gate satisfecho, `PRODUCTION_PUBLISH_ENABLED=false` mantiene
  la publicación real **deshabilitada**. Habilitarla es una decisión de un sprint
  futuro documentada explícitamente.

El reporte `api/v1/rc/go-no-go.json` reflejará `decision: "NO-GO"` mientras la
publicación esté deshabilitada, con independencia de las firmas.
