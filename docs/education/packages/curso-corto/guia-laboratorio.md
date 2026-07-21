# Guía de laboratorio — Curso corto (mapa offline)

> Material de **formación**. No sustituye la revisión editorial final ni activa producción.

## Objetivo

Explorar los focos del curso en el **mapa interactivo offline** de GEOPÓLEM y
construir la matriz causal del caso a partir de datos verificados.

## Requisitos

- Repositorio clonado (no requiere red tras la primera carga: PWA/service-worker).
- Navegador moderno. No se necesita base de datos ni servidor.

## Pasos

1. Abre la aplicación y localiza el foco del caso (`ukr-rus` o `red-sea`).
2. Usa los filtros y deep-links para aislar el foco (ver `deeplinks.mjs`, `public-enriched.mjs`).
3. Abre la ficha del caso en `docs/education/case-bank/fichas/`.
4. Completa la **matriz causal**: parte de la matriz pre-rellenada
   (`docs/education/case-bank/matrices/<caso>.matrix.json`) y justifica cada
   `link_type` con la evidencia (`source_slugs`) de la ficha.
5. Marca como `pending` cualquier campo sin dato verificado. **No inventes datos.**

## Verificación de coherencia

Antes de entregar, comprueba que tu matriz sigue coincidiendo con las fuentes:

```
node scripts/validate-causal-crosscheck.mjs --stage=rc
```

Cualquier divergencia de severidad `error` indica que la matriz afirma algo que
la fuente no respalda; los `warning` señalan nodos sin respaldo directo.

## Entrega y evaluación

- Entrega la matriz completada y un párrafo de síntesis (máx. 200 palabras).
- La evaluación usa `rubrica-causalidad` y `rubrica-validacion-fuentes`.
- La entrada del motor de puntuación es **anónima**.
