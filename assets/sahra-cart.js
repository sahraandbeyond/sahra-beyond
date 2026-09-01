/* ==========================================================================
   sahra-cart.js — THE cart for the whole site. One implementation, no others.
   ==========================================================================
   Storage key `sb_cart` holds the Shopify cart id and is shared everywhere, so
   a cart started on any page is the same cart at checkout.

   THE BUGS THIS FILE WAS REWRITTEN TO FIX — do not reintroduce them:

   1. BADGE SAID "3", DRAWER SAID EMPTY.
      `refresh()` set the badge from the server but never called `draw()`, and
      `open()` only toggled CSS classes. So on every fresh page load the drawer
      still held its initial "Your cart is empty" markup while the badge showed
      the real count. Reported by customers as "the cart logo shows items but
      the cart is empty". `draw()` now runs after every refresh AND on open.

   2. QUANTITIES WERE INVISIBLE.
      The line quantity was fetched in the GraphQL fragment and then never
      rendered. Add the same size twice and you saw ONE line, no quantity, but
      a badge of 2 and a doubled subtotal. That is the "not showing correct
      quantities" report. Quantity is now shown and adjustable.

   3. NO WAY TO CHANGE QUANTITY.
      There was only a remove button. Wanting two of something meant adding it
      twice and hoping. Now: − / + / remove, via cartLinesUpdate.

   4. RAPID CLICKS SILENTLY DESTROYED THE CART.
      With no cart yet, two quick adds both fell through to `cartCreate`. Two
      carts were created, the second overwrote `sb_cart`, and the first item
      vanished. Every mutation now goes through a serialised queue.

   5. A STALE CART ID SILENTLY ORPHANED EVERYTHING.
      If `cartLinesAdd` returned no cart, the code created a brand new cart
      containing only the item just added — silently discarding whatever the
      customer had already put in. It now reports the loss instead of hiding it.

   6. MONEY WAS ROUNDED TO WHOLE DIRHAMS.
      `Math.round` displayed AED 149.50 as "AED 150" — directly misleading next
      to the old "Free UAE delivery over AED 150" copy, because Shopify would
      still charge delivery. That UAE threshold was retired on 1 Sep 2026 (UAE
      is free with no minimum); the GCC AED 390 threshold still makes this
      load-bearing. Fils are shown whenever they are non-zero.

   7. EVERY ERROR WAS SWALLOWED by empty catch blocks, so a failed add looked
      identical to a successful one. Failures now surface in the drawer.
   ========================================================================== */
