/* ============================================================
   GEOPÓLEM · Conflict Watchlist 2026 — Sala situacional
   Sitio estático · sin build · sin backend
   Idiomas: ES y EN completos; FR/DE/LB traducen la interfaz
   y recurren a EN para el texto largo (comportamiento heredado).
   ============================================================ */

(function () {
  "use strict";

  const DATA = window.CW_DATA || [];
  const SCENARIOS = window.CW_SCENARIOS || [];
  const SOURCES = window.CW_SOURCES || [];
  const RANK = window.CW_INTENSITY_RANK;
  const INTENSITY_LABEL = window.CW_INTENSITY_LABEL;

  const state = {
    filters: { intensity: "all", region: "all", type: "all" },
    search: "",
    selectedId: null,
    lang: "es"
  };

  /* ========================================================
     1. Vocabulario por idioma
     ======================================================== */
  const REGION_LABELS = {
    es: { "Europa":"Europa", "Oriente Medio":"Oriente Medio", "África":"África", "Asia":"Asia", "América":"América" },
    en: { "Europa":"Europe", "Oriente Medio":"Middle East", "África":"Africa", "Asia":"Asia", "América":"Americas" },
    fr: { "Europa":"Europe", "Oriente Medio":"Moyen-Orient", "África":"Afrique", "Asia":"Asie", "América":"Amériques" },
    de: { "Europa":"Europa", "Oriente Medio":"Naher Osten", "África":"Afrika", "Asia":"Asien", "América":"Amerika" },
    lb: { "Europa":"Europa", "Oriente Medio":"Mëttleren Osten", "África":"Afrika", "Asia":"Asien", "América":"Amerika" }
  };
  const TYPE_LABELS = {
    es: { "Interestatal":"Interestatal", "Guerra civil":"Guerra civil", "Insurgencia":"Insurgencia", "Crimen organizado":"Crimen organizado", "Híbrida/marítima":"Híbrida/marítima" },
    en: { "Interestatal":"Interstate", "Guerra civil":"Civil war", "Insurgencia":"Insurgency", "Crimen organizado":"Organized crime", "Híbrida/marítima":"Hybrid/maritime" },
    fr: { "Interestatal":"Interétatique", "Guerra civil":"Guerre civile", "Insurgencia":"Insurrection", "Crimen organizado":"Crime organisé", "Híbrida/marítima":"Hybride/maritime" },
    de: { "Interestatal":"Zwischenstaatlich", "Guerra civil":"Bürgerkrieg", "Insurgencia":"Aufstand", "Crimen organizado":"Organisierte Kriminalität", "Híbrida/marítima":"Hybrid/maritim" },
    lb: { "Interestatal":"Tëschestaatlech", "Guerra civil":"Biergerkrich", "Insurgencia":"Opstand", "Crimen organizado":"Organiséiert Kriminalitéit", "Híbrida/marítima":"Hybrid/maritim" }
  };
  const INTENSITY_LABELS = {
    es: INTENSITY_LABEL,
    en: { "alta":"High", "media-alta":"Medium-high", "media":"Medium" },
    fr: { "alta":"Élevée", "media-alta":"Moyenne-élevée", "media":"Moyenne" },
    de: { "alta":"Hoch", "media-alta":"Mittel-hoch", "media":"Mittel" },
    lb: { "alta":"Héich", "media-alta":"Mëttel-héich", "media":"Mëttel" }
  };
  const CONF_LABELS = {
    es: { alta:"Confianza alta", media:"Confianza media", baja:"Confianza baja" },
    en: { alta:"High confidence", media:"Medium confidence", baja:"Low confidence" },
    fr: { alta:"Confiance élevée", media:"Confiance moyenne", baja:"Confiance faible" },
    de: { alta:"Hohe Konfidenz", media:"Mittlere Konfidenz", baja:"Geringe Konfidenz" },
    lb: { alta:"Héich Konfidenz", media:"Mëttel Konfidenz", baja:"Niddreg Konfidenz" }
  };

  const CONF_SHORT = {
    es: { alta:"Alta", media:"Media", baja:"Baja" },
    en: { alta:"High", media:"Medium", baja:"Low" },
    fr: { alta:"Élevée", media:"Moyenne", baja:"Faible" },
    de: { alta:"Hoch", media:"Mittel", baja:"Gering" },
    lb: { alta:"Héich", media:"Mëttel", baja:"Niddreg" }
  };

  const TITLE_I18N = {
    en: {
      "ucrania-rusia":"Ukraine and western Russia",
      "israel-gaza-libano-iran":"Israel · Gaza · Lebanon · regional axis",
      "siria":"Syria", "sudan":"Sudan",
      "sahel":"Central Sahel (Mali, Burkina Faso, Niger)",
      "rdc-este":"Democratic Republic of the Congo (east)",
      "somalia":"Somalia", "yemen-mar-rojo":"Yemen and the Red Sea",
      "myanmar":"Myanmar", "pakistan-afganistan":"Pakistan–Afghanistan border",
      "haiti":"Haiti", "colombia-venezuela":"Colombia–Venezuela border",
      "mexico":"Mexico · criminal violence", "mozambique-norte":"Northern Mozambique",
      "baltico-mar-norte":"Baltic and North Sea · hybrid pressure"
    },
    fr: {
      "ucrania-rusia":"Ukraine et Russie occidentale",
      "israel-gaza-libano-iran":"Israël · Gaza · Liban · axe régional",
      "siria":"Syrie", "sudan":"Soudan",
      "sahel":"Sahel central (Mali, Burkina Faso, Niger)",
      "rdc-este":"République démocratique du Congo (est)",
      "somalia":"Somalie", "yemen-mar-rojo":"Yémen et mer Rouge",
      "myanmar":"Myanmar", "pakistan-afganistan":"Frontière Pakistan–Afghanistan",
      "haiti":"Haïti", "colombia-venezuela":"Frontière Colombie–Venezuela",
      "mexico":"Mexique · violence criminelle", "mozambique-norte":"Nord du Mozambique",
      "baltico-mar-norte":"Mer Baltique et mer du Nord · pression hybride"
    },
    de: {
      "ucrania-rusia":"Ukraine und westliches Russland",
      "israel-gaza-libano-iran":"Israel · Gaza · Libanon · regionale Achse",
      "siria":"Syrien", "sudan":"Sudan",
      "sahel":"Zentraler Sahel (Mali, Burkina Faso, Niger)",
      "rdc-este":"Demokratische Republik Kongo (Osten)",
      "somalia":"Somalia", "yemen-mar-rojo":"Jemen und Rotes Meer",
      "myanmar":"Myanmar", "pakistan-afganistan":"Grenze Pakistan–Afghanistan",
      "haiti":"Haiti", "colombia-venezuela":"Grenze Kolumbien–Venezuela",
      "mexico":"Mexiko · kriminelle Gewalt", "mozambique-norte":"Nord-Mosambik",
      "baltico-mar-norte":"Ostsee und Nordsee · hybrider Druck"
    },
    lb: {
      "ucrania-rusia":"Ukrain a westlecht Russland",
      "israel-gaza-libano-iran":"Israel · Gaza · Libanon · regional Achs",
      "siria":"Syrien", "sudan":"Sudan",
      "sahel":"Zentrale Sahel (Mali, Burkina Faso, Niger)",
      "rdc-este":"Demokratesch Republik Kongo (Osten)",
      "somalia":"Somalia", "yemen-mar-rojo":"Jemen a Rout Mier",
      "myanmar":"Myanmar", "pakistan-afganistan":"Grenz Pakistan–Afghanistan",
      "haiti":"Haiti", "colombia-venezuela":"Grenz Kolumbien–Venezuela",
      "mexico":"Mexiko · kriminell Gewalt", "mozambique-norte":"Nord-Mosambik",
      "baltico-mar-norte":"Ostséi an Nordséi · hybriden Drock"
    }
  };

  /* ========================================================
     2. Contenido largo de las fichas en inglés
     ======================================================== */
  const EN_DATA = {
    "ucrania-rusia": {
      summary:"The interstate war between Russia and Ukraine continues to define European security, with active fronts, long-range strikes and a sustained debate over military support and diplomacy.",
      actors:"Russian Federation; Ukraine; NATO/EU allies providing military and economic support.",
      humanitarian:"Internal displacement and refuge in neighbouring countries; systematic damage to energy and civilian infrastructure.",
      outlook:"Continuation of attritional war in 2026, with recurrent strikes on energy infrastructure and possible reopening of diplomatic channels.",
      hecho:"Active fronts and recurrent long-range strike campaigns against energy infrastructure documented by open sources.",
      evaluacion:"The war behaves as attrition: territorial change is slow and the centre of gravity has shifted to energy, logistics and air defence.",
      hipotesis:"Plausible, unconfirmed scenario: partial diplomatic rounds coexisting with sustained combat, without a stable ceasefire in the analytical horizon.",
      senal:"Frequency of salvos against energy nodes, air-defence saturation and naval activity in the Black Sea."
    },
    "israel-gaza-libano-iran": {
      summary:"The conflict in Gaza and confrontation with actors in Lebanon, Yemen and Iran keep a regional crisis active, with effects on the Red Sea and commercial routes.",
      actors:"Israel; Hamas and other Palestinian factions; Hezbollah; Iran and regional allies.",
      humanitarian:"Humanitarian crisis in Gaza with mass displacement and severe damage to health infrastructure.",
      outlook:"Persistent escalation risk through incidents in Lebanon, long-range strikes and reactivation of the Iranian front.",
      hecho:"Severe humanitarian crisis in Gaza and sustained cross-front military activity involving Lebanon, Yemen and Iran.",
      evaluacion:"Not a single theatre but a system of coupled fronts: one local incident can transmit escalation to three or four scenarios at once.",
      hipotesis:"Plausible, unconfirmed scenario: intermittent partial truces with local reactivations, without a regional de-escalation architecture.",
      senal:"Humanitarian access volumes, crossing operability and the pace of incidents in Lebanon and the Red Sea."
    },
    "siria": {
      summary:"After more than a decade of war, Syria holds a fragile balance with pockets of violence, foreign military presence and open reconstruction and return challenges.",
      actors:"Syrian government; local and regional armed actors; foreign military presence.",
      humanitarian:"Long-term displaced population, degraded services and an economy in crisis.",
      outlook:"Persistent instability with localized episodes; political reconfiguration still uncertain.",
      hecho:"Territorialized violence in specific pockets and foreign military presence across several areas.",
      evaluacion:"The country works as a mosaic of overlapping controls; low aggregate intensity conceals highly lethal local pockets.",
      hipotesis:"Plausible, unconfirmed scenario: slow political reconfiguration with localized episodes rather than collapse or rapid stabilization.",
      senal:"Clashes in the northeast, pace of returns and shifts in external actor deployments."
    },
    "sudan": {
      summary:"The civil war between the Sudanese Armed Forces and the Rapid Support Forces remains one of the period's largest humanitarian crises, with internal fractures and mass displacement.",
      actors:"Sudanese Armed Forces (SAF); Rapid Support Forces (RSF) and splinter factions; local actors.",
      humanitarian:"Famine risk in several regions and collapse of the health system in affected areas.",
      outlook:"Continuation of the conflict in 2026 with possible internal realignments within the RSF.",
      hecho:"Open war between SAF and RSF with mass displacement and food alerts across several regions.",
      evaluacion:"Fragmented command combined with blocked humanitarian access makes Sudan the focus with the worst ratio of severity to media coverage.",
      hipotesis:"Plausible, unconfirmed scenario: internal RSF realignments that alter the control map without resolving the conflict.",
      senal:"Humanitarian access corridors, control of state capitals in Darfur and Kordofan, and ceasefire contacts."
    },
    "sahel": {
      summary:"Jihadist insurgencies linked to Al Qaeda and the Islamic State sustain violence across the central Sahel, amid military governments and a reconfiguration of external alliances.",
      actors:"JNIM (Al Qaeda-linked); ISGS (Islamic State in the Greater Sahara); state forces; external actors.",
      humanitarian:"Growing displacement, attacks on villages and blockades of towns.",
      outlook:"Expanding trend of jihadist violence in 2026 according to open-source analysis.",
      hecho:"Sustained insurgent violence in the tri-border corridor and prolonged blockades of towns.",
      evaluacion:"Pressure is applied through economic strangulation of urban centres rather than classic territorial conquest, shifting the useful indicator to access, not front lines.",
      hipotesis:"Plausible, unconfirmed scenario: progressive spillover into the coastal states of the Gulf of Guinea.",
      senal:"Urban blockades, attacks in northern Benin, Togo and Ghana, and rotation of external security partners."
    },
    "rdc-este": {
      summary:"Eastern DRC concentrates overlapping conflicts among armed groups, state forces and regional actors, with severe humanitarian pressure aggravated by health outbreaks.",
      actors:"M23 and other armed groups; DRC Armed Forces (FARDC); regional actors.",
      humanitarian:"Mass displacement in North and South Kivu; outbreaks reported in conflict areas add pressure.",
      outlook:"Persistent instability with regional escalation risk.",
      hecho:"Overlapping conflicts in North and South Kivu with mass displacement and health outbreaks in combat zones.",
      evaluacion:"The overlap of war and health emergency multiplies humanitarian cost beyond what military intensity alone suggests.",
      hipotesis:"Plausible, unconfirmed scenario: internationalization of the conflict through neighbouring regional actors.",
      senal:"M23 advances or withdrawals, continuity of regional mediation and international health response capacity."
    },
    "somalia": {
      summary:"Al Shabab retains attack capacity and partial territorial control against the federal government and allied forces.",
      actors:"Al Shabab; federal government of Somalia; international support mission.",
      humanitarian:"Recurrent food insecurity and displacement.",
      outlook:"Prolonged conflict with fluctuations driven by state offensives.",
      hecho:"Al Shabab retains urban attack capacity and partial control of rural territory.",
      evaluacion:"The balance depends less on state offensives than on continuity of international support and local clan alignments.",
      hipotesis:"Plausible, unconfirmed scenario: insurgent recovery of ground during international mission transitions.",
      senal:"Mission drawdown timelines, attacks in Mogadishu and clan realignments."
    },
    "yemen-mar-rojo": {
      summary:"Yemen combines a prolonged civil war with a high-risk maritime theatre in the Red Sea due to attacks against commercial shipping.",
      actors:"Houthis; internationally recognized Yemeni government; external coalitions; affected commercial shipping.",
      humanitarian:"Chronic humanitarian crisis and impact on global supply chains.",
      outlook:"Persistent risk of maritime incidents and escalation through exchanges involving Israel and external actors.",
      hecho:"A prolonged civil war coupled to a maritime theatre with attacks against commercial shipping.",
      evaluacion:"It is the focus most capable of transmitting global cost from a moderate local intensity, through its effect on trade routes.",
      hipotesis:"Plausible, unconfirmed scenario: renewed maritime campaigns tied to the evolution of the Middle East regional axis.",
      senal:"Transit volumes through Bab el-Mandeb, marine insurance premiums and resumption of attacks on vessels."
    },
    "myanmar": {
      summary:"Civil war between the military junta and a broad coalition of resistance forces and ethnic armies has intensified, with significant territorial gains for opposition groups.",
      actors:"Military junta (Tatmadaw); National Unity Government (NUG); ethnic armed organizations.",
      humanitarian:"Mass displacement and restrictions on humanitarian access.",
      outlook:"Territorial reconfiguration with growing pressure on the junta.",
      hecho:"Territorial gains by ethnic armies and resistance forces against the junta, with mass displacement.",
      evaluacion:"One of the few theatres where the control map changes appreciably; restricted information access keeps uncertainty high.",
      hipotesis:"Plausible, unconfirmed scenario: stable territorial fragmentation rather than replacement of central power.",
      senal:"Fighting in Shan and Rakhine, border closures with China and the junta's air capacity."
    },
    "pakistan-afganistan": {
      summary:"Militancy is rising in western Pakistan's tribal areas, with pressure from the TTP and cross-border tensions with Afghanistan's Taliban regime.",
      actors:"Tehrik-i-Taliban Pakistan (TTP); Pakistani security forces; Afghan Taliban; other groups.",
      humanitarian:"Localized displacement and damage to local infrastructure.",
      outlook:"Militancy trending upward in 2026 according to open-source analysis.",
      hecho:"Rising militant attacks in Khyber Pakhtunkhwa and Balochistan and recurrent cross-border friction.",
      evaluacion:"The relevant risk is interstate rather than territorial: Pakistan's response to internal attacks conditions its relationship with Kabul.",
      hipotesis:"Plausible, unconfirmed scenario: more frequent cross-border fire episodes without opening a full conflict.",
      senal:"Attacks on military posts, border crossing closures and reciprocal official rhetoric."
    },
    "haiti": {
      summary:"A state crisis marked by extensive territorial control by armed gangs, especially in Port-au-Prince, and a fragile political transition.",
      actors:"Gang coalitions; transitional government; international security mission.",
      humanitarian:"Acute hunger, urban displacement and attacks on hospitals and schools.",
      outlook:"Risk of deeper fragmentation if the international mission loses operational capacity.",
      hecho:"Extensive territorial control by gang coalitions in Port-au-Prince and a transition without a consolidated calendar.",
      evaluacion:"A case of state erosion rather than classic armed conflict: the useful indicators are urban, not military.",
      hipotesis:"Plausible, unconfirmed scenario: deeper fragmentation if the international mission loses operational capacity or funding.",
      senal:"Airport and port coverage, effective international deployments and the setting of an electoral calendar."
    },
    "colombia-venezuela": {
      summary:"An area of activity for armed groups, including FARC dissidents, ELN and criminal structures, with recurring bilateral tensions.",
      actors:"FARC dissidents; ELN; organized armed groups; security forces from both countries.",
      humanitarian:"Forced displacement and violence against social leaders.",
      outlook:"Intermittent negotiations in Colombia; volatility linked to Venezuela's internal situation.",
      hecho:"Sustained presence of organized armed groups in Catatumbo and Arauca with associated forced displacement.",
      evaluacion:"The border operates as an illicit rent economy rather than a front; the decisive variable is domestic politics on both sides.",
      hipotesis:"Plausible, unconfirmed scenario: reconfiguration of armed control if talks break down or resume.",
      senal:"Status of ELN talks, killings of social leaders and declared bilateral tension."
    },
    "mexico": {
      summary:"High-intensity criminal violence in several states, with cartel clashes, attacks on security forces and pressure on journalists and local authorities.",
      actors:"Mexican cartels; federal and state forces; National Guard.",
      humanitarian:"Internal displacement, targeted killings and disappearances.",
      outlook:"Continued violence with regional hotspots and debate over cooperation with the United States.",
      hecho:"Criminal violence concentrated in specific states, with internal displacement and pressure on local authorities and the press.",
      evaluacion:"Not an armed conflict in legal terms, but it produces comparable humanitarian indicators in specific areas.",
      hipotesis:"Plausible, unconfirmed scenario: changes in the bilateral cooperation framework with the United States that alter pressure on cartels.",
      senal:"Fragmentation of structures in Sinaloa, displacement in Michoacán and Guerrero, and bilateral cooperation decisions."
    },
    "mozambique-norte": {
      summary:"The insurgency known as Islamic State Mozambique retains mobility and attack capacity in Cabo Delgado and adjacent areas, affecting gas projects.",
      actors:"ISM/Ansar al-Sunna; Mozambican armed forces; Rwandan troops and SAMIM dynamics.",
      humanitarian:"Displacement and partial returns, with schools attacked.",
      outlook:"Oscillation with periodic surges; economic relevance due to LNG projects.",
      hecho:"Recurrent attacks in Cabo Delgado with alternating displacement and partial returns.",
      evaluacion:"The insurgency operates through mobility, not control; surges read better as cycles than as a linear trend.",
      hipotesis:"Plausible, unconfirmed scenario: a surge tied to the reactivation of energy projects in the province.",
      senal:"Investment decisions on LNG projects, attacks near the Tanzanian border and the pace of returns."
    },
    "baltico-mar-norte": {
      summary:"Incidents against submarine cables, pipelines and other critical infrastructure have led NATO and the EU to treat northern European waters as a distinct security domain, with recurring suspicions about Russia-linked actors.",
      actors:"Baltic and North Sea coastal states; NATO; EU; suspected Russia-linked actors.",
      humanitarian:"Indirect impact on energy, telecoms and services.",
      outlook:"More submarine-infrastructure incidents and coordinated responses are likely in 2026.",
      hecho:"A series of incidents affecting submarine cables and pipelines, and deployment of allied surveillance missions.",
      evaluacion:"Attribution is the weak point of the file: ambiguity is part of the method, which is why analytical confidence is low despite potential impact.",
      hipotesis:"Plausible, unconfirmed scenario: new incidents without formal attribution forcing tougher legal and patrol measures.",
      senal:"Vessel detentions, regulatory changes on shadow-fleet shipping and cable repair times."
    }
  };

  const SCENARIOS_EN = [
    { label:"Baseline scenario", text:"Continuity without rupture: high-intensity theatres keep their current pattern and variation concentrates in humanitarian access and energy infrastructure.", indicator:"No relevant territorial control changes in Ukraine, Sudan or Myanmar." },
    { label:"Risk scenario", text:"Regional coupling: an incident on the Middle East axis or in the Red Sea transmits to trade routes and raises the global cost of a locally intense conflict.", indicator:"Sustained resumption of attacks on commercial shipping or incidents in Lebanon." },
    { label:"Opening scenario", text:"Partial negotiation windows in one or two theatres — local ceasefires, stable humanitarian corridors — without resolving the underlying conflict.", indicator:"Sustained formal contacts and verifiable opening of access corridors." }
  ];
  const HORIZON_EN = { "30 días":"30 days", "90 días":"90 days", "180 días":"180 days" };
  const SOURCE_SCOPE_EN = {
    "ACLED":"Political violence and protest events",
    "CFR":"Conflict analysis and trackers",
    "CICR / ICRC":"Humanitarian and IHL framework",
    "OCHA":"Humanitarian access and needs",
    "Prensa internacional contrastada":"Context and cross-verification",
    "OSINT abierto":"Early signals, unverified"
  };
  const SOURCE_NAME_EN = { "Prensa internacional contrastada":"Vetted international press", "OSINT abierto":"Open OSINT" };
  const REL_EN = { "Alta":"High", "Media":"Medium", "Baja":"Low" };
  const STATUS_EN = { "No conectada":"Not connected", "Uso editorial":"Editorial use", "Solo como señal":"Signal only" };

  /* ========================================================
     3. Interfaz: ES y EN completos; FR/DE/LB parciales
     ======================================================== */
  const UI = {
    es: {
      nav:["Método","Mapa","Riesgo","Focos","Señales","Escenarios","Fuentes"],
      badgeSim:"SIMULADO",
      clock:"Corte editorial · mayo 2026",
      cautions:["Datos simulados","No es monitoreo en vivo","No es un parte militar","No es una predicción"],
      heroKicker:"Sala situacional · Edición 2026",
      heroTitle:'<small>Conflict Watchlist</small> Ordenar el tablero <span>antes de opinar</span>',
      heroLede:"Maqueta funcional de sala situacional para leer los focos de conflicto activos y emergentes de 2026. Mapa operativo, matriz de riesgo, escenarios, fuentes visibles y separación editorial explícita entre hecho, evaluación, hipótesis y señal.",
      heroNote:'<strong>Cautela.</strong> Esta versión utiliza datos simulados para mostrar la arquitectura del producto y su método editorial. No es monitoreo en vivo, no es un parte militar y no es una predicción. Verificar siempre en fuente primaria antes de cualquier uso operativo.',
      ctaLong:"Ver análisis completo", ctaBoard:"Abrir tablero", csv:"Descargar CSV",
      spTitle:"Estado global", spDate:"Mayo 2026", spL1:"Alta", spL2:"Regiones", spL3:"Focos",
      kpi:[["Focos en seguimiento","conflictos activos o emergentes"],["Intensidad alta","violencia armada sostenida"],["Regiones cubiertas","distribución global"],["Confianza agregada","densidad y consistencia de fuentes"]],
      metodoKicker:"Método editorial",
      metodoTitle:"HECHO · EVALUACIÓN · HIPÓTESIS · SEÑAL",
      metodoText:"Cada ficha del tablero separa lo confirmado de lo probable, lo analítico de lo especulativo y lo urgente de lo importante. La regla es visible en la interfaz: color, borde y etiqueta indican qué estás leyendo.",
      methodCards:[
        ["Hecho","Lo verificable y sostenido por fuentes abiertas contrastadas. Sin adjetivos y sin inferencia.","Borde sólido · icono lleno"],
        ["Evaluación","Lectura analítica de GEOPÓLEM sobre ese hecho: qué significa y por qué importa en el tablero.","Borde continuo · atribuida"],
        ["Hipótesis","Escenario plausible y explícitamente no confirmado. Se enuncia como posibilidad, nunca como pronóstico.","Borde discontinuo · condicional"],
        ["Señal","Indicador concreto y observable que confirmaría o descartaría la hipótesis en las próximas semanas.","Marca ámbar · verificable"]
      ],
      mapaKicker:"Mapa operativo",
      mapaTitle:"Observatorio · 15 focos en seguimiento",
      mapaText:"Selecciona un foco en el mapa o en la lista para abrir su ficha con hecho, evaluación, hipótesis y señal. El tamaño del marcador refleja una categoría editorial de intensidad, no víctimas ni territorio.",
      panelFilters:"Filtros · Lista", panelDetail:"Ficha de foco",
      search:"Buscar país o foco…", intensity:"Intensidad", region:"Región", type:"Tipo",
      allF:"Todas", allM:"Todos", visible:"focos visibles", reset:"Restablecer", emptyList:"Ningún foco coincide con estos filtros. Ajusta la búsqueda o pulsa Restablecer.",
      legendTitle:"Intensidad", legendNote:"Categoría editorial comparativa. No refleja víctimas, territorio ni estatus jurídico.",
      selectTitle:"Selecciona un foco",
      selectText:"Abre un marcador, una tarjeta o una celda de la matriz de riesgo para ver la ficha con hecho, evaluación, hipótesis, señal y fuentes orientativas.",
      lblHecho:"Hecho", lblEval:"Evaluación", lblHip:"Hipótesis", lblSenal:"Señal a vigilar",
      actors:"Actores principales", humanitarian:"Riesgo humanitario", outlook:"Evolución esperada 2026", sourcesLabel:"Fuentes orientativas:",
      riesgoKicker:"Panel de riesgo",
      riesgoTitle:"Matriz de riesgo · probabilidad de escalada × impacto",
      riesgoText:"Lectura editorial a 30–90 días. La posición en la matriz es una estimación comparativa e interna del equipo, no una métrica estandarizada ni una probabilidad calculada. Pulsa cualquier foco para abrir su ficha.",
      riskY:"Impacto", riskX:"Probabilidad de escalada",
      riskScale:["Bajo","Moderado","Alto","Muy alto"],
      matrixKicker:"Concentración regional", matrixTitle:"Matriz regional · intensidad y volumen",
      matrixText:"Lectura comparativa por región para priorizar cobertura y seguimiento editorial.",
      focosKicker:"Fichas", focosTitle:"Focos a vigilar",
      focosText:"Síntesis ordenada por intensidad editorial estimada. Cada tarjeta es una ficha de análisis, no un informe oficial.",
      senalesKicker:"Lecturas transversales", senalesTitle:"Cinco señales que cruzan varios focos",
      senalesText:"Patrones que no se explican país a país y conviene seguir durante el año.",
      escKicker:"Marco prospectivo", escTitle:"Escenarios · 30, 90 y 180 días",
      escText:"Marco de análisis para estructurar el seguimiento. No es una predicción: cada escenario se enuncia con el indicador que lo confirmaría o lo descartaría.",
      escIndicator:"Indicador de verificación",
      cronoKicker:"Contexto", cronoTitle:"Cronología editorial 2024 – 2026",
      cronoText:"Hitos abreviados para enmarcar la evolución. No es un registro exhaustivo de hechos.",
      avKicker:"Piezas oficiales", avTitle:"Cómo se lee este tablero",
      avText:"Piezas audiovisuales oficiales de GEOPÓLEM que explican la sala situacional y el método. Los vídeos se cargan solo al pulsar, para no enviar datos a terceros al abrir la página.",
      srcKicker:"Source stack", srcTitle:"Fuentes y niveles de confianza",
      srcText:"Las fuentes son visibles pero no están conectadas a APIs en esta maqueta. La confianza indica densidad y consistencia del material disponible, no certeza sobre los hechos.",
      mtdKicker:"Metodología", mtdTitle:"Cómo se construye y cómo no debe usarse",
      openCard:"Abrir ficha de "
    },
    en: {
      nav:["Method","Map","Risk","Hotspots","Signals","Scenarios","Sources"],
      badgeSim:"SIMULATED",
      clock:"Editorial cut-off · May 2026",
      cautions:["Simulated data","Not live monitoring","Not a military report","Not a prediction"],
      heroKicker:"Situation room · 2026 edition",
      heroTitle:'<small>Conflict Watchlist</small> Order the board <span>before forming an opinion</span>',
      heroLede:"A functional situation-room mock-up for reading the active and emerging conflict theatres of 2026. Operational map, risk matrix, scenarios, visible sources and an explicit editorial separation between fact, assessment, hypothesis and signal.",
      heroNote:'<strong>Caution.</strong> This version uses simulated data to show the product architecture and its editorial method. It is not live monitoring, not a military report and not a prediction. Always verify against primary sources before any operational use.',
      ctaLong:"Watch full analysis", ctaBoard:"Open the board", csv:"Download CSV",
      spTitle:"Global status", spDate:"May 2026", spL1:"High", spL2:"Regions", spL3:"Hotspots",
      kpi:[["Tracked hotspots","active or emerging conflicts"],["High intensity","sustained armed violence"],["Regions covered","global distribution"],["Average confidence","source density and consistency"]],
      metodoKicker:"Editorial method",
      metodoTitle:"FACT · ASSESSMENT · HYPOTHESIS · SIGNAL",
      metodoText:"Every profile separates the confirmed from the probable, the analytical from the speculative and the urgent from the important. The rule is visible in the interface: colour, border and label tell you what you are reading.",
      methodCards:[
        ["Fact","What is verifiable and sustained by vetted open sources. No adjectives, no inference.","Solid border · filled icon"],
        ["Assessment","GEOPÓLEM's analytical reading of that fact: what it means and why it matters on the board.","Continuous border · attributed"],
        ["Hypothesis","A plausible and explicitly unconfirmed scenario. Stated as a possibility, never as a forecast.","Dashed border · conditional"],
        ["Signal","A concrete, observable indicator that would confirm or discard the hypothesis in the coming weeks.","Amber marker · verifiable"]
      ],
      mapaKicker:"Operational map",
      mapaTitle:"Observatory · 15 tracked hotspots",
      mapaText:"Select a hotspot on the map or in the list to open its profile with fact, assessment, hypothesis and signal. Marker size reflects an editorial intensity category, not casualties or territory.",
      panelFilters:"Filters · List", panelDetail:"Hotspot profile",
      search:"Search country or hotspot…", intensity:"Intensity", region:"Region", type:"Type",
      allF:"All", allM:"All", visible:"visible hotspots", reset:"Reset", emptyList:"No hotspot matches these filters. Adjust the search or press Reset.",
      legendTitle:"Intensity", legendNote:"Comparative editorial category. It does not reflect casualties, territory or legal status.",
      selectTitle:"Select a hotspot",
      selectText:"Open a marker, a card or a risk-matrix cell to see the profile with fact, assessment, hypothesis, signal and indicative sources.",
      lblHecho:"Fact", lblEval:"Assessment", lblHip:"Hypothesis", lblSenal:"Signal to watch",
      actors:"Main actors", humanitarian:"Humanitarian risk", outlook:"Expected evolution 2026", sourcesLabel:"Indicative sources:",
      riesgoKicker:"Risk panel",
      riesgoTitle:"Risk matrix · escalation probability × impact",
      riesgoText:"Editorial reading over 30–90 days. Position in the matrix is a comparative internal estimate, not a standardized metric nor a calculated probability. Click any hotspot to open its profile.",
      riskY:"Impact", riskX:"Escalation probability",
      riskScale:["Low","Moderate","High","Very high"],
      matrixKicker:"Regional concentration", matrixTitle:"Regional matrix · intensity and volume",
      matrixText:"Comparative regional reading to prioritize coverage and editorial monitoring.",
      focosKicker:"Profiles", focosTitle:"Hotspots to watch",
      focosText:"Synthesis ordered by estimated editorial intensity. Each card is an analysis profile, not an official report.",
      senalesKicker:"Cross-cutting readings", senalesTitle:"Five signals that cut across theatres",
      senalesText:"Patterns that cannot be explained country by country and are worth tracking through the year.",
      escKicker:"Prospective framework", escTitle:"Scenarios · 30, 90 and 180 days",
      escText:"An analytical framework to structure monitoring. Not a prediction: each scenario comes with the indicator that would confirm or discard it.",
      escIndicator:"Verification indicator",
      cronoKicker:"Context", cronoTitle:"Editorial timeline 2024 – 2026",
      cronoText:"Abbreviated milestones to frame the evolution. Not an exhaustive record of events.",
      avKicker:"Official pieces", avTitle:"How to read this board",
      avText:"Official GEOPÓLEM audiovisual pieces explaining the situation room and the method. Videos load only on click, so no third-party data is sent when the page opens.",
      srcKicker:"Source stack", srcTitle:"Sources and confidence levels",
      srcText:"Sources are visible but not connected to APIs in this mock-up. Confidence reflects density and consistency of available material, not certainty about the facts.",
      mtdKicker:"Methodology", mtdTitle:"How it is built and how it must not be used",
      openCard:"Open profile for "
    },
    fr: {
      nav:["Méthode","Carte","Risque","Foyers","Signaux","Scénarios","Sources"],
      badgeSim:"SIMULÉ", clock:"Arrêt éditorial · mai 2026",
      cautions:["Données simulées","Pas de suivi en direct","Pas un communiqué militaire","Pas une prédiction"],
      ctaLong:"Voir l'analyse complète", ctaBoard:"Ouvrir le tableau", csv:"Télécharger CSV",
      spTitle:"État global", spDate:"Mai 2026", spL1:"Élevée", spL2:"Régions", spL3:"Foyers",
      panelFilters:"Filtres · Liste", panelDetail:"Fiche du foyer",
      search:"Rechercher pays ou foyer…", intensity:"Intensité", region:"Région", type:"Type",
      allF:"Toutes", allM:"Tous", visible:"foyers visibles", reset:"Réinitialiser", emptyList:"Aucun foyer ne correspond à ces filtres. Ajustez la recherche ou cliquez sur Réinitialiser.",
      legendTitle:"Intensité",
      lblHecho:"Fait", lblEval:"Évaluation", lblHip:"Hypothèse", lblSenal:"Signal à surveiller",
      actors:"Acteurs principaux", humanitarian:"Risque humanitaire", outlook:"Évolution attendue 2026", sourcesLabel:"Sources indicatives:",
      riskY:"Impact", riskX:"Probabilité d'escalade", riskScale:["Faible","Modérée","Élevée","Très élevée"],
      escIndicator:"Indicateur de vérification", openCard:"Ouvrir la fiche de "
    },
    de: {
      nav:["Methode","Karte","Risiko","Brennpunkte","Signale","Szenarien","Quellen"],
      badgeSim:"SIMULIERT", clock:"Redaktionsschluss · Mai 2026",
      cautions:["Simulierte Daten","Kein Live-Monitoring","Kein Militärbericht","Keine Prognose"],
      ctaLong:"Vollständige Analyse ansehen", ctaBoard:"Dashboard öffnen", csv:"CSV herunterladen",
      spTitle:"Globaler Status", spDate:"Mai 2026", spL1:"Hoch", spL2:"Regionen", spL3:"Brennpunkte",
      panelFilters:"Filter · Liste", panelDetail:"Brennpunkt-Profil",
      search:"Land oder Brennpunkt suchen…", intensity:"Intensität", region:"Region", type:"Typ",
      allF:"Alle", allM:"Alle", visible:"sichtbare Brennpunkte", reset:"Zurücksetzen", emptyList:"Kein Brennpunkt entspricht diesen Filtern. Suche anpassen oder Zurücksetzen drücken.",
      legendTitle:"Intensität",
      lblHecho:"Fakt", lblEval:"Bewertung", lblHip:"Hypothese", lblSenal:"Zu beobachtendes Signal",
      actors:"Hauptakteure", humanitarian:"Humanitäres Risiko", outlook:"Erwartete Entwicklung 2026", sourcesLabel:"Orientierende Quellen:",
      riskY:"Auswirkung", riskX:"Eskalationswahrscheinlichkeit", riskScale:["Gering","Moderat","Hoch","Sehr hoch"],
      escIndicator:"Verifikationsindikator", openCard:"Profil öffnen: "
    },
    lb: {
      nav:["Method","Kaart","Risiko","Foyeren","Signaler","Szenarien","Quellen"],
      badgeSim:"SIMULÉIERT", clock:"Redaktiounsschluss · Mee 2026",
      cautions:["Simuléiert Daten","Kee Live-Monitoring","Kee Militärbericht","Keng Prognos"],
      ctaLong:"Ganz Analys kucken", ctaBoard:"Tableau opmaachen", csv:"CSV eroflueden",
      spTitle:"Globale Status", spDate:"Mee 2026", spL1:"Héich", spL2:"Regiounen", spL3:"Foyeren",
      panelFilters:"Filteren · Lëscht", panelDetail:"Fiche vum Foyer",
      search:"Land oder Foyer sichen…", intensity:"Intensitéit", region:"Regioun", type:"Typ",
      allF:"All", allM:"All", visible:"siichtbar Foyeren", reset:"Zerécksetzen", emptyList:"Kee Foyer entsprécht dëse Filteren. Passt d'Sich un oder dréckt Zerécksetzen.",
      legendTitle:"Intensitéit",
      lblHecho:"Fakt", lblEval:"Evaluatioun", lblHip:"Hypothes", lblSenal:"Signal ze suivéieren",
      actors:"Haaptakteuren", humanitarian:"Humanitäre Risiko", outlook:"Erwaart Entwécklung 2026", sourcesLabel:"Orientéierend Quellen:",
      riskY:"Impakt", riskX:"Eskalatiounswahrscheinlechkeet", riskScale:["Niddreg","Moderat","Héich","Ganz héich"],
      escIndicator:"Verifikatiounsindikator", openCard:"Fiche opmaachen: "
    }
  };

  /* Contenido largo de secciones (ES original en el DOM; EN aquí) */
  const LONGFORM_EN = {
    signals: [
      ["Hybrid maritime pressure in Europe", 'Incidents against submarine cables and pipelines in the Baltic and North Sea have led NATO and the EU to treat critical subsea infrastructure as a security domain of its own, with recurring suspicions about Russia-linked actors (<a href="https://acleddata.com/global-analysis" target="_blank" rel="noopener">ACLED</a>). Formal attribution remains the weak point of the file.'],
      ["Expanding jihadist violence in Africa", 'The central Sahel, the Lake Chad basin, northern Mozambique and pockets in Somalia sustain violence; ACLED reports growing civilian impact in 2025–2026 (<a href="https://acleddata.com/global-analysis" target="_blank" rel="noopener">ACLED Global Analysis</a>). The useful indicator is access, not the front line.'],
      ["Overlap of war and health emergency", 'Outbreaks in conflict areas of eastern DRC and food alerts in Sudan increase pressure on International Humanitarian Law and on response capacity (<a href="https://www.icrc.org" target="_blank" rel="noopener">ICRC</a>).'],
      ["State erosion and non-state actors", 'Haiti, parts of the Sahel, northern Mozambique and the Colombia–Venezuela border show how non-state armed groups, gangs and illicit economies erode state capacity without producing a classic front.'],
      ["Coupled fronts in the Middle East", 'The Israel–Gaza–Lebanon–Iran axis and Red Sea incidents continue to articulate a regional crisis with effects on global trade routes (<a href="https://acleddata.com/global-analysis" target="_blank" rel="noopener">ACLED</a>, <a href="https://www.cfr.org/global-conflict-tracker" target="_blank" rel="noopener">CFR</a>).']
    ],
    timeline: [
      "Continuation of large-scale war in Ukraine; escalation of the Gaza conflict with regional expansion towards Lebanon and the Red Sea; deterioration of the civil war in Sudan.",
      "Internal fractures within the RSF in Sudan; insurgent offensives in Myanmar and expanding violence in the Sahel; more incidents against submarine infrastructure in the Baltic.",
      "<strong>Current cut-off.</strong> State crisis in Haiti, debate over armed actors in Colombia, Venezuela and Mexico, health outbreaks in conflict areas of eastern DRC, and periodic review of insurgent activity in Mozambique."
    ],
    methodCols: [
      ["Construction", [
        "Editorial selection of active or emerging hotspots with significant open-source coverage during 2024–2026.",
        "Classification by intensity, region and type in descriptive, never legal, terms.",
        "Probability and impact are comparative internal estimates on a 1–4 scale, not calculated probabilities.",
        "Approximate coordinates to locate the hotspot, not to delimit areas of operations."
      ]],
      ["Limitations", [
        "Functional mock-up with <strong>simulated data</strong>: it does not replace official databases or human verification.",
        "Intensity is a comparative internal category, not a standardized metric.",
        "Organized crime, hybrid pressure and cyber operations do not fit cleanly into classic armed-conflict categories.",
        "Including a hotspot implies no legal or political equivalence with the others."
      ]],
      ["Architecture", [
        "Static site with no backend: HTML, CSS and JavaScript with no build dependencies.",
        "Ready to connect OSINT and humanitarian sources in a later phase.",
        "CSV export of the editorial dataset for external review.",
        "Five interface languages; long-form analysis is served in Spanish and English."
      ]]
    ],
    usage: [
      ["Correct formulations", ['"Functional mock-up with simulated data."','"Designed to integrate OSINT and humanitarian sources."','"Editorial separation between fact, assessment, hypothesis and signal."','"It does not replace human verification or primary sources."']],
      ["Formulations to avoid", ['"Real-time monitoring" or "live data".','"Definitive map of the conflict."','"Confirmed prediction" or any deterministic reading.','Presenting simulated data as real evidence.']]
    ],
    avCards: [
      ["Main piece","GEOPÓLEM · Active conflicts: situation room, method and reading the board","Official piece from the active-conflicts situation room: it explains the board architecture, the layers, the risk matrix and the editorial separation between fact, assessment, hypothesis and signal. It is the same method that structures this watchlist.","Watch on YouTube ↗"],
      ["Short piece","We don't opine first. We order the board.","Short version of the situation room. It always links to the full analysis.","Watch short ↗"]
    ]
  };

  /* ========================================================
     4. Helpers de idioma
     ======================================================== */
  function ui(key) {
    const l = UI[state.lang] || {};
    if (l[key] !== undefined) return l[key];
    if (UI.en[key] !== undefined && state.lang !== "es") return UI.en[key];
    return UI.es[key];
  }
  const isES = () => state.lang === "es";

  function dataText(d, field) {
    if (isES()) return d[field];
    if (field === "title") return (TITLE_I18N[state.lang] && TITLE_I18N[state.lang][d.id]) || d.title;
    return (EN_DATA[d.id] && EN_DATA[d.id][field]) || d[field];
  }
  const regionLabel = r => (REGION_LABELS[state.lang] || REGION_LABELS.es)[r] || r;
  const typeLabel = t => (TYPE_LABELS[state.lang] || TYPE_LABELS.es)[t] || t;
  const intensityLabel = i => (INTENSITY_LABELS[state.lang] || INTENSITY_LABELS.es)[i] || i;
  const confLabel = c => (CONF_LABELS[state.lang] || CONF_LABELS.es)[c] || c;

  function escapeHtml(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
                    .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  }
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  function setText(sel, text){ const el = $(sel); if (el) el.textContent = text; }
  function setHTML(sel, html){ const el = $(sel); if (el) el.innerHTML = html; }

  /* ========================================================
     5. Mapa
     ======================================================== */
  // El mapa es una capa de lectura más, no el tablero entero. Si Leaflet no cargó, se
  // degrada a un aviso y el resto —KPIs, lista, tarjetas, matrices, escenarios, fuentes—
  // sigue operativo, en lugar de abortar el script y dejar la página a medio render.
  const hasLeaflet = typeof L !== "undefined" && typeof L.map === "function";

  const map = hasLeaflet ? L.map("map", {
    center: [22, 12], zoom: 2, minZoom: 2, maxZoom: 6,
    worldCopyJump: true, zoomControl: true, scrollWheelZoom: false, attributionControl: true
  }) : null;

  if (map) {
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
      maxZoom: 6, subdomains: "abcd",
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);
  } else {
    setHTML("#map", '<div class="map-offline" id="map-offline" role="status">'
      + 'Mapa no disponible. El resto del tablero sigue operativo.</div>');
  }

  const markers = {};
  const intensityClass = i => i === "alta" ? "cw-marker--high" : i === "media-alta" ? "cw-marker--medhigh" : "cw-marker--med";
  const intensitySize  = i => i === "alta" ? 20 : i === "media-alta" ? 16 : 13;
  const dotClass       = i => i === "alta" ? "dot--high" : i === "media-alta" ? "dot--medhigh" : "dot--med";
  const cardIntClass   = i => i === "alta" ? "card__intensity" : i === "media-alta" ? "card__intensity card__intensity--medhigh" : "card__intensity card__intensity--med";

  function popupHtml(d){
    return `<div class="popup-title">${escapeHtml(dataText(d,"title"))}</div>
            <div class="popup-meta">${escapeHtml(regionLabel(d.region))} · ${escapeHtml(typeLabel(d.type))} · ${escapeHtml(intensityLabel(d.intensity))}</div>`;
  }

  if (map) DATA.forEach(d => {
    const size = intensitySize(d.intensity);
    const icon = L.divIcon({
      className: "",
      html: `<div class="cw-marker ${intensityClass(d.intensity)}" style="width:${size}px;height:${size}px;"></div>`,
      iconSize: [size, size], iconAnchor: [size/2, size/2]
    });
    const m = L.marker(d.coords, { icon, title: d.title, alt: d.title }).addTo(map).bindPopup(popupHtml(d));
    m.on("click", () => selectConflict(d.id));
    markers[d.id] = m;
  });

  /* ========================================================
     6. Filtros y lista
     ======================================================== */
  function passesFilters(d){
    const f = state.filters;
    if (f.intensity !== "all" && d.intensity !== f.intensity) return false;
    if (f.region !== "all" && d.region !== f.region) return false;
    if (f.type !== "all" && d.type !== f.type) return false;
    if (state.search){
      const q = state.search.toLowerCase();
      const blob = (dataText(d,"title") + " " + regionLabel(d.region) + " " + typeLabel(d.type) + " " + dataText(d,"summary")).toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  }

  const listEl = $("#list");
  const resultCount = $("#result-count");

  function renderList(){
    const visible = DATA.filter(passesFilters).sort((a,b) => RANK[b.intensity] - RANK[a.intensity]);
    resultCount.textContent = `${visible.length} ${ui("visible")}`;

    listEl.innerHTML = visible.map(d => `
      <button class="list__item ${state.selectedId === d.id ? "is-active" : ""}" data-id="${d.id}" type="button" role="listitem">
        <span class="dot ${dotClass(d.intensity)}" aria-hidden="true"></span>
        <span class="list__main">
          <span class="list__title">${escapeHtml(dataText(d,"title"))}</span>
          <span class="list__meta">
            <span>${escapeHtml(regionLabel(d.region))}</span><span>·</span>
            <span>${escapeHtml(typeLabel(d.type))}</span><span>·</span>
            <span>${escapeHtml(intensityLabel(d.intensity))}</span>
          </span>
        </span>
      </button>`).join("");

    if (!visible.length){
      listEl.innerHTML = `<p class="list__empty">${escapeHtml(ui("emptyList"))}</p>`;
    }

    listEl.querySelectorAll(".list__item").forEach(el => {
      el.addEventListener("click", () => selectConflict(el.dataset.id, { panTo:true }));
    });

    DATA.forEach(d => {
      const m = markers[d.id];
      if (!m) return;
      const isVisible = visible.some(v => v.id === d.id);
      if (isVisible && !map.hasLayer(m)) m.addTo(map);
      if (!isVisible && map.hasLayer(m)) map.removeLayer(m);
    });
  }

  /* ========================================================
     7. Tarjetas
     ======================================================== */
  const cardsEl = $("#cards");
  function renderCards(){
    const sorted = [...DATA].sort((a,b) => RANK[b.intensity] - RANK[a.intensity]);
    cardsEl.innerHTML = sorted.map(d => `
      <article class="card" data-id="${d.id}" tabindex="0" role="button"
               aria-label="${escapeHtml(ui("openCard") + dataText(d,"title"))}">
        <div class="card__head">
          <span class="card__region">${escapeHtml(regionLabel(d.region))}</span>
          <span class="${cardIntClass(d.intensity)}">${escapeHtml(intensityLabel(d.intensity))}</span>
        </div>
        <h3 class="card__title">${escapeHtml(dataText(d,"title"))}</h3>
        <p class="card__summary">${escapeHtml(dataText(d,"summary"))}</p>
        <div class="card__foot">
          <span>${escapeHtml(typeLabel(d.type))}</span>
          <span>${escapeHtml(confLabel(d.confianza))}</span>
        </div>
      </article>`).join("");

    cardsEl.querySelectorAll(".card").forEach(el => {
      const open = () => selectConflict(el.dataset.id, { panTo:true, scrollToMap:true });
      el.addEventListener("click", open);
      el.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
    });
  }

  /* ========================================================
     8. Ficha
     ======================================================== */
  function selectConflict(id, opts = {}){
    const d = DATA.find(x => x.id === id);
    if (!d) return;
    state.selectedId = id;

    $("#detail-placeholder").hidden = true;
    $("#detail-content").hidden = false;

    setText("#d-region", regionLabel(d.region));
    setText("#d-title", dataText(d,"title"));
    setText("#d-type", typeLabel(d.type));
    setText("#d-intensity", intensityLabel(d.intensity));
    setText("#d-confianza", confLabel(d.confianza));
    setText("#d-summary", dataText(d,"summary"));
    setText("#d-hecho", dataText(d,"hecho"));
    setText("#d-evaluacion", dataText(d,"evaluacion"));
    setText("#d-hipotesis", dataText(d,"hipotesis"));
    setText("#d-senal", dataText(d,"senal"));
    setText("#d-actors", dataText(d,"actors"));
    setText("#d-humanitarian", dataText(d,"humanitarian"));
    setText("#d-outlook", dataText(d,"outlook"));
    setText("#d-sources", d.sources.join(" · "));

    Object.values(markers).forEach(m => {
      const el = m.getElement();
      const dot = el && el.querySelector(".cw-marker");
      if (dot) dot.classList.remove("is-active");
    });
    const m = markers[id];
    if (m){
      const el = m.getElement();
      const dot = el && el.querySelector(".cw-marker");
      if (dot) dot.classList.add("is-active");
      if (opts.panTo){ map.panTo(d.coords, { animate:true }); m.openPopup(); }
    }

    listEl.querySelectorAll(".list__item").forEach(el => {
      el.classList.toggle("is-active", el.dataset.id === id);
    });

    if (opts.scrollToMap) $("#mapa").scrollIntoView({ behavior:"smooth", block:"start" });
  }

  /* ========================================================
     9. Matriz de riesgo (probabilidad × impacto)
     ======================================================== */
  function riskTone(score){
    if (score <= 4) return "riskcell--low";
    if (score <= 8) return "riskcell--mid";
    if (score <= 12) return "riskcell--high";
    return "riskcell--crit";
  }
  function renderRiskMatrix(){
    const grid = $("#risk-grid");
    if (!grid) return;
    let html = "";
    for (let impact = 4; impact >= 1; impact--){
      for (let prob = 1; prob <= 4; prob++){
        const inCell = DATA.filter(d => d.prob === prob && d.impact === impact);
        html += `<div class="riskcell ${riskTone(prob * impact)}">
          <span class="riskcell__coord">P${prob}·I${impact}</span>
          ${inCell.map(d => `<button class="riskchip" type="button" data-id="${d.id}">${escapeHtml(dataText(d,"title"))}</button>`).join("")}
        </div>`;
      }
    }
    grid.innerHTML = html;
    grid.querySelectorAll(".riskchip").forEach(btn => {
      btn.addEventListener("click", () => selectConflict(btn.dataset.id, { panTo:true, scrollToMap:true }));
    });

    const scale = ui("riskScale");
    const axis = $("#risk-axis");
    if (axis) axis.innerHTML = scale.map(s => `<span>${escapeHtml(s)}</span>`).join("");
    const yaxis = $("#risk-yaxis");
    if (yaxis) yaxis.innerHTML = scale.slice().reverse().map(s => `<span>${escapeHtml(s)}</span>`).join("");
  }

  /* ========================================================
     10. Matriz regional
     ======================================================== */
  function renderRegionalMatrix(){
    const el = $("#region-matrix");
    if (!el) return;
    const byRegion = DATA.reduce((acc, d) => {
      acc[d.region] = acc[d.region] || { total:0, alta:0, medhigh:0, media:0, score:0 };
      acc[d.region].total += 1;
      acc[d.region].score += RANK[d.intensity];
      if (d.intensity === "alta") acc[d.region].alta += 1;
      if (d.intensity === "media-alta") acc[d.region].medhigh += 1;
      if (d.intensity === "media") acc[d.region].media += 1;
      return acc;
    }, {});
    const maxScore = Math.max(...Object.values(byRegion).map(r => r.score));

    el.innerHTML = Object.entries(byRegion)
      .sort((a,b) => b[1].score - a[1].score)
      .map(([region, r]) => {
        const pct = v => maxScore ? Math.round((v / maxScore) * 100) : 0;
        return `<article class="matrix-card">
          <div class="matrix-card__top">
            <h3>${escapeHtml(regionLabel(region))}</h3>
            <div class="matrix-card__score mono">${r.score}</div>
          </div>
          <div class="matrix-bars">
            <div class="matrix-bar"><span>${escapeHtml(intensityLabel("alta"))}</span><span class="matrix-bar__track"><span class="matrix-bar__fill" style="--value:${pct(r.alta*3)}"></span></span><strong>${r.alta}</strong></div>
            <div class="matrix-bar"><span>${escapeHtml(intensityLabel("media-alta"))}</span><span class="matrix-bar__track"><span class="matrix-bar__fill" style="--value:${pct(r.medhigh*2)}"></span></span><strong>${r.medhigh}</strong></div>
            <div class="matrix-bar"><span>${escapeHtml(intensityLabel("media"))}</span><span class="matrix-bar__track"><span class="matrix-bar__fill" style="--value:${pct(r.media)}"></span></span><strong>${r.media}</strong></div>
          </div>
        </article>`;
      }).join("");
  }

  /* ========================================================
     11. Escenarios y fuentes
     ======================================================== */
  function renderScenarios(){
    const el = $("#scenarios");
    if (!el) return;
    el.innerHTML = SCENARIOS.map((s, i) => {
      const en = SCENARIOS_EN[i] || {};
      const horizon = isES() ? s.horizon : (HORIZON_EN[s.horizon] || s.horizon);
      const label = isES() ? s.label : (en.label || s.label);
      const text = isES() ? s.text : (en.text || s.text);
      const ind = isES() ? s.indicator : (en.indicator || s.indicator);
      return `<article class="scenario scenario--${s.tone}">
        <div class="scenario__horizon mono">${escapeHtml(horizon)}</div>
        <span class="scenario__label">${escapeHtml(label)}</span>
        <p>${escapeHtml(text)}</p>
        <div class="scenario__ind"><strong>${escapeHtml(ui("escIndicator"))}</strong>${escapeHtml(ind)}</div>
      </article>`;
    }).join("");
  }

  function renderSources(){
    const el = $("#source-stack");
    if (!el) return;
    el.innerHTML = SOURCES.map(s => {
      const name = isES() ? s.name : (SOURCE_NAME_EN[s.name] || s.name);
      const scope = isES() ? s.scope : (SOURCE_SCOPE_EN[s.name] || s.scope);
      const rel = isES() ? s.reliability : (REL_EN[s.reliability] || s.reliability);
      const status = isES() ? s.status : (STATUS_EN[s.status] || s.status);
      const relClass = s.reliability === "Alta" ? "rel--alta" : s.reliability === "Media" ? "rel--media" : "rel--baja";
      const title = s.url
        ? `<a class="sourcecard__name" href="${s.url}" target="_blank" rel="noopener">${escapeHtml(name)} ↗</a>`
        : `<span class="sourcecard__name">${escapeHtml(name)}</span>`;
      return `<article class="sourcecard">
        <div class="sourcecard__top">${title}<span class="rel ${relClass}">${escapeHtml(rel)}</span></div>
        <p class="sourcecard__scope">${escapeHtml(scope)}</p>
        <span class="sourcecard__status">${escapeHtml(status)}</span>
      </article>`;
    }).join("");
  }

  /* ========================================================
     12. KPIs
     ======================================================== */
  function renderKPIs(){
    const total = DATA.length;
    const high = DATA.filter(d => d.intensity === "alta").length;
    const regions = new Set(DATA.map(d => d.region)).size;
    const confScore = { alta:3, media:2, baja:1 };
    const avg = DATA.reduce((s,d) => s + (confScore[d.confianza] || 2), 0) / (total || 1);
    const avgKey = avg >= 2.5 ? "alta" : avg >= 1.5 ? "media" : "baja";

    setText("#kpi-total", total);
    setText("#kpi-alta", high);
    setText("#kpi-regiones", regions);
    setText("#kpi-confianza", (CONF_SHORT[state.lang] || CONF_SHORT.es)[avgKey] || avgKey);
    setText("#hero-total", total);
    setText("#hero-high", high);
    setText("#hero-regions", regions);
  }

  /* ========================================================
     13. CSV
     ======================================================== */
  function downloadCSV(){
    const headers = isES()
      ? ["titulo","region","tipo","intensidad","probabilidad_1_4","impacto_1_4","confianza","resumen","hecho","evaluacion","hipotesis","senal","actores","riesgo_humanitario","evolucion_2026","fuentes"]
      : ["title","region","type","intensity","probability_1_4","impact_1_4","confidence","summary","fact","assessment","hypothesis","signal","actors","humanitarian_risk","outlook_2026","sources"];
    const rows = DATA.map(d => [
      dataText(d,"title"), regionLabel(d.region), typeLabel(d.type), intensityLabel(d.intensity),
      d.prob, d.impact, confLabel(d.confianza),
      dataText(d,"summary"), dataText(d,"hecho"), dataText(d,"evaluacion"), dataText(d,"hipotesis"), dataText(d,"senal"),
      dataText(d,"actors"), dataText(d,"humanitarian"), dataText(d,"outlook"), d.sources.join(" | ")
    ]);
    const note = isES()
      ? ["AVISO: datos simulados con fines de maqueta editorial. No es monitoreo en vivo ni predicción.","","","","","","","","","","","","","","",""]
      : ["NOTICE: simulated data for an editorial mock-up. Not live monitoring and not a prediction.","","","","","","","","","","","","","","",""];
    const csv = [note, headers, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type:"text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "geopolem-conflict-watchlist-2026-simulado.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  const dl = $("#download-csv");
  if (dl) dl.addEventListener("click", downloadCSV);

  /* ========================================================
     14. Textos estáticos por idioma
     ======================================================== */
  function updateStaticText(){
    document.documentElement.lang = state.lang;

    const nav = ui("nav");
    $$(".mainnav a").forEach((a,i) => { if (nav[i]) a.textContent = nav[i]; });
    setText("#badge-sim", ui("badgeSim"));
    setText("#clock-text", ui("clock"));

    const cautions = ui("cautions");
    $$("#cautions .caution").forEach((c,i) => { if (cautions[i]) c.textContent = cautions[i]; });

    setText("#hero-kicker", ui("heroKicker"));
    setHTML(".hero__title", ui("heroTitle"));
    setText("#hero-lede", ui("heroLede"));
    setHTML("#hero-note", ui("heroNote"));
    const ctaLong = $("#cta-long");
    if (ctaLong) ctaLong.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>${escapeHtml(ui("ctaLong"))}`;
    setText("#cta-board", ui("ctaBoard"));
    setText("#download-csv", ui("csv"));

    setText("#sp-title", ui("spTitle"));
    setText("#sp-date", ui("spDate"));
    setText("#sp-l1", ui("spL1"));
    setText("#sp-l2", ui("spL2"));
    setText("#sp-l3", ui("spL3"));

    const kpi = ui("kpi");
    $$(".kpi").forEach((el,i) => {
      if (!kpi[i]) return;
      el.querySelector(".kpi__label").textContent = kpi[i][0];
      el.querySelector(".kpi__hint").textContent = kpi[i][1];
    });

    setText("#metodo-kicker", ui("metodoKicker"));
    setText("#metodo-title", ui("metodoTitle"));
    setText("#metodo-text", ui("metodoText"));
    const mc = ui("methodCards");
    $$("#method-grid .method-card").forEach((card,i) => {
      if (!mc[i]) return;
      card.querySelector("h3").textContent = mc[i][0];
      card.querySelector("p").textContent = mc[i][1];
      card.querySelector(".rule").textContent = mc[i][2];
    });

    setText("#mapa-kicker", ui("mapaKicker"));
    setText("#mapa-title", ui("mapaTitle"));
    setText("#mapa-text", ui("mapaText"));
    setText("#panel-filters-title", ui("panelFilters"));
    setText("#panel-detail-title", ui("panelDetail"));
    const search = $("#search"); if (search) search.placeholder = ui("search");

    const legends = $$(".filter-group legend");
    if (legends[0]) legends[0].textContent = ui("intensity");
    if (legends[1]) legends[1].textContent = ui("region");
    if (legends[2]) legends[2].textContent = ui("type");
    const allI = $('#filter-intensity .chip[data-value="all"]');
    const allR = $('#filter-region .chip[data-value="all"]');
    const allT = $('#filter-type .chip[data-value="all"]');
    if (allI) allI.textContent = ui("allF");
    if (allR) allR.textContent = ui("allF");
    if (allT) allT.textContent = ui("allM");
    $$('#filter-intensity .chip:not([data-value="all"])').forEach(chip => {
      const v = chip.dataset.value;
      const cls = v === "alta" ? "swatch--high" : v === "media-alta" ? "swatch--medhigh" : "swatch--med";
      chip.innerHTML = `<span class="swatch ${cls}" aria-hidden="true"></span>${escapeHtml(intensityLabel(v))}`;
    });
    $$('#filter-region .chip:not([data-value="all"])').forEach(c => c.textContent = regionLabel(c.dataset.value));
    $$('#filter-type .chip:not([data-value="all"])').forEach(c => c.textContent = typeLabel(c.dataset.value));
    setText("#reset", ui("reset"));

    setText("#legend-title", ui("legendTitle"));
    setText("#legend-note", ui("legendNote"));
    const legendRows = $$(".legend__row span:last-child");
    if (legendRows[0]) legendRows[0].textContent = intensityLabel("alta");
    if (legendRows[1]) legendRows[1].textContent = intensityLabel("media-alta");
    if (legendRows[2]) legendRows[2].textContent = intensityLabel("media");

    setText("#detail-placeholder h3", ui("selectTitle"));
    setText("#detail-placeholder p", ui("selectText"));
    setText("#lbl-hecho", ui("lblHecho"));
    setText("#lbl-evaluacion", ui("lblEval"));
    setText("#lbl-hipotesis", ui("lblHip"));
    setText("#lbl-senal", ui("lblSenal"));
    const dts = $$(".detail__grid dt");
    if (dts[0]) dts[0].textContent = ui("actors");
    if (dts[1]) dts[1].textContent = ui("humanitarian");
    if (dts[2]) dts[2].textContent = ui("outlook");
    setText(".detail__foot span:first-child", ui("sourcesLabel"));

    setText("#riesgo-kicker", ui("riesgoKicker"));
    setText("#riesgo-title", ui("riesgoTitle"));
    setText("#riesgo-text", ui("riesgoText"));
    setText("#risk-ylabel", ui("riskY"));
    setText("#risk-xlabel", ui("riskX"));
    setText("#matrix-kicker", ui("matrixKicker"));
    setText("#matrix-title", ui("matrixTitle"));
    setText("#matrix-text", ui("matrixText"));

    setText("#focos-kicker", ui("focosKicker"));
    setText("#focos-title", ui("focosTitle"));
    setText("#focos-text", ui("focosText"));
    setText("#senales-kicker", ui("senalesKicker"));
    setText("#senales-title", ui("senalesTitle"));
    setText("#senales-text", ui("senalesText"));
    setText("#esc-kicker", ui("escKicker"));
    setText("#esc-title", ui("escTitle"));
    setText("#esc-text", ui("escText"));
    setText("#crono-kicker", ui("cronoKicker"));
    setText("#crono-title", ui("cronoTitle"));
    setText("#crono-text", ui("cronoText"));
    setText("#av-kicker", ui("avKicker"));
    setText("#av-title", ui("avTitle"));
    setText("#av-text", ui("avText"));
    setText("#src-kicker", ui("srcKicker"));
    setText("#src-title", ui("srcTitle"));
    setText("#src-text", ui("srcText"));
    setText("#mtd-kicker", ui("mtdKicker"));
    setText("#mtd-title", ui("mtdTitle"));

    updateLongform();
  }

  /* Bloques largos: ES desde el DOM original, resto en inglés */
  const LONGFORM_ES = {};
  function captureLongform(){
    LONGFORM_ES.signals = $$(".signal").map(s => [s.querySelector("h3").innerHTML, s.querySelector("p").innerHTML]);
    LONGFORM_ES.timeline = $$(".timeline__list li p").map(p => p.innerHTML);
    LONGFORM_ES.methodCols = $$(".method-cols > div").map(col => [
      col.querySelector("h3").innerHTML,
      Array.from(col.querySelectorAll("li")).map(li => li.innerHTML)
    ]);
    LONGFORM_ES.usage = $$(".usage__box").map(box => [
      box.querySelector("h3").innerHTML,
      Array.from(box.querySelectorAll("li")).map(li => li.innerHTML)
    ]);
    LONGFORM_ES.avCards = $$(".avcard").map(c => [
      c.querySelector(".avcard__kicker").innerHTML,
      c.querySelector("h3").innerHTML,
      c.querySelector("p").innerHTML,
      c.querySelector(".avcard__link").innerHTML
    ]);
  }
  function updateLongform(){
    const src = isES() ? LONGFORM_ES : LONGFORM_EN;
    $$(".signal").forEach((s,i) => {
      if (!src.signals[i]) return;
      s.querySelector("h3").innerHTML = src.signals[i][0];
      s.querySelector("p").innerHTML = src.signals[i][1];
    });
    $$(".timeline__list li p").forEach((p,i) => { if (src.timeline[i]) p.innerHTML = src.timeline[i]; });
    $$(".method-cols > div").forEach((col,i) => {
      if (!src.methodCols[i]) return;
      col.querySelector("h3").innerHTML = src.methodCols[i][0];
      col.querySelectorAll("li").forEach((li,j) => { if (src.methodCols[i][1][j]) li.innerHTML = src.methodCols[i][1][j]; });
    });
    $$(".usage__box").forEach((box,i) => {
      if (!src.usage[i]) return;
      box.querySelector("h3").innerHTML = src.usage[i][0];
      box.querySelectorAll("li").forEach((li,j) => { if (src.usage[i][1][j]) li.innerHTML = src.usage[i][1][j]; });
    });
    $$(".avcard").forEach((c,i) => {
      if (!src.avCards[i]) return;
      c.querySelector(".avcard__kicker").innerHTML = src.avCards[i][0];
      c.querySelector("h3").innerHTML = src.avCards[i][1];
      c.querySelector("p").innerHTML = src.avCards[i][2];
      c.querySelector(".avcard__link").innerHTML = src.avCards[i][3];
    });
  }

  /* ========================================================
     15. Eventos
     ======================================================== */
  $$(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      state.filters[chip.dataset.filter] = chip.dataset.value;
      chip.parentElement.querySelectorAll(".chip").forEach(c => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      renderList();
    });
  });

  $("#search").addEventListener("input", e => {
    state.search = e.target.value.trim();
    renderList();
  });

  $("#reset").addEventListener("click", () => {
    state.filters = { intensity:"all", region:"all", type:"all" };
    state.search = "";
    $("#search").value = "";
    $$(".chips").forEach(group => {
      group.querySelectorAll(".chip").forEach(c => c.classList.remove("is-active"));
      const all = group.querySelector('.chip[data-value="all"]');
      if (all) all.classList.add("is-active");
    });
    renderList();
  });

  $$(".lang__btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.lang = btn.dataset.lang || "es";
      $$(".lang__btn").forEach(b => b.classList.toggle("is-active", b === btn));
      updateStaticText();
      DATA.forEach(d => { if (markers[d.id]) markers[d.id].bindPopup(popupHtml(d)); });
      renderKPIs();
      renderList();
      renderCards();
      renderRiskMatrix();
      renderRegionalMatrix();
      renderScenarios();
      renderSources();
      if (state.selectedId) selectConflict(state.selectedId);
    });
  });

  /* Fachada de vídeo: carga YouTube sólo al pulsar (nocookie) */
  $$(".avcard__media").forEach(media => {
    const btn = media.querySelector(".avfacade");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const id = media.dataset.video;
      media.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0"
        title="GEOPÓLEM · YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen loading="lazy"></iframe>`;
    });
  });

  /* Zoom con rueda sólo tras interacción explícita */
  if (map) {
    map.on("click", () => map.scrollWheelZoom.enable());
    map.on("mouseout", () => map.scrollWheelZoom.disable());
  }

  /* ========================================================
     16. Init
     ======================================================== */
  captureLongform();
  updateStaticText();
  renderKPIs();
  renderList();
  renderCards();
  renderRiskMatrix();
  renderRegionalMatrix();
  renderScenarios();
  renderSources();
})();
