// GEOPÓLEM (Sprint 19) — Release Candidate: clasificación editorial, manifiesto RC
// con checksum, QA funcional de rutas, PWA/offline y garantía de árbol limpio.
// ---------------------------------------------------------------------------
// Cubre las garantías del sprint:
//   • Cola editorial CLASIFICADA: taxonomía cerrada, determinista, sin inventar
//     datos; las fuentes bloqueadas → blocked_by_source con evidencia; los
//     causal_links → needs_human_review; nada se "resuelve" solo.
//   • Manifiesto RC: reproducible, apunta SÓLO a staging, checksum agregado
//     estable, verifyRcManifest detecta manipulación y rutas canónicas, y el RC
//     nunca se declara producción ni habilita publicación.
//   • QA funcional: contratos de home/mapa/ficha/deep-link/filtros + PWA/offline
//     (elegibilidad de caché y degradación limpia staging→canónico→local).
//   • Los scripts RC son NO-WRITE en modo lectura y dejan el árbol Git limpio.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const {
  classifyReviewQueue, classifyItem, itemKey, CLASSIFICATIONS, EDITORIAL_RC_CONTRACT,
} = await import('../../editorial-rc.mjs');
const {
  buildRcManifest, verifyRcManifest, aggregateChecksum, sha256,
  isCanonicalProductionPath, rcManifestPath, RC_CONTRACT,
} = await import('../../rc-package.mjs');
const {
  runQaContracts, checkDeepLinkRoute, checkFiltersRoute, checkPwaOffline,
  checkOfflineFallback, QA_RC_CONTRACT,
} = await import('../../qa-rc.mjs');

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/* ==================== 1) clasificación editorial ========================= */

test('classifyReviewQueue: taxonomía cerrada, 5 needs_human_review + 3 blocked_by_source, sin resolver', () => {
  const queue = readJson(resolve(REPO_ROOT, 'data/editorial-review-queue.json'));
  const rc = classifyReviewQueue({ queue, generatedAt: queue.generated_at, policyGate: { publish_enabled: false } });
  assert.equal(rc.contract, EDITORIAL_RC_CONTRACT);
  assert.equal(rc.summary.total, 8);
  assert.equal(rc.summary.by_classification.needs_human_review, 5);
  assert.equal(rc.summary.by_classification.blocked_by_source, 3);
  assert.equal(rc.summary.by_classification.resolved, 0);
  assert.equal(rc.summary.by_classification.deferred, 0);
  assert.equal(rc.summary.blocking_production, 8);
  for (const it of rc.items) assert.ok(CLASSIFICATIONS.includes(it.classification));
});

test('classifyReviewQueue: es determinista (misma entrada → misma salida)', () => {
  const queue = readJson(resolve(REPO_ROOT, 'data/editorial-review-queue.json'));
  const a = classifyReviewQueue({ queue, generatedAt: '2026-07-07T00:00:00.000Z' });
  const b = classifyReviewQueue({ queue, generatedAt: '2026-07-07T00:00:00.000Z' });
  assert.deepEqual(a, b);
});

test('classifyItem: source-review con evidencia de fetch bloqueado → blocked_by_source', () => {
  const item = { type: 'source-review', conflict: 'ukr-rus', source_slug: 'iaea-ukraine-update-356', accessed_via: 'web-search', resolvable_in_repo: false };
  const ev = { attempted_via: 'web-fetch', result: 'HTTP 402' };
  const c = classifyItem(item, ev);
  assert.equal(c.classification, 'blocked_by_source');
  assert.equal(c.blocking_gate, 'source-access');
  assert.equal(c.evidence.result, 'HTTP 402');
  assert.match(c.rationale, /402/);
});

test('classifyItem: causal-link-pending → needs_human_review (no inventable)', () => {
  const item = { type: 'causal-link-pending', conflict: 'asia-agua', title: 'X', resolvable_in_repo: false };
  const c = classifyItem(item);
  assert.equal(c.classification, 'needs_human_review');
  assert.equal(c.blocking_gate, 'editorial-signoff');
});

test('classifyItem: resolvable_in_repo:true → resolved sin gate', () => {
  const c = classifyItem({ type: 'source-review', conflict: 'x', resolvable_in_repo: true });
  assert.equal(c.classification, 'resolved');
  assert.equal(c.blocking_gate, null);
});

