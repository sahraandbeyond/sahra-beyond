/* ==========================================================================
   sahra-market.js — one site, market-aware
   ==========================================================================
   The internationalisation decision, recorded so nobody re-litigates it:
   there is ONE set of URLs. No /intl/ tree, no geo-redirects. Googlebot
   crawls from US IPs, so a hard geolock would have shown Google only the
   international variant and buried the UAE pages that hold every ranking
   this site has. Instead the static HTML *is* the UAE site (crawlers and
   no-JS users see exactly what they saw before this file existed), and this
   layer adapts three things in place for everyone else:

     1. data-market on <html>  → CSS swaps the shipping-promise copy
        (uae / gcc / intl variants are all in the HTML; CSS shows one)
     2. the currency selector  → rewrites .sb-price nodes via the
        Storefront API's @inContext directive
     3. the cart's buyerIdentity → so checkout itself opens in the
        customer's market and currency

   THE GATING RULE, which is the most important thing in this file:
   a currency is only ever offered if Shopify actually returns prices in it.
   Multi-currency needs Shopify Payments active; until Faheem activates it,
   the store presents AED only, `localization` reports AED only, and the
   selector quietly renders nothing. The moment SP goes live the currencies
   appear with no code change. We never show a converted price that checkout
   will not honour — an "estimate" that changes at payment is how you earn a
   chargeback and lose a customer in the same minute.

   Geo comes from /api/geo (Vercel edge header), cached in sessionStorage.
   Currency choice is the user's and wins over geo; it lives in localStorage.
   ========================================================================== */
