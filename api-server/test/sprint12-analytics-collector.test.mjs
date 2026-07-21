// GEOPÓLEM (Sprint 12) — tests del colector en memoria + KPIs + endpoint.
// ---------------------------------------------------------------------------
// Verifica: re-sanitización en servidor, agregación por tipo/origen, buffer
// circular acotado, cálculo de KPIs de uso, y el endpoint POST
// /api/v1/analytics/events (desactivado por defecto → 404; activo → 202).
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';

const {
  AnalyticsCollector, normalizeIncomingEvent, computeUsageKpis,
} = await import('../src/analytics.mjs');

/* --------------------------------------------------- normalizeIncomingEvent */

test('normalizeIncomingEvent re-sanitiza props y valida el tipo', () => {
  const ev = normalizeIncomingEvent({
    type: 'view_conflict',
    props: { conflict: 'ukr-rus', email: 'x@y.z' },
  }, 0);
  assert.equal(ev.type, 'view_conflict');
  assert.deepEqual(ev.props, { conflict: 'ukr-rus' });
});

test('normalizeIncomingEvent rechaza tipos fuera del vocabulario', () => {
  assert.equal(normalizeIncomingEvent({ type: 'evil' }), null);
  assert.equal(normalizeIncomingEvent(null), null);
  assert.equal(normalizeIncomingEvent('x'), null);
});

test('normalizeIncomingEvent usa ts del servidor si el del cliente es inválido', () => {
  const ev = normalizeIncomingEvent({ type: 'api_error', ts: 'no-fecha' }, 1000);
  assert.equal(ev.ts, new Date(1000).toISOString());
});

/* --------------------------------------------------------- AnalyticsCollector */

test('collector agrega por tipo y por origen; cuenta aceptados/rechazados', () => {
  const c = new AnalyticsCollector({ maxEvents: 100 });
  c.ingest({ type: 'view_conflict', props: { conflict: 'a', source: 'static' } });
  c.ingest({ type: 'view_conflict', props: { conflict: 'b', source: 'api' } });
  c.ingest({ type: 'select_filter', props: { dimension: 'region', value: 'MENA' } });
  c.ingest({ type: 'evil' }); // rechazado
  const s = c.snapshot();
  assert.equal(s.accepted, 3);
  assert.equal(s.rejected, 1);
  assert.equal(s.by_type.view_conflict, 2);
  assert.equal(s.by_source.static, 1);
  assert.equal(s.by_source.api, 1);
});

test('buffer circular respeta maxEvents (descarta los más antiguos)', () => {
  const c = new AnalyticsCollector({ maxEvents: 3 });
  for (let i = 0; i < 10; i++) c.ingest({ type: 'view_conflict', props: { conflict: String(i) } });
  const s = c.snapshot();
  assert.equal(s.buffered, 3);
  assert.equal(s.accepted, 10); // los contadores acumulados no se pierden.
});

test('reset limpia buffer y contadores', () => {
  const c = new AnalyticsCollector({ maxEvents: 5 });
  c.ingest({ type: 'view_conflict' });
  c.reset();
  const s = c.snapshot();
  assert.equal(s.total, 0);
  assert.equal(s.buffered, 0);
});

/* ---------------------------------------------------------- computeUsageKpis */

test('computeUsageKpis deriva KPIs de uso (únicos, ratios, dimensiones)', () => {
  const events = [
    { type: 'view_conflict', props: { conflict: 'a', source: 'api' } },
    { type: 'view_conflict', props: { conflict: 'a', source: 'static' } },
    { type: 'view_conflict', props: { conflict: 'b', source: 'local' } },
    { type: 'select_filter', props: { dimension: 'region' } },
    { type: 'select_filter', props: { dimension: 'region' } },
    { type: 'open_deeplink', props: {} },
    { type: 'api_error', props: {} },
  ];
  const k = computeUsageKpis(events);
  assert.equal(k.conflict_views, 3);
  assert.equal(k.conflicts_viewed_unique, 2);
  assert.equal(k.filters_used, 2);
  assert.equal(k.deeplinks_opened, 1);
  assert.equal(k.api_errors, 1);
  assert.equal(k.filter_dimensions.region, 2);
  // 3 eventos con source → ratios sobre 3.
  assert.equal(k.source_mix.api, 1);
  assert.equal(k.source_mix.static_ratio, Number((1 / 3).toFixed(4)));
});

test('computeUsageKpis con entrada vacía/no-array → ceros', () => {
  const k = computeUsageKpis(null);
  assert.equal(k.events_total, 0);
  assert.equal(k.conflict_views, 0);
  assert.equal(k.source_mix.api_ratio, null);
});

/* --------------------------------------------------- endpoint vía router */

const { CONFIG } = await import('../src/config.mjs');
const { route } = await import('../src/router.mjs');
const { _resetCollector, getCollector } = await import('../src/analytics.mjs');
CONFIG.obsLog = false;

test('endpoint desactivado por defecto → 404', async () => {
  CONFIG.analyticsEnabled = false;
  const r = await route('POST', '/api/v1/analytics/events', new URLSearchParams(), {
    body: { type: 'view_conflict' },
  });
  assert.equal(r.status, 404);
  assert.equal(r.body.error.code, 'not_found');
});

test('endpoint activo acepta evento (202) y agrega en el colector', async () => {
  CONFIG.analyticsEnabled = true;
  _resetCollector();
  const r = await route('POST', '/api/v1/analytics/events', new URLSearchParams(), {
    body: { type: 'view_conflict', props: { conflict: 'ukr-rus', source: 'static', email: 'x@y.z' } },
  });
  assert.equal(r.status, 202);
  assert.equal(r.body.data.accepted, 1);
  const snap = getCollector().snapshot();
  assert.equal(snap.by_type.view_conflict, 1);
  CONFIG.analyticsEnabled = false;
});

test('endpoint activo acepta lote (array) y descarta inválidos', async () => {
  CONFIG.analyticsEnabled = true;
  _resetCollector();
  const r = await route('POST', '/api/v1/analytics/events', new URLSearchParams(), {
    body: [
      { type: 'view_conflict', props: { conflict: 'a' } },
      { type: 'evil' },
      { type: 'select_filter', props: { dimension: 'region' } },
    ],
  });
  assert.equal(r.status, 202);
  assert.equal(r.body.data.accepted, 2);
  assert.equal(r.body.data.rejected, 1);
  CONFIG.analyticsEnabled = false;
});

test('GET al endpoint no está permitido (405)', async () => {
  CONFIG.analyticsEnabled = true;
  const r = await route('GET', '/api/v1/analytics/events', new URLSearchParams(), {});
  assert.equal(r.status, 405);
  CONFIG.analyticsEnabled = false;
});
