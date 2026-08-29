#!/usr/bin/env node
/**
 * sync-reviews.js — pull approved Judge.me reviews into the repo.
 *
 *   node sync-reviews.js            # fetch and write content/reviews/*.json
 *   node sync-reviews.js --dry      # fetch and report, write nothing
 *   node sync-reviews.js --raw      # also dump the first raw record, for
 *                                     checking the API shape against reality
 *
 * Needs JUDGEME_TOKEN in the environment. Nothing else in the build needs it:
 * the site renders from the committed JSON, so a deploy never depends on a
 * live third-party API call, and the reviews on the site are reproducible from
 * the repo alone.
 *
 * Design notes:
 *  - Only PUBLISHED, non-hidden reviews are written. Moderation lives in the
 *    Judge.me admin; this script never second-guesses it.
 *  - Field names are normalised defensively. I could not test this against a
 *    real store (no reviews existed when it was written), so every field is
 *    read through a list of plausible names rather than one assumed name, and
 *    anything unrecognised is reported instead of silently dropped.
 *  - Product matching prefers the Shopify handle, since that is what our
 *    content/products/*.json is keyed on.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT_DIR = path.join(ROOT, 'content', 'reviews');
const PRODUCT_DIR = path.join(ROOT, 'content', 'products');
// tqcc1v-w4, NOT sahra-beyond. Both myshopify domains resolve to this store,
// but Judge.me authenticates against the store's REAL myshopify domain and
// rejects the alias with 'Shop domain or Api Token is wrong' — verified
// against the live API on 29 Aug 2026. The alias here would have made every
// sync fail even with a perfect token.
const SHOP_DOMAIN = 'tqcc1v-w4.myshopify.com';
const API = 'https://api.judge.me/api/v1/reviews';

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const RAW = argv.includes('--raw');

const TOKEN = process.env.JUDGEME_TOKEN;
if (!TOKEN) {
  console.log(`
sync-reviews needs your Judge.me API token.

  Windows:  setx JUDGEME_TOKEN "your-token-here"     (then reopen the terminal)
  one-off:  JUDGEME_TOKEN=... node sync-reviews.js

Find it in the Judge.me admin under Settings — use the PRIVATE token, not the
public one. The public token authenticates but the reviews API refuses it with
"not enough permissions" (verified 29 Aug 2026). Treat the private token as a
password: it does not belong in the repo, and it is never needed to build or
deploy the site.
`);
  process.exit(2);
}

/* the product handles we actually publish */
const HANDLES = fs.existsSync(PRODUCT_DIR)
  ? fs.readdirSync(PRODUCT_DIR).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''))
  : [];

/* The Judge.me PUBLIC widget displays these reviews as "Anonymous" even though
   the private API returns the buyers' real names. Whatever a platform chooses
   to withhold publicly, this site withholds too — a resync must never out a
   reviewer. Keyed handle|date; extend if future reviews display anonymously. */
const DISPLAY_OVERRIDES = {
  'al-quaa-galaxy-regular|2026-08-24': 'Anonymous',
  'al-quaa-galaxy-oversized|2026-08-29': 'Anonymous'
};

const pick = (obj, names, fallback = null) => {
  for (const n of names) {
    if (obj && obj[n] !== undefined && obj[n] !== null && obj[n] !== '') return obj[n];
  }
  return fallback;
};

/* Judge.me exposes the reviewer under a few shapes depending on endpoint. */
function reviewerName(r) {
  const direct = pick(r, ['reviewer_name', 'name', 'author']);
  if (direct) return String(direct);
  const nested = r.reviewer || {};
  return String(pick(nested, ['name', 'display_name', 'first_name'], 'Verified buyer'));
}

function isPublished(r) {
  /* Treat a review as publishable only if nothing says otherwise. Judge.me
     uses different flags across versions, so any one of them saying "no" wins. */
  if (r.hidden === true) return false;
  if (r.published === false) return false;
  if (r.curated && /^(spam|rejected|hidden)$/i.test(String(r.curated))) return false;
  if (r.verified_status && /rejected/i.test(String(r.verified_status))) return false;
  return true;
}

function normalise(r) {
  const rating = Number(pick(r, ['rating', 'score'], 0));
  return {
    id: pick(r, ['id']),
    rating: rating >= 1 && rating <= 5 ? Math.round(rating) : null,
    title: String(pick(r, ['title'], '') || '').trim(),
    body: String(pick(r, ['body', 'content', 'review'], '') || '').trim(),
    name: reviewerName(r),
    date: String(pick(r, ['created_at', 'reviewed_at', 'date'], '') || '').slice(0, 10),
    /* 'verified-purchase' is order-linked; plain 'buyer' is only an email
       match and does not justify a public "Verified buyer" claim. */
    verified: (function (v) { return v === true || /verified/i.test(String(v || '')); })(
      pick(r, ['verified_buyer', 'verified'], false)),
    photos: (pick(r, ['picture_urls', 'pictures', 'photos'], []) || [])
      .map(p => (typeof p === 'string' ? p : pick(p, ['urls', 'url', 'huge', 'original'], null)))
      .map(p => (p && typeof p === 'object' ? pick(p, ['huge', 'original', 'compact'], null) : p))
      .filter(Boolean),
    handle: pick(r, ['product_handle', 'handle'], null),
    externalId: pick(r, ['product_external_id', 'product_id', 'external_id'], null),
    productTitle: pick(r, ['product_title'], null),
    reply: String(pick(r, ['reply', 'shop_reply'], '') || '').trim()
  };
}

