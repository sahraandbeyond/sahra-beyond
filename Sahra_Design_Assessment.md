# Sahra & Beyond — Homepage & Shop Design Assessment

*Launch-readiness review of `homepage-preview.html` and `shop-preview.html`. Grouped by priority: **P0** = fix before launch, **P1** = high-impact, **P2** = polish. Assessed from the current code + the real screenshots and the new final product photography.*

---

## PDP retail basics — size chart, zoom, live stock, CTA fix (2026-07-22)

Acting on the UI/UX/completeness audit. The site was strong on story, thin on the practical information that actually decides a purchase.

**1. Size chart on the product page.** Full flat-lay table (Size / Chest / Length / Sleeve) with Regular ↔ Oversized tabs, in the fit section — no longer a link to another page. Driven from `sizes` in the product JSON, editable in the CMS.
> **Honesty guardrail:** the numbers carried over from the shop guide are explicitly marked `TODO: confirm real numbers against samples`, so they are **not** presented as fact. Each product has `sizesConfirmed: false`, which renders a visible *"Provisional measurements"* notice offering to measure the actual garment on request — and **`launch.js` now blocks go-live** while any product is unconfirmed. Wrong measurements drive returns, so this is a fatal check, not a warning.

**2. Image zoom.** Full lightbox on the PDP gallery (click to open, arrows, Esc, backdrop click, keyboard nav, scroll lock) matching the shop's viewer, plus a "Click to zoom" affordance. Fires an `image_zoom` event. Previously the page selling the garment had a *weaker* image experience than the shop.

**3. Live per-size availability.** Fetches variants from the Shopify Storefront API, matches by handle → title, and renders size chips with sold-out state plus scarcity copy ("Only 2 sizes left in this run"). **Hidden by default** and only revealed once real data arrives, so the page never displays stock it cannot verify.

**4. CTA fixed (launch-aware).** Pre-launch, "Shop this tee" pointed at a noindex preview of a shop that isn't open — the loudest element promised something undeliverable. Now the generator takes `LAUNCHED`: before launch the primary CTA is **"Notify me when it drops"** (anchoring to the waitlist) with a secondary "Size & fit"; after launch it reverts to "Shop this tee". The sticky buy bar follows the same rule.

**5. Palettes deepened so all three pages travel.** Liwa and Hajar were near-monochrome — the scroll journey barely moved. `theme` still matches the shop section exactly (that constraint is unchanged); `theme2` is now a genuine destination:
| Product | Journey | Start → end luminance |
|---|---|---|
| Al Quaa | `#181109 → #1B1430` | 0.07 → 0.09 (stays night) |
| Liwa | `#E7D6B8 → #6B4A18` | 0.84 → 0.30 (pale sand → golden-hour dusk) |
| Hajar | `#C6BFD3 → #5C3A2E` | 0.76 → 0.25 (cold haze → **warm red rock**) |

All three now cross the 0.42 auto-contrast threshold, so the light products get the same drama as Al Quaa — and Hajar's palette finally matches the red rock its design is about.

**Validated:** tag balance (incl. table elements), JSON-LD, comment balance, inline JS `node --check` on all three, template-literal regex escaping re-verified, all pages serving 200. `launch.js` correctly reports 2 blockers (policies + provisional sizes).

## Analytics + pre-launch capture on product pages (2026-07-22)

Two gaps found by auditing rather than assuming — both on the newest, most important pages.

**1. No analytics on the new pages.** GA4 (`G-5NVFDWT29F`) was on the homepage, locations, places and about, but **absent from all three product pages and `commitment.html`**. The pages built over two sessions, and the page carrying the brand mission, were invisible in reporting.

Added the standard GA4 snippet to the PDP template and to `commitment.html`, plus meaningful events (not just pageviews):
- `view_item` on load, with item id / name / price / currency
- `select_item` when "Shop this tee" is clicked · `commitment_click` on the ghaf link · `place_click` on the location link · `related_click` on cross-sell
- `scroll_depth` at 25/50/75/100% — the long-form PDP only pays off if people actually read, so this measures whether it does

**2. No email capture on product pages — a pre-launch leak.** Every page captured waitlist signups *except* the three most likely to create desire. A visitor arriving from a location page could read the whole story, want the tee, and find only "Shop this tee" pointing at a shop that isn't open.

Added a `.wl-band` waitlist block under the trust row on each PDP, reusing the site's existing Kit flow (v3 API with the public key, graceful `no-cors` fallback, real success/error states). `data-source` is per product (`pdp-al-quaa-galaxy-tee` etc.) so signups are attributable to the tee that drove them. It stays useful post-launch as a restock/next-drop list.

**Bug caught during validation:** the generator embeds the page as a JS template literal, which silently collapsed regex escapes — `\s`→`s`, `\d`→`d`, `\/`→`/` — leaving `/^[^@s]+@[^@s]+.[^@s]+$/` and a broken form-id match in the emitted HTML. Node's `--check` caught it. Fixed by double-escaping in the generator; verified the emitted regexes are correct and the email validator now scores 8/8 on a test set (valid/invalid), with the Kit form id extracting correctly.

**Validated:** tag balance, JSON-LD, comment balance, inline JS `node --check` on all three PDPs + commitment page, all serving 200.

## Launch cutover script + places→products loop (2026-07-22)

### Deploy state at time of audit
Live site last deployed **19 July** (confirmed via live `sitemap.xml` lastmod). **Two sessions of work are undeployed** — ~25 files. Consequences currently live: footer still says "Made in the UAE", the old `sahra_and_beyond` handle is published, and `policies.html` is live as `index,follow` **with 8 unfilled legal placeholders**.