test('itemKey: distingue source vs causal y es estable', () => {
  assert.equal(itemKey({ type: 'source-review', conflict: 'a', source_slug: 's' }), 'a::source::s');
  assert.equal(itemKey({ type: 'causal-link-pending', conflict: 'a', title: 't' }), 'a::causal::t');
});

test('editorial-review-rc --check: el artefacto RC versionado está al día', () => {
  const SCRIPT = resolve(REPO_ROOT, 'scripts/editorial-review-rc.mjs');
  const out = execFileSync('node', [SCRIPT, '--check'], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.match(out, /al día/);
  const rc = readJson(resolve(REPO_ROOT, 'data/editorial-review-queue.rc.json'));
  assert.equal(rc.contract, EDITORIAL_RC_CONTRACT);
  assert.equal(rc.policy_gate.classification, 'blocked_by_policy');
});

/* ==================== 2) manifiesto Release Candidate ==================== */

test('aggregateChecksum: estable e independiente del orden de entrada', () => {
  const a = [{ path: 'api/v1/staging/b.json', sha256: sha256('b') }, { path: 'api/v1/staging/a.json', sha256: sha256('a') }];
  const b = [...a].reverse();
  assert.equal(aggregateChecksum(a), aggregateChecksum(b));
  assert.notEqual(aggregateChecksum(a), aggregateChecksum([{ path: 'api/v1/staging/a.json', sha256: sha256('x') }]));
});

test('isCanonicalProductionPath: distingue canónicos de staging', () => {
  assert.equal(isCanonicalProductionPath('api/v1/conflicts.json'), true);
  assert.equal(isCanonicalProductionPath('api/v1/conflicts/ukr-rus.json'), true);
  assert.equal(isCanonicalProductionPath('api/v1/staging/conflicts.enriched.json'), false);
});

test('buildRcManifest: reproducible, no es producción y calcula cobertura/blockers', () => {
  const artifacts = [{ path: 'api/v1/staging/conflicts.enriched.json', sha256: sha256('bundle') }];
  const coverage = { gate: { ok: true, coverage_ok: true, coverage_pct: 100 } };
  const editorial = { total: 8, by_classification: {}, resolved: 0, blocking_production: 8 };
  const m1 = buildRcManifest({ artifacts, coverage, editorialSummary: editorial, conflictIds: ['ukr-rus'], generatedAt: 'T', publishEnabled: false });
  const m2 = buildRcManifest({ artifacts, coverage, editorialSummary: editorial, conflictIds: ['ukr-rus'], generatedAt: 'T', publishEnabled: false });
  assert.deepEqual(m1, m2);
  assert.equal(m1.contract, RC_CONTRACT);
  assert.equal(m1.is_production, false);
  assert.equal(m1.coverage.coverage_pct, 100);
  assert.equal(m1.production.publish_enabled, false);
  // 8 pendientes + política deshabilitada ⇒ no listo para promoción.
  assert.equal(m1.production.ready_for_promotion, false);
  assert.ok(m1.production.blockers.some((b) => /DESHABILITADA/.test(b)));
});

test('buildRcManifest: sin pendientes y cobertura ok ⇒ ready_for_promotion (aún sin publicar)', () => {
  const m = buildRcManifest({
    artifacts: [{ path: 'api/v1/staging/x.json', sha256: sha256('x') }],
    coverage: { gate: { ok: true, coverage_ok: true, coverage_pct: 100 } },
    editorialSummary: { total: 0, blocking_production: 0 },
    publishEnabled: true, generatedAt: 'T',
  });
  assert.equal(m.production.ready_for_promotion, true);
});

test('verifyRcManifest: detecta manipulación de checksum y rutas canónicas prohibidas', () => {
  const good = buildRcManifest({
    artifacts: [{ path: 'api/v1/staging/x.json', sha256: sha256('x') }],
    coverage: { gate: { ok: true, coverage_ok: true, coverage_pct: 100 } }, generatedAt: 'T',
  });
  assert.equal(verifyRcManifest(good).ok, true);
  // Manipula un checksum.
  const tampered = JSON.parse(JSON.stringify(good));
  tampered.artifacts[0].sha256 = sha256('otro');
  assert.equal(verifyRcManifest(tampered).ok, false);
  // Inserta una ruta canónica de producción.
  const canon = buildRcManifest({
    artifacts: [{ path: 'api/v1/conflicts.json', sha256: sha256('c') }],
    coverage: { gate: { ok: true, coverage_ok: true, coverage_pct: 100 } }, generatedAt: 'T',
  });
  const res = verifyRcManifest(canon);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => /canónico de producción/.test(e)));
});

