// GEOPÓLEM — Firma criptográfica OPCIONAL de decisiones editoriales (Sprint 23)
// ---------------------------------------------------------------------------
// Módulo PURO (sin disco/red: la IO se inyecta; el crypto de Node es
// determinista para verificación) que añade una capa OPCIONAL de no-repudio
// sobre el flujo de decisión editorial del Sprint 22 (editorial-decision.mjs).
//
// Modelo de amenaza y diseño:
//   • La firma es OPCIONAL. Su AUSENCIA nunca degrada un GO ya válido: el flujo
//     del Sprint 22 (declaraciones auditables por rol) sigue siendo la base. La
//     firma sólo AÑADE garantía de no-repudio cuando un rol la aporta.
//   • Firmas DETACHED Ed25519 (algoritmo por defecto): la clave PRIVADA nunca
//     vive en el repo ni se necesita para verificar. Sólo se versiona/registra la
//     clave PÚBLICA (SPKI DER en base64). Un ejemplo de registro público es seguro.
//   • Determinista: el payload firmado es una proyección canónica y estable de la
//     decisión; mismas entradas → mismo payload → misma verificación.
//   • Anti-fuga: cualquier material que aparente una clave PRIVADA o un secreto es
//     RECHAZADO explícitamente (nunca se intenta derivar público desde privado).
//   • NO habilita producción: verificar una firma jamás abre el gate de release.
//     Un ejemplo con firmas de ejemplo tampoco. Ver production-gate.mjs.
//
// REGLA DE ORO: el tooling verifica; nunca firma por un humano ni fabrica claves.
// ---------------------------------------------------------------------------

import { createPublicKey, verify as cryptoVerify } from 'node:crypto';

export const SIGNATURE_CONTRACT = 'sprint-23-editorial-signature-v1';
export const SIGNATURE_KEYS_CONTRACT = 'sprint-23-editorial-signature-keys-v1';
export const DEFAULT_ALGORITHM = 'ed25519';
export const SUPPORTED_ALGORITHMS = Object.freeze(['ed25519']);

const SECRET_HINTS = ['token', 'secret', 'password', 'passwd', 'apikey', 'api_key', 'bearer'];
// Marcadores inequívocos de material de clave PRIVADA. Se rechaza de raíz: nunca
// debe entrar material privado ni al registro ni a una firma.
const PRIVATE_KEY_MARKERS = [
  'private key', 'privatekey', 'private_key',
  'begin rsa private', 'begin ec private', 'begin openssh private', 'begin dsa private',
];

function isPlainObject(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }
function str(v) { return typeof v === 'string' ? v.trim() : ''; }
function asArray(v) { return Array.isArray(v) ? v : []; }

function looksLikeSecret(text) {
  const low = String(text).toLowerCase();
  return SECRET_HINTS.some((h) => low.includes(h));
}

// ¿El texto aparenta contener material de clave PRIVADA? (rechazo de raíz).
export function looksLikePrivateKey(text) {
  const low = String(text).toLowerCase();
  return PRIVATE_KEY_MARKERS.some((m) => low.includes(m));
}

/* ==================== 1) PAYLOAD CANÓNICO A FIRMAR ====================== */

// Proyección canónica y estable de una decisión para firmar/verificar. Sólo
// campos MATERIALES de la decisión (no la firma en sí). Orden de campos fijo;
// source_hashes y optional_conditions ordenados. Cambiar cualquiera invalida la
// firma. Devuelve una cadena UTF-8 determinista.
export function canonicalDecisionPayload(entry) {
  const sourceHashes = isPlainObject(entry?.source_hashes) ? entry.source_hashes : {};
  const orderedSources = {};
  for (const slug of Object.keys(sourceHashes).map(str).filter(Boolean).sort()) {
    orderedSources[slug] = str(sourceHashes[slug]);
  }
  const projection = {
    contract: SIGNATURE_CONTRACT,
    item_id: str(entry?.item_id),
    decision: str(entry?.decision).toLowerCase(),
    rationale: str(entry?.rationale),
    decided_by_role: str(entry?.decided_by_role).toLowerCase(),
    decided_by: str(entry?.decided_by),
    decided_at: str(entry?.decided_at),
    evidence_manifest_hash: str(entry?.evidence_manifest_hash),
    source_hashes: orderedSources,
    optional_conditions: asArray(entry?.optional_conditions).map(str).filter(Boolean).sort(),
  };
  return JSON.stringify(projection);
}

