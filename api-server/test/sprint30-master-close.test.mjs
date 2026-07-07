// GEOPÓLEM (Sprint 30) — Cierre maestro: auditoría de continuidad, matriz de
// riesgos abierta, checklist final de producción con gate humano y guardián
// no-production.
// ---------------------------------------------------------------------------
// Cubre (sin DB ni navegador):
//   • CONTINUITY: cadena #1–#30 derivada de reportes/ramas; dependencias N→N+1;
//     riesgos de rebase incl. Sprint 28 vs Sprint 27; producción bloqueada con
//     condiciones de desbloqueo humano.
//   • RISK-MATRIX: riesgos mínimos exigidos con severidad/probabilidad/owner/
//     mitigación/criterio de cierre/estado; enriquecida con señales en vivo.
//   • PRODUCTION-CHECKLIST: gate humano obligatorio, publishes=false, todo pending.
//   • NO-PRODUCTION GUARD: los artefactos JSON no habilitan producción ni traen
//     secretos.
//   • DETERMINISMO: artefactos en disco al día (--check pasaría).
//   • DOCS: guías estáticas presentes.
// ---------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildContinuityAudit,
  buildRiskMatrix,
  buildProductionChecklist,
  buildMasterClosePackage,
  MASTER_CLOSE_CONTRACT,
} from '../../scripts/build-master-close.mjs';
import { verifyNoProduction } from '../../scripts/verify-no-production.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const abs = (rel) => resolve(REPO_ROOT, rel);
const readJson = (rel) => JSON.parse(readFileSync(abs(rel), 'utf8'));

/* ==================== 1) AUDITORÍA DE CONTINUIDAD ===================== */

test('continuity: cadena completa #1–#30 con dependencias N→N+1', () => {
  const a = buildContinuityAudit({ repoRoot: REPO_ROOT });
  assert.equal(a.contract, MASTER_CLOSE_CONTRACT);
  assert.equal(a.totals.sprints, 30);
  assert.equal(a.chain[0].sprint, 1);
  assert.equal(a.chain[29].sprint, 30);
  assert.equal(a.chain[0].depends_on, null);
  for (let i = 1; i < a.chain.length; i += 1) {
    assert.equal(a.chain[i].depends_on, a.chain[i - 1].sprint);
  }
});

test('continuity: reportes verificados en vivo (existsSync) y sprint 30 presente', () => {
  const a = buildContinuityAudit({ repoRoot: REPO_ROOT });
  const s29 = a.chain.find((c) => c.sprint === 29);
  assert.equal(s29.report_present, true);
  // Sprint 3 no declara reporte en la raíz.
  const s3 = a.chain.find((c) => c.sprint === 3);
  assert.equal(s3.report, null);
});

test('continuity: destaca Sprint 28 vs Sprint 27 y cadena abierta', () => {
  const a = buildContinuityAudit({ repoRoot: REPO_ROOT });
  const ids = a.rebase_risks.map((r) => r.id);
  assert.ok(ids.includes('pr28-targets-main'));
  const r28 = a.rebase_risks.find((r) => r.id === 'pr28-targets-main');
  assert.deepEqual(r28.sprints, [27, 28]);
  assert.ok(ids.includes('open-chain-vs-main'));
});

test('continuity: producción bloqueada con condiciones de desbloqueo humano', () => {
  const a = buildContinuityAudit({ repoRoot: REPO_ROOT });
  assert.equal(a.production.is_production, false);
  assert.equal(a.production_status.state, 'blocked');
  assert.ok(a.production_status.unblock_conditions.length >= 4);
});

/* ==================== 2) MATRIZ DE RIESGOS ============================ */

test('risk-matrix: incluye los riesgos mínimos exigidos', () => {
  const m = buildRiskMatrix({ repoRoot: REPO_ROOT });
  const ids = m.risks.map((r) => r.id);
  for (const req of [
    'pr-chain-open', 'production-blocked', 'canonical-causal-links',
    'i18n-incomplete', 'human-curation', 'scorm-real-vs-portable',
    'editorial-sources-citations', 'security-jwt-roles', 'backups-dr',
    'observability', 'social-not-connected',
  ]) {
    assert.ok(ids.includes(req), `falta riesgo ${req}`);
  }
});

test('risk-matrix: cada riesgo tiene los campos exigidos', () => {
  const m = buildRiskMatrix({ repoRoot: REPO_ROOT });
  for (const r of m.risks) {
    for (const k of ['id', 'title', 'severity', 'probability', 'owner', 'mitigation', 'close_criteria', 'status']) {
      assert.ok(r[k] !== undefined && r[k] !== '', `riesgo ${r.id} sin ${k}`);
    }
  }
  assert.equal(m.production.is_production, false);
});

/* ==================== 3) CHECKLIST DE PRODUCCIÓN ===================== */

test('production-checklist: gate humano obligatorio y no publica', () => {
  const p = buildProductionChecklist({ repoRoot: REPO_ROOT });
  assert.equal(p.publishes, false);
  assert.equal(p.requires_human_gate, true);
  assert.equal(p.production.is_production, false);
  assert.ok(p.items.every((i) => i.status === 'pending'));
  assert.ok(p.totals.human_gates >= 1);
  assert.ok(p.items.some((i) => i.id === 'human-signoff' && i.human_gate && i.blocking));
});

/* ==================== 4) GUARDIÁN NO-PRODUCTION ====================== */

test('no-production: artefactos sin producción ni secretos', () => {
  const rep = verifyNoProduction({ repoRoot: REPO_ROOT });
  assert.equal(rep.ok, true, JSON.stringify(rep.results));
  assert.ok(rep.checked >= 4);
});

/* ==================== 5) DETERMINISMO / ARTEFACTOS =================== */

test('master-close: artefactos en disco al día (--check pasaría)', () => {
  const pkg = buildMasterClosePackage({ repoRoot: REPO_ROOT });
  for (const [name, content] of Object.entries(pkg.files)) {
    const onDisk = readFileSync(abs(`docs/master-close/${name}`), 'utf8');
    assert.equal(onDisk, content, `desactualizado: ${name}`);
  }
});

test('master-close: determinista (dos construcciones idénticas)', () => {
  const a = JSON.stringify(buildMasterClosePackage({ repoRoot: REPO_ROOT }).index);
  const b = JSON.stringify(buildMasterClosePackage({ repoRoot: REPO_ROOT }).index);
  assert.equal(a, b);
});

/* ==================== 6) DOCS ESTÁTICAS ============================== */

test('docs: guías estáticas del cierre maestro presentes', () => {
  for (const rel of [
    'docs/master-close/README.md',
    'docs/master-close/annual-operations-guide.md',
    'docs/master-close/pr-integration-plan.md',
    'docs/master-close/artifact-map.md',
  ]) {
    assert.ok(existsSync(abs(rel)), `falta ${rel}`);
  }
});

test('master-close: el índice referencia artefactos que existen en disco', () => {
  const idx = readJson('docs/master-close/index.json');
  for (const group of Object.values(idx.artifacts)) {
    for (const rel of Object.values(group)) {
      assert.ok(existsSync(abs(`docs/master-close/${rel}`)), `índice apunta a inexistente: ${rel}`);
    }
  }
});
