<!--
PLANTILLA REUTILIZABLE · GEOPÓLEM / SENTINEL
Copia este archivo a un nuevo guion y reemplaza los marcadores [entre corchetes].
No borres las secciones obligatorias. Estructura editorial innegociable:
Hecho · Evaluación · Hipótesis. Correlación temporal no implica causalidad.
Cierre obligatorio: «GEOPÓLEM. Bienvenidos al tablero.»
-->

# Guion de video GEOPÓLEM — [Título del video]

> **Estructura obligatoria:** todo guion separa de forma explícita **Hecho**, **Evaluación** e **Hipótesis**.
> Ninguna afirmación geopolítica se publica sin fuente abierta verificable y validación cruzada con el tablero SENTINEL.

---

## 1. Metadata del contenido

| Campo | Valor |
|-------|-------|
| **Título** | [Título editorial corto] |
| **Fecha** | [AAAA-MM-DD] |
| **Autor / responsable** | [Nombre · rol editorial] |
| **Plataforma(s)** | [YouTube / Reels / TikTok / Shorts / X / LinkedIn] |
| **Duración objetivo** | [mm:ss] |
| **Formato** | [Horizontal 16:9 · Vertical 9:16 · Brief 90s] |
| **Estado** | [Borrador · Verificación OSINT · Revisión editorial · Publicado] |
| **Brief SENTINEL relacionado** | [Título del brief semanal] |
| **Semana SENTINEL** | [AAAA-MM-DD → AAAA-MM-DD · zona horaria] |
| **Categoría de video** | [manifiesto / osint / chokepoints / energia / agua / doctrina / brief90s · ver `videos.js`] |

---

## 2. Tesis del video

> Una sola frase que resuma la lectura estratégica. No es un titular sensacionalista; es la afirmación que el video sostiene con evidencia.

[Ejemplo Myanmar/Kachin: «No es solo una inundación: es una inundación dentro de una guerra civil que bloquea ayuda, movilidad y alimento.»]

---

## 3. Estructura obligatoria (Hecho · Evaluación · Hipótesis)

> Las tres capas se mantienen separadas y etiquetadas en pantalla y en la voz. Nunca se mezcla un hecho con una hipótesis.

### 3.1 Hecho
Datos verificables, con fuente y coordenadas. Nada interpretativo aquí.

> [Ejemplo Hasakah/Siria: «NASA/EONET registró "Wildfire in Syrian Arab Republic 1029038" con geometría del 22 de junio de 2026 en torno a 41.0729, 36.9357. Fuentes regionales reportaron incendios en Hasakah que afectaron trigo, cebada y pastizales.»]

### 3.2 Evaluación
Qué significa el hecho en su contexto geopolítico. Análisis, no especulación.

> [Ejemplo Hasakah/Siria: «Hasakah es un espacio agrícola y fronterizo con autoridades fragmentadas. El fuego sobre trigo y cebada golpea un recurso de legitimidad: alimento, control local y capacidad de respuesta.»]

### 3.3 Hipótesis
Escenario condicional a futuro, marcado claramente como hipótesis.

> [Ejemplo Hasakah/Siria: «Cuando arde el trigo en soberanía fragmentada, el margen administrativo para apagar, indemnizar, resembrar y garantizar pan se convierte en poder político.»]

---

## 4. Registro de afirmaciones (Claim register)

> Cada afirmación geopolítica del guion entra aquí antes de grabar. Si una fila no tiene fuente verificable, **no se publica**.

