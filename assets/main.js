// STOLBASZ — drobna interaktywność (nav mobile + reveal)
(function () {
  // mobilne menu
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      links.classList.toggle('open');
    });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { links.classList.remove('open'); });
    });
  }

  // reveal przy scrollu
  var els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    els.forEach(function (el) { el.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  els.forEach(function (el) { io.observe(el); });
  // od razu pokaż to, co jest w pierwszym ekranie (hero/intro) — nie czekaj na próg observera.
  // (hero bywa WYŻSZE niż viewport i nigdy nie osiąga 12% swojej powierzchni → zostawało puste do scrolla)
  requestAnimationFrame(function () {
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.9 && r.bottom > 0) { el.classList.add('in'); io.unobserve(el); }
    });
  });
})();

// nav kondensuje się po przewinięciu (cienka linia + niższy pasek) — addytywne, lekkie
(function () {
  var nav = document.querySelector('.nav') || document.querySelector('header');
  if (!nav) return;
  var ticking = false;
  function upd() { nav.classList.toggle('is-stuck', window.scrollY > 24); ticking = false; }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(upd); }
  }, { passive: true });
  upd();
})();

/* === MOTION LAYER v2 (silnik) === */
/* ============================================================
   MOTION LAYER v2 — logika ruchu (2026-07-26). Para do motion.css.
   ------------------------------------------------------------
   FILOZOFIA BEZPIECZEŃSTWA: ten plik może paść w całości i strona ma dalej
   wyglądać jak przed nim. Dlatego:
     - klasę `mt-on` (która dopiero WŁĄCZA stany początkowe w CSS) dodajemy
       na samym KOŃCU udanej inicjalizacji, w try/catch,
     - każdy podział tekstu zapamiętuje oryginalny HTML i cofa go przy błędzie,
     - watchdog po 2.5 s odsłania wszystko, co widać na ekranie (gdyby
       IntersectionObserver z jakiegoś powodu nie zadziałał).
   Nie dotykamy hero-obrazu ani niczego w pierwszej sekcji — hero rusza się
   wyłącznie tekstem (zakaz ruchu geometrycznego na .hero-cine>img).
   ============================================================ */
