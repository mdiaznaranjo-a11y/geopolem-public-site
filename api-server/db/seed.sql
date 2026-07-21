-- GEOPÓLEM - Carga semilla inicial
-- Requiere haber ejecutado antes: esquema_base_datos_geopolem.sql
-- Base objetivo: PostgreSQL 15+ con PostGIS
-- Propósito: datos mínimos para probar web, app/PWA, CMS y mapa interactivo
-- Nota: esta carga es prototipo editorial/técnico. Revisar y validar fuentes antes de producción.

BEGIN;

-- ============================================================
-- 1. Taxonomías base
-- ============================================================

INSERT INTO taxonomies (code, slug, label_es, label_en, description, taxonomy_group, parent_id, cms_enabled, map_enabled, sql_enabled, sort_order)
VALUES
-- Grupos temáticos
('theme_conflict_security', 'conflictos_y_seguridad', 'Conflictos y seguridad', 'Conflict and security', 'Conflictos armados, seguridad internacional, defensa, insurgencias y crisis.', 'themes', NULL, TRUE, TRUE, TRUE, 10),
('theme_energy_resources', 'energia_y_recursos', 'Energía y recursos', 'Energy and resources', 'Política energética, hidrocarburos, minerales críticos, agua e infraestructura energética.', 'themes', NULL, TRUE, TRUE, TRUE, 20),
('theme_routes_trade', 'rutas_y_comercio_global', 'Rutas y comercio global', 'Routes and global trade', 'Chokepoints, rutas marítimas, cadenas de suministro y logística estratégica.', 'themes', NULL, TRUE, TRUE, TRUE, 30),
('theme_great_powers', 'grandes_potencias', 'Grandes potencias', 'Great powers', 'Competencia estratégica entre potencias y orden internacional.', 'themes', NULL, TRUE, TRUE, TRUE, 40),
('theme_ir_theory', 'teoria_y_conceptos', 'Teoría y conceptos', 'Theory and concepts', 'Conceptos de relaciones internacionales y geopolítica.', 'themes', NULL, TRUE, FALSE, TRUE, 50),

-- Regiones
('region_global', 'global', 'Global', 'Global', 'Escala global o transregional.', 'regions', NULL, TRUE, TRUE, TRUE, 1),
('region_mena', 'medio_oriente_y_norte_de_africa', 'Medio Oriente y Norte de África', 'Middle East and North Africa', 'Región MENA.', 'regions', NULL, TRUE, TRUE, TRUE, 10),
('region_gulf', 'golfo_persico', 'Golfo Pérsico', 'Persian Gulf', 'Golfo Pérsico y entorno energético.', 'regions', NULL, TRUE, TRUE, TRUE, 11),
('region_red_sea', 'mar_rojo', 'Mar Rojo', 'Red Sea', 'Mar Rojo, Bab el-Mandeb y rutas asociadas.', 'regions', NULL, TRUE, TRUE, TRUE, 12),
('region_eastern_europe', 'europa_oriental', 'Europa Oriental', 'Eastern Europe', 'Europa Oriental y espacio postsoviético europeo.', 'regions', NULL, TRUE, TRUE, TRUE, 20),
('region_black_sea', 'mar_negro', 'Mar Negro', 'Black Sea', 'Mar Negro y rutas asociadas.', 'regions', NULL, TRUE, TRUE, TRUE, 21),
('region_sahel', 'sahel', 'Sahel', 'Sahel', 'Franja saheliana africana.', 'regions', NULL, TRUE, TRUE, TRUE, 30),
('region_indopacific', 'indo_pacifico', 'Indo-Pacífico', 'Indo-Pacific', 'Espacio estratégico del Índico y Pacífico.', 'regions', NULL, TRUE, TRUE, TRUE, 40),
('region_south_china_sea', 'mar_de_china_meridional', 'Mar de China Meridional', 'South China Sea', 'Mar de China Meridional y rutas asociadas.', 'regions', NULL, TRUE, TRUE, TRUE, 41),
('region_latin_america', 'america_latina', 'América Latina', 'Latin America', 'América Latina y el Caribe.', 'regions', NULL, TRUE, TRUE, TRUE, 50),
('region_arctic', 'artico', 'Ártico', 'Arctic', 'Ártico, rutas polares y recursos asociados.', 'regions', NULL, TRUE, TRUE, TRUE, 60),

-- Tipos de conflicto
('conflict_type_interstate_war', 'guerra_interestatal', 'Guerra interestatal', 'Interstate war', 'Conflicto armado entre Estados.', 'conflict_types', NULL, TRUE, TRUE, TRUE, 10),
('conflict_type_civil_war', 'guerra_civil', 'Guerra civil', 'Civil war', 'Conflicto armado interno entre facciones nacionales.', 'conflict_types', NULL, TRUE, TRUE, TRUE, 20),
('conflict_type_proxy_war', 'guerra_por_delegacion', 'Guerra por delegación', 'Proxy war', 'Conflicto en el que actores externos apoyan a partes locales.', 'conflict_types', NULL, TRUE, TRUE, TRUE, 30),
('conflict_type_hybrid_conflict', 'conflicto_hibrido', 'Conflicto híbrido', 'Hybrid conflict', 'Combinación de medios militares, políticos, informativos y económicos.', 'conflict_types', NULL, TRUE, TRUE, TRUE, 40),
('conflict_type_territorial_dispute', 'disputa_territorial', 'Disputa territorial', 'Territorial dispute', 'Controversia por soberanía, frontera o control territorial.', 'conflict_types', NULL, TRUE, TRUE, TRUE, 50),
('conflict_type_energy_crisis', 'crisis_energetica', 'Crisis energética', 'Energy crisis', 'Crisis vinculada a suministro, infraestructura, precios o sanciones energéticas.', 'conflict_types', NULL, TRUE, TRUE, TRUE, 60),
('conflict_type_logistics_crisis', 'crisis_logistica', 'Crisis logística', 'Logistics crisis', 'Disrupción de rutas, puertos, canales o cadenas de suministro.', 'conflict_types', NULL, TRUE, TRUE, TRUE, 70),
('conflict_type_humanitarian_crisis', 'crisis_humanitaria', 'Crisis humanitaria', 'Humanitarian crisis', 'Situación con afectación grave a población civil.', 'conflict_types', NULL, TRUE, TRUE, TRUE, 80),

-- Tipos de actor
('actor_type_great_power', 'gran_potencia', 'Gran potencia', 'Great power', 'Estado con influencia militar, económica y diplomática global.', 'actor_types', NULL, TRUE, TRUE, TRUE, 10),
('actor_type_regional_power', 'potencia_regional', 'Potencia regional', 'Regional power', 'Estado con influencia significativa en su región.', 'actor_types', NULL, TRUE, TRUE, TRUE, 20),
('actor_type_middle_power', 'potencia_media', 'Potencia media', 'Middle power', 'Estado con capacidades relevantes pero alcance global limitado.', 'actor_types', NULL, TRUE, TRUE, TRUE, 30),
('actor_type_fragile_state', 'estado_fragil', 'Estado frágil', 'Fragile state', 'Estado con debilidad institucional o seguridad interna vulnerable.', 'actor_types', NULL, TRUE, TRUE, TRUE, 40),
('actor_type_armed_group', 'grupo_armado', 'Grupo armado', 'Armed group', 'Actor no estatal con capacidades militares.', 'actor_types', NULL, TRUE, TRUE, TRUE, 50),
('actor_type_militia', 'milicia', 'Milicia', 'Militia', 'Grupo armado irregular con base local o regional.', 'actor_types', NULL, TRUE, TRUE, TRUE, 60),
('actor_type_international_org', 'organizacion_internacional', 'Organización internacional', 'International organization', 'Organismo multilateral o regional.', 'actor_types', NULL, TRUE, TRUE, TRUE, 70),
('actor_type_energy_company', 'empresa_energetica', 'Empresa energética', 'Energy company', 'Empresa petrolera, gasista, minera o de infraestructura energética.', 'actor_types', NULL, TRUE, TRUE, TRUE, 80),

