# GEOPÓLEM — Command App / Situation Room (MVP v1.6)

> **Bienvenido al tablero.**
> GEO + PÓLEMOS · Sala situacional editorial · Cartografía táctica · Guerra híbrida · Sistema-mundo.

Prototipo editorial basado en fuentes abiertas. **No sustituye fuentes oficiales ni uso operativo.**

---

## Cómo ejecutar

App con backend ligero. Inicia el servidor Python para servir el front y la API:

```bash
cd /home/user/workspace/geopolem-app
python3 server.py
# → http://localhost:8000
```

No hay `npm install` ni proceso de compilación. React, htm y Tailwind siguen llegando por CDN.

## Cómo desplegar

```python
deploy_website(project_path="/home/user/workspace/geopolem-app", site_name="GEOPÓLEM Command")
```

Requiere iniciar `server.py` en el puerto 8000 antes del despliegue para exponer la API privada del editor. Los datos base viven en `data.js`; las fichas creadas, el historial y los adjuntos del expediente documental viven en `data.db`.

---

## Archivos clave

| Archivo        | Tamaño | Rol |
|----------------|--------|-----|
| `index.html`   | ~7 KB  | Shell HTML + Tailwind CDN + tokens (paleta carbon/radar/alert/risk/intel), fuentes (Inter, Space Grotesk, JetBrains Mono), CSS de la rejilla táctica, animaciones y registro PWA. |
| `app.js`       | ~70 KB | App React (vía `esm.sh`) con htm para JSX-less. Contiene I18N (ES/EN/FR/DE/LB), todos los módulos: Command Boot, Header, KPI Strip, WorldMap SVG, Alerts Panel, Watchlist, Sistema-Mundo, Análisis (FODA / PESTEL / Actores / Matriz de Riesgo), Scenario Lab, Rearme/SIPRI, Monetización, Panel Editor con workflow multiusuario, Brief Diario, Content Studio, modo Sala Situacional. |
| `data.js`      | ~38 KB | Dataset mock: 10 focos con `title`, `region`, `category`, `intensity`, `coords`, `summary`, `foda`, `pestel`, `actores`, `risks`, `scenarios`. Más KPIs, brief diario, nodos del sistema-mundo y módulo MILEX/SIPRI. |
| `server.py`    | ~15 KB | Backend HTTP con SQLite, usuarios persistentes, sesiones por token, roles/permisos y endpoints `/api/login`, `/api/session`, `/api/users`, `/api/password`, `/api/focos`, `/api/attachments`, `/api/focos/{id}/dossier`, `/api/history`, `/api/health`. |
| `data.db`      | variable | Base SQLite creada al iniciar el backend. Guarda las fichas privadas del Panel Editor, el historial de cambios y los adjuntos del expediente documental. |
| `worldmap.js`  | ~3 KB  | Paths SVG de continentes (low-poly editorial, no topográfico) + helper de proyección equirectangular. |
| `manifest.webmanifest` | ~2 KB | Configuración PWA instalable: nombre, colores, modo standalone, iconos y accesos rápidos. |
| `service-worker.js` | ~2 KB | Caché básico de app shell para carga rápida y soporte offline parcial. |
| `icons/` | 3 SVG | Iconos 192, 512 y maskable para instalación móvil/escritorio. |

**Cero dependencias instaladas.** React 18, htm y todas las fuentes vienen por CDN. Tailwind se carga vía Play CDN para conservar el flujo de un solo archivo; el backend usa solo librerías estándar de Python.

---

## Cobertura de requisitos

