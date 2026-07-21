# Ejercicio de decisión editorial humana asistida (GEOPÓLEM — Sprint 23)

> **NO PRODUCTIVO.** Esta guía prepara el *ejercicio* para que `reviewer`,
> `editor` y `owner` revisen los **8 paquetes `evidence_ready`** del Release
> Candidate y firmen su decisión (con firma criptográfica **opcional**). Ni esta
> guía, ni los ejemplos, ni las plantillas habilitan producción. La publicación
> real permanece **DESHABILITADA por política** (`PRODUCTION_PUBLISH_ENABLED=false`).
> El tooling **nunca firma por un humano**: sólo valida y calcula el veredicto.

## 0. Estado de partida (Sprint 22)

- 8 pendientes en `evidence_ready` (evidencia alternativa verificada).
- GO/NO-GO actual: **NO-GO** (`go=0`, `pending=8`).
- Fuente de la evidencia: `editorial-review/sprint21/manifest.json` y las fichas
  `editorial-review/sprint21/evidence/*.md`.

## 1. Roles y responsabilidades

| Rol | Qué verifica | Qué firma |
|-----|--------------|-----------|
| `reviewer` | Que la evidencia existe, es pertinente y las fuentes soportan la afirmación. | `approved` / `rejected` / `deferred` con rationale y trazabilidad. |
| `editor` | Que la decisión editorial es coherente con la línea del producto. | Idem, de forma independiente al reviewer. |
| `owner` | Autoridad final; que se cumplen requisitos y no hay conflictos. | Idem; su firma es obligatoria para un GO. |

Reglas duras (ver `editorial-decision.mjs` y `editorial-role-validation.mjs`):

- Un **GO de item** exige las **3 firmas** `approved` (reviewer + editor + owner).
- `rejected` / `deferred` son terminales con **una** firma de rol requerido.
- Un mismo rol no firma dos veces el mismo item.
- **Una misma persona (`decided_by`) no puede rellenar varios roles** del mismo
  item: el `owner` no puede suplantar a `reviewer`/`editor` (regla reforzada del
  Sprint 23; sólo se relaja con una regla explícita y auditada).
- `decided_at` debe ser vigente: no anterior a la evidencia ni en el futuro.
- `rationale` debe superar el mínimo de longitud (justificación real).

## 2. Flujo del ejercicio (paso a paso)

1. **Prepara el material de decisión (no versionado):**

   ```bash
   cp .editorial-decisions.example.json .editorial-decisions.json
   npm --prefix api-server run decisions:hash   # hash de la evidencia vigente
   ```

2. **Cada rol revisa** los 8 items con su checklist:
   - `docs/checklists/reviewer-checklist.md`
   - `docs/checklists/editor-checklist.md`
   - `docs/checklists/owner-checklist.md`

   Para cada item puede usarse la hoja de trabajo por item:
   `docs/editorial-decision-item.template.md`.

3. **Cada rol firma** su decisión en `.editorial-decisions.json`:
   - `is_example: false`.
   - `decision`, `rationale` (real), `decided_by` (identidad), `decided_at`.
   - `evidence_manifest_hash` y `source_hashes` deben coincidir con la evidencia
     vigente (`decisions:hash`).
   - **Sin secretos** (tokens/claves): el validador los rechaza.

4. **(Opcional) Firma criptográfica** para no-repudio — ver §3.

5. **Evalúa** el resultado (sólo lectura, no escribe):

   ```bash
   npm --prefix api-server run decisions        # GO/NO-GO de la decisión editorial
   npm --prefix api-server run gate             # diseño del gate de producción
   ```

## 3. Firma criptográfica OPCIONAL (no-repudio)

La firma es **opcional**: su ausencia no degrada un GO ya válido; sólo **añade**
garantía de no-repudio. Diseño: **Ed25519 detached**; la clave **privada nunca
entra al repo**; sólo se registra la clave **pública** (SPKI DER en base64).

1. Cada rol genera **fuera del repo** su par de claves:

   ```bash
   node -e "const c=require('crypto');const{publicKey,privateKey}=c.generateKeyPairSync('ed25519');\
   require('fs').writeFileSync(process.env.HOME+'/reviewer.ed25519.key',privateKey.export({type:'pkcs8',format:'pem'}));\
   console.log('PUBLIC_SPKI_B64', publicKey.export({type:'spki',format:'der'}).toString('base64'));"
   ```

   Guarda la clave **privada** fuera del repositorio (los `*.ed25519.key` están
   gitignorados como salvaguarda). Comparte sólo el `PUBLIC_SPKI_B64`.

2. Registra las claves **públicas** en `editorial-signature-keys.json`
   (no versionado; el ejemplo público seguro es
   `editorial-signature-keys.example.json`).

3. Cada rol firma el *payload canónico* de su decisión y añade el bloque
   `signature: { algorithm:'ed25519', key_id, signature_b64 }` a su entrada. El
   payload lo produce `canonicalDecisionPayload(entry)` de `editorial-signature.mjs`.

4. La verificación es automática al evaluar el gate. Una firma **presente e
   inválida** es un error; una firma **ausente** no lo es.

> El validador **rechaza de raíz** cualquier material que aparente una clave
> **privada** o un secreto, tanto en el registro como en las firmas.

## 4. Qué NO hace este ejercicio

- **No** rellena decisiones reales (las plantillas y ejemplos son ilustrativos).
- **No** habilita producción: aunque los 8 items queden `approved` y firmados
  criptográficamente, `PRODUCTION_PUBLISH_ENABLED=false` mantiene el gate
  **cerrado** (ver `docs/production-gate-design.md`).
- **No** introduce secretos ni claves privadas en el repositorio.

## 5. Salidas del ejercicio

- `.editorial-decisions.json` — decisiones reales (no versionado).
- `api/v1/rc/go-no-go.sprint22.json` — GO/NO-GO editorial (regenerable).
- `api/v1/rc/production-gate.sprint23.json` — estado del gate de producción
  (siempre `production_enabled:false` en este sprint).
