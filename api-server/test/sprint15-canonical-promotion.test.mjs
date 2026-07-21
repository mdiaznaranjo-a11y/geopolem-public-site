// GEOPÓLEM (Sprint 15) — tests de cierre editorial 100%, revisión de fuentes
// indirectas, gates de promoción canónica a STAGING, separación/rollback y
// validación de fuentes.
// ---------------------------------------------------------------------------
// Cubre:
//   • Cobertura verificada 100% (cierre honesto de istanbul e ia-narrativa).
//   • Fuentes indirectas (accessed_via='web-search') marcadas needs_human_review.
//   • GATE de promoción: autoriza a 100% y BLOQUEA ante demo/example/published-
//     sin-fuente/causal-sin-fuente/pendiente-no-justificado/cobertura-insuficiente.
//   • Builders de staging: detalles v1 + mapa enriquecido con trazabilidad.
//   • Separación preview/staging/canónico: producción intacta.
//   • Rollback: la CLI respalda y restaura los artefactos de staging.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const {
  validatePromotionReadiness, collectReviewFlags, collectJustifiedPendingIds,
  buildStagingDetails, buildStagingMap, buildPromotionBundle,
  STAGING_DETAILS_CONTRACT, STAGING_MAP_CONTRACT,
} = await import('../../conflict-promotion.mjs');
const { validateVerifiedSeed, isExampleUrl } = await import('../../conflict-sources.mjs');
const { validateDetail } = await import('../scripts/export-static-bridge.mjs');

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const SEED = readJson(resolve(REPO_ROOT, 'data/conflict-relations.verified.seed.json'));
const LIST = readJson(resolve(REPO_ROOT, 'api/v1/conflicts.json'));
const TODO = readJson(resolve(REPO_ROOT, 'data/source-research.todo.json'));
const INV_IDS = LIST.data.map((c) => c.id);

const verifiedSource = {
  slug: 's1', title: 'Informe real', url: 'https://www.sipri.org/x',
  publisher: 'SIPRI', verification: 'verified', accessed_at: '2026-07-07',
};

/* ------------------------------------------------------ cierre editorial 100% */

test('la semilla real cierra al 100%: istanbul e ia-narrativa tienen fuente verificada', () => {
  const ist = SEED.conflicts['istanbul'];
  const ia = SEED.conflicts['ia-narrativa'];
  assert.equal(ist.sources.length, 1);
  assert.equal(ist.sources[0].verification, 'verified');
  assert.equal(ist.editorial_status, 'review');
  assert.equal(ia.sources.length, 1);
  assert.equal(ia.sources[0].verification, 'verified');
  assert.equal(ia.editorial_status, 'review');
});

test('las fuentes nuevas del cierre no son placeholders ni demo', () => {
  for (const id of ['istanbul', 'ia-narrativa']) {
    for (const s of SEED.conflicts[id].sources) {
      assert.notEqual(s.demo, true);
      assert.equal(isExampleUrl(s.url), false);
      assert.equal(s.accessed_via, 'web-fetch'); // fetch directo confirmado
      assert.ok(s.accessed_at, `${id}: sin accessed_at`);
    }
  }
});

test('el cierre no fabrica causal falso: istanbul sigue pending, ia-narrativa se verifica con su fuente', () => {
  const istLink = SEED.conflicts['istanbul'].causal_links[0];
  assert.equal(istLink.pending, true); // fuente de contexto, causal por confirmar
  assert.deepEqual(istLink.source_slugs, ['turkiye-mfa-montreux']);
  const iaLink = SEED.conflicts['ia-narrativa'].causal_links[0];
  assert.equal(iaLink.pending, false); // la fuente UN respalda la afirmación
  assert.deepEqual(iaLink.source_slugs, ['un-ai-global-issues']);
});

/* --------------------------------------------------- fuentes indirectas review */

test('collectReviewFlags detecta las 3 fuentes accessed_via=web-search bloqueadas', () => {
  const flags = collectReviewFlags(SEED);
  const slugs = flags.map((f) => f.source_slug).sort();
  assert.deepEqual(slugs, ['iaea-ukraine-update-356', 'ocha-opt', 'unhcr-sahel-emergency']);
  for (const f of flags) assert.equal(f.accessed_via, 'web-search');
});

test('las fuentes con needs_human_review conservan transparencia (verification + accessed_via)', () => {
  let count = 0;
  for (const entry of Object.values(SEED.conflicts)) {
    for (const s of entry.sources || []) {
      if (s.needs_human_review === true) {
        count += 1;
        assert.equal(s.verification, 'verified');
        assert.ok(s.accessed_via, 'accessed_via preservado');
        assert.ok(s.review_reason, 'review_reason documentado');
      }
    }
  }
  assert.equal(count, 3);
});

