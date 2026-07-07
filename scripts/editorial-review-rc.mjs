// GEOPÓLEM (Sprint 19) — genera/verifica la cola editorial CLASIFICADA para el RC.
// ---------------------------------------------------------------------------
// Lee la cola de revisión editorial residual versionada (data/editorial-review-queue.json)
// y produce data/editorial-review-queue.rc.json, donde cada pendiente lleva una
// CLASIFICACIÓN accionable (resolved | needs_human_review | deferred |
// blocked_by_source | blocked_by_policy) con su razón y el gate que bloquea.
//
// La evidencia de verificación de fuentes bloqueadas se registra de forma
// DETERMINISTA (intentos reales del Sprint 19: los dominios institucionales
// siguieron devolviendo 402/403 al fetch directo vía proxy). El `generated_at`
// se HEREDA de la cola de origen para que regenerar no produzca diffs espurios:
// `--check` puede verificar que el artefacto está al día.
//
// MODOS:
//   (sin modo)   imprime el reporte en texto. NO escribe.
//   --json       imprime el reporte JSON. NO escribe.
//   --write      escribe data/editorial-review-queue.rc.json (atómico).
//   --check      exit!=0 si el artefacto versionado NO coincide con lo generado.
// ---------------------------------------------------------------------------

import {
  readFileSync, writeFileSync, renameSync, mkdirSync, existsSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyReviewQueue } from '../editorial-rc.mjs';
import { PRODUCTION_PUBLISH_ENABLED } from '../release-confirmation.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const QUEUE_PATH = resolve(REPO_ROOT, 'data/editorial-review-queue.json');
const OUT_PATH = resolve(REPO_ROOT, 'data/editorial-review-queue.rc.json');

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// Evidencia DETERMINISTA de los intentos de verificación del Sprint 19. Cada
// entrada documenta un intento REAL de acceso directo a la fuente bloqueada; el
// resultado observado (402/403) confirma la clasificación blocked_by_source.
// NO inventa contenido: sólo registra el código de estado devuelto por el proxy.
const VERIFICATION_EVIDENCE = [
  {
    key: 'ukr-rus::source::iaea-ukraine-update-356',
    attempted_via: 'web-fetch',
    result: 'HTTP 402',
    observed: 'iaea.org devolvió 402 Payment Required al fetch directo vía proxy (idéntico a Sprint 15/18).',
  },
  {
    key: 'isr-gaza-irn::source::ocha-opt',
    attempted_via: 'web-fetch',
    result: 'HTTP 403',
    observed: 'unocha.org devolvió 403 Forbidden al fetch directo vía proxy (idéntico a Sprint 15/18).',
  },
  {
    key: 'sahel::source::unhcr-sahel-emergency',
    attempted_via: 'web-fetch',
    result: 'HTTP 403',
    observed: 'unhcr.org devolvió 403 Forbidden al fetch directo vía proxy (idéntico a Sprint 15/18).',
  },
];

function compute() {
  const queue = readJson(QUEUE_PATH);
  // generated_at determinista: hereda el de la cola de origen (evita diffs por timestamp).
  const generatedAt = typeof queue.generated_at === 'string' ? queue.generated_at : null;
  return classifyReviewQueue({
    queue,
    evidence: VERIFICATION_EVIDENCE,
    generatedAt,
    policyGate: {
      publish_enabled: PRODUCTION_PUBLISH_ENABLED,
      note: 'Publicación a producción DESHABILITADA por diseño (PRODUCTION_PUBLISH_ENABLED=false). El doble gate (sign-off + segunda confirmación) puede evaluarse pero nunca habilita publicación real en este ciclo.',
    },
  });
}

function serialize(obj) { return `${JSON.stringify(obj, null, 2)}\n`; }

function writeJsonAtomic(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, serialize(obj), 'utf8');
  renameSync(tmp, path);
}

function formatText(rc) {
  const L = [];
  L.push('GEOPÓLEM — Cola editorial CLASIFICADA para el Release Candidate (Sprint 19)');
  L.push('='.repeat(72));
  L.push(`Total pendientes:        ${rc.summary.total}`);
  for (const [k, v] of Object.entries(rc.summary.by_classification)) {
    L.push(`  · ${k.padEnd(20)} ${v}`);
  }
  L.push(`Resueltos:               ${rc.summary.resolved}`);
  L.push(`Bloquean producción:     ${rc.summary.blocking_production}`);
  L.push(`Conflictos afectados:    ${rc.summary.conflicts_affected.join(', ')}`);
  L.push(`Gate de política:        publish_enabled=${rc.policy_gate.publish_enabled} (${rc.policy_gate.classification || 'ok'})`);
  L.push('');
  for (const it of rc.items) {
    const label = it.type === 'source-review' ? `${it.conflict}/${it.source_slug}` : `${it.conflict}: "${it.title}"`;
    L.push(`[${it.classification}] ${label}`);
    L.push(`    gate: ${it.blocking_gate || '—'}`);
    L.push(`    ${it.rationale}`);
    if (it.evidence && it.evidence.result) L.push(`    evidencia: ${it.evidence.attempted_via} → ${it.evidence.result}`);
  }
  return L.join('\n');
}

function main() {
  const args = new Set(process.argv.slice(2));
  if (!existsSync(QUEUE_PATH)) {
    process.stderr.write('[editorial-review-rc] FALTA data/editorial-review-queue.json; ejecuta review:queue:write.\n');
    return 1;
  }
  const rc = compute();

  if (args.has('--check')) {
    if (!existsSync(OUT_PATH)) {
      process.stderr.write('[editorial-review-rc] FALTA data/editorial-review-queue.rc.json; ejecuta --write.\n');
      return 1;
    }
    if (readFileSync(OUT_PATH, 'utf8') !== serialize(rc)) {
      process.stderr.write('[editorial-review-rc] DESACTUALIZADO: el artefacto no coincide con la cola de origen; ejecuta --write.\n');
      return 1;
    }
    process.stdout.write(`[editorial-review-rc] OK: al día (${rc.summary.total} clasificado/s, ${rc.summary.resolved} resuelto/s).\n`);
    return 0;
  }

  if (args.has('--write')) {
    writeJsonAtomic(OUT_PATH, rc);
    process.stderr.write(`[editorial-review-rc] escrito → ${OUT_PATH} (${rc.summary.total} clasificado/s).\n`);
    return 0;
  }

  if (args.has('--json')) process.stdout.write(serialize(rc));
  else process.stdout.write(`${formatText(rc)}\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}

export { compute };
