/* Galerie produits : filtres par catégorie + visionneuse photos. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var chips = document.querySelectorAll('.gal-chip'), secs = document.querySelectorAll('.gal-sec');
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      var f = c.dataset.f;
      chips.forEach(function (x) { var on = x === c; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      secs.forEach(function (s) { s.hidden = !(f === 'all' || s.dataset.cat === f); });
    });
  });
  var lb = $('#gal-lb'); if (!lb || !lb.showModal) return;
  var data = {}, cur = null, idx = 0, opener = null;
  document.querySelectorAll('.gal-data').forEach(function (n) { try { var d = JSON.parse(n.textContent); data[d.id] = d; } catch (e) {} });
  function show(i) {
    var n = cur.imgs.length; idx = (i + n) % n; var im = cur.imgs[idx];
    $('#gal-lb-img').src = im.src; $('#gal-lb-img').alt = im.alt;
    $('#gal-thumbs').querySelectorAll('button').forEach(function (b, k) { if (k === idx) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
  }
  function open(id, btn) {
    cur = data[id]; if (!cur) return; opener = btn;
    $('#gal-lb-t').textContent = cur.name; $('#gal-lb-d').textContent = cur.desc;
    var ul = $('#gal-lb-i'); ul.textContent = ''; (cur.infos || []).forEach(function (t) { var li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
    $('#gal-lb-c').textContent = cur.colors.length < 2 ? '' : cur.colors.length + ' coloris disponibles : ' + cur.colors.map(function (c) { return c.name; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ');
    $('#gal-lb-s').href = 'simulateur.html?produit=' + encodeURIComponent(id); $('#gal-lb-s').hidden = !cur.sim;
    var th = $('#gal-thumbs'); th.textContent = '';
    cur.imgs.forEach(function (im, i) { var b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Photo ' + (i + 1) + ' : ' + im.alt); var t = document.createElement('img'); t.src = im.src; t.alt = ''; t.loading = 'lazy'; b.appendChild(t); b.addEventListener('click', function () { show(i); }); th.appendChild(b); });
    show(0); lb.showModal(); document.documentElement.style.overflow = 'hidden';
  }
  document.querySelectorAll('.gal-open').forEach(function (b) { b.addEventListener('click', function () { open(b.dataset.id, b); }); });
  /* ----- produits ajoutés depuis l'administration (Supabase, lecture publique) ----- */
  function safeImg(u) { return u && (/^https:\/\//.test(u) || /^Assets\//.test(u)) ? u : ''; }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function addProduct(p) {
    var grid = document.querySelector('.gal-sec[data-cat="' + p.categorie + '"] .gal-grid'); if (!grid) return;
    var id = 'db-' + p.id, main = safeImg(p.image_url); if (!main) return;
    var imgs = [main, safeImg(p.image2_url), safeImg(p.image3_url)].filter(Boolean).map(function (u, i) { return { src: u, alt: p.nom + (i ? ', photo ' + (i + 1) : '') }; });
    var cols = (p.coloris || '').split(',').map(function (c) { return c.trim(); }).filter(Boolean).map(function (n) { return { name: n }; });
    data[id] = { id: id, name: p.nom, desc: p.description || '', infos: (p.caracteristiques || '').split('\n').map(function (t) { return t.trim(); }).filter(Boolean), imgs: imgs, colors: cols, sim: !!p.simulateur, stock: p.stock_item_id ? !!p.en_stock : null };
    var card = el('article', 'gal-card'); card.dataset.cat = p.categorie;
    var op = el('button', 'gal-open'); op.type = 'button'; op.dataset.id = id; op.setAttribute('aria-label', 'Voir les photos : ' + p.nom);
    var ph = el('span', 'gal-ph'), im = document.createElement('img'); im.src = main; im.width = 450; im.height = 480; im.loading = 'lazy'; im.alt = p.nom; ph.appendChild(im); op.appendChild(ph); card.appendChild(op);
    var body = el('div', 'gal-body'); body.appendChild(el('h3', null, p.nom));
    if (data[id].stock !== null) body.appendChild(el('p', 'gal-stock ' + (data[id].stock ? 'is-in' : 'is-out'), data[id].stock ? 'En stock' : 'Sur commande'));
    if (p.description) body.appendChild(el('p', 'gal-desc', p.description));
    if (cols.length > 1) body.appendChild(el('p', 'gal-col', cols.length + ' coloris'));
    var act = el('div', 'gal-act'), b2 = el('button', 'btn btn-outline btn-lg gal-open'); b2.type = 'button'; b2.dataset.id = id; b2.appendChild(el('span', null, 'Voir les photos')); act.appendChild(b2);
    if (p.simulateur) { var a = el('a', 'gal-sim', 'Simuler mon logo'); a.href = 'simulateur.html?produit=' + encodeURIComponent(id); act.appendChild(a); }
    body.appendChild(act); card.appendChild(body); grid.appendChild(card);
    [op, b2].forEach(function (b) { b.addEventListener('click', function () { open(id, b); }); });
  }
  var cfg = window.CMR_SUPABASE;
  if (cfg && window.fetch) {
    fetch(cfg.url + '/rest/v1/produits_publies?select=*&publie=eq.true&order=ordre.asc,created_at.asc', { headers: { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key } })
      .then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) { (rows || []).forEach(addProduct); }).catch(function () {});
  }

  $('#gal-x').addEventListener('click', function () { lb.close(); });
  $('.gal-prev').addEventListener('click', function () { show(idx - 1); });
  $('.gal-next').addEventListener('click', function () { show(idx + 1); });
  lb.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') show(idx - 1); else if (e.key === 'ArrowRight') show(idx + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
  lb.addEventListener('close', function () { document.documentElement.style.overflow = ''; if (opener) opener.focus({ preventScroll: true }); });
})();
