// GEOPÓLEM Command App — React + htm (no build step)
import React, { useState, useMemo, useEffect, useRef } from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';
import htm from 'https://esm.sh/htm@3.1.1';
import { FOCOS, CATEGORIES, REGIONS, SYSTEMA_NODES, SYSTEMA_LINKS, BRIEF_DIARIO, KPIS, MILEX, DOCTRINA, SENTINEL_BRIEF, PLAN_Z, FICHA_VENTAJA, CONFLICTOS_ACTIVOS } from './data.js';
import { CONTINENTS, MAP_W, MAP_H, project } from './worldmap.js';
import { VIDEOS, VIDEO_CATEGORIES } from './videos.js';
import { loadWatchlistFocos } from './api-adapter.js';

const html = htm.bind(React.createElement);
const API_BASE = window.GEOP_API_BASE || ('__PORT_8000__'.startsWith('__') ? 'http://127.0.0.1:8000' : '__PORT_8000__');

async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `API ${res.status}`);
  return data;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

/* ========================================================================
   I18N — etiquetas principales. Idiomas: ES (base), EN, FR, DE, LB
   ======================================================================== */
const I18N = {
  ES: {
    welcome: 'Bienvenido al tablero.',
    tagline: 'GEO + PÓLEMOS · sala situacional editorial',
    nav: { dashboard:'Tablero', map:'Mapa', doctrina:'Doctrina', sentinel:'SENTINEL', planz:'Plan Z', ficha:'Ficha', watchlist:'Watchlist', system:'Sistema-mundo', analysis:'Análisis', scenarios:'Escenarios', sala:'Sala audiovisual', rearm:'Rearme', monetization:'Monetización', editor:'Editor', brief:'Brief diario', studio:'Studio', products:'Productos', osint:'OSINT Geopolítico' },
    kpi: 'Indicadores clave',
    alerts: 'Alertas en vivo',
    selectFoco: 'Selecciona un foco',
    foda: 'FODA', pestel:'PESTEL', actors:'Actores', risk:'Matriz de riesgo',
    scenarios: { base:'Base', escalada:'Escalada', ruptura:'Ruptura', desescalada:'Desescalada' },
    signals:'Señales tempranas', indicators:'Indicadores a vigilar', impact:'Impacto sectorial',
    studio:'Content Studio',
    filters:'Filtros', category:'Categoría', region:'Región', intensity:'Intensidad',
    openSitRoom:'Abrir sala situacional', closeSitRoom:'Cerrar sala situacional',
    editorialWarning:'Prototipo editorial basado en fuentes abiertas. No sustituye fuentes oficiales ni uso operativo.',
    todayBrief:'Brief diario',
    allTopics:'Todos los temas',
    nodes:'Nodos del sistema-mundo',
    systemIntro:'El sistema-mundo conecta energía, comercio, alimentos, agua, datos, migración, finanzas y clima. Una crisis en un nodo se propaga al resto.',
  },
  EN: {
    welcome: 'Welcome to the board.',
    tagline: 'GEO + PÓLEMOS · editorial situation room',
    nav: { dashboard:'Dashboard', map:'Map', doctrina:'Doctrine', sentinel:'SENTINEL', planz:'Plan Z', ficha:'Brief', watchlist:'Watchlist', system:'World-system', analysis:'Analysis', scenarios:'Scenarios', sala:'Video intelligence', rearm:'Rearmament', monetization:'Monetization', editor:'Editor', brief:'Daily brief', studio:'Studio', products:'Products', osint:'OSINT Geopolitical' },
    kpi:'Key indicators',
    alerts:'Live alerts',
    selectFoco:'Select a focus',
    foda:'SWOT', pestel:'PESTEL', actors:'Actors', risk:'Risk matrix',
    scenarios:{ base:'Base', escalada:'Escalation', ruptura:'Rupture', desescalada:'De-escalation' },
    signals:'Early signals', indicators:'Indicators to watch', impact:'Sector impact',
    studio:'Content Studio',
    filters:'Filters', category:'Category', region:'Region', intensity:'Intensity',
    openSitRoom:'Open situation room', closeSitRoom:'Close situation room',
    editorialWarning:'Editorial prototype based on open sources. Not a substitute for official sources or operational use.',
    todayBrief:'Daily brief',
    allTopics:'All topics',
    nodes:'World-system nodes',
    systemIntro:'The world-system links energy, trade, food, water, data, migration, finance and climate. A crisis in one node propagates to the rest.',
  },
  FR: {
    welcome:'Bienvenue sur le tableau.',
    tagline:'GEO + PÓLEMOS · salle de situation éditoriale',
    nav:{ dashboard:'Tableau', map:'Carte', doctrina:'Doctrine', sentinel:'SENTINEL', planz:'Plan Z', ficha:'Fiche', watchlist:'Watchlist', system:'Système-monde', analysis:'Analyse', scenarios:'Scénarios', sala:'Salle audiovisuelle', rearm:'Réarmement', monetization:'Monétisation', editor:'Éditeur', brief:'Brief quotidien', studio:'Studio', products:'Produits', osint:'OSINT Géopolitique' },
    kpi:'Indicateurs clés', alerts:'Alertes en direct',
    selectFoco:'Sélectionner un foyer',
    foda:'SWOT', pestel:'PESTEL', actors:'Acteurs', risk:'Matrice des risques',
    scenarios:{ base:'Base', escalada:'Escalade', ruptura:'Rupture', desescalada:'Désescalade' },
    signals:'Signaux précoces', indicators:'Indicateurs à surveiller', impact:'Impact sectoriel',
    studio:'Content Studio',
    filters:'Filtres', category:'Catégorie', region:'Région', intensity:'Intensité',
    openSitRoom:'Ouvrir la salle de situation', closeSitRoom:'Fermer la salle de situation',
    editorialWarning:'Prototype éditorial basé sur des sources ouvertes. Ne remplace pas les sources officielles ni un usage opérationnel.',
    todayBrief:'Brief quotidien', allTopics:'Tous les thèmes',
    nodes:'Nœuds du système-monde',
    systemIntro:'Le système-monde relie énergie, commerce, alimentation, eau, données, migration, finance et climat. Une crise dans un nœud se propage au reste.',
  },
  DE: {
    welcome:'Willkommen am Lagebrett.',
    tagline:'GEO + PÓLEMOS · redaktioneller Lageraum',
    nav:{ dashboard:'Dashboard', map:'Karte', doctrina:'Doktrin', sentinel:'SENTINEL', planz:'Plan Z', ficha:'Notiz', watchlist:'Watchlist', system:'Weltsystem', analysis:'Analyse', scenarios:'Szenarien', sala:'Lage-Videos', rearm:'Aufrüstung', monetization:'Monetarisierung', editor:'Editor', brief:'Tagesbrief', studio:'Studio', products:'Produkte', osint:'OSINT Geopolitik' },
    kpi:'Schlüsselindikatoren', alerts:'Live-Warnungen',
    selectFoco:'Brennpunkt auswählen',
    foda:'SWOT', pestel:'PESTEL', actors:'Akteure', risk:'Risikomatrix',
    scenarios:{ base:'Basis', escalada:'Eskalation', ruptura:'Bruch', desescalada:'Deeskalation' },
    signals:'Frühe Signale', indicators:'Zu beobachten', impact:'Sektorauswirkung',
    studio:'Content Studio',
    filters:'Filter', category:'Kategorie', region:'Region', intensity:'Intensität',
    openSitRoom:'Lageraum öffnen', closeSitRoom:'Lageraum schließen',
    editorialWarning:'Redaktioneller Prototyp auf Basis offener Quellen. Kein Ersatz für offizielle Quellen oder operative Nutzung.',
    todayBrief:'Tagesbrief', allTopics:'Alle Themen',
    nodes:'Weltsystem-Knoten',
    systemIntro:'Das Weltsystem verbindet Energie, Handel, Nahrung, Wasser, Daten, Migration, Finanzen und Klima. Eine Krise an einem Knoten breitet sich aus.',
  },
  LB: {
    welcome:'Wëllkomm um Tableau.',
    tagline:'GEO + PÓLEMOS · redaktionellen Situatiouns-Raum',
    nav:{ dashboard:'Tableau', map:'Kaart', doctrina:'Doktrin', sentinel:'SENTINEL', planz:'Plan Z', ficha:'Fiche', watchlist:'Watchlist', system:'Weltsystem', analysis:'Analyse', scenarios:'Szenarien', sala:'Audiovisuell Sall', rearm:'Oprüstung', monetization:'Monetiséierung', editor:'Editor', brief:'Deeglechen Brief', studio:'Studio', products:'Produkter', osint:'OSINT Geopolitik' },
    kpi:'Haaptindikateuren', alerts:'Live Alarmen',
    selectFoco:'Wielt e Foyer',
    foda:'SWOT', pestel:'PESTEL', actors:'Akteuren', risk:'Risiko-Matrix',
    scenarios:{ base:'Basis', escalada:'Eskalatioun', ruptura:'Brach', desescalada:'Deeskalatioun' },
    signals:'Fréi Signaler', indicators:'Z\u2019iwwerwaachen', impact:'Sektor-Impakt',
    studio:'Content Studio',
    filters:'Filteren', category:'Kategorie', region:'Regioun', intensity:'Intensitéit',
    openSitRoom:'Situatiouns-Raum opmaachen', closeSitRoom:'Situatiouns-Raum zoumaachen',
    editorialWarning:'Redaktionnelle Prototyp op Basis vun oppene Quellen. Ersetzt keng offiziell Quellen oder operationell Notzung.',
    todayBrief:'Deeglechen Brief', allTopics:'All Theme',
    nodes:'Knäpp vum Weltsystem',
    systemIntro:'D\u2019Weltsystem verbënnt Energie, Handel, Iesswueren, Waasser, Daten, Migratioun, Finanzen a Klima. Eng Kris an engem Knapp breet sech aus.',
  }
};

/* ========================================================================
   Sala audiovisual · Video intelligence — copy by language
   ======================================================================== */
const SALA_COPY = {
  ES: {
    eyebrow: 'SALA AUDIOVISUAL · OSINT',
    title: 'Bienvenidos al tablero',
    subtitle: 'Reels editoriales, manifiestos y briefings OSINT en formato audiovisual.',
    intro: 'Cada pieza es una tesis comprimida: contexto, evidencia y ángulo estratégico. Producción interna GEOPÓLEM.',
    featured: 'Destacados',
    library: 'Biblioteca completa',
    filterAll: 'Todos',
    audio: 'Audio',
    subs: 'Subtítulos',
    none: 'Sin subtítulos',
    duration: 'Duración',
    strategic: 'Ángulo estratégico',
    sources: 'Fuentes',
    editorialClose: 'Cierre editorial',
    source: 'Archivo fuente',
    play: 'Reproducir',
    vertical: 'Vertical · Reel',
    horizontal: 'Horizontal · Editorial',
    counter: (n) => `${n} piezas curadas`,
    badge: 'OSINT · Producción GEOPÓLEM',
    note: 'Material editorial basado en fuentes abiertas. Uso interpretativo, no operativo.',
  },
  EN: {
    eyebrow: 'VIDEO INTELLIGENCE · OSINT',
    title: 'Welcome to the board',
    subtitle: 'Editorial reels, manifestos and OSINT briefings in audiovisual format.',
    intro: 'Each piece is a compressed thesis: context, evidence and strategic angle. Produced in-house by GEOPÓLEM.',
    featured: 'Featured',
    library: 'Full library',
    filterAll: 'All',
    audio: 'Audio',
    subs: 'Subtitles',
    none: 'No subtitles',
    duration: 'Runtime',
    strategic: 'Strategic angle',
    sources: 'Sources',
    editorialClose: 'Editorial close',
    source: 'Source file',
    play: 'Play',
    vertical: 'Vertical · Reel',
    horizontal: 'Horizontal · Editorial',
    counter: (n) => `${n} curated pieces`,
    badge: 'OSINT · GEOPÓLEM production',
    note: 'Editorial material based on open sources. Interpretive use, not operational.',
  },
  FR: {
    eyebrow: 'SALLE AUDIOVISUELLE · OSINT',
    title: 'Bienvenue sur le tableau',
    subtitle: 'Reels éditoriaux, manifestes et briefings OSINT en format audiovisuel.',
    intro: 'Chaque pièce est une thèse compressée : contexte, preuves et angle stratégique. Production interne GEOPÓLEM.',
    featured: 'Sélection',
    library: 'Bibliothèque complète',
    filterAll: 'Tous',
    audio: 'Audio',
    subs: 'Sous-titres',
    none: 'Sans sous-titres',
    duration: 'Durée',
    strategic: 'Angle stratégique',
    sources: 'Sources',
    editorialClose: 'Conclusion éditoriale',
    source: 'Fichier source',
    play: 'Lire',
    vertical: 'Vertical · Reel',
    horizontal: 'Horizontal · Éditorial',
    counter: (n) => `${n} pièces curatées`,
    badge: 'OSINT · Production GEOPÓLEM',
    note: 'Matériel éditorial fondé sur des sources ouvertes. Usage interprétatif, non opérationnel.',
  },
  DE: {
    eyebrow: 'LAGE-VIDEOS · OSINT',
    title: 'Willkommen am Lagebrett',
    subtitle: 'Redaktionelle Reels, Manifeste und OSINT-Briefings im audiovisuellen Format.',
    intro: 'Jedes Stück ist eine komprimierte These: Kontext, Belege und strategischer Blickwinkel. Eigenproduktion von GEOPÓLEM.',
    featured: 'Auswahl',
    library: 'Vollständige Bibliothek',
    filterAll: 'Alle',
    audio: 'Audio',
    subs: 'Untertitel',
    none: 'Keine Untertitel',
    duration: 'Länge',
    strategic: 'Strategischer Blickwinkel',
    sources: 'Quellen',
    editorialClose: 'Redaktioneller Abschluss',
    source: 'Quelldatei',
    play: 'Abspielen',
    vertical: 'Vertikal · Reel',
    horizontal: 'Horizontal · Redaktion',
    counter: (n) => `${n} kuratierte Stücke`,
    badge: 'OSINT · GEOPÓLEM-Produktion',
    note: 'Redaktionelles Material aus offenen Quellen. Interpretativ, nicht operativ.',
  },
  LB: {
    eyebrow: 'AUDIOVISUELL SALL · OSINT',
    title: 'Wëllkomm um Tableau',
    subtitle: 'Redaktionnel Reels, Manifester an OSINT-Briefingen am audiovisuelle Format.',
    intro: 'All Stéck ass eng kompriméiert Thes: Kontext, Beweiser a strategeschen Blickwénkel. Eege Produktioun vu GEOPÓLEM.',
    featured: 'Auswiel',
    library: 'Voll Bibliothéik',
    filterAll: 'All',
    audio: 'Audio',
    subs: 'Ënnertitelen',
    none: 'Keng Ënnertitelen',
    duration: 'Längt',
    strategic: 'Strategesche Blickwénkel',
    sources: 'Quellen',
    editorialClose: 'Redaktionnellen Ofschloss',
    source: 'Quelldatei',
    play: 'Ofspillen',
    vertical: 'Vertikal · Reel',
    horizontal: 'Horizontal · Redaktioun',
    counter: (n) => `${n} curéiert Stécker`,
    badge: 'OSINT · GEOPÓLEM-Produktioun',
    note: 'Redaktionelle Material aus oppene Quellen. Interpretativ, net operationell.',
  },
};

/* ========================================================================
   Helpers
   ======================================================================== */
function clsx(...xs){ return xs.filter(Boolean).join(' '); }

const TONE_TO_COLOR = {
  red:    { txt:'text-alert',    bg:'bg-alert/10',    ring:'ring-alert/40' },
  cyan:   { txt:'text-radar',    bg:'bg-radar/10',    ring:'ring-radar/40' },
  amber:  { txt:'text-risk',     bg:'bg-risk/10',     ring:'ring-risk/40' },
  orange: { txt:'text-orange-400', bg:'bg-orange-400/10', ring:'ring-orange-400/40' },
  violet: { txt:'text-violet-400', bg:'bg-violet-400/10', ring:'ring-violet-400/40' },
  green:  { txt:'text-intel',    bg:'bg-intel/10',    ring:'ring-intel/40' },
  pink:   { txt:'text-pink-400', bg:'bg-pink-400/10', ring:'ring-pink-400/40' },
};

const OSINT_SOURCE_TYPES = [
  'Fuente abierta',
  'Fuente primaria / oficial',
  'Informe / documento',
  'Mapa / geodato',
  'Dataset / tabla',
  'Imagen / evidencia visual',
  'Nota analítica',
  'Red social / señal débil'
];

const RELIABILITY_LEVELS = {
  A: { label:'A · Alta', tone:'text-intel', desc:'Primaria, oficial o evidencia directa robusta' },
  B: { label:'B · Buena', tone:'text-radar', desc:'Institucional, especializada o dataset verificable' },
  C: { label:'C · Media', tone:'text-risk', desc:'Útil, pero requiere contraste adicional' },
  D: { label:'D · Débil', tone:'text-alert', desc:'Señal no confirmada o red social' },
};

const WORKFLOW_STATES = [
  { id:'draft', label:'Borrador', tone:'text-risk', short:'Borrador', desc:'Hipótesis editorial en construcción' },
  { id:'verification', label:'Verificación OSINT', tone:'text-radar', short:'Verificación', desc:'Contraste de fuentes, fecha, mapa y evidencia' },
  { id:'review', label:'Revisión editorial', tone:'text-orange-400', short:'Revisión', desc:'Lectura final, lenguaje, riesgo y coherencia' },
  { id:'published', label:'Publicado', tone:'text-intel', short:'Publicado', desc:'Ficha lista para tablero y dossier' },
];

const WORKFLOW_INDEX = Object.fromEntries(WORKFLOW_STATES.map((state, index) => [state.id, index]));
const WORKFLOW_BY_ID = Object.fromEntries(WORKFLOW_STATES.map(state => [state.id, state]));

const VERIFICATION_ITEMS = [
  ['geo', 'Geolocalización contrastada'],
  ['sources', 'Fuentes abiertas revisadas'],
  ['date', 'Fecha y vigencia verificadas'],
  ['risk', 'Riesgos y escenarios revisados'],
  ['legal', 'Lenguaje y legalidad editorial revisados'],
];

const VERIFICATION_FORM_KEYS = {
  geo: 'verifyGeo',
  sources: 'verifySources',
  date: 'verifyDate',
  risk: 'verifyRisk',
  legal: 'verifyLegal',
};

const ROLE_PERMISSION_LABELS = {
  view_editor: 'Ver archivo',
  edit_foco: 'Crear/editar',
  review_foco: 'Revisar',
  publish_foco: 'Publicar',
  upload_attachment: 'Adjuntar',
  download_attachment: 'Descargar',
  delete_attachment: 'Quitar adjuntos',
  export_dossier: 'Exportar dossier',
  delete_foco: 'Eliminar fichas',
  manage_security: 'Seguridad',
};

const EDITOR_ROLES = [
  { id: 'analyst', label: 'Analista OSINT', desc: 'Carga fichas, fuentes y borradores; no publica ni elimina.' },
  { id: 'reviewer', label: 'Revisor editorial', desc: 'Verifica, revisa y depura expedientes antes de publicación.' },
  { id: 'director', label: 'Director editorial', desc: 'Control total: publicación, eliminación, seguridad y usuarios.' },
];

function workflowInfo(status) {
  return WORKFLOW_BY_ID[status] || WORKFLOW_BY_ID.draft;
}

function verificationProgress(focoOrForm = {}) {
  const verification = focoOrForm.verification || Object.fromEntries(
    VERIFICATION_ITEMS.map(([key]) => [key, Boolean(focoOrForm[VERIFICATION_FORM_KEYS[key]])])
  );
  return VERIFICATION_ITEMS.reduce((count, [key]) => count + (verification?.[key] ? 1 : 0), 0);
}

function inferSourceType(file) {
  const blob = `${file?.name || ''} ${file?.type || ''}`.toLowerCase();
  if (/(map|mapa|geo|kml|kmz|shp)/.test(blob)) return 'Mapa / geodato';
  if (/(pdf|report|informe|dossier)/.test(blob)) return 'Informe / documento';
  if (/(image|jpeg|jpg|png|webp)/.test(blob)) return 'Imagen / evidencia visual';
  if (/(csv|json|xls|data|dataset)/.test(blob)) return 'Dataset / tabla';
  if (/(txt|md|note|nota)/.test(blob)) return 'Nota analítica';
  return 'Fuente abierta';
}

/* ========================================================================
   Brand mark (inline SVG logo)
   ======================================================================== */
function BrandMark({ size=28 }) {
  return html`<svg width=${size} height=${size} viewBox="0 0 64 64" aria-label="GEOPÓLEM" fill="none">
    <circle cx="32" cy="32" r="26" stroke="currentColor" stroke-width="1.3" opacity=".4"/>
    <circle cx="32" cy="32" r="18" stroke="currentColor" stroke-width="1.3"/>
    <circle cx="32" cy="32" r="3" fill="#ef4444"/>
    <line x1="32" y1="2" x2="32" y2="62" stroke="currentColor" stroke-width="0.6" opacity=".35"/>
    <line x1="2" y1="32" x2="62" y2="32" stroke="currentColor" stroke-width="0.6" opacity=".35"/>
    <path d="M 32 6 L 32 14 M 32 50 L 32 58 M 6 32 L 14 32 M 50 32 L 58 32" stroke="currentColor" stroke-width="1.4"/>
    <path d="M 14 14 L 20 20 M 44 20 L 50 14 M 14 50 L 20 44 M 44 44 L 50 50" stroke="currentColor" stroke-width="0.8" opacity=".7"/>
  </svg>`;
}

/* ========================================================================
   Header
   ======================================================================== */
