#!/usr/bin/env node
/**
 * cart-test.js — regression tests for the cart. Run: node cart-test.js
 *
 * Checkout is the one thing on this site that cannot be wrong, and every bug
 * it shipped was invisible to static checks because it only existed in a
 * runtime state: a drawer that was never painted, a quantity that was fetched
 * but never rendered, two engines racing over one storage key.
 *
 * So this loads the REAL assets/sahra-cart.js into a stub DOM and drives it.
 * Each test names the customer-visible symptom it protects against.
 *
 * Wired into prepush.js.
 */
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, 'assets', 'sahra-cart.js'), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  \x1b[32m✓\x1b[0m ' + name); }
  else { fail++; console.log('  \x1b[31m✗ ' + name + '\x1b[0m' + (detail ? '\n      ' + detail : '')); }
}

/* ---- minimal DOM ----------------------------------------------------- */
function mkEl(tag) {
  const el = {
    tagName: tag, children: [], attrs: {}, dataset: {}, style: {},
    _text: '', _html: '', hidden: false, listeners: {},
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
                 contains(c) { return this._s.has(c); }, toggle() {} },
    get textContent() { return this._text; }, set textContent(v) { this._text = String(v); },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); },
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
    appendChild(c) { this.children.push(c); return c; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    focus() {},
    /* the real delegated handler calls closest('[data-act]'); returning
       null made the entire button-click path structurally untestable */
    closest(sel) { return this.attrs && this.attrs['data-act'] ? this : null; },
    get firstChild() { return this.children.length ? this.children.shift() : null; }
  };
  return el;
}
function freshDom() {
  const byId = {};
  const doc = {
    readyState: 'complete', hidden: false, activeElement: null,
    body: mkEl('body'),
    getElementById: id => byId[id] || null,
    querySelector: sel => (sel === '.hdr' || sel === 'nav') ? byId.__hdr : null,
    querySelectorAll: () => [],
    createElement: t => {
      const e = mkEl(t);
      const realSet = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e) || {}, 'innerHTML');
      Object.defineProperty(e, 'innerHTML', {
        get() { return this._html; },
        set(v) {
          this._html = String(v);
          /* register any ids so getElementById works after innerHTML writes */
          String(v).replace(/id="([^"]+)"/g, (_, id) => {
            const child = mkEl('div'); child.attrs.id = id; byId[id] = child; return _;
          });
        }
      });
      return e;
    },
    addEventListener() {}
  };
  byId.__hdr = mkEl('nav');
  /* the free-delivery meter writes into #sbFree; register it so the module
     finds it rather than creating a detached node the test cannot see */
  byId.sbFree = mkEl('div');
  return { doc, byId };
}

/* The free tote. It is a genuine cart line with a real variant id, so the fake
   server must model it as one - priced 0, with its own title - or every count
   and subtotal assertion in this file silently drifts once auto-add ships. */
const GIFT = 'gid://shopify/ProductVariant/47389880615100';
const isGiftNode = n => n && n.merchandise && n.merchandise.id === GIFT;
/* What the customer thinks is in the basket: the gift is not their doing. */
const realQty = env => (env.api.state()?.lines?.edges || [])
  .filter(e => !isGiftNode(e.node)).reduce((n, e) => n + e.node.quantity, 0);

