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

  var OFFER = {
    code: 'GOBEYOND50',  /* fallback only — /api/subscribe returns the live one */
    amount: 'AED 50',
    min: 150,
    api: '/api/subscribe'
  };

  /* POST an address to Shopify. Resolves with the code to show. Never rejects:
     a capture failure must not cost the visitor the offer they were promised,
     and /api/subscribe reports stored:false in the Vercel log when that happens. */
  function subscribe(email, source) {
    return fetch(OFFER.api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, source: source })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 400) throw new Error('email');
        return (j && j.code) || OFFER.code;
      });
    });
  }
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
      '<span class="sbw-amt">' + OFFER.amount + ' off your first order</span>' +
      '<span class="sbw-sep sbw-hide-sm" aria-hidden="true">·</span>' +
      '<span class="sbw-hide-sm">Free tote</span>' +
      '<span class="sbw-sep sbw-hide-sm" aria-hidden="true">·</span>' +
      '<span class="sbw-hide-sm">Free next-day UAE delivery</span>' +
      '<span class="sbw-go">Get the code &rarr;</span>' +
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
  else document.body.insertBefore(wrap, document.body.firstChild);

  /* nav is position:fixed and `body.has-topbar nav{top:var(--topbar-h)}` pins it
     that far down the viewport FOREVER — the topbar itself is position:relative
     and scrolls away. At the old ~34px that read as a design detail; at 106px
     with this bar the nav floats over the page. So --topbar-h stays the full
     height (#s-hero sizes off it and should start below the whole bar) and the
     nav's own top is driven from scroll instead, reaching 0 once the bar is
     past. Inline style, so it beats the stylesheet rule without a specificity
     fight; nothing else on the page writes nav.style.top — the page's own nav
     script only toggles the .on-hero / .solid classes. */
  var navEl = document.querySelector('nav');
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
  m.setAttribute('aria-label', OFFER.amount + ' off your first order');
  m.innerHTML =
    '<div class="sbw-scrim" data-sbw-close></div>' +
    '<div class="sbw-card">' +
      '<span class="sbw-glow" aria-hidden="true"></span>' +
      '<button type="button" class="sbw-close" data-sbw-close aria-label="Close">&times;</button>' +
      '<div class="sbw-ask">' +
        '<p class="sbw-eyebrow">Founding Edition &nbsp;·&nbsp; first order</p>' +
        '<p class="sbw-big">' + OFFER.amount + '<small>off your first order</small></p>' +
        '<div class="sbw-rule" aria-hidden="true"></div>' +
        '<ul class="sbw-list">' +
          '<li>A free Sahra canvas tote with every order</li>' +
          '<li>Free next-day delivery across the UAE &mdash; order by 2 pm, no minimum</li>' +
          '<li>Free exchange within 14 days if the size is wrong</li>' +
          '<li>Every piece numbered &mdash; 1 of 40 per design, never restocked</li>' +
        '</ul>' +
        '<p class="sbw-err">That email does not look right. Try again?</p>' +
        '<form class="sbw-form" novalidate>' +
          '<input type="email" name="email" inputmode="email" autocomplete="email" required placeholder="you@email.com" aria-label="Email address">' +
          '<button type="submit">Send my code</button>' +
        '</form>' +
        '<p class="sbw-fine">One email when a new place drops. Nothing else, and you can leave any time. Minimum order AED ' + OFFER.min + '.</p>' +
      '</div>' +
      '<div class="sbw-won">' +
        '<p class="sbw-eyebrow">You&rsquo;re on the list</p>' +
        '<p class="sbw-big">' + OFFER.amount + '<small>use it at checkout</small></p>' +
        '<div class="sbw-code"><b>' + OFFER.code + '</b><button type="button" class="sbw-copy">Copy</button></div>' +
        '<a class="sbw-shop" href="/shop/">Shop the collection</a>' +
        '<p class="sbw-fine">One use per customer, on orders over AED ' + OFFER.min + '. Reopen the gold bar any time to see it again.</p>' +
      '</div>' +
    '</div>';
  document.body.appendChild(m);

  var lastFocus = null, surfaced = 0;
  function open(src) {
    if (m.hidden === false) return;
    /* any open — including a deliberate one from the bar — counts as surfaced,
       so the timer/exit-intent below never re-opens it on top of the visitor */
    surfaced = 1; st.seen = 1; write(st);
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
    if (lastFocus) { try { lastFocus.focus(); } catch (e) {} }
  }

  bar.addEventListener('click', function () { open('bar'); });
  m.addEventListener('click', function (e) { if (e.target.hasAttribute('data-sbw-close')) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !m.hidden) close(); });

  /* copy */
  m.querySelector('.sbw-copy').addEventListener('click', function () {
    var b = this;
    var done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1800); };
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
    btn.disabled = true; btn.textContent = 'Sending…';

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
        btn.disabled = false; btn.textContent = 'Send my code';
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
      if (inp) inp.addEventListener('input', function () { wrapEl.classList.remove('err'); });
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = ((inp && inp.value) || '').trim();
        if (!RE.test(email)) { wrapEl.classList.add('err'); if (inp) inp.focus(); return; }
        wrapEl.classList.remove('err'); wrapEl.classList.add('loading');
        var b = f.querySelector('button'), label = b ? b.textContent : '';
        if (b) { b.disabled = true; b.textContent = 'Adding…'; }
        var settle = function () {
          wrapEl.classList.remove('loading', 'err');
          wrapEl.classList.add('done');
          ev('waitlist_signup', { source: src });
        };
        subscribe(email, src).then(settle, function (err) {
          if (err && err.message === 'email') {
            wrapEl.classList.remove('loading'); wrapEl.classList.add('err');
            if (b) { b.disabled = false; b.textContent = label; }
            return;
          }
          settle();
        });
      });
    })(forms[i]);
  })();

  /* ------------------------------------------------------- auto-surface */
  /* Opens on arrival rather than waiting for a click. 1.4 s, not 0: at zero the
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
  if (!st.won && !openedThisSession) {
    setTimeout(function () {
      if (surfaced) return;
      try { sessionStorage.setItem(SESSION, '1'); } catch (e) {}
      open('auto');
    }, 1400);
  }
})();