function Header({ t, lang, setLang, onSitRoom, sitRoom, view, setView }) {
  const langs = ['ES','EN','FR','DE','LB'];
  const goView = (key) => {
    setView(key);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return html`
  <header class="sticky top-0 z-30 border-b border-radar/10 bg-carbon-950/85 backdrop-blur supports-[backdrop-filter]:bg-carbon-950/70">
    <div class="max-w-[1600px] mx-auto px-4 lg:px-6 h-14 flex items-center gap-3 lg:gap-6">
      <div class="flex items-center gap-2.5 text-radar">
        <${BrandMark} size=${26} />
        <div class="leading-tight">
          <div class="font-display font-bold tracking-wider text-[15px] text-slate-100">GEOPÓLEM</div>
          <div class="text-[9.5px] uppercase tracking-[0.22em] text-slate-500 -mt-0.5">Command · Situation Room</div>
        </div>
      </div>

      <nav class="hidden md:flex items-center gap-0.5 ml-2 min-w-0 flex-1 overflow-x-auto no-scrollbar">
        ${Object.entries(t.nav).map(([k,v]) => html`
          <button key=${k}
            onClick=${() => goView(k)}
            class=${clsx(
              'px-3 py-1.5 rounded text-[12px] font-medium tracking-wide transition',
              view===k ? 'bg-radar/10 text-radar' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            )}>
            ${v}
          </button>
        `)}
      </nav>

      <div class="ml-auto flex items-center gap-2 lg:gap-3">
        <div class="hidden sm:flex items-center gap-1 px-2 py-1 rounded border border-radar/15 bg-carbon-900/70">
          <div class="w-1.5 h-1.5 rounded-full bg-intel animate-pulse-dot"></div>
          <span class="font-mono text-[10.5px] uppercase tracking-widest text-slate-400">Live · OSINT</span>
        </div>

        <div class="flex items-center rounded border border-white/10 overflow-hidden">
          ${langs.map(l => html`
            <button key=${l} onClick=${()=>setLang(l)}
              class=${clsx(
                'px-1.5 sm:px-2 py-1 font-mono text-[10.5px] tracking-wider transition',
                lang===l ? 'bg-radar text-carbon-950' : 'text-slate-400 hover:bg-white/5'
              )}>${l}</button>
          `)}
        </div>

        <button onClick=${onSitRoom}
          class=${clsx(
            'hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded text-[11.5px] font-medium tracking-wide border transition',
            sitRoom
              ? 'border-alert/50 text-alert hover:bg-alert/10'
              : 'border-radar/40 text-radar hover:bg-radar/10 hover:shadow-glow'
          )}>
          <span class="relative flex w-2 h-2">
            <span class="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping-ring" style=${{background: sitRoom?'#ef4444':'#22d3ee'}}></span>
            <span class="relative inline-flex rounded-full h-2 w-2" style=${{background: sitRoom?'#ef4444':'#22d3ee'}}></span>
          </span>
          ${sitRoom ? t.closeSitRoom : t.openSitRoom}
        </button>
      </div>
    </div>

    <!-- Mobile nav -->
    <div class="md:hidden border-t border-white/5 overflow-x-auto">
      <div class="flex gap-1 px-3 py-1.5 min-w-max">
        ${Object.entries(t.nav).map(([k,v]) => html`
          <button key=${k} onClick=${()=>goView(k)}
            class=${clsx(
              'px-2.5 py-1 rounded text-[11px] font-medium tracking-wide whitespace-nowrap transition',
              view===k ? 'bg-radar/10 text-radar' : 'text-slate-400 hover:text-slate-200'
            )}>${v}</button>
        `)}
      </div>
    </div>
  </header>`;
}

/* ========================================================================
   KPI Strip
   ======================================================================== */
function KpiStrip() {
  return html`
  <section class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2">
    ${KPIS.map(k => {
      const tone = TONE_TO_COLOR[k.tone] || TONE_TO_COLOR.cyan;
      return html`
      <div key=${k.id} class="relative panel rounded px-3 py-2.5 hover:border-radar/30 transition">
        <span class="corner-tl"></span><span class="corner-tr"></span>
        <div class="heading-mono">${k.label}</div>
        <div class="mt-0.5 flex items-baseline gap-1.5">
          <div class=${clsx('font-display font-bold text-xl tracking-tight', tone.txt)}>${k.value}</div>
          <div class="font-mono text-[10px] text-slate-500">${k.trend}</div>
        </div>
        <div class="text-[10px] text-slate-500 mt-0.5">${k.sub}</div>
      </div>`;
    })}
  </section>`;
}

/* ========================================================================
   World Map (SVG)
   ======================================================================== */
function WorldMap({ focos, selectedId, onSelect, filter }) {
  const visible = focos.filter(f => !filter || f.category === filter || filter==='all');
  return html`
  <div class="relative panel rounded-md overflow-hidden">
    <span class="corner-tl"></span><span class="corner-tr"></span>
    <span class="corner-bl"></span><span class="corner-br"></span>

    <div class="absolute top-2.5 left-3 z-10 flex items-center gap-2">
      <span class="heading-mono">WORLD MAP · EQUIRECT · v0.9</span>
    </div>
    <div class="absolute top-2.5 right-3 z-10 flex items-center gap-1.5">
      <div class="w-1.5 h-1.5 rounded-full bg-radar animate-pulse-dot"></div>
      <span class="font-mono text-[10px] tracking-widest text-slate-400 uppercase">RADAR ACTIVE</span>
    </div>

    <!-- scanline overlay -->
    <div class="absolute inset-0 scanlines pointer-events-none"></div>

    <svg viewBox=${`0 0 ${MAP_W} ${MAP_H}`} class="map-svg block w-full h-auto" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="oceanGrad" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="#0a1420"/>
          <stop offset="100%" stop-color="#04080d"/>
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <rect width=${MAP_W} height=${MAP_H} fill="url(#oceanGrad)" class="ocean"/>

      <!-- Graticule -->
      <g class="graticule">
        ${[...Array(11)].map((_,i) => html`<line key=${'h'+i} x1="0" y1=${(MAP_H/10)*i} x2=${MAP_W} y2=${(MAP_H/10)*i}/>`)}
        ${[...Array(13)].map((_,i) => html`<line key=${'v'+i} x1=${(MAP_W/12)*i} y1="0" x2=${(MAP_W/12)*i} y2=${MAP_H}/>`)}
        <line x1="0" y1=${MAP_H/2} x2=${MAP_W} y2=${MAP_H/2} stroke="rgba(34,211,238,0.18)" stroke-width="0.5"/>
      </g>

      <!-- Continents -->
      <g>
        ${CONTINENTS.map(c => html`<path key=${c.id} d=${c.d} class="land"/>`)}
      </g>

      <!-- Hotspots -->
      <g>
        ${visible.map(f => {
          const [x,y] = project(f.coords.lng, f.coords.lat);
          const cat = CATEGORIES[f.category] || CATEGORIES.conflicto;
          const isSel = selectedId === f.id;
          const r = 3 + f.intensity * 0.6;
          const labelText = f.title.split('—')[0].trim();
          const labelX = r + 12;
          const labelY = -r - 12;
          const labelW = Math.max(78, Math.min(190, labelText.length * 5.8 + 18));
          return html`
          <g key=${f.id} class="hotspot cursor-pointer" transform=${`translate(${x} ${y})`}
             onClick=${() => onSelect(f.id)}>
            <title>${f.title}</title>
            <circle class="ring" r=${r+2} fill="none" stroke=${cat.color} stroke-width="1" opacity="0.8"/>
            <circle class="core" r=${r} fill=${cat.color} filter="url(#glow)"/>
            ${isSel ? html`
              <g class="selected-label" pointer-events="none">
                <circle r=${r+9} fill="none" stroke="#22d3ee" stroke-width="1" stroke-dasharray="3 2"/>
                <path d=${`M ${r+4} ${-r-2} L ${labelX-4} ${labelY+8}`} stroke="#22d3ee" stroke-width="0.6" opacity="0.65"/>
                <rect x=${labelX-2} y=${labelY-7} width=${labelW} height="18" rx="3"
                  fill="rgba(2,5,10,0.88)" stroke="rgba(34,211,238,0.45)" stroke-width="0.5"/>
                <text x=${labelX+7} y=${labelY+5} font-family="JetBrains Mono, monospace" font-size="8"
                  fill="#e2e8f0" opacity="1">${labelText}</text>
              </g>
            ` : null}
          </g>`;
        })}
      </g>

      <!-- Compass -->
      <g transform="translate(40,440)" opacity="0.6">
        <circle r="18" fill="none" stroke="#22d3ee" stroke-width="0.6"/>
        <line x1="0" y1="-18" x2="0" y2="18" stroke="#22d3ee" stroke-width="0.6"/>
        <line x1="-18" y1="0" x2="18" y2="0" stroke="#22d3ee" stroke-width="0.6"/>
        <text x="0" y="-22" text-anchor="middle" font-family="JetBrains Mono" font-size="8" fill="#22d3ee">N</text>
      </g>
    </svg>

    <div class="absolute bottom-2.5 right-3 flex items-center gap-2 flex-wrap z-10">
      ${Object.values(CATEGORIES).filter(c => ['conflicto','agua','energia','defensa','ia','migracion','salud'].includes(c.id)).map(c => html`
        <div key=${c.id} class="flex items-center gap-1 font-mono text-[9.5px] text-slate-400 uppercase tracking-wider">
          <span class="w-1.5 h-1.5 rounded-full" style=${{background:c.color}}></span>${c.label}
        </div>
      `)}
    </div>
  </div>`;
}

/* ========================================================================
   Alerts panel
   ======================================================================== */
function SentinelCouplingLayer({ onOpen }) {
  const b = SENTINEL_BRIEF;
  return html`
  <div class="mb-3 rounded border border-alert/25 bg-alert/[0.04] p-2.5">
    <div class="flex items-center justify-between gap-2 mb-1.5">
      <div class="flex items-center gap-1.5">
        <span class="relative flex w-1.5 h-1.5">
          <span class="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping-ring bg-alert"></span>
          <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-alert"></span>
        </span>
        <span class="font-mono text-[9.5px] uppercase tracking-widest text-alert-soft">${b.layerLabel}</span>
      </div>
      <span class="font-mono text-[9px] uppercase tracking-wider text-slate-500">SENTINEL</span>
    </div>
    <div class="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">${b.window}</div>
    <div class="flex flex-col gap-1">
      ${b.points.map(p => html`
        <button key=${p.id} onClick=${onOpen}
          class="group text-left px-2 py-1.5 rounded border border-white/5 hover:border-radar/25 hover:bg-white/[0.03] transition">
          <div class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full shrink-0" style=${{background:p.accent, boxShadow:`0 0 6px ${p.accent}`}}></span>
            <span class="flex-1 min-w-0 text-[11.5px] text-slate-200 leading-tight truncate">${p.location}</span>
            <span class="font-mono text-[8.5px] uppercase tracking-wider shrink-0" style=${{color: p.status==='confirmado' ? '#fca5a5' : '#67e8f9'}}>${p.status}</span>
          </div>
        </button>`)}
    </div>
    <button onClick=${onOpen}
      class="w-full mt-1.5 text-[9px] font-mono uppercase tracking-widest text-radar hover:text-radar-glow transition">
      Ver brief semanal →
    </button>
  </div>`;
}

function AlertsPanel({ focos, onSelect, selectedId, onOpenSentinel }) {
  // Build alerts list grouped: top by intensity
  const sorted = [...focos].sort((a,b)=>b.intensity-a.intensity);
  return html`
  <div class="panel rounded-md p-3 lg:p-4 h-full flex flex-col">
    <div class="flex items-center justify-between mb-2.5">
      <div class="heading-mono">Alertas · categorías</div>
      <div class="flex items-center gap-1">
        <div class="w-1.5 h-1.5 rounded-full bg-alert animate-pulse-dot"></div>
        <span class="font-mono text-[10px] uppercase tracking-widest text-alert">LIVE</span>
      </div>
    </div>
    ${onOpenSentinel && html`<${SentinelCouplingLayer} onOpen=${onOpenSentinel}/>`}
    <div class="flex flex-col gap-1.5 overflow-y-auto pr-1 -mr-2" style=${{maxHeight:'460px'}}>
      ${sorted.map(f => {
        const cat = CATEGORIES[f.category] || CATEGORIES.conflicto;
        const isSel = selectedId === f.id;
        return html`
        <button key=${f.id} onClick=${()=>onSelect(f.id)}
          class=${clsx(
            'group text-left px-3 py-2 rounded border transition relative',
            isSel ? 'border-radar/50 bg-radar/5' : 'border-white/5 hover:border-radar/25 hover:bg-white/[0.03]'
          )}>
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full mt-0.5 shrink-0" style=${{background:cat.color, boxShadow:`0 0 6px ${cat.color}`}}></span>
            <div class="flex-1 min-w-0">
              <div class="text-[12.5px] font-medium text-slate-200 leading-tight truncate">${f.title}</div>
              <div class="text-[10px] text-slate-500 mt-0.5 font-mono uppercase tracking-wider">${cat.label} · ${f.region}</div>
            </div>
            <div class="font-mono text-[10px] text-slate-400 shrink-0">
              ${[...Array(5)].map((_,i) => html`<span key=${i} class=${i<f.intensity?'text-alert':'text-slate-700'}>■</span>`)}
            </div>
          </div>
        </button>`;
      })}
    </div>
  </div>`;
}

/* ========================================================================
   Watchlist (cards w/ filters)
   ======================================================================== */
function Watchlist({ t, focos, onSelect, selectedId }) {
  const [cat, setCat] = useState('all');
  const [region, setRegion] = useState('all');
  const [minInt, setMinInt] = useState(0);

  const filtered = focos.filter(f =>
    (cat==='all' || f.category===cat) &&
    (region==='all' || f.region===region) &&
    (f.intensity >= minInt)
  );

  return html`
  <section class="panel rounded-md p-4">
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <div class="heading-mono">${t.nav.watchlist} · ${filtered.length}</div>
      <div class="ml-auto flex flex-wrap items-center gap-2">
        <select value=${cat} onChange=${e=>setCat(e.target.value)}
          class="bg-carbon-900 border border-white/10 rounded px-2 py-1 text-[12px] text-slate-200 focus:border-radar/40 focus:outline-none">
          <option value="all">${t.allTopics}</option>
          ${Object.values(CATEGORIES).map(c => html`<option key=${c.id} value=${c.id}>${c.label}</option>`)}
        </select>
        <select value=${region} onChange=${e=>setRegion(e.target.value)}
          class="bg-carbon-900 border border-white/10 rounded px-2 py-1 text-[12px] text-slate-200 focus:border-radar/40 focus:outline-none">
          <option value="all">${t.region} · todas</option>
          ${REGIONS.map(r => html`<option key=${r} value=${r}>${r}</option>`)}
        </select>
        <label class="flex items-center gap-2 text-[11px] text-slate-400 font-mono uppercase tracking-wider">
          ${t.intensity} ≥ ${minInt}
          <input type="range" min="0" max="5" value=${minInt} onChange=${e=>setMinInt(Number(e.target.value))} class="accent-radar"/>
        </label>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      ${filtered.map(f => {
        const cat = CATEGORIES[f.category];
        const isSel = selectedId === f.id;
        return html`
        <button key=${f.id} onClick=${()=>onSelect(f.id)}
          class=${clsx(
            'group relative text-left rounded-md p-4 border transition',
            isSel ? 'border-radar/50 bg-radar/5' : 'border-white/8 bg-carbon-900/40 hover:border-radar/30 hover:bg-carbon-900/70'
          )}>
          <span class="corner-tl"></span><span class="corner-br"></span>
          <div class="flex items-start gap-2.5 mb-2">
            <span class="w-2 h-2 rounded-full mt-1.5 shrink-0" style=${{background:cat.color, boxShadow:`0 0 8px ${cat.color}`}}></span>
            <div class="flex-1">
              <div class="font-display font-semibold text-[14.5px] text-slate-100 leading-tight">${f.title}</div>
              <div class="text-[10px] font-mono uppercase tracking-wider text-slate-500 mt-1">${cat.label} · ${f.region}</div>
            </div>
            <div class="font-mono text-[10px] text-slate-400 shrink-0">
              ${[...Array(5)].map((_,i) => html`<span key=${i} class=${i<f.intensity?'text-alert':'text-slate-700'}>■</span>`)}
            </div>
          </div>
          <p class="text-[12.5px] text-slate-400 leading-relaxed line-clamp-3">${f.summary}</p>
          <div class="mt-3 flex items-center gap-1.5 flex-wrap">
            <span class="chip">FODA</span><span class="chip">PESTEL</span><span class="chip">Riesgo</span><span class="chip">Escenarios</span>
          </div>
        </button>`;
      })}
    </div>
  </section>`;
}

/* ========================================================================
   Análisis Estratégico (FODA, PESTEL, Actores, Riesgo)
   ======================================================================== */
function Analysis({ t, foco }) {
  const [tab, setTab] = useState('foda');
  if (!foco) return html`<${Empty} msg=${t.selectFoco}/>`;

  const tabs = [
    { id:'foda', label:t.foda },
    { id:'pestel', label:t.pestel },
    { id:'actors', label:t.actors },
    { id:'risk', label:t.risk },
  ];

  return html`
  <section class="panel rounded-md p-4">
    <div class="flex items-center justify-between flex-wrap gap-2 mb-4">
      <div>
        <div class="heading-mono">${t.nav.analysis}</div>
        <div class="font-display font-semibold text-[15px] text-slate-100 mt-0.5">${foco.title}</div>
      </div>
      <div class="flex items-center gap-1 rounded border border-white/10 p-0.5">
        ${tabs.map(x => html`
          <button key=${x.id} onClick=${()=>setTab(x.id)}
            class=${clsx(
              'px-2.5 py-1 rounded text-[11.5px] font-medium tracking-wide transition',
              tab===x.id ? 'bg-radar text-carbon-950' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
            )}>${x.label}</button>
        `)}
      </div>
    </div>

    ${tab==='foda' && html`<${Foda} foda=${foco.foda}/>`}
    ${tab==='pestel' && html`<${Pestel} pestel=${foco.pestel}/>`}
    ${tab==='actors' && html`<${Actors} actores=${foco.actores}/>`}
    ${tab==='risk' && html`<${RiskMatrix} risks=${foco.risks}/>`}
  </section>`;
}

function Foda({ foda }) {
  const items = [
    { key:'F', label:'Fortalezas', color:'#10b981', list:foda.F },
    { key:'O', label:'Oportunidades', color:'#22d3ee', list:foda.O },
    { key:'D', label:'Debilidades', color:'#f59e0b', list:foda.D },
    { key:'A', label:'Amenazas',   color:'#ef4444', list:foda.A },
  ];
  return html`
  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
    ${items.map(it => html`
      <div key=${it.key} class="relative panel-soft rounded p-3.5">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-6 h-6 rounded flex items-center justify-center font-mono text-[12px] font-bold" style=${{background:`${it.color}22`,color:it.color}}>${it.key}</div>
          <div class="font-display font-semibold text-slate-200 text-[13px] tracking-wide uppercase">${it.label}</div>
        </div>
        <ul class="space-y-1">
          ${it.list.map((x,i) => html`<li key=${i} class="text-[12.5px] text-slate-300 leading-snug flex gap-2"><span class="text-slate-600 font-mono text-[10px] mt-1">▸</span>${x}</li>`)}
        </ul>
      </div>
    `)}
  </div>`;
}

function Pestel({ pestel }) {
  const items = [
    { k:'P', label:'Político',     color:'#ef4444', text:pestel.P },
    { k:'E', label:'Económico',    color:'#f59e0b', text:pestel.E },
    { k:'S', label:'Social',       color:'#a78bfa', text:pestel.S },
    { k:'T', label:'Tecnológico',  color:'#22d3ee', text:pestel.T },
    { k:'A', label:'Ambiental',    color:'#10b981', text:pestel.A },
    { k:'L', label:'Legal',        color:'#fb923c', text:pestel.L },
  ];
  return html`
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
    ${items.map(it => html`
      <div key=${it.k} class="panel-soft rounded p-3">
        <div class="flex items-center gap-2 mb-1.5">
          <div class="w-5 h-5 rounded flex items-center justify-center font-mono text-[11px] font-bold" style=${{background:`${it.color}22`,color:it.color}}>${it.k}</div>
          <div class="heading-mono">${it.label}</div>
        </div>
        <div class="text-[12.5px] text-slate-300 leading-snug">${it.text}</div>
      </div>
    `)}
  </div>`;
}

function Actors({ actores }) {
  const groups = [
    { k:'gobiernos',  label:'Gobiernos' },
    { k:'empresas',   label:'Empresas / Mercado' },
    { k:'organismos', label:'Organismos / Multilaterales' },
    { k:'armados',    label:'Grupos armados' },
    { k:'sociedad',   label:'Sociedad civil / Medios' },
  ];
  return html`
  <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2.5">
    ${groups.map(g => html`
      <div key=${g.k} class="panel-soft rounded p-3">
        <div class="heading-mono mb-2">${g.label}</div>
        <div class="flex flex-wrap gap-1">
          ${(actores[g.k]||[]).map((a,i) => html`<span key=${i} class="chip">${a}</span>`)}
        </div>
      </div>
    `)}
  </div>`;
}

function RiskMatrix({ risks }) {
  // Plot risks: x=probabilidad, y=impacto (invertido), size=speed, color=contain
  const w=560, h=300, pad=40;
  return html`
  <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
    <div class="lg:col-span-3">
      <div class="panel-soft rounded p-3">
        <div class="heading-mono mb-2">Probabilidad × Impacto · velocidad (tamaño) · contención (color)</div>
        <svg viewBox=${`0 0 ${w} ${h}`} class="w-full h-auto">
          <!-- grid -->
          <rect x=${pad} y="10" width=${w-pad-20} height=${h-pad-10} fill="rgba(34,211,238,0.02)" stroke="rgba(34,211,238,0.15)" stroke-width="0.6"/>
          ${[1,2,3,4].map(i => html`
            <line key=${'gx'+i} x1=${pad+((w-pad-20)/5)*i} y1="10" x2=${pad+((w-pad-20)/5)*i} y2=${h-pad} stroke="rgba(148,163,184,0.06)" stroke-width="0.4"/>
            <line key=${'gy'+i} x1=${pad} y1=${10+((h-pad-10)/5)*i} x2=${w-20} y2=${10+((h-pad-10)/5)*i} stroke="rgba(148,163,184,0.06)" stroke-width="0.4"/>
          `)}
          <!-- axes -->
          <line x1=${pad} y1=${h-pad} x2=${w-20} y2=${h-pad} stroke="#22d3ee" stroke-width="0.7"/>
          <line x1=${pad} y1="10" x2=${pad} y2=${h-pad} stroke="#22d3ee" stroke-width="0.7"/>
          <text x=${(w+pad)/2} y=${h-10} text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#94a3b8">PROBABILIDAD →</text>
          <text transform=${`translate(14 ${(h-pad)/2}) rotate(-90)`} text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#94a3b8">IMPACTO →</text>

          <!-- quadrant labels -->
          <text x=${w-30} y="22" text-anchor="end" font-family="JetBrains Mono" font-size="8" fill="#ef4444" opacity=".8">CRÍTICO</text>
          <text x=${pad+6} y=${h-pad-8} font-family="JetBrains Mono" font-size="8" fill="#10b981" opacity=".7">MONITOR</text>

          ${risks.map((r,i) => {
            const cx = pad + r.prob * (w-pad-20);
            const cy = 10 + (1-r.impact) * (h-pad-10);
            const radius = 6 + r.speed*10;
            const containColor = r.contain<0.4 ? '#ef4444' : r.contain<0.6 ? '#f59e0b' : '#10b981';
            return html`
            <g key=${i}>
              <circle cx=${cx} cy=${cy} r=${radius} fill=${containColor} fill-opacity="0.18" stroke=${containColor} stroke-width="1"/>
              <circle cx=${cx} cy=${cy} r="2.5" fill=${containColor}/>
              <text x=${cx+radius+4} y=${cy+3} font-family="Inter" font-size="9.5" fill="#cbd5e1">${r.name}</text>
            </g>`;
          })}
        </svg>
      </div>
    </div>
    <div class="lg:col-span-2 flex flex-col gap-2">
      ${risks.map((r,i) => html`
        <div key=${i} class="panel-soft rounded p-3">
          <div class="font-display font-semibold text-[13px] text-slate-100">${r.name}</div>
          <div class="mt-2 grid grid-cols-4 gap-2">
            ${[['Prob',r.prob,'#22d3ee'],['Impacto',r.impact,'#ef4444'],['Velocidad',r.speed,'#f59e0b'],['Contención',r.contain,'#10b981']].map(([lbl,v,c]) => html`
              <div key=${lbl}>
                <div class="text-[9.5px] uppercase tracking-widest text-slate-500 font-mono">${lbl}</div>
                <div class="h-1.5 rounded-full bg-white/5 mt-1 overflow-hidden">
                  <div class="h-full rounded-full" style=${{width:`${v*100}%`, background:c}}></div>
                </div>
                <div class="text-[10.5px] font-mono mt-0.5 text-slate-300">${Math.round(v*100)}%</div>
              </div>
            `)}
          </div>
        </div>
      `)}
    </div>
  </div>`;
}

/* ========================================================================
   Scenario Lab
   ======================================================================== */
function Scenarios({ t, foco }) {
  const [active, setActive] = useState('base');
  if (!foco) return html`<${Empty} msg=${t.selectFoco}/>`;

  const order = [
    { k:'base',        color:'#22d3ee', label:t.scenarios.base },
    { k:'escalada',    color:'#f59e0b', label:t.scenarios.escalada },
    { k:'ruptura',     color:'#ef4444', label:t.scenarios.ruptura },
    { k:'desescalada', color:'#10b981', label:t.scenarios.desescalada },
  ];
  const sc = foco.scenarios[active];
  const sectores = ['agua','energia','alimentos','migracion','seguridad'];

  return html`
  <section class="panel rounded-md p-4">
    <div class="flex items-center justify-between flex-wrap gap-2 mb-4">
      <div>
        <div class="heading-mono">Scenario Lab</div>
        <div class="font-display font-semibold text-[15px] text-slate-100 mt-0.5">${foco.title}</div>
      </div>
      <div class="flex flex-wrap gap-1 rounded border border-white/10 p-0.5">
        ${order.map(o => html`
          <button key=${o.k} onClick=${()=>setActive(o.k)}
            class=${clsx(
              'px-2.5 py-1 rounded text-[11.5px] font-medium tracking-wide transition flex items-center gap-1.5',
              active===o.k ? 'text-carbon-950' : 'text-slate-300 hover:bg-white/5'
            )}
            style=${active===o.k ? {background:o.color} : {}}>
            <span class="w-1.5 h-1.5 rounded-full" style=${{background:active===o.k?'#05080c':o.color}}></span>
            ${o.label}
          </button>
        `)}
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div class="panel-soft rounded p-4 relative">
        <span class="corner-tl"></span>
        <div class="heading-mono mb-2">${t.scenarios[active]} · ${sc.title}</div>
        <div class="text-[10px] uppercase tracking-widest text-slate-500 font-mono mb-1.5">${t.signals}</div>
        <ul class="space-y-1 mb-3">
          ${sc.señales.map((s,i) => html`<li key=${i} class="text-[12.5px] text-slate-300 leading-snug flex gap-2"><span class="text-radar font-mono text-[10px] mt-1">●</span>${s}</li>`)}
        </ul>
        <div class="text-[10px] uppercase tracking-widest text-slate-500 font-mono mb-1.5">${t.indicators}</div>
        <ul class="space-y-1">
          ${sc.indicadores.map((s,i) => html`<li key=${i} class="text-[12.5px] text-slate-300 leading-snug flex gap-2"><span class="text-risk font-mono text-[10px] mt-1">◆</span>${s}</li>`)}
        </ul>
      </div>

      <div class="lg:col-span-2 panel-soft rounded p-4">
        <div class="heading-mono mb-3">${t.impact}</div>
        <div class="space-y-2.5">
          ${sectores.map(s => {
            const v = sc.impacto[s] || 0;
            return html`
            <div key=${s}>
              <div class="flex justify-between items-center mb-1">
                <div class="text-[12px] font-medium text-slate-200 capitalize tracking-wide">${s}</div>
                <div class="font-mono text-[10px] text-slate-400">${v}/5</div>
              </div>
              <div class="h-2 rounded-full bg-white/5 overflow-hidden">
                <div class="h-full rounded-full" style=${{
                  width:`${(v/5)*100}%`,
                  background: v>=4?'linear-gradient(90deg,#ef4444,#f59e0b)':v>=3?'#f59e0b':v>=2?'#22d3ee':'#10b981'
                }}></div>
              </div>
            </div>`;
          })}
        </div>

        <div class="mt-5 pt-4 border-t border-white/5">
          <div class="heading-mono mb-2">Resumen táctico</div>
          <p class="text-[12.5px] text-slate-400 leading-relaxed">
            Bajo el escenario <span style=${{color: order.find(o=>o.k===active).color}} class="font-semibold">${t.scenarios[active]}</span>,
            las señales tempranas y los indicadores anteriores marcan el umbral entre contención y desbordamiento.
            El impacto sectorial se proyecta sobre cinco vectores clave: agua, energía, alimentos, migración y seguridad.
          </p>
        </div>
      </div>
    </div>
  </section>`;
}

/* ========================================================================
   Sistema-Mundo
   ======================================================================== */
function SystemaMundo({ t }) {
  const [hover, setHover] = useState(null);
  const w = 900, h = 460;

  return html`
  <section class="panel rounded-md p-4">
    <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
      <div>
        <div class="heading-mono">${t.nav.system}</div>
        <div class="font-display font-semibold text-[15px] text-slate-100 mt-0.5">${t.nodes}</div>
      </div>
      <div class="text-[11px] text-slate-500 font-mono uppercase tracking-wider">FLOW MAP · v0.9</div>
    </div>

    <p class="text-[13px] text-slate-400 leading-relaxed mb-3 max-w-3xl">${t.systemIntro}</p>

    <div class="relative rounded panel-soft p-2">
      <svg viewBox=${`0 0 ${w} ${h}`} class="w-full h-auto">
        <defs>
          <filter id="nGlow">
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        <!-- links -->
        ${SYSTEMA_LINKS.map(([a,b],i) => {
          const A = SYSTEMA_NODES.find(n=>n.id===a);
          const B = SYSTEMA_NODES.find(n=>n.id===b);
          if (!A||!B) return null;
          const ax = A.x*w, ay = A.y*h, bx = B.x*w, by = B.y*h;
          const cx = (ax+bx)/2, cy = (ay+by)/2 - 30;
          const active = hover && (hover===a || hover===b);
          return html`
          <path key=${i} d=${`M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`}
                fill="none"
                stroke=${active?'#22d3ee':'rgba(148,163,184,0.18)'}
                stroke-width=${active?1.3:0.6}/>
          `;
        })}

        <!-- nodes -->
        ${SYSTEMA_NODES.map(n => {
          const x = n.x*w, y = n.y*h;
          const active = hover===n.id;
          return html`
          <g key=${n.id} class="cursor-pointer" onMouseEnter=${()=>setHover(n.id)} onMouseLeave=${()=>setHover(null)}>
            <circle cx=${x} cy=${y} r=${active?34:28} fill=${`${n.color}22`} stroke=${n.color} stroke-width=${active?1.4:0.8} filter=${active?'url(#nGlow)':'none'}/>
            <circle cx=${x} cy=${y} r="5" fill=${n.color}/>
            <text x=${x} y=${y+50} text-anchor="middle" font-family="Space Grotesk" font-weight="600" font-size="13" fill="#e2e8f0">${n.label}</text>
          </g>`;
        })}
      </svg>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
      ${[
        { n:'Energía', t:'Gas y crudo bajo presión geopolítica. Almacenamiento UE alto, pero LNG marginal vulnerable.'},
        { n:'Agua', t:'Estrés hídrico estructural en MENA y Asia del Sur. Glaciares HKH en retroceso.'},
        { n:'Alimentos', t:'Grano Mar Negro, fertilizantes, fosfatos. Sahel en IPC 4.'},
        { n:'Migración', t:'120M desplazados (ACNUR). Mediterráneo, Sahel, Darién, frontera UA.'},
        { n:'Datos', t:'Cables submarinos: vulnerabilidad estratégica. Sabotaje Báltico ejemplifica.'},
        { n:'Finanzas', t:'Stablecoins crecen. Política tipos EE.UU. dirige flujos globales.'},
        { n:'Clima', t:'Eventos extremos multiplican crisis hídricas, alimentarias, migratorias.'},
        { n:'Comercio', t:'Chokepoints (Suez, Ormuz, Malaca, Bósforo, Panamá) bajo presión.'},
      ].map((c,i) => html`
        <div key=${i} class="panel-soft rounded p-2.5">
          <div class="heading-mono mb-1">${c.n}</div>
          <div class="text-[11.5px] text-slate-400 leading-snug">${c.t}</div>
        </div>
      `)}
    </div>
  </section>`;
}

/* ========================================================================
   Brief Diario
   ======================================================================== */
function BriefDiario({ t }) {
  const [topic, setTopic] = useState('all');
  const filtered = BRIEF_DIARIO.filter(b => topic==='all' || b.tema===topic);
  const date = new Date().toLocaleDateString('es-ES', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });

  return html`
  <section class="panel rounded-md p-4">
    <div class="flex items-center justify-between flex-wrap gap-2 mb-4">
      <div>
        <div class="heading-mono">${t.todayBrief}</div>
        <div class="font-display font-semibold text-[15px] text-slate-100 mt-0.5 capitalize">${date}</div>
      </div>
      <div class="flex flex-wrap gap-1">
        <button onClick=${()=>setTopic('all')} class=${clsx('px-2.5 py-1 rounded text-[11px] font-medium tracking-wide transition',
          topic==='all' ? 'bg-radar text-carbon-950':'border border-white/10 text-slate-300 hover:bg-white/5')}>${t.allTopics}</button>
        ${Object.values(CATEGORIES).slice(0,7).map(c => html`
          <button key=${c.id} onClick=${()=>setTopic(c.id)}
            class=${clsx('px-2.5 py-1 rounded text-[11px] font-medium tracking-wide transition border',
              topic===c.id ? 'border-transparent text-carbon-950' : 'border-white/10 text-slate-300 hover:bg-white/5')}
            style=${topic===c.id?{background:c.color}:{}}>
            ${c.label}
          </button>
        `)}
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      ${filtered.map((b,i) => {
        const cat = CATEGORIES[b.tema] || CATEGORIES.sistema;
        return html`
        <article key=${i} class="relative panel-soft rounded p-4">
          <span class="corner-tl"></span>
          <div class="flex items-center gap-2 mb-2">
            <span class="w-1.5 h-1.5 rounded-full" style=${{background:cat.color, boxShadow:`0 0 6px ${cat.color}`}}></span>
            <span class="font-mono text-[10px] uppercase tracking-widest text-slate-500">${cat.label} · ${String(i+1).padStart(2,'0')}/${String(filtered.length).padStart(2,'0')}</span>
          </div>
          <h3 class="font-display font-semibold text-[14.5px] text-slate-100 leading-snug mb-1.5">${b.headline}</h3>
          <p class="text-[12.5px] text-slate-400 leading-relaxed">${b.cuerpo}</p>
        </article>`;
      })}
    </div>
    ${filtered.length===0 && html`<${Empty} msg="Sin entradas para este tema."/>`}
  </section>`;
}

