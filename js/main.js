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
