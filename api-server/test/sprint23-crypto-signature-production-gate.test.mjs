// GEOPÓLEM (Sprint 23) — Firma criptográfica opcional, validación reforzada de
// roles y DISEÑO del gate de producción.
// ---------------------------------------------------------------------------
// Garantías cubiertas:
//   • FIRMA OPCIONAL: payload canónico determinista; sign+verify Ed25519; la
//     AUSENCIA de firma no es error; una firma presente e inválida sí lo es;
//     la clave de un rol no sirve para firmar por otro.
//   • CLAVES PÚBLICAS EJEMPLO: el registro de ejemplo carga (sólo públicas).
//   • RECHAZO DE PRIVADAS/SECRETOS: material de clave privada o secretos en el
//     registro o en la firma son rechazados de raíz.
//   • ROLES REFORZADOS: identidad obligatoria, una persona no rellena varios
//     roles, vigencia por fecha y rationale mínimo.
//   • EJEMPLOS NO PRODUCTIVOS: el registro de ejemplo no habilita producción.
//   • PRODUCCIÓN BLOQUEADA: aun con 8/8 approved + sign-off + 2ª confirmación +
//     firmas de ejemplo válidas, production_enabled sigue false.
//   • ARTEFACTO AL DÍA y CLEAN-TREE: production-gate.sprint23 versionado coincide
//     y los scripts en modo lectura no dejan diffs.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateKeyPairSync, sign as cryptoSign } from 'node:crypto';

const dec = await import('../../editorial-decision.mjs');
const sigmod = await import('../../editorial-signature.mjs');
const rolemod = await import('../../editorial-role-validation.mjs');
const gatemod = await import('../../production-gate.mjs');

const {
  DECISION_CONTRACT, REQUIRED_APPROVAL_ROLES,
  computeEvidenceManifestHash, computeItemSourceHashes, indexEvidenceItems,
  validateDecisionSet, buildDecisionGoNoGo,
} = dec;
const {
  SIGNATURE_KEYS_CONTRACT, canonicalDecisionPayload, loadPublicKeyRegistry,
  verifyDecisionSignature, summarizeDecisionSignatures, looksLikePrivateKey,
} = sigmod;
const { RATIONALE_MIN_LEN, reinforcedValidateDecisions } = rolemod;
const { evaluateProductionGate, PRODUCTION_GATE_CONTRACT } = gatemod;

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const MANIFEST = readJson(resolve(REPO_ROOT, 'editorial-review/sprint21/manifest.json'));
const HASH = computeEvidenceManifestHash(MANIFEST);
const COVERAGE = { coverage_pct: 100, ok: true, coverage_ok: true };
const evItem = (key) => indexEvidenceItems(MANIFEST)[key];
const SOURCE_KEY = 'ukr-rus::source::iaea-ukraine-update-356';

// Firma declarada (Sprint 22) con identidad (Sprint 23). Sin firma criptográfica.
function signOff(key, role, decision = 'approved', overrides = {}) {
  return {
    item_id: key,
    decision,
    rationale: `justificación real y suficiente del ${role}`,
    decided_by_role: role,
    decided_by: `${role}-persona`,
    decided_at: '2026-07-07',
    evidence_manifest_hash: HASH,
    source_hashes: computeItemSourceHashes(evItem(key)),
    optional_conditions: [],
    ...overrides,
  };
}
function fullApproval(key) {
  return REQUIRED_APPROVAL_ROLES.map((r) => signOff(key, r));
}
function decisionSet(decisions) {
  return { contract: DECISION_CONTRACT, is_example: false, evidence_manifest_hash: HASH, decisions };
}

// Genera un par Ed25519 EFÍMERO (la privada nunca toca el disco) y devuelve el
// SPKI base64 público y un firmador para el payload canónico.
function ephemeralSigner() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const spkiB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  return {
    spkiB64,
    signEntry(entry) {
      const payload = Buffer.from(canonicalDecisionPayload(entry), 'utf8');
      return cryptoSign(null, payload, privateKey).toString('base64');
    },
  };
}
function registryFor(rolesToSpki) {
  return loadPublicKeyRegistry({
    contract: SIGNATURE_KEYS_CONTRACT,
    is_example: false,
    keys: Object.entries(rolesToSpki).map(([role, spki]) => ({
      key_id: `${role}-key`, role, algorithm: 'ed25519', public_key_spki_b64: spki,
    })),
  });
}

