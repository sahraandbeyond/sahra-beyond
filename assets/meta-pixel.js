/* Sahra & Beyond — Meta Pixel + Conversions API bridge
   -----------------------------------------------------------------------
   Pixel ID 1392180882887027 (Sahra & Beyond). A Pixel ID is not a secret —
   it is visible in page source by design. The CAPI *access token* is the
   secret, and it lives only in a Vercel env var, never in this repo.

   What this does:
     - loads the Meta browser pixel and fires PageView
     - fires ViewContent automatically on product pages, read from the
       Product JSON-LD already in the page head (no per-product wiring)
     - exposes window.sbMeta(name, customData, userData) for other scripts
     - sends a matching server-side copy of every event to /api/meta-capi

   Deduplication: every event carries an event_id sent BOTH browser-side and
   server-side. Meta collapses the pair into one event. Without this you would
   double-count everything.
*/
(function () {
  'use strict';

  var PIXEL_ID = '1392180882887027';

  var CAPI_ENDPOINT = '/api/meta-capi';

  if (!PIXEL_ID || PIXEL_ID.indexOf('REPLACE') === 0) {
    if (window.console && console.warn) {
      console.warn('[sahra] Meta pixel not configured — set PIXEL_ID in /assets/meta-pixel.js');
    }
    window.sbMeta = function () {};
    return;
  }

  /* ---- Meta base pixel (standard snippet) ----------------------------- */
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  fbq('init', PIXEL_ID);

  /* ---- helpers -------------------------------------------------------- */

  function eventId() {
    try {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch (e) {}
    return 'sb-' + Date.now() + '-' + Math.random().toString(16).slice(2, 10);
  }

  function clean(o) {
    var out = {}, k;
    for (k in o) {
      if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
      if (o[k] === undefined || o[k] === null || o[k] === '') continue;
      out[k] = o[k];
    }
    return out;
  }

  /* Standard events go through fbq('track'); anything else is a custom event.
     Sending a custom name through 'track' silently drops it. */
  var STANDARD = {
    PageView: 1, ViewContent: 1, AddToCart: 1, InitiateCheckout: 1, Purchase: 1,
    Lead: 1, CompleteRegistration: 1, Search: 1, AddToWishlist: 1, Contact: 1,
    AddPaymentInfo: 1, Subscribe: 1, StartTrial: 1
  };

  /* userData is optional. Pass plain email/phone — it is hashed on the SERVER,
     never here, and never stored. */
  function sbMeta(name, customData, userData) {
    var id = eventId();
    var cd = clean(customData || {});

    try {
      if (STANDARD[name]) fbq('track', name, cd, { eventID: id });
      else fbq('trackCustom', name, cd, { eventID: id });
    } catch (e) {}

    try {
      var payload = {
        event_name: name,
        event_id: id,
        event_source_url: location.href,
        custom_data: cd
      };
      if (userData) payload.user_data = userData;

      fetch(CAPI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: 'same-origin'
      }).catch(function () {});
    } catch (e) {}

    return id;
  }

  window.sbMeta = sbMeta;

  /* ---- PageView ------------------------------------------------------- */
  sbMeta('PageView');

  /* ---- ViewContent, read from Product JSON-LD -------------------------- */
  /* Every product page already carries a schema.org Product block. Reading it
     means new products need no pixel changes at all. */
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
        var price = offer.price;
        var currency = offer.priceCurrency || 'AED';
        var sku = d.sku || d.name;

        /* Stash it so the cart can attach real value to AddToCart. */
        window.__SB_PRODUCT = { sku: sku, price: price, currency: currency, name: d.name };

        sbMeta('ViewContent', {
          content_type: 'product',
          content_ids: [sku],
          content_name: d.name,
          value: price ? Number(price) : undefined,
          currency: currency
        });
        return;
      }
    }
  } catch (e) {}
})();