-- Tipos de recurso
('resource_type_oil', 'petroleo_crudo', 'Petróleo crudo', 'Crude oil', 'Hidrocarburo líquido estratégico.', 'energy_and_resources', NULL, TRUE, TRUE, TRUE, 10),
('resource_type_refined_products', 'productos_refinados', 'Productos refinados', 'Refined products', 'Combustibles y derivados del petróleo.', 'energy_and_resources', NULL, TRUE, TRUE, TRUE, 11),
('resource_type_gas', 'gas_natural', 'Gas natural', 'Natural gas', 'Gas natural para generación, industria y calefacción.', 'energy_and_resources', NULL, TRUE, TRUE, TRUE, 20),
('resource_type_lng', 'lng', 'Gas natural licuado', 'Liquefied natural gas', 'Gas natural licuado transportado por buques especializados.', 'energy_and_resources', NULL, TRUE, TRUE, TRUE, 21),
('resource_type_lithium', 'litio', 'Litio', 'Lithium', 'Mineral crítico para baterías y transición energética.', 'energy_and_resources', NULL, TRUE, TRUE, TRUE, 30),
('resource_type_cobalt', 'cobalto', 'Cobalto', 'Cobalt', 'Mineral crítico para baterías y aleaciones.', 'energy_and_resources', NULL, TRUE, TRUE, TRUE, 31),
('resource_type_copper', 'cobre', 'Cobre', 'Copper', 'Metal estratégico para electrificación e infraestructura.', 'energy_and_resources', NULL, TRUE, TRUE, TRUE, 32),
('resource_type_uranium', 'uranio', 'Uranio', 'Uranium', 'Recurso estratégico para energía nuclear.', 'energy_and_resources', NULL, TRUE, TRUE, TRUE, 33),
('resource_type_freshwater', 'agua_dulce', 'Agua dulce', 'Freshwater', 'Recurso hídrico estratégico.', 'energy_and_resources', NULL, TRUE, TRUE, TRUE, 40),
('resource_type_fertilizers', 'fertilizantes', 'Fertilizantes', 'Fertilizers', 'Insumos estratégicos para seguridad alimentaria.', 'energy_and_resources', NULL, TRUE, TRUE, TRUE, 50),

-- Tipos de chokepoint/ruta/infraestructura
('route_type_maritime_chokepoint', 'chokepoint_maritimo', 'Chokepoint marítimo', 'Maritime chokepoint', 'Paso marítimo estrecho con alta relevancia comercial o energética.', 'routes_and_infrastructure', NULL, TRUE, TRUE, TRUE, 10),
('route_type_canal', 'canal_estrategico', 'Canal estratégico', 'Strategic canal', 'Canal artificial de importancia comercial o militar.', 'routes_and_infrastructure', NULL, TRUE, TRUE, TRUE, 20),
('route_type_maritime_route', 'ruta_maritima', 'Ruta marítima', 'Maritime route', 'Ruta comercial o energética marítima.', 'routes_and_infrastructure', NULL, TRUE, TRUE, TRUE, 30),
('route_type_energy_corridor', 'corredor_energetico', 'Corredor energético', 'Energy corridor', 'Ruta o corredor usado para transportar energía.', 'routes_and_infrastructure', NULL, TRUE, TRUE, TRUE, 40),
('route_type_submarine_cable', 'cable_submarino', 'Cable submarino', 'Submarine cable', 'Infraestructura digital submarina.', 'routes_and_infrastructure', NULL, TRUE, TRUE, TRUE, 50),

-- Roles de actores en conflictos
('role_belligerent', 'beligerante', 'Beligerante', 'Belligerent', 'Actor que participa directamente en hostilidades.', 'actor_roles', NULL, TRUE, FALSE, TRUE, 10),
('role_supporter', 'apoyo_externo', 'Apoyo externo', 'External supporter', 'Actor que apoya política, militar o económicamente a una parte.', 'actor_roles', NULL, TRUE, FALSE, TRUE, 20),
('role_mediator', 'mediador', 'Mediador', 'Mediator', 'Actor que participa en mediación o negociación.', 'actor_roles', NULL, TRUE, FALSE, TRUE, 30),
('role_affected_actor', 'actor_afectado', 'Actor afectado', 'Affected actor', 'Actor afectado por consecuencias del conflicto.', 'actor_roles', NULL, TRUE, FALSE, TRUE, 40),

-- Tipos de relación recurso/conflicto/chokepoint
('relationship_driver', 'factor_impulsor', 'Factor impulsor', 'Driver', 'Elemento que contribuye al origen o continuidad de un fenómeno.', 'relationship_types', NULL, TRUE, FALSE, TRUE, 10),
('relationship_target', 'objetivo_estrategico', 'Objetivo estratégico', 'Strategic target', 'Recurso, ruta o infraestructura que puede ser objetivo estratégico.', 'relationship_types', NULL, TRUE, FALSE, TRUE, 20),
('relationship_vulnerability', 'vulnerabilidad', 'Vulnerabilidad', 'Vulnerability', 'Elemento expuesto a interrupción o presión.', 'relationship_types', NULL, TRUE, FALSE, TRUE, 30),
('relationship_consequence', 'consecuencia', 'Consecuencia', 'Consequence', 'Efecto derivado de un conflicto, evento o decisión.', 'relationship_types', NULL, TRUE, FALSE, TRUE, 40),

-- Tipos de fuente
('source_type_seed', 'semilla_interna', 'Semilla interna', 'Internal seed', 'Registro interno de prototipo pendiente de validación externa.', 'source_types', NULL, FALSE, FALSE, TRUE, 10),
('source_type_official', 'oficial', 'Oficial', 'Official', 'Fuente gubernamental, multilateral o regulatoria.', 'source_types', NULL, TRUE, FALSE, TRUE, 20),
('source_type_research', 'investigacion', 'Investigación', 'Research', 'Think tank, academia o informe técnico.', 'source_types', NULL, TRUE, FALSE, TRUE, 30),
('source_type_news', 'medio_noticias', 'Medio de noticias', 'News media', 'Agencia o medio periodístico.', 'source_types', NULL, TRUE, FALSE, TRUE, 40),

-- Tipos de evento
('event_type_attack', 'ataque', 'Ataque', 'Attack', 'Acción ofensiva militar o irregular.', 'event_types', NULL, TRUE, TRUE, TRUE, 10),
('event_type_sanction', 'sancion', 'Sanción', 'Sanction', 'Medida coercitiva económica, diplomática o energética.', 'event_types', NULL, TRUE, TRUE, TRUE, 20),
('event_type_blockade', 'bloqueo_ruta', 'Bloqueo de ruta', 'Route blockade', 'Interrupción o amenaza sobre una ruta estratégica.', 'event_types', NULL, TRUE, TRUE, TRUE, 30),
('event_type_energy_disruption', 'interrupcion_energia', 'Interrupción energética', 'Energy disruption', 'Corte, sabotaje o disrupción de suministro energético.', 'event_types', NULL, TRUE, TRUE, TRUE, 40),

-- Dimensiones de riesgo
('risk_supply', 'riesgo_suministro', 'Riesgo de suministro', 'Supply risk', 'Riesgo de interrupción o reducción de suministro.', 'risk_dimensions', NULL, TRUE, TRUE, TRUE, 10),
('risk_chokepoint', 'riesgo_chokepoint', 'Riesgo de chokepoint', 'Chokepoint risk', 'Riesgo asociado a un paso estratégico.', 'risk_dimensions', NULL, TRUE, TRUE, TRUE, 20),
('risk_escalation', 'riesgo_escalada', 'Riesgo de escalada', 'Escalation risk', 'Probabilidad de ampliación o intensificación de una crisis.', 'risk_dimensions', NULL, TRUE, TRUE, TRUE, 30),
('risk_humanitarian', 'riesgo_humanitario', 'Riesgo humanitario', 'Humanitarian risk', 'Impacto potencial sobre población civil.', 'risk_dimensions', NULL, TRUE, TRUE, TRUE, 40)
ON CONFLICT (code) DO UPDATE SET
    label_es = EXCLUDED.label_es,
    label_en = EXCLUDED.label_en,
    description = EXCLUDED.description,
    taxonomy_group = EXCLUDED.taxonomy_group,
    cms_enabled = EXCLUDED.cms_enabled,
    map_enabled = EXCLUDED.map_enabled,
    sql_enabled = EXCLUDED.sql_enabled,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

