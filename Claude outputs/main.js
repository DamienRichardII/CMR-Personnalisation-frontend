/* CMR Personnalisation — interactions légères (vanilla JS) */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var desktopMQ = window.matchMedia('(min-width: 992px)');

  /* ---------- Liens provisoires "#" : ne pas remonter en haut de page ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href="#"]');
    if (a) e.preventDefault();
  });

  /* ---------- Header : état "scrollé" ---------- */
  var header = document.querySelector('.site-header');
  var ticking = false;
  function updateHeader() {
    header.classList.toggle('is-scrolled', window.scrollY > 24);
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(updateHeader); }
  }, { passive: true });
  updateHeader();

  /* ---------- Menu mobile ---------- */
  var toggle = document.querySelector('.menu-toggle');
  var panel = document.getElementById('nav-panel');

  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    panel.classList.toggle('is-open', open);
    document.body.style.overflow = open && !desktopMQ.matches ? 'hidden' : '';
  }
  toggle.addEventListener('click', function () {
    setMenu(toggle.getAttribute('aria-expanded') !== 'true');
  });
  panel.addEventListener('click', function (e) {
    if (e.target.closest('a') && !desktopMQ.matches) setMenu(false);
  });
  desktopMQ.addEventListener('change', function () { setMenu(false); });

  /* ---------- Dropdown "Nos produits" ---------- */
  var dropItem = document.querySelector('.has-dropdown');
  var dropBtn = dropItem.querySelector('.dropdown-toggle');
  var dropMenu = dropItem.querySelector('.dropdown');
  var closeTimer;

  function setDropdown(open) {
    dropBtn.setAttribute('aria-expanded', String(open));
    dropMenu.classList.toggle('is-open', open);
  }
  var openedByHover = false;
  dropBtn.addEventListener('click', function () {
    if (openedByHover) { openedByHover = false; return; } /* survol déjà ouvert : le clic ne le referme pas */
    setDropdown(dropBtn.getAttribute('aria-expanded') !== 'true');
  });
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    dropItem.addEventListener('mouseenter', function () {
      if (!desktopMQ.matches) return;
      clearTimeout(closeTimer);
      if (dropBtn.getAttribute('aria-expanded') !== 'true') openedByHover = true;
      setDropdown(true);
    });
    dropItem.addEventListener('mouseleave', function () {
      if (!desktopMQ.matches) return;
      closeTimer = setTimeout(function () { openedByHover = false; setDropdown(false); }, 140);
    });
  }
  document.addEventListener('click', function (e) {
    if (!dropItem.contains(e.target)) setDropdown(false);
  });
  dropItem.addEventListener('focusout', function (e) {
    if (!dropItem.contains(e.relatedTarget)) setDropdown(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (dropBtn.getAttribute('aria-expanded') === 'true') { setDropdown(false); dropBtn.focus(); }
    if (toggle.getAttribute('aria-expanded') === 'true') { setMenu(false); toggle.focus(); }
  });

  /* ---------- Thème clair / sombre ---------- */
  var themeBtn = document.querySelector('.theme-switch');
  function syncTheme() {
    themeBtn.setAttribute('aria-checked', String(root.getAttribute('data-theme') !== 'light'));
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', root.getAttribute('data-theme') === 'light' ? '#ffffff' : '#060b13');
  }
  themeBtn.setAttribute('aria-label', 'Mode sombre');
  themeBtn.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('cmr-theme', next); } catch (e) {}
    syncTheme();
  });
  syncTheme();

  /* ---------- Révélations au scroll (une seule fois) + stagger ---------- */
  document.querySelectorAll('[data-stagger]').forEach(function (group) {
    Array.prototype.forEach.call(group.children, function (child, i) {
      child.style.setProperty('--d', (i * 80) + 'ms');
    });
  });

  var targets = document.querySelectorAll(
    '.fade-up, .fade-down, .fade-left, .fade-right, .scale-in, .reveal, .title-reveal, .savoir-media'
  );
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(function (el) { io.observe(el); });
  } else {
    targets.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------- Parallax très subtil (desktop uniquement) ---------- */
  var plx = Array.prototype.map.call(document.querySelectorAll('[data-parallax]'), function (el) {
    return { el: el, speed: parseFloat(el.getAttribute('data-parallax')) || 0.05, on: false };
  });

  function runParallax() {
    var vh = window.innerHeight;
    plx.forEach(function (p) {
      if (!p.on) return;
      var r = p.el.getBoundingClientRect();
      var offset = (r.top + r.height / 2 - vh / 2) * -p.speed;
      offset = Math.max(-16, Math.min(16, offset));
      var imgs = p.el.getElementsByTagName('img');
      for (var i = 0; i < imgs.length; i++) {
        imgs[i].style.transform = "translate3d(0," + offset.toFixed(1) + "px,0) scale(1.05)";
      }
    });
  }

  if ('IntersectionObserver' in window && !reduceMotion) {
    var pio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        plx.forEach(function (p) { if (p.el === entry.target) p.on = entry.isIntersecting && desktopMQ.matches; });
      });
      runParallax();
    }, { rootMargin: '80px 0px' });
    plx.forEach(function (p) { pio.observe(p.el); });

    var pTicking = false;
    window.addEventListener('scroll', function () {
      if (!desktopMQ.matches || pTicking) return;
      pTicking = true;
      requestAnimationFrame(function () { runParallax(); pTicking = false; });
    }, { passive: true });
    desktopMQ.addEventListener('change', function () {
      if (!desktopMQ.matches) {
        plx.forEach(function (p) {
          p.on = false;
          Array.prototype.forEach.call(p.el.getElementsByTagName('img'), function (img) { img.style.transform = ''; });
        });
      }
    });
  }
})();
