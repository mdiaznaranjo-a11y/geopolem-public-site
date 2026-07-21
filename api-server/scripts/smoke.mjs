// GEOPÓLEM API v1 (Sprint 3) — smoke test HTTP end-to-end (sin dependencias).
// ---------------------------------------------------------------------------
// Levanta el servidor real en un puerto efímero y hace peticiones HTTP a los
// cinco endpoints. Útil para verificar el arranque completo (node:http + CORS).
// Ejecuta:  node scripts/smoke.mjs      (o: npm run smoke)
// ---------------------------------------------------------------------------

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = resolve(__dirname, '..', 'server.mjs');
const PORT = 8799;

const proc = spawn(process.execPath, [serverPath], {
  env: { ...process.env, PORT: String(PORT), DATABASE_URL: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

async function get(path) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
  const body = await res.json();
  return { status: res.status, body, contentType: res.headers.get('content-type') };
}

try {
  // Espera a que el servidor esté listo.
  for (let i = 0; i < 40; i++) {
    try { await get('/api/v1/health'); break; } catch { await sleep(100); }
  }

  const health = await get('/api/v1/health');
  check('health 200', health.status === 200);
  check('health status ok', health.body.data?.status === 'ok');

  const conflicts = await get('/api/v1/conflicts?page=1&page_size=5');
  check('conflicts 200', conflicts.status === 200);
  check('conflicts lista no vacía', Array.isArray(conflicts.body.data) && conflicts.body.data.length > 0);
  check('conflicts content-type json', /application\/json/.test(conflicts.contentType || ''));

  const map = await get('/api/v1/conflicts/active/map');
  check('map 200', map.status === 200);
  check('map FeatureCollection', map.body.type === 'FeatureCollection');
  check('map content-type geo+json', /geo\+json/.test(map.contentType || ''));

  const slug = conflicts.body.data[0].slug;
  const detail = await get(`/api/v1/conflicts/${encodeURIComponent(slug)}`);
  check('detail 200', detail.status === 200);
  check('detail slug coincide', detail.body.data?.slug === slug);

  const notFound = await get('/api/v1/conflicts/no-existe');
  check('detail inexistente 404', notFound.status === 404);

  const filters = await get('/api/v1/filters');
  check('filters 200', filters.status === 200);
  check('filters regiones', Array.isArray(filters.body.data?.regions) && filters.body.data.regions.length > 0);

  console.log(`\n${failures === 0 ? 'OK' : 'FALLOS'}: ${failures} aserción(es) fallida(s).`);
} catch (err) {
  console.error('Smoke test error:', err);
  failures++;
} finally {
  proc.kill('SIGTERM');
}

process.exit(failures === 0 ? 0 : 1);
