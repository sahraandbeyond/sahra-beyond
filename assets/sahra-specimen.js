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

  /* ---------------- the stage ---------------- */
  var figs = stage ? [].slice.call(stage.querySelectorAll('.ss-v')) : [];
  var tabs = [].slice.call(document.querySelectorAll('.ss-tab'));
  var pins = stage ? [].slice.call(stage.querySelectorAll('.ss-pin')) : [];
  var noteEl = document.getElementById('ssNote');
  var listBtns = [].slice.call(document.querySelectorAll('.ss-notes button'));
  var cap = stage && stage.querySelector('.ss-cap'), mockTag = stage && stage.querySelector('.ss-mock');
  var cur = 0;
  figs.forEach(function (f, i) { if (f.classList.contains('on')) cur = i; });

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
  function noteText(i) { var p = pins[i]; return p ? (p.getAttribute('aria-label') || '').replace(/^(?:Note|\u0645\u0644\u0627\u062d\u0638\u0629) \d+: /, '') : ''; }
  function setNote(i) {
    pins.forEach(function (p, k) { p.classList.toggle('on', k === i); p.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
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
      if (swiped || (e.target.closest && e.target.closest('.ss-pin,.ss-tabs,.ss-note'))) return;
      zoom();
    });
  } else if (stage) stage.addEventListener('click', function (e) { if (!(e.target.closest && e.target.closest('.ss-pin,.ss-tabs,.ss-note'))) zoom(); });
  if (stage) stage.addEventListener('keydown', function (e) { if (e.target === stage && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); zoom(); } });
  function zoom() {
    if (!window.SahraZoom || !figs.length) return;
    var list = figs.map(function (f) { var im = f.querySelector('img'); return { src: f.getAttribute('data-full') || (im && (im.currentSrc || im.src)), alt: (im && im.alt) || '' }; });
    try { window.SahraZoom.open(list, cur); } catch (e) { return; }
    tr('image_zoom', { item_id: handle });
  }

  /* ---------------- On the model (2 Nov 2026) ----------------
     The model photos load only after the page has loaded and once their row is near the screen (or at the first touch,
     focus or arrow), so the stage's first photo keeps the bandwidth. A tap opens them in the zoom viewer. */
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
  function say(t) { if (msg) { msg.textContent = t || ''; buy.classList.toggle('has-msg', !!t); syncH(); } }
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
    syncH();
  }
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
    var past = (floating ? ph : buy).getBoundingClientRect().bottom < 64;
    put(past ? 'float' : 'home');
    buy.classList.toggle('away', floating && footOn);
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
        b.disabled = !!(VS && !ok);
        b.setAttribute('aria-pressed', sel[g] === z ? 'true' : 'false');
        b.setAttribute('aria-label', z + (VS && !ok ? ', sold out' : ''));
      });
    });
    if (busy) return;
    if (buy && buy.getAttribute('data-paused') === '1') return;
    if (VS && !VS.some(function (v) { return v.availableForSale; })) {
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
    add.disabled = false;
    var v = pick();
    add.textContent = (v && !v.availableForSale) ? 'Sold out in that size' : 'Add to bag';
  }
  buy.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.ssb-sz button'); if (!b || b.disabled) return;
    var g = b.closest('.ssb-sz').getAttribute('data-group'), z = b.getAttribute('data-size');
    sel[g] = z; say(''); paint(); fitLinks();
    /* 12 Nov 2026: 'specimen-bar' when the sheet is the bar at the bottom, so reports can tell it from the sizes under the price */
    var sp = { item_id: handle, size: z, via: floating ? 'specimen-bar' : 'specimen', ad: window.SB_AD ? 1 : 0 }; if (g !== 'size') sp.part = g;   /* the kit has two size rows: tee and short */
    tr('size_select', sp);
  });
  function needSize() {
    say(kit ? 'Choose a size for the tee and the short first.' : 'Choose your size first.');
    var boxes = buy.querySelectorAll('.ssb-sz');
    [].forEach.call(boxes, function (x) { x.classList.remove('flash'); void x.offsetWidth; x.classList.add('flash'); });
    var f = buy.querySelector('.ssb-sz button:not(:disabled)'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {}
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
    if (buy && buy.getAttribute('data-paused') === '1') { add.disabled = true; [].forEach.call(buy.querySelectorAll('[data-size]'), function (b) { b.disabled = true; }); return; }
    if (!window.SahraCart || !window.SahraCart.variants) { if (tries++ < 60) { setTimeout(load, 150); return; } say('Sizes are not loading. Refresh the page, or message us on WhatsApp.'); return; }
    var t = setTimeout(function () { if (!live) say('Sizes are taking a while. Refresh the page, or message us on WhatsApp.'); }, 9000);
    window.SahraCart.variants(handle).then(function (vs) {
      clearTimeout(t);
      if (!vs || !vs.length) { add.disabled = true; add.textContent = 'Unavailable just now'; say('Sizes are not loading. Refresh the page in a minute, or message us on WhatsApp.'); return; }
      VS = vs; live = true; say('');
      /* a size tapped before stock arrived that has since sold out */
      ['size', 'tee', 'short'].forEach(function (g) { if (sel[g] && !avail(g, sel[g])) { say(sel[g] + ' is sold out. Please choose another size.'); delete sel[g]; } });
      var go = waitAdd; waitAdd = false; busy = false; paint();
      if (go && pick() && !add.getAttribute('data-alt')) add.click();   /* a tap made before stock loaded never becomes a redirect */
    }, function () { clearTimeout(t); say('Sizes are not loading. Refresh the page, or message us on WhatsApp.'); });
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