/* ==================== 2) REGISTRO DE CLAVES PÚBLICAS =================== */

/* --------------------------------------------------------------------------
   loadPublicKeyRegistry: valida y carga un registro de claves PÚBLICAS.

   Estructura esperada:
     { contract, is_example?, keys: [ { key_id, role?, algorithm,
       public_key_spki_b64, owner? } ] }

   Reglas de seguridad:
     • Se RECHAZA cualquier material que aparente clave privada o secreto.
     • Sólo Ed25519 (algoritmo soportado).
     • public_key_spki_b64 debe ser una clave pública válida (createPublicKey).
     • key_id único.

   Devuelve { ok, is_example, keys: Map(key_id → {..., keyObject}), errors[] }.
-------------------------------------------------------------------------- */
export function loadPublicKeyRegistry(registry) {
  const errors = [];
  const keys = new Map();
  if (!isPlainObject(registry)) {
    return { ok: false, is_example: false, keys, errors: ['registro de claves: no es objeto'] };
  }
  const isExample = registry.is_example === true;
  if (registry.contract !== SIGNATURE_KEYS_CONTRACT) {
    errors.push(`registro de claves: contract != ${SIGNATURE_KEYS_CONTRACT}`);
  }

  for (const raw of asArray(registry.keys)) {
    const keyId = str(raw?.key_id);
    const algorithm = str(raw?.algorithm).toLowerCase();
    const spkiB64 = str(raw?.public_key_spki_b64);
    const role = str(raw?.role).toLowerCase();
    if (!keyId) { errors.push('registro de claves: entrada sin key_id'); continue; }
    if (keys.has(keyId)) { errors.push(`registro de claves: key_id duplicado "${keyId}"`); continue; }
    // Rechazo de raíz de material privado/secreto por entrada de clave (no se
    // escanea el texto descriptivo de nivel superior como el notice).
    const entrySerialized = JSON.stringify(raw);
    if (looksLikePrivateKey(entrySerialized)) { errors.push(`"${keyId}" aparenta contener una CLAVE PRIVADA: rechazado`); continue; }
    if (looksLikeSecret(entrySerialized)) { errors.push(`"${keyId}" aparenta contener un secreto: rechazado`); continue; }
    if (!SUPPORTED_ALGORITHMS.includes(algorithm)) {
      errors.push(`"${keyId}" algorithm no soportado "${algorithm || '∅'}" (esperado ${SUPPORTED_ALGORITHMS.join('|')})`);
      continue;
    }
    if (!spkiB64) { errors.push(`"${keyId}" falta public_key_spki_b64`); continue; }
    if (looksLikePrivateKey(spkiB64)) { errors.push(`"${keyId}" public_key_spki_b64 aparenta clave PRIVADA: rechazado`); continue; }
    let keyObject;
    try {
      keyObject = createPublicKey({ key: Buffer.from(spkiB64, 'base64'), type: 'spki', format: 'der' });
    } catch (e) {
      errors.push(`"${keyId}" clave pública inválida: ${e.message}`);
      continue;
    }
    if (keyObject.type !== 'public') { errors.push(`"${keyId}" no es una clave pública`); continue; }
    keys.set(keyId, { key_id: keyId, role: role || null, algorithm, keyObject });
  }

  return { ok: errors.length === 0, is_example: isExample, keys, errors };
}

/* ==================== 3) VERIFICACIÓN DE UNA FIRMA ===================== */

