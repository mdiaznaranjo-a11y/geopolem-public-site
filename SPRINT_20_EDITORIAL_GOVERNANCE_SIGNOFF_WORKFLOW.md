# Sprint 20 — Gobernanza editorial y workflow de sign-off

**Rama:** `sprint-20-editorial-governance-signoff-workflow` (basada en `sprint-19-release-candidate-editorial-qa`)
**Estado global:** ✅ artefactos generados y verificados · **producción NO publicada** (deshabilitada por diseño)
**Decisión del RC:** **NO-GO** (0/8 pendientes con decisión GO firmada · publicación bloqueada por política)
**Regla de oro respetada:** sin datos inventados; sin secretos; sin promoción real.

Este sprint formaliza la **gobernanza editorial** necesaria para resolver/firmar
los **8 bloqueos** del Release Candidate (Sprint 19), prepara **evidencia revisable
por humano** por cada pendiente y mantiene **producción bloqueada** hasta un
sign-off explícito + segunda confirmación. Nada de esto publica ni promueve
producción: el objetivo es dejar el terreno listo para una decisión humana
auditable, no tomarla automáticamente.

---

## 1) Modelo de gobernanza editorial

Módulo puro **`editorial-governance.mjs`** (contrato `sprint-20-editorial-governance-v1`).
Determinista, sin disco/red (la IO se inyecta).

### Estados formales (taxonomía cerrada)

```
pending ─▶ needs_human_review ─▶ evidence_ready ─▶ approved
        └▶ blocked_by_source  ┘                  ├▶ rejected
                                                  └▶ deferred
```

| Estado | Significado |
|--------|-------------|
| `pending` | Recién ingresado, sin evidencia preparada. |
| `needs_human_review` | Requiere criterio/acción de un editor humano. |
| `blocked_by_source` | La fuente externa es inaccesible con el tooling actual. |
| `evidence_ready` | Hay paquete de evidencia revisable listo para decisión. |
| `approved` / `rejected` / `deferred` | Decisión humana terminal firmada. |

- `canTransition(from, to)` valida la máquina de estados (los estados de decisión
  son **terminales**; no hay saltos ilegales como `pending → approved`).
- `initialStateFromClassification()` mapea la clasificación del RC (Sprint 19) al
  estado inicial de gobernanza.
- Sólo `approved` cuenta como **GO** de un item.

### Roles y firmas esperadas (sin auth real)

| Rol | Responsabilidad |
|-----|-----------------|
| `reviewer` | Prepara/verifica la evidencia. |
| `editor` | Decide editorialmente (aprobar/rechazar/posponer). |
| `owner` | Autoriza la decisión a nivel de producto. |

Toda decisión terminal exige las **tres firmas**. Son declaraciones auditables en
texto plano; el validador **rechaza** cualquier valor que aparente un secreto
(token/clave/password).

### Validadores/esquema

- `validateEditorialSignoff(signoff, { requiredKeys })` — esquema + roles + cobertura
  exacta de los pendientes. Un **ejemplo** (`is_example:true`) **nunca** es válido.
- `resolveEditorialSignoff(...)` — resuelve desde `GEOP_EDITORIAL_SIGNOFF` (env) o
  `.editorial-signoff.json` (archivo NO versionado).
- `validateEvidenceManifest(manifest, rc)` — la evidencia cubre exactamente la cola RC.

---

## 2) Paquetes de evidencia por item

Generador **`scripts/build-evidence-packages.mjs`** (contrato `sprint-20-editorial-evidence-v1`).
Deriva cada paquete **sólo** de lo existente en el repo: la cola RC clasificada
(`data/editorial-review-queue.rc.json`) y los detalles de staging
(`api/v1/staging/conflicts/<id>.json`). **No inventa evidencia.**

Artefactos generados:

- **`editorial-review/manifest.json`** — índice de los 8 paquetes + resumen por estado.
- **`editorial-review/evidence/*.md`** — una ficha revisable por humano por pendiente.

Cada ficha incluye: conflicto, tipo de pendiente, clasificación, estado de
gobernanza, gate que bloquea, **fuentes disponibles reales**, razón de bloqueo,
**evidencia de acceso a la fuente** (los mismos 402/403 reintentados en Sprint
15/18/19), acción recomendada y la **decisión requerida**.

Resumen: `needs_human_review=5`, `blocked_by_source=3`. `generated_at` heredado de
la cola RC ⇒ **no-diff**. Verificación: `npm run evidence:build:check`.

---

## 3) Sign-off editorial NO productivo

- **Plantilla:** `docs/editorial-signoff.template.md` — explica estados, roles, cómo
  firmar y por qué producción sigue bloqueada.
- **Ejemplo versionado seguro:** `.editorial-signoff.example.json` con
  `is_example: true`. Cubre las 8 claves con firmas de marcador de posición.
- **Sign-off real (NO versionado):** `.editorial-signoff.json` (añadido a
  `.gitignore`) o la variable `GEOP_EDITORIAL_SIGNOFF`.