### 1. `launch.js` — one-command cutover
The cutover was a manual multi-step sequence (flip flag → promote homepage → strip noindex → rename shop → rebuild), i.e. the classic launch-day failure mode. Now:
- `node launch.js --check` (default) — readiness report, changes nothing, exits non-zero if blocked
- `node launch.js --go` — performs the cutover then rebuilds
- `node launch.js --rollback` — restores the coming-soon page and unsets the flag

**`--go` steps:** hard-blocks on unfilled `policies.html` placeholders → backs up `index.html` to `_backup/` → promotes `homepage-preview.html` to `index.html` (strips the noindex, roots `shirts/` paths, repoints every shop link to `/shop/`) → flips `LAUNCHED = true` → restores `policies.html` to `index,follow` → runs `build.js`.

**Guardrails:** the legal-placeholder check and the Shopify-token check are *fatal* — it will not take orders behind `[LICENCE NUMBER]` or ship a shop stuck in DEMO mode. Mockup photos and missing products are warnings, not blockers. Verified: with 10 placeholders outstanding it reports 1 blocker, exits 1, and **modifies nothing** (checked by hashing `index.html`/`build.js`/`policies.html` before and after a `--go` attempt).

### 2. Places → products loop (the big engagement fix)
The 24 location pages are the highest-traffic SEO surface, and **none of them linked to the tee they inspired** — the loop only ran product → place. Added `teeBlock(l)` to `build.js`: it matches `PRODUCT_BY_PLACE[l.id]` from `content/products/*.json` and renders a full-bleed cross-link card (photo, name, price, print method, Limited cue, CTA) tinted with that product's `--theme`. It **replaces** the generic shop CTA where a tee exists, and falls back to the generic CTA where one doesn't.

`build-products.js` now also exports `loadProducts(ROOT)` so `build.js` can read product data without generating pages.

Verified after rebuild: Al Quaa → Al Quaa Galaxy Tee, Liwa → Liwa Dune Tee, Wadi Naqab → Hajar Mountains Tee (1 `teecta`, 0 `shopcta` each); Wadi Showka / Hatta / Jebel Hafeet correctly keep the generic CTA (0 `teecta`, 1 `shopcta`).

### Still open (user-side)
Policies placeholders · size-guide measurements · final product photos on home/shop · no 404 page · Lighthouse never run · bundle/set offer.

## Products made CMS-editable (2026-07-22)

**Where product photos actually live — audit result:**
- **Shopify (automatic):** the shop page pulls `images(first:12)` + `featuredImage` live; the homepage collection cards and hero spotlight are *overwritten at runtime* with Shopify images. Updating photos in Shopify updates both, no deploy.
- **Local `/shirts/` files (were hardcoded):** `index.html` / `coming-soon.html`, the three product pages, and the pre-Shopify fallbacks.
- The CMS previously had **no** products collection and its `media_folder` is `uploads`, so it could not touch a single product photo.

**What changed:**
- **`content/products/*.json`** — one file per tee, holding everything: name, price, images + alt text, palette, scene, place data (incl. GPS/Bortle), all copy blocks, care list, FAQ and SEO/share text.
- **`build-products.js`** — new generator emitting `/products/<id>/index.html` from those JSON files using the v2 template. Generated *from* the hand-built page so output is effectively identical; verified by diff (only intended deltas: `&amp;` escaping, unused `--theme-3` dropped, refreshed header comment).
- **`build.js`** — requires the generator, runs it before the sitemap, and **includes product URLs in sitemap generation**. This fixed a real latent bug: `build.js` regenerates `sitemap.xml` from scratch, so the product URLs I'd added manually would have been silently wiped on the next build.
- **`admin/config.yml`** — new **Products (Tees)** collection with image widgets, colour pickers, a scene selector, and list widgets for design points / care / FAQ. Verified programmatically: **46 fields, zero mismatches** against the JSON in either direction.
- **Fixed stale CMS defaults** — Instagram/TikTok/YouTube still defaulted to the old `sahra_and_beyond` handle; now `sahraandbeyond.ae`. (The live `settings.json` value was already correct, but the default would have reintroduced the error.)

**Verified end-to-end:** simulated a CMS photo upload (`imgMain` → `/uploads/new-liwa-photo.jpg`), rebuilt, and confirmed it propagated to the gallery, thumbnail and `og:image` — then reverted. Paths work for both `/shirts/` and CMS-uploaded `/uploads/` images.

**Also caught:** the Hajar page's `twitter:image` still pointed at the Al Quaa photo (leftover from templating). Fixed — and it can't recur, since share images are now derived from a single JSON field.

**Adding tee #4 is now:** CMS → Products → New, fill the fields, upload 3 photos → the page, sitemap entry and cross-links generate themselves. Only remaining code step: add the slug to `PDP_SLUGS` in `homepage-preview.html` and `shop-preview.html` so the cards deep-link to it.

## PDP v2 — living backgrounds + shop-matched palettes (2026-07-22)

Feedback: pages read as static, and the colour scheme should match each shirt's section on the shop page.

**Palette correction (the important fix).** v1 invented accents. The shop's `THEMES[]` are the source of truth and the PDPs now match them exactly:
| Product | Shop section | PDP `--theme` | Journey stops |
|---|---|---|---|
| Al Quaa Galaxy Tee | `#181109` | `#181109` | `#FAF6EF → #181109 → #1B1430` |
| Liwa Dune Tee | `#E7D6B8` | `#E7D6B8` | `#FAF6EF → #E7D6B8 → #D8C39C` |
| Hajar Mountains Tee | `#C6BFD3` | `#C6BFD3` | `#FAF6EF → #C6BFD3 → #B4AEC6` |

