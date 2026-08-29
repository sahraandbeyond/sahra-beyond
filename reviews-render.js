/**
 * reviews-render.js — one place that turns content/reviews/*.json into markup.
 *
 * Used by build.js (category cards, homepage band) and build-products.js (the
 * product page section) so the three surfaces cannot drift apart.
 *
 * The rule that governs all of it: **when there are no reviews, render nothing.**
 * No "0 reviews", no empty stars, no placeholder cards. A review section with
 * nothing in it reads worse than no review section, and an empty star row on a
 * product card actively looks like a bad rating. Every function here returns an
 * empty string when it has no real data.
 *
 * Nothing in here fabricates a rating, and no aggregateRating markup is emitted
 * — see docs/Reviews_Setup.md for why that stays off until there is a real body
 * of reviews.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'content', 'reviews');

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* Product display names for the band's per-review links. */
const PRODUCT_DIR = path.join(__dirname, 'content', 'products');
const _names = {};
function productName(handle) {
  if (handle in _names) return _names[handle];
  try {
    const d = JSON.parse(fs.readFileSync(path.join(PRODUCT_DIR, handle + '.json'), 'utf8'));
    return (_names[handle] = d.name || null);
  } catch (e) { return (_names[handle] = null); }
}

/* ---- photo viewing ------------------------------------------------------
   A 72px thumbnail nobody can open is decoration; the photo is the single
   most persuasive thing a review carries (Faheem: "this would massively
   impact UX"). Every thumbnail is therefore an <a> to the full-size image —
   which ALSO works with JavaScript disabled and for crawlers — and a tiny
   delegated script upgrades the click into an in-page lightbox: dark scrim,
   Escape or any click closes, focus moves to the dialog and returns to the
   thumbnail on close. Judge.me's CDN resizes by query param, so full size is
   the same URL at width=1024 (the widest their own widget requests). */
function fullSize(u) {
  return /width=\d+/.test(u) ? u.replace(/width=\d+/, 'width=1024') : u;
}
function photoLink(u, alt) {
  return `<a class="rv-photo-a" href="${esc(fullSize(u))}" target="_blank" rel="noopener"` +
         ` aria-label="Open customer photo full size"><img class="rv-photo" src="${esc(u)}" alt="${esc(alt)}" loading="lazy"></a>`;
}
/* One per page is enough; the guard makes any duplicate a no-op. Kept
   dependency-free and delegated so photos injected after load still work. */
const LIGHTBOX = `<script>(function(){if(window.__sbRvLB)return;window.__sbRvLB=1;
var last=null;
function close(){var d=document.getElementById('sbRvLB');if(d)d.remove();document.documentElement.style.overflow='';if(last&&last.focus)last.focus();last=null;}
document.addEventListener('click',function(e){
  var a=e.target&&e.target.closest&&e.target.closest('.rv-photo-a');
  if(a){e.preventDefault();last=a;
    var d=document.createElement('div');d.id='sbRvLB';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.setAttribute('aria-label','Customer photo');
    d.innerHTML='<img src="'+a.href+'" alt="Customer photo, full size"><button type="button" aria-label="Close photo">&times;</button>';
    d.addEventListener('click',close);
    document.body.appendChild(d);document.documentElement.style.overflow='hidden';
    d.querySelector('button').focus();return;}
  if(e.target&&e.target.id==='sbRvLB')close();});
document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
})();<\/script>`;

/** Reviews for one product handle, or null. */
function load(handle) {
  const f = path.join(DIR, `${handle}.json`);
  if (!fs.existsSync(f)) return null;
  try {
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (!d || !Array.isArray(d.reviews) || !d.reviews.length) return null;
    return d;
  } catch (e) {
    console.log(`  ! reviews for ${handle} could not be parsed: ${e.message}`);
    return null;
  }
}

/** Every product that has reviews. */
function loadAll() {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => load(f.replace(/\.json$/, '')))
    .filter(Boolean);
}

