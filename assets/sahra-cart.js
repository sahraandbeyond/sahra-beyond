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
      to "Free UAE delivery over AED 150", because Shopify would still charge
      delivery. Fils are shown whenever they are non-zero.

   7. EVERY ERROR WAS SWALLOWED by empty catch blocks, so a failed add looked
      identical to a successful one. Failures now surface in the drawer.
   ========================================================================== */
(function () {
  var S = { domain: 'sahra-beyond.myshopify.com', token: 'cc42ba8e74eb27c4f3c062d93f893fa0', v: '2024-10' };

  /* quantity is part of this fragment and MUST stay rendered - see bug 2 */
  var CFRAG = 'id checkoutUrl totalQuantity cost{subtotalAmount{amount currencyCode}}' +
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
     subtotal sitting either side of the AED 150 free-delivery threshold. */
  function money(a, c) {
    var n = parseFloat(a || 0);
    var cur = c || 'AED';
    return cur + ' ' + (n % 1 === 0 ? n.toFixed(0) : n.toFixed(2));
  }

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
          '<p class="sb-note">Free UAE delivery over AED 150. Taxes and shipping shown at checkout.</p>' +
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

    badge(CART ? CART.totalQuantity : 0);

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
        return sf('mutation($l:[CartLineInput!]!){cartCreate(input:{lines:$l}){cart{' + CFRAG + '}userErrors{message}}}',
                  { l: [{ merchandiseId: variantId, quantity: want }] })
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

  window.SahraCart = {
    add: add, open: open, close: close, refresh: refresh, variants: variants,
    setQty: setQty, remove: function (l) { return setQty(l, 0); },
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