/* ==================== 1) FIRMA OPCIONAL: PAYLOAD Y ROUNDTRIP ============ */

test('canonicalDecisionPayload es determinista e independiente del orden de source_hashes', () => {
  const a = signOff(SOURCE_KEY, 'reviewer');
  const b = { ...a, source_hashes: Object.fromEntries(Object.entries(a.source_hashes).reverse()) };
  assert.equal(canonicalDecisionPayload(a), canonicalDecisionPayload(b));
});

test('firma Ed25519 detached: sign + verify roundtrip verifica', () => {
  const signer = ephemeralSigner();
  const registry = registryFor({ reviewer: signer.spkiB64 });
  const entry = signOff(SOURCE_KEY, 'reviewer');
  entry.signature = { algorithm: 'ed25519', key_id: 'reviewer-key', signature_b64: signer.signEntry(entry) };
  const res = verifyDecisionSignature(entry, { registry });
  assert.equal(res.present, true);
  assert.equal(res.verified, true);
  assert.equal(res.ok, true);
});

test('AUSENCIA de firma es OPCIONAL: no es error (ok:true, present:false)', () => {
  const res = verifyDecisionSignature(signOff(SOURCE_KEY, 'reviewer'), { registry: registryFor({}) });
  assert.equal(res.present, false);
  assert.equal(res.ok, true);
});

test('firma PRESENTE e INVÁLIDA (payload alterado tras firmar) es rechazada', () => {
  const signer = ephemeralSigner();
  const registry = registryFor({ reviewer: signer.spkiB64 });
  const entry = signOff(SOURCE_KEY, 'reviewer');
  entry.signature = { algorithm: 'ed25519', key_id: 'reviewer-key', signature_b64: signer.signEntry(entry) };
  entry.rationale = 'rationale MANIPULADO tras la firma';
  const res = verifyDecisionSignature(entry, { registry });
  assert.equal(res.present, true);
  assert.equal(res.verified, false);
  assert.equal(res.ok, false);
});

test('la clave de un rol NO sirve para firmar por otro rol', () => {
  const signer = ephemeralSigner();
  const registry = registryFor({ owner: signer.spkiB64 }); // clave registrada como owner
  const entry = signOff(SOURCE_KEY, 'reviewer'); // pero la decisión es de reviewer
  entry.signature = { algorithm: 'ed25519', key_id: 'owner-key', signature_b64: signer.signEntry(entry) };
  const res = verifyDecisionSignature(entry, { registry });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => /rol/.test(e)));
});

test('key_id desconocido (no en el registro) es rechazado', () => {
  const entry = signOff(SOURCE_KEY, 'reviewer');
  entry.signature = { algorithm: 'ed25519', key_id: 'inexistente', signature_b64: 'AAAA' };
  const res = verifyDecisionSignature(entry, { registry: registryFor({}) });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => /registro/.test(e)));
});

/* ==================== 2) CLAVES PÚBLICAS EJEMPLO ======================= */

test('el registro de claves PÚBLICAS de ejemplo carga (sólo públicas, 3 roles)', () => {
  const example = readJson(resolve(REPO_ROOT, 'editorial-signature-keys.example.json'));
  assert.equal(example.is_example, true);
  const reg = loadPublicKeyRegistry(example);
  assert.equal(reg.ok, true, reg.errors.join('; '));
  assert.equal(reg.keys.size, 3);
  for (const role of ['reviewer', 'editor', 'owner']) {
    assert.ok([...reg.keys.values()].some((k) => k.role === role));
  }
});

/* ==================== 3) RECHAZO DE PRIVADAS / SECRETOS ================ */

test('looksLikePrivateKey detecta material de clave privada', () => {
  assert.equal(looksLikePrivateKey('-----BEGIN PRIVATE KEY-----'), true);
  assert.equal(looksLikePrivateKey('-----BEGIN OPENSSH PRIVATE KEY-----'), true);
  assert.equal(looksLikePrivateKey('MCowBQYDK2VwAyEA...'), false);
});

