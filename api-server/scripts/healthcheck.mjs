// GEOPÓLEM API v1 (Sprint 4) — healthcheck de contenedor, sin dependencias.
// ---------------------------------------------------------------------------
// Consulta /api/v1/health en el propio proceso. Sale 0 si el servicio responde
// con status "ok" (con o sin DB, porque el endpoint funciona en fallback).
// Usado por el HEALTHCHECK del Dockerfile.  Ejecuta: node scripts/healthcheck.mjs
// ---------------------------------------------------------------------------

const port = process.env.PORT || 8787;
const host = process.env.HEALTHCHECK_HOST || '127.0.0.1';
const url = `http://${host}:${port}/api/v1/health`;

try {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 4000);
  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(t);
  const body = await res.json();
  if (res.status === 200 && body?.data?.status === 'ok') {
    process.exit(0);
  }
  console.error(`healthcheck: respuesta inesperada (status=${res.status})`);
  process.exit(1);
} catch (err) {
  console.error('healthcheck: error', err?.message || err);
  process.exit(1);
}