/* Stars are decorative — the rating is always stated in text beside them, so
   screen readers get the number rather than five identical star characters. */
function stars(rating) {
  /* floor, not round: Math.round(4.5) is 5, which would paint five filled stars
     beside the text "4.5 / 5". Understating by half a star is a safe error;
     overstating a rating is not, and the precise figure is always shown next
     to the stars anyway. */
  const n = Math.max(0, Math.min(5, Math.floor(Number(rating) || 0)));
  return `<span class="rv-stars" aria-hidden="true">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`;
}

function fmtDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return '';
  const [y, m] = String(iso).split('-');
  const months = ['January','February','March','April','May','June','July',
                  'August','September','October','November','December'];
  return `${months[Number(m) - 1] || ''} ${y}`.trim();
}

/** Compact rating for a product card. Empty string when there are no reviews. */
function cardRating(handle) {
  const d = load(handle);
  if (!d) return '';
  return `<span class="pcard-rv">${stars(d.average)}` +
         `<span class="pcard-rv-n">${d.average.toFixed(1)} · ${d.count} review${d.count === 1 ? '' : 's'}</span></span>`;
}

/** Full reviews section for a product page. Empty string when there are none. */
function productSection(handle, productName) {
  const d = load(handle);
  if (!d) return '';

  const cards = d.reviews.map(r => {
    const photos = (r.photos || []).slice(0, 2).map(u =>
      photoLink(u, `Customer photo of ${productName}`)).join('');
    const when = fmtDate(r.date);
    return `
        <li class="rv-card">
          ${stars(r.rating)}
          ${r.title ? `<strong class="rv-title">${esc(r.title)}</strong>` : ''}
          <p class="rv-text">${esc(r.body)}</p>
          ${photos ? `<span class="rv-photos">${photos}</span>` : ''}
          <span class="rv-meta">${esc(r.name)}${r.verified ? ' · Verified buyer' : ''}${when ? ' · ' + when : ''}</span>
          ${r.reply ? `<p class="rv-reply"><strong>Sahra &amp; Beyond:</strong> ${esc(r.reply)}</p>` : ''}
        </li>`;
  }).join('');

  return `
    <section class="sec reveal reviews" id="reviews" aria-labelledby="rv-h">
      <div class="wrap">
        <span class="snum">08 &mdash; What buyers say</span>
        <h2 id="rv-h">Reviews</h2>
        <div class="rv-aggregate">
          ${stars(d.average)}
          <span class="rv-score">${d.average.toFixed(1)} / 5</span>
          <span class="rv-count">from ${d.count} verified review${d.count === 1 ? '' : 's'}</span>
        </div>
        <ul class="rv-list">${cards}
        </ul>
        ${LIGHTBOX}
        <p class="rv-src">Collected and moderated independently via <a href="https://judge.me/authenticity" target="_blank" rel="noopener">Judge.me</a> &middot; <a href="https://checkout.sahraandbeyond.ae/products/${esc(handle)}" target="_blank" rel="noopener nofollow">Write a review &#8599;</a></p>
      </div>
    </section>`;
}

/**
 * Homepage band of selected quotes. Deliberately silent until there are at
 * least MIN reviews across the whole range: two quotes on a homepage reads as
 * thin rather than reassuring.
 */
