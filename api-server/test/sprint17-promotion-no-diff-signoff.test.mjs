// GEOPÓLEM (Sprint 17) — promoción no destructiva: check no-write, dry-run
// auditable, sign-off humano requerido, producción bloqueada, tempdir/cleanup y
// separación canónica.
// ---------------------------------------------------------------------------
// Cubre las garantías del sprint:
//   • promote:check y dry-run NO escriben ni dejan diffs en el árbol Git.
//   • --dry-run produce un resumen auditable (qué se escribiría) sin tocar disco.
//   • summarizePromotion NUNCA marca destinos canónicos ni escritura a disco.
//   • sign-off: sin autorización explícita, --promote-production está BLOQUEADO.
//   • con sign-off válido, producción SÓLO hace dry-run (jamás escribe canónicos).
//   • el sign-off rechaza formatos inválidos y valores que aparentan secretos.
//   • --write-staging en un tempdir (GEOP_STAGING_ROOT) no ensucia el repo y no
//     deja residuos *.tmp (cleanup atómico).
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, rmSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const {
  validatePromotionReadiness, buildPromotionBundle, collectJustifiedPendingIds, summarizePromotion,
} = await import('../../conflict-promotion.mjs');
const { resolveSignoff, SIGNOFF_ENV_VAR } = await import('../../promotion-signoff.mjs');

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const API_DIR = resolve(REPO_ROOT, 'api-server');
const SCRIPT = resolve(REPO_ROOT, 'scripts/promote-canonical-staging.mjs');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const SEED = readJson(resolve(REPO_ROOT, 'data/conflict-relations.verified.seed.json'));
const LIST = readJson(resolve(REPO_ROOT, 'api/v1/conflicts.json'));
const TODO = readJson(resolve(REPO_ROOT, 'data/source-research.todo.json'));
const INV_IDS = LIST.data.map((c) => c.id);

function realGate() {
  return validatePromotionReadiness(SEED, {
    minCoveragePct: 100, justifiedPendingIds: collectJustifiedPendingIds(TODO), inventoryIds: INV_IDS,
  });
}

// git status --porcelain (sólo versionados) del subárbol de staging.
function stagingTrackedStatus() {
  const out = execFileSync('git', ['status', '--porcelain', '--untracked-files=no', '--', 'api/v1/staging'], {
    cwd: REPO_ROOT, encoding: 'utf8',
  });
  return out.split('\n').map((l) => l.trim()).filter(Boolean);
}

function run(argsArr, env = {}) {
  try {
    const stdout = execFileSync('node', [SCRIPT, ...argsArr], {
      cwd: API_DIR, encoding: 'utf8', env: { ...process.env, ...env },
    });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status ?? 1, stdout: e.stdout?.toString() ?? '', stderr: e.stderr?.toString() ?? '' };
  }
}

/* --------------------------------------------------- check no-write / no-diff */

test('promote:check no escribe artefactos ni deja diffs en el árbol Git', () => {
  const before = stagingTrackedStatus();
  const { code } = run(['--check']);
  assert.equal(code, 0);
  assert.deepEqual(stagingTrackedStatus(), before, 'el check no debe dejar diffs versionados');
});

test('dry-run no deja diffs versionados en api/v1/staging', () => {
  const before = stagingTrackedStatus();
  const { code } = run(['--dry-run', '--json']);
  assert.equal(code, 0);
  assert.deepEqual(stagingTrackedStatus(), before);
});

/* --------------------------------------------------- dry-run auditable (JSON) */

test('--dry-run --json resume qué se escribiría sin tocar disco ni canónicos', () => {
  const { code, stdout } = run(['--dry-run', '--json']);
  assert.equal(code, 0);
  const { summary } = JSON.parse(stdout);
  assert.equal(summary.dry_run, true);
  assert.equal(summary.scope, 'staging');
  assert.equal(summary.touches_disk, false);
  assert.equal(summary.touches_canonical, false);
  // 10 detalles + bundle + mapa + coverage = 13 archivos.
  assert.equal(summary.counts.details, 10);
  assert.equal(summary.counts.files_would_write, 13);
  // Ningún destino declara canonical:true y todos viven bajo api/v1/staging/.
  for (const w of summary.would_write) {
    assert.equal(w.canonical, false);
    assert.ok(w.path.startsWith('api/v1/staging/'), `destino fuera de staging: ${w.path}`);
  }
});

test('summarizePromotion (puro) nunca marca canónico ni escritura a disco', () => {
  const gate = realGate();
  const bundle = buildPromotionBundle({ items: LIST.data, details: {}, seed: SEED, gate, generatedAt: '2020-01-01T00:00:00.000Z' });
  const targets = {
    bundle: 'api/v1/staging/conflicts.enriched.json',
    map: 'api/v1/staging/conflicts/active/map.enriched.json',
    coverage: 'api/v1/staging/coverage-report.json',
    detail: (id) => `api/v1/staging/conflicts/${id}.json`,
  };
  const s = summarizePromotion({ bundle, gate, targets, scope: 'production' });
  assert.equal(s.touches_disk, false);
  assert.equal(s.touches_canonical, false);
  assert.equal(s.generated_at, '2020-01-01T00:00:00.000Z');
  // scope=production añade el checklist de sign-off humano.
  assert.ok(s.pending_checklist.some((c) => /sign-off/i.test(c)));
});

