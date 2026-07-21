# Sprint 23 — Ejercicio editorial, firma criptográfica y diseño del gate de producción

> **Estado: NO-GO (producción bloqueada).** Este sprint **prepara** el ejercicio
> de decisión editorial humana asistida, añade **firma criptográfica opcional**
> (no-repudio), **refuerza la validación de roles** y **diseña** el gate explícito
> de habilitación de producción — todo **sin activar producción**. La bandera
> `PRODUCTION_PUBLISH_ENABLED=false` mantiene el gate cerrado. GO/NO-GO editorial
> sigue en `go=0`, `pending=8`. **No se auto-aprueba nada ni se introducen secretos.**

## 1. Contexto

El Sprint 22 dejó el flujo de decisión editorial humana (firmas declaradas por
`reviewer`/`editor`/`owner`, integridad por hash, GO/NO-GO auditable), pero sin el
*ejercicio* operativo para ejecutarlo, sin no-repudio criptográfico y sin un gate
de producción unificado. El Sprint 23 aporta esas cuatro piezas, manteniendo la
regla de oro: **el tooling nunca firma por un humano y nunca publica**.

## 2. Flujo humano (ejercicio asistido)

```
evidence_ready (8) ─▶ revisión por rol con checklist (reviewer/editor/owner)
                   ─▶ firma declarada por rol (Sprint 22) + identidad (Sprint 23)
                   ─▶ (opcional) firma criptográfica Ed25519 detached (no-repudio)
                   ─▶ validación reforzada (roles, fecha, hash, rationale)
                   ─▶ GO/NO-GO editorial  +  DISEÑO del gate de producción
                   ─▶ producción DESHABILITADA por política (gate cerrado)
```

Material del ejercicio (Bloque 1):

- `docs/editorial-exercise-sprint23.md` — guía operativa paso a paso.
- `docs/checklists/reviewer-checklist.md`, `editor-checklist.md`, `owner-checklist.md`
  — checklist por rol.
- `docs/editorial-decision-item.template.md` — hoja de trabajo **vacía** por item.

Ninguna decisión real se rellena en el repo; las decisiones reales viven en
`.editorial-decisions.json` (no versionado).

## 3. Firma criptográfica opcional (Bloque 2)

- **Módulo:** `editorial-signature.mjs`. **Registro ejemplo:**
  `editorial-signature-keys.example.json` (sólo claves **públicas**).
- **Algoritmo:** Ed25519 **detached**. La clave **privada nunca entra al repo**;
  para verificar sólo se necesita la **pública** (SPKI DER en base64).
- **Payload canónico determinista** (`canonicalDecisionPayload`): proyección
  estable de la decisión; source_hashes y condiciones ordenados.
- **Opcional por diseño:** la **ausencia** de firma no degrada un GO válido; una
  firma **presente e inválida** sí es un error. La clave de un rol **no** sirve
  para firmar por otro.
- **Anti-fuga:** se rechaza de raíz cualquier material que aparente **clave
  privada** o **secreto**, tanto en el registro como en las firmas.

## 4. Validación reforzada de roles (Bloque 3)

Módulo `editorial-role-validation.mjs`, capa **adicional** sobre el Sprint 22:

- **Trazabilidad:** `decided_by` (identidad) obligatorio en cada firma.
- **Separación de roles por identidad:** una misma persona **no** puede rellenar
  varios roles requeridos del mismo item (el `owner` no suplanta a
  `reviewer`/`editor`). Sólo se relaja con la regla **explícita**
  `allowMultiRoleSigner` (degrada a advertencia auditada).
- **Vigencia por fecha:** `decided_at` no anterior a la evidencia vigente ni en el
  futuro.
- **Rationale mínimo:** longitud ≥ `RATIONALE_MIN_LEN` (justificación real).
- **Hash/evidencia:** la ligadura por hash del Sprint 22 se mantiene íntegra.

## 5. Diseño del gate de producción (Bloque 4)

- **Módulo:** `production-gate.mjs`. **Doc:** `docs/production-gate-design.md`.
  **CLI:** `scripts/evaluate-production-gate.mjs`. **Artefacto:**
  `api/v1/rc/production-gate.sprint23.json`.
- Reúne **seis condiciones duras** (`decisions_go`, `decisions_valid`,
  `coverage_ok`, `editorial_signoff`, `second_confirmation`, `signatures_ok`) más
  la **segunda barrera** independiente: la bandera global.
