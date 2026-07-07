// GEOPÓLEM — Cola editorial causal NORMALIZADA (Sprint 29)
// ---------------------------------------------------------------------------
// Convierte el backlog causal disperso (Sprint 27: crosscheck + campos pending
// del banco de casos) y el cross-check ampliado (Sprint 28: barrido de todos los
// conflictos del contrato) en una ÚNICA cola editorial ESTABLE y determinista,
// lista para revisión humana. Cada ítem se normaliza con un esquema común:
//
//   • id                — identificador estable (Q-###) tras un orden determinista.
//   • key               — clave compuesta trazable (origen:conflicto:tipo:ref).
//   • conflict_id       — relación con el conflicto/caso de origen.
//   • origin            — 'crosscheck' | 'case_bank' | 'causal_scale'.
//   • warning_type      — código/brecha original (no se reinterpreta).
//   • editorial_status  — estado editorial derivado (ver STATUS_POLICY).
//   • priority          — P1/P2/P3 derivada de la severidad.
//   • action_type       — tipo de acción editorial derivada.
//   • blocking          — true si la severidad es 'error' (bloquea el cierre).
//   • requires_source   — true si la acción exige una fuente verificada nueva.
//   • suggested_owner   — responsable sugerido heredado del backlog de origen.
//   • recommended_action— acción recomendada heredada (texto para humanos).
//
// Principios (idénticos al resto de artefactos educativos):
//   • NO inventa datos causales: sólo REETIQUETA lo que ya reportan los backlogs
//     deterministas del Sprint 27/28. Si falta una matriz o una fuente, el estado
//     lo refleja; nunca genera relaciones ni fuentes.
//   • Determinista (sin timestamps) → admite --check en CI.
//   • No activa producción ni contiene secretos.
//
// Artefactos (en docs/education/causal-queue/):
//   • queue.json — cola máquina-legible.
//   • queue.md   — cola navegable para revisión editorial humana.
//
// Uso:
//   node scripts/build-causal-queue.mjs            (resumen)
//   node scripts/build-causal-queue.mjs --json      (cola JSON)
//   node scripts/build-causal-queue.mjs --stage=rc  (stage a barrer)
//   node scripts/build-causal-queue.mjs --write      (escribe artefactos)
//   node scripts/build-causal-queue.mjs --check      (verifica al día)
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCausalBacklog } from './build-causal-backlog.mjs';
import { crosscheckScale, buildScaleBacklog } from './causal-crosscheck-scale.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

export const QUEUE_CONTRACT = 'sprint-29-causal-editorial-queue-v1';
const OUT_DIR = 'docs/education/causal-queue';

const abs = (rel) => resolve(REPO_ROOT, rel);

const PRIORITY_BY_SEVERITY = { error: 'P1', warning: 'P2', info: 'P3' };
const PRIORITY_RANK = { P1: 0, P2: 1, P3: 2 };

// Política determinista por tipo de brecha/advertencia → acción editorial y si
// exige una fuente verificada nueva. Deriva sólo de códigos ya emitidos por los
// backlogs de origen; no introduce categorías nuevas de datos.
const ACTION_POLICY = {
  // Sprint 28 — cross-check ampliado (gap_type).
  missing_matrix: { action_type: 'build_matrix', requires_source: false, status: 'needs_matrix' },
  matrix_source_divergence: { action_type: 'reconcile_matrix', requires_source: false, status: 'needs_review' },
  // Sprint 27 — banco de casos y crosscheck (warning_type / code).
  pending_field: { action_type: 'complete_field', requires_source: true, status: 'needs_source' },
  contract_mismatch: { action_type: 'reconcile_matrix', requires_source: false, status: 'needs_review' },
  conflict_missing_in_source: { action_type: 'reconcile_matrix', requires_source: false, status: 'needs_review' },
  link_count_mismatch: { action_type: 'reconcile_matrix', requires_source: false, status: 'needs_review' },
  link_not_in_source: { action_type: 'add_source', requires_source: true, status: 'needs_source' },
  link_missing_in_matrix: { action_type: 'reconcile_matrix', requires_source: false, status: 'needs_review' },
  link_type_mismatch: { action_type: 'reconcile_matrix', requires_source: false, status: 'needs_review' },
  evidence_mismatch: { action_type: 'reconcile_matrix', requires_source: false, status: 'needs_review' },
  sources_mismatch: { action_type: 'reconcile_matrix', requires_source: false, status: 'needs_review' },
  node_without_source: { action_type: 'add_source', requires_source: true, status: 'needs_source' },
  source_is_demo: { action_type: 'add_source', requires_source: true, status: 'needs_source' },
  stage_drift: { action_type: 'review', requires_source: false, status: 'needs_review' },
};

