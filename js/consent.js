// Fast Parts – cookie control (dormant until analytics is switched on).
// To switch on: put a Google Analytics ID in ANALYTICS_ID, update the privacy notice and
// cookies.html (they currently say no cookies are used), then tell Paul and re-check ICO guidance.
// Rules: equal Accept and Reject buttons, nothing loads before consent, choice kept 12 months
// in the essential cookie fp_consent, and "Cookie settings" in the footer reopens the choice.
(function () {
  var ANALYTICS_ID = '';            // e.g. 'G-XXXXXXXXXX'. Empty = no analytics, no banner, no cookies.
  var COOKIE = 'fp_consent';

  function read() {
    var m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'));
    return m ? m[1] : null;
  }
  function write(v) {
    document.cookie = COOKIE + '=' + v + '; max-age=31536000; path=/; SameSite=Lax; Secure';
  }
  function clearAnalytics() {
    document.cookie.split('; ').forEach(function (c) {
      var n = c.split('=')[0];
      if (n.indexOf('_ga') === 0) { document.cookie = n + '=; max-age=0; path=/; domain=.' + location.hostname.replace(/^www\./, ''); document.cookie = n + '=; max-age=0; path=/'; }
    });
  }
  function loadAnalytics() {
    if (!ANALYTICS_ID || window.__fpGa) { return; }
    window.__fpGa = true;
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ANALYTICS_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', ANALYTICS_ID, { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false });
  }

  var box;
  function close() { if (box) { box.remove(); box = null; } }
  function open(first) {
    if (box) { return; }
    box = document.createElement('div');
    box.className = 'cc'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Cookie settings');
    var inner = '<div class="cc-in"><h2>Cookies on this site</h2>';
    if (!ANALYTICS_ID) {
      inner += '<p>This site does not currently use cookies, analytics or tracking, so there is nothing to switch on or off. If that changes we will ask you first. See our <a href="cookies.html">cookie policy</a>.</p>' +
               '<div class="cc-b"><button type="button" class="btn" data-cc="close">Close</button></div>';
    } else {
      inner += '<p>We would like to use analytics cookies to see which pages are useful. They are off unless you accept. Strictly necessary cookie: <code>fp_consent</code> remembers your choice. See our <a href="cookies.html">cookie policy</a>.</p>' +
               '<div class="cc-b"><button type="button" class="btn" data-cc="accept">Accept analytics</button><button type="button" class="btn" data-cc="reject">Reject analytics</button></div>';
    }
    box.innerHTML = inner + '</div>';
    document.body.appendChild(box);
    box.addEventListener('click', function (e) {
      var a = e.target.getAttribute && e.target.getAttribute('data-cc');
      if (!a) { return; }
      if (a === 'accept') { write('accepted'); loadAnalytics(); }
      if (a === 'reject') { write('rejected'); clearAnalytics(); }
      close();
    });
    var f = box.querySelector('button'); if (f && !first) { f.focus(); }
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-cookie-settings]');
    if (t) { e.preventDefault(); open(false); }
  });
  if (ANALYTICS_ID) {
    var c = read();
    if (c === 'accepted') { loadAnalytics(); } else if (c !== 'rejected') { open(true); }
  }
})();
