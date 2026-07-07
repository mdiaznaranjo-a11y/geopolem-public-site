// GEOPÓLEM (Sprint 8) — tests del cliente admin (fetch simulado, sin sockets).
// ---------------------------------------------------------------------------
// Verifica: modo DEMO sin token, envío del subconjunto de escritura, y el mapeo
// EXPLÍCITO de errores 401/403/422/429 a AdminApiError tipado.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';

const { createAdminClient, AdminApiError } = await import('../../admin/admin-client.mjs');

// Fetch simulado configurable: registra la última petición y devuelve la
// respuesta programada.
function fakeFetch(response) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      headers: { get: (h) => (response.headers ? response.headers[h] : null) ?? null },
      json: async () => response.body,
    };
  };
  fn.calls = calls;
  return fn;
}

test('DEMO: sin baseUrl/token no hace red y devuelve prepared', async () => {
  const client = createAdminClient({});
  assert.equal(client.demoMode, true);
  const { status, body } = await client.createConflict({ slug: 'demo-x', name: 'Demo válido', status: 'published' });
  assert.equal(status, 200);
  assert.equal(body.meta.persisted, false);
  assert.equal(body.meta.mode, 'prepared');
  assert.equal(body.meta.demo, true);
  assert.equal(body.data.cms_status, 'published');
  assert.equal(body.data.status, 'active');
});

test('DEMO: payload inválido → AdminApiError kind=validation antes de red', async () => {
  const client = createAdminClient({});
  await assert.rejects(
    () => client.createConflict({ name: 'X' }),
    (e) => e instanceof AdminApiError && e.kind === 'validation' && Array.isArray(e.details.errors),
  );
});

test('real: envía sólo el subconjunto de escritura y cabecera Bearer', async () => {
  const ff = fakeFetch({ status: 201, body: { data: { id: 'c1', slug: 'foco' }, meta: { persisted: true, mode: 'database' } } });
  const client = createAdminClient({ baseUrl: 'https://api.test', token: 'tok', fetchImpl: ff });
  assert.equal(client.demoMode, false);
  const { status } = await client.createConflict({ slug: 'foco', name: 'Foco válido', country: 'Yemen', sources: [{ title: 'T', url: 'https://a.org' }] });
  assert.equal(status, 201);
  const sent = JSON.parse(ff.calls[0].init.body);
  assert.ok('slug' in sent && 'name' in sent);
  assert.ok(!('country' in sent), 'no debe enviar metadatos editoriales');
  assert.ok(!('sources' in sent));
  assert.equal(ff.calls[0].init.headers.Authorization, 'Bearer tok');
});

test('error 401 → AdminApiError kind=auth', async () => {
  const ff = fakeFetch({ status: 401, body: { error: { code: 'unauthorized', message: 'sin token' } } });
  const client = createAdminClient({ baseUrl: 'https://api.test', token: 'tok', fetchImpl: ff });
  await assert.rejects(() => client.createConflict({ slug: 'x', name: 'Nombre válido' }),
    (e) => e instanceof AdminApiError && e.kind === 'auth' && e.status === 401);
});

test('error 403 → AdminApiError kind=forbidden', async () => {
  const ff = fakeFetch({ status: 403, body: { error: { code: 'forbidden', message: 'scope' } } });
  const client = createAdminClient({ baseUrl: 'https://api.test', token: 'tok', fetchImpl: ff });
  await assert.rejects(() => client.createConflict({ slug: 'x', name: 'Nombre válido' }),
    (e) => e.kind === 'forbidden' && e.status === 403);
});

test('error 422 → AdminApiError kind=validation con details', async () => {
  const ff = fakeFetch({ status: 422, body: { error: { code: 'validation_error', message: 'bad', details: { errors: [{ field: 'slug', message: 'x' }] } } } });
  const client = createAdminClient({ baseUrl: 'https://api.test', token: 'tok', fetchImpl: ff });
  // payload válido en cliente para llegar a la red y que el 422 venga del server
  await assert.rejects(() => client.createConflict({ slug: 'x', name: 'Nombre válido' }),
    (e) => e.kind === 'validation' && e.status === 422 && Array.isArray(e.details.errors));
});

test('error 429 → AdminApiError kind=rate_limit con Retry-After', async () => {
  const ff = fakeFetch({ status: 429, headers: { 'Retry-After': '30' }, body: { error: { code: 'rate_limited', message: 'slow down' } } });
  const client = createAdminClient({ baseUrl: 'https://api.test', token: 'tok', fetchImpl: ff });
  await assert.rejects(() => client.createConflict({ slug: 'x', name: 'Nombre válido' }),
    (e) => e.kind === 'rate_limit' && e.retryAfterSec === 30);
});

test('setStatus: transición inválida no llega a red', async () => {
  const ff = fakeFetch({ status: 200, body: {} });
  const client = createAdminClient({ baseUrl: 'https://api.test', token: 'tok', fetchImpl: ff });
  await assert.rejects(() => client.setStatus('foco', 'draft', 'published'),
    (e) => e.kind === 'validation');
  assert.equal(ff.calls.length, 0);
});
