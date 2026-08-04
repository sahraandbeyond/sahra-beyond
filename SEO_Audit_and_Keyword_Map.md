# SEO Audit & Keyword Map — Sahra & Beyond
**Date:** 4 August 2026 · 49 pages audited · Domain: www.sahraandbeyond.ae
**Status: Phases 1 & 2 implemented 4 Aug 2026 — see log at foot of document.**

---

## ⚠️ Finding that outranks everything else in this document

**Ahrefs Domain Rating: 0.0.** Zero authority, effectively no referring domains.

This reframes the whole plan. On-page SEO decides *which* queries you can compete for; **domain authority decides whether you compete at all.** At DR 0 you will not rank for anything with commercial competition, no matter how good the pages are. The work below is necessary and now done — but it is not sufficient on its own.

**Link acquisition is now the binding constraint, not content.** Realistic first moves for a UAE micro-brand:
- UAE lifestyle/outdoor press and blogs — the *travel content* is the hook here, not the t-shirts. Your 24 location guides are genuinely link-worthy; the shop is not.
- Give a Ghaf / Goumbook partnership page listing (do the partnership, get the link)
- Local business and startup directories, SPC Free Zone member listings
- Founder interviews on UAE entrepreneurship podcasts and newsletters
- Reddit r/dubai and UAE Facebook camping groups — traffic and citation, even if nofollow

Target: **DR 10–15 within 6 months.** Below that, expect near-zero organic commercial traffic regardless of page quality.

*Note: Ahrefs is authenticated but the subscription does not include API access — Keywords Explorer and usage endpoints return "Insufficient plan". Only the free domain-rating endpoint responds. Search volumes below remain judgement-based. An Ahrefs API-tier plan or Google Keyword Planner would replace them with real figures.*

---

## The headline finding

**You have built a UAE outdoor travel publisher that happens to sell t-shirts — and the two halves are not connected.**

| | Pages | Share |
|---|---|---|
| Travel content (24 location pages + 13 guides) | 37 | **76%** |
| Product / commerce | 3 | 6% |
| Brand, legal, utility | 9 | 18% |

That content library is a real asset. But three measurements show it is currently doing nothing for the business:

1. **Zero internal links from any travel page to any product page.** Checked `/camping/`, `/stargazing/`, `/camping-near-dubai/`, `/wadis/`, `/desert-safari/` — all return **0** product links. Someone lands on your camping guide, reads 943 words, and leaves. There is no path to a product.
2. **The word "t-shirt" appears once on the entire site.** You say "tee" 951 times. Almost nobody searches "tee".
3. **No page targets commercial apparel intent at all.** "graphic tee" — 0 pages. "oversized t-shirt" — 0. "streetwear" — 0. "premium cotton" — 0. "clothing"/"apparel" — effectively 0.

You are invisible to everyone who wants to *buy a t-shirt*, and unconverting to everyone who finds your travel content.

---

## Technical audit

| Issue | Severity | Detail |
|---|---|---|
| No product links from 37 content pages | **Critical** | The entire funnel is disconnected |
| "Tee" used instead of "t-shirt" sitewide | **Critical** | Missing the highest-volume head term in the category |
| No commercial landing pages | **Critical** | No collection/category page targeting buy-intent |
| `shop-preview.html` has **no meta description**, 31-char title | High | This becomes your money page at launch |
| 34 of 49 titles exceed 60 characters | Medium | Truncated in SERPs; " \| Sahra & Beyond" eats budget on every page |
| `coming-soon.html` duplicates `index.html` | Low | Canonical points to `/`, so it consolidates — but it's a redundant crawlable URL |
| `robots.txt` | ✅ Fine | Correctly disallows `/admin/`, declares sitemap |
| Sitemap: 43 URLs, 3 products | ✅ Fine | Structure is sound |
| Meta descriptions on content pages | ✅ Good | 130–177 chars, well written |
| One H1 per page | ✅ Good | Clean across all 49 |

**Note on data:** I have no keyword-volume tool connected. Your marketing plugin includes **Ahrefs** and **SimilarWeb** connectors but they are **not authorised** — enabling them (or using Google Keyword Planner) would let us replace the judgement-based priorities below with real volumes. Rankings here are based on intent strength × winnability, not measured volume.

---

## Competitive reality check

