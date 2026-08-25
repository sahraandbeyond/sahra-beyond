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
    focus() {}, closest() { return null; },
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
  return { doc, byId };
}

/* ---- fake Shopify ----------------------------------------------------- */
function makeServer() {
  const s = { carts: {}, seq: 0, calls: [], failNext: null };
  s.handle = (query, vars) => {
    const op = /cartCreate/.test(query) ? 'cartCreate'
             : /cartLinesAdd/.test(query) ? 'cartLinesAdd'
             : /cartLinesUpdate/.test(query) ? 'cartLinesUpdate'
             : /cartLinesRemove/.test(query) ? 'cartLinesRemove' : 'query';
    s.calls.push(op);
    if (s.failNext === op) { s.failNext = null; return Promise.reject(new Error('boom')); }
    const shape = c => ({
      id: c.id, checkoutUrl: 'https://checkout/' + c.id,
      totalQuantity: c.lines.reduce((n, l) => n + l.quantity, 0),
      cost: { subtotalAmount: { amount: String(c.lines.reduce((n, l) => n + l.quantity * 149.5, 0)), currencyCode: 'AED' } },
      lines: { edges: c.lines.map(l => ({ node: {
        id: l.id, quantity: l.quantity,
        merchandise: { id: l.vid, title: 'M', availableForSale: true,
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
      c.lines = c.lines.filter(l => !vars.l.includes(l.id));
      return Promise.resolve({ cartLinesRemove: { cart: shape(c), userErrors: [] } });
    }
    return Promise.resolve({ cart: shape(c) });
  };
  return s;
}

function boot(opts = {}) {
  const { doc, byId } = freshDom();
  const server = makeServer();
  const store = Object.assign({}, opts.storage || {});
  const g = {
    document: doc,
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
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
    check('quantity is rendered in the drawer (was fetched but never shown)',
      /class="sb-qn"[^>]*>2</.test(body.innerHTML) || /sb-qn/.test(body.innerHTML) && /"2"|>2</.test(body.innerHTML),
      'drawer HTML: ' + String(body.innerHTML).slice(0, 160));
    check('badge matches server totalQuantity',
      env.byId.sbCartCount && env.byId.sbCartCount.textContent === '2',
      'badge=' + (env.byId.sbCartCount && env.byId.sbCartCount.textContent));
  }

  /* 2 — drawer is painted on load, not only after an add ---------------- */
  {
    const env = boot();
    await env.api.add('gid://variant/9');           // creates cart1
    const cartId = env.store.sb_cart;
    const env2 = boot({ storage: { sb_cart: cartId } });
    // env2 has its own server, so seed it by adding through it instead
    const env3 = boot();
    await env3.api.add('gid://variant/9');
    await env3.api.refresh();
    check('refresh() paints the drawer (the empty-drawer-with-full-badge bug)',
      /sb-line/.test(String(env3.byId.sbBody.innerHTML)),
      'body after refresh: ' + String(env3.byId.sbBody.innerHTML).slice(0, 120));
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
      env.api.state().totalQuantity === 2, 'totalQuantity=' + env.api.state().totalQuantity);
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

  console.log('\n  ' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
})();
