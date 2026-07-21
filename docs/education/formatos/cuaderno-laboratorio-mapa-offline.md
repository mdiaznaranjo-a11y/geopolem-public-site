# Cuaderno de laboratorio: mapa GEOPÓLEM en modo offline / PWA

> **Advertencia editorial.** Material de FORMACIÓN. **No sustituye la revisión
> editorial final** ni activa producción. Todo el trabajo se realiza contra los
> artefactos JSON versionados y la app local (fallback), **sin base de datos ni
> red**. La producción permanece bloqueada por política.

- **Duración:** 2–3 h (autónomo o guiado).
- **Público:** estudiantes, analistas OSINT, docentes.
- **Formato base:** `formatos/laboratorio-mapa-interactivo.md`.
- **Plantilla de entrega:** `plantillas/actividad-mapa.template.md`.
- **Módulos técnicos alineados:** `deeplinks.mjs` (Sprint 11), `public-enriched.mjs`
  (filtros), `service-worker.js` (PWA/offline), `worldmap.js` (render).

Este cuaderno es un **notebook Markdown**: cada estación tiene celdas de
*acción* (qué hacer), *entrada* (comando/URL) y *registro* (dónde anotas lo que
observas). No requiere ejecutar código de servidor.

---

## 0. Preparación del entorno offline

**Acción.** Servir el sitio estático localmente y verificar que la PWA cachea
los artefactos para uso sin red.

**Entrada.**

```bash
# Desde la raíz del repositorio (hosting estático, sin backend):
python3 -m http.server 8000      # o cualquier servidor estático
# Abre http://localhost:8000/index.html
```

**Registro.**

- [ ] La página carga sin llamadas a un backend (modo fallback / `data.js`).
- [ ] El `service-worker.js` queda registrado (DevTools → Application → Service Workers).
- [ ] Tras la primera carga, desconecta la red y **recarga**: el mapa sigue
      disponible (cache PWA). Anota qué recursos se sirven desde caché.

> Arquitectura de datos (recordatorio): **API real v1 → JSON estático → fallback
> local**. En laboratorio trabajamos en los dos últimos escalones.

---

## 1. Localizar focos y leer el contrato v1

**Acción.** Cargar el mapa estático y ubicar los focos por coordenadas.

**Entrada.**

- FeatureCollection: `api/v1/conflicts/active/map.json`
- Enriquecido: `api/v1/conflicts/active/map.enriched.json`
- Detalle por foco: `api/v1/conflicts/<id>.json`
- Inventario: `data/conflicts.inventory.json`

**Registro.**

- [ ] Elige 3 focos del inventario y anota `id`, `location.latitude/longitude`
      y `metrics.intensity_level`.
- [ ] Contrasta cada foco con su ficha del banco de casos
      (`docs/education/case-bank/fichas/<id>.rc.md`).

---

## 2. Deep-links: abrir un foco y preservar filtros por URL

El módulo `deeplinks.mjs` codifica el estado del mapa en el **hash** de la URL
(sin `localStorage` ni cookies): es compartible y funciona offline.

**Claves reconocidas** (ver `FILTER_KEYS` en `deeplinks.mjs`):

| Clave | Significado | Ejemplo |
|---|---|---|
| `foco` (o `conflict`) | Foco/conflicto seleccionado | `#foco=red-sea` |
| `view` | Vista activa | `#view=map` |
| `region` | Región (`primary_region`) | `region=MENA` |
| `type` | Tipo de conflicto | `type=chokepoint` |
| `status` | Estado | `status=active` |
| `severity` | Intensidad (numérica) | `severity=4` |
| `resource` | Recurso | `resource=Petróleo` |
| `actor` | Actor | `actor=Hutíes` |
| `chokepoint` | Chokepoint | `chokepoint=Bab el-Mandeb` |

**Entrada (ejemplos de deep-link).**

```text
#foco=red-sea
#view=map&foco=isr-gaza-irn&region=MENA&severity=4
#view=map&resource=Petróleo&chokepoint=Bab el-Mandeb
```

**Registro.**

- [ ] Abre `index.html#foco=red-sea`: ¿se centra el mapa y se abre el detalle?
- [ ] Construye un deep-link que combine `region` + `type` + `severity` para uno
      de tus 3 focos y **comparte la URL** con un compañero (sin red: copiar/pegar).
- [ ] Verifica que valores vacíos, `all` o inválidos se ignoran sin romper la vista
      (degradación limpia).

---

## 3. Filtros: del inventario al mapa

**Acción.** Reproducir filtros del mapa y comprobar coherencia con los datos.

**Entrada.**

- Módulo de filtros públicos: `public-enriched.mjs`.
- Dataset: `data/conflicts.inventory.json` (campos `primary_region`,
  `conflict_type`, `status`, `intensity_level`, `energy_dimension`).

**Registro.**

- [ ] Filtra por `region=MENA`: ¿qué focos quedan? Contrástalos con el inventario.
- [ ] Filtra por `severity>=4`: enumera los focos y su `intensity_level`.
- [ ] Filtra por `chokepoint` con `energy_flow_relevance=true`: relaciona cada
      uno con su foco de origen.

---

## 4. Fuentes y cadena causal desde el mapa

**Acción.** Desde un foco del mapa, navegar a sus fuentes verificadas y a su
cadena causal, usando la ficha del banco de casos.

**Entrada.**

- Ficha JSON: `docs/education/case-bank/fichas/<id>.rc.json`
- Matriz causal: `docs/education/case-bank/matrices/<id>.matrix.json`

**Registro.**

- [ ] Para tu foco, lista las `sources` (`slug`, `publisher`, `url`,
      `verification`). ¿Todas son `verified`?
- [ ] Copia la fila de `causal_links` (`link_type`, `title`, `source_slugs`).
- [ ] Marca los campos `pending` de la matriz y decide **qué evidencia** haría
      falta para completarlos (sin inventar datos).

---

## 5. Trabajo offline sostenido (PWA)

**Acción.** Comprobar que el laboratorio completo puede realizarse sin red.

**Registro.**

- [ ] Con la red desconectada: navega entre 3 focos vía deep-links.
- [ ] Con la red desconectada: abre 2 fichas del banco de casos.
- [ ] Anota cualquier recurso que **no** esté disponible offline y propón cómo
      incluirlo en el precache del `service-worker.js`.

---

## Entregable

Completa `plantillas/actividad-mapa.template.md` con:

1. Los 3 deep-links construidos (incluye al menos uno con filtros combinados).
2. Un patrón **regional** y un patrón **energético** observados, citando IDs de foco.
3. La matriz causal de un foco con los campos `pending` identificados.
4. Un breve informe de comportamiento **offline** (qué funcionó / qué faltó).

## Evaluación

Usa las rúbricas máquina-legibles del Sprint 25:

- `docs/education/rubrics/rubrica-uso-mapa.json`
- `docs/education/rubrics/rubrica-validacion-fuentes.json`
- `docs/education/rubrics/rubrica-causalidad.json`

## Garantías

- Sin secretos ni credenciales; sin activación de producción.
- Sólo datos ya verificados del proyecto; los faltantes quedan como `pending`.
- Todo el flujo es reproducible offline (hosting estático + PWA).