(function () {
  'use strict';

  var docEl = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;                       // user woli spokój — zero ruchu
  if (!('IntersectionObserver' in window)) return;

  var STEP = 0.09;                          // odstęp między liniami nagłówka (s)

  /* ---------- pomocnicze ---------- */
  function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function firstScreen(el) {                // czy element leży w sekcji-hero (nie ruszamy)
    return !!el.closest('header, .nav, section:first-of-type, .hero-cine, .pagehead, [class*="hero"]');
  }

  /* ---------- 1) NAGŁÓWKI: podział na realne linie ----------
     Mierzymy pozycję każdego słowa po złamaniu tekstu, grupujemy słowa o tym
     samym offsetTop w jedną linię i owijamy w maskę. Robione PO załadowaniu
     fontów — inaczej linie policzyłyby się dla fontu zastępczego. */
  function splitLines(el) {
    if (!el || el.dataset.mtDone) return false;
    var raw = el.innerHTML;
    var txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
    // złożony markup (span z akcentem, link, ikona) albo bardzo długi tekst → prostszy wariant
    if (!txt || txt.length > 180 || el.querySelector('img,svg,a,button,picture,span,small,br')) return false;
    try {
      var words = txt.split(' ');
      el.textContent = '';
      words.forEach(function (w, i) {
        var s = document.createElement('i');
        s.className = 'mt-w';
        s.style.fontStyle = 'inherit';
        s.style.display = 'inline-block';
        s.textContent = w;
        el.appendChild(s);
        if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
      });
      // grupowanie po pozycji pionowej = realne linie po złamaniu
      var lines = [], last = null;
      all('.mt-w', el).forEach(function (w) {
        var top = w.offsetTop;
        if (last === null || Math.abs(top - last) > 4) { lines.push([]); last = top; }
        lines[lines.length - 1].push(w.textContent);
      });
      if (!lines.length) throw new Error('brak linii');
      el.textContent = '';
      lines.forEach(function (words2, i) {
        var line = document.createElement('span');
        line.className = 'mt-line';
        var inner = document.createElement('i');
        inner.textContent = words2.join(' ');
        inner.style.setProperty('--mt-d', (i * STEP).toFixed(2) + 's');
        line.appendChild(inner);
        el.appendChild(line);
      });
      el.classList.add('mt-lines');
      el.dataset.mtDone = '1';
      return true;
    } catch (e) {
      el.innerHTML = raw;                   // awaria → oryginalny nagłówek wraca
      return false;
    }
  }

  function prepHeadings() {
    // h1 pierwszego ekranu (hero) — jedyny ruch, jaki hero dostaje
    var h1 = document.querySelector('section h1, header h1, .hero h1, .hero-cine h1');
    if (h1 && !splitLines(h1)) { h1.classList.add('mt-fade'); }
    if (h1) { requestAnimationFrame(function () { h1.classList.add('mt-in'); }); }

    // nagłówki sekcji — wchodzą, gdy sekcja pojawia się w oknie
    var heads = all('.head h2').filter(function (h) { return !firstScreen(h); });
    heads.forEach(function (h) { if (!splitLines(h)) h.classList.add('mt-fade'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('mt-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
    heads.forEach(function (h) { io.observe(h); });
    // cokolwiek jest już widoczne — pokaż od razu (nie czekaj na scroll)
    requestAnimationFrame(function () {
      heads.forEach(function (h) {
        var r = h.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.92 && r.bottom > 0) { h.classList.add('mt-in'); io.unobserve(h); }
      });
    });
  }

  /* ---------- 2) ZDJĘCIA: kurtyna + zoom-out, parallax na kaflach ---------- */
  function prepPhotos() {
    var HOSTS = '.tile, .gateway, .split-art, .svc-row-art, .g-fig, .doc-fig, .art-fig, .zespol-card figure, .m-tile';
    all(HOSTS).forEach(function (host) {
      if (firstScreen(host)) return;                       // hero/pagehead zostają nietknięte (LCP)
      var img = host.querySelector(':scope > img, :scope > picture > img');
      if (!img) return;
      host.classList.add('mt-ph');
      // parallax tylko tam, gdzie kadr ma stałą wysokość (kafle bento, bramy) —
      // w masonry (height:auto) rozjechałby układ
      if ((host.classList.contains('tile') && host.closest('.gallery')) || host.classList.contains('gateway')) {
        host.classList.add('mt-para');
      }
      // element bez .reveal nie dostanie klasy .in od base.js → własny obserwator
      if (!host.classList.contains('reveal') && !host.closest('.reveal')) {
        phIO.observe(host);
      }
    });
  }
  var phIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('mt-in'); phIO.unobserve(e.target); }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });

  /* ---------- 3) STAGGER: kolejne elementy siatki wchodzą po sobie ---------- */
  function prepStagger() {
    var groups = {};
    all('.reveal').forEach(function (el) {
      var p = el.parentElement;
      if (!p) return;
      var key = p;
      if (!groups.k) groups.k = [];
      if (groups.k.indexOf(key) === -1) groups.k.push(key);
    });
    (groups.k || []).forEach(function (parent) {
      var kids = Array.prototype.filter.call(parent.children, function (c) { return c.classList.contains('reveal'); });
      if (kids.length < 2) return;
      kids.forEach(function (k, i) { k.style.setProperty('--i', Math.min(i, 7)); });
    });
  }

  /* ---------- 4) LICZBY: doliczanie od zera przy wejściu w ekran ----------
     Tylko czyste liczby (z opcjonalnym +, %, przecinkiem) — nigdy nie ruszamy
     tekstu typu „od 2011" w sposób, który zmieniłby jego treść. */
  function prepCounters() {
    // Klasy liczb-statystyk używane przez generator (per rodzina):
    //   .tb-num  fachowcy · .ds-num  dom · .kt-num  klinika · .num  pasek faktów (base)
    // ⛔ NIE ruszamy .hf-phone-num (to NUMER TELEFONU — animowanie go byłoby wpadką)
    // ani .pno (numery kroków procesu: 01, 02, 03 — to numeracja, nie statystyka).
    var DIRECT = '.tb-num, .ds-num, .kt-num, .num';
    var SCOPE = '.strip, .trust-band, .trust-grid, .spec-band, .stats, .tb-stats, .dom-stats, .kt-stats';
    var nodes = [];
    var cand = all(DIRECT).filter(function (el) {
      return !el.classList.contains('hf-phone-num') && !el.classList.contains('pno') && !el.children.length;
    });
    all(SCOPE).forEach(function (box) {
      all('b, strong, dt', box).forEach(function (el) { if (cand.indexOf(el) === -1) cand.push(el); });
    });
    cand.forEach(function (el) {
      var t = (el.textContent || '').trim();
      var m = t.match(/^(\d{1,6})([.,]\d{1,2})?\s*([+%a-zA-Zł]{0,3})$/);
      if (!m) return;
      var val = parseFloat(m[1] + (m[2] ? '.' + m[2].slice(1) : ''));
      if (!isFinite(val) || val <= 0 || val > 100000) return;
      if (val > 1900 && val < 2100) return;                // rok („od 2011") — nie animujemy
      el.dataset.mtTo = String(val);
      el.dataset.mtDec = m[2] ? String(m[2].length - 1) : '0';
      el.dataset.mtSuf = m[3] || '';
      el.classList.add('mt-num');
      nodes.push(el);
    });
    if (!nodes.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        runCount(e.target);
      });
    }, { threshold: 0.4 });
    nodes.forEach(function (n) { io.observe(n); });
  }
  function runCount(el) {
    var to = parseFloat(el.dataset.mtTo), dec = parseInt(el.dataset.mtDec, 10) || 0, suf = el.dataset.mtSuf || '';
    var dur = 1100, t0 = null;
    function frame(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      var v = (to * eased).toFixed(dec).replace('.', ',');
      el.textContent = v + suf;
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = to.toFixed(dec).replace('.', ',') + suf;
    }
    requestAnimationFrame(frame);
  }

  /* ---------- 4b) ŻYWY NAGŁÓWEK — przenikanie kadrów ----------
     Kadry podaje silnik w atrybucie data-rotate (nasza biblioteka branżowa, nie klient).
     ⛔ ZERO skalowania i przesuwania — zmienia się WYŁĄCZNIE przezroczystość, bo to
     skalowanie bitmapy dawało migotanie na teksturach (3x zgłoszenie Szymona).
     Idiotoodporność: dodatkowe kadry dociągamy DOPIERO po pełnym załadowaniu strony
     (zero wpływu na szybkość wejścia), a rotacja startuje dopiero, gdy kadr faktycznie
     się wczytał. Cokolwiek zawiedzie — zostaje zwykłe, statyczne zdjęcie jak dotąd. */
  /* ⛔ BRAMKA OSZCZĘDNOŚCIOWA (27.07 — zgłoszenie „zamula demo").
     Rotacja to jedyny element warstwy, który dociąga DANE (2 kadry ≈ 0,4-0,5 MB). Sam kod
     warstwy waży 23 KB i jest bez znaczenia, ale te zdjęcia na telefonie w słabym zasięgu
     realnie mielą w tle. Dlatego kadry lecą TYLKO tam, gdzie są za darmo:
     - telefon (<900px) → NIE (hero jest mały, efektu prawie nie widać, koszt ten sam),
     - tryb oszczędzania danych albo 2G/3G → NIE,
     - słaby sprzęt (≤2 GB RAM) → NIE (przełączanie pełnoekranowej bitmapy go dławi).
     Bez rotacji strona wygląda dokładnie jak dotąd — hero po prostu stoi. */
  function rotacjaOplacalna() {
    try {
      if (window.matchMedia && !window.matchMedia('(min-width: 900px)').matches) return false;
      var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (c) {
        if (c.saveData) return false;
        if (/(^|-)2g$|^3g$/.test(c.effectiveType || '')) return false;
      }
      if (navigator.deviceMemory && navigator.deviceMemory <= 2) return false;
    } catch (e) { /* stara przeglądarka — puszczamy dalej */ }
    return true;
  }

  function prepHeroRotation() {
    var host = document.querySelector('img[data-rotate]');
    if (!host) return;
    if (!rotacjaOplacalna()) return;
    var srcs = (host.getAttribute('data-rotate') || '').split('|').filter(Boolean);
    if (!srcs.length) return;
    var box = host.parentElement;
    if (!box) return;
    if (getComputedStyle(box).position === 'static') box.style.position = 'relative';

    var layers = [];
    // Kadry pobieramy PO KOLEI, nie wszystkie naraz — drugi rusza dopiero, gdy pierwszy jest
    // na miejscu. Dzięki temu nie ma jednego skoku transferu tuż po otwarciu strony.
    (function pobierzKolejny(n) {
      if (n >= srcs.length) return;
      var im = new Image();
      im.decoding = 'async';
      im.alt = '';
      // Warstwa przejmuje klasy zdjęcia-nagłówka (np. hg-bg w gastro), żeby dziedziczyć jego
      // wygląd i ewentualny delikatny zoom tła. Bez tego ruch „zacinałby się" przy zmianie kadru.
      im.className = ('mt-hero-layer ' + (host.className || '')).trim();
      im.onload = function () {
        box.insertBefore(im, host.nextSibling);
        layers.push(im);
        if (layers.length === 1) start();
        setTimeout(function () { pobierzKolejny(n + 1); }, 3000);
      };
      im.onerror = function () { pobierzKolejny(n + 1); };  // brak kadru = pomijamy, lecimy dalej
      im.src = srcs[n];
    })(0);

    function start() {
      var all = [host].concat(layers), i = 0;
      setInterval(function () {
        if (document.hidden) return;                 // karta w tle — nie marnujemy baterii
        all = [host].concat(layers);
        if (all.length < 2) return;
        var prev = i; i = (i + 1) % all.length;
        all[i].classList.add('mt-show');
        all[prev].classList.remove('mt-show');
        if (all[prev] === host) host.classList.add('mt-under');
      }, 6500);
    }
  }

  /* ---------- 5) MAGNETYCZNE CTA (tylko mysz, maks. 4 px) ---------- */
  function prepMagnetic() {
    if (!window.matchMedia || !window.matchMedia('(pointer: fine)').matches) return;
    all('.btn-accent, .btn-light').slice(0, 12).forEach(function (b) {
      b.addEventListener('mousemove', function (ev) {
        var r = b.getBoundingClientRect();
        var dx = (ev.clientX - (r.left + r.width / 2)) / r.width;
        var dy = (ev.clientY - (r.top + r.height / 2)) / r.height;
        b.style.translate = (dx * 8).toFixed(1) + 'px ' + (dy * 5).toFixed(1) + 'px';
      });
      b.addEventListener('mouseleave', function () { b.style.translate = '0 0'; });
    });
  }

  /* ---------- 6) PASEK POSTĘPU (tylko gdy przeglądarka umie scroll-driven) ---------- */
  function prepProgress() {
    if (!(window.CSS && CSS.supports && CSS.supports('animation-timeline', 'scroll()'))) return;
    var bar = document.createElement('div');
    bar.className = 'mt-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
  }

  /* ---------- 7) WATCHDOG — nic nie ma prawa zostać niewidoczne ---------- */
  function watchdog() {
    setTimeout(function () {
      all('.mt-ph, .mt-lines, .mt-fade').forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) { el.classList.add('mt-in', 'in'); }
      });
    }, 2500);
  }

  /* ---------- 7b) ZWALNIANIE WARSTW GPU PO ANIMACJI ----------
     `.reveal` z base.css ma stałe `will-change:opacity,transform` — przeglądarka trzyma dla
     każdego takiego elementu osobną warstwę w pamięci karty graficznej i NIGDY jej nie oddaje
     (~26 warstw na podstronę). Na komputerze ze słabszą grafiką to niepotrzebny stały koszt.
     Gdy przejście się skończy, dokładamy `mt-settled` → CSS zwalnia warstwę.
     Bez JS wszystko zostaje jak było — zero ryzyka.
     ⚠️ `transitionend` odpadł jako hak — sprawdzone: przy elementach poza ekranem zdarzenie
     w ogóle nie przychodzi (przeglądarka nie animuje tego, czego nie widać). Dlatego pilnujemy
     samej klasy `.in`: gdy element ją dostanie, po 1,6 s (dłużej niż najdłuższe przejście: 1,15 s)
     oddajemy warstwę. Obserwator rozłącza się sam, gdy wszystko już osiadło. */
  function prepGpuRelease() {
    var cele = all('.reveal, .mt-ph');
    if (!cele.length || !window.MutationObserver) return;
    var zostalo = cele.length;

    function osiadl(el) {
      if (el.classList.contains('mt-settled')) return;
      el.classList.add('mt-settled');
      if (--zostalo <= 0) obs.disconnect();
    }
    var obs = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        var el = m.target;
        if (el.classList && el.classList.contains('in') && !el.classList.contains('mt-settled')) {
          setTimeout(function () { osiadl(el); }, 1600);
        }
      });
    });
    cele.forEach(function (el) {
      obs.observe(el, { attributes: true, attributeFilter: ['class'] });
      if (el.classList.contains('in')) setTimeout(function () { osiadl(el); }, 1600);
    });
  }

  /* ---------- START ---------- */
  function init() {
    try {
      prepGpuRelease();
      prepStagger();
      prepPhotos();
      prepCounters();
      prepMagnetic();
      prepProgress();
      if (document.readyState === 'complete') prepHeroRotation();
      else addEventListener('load', prepHeroRotation);   // kadry dopiero po załadowaniu strony
      docEl.classList.add('mt-on');    // dopiero teraz CSS ukrywa stany startowe
      prepHeadings();                  // nagłówki po pomiarze (fonty gotowe)
      watchdog();
    } catch (e) {
      docEl.classList.remove('mt-on'); // cokolwiek padło → wracamy do wyglądu bazowego
    }
  }

  function boot() {
    if (document.fonts && document.fonts.ready) {
      var done = false;
      var go = function () { if (!done) { done = true; init(); } };
      document.fonts.ready.then(go);
      setTimeout(go, 1200);            // font nie doszedł → i tak startujemy
    } else { init(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();


/* === licznik otwarć demo (buy-signal) + geo === */
(function(){try{if(String(location.protocol).indexOf('http')!==0)return;try{if(/[?&#]team=1/.test(location.search+location.hash)){localStorage.setItem('nb_team','1');}}catch(e){}try{if(localStorage.getItem('nb_team')==='1')return;}catch(e){}if((document.referrer||'').indexOf('crm-newbeginning')>-1)return;if(sessionStorage.getItem('_dv'))return;sessionStorage.setItem('_dv','1');var seg=(location.pathname.split('/').filter(Boolean)[0])||'';var base=location.origin+(seg?('/'+seg):'');var ua='';try{ua=(navigator.userAgent||'').slice(0,300);}catch(e){}var EP='https://zngfubfinbojfgaxdrbf.supabase.co/rest/v1/demo_views';var KEY='sb_publishable_MWwoyGlSCWnJ4awtOPF0ow_ZVS0Y8qK';function send(g){try{fetch(EP,{method:'POST',keepalive:true,headers:{'Content-Type':'application/json','apikey':KEY,'Authorization':'Bearer '+KEY,'Prefer':'return=minimal'},body:JSON.stringify({demo_url:base,page:location.pathname,referrer:(document.referrer||null),user_agent:(ua||null),ip:(g&&g.ip)||null,country:(g&&g.cc)||null,city:(g&&g.city)||null})}).catch(function(){});}catch(e){}}var done=false;function once(g){if(done)return;done=true;send(g);}try{var t=setTimeout(function(){once(null);},1500);fetch('https://ipwho.is/?fields=ip,success,country_code,city',{cache:'no-store'}).then(function(r){return r.json();}).then(function(d){clearTimeout(t);once(d&&d.success!==false?{ip:d.ip,cc:d.country_code,city:d.city}:null);}).catch(function(){clearTimeout(t);once(null);});}catch(e){once(null);}}catch(e){}})();
