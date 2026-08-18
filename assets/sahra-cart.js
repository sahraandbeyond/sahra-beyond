/* ==========================================================================
   sahra-cart.js — one cart for the whole site.
   ==========================================================================
   The cart used to exist only on /shop/ (and later the product pages),
   because before launch that was the only place commerce lived. Every other
   page — homepage, t-shirts, polos, places, guides — had no cart button and
   no way to add anything. This module is loaded by every page so the cart,
   its badge and its drawer are identical everywhere, and cannot drift.

   Storage key `sb_cart` is shared with /shop/ and the PDPs, so a cart started
   anywhere is the same cart everywhere and at checkout.
   ========================================================================== */
(function () {
  var S = { domain: 'sahra-beyond.myshopify.com', token: 'cc42ba8e74eb27c4f3c062d93f893fa0', v: '2024-10' };
  var CFRAG = 'id checkoutUrl totalQuantity cost{subtotalAmount{amount currencyCode}}' +
    'lines(first:50){edges{node{id quantity merchandise{... on ProductVariant{id title price{amount currencyCode}' +
    'product{title handle featuredImage{url}}}}}}}';

  function sf(q, vars) {
    return fetch('https://' + S.domain + '/api/' + S.v + '/graphql.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': S.token },
      body: JSON.stringify({ query: q, variables: vars || {} })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.errors) throw new Error(j.errors[0] && j.errors[0].message || 'storefront');
      return j.data;
    });
  }
  function cid() { try { return localStorage.getItem('sb_cart'); } catch (e) { return null; } }
  function setCid(v) { try { v ? localStorage.setItem('sb_cart', v) : localStorage.removeItem('sb_cart'); } catch (e) {} }
  function money(a, c) { return (c || 'AED') + ' ' + Math.round(parseFloat(a || 0)); }

  var CART = null;

  /* ---- UI ---------------------------------------------------------- */
  function ensureUI() {
    if (document.getElementById('sbCartBtn')) return;
    var hdr = document.querySelector('.hdr') || document.querySelector('nav');
    if (hdr) {
      var b = document.createElement('button');
      b.id = 'sbCartBtn'; b.className = 'sb-cart-btn'; b.type = 'button';
      b.setAttribute('aria-label', 'Open cart');
      b.innerHTML = '<span aria-hidden="true">&#128722;</span><span class="sb-cart-count" id="sbCartCount">0</span>';
      hdr.appendChild(b);
      b.addEventListener('click', open);
    }
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="sb-ov" id="sbOv"></div>' +
      '<aside class="sb-drawer" id="sbDrawer" aria-label="Cart" aria-hidden="true">' +
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
    addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }
  function open() { ensureUI(); document.getElementById('sbDrawer').classList.add('on'); document.getElementById('sbOv').classList.add('on'); document.getElementById('sbDrawer').setAttribute('aria-hidden','false'); document.body.style.overflow = 'hidden'; }
  function close() { var d = document.getElementById('sbDrawer'); if (!d) return; d.classList.remove('on'); d.setAttribute('aria-hidden','true'); document.getElementById('sbOv').classList.remove('on'); document.body.style.overflow = ''; }

  function badge(n) {
    var c = document.getElementById('sbCartCount');
    if (c) { c.textContent = n || 0; c.style.display = n ? 'flex' : 'none'; }
  }
  function draw() {
    ensureUI();
    var body = document.getElementById('sbBody'), foot = document.getElementById('sbFoot');
    if (!body || !foot) return;
    var lines = CART && CART.lines ? CART.lines.edges.map(function (e) { return e.node; }) : [];
    badge(CART ? CART.totalQuantity : 0);
    if (!lines.length) { body.innerHTML = '<p class="sb-empty">Your cart is empty.</p>'; foot.hidden = true; return; }
    body.innerHTML = lines.map(function (l) {
      var m = l.merchandise, img = m.product.featuredImage ? m.product.featuredImage.url : '';
      return '<div class="sb-line">' +
        (img ? '<img src="' + img + '" alt="" width="60" height="75">' : '<span class="sb-noimg"></span>') +
        '<div class="sb-lt"><a href="/products/' + m.product.handle + '/">' + m.product.title + '</a>' +
        '<span>Size ' + m.title + '</span><span>' + money(m.price.amount, m.price.currencyCode) + '</span></div>' +
        '<button class="sb-rm" data-line="' + l.id + '" aria-label="Remove">&#10005;</button></div>';
    }).join('');
    document.getElementById('sbSub').textContent = money(CART.cost.subtotalAmount.amount, CART.cost.subtotalAmount.currencyCode);
    document.getElementById('sbGo').href = CART.checkoutUrl;
    foot.hidden = false;
    body.querySelectorAll('.sb-rm').forEach(function (b) {
      b.addEventListener('click', function () { remove(b.dataset.line); });
    });
  }
  function remove(lineId) {
    if (!CART) return;
    sf('mutation($id:ID!,$l:[ID!]!){cartLinesRemove(cartId:$id,lineIds:$l){cart{' + CFRAG + '}}}', { id: CART.id, l: [lineId] })
      .then(function (d) { CART = d.cartLinesRemove.cart; draw(); }).catch(function () {});
  }

  /* ---- public API --------------------------------------------------- */
  function add(variantId) {
    ensureUI();
    var id = cid();
    var p = id
      ? sf('mutation($id:ID!,$l:[CartLineInput!]!){cartLinesAdd(cartId:$id,lines:$l){cart{' + CFRAG + '}userErrors{message}}}', { id: id, l: [{ merchandiseId: variantId, quantity: 1 }] })
          .then(function (d) { var c = d.cartLinesAdd && d.cartLinesAdd.cart; if (!c) throw new Error('stale'); return c; })
      : Promise.reject(new Error('none'));
    return p.catch(function () {
      return sf('mutation($l:[CartLineInput!]!){cartCreate(input:{lines:$l}){cart{' + CFRAG + '}}}', { l: [{ merchandiseId: variantId, quantity: 1 }] })
        .then(function (d) { return d.cartCreate.cart; });
    }).then(function (c) { CART = c; setCid(c.id); draw(); open(); return c; });
  }
  function refresh() {
    var id = cid(); if (!id) { badge(0); return Promise.resolve(null); }
    return sf('query($id:ID!){cart(id:$id){' + CFRAG + '}}', { id: id })
      .then(function (d) { CART = d.cart; if (!CART) setCid(null); badge(CART ? CART.totalQuantity : 0); return CART; })
      .catch(function () { return null; });
  }
  function variants(handle) {
    return sf('query($h:String!){product(handle:$h){variants(first:20){edges{node{id title availableForSale}}}}}', { h: handle })
      .then(function (d) { return d.product ? d.product.variants.edges.map(function (e) { return e.node; }) : []; });
  }

  window.SahraCart = { add: add, open: open, close: close, refresh: refresh, variants: variants };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { ensureUI(); refresh(); });
  else { ensureUI(); refresh(); }
})();

/* ==========================================================================
   Quick-add on product cards.
   Category pages (/t-shirts/, /polos/) and the homepage list products but
   previously offered no way to buy — the reader had to go to /shop/ and find
   the same product again. Each card now reveals its real sizes in place.
   ========================================================================== */
(function () {
  function init() {
    var cards = document.querySelectorAll('.pcard[data-handle], .card[data-handle]');
    if (!cards.length) return;
    cards.forEach(function (card) {
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
              b.textContent = '…';
              window.SahraCart.add(v.id).then(function () { b.textContent = v.title; })
                .catch(function () { b.textContent = v.title; });
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
