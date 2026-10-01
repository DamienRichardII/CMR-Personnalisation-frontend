/* Espace client — Supabase Auth + RLS. Aucune donnée sensible côté client : tout passe par les règles de la base. */
(function () {
  'use strict';
  var cfg = window.CMR_SUPABASE;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var elLoad = $('#acct-loading'), elAuth = $('#acct-auth'), elApp = $('#acct-app');
  if (!cfg || !window.supabase) { elLoad.textContent = 'Espace client momentanément indisponible. Contactez-nous directement.'; return; }
  var sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  var user = null, recovering = /type=recovery/.test(location.hash);

  var DEM = { nouvelle: ['Reçue', ''], en_cours: ['En cours d’étude', ''], devis_envoye: ['Devis envoyé', ''], gagnee: ['Acceptée', 'is-done'], perdue: ['Clôturée', 'is-off'], archivee: ['Archivée', 'is-off'] };
  var CMD = ['a_lancer', 'en_production', 'pret', 'livre'];
  var CMDL = { a_lancer: 'Commande confirmée', en_production: 'En production', pret: 'Prête', livre: 'Livrée', annulee: 'Annulée' };
  var STEPS = ['Confirmée', 'Production', 'Prête', 'Livrée'];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fdate(d) { try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } }
  function status(form, msg, kind) { var s = $('.form-status', form) || form; s.hidden = !msg; s.textContent = msg || ''; s.className = 'form-status' + (kind ? ' is-' + kind : ''); }
  function setErr(form, id, msg) { var e = $('[data-err-for="' + id + '"]', form), i = document.getElementById(id); if (e) e.textContent = msg || ''; if (i) { if (msg) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid'); } }
  function validate(form) {
    var ok = true, first = null;
    $$('[data-req]', form).forEach(function (i) {
      var bad = i.type === 'checkbox' ? !i.checked : !i.value.trim();
      var msg = '';
      if (bad) msg = i.type === 'checkbox' ? 'Merci de cocher cette case.' : 'Ce champ est requis.';
      else if (i.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.value.trim())) msg = 'Adresse e-mail invalide.';
      else if (i.type === 'password' && /pass$/.test(i.id) && i.autocomplete === 'new-password' && i.value.length < 8) msg = '8 caractères minimum.';
      setErr(form, i.id, msg);
      if (msg) { ok = false; first = first || i; }
    });
    if (first) first.focus();
    return ok;
  }
  function busy(form, on) { var b = $('button[type=submit]', form); if (b) { b.disabled = on; b.style.opacity = on ? '.6' : ''; } }
  function frErr(e) {
    var m = (e && e.message) || '';
    if (/invalid login/i.test(m)) return 'E-mail ou mot de passe incorrect.';
    if (/not confirmed/i.test(m)) return 'Adresse e-mail non confirmée : consultez le message de confirmation reçu.';
    if (/already registered|already been registered/i.test(m)) return 'Un compte existe déjà avec cet e-mail : connectez-vous ou réinitialisez votre mot de passe.';
    if (/rate limit|too many/i.test(m)) return 'Trop de tentatives. Réessayez dans quelques minutes.';
    if (/password/i.test(m)) return 'Mot de passe trop faible (8 caractères minimum).';
    return 'Une erreur est survenue. Réessayez ou contactez-nous.';
  }

  /* ----- onglets connexion ----- */
  function showAuth(which) {
    ['login', 'signup', 'forgot', 'reset'].forEach(function (k) { var f = $('#form-' + k); if (f) f.hidden = k !== which; });
    var tabs = $('.acct-tabs', elAuth);
    tabs.hidden = which === 'forgot' || which === 'reset';
    $$('[data-auth-tab]', tabs).forEach(function (b) { var on = b.getAttribute('data-auth-tab') === which; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
  }
  $$('[data-auth-tab]').forEach(function (b) { b.addEventListener('click', function () { showAuth(b.getAttribute('data-auth-tab')); }); });

  $('#form-login').addEventListener('submit', function (ev) {
    ev.preventDefault(); var f = ev.target; status(f); if (!validate(f)) return;
    busy(f, true);
    sb.auth.signInWithPassword({ email: $('#l-email').value.trim(), password: $('#l-pass').value }).then(function (r) {
      busy(f, false); if (r.error) status(f, frErr(r.error), 'error');
    });
  });
  $('#form-signup').addEventListener('submit', function (ev) {
    ev.preventDefault(); var f = ev.target; status(f); if (!validate(f)) return;
    busy(f, true);
    sb.auth.signUp({
      email: $('#s-email').value.trim(), password: $('#s-pass').value,
      options: { emailRedirectTo: location.origin + '/compte', data: { prenom: $('#s-prenom').value.trim(), nom: $('#s-nom').value.trim(), entreprise: $('#s-entreprise').value.trim(), telephone: $('#s-tel').value.trim() } }
    }).then(function (r) {
      busy(f, false);
      if (r.error) return status(f, frErr(r.error), 'error');
      if (r.data && r.data.session) return;
      f.reset(); status(f, 'Compte créé. Un e-mail de confirmation vient de vous être envoyé : cliquez sur le lien pour activer votre compte, puis connectez-vous.', 'ok');
    });
  });
  $('#form-forgot').addEventListener('submit', function (ev) {
    ev.preventDefault(); var f = ev.target; status(f); if (!validate(f)) return;
    busy(f, true);
    sb.auth.resetPasswordForEmail($('#f-email').value.trim(), { redirectTo: location.origin + '/compte' }).then(function () {
      busy(f, false); status(f, 'Si un compte existe avec cette adresse, un lien de réinitialisation vient d’être envoyé.', 'ok');
    });
  });
  $('#form-reset').addEventListener('submit', function (ev) {
    ev.preventDefault(); var f = ev.target; status(f); if (!validate(f)) return;
    busy(f, true);
    sb.auth.updateUser({ password: $('#r-pass').value }).then(function (r) {
      busy(f, false);
      if (r.error) return status(f, frErr(r.error), 'error');
      recovering = false; history.replaceState(null, '', location.pathname); start();
    });
  });
  $('#acct-logout').addEventListener('click', function () { sb.auth.signOut(); });

  /* ----- onglets espace ----- */
  function showTab(name) {
    $$('[data-app-tab]').forEach(function (b) { var on = b.getAttribute('data-app-tab') === name; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
    $$('.acct-pane').forEach(function (p) { p.hidden = p.id !== 'ap-' + name; });
  }
  $$('[data-app-tab]').forEach(function (b) { b.addEventListener('click', function () { showTab(b.getAttribute('data-app-tab')); }); });

  /* ----- données ----- */
  function loadDemandes() {
    var box = $('#ap-demandes');
    return sb.rpc('mes_demandes').then(function (r) {
      if (r.error) { box.innerHTML = '<p class="acct-empty">Impossible de charger vos demandes pour le moment.</p>'; return; }
      var rows = r.data || [];
      if (!rows.length) { box.innerHTML = '<p class="acct-empty">Aucune demande pour le moment. <a href="devis.html">Demander un devis</a></p>'; return; }
      box.innerHTML = '<ul class="acct-list">' + rows.map(function (d) {
        var s = DEM[d.statut] || [d.statut, ''];
        var prod = (d.produits || []).join(', ');
        return '<li class="acct-item"><div class="acct-item-top"><h3>Demande du ' + esc(fdate(d.created_at)) + '</h3><span class="acct-badge ' + s[1] + '">' + esc(s[0]) + '</span></div>' +
          (d.besoin ? '<p>' + esc(d.besoin) + (prod ? ' — ' + esc(prod) : '') + '</p>' : (prod ? '<p>' + esc(prod) + '</p>' : '')) +
          (d.quantite ? '<p>Quantité : ' + esc(d.quantite) + '</p>' : '') +
          (d.date_souhaitee ? '<p>Date souhaitée : ' + esc(fdate(d.date_souhaitee)) + '</p>' : '') + '</li>';
      }).join('') + '</ul>';
    });
  }
  function loadCommandes() {
    var box = $('#ap-commandes');
    return sb.rpc('mes_commandes').then(function (r) {
      if (r.error) { box.innerHTML = '<p class="acct-empty">Impossible de charger vos commandes pour le moment.</p>'; return; }
      var rows = r.data || [];
      if (!rows.length) { box.innerHTML = '<p class="acct-empty">Aucune commande pour le moment. Vos commandes apparaîtront ici dès qu’un devis est accepté.</p>'; return; }
      box.innerHTML = '<ul class="acct-list">' + rows.map(function (c) {
        var idx = CMD.indexOf(c.statut), off = c.statut === 'annulee';
        var steps = off ? '' : '<ol class="acct-steps" aria-label="Avancement">' + STEPS.map(function (l, i) { return '<li class="' + (i <= idx ? 'is-on' : '') + '"><span>' + l + '</span></li>'; }).join('') + '</ol>';
        return '<li class="acct-item"><div class="acct-item-top"><h3>' + esc(c.reference) + '</h3><span class="acct-badge ' + (off ? 'is-off' : c.statut === 'livre' ? 'is-done' : '') + '">' + esc(CMDL[c.statut] || c.statut) + '</span></div>' +
          (c.description ? '<p>' + esc(c.description) + '</p>' : '') +
          (c.quantite ? '<p>Quantité : ' + esc(c.quantite) + '</p>' : '') +
          (c.date_livraison_prevue ? '<p>Livraison prévue : ' + esc(fdate(c.date_livraison_prevue)) + '</p>' : '') + steps + '</li>';
      }).join('') + '</ul>';
    });
  }
  var PF = { prenom: 'p-prenom', nom: 'p-nom', entreprise: 'p-entreprise', telephone: 'p-tel', adresse: 'p-adresse', code_postal: 'p-cp', ville: 'p-ville' };
  function loadProfil() {
    return sb.from('clients').select('*').eq('id', user.id).maybeSingle().then(function (r) {
      var d = r.data || {};
      Object.keys(PF).forEach(function (k) { $('#' + PF[k]).value = d[k] || ''; });
      $('#acct-hello').textContent = 'Bonjour' + (d.prenom ? ' ' + d.prenom : '');
    });
  }
  $('#form-profile').addEventListener('submit', function (ev) {
    ev.preventDefault(); var f = ev.target; status(f); if (!validate(f)) return;
    var up = {}; Object.keys(PF).forEach(function (k) { up[k] = $('#' + PF[k]).value.trim() || null; });
    busy(f, true);
    sb.from('clients').update(up).eq('id', user.id).then(function (r) {
      busy(f, false);
      if (r.error) return status(f, 'Enregistrement impossible. Réessayez.', 'error');
      $('#acct-hello').textContent = 'Bonjour ' + up.prenom; status(f, 'Profil enregistré.', 'ok');
    });
  });

  /* ----- fichiers ----- */
  var EXT = /\.(png|jpe?g|svg|pdf|ai|eps)$/i, MAX = 10 * 1024 * 1024;
  function fstatus(msg, kind) { var s = $('#files-status'); s.hidden = !msg; s.textContent = msg || ''; s.className = 'form-status' + (kind ? ' is-' + kind : ''); }
  function loadFiles() {
    var ul = $('#files-list');
    return sb.storage.from('client-fichiers').list(user.id, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } }).then(function (r) {
      var rows = (r.data || []).filter(function (f) { return f.name && f.name !== '.emptyFolderPlaceholder'; });
      if (!rows.length) { ul.innerHTML = '<li class="acct-empty">Aucun fichier pour le moment.</li>'; return; }
      ul.innerHTML = rows.map(function (f) {
        var shown = f.name.replace(/^\d+-/, '');
        return '<li data-name="' + esc(f.name) + '"><span class="fname">' + esc(shown) + '</span><span class="facts"><button type="button" data-act="dl">Télécharger</button><button type="button" class="del" data-act="rm">Supprimer</button></span></li>';
      }).join('');
    });
  }
  $('#files-list').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act'), name = b.closest('li').getAttribute('data-name'), path = user.id + '/' + name;
    if (act === 'dl') {
      sb.storage.from('client-fichiers').createSignedUrl(path, 60).then(function (r) { if (r.data) window.open(r.data.signedUrl, '_blank', 'noopener'); else fstatus('Téléchargement impossible.', 'error'); });
    } else if (act === 'rm') {
      b.textContent = 'Confirmer ?'; b.setAttribute('data-act', 'rm-ok');
    } else {
      sb.storage.from('client-fichiers').remove([path]).then(function (r) { if (r.error) fstatus('Suppression impossible.', 'error'); else { fstatus('Fichier supprimé.', 'ok'); loadFiles(); } });
    }
  });
  $('#file-input').addEventListener('change', function (ev) {
    var files = Array.prototype.slice.call(ev.target.files || []); ev.target.value = ''; fstatus();
    if (!files.length) return;
    var bad = files.filter(function (f) { return !EXT.test(f.name) || f.size > MAX; });
    if (bad.length) { fstatus('Fichier refusé : formats PNG, JPG, SVG, PDF, AI ou EPS, 10 Mo maximum.', 'error'); files = files.filter(function (f) { return bad.indexOf(f) < 0; }); }
    if (!files.length) return;
    Promise.all(files.map(function (f) {
      var safe = f.name.replace(/[^\w.\-]+/g, '_');
      return sb.storage.from('client-fichiers').upload(user.id + '/' + Date.now() + '-' + safe, f, { contentType: f.type || undefined });
    })).then(function (res) {
      var err = res.some(function (r) { return r.error; });
      if (err) fstatus('Un fichier n’a pas pu être envoyé. Réessayez.', 'error'); else if (!bad.length) fstatus('Fichier ajouté.', 'ok');
      loadFiles();
    });
  });

  /* ----- démarrage ----- */
  function start() {
    sb.auth.getSession().then(function (r) {
      var s = r.data && r.data.session; user = s ? s.user : null;
      elLoad.hidden = true;
      if (recovering && user) { elApp.hidden = true; elAuth.hidden = false; showAuth('reset'); return; }
      if (!user) { elApp.hidden = true; elAuth.hidden = false; showAuth('login'); return; }
      elAuth.hidden = true; elApp.hidden = false;
      $('#acct-mail').textContent = user.email || '';
      $('#acct-unverified').hidden = !!user.email_confirmed_at;
      showTab('demandes');
      loadProfil(); loadDemandes(); loadCommandes(); loadFiles();
    });
  }
  sb.auth.onAuthStateChange(function (ev) {
    if (ev === 'PASSWORD_RECOVERY') recovering = true;
    if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT' || ev === 'PASSWORD_RECOVERY') start();
  });
  start();
})();
