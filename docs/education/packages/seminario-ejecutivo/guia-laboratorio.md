# Guía de laboratorio — Seminario ejecutivo (mapa offline)

> Material de **formación**. No sustituye la revisión editorial final ni activa producción.

## Objetivo

Usar el mapa offline y las matrices causales pre-rellenadas para **estresar
supuestos** y derivar una recomendación ejecutiva trazable.

## Requisitos

- Repositorio clonado (funciona offline tras la primera carga: PWA).
- No requiere base de datos ni servidor.

## Pasos

1. Abre los focos `stablecoins` y `rearme-global` en el mapa offline.
2. Revisa las fichas y las matrices causales pre-rellenadas del banco de casos.
3. Para cada matriz, identifica el enlace de mayor impacto y su evidencia
   (`source_slugs`). Cuestiona: ¿qué decisión cambiaría si ese enlace fallara?
4. Redacta una **nota de decisión de 1 página** con supuestos y fuentes.

## Verificación de trazabilidad

Antes de presentar, confirma que las matrices siguen respaldadas por la fuente:

```
node scripts/validate-causal-crosscheck.mjs --stage=rc --compare-staging
```

Los avisos `info` de tipo `stage_drift` indican que staging y RC divergen: útil
para debatir la madurez del dato antes de decidir.

## Evaluación

- Rúbricas: `rubrica-politica-energetica`, `rubrica-causalidad`, `rubrica-comunicacion`.
- La entrada del motor de puntuación es **anónima**.