**Scroll-linked background journey.** Same rAF colour-lerp technique as the shop's `startBgJourney()` — sections carry `data-bg`, and the body background interpolates between them as you scroll. Al Quaa travels light→dark (verified: exactly one L→D transition, final luminance 0.09); Liwa and Hajar stay in their light family, so there is no jarring contrast flip.

**Auto-contrast.** Text/borders/cards run on CSS custom properties (`--txt`, `--txt-soft`, `--line`, `--card`, `--chip`) swapped by a `.dark-bg` class applied when the live background luminance drops below 0.42. The nav tint follows the same colour via a `--nav-bg` property, so the sticky header never floats on the wrong tone.

**Living canvas (`#fx`, fixed, behind content).** One 2D-canvas scene per product, chosen by `var SCENE`:
- **galaxy** (Al Quaa) — parallax twinkling starfield, soft nebula band, shooting star every 5–11s
- **dunes** (Liwa) — four drifting ridge layers via smooth-interpolated noise + floating sand motes
- **mountains** (Hajar) — same ridge engine with a jagged modulation, parallaxed on scroll

Deliberately 2D canvas, not Three.js — the design assessment already flags the site as over-indexed on motion, so this adds atmosphere at a fraction of the cost. Guardrails: DPR capped (1.5 desktop / 1.2 touch), particle counts halved on touch, paused on `visibilitychange`, delta-clamped rAF, and **fully disabled under `prefers-reduced-motion`** (which also stops the grain and logo spin).

**Other craft upgrades:** sticky gallery column on desktop; **sticky buy bar** that slides in past the hero and hides over the footer (standard PDP conversion pattern); scroll progress bar; grain overlay matching home/shop; numbered section eyebrows (01–08) for editorial rhythm; larger display type with italic accent words; glass cards with hover lift; staggered reveals; Bortle scale mini-visualisation (1/2/3 pips lit per product).

**Bugs caught in review** (single-replace errors while templating): Hajar had leftover black gallery thumbnails, and both Liwa and Hajar had an Al Quaa breadcrumb + twitter:title. All fixed and re-verified — no cross-product leakage remains (remaining "Al Quaa" mentions on other pages are only the legitimate related-product cards).

**Validated:** tag balance, comment balance, JSON-LD parse, inline JS `node --check`, colour-journey maths simulated for NaN/out-of-range (0 errors across all three), all pages and images serve 200.

## Product detail pages (PDPs) — 3 built (2026-07-22)

New `/products/<slug>/index.html` for each tee, matching the `/locations/` URL pattern:
`al-quaa-galaxy-tee`, `liwa-dune-tee`, `hajar-mountains-tee`.

**Structure (identical across all three — this is the template):** announcement bar → sticky nav → breadcrumb → hero (gallery + buy panel) → **the place** accent band → the design → fabric & construction → size & fit → care → delivery & returns → FAQ → related products → footer.

**On-brand:** reuses the exact palette (`--sand/--ink/--clay/--clay-deep/--gold/--line`), the Playfair + Inter + Space Mono type stack, the conic-gradient logo mark, the shop's `.spec-strip` / `.limited` / `.buy-trust` / `.buy-ghaf` components, and the dark footer. Each page sets one **`--accent`** var used for the gallery backdrop and place band — Al Quaa `#181109` (night), Liwa `#6B4415` (desert amber), Hajar `#3B3A4A` (mountain slate).

**Product-manager additions beyond the brief:** breadcrumbs (+ BreadcrumbList JSON-LD), 3-image gallery with thumbnails, price with VAT/returns clarity, spec strip, occasion framing, "Shop this tee" CTA deep-linking to the shop anchor, ghaf commitment line, Bortle explainer card, per-product FAQ (5 Q&A answering the real objections: cracking, shrinkage, 230gsm in UAE heat, wrong size, restock), delivery & returns summary, related-products cross-sell, and full Product JSON-LD.

**Accuracy guardrails:** only confirmed specs used. **No invented measurements** — the size section explains Regular vs Oversized and points to the shop size guide + email. **No `aggregateRating`** (no real reviews yet) — commented in each file. Print method is per-product (DTG for Al Quaa/Hajar, tonal embroidery for Liwa) and the care/FAQ copy differs accordingly.

**Wiring:** homepage collection cards are now `<a>` → PDP (the old JS click-handler that forced everything to the shop was replaced with `productPageFor()` resolution by Shopify handle → title keyword → fallback). Shop product cards gained a "Full details: fabric, design & care →" link. `handle` is now captured from Shopify. Added all three to `sitemap.xml` (43 URLs, valid XML).

**Validated:** tag balance, comment balance, JSON-LD parse, inline JS `node --check`, all 9 referenced images exist, all internal link targets resolve, all three serve 200 locally. Image `src`s are **relative** (`../../shirts/…`) so the pages preview correctly by file *and* when deployed; og/JSON-LD image URLs stay absolute.

**To add product 4:** copy a product folder, change the `--accent` vars, head meta + JSON-LD, gallery images and copy blocks, then add the slug to `PDP_SLUGS` in both `homepage-preview.html` and `shop-preview.html`, and to the sitemap. (Longer term this is a good candidate to move into `build.js` alongside the location generator.)

## Homepage place cards — cover photos (2026-07-22)

The "Places that inspire us" cards were rendering flat CSS gradients with no photography.