test('build-rc-package --check: el manifiesto RC versionado está al día e íntegro', () => {
  const SCRIPT = resolve(REPO_ROOT, 'scripts/build-rc-package.mjs');
  const out = execFileSync('node', [SCRIPT, '--check'], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.match(out, /al día e íntegro/);
  const m = readJson(resolve(REPO_ROOT, rcManifestPath()));
  assert.equal(m.contract, RC_CONTRACT);
  assert.equal(m.is_production, false);
  // Todos los artefactos referenciados viven bajo staging (producción intacta).
  for (const a of m.artifacts) assert.match(a.path, /^api\/v1\/staging\//);
  // Integridad real contra disco.
  const ver = verifyRcManifest(m, { readSha256: (rel) => sha256(readFileSync(resolve(REPO_ROOT, rel))) });
  assert.equal(ver.ok, true);
});

/* ==================== 3) QA funcional de rutas =========================== */

test('checkDeepLinkRoute: #foco={id} e ida-vuelta con filtros son estables', () => {
  const r = checkDeepLinkRoute({ ids: ['ukr-rus', 'sahel'] });
  assert.equal(r.ok, true);
});

test('checkFiltersRoute: cada clave de filtro parsea/serializa y omite vacíos', () => {
  const r = checkFiltersRoute();
  assert.equal(r.ok, true);
  assert.ok(r.checks.some((c) => c.name === 'filtro:omite-vacios' && c.ok));
  assert.ok(r.checks.some((c) => c.name === 'filtro:idempotente' && c.ok));
});

test('checkPwaOffline: RC/staging son cacheables, health es sólo-red, Pages OK', () => {
  const r = checkPwaOffline({ fileExists: (rel) => ['.nojekyll', 'manifest.webmanifest'].includes(rel), ids: ['ukr-rus'] });
  assert.equal(r.ok, true);
  assert.ok(r.checks.some((c) => c.name === 'cache:health-solo-red' && c.ok));
});

test('checkOfflineFallback: degradación limpia staging→canónico→local→none', async () => {
  const r = await checkOfflineFallback();
  assert.equal(r.ok, true);
  assert.equal(r.checks.length, 4);
});

test('runQaContracts: 7 rutas OK consumiendo staging real del repo', async () => {
  const bundle = readJson(resolve(REPO_ROOT, 'api/v1/staging/conflicts.enriched.json'));
  const ids = Object.keys(bundle.data);
  const rep = await runQaContracts({
    ids,
    fileExists: (rel) => existsSync(resolve(REPO_ROOT, rel)),
    loadMap: () => readJson(resolve(REPO_ROOT, 'api/v1/staging/conflicts/active/map.enriched.json')),
    loadStaging: (id) => readJson(resolve(REPO_ROOT, `api/v1/staging/conflicts/${id}.json`)),
  });
  assert.equal(rep.contract, QA_RC_CONTRACT);
  assert.equal(rep.ok, true);
  assert.equal(rep.summary.total, 7);
  assert.equal(rep.summary.failed, 0);
  assert.equal(rep.browser, false);
});

test('qa-rc-routes CLI: exit 0 y reporta 7/7', () => {
  const SCRIPT = resolve(REPO_ROOT, 'scripts/qa-rc-routes.mjs');
  const out = execFileSync('node', [SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.match(out, /7\/7/);
});

/* ==================== 4) árbol limpio (no-write) ========================= */

test('los scripts RC en modo lectura NO dejan diffs versionados', () => {
  const status = () => execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: REPO_ROOT, encoding: 'utf8' });
  const before = status();
  for (const [s, a] of [
    ['scripts/editorial-review-rc.mjs', ['--check']],
    ['scripts/build-rc-package.mjs', ['--check']],
    ['scripts/qa-rc-routes.mjs', ['--json']],
  ]) {
    execFileSync('node', [resolve(REPO_ROOT, s), ...a], { cwd: REPO_ROOT, stdio: 'ignore' });
  }
  assert.equal(status(), before, 'los checks RC deben ser no-write/no-diff');
});