/* ---- fake Shopify ----------------------------------------------------- */
function makeServer() {
  const s = { carts: {}, seq: 0, calls: [], failNext: null, userErrorNext: null, refuseGift: false, refuseGiftRemove: false };
  s.handle = (query, vars) => {
    const op = /cartCreate/.test(query) ? 'cartCreate'
             : /cartBuyerIdentityUpdate/.test(query) ? 'cartBuyerIdentityUpdate'
             : /cartLinesAdd/.test(query) ? 'cartLinesAdd'
             : /cartLinesUpdate/.test(query) ? 'cartLinesUpdate'
             : /cartLinesRemove/.test(query) ? 'cartLinesRemove' : 'query';
    s.calls.push(op);
    if (op === 'cartCreate') { s.lastCreateQuery = query; s.lastCreateVars = vars; }
    if (s.failNext === op) { s.failNext = null; return Promise.reject(new Error('boom')); }
    if (s.userErrorNext === op) { s.userErrorNext = null;
      return Promise.resolve({ [op]: { cart: null, userErrors: [{ message: 'Only 2 left in stock.' }] } }); }
    const shape = c => ({
      id: c.id, checkoutUrl: 'https://checkout/' + c.id,
      buyerIdentity: { countryCode: c.cc || 'AE' },
      totalQuantity: c.lines.reduce((n, l) => n + l.quantity, 0),
      cost: { subtotalAmount: { amount: String(c.lines.reduce((n, l) =>
        n + (l.vid === GIFT ? 0 : l.quantity * (c.cur === 'KWD' ? 16.55 : 149.5)), 0)), currencyCode: c.cur || 'AED' } },
      lines: { edges: c.lines.map(l => ({ node: {
        id: l.id, quantity: l.quantity,
        merchandise: l.vid === GIFT
          ? { id: GIFT, title: 'One size', availableForSale: true,
              price: { amount: '0.00', currencyCode: 'AED' },
              product: { title: 'Sahra Tote — Founding Edition gift', handle: 'sahra-tote-founding-edition-gift', featuredImage: null } }
          : { id: l.vid, title: 'M', availableForSale: true,
              price: { amount: '149.50', currencyCode: 'AED' },
              product: { title: 'Empty Quarter Tee', handle: 'empty-quarter-regular', featuredImage: null } }
      } })) }
    });
    if (op === 'cartCreate') {
      const id = 'cart' + (++s.seq);
      s.carts[id] = { id, lines: vars.l.map((l, i) => ({ id: 'line' + (++s.seq), vid: l.merchandiseId, quantity: l.quantity })) };
      return Promise.resolve({ cartCreate: { cart: shape(s.carts[id]), userErrors: [] } });
    }
    const c = s.carts[vars.id];
    if (!c) return Promise.resolve({ [op]: { cart: null, userErrors: [] }, cart: null });
    if (op === 'cartLinesAdd') {
      /* the gift is finite by design - this is what running out looks like */
      if (s.refuseGift && vars.l.some(n => n.merchandiseId === GIFT)) {
        return Promise.resolve({ cartLinesAdd: { cart: null, userErrors: [{ message: 'Sold out.' }] } });
      }
      vars.l.forEach(n => {
        const ex = c.lines.find(l => l.vid === n.merchandiseId);
        if (ex) ex.quantity += n.quantity;
        else c.lines.push({ id: 'line' + (++s.seq), vid: n.merchandiseId, quantity: n.quantity });
      });
      return Promise.resolve({ cartLinesAdd: { cart: shape(c), userErrors: [] } });
    }
    if (op === 'cartLinesUpdate') {
      vars.l.forEach(u => { const l = c.lines.find(x => x.id === u.id); if (l) l.quantity = u.quantity; });
      return Promise.resolve({ cartLinesUpdate: { cart: shape(c), userErrors: [] } });
    }
    if (op === 'cartLinesRemove') {
      /* a removal that fails leaves the tote stranded - the drawer must still
         refuse to offer checkout on a gift-only cart */
      if (s.refuseGiftRemove && vars.l.some(id => (c.lines.find(l => l.id === id) || {}).vid === GIFT)) {
        return Promise.resolve({ cartLinesRemove: { cart: null, userErrors: [{ message: 'nope' }] } });
      }
      c.lines = c.lines.filter(l => !vars.l.includes(l.id));
      return Promise.resolve({ cartLinesRemove: { cart: shape(c), userErrors: [] } });
    }
    if (op === 'cartBuyerIdentityUpdate') {
      c.cc = vars.b.countryCode;
      c.cur = ({ SA: 'SAR', KW: 'KWD', GB: 'GBP', US: 'USD' })[c.cc] || 'AED';
      return Promise.resolve({ cartBuyerIdentityUpdate: { cart: shape(c), userErrors: [] } });
    }
    return Promise.resolve({ cart: shape(c) });
  };
  return s;
}

