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
        return { stored: !!(j && j.stored) };
      });
    });
  }
  /* Arabic pages: the form messages below keep their existing Arabic. The bar itself is
     English on /ar/ too (set left-to-right), because no new Arabic copy goes live until an
     Emirati reader has checked it. */
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
      en: 'Sahel and Sahra Trail pre-order opens Wed 28 Oct.' },
    { from: Date.UTC(2026, 9, 28, 4, 0, 0), href: '/new/',
      en: 'Pre-order is open. 20% off until Thu 29 Oct, 23:59. Ships from Fri 30 Oct.' },
    { from: Date.UTC(2026, 9, 29, 20, 0, 0), href: '/new/',
      en: 'Sahel and Sahra Trail are out. Designed in the UAE for everyone who loves it.' }
  ];
  /* ?sbstage=0|1|2 previews a stage (for checking before the date; nothing is stored) */
  var forced = null;
  try { var fm = /[?&]sbstage=(\d)/.exec(location.search || ''); if (fm && STAGES[+fm[1]]) forced = +fm[1]; } catch (e) {}
  function stageAt(now) {
    if (forced !== null) return forced;
    var k = 0;
    for (var i = 0; i < STAGES.length; i++) if (now >= STAGES[i].from) k = i;
    return k;
  }

  var SHIP = '<span class="sb-ship-uae">Free next-day UAE delivery</span><span class="sb-ship-gcc">GCC delivery in 3&ndash;5 days</span><span class="sb-ship-intl">Worldwide delivery</span>';
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
    bar.setAttribute('href', S.href);
    bar.setAttribute('data-stage', String(k));
    bar.innerHTML =
      '<span class="sbw-sheen"></span>' +
      '<span class="sbw-bar-in">' +
        '<span class="sbw-dot" aria-hidden="true"></span>' +
        '<span class="sbw-msg"' + (AR ? ' dir="ltr" lang="en"' : '') + '>' + esc(S.en) + '</span>' +
        /* no next-day promise beside the pre-order stage: those pieces ship from Fri 30 Oct */
        (k === 1 ? '' : '<span class="sbw-sep sbw-hide-sm sbw-shipwrap" aria-hidden="true">&middot;</span>' +
        '<span class="sbw-hide-sm sbw-ship sbw-shipwrap"' + (AR ? ' dir="ltr" lang="en"' : '') + '>' + SHIP + '</span>') +
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
  bar.addEventListener('click', function () { ev('topbar_click', { stage: current, page: location.pathname }); });

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
  (function takeover() {
    var forms = document.querySelectorAll('form[data-waitlist]');
    for (var i = 0; i < forms.length; i++) (function (old) {
      var f = old.cloneNode(true);
      old.parentNode.replaceChild(f, old);
      var wrapEl = f.closest('[data-waitlist-wrap]') || f.parentNode;
      var src = f.getAttribute('data-source') || 'waitlist';
      f.removeAttribute('data-endpoint');
      var inp = f.querySelector('input[type=email], input[name=email_address], input[name=email]');
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
        var settle = function () {
          wrapEl.classList.remove('loading', 'err');
          wrapEl.classList.add('done');
          ev('waitlist_signup', { source: src });
        };
        /* 8 Oct 2026 (Faheem): the success line shows only once Shopify has the address. If saving fails
           we try once more, then say so plainly instead of pretending, so nobody thinks they are on a list
           they are not on. */
        var fail = function (badEmail) {
          wrapEl.classList.remove('loading'); wrapEl.classList.add('err');
          if (b) { b.disabled = false; b.textContent = label; }
          var msg = badEmail ? (errEl && errEl.getAttribute('data-bad-email')) :
            t('That did not save. Please try again, or message us on WhatsApp: +971 58 544 9946.', 'لم يُحفظ طلبك. يُرجى المحاولة مرة أخرى، أو راسلنا على واتساب: ‎+971 58 544 9946');
          if (errEl) errEl.textContent = msg;
          else { errEl = document.createElement('p'); errEl.setAttribute('data-err', ''); errEl.setAttribute('role', 'alert'); errEl.style.cssText = 'margin:12px 0 0;color:#9b3a25;font-size:15px'; errEl.textContent = msg; f.parentNode.insertBefore(errEl, f.nextSibling); }
          if (errEl.hasAttribute('data-err')) errEl.style.display = 'block';
          if (!badEmail) ev('waitlist_fail', { source: src });
        };
        /* 4 Oct 2026: named selects in the form (sizes on /trail/) ride along as fields */
        var fields = null;
        [].forEach.call(f.querySelectorAll('select[name], input[type=hidden][name]'), function (el) { if (el.value) { fields = fields || {}; fields[el.name] = el.value; } });
        if (AR) { fields = fields || {}; fields.lang = 'ar'; }
        var attempt = function (n) {
          post(email, src, fields).then(function (o) {
            if (o.stored) return settle();
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
    })(forms[i]);
  })();
})();