/* --------------------------------------------------- determinismo (no-diff) */

test('buildPromotionBundle con generatedAt fijo es reproducible (no-diff)', () => {
  const gate = realGate();
  const a = buildPromotionBundle({ items: LIST.data, details: {}, seed: SEED, gate, generatedAt: '2020-01-01T00:00:00.000Z' });
  const b = buildPromotionBundle({ items: LIST.data, details: {}, seed: SEED, gate, generatedAt: '2020-01-01T00:00:00.000Z' });
  assert.deepEqual(a, b);
  assert.equal(a.generated_at, '2020-01-01T00:00:00.000Z');
});

/* --------------------------------------------------- sign-off requerido */

test('resolveSignoff sin entorno ni archivo: NO autoriza', () => {
  const r = resolveSignoff({ env: {}, signoffPath: '/no/existe.json', fileExists: () => false });
  assert.equal(r.ok, false);
  assert.equal(r.source, 'none');
});

test('resolveSignoff acepta env var con approver y scope=production', () => {
  const r = resolveSignoff({ env: { [SIGNOFF_ENV_VAR]: 'approver=Ana;scope=production;date=2026-07-07' } });
  assert.equal(r.ok, true);
  assert.equal(r.signoff.approver, 'Ana');
  assert.equal(r.signoff.scope, 'production');
});

test('resolveSignoff rechaza scope incorrecto y valores que aparentan secretos', () => {
  assert.equal(resolveSignoff({ env: { [SIGNOFF_ENV_VAR]: 'approver=Ana;scope=staging' } }).ok, false);
  const secret = resolveSignoff({ env: { [SIGNOFF_ENV_VAR]: 'approver=Ana;scope=production;token=abc123' } });
  assert.equal(secret.ok, false);
  assert.match(secret.reason, /secreto/i);
});

test('resolveSignoff lee un archivo local JSON de sign-off', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'geop-signoff-'));
  const p = join(dir, 'signoff.json');
  writeFileSync(p, JSON.stringify({ approver: 'Comité Editorial', scope: 'production', date: '2026-07-07' }));
  try {
    const r = resolveSignoff({ env: {}, signoffPath: p, fileExists: existsSync, readFile: (x) => readFileSync(x, 'utf8') });
    assert.equal(r.ok, true);
    assert.equal(r.source, 'file:.promotion-signoff.json');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* --------------------------------------------------- producción bloqueada */

test('--promote-production SIN sign-off está bloqueado (exit!=0) y no escribe', () => {
  const before = stagingTrackedStatus();
  const { code, stderr } = run(['--promote-production'], { GEOP_PROMOTION_SIGNOFF: '' });
  assert.notEqual(code, 0);
  assert.match(stderr, /BLOQUEADA|sign-off/i);
  assert.deepEqual(stagingTrackedStatus(), before);
});

test('--promote-production CON sign-off sólo hace dry-run (no escribe canónicos)', () => {
  const before = stagingTrackedStatus();
  const { code, stdout } = run(['--promote-production'], {
    GEOP_PROMOTION_SIGNOFF: 'approver=Ana;scope=production;date=2026-07-07',
  });
  assert.equal(code, 0);
  assert.match(stdout, /DRY-RUN de promoción \(production\)/);
  assert.match(stdout, /Toca canónicos:\s+no/);
  assert.deepEqual(stagingTrackedStatus(), before, 'producción dry-run no debe tocar el árbol');
});

/* --------------------------------------------------- tempdir / cleanup */

test('--write-staging en GEOP_STAGING_ROOT escribe en tempdir sin residuos *.tmp ni diffs en el repo', () => {
  const before = stagingTrackedStatus();
  const stagingRoot = mkdtempSync(resolve(tmpdir(), 'geop-staging-'));
  try {
    const { code } = run(['--write-staging', '--generated-at=2020-01-01T00:00:00.000Z'], { GEOP_STAGING_ROOT: stagingRoot });
    assert.equal(code, 0);
    // Artefactos escritos en el tempdir, no en el repo.
    assert.ok(existsSync(join(stagingRoot, 'conflicts.enriched.json')));
    // Sin residuos *.tmp (escritura atómica limpia).
    const leftovers = readdirSync(stagingRoot).filter((f) => f.endsWith('.tmp'));
    assert.deepEqual(leftovers, []);
    // El árbol versionado del repo permanece intacto.
    assert.deepEqual(stagingTrackedStatus(), before, 'escribir en tempdir no debe tocar api/v1/staging versionado');
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }
});

/* --------------------------------------------------- separación canónica */

test('el dry-run no lista jamás rutas canónicas de producción', () => {
  const { stdout } = run(['--dry-run', '--json']);
  const { summary } = JSON.parse(stdout);
  for (const w of summary.would_write) {
    assert.equal(w.path.startsWith('api/v1/conflicts/'), false, `no debe escribir canónico: ${w.path}`);
    assert.notEqual(w.path, 'api/v1/conflicts.json');
  }
});
