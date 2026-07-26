/* Wohnideen Hueter — Interaktion
 * Minimal, ohne externe Abhängigkeiten. Respektiert prefers-reduced-motion.
 */
(function () {
  'use strict';
  var doc = document;

  /* --- Header: Scroll-Zustand ------------------------------------------- */
  var header = doc.querySelector('[data-header]');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 24);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* --- Mobile-Navigation ------------------------------------------------- */
  var toggle = doc.querySelector('[data-nav-toggle]');
  var mnav = doc.querySelector('[data-mobile-nav]');
  if (toggle && mnav) {
    var closeNav = function () {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Menü öffnen');
      mnav.classList.remove('is-open');
      doc.body.style.overflow = '';
      setTimeout(function () { if (!mnav.classList.contains('is-open')) mnav.hidden = true; }, 300);
    };
    var openNav = function () {
      mnav.hidden = false;
      // Reflow, damit die Transition greift
      void mnav.offsetHeight;
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Menü schließen');
      mnav.classList.add('is-open');
      doc.body.style.overflow = 'hidden';
    };
    toggle.addEventListener('click', function () {
      if (toggle.getAttribute('aria-expanded') === 'true') closeNav(); else openNav();
    });
    mnav.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeNav();
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { closeNav(); toggle.focus(); }
    });
    // Bei Wechsel auf Desktop schließen
    window.matchMedia('(min-width:1080px)').addEventListener('change', function (e) {
      if (e.matches) closeNav();
    });
  }

  /* --- Reveal-Animationen (IntersectionObserver) ------------------------- */
  var reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var reveals = doc.querySelectorAll('[data-reveal]');
  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* --- Sanftes Parallax für große Hero-Bilder ---------------------------- */
  if (!reduce) {
    var media = doc.querySelectorAll('[data-parallax]');
    if (media.length) {
      var ticking = false;
      var update = function () {
        var y = window.scrollY;
        media.forEach(function (m) {
          m.style.transform = 'translate3d(0,' + (y * 0.12).toFixed(1) + 'px,0) scale(1.06)';
        });
        ticking = false;
      };
      window.addEventListener('scroll', function () {
        if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
      }, { passive: true });
    }
  }

  /* --- Kontaktformular ---------------------------------------------------
   * Statisches Hosting ohne Backend: Wir validieren clientseitig und öffnen
   * eine vorbereitete E-Mail an das Büro. So sind keine externen Dienste und
   * kein Tracking nötig (DSGVO-freundlich).
   * TODO (Betreiber): Bei Bedarf hier ein echtes Formular-Endpoint (z.B.
   * datenschutzkonformes Backend / Mailservice) anbinden.
   * ---------------------------------------------------------------------- */
  var form = doc.querySelector('[data-contact-form]');
  if (form) {
    var status = form.querySelector('[data-form-status]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var f = form.elements;
      var val = function (n) { return f[n] ? String(f[n].value).trim() : ''; };
      var pref = (form.querySelector('input[name="kontaktart"]:checked') || {}).value || 'egal';

      var lines = [
        'Anfrage über wohnideen-hueter.at',
        '--------------------------------',
        'Name: ' + val('name'),
        'E-Mail: ' + val('email'),
        'Telefon: ' + (val('telefon') || '—'),
        'Bereich: ' + (val('bereich') || '—'),
        'Bevorzugter Kontakt: ' + pref,
        '',
        'Nachricht:',
        val('nachricht')
      ];
      var to = form.getAttribute('data-mailto') || 'office@wohnideen-hueter.at';
      var subject = 'Beratungsanfrage: ' + (val('bereich') || 'Einrichtung') + ' – ' + val('name');
      var href = 'mailto:' + to + '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(lines.join('\n'));

      if (status) {
        status.className = 'form-status ok';
        status.textContent = 'Danke, ' + (val('name').split(' ')[0] || 'für Ihre Anfrage') +
          '! Ihr E-Mail-Programm öffnet sich mit der vorbereiteten Nachricht. Sollte sich nichts öffnen, erreichen Sie uns direkt unter ' + to + ' oder telefonisch.';
        status.setAttribute('role', 'status');
      }
      window.location.href = href;
    });
  }

  /* --- Karte: Zwei-Klick-Lösung (DSGVO) ---------------------------------- */
  doc.querySelectorAll('[data-map]').forEach(function (box) {
    var btn = box.querySelector('[data-map-load]');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var f = doc.createElement('iframe');
      f.className = 'map-embed';
      f.title = box.getAttribute('data-map-title') || 'Karte';
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer';
      f.src = box.getAttribute('data-map-src');
      box.replaceWith(f);
    });
  });

  /* --- Fußzeilen-Jahr (falls irgendwo dynamisch gebraucht) --------------- */
  doc.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