test('la cola de investigación lista los needs_human_review y ya no reporta pendientes de fuente', () => {
  assert.equal(Array.isArray(TODO.needs_human_review), true);
  assert.equal(TODO.needs_human_review.length, 3);
  // Ningún item queda como "pending" de fuente (todos sourced o en review causal).
  const stillPendingSource = (TODO.items || []).filter((i) => i.status === 'pending');
  assert.deepEqual(stillPendingSource, []);
});

/* ------------------------------------------------ collectJustifiedPendingIds */

test('collectJustifiedPendingIds extrae los ids de la cola de investigación', () => {
  const ids = collectJustifiedPendingIds(TODO);
  assert.ok(ids.has('istanbul'));
  assert.ok(ids.has('sahel'));
  assert.equal(ids.has('inexistente'), false);
});

/* --------------------------------------------------- GATE de promoción (real) */

test('validatePromotionReadiness AUTORIZA sobre la semilla real (100%, sin bloqueos)', () => {
  const gate = validatePromotionReadiness(SEED, {
    minCoveragePct: 100,
    justifiedPendingIds: collectJustifiedPendingIds(TODO),
    inventoryIds: INV_IDS,
  });
  assert.equal(gate.ok, true, gate.blockers.join('; '));
  assert.equal(gate.coverage_ok, true);
  assert.equal(gate.coverage_pct, 100);
  // las 3 fuentes indirectas se reportan como review_flags (no bloquean staging).
  assert.equal(gate.review_flags.length, 3);
});

/* --------------------------------------------------- GATE de promoción (bloqueos) */

function seedWith(conflict) {
  return { contract: 'sprint-14-verified-v1', conflicts: conflict };
}

test('GATE bloquea fuente demo publicable', () => {
  const gate = validatePromotionReadiness(seedWith({
    x: { editorial_status: 'review', causal_links: [], sources: [{ ...verifiedSource, demo: true }] },
  }), { justifiedPendingIds: new Set(['x']) });
  assert.equal(gate.ok, false);
  // demo => validateVerifiedSeed la marca inválida y además no es publicable (0 fuentes) => pendiente
  assert.ok(gate.blockers.some((b) => /demo|pendiente/.test(b)));
});

test('GATE bloquea causal_link real sin fuente', () => {
  const gate = validatePromotionReadiness(seedWith({
    x: { editorial_status: 'review', causal_links: [{ title: 'C', pending: false }], sources: [verifiedSource] },
  }), { justifiedPendingIds: new Set() });
  assert.equal(gate.ok, false);
  assert.ok(gate.blockers.some((b) => /causal_link real sin fuente/.test(b)));
});

