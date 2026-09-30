/* CMR Personnalisation — scripts des pages internes (À propos · Contact · Devis)
   Complète main.js (menu, thème, révélations, parallax). Vanilla JS, aucune dépendance. */
(function () {
  'use strict';

  /* ==========================================================================
     CONFIGURATION — à renseigner
     endpoint : URL d'un service de formulaires (Formspree, Web3Forms, Resend…).
                Tant qu'elle est vide, l'envoi bascule sur l'ouverture d'un e-mail
                pré-rempli (mailto) : les fichiers joints ne sont alors pas transmis.
     ========================================================================== */
  var CONFIG = {
    endpoint: '/api/devis',
    mailTo: 'cmrpersonnalisation@gmail.com'
  };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* ---------- Révélation d'images (rideau) ---------- */
  var revealImgs = $$('.reveal-img');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); rio.unobserve(e.target); }
      });
    }, { threshold: 0.2 });
    revealImgs.forEach(function (el) { rio.observe(el); });
  } else {
    revealImgs.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------- Compteurs animés ---------- */
  var counters = $$('[data-count]');
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    var start = null, dur = 1700;
    function tick(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = String(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  if ('IntersectionObserver' in window && !reduceMotion && counters.length) {
    counters.forEach(function (el) { el.textContent = '0'; });
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { animateCount(e.target); cio.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { cio.observe(el); });
  }

  /* ---------- Copier le lien du questionnaire ---------- */
  $$('[data-copy]').forEach(function (btn) {
    var label = btn.querySelector('span');
    var original = label ? label.textContent : '';
    btn.addEventListener('click', function () {
      var url = btn.getAttribute('data-copy');
      function done() {
        if (label) label.textContent = 'Lien copié';
        setTimeout(function () { if (label) label.textContent = original; }, 2200);
      }
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).then(done, fallback);
      } else { fallback(); }
      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = url; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { window.prompt('Copiez ce lien :', url); }
        document.body.removeChild(ta);
      }
    });
  });

  /* ---------- Zones de dépôt de fichiers ---------- */
  var ALLOWED = /\.(png|jpe?g|webp|svg|pdf|ai|eps|psd)$/i;
  function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' Mo' : Math.max(1, Math.round(b / 1024)) + ' Ko'; }

  function initDropzone(wrap) {
    var input = wrap.querySelector('input[type="file"]');
    var zone = wrap.querySelector('.dropzone');
    var list = wrap.querySelector('.file-list');
    var hint = wrap.querySelector('.file-hint');
    var maxFiles = parseInt(wrap.getAttribute('data-max-files'), 10) || 5;
    var maxMb = parseInt(wrap.getAttribute('data-max-mb'), 10) || 10;
    var files = [];

    function sync() {
      try {
        var dt = new DataTransfer();
        files.forEach(function (f) { dt.items.add(f); });
        input.files = dt.files;
      } catch (e) { /* navigateur sans DataTransfer : le champ garde la sélection native */ }
      list.innerHTML = '';
      files.forEach(function (f, i) {
        var li = document.createElement('li');
        li.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-doc"/></svg><span class="fname"></span><span class="fsize"></span>' +
          '<button type="button" aria-label="Retirer ce fichier"><svg class="icon" aria-hidden="true"><use href="#i-x"/></svg></button>';
        li.querySelector('.fname').textContent = f.name;
        li.querySelector('.fsize').textContent = fmtSize(f.size);
        li.querySelector('button').addEventListener('click', function () { files.splice(i, 1); sync(); });
        list.appendChild(li);
      });
    }
    function say(msg) { hint.textContent = msg || ''; hint.hidden = !msg; }

    function add(fileList) {
      var problems = [];
      Array.prototype.forEach.call(fileList, function (f) {
        if (!ALLOWED.test(f.name)) { problems.push('« ' + f.name + ' » : format non accepté.'); return; }
        if (f.size > maxMb * 1048576) { problems.push('« ' + f.name + ' » dépasse ' + maxMb + ' Mo.'); return; }
        if (files.some(function (x) { return x.name === f.name && x.size === f.size; })) return;
        if (files.length >= maxFiles) { problems.push('Maximum ' + maxFiles + ' fichiers.'); return; }
        files.push(f);
      });
      say(problems.join(' '));
      sync();
    }
    input.addEventListener('change', function () {
      var picked = Array.prototype.slice.call(input.files);
      files = files.filter(function () { return true; });
      add(picked);
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('is-drag'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('is-drag'); });
    });
    zone.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files) add(e.dataTransfer.files); });
    wrap.__count = function () { return files.length; };
    wrap.__names = function () { return files.map(function (f) { return f.name; }); };
  }
  $$('.dropzone-wrap').forEach(initDropzone);

  /* ---------- Envoi (endpoint si configuré, sinon mailto) ---------- */
  function toText(pairs) {
    return pairs.filter(function (p) { return p[1]; }).map(function (p) { return p[0] + ' : ' + p[1]; }).join('\n');
  }
  function mailtoHref(subject, body) {
    return 'mailto:' + CONFIG.mailTo + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }
  /* Retourne une promesse : 'sent' (transmis au service) ou 'mailto' (e-mail ouvert) ou rejet */
  function deliver(form, subject, pairs) {
    if (CONFIG.endpoint) {
      var MAX_ATTACH = 3 * 1048576; /* limite d'une fonction Vercel (~4,5 Mo) une fois encodé en base64 */
      var picked = [];
      Array.prototype.forEach.call(form.querySelectorAll('input[type="file"]'), function (inp) {
        Array.prototype.forEach.call(inp.files || [], function (f) { picked.push(f); });
      });
      var total = picked.reduce(function (n, f) { return n + f.size; }, 0);
      var attach = total > 0 && total <= MAX_ATTACH ? picked : [];
      var tooBig = total > MAX_ATTACH;
      var readAll = Promise.all(attach.map(function (f) {
        return new Promise(function (resolve, reject) {
          var r = new FileReader();
          r.onload = function () { resolve({ name: f.name, type: f.type, content: String(r.result).split(',')[1] || '' }); };
          r.onerror = reject; r.readAsDataURL(f);
        });
      }));
      return readAll.then(function (files) {
        var email = ''; pairs.forEach(function (p) { if (p[0] === 'E-mail') email = p[1]; });
        var extra = tooBig ? [['Pièces jointes', 'Fichiers trop volumineux pour l\'envoi automatique : le client les transmettra par e-mail.']] : [];
        return fetch(CONFIG.endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ subject: subject, replyTo: email, pairs: pairs.concat(extra), files: files })
        });
      }).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return { mode: 'sent' }; });
    }
    var body = toText(pairs);
    var href = mailtoHref(subject, body);
    window.location.href = href;
    return Promise.resolve({ mode: 'mailto', href: href });
  }
  function isSpam(form) { var hp = form.querySelector('.hp input'); return hp && hp.value; }

  /* ---------- Formulaire de contact ---------- */
  var contactForm = $('#contact-form');
  if (contactForm) {
    var cStatus = $('#contact-status');
    var cBtn = contactForm.querySelector('button[type="submit"]');
    function showStatus(kind, html) {
      cStatus.hidden = false; cStatus.className = 'form-status ' + kind; cStatus.innerHTML = html;
    }
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true, first = null;
      $$('[data-req]', contactForm).forEach(function (el) {
        var err = contactForm.querySelector('[data-err-for="' + el.id + '"]');
        var bad = el.type === 'checkbox' ? !el.checked : !el.value.trim() || !el.checkValidity();
        el.setAttribute('aria-invalid', bad ? 'true' : 'false');
        if (err) err.textContent = bad ? (el.type === 'email' ? 'Merci de saisir une adresse e-mail valide.' : el.type === 'checkbox' ? 'Ce consentement est nécessaire pour envoyer votre message.' : 'Ce champ est requis.') : '';
        if (bad) { ok = false; if (!first) first = el; }
      });
      if (!ok) { first.focus(); return; }
      if (isSpam(contactForm)) { showStatus('is-ok', 'Merci ! Votre message a bien été envoyé.'); return; }
      var v = function (id) { return contactForm.querySelector('#' + id).value.trim(); };
      var subject = 'Contact site — ' + (v('c-sujet') || 'Message');
      var pairs = [['Nom', v('c-nom')], ['Entreprise', v('c-entreprise')], ['E-mail', v('c-email')], ['Téléphone', v('c-tel')], ['Sujet', v('c-sujet')], ['Message', v('c-message')]];
      cBtn.disabled = true;
      deliver(contactForm, subject, pairs).then(function (res) {
        if (res.mode === 'sent') {
          showStatus('is-ok', 'Merci ! Votre message a bien été envoyé. L\'équipe CMR vous répondra rapidement.');
          contactForm.reset();
        } else {
          showStatus('is-ok', 'Votre application e-mail vient de s\'ouvrir avec votre message. Il ne reste qu\'à l\'envoyer. <a href="' + res.href + '" style="text-decoration:underline">Rouvrir l\'e-mail</a>');
        }
      }).catch(function () {
        showStatus('is-error', 'L\'envoi a échoué. Réessayez, ou écrivez-nous directement à <a href="mailto:' + CONFIG.mailTo + '" style="text-decoration:underline">' + CONFIG.mailTo + '</a>.');
      }).then(function () { cBtn.disabled = false; });
    });
    contactForm.addEventListener('input', function (e) {
      if (e.target.getAttribute('aria-invalid') === 'true') {
        e.target.setAttribute('aria-invalid', 'false');
        var err = contactForm.querySelector('[data-err-for="' + e.target.id + '"]');
        if (err) err.textContent = '';
      }
    });
  }

  /* ---------- Questionnaire de devis ---------- */
  var quizForm = $('#quiz-form');
  if (quizForm) {
    var quiz = $('#quiz');
    var steps = $$('.q-step', quizForm);
    var TOTAL = 6, RECAP = 7;
    var TITLES = ['Besoin', 'Produits', 'Personnalisation', 'Quantité & délai', 'Votre projet', 'Coordonnées', 'Récapitulatif'];
    var bar = $$('.steps-bar li', quiz);
    var count = $('#quiz-count');
    var current = 1;
    var done = $('#quiz-done');
    var sendBtn = $('#quiz-send');

    var dateInput = $('#q-date');
    if (dateInput) {
      var t = new Date(); t.setMinutes(t.getMinutes() - t.getTimezoneOffset());
      dateInput.min = t.toISOString().slice(0, 10);
    }

    /* Logo : Oui → zone d'upload, Non → message rassurant */
    var logoUpload = $('#logo-upload'), logoNo = $('#logo-no');
    $$('input[name="logo"]', quizForm).forEach(function (r) {
      r.addEventListener('change', function () {
        var yes = r.value === 'Oui' && r.checked;
        logoUpload.hidden = !yes;
        logoNo.hidden = !(r.value === 'Non' && r.checked);
      });
    });

    function radioVal(name) { var r = quizForm.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : ''; }
    function checkedVals(name) { return $$('input[name="' + name + '"]:checked', quizForm).map(function (i) { return i.value; }); }
    function val(id) { var el = quizForm.querySelector('#' + id); return el ? el.value.trim() : ''; }
    function setError(n, msg) { var e = quizForm.querySelector('.q-step[data-step="' + n + '"] .q-error'); if (e) e.textContent = msg || ''; }

    function validate(n) {
      setError(n, '');
      if (n === 1 && !radioVal('besoin')) { setError(n, 'Veuillez choisir une option pour continuer.'); return false; }
      if (n === 2 && !checkedVals('produits').length) { setError(n, 'Sélectionnez au moins un produit à personnaliser.'); return false; }
      if (n === 3) {
        if (!radioVal('technique')) { setError(n, 'Choisissez une technique — ou « Je ne sais pas », nous vous conseillerons.'); return false; }
        if (!radioVal('logo')) { setError(n, 'Indiquez si vous avez déjà votre logo ou votre visuel.'); return false; }
      }
      if (n === 4 && !radioVal('quantite')) { setError(n, 'Choisissez une quantité approximative.'); return false; }
      if (n === 5 && val('q-description').length < 10) {
        setError(n, 'Décrivez brièvement votre projet (quelques mots suffisent).');
        quizForm.querySelector('#q-description').setAttribute('aria-invalid', 'true');
        quizForm.querySelector('#q-description').focus(); return false;
      }
      if (n === 6) {
        var bad = null;
        ['q-prenom', 'q-nom', 'q-email'].forEach(function (id) {
          var el = quizForm.querySelector('#' + id);
          var invalid = !el.value.trim() || !el.checkValidity();
          el.setAttribute('aria-invalid', invalid ? 'true' : 'false');
          if (invalid && !bad) bad = el;
        });
        if (bad) { setError(n, bad.type === 'email' ? 'Merci de saisir une adresse e-mail valide.' : 'Renseignez votre prénom, votre nom et votre e-mail.'); bad.focus(); return false; }
      }
      if (n === RECAP && !quizForm.querySelector('#q-consent').checked) { setError(n, 'Merci de cocher la case de consentement pour envoyer votre demande.'); return false; }
      return true;
    }
    quizForm.addEventListener('input', function (e) {
      if (e.target.getAttribute && e.target.getAttribute('aria-invalid') === 'true') e.target.setAttribute('aria-invalid', 'false');
      setError(current, '');
    });
    quizForm.addEventListener('change', function () { setError(current, ''); });

    function refresh() {
      bar.forEach(function (li, i) {
        li.classList.toggle('is-done', current === RECAP || i + 1 < current);
        li.classList.toggle('is-current', current !== RECAP && i + 1 === current);
        if (i + 1 === current && current !== RECAP) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
      count.textContent = current === RECAP ? 'Récapitulatif avant envoi' : 'Étape ' + current + ' sur ' + TOTAL + ' · ' + TITLES[current - 1];
    }

    function goTo(n, dir) {
      steps.forEach(function (s) {
        var on = parseInt(s.getAttribute('data-step'), 10) === n;
        s.hidden = !on;
        s.classList.remove('enter-next', 'enter-prev');
        if (on && !reduceMotion) { void s.offsetWidth; s.classList.add(dir === 'prev' ? 'enter-prev' : 'enter-next'); }
      });
      current = n;
      if (n === RECAP) buildRecap();
      refresh();
      var h = quizForm.querySelector('.q-step[data-step="' + n + '"] [data-focus]');
      if (h) h.focus({ preventScroll: true });
      if (quiz.getBoundingClientRect().top < 0) quiz.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }

    quizForm.addEventListener('click', function (e) {
      var prev = e.target.closest('[data-prev]');
      if (prev && current > 1) { goTo(current - 1, 'prev'); return; }
      var edit = e.target.closest('[data-edit]');
      if (edit) goTo(parseInt(edit.getAttribute('data-edit'), 10), 'prev');
    });

    function buildRecap() {
      var files = function (id) { var w = quizForm.querySelector(id); return w && w.__count ? w.__count() : 0; };
      var logoFiles = files('#logo-drop'), refFiles = files('#ref-drop');
      var delai = [val('q-date') ? 'Pour le ' + new Date(val('q-date') + 'T12:00:00').toLocaleDateString('fr-FR') : '', quizForm.querySelector('#q-urgent').checked ? 'Demande urgente' : ''].filter(Boolean).join(' · ');
      var desc = val('q-description'); if (desc.length > 220) desc = desc.slice(0, 220) + '…';
      var contact = [val('q-prenom') + ' ' + val('q-nom'), val('q-entreprise'), val('q-email'), val('q-tel'), val('q-ville')].filter(function (x) { return x && x.trim(); }).join(' · ');
      var rows = [
        [1, 'Besoin', radioVal('besoin')],
        [2, 'Produits', checkedVals('produits').join(', ')],
        [3, 'Technique', radioVal('technique')],
        [3, 'Logo / visuel', radioVal('logo') === 'Oui' ? 'Oui' + (logoFiles ? ' — ' + logoFiles + ' fichier(s)' : ' (à nous transmettre)') : 'Non, besoin d\'accompagnement'],
        [4, 'Quantité', radioVal('quantite')],
        [4, 'Délai', delai || 'Pas de contrainte indiquée'],
        [5, 'Projet', desc + (refFiles ? '  (+ ' + refFiles + ' fichier(s) de référence)' : '')],
        [6, 'Coordonnées', contact]
      ];
      var dl = $('#recap-list'); dl.innerHTML = '';
      rows.forEach(function (r) {
        var d = document.createElement('div'); d.className = 'recap-row';
        d.innerHTML = '<dt></dt><dd></dd><button type="button" data-edit="' + r[0] + '">Modifier</button>';
        d.querySelector('dt').textContent = r[1]; d.querySelector('dd').textContent = r[2];
        dl.appendChild(d);
      });
    }

    function collectPairs() {
      var logoNames = (quizForm.querySelector('#logo-drop').__names || function () { return []; })();
      var refNames = (quizForm.querySelector('#ref-drop').__names || function () { return []; })();
      return [
        ['Besoin', radioVal('besoin')], ['Produits', checkedVals('produits').join(', ')],
        ['Technique', radioVal('technique')], ['Logo / visuel existant', radioVal('logo')],
        ['Fichiers logo (à joindre)', logoNames.join(', ')],
        ['Quantité', radioVal('quantite')], ['Date souhaitée', val('q-date')], ['Urgent', quizForm.querySelector('#q-urgent').checked ? 'Oui' : ''],
        ['Description', val('q-description')], ['Fichiers de référence (à joindre)', refNames.join(', ')],
        ['Prénom', val('q-prenom')], ['Nom', val('q-nom')], ['Entreprise / association', val('q-entreprise')],
        ['E-mail', val('q-email')], ['Téléphone', val('q-tel')], ['Ville / code postal', val('q-ville')]
      ];
    }

    function showDone(res) {
      quizForm.hidden = true;
      $('.steps-bar', quiz).hidden = true; $('.quiz-head', quiz).hidden = true;
      done.hidden = false;
      var mail = $('#done-mailto', done), title = $('#done-title', done), text = $('#done-text', done);
      if (res.mode === 'mailto') {
        title.textContent = 'Plus qu\'un clic !';
        text.textContent = 'Votre messagerie s\'est ouverte avec votre projet déjà rédigé : envoyez le message, et ajoutez votre logo ou vos fichiers si vous en avez. Nous revenons vers vous ensuite avec une proposition sur mesure.';
        mail.hidden = false; mail.href = res.href;
      } else {
        title.textContent = 'Merci, c\'est bien reçu !';
        text.textContent = 'Nous étudions votre projet et revenons vers vous avec une proposition sur mesure.';
        mail.hidden = true;
      }
      var h = $('#done-title', done); h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true });
      if (quiz.getBoundingClientRect().top < 0) quiz.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }

    quizForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate(current)) return;
      if (current < RECAP) { goTo(current + 1, 'next'); return; }
      if (isSpam(quizForm)) { showDone({ mode: 'sent' }); return; }
      var subject = 'Demande de devis — ' + radioVal('besoin') + ' (' + val('q-prenom') + ' ' + val('q-nom') + ')';
      sendBtn.disabled = true;
      deliver(quizForm, subject, collectPairs()).then(showDone).catch(function () {
        setError(RECAP, 'L\'envoi a échoué. Réessayez, ou écrivez-nous à ' + CONFIG.mailTo + '.');
      }).then(function () { sendBtn.disabled = false; });
    });

    refresh();
  }
  /* ---------- Réalisations : filtres + visionneuse ---------- */
  (function () {
    var grid = $('#rgrid');
    if (!grid) return;
    var items = $$('li', grid);
    var chips = $$('.filter');
    var empty = $('#rgrid-empty');
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var cat = chip.getAttribute('data-filter');
        chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
        var shown = 0;
        items.forEach(function (li) {
          var ok = cat === 'all' || li.getAttribute('data-cat') === cat;
          li.hidden = !ok;
          if (ok) { shown++; li.classList.add('is-visible'); }
        });
        if (empty) empty.hidden = shown > 0;
      });
    });

    var dlg = $('#lightbox');
    if (!dlg || typeof dlg.showModal !== 'function') return;
    var img = $('#lb-img'), cap = $('#lb-cap'), cur = 0, lastFocus = null;
    function visible() { return items.filter(function (li) { return !li.hidden; }); }
    function show(li) {
      var b = $('.rshot', li);
      img.src = b.getAttribute('data-full');
      img.alt = b.getAttribute('data-alt');
      cap.textContent = b.getAttribute('data-title');
    }
    function step(d) {
      var v = visible(); if (!v.length) return;
      cur = (cur + d + v.length) % v.length;
      show(v[cur]);
    }
    items.forEach(function (li) {
      $('.rshot', li).addEventListener('click', function (e) {
        lastFocus = e.currentTarget;
        var v = visible(); cur = v.indexOf(li); show(li);
        dlg.showModal();
      });
    });
    $('.lb-prev', dlg).addEventListener('click', function () { step(-1); });
    $('.lb-next', dlg).addEventListener('click', function () { step(1); });
    $('.lb-close', dlg).addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
    dlg.addEventListener('close', function () { img.removeAttribute('src'); if (lastFocus) lastFocus.focus(); });
  })();
})();
