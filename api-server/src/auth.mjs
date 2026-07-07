// GEOPÓLEM API v1 (Sprint 5) — autenticación JWT (HS256) opcional por entorno.
// ---------------------------------------------------------------------------
// Verificación de JWT HS256 SIN dependencias externas (node:crypto). Política
// activable por entorno (GEOP_API_AUTH_MODE):
//
//   public   → no se aplica auth (por defecto). La PWA y GitHub Pages siguen
//              consumiendo la API de lectura de forma anónima. Sin cambios.
//   optional → si llega `Authorization: Bearer <jwt>`, se valida y, si es
//              inválido/expirado, responde 401. Sin token, se permite igual.
//   required → todo endpoint de datos exige un Bearer token válido → 401 si no.
//
// /api/v1/health queda SIEMPRE público (healthcheck de contenedor y oncall),
// para que la observabilidad y el arranque no dependan de credenciales.
//
// Sólo se admite HS256 con `JWT_SECRET`. Si el modo != public y falta el
// secreto, es un ERROR DE CONFIGURACIÓN → 500 (fail-closed, no se sirve dato
// sin poder verificar). Nunca se hardcodean secretos.
// ---------------------------------------------------------------------------

import { createHmac, timingSafeEqual } from 'node:crypto';
import { CONFIG } from './config.mjs';
import { apiError } from './response.mjs';

// Rutas siempre públicas, incluso en modo required (observabilidad/arranque).
const PUBLIC_PATHS = new Set(['/api/v1/health']);

function base64urlToBuffer(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64');
}

function base64urlDecodeJson(str) {
  return JSON.parse(base64urlToBuffer(str).toString('utf8'));
}

// Verifica un JWT HS256. Devuelve { valid, payload?, reason? }.
export function verifyJwt(token, secret, opts = {}) {
  if (!token || typeof token !== 'string') return { valid: false, reason: 'token ausente' };
  if (!secret) return { valid: false, reason: 'secreto no configurado' };

  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'formato JWT inválido' };
  const [headerB64, payloadB64, signatureB64] = parts;

  let header;
  let payload;
  try {
    header = base64urlDecodeJson(headerB64);
    payload = base64urlDecodeJson(payloadB64);
  } catch {
    return { valid: false, reason: 'cabecera/payload no decodificables' };
  }

  if (header.alg !== 'HS256') return { valid: false, reason: `alg no soportado: ${header.alg}` };

  // Firma HMAC-SHA256 sobre `header.payload`, comparación en tiempo constante.
  const expected = createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const provided = base64urlToBuffer(signatureB64);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return { valid: false, reason: 'firma inválida' };
  }

  const now = Math.floor(Date.now() / 1000);
  const leeway = Number.isFinite(opts.leewaySec) ? opts.leewaySec : 0;
  if (payload.exp != null && now > Number(payload.exp) + leeway) {
    return { valid: false, reason: 'token expirado' };
  }
  if (payload.nbf != null && now + leeway < Number(payload.nbf)) {
    return { valid: false, reason: 'token aún no válido (nbf)' };
  }
  if (opts.issuer && payload.iss !== opts.issuer) {
    return { valid: false, reason: 'emisor (iss) no coincide' };
  }
  if (opts.audience && !audienceMatches(payload.aud, opts.audience)) {
    return { valid: false, reason: 'audiencia (aud) no coincide' };
  }

  return { valid: true, payload };
}

function audienceMatches(aud, expected) {
  if (Array.isArray(aud)) return aud.includes(expected);
  return aud === expected;
}

// Extrae el token Bearer de la cabecera Authorization.
export function extractBearer(authorization) {
  if (!authorization || typeof authorization !== 'string') return null;
  const m = authorization.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

// Aplica la política de auth a una petición.
// Devuelve `null` si se permite continuar, o `{ status, body }` (error) si se
// debe cortar. `context.authorization` es la cabecera cruda.
export function authorize(path, context = {}) {
  const mode = CONFIG.authMode;
  if (mode === 'public') return null;
  if (PUBLIC_PATHS.has(path)) return null;

  // Modo != public exige secreto configurado; si falta, fail-closed (500).
  if (!CONFIG.jwtSecret) {
    const e = apiError('internal_error',
      'Auth activada (GEOP_API_AUTH_MODE) pero JWT_SECRET no está configurado.');
    return { status: e.status, body: e.body };
  }

  const token = extractBearer(context.authorization);

  if (!token) {
    if (mode === 'optional') return null; // sin token → acceso anónimo permitido
    const e = apiError('unauthorized', 'Se requiere un Bearer token para este endpoint.');
    return { status: e.status, body: e.body };
  }

  const result = verifyJwt(token, CONFIG.jwtSecret, {
    leewaySec: CONFIG.jwtLeewaySec,
    issuer: CONFIG.jwtIssuer || undefined,
    audience: CONFIG.jwtAudience || undefined,
  });
  if (!result.valid) {
    const e = apiError('unauthorized', `Token inválido: ${result.reason}.`);
    return { status: e.status, body: e.body };
  }

  // Token válido: se permite. (Los claims quedan disponibles por si en el
  // futuro se aplican scopes/roles por ruta.)
  context.claims = result.payload;
  return null;
}