**Head commercial terms are unwinnable and you should not chase them.** "graphic tees Dubai" and "buy t-shirts online UAE" are held by H&M UAE, Namshi, Amazon UAE, Dropkick, plus established local specialists Teeser.ae and Vasl Hub — and the remaining SERP slots are taken by affiliate listicles. A new domain will not break that.

**But the souvenir/gift space is wide open.** "Dubai souvenir t-shirt" is dominated by print-on-demand marketplaces — Zazzle, Redbubble, Etsy, Amazon — selling generic skyline-and-camel graphics. That is *exactly* what you are not. A considered, limited-run tee tied to a real place is the natural answer to "I want a gift from the UAE that isn't tacky," and nobody is targeting that phrase set.

**That gap is your entry point.**

---

## Keyword map

### Tier 1 — Winnable + commercial intent (build first)

Nobody is combining "real UAE places" with apparel. This is your uncontested lane.

| Phrase cluster | Target page | Status |
|---|---|---|
| UAE t-shirt brand · local t-shirt brand UAE · Emirati clothing brand | **`/t-shirts/`** hub | ❌ Build |
| UAE inspired t-shirts · desert t-shirt · Arabic design t-shirt | `/t-shirts/` | ❌ Build |
| gift for someone leaving the UAE · farewell gift expat Dubai · goodbye gift UAE | **`/gifts/`** | ❌ Build |
| meaningful UAE souvenir · unique gift from Dubai · not touristy souvenir | `/gifts/` | ❌ Build |
| Milky Way t-shirt · astronomy t-shirt · stargazing apparel | Al Quaa PDP + `/t-shirts/` | ⚠️ Partial |
| desert camping t-shirt · what to wear camping UAE | **New guide** | ❌ Build |
| 230gsm t-shirt · heavyweight organic cotton t-shirt UAE | **`/fabric/`** | ❌ Build |
| oversized fit t-shirt UAE · t-shirt size guide UAE | **`/size-guide/`** | ❌ Build |

### Tier 2 — Informational, already built (needs conversion bridge)

You already rank-eligible here. The fix is not more content — it is **linking it to products**.

| Phrase cluster | Existing page | Fix |
|---|---|---|
| Milky Way in UAE · where to see stars UAE · dark sky UAE | `/stargazing/` | Add Al Quaa tee module |
| camping near Dubai · best camping UAE · desert camping beginners | `/camping/`, `/camping-near-dubai/`, `/desert-camping-beginners/` | Add product module |
| best wadis UAE · wadi hiking | `/wadis/`, `/locations/wadi-naqab/` | Add Hajar tee module |
| Liwa · Empty Quarter · Al Quaa · Wadi Naqab | 24 location pages | Only 3 have a tee block |

### Tier 3 — Do NOT chase

`graphic tees Dubai` · `buy t-shirts online UAE` · `oversized t-shirt Dubai` · `streetwear UAE`

Use these only as **modifiers inside** Tier 1 pages. Targeting them head-on wastes the budget.

---

## The "tee" → "t-shirt" fix

This is the single cheapest win on the list. Right now the site is optimised for a word people don't search.

**Rule:** keep "tee" as brand voice in body copy. Add "t-shirt" to every `<title>`, `<h1>`, meta description, and Product schema `name`/`description`.

| Now | Should be |
|---|---|
| Al Quaa Galaxy Tee — The Milky Way Over the UAE's Darkest Sky | Al Quaa Galaxy **T-Shirt** — Milky Way Design \| UAE |
| Empty Quarter Tee — Embroidered Sun Over the Dunes of Liwa | Empty Quarter **T-Shirt** — Embroidered Desert Design |
| Shop · Sahra & Beyond — Preview | UAE-Inspired **T-Shirts** — Limited Drops \| Sahra & Beyond |

Also shorten titles: 34 pages currently truncate in SERPs.

---

## Recommended build order

**Phase 1 — Connect what exists (highest ROI, no new content)**
1. Add a contextual product module to all 13 guides and 24 location pages. `build.js` already has `teeBlock()` — extend it to guides, and give places without a matching tee a generic "shop the collection" block.
2. "Tee" → "t-shirt" across titles, H1s, meta and schema.
3. Trim the 34 over-length titles.
4. Write a real title + meta description for the shop page.

**Phase 2 — Build the missing commercial pages**
5. **`/t-shirts/`** — collection hub. The page that should rank for "UAE t-shirt brand".
6. **`/gifts/`** — "Gifts from the UAE that aren't tacky." Your clearest uncontested opportunity.
7. **`/fabric/`** — 230gsm, ribbed collar, taped seams, DTG vs embroidery. Targets spec searches and does double duty as a trust page.
8. **`/size-guide/`** — standalone page, not just a shop anchor.