const HOMEPAGE_MIN = 3;
function homepageBand() {
  const all = loadAll();
  const flat = [];
  for (const d of all) for (const r of d.reviews) flat.push({ ...r, product: d.handle });
  if (flat.length < HOMEPAGE_MIN) return '';

  /* ALL reviews, newest first, capped at 6. The band used to show the top 3
     while counting 4 — Faheem read that as a bug, and he was right: "from 4
     reviews" next to 3 cards looks like something is being hidden, which is
     the opposite of what a review band is for. Show everything until the
     count outgrows the cap. */
  const picked = flat
    .filter(r => r.body)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.rating - a.rating))
    .slice(0, 6);
  if (picked.length < HOMEPAGE_MIN) return '';

  const count = flat.length;
  const avg = flat.reduce((n, r) => n + r.rating, 0) / count;

  return `
  <section class="reviews rv-band" aria-labelledby="rvb-h">
    <div class="wrap">
      <span class="eyebrow" id="rvb-h">Worn and reviewed</span>
      <div class="rv-aggregate">
        ${stars(avg)}
        <span class="rv-score">${avg.toFixed(1)} / 5</span>
        <span class="rv-count">from ${count} review${count === 1 ? '' : 's'}</span>
      </div>
      <ul class="rv-list">
        ${picked.map(r => {
          /* Truncation rule, rewritten after Faheem's screenshot: the 190-char
             cut chopped every review mid-sentence with no way to read the rest —
             a dead end dressed as a teaser. Full text now shows up to 420 chars
             (every current review fits whole); only a genuinely long review is
             shortened, and ONLY when it has a fuller home to link to. The shop
             review has no product page, so it is never cut. */
          const isProduct = r.product && r.product !== '_shop';
          const cut = isProduct && r.body.length > 420;
          const body = cut ? r.body.slice(0, 417).trim() + '…' : r.body;
          const pname = isProduct ? productName(r.product) : null;
          const link = isProduct
            ? `<a class="rv-more" href="/products/${esc(r.product)}/#reviews">${cut ? 'Read the full review' : ('See it on ' + esc(pname || 'the product page'))} &rarr;</a>`
            : '';
          return `
        <li class="rv-card">
          ${stars(r.rating)}
          <p class="rv-text">${esc(body)}</p>
          ${(r.photos || []).length ? `<span class="rv-photos">${r.photos.slice(0, 2).map(u => photoLink(u, 'Customer photo')).join('')}</span>` : ''}
          <span class="rv-meta">${esc(r.name)}${r.verified ? ' · Verified buyer' : ''}</span>
          ${link}
        </li>`; }).join('')}
      </ul>
      ${LIGHTBOX}
      <p class="rv-src">Reviews are collected and moderated independently via <a href="https://judge.me/authenticity" target="_blank" rel="noopener">Judge.me</a> — we cannot edit or remove them.</p>
    </div>
  </section>`;
}

/**
 * The shared stylesheet for review surfaces. Colours come from the theme
 * tokens, so this follows body.dark-bg on the product pages instead of
 * hardcoding an ink that would go invisible when the page turns dark.
 * No opacity on any text — muted tones use --mist / --txt-soft.
 */
/* --txt-soft, NOT --mist. body.dark-bg redefines --txt-soft but leaves --mist
   alone, so muted review text keyed to --mist would render as dark ink on the
   dark stretch of a product page - the exact failure that made the size chart
   unreadable. On the category pages --txt-soft is undefined and the fallback
   applies, which is correct because those pages are always light. */
/* The .rv-band block exists because Faheem sent a screenshot: the homepage
   injected the band over the animated desert-sky canvas, and transparent
   cards left ink text floating on mid-orange — meta lines were unreadable.
   The band therefore carries its OWN sand surface, white cards and explicit
   ink/mist colours, so it is legible over any background it lands on. Same
   lesson as the filter chips: never style against a background you do not
   control. Measured: ink 13.0:1 on the sand band, mist 5.99:1 on white,
   stars 3.68:1 (decorative, figure always beside them). */
/* Star colour is set here rather than from var(--gold): --gold is tuned per
   page for other uses and is not defined at all on the category pages, and the
   brand gold measures 1.67:1 on cream - a star rating nobody can see. Stars are
   decorative (aria-hidden, figure shown in text beside them), so the bar is the
   3:1 non-text guidance, met in both themes: 3.68 on cream, 10.4 on dark.
   NOTE: keep comments OUT of the template below - it ships to every page. */