const DEFAULT_POLICY = { action_type: 'review', requires_source: false, status: 'needs_review' };

// Extrae una referencia estable adicional del detalle (p. ej. el campo pendiente)
// para desambiguar ítems del mismo conflicto y tipo, sin inventar contenido.
function refFromDetail(detail) {
  if (!detail) return '';
  const m = String(detail).match(/"([^"]+)"/);
  return m ? m[1] : '';
}

function normalizeItem({ conflict_id, origin, warning_type, severity, recommended_action, suggested_owner, detail }) {
  const policy = ACTION_POLICY[warning_type] || DEFAULT_POLICY;
  const ref = refFromDetail(detail);
  const editorialStatus = severity === 'error' ? 'blocked' : policy.status;
  return {
    key: [origin, conflict_id, warning_type, ref].filter(Boolean).join(':'),
    conflict_id,
    origin,
    warning_type,
    ref,
    editorial_status: editorialStatus,
    priority: PRIORITY_BY_SEVERITY[severity] || 'P3',
    severity,
    action_type: policy.action_type,
    blocking: severity === 'error',
    requires_source: policy.requires_source,
    suggested_owner: suggested_owner || 'equipo editorial',
    recommended_action: recommended_action || 'Revisar la advertencia causal.',
  };
}

// --- Construcción de la cola (PURA salvo lectura de ficheros) -----------------
export function buildCausalQueue({ repoRoot = REPO_ROOT, stage = 'rc' } = {}) {
  const raw = [];

  // 1) Backlog Sprint 27: crosscheck (divergencias reales) + case_bank (pending).
  const backlog = buildCausalBacklog({ repoRoot, stage });
  for (const it of backlog.items) {
    raw.push(normalizeItem({
      conflict_id: it.case,
      origin: it.source, // 'crosscheck' | 'case_bank'
      warning_type: it.warning_type,
      severity: it.severity,
      recommended_action: it.recommended_action,
      suggested_owner: it.suggested_owner,
      detail: it.detail,
    }));
  }

  // 2) Cross-check ampliado Sprint 28: brechas de escala (pending_matrix/divergent).
  const scale = buildScaleBacklog(crosscheckScale({ repoRoot, stage }));
  for (const it of scale.items) {
    raw.push(normalizeItem({
      conflict_id: it.conflict_id,
      origin: 'causal_scale',
      warning_type: it.gap_type,
      severity: it.severity,
      recommended_action: it.recommended_action,
      suggested_owner: 'equipo editorial',
      detail: '',
    }));
  }

  // Deduplicación determinista por `key` (la misma brecha puede surgir en ambos
  // barridos); se conserva la de mayor prioridad (menor rank).
  const byKey = new Map();
  for (const it of raw) {
    const prev = byKey.get(it.key);
    if (!prev || PRIORITY_RANK[it.priority] < PRIORITY_RANK[prev.priority]) byKey.set(it.key, it);
  }

  // Orden determinista: prioridad, luego conflicto, tipo de acción y clave.
  const ordered = [...byKey.values()].sort((a, b) =>
    (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) ||
    a.conflict_id.localeCompare(b.conflict_id) ||
    a.action_type.localeCompare(b.action_type) ||
    a.key.localeCompare(b.key),
  );

  // Id estable tras el orden determinista.
  const items = ordered.map((it, i) => ({ id: `Q-${String(i + 1).padStart(3, '0')}`, ...it }));

  const byPriority = { P1: 0, P2: 0, P3: 0 };
  const byStatus = {};
  const byAction = {};
  let blocking = 0;
  let requiresSource = 0;
  for (const it of items) {
    byPriority[it.priority] = (byPriority[it.priority] || 0) + 1;
    byStatus[it.editorial_status] = (byStatus[it.editorial_status] || 0) + 1;
    byAction[it.action_type] = (byAction[it.action_type] || 0) + 1;
    if (it.blocking) blocking += 1;
    if (it.requires_source) requiresSource += 1;
  }

  return {
    contract: QUEUE_CONTRACT,
    notice:
      'Cola editorial causal normalizada (Sprint 29). Reetiqueta de forma determinista los backlogs del Sprint 27/28: NO inventa relaciones ni fuentes. Lista para curaduría humana. No activa producción ni contiene secretos.',
    production: { is_production: false, activates_production_gate: false, contains_secrets: false },
    source_stage: stage,
    totals: {
      items: items.length,
      blocking,
      requires_source: requiresSource,
      by_priority: byPriority,
      by_status: byStatus,
      by_action: byAction,
    },
    items,
  };
}