test('GATE bloquea conflicto published sin fuente', () => {
  const gate = validatePromotionReadiness(seedWith({
    x: { editorial_status: 'published', causal_links: [], sources: [] },
  }), { justifiedPendingIds: new Set(['x']) });
  assert.equal(gate.ok, false);
  assert.ok(gate.blockers.some((b) => /published' sin fuente|published sin/.test(b)));
});

test('GATE bloquea pendiente NO justificado en la cola de investigación', () => {
  const gate = validatePromotionReadiness(seedWith({
    huerfano: { editorial_status: 'draft', causal_links: [], sources: [] },
  }), { justifiedPendingIds: new Set() });
  assert.equal(gate.ok, false);
  assert.ok(gate.blockers.some((b) => /pendiente sin justificar/.test(b)));
});

test('GATE reporta cobertura insuficiente como bloqueo de autorización (no de gate.ok)', () => {
  const gate = validatePromotionReadiness(seedWith({
    a: { editorial_status: 'review', causal_links: [], sources: [verifiedSource] },
    b: { editorial_status: 'draft', causal_links: [], sources: [] },
  }), { minCoveragePct: 100, justifiedPendingIds: new Set(['b']) });
  // b está justificado => sin bloqueos; pero cobertura 50% < 100 => no autoriza.
  assert.equal(gate.ok, true);
  assert.equal(gate.coverage_ok, false);
  assert.equal(gate.coverage_pct, 50);
});

/* --------------------------------------------------- builders de staging */

test('buildStagingDetails produce detalles v1 válidos con fuentes verificadas', () => {
  const canonical = readJson(resolve(REPO_ROOT, 'api/v1/conflicts/red-sea.json'));
  const details = { 'red-sea': canonical };
  const staging = buildStagingDetails([{ id: 'red-sea', name: 'Mar Rojo' }], details, SEED);
  const data = staging['red-sea'];
  assert.equal(data.sources.length, 1);
  const { ok, errors } = validateDetail({ data, meta: { api_version: 'v1' } }, 'red-sea');
  assert.equal(ok, true, errors.join('; '));
});

test('buildStagingMap añade trazabilidad de fuentes verificadas por feature', () => {
  const staging = buildStagingDetails(LIST.data, {}, SEED);
  const map = buildStagingMap(staging);
  assert.equal(map.type, 'FeatureCollection');
  const redSea = map.features.find((f) => f.properties.id === 'red-sea');
  assert.equal(redSea.properties.has_verified_source, true);
  assert.equal(redSea.properties.sources_count, 1);
  const ukr = map.features.find((f) => f.properties.id === 'ukr-rus');
  assert.equal(ukr.properties.needs_human_review, true); // fuente IAEA web-search
});

test('buildPromotionBundle marca authorized y reporta cobertura antes/después', () => {
  const gate = validatePromotionReadiness(SEED, {
    minCoveragePct: 100, justifiedPendingIds: collectJustifiedPendingIds(TODO), inventoryIds: INV_IDS,
  });
  const bundle = buildPromotionBundle({ items: LIST.data, details: {}, seed: SEED, gate });
  assert.equal(bundle.detailsDoc.contract, STAGING_DETAILS_CONTRACT);
  assert.equal(bundle.detailsDoc.authorized, true);
  assert.equal(bundle.mapDoc.contract, STAGING_MAP_CONTRACT);
  assert.equal(bundle.coverageReport.after.conflicts_with_sources, 10);
});

/* --------------------------------------------------- separación / on-disk */

test('los detalles CANÓNICOS de producción siguen SIN fuentes (no promocionados)', () => {
  for (const it of LIST.data) {
    const p = resolve(REPO_ROOT, `api/v1/conflicts/${it.id}.json`);
    if (!existsSync(p)) continue;
    const d = readJson(p).data;
    assert.equal(d.sources.length, 0, `${it.id}: canónico de producción no debe tener fuentes`);
  }
});

test('los artefactos de STAGING en disco viven bajo api/v1/staging y validan contra v1', () => {
  const bundleP = resolve(REPO_ROOT, 'api/v1/staging/conflicts.enriched.json');
  if (!existsSync(bundleP)) return; // se generan con promote:staging
  const doc = readJson(bundleP);
  assert.equal(doc.contract, STAGING_DETAILS_CONTRACT);
  assert.equal(doc.staging, true);
  assert.equal(doc.canonical, false);
  for (const [id, data] of Object.entries(doc.data)) {
    const { ok, errors } = validateDetail({ data, meta: { api_version: 'v1' } }, id);
    assert.equal(ok, true, `${id}: ${errors.join('; ')}`);
    for (const s of data.sources) {
      assert.notEqual(s.demo, true);
      assert.equal(isExampleUrl(s.url), false);
    }
  }
});

/* --------------------------------------------------- rollback (CLI, integración) */

test('la CLI de promoción respalda y restaura los artefactos de staging (rollback)', () => {
  const script = resolve(REPO_ROOT, 'scripts/promote-canonical-staging.mjs');
  // Sprint 17: aislamos la escritura en un tempdir (GEOP_STAGING_ROOT) para NO
  // ensuciar los artefactos versionados de api/v1/staging (regenerable pero
  // con generated_at no determinista → provocaba diffs en el árbol).
  const stagingRoot = mkdtempSync(resolve(tmpdir(), 'geop-staging-'));
  const rollbackDir = resolve(stagingRoot, '.rollback');
  const env = { ...process.env, GEOP_STAGING_ROOT: stagingRoot };
  const cwd = resolve(REPO_ROOT, 'api-server');
  try {
    // Primera escritura (crea artefactos si no existen).
    execFileSync('node', [script, '--write-staging'], { cwd, env });
    // Segunda escritura: al existir artefactos, deben respaldarse en .rollback.
    execFileSync('node', [script, '--write-staging'], { cwd, env });
    assert.equal(existsSync(rollbackDir), true, 'debe existir .rollback tras sobrescribir');
    // Rollback restaura y limpia el respaldo.
    execFileSync('node', [script, '--rollback'], { cwd, env });
    assert.equal(existsSync(rollbackDir), false, '.rollback debe eliminarse tras restaurar');
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }
});
