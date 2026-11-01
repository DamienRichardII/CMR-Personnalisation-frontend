/* Devis : si le visiteur arrive depuis le catalogue, reprend le modèle choisi dans la description du projet. */
(function () {
  'use strict';
  var raw = null; try { raw = sessionStorage.getItem('cmr-catalogue'); } catch (e) {}
  if (!raw) return; var d; try { d = JSON.parse(raw); } catch (e) { return; }
  if (!d || !d.nom) return; try { sessionStorage.removeItem('cmr-catalogue'); } catch (e) {}
  function init() {
    var txt = document.getElementById('q-description'), form = document.getElementById('quiz-form');
    var line = 'Produit souhaité : ' + d.nom + (d.ref ? ' (réf. ' + d.ref + ')' : '') + (d.coloris ? ', coloris ' + String(d.coloris).toLowerCase() : '') + '.';
    if (txt && !txt.value) txt.value = line;
    if (form && form.parentNode) {
      var n = document.createElement('div'); n.className = 'form-status is-ok'; n.setAttribute('role', 'status'); n.style.marginBottom = '16px';
      n.textContent = 'Produit choisi dans le catalogue : ' + d.nom + '. Il sera repris dans votre demande ; indiquez ensuite la quantité et la personnalisation.'; form.parentNode.insertBefore(n, form);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 0); }); else setTimeout(init, 0);
})();
