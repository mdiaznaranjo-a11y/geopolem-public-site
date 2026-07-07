// GEOPÓLEM API v1 (Sprint 3) — servidor HTTP read-only.
// ---------------------------------------------------------------------------
// Servidor mínimo basado en node:http (cero dependencias en tiempo de
// ejecución; `pg` es opcional y sólo se carga si hay DATABASE_URL). Sirve el
// contrato v1 alimentando web/PWA/mapa. Sin DB usa el puente estático.
//
// Arranque:   node server.mjs      (o: npm start)
// Puerto:     PORT (por defecto 8787)
// ---------------------------------------------------------------------------

import { createServer } from 'node:http';
import { CONFIG, hasDatabase } from './src/config.mjs';
import { route } from './src/router.mjs';
import { recordSource } from './src/observability.mjs';

function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', CONFIG.corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
}

function isGeoJson(body) {
  return body && body.type === 'FeatureCollection';
}

const server = createServer(async (req, res) => {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let result;
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const context = { authorization: req.headers['authorization'] || null };
    result = await route(req.method, url.pathname, url.searchParams, context);
  } catch (err) {
    console.error('[geopolem-api] error no controlado:', err);
    recordSource('unhandled', 'error', null);
    result = {
      status: 500,
      body: { error: { code: 'internal_error', message: 'Error interno del servidor.' } },
    };
  }

  const contentType = isGeoJson(result.body)
    ? 'application/geo+json; charset=utf-8'
    : 'application/json; charset=utf-8';
  res.writeHead(result.status, { 'Content-Type': contentType });
  res.end(req.method === 'HEAD' ? undefined : JSON.stringify(result.body));
});

server.listen(CONFIG.port, CONFIG.host, () => {
  const mode = hasDatabase() ? 'PostgreSQL (con fallback estático)' : 'JSON estático (sin DATABASE_URL)';
  console.log(`GEOPÓLEM API v1 escuchando en http://${CONFIG.host}:${CONFIG.port}${''}`);
  console.log(`Modo de datos: ${mode}`);
  console.log(`Modo de auth: ${CONFIG.authMode}${CONFIG.authMode !== 'public' && !CONFIG.jwtSecret ? ' (¡falta JWT_SECRET! → 500 fail-closed)' : ''}`);
  console.log(`Observabilidad meta.source: logs ${CONFIG.obsLog ? 'ON' : 'OFF'}, contadores en /api/v1/health`);
  console.log('Endpoints:');
  console.log('  GET /api/v1/health');
  console.log('  GET /api/v1/conflicts');
  console.log('  GET /api/v1/conflicts/active/map');
  console.log('  GET /api/v1/conflicts/:id');
  console.log('  GET /api/v1/filters');
});

// Cierre ordenado.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
  });
}