-- ============================================================
-- 2. Fuente interna de prototipo
-- ============================================================

INSERT INTO sources (
    slug,
    title,
    source_name,
    source_type_id,
    url,
    publisher,
    language_code,
    reliability_score,
    citation_text,
    status
)
VALUES (
    'geopolem_seed_internal_v1',
    'GEOPÓLEM seed data v1',
    'GEOPÓLEM internal seed',
    (SELECT id FROM taxonomies WHERE code = 'source_type_seed'),
    NULL,
    'GEOPÓLEM',
    'es',
    2,
    'Datos semilla internos para pruebas técnicas. Requieren validación antes de publicación.',
    'active'
)
ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    source_type_id = EXCLUDED.source_type_id,
    citation_text = EXCLUDED.citation_text,
    updated_at = now();

-- ============================================================
-- 3. Países iniciales
-- ============================================================

INSERT INTO countries (iso2, iso3, name_es, name_en, capital, region_id, subregion_id, latitude, longitude, status)
VALUES
('US', 'USA', 'Estados Unidos', 'United States', 'Washington, D.C.', (SELECT id FROM taxonomies WHERE code = 'region_global'), NULL, 38.8951, -77.0364, 'active'),
('CN', 'CHN', 'China', 'China', 'Pekín', (SELECT id FROM taxonomies WHERE code = 'region_indopacific'), NULL, 39.9042, 116.4074, 'active'),
('RU', 'RUS', 'Rusia', 'Russia', 'Moscú', (SELECT id FROM taxonomies WHERE code = 'region_eastern_europe'), NULL, 55.7558, 37.6173, 'active'),
('UA', 'UKR', 'Ucrania', 'Ukraine', 'Kyiv', (SELECT id FROM taxonomies WHERE code = 'region_eastern_europe'), NULL, 50.4501, 30.5234, 'active'),
('IR', 'IRN', 'Irán', 'Iran', 'Teherán', (SELECT id FROM taxonomies WHERE code = 'region_gulf'), NULL, 35.6892, 51.3890, 'active'),
('SA', 'SAU', 'Arabia Saudita', 'Saudi Arabia', 'Riad', (SELECT id FROM taxonomies WHERE code = 'region_gulf'), NULL, 24.7136, 46.6753, 'active'),
('YE', 'YEM', 'Yemen', 'Yemen', 'Saná', (SELECT id FROM taxonomies WHERE code = 'region_red_sea'), NULL, 15.3694, 44.1910, 'active'),
('EG', 'EGY', 'Egipto', 'Egypt', 'El Cairo', (SELECT id FROM taxonomies WHERE code = 'region_mena'), NULL, 30.0444, 31.2357, 'active'),
('TW', 'TWN', 'Taiwán', 'Taiwan', 'Taipéi', (SELECT id FROM taxonomies WHERE code = 'region_indopacific'), NULL, 25.0330, 121.5654, 'active'),
('SD', 'SDN', 'Sudán', 'Sudan', 'Jartum', (SELECT id FROM taxonomies WHERE code = 'region_sahel'), NULL, 15.5007, 32.5599, 'active'),
('PA', 'PAN', 'Panamá', 'Panama', 'Ciudad de Panamá', (SELECT id FROM taxonomies WHERE code = 'region_latin_america'), NULL, 8.9824, -79.5199, 'active'),
('MY', 'MYS', 'Malasia', 'Malaysia', 'Kuala Lumpur', (SELECT id FROM taxonomies WHERE code = 'region_indopacific'), NULL, 3.1390, 101.6869, 'active')
ON CONFLICT (iso3) DO UPDATE SET
    name_es = EXCLUDED.name_es,
    name_en = EXCLUDED.name_en,
    capital = EXCLUDED.capital,
    region_id = EXCLUDED.region_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();

UPDATE countries
SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ============================================================
-- 4. Actores estatales iniciales
-- ============================================================

INSERT INTO state_actors (
    slug,
    official_name_es,
    official_name_en,
    short_name_es,
    country_id,
    actor_type_id,
    strategic_orientation,
    energy_profile,
    military_profile,
    economic_profile,
    influence_level,
    energy_relevance,
    military_relevance,
    economic_relevance,
    latitude,
    longitude,
    geom,
    status
)
VALUES
('estado_unidos', 'Estados Unidos de América', 'United States of America', 'Estados Unidos', (SELECT id FROM countries WHERE iso3 = 'USA'), (SELECT id FROM taxonomies WHERE code = 'actor_type_great_power'), 'Gran potencia con proyección global y alianzas extensas.', 'Productor y consumidor energético central; actor clave en seguridad marítima y sanciones.', 'Capacidad militar global.', 'Centro financiero, tecnológico y comercial.', 5, TRUE, TRUE, TRUE, 38.8951, -77.0364, ST_SetSRID(ST_MakePoint(-77.0364, 38.8951), 4326), 'active'),
('china', 'República Popular China', 'People''s Republic of China', 'China', (SELECT id FROM countries WHERE iso3 = 'CHN'), (SELECT id FROM taxonomies WHERE code = 'actor_type_great_power'), 'Gran potencia con prioridad en rutas, tecnología, comercio y seguridad energética.', 'Importador energético clave y actor central en minerales críticos.', 'Modernización militar y presencia regional creciente.', 'Potencia manufacturera y comercial global.', 5, TRUE, TRUE, TRUE, 39.9042, 116.4074, ST_SetSRID(ST_MakePoint(116.4074, 39.9042), 4326), 'active'),
('rusia', 'Federación de Rusia', 'Russian Federation', 'Rusia', (SELECT id FROM countries WHERE iso3 = 'RUS'), (SELECT id FROM taxonomies WHERE code = 'actor_type_great_power'), 'Potencia euroasiática con fuerte dimensión militar y energética.', 'Exportador estratégico de petróleo, gas y recursos minerales.', 'Capacidad militar nuclear y convencional relevante.', 'Economía altamente vinculada a recursos y energía.', 5, TRUE, TRUE, TRUE, 55.7558, 37.6173, ST_SetSRID(ST_MakePoint(37.6173, 55.7558), 4326), 'active'),
('iran', 'República Islámica de Irán', 'Islamic Republic of Iran', 'Irán', (SELECT id FROM countries WHERE iso3 = 'IRN'), (SELECT id FROM taxonomies WHERE code = 'actor_type_regional_power'), 'Potencia regional con influencia en Golfo Pérsico y Medio Oriente.', 'Productor de hidrocarburos y actor clave cerca del Estrecho de Ormuz.', 'Capacidades militares y redes regionales.', 'Economía condicionada por sanciones y energía.', 4, TRUE, TRUE, TRUE, 35.6892, 51.3890, ST_SetSRID(ST_MakePoint(51.3890, 35.6892), 4326), 'active'),
('arabia_saudita', 'Reino de Arabia Saudita', 'Kingdom of Saudi Arabia', 'Arabia Saudita', (SELECT id FROM countries WHERE iso3 = 'SAU'), (SELECT id FROM taxonomies WHERE code = 'actor_type_regional_power'), 'Potencia regional del Golfo y actor central en mercados petroleros.', 'Exportador petrolero clave y actor central de OPEC+.', 'Capacidades militares regionales.', 'Economía en transición con base petrolera.', 4, TRUE, TRUE, TRUE, 24.7136, 46.6753, ST_SetSRID(ST_MakePoint(46.6753, 24.7136), 4326), 'active'),
('egipto', 'República Árabe de Egipto', 'Arab Republic of Egypt', 'Egipto', (SELECT id FROM countries WHERE iso3 = 'EGY'), (SELECT id FROM taxonomies WHERE code = 'actor_type_regional_power'), 'Estado clave por control del Canal de Suez y posición entre África y Medio Oriente.', 'Relevante por infraestructura, gas regional y tránsito energético.', 'Actor militar regional.', 'Economía vinculada a tránsito, energía y comercio.', 4, TRUE, TRUE, TRUE, 30.0444, 31.2357, ST_SetSRID(ST_MakePoint(31.2357, 30.0444), 4326), 'active'),
('ucrania', 'Ucrania', 'Ukraine', 'Ucrania', (SELECT id FROM countries WHERE iso3 = 'UKR'), (SELECT id FROM taxonomies WHERE code = 'actor_type_middle_power'), 'Estado central en la seguridad europea y del Mar Negro.', 'Relevante por infraestructura energética, tránsito y seguridad alimentaria.', 'Actor militar central en guerra interestatal activa.', 'Economía afectada por guerra e infraestructura crítica.', 4, TRUE, TRUE, TRUE, 50.4501, 30.5234, ST_SetSRID(ST_MakePoint(30.5234, 50.4501), 4326), 'active')
ON CONFLICT (slug) DO UPDATE SET
    official_name_es = EXCLUDED.official_name_es,
    actor_type_id = EXCLUDED.actor_type_id,
    energy_profile = EXCLUDED.energy_profile,
    military_profile = EXCLUDED.military_profile,
    economic_profile = EXCLUDED.economic_profile,
    influence_level = EXCLUDED.influence_level,
    energy_relevance = EXCLUDED.energy_relevance,
    military_relevance = EXCLUDED.military_relevance,
    economic_relevance = EXCLUDED.economic_relevance,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geom = EXCLUDED.geom,
    updated_at = now();

