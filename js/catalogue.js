/* Catalogue textile : lecture publique de la vue Supabase `catalogue_public` (fiches actives, sans mention de fournisseur). */
(function () {
  'use strict';
  var cfg = window.CMR_SUPABASE, grid = document.getElementById('cat-grid'); if (!cfg || !grid || !window.fetch) return;
  var PAGE = 24, state = { f: 'best', g: 'all', c: 'all', q: '', offset: 0, total: 0, req: 0 }, rows = {};
  var CHIPS = [['best', 'Best sellers'], ['sweats', 'Sweats & polaires'], ['tshirts', 'T-shirts'], ['polos', 'Polos'], ['vestes', 'Vestes & blousons'], ['hv', 'Haute visibilité'], ['chemises', 'Chemises'], ['pantalons', 'Pantalons'], ['metiers', 'Métiers & travail'], ['sport', 'Sport'], ['chaussures', 'Chaussures'], ['bebe', 'Bébé'], ['casquettes', 'Casquettes & bonnets'], ['sacs', 'Sacs'], ['boissons', 'Gourdes, mugs & tasses'], ['cles', 'Porte-clés & badges'], ['bureau', 'Stylos & papeterie'], ['tech', 'High-tech'], ['accessoires', 'Autres objets'], ['new', 'Nouveautés']];
  var GENRES = [['all', 'Tout public'], ['Homme', 'Homme'], ['Femme', 'Femme'], ['Enfant', 'Enfant'], ['Mixte', 'Mixte']];
  var COLORS = [['all', 'Toutes les couleurs', ''], ['Noir', 'Noir', '#111'], ['Blanc', 'Blanc', '#fff'], ['Gris', 'Gris', '#8a8f98'], ['Bleu', 'Bleu', '#1f4fbf'], ['Rouge', 'Rouge', '#d12b2b'], ['Vert', 'Vert', '#2e8b57'], ['Jaune', 'Jaune', '#f2c200'], ['Orange', 'Orange', '#f28c28'], ['Rose', 'Rose', '#ee7fb0'], ['Violet', 'Violet', '#7a4fb5'], ['Marron', 'Marron', '#8b5e3c']];
  function scope() { return (state.q.trim() || (state.f === 'best' && state.c !== 'all')) ? 'all' : state.f; }
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function safeImg(u) { u = typeof u === 'string' ? u.split(',')[0].trim() : ''; return /^https:\/\//.test(u) ? u : ''; }
  function plural(n, w) { return n + ' ' + w + (n > 1 ? 's' : ''); }
  var COLS = 'best,ref,nom,image,genre,rubrique,tailles,coloris,nouveaute,description,composition';

  function url() {
    var q0 = state.q.trim(), sc = scope(), p = ['select=' + COLS, (sc === 'best' ? 'order=best.asc' : 'order=nom.asc,ref.asc'), 'limit=' + PAGE, 'offset=' + state.offset];
    if (sc === 'best') p.push('best=not.is.null'); else if (sc === 'new') p.push('nouveaute=eq.true'); else if (sc !== 'all') p.push('rubrique=eq.' + encodeURIComponent(sc));
    if (state.c !== 'all') p.push('couleurs=cs.' + encodeURIComponent('{' + state.c + '}'));
    if (state.g !== 'all') p.push('genre=eq.' + encodeURIComponent(state.g));
    var q = state.q.replace(/[*%,()\\"]/g, ' ').trim(); if (q) p.push('or=' + encodeURIComponent('(nom.ilike.*' + q + '*,description.ilike.*' + q + '*)'));
    return cfg.url + '/rest/v1/catalogue_public?' + p.join('&');
  }
  function card(p) {
    var cols = p.coloris || [], main = safeImg(p.image) || safeImg(cols[0] && cols[0].image); if (!main) return null;
    rows[p.ref] = p;
    var c = el('article', 'gal-card'), op = el('button', 'gal-open'); op.type = 'button'; op.setAttribute('aria-label', 'Voir le détail : ' + p.nom);
    var ph = el('span', 'gal-ph'), im = document.createElement('img'); im.src = main; im.width = 450; im.height = 450; im.loading = 'lazy'; im.alt = p.nom; im.referrerPolicy = 'no-referrer';
    im.onerror = function () { im.style.visibility = 'hidden'; }; ph.appendChild(im); op.appendChild(ph); c.appendChild(op);
    var b = el('div', 'gal-body'); if (p.nouveaute) b.appendChild(el('p', 'cat-new', 'Nouveauté'));
    b.appendChild(el('h3', null, p.nom));
    var sub = [p.genre, cols.length ? plural(cols.length, 'coloris') : ''].filter(Boolean).join(' · '); if (sub) b.appendChild(el('p', 'cat-sub', sub));
    var act = el('div', 'gal-act'), bt = el('button', 'btn btn-outline btn-lg'); bt.type = 'button'; bt.appendChild(el('span', null, 'Voir le détail')); act.appendChild(bt); b.appendChild(act); c.appendChild(b);
    [op, bt].forEach(function (x) { x.addEventListener('click', function () { openLb(p, x); }); });
    return c;
  }
  function load(reset) {
    var my = ++state.req; if (reset) { state.offset = 0; grid.textContent = ''; $('cat-more').hidden = true; $('cat-empty').hidden = true; $('cat-count').textContent = 'Chargement…'; }
    fetch(url(), { headers: { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key, Prefer: 'count=exact' } }).then(function (r) {
      if (!r.ok) throw new Error('http'); var m = /\/(\d+)$/.exec(r.headers.get('content-range') || ''); state.total = m ? +m[1] : 0; return r.json();
    }).then(function (list) {
      if (my !== state.req) return;
      (list || []).forEach(function (p) { var c = card(p); if (c) grid.appendChild(c); });
      state.offset += PAGE; var shown = grid.children.length;
      $('cat-count').textContent = state.total ? plural(state.total, 'modèle') : '';
      $('cat-empty').hidden = shown > 0; $('cat-more').hidden = state.offset >= state.total;
    }).catch(function () { if (my !== state.req) return; $('cat-count').textContent = ''; $('cat-empty').hidden = false; $('cat-empty').textContent = 'Le catalogue est momentanément indisponible. Réessayez dans un instant.'; });
  }
  function drawBar(box, list, key) {
    box.textContent = '';
    list.forEach(function (c) {
      var on = key === 'f' ? c[0] === scope() : c[0] === state[key], b = el('button', 'gal-chip' + (on ? ' is-on' : ''), c[1]); b.type = 'button'; if (c[2]) { var d = el('span', 'cat-dot'); d.style.background = c[2]; d.setAttribute('aria-hidden', 'true'); b.insertBefore(d, b.firstChild); } b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.addEventListener('click', function () { state[key] = c[0]; draw(); load(true); }); box.appendChild(b);
    });
  }
  function draw() { drawBar($('cat-genres'), GENRES, 'g'); drawBar($('cat-colors-f'), COLORS, 'c'); drawBar($('cat-chips'), CHIPS, 'f'); }
  var tmr; $('cat-q').addEventListener('input', function (e) { clearTimeout(tmr); tmr = setTimeout(function () { state.q = e.target.value; draw(); load(true); }, 300); });
  $('cat-more').addEventListener('click', function () { load(false); });

  /* ---------- fiche détaillée ---------- */
  var lb = $('cat-lb'), cur = null, col = 0, idx = 0, imgs = [], opener = null;
  function photos(c) { var v = (c.views || []).map(safeImg).filter(Boolean); var m = safeImg(c.image); if (m && v.indexOf(m) < 0) v.unshift(m); return v; }
  function show(i) {
    if (!imgs.length) return; idx = (i + imgs.length) % imgs.length;
    var im = $('cat-lb-img'); im.src = imgs[idx]; im.alt = cur.nom + ', ' + (cur.coloris[col].nom || '') + ', photo ' + (idx + 1);
    $('cat-thumbs').querySelectorAll('button').forEach(function (b, k) { if (k === idx) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
  }
  function pickColor(i) {
    col = i; var c = cur.coloris[i]; imgs = photos(c); idx = 0;
    $('cat-colname').textContent = c.nom ? 'Coloris : ' + c.nom : '';
    document.querySelectorAll('#cat-colors button').forEach(function (b, k) { b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
    var th = $('cat-thumbs'); th.textContent = '';
    imgs.forEach(function (u, k) { var b = el('button'); b.type = 'button'; b.setAttribute('aria-label', 'Photo ' + (k + 1)); var t = document.createElement('img'); t.src = u; t.alt = ''; t.loading = 'lazy'; t.referrerPolicy = 'no-referrer'; b.appendChild(t); b.addEventListener('click', function () { show(k); }); th.appendChild(b); });
    show(0); quoteLink();
    var same = cur.coloris.length > 1 && cur.coloris.every(function (x) { return x.image === cur.coloris[0].image; });
    $('cat-note').textContent = 'Tarifs et disponibilités sur devis.' + (same ? ' Photo d\u2019illustration : le coloris choisi peut différer.' : '');
  }
  function quoteLink() {
    var c = cur.coloris[col] || {}, a = $('cat-lb-q');
    a.onclick = function () { try { sessionStorage.setItem('cmr-catalogue', JSON.stringify({ nom: cur.nom, ref: cur.ref, coloris: c.nom || '', nbColoris: cur.coloris.length, tailles: cur.tailles || [] })); } catch (e) {} };
  }
  function openLb(p, btn) {
    cur = p; opener = btn; if (!(p.coloris && p.coloris.length)) return;
    $('cat-lb-t').textContent = p.nom; $('cat-lb-m').textContent = p.genre || '';
    var cs = $('cat-colors'); cs.textContent = '';
    p.coloris.forEach(function (c, i) { var b = el('button'); b.type = 'button'; b.title = c.nom || ''; b.setAttribute('aria-label', 'Coloris ' + (c.nom || i + 1)); var u = safeImg(c.swatch) || safeImg(c.image) || photos(c)[0]; if (u) { var t = document.createElement('img'); t.src = u; t.alt = ''; t.loading = 'lazy'; t.referrerPolicy = 'no-referrer'; b.appendChild(t); } b.addEventListener('click', function () { pickColor(i); }); cs.appendChild(b); });
    cs.hidden = p.coloris.length < 2;
    $('cat-sizes').textContent = (p.tailles && p.tailles.length) ? 'Tailles : ' + p.tailles.join(', ') : '';
    var ul = $('cat-lb-i'); ul.textContent = ''; String(p.description || '').split('\n').filter(Boolean).slice(0, 12).forEach(function (t) { ul.appendChild(el('li', null, t)); });
    var comp = $('cat-lb-c'); comp.className = 'cat-comp'; comp.textContent = p.composition ? 'Composition : ' + p.composition : '';
    pickColor(0); if (lb.showModal) { lb.showModal(); document.documentElement.style.overflow = 'hidden'; }
  }
  $('cat-x').addEventListener('click', function () { lb.close(); });
  lb.querySelector('.gal-prev').addEventListener('click', function () { show(idx - 1); });
  lb.querySelector('.gal-next').addEventListener('click', function () { show(idx + 1); });
  lb.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') show(idx - 1); else if (e.key === 'ArrowRight') show(idx + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
  lb.addEventListener('close', function () { document.documentElement.style.overflow = ''; if (opener) opener.focus({ preventScroll: true }); });
  draw(); load(true);
})();