export function renderQueueMarkdown(queue) {
  const L = [];
  L.push('# Cola editorial causal normalizada (Sprint 29)');
  L.push('');
  L.push('> Normaliza los backlogs causales del Sprint 27/28 en una cola editorial');
  L.push('> **estable y determinista** lista para curaduría humana. **No inventa**');
  L.push('> relaciones ni fuentes. No activa producción ni contiene secretos.');
  L.push('');
  const t = queue.totals;
  L.push(`- Stage: **${queue.source_stage}**`);
  L.push(`- Ítems: **${t.items}** · bloqueantes: **${t.blocking}** · requieren fuente: **${t.requires_source}**`);
  L.push(`- Prioridad: P1 **${t.by_priority.P1}** · P2 **${t.by_priority.P2}** · P3 **${t.by_priority.P3}**`);
  L.push('');
  L.push('## Cola');
  L.push('');
  if (queue.items.length) {
    L.push('| id | prioridad | conflicto/caso | estado | acción | bloqueo | fuente | responsable |');
    L.push('|---|---|---|---|---|---|---|---|');
    for (const it of queue.items) {
      L.push(`| ${it.id} | ${it.priority} | \`${it.conflict_id}\` | ${it.editorial_status} | ${it.action_type} | ${it.blocking ? 'sí' : 'no'} | ${it.requires_source ? 'sí' : 'no'} | ${it.suggested_owner} |`);
    }
  } else {
    L.push('_(cola vacía: sin brechas causales accionables en este stage)_');
  }
  L.push('');
  L.push('## Detalle de acciones recomendadas');
  L.push('');
  if (queue.items.length) {
    for (const it of queue.items) {
      L.push(`- **${it.id}** (\`${it.conflict_id}\`, ${it.warning_type}): ${it.recommended_action}`);
    }
  } else {
    L.push('_(sin acciones)_');
  }
  L.push('');
  return `${L.join('\n')}\n`;
}

export function buildQueuePackage({ repoRoot = REPO_ROOT, stage = 'rc' } = {}) {
  const queue = buildCausalQueue({ repoRoot, stage });
  return { queue, markdown: renderQueueMarkdown(queue) };
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
  const pkg = buildQueuePackage({ stage: opts.stage || 'rc' });
  const files = {
    [`${OUT_DIR}/queue.json`]: `${JSON.stringify(pkg.queue, null, 2)}\n`,
    [`${OUT_DIR}/queue.md`]: pkg.markdown,
  };

  if (flags.has('json')) {
    process.stdout.write(`${JSON.stringify(pkg.queue, null, 2)}\n`);
    return 0;
  }
  if (flags.has('check')) {
    const diffs = [];
    for (const [rel, content] of Object.entries(files)) {
      const p = abs(rel);
      if (!existsSync(p) || readFileSync(p, 'utf8') !== content) diffs.push(rel);
    }
    if (diffs.length) {
      process.stderr.write(`[causal-queue] desactualizado: ${diffs.join(', ')}\n[causal-queue] ejecuta: npm run education:queue:write\n`);
      return 1;
    }
    process.stdout.write('[causal-queue] OK: cola editorial causal al día.\n');
    return 0;
  }
  if (flags.has('write')) {
    for (const [rel, content] of Object.entries(files)) writeAtomic(abs(rel), content);
    process.stderr.write(`[causal-queue] escrita cola editorial en ${OUT_DIR} (${Object.keys(files).length} ficheros).\n`);
    return 0;
  }
  const t = pkg.queue.totals;
  process.stdout.write(`Cola causal: ${t.items} ítems · P1 ${t.by_priority.P1} · P2 ${t.by_priority.P2} · P3 ${t.by_priority.P3} · bloqueantes ${t.blocking}.\n`);
  process.stdout.write(`Usa --json para la cola, --write para escribir en ${OUT_DIR}, --check para verificar.\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
