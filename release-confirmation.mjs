// GEOPÓLEM — Segunda confirmación de RELEASE a PRODUCCIÓN (Sprint 18)
// ---------------------------------------------------------------------------
// Módulo PURO (sin disco/red por sí mismo: recibe lectores inyectados) que
// resuelve y valida la SEGUNDA CONFIRMACIÓN humana requerida —ADEMÁS del sign-off
// editorial (promotion-signoff.mjs)— para cualquier futura publicación a
// producción. Es un gate INDEPENDIENTE del sign-off: separa la aprobación
// editorial ("el contenido está listo") de la confirmación de release ("procede
// publicar ahora"), de modo que ninguna sola persona/acción dispare producción.
//
// Diseño anti-automatización accidental:
//   • Exige una FRASE DE RECONOCIMIENTO exacta (REQUIRED_ACK) que un humano debe
//     escribir de forma deliberada; un valor por defecto o vacío nunca la cumple.
//   • Se REHÚSA a validar cuando detecta un entorno de CI (CI/GITHUB_ACTIONS/…):
//     la segunda confirmación jamás debe originarse en un pipeline.
//   • Rechaza cualquier valor que aparente contener un secreto.
//
// IMPORTANTE: incluso con sign-off + segunda confirmación válidos, la publicación
// REAL a producción sigue DESHABILITADA en este sprint (PRODUCTION_PUBLISH_ENABLED
// = false). Este módulo sólo modela y prueba el doble gate; no publica nada.
//
// Fuentes admitidas (en orden de prioridad):
//   1) Variable de entorno GEOP_RELEASE_CONFIRM=
//        "confirmed_by=NOMBRE;scope=production;ack=<REQUIRED_ACK>;date=YYYY-MM-DD"
//   2) Archivo local NO versionado .release-confirmation.json (gitignored), con
//        { "confirmed_by": "...", "scope": "production", "ack": "<REQUIRED_ACK>",
//          "date": "YYYY-MM-DD", "reference": "ticket/commit opcional" }
// ---------------------------------------------------------------------------

export const CONFIRM_ENV_VAR = 'GEOP_RELEASE_CONFIRM';
export const CONFIRM_FILE = '.release-confirmation.json';
export const REQUIRED_SCOPE = 'production';

// Frase exacta que un humano debe escribir para confirmar el release. Deliberada
// y en español para que no coincida con banderas booleanas triviales (true/1/yes).
export const REQUIRED_ACK = 'confirmo publicacion a produccion';

// En este sprint la publicación real a producción está DESHABILITADA por diseño,
// aunque el doble gate esté satisfecho. Cambiar esto es una decisión de un sprint
// futuro y debe ir acompañada de la escritura canónica con rollback (Bloque 2).
export const PRODUCTION_PUBLISH_ENABLED = false;

// Variables que delatan un entorno de integración continua. La segunda
// confirmación NO debe poder originarse aquí.
const CI_ENV_VARS = ['CI', 'CONTINUOUS_INTEGRATION', 'GITHUB_ACTIONS', 'GITLAB_CI', 'BUILDKITE', 'JENKINS_URL', 'TF_BUILD'];

const SECRET_HINTS = ['token', 'secret', 'password', 'passwd', 'apikey', 'api_key', 'private_key', 'bearer'];

function looksLikeSecret(text) {
  const low = String(text).toLowerCase();
  return SECRET_HINTS.some((h) => low.includes(h));
}

