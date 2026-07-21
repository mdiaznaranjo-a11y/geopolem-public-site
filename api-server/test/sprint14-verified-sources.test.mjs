// GEOPÓLEM (Sprint 14) — tests de fuentes verificadas, inventario, regla
// causal_links-exigen-fuente, separación preview/canónico y salud de contenidos.
// ---------------------------------------------------------------------------
// Cubre:
//   • Inventario exacto de conflictos (build determinista + cobertura de los 10).
//   • Validación de fuentes verificadas (no demo, no example.org, accessed_at).
//   • REGLA CLAVE: causal_link real (pending=false) exige source publicable.
//   • Coherencia de la semilla verificada real del repo.
//   • Preview verificado: contrato v1, sólo verified, canónicos intactos.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const {
  VERIFIED_SEED_CONTRACT, VERIFIED_ENRICHED_CONTRACT,
  isExampleUrl, validateVerifiedSource, validateVerifiedSeed,
  validateCausalLinksHaveSources, computeVerifiedCoverage, buildVerifiedDetail,
} = await import('../../conflict-sources.mjs');
const { buildInventory, INVENTORY_CONTRACT } = await import('../../scripts/build-inventory.mjs');
const { validateDetail } = await import('../scripts/export-static-bridge.mjs');
const { computeContentHealth } = await import('../../content-health.mjs');

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const SEED = readJson(resolve(REPO_ROOT, 'data/conflict-relations.verified.seed.json'));
const LIST = readJson(resolve(REPO_ROOT, 'api/v1/conflicts.json'));

const verifiedSource = {
  slug: 's1', title: 'Informe real', url: 'https://www.sipri.org/x',
  publisher: 'SIPRI', verification: 'verified', accessed_at: '2026-07-07',
};

/* ------------------------------------------------------------------ inventario */

test('buildInventory proyecta los 10 conflictos canónicos con campos esperados', () => {
  const inv = buildInventory(LIST, { hasDetail: () => true });
  assert.equal(inv.contract, INVENTORY_CONTRACT);
  assert.equal(inv.totals.conflicts, LIST.data.length);
  assert.equal(inv.conflicts.length, 10);
  const rearme = inv.conflicts.find((c) => c.id === 'rearme-global');
  assert.equal(rearme.conflict_type, 'defensa');
  assert.equal(rearme.primary_region, 'global');
  assert.equal(rearme.has_canonical_detail, true);
});

test('data/conflicts.inventory.json en disco está al día y bien formado', () => {
  const p = resolve(REPO_ROOT, 'data/conflicts.inventory.json');
  assert.equal(existsSync(p), true);
  const inv = readJson(p);
  assert.equal(inv.contract, INVENTORY_CONTRACT);
  assert.equal(inv.conflicts.length, 10);
  // Sprint 15 cerró los 2 pendientes → 10/10 con fuente verificada.
  assert.equal(inv.totals.with_verified_sources, 10);
});

/* -------------------------------------------------------------- isExampleUrl */

test('isExampleUrl detecta placeholders y acepta dominios reales', () => {
  assert.equal(isExampleUrl('https://example.org/demo/x'), true);
  assert.equal(isExampleUrl('http://example.com'), true);
  assert.equal(isExampleUrl('https://www.sipri.org/x'), false);
  assert.equal(isExampleUrl(''), false);
});

/* ------------------------------------------------------- validateVerifiedSource */

test('validateVerifiedSource acepta fuente verificada real con accessed_at', () => {
  assert.equal(validateVerifiedSource(verifiedSource).ok, true);
});

test('validateVerifiedSource rechaza verified sin accessed_at', () => {
  const r = validateVerifiedSource({ ...verifiedSource, accessed_at: undefined });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /accessed_at/.test(e)));
});

test('validateVerifiedSource rechaza verified con URL de ejemplo', () => {
  const r = validateVerifiedSource({ ...verifiedSource, url: 'https://example.org/x' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /ejemplo/.test(e)));
});

