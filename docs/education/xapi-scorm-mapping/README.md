# Mapeo opcional xAPI / SCORM (Sprint 27)

> **OPCIONAL y portable.** Este mapeo NO depende de ninguna plataforma LMS
> propietaria, NO genera paquetes cerrados (ZIP SCORM, `imsmanifest.xml`) y NO
> maneja datos personales. Es una **correspondencia conceptual** validable.

## Qué es (y qué no es)

- **Es**: un esquema JSON (`mapping.json`) que describe cómo los conceptos del
  manifiesto LMS portable (`docs/education/lms-export/lms.manifest.json`) se
  corresponden con **verbos/actividades xAPI** y con **elementos CMI de SCORM**.
- **No es**: un exportador de paquetes SCORM ni un cliente LRS. No se añade
  complejidad ni dependencias externas; el mapeo es texto validable.

## Por qué mapping portable en vez de paquete propietario

Generar un paquete SCORM/xAPI cerrado ataría el material a un empaquetador y a
supuestos de plataforma. En su lugar, publicamos el **mapa**: cualquiera puede
implementarlo en su LMS (Moodle, Canvas, un LRS xAPI…) sin que GEOPÓLEM dependa
de esa plataforma. Mantiene la arquitectura reversible.

## Conceptos mapeados

| Concepto (LMS manifest) | xAPI | SCORM CMI |
|---|---|---|
| `modules[]` | verbo `experienced`, actividad `module` | — |
| `cases[]` | verbo `completed`, actividad `lesson` | `cmi.completion_status` |
| `rubrics[]` | verbo `scored`, actividad `assessment` | `cmi.score.scaled`, `cmi.success_status` |
| `rubrics[].criteria[]` | verbo `answered`, actividad `question` | `cmi.interactions` |

La puntuación proviene del motor del Sprint 26: `percentage / 100` → `score.scaled`.

## Privacidad

- El `actor` de xAPI debe ser **anónimo/sintético** (nunca `mbox` ni datos
  personales). El mapeo declara `identity.actor_policy = "anonymous"`.
- Ninguna interacción persiste identidades ni notas reales.

## Validación

`mapping.json` se valida contra el manifiesto LMS real: cada `source_concept`
debe existir en el manifiesto. Ver `scripts/xapi-scorm-mapping.mjs`
(`npm run education:xapi:check`).
