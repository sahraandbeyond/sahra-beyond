/* ==========================================================================
   sahra-specimen.js: the Specimen Sheet product page (30 Oct 2026)
   ==========================================================================
   One script for all 22 product pages (markup from specimen.js):
     - the photo stage: Back / Front / Art / Worn tabs, a swipe between them on
       phones, numbered pins on the Art photo tied to the numbered list, and a
       tap that opens the shared zoom viewer (assets/sahra-zoom.js);
     - the sticky buy sheet: sizes from live Shopify stock (window.SahraCart
       .variants; a sold-out size is disabled, no counts are shown), Add to bag
       through window.SahraCart.add with the photo handed over for the Fold and
       Drop (assets/sahra-cart.js), and the GA4 events the old pages sent
       (size_select, add_to_cart, gallery_swipe, image_zoom).
   Photos after the first carry data-src and load after the page has loaded, or
   at the first tap (r88 site speed). Reduced motion: no fades.
   ========================================================================== */
(function () {
  'use strict';
  var stage = document.getElementById('ssStage');
  var buy = document.getElementById('ssBuy');
  if (!stage && !buy) return;
  var de = document.documentElement;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function tr(n, p) { try { if (window.track) window.track(n, p); } catch (e) {} }
  var handle = (buy && buy.getAttribute('data-handle')) || (stage && stage.getAttribute('data-handle')) || '';

  /* 14 Nov 2026: the details are closed groups (<details class="pdp-acc">); a link to anything inside one opens it first */
  function openTo(id) { var t = id && document.getElementById(id); if (!t) return; for (var d = t.closest && t.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true; }
  document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a[href^="#"]'); if (a) openTo(a.getAttribute('href').slice(1)); }, true);
  if (location.hash) openTo(location.hash.slice(1));
  addEventListener('hashchange', function () { openTo(location.hash.slice(1)); });
  /* ---------------- the stage ---------------- */
  /* 19 Nov 2026: the loop as the first view exists only for Meta ad visitors (html.sb-vf, set in the head); for everyone else
     it leaves the stage before anything counts the photos */
  var vf = de.classList.contains('sb-vf');
  if (stage && !vf) [stage.querySelector('.ss-v-loop'), document.querySelector('.ss-tab-loop')].forEach(function (x) { if (x) x.parentNode.removeChild(x); });
  var figs = stage ? [].slice.call(stage.querySelectorAll('.ss-v')) : [];
  var tabs = [].slice.call(document.querySelectorAll('.ss-tab'));
  var pins = stage ? [].slice.call(stage.querySelectorAll('.ss-pin')) : [];
  var noteEl = document.getElementById('ssNote');
  var listBtns = [].slice.call(document.querySelectorAll('.ss-notes button'));
  var cap = stage && stage.querySelector('.ss-cap'), mockTag = stage && stage.querySelector('.ss-mock');
  var cur = 0;
  figs.forEach(function (f, i) { if (f.classList.contains('on')) cur = i; });
  var lpf = stage && stage.querySelector('.ss-v-loop');
  if (lpf) {
    cur = figs.indexOf(lpf);
    figs.forEach(function (x) { x.classList.toggle('on', x === lpf); });
    tabs.forEach(function (t) { var on = t.getAttribute('data-v') === 'loop'; t.classList.toggle('on', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); });
    if (mockTag) mockTag.hidden = true; if (cap) cap.hidden = true;
    stage.classList.add('vf-on');
  }

  var hydrated = false;
  function hydrate() {
    if (hydrated) return; hydrated = true;
    figs.forEach(function (f) {
      var im = f.querySelector('img[data-src]');
      if (im) { if (im.getAttribute('data-srcset')) { im.setAttribute('sizes', im.getAttribute('data-sizes') || '100vw'); im.setAttribute('srcset', im.getAttribute('data-srcset')); } im.setAttribute('src', im.getAttribute('data-src')); im.removeAttribute('data-src'); }
      var bl = f.querySelector('.ss-blur[data-bg]'); if (bl) { bl.style.backgroundImage = 'url(' + bl.getAttribute('data-bg') + ')'; bl.removeAttribute('data-bg'); }
    });
  }
  if (figs.length > 1) {
    var later = function () { setTimeout(hydrate, 1200); };
    if (document.readyState === 'complete') later(); else addEventListener('load', later);
    setTimeout(hydrate, 8000);   /* a slow third-party request can hold the load event */
    ['touchstart', 'mouseenter', 'focusin'].forEach(function (k) { (stage.parentNode || stage).addEventListener(k, hydrate, { passive: true, once: true }); });
  }
  /* a note may have no number on the photo (12 Nov 2026: a part of the art outside a model photo), so pins are found by data-i */
  function pinAt(i) { for (var k = 0; k < pins.length; k++) if (+pins[k].getAttribute('data-i') === i) return pins[k]; return null; }
  function noteText(i) {
    var p = pinAt(i); if (p) return (p.getAttribute('aria-label') || '').replace(/^(?:Note|\u0645\u0644\u0627\u062d\u0638\u0629) \d+: /, '');
    var b = listBtns[i], sp = b && b.querySelector('span'); return sp ? sp.textContent : '';
  }
  function setNote(i) {
    pins.forEach(function (p) { var on = +p.getAttribute('data-i') === i; p.classList.toggle('on', on); p.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    listBtns.forEach(function (b, k) { b.classList.toggle('on', k === i); });
    if (!noteEl) return;
    if (i == null || i < 0) { noteEl.innerHTML = '<b>i</b><span>Tap a number on the print to read what is drawn there.</span>'; }
    else noteEl.innerHTML = '<b>' + (i + 1) + '</b><span>' + noteText(i).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>';
  }
  function show(i, why) {
    if (!figs.length) return;
    i = (i % figs.length + figs.length) % figs.length;
    hydrate();
    var f = figs[i], k = f.getAttribute('data-v');
    figs.forEach(function (x, j) { x.classList.toggle('on', j === i); });
    tabs.forEach(function (t) { var on = t.getAttribute('data-v') === k; t.classList.toggle('on', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); });
    stage.classList.toggle('art-on', k === 'art');
    var c = f.getAttribute('data-cap') || '';
    if (cap) { cap.textContent = c; cap.hidden = !c; }
    if (mockTag) mockTag.hidden = f.getAttribute('data-mock') !== '1';
    if (noteEl) { noteEl.hidden = k !== 'art'; if (k === 'art' && why !== 'pin') setNote(-1); }
    if (k !== 'art') pins.forEach(function (p) { p.classList.remove('on'); });
    cur = i;
    lpSync();
  }
  /* the loop in the stage plays only while it is the photo shown, the stage is on screen and the tab is visible; it loads
     after the page has loaded. A visitor's pause holds. The button follows what the video really does. */
  var lpv = lpf && lpf.querySelector('video'), lpt = lpf && lpf.querySelector('.ss-loop-t'), lpHeld = false, lpReady = false, lpVis = false;
  var LPW = /^ar\b/i.test(de.getAttribute('lang') || '') ? ['\u0625\u064a\u0642\u0627\u0641', '\u062a\u0634\u063a\u064a\u0644'] : ['Pause', 'Play'];
  function lpSync() {
    if (!lpv) return;
    if (lpReady && lpVis && !lpHeld && !document.hidden && lpf.classList.contains('on')) {
      if (lpv.getAttribute('data-src')) { lpv.src = lpv.getAttribute('data-src'); lpv.removeAttribute('data-src'); }
      var pr = lpv.play(); if (pr && pr.catch) pr.catch(function () {});
    } else if (!lpv.paused) lpv.pause();
  }
  if (lpv) {
    lpv.addEventListener('playing', function () { if (lpt) { lpt.hidden = false; lpt.textContent = LPW[0]; } });
    lpv.addEventListener('pause', function () { if (lpt) lpt.textContent = LPW[1]; });
    lpv.addEventListener('error', function () { lpv.hidden = true; if (lpt) lpt.hidden = true; });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { lpVis = es[es.length - 1].intersectionRatio >= 0.35; lpSync(); }, { threshold: [0, 0.35, 0.7] }).observe(stage); else lpVis = true;
    document.addEventListener('visibilitychange', lpSync);
    var lpGo = function () { lpReady = true; lpSync(); };
    if (document.readyState === 'complete') setTimeout(lpGo, 300); else addEventListener('load', function () { setTimeout(lpGo, 300); });
    setTimeout(lpGo, 8000);   /* a slow third-party request can hold the load event */
    if (lpt) lpt.addEventListener('click', function (e) { e.stopPropagation(); lpHeld = !lpHeld; lpSync(); tr(lpHeld ? 'loop_pause' : 'loop_play', { item_id: handle, where: 'stage' }); });
    tr('loop_first', { item_id: handle });
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      var k = t.getAttribute('data-v');
      for (var i = 0; i < figs.length; i++) if (figs[i].getAttribute('data-v') === k) { show(i, 'tab'); tr('gallery_tab', { item_id: handle, view: k }); break; }
    });
  });
  /* arrow keys move between the tabs (the WAI tabs pattern) */
  var tl = document.querySelector('.ss-tabs');
  if (tl) tl.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var rtl = getComputedStyle(tl).direction === 'rtl', d = (e.key === 'ArrowRight') !== rtl ? 1 : -1;
    var j = tabs.indexOf(document.activeElement); if (j < 0) return;
    var n = tabs[(j + d + tabs.length) % tabs.length]; n.focus(); n.click(); e.preventDefault();
  });
  function artIndex() { for (var i = 0; i < figs.length; i++) if (figs[i].getAttribute('data-v') === 'art') return i; return -1; }
  pins.forEach(function (p) {
    p.addEventListener('click', function (e) { e.stopPropagation(); setNote(+p.getAttribute('data-i')); tr('art_note', { item_id: handle, note: +p.getAttribute('data-i') + 1 }); });
  });
  listBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var i = +b.getAttribute('data-i'), a = artIndex(); if (a < 0) return;
      show(a, 'pin'); setNote(i);
      var r = stage.getBoundingClientRect();
      if (r.top < 60 || r.bottom > innerHeight - 120) stage.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      tr('art_note', { item_id: handle, note: i + 1, from: 'list' });
    });
  });
  /* swipe between the photos (phones); a swipe is never a zoom tap */
  if (stage && figs.length > 1) {
    var sx = null, sy = null, swiped = false, swipes = 0;
    stage.addEventListener('touchstart', function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (sx === null) return; var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; sx = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        var rtl = getComputedStyle(stage).direction === 'rtl';
        show(cur + ((dx < 0) !== rtl ? 1 : -1), 'swipe'); swiped = true; setTimeout(function () { swiped = false; }, 600);
        swipes++; tr('gallery_swipe', { item_id: handle, index: cur, count: swipes, ad: window.SB_AD ? 1 : 0 });
      }
    }, { passive: true });
    stage.addEventListener('click', function (e) {
      if (swiped || (e.target.closest && e.target.closest('.ss-pin,.ss-tabs,.ss-note,.ss-loop-t'))) return;
      zoom();
    });
  } else if (stage) stage.addEventListener('click', function (e) { if (!(e.target.closest && e.target.closest('.ss-pin,.ss-tabs,.ss-note'))) zoom(); });
  if (stage) stage.addEventListener('keydown', function (e) { if (e.target === stage && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); zoom(); } });
  function zoom() {
    if (!window.SahraZoom || !figs.length) return;
    if (figs[cur] === lpf) return;   /* the loop is not zoomed; its button pauses it */
    var still = figs.filter(function (f) { return f !== lpf; });
    var list = still.map(function (f) { var im = f.querySelector('img'); return { src: f.getAttribute('data-full') || (im && (im.currentSrc || im.src)), alt: (im && im.alt) || '' }; });
    try { window.SahraZoom.open(list, still.indexOf(figs[cur])); } catch (e) { return; }
    tr('image_zoom', { item_id: handle });
  }

  /* ---------------- On the model (2 Nov 2026) ----------------
     The model photos load only after the page has loaded and once their row is near the screen (or at the first touch,
     focus or arrow), so the stage's first photo keeps the bandwidth. A tap opens them in the zoom viewer. */
  /* ---------------- Beach-shoot loop (19 Nov 2026) ----------------
     A silent 7-second loop of the model wearing the design. It loads only after the page has loaded and once it is near the
     screen, plays while it is on screen and pauses when it leaves. Reduced motion or data saver: the still frame only.
     A Pause / Play button (WCAG 2.2.2), and a visitor's pause holds. */
  var lp = document.querySelector('[data-loop]');
  if (lp) (function () {
    var v = lp.querySelector('video'), t = lp.querySelector('.ss-loop-t'); if (!v) return;
    var still = reduced || (navigator.connection && navigator.connection.saveData);
    if (still || !('IntersectionObserver' in window)) return;
    var AR = /^ar\b/i.test(de.getAttribute('lang') || '');
    var W = AR ? ['إيقاف', 'تشغيل'] : ['Pause', 'Play'];
    var ready = false, on = false, held = false;
    function load() { if (v.getAttribute('data-src')) { v.src = v.getAttribute('data-src'); v.removeAttribute('data-src'); } }
    function sync() {
      if (!ready) return;
      if (on && !held && !document.hidden) { load(); var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); } else v.pause();
    }
    /* the button follows what the video really does (r147 review): shown once it plays, its word from the media events */
    function label() { if (t) t.textContent = v.paused ? W[1] : W[0]; }
    v.addEventListener('playing', function () { if (t) t.hidden = false; label(); });
    v.addEventListener('pause', label);
    v.addEventListener('error', function () { if (t) t.hidden = true; });
    new IntersectionObserver(function (es) { var e = es[es.length - 1]; on = e.isIntersecting && (e.intersectionRatio >= 0.35 || e.intersectionRect.height >= innerHeight * 0.6); sync(); }, { threshold: [0, 0.2, 0.35, 0.6] }).observe(lp);
    document.addEventListener('visibilitychange', sync);
    function go() { ready = true; sync(); }
    if (document.readyState === 'complete') setTimeout(go, 300); else addEventListener('load', function () { setTimeout(go, 300); });
    setTimeout(go, 8000);   /* as the model photos: a slow third-party request can hold the load event */
    if (t) t.addEventListener('click', function () { held = !held; sync(); tr(held ? 'loop_pause' : 'loop_play', { item_id: handle }); });
  })();

  var om = document.querySelector('[data-om]');
  if (om) (function () {
    var row = om.querySelector('.ss-om-row'), cells = [].slice.call(om.querySelectorAll('.ss-om-f')), bs = [].slice.call(om.querySelectorAll('.ss-om-b'));
    var done = false, armed = false;
    function fill() {
      if (done) return; done = true;
      [].forEach.call(om.querySelectorAll('img[data-src]'), function (im) {
        im.setAttribute('sizes', im.getAttribute('data-sizes') || '100vw'); im.setAttribute('srcset', im.getAttribute('data-srcset')); im.setAttribute('src', im.getAttribute('data-src'));
        im.removeAttribute('data-src'); im.removeAttribute('data-srcset'); im.removeAttribute('data-sizes');
      });
    }
    function arm() {
      if (armed) return; armed = true;
      if (!('IntersectionObserver' in window)) { fill(); return; }
      var io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); fill(); } }, { rootMargin: '300px 0px' });
      io.observe(om);
    }
    if (document.readyState === 'complete') setTimeout(arm, 300); else addEventListener('load', function () { setTimeout(arm, 300); });
    setTimeout(arm, 8000);   /* a slow third-party request can hold the load event */
    ['touchstart', 'focusin', 'mouseenter'].forEach(function (k) { om.addEventListener(k, fill, { passive: true, once: true }); });
    cells.forEach(function (c, i) {
      c.addEventListener('click', function () {
        fill();
        if (!window.SahraZoom) return;
        var list = cells.map(function (x) { var im = x.querySelector('img'); return { src: x.getAttribute('data-full'), alt: (im && im.alt) || '' }; });
        try { window.SahraZoom.open(list, i); } catch (e) { return; }
        tr('image_zoom', { item_id: handle, from: 'on_model', index: i });
      });
    });
    /* desktop arrows: one photo at a time; in Arabic the row runs right to left */
    function rtl() { return getComputedStyle(row).direction === 'rtl'; }
    function ends() {
      var max = row.scrollWidth - row.clientWidth, x = Math.abs(row.scrollLeft);
      if (bs[0]) bs[0].disabled = x <= 2; if (bs[1]) bs[1].disabled = x >= max - 2;
    }
    bs.forEach(function (b) {
      b.addEventListener('click', function () {
        fill();
        var li = row.querySelector('li'), step = li ? li.getBoundingClientRect().width + 8 : row.clientWidth * .8;
        row.scrollBy({ left: +b.getAttribute('data-d') * step * (rtl() ? -1 : 1), behavior: reduced ? 'auto' : 'smooth' });
      });
    });
    row.addEventListener('scroll', function () { if (!raf2) raf2 = requestAnimationFrame(function () { raf2 = 0; ends(); }); }, { passive: true });
    var raf2 = 0; ends(); addEventListener('resize', ends, { passive: true });
  })();

  /* ---------------- the buy sheet ---------------- */
  if (!buy) return;
  var kit = buy.getAttribute('data-kit') === '1', one = buy.getAttribute('data-one') === '1';
  var add = document.getElementById('ssAdd'), msg = document.getElementById('ssMsg');
  var VS = null, sel = {}, live = false, busy = false;
  var soldTok = 0;   /* r146 review: a late answer about another fit never lands on a newer message */
  function say(t) { soldTok++; if (msg) { msg.textContent = t || ''; buy.classList.toggle('has-msg', !!t); syncH(); } }
  /* the sheet's height drives the page's bottom padding on phones, so nothing hides behind it */
  function syncH() { if (mode === 'inl') { if (!de.style.getPropertyValue('--ss-h')) de.style.setProperty('--ss-h', (barH || 66) + 'px'); return; } try { de.style.setProperty('--ss-h', Math.ceil(buy.getBoundingClientRect().height) + 'px'); } catch (e) {} }
  de.classList.add('ss-page');
  /* The sheet floats outside the page's stacking contexts (main, section and .wrap carry z-index), or a
     later section or the footer would paint over it. Phones: fixed to the bottom of the screen from the
     start. Desktop: a card under the price, which docks to the bottom of the screen once it has scrolled
     away, and steps aside for the footer, like the old buy bar. A placeholder keeps its place. */
  var ph = document.createElement('div'); ph.className = 'ssb-ph'; buy.parentNode.insertBefore(ph, buy);
  /* 12 Nov 2026 (Faheem, phone screenshot: "The size and add to bag buttons should be there below the price in addition
     to being the floating bottom menu. This should be there for all product pages. A user could be finding them below
     the price and might miss that these are on the floating bar"). On a phone the sheet has a second home right under
     the price (phM). While that place is on screen the sizes and the button sit there, in the page; when it is off
     screen, above or below, the same sheet is the bar at the bottom. One sheet, so a size chosen in one is chosen in
     the other. The swap happens where the two meet, as the place under the price scrolls past the top of the bar. */
  var head = document.querySelector('.ss-head'), phM = document.createElement('div'); phM.className = 'ssb-ph ssb-ph-m';
  if (head && head.parentNode) head.parentNode.insertBefore(phM, head.nextSibling);
  var mqPh = window.matchMedia ? matchMedia('(max-width:899px)') : { matches: true };
  var floating = false, mode = '', inlH = 0, barH = 0, foot = document.querySelector('footer'), footOn = false;
  function put(m) {
    if (m === mode) return;
    var h = buy.offsetHeight;
    if (mode === 'inl' && h) inlH = h;   /* the card may have grown (a message under the sizes): the bar's place keeps its real height */
    mode = m; floating = m === 'float';
    buy.classList.remove('inl'); ph.style.height = ''; phM.style.height = '';
    if (m === 'float') {
      if (!mqPh.matches) ph.style.height = h + 'px'; else if (phM.parentNode) phM.style.height = inlH + 'px';
      document.body.appendChild(buy);
    } else if (m === 'inl') { phM.appendChild(buy); buy.classList.add('inl', 'seen'); inlH = buy.offsetHeight || inlH || 70; }
    else ph.parentNode.insertBefore(buy, ph.nextSibling);
    buy.classList.toggle('float', floating && !mqPh.matches);
    barPrice();
    syncH();
  }
  /* 17 Nov 2026 (blocker audit, Faheem: "Price on first screen"): on a phone the first screen is the photo and the bar,
     so the bar's button carries the price ("Add to bag · AED 199"), in the visitor's currency as shown on the page.
     CSS shows it only while the sheet is the bar at the bottom (assets/sahra-specimen.css, .ssb-add[data-pr]). */
  function barPrice() {
    try {
      var p = document.querySelector('.ss-price .sb-price'); if (!p || !add) return;
      var t = (p.innerText || p.textContent || '').replace(/\s+/g, ' ').trim();
      var bt = add.textContent || '', go = t && !add.disabled && !add.classList.contains('is-alt') && !/sold|unavailable|adding|added|checking|\u0646\u0641\u062f|\u063a\u064a\u0631 \u0645\u062a\u0627\u062d/i.test(bt);
      if (go) add.setAttribute('data-pr', t); else add.removeAttribute('data-pr');
    } catch (e) {}
  }
  try { if (window.MutationObserver) { var mo = new MutationObserver(function () { barPrice(); }), spx = document.querySelector('.ss-price');
    if (spx) mo.observe(spx, { childList: true, subtree: true, characterData: true });
    if (add) mo.observe(add, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'class'] }); } } catch (e) {}
  function setFloat(on) { put(on ? 'float' : 'home'); }
  var raf = 0;
  function place() {
    raf = 0;
    if (mqPh.matches) {
      buy.classList.remove('float', 'away');
      if (!phM.parentNode) { put('float'); return; }
      if (!inlH) put('inl');
      if (floating) barH = buy.offsetHeight;
      var r = phM.getBoundingClientRect(), top = r.top, bottom = r.top + inlH;
      /* under the price while any of it shows between the header and the top of the bar */
      put(bottom > 72 && top < innerHeight - (barH || 66) ? 'inl' : 'float');
      if (floating) barH = buy.offsetHeight;
      return;
    }
    /* 14 Nov 2026 (Faheem chose the desktop two columns): the buy card stays in its column, which stays in view beside
       the photos; no floating bar on desktop */
    put('home');
  }
  function req() { if (!raf) raf = requestAnimationFrame(place); }
  addEventListener('scroll', req, { passive: true }); addEventListener('resize', req, { passive: true });
  if (mqPh.addEventListener) mqPh.addEventListener('change', function () { put('home'); inlH = 0; place(); });
  if (foot && 'IntersectionObserver' in window) new IntersectionObserver(function (e) { footOn = e[0].isIntersecting; req(); }).observe(foot);
  place();
  syncH(); addEventListener('resize', syncH, { passive: true }); setTimeout(syncH, 600);
  function want() { return one ? (VS && VS[0] ? VS[0].title : null) : kit ? (sel.tee && sel['short'] ? sel.tee + ' / ' + sel['short'] : null) : sel.size; }
  function pick() { var w = want(); if (!VS || !w) return null; for (var i = 0; i < VS.length; i++) if (VS[i].title === w) return VS[i]; return null; }
  function avail(g, z) {
    return VS.some(function (v) {
      if (!v.availableForSale) return false; var t = String(v.title).split(' / ');
      if (!kit) return t[0] === z;
      if (g === 'tee') return t[0] === z && (!sel['short'] || t[1] === sel['short']);
      return t[1] === z && (!sel.tee || t[0] === sel.tee);
    });
  }
  function paint() {
    [].forEach.call(buy.querySelectorAll('.ssb-sz'), function (box) {
      var g = box.getAttribute('data-group');
      [].forEach.call(box.querySelectorAll('button'), function (b) {
        var z = b.getAttribute('data-size'), ok = !VS || avail(g, z);
        /* 17 Nov 2026 (blocker audit, Faheem: "Sold-out sizes clear"): a sold-out size is marked (a line through it) and
           still answers a tap, with "L is sold out" and a way to be told when it is back, instead of a dead button */
        b.disabled = false;
        /* 18 Nov 2026: until live stock arrives, the build's snapshot (content/stock.json) stands, so a size sold out at the
           last deploy is marked from the first paint instead of looking available for a few seconds */
        if (VS) {
          b.classList.toggle('is-out', !ok);
          if (!ok) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
          b.setAttribute('aria-label', z + (!ok ? ', sold out' : ''));
        }
        b.setAttribute('aria-pressed', sel[g] === z ? 'true' : 'false');
      });
    });
    if (busy) return;
    if (buy && buy.getAttribute('data-paused') === '1') return;
    if (VS && !VS.some(function (v) { return v.availableForSale; })) {
      /* 18 Nov 2026: a fit with no size left no longer says "In stock" in the promise line */
      [].forEach.call(document.querySelectorAll('.ss-promise1'), function (x) { x.classList.add('is-out'); });
      /* 10 Nov 2026 (landing-page audit): a fit with no size left was a dead end (a grey "Sold out" button). Where the piece has
         another fit on sale, the button leads to it. It says only that this fit is sold out, never that the other is in stock. */
      var alt = document.querySelector('.ssb-fit a:not(.on)[href]') || document.querySelector('.ss-fits a:not(.on)[href]');
      var ah = alt ? (alt.getAttribute('href') || '').replace(/\?size=[A-Z]+$/, '') : '';
      var an = /-super-oversized\/$/.test(ah) ? 'Sold out: see the Super Oversized fit' : /-oversized\/$/.test(ah) ? 'Sold out: see the Oversized fit' : /-regular\/$/.test(ah) ? 'Sold out: see the Regular fit' : '';
      if (an) { add.disabled = false; add.textContent = an; add.setAttribute('data-alt', ah); add.classList.add('is-alt'); var bar = add.closest ? add.closest('.ssb') : null; if (bar) bar.classList.add('is-out'); }
      else { add.disabled = true; add.textContent = 'Sold out'; }
      return;
    }
    add.removeAttribute('data-alt'); add.classList.remove('is-alt'); var bar0 = add.closest ? add.closest('.ssb') : null; if (bar0) bar0.classList.remove('is-out');
    if (VS) [].forEach.call(document.querySelectorAll('.ss-promise1.is-out'), function (x) { x.classList.remove('is-out'); });
    add.disabled = false;
    var v = pick();
    add.textContent = (v && !v.availableForSale) ? 'Sold out in that size' : 'Add to bag';
  }
  buy.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.ssb-sz button'); if (!b || b.disabled) return;
    var g = b.closest('.ssb-sz').getAttribute('data-group'), z = b.getAttribute('data-size');
    if (b.classList.contains('is-out')) { soldOut(z); tr('size_soldout_tap', { item_id: handle, size: z, via: floating ? 'specimen-bar' : 'specimen' }); return; }
    sel[g] = z; say(''); paint(); fitLinks();
    /* 12 Nov 2026: 'specimen-bar' when the sheet is the bar at the bottom, so reports can tell it from the sizes under the price */
    var sp = { item_id: handle, size: z, via: floating ? 'specimen-bar' : 'specimen', ad: window.SB_AD ? 1 : 0 }; if (g !== 'size') sp.part = g;   /* the kit has two size rows: tee and short */
    tr('size_select', sp);
  });
  /* a tap on a sold-out size: say so under the sizes, with the "Tell me when it's back" sign-up one tap away */
  function soldOut(z) {
    if (!msg) return;
    var AR = /^ar\b/i.test(document.documentElement.getAttribute('lang') || '');
    var hasBis = !kit && !!window.SBCapture;
    var tok = ++soldTok; msg.__z = z;
    msg.innerHTML = '';
    msg.appendChild(document.createTextNode(AR ? '\u0645\u0642\u0627\u0633 ' + z + ' \u0646\u0641\u062f. ' : z + ' is sold out. '));
    if (hasBis) {
      var l = document.createElement('button'); l.type = 'button'; l.className = 'ssb-bis-go';
      l.textContent = AR ? '\u0623\u062e\u0628\u0631\u0648\u0646\u064a \u0639\u0646\u062f \u062a\u0648\u0641\u0631\u0647' : 'Tell me when it\u2019s back';
      l.addEventListener('click', function () {
        bisMount(); var box = document.getElementById('sbcBis'); if (!box) return;
        var t = box.querySelector('.sbc-bis-t'), panel = box.querySelector('.sbc-bis-f');
        if (panel && panel.hidden && t) t.click();
        var zb = box.querySelector('.sbc-bis-sz button[data-z="' + z + '"]'); if (zb) zb.click();
        try { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { box.scrollIntoView(); }
        var em = box.querySelector('input[type=email]'); if (em) setTimeout(function () { try { em.focus({ preventScroll: true }); } catch (e) {} }, 450);
      });
      msg.appendChild(l);
    } else msg.appendChild(document.createTextNode(AR ? '\u0627\u062e\u062a\u0631 \u0645\u0642\u0627\u0633\u064b\u0627 \u0622\u062e\u0631.' : 'Please choose another size.'));
    buy.classList.add('has-msg'); syncH();
    /* 18 Nov 2026 (persona audit; Faheem chose "a sold-out size links to the same size in the other fit"): if another fit
       of this design has the size, say so with a link that opens it with the size chosen */
    if (kit || !window.SahraCart || !window.SahraCart.variants) return;
    [].forEach.call(document.querySelectorAll('.ss-fits a[href]:not(.on)'), function (a) {
      var m = /\/products\/([a-z0-9-]+)\//.exec(a.getAttribute('href') || ''); if (!m) return;
      var b = a.querySelector('b'), fit = (b ? b.textContent : a.textContent).trim();
      window.SahraCart.variants(m[1]).then(function (vs) {
        if (tok !== soldTok || msg.__z !== z) return;
        if (!vs || !vs.some(function (v) { return v.title === z && v.availableForSale; })) return;
        if (!msg.querySelector('.ssb-bis-go, .ssb-fit-go') && !msg.textContent) return;
        if (msg.querySelector('.ssb-fit-go[data-fit="' + fit + '"]')) return;
        var l = document.createElement('a'); l.className = 'ssb-fit-go'; l.setAttribute('data-fit', fit);
        l.href = '/' + (AR ? 'ar/' : '') + 'products/' + m[1] + '/?size=' + z;
        l.textContent = AR ? '\u0645\u0642\u0627\u0633 ' + z + ' \u0645\u062a\u0648\u0641\u0631 \u0628\u0642\u0635\u0651\u0629 ' + fit + ' \u2190' : z + ' is in stock in ' + fit + ' \u2192';
        msg.appendChild(document.createTextNode(' \u00b7 ')); msg.appendChild(l); syncH();
      }, function () {});
    });
  }
  function needSize() {
    say(kit ? 'Choose a size for the tee and the short first.' : 'Choose your size first.');
    var boxes = buy.querySelectorAll('.ssb-sz');
    [].forEach.call(boxes, function (x) { x.classList.remove('flash'); void x.offsetWidth; x.classList.add('flash'); });
    var f = buy.querySelector('.ssb-sz button:not(:disabled):not(.is-out)'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {}
  }
  /* the photo that folds into the bag: the one on show */
  function srcImg() { var f = figs[cur]; return f ? f.querySelector('img') : null; }
  add.addEventListener('click', function () {
    if (busy) return;
    if (add.getAttribute('data-alt')) { tr('soldout_fit_switch', { item_id: handle }); location.href = add.getAttribute('data-alt'); return; }
    var ready = one || (kit ? (sel.tee && sel['short']) : sel.size);
    if (!ready) { needSize(); return; }
    if (!live) { busy = true; add.textContent = 'Checking stock…'; waitAdd = true; return; }
    var v = pick();
    if (!v || !v.availableForSale) { say((want() || 'That size') + ' is sold out. Please choose another size.'); return; }
    if (!window.SahraCart) { say('The bag is not loading. Refresh the page, or message us on WhatsApp.'); return; }
    busy = true; add.disabled = true; add.textContent = 'Adding…'; say('');
    var opts = { from: srcImg(), at: add };
    if (buy.getAttribute('data-gift') === '0') opts.gift = false;
    window.SahraCart.add(v.id, 1, opts).then(function () {
      busy = false; add.disabled = false; add.textContent = 'Add to bag';
      tr('add_to_cart', { item_id: handle, size: v.title, via: floating ? 'specimen-bar' : 'specimen' });
    }, function () {
      busy = false; add.disabled = false; add.textContent = 'Add to bag';
      say('That did not go into your bag. Please try again, or message us on WhatsApp.');
    });
  });
  var waitAdd = false, tries = 0;
  function load() {
    /* paused piece (30 Oct 2026): not for sale while the fit is adjusted; nothing to load */
    if (buy && buy.getAttribute('data-paused') === '1') { add.disabled = true; [].forEach.call(buy.querySelectorAll('[data-size]'), function (b) { b.disabled = true; }); bisMount(); return; }
    if (!window.SahraCart || !window.SahraCart.variants) { if (tries++ < 60) { setTimeout(load, 150); return; } say('Sizes are not loading. Refresh the page, or message us on WhatsApp.'); return; }
    var t = setTimeout(function () { if (!live) say('Sizes are taking a while. Refresh the page, or message us on WhatsApp.'); }, 9000);
    window.SahraCart.variants(handle).then(function (vs) {
      clearTimeout(t);
      if (!vs || !vs.length) { add.disabled = true; add.textContent = 'Unavailable just now'; say('Sizes are not loading. Refresh the page in a minute, or message us on WhatsApp.'); return; }
      VS = vs; live = true; say('');
      /* a size tapped before stock arrived that has since sold out */
      ['size', 'tee', 'short'].forEach(function (g) { if (sel[g] && !avail(g, sel[g])) { say(sel[g] + ' is sold out. Please choose another size.'); delete sel[g]; } });
      var go = waitAdd; waitAdd = false; busy = false; paint(); bisMount();
      if (go && pick() && !add.getAttribute('data-alt')) add.click();   /* a tap made before stock loaded never becomes a redirect */
    }, function () { clearTimeout(t); say('Sizes are not loading. Refresh the page, or message us on WhatsApp.'); });
  }
  /* 13 Nov 2026 (Faheem, email capture: "Tell me when it's back"). Under the stock line, on a fit that is back soon or a
     piece with a size sold out: the visitor picks the size and leaves an email. api/subscribe.js tags them
     bis-<handle>-<size>, and Shopify Flow emails them when that size is back. The kit (two sizes) is left out. */
  function bisMount() {
    if (kit || !window.SBCapture || document.getElementById('sbcBis')) return;
    var stat = document.querySelector('.ss-stat') || document.querySelector('.ss-promise1'); if (!stat) return;   /* 14 Nov 2026: the stock line became the promise line */
    var AR = /^ar\b/i.test(document.documentElement.getAttribute('lang') || '') || /^\/ar\//.test(location.pathname || '');
    var T = function (en, ar) { return AR ? ar : en; };
    var paused = buy.getAttribute('data-paused') === '1';
    var sizes = [];
    [].forEach.call(buy.querySelectorAll('.ssb-sz button[data-size]'), function (b) { var z = b.getAttribute('data-size'); if (sizes.indexOf(z) < 0) sizes.push(z); });
    var out;
    if (paused) out = one ? [] : sizes;
    else if (!VS) return;
    else if (one) { if (VS.some(function (v) { return v.availableForSale; })) return; out = []; }
    else { out = sizes.filter(function (z) { return !avail('size', z); }); if (!out.length) return; }
    var whole = paused || (VS && !VS.some(function (v) { return v.availableForSale; }));
    var box = document.createElement('div');
    box.className = 'sbc-bis'; box.id = 'sbcBis'; box.setAttribute('data-waitlist-wrap', '');
    var chosen = out.length === 1 ? out[0] : (sel.size && out.indexOf(sel.size) >= 0 ? sel.size : '');
    box.innerHTML = '<button type="button" class="sbc-bis-t" aria-expanded="false" aria-controls="sbcBisF">' +
      (whole ? T('Tell me when it\'s back', 'أخبروني عند عودته') : T('Size sold out? Tell me when it\'s back', 'نفد مقاسك؟ أخبروني عند توفره')) + '</button>' +
      '<div class="sbc-bis-f" id="sbcBisF" hidden>' +
      (out.length > 1 ? '<label id="sbcBisL">' + T('Which size?', 'أي مقاس؟') + '</label><div class="sbc-bis-sz" role="group" aria-labelledby="sbcBisL">' +
        out.map(function (z) { return '<button type="button" data-z="' + z + '" aria-pressed="' + (z === chosen ? 'true' : 'false') + '">' + z + '</button>'; }).join('') + '</div>' : '') +
      window.SBCapture.form('bis', {
        btn: T('Tell me', 'أخبروني'),
        yes: T('Done. We email you when it is back. Your AED 50 welcome code is on its way too.', 'تم. نراسلك عند عودته، ورمز ترحيب بخصم 50 درهمًا في طريقه إليك أيضًا.'),
        no: T('Done. We email you when it is back.', 'تم. نراسلك عند عودته.'),
        sent: T('Done. We email you when it is back.', 'تم. نراسلك عند عودته.')
      }) + '</div>';
    stat.parentNode.insertBefore(box, stat.nextSibling);
    var f = box.querySelector('form');
    f.insertAdjacentHTML('beforeend', '<input type="hidden" name="piece" value="' + handle + '"><input type="hidden" name="size" value="' + (chosen ? chosen.toLowerCase() : '') + '">');
    f = window.SBCapture.bind(f) || box.querySelector('form');
    var hid = f.querySelector('input[name=size]');
    var tg = box.querySelector('.sbc-bis-t'), panel = box.querySelector('.sbc-bis-f');
    tg.addEventListener('click', function () { var open = panel.hidden; panel.hidden = !open; tg.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) tr('bis_open', { item_id: handle, size: chosen || '' }); });
    box.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.sbc-bis-sz button'); if (!b) return;
      chosen = b.getAttribute('data-z'); hid.value = chosen.toLowerCase();
      [].forEach.call(box.querySelectorAll('.sbc-bis-sz button'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      var er = box.querySelector('.sbc-err'); if (er) { er.style.display = 'none'; er.textContent = er.getAttribute('data-bad-email') || window.SBCapture.offer.bad; }
    });
    /* a size first, when there is more than one sold out to choose from. On the box, in the capture phase, so it runs
       before the shared sign-up handler on the form in every browser. A fit that is back soon may be asked for without a size. */
    box.addEventListener('submit', function (e) {
      if (!paused && out.length > 1 && !hid.value) {
        e.preventDefault(); e.stopImmediatePropagation();
        var er = box.querySelector('.sbc-err'); if (er) { er.textContent = T('Choose the size you are waiting for.', 'اختر المقاس الذي تنتظره.'); er.style.display = 'block'; }
      }
    }, true);
  }
  /* the Regular / Oversized links carry the chosen size, so switching fit keeps it (QA nice 10) */
  function fitLinks() {
    [].forEach.call(document.querySelectorAll('.ssb-fit a, .ss-fits a'), function (a) {
      var h = a.getAttribute('href') || ''; h = h.replace(/\?size=[A-Z]+$/, '');
      a.setAttribute('href', sel.size ? h + '?size=' + sel.size : h);
    });
  }
  /* 11 Nov 2026: a tap on the other fit is sent with the product it leads to (by beacon, since the page changes) */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('.ssb-fit a[href], .ss-fits a[href]'); if (!a || a.classList.contains('on')) return;
    var m = /\/products\/([a-z0-9-]+)/.exec(a.getAttribute('href') || ''); if (m) tr('fit_switch', { item_id: m[1], from_product: handle, via: 'specimen', transport_type: 'beacon' });
  }, true);
  try { var q = /[?&]size=(S|M|L|XL)\b/.exec(location.search || ''); if (q && !kit && !one) { sel.size = q[1]; fitLinks(); } } catch (e) {}
  paint();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();

