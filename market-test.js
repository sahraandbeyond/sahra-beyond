#!/usr/bin/env node
/**
 * market-test.js — regression tests for assets/sahra-market.js. Run: node market-test.js
 *
 * The market layer decides what a visitor is told about delivery and what
 * number appears next to every product. Its two contracts:
 *
 *   1. RESOLUTION — country → market → default currency must be right,
 *      because the wrong band promises free UAE next-day delivery to a
 *      shopper in Riyadh, who is quoted AED 50 and a 3-5 day wait.
 *   2. THE GATE — a price is only ever rewritten if Shopify answered in the
 *      currency we asked for. Pre-Shopify-Payments the store prices AED only,
 *      and showing a "converted" number that checkout then contradicts is a
 *      refund request waiting to happen. The gate is tested in both
 *      directions: honoured repaints, unhonoured leaves AED alone.
 *
 * Loads the REAL assets/sahra-market.js into a stub DOM. Wired into prepush.js.
 */
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, 'assets', 'sahra-market.js'), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  \x1b[32m✓\x1b[0m ' + name); }
  else { fail++; console.log('  \x1b[31m✗ ' + name + '\x1b[0m' + (detail ? '\n      ' + detail : '')); }
}

function mkPrice(handle, aed) {
  return {
    nodeType: 1, _text: 'AED ' + aed,
    attrs: { 'data-handle': handle, 'data-aed': String(aed) },
    getAttribute(k) { return this.attrs[k] || null; },
    setAttribute(k, v) { this.attrs[k] = v; },
    get textContent() { return this._text; }, set textContent(v) { this._text = String(v); },
    matches() { return false; }, querySelector() { return null; }
  };
}
function mkSlot() {
  return {
    nodeType: 1, children: [],
    appendChild(c) { this.children.push(c); return c; },
    querySelector(sel) {
      const find = n => {
        if (!n) return null;
        if (n.tagName === 'select' && sel === 'select') return n;
        for (const k of (n.children || [])) { const r = find(k); if (r) return r; }
        return null;
      };
      for (const k of this.children) { const r = find(k); if (r) return r; }
      return null;
    }
  };
}

function boot(opts) {
  // opts: { geo, currencies: {SAR:'SA',...}, priceCurrency: what product query answers in,
  //         priceAmount, prices: [nodes], slots: [nodes], session: {}, local: {} }
  const session = opts.session || {};
  const local = opts.local || {};
  const els = [];
  function mkEl(tag) {
    const e = {
      tagName: tag, children: [], value: '', className: '', attrs: {}, listeners: {},
      setAttribute(k, v) { this.attrs[k] = v; },
      appendChild(c) { this.children.push(c); return c; },
      addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
      set textContent(v) { this._text = v; }, get textContent() { return this._text; }
    };
    els.push(e); return e;
  }
  const docListeners = {};
  const doc = {
    readyState: 'complete',
    documentElement: {
      attrs: {},
      setAttribute(k, v) { this.attrs[k] = v; },
      getAttribute(k) { return this.attrs[k] || null; }
    },
    createElement: mkEl,
    querySelectorAll(sel) {
      if (sel.indexOf('.sb-price') === 0) return opts.prices || [];
      if (sel.indexOf('data-sb-curslot') !== -1) return opts.slots || [];
      if (sel === '.sb-curpick') return [];
      return [];
    },
    addEventListener(t, f) { (docListeners[t] = docListeners[t] || []).push(f); },
    dispatchEvent(ev) { (docListeners[ev.type] || []).forEach(f => f(ev)); events.push(ev); return true; }
  };
  const events = [];
  const g = {
    document: doc,
    sessionStorage: { getItem: k => (k in session ? session[k] : null), setItem: (k, v) => { session[k] = String(v); } },
    localStorage: { getItem: k => (k in local ? local[k] : null), setItem: (k, v) => { local[k] = String(v); } },
    CustomEvent: function (type, init) { this.type = type; this.detail = init && init.detail; },
    MutationObserver: function () { this.observe = function () {}; },
    clearTimeout, setTimeout, console,
    fetch(url, init) {
      if (String(url).indexOf('/api/geo') === 0) {
        return Promise.resolve({ json: () => Promise.resolve({ c: opts.geo || 'AE' }) });
      }
      const q = JSON.parse(init.body).query;
      if (/localization/.test(q)) {
        const countries = Object.keys(opts.currencies || { AED: 'AE' }).map(cur => ({
          isoCode: (opts.currencies || { AED: 'AE' })[cur], currency: { isoCode: cur }
        }));
        return Promise.resolve({ json: () => Promise.resolve({ data: { localization: { availableCountries: countries } } }) });
      }
      // product price query — answer every alias in opts.priceCurrency
      const data = {};
      (opts.prices || []).forEach((p, i) => {
        data['p' + i] = { handle: p.getAttribute('data-handle'),
          priceRange: { minVariantPrice: { amount: String(opts.priceAmount || 54.5), currencyCode: opts.priceCurrency || 'AED' } } };
      });
      return Promise.resolve({ json: () => Promise.resolve({ data }) });
    }
  };
  g.window = g;
  const fn = new Function('window', 'document', 'sessionStorage', 'localStorage', 'fetch',
    'CustomEvent', 'MutationObserver', 'console', 'setTimeout', 'clearTimeout',
    SRC + '\n;return window.SahraMarket;');
  const api = fn(g, doc, g.sessionStorage, g.localStorage, g.fetch, g.CustomEvent, g.MutationObserver, console, setTimeout, clearTimeout);
  return { api, doc, events, session, local };
}

console.log('\nmarket-test — driving the real assets/sahra-market.js\n');

(async function () {
  const tick = () => new Promise(r => setTimeout(r, 20));

  /* 1 — resolution table ------------------------------------------------ */
  {
    const env = boot({ geo: 'AE' }); await tick();
    const t = env.api._test;
    check('AE resolves to the uae market', t.market('AE') === 'uae');
    check('SA and KW resolve to gcc', t.market('SA') === 'gcc' && t.market('KW') === 'gcc');
    check('US, GB and DE resolve to intl', t.market('US') === 'intl' && t.market('GB') === 'intl' && t.market('DE') === 'intl');
    check('default currencies: SA→SAR, GB→GBP, DE→EUR, BR→USD',
      t.defaultCurrency('SA') === 'SAR' && t.defaultCurrency('GB') === 'GBP' &&
      t.defaultCurrency('DE') === 'EUR' && t.defaultCurrency('BR') === 'USD');
    check('formatting: AED whole stays clean, USD gets 2dp, KWD gets 3dp',
      t.fmt(199, 'AED') === 'AED 199' && t.fmt(54.5, 'USD') === 'USD 54.50' && t.fmt(16.55, 'KWD') === 'KWD 16.550',
      [t.fmt(199, 'AED'), t.fmt(54.5, 'USD'), t.fmt(16.55, 'KWD')].join(' | '));
  }

  /* 2 — geo lands on <html> and is cached ------------------------------- */
  {
    const env = boot({ geo: 'SA' }); await tick();
    check('Saudi visitor gets data-market="gcc" on <html>',
      env.doc.documentElement.getAttribute('data-market') === 'gcc',
      'got: ' + env.doc.documentElement.getAttribute('data-market'));
    check('geo cached in sessionStorage for the pre-paint snippet',
      env.session.sb_geo === 'SA');
  }

  /* 3 — THE GATE, closed: store prices AED only (today's reality) ------- */
  {
    const p = mkPrice('al-quaa-galaxy-regular', 199);
    const slot = mkSlot();
    const env = boot({ geo: 'GB', currencies: { AED: 'AE' }, prices: [p], slots: [slot] });
    await tick(); await tick();
    check('pre-Shopify-Payments: NO currency selector is offered',
      slot.children.length === 0,
      'selector was injected with only one real currency');
    check('pre-Shopify-Payments: price stays AED even for a UK visitor',
      p.textContent === 'AED 199', 'price became: ' + p.textContent);
  }

  /* 4 — THE GATE, open: SP live, Shopify honours the currency ----------- */
  {
    const p = mkPrice('al-quaa-galaxy-regular', 199);
    const slot = mkSlot();
    const env = boot({ geo: 'SA', currencies: { AED: 'AE', SAR: 'SA', USD: 'US' },
                       priceCurrency: 'SAR', priceAmount: 203.25, prices: [p], slots: [slot] });
    await tick(); await tick();
    check('with SP live, a selector is offered', slot.children.length > 0);
    check('Saudi visitor sees SAR price', p.textContent === 'SAR 203.25', 'price: ' + p.textContent);
    const ev = env.events.filter(e => e.type === 'sb:market').pop();
    check('cart is told the buyer country (SA)', ev && ev.detail.country === 'SA',
      'event detail: ' + JSON.stringify(ev && ev.detail));
  }

  /* 5 — THE GATE, half-open: currency listed but answer comes back AED.
     This is the dangerous seam (market exists, SP hiccups): never paint. */
  {
    const p = mkPrice('al-quaa-galaxy-regular', 199);
    const env = boot({ geo: 'SA', currencies: { AED: 'AE', SAR: 'SA' },
                       priceCurrency: 'AED', prices: [p], slots: [] });
    await tick(); await tick();
    check('unhonoured currency answer leaves the AED price untouched',
      p.textContent === 'AED 199', 'price became: ' + p.textContent);
  }

  /* 6 — the customer's own choice beats geo ----------------------------- */
  {
    const env = boot({ geo: 'SA', currencies: { AED: 'AE', SAR: 'SA', USD: 'US' },
                       priceCurrency: 'USD', local: { sb_cur: 'USD' }, prices: [], slots: [] });
    await tick(); await tick();
    check('saved currency choice (USD) wins over geo default (SAR)',
      env.api.currency() === 'USD', 'currency: ' + env.api.currency());
  }

  console.log('\n  ' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
})();
