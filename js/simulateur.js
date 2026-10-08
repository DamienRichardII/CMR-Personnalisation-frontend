/* Simulateur de personnalisation — photos produit en rotation 360° + logo du client.
   100 % côté navigateur : le logo n'est envoyé nulle part tant que la demande de devis n'est pas envoyée. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg', W = 900, H = 960;
  var $ = function (s) { return document.querySelector(s); };
  var cv = $('#sim-view'); if (!cv) return;
  var ctx = cv.getContext('2d'), svg = $('#sim-svg'), stage = $('#sim-stage');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DATA = null, imgCache = {}, colCache = {}, colOrder = [];

  var st = { t: { g: 0, c: 0, f: 0, p: 0 }, sel: false, pid: 'tshirt', ci: 0, angle: 0, anim: null, spun: false,
    pl: null, logo: null, logoEl: null, logoOrig: null, logoName: '', ratio: 366 / 900, demo: true };
  st.ratio = 900 / 366;

  function el(tag, attrs, parent) { var n = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); }); if (parent) parent.appendChild(n); return n; }
  function prod() { return DATA.products.filter(function (p) { return p.id === st.pid; })[0]; }
  function color() { return prod().colors[st.ci]; }
  function norm(a) { return ((a % 360) + 360) % 360; }
  function dAng(a, b) { var d = norm(a - b); return d > 180 ? d - 360 : d; }
  function bw(p, k) { var b = p.bbox[k]; return b[2] - b[0]; }
  function hasBack(p) { return !!p.views.dos; }
  function viewList(p) {
    var v = [{ key: 'face', angle: 0, flip: false, w: bw(p, 'face') }];
    if (p.views.gauche) v.push({ key: 'gauche', angle: 90, flip: false, w: bw(p, 'gauche') });
    if (p.views.dos) v.push({ key: 'dos', angle: 180, flip: false, w: bw(p, 'dos') });
    if (p.views.droite) v.push({ key: 'droite', angle: 270, flip: false, w: bw(p, 'droite') });
    else if (p.views.gauche) v.push({ key: 'gauche', angle: 270, flip: true, w: bw(p, 'gauche') });
    return v;
  }

  /* ----- images + recoloration ----- */
  function loadImg(src) {
    if (!imgCache[src]) imgCache[src] = new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
    return imgCache[src];
  }
  function hexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function lum(hex) { var c = hexRgb(hex); return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; }
  function colorize(img, hex) {
    var c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, W, H);
    var d = x.getImageData(0, 0, W, H), px = d.data, t = hexRgb(hex), i, ls = [];
    for (i = 0; i < px.length; i += 52) { if (Math.min(px[i], px[i + 1], px[i + 2]) < 235) ls.push((px[i] + px[i + 1] + px[i + 2]) / 3); }
    ls.sort(function (a, b) { return a - b; });
    var Lm = Math.max(12, ls.length ? ls[ls.length >> 1] : 60);
    for (i = 0; i < px.length; i += 4) {
      var mn = Math.min(px[i], px[i + 1], px[i + 2]), a = (250 - mn) / 40; if (a <= 0) continue; if (a > 1) a = 1;
      var L = (px[i] + px[i + 1] + px[i + 2]) / 3, s = L / Lm; if (s > 2.2) s = 2.2;
      var f = 1 + (s - 1) * 0.85;
      for (var k = 0; k < 3; k++) { var v = t[k] * f; v = v > 255 ? 255 : v < 0 ? 0 : v; px[i + k] = v * a + 255 * (1 - a); }
    }
    x.putImageData(d, 0, 0); return c;
  }
  function viewSource(p, key, ci) {
    var base = loadImg(p.views[key]);
    if (ci === p.base) return base;
    var ck = p.id + '|' + key + '|' + p.colors[ci].hex;
    if (colCache[ck]) return Promise.resolve(colCache[ck]);
    return base.then(function (img) {
      var c = colorize(img, p.colors[ci].hex); colCache[ck] = c; colOrder.push(ck);
      if (colOrder.length > 16) delete colCache[colOrder.shift()];
      return c;
    });
  }
  var cur = {}, loadToken = 0;
  function prepare() {
    var p = prod(), tok = ++loadToken, keys = Object.keys(p.views);
    stage.classList.add('is-loading');
    return Promise.all(keys.map(function (k) { return viewSource(p, k, st.ci); })).then(function (arr) {
      if (tok !== loadToken) return;
      cur = {}; keys.forEach(function (k, i) { cur[k] = arr[i]; });
      stage.classList.remove('is-loading'); demoLogo(); render();
    });
  }

  /* ----- logo d'exemple CMR (remplacé dès que le client ajoute le sien) ----- */
  function demoLogo() {
    if (!st.demo) return;
    var src = lum(color().hex) < 140 ? 'Assets/img/logo-blanc.png' : 'Assets/img/logo-noir.png';
    if (st.logo === src) return;
    st.logo = src; st.ratio = 900 / 366;
    loadImg(src).then(function (i) { if (st.demo && st.logo === src) { st.logoEl = i; } });
  }

  /* ----- rendu (rotation) ----- */
  var shown = { fk: null, sx: 1, op: 1, dd: 0, best: null };
  function render() {
    var p = prod(); if (!p || !cur.face) return;
    var vs = viewList(p), a = norm(st.angle), best = null, bd = 999;
    vs.forEach(function (v) { var d = Math.abs(dAng(a, v.angle)); if (d < bd) { bd = d; best = v; } });
    var dd = dAng(a, best.angle), dir = dd >= 0 ? 1 : -1, nb = null, nd = 999;
    vs.forEach(function (v) { if (v === best) return; var d = dAng(v.angle, best.angle) * dir; if (d > 0 && d < nd) { nd = d; nb = v; } });
    var sx = 1;
    if (nb && nd < 200) { var tt = Math.min(1, Math.abs(dd) / nd); sx = (best.w + (nb.w - best.w) * tt) / best.w; }
    sx = Math.max(0.25, Math.min(1.6, sx));
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(W / 2, 0); ctx.scale(best.flip ? -sx : sx, 1); ctx.translate(-W / 2, 0);
    ctx.drawImage(cur[best.key], 0, 0, W, H); ctx.restore();
    shown.fk = best.key === 'face' ? 'face' : best.key === 'dos' ? 'dos' : null;
    shown.sx = sx; shown.op = Math.max(0, 1 - Math.abs(dd) / 35); shown.dd = dd; shown.best = best;
    drawLogo(); updateRot();
  }

  /* ----- logo sur la photo ----- */
  function curPlace(fk) { var pl = st.pl[fk], p = prod(); return p.places[fk].filter(function (q) { return q.id === pl.id; })[0] || p.places[fk][0]; }
  function drawLogo() {
    var lg = $('#sim-logo'); while (lg.firstChild) lg.removeChild(lg.firstChild);
    var has = !!st.logo, user = has && !st.demo, fk = shown.fk, p = prod();
    var visible = has && fk && st.pl[fk].on && p.places[fk].length;
    lg.setAttribute('visibility', visible ? 'visible' : 'hidden');
    lg.classList.toggle('is-sel', !!visible && st.sel);
    var em = $('#sim-empty'); em.hidden = user; em.textContent = 'Logo d’exemple : ajoutez le vôtre';
    $('#sim-download').disabled = !user; $('#sim-quote').disabled = !user;
    $('#cfg-s5').disabled = !has;
    $('#sim-note').textContent = user ? 'Votre simulation sera jointe à votre demande.' : 'Ajoutez votre logo pour continuer.';
    syncLogoUI(); drawSummary();
    if (!visible) return;
    var pl = st.pl[fk], q = curPlace(fk), w = q.w * pl.s / 100, h = w / st.ratio;
    if (h > 430) { h = 430; w = h * st.ratio; }
    var g = el('g', { transform: 'translate(' + W / 2 + ' 0) scale(' + shown.sx.toFixed(4) + ' 1) translate(' + (-W / 2) + ' 0)', opacity: shown.op.toFixed(3) }, lg);
    el('image', { href: st.logo, x: pl.x - w / 2, y: pl.y - h / 2, width: w, height: h, preserveAspectRatio: 'xMidYMid meet' }, g);
    el('rect', { 'class': 'sim-frame', x: pl.x - w / 2 - 6, y: pl.y - h / 2 - 6, width: w + 12, height: h + 12, rx: 8, fill: 'none' }, g);
  }
  function initPlaces() {
    var p = prod(); st.pl = {};
    ['face', 'dos'].forEach(function (k) { var q = p.places[k] && p.places[k][0]; st.pl[k] = q ? { id: q.id, x: q.x, y: q.y, s: 100, on: k === 'face' } : { id: null, x: W / 2, y: H / 2, s: 100, on: false }; });
  }
  function atRest() { return !st.anim && !rot && Math.abs(shown.dd || 0) < 2 && shown.fk; }

  /* ----- animation d'angle ----- */
  function animateTo(target, ms) {
    if (st.anim) { cancelAnimationFrame(st.anim.id); st.anim = null; }
    var from = st.angle, t0 = null;
    if (reduce || !ms) { st.angle = target; render(); return; }
    var an = st.anim = {};
    function step(ts) {
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      st.angle = from + (target - from) * e;
      if (k < 1) { an.id = requestAnimationFrame(step); render(); }
      else { st.anim = null; st.angle = hasBack(prod()) ? norm(target) : target; render(); }
    }
    an.id = requestAnimationFrame(step);
  }
  function goFace(fk) {
    var p = prod(); if (fk === 'dos' && !hasBack(p)) return; st.t.f = 1;
    var target = fk === 'dos' ? 180 : 0, a = norm(st.angle);
    if (!hasBack(p)) { animateTo(0, 420); return; }
    animateTo(a + dAng(target, a), 560);
  }
  function stepRot(sgn) {
    var p = prod(); st.t.f = 1;
    if (!hasBack(p)) { var a0 = st.angle; animateTo(Math.max(-90, Math.min(90, Math.round(a0 / 90) * 90 + sgn * 90)), 420); return; }
    animateTo(Math.round(st.angle / 90) * 90 + sgn * 90, 480);
  }
  function spinDemo() {
    if (reduce || st.spun) return; st.spun = true;
    if (hasBack(prod())) animateTo(360, 3000);
    else { animateTo(70, 1000); setTimeout(function () { if (!rot && !st.anim) animateTo(0, 1000); }, 1250); }
  }

  /* ----- glisser : rotation du vêtement ou déplacement du logo ----- */
  var rot = null, drag = null;
  function pt(ev) { var r = svg.getBoundingClientRect(), k = W / r.width; return { x: (ev.clientX - r.left) * k, y: (ev.clientY - r.top) * k }; }
  svg.addEventListener('pointerdown', function (ev) {
    if (ev.target.closest && ev.target.closest('#sim-logo') && st.logo && atRest() && st.pl[shown.fk].on) {
      st.sel = true; st.t.p = 1; var p = pt(ev), pl = st.pl[shown.fk];
      drag = { dx: pl.x - p.x, dy: pl.y - p.y, fk: shown.fk };
      svg.setPointerCapture(ev.pointerId); $('#sim-logo').classList.add('is-drag'); ev.preventDefault(); return;
    }
    if (st.sel) { st.sel = false; drawLogo(); }
    if (st.anim) { cancelAnimationFrame(st.anim.id); st.anim = null; }
    rot = { x: ev.clientX, a: st.angle, moved: false }; svg.setPointerCapture(ev.pointerId); stage.classList.add('is-rot');
  });
  svg.addEventListener('pointermove', function (ev) {
    if (drag) {
      var p = pt(ev), pl = st.pl[drag.fk];
      pl.x = Math.max(60, Math.min(W - 60, p.x + drag.dx)); pl.y = Math.max(60, Math.min(H - 60, p.y + drag.dy)); drawLogo(); return;
    }
    if (!rot) return;
    var dx = ev.clientX - rot.x; if (Math.abs(dx) > 3) rot.moved = true;
    if (!rot.moved) return;
    var a = rot.a - dx * 0.55;
    if (!hasBack(prod())) a = Math.max(-90, Math.min(90, a));
    st.angle = a; st.t.f = 1; render();
  });
  function endPtr() {
    if (drag) { drag = null; $('#sim-logo').classList.remove('is-drag'); return; }
    if (!rot) return; var moved = rot.moved; rot = null; stage.classList.remove('is-rot'); if (!moved) return;
    var snap = Math.round(st.angle / 90) * 90;
    if (!hasBack(prod())) snap = Math.max(-90, Math.min(90, snap));
    animateTo(snap, 320);
  }
  ['pointerup', 'pointercancel'].forEach(function (n) { svg.addEventListener(n, endPtr); });
  $('#sim-logo').addEventListener('keydown', function (ev) {
    if (!st.logo || !shown.fk) return; var pl = st.pl[shown.fk];
    var s = ev.shiftKey ? 16 : 5, k = ev.key, ch = true;
    if (k === 'ArrowLeft') pl.x -= s; else if (k === 'ArrowRight') pl.x += s; else if (k === 'ArrowUp') pl.y -= s; else if (k === 'ArrowDown') pl.y += s;
    else if (k === '+' || k === '=') pl.s = Math.min(160, pl.s + 4); else if (k === '-') pl.s = Math.max(40, pl.s - 4); else ch = false;
    if (ch) { ev.preventDefault(); st.t.p = 1; controlsSize(); drawLogo(); }
  });
  $('#sim-logo').addEventListener('focus', function () { if (st.logo && !st.sel) { st.sel = true; drawLogo(); } });
  $('#sim-rot-l').addEventListener('click', function () { stepRot(-1); });
  $('#sim-rot-r').addEventListener('click', function () { stepRot(1); });
  stage.addEventListener('keydown', function (ev) {
    if (ev.target.closest && ev.target.closest('#sim-logo')) return;
    if (ev.target.closest && ev.target.closest('.sim-view') === null) return;
  });

  /* ----- commandes ----- */
  function buttons(box, items, current, cls, onPick, pre) {
    box.textContent = '';
    items.forEach(function (it) {
      var b = document.createElement('button'); b.type = 'button'; b.className = cls + (it.id === current ? ' is-on' : ''); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', it.id === current ? 'true' : 'false'); b.dataset.k = pre + it.id;
      b.textContent = it.label; b.addEventListener('click', function () { onPick(it.id); }); box.appendChild(b);
    });
  }
  function currentFace() { return shown.fk || (shown.best && shown.best.angle > 90 && shown.best.angle < 270 ? 'dos' : 'face'); }
  function drawProducts() {
    var gs = $('#sim-garments'); gs.textContent = '';
    DATA.products.forEach(function (p) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'cfg-card' + (p.id === st.pid ? ' is-on' : ''); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', p.id === st.pid ? 'true' : 'false'); b.dataset.k = 'g:' + p.id;
      var im = document.createElement('img'); im.src = p.views.face; im.alt = ''; im.width = 90; im.height = 96; im.loading = 'lazy'; im.decoding = 'async'; b.appendChild(im);
      var t = document.createElement('span'); t.textContent = p.name; b.appendChild(t);
      b.addEventListener('click', function () { chooseProduct(p.id); }); gs.appendChild(b);
    });
  }
  function drawColors() {
    var p = prod(), cs = $('#sim-colors'); cs.textContent = '';
    p.colors.forEach(function (c, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'sim-swatch' + (i === st.ci ? ' is-on' : ''); b.style.setProperty('--sw', c.hex); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', i === st.ci ? 'true' : 'false'); b.setAttribute('aria-label', c.name); b.title = c.name; b.dataset.k = 'c:' + i;
      b.addEventListener('click', function () { if (i === st.ci) return; st.ci = i; st.t.c = 1; drawColors(); prepare(); }); cs.appendChild(b);
    });
    $('#sim-colorname').textContent = color().name + ' · ' + p.colors.length + ' coloris';
  }
  function controlsFor() {
    var p = prod(), fk = currentFace(), back = hasBack(p);
    var fs = [{ id: 'face', label: 'Avant' }]; if (back) fs.push({ id: 'dos', label: 'Dos' });
    buttons($('#sim-faces'), fs, fk, 'cfg-segbtn', goFace, 'f:'); buttons($('#sim-faces2'), fs, fk, 'cfg-segbtn', goFace, 'g2:');
    var list = p.places[fk] || [];
    buttons($('#sim-places'), list, st.pl[fk].id, 'cfg-opt', function (id) {
      var q = p.places[fk].filter(function (z) { return z.id === id; })[0], pl = st.pl[fk];
      pl.id = id; pl.x = q.x; pl.y = q.y; pl.s = 100; pl.on = true; st.t.p = 1; controlsFor(); drawLogo();
    }, 'p:');
    $('#sim-dos-row').hidden = !(fk === 'dos' && back);
    $('#sim-dos-on').checked = st.pl.dos.on;
    $('#sim-places').hidden = !list.length || (fk === 'dos' && !st.pl.dos.on);
    controlsSize();
  }
  function controlsSize() { var fk = currentFace(), pl = st.pl && st.pl[fk]; if (!pl) return; $('#sim-size').value = pl.s; $('#sim-sizeval').textContent = Math.round(pl.s) + ' %'; }
  var lastFk = null;
  function updateRot() { var fk = currentFace(); if (shown.fk && fk !== lastFk) { lastFk = fk; controlsFor(); } }
  function chooseProduct(id) {
    if (id === st.pid) return;
    st.pid = id; st.t.g = 1; st.ci = prod().base; st.angle = 0; if (st.anim) { cancelAnimationFrame(st.anim.id); st.anim = null; }
    initPlaces(); lastFk = null; drawProducts(); drawColors(); controlsFor(); prepare();
    var u = new URL(location.href); u.searchParams.set('produit', id); try { history.replaceState(null, '', u); } catch (e) {}
  }
  $('#sim-dos-on').addEventListener('change', function () { st.pl.dos.on = this.checked; if (this.checked) st.t.p = 1; controlsFor(); drawLogo(); });
  $('#sim-size').addEventListener('input', function () { var fk = currentFace(); if (!st.pl[fk]) return; st.pl[fk].s = +this.value; st.t.p = 1; $('#sim-sizeval').textContent = Math.round(+this.value) + ' %'; drawLogo(); });

  /* ----- résumé + progression ----- */
  function drawSummary() {
    var p = DATA && prod(); if (!p || !st.pl) return;
    var user = !!st.logo && !st.demo;
    $('#sum-g').textContent = p.name; $('#sum-c').textContent = color().name;
    var both = user && st.pl.dos.on && hasBack(p);
    $('#sum-f').textContent = hasBack(p) ? (both ? 'Avant et dos' : (currentFace() === 'dos' ? 'Dos' : 'Avant')) : 'Avant';
    $('#sum-l').textContent = user ? 'Logo personnalisé' : 'Aucun logo';
    var pos = [];
    if (user) { if (st.pl.face.on && p.places.face.length) pos.push(curPlace('face').label + (both ? ' (avant)' : '')); if (both) pos.push(curPlace('dos').label + ' (dos)'); }
    $('#sum-p').textContent = pos.length ? pos.join(' · ') : '—';
    var t = st.t, done = [!!t.g, !!t.c, !!t.f, user, !!(t.p && user)];
    for (var i = 3; i >= 0; i--) if (done[i + 1]) done[i] = true;
    var cur2 = done.indexOf(false), items = document.querySelectorAll('#cfg-steps li');
    for (var k = 0; k < items.length; k++) {
      items[k].classList.toggle('is-done', !!done[k]); items[k].classList.toggle('is-on', k === cur2);
      var a = items[k].querySelector('a'); if (k === cur2) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
    }
    svg.setAttribute('aria-label', 'Aperçu : ' + p.name + ' ' + color().name.toLowerCase() + ', vue ' + (shown.fk === 'dos' ? 'de dos' : shown.fk === 'face' ? 'de face' : 'de côté'));
  }
  function syncLogoUI() {
    var user = !!st.logo && !st.demo; $('#sim-drop').hidden = user; $('#sim-logo-ok').hidden = !user;
    if (user) { $('#sim-thumb').src = st.logo; $('#sim-file-label').textContent = st.logoName; }
  }

  /* ----- fichier logo ----- */
  function err(m) { $('#sim-error').textContent = m || ''; }
  function readFile(f) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(f); }); }
  var srcImg = null;
  function renderLogo(removeBg) {
    var c = document.createElement('canvas'), M = 900, s = Math.min(1, M / Math.max(srcImg.naturalWidth, srcImg.naturalHeight));
    c.width = Math.max(1, Math.round(srcImg.naturalWidth * s)); c.height = Math.max(1, Math.round(srcImg.naturalHeight * s));
    var x = c.getContext('2d'); x.drawImage(srcImg, 0, 0, c.width, c.height);
    if (removeBg) {
      var d = x.getImageData(0, 0, c.width, c.height), px = d.data;
      for (var i = 0; i < px.length; i += 4) { var m = Math.min(px[i], px[i + 1], px[i + 2]); if (m > 235) px[i + 3] = 0; else if (m > 200) px[i + 3] = Math.round(px[i + 3] * (235 - m) / 35); }
      x.putImageData(d, 0, 0);
    }
    var url = c.toDataURL('image/png'); st.logo = url; st.ratio = c.width / c.height;
    var e = new Image(); e.onload = function () { if (st.logo === url) { st.logoEl = e; render(); } }; e.src = url; drawLogo();
  }
  function handleFile(f) {
    err(''); if (!f) return;
    if (!/\.(png|jpe?g|svg|webp)$/i.test(f.name)) return err('Format non accepté : utilisez PNG, JPG, SVG ou WebP.');
    if (f.size > 5 * 1048576) return err('Fichier trop lourd (5 Mo maximum).');
    readFile(f).then(function (url) {
      var im = new Image();
      im.onload = function () {
        srcImg = im; st.demo = false; st.logoName = f.name; st.logoOrig = f.size <= 2 * 1048576 ? url : null;
        var jpg = /\.jpe?g$/i.test(f.name);
        $('#sim-bgopt').hidden = false; $('#sim-nobg').checked = jpg;
        st.sel = true; renderLogo(jpg); controlsFor();
      };
      im.onerror = function () { err('Impossible de lire cette image.'); };
      im.src = url;
    });
  }
  $('#sim-file').addEventListener('change', function (e) { handleFile(e.target.files && e.target.files[0]); });
  var drop = $('#sim-drop');
  drop.addEventListener('click', function () { $('#sim-file').click(); });
  $('#sim-replace').addEventListener('click', function () { $('#sim-file').click(); });
  $('#sim-remove').addEventListener('click', function () {
    srcImg = null; st.demo = true; st.logo = null; st.logoEl = null; st.logoOrig = null; st.logoName = ''; st.sel = false; st.t.p = 0; initPlaces();
    $('#sim-file').value = ''; $('#sim-bgopt').hidden = true; $('#sim-nobg').checked = false; err(''); demoLogo(); render(); controlsFor();
    var d = $('#sim-drop'); if (d && !d.hidden) d.focus();
  });
  ['dragenter', 'dragover'].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.add('is-over'); }); });
  ['dragleave', 'dragend'].forEach(function (n) { drop.addEventListener(n, function () { drop.classList.remove('is-over'); }); });
  drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('is-over'); handleFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });
  $('#sim-nobg').addEventListener('change', function () { if (srcImg) renderLogo(this.checked); });

  /* ----- export (canvas) ----- */
  function drawExportView(x, key, fk, size, offX) {
    var p = prod(), k = size / W;
    x.drawImage(cur[key], offX, 0, size, Math.round(size * H / W));
    if (st.logo && st.logoEl && st.pl[fk].on && p.places[fk].length) {
      var pl = st.pl[fk], q = curPlace(fk), w = q.w * pl.s / 100, h = w / st.ratio; if (h > 430) { h = 430; w = h * st.ratio; }
      x.drawImage(st.logoEl, offX + (pl.x - w / 2) * k, (pl.y - h / 2) * k, w * k, h * k);
    }
  }
  function exportPng(size) {
    return new Promise(function (res, rej) {
      try {
        var p = prod(), both = st.pl.dos.on && hasBack(p), c = document.createElement('canvas');
        c.width = size * (both ? 2 : 1); c.height = Math.round(size * H / W); var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
        drawExportView(x, 'face', 'face', size, 0); if (both) drawExportView(x, 'dos', 'dos', size, size);
        res(c.toDataURL('image/png'));
      } catch (e) { rej(e); }
    });
  }
  $('#sim-download').addEventListener('click', function () {
    exportPng(1200).then(function (u) { var a = document.createElement('a'); a.href = u; a.download = 'apercu-cmr-personnalisation.png'; document.body.appendChild(a); a.click(); a.remove(); }, function () { err('Export impossible sur ce navigateur.'); });
  });
  $('#sim-quote').addEventListener('click', function () {
    exportPng(900).then(function (u) {
      var p = prod(), both = st.pl.dos.on && hasBack(p), pos = [];
      if (st.pl.face.on && p.places.face.length) pos.push(curPlace('face').label + ' (avant)');
      if (both) pos.push(curPlace('dos').label + ' (dos)');
      var data = { mock: u, logo: st.logoOrig, logoName: st.logoName, garment: p.name, color: color().name, face: '', place: pos.join(' et ') };
      try { sessionStorage.setItem('cmr-sim', JSON.stringify(data)); } catch (e) { try { data.logo = null; sessionStorage.setItem('cmr-sim', JSON.stringify(data)); } catch (e2) {} }
      location.href = 'devis.html';
    }, function () { err('Export impossible sur ce navigateur.'); });
  });

  /* ----- démarrage ----- */
  fetch('Assets/produits/produits.json').then(function (r) { return r.json(); }).then(function (d) {
    DATA = d;
    var q = new URLSearchParams(location.search).get('produit');
    if (q && d.products.some(function (p) { return p.id === q; })) st.pid = q;
    st.ci = prod().base; initPlaces(); drawProducts(); drawColors();
    prepare().then(function () { controlsFor(); drawSummary(); setTimeout(spinDemo, 350); });
  }).catch(function () { err('Impossible de charger les produits. Rechargez la page.'); });
})();
