/* Devis : si le visiteur est connecté à son espace client, reprend ses coordonnées et propose ses fichiers enregistrés. */
(function () {
  'use strict';
  var cfg = window.CMR_SUPABASE; if (!cfg) return;
  var hasSession = false;
  try { for (var i = 0; i < localStorage.length; i++) { if (/^sb-.*-auth-token$/.test(localStorage.key(i))) hasSession = true; } } catch (e) {}
  if (!hasSession) return;
  var form = document.getElementById('quiz-form') || document.querySelector('form.quiz, form#devis-form, form');
  var s = document.createElement('script'); s.src = 'js/vendor/supabase.js';
  s.onload = function () { run(window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true } })); };
  document.head.appendChild(s);

  function setIfEmpty(id, v) { var el = document.getElementById(id); if (el && v && !el.value) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); } }
  function run(sb) {
    sb.auth.getSession().then(function (r) {
      var user = r.data && r.data.session && r.data.session.user; if (!user) return;
      sb.from('clients').select('prenom,nom,entreprise,telephone,code_postal,ville').eq('id', user.id).maybeSingle().then(function (c) {
        var d = c.data || {};
        setIfEmpty('q-prenom', d.prenom); setIfEmpty('q-nom', d.nom); setIfEmpty('q-entreprise', d.entreprise);
        setIfEmpty('q-email', user.email); setIfEmpty('q-tel', d.telephone);
        setIfEmpty('q-ville', [d.ville, d.code_postal].filter(Boolean).join(' '));
      });
      offerFiles(sb, user);
    });
  }
  function offerFiles(sb, user) {
    var host = document.getElementById('logo-upload'), input = host && host.querySelector('input[type="file"]');
    if (!input) return;
    sb.storage.from('client-fichiers').list(user.id, { limit: 50 }).then(function (r) {
      var rows = (r.data || []).filter(function (f) { return f.name && f.name !== '.emptyFolderPlaceholder'; });
      if (!rows.length) return;
      var box = document.createElement('div'); box.className = 'saved-files'; box.style.cssText = 'margin-top:12px;font-size:.85rem';
      var t = document.createElement('p'); t.textContent = 'Vos fichiers enregistrés :'; t.style.cssText = 'margin:0 0 6px;color:var(--color-muted)'; box.appendChild(t);
      rows.forEach(function (f) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-outline btn-sm'; b.style.cssText = 'margin:0 6px 6px 0;padding:.45rem .9rem;font-size:.8rem';
        b.textContent = '+ ' + f.name.replace(/^\d+-/, '');
        b.addEventListener('click', function () {
          b.disabled = true;
          sb.storage.from('client-fichiers').download(user.id + '/' + f.name).then(function (x) {
            b.disabled = false; if (x.error || !x.data) return;
            try {
              var dt = new DataTransfer(), file = new File([x.data], f.name.replace(/^\d+-/, ''), { type: x.data.type });
              Array.prototype.forEach.call(input.files, function (e) { dt.items.add(e); });
              dt.items.add(file); input.files = dt.files;
              input.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (e) {}
          });
        });
        box.appendChild(b);
      });
      host.appendChild(box);
    });
  }
})();
