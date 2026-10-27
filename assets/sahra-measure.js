/* sahra-measure.js: where buyers come from, and what they look at (25 Oct 2026, retention audit).
 *
 * 1. Attribution. All 32 orders since launch had a blank referrer, because the shop runs on
 *    www and checkout on Shopify's domain. On arrival we keep the campaign tags (utm_*), the
 *    kind of ad click (gclid / fbclid / ttclid ...), the landing page and the referring site,
 *    first touch (kept 30 days) and last touch, in localStorage. sahra-cart.js writes them to
 *    the Shopify cart as hidden attributes (keys start with "_", so the buyer never sees them)
 *    right before checkout, and they show on the order in Shopify admin under
 *    "Additional details". No personal data: only the tag values and the ad-click type.
 * 2. view_item_list on any page that lists products, in GA4's standard shape.
 * 3. view_item on product pages that do not send their own (the Sahel and Sahra Trail pages).
 * GA4's add_to_cart / view_item get their standard items[] and value in ga4.js (window.track).
 */
(function () {
  'use strict';
  if (window.__sbMeasure) return;
  window.__sbMeasure = 1;

  var KEY = 'sb_attr', DAY = 864e5;
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }

  /* ------------------------------------------------------------ attribution */
  (function () {
    var q; try { q = new URLSearchParams(location.search); } catch (e) { return; }
    var t = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) {
      var v = q.get(k); if (v) t[k.slice(4)] = String(v).slice(0, 80);
    });
    ['gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid'].some(function (k) { if (q.get(k)) { t.click = k; return true; } return false; });
    var ref = '';
    /* payment and checkout hops are not a source */
    var IGNORE = /(^|\.)(sahraandbeyond\.ae|shopify\.com|myshopify\.com|shop\.app|tabby\.ai|tabby\.ae|paypal\.com|stripe\.com|apple\.com)$/;
    try { if (document.referrer) { var h = new URL(document.referrer).hostname.replace(/^www\./, ''); if (!IGNORE.test(h)) ref = h; } } catch (e) {}
    if (ref) t.ref = ref.slice(0, 60);
    var cur = load(), now = Date.now();
    if (cur && cur.first && now - (cur.first.at || 0) > 30 * DAY) { cur.first = cur.last; }   /* only first touch expires */
    var external = Object.keys(t).length > 0;
    /* an internal page view keeps what we have; a plain direct visit stores nothing, so checkout is not
       held up writing empty attributes (an order with no _source attribute is a direct one) */
    if (!external) return;
    var touch = t;
    touch.landing = (location.pathname || '/').slice(0, 80);
    touch.at = now;
    save({ first: (cur && cur.first) || touch, last: touch });
  })();

  /* The cart attributes sahra-cart.js adds at checkout. Values are short strings. */
  window.sbAttr = function () {
    var a = load(); if (!a || !a.last) return [];
    var l = a.last, f = a.first || l, out = [];
    function put(k, v) { if (v) out.push({ key: k, value: String(v).slice(0, 100) }); }
    put('_source', l.source || l.ref || (l.click ? l.click.replace(/clid$/, '') : ''));
    put('_medium', l.medium);
    put('_campaign', l.campaign);
    put('_content', l.content);
    put('_ad_click', l.click);
    put('_referrer', l.ref);
    put('_landing', l.landing);
    put('_first_touch', [f.source || f.ref || (f.click || '') || 'direct', f.landing, new Date(f.at || Date.now()).toISOString().slice(0, 10)].filter(Boolean).join(' · '));
    return out;
  };

  function track(n, p) { try { if (window.track) window.track(n, p); } catch (e) {} }
  function sent(name) {
    try { return (window.dataLayer || []).some(function (a) { return a && a[0] === 'event' && a[1] === name; }); } catch (e) { return false; }
  }

  function ready(fn) { if (document.readyState !== 'loading') setTimeout(fn, 0); else document.addEventListener('DOMContentLoaded', fn); }

  ready(function () {
    var path = location.pathname || '/';
    /* ------------------------------------------- view_item (product pages) */
    if (/^\/(ar\/)?products\/[^/]+\/?$/.test(path)) {
      setTimeout(function () {
        if (sent('view_item')) return;
        var handle = path.replace(/\/$/, '').split('/').pop(), name = '', price = 0;
        try {
          [].some.call(document.querySelectorAll('script[type="application/ld+json"]'), function (s) {
            var j = JSON.parse(s.textContent || 'null'), arr = Array.isArray(j) ? j : [j];
            return arr.some(function (x) {
              if (!x || (x['@type'] !== 'Product' && x['@type'] !== 'ProductGroup')) return false;
              name = x.name || '';
              var o = x.offers || (x.hasVariant && x.hasVariant[0] && x.hasVariant[0].offers) || {};
              if (Array.isArray(o)) o = o[0] || {};
              price = Number(o.price || o.lowPrice || 0);
              return true;
            });
          });
        } catch (e) {}
        if (!price) { var el = document.querySelector('[data-handle="' + handle + '"][data-aed]'); if (el) price = Number(el.getAttribute('data-aed')) || 0; }
        track('view_item', { currency: 'AED', value: price || undefined,
          items: [{ item_id: handle, item_name: name || handle, price: price || undefined, quantity: 1 }] });
      }, 1200);
      return;
    }
    /* ------------------------------------------- view_item_list (any page with 2+ products) */
    var seen = {}, items = [];
    [].forEach.call(document.querySelectorAll('a[href*="/products/"]'), function (a) {
      var m = (a.getAttribute('href') || '').match(/\/products\/([a-z0-9-]+)/);
      if (!m || seen[m[1]] || items.length >= 30) return;
      seen[m[1]] = 1;
      var el = document.querySelector('[data-handle="' + m[1] + '"][data-aed]');
      var nm = a.querySelector('b, h3, .nb-n, .pcard-name');
      items.push({ item_id: m[1], item_name: (nm && nm.textContent.trim()) || m[1],
        price: el ? Number(el.getAttribute('data-aed')) || undefined : undefined, index: items.length, quantity: 1 });
    });
    if (items.length >= 2) track('view_item_list', { item_list_id: path.slice(0, 60), item_list_name: (document.title || path).slice(0, 80), items: items });
  });
})();
