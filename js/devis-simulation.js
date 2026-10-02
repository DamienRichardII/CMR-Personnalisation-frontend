/* Devis : récupère l'aperçu (et le logo) préparés dans le simulateur et les joint à la demande. */
(function () {
  'use strict';
  var raw = null;
  try { raw = sessionStorage.getItem('cmr-sim'); } catch (e) {}
  if (!raw) return;
  var d; try { d = JSON.parse(raw); } catch (e) { return; }
  if (!d || !d.mock) return;
  try { sessionStorage.removeItem('cmr-sim'); } catch (e) {}

  function toFile(url, name) {
    var m = /^data:([^;,]+)(;base64)?,(.*)$/.exec(url); if (!m) return null;
    var bin = atob(decodeURIComponent(m[3])), arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], name, { type: m[1] });
  }
  function init() {
    var input = document.querySelector('#logo-drop input[type="file"]'); if (!input) return;
    var files = [toFile(d.mock, 'simulation-cmr.png')];
    if (d.logo) { var ext = (/\.[a-z0-9]+$/i.exec(d.logoName || '') || ['.png'])[0]; files.push(toFile(d.logo, 'logo-client' + ext.toLowerCase())); }
    try {
      var dt = new DataTransfer(); files.forEach(function (f) { if (f) dt.items.add(f); });
      input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) { return; }
    var yes = document.querySelector('input[name="logo"][value="Oui"]'); if (yes) { yes.checked = true; yes.dispatchEvent(new Event('change', { bubbles: true })); }
    var txt = document.getElementById('q-description');
    var line = 'Simulation jointe : ' + d.garment + ' ' + String(d.color || '').toLowerCase() + ', ' + String(d.place || '').toLowerCase() + (d.face ? ' (' + String(d.face).toLowerCase() + ')' : '') + '.';
    if (txt && !txt.value) txt.value = line;
    var form = document.getElementById('quiz-form');
    if (form && form.parentNode) {
      var n = document.createElement('div'); n.className = 'form-status is-ok'; n.setAttribute('role', 'status'); n.style.marginBottom = '16px';
      n.textContent = 'Votre simulation (' + d.garment + ' ' + String(d.color || '').toLowerCase() + ') est jointe à votre demande. Vous pouvez poursuivre le questionnaire.';
      form.parentNode.insertBefore(n, form);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 0); }); else setTimeout(init, 0);
})();
