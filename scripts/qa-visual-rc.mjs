// GEOPÓLEM (Sprint 19) — QA VISUAL opt-in del RC con navegador headless.
// ---------------------------------------------------------------------------
// Complementa la QA de contratos (scripts/qa-rc-routes.mjs) abriendo la app en un
// Chromium headless y validando que las rutas clave RENDERIZAN sin errores de
// consola, capturando screenshots. Es OPT-IN y NO añade dependencias al proyecto:
//   • Playwright se importa de forma DINÁMICA; si no está instalado (o faltan los
//     navegadores), el script IMPRIME el motivo y SALE 0 (skip limpio, no falla CI).
//   • Sirve el repo con un servidor estático efímero de node:http (sin deps).
//   • Escribe screenshots en .rc-qa/ (gitignored, regenerable). No toca versionados.
//
// Rutas validadas: home (#), mapa (#view=map), ficha (#foco={id}),
// deep-link con filtros (#view=map&foco={id}&region=MENA&severity=4).
//
// Flags: --json (reporte JSON), --out-dir=DIR (por defecto .rc-qa).
// Uso local:  node scripts/qa-visual-rc.mjs
// (En CI la QA obligatoria es la de contratos; ésta es evidencia complementaria.)
// ---------------------------------------------------------------------------

import { createServer } from 'node:http';
import {
  readFileSync, existsSync, mkdirSync, statSync,
} from 'node:fs';
import { dirname, resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.ico': 'image/x-icon',
};

function serveRepo() {
  const server = createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
      let rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
      let full = resolve(REPO_ROOT, rel);
      if (!full.startsWith(REPO_ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
      if (existsSync(full) && statSync(full).isDirectory()) full = join(full, 'index.html');
      if (!existsSync(full)) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[extname(full)] || 'application/octet-stream' });
      res.end(readFileSync(full));
    } catch (e) {
      res.writeHead(500); res.end(String(e?.message || e));
    }
  });
  return new Promise((resolvePromise) => {
    server.listen(0, '127.0.0.1', () => resolvePromise({ server, port: server.address().port }));
  });
}

async function loadPlaywright() {
  // Import dinámico tolerante: prueba el paquete local y el global.
  const candidates = ['playwright', join(process.env.HOME || '', 'node_modules/playwright/index.js')];
  for (const c of candidates) {
    try { const mod = await import(c); return mod.chromium ? mod : (mod.default || null); } catch { /* siguiente */ }
  }
  return null;
}

function skip(reason, asJson) {
  const rep = { contract: 'sprint-19-qa-visual-rc-v1', skipped: true, reason, browser: false, ok: true };
  process.stdout.write(asJson ? `${JSON.stringify(rep, null, 2)}\n` : `[qa-visual-rc] SKIP: ${reason}\n`);
  return 0;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const asJson = args.has('--json');
  const outArg = process.argv.slice(2).find((a) => a.startsWith('--out-dir='));
  const outDir = resolve(REPO_ROOT, outArg ? outArg.split('=')[1] : '.rc-qa');

  const pw = await loadPlaywright();
  if (!pw || !pw.chromium) return skip('Playwright no disponible (import falló); QA visual omitida sin fallar.', asJson);

  const { server, port } = await serveRepo();
  const base = `http://127.0.0.1:${port}`;
  mkdirSync(outDir, { recursive: true });

  let browser;
  const results = [];
  try {
    try {
      browser = await pw.chromium.launch({ headless: true });
    } catch (e) {
      server.close();
      return skip(`no se pudo lanzar Chromium (¿navegadores no instalados?): ${e.message}`, asJson);
    }
    const ids = (() => {
      try { return Object.keys(JSON.parse(readFileSync(resolve(REPO_ROOT, 'api/v1/staging/conflicts.enriched.json'), 'utf8')).data || {}); } catch { return ['ukr-rus']; }
    })();
    const id = ids[0] || 'ukr-rus';
    const routes = [
      { name: 'home', hash: '' },
      { name: 'map', hash: '#view=map' },
      { name: 'ficha', hash: `#foco=${id}` },
      { name: 'deeplink-filtros', hash: `#view=map&foco=${id}&region=MENA&severity=4` },
    ];

    for (const r of routes) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const errors = [];
      page.on('pageerror', (err) => errors.push(String(err?.message || err)));
      page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`); });
      try {
        await page.goto(`${base}/${r.hash}`, { waitUntil: 'networkidle', timeout: 15000 });
        // El shell monta en #root; esperamos contenido renderizado.
        await page.waitForFunction(() => {
          const root = document.getElementById('root');
          return root && root.children.length > 0;
        }, { timeout: 10000 });
        const rootFilled = await page.evaluate(() => (document.getElementById('root')?.children.length || 0) > 0);
        const shot = join(outDir, `${r.name}.png`);
        await page.screenshot({ path: shot, fullPage: false });
        const fatal = errors.filter((e) => !/service-?worker|Failed to register|404/i.test(e));
        results.push({ route: r.name, hash: r.hash, ok: rootFilled && fatal.length === 0, root_filled: rootFilled, errors: fatal, screenshot: shot });
      } catch (e) {
        results.push({ route: r.name, hash: r.hash, ok: false, errors: [...errors, e.message] });
      } finally {
        await page.close();
      }
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }

  const passed = results.filter((r) => r.ok).length;
  const rep = {
    contract: 'sprint-19-qa-visual-rc-v1', skipped: false, browser: true,
    summary: { total: results.length, passed, failed: results.length - passed },
    ok: results.every((r) => r.ok), out_dir: outDir, routes: results,
  };
  if (asJson) process.stdout.write(`${JSON.stringify(rep, null, 2)}\n`);
  else {
    process.stdout.write(`[qa-visual-rc] ${rep.ok ? 'OK' : 'FALLÓ'} (${passed}/${results.length}) — screenshots en ${outDir}\n`);
    for (const r of results) process.stdout.write(`  ${r.ok ? '✓' : '✗'} ${r.route} ${r.ok ? '' : '→ ' + (r.errors || []).join(' | ')}\n`);
  }
  return rep.ok ? 0 : 1;
}

main().then((code) => process.exit(code)).catch((err) => {
  process.stderr.write(`[qa-visual-rc] error no controlado: ${err?.message || err}\n`);
  // Un fallo del arnés visual no debe romper el flujo: es evidencia opt-in.
  process.exit(0);
});