-- ============================================================
-- 5. Actores no estatales iniciales
-- ============================================================

INSERT INTO non_state_actors (
    slug,
    name_es,
    name_en,
    actor_type_id,
    primary_region_id,
    primary_country_id,
    ideology_or_motivation,
    objectives,
    capabilities,
    funding_sources,
    territorial_control,
    energy_relevance,
    military_relevance,
    economic_relevance,
    influence_level,
    latitude,
    longitude,
    area_of_operation,
    status
)
VALUES
('huties_yemen', 'Hutíes / Ansar Allah', 'Houthis / Ansar Allah', (SELECT id FROM taxonomies WHERE code = 'actor_type_armed_group'), (SELECT id FROM taxonomies WHERE code = 'region_red_sea'), (SELECT id FROM countries WHERE iso3 = 'YEM'), 'Movimiento político-militar yemení.', 'Influencia política y militar en Yemen y presión sobre rutas del Mar Rojo.', 'Capacidades de misiles, drones y control territorial parcial.', 'Pendiente de validación fuente por fuente.', 'Áreas del norte y oeste de Yemen según contexto de conflicto.', TRUE, TRUE, TRUE, 4, 15.3694, 44.1910, ST_SetSRID(ST_MakePoint(44.1910, 15.3694), 4326), 'active'),
('rsf_sudan', 'Fuerzas de Apoyo Rápido', 'Rapid Support Forces', (SELECT id FROM taxonomies WHERE code = 'actor_type_militia'), (SELECT id FROM taxonomies WHERE code = 'region_sahel'), (SELECT id FROM countries WHERE iso3 = 'SDN'), 'Actor armado sudanés con base paramilitar.', 'Control territorial e influencia política dentro del conflicto sudanés.', 'Capacidad militar significativa dentro de Sudán.', 'Pendiente de validación fuente por fuente.', 'Zonas variables dentro de Sudán.', FALSE, TRUE, TRUE, 4, 15.5007, 32.5599, ST_SetSRID(ST_MakePoint(32.5599, 15.5007), 4326), 'active')
ON CONFLICT (slug) DO UPDATE SET
    name_es = EXCLUDED.name_es,
    actor_type_id = EXCLUDED.actor_type_id,
    primary_region_id = EXCLUDED.primary_region_id,
    primary_country_id = EXCLUDED.primary_country_id,
    objectives = EXCLUDED.objectives,
    capabilities = EXCLUDED.capabilities,
    influence_level = EXCLUDED.influence_level,
    energy_relevance = EXCLUDED.energy_relevance,
    military_relevance = EXCLUDED.military_relevance,
    economic_relevance = EXCLUDED.economic_relevance,
    area_of_operation = EXCLUDED.area_of_operation,
    updated_at = now();

-- ============================================================
-- 6. Recursos energéticos y estratégicos iniciales
-- ============================================================

INSERT INTO energy_resources (
    slug,
    name_es,
    name_en,
    resource_type_id,
    category_id,
    description,
    strategic_importance,
    market_relevance,
    energy_transition_relevance,
    supply_security_relevance,
    critical_mineral,
    unit_of_measure,
    status
)
VALUES
('petroleo_crudo', 'Petróleo crudo', 'Crude oil', (SELECT id FROM taxonomies WHERE code = 'resource_type_oil'), (SELECT id FROM taxonomies WHERE code = 'theme_energy_resources'), 'Recurso energético central para transporte, industria y mercados globales.', 5, 'Alta relevancia para precios, inflación, seguridad energética y balanza comercial.', FALSE, TRUE, FALSE, 'barril', 'active'),
('gas_natural', 'Gas natural', 'Natural gas', (SELECT id FROM taxonomies WHERE code = 'resource_type_gas'), (SELECT id FROM taxonomies WHERE code = 'theme_energy_resources'), 'Combustible clave para electricidad, industria, calefacción y seguridad energética.', 5, 'Alta relevancia para Europa, Asia y mercados LNG.', TRUE, TRUE, FALSE, 'm3/MMBtu', 'active'),
('lng', 'Gas natural licuado', 'Liquefied natural gas', (SELECT id FROM taxonomies WHERE code = 'resource_type_lng'), (SELECT id FROM taxonomies WHERE code = 'theme_energy_resources'), 'Gas natural licuado transportado por buques especializados.', 5, 'Relevante para diversificación de suministro y seguridad energética.', TRUE, TRUE, FALSE, 'tonelada/MMBtu', 'active'),
('litio', 'Litio', 'Lithium', (SELECT id FROM taxonomies WHERE code = 'resource_type_lithium'), (SELECT id FROM taxonomies WHERE code = 'theme_energy_resources'), 'Mineral crítico para baterías, movilidad eléctrica y almacenamiento.', 4, 'Clave para transición energética y cadenas de suministro.', TRUE, TRUE, TRUE, 'tonelada', 'active'),
('cobalto', 'Cobalto', 'Cobalt', (SELECT id FROM taxonomies WHERE code = 'resource_type_cobalt'), (SELECT id FROM taxonomies WHERE code = 'theme_energy_resources'), 'Mineral crítico para baterías, aleaciones y tecnologías avanzadas.', 4, 'Relevante para baterías y riesgo de concentración de suministro.', TRUE, TRUE, TRUE, 'tonelada', 'active'),
('cobre', 'Cobre', 'Copper', (SELECT id FROM taxonomies WHERE code = 'resource_type_copper'), (SELECT id FROM taxonomies WHERE code = 'theme_energy_resources'), 'Metal clave para redes eléctricas, electrificación e infraestructura.', 5, 'Alta relevancia para transición energética y construcción.', TRUE, TRUE, TRUE, 'tonelada', 'active'),
('uranio', 'Uranio', 'Uranium', (SELECT id FROM taxonomies WHERE code = 'resource_type_uranium'), (SELECT id FROM taxonomies WHERE code = 'theme_energy_resources'), 'Recurso estratégico para generación nuclear.', 4, 'Relevante para energía nuclear y seguridad de suministro.', TRUE, TRUE, TRUE, 'tonelada', 'active'),
('agua_dulce', 'Agua dulce', 'Freshwater', (SELECT id FROM taxonomies WHERE code = 'resource_type_freshwater'), (SELECT id FROM taxonomies WHERE code = 'theme_energy_resources'), 'Recurso vital para consumo, agricultura, industria y estabilidad social.', 5, 'Alta relevancia para seguridad humana, alimentaria y energética.', FALSE, TRUE, FALSE, 'm3', 'active'),
('fertilizantes', 'Fertilizantes', 'Fertilizers', (SELECT id FROM taxonomies WHERE code = 'resource_type_fertilizers'), (SELECT id FROM taxonomies WHERE code = 'theme_energy_resources'), 'Insumos estratégicos para producción agrícola y seguridad alimentaria.', 4, 'Relevantes para alimentos, gas natural y comercio internacional.', FALSE, TRUE, FALSE, 'tonelada', 'active')
ON CONFLICT (slug) DO UPDATE SET
    description = EXCLUDED.description,
    strategic_importance = EXCLUDED.strategic_importance,
    market_relevance = EXCLUDED.market_relevance,
    energy_transition_relevance = EXCLUDED.energy_transition_relevance,
    supply_security_relevance = EXCLUDED.supply_security_relevance,
    critical_mineral = EXCLUDED.critical_mineral,
    updated_at = now();

