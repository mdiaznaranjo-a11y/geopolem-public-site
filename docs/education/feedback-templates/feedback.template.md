# Plantilla de feedback docente (Sprint 27)

> Material de formación. No activa producción ni maneja datos personales.
> Los marcadores `{{...}}` los completa `scripts/render-feedback.mjs`.

## Feedback — {{rubric_title}}

- **Rúbrica**: `{{rubric_id}}`
- **Banda global**: **{{overall_level}}** ({{percentage}}%) — {{band_headline}}
- **Recomendación general**: {{band_recommendation}}

### Por criterio

{{criteria_block}}

<!--
Cada criterio se renderiza como:

- **{{title}}** — nivel `{{level}}` ({{points}} pts)
  - {{feedback}}
  - Recomendación pedagógica: {{level_recommendation}}
-->

---

_Feedback generado de forma determinista a partir de una evaluación anónima y
sintética. No corresponde a ninguna persona ni a una nota real._