/* ========================================================================
   Content Studio
   ======================================================================== */
function ContentStudio({ t, foco }) {
  if (!foco) return html`<${Empty} msg=${t.selectFoco}/>`;
  const formats = [
    { type:'Reel · 30s', icon:'▶', items:[
      `Hook: \"${foco.title}\" — 3 frases tácticas`,
      `Mapa animado con hotspot pulsando sobre ${foco.region}`,
      `B-roll OSINT + lower thirds GEOPÓLEM`,
      `CTA: \"Sigue el tablero\"`,
    ]},
    { type:'Carrusel · 7 slides', icon:'▦', items:[
      `Slide 1: Titular editorial + dato choque`,
      `Slide 2-3: Contexto histórico breve`,
      `Slide 4-5: FODA destilado en 4 cuadrantes`,
      `Slide 6: Escenarios base/escalada/ruptura`,
      `Slide 7: Cierre + watermark GEOPÓLEM`,
    ]},
    { type:'Dossier · PDF 4pp', icon:'▤', items:[
      `Pág 1: Resumen ejecutivo + mapa`,
      `Pág 2: PESTEL completo`,
      `Pág 3: Matriz de riesgo + actores`,
      `Pág 4: Escenarios + señales tempranas`,
    ]},
    { type:'Ficha web · long-form', icon:'▣', items:[
      `Hero: titular + KPIs del foco`,
      `Cuerpo: análisis sistema-mundo`,
      `Embed: mapa interactivo del hotspot`,
      `Cierre: bibliografía OSINT + advertencia editorial`,
    ]},
  ];

  return html`
  <section class="panel rounded-md p-4">
    <div class="flex items-center justify-between flex-wrap gap-2 mb-4">
      <div>
        <div class="heading-mono">${t.studio}</div>
        <div class="font-display font-semibold text-[15px] text-slate-100 mt-0.5">${foco.title}</div>
      </div>
      <div class="text-[11px] font-mono uppercase tracking-widest text-slate-500">SIMULACIÓN · NO EXPORT</div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      ${formats.map((f,i) => html`
        <div key=${i} class="relative panel-soft rounded p-4">
          <span class="corner-tl"></span><span class="corner-br"></span>
          <div class="flex items-center gap-2 mb-2.5">
            <div class="w-7 h-7 rounded bg-radar/15 text-radar flex items-center justify-center font-mono font-bold">${f.icon}</div>
            <div class="font-display font-semibold text-[13.5px] text-slate-100">${f.type}</div>
          </div>
          <ol class="space-y-1.5">
            ${f.items.map((x,j) => html`<li key=${j} class="text-[12.5px] text-slate-300 leading-snug flex gap-2">
              <span class="font-mono text-[10px] text-slate-500 shrink-0">${String(j+1).padStart(2,'0')}</span>
              <span>${x}</span>
            </li>`)}
          </ol>
          <button class="mt-3 w-full px-3 py-1.5 rounded border border-radar/30 text-radar text-[11.5px] font-medium tracking-wide hover:bg-radar/10 transition">
            Generar borrador (simulado)
          </button>
        </div>
      `)}
    </div>
  </section>`;
}

/* ========================================================================
   Empty state
   ======================================================================== */
function Empty({ msg }) {
  return html`
  <div class="panel rounded-md p-10 text-center">
    <div class="font-mono text-[10.5px] uppercase tracking-widest text-slate-500 mb-2">— sin selección —</div>
    <div class="font-display text-slate-300 text-[15px]">${msg}</div>
    <div class="text-slate-500 text-[12.5px] mt-2">Selecciona un foco desde el mapa, watchlist o alertas.</div>
  </div>`;
}

/* ========================================================================
   Foco detail strip (selected)
   ======================================================================== */
function FocoDetail({ foco }) {
  if (!foco) return null;
  const cat = CATEGORIES[foco.category];
  return html`
  <div class="panel rounded-md p-4 lg:p-5">
    <div class="flex items-start gap-3 flex-wrap">
      <div class="w-9 h-9 rounded flex items-center justify-center text-[18px] font-bold" style=${{background:`${cat.color}22`,color:cat.color, boxShadow:`0 0 30px ${cat.color}33`}}>${cat.icon}</div>
      <div class="flex-1 min-w-0">
        <div class="font-mono text-[10px] uppercase tracking-widest text-slate-500">${cat.label} · ${foco.region}</div>
        <h2 class="font-display font-bold text-slate-100 text-[20px] leading-tight mt-0.5">${foco.title}</h2>
        <p class="text-[13px] text-slate-400 leading-relaxed mt-2 max-w-3xl">${foco.summary}</p>
      </div>
      <div class="flex flex-col items-end gap-1">
        <div class="font-mono text-[10px] uppercase tracking-widest text-slate-500">Intensidad</div>
        <div class="font-mono text-[14px]">${[...Array(5)].map((_,i)=>html`<span key=${i} class=${i<foco.intensity?'text-alert':'text-slate-700'}>■</span>`)}</div>
      </div>
    </div>
  </div>`;
}

/* ========================================================================
   Editorial warning banner
   ======================================================================== */
function EditorialWarning({ t }) {
  return html`
  <div class="border border-risk/25 bg-risk/5 rounded-md px-3 py-2 flex items-start gap-2.5">
    <div class="w-5 h-5 rounded-full border border-risk/40 text-risk flex items-center justify-center font-mono font-bold text-[11px] shrink-0 mt-0.5">!</div>
    <div class="text-[11.5px] text-risk-soft leading-snug font-medium">${t.editorialWarning}</div>
  </div>`;
}

/* ========================================================================
   Command Boot
   ======================================================================== */
function CommandBoot({ onEnter }) {
  useEffect(() => {
    document.body.classList.add('boot-screen');
    return () => document.body.classList.remove('boot-screen');
  }, []);
  const bootLines = [
    ['GEOPÓLEM CORE', 'GEO + PÓLEMOS kernel loaded'],
    ['OSINT LAYER', 'open-source watchlist synchronized'],
    ['RISK MATRIX', 'FODA · PESTEL · scenarios armed'],
    ['WORLD MAP', 'tactical projection online'],
    ['SITUATION ROOM', 'board ready']
  ];

  return html`
  <div class="min-h-screen relative overflow-x-hidden bg-carbon-950 boot-grid text-slate-100">
    <div class="absolute inset-0 boot-noise pointer-events-none opacity-70"></div>
    <div class="absolute inset-x-0 top-0 h-px bg-radar/50"></div>
    <div class="absolute inset-x-0 bottom-0 h-px bg-alert/40"></div>

    <main class="relative z-10 min-h-screen max-w-[1500px] mx-auto px-5 lg:px-8 pt-6 pb-24 lg:pb-8 flex flex-col">
      <header class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 text-radar">
          <${BrandMark} size=${34}/>
          <div>
            <div class="font-display font-bold tracking-[0.16em] text-[18px] text-slate-50">GEOPÓLEM</div>
            <div class="font-mono text-[10px] uppercase tracking-[0.28em] text-slate-500">Command Boot · Situation Room</div>
          </div>
        </div>
        <div class="hidden sm:flex items-center gap-2 border border-radar/20 rounded px-3 py-2 bg-carbon-900/60">
          <span class="w-2 h-2 rounded-full bg-intel animate-pulse-dot"></span>
          <span class="font-mono text-[10px] uppercase tracking-widest text-slate-400">Secure editorial prototype</span>
        </div>
      </header>

      <section class="flex-1 grid grid-cols-1 lg:grid-cols-[1.05fr_.95fr] gap-8 lg:gap-12 items-center py-10">
        <div class="space-y-7">
          <div>
            <div class="font-mono text-[11px] uppercase tracking-[0.34em] text-radar">Bienvenido al tablero</div>
            <h1 class="font-display font-bold text-[34px] sm:text-[46px] lg:text-[58px] leading-[0.95] mt-4 max-w-4xl glow-text">
              La sala situacional que convierte ruido global en lectura estratégica.
            </h1>
            <p class="text-[14px] sm:text-[15px] text-slate-400 leading-relaxed mt-5 max-w-2xl">
              Conflictos, energía, agua, rearme, IA, migración y sistema-mundo en una interfaz táctica. No persigue titulares: revela el movimiento de las piezas.
            </p>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-3xl">
            ${[
              ['10', 'focos tácticos'],
              ['5', 'idiomas UI'],
              ['4', 'escenarios'],
              ['PWA', 'instalable']
            ].map(([value,label]) => html`
              <div key=${label} class="panel rounded p-3">
                <div class="font-display font-bold text-[22px] text-radar">${value}</div>
                <div class="font-mono text-[10px] uppercase tracking-widest text-slate-500">${label}</div>
              </div>
            `)}
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button onClick=${onEnter}
              class="group px-5 py-3 rounded border border-radar/50 bg-radar/10 text-radar hover:bg-radar hover:text-carbon-950 hover:shadow-glow font-mono text-[11px] uppercase tracking-[0.22em] font-bold">
              Entrar al tablero
            </button>
            <div class="text-[11px] font-mono uppercase tracking-widest text-slate-500">
              Cartografía táctica · Guerra híbrida · OSINT editorial
            </div>
          </div>
        </div>

        <div class="relative">
          <div class="boot-radar aspect-square rounded-full max-w-[560px] mx-auto">
            <div class="boot-sweep"></div>
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="w-24 h-24 rounded-full border border-radar/40 bg-carbon-950/80 flex items-center justify-center text-radar shadow-glow">
                <${BrandMark} size=${56}/>
              </div>
            </div>
            ${[
              ['UCR', '32%', '28%', '#ef4444'],
              ['MENA', '58%', '43%', '#ef4444'],
              ['H2O', '65%', '58%', '#22d3ee'],
              ['MILEX', '43%', '22%', '#f97316'],
              ['AI', '27%', '55%', '#a78bfa'],
              ['CHOKE', '72%', '38%', '#fbbf24']
            ].map(([label,left,top,color]) => html`
              <div key=${label} class="absolute -translate-x-1/2 -translate-y-1/2" style=${{left, top}}>
                <span class="block w-2.5 h-2.5 rounded-full" style=${{background:color, boxShadow:`0 0 18px ${color}`}}></span>
                <span class="absolute left-4 -top-1 font-mono text-[9px] uppercase tracking-widest text-slate-300">${label}</span>
              </div>
            `)}
          </div>

          <div class="mt-5 panel rounded-md p-4 max-w-[560px] mx-auto">
            <div class="heading-mono mb-3">Inicialización del sistema</div>
            <div class="space-y-3">
              ${bootLines.map((line, index) => html`
                <div key=${line[0]} class="boot-line flex items-center justify-between gap-3 border-b border-white/5 pb-3 last:border-b-0 last:pb-0" style=${{animationDelay:`${index * 120}ms`}}>
                  <div>
                    <div class="font-mono text-[10px] uppercase tracking-widest text-radar">${line[0]}</div>
                    <div class="text-[11.5px] text-slate-500 mt-0.5">${line[1]}</div>
                  </div>
                  <div class="font-mono text-[10px] text-intel shrink-0">ONLINE</div>
                </div>
              `)}
            </div>
            <a href="./dossiers/index.html"
              class="mt-4 flex items-center justify-center gap-2 px-3 py-2.5 rounded border border-radar/40 text-radar text-[11px] font-mono uppercase tracking-[0.22em] hover:bg-radar/10 hover:shadow-glow transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Dossiers técnicos
            </a>
            <a href="./conflictos-activos/index.html"
              class="mt-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded border border-risk/40 text-risk text-[11px] font-mono uppercase tracking-[0.22em] hover:bg-risk/10 transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z"/></svg>
              Conflictos activos
              <span class="px-1 rounded bg-risk/20 text-[9px] tracking-[0.18em]">SIM</span>
            </a>
          </div>
        </div>
      </section>

      <footer class="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
        <div class="font-mono text-[10px] uppercase tracking-widest text-slate-500">Prototipo editorial basado en fuentes abiertas · No uso operativo</div>
        <div class="font-mono text-[10px] uppercase tracking-widest text-radar">GEOPÓLEM v1.6 PWA</div>
      </footer>
    </main>
  </div>`;
}

/* ========================================================================
   Rearme global / SIPRI module
   ======================================================================== */
function RearmamentModule({ t, onOpenFoco }) {
  const maxRegional = Math.max(...MILEX.regions.map(r => r.spending));
  const maxTop = Math.max(...MILEX.topThree.map(r => r.spending));
  return html`
  <section class="space-y-4">
    <div class="panel rounded-md p-4 lg:p-5">
      <div class="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div class="heading-mono">Defensa / Rearme · SIPRI ${MILEX.year}</div>
          <h2 class="font-display font-bold text-slate-50 text-[22px] mt-1 glow-text">La economía mundial entra en modo rearme.</h2>
          <p class="text-[13px] text-slate-400 leading-relaxed mt-2 max-w-4xl">
            El gasto militar ya no es sólo una partida presupuestaria: es una señal de estructura. GEOPÓLEM lo lee como una capa del sistema-mundo que conecta industria, energía, tecnología, deuda, alianzas y riesgo de escalada.
          </p>
        </div>
        <button onClick=${() => onOpenFoco('rearme-global')}
          class="px-3 py-2 rounded border border-orange-400/40 text-orange-300 hover:bg-orange-400/10 font-mono text-[10.5px] uppercase tracking-widest">
          Abrir foco en mapa
        </button>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
        ${MILEX.global.map(k => html`
          <div key=${k.label} class="panel-soft rounded p-3 border border-white/5">
            <div class="heading-mono">${k.label}</div>
            <div class="font-display font-bold text-[22px] text-orange-300 mt-1">${k.value}</div>
            <div class="text-[11px] text-slate-500 mt-1">${k.note}</div>
          </div>
        `)}
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div class="panel rounded-md p-4 xl:col-span-2">
        <div class="flex items-center justify-between gap-3 mb-4">
          <div>
            <div class="heading-mono">Regiones en aceleración</div>
            <h3 class="font-display font-semibold text-slate-100 text-[16px] mt-1">Rearme global — gasto militar récord</h3>
            <p class="text-[12px] text-slate-500 mt-1">Dónde se está moviendo el tablero presupuestario.</p>
          </div>
          <div class="text-[10px] font-mono uppercase tracking-widest text-slate-500">USD corrientes · SIPRI</div>
        </div>
        <div class="space-y-3">
          ${MILEX.regions.map(r => {
            const tone = TONE_TO_COLOR[r.tone] || TONE_TO_COLOR.amber;
            const pct = Math.max(5, (r.spending / maxRegional) * 100);
            return html`
            <div key=${r.region} class="space-y-1.5">
              <div class="flex items-center justify-between gap-3">
                <div class="text-[13px] font-medium text-slate-200">${r.region}</div>
                <div class="font-mono text-[11px] text-slate-400">${r.label} · <span class=${tone.txt}>${r.growth}</span></div>
              </div>
              <div class="h-2 rounded bg-white/5 overflow-hidden">
                <div class=${clsx('h-full rounded', tone.bg)} style=${{ width:`${pct}%`, background:`linear-gradient(90deg, rgba(249,115,22,.95), rgba(34,211,238,.65))` }}></div>
              </div>
            </div>`;
          })}
        </div>
      </div>

      <div class="panel rounded-md p-4">
        <div class="heading-mono">Concentración estratégica</div>
        <h3 class="font-display font-semibold text-slate-100 text-[16px] mt-1">Top 3: EE.UU. + China + Rusia</h3>
        <div class="mt-4 rounded border border-orange-400/20 bg-orange-400/5 p-3">
          <div class="font-display font-bold text-[28px] text-orange-300">${MILEX.concentration.share}</div>
          <div class="text-[12px] text-slate-400">${MILEX.concentration.value} del gasto militar mundial</div>
        </div>
        <div class="mt-4 space-y-3">
          ${MILEX.topThree.map(c => {
            const pct = Math.max(8, (c.spending / maxTop) * 100);
            return html`
            <div key=${c.country}>
              <div class="flex justify-between text-[12px] mb-1">
                <span class="text-slate-200">${c.country}</span>
                <span class="font-mono text-slate-400">${c.label}</span>
              </div>
              <div class="h-1.5 bg-white/5 rounded overflow-hidden">
                <div class="h-full bg-orange-400" style=${{width:`${pct}%`}}></div>
              </div>
              <div class="text-[10.5px] text-slate-500 mt-1">${c.note}</div>
            </div>`;
          })}
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="panel rounded-md p-4 lg:col-span-2">
        <div class="heading-mono">Lectura GEOPÓLEM</div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          ${MILEX.analysis.map((item, idx) => html`
            <div key=${idx} class="panel-soft rounded p-3">
              <div class="font-mono text-[10px] text-orange-300 uppercase tracking-widest">Vector ${idx+1}</div>
              <p class="text-[12.5px] text-slate-400 leading-relaxed mt-2">${item}</p>
            </div>
          `)}
        </div>
      </div>
      <div class="panel rounded-md p-4">
        <div class="heading-mono">Indicadores a vigilar 2026–2027</div>
        <div class="mt-3 flex flex-wrap gap-1.5">
          ${MILEX.watch.map(w => html`<span key=${w} class="chip">${w}</span>`)}
        </div>
        <div class="mt-4 text-[11px] text-slate-500 leading-relaxed">
          Fuente abierta: <a class="text-radar hover:underline" href=${MILEX.sourceUrl} target="_blank" rel="noreferrer">${MILEX.sourceName}</a>. Base de datos: <a class="text-radar hover:underline" href=${MILEX.databaseUrl} target="_blank" rel="noreferrer">SIPRI Milex</a>.
        </div>
      </div>
    </div>
  </section>`;
}

/* ========================================================================
   Monetización / Business intelligence layer
   ======================================================================== */
function MonetizationModule({ t }) {
  const revenueStreams = [
    { title: 'Briefing Premium', price: '7–10 €/mes', signal: 'Retención', description: 'Newsletter semanal con mapas, señales tempranas, indicadores y lectura del tablero. Entrada natural desde reels, carruseles y fichas públicas.', steps: ['Landing con promesa clara', 'Muestra gratuita semanal', 'Archivo premium de dossiers'], tone: 'text-radar border-radar/30 bg-radar/5' },
    { title: 'Dossiers tácticos', price: '29–99 €', signal: 'Ticket medio', description: 'Informes descargables sobre chokepoints, energía, agua, conflicto, rearme, minerales críticos y rutas logísticas.', steps: ['Plantilla GEOPÓLEM', 'Mapas propios', 'Versión ejecutiva y versión visual'], tone: 'text-risk border-risk/30 bg-risk/5' },
    { title: 'Patrocinios estratégicos', price: '300–2.500 €/campaña', signal: 'Marca', description: 'Sponsors compatibles: ciberseguridad, educación ejecutiva, data platforms, logística, defensa civil y formación OSINT.', steps: ['Media kit', 'Paquetes por serie', 'Integración sin romper tono editorial'], tone: 'text-intel border-intel/30 bg-intel/5' },
    { title: 'Consultoría de riesgo', price: '1.500 €+', signal: 'B2B', description: 'Briefs privados para empresas, equipos editoriales, logística, energía o inversión: riesgo país, escenarios y señales de alerta.', steps: ['Oferta cerrada', 'Sesión 60–90 min', 'Entrega ejecutiva en PDF'], tone: 'text-alert border-alert/30 bg-alert/5' },
  ];
  const funnel = [
    ['Alcance', 'Reels y carruseles demoledores con gancho táctico', 'seguidores, guardados, retención 3s'],
    ['Autoridad', 'Web, mapa, watchlist, dossiers y sala situacional', 'tiempo en página, clicks en fichas'],
    ['Captura', 'Briefing gratuito con promesa semanal', 'emails, tasa de conversión'],
    ['Pago', 'Premium, dossiers, patrocinio y consultoría', 'MRR, ventas, leads B2B'],
  ];
  const productRoadmap = [
    ['Semana 1', 'Activar newsletter gratuita y botón “Recibir briefing” en la web.'],
    ['Semana 2', 'Lanzar Dossier 1: Chokepoints navales con versión teaser pública.'],
    ['Semana 3', 'Publicar media kit: audiencia, tono, formatos y paquetes sponsor.'],
    ['Mes 2', 'Abrir consultoría limitada: 5 briefs privados fundacionales.'],
  ];
  return html`
  <section class="space-y-4">
    <div class="panel rounded-md p-4 lg:p-5 overflow-hidden relative">
      <div class="absolute inset-0 pointer-events-none opacity-30" style=${{background:'radial-gradient(circle at 82% 18%, rgba(34,211,238,.22), transparent 34%), radial-gradient(circle at 15% 75%, rgba(239,68,68,.16), transparent 28%)'}}></div>
      <div class="relative flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div class="heading-mono">Monetización · Máquina de inteligencia</div>
          <h2 class="font-display font-bold text-slate-50 text-[22px] mt-1 glow-text">GEOPÓLEM no vende noticias. Vende claridad estratégica.</h2>
          <p class="text-[13px] text-slate-400 leading-relaxed mt-2 max-w-4xl">
            La monetización debe seguir el mismo ADN: menos ruido, más tablero. El producto gratuito atrae; el briefing retiene; los dossiers prueban autoridad; la consultoría convierte la sala situacional en negocio B2B.
          </p>
        </div>
        <div class="grid grid-cols-2 gap-2 min-w-[260px]">
          <div class="panel-soft rounded p-3 border border-radar/20">
            <div class="heading-mono">Modelo</div>
            <div class="font-display font-bold text-[20px] text-radar mt-1">Freemium</div>
          </div>
          <div class="panel-soft rounded p-3 border border-intel/20">
            <div class="heading-mono">Meta</div>
            <div class="font-display font-bold text-[20px] text-intel mt-1">MRR</div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-4 gap-4">
      ${revenueStreams.map(stream => html`
        <article key=${stream.title} class=${clsx('panel rounded-md p-4 border', stream.tone)}>
          <div class="flex items-center justify-between gap-2">
            <div class="heading-mono">${stream.signal}</div>
            <span class="chip">${stream.price}</span>
          </div>
          <h3 class="font-display font-bold text-slate-100 text-[17px] mt-3">${stream.title}</h3>
          <p class="text-[12.5px] text-slate-400 leading-relaxed mt-2">${stream.description}</p>
          <div class="mt-3 space-y-1.5">
            ${stream.steps.map(step => html`<div key=${step} class="flex items-center gap-2 text-[11.5px] text-slate-500"><span class="w-1.5 h-1.5 rounded-full bg-current"></span>${step}</div>`)}
          </div>
        </article>
      `)}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-[.9fr_1.1fr] gap-4">
      <div class="panel rounded-md p-4">
        <div class="heading-mono">Embudo GEOPÓLEM</div>
        <h3 class="font-display font-semibold text-slate-100 text-[16px] mt-1">De audiencia a ingresos recurrentes.</h3>
        <div class="mt-4 space-y-3">
          ${funnel.map(([stage, action, metric], idx) => html`
            <div key=${stage} class="rounded border border-white/8 bg-carbon-900/45 p-3">
              <div class="flex items-center justify-between gap-3">
                <div class="font-display font-bold text-slate-100">${stage}</div>
                <div class="font-mono text-[10px] text-radar uppercase tracking-widest">Fase ${idx + 1}</div>
              </div>
              <p class="text-[12px] text-slate-400 mt-1">${action}</p>
              <div class="mt-2 font-mono text-[9.5px] uppercase tracking-widest text-slate-600">KPI · ${metric}</div>
            </div>
          `)}
        </div>
      </div>

      <div class="panel rounded-md p-4">
        <div class="heading-mono">Plan de ejecución</div>
        <h3 class="font-display font-semibold text-slate-100 text-[16px] mt-1">Qué hacer primero para monetizar sin diluir la marca.</h3>
        <div class="mt-4 relative">
          <div class="absolute left-[10px] top-2 bottom-2 w-px bg-radar/20"></div>
          <div class="space-y-3">
            ${productRoadmap.map(([time, action]) => html`
              <div key=${time} class="relative pl-7">
                <div class="absolute left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-radar shadow-glow"></div>
                <div class="font-mono text-[10px] uppercase tracking-widest text-radar">${time}</div>
                <div class="text-[12.5px] text-slate-300 mt-1 leading-relaxed">${action}</div>
              </div>
            `)}
          </div>
        </div>
        <div class="mt-4 rounded border border-risk/20 bg-risk/5 p-3">
          <div class="heading-mono text-risk">Regla editorial</div>
          <p class="text-[12px] text-slate-400 leading-relaxed mt-1">
            La monetización nunca debe parecer clickbait. Cada producto debe responder a una pregunta táctica: qué está pasando, qué pieza se mueve, qué riesgo abre y qué indicador hay que vigilar.
          </p>
        </div>
      </div>
    </div>
  </section>`;
}

/* ========================================================================
   Editor interno de fichas GEOPÓLEM
   ======================================================================== */
function EditorLoginGate({ onLogin, authStatus }) {
  const [user, setUser] = useState('geopolem');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await onLogin({ user, password });
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión.');
    }
  };

  return html`
  <section class="grid grid-cols-1 lg:grid-cols-[.95fr_1.05fr] gap-4">
    <div class="panel rounded-md p-5 lg:p-6 relative overflow-hidden">
      <div class="absolute inset-0 opacity-30 pointer-events-none tactical-grid"></div>
      <div class="relative">
        <div class="heading-mono text-radar">Acceso privado · Command Editor</div>
        <h2 class="font-display font-bold text-slate-50 text-[26px] mt-2">Puerta de mando editorial.</h2>
        <p class="text-[13px] text-slate-400 leading-relaxed mt-3 max-w-2xl">
          El Panel Editor queda protegido por login y conectado a una base SQLite persistente.
          Desde aquí podrás cargar focos, convertirlos en fichas tácticas y conservarlos entre sesiones.
        </p>
        <div class="mt-5 grid grid-cols-2 gap-2">
          <div class="rounded border border-white/10 bg-carbon-900/70 p-3">
            <div class="heading-mono">Base</div>
            <div class="font-display font-bold text-radar text-[18px] mt-1">SQLite</div>
          </div>
          <div class="rounded border border-white/10 bg-carbon-900/70 p-3">
            <div class="heading-mono">Modo</div>
            <div class="font-display font-bold text-intel text-[18px] mt-1">Privado</div>
          </div>
        </div>
      </div>
    </div>

    <form onSubmit=${submit} class="panel rounded-md p-5 lg:p-6">
      <div class="heading-mono">Login editor</div>
      <h3 class="font-display font-semibold text-slate-100 text-[20px] mt-2">Entrar al panel.</h3>
      <p class="text-[12.5px] text-slate-500 mt-2 leading-relaxed">
        Prototipo privado. Usuario: <span class="text-slate-300 font-mono">geopolem</span>. Clave inicial:
        <span class="text-slate-300 font-mono">tablero-2026</span>. Después podemos cambiarla por una clave tuya.
      </p>
      <label class="block space-y-1 mt-4">
        <span class="heading-mono">Usuario</span>
        <input value=${user} onInput=${e=>setUser(e.target.value)}
          class="w-full bg-carbon-900 border border-white/10 rounded px-3 py-2 text-[13px] text-slate-100 focus:border-radar/40 focus:outline-none"/>
      </label>
      <label class="block space-y-1 mt-3">
        <span class="heading-mono">Clave</span>
        <input type="password" value=${password} onInput=${e=>setPassword(e.target.value)} placeholder="Clave del editor"
          class="w-full bg-carbon-900 border border-white/10 rounded px-3 py-2 text-[13px] text-slate-100 focus:border-radar/40 focus:outline-none"/>
      </label>
      ${error && html`<div class="mt-3 text-[12px] text-alert">${error}</div>`}
      ${authStatus && html`<div class="mt-3 text-[12px] text-slate-500 font-mono uppercase tracking-widest">${authStatus}</div>`}
      <button type="submit"
        class="mt-4 px-4 py-2 rounded border border-radar/50 text-radar hover:bg-radar hover:text-carbon-950 hover:shadow-glow font-mono text-[11px] uppercase tracking-widest transition">
        Desbloquear editor
      </button>
    </form>
  </section>`;
}