- **Invariante de seguridad:** `production_enabled` es **siempre `false`** en este
  sprint. Aunque las seis condiciones se cumplan (`gate_open:true`), la bandera
  `PRODUCTION_PUBLISH_ENABLED=false` impide `ready_to_publish` real y mantiene
  `production_enabled:false`.

```
gate_open        = TODAS las 6 condiciones duras
ready_to_publish = gate_open && PRODUCTION_PUBLISH_ENABLED
production_enabled = false   ← INVARIANTE del Sprint 23
```

## 6. Seguridad

| Amenaza | Mitigación |
|---------|------------|
| Clave privada versionada. | `.gitignore` para `editorial-signature-keys.json`, `*.ed25519.key`, `*.private.pem`; el validador rechaza material privado en registro/firmas. |
| Secreto filtrado en decisiones/firmas. | Rechazo de valores que aparenten token/clave/secret (Sprint 22 + Sprint 23). |
| Suplantación de roles por una persona. | Validación reforzada por identidad (Bloque 3). |
| Aprobar evidencia obsoleta. | Ligadura por hash del manifiesto y de las fuentes (Sprint 22). |
| Firma reutilizada/alterada. | Payload canónico + verificación Ed25519; alterar la decisión invalida la firma. |
| Publicación accidental. | Doble barrera + `production_enabled` invariante `false`. |
| Firma de ejemplo que "cuente". | El registro de ejemplo (`is_example`) y las firmas de ejemplo no abren el gate; la bandera manda. |

## 7. Límites (lo que este sprint NO hace)

- **No** rellena decisiones reales (plantillas y ejemplos son ilustrativos).
- **No** activa producción ni cambia `PRODUCTION_PUBLISH_ENABLED`.
- **No** exige firma criptográfica (es opcional; no-repudio adicional).
- **No** introduce claves privadas ni secretos en el repositorio.
- **No** modifica la evidencia (Sprint 21) ni el contrato de decisión (Sprint 22).

## 8. Estado GO/NO-GO actual

- Editorial (`api/v1/rc/go-no-go.sprint22.json`): `NO-GO`, `go=0`, `pending=8`,
  `is_production:false` (sin cambios respecto al Sprint 22, correcto).
- Gate (`api/v1/rc/production-gate.sprint23.json`): `PRODUCTION-DISABLED`,
  `production_enabled:false`, `gate_open:false` (faltan decisiones/sign-off/2ª
  confirmación y la bandera está en `false`).

## 9. Pruebas (Bloque 6)

`api-server/test/sprint23-crypto-signature-production-gate.test.mjs` (24 tests):
firma opcional (payload determinista, roundtrip, ausencia ok, inválida rechazada,
clave por rol, key_id desconocido), claves públicas de ejemplo, rechazo de
privadas/secretos, roles reforzados (identidad, multi-rol, fecha, rationale),
ejemplos no productivos, **producción bloqueada aun con 8/8 + firmas válidas**,
artefacto al día (`gate:check`) y clean-tree.

- Suite completa: **446 tests, 0 fallos**.
- `npm --prefix api-server run gate:check` → OK, `production_enabled:false`.
- `npm --prefix api-server run decisions:check` → OK, `NO-GO`, `0/8 GO`.

Comandos añadidos (`api-server/package.json`): `gate`, `gate:json`, `gate:write`,
`gate:check`.

## 10. Garantías verificadas

- **No auto-aprobación:** sin decisiones reales → `NO-GO`.
- **No producción:** `production_enabled` invariante `false`; doble barrera.
- **No secretos ni claves privadas** en el repo (validado por tests y `.gitignore`).
- **Firma opcional y verificable:** no-repudio sin claves privadas versionadas.
- **Determinismo y clean-tree:** artefactos reproducibles; modos de lectura sin diffs.

## 11. Recomendaciones para el Sprint 24

1. **Ejecutar el ejercicio real** (no versionado): reviewer/editor/owner deciden
   sobre `.editorial-decisions.json` y, opcionalmente, firman criptográficamente;
   confirmar que el gate sigue cerrado por política.
2. **Aportar fuentes residuales `residual_for_human`** que aún marcan las fichas de
   evidencia (hidrológica primaria del Indo; reconfirmaciones OCHA/UNHCR/IAEA).
3. **Formalizar el procedimiento de habilitación** de `PRODUCTION_PUBLISH_ENABLED`
   (cambio explícito, revisado y con rollback canónico) como runbook, aún sin
   ejecutarlo.
4. **Rotación y custodia de claves** públicas/privadas (fuera del repo) y registro
   real `editorial-signature-keys.json` si se adopta el no-repudio.