test('validateVerifiedSource rechaza verified marcada demo', () => {
  const r = validateVerifiedSource({ ...verifiedSource, demo: true });
  assert.equal(r.ok, false);
});

/* -------------------------------------------- validateCausalLinksHaveSources */

test('regla causal: pending=false sin source_slugs es violación', () => {
  const seed = {
    contract: VERIFIED_SEED_CONTRACT,
    conflicts: { x: { causal_links: [{ title: 'C', pending: false }], sources: [verifiedSource] } },
  };
  const r = validateCausalLinksHaveSources(seed);
  assert.equal(r.ok, false);
  assert.equal(r.violations[0].conflict, 'x');
});

test('regla causal: pending=false con source_slugs que resuelve a verified es válida', () => {
  const seed = {
    contract: VERIFIED_SEED_CONTRACT,
    conflicts: { x: { causal_links: [{ title: 'C', pending: false, source_slugs: ['s1'] }], sources: [verifiedSource] } },
  };
  assert.equal(validateCausalLinksHaveSources(seed).ok, true);
});

test('regla causal: source_slugs apuntando a fuente no publicable es violación', () => {
  const seed = {
    contract: VERIFIED_SEED_CONTRACT,
    conflicts: { x: {
      causal_links: [{ title: 'C', pending: false, source_slugs: ['s1'] }],
      sources: [{ ...verifiedSource, verification: 'pending' }],
    } },
  };
  const r = validateCausalLinksHaveSources(seed);
  assert.equal(r.ok, false);
  assert.ok(/no resuelven/.test(r.violations[0].reason));
});

test('regla causal: pending=true no exige fuente', () => {
  const seed = {
    contract: VERIFIED_SEED_CONTRACT,
    conflicts: { x: { causal_links: [{ title: 'C', pending: true }], sources: [] } },
  };
  assert.equal(validateCausalLinksHaveSources(seed).ok, true);
});

/* ------------------------------------------------------- validateVerifiedSeed */

test('validateVerifiedSeed acepta la semilla verificada real del repo', () => {
  const r = validateVerifiedSeed(SEED);
  assert.equal(r.ok, true, r.errors.join('; '));
});

test('validateVerifiedSeed exige contrato Sprint 14', () => {
  assert.equal(validateVerifiedSeed({ contract: 'otro', conflicts: {} }).ok, false);
});

test('validateVerifiedSeed detecta source_slugs colgante', () => {
  const seed = {
    contract: VERIFIED_SEED_CONTRACT,
    conflicts: { x: { causal_links: [{ title: 'C', pending: false, source_slugs: ['nope'] }], sources: [verifiedSource] } },
  };
  const r = validateVerifiedSeed(seed);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /no existe en sources/.test(e)));
});

test('validateVerifiedSeed detecta published sin fuente publicable', () => {
  const seed = {
    contract: VERIFIED_SEED_CONTRACT,
    conflicts: { x: { editorial_status: 'published', causal_links: [], sources: [] } },
  };
  assert.equal(validateVerifiedSeed(seed).ok, false);
});

/* ----------------------------------------------------- computeVerifiedCoverage */

test('computeVerifiedCoverage sobre la semilla real (Sprint 15): 10 con fuente, 5 causal verificados', () => {
  const cov = computeVerifiedCoverage(SEED, LIST.data.map((c) => c.id));
  assert.equal(cov.contract, VERIFIED_SEED_CONTRACT);
  assert.equal(cov.totals.conflicts, 10);
  assert.equal(cov.totals.with_verified_source, 10);
  assert.equal(cov.totals.fully_pending, 0);
  assert.equal(cov.totals.causal_links_verified, 5);
  assert.equal(cov.totals.verified_sources, 10);
  assert.equal(cov.coverage_pct, 100);
  assert.deepEqual(cov.missing_from_seed, []); // los 10 del inventario están en la semilla
});