(function () {
  var S = { domain: 'sahra-beyond.myshopify.com', token: 'cc42ba8e74eb27c4f3c062d93f893fa0', v: '2024-10' };

  /* quantity is part of this fragment and MUST stay rendered - see bug 2 */
  var CFRAG = 'id checkoutUrl totalQuantity buyerIdentity{countryCode} cost{subtotalAmount{amount currencyCode}}' +
    'lines(first:100){edges{node{id quantity merchandise{... on ProductVariant{id title availableForSale ' +
    'price{amount currencyCode} product{title handle featuredImage{url}}}}}}}';

  function sf(q, vars) {
    return fetch('https://' + S.domain + '/api/' + S.v + '/graphql.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': S.token },
      body: JSON.stringify({ query: q, variables: vars || {} })
    }).then(function (r) {
      if (!r.ok) throw new Error('network ' + r.status);
      return r.json();
    }).then(function (j) {
      if (j.errors) throw new Error((j.errors[0] && j.errors[0].message) || 'storefront error');
      return j.data;
    });
  }

  function cid() { try { return localStorage.getItem('sb_cart'); } catch (e) { return null; } }
  function setCid(v) {
    try { v ? localStorage.setItem('sb_cart', v) : localStorage.removeItem('sb_cart'); } catch (e) {}
  }

  /* Show fils when they exist. Rounding to whole dirhams misrepresents a
     subtotal sitting either side of the AED 390 GCC free-delivery threshold.
     KWD, BHD and OMR genuinely have three decimals — two would misprice
     every line by up to 9 fils, so the map is load-bearing, not pedantry. */
  var DECIMALS = { BHD: 3, KWD: 3, OMR: 3 };
  function money(a, c) {
    var n = parseFloat(a || 0);
    var cur = c || 'AED';
    var d = DECIMALS[cur] != null ? DECIMALS[cur] : 2;
    if (d === 2 && n % 1 === 0) return cur + ' ' + n.toFixed(0);
    return cur + ' ' + n.toFixed(d);
  }

  /* Which country the cart belongs to. Presentment currency, checkout
     language and available shipping all hang off this. Default AE preserves
     the site's whole pre-international behaviour; sahra-market.js retunes it
     through the sb:market event once geo (or the customer's own currency
     choice) is known. */
  var BUYER_CC = 'AE';

  var CART = null;
  var lastError = null;
  /* line id -> quantity the customer has asked for but the server has not
     confirmed yet. Keeps rapid +/- taps accumulating correctly. */
  var pending = {};

  /* ---- serialised mutation queue -------------------------------------
     Every cart write goes through here. Two adds fired a few milliseconds
     apart used to race into two separate cartCreate calls (bug 4). */
  var chain = Promise.resolve();
  function queue(fn) {
    var run = chain.then(fn, fn);
    chain = run.catch(function () {});
    return run;
  }

  /* ---- UI ------------------------------------------------------------ */
  /* ---- the Founding Edition tote, free with every order ---------------
     A gift line is added whenever the cart holds at least one real item, and
     removed when the last one goes. Three rules this must never break:

       1. IT CANNOT BREAK A REAL ADD. Stock is finite by design, so Shopify
          WILL eventually refuse the gift. Every failure here is swallowed:
          lastError is left alone, the cart the customer built is returned
          untouched, and the gift simply stops appearing. A gift that can empty
          a basket would be worse than no gift.
       2. IT GOES THROUGH THE QUEUE. A bare extra mutation races the one that
          triggered it and destroys carts - that is bug 3 in the header above,
          and the reason this file has a queue at all.
       3. IT NEVER RECURSES. syncGift performs at most one mutation and never
          calls itself; add/setQty/refresh call it exactly once, after theirs.

     The variant is published ONLY to the headless channel, so it has no
     product page - the drawer renders it without a link. */
  var GIFT_VARIANT = 'gid://shopify/ProductVariant/47389880615100';
  var GIFT_ADD = 'mutation($id:ID!,$l:[CartLineInput!]!){cartLinesAdd(cartId:$id,lines:$l){cart{' + CFRAG + '}userErrors{message}}}';
  var GIFT_RM  = 'mutation($id:ID!,$l:[ID!]!){cartLinesRemove(cartId:$id,lineIds:$l){cart{' + CFRAG + '}userErrors{message}}}';

  function isGift(node) {
    return !!(node && node.merchandise && node.merchandise.id === GIFT_VARIANT);
  }
  function cartNodes() {
    return (CART && CART.lines && CART.lines.edges) ? CART.lines.edges.map(function (e) { return e.node; }) : [];
  }
  function giftLine() {
    var hit = null;
    cartNodes().forEach(function (n) { if (isGift(n)) hit = n; });
    return hit;
  }
  function realQty() {
    var n = 0;
    cartNodes().forEach(function (l) { if (!isGift(l)) n += (l.quantity || 0); });
    return n;
  }

  function syncGift() {
    return queue(function () {
      if (!CART || !CART.id) return CART;
      var g = giftLine(), real = realQty();
      var op = null;
      if (real > 0 && !g) op = { m: GIFT_ADD, v: { id: CART.id, l: [{ merchandiseId: GIFT_VARIANT, quantity: 1 }] }, k: 'cartLinesAdd' };
      else if (real === 0 && g) op = { m: GIFT_RM, v: { id: CART.id, l: [g.id] }, k: 'cartLinesRemove' };
      else if (g && g.quantity > 1) op = { m: GIFT_RM, v: { id: CART.id, l: [g.id] }, k: 'cartLinesRemove' };
      if (!op) return CART;
      return sf(op.m, op.v).then(function (d) {
        var r = d && d[op.k];
        /* userErrors here mean "sold out" far more often than anything else.
           Not an error the customer caused, and not one they should see. */
        if (r && r.cart && !(r.userErrors && r.userErrors.length)) { CART = r.cart; draw(); }
        return CART;
      }).catch(function () { return CART; });
    });
  }

  function ensureUI() {
    if (document.getElementById('sbDrawer')) return;

    /* ADOPT an existing cart button rather than adding a second one.
       /shop/ ships its own #cartBtn in the nav. This module also ran there and
       appended #sbCartBtn, so that page carried TWO cart buttons and TWO
       drawers over one storage key — add via one, open the other, and the cart
       looks empty while the badge shows items. Adopt, never duplicate. */
    var existing = document.getElementById('cartBtn');
    if (existing && !existing.dataset.sbBound) {
      existing.dataset.sbBound = '1';
      existing.addEventListener('click', function (e) { e.preventDefault(); open(); });
    } else if (!existing && !document.getElementById('sbCartBtn')) {
      var hdr = document.querySelector('.hdr') || document.querySelector('nav');
      if (hdr) {
        var b = document.createElement('button');
        b.id = 'sbCartBtn'; b.className = 'sb-cart-btn'; b.type = 'button';
        b.setAttribute('aria-label', 'Open cart');
        b.innerHTML = '<span aria-hidden="true">&#128722;</span>' +
          '<span class="sb-cart-count" id="sbCartCount" aria-live="polite" style="display:none">0</span>';
        hdr.appendChild(b);
        b.addEventListener('click', open);
      }
    }

    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="sb-ov" id="sbOv"></div>' +
      '<aside class="sb-drawer" id="sbDrawer" role="dialog" aria-modal="true" aria-label="Cart" aria-hidden="true">' +
        '<div class="sb-dh"><h3>Your cart</h3><button class="sb-x" id="sbX" aria-label="Close cart">&#10005;</button></div>' +
        '<div class="sb-db" id="sbBody"><p class="sb-empty">Your cart is empty.</p></div>' +
        '<div class="sb-df" id="sbFoot" hidden>' +
          '<div class="sb-sub"><span>Subtotal</span><span id="sbSub">AED 0</span></div>' +
          '<p class="sb-note">Free next-day UAE delivery, no minimum. Our fits run slim — <a href="/size-guide/" style="color:inherit;text-decoration:underline">check the chart</a>.</p>' +
          '<a class="sb-go" id="sbGo" href="#">Checkout</a>' +
        '</div>' +
      '</aside>';
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

    document.getElementById('sbX').addEventListener('click', close);
    document.getElementById('sbOv').addEventListener('click', close);
    addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      var d = document.getElementById('sbDrawer');
      if (!d || !d.classList.contains('on')) return;
      /* Real focus trap. aria-modal="true" was already on the element, which
         tells a screen reader the rest of the page is inert - it was not, so
         Tab landed the user on invisible content behind the overlay. */
      var f = d.querySelectorAll('a[href],button:not([disabled]),input,[tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    /* One delegated listener on the drawer body. The old code re-bound a
       listener per button on every draw, which leaked handlers each redraw. */
    document.getElementById('sbBody').addEventListener('click', function (e) {
      var el = e.target.closest && e.target.closest('[data-act]');
      if (!el) return;
      var line = el.getAttribute('data-line');
      var act = el.getAttribute('data-act');
      if (act === 'rm') { pending[line] = 0; setQty(line, 0); return; }
      /* Read from `pending`, not from the DOM. data-qty is only refreshed when
         draw() re-renders after a mutation resolves, so three quick taps on +
         all read the same stale 1 and each asked the server for 2 — the
         customer tapped three times and got two. Intent accumulates here. */
      var base = (pending[line] != null) ? pending[line] : +el.getAttribute('data-qty');
      var next = act === 'inc' ? base + 1 : base - 1;
      if (next < 0) next = 0;
      pending[line] = next;
      setQty(line, next);
    });
  }

  var lastFocus = null;
  function open() {
    ensureUI();
    lastFocus = document.activeElement;
    document.getElementById('sbDrawer').classList.add('on');
    document.getElementById('sbOv').classList.add('on');
    document.getElementById('sbDrawer').setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    var mainEl = document.querySelector('main'); if (mainEl) mainEl.setAttribute('aria-hidden','true');
    /* Bug 1: the drawer must be painted from current state every time it is
       opened, not only after an add. */
    draw();
    var x = document.getElementById('sbX'); if (x) x.focus();
  }
  function close() {
    var d = document.getElementById('sbDrawer');
    if (!d) return;
    d.classList.remove('on');
    d.setAttribute('aria-hidden', 'true');
    document.getElementById('sbOv').classList.remove('on');
    document.body.style.overflow = '';
    var mEl = document.querySelector('main'); if (mEl) mEl.removeAttribute('aria-hidden');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* Update EVERY count element on the page. A page may carry its own #cartCount
     (as /shop/ does) as well as ours; if only one is updated the other keeps a
     stale number, which is precisely the phantom badge customers reported. */
  function badge(n) {
    var els = [document.getElementById('sbCartCount'), document.getElementById('cartCount')];
    els.forEach(function (c) {
      if (!c) return;
      c.textContent = n || 0;
      c.style.display = n ? 'flex' : 'none';
    });
    [document.getElementById('sbCartBtn'), document.getElementById('cartBtn')].forEach(function (btn) {
      if (btn) btn.setAttribute('aria-label', n ? 'Open cart, ' + n + ' item' + (n === 1 ? '' : 's') : 'Open cart');
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function draw() {
    ensureUI();
    var body = document.getElementById('sbBody'), foot = document.getElementById('sbFoot');
    if (!body || !foot) return;

    var lines = (CART && CART.lines && CART.lines.edges)
      ? CART.lines.edges.map(function (e) { return e.node; }) : [];

    /* the gift is not something the customer chose - it must not inflate
       the badge, or "2" shirts would read as 3 */
    badge(CART ? realQty() : 0);

    var err = lastError
      ? '<p class="sb-err" role="alert">' + esc(lastError) + '</p>' : '';

    if (!lines.length) {
      body.innerHTML = err + '<p class="sb-empty">Your cart is empty.</p>';
      foot.hidden = true;
      return;
    }

    body.innerHTML = err + lines.map(function (l) {
      var m = l.merchandise;
      var img = (m.product && m.product.featuredImage) ? m.product.featuredImage.url : '';
      var q = l.quantity;
      /* The gift has no product page (headless-only), so no link; and no
         quantity or remove controls - it is not the customer's to manage. */
      if (isGift(l)) {
        return '<div class="sb-line sb-gift">' +
          (img ? '<img src="' + esc(img) + '" alt="" width="60" height="75" loading="lazy">'
               : '<span class="sb-noimg"></span>') +
          '<div class="sb-lt">' +
            '<span class="sb-gift-t">Sahra tote &mdash; yours free</span>' +
            '<span>' + money(0, (CART && CART.cost && CART.cost.subtotalAmount && CART.cost.subtotalAmount.currencyCode) || 'AED') + '</span>' +
          '</div>' +
        '</div>';
      }
      return '<div class="sb-line">' +
        (img ? '<img src="' + esc(img) + '" alt="" width="60" height="75" loading="lazy">'
             : '<span class="sb-noimg"></span>') +
        '<div class="sb-lt">' +
          '<a href="/products/' + esc(m.product.handle) + '/">' + esc(m.product.title) + '</a>' +
          '<span>Size ' + esc(m.title) + '</span>' +
          '<span>' + money(m.price.amount, m.price.currencyCode) + '</span>' +
          /* Bug 2 + 3: quantity is visible AND adjustable */
          '<span class="sb-qty">' +
            '<button type="button" class="sb-q" data-act="dec" data-line="' + esc(l.id) + '" data-qty="' + q + '" aria-label="Decrease quantity">&minus;</button>' +
            '<span class="sb-qn" aria-label="Quantity">' + q + '</span>' +
            '<button type="button" class="sb-q" data-act="inc" data-line="' + esc(l.id) + '" data-qty="' + q + '" aria-label="Increase quantity">+</button>' +
          '</span>' +
        '</div>' +
        '<button class="sb-rm" data-act="rm" data-line="' + esc(l.id) + '" aria-label="Remove ' + esc(m.product.title) + '">&#10005;</button>' +
      '</div>';
    }).join('');

    document.getElementById('sbSub').textContent =
      money(CART.cost.subtotalAmount.amount, CART.cost.subtotalAmount.currencyCode);
    document.getElementById('sbGo').href = CART.checkoutUrl;

    /* Meta InitiateCheckout — fires on the click through to Shopify checkout.
       Purchase itself is tracked on the Shopify side by the Meta sales channel,
       because this site never sees the thank-you page. */
    var _go = document.getElementById('sbGo');
    if (_go && !_go.__sbMetaBound) {
      _go.__sbMetaBound = 1;
      _go.addEventListener('click', function () {
        try {
          if (!window.sbMeta || !CART || !CART.cost) return;
          var nodes = (CART.lines && CART.lines.edges || []).map(function (e) { return e.node; });
          var ids = nodes.map(function (l) {
            return (l && l.merchandise && l.merchandise.id) || '';
          }).filter(Boolean);
          window.sbMeta('InitiateCheckout', {
            value: Number(CART.cost.subtotalAmount.amount) || 0,
            currency: CART.cost.subtotalAmount.currencyCode || 'AED',
            num_items: CART.totalQuantity || nodes.length,
            content_type: 'product',
            content_ids: ids
          });
        } catch (e) {}
      });
    }
    /* Free-delivery progress (Rastah benchmark, 29 Aug 2026). Honest maths
       only: the one remaining threshold is defined in AED (390 GCC — UAE is now
       free with no minimum), so the meter renders ONLY when the cart itself is
       priced in AED; converting a threshold into SAR client-side would drift
       from what checkout actually charges. Non-AED and worldwide carts see no
       meter rather than a wrong one. */
    (function () {
      var el = document.getElementById('sbFree');
      if (!el) {
        el = document.createElement('div');
        el.id = 'sbFree'; el.className = 'sb-free';
        var sub = document.querySelector('#sbFoot .sb-sub');
        if (sub && sub.parentNode) sub.parentNode.insertBefore(el, sub.nextSibling);
      }
      var mkt = (window.SahraMarket && window.SahraMarket.market) ? window.SahraMarket.market() : 'uae';
      var cost = CART.cost.subtotalAmount;
      if (cost.currencyCode !== 'AED' || mkt === 'intl') { el.hidden = true; return; }
      /* UAE next-day delivery is free on every order with no minimum (1 Sep 2026).
         There is no threshold left to progress toward, so state the fact instead
         of rendering a meter that is always full. GCC keeps its AED 390 meter. */
      if (mkt !== 'gcc') {
        el.hidden = false;
        el.innerHTML = '<span class="sb-free-t sb-free-ok">\u2713 Free next-day delivery</span>' +
          '<span class="sb-free-bar"><span style="width:100%"></span></span>';
        return;
      }
      var th = 390;
      var n = parseFloat(cost.amount || 0);
      el.hidden = false;
      if (n >= th) {
        el.innerHTML = '<span class="sb-free-t sb-free-ok">\u2713 Free delivery unlocked</span><span class="sb-free-bar"><span style="width:100%"></span></span>';
      } else {
        var left = th - n;
        var leftTxt = (left % 1 === 0) ? left.toFixed(0) : left.toFixed(2);
        el.innerHTML = '<span class="sb-free-t">AED ' + leftTxt + ' away from free delivery</span>' +
          '<span class="sb-free-bar"><span style="width:' + Math.max(6, Math.round(n / th * 100)) + '%"></span></span>';
      }
    })();
    foot.hidden = false;
  }

  /* ---- mutations ------------------------------------------------------ */

  /* qty 0 removes the line. One code path for -, + and x. */
  function setQty(lineId, qty) {
    if (!CART || !lineId) return Promise.resolve(null);
    return queue(function () {
      lastError = null;
      var q = Math.max(0, qty | 0);
      var op = q === 0
        ? { m: 'mutation($id:ID!,$l:[ID!]!){cartLinesRemove(cartId:$id,lineIds:$l){cart{' + CFRAG + '}userErrors{message}}}',
            v: { id: CART.id, l: [lineId] }, k: 'cartLinesRemove' }
        : { m: 'mutation($id:ID!,$l:[CartLineUpdateInput!]!){cartLinesUpdate(cartId:$id,lines:$l){cart{' + CFRAG + '}userErrors{message}}}',
            v: { id: CART.id, l: [{ id: lineId, quantity: q }] }, k: 'cartLinesUpdate' };
      return sf(op.m, op.v).then(function (d) {
        var r = d[op.k];
        if (r && r.userErrors && r.userErrors.length) throw new Error(r.userErrors[0].message);
        if (!r || !r.cart) throw new Error('That cart is no longer available.');
        CART = r.cart;
        /* server has spoken - drop any pending intent it has now satisfied */
        (CART.lines && CART.lines.edges || []).forEach(function (e) {
          if (pending[e.node.id] === e.node.quantity) delete pending[e.node.id];
        });
        if (q === 0) delete pending[lineId];
        draw();
        return CART;
      }).catch(function (e) {
        lastError = 'We could not update your cart. ' + (e.message || '') ;
        draw();
        throw e;
      });
    });
  }

  function add(variantId, qty) {
    ensureUI();
    var want = Math.max(1, (qty | 0) || 1);

    /* Meta AddToCart. On a product page __SB_PRODUCT carries the real sku and
       price, read from the page's Product JSON-LD by /assets/meta-pixel.js.
       Elsewhere (the shop grid) we still send the variant id so the event is
       never lost, just without a value. */
    try {
      if (window.sbMeta) {
        var _p = window.__SB_PRODUCT || {};
        var _id = _p.sku || variantId;
        window.sbMeta('AddToCart', {
          content_type: 'product',
          content_ids: [_id],
          content_name: _p.name,
          contents: [{ id: _id, quantity: want }],
          value: _p.price ? Number(_p.price) * want : undefined,
          currency: _p.currency || 'AED'
        });
      }
    } catch (e) {}
    return queue(function () {
      lastError = null;
      /* In-memory id wins over storage. If localStorage is unavailable —
         Safari private mode throws on setItem, and the throw is swallowed —
         the id never persists, so reading storage alone made every subsequent
         add believe there was no cart and start a fresh one, discarding
         everything already in it. */
      var id = (CART && CART.id) || cid();
      var addToExisting = id
        ? sf('mutation($id:ID!,$l:[CartLineInput!]!){cartLinesAdd(cartId:$id,lines:$l){cart{' + CFRAG + '}userErrors{message}}}',
             { id: id, l: [{ merchandiseId: variantId, quantity: want }] })
            .then(function (d) {
              var r = d.cartLinesAdd;
              /* A userError is Shopify refusing this line — sold out, or more
                 than stock allows. It is NOT a dead cart, and must never be
                 treated as one. */
              if (r && r.userErrors && r.userErrors.length) {
                var ue = new Error(r.userErrors[0].message); ue.userError = true; throw ue;
              }
              if (!r || !r.cart) throw new Error('STALE');
              return r.cart;
            })
        : Promise.reject(new Error('NOCART'));

      return addToExisting.catch(function (e) {
        /* ONLY start a new cart when there genuinely is none, or the server
           says the old one is gone.

           This previously ran for EVERY failure. A sold-out variant, a 429, or
           a dropped connection would clear sb_cart and create a fresh cart
           holding just the item being added — silently destroying a basket the
           customer had been filling, and resolving successfully so nothing was
           shown. Preserve the cart on any other error. */
        if (e.message !== 'STALE' && e.message !== 'NOCART') throw e;
        if (e.message === 'STALE' && CART && CART.totalQuantity) {
          lastError = 'Your previous cart expired, so we started a new one. Please check the items below.';
        }
        CART = null;
        setCid(null);
        return sf('mutation($l:[CartLineInput!]!,$cc:CountryCode!){cartCreate(input:{lines:$l,buyerIdentity:{countryCode:$cc}}){cart{' + CFRAG + '}userErrors{message}}}',
                  /* read at send time, inside the queue — a country change
                     that already happened should win, and one still queued
                     behind us will re-point the cart when its turn comes */
                  { l: [{ merchandiseId: variantId, quantity: want }], cc: BUYER_CC })
          .then(function (d) {
            var r = d.cartCreate;
            if (r && r.userErrors && r.userErrors.length) throw new Error(r.userErrors[0].message);
            if (!r || !r.cart) throw new Error('Could not start a cart.');
            return r.cart;
          });
      }).then(function (c) {
        CART = c; setCid(c.id); pending = {}; draw(); open();
        return c;
      }).catch(function (e) {
        /* Shopify's own wording is more useful than ours when it is telling
           the customer something specific, like "only 2 left". */
        lastError = e && e.userError
          ? e.message
          : 'We could not add that to your cart. Please try again, or message us on WhatsApp.';
        draw(); open();
        throw e;
      });
    });
  }

  function refresh() {
    var id = cid();
    if (!id) { CART = null; badge(0); draw(); return Promise.resolve(null); }
    return sf('query($id:ID!){cart(id:$id){' + CFRAG + '}}', { id: id })
      .then(function (d) {
        CART = d.cart;
        /* Shopify returns null once a cart is completed or expired. Clearing
           the id here is what stops a phantom badge after checkout. */
        if (!CART) setCid(null);
        /* BUG 8 — THE GBP CHECKOUT IN DUBAI. The cart Shopify holds is days
           old and remembers its buyerIdentity (say GB, from a currency
           experiment). Every fresh page boots BUYER_CC='AE', so when the
           market layer says "AE" the dedupe guard answered "already AE" and
           never re-pointed the cart — homepage in AED, checkout in GBP,
           permanently. The in-memory default is an assumption; the fetched
           cart is the truth. Sync from it, then reconcile with whatever the
           market layer currently wants. Both boot orders are covered: if the
           market spoke first (and was wrongly deduped), this reconciles; if
           it speaks later, BUYER_CC is now truthful so its event passes the
           guard. */
        if (CART && CART.buyerIdentity && /^[A-Z]{2}$/.test(CART.buyerIdentity.countryCode || '')) {
          BUYER_CC = CART.buyerIdentity.countryCode;
        }
        if (window.SahraMarket && window.SahraMarket.buyerCountry) {
          var want = window.SahraMarket.buyerCountry();
          if (/^[A-Z]{2}$/.test(want || '') && want !== BUYER_CC) setCountry(want);
        }
        badge(CART ? CART.totalQuantity : 0);
        draw();                      /* bug 1 */
        return CART;
      })
      .catch(function () {
        /* Network failure: do NOT leave a stale number on screen. */
        badge(CART ? CART.totalQuantity : 0);
        return null;
      });
  }

  function variants(handle) {
    return sf('query($h:String!){product(handle:$h){variants(first:20){edges{node{id title availableForSale}}}}}', { h: handle })
      .then(function (d) { return d.product ? d.product.variants.edges.map(function (e) { return e.node; }) : []; });
  }

  /* ---- market / currency bridge --------------------------------------
     sahra-market.js announces the customer's market on load and whenever
     they pick a currency. Re-pointing an EXISTING cart's buyerIdentity makes
     Shopify re-price every line in the new presentment currency, so the
     drawer, the page prices and checkout can never tell three stories.
     Queued like every other mutation — a currency flip racing an add was
     exactly the class of bug the queue exists to prevent. */
  function setCountry(cc) {
    if (!/^[A-Z]{2}$/.test(cc || '') || cc === BUYER_CC) return Promise.resolve();
    BUYER_CC = cc;
    /* `cc` (the parameter), not BUYER_CC, inside the queued closure. The
       closure runs at DEQUEUE time, and by then a later setCountry may have
       overwritten the shared variable — review traced SA→US→SA flips all
       shipping the final value. Capturing the argument keeps each queued
       mutation meaning what it meant when the customer asked for it. */
    return queue(function () {
      if (BUYER_CC !== cc) return CART; // superseded while queued — skip the round trip
      var id = (CART && CART.id) || cid();
      if (!id) return null; // no cart yet — cartCreate will carry the country
      return sf('mutation($id:ID!,$b:CartBuyerIdentityInput!){cartBuyerIdentityUpdate(cartId:$id,buyerIdentity:$b){cart{' + CFRAG + '}userErrors{message}}}',
                { id: id, b: { countryCode: cc } })
        .then(function (d) {
          var r = d.cartBuyerIdentityUpdate;
          if (r && r.cart) { CART = r.cart; draw(); }
          /* userErrors here mean the market is not enabled for that country —
             the cart simply stays in its current currency. Not an error the
             customer can act on, so nothing is shown. */
          return CART;
        }).catch(function (e) {
          /* A NETWORK failure is different from a userError: the selector has
             visibly changed and the page repainted, so a silently unswitched
             cart would contradict everything around it. Say so. (This file
             already paid once for swallowing errors — bug 7.) */
          lastError = 'We could not switch your cart’s currency. Your cart is unchanged — please try again.';
          draw();
          return CART;
        });
    });
  }
  document.addEventListener('sb:market', function (e) {
    if (e.detail && e.detail.country) setCountry(e.detail.country);
  });

  /* The WA bubble already steps aside for the cart drawer and the sticky buy
     bar; the mobile nav overlay was the third floating layer nobody told it
     about, so it sat on top of the open menu. Watch the panel's class. */
  try {
    new MutationObserver(function () {
      var open = document.querySelector('.m-panel.open');
      var wa = document.querySelector('.sb-wa');
      if (wa) wa.classList.toggle('away', !!open);
    }).observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['class'] });
  } catch (e) {}

  /* Gift reconciliation hangs off the PUBLIC entry points, not off add() and
     setQty() internally: those two have several success paths each, and
     wrapping once here means there is exactly one place where the gift can be
     forgotten. On failure the gift is not touched at all - a rejected add must
     stay rejected and unchanged. */
  function withGift(fn) {
    return function () {
      return fn.apply(null, arguments).then(function (c) {
        return syncGift().then(function () { return CART || c; });
      });
    };
  }
  var addWithGift = withGift(add);
  var setQtyWithGift = withGift(setQty);

  window.SahraCart = {
    add: addWithGift, open: open, close: close, variants: variants,
    refresh: function () { return refresh().then(function (c) {
      /* a cart built before the gift existed, or one whose gift was dropped
         server-side, is reconciled on the next page load */
      return syncGift().then(function () { return CART || c; });
    }); },
    setQty: setQtyWithGift, remove: function (l) { return setQtyWithGift(l, 0); },
    setCountry: setCountry,
    state: function () { return CART; }
  };

  function boot() { ensureUI(); refresh(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* Coming back from Shopify checkout, or from another tab, must not leave a
     stale count on screen. */
  addEventListener('pageshow', function (e) { if (e.persisted) refresh(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
  addEventListener('storage', function (e) { if (e.key === 'sb_cart') refresh(); });
})();

/* ==========================================================================
   Quick-add on product cards (category pages and homepage).
   ========================================================================== */
(function () {
  function init() {
    var cards = document.querySelectorAll('.pcard[data-handle], .card[data-handle]');
    if (!cards.length) return;
    cards.forEach(function (card) {
      if (card.querySelector('.qa')) return;              /* never double-bind */
      var handle = card.dataset.handle;
      var foot = card.querySelector('.pcard-foot') || card;
      var box = document.createElement('div');
      box.className = 'qa';
      box.innerHTML = '<button class="qa-open" type="button">Quick add</button><div class="qa-sizes" hidden></div>';
      foot.appendChild(box);
      var openBtn = box.querySelector('.qa-open'), sizes = box.querySelector('.qa-sizes'), loaded = false;
      openBtn.addEventListener('click', function () {
        if (loaded) { sizes.hidden = !sizes.hidden; return; }
        openBtn.textContent = 'Loading…';
        window.SahraCart.variants(handle).then(function (vs) {
          loaded = true; openBtn.textContent = 'Quick add';
          if (!vs.length) { sizes.innerHTML = '<a href="/products/' + handle + '/">View product</a>'; sizes.hidden = false; return; }
          sizes.innerHTML = '';
          vs.forEach(function (v) {
            var b = document.createElement('button');
            b.type = 'button'; b.className = 'qa-sz'; b.textContent = v.title;
            if (!v.availableForSale) { b.disabled = true; b.title = 'Sold out'; }
            b.addEventListener('click', function () {
              if (b.disabled) return;
              b.disabled = true; b.textContent = '…';
              window.SahraCart.add(v.id)
                .then(function () { b.textContent = v.title; b.disabled = false; })
                .catch(function () { b.textContent = v.title; b.disabled = false; });
            });
            sizes.appendChild(b);
          });
          sizes.hidden = false;
        }).catch(function () { openBtn.textContent = 'Quick add'; });
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* ==========================================================================
   Floating WhatsApp contact — every page, without getting in the way.
   ==========================================================================
   No third-party widget script (they cost 100kb+ and phone home), no auto-
   opening bubble, nothing for the visitor to dismiss. It moves out of the way
   of the two things that share the bottom of the screen: the PDP buy bar and
   the cart drawer.

   The prefilled message carries the page title, so a question about a product
   arrives with the product already named instead of "hi".
   ========================================================================== */
(function () {
  var NUM = '971585449946';
  if (document.getElementById('sbWa')) return;

  function build() {
    if (document.getElementById('sbWa')) return;
    var a = document.createElement('a');
    a.id = 'sbWa'; a.className = 'sb-wa';
    a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', 'Message Sahra & Beyond on WhatsApp');
    a.title = 'Message us on WhatsApp';

    var where = (document.title || '').split('|')[0].split('—')[0].trim();
    var msg = where ? 'Hi Sahra & Beyond — a question about ' + where + ':'
                    : 'Hi Sahra & Beyond —';
    a.href = 'https://wa.me/' + NUM + '?text=' + encodeURIComponent(msg);

    a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15s-.77.96-.94 1.16c-.17.2-.35.22-.65.07a8.2 8.2 0 0 1-2.4-1.48 9 9 0 0 1-1.66-2.07c-.17-.3 0-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.42-.08-.13-.28-.2-.58-.35z"/>' +
      '<path d="M12.04 2A9.9 9.9 0 0 0 2.1 11.9c0 1.75.46 3.46 1.33 4.97L2 22l5.28-1.38a9.9 9.9 0 0 0 4.76 1.21h.01A9.9 9.9 0 0 0 22 11.94 9.9 9.9 0 0 0 12.04 2zm0 18.1a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.13.82.84-3.05-.2-.31a8.2 8.2 0 0 1-1.26-4.38 8.24 8.24 0 0 1 14.07-5.83 8.2 8.2 0 0 1 2.42 5.84 8.24 8.24 0 0 1-8.25 8.24z"/>' +
      '</svg>';
    document.body.appendChild(a);

    /* Lift clear of the PDP sticky buy bar rather than covering its CTA. */
    var bar = document.getElementById('buybar');
    if (bar && window.MutationObserver) {
      var syncBar = function () { a.classList.toggle('lift', bar.classList.contains('on')); };
      new MutationObserver(syncBar).observe(bar, { attributes: true, attributeFilter: ['class'] });
      syncBar();
    }

    /* Step aside while the cart drawer is open - it is a modal. */
    var drawer = document.getElementById('sbDrawer');
    if (drawer && window.MutationObserver) {
      var syncDrawer = function () { a.classList.toggle('away', drawer.classList.contains('on')); };
      new MutationObserver(syncDrawer).observe(drawer, { attributes: true, attributeFilter: ['class'] });
      syncDrawer();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
