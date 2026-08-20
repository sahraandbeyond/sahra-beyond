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
      `<img class="rv-photo" src="${esc(u)}" alt="Customer photo of ${esc(productName)}" loading="lazy">`).join('');
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
        <span class="snum">05 &mdash; What buyers say</span>
        <h2 id="rv-h">Reviews</h2>
        <div class="rv-aggregate">
          ${stars(d.average)}
          <span class="rv-score">${d.average.toFixed(1)} / 5</span>
          <span class="rv-count">from ${d.count} verified review${d.count === 1 ? '' : 's'}</span>
        </div>
        <ul class="rv-list">${cards}
        </ul>
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

  /* strongest first: rated 5, has a body worth reading, most recent */
  const picked = flat
    .filter(r => r.rating >= 4 && r.body && r.body.length > 40)
    .sort((a, b) => (b.rating - a.rating) || String(b.date).localeCompare(String(a.date)))
    .slice(0, 3);
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
        ${picked.map(r => `
        <li class="rv-card">
          ${stars(r.rating)}
          <p class="rv-text">${esc(r.body.length > 190 ? r.body.slice(0, 187).trim() + '…' : r.body)}</p>
          <span class="rv-meta">${esc(r.name)}${r.verified ? ' · Verified buyer' : ''}</span>
        </li>`).join('')}
      </ul>
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
@media(max-width:760px){.rv-list{grid-template-columns:1fr}}`;

module.exports = { load, loadAll, stars, cardRating, productSection, homepageBand, CSS, HOMEPAGE_MIN };