-- ============================================================
-- 7. Chokepoints iniciales
-- ============================================================

INSERT INTO chokepoints (
    slug,
    name_es,
    name_en,
    chokepoint_type_id,
    primary_region_id,
    description,
    strategic_importance,
    risk_level,
    energy_flow_relevance,
    trade_flow_relevance,
    military_relevance,
    main_risks,
    controlled_or_influenced_by,
    latitude,
    longitude,
    geom,
    geometry_type,
    status
)
VALUES
('estrecho_de_ormuz', 'Estrecho de Ormuz', 'Strait of Hormuz', (SELECT id FROM taxonomies WHERE code = 'route_type_maritime_chokepoint'), (SELECT id FROM taxonomies WHERE code = 'region_gulf'), 'Paso estratégico entre el Golfo Pérsico y el Golfo de Omán.', 5, 5, TRUE, TRUE, TRUE, 'Escalada militar, sanciones, ataques a buques, cierre o amenaza de interrupción.', 'Estados ribereños y presencia naval externa.', 26.5667, 56.2500, ST_SetSRID(ST_MakePoint(56.2500, 26.5667), 4326), 'point', 'active'),
('canal_de_suez', 'Canal de Suez', 'Suez Canal', (SELECT id FROM taxonomies WHERE code = 'route_type_canal'), (SELECT id FROM taxonomies WHERE code = 'region_mena'), 'Canal que conecta el Mediterráneo con el Mar Rojo.', 5, 4, TRUE, TRUE, TRUE, 'Bloqueo, conflicto regional, ataques indirectos, congestión logística.', 'Egipto y actores comerciales globales.', 30.5852, 32.2654, ST_SetSRID(ST_MakePoint(32.2654, 30.5852), 4326), 'point', 'active'),
('bab_el_mandeb', 'Bab el-Mandeb', 'Bab el-Mandeb', (SELECT id FROM taxonomies WHERE code = 'route_type_maritime_chokepoint'), (SELECT id FROM taxonomies WHERE code = 'region_red_sea'), 'Paso entre el Mar Rojo y el Golfo de Adén.', 5, 5, TRUE, TRUE, TRUE, 'Ataques marítimos, guerra en Yemen, militarización, desvío de rutas.', 'Estados ribereños, actores armados y presencia naval internacional.', 12.5833, 43.3333, ST_SetSRID(ST_MakePoint(43.3333, 12.5833), 4326), 'point', 'active'),
('estrecho_de_malaca', 'Estrecho de Malaca', 'Strait of Malacca', (SELECT id FROM taxonomies WHERE code = 'route_type_maritime_chokepoint'), (SELECT id FROM taxonomies WHERE code = 'region_indopacific'), 'Paso marítimo clave entre el océano Índico y el Pacífico.', 5, 4, TRUE, TRUE, TRUE, 'Congestión, piratería, tensiones regionales, dependencia energética asiática.', 'Estados ribereños y potencias marítimas.', 2.5000, 101.0000, ST_SetSRID(ST_MakePoint(101.0000, 2.5000), 4326), 'point', 'active'),
('canal_de_panama', 'Canal de Panamá', 'Panama Canal', (SELECT id FROM taxonomies WHERE code = 'route_type_canal'), (SELECT id FROM taxonomies WHERE code = 'region_latin_america'), 'Canal que conecta el océano Atlántico y el Pacífico.', 5, 3, TRUE, TRUE, FALSE, 'Sequía, restricciones de calado, congestión, presión logística.', 'Panamá y comercio marítimo global.', 9.0800, -79.6800, ST_SetSRID(ST_MakePoint(-79.6800, 9.0800), 4326), 'point', 'active'),
('estrechos_turcos', 'Estrechos Turcos', 'Turkish Straits', (SELECT id FROM taxonomies WHERE code = 'route_type_maritime_chokepoint'), (SELECT id FROM taxonomies WHERE code = 'region_black_sea'), 'Sistema de pasos que conecta el Mar Negro con el Mediterráneo.', 4, 4, TRUE, TRUE, TRUE, 'Guerra regional, restricciones de navegación, militarización del Mar Negro.', 'Turquía y actores del Mar Negro.', 41.1193, 29.0722, ST_SetSRID(ST_MakePoint(29.0722, 41.1193), 4326), 'point', 'active')
ON CONFLICT (slug) DO UPDATE SET
    description = EXCLUDED.description,
    strategic_importance = EXCLUDED.strategic_importance,
    risk_level = EXCLUDED.risk_level,
    energy_flow_relevance = EXCLUDED.energy_flow_relevance,
    trade_flow_relevance = EXCLUDED.trade_flow_relevance,
    military_relevance = EXCLUDED.military_relevance,
    main_risks = EXCLUDED.main_risks,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geom = EXCLUDED.geom,
    updated_at = now();

-- ============================================================
-- 8. Flujos recurso-chokepoint
-- ============================================================

INSERT INTO chokepoint_resource_flows (chokepoint_id, resource_id, flow_direction, estimated_volume, importance_note, source_confidence)
VALUES
((SELECT id FROM chokepoints WHERE slug = 'estrecho_de_ormuz'), (SELECT id FROM energy_resources WHERE slug = 'petroleo_crudo'), 'golfo_persico_hacia_mercados_globales', 'pendiente_validacion', 'Ruta crítica para exportaciones energéticas del Golfo.', 2),
((SELECT id FROM chokepoints WHERE slug = 'estrecho_de_ormuz'), (SELECT id FROM energy_resources WHERE slug = 'lng'), 'qatar_y_golfo_hacia_mercados_globales', 'pendiente_validacion', 'Ruta relevante para exportaciones de LNG desde el Golfo.', 2),
((SELECT id FROM chokepoints WHERE slug = 'canal_de_suez'), (SELECT id FROM energy_resources WHERE slug = 'petroleo_crudo'), 'asia_golfo_europa', 'pendiente_validacion', 'Conecta flujos energéticos y comerciales entre Asia, Golfo y Europa.', 2),
((SELECT id FROM chokepoints WHERE slug = 'bab_el_mandeb'), (SELECT id FROM energy_resources WHERE slug = 'petroleo_crudo'), 'indico_mar_rojo_mediterraneo', 'pendiente_validacion', 'Punto crítico en la ruta hacia Suez.', 2),
((SELECT id FROM chokepoints WHERE slug = 'estrecho_de_malaca'), (SELECT id FROM energy_resources WHERE slug = 'petroleo_crudo'), 'indico_asia_oriental', 'pendiente_validacion', 'Ruta energética clave para Asia Oriental.', 2),
((SELECT id FROM chokepoints WHERE slug = 'canal_de_panama'), (SELECT id FROM energy_resources WHERE slug = 'lng'), 'atlantico_pacifico', 'pendiente_validacion', 'Ruta relevante para comercio energético y LNG.', 2)
ON CONFLICT (chokepoint_id, resource_id, flow_direction) DO UPDATE SET
    importance_note = EXCLUDED.importance_note,
    source_confidence = EXCLUDED.source_confidence;

-- ============================================================
-- 9. Conflictos piloto
-- ============================================================