function boot(opts = {}) {
  const { doc, byId } = freshDom();
  const server = opts.server || makeServer();
  const store = Object.assign({}, opts.storage || {});
  const g = {
    document: doc,
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      /* Safari private mode throws here. The module swallows it, which is what
         made every add fork a new cart. */
      setItem: (k, v) => { if (opts.storageThrows) throw new Error('QuotaExceeded'); store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    fetch: (url, init) => {
      const b = JSON.parse(init.body);
      return server.handle(b.query, b.variables)
        .then(data => ({ ok: true, json: () => Promise.resolve({ data }) }));
    },
    addEventListener() {}, setTimeout, clearTimeout, console
  };
  g.window = g;
  if (opts.market) g.SahraMarket = opts.market;
  const fn = new Function('window', 'document', 'localStorage', 'fetch', 'addEventListener', 'console', 'setTimeout',
    SRC + '\n;return window.SahraCart;');
  const api = fn(g, doc, g.localStorage, g.fetch, g.addEventListener, console, setTimeout);
  return { api, doc, byId, server, store };
}

console.log('\ncart-test — driving the real assets/sahra-cart.js\n');

(async function () {
  /* 1 — the reported "badge says 3, drawer says empty" ------------------ */
  {
    const s1 = makeServer();
    const env = boot();
    await env.api.add('gid://variant/1');
    await env.api.add('gid://variant/1');
    const body = env.byId.sbBody;
    /* STRICT: the visible span must contain the number. The previous
       assertion was an OR that data-qty="2" alone satisfied, so it would have
       passed with an empty quantity span - i.e. it would NOT have caught a
       reintroduction of the very bug it names. */
    check('quantity is rendered in the visible span (strict)',
      /<span class="sb-qn"[^>]*>2<\/span>/.test(String(body.innerHTML)),
      'drawer HTML: ' + String(body.innerHTML).slice(0, 200));
    check('badge matches server totalQuantity',
      env.byId.sbCartCount && env.byId.sbCartCount.textContent === '2',
      'badge=' + (env.byId.sbCartCount && env.byId.sbCartCount.textContent));
  }

  /* 2 — drawer is painted on load, not only after an add ---------------- */
  {
    /* COLD BOOT: a cart that already exists on the server, a page loaded
       fresh, and no add() in this session. That is the exact situation the
       customer was in - and the old version of this test never created it,
       because it called add() first. */
    const seed = boot();
    await seed.api.add('gid://variant/9');
    const cold = boot({ storage: { sb_cart: seed.store.sb_cart }, server: seed.server });
    /* boot() kicks off refresh() itself; let that settle. We deliberately do
       NOT call refresh() by hand here - the whole point is that a plain page
       load paints the drawer with no further action. */
    await new Promise(r => setTimeout(r, 30));
    check('cold load of an existing cart paints the drawer, not just the badge',
      /sb-line/.test(String(cold.byId.sbBody.innerHTML)),
      'body after cold refresh: ' + String(cold.byId.sbBody.innerHTML).slice(0, 140));
    check('cold load badge matches the server',
      cold.byId.sbCartCount && cold.byId.sbCartCount.textContent === '1',
      'badge=' + (cold.byId.sbCartCount && cold.byId.sbCartCount.textContent));
  }

  /* 3 — quantity stepper actually mutates ------------------------------- */
  {
    const env = boot();
    const cart = await env.api.add('gid://variant/7');
    const lineId = cart.lines.edges[0].node.id;
    await env.api.setQty(lineId, 3);
    check('setQty issues cartLinesUpdate', env.server.calls.includes('cartLinesUpdate'),
      'calls: ' + env.server.calls.join(','));
    check('badge follows a quantity change',
      env.byId.sbCartCount.textContent === '3', 'badge=' + env.byId.sbCartCount.textContent);
    await env.api.setQty(lineId, 0);
    check('quantity 0 removes the line', env.server.calls.includes('cartLinesRemove'));
    check('empty cart shows the empty state and hides the footer',
      /sb-empty/.test(String(env.byId.sbBody.innerHTML)) && env.byId.sbFoot.hidden === true);
  }

  /* 4 — the race that silently destroyed carts -------------------------- */
  {
    const env = boot();
    await Promise.all([env.api.add('gid://variant/A'), env.api.add('gid://variant/B')]);
    const creates = env.server.calls.filter(c => c === 'cartCreate').length;
    check('two simultaneous adds create ONE cart, not two',
      creates === 1, 'cartCreate calls: ' + creates + ' (' + env.server.calls.join(',') + ')');
    check('both items survive the race',
      realQty(env) === 2, 'real qty=' + realQty(env) + ' totalQuantity=' + env.api.state().totalQuantity);
  }

  /* 5 — money must not round away fils at the AED 150 threshold --------- */
  {
    const env = boot();
    await env.api.add('gid://variant/Z');            // 149.50
    const sub = env.byId.sbSub.textContent;
    check('subtotal shows fils (149.50 must not display as 150)',
      sub === 'AED 149.50', 'subtotal rendered as: ' + sub);
  }

  /* 6 — a dead cart id must not leave a phantom badge ------------------- */
  {
    const env = boot({ storage: { sb_cart: 'cart-that-no-longer-exists' } });
    await env.api.refresh();
    check('unknown cart id is cleared from storage', env.store.sb_cart === undefined,
      'sb_cart=' + env.store.sb_cart);
    check('badge reads 0 after a dead cart', env.byId.sbCartCount.textContent === '0');
  }


  /* 7 — a refused line must NOT destroy the basket (found in review) ----- */
  {
    const env = boot();
    await env.api.add('gid://variant/keep');
    await env.api.add('gid://variant/keep');          // 2 items safely in the cart
    const before = env.api.state().id;
    env.server.userErrorNext = 'cartLinesAdd';        // next add is refused: sold out
    let threw = false;
    try { await env.api.add('gid://variant/soldout'); } catch (e) { threw = true; }
    check('a refused add reports an error rather than resolving silently', threw);
    check('a refused add does NOT replace the existing cart',
      env.api.state() && env.api.state().id === before,
      'cart id before=' + before + ' after=' + (env.api.state() && env.api.state().id));
    check('the basket survives a refused add',
      realQty(env) === 2, 'real qty=' + realQty(env));
    check("Shopify's own message is shown to the customer",
      /Only 2 left in stock\./.test(String(env.byId.sbBody.innerHTML)),
      'drawer: ' + String(env.byId.sbBody.innerHTML).slice(0, 160));
  }

  /* 8 — a network failure must not destroy the basket either ------------- */
  {
    const env = boot();
    await env.api.add('gid://variant/a');
    const before = env.api.state().id;
    env.server.failNext = 'cartLinesAdd';
    try { await env.api.add('gid://variant/b'); } catch (e) {}
    check('a network failure does NOT replace the existing cart',
      env.api.state() && env.api.state().id === before,
      'id before=' + before + ' after=' + (env.api.state() && env.api.state().id));
  }

  /* 9 — localStorage refusing writes must not fork the cart -------------- */
  {
    const env = boot({ storageThrows: true });
    await env.api.add('gid://variant/x');
    await env.api.add('gid://variant/y');
    const creates = env.server.calls.filter(c => c === 'cartCreate').length;
    check('storage failure (Safari private mode) still keeps ONE cart',
      creates === 1, 'cartCreate calls: ' + creates);
    check('both items survive when storage is unavailable',
      realQty(env) === 2, 'real qty=' + realQty(env));
  }

  /* 10 — rapid + taps must accumulate, through the REAL click path ------- */
  {
    const env = boot();
    const cart = await env.api.add('gid://variant/q');
    const lineId = cart.lines.edges[0].node.id;
    const body = env.byId.sbBody;
    const handler = body.listeners.click[0];
    const btn = { attrs: { 'data-act': 'inc', 'data-line': lineId, 'data-qty': '1' },
                  getAttribute(k) { return this.attrs[k]; },
                  closest() { return this; } };
    handler({ target: btn });   /* three taps before any response lands */
    handler({ target: btn });
    handler({ target: btn });
    await new Promise(r => setTimeout(r, 30));
    check('three rapid + taps reach quantity 4, not 2',
      realQty(env) === 4,
      'real qty=' + realQty(env) + ' totalQuantity=' + env.api.state().totalQuantity);
  }

  /* 22 — international: cartCreate must carry buyerIdentity ------------- */
  {
    const env = boot();
    await env.api.add('gid://x/1', 1);
    check('cartCreate sends buyerIdentity with a country',
      /buyerIdentity/.test(env.server.lastCreateQuery || ''),
      'mutation lacked buyerIdentity');
    check('default buyer country is AE (site behaves as its UAE self)',
      env.server.lastCreateVars && env.server.lastCreateVars.cc === 'AE',
      'cc=' + (env.server.lastCreateVars && env.server.lastCreateVars.cc));
  }

  /* 23 — setCountry BEFORE any cart exists: no wasted mutation, but the
     next cartCreate must inherit the country. A GCC visitor whose first act
     is adding to cart should never get an AED cart re-priced afterwards. */
  {
    const env = boot();
    await env.api.setCountry('SA');
    check('setCountry with no cart makes no API call',
      env.server.calls.length === 0,
      'calls: ' + env.server.calls.join(','));
    await env.api.add('gid://x/1', 1);
    check('cartCreate after setCountry carries the new country',
      env.server.lastCreateVars && env.server.lastCreateVars.cc === 'SA',
      'cc=' + (env.server.lastCreateVars && env.server.lastCreateVars.cc));
  }

  /* 24 — setCountry WITH a cart re-points it and re-prices the drawer.
     The page, the drawer and checkout must never tell different stories. */
  {
    const env = boot();
    await env.api.add('gid://x/1', 1);
    await env.api.setCountry('KW');
    check('existing cart gets cartBuyerIdentityUpdate',
      env.server.calls.includes('cartBuyerIdentityUpdate'),
      'calls: ' + env.server.calls.join(','));
    check('cart state now carries the new currency',
      env.api.state() && env.api.state().cost.subtotalAmount.currencyCode === 'KWD',
      'currency=' + (env.api.state() && env.api.state().cost.subtotalAmount.currencyCode));
    const sub = env.byId.sbSub && env.byId.sbSub.textContent;
    check('three-decimal currency renders 3dp (KWD 16.550, not 16.55)',
      sub === 'KWD 16.550',
      'subtotal rendered: ' + sub);
  }

  /* 25 — a second setCountry to the same country is a no-op ------------- */
  {
    const env = boot();
    await env.api.add('gid://x/1', 1);
    await env.api.setCountry('SA');
    const n = env.server.calls.filter(c => c === 'cartBuyerIdentityUpdate').length;
    await env.api.setCountry('SA');
    check('repeat setCountry to same country makes no extra call',
      env.server.calls.filter(c => c === 'cartBuyerIdentityUpdate').length === n,
      'calls: ' + env.server.calls.join(','));
  }

  /* 26 — BUG 8: a persisted cart remembers a country the fresh page does not.
     Homepage said AED, checkout said GBP: the cart on Shopify still carried
     buyerIdentity GB from an earlier currency experiment, while each new page
     booted BUYER_CC='AE' — so the dedupe guard refused to re-point it, and
     refresh() never read the cart's country to notice. The fetched cart is
     the truth; refresh must sync from it and reconcile with the market. */
  {
    const server = makeServer();
    server.carts.cartGB = { id: 'cartGB', cc: 'GB', cur: 'GBP',
      lines: [{ id: 'lineg', vid: 'gid://x/1', quantity: 1 }] };
    const env = boot({ server, storage: { sb_cart: 'cartGB' },
      market: { buyerCountry: () => 'AE', country: () => 'AE', currency: () => 'AED' } });
    await new Promise(r => setTimeout(r, 30));
    check('stale GB cart is re-pointed to AE on refresh',
      env.server.calls.includes('cartBuyerIdentityUpdate'),
      'calls: ' + env.server.calls.join(','));
    check('checkout currency is AED again after reconciliation',
      env.api.state() && env.api.state().cost.subtotalAmount.currencyCode === 'AED',
      'currency=' + (env.api.state() && env.api.state().cost.subtotalAmount.currencyCode));
  }

  /* 27 — and the reconciliation must NOT fire when nothing is stale ------- */
  {
    const server = makeServer();
    server.carts.cartAE = { id: 'cartAE', cc: 'AE',
      lines: [{ id: 'linea', vid: 'gid://x/1', quantity: 1 }] };
    const env = boot({ server, storage: { sb_cart: 'cartAE' },
      market: { buyerCountry: () => 'AE', country: () => 'AE', currency: () => 'AED' } });
    await new Promise(r => setTimeout(r, 30));
    check('matching cart triggers no buyerIdentity mutation',
      !env.server.calls.includes('cartBuyerIdentityUpdate'),
      'calls: ' + env.server.calls.join(','));
  }

  /* 28 — UAE delivery is free with NO minimum (1 Sep 2026). The meter must
         never tell a UAE shopper they are short of a threshold. ------------ */
  {
    const env = boot({ market: { market: () => 'uae', currency: () => 'AED' } });
    await env.api.add('gid://variant/Z');            // 149.50 - under the OLD 150
    const html = String(env.byId.sbFree.innerHTML);
    check('UAE cart never shows a distance to free delivery',
      !/away from free delivery/.test(html), 'meter: ' + html.slice(0, 160));
    check('UAE cart states delivery is free', /Free next-day delivery/.test(html),
      'meter: ' + html.slice(0, 160));
  }

  /* 29 — the GCC AED 390 threshold is untouched and still counts down ---- */
  {
    const env = boot({ market: { market: () => 'gcc', currency: () => 'AED' } });
    await env.api.add('gid://variant/Z');            // 149.50 of 390
    const html = String(env.byId.sbFree.innerHTML);
    check('GCC cart still counts toward AED 390',
      /away from free delivery/.test(html), 'meter: ' + html.slice(0, 160));
  }

  /* 30 — the free tote rides along with any real item ------------------- */
  {
    const env = boot();
    await env.api.add('gid://variant/1');
    const gifts = (env.api.state().lines.edges || []).filter(e => isGiftNode(e.node));
    check('a real item auto-adds the tote', gifts.length === 1, 'gift lines: ' + gifts.length);
    if (gifts[0]) {
      check('the tote is free', gifts[0].node.merchandise.price.amount === '0.00');
      check('the tote is quantity 1', gifts[0].node.quantity === 1);
    }
    check('the tote does not inflate the badge',
      env.byId.sbCartCount.textContent === '1', 'badge=' + env.byId.sbCartCount.textContent);
    check('the tote adds nothing to the subtotal',
      env.byId.sbSub.textContent === 'AED 149.50', 'subtotal=' + env.byId.sbSub.textContent);
  }

  /* 31 — it renders as a gift: no link, no quantity, no remove ---------- */
  {
    const env = boot();
    await env.api.add('gid://variant/1');
    const html = String(env.byId.sbBody.innerHTML);
    const giftBlock = html.slice(html.indexOf('sb-gift'));
    check('the tote is labelled as a gift', /yours free/.test(html), html.slice(0, 200));
    check('the tote has no remove control', !/sb-gift[\s\S]*?data-act="rm"/.test(html));
    check('the tote has no quantity control', !/sb-gift[\s\S]*?data-act="inc"/.test(html));
    check('the tote is not linked to a product page',
      !/sb-gift[\s\S]*?href="\/products\/sahra-tote/.test(html));
  }

  /* 32 — removing the last real item takes the tote with it ------------- */
  {
    const env = boot();
    const cart = await env.api.add('gid://variant/1');
    const real = cart.lines.edges.find(e => !isGiftNode(e.node));
    await env.api.remove(real.node.id);
    const after = env.api.state();
    check('the tote leaves when the last real item does',
      (after.lines.edges || []).filter(e => isGiftNode(e.node)).length === 0,
      'lines left: ' + JSON.stringify((after.lines.edges || []).map(e => e.node.merchandise.id)));
  }

  /* 33 — THE ONE THAT MATTERS. Stock is finite, so the gift WILL be
         refused one day. That must never cost the customer their basket. */
  {
    const server = makeServer(); server.refuseGift = true;
    const env = boot({ server });
    const cart = await env.api.add('gid://variant/1');
    check('a refused tote still leaves the real item in the cart',
      realQty(env) === 1, 'real qty=' + realQty(env));
    check('a refused tote adds no gift line',
      (env.api.state().lines.edges || []).filter(e => isGiftNode(e.node)).length === 0);
    check('a refused tote shows the customer no error',
      !/sb-err/.test(String(env.byId.sbBody.innerHTML)),
      String(env.byId.sbBody.innerHTML).slice(0, 200));
    check('a refused tote still resolves the add', !!cart);
  }

  /* 34 — never two totes, however many items are added ------------------ */
  {
    const env = boot();
    await env.api.add('gid://variant/1');
    await env.api.add('gid://variant/2');
    await env.api.add('gid://variant/3');
    check('only ever one tote in the cart',
      (env.api.state().lines.edges || []).filter(e => isGiftNode(e.node)).length === 1,
      'gift lines: ' + (env.api.state().lines.edges || []).filter(e => isGiftNode(e.node)).length);
  }

  /* 35 — THE REPORTED BUG (Faheem, 1 Sep): removing the last item with the
         drawer's own x button left the tote behind with checkout live. The
         handler calls the INTERNAL setQty, so wrapping only window.SahraCart
         missed the commonest path of all. Drive the real click handler. */
  {
    const env = boot();
    const cart = await env.api.add('gid://variant/1');
    const real = cart.lines.edges.find(e => !isGiftNode(e.node));
    const handler = env.byId.sbBody.listeners.click[0];
    const x = { attrs: { 'data-act': 'rm', 'data-line': real.node.id },
                getAttribute(k) { return this.attrs[k]; }, closest() { return this; } };
    handler({ target: x });
    await new Promise(r => setTimeout(r, 60));
    const left = (env.api.state().lines.edges || []).map(e => e.node.merchandise.id);
    check('the x button removes the tote along with the last item',
      left.length === 0, 'lines left: ' + JSON.stringify(left));
    check('no checkout is offered once the cart is empty',
      env.byId.sbFoot.hidden === true, 'foot hidden=' + env.byId.sbFoot.hidden);
  }

  /* 36 — and the - button, same internal path ---------------------------- */
  {
    const env = boot();
    const cart = await env.api.add('gid://variant/1');
    const real = cart.lines.edges.find(e => !isGiftNode(e.node));
    const handler = env.byId.sbBody.listeners.click[0];
    const minus = { attrs: { 'data-act': 'dec', 'data-line': real.node.id, 'data-qty': '1' },
                    getAttribute(k) { return this.attrs[k]; }, closest() { return this; } };
    handler({ target: minus });
    await new Promise(r => setTimeout(r, 60));
    check('decrementing to zero also takes the tote',
      (env.api.state().lines.edges || []).length === 0,
      'lines left: ' + JSON.stringify((env.api.state().lines.edges || []).map(e => e.node.merchandise.id)));
  }

  /* 37 — belt and braces: if the tote CANNOT be removed, the drawer must
         still refuse to present an AED 0 cart as orderable ---------------- */
  {
    const server = makeServer();
    const env = boot({ server });
    const cart = await env.api.add('gid://variant/1');
    const real = cart.lines.edges.find(e => !isGiftNode(e.node));
    server.refuseGiftRemove = true;
    await env.api.remove(real.node.id);
    const left = (env.api.state().lines.edges || []).map(e => e.node.merchandise.id);
    check('a stranded tote is still in the cart for this test', left.length === 1 && left[0] === GIFT,
      'lines: ' + JSON.stringify(left));
    check('a gift-only cart renders as empty',
      /sb-empty/.test(String(env.byId.sbBody.innerHTML)), String(env.byId.sbBody.innerHTML).slice(0, 160));
    check('a gift-only cart offers no checkout', env.byId.sbFoot.hidden === true,
      'foot hidden=' + env.byId.sbFoot.hidden);
  }

  console.log('\n  ' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
})();
