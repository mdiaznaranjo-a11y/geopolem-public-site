/* ============================================================
   GEOPÓLEM · Conflict Watchlist 2026
   Dataset editorial · corte mayo 2026

   AVISO: valores de probabilidad, impacto y confianza son
   estimaciones editoriales SIMULADAS para probar la lectura
   del tablero. No son monitoreo en vivo, parte militar ni
   predicción. Verificar siempre en fuente primaria.

   Método editorial: HECHO · EVALUACIÓN · HIPÓTESIS · SEÑAL
     hecho       — lo verificable y sostenido por fuentes abiertas
     evaluacion  — lectura analítica de GEOPÓLEM sobre ese hecho
     hipotesis   — escenario plausible, no confirmado
     senal       — indicador concreto a vigilar

   prob / impact: escala editorial 1–4
     1 bajo · 2 moderado · 3 alto · 4 muy alto
   confianza: alta | media | baja (densidad y consistencia de fuentes)
   ============================================================ */

window.CW_DATA = [
  {
    id: "ucrania-rusia",
    title: "Ucrania y Rusia occidental",
    region: "Europa",
    type: "Interestatal",
    intensity: "alta",
    coords: [49.0, 31.0],
    prob: 4, impact: 4, confianza: "alta",
    summary: "La guerra interestatal entre Rusia y Ucrania continúa marcando la agenda de seguridad europea, con frentes activos, ataques de larga distancia y un debate sostenido sobre apoyo militar y diplomacia.",
    actors: "Federación de Rusia; Ucrania; aliados de la OTAN/UE como apoyo militar y económico.",
    humanitarian: "Desplazamiento interno y refugio en países vecinos; daños sistemáticos a infraestructura energética y civil.",
    outlook: "Continuidad de la guerra de desgaste en 2026, con incidentes recurrentes contra infraestructura energética y posible reapertura de canales diplomáticos.",
    watch: "Evolución de ataques de larga distancia, dinámica del frente este y movimientos en el Mar Negro.",
    hecho: "Frentes activos y campañas recurrentes de ataque a larga distancia contra infraestructura energética documentadas por fuentes abiertas.",
    evaluacion: "El conflicto se comporta como guerra de desgaste: los cambios territoriales son lentos y el centro de gravedad se ha desplazado hacia energía, logística y defensa aérea.",
    hipotesis: "Escenario plausible, no confirmado: rondas diplomáticas parciales conviviendo con combate sostenido, sin alto el fuego estable en el horizonte de análisis.",
    senal: "Frecuencia de salvas contra nodos energéticos, saturación de defensa aérea y actividad naval en el Mar Negro.",
    sources: ["ACLED", "CFR"]
  },
  {
    id: "israel-gaza-libano-iran",
    title: "Israel · Gaza · Líbano · eje regional",
    region: "Oriente Medio",
    type: "Guerra civil",
    intensity: "alta",
    coords: [31.5, 35.0],
    prob: 4, impact: 4, confianza: "alta",
    summary: "El conflicto en Gaza y la confrontación con actores en Líbano, Yemen e Irán mantienen activa una crisis regional con efectos en el Mar Rojo y rutas comerciales.",
    actors: "Israel; Hamás y otras facciones palestinas; Hezbolá; Irán y aliados regionales.",
    humanitarian: "Crisis humanitaria en Gaza con desplazamiento masivo y daños severos a infraestructura sanitaria.",
    outlook: "Riesgo persistente de escalada por incidentes en Líbano, ataques de larga distancia y reactivación del frente con Irán.",
    watch: "Treguas parciales, retorno de civiles, evolución del acceso humanitario y ataques en el Mar Rojo.",
    hecho: "Crisis humanitaria severa en Gaza y actividad militar cruzada con actores en Líbano, Yemen e Irán reportada de forma sostenida.",
    evaluacion: "No es un teatro único sino un sistema de frentes acoplados: un incidente local puede transmitir escalada a tres o cuatro escenarios a la vez.",
    hipotesis: "Escenario plausible, no confirmado: treguas parciales intermitentes con reactivaciones locales, sin arquitectura regional de desescalada.",
    senal: "Volumen de acceso humanitario, operatividad de cruces y ritmo de incidentes en Líbano y el Mar Rojo.",
    sources: ["ACLED", "CFR", "CICR"]
  },
  {
    id: "siria",
    title: "Siria",
    region: "Oriente Medio",
    type: "Guerra civil",
    intensity: "media",
    coords: [35.0, 38.0],
    prob: 2, impact: 3, confianza: "media",
    summary: "Tras más de una década de guerra, Siria mantiene un equilibrio frágil con bolsas de violencia, presencia de actores extranjeros y desafíos abiertos de reconstrucción y retorno de población.",
    actors: "Gobierno sirio; actores armados locales y regionales; presencia militar extranjera.",
    humanitarian: "Población desplazada de largo plazo, deterioro de servicios y economía en crisis.",
    outlook: "Inestabilidad persistente con episodios localizados; reconfiguración política aún incierta.",
    watch: "Choques en el noreste, situación de los retornos y dinámica regional.",
    hecho: "Violencia territorializada en bolsas concretas y presencia militar extranjera en varias zonas del país.",
    evaluacion: "El país funciona como mosaico de controles superpuestos; la baja intensidad agregada oculta focos locales de alta letalidad.",
    hipotesis: "Escenario plausible, no confirmado: reconfiguración política lenta con episodios localizados antes que un colapso o una estabilización rápida.",
    senal: "Choques en el noreste, ritmo de retornos y cambios en el despliegue de actores externos.",
    sources: ["ACLED", "CICR"]
  },
  {
    id: "sudan",
    title: "Sudán",
    region: "África",
    type: "Guerra civil",
    intensity: "alta",
    coords: [15.0, 30.0],
    prob: 4, impact: 4, confianza: "media",
    summary: "La guerra civil entre las Fuerzas Armadas Sudanesas y las Fuerzas de Apoyo Rápido (RSF) sigue siendo una de las mayores crisis humanitarias del periodo, con fracturas internas y desplazamiento masivo.",
    actors: "Fuerzas Armadas de Sudán (SAF); Fuerzas de Apoyo Rápido (RSF) y facciones disidentes; actores locales.",
    humanitarian: "Riesgo de hambruna en varias regiones y colapso del sistema sanitario en zonas afectadas.",
    outlook: "Continuidad del conflicto en 2026 con posibles realineamientos internos en las RSF según señalan análisis recientes.",
    watch: "Acceso humanitario, dinámica en Darfur y Kordofán, y eventuales conversaciones de alto el fuego.",
    hecho: "Guerra abierta entre SAF y RSF con desplazamiento masivo y alerta alimentaria en varias regiones.",
    evaluacion: "La combinación de fragmentación de mando y bloqueo de acceso humanitario convierte a Sudán en el foco con peor relación entre severidad y cobertura informativa.",
    hipotesis: "Escenario plausible, no confirmado: realineamientos internos en las RSF que alteren el mapa de control sin resolver el conflicto.",
    senal: "Corredores de acceso humanitario, control de capitales estatales en Darfur y Kordofán, y contactos de alto el fuego.",
    sources: ["ACLED", "CICR"]
  },
  {
    id: "sahel",
    title: "Sahel central (Mali, Burkina Faso, Níger)",
    region: "África",
    type: "Insurgencia",
    intensity: "alta",
    coords: [14.0, -2.0],
    prob: 4, impact: 3, confianza: "media",
    summary: "Insurgencias yihadistas vinculadas a Al Qaeda y al Estado Islámico mantienen una violencia sostenida en el Sahel central, en un contexto de gobiernos militares y reconfiguración de alianzas externas.",
    actors: "JNIM (vinculado a Al Qaeda); ISGS (Estado Islámico en el Gran Sáhara); fuerzas estatales; actores externos.",
    humanitarian: "Desplazamiento creciente, ataques a aldeas y bloqueos a localidades.",
    outlook: "Tendencia de expansión de la violencia yihadista en 2026 según análisis abiertos.",
    watch: "Corredor tri-fronterizo, dinámica en Burkina Faso y derrames hacia el Golfo de Guinea.",
    hecho: "Violencia insurgente sostenida en el corredor tri-fronterizo y bloqueos prolongados sobre localidades.",
    evaluacion: "La presión se ejerce por asfixia económica de núcleos urbanos más que por conquista territorial clásica; eso desplaza el indicador útil hacia el acceso, no hacia la línea de frente.",
    hipotesis: "Escenario plausible, no confirmado: derrame progresivo hacia los estados costeros del Golfo de Guinea.",
    senal: "Bloqueos a ciudades, ataques en el norte de Benín, Togo y Ghana, y rotación de socios de seguridad externos.",
    sources: ["ACLED"]
  },
  {
    id: "rdc-este",
    title: "República Democrática del Congo (este)",
    region: "África",
    type: "Insurgencia",
    intensity: "alta",
    coords: [-1.0, 29.0],
    prob: 3, impact: 4, confianza: "media",
    summary: "El este de la RDC concentra varios conflictos superpuestos entre grupos armados, fuerzas estatales y actores regionales, con un componente humanitario severo agravado por brotes sanitarios.",
    actors: "M23 y otros grupos armados; Fuerzas Armadas de la RDC (FARDC); actores regionales.",
    humanitarian: "Desplazamiento masivo en Kivu Norte y Sur; brotes de ébola reportados en zonas de conflicto añaden presión humanitaria.",
    outlook: "Inestabilidad persistente con riesgo de escalada regional.",
    watch: "Negociaciones, dinámica del M23 y respuesta sanitaria internacional.",
    hecho: "Conflictos superpuestos en Kivu Norte y Sur con desplazamiento masivo y brotes sanitarios en zonas de combate.",
    evaluacion: "La superposición de guerra y emergencia sanitaria multiplica el coste humanitario por encima de lo que sugiere la intensidad militar aislada.",
    hipotesis: "Escenario plausible, no confirmado: internacionalización del conflicto por implicación de actores regionales vecinos.",
    senal: "Avances o repliegues del M23, continuidad de mediaciones regionales y capacidad de respuesta sanitaria internacional.",
    sources: ["ACLED", "CICR"]
  },
  {
    id: "somalia",
    title: "Somalia",
    region: "África",
    type: "Insurgencia",
    intensity: "media-alta",
    coords: [5.0, 45.0],
    prob: 3, impact: 3, confianza: "media",
    summary: "La insurgencia de Al Shabab mantiene capacidad de ataque y control territorial parcial frente al gobierno federal y fuerzas aliadas.",
    actors: "Al Shabab; gobierno federal de Somalia; misión de apoyo internacional.",
    humanitarian: "Inseguridad alimentaria recurrente y desplazamiento.",
    outlook: "Conflicto prolongado con oscilaciones por ofensivas estatales.",
    watch: "Operaciones combinadas, retiradas de misiones internacionales y dinámica clánica.",
    hecho: "Al Shabab conserva capacidad de ataque urbano y control parcial de territorio rural.",
    evaluacion: "El equilibrio depende menos de las ofensivas estatales que de la continuidad del apoyo internacional y de los alineamientos clánicos locales.",
    hipotesis: "Escenario plausible, no confirmado: recuperación insurgente de terreno en fases de transición de misiones internacionales.",
    senal: "Calendario de repliegue de misiones, atentados en Mogadiscio y realineamientos clánicos.",
    sources: ["ACLED"]
  },
  {
    id: "yemen-mar-rojo",
    title: "Yemen y Mar Rojo",
    region: "Oriente Medio",
    type: "Híbrida/marítima",
    intensity: "media-alta",
    coords: [15.0, 44.0],
    prob: 3, impact: 4, confianza: "media",
    summary: "Yemen combina una guerra civil prolongada con un escenario marítimo de alto riesgo en el Mar Rojo por ataques contra navegación comercial.",
    actors: "Huthis; gobierno de Yemen reconocido internacionalmente; coaliciones externas; navegación comercial afectada.",
    humanitarian: "Crisis humanitaria crónica e impacto en cadenas globales de suministro.",
    outlook: "Riesgo persistente de incidentes marítimos y de escalada por ataques cruzados con Israel y actores externos.",
    watch: "Tráfico por Bab el-Mandeb, alto el fuego interno y diplomacia regional.",
    hecho: "Guerra civil prolongada acoplada a un teatro marítimo con ataques contra navegación comercial.",
    evaluacion: "Es el foco con mayor capacidad de transmitir coste global desde una intensidad local moderada, por su efecto sobre rutas comerciales.",
    hipotesis: "Escenario plausible, no confirmado: reactivación de campañas marítimas ligada a la evolución del eje regional en Oriente Medio.",
    senal: "Volumen de tránsito por Bab el-Mandeb, primas de seguro marítimo y reanudación de ataques contra buques.",
    sources: ["ACLED", "CFR"]
  },
  {
    id: "myanmar",
    title: "Myanmar",
    region: "Asia",
    type: "Guerra civil",
    intensity: "alta",
    coords: [21.0, 96.0],
    prob: 3, impact: 4, confianza: "media",
    summary: "La guerra civil entre la junta militar y una coalición amplia de fuerzas de resistencia y ejércitos étnicos se ha intensificado, con avances territoriales relevantes para los grupos opositores.",
    actors: "Junta militar (Tatmadaw); Gobierno de Unidad Nacional (NUG); ejércitos étnicos (EAOs).",
    humanitarian: "Desplazamiento masivo y restricciones de acceso humanitario.",
    outlook: "Reconfiguración del mapa territorial con presión creciente sobre la junta.",
    watch: "Estado de Shan y Rakhine, frontera con China, situación de civiles.",
    hecho: "Avances territoriales de ejércitos étnicos y fuerzas de resistencia frente a la junta, con desplazamiento masivo.",
    evaluacion: "Es uno de los pocos focos donde el mapa de control cambia de forma apreciable; la restricción de acceso informativo mantiene alta la incertidumbre.",
    hipotesis: "Escenario plausible, no confirmado: fragmentación territorial estable en lugar de sustitución del poder central.",
    senal: "Combates en Shan y Rakhine, cierres fronterizos con China y capacidad aérea de la junta.",
    sources: ["ACLED"]
  },
  {
    id: "pakistan-afganistan",
    title: "Frontera Pakistán – Afganistán",
    region: "Asia",
    type: "Insurgencia",
    intensity: "media",
    coords: [31.0, 69.0],
    prob: 3, impact: 2, confianza: "media",
    summary: "Aumento de la militancia en zonas tribales del oeste de Pakistán, con presión del TTP y tensiones cruzadas con el régimen talibán afgano.",
    actors: "Tehrik-i-Taliban Pakistan (TTP); fuerzas de seguridad de Pakistán; Talibán afgano; otros grupos.",
    humanitarian: "Desplazamiento puntual y daños a infraestructura local.",
    outlook: "Tendencia al alza de la militancia en 2026 según análisis abiertos.",
    watch: "Incidentes transfronterizos, ataques en Khyber Pakhtunkhwa y Baluchistán.",
    hecho: "Incremento de ataques militantes en Khyber Pakhtunkhwa y Baluchistán y fricción transfronteriza recurrente.",
    evaluacion: "El riesgo relevante no es territorial sino interestatal: la respuesta pakistaní a ataques internos condiciona la relación con Kabul.",
    hipotesis: "Escenario plausible, no confirmado: episodios de fuego transfronterizo más frecuentes sin apertura de un conflicto abierto.",
    senal: "Ataques a puestos militares, cierres de pasos fronterizos y retórica oficial cruzada.",
    sources: ["ACLED"]
  },
  {
    id: "haiti",
    title: "Haití",
    region: "América",
    type: "Crimen organizado",
    intensity: "alta",
    coords: [19.0, -72.5],
    prob: 3, impact: 4, confianza: "media",
    summary: "Crisis de Estado con dominio territorial extendido de pandillas armadas, especialmente en Puerto Príncipe, y una transición política frágil.",
    actors: "Coaliciones de pandillas; gobierno de transición; misión de seguridad internacional.",
    humanitarian: "Hambre aguda, desplazamiento urbano y ataques a hospitales y escuelas.",
    outlook: "Riesgo de mayor fragmentación si la misión internacional pierde capacidad operativa.",
    watch: "Despliegues internacionales, control territorial en Puerto Príncipe, calendario electoral.",
    hecho: "Control territorial extendido de coaliciones de pandillas en Puerto Príncipe y transición política sin calendario consolidado.",
    evaluacion: "Es un caso de erosión estatal más que de conflicto armado clásico: los indicadores útiles son urbanos, no militares.",
    hipotesis: "Escenario plausible, no confirmado: mayor fragmentación si la misión internacional pierde capacidad operativa o financiación.",
    senal: "Cobertura del aeropuerto y puerto, despliegues internacionales efectivos y fijación de calendario electoral.",
    sources: ["ACLED", "CICR"]
  },
  {
    id: "colombia-venezuela",
    title: "Frontera Colombia – Venezuela",
    region: "América",
    type: "Crimen organizado",
    intensity: "media",
    coords: [7.0, -72.0],
    prob: 2, impact: 2, confianza: "baja",
    summary: "Zona de actividad de grupos armados —disidencias de las FARC, ELN, estructuras criminales— con tensiones bilaterales recurrentes y avisos de viaje activos.",
    actors: "Disidencias de las FARC; ELN; grupos armados organizados; fuerzas de seguridad de ambos países.",
    humanitarian: "Desplazamiento forzado y violencia contra líderes sociales.",
    outlook: "Negociaciones intermitentes en Colombia; volatilidad por la situación interna venezolana.",
    watch: "Diálogos con ELN, control territorial en Catatumbo y Arauca, tensión electoral en Venezuela.",
    hecho: "Presencia sostenida de grupos armados organizados en Catatumbo y Arauca con desplazamiento forzado asociado.",
    evaluacion: "La frontera funciona como economía de renta ilícita más que como frente; la variable decisiva es política interna a ambos lados.",
    hipotesis: "Escenario plausible, no confirmado: reconfiguración de control armado si se rompen o reanudan los diálogos.",
    senal: "Estado de los diálogos con el ELN, homicidios de líderes sociales y tensión bilateral declarada.",
    sources: ["ACLED"]
  },
  {
    id: "mexico",
    title: "México · violencia criminal",
    region: "América",
    type: "Crimen organizado",
    intensity: "media",
    coords: [23.0, -102.0],
    prob: 2, impact: 3, confianza: "media",
    summary: "Violencia criminal de alta intensidad en varios estados, con choques entre cárteles, ataques a fuerzas de seguridad y presión sobre periodistas y autoridades locales.",
    actors: "Cárteles mexicanos; fuerzas federales y estatales; Guardia Nacional.",
    humanitarian: "Desplazamientos internos, asesinatos selectivos y desapariciones.",
    outlook: "Continuidad de la violencia con focos regionales y debate sobre cooperación con EE. UU.",
    watch: "Sinaloa, Michoacán, Guerrero y frontera norte.",
    hecho: "Violencia criminal concentrada en estados concretos, con desplazamiento interno y presión sobre autoridades locales y prensa.",
    evaluacion: "No es un conflicto armado en sentido jurídico, pero produce indicadores humanitarios comparables en zonas específicas.",
    hipotesis: "Escenario plausible, no confirmado: cambios en el marco de cooperación bilateral con Estados Unidos que alteren la presión sobre cárteles.",
    senal: "Fragmentación de estructuras en Sinaloa, desplazamiento en Michoacán y Guerrero, y decisiones de cooperación bilateral.",
    sources: ["ACLED"]
  },
  {
    id: "mozambique-norte",
    title: "Mozambique (norte)",
    region: "África",
    type: "Insurgencia",
    intensity: "media",
    coords: [-12.0, 40.0],
    prob: 2, impact: 2, confianza: "baja",
    summary: "La insurgencia conocida como Estado Islámico de Mozambique (ISM) mantiene movilidad y ataques en Cabo Delgado y áreas adyacentes, con impacto en proyectos de gas.",
    actors: "ISM/Ansar al-Sunna; fuerzas armadas de Mozambique; tropas ruandesas y SAMIM (en evolución).",
    humanitarian: "Desplazamiento y retorno parcial, escuelas atacadas.",
    outlook: "Oscilación con repuntes periódicos; relevancia económica por proyectos energéticos.",
    watch: "Cabo Delgado, frontera con Tanzania, proyectos LNG.",
    hecho: "Ataques recurrentes en Cabo Delgado con desplazamiento y retornos parciales alternados.",
    evaluacion: "La insurgencia opera por movilidad, no por control; los repuntes se leen mejor como ciclos que como tendencia lineal.",
    hipotesis: "Escenario plausible, no confirmado: repunte asociado a la reactivación de proyectos energéticos en la provincia.",
    senal: "Decisiones de inversión sobre proyectos LNG, ataques cerca de la frontera con Tanzania y ritmo de retornos.",
    sources: ["ACLED"]
  },
  {
    id: "baltico-mar-norte",
    title: "Mar Báltico y Mar del Norte · guerra híbrida",
    region: "Europa",
    type: "Híbrida/marítima",
    intensity: "media",
    coords: [58.0, 15.0],
    prob: 3, impact: 3, confianza: "baja",
    summary: "Incidentes contra cables submarinos, gasoductos y otras infraestructuras críticas han llevado a la OTAN y la UE a tratar el entorno marítimo del norte de Europa como dominio de seguridad propio, con sospechas recurrentes sobre actores ligados a Rusia.",
    actors: "Estados ribereños del Báltico y Mar del Norte; OTAN; UE; sospechas sobre actores ligados a Rusia.",
    humanitarian: "Impacto indirecto sobre energía, telecomunicaciones y servicios.",
    outlook: "Más incidentes contra infraestructura submarina y respuestas coordinadas previsibles en 2026.",
    watch: "Patrullas conjuntas, atribución de incidentes y resiliencia de cables y gasoductos.",
    hecho: "Serie de incidentes sobre cables y gasoductos submarinos y despliegue de misiones de vigilancia aliadas.",
    evaluacion: "La atribución es el punto débil del expediente: la ambigüedad forma parte del método, y por eso la confianza analítica es baja pese al impacto potencial.",
    hipotesis: "Escenario plausible, no confirmado: nuevos incidentes sin atribución formal que fuercen medidas legales y de patrullaje más duras.",
    senal: "Detenciones de buques, cambios normativos sobre flota en la sombra y tiempos de reparación de cables.",
    sources: ["ACLED", "CFR"]
  }
];