/* 17 Nov 2026 (WhatsApp fit help, claude/HANDOFF-Website-whatsapp-fit-help-17-Nov-2026.md): at tap time the prefilled
   message gets the size the buyer has picked (if any), Arabic pages get the Arabic message, and the tap is counted:
   GA4 whatsapp_click (placement fit_help, the product, fit and size) and Meta Contact (TikTok mirrors it). No personal
   data is sent. Analytics only load on www.sahraandbeyond.ae (ga4.js), so test copies send nothing. */
(function () {
  var NUM = '971585449946';
  function picked() {
    var buy = document.getElementById('ssBuy'); if (!buy) return '';
    var out = [];
    [].forEach.call(buy.querySelectorAll('.ssb-sz'), function (g) {
      var b = g.querySelector('button[aria-pressed="true"]'); if (!b) return;
      var lab = g.querySelector('.ssb-gl');
      out.push((lab ? lab.textContent.trim() + ' ' : '') + b.getAttribute('data-size'));
    });
    return out.join(', ');
  }
  function msg(a) {
    var ar = document.documentElement.getAttribute('lang') === 'ar';
    var name = a.getAttribute('data-wa-name') || '', fit = a.getAttribute('data-wa-fit') || '', size = picked();
    if (ar) {
      var h = document.querySelector('.ss-h1'); var nm = h ? h.textContent.replace(/\s+/g, ' ').trim() : name;
      return 'مرحبًا، أنا أشاهد ' + nm + '. أي مقاس يناسبني؟ طولي __ سم، ووزني __ كغ، وعادةً ألبس مقاس __.' + (size ? ' كنت أفكر في مقاس ' + size + '.' : '');
    }
    var the = /^The /.test(name) ? name : 'the ' + name;
    if (fit && name.toLowerCase().indexOf(fit.toLowerCase()) >= 0) fit = '';
    return "Hi, I'm looking at " + the + (fit ? ' (' + fit + ')' : '') + ". Which size should I get? I'm __ cm, __ kg and usually wear __." + (size ? ' I was thinking ' + size + '.' : '');
  }
  function refresh(a) { a.href = 'https://wa.me/' + NUM + '?text=' + encodeURIComponent(msg(a)); }
  function init() {
    var links = document.querySelectorAll('a[data-wa="fit_help"]'); if (!links.length) return;
    [].forEach.call(links, function (a) {
      refresh(a);
      a.addEventListener('pointerdown', function () { refresh(a); });
      a.addEventListener('focus', function () { refresh(a); });
      a.addEventListener('click', function () {
        refresh(a);
        var h = a.getAttribute('data-handle') || '', fit = a.getAttribute('data-wa-fit') || '', size = picked();
        var variant = [fit, size].filter(Boolean).join(' / ') || 'none';
        try { if (window.track) window.track('whatsapp_click', { placement: 'fit_help', item_id: h, item_name: a.getAttribute('data-wa-name') || '', item_variant: variant, fit: fit || undefined, size: size || undefined }); } catch (e) {}
        try { if (window.sbMeta) window.sbMeta('Contact', { content_ids: [h], content_name: a.getAttribute('data-wa-name') || '', content_type: 'product', contact_reason: 'fit_help' }); } catch (e) {}
      });
    });
    /* the size buttons: keep the link current as sizes are picked, so a long-press "copy link" carries it too */
    document.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('#ssBuy .ssb-sz button')) setTimeout(function () { [].forEach.call(links, refresh); }, 0);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* 18 Nov 2026 (ad-visitor persona audit; Faheem chose "Payment line by the price"): the Tabby line opens what it means */
(function () {
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('.ss-tb-open'); if (!b) return;
    var t = document.getElementById(b.getAttribute('aria-controls')); if (!t) return;
    var open = t.hidden; t.hidden = !open; b.setAttribute('aria-expanded', open ? 'true' : 'false');
    try { if (open && window.track) window.track('tabby_info_open', { placement: 'price_line' }); } catch (x) {}
  });
})();
