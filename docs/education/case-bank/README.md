# Banco de casos GEOPÓLEM (Sprint 25)

> **Advertencia editorial.** Casos docentes derivados automáticamente del
> RC verificado (`api/v1/conflicts.verified.enriched.json`). **No sustituyen la revisión
> editorial final** ni activan producción. Los campos sin dato en el
> contrato v1 se marcan como pendientes; no se añaden hechos nuevos.

- **Casos:** 10
- **Con enlaces causales:** 10
- **Con campos pendientes:** 6
- **Fase de datos:** `rc` (verificado, no producción)

## Casos

| conflict_id | Título | Tipo | Región | Enlaces causales | Pendientes |
|---|---|---|---|---|---|
| [`asia-agua`](fichas/asia-agua.rc.md) | Asia del Sur — Glaciares e Indo | `agua` | `asia_del_sur` | 1 | chokepoints |
| [`ia-narrativa`](fichas/ia-narrativa.rc.md) | IA / Riesgo narrativo global | `ia` | `global` | 1 | actors, resources, chokepoints |
| [`isr-gaza-irn`](fichas/isr-gaza-irn.rc.md) | Israel – Gaza – Irán | `conflicto` | `mena` | 1 | — |
| [`istanbul`](fichas/istanbul.rc.md) | Canal de Estambul / Bósforo | `chokepoint` | `eurasia` | 1 | — |
| [`mena-agua`](fichas/mena-agua.rc.md) | MENA — Estrés hídrico estructural | `agua` | `mena` | 1 | chokepoints |
| [`rearme-global`](fichas/rearme-global.rc.md) | Rearme global — gasto militar récord | `defensa` | `global` | 1 | resources, chokepoints |
| [`red-sea`](fichas/red-sea.rc.md) | Mar Rojo / Bab el-Mandeb | `chokepoint` | `mena` | 1 | — |
| [`sahel`](fichas/sahel.rc.md) | Sahel — Juntas militares y yihadismo | `conflicto` | `sahel` | 1 | chokepoints |
| [`stablecoins`](fichas/stablecoins.rc.md) | Stablecoins / desinformación financiera | `ia` | `global` | 1 | actors, resources, chokepoints |
| [`ukr-rus`](fichas/ukr-rus.rc.md) | Ucrania – Rusia | `conflicto` | `europa_del_este` | 1 | — |

## Estructura

- `fichas/<id>.rc.md` · `fichas/<id>.rc.json` — fichas docentes por conflicto.
- `matrices/<id>.matrix.json` — matrices causales pre-rellenadas.
- `case-bank.index.json` — índice máquina-legible.

## Regeneración

```bash
node scripts/export-education-fiches.mjs --all --stage=rc --write --out=docs/education/case-bank/fichas
node scripts/build-case-bank.mjs --write
```