test('registro con material de CLAVE PRIVADA es rechazado de raíz', () => {
  const reg = loadPublicKeyRegistry({
    contract: SIGNATURE_KEYS_CONTRACT,
    keys: [{ key_id: 'x', role: 'owner', algorithm: 'ed25519', public_key_spki_b64: '-----BEGIN PRIVATE KEY-----abc' }],
  });
  assert.equal(reg.ok, false);
  assert.ok(reg.errors.some((e) => /PRIVADA/.test(e)));
});

test('registro con un SECRETO aparente es rechazado', () => {
  const reg = loadPublicKeyRegistry({
    contract: SIGNATURE_KEYS_CONTRACT,
    keys: [{ key_id: 'x', role: 'owner', algorithm: 'ed25519', public_key_spki_b64: 'AA', api_key: 'deadbeef' }],
  });
  assert.equal(reg.ok, false);
  assert.ok(reg.errors.some((e) => /secreto/.test(e)));
});

test('firma que incluye material de clave privada es rechazada', () => {
  const entry = signOff(SOURCE_KEY, 'reviewer');
  entry.signature = { algorithm: 'ed25519', key_id: 'reviewer-key', signature_b64: 'AA', private_key: '-----BEGIN PRIVATE KEY-----' };
  const res = verifyDecisionSignature(entry, { registry: registryFor({}) });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => /PRIVADA/.test(e)));
});

/* ==================== 4) VALIDACIÓN REFORZADA DE ROLES ================= */

test('identidad (decided_by) obligatoria para trazabilidad', () => {
  const r = reinforcedValidateDecisions({
    decisions: [signOff(SOURCE_KEY, 'reviewer', 'approved', { decided_by: '' })],
    evidenceGeneratedAt: MANIFEST.generated_at, today: '2026-07-07',
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /decided_by|trazabilidad/.test(e)));
});

test('una misma persona NO puede rellenar varios roles del mismo item (suplantación)', () => {
  const decisions = [
    signOff(SOURCE_KEY, 'reviewer', 'approved', { decided_by: 'ana' }),
    signOff(SOURCE_KEY, 'editor', 'approved', { decided_by: 'ana' }),
    signOff(SOURCE_KEY, 'owner', 'approved', { decided_by: 'ana' }),
  ];
  const r = reinforcedValidateDecisions({ decisions, evidenceGeneratedAt: MANIFEST.generated_at, today: '2026-07-07' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /suplantar|múltiples roles/.test(e)));
});

test('regla EXPLÍCITA allowMultiRoleSigner degrada a advertencia (no error)', () => {
  const decisions = [
    signOff(SOURCE_KEY, 'reviewer', 'approved', { decided_by: 'ana' }),
    signOff(SOURCE_KEY, 'editor', 'approved', { decided_by: 'ana' }),
  ];
  const r = reinforcedValidateDecisions({
    decisions, evidenceGeneratedAt: MANIFEST.generated_at, today: '2026-07-07', allowMultiRoleSigner: true,
  });
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some((w) => /permitido por regla explícita/.test(w)));
});

test('vigencia por fecha: decided_at anterior a la evidencia es rechazado', () => {
  const r = reinforcedValidateDecisions({
    decisions: [signOff(SOURCE_KEY, 'reviewer', 'approved', { decided_at: '2020-01-01' })],
    evidenceGeneratedAt: MANIFEST.generated_at, today: '2026-07-07',
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /anterior a la evidencia/.test(e)));
});

test('vigencia por fecha: decided_at en el futuro es rechazado', () => {
  const r = reinforcedValidateDecisions({
    decisions: [signOff(SOURCE_KEY, 'reviewer', 'approved', { decided_at: '2999-01-01' })],
    evidenceGeneratedAt: MANIFEST.generated_at, today: '2026-07-07',
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /futuro/.test(e)));
});