INSERT INTO conflicts (
    slug,
    name_es,
    name_en,
    summary,
    conflict_type_id,
    primary_region_id,
    primary_country_id,
    status,
    intensity_level,
    escalation_risk,
    humanitarian_impact,
    energy_dimension,
    territorial_dimension,
    external_involvement,
    start_date,
    latitude,
    longitude,
    geom,
    geometry_type,
    background,
    current_status,
    analytical_assessment,
    source_confidence,
    verification
)
VALUES
('guerra_ucrania', 'Guerra en Ucrania', 'War in Ukraine', 'Conflicto interestatal con implicaciones europeas, energéticas, alimentarias y de seguridad internacional.', (SELECT id FROM taxonomies WHERE code = 'conflict_type_interstate_war'), (SELECT id FROM taxonomies WHERE code = 'region_eastern_europe'), (SELECT id FROM countries WHERE iso3 = 'UKR'), 'active', 5, 4, 5, TRUE, TRUE, TRUE, '2022-02-24', 49.0000, 32.0000, ST_SetSRID(ST_MakePoint(32.0000, 49.0000), 4326), 'point', 'Conflicto vinculado a seguridad europea, soberanía, expansión de alianzas, territorio e infraestructura crítica.', 'Activo; requiere actualización periódica por frentes, actores y eventos.', 'Caso central para analizar balance de poder, seguridad energética europea, Mar Negro y cadenas de suministro alimentarias.', 2, 'partially_verified'),
('crisis_mar_rojo_yemen', 'Crisis del Mar Rojo y Yemen', 'Red Sea and Yemen crisis', 'Crisis logística y de seguridad marítima conectada con el conflicto yemení y ataques o amenazas sobre rutas comerciales.', (SELECT id FROM taxonomies WHERE code = 'conflict_type_logistics_crisis'), (SELECT id FROM taxonomies WHERE code = 'region_red_sea'), (SELECT id FROM countries WHERE iso3 = 'YEM'), 'active', 4, 4, 4, TRUE, TRUE, TRUE, '2023-10-01', 12.5833, 43.3333, ST_SetSRID(ST_MakePoint(43.3333, 12.5833), 4326), 'point', 'La zona conecta Bab el-Mandeb, Mar Rojo y Suez, con alta relevancia para comercio y energía.', 'Activo; requiere seguimiento de ataques marítimos, desvíos de rutas y despliegues navales.', 'Caso prioritario para estudiar chokepoints, actores no estatales, rutas energéticas y riesgo logístico.', 2, 'partially_verified'),
('tension_estrecho_taiwan', 'Tensión en el Estrecho de Taiwán', 'Taiwan Strait tension', 'Disputa estratégica con implicaciones militares, tecnológicas, comerciales y marítimas.', (SELECT id FROM taxonomies WHERE code = 'conflict_type_territorial_dispute'), (SELECT id FROM taxonomies WHERE code = 'region_indopacific'), (SELECT id FROM countries WHERE iso3 = 'TWN'), 'active', 3, 5, 2, TRUE, TRUE, TRUE, NULL, 24.0000, 121.0000, ST_SetSRID(ST_MakePoint(121.0000, 24.0000), 4326), 'point', 'Tensión de largo plazo vinculada a soberanía, disuasión, semiconductores, rutas marítimas y competencia entre grandes potencias.', 'Tensión persistente con episodios de presión militar y diplomática.', 'Caso clave para conectar teoría de disuasión, poder marítimo, tecnología y competencia EE.UU.-China.', 2, 'partially_verified'),
('conflicto_sudan', 'Conflicto en Sudán', 'Sudan conflict', 'Conflicto armado interno con impacto humanitario, regional y de estabilidad estatal.', (SELECT id FROM taxonomies WHERE code = 'conflict_type_civil_war'), (SELECT id FROM taxonomies WHERE code = 'region_sahel'), (SELECT id FROM countries WHERE iso3 = 'SDN'), 'active', 5, 4, 5, FALSE, TRUE, TRUE, '2023-04-15', 15.5007, 32.5599, ST_SetSRID(ST_MakePoint(32.5599, 15.5007), 4326), 'point', 'Conflicto interno entre fuerzas armadas y actores paramilitares, con impacto regional y humanitario.', 'Activo; requiere seguimiento de control territorial, desplazamiento y mediaciones.', 'Caso importante para analizar fragilidad estatal, actores armados, recursos y seguridad regional.', 2, 'partially_verified'),
('riesgo_golfo_persico_ormuz', 'Riesgo geopolítico en el Golfo Pérsico y Ormuz', 'Persian Gulf and Hormuz geopolitical risk', 'Riesgo estratégico asociado a tensiones en el Golfo, sanciones, presencia militar y seguridad de flujos energéticos.', (SELECT id FROM taxonomies WHERE code = 'conflict_type_energy_crisis'), (SELECT id FROM taxonomies WHERE code = 'region_gulf'), (SELECT id FROM countries WHERE iso3 = 'IRN'), 'active', 3, 5, 2, TRUE, TRUE, TRUE, NULL, 26.5667, 56.2500, ST_SetSRID(ST_MakePoint(56.2500, 26.5667), 4326), 'point', 'El Golfo Pérsico concentra recursos, rutas y rivalidades regionales con impacto energético global.', 'Riesgo latente; requiere seguimiento de sanciones, ataques marítimos y posturas militares.', 'Caso prioritario para política energética, seguridad de suministro, OPEC, Ormuz y rivalidades regionales.', 2, 'partially_verified')
ON CONFLICT (slug) DO UPDATE SET
    summary = EXCLUDED.summary,
    conflict_type_id = EXCLUDED.conflict_type_id,
    primary_region_id = EXCLUDED.primary_region_id,
    primary_country_id = EXCLUDED.primary_country_id,
    intensity_level = EXCLUDED.intensity_level,
    escalation_risk = EXCLUDED.escalation_risk,
    humanitarian_impact = EXCLUDED.humanitarian_impact,
    energy_dimension = EXCLUDED.energy_dimension,
    territorial_dimension = EXCLUDED.territorial_dimension,
    external_involvement = EXCLUDED.external_involvement,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geom = EXCLUDED.geom,
    current_status = EXCLUDED.current_status,
    analytical_assessment = EXCLUDED.analytical_assessment,
    updated_at = now();

-- ============================================================
-- 10. Relaciones conflictos-actores estatales
-- ============================================================

INSERT INTO conflict_state_actors (conflict_id, state_actor_id, role_id, alignment, involvement_level, description, source_confidence)
VALUES
((SELECT id FROM conflicts WHERE slug = 'guerra_ucrania'), (SELECT id FROM state_actors WHERE slug = 'ucrania'), (SELECT id FROM taxonomies WHERE code = 'role_belligerent'), 'ally', 5, 'Parte directamente involucrada en el conflicto.', 2),
((SELECT id FROM conflicts WHERE slug = 'guerra_ucrania'), (SELECT id FROM state_actors WHERE slug = 'rusia'), (SELECT id FROM taxonomies WHERE code = 'role_belligerent'), 'adversary', 5, 'Parte directamente involucrada en el conflicto.', 2),
((SELECT id FROM conflicts WHERE slug = 'guerra_ucrania'), (SELECT id FROM state_actors WHERE slug = 'estado_unidos'), (SELECT id FROM taxonomies WHERE code = 'role_supporter'), 'ally', 4, 'Actor externo con apoyo político, económico y militar a Ucrania.', 2),
((SELECT id FROM conflicts WHERE slug = 'crisis_mar_rojo_yemen'), (SELECT id FROM state_actors WHERE slug = 'estado_unidos'), (SELECT id FROM taxonomies WHERE code = 'role_affected_actor'), 'adversary', 4, 'Actor con presencia naval e interés en seguridad marítima.', 2),
((SELECT id FROM conflicts WHERE slug = 'crisis_mar_rojo_yemen'), (SELECT id FROM state_actors WHERE slug = 'iran'), (SELECT id FROM taxonomies WHERE code = 'role_supporter'), 'contested', 3, 'Actor regional relevante en el entorno estratégico del conflicto.', 2),
((SELECT id FROM conflicts WHERE slug = 'riesgo_golfo_persico_ormuz'), (SELECT id FROM state_actors WHERE slug = 'iran'), (SELECT id FROM taxonomies WHERE code = 'role_affected_actor'), 'contested', 5, 'Actor ribereño y central en el riesgo estratégico de Ormuz.', 2),
((SELECT id FROM conflicts WHERE slug = 'riesgo_golfo_persico_ormuz'), (SELECT id FROM state_actors WHERE slug = 'arabia_saudita'), (SELECT id FROM taxonomies WHERE code = 'role_affected_actor'), 'contested', 4, 'Actor energético regional afectado por riesgos de suministro del Golfo.', 2),
((SELECT id FROM conflicts WHERE slug = 'tension_estrecho_taiwan'), (SELECT id FROM state_actors WHERE slug = 'china'), (SELECT id FROM taxonomies WHERE code = 'role_belligerent'), 'contested', 5, 'Actor principal en la disputa estratégica sobre Taiwán.', 2),
((SELECT id FROM conflicts WHERE slug = 'tension_estrecho_taiwan'), (SELECT id FROM state_actors WHERE slug = 'estado_unidos'), (SELECT id FROM taxonomies WHERE code = 'role_supporter'), 'contested', 4, 'Actor externo clave en disuasión, alianzas y equilibrio regional.', 2)
ON CONFLICT (conflict_id, state_actor_id, role_id) DO UPDATE SET
    alignment = EXCLUDED.alignment,
    involvement_level = EXCLUDED.involvement_level,
    description = EXCLUDED.description,
    source_confidence = EXCLUDED.source_confidence;