- `.place-bg` now supports a real cover image (`background-size:cover; background-position:center`), set via an inline `background-image`. The existing per-card gradients stay underneath as a **graceful fallback**, and the existing `.place::after` scrim already keeps the white label text legible over a photo.
- Wired the two places that actually have cover assets, reusing the same `/uploads/` images the `/locations/` pages use (both verified as serving live — 2720×1530 dune drone shot and a 1008×1792 Hajar portrait):
  - **Al Quaa Desert** (p1) → `/uploads/sahra_and_beyond_widedunes_dji_0457_t24.5s.jpg`
  - **Wadi Showka** (p3) → `/uploads/17951464709964948.webp`
- **Asset gap (user-side):** only **9 of 24** location JSONs have a `cover` set, and **Wadi Naqab (p2) and Liwa (p4) are not among them** — so those two cards keep their gradient for now. An HTML comment in the place row documents exactly how to wire them once photos exist. Note both are tee inspirations, so they're the most worth shooting.
- Note: `/uploads/` is **not present in this local working copy** (only `shirts/` is) — those media live on the deployed site / come in via Decap CMS. Paths were verified against the live site rather than the filesystem.

## Shop map fixes — wrong pin + missing tee (2026-07-22)

Two separate bugs behind "the map shows 2 tees instead of 3, and Al Quaa is in the wrong place."

- **Wrong coordinates (Al Quaa).** The shop's `PLACES` map had `al-quaa-desert` at **23.6, 55.48**, but the authoritative source — `/locations/al-quaa-desert/` JSON-LD and `content/locations/al-quaa-desert.json` — says **23.52924, 54.75339**. That's roughly 75 km off in longitude, dropping the pin in the wrong part of the desert. Corrected to the location-page values; Liwa and Wadi Naqab already matched exactly. Added a comment noting these must stay in sync with `/locations/`.
- **Missing third pin (root cause: exact-match slug lookup).** `buildMap()` did `PLACES[p.placeSlug]` — an exact key match. In live Shopify mode `placeSlug` comes from `tagVal(tags,'placeurl') || slugify(place)`, so a product tagged `place:Al Quaa` slugifies to **`al-quaa`**, which does *not* match the key **`al-quaa-desert`** — the tee was silently dropped from the map, and also lost its GPS/Bortle meta line and place blurb on the product card. Liwa and Wadi Naqab happened to slugify exactly, which is why only that one tee vanished.
  - Fix: added `resolvePlace(slug,title)` — exact key → alias table (`al-quaa`, `alquaa`, `quaa`, `liwa-dunes`, `hajar`, `naqab`, …) → keyword fallback on slug+title — plus `placeInfo(p)` returning `{slug,data}`.
  - `normalizePlaces()` runs right after products load (both DEMO and Shopify paths) and rewrites `placeSlug` to the **canonical** slug, so the map pin, section `id`, `#prod-` anchors and `/locations/` links all agree regardless of Shopify tagging.
  - All bare `PLACES[...]` lookups replaced with `placeInfo()` (map, product card, JSON-LD).
- Validated: inline JS passes `node --check`; resolver spot-checked against tag variants — all three tees resolve correctly even with **no** place tag at all (3/3 pins), while an unrelated product correctly resolves to null (no pin).

## TGM-benchmark additions (2026-07-22)

Reviewed against The Giving Movement (top UAE apparel brand). Implemented the self-contained, accuracy-safe borrowings — commercial scaffolding they have and we lacked. **Only confirmed claims used** (no "free delivery" — delivery fees are still a policies placeholder).

- **Announcement bar (shop).** Repurposed the `#mode-note` top bar: when live (`DEMO=false`) it now shows *Free UAE returns · Designed in the UAE · Limited first drop* instead of being hidden. (Previously the live shop had no announcement bar at all.)
- **Announcement content (homepage).** Wove trust claims into the existing marquee: *Free returns within the UAE · Designed in the UAE · Limited first drop*, alongside the brand slogans.
- **Accuracy fix: "Made in the UAE" → "Designed in the UAE"** everywhere (8 instances across all pages). Fabric is sourced from Pakistan, so the garment isn't UAE-made; "Designed in the UAE" is the honest claim. Now consistent with the shop's trust band, which already used it.
- **Occasion / lifestyle framing (shop).** Per-product "Made for …" line via `occasionFor(p)` — stargazing nights (Al Quaa), dune drives (Liwa), mountain mornings & wadi hikes (Hajar). Sells *when/where you'd wear it*, TGM-style.
- **"Read the place story" link (shop).** Explicit editorial CTA under each product's place-lead, linking to the `/locations/` page — surfaces our richest, most-differentiated asset (the place stories) as the "Learn more" half of each product, the pairing TGM does with Shop/Learn-More.
- **Shop-by-place jump nav (shop).** `draw()` now renders a "Shop by place:" chip row (generated from live products) — multiple entry points into a single-scroll catalogue, our distinctive spin on TGM's Shop-by-Colour/Category.
- **Community invite (homepage).** "Tag @sahraandbeyond.ae to be featured" line under the collection — seeds UGC/community proof without any fake imagery.

Validated: inline JS passes `node --check` on both pages.