**Garantías de seguridad (probadas):**

- Un **ejemplo** (`is_example:true`) es rechazado aunque su estructura sea válida:
  jamás cuenta como firma real ni produce GO.
- Un sign-off real, completo y con las 3 firmas **valida** estructuralmente.
- **Aun así, producción sigue bloqueada:** con firmas + doble gate satisfecho, el
  total permanece **NO-GO** mientras `PRODUCTION_PUBLISH_ENABLED=false`.
- Se requiere **doble confirmación** independiente (Sprint 18,
  `.release-confirmation.json` / `GEOP_RELEASE_CONFIRM`), que **no puede originarse
  en CI**.

---

## 4) Reporte GO/NO-GO

Generador **`scripts/build-go-no-go.mjs`** (contrato `sprint-20-editorial-go-no-go-v1`).
Reporte **separado** en **`api/v1/rc/go-no-go.json`** que **no** modifica el
manifiesto RC (Sprint 19 intacto). Cacheable por el service-worker (`/api/v1/*.json`).

Contiene:

- **Decisión total** (`GO`/`NO-GO`) y **por item**, con razones.
- **Blockers restantes** legibles.
- **Cobertura** (100%, desde el manifiesto RC).
- **Trazabilidad:** `sources_needing_human_review` (3) y `causal_links_pending` (5).

Regla de agregación: un item es GO sólo si su decisión firmada es `approved`; el
total es GO sólo si **todos** los items son GO **y** cobertura ok **y** sign-off ok
**y** doble gate ok **y** publicación habilitada. Como la publicación está
**DESHABILITADA por política**, el total es **NO-GO** en este ciclo.

Estado actual: **NO-GO**, `go=0`, `no_go=8`. Verificación: `npm run go-no-go:check`.

---

## 5) Tests y CI

Suite nueva **`api-server/test/sprint20-editorial-governance.test.mjs`** (24 tests):
estados y transiciones, estado inicial, evidencia (cobertura + fuentes reales +
determinismo), sign-off (ejemplo rechazado, real válido, falta de firma, decisión
inválida, secretos), go/no-go (0 GO sin firmas, producción bloqueada por política
con firmas+doble gate, GO sólo con publish habilitado, ejemplo nunca GO), RC
intacto y **árbol Git limpio** (no-write/no-diff).

CI (`.github/workflows/ci.yml`), en el job sin DB:

- `npm run evidence:build:check` — paquetes de evidencia al día.
- `npm run go-no-go:check` — reporte GO/NO-GO al día y sin producción.

Además, los dos checks read-only se añaden a `scripts/check-clean-tree.mjs` (garantía
NO-WRITE del Sprint 17). Suite completa: **382 tests en verde**.

### Scripts npm (en `api-server/`)

| Script | Efecto |
|--------|--------|
| `evidence:build` / `:write` / `:check` | Imprime / escribe / verifica los paquetes de evidencia. |
| `go-no-go` / `:json` / `:write` / `:check` | Reporte GO/NO-GO en texto / JSON / escritura / verificación. |

---

## 6) Uso por un humano

1. Revisa la evidencia: `editorial-review/manifest.json` y `editorial-review/evidence/*.md`.
2. Copia el ejemplo a un archivo NO versionado y fírmalo de verdad:
   ```bash
   cp .editorial-signoff.example.json .editorial-signoff.json
   # is_example → false; firmas reales reviewer/editor/owner; decision por item
   ```
3. Evalúa: `npm run go-no-go` (texto) o `npm run go-no-go:json` (auditable).
4. Producción seguirá NO-GO por política aunque todo esté firmado (ver §3).

---

## 7) Criterios para Sprint 21

- **Resolver fuentes bloqueadas (3):** revisor humano con acceso directo reconfirma
  las URLs (IAEA/OCHA/UNHCR) o sustituye por fuentes equivalentes accesibles.
- **Cerrar causal_links (5):** aportar la fuente específica que respalda cada vínculo
  causal; `pending:false` en la semilla verificada.
- Regenerar cola RC + evidencia + go/no-go; confirmar `go=8`.
- **Sólo entonces**, evaluar (decisión de producto, fuera de CI) habilitar
  `PRODUCTION_PUBLISH_ENABLED` acompañado de la escritura canónica con rollback.

## 8) Riesgos

- **Falso "GO" por automatización:** mitigado — el ejemplo nunca cuenta, CI nunca
  define las variables de firma, y la política mantiene el total NO-GO.
- **Diffs espurios por timestamp:** mitigado — `generated_at` heredado ⇒ no-diff,
  verificado en CI y en el clean-tree.
- **Fuentes externas siguen inaccesibles vía proxy:** documentado con evidencia real
  (402/403); no se inventa contenido para desbloquear.
- **Sign-off con secretos:** mitigado — el validador rechaza valores que aparenten
  credenciales.
