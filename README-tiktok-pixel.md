# TikTok pixel — how it is wired (12 Sep 2026)

Pixel ID **DAIGE43C77U9J87RH2BG** (TikTok Ads Manager, ad account 7684553759755370513 "Sahra and Beyond FZE LLC0912").
The buyer's journey crosses two sites, so there are two halves:

1. **Marketing site (sahraandbeyond.ae, this repo)** — `assets/tiktok-pixel.js`, inserted on every page by the
   `applyTikTokPixel` pass in `build.js` (right after the Meta pixel tag, before asset hashing). Fires page,
   ViewContent (from the Product JSON-LD) and mirrors the cart's AddToCart by wrapping `window.sbMeta`.
   No change to `sahra-cart.js`. It does **not** fire InitiateCheckout — see 2.
2. **Shopify (checkout.sahraandbeyond.ae)** — the **TikTok sales channel** installed in Shopify is already connected to
   the same Pixel ID with data sharing at "Maximum" (pixel + Events API + advanced matching). It sends ViewContent /
   AddToCart on the Shopify theme pages, InitiateCheckout when the checkout loads, AddPaymentInfo, PlaceAnOrder and
   **CompletePayment**. Nothing to install. `shopify-theme/tiktok-custom-pixel.js` in the project folder is a
   reference implementation only — **do not add it as a custom pixel**, it would double-count.

To ship the site half: `node build.js`, check `prepush.js` is green, commit and push from GitHub Desktop.
Verify in TikTok Ads Manager → Tools → Events → the pixel → Test events, or the TikTok Pixel Helper extension:
sahraandbeyond.ae product page should show PageView + ViewContent; add to cart → AddToCart; the checkout should show
InitiateCheckout and, after a test order, CompletePayment (from the channel).
