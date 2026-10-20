/* GEOPÓLEM · Medición con consentimiento (GA4 G-1LQQT2QG90). Solo mide si el visitante acepta. */
(function () {
  var GA_ID = 'G-1LQQT2QG90';
  var KEY = 'gp-consent-v1';
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });

  var loaded = false;
  function loadGA() {
    if (loaded) return; loaded = true;
    gtag('consent', 'update', { analytics_storage: 'granted' });
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA_ID, { anonymize_ip: true });
  }

  function choice() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  function banner() {
    if (document.getElementById('gp-consent')) return;
    var b = document.createElement('div');
    b.id = 'gp-consent'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Aviso de cookies');
    b.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;max-width:640px;margin:0 auto;background:#07121c;color:#e2e8f0;border:1px solid #1f3a44;border-radius:12px;padding:16px 18px;font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5)';
    b.innerHTML = '<p style="margin:0 0 12px">GEOPÓLEM usa Google Analytics solo si lo aceptas, para saber qué contenidos se leen y mejorarlos. No usamos publicidad.</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end">' +
      '<button type="button" data-gp="no" style="background:transparent;color:#cbd5e1;border:1px solid #334155;border-radius:8px;padding:8px 14px;font:inherit;cursor:pointer">Rechazar</button>' +
      '<button type="button" data-gp="yes" style="background:#3DD6D0;color:#04121a;border:0;border-radius:8px;padding:8px 16px;font:600 14px/1.5 inherit;cursor:pointer">Aceptar</button></div>';
    b.addEventListener('click', function (e) {
      var v = e.target && e.target.getAttribute('data-gp'); if (!v) return;
      save(v === 'yes' ? 'granted' : 'denied');
      if (v === 'yes') loadGA();
      b.remove();
    });
    document.body.appendChild(b);
  }

  window.gpConsentReset = function () { try { localStorage.removeItem(KEY); } catch (e) {} banner(); };

  // Eventos clave: suscripción al brief y entrada a la sala situacional
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('a,button') : null;
    if (!el || choice() !== 'granted') return;
    var href = el.getAttribute('href') || '';
    var txt = (el.textContent || '').toLowerCase();
    if (href.indexOf('substack.com') > -1) {
      window.gtag('event', 'generate_lead', { method: 'substack', link_url: href, page_path: location.pathname });
    } else if (txt.indexOf('entrar al tablero') > -1) {
      window.gtag('event', 'enter_dashboard', { page_path: location.pathname });
    } else if (/app(\.html)?(\?|#|$)/.test(href)) {
      window.gtag('event', 'open_app', { link_url: href, page_path: location.pathname });
    }
  }, true);

  var c = choice();
  if (c === 'granted') loadGA();
  else if (c !== 'denied') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', banner); else banner();
  }
})();
