// GEOPÓLEM (Sprint 12) — tests del cliente PURO de analítica (analytics.mjs).
// ---------------------------------------------------------------------------
// Verifica: vocabulario cerrado de eventos, sanitización/allow-list de props
// (anti-PII), modo NO-OP por defecto (sin endpoint), degradación offline y que
// el módulo NO usa almacenamiento del navegador.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const {
  buildEvent, sanitizeProps, createAnalytics, EVENT_TYPES,
} = await import('../../analytics.mjs');

/* ---------------------------------------------------------------- buildEvent */

test('buildEvent acepta sólo tipos del vocabulario cerrado', () => {
  for (const t of EVENT_TYPES) {
    const ev = buildEvent(t, {}, { now: 0 });
    assert.ok(ev, `${t} debería construir`);
    assert.equal(ev.type, t);
    assert.equal(ev.ts, new Date(0).toISOString());
  }
});

test('buildEvent descarta tipos desconocidos → null', () => {
  for (const bad of ['nope', '', null, undefined, 42, {}, 'VIEW_CONFLICT']) {
    assert.equal(buildEvent(bad), null);
  }
});

/* -------------------------------------------------------------- sanitizeProps */

test('sanitizeProps aplica allow-list (descarta claves no permitidas → anti-PII)', () => {
  const clean = sanitizeProps({
    conflict: 'ukr-rus', dimension: 'region', value: 'MENA',
    email: 'user@example.com', ip: '1.2.3.4', name: 'Juan', token: 'abc',
  });
  assert.deepEqual(clean, { conflict: 'ukr-rus', dimension: 'region', value: 'MENA' });
});

test('sanitizeProps trunca cadenas largas (evita URLs con tokens/PII)', () => {
  const long = 'x'.repeat(500);
  const clean = sanitizeProps({ value: long });
  assert.equal(clean.value.length, 120);
});

test('sanitizeProps descarta objetos/arrays anidados (sin datos profundos)', () => {
  const clean = sanitizeProps({ value: { nested: 1 }, conflict: ['a'], count: 3 });
  assert.deepEqual(clean, { count: 3 });
});

test('sanitizeProps con entrada no-objeto → {}', () => {
  for (const bad of [null, undefined, 42, 'x', [1, 2]]) {
    assert.deepEqual(sanitizeProps(bad), {});
  }
});

/* ------------------------------------------------------------- modo NO-OP */

test('sin endpoint el cliente es NO-OP (isNoop) pero sigue sanitizando', () => {
  const seen = [];
  const a = createAnalytics({ onEvent: (e) => seen.push(e) });
  assert.equal(a.isNoop, true);
  const ev = a.track('view_conflict', { conflict: 'ukr-rus', secret: 'x' });
  assert.deepEqual(ev.props, { conflict: 'ukr-rus' });
  assert.equal(seen.length, 1);
});

test('enabled=false fuerza NO-OP aunque haya endpoint', () => {
  const a = createAnalytics({ endpoint: 'https://c.example/e', enabled: false });
  assert.equal(a.isNoop, true);
});

test('track nunca lanza y descarta tipos inválidos devolviendo null', () => {
  const a = createAnalytics({});
  assert.equal(a.track('inexistente'), null);
  assert.doesNotThrow(() => a.track('view_conflict'));
});

test('degradación offline: con endpoint pero sin navigator (Node) no envía', () => {
  // En Node no existe `navigator`, isOnline()=false → deliver() es no-op, pero
  // el evento se sanitiza igual y se entrega al observador.
  const seen = [];
  const a = createAnalytics({ endpoint: 'https://c.example/e', onEvent: (e) => seen.push(e) });
  assert.equal(a.isNoop, false); // configurado, aunque el transporte degrade.
  const ev = a.track('open_deeplink', { view: 'map' });
  assert.equal(ev.type, 'open_deeplink');
  assert.equal(seen.length, 1);
});

/* --------------------------------------------------- sin almacenamiento */

test('analytics.mjs NO usa localStorage/sessionStorage/indexedDB/cookies', () => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(resolve(__dirname, '../../analytics.mjs'), 'utf8');
  // Comprobamos USO real (acceso a la API), no menciones en comentarios.
  assert.ok(!/localStorage\s*[.\[]/.test(src), 'no debe usar localStorage');
  assert.ok(!/sessionStorage\s*[.\[]/.test(src), 'no debe usar sessionStorage');
  assert.ok(!/indexedDB\s*[.\[]/.test(src), 'no debe usar indexedDB');
  assert.ok(!/document\.cookie/.test(src), 'no debe usar cookies');
});
