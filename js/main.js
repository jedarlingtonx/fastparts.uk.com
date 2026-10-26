// Fast Parts – enquiry forms.
// Each form carries data-endpoint="". Once a form service is chosen, paste its
// endpoint URL into that attribute in the HTML (see README). Until then the form
// tells people to ring instead of pretending to send.
(function () {
  var forms = document.querySelectorAll('form[data-form]');
  Array.prototype.forEach.call(forms, function (form) {
    var msg = form.querySelector('.msg');
    function show(cls, text) { msg.className = 'msg ' + cls; msg.textContent = text; msg.focus(); }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (form.querySelector('.hp input').value) { return; } // honeypot
      var endpoint = form.getAttribute('data-endpoint');
      if (!endpoint) {
        show('err', 'Online enquiries are not switched on yet. Please ring Northwich on 01606 330 555 or Winsford on 01606 552 385.');
        return;
      }
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      var data = {};
      new FormData(form).forEach(function (v, k) { if (k !== 'website') { data[k] = v; } });
      data.form = form.getAttribute('data-form');
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { if (!r.ok) { throw new Error('bad'); } form.reset(); show('ok', 'Thanks, we have your details and will be in touch.'); })
        .catch(function () { show('err', 'Sorry, that did not send. Please ring Northwich on 01606 330 555 or Winsford on 01606 552 385.'); })
        .then(function () { btn.disabled = false; });
    });
  });
})();

// Reviews carousel (no autoplay, so people can read at their own pace).
(function () {
  var track = document.querySelector('.track'); if (!track) { return; }
  var prev = document.querySelector('.car-prev'), next = document.querySelector('.car-next');
  function step() { var s = track.querySelector('.slide'); return s ? s.getBoundingClientRect().width + 20 : 300; }
  function upd() { prev.disabled = track.scrollLeft < 4; next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4; }
  prev.addEventListener('click', function () { track.scrollBy({ left: -step() }); });
  next.addEventListener('click', function () { track.scrollBy({ left: step() }); });
  track.addEventListener('scroll', upd, { passive: true }); window.addEventListener('resize', upd); upd();
})();

// "Use my location": picks the nearer shop in the browser. Nothing is sent or stored.
(function () {
  var btn = document.querySelector('[data-locate]'); if (!btn) { return; }
  var shops = { Northwich: [53.2610, -2.5120], Winsford: [53.1900, -2.5260] }; // approximate town-centre positions
  var sel = document.getElementById('shop'), out = document.querySelector('.locmsg');
  function km(a, b) { var r = Math.PI / 180, dx = (b[1] - a[1]) * r * Math.cos((a[0] + b[0]) / 2 * r), dy = (b[0] - a[0]) * r; return Math.sqrt(dx * dx + dy * dy) * 6371; }
  btn.addEventListener('click', function () {
    if (!navigator.geolocation) { out.textContent = 'Your browser can\'t share its location, so please choose a shop.'; return; }
    out.textContent = 'Finding your nearest shop…';
    navigator.geolocation.getCurrentPosition(function (pos) {
      var here = [pos.coords.latitude, pos.coords.longitude], best = null, bd = 1e9;
      Object.keys(shops).forEach(function (k) { var d = km(here, shops[k]); if (d < bd) { bd = d; best = k; } });
      sel.value = best; out.textContent = 'Nearest shop set to ' + best + '. You can change it if you prefer.';
    }, function () { out.textContent = 'We couldn\'t get your location, so please choose a shop.'; }, { timeout: 10000, maximumAge: 600000 });
  });
})();