// Normaliza acentos/espacios para comparar la frase de reconocimiento de forma
// tolerante (mayúsculas, tildes y espacios repetidos no deben hacerla fallar),
// pero SIN volverla trivial: sigue exigiendo la frase completa deliberada.
function normalizeAck(text) {
  return String(text)
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

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

// ¿Estamos en un entorno de CI? (cualquiera de las variables típicas presente y
// con valor no vacío/no "false").
export function detectCI(env = {}) {
  return CI_ENV_VARS.some((k) => {
    const v = env[k];
    if (v == null) return false;
    const s = String(v).trim().toLowerCase();
    return s !== '' && s !== 'false' && s !== '0';
  });
}

function validateFields(fields, source, env) {
  const confirmedBy = String(fields.confirmed_by || fields.confirmedby || '').trim();
  const scope = String(fields.scope || '').trim().toLowerCase();
  const ack = String(fields.ack || fields.acknowledge || '').trim();
  const date = String(fields.date || '').trim();
  const reference = String(fields.reference || fields.ref || fields.ticket || '').trim();

  const errors = [];
  if (detectCI(env)) {
    errors.push('la segunda confirmación NO puede originarse en CI (entorno de integración continua detectado)');
  }
  if (looksLikeSecret(JSON.stringify(fields))) {
    errors.push('la confirmación aparenta contener un secreto (token/clave/password): rechazada');
  }
  if (!confirmedBy) errors.push('falta "confirmed_by" (persona que confirma el release)');
  if (scope !== REQUIRED_SCOPE) errors.push(`"scope" debe ser "${REQUIRED_SCOPE}" (recibido: "${scope || '∅'}")`);
  if (normalizeAck(ack) !== REQUIRED_ACK) {
    errors.push(`"ack" debe ser exactamente la frase de reconocimiento: "${REQUIRED_ACK}"`);
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('"date" debe ser YYYY-MM-DD si se indica');

  if (errors.length) return { ok: false, source, reason: errors.join('; '), errors };
  return {
    ok: true,
    source,
    confirmation: { confirmed_by: confirmedBy, scope, ack: REQUIRED_ACK, date: date || null, reference: reference || null },
  };
}

/* --------------------------------------------------------------------------
   resolveReleaseConfirmation: resuelve la segunda confirmación desde
   entorno/archivo (inyectados) y la valida. NO publica nada; sólo informa si
   existe una confirmación humana válida e independiente del sign-off.

   deps:
     env          — objeto tipo process.env (por defecto {})
     confirmPath  — ruta del archivo local de confirmación (opcional)
     fileExists   — (path) => boolean
     readFile     — (path) => string (contenido JSON)
-------------------------------------------------------------------------- */
export function resolveReleaseConfirmation({ env = {}, confirmPath = null, fileExists = () => false, readFile = () => '' } = {}) {
  const raw = env[CONFIRM_ENV_VAR];
  if (typeof raw === 'string' && raw.trim() !== '') {
    return validateFields(parsePairs(raw), `env:${CONFIRM_ENV_VAR}`, env);
  }
  if (confirmPath && fileExists(confirmPath)) {
    let parsed;
    try {
      parsed = JSON.parse(readFile(confirmPath));
    } catch (e) {
      return { ok: false, source: `file:${CONFIRM_FILE}`, reason: `archivo de confirmación ilegible: ${e.message}`, errors: [e.message] };
    }
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, source: `file:${CONFIRM_FILE}`, reason: 'el archivo de confirmación debe ser un objeto JSON', errors: ['formato inválido'] };
    }
    return validateFields(parsed, `file:${CONFIRM_FILE}`, env);
  }
  return {
    ok: false,
    source: 'none',
    reason: `sin segunda confirmación: define ${CONFIRM_ENV_VAR} o crea ${CONFIRM_FILE} (no versionado)`,
    errors: ['segunda confirmación ausente'],
  };
}

/* --------------------------------------------------------------------------
   evaluateProductionRelease: combina el sign-off editorial y la segunda
   confirmación en un ÚNICO veredicto auditable del DOBLE GATE. No publica nada.

   Devuelve:
     signoff_ok            — ¿hay sign-off editorial válido?
     confirmation_ok       — ¿hay segunda confirmación válida (no-CI)?
     double_gate_ok        — ambos gates satisfechos.
     publish_enabled       — bandera global (false en este sprint).
     ready_for_real_release— double_gate_ok && publish_enabled (SIEMPRE false aquí).
     reasons[]             — motivos de bloqueo legibles.
-------------------------------------------------------------------------- */
export function evaluateProductionRelease({ signoff, confirmation } = {}) {
  const signoffOk = Boolean(signoff && signoff.ok);
  const confirmationOk = Boolean(confirmation && confirmation.ok);
  const doubleGateOk = signoffOk && confirmationOk;
  const reasons = [];
  if (!signoffOk) reasons.push(`sign-off editorial ausente/ inválido: ${(signoff && signoff.reason) || 'no provisto'}`);
  if (!confirmationOk) reasons.push(`segunda confirmación ausente/ inválida: ${(confirmation && confirmation.reason) || 'no provista'}`);
  if (doubleGateOk && !PRODUCTION_PUBLISH_ENABLED) {
    reasons.push('doble gate satisfecho, pero la publicación real a producción está DESHABILITADA en este sprint (PRODUCTION_PUBLISH_ENABLED=false)');
  }
  return {
    signoff_ok: signoffOk,
    confirmation_ok: confirmationOk,
    double_gate_ok: doubleGateOk,
    publish_enabled: PRODUCTION_PUBLISH_ENABLED,
    ready_for_real_release: doubleGateOk && PRODUCTION_PUBLISH_ENABLED,
    reasons,
  };
}