function EditorPanel({ t, focos, onCreate, onDelete, onPasswordChange, history, attachments, users, onCreateUser, onDeleteUser, onUploadAttachment, onDeleteAttachment, getAttachmentUrl, getDossierUrl, onRefreshHistory, onOpenFoco, auth, onLogin, authStatus, dbStatus }) {
  if (!auth) {
    return html`<${EditorLoginGate} onLogin=${onLogin} authStatus=${authStatus}/>`;
  }
  return html`<${EditorWorkspace} t=${t} focos=${focos} onCreate=${onCreate} onDelete=${onDelete} onPasswordChange=${onPasswordChange} history=${history} attachments=${attachments} users=${users} onCreateUser=${onCreateUser} onDeleteUser=${onDeleteUser} onUploadAttachment=${onUploadAttachment} onDeleteAttachment=${onDeleteAttachment} getAttachmentUrl=${getAttachmentUrl} getDossierUrl=${getDossierUrl} onRefreshHistory=${onRefreshHistory} onOpenFoco=${onOpenFoco} dbStatus=${dbStatus} auth=${auth}/>`;
}

function EditorWorkspace({ t, focos, onCreate, onDelete, onPasswordChange, history, attachments, users, onCreateUser, onDeleteUser, onUploadAttachment, onDeleteAttachment, getAttachmentUrl, getDossierUrl, onRefreshHistory, onOpenFoco, dbStatus, auth }) {
  const initial = {
    id: '',
    title: '',
    region: 'Global',
    category: 'conflicto',
    intensity: 3,
    lat: 20,
    lng: 10,
    summary: '',
    actors: '',
    sources: '',
    hook: '',
    status: 'draft',
    verifyGeo: false,
    verifySources: false,
    verifyDate: false,
    verifyRisk: false,
    verifyLegal: false,
    reviewer: '',
    reviewNotes: ''
  };
  const [form, setForm] = useState(initial);
  const [lastCreated, setLastCreated] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [passwordDraft, setPasswordDraft] = useState('');
  const [userDraft, setUserDraft] = useState({ username: '', password: '', role: 'analyst' });
  const [uploadingId, setUploadingId] = useState('');
  const [uploadMeta, setUploadMeta] = useState({});
  const customFocos = focos.filter(f => f.isCustom);
  const attachmentsByFoco = useMemo(() => {
    const grouped = new Map();
    (attachments || []).forEach(att => {
      const arr = grouped.get(att.foco_id) || [];
      arr.push(att);
      grouped.set(att.foco_id, arr);
    });
    return grouped;
  }, [attachments]);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const permissions = new Set(auth?.permissions || []);
  const can = (permission) => permissions.has(permission);
  const canSaveForm = can('edit_foco') && (form.status !== 'published' || can('publish_foco'));
  const updateUploadMeta = (focoId, key, value) => {
    setUploadMeta(prev => ({
      ...prev,
      [focoId]: {
        source_type: 'Fuente abierta',
        reliability: 'C',
        tags: '',
        note: 'Fuente documental cargada desde Panel Editor',
        ...(prev[focoId] || {}),
        [key]: value,
      }
    }));
  };
  const canCreate = canSaveForm && form.title.trim().length > 4 && form.summary.trim().length > 20;
  const isEditing = Boolean(form.id);

  const makeId = (title) => {
    const slug = title.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 42) || 'nuevo-foco';
    return `${slug}-${Date.now().toString(36).slice(-5)}`;
  };

  const focoToForm = (foco) => {
    const verification = foco.verification || {};
    return {
      id: foco.id || '',
      title: foco.title || '',
      region: foco.region || 'Global',
      category: foco.category || 'conflicto',
      intensity: foco.intensity || 3,
      lat: foco.coords?.lat ?? 20,
      lng: foco.coords?.lng ?? 10,
      summary: foco.summary || '',
      actors: foco.actores?.gobiernos?.join(', ') || '',
      sources: Array.isArray(foco.sources) ? foco.sources.join('\n') : '',
      hook: foco.editorialHook || '',
      status: foco.status || 'draft',
      verifyGeo: Boolean(verification.geo),
      verifySources: Boolean(verification.sources),
      verifyDate: Boolean(verification.date),
      verifyRisk: Boolean(verification.risk),
      verifyLegal: Boolean(verification.legal),
      reviewer: verification.reviewer || '',
      reviewNotes: verification.notes || '',
    };
  };

  const saveFoco = async () => {
    if (!canCreate) return;
    setSaveStatus('Guardando en base de datos...');
    const cat = CATEGORIES[form.category] || CATEGORIES.conflicto;
    const actors = form.actors.split(',').map(x => x.trim()).filter(Boolean);
    const sources = form.sources.split('\n').map(x => x.trim()).filter(Boolean);
    const newFoco = {
      id: form.id || makeId(form.title),
      title: form.title.trim(),
      region: form.region,
      category: form.category,
      intensity: Number(form.intensity),
      coords: { lat: Number(form.lat) || 0, lng: Number(form.lng) || 0 },
      summary: form.summary.trim(),
      editorialHook: form.hook.trim(),
      status: form.status,
      sources,
      verification: {
        geo: Boolean(form.verifyGeo),
        sources: Boolean(form.verifySources),
        date: Boolean(form.verifyDate),
        risk: Boolean(form.verifyRisk),
        legal: Boolean(form.verifyLegal),
        reviewer: form.reviewer.trim(),
        notes: form.reviewNotes.trim(),
      },
      foda: {
        F: ['Ventaja analítica por monitoreo temprano', 'Actores identificados para seguimiento'],
        O: ['Convertir señales débiles en briefing', 'Preparar pieza editorial y mapa táctico'],
        D: ['Información abierta incompleta', 'Necesita contraste de fuentes primarias'],
        A: ['Escalada rápida', 'Manipulación narrativa o falta de datos verificables'],
      },
      pestel: {
        P: 'Evaluar presión política, alianzas y legitimidad de actores.',
        E: 'Medir impacto sobre energía, comercio, deuda, precios o inversión.',
        S: 'Identificar efectos sobre población, migración, cohesión y opinión pública.',
        T: 'Vigilar drones, ciber, satélites, IA, sensores o infraestructura crítica.',
        A: 'Revisar agua, clima, contaminación, recursos y daños ambientales.',
        L: 'Contrastar sanciones, derecho internacional, tratados y marcos regulatorios.',
      },
      actores: {
        gobiernos: actors.length ? actors : ['Actor estatal principal', 'Aliados y mediadores'],
        empresas: ['Infraestructura crítica', 'Energía / logística / defensa según caso'],
        organismos: ['ONU', 'organismos regionales', 'fuentes OSINT verificables'],
        armados: ['Fuerzas regulares o no estatales según caso'],
        sociedad: ['Población afectada', 'ONGs', 'diásporas', 'medios y comunidad OSINT'],
      },
      risks: [
        { name:'Escalada operativa', prob:0.55, impact:0.75, speed:0.7, contain:0.45 },
        { name:'Crisis humanitaria o social', prob:0.5, impact:0.7, speed:0.45, contain:0.5 },
        { name:'Efecto energético/logístico', prob:0.45, impact:0.65, speed:0.55, contain:0.55 },
        { name:'Guerra narrativa / desinformación', prob:0.65, impact:0.55, speed:0.85, contain:0.35 },
      ],
      scenarios: {
        base:        { title:'Tensión contenida con seguimiento diario', señales:['Incidentes localizados','canales diplomáticos abiertos','narrativa controlada'], indicadores:['alertas OSINT','precios sectoriales','movimientos oficiales'], impacto:{ agua:1, energia:2, alimentos:1, migracion:2, seguridad:3 } },
        escalada:    { title:'Escalada regional o sectorial', señales:['movilización','ataques cruzados','cierre de rutas'], indicadores:['actividad militar','ciberataques','seguros/fletes'], impacto:{ agua:2, energia:4, alimentos:3, migracion:3, seguridad:4 } },
        ruptura:     { title:'Ruptura del equilibrio y crisis ampliada', señales:['colapso negociación','daño infraestructura crítica','intervención externa'], indicadores:['desplazados','precios energía','alertas diplomáticas'], impacto:{ agua:4, energia:5, alimentos:4, migracion:5, seguridad:5 } },
        desescalada: { title:'Desescalada negociada o congelamiento', señales:['mediación','alto el fuego técnico','reducción de operaciones'], indicadores:['retorno tráfico','ayuda humanitaria','comunicados conjuntos'], impacto:{ agua:1, energia:1, alimentos:1, migracion:1, seguridad:2 } },
      },
    };
    try {
      const saved = await onCreate(newFoco);
      setLastCreated(saved || newFoco);
      setForm(initial);
      setSaveStatus(isEditing ? 'Ficha actualizada en SQLite.' : 'Ficha guardada en SQLite.');
      onRefreshHistory?.();
    } catch (err) {
      setSaveStatus(err.message || 'No se pudo guardar la ficha.');
    }
  };

  const advanceStatus = async (foco) => {
    const currentIndex = WORKFLOW_INDEX[foco.status] ?? 0;
    const nextState = WORKFLOW_STATES[Math.min(currentIndex + 1, WORKFLOW_STATES.length - 1)];
    if (nextState.id === 'review' && !can('review_foco')) {
      setSaveStatus('Tu rol no puede enviar a revisión editorial.');
      return;
    }
    if (nextState.id === 'published' && !can('publish_foco')) {
      setSaveStatus('Tu rol no puede publicar fichas.');
      return;
    }
    const next = { ...foco, status: nextState.id };
    setSaveStatus('Avanzando workflow...');
    try {
      const saved = await onCreate(next);
      setLastCreated(saved);
      setSaveStatus(`Workflow: ${nextState.label}.`);
      onRefreshHistory?.();
    } catch (err) {
      setSaveStatus(err.message || 'No se pudo avanzar el workflow.');
    }
  };

  const resetStatus = async (foco) => {
    if (!can('edit_foco')) {
      setSaveStatus('Tu rol no puede reabrir fichas.');
      return;
    }
    const next = { ...foco, status: 'draft' };
    setSaveStatus('Reabriendo ficha...');
    try {
      const saved = await onCreate(next);
      setLastCreated(saved);
      setSaveStatus('Ficha reabierta como borrador.');
      onRefreshHistory?.();
    } catch (err) {
      setSaveStatus(err.message || 'No se pudo reabrir la ficha.');
    }
  };

  const deleteFoco = async (foco) => {
    if (!can('delete_foco')) {
      setSaveStatus('Tu rol no puede eliminar fichas.');
      return;
    }
    if (!window.confirm(`Eliminar "${foco.title}" del archivo editorial?`)) return;
    setSaveStatus('Eliminando ficha...');
    try {
      await onDelete(foco.id);
      setSaveStatus('Ficha eliminada.');
      setForm(initial);
      onRefreshHistory?.();
    } catch (err) {
      setSaveStatus(err.message || 'No se pudo eliminar la ficha.');
    }
  };

  const changePassword = async () => {
    if (!can('manage_security')) {
      setSaveStatus('Tu rol no puede cambiar la clave del editor.');
      return;
    }
    if (passwordDraft.trim().length < 8) {
      setSaveStatus('La nueva clave debe tener al menos 8 caracteres.');
      return;
    }
    try {
      await onPasswordChange(passwordDraft.trim());
      setPasswordDraft('');
      setSaveStatus('Clave del editor actualizada.');
    } catch (err) {
      setSaveStatus(err.message || 'No se pudo cambiar la clave.');
    }
  };

  const createEditorUser = async () => {
    if (!can('manage_security')) {
      setSaveStatus('Tu rol no puede crear usuarios editoriales.');
      return;
    }
    const payload = {
      username: userDraft.username.trim().toLowerCase(),
      password: userDraft.password.trim(),
      role: userDraft.role,
    };
    if (payload.username.length < 3) {
      setSaveStatus('El usuario debe tener al menos 3 caracteres.');
      return;
    }
    if (payload.password.length < 8) {
      setSaveStatus('La clave del usuario debe tener al menos 8 caracteres.');
      return;
    }
    try {
      await onCreateUser(payload);
      setUserDraft({ username: '', password: '', role: 'analyst' });
      setSaveStatus('Usuario editorial creado y listo para iniciar sesión.');
      onRefreshHistory?.();
    } catch (err) {
      setSaveStatus(err.message || 'No se pudo crear el usuario.');
    }
  };

  const disableEditorUser = async (user) => {
    if (!can('manage_security')) {
      setSaveStatus('Tu rol no puede desactivar usuarios.');
      return;
    }
    if (!user?.username || user.username === auth?.user) {
      setSaveStatus('No puedes desactivar tu propia sesión directiva.');
      return;
    }
    if (!window.confirm(`Desactivar el acceso editorial de "${user.username}"?`)) return;
    try {
      await onDeleteUser(user.username);
      setSaveStatus(`Usuario ${user.username} desactivado.`);
      onRefreshHistory?.();
    } catch (err) {
      setSaveStatus(err.message || 'No se pudo desactivar el usuario.');
    }
  };

  const uploadFile = async (foco, file) => {
    if (!file) return;
    if (!can('upload_attachment')) {
      setSaveStatus('Tu rol no puede adjuntar archivos.');
      return;
    }
    setUploadingId(foco.id);
    setSaveStatus(`Adjuntando ${file.name}...`);
    try {
      const data = await fileToDataUrl(file);
      const meta = uploadMeta[foco.id] || {};
      const inferredType = inferSourceType(file);
      await onUploadAttachment(foco.id, {
        name: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        data,
        note: meta.note || 'Fuente documental cargada desde Panel Editor',
        source_type: meta.source_type || inferredType,
        reliability: meta.reliability || (inferredType === 'Fuente primaria / oficial' ? 'A' : inferredType === 'Red social / señal débil' ? 'D' : 'C'),
        tags: meta.tags || '',
      });
      setSaveStatus('Adjunto guardado en el expediente.');
      onRefreshHistory?.();
    } catch (err) {
      setSaveStatus(err.message || 'No se pudo adjuntar el archivo.');
    } finally {
      setUploadingId('');
    }
  };

  const deleteAttachment = async (attachment) => {
    if (!can('delete_attachment')) {
      setSaveStatus('Tu rol no puede quitar adjuntos.');
      return;
    }
    if (!window.confirm(`Eliminar adjunto "${attachment.name}"?`)) return;
    try {
      await onDeleteAttachment(attachment.id);
      setSaveStatus('Adjunto eliminado.');
      onRefreshHistory?.();
    } catch (err) {
      setSaveStatus(err.message || 'No se pudo eliminar el adjunto.');
    }
  };

  const totalAttachments = attachments?.length || 0;
  const formVerificationCount = verificationProgress(form);
  const reliabilityCounts = (attachments || []).reduce((acc, att) => {
    const key = att.reliability || 'C';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return html`
  <section class="grid grid-cols-1 xl:grid-cols-[1.15fr_.85fr] gap-4">
    <div class="panel rounded-md p-4 lg:p-5">
      <div class="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <div class="heading-mono">Panel editor · Archivo persistente GEOPÓLEM</div>
          <h2 class="font-display font-bold text-slate-50 text-[22px] mt-1">${isEditing ? 'Editar ficha táctica.' : 'Cargar análisis sin tocar código.'}</h2>
          <p class="text-[13px] text-slate-400 leading-relaxed mt-2 max-w-3xl">
            Crea un nuevo foco táctico con resumen, coordenadas, categoría, actores y fuentes. La app genera una estructura inicial FODA, PESTEL, riesgos y escenarios para empezar a trabajar.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <div class="chip">${focos.length} focos activos</div>
          <div class="chip">${customFocos.length} editoriales</div>
          <div class="chip text-intel">${auth?.roleLabel || 'Director editorial'}</div>
          <div class="chip">DB ${dbStatus || 'conectada'}</div>
        </div>
      </div>

      <div class="mb-4 rounded border border-radar/15 bg-radar/5 p-3">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div class="heading-mono text-radar">Matriz de permisos activa</div>
            <p class="text-[11.5px] text-slate-500 mt-1">Sesión: ${auth?.user || 'geopolem'} · Rol: ${auth?.roleLabel || 'Director editorial'}. Las acciones críticas quedan gobernadas por permisos del backend.</p>
          </div>
          <span class="chip">${permissions.size} permisos</span>
        </div>
        <div class="mt-3 flex flex-wrap gap-1.5">
          ${Object.entries(ROLE_PERMISSION_LABELS).map(([key, label]) => html`
            <span key=${key} class=${clsx('chip', can(key) ? 'text-intel' : 'text-slate-700')}>${label}</span>
          `)}
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label class="space-y-1 md:col-span-2">
          <span class="heading-mono">Título del foco</span>
          <input value=${form.title} onInput=${e=>update('title', e.target.value)}
            placeholder="Ej. Groenlandia — presión ártica y minerales críticos"
            class="w-full bg-carbon-900 border border-white/10 rounded px-3 py-2 text-[13px] text-slate-100 focus:border-radar/40 focus:outline-none"/>
        </label>

        <label class="space-y-1">
          <span class="heading-mono">Estado editorial</span>
          <select value=${form.status} onChange=${e=>update('status', e.target.value)}
            class="w-full bg-carbon-900 border border-white/10 rounded px-3 py-2 text-[13px] text-slate-100 focus:border-radar/40 focus:outline-none">
            ${WORKFLOW_STATES.map(state => html`<option key=${state.id} value=${state.id}>${state.label}</option>`)}
          </select>
        </label>

        <label class="space-y-1">
          <span class="heading-mono">Región</span>
          <select value=${form.region} onChange=${e=>update('region', e.target.value)}
            class="w-full bg-carbon-900 border border-white/10 rounded px-3 py-2 text-[13px] text-slate-100 focus:border-radar/40 focus:outline-none">
            ${REGIONS.map(r => html`<option key=${r} value=${r}>${r}</option>`)}
          </select>
        </label>

        <label class="space-y-1">
          <span class="heading-mono">Categoría</span>
          <select value=${form.category} onChange=${e=>update('category', e.target.value)}
            class="w-full bg-carbon-900 border border-white/10 rounded px-3 py-2 text-[13px] text-slate-100 focus:border-radar/40 focus:outline-none">
            ${Object.values(CATEGORIES).map(c => html`<option key=${c.id} value=${c.id}>${c.label}</option>`)}
          </select>
        </label>

        <label class="space-y-1">
          <span class="heading-mono">Latitud</span>
          <input type="number" value=${form.lat} onInput=${e=>update('lat', e.target.value)}
            class="w-full bg-carbon-900 border border-white/10 rounded px-3 py-2 text-[13px] text-slate-100 focus:border-radar/40 focus:outline-none"/>
        </label>

        <label class="space-y-1">
          <span class="heading-mono">Longitud</span>
          <input type="number" value=${form.lng} onInput=${e=>update('lng', e.target.value)}
            class="w-full bg-carbon-900 border border-white/10 rounded px-3 py-2 text-[13px] text-slate-100 focus:border-radar/40 focus:outline-none"/>
        </label>

        <label class="space-y-1 md:col-span-2">
          <span class="heading-mono">Resumen situacional</span>
          <textarea value=${form.summary} onInput=${e=>update('summary', e.target.value)}
            rows="4" placeholder="Describe qué pasa, por qué importa y qué pieza del tablero se mueve."
            class="w-full bg-carbon-900 border border-white/10 rounded px-3 py-2 text-[13px] text-slate-100 focus:border-radar/40 focus:outline-none resize-y"></textarea>
        </label>

        <label class="space-y-1">
          <span class="heading-mono">Actores principales</span>
          <textarea value=${form.actors} onInput=${e=>update('actors', e.target.value)}
            rows="3" placeholder="Separados por coma: EE.UU., China, OTAN, navieras..."
            class="w-full bg-carbon-900 border border-white/10 rounded px-3 py-2 text-[13px] text-slate-100 focus:border-radar/40 focus:outline-none resize-y"></textarea>
        </label>

        <label class="space-y-1">
          <span class="heading-mono">Fuentes abiertas</span>
          <textarea value=${form.sources} onInput=${e=>update('sources', e.target.value)}
            rows="3" placeholder="Un enlace o referencia por línea"
            class="w-full bg-carbon-900 border border-white/10 rounded px-3 py-2 text-[13px] text-slate-100 focus:border-radar/40 focus:outline-none resize-y"></textarea>
        </label>

        <label class="space-y-1 md:col-span-2">
          <span class="heading-mono">Gancho editorial / redes</span>
          <input value=${form.hook} onInput=${e=>update('hook', e.target.value)}
            placeholder="Ej. No es una crisis aislada: es una línea de fractura del sistema-mundo."
            class="w-full bg-carbon-900 border border-white/10 rounded px-3 py-2 text-[13px] text-slate-100 focus:border-radar/40 focus:outline-none"/>
        </label>

        <div class="md:col-span-2 rounded border border-white/8 bg-carbon-900/45 p-3">
          <div class="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div class="heading-mono">Checklist verificación OSINT</div>
              <p class="text-[11.5px] text-slate-500 mt-1">Control editorial antes de publicar: mapa, fuentes, fecha, riesgo y revisión legal de lenguaje.</p>
            </div>
            <span class="chip">${formVerificationCount}/5 checks</span>
          </div>
          <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            ${VERIFICATION_ITEMS.map(([key, label]) => html`
              <label key=${key} class="flex items-center gap-2 rounded border border-white/8 bg-carbon-950/55 px-3 py-2 text-[11.5px] text-slate-300">
                <input type="checkbox" checked=${Boolean(form[VERIFICATION_FORM_KEYS[key]])}
                  onChange=${e=>update(VERIFICATION_FORM_KEYS[key], e.target.checked)}
                  class="accent-radar"/>
                <span>${label}</span>
              </label>
            `)}
          </div>
          <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            <label class="space-y-1">
              <span class="heading-mono">Revisor</span>
              <input value=${form.reviewer} onInput=${e=>update('reviewer', e.target.value)}
                placeholder="Nombre o célula OSINT"
                class="w-full bg-carbon-950 border border-white/10 rounded px-3 py-2 text-[12px] text-slate-100 focus:border-radar/40 focus:outline-none"/>
            </label>
            <label class="space-y-1">
              <span class="heading-mono">Notas de revisión</span>
              <textarea value=${form.reviewNotes} onInput=${e=>update('reviewNotes', e.target.value)}
                rows="2" placeholder="Qué falta contrastar, qué se corrigió o qué se aprobó."
                class="w-full bg-carbon-950 border border-white/10 rounded px-3 py-2 text-[12px] text-slate-100 focus:border-radar/40 focus:outline-none resize-y"></textarea>
            </label>
          </div>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2 text-[11px] text-slate-400 font-mono uppercase tracking-wider">
          Intensidad ${form.intensity}
          <input type="range" min="1" max="5" value=${form.intensity} onChange=${e=>update('intensity', e.target.value)} class="accent-radar"/>
        </label>
        <button onClick=${saveFoco} disabled=${!canCreate}
          class=${clsx(
            'px-4 py-2 rounded border font-mono text-[11px] uppercase tracking-widest transition',
            canCreate ? 'border-radar/50 text-radar hover:bg-radar hover:text-carbon-950 hover:shadow-glow' : 'border-white/10 text-slate-600 cursor-not-allowed'
          )}>
          ${isEditing ? 'Guardar cambios' : 'Crear ficha'}
        </button>
        <button onClick=${()=>{ setForm(initial); setLastCreated(null); }}
          class="px-4 py-2 rounded border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5 font-mono text-[11px] uppercase tracking-widest">
          ${isEditing ? 'Cancelar edición' : 'Limpiar'}
        </button>
        ${saveStatus && html`<span class="text-[11px] text-slate-500 font-mono uppercase tracking-widest">${saveStatus}</span>`}
      </div>
    </div>

    <aside class="space-y-4">
      <div class="panel rounded-md p-4">
        <div class="heading-mono">Vista previa táctica</div>
        <div class="mt-3 rounded border border-white/8 bg-carbon-900/50 p-4">
          <div class="flex items-center justify-between gap-3">
            <span class="chip">${CATEGORIES[form.category]?.label || 'Categoría'}</span>
            <span class="font-mono text-[10px] text-alert">${[...Array(5)].map((_,i)=>html`<span key=${i} class=${i<Number(form.intensity)?'text-alert':'text-slate-700'}>■</span>`)}</span>
          </div>
          <h3 class="font-display font-bold text-slate-100 text-[18px] mt-3">${form.title || 'Título del nuevo foco'}</h3>
          <p class="text-[12.5px] text-slate-400 leading-relaxed mt-2">${form.summary || 'El resumen situacional aparecerá aquí para validar tono, claridad y utilidad editorial.'}</p>
          <div class="mt-3 text-[10.5px] font-mono uppercase tracking-widest text-slate-500">${form.region} · ${form.lat}, ${form.lng}</div>
        </div>
      </div>

      <div class="panel rounded-md p-4">
        <div class="heading-mono">Qué genera la app</div>
        <div class="mt-3 flex flex-wrap gap-1.5">
          <span class="chip">Mapa</span><span class="chip">Watchlist</span><span class="chip">FODA</span><span class="chip">PESTEL</span><span class="chip">Riesgos</span><span class="chip">Escenarios</span><span class="chip">Studio</span><span class="chip">Expediente OSINT</span><span class="chip">Workflow</span><span class="chip">Dossier MD</span>
        </div>
        <p class="text-[12px] text-slate-500 leading-relaxed mt-3">
          Esta versión guarda fichas y adjuntos en SQLite. Cada foco editorial puede convertirse en un expediente con fuentes clasificadas, confiabilidad A-D, checklist de verificación y dossier Markdown descargable.
        </p>
        <div class="mt-3 grid grid-cols-4 gap-1.5">
          ${['A','B','C','D'].map(level => html`
            <div key=${level} class="rounded border border-white/8 bg-carbon-950/60 p-2 text-center">
              <div class=${clsx('font-display font-bold text-[16px]', RELIABILITY_LEVELS[level].tone)}>${reliabilityCounts[level] || 0}</div>
              <div class="font-mono text-[9px] uppercase tracking-widest text-slate-600">${level}</div>
            </div>
          `)}
        </div>
        <div class="mt-2 font-mono text-[10px] uppercase tracking-widest text-slate-600">${totalAttachments} documentos clasificados</div>
      </div>

      <div class="panel rounded-md p-4">
        <div class="heading-mono">Seguridad editor</div>
        <p class="text-[12px] text-slate-500 mt-2 leading-relaxed">${can('manage_security') ? 'Cambia la clave privada del prototipo. Al actualizarla, la sesión se renueva.' : 'Solo Dirección Editorial puede modificar la clave del prototipo.'}</p>
        <div class="mt-3 flex gap-2">
          <input type="password" value=${passwordDraft} disabled=${!can('manage_security')} onInput=${e=>setPasswordDraft(e.target.value)} placeholder="Nueva clave"
            class="min-w-0 flex-1 bg-carbon-900 border border-white/10 rounded px-3 py-2 text-[12px] text-slate-100 focus:border-radar/40 focus:outline-none"/>
          <button onClick=${changePassword} disabled=${!can('manage_security')}
            class=${clsx('px-3 py-2 rounded border border-white/10 text-slate-300 hover:text-radar hover:border-radar/40 font-mono text-[10px] uppercase tracking-widest', !can('manage_security') && 'opacity-45 cursor-not-allowed')}>
            Cambiar
          </button>
        </div>
        <div class="mt-4 pt-4 border-t border-white/8">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="heading-mono text-radar">Usuarios editoriales</div>
              <p class="text-[11.5px] text-slate-500 mt-1 leading-relaxed">Crea accesos separados para analistas, revisores y dirección. Las sesiones quedan en base de datos y cada cambio registra actor.</p>
            </div>
            <span class="chip">${(users || []).filter(u => u.active).length} activos</span>
          </div>
          <div class="mt-3 grid grid-cols-1 gap-2">
            <input value=${userDraft.username} disabled=${!can('manage_security')} onInput=${e=>setUserDraft(prev => ({ ...prev, username: e.target.value }))}
              placeholder="usuario"
              class="bg-carbon-900 border border-white/10 rounded px-3 py-2 text-[12px] text-slate-100 focus:border-radar/40 focus:outline-none"/>
            <input type="password" value=${userDraft.password} disabled=${!can('manage_security')} onInput=${e=>setUserDraft(prev => ({ ...prev, password: e.target.value }))}
              placeholder="clave temporal"
              class="bg-carbon-900 border border-white/10 rounded px-3 py-2 text-[12px] text-slate-100 focus:border-radar/40 focus:outline-none"/>
            <select value=${userDraft.role} disabled=${!can('manage_security')} onChange=${e=>setUserDraft(prev => ({ ...prev, role: e.target.value }))}
              class="bg-carbon-900 border border-white/10 rounded px-3 py-2 text-[12px] text-slate-100 focus:border-radar/40 focus:outline-none">
              ${EDITOR_ROLES.map(role => html`<option key=${role.id} value=${role.id}>${role.label}</option>`)}
            </select>
            <button onClick=${createEditorUser} disabled=${!can('manage_security')}
              class=${clsx('px-3 py-2 rounded border border-radar/30 text-radar hover:bg-radar/10 font-mono text-[10px] uppercase tracking-widest', !can('manage_security') && 'opacity-45 cursor-not-allowed')}>
              Crear usuario
            </button>
          </div>
          <div class="mt-3 space-y-2 max-h-[260px] overflow-auto pr-1">
            ${(users || []).length ? users.map(user => {
              const role = EDITOR_ROLES.find(r => r.id === user.role);
              return html`
                <div key=${user.username} class=${clsx('rounded border p-3', user.active ? 'border-white/8 bg-carbon-950/55' : 'border-white/5 bg-carbon-950/25 opacity-55')}>
                  <div class="flex items-center justify-between gap-2">
                    <div>
                      <div class="font-display font-semibold text-[13px] text-slate-200">${user.username}</div>
                      <div class="font-mono text-[9.5px] uppercase tracking-widest text-slate-600">${role?.label || user.role} · ${user.active ? 'activo' : 'inactivo'}</div>
                    </div>
                    <button onClick=${()=>disableEditorUser(user)} disabled=${!can('manage_security') || !user.active || user.username === auth?.user}
                      class=${clsx('px-2 py-1 rounded border border-white/10 text-slate-400 hover:text-alert hover:border-alert/40 font-mono text-[9px] uppercase tracking-widest', (!can('manage_security') || !user.active || user.username === auth?.user) && 'opacity-40 cursor-not-allowed')}>
                      Desactivar
                    </button>
                  </div>
                  <p class="text-[11px] text-slate-600 mt-2 leading-relaxed">${role?.desc || 'Rol editorial personalizado.'}</p>
                </div>
              `;
            }) : html`<div class="text-[11.5px] text-slate-600">Sin usuarios cargados todavía.</div>`}
          </div>
        </div>
      </div>

      ${lastCreated && html`
        <div class="panel rounded-md p-4 border-radar/25">
          <div class="heading-mono">Ficha guardada</div>
          <h3 class="font-display font-semibold text-slate-100 mt-2">${lastCreated.title}</h3>
          <p class="text-[12px] text-slate-500 mt-2">Estado: ${workflowInfo(lastCreated.status).label}.</p>
          <button onClick=${()=>onOpenFoco(lastCreated.id)}
            class="mt-3 px-3 py-2 rounded border border-radar/40 text-radar hover:bg-radar/10 font-mono text-[10.5px] uppercase tracking-widest">
            Abrir en mapa
          </button>
        </div>
      `}
    </aside>
    <div class="xl:col-span-2 grid grid-cols-1 lg:grid-cols-[1.2fr_.8fr] gap-4">
      <div class="panel rounded-md p-4">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div class="heading-mono">Archivo editorial</div>
            <h3 class="font-display font-semibold text-slate-100 mt-1">Pipeline editorial</h3>
          </div>
          <button onClick=${()=>setForm(initial)}
            class="px-3 py-2 rounded border border-radar/30 text-radar hover:bg-radar/10 font-mono text-[10px] uppercase tracking-widest">
            Nueva ficha
          </button>
        </div>
        <div class="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          ${customFocos.length ? customFocos.map(f => {
            const state = workflowInfo(f.status);
            const stage = WORKFLOW_INDEX[f.status] ?? 0;
            const verifyCount = verificationProgress(f);
            const docsCount = (attachmentsByFoco.get(f.id) || []).length;
            return html`
            <article key=${f.id} class="rounded border border-white/10 bg-carbon-900/50 p-3">
              <div class="flex items-center justify-between gap-2">
                <span class=${clsx('chip', state.tone)}>${state.short}</span>
                <span class="text-[10px] font-mono text-slate-600">${f.region} · ${docsCount} docs</span>
              </div>
              <h4 class="font-display font-semibold text-slate-100 text-[14px] mt-2 leading-tight">${f.title}</h4>
              <p class="text-[11.5px] text-slate-500 mt-2 line-clamp-3">${f.summary}</p>
              <div class="mt-3 rounded border border-white/8 bg-carbon-950/45 p-2">
                <div class="flex items-center justify-between gap-2">
                  <span class="heading-mono">${state.label}</span>
                  <span class="text-[9.5px] font-mono uppercase tracking-widest text-slate-600">${verifyCount}/5 checks</span>
                </div>
                <div class="mt-2 grid grid-cols-4 gap-1">
                  ${WORKFLOW_STATES.map((step, i) => html`
                    <div key=${step.id} title=${step.label}
                      class=${clsx('h-1.5 rounded-full', i <= stage ? 'bg-radar shadow-glow' : 'bg-white/10')}></div>
                  `)}
                </div>
                <p class="text-[10.5px] text-slate-600 leading-relaxed mt-2">${state.desc}</p>
              </div>
              <div class="mt-3 flex flex-wrap gap-1.5">
                <button onClick=${()=>setForm(focoToForm(f))} disabled=${!can('edit_foco')} class=${clsx('px-2 py-1 rounded border border-white/10 text-slate-300 hover:text-radar font-mono text-[9.5px] uppercase tracking-widest', !can('edit_foco') && 'opacity-45 cursor-not-allowed')}>Editar</button>
                <button onClick=${()=>advanceStatus(f)} disabled=${f.status === 'published' || (workflowInfo(WORKFLOW_STATES[Math.min((WORKFLOW_INDEX[f.status] ?? 0) + 1, WORKFLOW_STATES.length - 1)].id).id === 'published' && !can('publish_foco'))}
                  class=${clsx('px-2 py-1 rounded border border-white/10 text-slate-300 hover:text-intel font-mono text-[9.5px] uppercase tracking-widest', (f.status === 'published' || !can('edit_foco')) && 'opacity-45 cursor-not-allowed')}>
                  ${f.status === 'published' ? 'Final' : 'Avanzar'}
                </button>
                <button onClick=${()=>resetStatus(f)} disabled=${!can('edit_foco')} class=${clsx('px-2 py-1 rounded border border-white/10 text-slate-300 hover:text-risk font-mono text-[9.5px] uppercase tracking-widest', !can('edit_foco') && 'opacity-45 cursor-not-allowed')}>Reabrir</button>
                <button onClick=${()=>onOpenFoco(f.id)} class="px-2 py-1 rounded border border-white/10 text-slate-300 hover:text-radar font-mono text-[9.5px] uppercase tracking-widest">Mapa</button>
                ${can('export_dossier') ? html`<a href=${getDossierUrl(f.id)} target="_blank" rel="noreferrer" class="px-2 py-1 rounded border border-intel/25 text-intel hover:bg-intel/10 font-mono text-[9.5px] uppercase tracking-widest">Dossier</a>` : html`<span class="px-2 py-1 rounded border border-white/10 text-slate-700 font-mono text-[9.5px] uppercase tracking-widest">Dossier</span>`}
                <button onClick=${()=>deleteFoco(f)} disabled=${!can('delete_foco')} class=${clsx('px-2 py-1 rounded border border-alert/20 text-alert hover:bg-alert/10 font-mono text-[9.5px] uppercase tracking-widest', !can('delete_foco') && 'opacity-45 cursor-not-allowed')}>Eliminar</button>
              </div>
              <div class="mt-3 border-t border-white/8 pt-3">
                <div class="flex items-center justify-between gap-2 flex-wrap">
                  <div class="heading-mono">Expediente</div>
                  <label class=${clsx('px-2 py-1 rounded border border-radar/25 text-radar hover:bg-radar/10 font-mono text-[9.5px] uppercase tracking-widest cursor-pointer', (uploadingId === f.id || !can('upload_attachment')) && 'opacity-50 pointer-events-none')}>
                    ${uploadingId === f.id ? 'Subiendo' : 'Adjuntar'}
                    <input type="file" class="hidden" onChange=${e=>{ const file = e.target.files?.[0]; uploadFile(f, file); e.target.value=''; }}/>
                  </label>
                </div>
                <div class="mt-2 grid grid-cols-1 gap-1.5">
                  <select value=${(uploadMeta[f.id]?.source_type) || 'Fuente abierta'} onChange=${e=>updateUploadMeta(f.id, 'source_type', e.target.value)}
                    class="w-full bg-carbon-950 border border-white/10 rounded px-2 py-1.5 text-[11px] text-slate-300 focus:border-radar/40 focus:outline-none">
                    ${OSINT_SOURCE_TYPES.map(type => html`<option key=${type} value=${type}>${type}</option>`)}
                  </select>
                  <div class="grid grid-cols-[.55fr_1fr] gap-1.5">
                    <select value=${(uploadMeta[f.id]?.reliability) || 'C'} onChange=${e=>updateUploadMeta(f.id, 'reliability', e.target.value)}
                      class="w-full bg-carbon-950 border border-white/10 rounded px-2 py-1.5 text-[11px] text-slate-300 focus:border-radar/40 focus:outline-none">
                      ${Object.entries(RELIABILITY_LEVELS).map(([level, info]) => html`<option key=${level} value=${level}>${info.label}</option>`)}
                    </select>
                    <input value=${(uploadMeta[f.id]?.tags) || ''} onInput=${e=>updateUploadMeta(f.id, 'tags', e.target.value)}
                      placeholder="tags: satélite, energía, frontera..."
                      class="w-full bg-carbon-950 border border-white/10 rounded px-2 py-1.5 text-[11px] text-slate-300 focus:border-radar/40 focus:outline-none"/>
                  </div>
                </div>
                <div class="mt-2 space-y-1.5">
                  ${(attachmentsByFoco.get(f.id) || []).length ? attachmentsByFoco.get(f.id).map(att => html`
                    <div key=${att.id} class="rounded border border-white/8 bg-carbon-950/60 px-2 py-2">
                      <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                          <a class="block truncate text-[11.5px] text-slate-300 hover:text-radar" href=${getAttachmentUrl(att.id)} target="_blank" rel="noreferrer">${att.name}</a>
                          <div class="text-[9.5px] text-slate-600 font-mono uppercase tracking-widest">${Math.max(1, Math.round((att.size || 0)/1024))} KB · ${att.mime || 'archivo'}</div>
                          <div class="mt-1 flex flex-wrap gap-1">
                            <span class=${clsx('text-[9px] font-mono uppercase tracking-widest', RELIABILITY_LEVELS[att.reliability || 'C']?.tone || 'text-risk')}>${att.reliability || 'C'}</span>
                            <span class="text-[9px] text-slate-500 font-mono uppercase tracking-widest">${att.source_type || 'Fuente abierta'}</span>
                          </div>
                          ${att.tags && html`<div class="mt-1 text-[10px] text-radar/75 truncate">#${String(att.tags).split(',').map(x=>x.trim()).filter(Boolean).join(' #')}</div>`}
                        </div>
                        <button onClick=${()=>deleteAttachment(att)} disabled=${!can('delete_attachment')} class=${clsx('shrink-0 text-[9.5px] text-alert hover:underline font-mono uppercase tracking-widest', !can('delete_attachment') && 'opacity-45 cursor-not-allowed')}>Quitar</button>
                      </div>
                    </div>
                  `) : html`<div class="text-[11px] text-slate-600">Sin documentos adjuntos.</div>`}
                </div>
              </div>
            </article>
          `}) : html`<div class="text-[12px] text-slate-500">Todavía no hay fichas editoriales guardadas.</div>`}
        </div>
      </div>

      <div class="panel rounded-md p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="heading-mono">Historial</div>
            <h3 class="font-display font-semibold text-slate-100 mt-1">Cambios recientes</h3>
          </div>
          <button onClick=${onRefreshHistory}
            class="px-2 py-1 rounded border border-white/10 text-slate-400 hover:text-radar font-mono text-[9.5px] uppercase tracking-widest">
            Actualizar
          </button>
        </div>
        <div class="mt-4 space-y-2 max-h-[360px] overflow-auto pr-1">
          ${history?.length ? history.map((h, i) => html`
            <div key=${`${h.created_at}-${i}`} class="rounded border border-white/8 bg-carbon-900/45 p-3">
              <div class="flex items-center justify-between gap-2">
                <span class="heading-mono text-radar">${h.action}</span>
                <span class="text-[10px] font-mono text-slate-600">${new Date(h.created_at * 1000).toLocaleString()}</span>
              </div>
              <div class="text-[12px] text-slate-300 mt-1">${h.title}</div>
              ${h.actor && html`<div class="mt-2 font-mono text-[9.5px] uppercase tracking-widest text-slate-600">Actor · ${h.actor}</div>`}
            </div>
          `) : html`<div class="text-[12px] text-slate-500">Sin movimientos registrados todavía.</div>`}
        </div>
      </div>
    </div>
  </section>`;
}

/* ========================================================================
   Sala audiovisual · Video Intelligence
   ======================================================================== */
function VideoCard({ video, copy, onOpen }) {
  const cat = VIDEO_CATEGORIES[video.category] || { label: video.category, tone: 'cyan', accent: '#22d3ee' };
  const tone = TONE_TO_COLOR[cat.tone] || TONE_TO_COLOR.cyan;
  const isVertical = video.orientation === 'vertical';
  const aspect = isVertical ? 'aspect-[9/16]' : 'aspect-video';
  const subs = (video.subtitles && video.subtitles.length)
    ? video.subtitles.join(' · ')
    : copy.none;
  return html`
  <article class=${clsx(
    'group relative panel rounded-lg overflow-hidden flex flex-col',
    'hover:border-radar/40 hover:shadow-glow transition'
  )}>
    <span class="corner-tl"></span><span class="corner-tr"></span>
    <span class="corner-bl"></span><span class="corner-br"></span>

    <button onClick=${onOpen} class=${clsx('relative w-full bg-carbon-950 overflow-hidden', aspect)} aria-label=${copy.play + ' — ' + video.title}>
      <img src=${video.poster} alt=${video.title} loading="lazy"
           class="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-[1.03] transition duration-500"/>
      <div class="absolute inset-0 bg-gradient-to-b from-carbon-950/10 via-carbon-950/40 to-carbon-950/85"></div>
      <div class="absolute inset-0 scanlines pointer-events-none opacity-40"></div>
      <div class="absolute top-2 left-2 flex items-center gap-1.5">
        <span class=${clsx('chip', tone.txt)} style=${{borderColor: cat.accent + '55', background: cat.accent + '12'}}>${cat.label}</span>
        ${isVertical && html`<span class="chip">${copy.vertical}</span>`}
      </div>
      <div class="absolute top-2 right-2 flex items-center gap-1">
        <span class="chip font-mono">${video.language}${video.subtitles?.length ? ' · sub ' + video.subtitles.join('/') : ''}</span>
      </div>
      <div class="absolute bottom-2 right-2">
        <span class="chip font-mono">${video.duration}</span>
      </div>
      <div class="absolute inset-0 flex items-center justify-center">
        <span class="w-14 h-14 rounded-full border border-radar/60 bg-carbon-950/55 backdrop-blur-sm flex items-center justify-center group-hover:bg-radar/15 transition">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="text-radar translate-x-[1px]">
            <polygon points="6,4 20,12 6,20" fill="currentColor" stroke="none"/>
          </svg>
        </span>
      </div>
    </button>

    <div class="p-3.5 flex-1 flex flex-col gap-2">
      <h3 class="font-display font-semibold text-[15px] leading-snug text-slate-100">${video.title}</h3>
      <p class="text-[12.5px] leading-relaxed text-slate-400">${video.description}</p>
      <div class="mt-auto pt-2 border-t border-white/5 flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 text-[10.5px] font-mono uppercase tracking-widest text-slate-500">
          <span class="w-1.5 h-1.5 rounded-full animate-pulse-dot" style=${{background: cat.accent}}></span>
          ${copy.audio} ${video.language} · ${subs}
        </div>
        <button onClick=${onOpen}
          class="px-2.5 py-1 rounded border border-radar/40 text-radar text-[10.5px] font-mono uppercase tracking-widest hover:bg-radar/10 transition">
          ${copy.play}
        </button>
      </div>
    </div>
  </article>`;
}

function VideoPlayerModal({ video, copy, onClose }) {
  const videoRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  if (!video) return null;
  const cat = VIDEO_CATEGORIES[video.category] || { label: video.category, accent: '#22d3ee' };
  const isVertical = video.orientation === 'vertical';
  return html`
  <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-carbon-950/90 backdrop-blur-md"
       onClick=${onClose}>
    <div class="relative w-full max-w-5xl panel rounded-lg overflow-hidden max-h-[92vh] flex flex-col"
         onClick=${(e)=>e.stopPropagation()}>
      <span class="corner-tl"></span><span class="corner-tr"></span>
      <span class="corner-bl"></span><span class="corner-br"></span>

      <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/5">
        <div class="flex items-center gap-2 min-w-0">
          <span class="chip" style=${{borderColor: cat.accent + '55', background: cat.accent + '12', color: cat.accent}}>${cat.label}</span>
          <h3 class="font-display font-semibold text-[15px] text-slate-100 truncate">${video.title}</h3>
        </div>
        <button onClick=${onClose}
          class="px-2.5 py-1 rounded border border-white/10 text-slate-300 text-[11px] font-mono uppercase tracking-widest hover:bg-white/5 transition"
          aria-label="Close">✕ Esc</button>
      </div>

      <div class=${clsx('flex flex-col lg:flex-row bg-carbon-950', isVertical ? 'lg:items-stretch' : '')}>
        <div class=${clsx('relative bg-black flex items-center justify-center',
                         isVertical ? 'lg:w-[55%] aspect-[9/16] lg:aspect-auto lg:max-h-[78vh]' : 'w-full aspect-video')}>
          <video
            ref=${videoRef}
            class=${clsx('w-full h-full', isVertical ? 'object-contain' : 'object-contain')}
            src=${video.src}
            poster=${video.poster}
            controls
            autoplay
            playsInline
            preload="metadata"
          ></video>
          <div class="absolute inset-0 pointer-events-none scanlines opacity-25"></div>
        </div>
        <div class=${clsx('p-4 lg:p-5 space-y-3 overflow-y-auto', isVertical ? 'lg:w-[45%] lg:max-h-[78vh]' : '')}>
          <p class="text-[13.5px] leading-relaxed text-slate-300">${video.description}</p>
          <div class="panel-soft rounded p-3">
            <div class="heading-mono">${copy.strategic}</div>
            <p class="mt-1 text-[13px] leading-relaxed text-slate-200">${video.strategic}</p>
          </div>
          ${video.sources?.length && html`
          <div class="panel-soft rounded p-3">
            <div class="heading-mono">${copy.sources}</div>
            <ul class="mt-1.5 space-y-1.5">
              ${video.sources.map(s => html`
                <li class="text-[12px] leading-snug">
                  <a href=${s.url} target="_blank" rel="noreferrer"
                     class="text-radar hover:underline break-words">${s.label}</a>
                </li>`)}
            </ul>
          </div>`}
          ${video.editorialClose && html`
          <div class="rounded p-3 border border-radar/30 bg-radar/5">
            <div class="heading-mono">${copy.editorialClose}</div>
            <p class="mt-1 font-display font-semibold text-[14px] text-radar tracking-wide">${video.editorialClose}</p>
          </div>`}
          <div class="grid grid-cols-2 gap-2 text-[11.5px]">
            <div class="panel-soft rounded p-2.5">
              <div class="heading-mono">${copy.audio}</div>
              <div class="text-slate-200 font-mono mt-0.5">${video.language}</div>
            </div>
            <div class="panel-soft rounded p-2.5">
              <div class="heading-mono">${copy.subs}</div>
              <div class="text-slate-200 font-mono mt-0.5">${video.subtitles?.length ? video.subtitles.join(' · ') : copy.none}</div>
            </div>
            <div class="panel-soft rounded p-2.5">
              <div class="heading-mono">${copy.duration}</div>
              <div class="text-slate-200 font-mono mt-0.5">${video.duration}</div>
            </div>
            <div class="panel-soft rounded p-2.5">
              <div class="heading-mono">${copy.source}</div>
              <div class="text-slate-200 font-mono mt-0.5 truncate" title=${video.source}>${video.source}</div>
            </div>
          </div>
          <a href=${video.src} download
             class="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-radar/40 text-radar text-[11px] font-mono uppercase tracking-widest hover:bg-radar/10 transition">
            ⬇ MP4
          </a>
        </div>
      </div>
    </div>
  </div>`;
}

function VideoLibrary({ lang }) {
  const copy = SALA_COPY[lang] || SALA_COPY.ES;
  const [openId, setOpenId] = useState(null);
  const [filter, setFilter] = useState('all');
  const featured = useMemo(() => VIDEOS.filter(v => v.featured), []);
  const filtered = useMemo(() =>
    filter === 'all' ? VIDEOS : VIDEOS.filter(v => v.category === filter),
    [filter]
  );
  const open = openId ? VIDEOS.find(v => v.id === openId) : null;
  const categories = useMemo(() => {
    const used = new Set(VIDEOS.map(v => v.category));
    return Array.from(used).map(id => ({ id, ...VIDEO_CATEGORIES[id] }));
  }, []);

  return html`
  <section class="space-y-5 lg:space-y-7">
    <!-- Hero -->
    <div class="relative panel rounded-lg overflow-hidden">
      <span class="corner-tl"></span><span class="corner-tr"></span>
      <span class="corner-bl"></span><span class="corner-br"></span>
      <div class="boot-grid absolute inset-0 opacity-50 pointer-events-none"></div>
      <div class="absolute inset-0 scanlines pointer-events-none opacity-50"></div>
      <div class="relative p-5 lg:p-8 flex flex-col gap-2 lg:gap-3">
        <div class="flex items-center gap-2">
          <span class="relative flex w-2 h-2">
            <span class="absolute inline-flex h-full w-full rounded-full bg-alert/70 opacity-70 animate-ping-ring"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-alert"></span>
          </span>
          <span class="font-mono text-[10.5px] uppercase tracking-[0.32em] text-radar">${copy.eyebrow}</span>
        </div>
        <h2 class="font-display font-bold text-[26px] sm:text-[34px] lg:text-[40px] text-slate-50 leading-tight glow-text">${copy.title}</h2>
        <p class="text-[14px] sm:text-[15px] text-slate-300 max-w-2xl">${copy.subtitle}</p>
        <p class="text-[12.5px] text-slate-400 max-w-2xl">${copy.intro}</p>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <span class="chip text-radar" style=${{borderColor: 'rgba(34,211,238,0.45)'}}>${copy.badge}</span>
          <span class="chip">${copy.counter(VIDEOS.length)}</span>
        </div>
      </div>
    </div>

    <!-- Featured -->
    ${featured.length > 0 && html`
      <div>
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-display font-semibold text-[17px] text-slate-100 tracking-wide">${copy.featured}</h3>
          <span class="heading-mono">${featured.length}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
          ${featured.map(v => html`<${VideoCard} key=${v.id} video=${v} copy=${copy} onOpen=${()=>setOpenId(v.id)}/>`)}
        </div>
      </div>
    `}

    <!-- Library -->
    <div>
      <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 class="font-display font-semibold text-[17px] text-slate-100 tracking-wide">${copy.library}</h3>
        <div class="flex items-center gap-1.5 flex-wrap">
          <button onClick=${()=>setFilter('all')}
            class=${clsx(
              'px-2.5 py-1 rounded text-[11px] font-mono uppercase tracking-widest border transition',
              filter==='all' ? 'border-radar/50 text-radar bg-radar/10' : 'border-white/10 text-slate-400 hover:text-slate-100 hover:bg-white/5'
            )}>${copy.filterAll}</button>
          ${categories.map(c => html`
            <button key=${c.id} onClick=${()=>setFilter(c.id)}
              class=${clsx(
                'px-2.5 py-1 rounded text-[11px] font-mono uppercase tracking-widest border transition',
                filter===c.id ? 'border-radar/50 text-radar bg-radar/10' : 'border-white/10 text-slate-400 hover:text-slate-100 hover:bg-white/5'
              )}>${c.label}</button>
          `)}
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
        ${filtered.map(v => html`<${VideoCard} key=${v.id} video=${v} copy=${copy} onOpen=${()=>setOpenId(v.id)}/>`)}
      </div>
    </div>

    <p class="text-[11px] font-mono uppercase tracking-widest text-slate-500 text-center pt-2">${copy.note}</p>

    ${open && html`<${VideoPlayerModal} video=${open} copy=${copy} onClose=${()=>setOpenId(null)}/>`}
  </section>`;
}

function SalaTeaser({ lang, onOpen }) {
  const copy = SALA_COPY[lang] || SALA_COPY.ES;
  const picks = useMemo(() => VIDEOS.filter(v => v.featured).slice(0, 3), []);
  return html`
  <section class="relative panel rounded-lg overflow-hidden">
    <span class="corner-tl"></span><span class="corner-tr"></span>
    <span class="corner-bl"></span><span class="corner-br"></span>
    <div class="boot-grid absolute inset-0 opacity-40 pointer-events-none"></div>
    <div class="relative p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6 items-center">
      <div class="lg:col-span-2 space-y-2">
        <div class="font-mono text-[10.5px] uppercase tracking-[0.3em] text-radar">${copy.eyebrow}</div>
        <h3 class="font-display font-bold text-[22px] lg:text-[26px] text-slate-50 leading-tight glow-text">${copy.title}</h3>
        <p class="text-[13px] text-slate-300">${copy.subtitle}</p>
        <button onClick=${onOpen}
          class="mt-2 inline-flex items-center gap-2 px-3.5 py-2 rounded border border-radar/40 text-radar text-[12px] font-mono uppercase tracking-widest hover:bg-radar/10 hover:shadow-glow transition">
          ▶ ${copy.library} · ${VIDEOS.length}
        </button>
      </div>
      <div class="lg:col-span-3 grid grid-cols-3 gap-2 lg:gap-3">
        ${picks.map(v => html`
          <button key=${v.id} onClick=${onOpen}
            class="relative group aspect-[9/16] overflow-hidden rounded border border-white/5 hover:border-radar/40 transition">
            <img src=${v.poster} alt=${v.title} loading="lazy"
                 class="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-[1.04] transition duration-500"/>
            <div class="absolute inset-0 bg-gradient-to-t from-carbon-950/90 via-carbon-950/30 to-transparent"></div>
            <div class="absolute bottom-1.5 left-1.5 right-1.5 text-left">
              <div class="text-[10.5px] font-display font-semibold text-slate-100 leading-tight line-clamp-2">${v.title}</div>
            </div>
            <span class="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-carbon-950/55 border border-radar/40 flex items-center justify-center">
              <svg width="11" height="11" viewBox="0 0 24 24"><polygon points="6,4 20,12 6,20" fill="#22d3ee"/></svg>
            </span>
          </button>
        `)}
      </div>
    </div>
  </section>`;
}

/* ========================================================================
   Doctrina GEOPÓLEM — Tripolaridad imperfecta
   Marco analítico permanente (situation room). Bilingüe ES/EN.
   ======================================================================== */
function YouTubeEmbed({ id, title }) {
  const [play, setPlay] = useState(false);
  const poster = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  if (play) {
    return html`
    <div class="relative w-full aspect-video overflow-hidden rounded border border-radar/30 bg-black">
      <iframe class="absolute inset-0 w-full h-full"
        src=${`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`}
        title=${title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
    </div>`;
  }
  return html`
  <button onClick=${()=>setPlay(true)}
    class="group relative block w-full aspect-video overflow-hidden rounded border border-white/10 hover:border-radar/40 transition">
    <img src=${poster} alt=${title} loading="lazy"
         class="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-[1.03] transition duration-500"/>
    <div class="absolute inset-0 bg-gradient-to-t from-carbon-950/90 via-carbon-950/20 to-transparent"></div>
    <span class="absolute inset-0 flex items-center justify-center">
      <span class="w-14 h-14 rounded-full bg-carbon-950/70 border border-radar/50 flex items-center justify-center group-hover:shadow-glow transition">
        <svg width="20" height="20" viewBox="0 0 24 24"><polygon points="6,4 20,12 6,20" fill="#22d3ee"/></svg>
      </span>
    </span>
    <div class="absolute bottom-2 left-3 right-3 text-left">
      <div class="text-[12px] font-display font-semibold text-slate-100 leading-tight">${title}</div>
    </div>
  </button>`;
}

const ROLE_STYLE = {
  structure: { tag:'Estructura', tagEn:'Structures', dot:'#22d3ee', ring:'border-radar/40' },
  normative: { tag:'Potencia normativa', tagEn:'Normative', dot:'#a78bfa', ring:'border-violet-400/40' },
  maneuver:  { tag:'Maniobra', tagEn:'Maneuvers', dot:'#10b981', ring:'border-intel/40' },
};

function TripolarDiagram({ pillars, en }) {
  const w = 560, h = 360;
  // Tres polos estructurantes en triángulo, normativa y sur global periféricos
  const pos = {
    eeuu:        { x:0.28, y:0.26 },
    china:       { x:0.72, y:0.26 },
    rusia:       { x:0.50, y:0.78 },
    ue:          { x:0.13, y:0.62 },
    'sur-global':{ x:0.87, y:0.62 },
  };
  const core = pillars.filter(p => p.role === 'structure');
  return html`
  <svg viewBox=${`0 0 ${w} ${h}`} class="w-full h-auto">
    <defs>
      <filter id="triGlow"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <!-- triángulo estructurante (tripolaridad) -->
    <polygon points=${core.map(p => `${pos[p.id].x*w},${pos[p.id].y*h}`).join(' ')}
      fill="rgba(34,211,238,0.05)" stroke="rgba(34,211,238,0.35)" stroke-width="1" stroke-dasharray="4 4"/>
    <!-- vínculos periféricos -->
    ${['ue','sur-global'].map(id => {
      const a = pos[id]; const c = pos.rusia;
      return core.map(p => html`<line key=${id+p.id} x1=${a.x*w} y1=${a.y*h} x2=${pos[p.id].x*w} y2=${pos[p.id].y*h} stroke="rgba(148,163,184,0.14)" stroke-width="0.6"/>`);
    })}
    <!-- nodos -->
    ${pillars.map(p => {
      const x = pos[p.id].x*w, y = pos[p.id].y*h;
      const isCore = p.role === 'structure';
      return html`
      <g key=${p.id}>
        <circle cx=${x} cy=${y} r=${isCore?30:23} fill=${`${p.accent}1e`} stroke=${p.accent} stroke-width=${isCore?1.6:1} filter=${isCore?'url(#triGlow)':'none'}/>
        <circle cx=${x} cy=${y} r="4" fill=${p.accent}/>
        <text x=${x} y=${y-(isCore?38:30)} text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="13" fill="#e2e8f0">${en?p.actorEn:p.actor}</text>
        <text x=${x} y=${y+(isCore?44:36)} text-anchor="middle" font-family="JetBrains Mono" font-size="9" letter-spacing="1" fill=${p.accent}>${(en?p.functionEn:p.function).toUpperCase()}</text>
      </g>`;
    })}
    <text x=${w/2} y=${h*0.5} text-anchor="middle" font-family="JetBrains Mono" font-size="9" letter-spacing="2" fill="rgba(148,163,184,0.5)">TRIPOLARIDAD</text>
  </svg>`;
}

function DoctrinaTeaser({ lang, onOpen }) {
  const en = lang === 'EN';
  const d = DOCTRINA;
  return html`
  <section class="relative panel rounded-lg overflow-hidden border border-violet-400/20">
    <span class="corner-tl"></span><span class="corner-tr"></span>
    <span class="corner-bl"></span><span class="corner-br"></span>
    <div class="boot-grid absolute inset-0 opacity-30 pointer-events-none"></div>
    <div class="relative p-4 lg:p-6 flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
      <div class="space-y-1.5 max-w-2xl">
        <div class="font-mono text-[10.5px] uppercase tracking-[0.3em] text-violet-400">${d.eyebrow}</div>
        <h3 class="font-display font-bold text-[20px] lg:text-[24px] text-slate-50 leading-tight glow-text">${d.title} <span class="text-violet-300">${d.subtitle}</span></h3>
        <p class="text-[13px] text-slate-300">${en?d.summaryEn:d.summary}</p>
      </div>
      <button onClick=${onOpen}
        class="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded border border-violet-400/40 text-violet-200 text-[12px] font-mono uppercase tracking-widest hover:bg-violet-400/10 hover:shadow-glow transition">
        ◬ ${en?'Open doctrine':'Abrir doctrina'}
      </button>
    </div>
  </section>`;
}

function Doctrina({ lang }) {
  const en = lang === 'EN';
  const d = DOCTRINA;
  const date = new Date().toLocaleDateString(en?'en-GB':'es-ES', { day:'2-digit', month:'long', year:'numeric' });
  return html`
  <section class="space-y-4">
    <!-- Hero -->
    <div class="relative panel rounded-lg overflow-hidden">
      <span class="corner-tl"></span><span class="corner-tr"></span>
      <span class="corner-bl"></span><span class="corner-br"></span>
      <div class="boot-grid absolute inset-0 opacity-30 pointer-events-none"></div>
      <div class="scanlines absolute inset-0 pointer-events-none"></div>
      <div class="relative p-5 lg:p-7">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="font-mono text-[10.5px] uppercase tracking-[0.3em] text-violet-400">${d.eyebrow} · <span class="text-slate-500">${d.eyebrowEn}</span></div>
          <div class="text-[10px] font-mono uppercase tracking-widest text-slate-500">SITUATION ROOM · ${date}</div>
        </div>
        <h2 class="font-display font-bold text-[26px] lg:text-[34px] text-slate-50 leading-tight mt-2 glow-text">
          ${d.title} <span class="text-violet-300">${d.subtitle}</span>
        </h2>
        <div class="text-[13px] text-slate-400 font-display">${d.titleEn} ${d.subtitleEn}</div>
        <p class="text-[14px] lg:text-[15px] text-slate-200 leading-relaxed mt-3 max-w-3xl">${d.summary}</p>
        <p class="text-[12.5px] text-slate-500 leading-relaxed mt-1.5 max-w-3xl italic">${d.summaryEn}</p>
        <div class="flex flex-wrap gap-1.5 mt-4">
          ${d.tags.map(tag => html`<span key=${tag} class="chip">#${tag}</span>`)}
        </div>
      </div>
    </div>

    <!-- Diagrama tripolar + pregunta analítica -->
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div class="lg:col-span-3 relative panel rounded-md p-4">
        <div class="flex items-center justify-between mb-2">
          <div class="heading-mono">${en?'Tri-polar board':'Tablero tripolar'}</div>
          <div class="text-[10px] font-mono uppercase tracking-widest text-slate-500">FLOW · v1.0</div>
        </div>
        <div class="panel-soft rounded p-2">
          <${TripolarDiagram} pillars=${d.pillars} en=${en}/>
        </div>
      </div>
      <div class="lg:col-span-2 relative panel rounded-md p-4 flex flex-col justify-center">
        <span class="corner-tl"></span><span class="corner-br"></span>
        <div class="heading-mono mb-2">${en?'Analytical question':'Pregunta analítica'}</div>
        <p class="font-display font-semibold text-[18px] lg:text-[20px] text-slate-100 leading-snug">${d.question}</p>
        <p class="text-[12.5px] text-slate-500 italic mt-2 leading-snug">${d.questionEn}</p>
        <div class="grid grid-cols-3 gap-2 mt-4">
          ${d.axes.map(ax => html`
            <div key=${ax.id} class="panel-soft rounded p-2 text-center">
              <div class="font-mono text-[9px] uppercase tracking-wider text-violet-400">${en?ax.labelEn:ax.label}</div>
            </div>
          `)}
        </div>
      </div>
    </div>

    <!-- Pilares: quién estructura / maniobra -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      ${d.pillars.map(p => {
        const rs = ROLE_STYLE[p.role] || ROLE_STYLE.structure;
        return html`
        <div key=${p.id} class=${clsx('relative panel-soft rounded-md p-3.5 border', rs.ring)}>
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full" style=${{background:p.accent}}></span>
              <div class="font-display font-bold text-[15px] text-slate-100">${en?p.actorEn:p.actor}</div>
            </div>
            <span class="font-mono text-[9px] uppercase tracking-wider" style=${{color:p.accent}}>${en?rs.tagEn:rs.tag}</span>
          </div>
          <div class="text-[11px] text-slate-500 font-mono mt-0.5">${en?p.functionEn:p.function}</div>
          <div class="flex flex-wrap gap-1 mt-2.5">
            ${(en?p.domainsEn:p.domains).map(dm => html`<span key=${dm} class="chip" style=${{borderColor:`${p.accent}55`, color:'#cbd5e1'}}>${dm}</span>`)}
          </div>
        </div>`;
      })}
    </div>

    <!-- SENTINEL reading layer -->
    <div class="relative panel rounded-md p-4 border border-alert/20">
      <span class="corner-tl"></span><span class="corner-tr"></span>
      <div class="flex items-center gap-2">
        <span class="relative flex w-2 h-2">
          <span class="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping-ring bg-alert"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-alert"></span>
        </span>
        <div class="heading-mono text-alert-soft">${d.sentinel.label} · <span class="text-slate-500">${d.sentinel.labelEn}</span></div>
      </div>
      <p class="text-[13px] text-slate-300 leading-relaxed mt-2 max-w-3xl">${d.sentinel.note}</p>
      <p class="text-[12px] text-slate-500 italic leading-relaxed mt-1 max-w-3xl">${d.sentinel.noteEn}</p>
    </div>

    <!-- Vídeos: largo + short -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2 panel rounded-md p-4">
        <div class="flex items-center justify-between mb-2">
          <div class="heading-mono">${en?d.videos.long.labelEn:d.videos.long.label}</div>
          <a href=${d.videos.long.url} target="_blank" rel="noopener"
             class="text-[10px] font-mono uppercase tracking-widest text-radar hover:text-radar-glow transition">YouTube ↗</a>
        </div>
        <${YouTubeEmbed} id=${d.videos.long.id} title=${`${d.title} ${d.subtitle}`}/>
      </div>
      <div class="panel rounded-md p-4 flex flex-col">
        <div class="flex items-center justify-between mb-2">
          <div class="heading-mono">${en?d.videos.short.labelEn:d.videos.short.label}</div>
          <a href=${d.videos.short.url} target="_blank" rel="noopener"
             class="text-[10px] font-mono uppercase tracking-widest text-radar hover:text-radar-glow transition">Short ↗</a>
        </div>
        <${YouTubeEmbed} id=${d.videos.short.id} title=${en?d.videos.short.labelEn:d.videos.short.label}/>
        <a href=${d.videos.long.url} target="_blank" rel="noopener"
          class="mt-3 inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded border border-radar/40 text-radar text-[12px] font-mono uppercase tracking-widest hover:bg-radar/10 hover:shadow-glow transition">
          ▶ ${en?'Watch full analysis':'Ver análisis completo'}
        </a>
      </div>
    </div>

    <!-- Cierre de marca -->
    <div class="text-center py-2">
      <div class="font-display font-semibold text-[15px] text-violet-300 glow-text tracking-wide">${d.close}</div>
    </div>
  </section>`;
}

/* ========================================================================
   Conflictos activos — publicación del dashboard (SIMULADO)
   Vídeo oficial de presentación + acceso a la sub-página ./conflictos-activos/.
   ======================================================================== */
function ConflictosActivosTeaser({ lang }) {
  const en = lang === 'EN';
  const c = CONFLICTOS_ACTIVOS;
  return html`
  <section class="panel rounded-lg p-4 lg:p-5 border border-risk/25 space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="max-w-2xl space-y-1.5">
        <div class="flex items-center gap-2">
          <div class="heading-mono text-risk">${en?c.eyebrowEn:c.eyebrow}</div>
          <span class="px-1 rounded bg-risk/20 text-risk font-mono text-[9px] tracking-[0.18em]">SIM</span>
        </div>
        <h3 class="font-display font-bold text-[20px] lg:text-[24px] text-slate-50 leading-tight">
          ${en?c.titleEn:c.title} <span class="text-risk">${en?c.subtitleEn:c.subtitle}</span>
        </h3>
        <p class="text-[13px] text-slate-300 leading-relaxed">${en?c.summaryEn:c.summary}</p>
        <p class="text-[11.5px] font-mono uppercase tracking-widest text-slate-500">${en?c.disclaimerEn:c.disclaimer}</p>
      </div>
      <a href=${c.route}
        class="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded border border-risk/40 text-risk text-[12px] font-mono uppercase tracking-widest hover:bg-risk/10 transition">
        ${en?'Open dashboard':'Abrir dashboard'}
      </a>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2 panel-soft rounded-md p-4 border border-white/5">
        <div class="flex items-center justify-between mb-2">
          <div class="heading-mono">${en?c.videos.long.labelEn:c.videos.long.label}</div>
          <a href=${c.videos.long.url} target="_blank" rel="noopener"
             class="text-[10px] font-mono uppercase tracking-widest text-radar hover:text-radar-glow transition">YouTube ↗</a>
        </div>
        <${YouTubeEmbed} id=${c.videos.long.id} title=${`${en?c.titleEn:c.title} · ${en?c.subtitleEn:c.subtitle}`}/>
      </div>
      <div class="panel-soft rounded-md p-4 border border-white/5 flex flex-col">
        <div class="flex items-center justify-between mb-2">
          <div class="heading-mono">${en?c.videos.short.labelEn:c.videos.short.label}</div>
          <a href=${c.videos.short.url} target="_blank" rel="noopener"
             class="text-[10px] font-mono uppercase tracking-widest text-radar hover:text-radar-glow transition">Short ↗</a>
        </div>
        <${YouTubeEmbed} id=${c.videos.short.id} title=${en?c.videos.short.labelEn:c.videos.short.label}/>
        <a href=${c.videos.long.url} target="_blank" rel="noopener"
          class="mt-3 inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded border border-radar/40 text-radar text-[12px] font-mono uppercase tracking-widest hover:bg-radar/10 hover:shadow-glow transition">
          ▶ ${en?'Watch full analysis':'Ver análisis completo'}
        </a>
      </div>
    </div>
  </section>`;
}

/* ========================================================================
   PLAN Z — Documental de inteligencia (petróleo, deuda, poder)
   Documental completo embebido desde YouTube + activación social 9:16.
   ======================================================================== */
function PlanZTeaser({ lang, onOpen }) {
  const en = lang === 'EN';
  const p = PLAN_Z;
  return html`
  <section class="relative panel rounded-lg overflow-hidden border border-alert/25">
    <span class="corner-tl"></span><span class="corner-tr"></span>
    <span class="corner-bl"></span><span class="corner-br"></span>
    <div class="boot-grid absolute inset-0 opacity-30 pointer-events-none"></div>
    <div class="scanlines absolute inset-0 pointer-events-none"></div>
    <div class="relative p-4 lg:p-6 flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
      <div class="space-y-1.5 max-w-2xl">
        <div class="flex items-center gap-2">
          <span class="relative flex w-2 h-2">
            <span class="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping-ring bg-alert"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-alert"></span>
          </span>
          <div class="font-mono text-[10.5px] uppercase tracking-[0.3em] text-alert-soft">${en?p.eyebrowEn:p.eyebrow} · ${en?'NOW ON YOUTUBE':'YA EN YOUTUBE'}</div>
        </div>
        <h3 class="font-display font-bold text-[20px] lg:text-[26px] text-slate-50 leading-tight glow-text">${p.title} <span class="text-alert-soft">${en?p.subtitleEn:p.subtitle}</span></h3>
        <p class="text-[13px] text-slate-300">${en?p.summaryEn:p.summary}</p>
      </div>
      <button onClick=${onOpen}
        class="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded border border-alert/40 text-alert-soft text-[12px] font-mono uppercase tracking-widest hover:bg-alert/10 hover:shadow-glow transition">
        ▶ ${en?'Open Plan Z':'Abrir Plan Z'}
      </button>
    </div>
  </section>`;
}

/* ========================================================================
   Ficha editorial · Ventaja estratégica — teaser (dashboard) + vista completa
   Marco doctrinal (Hecho · Evaluación · Hipótesis) + siete dimensiones.
   ======================================================================== */
function FichaTeaser({ lang, onOpen }) {
  const en = lang === 'EN';
  const f = FICHA_VENTAJA;
  return html`
  <section class="relative panel rounded-lg overflow-hidden border border-radar/25">
    <span class="corner-tl"></span><span class="corner-tr"></span>
    <span class="corner-bl"></span><span class="corner-br"></span>
    <div class="boot-grid absolute inset-0 opacity-25 pointer-events-none"></div>
    <div class="scanlines absolute inset-0 pointer-events-none"></div>
    <div class="relative p-4 lg:p-6 flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
      <div class="space-y-1.5 max-w-2xl">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="relative flex w-2 h-2">
            <span class="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping-ring bg-radar"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-radar"></span>
          </span>
          <div class="font-mono text-[10.5px] uppercase tracking-[0.3em] text-radar">${en?f.eyebrowEn:f.eyebrow}</div>
          <span class="chip" style=${{borderColor:'rgba(34,211,238,0.4)', color:'#67e8f9', background:'rgba(34,211,238,0.1)'}}>${en?f.statusEn:f.status}</span>
        </div>
        <h3 class="font-display font-bold text-[20px] lg:text-[26px] text-slate-50 leading-tight glow-text">${en?f.titleEn:f.title} <span class="text-radar">· ${en?f.subtitleEn:f.subtitle}</span></h3>
        <p class="text-[13px] text-slate-300">${en?f.summaryEn:f.summary}</p>
      </div>
      <div class="shrink-0 flex items-center gap-4">
        ${f.cover ? html`
        <img src=${f.cover} alt=${f.coverAlt} loading="lazy" decoding="async"
          class="hidden sm:block w-[54px] rounded border border-radar/30 shadow-glow aspect-[9/16] object-cover" />` : ''}
        <button onClick=${onOpen}
          class="inline-flex items-center gap-2 px-4 py-2.5 rounded border border-radar/40 text-radar text-[12px] font-mono uppercase tracking-widest hover:bg-radar/10 hover:shadow-glow transition">
          ▶ ${en?'Open brief':'Abrir ficha'}
        </button>
      </div>
    </div>
  </section>`;
}

function FichaEditorial({ lang }) {
  const en = lang === 'EN';
  const f = FICHA_VENTAJA;
  const date = new Date().toLocaleDateString(en?'en-GB':'es-ES', { day:'2-digit', month:'long', year:'numeric' });
  const dColor = (id) => id==='hipotesis' ? '#f59e0b' : (id==='evaluacion' ? '#22d3ee' : '#10b981');
  return html`
  <section class="space-y-4">
    <!-- Hero -->
    <div class="relative panel rounded-lg overflow-hidden border border-radar/20">
      <span class="corner-tl"></span><span class="corner-tr"></span>
      <span class="corner-bl"></span><span class="corner-br"></span>
      <div class="boot-grid absolute inset-0 opacity-30 pointer-events-none"></div>
      <div class="scanlines absolute inset-0 pointer-events-none"></div>
      <div class="relative p-5 lg:p-7 flex flex-col lg:flex-row lg:items-start gap-5 lg:gap-7">
        <div class="min-w-0 flex-1 order-2 lg:order-1">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="relative flex w-2 h-2">
              <span class="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping-ring bg-radar"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-radar"></span>
            </span>
            <div class="font-mono text-[10.5px] uppercase tracking-[0.3em] text-radar">${en?f.eyebrowEn:f.eyebrow}</div>
            <span class="chip" style=${{borderColor:'rgba(34,211,238,0.4)', color:'#67e8f9', background:'rgba(34,211,238,0.1)'}}>${en?f.statusEn:f.status}</span>
          </div>
          <div class="text-[10px] font-mono uppercase tracking-widest text-slate-500">SITUATION ROOM · ${date}</div>
        </div>
        <div class="font-mono text-[10.5px] uppercase tracking-[0.25em] text-slate-500 mt-3">${en?f.categoryLabelEn:f.categoryLabel}</div>
        <h2 class="font-display font-bold text-[28px] lg:text-[38px] text-slate-50 leading-tight mt-1 glow-text">${en?f.titleEn:f.title}</h2>
        <p class="font-display font-semibold text-[16px] lg:text-[20px] text-radar leading-snug mt-1">${en?f.subtitleEn:f.subtitle}</p>
        <p class="text-[14px] lg:text-[15px] text-slate-200 leading-relaxed mt-3 max-w-3xl">${en?f.summaryEn:f.summary}</p>
        <p class="text-[12.5px] text-alert-soft font-mono uppercase tracking-widest mt-2">${en?f.notNewsEn:f.notNews}</p>
        <div class="flex flex-wrap gap-1.5 mt-4">
          ${f.vectors.map(v => html`<span key=${v} class="chip" style=${{borderColor:'rgba(34,211,238,0.35)'}}>${v}</span>`)}
        </div>
        <div class="mt-4 flex flex-wrap items-center gap-3">
          <a href=${f.sourceUrl} target="_blank" rel="noopener"
            class="inline-flex items-center gap-2 px-3.5 py-2 rounded border border-radar/40 text-radar text-[12px] font-mono uppercase tracking-widest hover:bg-radar/10 hover:shadow-glow transition">
            ${en?'Read source at Global Strategy':'Leer fuente en Global Strategy'} ↗
          </a>
          <span class="text-[11px] font-mono uppercase tracking-wider text-slate-500">${en?'Source':'Fuente'}: ${f.source} · ${f.sourceDate}</span>
        </div>
        </div>
        ${f.cover ? html`
        <figure class="order-1 lg:order-2 w-full max-w-[190px] sm:max-w-[220px] mx-auto lg:mx-0 shrink-0">
          <div class="relative rounded-md overflow-hidden border border-radar/30 shadow-glow bg-black/40">
            <span class="corner-tl"></span><span class="corner-tr"></span>
            <span class="corner-bl"></span><span class="corner-br"></span>
            <img src=${f.cover} alt=${f.coverAlt} loading="lazy" decoding="async"
              class="block w-full h-auto aspect-[9/16] object-cover" />
            <div class="scanlines absolute inset-0 pointer-events-none opacity-40"></div>
          </div>
          <figcaption class="mt-1.5 text-[9.5px] font-mono uppercase tracking-widest text-slate-500 text-center">${en?'Cover · 9:16':'Portada · 9:16'}</figcaption>
        </figure>` : ''}
      </div>
    </div>

    <!-- Hecho · Evaluación · Hipótesis -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
      ${f.doctrine.map(d => html`
        <article key=${d.id} class="relative panel-soft rounded-md p-4 lg:p-5 border flex flex-col" style=${{borderColor:`${dColor(d.id)}44`}}>
          <span class="corner-tl"></span><span class="corner-br"></span>
          <span class="chip self-start" style=${{borderColor:`${dColor(d.id)}66`, color:dColor(d.id), background:`${dColor(d.id)}12`}}>${en?d.labelEn:d.label}</span>
          <p class="text-[13px] text-slate-300 leading-relaxed mt-3">${en?d.bodyEn:d.body}</p>
        </article>`)}
    </div>

    <!-- Análisis en vídeo (YouTube) -->
    ${f.youtube ? html`
    <div class="relative panel rounded-md p-4 lg:p-6 border border-radar/20">
      <span class="corner-tl"></span><span class="corner-tr"></span>
      <span class="corner-bl"></span><span class="corner-br"></span>
      <div class="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div class="heading-mono">${en?'Video analysis':'Análisis en vídeo'}</div>
        <a href=${f.youtube.url} target="_blank" rel="noopener"
           class="text-[10px] font-mono uppercase tracking-widest text-radar hover:text-radar-glow transition">YouTube ↗</a>
      </div>
      <div class="max-w-3xl mx-auto">
        <${YouTubeEmbed} id=${f.youtube.id} title=${`${en?f.titleEn:f.title} · ${en?f.subtitleEn:f.subtitle}`}/>
        <a href=${f.youtube.url} target="_blank" rel="noopener"
          class="mt-3 inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded border border-radar/40 text-radar text-[12px] font-mono uppercase tracking-widest hover:bg-radar/10 hover:shadow-glow transition w-full lg:w-auto">
          ▶ ${en?(f.youtube.labelEn||'Watch on YouTube'):(f.youtube.label||'Ver en YouTube')}
        </a>
      </div>
    </div>` : ''}

    <!-- Descripción bilingüe (Shorts / paquete de publicación) -->
    ${(f.longDescription && f.longDescriptionEn) ? html`
    <div class="relative panel rounded-md p-4 lg:p-6 border border-radar/15">
      <span class="corner-tl"></span><span class="corner-tr"></span>
      <span class="corner-bl"></span><span class="corner-br"></span>
      <div class="heading-mono mb-4">${en?'Full description · ES / EN':'Descripción completa · ES / EN'}</div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8">
        ${[{ code:'ES', label:'Español', body:f.longDescription }, { code:'EN', label:'English', body:f.longDescriptionEn }].map(col => html`
          <div key=${col.code} class="space-y-3">
            <div class="text-[10px] font-mono uppercase tracking-[0.3em] text-radar/80">${col.code} · ${col.label}</div>
            ${col.body.map((p, i) => (i === 2)
              ? html`<p key=${i} class="text-[12.5px] lg:text-[13px] font-mono uppercase tracking-wide text-radar leading-relaxed">${p}</p>`
              : html`<p key=${i} class="text-[13px] lg:text-[14px] text-slate-300 leading-relaxed">${p}</p>`)}
          </div>`)}
      </div>
    </div>` : ''}

    <!-- Siete dimensiones de la ventaja estratégica -->
    <div class="relative panel rounded-md p-4 lg:p-6 border border-radar/20">
      <span class="corner-tl"></span><span class="corner-tr"></span>
      <span class="corner-bl"></span><span class="corner-br"></span>
      <div class="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div class="heading-mono">${en?'Seven dimensions of strategic advantage':'Siete dimensiones de la ventaja estratégica'}</div>
        <div class="text-[10px] font-mono uppercase tracking-widest text-slate-500">${en?'Learn · Produce · Regenerate':'Aprender · Producir · Regenerar'}</div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        ${f.dimensions.map(dm => html`
          <div key=${dm.n} class="relative panel-soft rounded-md p-4 border border-white/5 flex flex-col">
            <span class="corner-tl"></span>
            <div class="flex items-center gap-2">
              <span class="font-mono text-[13px] font-bold text-radar">${String(dm.n).padStart(2,'0')}</span>
              <h4 class="font-display font-semibold text-[15px] lg:text-[16px] text-slate-100 leading-tight">${en?dm.keyEn:dm.key}</h4>
            </div>
            <p class="text-[12px] text-slate-400 leading-snug mt-2">${en?dm.descEn:dm.desc}</p>
          </div>`)}
      </div>
    </div>

    <!-- Línea editorial + tripolaridad -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2 relative panel rounded-md p-5 lg:p-6 flex flex-col justify-center border border-alert/20">
        <span class="corner-tl"></span><span class="corner-br"></span>
        <div class="heading-mono mb-2">${en?'GEOPÓLEM editorial line':'Frase editorial GEOPÓLEM'}</div>
        <p class="font-display font-semibold text-[19px] lg:text-[23px] text-slate-100 leading-snug glow-text">“${en?f.editorialLineEn:f.editorialLine}”</p>
      </div>
      <div class="relative panel rounded-md p-4 flex flex-col justify-center border border-radar/20">
        <span class="corner-tl"></span><span class="corner-br"></span>
        <div class="heading-mono mb-3">${en?'Tripolarity':'Tripolaridad'}</div>
        <div class="flex flex-wrap gap-1.5">
          ${f.tripolarity.map(a => html`<span key=${a} class="chip" style=${{borderColor:'rgba(34,211,238,0.4)', color:'#67e8f9'}}>${a}</span>`)}
        </div>
        <p class="text-[12.5px] font-mono uppercase tracking-wider text-alert-soft mt-3">${en?f.tripolarityCenterEn:f.tripolarityCenter}</p>
        <p class="text-[11px] font-mono uppercase tracking-widest text-slate-500 mt-4">${f.close}</p>
      </div>
    </div>
  </section>`;
}

/* ========================================================================
   GEOPÓLEM Intelligence Products — posicionamiento comercial (sin pagos)
   Arquitectura pública en 5 líneas. CTAs no invasivas: mailto o anchor
   interno al mapa. No introduce checkout, membresía ni autenticación.
   ======================================================================== */
const GEOP_CONTACT = 'contacto@geopolem.com';
const mailtoCta = (subject) => `mailto:${GEOP_CONTACT}?subject=${encodeURIComponent(subject)}`;

const INTEL_PRODUCTS = [
  {
    id: 'reports', code: '01',
    title: 'Intelligence Reports',
    desc: 'Informes premium: Venezuela, energía, conflictos, poder, riesgo político y escenarios.',
    descEn: 'Premium reports: Venezuela, energy, conflicts, power, political risk and scenarios.',
    cta: 'Solicitar informe', ctaEn: 'Request report',
    action: { type: 'mail', subject: 'GEOPÓLEM · Solicitud de informe' },
    tone: 'text-alert border-alert/30',
  },
  {
    id: 'briefings', code: '02',
    title: 'Strategic Briefings',
    desc: 'Sesiones privadas de análisis para empresas, inversores, periodistas, académicos o instituciones.',
    descEn: 'Private analysis sessions for companies, investors, journalists, academics or institutions.',
    cta: 'Reservar briefing', ctaEn: 'Book briefing',
    action: { type: 'mail', subject: 'GEOPÓLEM · Reserva de briefing estratégico' },
    tone: 'text-risk border-risk/30',
  },
  {
    id: 'courses', code: '03',
    title: 'Webinars & Courses',
    desc: 'Formación sobre geopolítica, energía, OSINT, análisis de riesgo, escenarios, FODA/SWOT y PESTEL.',
    descEn: 'Training on geopolitics, energy, OSINT, risk analysis, scenarios, SWOT and PESTEL.',
    cta: 'Ver cursos/webinars', ctaEn: 'View courses/webinars',
    action: { type: 'mail', subject: 'GEOPÓLEM · Cursos y webinars' },
    tone: 'text-intel border-intel/30',
  },
  {
    id: 'maps', code: '04',
    title: 'Maps & Actor Networks',
    desc: 'Mapas de poder, actores, rutas energéticas, conflictos, chokepoints y redes de influencia.',
    descEn: 'Power maps, actors, energy routes, conflicts, chokepoints and influence networks.',
    cta: 'Explorar mapas', ctaEn: 'Explore maps',
    action: { type: 'map' },
    tone: 'text-radar border-radar/30',
  },
  {
    id: 'insights', code: '05',
    title: 'GEOPÓLEM Insights',
    desc: 'Contenido para Instagram, LinkedIn, YouTube y newsletter.',
    descEn: 'Content for Instagram, LinkedIn, YouTube and newsletter.',
    cta: 'Contactar', ctaEn: 'Contact',
    action: { type: 'mail', subject: 'GEOPÓLEM · Insights y contenidos' },
    tone: 'text-radar border-radar/30',
  },
];

/* ------------------------------------------------------------------
   OSINT geopolítico legal — serie de 10 reels (4 semanas).
   Fuente editorial: calendario_reels_osint_geopolem_4_semanas.md
   Mensaje central: OSINT no es hackear. Es saber leer fuentes abiertas
   con método. Contenido de marca, sin pagos ni servicios externos.
   ------------------------------------------------------------------ */
const OSINT_REELS_MESSAGE = 'OSINT no es hackear. Es saber leer fuentes abiertas con método.';
const OSINT_REELS = [
  {
    id: 'osint-01', n: 1, week: 'Semana 1 · Fundamentos', code: 'R01',
    title: 'OSINT no es hackear',
    hook: 'OSINT no es hackear.',
    screen: 'NO NECESITAS HACKEAR. NECESITAS MÉTODO.',
    synthesis: 'OSINT no es entrar en sistemas privados: es analizar fuentes abiertas con método —discursos, mapas, empresas, sanciones, rutas, contratos y datos públicos—. La inteligencia empieza cuando conectas señales dispersas.',
    cta: 'Aprende OSINT geopolítico legal con GEOPÓLEM.',
    tone: 'text-radar border-radar/30',
  },
  {
    id: 'osint-02', n: 2, week: 'Semana 1 · Fundamentos', code: 'R02',
    title: 'El poder deja rastros',
    hook: 'El poder deja rastros.',
    screen: 'EL PODER NO SIEMPRE SE ESCONDE. A VECES SOLO HAY QUE SABER MIRAR.',
    synthesis: 'Los actores de poder dejan rastros en empresas, viajes, contratos, discursos, sanciones, alianzas y rutas críticas. La clave no es mirar más información, sino saber qué señales importan y cómo se conectan.',
    cta: 'Guarda este video para aprender a leer redes de poder.',
    tone: 'text-radar border-radar/30',
  },
  {
    id: 'osint-03', n: 3, week: 'Semana 2 · Método GEOPÓLEM', code: 'R03',
    title: 'No confundas dato con inteligencia',
    hook: 'Un dato no es inteligencia.',
    screen: 'DATO ≠ INTELIGENCIA',
    synthesis: 'Un dato aislado puede ser ruido. La inteligencia aparece cuando validas la fuente, entiendes el contexto, conectas actores y construyes escenarios. GEOPÓLEM no acumula datos: interpreta estructuras.',
    cta: 'Comenta “INTELIGENCIA” para más contenido sobre método.',
    tone: 'text-intel border-intel/30',
  },
  {
    id: 'osint-04', n: 4, week: 'Semana 2 · Método GEOPÓLEM', code: 'R04',
    title: 'Cómo leer una red de actores',
    hook: 'Para entender una crisis, mira la red.',
    screen: 'QUIÉN DECIDE. QUIÉN FINANCIA. QUIÉN EJECUTA. QUIÉN SE BENEFICIA.',
    synthesis: 'Una red de actores no se entiende solo por nombres. Hay que mirar funciones: quién decide, quién financia, quién ejecuta, quién intermedia y quién se beneficia. Ahí empieza el análisis de poder.',
    cta: 'Sígueme para aprender a mapear actores con GEOPÓLEM.',
    tone: 'text-intel border-intel/30',
  },
  {
    id: 'osint-05', n: 5, week: 'Semana 2 · Método GEOPÓLEM', code: 'R05',
    title: 'Cómo analizar una ruta energética',
    hook: 'La energía también se analiza como poder.',
    screen: 'PUERTOS. OLEODUCTOS. CHOKEPOINTS. RIESGO POLÍTICO.',
    synthesis: 'Una ruta energética no es solo infraestructura: es dependencia, presión, vulnerabilidad y poder. Para analizarla miramos puertos, oleoductos, chokepoints, sanciones, actores estatales y riesgo político.',
    cta: 'Guarda este video si te interesa energía y geopolítica.',
    tone: 'text-risk border-risk/30',
  },
  {
    id: 'osint-06', n: 6, week: 'Semana 3 · Lectura crítica', code: 'R06',
    title: 'La geopolítica no está solo en titulares',
    hook: 'La geopolítica no está solo en los titulares.',
    screen: 'NO MIRES SOLO EL TITULAR. MIRA LA ESTRUCTURA.',
    synthesis: 'Los titulares muestran eventos; GEOPÓLEM mira estructuras: rutas, actores, recursos, capacidades, presión, dependencia y escenarios. La noticia es el síntoma. La estructura es el tablero.',
    cta: 'Comparte este video con alguien que sigue geopolítica.',
    tone: 'text-radar border-radar/30',
  },
  {
    id: 'osint-07', n: 7, week: 'Semana 3 · Lectura crítica', code: 'R07',
    title: 'Qué mirar antes de creer una narrativa',
    hook: 'Antes de creer una narrativa, mira esto.',
    screen: 'FUENTE. INTERÉS. TIMING. REPETICIÓN. CONTRADICCIÓN.',
    synthesis: 'Una narrativa no se evalúa solo por lo que dice, sino por la fuente, el interés, el momento, la repetición y las contradicciones. En inteligencia, el contexto importa tanto como el mensaje.',
    cta: 'Sígueme para lectura estratégica de información.',
    tone: 'text-radar border-radar/30',
  },
  {
    id: 'osint-08', n: 8, week: 'Semana 3 · Lectura crítica', code: 'R08',
    title: 'OSINT aplicado a Venezuela',
    hook: 'Venezuela no se entiende solo como crisis.',
    screen: 'PODER. ENERGÍA. REDES. INTERMEDIARIOS. ESCENARIOS.',
    synthesis: 'Para analizar Venezuela hay que mirar más allá de la coyuntura: redes de poder, energía, intermediarios, sanciones, actores externos y escenarios. Eso es OSINT geopolítico aplicado.',
    cta: 'Escríbenos por DM si quieres conocer nuestros dossiers.',
    tone: 'text-alert border-alert/30',
  },
  {
    id: 'osint-09', n: 9, week: 'Semana 4 · Conversión y marca', code: 'R09',
    title: 'Mapa mental de una crisis',
    hook: 'Así se ordena una crisis.',
    screen: 'EVENTO → ACTORES → INTERESES → RECURSOS → RUTAS → ESCENARIOS',
    synthesis: 'Cuando ocurre una crisis, no empieces por opinar. Ordena el tablero: evento, actores, intereses, recursos, rutas críticas y escenarios. Ese mapa mental convierte ruido en análisis.',
    cta: 'Guarda esta estructura para tu próximo análisis.',
    tone: 'text-intel border-intel/30',
  },
  {
    id: 'osint-10', n: 10, week: 'Semana 4 · Conversión y marca', code: 'R10',
    title: 'Cómo piensa GEOPÓLEM',
    hook: 'Así piensa GEOPÓLEM.',
    screen: 'NO SEGUIMOS TITULARES. INTERPRETAMOS ESTRUCTURAS.',
    synthesis: 'GEOPÓLEM analiza poder, energía, conflictos, actores y escenarios con método. No seguimos titulares: leemos estructuras. La inteligencia no está en saber más noticias, sino en entender cómo se mueve el tablero.',
    cta: 'Sígueme y entra al tablero de GEOPÓLEM.',
    tone: 'text-radar border-radar/30',
  },
];

function IntelligenceProducts({ lang, onOpenMap }) {
  const en = lang === 'EN';
  return html`
  <section class="relative panel rounded-lg overflow-hidden border border-radar/20">
    <span class="corner-tl"></span><span class="corner-tr"></span>
    <span class="corner-bl"></span><span class="corner-br"></span>
    <div class="boot-grid absolute inset-0 opacity-20 pointer-events-none"></div>
    <div class="scanlines absolute inset-0 pointer-events-none"></div>
    <div class="relative p-4 lg:p-6 space-y-5">
      <div class="max-w-3xl space-y-2">
        <div class="flex items-center gap-2">
          <span class="relative flex w-2 h-2">
            <span class="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping-ring bg-radar"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-radar"></span>
          </span>
          <div class="font-mono text-[10.5px] uppercase tracking-[0.3em] text-radar">${en?'What is GEOPÓLEM · Intelligence Products':'Qué es GEOPÓLEM · Intelligence Products'}</div>
        </div>
        <h2 class="font-display font-bold text-[22px] lg:text-[28px] text-slate-50 leading-tight glow-text">
          ${en
            ? 'A geopolitical intelligence platform to understand the international system, anticipate scenarios and read the power behind the headlines.'
            : 'Una plataforma de inteligencia geopolítica para entender el sistema internacional, anticipar escenarios y leer el poder detrás de los titulares.'}
        </h2>
        <p class="text-[13px] text-slate-300 leading-relaxed">
          ${en
            ? 'GEOPÓLEM is not only about Venezuela. We analyse the international system, energy, conflicts, power actors, political risk and future scenarios — using OSINT, actor maps, SWOT, PESTEL, risk matrices and prospective analysis.'
            : 'GEOPÓLEM no se centra solo en Venezuela. Analizamos el sistema internacional, energía, conflictos, actores de poder, riesgo político y escenarios futuros — con OSINT, mapas de actores, FODA/SWOT, PESTEL, matrices de riesgo y análisis prospectivo.'}
        </p>
        <p class="text-[12.5px] text-alert-soft font-mono uppercase tracking-widest">
          ${en?'We don’t follow headlines. We interpret structures. · Welcome to the board.':'No seguimos titulares. Interpretamos estructuras. · Bienvenidos al tablero.'}
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        ${INTEL_PRODUCTS.map(p => {
          const isMap = p.action.type === 'map';
          const label = en ? p.ctaEn : p.cta;
          const inner = html`
            <span class="corner-tl"></span><span class="corner-br"></span>
            <div class="flex items-center justify-between gap-2">
              <span class="font-mono text-[10.5px] uppercase tracking-[0.25em] text-slate-500">GEOP · ${p.code}</span>
            </div>
            <h3 class="font-display font-bold text-[17px] lg:text-[18px] text-slate-50 mt-2 leading-tight">${p.title}</h3>
            <p class="text-[12.5px] text-slate-400 leading-relaxed mt-2 flex-1">${en?p.descEn:p.desc}</p>
            <span class=${clsx('mt-4 inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded border text-[12px] font-mono uppercase tracking-widest transition w-full hover:shadow-glow hover:bg-white/5', p.tone)}>
              ${isMap ? '▶ ' : '✉ '}${label}${isMap?' →':' ↗'}
            </span>`;
          const cardClass = clsx('relative panel-soft rounded-md p-4 border flex flex-col text-left cursor-pointer', p.tone);
          return isMap
            ? html`<button key=${p.id} type="button" onClick=${onOpenMap} class=${cardClass}>${inner}</button>`
            : html`<a key=${p.id} href=${mailtoCta(p.action.subject)} class=${clsx(cardClass, 'no-underline')}>${inner}</a>`;
        })}
      </div>
    </div>
  </section>`;
}

function OsintReelsTeaser({ lang, onOpen }) {
  const en = lang === 'EN';
  return html`
  <section class="relative panel rounded-lg overflow-hidden border border-radar/20">
    <span class="corner-tl"></span><span class="corner-tr"></span>
    <span class="corner-bl"></span><span class="corner-br"></span>
    <div class="boot-grid absolute inset-0 opacity-25 pointer-events-none"></div>
    <div class="relative p-4 lg:p-6 flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
      <div class="space-y-1.5 max-w-2xl">
        <div class="font-mono text-[10.5px] uppercase tracking-[0.3em] text-radar">${en?'OSINT geopolitical intelligence · Series':'OSINT geopolítico legal · Serie'}</div>
        <h3 class="font-display font-bold text-[20px] lg:text-[24px] text-slate-50 leading-tight glow-text">OSINT Geopolítico</h3>
        <p class="text-[13px] text-slate-300 leading-relaxed">${OSINT_REELS_MESSAGE}</p>
        <p class="text-[11.5px] text-slate-500 font-mono uppercase tracking-widest">${en?'10 pieces · 4 weeks':'10 piezas · 4 semanas'}</p>
      </div>
      <button onClick=${onOpen}
        class="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded border border-radar/40 text-radar text-[12px] font-mono uppercase tracking-widest hover:bg-radar/10 hover:shadow-glow transition">
        ▣ ${en?'Open OSINT series':'Abrir serie OSINT'}
      </button>
    </div>
  </section>`;
}

function OsintReels({ lang }) {
  const en = lang === 'EN';
  const date = new Date().toLocaleDateString(en?'en-GB':'es-ES', { day:'2-digit', month:'long', year:'numeric' });
  return html`
  <section class="space-y-4">
    <!-- Hero -->
    <div class="relative panel rounded-lg overflow-hidden border border-radar/20">
      <span class="corner-tl"></span><span class="corner-tr"></span>
      <span class="corner-bl"></span><span class="corner-br"></span>
      <div class="boot-grid absolute inset-0 opacity-30 pointer-events-none"></div>
      <div class="scanlines absolute inset-0 pointer-events-none"></div>
      <div class="relative p-5 lg:p-7">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <span class="relative flex w-2 h-2">
              <span class="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping-ring bg-radar"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-radar"></span>
            </span>
            <div class="font-mono text-[10.5px] uppercase tracking-[0.3em] text-radar">${en?'OSINT geopolitical intelligence · Legal':'OSINT geopolítico legal'}</div>
          </div>
          <div class="text-[10px] font-mono uppercase tracking-widest text-slate-500">SITUATION ROOM · ${date}</div>
        </div>
        <h2 class="font-display font-bold text-[26px] lg:text-[34px] text-slate-50 leading-tight mt-2 glow-text">OSINT Geopolítico</h2>
        <p class="font-display font-semibold text-[16px] lg:text-[19px] text-radar-glow leading-snug mt-3 max-w-3xl">${OSINT_REELS_MESSAGE}</p>
        <p class="text-[13px] text-slate-300 leading-relaxed mt-3 max-w-3xl">
          ${en
            ? 'A brand series that positions GEOPÓLEM as serious open-source geopolitical intelligence: power, energy, conflicts, actors and scenarios read with method and ethics. No hacking, no doxxing, no private access.'
            : 'Una serie de marca que posiciona a GEOPÓLEM como inteligencia geopolítica seria basada en fuentes abiertas: poder, energía, conflictos, actores y escenarios leídos con método y ética. Sin hackeo, sin doxxing, sin acceso a información privada.'}
        </p>
        <p class="text-[11.5px] text-slate-500 font-mono uppercase tracking-widest mt-3">${en?'10 pieces · 4 weeks':'10 piezas · 4 semanas'}</p>
      </div>
    </div>

    <!-- Reel cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      ${OSINT_REELS.map(r => html`
        <article key=${r.id} class=${clsx('relative panel-soft rounded-md p-4 border flex flex-col text-left', r.tone)}>
          <span class="corner-tl"></span><span class="corner-br"></span>
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <span class="font-mono text-[10.5px] uppercase tracking-[0.25em] text-slate-500">GEOP · ${r.code}</span>
            <span class="chip">${r.week}</span>
          </div>
          <h3 class="font-display font-bold text-[17px] lg:text-[18px] text-slate-50 mt-2 leading-tight">${r.title}</h3>
          <p class="text-[12.5px] text-radar-glow font-medium leading-snug mt-2">“${r.hook}”</p>
          <div class="mt-3 panel-soft rounded px-3 py-2 border border-white/5">
            <div class="heading-mono mb-1">${en?'On screen':'En pantalla'}</div>
            <p class="font-mono text-[11.5px] text-slate-200 leading-snug tracking-wide">${r.screen}</p>
          </div>
          <p class="text-[12.5px] text-slate-400 leading-relaxed mt-3 flex-1">${r.synthesis}</p>
          <div class="mt-4 flex items-start gap-2 text-[11.5px] text-slate-300">
            <span class="font-mono uppercase tracking-widest text-radar shrink-0">CTA</span>
            <span class="leading-snug">${r.cta}</span>
          </div>
        </article>`)}
    </div>

    <!-- Nota ética -->
    <div class="relative panel-soft rounded-md p-4 border border-white/5">
      <div class="heading-mono mb-1">${en?'Ethics note':'Nota ética'}</div>
      <p class="text-[12px] text-slate-400 leading-relaxed">
        ${en
          ? 'This series avoids any language suggesting hacking, personal persecution, doxxing or access to private information. The approach is open-source research, responsible analysis, source validation and strategic reading.'
          : 'Esta serie evita cualquier lenguaje que sugiera hackeo, persecución personal, doxxing o acceso a información privada. El enfoque es investigación con fuentes abiertas, análisis responsable, validación de fuentes y lectura estratégica.'}
      </p>
    </div>
  </section>`;
}

function PlanZ({ lang }) {
  const en = lang === 'EN';
  const p = PLAN_Z;
  const date = new Date().toLocaleDateString(en?'en-GB':'es-ES', { day:'2-digit', month:'long', year:'numeric' });
  return html`
  <section class="space-y-4">
    <!-- Hero -->
    <div class="relative panel rounded-lg overflow-hidden border border-alert/20">
      <span class="corner-tl"></span><span class="corner-tr"></span>
      <span class="corner-bl"></span><span class="corner-br"></span>
      <div class="boot-grid absolute inset-0 opacity-30 pointer-events-none"></div>
      <div class="scanlines absolute inset-0 pointer-events-none"></div>
      <div class="relative p-5 lg:p-7">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <span class="relative flex w-2 h-2">
              <span class="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping-ring bg-alert"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-alert"></span>
            </span>
            <div class="font-mono text-[10.5px] uppercase tracking-[0.3em] text-alert-soft">${en?p.eyebrowEn:p.eyebrow} · <span class="text-slate-500">${en?p.eyebrow:p.eyebrowEn}</span></div>
          </div>
          <div class="text-[10px] font-mono uppercase tracking-widest text-slate-500">SITUATION ROOM · ${date}</div>
        </div>
        <h2 class="font-display font-bold text-[28px] lg:text-[38px] text-slate-50 leading-tight mt-2 glow-text">
          ${p.title} <span class="text-alert-soft">${en?p.subtitleEn:p.subtitle}</span>
        </h2>
        <p class="text-[14px] lg:text-[15px] text-slate-200 leading-relaxed mt-3 max-w-3xl">${en?p.summaryEn:p.summary}</p>
        <p class="text-[12.5px] text-radar font-mono uppercase tracking-widest mt-2">${en?p.notNewsEn:p.notNews}</p>
        <div class="flex flex-wrap gap-1.5 mt-4">
          ${p.vectors.map(v => html`<span key=${v} class="chip" style=${{borderColor:'rgba(239,68,68,0.35)'}}>${v}</span>`)}
        </div>
      </div>
    </div>

    <!-- Entregas de la serie · orden de publicación -->
    <div class="relative panel rounded-md p-4 lg:p-6 border border-alert/20">
      <span class="corner-tl"></span><span class="corner-tr"></span>
      <span class="corner-bl"></span><span class="corner-br"></span>
      <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div class="heading-mono">${en?'Series releases':'Entregas de la serie'}</div>
        <div class="text-[10px] font-mono uppercase tracking-widest text-slate-500">${en?'Publication order':'Orden de publicación'}</div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
        ${p.entregas.filter(e=>e.published||e.featured).map(e => html`
          <article key=${e.n} class="relative panel-soft rounded-md p-4 lg:p-5 border border-alert/20 flex flex-col">
            <span class="corner-tl"></span><span class="corner-br"></span>
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <span class="font-mono text-[10.5px] uppercase tracking-[0.25em] text-alert-soft">${e.seriesLabel}</span>
              <span class="chip" style=${e.published
                ? {borderColor:'rgba(16,185,129,0.4)', color:'#6ee7b7', background:'rgba(16,185,129,0.1)'}
                : {borderColor:'rgba(245,158,11,0.4)', color:'#fbbf24', background:'rgba(245,158,11,0.1)'}}>${en?e.statusEn:e.status}</span>
            </div>
            <h4 class="font-display font-bold text-[20px] lg:text-[24px] text-slate-50 leading-tight mt-2 glow-text">${en?(e.titleEn||e.title):e.title}</h4>
            <p class="text-[13px] text-slate-300 leading-relaxed mt-2">${en?(e.descriptionEn||e.description):e.description}</p>
            <div class="flex flex-wrap gap-1.5 mt-3">
              ${e.doctrine.map(id => { const d = p.doctrine.find(x=>x.id===id) || {label:id,labelEn:id}; return html`<span key=${id} class="chip" style=${{borderColor:'rgba(34,211,238,0.4)', color:'#67e8f9'}}>${en?d.labelEn:d.label}</span>`; })}
            </div>
            ${(e.chips&&e.chips.length) ? html`
            <div class="flex flex-wrap gap-1.5 mt-2">
              ${(en?(e.chipsEn||e.chips):e.chips).map(c => html`<span key=${c} class="chip">${c}</span>`)}
            </div>` : ''}
            ${e.published && e.youtube ? html`
            <a href=${e.youtube} target="_blank" rel="noopener"
              class="mt-4 inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded border border-alert/40 text-alert-soft text-[12px] font-mono uppercase tracking-widest hover:bg-alert/10 hover:shadow-glow transition w-full lg:w-auto">
              ▶ ${en?(e.ctaEn||e.cta):e.cta} ↗
            </a>` : html`
            <div class="mt-4 inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded border border-radar/30 text-radar text-[12px] font-mono uppercase tracking-widest w-full lg:w-auto cursor-default">
              ◷ ${en?(e.ctaEn||e.cta):e.cta}
            </div>`}
          </article>`)}
      </div>
      ${p.entregas.filter(e=>!e.published&&!e.featured).slice(0,1).map(e => html`
        <div key=${e.n} class="relative panel-soft rounded-md p-4 border border-white/5 flex flex-col justify-center mt-3">
          <div class="heading-mono mb-1">${en?'Next release':'Siguiente entrega'}</div>
          <div class="font-mono text-[10.5px] uppercase tracking-[0.25em] text-slate-400">${e.seriesLabel}</div>
          <h4 class="font-display font-semibold text-[16px] lg:text-[18px] text-slate-200 leading-tight mt-1">${en?(e.titleEn||e.title):e.title}</h4>
          <span class="chip mt-3 self-start">${en?e.statusEn:e.status}</span>
        </div>`)}
    </div>

    <!-- Documental + pregunta analítica -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2 panel rounded-md p-4">
        <div class="flex items-center justify-between mb-2">
          <div class="heading-mono">${en?'Full documentary':'Documental completo'} · ${p.youtube.duration}</div>
          <a href=${p.youtube.url} target="_blank" rel="noopener"
             class="text-[10px] font-mono uppercase tracking-widest text-radar hover:text-radar-glow transition">YouTube ↗</a>
        </div>
        <${YouTubeEmbed} id=${p.youtube.id} title=${p.fullTitle}/>
        <a href=${p.youtube.url} target="_blank" rel="noopener"
          class="mt-3 inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded border border-alert/40 text-alert-soft text-[12px] font-mono uppercase tracking-widest hover:bg-alert/10 hover:shadow-glow transition w-full lg:w-auto">
          ▶ ${en?'Watch full documentary on YouTube':'Ver documental completo en YouTube'}
        </a>
      </div>
      <div class="relative panel rounded-md p-4 flex flex-col justify-center border border-alert/20">
        <span class="corner-tl"></span><span class="corner-br"></span>
        <div class="heading-mono mb-2">${en?'Core question':'Pregunta central'}</div>
        <p class="font-display font-semibold text-[19px] lg:text-[21px] text-slate-100 leading-snug">${en?p.questionEn:p.question}</p>
        <p class="text-[11.5px] font-mono uppercase tracking-wider text-slate-500 mt-3">${p.questionContext}</p>
      </div>
    </div>

    <!-- Disciplinas de inteligencia + doctrina editorial -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="panel rounded-md p-4">
        <div class="heading-mono mb-3">${en?'Intelligence disciplines':'Disciplinas de inteligencia'}</div>
        <div class="grid grid-cols-2 gap-2.5">
          ${p.methods.map(m => html`
            <div key=${m.id} class="panel-soft rounded-md p-3 border" style=${{borderColor:`${m.accent}44`}}>
              <div class="font-mono font-semibold text-[13px] tracking-widest" style=${{color:m.accent}}>${m.label}</div>
              <div class="text-[11.5px] text-slate-400 mt-1 leading-snug">${en?m.descEn:m.desc}</div>
            </div>`)}
        </div>
      </div>
      <div class="panel rounded-md p-4">
        <div class="heading-mono mb-3">${en?'Editorial method':'Método editorial'}</div>
        <div class="flex flex-wrap gap-2 mb-3">
          ${p.doctrine.map(d => html`<span key=${d.id} class="chip" style=${{borderColor:'rgba(34,211,238,0.4)', color:'#67e8f9'}}>${en?d.labelEn:d.label}</span>`)}
        </div>
        <div class="space-y-2">
          ${p.doctrine.map(d => html`
            <div key=${d.id} class="flex gap-2 text-[12.5px] leading-snug">
              <span class="font-mono uppercase tracking-wider text-radar shrink-0 w-24">${en?d.labelEn:d.label}</span>
              <span class="text-slate-400">${en?d.descEn:d.desc}</span>
            </div>`)}
        </div>
      </div>
    </div>

    <!-- Mapa de serie · orden narrativo -->
    <div class="relative panel rounded-md p-4 lg:p-5 border border-radar/20">
      <span class="corner-tl"></span><span class="corner-br"></span>
      <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div class="heading-mono">${en?'Series map · narrative order':'Mapa de serie · orden narrativo'}</div>
        <div class="text-[10px] font-mono uppercase tracking-widest text-slate-500">${en?'Do not mix narratives':'No mezclar narrativas'}</div>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        ${p.seriesMap.map((s,i) => html`
          <div key=${s.step} class="panel-soft rounded-md p-3 border border-white/5 relative">
            <div class="flex items-center gap-2">
              <span class="font-mono text-[11px] font-bold text-alert-soft">${s.step}</span>
              <span class="font-display font-semibold text-[12.5px] text-slate-100 leading-tight">${s.key}</span>
            </div>
            <div class="text-[11px] text-slate-400 mt-1 leading-snug">${s.note}</div>
            ${i < p.seriesMap.length-1 ? html`<span class="hidden lg:block absolute -right-1.5 top-1/2 text-radar/50 text-xs">→</span>` : ''}
          </div>`)}
      </div>
    </div>

    <!-- Actos de la serie -->
    <div class="relative panel rounded-md p-4 lg:p-6 border border-alert/20">
      <span class="corner-tl"></span><span class="corner-tr"></span>
      <div class="flex items-center justify-between flex-wrap gap-2 mb-1">
        <div class="heading-mono">${en?'Series acts · scripts':'Actos de la serie · guiones'}</div>
        <a href=${p.seriesUrl} target="_blank" rel="noopener"
           class="text-[10px] font-mono uppercase tracking-widest text-radar hover:text-radar-glow transition">YouTube ↗</a>
      </div>
      <p class="text-[13px] text-slate-300 max-w-3xl mb-4">${en
        ? 'Each act is a chapter of the intelligence reading. Fact · Assessment · Hypothesis. Hypotheses are flagged as such, never presented as proven facts.'
        : 'Cada acto es un capítulo de la lectura de inteligencia. Hecho · Evaluación · Hipótesis. Las hipótesis se señalan como tales, nunca se presentan como hechos probados.'}</p>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
        ${p.acts.map(a => {
          const dc = p.doctrine.find(d => d.id === a.doctrine) || p.doctrine[0];
          const isHyp = a.doctrine === 'hipotesis';
          const dColor = isHyp ? '#f59e0b' : (a.doctrine==='evaluacion' ? '#22d3ee' : '#10b981');
          return html`
          <article key=${a.id} class="relative panel-soft rounded-md p-4 border border-alert/15 flex flex-col">
            <span class="corner-tl"></span><span class="corner-br"></span>
            <div class="flex items-center justify-between gap-2">
              <span class="font-mono text-[10px] uppercase tracking-[0.25em] text-alert-soft">${a.num}</span>
              <span class="chip" style=${{borderColor:`${dColor}66`, color:dColor, background:`${dColor}12`}}>${en?dc.labelEn:dc.label}</span>
            </div>
            <h4 class="font-display font-bold text-[18px] lg:text-[20px] text-slate-50 leading-tight mt-1.5">
              ${a.title} <span class="text-slate-400 font-semibold text-[14px] block lg:inline">${a.subtitle}</span>
            </h4>
            <p class="text-[12.5px] text-slate-300 leading-relaxed mt-2">${en?a.thesisEn:a.thesis}</p>
            ${a.disclaimer ? html`
            <div class="mt-2.5 flex items-start gap-2 rounded-md border border-alert/40 bg-alert/10 px-3 py-2">
              <span class="font-mono text-[11px] text-alert-soft shrink-0">⚠</span>
              <p class="text-[11px] text-alert-soft leading-snug font-mono uppercase tracking-wide">${en?a.disclaimerEn:a.disclaimer}</p>
            </div>` : ''}
            <div class="mt-2.5 pl-3 border-l-2" style=${{borderColor:`${dColor}66`}}>
              <div class="font-mono text-[9.5px] uppercase tracking-widest mb-0.5" style=${{color:dColor}}>${en?dc.labelEn:dc.label}</div>
              <p class="text-[12px] text-slate-300 leading-snug italic">${a.claim}</p>
            </div>
            <div class="mt-2.5">
              <div class="heading-mono mb-0.5">${en?'Visual direction':'Dirección visual'}</div>
              <p class="text-[11.5px] text-slate-400 leading-snug">${a.visual}</p>
            </div>
            <div class="flex items-center flex-wrap gap-2 mt-3 pt-3 border-t border-white/5">
              ${a.shortAvailable ? html`<span class="chip" style=${{borderColor:'rgba(34,211,238,0.4)', color:'#67e8f9'}}>Short / Reel · 9:16</span>` : ''}
              <span class="chip">${en?'Short':'Short'}: ${a.shortTitle}</span>
              <a href=${p.seriesUrl} target="_blank" rel="noopener"
                 class="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-alert/40 text-alert-soft text-[11px] font-mono uppercase tracking-widest hover:bg-alert/10 hover:shadow-glow transition">
                ▶ ${en?'Documentary':'Documental'} ↗
              </a>
            </div>
          </article>`;
        })}
      </div>
    </div>

    <!-- Activación social · short 9:16 -->
    <div class="relative panel rounded-md p-4 lg:p-6 border border-radar/20">
      <span class="corner-tl"></span><span class="corner-tr"></span>
      <div class="heading-mono mb-1">${en?'Social activation':'Activación social'}</div>
      <p class="text-[13px] text-slate-300 max-w-3xl">${p.social.caption}</p>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4 items-start">
        <div class="lg:col-span-1">
          <video controls preload="none" playsinline
            poster=${p.social.short.poster}
            class="w-full max-w-[300px] mx-auto lg:mx-0 rounded border border-radar/25 bg-black aspect-[9/16] object-cover">
            <source src=${p.social.short.src} type="video/mp4"/>
          </video>
          <div class="text-center lg:text-left mt-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">${p.social.short.label}</div>
        </div>
        <div class="lg:col-span-2 space-y-3">
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            ${p.social.platforms.map(pl => html`
              <div key=${pl.id} class="panel-soft rounded-md p-3 border" style=${{borderColor:`${pl.accent}44`}}>
                <div class="font-display font-semibold text-[13px] text-slate-100">${pl.label}</div>
                <div class="font-mono text-[9.5px] uppercase tracking-wider text-slate-500 mt-0.5">${pl.desc}</div>
              </div>`)}
          </div>
          <div class="flex flex-wrap gap-2">
            <a href=${p.social.short.src} download
              class="inline-flex items-center gap-2 px-3.5 py-2 rounded border border-radar/40 text-radar text-[11.5px] font-mono uppercase tracking-widest hover:bg-radar/10 transition">
              ⬇ ${en?'Download 30s short':'Descargar short 30s'}
            </a>
            <a href=${p.social.summary.src} download
              class="inline-flex items-center gap-2 px-3.5 py-2 rounded border border-white/15 text-slate-300 text-[11.5px] font-mono uppercase tracking-widest hover:bg-white/5 transition">
              ⬇ ${en?'Download summary reel':'Descargar reel resumen'}
            </a>
            <a href=${p.youtube.url} target="_blank" rel="noopener"
              class="inline-flex items-center gap-2 px-3.5 py-2 rounded border border-alert/40 text-alert-soft text-[11.5px] font-mono uppercase tracking-widest hover:bg-alert/10 transition">
              ▶ YouTube ↗
            </a>
          </div>
          <div class="flex flex-wrap gap-1.5 pt-1">
            ${p.tags.map(tag => html`<span key=${tag} class="chip">#${tag}</span>`)}
          </div>
        </div>
      </div>
    </div>

    <!-- Cierre de marca -->
    <div class="text-center py-2">
      <div class="font-display font-semibold text-[15px] text-alert-soft glow-text tracking-wide">${p.close}</div>
    </div>
  </section>`;
}

/* ========================================================================
   SENTINEL · Brief semanal de inflexiones conflicto-ambiente
   ======================================================================== */
function SentinelStatusChip({ status, accent }) {
  const confirmed = status === 'confirmado';
  return html`
    <span class="chip" style=${{borderColor:`${accent}66`, color: confirmed ? '#fca5a5' : '#67e8f9', background:`${accent}12`}}>
      <span class="w-1.5 h-1.5 rounded-full" style=${{background:accent, boxShadow:`0 0 6px ${accent}`}}></span>
      ${status.toUpperCase()}
    </span>`;
}

function SentinelBrief({ lang }) {
  const en = lang === 'EN';
  const b = SENTINEL_BRIEF;
  return html`
  <section class="space-y-4 lg:space-y-6">
    <!-- Cabecera -->
    <div class="relative panel rounded-md p-5 lg:p-6 overflow-hidden">
      <span class="corner-tl"></span><span class="corner-tr"></span><span class="corner-bl"></span><span class="corner-br"></span>
      <div class="scanlines absolute inset-0"></div>
      <div class="relative">
        <div class="flex items-center gap-2">
          <span class="relative flex w-2 h-2">
            <span class="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping-ring bg-alert"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-alert"></span>
          </span>
          <div class="font-mono text-[10.5px] uppercase tracking-[0.3em] text-alert-soft">${b.eyebrow} · ${en?'WEEKLY BRIEF':'BRIEF SEMANAL'}</div>
        </div>
        <h2 class="font-display font-bold text-[24px] lg:text-[32px] text-slate-50 leading-tight mt-2 glow-text">
          ${en?b.titleEn:b.title}
        </h2>
        <div class="text-[12px] font-mono uppercase tracking-widest text-slate-500 mt-1">${en?b.windowEn:b.window}</div>
        <p class="text-[14px] lg:text-[15px] text-slate-200 leading-relaxed mt-3 max-w-4xl">${en?b.summaryEn:b.summary}</p>
        <p class="text-[12px] text-risk-soft italic leading-relaxed mt-2 max-w-4xl">⚠ ${en?b.caveatEn:b.caveat}</p>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          ${b.stats.map(s => html`
            <div key=${s.label} class="panel-soft rounded p-3 text-center">
              <div class="font-display font-bold text-[22px] text-slate-100">${s.value}</div>
              <div class="font-mono text-[9px] uppercase tracking-wider text-slate-500 mt-0.5">${en?s.labelEn:s.label}</div>
            </div>`)}
        </div>
        <div class="flex flex-wrap gap-1.5 mt-4">
          ${b.tags.map(tag => html`<span key=${tag} class="chip">#${tag}</span>`)}
        </div>
      </div>
    </div>

    <!-- Matriz de puntos de inflexión -->
    <div class="panel rounded-md p-4 overflow-x-auto">
      <div class="heading-mono mb-2">${en?'Inflection matrix':'Matriz de puntos de inflexión'}</div>
      <table class="w-full text-left text-[12px] border-collapse min-w-[720px]">
        <thead>
          <tr class="font-mono text-[9px] uppercase tracking-wider text-slate-500">
            <th class="py-1.5 pr-3 font-normal">${en?'Priority':'Prioridad'}</th>
            <th class="py-1.5 pr-3 font-normal">${en?'Location':'Ubicación'}</th>
            <th class="py-1.5 pr-3 font-normal">${en?'Conflict event':'Conflicto/evento'}</th>
            <th class="py-1.5 pr-3 font-normal">${en?'Environmental pressure':'Presión ambiental'}</th>
            <th class="py-1.5 font-normal">${en?'Coupling type':'Tipo de acople'}</th>
          </tr>
        </thead>
        <tbody>
          ${b.points.map(p => html`
            <tr key=${p.id} class="border-t border-white/5 align-top">
              <td class="py-2 pr-3 font-mono text-[10px] uppercase tracking-wider" style=${{color:p.accent}}>${en?p.priorityEn:p.priority}</td>
              <td class="py-2 pr-3 text-slate-200">${p.location}</td>
              <td class="py-2 pr-3 text-slate-400">${en?p.conflictEventEn:p.conflictEvent}</td>
              <td class="py-2 pr-3 text-slate-400">${en?p.environmentalEventEn:p.environmentalEvent}</td>
              <td class="py-2 text-slate-400">${(en?p.couplingTypeEn:p.couplingType).join(' · ')}</td>
            </tr>`)}
        </tbody>
      </table>
    </div>

    <!-- Tarjetas de puntos de inflexión -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
      ${b.points.map(p => html`
        <article key=${p.id} class=${clsx('relative panel rounded-md p-4 flex flex-col border', p.status==='confirmado' ? 'border-alert/25' : 'border-radar/25')}>
          <span class="corner-tl"></span><span class="corner-br"></span>
          <div class="flex items-center justify-between gap-2 mb-2">
            <${SentinelStatusChip} status=${p.status} accent=${p.accent}/>
            <span class="font-mono text-[9px] uppercase tracking-widest text-slate-500">${en?'PRIORITY':'PRIORIDAD'} ${en?p.priorityEn:p.priority} · ${String(p.rank).padStart(2,'0')}</span>
          </div>
          <div class="text-[10px] font-mono uppercase tracking-wider mt-0.5" style=${{color:p.accent}}>${p.location}</div>
          <h3 class="font-display font-semibold text-[16px] text-slate-100 leading-snug mt-1">${en?p.headlineEn:p.headline}</h3>

          <div class="mt-3 space-y-2.5 text-[12.5px] leading-relaxed">
            <div>
              <div class="heading-mono mb-0.5">${en?'Fact':'Hecho'}</div>
              <p class="text-slate-300">${p.fact}</p>
            </div>
            <div>
              <div class="heading-mono mb-0.5">${en?'Coupling':'Acople'}</div>
              <p class="text-slate-300">${en?p.couplingEn:p.coupling}</p>
            </div>
            <div>
              <div class="heading-mono mb-0.5">${en?'Strategic implication':'Implicación estratégica'}</div>
              <p class="text-slate-300">${p.implication}</p>
            </div>
            <div>
              <div class="heading-mono mb-0.5">${en?'Tri-polar reading':'Lectura tripolar'}</div>
              <p class="text-slate-400 italic">${p.tripolar}</p>
            </div>
          </div>

          <div class="mt-auto pt-3 flex flex-wrap gap-1.5">
            ${p.sources.map(s => html`
              <a key=${s.url} href=${s.url} target="_blank" rel="noopener"
                 class="text-[10px] font-mono uppercase tracking-wider text-radar hover:text-radar-glow transition border border-radar/20 rounded px-1.5 py-0.5">
                ${s.label} ↗
              </a>`)}
          </div>
        </article>`)}
    </div>

    <!-- Línea no seleccionada · Ucrania energía estratégica -->
    <div class="relative panel-soft rounded-md p-4 border border-risk/25">
      <div class="flex items-center gap-2">
        <span class="w-1.5 h-1.5 rounded-full bg-risk" style=${{boxShadow:'0 0 6px #f59e0b'}}></span>
        <div class="heading-mono text-risk-soft">${en?b.notSelected.labelEn:b.notSelected.label} · ${b.notSelected.location}</div>
      </div>
      <p class="text-[12.5px] text-slate-300 leading-relaxed mt-2 max-w-4xl">${b.notSelected.note}</p>
      <a href=${b.notSelected.source.url} target="_blank" rel="noopener"
         class="inline-block mt-2 text-[10px] font-mono uppercase tracking-wider text-radar hover:text-radar-glow transition border border-radar/20 rounded px-1.5 py-0.5">
        ${b.notSelected.source.label} ↗
      </a>
    </div>

    <!-- Mejor candidato para Short -->
    <div class="relative panel rounded-md p-4">
      <span class="corner-tl"></span><span class="corner-br"></span>
      <div class="heading-mono mb-1">${en?'Best short candidate':'Mejor candidato para Short'}</div>
      <h3 class="font-display font-semibold text-[16px] text-slate-100">${b.bestShort.title}</h3>
      <p class="text-[12.5px] text-slate-400 leading-relaxed mt-1.5 max-w-4xl">${b.bestShort.reason}</p>
      <div class="flex flex-wrap gap-2 mt-3">
        <a href=${b.dataUrl} target="_blank" rel="noopener"
           class="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-radar hover:text-radar-glow transition border border-radar/30 rounded px-2 py-1">
          ${en?'Open structured JSON':'Abrir JSON estructurado'} ↗
        </a>
        <a href=${b.archiveUrl} target="_blank" rel="noopener"
           class="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-radar hover:text-radar-glow transition border border-radar/30 rounded px-2 py-1">
          ${en?'Weekly archive JSON':'JSON de archivo semanal'} ↗
        </a>
      </div>
    </div>

    <!-- Cierre de marca -->
    <div class="text-center py-2">
      <div class="font-display font-semibold text-[15px] text-violet-300 glow-text tracking-wide">${b.close}</div>
    </div>
  </section>`;
}

/* ========================================================================
   App root
   ======================================================================== */
function App() {
  const [lang, setLang] = useState('ES');
  const [view, setView] = useState('dashboard');
  const [selectedId, setSelectedId] = useState('ukr-rus');
  const [sitRoom, setSitRoom] = useState(false);
  const [bootComplete, setBootComplete] = useState(false);
  const [customFocos, setCustomFocos] = useState([]);
  // Sprint 1 — capa de adaptador API con respaldo local. `baseFocos` arranca
  // con los datos locales (data.js) y sólo se reemplaza si la API v1 responde.
  const [baseFocos, setBaseFocos] = useState(FOCOS);
  const [dataSource, setDataSource] = useState('local');
  const [auth, setAuth] = useState(null);
  const [authStatus, setAuthStatus] = useState('');
  const [dbStatus, setDbStatus] = useState('standby');
  const [history, setHistory] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [users, setUsers] = useState([]);
  const t = I18N[lang];

  useEffect(() => {
    document.body.classList.toggle('sitroom', sitRoom);
  }, [sitRoom]);

  // Sprint 1 — carga watchlist vía adaptador (API-first con fallback local).
  // Con USE_API=false devuelve FOCOS locales de inmediato; ante error de API,
  // cae al respaldo local sin romper la UI.
  useEffect(() => {
    let cancelled = false;
    loadWatchlistFocos({ localFocos: FOCOS })
      .then(({ focos, source }) => {
        if (cancelled) return;
        if (Array.isArray(focos) && focos.length) setBaseFocos(focos);
        setDataSource(source);
      })
      .catch(() => { if (!cancelled) setDataSource('local'); });
    return () => { cancelled = true; };
  }, []);

  const loadEditorData = async (token = auth?.token) => {
    if (!token) return;
    setDbStatus('sincronizando');
    try {
      const canManageSecurity = (auth?.permissions || []).includes('manage_security');
      const [rows, events, docs, userRows] = await Promise.all([
        apiRequest('/api/focos', { headers: { Authorization: `Bearer ${token}` } }),
        apiRequest('/api/history', { headers: { Authorization: `Bearer ${token}` } }),
        apiRequest('/api/attachments', { headers: { Authorization: `Bearer ${token}` } }),
        canManageSecurity ? apiRequest('/api/users', { headers: { Authorization: `Bearer ${token}` } }) : Promise.resolve([]),
      ]);
      setCustomFocos(Array.isArray(rows) ? rows : []);
      setHistory(Array.isArray(events) ? events : []);
      setAttachments(Array.isArray(docs) ? docs : []);
      setUsers(Array.isArray(userRows) ? userRows : []);
      setDbStatus('online');
    } catch (err) {
      setDbStatus('error');
      setAuthStatus(err.message || 'No se pudieron cargar las fichas.');
    }
  };

  useEffect(() => {
    if (!auth?.token) return;
    let cancelled = false;
    loadEditorData(auth.token).then(() => {
      if (cancelled) return;
    });
    return () => { cancelled = true; };
  }, [auth]);

  const allFocos = useMemo(() => {
    const map = new Map();
    [...baseFocos, ...customFocos].forEach(f => map.set(f.id, f));
    return [...map.values()];
  }, [baseFocos, customFocos]);
  const selectedFoco = allFocos.find(f => f.id === selectedId);
  const openFocoOnMap = (id) => {
    setSelectedId(id);
    setView('map');
  };
  const loginEditor = async ({ user, password }) => {
    setAuthStatus('Verificando credenciales...');
    const session = await apiRequest('/api/login', {
      method: 'POST',
      body: JSON.stringify({ user, password }),
    });
    setAuth(session);
    setAuthStatus('Editor desbloqueado.');
    return session;
  };

  const createFoco = async (foco) => {
    if (!auth?.token) throw new Error('Primero desbloquea el editor.');
    const saved = await apiRequest('/api/focos', {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify(foco),
    });
    setCustomFocos(prev => {
      const next = new Map(prev.map(item => [item.id, item]));
      next.set(saved.id, saved);
      return [...next.values()];
    });
    setSelectedId(saved.id);
    setDbStatus('online');
    loadEditorData(auth.token);
    return saved;
  };

  const deleteFoco = async (id) => {
    if (!auth?.token) throw new Error('Primero desbloquea el editor.');
    await apiRequest(`/api/focos/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    setCustomFocos(prev => prev.filter(item => item.id !== id));
    setAttachments(prev => prev.filter(item => item.foco_id !== id));
    if (selectedId === id) setSelectedId('ukr-rus');
    loadEditorData(auth.token);
  };

  const uploadAttachment = async (focoId, attachment) => {
    if (!auth?.token) throw new Error('Primero desbloquea el editor.');
    const saved = await apiRequest('/api/attachments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ ...attachment, foco_id: focoId }),
    });
    setAttachments(prev => [saved, ...prev]);
    loadEditorData(auth.token);
    return saved;
  };

  const deleteAttachment = async (attachmentId) => {
    if (!auth?.token) throw new Error('Primero desbloquea el editor.');
    await apiRequest(`/api/attachments/${encodeURIComponent(attachmentId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    setAttachments(prev => prev.filter(item => String(item.id) !== String(attachmentId)));
    loadEditorData(auth.token);
  };

  const createUser = async (user) => {
    if (!auth?.token) throw new Error('Primero desbloquea el editor.');
    const saved = await apiRequest('/api/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify(user),
    });
    setUsers(prev => [saved, ...prev.filter(item => item.username !== saved.username)]);
    loadEditorData(auth.token);
    return saved;
  };

  const deleteUser = async (username) => {
    if (!auth?.token) throw new Error('Primero desbloquea el editor.');
    const saved = await apiRequest(`/api/users/${encodeURIComponent(username)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    setUsers(prev => prev.map(item => item.username === username ? { ...item, ...saved, active: false } : item));
    loadEditorData(auth.token);
    return saved;
  };

  const attachmentUrl = (attachmentId) => `${API_BASE}/api/attachments/${encodeURIComponent(attachmentId)}/download?token=${encodeURIComponent(auth?.token || '')}`;
  const dossierUrl = (focoId) => `${API_BASE}/api/focos/${encodeURIComponent(focoId)}/dossier?token=${encodeURIComponent(auth?.token || '')}`;

  const changePassword = async (newPassword) => {
    if (!auth?.token) throw new Error('Primero desbloquea el editor.');
    const session = await apiRequest('/api/password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ newPassword }),
    });
    setAuth(session);
    setAuthStatus('Clave actualizada.');
    return session;
  };

  if (!bootComplete) {
    return html`<${CommandBoot} onEnter=${() => setBootComplete(true)}/>`;
  }

  return html`
  <div class="min-h-screen">
    <${Header} t=${t} lang=${lang} setLang=${setLang} view=${view} setView=${setView}
              sitRoom=${sitRoom} onSitRoom=${()=>setSitRoom(s=>!s)} />

    <!-- Welcome stripe -->
    <div class="relative tactical-grid border-b border-radar/10">
      <div class="max-w-[1600px] mx-auto px-4 lg:px-6 py-5 flex items-center justify-between flex-wrap gap-3 relative">
        <div>
          <div class="font-mono text-[10.5px] uppercase tracking-[0.3em] text-radar">${t.tagline}</div>
          <h1 class="font-display font-bold text-[22px] sm:text-[26px] text-slate-50 mt-1 glow-text">${t.welcome}</h1>
        </div>
        <${EditorialWarning} t=${t}/>
      </div>
    </div>

    <main class="max-w-[1600px] mx-auto px-3 lg:px-6 py-4 lg:py-6 space-y-4 lg:space-y-6">

      ${view==='dashboard' && html`
        <div class="space-y-4 lg:space-y-6">
          <${KpiStrip}/>
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div class="lg:col-span-2 space-y-4">
              <${WorldMap} focos=${allFocos} selectedId=${selectedId} onSelect=${setSelectedId}/>
              <${FocoDetail} foco=${selectedFoco}/>
            </div>
            <${AlertsPanel} focos=${allFocos} onSelect=${setSelectedId} selectedId=${selectedId} onOpenSentinel=${()=>setView('sentinel')}/>
          </div>
          <${Analysis} t=${t} foco=${selectedFoco}/>
          <${Scenarios} t=${t} foco=${selectedFoco}/>
          <${ConflictosActivosTeaser} lang=${lang}/>
          <${IntelligenceProducts} lang=${lang} onOpenMap=${()=>setView('map')}/>
          <${OsintReelsTeaser} lang=${lang} onOpen=${()=>setView('osint')}/>
          <${PlanZTeaser} lang=${lang} onOpen=${()=>setView('planz')}/>
          <${FichaTeaser} lang=${lang} onOpen=${()=>setView('ficha')}/>
          <${DoctrinaTeaser} lang=${lang} onOpen=${()=>setView('doctrina')}/>
          <${SalaTeaser} lang=${lang} onOpen=${()=>setView('sala')}/>
        </div>
      `}

      ${view==='map' && html`
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div class="lg:col-span-2 space-y-4">
            <${WorldMap} focos=${allFocos} selectedId=${selectedId} onSelect=${setSelectedId}/>
            <${FocoDetail} foco=${selectedFoco}/>
          </div>
          <${AlertsPanel} focos=${allFocos} onSelect=${setSelectedId} selectedId=${selectedId} onOpenSentinel=${()=>setView('sentinel')}/>
        </div>
      `}

      ${view==='doctrina' && html`<${Doctrina} lang=${lang}/>`}

      ${view==='planz' && html`<${PlanZ} lang=${lang}/>`}

      ${view==='ficha' && html`<${FichaEditorial} lang=${lang}/>`}

      ${view==='sentinel' && html`<${SentinelBrief} lang=${lang}/>`}

      ${view==='watchlist' && html`<${Watchlist} t=${t} focos=${allFocos} onSelect=${setSelectedId} selectedId=${selectedId}/>`}

      ${view==='system' && html`<${SystemaMundo} t=${t}/>`}

      ${view==='analysis' && html`
        <div class="space-y-4">
          <${FocoDetail} foco=${selectedFoco}/>
          <${Analysis} t=${t} foco=${selectedFoco}/>
        </div>
      `}

      ${view==='scenarios' && html`
        <div class="space-y-4">
          <${FocoDetail} foco=${selectedFoco}/>
          <${Scenarios} t=${t} foco=${selectedFoco}/>
        </div>
      `}

      ${view==='sala' && html`<${VideoLibrary} lang=${lang}/>`}

      ${view==='rearm' && html`<${RearmamentModule} t=${t} onOpenFoco=${openFocoOnMap}/>`}

      ${view==='monetization' && html`<${MonetizationModule} t=${t}/>`}

      ${view==='products' && html`<${IntelligenceProducts} lang=${lang} onOpenMap=${()=>setView('map')}/>`}

      ${view==='osint' && html`<${OsintReels} lang=${lang}/>`}

      ${view==='editor' && html`<${EditorPanel} t=${t} focos=${allFocos} onCreate=${createFoco} onDelete=${deleteFoco} onPasswordChange=${changePassword} history=${history} attachments=${attachments} users=${users} onCreateUser=${createUser} onDeleteUser=${deleteUser} onUploadAttachment=${uploadAttachment} onDeleteAttachment=${deleteAttachment} getAttachmentUrl=${attachmentUrl} getDossierUrl=${dossierUrl} onRefreshHistory=${()=>loadEditorData(auth?.token)} onOpenFoco=${openFocoOnMap} auth=${auth} onLogin=${loginEditor} authStatus=${authStatus} dbStatus=${dbStatus}/>`}

      ${view==='brief' && html`<${BriefDiario} t=${t}/>`}

      ${view==='studio' && html`
        <div class="space-y-4">
          <${FocoDetail} foco=${selectedFoco}/>
          <${ContentStudio} t=${t} foco=${selectedFoco}/>
        </div>
      `}

      <footer class="pt-6 pb-10 mt-6 border-t border-white/5">
        <div class="flex flex-wrap gap-3 items-center justify-between">
          <div class="flex items-center gap-2 text-radar">
            <${BrandMark} size=${20}/>
            <div class="leading-tight">
              <div class="font-mono text-[10px] uppercase tracking-widest text-slate-500">GEOPÓLEM · v1.6 COMMAND · OSINT</div>
              <div class="text-[11px] text-slate-500">Cartografía táctica · Guerra híbrida · Sistema-mundo</div>
            </div>
          </div>
          <div class="text-[10.5px] font-mono uppercase tracking-widest text-slate-500">© GEOPÓLEM — Prototipo editorial</div>
        </div>
      </footer>
    </main>

    <!-- Situation room mode overlay (subtle) -->
    ${sitRoom && html`
      <div class="fixed inset-0 pointer-events-none z-10">
        <div class="absolute inset-0 mix-blend-screen" style=${{background:'radial-gradient(circle at 50% 30%, rgba(34,211,238,0.08), transparent 60%)'}}></div>
        <div class="absolute top-0 left-0 right-0 h-1 bg-alert/60 animate-flicker"></div>
      </div>
    `}
  </div>`;
}

createRoot(document.getElementById('root')).render(html`<${App}/>`);