### Mission / give-back — BUILT 2026-07-22
Chosen commitment: **a share of every sale funds ghaf tree planting via Give a Ghaf (Goumbook's UAE native-tree program).** Single brand-wide activity, on-brand (ghaf = UAE national tree, the desert the whole collection is drawn from).

> **Mechanic note (2026-07-22):** originally drafted as literal "1 tee = 1 ghaf," but Give a Ghaf's *individual* pricing is ~AED 35–42 per seed — ~25% of the AED 149 retail price, above gross margin, so a 1:1 pledge is unviable. Reframed to a non-numeric **"a share of every sale"** (margin-safe, honest, no fixed tree count to defend). Two follow-ups for the user: (1) ask Goumbook's **Companies/bulk program** for a corporate rate — far cheaper per tree than the gift channel; (2) optionally make the claim specific ("X% of every sale") once a figure is committed. All copy in the band, `commitment.html`, shop buy-line and trust band now uses share-of-sale language.
- **Homepage mission band** ("For every tee, a ghaf tree") in a deep ghaf-green section between the story and newsletter, with a 1:1 / national-tree / ~35kg-CO₂ fact row and a CTA to the commitment page. Section carries its own melt divider so the colour chain is intact.
- **`commitment.html`** — new page (styled to match `policies.html`): the pledge, why the ghaf, Give a Ghaf/Goumbook explainer, how-it-works, and an explicit "kept honest" note. Linked from homepage + shop footers.
- **Honesty guardrails baked in:** an HTML comment on both the band and the page flags that the Give a Ghaf partnership must be finalised before going live, and that **no "trees planted" counter is published until it reflects real, verified plantings**. Facts (ghaf = national tree, Give a Ghaf launched 2011 by Goumbook, ~35kg CO₂/yr) verified via web before writing.
- **Shop point-of-purchase (2026-07-22):** each product now shows a "🌱 This tee plants a ghaf tree in the UAE →" link under the buy button (`.buy-ghaf`, links to `commitment.html`; green tuned per light/dark section), and the bottom trust band gained "A ghaf tree planted per tee." So the commitment shows up right where the buy decision happens, not only on the homepage.

### Still proposed, not yet built (need a decision or assets)
- **Bundle / "The Collection" set** — AOV lever; needs a Shopify bundle product or discount code + a price decision.
- **On-site UGC grid** — needs real customer/founder photos.

## Product proof / conversion detail (2026-07-22)

Surfaced the confirmed garment specs where a shopper actually sees them (they were previously absent or buried), to close the "is this worth AED 149?" gap.

**Shop (`shop-preview.html`):**
- **Spec strip** — a scannable pill row added directly under the price, above the size selector: *230gsm organic cotton · Ribbed crew neck · Taped collar & shoulder seams · [print method]*. This is the highest-value real estate and doesn't require opening the accordion.
- **"Limited first run"** cue in two places: a badge above the product title and a scarcity line under the add-to-cart button (*"once it's gone, it's gone"*).
- **Fabric weight corrected 240 → 230gsm** everywhere it appeared.
- **Construction** added to the "Details & care" accordion: ribbed crew-neck collar; taped collar & shoulder seams for shape retention / longevity.
- **Per-product print method** driven by `printFor(p)`: prefers a Shopify `print:` tag (`print:DTG` / `print:Embroidered`); otherwise defaults by design — Liwa/dune = tonal embroidery, everything else (Al Quaa, Hajar) = DTG "soft & breathable". Surfaced in both the spec strip (short form) and the accordion (long form). To set explicitly per product, add a `print:` tag in Shopify.

**Homepage (`homepage-preview.html`):**
- Collection cards now carry a **"Limited"** badge (all three, replacing the single "New"); the collection subhead reads "each a limited first run…".
- **"Made to last" quality band** added directly under the product cards (inside the `.shop` section, so no melt/section-colour changes needed): a 4-up grid — *230gsm heavyweight organic cotton · ribbed crew neck + taped collar & shoulder seams · soft-to-wear DTG prints & tonal embroidery · limited runs*. Phrased to cover **both** print methods truthfully (DTG + Liwa's embroidery), so it stays accurate as a homepage-level claim. Collapses to 2-up on mobile.

Validated: inline JS passes `node --check` on both pages; print-method logic spot-checked per product (Liwa→embroidery, others→DTG, tag overrides). All new copy reflects **confirmed** specs (no invented claims). On-body/lifestyle photography + macro fabric shots are still the biggest remaining conversion lever (user-side, closer to launch).

---

## Site audit + fixes (2026-07-22)

Triggered by a screenshot showing internal dev-text leaking onto the shop page and a wrong Instagram handle. Full-site pass.

**Fixed in code:**
- **Leaked dev note (P0 bug).** `shop-preview.html` had a nested HTML comment — the reviews-section note contained an inner `<!-- app widget/embed goes here -->`, whose `-->` closed the outer comment early, dumping "Do NOT ship placeholder/fake reviews…" and stray `</div></section>` onto the live page. Rewrote the note as a single non-nested comment. Swept all five top-level pages; comment nesting now balanced everywhere.
- **Instagram handle.** Corrected `@sahra_and_beyond` / `instagram.com/sahra_and_beyond` → **`@sahraandbeyond.ae`** / `instagram.com/sahraandbeyond.ae` in `homepage-preview.html`, `shop-preview.html`, `coming-soon.html`, `policies.html`. (Homepage JSON-LD `sameAs` and `index.html` were already correct.) The image filename `sahra_and_beyond_widedunes_…jpg` is unrelated and left untouched.
- **Broken internal link.** Homepage "Places that inspire us" linked "Jebel Jais" → `/locations/jebel-jais/`, which 404s (no such page). Repointed to the existing **Wadi Showka** page (`RAK · Hajar foothills`) per user choice. Cards use gradient backdrops, so no image mismatch.
- **Placeholder legal page was indexable.** `policies.html` (`index,follow`) renders 10 visible bracketed placeholders (`[LICENCE NUMBER]`, `[TRN]`, `[address]`, `[courier]`, fees, `[DATE]`). Set to **`noindex,follow`** with a comment to flip back once real values are filled — don't let Google index placeholder legal text.
- **Price consistency.** Demo-mode cart fallback used `129`; bumped to `149` to match the real AED price.

**Verified clean:** all `<img>` on the four main pages have `alt`; no visible bracket-placeholders in the body of home/shop/coming-soon/index; inline JS passes `node --check` on all five pages; shop is in live mode (`DEMO=false`, real Shopify domain+token).

**Flagged for user / launch (not code bugs):**
- `homepage-preview.html` still links the shop as `shop-preview.html` (5×) — rewrite to `/shop/` at launch cutover.
- `policies.html` placeholders need real values before taking orders (UAE law) and before flipping policies back to `index`.
- Size-guide measurements + the 240gsm/organic-cotton spec still need confirming against real blanks (pre-existing P1).

---

## The honest headline

The **aesthetic and technical foundation are genuinely strong** — the type system (Playfair / Inter / Space Mono), the sand-to-dusk palette, the scroll-colour journey, the editorial product sections, the map-as-store, and the magnetic/tilt micro-interactions are a level above most first-drop apparel sites. That's not where the risk is.

The gap to launch is three things, in order:
1. **Placeholder content dressed up as real** — reviews, measurements, lifestyle photos, stats, story image. A premium shell around fake content reads as *less* trustworthy, not more.
2. **Copy/strategy drift from the pivot** — the pages still say things that aren't true anymore ("prints", "Shop the collection" while the shop is dark).
3. **Conversion & trust fundamentals** that a beautiful site can still miss — real policies, product detail, payment trust, performance.

**Recommendation: spend the pre-launch effort replacing placeholders with real substance and tightening the funnel — not adding more animation.** The site is already over-indexed on motion; it's under-indexed on proof.

---

## P0 — Launch blockers

**1. Kill the fake reviews.** The shop's `#reviews-list` ships two hardcoded 5-star "placeholder review" cards. Fake reviews are a trust-killer and a legal/consumer-protection risk. Before launch: either connect a real review app (Judge.me / Loox / Okendo), or **hide the reviews section entirely** until you have real ones. Do not launch with placeholder testimonials visible.

**2. Confirm the size-guide measurements.** The measurements table is `TODO` placeholder numbers. Shipping a guide with wrong chest/length/sleeve figures directly causes returns and 1-star reviews. Measure a real sample of each fit and replace the placeholders before anyone can buy.

**3. Reconcile the copy with reality (post-pivot drift):**
   - Homepage hero says *"Original tees **and prints**…"* — prints were dropped. Remove "and prints" everywhere.
   - Homepage stat "**40 places explored**" etc. are invented round numbers — make them true or cut them.
   - The homepage "It started with a camping trip in the desert" story block and `#storyimg` need real copy + a real image, or trim.
   - Decide the launch state: homepage + shop go live *at launch*; right now `coming-soon.html` is the front. Make sure the homepage's "Shop the collection" CTA isn't live before the shop is.

**4. Real product photography end-to-end.** You now have the final flat-lays (galaxy, dune front, mountains). The **shop and homepage still pull the old mockups** (`design-*-front/back.jpg`) or Shopify images. Replace with the finals, and drop the **lifestyle photos** into the TODO slots (the `.lifestyle-slot` bands and homepage `hero-lifestyle.jpg` are still empty placeholders). Empty/again-placeholder imagery is the #1 thing that will make it feel unfinished.

**5. Legal / UAE e-commerce compliance.** The footer has none of the required elements. UAE online-retail rules (and basic trust) require, visibly linked: **trade licence number**, **returns/refund policy**, **shipping policy & timeframes**, **sizing**, **privacy policy**, **terms**, and a **contact method**. Add a footer nav + these pages before taking payments.

**6. Shipping & returns specifics.** "Free returns within the UAE" is a good line but needs a real policy: cost outside UAE, delivery estimate (e.g., "2–4 working days"), courier, how to return. Ambiguity here kills checkout.

**7. Shopify data parity.** Add-to-cart only works once products are live with the exact `Size × Fit` variant structure your CSV/site expects. Verify variants, prices (AED), inventory, and the `place:` / `theme:` / `placeurl:` tags match, so the live shop renders places, colours, and fits correctly.

---

## P1 — High-impact improvements

**Hero (both pages)**
- **One primary action, not two competing ones.** The homepage hero has "Shop the collection" *and* "The places behind them" at equal weight. Make one primary (filled) and one clearly secondary (text link), so the eye isn't split.
- **LCP risk:** the hero headline animates in from opacity 0 via GSAP after a preloader wipe. That's beautiful but delays the largest contentful paint and hides the H1 from the first frame. Ensure a no-JS / reduced-motion fallback shows the headline immediately (there's an `anim-ready` gate — verify the H1 is visible if JS is slow).
- The shop hero and homepage hero use **different background treatments** (shop = CSS sky + canvas; home = Three.js). Pick one hero language so the two pages feel like one site (see Consistency).

**Product presentation (shop) — this is where money is made**
- Add the **substance a buyer needs**: fabric weight (GSM), 100% organic cotton, fit notes, **model height + size worn**, **care instructions**, and a **delivery estimate on the product** ("Order today, get it by …").
- Expand the **"inspired by" story** per product — right now it's one line + a GPS chip. This is your entire differentiator; give it 2–3 sentences and the coordinates as a design detail (the finals already print coordinates — echo them).
- **Stock / scarcity** cue for a lean drop ("Limited first run") — honest urgency converts.
- Front/back gallery is good; make sure the **first image is the hero graphic** (the back print is the star on these designs).

**Trust & credibility**
- **Payment method icons** + "Secure checkout" near the add-to-cart and in the footer (Visa/Mastercard/Apple Pay/the UAE gateway).
- Surface **"Designed in the UAE"**, **organic cotton**, and any real certification as badges near the buy button, not just once in the trust row.
- **Social proof:** an Instagram strip / follower count / "as worn at [event]" once you have it. Real UGC > placeholder reviews.

**Performance (measure before launch)**
- You're loading, across the two pages: **Three.js (r128), a canvas particle system, GSAP + ScrollTrigger, Lenis, Leaflet, a Shopify GraphQL fetch, custom cursor, ambient WebAudio, and a grain overlay.** That's a lot. Run Lighthouse; likely issues: **TBT/long tasks** (Three.js + GSAP), **LCP** (hero), **CLS** (Shopify-injected cards/images without reserved space).
- Fixes: lazy-init Leaflet only when the map scrolls into view; defer/limit the Three.js scene on mobile & low-power; reserve image dimensions to stop layout shift; `loading="lazy"` on below-fold images (mostly done); consider dropping the Three.js homepage hero in favour of the lighter shop-style hero.

**Accessibility (real gaps)**
- **Contrast:** gold (`#E9B978`) text on the sand background fails WCAG AA for small text — check every gold-on-light instance (eyebrows, links).
- **Focus states:** custom cursor + magnetic buttons — ensure visible `:focus-visible` outlines for keyboard users; the custom cursor must not replace focus indication.
- **Reduced motion:** you gate a lot behind `anim-ready` / `prefers-reduced-motion`, which is great — audit that the ambient audio, marquee, and canvas all fully stop and that content is fully visible when motion is off.
- **Alt text & headings:** ensure every product image has descriptive alt (mostly done), and there's a single logical H1→H2 order per page.

**SEO / shareability**
- Add **Product structured data** (JSON-LD `Product` + `Offer`) on shop product sections — critical for a store.
- **OG/Twitter images** should be the real hero photography, not the icon. Each product ideally has its own OG image.
- Per-page `<title>`/meta are decent on locations; make sure `/shop` gets indexed only *after* launch (noindex until then), and is added to the sitemap at launch.

---

## P2 — Polish / delight

- **Restraint pass on motion.** The custom cursor + magnetic buttons + tilt + glare + scroll-colour + ambient audio + grain is a *lot* at once. A world-class site knows when to hold back — consider making the custom cursor desktop-only-subtle and the grain lighter, so the product photography is the star.
- **The map-as-store is a signature** — lean into it: richer pins, a "shop by place" that filters, cluster as the catalogue grows.
- **404 page, favicon/app-icons, and empty/loading states** styled to brand.
- **Newsletter/waitlist consistency** — same component, same Kit wiring, same success state on every page (mostly there now).
- **Wishlist / "notify me when back"** for sold-out sizes (you already model availability).

---

## What's already strong (keep it)

- The type system and palette are distinctive and premium.
- The scroll-linked background colour journey (now a smooth lerp) is a genuine signature.
- The editorial full-section product layout with GPS/Bortle place-context is a real differentiator no competitor has.
- The Size × Fit model, front/back gallery, magnifier + lightbox are well above first-drop norms.
- Mobile has been made genuinely responsive (mobile-first single column).
- Kit email capture is properly wired with real success/error handling.

---

## Suggested order of execution (pre-launch)

1. **Content truth pass (P0):** remove fake reviews, fix "prints"/stats/story copy, confirm measurements. *(fast, high trust impact)*
2. **Real imagery (P0):** finals + lifestyle into shop + homepage, replace mockups. *(you have the assets)*
3. **Policy + footer + compliance (P0):** returns/shipping/privacy/terms/licence, payment icons. *(unblocks legal launch)*
4. **Product-detail depth + trust badges (P1).**
5. **Performance + accessibility audit (P1).**
6. **Consistency pass across home ↔ shop (P1).**
7. **Polish/restraint + SEO structured data (P2).**

*Prepared as a working punch-list — tackle top-down; items 1–3 are the difference between "looks like a real brand" and "looks like a template with placeholder text."*

---

## Implementation log — product depth, performance & accessibility (2026-07-21)

*What's now done in code, and what still needs a human/tooling step.*

### ✅ Product-detail depth + trust signals (shop) — DONE
- Every product now renders a native **"Details & care"** accordion (`<details class="prod-acc">`): **Fabric** (heavyweight 100% organic cotton, ~240 gsm, pre-washed), **Fit** (unisex, Regular vs Oversized), **Print** (original artwork inspired by the specific place), **Care** (machine wash cold inside-out, hang dry, don't iron the print), **Delivery** (ships in 1–2 working days · free UAE returns). Collapsed by default so it doesn't fight the buy flow; keyboard- and screen-reader-native via `<details>/<summary>`.
- Added a **`.buy-trust`** line directly under the add-to-cart button on every product: *↺ Free UAE returns · ⚐ Made in the UAE · ✦ Organic cotton*.
- **Still manual before launch:** confirm the ~240 gsm / organic-cotton claims against the actual blanks you print on (don't state a spec you can't stand behind); add **model height + size worn** once you shoot on-body; add an honest **"Limited first run"** scarcity cue if true; wire a **real** review app when you have real reviews.

### ✅ Performance pass — DONE (code) / MEASURE (tooling)
- **Leaflet is now lazy-loaded.** Removed the eager `<link>`+`<script>` from `<head>`; the library's CSS/JS are injected only when `#uae-map` scrolls within 400px of the viewport (IntersectionObserver → `loadLeaflet()` → `renderMap()`). This removes ~150KB of blocking JS/CSS from initial load on the shop page. Graceful fallback if IntersectionObserver is unavailable.
- **CLS is already controlled:** product images reserve space via `aspect-ratio:4/5`; homepage cards/spots/places/story all have explicit `aspect-ratio`. No layout-shift work needed.
- **Still manual before launch:** run **Lighthouse** on both pages (mobile profile). Expected remaining offenders are Three.js (r128, homepage hero) and GSAP/ScrollTrigger for TBT/long-tasks — both are deliberate brand motion, so the call is *whether* to trim, not a bug. If mobile TBT is poor, the cheapest win is swapping the homepage's Three.js hero for the lighter shop-style CSS+canvas hero.

### ✅ Accessibility pass — DONE
- **Skip link** added to both pages (`.skip-link` → `#products` on shop, `#shop` on home): visually hidden until focused, first thing in the tab order.
- **Visible keyboard focus:** added `:focus-visible` outlines (2px `currentColor`, 3px offset) on links, buttons, inputs, `<summary>`, size/fit chips — adapts to light/dark sections automatically since it uses the element's own text colour.
- **Custom cursor is NOT an a11y problem:** verified neither page uses `cursor:none`, so the real system cursor is never hidden — the custom cursor is purely additive/decorative and keyboard focus is unaffected.
- **Still manual before launch:** run the Lighthouse/axe **contrast** audit specifically on gold (`#E9B978`) text — eyebrows/links already use the darker `--clay-deep` (`#9C521B`) on light backgrounds, but confirm no small gold text sits on sand; and confirm ambient audio + marquee + canvas fully halt under `prefers-reduced-motion`.

### Validation
- Both `shop-preview.html` and `homepage-preview.html` pass `node --check` on all inline JS blocks after these changes.
- Homepage already ships JSON-LD `WebSite` structured data (partial P1 SEO). **Still to add:** per-product `Product`+`Offer` JSON-LD on the shop.

## Implementation log — shop Product JSON-LD (2026-07-22)

### ✅ Per-product `Product`+`Offer` structured data (shop) — DONE
- Added `injectProductJsonLd(products)` to `shop-preview.html`, called at the end of `draw()` (after products render from live Shopify data). It builds a single `<script type="application/ld+json" id="ld-products">` containing a `@graph` of `Product` nodes and appends it to `<head>`; re-running `draw()` removes the stale node first, so it stays in sync with whatever Shopify returns.
- Each `Product` carries: `name`, `brand` (Sahra & Beyond), canonical `url` (`/shop/#prod-{placeSlug}`), `image[]` (relative paths resolved to `https://www.sahraandbeyond.ae`, Shopify CDN URLs passed through untouched), `description` (product story, falling back to the place blurb), `material` (Organic cotton), and an `Offer` with `priceCurrency`, `price` (rounded min-variant price), `itemCondition` NewCondition, and `availability` set per real variant stock — `InStock` if any variant is available, else `OutOfStock`.
- Wrapped in try/catch; it's a pure SEO enhancement and never blocks render. Validated: inline JS passes `node --check`; simulated output parses as valid JSON and conforms to schema.org Product/Offer shape.
- **Remaining P1 SEO/consistency:** home↔shop hero consistency pass (shop = CSS sky + canvas; home = Three.js) and a mobile Lighthouse run.

## Implementation log — home↔shop hero consistency (2026-07-22)

### ✅ Hero consistency pass — DONE
- **Finding:** the handover's framing ("shop = CSS sky + canvas; home = Three.js") is outdated. Both `homepage-preview.html` and `shop-preview.html` already run the **same** Three.js desert-night hero: identical star field (`makeStars(TOUCH?900:2300)` + Milky-Way band), nebula sprite, crescent moon, procedural photoreal dune terrain shader, shooting stars, and **identical camera motion** (`ty=3.2-my*.5+min(scrollY,600)*.004`; mouse parallax `*1.1`/`*.045`; `lookAt(x*.35,4.6,-30)`). Verified line-by-line — no divergence at the WebGL level.
- **The only real divergence was the CSS backdrop** that shows through the transparent (`alpha:true`, clear alpha 0) WebGL canvas and doubles as the pre-load / no-WebGL fallback. Unified the homepage to the shop's canonical spec:
  - `.sky` gradient → `#14102A → #39295A → #8B4E63 → #B96A2C → #E3B274` (was `#171232 → #3A2A5C → #8B4E63 → #C0702E → #EDC079`). Deeper indigo top gives the star field more contrast; muted sand base reads less "candy" than the old bright gold.
  - `.sky` timing → `background-size:100% 200%`, `18s`, keyframe `to 42%` (was `220%` / `16s` / `46%`).
  - Hero vignette `::after` → `rgba(10,6,16,.42)` (was `.4`).
- **Left intentionally different** (page role, not inconsistency): hero **height/layout** — home is full-height `100vh` two-column landing (text + product spot); shop is `88vh` centered catalog header. And hero **copy** — home is first-person brand intro ("…dunes and dark-sky nights we've explored…"), shop is the neutral catalog line ("…wadis and dark-sky nights of the Emirates"); the shared eyebrow already matches. Forcing these identical would make the pages feel copy-pasted.
- **Not touched:** the CSS `.stars` fallback scatter differs slightly between pages, but it's hidden under `html.webgl` and never visible alongside the other page — aligning it adds risk with no visible payoff.
- Validated: both pages pass `node --check` on all inline JS after the change (CSS-only edits, but re-checked).
- **Remaining P1:** mobile **Lighthouse** run (expected offender is the Three.js hero TBT — deliberate; trim only if poor).
