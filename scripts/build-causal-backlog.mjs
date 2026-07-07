// GEOPÓLEM — Backlog accionable de advertencias causales (Sprint 27)
// ---------------------------------------------------------------------------
// Transforma la VALIDACIÓN CRUZADA causal del Sprint 26 y los campos `pending`
// del banco de casos en un BACKLOG pedagógico accionable, con:
//   caso · tipo de advertencia · severidad · acción recomendada · responsable
//   sugerido · estado.
//
// Principios:
//   • NO inventa datos causales: sólo reetiqueta lo que ya reportan
//     `crosscheckAll` (matrices ↔ causal_links) y el índice del banco de casos.
//   • Si falta evidencia (campo `pending`), el estado es `pendiente` y la acción
//     es de REVISIÓN, nunca una afirmación causal nueva.
//   • Determinista (sin timestamps en la salida) → admite --check en CI.
//   • No activa producción ni contiene secretos.
//
// Uso:
//   node scripts/build-causal-backlog.mjs            (resumen)
//   node scripts/build-causal-backlog.mjs --json      (backlog JSON)
//   node scripts/build-causal-backlog.mjs --write      (escribe docs/education/causal-backlog/)
//   node scripts/build-causal-backlog.mjs --check      (exit!=0 si difiere)
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crosscheckAll } from './validate-causal-crosscheck.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

export const BACKLOG_CONTRACT = 'sprint-27-causal-backlog-v1';
const CASE_BANK_INDEX = 'docs/education/case-bank/case-bank.index.json';
const OUT_DIR = 'docs/education/causal-backlog';

const abs = (rel) => resolve(REPO_ROOT, rel);

// Mapa determinista: código de divergencia → acción/responsable/severidad-base.
// La severidad real la fija el crosscheck; aquí sólo derivamos acción y dueño.
const CODE_POLICY = {
  contract_mismatch: { action: 'Corregir el contrato declarado en la matriz para alinearlo con el banco de casos.', owner: 'equipo editorial' },
  conflict_missing_in_source: { action: 'Revisar por qué el conflicto no existe en la fuente; regenerar la ficha o retirar la matriz.', owner: 'equipo editorial' },
  link_count_mismatch: { action: 'Reconciliar el número de enlaces de la matriz con los causal_links de la fuente.', owner: 'equipo editorial' },
  link_not_in_source: { action: 'Retirar de la matriz el enlace sin respaldo o añadir la evidencia a la fuente verificada.', owner: 'equipo editorial' },
  link_missing_in_matrix: { action: 'Representar en la matriz el enlace presente en la fuente.', owner: 'instructor' },
  link_type_mismatch: { action: 'Alinear el link_type de la matriz con el de la fuente verificada.', owner: 'equipo editorial' },
  evidence_mismatch: { action: 'Alinear la evidencia de la matriz con la explanation de la fuente.', owner: 'equipo editorial' },
  sources_mismatch: { action: 'Reconciliar los source_slugs de la matriz con los de la fuente.', owner: 'equipo editorial' },
  node_without_source: { action: 'Revisar el nodo: derivarlo de actores/recursos/chokepoints reales o retirarlo.', owner: 'instructor' },
  source_is_demo: { action: 'Sustituir los datos de demo por fuente verificada antes de usar el caso en evaluación.', owner: 'equipo de datos' },
  stage_drift: { action: 'Revisar la deriva entre stages (RC ↔ staging); no bloquea, requiere seguimiento.', owner: 'equipo editorial' },
};

const STATUS_BY_SEVERITY = { error: 'bloqueante', warning: 'abierto', info: 'seguimiento' };

