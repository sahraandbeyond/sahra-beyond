/* Sahra & Beyond — TikTok Pixel
   -----------------------------------------------------------------------
   Pixel ID DAIGE43C77U9J87RH2BG (TikTok Ads Manager, created 12 Sep 2026).
   A Pixel ID is not a secret — it is visible in page source by design.

   What this does:
     - loads the TikTok browser pixel and fires the page event
     - fires ViewContent on product pages, read from the Product JSON-LD
       already in the page head (same pattern as /assets/meta-pixel.js —
       new products need no pixel changes)
     - mirrors the AddToCart that the cart sends to Meta via window.sbMeta,
       so the cart script needs no TikTok wiring
     - exposes window.sbTikTok(name, data) for anything else

   Everything on checkout.sahraandbeyond.ae — InitiateCheckout, AddPaymentInfo,
   PlaceAnOrder, CompletePayment — is sent by the TikTok sales channel in
   Shopify (same Pixel ID, data sharing "Maximum": pixel + Events API), which
   this site never sees. So this file deliberately does NOT fire
   InitiateCheckout on the click-through: the channel fires it when the
   checkout loads, and firing both would double-count.

   Event names follow TikTok's standard list: ViewContent, AddToCart,
   InitiateCheckout, CompletePayment, PlaceAnOrder, Contact, Search…
   Parameters follow TikTok Events 2.0: contents[], content_type, value,
   currency. Every event carries an event_id so a server-side copy (Events
   API) can be deduplicated later without changing this file.

   Load order: this script sits AFTER /assets/meta-pixel.js in <head>.
*/
(function () {
  'use strict';

  var PIXEL_ID = 'DAIGE43C77U9J87RH2BG';

  if (!PIXEL_ID) {
    window.sbTikTok = function () {};
    return;
  }

  /* ---- TikTok base pixel (standard snippet) ---------------------------- */
  !function (w, d, t) {
    w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || [];
    ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent'];
    ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; };
    for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
    ttq.instance = function (t) { for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]); return e; };
    ttq.load = function (e, n) {
      var r = 'https://analytics.tiktok.com/i18n/pixel/events.js';
      ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = r;
      ttq._t = ttq._t || {}; ttq._t[e] = +new Date();
      ttq._o = ttq._o || {}; ttq._o[e] = n || {};
      var s = d.createElement('script'); s.type = 'text/javascript'; s.async = true; s.src = r + '?sdkid=' + e + '&lib=' + t;
      var f = d.getElementsByTagName('script')[0]; f.parentNode.insertBefore(s, f);
    };
    ttq.load(PIXEL_ID);
    ttq.page();
  }(window, document, 'ttq');

  /* ---- helpers -------------------------------------------------------- */
  function eventId() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return 'sb-' + Date.now() + '-' + Math.random().toString(16).slice(2, 10);
  }

  function num(v) { var n = Number(v); return isFinite(n) ? n : undefined; }

  /* Translate the Meta-shaped custom_data the cart already builds into
     TikTok's contents[] shape. Anything unknown passes through untouched. */
  function toTikTok(cd) {
    cd = cd || {};
    var out = {};
    var ids = cd.content_ids || [];
    var qtyById = {};
    (cd.contents || []).forEach(function (c) { if (c && c.id) qtyById[c.id] = c.quantity || 1; });
    var contents = ids.map(function (id) {
      return {
        content_id: String(id),
        content_type: 'product',
        content_name: cd.content_name,
        quantity: qtyById[id] || 1,
        price: (ids.length === 1 && cd.value != null) ? num(cd.value) / (qtyById[id] || 1) : undefined
      };
    });
    if (contents.length) out.contents = contents;
    out.content_type = 'product';
    if (cd.value != null) out.value = num(cd.value);
    out.currency = cd.currency || 'AED';
    if (cd.num_items != null) out.quantity = cd.num_items;
    return out;
  }

  function sbTikTok(name, data) {
    var id = eventId();
    try { window.ttq.track(name, data || {}, { event_id: id }); } catch (e) {}
    return id;
  }
  window.sbTikTok = sbTikTok;

  /* ---- Mirror the cart's Meta events -------------------------------------
     /assets/sahra-cart.js calls window.sbMeta('AddToCart', …). Wrapping it
     here means one place to maintain. PageView and ViewContent are NOT
     mirrored (this script fires its own, below), and InitiateCheckout is
     NOT mirrored (the Shopify TikTok channel fires it on checkout load), so
     nothing is double-counted. */
  var MIRROR = { AddToCart: 'AddToCart', Contact: 'Contact', Search: 'Search', Lead: 'SubmitForm' };
  function wrapMeta() {
    var orig = window.sbMeta;
    if (typeof orig !== 'function' || orig.__ttqWrapped) return false;
    var wrapped = function (name, customData, userData) {
      var r = orig.apply(this, arguments);
      try { if (MIRROR[name]) sbTikTok(MIRROR[name], toTikTok(customData)); } catch (e) {}
      return r;
    };
    wrapped.__ttqWrapped = true;
    window.sbMeta = wrapped;
    return true;
  }
  if (!wrapMeta()) {
    /* meta-pixel.js not loaded yet (or absent) — try again once the DOM is ready. */
    document.addEventListener('DOMContentLoaded', wrapMeta);
  }

  /* ---- ViewContent from Product JSON-LD (waits for the DOM, see meta-pixel.js) */
  function fireViewContent() {
    try {
      var nodes = document.querySelectorAll('script[type="application/ld+json"]');
      for (var i = 0; i < nodes.length; i++) {
        var data;
        try { data = JSON.parse(nodes[i].textContent); } catch (e) { continue; }
        var list = Array.isArray(data) ? data : [data];
        for (var j = 0; j < list.length; j++) {
          var d = list[j];
          if (!d || d['@type'] !== 'Product') continue;
          var offer = d.offers || {};
          var price = num(offer.price);
          var currency = offer.priceCurrency || 'AED';
          var sku = d.sku || d.name;
          sbTikTok('ViewContent', {
            contents: [{ content_id: String(sku), content_type: 'product', content_name: d.name, price: price, quantity: 1 }],
            content_type: 'product',
            value: price,
            currency: currency
          });
          return;
        }
      }
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fireViewContent);
  else fireViewContent();
})();