/* --------------------------------------------------------------------------
   verifyDecisionSignature: verifica la firma OPCIONAL de una decisión.

   Bloque de firma esperado en la entrada (opcional):
     entry.signature = { algorithm:'ed25519', key_id, signature_b64 }

   Semántica:
     • Sin bloque de firma → { present:false, verified:false, ok:true } (opcional:
       la ausencia NO es error).
     • Con bloque de firma → se valida forma, se resuelve la clave pública por
       key_id en el registro y se verifica sobre canonicalDecisionPayload(entry).
       present:true; ok = verified.

   deps: registry (salida de loadPublicKeyRegistry).
   Devuelve { present, verified, ok, key_id, role, errors[] }.
-------------------------------------------------------------------------- */
export function verifyDecisionSignature(entry, { registry = null } = {}) {
  const sig = entry?.signature;
  if (sig == null) {
    return { present: false, verified: false, ok: true, key_id: null, role: null, errors: [] };
  }
  const errors = [];
  const itemId = str(entry?.item_id) || '∅';
  if (!isPlainObject(sig)) {
    return { present: true, verified: false, ok: false, key_id: null, role: null, errors: [`"${itemId}" signature debe ser objeto`] };
  }
  if (looksLikePrivateKey(JSON.stringify(sig))) {
    errors.push(`"${itemId}" la firma aparenta contener una CLAVE PRIVADA: rechazada`);
  }
  const algorithm = str(sig.algorithm).toLowerCase();
  const keyId = str(sig.key_id);
  const signatureB64 = str(sig.signature_b64);
  if (!SUPPORTED_ALGORITHMS.includes(algorithm)) errors.push(`"${itemId}" firma algorithm no soportado "${algorithm || '∅'}"`);
  if (!keyId) errors.push(`"${itemId}" firma sin key_id`);
  if (!signatureB64) errors.push(`"${itemId}" firma sin signature_b64`);

  const reg = registry && registry.keys instanceof Map ? registry.keys : new Map();
  const known = keyId ? reg.get(keyId) : null;
  if (keyId && !known) errors.push(`"${itemId}" key_id "${keyId}" no está en el registro de claves públicas`);

  let verified = false;
  if (errors.length === 0 && known) {
    // La firma debe corresponder al rol declarado en la decisión (si la clave
    // está asociada a un rol en el registro): evita usar la clave de un rol para
    // firmar por otro.
    const declaredRole = str(entry?.decided_by_role).toLowerCase();
    if (known.role && declaredRole && known.role !== declaredRole) {
      errors.push(`"${itemId}" la clave "${keyId}" es del rol "${known.role}" pero la decisión es de "${declaredRole}"`);
    } else {
      try {
        const payload = Buffer.from(canonicalDecisionPayload(entry), 'utf8');
        verified = cryptoVerify(null, payload, known.keyObject, Buffer.from(signatureB64, 'base64'));
        if (!verified) errors.push(`"${itemId}" firma NO válida (no verifica contra la clave "${keyId}")`);
      } catch (e) {
        errors.push(`"${itemId}" error verificando firma: ${e.message}`);
      }
    }
  }

  return {
    present: true,
    verified,
    ok: verified && errors.length === 0,
    key_id: keyId || null,
    role: known ? known.role : null,
    errors,
  };
}

/* ==================== 4) RESUMEN DE FIRMAS DE UN SET ================== */

/* --------------------------------------------------------------------------
   summarizeDecisionSignatures: verifica todas las firmas presentes en un set de
   decisiones y produce un resumen auditable. NO exige firmas (son opcionales).

   deps: decisionSet, registry.
   Devuelve { total_decisions, signed, verified, invalid, ok, per_entry[], errors[] }.
     • ok = no hay ninguna firma PRESENTE e INVÁLIDA (una firma rota es un error;
       la ausencia de firma no lo es).
-------------------------------------------------------------------------- */
export function summarizeDecisionSignatures(decisionSet, { registry = null } = {}) {
  const decisions = asArray(decisionSet?.decisions);
  const perEntry = [];
  const errors = [];
  let signed = 0;
  let verified = 0;
  let invalid = 0;
  for (const entry of decisions) {
    const res = verifyDecisionSignature(entry, { registry });
    if (res.present) {
      signed += 1;
      if (res.verified && res.ok) verified += 1;
      else { invalid += 1; errors.push(...res.errors); }
    }
    perEntry.push({
      item_id: str(entry?.item_id),
      role: str(entry?.decided_by_role).toLowerCase(),
      present: res.present,
      verified: res.verified,
      ok: res.ok,
      key_id: res.key_id,
    });
  }
  return {
    total_decisions: decisions.length,
    signed,
    verified,
    invalid,
    ok: invalid === 0,
    per_entry: perEntry,
    errors,
  };
}