window.CW_INTENSITY_RANK = { "alta": 3, "media-alta": 2, "media": 1 };
window.CW_INTENSITY_LABEL = { "alta": "Alta", "media-alta": "Media-alta", "media": "Media" };

/* Escenarios prospectivos (marco de análisis, no predicción) */
window.CW_SCENARIOS = [
  {
    horizon: "30 días",
    label: "Escenario base",
    tone: "base",
    text: "Continuidad sin ruptura: los focos de alta intensidad mantienen su patrón actual y la variación se concentra en acceso humanitario e infraestructura energética.",
    indicator: "Sin cambios de control territorial relevantes en Ucrania, Sudán ni Myanmar."
  },
  {
    horizon: "90 días",
    label: "Escenario de riesgo",
    tone: "risk",
    text: "Acoplamiento regional: un incidente en el eje de Oriente Medio o en el Mar Rojo se transmite a rutas comerciales y eleva el coste global de un conflicto de intensidad local.",
    indicator: "Reanudación sostenida de ataques a navegación comercial o incidentes en Líbano."
  },
  {
    horizon: "180 días",
    label: "Escenario de apertura",
    tone: "open",
    text: "Ventanas de negociación parciales en uno o dos focos —altos el fuego locales, corredores humanitarios estables— sin resolución del conflicto de fondo.",
    indicator: "Contactos formales sostenidos y apertura verificable de corredores de acceso."
  }
];

/* Source stack — fuentes visibles, no conectadas a APIs en esta maqueta */
window.CW_SOURCES = [
  { name: "ACLED", scope: "Eventos de violencia política y protestas", url: "https://acleddata.com/global-analysis", reliability: "Alta", status: "No conectada" },
  { name: "CFR", scope: "Análisis y trackers de conflicto", url: "https://www.cfr.org/global-conflict-tracker", reliability: "Alta", status: "No conectada" },
  { name: "CICR / ICRC", scope: "Marco humanitario y DIH", url: "https://www.icrc.org", reliability: "Alta", status: "No conectada" },
  { name: "OCHA", scope: "Acceso humanitario y necesidades", url: "https://www.unocha.org", reliability: "Alta", status: "No conectada" },
  { name: "Prensa internacional contrastada", scope: "Contexto y verificación cruzada", url: "", reliability: "Media", status: "Uso editorial" },
  { name: "OSINT abierto", scope: "Señales tempranas sin verificar", url: "", reliability: "Baja", status: "Solo como señal" }
];
