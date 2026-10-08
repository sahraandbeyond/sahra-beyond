/* sahra-welcome.js — AED 50 first-order offer: gold bar + email-capture modal.
 *
 * The code is revealed ONLY after an email is captured, so the AED 50 buys a
 * subscriber rather than just discounting a sale.
 *
 * Capture goes to /api/subscribe, which writes the address to Shopify as a
 * customer with emailMarketingConsent SUBSCRIBED. Kit (ConvertKit) is gone:
 * this file also TAKES OVER every [data-waitlist] form on the page (the
 * homepage newsletter and the ones build-products.js emits) and re-points them
 * at the same endpoint, so no capture anywhere still reaches Kit. The Kit
 * markup left in those pages is inert — see the takeover block at the bottom.
 *
 * GOBEYOND50 in Shopify: AED 50 off, one use per customer, minimum subtotal
 * AED 150, combines with nothing, capped at 150 redemptions, expires
 * 31 Dec 2026. /api/subscribe returns the live code, so renaming it in Shopify
 * plus DEFAULT_CODE there is enough; OFFER.code here is only the fallback used
 * when that request fails.
 *
 * The bar is inserted INSIDE .sb-topbar rather than as a sibling above it.
 * body.has-topbar nav{top:var(--topbar-h)} positions the fixed nav, and the
 * page's own inline script sets that variable from .sb-topbar.offsetHeight —
 * it runs after this file and would clobber any value set here. Nesting means
 * that measurement includes this bar automatically and the two agree instead
 * of racing. The re-measure below is belt and braces, not the mechanism.
 *
 * Storage: every localStorage access is wrapped — it throws in private mode and
 * returns empty in previews. Without it the bar still renders; only the
 * "don't nag twice" memory is lost.
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

  var OFFER = {
    code: 'GOBEYOND50',  /* fallback only — /api/subscribe returns the live one */
    amount: 'AED 50',
    min: 150,
    api: '/api/subscribe',
    /* The tote is a real listed product at AED 50 (/tote/), which is what makes
       "worth AED 50" a checkable claim rather than an invented anchor — the
       substantiation rule. If that price ever moves, move it here too and the
       bar, the modal and the cart all follow. */
    toteValue: 'AED 50',
    /* total is COMPUTED below, never typed. Both halves are real prices - GOBEYOND50
       is AED 50 off and the same tote is listed for sale at AED 50 (SB-TOTE-50) - but a
       third hand-maintained copy of the arithmetic is how "AED 100" survives a change
       to either half. Change amount or toteValue and the sum follows. */
    toteImg: '/shirts/tote-band.webp'
  };
  OFFER.total = 'AED ' + ((parseInt(OFFER.amount.replace(/\D/g, ''), 10) || 0) +
                          (parseInt(OFFER.toteValue.replace(/\D/g, ''), 10) || 0));

  /* POST an address to Shopify. Resolves with the code to show. Never rejects:
     a capture failure must not cost the visitor the offer they were promised,
     and /api/subscribe reports stored:false in the Vercel log when that happens. */
  function post(email, source, fields) {
    return fetch(OFFER.api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields ? { email: email, source: source, fields: fields } : { email: email, source: source })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 400) throw new Error('email');
        return { code: (j && j.code) || OFFER.code, stored: !!(j && j.stored) };
      });
    });
  }
  function subscribe(email, source, fields) { return post(email, source, fields).then(function (o) { return o.code; }); }
  /* Arabic pages (30 Sep 2026, Faheem: "put it there"): same offer, Arabic copy, RTL.
     Western digits, as the rest of /ar/ uses. Native read still pending, like the rest of /ar/. */
  var AR = /^ar\b/i.test(document.documentElement.getAttribute('lang') || '') || /^\/ar\//.test(location.pathname || '');
  function t(en, ar) { return AR ? ar : en; }
  var N = String(parseInt(OFFER.amount.replace(/\D/g, ''), 10) || 50), NT = String(parseInt(OFFER.toteValue.replace(/\D/g, ''), 10) || 50),
      NS = OFFER.total.replace(/\D/g, '');
  var AMT_OFF = t(OFFER.amount + ' off your first order', 'خصم ' + N + ' درهمًا على طلبك الأول'),
      TOTE = t('Free tote worth ' + OFFER.toteValue, 'حقيبة مجانية بقيمة ' + NT + ' درهمًا'),
      SHIP = t('<span class="sb-ship-uae">Free next-day UAE delivery</span><span class="sb-ship-gcc">GCC delivery in 3&ndash;5 days</span><span class="sb-ship-intl">Worldwide delivery</span>',
               '<span class="sb-ship-uae">توصيل مجاني في اليوم التالي داخل الإمارات</span><span class="sb-ship-gcc">التوصيل لدول الخليج خلال 3–5 أيام</span><span class="sb-ship-intl">التوصيل إلى جميع أنحاء العالم</span>');

  var KEY = 'sbw.v2';   /* bump to reset every visitor's stored state */
  var RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

  function read() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function write(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  function ev(name, params) { try { if (window.gtag) window.gtag('event', name, params || {}); } catch (e) {} }

  var st = read();

  /* ---------------------------------------------------------------- bar */
  var host = document.querySelector('.sb-topbar');
  var bar = document.createElement('button');
  bar.type = 'button';
  bar.className = 'sbw-bar';
  bar.setAttribute('aria-haspopup', 'dialog');
  bar.innerHTML =
    '<span class="sbw-sheen"></span>' +
    '<span class="sbw-bar-in">' +
      '<span class="sbw-dot" aria-hidden="true"></span>' +
      '<span class="sbw-amt">' + AMT_OFF + '</span>' +
      '<span class="sbw-sep sbw-tote" aria-hidden="true">·</span>' +
      '<span class="sbw-amt sbw-tote">' + TOTE + '</span>' +
      '<span class="sbw-sep sbw-hide-sm" aria-hidden="true">·</span>' +
      /* market-aware like the phone rotation, now that this bar is the only delivery line (30 Sep 2026) */
      '<span class="sbw-hide-sm sbw-ship">' + SHIP + '</span>' +
      /* phones (24 Sep 2026): one slim line that rotates through the offer, the
         tote and delivery, instead of two stacked bars eating ~150px */
      '<span class="sbw-rot" aria-hidden="true">' +
        '<span class="sbw-ri">' + AMT_OFF + '</span>' +
        '<span class="sbw-ri">' + TOTE + '</span>' +
        '<span class="sbw-ri">' + SHIP + '</span>' +
      '</span>' +
      '<span class="sbw-go">' + t('Get the code &rarr;', 'احصل على الرمز &larr;') + '</span>' +
    '</span>';

  /* No dismiss control. It lived at the right edge INSIDE the bar people tap to
     open the offer, so aiming for the bar and hitting dismiss was the likely
     outcome, not an edge case — and it wrote a permanent flag with no way back.
     The modal has its own close; the bar is a one-line offer strip, not a
     consent banner, so there is nothing here to consent away from. */
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

  /* -------------------------------------------------------------- modal */
  var m = document.createElement('div');
  m.className = 'sbw-modal';
  m.hidden = true;
  m.setAttribute('role', 'dialog');
  m.setAttribute('aria-modal', 'true');
  m.setAttribute('aria-label', t(OFFER.amount + ' off your first order, plus a free tote worth ' + OFFER.toteValue + ' \u2014 ' + OFFER.total + ' together on your first order over AED ' + OFFER.min + '.',
    'خصم ' + N + ' درهمًا على طلبك الأول، وحقيبة مجانية بقيمة ' + NT + ' درهمًا: ' + NS + ' درهم معًا على طلبك الأول فوق ' + OFFER.min + ' درهمًا.'));
  if (AR) m.setAttribute('dir', 'rtl');
  m.innerHTML =
    '<div class="sbw-scrim" data-sbw-close></div>' +
    '<div class="sbw-card">' +
      '<span class="sbw-glow" aria-hidden="true"></span>' +
      '<button type="button" class="sbw-close" data-sbw-close aria-label="' + t('Close', 'إغلاق') + '">&times;</button>' +
      '<div class="sbw-ask">' +
        /* Rebuilt 19 Sep (Faheem: the eye has to land on BOTH fifties, the card
           was crowded and the photo was small and off to one side). The tote is
           now a full-bleed band across the top, and the two halves of the offer
           are one symmetrical pair at the same weight — neither is a footnote to
           the other. The three bullets collapsed into a single fine-print line;
           they were competing with the numbers for the same attention. */
        '<figure class="sbw-hero">' +
          '<img src="' + OFFER.toteImg + '" alt="' + t('The Sahra Tote in natural canvas, carried over the shoulder', 'حقيبة صحراء من القماش الطبيعي، محمولة على الكتف') + '" width="1160" height="580" decoding="async">' +
          '<figcaption>' + t('The Sahra Tote &nbsp;·&nbsp; free with every order', 'حقيبة صحراء &nbsp;·&nbsp; مجانًا مع كل طلب') + '</figcaption>' +
        '</figure>' +
        '<p class="sbw-eyebrow">' + t('Founding Edition &nbsp;·&nbsp; first order', 'الإصدار التأسيسي &nbsp;·&nbsp; الطلب الأول') + '</p>' +
        '<div class="sbw-pair">' +
          '<div class="sbw-tile"><b>' + t(OFFER.amount, N + ' درهمًا') + '</b><span>' + t('off your<br>first order', 'خصم على<br>طلبك الأول') + '</span></div>' +
          '<div class="sbw-tile"><b>' + t(OFFER.toteValue, NT + ' درهمًا') + '</b><span>' + t('tote,<br>yours free', 'حقيبة،<br>مجانًا لك') + '</span></div>' +
        '</div>' +
        /* The sum, added 19 Sep (Faheem: say they get AED 100 free). Deliberately
           parts-THEN-total, not the reverse: a lone "AED 100 of value" headline is the
           claim every discount popup makes, and three separate reviews read it as
           inflation. Shown after the two fifties it is arithmetic the reader has just
           verified. Set as a receipt total - hairline above, no box, no gold fill -
           so it reads as the sum of the two tiles and not as a third line item, and so
           the only gold-filled block on the card stays the button. */
        '<p class="sbw-sum"><small>' + t('Together, that&rsquo;s', 'معًا') + '</small><b>' + t(OFFER.total, NS + ' درهم') + '</b><small>' + t('on your first order over AED ' + OFFER.min, 'على طلبك الأول فوق ' + OFFER.min + ' درهمًا') + '</small></p>' +
        '<p class="sbw-err" id="sbw-err" role="alert">' + t('That email does not look right. Try again?', 'يبدو أن البريد الإلكتروني غير صحيح. هل تحاول مرة أخرى؟') + '</p>' +
        '<form class="sbw-form" novalidate>' +
          '<input type="email" name="email" inputmode="email" autocomplete="email" required placeholder="you@email.com" aria-label="' + t('Email address', 'البريد الإلكتروني') + '" aria-describedby="sbw-err"' + (AR ? ' dir="ltr"' : '') + '>' +
          '<button type="submit">' + t('Send my code', 'أرسل لي الرمز') + '</button>' +
        '</form>' +
        /* The old single "Minimum order AED 150" sat under BOTH halves and read as if the
           tote needed AED 150 too. It does not - assets/sahra-cart.js earns the gift on
           item count with no subtotal test at all. Only the code has the minimum. */
        '<p class="sbw-fine">' + t('Tote with every order, no minimum &middot; one code per customer &middot; free next-day UAE delivery, order by 2 pm &middot; free 14-day exchanges &middot; emails about new places, drops and offers; unsubscribe any time.',
          'الحقيبة مع كل طلب بلا حد أدنى &middot; رمز واحد لكل عميل &middot; توصيل مجاني في الإمارات في يوم العمل التالي للطلبات قبل الساعة 2 ظهرًا &middot; استبدال مجاني خلال 14 يومًا &middot; رسائل عن الأماكن والإصدارات والعروض الجديدة، ويمكنك إلغاء الاشتراك في أي وقت.') + '</p>' +
      '</div>' +
      '<div class="sbw-won">' +
        '<p class="sbw-eyebrow">' + t('You&rsquo;re on the list', 'تم تسجيلك') + '</p>' +
        '<p class="sbw-big">' + t(OFFER.amount, N + ' درهمًا') + '<small>' + t('use it at checkout', 'استخدمه عند الدفع') + '</small></p>' +
        '<div class="sbw-code"><b>' + OFFER.code + '</b><button type="button" class="sbw-copy">' + t('Copy', 'نسخ') + '</button></div>' +
        '<p class="sbw-plus sbw-plus-sm"><span aria-hidden="true">+</span> ' + t('your tote, <b>worth ' + OFFER.toteValue + '</b>, is added free at checkout', 'حقيبتك، <b>بقيمة ' + NT + ' درهمًا</b>، تُضاف مجانًا عند الدفع') + '</p>' +
        '<a class="sbw-shop" href="' + t('/shop/', '/ar/shop/') + '">' + t('Shop the collection', 'تسوّق المجموعة') + '</a>' +
        '<p class="sbw-fine">' + t('One use per customer, on orders over AED ' + OFFER.min + '. Reopen the gold bar any time to see it again.', 'استخدام واحد لكل عميل، على الطلبات فوق ' + OFFER.min + ' درهمًا. افتح الشريط الذهبي في أي وقت لتراه مجددًا.') + '</p>' +
      '</div>' +
    '</div>';
  document.body.appendChild(m);

  var lastFocus = null, surfaced = 0;
  function open(src) {
    if (m.hidden === false) return;
    /* any open — including a deliberate one from the bar — counts as surfaced,
       so the timer/exit-intent below never re-opens it on top of the visitor */
    surfaced = 1; st.seen = 1; write(st);
    var tz = document.querySelector('.sbw-teaser'); if (tz) tz.remove();
    lastFocus = document.activeElement;
    m.hidden = false;
    if (st.won) m.classList.add('is-won');
    var f = m.querySelector(st.won ? '.sbw-copy' : '.sbw-form input');
    if (f) setTimeout(function () { try { f.focus(); } catch (e) {} }, 60);
    ev('welcome_offer_open', { source: src || 'bar' });
  }
  function close() {
    m.hidden = true;
    m.classList.remove('is-err');
    /* opened by the timer or the teaser, focus was on <body> (or on the teaser, now removed):
       hand it to the gold bar instead of dropping it (a11y review, 30 Sep 2026) */
    var back = (lastFocus && lastFocus !== document.body && document.contains(lastFocus)) ? lastFocus : bar;
    try { back.focus(); } catch (e) {}
  }

  bar.addEventListener('click', function () { open('bar'); });
  m.addEventListener('click', function (e) { if (e.target.hasAttribute('data-sbw-close')) close(); });
  document.addEventListener('keydown', function (e) {
    if (m.hidden) return;
    if (e.key === 'Escape') { close(); return; }
    /* keep Tab inside the card while it is open (a11y review, 28 Sep 2026) */
    if (e.key !== 'Tab') return;
    var f = Array.prototype.filter.call(m.querySelectorAll('.sbw-card button, .sbw-card input, .sbw-card a[href]'), function (x) { return x.offsetParent !== null && !x.disabled; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (e.shiftKey && (a === first || !m.contains(a))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (a === last || !m.contains(a))) { e.preventDefault(); first.focus(); }
  });

  /* copy */
  m.querySelector('.sbw-copy').addEventListener('click', function () {
    var b = this;
    var done = function () { b.textContent = t('Copied', 'تم النسخ'); setTimeout(function () { b.textContent = t('Copy', 'نسخ'); }, 1800); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(OFFER.code).then(done, done);
      else done();
    } catch (e) { done(); }
    ev('welcome_offer_copy', { code: OFFER.code });
  });

  /* submit — same Kit path as the homepage waitlist, public key, no new secret */
  var form = m.querySelector('.sbw-form');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var input = form.querySelector('input');
    var email = (input.value || '').trim();
    if (!RE.test(email)) { m.classList.add('is-err'); input.focus(); return; }
    m.classList.remove('is-err');
    var btn = form.querySelector('button');
    btn.disabled = true; btn.textContent = t('Sending…', 'جارٍ الإرسال…');

    var win = function (code) {
      st.won = 1; write(st);
      var slot = m.querySelector('.sbw-code b'); if (slot && code) slot.textContent = code;
      m.classList.add('is-won');
      var c = m.querySelector('.sbw-copy'); if (c) { try { c.focus(); } catch (_) {} }
      ev('welcome_offer_signup', { source: 'welcome_bar', code: code || OFFER.code });
      try { if (window.sbMeta && window.sbMeta.track) window.sbMeta.track('Lead', { content_name: code || OFFER.code }); } catch (_) {}
    };
    subscribe(email, 'welcome-bar').then(win, function (e) {
      if (e && e.message === 'email') {
        m.classList.add('is-err');
        btn.disabled = false; btn.textContent = t('Send my code', 'أرسل لي الرمز');
        input.focus();
        return;
      }
      win(OFFER.code);
    });
  });

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

  /* ------------------------------------------------------- auto-surface */
  /* Opens on arrival (except product pages and ad landings - see below) rather than waiting for a click. 1.4 s, not 0: at zero the
     card animates in over a half-painted page and reads as a glitch, and a
     reflexive dismiss before anyone has read it is the worst outcome for a
     conversion surface. The old exit-intent / 45%-scroll triggers are gone —
     redundant once it opens by itself.

     Shown once per browsing session, not once per visitor: someone who closes
     it today sees it again on their next visit, someone who closes it and keeps
     browsing does not get it again on the next page. Converted visitors never
     see it auto-open; the bar still shows them their code on tap. */
  var SESSION = 'sbw.session';
  var openedThisSession = false;
  try { openedThisSession = sessionStorage.getItem(SESSION) === '1'; } catch (e) {}
  /* 23 Sep 2026 (CRO review): NOT on a product page, and not when the visit
     came from an ad. Those visitors arrived with intent for one product; a modal
     over the photo and the size picker at 1.4 s stood between them and the buy
     box. They get a small teaser instead, after their first scroll or 20 s,
     which opens the same card only if tapped. Every other entry keeps the
     auto-open. */
  var qs = '';
  try { qs = location.search || ''; } catch (e) {}
  var AD = /[?&](gclid|gbraid|wbraid|fbclid|ttclid|utm_[a-z]+)=/i.test(qs);
  var PDP = /^\/(ar\/)?products\//.test(location.pathname || '');
  /* 28 Sep 2026 (places review): the guides are the main organic entry. A full-screen
     card 1.4 s after landing covered the guide a searcher came for, so guides get the
     same small teaser as product pages. Their own packing-list panel carries the offer. */
  var GUIDE = /^\/(ar\/)?(places|locations)\//.test(location.pathname || '');
  /* the choice holds for the whole visit: an ad or product-page arrival who
     taps through to another page still gets the teaser, not the modal */
  /* 6 Oct 2026 (Sahel page review): /sahel/ exists to collect one email for the Sahel list. The
     welcome card opening over it 1.4 s after landing would be a second, competing ask, and the
     corner teaser sits on the page's own gauge. The top bar still carries the offer. */
  var STORY = /^\/sahel\//.test(location.pathname || '');
  var QUIET = 'sbw.quiet', quiet = false;
  try { quiet = sessionStorage.getItem(QUIET) === '1'; if (AD || PDP || GUIDE) sessionStorage.setItem(QUIET, '1'); } catch (e) {}
  if (!st.won && !openedThisSession && !STORY) {
    if (AD || PDP || GUIDE || quiet) teaser(); else
    setTimeout(function () {
      if (surfaced) return;
      try { sessionStorage.setItem(SESSION, '1'); } catch (e) {}
      open('auto');
    }, 1400);
  }

  function teaser() {
    var shown = false, t = null;
    function show() {
      if (shown || surfaced) return; shown = true;
      removeEventListener('scroll', onScroll); clearTimeout(t);
      try { sessionStorage.setItem(SESSION, '1'); } catch (e) {}
      var el = document.createElement('div');
      el.className = 'sbw-teaser';
      el.innerHTML = '<button type="button" class="sbw-teaser-go">' + t(OFFER.amount + ' off<span class="sbw-t-long"> your first order</span> <span aria-hidden="true">&rarr;</span>', 'خصم ' + N + ' درهمًا<span class="sbw-t-long"> على طلبك الأول</span> <span aria-hidden="true">&larr;</span>') + '</button>' +
        '<button type="button" class="sbw-teaser-x" aria-label="' + t('Dismiss offer', 'إخفاء العرض') + '">&times;</button>';
      document.body.appendChild(el);
      requestAnimationFrame(function () { el.classList.add('on'); });
      el.querySelector('.sbw-teaser-go').addEventListener('click', function () { el.remove(); open('teaser'); });
      el.querySelector('.sbw-teaser-x').addEventListener('click', function () { el.remove(); ev('welcome_teaser_dismiss', {}); });
      /* ride above the product page's sticky buy bar instead of hiding under it */
      var bb = document.getElementById('buybar');
      if (bb && window.MutationObserver) {
        var lift = function () { el.classList.toggle('lift', bb.classList.contains('on')); };
        new MutationObserver(lift).observe(bb, { attributes: true, attributeFilter: ['class'] }); lift();
      }
      ev('welcome_teaser_show', { source: AD ? 'ad' : (PDP ? 'pdp' : (GUIDE ? 'guide' : 'visit')) });
    }
    function onScroll() { if ((window.scrollY || 0) > 120) show(); }
    addEventListener('scroll', onScroll, { passive: true });
    t = setTimeout(show, 20000);
  }
})();
