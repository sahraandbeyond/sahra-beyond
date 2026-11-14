/* sahra-welcome.js — the gold announcement bar at the top of every page, and the
 * shared email capture behind every [data-waitlist] form.
 *
 * 22 Oct 2026 (Faheem): the first-order offer is retired (its code is
 * expired in Shopify). The bar no longer carries any offer, the email-capture
 * pop-up and the corner teaser are gone, and nothing on the site hands out a
 * code. The bar now carries the Sahel and Sahra Trail release dates, in stages
 * that switch on their own at fixed UAE times (STAGES below).
 *
 * Capture goes to /api/subscribe, which writes the address to Shopify as a
 * customer with emailMarketingConsent SUBSCRIBED. Kit (ConvertKit) is gone:
 * this file TAKES OVER every [data-waitlist] form on the page (the homepage
 * newsletter, /sahel/, /trail/ and the ones build-products.js emits) and
 * re-points them at that endpoint. The Kit markup left in those pages is inert.
 *
 * The bar is inserted INSIDE .sb-topbar rather than as a sibling above it.
 * body.has-topbar nav{top:var(--topbar-h)} positions the fixed nav, and the
 * page's own inline script sets that variable from .sb-topbar.offsetHeight —
 * it runs after this file and would clobber any value set here. Nesting means
 * that measurement includes this bar automatically and the two agree instead
 * of racing. The re-measure below is belt and braces, not the mechanism.
 */
