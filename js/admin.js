/* CMR Personnalisation — espace d'administration (vanilla JS + supabase-js hébergé localement).
   La sécurité réelle repose sur les règles RLS de la base : seuls les e-mails de la table "admins"
   (comptes vérifiés) peuvent lire/écrire. Ce fichier ne contient aucun secret. */
(function () {
  'use strict';

  var cfg = window.CMR_SUPABASE;
  var sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true } });
  var app = document.getElementById('app');
  var toasts = document.getElementById('toasts');
  var session = null;
  var counts = { demandes: 0, messages: 0 };
  var recovering = false;

  /* ============================== Utilitaires ============================== */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function toast(msg, kind) {
    var t = h('div', { class: 'toast ' + (kind || ''), text: msg });
    toasts.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, kind === 'err' ? 6000 : 3200);
  }
  function fmtDate(d, withTime) {
    if (!d) return '—';
    var o = new Date(d);
    if (isNaN(o)) return '—';
    var opt = withTime ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', year: 'numeric' };
    return o.toLocaleString('fr-FR', opt);
  }
  function fmtMoney(n) { return n == null || n === '' ? '—' : Number(n).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }); }
  function clip(s, n) { s = s || ''; return s.length > n ? s.slice(0, n) + '…' : s; }
  function norm(s) { return String(s == null ? '' : s).toLowerCase(); }
  function errText(e) { return (e && (e.message || e.error_description)) || 'Erreur inconnue'; }
  function img(u) { return !u ? '' : (/^(https?:|data:)/.test(u) ? u : '../' + u.replace(/^\//, '')); }

  var DEMANDE_STATUTS = [['nouvelle', 'Nouvelle'], ['en_cours', 'En cours'], ['devis_envoye', 'Devis envoyé'], ['gagnee', 'Gagnée'], ['perdue', 'Perdue'], ['archivee', 'Archivée']];
  var COMMANDE_STATUTS = [['a_lancer', 'À lancer'], ['en_production', 'En production'], ['pret', 'Prête'], ['livre', 'Livrée'], ['annulee', 'Annulée']];
  function label(list, v) { var f = list.filter(function (x) { return x[0] === v; })[0]; return f ? f[1] : v; }
  function pill(list, v) { return h('span', { class: 'pill s-' + v, text: label(list, v) }); }

  /* ============================== Fenêtre modale ============================== */
  var openModals = [];
  function openModal(o) {
    var back = h('div', { class: 'modal-back' });
    var body = h('div', { class: 'modal-b' });
    var close = function () { if (back.parentNode) back.parentNode.removeChild(back); openModals = openModals.filter(function (m) { return m !== api; }); if (o.onClose) o.onClose(); };
    var xb = h('button', { class: 'x-btn', type: 'button', 'aria-label': 'Fermer', onclick: close, text: '×' });
    var left = h('div', { class: 'grp' }), right = h('div', { class: 'grp' });
    var modal = h('div', { class: 'modal' + (o.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title },
      h('div', { class: 'modal-h' }, h('h2', { text: o.title }), xb), body,
      o.noFooter ? null : h('div', { class: 'modal-f' }, left, right));
    back.appendChild(modal);
    back.addEventListener('mousedown', function (e) { if (e.target === back) close(); });
    document.body.appendChild(back);
    var api = { el: modal, body: body, left: left, right: right, close: close, back: back };
    openModals.push(api);
    setTimeout(function () { var f = body.querySelector('input,select,textarea,button'); if (f) f.focus(); }, 30);
    return api;
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openModals.length) openModals[openModals.length - 1].close();
  });
  function confirmBox(msg) { return Promise.resolve(window.confirm(msg)); }

  /* ============================== Formulaires ============================== */
  function field(f, value) {
    var id = 'f-' + f.name, ctrl, wrap = h('div', { class: 'fld' + (f.full ? ' full' : '') });
    var lab = h('label', { for: id, text: f.label + (f.required ? ' *' : '') });
    if (f.type === 'textarea') ctrl = h('textarea', { class: 'ta', id: id, name: f.name, rows: f.rows || 4 });
    else if (f.type === 'select') {
      ctrl = h('select', { class: 'sel', id: id, name: f.name }, f.options.map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
    } else if (f.type === 'checkbox') {
      ctrl = h('input', { type: 'checkbox', id: id, name: f.name });
      ctrl.checked = !!value;
      wrap.appendChild(h('label', { for: id, style: 'display:flex;gap:8px;align-items:center;font-size:.9rem;color:inherit' }, ctrl, f.label));
      return { wrap: wrap, ctrl: ctrl, get: function () { return ctrl.checked; } };
    } else {
      ctrl = h('input', { class: 'in', id: id, name: f.name, type: f.type || 'text' });
      if (f.type === 'number') { if (f.min != null) ctrl.min = f.min; ctrl.step = f.step || '1'; }
      if (f.maxlength) ctrl.maxLength = f.maxlength;
    }
    if (f.required) ctrl.required = true;
    if (f.readonly) { ctrl.disabled = true; }
    ctrl.value = value == null ? '' : value;
    wrap.appendChild(lab); wrap.appendChild(ctrl);
    if (f.hint) wrap.appendChild(h('div', { class: 'hint', text: f.hint }));
    return {
      wrap: wrap, ctrl: ctrl, get: function () {
        var v = ctrl.value.trim();
        if (f.type === 'number') return v === '' ? null : Number(v);
        return v === '' ? null : v;
      }
    };
  }
  /* Construit un formulaire dans un conteneur ; retourne collect() */
  function buildForm(fields, values) {
    var grid = h('div', { class: 'fgrid' }), refs = {};
    fields.forEach(function (f) {
      if (f.custom) { var c = f.custom(values && values[f.name]); refs[f.name] = c; grid.appendChild(c.wrap); return; }
      var r = field(f, values && values[f.name]); refs[f.name] = r; grid.appendChild(r.wrap);
    });
    return {
      el: grid,
      collect: function () { var out = {}; fields.forEach(function (f) { out[f.name] = refs[f.name].get(); }); return out; },
      validate: function () {
        for (var i = 0; i < fields.length; i++) {
          var f = fields[i];
          if (f.required && (refs[f.name].get() == null || refs[f.name].get() === '')) return f.label + ' est obligatoire.';
        }
        return null;
      }
    };
  }
  function formModal(o) {
    var m = openModal({ title: o.title, wide: o.wide });
    var form = buildForm(o.fields, o.values || {});
    var err = h('div', { class: 'err-msg', hidden: true });
    if (o.intro) m.body.appendChild(o.intro);
    m.body.appendChild(form.el); m.body.appendChild(err);
    var save = h('button', { class: 'btn-a', type: 'button', text: o.saveLabel || 'Enregistrer' });
    var cancel = h('button', { class: 'btn-a ghost', type: 'button', text: 'Annuler', onclick: m.close });
    m.right.appendChild(cancel); m.right.appendChild(save);
    if (o.onDelete) m.left.appendChild(h('button', {
      class: 'btn-a danger', type: 'button', text: 'Supprimer', onclick: function () {
        confirmBox(o.deleteMsg || 'Supprimer définitivement cet élément ?').then(function (ok) {
          if (!ok) return;
          o.onDelete().then(function (e) { if (e) { err.hidden = false; err.textContent = errText(e); } else m.close(); });
        });
      }
    }));
    (o.extraLeft || []).forEach(function (b) { m.left.appendChild(b); });
    save.addEventListener('click', function () {
      var v = form.validate();
      if (v) { err.hidden = false; err.textContent = v; return; }
      err.hidden = true; save.disabled = true;
      Promise.resolve(o.onSave(form.collect())).then(function (e) {
        if (e) { err.hidden = false; err.textContent = errText(e); save.disabled = false; } else m.close();
      }).catch(function (e) { err.hidden = false; err.textContent = errText(e); save.disabled = false; });
    });
    return m;
  }

  /* ============================== Médias (téléversement) ============================== */
  function slug(s) { return String(s).toLowerCase().replace(/\.[^.]+$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'image'; }
  function toWebp(file) {
    return new Promise(function (resolve) {
      if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) { resolve({ blob: file, ext: (file.name.split('.').pop() || 'bin').toLowerCase(), type: file.type }); return; }
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var max = 1600, r = Math.min(1, max / Math.max(im.width, im.height));
        var c = document.createElement('canvas'); c.width = Math.round(im.width * r); c.height = Math.round(im.height * r);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        c.toBlob(function (b) {
          URL.revokeObjectURL(url);
          if (b) resolve({ blob: b, ext: 'webp', type: 'image/webp' }); else resolve({ blob: file, ext: (file.name.split('.').pop() || 'jpg').toLowerCase(), type: file.type });
        }, 'image/webp', 0.86);
      };
      im.onerror = function () { URL.revokeObjectURL(url); resolve({ blob: file, ext: (file.name.split('.').pop() || 'jpg').toLowerCase(), type: file.type }); };
      im.src = url;
    });
  }
  function uploadImage(file) {
    if (file.size > 15 * 1048576) return Promise.reject(new Error('« ' + file.name + ' » est trop lourd (15 Mo max avant optimisation).'));
    return toWebp(file).then(function (r) {
      if (r.blob.size > 5 * 1048576) throw new Error('« ' + file.name + ' » dépasse 5 Mo après optimisation.');
      var path = 'uploads/' + slug(file.name) + '-' + Date.now().toString(36) + '.' + r.ext;
      return sb.storage.from('site-medias').upload(path, r.blob, { contentType: r.type, upsert: false }).then(function (res) {
        if (res.error) throw res.error;
        return sb.storage.from('site-medias').getPublicUrl(path).data.publicUrl;
      });
    });
  }
  function listMedias() {
    return sb.storage.from('site-medias').list('uploads', { limit: 300, sortBy: { column: 'created_at', order: 'desc' } }).then(function (r) {
      if (r.error) throw r.error;
      return (r.data || []).filter(function (f) { return f.name && f.id; }).map(function (f) {
        return { name: f.name, path: 'uploads/' + f.name, url: sb.storage.from('site-medias').getPublicUrl('uploads/' + f.name).data.publicUrl, size: f.metadata && f.metadata.size, created: f.created_at };
      });
    });
  }
  function pickMedia() {
    return new Promise(function (resolve) {
      var done = false, m = openModal({ title: 'Choisir dans la médiathèque', wide: true, noFooter: true, onClose: function () { if (!done) resolve(null); } });
      m.body.appendChild(h('p', { class: 'muted', text: 'Chargement…' }));
      listMedias().then(function (items) {
        clear(m.body);
        if (!items.length) { m.body.appendChild(h('div', { class: 'empty-a', text: 'Aucune image. Ajoutez-en depuis l\'onglet Médias.' })); return; }
        var grid = h('div', { class: 'media-grid' });
        items.forEach(function (it) {
          grid.appendChild(h('div', { class: 'card-a media pick', tabindex: '0', role: 'button', 'aria-label': 'Choisir ' + it.name, onclick: choose, onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } } },
            h('img', { src: it.url, alt: '', loading: 'lazy' }), h('div', { class: 'm-b' }, h('div', { class: 'm-n', text: it.name }))));
          function choose() { done = true; m.close(); resolve(it.url); }
        });
        m.body.appendChild(grid);
      }).catch(function (e) { clear(m.body); m.body.appendChild(h('div', { class: 'err-msg', text: errText(e) })); });
    });
  }

  /* ============================== Authentification ============================== */
  function renderLogin(msg, mode) {
    clear(app);
    var email = h('input', { class: 'in', type: 'email', id: 'l-email', autocomplete: 'username', required: true });
    var pass = h('input', { class: 'in', type: 'password', id: 'l-pass', autocomplete: mode === 'recovery' ? 'new-password' : 'current-password', required: true, minlength: mode === 'recovery' ? 8 : null });
    var err = h('div', { class: 'err-msg', hidden: !msg, text: msg || '' });
    var btn = h('button', { class: 'btn-a', type: 'submit', style: 'width:100%;margin-top:14px', text: mode === 'recovery' ? 'Enregistrer le mot de passe' : 'Se connecter' });
    var form = h('form', { novalidate: true },
      mode === 'recovery' ? null : h('div', { class: 'fld' }, h('label', { for: 'l-email', text: 'Adresse e-mail' }), email),
      h('div', { class: 'fld', style: mode === 'recovery' ? '' : 'margin-top:12px' }, h('label', { for: 'l-pass', text: mode === 'recovery' ? 'Nouveau mot de passe (8 caractères minimum)' : 'Mot de passe' }), pass),
      err, btn);
    form.addEventListener('submit', function (e) {
      e.preventDefault(); err.hidden = true; btn.disabled = true;
      var p;
      if (mode === 'recovery') {
        if (pass.value.length < 8) { err.hidden = false; err.textContent = 'Le mot de passe doit contenir au moins 8 caractères.'; btn.disabled = false; return; }
        p = sb.auth.updateUser({ password: pass.value }).then(function (r) { if (r.error) throw r.error; toast('Mot de passe mis à jour.', 'ok'); recovering = false; return start(); });
      } else {
        p = sb.auth.signInWithPassword({ email: email.value.trim(), password: pass.value }).then(function (r) {
          if (r.error) throw new Error('Identifiants incorrects.');
          return start();
        });
      }
      p.catch(function (x) { err.hidden = false; err.textContent = errText(x); btn.disabled = false; });
    });
    var forgot = mode === 'recovery' ? null : h('button', {
      class: 'btn-a ghost sm', type: 'button', style: 'margin:14px auto 0;display:flex', text: 'Mot de passe oublié', onclick: function () {
        if (!email.value.trim()) { err.hidden = false; err.textContent = 'Saisissez d\'abord votre adresse e-mail.'; return; }
        sb.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: location.origin + location.pathname }).then(function () {
          toast('Si ce compte existe, un e-mail de réinitialisation vient d\'être envoyé.', 'ok');
        });
      }
    });
    app.appendChild(h('div', { class: 'login' }, h('div', { class: 'login-card' },
      h('img', { src: '../Assets/img/logo-blanc.png', alt: 'CMR Personnalisation', class: 'only-dark', width: '150', height: '60' }),
      h('img', { src: '../Assets/img/logo-noir.png', alt: 'CMR Personnalisation', class: 'only-light', width: '150', height: '60' }),
      h('h1', { text: mode === 'recovery' ? 'Nouveau mot de passe' : 'Espace administration' }),
      h('p', { class: 'sub', text: mode === 'recovery' ? 'Choisissez votre nouveau mot de passe.' : 'Accès réservé à l\'équipe CMR Personnalisation.' }),
      form, forgot)));
    setTimeout(function () { (mode === 'recovery' ? pass : email).focus(); }, 30);
  }
  function renderDenied() {
    clear(app);
    app.appendChild(h('div', { class: 'login' }, h('div', { class: 'login-card' },
      h('h1', { text: 'Accès refusé' }),
      h('p', { class: 'sub', text: 'Ce compte n\'a pas les droits d\'administration. Contactez DamCompany pour être ajouté.' }),
      h('button', { class: 'btn-a', style: 'width:100%', type: 'button', text: 'Se déconnecter', onclick: logout }))));
  }
  function logout() { sb.auth.signOut().then(function () { session = null; renderLogin(); }); }

  function start() {
    return sb.auth.getSession().then(function (r) {
      session = r.data && r.data.session;
      if (recovering) return;
      if (!session) { renderLogin(); return; }
      return sb.rpc('is_admin').then(function (a) {
        if (a.error || a.data !== true) { renderDenied(); return; }
        return refreshCounts().then(renderShell);
      });
    });
  }
  function refreshCounts() {
    return Promise.all([
      sb.from('demandes_devis').select('id', { count: 'exact', head: true }).eq('statut', 'nouvelle'),
      sb.from('messages_contact').select('id', { count: 'exact', head: true }).eq('traite', false)
    ]).then(function (r) { counts.demandes = r[0].count || 0; counts.messages = r[1].count || 0; updateBadges(); });
  }
  function updateBadges() {
    var b = document.getElementById('badge-demandes');
    if (b) { var n = counts.demandes + counts.messages; b.textContent = n; b.hidden = !n; }
  }

  /* ============================== Coquille + routeur ============================== */
  var ROUTES = [
    ['dashboard', 'Tableau de bord'], ['demandes', 'Demandes'], ['commandes', 'Commandes'], ['stock', 'Stock'],
    ['realisations', 'Réalisations'], ['contenus', 'Contenus du site'], ['medias', 'Médias']
  ];
  var VIEWS = {};
  function renderShell() {
    clear(app);
    var side = h('nav', { class: 'side', 'aria-label': 'Navigation administration', id: 'side' },
      h('div', { class: 'brand' },
        h('img', { src: '../Assets/img/logo-blanc.png', alt: 'CMR Personnalisation', class: 'only-dark', width: '130', height: '52' }),
        h('img', { src: '../Assets/img/logo-noir.png', alt: 'CMR Personnalisation', class: 'only-light', width: '130', height: '52' }),
        h('small', { text: 'Administration' })),
      ROUTES.map(function (r) {
        return h('a', { class: 'nav-i', href: '#/' + r[0], 'data-r': r[0], onclick: function () { side.classList.remove('open'); } }, h('span', { text: r[1] }),
          r[0] === 'demandes' ? h('span', { class: 'badge', id: 'badge-demandes', hidden: true, text: '0' }) : null);
      }),
      h('div', { class: 'spacer' }),
      h('button', { class: 'nav-i', type: 'button', text: 'Voir le site', onclick: function () { window.open('../index.html', '_blank'); } }),
      h('button', { class: 'nav-i', type: 'button', id: 'theme-btn', text: 'Changer de thème', onclick: function () {
        var n = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', n);
        try { localStorage.setItem('cmr-theme', n); } catch (e) {}
      } }),
      h('div', { class: 'who', text: session.user.email }),
      h('button', { class: 'nav-i', type: 'button', text: 'Déconnexion', onclick: logout }));
    var main = h('main', { class: 'main', id: 'main' });
    app.appendChild(h('div', { class: 'shell' }, side, main));
    updateBadges();
    window.removeEventListener('hashchange', route);
    window.addEventListener('hashchange', route);
    route();
  }
  function route() {
    var main = document.getElementById('main');
    if (!main) return;
    var r = (location.hash.replace(/^#\//, '') || 'dashboard').split('?')[0];
    if (!VIEWS[r]) r = 'dashboard';
    Array.prototype.forEach.call(document.querySelectorAll('.nav-i[data-r]'), function (a) {
      if (a.getAttribute('data-r') === r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    clear(main);
    var title = ROUTES.filter(function (x) { return x[0] === r; })[0][1];
    document.title = title + ' | Administration CMR';
    var actions = h('div', { class: 'actions' });
    main.appendChild(h('div', { class: 'top' },
      h('div', { style: 'display:flex;align-items:center;gap:10px' },
        h('button', { class: 'btn-a ghost sm menu-btn', type: 'button', 'aria-label': 'Menu', text: '☰', onclick: function () { document.getElementById('side').classList.toggle('open'); } }),
        h('h1', { text: title })), actions));
    var box = h('div'); main.appendChild(box);
    box.appendChild(h('p', { class: 'muted', text: 'Chargement…' }));
    VIEWS[r](box, actions).catch(function (e) { clear(box); box.appendChild(h('div', { class: 'err-msg', text: 'Erreur : ' + errText(e) })); });
  }
  function reload() { route(); refreshCounts(); }
  function tableOf(cols, rows, onRow) {
    var thead = h('tr', null, cols.map(function (c) { return h('th', { class: c.num ? 'num' : '', text: c.label }); }));
    var tbody = h('tbody');
    rows.forEach(function (row) {
      var tr = h('tr', onRow ? { class: 'row-click', tabindex: '0', onclick: function () { onRow(row); }, onkeydown: function (e) { if (e.key === 'Enter') onRow(row); } } : null,
        cols.map(function (c) { var v = c.cell(row); return h('td', { class: (c.num ? 'num ' : '') + (c.muted ? 'muted' : '') }, v); }));
      tbody.appendChild(tr);
    });
    return h('div', { class: 'card-a tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', null, thead), tbody));
  }
  function ensure(res) { if (res.error) throw res.error; return res.data; }

  /* ============================== Tableau de bord ============================== */
  VIEWS.dashboard = function (box) {
    return Promise.all([
      sb.from('demandes_devis').select('id,created_at,prenom,nom,entreprise,besoin,statut', { count: 'exact' }).order('created_at', { ascending: false }).limit(6),
      sb.from('commandes').select('id', { count: 'exact', head: true }).in('statut', ['a_lancer', 'en_production', 'pret']),
      sb.from('stock_items').select('id,nom,quantite,seuil_alerte'),
      sb.from('messages_contact').select('id', { count: 'exact', head: true }).eq('traite', false),
      sb.from('demandes_devis').select('id', { count: 'exact', head: true }).eq('statut', 'nouvelle')
    ]).then(function (r) {
      var recents = ensure(r[0]), enCours = r[1].count || 0, stock = ensure(r[2]), msgs = r[3].count || 0, nouvelles = r[4].count || 0;
      var low = stock.filter(function (s) { return s.seuil_alerte > 0 && s.quantite <= s.seuil_alerte; });
      clear(box);
      function stat(n, t, href, warn) { return h('div', { class: 'card-a stat-a' + (warn && n ? ' warn' : '') }, h('a', { href: href }, h('b', { text: n }), h('span', { text: t }))); }
      box.appendChild(h('div', { class: 'stats-a' },
        stat(nouvelles, 'Nouvelles demandes de devis', '#/demandes'),
        stat(msgs, 'Messages à traiter', '#/demandes'),
        stat(enCours, 'Commandes en cours', '#/commandes'),
        stat(low.length, 'Articles sous le seuil d\'alerte', '#/stock', true)));
      box.appendChild(h('h3', { class: 'sec', text: 'Dernières demandes' }));
      if (!recents.length) box.appendChild(h('div', { class: 'card-a empty-a', text: 'Aucune demande pour le moment.' }));
      else box.appendChild(tableOf([
        { label: 'Date', cell: function (d) { return fmtDate(d.created_at); }, muted: true },
        { label: 'Client', cell: function (d) { return [d.prenom, d.nom].filter(Boolean).join(' ') || d.entreprise || '—'; } },
        { label: 'Besoin', cell: function (d) { return d.besoin || '—'; }, muted: true },
        { label: 'Statut', cell: function (d) { return pill(DEMANDE_STATUTS, d.statut); } }
      ], recents, function () { location.hash = '#/demandes'; }));
      if (low.length) {
        box.appendChild(h('h3', { class: 'sec', text: 'Stock à réapprovisionner' }));
        box.appendChild(tableOf([
          { label: 'Article', cell: function (s) { return s.nom; } },
          { label: 'Quantité', num: true, cell: function (s) { return s.quantite; } },
          { label: 'Seuil', num: true, cell: function (s) { return s.seuil_alerte; }, muted: true }
        ], low, function () { location.hash = '#/stock'; }));
      }
    });
  };

  /* ============================== Demandes (devis + messages) ============================== */
  var demTab = 'devis';
  VIEWS.demandes = function (box) {
    clear(box);
    var tabs = h('div', { class: 'tabs-a', role: 'group', 'aria-label': 'Type de demande' },
      h('button', { type: 'button', 'aria-pressed': String(demTab === 'devis'), text: 'Demandes de devis' + (counts.demandes ? ' (' + counts.demandes + ')' : ''), onclick: function () { demTab = 'devis'; route(); } }),
      h('button', { type: 'button', 'aria-pressed': String(demTab === 'messages'), text: 'Messages' + (counts.messages ? ' (' + counts.messages + ')' : ''), onclick: function () { demTab = 'messages'; route(); } }));
    box.appendChild(tabs);
    var body = h('div'); box.appendChild(body);
    return demTab === 'devis' ? listDevis(body) : listMessages(body);
  };
  function listDevis(body) {
    return sb.from('demandes_devis').select('*').order('created_at', { ascending: false }).limit(300).then(function (r) {
      var rows = ensure(r);
      var q = h('input', { class: 'in', type: 'search', placeholder: 'Rechercher (nom, e-mail, entreprise, produit…)', 'aria-label': 'Rechercher' });
      var st = h('select', { class: 'sel', 'aria-label': 'Filtrer par statut' }, h('option', { value: '', text: 'Tous les statuts' }), DEMANDE_STATUTS.map(function (s) { return h('option', { value: s[0], text: s[1] }); }));
      var out = h('div');
      body.appendChild(h('div', { class: 'tools' }, q, st)); body.appendChild(out);
      function draw() {
        var t = norm(q.value), s = st.value;
        var list = rows.filter(function (d) {
          if (s && d.statut !== s) return false;
          return !t || norm([d.prenom, d.nom, d.email, d.entreprise, d.telephone, d.description, (d.produits || []).join(' ')].join(' ')).indexOf(t) > -1;
        });
        clear(out);
        if (!list.length) { out.appendChild(h('div', { class: 'card-a empty-a', text: rows.length ? 'Aucun résultat.' : 'Aucune demande de devis pour le moment.' })); return; }
        out.appendChild(tableOf([
          { label: 'Date', cell: function (d) { return fmtDate(d.created_at); }, muted: true },
          { label: 'Client', cell: function (d) { return h('span', null, h('b', { text: [d.prenom, d.nom].filter(Boolean).join(' ') || '—' }), d.entreprise ? h('span', { class: 'muted', text: ' · ' + d.entreprise }) : null); } },
          { label: 'Besoin', cell: function (d) { return d.besoin || '—'; }, muted: true },
          { label: 'Produits', cell: function (d) { return clip((d.produits || []).join(', '), 40) || '—'; }, muted: true },
          { label: 'Statut', cell: function (d) { return pill(DEMANDE_STATUTS, d.statut); } }
        ], list, openDevis));
      }
      q.addEventListener('input', draw); st.addEventListener('change', draw); draw();
    });
  }
  function kv(pairs) {
    var dl = h('dl', { class: 'kv' });
    pairs.forEach(function (p) { if (p[1] == null || p[1] === '' || (Array.isArray(p[1]) && !p[1].length)) return; dl.appendChild(h('dt', { text: p[0] })); dl.appendChild(h('dd', null, Array.isArray(p[1]) ? p[1].join(', ') : p[1])); });
    return dl;
  }
  function openDevis(d) {
    var m = openModal({ title: 'Demande de devis — ' + ([d.prenom, d.nom].filter(Boolean).join(' ') || d.email), wide: true });
    m.body.appendChild(h('p', { class: 'muted', style: 'margin-bottom:12px;font-size:.82rem', text: 'Reçue le ' + fmtDate(d.created_at, true) }));
    m.body.appendChild(h('h3', { class: 'sec', style: 'margin-top:0', text: 'Projet' }));
    m.body.appendChild(kv([['Besoin', d.besoin], ['Produits', d.produits], ['Technique', d.technique], ['Logo / visuel', d.logo_existant], ['Quantité', d.quantite],
      ['Date souhaitée', d.date_souhaitee ? fmtDate(d.date_souhaitee) : null], ['Urgent', d.urgent ? 'Oui' : null], ['Description', d.description]]));
    m.body.appendChild(h('h3', { class: 'sec', text: 'Contact' }));
    m.body.appendChild(kv([['Nom', [d.prenom, d.nom].filter(Boolean).join(' ')], ['Entreprise / association', d.entreprise], ['E-mail', d.email], ['Téléphone', d.telephone], ['Ville / CP', d.ville]]));
    var files = Array.isArray(d.fichiers) ? d.fichiers : [];
    if (files.length) {
      m.body.appendChild(h('h3', { class: 'sec', text: 'Fichiers joints' }));
      var ul = h('ul', { class: 'files-l' }); m.body.appendChild(ul);
      files.forEach(function (f) {
        var a = h('button', { class: 'btn-a ghost sm', type: 'button', text: 'Ouvrir', onclick: function () {
          sb.storage.from('devis-fichiers').createSignedUrl(f.chemin, 600).then(function (r) { if (r.error) toast(errText(r.error), 'err'); else window.open(r.data.signedUrl, '_blank', 'noopener'); });
        } });
        ul.appendChild(h('li', null, h('span', { text: f.nom }), a));
      });
    } else if (d.donnees && (d.donnees['Fichiers logo (à joindre)'] || d.donnees['Fichiers de référence (à joindre)'])) {
      m.body.appendChild(h('p', { class: 'muted', style: 'font-size:.84rem', text: 'Fichiers annoncés mais non transmis (à demander au client) : ' + [d.donnees['Fichiers logo (à joindre)'], d.donnees['Fichiers de référence (à joindre)']].filter(Boolean).join(' · ') }));
    }
    m.body.appendChild(h('h3', { class: 'sec', text: 'Suivi' }));
    var form = buildForm([
      { name: 'statut', label: 'Statut', type: 'select', options: DEMANDE_STATUTS },
      { name: 'notes_internes', label: 'Notes internes (non visibles du client)', type: 'textarea', full: true, rows: 3 }
    ], d);
    m.body.appendChild(form.el);
    var err = h('div', { class: 'err-msg', hidden: true }); m.body.appendChild(err);
    m.left.appendChild(h('button', { class: 'btn-a danger', type: 'button', text: 'Supprimer', onclick: function () {
      confirmBox('Supprimer définitivement cette demande ?').then(function (ok) {
        if (!ok) return;
        var paths = files.map(function (f) { return f.chemin; });
        (paths.length ? sb.storage.from('devis-fichiers').remove(paths) : Promise.resolve()).then(function () { return sb.from('demandes_devis').delete().eq('id', d.id); })
          .then(function (r) { if (r.error) { err.hidden = false; err.textContent = errText(r.error); } else { toast('Demande supprimée.', 'ok'); m.close(); reload(); } });
      });
    } }));
    m.left.appendChild(h('a', { class: 'btn-a ghost', href: 'mailto:' + d.email + '?subject=' + encodeURIComponent('Votre demande de devis — CMR Personnalisation'), text: 'Répondre par e-mail' }));
    m.right.appendChild(h('button', { class: 'btn-a ghost', type: 'button', text: 'Créer une commande', onclick: function () { m.close(); editCommande(null, d); } }));
    m.right.appendChild(h('button', { class: 'btn-a', type: 'button', text: 'Enregistrer', onclick: function (e) {
      e.target.disabled = true;
      sb.from('demandes_devis').update(form.collect()).eq('id', d.id).then(function (r) {
        if (r.error) { err.hidden = false; err.textContent = errText(r.error); e.target.disabled = false; } else { toast('Demande mise à jour.', 'ok'); m.close(); reload(); }
      });
    } }));
  }
  function listMessages(body) {
    return sb.from('messages_contact').select('*').order('created_at', { ascending: false }).limit(300).then(function (r) {
      var rows = ensure(r);
      if (!rows.length) { body.appendChild(h('div', { class: 'card-a empty-a', text: 'Aucun message pour le moment.' })); return; }
      body.appendChild(tableOf([
        { label: 'Date', cell: function (d) { return fmtDate(d.created_at); }, muted: true },
        { label: 'De', cell: function (d) { return h('span', null, h('b', { text: d.nom || d.email }), d.entreprise ? h('span', { class: 'muted', text: ' · ' + d.entreprise }) : null); } },
        { label: 'Sujet', cell: function (d) { return d.sujet || '—'; }, muted: true },
        { label: 'Message', cell: function (d) { return clip(d.message, 60); }, muted: true },
        { label: 'État', cell: function (d) { return h('span', { class: 'pill ' + (d.traite ? 's-ok' : 's-nouvelle'), text: d.traite ? 'Traité' : 'À traiter' }); } }
      ], rows, function (d) {
        var m = openModal({ title: 'Message — ' + (d.nom || d.email) });
        m.body.appendChild(h('p', { class: 'muted', style: 'margin-bottom:12px;font-size:.82rem', text: 'Reçu le ' + fmtDate(d.created_at, true) }));
        m.body.appendChild(kv([['Nom', d.nom], ['Entreprise', d.entreprise], ['E-mail', d.email], ['Téléphone', d.telephone], ['Sujet', d.sujet], ['Message', d.message]]));
        m.left.appendChild(h('button', { class: 'btn-a danger', type: 'button', text: 'Supprimer', onclick: function () {
          confirmBox('Supprimer définitivement ce message ?').then(function (ok) { if (!ok) return; sb.from('messages_contact').delete().eq('id', d.id).then(function (r) { if (r.error) toast(errText(r.error), 'err'); else { m.close(); reload(); } }); });
        } }));
        m.left.appendChild(h('a', { class: 'btn-a ghost', href: 'mailto:' + d.email + '?subject=' + encodeURIComponent('Re: ' + (d.sujet || 'Votre message') + ' — CMR Personnalisation'), text: 'Répondre par e-mail' }));
        m.right.appendChild(h('button', { class: 'btn-a', type: 'button', text: d.traite ? 'Marquer comme à traiter' : 'Marquer comme traité', onclick: function () {
          sb.from('messages_contact').update({ traite: !d.traite }).eq('id', d.id).then(function (r) { if (r.error) toast(errText(r.error), 'err'); else { m.close(); reload(); } });
        } }));
      }));
    });
  }

  /* ============================== Commandes ============================== */
  VIEWS.commandes = function (box, actions) {
    actions.appendChild(h('button', { class: 'btn-a', type: 'button', text: '+ Nouvelle commande', onclick: function () { editCommande(null, null); } }));
    return sb.from('commandes').select('*').order('created_at', { ascending: false }).limit(300).then(function (r) {
      var rows = ensure(r);
      var q = h('input', { class: 'in', type: 'search', placeholder: 'Rechercher (référence, client, description…)', 'aria-label': 'Rechercher' });
      var st = h('select', { class: 'sel', 'aria-label': 'Filtrer par statut' }, h('option', { value: '', text: 'Tous les statuts' }), h('option', { value: '_actives', text: 'En cours (non livrées)' }), COMMANDE_STATUTS.map(function (s) { return h('option', { value: s[0], text: s[1] }); }));
      var out = h('div'); clear(box); box.appendChild(h('div', { class: 'tools' }, q, st)); box.appendChild(out);
      function draw() {
        var t = norm(q.value), s = st.value;
        var list = rows.filter(function (c) {
          if (s === '_actives' && ['livre', 'annulee'].indexOf(c.statut) > -1) return false;
          if (s && s !== '_actives' && c.statut !== s) return false;
          return !t || norm([c.reference, c.client_nom, c.entreprise, c.description, c.client_email].join(' ')).indexOf(t) > -1;
        });
        clear(out);
        if (!list.length) { out.appendChild(h('div', { class: 'card-a empty-a', text: rows.length ? 'Aucun résultat.' : 'Aucune commande. Créez-en une ou transformez une demande de devis.' })); return; }
        out.appendChild(tableOf([
          { label: 'Référence', cell: function (c) { return h('b', { text: c.reference }); } },
          { label: 'Client', cell: function (c) { return h('span', null, c.client_nom, c.entreprise ? h('span', { class: 'muted', text: ' · ' + c.entreprise }) : null); } },
          { label: 'Description', cell: function (c) { return clip(c.description, 50); }, muted: true },
          { label: 'Qté', num: true, cell: function (c) { return c.quantite == null ? '—' : c.quantite; }, muted: true },
          { label: 'Livraison', cell: function (c) { return c.date_livraison_prevue ? fmtDate(c.date_livraison_prevue) : '—'; }, muted: true },
          { label: 'Montant (interne)', num: true, cell: function (c) { return fmtMoney(c.montant) + (c.paye ? ' ✓' : ''); }, muted: true },
          { label: 'Statut', cell: function (c) { return pill(COMMANDE_STATUTS, c.statut); } }
        ], list, function (c) { editCommande(c, null); }));
      }
      q.addEventListener('input', draw); st.addEventListener('change', draw); draw();
    });
  };
  function editCommande(c, demande) {
    var isNew = !c;
    var base = c || (demande ? {
      demande_id: demande.id, client_nom: [demande.prenom, demande.nom].filter(Boolean).join(' '), entreprise: demande.entreprise, client_email: demande.email, client_telephone: demande.telephone,
      description: [demande.produits && demande.produits.length ? demande.produits.join(', ') : null, demande.technique, demande.description].filter(Boolean).join(' — '), statut: 'a_lancer',
      date_livraison_prevue: demande.date_souhaitee
    } : { statut: 'a_lancer' });
    formModal({
      title: isNew ? 'Nouvelle commande' : 'Commande ' + c.reference, wide: true, values: base,
      fields: [
        { name: 'client_nom', label: 'Client', required: true }, { name: 'entreprise', label: 'Entreprise / association' },
        { name: 'client_email', label: 'E-mail', type: 'email' }, { name: 'client_telephone', label: 'Téléphone', type: 'tel' },
        { name: 'description', label: 'Description de la commande', type: 'textarea', full: true, required: true, rows: 3 },
        { name: 'quantite', label: 'Quantité totale', type: 'number', min: 0 }, { name: 'statut', label: 'Statut', type: 'select', options: COMMANDE_STATUTS },
        { name: 'montant', label: 'Montant € (interne)', type: 'number', min: 0, step: '0.01', hint: 'Jamais affiché sur le site.' }, { name: 'date_livraison_prevue', label: 'Livraison prévue', type: 'date' },
        { name: 'paye', label: 'Payée', type: 'checkbox' },
        { name: 'notes', label: 'Notes internes', type: 'textarea', full: true, rows: 3 }
      ],
      onSave: function (v) {
        var q = isNew ? sb.from('commandes').insert(Object.assign({ demande_id: base.demande_id || null }, v)) : sb.from('commandes').update(v).eq('id', c.id);
        return q.then(function (r) {
          if (r.error) return r.error;
          var after = isNew && demande && demande.statut !== 'gagnee' ? sb.from('demandes_devis').update({ statut: 'gagnee' }).eq('id', demande.id) : Promise.resolve({});
          return after.then(function () { toast(isNew ? 'Commande créée.' : 'Commande mise à jour.', 'ok'); reload(); });
        });
      },
      onDelete: isNew ? null : function () { return sb.from('commandes').delete().eq('id', c.id).then(function (r) { if (!r.error) { toast('Commande supprimée.', 'ok'); reload(); } return r.error; }); },
      deleteMsg: 'Supprimer définitivement cette commande ?'
    });
  }

  /* ============================== Stock ============================== */
  VIEWS.stock = function (box, actions) {
    actions.appendChild(h('button', { class: 'btn-a', type: 'button', text: '+ Nouvel article', onclick: function () { editStock(null); } }));
    return sb.from('stock_items').select('*').order('nom').limit(1000).then(function (r) {
      var rows = ensure(r);
      var q = h('input', { class: 'in', type: 'search', placeholder: 'Rechercher (nom, référence, couleur, fournisseur…)', 'aria-label': 'Rechercher' });
      var st = h('select', { class: 'sel', 'aria-label': 'Filtrer' }, h('option', { value: '', text: 'Tous les articles' }), h('option', { value: 'low', text: 'Sous le seuil d\'alerte' }));
      var out = h('div'); clear(box); box.appendChild(h('div', { class: 'tools' }, q, st)); box.appendChild(out);
      function isLow(s) { return s.seuil_alerte > 0 && s.quantite <= s.seuil_alerte; }
      function draw() {
        var t = norm(q.value);
        var list = rows.filter(function (s) { return (!st.value || isLow(s)) && (!t || norm([s.nom, s.reference, s.couleur, s.taille, s.categorie, s.fournisseur].join(' ')).indexOf(t) > -1); });
        clear(out);
        if (!list.length) { out.appendChild(h('div', { class: 'card-a empty-a', text: rows.length ? 'Aucun résultat.' : 'Aucun article en stock. Ajoutez votre premier article.' })); return; }
        out.appendChild(tableOf([
          { label: 'Article', cell: function (s) { return h('span', null, h('b', { text: s.nom }), s.reference ? h('span', { class: 'muted', text: ' · ' + s.reference }) : null); } },
          { label: 'Catégorie', cell: function (s) { return s.categorie || '—'; }, muted: true },
          { label: 'Couleur / taille', cell: function (s) { return [s.couleur, s.taille].filter(Boolean).join(' / ') || '—'; }, muted: true },
          { label: 'Quantité', num: true, cell: function (s) {
            return h('span', { style: 'display:inline-flex;gap:6px;align-items:center', onclick: function (e) { e.stopPropagation(); } },
              h('button', { class: 'btn-a ghost sm', type: 'button', 'aria-label': 'Retirer 1 ' + s.nom, text: '−', disabled: s.quantite <= 0, onclick: function () { quick(s, -1); } }),
              h('b', { text: s.quantite, style: 'min-width:2.2rem;text-align:center' }),
              h('button', { class: 'btn-a ghost sm', type: 'button', 'aria-label': 'Ajouter 1 ' + s.nom, text: '+', onclick: function () { quick(s, 1); } }));
          } },
          { label: 'Seuil', num: true, cell: function (s) { return s.seuil_alerte || '—'; }, muted: true },
          { label: 'État', cell: function (s) { return isLow(s) ? h('span', { class: 'pill s-low', text: s.quantite === 0 ? 'Rupture' : 'Stock bas' }) : h('span', { class: 'pill s-ok', text: 'OK' }); } }
        ], list, editStock));
      }
      function quick(s, delta) { sb.rpc('ajuster_stock', { p_item: s.id, p_delta: delta, p_motif: 'Ajustement rapide' }).then(function (r) { if (r.error) toast(errText(r.error), 'err'); else { s.quantite = r.data; draw(); } }); }
      q.addEventListener('input', draw); st.addEventListener('change', draw); draw();
    });
  };
  function editStock(s) {
    var isNew = !s;
    var fields = [
      { name: 'nom', label: 'Article', required: true, full: true }, { name: 'categorie', label: 'Catégorie', hint: 'Ex. T-shirt, Polo, Sweat, Softshell…' }, { name: 'reference', label: 'Référence' },
      { name: 'couleur', label: 'Couleur' }, { name: 'taille', label: 'Taille' }, { name: 'fournisseur', label: 'Fournisseur' },
      { name: 'seuil_alerte', label: 'Seuil d\'alerte', type: 'number', min: 0, hint: 'Alerte quand la quantité est inférieure ou égale.' }
    ];
    if (isNew) fields.splice(6, 0, { name: 'quantite', label: 'Quantité initiale', type: 'number', min: 0 });
    fields.push({ name: 'notes', label: 'Notes', type: 'textarea', full: true, rows: 2 });
    var extra = [];
    if (!isNew) extra.push(h('button', { class: 'btn-a ghost', type: 'button', text: 'Ajuster la quantité (' + s.quantite + ')', onclick: function () { adjustStock(s); } }));
    var m = formModal({
      title: isNew ? 'Nouvel article' : s.nom, wide: true, values: s || { quantite: 0, seuil_alerte: 0 }, fields: fields, extraLeft: extra,
      onSave: function (v) {
        if (isNew) { v.quantite = v.quantite == null ? 0 : v.quantite; }
        if (v.seuil_alerte == null) v.seuil_alerte = 0;
        var q = isNew ? sb.from('stock_items').insert(v) : sb.from('stock_items').update(v).eq('id', s.id);
        return q.then(function (r) { if (r.error) return r.error; toast('Article enregistré.', 'ok'); reload(); });
      },
      onDelete: isNew ? null : function () { return sb.from('stock_items').delete().eq('id', s.id).then(function (r) { if (!r.error) { toast('Article supprimé.', 'ok'); reload(); } return r.error; }); },
      deleteMsg: 'Supprimer cet article et son historique ?'
    });
    if (!isNew) {
      var hist = h('div'); m.body.appendChild(h('h3', { class: 'sec', text: 'Derniers mouvements' })); m.body.appendChild(hist);
      sb.from('stock_mouvements').select('*').eq('item_id', s.id).order('created_at', { ascending: false }).limit(10).then(function (r) {
        var d = r.data || [];
        if (!d.length) { hist.appendChild(h('p', { class: 'muted', style: 'font-size:.84rem', text: 'Aucun mouvement enregistré.' })); return; }
        hist.appendChild(tableOf([
          { label: 'Date', cell: function (x) { return fmtDate(x.created_at, true); }, muted: true },
          { label: 'Variation', num: true, cell: function (x) { return (x.delta > 0 ? '+' : '') + x.delta; } },
          { label: 'Motif', cell: function (x) { return x.motif || '—'; }, muted: true },
          { label: 'Par', cell: function (x) { return x.auteur || '—'; }, muted: true }
        ], d));
      });
    }
  }
  function adjustStock(s) {
    formModal({
      title: 'Ajuster : ' + s.nom, values: { delta: '', motif: '' },
      intro: h('p', { class: 'muted', style: 'margin-bottom:12px;font-size:.86rem', text: 'Quantité actuelle : ' + s.quantite + '. Saisissez une variation positive (réception) ou négative (utilisation, perte).' }),
      fields: [{ name: 'delta', label: 'Variation (ex. 24 ou -6)', type: 'number', required: true }, { name: 'motif', label: 'Motif', hint: 'Ex. Réception fournisseur, commande CMD-2026-0003, inventaire…', full: true }],
      onSave: function (v) {
        if (!v.delta) return new Error('La variation ne peut pas être nulle.');
        return sb.rpc('ajuster_stock', { p_item: s.id, p_delta: v.delta, p_motif: v.motif }).then(function (r) { if (r.error) return r.error; toast('Stock mis à jour : ' + r.data, 'ok'); reload(); });
      }
    });
  }

  /* ============================== Réalisations ============================== */
  function imageField(value) {
    var url = value || '', wrap = h('div', { class: 'fld full' });
    var pv = h('div'), msg = h('div', { class: 'hint' });
    var file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true });
    function draw() {
      clear(pv);
      pv.appendChild(url ? h('img', { class: 'thumb', style: 'width:96px;height:120px', src: img(url), alt: '' }) : h('div', { class: 'thumb empty', style: 'width:96px;height:120px', text: 'Aucune image' }));
    }
    file.addEventListener('change', function () {
      if (!file.files[0]) return;
      msg.textContent = 'Téléversement…';
      uploadImage(file.files[0]).then(function (u) { url = u; msg.textContent = ''; draw(); }).catch(function (e) { msg.textContent = errText(e); });
      file.value = '';
    });
    wrap.appendChild(h('label', { text: 'Image' }));
    wrap.appendChild(h('div', { style: 'display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap' }, pv,
      h('div', { style: 'display:grid;gap:8px;justify-items:start' },
        h('button', { class: 'btn-a ghost sm', type: 'button', text: 'Téléverser une image', onclick: function () { file.click(); } }),
        h('button', { class: 'btn-a ghost sm', type: 'button', text: 'Choisir dans la médiathèque', onclick: function () { pickMedia().then(function (u) { if (u) { url = u; draw(); } }); } }),
        h('button', { class: 'btn-a ghost sm', type: 'button', text: 'Retirer l\'image', onclick: function () { url = ''; draw(); } }), file, msg)));
    draw();
    return { wrap: wrap, get: function () { return url || null; } };
  }
  VIEWS.realisations = function (box, actions) {
    actions.appendChild(h('button', { class: 'btn-a', type: 'button', text: '+ Ajouter', onclick: function () { editRealisation(null, 0); } }));
    return sb.from('realisations').select('*').order('ordre').order('created_at').then(function (r) {
      var rows = ensure(r); clear(box);
      box.appendChild(h('p', { class: 'muted', style: 'margin-bottom:14px;font-size:.86rem', text: 'Ces cartes s\'affichent sur la page « Réalisations » du site, dans cet ordre. Une carte sans image affiche une icône.' }));
      if (!rows.length) { box.appendChild(h('div', { class: 'card-a empty-a', text: 'Aucune réalisation.' })); return; }
      function move(i, d) {
        var j = i + d; if (j < 0 || j >= rows.length) return;
        var a = rows.slice(); var t = a[i]; a[i] = a[j]; a[j] = t;
        Promise.all(a.map(function (x, k) { return x.ordre === k + 1 ? null : sb.from('realisations').update({ ordre: k + 1 }).eq('id', x.id); }).filter(Boolean)).then(reload);
      }
      var idx = {}; rows.forEach(function (x, i) { idx[x.id] = i; });
      box.appendChild(tableOf([
        { label: '', cell: function (x) { return x.image_url ? h('img', { class: 'thumb', src: img(x.image_url), alt: '', loading: 'lazy' }) : h('div', { class: 'thumb empty', text: 'Icône' }); } },
        { label: 'Titre', cell: function (x) { return h('span', null, h('b', { text: x.titre }), h('div', { class: 'muted', style: 'font-size:.78rem', text: x.sous_titre || '' })); } },
        { label: 'Visible', cell: function (x) { return h('span', { class: 'pill ' + (x.publie ? 's-ok' : 's-off'), text: x.publie ? 'Publiée' : 'Masquée' }); } },
        { label: 'Ordre', cell: function (x) {
          var i = idx[x.id];
          return h('span', { style: 'display:inline-flex;gap:6px', onclick: function (e) { e.stopPropagation(); } },
            h('button', { class: 'btn-a ghost sm', type: 'button', 'aria-label': 'Monter', text: '↑', disabled: i === 0, onclick: function () { move(i, -1); } }),
            h('button', { class: 'btn-a ghost sm', type: 'button', 'aria-label': 'Descendre', text: '↓', disabled: i === rows.length - 1, onclick: function () { move(i, 1); } }));
        } }
      ], rows, function (x) { editRealisation(x, rows.length); }));
    });
  };
  function editRealisation(x, count) {
    var isNew = !x;
    formModal({
      title: isNew ? 'Nouvelle réalisation' : x.titre, wide: true, values: x || { publie: true },
      fields: [
        { name: 'titre', label: 'Titre', required: true }, { name: 'sous_titre', label: 'Sous-titre' },
        { name: 'image_url', custom: function (v) { return imageField(v); } },
        { name: 'alt', label: 'Description de l\'image (accessibilité)', full: true, hint: 'Ex. Polo bleu marine brodé, marquage poitrine.' },
        { name: 'publie', label: 'Afficher sur le site', type: 'checkbox' }
      ],
      onSave: function (v) {
        if (isNew) v.ordre = (count || 0) + 1;
        var q = isNew ? sb.from('realisations').insert(v) : sb.from('realisations').update(v).eq('id', x.id);
        return q.then(function (r) { if (r.error) return r.error; toast('Réalisation enregistrée.', 'ok'); reload(); });
      },
      onDelete: isNew ? null : function () { return sb.from('realisations').delete().eq('id', x.id).then(function (r) { if (!r.error) { toast('Réalisation supprimée.', 'ok'); reload(); } return r.error; }); },
      deleteMsg: 'Supprimer cette réalisation ?'
    });
  }

  /* ============================== Contenus du site ============================== */
  VIEWS.contenus = function (box) {
    return sb.from('contenus').select('*').order('groupe').order('cle').then(function (r) {
      var rows = ensure(r); clear(box);
      box.appendChild(h('p', { class: 'muted', style: 'margin-bottom:14px;font-size:.86rem', text: 'Modifiez les textes du site. Les changements apparaissent sur le site dès l\'enregistrement ; si un texte est vide, la version d\'origine du site reste affichée.' }));
      var groups = {}; rows.forEach(function (c) { (groups[c.groupe] = groups[c.groupe] || []).push(c); });
      Object.keys(groups).forEach(function (g) {
        box.appendChild(h('div', { class: 'cms-group' }, h('h3', { class: 'sec', text: g }),
          h('div', { class: 'card-a' }, groups[g].map(function (c) {
            var ctrl = c.multiligne ? h('textarea', { class: 'ta', rows: 3, id: 'c-' + c.cle }) : h('input', { class: 'in', type: 'text', id: 'c-' + c.cle });
            ctrl.value = c.valeur;
            var save = h('button', { class: 'btn-a sm', type: 'button', text: 'Enregistrer', disabled: true });
            ctrl.addEventListener('input', function () { save.disabled = ctrl.value.trim() === c.valeur || !ctrl.value.trim(); });
            save.addEventListener('click', function () {
              save.disabled = true;
              sb.from('contenus').update({ valeur: ctrl.value.trim() }).eq('cle', c.cle).then(function (r) { if (r.error) { toast(errText(r.error), 'err'); save.disabled = false; } else { c.valeur = ctrl.value.trim(); toast('Texte enregistré.', 'ok'); } });
            });
            return h('div', { class: 'cms-row' }, h('div', { class: 'r-h' }, h('label', { for: 'c-' + c.cle }, h('b', { text: c.libelle })), h('code', { text: c.cle })), ctrl, h('div', null, save));
          }))));
      });
    });
  };

  /* ============================== Médias ============================== */
  VIEWS.medias = function (box) {
    clear(box);
    var input = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml', multiple: true, hidden: true });
    var dz = h('div', { class: 'dz', tabindex: '0', role: 'button', 'aria-label': 'Ajouter des images' }, h('b', { text: 'Ajouter des images' }), h('span', { text: 'Glissez-déposez ou cliquez · PNG, JPG, WebP (optimisées automatiquement), GIF, SVG · 5 Mo max' }));
    var status = h('p', { class: 'muted', style: 'margin:-6px 0 14px;font-size:.84rem' });
    var grid = h('div');
    box.appendChild(dz); box.appendChild(input); box.appendChild(status); box.appendChild(grid);
    function upload(files) {
      var list = Array.prototype.slice.call(files); if (!list.length) return;
      status.textContent = 'Téléversement de ' + list.length + ' fichier(s)…';
      list.reduce(function (p, f) { return p.then(function () { return uploadImage(f).catch(function (e) { toast(errText(e), 'err'); }); }); }, Promise.resolve()).then(function () { status.textContent = ''; load(); });
    }
    dz.addEventListener('click', function () { input.click(); });
    dz.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', function () { upload(input.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('over'); }); });
    dz.addEventListener('drop', function (e) { if (e.dataTransfer) upload(e.dataTransfer.files); });
    function load() {
      return listMedias().then(function (items) {
        clear(grid);
        if (!items.length) { grid.appendChild(h('div', { class: 'card-a empty-a', text: 'La médiathèque est vide.' })); return; }
        var g = h('div', { class: 'media-grid' });
        items.forEach(function (it) {
          g.appendChild(h('div', { class: 'card-a media' }, h('img', { src: it.url, alt: '', loading: 'lazy' }),
            h('div', { class: 'm-b' }, h('div', { class: 'm-n', title: it.name, text: it.name }),
              h('div', { class: 'm-a' },
                h('button', { class: 'btn-a ghost sm', type: 'button', text: 'Copier le lien', onclick: function () { (navigator.clipboard ? navigator.clipboard.writeText(it.url) : Promise.reject()).then(function () { toast('Lien copié.', 'ok'); }, function () { window.prompt('Copiez ce lien :', it.url); }); } }),
                h('button', { class: 'btn-a danger sm', type: 'button', text: 'Supprimer', onclick: function () {
                  confirmBox('Supprimer cette image ? Si elle est utilisée sur une réalisation, elle ne s\'affichera plus.').then(function (ok) { if (!ok) return; sb.storage.from('site-medias').remove([it.path]).then(function (r) { if (r.error) toast(errText(r.error), 'err'); else load(); }); });
                } })))));
        });
        grid.appendChild(g);
      }).catch(function (e) { clear(grid); grid.appendChild(h('div', { class: 'err-msg', text: errText(e) })); });
    }
    return load();
  };

  /* ============================== Démarrage ============================== */
  sb.auth.onAuthStateChange(function (ev) {
    if (ev === 'PASSWORD_RECOVERY') { recovering = true; renderLogin('', 'recovery'); }
  });
  start().catch(function (e) { renderLogin('Connexion impossible : ' + errText(e)); });
})();
