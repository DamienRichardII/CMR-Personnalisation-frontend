/* Simulateur de personnalisation — 100 % côté navigateur : le logo n'est envoyé nulle part. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var $ = function (s) { return document.querySelector(s); };
  var svg = $('#sim-svg'); if (!svg) return;

  /* Couleurs proposées — PLACEHOLDER : à confirmer avec CMR (couleurs réellement disponibles). */
  var COLORS = [
    { id: 'noir', label: 'Noir', hex: '#171b22' }, { id: 'blanc', label: 'Blanc', hex: '#f3f3f1' },
    { id: 'marine', label: 'Bleu marine', hex: '#16294f' }, { id: 'royal', label: 'Bleu roi', hex: '#1f4fd8' },
    { id: 'gris', label: 'Gris chiné', hex: '#8b9099' }, { id: 'rouge', label: 'Rouge', hex: '#b3202a' }
  ];

  /* Silhouettes (viewBox 600 × 640). */
  var TEE = 'M 200 60 L 120 90 L 40 170 L 100 215 L 140 185 L 140 585 Q 140 598 155 598 L 445 598 Q 460 598 460 585 L 460 185 L 500 215 L 560 170 L 480 90 L 400 60 Q 380 98 300 98 Q 220 98 200 60 Z';
  var TEE_BACK = 'M 200 60 L 120 90 L 40 170 L 100 215 L 140 185 L 140 585 Q 140 598 155 598 L 445 598 Q 460 598 460 585 L 460 185 L 500 215 L 560 170 L 480 90 L 400 60 Q 380 78 300 78 Q 220 78 200 60 Z';
  var SWEAT = 'M 205 60 L 120 85 L 52 150 L 28 430 L 104 440 L 140 250 L 140 575 Q 140 592 160 592 L 440 592 Q 460 592 460 575 L 460 250 L 496 440 L 572 430 L 548 150 L 480 85 L 395 60 Q 378 98 300 98 Q 222 98 205 60 Z';
  var SWEAT_BACK = 'M 205 60 L 120 85 L 52 150 L 28 430 L 104 440 L 140 250 L 140 575 Q 140 592 160 592 L 440 592 Q 460 592 460 575 L 460 250 L 496 440 L 572 430 L 548 150 L 480 85 L 395 60 Q 378 82 300 82 Q 222 82 205 60 Z';

  var GARMENTS = {
    tshirt: { label: 'T-shirt', faces: ['face', 'dos'],
      parts: { face: [{ d: TEE, k: 'body' }, { d: 'M 200 60 Q 222 98 300 106 Q 378 98 400 60', k: 'rib' }, { d: 'M 100 215 L 140 185 M 500 215 L 460 185', k: 'line' }],
               dos:  [{ d: TEE_BACK, k: 'body' }, { d: 'M 200 60 Q 300 84 400 60', k: 'rib' }, { d: 'M 100 215 L 140 185 M 500 215 L 460 185', k: 'line' }] },
      places: { face: [{ id: 'pg', label: 'Poitrine gauche', x: 372, y: 215, w: 92 }, { id: 'cp', label: 'Centre poitrine', x: 300, y: 262, w: 210 }, { id: 'gf', label: 'Grand format', x: 300, y: 330, w: 290 }],
                dos:  [{ id: 'hd', label: 'Haut du dos', x: 300, y: 190, w: 170 }, { id: 'cd', label: 'Centre du dos', x: 300, y: 310, w: 290 }] } },
    sweat: { label: 'Sweat', faces: ['face', 'dos'],
      parts: { face: [{ d: SWEAT, k: 'body' }, { d: 'M 205 60 Q 222 100 300 108 Q 378 100 395 60', k: 'rib' }, { d: 'M 140 560 L 460 560 M 28 430 L 104 440 M 572 430 L 496 440', k: 'line' }, { d: 'M 140 560 L 460 560 L 460 575 Q 460 592 440 592 L 160 592 Q 140 592 140 575 Z', k: 'rib' }],
               dos:  [{ d: SWEAT_BACK, k: 'body' }, { d: 'M 205 60 Q 300 88 395 60', k: 'rib' }, { d: 'M 140 560 L 460 560 L 460 575 Q 460 592 440 592 L 160 592 Q 140 592 140 575 Z', k: 'rib' }] },
      places: { face: [{ id: 'pg', label: 'Poitrine gauche', x: 372, y: 215, w: 92 }, { id: 'cp', label: 'Centre poitrine', x: 300, y: 262, w: 210 }, { id: 'gf', label: 'Grand format', x: 300, y: 330, w: 290 }],
                dos:  [{ id: 'hd', label: 'Haut du dos', x: 300, y: 190, w: 170 }, { id: 'cd', label: 'Centre du dos', x: 300, y: 310, w: 290 }] } },
    polo: { label: 'Polo', faces: ['face', 'dos'],
      parts: { face: [{ d: TEE, k: 'body' }, { d: 'M 200 60 L 255 70 L 285 150 L 262 118 Z', k: 'rib' }, { d: 'M 400 60 L 345 70 L 315 150 L 338 118 Z', k: 'rib' }, { d: 'M 285 150 L 315 150 L 315 300 L 285 300 Z', k: 'rib' }, { d: 'M 100 215 L 140 185 M 500 215 L 460 185', k: 'line' }, { d: 'M 300 150 L 300 300', k: 'line' }, { d: 'CIRC 300 185 3|CIRC 300 225 3|CIRC 300 265 3', k: 'dots' }],
               dos:  [{ d: TEE_BACK, k: 'body' }, { d: 'M 200 60 Q 300 84 400 60 L 400 72 Q 300 98 200 72 Z', k: 'rib' }, { d: 'M 100 215 L 140 185 M 500 215 L 460 185', k: 'line' }] },
      places: { face: [{ id: 'pg', label: 'Poitrine gauche', x: 375, y: 225, w: 80 }, { id: 'pd', label: 'Poitrine droite', x: 225, y: 225, w: 80 }, { id: 'cb', label: 'Centre bas', x: 300, y: 380, w: 190 }],
                dos:  [{ id: 'hd', label: 'Haut du dos', x: 300, y: 190, w: 170 }, { id: 'cd', label: 'Centre du dos', x: 300, y: 310, w: 280 }] } },
    casquette: { label: 'Casquette', faces: ['face'],
      parts: { face: [{ d: 'M 110 370 Q 110 120 300 120 Q 490 120 490 370 Z', k: 'body' }, { d: 'M 300 120 L 300 370 M 205 135 Q 175 250 182 370 M 395 135 Q 425 250 418 370', k: 'line' }, { d: 'M 80 372 Q 300 338 520 372 Q 540 450 300 470 Q 60 450 80 372 Z', k: 'visor' }, { d: 'CIRC 300 118 9', k: 'dots' }] },
      places: { face: [{ id: 'fa', label: 'Face avant', x: 300, y: 250, w: 150 }, { id: 'fg', label: 'Face avant (grand)', x: 300, y: 255, w: 210 }] } }
  };
  var FACE_LABEL = { face: 'Devant', dos: 'Dos' };

  var st = { g: 'tshirt', c: 'noir', f: 'face', place: null, x: 300, y: 260, scale: 100, logo: null, logoOrig: null, logoName: '', ratio: 1 };

  function mix(hex, to, t) {
    var a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
    var r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t), g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t), bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }
  function el(tag, attrs, parent) { var n = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); }); if (parent) parent.appendChild(n); return n; }
  function color() { return COLORS.filter(function (c) { return c.id === st.c; })[0]; }
  function garment() { return GARMENTS[st.g]; }
  function places() { return garment().places[st.f]; }
  function place() { return places().filter(function (p) { return p.id === st.place; })[0] || places()[0]; }

  /* ----- vêtement ----- */
  function drawGarment() {
    var g = $('#sim-garment'); while (g.firstChild) g.removeChild(g.firstChild);
    var hex = color().hex, dark = mix(hex, '#000000', 0.2), edge = mix(hex, '#000000', 0.38);
    var light = (st.c === 'blanc');
    garment().parts[st.f].forEach(function (p) {
      if (p.k === 'body') {
        el('path', { d: p.d, fill: hex, stroke: edge, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
        el('path', { d: p.d, fill: 'url(#sim-shade)' }, g); el('path', { d: p.d, fill: 'url(#sim-light)' }, g);
      } else if (p.k === 'rib') { el('path', { d: p.d, fill: dark, stroke: edge, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }, g); }
      else if (p.k === 'visor') { el('path', { d: p.d, fill: dark, stroke: edge, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g); el('path', { d: p.d, fill: 'url(#sim-light)' }, g); }
      else if (p.k === 'line') { el('path', { d: p.d, fill: 'none', stroke: light ? 'rgba(0,0,0,.22)' : 'rgba(0,0,0,.35)', 'stroke-width': 1.5, 'stroke-linecap': 'round' }, g); }
      else if (p.k === 'dots') { p.d.split('|').forEach(function (c) { var q = c.split(' '); el('circle', { cx: q[1], cy: q[2], r: q[3], fill: dark, stroke: edge, 'stroke-width': 1 }, g); }); }
    });
  }

  /* ----- logo ----- */
  function drawLogo() {
    var lg = $('#sim-logo'); while (lg.firstChild) lg.removeChild(lg.firstChild);
    var has = !!st.logo; if (has) lg.removeAttribute('hidden'); else lg.setAttribute('hidden', ''); $('#sim-empty').hidden = has;
    ['#sim-download', '#sim-quote'].forEach(function (s) { $(s).disabled = !has; });
    $('#sim-place-group').disabled = !has;
    if (!has) return;
    var p = place(), w = p.w * st.scale / 100, h = w / st.ratio, maxH = 330;
    if (h > maxH) { h = maxH; w = h * st.ratio; }
    var im = el('image', { href: st.logo, x: st.x - w / 2, y: st.y - h / 2, width: w, height: h, preserveAspectRatio: 'xMidYMid meet' }, lg);
    im.setAttribute('crossorigin', 'anonymous');
    el('rect', { class: 'sim-frame', x: st.x - w / 2 - 4, y: st.y - h / 2 - 4, width: w + 8, height: h + 8, rx: 6, fill: 'none' }, lg);
  }
  function resetPlace() { var p = place(); st.place = p.id; st.x = p.x; st.y = p.y; st.scale = 100; $('#sim-size').value = 100; }

  /* ----- commandes ----- */
  function chips(box, items, current, onPick, fmt) {
    box.textContent = '';
    items.forEach(function (it) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'sim-chip' + (it.id === current ? ' is-on' : ''); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', it.id === current ? 'true' : 'false');
      b.textContent = fmt ? fmt(it) : it.label; b.addEventListener('click', function () { onPick(it.id); }); box.appendChild(b);
    });
  }
  function drawControls() {
    chips($('#sim-garments'), Object.keys(GARMENTS).map(function (k) { return { id: k, label: GARMENTS[k].label }; }), st.g, function (id) { st.g = id; if (GARMENTS[id].faces.indexOf(st.f) < 0) st.f = 'face'; resetPlace(); refresh(); });
    var cs = $('#sim-colors'); cs.textContent = '';
    COLORS.forEach(function (c) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'sim-swatch' + (c.id === st.c ? ' is-on' : ''); b.style.background = c.hex; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', c.id === st.c ? 'true' : 'false'); b.setAttribute('aria-label', c.label); b.title = c.label;
      b.addEventListener('click', function () { st.c = c.id; refresh(); }); cs.appendChild(b);
    });
    $('#sim-colorname').textContent = color().label;
    var fg = $('#sim-face-group'); fg.hidden = garment().faces.length < 2;
    chips($('#sim-faces'), garment().faces.map(function (f) { return { id: f, label: FACE_LABEL[f] }; }), st.f, function (id) { st.f = id; resetPlace(); refresh(); });
    chips($('#sim-places'), places(), st.place, function (id) { st.place = id; var p = place(); st.x = p.x; st.y = p.y; st.scale = 100; $('#sim-size').value = 100; refresh(); });
  }
  function refresh() { drawGarment(); drawLogo(); drawControls(); }

  /* ----- fichier logo ----- */
  function err(m) { $('#sim-error').textContent = m || ''; }
  function readFile(f) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(f); }); }
  var srcImg = null, origIsOpaque = false;
  function render(removeBg) {
    var c = document.createElement('canvas'), M = 900, s = Math.min(1, M / Math.max(srcImg.naturalWidth, srcImg.naturalHeight));
    c.width = Math.max(1, Math.round(srcImg.naturalWidth * s)); c.height = Math.max(1, Math.round(srcImg.naturalHeight * s));
    var x = c.getContext('2d'); x.drawImage(srcImg, 0, 0, c.width, c.height);
    if (removeBg) {
      var d = x.getImageData(0, 0, c.width, c.height), px = d.data;
      for (var i = 0; i < px.length; i += 4) { var m = Math.min(px[i], px[i + 1], px[i + 2]); if (m > 235) px[i + 3] = 0; else if (m > 200) px[i + 3] = Math.round(px[i + 3] * (235 - m) / 35); }
      x.putImageData(d, 0, 0);
    }
    st.logo = c.toDataURL('image/png'); st.ratio = c.width / c.height; drawLogo();
  }
  $('#sim-file').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; err(''); if (!f) return;
    if (!/\.(png|jpe?g|svg|webp)$/i.test(f.name)) return err('Format non accepté : utilisez PNG, JPG, SVG ou WebP.');
    if (f.size > 5 * 1048576) return err('Fichier trop lourd (5 Mo maximum).');
    readFile(f).then(function (url) {
      var im = new Image();
      im.onload = function () {
        srcImg = im; st.logoName = f.name; st.logoOrig = f.size <= 2 * 1048576 ? url : null;
        origIsOpaque = /\.jpe?g$/i.test(f.name);
        $('#sim-bgopt').hidden = false; $('#sim-nobg').checked = origIsOpaque;
        $('#sim-file-label').textContent = f.name;
        if (!st.place) resetPlace();
        render(origIsOpaque); refresh();
      };
      im.onerror = function () { err('Impossible de lire cette image.'); };
      im.src = url;
    });
  });
  $('#sim-nobg').addEventListener('change', function () { if (srcImg) render(this.checked); });
  $('#sim-size').addEventListener('input', function () { st.scale = +this.value; drawLogo(); });

  /* ----- glisser / clavier ----- */
  var drag = null;
  function pt(ev) { var r = svg.getBoundingClientRect(), k = 600 / r.width; return { x: (ev.clientX - r.left) * k, y: (ev.clientY - r.top) * k }; }
  var lgEl = $('#sim-logo');
  lgEl.addEventListener('pointerdown', function (ev) { if (!st.logo) return; var p = pt(ev); drag = { dx: st.x - p.x, dy: st.y - p.y }; lgEl.setPointerCapture(ev.pointerId); lgEl.classList.add('is-drag'); ev.preventDefault(); });
  lgEl.addEventListener('pointermove', function (ev) { if (!drag) return; var p = pt(ev); st.x = Math.max(40, Math.min(560, p.x + drag.dx)); st.y = Math.max(40, Math.min(600, p.y + drag.dy)); drawLogo(); });
  ['pointerup', 'pointercancel'].forEach(function (n) { lgEl.addEventListener(n, function () { drag = null; lgEl.classList.remove('is-drag'); }); });
  lgEl.addEventListener('keydown', function (ev) {
    var s = ev.shiftKey ? 12 : 4, k = ev.key, ch = true;
    if (k === 'ArrowLeft') st.x -= s; else if (k === 'ArrowRight') st.x += s; else if (k === 'ArrowUp') st.y -= s; else if (k === 'ArrowDown') st.y += s;
    else if (k === '+' || k === '=') st.scale = Math.min(160, st.scale + 4); else if (k === '-') st.scale = Math.max(40, st.scale - 4); else ch = false;
    if (ch) { ev.preventDefault(); $('#sim-size').value = st.scale; drawLogo(); }
  });
  /* le focus clavier doit rester sur le logo : drawLogo() ne recrée que son contenu */

  /* ----- export ----- */
  function exportPng(size) {
    return new Promise(function (res, rej) {
      var clone = svg.cloneNode(true); clone.setAttribute('xmlns', NS); clone.setAttribute('width', size); clone.setAttribute('height', Math.round(size * 640 / 600));
      var fr = clone.querySelector('.sim-frame'); if (fr) fr.parentNode.removeChild(fr);
      var bg = clone.querySelector('#sim-bg'); bg.setAttribute('fill', '#eef1f6');
      var lg = clone.querySelector('#sim-logo'); lg.removeAttribute('hidden');
      var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
      var im = new Image();
      im.onload = function () { var c = document.createElement('canvas'); c.width = size; c.height = Math.round(size * 640 / 600); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/png')); };
      im.onerror = rej; im.src = url;
    });
  }
  $('#sim-download').addEventListener('click', function () {
    exportPng(1200).then(function (u) { var a = document.createElement('a'); a.href = u; a.download = 'apercu-cmr-personnalisation.png'; document.body.appendChild(a); a.click(); a.remove(); }, function () { err('Export impossible sur ce navigateur.'); });
  });
  $('#sim-quote').addEventListener('click', function () {
    exportPng(900).then(function (u) {
      var data = { mock: u, logo: st.logoOrig, logoName: st.logoName, garment: garment().label, color: color().label, face: FACE_LABEL[st.f], place: place().label };
      try { sessionStorage.setItem('cmr-sim', JSON.stringify(data)); } catch (e) { try { data.logo = null; sessionStorage.setItem('cmr-sim', JSON.stringify(data)); } catch (e2) {} }
      location.href = 'devis.html';
    }, function () { err('Export impossible sur ce navigateur.'); });
  });

  st.place = place().id; st.x = place().x; st.y = place().y; refresh();
})();