(function () {
  'use strict';
  if (window.__sbWelcome) return;
  window.__sbWelcome = 1;

  /* Same guard as sahra-nav.js: on 18 Sep one CDN edge answered 404 for a newly
     hashed stylesheet while the script beside it loaded fine, and the offer card
     rendered as unstyled text. If our sheet is present but empty, pull it again
     unhashed rather than showing a broken card to a customer. */
  try {
    var sbwCss = document.querySelector('link[href*="/assets/sahra-welcome.css"]');
    if (sbwCss && sbwCss.sheet && sbwCss.sheet.cssRules.length === 0) {
      var sbwFb = document.createElement('link'); sbwFb.rel = 'stylesheet';
      sbwFb.href = '/assets/sahra-welcome.css?r=' + Date.now(); document.head.appendChild(sbwFb);
    }
  } catch (e) {}

  var API = '/api/subscribe';

  /* POST an address to Shopify. Resolves { stored }. Rejects with 'email' on a 400. */
  function post(email, source, fields) {
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields ? { email: email, source: source, fields: fields } : { email: email, source: source })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 400) throw new Error('email');
        return { stored: !!(j && j.stored), welcome: j ? j.welcome : undefined };
      });
    });
  }
  /* Arabic pages: the form messages below keep their existing Arabic. 30 Oct 2026 (RTL QA B5):
     the bar now has its own Arabic (the same wording the Arabic site's dictionary already used),
     reads right-to-left with lang="ar", and links to the Arabic page. */
  var AR = /^ar\b/i.test(document.documentElement.getAttribute('lang') || '') || /^\/ar\//.test(location.pathname || '');
  function t(en, ar) { return AR ? ar : en; }
  var RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  function ev(name, params) { try { if (window.gtag) window.gtag('event', name, params || {}); } catch (e) {} }

  /* ------------------------------------------------------ the bar's stages */
  /* Faheem, 22 Oct 2026. Each stage starts at a fixed instant (UTC; the UAE is UTC+4, no DST)
     and runs until the next one starts. Exact wording, no exclamation marks, no timers.
       until Wed 28 Oct 08:00 UAE   release dates
       Wed 28 Oct 08:00 UAE         pre-order open, 20% off until Thu 29 Oct 23:59
       Fri 30 Oct 00:00 UAE         launch, full price: no "off" wording anywhere from here on
     The switch uses the visitor's own clock, so it happens to the second wherever they are;
     an open page also switches by itself (see schedule() below). */
  var STAGES = [
    { from: 0, href: '/new/',
      en: 'Sahel and Sahra Trail pre-order opens Wed 28 Oct.',
      ar: 'يبدأ الطلب المسبق لساحل وصحراء تريل يوم الأربعاء 28 أكتوبر.' },
    { from: Date.UTC(2026, 9, 27, 18, 45, 0), href: '/sahel/#pieces',   /* 27 Oct 2026: opened early (Faheem) */
      en: 'Sahel and Sahra Trail: pre-order open, 20% off until Thu 29 Oct, 23:59.',   /* 23 Oct 2026: scoped to the new lines; the 20% is on them only */
      ar: 'ساحل وصحراء تريل: الطلب المسبق متاح بخصم 20% حتى الخميس 29 أكتوبر، 23:59.' },
    { from: Date.UTC(2026, 9, 29, 20, 0, 0), href: '/shop/',
      /* 12 Nov 2026 (Faheem: "Remove Sahel and trail are out now") */
      en: 'Designed in the UAE for everyone who loves it.',
      ar: 'صُمّمت في الإمارات لكل من يحبّها.' },
    /* 3 Nov 2026 (Faheem, r99): the 11.11 sale, live from the push until Sun 15 Nov 23:59 UAE (sale.js END).
       No timer, no urgency beyond the end date. At Mon 16 Nov 00:00 UAE the bar goes back to the stage-2 line. */
    { from: Date.UTC(2026, 10, 2, 20, 0, 0), href: '/shop/', promo: ['sale-1111', '11.11 Sale'],   /* GA4 view_promotion / select_promotion */
      en: '11.11 Sale: up to 70% off. Ends Sun 15 Nov.',
      ar: 'تخفيضات 11.11: خصم يصل إلى 70%. ينتهي العرض الأحد 15 نوفمبر.' },
    { from: Date.UTC(2026, 10, 15, 20, 0, 0), href: '/shop/',
      /* 12 Nov 2026 (Faheem: "Remove Sahel and trail are out now") */
      en: 'Designed in the UAE for everyone who loves it.',
      ar: 'صُمّمت في الإمارات لكل من يحبّها.' }
  ];
  /* ?sbstage=0|1|2|3|4 previews a stage (for checking before the date; nothing is stored) */
  var forced = null;
  try { var fm = /[?&]sbstage=(\d)/.exec(location.search || ''); if (fm && STAGES[+fm[1]]) forced = +fm[1]; } catch (e) {}
  /* 10 Nov 2026 (site scorecard; Faheem: "Quiet it today"): the sale line shows only where there is something to buy
     (home, the shop, the range and category pages, product pages). On every other page (About, the size guide, the place
     guides, the journal, policies) the bar keeps the line it had before the sale. */
  var SHOPPING = /^\/(ar\/?)?($|(shop|new|sahel|trail|t-shirts(\/(regular|oversized))?|polos|hoodies|activewear|accessories|men|women|gifts|under-150|national-day|desert-t-shirts|mountain-t-shirts)\/?$|products\/)/.test(location.pathname || '/');
  function stageAt(now) {
    if (forced !== null) return forced;
    var k = 0;
    for (var i = 0; i < STAGES.length; i++) if (now >= STAGES[i].from) k = i;
    if (STAGES[k].promo && !SHOPPING) { for (var j = k - 1; j >= 0; j--) if (!STAGES[j].promo) { k = j; break; } }
    return k;
  }

  /* 12 Nov 2026 (Faheem: "Top banner should also say shipping worldwide"; chose "Worldwide only"): one line for every
     visitor and every screen. The UAE free-delivery promise stays on product pages, in the bag and at checkout. */
  var SHIP = AR ? 'نشحن إلى جميع أنحاء العالم' : 'We ship worldwide';
  function esc(x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ---------------------------------------------------------------- bar */
  var host = document.querySelector('.sb-topbar');
  var bar = document.createElement('a');
  bar.className = 'sbw-bar sbw-note';
  var current = -1;
  function render() {
    var k = stageAt(Date.now());
    if (k === current) return;
    current = k;
    var S = STAGES[k];
    bar.setAttribute('href', AR ? '/ar' + S.href : S.href);
    bar.setAttribute('data-stage', String(k));
    bar.innerHTML =
      '<span class="sbw-sheen"></span>' +
      '<span class="sbw-bar-in">' +
        '<span class="sbw-dot" aria-hidden="true"></span>' +
        '<span class="sbw-msg"' + (AR ? ' dir="rtl" lang="ar"' : '') + '>' + esc(AR ? S.ar : S.en) +
          /* below 1240px the delivery line has no room beside the message, so it follows it (12 Nov 2026) */
          (k === 1 ? '' : ' <span class="sbw-msg-ship">' + SHIP + (AR ? '.' : '.') + '</span>') + '</span>' +
        /* no next-day promise beside the pre-order stage: those pieces ship from Fri 30 Oct */
        (k === 1 ? '' : '<span class="sbw-sep sbw-shipwrap" aria-hidden="true">&middot;</span>' +
        '<span class="sbw-ship sbw-shipwrap"' + (AR ? ' dir="rtl" lang="ar"' : '') + '>' + SHIP + '</span>') +
      '</span>';
  }
  render();
  /* a page left open across a stage boundary switches by itself */
  (function schedule() {
    if (forced !== null) return;
    var now = Date.now(), next = null;
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].from > now) { next = STAGES[i].from; break; }
    if (next === null || next - now > 864e5) return;
    setTimeout(function () { render(); measure(); schedule(); }, next - now + 500);
  })();
  bar.addEventListener('click', function () { ev('topbar_click', { stage: current, page: location.pathname });
    /* 3 Nov 2026 (GA4 detail): the sale bar as a GA4 promotion, so its clicks show in the Promotions report */
    var P = STAGES[current] && STAGES[current].promo; if (P && window.track) try { window.track('select_promotion', { promotion_id: P[0], promotion_name: P[1], creative_slot: 'top_bar' }); } catch (e) {} });
  (function () { var P = STAGES[current] && STAGES[current].promo; if (!P || !window.track) return;
    try { if (sessionStorage.getItem('sb_vp_' + P[0])) return; sessionStorage.setItem('sb_vp_' + P[0], '1'); } catch (e) {}
    try { window.track('view_promotion', { promotion_id: P[0], promotion_name: P[1], creative_slot: 'top_bar' }); } catch (e) {} })();

  var wrap = document.createElement('div');
  wrap.appendChild(bar);
  wrap.className = 'sbw-wrap';

  if (host) { host.classList.add('sbw-host'); host.insertBefore(wrap, host.firstChild); }
  else { wrap.classList.add('sbw-solo'); document.body.insertBefore(wrap, document.body.firstChild); }
  document.body.classList.add('sbw-on');


  /* nav is position:fixed and `body.has-topbar nav{top:var(--topbar-h)}` pins it
     that far down the viewport FOREVER — the topbar itself is position:relative
     and scrolls away. At the old ~34px that read as a design detail; at 106px
     with this bar the nav floats over the page. So --topbar-h stays the full
     height (#s-hero sizes off it and should start below the whole bar) and the
     nav's own top is driven from scroll instead, reaching 0 once the bar is
     past. Inline style, so it beats the stylesheet rule without a specificity
     fight; nothing else on the page writes nav.style.top — the page's own nav
     script only toggles the .on-hero / .solid classes. */
  /* ONLY the fixed site nav (#nav on the homepage, shop and previews). Every other
     page's first <nav> is .hdr-nav - the links row INSIDE the sticky header - and
     sahra-sky.css makes every nav position:relative, so writing top:55px to it shoved
     the whole links row out of the header and under the hero (Faheem, 17 Sep: "the top
     bar in other pages is getting cut off"). Those pages have no fixed nav to place. */
  var navEl = document.getElementById('nav');
  if (navEl && getComputedStyle(navEl).position !== 'fixed') navEl = null;
  var navRaf = 0;
  function placeNav() {
    navRaf = 0;
    if (!navEl) return;
    var h = host ? host.offsetHeight : (wrap.parentNode ? wrap.offsetHeight : 0);
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    navEl.style.top = Math.max(0, h - y) + 'px';
  }
  function queueNav() { if (!navRaf) navRaf = (window.requestAnimationFrame || setTimeout)(placeNav); }
  window.addEventListener('scroll', queueNav, { passive: true });

  function measure() {
    var h = host ? host.offsetHeight : wrap.offsetHeight;
    document.documentElement.style.setProperty('--topbar-h', h + 'px');
    document.body.classList.add('has-topbar');
    placeNav();
  }
  measure();
  window.addEventListener('resize', measure);
  window.addEventListener('orientationchange', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure).catch(function () {});
  setTimeout(measure, 600);
  setTimeout(measure, 1800);


  /* --------------------------------------------- take the waitlist forms */
  /* index.html (and every page build-products.js emits) binds its own submit
     handler to [data-waitlist] that posts to Kit. Cloning the node drops those
     listeners, which is the only way to retire Kit without hand-editing ~60
     generated pages. Same wrap classes, so the existing CSS states still work. */
  /* 13 Nov 2026: one function per form, exported as window.SBCapture.bind, so forms made after this file has run (the
     sign-up sheet, the bag line, "Tell me when it's back") are handled exactly like the forms in the page. */
  function bind(old) {
      if (old.__sbBound) return;
      var f = old.parentNode ? old.cloneNode(true) : old;
      if (old.parentNode) old.parentNode.replaceChild(f, old);
      f.__sbBound = 1;
      var wrapEl = f.closest('[data-waitlist-wrap]') || f.parentNode;
      var src = f.getAttribute('data-source') || 'waitlist';
      /* 25 Oct 2026: the shared newsletter block says data-source="news"; tag it with the page it sits on */
      if (src === 'news') { var seg = (location.pathname || '/').split('/').filter(Boolean)[0] || 'home'; src = ('news-' + seg).slice(0, 24); }
      f.removeAttribute('data-endpoint');
      var inp = f.querySelector('input[type=email], input[name=email_address], input[name=email]');
      /* the bad-email wording, kept before anything else can write to the error line */
      var e0 = wrapEl.querySelector('.tr-err, .sh-err, [data-err]'); if (e0 && !e0.hasAttribute('data-bad-email')) e0.setAttribute('data-bad-email', e0.textContent);
      /* the error line goes back to its bad-email wording as soon as the visitor edits the address */
      var resetErr = function () { var x = wrapEl.querySelector('[data-err]'); if (x) x.style.display = 'none';
        var y = wrapEl.querySelector('[data-bad-email]'); if (y) y.textContent = y.getAttribute('data-bad-email'); };
      if (inp) inp.addEventListener('input', function () { wrapEl.classList.remove('err'); resetErr(); });
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        resetErr();
        var email = ((inp && inp.value) || '').trim();
        if (!RE.test(email)) { wrapEl.classList.add('err'); if (inp) inp.focus(); return; }
        wrapEl.classList.remove('err'); wrapEl.classList.add('loading');
        var b = f.querySelector('button'), label = b ? b.textContent : '';
        if (b) { b.disabled = true; b.textContent = t('Adding…', 'جارٍ الإضافة…'); }
        var errEl = wrapEl.querySelector('.tr-err, .sh-err, [data-err]');
        if (errEl && !errEl.hasAttribute('data-bad-email')) errEl.setAttribute('data-bad-email', errEl.textContent);
        var settle = function (o) {
          /* the success line says whether a welcome code is on its way: the API knows if this address has ordered before */
          if (o && o.welcome === false) wrapEl.classList.add('w-no');
          else if (o && o.welcome === 'sent') wrapEl.classList.add('w-sent');
          wrapEl.classList.remove('loading', 'err');
          wrapEl.classList.add('done');
          done(true, wrapEl);
          ev('waitlist_signup', { source: src });
          /* 25 Oct 2026 (retention audit): the standard lead events, so ads can learn from sign-ups.
             Meta Lead is mirrored to TikTok SubmitForm by assets/tiktok-pixel.js. */
          ev('generate_lead', { lead_source: src, currency: 'AED', value: 0 });
          try { if (window.sbMeta) window.sbMeta('Lead', { content_name: src }); } catch (e) {}
        };
        /* 8 Oct 2026 (Faheem): the success line shows only once Shopify has the address. If saving fails
           we try once more, then say so plainly instead of pretending, so nobody thinks they are on a list
           they are not on. */
        var fail = function (badEmail) {
          wrapEl.classList.remove('loading'); wrapEl.classList.add('err');
          if (b) { b.disabled = false; b.textContent = label; }
          var msg = badEmail ? (errEl && errEl.getAttribute('data-bad-email')) :
            t('That did not save. Please try again, or message us on WhatsApp: +971 58 544 9946.', 'لم يتم حفظ بياناتك. يُرجى المحاولة مرة أخرى، أو راسلنا على واتساب: ‎+971 58 544 9946');
          if (errEl) errEl.textContent = msg;
          else { errEl = document.createElement('p'); errEl.setAttribute('data-err', ''); errEl.setAttribute('role', 'alert'); errEl.style.cssText = 'margin:12px 0 0;color:#7E4114;font-size:15px'; errEl.textContent = msg; f.parentNode.insertBefore(errEl, f.nextSibling); }
          if (errEl.hasAttribute('data-err')) errEl.style.display = 'block';
          if (!badEmail) ev('waitlist_fail', { source: src });
        };
        /* 4 Oct 2026: named selects in the form (sizes on /trail/) ride along as fields */
        var fields = null;
        [].forEach.call(f.querySelectorAll('select[name], input[type=hidden][name]'), function (el) { if (el.value) { fields = fields || {}; fields[el.name] = el.value; } });
        if (AR) { fields = fields || {}; fields.lang = 'ar'; }
        var attempt = function (n) {
          post(email, src, fields).then(function (o) {
            if (o.stored) return settle(o);
            if (n < 1) return setTimeout(function () { attempt(n + 1); }, 1500);
            fail(false);
          }, function (err) {
            if (err && err.message === 'email') return fail(true);
            if (n < 1) return setTimeout(function () { attempt(n + 1); }, 1500);
            fail(false);
          });
        };
        attempt(0);
      });
      return f;
  }

  /* ------------------------------------------------ the welcome code offer */
  /* 13 Nov 2026 (Faheem: "we need to maximize email capture"). He chose a welcome code (AED 50 off a first order over
     AED 199, valid for 14 days, emailed by Shopify Flow, never shown on the site), said on the forms and in a gentle sheet. */
  var OFFER = {
    eye: t('Welcome', 'أهلًا بك'),
    h: t('AED 50 off your first order', 'خصم 50 درهمًا على طلبك الأول'),
    p: t('On orders over AED 199. Leave your email and we send you a code, valid for 14 days. You also hear about each new release first.',
         'على الطلبات التي تزيد على 199 درهمًا. اترك بريدك الإلكتروني ونرسل إليك رمزًا صالحًا لمدة 14 يومًا، وتكون أول من يعرف بكل إصدار جديد.'),
    btn: t('Email me my code', 'أرسلوا لي الرمز'),
    yes: t('Check your inbox. Your code is on its way, and it lasts 14 days.', 'تفقّد بريدك الإلكتروني. الرمز في طريقه إليك، وهو صالح لمدة 14 يومًا.'),
    no: t('You are on the list. The welcome code is for a first order, and this email has ordered with us before.', 'أنت الآن على القائمة. رمز الترحيب للطلب الأول فقط، وقد سبق الطلب بهذا البريد الإلكتروني.'),
    sent: t('You are on the list. We have already sent a welcome code to this email.', 'أنت الآن على القائمة. سبق أن أرسلنا رمز ترحيب إلى هذا البريد الإلكتروني.'),
    bad: t('Please enter a valid email address.', 'يُرجى إدخال بريد إلكتروني صحيح.'),
    fine: t('One code per person. Unsubscribe any time.', 'رمز واحد لكل شخص. يمكنك إلغاء الاشتراك في أي وقت.'),
    no2: t('No thanks', 'لا، شكرًا'),
    close: t('Close', 'إغلاق'),
    ph: t('you@email.com', 'you@email.com')
  };
  /* remembered in this browser only: a sign-up hides the sheet and the bag line for good, a dismissal for 14 days */
  var K_DONE = 'sb_cap_done', K_SEEN = 'sb_cap_seen', DAYS14 = 14 * 864e5;
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function isDone() { return !!lsGet(K_DONE); }
  /* signed up through any form: the sheet goes, unless it was the sheet's own form (it shows its confirmation) */
  function done(v, from) { if (v) lsSet(K_DONE, String(Date.now())); document.documentElement.classList.add('sb-cap-done');
    if (v && sheet && !sheet.hidden && !(from && sheet.contains(from))) hideSheet(); }
  if (isDone()) document.documentElement.classList.add('sb-cap-done');

  function formHtml(src, opts) {
    opts = opts || {};
    return '<form class="sbc-form" data-waitlist data-source="' + src + '" novalidate>' +
      '<input type="email" name="email" placeholder="' + OFFER.ph + '" aria-label="' + t('Email address', 'البريد الإلكتروني') + '" autocomplete="email" required' + (opts.id ? ' id="' + opts.id + '"' : '') + '>' +
      '<button type="submit">' + (opts.btn || OFFER.btn) + '</button></form>' +
      '<p class="sbc-err" data-err role="alert">' + OFFER.bad + '</p>' +
      '<p class="sbc-ok" role="status">' + (opts.yes || OFFER.yes) + '</p><p class="sbc-ok sbc-ok-no" role="status">' + (opts.no || OFFER.no) + '</p><p class="sbc-ok sbc-ok-sent" role="status">' + (opts.sent || OFFER.sent) + '</p>';
  }

  /* the sheet: rises once the visitor has read some of the page (40% of it, or 25 seconds once past the first screen),
     never on the first screen, never over the bag, the size finder or a form already in view, once every 14 days,
     and never again after signing up */
  var sheet = null;
  function makeSheet() {
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.className = 'sbc-sheet';
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'false'); sheet.setAttribute('aria-labelledby', 'sbcH');
    if (AR) { sheet.setAttribute('dir', 'rtl'); sheet.setAttribute('lang', 'ar'); }
    sheet.hidden = true;
    sheet.innerHTML = '<div class="sbc-card" data-waitlist-wrap>' +
      '<button type="button" class="sbc-x" aria-label="' + OFFER.close + '">&#10005;</button>' +
      '<span class="sbc-eye">' + OFFER.eye + '</span><h2 id="sbcH">' + OFFER.h + '</h2><p class="sbc-p">' + OFFER.p + '</p>' +
      formHtml('sheet', { id: 'sbcEmail' }) +
      '<p class="sbc-fine">' + OFFER.fine + ' <button type="button" class="sbc-no">' + OFFER.no2 + '</button></p></div>';
    document.body.appendChild(sheet);
    bind(sheet.querySelector('form'));
    var shut = function (why) { hideSheet(why); };
    sheet.querySelector('.sbc-x').addEventListener('click', function () { shut('close'); });
    sheet.querySelector('.sbc-no').addEventListener('click', function () { shut('no_thanks'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheet && !sheet.hidden) shut('escape'); });
    return sheet;
  }
  var sheetFrom = '';
  function showSheet(from) {
    makeSheet();
    if (!sheet.hidden) return;
    sheetFrom = from || 'auto';
    sheet.hidden = false;
    requestAnimationFrame(function () { sheet.classList.add('on'); });
    lsSet(K_SEEN, String(Date.now()));
    ev('signup_sheet', { action: 'shown', trigger: sheetFrom, page: location.pathname });
  }
  function hideSheet(why) {
    if (!sheet || sheet.hidden) return;
    sheet.classList.remove('on');
    var s0 = sheet; setTimeout(function () { s0.hidden = true; }, 260);
    if (why) ev('signup_sheet', { action: why, trigger: sheetFrom, page: location.pathname });
  }
  var SKIP_SHEET = /^\/(ar\/)?(admin|h)(\/|$)/;
  function busy() {
    var d = document.getElementById('sbDrawer'); if (d && d.classList.contains('on')) return true;
    var pk = document.getElementById('sbPeek'); if (pk && !pk.hidden) return true;
    if (document.querySelector('.sfx:not([hidden])')) return true;
    var a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return true;
    var w = document.querySelectorAll('[data-waitlist-wrap]');
    for (var i = 0; i < w.length; i++) { if (sheet && sheet.contains(w[i])) continue; var r = w[i].getBoundingClientRect(); if (r.height && r.top < innerHeight && r.bottom > 0) return true; }
    return false;
  }
  (function autoSheet() {
    if (isDone() || SKIP_SHEET.test(location.pathname || '/')) return;
    var seen = +lsGet(K_SEEN) || 0; if (seen && Date.now() - seen < DAYS14) return;
    var t0 = Date.now(), fired = false, iv = 0, raf = 0;
    function check() {
      raf = 0;
      if (fired || isDone()) return stop();
      var y = window.scrollY || document.documentElement.scrollTop || 0;
      var H = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      var past = y > innerHeight * 0.9;
      if (!past) return;
      if (y / H < 0.4 && Date.now() - t0 < 25000) return;
      if (busy()) return;
      fired = true; stop(); showSheet(y / H >= 0.4 ? 'scroll' : 'time');
    }
    function q() { if (!raf) raf = requestAnimationFrame(check); }
    function stop() { removeEventListener('scroll', q); if (iv) clearInterval(iv); }
    addEventListener('scroll', q, { passive: true });
    iv = setInterval(check, 2000);
  })();

  /* the line in the bag: opens a small form in place, so nobody leaves the bag to get the code */
  function bagLine() {
    var foot = document.getElementById('sbFoot'); if (!foot || document.getElementById('sbWc')) return !!foot;
    var box = document.createElement('div');
    box.className = 'sbc-bag'; box.id = 'sbWc'; box.setAttribute('data-waitlist-wrap', '');
    box.innerHTML = '<button type="button" class="sbc-bag-t" aria-expanded="false">' + t('First order? Get AED 50 off over AED 199.', 'طلبك الأول؟ احصل على خصم 50 درهمًا على ما يزيد على 199 درهمًا.') +
      ' <u>' + t('Get my code', 'أريد الرمز') + '</u></button><div class="sbc-bag-f" hidden>' +
      formHtml('bag', { btn: t('Send', 'أرسل'), yes: t('Check your inbox. Your code is on its way: paste it at checkout.', 'تفقّد بريدك الإلكتروني. الرمز في طريقه إليك: الصقه عند الدفع.') }) + '</div>';
    foot.insertBefore(box, foot.firstChild);
    bind(box.querySelector('form'));
    var tg = box.querySelector('.sbc-bag-t'), fm = box.querySelector('.sbc-bag-f');
    tg.addEventListener('click', function () { var open = fm.hidden; fm.hidden = !open; tg.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) { ev('signup_sheet', { action: 'bag_open', page: location.pathname }); var i = fm.querySelector('input'); if (i) try { i.focus(); } catch (e) {} } });
    return true;
  }
  /* the bag is built the first time it is needed: watch for it */
  if (!bagLine() && window.MutationObserver) { var mo = new MutationObserver(function () { if (bagLine()) mo.disconnect(); }); mo.observe(document.body, { childList: true }); }

  /* 14 Nov 2026: the one-line link on product pages opens the sheet (capture.js link) */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-sbc-open]'); if (!a) return;
    e.preventDefault(); showSheet(a.getAttribute('data-sbc-open') || 'link');
  });
  /* 14 Nov 2026 (homepage: the welcome block became the one-line link): an old /#welcome-code link opens the sheet */
  if (location.hash === '#welcome-code' && !document.getElementById('welcome-code') && !isDone()) setTimeout(function () { showSheet('hash'); }, 600);
  window.SBCapture = { bind: bind, open: showSheet, form: formHtml, offer: OFFER, done: isDone };

  (function takeover() {
    var forms = document.querySelectorAll('form[data-waitlist]');
    for (var i = 0; i < forms.length; i++) bind(forms[i]);
  })();
})();
