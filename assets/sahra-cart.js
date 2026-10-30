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
  /* 22 Oct 2026: Sahel and Sahra Trail pre-order pieces. Their bag image is the site's own image (27 Oct: the real Sahel
     photos; the hoodies show the 4:5 front so the small square crop never cuts the back print; Trail still mock-ups)
     (Shopify holds no images for them yet). A pre-order line says when it ships, shows the pre-order price
     without a struck-through list price, and never shows a remaining count (no scarcity wording). */
  var PRE = { 'khor-fakkan-bay-tee-regular': 'ph-kfb-01-back', 'khor-fakkan-bay-tee-oversized': 'ph-kfb-01-back', 'al-hamra-pearl-diver-tee-regular': 'ph2-pearl-01-back', 'al-hamra-pearl-diver-tee-oversized': 'ph2-pearl-01-back',
    'al-aqah-reef-tee-regular': 'ph-reef-01-back', 'al-aqah-reef-tee-oversized': 'ph-reef-01-back', 'shams-tee-regular': 'ph-shams-01-front', 'shams-tee-oversized': 'ph-shams-01-front', 'the-sahel-polo': '',
    'barr-and-bahr-hoodie': 'ph-barr-04-front', 'ras-al-khor-hoodie': 'ph-rakh-06-front', 'sahra-trail-tee': 'trail-tee-front', 'sahra-trail-2-in-1-short': 'trail-short-front', 'sahra-trail-kit': 'trail-kit-front' };
  var PRE_IN_HAND = true;   /* 30 Oct 2026 (Faheem: "In stock, ships next day"). Was:  set true (with IN_HAND in preorder-page.js) once Faheem confirms the pieces are in hand */
  function isPre(l) { var h = l && l.merchandise && l.merchandise.product && l.merchandise.product.handle; return !!h && Object.prototype.hasOwnProperty.call(PRE, h); }
  var CART_REAL = { 'al-quaa-galaxy-regular': '/shirts/alquaa-dune-back.webp', 'al-quaa-galaxy-oversized': '/shirts/alquaa-model-back.webp', 'empty-quarter-regular': '/shirts/emptyquarter-dune-front.webp', 'empty-quarter-oversized': '/shirts/emptyquarter-model-stand.webp', 'hajar-mountains-regular': '/shirts/hajar-dune-back.webp', 'hajar-mountains-oversized': '/shirts/hajar-lake-back-her.webp', 'sand-polo': '/shirts/polo-dune-front.webp', 'trailhead-bag': '/assets/preorder/trail-bag-front-720.webp' };
  var S = { domain: 'sahra-beyond.myshopify.com', token: 'cc42ba8e74eb27c4f3c062d93f893fa0', v: '2024-10' };

  /* quantity is part of this fragment and MUST stay rendered - see bug 2 */
  var CFRAG = 'id checkoutUrl totalQuantity buyerIdentity{countryCode} cost{subtotalAmount{amount currencyCode}}' +
    'lines(first:100){edges{node{id quantity cost{totalAmount{amount currencyCode} subtotalAmount{amount currencyCode}} ' +
    'discountAllocations{discountedAmount{amount currencyCode} ... on CartAutomaticDiscountAllocation{title}} ' +
    'merchandise{... on ProductVariant{id title availableForSale quantityAvailable ' +
    'price{amount currencyCode} product{title handle productType featuredImage{url}}}}}}}';

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
  /* 23 Sep 2026 — "Any 2 tees for AED 359" is a Shopify AUTOMATIC discount
     (AED 19.50 off each tee once the bag holds 2+). The drawer used to print the
     list price per line, so a customer saw AED 199 + AED 199 above a subtotal of
     AED 359 and could not tell why. The line now shows the discounted unit
     price with the list price struck through, read straight from Shopify's own
     line cost - never computed here, so it can't drift from checkout. */
  function lineSaving(l) {
    try {
      var t = parseFloat(l.cost.totalAmount.amount), st = parseFloat(l.cost.subtotalAmount.amount);
      return st - t > 0.004 ? st - t : 0;
    } catch (e) { return 0; }
  }
  function linePrice(l) {
    var m = l.merchandise, off = lineSaving(l);
    if (!off) return '<span>' + money(m.price.amount, m.price.currencyCode) + '</span>';
    /* the pre-order 20%: the price paid, named, with no struck-through list price (Faheem, 22 Oct 2026) */
    if (isPre(l)) return '<span class="sb-lp"><b>' + money(parseFloat(l.cost.totalAmount.amount) / (l.quantity || 1), l.cost.totalAmount.currencyCode) + '</b> <small>' + T('prePrice') + '</small></span>';
    var unit = parseFloat(l.cost.totalAmount.amount) / (l.quantity || 1);
    /* 25 Oct 2026 (retention audit): the pair price, named like the pre-order price, with no struck-through
       list price (brand rule: no strike-through prices) */
    var pair = (l.discountAllocations || []).some(function (a) { return /2 tees|359|pair/i.test(a.title || ''); });
    return '<span class="sb-lp"><b>' + money(unit, l.cost.totalAmount.currencyCode) + '</b> <small>' + (pair ? T('pairPrice') : T('afterDiscount')) + '</small></span>';
  }
  /* the six tees, for the second-tee card (handles, names and card images are stable) */
  var TEES = [
    { h: 'al-quaa-galaxy-regular', name: 'Al Quaa Galaxy', fit: 'regular', img: '/shirts/card/alquaa-dune-back.webp' },
    { h: 'empty-quarter-regular', name: 'Empty Quarter', fit: 'regular', img: '/shirts/card/emptyquarter-dune-front.webp' },
    { h: 'hajar-mountains-regular', name: 'Hajar Mountains', fit: 'regular', img: '/shirts/card/hajar-dune-back.webp' },
    { h: 'al-quaa-galaxy-oversized', name: 'Al Quaa Galaxy', fit: 'oversized', img: '/shirts/card/alquaa-model-back.webp' },
    { h: 'empty-quarter-oversized', name: 'Empty Quarter', fit: 'oversized', img: '/shirts/card/emptyquarter-model-stand.webp' },
    { h: 'hajar-mountains-oversized', name: 'Hajar Mountains', fit: 'oversized', img: '/shirts/card/hajar-lake-back-her.webp' }
  ];
  /* 4 Oct 2026 (CRO panel, idea 9): the delivery promise as a real clock. Rule from
     Faheem (4 Oct): orders by 2 pm Dubai time Monday to Saturday go out the same day
     and arrive the next day; Sunday orders, and orders after 2 pm Saturday, arrive
     Tuesday. HOLIDAYS are dates with no dispatch; keep the list current. UAE only
     (the span is market-gated). If anything fails the static promise stays. */
  var HOLIDAYS = ['2026-12-01', '2026-12-02', '2026-12-03', '2027-01-01'];
  function dubaiNow() {
    var f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short', hour12: false }).formatToParts(new Date());
    var g = function (k) { var x = f.filter(function (p) { return p.type === k; })[0]; return x ? x.value : ''; };
    return { y: +g('year'), m: +g('month'), d: +g('day'), h: +g('hour') % 24, mi: +g('minute'), wd: g('weekday') };
  }
  function ymd(dt) { return dt.getUTCFullYear() + '-' + ('0' + (dt.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + dt.getUTCDate()).slice(-2); }
  function dispatchDay(dt) { var wd = dt.getUTCDay(); return wd !== 0 && HOLIDAYS.indexOf(ymd(dt)) < 0; }
  function clockText() {
    try {
      var n = dubaiNow(); if (!n.y) return '';
      var today = new Date(Date.UTC(n.y, n.m - 1, n.d));
      var before = (n.h < 14) && dispatchDay(today);
      var ship = new Date(today.getTime()); if (!before) ship.setUTCDate(ship.getUTCDate() + 1);
      var guard = 0; while (!dispatchDay(ship) && guard++ < 10) ship.setUTCDate(ship.getUTCDate() + 1);
      var arrive = new Date(ship.getTime()); arrive.setUTCDate(arrive.getUTCDate() + 1);
      guard = 0; while (HOLIDAYS.indexOf(ymd(arrive)) >= 0 && guard++ < 10) arrive.setUTCDate(arrive.getUTCDate() + 1);
      var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      var when = DAYS[arrive.getUTCDay()] + ' ' + arrive.getUTCDate() + ' ' + MONS[arrive.getUTCMonth()];
      var tomorrow = (arrive.getTime() - today.getTime()) === 864e5;
      if (before) { var mins = (14 * 60) - (n.h * 60 + n.mi), hh = Math.floor(mins / 60), mm = mins % 60;
        return 'Order in ' + (hh ? hh + 'h ' : '') + mm + 'm for free delivery ' + (tomorrow ? 'tomorrow' : 'on ' + when) + (tomorrow ? ' (' + when + ')' : ''); }
      return 'Order now for free delivery ' + (tomorrow ? 'tomorrow (' + when + ')' : 'on ' + when);
    } catch (e) { return ''; }
  }
  /* 23 Oct 2026 (Faheem: "Make it static"): no ticking "Order in 3h 12m" anywhere, under the no-timer
     rule of 22 Oct. The [data-sb-clock] spans keep their static text ("Free next-day UAE delivery —
     order by 2 pm"). clockText() stays for reference; set CLOCK_LIVE = true only on Faheem's say-so. */
  var CLOCK_LIVE = false;
  function tickClocks() {
    if (!CLOCK_LIVE) return;
    var t = clockText(); if (!t) return;
    [].forEach.call(document.querySelectorAll('[data-sb-clock]'), function (e) { if (e.textContent !== t) e.textContent = t; });
  }
  /* 22 Oct 2026: "Any 2 tees for AED 359" covers the six Founding Edition tees only (the Shopify discount's own
     product list). Sahel tees share the T-Shirt product type, so the type is no longer enough. */
  function isTee(l) {
    var h = l && l.merchandise && l.merchandise.product && l.merchandise.product.handle;
    return !!h && TEES.some(function (t) { return t.h === h; });
  }
  function money(a, c) {
    /* Arabic pages: "199 درهم", through the market layer's own formatter (30 Oct 2026) */
    try { if (AR && window.SahraMarket && window.SahraMarket.fmt) return window.SahraMarket.fmt(a, c || 'AED'); } catch (e) {}
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
  /* 29 Oct 2026 (site speed handover: Checkout took 7-15 s on a phone). The attribution attributes
     (sahra-measure.js sbAttr: source, campaign, landing) used to be written on the tap on Checkout, and the
     tap waited for that write - about 0.8 s for every ad visitor, up to 1.5 s. They now travel inside
     cartCreate, and ATTR_OK remembers which cart already carries which set, so the tap goes straight to
     Shopify unless something has changed since. */
  var ATTR_OK = '', CREATE_ATTR = [];
  try { ATTR_OK = sessionStorage.getItem('sb_attr_ok') || ''; } catch (e) {}
  function attrOk(v) { ATTR_OK = v; try { sessionStorage.setItem('sb_attr_ok', v); } catch (e) {} }
  function attrNow() { try { return window.sbAttr ? window.sbAttr() : []; } catch (e) { return []; } }
  function attrKey(cid, a) { return (cid || '') + '|' + JSON.stringify(a || []); }
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
  /* Reconciliation wraps the INTERNAL functions, not the public API. The
     drawer's own delegated click handler calls setQty directly for the x and
     the -/+ buttons, so wrapping window.SahraCart alone left the commonest
     path - a customer emptying their cart - with no reconcile at all, and the
     tote sat there on its own with checkout live (Faheem, 1 Sep). Wrap where
     the work happens, not where the callers happen to be.
     syncGift() is chained OUTSIDE the queued closure: calling queue() from
     inside a queued function and awaiting it would deadlock the chain. */
  function afterMutation(c) {
    return syncGift().then(function () { return CART || c; });
  }
  /* opts.gift === false: this item does not earn the free tote (it IS a tote).
     Only affects the empty-cart path, which has to decide before a cart exists;
     syncGift() is still the authority on every cart that already has lines. */
  /* 30 Oct 2026 (Fold and Drop): an add from a page folds the photo it came from (opts.from, or the photo
     nearest the tap) into the bag icon while Shopify answers, then the peek rises. An add made inside the open
     bag (Undo, the second tee) just redraws it; opts.open === false adds silently (Buy now). */
  function add(variantId, qty, opts) {
    opts = opts || {};
    var foldP = null;
    if (opts.open !== false && !isOpen()) { try { foldP = fold(opts.from || guessSrc() || mainImg(), opts.at || (lastTap && lastTap.closest && lastTap.closest('button,a'))); } catch (e) { foldP = null; } }
    return addRaw(variantId, qty, opts).then(afterMutation).then(function (c) {
      if (opts._peek) (foldP || Promise.resolve()).then(function () { showPeek(variantId); });
      return c;
    });
  }
  function setQty(lineId, qty) {
    var r = setQtyRaw(lineId, qty);
    return (r && r.then) ? r.then(afterMutation) : r;
  }

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
  /* The tote is also sold on its own at AED 50 (/tote/, handle sahra-tote), which
     is what makes the "worth AED 50" on the offer card a real list price rather
     than an invented one. It must not earn a gift: buying one tote would
     otherwise ship two. Matched on handle, not variant id, so a reprice or a
     second colourway of the same product keeps working. (Faheem, 19 Sep.) */
  var TOTE_HANDLE = 'sahra-tote';
  var TOTE_PRICE = '50';   /* list price of the tote (not shown struck through since 25 Oct); keep in step
                              with the variant price and OFFER.toteValue. */
  function isTote(node) {
    var m = node && node.merchandise;
    return !!(m && m.product && m.product.handle === TOTE_HANDLE);
  }
  function cartNodes() {
    return (CART && CART.lines && CART.lines.edges) ? CART.lines.edges.map(function (e) { return e.node; }) : [];
  }
  function giftIn(c) {
    return !!(c && c.lines && c.lines.edges && c.lines.edges.some(function (e) { return isGift(e.node); }));
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
  /* What earns the free tote: anything the customer paid for that is not itself
     a tote. Kept separate from realQty, which is the badge count and must still
     include a purchased tote. */
  function giftEarningQty() {
    var n = 0;
    /* 23 Oct 2026 (Faheem: "Every order"): the free tote comes with every order, pre-orders included
       (reverses the 22 Oct Founding-only default) */
    /* 23 Oct 2026 (Faheem): the Trailhead Bag on its own does not earn the tote either ("No tote with bag-only orders") */
    cartNodes().forEach(function (l) { var h = l && l.merchandise && l.merchandise.product && l.merchandise.product.handle; if (!isGift(l) && !isTote(l) && h !== 'trailhead-bag') n += (l.quantity || 0); });
    return n;
  }

  function syncGift() {
    return queue(function () {
      if (!CART || !CART.id) return CART;
      var g = giftLine(), real = giftEarningQty();
      var op = null;
      if (real > 0 && !g) op = { m: GIFT_ADD, v: { id: CART.id, l: [{ merchandiseId: GIFT_VARIANT, quantity: 1 }] }, k: 'cartLinesAdd' };
      else if (real === 0 && g) op = { m: GIFT_RM, v: { id: CART.id, l: [g.id] }, k: 'cartLinesRemove' };
      else if (g && g.quantity > 1) op = { m: GIFT_RM, v: { id: CART.id, l: [g.id] }, k: 'cartLinesRemove' };
      if (!op) return CART;
      var run = function () {
        return sf(op.m, op.v).then(function (d) {
          var r = d && d[op.k];
          /* userErrors here mean "sold out" far more often than anything else.
             Not an error the customer caused, and not one they should see. */
          if (r && r.cart && !(r.userErrors && r.userErrors.length)) { CART = r.cart; draw(); }
          return CART;
        }).catch(function () { return CART; });
      };
      if (op.k !== 'cartLinesAdd') return run();
      /* Adding the gift to a cart that already holds real items would put it on
         top (newest first). Rebuild the cart instead — gift listed first, so it
         is the oldest line — and only switch to the new cart if it carries every
         real item the customer had; otherwise fall back to the plain add. */
      var reals = cartNodes().filter(function (n) { return !isGift(n); })
        .map(function (n) { return { merchandiseId: n.merchandise.id, quantity: n.quantity }; });
      return sf('mutation($l:[CartLineInput!]!,$cc:CountryCode!,$a:[AttributeInput!]){cartCreate(input:{lines:$l,buyerIdentity:{countryCode:$cc},attributes:$a}){cart{' + CFRAG + '}userErrors{message}}}',
                { l: [{ merchandiseId: GIFT_VARIANT, quantity: 1 }].concat(reals), cc: BUYER_CC, a: (CREATE_ATTR = attrNow()) })
        .then(function (d) {
          var r = d && d.cartCreate, c = r && r.cart;
          var kept = c ? (c.lines.edges || []).reduce(function (n, e) { return n + (isGift(e.node) ? 0 : e.node.quantity); }, 0) : -1;
          if (!c || (r.userErrors && r.userErrors.length) || kept !== real || !giftIn(c)) return run();
          CART = c; setCid(c.id); attrOk(attrKey(c.id, CREATE_ATTR)); draw();
          return CART;
        }, run);
    });
  }

  /* ==========================================================================
     THE BAG (30 Oct 2026, Faheem approved the Fold and Drop bag from the design-review
     prototype). A bottom sheet on phones and a drawer on desktop, in English or Arabic
     (document lang "ar": every label from STR.ar, prices through sahra-market.js fmt,
     the layout mirrored for RTL). In it: back-art thumbnails, the size changed in place,
     Remove with Undo, quantity, a fit note on Sahel tee lines, the free tote (no
     strike-through), the pair price stated plainly when it applies (never "save"), the
     total, delivery, returns, a gift row (message, hide prices on the packing slip; no
     postcard) and ONE Checkout button that never scrolls away. The cross-sell is one
     compact row. An add from a page folds the product photo into the bag icon and a
     short peek sheet rises with the item, the total and Checkout.
     DOM contract kept for cart-test.js: #sbBody (lines, .sb-qn, .sb-gift last),
     #sbFoot (hidden when empty), #sbSub (total), #sbFree (delivery), #sbGo.
     ========================================================================== */
  var AR = (function () { try { var d = document.documentElement; return !!(d && d.getAttribute && /^ar/i.test(d.getAttribute('lang') || '')); } catch (e) { return false; } })();
  /* "go on" arrows point the way the page reads (RTL QA S6) */
  var ARR = AR ? '&larr;' : '&rarr;';
  var STR = {
    en: {
      bag: 'Bag', yourBag: 'Your bag', close: 'Close bag', empty: 'Your bag is empty.', emptySub: 'Every piece is drawn from a real place in the UAE.', shop: 'Shop all pieces',
      piece1: '1 piece', pieces: '{n} pieces', size: 'Size {s}', changeSize: 'Change size, now {s}', loadingSizes: 'Loading sizes…', soldOut: 'sold out',
      teeShort: 'Tee {a} · Short {b}', oneSize: 'One size', remove: 'Remove', removeA: 'Remove {t}', removed: 'Removed {t}', undo: 'Undo',
      dec: 'One fewer', inc: 'One more', qty: 'Quantity', capped: 'No more in this size',
      tote: 'The Sahra Tote', yoursFree: 'yours free', toteSub: 'Free with every order', free: 'Free',
      pairPrice: 'pair price', afterDiscount: 'price applied', prePrice: 'pre-order price',
      applied: 'Pair price applied: any two Founding Edition tees for AED 359', appliedX: 'Pair price applied: the two-tee price',
      sahelFit: 'Sahel runs larger than the Founding Edition.', sahelChart: 'Sahel size chart', trailFit: 'No size chart yet.', trailAsk: 'Message us about your size',
      total: 'Total', delivery: 'Delivery', returns: 'Returns', tabby: 'Tabby',
      dUae: 'Free, next working day', dGcc: 'AED 50, free over AED 390', dGccFree: 'Free', dGccX: '3–5 working days, shown at checkout', dIntl: '7–14 working days, shown at checkout',
      away: 'AED {n} away from free delivery', unlocked: 'Free delivery unlocked',
      rUae: 'Free for 14 days', rX: 'Within 14 days', rX14: '14-day returns', dUaeLine: 'Free delivery, next working day \u00b7 free 14-day returns', appliedN: 'Pair price applied to all {n} Founding Edition tees', tabbyRow: '4 payments of {p}, no interest',
      checkout: 'Checkout', payUae: 'Apple Pay, Google Pay, Shop Pay, card or Tabby at checkout', payX: 'Apple Pay, Google Pay, Shop Pay or card at checkout',
      gift: 'This is a gift', giftMsg: 'Gift message (optional)', giftPh: 'Happy birthday, from all of us', giftHide: 'Hide prices on the packing slip', giftNote: 'We’ll include your message with the order.',
      added: 'Added to your bag', viewBag: 'View bag', closePeek: 'Close',
      second: 'Add a second: the pair is AED 359', secondIn: '{n} in {s}, {f}', addBtn: 'Add', adding: 'Adding…', other: 'Other sizes', regular: 'regular', oversized: 'oversized',
      bagT: 'Add the Trailhead Bag, AED 50', bagSub: 'Canvas drawstring bag, one size', sahelMore: 'Six more Sahel designs: tees, hoodies and a polo.', seeAll: 'See them all', secondX: 'Add a second tee for the two-tee price, applied automatically.', shopTees: 'Shop tees',
      errUpdate: 'We could not update your bag. ', errAdd: 'We could not add that to your bag. Please try again, or message us on WhatsApp.', errSwap: 'We could not change the size. Your bag is unchanged.',
      expired: 'Your previous bag expired, so we started a new one. Please check the items below.', capMsg: 'That is as many of {t} as we can take in {s} for now, so it stays at {q}.',
      errCur: 'We could not switch your bag’s currency. Your bag is unchanged. Please try again.'
    },
    ar: {
      bag: 'السلة', yourBag: 'سلّتك', close: 'إغلاق السلة', empty: 'سلّتك فارغة.', emptySub: 'كل قطعة مستوحاة من مكان حقيقي في الإمارات.', shop: 'تسوّق كل القطع',
      piece1: 'قطعة واحدة', piece2: 'قطعتان', pieces: '{n} قطع', piecesMany: '{n} قطعة',
      size: 'المقاس {s}', changeSize: 'تغيير المقاس، الآن {s}', loadingSizes: 'جارٍ تحميل المقاسات…', soldOut: 'نفد',
      teeShort: 'التيشيرت {a} · الشورت {b}', oneSize: 'مقاس واحد', remove: 'إزالة', removeA: 'إزالة {t}', removed: 'أُزيل: {t}', undo: 'تراجع',
      dec: 'إنقاص الكمية', inc: 'زيادة الكمية', qty: 'الكمية', capped: 'لا مزيد بهذا المقاس',
      tote: 'حقيبة صحراء القماشية', yoursFree: 'هدية مجانية', toteSub: 'مجانًا مع كل طلب', free: 'مجانًا',
      pairPrice: 'سعر القطعتين', afterDiscount: 'السعر المطبّق', prePrice: 'سعر الطلب المسبق',
      applied: 'طُبّق سعر القطعتين: أي تيشيرتين من الإصدار التأسيسي مقابل 359 درهمًا', appliedX: 'طُبّق سعر القطعتين',
      sahelFit: 'مقاسات ساحل أوسع من الإصدار التأسيسي.', sahelChart: 'جدول مقاسات ساحل', trailFit: 'لا يوجد جدول مقاسات بعد.', trailAsk: 'راسلنا بشأن مقاسك',
      total: 'المجموع', delivery: 'التوصيل', returns: 'الإرجاع', tabby: 'تابي',
      dUae: 'مجاني، في يوم العمل التالي', dGcc: '50 درهمًا، ومجاني فوق 390 درهمًا', dGccFree: 'مجاني', dGccX: 'من 3 إلى 5 أيام عمل، تظهر التكلفة عند الدفع', dIntl: 'من 7 إلى 14 يوم عمل، تظهر التكلفة عند الدفع',
      away: 'يبقى {n} درهمًا للتوصيل المجاني', unlocked: 'التوصيل مجاني لهذا الطلب',
      rUae: 'مجانًا خلال 14 يومًا', rX: 'خلال 14 يومًا', rX14: 'إرجاع خلال 14 يومًا', dUaeLine: 'توصيل مجاني في يوم العمل التالي · إرجاع مجاني خلال 14 يومًا', appliedN: 'طُبّق سعر القطعتين على التيشيرتات {n} من الإصدار التأسيسي', tabbyRow: '4 دفعات بدون فوائد، كل دفعة {p}',
      checkout: 'إتمام الشراء', payUae: 'الدفع عند إتمام الشراء: Apple Pay، Google Pay، Shop Pay، البطاقة أو تابي', payX: 'الدفع عند إتمام الشراء: Apple Pay، Google Pay، Shop Pay أو البطاقة',
      gift: 'هذا الطلب هدية', giftMsg: 'رسالة الهدية (اختياري)', giftPh: 'كل عام وأنتم بخير', giftHide: 'إخفاء الأسعار في قسيمة التغليف', giftNote: 'سنرفق رسالتك مع الطلب.',
      added: 'أُضيفت إلى سلّتك', viewBag: 'عرض السلة', closePeek: 'إغلاق',
      second: 'أضف تيشيرتًا ثانيًا: القطعتان بـ 359 درهمًا', secondIn: '{n}، المقاس {s}، {f}', addBtn: 'أضف', adding: 'جارٍ الإضافة…', other: 'مقاسات أخرى', regular: 'ريجولر', oversized: 'أوفرسايز',
      bagT: 'أضف حقيبة ترايلهيد، 50 درهمًا', bagSub: 'حقيبة قماشية برباط، مقاس واحد', sahelMore: 'ستة تصاميم أخرى من ساحل: تيشيرتات وهودي وبولو.', seeAll: 'شاهدها كلها', secondX: 'أضف تيشيرتًا ثانيًا بسعر القطعتين، يُطبّق تلقائيًا.', shopTees: 'تسوّق التيشيرتات',
      errUpdate: 'تعذّر تحديث سلّتك. ', errAdd: 'تعذّرت الإضافة إلى سلّتك. حاول مرة أخرى أو راسلنا على واتساب.', errSwap: 'تعذّر تغيير المقاس. سلّتك كما هي.',
      expired: 'انتهت صلاحية سلّتك السابقة، فبدأنا سلة جديدة. تحقق من القطع أدناه.', capMsg: 'هذا أقصى ما يمكننا توفيره من {t} بمقاس {s} حاليًا، فتبقى الكمية {q}.',
      errCur: 'تعذّر تغيير عملة سلّتك. سلّتك كما هي، حاول مرة أخرى.'
    }
  };
  /* QA S4 (30 Oct 2026): Arabic names for the bag, the peek and the cross-sell, reusing the names already on the site
     (content/products-ar for the Founding Edition; the Sahel and Trail names from the coordinator, for an Emirati reader to check) */
  var AR_NAME = { 'al-quaa-galaxy-regular': 'مجرّة القوع — ريجولر', 'al-quaa-galaxy-oversized': 'مجرّة القوع — أوفرسايز', 'empty-quarter-regular': 'الربع الخالي — ريجولر', 'empty-quarter-oversized': 'الربع الخالي — أوفرسايز',
    'hajar-mountains-regular': 'جبال الحجر — ريجولر', 'hajar-mountains-oversized': 'جبال الحجر — أوفرسايز', 'sand-polo': 'بولو صحراء',
    'khor-fakkan-bay-tee': 'تيشيرت خليج خورفكان', 'al-aqah-reef-tee': 'تيشيرت شعاب العقة', 'al-hamra-pearl-diver-tee': 'تيشيرت غوّاص اللؤلؤ في الحمرا', 'shams-tee': 'تيشيرت شمس',
    'barr-and-bahr-hoodie': 'هودي برّ وبحر', 'ras-al-khor-hoodie': 'هودي رأس الخور', 'the-sahel-polo': 'بولو ساحل', 'sahra-trail-tee': 'تيشيرت صحراء تريل',
    'sahra-trail-2-in-1-short': 'شورت صحراء تريل 2 في 1', 'sahra-trail-kit': 'طقم صحراء تريل', 'trailhead-bag': 'حقيبة ترايلهيد', 'sahra-tote': 'حقيبة صحراء القماشية' };
  /* the name a shopper reads: Arabic on Arabic pages, else Shopify's title; short drops the fit */
  function nameOf(h, title, short) {
    h = h || '';
    if (AR) {
      if (AR_NAME[h]) return short ? AR_NAME[h].replace(/ — .*$/, '') : AR_NAME[h];
      var m = /^(.*)-(regular|oversized)$/.exec(h);
      if (m && AR_NAME[m[1]]) return AR_NAME[m[1]] + (short ? '' : ' — ' + (m[2] === 'regular' ? 'ريجولر' : 'أوفرسايز'));
    }
    var t = String(title || '');
    return short ? t.replace(/\s+[\u2014-]\s+(Regular|Oversized)$/, '') : t;
  }
  function T(k, a) {
    var s = (AR && STR.ar[k] != null) ? STR.ar[k] : (STR.en[k] != null ? STR.en[k] : k);
    if (a) for (var x in a) s = s.split('{' + x + '}').join(a[x]);
    return s;
  }
  function piecesT(n) {
    if (!AR) return n === 1 ? T('piece1') : T('pieces', { n: n });
    return n === 1 ? T('piece1') : n === 2 ? T('piece2') : (n <= 10 ? T('pieces', { n: n }) : T('piecesMany', { n: n }));
  }
  /* back-art thumbnails: the art side of each piece, the same photo that opens its page */
  var THUMB = { 'al-quaa-galaxy-regular': '/shirts/card/alquaa-dune-back.webp', 'al-quaa-galaxy-oversized': '/shirts/card/alquaa-model-back.webp', 'empty-quarter-regular': '/shirts/card/emptyquarter-dune-front.webp', 'empty-quarter-oversized': '/shirts/card/emptyquarter-model-stand.webp',
    'hajar-mountains-regular': '/shirts/card/hajar-dune-back.webp', 'hajar-mountains-oversized': '/shirts/card/hajar-model-back.webp', 'sand-polo': '/shirts/card/polo-dune-front.webp',
    'barr-and-bahr-hoodie': 'ph-barr-01-back', 'ras-al-khor-hoodie': 'ph-rakh-01-back', 'the-sahel-polo': 'polo-front', 'trailhead-bag': 'trail-bag-front' };
  var MOCKS = { 'the-sahel-polo': 1, 'sahra-trail-tee': 1, 'sahra-trail-2-in-1-short': 1, 'sahra-trail-kit': 1 };
  function thumbOf(h, m) {
    var t = THUMB[h] || PRE[h];
    if (t) return t.charAt(0) === '/' ? t : '/assets/preorder/' + t + '-480.webp';
    var real = (window.SB_IMGS && SB_IMGS[h] && SB_IMGS[h][0]) || CART_REAL[h];
    if (real) return real.replace('/shirts/', '/shirts/card/').replace(/\.(jpe?g|png)$/i, '.webp');
    return (m && m.product && m.product.featuredImage) ? m.product.featuredImage.url : '';
  }
  var SAHEL_TEE = /^(khor-fakkan-bay-tee|al-hamra-pearl-diver-tee|al-aqah-reef-tee|shams-tee)-/;
  function $(id) { return document.getElementById(id); }
  function reducedMotion() { try { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
  function raf(fn) { return (window.requestAnimationFrame || function (f) { return setTimeout(f, 16); })(fn); }
  function isOpen() { var d = $('sbDrawer'); return !!(d && d.classList && d.classList.contains('on')); }
  function market() { try { return (window.SahraMarket && window.SahraMarket.market) ? window.SahraMarket.market() : (document.documentElement && document.documentElement.getAttribute ? (document.documentElement.getAttribute('data-market') || 'uae') : 'uae'); } catch (e) { return 'uae'; } }

  function ensureUI() {
    if ($('sbDrawer')) return;

    /* ADOPT an existing cart button rather than adding a second one.
       /shop/ ships its own #cartBtn in the nav. This module also ran there and
       appended #sbCartBtn, so that page carried TWO cart buttons and TWO
       drawers over one storage key — add via one, open the other, and the cart
       looks empty while the badge shows items. Adopt, never duplicate. */
    var existing = $('cartBtn');
    if (existing && !existing.dataset.sbBound) {
      existing.dataset.sbBound = '1';
      existing.addEventListener('click', function (e) { e.preventDefault(); open(); });
    } else if (!existing && !$('sbCartBtn')) {
      var hdr = document.querySelector('.hdr') || document.querySelector('nav');
      if (hdr) {
        var b = document.createElement('button');
        b.id = 'sbCartBtn'; b.className = 'sb-cart-btn'; b.type = 'button';
        b.setAttribute('aria-label', AR ? T('bag') : 'Open cart');
        b.innerHTML = '<svg class="sb-cart-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.3a1.5 1.5 0 0 0 1.5-1.2L20.5 8H6.2"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/></svg>' +
          '<span class="sb-cart-count" id="sbCartCount" aria-live="polite" style="display:none">0</span>';
        hdr.appendChild(b);
        b.addEventListener('click', open);
      }
    }

    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="sb-ov" id="sbOv"></div>' +
      '<aside class="sb-drawer" id="sbDrawer" role="dialog" aria-modal="true" aria-label="' + T('yourBag') + '" aria-hidden="true" inert' + (AR ? ' dir="rtl" lang="ar"' : '') + '>' +
        '<div class="sb-grab" id="sbGrab" aria-hidden="true"><i></i></div>' +
        '<div class="sb-dh" id="sbHead"><h3>' + T('yourBag') + ' <small id="sbCountT"></small></h3><button class="sb-x" id="sbX" type="button" aria-label="' + T('close') + '">&#10005;</button></div>' +
        '<div class="sb-db" id="sbScroll">' +
          '<div class="sb-lines" id="sbBody"><p class="sb-empty">' + T('empty') + '</p></div>' +
          '<p class="sb-applied" id="sbApplied" hidden></p>' +
          '<div class="sb-bundle" id="sbBundle" hidden></div>' +
          /* the gift row: the message travels on the Shopify order as its note, with Gift (and Hide prices) attributes */
          '<div class="sb-giftopt" id="sbGiftRow" hidden><label class="sb-giftl"><input type="checkbox" id="sbGiftChk"> <span>' + T('gift') + '</span></label>' +
            '<div class="sb-giftbox" id="sbGiftBox" hidden><label class="sb-giftml" for="sbGiftMsg">' + T('giftMsg') + '</label>' +
            '<textarea id="sbGiftMsg" rows="2" maxlength="250" placeholder="' + T('giftPh') + '"></textarea>' +
            '<label class="sb-gifthide"><input type="checkbox" id="sbGiftHide"> <span>' + T('giftHide') + '</span></label>' +
            '<p class="sb-gifth">' + T('giftNote') + '</p></div></div>' +
        '</div>' +
        '<div class="sb-undo" id="sbUndo" role="status" aria-live="polite" hidden><span id="sbUndoT"></span><button type="button" id="sbUndoB">' + T('undo') + '</button></div>' +
        '<div class="sb-df" id="sbFoot" hidden>' +
          '<div class="sb-sum">' +
            '<div class="sb-row sb-tot"><span>' + T('total') + '</span><b id="sbSub">AED 0</b></div>' +
            '<div class="sb-free" id="sbFree"></div>' +
          '</div>' +
          '<a class="sb-go" id="sbGo" href="#">' + T('checkout') + '</a>' +
          '<p class="sb-pay"><span class="sb-pay-uae">' + T('payUae') + '</span><span class="sb-pay-x">' + T('payX') + '</span></p>' +
        '</div>' +
      '</aside>' +
      /* the peek: rises after an add from a page; a tap opens the whole bag */
      '<div class="sb-peek" id="sbPeek" role="region" aria-label="' + T('added') + '" hidden' + (AR ? ' dir="rtl" lang="ar"' : '') + '>' +
        '<button type="button" class="sb-pk-main" id="sbPkOpen"><span class="sb-pk-i"><img id="sbPkImg" alt="" width="48" height="60"></span>' +
          '<span class="sb-pk-t"><small>\u2713 ' + T('added') + '</small><b id="sbPkName" dir="auto"></b><span id="sbPkMeta"></span></span>' +
          '<span class="sb-pk-view">' + T('viewBag') + '</span></button>' +
        '<button type="button" class="sb-pk-x" id="sbPkX" aria-label="' + T('closePeek') + '">&#10005;</button>' +
        '<div class="sb-pk-f"><span class="sb-pk-tot"><small>' + T('total') + '</small><b id="sbPkTot"></b></span><a class="sb-pk-go" id="sbPkGo" href="#">' + T('checkout') + '</a></div>' +
      '</div>';
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
    try { tickClocks(); } catch (e) {}

    $('sbX').addEventListener('click', close);
    $('sbOv').addEventListener('click', close);
    addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { hidePeek(); close(); return; }
      if (e.key !== 'Tab') return;
      var d = $('sbDrawer');
      if (!d || !d.classList.contains('on')) return;
      /* Real focus trap. aria-modal="true" was already on the element, which
         tells a screen reader the rest of the page is inert - it was not, so
         Tab landed the user on invisible content behind the overlay. */
      var f = d.querySelectorAll('a[href],button:not([disabled]),input,textarea,[tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    /* One delegated listener on the lines. The old code re-bound a listener per
       button on every draw, which leaked handlers each redraw. */
    $('sbBody').addEventListener('click', function (e) {
      var el = e.target.closest && e.target.closest('[data-act]');
      if (!el) return;
      var line = el.getAttribute('data-line');
      var act = el.getAttribute('data-act');
      if (act === 'rm') { remember(line); pending[line] = 0; setQty(line, 0); return; }
      if (act === 'size') { editLine = editLine === line ? null : line; if (editLine) loadSizes(line); draw(); return; }
      if (act === 'swap') { if (el.disabled || el.getAttribute('aria-pressed') === 'true') { editLine = null; draw(); return; } editLine = null; swap(line, el.getAttribute('data-vid')); return; }
      /* Read from `pending`, not from the DOM. data-qty is only refreshed when
         draw() re-renders after a mutation resolves, so three quick taps on +
         all read the same stale 1 and each asked the server for 2 — the
         customer tapped three times and got two. Intent accumulates here. */
      var base = (pending[line] != null) ? pending[line] : +el.getAttribute('data-qty');
      var next = act === 'inc' ? base + 1 : base - 1;
      if (next < 0) next = 0;
      if (next === 0) remember(line);
      pending[line] = next;
      setQty(line, next);
    });
    $('sbUndoB').addEventListener('click', undo);
    /* the peek */
    $('sbPkOpen').addEventListener('click', function () { hidePeek(); open(); });
    $('sbPkX').addEventListener('click', hidePeek);
    $('sbPkGo').addEventListener('click', function (e) {
      if (!CART || !CART.checkoutUrl) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
      e.preventDefault(); metaInit(); goCheckout(CART.checkoutUrl);   /* goCheckout sends begin_checkout once (QA S1) */
    });
    var pk = $('sbPeek');
    pk.addEventListener('mouseenter', function () { clearTimeout(peekT); });
    pk.addEventListener('focusin', function () { clearTimeout(peekT); });
    pk.addEventListener('mouseleave', function () { clearTimeout(peekT); peekT = setTimeout(hidePeek, 3000); });
    /* drag the sheet down to close it (phones) */
    (function () {
      var d = $('sbDrawer'), y0 = null, dy = 0;
      [$('sbGrab'), $('sbHead')].forEach(function (h) {
        if (!h) return;
        h.addEventListener('pointerdown', function (e) { if (e.target.closest && e.target.closest('button')) return; if (!(window.matchMedia && matchMedia('(max-width:700px)').matches)) return; y0 = e.clientY; dy = 0; d.classList.add('drag'); try { h.setPointerCapture(e.pointerId); } catch (x) {} });
        h.addEventListener('pointermove', function (e) { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); d.style.transform = 'translateY(' + dy + 'px)'; });
        var up = function () { if (y0 == null) return; y0 = null; d.classList.remove('drag'); d.style.transform = ''; if (dy > 90) close(); };
        h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
      });
    })();
    /* the photo that folds into the bag: whatever the visitor tapped near */
    document.addEventListener('pointerdown', function (e) { lastTap = e.target; }, true);
  }

  var lastFocus = null, lastTap = null, editLine = null, sizeCache = {}, undoT = null, undoInfo = null, peekT = null;
  /* 29 Oct 2026 (site speed): the tap on Checkout goes checkout.sahraandbeyond.ae -> shop.app (Shop Pay's
     check) -> back, and the checkout page pulls fonts and photos from cdn.shopify.com. The drawer opening
     is the moment a checkout becomes likely, so the connections to the other two are opened then. */
  var warmed = false;
  function warmCheckout() {
    if (warmed) return; warmed = true;
    try { ['https://shop.app', 'https://cdn.shopify.com'].forEach(function (h) { var l = document.createElement('link'); l.rel = 'preconnect'; l.href = h; l.crossOrigin = 'anonymous'; document.head.appendChild(l);
      var l2 = document.createElement('link'); l2.rel = 'preconnect'; l2.href = h; document.head.appendChild(l2); }); } catch (e) {}
  }
  function open() {
    ensureUI();
    warmCheckout();
    hidePeek();
    lastFocus = document.activeElement;
    /* opened from the peek (which then hides) or from nowhere: focus returns to the bag button (QA nice 8) */
    if (!lastFocus || lastFocus === document.body || (lastFocus.closest && lastFocus.closest('#sbPeek'))) lastFocus = $('sbCartBtn') || $('cartBtn') || document.querySelector('.sb-cart-btn');
    var d = $('sbDrawer');
    d.classList.add('on');
    $('sbOv').classList.add('on');
    d.setAttribute('aria-hidden', 'false');
    try { d.inert = false; } catch (e) {}
    document.body.style.overflow = 'hidden';
    var mainEl = document.querySelector('main'); if (mainEl) mainEl.setAttribute('aria-hidden', 'true');
    /* Bug 1: the drawer must be painted from current state every time it is
       opened, not only after an add. */
    draw();
    var x = $('sbX'); if (x) try { x.focus({ preventScroll: true }); } catch (e) { x.focus(); }
  }
  function close() {
    var d = $('sbDrawer');
    if (!d) return;
    d.classList.remove('on');
    d.setAttribute('aria-hidden', 'true');
    try { d.inert = true; } catch (e) {}   /* 18 Oct 2026: the closed drawer was still reachable by keyboard off-screen */
    $('sbOv').classList.remove('on');
    document.body.style.overflow = '';
    var mEl = document.querySelector('main'); if (mEl) mEl.removeAttribute('aria-hidden');
    editLine = null;
    if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
  }

  /* Update EVERY count element on the page. A page may carry its own #cartCount
     (as /shop/ does) as well as ours; if only one is updated the other keeps a
     stale number, which is precisely the phantom badge customers reported. */
  function badge(n) {
    var els = [$('sbCartCount'), $('cartCount')];
    els.forEach(function (c) {
      if (!c) return;
      c.textContent = n || 0;
      c.style.display = n ? 'flex' : 'none';
    });
    [$('sbCartBtn'), $('cartBtn')].forEach(function (btn) {
      if (btn) btn.setAttribute('aria-label', AR ? T('bag') + (n ? ', ' + piecesT(n) : '') : (n ? 'Open cart, ' + n + ' item' + (n === 1 ? '' : 's') : 'Open cart'));
    });    /* the floating phone cart button listens for this (24 Sep 2026) */
    try { document.dispatchEvent(new CustomEvent('sb:cartcount', { detail: n || 0 })); } catch (e) {}
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---- Fold and Drop ------------------------------------------------------
     The product photo folds like a shop-folded tee (its lower half turns up behind
     it), then drops along a short arc into the bag icon, which bumps. Transform and
     opacity only, about 500 ms; prefers-reduced-motion skips straight to the bump. */
  function dropTarget() {
    var list = ['#sbFcart.on', '#sbCartBtn', '#cartBtn', '.sb-cart-btn'];
    for (var i = 0; i < list.length; i++) {
      var el = document.querySelector(list[i]); if (!el || !el.getBoundingClientRect) continue;
      if (el.closest && el.closest('.sb-hide')) continue;
      var r = el.getBoundingClientRect();
      if (r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && getComputedStyle(el).visibility !== 'hidden') return el;
    }
    return null;
  }
  function bump() {
    try {
      [dropTarget(), $('sbCartCount'), $('cartCount')].forEach(function (el) {
        if (el && el.animate && !reducedMotion()) el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.22)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.3,1.6,.5,1)' });
      });
    } catch (e) {}
  }
  /* the page's main product photo, used when nothing near the tap is on screen (S10) */
  function mainImg() {
    try { return document.querySelector('[data-fold-src], .ss-v.on img, .arp-main img.on, .arp-main img, .gal-main img.on'); } catch (e) { return null; }
  }
  function guessSrc() {
    try {
      var el = lastTap;
      for (var k = 0; el && k < 8; k++, el = el.parentElement) {
        if (!el.querySelectorAll) continue;
        var best = null, area = 0;
        [].forEach.call(el.querySelectorAll('img'), function (im) {
          var r = im.getBoundingClientRect(); if (r.width < 60 || r.bottom < 0 || r.top > innerHeight) return;
          if (getComputedStyle(im).opacity === '0') return;
          if (r.width * r.height > area) { area = r.width * r.height; best = im; }
        });
        if (best) return best;
      }
    } catch (e) {}
    return null;
  }
  /* from: the photo; at: the control tapped. When the photo is off-screen (scrolled to the story, or the Arabic
     page's buy box under the photo), a small copy of it folds from the button instead (QA S10). */
  function fold(img, at) {
    return new Promise(function (res) {
      try {
        if (!img || !img.getBoundingClientRect || reducedMotion() || !document.body.animate) { bump(); res(); return; }
        var r = img.getBoundingClientRect();
        if (r.width < 40 || r.bottom < 0 || r.top > innerHeight) {
          var ar = at && at.getBoundingClientRect ? at.getBoundingClientRect() : null;
          if (!ar || ar.bottom < 0 || ar.top > innerHeight) { bump(); res(); return; }
          var ww = 104, hh = 130, acx = ar.left + ar.width / 2, acy = Math.max(hh / 2 + 8, ar.top - hh / 2 - 8);
          r = { left: acx - ww / 2, top: acy - hh / 2, right: acx + ww / 2, bottom: acy + hh / 2, width: ww, height: hh };
        }
        var t = dropTarget(), rtl = AR || getComputedStyle(document.documentElement).direction === 'rtl';
        var tr = t ? t.getBoundingClientRect() : { left: rtl ? 16 : innerWidth - 40, top: 18, width: 24, height: 24 };
        var vt = Math.max(r.top, 0), vb = Math.min(r.bottom, innerHeight);
        var w = Math.min(r.width, 200), h = Math.round(w * 1.25), cx = r.left + r.width / 2, cy = (vt + vb) / 2;
        var left = cx - w / 2, top = cy - h / 2;
        var cs = getComputedStyle(img), nw = img.naturalWidth || 4, nh = img.naturalHeight || 5;
        var contain = cs.objectFit === 'contain', s = contain ? Math.min(w / nw, h / nh) : Math.max(w / nw, h / nh);
        var bw = nw * s, bh = nh * s, pos = String(cs.objectPosition || '50% 50%').split(' ');
        var px = parseFloat(pos[0]) / 100, py = parseFloat(pos[1] || pos[0]) / 100; if (isNaN(px)) px = .5; if (isNaN(py)) py = .5;
        var bx = (w - bw) * px, by = (h - bh) * py, src = img.currentSrc || img.src, bg = '#E9E1D3';
        var fx = document.createElement('div'); fx.className = 'sb-fold'; fx.setAttribute('aria-hidden', 'true');
        fx.style.left = left + 'px'; fx.style.top = top + 'px'; fx.style.width = w + 'px'; fx.style.height = h + 'px';
        fx.innerHTML = '<div class="sb-fold-y"><div class="sb-fold-p"><div class="sb-fold-top"></div><div class="sb-fold-bot"><i class="sb-f1"></i><i class="sb-f2"></i></div></div></div>';
        var paint = function (el, oy) { el.style.backgroundImage = 'url("' + src + '")'; el.style.backgroundSize = bw + 'px ' + bh + 'px'; el.style.backgroundPosition = bx + 'px ' + (by - oy) + 'px'; el.style.backgroundColor = bg; };
        paint(fx.querySelector('.sb-fold-top'), 0); paint(fx.querySelector('.sb-f1'), h / 2); paint(fx.querySelector('.sb-f2'), h / 2);
        document.body.appendChild(fx);
        var dx = (tr.left + tr.width / 2) - (left + w / 2), dy = (tr.top + tr.height / 2) - (top + h / 4);
        try { img.animate([{ opacity: 1 }, { opacity: .45, offset: .2 }, { opacity: .45, offset: .7 }, { opacity: 1 }], { duration: 760, easing: 'ease-out' }); } catch (e) {}
        fx.querySelector('.sb-fold-bot').animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(178deg)' }], { duration: 220, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
        fx.querySelector('.sb-fold-p').animate([{ transform: 'scale(1,1)' }, { transform: 'scale(.66,1)' }], { duration: 230, easing: 'ease-out', fill: 'forwards' });
        var done = false; function end() { if (done) return; done = true; try { fx.remove(); } catch (e) {} bump(); res(); }
        setTimeout(function () {
          try {
            fx.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(' + dx + 'px)' }], { duration: 300, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' });
            fx.querySelector('.sb-fold-y').animate([{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(' + Math.min(-30, dy * .2 - 40) + 'px) scale(.45)', offset: .4 }, { transform: 'translateY(' + dy + 'px) scale(.08)' }], { duration: 300, easing: 'cubic-bezier(.4,0,.8,.6)', fill: 'forwards' });
            var fade = fx.animate([{ opacity: 1 }, { opacity: 1, offset: .75 }, { opacity: 0 }], { duration: 310, fill: 'forwards' });
            fade.onfinish = end;
          } catch (e) { end(); }
        }, 200);
        setTimeout(end, 900);
      } catch (e) { bump(); res(); }
    });
  }

  /* ---- the peek ---------------------------------------------------------- */
  function lineFor(vid) { var hit = null; cartNodes().forEach(function (n) { if (!hit && n.merchandise && n.merchandise.id === vid) hit = n; }); return hit; }
  function sizeText(m) {
    var hh = m.product && m.product.handle, t = m.title || '';
    if (hh === 'sahra-trail-kit' && / \/ /.test(t)) return T('teeShort', { a: esc(t.split(' / ')[0]), b: esc(t.split(' / ')[1]) });
    if (t === 'Default Title') return T('oneSize');
    return T('size', { s: '<span dir="ltr">' + esc(t) + '</span>' });
  }
  function showPeek(vid) {
    try {
      ensureUI();
      var pk = $('sbPeek'); if (!pk || !CART || isOpen()) return;
      var l = lineFor(vid); if (!l) return;
      var m = l.merchandise, h = m.product && m.product.handle;
      var im = $('sbPkImg'), src = thumbOf(h, m); if (im) { if (src) im.setAttribute('src', src); else im.removeAttribute('src'); }
      $('sbPkName').textContent = nameOf(h, (m.product && m.product.title) || '');
      var pki = pk.querySelector('.sb-pk-i'), mt = pki && pki.querySelector('i');
      if (pki) { if (MOCKS[h] && !mt) { mt = document.createElement('i'); mt.textContent = 'Mock-up'; pki.appendChild(mt); } else if (!MOCKS[h] && mt) mt.parentNode.removeChild(mt); }
      $('sbPkMeta').innerHTML = sizeText(m);
      $('sbPkTot').textContent = money(CART.cost.subtotalAmount.amount, CART.cost.subtotalAmount.currencyCode);
      $('sbPkGo').href = coUrl(CART.checkoutUrl);
      pk.hidden = false; pk.classList.remove('on');
      raf(function () { raf(function () { pk.classList.add('on'); }); });
      warmCheckout();
      clearTimeout(peekT); peekT = setTimeout(hidePeek, 6000);
    } catch (e) {}
  }
  function hidePeek() {
    clearTimeout(peekT);
    var pk = $('sbPeek'); if (!pk || pk.hidden) return;
    pk.classList.remove('on');
    setTimeout(function () { if (!pk.classList.contains('on')) pk.hidden = true; }, reducedMotion() ? 0 : 320);
  }

  /* ---- Remove with Undo: the line goes at once; Undo puts the same variant back ---- */
  function remember(lineId) {
    var l = null; cartNodes().forEach(function (n) { if (n.id === lineId) l = n; });
    if (!l || isGift(l)) return;
    var lh = l.merchandise.product && l.merchandise.product.handle;
    undoInfo = { vid: l.merchandise.id, qty: l.quantity || 1, title: nameOf(lh, (l.merchandise.product && l.merchandise.product.title) || '', true) };
    var u = $('sbUndo'), t = $('sbUndoT'); if (!u || !t) return;
    t.textContent = T('removed', { t: undoInfo.title }); u.hidden = false;
    clearTimeout(undoT); undoT = setTimeout(function () { u.hidden = true; undoInfo = null; }, 5000);
  }
  function undo() {
    var u = $('sbUndo'); if (u) u.hidden = true; clearTimeout(undoT);
    var x = undoInfo; undoInfo = null; if (!x) return;
    add(x.vid, x.qty, { open: false }).catch(function () {});
  }

  /* ---- size changed in place ---------------------------------------------- */
  function handleOf(lineId) { var h = ''; cartNodes().forEach(function (n) { if (n.id === lineId) h = n.merchandise && n.merchandise.product && n.merchandise.product.handle || ''; }); return h; }
  function loadSizes(lineId) {
    var h = handleOf(lineId); if (!h || sizeCache[h]) return;
    sizeCache[h] = 'loading';
    variants(h).then(function (vs) { sizeCache[h] = vs || []; draw(); }, function () { delete sizeCache[h]; draw(); });
  }
  function swap(lineId, vid) {
    if (!CART || !lineId || !vid) return Promise.resolve(null);
    return queue(function () {
      lastError = null;
      var line = null; cartNodes().forEach(function (n) { if (n.id === lineId) line = n; });
      if (!line) return CART;
      var q = line.quantity || 1;
      return sf('mutation($id:ID!,$l:[CartLineUpdateInput!]!){cartLinesUpdate(cartId:$id,lines:$l){cart{' + CFRAG + '}userErrors{message}}}', { id: CART.id, l: [{ id: lineId, merchandiseId: vid, quantity: q }] })
        .then(function (d) {
          var r = d && d.cartLinesUpdate;
          if (r && r.cart && !(r.userErrors && r.userErrors.length)) return r.cart;
          /* fallback: add the new size, then take the old line out */
          return sf('mutation($id:ID!,$l:[CartLineInput!]!){cartLinesAdd(cartId:$id,lines:$l){cart{' + CFRAG + '}userErrors{message}}}', { id: CART.id, l: [{ merchandiseId: vid, quantity: q }] })
            .then(function (d2) {
              var r2 = d2 && d2.cartLinesAdd; if (!r2 || !r2.cart || (r2.userErrors && r2.userErrors.length)) throw new Error((r2 && r2.userErrors && r2.userErrors[0] && r2.userErrors[0].message) || 'swap');
              return sf('mutation($id:ID!,$l:[ID!]!){cartLinesRemove(cartId:$id,lineIds:$l){cart{' + CFRAG + '}userErrors{message}}}', { id: CART.id, l: [lineId] })
                .then(function (d3) { var r3 = d3 && d3.cartLinesRemove; return (r3 && r3.cart) || r2.cart; });
            });
        })
        .then(function (c) { CART = c; draw(); try { if (window.track) track('bag_size_change', { item_id: handleOf(lineId) }); } catch (e) {} return CART; })
        .catch(function () { lastError = T('errSwap'); draw(); return CART; });
    }).then(afterMutation);
  }

  function metaCheckout() { beginCheckout(); metaInit(); }   /* 25 Oct 2026 (retention audit): GA4 begin_checkout */
  function metaInit() {
    try {
      if (!window.sbMeta || !CART || !CART.cost) return;
      var nodes = (CART.lines && CART.lines.edges || []).map(function (e) { return e.node; });
      window.sbMeta('InitiateCheckout', { value: Number(CART.cost.subtotalAmount.amount) || 0, currency: CART.cost.subtotalAmount.currencyCode || 'AED',
        num_items: CART.totalQuantity || nodes.length, content_type: 'product', content_ids: nodes.map(function (l) { return (l && l.merchandise && l.merchandise.id) || ''; }).filter(Boolean) });
    } catch (e) {}
  }

  function draw() {
    ensureUI();
    var body = $('sbBody'), foot = $('sbFoot');
    if (!body || !foot) return;

    var lines = (CART && CART.lines && CART.lines.edges)
      ? CART.lines.edges.map(function (e) { return e.node; }) : [];

    /* the gift is not something the customer chose - it must not inflate
       the badge, or "2" shirts would read as 3 */
    badge(CART ? realQty() : 0);

    var err = lastError
      ? '<p class="sb-err" role="alert">' + esc(lastError) + '</p>' : '';

    /* A cart holding nothing but the gift is empty as far as the customer is
       concerned. Never render a checkout button for it: the tote is free and
       UAE delivery is free, so an AED 0 order would otherwise look orderable.
       Shopify also refuses it (the UAE rate needs TOTAL_PRICE >= 1), but the
       UI must not offer what the server will reject. */
    var realLines = lines.filter(function (l) { return !isGift(l); });
    var gifts = lines.filter(isGift);
    var cnt = $('sbCountT'), gr = $('sbGiftRow'), bu = $('sbBundle');
    if (!realLines.length) {
      body.innerHTML = err + '<div class="sb-empty"><p>' + T('empty') + '</p><small>' + T('emptySub') + '</small><a href="' + (AR ? '/ar/shop/' : '/shop/') + '">' + T('shop') + '</a></div>';
      foot.hidden = true;
      if (cnt) cnt.textContent = '';
      if (gr) gr.hidden = true;
      if (bu) { bu.hidden = true; bu.innerHTML = ''; }
      return;
    }
    if (cnt) cnt.textContent = piecesT(realQty());

    /* the tote is listed last, whatever order Shopify returns */
    body.innerHTML = err + realLines.concat(gifts).map(function (l) {
      var m = l.merchandise, hh = m.product && m.product.handle, img = thumbOf(hh, m);
      var q = l.quantity;
      /* The gift has no product page (headless-only), so no link; and no
         quantity or remove controls - it is not the customer's to manage. */
      if (isGift(l)) {
        return '<div class="sb-line sb-gift">' +
          '<span class="sb-th"><img src="/shirts/tote-band.webp" alt="" width="64" height="64" loading="lazy"></span>' +
          '<div class="sb-lt">' +
            '<span class="sb-gift-t">' + T('tote') + ' &mdash; ' + T('yoursFree') + '</span>' +
            '<span class="sb-gift-p"><small>' + T('toteSub') + '</small></span>' +   /* 25 Oct 2026: no struck-through AED 50 (brand rule) */
          '</div>' +
        '</div>';
      }
      var title = nameOf(hh, (m.product && m.product.title) || ''), href = (AR && /^(al-quaa|empty-quarter|hajar|sand-polo)/.test(hh) ? '/ar' : '') + '/products/' + esc(hh) + '/';
      var kit = hh === 'sahra-trail-kit' && / \/ /.test(m.title), one = m.title === 'Default Title';
      var editing = editLine === l.id && !kit && !one;
      var sizeCtl = (kit || one) ? '<span class="sb-sz0">' + sizeText(m) + '</span>'
        : '<button type="button" class="sb-szb" data-act="size" data-line="' + esc(l.id) + '" aria-expanded="' + editing + '" aria-label="' + esc(T('changeSize', { s: m.title })) + '">' + sizeText(m) + ' <i aria-hidden="true">&#9662;</i></button>';
      var chips = '';
      if (editing) {
        var vs = sizeCache[hh];
        chips = '<div class="sb-chips" role="group" aria-label="' + esc(T('changeSize', { s: m.title })) + '">' + (vs === 'loading' || !vs ? '<span class="sb-ld">' + T('loadingSizes') + '</span>'
          : vs.map(function (v) { var on = v.id === m.id, ok = v.availableForSale;
              return '<button type="button" data-act="swap" data-line="' + esc(l.id) + '" data-vid="' + esc(v.id) + '" aria-pressed="' + on + '"' + (ok || on ? '' : ' disabled aria-label="' + esc(v.title + ', ' + T('soldOut')) + '"') + ' dir="ltr">' + esc(v.title) + '</button>'; }).join('')) + '</div>';
      }
      var note = SAHEL_TEE.test(hh || '') ? '<span class="sb-fitn">' + T('sahelFit') + ' <a href="/size-guide/#sahel">' + T('sahelChart') + '</a></span>'
        : /^sahra-trail-(tee|2-in-1-short|kit)$/.test(hh || '') ? '<span class="sb-fitn">' + T('trailFit') + ' <a href="https://wa.me/971585449946" target="_blank" rel="noopener">' + T('trailAsk') + '</a></span>' : '';
      var qa = m.quantityAvailable, capped = (typeof qa === 'number') && q >= qa;
      return '<div class="sb-line" data-lid="' + esc(l.id) + '">' +
        '<a class="sb-th" href="' + href + '" tabindex="-1" aria-hidden="true">' + (img ? '<img src="' + esc(img) + '" alt="" width="64" height="80" loading="lazy">' : '<span class="sb-noimg"></span>') + (MOCKS[hh] ? '<i>Mock-up</i>' : '') + '</a>' +
        '<div class="sb-lt">' +
          '<a class="sb-nm" dir="auto" href="' + href + '">' + esc(title) + '</a>' +
          '<div class="sb-meta">' + sizeCtl + '</div>' + chips +
          (isPre(l) && !PRE_IN_HAND ? '<span class="sb-pre">Pre-order. Ships from Fri 30 Oct.</span>' : '') +
          note +
          '<div class="sb-lr">' +
            /* Bug 2 + 3: quantity is visible AND adjustable */
            '<span class="sb-qty">' +
              '<button type="button" class="sb-q" data-act="dec" data-line="' + esc(l.id) + '" data-qty="' + q + '" aria-label="' + T('dec') + '">&minus;</button>' +
              '<span class="sb-qn" aria-label="' + T('qty') + '">' + q + '</span>' +
              '<button type="button" class="sb-q" data-act="inc" data-line="' + esc(l.id) + '" data-qty="' + q + '"' + (capped ? ' disabled aria-disabled="true" aria-label="' + T('inc') + ' (' + T('capped') + ')"' : ' aria-label="' + T('inc') + '"') + '>+</button>' +
            '</span>' +
            '<button type="button" class="sb-rm" data-act="rm" data-line="' + esc(l.id) + '" aria-label="' + esc(T('removeA', { t: title })) + '">' + T('remove') + '</button>' +
            linePrice(l) +
          '</div>' +
          /* 23 Oct 2026 (Faheem: no scarcity wording anywhere): no "Only N left" line, no count */
        '</div>' +
      '</div>';
    }).join('');

    var cur = CART.cost.subtotalAmount.currencyCode, amt = parseFloat(CART.cost.subtotalAmount.amount) || 0;
    $('sbSub').textContent = money(CART.cost.subtotalAmount.amount, cur);
    $('sbGo').href = coUrl(CART.checkoutUrl);
    var mkt = market();

    /* the pair price, stated plainly; the one-tap second tee and the line cross-sells, as one compact row */
    (function () {
      var ap = $('sbApplied'), el = bu;
      /* only the bundle's own allocations count - any other automatic discount is not credited to it (review, 23 Sep) */
      var saved = 0, tees = 0;
      realLines.forEach(function (l) {
        (l.discountAllocations || []).forEach(function (a) { if (/2 tees|359/i.test(a.title || '')) saved += parseFloat((a.discountedAmount || {}).amount) || 0; });
        if (isTee(l)) tees += l.quantity;
      });
      if (ap) { ap.hidden = !(saved > 0.004); ap.innerHTML = saved > 0.004 ? '✓ ' + (tees >= 3 ? T('appliedN', { n: tees }) : cur === 'AED' ? T('applied') : T('appliedX')) : ''; }   /* 30 Oct 2026 (Faheem): no "you save" wording */
      if (!el) return;
      var show = function (h) { el.hidden = false; el.innerHTML = h; }, hide = function () { el.hidden = true; el.innerHTML = ''; el.className = 'sb-bundle'; };
      if (saved > 0.004) { hide(); return; }
      if (tees === 1) {
        /* 4 Oct 2026 (CRO panel, idea 14): one tap adds a second design in the same size. The pair price is
           Shopify's own automatic discount on the six Founding Edition tees at two or more. */
        var have = realLines.filter(isTee)[0], hm = have && have.merchandise, hh = hm && hm.product && hm.product.handle || '';
        var fit = /oversized/.test(hh) ? 'oversized' : 'regular', size = hm && hm.title || '';
        var pick = TEES.filter(function (t) { return t.h !== hh && t.fit === fit && t.name !== (TEES.filter(function (x) { return x.h === hh; })[0] || {}).name; })[0] || TEES.filter(function (t) { return t.h !== hh; })[0];
        if (pick && cur === 'AED') {
          el.className = 'sb-bundle sb-second';
          show('<img src="' + pick.img + '" alt="" width="40" height="50" loading="lazy"><span class="sb-second-t"><b>' + T('second') + '</b><br>' + T('secondIn', { n: esc(nameOf(pick.h, pick.name, true)), s: '<span dir="ltr">' + esc(size) + '</span>', f: T(fit) }) + '</span>' +
            '<button type="button" class="sb-second-add" data-handle="' + pick.h + '" data-size="' + esc(size) + '">' + T('addBtn') + '</button>');
        } else { el.className = 'sb-bundle'; show(T('secondX') + ' <a href="/t-shirts/">' + T('shopTees') + ' ' + ARR + '</a>'); }
        return;
      }
      /* 27 Oct 2026 (Faheem: "Cross-sell between lines"): a Sahra Trail bag without the Trailhead Bag is offered
         it (one size, one tap); a bag with a single Sahel piece is shown the rest of Sahel. */
      var hs = realLines.map(function (l) { return (l.merchandise && l.merchandise.product && l.merchandise.product.handle) || ''; });
      var trailIn = hs.some(function (h) { return /^sahra-trail-/.test(h); }), bagIn = hs.indexOf('trailhead-bag') >= 0;
      var sahelN = 0; realLines.forEach(function (l) { var h = (l.merchandise && l.merchandise.product && l.merchandise.product.handle) || ''; if (/^(khor-fakkan-bay|al-hamra-pearl-diver|al-aqah-reef|shams-tee|the-sahel-polo|barr-and-bahr|ras-al-khor)/.test(h)) sahelN += l.quantity; });
      if (trailIn && !bagIn && cur === 'AED') {
        el.className = 'sb-bundle sb-second';
        show('<img src="/assets/preorder/trail-bag-front-480.webp" alt="" width="40" height="50" loading="lazy"><span class="sb-second-t"><b>' + T('bagT') + '</b><br>' + T('bagSub') + '</span>' +
          '<button type="button" class="sb-second-add" data-handle="trailhead-bag" data-size="">' + T('addBtn') + '</button>');
      } else if (sahelN === 1) { el.className = 'sb-bundle'; show(T('sahelMore') + ' <a href="/sahel/#pieces">' + T('seeAll') + ' ' + ARR + '</a>'); }
      else hide();
    })();

    /* Delivery and returns, by market. Honest maths only: the one remaining threshold (GCC AED 390) is in AED,
       so it is only counted down on a bag priced in AED. UAE delivery is free with no minimum (1 Sep 2026). */
    (function () {
      var el = $('sbFree'); if (!el) return;
      var x = '';
      if (mkt === 'gcc') {
        if (cur !== 'AED') x = T('dGccX');
        else if (amt >= 390) x = T('dGccFree') + ' \u00b7 ' + T('unlocked');
        else { var left = 390 - amt, lt = left % 1 === 0 ? left.toFixed(0) : left.toFixed(2);
          x = T('dGcc') + '<span class="sb-free-t">' + T('away', { n: lt }) + '</span><span class="sb-free-bar"><span style="width:' + Math.max(6, Math.round(amt / 390 * 100)) + '%"></span></span>'; }
        el.className = 'sb-free sb-x-mkt';
        el.innerHTML = T('delivery') + ': ' + x.replace(/(<span class="sb-free-t">)/, ' \u00b7 ' + T('rX14') + '$1') + (x.indexOf('sb-free-t') < 0 ? ' \u00b7 ' + T('rX14') : '');
      } else if (mkt === 'intl') { el.className = 'sb-free sb-x-mkt'; el.innerHTML = T('delivery') + ': ' + T('dIntl') + ' \u00b7 ' + T('rX14'); }
      else {
        /* 22 Oct 2026: a bag holding pre-order pieces does not promise next-day delivery for them */
        var anyPre = !PRE_IN_HAND && cartNodes().some(isPre);
        el.className = 'sb-free';
        el.innerHTML = '\u2713 ' + (anyPre ? 'Free UAE delivery, pre-order pieces ship from Fri 30 Oct' : T('dUaeLine'));
      }
      el.hidden = false;
    })();

    /* Gift option: saved to the cart as you type (debounced) and once more, awaited for at
       most 1.5 s, on the click through to checkout - so a fast tap cannot lose the message. */
    (function () {
      var chk = $('sbGiftChk'), box = $('sbGiftBox'), ta = $('sbGiftMsg'), hideP = $('sbGiftHide'), go = $('sbGo');
      if (gr) gr.hidden = false;
      if (!chk || !ta || !go || chk.__sbGift) return;
      chk.__sbGift = 1;
      try { var g0 = JSON.parse(localStorage.getItem('sb_gift') || 'null');
        if (g0 && CART && g0.cart === CART.id) { chk.checked = !!g0.on; ta.value = g0.msg || ''; if (hideP) hideP.checked = !!g0.hide; box.hidden = !g0.on; } } catch (e) {}
      if (gr && gr.classList) gr.classList.toggle('on', !!chk.checked);
      var t = null, last = null, pend = null, noteSet = false;
      function save() {
        if (!CART || !CART.id) return Promise.resolve();
        var on = chk.checked, msg = (ta.value || '').trim().slice(0, 250), hp = !!(on && hideP && hideP.checked);
        /* 25 Oct 2026: a click during an in-flight save waits for that save instead of cancelling it */
        var key = on + '|' + hp + '|' + msg + '|' + CART.id; if (key === last) return pend || Promise.resolve(); last = key;
        try { localStorage.setItem('sb_gift', JSON.stringify({ cart: CART.id, on: on, msg: msg, hide: hp })); } catch (e) {}
        var note = on ? ('GIFT ORDER' + (hp ? ' - hide prices on the packing slip' : '') + (msg ? ' - message: ' + msg : ' - no message')) : '';
        /* 25 Oct 2026: cartAttributesUpdate replaces the whole set, so the gift flags travel with the
           attribution attributes from assets/sahra-measure.js (hidden "_" keys: source, campaign, landing) */
        var attrs = (on ? [{ key: 'Gift', value: 'Yes' }] : []).concat(hp ? [{ key: 'Hide prices', value: 'Yes' }] : []).concat(window.sbAttr ? window.sbAttr() : []);
        /* one after the other: sent together, the second write could restore the old note */
        var notep = (on || noteSet) ? sf('mutation($id:ID!,$n:String!){cartNoteUpdate(cartId:$id,note:$n){cart{id}userErrors{message}}}', { id: CART.id, n: note }) : Promise.resolve();
        if (on) noteSet = true;
        pend = notep
          .then(function () { return sf('mutation($id:ID!,$a:[AttributeInput!]!){cartAttributesUpdate(cartId:$id,attributes:$a){cart{id}userErrors{message}}}', { id: CART.id, a: attrs }); })
          .then(function (d) { var r = d && d.cartAttributesUpdate; if (!on && r && !(r.userErrors && r.userErrors.length)) attrOk(attrKey(CART.id, attrNow())); })
          .then(function () { if (on && window.track) try { track('gift_option', { with_message: !!msg, hide_prices: hp }); } catch (e) {} })
          .catch(function () { last = null; });
        return pend;
      }
      chk.addEventListener('change', function () { box.hidden = !chk.checked; if (gr && gr.classList) gr.classList.toggle('on', chk.checked); if (chk.checked) try { ta.focus({ preventScroll: true }); } catch (e) {} save(); });
      if (hideP) hideP.addEventListener('change', save);
      ta.addEventListener('input', function () { clearTimeout(t); t = setTimeout(save, 700); });
      go.addEventListener('click', function (e) {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;   /* open-in-new-tab keeps working */
        if (!chk.checked && last === null && !(window.sbAttr && window.sbAttr().length)) return;
        /* 29 Oct 2026: no gift and the cart already carries these attributes (written by cartCreate) - go now */
        if (!chk.checked && !noteSet && !pend && CART && ATTR_OK === attrKey(CART.id, attrNow())) return;
        var href = go.href; if (!href || href.slice(-1) === '#') return;
        e.preventDefault(); clearTimeout(t);
        var done = false; function nav() { if (done) return; done = true; location.href = href; }
        save().then(nav, nav); setTimeout(nav, 1500);
      });
    })();

    /* Meta InitiateCheckout + GA4 begin_checkout on the click through to Shopify checkout. Purchase itself is
       tracked on the Shopify side by the Meta sales channel, because this site never sees the thank-you page. */
    var _go = $('sbGo');
    if (_go && !_go.__sbMetaBound) { _go.__sbMetaBound = 1; _go.addEventListener('click', metaCheckout); }
    foot.hidden = false;
  }

  /* ---- mutations ------------------------------------------------------ */

  /* qty 0 removes the line. One code path for -, + and x. */
  function setQtyRaw(lineId, qty) {
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
        /* 4 Oct 2026 (Faheem: "the + button doesn't seem to be working"): Shopify does not
           refuse a quantity above stock, it quietly caps the line and returns the cart
           unchanged, so the + looked dead. Compare what came back with what was asked. */
        var got = null;
        (CART.lines && CART.lines.edges || []).forEach(function (e) { if (e.node.id === lineId) got = e.node; });
        if (q > 0 && got && got.quantity < q) {
          var m = got.merchandise || {}, nm = (m.product && m.product.title) || 'this item';
          lastError = T('capMsg', { t: nm, s: m.title || '', q: got.quantity });
          pending[lineId] = got.quantity;
        }
        /* server has spoken - drop any pending intent it has now satisfied */
        (CART.lines && CART.lines.edges || []).forEach(function (e) {
          if (pending[e.node.id] === e.node.quantity) delete pending[e.node.id];
        });
        if (q === 0) delete pending[lineId];
        draw();
        return CART;
      }).catch(function (e) {
        lastError = T('errUpdate') + (e.message || '');
        draw();
        throw e;
      });
    });
  }

  function addRaw(variantId, qty, opts) {
    var earnsGift = !(opts && opts.gift === false);
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
          lastError = T('expired');
        }
        CART = null;
        setCid(null);
        /* THE TOTE IS THE OLDEST LINE. Shopify lists cart lines newest first and
           reverses the array a cartCreate is given, so a gift added AFTER the
           product sat at the top of the cart, the checkout and the order — and
           the order notifications (WhatsApp) led with the tote's photo instead
           of what the customer bought (Faheem, 8 Sep). Creating the cart with
           the gift listed first makes it the last line; everything added later
           lands above it. The gift can never break a real add: if Shopify
           refuses the pair (the tote is finite), the cart starts without it. */
        var createWith = function (lines, bare) {
          var Q = 'mutation($l:[CartLineInput!]!,$cc:CountryCode!,$a:[AttributeInput!]){cartCreate(input:{lines:$l,buyerIdentity:{countryCode:$cc},attributes:$a}){cart{' + CFRAG + '}userErrors{message}}}';
          return sf(Q,
                    /* read at send time, inside the queue — a country change
                       that already happened should win, and one still queued
                       behind us will re-point the cart when its turn comes */
                    { l: lines, cc: BUYER_CC, a: (CREATE_ATTR = bare ? [] : attrNow()) })
            /* 29 Oct 2026: attribution must never cost a sale - if Shopify refuses the cart with the
               attributes on it, the cart is created without them (they are then written at checkout) */
            .then(function (d) { var r = d && d.cartCreate;
              return (!bare && CREATE_ATTR.length && (!r || !r.cart || (r.userErrors && r.userErrors.length))) ? createWith(lines, true) : d; },
              function (e) { if (bare || !CREATE_ATTR.length) throw e; return createWith(lines, true); });
        };
        var real = [{ merchandiseId: variantId, quantity: want }];
        /* Only seed the gift when the item being added actually earns one. This
           branch runs on the FIRST add to an empty cart, before any cart exists
           to inspect — so adding the tote itself used to create a cart holding a
           paid tote AND a free one. syncGift() removed the second a moment
           later, but the customer saw both lines flash up, and if that removal
           failed (it is deliberately swallowed, so a gift can never break a real
           add) a fast click on Checkout shipped two totes for one payment.
           earnsGift is passed by the caller because a variant id alone cannot be
           resolved to a product handle without another round trip. */
        if (!earnsGift) return createWith(real).then(function (d) {
          var r = d.cartCreate;
          if (r && r.userErrors && r.userErrors.length) throw new Error(r.userErrors[0].message);
          if (!r || !r.cart) throw new Error('Could not start a cart.');
          return r.cart;
        });
        return createWith([{ merchandiseId: GIFT_VARIANT, quantity: 1 }].concat(real))
          .then(function (d) {
            var r = d && d.cartCreate, ok = r && r.cart && !(r.userErrors && r.userErrors.length) &&
              (r.cart.lines.edges || []).some(function (e) { return e.node.merchandise && e.node.merchandise.id === variantId; });
            return ok ? d : createWith(real);
          }, function () { return createWith(real); })
          .then(function (d) {
            var r = d.cartCreate;
            if (r && r.userErrors && r.userErrors.length) throw new Error(r.userErrors[0].message);
            if (!r || !r.cart) throw new Error('Could not start a cart.');
            return r.cart;
          });
      }).then(function (c) {
        if (!CART || CART.id !== c.id) attrOk(attrKey(c.id, CREATE_ATTR));
        CART = c; setCid(c.id); pending = {}; draw();
        if (opts && opts.open !== false && !isOpen()) opts._peek = true;
        return c;
      }).catch(function (e) {
        /* Shopify's own wording is more useful than ours when it is telling
           the customer something specific, like "only 2 left". */
        lastError = e && e.userError
          ? e.message
          : T('errAdd');
        draw(); if (!(opts && opts.open === false)) open();
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
    return sf('query($h:String!){product(handle:$h){variants(first:20){edges{node{id title availableForSale quantityAvailable}}}}}', { h: handle })
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
          lastError = T('errCur');
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

  tickClocks(); setInterval(tickClocks, 15000);
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('.sb-second-add'); if (!b) return;
    e.preventDefault(); b.disabled = true; b.textContent = T('adding');
    var h = b.getAttribute('data-handle'), sz = b.getAttribute('data-size');
    variants(h).then(function (vs) {
      var v = vs.filter(function (x) { return (sz ? x.title === sz : true) && x.availableForSale; })[0];
      if (!v) { b.textContent = (sz ? sz + ' ' : '') + T('soldOut'); b.disabled = true; var l = b.parentNode && b.parentNode.querySelector('.sb-second-t'); if (l) l.innerHTML += ' <a href="/products/' + h + '/">' + T('other') + ' ' + ARR + '</a>'; return; }
      return add(v.id, 1, { open: false }).then(function () { if (window.track) track('add_to_cart', { item_id: h, size: v.title, via: h === 'trailhead-bag' ? 'cart-trail-bag' : 'second-tee' }); });
    }).catch(function () { b.disabled = false; b.textContent = T('addBtn'); });
  });
  /* 25 Oct 2026 (retention audit): one begin_checkout and one attribute write for every route to
     checkout: the drawer button and the product pages' Buy now. */
  function beginCheckout() {
    try {
      if (!window.track || !CART || !CART.cost) return;
      var ns = (CART.lines && CART.lines.edges || []).map(function (e) { return e.node; });
      window.track('begin_checkout', {
        currency: CART.cost.subtotalAmount.currencyCode || 'AED',
        value: Number(CART.cost.subtotalAmount.amount) || 0,
        items: ns.map(function (l, i) { var m = l.merchandise || {}, pr = m.product || {};
          return { item_id: pr.handle || m.id, item_name: pr.title || '', item_variant: m.title || '', index: i,
            price: (Number(l.cost && l.cost.totalAmount && l.cost.totalAmount.amount) || 0) / (l.quantity || 1), quantity: l.quantity || 1 }; })
      });
    } catch (e) {}
  }
  function giftAttrs() {
    try { var g = JSON.parse(localStorage.getItem('sb_gift') || 'null'); if (g && CART && g.cart === CART.id && g.on) return [{ key: 'Gift', value: 'Yes' }].concat(g.hide ? [{ key: 'Hide prices', value: 'Yes' }] : []); } catch (e) {}
    return [];
  }
  function saveAttrs() {
    var a = window.sbAttr ? window.sbAttr() : [];
    if (!CART || !CART.id || !a.length) return Promise.resolve();
    /* 29 Oct 2026: already on the cart (cartCreate carried them) and no gift flag to add - nothing to wait for */
    if (!giftAttrs().length && ATTR_OK === attrKey(CART.id, a)) return Promise.resolve();
    return sf('mutation($id:ID!,$a:[AttributeInput!]!){cartAttributesUpdate(cartId:$id,attributes:$a){cart{id}userErrors{message}}}', { id: CART.id, a: giftAttrs().concat(a) }).catch(function () {});
  }
  /* Buy now: attributes and begin_checkout, then checkout; never waits more than a second */
  /* 30 Oct 2026 (RTL QA S11): from an Arabic page, ask Shopify for the Arabic checkout. Shopify
     serves it when Arabic is published in the store's languages; otherwise it falls back to the
     default language, so the parameter is harmless either way. */
  function coUrl(url) {
    if (!AR || !url || /[?&]locale=/.test(url)) return url;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'locale=ar';
  }
  function goCheckout(url) {
    url = coUrl(url);
    beginCheckout();
    var done = false; function nav() { if (done) return; done = true; location.href = url; }
    saveAttrs().then(nav, nav); setTimeout(nav, 1000);
  }
  window.SahraCart = {
    add: add, open: open, close: close, variants: variants, goCheckout: goCheckout, swap: swap, peek: showPeek,
    refresh: function () { return refresh().then(afterMutation); },
    setQty: setQty, remove: function (l) { return setQty(l, 0); },
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
  /* 16 Oct 2026 (Faheem): no WhatsApp button on guide pages (places, topic guides, hikes). Visitors read it
     as a tour desk and wrote in to book trips; the guides now say we are a clothing brand instead. */
  var de = document.documentElement;
  if (de && de.hasAttribute && de.hasAttribute('data-guide')) return;

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

    /* Phones (24 Sep): out of the way while the reader is scrolling through copy,
       back as soon as they stop - it was sitting on words, table cells and headings. */
    if (window.matchMedia && matchMedia('(max-width:700px)').matches) {
      /* 13 Oct 2026 (retention audit): not in the first screen. It sat on the photograph a
         paid visitor had just arrived for; it appears after the first real scroll. */
      if ((window.pageYOffset || 0) < 200) {
        a.classList.add('pre');
        var firstScroll = function () { if ((window.pageYOffset || 0) >= 200) { a.classList.remove('pre'); window.removeEventListener('scroll', firstScroll); } };
        window.addEventListener('scroll', firstScroll, { passive: true });
      }
      var idle = null, lastY = window.pageYOffset;
      window.addEventListener('scroll', function () {
        var y = window.pageYOffset;
        if (Math.abs(y - lastY) > 6) a.classList.add('resting');
        lastY = y; clearTimeout(idle);
        idle = setTimeout(function () { a.classList.remove('resting'); }, 900);
      }, { passive: true });
    }

    /* Phones, product page (25 Sep 2026): out of the way while Add to cart is on screen -
       it sat on the right edge of the button in the first screen. */
    var addBtn = document.getElementById('pdpAdd');
    if (addBtn && 'IntersectionObserver' in window && window.matchMedia && matchMedia('(max-width:700px)').matches) {
      new IntersectionObserver(function (e) { a.classList.toggle('near-add', e[0].isIntersecting); }).observe(addBtn);
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

/* ==========================================================================
   Floating cart button on phones (24 Sep 2026, Faheem: "There needs to be a
   floating cart button showing number of items added so users can instantly
   go to their cart instead of scrolling back up").

   - phones only (700px and under), and only once the cart has something in it
   - hidden while the header's own cart button is on screen, so there are
     never two cart buttons in view
   - bottom right, in the thumb zone; the WhatsApp button moves up one step to
     make room, and both sit above the product page's sticky buy bar
   - the count bumps when it changes; steps aside for the drawer and the menu
   ========================================================================== */
(function () {
  if (document.getElementById('sbFcart')) return;
  var mq = window.matchMedia ? matchMedia('(max-width:700px)') : null;
  var count = 0, hdrVisible = true, b, num;

  function build() {
    if (document.getElementById('sbFcart')) return;
    b = document.createElement('button');
    b.id = 'sbFcart'; b.className = 'sb-fcart'; b.type = 'button';
    b.setAttribute('aria-label', 'Open cart');
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 7h12l-1.2 12.1a2 2 0 0 1-2 1.9H9.2a2 2 0 0 1-2-1.9L6 7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 9.5V6.5a3 3 0 0 1 6 0v3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' +
      '<span class="sb-fcart-n" aria-hidden="true">0</span>';
    num = b.querySelector('.sb-fcart-n');
    b.addEventListener('click', function () { if (window.SahraCart) window.SahraCart.open(); });
    document.body.appendChild(b);

    /* the header cart: while it is on screen, this button stays hidden */
    var hc = document.getElementById('sbCartBtn') || document.getElementById('cartBtn') || document.querySelector('.hdr-cart');
    if (hc && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { hdrVisible = e[0].isIntersecting; sync(); }, { threshold: 0.6 }).observe(hc);
    } else hdrVisible = false;

    var bar = document.getElementById('buybar'), drawer = document.getElementById('sbDrawer');
    if (window.MutationObserver) {
      var qd = 0; new MutationObserver(function () { if (!qd) qd = requestAnimationFrame(function () { qd = 0; sync(); }); }).observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['class'] });
    }
    var st = window.SahraCart && window.SahraCart.state && window.SahraCart.state();
    if (st && st.totalQuantity) set(st.totalQuantity);
    sync();
  }
  function set(n) {
    n = n || 0;
    var up = n > count;
    count = n;
    if (!b) return;
    num.textContent = n > 99 ? '99+' : n;
    b.setAttribute('aria-label', n ? 'Open cart, ' + n + ' item' + (n === 1 ? '' : 's') : 'Open cart');
    if (up) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
    sync();
  }
  var syncing = false;
  function sync() {
    if (!b || syncing) return; syncing = true;
    var phone = !mq || mq.matches;
    var drawerOn = !!document.querySelector('#sbDrawer.on'), menuOn = !!document.querySelector('.m-panel.open');
    var bar = document.getElementById('buybar');
    var show = phone && count > 0 && !hdrVisible && !drawerOn && !menuOn;
    if (b.classList.contains('on') !== show) b.classList.toggle('on', show);
    var lift = !!(bar && bar.classList.contains('on'));
    if (b.classList.contains('lift') !== lift) b.classList.toggle('lift', lift);
    var cls = document.documentElement && document.documentElement.classList;
    if (cls && cls.contains('sb-fcart-on') !== show) cls.toggle('sb-fcart-on', show);
    syncing = false;
  }
  document.addEventListener('sb:cartcount', function (e) { set(e.detail); });
  if (mq && mq.addEventListener) mq.addEventListener('change', sync);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();

/* ==========================================================================
   Tabby (15 Oct 2026). Tabby is live at the Shopify checkout. Faheem chose Tabby's
   official on-site widget (TabbyPromo) after three marketing experts agreed on the
   placements: one quiet line under the price on product pages, a Tabby chip with the
   payment chips, a line under the cart subtotal, and an FAQ answer. Nothing in the top
   bar, on the homepage or on shop cards.

   TABBY_PUBLIC_KEY / TABBY_MERCHANT_CODE: Faheem's PUBLIC key (pk_...) and merchant
   code from the Tabby merchant dashboard. Never the secret key. While either is empty,
   every slot keeps the plain line written into the page ("Pay in 4 with Tabby: 4
   interest-free payments of AED 49.75"), with the same maths the widget uses.
   Tabby is a UAE (AED) payment method here, so the slots are hidden for visitors on
   the GCC or international market (sahra-cart.css).
   ========================================================================== */
(function () {
  var TABBY_PUBLIC_KEY = 'pk_01a13f6c-8f17-7de2-8a9c-3a8416dd149a';   /* public key (pk_), safe in page code; never the secret sk_ key */
  var TABBY_MERCHANT_CODE = 'default';   /* Tabby's own Shopify snippet uses "default" for AED stores; replace it if Tabby issued a store-specific code */
  var SCRIPT = 'https://checkout.tabby.ai/tabby-promo.js';
  var ready = null, n = 0;

  function aed(p) { var v = Math.round(p * 100) / 100; return 'AED ' + (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2)); }
  function staticLine(el, price) {
    if (!(price > 0)) { el.hidden = true; return; }
    el.hidden = false;
    if (el.getAttribute('data-tabby-lang') === 'ar') { el.hidden = true; return; }   /* Arabic copy comes from Tabby's widget only, never our translation */
    el.innerHTML = '<span class="sb-tabby-t">Pay in 4 with <b>Tabby</b>: 4 interest-free payments of ' + aed(price / 4) + '</span>';
  }
  function load() {
    if (ready) return ready;
    ready = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = SCRIPT; s.async = true;
      s.onload = function () { window.TabbyPromo ? res() : rej(); }; s.onerror = rej;
      document.head.appendChild(s);
    });
    return ready;
  }
  function widget(el, price) {
    if (!TABBY_PUBLIC_KEY || !TABBY_MERCHANT_CODE || !(price > 0)) return;
    load().then(function () {
      if (!el.id) el.id = 'sbTabby' + (++n);
      var box = document.createElement('div'); box.id = el.id + 'w'; box.className = 'sb-tabby-w';
      el.innerHTML = ''; el.appendChild(box);
      try {
        new window.TabbyPromo({ selector: '#' + box.id, currency: 'AED', price: price.toFixed(2),
          lang: el.getAttribute('data-tabby-lang') === 'ar' ? 'ar' : 'en', source: el.getAttribute('data-tabby-source') || 'product',
          shouldInheritBg: true, publicKey: TABBY_PUBLIC_KEY, merchantCode: TABBY_MERCHANT_CODE });
        el.hidden = false; el.classList.add('is-widget');
      } catch (e) { staticLine(el, price); }
    }, function () { /* script blocked or offline: the plain line stays */ });
  }
  function set(el, price) {
    if (el.classList.contains('is-widget') && el.getAttribute('data-tabby-price') === String(price)) { el.hidden = false; return; }   /* same total: keep the widget, no flicker */
    el.classList.remove('is-widget');
    el.setAttribute('data-tabby-price', String(price));
    staticLine(el, price);
    widget(el, price);
  }
  window.SB_TABBY = { set: set };
  function init() {
    [].forEach.call(document.querySelectorAll('.sb-tabby[data-tabby-price]'), function (el) {
      var p = parseFloat(el.getAttribute('data-tabby-price'));
      if (el.getAttribute('data-tabby-lang') === 'ar' && !TABBY_PUBLIC_KEY) { el.hidden = true; return; }
      /* the widget waits for the page to finish loading, so it never competes with the first photo */
      if (TABBY_PUBLIC_KEY && TABBY_MERCHANT_CODE) {
        var go = function () { setTimeout(function () { widget(el, p); }, 300); };
        if (document.readyState === 'complete') go(); else addEventListener('load', go);
      }
    });
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('.sb-tabby');
      if (t && window.track) track('tabby_click', { source: t.getAttribute('data-tabby-source') || '', price: t.getAttribute('data-tabby-price') || '' });
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