**Phase 3 — Bridge content**
9. "What to wear camping in the UAE desert" — the piece that turns camping traffic into apparel intent.
10. "Where to see the Milky Way in the UAE" — strengthen `/stargazing/`; it's your most on-brand ranking asset.

---

## What to measure

- **Search Console:** impressions for `t-shirt` queries — currently near zero, and the honest baseline for whether any of this worked.
- **GA4:** clicks on the new product modules from content pages. If content→product click-through stays under ~2%, the modules need repositioning, not more traffic.
- **Ranking check at 90 days:** `UAE t shirt brand`, `gift for someone leaving UAE`, `Milky Way UAE`.

Content SEO compounds slowly. Phase 1 should show movement in 4–6 weeks; Phases 2–3 in 3–4 months.

---

# Implementation log — 4 August 2026

## Phase 1 — Connected the funnel

**Product modules on all 37 content pages.** Was **0** product links across the entire content library; now every guide and location page carries one.

- Added `collectionBlock()` to `build.js` — three product cards linking to `/products/<id>/`, plus a route to `/t-shirts/`.
- Added `GUIDE_TEE` mapping so guides with a natural product match get that specific tee: stargazing/camping → Al Quaa, desert guides → Empty Quarter, wadis/mountains → Hajar. Guides without a match get the full collection.
- Replaced the generic `shopBlock` fallback on location pages, which only ever linked to `/shop/`.

Verified: `camping` 1, `stargazing` 1, `wadis` 1, `best-beaches` 3, `locations/big-red` 3 — previously all zero.

**"Tee" → "t-shirt".** The site said "tee" 951 times and "t-shirt" **once**. Now on **49 pages**, across titles, H1s, meta descriptions and Product schema. "Tee" is retained as brand voice in body copy.

**Title lengths: 34 over 60 chars → 2.** Added a rule in `shell()` dropping the " | Sahra & Beyond" suffix past the limit, plus an equivalent in `build-products.js` (PDPs bypass `shell()`). The three PDP titles were rewritten to fit. *Note: the original count of 34 was measured on HTML-escaped strings and overstated the problem — the true figure was lower. Both remaining pages are at 62 characters.*

**Shop page** finally has a real title and the meta description it never had.

## Phase 2 — Built the missing commercial pages

| Page | Targets | Words |
|---|---|---|
| `/t-shirts/` | UAE t-shirt brand · UAE inspired t-shirts · local clothing brand UAE | 780 |
| `/gifts/` | gift for someone leaving the UAE · farewell gift expat · meaningful UAE souvenir | 768 |
| `/fabric/` | 230gsm t-shirt · heavyweight organic cotton · DTG vs embroidery | 883 |
| `/size-guide/` | t-shirt size guide UAE · oversized fit measurements | 756 |

All four carry WebPage + BreadcrumbList + FAQPage schema, the product collection module, and use the existing page shell for design consistency. `/size-guide/` renders live measurements from the product JSON and **inherits the provisional-measurements notice** — so it cannot silently present unconfirmed figures as fact.

Added to sitemap at priority 0.9 (above guides at 0.8); `/t-shirts/` added to global nav. Sitemap 43 → **47 URLs**.

## Keyword coverage, before → after

| Term | Before | After |
|---|---|---|
| t-shirt | 1 page | **49 pages** |
| uae t-shirt | 0 | **31** |
| 230gsm | ~20 | 20 |
| organic cotton | 11 | **28** |
| oversized | 0 | **10** |
| gift | 1 | **2 dedicated pages** |
| souvenir | 0 | **2** |
| size guide | 0 | **3** |

## Verification

All new pages: tag balance, JSON-LD parse, comment balance clean; all serve 200. Full rebuild passes. `launch.js` still reports one blocker (provisional sizes) plus the mockup-photo warning — unchanged by this work.

## Not done — deliberately

- **`/blog/` bridge posts** ("What to wear camping in the UAE desert"). Phase 3; lower value until DR rises.
- **Chasing head terms** — `graphic tees Dubai`, `buy t-shirts online UAE`. Unwinnable at DR 0 against H&M, Namshi, Amazon and Teeser.
- **Backlink outreach** — the actual constraint, and not something that can be done from the codebase.