| # | Afirmación (claim) | Categoría | ID dato SENTINEL / Coordenadas | Fuente (URL abierta) | Confianza | Estado editorial |
|---|--------------------|-----------|--------------------------------|----------------------|-----------|------------------|
| 1 | [Texto literal de la afirmación] | [energy / geopolitics / security / environment] | [evt_xxxx · EONET_xxxxx · lat,lon] | [https://…] | [Alta / Media / Baja] | [Verificado / En revisión / Observación] |
| 2 | [Inundación obliga a evacuar >10.000 personas en Mogaung, Kachin] | environment | [EONET_20736 · 96.0263, 19.9105] | [https://eonet.gsfc.nasa.gov/api/v3/events/EONET_20736] | Alta | Verificado |
| 3 | [RDC: simultaneidad país-evento sin impacto directo confirmado] | security | [EONET_20765 · 26.44, -6.33] | [https://www.ungeneva.org/en/news-media/news/2026/06/120110/...] | Baja | Observación |

**Categorías permitidas:** `energy` · `geopolitics` · `security` · `environment`.

---

## 5. Validación cruzada con el tablero SENTINEL

> Antes de grabar, se confirma que cada punto cae en el teatro correcto del tablero. Coordenadas mal ubicadas = video rechazado.

| Parámetro | Valor |
|-----------|-------|
| **Coordenadas (lat, lon)** | [19.9105, 96.0263] |
| **Bounding box (bbox)** | [min_lon, min_lat, max_lon, max_lat] |
| **Capa de eventos** | [feed SENTINEL/GDELT · evt_xxxx] |
| **Capa ambiental** | [NASA EONET · EONET_xxxxx / USGS sismo M5+] |
| **Capa de conflicto** | [región/actor · p. ej. M23/FARDC, SDF, junta Myanmar] |
| **Capa de fuentes** | [conflict-events.json · institucional · prensa local] |
| **Captura / referencia del mapa** | [docs/templates/assets/[slug]-mapa.png o ruta de captura] |
| **Resultado de validación** | [Confirmado · En observación · Rechazado] |

> Recordatorio: **correlación temporal no implica causalidad.** Un acople se declara «confirmado» solo con evidencia abierta de impacto; de lo contrario queda en «observación».

---

## 6. Contrato visual (Visual contract)

**Mapas requeridos:**
- [Mapa del teatro correcto con la coordenada exacta marcada]
- [Vista regional con bbox del acople conflicto-ambiente]

**Zonas de influencia:**
- [Actores y control territorial relevantes · p. ej. corredor Myanmar-Yunnan-Índico]

**Capas de datos en pantalla:**
- [Capa de conflicto · capa ambiental · capa de fuentes SENTINEL]

**Etiquetas obligatorias:**
- [Coordenadas en mono · ID EONET/evt · fecha del evento · nombre de la región]

**Visuales genéricos PROHIBIDOS:**
- ❌ Mapas decorativos sin coordenadas ni fuente.
- ❌ Imágenes de stock de «guerra» o «crisis» sin relación con el teatro real.
- ❌ Teatro geográfico equivocado (p. ej. mostrar un mapa de Siria al hablar de la RDC).
- ❌ Banderas/flechas dramáticas sin dato detrás.
- ❌ Tono «última hora» con gráficos rojos parpadeantes.

---

## 7. Requisitos de fuentes

- **Solo fuentes abiertas y verificables** (URL pública accesible). Sin enlaces internos ni capturas sin origen.
- **Preferencia institucional:** ONU, NASA EONET, USGS, agencias humanitarias, organismos oficiales. Prensa local solo como complemento, nunca como única fuente.
- **El feed SENTINEL** (`data/sentinel/conflict-events.json`) es la columna vertebral de trazabilidad.
- **Formato de cita** (en descripción y, si aplica, en pantalla):

  ```
  [Institución / medio]. "[Título]". [AAAA-MM-DD]. [URL completa].
  ```

  > Ejemplo: `NASA EONET. "Flood in Myanmar 1103975". 2026-06-23. https://eonet.gsfc.nasa.gov/api/v3/events/EONET_20736`

---

## 8. Guion con timecodes

> Cada bloque indica entrada/salida. El bloque Hecho/Evaluación/Hipótesis se rotula en pantalla.

| Timecode | Sección | Contenido / locución | Visual |
|----------|---------|----------------------|--------|
| [00:00–00:06] | **Hook** | [Frase de entrada sin sensacionalismo] | [Mapa con coordenada] |
| [00:06–00:20] | **Contexto** | [Marco mínimo necesario] | [Vista regional] |
| [00:20–00:40] | **Hecho** | [Dato verificable + fuente] | [Capa ambiental + etiqueta EONET] |
| [00:40–01:00] | **Evaluación** | [Significado geopolítico] | [Capa de conflicto / zonas de influencia] |
| [01:00–01:20] | **Hipótesis** | [Escenario condicional, rotulado] | [Esquema de escenarios] |
| [01:20–01:35] | **Lectura estratégica** | [Encaje tripolar: EE.UU./UE · China · Rusia] | [Diagrama tripolar] |
| [01:35–01:45] | **Cierre** | «GEOPÓLEM. Bienvenidos al tablero.» | [Logo + marca de agua GEOPÓLEM] |

---

## 9. Guía de audio / voz

- **Cadencia tranquila y explicativa.** Ritmo de análisis, no de «última hora».
- Sin gritos, sin música de tensión ascendente, sin urgencia artificial.
- Pausas para que el dato respire; el tono transmite autoridad serena, no alarma.
- La hipótesis se enuncia con marcadores condicionales claros («si…», «podría…»).
- Pronunciación cuidada de topónimos y nombres de actores.

---

## 10. Adaptación social

### YouTube (largo / horizontal)
- Título, descripción con todas las fuentes citadas, capítulos por timecode (Hook / Hecho / Evaluación / Hipótesis / Lectura estratégica).
- Cierre verbal y visual: «GEOPÓLEM. Bienvenidos al tablero.»

### Reels / TikTok / Shorts (vertical 9:16)
- Versión condensada ≤ 60 s: Hook → Hecho → una línea de Evaluación → Hipótesis breve.
- Subtítulos quemados. Coordenadas visibles. Hashtags: `#GEOPÓLEM #OSINT #Geopolítica #BienvenidosAlTablero` + específicos del caso.

### X (hilo)
- 1/ Hecho con coordenadas y fuente · 2/ Evaluación · 3/ Hipótesis (marcada) · 4/ Lectura estratégica · 5/ Fuentes (URLs) + cierre de marca.
- Imagen del mapa del teatro correcto en el primer post.

### LinkedIn (post)
- Tono analítico institucional. Párrafo de contexto, separación explícita Hecho/Evaluación/Hipótesis, fuentes enlazadas al final, sin clickbait.

---

## 11. Checklist final (antes de publicar)

- [ ] **Ninguna afirmación sin fuente** abierta y verificable (ver sección 4).
- [ ] **Teatro del mapa correcto** — coordenadas en la región real del evento (ver sección 5).
- [ ] **Coordenadas validadas** contra el tablero SENTINEL y la capa ambiental.
- [ ] **Hecho, Evaluación e Hipótesis separados** y rotulados, sin mezclarse.
- [ ] **Marca de agua GEOPÓLEM** presente en todo el video.
- [ ] **Disclaimer** si hay acople conflicto-ambiente: «Correlación temporal no implica causalidad.»
- [ ] **Cierre obligatorio**: el video termina con **«GEOPÓLEM. Bienvenidos al tablero.»**
