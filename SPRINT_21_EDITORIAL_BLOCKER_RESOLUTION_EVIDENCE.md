# Sprint 21 — Resolución técnica de bloqueos del RC con evidencia alternativa

**Rama:** `sprint-21-editorial-blocker-resolution-evidence` (basada en `sprint-20-editorial-governance-signoff-workflow`)
**Estado global:** ✅ artefactos generados y verificados · **producción NO publicada** (deshabilitada por diseño)
**Decisión del RC:** **NO-GO** (0/8 con decisión GO firmada · 8/8 preparados como `evidence_ready` a la espera de decisión humana)
**Regla de oro respetada:** sin datos inventados; sin secretos; sin promoción real; sin auto-aprobación.

Este sprint aborda **técnicamente** los **8 bloqueos** que el Sprint 20 dejó en
NO-GO. Para cada pendiente se buscó, verificó (fetch directo real) y documentó una
**fuente alternativa/de respaldo accesible** que corrobora la fuente institucional
original inaccesible (402/403) o respalda el vínculo causal concreto. El resultado
es que los 8 pendientes avanzan a **`evidence_ready`** — evidencia lista para
decisión humana — pero **ninguno se aprueba**: la decisión editorial y la
publicación a producción quedan explícitamente fuera de este sprint.

---

## 1) Alcance e invariantes (regla de oro)

- **No auto-aprobación:** el estado objetivo máximo del módulo es `evidence_ready`.
  Cualquier `target_state` de decisión terminal (`approved`/`rejected`/`deferred`)
  se **refusa** y el estado se mantiene. Es un invariante probado.
- **No inventar datos:** cada fuente alternativa lleva URL, publisher, título,
  `accessed_at`, `accessed_via` y el **resultado HTTP real** observado durante el
  sprint. Sin fuente utilizable (url + accessed_via + http_result), el bloqueo se
  **mantiene**.
- **Overlay, no mutación:** la cola RC del Sprint 19
  (`data/editorial-review-queue.rc.json`) permanece **intacta**. El Sprint 21
  produce artefactos equivalentes/overlay para no romper los 382 tests previos.
- **Producción bloqueada por política:** `PRODUCTION_PUBLISH_ENABLED=false`. Aunque
  los 8 queden `evidence_ready`, el total sigue **NO-GO** e `is_production=false`.

---

## 2) Entorno de verificación

- Método: `WebSearch` + `WebFetch` durante la ejecución del Sprint 21.
- Dominios institucionales **originales** siguen bloqueados vía proxy (reconfirmado):
  `iaea.org` → HTTP 402, `unocha.org` → HTTP 403, `unhcr.org` → HTTP 403.
- Algunas fuentes de terceros de alta autoridad también estaban bloqueadas
  (`chathamhouse.org` 403, `iea.org` 403, `congress.gov` 403, `npr.org` timeout);
  se eligieron **alternativas accesibles equivalentes** (todas respondieron HTTP 200).

---

## 3) Estado de los 8 bloqueos

### 3.1 `blocked_by_source` (3) — fuente institucional inaccesible

| Conflicto | Fuente original (bloqueada) | Fuente alternativa verificada (HTTP 200) | Estado nuevo |
|-----------|------------------------------|-------------------------------------------|--------------|
| `ukr-rus` | `iaea-ukraine-update-356` (iaea.org, 402) | UN News — ZNPP pierde energía externa (news.un.org/…/1166016) | `evidence_ready` |
| `isr-gaza-irn` | `ocha-opt` (unocha.org, 403) | OCHA Humanitarian Update #351 vía un.org/unispal | `evidence_ready` |
| `sahel` | `unhcr-sahel-emergency` (unhcr.org, 403) | UN News — Sahel: conflicto y clima (news.un.org/…/1166076) | `evidence_ready` |

Las tres alternativas son **mirrors/corroboración institucional** (ONU) que
reproducen el mismo contenido/cifras de la fuente primaria bloqueada.

### 3.2 `needs_human_review` (5) — vínculo causal sin fuente específica

| Conflicto | Vínculo causal | Fuente de respaldo verificada (HTTP 200) | Estado nuevo |
|-----------|----------------|-------------------------------------------|--------------|
| `asia-agua` | Tratado de Aguas del Indo bajo presión | PSI/Clingendael — IWT 2025 "in abeyance" | `evidence_ready` |
| `isr-gaza-irn` | Crisis humanitaria + escalada regional | OCHA (un.org/unispal) + CGEP Columbia (Ormuz/energía) | `evidence_ready` |
| `istanbul` | Régimen del Bósforo y tránsito por Estrechos | The Conversation — chokepoints (energía/grano) | `evidence_ready` |
| `sahel` | Violencia armada → desplazamiento forzado | UN News (cifras ACNUR: violencia→~4M desplazados) | `evidence_ready` |
| `stablecoins` | Riesgo de estabilidad financiera | FSB 2025 — gaps en regulación de stablecoins (fuente primaria) | `evidence_ready` |

