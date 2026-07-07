// GEOPÓLEM — Guardián NO-PRODUCTION del cierre maestro (Sprint 30).
// ---------------------------------------------------------------------------
// Verifica que los artefactos del cierre maestro (docs/master-close/*.json)
// NO habilitan producción ni contienen secretos:
//   • production.is_production === false
//   • production.activates_production_gate === false
//   • production.contains_secrets === false
//   • ausencia de patrones de secretos evidentes en el JSON serializado.
//
// Es un validador de seguridad estático, determinista y sin efectos:
//   node scripts/verify-no-production.mjs           (verifica; exit≠0 si falla)
//   node scripts/verify-no-production.mjs --json      (informe JSON)
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const TARGETS = [
  'docs/master-close/continuity-audit.json',
  'docs/master-close/risk-matrix.json',
  'docs/master-close/production-checklist.json',
  'docs/master-close/index.json',
];

// Patrones conservadores de secretos evidentes. No pretende ser exhaustivo;
// bloquea las formas más comunes que jamás deberían aparecer en estos docs.
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, // JWT real
  /(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["'][^"']{8,}["']/i,
];

export function verifyNoProduction({ repoRoot = REPO_ROOT } = {}) {
  const results = [];
  for (const rel of TARGETS) {
    const p = resolve(repoRoot, rel);
    if (!existsSync(p)) {
      results.push({ file: rel, ok: false, reason: 'ausente (ejecuta npm run master-close:write)' });
      continue;
    }
    const raw = readFileSync(p, 'utf8');
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      results.push({ file: rel, ok: false, reason: 'JSON inválido' });
      continue;
    }
    const prod = json.production || {};
    const problems = [];
    if (prod.is_production !== false) problems.push('is_production!==false');
    if (prod.activates_production_gate !== false) problems.push('activates_production_gate!==false');
    if (prod.contains_secrets !== false) problems.push('contains_secrets!==false');
    for (const re of SECRET_PATTERNS) {
      if (re.test(raw)) problems.push(`posible secreto: ${re.source.slice(0, 32)}`);
    }
    results.push({ file: rel, ok: problems.length === 0, reason: problems.join('; ') || 'ok' });
  }
  return {
    contract: 'sprint-30-no-production-guard-v1',
    ok: results.every((r) => r.ok),
    checked: results.length,
    results,
  };
}

function main() {
  const asJson = process.argv.includes('--json');
  const rep = verifyNoProduction();
  if (asJson) {
    process.stdout.write(`${JSON.stringify(rep, null, 2)}\n`);
    return rep.ok ? 0 : 1;
  }
  for (const r of rep.results) {
    process.stdout.write(`${r.ok ? 'OK  ' : 'FAIL'} ${r.file}${r.ok ? '' : ' — ' + r.reason}\n`);
  }
  if (!rep.ok) {
    process.stderr.write('[no-production] FALLO: hay artefactos que habilitan producción o contienen secretos.\n');
    return 1;
  }
  process.stdout.write(`[no-production] OK: ${rep.checked} artefactos sin producción ni secretos.\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
