# Diseño del gate de habilitación de producción (GEOPÓLEM — Sprint 23)

> **DISEÑO, NO ACTIVACIÓN.** Este documento especifica el gate explícito que
> habría que abrir para publicar a producción. En este sprint el gate está
> **CERRADO por diseño**: `PRODUCTION_PUBLISH_ENABLED=false` mantiene
> `production_enabled:false` aunque todas las demás condiciones se cumplan.
> Módulo: `production-gate.mjs`. Reporte: `api/v1/rc/production-gate.sprint23.json`.

## 1. Motivación

Los sprints previos construyeron piezas de control aisladas (decisión editorial,
sign-off, segunda confirmación, firmas). El Sprint 23 las **reúne en un único
gate auditable** para que la habilitación de producción sea una decisión
**explícita, trazable y multi-barrera**, nunca un efecto colateral.

## 2. Condiciones del gate

Todas deben ser verdaderas para **abrir** el gate (`gate_open`). Además, la
publicación real exige la **bandera global** (segunda barrera independiente).

| Condición | Origen | Significado |
|-----------|--------|-------------|
| `decisions_go` | Sprint 22 (`editorial-decision.mjs`) | 8/8 items `approved` con integridad de hash. |
| `decisions_valid` | Sprint 22 | Set de decisiones válido (no ejemplo, no obsoleto). |
| `coverage_ok` | Sprint 15/16 | Cobertura de staging completa. |
| `editorial_signoff` | Sprint 20 (`promotion-signoff.mjs`) | Sign-off editorial humano válido. |
| `second_confirmation` | Sprint 18 (`release-confirmation.mjs`) | Segunda confirmación deliberada, **no-CI**. |
| `signatures_ok` | Sprint 23 (`editorial-signature.mjs`) | Ninguna firma criptográfica presente e inválida. |

```
gate_open        = TODAS las condiciones anteriores == true
ready_to_publish = gate_open && PRODUCTION_PUBLISH_ENABLED
production_enabled = false   (INVARIANTE de este sprint)
```

## 3. Las dos barreras

1. **Barrera de condiciones (`gate_open`)**: la decisión editorial y los controles
   de release. Modela "el contenido está listo y autorizado".
2. **Barrera de bandera (`PRODUCTION_PUBLISH_ENABLED`)**: interruptor global,
   independiente, que modela "procede publicar ahora". Está en `false`.

Que existan **dos barreras separadas** evita que una sola persona o un solo
descuido (p. ej. un set de decisiones completo) dispare producción.

## 4. Firmas criptográficas y el gate

Las firmas son **opcionales**: `signatures_ok` se cumple si no hay ninguna firma
*presente e inválida*. Con la regla explícita `requireSignatures=true`, el gate
además exige que **todas** las decisiones estén firmadas y verificadas. En
ningún caso una firma —ni siquiera de ejemplo— abre el gate: la bandera global
sigue mandando.

## 5. Qué haría falta para habilitar producción (sprint futuro)

Fuera del alcance de este sprint. A modo de diseño, requeriría **todo** lo
siguiente, en este orden y documentado:

1. Decisión editorial real GO 8/8 firmada por reviewer + editor + owner
   (identidades distintas), con integridad de hash.
2. Sign-off editorial (Sprint 20) y segunda confirmación no-CI (Sprint 18).
3. (Recomendado) Firmas criptográficas verificadas de los 3 roles.
4. Cambio **explícito y revisado** de `PRODUCTION_PUBLISH_ENABLED` a `true`,
   acompañado de la escritura canónica con rollback (Sprint 18) y su registro.

Hasta que esos cuatro pasos se completen deliberadamente, el gate permanece
cerrado y `production_enabled:false`.

## 6. Verificación

```bash
npm --prefix api-server run gate         # texto
npm --prefix api-server run gate:json    # JSON auditable
npm --prefix api-server run gate:check   # falla si el artefacto no está al día o production_enabled!=false
```

Los tests (`api-server/test/sprint23-*.test.mjs`) demuestran con fixtures que,
aun simulando 8/8 aprobados **con firmas de ejemplo válidas**, sign-off y segunda
confirmación, el gate **no** se abre para producción mientras la bandera esté en
`false`.