test('rationale demasiado corto es rechazado', () => {
  const r = reinforcedValidateDecisions({
    decisions: [signOff(SOURCE_KEY, 'reviewer', 'approved', { rationale: 'corto' })],
    evidenceGeneratedAt: MANIFEST.generated_at, today: '2026-07-07',
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => new RegExp(`${RATIONALE_MIN_LEN}`).test(e)));
});

test('decisiones bien formadas con identidades distintas pasan la validación reforzada', () => {
  const r = reinforcedValidateDecisions({
    decisions: fullApproval(SOURCE_KEY), evidenceGeneratedAt: MANIFEST.generated_at, today: '2026-07-07',
  });
  assert.equal(r.ok, true, r.errors.join('; '));
});

/* ==================== 5) GATE DE PRODUCCIÓN: BLOQUEADO ================= */

test('gate CERRADO sin ninguna condición (production_enabled:false)', () => {
  const ev = validateDecisionSet(decisionSet([]), { manifest: MANIFEST });
  const gng = buildDecisionGoNoGo({ manifest: MANIFEST, decisionEval: ev, coverage: COVERAGE, publishEnabled: false, generatedAt: MANIFEST.generated_at });
  const gate = evaluateProductionGate({ decisionGoNoGo: gng, signoff: null, confirmation: null, signatureSummary: null, publishEnabled: false, generatedAt: MANIFEST.generated_at });
  assert.equal(gate.production_enabled, false);
  assert.equal(gate.gate_open, false);
  assert.equal(gate.decision, 'PRODUCTION-DISABLED');
  assert.equal(gate.contract, PRODUCTION_GATE_CONTRACT);
});

test('PRODUCCIÓN NO SE ACTIVA aun con 8/8 approved + sign-off + 2ª confirmación + firmas de ejemplo válidas', () => {
  // 8/8 approved firmados criptográficamente con claves efímeras (roundtrip real).
  const signers = { reviewer: ephemeralSigner(), editor: ephemeralSigner(), owner: ephemeralSigner() };
  const registry = registryFor(Object.fromEntries(Object.entries(signers).map(([r, s]) => [r, s.spkiB64])));
  const decisions = [];
  for (const it of MANIFEST.items) {
    for (const role of REQUIRED_APPROVAL_ROLES) {
      const entry = signOff(it.key, role);
      entry.signature = { algorithm: 'ed25519', key_id: `${role}-key`, signature_b64: signers[role].signEntry(entry) };
      decisions.push(entry);
    }
  }
  const set = decisionSet(decisions);
  const ev = validateDecisionSet(set, { manifest: MANIFEST });
  assert.equal(ev.ok, true, ev.errors.join('; '));
  const sigSummary = summarizeDecisionSignatures(set, { registry });
  assert.equal(sigSummary.ok, true);
  assert.equal(sigSummary.invalid, 0);
  assert.equal(sigSummary.verified, sigSummary.signed);

  const gng = buildDecisionGoNoGo({ manifest: MANIFEST, decisionEval: ev, coverage: COVERAGE, publishEnabled: true, generatedAt: MANIFEST.generated_at });
  const signoff = { ok: true, source: 'fixture' };
  const confirmation = { ok: true, source: 'fixture' };

  // Con la bandera REAL (false): las condiciones duras se cumplen (gate_open),
  // pero la SEGUNDA BARRERA (bandera) impide publicar y production_enabled es false.
  const real = evaluateProductionGate({ decisionGoNoGo: gng, signoff, confirmation, signatureSummary: sigSummary, publishEnabled: false, generatedAt: MANIFEST.generated_at });
  assert.equal(real.production_enabled, false);
  assert.equal(real.gate_open, true); // condiciones duras cumplidas en el fixture
  assert.equal(real.ready_to_publish, false); // bandera global false: no se publica
  assert.ok(real.blockers.some((b) => /DESHABILITADA por política/.test(b)));

  // Aun forzando la bandera en un fixture, production_enabled es INVARIANTE false.
  const forced = evaluateProductionGate({ decisionGoNoGo: gng, signoff, confirmation, signatureSummary: sigSummary, publishEnabled: true, generatedAt: MANIFEST.generated_at });
  assert.equal(forced.production_enabled, false);
  assert.equal(forced.gate_open, true);
  assert.equal(forced.ready_to_publish, true); // gate_open && flag, PERO...
  // ...production_enabled permanece false: la publicación real nunca se activa en este sprint.
});

