/* CMR Personnalisation — contenus éditables depuis l'administration.
   Le HTML contient toujours la version d'origine : si Supabase est injoignable ou vide,
   rien ne change (aucune régression). Lecture publique uniquement (clé publishable + RLS). */
(function () {
  'use strict';
  var cfg = window.CMR_SUPABASE;
  var texts = document.querySelectorAll('[data-cms]');
  var cards = document.querySelector('.pcards[data-cms-cards]');
  if (!cfg || (!texts.length && !cards)) return;

  function get(path) {
    return fetch(cfg.url + '/rest/v1/' + path, { headers: { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key, Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }

  if (texts.length) {
    get('contenus?select=cle,valeur').then(function (rows) {
      var map = {}; rows.forEach(function (r) { if (r.valeur && r.valeur.trim()) map[r.cle] = r.valeur; });
      Array.prototype.forEach.call(texts, function (el) {
        var v = map[el.getAttribute('data-cms')];
        if (v) el.textContent = v;
      });
    }).catch(function () { /* on garde le texte d'origine */ });
  }

  if (cards) {
    get('realisations?select=titre,sous_titre,image_url,alt,ordre&publie=eq.true&order=ordre.asc').then(function (rows) {
      if (!rows.length) return;
      var NS = 'http://www.w3.org/2000/svg';
      function icon(id) {
        var s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'icon'); s.setAttribute('aria-hidden', 'true');
        var u = document.createElementNS(NS, 'use'); u.setAttribute('href', '#' + id); s.appendChild(u); return s;
      }
      function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
      var more = cards.querySelector('.is-more');
      Array.prototype.slice.call(cards.children).forEach(function (c) { if (c !== more) cards.removeChild(c); });
      rows.forEach(function (r, i) {
        var li = el('li', 'pcard fade-up is-visible');
        var media = el('div', 'pcard-media' + (r.image_url ? '' : ' is-icon'));
        if (r.image_url) {
          var im = document.createElement('img');
          im.src = r.image_url; im.alt = ''; im.width = 840; im.height = 1050; if (i > 3) im.loading = 'lazy';
          media.appendChild(im);
        } else { media.appendChild(icon('i-diamond')); }
        var body = el('div', 'pcard-body'), h3 = el('h3', null, r.titre);
        if (r.sous_titre) h3.appendChild(el('span', 'sub', r.sous_titre));
        var go = el('span', 'pcard-go'); go.setAttribute('aria-hidden', 'true'); go.appendChild(icon('i-arrow'));
        body.appendChild(h3); body.appendChild(go);
        var a = el('a', 'pcard-link'); a.href = 'devis.html'; a.setAttribute('aria-label', 'Demander un devis : ' + r.titre);
        li.appendChild(media); li.appendChild(body); li.appendChild(a);
        cards.insertBefore(li, more);
      });
    }).catch(function () { /* on garde les cartes d'origine */ });
  }
})();
