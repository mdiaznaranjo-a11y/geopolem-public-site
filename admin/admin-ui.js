// GEOPÓLEM Admin/CMS (Sprint 8) — glue del navegador (sólo UI).
// ---------------------------------------------------------------------------
// Conecta el formulario de admin/index.html con el cliente y los validadores.
// NO usa localStorage/sessionStorage/indexedDB/cookies: el token vive en el
// input en memoria (o en window.GEOP_ADMIN_TOKEN inyectado por el entorno).
// La superficie está desactivada por defecto (gate) hasta que se habilite por
// config o se aporte un token. No toca la experiencia pública ni la PWA.
// ---------------------------------------------------------------------------

import { createAdminClient, AdminApiError } from './admin-client.mjs';
import { validateEditorialConflict } from './editorial-validation.mjs';
import { toEnrichedViewModel } from './enriched-detail-view.mjs';

const $ = (id) => document.getElementById(id);

function parseJsonField(id) {
  const raw = $(id).value.trim();
  if (!raw) return undefined;
  return JSON.parse(raw); // lanza si es inválido; se captura arriba con el id del campo
}

// Construye el payload editorial desde el formulario. Puede lanzar SyntaxError
// con `.field` para señalar el textarea JSON que falló.
function collectPayload() {
  const num = (id) => { const v = $(id).value.trim(); return v === '' ? undefined : Number(v); };
  const str = (id) => { const v = $(id).value.trim(); return v === '' ? undefined : v; };

  const payload = {
    slug: str('slug'),
    name: str('name'),
    summary: str('summary'),
    country: str('country'),
    status: str('status'),
    conflict_type: str('conflict_type'),
    primary_region: str('primary_region'),
    intensity_level: num('intensity_level'),
    escalation_risk: num('escalation_risk'),
    humanitarian_impact: num('humanitarian_impact'),
    energy_dimension: $('energy_dimension').checked || undefined,
    territorial_dimension: $('territorial_dimension').checked || undefined,
    external_involvement: $('external_involvement').checked || undefined,
  };

  const lat = num('latitude');
  const lng = num('longitude');
  if (lat !== undefined || lng !== undefined) payload.location = { latitude: lat, longitude: lng };

  for (const id of ['actors', 'resources', 'chokepoints', 'causal_links', 'sources']) {
    try {
      const parsed = parseJsonField(id);
      if (parsed !== undefined) payload[id] = parsed;
    } catch (e) {
      const err = new SyntaxError(`JSON inválido en "${id}": ${e.message}`);
      err.field = id;
      throw err;
    }
  }
  return payload;
}

function showErrors(list) {
  const box = $('errors');
  if (!list || list.length === 0) { box.hidden = true; box.innerHTML = ''; return; }
  const items = list.map((e) => `<li><code>${e.field || 'body'}</code> — ${e.message}</li>`).join('');
  box.innerHTML = `<strong>Errores de validación:</strong><ul>${items}</ul>`;
  box.hidden = false;
}

function setStatus(text, cls) {
  const el = $('status');
  el.textContent = text;
  el.className = cls || '';
}

function currentClient() {
  return createAdminClient({
    baseUrl: $('apiBase').value.trim() || window.GEOP_API_BASE || '',
    token: $('token').value.trim() || window.GEOP_ADMIN_TOKEN || '',
  });
}

function renderResult(body) {
  const detail = body?.data || {};
  const vm = toEnrichedViewModel(detail);
  $('output').textContent = JSON.stringify({ response: body, enriched_view: vm }, null, 2);
}

function handleApiError(err) {
  if (err instanceof AdminApiError) {
    if (err.kind === 'validation' && err.details?.errors) { showErrors(err.details.errors); }
    const extra = err.retryAfterSec ? ` (reintenta en ${err.retryAfterSec}s)` : '';
    setStatus(`✗ ${err.kind}: ${err.message}${extra}`, 'muted');
  } else {
    setStatus(`✗ ${err.message}`, 'muted');
  }
}

function onValidate() {
  showErrors(null);
  let payload;
  try { payload = collectPayload(); }
  catch (e) { showErrors([{ field: e.field, message: e.message }]); return; }
  const { valid, errors, value } = validateEditorialConflict(payload, { partial: false });
  if (!valid) { showErrors(errors); setStatus('✗ contrato inválido', 'muted'); return; }
  $('output').textContent = JSON.stringify({ valid: true, normalized: value }, null, 2);
  setStatus('✓ contrato válido', 'ok');
}

async function onSubmit(ev) {
  ev.preventDefault();
  showErrors(null);
  setStatus('enviando…');
  let payload;
  try { payload = collectPayload(); }
  catch (e) { showErrors([{ field: e.field, message: e.message }]); setStatus('✗ JSON inválido', 'muted'); return; }

  const client = currentClient();
  try {
    const { body } = await client.createConflict(payload);
    renderResult(body);
    const mode = body?.meta?.demo ? 'DEMO (sin red)' : (body?.meta?.mode || 'ok');
    setStatus(`✓ ${mode} · persisted=${body?.meta?.persisted}`, 'ok');
  } catch (err) {
    handleApiError(err);
  }
}

function initGate() {
  const enabled = window.GEOP_ADMIN_ENABLED === true || Boolean(window.GEOP_ADMIN_TOKEN);
  const gate = $('gate');
  if (!enabled) {
    gate.hidden = false;
    gate.textContent = 'Admin/CMS desactivado en este entorno. Habilítalo con '
      + 'window.GEOP_ADMIN_ENABLED = true o proporcionando un JWT de staging. '
      + 'Puedes seguir usando el modo DEMO local para validar el contrato.';
  }
  // El modo DEMO siempre está disponible: el formulario NO se bloquea, para que
  // el flujo editorial se pueda validar sin credenciales. La persistencia real
  // sólo ocurre con API base + token + servidor con GEOP_ADMIN_WRITES=true.
}

function init() {
  initGate();
  if (window.GEOP_API_BASE) $('apiBase').value = window.GEOP_API_BASE;
  $('validateBtn').addEventListener('click', onValidate);
  $('form').addEventListener('submit', onSubmit);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