test('computeVerifiedCoverage marca ausencias respecto del inventario', () => {
  const cov = computeVerifiedCoverage(SEED, ['rearme-global', 'inexistente']);
  assert.deepEqual(cov.missing_from_seed, ['inexistente']);
});

/* -------------------------------------------------- buildVerifiedDetail / preview */

test('buildVerifiedDetail integra sólo fuentes verificadas y preserva source_slugs', () => {
  const detail = { data: { id: 'red-sea', slug: 'red-sea', sources: [], causal_links: [] } };
  const data = buildVerifiedDetail(detail, SEED.conflicts['red-sea']);
  assert.equal(data.sources.length, 1);
  assert.equal(data.sources[0].verification, 'verified');
  assert.equal(data.sources[0].demo, false);
  const cl = data.causal_links.find((l) => /desvío/.test(l.title));
  assert.equal(cl.pending, false);
  assert.deepEqual(cl.source_slugs, ['unctad-navigating-troubled-waters']);
});

test('buildVerifiedDetail integra la fuente verificada de istanbul (cerrada en Sprint 15)', () => {
  const detail = { data: { id: 'istanbul', slug: 'istanbul', sources: [] } };
  const data = buildVerifiedDetail(detail, SEED.conflicts['istanbul']);
  assert.equal(data.sources.length, 1);
  assert.equal(data.sources[0].slug, 'turkiye-mfa-montreux');
  assert.equal(data.sources[0].verification, 'verified');
});

test('preview verificado en disco (si existe) respeta el contrato de detalle v1', () => {
  const p = resolve(REPO_ROOT, 'api/v1/conflicts.verified.enriched.json');
  if (!existsSync(p)) return; // se genera con verified:enriched
  const doc = readJson(p);
  assert.equal(doc.contract, VERIFIED_ENRICHED_CONTRACT);
  assert.equal(doc.include_demo, false);
  for (const [id, data] of Object.entries(doc.data)) {
    const { ok, errors } = validateDetail({ data, meta: { api_version: 'v1' } }, id);
    assert.equal(ok, true, `${id}: ${errors.join('; ')}`);
    // Ninguna fuente del preview verificado puede ser demo ni example.org.
    for (const s of data.sources) {
      assert.notEqual(s.demo, true, `${id}: fuente demo en preview verificado`);
      assert.equal(isExampleUrl(s.url), false, `${id}: URL de ejemplo en preview verificado`);
    }
  }
});

/* ------------------------------------------- separación preview / canónico */

test('los detalles CANÓNICOS siguen sin fuentes/relaciones (no promocionados)', () => {
  for (const it of LIST.data) {
    const p = resolve(REPO_ROOT, `api/v1/conflicts/${it.id}.json`);
    if (!existsSync(p)) continue;
    const d = readJson(p).data;
    assert.ok(Array.isArray(d.sources), `${it.id}: sources array`);
    // El enriquecimiento verificado vive en el preview, NO en el canónico.
    assert.equal(d.sources.length, 0, `${it.id}: canónico no debe tener fuentes aún`);
  }
});

test('conflicts.json canónico no fue tocado (10 conflictos activos)', () => {
  assert.equal(LIST.data.length, 10);
  assert.equal(LIST.meta.api_version, 'v1');
});

/* -------------------------------------------- content-health con preview verificado */

test('content-health mide fuentes del preview verificado por conflicto', () => {
  const p = resolve(REPO_ROOT, 'api/v1/conflicts.verified.enriched.json');
  if (!existsSync(p)) return;
  const details = readJson(p).data;
  const health = computeContentHealth(LIST.data, details);
  // Sprint 15: 10/10 conflictos con fuente verificada → 0 sin fuentes en el preview.
  assert.equal(health.by_conflict['red-sea'].sources, 1);
  assert.equal(health.by_conflict['istanbul'].sources, 1);
  assert.equal(health.content_gaps.without_sources_count, 0);
});