// --- Construcción del backlog (PURA salvo lectura de ficheros) ---------------
export function buildCausalBacklog({ repoRoot = REPO_ROOT, stage = 'rc' } = {}) {
  const cross = crosscheckAll({ repoRoot, stage });
  const items = [];

  // 1) Divergencias del crosscheck (datos reales, no inventados).
  for (const c of cross.cases) {
    for (const d of c.divergences) {
      const policy = CODE_POLICY[d.code] || { action: 'Revisar la advertencia causal.', owner: 'equipo editorial' };
      items.push({
        case: c.conflict_id,
        source: 'crosscheck',
        warning_type: d.code,
        severity: d.severity,
        detail: d.detail,
        recommended_action: policy.action,
        suggested_owner: policy.owner,
        status: STATUS_BY_SEVERITY[d.severity] || 'abierto',
      });
    }
  }

  // 2) Campos `pending` del banco de casos → observaciones de REVISIÓN.
  const cbPath = resolve(repoRoot, CASE_BANK_INDEX);
  const caseBank = existsSync(cbPath) ? JSON.parse(readFileSync(cbPath, 'utf8')) : { cases: [] };
  for (const c of caseBank.cases || []) {
    for (const field of c.pending_fields || []) {
      items.push({
        case: c.id,
        source: 'case_bank',
        warning_type: 'pending_field',
        severity: 'info',
        detail: `campo "${field}" pendiente de evidencia en el caso "${c.id}"`,
        recommended_action: `Revisar y, si hay fuente verificada, completar el campo "${field}"; no inferir sin evidencia.`,
        suggested_owner: 'equipo de datos',
        status: 'pendiente',
      });
    }
  }

  // Orden determinista: por caso, luego tipo, luego detalle.
  items.sort((a, b) => (a.case + a.warning_type + a.detail).localeCompare(b.case + b.warning_type + b.detail));

  const bySeverity = { error: 0, warning: 0, info: 0 };
  const byStatus = {};
  for (const it of items) {
    bySeverity[it.severity] = (bySeverity[it.severity] || 0) + 1;
    byStatus[it.status] = (byStatus[it.status] || 0) + 1;
  }

  return {
    contract: BACKLOG_CONTRACT,
    notice:
      'Backlog accionable de advertencias causales (Sprint 27). Derivado determinísticamente de la validación cruzada y del banco de casos: NO inventa datos causales. Material de formación: no activa producción ni contiene secretos.',
    production: { is_production: false, activates_production_gate: false, contains_secrets: false },
    source_stage: stage,
    totals: { items: items.length, by_severity: bySeverity, by_status: byStatus },
    items,
  };
}

export function renderBacklogMarkdown(backlog) {
  const L = [];
  L.push('# Backlog accionable de advertencias causales (Sprint 27)');
  L.push('');
  L.push('> Derivado de la validación cruzada (Sprint 26) y de los campos `pending`');
  L.push('> del banco de casos. **No inventa datos causales.** Material de formación:');
  L.push('> no activa producción ni contiene secretos.');
  L.push('');
  L.push(`- Ítems: **${backlog.totals.items}**`);
  L.push(`- Por severidad: error **${backlog.totals.by_severity.error}** · warning **${backlog.totals.by_severity.warning}** · info **${backlog.totals.by_severity.info}**`);
  L.push('');
  L.push('## Ítems');
  L.push('');
  if (backlog.items.length) {
    L.push('| caso | tipo | severidad | acción recomendada | responsable | estado |');
    L.push('|---|---|---|---|---|---|');
    for (const it of backlog.items) {
      L.push(`| \`${it.case}\` | ${it.warning_type} | ${it.severity} | ${it.recommended_action} | ${it.suggested_owner} | ${it.status} |`);
    }
  } else {
    L.push('_(sin advertencias: matrices coherentes con la fuente y sin campos pendientes)_');
  }
  L.push('');
  return `${L.join('\n')}\n`;
}

export function buildBacklogPackage({ repoRoot = REPO_ROOT, stage = 'rc' } = {}) {
  const backlog = buildCausalBacklog({ repoRoot, stage });
  return { backlog, markdown: renderBacklogMarkdown(backlog) };
}

// --- CLI --------------------------------------------------------------------
function writeAtomic(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, path);
}

function parseArgs(argv) {
  const flags = new Set();
  const opts = {};
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v === undefined) flags.add(k); else opts[k] = v;
    }
  }
  return { flags, opts };
}

function main() {
  const { flags, opts } = parseArgs(process.argv.slice(2));
  const pkg = buildBacklogPackage({ stage: opts.stage || 'rc' });
  const files = {
    [`${OUT_DIR}/backlog.json`]: `${JSON.stringify(pkg.backlog, null, 2)}\n`,
    [`${OUT_DIR}/backlog.md`]: pkg.markdown,
  };

  if (flags.has('json')) {
    process.stdout.write(`${JSON.stringify(pkg.backlog, null, 2)}\n`);
    return 0;
  }
  if (flags.has('check')) {
    const diffs = [];
    for (const [rel, content] of Object.entries(files)) {
      const p = abs(rel);
      if (!existsSync(p) || readFileSync(p, 'utf8') !== content) diffs.push(rel);
    }
    if (diffs.length) {
      process.stderr.write(`[backlog] desactualizado: ${diffs.join(', ')}\n[backlog] ejecuta: npm run education:backlog:write\n`);
      return 1;
    }
    process.stdout.write('[backlog] OK: backlog causal al día.\n');
    return 0;
  }
  if (flags.has('write')) {
    for (const [rel, content] of Object.entries(files)) writeAtomic(abs(rel), content);
    process.stderr.write(`[backlog] escrito backlog causal en ${OUT_DIR} (${Object.keys(files).length} ficheros).\n`);
    return 0;
  }
  const t = pkg.backlog.totals;
  process.stdout.write(`Backlog causal: ${t.items} ítems (error ${t.by_severity.error} · warning ${t.by_severity.warning} · info ${t.by_severity.info}).\n`);
  process.stdout.write(`Usa --json para el backlog, --write para escribir en ${OUT_DIR}, --check para verificar.\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
