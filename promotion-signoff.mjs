// GEOPÓLEM — Sign-off humano de promoción a PRODUCCIÓN (Sprint 17)
// ---------------------------------------------------------------------------
// Módulo PURO (sin disco/red por sí mismo: recibe lectores inyectados) que
// resuelve y valida la AUTORIZACIÓN HUMANA EXPLÍCITA requerida para cualquier
// promoción a producción. Sin este sign-off, ningún comando puede promover
// producción (véase scripts/promote-canonical-staging.mjs --promote-production).
//
// El sign-off NO es un secreto: es una declaración auditable de que una persona
// autorizó la promoción. Por eso su formato es texto plano legible y se rechaza
// explícitamente cualquier valor que aparente contener credenciales.
//
// Fuentes admitidas (en orden de prioridad):
//   1) Variable de entorno GEOP_PROMOTION_SIGNOFF="approver=NOMBRE;scope=production;date=YYYY-MM-DD"
//   2) Archivo local NO versionado .promotion-signoff.json (gitignored), con
//      { "approver": "...", "scope": "production", "date": "YYYY-MM-DD", "statement": "..." }
//
// IMPORTANTE (documentado también en el reporte del sprint): esta autorización
// NO debe automatizarse en CI. CI nunca define GEOP_PROMOTION_SIGNOFF.
// ---------------------------------------------------------------------------

export const SIGNOFF_ENV_VAR = 'GEOP_PROMOTION_SIGNOFF';
export const SIGNOFF_FILE = '.promotion-signoff.json';
export const REQUIRED_SCOPE = 'production';

// Campos que jamás deben aparecer en un sign-off: delatan un secreto colado.
const SECRET_HINTS = ['token', 'secret', 'password', 'passwd', 'apikey', 'api_key', 'private_key', 'bearer'];

function looksLikeSecret(text) {
  const low = String(text).toLowerCase();
  return SECRET_HINTS.some((h) => low.includes(h));
}

// Parseo tolerante de "k=v;k2=v2" (env var). Devuelve objeto plano.
function parsePairs(raw) {
  const out = {};
  for (const part of String(raw).split(/[;\n]+/)) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim().toLowerCase();
    const v = part.slice(eq + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

// Normaliza y valida los campos de un sign-off (venga de env o de archivo).
function validateFields(fields, source) {
  const approver = String(fields.approver || '').trim();
  const scope = String(fields.scope || '').trim().toLowerCase();
  const date = String(fields.date || '').trim();
  const statement = String(fields.statement || '').trim();

  const errors = [];
  if (looksLikeSecret(JSON.stringify(fields))) {
    errors.push('el sign-off aparenta contener un secreto (token/clave/password): rechazado');
  }
  if (!approver) errors.push('falta "approver" (persona que autoriza)');
  if (scope !== REQUIRED_SCOPE) errors.push(`"scope" debe ser "${REQUIRED_SCOPE}" (recibido: "${scope || '∅'}")`);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('"date" debe ser YYYY-MM-DD si se indica');

  if (errors.length) return { ok: false, source, reason: errors.join('; '), errors };
  return {
    ok: true,
    source,
    signoff: { approver, scope, date: date || null, statement: statement || null },
  };
}

/* --------------------------------------------------------------------------
   resolveSignoff: resuelve el sign-off desde entorno/archivo (inyectados) y lo
   valida. NO promueve nada; sólo informa si existe autorización válida.

   deps:
     env          — objeto tipo process.env (por defecto {})
     signoffPath  — ruta del archivo local de sign-off (opcional)
     fileExists   — (path) => boolean
     readFile     — (path) => string (contenido JSON)
-------------------------------------------------------------------------- */
export function resolveSignoff({ env = {}, signoffPath = null, fileExists = () => false, readFile = () => '' } = {}) {
  const raw = env[SIGNOFF_ENV_VAR];
  if (typeof raw === 'string' && raw.trim() !== '') {
    return validateFields(parsePairs(raw), `env:${SIGNOFF_ENV_VAR}`);
  }
  if (signoffPath && fileExists(signoffPath)) {
    let parsed;
    try {
      parsed = JSON.parse(readFile(signoffPath));
    } catch (e) {
      return { ok: false, source: `file:${SIGNOFF_FILE}`, reason: `archivo de sign-off ilegible: ${e.message}`, errors: [e.message] };
    }
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, source: `file:${SIGNOFF_FILE}`, reason: 'el archivo de sign-off debe ser un objeto JSON', errors: ['formato inválido'] };
    }
    return validateFields(parsed, `file:${SIGNOFF_FILE}`);
  }
  return {
    ok: false,
    source: 'none',
    reason: `sin autorización humana: define ${SIGNOFF_ENV_VAR} o crea ${SIGNOFF_FILE} (no versionado)`,
    errors: ['sign-off ausente'],
  };
}
