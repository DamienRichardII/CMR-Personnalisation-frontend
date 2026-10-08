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
  $('#gal-x').addEventListener('click', function () { lb.close(); });
  $('.gal-prev').addEventListener('click', function () { show(idx - 1); });
  $('.gal-next').addEventListener('click', function () { show(idx + 1); });
  lb.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') show(idx - 1); else if (e.key === 'ArrowRight') show(idx + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
  lb.addEventListener('close', function () { document.documentElement.style.overflow = ''; if (opener) opener.focus({ preventScroll: true }); });
})();