Cada ficha documenta honestamente el **residual para el humano**: qué parte del
vínculo queda respaldada de forma indirecta y qué fuente adicional podría añadir un
editor si desea afirmar un mecanismo más fino (p.ej. hidrología primaria en
`asia-agua`, ACLED en `sahel`, el nexo con desinformación financiera en `stablecoins`).

---

## 4) Artefactos generados

Módulo puro **`editorial-blocker-resolution.mjs`** (contratos
`sprint-21-editorial-blocker-resolution-v1` y familia). Determinista, IO inyectada,
`generated_at` heredado de la cola RC para reproducibilidad/no-diff.

Dataset curado **`data/editorial-alternative-evidence.sprint21.json`**
(contrato `sprint-21-alternative-evidence-v1`): evidencia alternativa verificada por
cada una de las 8 claves.

Script **`scripts/build-blocker-resolution.mjs`** (`--json`/`--write`/`--check`)
ensambla de forma atómica 4 artefactos:

| Artefacto | Descripción |
|-----------|-------------|
| `data/editorial-review-queue.sprint21.json` | Cola RC resuelta (overlay): 8/8 `evidence_ready`, 0 aprobados, 0 auto-aprobaciones. |
| `editorial-review/sprint21/manifest.json` | Manifiesto de evidencia ampliada (cubre exactamente la cola RC). |
| `editorial-review/sprint21/evidence/*.md` | Una ficha revisable por humano por pendiente (transición + fuentes + metadatos). |
| `api/v1/rc/go-no-go.sprint21.json` | GO/NO-GO actualizado: `evidence_ready=8`, `go=0`, `NO-GO`, `is_production=false`. |

---

## 5) GO/NO-GO actualizado

```
decision:      NO-GO
is_production: false
go:            0
evidence_ready:8
still_blocked: 0
```

Bloqueos que impiden GO (por diseño):
- 8 pendientes en `evidence_ready` a la espera de **decisión humana** (approve/reject/defer).
- Sin sign-off editorial firmado (un ejemplo nunca cuenta).
- **Publicación a producción DESHABILITADA por política** (`PRODUCTION_PUBLISH_ENABLED=false`).

`evidence_ready` **no es GO**: sólo una decisión `approved` firmada lo sería, y este
sprint no firma ni aprueba nada.

---

## 6) Pruebas y CI

- **19 tests nuevos** (`api-server/test/sprint21-blocker-resolution.test.mjs`):
  transición a `evidence_ready`, no auto-aprobación (target de decisión refusado),
  bloqueo mantenido sin evidencia utilizable, cola resuelta determinista, evidencia
  ampliada que cubre la cola RC, validación de evidencia alternativa (secretos/decisión),
  GO/NO-GO actualizado, artefactos versionados al día y clean-tree no-write/no-diff.
- **Suite completa: 401/401 en verde** (382 previos + 19 nuevos).
- **Integrado en tooling:** `resolution:build:*` en `api-server/package.json`,
  `resolution:build --check` en `scripts/check-clean-tree.mjs`, y paso
  `npm run resolution:build:check` en `.github/workflows/ci.yml`.

---

## 7) Riesgos y decisión requerida (humano, sprint posterior)

- Las alternativas de la ONU (UN News, un.org/unispal) **corroboran** la fuente
  primaria bloqueada; un revisor con acceso directo puede reconfirmar la URL canónica
  exacta (p.ej. OIEA Update 356) si se exige la fuente primaria literal.
- Los residuales documentados por ficha marcan qué afirmaciones causales quedan
  respaldadas de forma indirecta y podrían reforzarse con una fuente adicional.
- La decisión editorial (approve/reject/defer) y la habilitación de producción
  requieren **sign-off humano de 3 roles** + segunda confirmación, y siguen
  bloqueadas por política.

## 8) Recomendación para el Sprint 22

Ejecutar el **flujo de decisión editorial humana** sobre los 8 paquetes
`evidence_ready`: revisor/editor/owner firman approve/reject/defer por clave usando
el workflow de sign-off del Sprint 20. La publicación a producción permanece
deshabilitada hasta una decisión explícita de producto que habilite
`PRODUCTION_PUBLISH_ENABLED` de forma auditable.