async function fetchPage(page) {
  const url = `${API}?api_token=${encodeURIComponent(TOKEN)}` +
              `&shop_domain=${encodeURIComponent(SHOP_DOMAIN)}&per_page=100&page=${page}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Judge.me returned ${res.status} ${res.statusText}. ${body.slice(0, 200)}`);
  }
  return res.json();
}

(async () => {
  let all = [], page = 1, rawSample = null;
  for (;;) {
    let data;
    try {
      data = await fetchPage(page);
    } catch (e) {
      console.log(`\n  ✗ ${e.message}\n`);
      console.log('  If this says the token or shop domain is wrong, re-copy the token');
      console.log('  from the Judge.me admin. Nothing was written.\n');
      process.exit(1);
    }
    const batch = data.reviews || data.data || [];
    if (!rawSample && batch.length) rawSample = batch[0];
    all = all.concat(batch);
    if (batch.length < 100) break;
    page++;
    if (page > 50) break;                       // safety valve
  }

  if (RAW && rawSample) {
    console.log('\n  raw field names returned by the API:');
    console.log('  ' + Object.keys(rawSample).join(', ') + '\n');
  }

  /* v1 LIST endpoint bug, hit in production: a review can carry
     has_published_pictures:true while its pictures array arrives EMPTY —
     the single-review endpoint returns them fine. Refetch those few. Videos:
     has_published_videos exists but NO v1 shape exposes video URLs at all;
     if a review claims one, say so in the log so a human can chase it. */
  for (const r of all) {
    if (r.has_published_pictures && !(r.pictures || []).length && r.id) {
      try {
        const one = await (await fetch(`${API}/${r.id}?api_token=${encodeURIComponent(TOKEN)}&shop_domain=${encodeURIComponent(SHOP_DOMAIN)}`)).json();
        if (one && one.review && (one.review.pictures || []).length) r.pictures = one.review.pictures;
      } catch (e) { console.log(`  ! could not refetch pictures for review ${r.id}`); }
    }
    if (r.has_published_videos) console.log(`  ! review ${r.id} claims a published VIDEO — no Judge.me API shape exposes its URL; check the Judge.me admin.`);
  }

  const publishable = all.filter(isPublished).map(normalise)
    .filter(r => r.rating && (r.body || r.title));

  /* group by product handle; fall back to matching on title if the handle is
     absent, and report anything we could not place rather than dropping it */
  const byHandle = {}, orphans = [];
  for (const r of publishable) {
    let h = r.handle && HANDLES.includes(r.handle) ? r.handle : null;
    if (!h && r.productTitle) {
      h = HANDLES.find(x => x.replace(/-/g, ' ').toLowerCase() ===
                            String(r.productTitle).toLowerCase().replace(/[^a-z0-9]+/gi, ' ').trim()) || null;
    }
    /* Store-level reviews (checkout, delivery, service) arrive with the
       pseudo-handle 'judgeme-shop-reviews'. They belong in the all-reviews
       bands, never on a product page — the '_shop' bucket does exactly that:
       loadAll() feeds the bands, and nothing ever calls productSection or
       cardRating with '_shop'. */
    if (!h && String(r.handle) === 'judgeme-shop-reviews') h = '_shop';
    if (!h) { orphans.push(r); continue; }
    const ov = DISPLAY_OVERRIDES[h + '|' + r.date];
    if (ov) r.name = ov;
    (byHandle[h] = byHandle[h] || []).push(r);
  }

  for (const h of Object.keys(byHandle)) {
    byHandle[h].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  const total = publishable.length;
  console.log(`\nsync-reviews — ${all.length} fetched, ${total} approved and publishable`);

  if (orphans.length) {
    console.log(`\n  ! ${orphans.length} review(s) could not be matched to a product handle:`);
    orphans.slice(0, 5).forEach(o =>
      console.log(`     "${(o.title || o.body).slice(0, 50)}" — product_handle: ${o.handle || 'none'}`));
    console.log('    These were NOT written. Check the product handles in Judge.me match Shopify.');
  }

  if (DRY) {
    for (const [h, list] of Object.entries(byHandle)) {
      const avg = list.reduce((n, r) => n + r.rating, 0) / list.length;
      console.log(`  ${h.padEnd(30)} ${list.length} review(s), avg ${avg.toFixed(2)}`);
    }
    console.log('\n  --dry: nothing written.\n');
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  /* Rewrite every product's file, including emptying one whose last review was
     removed in the Judge.me admin. Without this, deleting a review there would
     leave it live on the site forever. */
  let written = 0;
  for (const h of [...HANDLES, '_shop']) {
    const list = byHandle[h] || [];
    const file = path.join(OUT_DIR, `${h}.json`);
    if (!list.length) {
      if (fs.existsSync(file)) { fs.unlinkSync(file); console.log(`  - removed ${h}.json (no approved reviews)`); }
      continue;
    }
    const avg = list.reduce((n, r) => n + r.rating, 0) / list.length;
    const payload = {
      handle: h,
      count: list.length,
      average: Math.round(avg * 100) / 100,
      syncedAt: new Date().toISOString().slice(0, 10),
      reviews: list
    };
    fs.writeFileSync(file, JSON.stringify(payload, null, 1));
    written++;
    console.log(`  ✓ ${h.padEnd(30)} ${list.length} review(s), avg ${avg.toFixed(2)}`);
  }

  console.log(`\n  ${written} product file(s) written to content/reviews/`);
  console.log('  Commit these and push — the site rebuilds with the new reviews.\n');
})();
