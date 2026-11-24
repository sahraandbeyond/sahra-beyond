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
    /* 29 Oct 2026 (site speed): the library downloads once the page has loaded (ga4.js sbLater); fbq queues until then */
    (window.sbLater || function (g) { g(); })(function () {
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    });
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  fbq('init', PIXEL_ID);

  /* ---- Shopify product IDs (24 Nov 2026) -------------------------------
     Meta's catalogue (1599085961950546, synced from Shopify) groups every product
     under its numeric Shopify product ID (Group ID 9629119217852 = Sahra Trail Tee).
     The pixel used to send the site handle (ViewContent) and Shopify variant GIDs
     (AddToCart, InitiateCheckout), so Commerce Manager matched only 10.1% of
     product events. Product events now send content_type 'product_group' and the
     numeric product ID. The table maps the Shopify handle the cart buys by
     (#ssBuy data-handle) to that ID, read from Shopify Admin on 24 Nov 2026. A
     handle missing here (a new product) is looked up at run time through the cart's
     Storefront query instead, and homepage-test.js fails the push until it is added. */
  var PIDS = {
    'al-quaa-galaxy-regular': '9498369491132',
    'al-quaa-galaxy-oversized': '9498369720508',
    'empty-quarter-regular': '9498369818812',
    'empty-quarter-oversized': '9498369884348',
    'hajar-mountains-regular': '9498369917116',
    'hajar-mountains-oversized': '9498370113724',
    'sand-polo': '9498370146492',
    'sahra-tote-founding-edition-gift': '9548565086396',
    'sahra-tote': '9599228018876',
    'sahra-trail-tee': '9629119217852',
    'sahra-trail-2-in-1-short': '9629119250620',
    'sahra-trail-kit': '9629119316156',
    'khor-fakkan-bay-tee-regular': '9629119611068',
    'khor-fakkan-bay-tee-super-oversized': '9629119643836',
    'al-hamra-pearl-diver-tee-regular': '9629119676604',
    'al-hamra-pearl-diver-tee-super-oversized': '9629119709372',
    'al-aqah-reef-tee-regular': '9629119873212',
    'al-aqah-reef-tee-super-oversized': '9629119905980',
    'shams-tee-regular': '9629119938748',
    'shams-tee-super-oversized': '9629119971516',
    'the-sahel-polo': '9629120069820',
    'barr-and-bahr-hoodie': '9629120102588',
    'ras-al-khor-hoodie': '9629120135356',
    'trailhead-bag': '9631658541244',
    'khor-fakkan-bay-tee-oversized': '15229661151420',
    'al-hamra-pearl-diver-tee-oversized': '15229661184188',
    'ras-al-khor-hoodie-oversized': '15229661216956',
    'al-qudra-lakes-tee-oversized': '15229661249724',
    'khor-fakkan-hoodie-oversized': '15229661282492'
  };
  /* numeric id from a Product GID ('gid://shopify/Product/123' -> '123'); numbers pass through */
  function pidNum(g) { var m = /(\d+)\s*$/.exec(String(g || '')); return m ? m[1] : ''; }
  var SBP = window.sbPid = window.sbPid || { byHandle: {}, byVariant: {} };
  for (var _h in PIDS) if (Object.prototype.hasOwnProperty.call(PIDS, _h) && !SBP.byHandle[_h]) SBP.byHandle[_h] = PIDS[_h];

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
    /* keys starting with _ are for other scripts (the TikTok mirror reads _tt), never sent to Meta */
    for (var _k in cd) if (_k.charAt(0) === '_') delete cd[_k];

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

      if (window.SB_LIVE === false) return;   /* 13 Nov 2026: no server-side copy from test copies or previews (ga4.js) */
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
  /* Every product page already carries a schema.org Product block, so reading
     it means new products need no pixel changes at all.

     This MUST wait for DOMContentLoaded. This script sits in <head>, above the
     JSON-LD, so at execution time those blocks are not in the DOM yet and a
     direct read finds nothing — which silently cost us every ViewContent. */
  /* The Shopify handle of the product on this page: the buy block's data-handle (product pages, EN and AR),
     else the /products/<handle>/ in the JSON-LD url, else the tote page. */
  function pageHandle(d) {
    var b = document.getElementById('ssBuy') || document.getElementById('ssStage');
    var h = b && b.getAttribute('data-handle');
    if (h) return h;
    var m = /\/products\/([a-z0-9-]+)\//.exec((d && d.url) || location.pathname);
    if (m) return m[1];
    if (/^\/(ar\/)?tote\/?$/.test(location.pathname)) return 'sahra-tote';
    return '';
  }
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
          var price = offer.price;
          var currency = offer.priceCurrency || 'AED';
          var sku = d.sku || d.name;
          var handle = pageHandle(d);

          /* Stash it so the cart can attach real value to AddToCart. */
          window.__SB_PRODUCT = { sku: sku, price: price, currency: currency, name: d.name, handle: handle, pid: SBP.byHandle[handle] || '' };

          /* no product ID found (should not happen; homepage-test.js checks the table): send what was sent before */
          var send = function (pid) {
            sbMeta('ViewContent', {
              content_type: pid ? 'product_group' : 'product',
              content_ids: [pid || sku],
              contents: pid ? [{ id: pid, quantity: 1 }] : undefined,
              content_name: d.name,
              value: price ? Number(price) : undefined,
              currency: currency
            });
          };
          if (window.__SB_PRODUCT.pid || !handle) { send(window.__SB_PRODUCT.pid); return; }
          /* a handle not in the table: ask the cart's Storefront query once it has loaded (at most ~6 s) */
          var tries = 0;
          (function look() {
            var C = window.SahraCart;
            if (C && C.productId) {
              C.productId(handle).then(function (pid) { window.__SB_PRODUCT.pid = pid || ''; send(pid); }, function () { send(''); });
            } else if (tries++ < 40) setTimeout(look, 150);
            else send('');
          })();
          return;
        }
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fireViewContent);
  } else {
    fireViewContent();
  }
})();