-- ============================================================
-- 11. Relaciones conflictos-actores no estatales
-- ============================================================

INSERT INTO conflict_non_state_actors (conflict_id, non_state_actor_id, role_id, alignment, involvement_level, description, source_confidence)
VALUES
((SELECT id FROM conflicts WHERE slug = 'crisis_mar_rojo_yemen'), (SELECT id FROM non_state_actors WHERE slug = 'huties_yemen'), (SELECT id FROM taxonomies WHERE code = 'role_belligerent'), 'adversary', 5, 'Actor no estatal central para la dinámica de seguridad marítima en el Mar Rojo.', 2),
((SELECT id FROM conflicts WHERE slug = 'conflicto_sudan'), (SELECT id FROM non_state_actors WHERE slug = 'rsf_sudan'), (SELECT id FROM taxonomies WHERE code = 'role_belligerent'), 'adversary', 5, 'Actor armado central en el conflicto sudanés.', 2)
ON CONFLICT (conflict_id, non_state_actor_id, role_id) DO UPDATE SET
    alignment = EXCLUDED.alignment,
    involvement_level = EXCLUDED.involvement_level,
    description = EXCLUDED.description,
    source_confidence = EXCLUDED.source_confidence;

-- ============================================================
-- 12. Relaciones conflictos-recursos
-- ============================================================

INSERT INTO conflict_resources (conflict_id, resource_id, relationship_type_id, relevance_level, description, source_confidence)
VALUES
((SELECT id FROM conflicts WHERE slug = 'guerra_ucrania'), (SELECT id FROM energy_resources WHERE slug = 'gas_natural'), (SELECT id FROM taxonomies WHERE code = 'relationship_consequence'), 5, 'El conflicto tiene implicaciones para seguridad energética europea y rutas de suministro.', 2),
((SELECT id FROM conflicts WHERE slug = 'guerra_ucrania'), (SELECT id FROM energy_resources WHERE slug = 'fertilizantes'), (SELECT id FROM taxonomies WHERE code = 'relationship_consequence'), 4, 'El conflicto puede afectar cadenas agrícolas y fertilizantes.', 2),
((SELECT id FROM conflicts WHERE slug = 'crisis_mar_rojo_yemen'), (SELECT id FROM energy_resources WHERE slug = 'petroleo_crudo'), (SELECT id FROM taxonomies WHERE code = 'relationship_vulnerability'), 4, 'La inseguridad marítima aumenta riesgo de tránsito energético por Mar Rojo/Suez.', 2),
((SELECT id FROM conflicts WHERE slug = 'crisis_mar_rojo_yemen'), (SELECT id FROM energy_resources WHERE slug = 'lng'), (SELECT id FROM taxonomies WHERE code = 'relationship_vulnerability'), 4, 'La crisis puede afectar rutas LNG según origen, destino y desvíos.', 2),
((SELECT id FROM conflicts WHERE slug = 'riesgo_golfo_persico_ormuz'), (SELECT id FROM energy_resources WHERE slug = 'petroleo_crudo'), (SELECT id FROM taxonomies WHERE code = 'relationship_vulnerability'), 5, 'El riesgo de Ormuz es directamente relevante para exportaciones de petróleo del Golfo.', 2),
((SELECT id FROM conflicts WHERE slug = 'riesgo_golfo_persico_ormuz'), (SELECT id FROM energy_resources WHERE slug = 'lng'), (SELECT id FROM taxonomies WHERE code = 'relationship_vulnerability'), 5, 'El riesgo de Ormuz es relevante para flujos de LNG desde el Golfo.', 2),
((SELECT id FROM conflicts WHERE slug = 'tension_estrecho_taiwan'), (SELECT id FROM energy_resources WHERE slug = 'petroleo_crudo'), (SELECT id FROM taxonomies WHERE code = 'relationship_consequence'), 3, 'Una crisis regional podría afectar rutas marítimas energéticas asiáticas.', 2)
ON CONFLICT (conflict_id, resource_id, relationship_type_id) DO UPDATE SET
    relevance_level = EXCLUDED.relevance_level,
    description = EXCLUDED.description,
    source_confidence = EXCLUDED.source_confidence;

-- ============================================================
-- 13. Relaciones conflictos-chokepoints
-- ============================================================

INSERT INTO conflict_chokepoints (conflict_id, chokepoint_id, relationship_type_id, risk_level, description, source_confidence)
VALUES
((SELECT id FROM conflicts WHERE slug = 'crisis_mar_rojo_yemen'), (SELECT id FROM chokepoints WHERE slug = 'bab_el_mandeb'), (SELECT id FROM taxonomies WHERE code = 'relationship_vulnerability'), 5, 'Bab el-Mandeb es el chokepoint directamente asociado a la crisis del Mar Rojo.', 2),
((SELECT id FROM conflicts WHERE slug = 'crisis_mar_rojo_yemen'), (SELECT id FROM chokepoints WHERE slug = 'canal_de_suez'), (SELECT id FROM taxonomies WHERE code = 'relationship_consequence'), 4, 'La inseguridad al sur del Mar Rojo puede afectar flujos hacia Suez.', 2),
((SELECT id FROM conflicts WHERE slug = 'riesgo_golfo_persico_ormuz'), (SELECT id FROM chokepoints WHERE slug = 'estrecho_de_ormuz'), (SELECT id FROM taxonomies WHERE code = 'relationship_vulnerability'), 5, 'Ormuz es el punto crítico del riesgo energético en el Golfo.', 2),
((SELECT id FROM conflicts WHERE slug = 'guerra_ucrania'), (SELECT id FROM chokepoints WHERE slug = 'estrechos_turcos'), (SELECT id FROM taxonomies WHERE code = 'relationship_consequence'), 4, 'Los Estrechos Turcos son relevantes para el acceso marítimo entre Mar Negro y Mediterráneo.', 2),
((SELECT id FROM conflicts WHERE slug = 'tension_estrecho_taiwan'), (SELECT id FROM chokepoints WHERE slug = 'estrecho_de_malaca'), (SELECT id FROM taxonomies WHERE code = 'relationship_consequence'), 3, 'Una crisis en Asia Oriental puede elevar sensibilidad sobre rutas energéticas y comerciales regionales.', 2)
ON CONFLICT (conflict_id, chokepoint_id, relationship_type_id) DO UPDATE SET
    risk_level = EXCLUDED.risk_level,
    description = EXCLUDED.description,
    source_confidence = EXCLUDED.source_confidence;

-- ============================================================
-- 14. Relaciones causa-efecto piloto
-- ============================================================