- [x] **Dashboard principal con KPIs**: 8 KPIs (conflictos, agua, chokepoints, energía, migración, IA, salud, DDHH) en strip táctico.
- [x] **Mapa mundial interactivo SVG** con continentes, océanos, graticula y 10 hotspots clicables: Rearme global, Ucrania–Rusia, Israel–Gaza–Irán, Sahel, Bab el-Mandeb, Estambul/Bósforo, MENA agua, Asia del Sur agua, Stablecoins, IA narrativa.
- [x] **Panel lateral de alertas** por categorías con barra de intensidad y selección sincronizada.
- [x] **Watchlist** con tarjetas + filtros por categoría, región e intensidad (slider).
- [x] **Sistema-Mundo** con grafo de nodos y flujos: energía, comercio, alimentos, agua, datos/cables, migración, finanzas, clima — más fichas explicativas.
- [x] **Análisis Estratégico** con 4 pestañas: FODA, PESTEL, Actores (5 grupos), Matriz de Riesgo (gráfico probabilidad × impacto, tamaño = velocidad, color = contención).
- [x] **Scenario Lab** con 4 escenarios (base, escalada, ruptura, desescalada): señales tempranas, indicadores a vigilar, impacto en agua/energía/alimentos/migración/seguridad.
- [x] **Módulo Rearme / SIPRI** con KPI global, concentración top 3, regiones en aceleración, lectura GEOPÓLEM e indicadores 2026–2027.
- [x] **Módulo Monetización** con embudo GEOPÓLEM, líneas de ingresos, roadmap de ejecución y regla editorial para convertir audiencia en MRR sin diluir la marca.
- [x] **Panel editor privado y persistente** para crear nuevas fichas desde la app: login, SQLite, título, región, categoría, coordenadas, resumen, actores, fuentes, gancho editorial, intensidad y generación automática de estructura FODA/PESTEL/riesgos/escenarios.
- [x] **Roles y permisos editoriales** con sesión de Director Editorial, matriz visible y acciones protegidas por backend: ver, editar, revisar, publicar, adjuntar, exportar, eliminar y administrar seguridad.
- [x] **Multiusuario editorial real** con tabla `users`, tabla `sessions`, creación de usuarios por rol, desactivación segura, sesiones separadas y actor registrado en la bitácora.
- [x] **Archivo editorial** con pipeline Borrador → Verificación OSINT → Revisión editorial → Publicado, edición de fichas existentes, eliminación con confirmación y acceso directo al mapa.
- [x] **Historial de cambios** para registrar creación, actualización y eliminación de fichas, adjuntos y usuarios, incluyendo el actor que ejecutó cada acción.
- [x] **Expediente documental por ficha** con subida persistente de archivos, contador por tarjeta, descarga autenticada, eliminación y registro de acciones `attached` / `detached`.
- [x] **Clasificación OSINT de fuentes** por tipo documental, confiabilidad A-D y etiquetas editoriales.
- [x] **Checklist OSINT persistente** con geolocalización, fuentes abiertas, fecha/vigencia, riesgo, revisión de lenguaje/legalidad, revisor y notas.
- [x] **Dossier Markdown por ficha** generado desde la ficha, su workflow editorial, sus fuentes declaradas y el expediente documental clasificado.
- [x] **Cambio de clave** del editor desde la interfaz privada.
- [x] **Brief Diario** con 9 entradas filtradas por tema, fecha auto-localizada.
- [x] **Content Studio** con 4 formatos (Reel, Carrusel, Dossier, Ficha web) — salida simulada, sin generación real de archivos.
- [x] **Selector de idioma** ES / EN / FR / DE / LB con etiquetas principales traducidas.
- [x] **Modo sala situacional**: oscurece el fondo, intensifica el radar, añade indicador parpadeante.
- [x] **PWA instalable**: manifest, iconos, service worker y modo standalone.
- [x] **Responsive móvil/escritorio** verificado (Playwright 390px + 1440px).
- [x] **Advertencia editorial** visible en cada vista (banner ámbar).
- [x] **Sin localStorage/sessionStorage/cookies**.

---

## Decisiones de diseño

**Tecnología.** Elegí React + htm vía esm.sh en lugar del template Vite para conservar cero build y modificación rápida. La persistencia vive en `server.py` + SQLite para no complicar el MVP con paquetes, bundlers ni servicios externos.

**Paleta táctica.** Negro carbono (`#05080c` → `#283447`), cyan radar (`#22d3ee`), rojo alerta (`#ef4444`), ámbar riesgo (`#f59e0b`), verde inteligencia (`#10b981`), violeta IA, naranja migración, rosa DDHH. Cada categoría tiene su color asignado para reconocimiento inmediato en el mapa y los chips.

**Tipografía.** Display: Space Grotesk (geométrico, técnico). Body: Inter (legibilidad densa). Mono: JetBrains Mono para etiquetas tácticas, KPIs y coordenadas — todo en `tracking-widest` y mayúsculas para evocar la estética de OSINT/HUD.

**Mapa.** Continentes en SVG low-poly editorial, **no topográficos**. Esto es intencional: comunica que el mapa es una narrativa táctica, no un sistema GIS. Equirectangular permite plot directo de lat/lng. Hotspots tienen anillo `ping`, núcleo `pulse-dot` y halo de selección en cyan radar.

