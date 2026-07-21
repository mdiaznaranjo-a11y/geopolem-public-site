// GEOPÓLEM (Sprint 11) — tests del módulo de deep-links por URL.
// ---------------------------------------------------------------------------
// Verifica parse/serialize (round-trip), tolerancia a entradas basura,
// omisión de valores por defecto/'all', filtros numéricos y que el módulo NO
// usa almacenamiento (localStorage/sessionStorage/cookies). Módulo PURO en la
// raíz del repo, consumido por app.js (browser) y por Node.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';

const {
  parseDeepLink, serializeDeepLink, deepLinkEquals, FILTER_KEYS,
} = await import('../../deeplinks.mjs');

/* ------------------------------------------------------------------- parse */

test('hash simple con foco → focus', () => {
  const s = parseDeepLink('#foco=ukr-rus');
  assert.equal(s.focus, 'ukr-rus');
  assert.equal(s.view, null);
  assert.deepEqual(s.filters, {});
});

test('alias conflict= también resuelve focus', () => {
  assert.equal(parseDeepLink('#conflict=isr-gaza-irn').focus, 'isr-gaza-irn');
});

test('view + foco + filtros mixtos', () => {
  const s = parseDeepLink('#view=map&foco=isr-gaza-irn&region=MENA&severity=4&resource=Petróleo');
  assert.equal(s.view, 'map');
  assert.equal(s.focus, 'isr-gaza-irn');
  assert.equal(s.filters.region, 'MENA');
  assert.equal(s.filters.severity, 4); // numérico
  assert.equal(s.filters.resource, 'Petróleo');
});

test('acepta objeto {hash, search} priorizando hash', () => {
  const s = parseDeepLink({ hash: '#foco=a', search: '?foco=b' });
  assert.equal(s.focus, 'a');
});

test('cae a search cuando no hay hash', () => {
  const s = parseDeepLink({ hash: '', search: '?foco=b&view=watchlist' });
  assert.equal(s.focus, 'b');
  assert.equal(s.view, 'watchlist');
});

test('entradas basura o vacías → forma estable sin lanzar', () => {
  for (const bad of [undefined, null, '', '#', '?', '#/', 'foco', '&&&', 42, {}]) {
    const s = parseDeepLink(bad);
    assert.deepEqual(s, { view: null, focus: null, filters: {} });
  }
});

test('valores "all"/vacíos se ignoran; severity no numérica se descarta', () => {
  const s = parseDeepLink('#region=all&status=&severity=abc&type=energia');
  assert.deepEqual(s.filters, { type: 'energia' });
});

test('knownViews filtra vistas desconocidas', () => {
  assert.equal(parseDeepLink('#view=hackerman', { knownViews: ['map'] }).view, null);
  assert.equal(parseDeepLink('#view=map', { knownViews: ['map'] }).view, 'map');
});

test('dimensiones de filtro desconocidas se ignoran', () => {
  const s = parseDeepLink('#foo=bar&region=MENA');
  assert.deepEqual(s.filters, { region: 'MENA' });
  assert.ok(!('foo' in s.filters));
});

/* --------------------------------------------------------------- serialize */

test('serialize omite valores por defecto/vacíos y añade #', () => {
  assert.equal(serializeDeepLink({}), '');
  assert.equal(serializeDeepLink({ view: 'map' }), '#view=map');
  assert.equal(
    serializeDeepLink({ view: 'map', focus: 'ukr-rus', filters: { region: 'MENA', severity: 4 } }),
    '#view=map&foco=ukr-rus&region=MENA&severity=4',
  );
});

test('serialize ignora filtros no reconocidos y "all"', () => {
  const out = serializeDeepLink({ filters: { region: 'all', nope: 'x', chokepoint: 'Ormuz' } });
  assert.equal(out, '#chokepoint=Ormuz');
});

/* -------------------------------------------------------------- round-trip */

test('round-trip parse→serialize→parse es estable', () => {
  const original = '#view=map&foco=isr-gaza-irn&region=MENA&severity=3&actor=Irán';
  const parsed = parseDeepLink(original);
  const serial = serializeDeepLink(parsed);
  const reparsed = parseDeepLink(serial);
  assert.deepEqual(reparsed, parsed);
});

test('deepLinkEquals detecta igualdad estructural sin importar orden', () => {
  const a = { view: 'map', focus: 'x', filters: { region: 'MENA', severity: 4 } };
  const b = { filters: { severity: 4, region: 'MENA' }, focus: 'x', view: 'map' };
  assert.equal(deepLinkEquals(a, b), true);
  assert.equal(deepLinkEquals(a, { view: 'map' }), false);
});

test('FILTER_KEYS cubre las dimensiones del mapa público', () => {
  for (const k of ['region', 'type', 'status', 'severity', 'resource', 'actor', 'chokepoint']) {
    assert.ok(FILTER_KEYS.includes(k), `falta dimensión ${k}`);
  }
});

/* ----------------------------------------------------- sin almacenamiento */

test('el módulo NO referencia localStorage/sessionStorage/cookies', async () => {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const { resolve, dirname } = await import('node:path');
  const here = dirname(fileURLToPath(import.meta.url));
  const src = await readFile(resolve(here, '../../deeplinks.mjs'), 'utf8');
  // Detecta USO real (acceso a la API), no menciones en comentarios.
  assert.ok(!/localStorage\s*[.\[]/.test(src), 'no debe usar localStorage');
  assert.ok(!/sessionStorage\s*[.\[]/.test(src), 'no debe usar sessionStorage');
  assert.ok(!/document\s*\.\s*cookie/.test(src), 'no debe usar cookies');
});