INSERT INTO causal_links (
    source_entity_type,
    source_entity_id,
    target_entity_type,
    target_entity_id,
    link_type,
    title,
    explanation,
    mechanism,
    strength,
    confidence_score,
    status
)
VALUES
('conflict', (SELECT id FROM conflicts WHERE slug = 'crisis_mar_rojo_yemen'), 'chokepoint', (SELECT id FROM chokepoints WHERE slug = 'bab_el_mandeb'), 'risk_indicator', 'Crisis del Mar Rojo aumenta riesgo en Bab el-Mandeb', 'La presencia de ataques o amenazas marítimas incrementa el riesgo percibido en el paso estratégico.', 'Riesgo de navegación, aumento de seguros, desvío de rutas y despliegue naval.', 5, 2, 'active'),
('chokepoint', (SELECT id FROM chokepoints WHERE slug = 'estrecho_de_ormuz'), 'energy_resource', (SELECT id FROM energy_resources WHERE slug = 'petroleo_crudo'), 'risk_indicator', 'Ormuz como indicador de riesgo petrolero', 'Una escalada en torno a Ormuz puede afectar expectativas de suministro petrolero.', 'Amenaza sobre tránsito marítimo energético y percepción de riesgo en mercados.', 5, 2, 'active'),
('conflict', (SELECT id FROM conflicts WHERE slug = 'guerra_ucrania'), 'energy_resource', (SELECT id FROM energy_resources WHERE slug = 'gas_natural'), 'consequence', 'Guerra en Ucrania y seguridad del gas', 'El conflicto está conectado con cambios en seguridad energética, rutas y dependencia de suministro.', 'Sanciones, destrucción de infraestructura, reajuste de proveedores y diversificación energética.', 5, 2, 'active'),
('conflict', (SELECT id FROM conflicts WHERE slug = 'tension_estrecho_taiwan'), 'energy_resource', (SELECT id FROM energy_resources WHERE slug = 'cobre'), 'risk_indicator', 'Taiwán como riesgo para cadenas tecnológicas y electrificación', 'Una crisis en el Estrecho de Taiwán puede afectar cadenas tecnológicas y, por extensión, demanda y logística de materiales estratégicos.', 'Disrupción comercial, sanciones, bloqueos o reordenamiento de cadenas de suministro.', 3, 2, 'active')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 15. Eventos piloto
-- ============================================================

INSERT INTO events (
    slug,
    title_es,
    title_en,
    event_type_id,
    event_date,
    conflict_id,
    primary_region_id,
    country_id,
    latitude,
    longitude,
    geom,
    geometry_type,
    description,
    immediate_impact,
    strategic_significance,
    impact_level,
    verification,
    source_confidence
)
VALUES
('evento_inicio_guerra_ucrania_2022', 'Inicio de la invasión rusa a gran escala de Ucrania', 'Start of Russia''s full-scale invasion of Ukraine', (SELECT id FROM taxonomies WHERE code = 'event_type_attack'), '2022-02-24', (SELECT id FROM conflicts WHERE slug = 'guerra_ucrania'), (SELECT id FROM taxonomies WHERE code = 'region_eastern_europe'), (SELECT id FROM countries WHERE iso3 = 'UKR'), 49.0000, 32.0000, ST_SetSRID(ST_MakePoint(32.0000, 49.0000), 4326), 'point', 'Evento inicial usado como marcador cronológico de la fase de guerra a gran escala.', 'Escalada militar mayor.', 'Reconfiguración de seguridad europea y energía.', 5, 'partially_verified', 2),
('evento_crisis_mar_rojo_seed', 'Marcador inicial de crisis marítima en el Mar Rojo', 'Initial Red Sea maritime crisis marker', (SELECT id FROM taxonomies WHERE code = 'event_type_blockade'), '2023-10-01', (SELECT id FROM conflicts WHERE slug = 'crisis_mar_rojo_yemen'), (SELECT id FROM taxonomies WHERE code = 'region_red_sea'), (SELECT id FROM countries WHERE iso3 = 'YEM'), 12.5833, 43.3333, ST_SetSRID(ST_MakePoint(43.3333, 12.5833), 4326), 'point', 'Evento semilla para representar el inicio del seguimiento de seguridad marítima en el Mar Rojo.', 'Aumento del riesgo logístico.', 'Conexión entre actor no estatal, chokepoint y rutas comerciales.', 4, 'partially_verified', 2)
ON CONFLICT (slug) DO UPDATE SET
    title_es = EXCLUDED.title_es,
    description = EXCLUDED.description,
    immediate_impact = EXCLUDED.immediate_impact,
    strategic_significance = EXCLUDED.strategic_significance,
    updated_at = now();

-- ============================================================
-- 16. Etiquetado transversal mínimo
-- ============================================================

-- Conflictos con temas principales
INSERT INTO entity_taxonomies (entity_type, entity_id, taxonomy_id, relevance_score, is_primary, notes)
VALUES
('conflict', (SELECT id FROM conflicts WHERE slug = 'guerra_ucrania'), (SELECT id FROM taxonomies WHERE code = 'theme_conflict_security'), 100, TRUE, 'Tema principal'),
('conflict', (SELECT id FROM conflicts WHERE slug = 'guerra_ucrania'), (SELECT id FROM taxonomies WHERE code = 'theme_energy_resources'), 80, FALSE, 'Dimensión energética'),
('conflict', (SELECT id FROM conflicts WHERE slug = 'crisis_mar_rojo_yemen'), (SELECT id FROM taxonomies WHERE code = 'theme_routes_trade'), 100, TRUE, 'Tema principal'),
('conflict', (SELECT id FROM conflicts WHERE slug = 'crisis_mar_rojo_yemen'), (SELECT id FROM taxonomies WHERE code = 'theme_energy_resources'), 85, FALSE, 'Dimensión energética'),
('conflict', (SELECT id FROM conflicts WHERE slug = 'tension_estrecho_taiwan'), (SELECT id FROM taxonomies WHERE code = 'theme_great_powers'), 100, TRUE, 'Competencia de grandes potencias'),
('conflict', (SELECT id FROM conflicts WHERE slug = 'riesgo_golfo_persico_ormuz'), (SELECT id FROM taxonomies WHERE code = 'theme_energy_resources'), 100, TRUE, 'Seguridad energética')
ON CONFLICT (entity_type, entity_id, taxonomy_id) DO UPDATE SET
    relevance_score = EXCLUDED.relevance_score,
    is_primary = EXCLUDED.is_primary,
    notes = EXCLUDED.notes;

-- ============================================================
-- 17. Capas iniciales del mapa
-- ============================================================

INSERT INTO map_layers (
    slug,
    label_es,
    label_en,
    layer_type_id,
    theme_id,
    description,
    geometry_type,
    data_source_entity_type,
    data_source_ref,
    default_visible,
    style_token,
    min_zoom,
    max_zoom,
    refresh_frequency,
    status
)
VALUES
('conflictos_activos', 'Conflictos activos', 'Active conflicts', (SELECT id FROM taxonomies WHERE code = 'theme_conflict_security'), (SELECT id FROM taxonomies WHERE code = 'theme_conflict_security'), 'Capa de conflictos activos y crisis en seguimiento.', 'point', 'view', 'v_active_conflicts_map', TRUE, 'map_conflict_red', 2, 12, 'manual_weekly', 'active'),
('chokepoints', 'Chokepoints', 'Chokepoints', (SELECT id FROM taxonomies WHERE code = 'route_type_maritime_chokepoint'), (SELECT id FROM taxonomies WHERE code = 'theme_routes_trade'), 'Capa de pasos estratégicos marítimos y canales.', 'point', 'view', 'v_chokepoints_map', TRUE, 'map_chokepoint_amber', 2, 12, 'manual_monthly', 'active'),
('recursos_energeticos', 'Recursos energéticos', 'Energy resources', (SELECT id FROM taxonomies WHERE code = 'theme_energy_resources'), (SELECT id FROM taxonomies WHERE code = 'theme_energy_resources'), 'Capa de recursos energéticos y ubicaciones estratégicas.', 'point', 'view', 'v_energy_resource_locations_map', FALSE, 'map_energy_blue', 2, 12, 'manual_monthly', 'active')
ON CONFLICT (slug) DO UPDATE SET
    label_es = EXCLUDED.label_es,
    description = EXCLUDED.description,
    default_visible = EXCLUDED.default_visible,
    style_token = EXCLUDED.style_token,
    last_updated = now();

COMMIT;

