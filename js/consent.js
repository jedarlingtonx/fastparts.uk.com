// Fast Parts – cookie control.
// Google Analytics loads only after the visitor chooses "Accept analytics".
// Rules: equal Accept and Reject buttons, nothing loads before consent, the choice is kept 12 months
// in one essential cookie (fp_consent), and "Cookie settings" in the footer reopens the choice.
// Every choice is also saved to a short audit record (see worker/consent-log.js).
(function () {
  'use strict';
  var ANALYTICS_ID = 'G-MLMZ8SBB66'; // Empty = no analytics, no banner, no cookies.
  var COOKIE = 'fp_consent';
  var VERSION = 'v2';               // change this to ask everyone again after a policy change
  var MAX_AGE = 60 * 60 * 24 * 365; // 12 months
  var LOG_URL = '/api/consent';     // consent audit trail (worker/consent-log.js)

  // The cookie holds "<version>-<yes|no>.<consent id>", e.g. v2-yes.3f2b...
  // The consent id is a random UUID. It links one visitor's choices together
  // in the audit trail without identifying them.
  function readState() {
    var m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'));
    var p = m && m[1].match(/^(v[0-9]+)-(yes|no)(?:\.([0-9a-f-]{36}))?$/);
    return p ? { version: p[1], yes: p[2] === 'yes', id: p[3] || null } : null;
  }
  function readChoice() {
    var s = readState();
    if (!s || s.version !== VERSION) { return null; }
    return s.yes;
  }
  function newId() {
    var c = window.crypto;
    if (c && c.randomUUID) { return c.randomUUID(); }
    var b = new Uint8Array(16), i;
    if (c && c.getRandomValues) { c.getRandomValues(b); } else { for (i = 0; i < 16; i++) { b[i] = Math.floor(Math.random() * 256); } }
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  function saveChoice(yes, id) {
    document.cookie = COOKIE + '=' + VERSION + (yes ? '-yes' : '-no') + '.' + id +
      '; max-age=' + MAX_AGE + '; path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
  }
  // Sends one record to the audit trail. Never blocks or breaks the banner:
  // if the request fails, the visitor's choice still applies.
  function logChoice(action, yes, id) {
    try {
      fetch(LOG_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: id, action: action, analytics: yes, version: VERSION, page: location.pathname }),
        keepalive: true,
        credentials: 'omit'
      }).catch(function () {});
    } catch (e) { /* ignore */ }
  }

  // Every domain a cookie could have been set on for this page: host-only, plus each parent domain with and without the leading dot.
  function cookieDomains() {
    var parts = location.hostname.split('.'), domains = [''];
    for (var k = 0; k < parts.length - 1; k++) { domains.push('; domain=' + parts.slice(k).join('.'), '; domain=.' + parts.slice(k).join('.')); }
    return domains;
  }
  function clearAnalytics() {
    var domains = cookieDomains();
    document.cookie.split('; ').forEach(function (c) {
      var n = c.split('=')[0];
      if (n === '_ga' || n.indexOf('_ga_') === 0 || n === '_gid' || n.indexOf('_gat') === 0) {
        domains.forEach(function (d) { document.cookie = n + '=; max-age=0; path=/' + d; });
      }
    });
  }
  // Old-site clean-up. The previous Fast Parts website left its own cookies on this domain.
  // This site only needs fp_consent, plus the Google Analytics cookies (kept or cleared by the
  // analytics code above, depending on the choice) and Cloudflare's own security cookies.
  // Every other cookie that JavaScript can see is expired, on this page's path and each parent path.
  // Cookies marked HttpOnly can't be seen or removed from JavaScript.
  var KEEP = /^(fp_consent|_ga|_ga_.*|_gid|_gat.*|__cf.*|cf_clearance)$/;
  function clearLegacy() {
    var domains = cookieDomains(), paths = ['/'], p = '';
    location.pathname.split('/').filter(Boolean).forEach(function (seg) { p += '/' + seg; paths.push(p); });
    document.cookie.split('; ').forEach(function (c) {
      var n = c.split('=')[0];
      if (!n || KEEP.test(n)) { return; }
      domains.forEach(function (d) { paths.forEach(function (path) { document.cookie = n + '=; max-age=0; path=' + path + d; }); });
    });
  }
  function stopAnalytics() {
    // Google's tag may still be running on this page and can write its cookies again, so switch it off and clear repeatedly.
    window['ga-disable-' + ANALYTICS_ID] = true;
    clearAnalytics();
    setTimeout(clearAnalytics, 500);
    setTimeout(clearAnalytics, 2500);
    window.addEventListener('pagehide', clearAnalytics);
  }
  function loadAnalytics() {
    if (!ANALYTICS_ID || window.__fpGa) { return; }
    window.__fpGa = true;
    window['ga-disable-' + ANALYTICS_ID] = false;
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ANALYTICS_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', ANALYTICS_ID, { allow_google_signals: false, allow_ad_personalization_signals: false, cookie_expires: 34128000 });
  }

  // Banner: a main view (Accept, Reject, Choose settings) and a settings view (Analytics on or off).
  var box, lastFocus;
  function pad() { document.body.style.paddingBottom = box ? box.offsetHeight + 'px' : ''; }
  function close() {
    if (box) { box.remove(); box = null; }
    pad();
    if (lastFocus && lastFocus.focus) { lastFocus.focus(); lastFocus = null; }
  }
  function show(view) {
    var prefs = view === 'prefs';
    box.querySelector('[data-view=main]').hidden = prefs;
    box.querySelector('[data-view=prefs]').hidden = !prefs;
    box.setAttribute('aria-label', prefs ? 'Cookie settings' : 'Cookies on this site');
    pad();
  }
  // choose(): save the choice, switch analytics on or off, and record it in the audit trail.
  function choose(yes) {
    var before = readChoice();       // null if no valid choice for this version yet
    var state = readState();
    var id = (state && state.id) || newId();
    saveChoice(yes, id);
    if (yes) { loadAnalytics(); } else { stopAnalytics(); }
    clearLegacy();
    if (before !== yes) {
      logChoice(before === null ? (yes ? 'accept' : 'reject') : (yes ? 'changed' : 'withdrawn'), yes, id);
    }
    close();
  }
  function build() {
    box = document.createElement('div');
    box.className = 'cc'; box.setAttribute('role', 'dialog');
    box.innerHTML =
      '<div class="cc-in">' +
      '<div data-view="main"><h2>Cookies on this site</h2>' +
      '<p>We’d like to use Analytics cookies to see how you use this site. They stay off unless you say Accept. A cookie that remembers your choice is always on. <a href="/cookies">Cookie policy</a></p>' +
      '<div class="cc-b"><button type="button" class="btn" data-cc="accept">Accept analytics</button><button type="button" class="btn" data-cc="reject">Reject analytics</button><button type="button" class="btn ghost" data-cc="manage">Choose settings</button></div></div>' +
      '<div data-view="prefs" hidden><h2>Cookie settings</h2>' +
      '<label class="cc-opt"><input type="checkbox" checked disabled><span><strong>Essential</strong><br>Remembers your cookie choice. Always on.</span></label>' +
      '<label class="cc-opt"><input type="checkbox" data-cc-analytics><span><strong>Analytics</strong><br>Google Analytics cookies that count visits and show which pages are used. Off unless you turn them on.</span></label>' +
      '<div class="cc-b"><button type="button" class="btn" data-cc="save">Save choices</button><button type="button" class="btn ghost" data-cc="cancel">Cancel</button></div></div>' +
      '</div>';
    document.body.appendChild(box);
    box.addEventListener('click', function (e) {
      var a = e.target.getAttribute && e.target.getAttribute('data-cc');
      if (!a) { return; }
      if (a === 'accept') { choose(true); }
      else if (a === 'reject') { choose(false); }
      else if (a === 'manage') { openSettings(null); }
      else if (a === 'save') { choose(box.querySelector('[data-cc-analytics]').checked); }
      else if (a === 'cancel') { if (readChoice() === null) { show('main'); } else { close(); } }
    });
  }
  function openMain() { if (box) { return; } build(); show('main'); }
  function openSettings(from) {
    if (from) { lastFocus = from; }
    if (!box) { build(); }
    box.querySelector('[data-cc-analytics]').checked = readChoice() === true;
    show('prefs');
    box.querySelector('[data-cc-analytics]').focus();
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && box && readChoice() !== null) { close(); }
  });
  window.addEventListener('resize', pad);

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-cookie-settings]');
    if (t) { e.preventDefault(); openSettings(t); }
  });
  clearLegacy(); // runs on every page, so old-site cookies go even before a choice is made
  if (ANALYTICS_ID) {
    var c = readChoice();
    if (c === true) { loadAnalytics(); } else if (c === false) { clearAnalytics(); } else { clearAnalytics(); openMain(); }
  }
})();