(function () {
  'use strict';
  if (window.SahraMarket) return;

  var S = { domain: 'sahra-beyond.myshopify.com', token: 'cc42ba8e74eb27c4f3c062d93f893fa0', v: '2024-10' };

  var GCC = { SA: 1, QA: 1, OM: 1, BH: 1, KW: 1 };
  var EU = { AT:1,BE:1,BG:1,HR:1,CY:1,CZ:1,DK:1,EE:1,FI:1,FR:1,DE:1,GR:1,HU:1,IE:1,IT:1,LV:1,LT:1,LU:1,MT:1,NL:1,PL:1,PT:1,RO:1,SK:1,SI:1,ES:1,SE:1 };
  // The selector's order of appearance. Each currency queries prices via a
  // representative country, because @inContext takes a country, not a currency.
  var CURRENCIES = [
    { c: 'AED', country: 'AE', label: 'AED — UAE Dirham' },
    { c: 'SAR', country: 'SA', label: 'SAR — Saudi Riyal' },
    { c: 'QAR', country: 'QA', label: 'QAR — Qatari Riyal' },
    { c: 'OMR', country: 'OM', label: 'OMR — Omani Rial' },
    { c: 'BHD', country: 'BH', label: 'BHD — Bahraini Dinar' },
    { c: 'KWD', country: 'KW', label: 'KWD — Kuwaiti Dinar' },
    { c: 'USD', country: 'US', label: 'USD — US Dollar' },
    { c: 'EUR', country: 'DE', label: 'EUR — Euro' },
    { c: 'GBP', country: 'GB', label: 'GBP — Pound Sterling' }
  ];
  // KWD, BHD and OMR are real 3-decimal currencies. Formatting them to 2dp
  // misprices every item by up to 9 fils, so the map is not optional.
  var DECIMALS = { BHD: 3, KWD: 3, OMR: 3 };

  function market(cc) { return cc === 'AE' ? 'uae' : (GCC[cc] ? 'gcc' : 'intl'); }
  function defaultCurrency(cc) {
    if (cc === 'AE') return 'AED';
    if (GCC[cc]) return { SA: 'SAR', QA: 'QAR', OM: 'OMR', BH: 'BHD', KW: 'KWD' }[cc];
    if (cc === 'GB') return 'GBP';
    if (EU[cc]) return 'EUR';
    return 'USD';
  }
  // NOTE: DECIMALS and this formatter are intentionally mirrored in
  // sahra-cart.js (the two files have no shared bundle). If a currency's
  // decimals ever change, change BOTH, or the page and the drawer disagree.
  function fmt(amount, cur) {
    cur = cur || 'AED';
    var d = DECIMALS[cur] != null ? DECIMALS[cur] : 2;
    var n = parseFloat(amount || 0);
    // Brand style is "AED 199", clean integers for whole amounts — but only
    // where the currency genuinely has no sub-unit in play.
    if (d === 2 && n % 1 === 0) return cur + ' ' + n.toFixed(0);
    return cur + ' ' + n.toFixed(d);
  }

  // ---- state ----
  var geo = null;            // ISO country the visitor is in
  var cur = null;            // currency currently displayed
  var live = null;           // currencies Shopify will actually price in
  var priceCache = {};       // currency -> { handle: formattedPrice }

  function store(k, v, sess) {
    try { (sess ? sessionStorage : localStorage).setItem(k, v); } catch (e) {}
  }
  function read(k, sess) {
    try { return (sess ? sessionStorage : localStorage).getItem(k); } catch (e) { return null; }
  }

  function applyMarket() {
    var m = market(geo || 'AE');
    document.documentElement.setAttribute('data-market', m);
    store('sb_geo', geo || 'AE', true);
  }

  function gql(query, done, fail) {
    fetch('https://' + S.domain + '/api/' + S.v + '/graphql.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': S.token },
      body: JSON.stringify({ query: query })
    }).then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.data) done(j.data); else if (fail) fail(); })
      .catch(function () { if (fail) fail(); });
  }

  // ---- which currencies are real? ----
  // Asked of the store, never assumed. Cached for a day; a version suffix in
  // the key means activating SP invalidates old caches naturally on redeploy.
  function loadLive(done) {
    var cached = read('sb_live_v1');
    if (cached) {
      try { live = JSON.parse(cached); if (Date.now() - live.t < 864e5) { done(); return; } } catch (e) {}
    }
    gql('{ localization { availableCountries { isoCode currency { isoCode } } } }', function (d) {
      var set = {};
      (d.localization && d.localization.availableCountries || []).forEach(function (c) {
        if (c.currency) set[c.currency.isoCode] = c.isoCode;
      });
      live = { t: Date.now(), set: set };
      store('sb_live_v1', JSON.stringify(live));
      done();
    }, function () { live = { t: 0, set: { AED: 'AE' } }; done(); });
  }
  function offered() {
    return CURRENCIES.filter(function (x) { return live && live.set[x.c]; });
  }

  // ---- price rewriting ----
  function handlesOnPage() {
    var seen = {}, out = [];
    document.querySelectorAll('.sb-price[data-handle]').forEach(function (el) {
      var h = el.getAttribute('data-handle');
      if (h && !seen[h]) { seen[h] = 1; out.push(h); }
    });
    return out;
  }
  function paint(map) {
    document.querySelectorAll('.sb-price[data-handle]').forEach(function (el) {
      var p = map[el.getAttribute('data-handle')];
      if (p) el.textContent = p;
    });
  }
  function localise() {
    var handles = handlesOnPage();
    if (!cur || !handles.length) return;
    if (cur === 'AED') {
      // The AED numbers are baked into the HTML — restore them from the
      // attribute stamped at build time rather than refetching what we have.
      document.querySelectorAll('.sb-price[data-aed]').forEach(function (el) {
        el.textContent = 'AED ' + el.getAttribute('data-aed');
      });
      return;
    }
    if (priceCache[cur]) { paint(priceCache[cur]); return; }
    var entry = null;
    for (var i = 0; i < CURRENCIES.length; i++) if (CURRENCIES[i].c === cur) entry = CURRENCIES[i];
    if (!entry) return;
    var q = 'query { ' + handles.map(function (h, i) {
      return 'p' + i + ': product(handle: "' + h.replace(/[^a-z0-9-]/g, '') + '") { handle priceRange { minVariantPrice { amount currencyCode } } }';
    }).join(' ') + ' }';
    gql('query @inContext(country: ' + entry.country + ') ' + q.slice(6), function (d) {
      var map = {}, honoured = true;
      Object.keys(d).forEach(function (k) {
        var p = d[k];
        if (!p || !p.priceRange) return;
        var mv = p.priceRange.minVariantPrice;
        // THE GATE: if Shopify answered in a different currency than asked,
        // multi-currency is not live for this country. Show nothing rather
        // than a number checkout will contradict.
        if (mv.currencyCode !== cur) { honoured = false; return; }
        map[p.handle] = fmt(mv.amount, cur);
      });
      if (!honoured) return;
      priceCache[cur] = map;
      paint(map);
    });
  }

  function setCurrency(c, persist) {
    cur = c;
    if (persist !== false) store('sb_cur', c);
    document.querySelectorAll('.sb-curpick').forEach(function (sel) { sel.value = c; });
    localise();
    // The cart re-prices itself through buyerIdentity so the drawer, the
    // page and checkout can never disagree with each other.
    var entry = null;
    for (var i = 0; i < CURRENCIES.length; i++) if (CURRENCIES[i].c === c) entry = CURRENCIES[i];
    var country = entry ? entry.country : (geo || 'AE');
    buyerCC = country;
    document.dispatchEvent(new CustomEvent('sb:market', {
      detail: { currency: c, country: country, market: market(geo || 'AE') }
    }));
    /* Belt AND braces: the event only reaches the cart if sahra-cart.js was
       already parsed, and on two pages it historically was not — deferred
       scripts run in document order, so a market.js tag placed above cart.js
       dispatched this into the void. The tags are now ordered correctly
       everywhere, but the direct call makes correctness independent of tag
       order forever. setCountry() is idempotent, so double delivery is safe. */
    if (window.SahraCart && window.SahraCart.setCountry) window.SahraCart.setCountry(country);
  }

  // ---- the selector ----
  function buildSelectors() {
    var list = offered();
    // Fewer than two real currencies means there is nothing to choose.
    // Pre-Shopify-Payments this is the everyday state; render nothing.
    if (list.length < 2) return;
    document.querySelectorAll('[data-sb-curslot]').forEach(function (slot) {
      if (slot.querySelector('select')) return;
      var wrap = document.createElement('label');
      wrap.className = 'sb-curwrap';
      var hint = document.createElement('span');
      hint.className = 'sb-curhint';
      hint.textContent = 'Currency';
      var sel = document.createElement('select');
      sel.className = 'sb-curpick';
      sel.setAttribute('aria-label', 'Display currency');
      list.forEach(function (x) {
        var o = document.createElement('option');
        o.value = x.c; o.textContent = x.label;
        sel.appendChild(o);
      });
      sel.value = cur;
      sel.addEventListener('change', function () { setCurrency(sel.value); });
      wrap.appendChild(hint); wrap.appendChild(sel);
      slot.appendChild(wrap);
    });
  }

  /* Rotating announcement notes: any [data-sb-rotate] whose children carry
     .sb-rot cycles them every 4.5s. First span starts .on (crawler/no-JS see
     only that one, which is the shipping line — the content Google already
     ranks). Skipped for reduced-motion users. */
  function rotator() {
    try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) {}
    var hosts = document.querySelectorAll('[data-sb-rotate]');
    if (!hosts.length) return;
    setInterval(function () {
      hosts.forEach(function (h) {
        var items = h.querySelectorAll('.sb-rot');
        if (items.length < 2) return;
        var i = 0; items.forEach(function (el, k) { if (el.classList.contains('on')) i = k; });
        items[i].classList.remove('on');
        items[(i + 1) % items.length].classList.add('on');
      });
    }, 4500);
  }

  /* Header currency chip: the footer slot has near-zero discoverability
     (audit + Rastah both surface currency in the header). Injected only when
     more than one currency is live, desktop only — mobile keeps the footer
     and PDP slots. */
  function headerChip() {
    if (offered().length < 2 || !document.querySelector) return;
    var hdr = document.querySelector('.hdr');
    if (!hdr || hdr.querySelector('.sb-curwrap--hdr')) return;
    var wrap = document.createElement('span');
    wrap.className = 'sb-curwrap sb-curwrap--hdr';
    var sel = document.createElement('select');
    sel.className = 'sb-curpick sb-curpick--hdr';
    sel.setAttribute('aria-label', 'Display currency');
    offered().forEach(function (x) {
      var o = document.createElement('option');
      o.value = x.c; o.textContent = x.c;
      sel.appendChild(o);
    });
    sel.value = cur;
    sel.addEventListener('change', function () { setCurrency(sel.value); });
    wrap.appendChild(sel);
    hdr.appendChild(wrap);
  }

  function boot() {
    var known = read('sb_geo', true);
    var start = function () {
      applyMarket();
      loadLive(function () {
        var saved = read('sb_cur');
        var pick = null;
        if (saved && live.set[saved]) pick = saved;
        else {
          var d = defaultCurrency(geo || 'AE');
          pick = live.set[d] ? d : 'AED';
        }
        buildSelectors();
        /* Cosmetic extras must NEVER be able to kill the boot path — a throw
           here would silently disable pricing and the cart bridge (it did,
           in the test harness, before these guards). */
        try { headerChip(); } catch (e) {}
        setCurrency(pick, false);
        try { rotator(); } catch (e) {}
      });
    };
    if (known && /^[A-Z]{2}$/.test(known)) { geo = known; start(); }
    else {
      fetch('/api/geo').then(function (r) { return r.json(); })
        .then(function (j) { geo = (j && /^[A-Z]{2}$/.test(j.c)) ? j.c : 'AE'; start(); })
        .catch(function () { geo = 'AE'; start(); });
    }
  }

  var buyerCC = 'AE';   // country implied by the active currency choice
  window.SahraMarket = {
    country: function () { return geo || 'AE'; },
    /* What the CART should be pointed at — the currency choice's country,
       not raw geo (a UAE visitor who chose USD wants a US-context cart). */
    buyerCountry: function () { return buyerCC; },
    market: function () { return market(geo || 'AE'); },
    currency: function () { return cur || 'AED'; },
    fmt: fmt,
    _test: { market: market, defaultCurrency: defaultCurrency, fmt: fmt }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* The shop grid and the PDP fit-swap render AFTER this module boots, so
     their .sb-price nodes would keep showing AED in a non-AED session. Watch
     for late arrivals and re-run the painter (debounced — the grid inserts
     dozens of nodes in one frame, and one repaint covers all of them). */
  var moT = null;
  try {
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var ns = muts[i].addedNodes;
        for (var j = 0; j < ns.length; j++) {
          var n = ns[j];
          if (n.nodeType === 1 && (n.matches && n.matches('.sb-price,[data-sb-curslot]') || n.querySelector && n.querySelector('.sb-price,[data-sb-curslot]'))) {
            clearTimeout(moT);
            moT = setTimeout(function () { buildSelectors(); localise(); }, 60);
            return;
          }
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
})();