const CSS = `
.reviews{border-top:1px solid var(--line,rgba(43,37,32,.12))}
.rv-aggregate{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:24px}
.rv-stars{color:#A9761A;letter-spacing:2px;font-size:17px}
body.dark-bg .rv-stars{color:#E9B978}
.rv-score{font-family:'Space Mono',monospace;font-size:18px;font-weight:700}
.rv-count{font-size:13px;color:var(--txt-soft,#6B6256)}
.rv-list{display:grid;grid-template-columns:1fr 1fr;gap:16px;list-style:none;padding:0;margin:0}
.rv-card{border:1px solid var(--line,rgba(43,37,32,.12));border-radius:2px;padding:20px}
.rv-card .rv-stars{font-size:14px;margin-bottom:8px;display:block}
.rv-title{display:block;font-size:15px;margin-bottom:6px}
.rv-text{font-size:14.5px;font-style:italic;line-height:1.65;margin:0 0 10px}
.rv-photos{display:flex;gap:8px;margin-bottom:10px}
.rv-photo{width:72px;height:72px;object-fit:cover;border-radius:2px}
.rv-meta{font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.5px;color:var(--txt-soft,#6B6256)}
.rv-reply{font-size:13.5px;line-height:1.6;margin:12px 0 0;padding-left:12px;
  border-left:2px solid var(--line,rgba(43,37,32,.12))}
.pcard-rv{display:flex;align-items:center;gap:7px;margin:2px 0 8px}
.pcard-rv .rv-stars{font-size:13px;letter-spacing:1px}
.pcard-rv-n{font-family:'Space Mono',monospace;font-size:11px;color:var(--txt-soft,#6B6256)}
.rv-band{background:#FAF6EF;color:#33271B;padding:60px 24px;border-top:1px solid rgba(42,32,22,.10)}
.rv-band .wrap{max-width:1100px;margin:0 auto}
.rv-band .eyebrow{display:block;margin-bottom:14px;font-family:'Space Mono',monospace;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#9C521B}
.rv-band .rv-card{background:#fff;border:1px solid rgba(42,32,22,.14)}
.rv-band .rv-stars{color:#A9761A}
.rv-band .rv-score{color:#33271B}
.rv-band .rv-count,.rv-band .rv-meta{color:#6B6256}
.rv-band .rv-text{color:#33271B;font-style:italic}
.rv-src{margin:18px 0 0;font-family:'Space Mono',monospace;font-size:11.5px;letter-spacing:.3px;color:var(--txt-soft,#6B6256)}
.rv-src a{color:inherit;text-decoration:underline;text-underline-offset:3px}
.rv-band .rv-src{color:#6B6256}
.rv-more{display:inline-block;margin-top:10px;font-family:'Space Mono',monospace;font-size:11.5px;letter-spacing:.3px;color:#7E4114;text-decoration:underline;text-underline-offset:3px}
.rv-more:hover{color:#33271B}
.rv-photo-a{display:inline-block;line-height:0;border-radius:2px;cursor:zoom-in;transition:transform .2s}
.rv-photo-a:hover{transform:scale(1.04)}
.rv-photo-a:focus-visible{outline:2px solid #7E4114;outline-offset:2px}
.rv-photo{width:84px;height:84px;object-fit:cover;border-radius:2px;border:1px solid rgba(42,32,22,.18)}
#sbRvLB{position:fixed;inset:0;z-index:9999;background:rgba(20,14,8,.92);display:flex;align-items:center;justify-content:center;cursor:zoom-out}
#sbRvLB img{max-width:92vw;max-height:86vh;border-radius:3px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
#sbRvLB button{position:absolute;top:16px;right:16px;width:48px;height:48px;border:0;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;font-size:30px;line-height:1;cursor:pointer}
#sbRvLB button:hover{background:rgba(255,255,255,.28)}
#sbRvLB button:focus-visible{outline:2px solid #E9B978;outline-offset:2px}
@media(max-width:760px){.rv-list{grid-template-columns:1fr}}`;

module.exports = { load, loadAll, stars, cardRating, productSection, homepageBand, CSS, HOMEPAGE_MIN };