test('requireSignatures=true exige cobertura total de firmas verificadas', () => {
  const ev = validateDecisionSet(decisionSet(fullApproval(SOURCE_KEY)), { manifest: MANIFEST });
  const gng = buildDecisionGoNoGo({ manifest: MANIFEST, decisionEval: ev, coverage: COVERAGE, publishEnabled: true, generatedAt: MANIFEST.generated_at });
  // Sin firmas criptográficas presentes: con requireSignatures, signatures_ok=false.
  const sigSummary = summarizeDecisionSignatures(decisionSet(fullApproval(SOURCE_KEY)), { registry: registryFor({}) });
  const gate = evaluateProductionGate({ decisionGoNoGo: gng, signoff: { ok: true }, confirmation: { ok: true }, signatureSummary: sigSummary, requireSignatures: true, publishEnabled: true, generatedAt: MANIFEST.generated_at });
  assert.equal(gate.conditions.signatures_ok, false);
});

/* ==================== 6) EJEMPLO NO PRODUCTIVO ======================== */

test('el registro de ejemplo (is_example) no habilita producción por sí mismo', () => {
  const example = readJson(resolve(REPO_ROOT, 'editorial-signature-keys.example.json'));
  const reg = loadPublicKeyRegistry(example);
  // Un set vacío firmado con el ejemplo: sin decisiones GO → gate cerrado.
  const sigSummary = summarizeDecisionSignatures(decisionSet([]), { registry: reg });
  const ev = validateDecisionSet(decisionSet([]), { manifest: MANIFEST });
  const gng = buildDecisionGoNoGo({ manifest: MANIFEST, decisionEval: ev, coverage: COVERAGE, publishEnabled: false, generatedAt: MANIFEST.generated_at });
  const gate = evaluateProductionGate({ decisionGoNoGo: gng, signatureSummary: sigSummary, publishEnabled: false, generatedAt: MANIFEST.generated_at });
  assert.equal(gate.production_enabled, false);
  assert.equal(gate.gate_open, false);
});

/* ==================== 7) ARTEFACTO VERSIONADO AL DÍA ================== */

test('gate:check: el production-gate.sprint23 versionado está al día y production_enabled:false', () => {
  const SCRIPT = resolve(REPO_ROOT, 'scripts/evaluate-production-gate.mjs');
  const out = execFileSync('node', [SCRIPT, '--check'], {
    cwd: REPO_ROOT, encoding: 'utf8',
    env: { ...process.env, GEOP_EDITORIAL_DECISIONS: '', GEOP_PROMOTION_SIGNOFF: '', GEOP_RELEASE_CONFIRM: '', GEOP_EDITORIAL_SIGNATURE_KEYS: '' },
  });
  assert.match(out, /OK/);
  const g = readJson(resolve(REPO_ROOT, 'api/v1/rc/production-gate.sprint23.json'));
  assert.equal(g.contract, PRODUCTION_GATE_CONTRACT);
  assert.equal(g.production_enabled, false);
  assert.equal(g.gate_open, false);
});

/* ==================== 8) CLEAN-TREE =================================== */

test('los scripts de gate en modo lectura NO dejan diffs versionados', () => {
  const status = () => execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: REPO_ROOT, encoding: 'utf8' });
  const before = status();
  for (const a of [['--check'], ['--json'], []]) {
    execFileSync('node', [resolve(REPO_ROOT, 'scripts/evaluate-production-gate.mjs'), ...a], {
      cwd: REPO_ROOT, stdio: 'ignore',
      env: { ...process.env, GEOP_EDITORIAL_DECISIONS: '', GEOP_PROMOTION_SIGNOFF: '', GEOP_RELEASE_CONFIRM: '', GEOP_EDITORIAL_SIGNATURE_KEYS: '' },
    });
  }
  assert.equal(status(), before, 'los checks de gate deben ser no-write/no-diff');
});