**Detalles editoriales.** Esquinas de marco (`corner-tl/tr/bl/br`) en cada panel, scanlines sutiles sobre el mapa, glow radar en el título de bienvenida, chips monoespaciados como en briefings. La densidad informativa supera deliberadamente a la "respiración" típica de SaaS porque es una sala situacional, no un landing.

**Sin sensacionalismo.** Copy directo en cada foco. Los escenarios no usan adjetivos emotivos; describen señales objetivas e indicadores a vigilar. La advertencia editorial es persistente y prominente.

**I18N.** Etiquetas de navegación, módulos y categorías traducidas a 5 idiomas; el contenido editorial de focos queda en español (decisión MVP — los focos son objetos de datos largos que se traducirían en una siguiente iteración).

---

## Limitaciones conocidas

1. **El contenido editorial detallado solo está en español.** Los nombres de pestañas y la navegación se traducen, pero los `summary`, `foda`, `pestel`, etc. quedan en ES (es lo declarado en el brief).
2. **Mapa low-poly editorial**, no topográficamente preciso. Es una decisión estética; añadir TopoJSON real es trivial pero pesado.
3. **Brief Diario es estático.** No hay fetch en vivo; las 9 entradas son ejemplos editoriales.
4. **Content Studio simula salida.** No genera archivos reales (Reel, PDF, etc.) — el botón es ilustrativo.
5. **Sin localStorage/cookies.** La sesión del editor vive en memoria React; si se refresca la página, hay que iniciar sesión otra vez.
6. **Persistencia SQLite para fichas.** Las fichas creadas se guardan en `data.db` y reaparecen al volver a entrar al editor.
7. **Adjuntos con límite MVP.** El expediente documental acepta archivos de hasta 7 MB por adjunto y los guarda en SQLite como base64; para una versión de producción conviene moverlos a almacenamiento de objetos.
8. **Autenticación de prototipo.** El login ya protege el panel con usuarios y sesiones persistentes, pero aún no reemplaza un sistema profesional con MFA, recuperación de cuenta y auditoría inmutable.
9. **Tailwind Play CDN** muestra un warning de consola en producción. Aceptable para un MVP; en una versión más madura se compilaría Tailwind a un CSS estático.

---

## Próximos pasos sugeridos

- **Traducir contenido de focos** a EN/FR/DE/LB y conectar el switcher de idioma a esos campos.
- **Paquete móvil GEOPÓLEM**: usar `/home/user/workspace/geopolem-mobile-app` como base Capacitor/PWA para iOS, Android, checklist de tiendas, splash, iconos y flujo de publicación.
- **Backend permanente GEOPÓLEM**: usar `/home/user/workspace/geopolem-production-backend` para alojar login, usuarios, sesiones, fichas, adjuntos e historial fuera del prototipo local.
- **API Render conectada**: el frontend apunta a `https://geopolem-api.onrender.com` mediante `window.GEOP_API_BASE`.
- **Reemplazar mapa low-poly por TopoJSON** (Natural Earth 110m) o usar D3-geo con proyección Robinson.
- **Conectar feeds OSINT reales** (ACLED, GDELT, UNHCR, IEA, Bellingcat) vía un backend Express con caché diaria. _Primer feed en marcha:_ **SENTINEL** consume `data/sentinel/conflict-events.json`, regenerado a diario desde GDELT por `scripts/sentinel_gdelt.py` y el workflow `.github/workflows/sentinel-gdelt.yml` (ver `data/sentinel/README.md`).
- **Generación real en Content Studio**: PPTX vía la skill office/pptx, PDFs editoriales con el branding.
- **Panel editorial avanzado**: MFA, revisión por pares con firmas, exportación a PDF/DOCX, permisos por célula editorial y bitácora inmutable.
- **Layer histórico temporal**: timeline en la parte inferior con scrubber para ver intensidad de focos a lo largo del tiempo.
- **Autenticación + workspaces** (cuando se valide modelo de producto).
- **Modo embedding** para incrustar el mapa en sitios editoriales.
- **Notificaciones / alertas push** cuando un indicador cruza un umbral.

---

## Project path

```
/home/user/workspace/geopolem-app
```

Despliegue listo con `deploy_website(project_path="/home/user/workspace/geopolem-app", site_name="GEOPÓLEM Command")`.
