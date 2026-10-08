/* Sahra & Beyond — static SEO page generator.
   Reads content/*.json and writes pre-rendered, indexable pages:
   - /locations/<slug>/index.html  (one per location)
   - /camping/, /secluded-camping/, /snorkeling/, /stargazing/  (keyword landing pages)
   - sitemap.xml
   Runs at deploy time on Vercel (build command), so pages stay in sync with the CMS. */
const fs = require('fs');
const VB = require('./video-band.js');
const RV = require('./reviews-render.js');
const path = require('path');
const buildProducts = require('./build-products');

const ROOT = __dirname;
const SITE = 'https://www.sahraandbeyond.ae';

// Clean previously-generated output so deleted locations don't leave orphan pages
['locations', '_drafts', 'about', 'shop', 'places', 'camping', 'secluded-camping', 'snorkeling', 'stargazing', 'camping-near-dubai', 'wadis', 'desert-camping-beginners', 'mountain-escapes', 'hatta-guide', 'best-beaches', 'desert-safari', 'family-friendly-outdoors', 'outdoor-things-to-do', 'hiking', 'fujairah-beaches', 'feed', 'q'].forEach(d => { try { fs.rmSync(path.join(ROOT, d), { recursive: true, force: true }); } catch (e) {} });

const TAGLINE = 'Wear the wild side of the UAE';
// Pre-launch mode: the site opens on the coming-soon experience.
// Flip to true on drop day — enables /shop/, the Shop nav link and shop CTAs everywhere.
const LAUNCHED = true;
// REVEALED: the site is public and browsable but payments are not live, so every
// 'shop' link must lead somewhere browsable rather than to a working cart.
const REVEALED = false;

function readJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }
function metaDesc(s) { s = String(s || ''); if (s.length <= 160) return s; const cut = s.slice(0, 157); return cut.slice(0, cut.lastIndexOf(' ')) + '…'; }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
/* One contextual product link, mid-article, inside a real sentence.
   Every location page already carries the three product cards in its footer
   grid — 65 boilerplate links per page. Search engines discount sitewide
   boilerplate almost entirely; a single editorial link inside body copy is the
   one that counts, and it is also the only one a reader actually follows.
   Placed after the second paragraph so it sits in the middle of the read, not
   bolted to the end. Only rendered where the connection is honest — see
   productLink in the location JSON. There is deliberately no link on the coast
   pages, because there is no coast design. */
function withProductLink(bodyHtml, pl) {
  if (!pl || !pl.slug || !pl.sentence) return bodyHtml;
  const link = `<p class="place-buy">${pl.sentence.replace('{{link}}',
    `<a href="/products/${pl.slug}/">${esc(pl.anchor || 'see the tee')}</a>`)}</p>`;
  const parts = bodyHtml.split('</p>');
  const n = parts.length - 1;              /* number of paragraphs */
  if (n < 1) return bodyHtml + link;
  /* After para 2 normally; after para 1 on a two-paragraph body, which is what
     "mid-article" means there. Appending to the end would make it a sign-off,
     which is the banner behaviour we are avoiding. */
  const at = Math.max(1, Math.min(2, n - 1));
  return parts.slice(0, at).join('</p>') + '</p>' + link + parts.slice(at).join('</p>');
}

function paras(text) { return String(text || '').split(/\n\n+/).filter(Boolean).map(p => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join(''); }
/* Intrinsic image dimensions.
   Without width/height the browser cannot reserve space before the image loads,
   so every image on the page shoves the text below it downwards as it arrives.
   Read the real pixel size straight off the file and stamp it on the tag; CSS
   still controls the displayed size, these attributes only supply the ratio. */
const _dimCache = new Map();
function imgDims(src, baseDir) {
  const clean = String(src).split('?')[0].split('#')[0];
  if (!clean || /^(https?:)?\/\//.test(clean) || clean.startsWith('data:')) return null;
  const key = (clean.startsWith('/') ? '' : (baseDir || '') + '|') + clean;
  if (_dimCache.has(key)) return _dimCache.get(key);
  let out = null;
  try {
    const fp = clean.startsWith('/')
      ? path.join(ROOT, clean.slice(1))
      : path.resolve(ROOT, baseDir || '.', clean);
    if (fs.existsSync(fp)) {
      const b = fs.readFileSync(fp);
      if (b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        out = { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };                    // PNG
      } else if (b[0] === 0xff && b[1] === 0xd8) {                                  // JPEG
        let i = 2;
        while (i < b.length - 9) {
          if (b[i] !== 0xff) { i++; continue; }
          const m = b[i + 1];
          if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
            out = { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) }; break;
          }
          i += 2 + b.readUInt16BE(i + 2);
        }
      } else if (b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP') {
        const t = b.slice(12, 16).toString('ascii');
        if (t === 'VP8X') out = { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
        else if (t === 'VP8 ') out = { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
        else if (t === 'VP8L') {
          const n = b.readUInt32LE(21);
          out = { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 };
        }
      }
    }
  } catch (e) { out = null; }
  _dimCache.set(key, out);
  return out;
}
function addImgDims(html, baseDir) {
  return html.replace(/<img\b([^>]*)>/g, (tag, attrs) => {
    if (/\bwidth=/.test(attrs) || /\bheight=/.test(attrs)) return tag;
    const m = attrs.match(/\bsrc="([^"]+)"/);
    if (!m) return tag;
    const d = imgDims(m[1], baseDir);
    if (!d || !d.w || !d.h) return tag;
    return `<img${attrs} width="${d.w}" height="${d.h}">`;
  });
}

function write(rel, html) { html = addImgDims(html, path.dirname(rel)); const fp = path.join(ROOT, rel); fs.mkdirSync(path.dirname(fp), { recursive: true }); fs.writeFileSync(fp, html); console.log('  ✓ ' + rel); }

const locDir = path.join(ROOT, 'content/locations');
const allLocations = (fs.existsSync(locDir) ? fs.readdirSync(locDir) : []).filter(f => f.endsWith('.json')).map(f => readJSON(path.join(locDir, f))).filter(Boolean)
  /* 27 Sep 2026: Wadi Shab (Oman) removed and 'Maleiha Desert Drive' merged into Mleiha (Faheem); both redirect in vercel.json */
  .filter(l => !l.hidden);
/* 1 Oct 2026: "draft": true holds a guide back until Faheem has his own photos and a
   real visit behind it (SEO plan rule). Drafts are left out of everything public:
   no /locations/ page, no sitemap, hub, nearby list, guide hub or feed. Draft JSON
   lives in content/drafts/ (in .vercelignore, so it is never served); a local
   preview is written to _drafts/ (gitignored, noindex) and never on Vercel. To
   publish, move the file to content/locations/ and remove "draft": true. */
const draftDir = path.join(ROOT, 'content/drafts');   /* listed in .vercelignore: never uploaded or served */
const draftLocations = (fs.existsSync(draftDir) ? fs.readdirSync(draftDir) : []).filter(f => f.endsWith('.json')).map(f => readJSON(path.join(draftDir, f))).filter(Boolean)
  .map(l => Object.assign(l, { draft: true }))
  .filter(l => !allLocations.some(x => x.id === l.id));   /* once published, a stale draft copy is ignored */
const locations = allLocations.filter(l => !l.draft);
const PLACES = require('./places-page.js');
const FG = require('./footer-guides.js');
const IG = require('./instagram-feed.js');   /* 4 Oct 2026: the Instagram posts on the site, from content/instagram.json */
const settings = readJSON(path.join(ROOT, 'content/settings.json')) || {};
/* 4 Oct 2026 (CRO panel, idea 8): a design's two fits as ONE card with a Regular |
   Oversized switch, so seven cards read as four designs. Works on the home grid
   (<a class="card">) and the product grids (<article class="pcard">). The Oversized
   card is in the HTML (and in the sitemap, as its own page); the switch only chooses
   which one is shown. Without JS the Regular card shows and its page carries the
   same switch. Build-time, so there is no layout shift. */
function pairFits(html) {
  const open = /<(a|article) class="(card|pcard)"[^>]*(?:href|data-handle)="(?:\/products\/)?([a-z-]+?)-(regular|oversized)\/?"[^>]*>/g;
  const cards = []; let m;
  while ((m = open.exec(html))) {
    const close = '</' + m[1] + '>';
    const end = html.indexOf(close, m.index);
    if (end < 0) continue;
    cards.push({ start: m.index, end: end + close.length, design: m[3], fit: m[4], tag: m[1] });
  }
  const byDesign = {};
  cards.forEach(c => { (byDesign[c.design] = byDesign[c.design] || {})[c.fit] = c; });
  /* rebuild the string from pieces, so the pair's order in the source does not matter */
  const pieces = []; let pos = 0; const done = new Set();
  cards.sort((a, b) => a.start - b.start);
  for (const c of cards) {
    const pair = byDesign[c.design];
    if (!pair.regular || !pair.oversized) continue;
    pieces.push(html.slice(pos, c.start));
    if (!done.has(c.design)) {
      done.add(c.design);
      const regHtml = html.slice(pair.regular.start, pair.regular.end), ovHtml = html.slice(pair.oversized.start, pair.oversized.end);
      pieces.push(`<div class="fitpair" data-fit="regular" data-design="${c.design}"><div class="fitpair-sw" role="group" aria-label="Fit"><button type="button" class="on" data-fit="regular" aria-pressed="true">Regular</button><button type="button" data-fit="oversized" aria-pressed="false">Oversized</button></div>${regHtml}${ovHtml}</div>`);
    }
    pos = c.end;
  }
  pieces.push(html.slice(pos));
  return pieces.join('');
}
const FITPAIR_CSS = `.fitpair{position:relative;display:flex;flex-direction:column}.fitpair>.card,.fitpair>.pcard{flex:1}
.fitpair[data-fit="regular"]>[href*="-oversized/"],.fitpair[data-fit="regular"]>[data-handle$="-oversized"],.fitpair[data-fit="oversized"]>[href*="-regular/"],.fitpair[data-fit="oversized"]>[data-handle$="-regular"]{display:none}
.fitpair-sw{position:absolute;top:10px;left:10px;z-index:3;display:inline-flex;padding:3px;border-radius:999px;background:rgba(20,15,34,.72);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);gap:2px}
.fitpair-sw button{font:inherit;font-size:11px;letter-spacing:.3px;padding:5px 10px;border:0;border-radius:999px;background:transparent;color:rgba(247,239,226,.8);cursor:pointer;line-height:1.2}
.fitpair-sw button.on{background:#F7EFE2;color:#2B2620;font-weight:600}
.fitpair-sw button:focus-visible{outline:2px solid #E9B978;outline-offset:1px}`;
const FITPAIR_JS = `(function(){var pairs=[].slice.call(document.querySelectorAll('.fitpair'));if(!pairs.length)return;var saved=null;try{saved=localStorage.getItem('sb_fit');}catch(e){}
function set(fit,remember){pairs.forEach(function(w){w.setAttribute('data-fit',fit);[].forEach.call(w.querySelectorAll('.fitpair-sw button'),function(b){var on=b.getAttribute('data-fit')===fit;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');});});if(remember){try{localStorage.setItem('sb_fit',fit);}catch(e){}}}
if(saved==='oversized')set('oversized',false);
document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('.fitpair-sw button');if(!b)return;e.preventDefault();e.stopPropagation();set(b.getAttribute('data-fit'),true);if(window.track)track('fit_switch',{fit:b.getAttribute('data-fit')});},true);
})();`;

/* Arabic core pages (/ar/, /ar/about/, /ar/contact/): false = not in the sitemap and no visible
   'العربية' link on English pages. Flip to true once Faheem signs them off (handover item 11). */
const AR_CORE_PUBLIC = true;   /* Faheem, 1 Oct 2026: the three Arabic core pages stay live (indexable), so they go in the sitemap and the footer links them */
/* footer guide list into the hand-maintained pages (see footer-guides.js) */
for (const f of ['index.html', 'shop-preview.html']) {
  const fp = path.join(ROOT, f); if (!fs.existsSync(fp)) continue;
  const h = fs.readFileSync(fp, 'utf8');
  let n = h.replace(/<!--GUIDES:START-->[\s\S]*?<!--GUIDES:END-->/, '<!--GUIDES:START--><style>' + FG.FOOT_GUIDES_CSS + '</style>' + FG.guidesHtml(null, AR_CORE_PUBLIC) + '<!--GUIDES:END-->');
  /* Instagram blocks (instagram-feed.js): the strip under the film on the home page, the footer row, and one script */
  if (f === 'index.html') { /* the home grid: pair the fits (idempotent) */
    const gs = n.indexOf('<div class="grid" id="grid">');
    if (gs >= 0 && n.indexOf('fitpair', gs) < 0 || (gs >= 0 && n.indexOf('fitpair', gs) > n.indexOf('</section>', gs))) {
      let depth = 0, i = gs, ge = -1; const re = /<div\b|<\/div>/g; re.lastIndex = gs; let m;
      while ((m = re.exec(n))) { depth += m[0] === '</div>' ? -1 : 1; if (depth === 0) { ge = m.index + 6; break; } }
      if (ge > gs) n = n.slice(0, gs) + pairFits(n.slice(gs, ge)) + n.slice(ge);
    }
  }
  n = n.replace(/<!--IG:STRIP-->[\s\S]*?<!--\/IG:STRIP-->/, '<!--IG:STRIP-->' + IG.stripHtml() + '<!--/IG:STRIP-->')
       .replace(/<!--IG:FOOT-->[\s\S]*?<!--\/IG:FOOT-->/, '<!--IG:FOOT--><style>' + IG.CSS + FITPAIR_CSS + '</style>' + IG.footerRowHtml() + '<!--/IG:FOOT-->')
       .replace(/<!--IG:JS-->[\s\S]*?<!--\/IG:JS-->/, '<!--IG:JS--><script>' + IG.JS + '</script><script>' + FITPAIR_JS + '</script><!--/IG:JS-->');
  if (n !== h) fs.writeFileSync(fp, n);
}
const PRODUCTS_ALL = buildProducts.loadProducts(ROOT);
const PRODUCT_BY_PLACE = {};
PRODUCTS_ALL.forEach(p => { if (p.placeSlug && p.fit === 'regular') PRODUCT_BY_PLACE[p.placeSlug] = p; });
PRODUCTS_ALL.forEach(p => { if (p.placeSlug && !PRODUCT_BY_PLACE[p.placeSlug]) PRODUCT_BY_PLACE[p.placeSlug] = p; });
// one entry per DESIGN for inline modules, so content pages don't show seven near-identical cards
const DESIGNS = PRODUCTS_ALL.filter(p => p.fit !== 'oversized').sort((a,b)=>(a.order||0)-(b.order||0));
const BY_CATEGORY = cat => PRODUCTS_ALL.filter(p => p.category === cat).sort((a,b)=>(a.order||0)-(b.order||0));
// Instagram only — the single official channel
const social = { instagram: (settings.social && settings.social.instagram) || 'https://instagram.com/sahraandbeyond.ae' };
const CAT_HASH = { Camping: 'camping', Wadis: 'wadis', Mountains: 'mountains', Coast: 'coast', Dunes: 'dunes', Heritage: 'heritage' };
const WEATHER_KEY = settings.weatherKey || '';
const packingData = readJSON(path.join(ROOT, 'content/packing.json'));
const PACKING = (packingData && Array.isArray(packingData.items)) ? packingData.items : [];
// Monetization config (CMS-editable). Each block renders only when its value is set,
// so nothing half-finished ships to visitors.
const MON = settings.monetization || {};
function affLink(template, query) { if (!template) return ''; try { return template.replace(/\{query\}/g, encodeURIComponent(query)); } catch (e) { return ''; } }
function diffText(d) {
  if (d === 'Easy') return 'Most fitness levels and families can manage it with basic preparation.';
  if (d === 'Hard') return 'It suits experienced, well-prepared adventurers — plan carefully and don’t go alone.';
  return 'It suits reasonably active visitors who come prepared with water, sun protection and a plan.';
}
function faqsFor(l) {
  /* A location may supply its own questions. The generated four below are a
     floor, not a ceiling: they are the same on every page, so they answer
     nothing a searcher actually typed. */
  if (Array.isArray(l.faqs) && l.faqs.length) return l.faqs.map(q => [q.q, q.a]);
  const f = [];
  f.push(['When is the best time to visit ' + l.name + '?',
    'The best season for ' + l.name + ' is ' + (l.season || 'the cooler months (roughly October to April)') + ', when conditions in ' + l.emirate + ' are most comfortable for ' + String(l.category).toLowerCase() + '.']);
  f.push(['How difficult is ' + l.name + '?',
    l.name + ' is rated ' + (l.difficulty || 'Moderate').toLowerCase() + '. ' + diffText(l.difficulty)]);
  if (l.distance) f.push(['How far is ' + l.name + '?', l.name + ' is around ' + l.distance + '. Exact GPS coordinates and map links are on this page.']);
  f.push(['What should I bring to ' + l.name + '?',
    'Pack for ' + String(l.category).toLowerCase() + ' conditions in ' + l.emirate + ' — water, sun protection, navigation and the essentials. See the tailored packing checklist on this page.']);
  return f;
}
function toursBlock(l) {
  const url = affLink(MON.toursUrlTemplate, l.name + ' ' + l.emirate);
  if (!url) return '';
  return `<section class="book"><h2>Book a tour or experience near ${esc(l.name)}</h2>
    <p>Prefer a guided trip, rental or organised experience? Browse bookable tours and activities around ${esc(l.emirate)}.</p>
    <a class="btn book-btn" href="${esc(url)}" target="_blank" rel="noopener sponsored">See experiences in ${esc(l.emirate)} &rarr;</a></section>`;
}
function stayBlock(l) {
  const url = affLink(MON.bookingUrlTemplate, l.name + ' ' + l.emirate);
  if (!url) return '';
  return `<section class="book"><h2>Where to stay near ${esc(l.name)}</h2>
    <p>Turning it into an overnight trip? Find hotels and stays close to ${esc(l.name)}.</p>
    <a class="btn book-btn alt" href="${esc(url)}" target="_blank" rel="noopener sponsored">Find places to stay &rarr;</a></section>`;
}
/* ---- The tee inspired by THIS place -------------------------------------
   Closes the loop: location pages are the highest-traffic SEO surface, so when a
   place has a tee, show it here instead of the generic shop CTA. ---------- */
/* Every photo a card should cycle: the mockups plus the worn shots, deduped.
   The fit-comparison image is deliberately excluded - it is a sizing tool,
   not a product photo, and reads as noise at card size. */
function cardShots(p) {
  const raw = [
    [p.imgMain, p.altMain || p.name],
    [p.imgFront, p.altFront || ('Front of ' + p.name)],
    [p.imgBack, p.altBack || ('Back of ' + p.name)],
    ...((p.modelShots || []).map(m => [m.src, m.alt || p.name]))
  ].filter(x => x[0]);
  const seen = new Set(), out = [];
  for (const x of raw) { if (seen.has(x[0])) continue; seen.add(x[0]); out.push(x); }
  return out;
}
function cycleImgs(p) {
  return cardShots(p).map(([src, alt], i) =>
    `<img${i === 0 ? ' class="on"' : ''} src="${esc(src)}" alt="${esc(alt)}" loading="lazy">`).join('');
}

function teeBlock(l, lead) {
  const p = l && l.id ? PRODUCT_BY_PLACE[l.id] : null;
  if (!p) return '';
  const href = `/products/${p.id}/`;
  return `<section class="teecta" style="--tee:${p.theme || '#181109'}">
    <div class="teecta-inner">
      <a class="teecta-img" href="${href}" aria-label="${esc(p.name)}" data-cycle>${cycleImgs(p)}</a>
      <div class="teecta-txt">
        <span class="teecta-eyebrow">${lead ? esc(lead) + ' ' : ''}${lead && /Hatta|mountains|hike/i.test(lead) ? 'The tee drawn from these mountains' : 'The tee drawn from this place'}</span>
        <h2>${esc(p.name)}</h2>
        <p>${esc(p.shareDesc || p.lede || '')}</p>
        <div class="teecta-meta"><span class="sb-price" data-handle="${esc(p.id)}" data-aed="${esc(String(p.price))}">AED ${esc(String(p.price))}</span><span>${p.printChip || ''}</span><span>&#10022; Limited first run</span></div>
        <a class="btn" href="${href}">See the tee &rarr;</a>
        ${p.siblingOf ? `<p class="teecta-alt">Also in <a href="/products/${p.siblingOf}-oversized/">Oversized</a></p>` : ''}
        ${/^hajar-mountains-/.test(p.id) ? `<p class="teecta-alt">More <a href="/mountain-t-shirts/">mountain t-shirts</a></p>`
          : /^(empty-quarter|al-quaa-galaxy)-/.test(p.id) ? `<p class="teecta-alt">More <a href="/desert-t-shirts/">desert t-shirts</a></p>` : ''}
      </div>
    </div>
  </section>`;
}
/* A compact product strip for the TOP of location and guide pages (CRO review,
   23 Sep 2026). The full teeBlock still closes the page; this one puts the tee
   and its price in the first screen for a reader who arrived from search. */
function miniTee(placeSlug) {
  const p = placeSlug ? PRODUCT_BY_PLACE[placeSlug] : null;
  if (!p) return `<aside class="minitee minitee-all"><div class="minitee-txt"><span class="minitee-eye">Sahra &amp; Beyond</span><b>T-shirts drawn from real UAE places</b><span class="minitee-sub">From AED 199 &middot; 230gsm cotton &middot; free next-day UAE delivery</span></div><a class="minitee-go" href="/t-shirts/">Shop t-shirts &rarr;</a></aside>`;
  const img = cardShots(p)[0];
  return `<aside class="minitee"><a class="minitee-img" href="/products/${p.id}/" tabindex="-1" aria-hidden="true">${img ? `<img src="${esc(img[0])}" alt="" width="72" height="90" loading="lazy" decoding="async">` : ''}</a><div class="minitee-txt"><span class="minitee-eye">The tee drawn from this place</span><b>${esc(p.name)}</b><span class="minitee-sub"><span class="sb-price" data-handle="${esc(p.id)}" data-aed="${esc(String(p.price))}">AED ${esc(String(p.price))}</span> &middot; limited first run</span></div><a class="minitee-go" href="/products/${p.id}/">See the tee &rarr;</a></aside>`;
}
function shopBlock(l) {
  const place = (l && l.name)
    ? `Original tees inspired by real places like ${esc(l.name)} — every design carries a place.`
    : 'Original tees inspired by the real deserts, wadis and dark-sky nights of the Emirates — every design carries a place.';
  const line = LAUNCHED ? place : `The first drop is coming. ${place}`;
  const eyebrow = LAUNCHED ? 'Sahra &amp; Beyond · Original Tees' : 'Sahra &amp; Beyond · First drop coming';
  const cta = LAUNCHED
    ? `<a class="btn" href="/shop/">Shop the collection &rarr;</a>`
    : `<a class="btn" href="/#join">Join the waitlist &rarr;</a>`;
  return `<section class="shopcta"><div class="stars"></div><div class="stars2"></div><div class="shoot"></div>
    <div class="shopcta-eyebrow">${eyebrow}</div>
    <h2>Every design has a place</h2>
    <p>${line}</p>
    ${cta}</section>`;
}
function collectionBlock(ctxName, allFits) {
  if (!PRODUCTS_ALL.length) return shopBlock(null);
  const lead = ctxName
    ? `Heading to ${esc(ctxName)}? Every t-shirt we make is drawn from a real place in the Emirates.`
    : 'Every t-shirt we make is drawn from a real place in the Emirates \u2014 heavyweight combed cotton, limited runs.';
  // Tees only. The polo is a different garment and this block's copy says
  // "every t-shirt we make" — listing it here was simply wrong.
  // allFits: the t-shirts page lists Regular AND Oversized (6 cards). Content
  // pages keep the deduped one-per-design list so they don't repeat themselves.
  const SRC = allFits ? PRODUCTS_ALL : DESIGNS;
  const TEES = SRC.filter(p => p.garment !== 'polo').sort((a,b)=>(a.order||0)-(b.order||0));
  const cards = allFits ? pairFits(TEES.map(productCard).join('')) : TEES.map(productCard).join('');
  return `<section class="pcta">
    <div class="pcta-head">
      <span class="pcta-eyebrow">Sahra &amp; Beyond &middot; UAE t-shirts</span>
      <h2>Tees drawn from real UAE places</h2>
      <p>${lead}</p>
    </div>
    <div class="pcards">${cards}</div>
    <a class="btn shoplink" href="${(LAUNCHED||REVEALED)?'/shop/':'/t-shirts/'}">Shop the collection &rarr;</a><a class="btn ghost" href="/t-shirts/">See all t-shirts &rarr;</a>
  </section>`;
}
function teeFor(placeSlug, ctxName, lead) {
  const p = PRODUCT_BY_PLACE[placeSlug];
  return p ? teeBlock({ id: placeSlug }, lead) : collectionBlock(ctxName);
}
/* 4 Oct 2026 (CRO panel, idea 3): where no tee is honest (the coast), ask which place
   should be drawn next instead of forcing a match. One tap to WhatsApp, nothing to fill in. */
function askBlock(name, category) {
  /* 6 Oct 2026: the coast IS being drawn (Sahel, the Coast Edition), so coast pages no longer ask
     'which place next' or offer 'a Snoopy Island tee' ('Snoopy' may not name a garment: Peanuts
     trademark, Decision Log 5 Oct). Every coast page gets the same line, so none is singled out
     before the reveal. */
  if (category === 'Coast') return `<section class="askcta askcta-sahel"><span class="teecta-eyebrow">The coast is next</span><h2>Sahel, the Coast Edition</h2><p>Our next edition is drawn from the coast of the UAE. It is launching soon.</p><p class="askcta-row"><a class="btn" href="/sahel/#first-to-know" data-track="place_sahel">Be first to know &rarr;</a><a class="btn ghost" href="/sahel/">See the page</a></p></section>`;
  const generic = /^the /.test(name);
  const msg = encodeURIComponent(generic ? `I'd wear a tee drawn from ${name}` : `I'd wear a ${name} tee`);
  return `<section class="askcta"><span class="teecta-eyebrow">Not drawn yet</span><h2>Which place should be next?</h2><p>Every Sahra &amp; Beyond tee is drawn from one real place in the Emirates. ${generic ? 'Nothing from ' + esc(name) + ' yet.' : esc(name) + ' is not one of them yet.'} If it should be, say so: one tap, no form.</p><p class="askcta-row"><a class="btn" href="https://wa.me/971585449946?text=${msg}" target="_blank" rel="noopener">${generic ? 'Draw ' + esc(name) + ' next' : `I'd wear a ${esc(name)} tee`}</a><a class="btn ghost" href="/t-shirts/">See the places we have drawn &rarr;</a></p></section>`;
}
/* 4 Oct 2026 (CRO panel, idea 2): a slim buy bar for guides and place pages. It appears
   once the top product strip has scrolled away, and a tap opens a size sheet that adds
   to the bag without leaving the page. Sizes come from Shopify at tap time, like the
   product page, so nothing is shown that is not in stock. */
function guideBar(p) {
  if (!p) return '';
  const img = cardShots(p)[0];
  return `<div class="gbar" id="gbar" hidden data-handle="${esc(p.id)}" data-name="${esc(p.name)}" data-aed="${esc(String(p.price))}">
    <a class="gbar-img" href="/products/${p.id}/" tabindex="-1" aria-hidden="true">${img ? `<img src="${esc(img[0])}" alt="" width="40" height="50" loading="lazy" decoding="async">` : ''}</a>
    <div class="gbar-t"><b>${esc(p.name.replace(/ — (Regular|Oversized)$/, ''))}</b><span><span class="sb-price" data-handle="${esc(p.id)}" data-aed="${esc(String(p.price))}">AED ${esc(String(p.price))}</span><span class="sb-ship-uae"> &middot; next-day UAE</span></span></div>
    <button type="button" class="gbar-btn" id="gbarOpen">Pick size</button>
  </div>
  <div class="gsheet" id="gsheet" hidden role="dialog" aria-modal="true" aria-label="Choose a size">
    <div class="gsheet-in">
      <div class="gsheet-h"><b>${esc(p.name)}</b><button type="button" class="gsheet-x" id="gsheetX" aria-label="Close">&#10005;</button></div>
      <p class="gsheet-sub"><span class="sb-price" data-handle="${esc(p.id)}" data-aed="${esc(String(p.price))}">AED ${esc(String(p.price))}</span> &middot; ${esc(p.fit === 'oversized' ? 'Oversized fit' : (p.garment === 'polo' ? 'One cut' : 'Regular fit'))} &middot; <a href="/size-guide/">size guide</a></p>
      <div class="gsheet-sizes" id="gsheetSizes" role="group" aria-label="Sizes"><span class="gsheet-wait">Loading sizes&hellip;</span></div>
      <p class="gsheet-msg" id="gsheetMsg" role="status" aria-live="polite"></p>
      <button type="button" class="btn gsheet-add" id="gsheetAdd" disabled>Choose a size</button>
      <p class="gsheet-foot"><span class="sb-ship-uae"><span data-sb-clock>Free next-day UAE delivery</span> &middot; free 14-day exchanges</span><span class="sb-ship-gcc">GCC delivery 3–5 days &middot; 14-day returns</span><span class="sb-ship-intl">Worldwide delivery &middot; 14-day returns</span> &middot; <a href="/products/${p.id}/">full details &rarr;</a></p>
    </div>
  </div>`;
}
const GBAR_CSS = `.gbar{position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:117;display:flex;align-items:center;gap:10px;padding:8px 8px 8px 8px;border-radius:14px;background:rgba(28,20,13,.94);color:#F7EFE2;box-shadow:0 10px 30px -10px rgba(0,0,0,.5);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transform:translateY(calc(100% + 20px));transition:transform .35s cubic-bezier(.2,.7,.2,1)}
.gbar.on{transform:none}.gbar[hidden]{display:none}
.gbar-img{flex:none;width:40px;height:50px;border-radius:8px;overflow:hidden;background:#2a2016}.gbar-img img{width:100%;height:100%;object-fit:cover;display:block}
.gbar-t{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.25}.gbar-t b{font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gbar-t span{font-size:12px;color:rgba(247,239,226,.75)}
.gbar-btn{flex:none;font:inherit;font-weight:600;font-size:13.5px;padding:10px 16px;border-radius:999px;border:0;background:#E9B978;color:#2A2016;cursor:pointer}
@media(min-width:761px){.gbar{left:auto;right:24px;bottom:24px;width:360px}}
html.sb-gbar .sb-wa{bottom:calc(84px + env(safe-area-inset-bottom,0px))!important}
body.sb-gsheet-open .sb-wa,body.sb-gsheet-open .sb-fcart,body.sb-gsheet-open .gbar{display:none!important}
html.sb-gbar .sb-fcart{bottom:calc(84px + env(safe-area-inset-bottom,0px))!important}
html.sb-gbar.sb-fcart-on .sb-wa{bottom:calc(150px + env(safe-area-inset-bottom,0px))!important}
@media(min-width:761px){html.sb-gbar .sb-wa{right:400px!important;bottom:28px!important}}
.gsheet{position:fixed;inset:0;z-index:990;background:rgba(10,8,22,.55);display:flex;align-items:flex-end;justify-content:center}.gsheet[hidden]{display:none}
.gsheet-in{width:100%;max-width:480px;background:#FAF6EF;color:#2B2620;border-radius:18px 18px 0 0;padding:16px 18px calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -10px 40px rgba(0,0,0,.3)}
@media(min-width:761px){.gsheet{align-items:center}.gsheet-in{border-radius:18px}}
.gsheet-h{display:flex;justify-content:space-between;align-items:center;gap:10px}.gsheet-h b{font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-size:22px}
.gsheet-x{font:inherit;border:0;background:transparent;font-size:18px;cursor:pointer;padding:6px;color:#5C5346}
.gsheet-sub{margin:4px 0 12px;font-size:13.5px;color:#5C5346}.gsheet-sub a{color:#9C521B}
.gsheet-sizes{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:0 0 10px}.gsheet-wait{grid-column:1/-1;font-size:13px;color:#5C5346}
.gsheet-size{font:inherit;font-weight:600;font-size:15px;padding:12px 0;border-radius:10px;border:1px solid rgba(43,37,32,.2);background:#fff;cursor:pointer;color:#2B2620}
.gsheet-size[aria-pressed="true"]{background:#2B2620;color:#fff;border-color:#2B2620}.gsheet-size:disabled{opacity:.45;cursor:default;text-decoration:line-through}
.gsheet-msg{min-height:18px;margin:0 0 8px;font-size:13px;color:#9C521B}
.gsheet-add{width:100%;display:block;text-align:center}.gsheet-add:disabled{opacity:.55}
.gsheet-foot{margin:10px 0 0;font-size:12.5px;color:#5C5346;text-align:center}.gsheet-foot a{color:#9C521B}`;
const GBAR_JS = `(function(){var bar=document.getElementById('gbar');if(!bar)return;
var sheet=document.getElementById('gsheet'),sizes=document.getElementById('gsheetSizes'),addB=document.getElementById('gsheetAdd'),msgEl=document.getElementById('gsheetMsg'),handle=bar.getAttribute('data-handle'),sel=null,loaded=false,on=false;
function show(v){if(v===on)return;on=v;if(v){bar.hidden=false;requestAnimationFrame(function(){bar.classList.add('on');});document.documentElement.classList.add('sb-gbar');}else{bar.classList.remove('on');document.documentElement.classList.remove('sb-gbar');setTimeout(function(){if(!on)bar.hidden=true;},400);}}
/* visible once the top strip is gone, hidden again at the closing tee block and the footer */
var top=document.querySelector('.minitee, .lg-strip, #tee, .teecta'),bottom=document.querySelector('.teecta, .askcta, .folds + .teecta'),foot=document.querySelector('footer');
var topGone=false,bottomNear=false,footNear=false;
var drawer=document.getElementById('sbDrawer');function drawerOpen(){var d=drawer||(drawer=document.getElementById('sbDrawer'));return !!(d&&d.classList.contains('on'));}
function sync(){show(topGone&&!bottomNear&&!footNear&&!drawerOpen());}
try{new MutationObserver(function(){sync();}).observe(document.body,{attributes:true,subtree:true,attributeFilter:['class']});}catch(e){}
try{if(top)new IntersectionObserver(function(es){es.forEach(function(e){topGone=!e.isIntersecting&&e.boundingClientRect.bottom<0;});sync();}).observe(top);
if(bottom&&bottom!==top)new IntersectionObserver(function(es){es.forEach(function(e){bottomNear=e.isIntersecting;});sync();}).observe(bottom);
if(foot)new IntersectionObserver(function(es){es.forEach(function(e){footNear=e.isIntersecting;});sync();}).observe(foot);}catch(e){topGone=true;sync();}
addEventListener('scroll',function(){if(top&&top.getBoundingClientRect().bottom<0!==topGone){topGone=top.getBoundingClientRect().bottom<0;sync();}},{passive:true});
function msg(t){msgEl.textContent=t||'';}
var lastFocus=null;function openSheet(){lastFocus=document.activeElement;sheet.hidden=false;document.body.style.overflow='hidden';document.body.classList.add('sb-gsheet-open');setTimeout(function(){var f=sheet.querySelector('.gsheet-size:not([disabled])')||document.getElementById('gsheetX');if(f)f.focus();},50);setTimeout(function(){if(!sheet.hidden&&sizes.querySelector('.gsheet-wait')&&!sizes.querySelector('.gsheet-size'))sizes.innerHTML='<span class="gsheet-wait">Sizes are taking a while. <a href="/products/'+handle+'/">Open the product page</a>.</span>';},9000);if(window.track)track('guide_bar_open',{item_id:handle});if(!loaded&&window.SahraCart&&SahraCart.variants){loaded=true;SahraCart.variants(handle).then(function(vs){sizes.innerHTML='';vs.forEach(function(v){var b=document.createElement('button');b.type='button';b.className='gsheet-size';b.textContent=v.title;b.setAttribute('aria-pressed','false');if(!v.availableForSale){b.disabled=true;b.setAttribute('aria-label',v.title+' sold out');}b.addEventListener('click',function(){[].forEach.call(sizes.children,function(x){x.setAttribute('aria-pressed','false');});b.setAttribute('aria-pressed','true');sel=v;addB.disabled=false;addB.textContent='Add to bag';msg('');});sizes.appendChild(b);});if(!vs.length)sizes.innerHTML='<span class="gsheet-wait">Sizes unavailable right now. <a href="/products/'+handle+'/">Open the product page</a>.</span>';}).catch(function(){loaded=false;sizes.innerHTML='<span class="gsheet-wait">Could not load sizes. <a href="/products/'+handle+'/">Open the product page</a>.</span>';});}}
function closeSheet(opts){sheet.hidden=true;if(!(opts&&opts.keepLock))document.body.style.overflow='';document.body.classList.remove('sb-gsheet-open');if(lastFocus&&lastFocus.focus&&!(opts&&opts.keepLock)){try{lastFocus.focus();}catch(e){}}}
sheet.addEventListener('keydown',function(e){if(e.key!=='Tab')return;var f=[].slice.call(sheet.querySelectorAll('button:not([disabled]),a[href],select,input')).filter(function(x){return x.offsetParent!==null;});if(!f.length)return;var first=f[0],last=f[f.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
document.getElementById('gbarOpen').addEventListener('click',openSheet);
document.getElementById('gsheetX').addEventListener('click',closeSheet);
sheet.addEventListener('click',function(e){if(e.target===sheet)closeSheet();});
addEventListener('keydown',function(e){if(e.key==='Escape'&&!sheet.hidden)closeSheet();});
addB.addEventListener('click',function(){if(!sel){msg('Choose a size first.');return;}addB.disabled=true;addB.textContent='Adding\u2026';SahraCart.add(sel.id,1).then(function(){closeSheet({keepLock:true});addB.disabled=false;addB.textContent='Add another';if(window.track)track('add_to_cart',{item_id:handle,size:sel.title,via:'guide-bar'});}).catch(function(){addB.disabled=false;addB.textContent='Add to bag';msg('Could not add. Please try again.');});});
})();`;
/* essays as folds (5 Sep 2026): products first, reading on request */
function foldsBlock(sections, eyebrow) {
  if (!Array.isArray(sections) || !sections.length) return '';
  return `<section class="folds"><span class="folds-eyebrow">${esc(eyebrow || 'The details')}</span>${sections.map(x =>
    `<details class="fold guide-sec"><summary><h2>${esc(x.h2)}</h2></summary><div class="content">${paras(x.body)}</div></details>`).join('')}</section>`;
}
function faqBlock(l) {
  const faqs = faqsFor(l);
  if (!faqs.length) return '';
  return `<section class="faq"><h2>Frequently asked questions</h2>${faqs.map(q => `<details><summary>${esc(q[0])}</summary><p>${esc(q[1])}</p></details>`).join('')}</section>`;
}
function newsletterBlock() {
  if (!MON.newsletterAction) return '';
  /* This block was hardcoded pre-launch copy — eyebrow, blurb, button and the
     success message all still said the first drop was "coming" and asked people
     to join a waitlist, months after the collection went on sale. Unlike
     shopBlock it never had a LAUNCHED branch. It now sells what is live and
     captures email for the NEXT drop, with the old wording kept for rollback. */
  const eyebrow = LAUNCHED
    ? 'Sahra &amp; Beyond &middot; Drop 01 out now'
    : 'Sahra &amp; Beyond &middot; First drop coming';
  const blurb = LAUNCHED
    ? 'Original tees drawn from real places across the Emirates — the first drop is live now. Join the list and you will hear about the next one first.'
    : 'The first drop of original UAE-inspired tees is coming — plus the places and stories behind every design. Be first to know.';
  const btn = LAUNCHED ? 'Notify me about Drop 02' : 'Join the waitlist';
  const ok = LAUNCHED
    ? 'You&rsquo;re on the list. We&rsquo;ll email you before the next drop. &#10022;'
    : 'You&rsquo;re on the list. See you at the drop. &#10022;';
  const shopCta = LAUNCHED
    ? `<a class="btn news-shop" href="/shop/">Shop the collection &rarr;</a>`
    : '';
  return `<section class="news"><div class="news-stars"></div><div class="news-in">
    <span class="news-eyebrow">${eyebrow}</span>
    <h2>Be first to see the next drop</h2><p>${esc(blurb)}</p>
    ${shopCta}
    <form class="news-form" action="${esc(MON.newsletterAction)}" method="post">
      <input type="email" name="email_address" placeholder="you@email.com" required aria-label="Email address">
      <button type="submit">${btn}</button>
    </form>
    <p class="news-ok" style="display:none;margin-top:14px;font-family:'Cormorant Garamond',serif;font-style:normal;font-size:18px;color:#F7DFBE">${ok}</p>
    </div>
    <script>(function(){var s=document.currentScript,sec=s.parentNode,f=sec.querySelector('.news-form');if(!f)return;f.addEventListener('submit',function(e){e.preventDefault();fetch(f.action,{method:'POST',body:new FormData(f),mode:'no-cors'}).finally(function(){f.style.display='none';var ok=sec.querySelector('.news-ok');if(ok)ok.style.display='block';});});})();</script></section>`;
}
// Category hero gradients — all within the brand's desert-night palette
// (deep indigo Milky-Way sky melting to a category-tinted horizon)
const CAT_BG = {
  Camping:   'linear-gradient(160deg,#14102A 0%,#39295A 42%,#7A4F63 74%,#C0702E 100%)',
  Wadis:     'linear-gradient(160deg,#14102A 0%,#2E3A50 44%,#4E6B63 76%,#A98A54 100%)',
  Coast:     'linear-gradient(160deg,#14102A 0%,#26324E 44%,#3E6172 76%,#C08A54 100%)',
  Mountains: 'linear-gradient(160deg,#14102A 0%,#332C4A 44%,#5C4A5E 76%,#B07A44 100%)',
  Dunes:     'linear-gradient(160deg,#14102A 0%,#3A2A44 42%,#8B4E63 72%,#C0702E 100%)',
  Heritage:  'linear-gradient(160deg,#14102A 0%,#352A3E 44%,#6E5646 76%,#C08A54 100%)'
};
// Packing items that apply to a location's category (always + this category + overnight-only)
function packItemsFor(l) {
  return PACKING.filter(it => {
    const s = it.show || [];
    if (!s.length) return true;
    if (s.indexOf('Overnight') !== -1) return true;
    return s.indexOf(l.category) !== -1;
  }).map(it => ({ group: it.group, name: it.name, qty: it.qty || '', note: it.note || '', query: it.query || '', overnight: (it.show || []).indexOf('Overnight') !== -1 }));
}

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Jost,system-ui,sans-serif;color:#2B2620;line-height:1.65;background:#FAF6EF;background-image:radial-gradient(1200px 600px at 50% -10%,rgba(192,112,46,.07),transparent 60%),radial-gradient(900px 500px at 100% 100%,rgba(58,36,28,.05),transparent 60%);background-attachment:scroll}
a{color:#9C521B}
.hdr{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:11px max(16px,calc((100% - 1240px)/2));border-bottom:1px solid rgba(43,37,32,.1);position:sticky;top:0;background:rgba(250,246,239,.9);backdrop-filter:blur(16px);z-index:50}
.brand{display:flex;align-items:center;gap:9px;text-decoration:none}
.brand img{display:block;height:26px;width:auto}
.brand-text{display:flex;flex-direction:column;line-height:1}
.brand-sahra{font-family:'Cormorant Garamond',serif;font-size-adjust:.44;font-size:15px;font-weight:600;letter-spacing:3px;color:#33271B;text-transform:uppercase}
.brand-beyond{font-family:'Space Mono',monospace;font-size:7px;letter-spacing:2.5px;color:#A25A20;text-transform:uppercase;margin-top:2px}
.hero-img{width:100%;max-height:420px;object-fit:cover;border-radius:18px;margin:0 0 24px}
.book{margin:26px 0;padding:20px 22px;border:1px solid rgba(192,112,46,.3);background:rgba(255,247,237,.7);border-radius:16px}
.book h2{margin:0 0 6px;font-size:18px}
.book p{margin:0 0 14px;color:#5C5346;font-size:14px}
.book-btn{display:inline-block;background:#A95A21;color:#fff;font-weight:700;padding:11px 20px;border-radius:999px;text-decoration:none}
.book-btn.alt{background:#2E7DA8}
.faq{margin:30px 0}
.faq details{border-bottom:1px solid rgba(43,37,32,.12);padding:12px 2px}
.faq summary{cursor:pointer;font-weight:700;font-size:15px;color:#33271B;list-style:none}
.faq summary::-webkit-details-marker{display:none}
.faq summary::before{content:'+ ';color:#A25A20;font-weight:700}
.faq details[open] summary::before{content:'– '}
.faq details p{margin:9px 0 2px;color:#5C5346;font-size:14px}
.news{position:relative;overflow:hidden;margin:34px 0;padding:44px 26px;border-radius:18px;background:linear-gradient(180deg,#14102A 0%,#39295A 55%,#8B4E63 92%);text-align:center;color:#fff}
.news-stars{position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(1.6px 1.6px at 12% 26%,#fff,transparent),radial-gradient(1.2px 1.2px at 34% 14%,#fff,transparent),radial-gradient(1.5px 1.5px at 56% 30%,#fff,transparent),radial-gradient(1.2px 1.2px at 74% 16%,#FFE9C4,transparent),radial-gradient(1.6px 1.6px at 90% 32%,#fff,transparent),radial-gradient(1px 1px at 44% 52%,#fff,transparent);animation:nStar 4.5s ease-in-out infinite}
@keyframes nStar{0%,100%{opacity:.9}50%{opacity:.35}}
.news-in{position:relative;z-index:1;max-width:520px;margin:0 auto}
.news-eyebrow{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:3.5px;text-transform:uppercase;color:#F7DFBE}
.news h2{font-family:'Cormorant Garamond',serif;font-size-adjust:.44;font-weight:600;font-size:clamp(24px,4vw,36px);line-height:1.1;color:#fff;margin:10px 0 8px}
.news h2 em{font-style:italic;color:#F7DFBE}
.news p{margin:0 0 18px;color:rgba(255,255,255,.82);font-size:14.5px}
.news-shop{display:inline-block;margin:4px 0 18px}
.news-form{display:flex;gap:8px;max-width:430px;margin:0 auto;flex-wrap:wrap;justify-content:center}
.news-form input{flex:1;min-width:200px;padding:13px 16px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.96);color:#2B2620;font-size:14px}
.news-form input:focus{outline:none;border-color:#F7DFBE}
.news-form button{padding:13px 24px;border-radius:999px;border:none;background:#E9B978;color:#2A2016;font-weight:700;letter-spacing:.4px;cursor:pointer;transition:background .25s}
.news-form button:hover{background:#fff}
.guide-sec{margin:24px 0}
.ct-ways{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;margin:26px 0 6px}
.ct-way{display:flex;flex-direction:column;gap:5px;padding:18px 20px;background:#fff;border:1px solid rgba(43,37,32,.12);border-radius:16px;text-decoration:none;color:inherit;box-shadow:0 2px 12px rgba(58,42,28,.06);transition:border-color .2s,transform .2s}
.ct-way:hover,.ct-way:focus-visible{border-color:#A95A21;transform:translateY(-2px)}

/* ===== About: the mark comes alive (Faheem, 14 Sep: "make the hero alive ... an
   animated render of our mark"). The four layers of mark-paths.js draw on in the
   order a hand would draw them - left ridge, right ridge, then the sun rises into
   its seat and the wordmark surfaces - while the sky behind goes from night to
   dawn. All CSS: the wipes are gradient-edged mask rects translated into place, so
   the leading edge is soft ink rather than a hard cut. Reduced-motion gets the
   finished frame. */
.ab-hero{position:relative;overflow:hidden;color:#F7EFE2;min-height:clamp(560px,82vh,880px);display:flex;align-items:center;justify-content:center;padding:clamp(28px,5vw,56px) clamp(16px,5vw,32px) clamp(40px,6vw,64px);background:#0E0A1F;isolation:isolate}
.ab-sky,.ab-dawn,.ab-stars,.ab-haze,.ab-grain{position:absolute;inset:0;pointer-events:none}
.ab-sky{background:linear-gradient(180deg,#0B0819 0%,#171233 48%,#2A1E45 100%)}
.ab-dawn{background:linear-gradient(180deg,#14102A 0%,#39295A 34%,#7A4F63 66%,#C0702E 100%);opacity:0;animation:abDawn 6s cubic-bezier(.4,0,.2,1) 1.3s both}
.ab-haze{background:radial-gradient(120% 55% at 50% 100%,rgba(240,178,96,.55),rgba(240,178,96,0) 62%);opacity:0;animation:abHaze 5.5s ease-out 2s both}
.ab-stars{background-image:radial-gradient(1.6px 1.6px at 12% 22%,#fff,transparent),radial-gradient(1.2px 1.2px at 27% 9%,#fff,transparent),radial-gradient(1.5px 1.5px at 41% 31%,#fff,transparent),radial-gradient(1.1px 1.1px at 56% 14%,#FFE9C4,transparent),radial-gradient(1.7px 1.7px at 68% 26%,#fff,transparent),radial-gradient(1.2px 1.2px at 79% 8%,#fff,transparent),radial-gradient(1.5px 1.5px at 88% 30%,#FFE9C4,transparent),radial-gradient(1px 1px at 34% 44%,#fff,transparent),radial-gradient(1px 1px at 62% 41%,#fff,transparent),radial-gradient(1.3px 1.3px at 8% 50%,#fff,transparent),radial-gradient(1px 1px at 93% 48%,#fff,transparent),radial-gradient(1.2px 1.2px at 48% 6%,#fff,transparent);opacity:.95;animation:abStars 6.5s ease-in-out 1.9s both,abTwinkle 5.5s ease-in-out infinite}
.ab-grain{opacity:.07;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");mix-blend-mode:overlay}
.ab-hero-inner{position:relative;z-index:2;width:100%;max-width:820px;margin:0 auto;text-align:center}
.ab-hero .crumbs{color:rgba(247,239,226,.7);text-shadow:0 1px 12px rgba(0,0,0,.35)}
.ab-hero .crumbs a{color:inherit}
.ab-mark{width:min(640px,86vw);margin:clamp(6px,2vw,18px) auto clamp(18px,3vw,30px);filter:drop-shadow(0 10px 30px rgba(0,0,0,.35))}
.ab-mark svg{display:block;width:100%;height:auto;overflow:visible}
.ab-ink{fill:#D9C3A5}
.ab-wipe{transform:translateX(var(--from));animation:abWipe var(--dur) cubic-bezier(.65,0,.3,1) var(--delay) both}
.ab-sun{transform-box:fill-box;transform-origin:50% 50%;opacity:0;transform:translateY(150px) scale(.72);animation:abRise 1.4s cubic-bezier(.2,.7,.2,1) 1.9s both}
.ab-sun .ab-ink{animation:abWarm 2.2s ease-in-out 2.9s both}
.ab-glow{opacity:0;animation:abGlowIn 1.8s ease-out 2.2s both,abBreathe 7s ease-in-out 4s infinite}
.ab-arabic{opacity:0;transform:translateY(38px);animation:abSurface 1.1s cubic-bezier(.2,.7,.2,1) 2.7s both}
.ab-eyebrow{font-family:'Space Mono',monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#E9B978;margin:0 0 10px}
.ab-hero h1{font-family:'Cormorant Garamond',serif;font-size-adjust:.44;font-weight:600;font-size:clamp(30px,4.6vw,52px);line-height:1.08;letter-spacing:-.01em;margin:0 0 14px;color:#FBF4E8;text-shadow:0 2px 24px rgba(0,0,0,.35)}
.ab-hero h1 em{font-style:italic;color:#E9B978}
.ab-hero .lede{font-size:clamp(16px,1.6vw,19px);line-height:1.55;color:rgba(247,239,226,.88);max-width:600px;margin:0 auto 22px;text-shadow:0 1px 12px rgba(0,0,0,.35)}
.ab-cta{display:inline-flex;align-items:center;gap:10px;padding:13px 22px;border-radius:999px;background:#E9B978;color:#2A2016;font-family:'Space Mono',monospace;font-size:12.5px;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;font-weight:700;transition:background .25s,transform .2s}
.ab-cta:hover{background:#fff;transform:translateY(-1px)}
.ab-copy{opacity:0;transform:translateY(14px);animation:abSurface 1s cubic-bezier(.2,.7,.2,1) both}
.ab-copy.c1{animation-delay:2.95s}.ab-copy.c2{animation-delay:3.1s}.ab-copy.c3{animation-delay:3.25s}.ab-copy.c4{animation-delay:3.4s}
@keyframes abWipe{to{transform:translateX(0)}}
@keyframes abRise{to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes abWarm{from{fill:#D9C3A5}to{fill:#F0C27A}}
@keyframes abGlowIn{to{opacity:.72}}
@keyframes abBreathe{0%,100%{opacity:.72}50%{opacity:.5}}
@keyframes abSurface{to{opacity:1;transform:translateY(0)}}
@keyframes abDawn{to{opacity:1}}
@keyframes abHaze{to{opacity:1}}
@keyframes abStars{to{opacity:.32}}
@keyframes abTwinkle{0%,100%{filter:brightness(1)}50%{filter:brightness(.55)}}
@media(prefers-reduced-motion:reduce){
  .ab-dawn,.ab-haze,.ab-stars,.ab-wipe,.ab-sun,.ab-sun .ab-ink,.ab-glow,.ab-arabic,.ab-copy{animation:none!important}
  .ab-dawn,.ab-haze,.ab-sun,.ab-arabic,.ab-copy{opacity:1;transform:none}
  .ab-wipe{transform:translateX(0)}.ab-sun path{fill:#F0C27A}.ab-glow{opacity:.6}.ab-stars{opacity:.32}
}
/* the page below the hero */
.ab-intro{font-family:'Cormorant Garamond',serif;font-size-adjust:.44;font-size:clamp(20px,2.4vw,26px);line-height:1.45;color:#2A2016;margin:0 0 8px}
.ab-intro em{color:#9C521B;font-style:italic}
.ab-places{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;margin:18px 0 8px}
.ab-place{display:flex;flex-direction:column;gap:6px;padding:20px 20px 18px;border-radius:16px;color:#F7EFE2;text-decoration:none;position:relative;overflow:hidden;min-height:300px;justify-content:flex-end;background:#2A1E45;box-shadow:0 2px 14px rgba(58,42,28,.12);transition:transform .2s,box-shadow .2s}
@media(min-width:701px){.ab-place{min-height:400px}}
.ab-place-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;transition:transform .6s ease}
.ab-place:hover .ab-place-img{transform:scale(1.04)}
.ab-place:hover,.ab-place:focus-visible{transform:translateY(-2px);box-shadow:0 8px 24px rgba(58,42,28,.2)}
.ab-place::after{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(10,6,20,.05) 0%,rgba(10,6,20,.35) 45%,rgba(10,6,20,.82) 100%);pointer-events:none}
.ab-place>*:not(.ab-place-img){position:relative;z-index:2}
.ab-place-name{font-family:'Cormorant Garamond',serif;font-size-adjust:.44;font-size:22px;line-height:1.15}
.ab-place-meta{font-family:'Space Mono',monospace;font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:rgba(247,239,226,.85)}
.ab-place-blurb{font-size:14.5px;line-height:1.5;color:rgba(247,239,226,.92);text-shadow:0 1px 8px rgba(0,0,0,.45)}
.ab-place-go{font-family:'Space Mono',monospace;font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:#E9B978;margin-top:4px}
.ab-facts{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin:16px 0 8px}
@media(max-width:600px){.ab-facts{grid-template-columns:1fr}}
.ab-fact{padding:18px 20px;background:#fff;border:1px solid rgba(43,37,32,.12);border-radius:16px;box-shadow:0 2px 12px rgba(58,42,28,.06)}
.ab-fact b{display:block;font-family:'Space Mono',monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#7E4114;margin-bottom:6px}
.ab-fact p{margin:0;font-size:15.5px;line-height:1.55;color:#4A4136}
.ab-contact-more{font-size:15px;color:#6B6256;margin-top:14px}
.ct-lab{font-family:'Space Mono',monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#7E4114}
.ct-val{font-size:19px;line-height:1.3;overflow-wrap:anywhere;hyphens:none}
/* the address is 23 characters - at 19px it broke mid-word inside the card */
.ct-val-em{font-size:15.5px;letter-spacing:-.01em}
.ct-sub{font-size:14px;color:#4A4136}
.guide-sec h2{font-size:20px;margin:0 0 8px}
/* the fabric/cut essays fold under their heading on the buying pages: the products come first, the reading is there for whoever wants it */
.fold{border-top:1px solid rgba(43,37,32,.14);margin:0}
.fold summary{cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 0}
.fold summary::-webkit-details-marker{display:none}
.fold summary h2{margin:0;font-size:19px}
.fold summary::after{content:'+';font-family:'Space Mono',monospace;font-size:20px;color:#9C521B;flex:none}
.fold[open] summary::after{content:'\\2212'}
.fold .content{padding:0 0 18px}
.folds{margin:28px 0;border-bottom:1px solid rgba(43,37,32,.14)}
.folds-eyebrow{display:block;font-family:'Space Mono',monospace;font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:#7E4114;margin-bottom:4px}
/* ---- spec tables (size guide + fabric GSM) ------------------------------
   These had NO rules at all until 29 Aug 2026 — the size guide shipped a raw
   browser-default table on an otherwise designed page, and overflowed at 390px.
   Both tables share this block; style one, style both. Muting is done with a
   COLOUR (#6B6256, 5.6:1) and never with opacity. */
.guide-sec h3{font-size:15px;letter-spacing:.4px;text-transform:uppercase;font-family:'Space Mono',monospace;color:#33271B;margin:22px 0 4px}
.sgintent{margin:0 0 12px;font-size:14px;color:#5C5346;line-height:1.6}
.sgwrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid rgba(43,37,32,.14);border-radius:10px;background:#fff}
.sgwrap::-webkit-scrollbar{height:6px}
.sgwrap::-webkit-scrollbar-thumb{background:rgba(43,37,32,.2);border-radius:3px}
table.sg{width:100%;border-collapse:collapse;font-size:13.5px;min-width:460px}
table.sg thead th{background:#F3EADC;color:#33271B;font-family:'Space Mono',monospace;font-size:10.5px;letter-spacing:1.4px;text-transform:uppercase;text-align:left;padding:11px 12px;white-space:nowrap;border-bottom:1px solid rgba(43,37,32,.16)}
table.sg tbody th{text-align:left;font-family:'Space Mono',monospace;font-weight:700;color:#33271B;background:#FBF7F0;white-space:nowrap}
table.sg th,table.sg td{padding:11px 12px;border-bottom:1px solid rgba(43,37,32,.10);vertical-align:top;line-height:1.5}
table.sg tbody tr:last-child th,table.sg tbody tr:last-child td{border-bottom:0}
table.sg td{color:#3F382F}
.sz-in{font-family:'Space Mono',monospace;font-weight:700;color:#33271B}
.sz-sep,.sz-cm{color:#6B6256}
.sgmethod{margin:8px 0 0;padding-left:18px;font-size:14px;color:#5C5346;line-height:1.65}
.sgmethod li{margin:4px 0}
.sgnote{margin:10px 0 0;font-size:13px;color:#6B6256;line-height:1.6}
/* The GSM table carries prose, not numbers, so it needs room to breathe and a
   highlight on the two weights we actually sell. */
table.sg.gsm{min-width:540px}
table.sg.gsm td{font-size:13.5px}
table.sg.gsm tr.is-ours th,table.sg.gsm tr.is-ours td{background:#F6EFE2}
table.sg.gsm tr.is-ours th{color:#7E4114}
.gsm-key{display:inline-block;margin:10px 0 0;font-size:12.5px;color:#6B6256;font-family:'Space Mono',monospace;letter-spacing:.3px}
.gsm-key b{color:#7E4114;font-weight:700}
@media(max-width:520px){
  table.sg{font-size:13px}
  table.sg th,table.sg td{padding:10px 10px}
  .sgwrap{border-radius:8px}
}
/* ---- journal cards -------------------------------------------------------
   One card style for both the hub and the related strip. Auto-fill rather
   than a fixed column count, so it degrades to a single column on a phone
   without a breakpoint. Muted text is a COLOUR, never opacity. */
.jgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin:14px 0 4px}
/* The border is at the CONTROL tone (.58), not the hairline tone (.14).
   A white card on the sand background is only 1.08:1 — invisible — so the
   border is the sole thing showing where the tap target is, which makes it a
   control boundary needing 3:1, not a decorative divider. At .14 it measured
   1.32:1. This is the identical mistake that made the shop filter chips
   disappear; the rule is in MASTER_BRIEF and it applies here too. */
.jcard{display:flex;flex-direction:column;gap:7px;padding:18px 18px 20px;border:1px solid rgba(42,32,22,.58);border-radius:12px;background:#fff;text-decoration:none;color:inherit;transition:border-color .25s,transform .25s,box-shadow .25s}
.jcard:hover{border-color:rgba(42,32,22,.85);box-shadow:0 6px 18px rgba(42,32,22,.10);transform:translateY(-2px)}
.jcard:focus-visible{outline:2px solid #7E4114;outline-offset:2px}
.jkick{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#7E4114}
.jcard b{font-family:'Cormorant Garamond',serif;font-size-adjust:.44;font-weight:600;font-size:18px;line-height:1.25;color:#33271B}
.jblurb{font-size:13.5px;line-height:1.6;color:#5C5346}
.jmeta{margin-top:auto;padding-top:6px;font-family:'Space Mono',monospace;font-size:11px;color:#6B6256}
.jdot{padding:0 6px;color:#6B6256}
.jbyline{margin:0 0 14px;font-family:'Space Mono',monospace;font-size:11.5px;letter-spacing:.4px;color:#6B6256}
/* ---- market-aware shipping copy ------------------------------------------
   All three variants ship in the HTML; CSS shows exactly one, driven by
   data-market on <html>. The UAE variant is the no-JS/crawler default, so
   Google keeps seeing precisely the content it already ranks. JS only ever
   flips an attribute — if it never runs, the site is simply its UAE self. */
.sb-ship-gcc,.sb-ship-intl{display:none}
html[data-market="gcc"] .sb-ship-uae,html[data-market="gcc"] .sb-ship-intl{display:none}
html[data-market="gcc"] .sb-ship-gcc{display:inline}
html[data-market="intl"] .sb-ship-uae,html[data-market="intl"] .sb-ship-gcc{display:none}
html[data-market="intl"] .sb-ship-intl{display:inline}
/* ---- currency selector ---------------------------------------------------
   Injected by sahra-market.js into [data-sb-curslot] ONLY when the store
   offers more than one real currency. Border is the control tone, not the
   hairline — a select the customer cannot find is the filter-chip bug again. */
.sb-curwrap{display:inline-flex;align-items:center;gap:8px}
.sb-aed-alt{display:none}html[data-price-cur]:not([data-price-cur="AED"]) .sb-aed-only{display:none}html[data-price-cur]:not([data-price-cur="AED"]) .sb-aed-alt{display:inline}
.sb-curhint{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6B6256}
.sb-curpick{appearance:none;-webkit-appearance:none;font-family:'Space Mono',monospace;font-size:12px;color:#33271B;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2333271B' fill='none' stroke-width='1.5'/%3E%3C/svg%3E") no-repeat right 12px center;border:1px solid rgba(42,32,22,.58);border-radius:999px;padding:10px 32px 10px 14px;min-height:44px;cursor:pointer}
.sb-curpick:focus-visible{outline:2px solid #7E4114;outline-offset:2px}
/* ---- product image auto-cycle (Faheem, 31 Aug: every shirt, everywhere,
   shows ALL its photos). Stacked absolutely per the cross-fade guard. ---- */
[data-cycle]{position:relative}
[data-cycle] img{position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity .6s ease-in-out;z-index:1;
  /* cover, never fill: the stack replaced per-image inline styles, and without
     an explicit object-fit these rules stretched photos to the frame (Faheem's
     mobile report). cover crops to fit; 30% keeps heads/design in frame.
     padding:0 defeats .pcard-img's 6% inset, which fought cover on real-world
     photos. */
  object-fit:cover;object-position:center 30%;padding:0}
[data-cycle] img.on{opacity:1;z-index:3;will-change:opacity}
[data-cycle] img.was{opacity:1;transition:none;z-index:2;will-change:opacity}
/* .was is the OUTGOING frame, pinned fully opaque beneath the incoming one
   for the length of the fade. Fading both at once left the stack only 75%
   covered at the midpoint (1 - .5*.5), so the card's sand gradient pulsed
   through on every transition - read as flicker on the dark tees
   (Faheem, 2 Sep 2026). One layer fades, the other holds.
   will-change:opacity keeps the two active frames on their own compositor
   layers for the whole switch. Without it Chrome promotes a frame only while
   its opacity animates and re-rasterises the card the moment the fade ends -
   on an Android tablet that repaint shows as a sudden flash (the "sudden
   flashes" report, 2 Sep 2026). Only .on/.was are promoted: promoting all 26
   homepage frames would cost tens of MB of GPU memory on a tablet. The fade
   is .6s ease-in-out and the engine's HOLD (720ms) must stay longer. */

.sb-rot{display:none}
.sb-rot.on{display:inline}
.sb-curwrap--hdr{margin-left:4px}
.sb-curpick--hdr{min-height:34px;padding:6px 24px 6px 10px;font-size:11px;background-position:right 8px center}
@media(max-width:820px){.sb-curwrap--hdr{display:none}}
.ig{margin:30px 0}
.ig-hint{font-size:12px;color:#6B6256;margin:-4px 0 10px}
.ig-strip{display:flex;gap:14px;overflow-x:auto;padding:2px 2px 12px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch}
.ig-strip::-webkit-scrollbar{height:6px}
.ig-strip::-webkit-scrollbar-thumb{background:rgba(43,37,32,.2);border-radius:3px}
.ig-strip .ig-item{flex:0 0 auto;scroll-snap-align:start}
.ig-strip .instagram-media{margin:0!important;min-width:326px!important;width:326px!important;max-width:326px!important}
.hdr-nav{display:flex;gap:3px;min-width:0;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.hdr-nav::-webkit-scrollbar{display:none}
.hdr-nav a{flex:0 0 auto;padding:8px 14px;border-radius:999px;font-family:Jost,sans-serif;font-size:12.5px;font-weight:600;color:#6B6256;text-decoration:none;white-space:nowrap;transition:all .2s}
.hdr-nav a:hover{background:rgba(192,112,46,.1);color:#9C521B}
.hdr-nav a.active{background:#A95A21;color:#fff;box-shadow:0 4px 12px rgba(192,112,46,.3)}
main{max-width:820px;margin:0 auto;padding:clamp(24px,5vw,56px) clamp(16px,5vw,32px)}
.crumbs{font-size:12px;color:#6B6256;margin-bottom:14px}
.crumbs a{color:#6B6256;text-decoration:none}
h1{font-family:'Cormorant Garamond',serif;font-size-adjust:.44;font-weight:600;font-size:clamp(28px,5vw,44px);color:#33271B;line-height:1.1;margin-bottom:10px}
.lede{font-size:14px;color:#9C521B;font-weight:600;margin-bottom:22px}
h2{font-family:'Cormorant Garamond',serif;font-size-adjust:.44;font-weight:600;font-size:24px;color:#33271B;margin:30px 0 12px}
.place-buy{margin:22px 0}
.place-buy a{color:var(--clay-deep,#7E4114);text-decoration:underline;text-underline-offset:3px}
.content p{margin-bottom:16px;font-size:16.5px;color:#4A4136}
/* location hero */
.loc-hero{position:relative;color:#fff;padding:clamp(44px,8vw,88px) clamp(16px,5vw,32px) clamp(96px,14vw,164px);overflow:hidden}  /* bottom padding clears the dune silhouettes so the lede is never covered */
.loc-hero::after{content:"";position:absolute;inset:0;z-index:1;background:radial-gradient(120% 80% at 80% 0%,rgba(255,255,255,.14),transparent 55%),linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.3));pointer-events:none}
/* Milky-Way star layer on every location hero — the brand signature */
.loc-hero::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background-image:radial-gradient(1.5px 1.5px at 14% 22%,#fff,transparent),radial-gradient(1.2px 1.2px at 32% 12%,#fff,transparent),radial-gradient(1.5px 1.5px at 52% 26%,#fff,transparent),radial-gradient(1.2px 1.2px at 72% 14%,#FFE9C4,transparent),radial-gradient(1.5px 1.5px at 88% 28%,#fff,transparent),radial-gradient(1px 1px at 24% 34%,#fff,transparent),radial-gradient(1px 1px at 63% 36%,#fff,transparent);opacity:.85;animation:nStar 5s ease-in-out infinite}
.loc-hero h1::after{content:"";display:block;width:54px;height:3px;margin-top:14px;background:linear-gradient(90deg,#E9B978,rgba(233,185,120,0))}
.loc-hero-inner{position:relative;z-index:3;max-width:820px;margin:0 auto}
/* Shared premium hero treatment — the same visual language as the homepage:
   layered dune silhouettes, a warm horizon glow and a fine grain over the top. */
.loc-hero{isolation:isolate}
.loc-hero .dune-far,.loc-hero .dune-near{position:absolute;left:0;right:0;bottom:0;width:100%;height:clamp(70px,11vw,130px);z-index:2;pointer-events:none;display:block}
.loc-hero .dune-far{opacity:.55;transform:translateY(14%)}
.loc-hero .glow{position:absolute;inset:auto 0 0 0;height:60%;z-index:1;pointer-events:none;background:radial-gradient(80% 120% at 50% 118%,rgba(240,178,106,.34),rgba(240,178,106,0) 62%)}
.loc-hero .grain{position:absolute;inset:0;z-index:4;pointer-events:none;opacity:.16;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E")}
@media(prefers-reduced-motion:reduce){.loc-hero::before{animation:none}}

.loc-hero .crumbs,.loc-hero .crumbs a{color:rgba(255,255,255,.85)}
.loc-emoji{font-size:56px;line-height:1;margin-bottom:6px;filter:drop-shadow(0 6px 14px rgba(0,0,0,.3))}
.loc-hero h1{color:#fff;text-shadow:0 2px 22px rgba(0,0,0,.35);margin-bottom:8px}
.loc-hero .lede,.loc-hero .crumbs{text-shadow:0 1px 12px rgba(0,0,0,.35)}
.loc-hero .lede{color:rgba(255,255,255,.96);margin-bottom:16px}
.wx{display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.32);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-radius:14px;padding:9px 15px;font-size:13.5px;font-weight:600;color:#fff;min-height:42px}
.wx .wx-ic{font-size:20px}
.wx .wx-temp{font-family:'Space Mono',monospace;font-size:20px;font-weight:700}
.wx .wx-desc{text-transform:capitalize;opacity:.95}
/* packing */
.pack{margin:34px 0}
.pack-controls{display:flex;flex-wrap:wrap;gap:18px;margin:12px 0 18px}
.pack-controls .grp{display:flex;gap:6px;flex-wrap:wrap}
.pack-btn{padding:8px 13px;border-radius:10px;border:1px solid rgba(43,37,32,.15);background:#fff;color:#4A4136;font-size:13px;font-weight:600;cursor:pointer}
.pack-btn.on{background:#A95A21;border-color:#A25A20;color:#fff}
.pack-grp-title{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#9C521B;font-weight:700;margin:18px 0 8px}
.pack-row{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid rgba(43,37,32,.1);border-radius:12px;padding:11px 14px;margin-bottom:8px;box-shadow:0 2px 10px rgba(58,42,28,.04)}
.pack-row .pk-main{flex:1;min-width:0}
.pack-row .pk-name{font-size:14.5px;color:#2B2620;font-weight:500}
.pack-row .pk-note{font-size:11.5px;color:#6B6256;margin-top:2px}
.pack-row .pk-qty{font-family:'Space Mono',monospace;font-size:11px;font-weight:700;color:#9C521B;background:rgba(192,112,46,.12);padding:3px 9px;border-radius:999px;white-space:nowrap}



.facts{background:#fff;border:1px solid rgba(43,37,32,.1);border-radius:16px;padding:20px 22px;margin:26px 0;box-shadow:0 2px 12px rgba(58,42,28,.06)}
.facts h2{margin-top:0;font-size:18px}
.facts ul{list-style:none}
.facts li{padding:6px 0;border-bottom:1px solid rgba(43,37,32,.06);font-size:14px}
.facts li:last-child{border:0}
.facts strong{color:#33271B}
.cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.btn{display:inline-block;padding:13px 26px;border-radius:2px;background:#A95A21;color:#fff;text-decoration:none;font-weight:500;font-size:13px;letter-spacing:1px;text-transform:uppercase}
.btn.ghost{background:none;color:#A25A20;border:1px solid #C0702E}
.btn.ghost:hover{background:rgba(192,112,46,.08)}
.pcta .btn+.btn{margin-left:10px}
@media(max-width:520px){.pcta .btn{display:block;text-align:center}.pcta .btn+.btn{margin:10px 0 0}}
.btn.alt{background:transparent;color:#9C521B;border:1px solid rgba(192,112,46,.4)}
.related{margin-top:34px}
.cards{display:grid;grid-template-columns:1fr;gap:12px;margin-top:8px}
@media(min-width:620px){.cards{grid-template-columns:1fr 1fr}}
.card{display:flex;gap:12px;align-items:flex-start;background:#fff;border:1px solid rgba(43,37,32,.1);border-radius:14px;padding:14px 16px;text-decoration:none;color:inherit;box-shadow:0 2px 12px rgba(58,42,28,.05);transition:transform .2s,box-shadow .2s}
.card:hover{transform:translateY(-3px);box-shadow:0 14px 30px rgba(58,42,28,.14)}
.card-emoji{font-size:26px;line-height:1.2}
.card-thumb{width:62px;height:62px;border-radius:12px;background-size:cover;background-position:center;flex:0 0 auto;box-shadow:0 3px 10px rgba(58,42,28,.18)}
.card-body{display:flex;flex-direction:column;min-width:0}
.card-body strong{font-family:'Cormorant Garamond',serif;font-size-adjust:.44;font-size:17px;color:#33271B}
.card-body em{font-style:normal;font-size:11.5px;color:#9C521B;font-weight:600;margin:2px 0 5px}
.card-body span{font-size:13px;color:#6B6256}
.back{margin-top:26px;font-weight:700}
.ftr{max-width:820px;margin:0 auto;padding:30px clamp(16px,5vw,32px) 48px;border-top:1px solid rgba(43,37,32,.1);text-align:center;color:#645B4F;font-size:12.5px}
.ftr .soc a{margin:0 7px;font-weight:700;color:#9C521B;text-decoration:none}
.ftr .links{margin:12px 0}
.ftr .links a{margin:0 8px;color:#6B6256;text-decoration:none;font-size:12px}
.ftr 
/* premium brand layer */
.ftr-tagline{font-family:'Cormorant Garamond',serif;font-size-adjust:.44;font-style:italic;font-size:17px;color:#9C521B;margin-bottom:14px}
.ftr .legal{margin-top:10px;font-weight:600}
.ftr .legal a{text-decoration:underline;text-underline-offset:3px}
.loc-hero::before{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.14) 46%,transparent 62%);background-size:240% 100%;animation:heroSweep 9s ease-in-out infinite;pointer-events:none}
@keyframes heroSweep{0%,100%{background-position:110% 0}50%{background-position:-10% 0}}
.loc-hero h1::after{content:"";display:block;width:52px;height:3px;margin-top:12px;background:linear-gradient(90deg,#E9B978,rgba(233,185,120,0))}
.hdr-nav a.shopnav{color:#9C521B;font-weight:700}
/* shop CTA band — living night sky */
/* --- the tee inspired by this place (product cross-link) --- */
.askcta{margin:34px 0;padding:26px 24px;border:1px solid rgba(192,112,46,.3);border-radius:16px;background:rgba(255,247,237,.7)}.askcta h2{font-family:'Cormorant Garamond',serif;font-size:clamp(24px,3.4vw,34px);font-weight:600;margin:6px 0 8px}.askcta p{margin:0 0 12px;color:#5C5346;font-size:14.5px}.askcta-row{display:flex;gap:10px;flex-wrap:wrap}.askcta .btn{display:inline-block;background:#A95A21;color:#fff;font-weight:700;padding:11px 18px;border-radius:999px;text-decoration:none}.askcta .btn.ghost{background:transparent;color:#9C521B;border:1px solid rgba(192,112,46,.5)}
.teecta{position:relative;overflow:hidden;margin:34px 0;border-radius:18px;background:var(--tee,#181109);color:#fff;box-shadow:0 24px 60px rgba(0,0,0,.18)}
.teecta-inner{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:0;align-items:stretch}
.teecta-img{display:block;position:relative;overflow:hidden;min-height:100%}
.teecta-img img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .7s ease}
.teecta-img:hover img{transform:scale(1.06)}
.teecta-txt{padding:34px 32px;display:flex;flex-direction:column;justify-content:center;background:rgba(0,0,0,.6);backdrop-filter:blur(2px)}   /* 25 Sep typography review: .28 left white and gold text at ~1.3:1 on the light product colours (sand, lilac) */
.teecta-eyebrow{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:3.5px;text-transform:uppercase;color:#F7DFBE;margin-bottom:10px}
.teecta h2{font-family:'Cormorant Garamond',serif;font-size-adjust:.44;font-size:clamp(24px,3.4vw,34px);font-weight:600;line-height:1.08;color:#fff;margin:0 0 10px}
.teecta p{color:rgba(255,255,255,.82);font-size:15px;line-height:1.7;margin:0 0 16px;max-width:46ch}
.teecta-meta{display:flex;flex-wrap:wrap;gap:8px 14px;margin-bottom:20px;font-family:'Space Mono',monospace;font-size:10.5px;letter-spacing:.8px;color:rgba(255,255,255,.72)}
.teecta .btn{align-self:flex-start;background:#E9B978;color:#181109;border:none}
.teecta .btn:hover{background:#fff}


/* ---- Living background ----------------------------------------------------
   The main pages blend colour as you scroll; these pages were flat by comparison.
   Hero: the category gradient, oversized and slowly drifting.
   Page: fixed aurora washes that shift, plus a scroll-linked tint on <body>.   */
.loc-hero{background-image:var(--hero-grad,linear-gradient(160deg,#14102A 0%,#39295A 40%,#7A4F63 72%,#C0702E 100%));
  background-size:220% 220%;background-position:0% 30%;animation:heroDrift 26s ease-in-out infinite alternate}
@keyframes heroDrift{0%{background-position:0% 28%}50%{background-position:60% 62%}100%{background-position:100% 38%}}
body::before{content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;
  background:
   radial-gradient(52% 42% at 12% 8%,rgba(122,79,99,.20),transparent 62%),
   radial-gradient(48% 40% at 88% 16%,rgba(192,112,46,.17),transparent 64%),
   radial-gradient(60% 44% at 50% 104%,rgba(20,16,42,.16),transparent 66%);
  background-size:180% 180%,170% 170%,200% 200%;
  animation:auroraDrift 34s ease-in-out infinite alternate}
@keyframes auroraDrift{
  0%{background-position:0% 0%,100% 0%,50% 100%}
  50%{background-position:40% 30%,60% 40%,40% 70%}
  100%{background-position:100% 40%,0% 60%,60% 100%}}
body::after{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.5;
  background:radial-gradient(120% 90% at 50% -20%,var(--scroll-tint,rgba(192,112,46,0)),transparent 58%);
  transition:background .6s linear}
main,.ftr{position:relative;z-index:1}
@media(prefers-reduced-motion:reduce){
  .loc-hero,body::before{animation:none}
  body::after{transition:none}}

/* ---- Mobile navigation ----------------------------------------------------
   The links used to be display:none below the breakpoint with nothing to
   replace them, so phones had no menu at all. Hamburger + slide-down panel. */
.mnav{display:none;position:relative;z-index:120;background:none;border:0;padding:8px;margin:-8px -8px -8px 0;cursor:pointer;line-height:0}
.mnav span{display:block;width:22px;height:2px;margin:4px 0;border-radius:2px;background:currentColor;transition:transform .3s,opacity .3s}
.mnav[aria-expanded="true"] span:nth-child(1){transform:translateY(6px) rotate(45deg)}
.mnav[aria-expanded="true"] span:nth-child(2){opacity:0}
.mnav[aria-expanded="true"] span:nth-child(3){transform:translateY(-6px) rotate(-45deg)}
@media(max-width:820px){
  .mnav{display:block}
  .nav-links,.hdr-nav{display:none!important}
  .m-panel{display:block;position:fixed;left:0;right:0;top:0;z-index:110;padding:78px 22px 26px;
    background:rgba(24,17,9,.97);backdrop-filter:blur(14px);
    transform:translateY(-102%);transition:transform .38s cubic-bezier(.4,0,.2,1);
    box-shadow:0 18px 50px rgba(0,0,0,.4);max-height:100dvh;overflow:auto}
  .m-panel.open{transform:translateY(0)}
  .m-panel a{display:block;padding:15px 4px;color:#F7EFE2;text-decoration:none;font-size:19px;
    border-bottom:1px solid rgba(247,239,226,.12)}
  .m-panel a:last-child{border-bottom:0}
  .m-panel a.active,.m-panel a[aria-current="page"]{color:#F7DFBE}
  .m-panel a::after{display:none!important}
  .m-close{position:absolute;top:12px;right:14px;width:44px;height:44px;display:flex;
    align-items:center;justify-content:center;background:none;border:0;cursor:pointer;
    color:#F7EFE2;font-size:34px;line-height:1;padding:0;border-radius:50%}
  .m-close:active{background:rgba(247,239,226,.12)}

  /* The mark is 300x40, so at 26px tall it renders ~195px wide and left the
     hamburger no room — the two collided on a 360px screen. */
  .logo .mark,.logo-img,.brand img{height:18px}
  .logo,.brand{min-width:0;flex:0 1 auto;overflow:hidden}
  .logo>div,.logo-text,.brand-text{white-space:nowrap}
  nav,.hdr{padding-left:16px;padding-right:16px;gap:10px}
  .mnav{flex:0 0 auto}

}
/* Narrow phones: 18px mark (135px) + wordmark + cart + burger is ~356px of
   chrome. Below 400px the wordmark tightens; below 340px only the mark stays.
   (The shop and product pages' mark is .logo-img, the homepage's is .mark -
   the 18px rule above once named only .mark, so on the shop the 195px mark
   pushed the wordmark under the cart and .logo{overflow:hidden} cut it to
   "SAH|". Faheem's phone, 2 Sep 2026.) */
@media(max-width:400px){.logo-a,.brand-sahra{font-size:13px;letter-spacing:2.5px}.logo-b,.brand-beyond{font-size:6.5px;letter-spacing:1.5px}.logo,.brand{gap:8px}}
@media(max-width:340px){.logo>div,.logo-text,.brand-text{display:none}}
@media(min-width:821px){.m-panel{display:none}}
/* ---- Product cards (category + collection blocks) -------------------------
   These classes were emitted but never styled, so 1536px mockups rendered at
   full size and blew past the viewport, with no product information at all.  */
.pcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:22px;margin:26px 0 30px}
/* A single product (the polo) was landing in the first cell of a multi-column
   grid, so it covered half the screen and sat off to one side. */
.pcards>.pcard:only-child{grid-column:1/-1;max-width:420px;margin-inline:auto}
.pcard{position:relative;display:flex;flex-direction:column;background:#fff;border:1px solid var(--line,rgba(43,37,32,.12));border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(43,37,32,.04);transition:box-shadow .3s,transform .3s}
.pcard:hover{box-shadow:0 14px 34px rgba(43,37,32,.13);transform:translateY(-3px)}
.pcard-img{position:relative;display:block;aspect-ratio:4/5;overflow:hidden;background:#EFEAE0}
.pcard-imglink{position:absolute;inset:0;display:block}
.pcard-img img{width:100%;height:100%;object-fit:contain;display:block;padding:6%;transition:transform .6s ease}
/* The photo links to the product, same as the title. The anchor wraps only the
   image and sits BESIDE the zoom button rather than around it: a <button>
   inside an <a> is invalid, and the zoom control needs its own click. It is
   tabindex=-1 so keyboard users get one stop per card (the title) instead of
   two links to the same page. */
.pcard-imglink{display:block;width:100%;height:100%;position:relative;z-index:1}
.pcard:hover .pcard-img img{transform:scale(1.04)}
.pcard-zoom{position:absolute;right:10px;bottom:10px;z-index:2;border:0;border-radius:999px;width:34px;height:34px;cursor:pointer;
  background:rgba(255,255,255,.92);color:#2B2620;font-size:15px;line-height:34px;text-align:center;padding:0;
  box-shadow:0 2px 8px rgba(43,37,32,.18);opacity:0;transition:opacity .25s}
.pcard:hover .pcard-zoom,.pcard-zoom:focus-visible{opacity:1}
.pcard-b{display:flex;flex-direction:column;gap:7px;padding:15px 16px 17px}
.pcard-t{font-family:'Cormorant Garamond',serif;font-size-adjust:.44;font-size:18px;line-height:1.25;color:#2B2620;text-decoration:none}
.pcard-t:hover{color:var(--clay,#9C521B)}
.pcard-place{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:#6B6256}
.pcard-spec{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.pcard-spec span{font-family:'Space Mono',monospace;font-size:9.5px;letter-spacing:.8px;text-transform:uppercase;
  border:1px solid var(--line,rgba(43,37,32,.14));border-radius:999px;padding:3px 8px;opacity:1}
.pcard-col{display:flex;align-items:center;gap:7px;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.8px;text-transform:uppercase;opacity:1}
.pcard-sw{width:15px;height:15px;border-radius:3px;border:1px solid rgba(0,0,0,.22);box-shadow:inset 0 0 0 1px rgba(255,255,255,.3);flex:0 0 auto}
.pcard-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:6px;padding-top:11px;border-top:1px solid var(--line,rgba(43,37,32,.1))}
.pcard-p{font-weight:700;font-size:15px}
.pcard-cta{font-family:'Space Mono',monospace;font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:var(--clay,#9C521B);text-decoration:none;border-bottom:1px solid currentColor;padding-bottom:1px}
/* zoom overlay */
#pzoom{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(20,16,12,.92);padding:24px}
#pzoom.on{display:flex}
#pzoom img{max-width:92vw;max-height:88vh;width:auto;height:auto;object-fit:contain;border-radius:4px}
#pzoom button{position:absolute;top:18px;right:22px;background:none;border:0;color:#fff;font-size:30px;line-height:1;cursor:pointer}
@media(max-width:560px){.pcards{grid-template-columns:1fr 1fr;gap:14px}.pcard-b{padding:12px}.pcard-t{font-size:15px}.pcard-zoom{opacity:1}}
@media(max-width:760px){.teecta-inner{grid-template-columns:1fr}.teecta-img{aspect-ratio:4/3}.teecta-txt{padding:26px 22px}}
.shopcta{position:relative;overflow:hidden;margin:34px 0;border-radius:18px;padding:34px 26px;text-align:center;color:#fff;background:linear-gradient(180deg,#14102A 0%,#39295A 55%,#8B4E63 90%)}
.shopcta .stars,.shopcta .stars2{content:"";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(1.6px 1.6px at 12% 28%,#fff,transparent),radial-gradient(1.2px 1.2px at 32% 14%,#fff,transparent),radial-gradient(1.6px 1.6px at 54% 34%,#fff,transparent),radial-gradient(1.2px 1.2px at 71% 18%,#fff,transparent),radial-gradient(1.6px 1.6px at 88% 30%,#fff,transparent),radial-gradient(1px 1px at 44% 52%,#fff,transparent);animation:ctaTwinkle 4.5s ease-in-out infinite}
.shopcta .stars2{background-image:radial-gradient(1.2px 1.2px at 22% 44%,#FFE9C4,transparent),radial-gradient(1.5px 1.5px at 62% 12%,#FFE9C4,transparent),radial-gradient(1px 1px at 80% 48%,#fff,transparent),radial-gradient(1.4px 1.4px at 8% 12%,#fff,transparent);animation-delay:2.2s}
@keyframes ctaTwinkle{0%,100%{opacity:.9}50%{opacity:.3}}
.shopcta .shoot{position:absolute;top:16%;left:-12%;width:110px;height:1.5px;background:linear-gradient(90deg,transparent,#FFF6DF);border-radius:2px;transform:rotate(9deg);animation:ctaShoot 7.5s ease-in infinite;pointer-events:none}
@keyframes ctaShoot{0%,64%{left:-12%;opacity:0}68%{opacity:1}78%,100%{left:104%;opacity:0}}
.shopcta-eyebrow{position:relative;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:3.5px;text-transform:uppercase;color:#F7DFBE;margin-bottom:10px}
.shopcta h2{position:relative;font-family:'Cormorant Garamond',serif;font-size-adjust:.44;font-weight:600;font-size:clamp(24px,4.4vw,36px);color:#fff;margin:0 0 8px;line-height:1.12}
.shopcta h2 em{font-style:italic;color:#F7DFBE}
.shopcta p{position:relative;color:rgba(255,255,255,.85);font-size:14.5px;max-width:460px;margin:0 auto 18px}
.shopcta .btn{position:relative;background:#fff;color:#2A2016;border-radius:999px;padding:12px 26px}
.shopcta .btn:hover{background:#E9B978}
@media(prefers-reduced-motion:reduce){.loc-hero::before,.shopcta .stars,.shopcta .stars2,.shopcta .shoot{animation:none}}
`;

// injected: product-card CSS for the collection module
/* One robots meta for every page (handover item 25): indexable pages allow large image
   previews and full snippets; gated pages (unreviewed Arabic, drafts) are noindex,follow. */
function robotsMeta(noindex) { return `<meta name="robots" content="${noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large,max-snippet:-1'}">`; }
function footerHtml() {
  const soc = ['instagram', 'tiktok', 'youtube'].filter(k => social[k]).map(k => `<a href="${esc(social[k])}" target="_blank" rel="noopener">${k[0].toUpperCase() + k.slice(1)}</a>`).join('');
  return `<div class="ftr-tagline">${esc(TAGLINE)}</div>
  <div class="soc">${soc}</div>
  <div class="links"><a href="https://checkout.sahraandbeyond.ae/account" rel="nofollow">Orders</a> · <a href="/about/">About us</a> · <a href="/contact/">Contact</a></div>
  ${FG.guidesHtml(null, AR_CORE_PUBLIC)}
  ${IG.footerRowHtml()}
  <div class="links" style="margin:10px 0 2px"><span data-sb-curslot></span></div>
  <div class="links" style="font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1.6px;text-transform:uppercase;opacity:.75">Visa · Mastercard · Apple Pay · Google Pay · Shop Pay</div>
  <div class="links legal"><a href="/policies.html#shipping">Shipping</a> · <a href="/policies.html#returns">Returns &amp; refunds</a> · <a href="/policies.html#terms">Terms of sale</a> · <a href="/policies.html#privacy">Privacy</a> · <a href="/contact/">Contact &amp; business details</a> &middot; <a href="https://wa.me/971585449946" target="_blank" rel="noopener">WhatsApp us</a></div>
  <div>© ${new Date().getFullYear()} Sahra &amp; Beyond · ${LAUNCHED ? '<a href="/shop/" style="color:#9C521B;font-weight:600;text-decoration:none">Shop the tees</a>' : '<a href="/#join" style="color:#9C521B;font-weight:600;text-decoration:none">Join the waitlist</a>'}</div>`;
}

// Which top-nav item should read as current, derived from the page slug.
// Previously every category page claimed 'tshirts' (so /polos/ highlighted T-Shirts)
// and the commerce pages passed nothing (so they fell back to Home).
function navKeyFor(slug) {
  const s = String(slug || '').replace(/\/index\.html$/, '').replace(/^\/|\/$/g, '');
  if (s === 'polos') return 'polos';
  if (s === 't-shirts' || s.startsWith('t-shirts/') || /^(mountain|desert)-t-shirts$/.test(s)) return 'tshirts';
  if (s === 'places' || s.startsWith('locations/')) return 'places';
  if (s === 'about') return 'about';
  if (s === 'shop') return 'shop';
  return 'none';   // guides, gifts, fabric, size guide: nothing highlighted
}
function shell({ title, desc, canonical, jsonld, bodyHtml, image, activeNav = 'none', bodyClass = '',
                 lang = 'en', altHref = null, noindex = false }) {
  /* Arabic (21 Sep). One shell, two languages - a forked copy would drift within a
     week. `lang` flips the html attributes, the font request, the nav labels and an
     RTL layer; `altHref` is this page's counterpart in the other language and drives
     hreflang both ways; `noindex` holds /ar/ out of the index until Faheem has read
     the Arabic. Everything else is shared. */
  const AR = lang === 'ar';
  // SERPs truncate around 60 chars; the brand suffix is the first thing to go.
  if (title.length > 60 && / \| Sahra & Beyond$/.test(title)) title = title.replace(/ \| Sahra & Beyond$/, '');

  const ogImg = image || `${SITE}/icon-512.png`;
  const nav = (href, label, key) => `<a href="${href}"${activeNav === key ? ' class="active"' : ''}>${label}</a>`;
  /* Faheem, 13 Sep: Contact belongs in the menu. 'Home' comes out rather than the bar
     growing to eight items - the logo already links home, and three of eleven audit
     personas concluded the site had no contact details at all. */
  /* The Arabic nav lists only what EXISTS in Arabic. Pass 1 is the commercial
     core, so Places / T-Shirts / Polo are not linked from it - sending an Arabic
     reader to an English page from the main nav is worse than not offering it.
     They stay reachable through the language switcher and the footer. */
  const navHtml = AR
    ? nav('/ar/#collection', '\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629', 'collection')
      + ((LAUNCHED || REVEALED) ? nav('/ar/shop/', '\u0627\u0644\u0645\u062a\u062c\u0631', 'shop') : '')
      + nav('/ar/about/', '\u0645\u0646 \u0646\u062d\u0646', 'about')
      + nav('/ar/contact/', '\u062a\u0648\u0627\u0635\u0644 \u0645\u0639\u0646\u0627', 'contact')
    : nav('/#collection', 'Collection', 'collection') /* the homepage ring (8 Sep) */ + ((LAUNCHED || REVEALED) ? nav('/shop/', 'Shop', 'shop') : '') + nav('/places/', 'Places', 'places') + nav('/t-shirts/', 'T-Shirts', 'tshirts') + nav('/polos/', 'Polo', 'polos') + nav('/about/', 'About', 'about') + nav('/contact/', 'Contact', 'contact');
  return `<!doctype html>
<html lang="${lang}"${AR ? ' dir="rtl"' : ''} data-market="uae">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script>/* Repeat visits: set the market before first paint so the shipping
copy never flashes UAE-then-swaps. First visits paint the UAE default (which
is also what crawlers index) and sahra-market.js corrects after /api/geo. */
try{var g=sessionStorage.getItem('sb_geo');if(g&&/^[A-Z]{2}$/.test(g)){document.documentElement.setAttribute('data-market',g==='AE'?'uae':(['SA','QA','OM','BH','KW'].indexOf(g)>-1?'gcc':'intl'));}}catch(e){}</script>
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
${robotsMeta(noindex)}\n${altHref && !noindex ? `<link rel="alternate" hreflang="${AR ? 'en' : 'ar'}" href="${esc(altHref)}">\n` + `<link rel="alternate" hreflang="${lang}" href="${esc(canonical)}">\n` + `<link rel="alternate" hreflang="x-default" href="${esc(AR ? altHref : canonical)}">` : ''}
<meta name="theme-color" content="#C0702E">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImg)}">${/\/uploads\/og\//.test(ogImg) ? '\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">' : ''}\n<meta property="og:locale" content="${AR ? 'ar_AE' : 'en_AE'}">
<meta property="og:site_name" content="Sahra & Beyond">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(ogImg)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Jost:wght@300;400;500;600&family=Space+Mono:wght@400;700${AR ? '&family=Amiri:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600' : ''}&display=swap" rel="stylesheet">
<link rel="manifest" href="/manifest.json">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-5NVFDWT29F"></script>
<script>
  window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
  gtag('js',new Date());gtag('config','G-5NVFDWT29F');
  var _app=(document.referrer||'').indexOf('android-app://')===0||/[?&]platform=android/i.test(location.search);
  gtag('set','user_properties',{platform:_app?'app':'web'});
</script>
<!-- Meta Pixel + Conversions API -->
<script src="/assets/meta-pixel.js" defer></script>
<noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=1392180882887027&ev=PageView&noscript=1"></noscript>
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>${CSS}${PLACES.TABLE_CSS}${FG.FOOT_GUIDES_CSS}${IG.CSS}${GBAR_CSS}${FITPAIR_CSS}${bodyClass === "lg-page" ? PLACES.PLACE_CSS : ""}
/* ---- Mobile polish --------------------------------------------------------
   Measured at 390px on the live site: footer links were 15-21px tall, filter
   chips 38px, the waitlist input 20px, gallery arrows 38px. Apple/Google both
   ask for ~44px. Everything below is scoped to phones only. */
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
img,svg,video{max-width:100%;height:auto}
/* NOT canvas: a WebGL canvas's intrinsic size is its DPR-scaled drawing
   buffer (setPixelRatio x3 on phones), and Three.js setSize(w,h,false)
   deliberately leaves styling to CSS. Clamping it with max-width/height:auto
   rendered the hero ~60% wide on high-DPR phones. Full-bleed canvases are
   sized explicitly instead. */
#hero-canvas,.hero canvas,.shophero canvas,canvas.fill{width:100%!important;height:100%!important;max-width:none}
@media(max-width:820px){
  html,body{overflow-x:hidden}
  /* clip, not hidden: hidden turns body into a scroll container, which silently disables every position:sticky below it (the guide tab bar never stuck on phones; 30 Sep 2026) */
  @supports(overflow:clip){html,body{overflow-x:clip}}
  /* comfortable, thumb-sized targets */
  .foot-links a,.links a,.foot-soc a,.soc a,.crumbs a,.back a,.catnav a,
  .eyebrow.plink,.pm-gps,.read-place,.fitswap,.size-guide-link,.tag-invite a{
    display:inline-flex;align-items:center;min-height:44px;padding-top:2px;padding-bottom:2px}
  .foot-links a,.links a{width:100%}
  button.filt,.filt,.nav-arrow,.pcard-zoom,.pcard-t,.pcard-cta,.filt-clear,.filt-linkish,.chip,.btn,button.cta,.cta,
  .pdp-link,.lb-close,.drawer-close,.mnav,.logo,.skip-link{
    min-height:44px}
  /* dismiss controls need to be easy to hit, not just tall */
  /* Close buttons hold text, so inline-flex centres them correctly. The
     hamburger holds three <span> bars — inline-flex laid them out in a ROW and
     rendered the icon as one wide line across the wordmark. It stays a block. */
  .lb-close,.drawer-close{min-width:44px;display:inline-flex;align-items:center;justify-content:center}
  .mnav{display:block;min-width:44px;min-height:44px;padding:11px;margin:-11px -11px -11px 0}
  .nav-arrow{min-width:44px;min-height:44px}
  /* 16px minimum stops iOS zooming the page when a field is focused */
  /* 16px on FIELDS ONLY - buttons don't trigger iOS zoom and blowing up
     their label wraps the filter chips */
  input,select,textarea{font-size:max(16px,1em);min-height:48px;padding:12px 14px}
  .wl-form input{min-height:48px}
  /* respect the notch / home indicator */
  body{padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)}
  footer{padding-bottom:calc(24px + env(safe-area-inset-bottom))}
  /* stop long words and URLs forcing a sideways scroll */
  h1,h2,h3,p,li,a{overflow-wrap:break-word}
  /* iOS renders background-attachment:fixed badly; keep gradients in flow */
  body,.loc-hero,.hero{background-attachment:scroll!important}
  /* keep the drift alive on phones, just a gentler zoom so it reads as
     movement rather than a cut-off wash */
  .loc-hero{background-size:150% 150%}
}
@media(hover:none){*{-webkit-tap-highlight-color:rgba(233,185,120,.25)}}

${RV.CSS}
</style>
<link rel="stylesheet" href="/assets/sahra-sky.css">
<link rel="stylesheet" href="/assets/sahra-cart.css">
${AR ? `<style data-rtl>
/* ---------------------------------------------------------------- Arabic
   Paired to the Latin system rather than bolted on. Cormorant Garamond is a
   high-contrast classical serif; Amiri is its closest Arabic relative - a
   Naskh cut from the Bulaq types, with the same formality. Jost carries the
   UI in Latin; IBM Plex Sans Arabic is the neutral, wide-weight companion.
   Space Mono has NO Arabic coverage at all, so every eyebrow and label that
   used it falls back to Plex here.

   Four things break Arabic if they are inherited from the Latin styles, and
   all four are set across this site:
     1. letter-spacing - Arabic is a CONNECTED script. Any tracking pulls the
        joins apart and renders the word as loose disconnected glyphs. It must
        be zero, everywhere, with no exceptions.
     2. font-size-adjust - the .44 value exists to make Cormorant match
        Playfair's cap height. Applied to an Arabic face it rescales against a
        Latin x-height that Arabic does not have, and the type comes out wrong.
     3. text-transform:uppercase - Arabic has no letter case. Harmless in
        theory, but it also suppresses nothing, so it is cleared for honesty.
     4. font-style:italic - there is no italic in Arabic typography; a browser
        will synthesise a slant, which reads as a rendering fault.
   ---------------------------------------------------------------------- */
[dir="rtl"]{
  --serif:'Amiri', 'Cormorant Garamond', Georgia, serif;
  --sans:'IBM Plex Sans Arabic', Jost, system-ui, sans-serif;
  --mono:'IBM Plex Sans Arabic', Jost, system-ui, sans-serif;
}
[dir="rtl"] body,[dir="rtl"] p,[dir="rtl"] li,[dir="rtl"] a,[dir="rtl"] span,
[dir="rtl"] div,[dir="rtl"] button,[dir="rtl"] input,[dir="rtl"] label,
[dir="rtl"] td,[dir="rtl"] th{
  font-family:var(--sans);
}
[dir="rtl"] h1,[dir="rtl"] h2,[dir="rtl"] h3,[dir="rtl"] h4,
[dir="rtl"] .wordmark,[dir="rtl"] .logo{
  font-family:var(--serif);
}
/* the four inheritance traps, cleared site-wide */
/* html[dir=rtl], not [dir=rtl]: specificity (0,1,1) not (0,1,0). The legibility
   layer is injected AFTER this block and pins .eyebrow/.card-place/.sb-price and
   ~30 other classes to letter-spacing:.09em!important at (0,1,0). Equal
   specificity + equal !important = source order wins, and it is later - so the
   reset LOST. Measured: an .eyebrow holding Arabic computed to 1.17px tracking,
   which pulls a connected script into loose disconnected glyphs. The three
   current /ar/ pages dodge it only because they use .ar-* classes; it would have
   bitten the moment Arabic reached the shop and product templates.
   ::before/::after are included because bare * does not match generated content. */
html[dir="rtl"] *,
html[dir="rtl"] *::before,
html[dir="rtl"] *::after{
  letter-spacing:0!important;
  font-size-adjust:none!important;
  text-transform:none!important;
  font-style:normal!important;
  font-variant-ligatures:normal;
}
/* The reset above is scoped by ANCESTOR, so it also flattened the Latin wordmark
   that sits inside the RTL page - .brand-sahra lost its designed 3px tracking and
   computed to normal. Isolation fixes bidi ORDER, not tracking. Put it back. */
html[dir="rtl"] .brand-sahra{letter-spacing:3px!important}
html[dir="rtl"] .brand-beyond{letter-spacing:2.5px!important}
/* Latin-tuned underline offset collides with Arabic sub-baseline strokes and the
   tanween in this copy (غرامًا). Relative, so it scales with the type. */
[dir="rtl"] a{text-underline-offset:.15em}
/* Arabic sits smaller than Latin at the same point size and needs more leading;
   these are ratios, so every responsive size rule upstream still governs. */
[dir="rtl"] body{font-size:1.06em;line-height:1.85}
[dir="rtl"] h1,[dir="rtl"] h2,[dir="rtl"] h3{line-height:1.45}
/* mirror the things that were pinned to a physical side */
[dir="rtl"] .crumbs,[dir="rtl"] .back,[dir="rtl"] .eyebrow,
[dir="rtl"] .prod-txt,[dir="rtl"] .foot-links,[dir="rtl"] .links{text-align:right}
[dir="rtl"] .hdr-nav,[dir="rtl"] .nav-links{flex-direction:row-reverse}
/* Latin fragments inside Arabic - prices, GSM, the wordmark, codes - must run
   LTR inside the RTL flow or the digits and units reorder on screen. */
/* Latin-only brand furniture must be ISOLATED from the RTL flow. Without this
   the bidi algorithm reorders "SAHRA & BEYOND" to "Sahra / Beyond &" and the
   copyright line to "2026 \u00a9" \u2014 the ampersand and the symbol are neutral
   characters, so they take the paragraph direction unless told otherwise.
   isolate, not embed: these are self-contained runs, not quotes inside Arabic. */
[dir="rtl"] .brand,[dir="rtl"] .brand-text,[dir="rtl"] .brand-sahra,
[dir="rtl"] .brand-beyond,[dir="rtl"] .logo,[dir="rtl"] .wordmark,
[dir="rtl"] .ftr-tagline,[dir="rtl"] .ftr small,[dir="rtl"] .ftr-legal{
  direction:ltr;unicode-bidi:isolate;
}
/* the footer is still English in pass 1; keep it reading left-to-right as a
   block rather than half-mirrored, which is harder to read than either. */
[dir="rtl"] .ftr{direction:ltr;text-align:center}
/* ---- Arabic core page layout ---- */
.ar-main{max-width:820px;margin:0 auto;padding:118px 22px 70px;text-align:right}
.ar-hero{padding:18px 0 34px;border-bottom:1px solid rgba(242,201,140,.28)}
/* 24 Sep: the Arabic home opened on text alone; the English home leads with the lake photograph */
.ar-hero-img{margin:0 0 22px;border-radius:14px;overflow:hidden;aspect-ratio:16/10;background:#241C3A}
.ar-hero-img img{width:100%;height:100%;object-fit:cover;object-position:50% 38%;display:block}
@media(max-width:700px){.ar-hero-img{aspect-ratio:4/3}}
.ar-eyebrow{font-family:var(--sans);font-size:12.5px;color:#C0702E;margin:0 0 14px}
.ar-main h1{font-size:clamp(34px,6.4vw,54px);line-height:1.35;margin:0 0 18px;color:#2A2016}
.ar-main h2{font-size:clamp(25px,4vw,34px);margin:0 0 14px;color:#2A2016}
.ar-main h3{font-size:20px;margin:0 0 6px;color:#2A2016}
.ar-lede{font-size:17px;color:#4A3E31;margin:0 0 22px;max-width:60ch}
.ar-main p{color:#4A3E31}
.ar-cta{margin:26px 0 16px}
.ar-btn{display:inline-block;background:#33271B;color:#FFF6E8;text-decoration:none;
  padding:15px 30px;border-radius:10px;font-size:16px;min-height:52px;line-height:22px}
.ar-btn:hover{background:#7E4114}
.ar-fine{font-size:13.5px;color:#6B5B48;margin:10px 0 0}
.ar-sec{padding:38px 0;border-bottom:1px solid rgba(42,32,22,.10)}
.ar-sec:last-child{border-bottom:0}
.ar-places{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;margin-top:22px}
.ar-place{border:1px solid rgba(42,32,22,.16);border-radius:12px;padding:20px}
.ar-emirate{font-size:13px;color:#7E4114;margin:0 0 8px}
.ar-edition{background:rgba(242,201,140,.10);border-radius:14px;padding:30px 24px;border-bottom:0}
@media(max-width:700px){.ar-main{padding:84px 18px 56px}.ar-hero{padding-top:6px}}
/* ---- Arabic product pages + shop (23 Sep 2026) ---- */
.ar-main.arp{max-width:1120px;padding-top:92px}
.arp-top>*{min-width:0}
.arp-price .sb-price{font-size:26px!important;font-weight:700!important;letter-spacing:.01em!important;color:#2A2016!important}
.arp-tile-p .sb-price{font-size:16px!important;font-weight:700!important;letter-spacing:.01em!important;color:#2A2016!important}
.arp-crumb{font-size:13.5px;color:#6B5B48;margin:0 0 16px}
.arp-crumb a{color:#7E4114}
.arp-top{display:grid;grid-template-columns:1.05fr .95fr;gap:40px;align-items:start}
.arp-main{position:relative;aspect-ratio:4/5;border-radius:14px;overflow:hidden;background:#EFE7D8}
.arp-main img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .35s}
.arp-main img.on{opacity:1}
.arp-thumbs{display:flex;gap:8px;margin-top:10px;overflow-x:auto;padding-bottom:4px}
.arp-thumbs button{flex:0 0 64px;height:80px;padding:0;border:1px solid rgba(42,32,22,.25);border-radius:8px;overflow:hidden;background:none;cursor:pointer;opacity:.75}
.arp-thumbs button.on{opacity:1;border-color:#7E4114}
.arp-thumbs img{width:100%;height:100%;object-fit:cover;display:block}
.arp-model{font-size:14px;color:#4A3E31;margin:8px 0 0}
.arp-buy{background:#FCF9F2;border:1px solid rgba(42,32,22,.1);border-radius:14px;padding:24px 24px 20px;box-shadow:0 14px 40px rgba(20,14,8,.08)}
.arp-buy h1{font-size:clamp(30px,4.4vw,44px);margin:0 0 8px}
.arp-fabric{font-size:14.5px;color:#4A3E31;margin:0 0 8px}
.arp-rating{display:inline-flex;gap:6px;align-items:center;color:#4A3E31;text-decoration:none;font-size:14.5px;margin:0 0 6px}
.arp-stars{color:#8F6212;letter-spacing:1px}
.arp-price{font-size:26px;font-weight:700;color:#2A2016;margin:6px 0 8px}
.arp-bundle{font-size:14.5px;color:#7E4114;margin:0 0 6px}
.arp-ship{font-size:14px;color:#4A3E31;margin:0 0 16px}
.arp-sizes-l{display:flex;justify-content:space-between;font-size:15px;margin:0 0 8px;color:#2A2016}
.arp-sizes-l a{color:#7E4114}
.arp-sizes{display:flex;gap:9px;flex-wrap:wrap;margin:0 0 12px}
.arp-size{min-width:60px;height:50px;padding:0 12px;border:1px solid rgba(42,32,22,.32);border-radius:10px;background:#fff;color:#2A2016;font-size:17px;cursor:pointer}
.arp-size.sel{background:#E9B978;border-color:#E9B978}
.arp-left{display:block;font-size:11px;font-weight:700;line-height:1.1;color:#7E4114;white-space:nowrap}
.arp-size.sel .arp-left{color:#2A2016}
.arp-stock{margin:0 0 10px;font-size:14px;font-weight:700;color:#7E4114}
.arp-size:disabled{text-decoration:line-through;color:#6B6256;border-style:dashed;background:transparent;cursor:not-allowed}
.arp-fit{font-size:15px;line-height:1.7;color:#2A2016;background:rgba(255,255,255,.6);border:1px solid rgba(42,32,22,.14);border-radius:10px;padding:10px 12px;margin:0 0 12px}
.arp-fit a{color:#7E4114}
.arp-add,.arp-now{display:block;width:100%;min-height:54px;border-radius:10px;font-size:17px;cursor:pointer;font-family:inherit}
.arp-add{background:#2A2016;color:#FFF6E8;border:0;margin:0 0 8px}
.arp-add:disabled{background:transparent;color:#5C5148;border:1px solid #8A7F73;cursor:default}
.arp-now{background:transparent;color:#2A2016;border:1px solid rgba(42,32,22,.5)}
.arp-msg{min-height:1.4em;font-size:14.5px;color:#2F6B3A;margin:8px 0 0}
.arp-reassure{font-size:14px;line-height:1.7;color:#4A3E31;margin:6px 0 10px}
.arp-reassure a{color:#7E4114}
.arp-trust{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13.5px;color:#4A3E31;margin:0}
.arp-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:16px}
.arp-card{border:1px solid rgba(42,32,22,.14);border-radius:12px;padding:16px}
.arp-card h3{font-size:18px}
.arp-spec,.arp-list{padding-inline-start:20px;line-height:1.9;color:#4A3E31}
.arp-colour{display:flex;align-items:center;gap:8px;color:#4A3E31}
.arp-sw{width:16px;height:16px;border-radius:4px;border:1px solid rgba(0,0,0,.25);display:inline-block}
.arp-faq{border-bottom:1px solid rgba(42,32,22,.12);padding:12px 0}
.arp-faq summary{cursor:pointer;font-size:17px;color:#2A2016}
.arp-en{margin:28px 0 0;font-size:15px}
.arp-en a{color:#7E4114}
.arp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:20px;margin-top:20px}
.arp-tile{display:flex;flex-direction:column;gap:6px;text-decoration:none;color:#2A2016;background:#fff;border:1px solid rgba(42,32,22,.12);border-radius:14px;overflow:hidden;padding-bottom:14px}
.arp-tile-img{aspect-ratio:4/5;background:#EFE7D8;display:block}
.arp-tile-img img{width:100%;height:100%;object-fit:cover;display:block}
.arp-tile-t{font-size:19px;padding:4px 14px 0}
.arp-tile-p{font-weight:700;padding:0 14px}
.arp-tile-b{font-size:13.5px;color:#7E4114;padding:0 14px}
@media(max-width:760px){.ar-main.arp{padding-top:80px}.arp-top{grid-template-columns:1fr;gap:16px}.arp-buy{padding:18px 16px}.arp-main{aspect-ratio:auto;height:min(40vh,360px)}.arp-grid{grid-template-columns:1fr 1fr;gap:12px}.arp-tile-t{font-size:16px}}
[dir="rtl"] .sb-price:not([dir="rtl"]),[dir="rtl"] .price,[dir="rtl"] .gsm,
[dir="rtl"] code,[dir="rtl"] .sbw-code b{
  direction:ltr;unicode-bidi:embed;display:inline-block;
}
</style>` : ''}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
<header class="hdr"><a class="brand" href="/"><img src="/logo/mark-dark.png" alt="Sahra &amp; Beyond" width="300" height="40"><span class="brand-text"><span class="brand-sahra">Sahra</span><span class="brand-beyond">&amp; Beyond</span></span></a><nav class="hdr-nav">${navHtml}</nav><button class="mnav" type="button" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button></header>
${bodyHtml}
<footer class="ftr">${footerHtml()}</footer>

<script>
/* Scroll-linked tint. The main pages blend section colours as you scroll; this is
   the lightweight equivalent for generated pages — one rAF-throttled listener that
   walks a warm palette from night to sand as the reader moves down the page. */
(function(){
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var STOPS=[[20,16,42],[58,41,90],[122,79,99],[192,112,46],[233,185,120]];
  var raf=0;
  function mix(a,b,t){return [0,1,2].map(function(i){return Math.round(a[i]+(b[i]-a[i])*t);});}
  function update(){
    raf=0;
    var h=document.documentElement.scrollHeight-window.innerHeight;
    var p=h>0?Math.min(1,Math.max(0,window.pageYOffset/h)):0;
    var x=p*(STOPS.length-1), i=Math.min(STOPS.length-2,Math.floor(x));
    var c=mix(STOPS[i],STOPS[i+1],x-i);
    document.documentElement.style.setProperty('--scroll-tint','rgba('+c[0]+','+c[1]+','+c[2]+',.16)');
  }
  function onScroll(){ if(!raf) raf=requestAnimationFrame(update); }
  addEventListener('scroll',onScroll,{passive:true});
  addEventListener('resize',onScroll,{passive:true});
  update();
})();
</script>

<script>
/* Mobile menu: builds its links from the desktop nav so the two can never drift. */
(function(){
  var btn=document.querySelector('.mnav'); if(!btn) return;
  var src=document.querySelector('.nav-links')||document.querySelector('.hdr-nav'); if(!src) return;
  var panel=document.createElement('nav');
  panel.className='m-panel'; panel.id='mobileNav';
  panel.setAttribute('aria-label','Menu');
  /* Explicit close control. The header is position:fixed/sticky with a z-index
     and a backdrop-filter, each of which creates a stacking context, so the
     hamburger's own z-index is trapped below the panel and its X was being
     painted over. This button lives inside the panel, so it always shows. */
  var mclose=document.createElement('button');
  mclose.type='button'; mclose.className='m-close';
  mclose.setAttribute('aria-label','Close menu'); mclose.innerHTML='&times;';
  panel.appendChild(mclose);
  [].slice.call(src.querySelectorAll('a')).forEach(function(a){
    if(a.classList.contains('nav-cart')) return;
    var c=a.cloneNode(true); c.removeAttribute('style'); panel.appendChild(c);
  });
  document.body.appendChild(panel);
  btn.setAttribute('aria-controls','mobileNav');
  function set(open){
    btn.setAttribute('aria-expanded',open?'true':'false');
    panel.classList.toggle('open',open);
    document.body.style.overflow=open?'hidden':'';
  }
  btn.addEventListener('click',function(){ set(btn.getAttribute('aria-expanded')!=='true'); });
  panel.addEventListener('click',function(e){ if(e.target.tagName==='A'||e.target.closest('.m-close')) set(false); });
  addEventListener('keydown',function(e){ if(e.key==='Escape') set(false); });
  addEventListener('resize',function(){ if(innerWidth>820) set(false); });
})();
</script>
<div id="pzoom" role="dialog" aria-modal="true" aria-label="Product image"><button type="button" aria-label="Close">&times;</button><img alt=""></div>
<script>(function(){var z=document.getElementById('pzoom');if(!z)return;var im=z.querySelector('img'),cl=z.querySelector('button');
  function close(){z.classList.remove('on');document.body.style.overflow='';}
  document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.pcard-zoom');
    if(b){e.preventDefault();im.src=b.dataset.zoom;im.alt=b.getAttribute('aria-label')||'';z.classList.add('on');document.body.style.overflow='hidden';}});
  cl.addEventListener('click',close); z.addEventListener('click',function(e){if(e.target===z)close();});
  addEventListener('keydown',function(e){if(e.key==='Escape')close();});})();</script>
<script>/* time-limited notes (e.g. this month's dark-sky window) hide themselves once their date passes, even before the next build */(function(){var t=new Date().toISOString().slice(0,10);[].forEach.call(document.querySelectorAll('[data-until]'),function(e){if(t>e.getAttribute('data-until'))e.hidden=true;});})();</script>
<!-- one cart and one sky for the whole site, so pages cannot drift apart -->
<script src="/assets/sahra-sky.js" defer></script>
<script src="/assets/sahra-cart.js" defer></script>
<script src="/assets/sahra-market.js" defer></script>
<script>${IG.JS}</script>
<script>${GBAR_JS}</script>
<script>${FITPAIR_JS}</script>
</body>
</html>`;
}

function igSection(posts) {
  if (!posts || !posts.length) return '';
  const urls = posts.map(p => (typeof p === 'string' ? p : (p && p.url) || '').split('?')[0]).filter(Boolean);
  if (!urls.length) return '';
  const items = urls.map(u => `<div class="ig-item"><blockquote class="instagram-media" data-instgrm-permalink="${u}" data-instgrm-version="14" style="margin:0;min-width:326px;width:326px;max-width:326px"><a href="${u}">View this post on Instagram</a></blockquote></div>`).join('');
  const hint = urls.length > 1 ? '<p class="ig-hint">Swipe to see more &rarr;</p>' : '';
  return `<section class="ig"><h2>On the &rsquo;gram</h2>${hint}<div class="ig-strip">${items}</div><script async src="https://www.instagram.com/embed.js"></script></section>`;
}
function locCard(l) {
  // cover photo thumbnail when one has been uploaded via the CMS; emoji fallback otherwise
  /* 160px thumbnail (uploads/thumbs/<id>.webp) — the hub loaded 2000px heroes into 62px squares (~4.8 MB, 28 Sep 2026) */
  const tsrc = l.cover ? (fs.existsSync(path.join(__dirname, 'uploads', 'thumbs', l.id + '.webp')) ? `/uploads/thumbs/${l.id}.webp` : l.cover) : '';
  const thumb = l.cover
    ? `<span class="card-thumb" style="background-image:url('${esc(tsrc)}')" role="img" aria-label="${esc(l.coverAlt || l.name)}"></span>`
    : `<span class="card-emoji">${l.emoji || '📍'}</span>`;
  const dv = `data-id="${l.id}" data-cat="${esc(l.category)}" data-em="${esc(l.emirate)}" data-v="${esc((l.access && l.access.vehicle) || '')}" data-diff="${esc(l.difficulty || '')}" data-m="${Array.isArray(l.months) ? l.months.join('') : ''}"`;
  return `<a class="card" ${dv} href="/locations/${l.id}/">${thumb}<span class="card-body"><strong>${esc(l.name)}</strong><em>${esc(l.emirate)} · ${esc(l.category)}</em><span>${esc(l.desc)}</span></span></a>`;
}

// ---- per-location pages ----
/* 27 Sep 2026 rebuild (Faheem: accurate, useful guides; expandable sections; graphics;
   motion). Markup, graphics and the client script live in places-page.js; the facts
   live in content/locations/<id>.json, each with its sources. */
const PLACE_CTX = { locations, PRODUCT_BY_PLACE, PRODUCTS_ALL, DESIGNS, CAT_BG, CAT_HASH, WEATHER_KEY,
  teeBlock, miniTee, cardShots, withProductLink, newsletterBlock, locCard, faqsFor };
const renderLocationPage = l => {
  const canonical = `${SITE}/locations/${l.id}/`;
  const title = l.seoTitle || `${l.name}: ${l.category} in ${l.emirate}, UAE | Sahra & Beyond`;
  const desc = l.seoDesc || metaDesc(l.desc);
  const abs = p => (!p ? '' : (String(p).charAt(0) === '/' ? SITE + p : p));
  const galleryRaw = Array.isArray(l.gallery) ? l.gallery.map(g => (g && g.image) || g).filter(Boolean) : [];
  const photos = [l.cover].concat(galleryRaw).filter(Boolean);
  /* 1 Oct 2026 (handover item 25): a 1200x630, ~80-150 KB social image per place, cut from the cover */
  const ogImage = fs.existsSync(path.join(ROOT, 'uploads', 'og', l.id + '.jpg')) ? `${SITE}/uploads/og/${l.id}.jpg` : (photos.length ? abs(photos[0]) : (l.ogImage ? abs(l.ogImage) : ''));
  const tourist = {
    "@context": "https://schema.org", "@type": "TouristAttraction",
    "name": l.name, "description": l.desc, "url": canonical,
    "address": { "@type": "PostalAddress", "addressRegion": l.emirate, "addressCountry": "AE" },
    "geo": { "@type": "GeoCoordinates", "latitude": l.lat, "longitude": l.lng },
    "hasMap": `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}`
  };
  if (l.nameAr) tourist.alternateName = l.nameAr;
  if (/^Free\b/i.test(String(l.fees || ''))) tourist.isAccessibleForFree = true;
  if (photos.length) tourist.image = photos.map(abs);
  const faqs = faqsFor(l);
  const jsonld = [
    tourist,
    { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/" },
        { "@type": "ListItem", "position": 2, "name": "Places", "item": SITE + "/places/" },
        { "@type": "ListItem", "position": 3, "name": l.name, "item": canonical } ] },
    { "@context": "https://schema.org", "@type": "FAQPage",
      "mainEntity": faqs.map(q => ({ "@type": "Question", "name": q[0], "acceptedAnswer": { "@type": "Answer", "text": q[1] } })) }
  ];
  const packItems = PLACES.packFor(l, PACKING);
  const r = PLACES.renderPlace(l, PLACE_CTX);
  const body = r.hero + r.main + PLACES.clientScript(l, PLACE_CTX, packItems);
  const draft = !!l.draft;
  write(`${draft ? '_drafts/' : ''}locations/${l.id}/index.html`, shell({ activeNav: 'places', title, desc, canonical, jsonld, bodyHtml: body, image: ogImage, bodyClass: 'lg-page', noindex: draft }));
};
/* location pages are written after LANDINGS is defined, so each can link the guides that cover it */

// ---- keyword landing pages ----
const LANDINGS = [
  {
    slug: 'camping', h1: 'Best Camping Spots in the UAE',
    title: 'UAE Camping 2026–27: Rules, Permits & Spots | Sahra & Beyond',
    desc: 'UAE camping rules by emirate, permits, fines, free sites and drive times from Dubai, Sharjah and Abu Dhabi, checked 1 October 2026.',
    pick: locations.filter(l => l.category === 'Camping'),
    intro: "A field guide to camping in the UAE for the 2026–27 season: what each emirate asks of campers, where camping is free, how long the drive is from Dubai, Sharjah and Abu Dhabi, and the desert lakes, wadis and mountain sites that people actually use.\n\nEvery place below has GPS coordinates, a best season and a difficulty rating on its own page. Most wild sites have no toilets, bins or water, so come self-sufficient and take all rubbish home. Rules and prices change between seasons: the table notes give the source and date for each, so check the current position before you go.",
    sections: [
      { id: "season-2026-27", h2: "When does the 2026–27 camping season start?",
        body: "No announcement of the 2026–27 winter camping season dates was found as of 1 October 2026. For reference, Dubai Municipality's seasonal winter camping opened on 21 October in 2024 and ran to 30 April 2025 (Dubai Municipality, 17 October 2024), and permit applications for 2025–26 opened on 21 October 2025 at 10am, for a season running from 1 November to the end of April (Khaleej Times, 21 October 2025). Check dm.gov.ae or the DubaiNow app for this year's dates before you plan around one.\n\nThose dates apply to the seasonal camps at Al Aweer in Dubai, which are booked for three to six months. Casual overnight camping in the desert is a separate question, covered in the table below. Umm Al Quwain runs its own winter permits: for 2025–26, applications were reported open from 11 November to 30 April (Gulf News, 24 October 2025)." },
      { id: "camping-rules-by-emirate", h2: "Camping rules by emirate",
        body: "Rules differ by emirate and, within an emirate, by site. Where sources disagree or no official page was found, the table says so rather than guessing. Federal law applies everywhere: dumping, burning or burying rubbish outside designated areas carries fines of up to AED 30,000 for individuals under Federal Law No. 12 of 2018, and driving into a valley during rain carries AED 2,000, 23 traffic points and 60 days' vehicle impoundment (Gulf News, 19 October 2025; What's On, 20 October 2025).",
        table: {
          caption: "Camping rules by emirate (checked 1 October 2026; source dates in the last column)",
          head: ["Emirate", "Permit needed?", "Fires / BBQ", "Fines", "Where (official sites)", "Source & date"],
          rows: [
            ["Abu Dhabi",
              "Not confirmed as a rule. Visit Abu Dhabi says camping is allowed but not on private land or at the base of dunes. No permit is mentioned for Al Wathba Lake Camp; check current terms.",
              "Al Wathba Lake Camp has dedicated barbecue areas; barbecues in public parks are limited to designated areas (AED 500 otherwise). No heated equipment inside tents. Open-fire rules elsewhere: Not confirmed.",
              "Not confirmed (federal waste fines apply).",
              "Al Wathba Lake Camp (run by Abu Dhabi's Department of Municipalities and Transport); visitabudhabi.ae",
              { t: "Visit Abu Dhabi (undated); Gulf News, 21 Nov 2023 and 27 Dec 2024", href: "https://visitabudhabi.ae/en/plan-your-trip/article-hub/10-of-the-best-places-to-camp-in-abu-dhabi" }],
            ["Dubai",
              "No prior permission for a one- or two-day desert camp; longer stays need approval and fees. Seasonal winter camps at Al Aweer need a permit (3 to 6 months). Jebel Ali Beach caravan camping needs a free no-objection certificate, up to 30 days.",
              "Barbecues only in designated park areas (AED 500 otherwise). Winter camps must carry fire extinguishers and ban fireworks. Camping, bonfires and barbecues were banned at Al Qudra Lake (Al Marmoom reserve) in 2018. Hatta campsites have BBQ pits.",
              "AED 500 for leaving waste or lighting fires in public areas.",
              "wintercamp.dm.gov.ae and the DubaiNow app (apply); dm.gov.ae",
              { t: "Khaleej Times, 21 Oct 2025; Dubai Municipality, 17 Oct 2024; Gulf News, 27 Dec 2024 and 1 Nov 2018", href: "https://www.khaleejtimes.com/uae/dubai-winter-camping-applications-open" }],
            ["Sharjah",
              "Reported inconsistently: a law-firm summary says permits are required in designated desert areas; a Sharjah guide says typical weekend camping usually needs none. No official page found.",
              "Fires only in designated fire pits or portable barbecue grills; open fires on sand are generally forbidden (FEW guide, enforcement by the Environment and Protected Areas Authority).",
              "AED 2,000 for unauthorised camping or littering, given as a starting figure by one source and as a maximum by another.",
              "Mleiha National Park (mleihanationalpark.com) for bookable camping; Sharjah EPAA and SPSA named as enforcers",
              { t: "FEW, 16 Jun 2025; Al Kabban & Associates, 23 Nov 2025; Gulf News, 19 Oct 2025", href: "https://www.few.ae/where-can-i-camp-legally-in-designated-sharjah-areas/" }],
            ["Ras Al Khaimah",
              "Camping on public beaches is banned outside allocated sites: the municipality said no permit allows it on open beaches. Elsewhere (mountains, wadis): Not confirmed.",
              "Barbecuing is not allowed in open areas at Jebel Jais, where designated picnic spots exist (operator FAQ). Elsewhere: Not confirmed.",
              "Not confirmed. A third-party guide (Feb 2026) says open fires in restricted areas start around AED 500.",
              "RAK Municipality helpline 800661; visitjebeljais.com for the mountain",
              { t: "Khaleej Times, 18 May 2022; Visit Jebel Jais FAQs; PropertyFinder, 20 Feb 2026", href: "https://www.khaleejtimes.com/uae/uae-camping-banned-on-public-beaches-in-ras-al-khaimah" }],
            ["Fujairah",
              "Reported inconsistently: one guide says no permit is typically needed for casual beach camping; a law-firm summary says special permits are needed for mountain and beach camping. Not confirmed by an official page; ask Fujairah Municipality for longer stays.",
              "Open fires near dry vegetation are barred (law-firm summary). Faqiat Beach is described as having BBQ and bonfire zones (PropertyFinder).",
              "AED 2,000 for unauthorised tent pitching or waste (one source gives it as a maximum, another as a starting figure).",
              "Fujairah Municipality (no direct page found)",
              { t: "PropertyFinder, 30 Jul 2025; Al Kabban & Associates, 23 Nov 2025; Gulf News, 19 Oct 2025", href: "https://www.propertyfinder.ae/blog/beach-camping-fujairah/" }],
            ["Umm Al Quwain",
              "Winter camping permits for Aqran and Thunaiyah (2025–26): 3 to 6 months, private family use only, AED 2,000 fee plus a refundable AED 10,000 deposit. Casual camping rules: Not confirmed.",
              "Not confirmed.",
              "Breaching permit terms cancels the permit and forfeits the deposit. Other fines: Not confirmed.",
              "Umm Al Quwain Municipality (no portal stated)",
              { t: "Gulf News, 24 Oct 2025", href: "https://gulfnews.com/lifestyle/umm-al-quwain-opens-winter-camping-permit-applications-for-20252026-season-1.500320327" }]
          ],
          note: "Ajman is not listed because no source for its camping rules was found. Always follow signs on site; they override any guide."
        } },
      { id: "camping-near-me-drive-times", h2: "Camping near me: drive times",
        body: "Drive times below are the ones given on each place guide, which quote them from central Dubai rather than from Dubai Marina specifically; allow extra on Fridays and weekends and for any unpaved final stretch. \"Not confirmed\" means no source gives a time from that city.",
        table: {
          caption: "Camping spots by drive time (as stated on each place guide, checked 27 Sep to 1 Oct 2026)",
          head: ["Site", "Emirate", "From Dubai", "From Sharjah", "From Abu Dhabi"],
          rows: [
            [{ t: "Half Desert", href: "/locations/half-desert/" }, "Dubai", "About 30–45 min", "Not confirmed", "Not confirmed"],
            [{ t: "Love Lake", href: "/locations/love-lake/" }, "Dubai", "About 50 min–1 h", "Not confirmed", "Not confirmed"],
            [{ t: "Al Qudra Desert Lake", href: "/locations/desert-camping-lake-view/" }, "Dubai", "About 1 h", "Not confirmed", "Not confirmed"],
            [{ t: "Crescent Moon Lake", href: "/locations/crescent-moon-lake/" }, "Dubai", "About 1 h to 1 h 15, including the unpaved final stretch", "Not confirmed", "Not confirmed"],
            [{ t: "Big Red", href: "/locations/big-red/" }, "Sharjah", "About 45–60 min", "Not confirmed", "Not confirmed"],
            [{ t: "Mleiha", href: "/locations/mleiha-desert/" }, "Sharjah", "About 50 min–1 h 15", "About 45 min", "Not confirmed"],
            [{ t: "Wadi Shawka", href: "/locations/wadi-showka/" }, "Ras Al Khaimah", "About 1 h–1 h 15", "Not confirmed", "Not confirmed"],
            [{ t: "Hatta", href: "/locations/hatta/" }, "Dubai", "About 1 h 30 (roughly 105 km via the E44)", "Not confirmed", "Not confirmed"],
            [{ t: "Wadi Kub", href: "/locations/wadi-kub/" }, "Ras Al Khaimah / Fujairah", "About 1 h 45 (approximate)", "Not confirmed", "Not confirmed"],
            [{ t: "Jebel Jais", href: "/locations/jebel-jais/" }, "Ras Al Khaimah", "About 1 h 45–2 h (30–45 min from Ras Al Khaimah city)", "Not confirmed", "Not confirmed"],
            [{ t: "Jebel Hafeet", href: "/locations/jebel-hafeet/" }, "Abu Dhabi (Al Ain)", "About 1 h 45 (roughly 160 km via the E311)", "Not confirmed", "About 1 h 20–1 h 30 (roughly 120 km)"],
            [{ t: "Zakher Lake", href: "/locations/zakher-lake/" }, "Abu Dhabi (Al Ain)", "About 1 h 45–2 h", "Not confirmed", "About 1 h 30–1 h 45"],
            [{ t: "Al Quaa Desert", href: "/locations/al-quaa-desert/" }, "Abu Dhabi", "About 2 h 30", "Not confirmed", "About 1 h 30"],
            [{ t: "Liwa Oasis", href: "/locations/liwa/" }, "Abu Dhabi", "About 3 h 30–4 h (guides vary; see the Moreeb Dune guide)", "Not confirmed", "About 2 h 30–3 h (roughly 250 km to Moreeb Dune)"]
          ],
          note: "Times are as given on each Sahra & Beyond place guide, which cite the sources listed there. Sites with a 4x4 stretch are flagged on their own pages."
        } },
      { id: "free-camping-abu-dhabi", h2: "Free camping in Abu Dhabi",
        body: "Visit Abu Dhabi says camping is allowed in the emirate, but advises against setting up on private land or at the base of dunes, leaving food out overnight or using heated equipment inside the tent. Its list of ten places to camp gives no permit or fire rules and, for most entries, no price, so confirm the current terms before you go. Take all rubbish home: dumping or burning it outside designated areas is a federal offence.\n\nAl Wathba Lake Camp is the best documented public site. Abu Dhabi's Department of Municipalities and Transport opened it in February 2022 with 13 campsites and 24 picnic sites (Visit Abu Dhabi). Gulf News (21 November 2023) describes it as free and open 24 hours, with dedicated barbecue areas, and mentions no permit.\n\nAl Quaa Desert, in southern Abu Dhabi on the Al Ain road, is free with no facilities and no permit needed for a standard visit, according to our guide; it is one of the darkest accessible skies in the UAE, so pick a moonless night. Zakher Lake near Al Ain sees informal camping along the dunes and reed beds, with free parking and no official campsite; swimming is not permitted.\n\nLiwa Oasis sits at the edge of the Rub' al Khali and is on Visit Abu Dhabi's list with no price stated. Our Liwa guide says camping is usually arranged through an operator or, in festival season, the Liwa Sports Club; our Empty Quarter guide reports one Liwa operator saying no permit is needed for wild camping on public land, and not on private land. Visit Abu Dhabi also lists Mirfa Beach and Al Dhafra Beach, and says tents can be set up across the open shoreline at Al Dhafra Beach; neither has a price or permit statement, so read the signs on arrival.\n\nTwo places that come up in searches are not free Abu Dhabi sites. Jebel Hafeet Desert Park, near Al Ain, offers tents, domes and bubbles that Visit Abu Dhabi lists as paid options, from a basic bring-your-own-gear pitch upwards (see our Jebel Hafeet guide). Mleiha is in Sharjah, not Abu Dhabi, about 45 minutes from Sharjah city: Visit Sharjah mentions camping there but gives no price or permit rule, and our Mleiha guide says the park runs a bookable overnight camp rather than casual free camping across the protected desert." },
      { id: "camping-dubai", h2: "Camping in Dubai",
        body: "For a weekend tent in the desert, Gulf News (updated January 2022) reported that campers need no prior permission, while longer stays need approval and fees. Our guides cover the usual choices: Love Lake, where camping is allowed; Crescent Moon Lake; Al Qudra Desert Lake, where reports on camping and fires conflict (Dubai Municipality signboards reported by Gulf News in November 2018 banned camping, bonfires and barbecues at Al Qudra Lake), so read the signs on the day; and Hatta, where Khaleej Times lists designated campsites with barbecue pits but no single official page sets out permit rules.\n\nSeasonal winter camps are different. Dubai Municipality issues permits for plots at Al Aweer through its website (wintercamp.dm.gov.ae) or the DubaiNow app, with a minimum three-month booking and a maximum of six. For 2024–25 the fee was 44 fils per square metre per week for up to 400 square metres (Dubai Municipality, 17 October 2024); the 2025–26 fee was not stated in the Khaleej Times report. Permits are for personal or family use and cannot be used by hotels or companies (Khaleej Times, 21 October 2025); older reports differ on who may apply (Emirates 24|7: citizens only; Gulf News: residents and visitors). Jebel Ali Beach allows caravan camping with a free no-objection certificate for up to 30 days. Burning or burying waste outside designated areas is illegal, per Khaleej Times." },
      { id: "camping-ras-al-khaimah", h2: "Camping in Ras Al Khaimah",
        body: "Jebel Jais has bookable camps on the mountain, listed by Visit Ras Al Khaimah and named on our Jebel Jais guide. A local guide reported the mountain closed for seasonal maintenance on 14 September 2026 with no reopening date, so check visitjebeljais.com before going. PropertyFinder (20 February 2026) reports informal roadside camping at the lower viewpoints and three government-designated campsites, with entry needing a booking or the AED 10 Viewing Deck Park ticket; no official page confirms where camping is permitted, so treat that as reported. The operator's FAQ says barbecuing is not allowed in open areas. PropertyFinder also says camping in wadis is strongly discouraged because of flash floods.\n\nRas Al Khaimah Municipality banned camping on public beaches outside allocated sites in May 2022. Wadi Shawka is described by Visit Ras Al Khaimah as a popular free camping spot, with no permit mentioned; our Wadi Shawka guide gives the facilities. Our Wadi Kub guide covers wild camping near Masafi, and Jebel Yanas has flat ground on its ridge. Visit Ras Al Khaimah describes Al Rams Beach and Saraya Island as suited to pitching a tent and needing a 4x4, yet a visitor reports signage against camping, as our Al Rams Beach guide notes. Check the signs on arrival." },
      { id: "camping-east-coast-sharjah", h2: "Camping on the east coast: Fujairah and Sharjah",
        body: "Sources disagree on permits. A PropertyFinder guide (30 July 2025) says no permit is typically needed for casual beach camping in Fujairah and lists Faqiat Beach as allowing bonfires and barbecues; another PropertyFinder guide (January 2026) says Al Aqah beach camping has no formal fees and inconsistent toilets. A law-firm summary (23 November 2025) says Fujairah requires special permits for mountain and beach camping and bars open fires near dry vegetation. Contact Fujairah Municipality before a longer stay, and keep fires off dry ground.\n\nOn the Sharjah side, a guide dated 16 June 2025 names Mleiha, Al Badayer (Big Red) and the Khor Fakkan and Kalba areas as places to camp, and says fires are allowed only in fire pits or portable barbecues. The law-firm summary cites permits and fines from AED 2,000 for unauthorised camping. Sharjah's ruler announced about 800 campsites at Al Hefaiyah Lake, Kalba, in April 2024; it is not confirmed whether they are open.\n\nOur Dibba Rock and Snoopy Island guides cover snorkelling and access rather than camping. Al Rafisah Dam is a landscaped park, and Wadi Kub sits near Masafi on the RAK and Fujairah border. Never camp in a wadi bed if rain is forecast." },
      { id: "cold-desert-nights", h2: "What to wear on cold desert nights",
        body: "Winter nights in the desert and the mountains are far cooler than the days. Visit Abu Dhabi's camping checklist starts with warm clothes, a charged phone and power bank and a first-aid kit. Pack a warm layer you can put on after sunset, a hat and a dry pair of socks for the morning, and keep heaters and gas stoves out of the tent." }
    ],
    faqs: [
      ["Do I need a permit to camp in Dubai?", "Not for a one- or two-night desert camp: Dubai Municipality has said campers need no prior permission for short stays, while longer stays need approval and fees (Gulf News, updated January 2022). Seasonal winter camps at Al Aweer do need a permit, booked for three to six months through wintercamp.dm.gov.ae or the DubaiNow app. Check signs on the day, because some areas, such as Al Qudra Lake, have carried bans on camping and fires."],
      ["When does the 2026–27 camping season start in Dubai?", "No announcement of the 2026–27 dates was found as of 1 October 2026. The season opened on 21 October in 2024, and permit applications for 2025–26 opened on 21 October 2025. Check dm.gov.ae or the DubaiNow app for this year's dates."],
      ["Can you camp for free in Abu Dhabi?", "Yes, at some sites. Al Wathba Lake Camp is described by Gulf News (21 November 2023) as free and open 24 hours, and Al Quaa Desert is free with no facilities. Visit Abu Dhabi says camping is allowed but not on private land or at the base of dunes. Jebel Hafeet Desert Park and Mleiha (which is in Sharjah) are bookable and not free."],
      ["Can I light a fire or barbecue when camping in the UAE?", "It depends on the site. Barbecues are limited to designated areas in public parks in Abu Dhabi, Dubai and Sharjah, with a reported AED 500 fine otherwise (Gulf News, 27 December 2024). Sharjah guidance says fires only in pits or portable grills, and Jebel Jais does not allow barbecuing in open areas. Dumping or burning rubbish outside designated areas is a federal offence with fines up to AED 30,000."],
      ["Is camping allowed on beaches in Ras Al Khaimah?", "Not on public beaches outside allocated sites. Ras Al Khaimah Municipality said in May 2022 that no permit allows camping on open beaches (Khaleej Times, 18 May 2022). Some sites such as Al Rams Beach are described as suited to camping by the tourism board but carry signage against it, so check the signs on arrival."],
      ["Which camping spot is closest to Dubai?", "Half Desert is about 30 to 45 minutes from central Dubai, followed by Love Lake at about 50 minutes to an hour and Al Qudra Desert Lake at about an hour, per our place guides. See the drive-time table above for Sharjah and Abu Dhabi."]
    ],
    sources: [
      ["Dubai Municipality: Winter camp reservations open with all-new features (17 Oct 2024)", "https://www.dm.gov.ae/winter-camp-reservations-open-with-all-new-features/"],
      ["Khaleej Times: Dubai opens applications for temporary camps (21 Oct 2025)", "https://www.khaleejtimes.com/uae/dubai-winter-camping-applications-open"],
      ["Khaleej Times: Dubai announces start of winter camping season on October 21 (17 Oct 2024)", "https://www.khaleejtimes.com/travel/uae-attractions/dubai-announces-start-of-winter-camping-season-on-october-21"],
      ["Khaleej Times: Camping in Dubai this winter (26 Oct 2025)", "https://www.khaleejtimes.com/uae/dubai-winter-camping-best-spots-how-to-plan"],
      ["Khaleej Times: Camping banned on public beaches in Ras Al Khaimah (18 May 2022)", "https://www.khaleejtimes.com/uae/uae-camping-banned-on-public-beaches-in-ras-al-khaimah"],
      ["Gulf News: Winter camping in UAE, rules and fines every camper should know (19 Oct 2025)", "https://gulfnews.com/uae/people/winter-camping-in-uae-rules-and-fines-every-camper-should-know-1.500313287"],
      ["What's On: Winter camping in the UAE, rules and the Dhs30,000 fine (20 Oct 2025)", "https://whatson.ae/2025/10/winter-camping-in-the-uae-rules-to-know-and-the-dhs30000-fine-to-avoid/"],
      ["Gulf News: Umm Al Quwain opens winter camping permit applications for 2025–2026 (24 Oct 2025)", "https://gulfnews.com/lifestyle/umm-al-quwain-opens-winter-camping-permit-applications-for-20252026-season-1.500320327"],
      ["Gulf News: Fines for barbecuing in public parks (27 Dec 2024)", "https://gulfnews.com/living-in-uae/ask-us/uae-winter-camping-safety-tips-guidelines-and-fines-for-barbecuing-in-public-parks-1.500007839"],
      ["Gulf News: Ban on camping, bonfire, barbecue, dog walking in Al Qudra Lake (1 Nov 2018)", "https://gulfnews.com/uae/environment/ban-on-camping-bonfire-barbecue-dog-walking-in-al-qudra-lake-1.2139118"],
      ["Gulf News: Camping in the UAE, your ultimate guide (updated Jan 2022)", "https://gulfnews.com/going-out/camping-in-the-uae-your-ultimate-guide-1.1545728195812"],
      ["Visit Abu Dhabi: 10 best places to camp in Abu Dhabi", "https://visitabudhabi.ae/en/plan-your-trip/article-hub/10-of-the-best-places-to-camp-in-abu-dhabi"],
      ["Gulf News: Al Wathba Lake Camp, free camping spot (21 Nov 2023)", "https://gulfnews.com/living-in-uae/ask-us/winter-in-uae-al-wathba-lake-camp--free-camping-spot-in-abu-dhabi-1.1700578870128"],
      ["The National: Al Quaa, secluded Abu Dhabi spot for Milky Way views (2020)", "https://www.thenationalnews.com/travel/2020/12/18/al-quaa-secluded-abu-dhabi-spot-that-offers-out-of-this-world-views-of-the-milky-way/"],
      ["PropertyFinder: Stargazing in Abu Dhabi", "https://www.propertyfinder.ae/blog/stargazing-abu-dhabi/"],
      ["PropertyFinder: Desert camping places in Abu Dhabi", "https://www.propertyfinder.ae/blog/desert-camping-places-in-abu-dhabi/"],
      ["Emirates 24|7: Dubai Municipality recreation guide", "https://www.emirates247.com/uae/dubai-municipality-recreation-guide-how-to-book-beach-camping-chalets-fishing-permits-and-sports-fields/1516"],
      ["Gulf News: Winter camps, Dubai Municipality permit (2024-25 season)", "https://gulfnews.com/uae/winter-camps-dubai-municipality-reveals-who-can-apply-for-a-permit-and-how-1.104402786"],
      ["PropertyFinder: Camping on Jebel Jais (20 Feb 2026)", "https://www.propertyfinder.ae/blog/camping-jebel-jais/"],
      ["Visit Jebel Jais: FAQs", "https://visitjebeljais.com/faqs"],
      ["Visit Ras Al Khaimah: Jebel Jais", "https://visitrasalkhaimah.com/location/place/jebel-jais/"],
      ["WOW-RAK: Camping havens in Ras Al Khaimah", "https://wow-rak.com/camping-havens-in-ras-al-khaimah/"],
      ["PropertyFinder: Beach camping in Fujairah (30 Jul 2025)", "https://www.propertyfinder.ae/blog/beach-camping-fujairah/"],
      ["PropertyFinder: Al Aqah beach camping (Jan 2026)", "https://www.propertyfinder.ae/blog/al-aqah-beach-camping/"],
      ["FEW: Where can I camp legally in designated Sharjah areas (16 Jun 2025)", "https://www.few.ae/where-can-i-camp-legally-in-designated-sharjah-areas/"],
      ["Visit Sharjah: Mleiha National Park", "https://www.visitsharjah.com/activities/adventure/mleiha-national-park/"],
      ["Sharjah Update: Ruler announces 800 camping sites at Al Hefaiyah Lake (Apr 2024)", "https://www.sharjahupdate.com/2024/04/sharjah-ruler-announces-800-camping-sites-at-al-hefaiyah-lake/"],
      ["Al Kabban & Associates: UAE camping rules by emirate (23 Nov 2025)", "https://alkabban.com/news/uae-camping-season-2025-rules-permits-fines-guide/"]
    ],
    todo: [
      "TODO for Faheem: confirm the 2026–27 Dubai winter camping season start date once Dubai Municipality announces it (none found on 1 Oct 2026; 2024 start 21 Oct, 2025 applications 21 Oct); then replace the season section with the dated announcement.",
      "TODO for Faheem: list paid camps/glamping operators? Nothing paid or bookable is named in the Abu Dhabi section; the RAK section refers to Jebel Jais camps without names.",
      "TODO for Faheem: drive times are from central Dubai as on the place guides; Dubai Marina, Sharjah and Abu Dhabi times for most sites are Not confirmed. Provide a verified source or time them yourself.",
      "TODO for Faheem: Love Lake page says camping is allowed; Dubai Municipality signboards (Gulf News, 1 Nov 2018) banned camping, bonfires and barbecues at Al Qudra Lake / Al Marmoom reserve. Unresolved; confirm on site or with Dubai Municipality.",
      "TODO for Faheem: the Hatta page says no official campsites or permit rules; Khaleej Times (26 Oct 2025) lists Hatta designated campsites with BBQ pits. Reconcile.",
      "TODO for Faheem: no official page found for Sharjah, Fujairah, RAK or Abu Dhabi camping permits and fine schedules; the table relies on press and law-firm summaries. Ajman has no sourced rules. Ask the municipalities if you want official wording.",
      "TODO for Faheem: Al Wathba Lake Camp picnic sites: Visit Abu Dhabi says 24, Gulf News (21 Nov 2023) says 25; text uses 24.",
      "TODO for lead: add the Shuweihat Hoodie and Ras Al Khor Hoodie links to the 'What to wear on cold desert nights' section when they are live (no product link added).",
      "TODO for Faheem: Zawya reports a Dh500 bonfire fine at Jebel Jais and Dh2,000 elsewhere (2022, undated); not used in the table because the date and authority are unclear.",
      "TODO for Faheem: the title now says 2026–27, so it needs updating each season."
    ]
  },
  {
    slug: 'secluded-camping', h1: 'Secluded Camping Spots in the UAE',
    title: 'Secluded Camping Spots in the UAE — Quiet, Hidden Places | Sahra & Beyond',
    desc: 'The most secluded camping spots in the UAE — quiet desert lakes and hidden corners away from the crowds, with GPS and access tips.',
    pick: locations.filter(l => l.category === 'Camping').sort((a, b) => (/(secret|hidden|secluded|quiet|dark)/i.test(b.body || '') ? 1 : 0) - (/(secret|hidden|secluded|quiet|dark)/i.test(a.body || '') ? 1 : 0)),
    intro: "If the popular Al Qudra sites feel too busy, these secluded camping spots in the UAE trade facilities for peace and privacy. They're the quiet desert lakes and hidden corners where you can pitch a tent, watch the sunset over the water and have the stars almost entirely to yourself.\n\nSeclusion comes with responsibility: there are no toilets, bins or shops out here, so plan carefully, carry plenty of water, travel in convoy where the sand gets soft, and leave no trace so these places stay special."
  },
  {
    slug: 'snorkeling', related: [["/fujairah-beaches/", "Fujairah beaches", "Where to swim and snorkel on the east coast"], ["/best-beaches/", "Best beaches in the UAE", "Quiet and natural beaches"]], h1: 'Best Snorkeling in the UAE',
    title: 'Best Snorkeling in the UAE — Top Reefs & Marine Life | Sahra & Beyond',
    desc: 'The best snorkeling in the UAE — coral reefs, turtles and reef sharks you can reach from shore, with seasons and tips for UAE residents.',
    pick: locations.filter(l => l.category === 'Coast'),
    intro: "The UAE's east coast hides some genuinely world-class snorkeling, and the best of it is reachable straight from the beach. Clear Gulf of Oman water, healthy coral and regular sightings of turtles and reef sharks make it a brilliant day out for families and beginners alike.\n\nBelow are our favourite spots for the best snorkeling in the UAE, with the right season, difficulty and access notes. Go early on weekdays for calm, clear water, bring your own mask and fins, and always wear reef-safe sunscreen to protect the coral."
  },
  {
    slug: 'stargazing', h1: 'Best Places to See the Milky Way Galaxy in the UAE',
    productLink: { slug: 'al-quaa-galaxy-regular', anchor: 'the Al Quaa Galaxy tee',
      sentence: 'That view is the one printed on {{link}} — the core as it rises over Al Quaa, mapped rather than illustrated.' },
    title: 'Milky Way in the UAE: 8 Spots & 2026–27 Dates | Sahra & Beyond',
    desc: 'Where and when to see the Milky Way in the UAE: 8 dark spots near the cities, new-moon dates to Sep 2027, the Geminids, and tours versus going alone.',
    pick: ['al-quaa-desert', 'mleiha-desert', 'desert-camping-lake-view', 'crescent-moon-lake', 'wadi-showka', 'liwa'].map(id => locations.find(l => l.id === id)).filter(Boolean),
    intro: "The Milky Way is overhead every night of the year in the UAE; what changes is whether its bright core is above the horizon after dark. That is only roughly May to October, and only on nights when the moon is out of the way. Everything else, from the spot you choose to the date you go, follows from those two facts.\n\nThis guide lists eight dark places within reach of the cities, a moon calendar to September 2027, the next meteor showers, and what a tour costs against going on your own. Go on a moonless night, bring a red-light torch, and give your eyes twenty minutes to adjust before judging the sky.",
    sections: [
      { id: 'this-month', until: '2026-10-15', h2: 'Last Milky Way window of 2026: 6–14 October',
        body: "The new moon falls on Saturday 10 October 2026 at 19:50 UAE time. The nights from about 6 to 14 October are the darkest of the month, and they are the last of the year with the Milky Way core in the evening sky.\n\nIn October the core is only up for a short spell after dusk. Khaleej Times' month-by-month table has it appearing at about 6pm and gone by about 10pm. The galaxy forms an arc from the north-east to the south-west, and its densest part lies towards the constellations Scorpius and Sagittarius. Arrive before dark, find a clear horizon and look for it as soon as the sky has faded.\n\nThe core season runs from May to October, with the clearest views in July and August (Gulf News and Khaleej Times, both quoting the Emirates Astronomical Society chairman). After October the core stays below the horizon at night until spring. The next new moon, on 9 November, is a good night for constellations and camping, but there is no core to see.",
        table: { caption: "New moon, October 2026",
          head: ["New moon (UAE time)", "Darkest nights", "Milky Way core"],
          rows: [["Sat 10 Oct 2026, 19:50", "About 6 to 14 Oct", "In the evening sky, about 6pm to 10pm"]],
          note: "New-moon time is computed, then checked against the Skylive moon calendar (16:50 in its London-time view, which is 19:50 in the UAE) and MoonGiant, which shows a new moon on 10 October. Core hours are from a Khaleej Times table published 7 May 2025 and are approximate. Checked 1 Oct 2026.",
          source: { label: "Khaleej Times: Milky Way visible from May to October", url: "https://www.khaleejtimes.com/space/uae-milky-way-visible-from-may-to-october-2025" } } },
  
      { id: 'where-to-go', h2: 'Where to go: 8 dark spots near the cities',
        body: "Distance from city light matters more than anything else you can choose. Gulf News, quoting the Emirates Astronomical Society chairman, advises getting at least 35 km from urban areas. None of these places has a published sky-brightness rating on this site: to check a site yourself, look it up on the light pollution map at https://www.lightpollutionmap.info before you drive.\n\nAl Quaa is one of the darkest accessible skies in the UAE and is the best-known choice for the core. The others trade some darkness for a shorter drive or for facilities.",
        table: { caption: "Eight places to see the Milky Way, from Dubai",
          head: ["Spot", "Emirate", "Drive from Dubai", "4x4?", "Facilities", "Caveat"],
          rows: [
            [{ t: "Al Quaa", href: "/locations/al-quaa-desert/" }, "Abu Dhabi", "About 2.5 hours (about 90 minutes from Abu Dhabi city)", "A regular car reaches the usual pull-off on packed sand; a 4x4 is for the dunes", "None at the site: no toilets, shops, water or fuel", "One of the darkest accessible skies in the UAE. Fill the tank and bring everything"],
            [{ t: "Wadi Shawka dam", href: "/locations/wadi-showka/" }, "Ras Al Khaimah", "About 1 hour to 1 hour 15", "No for the dam; a 4x4 helps on the trails beyond", "Washrooms, barbecue area, shaded seating, small shops", "The National says the dam is lit by flight paths"],
            [{ t: "Jebel Jais area", href: "/locations/jebel-jais/" }, "Ras Al Khaimah", "About 1 hour 45 to 2 hours", "No: the road is paved", "Two cafés at the viewing deck park; no fuel on the mountain road", "A seasonal closure was reported on 14 September 2026; check the operator before you drive up"],
            [{ t: "Liwa and Tal Moreeb", href: "/locations/moreeb-dune/" }, "Abu Dhabi", "About 3.5 to 4 hours", "Paved to the base of Moreeb; a 4x4 only on the sand", "Limited: resorts and a few stops in Liwa; pack food and water", "Remote. Busy during the Liwa International Festival, 11 December 2026 to 2 January 2027"],
            [{ t: "Al Qudra and Al Marmoom", href: "/locations/desert-camping-lake-view/" }, "Dubai", "About 1 hour", "Paved to Love Lake; the quieter lake spots need a high-clearance vehicle", "Toilets and parking at Love Lake and Expo Lake; none at the quieter spots", "Dubai Astronomy Group held a public event here on 2 May 2026"],
            ["Lahbab red dunes", "Dubai", "Not confirmed", "Not confirmed", "Not confirmed", "Listed by Dubai Desert as a stop for stargazing after a dune tour"],
            [{ t: "Mleiha", href: "/locations/mleiha-desert/" }, "Sharjah", "About 50 minutes to 1 hour 15", "An ordinary car reaches the Archaeological Centre; a 4x4 is needed on the dunes", "Toilets and café at the Archaeological Centre", "Evening stargazing sessions are bookable through the park"],
            [{ t: "Jebel Hafeet", href: "/locations/jebel-hafeet/" }, "Abu Dhabi (Al Ain)", "About 1 hour 45", "No: the summit road is paved", "Hotel restaurant at the summit; shaded lawns and chalets at Green Mubazzarah", "Listed in a PropertyFinder guide to stargazing in Abu Dhabi, with no darkness measurement given"]
          ],
          note: "Drive times and facilities are from the linked place guides; the sky-brightness line is yours to check on the map. Checked 1 Oct 2026.",
          source: { label: "Gulf News: Milky Way season in the UAE", url: "https://gulfnews.com/uae/science/stargazers-in-the-uae-can-catch-the-milky-way-all-summer-long-1.500119274" } } },
  
      { id: 'when', h2: 'When the core is up, month by month',
        body: "Core season is May to October. In May the core only appears after midnight; by October it is a short appearance in the early evening. Khaleej Times, quoting Dubai Astronomy Group, gives a wider season of late March to September, with the best hours from 9pm to 3am, so treat the edges of the season as approximate. In midwinter the core is below the horizon at night: a December trip gives a very dark sky and good constellations, but no core.",
        table: { caption: "When the Milky Way core is visible, by month",
          head: ["Month", "Core first appears", "Core gone by"],
          rows: [["May", "12am", "4am"], ["June", "11pm", "3:30am"], ["July", "10pm", "3am"], ["August", "8:30pm", "2am"], ["September", "7pm", "12:30am"], ["October", "6pm", "10pm"]],
          note: "Times are approximate and from a Khaleej Times table (7 May 2025). The core is clearest in July and August.",
          source: { label: "Khaleej Times: Milky Way visible from May to October", url: "https://www.khaleejtimes.com/space/uae-milky-way-visible-from-may-to-october-2025" } } },
  
      { id: 'moon-calendar', h2: 'Moon calendar 2026–27',
        body: "Pick a date within a few days of the new moon. A bright moon washes out the fainter parts of the Milky Way almost as much as city light, so the dark window matters as much as the month.",
        table: { caption: "New moons from October 2026 to September 2027 (computed)",
          head: ["New moon (UAE time, computed)", "Dark window (4 days either side)", "What is up"],
          rows: [
            ["Sat 10 Oct 2026, 19:50", "6 to 14 Oct", "Core in the evening, about 6pm to 10pm"],
            ["Mon 9 Nov 2026, 11:02", "5 to 13 Nov", "No core; constellations and camping"],
            ["Wed 9 Dec 2026, 04:51", "5 to 13 Dec", "No core; the Geminids peak on 13 to 14 Dec"],
            ["Fri 8 Jan 2027, 00:24", "4 to 12 Jan", "No core; the Quadrantids peak on 4 Jan"],
            ["Sat 6 Feb 2027, 19:56", "2 to 10 Feb", "No core"],
            ["Mon 8 Mar 2027, 13:29", "4 to 12 Mar", "Core not yet in the usual season, which opens in late March"],
            ["Wed 7 Apr 2027, 03:51", "3 to 11 Apr", "Core before dawn only, as the season opens"],
            ["Thu 6 May 2027, 14:58", "2 to 10 May", "Core from about midnight to 4am"],
            ["Fri 4 Jun 2027, 23:40", "31 May to 8 Jun", "Core from about 11pm to 3:30am"],
            ["Sun 4 Jul 2027, 07:01", "30 Jun to 8 Jul", "Core from about 10pm to 3am"],
            ["Mon 2 Aug 2027, 14:05", "29 Jul to 6 Aug", "Core from about 8:30pm to 2am; peak season"],
            ["Tue 31 Aug 2027, 21:41", "27 Aug to 4 Sep", "Core in the evening, about 7pm to 12:30am"]
          ],
          note: "New-moon times are computed with the PyEphem astronomy library for UAE time (GST, UTC+4) and agree with published new-moon tables to the minute. The Skylive moon calendar and MoonGiant confirm the October date. What is up is from the Khaleej Times month table and season dates. Checked 1 Oct 2026.",
          source: { label: "Skylive: Moon calendar, October 2026", url: "https://theskylive.com/moon-calendar?year=2026&month=10" } } },
  
      { id: 'meteor-showers', h2: 'Meteor showers: the next three',
        body: "Meteor showers need no equipment and no core, so they work in the winter months when the Milky Way is not up. Of the next three, the Geminids have the best moon of the year.\n\nThe Geminids peak on the night of 13 to 14 December 2026. The moon is a thin waxing crescent, and by our calculation it sets at about 21:15 on 13 December and about 22:05 on 14 December, so the sky is moonless from about 22:30 to dawn. EarthSky gives the best viewing around 2am, with up to about 120 meteors an hour under ideal dark skies.\n\nThe Orionids peak on 21 October 2026 at 18:00 UTC (22:00 UAE time), with EarthSky quoting 10 to 20 meteors an hour. The moon is about three-quarters lit and sets at about 02:25 on the morning of 22 October (computed), leaving about two and a half hours of dark sky before dawn twilight.\n\nThe Quadrantids peak on 4 January 2027 at 05:47 UTC, which is 09:47 in the UAE, after sunrise. EarthSky describes a peak lasting only about six hours, with over 100 meteors an hour possible under ideal conditions, so expect fewer in the pre-dawn hours here. The moon is a thin waning crescent that rises at about 04:15 (computed).",
        table: { caption: "Meteor showers, October 2026 to January 2027",
          head: ["Shower", "Peak (UAE time)", "Moon", "Rate under ideal skies", "Best window"],
          rows: [
            ["Orionids", "21 Oct 2026, 22:00 (18:00 UTC)", "About 76% lit; sets about 02:25 on 22 Oct", "10 to 20 an hour", "About 02:30 to 05:00 on 22 Oct"],
            ["Geminids", "14 Dec 2026, 09:44 (05:44 UTC), after sunrise", "Waxing crescent; sets about 21:15 on 13 Dec and 22:05 on 14 Dec", "Up to about 120 an hour", "From about 22:30 to dawn on 13 to 14 Dec; best around 2am"],
            ["Quadrantids", "4 Jan 2027, 09:47 (05:47 UTC), after sunrise", "Waning crescent; rises about 04:15", "Over 100 an hour at a narrow peak", "The pre-dawn hours of 4 Jan"]
          ],
          note: "Peak times and rates are from EarthSky; moonset, moonrise and dark windows are computed for Dubai with PyEphem. Checked 1 Oct 2026.",
          source: { label: "EarthSky: Geminid meteor shower", url: "https://earthsky.org/astronomy-essentials/everything-you-need-to-know-geminid-meteor-shower/" } } },
  
      { id: 'tours-or-diy', h2: 'Tours or DIY',
        body: "Going on your own is free: PropertyFinder says there are no charges for independent trips to Al Quaa. A tour costs money but removes the driving, the fuel, the tents and the navigation in the dark. Prices below are what each source lists and are not quotes.",
        table: { caption: "What stargazing tours and events cost",
          head: ["Option", "Price listed", "What it is", "As at"],
          rows: [
            ["Desert Dreams, Al Quaa overnight", "AED 450 per person", "Minimum 4 people; includes barbecue dinner, breakfast, private tent, camp gear, 4x4 and guides; transfers are extra", "Page read 1 Oct 2026 (undated)"],
            ["PropertyFinder, organised tours", "About AED 550 per person", "Full stargazing tours at Al Quaa", "Published 23 Nov 2025"],
            ["Dubai Desert, shared desert tours", "AED 350 to 500 per person", "Shared stargazing tours near Dubai", "Page read 1 Oct 2026 (undated)"],
            ["Dubai Desert, private camps", "AED 600 to 1,200", "Private stargazing camps; price depends on the level of luxury", "Page read 1 Oct 2026 (undated)"],
            ["Al Sadeem Observatory, Abu Dhabi", "AED 300 adult, AED 100 child (8 to 17)", "Guided observatory sessions", "PropertyFinder, 12 Mar 2025"]
          ],
          note: "Prices change. Confirm with the operator before you book.",
          source: { label: "Desert Dreams: Al Quaa overnight stargazing", url: "https://www.desertdreams.ae/al-quaa-desert-milky-way-stargazing-overnight-camping-abu-dhabi" } },
        after: "Dubai Astronomy Group, a volunteer astronomy society, runs public stargazing evenings with telescopes and guided sessions. The most recent we can confirm: a Milky Way event at Al Quaa in late May 2026, which Khaleej Times reported drew hundreds of people, and an event at Al Qudra on 2 May 2026 (7pm to 10pm, AED 200 for adults and AED 150 for children under 13, per Travel And Tour World, 29 April 2026). An earlier Al Quaa evening on 21 June 2025 cost AED 120 including a bus from Jebel Ali Metro (Gulf News). Dates and prices change with each event, so check dubaiastronomy.com for the next one.\n\nAl Thuraya Astronomy Centre is a public astronomy facility in Mushrif Park, Dubai, established in 2018 under directives from Sheikh Mohammed bin Rashid Al Maktoum. MyBayut lists public telescope viewing at AED 20 for 10 minutes, planetarium shows at AED 20 and courses, with hours of Saturday to Thursday 1pm to 9pm and Friday 5pm to 9pm (checked 1 Oct 2026). It is inside the city, so it suits the moon and the planets rather than the Milky Way; phone ahead on +971 4 221 6603." },
  
      { id: 'abu-dhabi', h2: 'The Milky Way in Abu Dhabi',
        body: "For the Milky Way in Abu Dhabi, Al Quaa is the main choice. It lies in southern Abu Dhabi on the Al Ain road, about 90 minutes from Abu Dhabi city and two to three hours from Dubai. Our Al Quaa guide covers the drive, the coordinates and what to bring.\n\nLiwa Oasis appears in PropertyFinder's guide to stargazing in Abu Dhabi, which suggests November to April for cool nights; no darkness measurement is given for it." },
  
      { id: 'gear-tips', h2: 'Gear and phone tips',
        body: "Give your eyes twenty to thirty minutes away from any white light, including headlights and phone screens. A red-light torch keeps your night vision, and binoculars add real depth to the core without the bulk of a telescope.\n\nA phone camera on its own will mostly show black: night skies need a long exposure on a steady tripod, or a night mode pushed well past its automatic setting. Fuel up before you go, download offline maps because signal is patchy, wear closed shoes (Khaleej Times notes scorpions and other wildlife), and stay on the paved or packed surface rather than loose sand at the edges." }
    ],
    faqs: [
      ['When can you see the Milky Way in the UAE?', 'The core is visible from about May to October, clearest in July and August. Khaleej Times quotes a wider season of late March to September, so the edges are approximate. In October it shows only in the early evening, about 6pm to 10pm, and in midwinter it is below the horizon at night.'],
      ['What is the best place near Dubai to see the Milky Way?', 'Al Quaa in southern Abu Dhabi is one of the darkest accessible skies in the UAE, about 2.5 hours from Dubai. Closer options are Wadi Shawka dam (about an hour), Al Qudra and Mleiha, which trade some darkness for a shorter drive.'],
      ['How far from the city do I need to go?', 'The Emirates Astronomical Society chairman, quoted by Gulf News, advises at least 35 km from urban areas. You can check how bright the sky is at a site on the light pollution map at lightpollutionmap.info.'],
      ['Do I need a telescope?', 'No. On a clear, moonless night the Milky Way is visible to the naked eye once your eyes have adjusted, which takes twenty minutes or so. Binoculars add detail.'],
      ['When is the next good Milky Way night?', 'The new moon on Saturday 10 October 2026 gives the last evening window of the season, from about 6 to 14 October. The next core season opens in spring 2027 (see the moon calendar above).'],
      ['What about meteor showers?', 'The Geminids peak on the night of 13 to 14 December 2026, with the moon setting at about 22:05 and a dark sky after about 22:30. The Orionids peak on 21 October and the Quadrantids on 4 January 2027, but the Quadrantid peak falls after sunrise in the UAE.'],
      ['Is stargazing in the UAE free?', 'Yes if you go on your own: Al Quaa and most of the other spots here charge no entry fee. Organised tours and Dubai Astronomy Group events are paid; see the price table above.']
    ],
    sources: [
      ["Khaleej Times: UAE Milky Way visible from May to October (7 May 2025)", "https://www.khaleejtimes.com/space/uae-milky-way-visible-from-may-to-october-2025"],
      ["Khaleej Times: Milky Way season, how to visit Al Quaa (31 May 2026)", "https://www.khaleejtimes.com/uae/milky-way-season-abu-dhabi-al-quaa-location-timing-tips"],
      ["Gulf News: Stargazers in the UAE can catch the Milky Way all summer long (8 May 2025)", "https://gulfnews.com/uae/science/stargazers-in-the-uae-can-catch-the-milky-way-all-summer-long-1.500119274"],
      ["Skylive: Moon calendar, October 2026", "https://theskylive.com/moon-calendar?year=2026&month=10"],
      ["MoonGiant: Moon phase on 10 October 2026", "https://www.moongiant.com/phase/10/10/2026/"],
      ["EarthSky: Orionid meteor shower 2026", "https://earthsky.org/clusters-nebulae-galaxies/everything-you-need-to-know-orionid-meteor-shower/"],
      ["EarthSky: Geminid meteor shower 2026", "https://earthsky.org/astronomy-essentials/everything-you-need-to-know-geminid-meteor-shower/"],
      ["EarthSky: Quadrantid meteor shower 2027", "https://earthsky.org/astronomy-essentials/everything-you-need-to-know-quadrantid-meteor-shower/"],
      ["Light Pollution Map", "https://www.lightpollutionmap.info"],
      ["The National: Al Quaa, secluded Abu Dhabi spot for Milky Way views (updated 8 Oct 2024)", "https://www.thenationalnews.com/travel/2020/12/18/al-quaa-secluded-abu-dhabi-spot-that-offers-out-of-this-world-views-of-the-milky-way/"],
      ["PropertyFinder: Al Quaa Milky Way spot (23 Nov 2025)", "https://www.propertyfinder.ae/blog/al-quaa-milky-way-spot/"],
      ["PropertyFinder: Stargazing in Abu Dhabi (12 Mar 2025)", "https://www.propertyfinder.ae/blog/stargazing-abu-dhabi/"],
      ["Desert Dreams: Al Quaa overnight stargazing and camping", "https://www.desertdreams.ae/al-quaa-desert-milky-way-stargazing-overnight-camping-abu-dhabi"],
      ["Dubai Desert: Stargazing spots in Dubai", "https://dubaidesert.ae/blog/stargazing-spots-in-dubai"],
      ["MyBayut: Al Thuraya Astronomy Centre", "https://www.bayut.com/mybayut/al-thuraya-astronomy-centre/"],
      ["Travel And Tour World: Stargazing at Al Qudra on 2 May 2026 (29 Apr 2026)", "https://www.travelandtourworld.com/news/article/stargazing-in-dubais-desert-unveil-the-mysteries-of-the-night-sky-at-al-qudra-on-2-may-2026/"],
      ["Gulf News: June 21 Milky Way event at Al Quaa (2025, AED 120)", "https://gulfnews.com/things-to-do/events-concerts/mark-your-calendar-june-21-brings-rare-milky-way-spectacle-to-al-quaa-abu-dhabi-1.500166560"],
      ["Dubai Astronomy Group", "https://dubaiastronomy.com/"]
    ],
    todo: [
      "TODO for Faheem: /locations/al-quaa-desert/ Quick answers, FAQ and 'Being honest about the hard parts' still say a 4x4 is required, but The National (updated 8 Oct 2024), PropertyFinder (23 Nov 2025) and Khaleej Times (31 May 2026) say a regular car reaches the usual pull-off. The page's own 27 Sep audit agrees. This guide follows the sources; fix the Al Quaa page to match.",
      "TODO for Faheem: Al Quaa page months conflict (Apr-Oct, May-Oct, Oct-Mar). This guide shows May-Oct as the core season with Khaleej Times' late March to September as the wider range.",
      "TODO for Faheem: the old text said Dubai Astronomy Group held an Al Quaa event on 16 May 2026. I could not open dubaiastronomy.com (robots block) and found no source for that date; Khaleej Times (31 May 2026) says a late-May event. Confirm the date on dubaiastronomy.com; the page now cites late May 2026 and 2 May 2026 (Al Qudra).",
      "TODO for Faheem: 'core low in the south-west after dusk' is not stated by Khaleej Times (it gives an arc from north-east to south-west, centre towards Scorpius and Sagittarius). Left out; add only with a source or your own observation.",
      "TODO for Faheem: Lahbab red dunes drive time, access and facilities not found in any source opened; kept as 'Not confirmed'.",
      "TODO for Faheem: Al Qudra/Al Marmoom drive time (about 1 hour) comes from our own Love Lake and Al Qudra pages; Gulf News and Dubai Desert give none.",
      "TODO for Faheem: Wadi Shawka drive time here is 1 to 1h15 (our page); Gulf News gives 45 minutes from Dubai. Pick one.",
      "TODO for Faheem: Al Thuraya Astronomy Centre hours and prices are from MyBayut (undated). Confirm on althurayaastronomycenter.ae or by phone (+971 4 221 6603).",
      "TODO for Faheem: timeanddate.com returned 403, so the new-moon time is cited to Skylive (16:50 London time on 10 Oct = 19:50 UAE) and MoonGiant (date only). Open timeanddate.com/moon/phases/uae/dubai in a browser to add it as a third check. Moonset/moonrise and dark windows are computed (PyEphem, Dubai 25.2N 55.3E).",
      "TODO for Faheem: Orionids moon: EarthSky says the moon sets before dawn; Royal Museums Greenwich says moonlight interferes with the peak. The 02:25 moonset (computed) reconciles both; the page gives the computed window.",
      "TODO for Faheem: IMO website was down (only its 2027 PDF calendar was available), so showers rest on EarthSky. Check the IMO 2027 PDF for the Quadrantid peak time.",
      "TODO for Faheem: Jebel Jais closure (WOW-RAK, 14 Sep 2026) may have ended; update the table row and remove the caveat when the mountain reopens.",
      "TODO for Faheem: Time Out Dubai (405) and dubaiastronomy.com (robots) could not be opened; no Perseids 2027 or Time Out content used.",
      "TODO for Faheem: the 'until' field on the this-month section is 2026-10-15; the table inside it and the October FAQ answer also refer to 10 October, so review them after that date.",
      "TODO for Faheem: Jebel Hafeet fog caution and Al Qudra/Love Lake facilities come from our own place pages, not re-checked today."
    ]
  },
  {
    slug: 'camping-near-dubai', h1: 'Camping Near Dubai: Best Spots for a Weekend Escape',
    title: 'Camping Near Dubai — Best Spots for a Weekend Escape | Sahra & Beyond',
    desc: 'The best camping spots near Dubai — desert lakes and dunes within a short drive, with GPS, the best season and what to bring for a weekend.',
    pick: ['love-lake', 'crescent-moon-lake', 'desert-camping-lake-view', 'big-red', 'half-desert'].map(id => locations.find(l => l.id === id)).filter(Boolean),
    intro: "You don't have to drive for hours to camp under a sky full of stars. Some of the best camping near Dubai is less than an hour from the city — quiet desert lakes, rolling dunes and wide-open sand where you can pitch a tent, light a fire and watch the sun go down.\n\nThis guide rounds up our favourite weekend camping spots within easy reach of Dubai, each with accurate GPS, the best season to go and a difficulty rating. Most are free, facility-free desert sites, so the trade-off for that solitude is coming fully self-sufficient.",
    sections: [
      { h2: 'How far is each spot from the city?', body: "All of the picks above sit within roughly a 40–75 minute drive of central Dubai, which makes them ideal for a Friday-night-out, Saturday-morning-back weekend. The desert-lake sites are the gentlest introduction; the dune spots reward a bit more confidence behind the wheel. Always check the access notes on each location page, because the last stretch is often soft sand." },
      { h2: 'Do you need a 4x4?', body: "For the lake and lake-view sites you can usually park on firm ground near the edge and walk in. For the dune spots, a 4x4 with lowered tyre pressures is strongly recommended, and you should never head into soft sand alone — go in a convoy of at least two vehicles, carry a tow rope and recovery boards, and know how to air your tyres back up before you hit tarmac." },
      { h2: 'What to bring', body: "These are wild sites with no toilets, bins, water or shops. Bring more water than you think you need (around four litres per person per day), shade, warm layers for the night, a power bank, a first-aid kit and rubbish bags. Each location page on this site has a packing checklist you can tailor to your group size and whether you're staying overnight." },
      { h2: 'Rules and etiquette', body: "Camping in the desert is a privilege, not a right. Pack out everything you bring in, keep fires small and contained, give wildlife and other campers space, and avoid driving over vegetation. Leaving these places exactly as you found them is what keeps them open and beautiful for the next group." },
    ],
    faqs: [
      ['Where can I camp near Dubai for free?', 'Several desert sites near Dubai — including the lakes and dune areas in this guide — are free, wild camping spots with no booking required. They have no facilities, so you must be fully self-sufficient and pack out all your rubbish.'],
      ['Is it safe to camp in the desert near Dubai?', 'Yes, with preparation. Tell someone your plans, carry plenty of water, avoid driving into soft sand alone, bring a first-aid kit and check the weather. The cooler months (October to April) are far safer and more comfortable than the summer heat.'],
      ['When is the best time to camp near Dubai?', 'October to April. Daytime temperatures are pleasant and nights are cool, sometimes cold, so bring warm layers. Summer desert camping is not recommended due to extreme heat.'],
      ['Do I need a permit to camp in the desert?', 'Most wild desert sites near Dubai do not require a permit, but rules vary by emirate and some protected or private areas do. Always respect signage and local regulations, and never camp in clearly restricted zones.']
    ]
  },
  {
    slug: 'wadis', related: [["/hiking/", "Hiking in the UAE", "Trails, heat and flash-flood safety"], ["/mountain-escapes/", "Mountain escapes", "Cooler air in the Hajar"], ["/locations/wadi-wurayah/", "Wadi Wurayah", "UNESCO site, guided tours only"]],
    h1: 'Wadis in the UAE: Pools, Waterfalls and Where to Go',
    title: 'Wadis in the UAE: Swimming, Waterfalls & Access | Sahra & Beyond',
    desc: 'Ten wadis in the UAE compared: swimming, 4x4, drive from Dubai, permits and best months, plus the UAE’s waterfalls and flash-flood safety.',
    pick: ['wadi-wurayah', 'wadi-naqab', 'wadi-showka', 'wadi-kub', 'al-rafisah-dam'].map(id => locations.find(l => l.id === id)).filter(Boolean),
    intro: "Wadis are the dry valleys that run through the Hajar Mountains, and the UAE's best-known ones sit in Ras Al Khaimah, Fujairah and Sharjah, within about two hours of Dubai. Some hold pools after rain, one has a waterfall that runs all year, and several are better for walking than for swimming.\n\nThis guide compares ten of them side by side, then covers which have water in summer, which are closest to Dubai, the UAE's waterfalls, and the flash-flood and etiquette rules that apply to every wadi. Details are as at 1 October 2026. Access rules change, so check before you go.",
    sections: [
      {
        id: 'wadis-compared',
        h2: 'The wadis compared',
        body: "The table covers ten wadis, all in the UAE. Where no published source gives a figure, the cell says Not confirmed rather than a guess. The four wadis with their own guide on this site link from the first column.\n\nTwo cautions apply to the whole table. Swimming depends on recent rain and local rules, so treat any pool as a bonus, follow signs and never dive into water you have not checked. And Wadi Wurayah is visited in controlled guided groups, so it is not a turn-up-and-walk wadi.",
        table: {
          caption: 'Ten UAE wadis compared, as at 1 October 2026',
          head: ['Wadi', 'Emirate', 'Can you swim?', '4x4 needed?', 'Drive from Dubai', 'Permit / access', 'Best months'],
          rows: [
            [{ t: 'Wadi Wurayah', href: '/locations/wadi-wurayah/' }, 'Fujairah', 'Not confirmed. A freshwater pool sits below the waterfall, but swimming is not addressed', 'Not confirmed. Access is by guided tour', 'Not confirmed. About 45 km from Fujairah city', 'Guided tours only, booked through Fujairah Holidays, from Dh300 a person (July 2026)', 'Cooler months. Tours restart in early to mid-October'],
            ['Wadi Bih', 'Ras Al Khaimah / Fujairah', 'Shallow pools reported (Visit Ras Al Khaimah, as Al Beeh)', 'An SUV is suggested for the winding roads', 'About 1h30 via the E611', 'Not confirmed', 'October to March'],
            ['Wadi Ghalilah', 'Ras Al Khaimah', 'Not confirmed. Best known for the hard Stairway to Heaven hike', 'Not confirmed', 'Not confirmed', 'Not confirmed', 'Not confirmed'],
            ['Wadi Al Hayl', 'Fujairah', 'Small pools and streams. Swimming not confirmed', 'Not confirmed', 'Not confirmed', 'Not confirmed. Described as an ecologically sensitive site', 'October to March'],
            ['Wadi Siji', 'Fujairah', 'Natural streams and pools. Swimming not confirmed', 'Not confirmed', 'Not confirmed', 'Not confirmed', 'October to March'],
            ['Wadi Abadilah', 'Fujairah', 'Pools in the wadi. What’s On says swimming is possible', 'Not confirmed', 'About 1h30', 'Not confirmed', 'Not confirmed'],
            [{ t: 'Wadi Kub', href: '/locations/wadi-kub/' }, 'Ras Al Khaimah / Fujairah', 'Rock pools after rain. Swimming not confirmed', 'A car reaches the trailhead. High clearance for the wadi bed', 'About 1h45 (approximate)', 'Free, open access, no gate', 'October to April'],
            [{ t: 'Wadi Naqab', href: '/locations/wadi-naqab/' }, 'Ras Al Khaimah', 'Seasonal pools after rain, wading depth', 'Yes, for the last few kilometres to the trailhead', 'About 2 hours', 'No permit. Groups of 10 or more notify RAK tourism authorities', 'October to April'],
            [{ t: 'Wadi Shawka (Showka)', href: '/locations/wadi-showka/' }, 'Ras Al Khaimah', 'Seasonal natural pools that form after rain', 'No for the dam and park. Higher clearance helps beyond', 'About 1h to 1h15 (around 92 km)', 'Free entry', 'November to April'],
            ['Wadi Helo (Al Helo)', 'Sharjah', 'Not confirmed. Wikipedia says the valley’s water has dried up', 'Not confirmed', 'About 1h40', 'Not confirmed', 'Not confirmed']
          ],
          note: 'Not confirmed means no published source gives the detail yet. Drive times are approximate and depend on traffic. Visit Ras Al Khaimah spells Bih as Al Beeh, and Bih runs across the Ras Al Khaimah and Fujairah boundary.',
          source: { label: 'MyBayut Fujairah wadi list, Visit Ras Al Khaimah, What’s On, Khaleej Times and our own place guides (full list under Sources)', url: 'https://www.bayut.com/mybayut/fujairah-wadi-list/' }
        }
      },
      {
        id: 'wadis-water-in-summer',
        h2: 'Which wadis have water in summer?',
        body: "Only one wadi in the UAE is reported to have a waterfall that flows all year: Wadi Wurayah. Khaleej Times gives the waterfall as about 13 metres high and says it flows through the summer months, and What's On calls it the UAE's only permanent year-round waterfall. The catch is access. Visits are by guided tour in the cooler months, so the year-round water is not something you can go and see in August.\n\nEverywhere else, assume the pools depend on rain. Visit Ras Al Khaimah says Wadi Shawka's natural pools form after rainfall, and Wadi Naqab and Wadi Kub fill with seasonal pools after winter rain. Wikipedia says the water in Wadi Helo has dried up.\n\nSummer is also the wrong season for the walk itself. Visit Ras Al Khaimah gives October to April as the best hiking season and says summer conditions make the Wadi Naqab trails inadvisable because of the heat."
      },
      {
        id: 'wadis-near-dubai',
        h2: 'Wadis near Dubai',
        body: "Drive times below are approximate and from Dubai.\n\nWadi Shawka, Ras Al Khaimah: about an hour to an hour and a quarter. It is the easiest first wadi: any car reaches the dam and park area, entry is free, and the dam area has washrooms and shaded seating.\n\nWadi Abadilah and Wadi Bih: both about an hour and a half. What's On puts Abadilah at 1h30, a trail through farmland described as easy to moderate. MyBayut gives about 90 minutes to Wadi Bih via the E611.\n\nRainbow Valley, Wadi Ghub, Fujairah: about an hour and a half from downtown Dubai, an 11 km round trip of four to six hours through multicoloured layered rock. The Road Reel says a sedan can reach the parking area, no permit is needed, and the small seasonal pools are not suitable for swimming. It lists late November to mid-March as the best months.\n\nWadi Helo, Sharjah: about 1h40 (What's On).\n\nWadi Kub, about 1h45, and Wadi Naqab, about two hours, are the two longer drives. Naqab is a hard mountain hike that needs a 4x4 for the final stretch, and Kub is a quiet wild-camping valley with no facilities.\n\nWadi Wurayah is in Fujairah, about 45 km from Fujairah city. Its drive time from Dubai is not confirmed, and it can only be visited as part of a booked tour."
      },
      {
        id: 'waterfalls-in-the-uae',
        h2: 'Waterfalls in the UAE',
        body: "Wadi Wurayah, Fujairah. The UAE's only permanent natural waterfall is about 13 metres high, flows year-round and sits inside a reserve of about 220 square kilometres in the Hajar Mountains (Khaleej Times, 27 July 2026). Wadi Wurayah joined the UNESCO World Heritage List on 25 July 2026 (What's On, 4 August 2026). Visits are by guided tour only, booked through Fujairah Holidays, with packages from Dh300 a person, and individual access is not permitted.\n\nSeasonal waterfalls. Visit Ras Al Khaimah says Wadi Shawka leads past small pools to waterfalls where you can take a dip, and our Wadi Kub guide notes seasonal waterfalls after rain. These appear only after rain, and rain is also what makes a wadi dangerous.\n\nMan-made waterfalls. Two waterfalls on Sharjah's east coast are artificial. PropertyFinder describes the Khorfakkan waterfall as man-made, built into natural rock above Khorfakkan Beach, and free to visit (October 2025). Visit Sharjah calls the waterfall at Al Rafisah Dam man-made, and PropertyFinder puts the dam about 10 to 15 minutes from the Khorfakkan waterfall. Both are worth a stop, but neither is a natural waterfall."
      },
      {
        id: 'wadi-flash-flood-safety',
        h2: 'Flash-flood safety: read this first',
        body: "Wadis can flood fast and without warning, even when it is not raining where you are. Rain in the mountains upstream can send a wall of water down a dry valley. Visit Ras Al Khaimah says Wadi Naqab can fill with water quickly and that you should never attempt the hike when rain is expected.\n\nNever enter a wadi if rain is forecast anywhere in the catchment. Check the National Center of Meteorology forecast before you go, keep an eye on the sky, and know your exit route to higher ground. If water starts rising or turning muddy, get out immediately. Do not camp in the wadi bed."
      },
      {
        id: 'wadi-etiquette',
        h2: 'Wadi etiquette and what to bring',
        body: "Wadi pools and streams are fragile. MyBayut notes that littering is strictly prohibited in the Fujairah wadis, with potential fines, so carry out every scrap of rubbish. Visit Ras Al Khaimah advises dressing modestly and leaving no trace. Keep out of areas marked as protected or under renovation, and stay on the paths at sensitive sites such as Wadi Al Hayl and Wadi Wurayah.\n\nBring plenty of water, sun protection, sturdy shoes that grip when wet, a dry bag for your phone, a small first-aid kit and snacks. Most wadis have no shop or tap, and mobile signal can be patchy. Start early to beat both the heat and the crowds, and tell someone your route."
      },
      {
        id: 'best-season-for-wadis',
        h2: 'Best season for wadis',
        body: "October to April is the usual window, with some wadis quoted slightly narrower: November to April for Shawka, and October to March for the Fujairah wadis in the MyBayut list. Avoid wadis during and just after heavy rain, and avoid summer, when the heat makes the approach walks unsafe."
      },
      {
        id: 'wadi-shab-is-in-oman',
        h2: 'Wadi Shab is in Oman',
        body: "Wadi Shab, the swimming wadi near Tiwi, is in the Al Sharqiyah region of Oman, less than two hours' drive from Muscat (Oman Tripper). It is not in the UAE and is not in this guide."
      }
    ],
    faqs: [
      ['Can you swim in the wadis in the UAE?', "Sometimes. Wadi Shawka, Wadi Naqab and Wadi Kub have seasonal pools that form after rain, and What's On says swimming is possible at Wadi Abadilah. Whether swimming is allowed at Wadi Wurayah is not confirmed, and the small pools in Rainbow Valley are described as not suitable for swimming. Pools depend on recent rain, so check conditions, follow signs and never dive into water you have not checked."],
      ['Is there a waterfall in the UAE?', "Yes. Wadi Wurayah in Fujairah has the UAE's only permanent natural waterfall, about 13 metres high and flowing year-round according to Khaleej Times. Other waterfalls appear only after rain. The waterfalls at Khor Fakkan and Al Rafisah Dam on Sharjah's east coast are man-made."],
      ['Can I visit Wadi Wurayah?', "Only on a guided tour. Khaleej Times (27 July 2026) says tours are booked through Fujairah Holidays, individual access is not permitted, and packages start from Dh300 a person. Tours run in the cooler months and restart in early to mid-October."],
      ['Do I need a 4x4 to reach the wadis?', "It depends on the wadi. A regular car reaches the dam and park area at Wadi Shawka and the trailhead at Wadi Kub. Wadi Naqab needs a 4x4 for the last few kilometres to the trailhead. MyBayut suggests an SUV for the winding roads at Wadi Bih. For several wadis in the table the access is not confirmed."],
      ['Which wadi is closest to Dubai?', "Wadi Shawka in Ras Al Khaimah is the closest of the ten, at about an hour to an hour and a quarter. Wadi Abadilah and Wadi Bih are about an hour and a half away, and Rainbow Valley in Wadi Ghub is about the same."],
      ['When is the best time to visit a wadi in the UAE?', "October to April, with the exact window varying by wadi: November to April for Wadi Shawka and October to March for the Fujairah wadis listed by MyBayut. Avoid summer heat, and never enter a wadi during or just after heavy rain or when rain is forecast upstream."],
      ['Is Wadi Shab in the UAE?', "No. Wadi Shab is in the Al Sharqiyah region of Oman, less than two hours from Muscat. The wadis in this guide are all in the UAE."]
    ],
    sources: [
      ['MyBayut: Fujairah wadis (Wurayah, Al Hayl, Siji, Bih and more)', 'https://www.bayut.com/mybayut/fujairah-wadi-list/'],
      ['MyBayut: Wadi Bih', 'https://www.bayut.com/mybayut/wadi-bih-ras-al-khaimah/'],
      ['Visit Ras Al Khaimah: the UAE’s hidden waterfalls and wadis (27 March 2023)', 'https://visitrasalkhaimah.com/blog/a-guide-to-the-uaes-hidden-waterfalls-and-wadis/'],
      ['Visit Ras Al Khaimah: Wadi Naqab hike', 'https://visitrasalkhaimah.com/blog/wadi-naqab-hike/'],
      ['Visit Ras Al Khaimah: Wadi Shawka', 'https://visitrasalkhaimah.com/location/place/wadi-shawka/'],
      ['What’s On: hiking trails to try in the UAE (3 October 2024)', 'https://whatson.ae/2024/10/hiking-trails-to-try-in-the-uae/'],
      ['Khaleej Times: how to visit Wadi Wurayah (27 July 2026)', 'https://www.khaleejtimes.com/travel/uae-attractions/how-to-visit-wadi-wurayah-fujairah'],
      ['What’s On: Wadi Wurayah, the UAE’s first natural UNESCO World Heritage Site (4 August 2026)', 'https://whatson.ae/2026/08/wadi-wurayah-a-guide-to-the-uaes-first-natural-unesco-world-heritage-site/'],
      ['Wikipedia: Wadi Helo', 'https://en.wikipedia.org/wiki/Wadi_Helo'],
      ['The Road Reel: Rainbow Valley (Spectrum) trail, Fujairah', 'https://www.theroadreel.com/rainbow-valley-hike-fujairah-uae/'],
      ['PropertyFinder: Khorfakkan waterfall guide (October 2025)', 'https://www.propertyfinder.ae/blog/khorfakkan-waterfall/'],
      ['Visit Sharjah: the waterfall at Al Rafisah Dam', 'https://www.visitsharjah.com/al-rafisah-dam/experiences/the-waterfall/'],
      ['Oman Tripper: Wadi Shab', 'https://omantripper.com/wadi-shab/'],
      ['National Center of Meteorology (UAE)', 'https://www.ncm.gov.ae/']
    ],
    todo: [
      'TODO for Faheem: /locations/wadi-wurayah/ is being built in parallel; the table and pick link to it. Confirm the page exists at build time (pick uses .filter(Boolean), the table link would 404 if it does not).',
      'TODO for Faheem: Wadi Wurayah swimming, 4x4 and Dubai drive time are Not confirmed. Khaleej Times mentions a freshwater pool but not whether swimming is allowed; ask Fujairah Holidays. Khaleej Times also says visits run on Saturdays with limited spaces and What’s On says the site has been open since January 2026; neither is published here until Fujairah Holidays confirms the current schedule.',
      'TODO for Faheem: no source found for Ghalilah (swim, 4x4, drive, permit, months), Al Hayl or Siji (4x4, drive, permit), Abadilah (4x4, permit, months; Greenway Adventures, 2022, says a sedan is enough and the fee depends on group size, but it is an old operator page) or Helo (4x4, permit, months). Fill from first-hand notes or an official source, or drop the rows.',
      'TODO for Faheem: Wadi Bih 4x4 conflict. MyBayut says to explore by 4-wheel SUV; wow-rak.com (29 Sep 2026, a minor source) says 4x4 not required and entry free. Table shows the MyBayut line only. Also confirm Visit RAK’s Al Beeh is the same wadi as Wadi Bih (assumed from spelling and the RAK location).',
      'TODO for Faheem: Wadi Helo swimming conflict. What’s On (2024) lists a lagoon and swimming as possible; Wikipedia says the water has dried up. Table shows only the Wikipedia line and Not confirmed.',
      'TODO for Faheem: /locations/wadi-shab.json still exists (category Wadis, emirate Tiwi, desc says swim through turquoise pools). It was in the old pick and is surfaced on /places/ and in the GSC list (14 impressions). It is in Oman. Recommend removing the page or redirecting it, and certainly not listing it as a UAE wadi.',
      'TODO for Faheem: al-rafisah-dam is kept in pick only to support the man-made waterfall paragraph (it is a dam, not a wadi). Drop it from pick if you want only wadis in the cards. jabal-yanas was dropped (a summit, not a wadi).',
      'TODO for Faheem: Khorfakkan waterfall height differs by source (our Khor Fakkan guide says about 45 m from Gulf News; PropertyFinder says 43 m above sea level, 45 m long, 11 m wide), so no height is given here. PropertyFinder opening hours (8am to 6pm) not published here; add with an as-at date if wanted.',
      'TODO for Faheem: Wadi Kub drive time (about 1h45) is our own estimate per the Kub page notes, not an official figure. Shawka 1h to 1h15 is our own page; Visit RAK gives about 92 km.',
      'TODO for Faheem: the Wadi Wurayah Dh300 price and UNESCO date (25 July 2026) are as read on 1 October 2026 from Khaleej Times and What’s On; check them against the new Wurayah location page so both pages agree.'
    ]
  },
  {
    slug: 'desert-camping-beginners', h1: 'Desert Camping for Beginners in the UAE',
    title: 'Desert Camping for Beginners in the UAE — A Complete Guide | Sahra & Beyond',
    desc: 'A beginner-friendly guide to desert camping in the UAE: where to go, what to pack, sand-driving basics, safety and leave-no-trace tips.',
    pick: locations.filter(l => l.category === 'Camping'),
    intro: "Never camped in the desert before? It's one of the most magical things you can do in the UAE — and it's easier to get right than you'd think. This beginner's guide walks you through choosing a spot, packing the essentials, staying safe and camping responsibly, so your first night under the stars is a great one.\n\nStart with one of the gentler, easy-to-reach sites in our picks below, go with a friend or two, and build up from there.",
    sections: [
      { h2: 'Choosing your first spot', body: "For a first trip, pick an easy-rated site with firm ground you can reach without serious off-roading — the desert-lake sites in our picks are ideal. Go on a weekend with good weather in the cooler season, arrive with a couple of hours of daylight left so you can set up your tent and get oriented before dark, and avoid committing to deep, soft dunes until you're confident." },
      { h2: 'The essential kit', body: "You don't need expensive gear to start. The essentials: a tent and pegs that hold in sand, a sleeping bag and mat, four-plus litres of water per person per day, a head torch, warm layers for the night, sun protection, a first-aid kit, a power bank and plenty of rubbish bags. A small shovel and a sturdy ground sheet make life easier. Every location page here has a packing checklist you can tailor." },
      { h2: 'Sand-driving basics', body: "If your spot needs any off-road driving, the golden rules are: lower your tyre pressures (this is the single biggest factor in not getting stuck), keep momentum, steer smoothly, and never drive into soft sand alone. Travel with at least one other vehicle, carry a tow rope and recovery boards, and bring a compressor or have a plan to re-inflate before tarmac. If in doubt, park on firm ground and walk in." },
      { h2: 'Staying safe', body: "Tell someone where you're going and when you'll be back. Download offline maps and note your GPS coordinates — phone signal is patchy. Watch the night-time temperature drop, which catches beginners out in winter. Keep a torch handy, secure food from wildlife, and never leave a campfire unattended. If conditions change, it's always fine to pack up and head home early." },
      { h2: 'Leave no trace', body: "This is the rule that matters most. Take every piece of rubbish home with you, including food scraps and anything that blew away. Keep fires small and fully extinguish them, don't drive over plants, and leave the site cleaner than you found it. Responsible camping is what keeps these places open to everyone." }
    ],
    faqs: [
      ['Is desert camping in the UAE safe for beginners?', 'Yes — choose an easy, accessible site in the cooler months, go with others, carry plenty of water and a first-aid kit, and tell someone your plans. Start simple and build up as you gain confidence.'],
      ['What do I need for my first desert camping trip?', 'A sand-worthy tent, sleeping bag and mat, four-plus litres of water per person per day, a head torch, warm night layers, sun protection, a first-aid kit, a power bank and rubbish bags. Each location page has a full tailored checklist.'],
      ['Do I need a 4x4 to go desert camping?', 'Not always. Several beginner-friendly sites have firm ground you can reach in a normal car and walk in from. For dune sites you need a 4x4, lowered tyre pressures and a convoy — never tackle soft sand alone.'],
      ['When should beginners go desert camping in the UAE?', 'Between October and April, when temperatures are comfortable by day and cool at night. Avoid the extreme summer heat entirely.']
    ]
  },
  {
    slug: 'mountain-escapes', related: [["/hiking/", "Hiking in the UAE", "Trails by emirate, season and safety"], ["/wadis/", "Wadis in the UAE", "Ten wadis compared"], ["/hatta-guide/", "Hatta day trip", "Wadi Hub, heritage village and the dam"]], h1: 'Best Mountain Escapes in the UAE',
    title: 'Best Mountain Escapes in the UAE — Hikes & Cool-Air Getaways | Sahra & Beyond',
    desc: 'The best mountain escapes in the UAE — cooler air, big views and hikes in the Hajar range, with GPS, the best season and what to bring.',
    pick: locations.filter(l => l.category === 'Mountains'),
    intro: "When the lowlands heat up, the mountains are where the UAE goes to cool down. The rugged Hajar range rises dramatically near the east coast and along the Oman border, offering cooler air, sweeping views and proper hiking — a completely different side of the Emirates to the dunes and beaches.\n\nThese are our favourite mountain escapes in the UAE, with access notes, the best season and difficulty. Pack for changeable conditions and respect the terrain — the mountains are unforgiving of the unprepared.",
    sections: [
      { h2: 'Why head for the mountains', body: "Altitude brings noticeably cooler temperatures, which makes the mountains comfortable even on the shoulders of summer. Add big horizon views, winding scenic drives and quiet trails, and they're a brilliant antidote to the city. Some spots are an easy drive-up viewpoint; others are full-day hikes — there's something for every level." },
      { h2: 'Hiking safely in the Hajar', body: "Mountain terrain is rocky, exposed and steep in places. Wear proper hiking shoes, carry far more water than you'd expect (there's rarely any on the trail), start early, and turn back with plenty of daylight to spare. Tell someone your route, download offline maps, and don't rely on phone signal. Loose rock and sudden drop-offs mean this is not the place to wander off-trail." },
      { h2: 'What to bring', body: "Sturdy footwear, sun protection, a hat, two-plus litres of water per person for a half-day (more for longer), snacks, a first-aid kit, a windproof layer for exposed ridges and a fully charged phone with offline maps. Each location page has a packing checklist you can tailor to your trip." },
      { h2: 'Best season for the mountains', body: "October to April is ideal for hiking, with comfortable daytime temperatures. The higher elevations can be genuinely cold and windy in winter, so bring a warm layer. Summer hiking at altitude is possible early in the morning but the heat lower down makes the approach tough — plan accordingly." }
    ],
    faqs: [
      ['Are there mountains to hike in the UAE?', 'Yes — the Hajar mountains near the east coast and the Oman border offer everything from easy drive-up viewpoints to full-day hikes, with cooler air and big views.'],
      ['Is it cooler in the UAE mountains?', 'Yes. Higher elevation means noticeably lower temperatures than the coast or desert, which is why the mountains are a popular escape when the lowlands are hot. Winter at altitude can even be cold and windy.'],
      ['What should I bring for a mountain hike in the UAE?', 'Proper hiking shoes, plenty of water, sun protection, snacks, a first-aid kit, a warm/windproof layer and offline maps. Start early and turn back with daylight to spare.'],
      ['When is the best time to visit the UAE mountains?', 'October to April for comfortable hiking. Bring a warm layer for the higher, windier spots, and avoid strenuous midday hikes in summer.']
    ]
  },
  {
      slug: 'hatta-guide', related: [["/hiking/", "Hiking in the UAE", "Hatta Wadi Hub routes and more"], ["/locations/hatta/", "Hatta Dam", "Kayaking, prices and hours"], ["/mountain-escapes/", "Mountain escapes", "More of the Hajar"]], h1: 'Hatta Day Trip from Dubai: Wadi Hub, Heritage Village and the Dam',
      title: 'Hatta Day Trip from Dubai: Wadi Hub, Heritage Village & Dam',
      desc: 'Plan a Hatta day trip from Dubai: Hatta Wadi Hub season and routes, Hatta Heritage Village hours and entry, the dam and how long the drive takes.',
      pick: ['hatta'].map(id => locations.find(l => l.id === id)).filter(Boolean),
      intro: "Hatta is Dubai's mountain exclave in the Hajar range, about 90 minutes by car from the city according to Visit Hatta. A day there usually combines three stops that sit close together: Hatta Wadi Hub for outdoor activities and trails, Hatta Heritage Village for the old settlement, and Hatta Dam for the turquoise reservoir.\n\nThis guide is the day-trip plan. The dam and the kayak have their own page, with boat types, ages, weight limits, prices and opening hours. Prices, hours and dates below carry the source and the date they were read, and where a source is not official the text says so.",
      sections: [
        { id: 'getting-there', h2: 'Getting there and when to go', body: "Visit Hatta gives the drive from Dubai as about 90 minutes by car. The usual route is the E44 (Dubai-Hatta Road), roughly 105 km, and it is busier on Fridays and weekends, so a weekday start is easier. There is no realistic public transport option for a day trip; the practical choices are your own car, a private driver or an organised tour.\n\nThe cooler months, October to May, are the sensible window. Summer is very hot and best avoided for outdoor activity. Hatta borders Oman, so carry ID in case your route comes near the Hatta-Al Wajajah border post, although the Wadi Hub, the Heritage Village and the dam all sit well inside the UAE." },
        { id: 'wadi-hub', h2: 'Hatta Wadi Hub', body: "Hatta Wadi Hub is the activity centre beside the dam. Visit Hatta's Plan your visit page gives the season as 1 October to 5 May, and its adventures page says Season 9 opens on 28 September (both read 1 October 2026). What's On reported the hub closing for summer on 3 May 2026, with the dam and kayaking staying open. Check the dates before you drive out, because the hub is seasonal.\n\nOn the trails, Visit Hatta describes five routes totalling 32.6 km, graded so that there is something for different levels. Individual route names and lengths are on the operator's Open Trails map, which is linked from its mountain biking page, so download it before you go rather than relying on phone signal.\n\nOther activities listed by Visit Hatta include mountain biking, a pool area and rides for children. Poolside access is listed at AED 25 per person (adventures page, read 1 October 2026). Opening hours are listed differently on different Visit Hatta pages, so confirm with the operators: Hatta Outdoor on +971 50 136 0085 or Go Gravity on +971 50 760 0278, the numbers Visit Hatta publishes.",
          table: { caption: 'Hatta Wadi Hub at a glance (read 1 October 2026)', head: ['Item', 'What the source says'], rows: [
            ['Season', '1 October to 5 May (Visit Hatta, Plan your visit); Season 9 opens 28 September (Visit Hatta, adventures)'],
            ['Trail network', 'Five graded routes, 32.6 km in total (Visit Hatta, mountain biking)'],
            ['Poolside access', 'AED 25 per person (Visit Hatta, adventures)'],
            ['Opening hours', 'Not confirmed: Visit Hatta pages differ'],
            ['Bookings', 'Hatta Outdoor +971 50 136 0085; Go Gravity +971 50 760 0278']
          ], note: 'Fees and hours change; confirm with the operator on the day.', source: { label: 'Visit Hatta: Adventures at Hatta Wadi Hub', url: 'https://www.visithatta.com/en/play/adventures' } } },
        { id: 'heritage-village', h2: 'Hatta Heritage Village', body: "Hatta Heritage Village is a restored settlement of reconstructed homes and stalls offering traditional crafts. Bayut lists Bait Al Wali (the former ruler's residence), Hatta Fort, watchtowers, a heritage museum and the Hatta falaj irrigation system among its features. It is a short drive from the dam and works as a slower stop after the water or the trails.\n\nBayut describes a visit as one of the free things to do in Dubai. Opening hours come from two third-party listings and differ: WhichMuseum lists 7:30am to 8:30pm on most days and 2:30pm to 8:30pm on Fridays, while Bayut lists daily 8am to 8pm (both read 1 October 2026). WhichMuseum advises checking hours before you visit, as they can change on special days and holidays. Neither listing is the village's own, so treat the times as a guide.",
          table: { caption: 'Hatta Heritage Village: published hours (read 1 October 2026)', head: ['Source', 'Hours listed', 'Entry'], rows: [
            ['WhichMuseum', '7:30am to 8:30pm; Friday 2:30pm to 8:30pm', 'Not stated'],
            ['Bayut (MyBayut guide)', 'Daily, 8am to 8pm', 'Free, per Bayut']
          ], note: 'Third-party listings; no official hours were found.', source: { label: 'Bayut: Hatta Heritage Village guide', url: 'https://www.bayut.com/mybayut/hatta-heritage-village/' } } },
        { id: 'dam', h2: 'Hatta Dam, briefly', body: "Hatta Dam is the reservoir most people come to photograph, and it is the base for Hatta Kayak. Swimming in the reservoir is not allowed. For boat types, age and weight limits, prices, opening hours and access, use the dedicated dam and kayak page.",
          table: { caption: 'More on the dam', head: ['Guide', 'What it covers'], rows: [[{ t: 'Hatta Dam and kayaking', href: '/locations/hatta/' }, 'Boats, ages and weight limits, prices, hours, access, swimming']] } },
        { id: 'planning', h2: 'Putting the day together', body: "A simple order is the hub or the dam in the morning, when it is cooler, and the Heritage Village later in the day, since its listed hours run to the evening. Bring water, sun protection, a hat and cash or a card for activities, and fill the tank before leaving the city. Carry snacks and water as well; the Heritage Village has no cafés or shops." }
      ],
      faqs: [
        ['How long is the drive from Dubai to Hatta?', 'Visit Hatta gives about 90 minutes by car. The E44 route is roughly 105 km and is slower on Fridays and weekends.'],
        ['When is the Hatta Wadi Hub season?', 'Visit Hatta gives 1 October to 5 May on its Plan your visit page, and its adventures page says Season 9 opens on 28 September (both read 1 October 2026). Confirm before you go.'],
        ['How many trails does Hatta Wadi Hub have?', 'Visit Hatta describes five graded routes totalling 32.6 km, with route details on the Open Trails map linked from its mountain biking page.'],
        ['Is Hatta Heritage Village free?', 'Bayut describes it as one of the free things to do in Dubai (read 1 October 2026). The village has no listing of its own among the sources checked, so confirm locally.'],
        ['What are the opening hours of Hatta Heritage Village?', 'Third-party listings differ: WhichMuseum gives 7:30am to 8:30pm (Friday from 2:30pm) and Bayut gives daily 8am to 8pm, both read 1 October 2026. Check locally before you go.'],
        ['Can you swim at Hatta Dam?', 'No. Swimming in the reservoir is not allowed for safety reasons (dubaiofw, read 1 October 2026). See the Hatta Dam and kayaking page for what you can do on the water.'],
        ['Where is the Hatta kayak information?', 'On the Hatta Dam and kayaking page at /locations/hatta/, which has boat types, ages, weight limits, prices and hours.']
      ],
      sources: [
        ['Visit Hatta: Plan your visit', 'https://www.visithatta.com/en/explore-hatta/plan-your-visit'],
        ['Visit Hatta: Adventures at Hatta Wadi Hub', 'https://www.visithatta.com/en/play/adventures'],
        ['Visit Hatta: Mountain biking', 'https://www.visithatta.com/en/play/mountain-biking'],
        ['Bayut: Hatta Heritage Village guide', 'https://www.bayut.com/mybayut/hatta-heritage-village/'],
        ['WhichMuseum: Hatta Heritage Village opening hours', 'https://whichmuseum.com/museum/hatta-heritage-village-24030/opening-hours'],
        ['What\'s On: Hatta announces closing date (May 2026)', 'https://whatson.ae/2026/05/hatta-announces-closing-date/'],
        ['dubaiofw: Hatta Dam', 'https://dubaiofw.com/hatta-dam/'],
        ['Uptown DXB: Dubai to Hatta distance', 'https://www.uptowndxb.com/dubai-to-hatta-distance/']
      ],
      todo: [
        'TODO for Faheem: confirm Hatta Wadi Hub opening hours (Visit Hatta pages disagree) and the 2026-27 season dates (1 Oct-5 May vs Season 9 opens 28 Sep).',
        'TODO for Faheem: confirm Hatta Heritage Village hours and entry fee with the site itself (only WhichMuseum and Bayut found; Visit Dubai page returned 404).',
        'TODO for Faheem: confirm Hatta Kayak hours (7am-9pm vs 7am-5:30pm); see /locations/hatta/.',
        'TODO for Faheem: Visit Hatta metadata mentions a 52 km trail with 4 challenge levels, which conflicts with 32.6 km across 5 routes; kept 32.6 km (body text).'
      ]
    },
  {
    slug: 'best-beaches', related: [["/fujairah-beaches/", "Fujairah beaches", "The east coast, beach by beach"], ["/snorkeling/", "Snorkeling in the UAE", "Reefs you can reach from shore"]], h1: 'Best Beaches in the UAE for a Day Out', compare: true,
    title: 'Best Beaches in the UAE: Quiet & Natural Beaches Compared',
    desc: 'Quiet and natural beaches across the UAE compared side by side: which sea, car or 4x4, toilets and the best months, with GPS and a guide for each beach.',
    pick: locations.filter(l => l.category === 'Coast' || l.id === 'al-rams-beach'),
    intro: "With two very different coastlines — the calm Arabian Gulf to the west and the clear, reef-rich Gulf of Oman to the east — the UAE has a beach for every kind of day out. Whether you want gentle water for the family, a snorkel over a living reef or a quiet stretch away from the resorts, the spots below are our favourites.\n\nEach has access notes, the best season and a difficulty rating, so you can pick the right beach for your plans and travel prepared.",
    sections: [
      { h2: 'East coast vs west coast', body: "The west coast (Dubai, Abu Dhabi, Sharjah) has long, sandy, generally calm beaches that are great for families and easy swims. The east coast (Fujairah and the Gulf of Oman) trades some of that calm for clearer water, coral reefs and marine life — it is the place to go for snorkeling and a more natural feel. Pick based on whether you want easy sand or underwater scenery." },
      { h2: 'Best beaches for snorkeling', body: "For snorkeling, the east coast wins. Healthy coral, turtles and reef fish are reachable straight from shore at the best spots, making it a brilliant outing for families and beginners. Go early on a weekday for the calmest, clearest water, bring your own mask and fins, and always wear reef-safe sunscreen to protect the coral." },
      { h2: 'Beach safety and etiquette', body: "Swim where it is permitted, be aware of currents and check for flags or signage. Keep an eye on children near the water, stay hydrated, and use shade and high-SPF sun protection — the UAE sun is strong even in winter. Take all your rubbish home, give wildlife space, and never touch or stand on coral." },
      { h2: 'Best season for the beach', body: "The sea is most comfortable from around October to May, with pleasant air temperatures and warm-but-refreshing water. Summer is swimmable but very hot on the sand, so go early or late in the day. Winter mornings can be breezy on the east coast, so bring a layer." }
    ],
    faqs: [
      ['Which UAE coast is best for snorkeling?', 'The east coast, on the Gulf of Oman around Fujairah, has the clearest water and coral reefs with turtles and reef fish reachable from shore. The west coast is calmer and sandier, better for easy swimming.'],
      ['When is the best time to go to the beach in the UAE?', 'October to May offers the most comfortable air and water temperatures. Summer is hot on the sand, so visit early morning or late afternoon.'],
      ['Are UAE beaches good for families?', 'Yes — the west-coast beaches are generally calm and sandy, ideal for children, while gentler east-coast spots are great for an easy first snorkel. Always supervise kids near the water.'],
      ['Do I need to pay to access UAE beaches?', 'Many public beaches are free, while some managed or resort beaches charge an entry fee. Check the specific beach before you go.']
    ]
  },
  {
    slug: 'desert-safari', h1: 'Desert Safari & Best Dune Spots in the UAE',
    title: 'Desert Safari in the UAE: Best Dune Spots, DIY or Tour',
    desc: 'Where the best dunes are for a UAE desert safari, from Liwa to Big Red, plus self-drive safety, the season and when a guided tour makes more sense.',
    pick: locations.filter(l => l.category === 'Dunes'),
    intro: "Rolling golden dunes are the classic image of the UAE, and there is no better way to experience them than out in the desert itself — whether on a guided safari or a self-drive adventure. From the towering dunes of Liwa to the accessible sands closer to the cities, the spots below are where the desert is at its most spectacular.\n\nThis guide covers what to expect, whether to self-drive or book a tour, dune-driving safety and the best season to go.",
    sections: [
      { h2: 'What to expect from a desert safari', body: "A desert safari can mean many things: a sunset dune drive, sandboarding, a camel ride, an overnight camp under the stars, or simply a quiet walk among the dunes. The dunes change colour through the day and are at their most magical at sunrise and sunset, when the light is soft and the temperatures are bearable." },
      { h2: 'Self-drive or book a tour', body: "If you have a capable 4x4 and the skills, self-driving the dunes is hugely rewarding — but it demands experience, the right recovery gear and never going alone. If you are new to it, a guided tour or experience is the safer, easier option: someone else handles the driving and logistics, and you just enjoy the ride. Many of the dune areas in this guide work for both approaches." },
      { h2: 'Dune-driving safety', body: "Soft sand is unforgiving of mistakes. Lower your tyre pressures, keep momentum, travel in a convoy of at least two vehicles, and carry a tow rope, recovery boards and a way to re-inflate before tarmac. Tell someone your plans, carry plenty of water, and avoid the dunes in the heat of summer. If you are not confident, do not go alone — book a guide instead." },
      { h2: 'Best season for the desert', body: "October to April is the season for the desert — comfortable by day and cool, sometimes cold, at night. Summer brings extreme heat that makes desert trips genuinely dangerous, so plan dune adventures for the cooler months and still carry far more water than you expect to need." }
    ],
    faqs: [
      ['Where are the best dunes in the UAE?', 'The Liwa area in Abu Dhabi has the tallest, most dramatic dunes, while spots like Big Red and the desert near the cities are more accessible. This guide lists the best dune locations with access and safety notes.'],
      ['Should I self-drive the dunes or book a tour?', 'If you are experienced, have a 4x4 with recovery gear and travel in a convoy, self-driving is rewarding. If you are new, book a guided safari — it is safer and handles the driving for you.'],
      ['Is a desert safari safe?', 'Yes, with preparation or a reputable guide. For self-drive, lower tyre pressures, travel in a convoy, carry recovery gear and water, and never go alone. Avoid the summer heat.'],
      ['When is the best time for a desert safari?', 'October to April, when daytime temperatures are comfortable and nights are cool. Avoid the extreme summer heat.']
    ]
  },
  {
    slug: 'family-friendly-outdoors', h1: 'Family-Friendly Outdoor Spots Near Dubai',
    title: 'Family-Friendly Outdoor Spots in the UAE — Easy Days Out | Sahra & Beyond',
    desc: 'The best family-friendly outdoor spots in the UAE — easy, safe places for a day out with kids, from calm lakes to gentle beaches, with tips.',
    pick: ['love-lake', 'crescent-moon-lake', 'snoopy-island', 'sir-bani-yas-island', 'big-red'].map(id => locations.find(l => l.id === id)).filter(Boolean),
    intro: "Getting kids outdoors in the UAE is easier than it looks — you just need spots that are safe, accessible and genuinely fun for all ages. This guide gathers the gentlest, most family-friendly places we love, from calm desert lakes and easy beaches to wildlife and dunes that little ones will remember.\n\nEach has access notes and the best season, so you can plan a relaxed day out without the stress.",
    sections: [
      { h2: 'Choosing a spot for kids', body: "Look for easy access (firm ground you can reach without serious off-roading), shade, and something to do — water to paddle in, wildlife to spot, or gentle dunes to roll down. The calm lakes and accessible beaches in our picks are ideal first outings, while a short, easy desert visit makes a great introduction to camping without committing to a night out." },
      { h2: 'Keeping it safe and comfortable', body: "Sun and heat are the main things to manage. Bring hats, high-SPF sunscreen, plenty of water and snacks, and go in the cooler part of the day. Keep a close eye on children near water and in the desert, where it is easy to wander. A small first-aid kit and a fully charged phone are sensible additions to any family day out." },
      { h2: 'What to pack for a family day out', body: "Water (more than you think), sun protection, snacks, wet wipes, a change of clothes, a picnic blanket and a rubbish bag for the way home. For beaches add towels and reef-safe sunscreen; for the desert add closed shoes and a light layer for later in the day. Each location page has a tailored checklist you can adjust." },
      { h2: 'Best season for family trips', body: "October to April is the sweet spot — comfortable temperatures for kids and adults alike. In summer, stick to early mornings, shaded spots and water-based outings, and keep trips short to avoid the heat." }
    ],
    faqs: [
      ['What are the best outdoor activities for kids in the UAE?', 'Calm desert lakes for paddling, gentle beaches for a first snorkel, wildlife spotting and easy dune visits are all great for families. This guide lists safe, accessible spots near Dubai and beyond.'],
      ['Are these spots safe for young children?', 'The picks here are chosen for easy access and a gentle experience, but always supervise children near water and in the desert, manage sun and heat, and carry water and a first-aid kit.'],
      ['When is the best time for a family day out?', 'October to April for comfortable temperatures. In summer, go early in the day, choose shaded or water-based spots and keep outings short.'],
      ['Do I need a 4x4 for family outdoor trips?', 'Not for most of these. The lakes, beaches and accessible spots can be reached without serious off-roading. Always check the access notes on each location page first.']
    ]
  },
  {
    slug: 'outdoor-things-to-do', h1: 'Outdoor Things to Do in the UAE This Weekend',
    title: 'Outdoor Things to Do in the UAE — Weekend Adventure Ideas | Sahra & Beyond',
    desc: 'Outdoor things to do in the UAE this weekend — camping, wadis, beaches, dunes and mountains, with the best spots, seasons and tips for residents.',
    pick: ['big-red', 'wadi-naqab', 'jebel-hafeet', 'snoopy-island', 'crescent-moon-lake'].map(id => locations.find(l => l.id === id)).filter(Boolean),
    intro: "Stuck for ideas this weekend? The UAE's outdoors offer far more than most people realise — desert camping, wadi swims, mountain hikes, reef snorkeling and golden dunes, all within a couple of hours of the cities. This guide is a quick-start menu of the best outdoor things to do, whatever kind of day you are after.\n\nPick a vibe below, then dive into the full guide or location page for GPS, the best season and what to bring.",
    sections: [
      { h2: 'For a first-time adventure', body: "If you are easing into the outdoors, start gentle: a calm desert lake for an easy camp or picnic, an accessible beach for a first snorkel, or a short scenic drive into the mountains. These give you the scenery and the experience without demanding off-road skills or a big commitment." },
      { h2: 'For a cooler-weather day', body: "When the weather is kind, this is prime time for the bigger trips: a wadi hike to a swimmable pool, a proper mountain hike with views, or a night of desert camping under the stars. The cooler months unlock the full range of what the UAE outdoors has to offer." },
      { h2: 'For a weekend with friends', body: "Make a weekend of it: dune driving or a desert safari by day and a camp by night, a wadi-and-mountain combo, or a coast trip with snorkeling and a beach camp. Travel in a group for the dune and remote trips, share the gear, and plan around the season and the weather." },
      { h2: 'Planning your trip', body: "Whatever you choose, the basics are the same: check the weather, carry plenty of water, tell someone your plans, download offline maps and pack out all your rubbish. Every location and guide on this site includes GPS, the best season, a difficulty rating and a tailored packing list to make planning easy." }
    ],
    faqs: [
      ['What outdoor activities can you do in the UAE?', 'Plenty — desert camping, dune driving and safaris, wadi hikes and swims, mountain hiking, beach days and reef snorkeling, and stargazing, all within a couple of hours of the cities.'],
      ['What can I do outdoors in the UAE this weekend?', 'Pick by mood: an easy lake or beach day for a gentle outing, a wadi or mountain hike in cooler weather, or a desert camp and dune drive for a bigger weekend. This guide links to the best spots for each.'],
      ['When is the best season for outdoor activities in the UAE?', 'October to April offers the most comfortable conditions for camping, hiking and the desert. Summer suits early-morning beach and water trips to avoid the heat.'],
      ['Do I need special gear to start?', 'Not to begin. Gentle lakes, beaches and viewpoints need little more than water, sun protection and good shoes. Bigger desert and mountain trips need more kit — each page has a tailored checklist.']
    ]
  },
  {
    slug: 'fujairah-beaches', related: [["/snorkeling/", "Snorkeling in the UAE", "Reefs you can reach from shore"], ["/best-beaches/", "Best beaches in the UAE", "The country side by side"]],
    h1: 'Fujairah Beaches: A Field Guide to the East Coast',
    title: 'Fujairah Beaches: Swimming & Snorkeling Guide | Sahra & Beyond',
    desc: 'Fujairah beaches from Dibba to Kalba: where to swim, how to snorkel Snoopy Island and Dibba Rock, drive times from Dubai, seasons and water safety.',
    pick: ['dibba', 'snoopy-island', 'khor-fakkan-beach'].map(id => locations.find(l => l.id === id)).filter(Boolean),
    intro: "Fujairah's coast faces the Gulf of Oman, with the Hajar Mountains rising close behind the shore. Its beaches run from the villages around Dibba in the north, through Al Aqah, to Fujairah city and the coast beyond. Most are free public beaches, a few are backed by resorts that sell day passes, and two of the best-known places for snorkelling are reached from the sand or by a short boat ride.\n\nThis guide sorts the coast by area and says which beaches are in Fujairah and which are not. Exact camping rules and road numbers vary between sources, so check locally.\n\nThe three picks above are a good starting set: Dibba Rock for a boat-trip snorkel, Snoopy Island for a swim-out snorkel from Al Aqah beach, and Khor Fakkan, which sits on the same coast but belongs to Sharjah, not Fujairah.",
    sections: [
      { h2: 'How the east coast differs from the Gulf coast', body: "Fujairah City is the only emirate capital on the UAE's east coast, and it sits at the foot of the Hajar Mountains. Dibba Al-Fujairah is described as a group of small villages between the mountains and the sea. The shore is mountain-backed, with offshore rock outcrops such as Snoopy Island and Dibba Rock and, in places, reef within reach of the beach.\n\nThe coast is also not one emirate's alone. Khor Fakkan is an exclave of Sharjah, surrounded by Fujairah territory. Kalba is another Sharjah exclave on the same coast. Dibba is divided three ways, between Fujairah (Dibba Al-Fujairah), Sharjah (Dibba Al-Hisn) and Oman (Dibba Al-Baya). On a map the shoreline reads as one continuous strip, but the emirate can change within a short drive, which matters when you are checking local rules or booking a boat. Several online beach lists file Khor Fakkan under Fujairah, so it is worth knowing which jurisdiction you are standing in." },
      { h2: 'Dibba and Al Aqah: the northern beaches', body: "Dibba Al-Fujairah is described as a tourism area with sandy beaches and hotels. A Bayut list of Fujairah beaches gives Dibba Beach as a free public beach with calm water, space for a picnic or barbecue and a designated camping area. Nemo Diving Center describes the sand there as golden and mentions dhow trips along the coast.\n\nAl Aqah lies about 45 km north of Fujairah city, according to Bayut, and is the access point for Snoopy Island. Bayut lists Al Aqah Beach as a free public beach with water sports, a camping site and bonfires, and Nemo describes white sand, shallow water and views of the Hajar Mountains. A beachfront resort next to Snoopy Island sells optional day passes with toilets, food and gear hire, as our Snoopy Island page notes.\n\nNeither source gives camping rules or fees, so treat the camping areas as listed rather than confirmed, and read the signs on arrival. Dibba Rock is not a beach: it lies offshore and is reached by boat from the Dibba and Al Aqah coast." },
      { h2: 'Fujairah city, Kalba and Khor Fakkan', body: "Around Fujairah city, Bayut lists Murbah, Luluyah, Qidfa and Sambraid among the free public beaches, and Nemo lists a Fujairah Public Beach used for swimming and snorkelling. Their exact positions are not independently verified, so check a current map before you set out. Umbrella Beach appears in both lists as a family-oriented beach: Bayut notes shallow water, and both mention food trucks and children's play areas.\n\nKalba is a Sharjah exclave, not part of Fujairah. Its notable natural feature is Khor Kalba, a mangrove swamp and nature reserve south of the town near the Omani border, which Wikipedia says is open to the public and developed for eco-tourism. A Kalba Beach Corniche project began in April 2021, adding a running track, seating and planting.\n\nKhor Fakkan is also a Sharjah exclave. Wikipedia describes its beach as white sand with coral reefs, and Bayut lists it as a free public beach. A separate Sahra & Beyond page covers Khor Fakkan Beach, and it is the one pick in this guide that is on the Fujairah coast without being in Fujairah." },
      { h2: 'Snorkelling and diving: Snoopy Island and Dibba Rock', body: "Snoopy Island is the usual shore snorkel. Nemo gives it as 150 to 200 metres offshore from Al Aqah beach, with typical depths of 5 to 15 metres and visibility of 10 to 20 metres. Turtles, parrotfish and blacktip reef sharks are listed among the sightings. Our Snoopy Island page explains the crossing: you can wade, swim or paddle, but at high tide it is open water with real current, so weaker swimmers and children are safer on a kayak or paddleboard.\n\nDibba Rock needs a boat. Nemo describes a small rocky island with sloping sides covered in soft and boulder corals, a maximum depth of about 30 metres and shallow reef that suits snorkellers, with green turtles often seen. It also warns of strong currents and thermoclines, and says sleeping turtles must not be disturbed, as a startled turtle can drown.\n\nTripXL also lists Sharm Rock and Martini Rock near Al Aqah and Hole in the Wall near Dibba as further offshore sites. These are tour and dive-centre trips rather than walk-in spots, so check operators and prices before booking." },
      { h2: 'Getting there from Dubai', body: "A family-travel guide to the drive lists three main routes. To Fujairah city it gives about 1 hour 20 minutes from Downtown Dubai, via the E611, E102 and E84. To Al Aqah it gives about 1 hour 50 minutes by the mountain route through Masafi, via the E611 and E99. To Dibba it gives about 1 hour 50 minutes via the E611, Al Shohadaa Road (E87) and E89. Bayut puts Al Aqah at about two hours from Dubai along the E611. Our Dibba Rock and Snoopy Island pages use the range of 1h30 to 2h.\n\nRoad numbers vary between sources, so rely on live navigation rather than the numbers alone. Wikipedia notes that the Sheikh Khalifa Bin Zayed Expressway links Fujairah city with Dubai, passing through the mountains inland of the city.\n\nTraffic is the main variable: the same guide warns of substantial delays on Thursday evenings before the weekend and before public holidays. Without a car, an intercity bus serves Fujairah city, but the northern beaches at Al Aqah and Dibba are realistically reached by car, taxi or a tour that includes transport." },
      { h2: 'Seasons, water and safety', body: "Wikipedia gives Fujairah summer highs of around 41 degrees Celsius and winter averages of around 25, with most of its rain between December and March. Nemo rates October to May as the clearest, coolest period for snorkelling. For diving, it describes winter, December to March, as having some of the best visibility of the year. In summer the water is warmest, but plankton reduces visibility. Nemo gives Snoopy Island water temperatures of about 22 degrees in winter and 30 in summer.\n\nOn safety, Fujairah Police advised in July 2026 that children should swim only in designated areas, should never be left unattended near water, and that families should follow the safety instructions at beaches. No Fujairah-specific warning about rip currents or jellyfish is sourced here, so none is given. Check flags and signs on the day.\n\nThe UAE emergency numbers are police 999, ambulance 998, fire 997 and coastguard 996. As our Snoopy Island page notes, do not touch or stand on coral." }
    ],
    faqs: [
      ['Are Fujairah beaches free?', 'Bayut lists Dibba, Al Aqah, Umbrella Beach and several others around Fujairah city as free public beaches. Resort beaches are different: a resort beside Snoopy Island sells day passes with facilities and gear hire, so check before you go.'],
      ['Where is the best place for snorkeling in Fujairah?', 'Snoopy Island, off Al Aqah beach, is the usual shore snorkel and is reached by wading, swimming or paddling. Dibba Rock is a boat trip arranged with a dive centre or hotel. Nemo rates October to May as the clearest, coolest period.'],
      ['How far are Fujairah beaches from Dubai?', 'A family-travel guide gives about 1 hour 20 minutes to Fujairah city and about 1 hour 50 minutes to Al Aqah or Dibba. Bayut says about two hours to Al Aqah. Expect delays on Thursday evenings and before public holidays.'],
      ['Is Khor Fakkan in Fujairah?', 'No. Khor Fakkan is an exclave of Sharjah, surrounded by Fujairah territory on the east coast. Kalba is also a Sharjah exclave, and Dibba is split between Fujairah, Sharjah and Oman.'],
      ['When is the best time to visit?', 'Nemo rates October to May as the clearest, coolest conditions for snorkelling, with winter visibility among the best of the year for diving. Summer water is warmest, but plankton reduces visibility and the air is hot.'],
      ['Can I camp on Fujairah beaches?', 'Bayut lists camping areas at Dibba Beach and Al Aqah Beach, but gives no rules or fees. Check signs and local guidance on arrival rather than assuming that camping is allowed everywhere.'],
      ['Is it safe to swim at Fujairah beaches?', 'Fujairah Police advise swimming only in designated areas, supervising children constantly and following beach safety instructions. At Snoopy Island the swim out can cross real current at high tide. Emergency numbers are police 999, ambulance 998, fire 997 and coastguard 996.']
    ],
    sources: [
      ['Wikipedia: Fujairah', 'https://en.wikipedia.org/wiki/Fujairah'],
      ['Wikipedia: Khor Fakkan', 'https://en.wikipedia.org/wiki/Khor_Fakkan'],
      ['Wikipedia: Kalba', 'https://en.wikipedia.org/wiki/Kalba,_United_Arab_Emirates'],
      ['Wikipedia: Dibba', 'https://en.wikipedia.org/wiki/Dibba'],
      ['MyBayut: Best beaches in Fujairah', 'https://www.bayut.com/mybayut/beaches-fujairah-list/'],
      ['Nemo Diving Center: Top Fujairah beaches', 'https://nemodivingcenter.com/blog/explore-top-fujairah-beaches-relax-explore-dive/'],
      ['Nemo Diving Center: Best time to dive Fujairah', 'https://nemodivingcenter.com/blog/best-time-to-dive-fujairah/'],
      ['Nemo Diving Center: Dibba Rock dive site', 'https://nemodivingcenter.com/other-diving-sites/dibba-rock-in-fujairah/'],
      ['TripXL: Fujairah snorkelling guide', 'https://tripxl.com/blog/fujairah-snorkeling/'],
      ['Family Travel Middle East: Dubai to Fujairah', 'https://www.familytravel-middleeast.com/dubai-to-fujairah/'],
      ['Khaleej Times: Fujairah Police water safety advice', 'https://www.khaleejtimes.com/uae/fujairah-police-parents-children-safe-water-summer'],
      ['Visit Ras Al Khaimah: UAE emergency numbers', 'https://visitrasalkhaimah.com/blog/what-are-the-emergency-services-numbers-in-uae-police-ambulance-fire-coastguard/']
    ]
  },
  {
    slug: 'hiking', related: [["/wadis/", "Wadis in the UAE", "Ten wadis compared"], ["/mountain-escapes/", "Mountain escapes", "Cooler air in the Hajar"], ["/trail/hikes/", "UAE hikes by grade", "Eleven routes, each with its sources"]],
    h1: 'Hiking in the UAE: Trails in Dubai, RAK & Fujairah',
    title: 'Hiking in the UAE: Trails in Dubai, RAK & Fujairah',
    desc: 'Hiking in the UAE: trails at Jebel Jais, Wadi Naqab, Wadi Shawka, Hatta and Al Rafisah, with the season, heat and water, flash-flood warnings and rules.',
    pick: locations.filter(l => l.category === 'Mountains' || l.category === 'Wadis'),
    intro: "Hiking in the UAE means the Hajar Mountains. The range runs through the northern emirates of Ras Al Khaimah, Sharjah and Fujairah and on into Oman, and almost every marked trail in the country sits on its flanks, in its wadis or around its dams. Dubai has a foothold in the range too, at Hatta. The deserts and beaches are not hiking country in the same sense.\n\nThis guide lays out where the trails are by emirate, when the season runs, how to handle heat and water, what the flash-flood warnings mean, and which places have permits or rules. Trail lengths and times are the figures published by the operators and tourism bodies named at the foot of the page. Conditions in the mountains change after rain and between seasons, so check current status before you set out.\n\nThe places picked out below are the mountain and wadi guides on this site, each with GPS, access notes and a packing list. Read the sections on heat and flash floods first. They apply to every route here.",
    sections: [
      { h2: 'Ras Al Khaimah: Jebel Jais, Jebel Yanas, Wadi Naqab and Wadi Shawka', body: "Ras Al Khaimah has the widest choice. Visit Ras Al Khaimah describes six trails on Jebel Jais with a combined length of 16km. The Bear Grylls Explorers Camp lists guided routes from the 2.5km Upper Shepherd Walk (about two hours, beginner) to the 9.6km Hidden Oasis Loop (five to six hours, experienced hikers), and states that a guide is not required. Jebel Jais was reported closed for seasonal maintenance in September 2026; check visitjebeljais.com before going. An 80km Grand Loop is planned, with work due to begin in January, and trail rehabilitation between Wadi Khammed and Hidden Oasis was reported in September 2026. Wadi Shawka has beginner loops of 3 to 5km (1.5 to 2 hours) and longer routes of up to six hours or more over loose shale. Wadi Naqab is a harder day: the Red Wall route takes about six hours and the route to Sheri and Baqal villages about twelve, both exposed in places and about two hours from Dubai. Jebel Yanas is reached by the Wadi Naqab road and a checkpoint; the Jebel Yanas guide on this site notes that the unpaved climb is harder than the ridge walk, and that a 4x4 is strongly preferred." },
      { h2: 'Hatta, Sharjah and Fujairah', body: "Hatta, Dubai's mountain exclave, has the Hatta Wadi Hub, where the operator lists five graded hiking routes totalling 32.6km, running seasonally. Its guidance is simple: tell a friend or family member where you intend to hike, carry a trail map and the right equipment, keep your phone fully charged and follow the signage. In Sharjah, Al Rafisah Dam above Khor Fakkan is free to enter and has two trails, about 1km (paved, easy and family-friendly) and about 3.5km (a moderate climb into the Hajar with views of the lake and coast), according to ComfortDrive. The same source notes that swimming is not permitted in the reservoir. In Fujairah, Wadi Wurayah is not a walk-up wadi. Khaleej Times reported in July 2026 that it has been open through controlled group visits since January 2026, with visitors registering for an organised tour run by Fujairah Holidays, from AED 300 a person, on Saturdays, with limited places. Reports describe the tour season only loosely, so confirm dates with the operator before planning a trip around it." },
      { h2: 'The hiking season, heat and water', body: "Visit Ras Al Khaimah gives October to April as the best time of year for hiking and does not recommend summer hikes because of the heat; Wadi Shawka is usually put at November to April. Altitude helps but does not remove the problem: Visit Ras Al Khaimah gives daytime averages at the Jebel Jais peak of around 31°C in summer, against 35 to 38°C elsewhere in the emirate. In August 2026 the UAE Ministry of Health and Prevention advised drinking water regularly, even when not thirsty, and postponing demanding exercise in the hottest hours of the day, after the country recorded 51.2°C on 5 August. There is no single UAE figure for water. Visit Jebel Jais asks for at least three litres per person on its trails; carry more for longer or hotter routes." },
      { h2: 'Flash floods and weather warnings', body: "Wadis are flood channels. Visit Ras Al Khaimah warns that Wadi Naqab can fill with water quickly and says never to attempt the hike when rain is expected; hiking after rainfall is described as too dangerous. Visit Ras Al Khaimah makes the same point for Wadi Shawka, where wadis risk flash floods in heavy rain. During the storms of March 2026 the National Centre of Meteorology (NCM) issued a flash flood warning for mountain areas, and Sharjah Police told people to stay away from valleys, dams and water accumulation because levels can rise rapidly, while Ras Al Khaimah Police advised staying away from flood channels during active flow. Check NCM forecasts and warnings before you leave and again that morning, and postpone if rain or an NCM warning covers the mountains. Activities on Jebel Jais can close in extreme weather, and visibility drops in heavy fog or rain. For an emergency, call 999 (police), 998 (ambulance) or 997 (civil defence)." },
      { h2: 'Permits and rules', body: "Most trails here need no permit, but several have conditions. At Wadi Naqab, individuals need no permit, but groups of ten or more should contact Ras Al Khaimah's tourism authority in advance. On Jebel Jais, the trail operator asks that groups be limited to ten unless registered in advance with the Ras Al Khaimah Tourism Development Authority (RAKTDA), and the Jebel Jais FAQ says barbecuing is not permitted in open areas, with designated picnic spots at Jais Viewing Deck Park. Wadi Wurayah is by organised tour only. Wadi Shawka is free to enter, and Visit Ras Al Khaimah describes it as a popular free wild-camping spot, with flat ground near the trails and the dam and no official campsite facilities. Visit Ras Al Khaimah asks hikers to leave their route details with a trusted person. Rules, fees and opening dates change with the season, so confirm them with the operator or the tourism authority for the emirate you are visiting." },
      { h2: 'What to wear and pack', body: "Kit advice from the sources is practical and consistent. Visit Ras Al Khaimah lists more water than you think you will need, light, breathable clothing, sunscreen, a hat and sunglasses, an extra layer for emergencies, and leaving your route details with a trusted person. Visit Jebel Jais adds sturdy shoes and, in winter, a jacket, as temperatures at altitude can drop sharply. Wadi Shawka's guidance asks for proper footwear and enough water, a charged phone and an early start, and Hatta Wadi Hub asks hikers to carry a trail map. Wadi Shawka's page also warns that the shale makes for uneven walking, so choose footwear for loose rock, not for the car park. A head torch, first-aid kit, snacks and a power bank or offline map are sensible additions for longer routes. Carry out all your rubbish." }
    ],
    faqs: [
      ['Where is the best hiking in the UAE?', 'Most marked mountain hiking is in the Hajar Mountains: Jebel Jais, Wadi Shawka and Wadi Naqab in Ras Al Khaimah, Al Rafisah Dam in Sharjah, Hatta in Dubai and, by organised tour, Wadi Wurayah in Fujairah. Which is best depends on your fitness and the season. Jebel Jais was reported closed for seasonal maintenance in September 2026; check visitjebeljais.com before going.'],
      ['Where can I go hiking near Dubai?', 'Hatta Wadi Hub in Dubai has five graded routes totalling 32.6km, according to its operator. Wadi Shawka in Ras Al Khaimah has beginner loops of 3 to 5km, and Wadi Naqab is about two hours from Dubai, though it is a much harder hike.'],
      ['When is the hiking season in the UAE?', 'October to April, according to Visit Ras Al Khaimah, which does not recommend summer hikes. Wadi Shawka is usually put at November to April.'],
      ['Do I need a permit to hike in the UAE?', 'Not for individuals on most trails. At Wadi Naqab, groups of ten or more should contact Ras Al Khaimah tourism authorities in advance, and Jebel Jais trail groups should be limited to ten unless registered with RAKTDA. Wadi Wurayah is by organised tour only.'],
      ['Can you visit Wadi Wurayah in Fujairah?', 'Only on an organised tour. Khaleej Times reported in July 2026 that the reserve has been open through controlled group visits since January 2026, booked through Fujairah Holidays from AED 300 a person, on Saturdays, with limited places. Confirm current dates with the operator.'],
      ['How much water should I carry hiking in the UAE?', 'There is no single UAE figure. Visit Jebel Jais asks for at least three litres per person on its trails. Carry more for longer or hotter routes.'],
      ['Is it safe to hike after rain?', 'No. Visit Ras Al Khaimah says hiking Wadi Naqab after rainfall is too dangerous, and wadis can fill quickly. Check NCM forecasts and warnings, and avoid wadi beds and flood channels when rain is expected. For an emergency, call 999, 998 or 997.']
    ],
    sources: [
      ['Visit Ras Al Khaimah: Wadi Naqab Hike', 'https://visitrasalkhaimah.com/blog/wadi-naqab-hike/'],
      ['Visit Ras Al Khaimah: Jebel Jais', 'https://visitrasalkhaimah.com/location/place/jebel-jais/'],
      ['Visit Ras Al Khaimah: Wadi Shawka', 'https://visitrasalkhaimah.com/location/place/wadi-shawka/'],
      ['Visit Jebel Jais: Hiking Trails', 'https://visitjebeljais.com/jais-hiking'],
      ['Visit Jebel Jais: FAQs', 'https://visitjebeljais.com/faqs'],
      ['The National: Jebel Jais Grand Loop (15 Sep 2026)', 'https://www.thenationalnews.com/news/uae/2026/09/15/ras-al-khaimah-jebel-jais-grand-loop-via-ferrata-hiking/'],
      ['Visit Hatta: Hiking', 'https://www.visithatta.com/en/play/hiking'],
      ['ComfortDrive: Al Rafisah Dam boating and hiking', 'https://www.comfortdrive.ae/al-rafisah-dam-boating-hiking/'],
      ['Khaleej Times: How to visit Wadi Wurayah (27 Jul 2026)', 'https://www.khaleejtimes.com/travel/uae-attractions/how-to-visit-wadi-wurayah-fujairah'],
      ['Khaleej Times: UAE summer heat exhaustion tips (7 Aug 2026)', 'https://www.khaleejtimes.com/uae/summer-tips-prevent-heat-exhaustion-soaring-temperatures'],
      ['Gulf News: UAE heavy rain safety advisories (23 Mar 2026)', 'https://gulfnews.com/uae/weather/heavy-rains-in-uae-live-weather-traffic-updates-and-safety-advisories-1.500483256']
    ]
  }
];

/* 1 Oct 2026: every place page links the guides whose picks include it (SEO handover item 2:
   no orphan guides, contextual links both ways). */
PLACE_CTX.guideBar = guideBar; PLACE_CTX.askBlock = askBlock;
PLACE_CTX.igFor = id => IG.railHtml(IG.forPlace(id), { title: 'From our Instagram' });
PLACE_CTX.guidesFor = id => LANDINGS.filter(L => Array.isArray(L.pick) && L.pick.some(x => x && x.id === id)).map(L => [`/${L.slug}/`, L.h1]);
locations.forEach(renderLocationPage);
if (!process.env.VERCEL) draftLocations.forEach(renderLocationPage);
else if (draftLocations.length) console.log('  – drafts held back: ' + draftLocations.map(l => l.id).join(', '));

const GUIDE_TEE = {
  stargazing: 'al-quaa-desert', camping: 'al-quaa-desert', 'camping-near-dubai': 'al-quaa-desert',
  'secluded-camping': 'al-quaa-desert', 'desert-camping-beginners': 'liwa', 'desert-safari': 'liwa',
  wadis: 'wadi-naqab', 'mountain-escapes': 'wadi-naqab', 'hatta-guide': 'wadi-naqab', hiking: 'wadi-naqab',
  'family-friendly-outdoors': 'liwa'
};
/* coast guides: no tee is drawn from the sea yet, so the closer asks instead of forcing a match */
const GUIDE_ASK = { 'best-beaches': 'the coast', snorkeling: 'Snoopy Island', 'fujairah-beaches': 'the Fujairah coast' };
/* the closer's first words, by guide (CRO panel, idea 3) */
const GUIDE_LEAD = { stargazing: 'Back from the dark?', camping: 'Back from camp?', 'camping-near-dubai': 'Back from camp?', 'secluded-camping': 'Back from camp?', 'desert-camping-beginners': 'Back from the dunes?', 'desert-safari': 'Back from the dunes?', wadis: 'Back from the wadi?', 'mountain-escapes': 'Back from the mountains?', 'hatta-guide': 'Back from Hatta?', hiking: 'After the hike?', 'family-friendly-outdoors': 'Back from the dunes?' };
LANDINGS.forEach(L => {
  const canonical = `${SITE}/${L.slug}/`;
  const jsonld = [
    {
      "@context": "https://schema.org", "@type": "CollectionPage",
      "name": L.h1, "description": L.desc, "url": canonical
    },
    {
      "@context": "https://schema.org", "@type": "ItemList",
      "itemListElement": L.pick.map((l, i) => ({ "@type": "ListItem", "position": i + 1, "name": l.name, "url": `${SITE}/locations/${l.id}/` }))
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/" },
        { "@type": "ListItem", "position": 2, "name": L.h1, "item": canonical }
      ]
    }
  ];
  if (Array.isArray(L.faqs) && L.faqs.length) {
    jsonld.push({
      "@context": "https://schema.org", "@type": "FAQPage",
      "mainEntity": L.faqs.map(q => ({ "@type": "Question", "name": q[0], "acceptedAnswer": { "@type": "Answer", "text": q[1] } }))
    });
  }
  const sectionsHtml = Array.isArray(L.sections)
    ? L.sections.filter(s => !s.until || new Date().toISOString().slice(0, 10) <= s.until).map(s => `<section class="guide-sec"${s.id ? ` id="${esc(s.id)}"` : ''}${s.until ? ` data-until="${esc(s.until)}"` : ''}><h2>${esc(s.h2)}</h2><div class="content">${paras(s.body)}</div>${PLACES.tableHtml(s.table)}${s.after ? paras(s.after) : ''}</section>`).join('')
    : '';
  const faqHtml = (Array.isArray(L.faqs) && L.faqs.length)
    ? `<section class="faq"><h2>Frequently asked questions</h2>${L.faqs.map(q => `<details><summary>${esc(q[0])}</summary><p>${esc(q[1])}</p></details>`).join('')}</section>`
    : '';
  // derive brand hero styling from the guide's topic
  const HUB = {
    camping:{c:'Camping',e:'⛺'}, 'secluded-camping':{c:'Camping',e:'🌙'}, 'camping-near-dubai':{c:'Camping',e:'⛺'},
    'desert-camping-beginners':{c:'Dunes',e:'🏜️'}, 'desert-safari':{c:'Dunes',e:'🏜️'},
    snorkeling:{c:'Coast',e:'🐠'}, 'best-beaches':{c:'Coast',e:'🏖️'},
    stargazing:{c:'Camping',e:'🌌'}, wadis:{c:'Wadis',e:'🏞️'},
    'mountain-escapes':{c:'Mountains',e:'⛰️'}, 'hatta-guide':{c:'Mountains',e:'🏕️'},
    'family-friendly-outdoors':{c:'Camping',e:'🌅'}, 'outdoor-things-to-do':{c:'Dunes',e:'🧭'},
    'fujairah-beaches':{c:'Coast',e:'🌊'}, hiking:{c:'Mountains',e:'⛰️'}
  };
  const hub = HUB[L.slug] || { c: 'Dunes', e: '🗺️' };
  const body = `
  <section class="loc-hero" style="--hero-grad:${CAT_BG[hub.c]}">
    <div class="glow"></div><svg class="dune-far" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true"><path fill="#8B4E63" d="M0,220 C300,150 560,250 820,200 C1080,150 1300,220 1440,190 L1440,320 L0,320 Z"/></svg><svg class="dune-near" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true"><path fill="#3A241C" d="M0,270 C320,210 620,290 940,250 C1180,220 1330,270 1440,255 L1440,320 L0,320 Z"/></svg><div class="grain"></div><div class="loc-hero-inner">
      <nav class="crumbs"><a href="/">Home</a> &rsaquo; <span>${esc(L.h1)}</span></nav>
      <div class="loc-emoji">${hub.e}</div>
      <h1>${esc(L.h1)}</h1>
      <p class="lede">Inspired by the landscapes of the UAE &mdash; wear the wild side of it</p>
    </div>
  </section>
  <main>
    ${miniTee(GUIDE_TEE[L.slug])}
    <div class="content">${withProductLink(paras(L.intro), L.productLink)}</div>
    ${L.pick.length ? `<h2>Our top picks</h2><div class="cards">${L.pick.map(locCard).join('')}</div>` : ''}
    ${L.compare && L.pick.length ? `<section class="guide-sec"><h2>The beaches side by side</h2><div class="cmp-wrap" style="overflow-x:auto"><table class="cmp" style="border-collapse:collapse;width:100%;min-width:560px;font-size:14px"><thead><tr>${['Beach', 'Emirate', 'Sea', 'Getting there', 'Toilets', 'Best months'].map(h => `<th style="text-align:left;padding:8px 10px;border-bottom:2px solid rgba(42,32,22,.2)">${h}</th>`).join('')}</tr></thead><tbody>${L.pick.map(l => { const a = (l.access || {}).vehicle, f = (l.facilities || {}).toilets; const V = { '2wd': 'Any car', '4wd': '4x4', boat: 'Boat', 'on-foot': 'Car, then on foot', 'high-clearance': 'High-clearance car' }; const T = { yes: 'Yes', no: 'No', some: 'Some', nearby: 'Nearby' }; return `<tr>${[`<a href="/locations/${l.id}/">${esc(l.name)}</a>`, esc(l.emirate), Number(l.lng) > 56.2 ? 'Gulf of Oman' : 'Arabian Gulf', V[a] || 'See guide', T[f] || 'Not confirmed', esc(l.season || '')].map(c => `<td style="padding:8px 10px;border-bottom:1px solid rgba(42,32,22,.1)">${c}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div><p style="font-size:13px;opacity:.8">Taken from each beach's guide; open a guide for the detail and its sources.</p></section>` : ''}
    ${sectionsHtml}
    ${IG.railHtml(IG.forGuide('/' + L.slug + '/'), { title: 'From our Instagram' })}
    ${Array.isArray(L.related) && L.related.length ? `<section class="guide-sec"><h2>Related guides</h2><nav class="catnav" aria-label="Related guides">${L.related.map(r => `<a href="${r[0]}"><b>${esc(r[1])}</b><span>${esc(r[2] || '')}</span></a>`).join('')}</nav></section>` : ''}
    ${faqHtml}
    ${Array.isArray(L.sources) && L.sources.length ? `<section class="guide-sec guide-src"><h2>Sources</h2><ul>${L.sources.map(r => `<li><a href="${esc(r[1])}" target="_blank" rel="noopener nofollow">${esc(r[0])}</a></li>`).join('')}</ul></section>` : ''}
    ${GUIDE_TEE[L.slug] ? teeFor(GUIDE_TEE[L.slug], L.h1, GUIDE_LEAD[L.slug]) : (GUIDE_ASK[L.slug] ? askBlock(GUIDE_ASK[L.slug], 'Coast') + collectionBlock(null) : collectionBlock(null))}
    ${guideBar(GUIDE_TEE[L.slug] ? PRODUCT_BY_PLACE[GUIDE_TEE[L.slug]] : null)}
    ${newsletterBlock()}
    <p class="back"><a href="/">Back to Sahra &amp; Beyond &rarr;</a></p>
  </main>`;
  write(`${L.slug}/index.html`, shell({ title: L.title, desc: L.desc, canonical, jsonld, bodyHtml: body }));
});

// The three ways to reach us, shared by /contact/ and the foot of /about/ so the
// two can never disagree (Faheem, 14 Sep: contact info at the bottom of About too).
const WA_URL = 'https://wa.me/971585449946';
function contactWays() {
  return `<div class="ct-ways">
      <a class="ct-way" href="${WA_URL}" target="_blank" rel="noopener">
        <span class="ct-lab">WhatsApp &middot; fastest</span>
        <span class="ct-val">+971 58 544 9946</span>
        <span class="ct-sub">Usually the same day</span>
      </a>
      <a class="ct-way" href="mailto:hello@sahraandbeyond.ae">
        <span class="ct-lab">Email</span>
        <span class="ct-val ct-val-em">hello@sahraandbeyond.ae</span>
        <span class="ct-sub">Within one working day</span>
      </a>
      <a class="ct-way" href="tel:+971585449946">
        <span class="ct-lab">Phone</span>
        <span class="ct-val">+971 58 544 9946</span>
        <span class="ct-sub">UAE business hours</span>
      </a>
    </div>`;
}

// ---- About page ----
// Rewritten 14 Sep for the apparel brand (Faheem): the old copy still told the
// outdoor-guide story - interactive map, packing lists, live weather, an Android
// app. Every product fact below traces to MASTER_BRIEF / the live product pages:
// 230 gsm tees, 240 gsm pique polo, DTG on Al Quaa + Hajar, embroidery on Empty
// Quarter + polo, printed collar labels, forty per design, the three
// places with their coordinates. Nothing about origin of manufacture is claimed.
// Coordinates live on the PRODUCT PAGES, not the garments: only the Hajar tee prints
// them (brief section 3, Decision Log 1 Sep) - so the copy never says a tee "carries" them.
(function () {
  const MARK = require('./mark-paths.js');
  const canonical = `${SITE}/about/`;
  const title = 'About Sahra & Beyond — Wear the Wild Side of the UAE';
  const desc = 'The story behind Sahra & Beyond — a UAE apparel brand built around real places: a dark-sky desert, the first dunes of the Empty Quarter, a red-rock wadi in the Hajar. Heavyweight cotton, printed and embroidered designs, a limited first run.';
  const sameAs = [social.instagram, social.tiktok, social.youtube].filter(Boolean);
  const jsonld = [
    { "@context": "https://schema.org", "@type": "AboutPage", "name": title, "description": desc, "url": canonical },
    { "@context": "https://schema.org", "@type": "Organization", "@id": SITE + "/#organization", "name": "Sahra & Beyond", "alternateName": ["Sahra and Beyond", "Sahra Beyond"], "legalName": "SAHRA AND BEYOND FZE LLC", "url": SITE + "/", "logo": SITE + "/icon-512.png", "slogan": TAGLINE, "email": "hello@sahraandbeyond.ae", "telephone": "+971585449946", "sameAs": sameAs },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/" },
      { "@type": "ListItem", "position": 2, "name": "About", "item": canonical }
    ] }
  ];
  const L = MARK.layers;
  /* mask rects: full height, wider than the ridge by a tail so the gradient's soft
     edge has somewhere to go; they start translated fully off to the left */
  const wipe = (id, layer, dur, delay) => {
    const w = layer.w + 320, x = layer.x - 20;
    return `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="2853" height="1258"><rect class="ab-wipe" style="--from:-${w}px;--dur:${dur}s;--delay:${delay}s" x="${x}" y="0" width="${w}" height="1258" fill="url(#abEdge)"/></mask>`;
  };
  const markSvg = `<svg viewBox="40 30 2780 1190" role="img" aria-label="The Sahra &amp; Beyond mark: three dune ridges under a rising sun, with صحراء beneath" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="abEdge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff"/><stop offset=".84" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <radialGradient id="abGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#F3BE78" stop-opacity=".85"/><stop offset=".38" stop-color="#F3BE78" stop-opacity=".22"/><stop offset="1" stop-color="#F3BE78" stop-opacity="0"/></radialGradient>
      ${wipe('abMA', L.ridgeA, 1.7, 0.25)}
      ${wipe('abMB', L.ridgeB, 1.5, 1.0)}
    </defs>
    <circle class="ab-glow" cx="${L.sun.cx}" cy="${L.sun.cy}" r="560" fill="url(#abGlow)"/>
    <g class="ab-sun"><path class="ab-ink" d="${L.sun.d}"/></g>
    <g mask="url(#abMA)"><path class="ab-ink" d="${L.ridgeA.d}"/></g>
    <g mask="url(#abMB)"><path class="ab-ink" d="${L.ridgeB.d}"/></g>
    <g class="ab-arabic"><path class="ab-ink" fill-rule="evenodd" d="${L.arabic.d}"/></g>
  </svg>`;
  const places = [
    { name: 'Al Quaa', emirate: 'Abu Dhabi', gps: '23.529° N · 54.753° E', blurb: 'One of the darkest accessible skies in the Emirates. Far enough south that no city glow reaches it — on a clear night the Milky Way throws a shadow.', href: '/products/al-quaa-galaxy-regular/', tee: 'Al Quaa Galaxy', img: '/assets/places/alquaa.jpg', alt: 'The Milky Way over the dunes at Al Quaa' },
    { name: 'Liwa', emirate: 'Abu Dhabi', gps: '23.134° N · 53.779° E', blurb: 'Where the Empty Quarter begins. Some of the largest dunes on earth; at sunset the ridges turn gold and the whole horizon goes quiet.', href: '/products/empty-quarter-regular/', tee: 'Empty Quarter', img: '/assets/places/liwa.jpg', alt: 'The sun setting over the dunes of Liwa' },
    { name: 'Wadi Naqab', emirate: 'Ras Al Khaimah', gps: '25.699° N · 56.005° E', blurb: 'Red-rock walls and terraced pools high in the Hajar, below Jebel Yanas — the range that gives the northern Emirates their skyline.', href: '/products/hajar-mountains-regular/', tee: 'Hajar Mountains', img: '/assets/places/wadi-naqab.jpg', alt: 'Red rock peaks above Wadi Naqab in the Hajar Mountains' }
  ];
  /* Faheem, 14 Sep: flat gradients "look like the background didn't load" - the cards
     carry the same three landscape plates the homepage journey uses (journey/plates/),
     cropped to the card. */
  const placeCards = places.map(p => `<a class="ab-place" href="${p.href}">
        <img class="ab-place-img" src="${p.img}" alt="${esc(p.alt)}" loading="lazy" decoding="async" width="900" height="1080">
        <span class="ab-place-meta">${esc(p.emirate)} &middot; ${esc(p.gps)}</span>
        <span class="ab-place-name">${esc(p.name)}</span>
        <span class="ab-place-blurb">${esc(p.blurb)}</span>
        <span class="ab-place-go">The ${esc(p.tee)} tee &rarr;</span>
      </a>`).join('\n      ');
  const body = `
  <section class="ab-hero">
    <div class="ab-sky"></div><div class="ab-dawn"></div><div class="ab-stars"></div><div class="ab-haze"></div><div class="ab-grain"></div>
    <div class="ab-hero-inner">
      <nav class="crumbs ab-copy c1"><a href="/">Home</a> &rsaquo; <span>About</span></nav>
      <div class="ab-mark">${markSvg}</div>
      <p class="ab-eyebrow ab-copy c1">Sahra &amp; Beyond</p>
      <h1 class="ab-copy c2">Wear the wild side of the UAE</h1>
      <p class="lede ab-copy c3">Sahra means desert. Beyond is everything the Emirates hold once the tarmac ends &mdash; the dark-sky south, the first dunes of the Empty Quarter, the red rock of the Hajar. We put those places on heavyweight cotton &mdash; and tell you exactly where to find them.</p>
      <p class="ab-copy c4"><a class="ab-cta" href="/shop/">See the collection &rarr;</a></p>
    </div>
  </section>
  <main>
    <p class="ab-intro">Every design starts <em>somewhere you can stand.</em> A real place, drawn from its real landscape &mdash; and each shirt carries that place with it.</p>

    <section class="guide-sec"><h2>How it started</h2><div class="content">
      <p>It started with a camping trip. One night under a sky thick with stars was enough &mdash; that trip lit something, and every journey after it went further: dunes at first light, wadis running after the rains, mountain roads with nobody on them.</p>
      <p>The further we went, the more we realised how much of the UAE sits beyond the cities &mdash; quiet, and largely unknown to the people who would love it most. Sahra &amp; Beyond grew out of those years. First as a way to share the places. Now as something you can wear.</p>
    </div></section>

    <section class="guide-sec"><h2>The places</h2><div class="content">
      <p>Three landscapes, three designs. Each one names its place, and every product page carries the coordinates &mdash; so the shirt is a pin on a map as much as a graphic.</p>
    </div>
      <div class="ab-places">
      ${placeCards}
      </div>
    </section>

    <section class="guide-sec"><h2>Made properly</h2><div class="content">
      <p>Heavyweight cotton, because a shirt for the outdoors has to hold its shape through a long day and a lot of washes.</p>
    </div>
      <div class="ab-facts">
        <div class="ab-fact"><b>The cloth</b><p>230&nbsp;gsm combed ring-spun cotton for the tees, 240&nbsp;gsm piqu&eacute; for the polo. Pre-washed, cut in two fits &mdash; Regular and Oversized.</p></div>
        <div class="ab-fact"><b>The artwork</b><p>Al Quaa and the Hajar are printed direct-to-garment, so the graphic sits in the cotton rather than on top of it. The Empty Quarter and the polo are embroidered &mdash; thread, not ink.</p></div>
        <div class="ab-fact"><b>The details</b><p>Collar labels are printed, not sewn in, so there is nothing to scratch. The mark on every chest is embroidered.</p></div>
        <div class="ab-fact"><b>Founding Edition</b><p>The first run is deliberately small: forty of each design. When they are gone, the Founding Edition is closed.</p></div>
      </div>
    </section>

    <section class="guide-sec"><h2>The name</h2><div class="content">
      <p>&ldquo;Sahra&rdquo; &mdash; <span lang="ar" dir="rtl">صحراء</span> &mdash; means desert in Arabic. &ldquo;Beyond&rdquo; is everything else the Emirates hold once you leave the tarmac behind: the wadis, the mountains, the coast and the quiet. That is the invitation. Come and see it, then wear it.</p>
    </div></section>

    ${shopBlock(null)}

    <section class="guide-sec" id="contact"><h2>Say hello</h2><div class="content">
      <p>Questions about an order, sizing, a return &mdash; or just where to go this weekend. WhatsApp is quickest; we normally reply the same day.</p>
    </div>
    ${contactWays()}
      <p class="ab-contact-more">Company and trade-licence details are on the <a href="/contact/">contact page</a>.</p>
    </section>
  </main>`;
  write('about/index.html', shell({ title, desc, canonical, jsonld, bodyHtml: body, image: SITE + '/icon-512.png', activeNav: 'about' }));
})();

// ---- Shop page (generated from shop-preview.html — single source of truth; pre-launch it stays hidden) ----
if (LAUNCHED || REVEALED) (function () {
  try {
    let html = fs.readFileSync(path.join(ROOT, 'shop-preview.html'), 'utf8');
    // Revealed but not launched: the shop is browsable, nothing is purchasable.
    if (!LAUNCHED) html = html.replace('<head>', '<head>\n<script>window.__COMMERCE_OFF=true;</script>');
    const canonical = `${SITE}/shop/`;
    // 71 chars truncated in SERPs; 57 keeps the brand visible.
    const title = 'Shop UAE T-Shirts & Polos — Limited Runs | Sahra & Beyond';
    const desc = 'Original heavyweight 230gsm cotton tees inspired by real UAE places — the Milky Way over Al Quaa, the dunes of Liwa and the Hajar Mountains.';
    // Driven off content/products/*.json — a hardcoded list here silently went stale
    // once the catalogue was restructured, and shipped the old AED 149 price to Google.
    const prod = p => ({
      "@type": "Product",
      "name": p.name,
      "image": SITE + (p.imgMain || p.imgFront || '/shirts/alquaa-regular-back.jpg'),
      "description": p.shareDesc || p.ldDesc || p.seoDesc || '',
      "sku": p.sku || undefined,
      "brand": { "@type": "Brand", "name": "Sahra & Beyond" },
      "url": `${SITE}/products/${p.id}/`,
      "offers": {
        "@type": "Offer", "priceCurrency": "AED", "price": String(p.price),
        "availability": "https://schema.org/InStock", "url": `${SITE}/products/${p.id}/`
      }
    });
    if (!PRODUCTS_ALL.length) throw new Error('FATAL: no products loaded — shop JSON-LD would ship empty');
    const badPrice = PRODUCTS_ALL.filter(p => !/^\d+$/.test(String(p.price || '')));
    if (badPrice.length) throw new Error('FATAL: product(s) without a numeric price: ' + badPrice.map(p => p.id).join(', '));
    const jsonld = [
      { "@context": "https://schema.org", "@type": "WebPage", "name": title, "description": desc, "url": canonical },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/" },
        { "@type": "ListItem", "position": 2, "name": "Shop", "item": canonical }
      ] },
      { "@context": "https://schema.org", "@type": "ItemList",
        "numberOfItems": PRODUCTS_ALL.length,
        "itemListElement": PRODUCTS_ALL
          .slice().sort((a, b) => (a.order || 0) - (b.order || 0))
          .map((p, i) => ({ "@type": "ListItem", "position": i + 1, "item": prod(p) }))
      }
    ];
    const meta = `\n<meta name="description" content="${esc(desc)}">\n${robotsMeta(false)}\n<meta property="og:locale" content="en_AE">\n<link rel="canonical" href="${canonical}">\n<meta name="theme-color" content="#14102A">\n<meta property="og:type" content="website">\n<meta property="og:title" content="${esc(title)}">\n<meta property="og:description" content="${esc(desc)}">\n<meta property="og:url" content="${canonical}">\n<meta property="og:image" content="${SITE}/shirts/alquaa-regular-front.jpg">\n<meta property="og:site_name" content="Sahra & Beyond">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="${esc(title)}">\n<meta name="twitter:description" content="${esc(desc)}">\n<meta name="twitter:image" content="${SITE}/shirts/alquaa-regular-front.jpg">\n<script type="application/ld+json">${JSON.stringify(jsonld)}</script>`;
    html = html.replace(/<meta name="robots"[^>]*><!--[^>]*-->\n?/, '');
    // shop-preview.html carries its own canonical/og:image so the preview page is
    // correct on its own; strip them here or /shop/ ends up with two of each.
    html = html.replace(/\n?<link rel="canonical"[^>]*>/g, '');
    /* 1 Oct 2026: the preview's own description / og / twitter tags were surviving next to the
       generated set (two descriptions and two og:titles on /shop/). Strip them all first. */
    html = html.replace(/\n?<meta (name="description"|property="og:[a-z_:]+"|name="twitter:[a-z_:]+")[^>]*>/g, '');
    html = html.replace(/\n?<meta property="og:image(:alt)?"[^>]*>/g, '');
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>` + meta);
    html = html.replace(/(['"])shirts\//g, '$1/shirts/');
    html = html.replace('<a class="logo" href="#">', '<a class="logo" href="/">');
    html = html.replace('<div class="nav-links"><a href="#">Shop</a><a href="#">Places</a><a href="#">About</a>', '<div class="nav-links"><a href="/shop/">Shop</a><a href="/">Places</a><a href="/about/">About</a>');
    html = html.replace(/<footer>© \d{4} Sahra &amp; Beyond · Made in the UAE<\/footer>/, `<footer>${esc(TAGLINE)} · © ${new Date().getFullYear()} Sahra &amp; Beyond · Made in the UAE</footer>`);
    /* ---- static product grid, so /shop/ is not empty before JS runs ----
       The served HTML shipped `<main id="products"><div class="loading">Loading
       the collection…</div></main>` and nothing else: no product names, no
       prices, no links. The ItemList JSON-LD did carry all seven products, so
       Google was not blind — but the *visible* commercial page had no product
       text at all, which is why /shop/ is the thinnest commercial page on the
       site, and why a visitor with JS blocked saw a permanent spinner.

       This renders the same seven products from content/products/*.json at
       build time. The Shopify fetch still replaces it on load with live stock
       and availability, so nothing about the shopping experience changes — it
       simply is not the only way to see the catalogue. */
    const staticGrid = PRODUCTS_ALL.slice().sort((a, b) => (a.order || 99) - (b.order || 99)).map(p => `
      <article class="sp-card">
        <a class="sp-img" href="/products/${esc(p.id)}/">
          <img src="${esc(p.imgMain || p.imgFront)}" alt="${esc(p.altMain || p.name)}" width="1536" height="1536" loading="lazy">
        </a>
        <h2 class="sp-name"><a href="/products/${esc(p.id)}/">${esc(p.name)}</a></h2>
        <p class="sp-meta"><span class="sb-price" data-handle="${esc(p.id)}" data-aed="${esc(String(p.price))}">AED ${esc(String(p.price))}</span> &middot; ${esc(p.garment === 'polo' ? '240 GSM piqué' : '230 GSM cotton')} &middot; ${p.garment === 'polo' ? 'men&rsquo;s' : 'unisex'} S&ndash;XL</p>
        <p class="sp-desc">${esc(p.shareDesc || p.ldDesc || p.seoDesc || '')}</p>
        <a class="sp-cta" href="/products/${esc(p.id)}/">View ${esc(p.name)}</a>
      </article>`).join('');

    const gridCss = `<style>
      .sp-grid{display:grid;gap:34px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin:0 0 8px}
      .sp-card{margin:0}
      .sp-img{display:block;aspect-ratio:4/5;overflow:hidden;border-radius:2px;background:#EFEAE0}
      .sp-img img{width:100%;height:100%;object-fit:contain;padding:6%;display:block}
      .sp-name{font-size:19px;margin:14px 0 4px;font-weight:400}
      .sp-name a{color:inherit;text-decoration:none}
      .sp-meta{margin:0 0 8px;font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.8px;color:#6B6256}
      .sp-desc{margin:0 0 10px;font-size:14.5px;line-height:1.6}
      .sp-cta{font-family:'Space Mono',monospace;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#7E4114}
      /* 8 Oct 2026: Sahra Trail band under the grid, with the revealed prices */
      .sp-trail{position:relative;z-index:3;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0;align-items:stretch;max-width:1120px;margin:48px auto 96px;width:calc(100% - 40px);box-shadow:0 24px 60px rgba(30,20,10,.18);border-radius:14px;overflow:hidden;background:#0F2626;color:#EADBC4}
      .sp-trail img{display:block;width:100%;height:100%;object-fit:cover}
      .sp-trail>div{padding:28px 28px 24px}
      .sp-trail-k{margin:0 0 6px;font-family:'Space Mono',monospace;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#9ED0CB}
      .sp-trail h2{margin:0 0 14px;font-family:'Cormorant Garamond',Georgia,serif;font-weight:500;font-size:clamp(26px,3vw,34px);color:#F6ECDD}
      .sp-trail ul{list-style:none;margin:0 0 14px;padding:0}
      .sp-trail li{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid rgba(217,195,165,.22);font-size:15.5px}
      .sp-trail li b{font-weight:600;color:#F6ECDD;white-space:nowrap}
      .sp-trail-s{margin:0 0 14px;font-size:14px;color:#CDBEA8}
      .sp-trail-a{display:inline-flex;align-items:center;min-height:46px;padding:0 20px;border-radius:999px;background:#D9C3A5;color:#10161d;font-weight:600;text-decoration:none}
      .sp-trail-r{margin:12px 0 0;font-family:'Space Mono',monospace;font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:#B9AC98}
      @media(max-width:700px){.sp-trail{grid-template-columns:1fr;width:calc(100% - 32px);margin:36px auto 72px}.sp-trail>div{padding:22px 18px 20px}}
    </style>`;

    const TRAIL_BAND = '<section class="sp-trail" aria-labelledby="spTrailH"><img src="/assets/trail/reveal/trail-kit-720.webp" width="720" height="547" alt="The Sahra Trail Kit: the Tee and the 2-in-1 Shorts" loading="lazy" decoding="async"><div><p class="sp-trail-k">Sahra Trail &middot; the first run</p><h2 id="spTrailH">Trail and run wear, revealed</h2><ul><li><span>Sahra Trail Tee</span><b>AED 139</b></li><li><span>Sahra Trail 2-in-1 Shorts</span><b>AED 169</b></li><li><span>The Kit, Tee + Shorts</span><b>AED 249</b></li></ul><p class="sp-trail-s">Not on sale yet. The early-access list can buy 24 hours before everyone else.</p><a class="sp-trail-a" href="/trail/">See Sahra Trail &rarr;</a><p class="sp-trail-r">Pre-production renders</p></div></section>';
    html = html.replace(
      '<main id="products"><div class="loading">Loading the collection&hellip;</div></main>',
      gridCss + '<main id="products"><div class="sp-grid">' + staticGrid + '</div></main>' + TRAIL_BAND
    ).replace(
      '<main id="products"><div class="loading">Loading the collection…</div></main>',
      gridCss + '<main id="products"><div class="sp-grid">' + staticGrid + '</div></main>' + TRAIL_BAND
    );

    write('shop/index.html', html);
  } catch (e) { console.log('  ! shop page skipped: ' + e.message); }
})();



/* ---- Contact (13 Sep 2026) ----------------------------------------------
   /contact/ and /contact both returned 404, and the only address for the
   company details was an anchor on policies.html labelled "Contact". Three of
   the eleven audit personas concluded the site had no contact details at all;
   one of them spent her whole session looking. Details-only by Faheem's call -
   no wholesale or bulk invitation on this page. Single source of truth for the
   figures below is policies.html#contact - keep them in step. */
(function () {
  const canonical = `${SITE}/contact/`;
  const title = 'Contact Sahra & Beyond — WhatsApp, Email & Company Details';
  const desc = 'Reach Sahra & Beyond on WhatsApp, by phone or by email. Company name, trade licence and registered address for our UAE apparel brand.';
  const WA = 'https://wa.me/971585449946';
  const jsonld = [{
    "@context": "https://schema.org", "@type": "ContactPage",
    "name": title, "url": canonical,
    "mainEntity": {
      "@type": "Organization",
      "name": "SAHRA AND BEYOND FZE LLC",
      "alternateName": ["Sahra & Beyond", "Sahra and Beyond", "Sahra Beyond"],
      "url": SITE,
      "email": "hello@sahraandbeyond.ae",
      "telephone": "+971585449946",
      "sameAs": ["https://instagram.com/sahraandbeyond.ae"],
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Business Centre, Sharjah Publishing City Free Zone",
        "addressLocality": "Sharjah",
        "addressCountry": "AE",
        "postOfficeBox": "73111"
      },
      "contactPoint": [{
        "@type": "ContactPoint",
        "contactType": "customer support",
        "telephone": "+971585449946",
        "email": "hello@sahraandbeyond.ae",
        "areaServed": "Worldwide",
        "availableLanguage": ["en", "ar"]
      }]
    }
  }];
  const body = `
  <section class="loc-hero" style="--hero-grad:linear-gradient(160deg,#14102A 0%,#39295A 40%,#7A4F63 72%,#C0702E 100%)">
    <div class="stars" style="position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(1.6px 1.6px at 14% 24%,#fff,transparent),radial-gradient(1.2px 1.2px at 36% 12%,#fff,transparent),radial-gradient(1.6px 1.6px at 58% 30%,#fff,transparent),radial-gradient(1.2px 1.2px at 76% 16%,#FFE9C4,transparent),radial-gradient(1.6px 1.6px at 90% 34%,#fff,transparent);animation:ctaTwinkle 4.5s ease-in-out infinite"></div>
    <div class="glow"></div><svg class="dune-far" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true"><path fill="#8B4E63" d="M0,220 C300,150 560,250 820,200 C1080,150 1300,220 1440,190 L1440,320 L0,320 Z"/></svg><svg class="dune-near" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true"><path fill="#3A241C" d="M0,270 C320,210 620,290 940,250 C1180,220 1330,270 1440,255 L1440,320 L0,320 Z"/></svg><div class="grain"></div><div class="loc-hero-inner">
      <nav class="crumbs"><a href="/">Home</a> &rsaquo; <span>Contact</span></nav>
      <h1>Contact us</h1>
      <p class="lede">Questions about an order, a return, sizing, or anything else &mdash; we are happy to help.</p>
    </div>
  </section>
  <main>
    <div class="content">
      <p>The quickest way to reach us is <strong>WhatsApp</strong>: we normally reply the same day. You can also call that number during UAE business hours, or email us and we aim to reply within one working day.</p>
    </div>

    ${contactWays()}

    <section class="guide-sec"><h2>Before you write</h2><div class="content">
      <p>Most answers are already on the site: <a href="/size-guide/">the size guide</a> has garment-flat measurements in inches and centimetres for both fits, <a href="/policies.html#shipping">shipping</a> covers delivery windows and duties, and <a href="/policies.html#returns">returns &amp; refunds</a> covers the 14-day window. If yours is not there, message us.</p>
    </div></section>

    <section class="guide-sec"><h2>Business details</h2>
      <div class="facts">
        <ul>
          <li><strong>Company name</strong> &middot; SAHRA AND BEYOND FZE LLC</li>
          <li><strong>Trading name</strong> &middot; Sahra &amp; Beyond</li>
          <li><strong>Trade licence no.</strong> &middot; 4430808.01, issued by Sharjah Publishing City Free Zone</li>
          <li><strong>VAT / TRN</strong> &middot; Not VAT-registered</li>
          <li><strong>Office address</strong> &middot; Business Centre, Sharjah Publishing City Free Zone, Sharjah, United Arab Emirates</li>
          <li><strong>P.O. Box</strong> &middot; 73111</li>
          <li><strong>Country</strong> &middot; United Arab Emirates</li>
          <li><strong>Instagram</strong> &middot; <a href="https://instagram.com/sahraandbeyond.ae" target="_blank" rel="noopener">@sahraandbeyond.ae</a></li>
        </ul>
      </div>
      <div class="content"><p class="sgnote">The same details, with our full terms, sit on the <a href="/policies.html#contact">policies page</a>.</p></div>
    </section>

    <p class="back" style="margin-top:26px"><a href="/shop/">Back to the collection &rarr;</a></p>
  </main>`;
  write('contact/index.html', shell({ title, desc, canonical, jsonld, bodyHtml: body, image: SITE + '/icon-512.png', activeNav: 'contact' }));
})();

// ---- The Sahra Tote (19 Sep 2026) ------------------------------------------
// Faheem: put the tote on the store at AED 50 AND keep giving it free with every
// order, so a buyer can see what the gift is worth. The listing is what makes
// "worth AED 50" a checkable fact rather than an invented anchor (the
// substantiation rule) - so this page has to exist and has to carry the price.
//
// It lives at /tote/ rather than /products/<handle>/ on purpose: every page
// under products/ is generated by build-products.js from content/products/*.json
// and is an apparel template end to end - GSM, fit, size chart, place band.
// prepush.js also treats any products/ folder without a matching JSON as stale
// build output. A tote is none of those things, and pushing it through that
// template would print "230gsm combed cotton, ribbed crew neck, unisex S-XL"
// over a canvas bag.
(function () {
  const canonical = `${SITE}/tote/`;
  const title = 'The Sahra Tote — Natural Canvas Tote Bag | Sahra & Beyond';
  const desc = 'The Sahra Tote in natural canvas, AED 50 — and free with every order while the Founding Edition lasts. Free next-day delivery across the UAE.';
  const img = `${SITE}/shirts/tote-model.jpg`;
  const jsonld = [
    { "@context": "https://schema.org", "@type": "Product",
      "name": "The Sahra Tote", "image": [img], "brand": { "@type": "Brand", "name": "Sahra & Beyond" },
      "description": 'A natural canvas tote carrying the Sahra & Beyond mark, printed in terracotta. Free with every order while the Founding Edition run lasts.',
      "offers": Object.assign({ "@type": "Offer", "url": canonical, "priceCurrency": "AED", "price": "50", "priceValidUntil": `${new Date().getFullYear() + 1}-12-31`,
        "availability": "https://schema.org/InStock", "itemCondition": "https://schema.org/NewCondition", "seller": { "@type": "Organization", "name": "Sahra & Beyond" } },
        JSON.parse('{' + buildProducts.LD_SHIP + '}')) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/" },
      { "@type": "ListItem", "position": 2, "name": "The Sahra Tote", "item": canonical }
    ] }
  ];

  const css = `
/* sahra-sky.css gives an opaque reading surface to <main> and .ftr only —
   anything outside them is dark text on a moving night sky. So this block lives
   inside main, and main is widened for this page alone: 820px is a reading
   column, not a two-column product layout. */
body.tote-page main{max-width:1180px}
.tt-wrap{margin:0 auto}
.tt{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:clamp(24px,4vw,56px);align-items:start;padding-bottom:clamp(30px,5vw,54px)}
.tt-media{position:relative;border-radius:16px;overflow:hidden;background:#EFE7DA;aspect-ratio:4/5}
.tt-media img{width:100%;height:100%;object-fit:cover;display:block}
.tt-flag{position:absolute;left:14px;top:14px;z-index:2;display:inline-flex;align-items:center;gap:7px;
  font-family:'Space Mono',ui-monospace,Menlo,monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;
  color:#7E4114;background:rgba(251,240,220,.94);border:1px solid #C99A55;padding:5px 10px;border-radius:999px}
.tt-buy{position:sticky;top:96px}
.tt-eyebrow{font-family:'Space Mono',ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#8E7F6C;margin:0 0 8px}
.tt-buy h1{font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-weight:600;
  font-size:clamp(34px,4.4vw,52px);line-height:1.04;margin:0 0 10px;color:var(--ink,#33271B)}
.tt-sub{font-size:16px;color:#4A4136;margin:0 0 18px;max-width:46ch}
.tt-price{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:0 0 20px}
.tt-price .tt-n{font-size:26px;font-weight:700;letter-spacing:.01em}
.tt-gift{border:1px solid #C99A55;background:#FBF0DC;border-radius:12px;padding:14px 16px;margin:0 0 20px}
.tt-gift b{display:block;font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-weight:600;
  font-size:21px;line-height:1.15;color:#33271B;margin-bottom:4px}
.tt-gift p{margin:0;font-size:14.5px;line-height:1.5;color:#4A4136}
.tt-gift a{color:#7E4114;font-weight:600}
.tt-add{width:100%;justify-content:center;padding:16px}
.tt-msg{min-height:20px;font-size:13.5px;color:#4A4136;margin:10px 0 0}
.tt-ship{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}
.tt-ship div{border:1px solid var(--line,#E6DCCB);border-radius:8px;padding:10px 12px;font-size:13px;color:#4A4136}
.tt-ship b{display:block;font-weight:600;color:var(--ink,#33271B);margin-bottom:2px}
.tt-specs{list-style:none;margin:20px 0 0;padding:18px 0 0;border-top:1px solid var(--line,#E6DCCB)}
.tt-specs li{font-size:14.5px;line-height:1.55;color:#4A4136;padding:5px 0 5px 22px;position:relative}
.tt-specs li::before{content:"\\2726";position:absolute;left:0;top:5px;color:#C99A55}
.tt-specs b{color:var(--ink,#33271B);font-weight:600}
@media(max-width:880px){
  .tt{grid-template-columns:1fr;gap:22px}
  .tt-buy{position:static}
  .tt-media{max-width:520px}
}
@media(max-width:430px){.tt-ship{grid-template-columns:1fr}}
`;

  const body = `
  <style>${css}</style>
  <main>
  <div class="tt-wrap">
    <nav class="crumbs"><a href="/">Home</a> &rsaquo; <a href="/shop/">Shop</a> &rsaquo; <span>The Sahra Tote</span></nav>
    <div class="tt">
      <div class="tt-media">
        <span class="tt-flag">Free with every order</span>
        <img src="/shirts/tote-model.jpg" alt="The Sahra Tote in natural canvas, carried over the shoulder" width="1080" height="1350" fetchpriority="high" decoding="async">
      </div>
      <div class="tt-buy">
        <p class="tt-eyebrow">Sahra &amp; Beyond &middot; accessory</p>
        <h1>The Sahra Tote</h1>
        <p class="tt-sub">Natural canvas, carrying the mark and the wordmark in terracotta. Flat-bottomed, with long shoulder handles &mdash; sized for a market run, a beach day, or a laptop and a water bottle.</p>
        <p class="tt-price"><span class="tt-n"><span class="sb-price" data-handle="sahra-tote" data-aed="50">AED 50</span></span></p>
        <div class="tt-gift">
          <b>You do not have to buy one</b>
          <p>A tote comes free with every order while the Founding Edition run lasts &mdash; add any tee or polo to your bag and it is added at no charge. This page is for anyone who wants a second one, or the tote on its own. <a href="/shop/">Shop the collection &rarr;</a></p>
        </div>
        <button class="btn tt-add" id="toteAdd" type="button" disabled>Loading&hellip;</button>
        <p class="tt-msg" id="toteMsg" role="status" aria-live="polite"></p>
        <div class="tt-ship">
          <div><b>Next working day, all seven emirates</b>Order by 2 pm UAE time. Free, no minimum order.</div>
          <div><b>14-day returns</b>Free UAE returns within 14 days, unused with tags on.</div>
        </div>
        <ul class="tt-specs">
          <li><b>Natural canvas</b> &mdash; undyed, so it wears in rather than out.</li>
          <li><b>The mark, printed in terracotta</b> &mdash; the same lockup as the collar labels.</li>
          <li><b>Long handles</b>, cut to sit on the shoulder rather than the forearm.</li>
          <li><b>Free with every order</b> while the Founding Edition run lasts.</li>
        </ul>
      </div>
    </div>
    ${shopBlock(null)}
    <p class="back" style="margin-top:26px"><a href="/shop/">&larr; Back to the collection</a></p>
  </div>
  </main>
<script>
/* One variant, no options — so the only thing to resolve at runtime is the
   variant id and whether it is in stock. Looked up by handle rather than
   hardcoded: the gift variant id is pinned in sahra-cart.js because the cart
   must add it blind, but a page that is already talking to Shopify has no
   reason to carry a second id that can go stale. */
(function(){
  var S={domain:'sahra-beyond.myshopify.com',token:'cc42ba8e74eb27c4f3c062d93f893fa0',v:'2024-10'};
  var btn=document.getElementById('toteAdd'),msg=document.getElementById('toteMsg');
  if(!btn)return;
  var VID=null;
  function say(t){ if(msg)msg.textContent=t||''; }
  fetch('https://'+S.domain+'/api/'+S.v+'/graphql.json',{method:'POST',
    headers:{'Content-Type':'application/json','X-Shopify-Storefront-Access-Token':S.token},
    body:JSON.stringify({query:'{product(handle:"sahra-tote"){variants(first:1){edges{node{id availableForSale}}}}}'})})
  .then(function(r){return r.json();})
  .then(function(d){
    var e=d&&d.data&&d.data.product&&d.data.product.variants&&d.data.product.variants.edges;
    var n=e&&e[0]&&e[0].node;
    if(!n){ btn.textContent='Open the shop'; btn.disabled=false; btn.onclick=function(){location.href='/shop/';}; return; }
    if(!n.availableForSale){ btn.textContent='Sold out'; say('Out of stock for now — a tote still comes free with every order.'); return; }
    VID=n.id; btn.disabled=false; btn.textContent='Add to bag';
  })
  .catch(function(){ btn.textContent='Open the shop'; btn.disabled=false; btn.onclick=function(){location.href='/shop/';}; });
  btn.addEventListener('click',function(){
    if(!VID)return;
    if(!window.SahraCart){ say('The bag is still loading \u2014 give it a second, or message us on WhatsApp.'); return; }
    btn.disabled=true; btn.textContent='Adding\\u2026';
    /* gift:false - a tote does not earn a free tote. It matters on an empty
       cart, where sahra-cart.js must seed the gift before a cart exists to read. */
    Promise.resolve(SahraCart.add(VID,1,{gift:false})).then(function(){
      btn.textContent='Add to bag'; btn.disabled=false; say(''); SahraCart.open&&SahraCart.open();
    }).catch(function(){
      btn.textContent='Add to bag'; btn.disabled=false; say('That did not go through. Try again, or message us on WhatsApp.');
    });
    if(window.track)track('add_to_cart',{item:'sahra-tote'});
  });
})();
</script>`;

  write('tote/index.html', shell({ title, desc, canonical, jsonld, bodyHtml: body, image: img, activeNav: 'none', bodyClass: 'tote-page' }));
})();

// ---- Places index (the full directory that replaced the old planner grid) ----
(function () {
  const canonical = `${SITE}/places/`;
  const title = 'All Places — Deserts, Wadis, Mountains & Beaches, UAE';
  const desc = 'The full Sahra & Beyond map: ' + locations.length + ' real places across the Emirates — dunes, wadis, mountains and beaches, each with GPS, live weather and a packing list.';
  const jsonld = [
    { "@context": "https://schema.org", "@type": "CollectionPage", "name": title, "description": desc, "url": canonical },
    { "@context": "https://schema.org", "@type": "ItemList", "itemListElement": locations.map((l, i) => ({ "@type": "ListItem", "position": i + 1, "name": l.name, "url": `${SITE}/locations/${l.id}/` })) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/" },
      { "@type": "ListItem", "position": 2, "name": "Places", "item": canonical }
    ] }
  ];
  const CATS = ['Dunes', 'Camping', 'Wadis', 'Mountains', 'Coast', 'Heritage'];
  const seen = new Set();
  const secs = CATS.map(c => {
    const list = locations.filter(l => l.category === c);
    list.forEach(l => seen.add(l.id));
    return list.length ? `<section class="guide-sec" id="cat-${c.toLowerCase()}"><h2>${esc(c)}</h2><div class="cards">${list.map(locCard).join('')}</div></section>` : '';
  }).join('');
  const rest = locations.filter(l => !seen.has(l.id));
  const restHtml = rest.length ? `<section class="guide-sec"><h2>More places</h2><div class="cards">${rest.map(locCard).join('')}</div></section>` : '';
  /* ---- Places hero, rebuilt 18 Sep 2026 (Faheem: "extremely basic, needs an
     overhaul"). Photo-led: five real frames from the location covers in a
     mosaic that fades into the night ground, the numbers computed from the
     location data (never typed), landscape chips that jump to the sections
     below, and the three places that became tees. Its CSS travels with the
     page in a <style> so the shell sheet stays untouched; the legibility layer
     still lands after it. Wadi Shab sits in Tiwi (Oman), so the lede counts
     emirates from the data and says so rather than claiming "across the
     Emirates" for all of them. */
  const byId = Object.fromEntries(locations.map(l => [l.id, l]));
  const MOSAIC = [
    ['wadi-naqab', '50% 45%', 'wide'],
    ['al-quaa-desert', '50% 88%', ''],
    ['snoopy-island', '50% 50%', ''],
    ['shuweihat-island', '42% 60%', 'tall'],
    ['jabal-yanas', '50% 80%', ''],
    ['wadi-showka', '50% 60%', '']
  ].filter(([id]) => byId[id] && byId[id].cover);
  const UAE = new Set(['Abu Dhabi', 'Al Ain', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah']);
  const emirateOf = e => e === 'Al Ain' ? 'Abu Dhabi' : e;
  const emList = l => String(l.emirate || '').split(' / ');
  const emirates = new Set(locations.flatMap(l => emList(l).filter(e => UAE.has(e)).map(emirateOf)));
  const abroad = locations.filter(l => !emList(l).some(e => UAE.has(e)));
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
  const catCount = c => locations.filter(l => l.category === c).length;
  const CAT_META = { Dunes: 'dune fields', Camping: 'camps', Wadis: 'wadis', Mountains: 'mountain routes', Coast: 'coasts', Heritage: 'heritage sites' };
  const ONE = { Dunes: 'dune field', Camping: 'camp', Wadis: 'wadi', Mountains: 'mountain route', Coast: 'coast', Heritage: 'heritage site' };
  const chips = CATS.filter(catCount).map(c => `<a class="pl-chip" href="#cat-${c.toLowerCase()}"><b>${catCount(c)}</b> ${esc(catCount(c) === 1 ? ONE[c] : (CAT_META[c] || c.toLowerCase()))}</a>`).join('');
  const TEES = [
    ['al-quaa-desert', 'Al Quaa Galaxy', '/shirts/card/alquaa-regular-back-fit.jpg'],
    ['liwa', 'Empty Quarter', '/shirts/card/emptyquarter-regular-front-fit.jpg'],
    ['wadi-naqab', 'Hajar Mountains', '/shirts/card/hajar-regular-back-fit.jpg']
  ].filter(([id]) => byId[id] && byId[id].productLink && byId[id].productLink.slug);
  const tees = TEES.map(([id, tee, img]) => `<a class="pl-tee" href="/products/${esc(byId[id].productLink.slug)}/"><img src="${esc(img)}" alt="${esc(tee)} tee" loading="lazy" width="120" height="150"><span><em>${esc(byId[id].name)}</em><b>${esc(tee)}</b><i>See the tee &rarr;</i></span></a>`).join('');
  const lede = `${locations.length} places, ${words[CATS.filter(catCount).length] || CATS.length} kinds of ground, ${words[emirates.size] || emirates.size} emirates` +
    (abroad.length ? ` and ${abroad.length === 1 ? 'one detour' : abroad.length + ' detours'} over the border` : '') +
    ` &mdash; each with a sourced guide: how to get there, when to go, the real risks and what to pack.`;
  const heroCss = `
.pl-hero{position:relative;isolation:isolate;overflow:hidden;background:#14102A;color:#fff}
.pl-mosaic{position:absolute;inset:0;z-index:0;display:grid;grid-template-columns:1.35fr 1fr 1fr 1fr;grid-template-rows:1fr 1fr;gap:3px;pointer-events:none}
.pl-mosaic figure{margin:0;position:relative;overflow:hidden;background:#1C1836}
.pl-mosaic figure.wide{grid-column:1;grid-row:1/3}
.pl-mosaic figure.tall{grid-column:4;grid-row:1/3}
.pl-mosaic img{width:100%;height:100%;object-fit:cover;object-position:var(--fx,50% 50%);display:block;transform:scale(1.04);animation:plDrift 22s ease-in-out infinite alternate}
.pl-mosaic figure:nth-child(2n) img{animation-delay:-8s}
.pl-mosaic figure:nth-child(3n) img{animation-delay:-14s}
@keyframes plDrift{from{transform:scale(1.04) translate3d(0,0,0)}to{transform:scale(1.1) translate3d(-1.5%,-1.5%,0)}}
.pl-scrim{position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(180deg,rgba(20,16,42,.38) 0%,rgba(20,16,42,.18) 34%,rgba(20,16,42,.72) 66%,#14102A 100%),linear-gradient(90deg,rgba(20,16,42,.5),rgba(20,16,42,0) 42%)}
.pl-inner{position:relative;z-index:2;max-width:1180px;margin:0 auto;padding:clamp(120px,22vw,220px) clamp(16px,5vw,32px) clamp(28px,4vw,44px);display:grid;grid-template-columns:minmax(0,1.3fr) minmax(280px,.9fr);gap:32px 48px;align-items:end}
.pl-hero .crumbs,.pl-hero .crumbs a{color:#F3EBDD;text-shadow:0 1px 10px rgba(0,0,0,.5)}
.pl-eyebrow{font-family:'Space Mono',ui-monospace,Menlo,monospace;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#F2C98C;margin:18px 0 12px}
.pl-hero h1{font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-weight:600;font-size:clamp(38px,6vw,76px);line-height:1;letter-spacing:-.01em;color:#fff;margin:0 0 16px;text-shadow:0 2px 26px rgba(0,0,0,.45);text-wrap:balance}
.pl-hero h1 i{font-style:italic;color:#F2C98C}
.pl-hero h1::after{display:none}
.pl-lede{font-size:clamp(16px,1.6vw,19px);line-height:1.5;color:#F3EBDD;max-width:54ch;margin:0 0 22px;text-shadow:0 1px 12px rgba(0,0,0,.5)}
.pl-chips{display:flex;flex-wrap:wrap;gap:8px}
.pl-chip{display:inline-flex;align-items:baseline;gap:6px;padding:9px 14px;border:1px solid rgba(243,235,221,.35);border-radius:999px;background:rgba(20,16,42,.45);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:#F3EBDD;text-decoration:none;font-size:14px;font-weight:500;transition:border-color .2s,background .2s}
.pl-chip b{font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-weight:700;font-size:19px;color:#F2C98C}
.pl-chip:hover,.pl-chip:focus-visible{border-color:#F2C98C;background:rgba(20,16,42,.7)}
.pl-tees{display:grid;gap:10px;align-self:end}
.pl-tees-h{font-family:'Space Mono',ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#F2C98C;margin:0 0 2px}
.pl-tee{display:grid;grid-template-columns:64px 1fr;gap:12px;align-items:center;padding:8px 12px 8px 8px;border:1px solid rgba(243,235,221,.22);border-radius:12px;background:rgba(20,16,42,.55);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#F3EBDD;text-decoration:none;transition:border-color .2s,transform .2s}
.pl-tee:hover{border-color:#F2C98C;transform:translateY(-2px)}
.pl-tee img{width:64px;height:80px;object-fit:cover;border-radius:8px;display:block;background:#2A2245}
.pl-tee span{display:grid;gap:1px;min-width:0}
.pl-tee em{font-style:normal;font-family:'Space Mono',ui-monospace,Menlo,monospace;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#D9C3A5}
.pl-tee b{font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-weight:600;font-size:18px;line-height:1.15;color:#fff}
.pl-tee i{font-style:normal;font-size:12px;color:#F2C98C}
@media(max-width:880px){
  .pl-inner{grid-template-columns:1fr;padding-top:clamp(150px,44vw,240px);gap:24px}
  .pl-mosaic{grid-template-columns:1.2fr 1fr 1fr;grid-template-rows:1fr 1fr}
  .pl-mosaic figure.wide{grid-column:1;grid-row:1/3}
  .pl-mosaic figure.tall{grid-column:3;grid-row:1/3}
  .pl-mosaic figure:nth-child(n+5){display:none}
  .pl-tees{grid-template-columns:repeat(3,1fr);gap:8px}
  .pl-tees-h{grid-column:1/-1}
  .pl-tee{grid-template-columns:1fr;text-align:center;padding:10px 8px}
  .pl-tee img{margin:0 auto;width:56px;height:70px}
  .pl-tee i{display:none}
}
@media(max-width:480px){.pl-mosaic{grid-template-columns:1fr 1fr}.pl-mosaic figure.tall{display:none}.pl-tee b{font-size:16px}}
@media(prefers-reduced-motion:reduce){.pl-mosaic img{animation:none;transform:none}}
.guide-sec[id]{scroll-margin-top:96px}
`;
  const body = `
  <style>${heroCss}${PLACES.HUB_CSS}</style>
  <section class="pl-hero">
    <div class="pl-mosaic" aria-hidden="true">${MOSAIC.map(([id, fx, cls], i) => `<figure class="${cls}" style="--fx:${fx}"><img src="${esc(byId[id].cover)}" alt="" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></figure>`).join('')}</div>
    <div class="pl-scrim"></div>
    <div class="pl-inner">
      <div>
        <nav class="crumbs"><a href="/">Home</a> &rsaquo; <span>Places</span></nav>
        <p class="pl-eyebrow">The map behind the brand</p>
        <h1>Every place we have explored</h1>
        <p class="pl-lede">${lede}</p>
        <div class="pl-chips">${chips}</div>
      </div>
      ${tees ? `<div class="pl-tees"><p class="pl-tees-h">Three of them became tees</p>${tees}</div>` : ''}
    </div>
  </section>
  <main>
    <div class="content"><p>This is the map behind the brand: every desert, dune field, wadi, mountain trail and beach we have explored across the UAE. Each place has its own guide: how to get there, when to go, what it costs, the real risks, and a packing list matched to the trip, with the sources for every fact.</p></div>
    ${PLACES.hubExplorer(locations)}
    ${secs}
    ${restHtml}
    <section class="guide-sec" id="guides"><h2>Guides that pull these places together</h2><nav class="catnav" aria-label="Guides">${FG.GUIDES.filter(g => g[0] !== '/places/').map(g => `<a href="${g[0]}"><b>${esc(g[1])}</b><span>${esc((LANDINGS.find(L => '/' + L.slug + '/' === g[0]) || {}).desc ? (LANDINGS.find(L => '/' + L.slug + '/' === g[0]).pick || []).length + ' places' : '')}</span></a>`).join('')}</nav></section>
    ${shopBlock(null)}
    <p class="back" style="margin-top:26px"><a href="/">&larr; Back to Sahra &amp; Beyond</a></p>
  </main>${PLACES.hubScript()}`;
  write('places/index.html', shell({ title, desc, canonical, jsonld, bodyHtml: body, activeNav: 'places' }));
})();

// ---- product detail pages (content/products/*.json) ----

/* ============================================================================
   COMMERCE PAGES — the buy-intent surfaces the site was missing entirely.
   /t-shirts/  hub for "UAE t-shirt brand" style queries
   /gifts/     the uncontested lane: meaningful UAE gifts vs. tacky souvenirs
   /fabric/    spec + trust page ("230gsm t shirt", "combed cotton tee UAE")
   /size-guide/ standalone; was only an anchor buried in the shop page
   ========================================================================== */
const SIZING = (function(){
  const d = readJSON(path.join(ROOT,'content/sizing.json'));
  if (!d || !Array.isArray(d.regular) || !d.regular.length) {
    throw new Error('FATAL: content/sizing.json missing or empty — /size-guide/ and every product size table depend on it.');
  }
  // We produce S–XL only. If XXL is present, content/ is stale or a spec sheet
  // has been transcribed as an order. Fail the deploy rather than publish it.
  const xxl = (d.sizes||[]).includes('XXL')
    || (d.regular||[]).some(r => r[0] === 'XXL')
    || (d.oversized||[]).some(r => r[0] === 'XXL');
  if (xxl) throw new Error('FATAL: content/sizing.json contains XXL. We produce S–XL only. This usually means content/ did not reach the repo — check it is actually updated before deploying.');
  return d;
})();
function sizeTableHtml() {
  if (!SIZING.regular || !SIZING.regular.length) return '';
  const cell = (i,c) => `<span class="sz-in">${i}&Prime;</span><span class="sz-sep"> / </span><span class="sz-cm">${c}&nbsp;cm</span>`;
  const rows = fit => (SIZING[fit] || []).map(r =>
    `<tr><th scope="row">${esc(String(r[0]))}</th><td>${cell(r[1],r[2])}</td><td>${cell(r[3],r[4])}</td><td>${cell(r[5],r[6])}</td><td>${cell(r[7],r[8])}</td></tr>`).join('');
  const tbl = (label, fit, intent) => `<h3>${label}</h3><p class="sgintent">${intent}</p><div class="sgwrap"><table class="sg">
    <thead><tr><th>Size</th><th>Chest</th><th>Length</th><th>Shoulder</th><th>Sleeve</th></tr></thead>
    <tbody>${rows(fit)}</tbody></table></div>`;
  const method = `<h3>How these are measured</h3><ul class="sgmethod">${(SIZING.method||[]).map(m=>`<li>${m}</li>`).join('')}</ul><p class="sgnote">${SIZING.tolerance||''}</p>`;
  const polo = (SIZING.polo && SIZING.polo.available === false)
    ? `<h3>The polo</h3><p class="sgnote">${SIZING.polo.note}</p>` : '';
  /* 25 Sep 2026: size finder (assets/sahra-sizefinder.js) - height and build to a starting size */
  const finder = `<div class="sfind" data-sizefinder data-fit="choose" data-chart='${JSON.stringify({ regular: SIZING.regular.map(r => [r[0], r[2]]), oversized: (SIZING.oversized || []).map(r => [r[0], r[2]]) })}'></div><script src="/assets/sahra-sizefinder.js" defer></script>`;
  return finder + tbl('Regular fit','regular',SIZING.regularIntent||'') + tbl('Oversized fit','oversized',SIZING.oversizedIntent||'') + method + polo;
}

/* The GSM comparison table.
   No UAE apparel retailer explains fabric weight — the large ones list a GSM
   figure as a bullet and never say what it means. This table is the reason
   /fabric/ can rank for "what is gsm" and "230 gsm t shirt", so it is data,
   not decoration, and it lives here rather than being pasted into prose.
   `ours` marks the two weights we actually sell: 230 (tees) and 240 (polo). */
const GSM_ROWS = [
  ['150 gsm', 'Lightweight', 'Promotional and fast-fashion tees. Thin enough that the light comes through it and the shoulder seams show under the fabric.',
   'Cheap to produce and cheap to replace. Loses its shape within a season.'],
  ['180 gsm', 'Standard', 'The default for most high-street t-shirts, and what people usually picture when they think "t-shirt".',
   'Fine on the body, but drapes onto it rather than holding its own shape. Collars go wavy first.'],
  ['200 gsm', 'Mid-heavy', 'The step where a shirt starts to feel considered rather than disposable. Common in mid-market basics.',
   'Holds shape reasonably. Still thin enough to show what is underneath in strong light.'],
  ['230 gsm', 'Heavyweight', 'Our t-shirts, in both Regular and Oversized fits. Combed, ring-spun cotton.',
   'Enough weight to hang away from the body instead of clinging, and enough cotton to survive repeated washing.', true],
  ['240 gsm', 'Heavyweight piqué', 'The Sahra Polo. Not a heavier version of the tee fabric — piqué is a different knit structure.',
   'The extra ten grams are what let a collar hold its shape rather than curling after a season.', true],
  ['280 gsm', 'Ultra-heavy', 'Boxy streetwear and premium blanks. Approaching sweatshirt territory.',
   'Structured to the point of stiffness, and genuinely warm. Hard to justify in a Gulf summer.']
];

function gsmTableHtml() {
  const rows = GSM_ROWS.map(r =>
    `<tr${r[4] ? ' class="is-ours"' : ''}><th scope="row">${esc(r[0])}</th><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`
  ).join('');
  return `<div class="sgwrap"><table class="sg gsm">
    <thead><tr><th>Weight</th><th>Class</th><th>Where you find it</th><th>How it wears</th></tr></thead>
    <tbody>${rows}</tbody></table></div>
    <p class="gsm-key"><b>Highlighted rows</b> are the two weights we make.</p>`;
}

const COMMERCE = [
  {
    slug: 't-shirts', emoji: '◈', cat: 'Dunes',
    items: ["al-quaa-galaxy-regular", "al-quaa-galaxy-oversized", "hajar-mountains-regular", "hajar-mountains-oversized", "empty-quarter-regular", "empty-quarter-oversized"],
    h1: 'T-Shirts in Dubai & the UAE',
    title: 'T-Shirts in Dubai & the UAE — 230 GSM Graphic Tees',
    desc: 'Original UAE graphic tees from real places: an embroidered desert tee from Liwa, a mountain t-shirt from the Hajar, the Milky Way over Al Quaa. 230gsm cotton.',
    catNav: true,
    intro: "Most UAE t-shirts fall into two camps: airport souvenirs with a camel and a skyline, or imported fast fashion with nothing to do with this country at all. We wanted a third option — a t-shirt that means something to someone who actually lives here.\n\nEvery Sahra & Beyond t-shirt starts at a real place in the Emirates. Not a landmark you have seen on a postcard, but the places people drive out to on a Friday: one of the darkest accessible skies in the country, the edge of the Empty Quarter, a wadi in the northern mountains. Each design is original artwork, printed or embroidered on heavyweight 230gsm combed ring-spun cotton, and made in limited runs.\n\nThree designs, two fits. Al Quaa Galaxy and Hajar Mountains are printed direct to garment, so the ink sits in the cotton rather than on top of it; Empty Quarter is embroidered. Each comes in a straight Regular fit or a drop-shoulder Oversized, S to XL. If you are buying in Dubai or anywhere in the UAE, delivery is free and arrives the next working day on orders placed by 2 pm.",
    sections: [
      { h2: 'What makes these different from a souvenir t-shirt', body: "A souvenir shirt is designed to be recognised by a tourist. Ours are designed to be recognised by someone who has been there.\n\nThe Al Quaa design maps the Milky Way as it actually rises over one of the darkest accessible skies in the Emirates, far enough south that no city glow reaches it. The Empty Quarter design is a tonal embroidered sun over the dune ridges of Liwa. The Hajar design reduces the peaks above Wadi Naqab to contour lines. If you know the place, the design reads instantly. If you do not, it still works as a graphic." },
      { h2: 'The fabric, plainly', body: "All our t-shirts are 230gsm, 100% combed ring-spun cotton. That is a heavyweight — noticeably more substantial than a standard 150–180gsm shirt — which is what gives it structure so it hangs properly instead of clinging.\n\nEvery piece has a ribbed crew neck that holds its shape, and taped collar and shoulder seams so the shirt survives washing. Printed graphics are direct-to-garment, which sits the ink into the cotton rather than laying a plastic panel across your back, so the fabric still breathes. The Al Quaa and Hajar designs pair that print with an embroidered logo, and the Empty Quarter design is embroidered throughout, with no print at all — so every piece in the range carries stitching somewhere." },
      { h2: 'Regular and oversized fits', body: "The t-shirts are cut unisex — one cut worn by everyone, no separate men's and women's versions — in sizes S to XL, and each design comes in both a Regular and an Oversized fit. The polo is a men's cut, S to XL, in one fit. Regular is a classic straight cut that layers cleanly under a shacket or jacket. Oversized is a relaxed, wider cut with a dropped shoulder, designed to be worn on its own.\n\nFull flat-lay measurements for both fits are on our size guide." },
      { h2: 'Limited runs', body: "Each design is produced as a limited first run. When a size sells out, we may or may not make it again — and we will not promise that we will. We would rather make a small number of things properly than keep a warehouse full of everything." }
    ],
    related: [['/national-day/', 'UAE National Day t-shirts', 'For Eid Al Etihad, 2 December'], ['/gifts/', 'Gifts from the UAE', 'Leaving gifts that are not touristy']],
    faqs: [
      ['Where do you ship?', 'We ship worldwide from Dubai. In the UAE: free next-day delivery to all seven emirates, with no minimum order — order by 2 pm and it arrives the next working day. GCC (Saudi Arabia, Qatar, Oman, Bahrain, Kuwait): 3–5 working days, AED 50, free over AED 390. Everywhere else: 7–14 working days, AED 80. Any import duties on international orders are payable on arrival. Exact cost always appears at checkout before you pay.'],
      ['What size should I order?', 'Every t-shirt design comes in Regular and Oversized fits, S to XL; the polo comes in one fit. Our size guide has full flat-lay measurements, plus a method for measuring a t-shirt you already own to find your match.'],
      ['What is the cotton, exactly?', '100% combed ring-spun cotton at 230gsm, with no polyester. Combing strips out the short fibres and ring-spinning twists what remains into a smoother, stronger yarn — that is where the weight and the hand come from. We describe the yarn we actually buy and make no certification claims we cannot show you.'],
      ['Will designs be restocked?', 'Each design is a limited run. We may make more of a design later, but we do not promise it. When a size sells out in a run, treat it as gone.']
    ]
  },
  {
    /* SEO plan (1 Oct 2026): live by 10 Oct for "uae national day t shirt" and "national day gifts uae".
       Facts: Eid Al Etihad, 2 December; the union of 2 Dec 1971 (six emirates; Ras Al Khaimah joined
       10 Feb 1972); the 53rd was in 2024 (Khaleej Times, 12 Nov 2024), so 2026 is the 55th. No holiday
       dates are stated: they are announced by the government each year. */
    slug: 'national-day', emoji: '✦', cat: 'Dunes',
    h1: 'UAE National Day 2026: Eid Al Etihad T-Shirts & Gifts',
    title: 'UAE National Day 2026 T-Shirts & Gifts — Eid Al Etihad',
    items: ['al-quaa-galaxy-regular', 'al-quaa-galaxy-oversized', 'hajar-mountains-regular', 'hajar-mountains-oversized', 'empty-quarter-regular', 'empty-quarter-oversized', 'sand-polo'],
    desc: 'T-shirts for Eid Al Etihad drawn from real UAE places: the Al Quaa night sky, the Hajar peaks, the Liwa dunes. 230gsm cotton, free next-day UAE delivery.',
    lede: 'For Eid Al Etihad on 2 December: shirts drawn from the land itself',
    foldsTitle: 'Choosing, timing and gifting',
    intro: "A t-shirt drawn from a real place in the Emirates, to give or wear for Eid Al Etihad, UAE National Day, on Wednesday 2 December 2026.\n\nOn 2 December the UAE marks Eid Al Etihad, its National Day: the anniversary of the union of 1971, when six emirates came together as one country, with Ras Al Khaimah joining in February 1972. This year is the 55th.\n\nMost National Day t-shirts carry a slogan. Ours carry a place. Each design is drawn from somewhere real in the Emirates: the Milky Way rising over the desert at Al Quaa in Abu Dhabi, the Hajar peaks above Wadi Naqab in Ras Al Khaimah, and the dune ridges of Liwa at the edge of the Empty Quarter. They are shirts to wear on the day, and every weekend after it.",
    sections: [
      { h2: 'Which design for which person', body: "Al Quaa Galaxy is the Milky Way over Al Quaa, one of the darkest accessible skies in the Emirates, printed across the back of a black tee. It suits the person who drives out of the city to look at the stars.\n\nHajar Mountains is a topographic line drawing of the Hajar peaks, printed on grey. It is the one for hikers and anyone who heads for Ras Al Khaimah when the weather turns.\n\nEmpty Quarter is a tonal sun setting over the dunes of Liwa, embroidered on beige with no print at all. It suits desert drivers and anyone who prefers a quieter shirt.\n\nThe Sahra Polo is 240gsm piqué with an embroidered mark, for someone who would rather wear a collar.\n\nEvery tee is 230gsm combed cotton, AED 199, in Regular or Oversized, sizes S to XL. Any two tees are AED 359." },
      { h2: 'Getting it in time for 2 December', body: "In the UAE, orders placed by 2 pm on a working day are dispatched the same day and delivered the next working day, free, with no minimum order. Public holidays are not working days, so order a few days before the National Day holiday rather than on the eve.\n\nGCC orders (Saudi Arabia, Qatar, Oman, Bahrain, Kuwait) take 3 to 5 working days, at AED 50 or free over AED 390. The rest of the world takes 7 to 14 working days, at AED 80." },
      { h2: 'Giving it as a gift', body: "Tick 'This is a gift' in your bag and add a message: we include it with the order. Every order comes with the Sahra Tote, free. If the size is wrong, exchanges within the UAE are free within 14 days of delivery, as long as the shirt is unworn with its tags on." },
      { h2: 'Wear the place, then go there', body: "The National Day weekend falls in the cool season, the best time of year to see the places behind the designs. Each one has its own guide: how to get there, when to go, the real risks and what to pack." }
    ],
    related: [
      ['/locations/al-quaa-desert/', 'Al Quaa Desert', 'The night sky behind Al Quaa Galaxy'],
      ['/locations/wadi-naqab/', 'Wadi Naqab', 'The peaks behind Hajar Mountains'],
      ['/locations/liwa/', 'Liwa', 'The dunes behind Empty Quarter'],
      ['/gifts/', 'Gifts from the UAE', 'More ideas for someone leaving, visiting or missing the desert'],
      ['/t-shirts/oversized/', 'Oversized fit', 'All three designs, true drop shoulder'],
      ['/polos/', 'The Sahra Polo', '240gsm piqué, embroidered']
    ],
    faqs: [
      ['Do you sell UAE National Day t-shirts?', "Yes, though not flag prints. Our tees are drawn from real places in the Emirates: the Al Quaa night sky, the Hajar peaks at Wadi Naqab and the Liwa dunes. Each is AED 199 in Regular or Oversized, sizes S to XL."],
      ['Will my order arrive before 2 December?', "In the UAE, orders placed by 2 pm on a working day are delivered the next working day. Public holidays are not working days, so order a few days ahead of the National Day holiday. GCC orders take 3 to 5 working days."],
      ['Can I send it as a gift?', "Yes. Tick 'This is a gift' in your bag and add a message, and we include it with the order. Every order also comes with the Sahra Tote, free."],
      ['How much do they cost?', "Every tee is AED 199, and any two tees are AED 359. The Sahra Polo is AED 229. UAE delivery is free with no minimum order."],
      ['What is Eid Al Etihad?', "It is the name used for the UAE's National Day celebrations on 2 December, which mark the union of the emirates in 1971. Eid Al Etihad means the celebration of the union."]
    ]
  },
  {
    slug: 'gifts', emoji: '✦', cat: 'Camping',
    items: ["al-quaa-galaxy-regular", "al-quaa-galaxy-oversized", "hajar-mountains-regular", "hajar-mountains-oversized", "empty-quarter-regular", "empty-quarter-oversized", "sand-polo"],
    h1: 'Gifts from the UAE',
    foldsTitle: 'Choosing and giving',
    title: "UAE Souvenirs & Gifts for Him That Aren't Touristy",
    desc: 'A gift from the UAE that is not a fridge magnet. Original t-shirts tied to real Emirati places — for someone leaving, visiting, or missing the desert.',
    intro: "Buying a gift from the UAE usually means choosing between a fridge magnet, a camel keyring, or a t-shirt with the Dubai skyline printed across the front. All of them say the same thing: I went to a shop at the airport.\n\nA Sahra & Beyond t-shirt says something more specific. Each one is tied to a real place in the Emirates — somewhere the person you are buying for has probably actually been. That is a very different gift from a souvenir.",
    sections: [
      { h2: 'For UAE National Day', body: "For Eid Al Etihad on 2 December, a shirt drawn from a real place in the Emirates says more than a flag print: the Al Quaa night sky, the Hajar peaks or the Liwa dunes. Order a few days before the National Day holiday, since UAE delivery runs on working days. Our National Day page has the designs side by side." },
      { h2: 'A leaving gift for someone moving away', body: "This is the one we hear about most. Someone has spent five, ten, twenty years here, and they are going home. What do you give them?\n\nA skyline t-shirt is a joke gift. But a shirt carrying the night sky over Al Quaa, or the dune ridges of Liwa, is a specific memory of a specific place — the kind of thing that gets kept and worn rather than put in a drawer. If they camped in the desert, drove out to see the stars, or hiked the wadis, they will recognise it immediately." },
      { h2: 'For someone who loves the outdoors here', body: "If the person you are buying for spends their weekends camping, dune driving, stargazing or hiking, the design will land. Each of our t-shirts comes from a place they can drive to, and every product page tells the story of that place — including the coordinates.\n\nHeavyweight 230gsm combed cotton means it is a shirt they will actually keep wearing, not a novelty they wear once." },
      { h2: 'For a visitor who wants something real', body: "Visitors often want something from the UAE that is not obviously made for visitors. A limited-run t-shirt from a small local brand, tied to a place beyond the city, is a better answer than anything in the departures hall — and it packs flat." },
      { h2: 'Practical things', body: "All our t-shirts are AED 199 and come in Regular and Oversized fits. The Sahra Polo is AED 229 and comes in one fit. The t-shirts are cut unisex and the polo is a men's cut, all in S to XL. In the UAE, delivery is next working day to all seven emirates for orders placed by 2 pm, and free with no minimum order — and we now ship worldwide too. Exact delivery cost is always shown at checkout before you pay.\n\nIf you are unsure about size, exchanges within the UAE are free within 14 days of delivery, as long as the piece is unworn with tags attached. If you are buying as a gift and want to be certain, email us and we will help you choose." }
    ],
    related: [['/national-day/', 'UAE National Day t-shirts', 'Eid Al Etihad, 2 December']],
    faqs: [
      ['What is a good leaving gift for an expat in the UAE?', 'Something tied to a specific place they know rather than a generic city souvenir. Our t-shirts are each based on a real location in the Emirates — the dark sky at Al Quaa, the dunes at Liwa, the Hajar mountains — so the gift is a memory of somewhere they have actually been.'],
      ['Can I exchange it if the size is wrong?', 'Yes. Exchanges within the UAE are free within 14 days of delivery, subject to stock, as long as the item is unworn, unwashed and still has its tags.'],
      ['How much do they cost?', 'Every t-shirt in the collection is AED 199. The Sahra Polo is AED 229. Delivery is calculated at checkout.'],
      ['Do you ship outside the UAE?', 'Yes — worldwide, from Dubai. GCC orders (Saudi Arabia, Qatar, Oman, Bahrain, Kuwait) arrive in 3–5 working days at AED 50, free over AED 390. The rest of the world is 7–14 working days at AED 80. Any import duties are payable on arrival.']
    ]
  },
  {
    slug: 'fabric', emoji: '▦', cat: 'Mountains',
    related: [['/products/al-quaa-galaxy-regular/', 'Al Quaa Galaxy — Regular', '230gsm tee, DTG print'], ['/products/al-quaa-galaxy-oversized/', 'Al Quaa Galaxy — Oversized', '230gsm tee, DTG print'],
      ['/products/hajar-mountains-regular/', 'Hajar Mountains — Regular', '230gsm tee, DTG print'], ['/products/hajar-mountains-oversized/', 'Hajar Mountains — Oversized', '230gsm tee, DTG print'],
      ['/products/empty-quarter-regular/', 'Empty Quarter — Regular', '230gsm tee, embroidered'], ['/products/empty-quarter-oversized/', 'Empty Quarter — Oversized', '230gsm tee, embroidered'],
      ['/products/sand-polo/', 'The polo', '240gsm piqué, embroidered']],
    h1: 'Our fabric and construction',
    title: 'T-Shirt GSM Explained: What 230gsm Means in UAE Heat',
    desc: 'GSM explained properly: the full 150–280gsm scale, what 230gsm feels like next to the 180gsm you already own, and which weight actually suits a Gulf summer.',
    gsmTable: true,
    intro: "Most t-shirt brands describe fabric in adjectives. Premium. Buttery. Luxe. None of those words mean anything you can check.\n\nThere is one number that does, and it is usually buried in a bullet list with no explanation: GSM. This page explains what it measures, what each point on the scale actually feels like to wear, which weight makes sense in this climate, and the specifications of what we make. If you only read one section, read the one on UAE summers.",
    sections: [
      { h2: 'What the number actually changes', body: "GSM is grams per square metre — literally, what a square metre of the cloth weighs. It is not a quality score. A 280gsm shirt is not better than a 180gsm one; it is a different garment for a different purpose, and the number tells you which.\n\nWhat it changes is structure. A lightweight cloth drapes onto the body, follows every line underneath it and shows what you are wearing beneath. A heavyweight one holds its own shape and hangs away from you. That is the whole difference, and it is why weight determines how a shirt looks far more than the cut does.\n\nIt also predicts lifespan. There is simply more cotton in a heavier shirt, so there is more to lose before it goes thin, and the collar has more to hold on to before it stretches out — which is how most t-shirts visibly die, long before they wear through.\n\nOurs are 230gsm. That is heavyweight, two full steps above the high-street default." },
      { h2: 'Which weight for a UAE summer', body: "The honest answer is that no cotton t-shirt is a hot-weather technical garment, and any brand telling you their heavyweight tee is cooling is selling you something.\n\nWhat actually governs how a cotton shirt wears in 45°C is not the weight on the label but how much of it is touching you. Cotton moves heat away from skin by absorbing moisture; it does that whatever it weighs. What changes is airflow. Cloth held slightly off the skin lets air move underneath it. Cloth pulled taut against the skin does not.\n\nSo the useful guidance is the opposite of what people assume. If you are choosing for peak summer, the looser cut matters more than the lighter cloth. Our Oversized fit is the same 230gsm cotton as the Regular, cut 3.5″ wider through the chest at M with the shoulder seam dropped below the natural shoulder point — which means the fabric sits away from you rather than against you. That gap is doing more work than fifty grams either way would.\n\nThe rest is ordinary sense: light colours reflect more than dark ones, and a shirt you wear in the evening at Al Quaa is a different problem from one you wear at noon in August. We would rather say that plainly than claim a fabric property we cannot demonstrate." },
      { h2: '180 versus 230: what fifty grams buys', body: "This is the comparison worth understanding, because 180gsm is what you are almost certainly wearing now and 230gsm is what most people mean when they say a shirt feels expensive.\n\nAt 180gsm the cloth is thin enough to follow the body. In strong light you can often see the outline of what is underneath, and the shoulder seams show through. It is comfortable immediately and it stays that way, but it has little structure — the shape you get is your shape, not the garment's.\n\nAt 230gsm the cloth has enough body to stand slightly away from you. The hem hangs straight instead of clinging, the sleeve holds a line rather than collapsing, and nothing reads through it. It is a more substantial thing to put on, which some people love and some people do not, and that is a preference rather than a fact.\n\nThe durability difference is not a preference. Fifty grams per square metre is roughly a third more cotton, and it shows up in how long the shirt keeps its shape rather than in how it feels on day one. That is the trade you are making, and it is the reason we made it." },
      { h2: 'Weight is only half the story', body: "Two shirts at the same GSM can feel completely different, which is why weight alone is not enough to judge a garment by.\n\nHow the yarn is made matters. Ours is combed, ring-spun cotton. Combing strips the shorter fibres out before spinning and ring-spinning twists what remains into a finer, smoother yarn — so the same weight of cloth comes out denser and smoother rather than fuzzy. It is the difference between a heavyweight shirt that feels considered and one that just feels thick.\n\nHow it is knitted matters too. The tees are a jersey knit. The Sahra Polo is 240gsm piqué, and those ten grams are not the real difference between them — piqué is a different structure entirely, a fine waffle formed by how the yarn interlocks, which is what gives a polo its particular hand and lets a collar hold its shape instead of curling.\n\nAnd whether the cotton was pre-shrunk before cutting matters, because otherwise the number on the label describes a shirt you will not own after the first wash. Ours is." },
      { h2: 'Why 100% cotton, combed and ring-spun', body: "We use 100% cotton with no polyester in the blend. A poly-cotton shirt is cheaper to make and holds a print slightly longer, but it traps heat — which is the wrong trade in the Gulf. Cotton is fully breathable, which is not optional in this climate, and it takes direct-to-garment ink better than a blend, giving a sharper print.\n\nThe cotton is combed and ring-spun, and we describe it as exactly that. Combing removes the short fibres before spinning; ring-spinning twists the long ones that remain into a finer, smoother, stronger yarn. That is what makes a 230gsm cloth feel dense and considered rather than merely thick — and it is a description of the yarn we actually buy, not a label we cannot substantiate." },
      { h2: 'Ribbed collar, taped seams', body: "The collar is a ribbed crew neck. Ribbing is knitted with more elasticity than the body fabric, so the neckline returns to shape instead of stretching out and going wavy — which is how most t-shirts visibly die.\n\nThe collar and shoulder seams are taped: a strip of fabric bound over the seam on the inside. It stops the shoulders from twisting over time and takes the strain off the stitching. It is a small manufacturing cost that shows up years later." },
      { h2: 'DTG printing versus embroidery', body: "Two of our designs carry a printed graphic. DTG sprays ink into the fibres rather than laying a film on top, so the graphic stays soft, the fabric keeps breathing, and there is no plastic panel across your back. It flexes with the cotton and is far less prone to cracking than a thick plastisol print. On both of those designs the logo itself is embroidered — so a single shirt carries two techniques, ink and thread.\n\nThe Empty Quarter design goes further and is embroidered throughout, with no print at all — thread stitched into the cloth, tonal against the fabric. Embroidery has a raised texture you can feel, catches light differently through the day, and tends to hold its colour better than a print over time. The polo is embroidered too." },
      { h2: 'How to make it last', body: "Wash cold and inside out. Heat is what fades a print fastest, and washing inside out protects both print and embroidery from abrasion.\n\nHang to dry rather than tumble drying — tumble drying is the main cause of both shrinkage and cracking. Skip fabric softener; it coats the fibres and dulls the finish. Do not iron directly onto a print." },
      { h2: 'Where it is made', body: "Our fabric is sourced from Pakistan, one of the world's major cotton-producing countries. The designs are created here in the UAE. We say designed in the UAE rather than made in the UAE, because that is the accurate description." }
    ],
    faqs: [
      ['What is GSM on a t-shirt?', 'GSM is grams per square metre — what a square metre of the fabric weighs. It is a measure of weight, not of quality. Roughly: 150gsm is promotional and fast-fashion weight, 180gsm is the high-street standard, 230gsm is heavyweight, and 280gsm is approaching sweatshirt territory. The number tells you how much structure a shirt has and how long it will hold its shape. Our t-shirts are 230gsm and the polo is 240gsm piqué.'],
      ['Is 230gsm too hot for the UAE?', 'It is a heavyweight tee, so it is more substantial than a thin fast-fashion shirt. But weight is not what governs how a cotton shirt wears in the heat — airflow is. Cloth held slightly off the skin lets air move underneath it; cloth pulled taut against the skin does not. So for peak summer the looser cut matters more than the lighter cloth, and our Oversized fit sits further off the body than the Regular. It is 100% cotton with no polyester in it, because a poly blend traps heat. No cotton t-shirt is a technical hot-weather garment, and we would rather say that than claim otherwise.'],
      ['What is the difference between 180gsm and 240gsm?', 'About a third more cotton, and it shows up in structure and lifespan rather than on day one. At 180gsm — the high-street default — the cloth follows the body, and in strong light you can often see what is underneath. At the 230–240gsm end it stands slightly away from you, the hem hangs straight instead of clinging, and the collar has enough material to keep its shape rather than going wavy. Neither is better in the abstract; 180gsm is lighter to wear and 240gsm lasts considerably longer.'],
      ['Does a higher GSM shrink more?', 'Not by itself. Shrinkage is determined by whether the cotton was pre-shrunk before cutting and by how you wash it, not by how much the fabric weighs. Our cotton is pre-shrunk before cutting, so you should see very little movement. What does cause shrinkage, at any weight, is a hot wash and a tumble dryer — heat is what makes untreated cotton fibres contract. Wash cold and hang dry and weight becomes irrelevant to the question.'],
      ['Will the print crack?', 'DTG ink bonds into the cotton rather than sitting on top as a thick layer, so it flexes with the fabric and is far less prone to cracking than a thick plastisol print. Washing cold and hanging to dry rather than tumble drying is what makes the difference long term.'],
      ['Will it shrink?', 'The fabric is pre-washed to minimise shrinkage. Wash cold, hang dry, and you should see very little movement. Hot washes and tumble dryers cause shrinkage.'],
      ['Is the cotton certified?', 'It is 100% combed ring-spun cotton, with no polyester. We do not hold a fibre certification such as GOTS and we will not imply one — if that changes, it will be stated here with the certificate number.']
    ]
  },
  {
    slug: 'size-guide', emoji: '▱', cat: 'Coast',
    h1: 'T-shirt size and fit guide',
    title: 'T-Shirt Size Guide — Regular & Oversized Fit',
    desc: 'Flat-lay measurements for every Sahra & Beyond t-shirt in Regular and Oversized fits, plus how to measure a t-shirt you already own to find your size.',
    intro: "Our t-shirts are cut unisex — one cut worn by everyone, in sizes S to XL, with no separate men's or women's version — and each design comes in two fits, Regular and Oversized. The polo is a men's cut, S to XL, in one fit. Every figure below is a garment measurement taken flat, not a body measurement, and comes straight from the graded specification our manufacturer produced against. Both inches and centimetres are shown.",
    sizeTable: true,
    sections: [
      { h2: 'Regular or oversized?', body: "Regular is a classic straight cut with the shoulder seam at your natural shoulder, and it layers cleanly under a shacket or jacket. Check your size in the chart before you order: measure a shirt you like flat, pit to pit, and match the number.\n\nOversized is a deliberately wider cut with a dropped shoulder and more room through the body. It is designed to be worn on its own rather than layered. The oversized cut already adds width, so compare the chart rather than going by the letter." },
      { h2: 'How to find your size without guessing', body: "The most reliable method is to measure a t-shirt you already own and like the fit of.\n\nLay it flat on a table and smooth out the wrinkles. Measure the chest straight across, from one armpit seam to the other — that is the flat chest measurement, and it is the number to compare against the tables above. Then measure the length from the highest point of the shoulder straight down to the hem.\n\nMatch those two numbers to the closest size in the table. If you fall between two sizes, go up for the Regular fit and down for the Oversized." },
      { h2: 'If you order the wrong size', body: "Exchanges within the UAE are free within 14 days of delivery, subject to stock, as long as the piece is unworn, unwashed and still has its tags. Email hello@sahraandbeyond.ae with your order number and we will arrange it.\n\nIf you would rather get it right first time, email us before you order and we will talk you through it." }
    ],
    faqs: [
      ['Are these unisex?', 'The t-shirts are: every tee is cut unisex, S to XL, with no separate men\'s or women\'s version. The polo is a men\'s cut. Because the tables above give the garment measured flat rather than a body size, measure a t-shirt you already like the fit of and match the numbers. Both fits are the same garment for everyone; the chart decides the letter.'],
      ['How do I measure my t-shirt size?', 'Lay a t-shirt you already own flat, measure straight across from armpit seam to armpit seam for the flat chest measurement, then from the top of the shoulder down to the hem for length. Compare both to the tables above.'],
      ['How do I pick my size?', 'Use the size chart. Measure a t-shirt you already like flat, armpit to armpit, and pick the size with the closest number. The oversized cut already adds width and a dropped shoulder, so compare the numbers rather than the letter.'],
      ['Are exchanges free?', 'Yes, within the UAE, within 14 days of delivery and subject to stock, as long as the item is unworn, unwashed and still has tags.']
    ]
  }
];


const CATEGORIES = [
  /* Themed collections (Faheem, 23 Sep). Search Console showed 5 clothing
     queries out of 361 in three months: people search by what is ON the shirt
     ("mountain t-shirt", "desert tee", "galaxy shirt"), and a collection page
     is what Google ranks for a generic search like that, ahead of any single
     product. pick() filters by design rather than by the single-valued
     category, so the same tee can sit in its fit page AND its theme page. */
  { slug:'mountain-t-shirts', cat:'theme-mountain', emoji:'▲', catBg:'Mountains',
    places: ['hajar-mountains', 'wadi-naqab', 'jebel-jais', 'jabal-yanas', 'wadi-showka', 'hatta'],
    pick: p => /^hajar-mountains-/.test(p.id),
    h1:'Mountain T-Shirts',
    title:'Mountain T-Shirts & Graphic Tees — Hajar Mountains, UAE',
    desc:'Mountain t-shirts drawn from the Hajar range in the UAE: the peaks in contour lines on the front, red rock printed across the back. 230gsm cotton, two fits.',
    intro:"Most mountain t-shirts carry a peak that could be anywhere — a stock silhouette with a slogan underneath. Ours has one range on it, and it is this country's: the Hajar Mountains, which run through the northern Emirates and on into Oman.\n\nThe design takes the language of a topographic map literally. The peaks on the front are reduced to contour lines; the red rock itself is printed across the back, with the coordinates beneath it. It is inspired by Wadi Naqab, a seasonal wadi high in the Hajar below Jebel Yanas, in Ras Al Khaimah.\n\nOne design, two cuts: a straight Regular and a true drop-shoulder Oversized.",
    sections: [
      { h2: 'Printed, and where', body: "The mountain graphic is printed direct to garment: the ink goes into the cotton rather than sitting on top of it as a film, so it stays soft and the fabric keeps breathing. The small mark above it is embroidered." },
      { h2: 'The cloth and the fit', body: "230gsm combed ring-spun cotton, in Flint Gray, cut unisex in S to XL.\n\nRegular is a straight cut with a set shoulder. Oversized has a true dropped shoulder, the seam sitting 2–3″ below your natural shoulder, so the width reads as a shape rather than a bigger shirt. Check your size in the chart before you order." }
    ],
    faqs: [
      { q:'Is this a hiking shirt?', a:'No, and we would rather say so. It is a heavyweight cotton t-shirt, not a technical garment — it will not wick sweat the way a synthetic hiking shirt does. It is made for the drive out, the evening at camp and everywhere after.' },
      { q:'Which mountains are on it?', a:'The Hajar Mountains, the range that runs through the northern Emirates and into Oman. The design is inspired by Wadi Naqab, below Jebel Yanas in Ras Al Khaimah.' },
      { q:'How much is it, and how fast is delivery?', a:'AED 199, in Regular or Oversized. In the UAE, delivery is free and arrives the next working day when you order by 2 pm.' }
    ] },
  { slug:'desert-t-shirts', cat:'theme-desert', emoji:'◠', catBg:'Dunes',
    places: ['al-quaa-desert', 'liwa', 'moreeb-dune', 'empty-quarter', 'big-red', 'mleiha-desert'],
    pick: p => /^(empty-quarter|al-quaa-galaxy)-/.test(p.id),
    h1:'Desert T-Shirts',
    title:'Desert T-Shirts & Graphic Tees — Liwa and Al Quaa, UAE',
    desc:'Desert t-shirts from the UAE: an embroidered sun over the dunes of Liwa, and the Milky Way over Al Quaa. 230gsm cotton, in Regular and Oversized fits.',
    intro:"Two of our designs come from the desert, and they come from opposite ends of the same day.\n\nThe Empty Quarter tee is the evening: a tonal sun setting over the dune ridges of Liwa, on the northern edge of the Rub' al Khali. It is embroidered rather than printed — thread laid into the cloth, sand on sand.\n\nThe Al Quaa Galaxy tee is the night that follows: the Milky Way as it rises over Al Quaa, one of the darkest accessible skies in the Emirates, printed across the back with a small embroidered mark on the chest.\n\nBoth come in a straight Regular and a true drop-shoulder Oversized.",
    sections: [
      { h2: 'Embroidered or printed', body: "The two desert designs are made differently, on purpose. The Empty Quarter is embroidered throughout, with no print anywhere on it. The Al Quaa Galaxy is printed direct to garment across the back — the ink goes into the cotton rather than sitting on top — with the mark on the chest embroidered." },
      { h2: 'The cloth and the fit', body: "230gsm combed ring-spun cotton, cut unisex in S to XL.\n\nRegular is a straight cut with a set shoulder. Oversized has a true dropped shoulder, the seam sitting 2–3″ below your natural shoulder. Check your size in the chart before you order." }
    ],
    faqs: [
      { q:'Are these made for the desert heat?', a:'They are 230gsm cotton — heavier than a standard t-shirt, and not a technical garment. In the heat, fit matters more than weight: cloth held slightly off the skin moves more air, which is where the Oversized cut helps. Most people wear them for the drive out and the evening, once it cools.' },
      { q:'Where are Liwa and Al Quaa?', a:"Both are in Abu Dhabi. Liwa sits on the northern edge of the Empty Quarter, the largest continuous sand desert in the world; Al Quaa is inland in the south-east, far from city light." },
      { q:'How much are they, and how fast is delivery?', a:'AED 199 each, in Regular or Oversized. In the UAE, delivery is free and arrives the next working day when you order by 2 pm.' }
    ] },
  { slug:'t-shirts/regular', cat:'regular-tees', emoji:'▭', catBg:'Dunes',
    h1:'Regular Fit T-Shirts',
    title:'Regular Fit T-Shirts — UAE Designs | Sahra & Beyond',
    desc:'Our regular fit t-shirts — a straight, precise cut with a set shoulder. 230gsm combed cotton, original UAE designs, S–XL. Limited runs, delivered across the UAE.',
    intro:"Regular is the fit to take if you layer. It sits on the shoulder and falls straight rather than hanging off it, with a 2″ chest step per size above M. Check the size chart before you order.\n\nEvery design in the collection comes in this fit, cut unisex, in sizes S to XL. Same 230gsm combed ring-spun cotton, same ribbed collar and taped seams as the oversized cut; the difference is entirely in the silhouette.",
    sections: [{"h2": "A straight cut, measured rather than felt", "body": "Letters mean different things at different brands, so go by the numbers. The Regular fit follows classic US/international grading: the shoulder seam sits at your natural shoulder point rather than dropped below it, and the body skims rather than hanging.\n\nMeasured flat, pit to pit: S is 19″, M is 20″, L is 22″ and XL is 24″ — a 2″ step per size above M. Those are garment measurements taken flat, not body measurements, and they come straight from the graded specification our manufacturer produced against. Every measurement holds a tolerance of ±0.5″; anything outside it is rejected at QC before it ships.\n\nThat precision is the point. If you know the flat chest measurement of a shirt you already like, you know your size here without guessing what a given brand means by Regular."}, {"h2": "How to use the measurements", "body": "Take a t-shirt you already own and wear happily. Lay it flat, smooth out the creases, and measure straight across from armhole seam to armhole seam, about an inch below the armhole. That single number is directly comparable to ours — do not double it. Our chart is flat garment measurements throughout, so 20″ on your shirt means our M.\n\nThe step is fixed and known: 2″ per size above M. If your measurement lands between two sizes, the ±0.5″ tolerance gives some room either way. Take the smaller size for a closer fit through the chest and shoulders, the larger for more ease.\n\nThe cut is unisex, S to XL. There is no separate men's or women's grade, and we do not produce an XXL — so the chart above is the whole range, not a subset of it."}, {"h2": "What the construction is doing", "body": "Every Regular tee is 230 GSM combed, ring-spun cotton. Combing removes the shorter fibres before spinning, which is what gives the cloth its smooth, dense hand instead of a looser, hairier surface.\n\nFrom there the details are about longevity rather than decoration. The shoulders carry woven shoulder taping — not cotton tape — which stops the seam stretching out under the weight of the garment over time. Seams are double-stitched. The body is side-seamed, built from front and back panels joined at the sides rather than a single tube, which holds its shape far better through repeated washing.\n\nThe cotton is pre-shrunk before cutting, so the fit you measure is close to the fit you keep. And the collar label is printed rather than woven, because a woven label against the back of the neck is a common source of irritation and we would rather you forget it is there."}, {"h2": "Layering", "body": "A true-to-size cut is a layering cut. Because the Regular fit follows the measurements rather than adding hidden room, it sits cleanly under an overshirt or light knit without bulking the silhouette — a base layer that disappears rather than competing with what is over it.\n\nIt works alone too. At 230 GSM there is enough substance to stand on its own through the warmer months without clinging or showing every seam beneath an open shirt.\n\nAnd because the grading is fixed and published, building a wardrobe from a few pieces stays simple. Your size in one Sahra & Beyond Regular tee is your size in all of them, and in the polo, which is graded to the same specification."}],
    faqs: [{"q": "How do I choose my Regular size?", "a": "Use the chart. Measured flat, pit to pit, M is 20″, L is 22″ and XL is 24″, with the shoulder seam at your natural shoulder point. Measure a shirt you like and match the number. Tolerance is ±0.5″."}, {"q": "How do I measure myself for the right size?", "a": "Do not measure yourself — measure a shirt. Lay a t-shirt you already like flat and measure straight across from armhole seam to armhole seam, an inch below the armhole. Compare that number directly to our chart. Our figures are flat garment measurements, so there is no doubling involved."}, {"q": "My measurement falls between two sizes.", "a": "There is a ±0.5″ tolerance on every measurement, so you have some latitude. Take the smaller size to sit closer to the body, the larger for more ease through the chest. The shoulder seam position does not change between sizes."}, {"q": "What does the fabric feel like?", "a": "Dense and smooth rather than thin. It is 230 GSM combed, ring-spun cotton — combing strips out the shorter fibres before spinning, which is what produces that hand. Enough weight to hold its shape through a day without feeling heavy."}, {"q": "Will it shrink?", "a": "The cotton is pre-shrunk before cutting, so you should not see meaningful shrinkage. A cool wash and air drying will keep both the fabric and the shape at their best."}, {"q": "What are delivery and returns?", "a": "UAE: free next-day delivery to all seven emirates for orders placed by 2 pm, no minimum order. GCC: 3–5 working days, free over AED 390. Worldwide: 7–14 working days. Returns and exchanges are accepted for 14 days, unworn with tags attached — free within the UAE; international customers cover return shipping."}] },
  { slug:'t-shirts/oversized', related: [["/national-day/", "UAE National Day t-shirts", "Eid Al Etihad, 2 December"], ["/gifts/", "Gifts from the UAE", "For leaving gifts and visitors"]], cat:'oversized-tees', emoji:'▯', catBg:'Camping',
    h1:'Oversized T-Shirts in Dubai & the UAE',
    title:'Oversized T-Shirts Dubai & UAE — Heavyweight Tees',
    desc:'Oversized drop-shoulder t-shirts. The seam sits 2–3 inches below your natural shoulder — width, not length, makes the silhouette. 230gsm cotton, S–XL.',
    intro:"This is a true oversized cut, not a size up. The shoulder seam is deliberately dropped 2–3″ below your natural shoulder point and the body is cut wider, so the shape reads as a silhouette rather than a big t-shirt.\n\nCut unisex, S to XL. Take your normal size for the intended fit; size down only if you want it slightly loose. Designed to be worn on its own — a fitted jacket fights the drop shoulder. Sizes S to XL.\n\nIt wears the way streetwear does, with straight or wide trousers and clean trainers, and the 230gsm cotton is heavy enough that the drop shoulder holds its line instead of collapsing.",
    sections: [{"h2": "What a real drop shoulder is", "body": "There is a meaningful difference between an oversized cut and simply buying your usual size up, and it comes down to where the shoulder seam sits.\n\nIn the Regular fit that seam stays at your natural shoulder point at every size. Going up a size adds width through the chest, but the shoulder does not move — you get a roomier version of the same silhouette. A true drop shoulder is a different pattern, not a larger copy of the same one. On the Oversized fit the seam is set 2–3″ below the natural shoulder point, out over the arm.\n\nThat is what creates the shape. Not extra fabric hanging off a standard cut, but a garment drafted from the start to sit differently on the body. It is why sizing up in a Regular and taking the Oversized in your usual size produce genuinely different results, even at a similar chest measurement."}, {"h2": "Width, not length", "body": "At M the Oversized measures 23.5″ across the chest against 20″ for the Regular — 3.5″ more at the same letter, measured flat, pit to pit. That difference is doing the work people often credit to length. The Oversized tee is not dramatically longer; it is wider, and width combined with the dropped seam is what builds the silhouette.\n\nThe full range, flat: S is 22.5″, M is 23.5″, L is 25″ and XL is 26.5″. Note that the step differs from the Regular fit — 1.5″ per size above M here, against 2″ there — so the two charts are not interchangeable and the gap between the fits narrows slightly as the sizes go up. Tolerance is ±0.5″ on every measurement.\n\nThe effect is a garment that sits away from the chest and shoulders rather than skimming them, with the sleeve opening set further along the arm."}, {"h2": "Why a looser cut wears cooler", "body": "In UAE heat, how cloth sits against skin matters as much as the cloth itself. The extra width through the chest and shoulders means the 230 GSM cotton is not pulled taut against the body — there is room for air to move between fabric and skin instead of the shirt sitting flush.\n\nThis is a function of the cut, not of anything special about the fabric. It is the same combed, ring-spun cotton used across the Regular fit and the polo, simply draped more loosely because of the drop shoulder and the wider chest. A looser garment also moves more independently of the body as you do, which is part of why an oversized silhouette tends to feel less close over a long day outdoors.\n\nA practical reason to choose the cut, alongside the look of it."}, {"h2": "Choosing your size", "body": "Because this fit is built on width rather than length, sizing comes down to how much room you want through the chest and shoulders rather than how tall you are.\n\nMeasure an oversized piece you already like the fit of: lay it flat and measure straight across from armhole seam to armhole seam, an inch below the armhole. Compare that number directly to ours — S 22.5″, M 23.5″, L 25″, XL 26.5″. These are flat garment measurements, so there is no doubling involved.\n\nDo not assume your Regular fit letter carries across. The Oversized is a different pattern with a different grading step, so it is worth checking the number rather than defaulting to habit. Between two sizes, the smaller gives a defined drop shoulder and the larger pushes the silhouette looser still. The range is S to XL, unisex; we do not produce an XXL."}],
    faqs: [{"q": "How do I choose a size in the Oversized fit?", "a": "Compare flat chest measurements rather than assuming your usual letter carries across — this is a different pattern from the Regular, not the same shirt made larger. Measured flat, pit to pit: S 22.5″, M 23.5″, L 25″, XL 26.5″."}, {"q": "What is the difference between this and sizing up in the Regular fit?", "a": "Sizing up in the Regular adds chest width but keeps the shoulder seam at your natural shoulder point — a roomier version of the same silhouette. The Oversized sets that seam 2–3″ below it, on a pattern drafted for a drop shoulder. At M it is also 3.5″ wider in the chest. The two are not interchangeable."}, {"q": "Do the two fits use the same size steps?", "a": "No. Above M the Regular fit steps 2″ per size and the Oversized steps 1.5″, so the difference between the fits narrows slightly at the larger end. Read whichever chart applies to the fit you are buying."}, {"q": "Is the fabric different from the Regular tee?", "a": "No. Both are 230 GSM combed, ring-spun cotton with the same double-stitched seams and woven shoulder taping. The difference is entirely in the pattern — a wider chest and a dropped shoulder seam."}, {"q": "Does it need different care?", "a": "No. The cotton is pre-shrunk before cutting, so shrinkage should be minimal. A cool wash and air drying keeps the shape and the fabric at their best."}, {"q": "What are delivery and returns?", "a": "Free next-day delivery UAE-wide for orders placed by 2 pm, no minimum order. GCC in 3–5 working days, free over AED 390; worldwide in 7–14. Returns accepted for 14 days, unworn with tags on — free within the UAE, return postage on international orders is on the customer."}] },
  { slug:'polos', related: [["/national-day/", "UAE National Day t-shirts", "Eid Al Etihad, 2 December"], ["/gifts/", "Gifts from the UAE", "For leaving gifts and visitors"]], cat:'polos', emoji:'✦', catBg:'Dunes',
    h1:'Embroidered Polo Shirts in Dubai & the UAE',
    title:'Embroidered Polo Shirts, Dubai — 240 GSM Cotton',
    desc:'The Sahra Polo — 240gsm cotton, embroidered rather than printed. A limited first run. The scarcest piece in the first drop.',
    intro:"One polo, made in a limited run. It is 240gsm rather than the 230 we use on the tees — ten grams that show up in how the collar stands after a season rather than curling.\n\nEmbroidered instead of printed, and deliberately quiet. A men's cut, S to XL, sized to the same specification as the Regular fit tees. Made in a smaller run than the tees, counted on its own.",
    sections: [{"h2": "What piqué actually does", "body": "The Sahra Polo is 240 GSM piqué, not the 230 GSM jersey we use for the tees. Piqué is a knit structure rather than a heavier version of the same cloth — the fine waffle texture comes from the way the yarn interlocks, not from anything applied afterwards. That structure is what gives a polo its particular hand: more body than a jersey tee, a little give across the chest, and a surface that sits away from the skin rather than clinging to it.\n\nThe extra ten grams matter as well. At 240 GSM the fabric holds a collar shape rather than curling after a season. Underneath the knit the construction is the same as the tees — woven shoulder taping rather than cotton tape, double-stitched seams, side seams rather than a single tube of fabric, and cotton pre-shrunk before it reaches the cutting table."}, {"h2": "Embroidered, not printed", "body": "The logo on the chest is embroidered. Thread built into the cloth has texture you can feel and won't crack or peel the way a print can. On a garment worn as often as a polo, that is the whole argument: the mark is meant to keep reading cleanly long after the fabric has softened.\n\nThe back is left plain. Not every piece in the range is decorated the same way — two of the tees carry a DTG graphic across the back and an embroidered logo at the front, while the Empty Quarter tee and this polo are embroidered at the front and plain behind. The technique follows the design rather than a house rule.\n\nThe collar label is a separate decision. Labels across the whole range are printed, never woven, because a woven label sitting against the back of the neck irritates skin over a full day. On a collared piece that sits higher and closer, it matters more than anywhere else."}, {"h2": "How it fits", "body": "The polo is graded to the same specification as the Regular fit tees, so if you know your size in one you know it in the other. The shoulder seam sits at the natural shoulder point, and the polo has a set-in sleeve with no drop shoulder — the oversized chart does not apply to it.\n\nMeasured flat, pit to pit: S is 19″, M is 20″, L is 22″ and XL is 24″. Every measurement carries a tolerance of ±0.5″, and anything outside that is rejected at QC rather than shipped.\n\nIt is a men's cut, and the range runs S to XL only — we do not produce an XXL. Choose by the chest measurement rather than by the letter you usually reach for."}, {"h2": "Looking after it", "body": "A piqué knit rewards a little care, mostly for the embroidery rather than the cloth. Turn it inside out before washing: that protects the stitching at the chest and stops the piqué texture flattening against everything else in the drum. Beyond that, treat it as any combed cotton piece — a cool, gentle wash is kinder to both the colour and the knit than a hot one.\n\nBecause the cotton is pre-shrunk before cutting, it should not pull in on itself after the first wash the way untreated cotton does. The double-stitched seams and woven shoulder taping are there to hold shape over repeated washing, and a printed collar label is soft and has no tag to scratch.\n\nAir drying keeps it looking right for longest. The construction is built for ordinary use, though — this is a polo meant to be worn, not preserved."}],
    faqs: [{"q": "How is the polo different from the t-shirts?", "a": "It is 240 GSM piqué rather than 230 GSM jersey. The difference is structure as much as weight: piqué has a textured surface and holds its shape, jersey is smoother and softer against the skin. Both start from the same combed, ring-spun cotton."}, {"q": "What size polo should I order?", "a": "The polo is graded to the same specification as the Regular fit tees, S to XL. Measured flat, pit to pit, M is 20″ and L is 22″. If you already own a Sahra & Beyond Regular tee, take the same size."}, {"q": "How do I measure to find my size?", "a": "Take a polo or t-shirt you already own and like the fit of, lay it flat, and measure straight across from armhole seam to armhole seam, an inch below the armhole. Compare that number directly to ours — do not double it. Our figures are flat garment measurements, not body measurements."}, {"q": "I am between two sizes. Which should I take?", "a": "Every measurement carries a ±0.5″ tolerance, so there is a little room either way. Take the smaller size for a closer fit through the chest, the larger one if you prefer more ease. The shoulder seam sits at the natural shoulder point in both."}, {"q": "Is the logo embroidered or printed?", "a": "Embroidered. The collar label is the deliberate exception — that is printed, because a woven label against the back of the neck irritates skin."}, {"q": "How should I wash it?", "a": "Inside out, cool and gentle, to protect the embroidery and the piqué texture. The cotton is pre-shrunk before cutting, so you should not see meaningful shrinkage. Air drying keeps it at its best."}] }
];


// One product card, with the information a buyer actually needs: fit, colour,
// decoration, weight and price — not just a photograph.
function productCard(p) {
  const chips = [];
  if (p.garment === 'polo') chips.push('240gsm piqu&eacute;'); else chips.push('230gsm cotton');
  if (p.fit) chips.push(esc(p.fit === 'oversized' ? 'Oversized' : 'Regular') + ' fit');
  // Decoration is per placement: two designs carry both techniques on one shirt.
  if (p.decoration) {
    const d = String(p.decoration);
    chips.push(/DTG/i.test(d) && /embroider/i.test(d) ? 'DTG + embroidery' : (/embroider/i.test(d) ? 'Embroidered' : 'DTG print'));
  }
  chips.push(p.garment === 'polo' ? 'Men&rsquo;s S&ndash;XL' : 'Unisex S&ndash;XL');
  const colour = p.colourHex ? `<span class="pcard-col"><span class="pcard-sw" style="background:${esc(p.colourHex)}"></span>${esc(p.colourName || '')}</span>` : ''; /* 15 Sep audit: the Pantone code stays on the product page's spec panel, not the card */
  return `
    <article class="pcard" data-handle="${esc(p.id)}">
      <span class="pcard-img" style="background:${p.theme || '#EFEAE0'}">
        <a class="pcard-imglink" href="/products/${p.id}/" tabindex="-1" data-cycle>
          ${cycleImgs(p)}
        </a>
        <button type="button" class="pcard-zoom" data-zoom="${esc(p.imgMain)}" aria-label="Zoom ${esc(p.name)}"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.2 15.2 20 20M10.5 7.8v5.4M7.8 10.5h5.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      </span>
      <span class="pcard-b">
        <a class="pcard-t" href="/products/${p.id}/">${esc(p.name)}</a>
        ${RV.cardRating(p.id)}
        ${p.placeName ? `<span class="pcard-place">Inspired by ${esc(p.placeName)}</span>` : '<span class="pcard-place">Sahra &amp; Beyond</span>'}
        <span class="pcard-spec">${chips.map(c => `<span${/^(230gsm cotton|Unisex S&ndash;XL)$/.test(c) ? ' class="pc-same"' : ''}>${c}</span>`).join('')}</span>
        ${colour}
        ${p.garment !== 'polo' ? '<span class="pcard-bundle sb-aed-only">Any 2 tees &middot; AED 359</span>' : ''}
        <span class="pcard-foot"><span class="pcard-p">AED ${esc(String(p.price))}</span><a class="pcard-cta" href="/products/${p.id}/">Full details &rarr;</a></span>
      </span>
    </article>`;
}
function catCards(list) {
  if (!list.length) return '<p>Nothing in this category yet.</p>';
  return `<div class="pcards">${list.map(productCard).join('')}</div>`;
}

CATEGORIES.forEach(C => {
  const items = C.pick
    ? PRODUCTS_ALL.filter(C.pick).sort((a,b)=>(a.order||0)-(b.order||0))
    : BY_CATEGORY(C.cat);
  // Deep-link into the shop with this category preselected. The shop reads these
  // params on load, so /shop/?fit=oversized opens already filtered.
  const SHOP = (LAUNCHED || REVEALED) ? '/shop/' : '/shop-preview.html';
  const CAT_FILTER = { 'regular-tees':'regular', 'oversized-tees':'oversized', 'polos':'polo' }[C.cat] || '';
  const shopHref = CAT_FILTER ? `${SHOP}?fit=${CAT_FILTER}` : SHOP;
  const canonical = `${SITE}/${C.slug}/`;
  const jsonld = [
    { "@context":"https://schema.org","@type":"CollectionPage","name":C.h1,"description":C.desc,"url":canonical },
    { "@context":"https://schema.org","@type":"ItemList","itemListElement": items.map((p,i)=>({ "@type":"ListItem","position":i+1,"name":p.name,"url":`${SITE}/products/${p.id}/` })) },
    { "@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
      { "@type":"ListItem","position":1,"name":"Home","item":SITE+"/" },
      { "@type":"ListItem","position":2,"name":"T-Shirts","item":SITE+"/t-shirts/" },
      { "@type":"ListItem","position":3,"name":C.h1,"item":canonical } ] }
  ];
  const body = `
  <section class="loc-hero" style="--hero-grad:${CAT_BG[C.catBg]}">
    <div class="glow"></div><svg class="dune-far" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true"><path fill="#8B4E63" d="M0,220 C300,150 560,250 820,200 C1080,150 1300,220 1440,190 L1440,320 L0,320 Z"/></svg><svg class="dune-near" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true"><path fill="#3A241C" d="M0,270 C320,210 620,290 940,250 C1180,220 1330,270 1440,255 L1440,320 L0,320 Z"/></svg><div class="grain"></div><div class="loc-hero-inner">
      <nav class="crumbs"><a href="/">Home</a> &rsaquo; <a href="/t-shirts/">T-Shirts</a> &rsaquo; <span>${esc(C.h1)}</span></nav>
      <div class="loc-emoji">${C.emoji}</div>
      <h1>${esc(C.h1)}</h1>
      <p class="lede">Inspired by the landscapes of the UAE &mdash; wear the wild side of it</p>
    </div>
  </section>
  <main>
    <section class="pcta"><div class="pcta-head"><span class="pcta-eyebrow">${C.h1}</span></div>${catCards(items)}
      <a class="btn shoplink" href="${shopHref}">${C.pick ? 'Shop every t-shirt' : 'Shop ' + esc(C.h1.replace(/ T-Shirts$/,'').replace(/^Polo Shirts$/,'the polo'))} &rarr;</a><a class="btn ghost" href="/size-guide/">Size &amp; fit guide &rarr;</a></section>
    <div class="content">${paras(C.intro)}</div>
    ${RV.homepageBand({ compact: true })}
    ${foldsBlock(C.sections, 'Fabric, cut and make')}
    ${Array.isArray(C.related) ? `<nav class="catnav" aria-label="Related">${C.related.map(r => `<a href="${r[0]}"><b>${esc(r[1])}</b><span>${esc(r[2] || '')}</span></a>`).join('')}</nav>` : ''}
    ${C.places ? `<h2 class="places-h">The places behind these tees</h2><nav class="catnav" aria-label="The places behind these tees">${C.places.map(id => locations.find(l => l.id === id)).filter(Boolean).map(l => `<a href="/locations/${l.id}/"><b>${esc(l.name)}</b><span>${esc(l.emirate)} &middot; ${esc(l.category)}</span></a>`).join('')}</nav>` : ''}
    ${Array.isArray(C.faqs) && C.faqs.length ? `<section class="faq"><h2>Frequently asked questions</h2>${C.faqs.map(q => `<details><summary>${esc(q.q)}</summary><p>${esc(q.a)}</p></details>`).join('')}</section>` : ''}
    ${newsletterBlock()}
    <p class="back"><a href="/t-shirts/">All t-shirts &rarr;</a></p>
  </main>`;
  /* Commercial pages carried Product schema but no FAQPage, while 37 editorial
     pages had one. These are the pages that actually need to answer a buying
     question. */
  const catLd = Array.isArray(C.faqs) && C.faqs.length
    ? jsonld.concat([{ "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": C.faqs.map(q => ({ "@type": "Question", "name": q.q,
          "acceptedAnswer": { "@type": "Answer", "text": q.a } })) }])
    : jsonld;
  write(`${C.slug}/index.html`, shell({ title: C.title, desc: C.desc, canonical, jsonld: catLd, bodyHtml: body, activeNav: navKeyFor(C.slug), bodyClass: 'buy-page' /* the buying-page type scale, legibility.js (10 Sep) */ }));
});

COMMERCE.forEach(P => {
  const canonical = `${SITE}/${P.slug}/`;
  const jsonld = [
    { "@context": "https://schema.org", "@type": "WebPage", "name": P.h1, "description": P.desc, "url": canonical },
    ...(Array.isArray(P.items) ? [{ "@context": "https://schema.org", "@type": "ItemList", "name": P.h1, "itemListElement": P.items.map((id, i) => { const pr = PRODUCTS_ALL.find(x => x.id === id); return pr ? { "@type": "ListItem", "position": i + 1, "name": pr.name, "url": `${SITE}/products/${id}/` } : null; }).filter(Boolean) }] : []),
    { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/" },
      { "@type": "ListItem", "position": 2, "name": P.h1, "item": canonical }
    ] }
  ];
  if (P.faqs && P.faqs.length) {
    jsonld.push({ "@context": "https://schema.org", "@type": "FAQPage",
      "mainEntity": P.faqs.map(q => ({ "@type": "Question", "name": q[0], "acceptedAnswer": { "@type": "Answer", "text": q[1] } })) });
  }
  /* the size guide keeps its essay open (people come to read it); the buying
     pages fold theirs under the products */
  const sectionsHtml = P.slug === 'size-guide'
    ? (P.sections || []).map(x => `<section class="guide-sec"><h2>${esc(x.h2)}</h2><div class="content">${paras(x.body)}</div></section>`).join('')
    : foldsBlock(P.sections, P.foldsTitle || 'Fabric, cut and make');
  const faqHtml = (P.faqs && P.faqs.length)
    ? `<section class="faq"><h2>Frequently asked questions</h2>${P.faqs.map(q => `<details><summary>${esc(q[0])}</summary><p>${esc(q[1])}</p></details>`).join('')}</section>` : '';
  const body = `
  <section class="loc-hero" style="--hero-grad:${CAT_BG[P.cat]}">
    <div class="glow"></div><svg class="dune-far" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true"><path fill="#8B4E63" d="M0,220 C300,150 560,250 820,200 C1080,150 1300,220 1440,190 L1440,320 L0,320 Z"/></svg><svg class="dune-near" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true"><path fill="#3A241C" d="M0,270 C320,210 620,290 940,250 C1180,220 1330,270 1440,255 L1440,320 L0,320 Z"/></svg><div class="grain"></div><div class="loc-hero-inner">
      <nav class="crumbs"><a href="/">Home</a> &rsaquo; <span>${esc(P.h1)}</span></nav>
      <div class="loc-emoji">${P.emoji}</div>
      <h1>${esc(P.h1).replace(/(\S+-\S+)/g, '<span style="white-space:nowrap">$1</span>')}</h1>
      <p class="lede">${P.lede ? esc(P.lede) : 'Inspired by the landscapes of the UAE &mdash; wear the wild side of it'}</p>
    </div>
  </section>
  <main>
    ${P.catNav ? '' : `<div class="content">${paras(P.intro)}</div>`}
    ${P.catNav ? `<nav class="catnav" aria-label="Shop by category">
      <a href="/t-shirts/regular/"><b>Regular fit</b><span>Straight cut, set shoulder</span></a>
      <a href="/t-shirts/oversized/"><b>Oversized fit</b><span>True drop shoulder</span></a>
      <a href="/polos/"><b>Polo</b><span>240gsm, embroidered &middot; limited run</span></a>
      <a href="/mountain-t-shirts/"><b>Mountain t-shirts</b><span>The Hajar range, printed</span></a>
      <a href="/desert-t-shirts/"><b>Desert t-shirts</b><span>Liwa dunes &middot; Al Quaa night sky</span></a>
    </nav>` : ''}
    ${collectionBlock(null, P.slug === 't-shirts')}
    ${P.catNav ? `<div class="content">${paras(P.intro)}</div>` : ''}
    ${P.slug === 't-shirts' ? RV.homepageBand({ compact: true }) : ''}
    ${P.sizeTable ? `<section class="guide-sec"><h2>Measurements</h2>${sizeTableHtml()}</section>` : ''}
    ${P.gsmTable ? `<section class="guide-sec" id="gsm-table"><h2>Every t-shirt weight, compared</h2><p class="sgintent">GSM is grams per square metre &mdash; how much a square metre of the cloth weighs. It is the single most useful number on a t-shirt spec, and almost nobody selling t-shirts in the UAE explains it. Here is the whole scale.</p>${gsmTableHtml()}</section>` : ''}
    ${sectionsHtml}
    ${P.related ? `<nav class="catnav" aria-label="Related">${P.related.map(r => `<a href="${r[0]}"><b>${esc(r[1])}</b><span>${esc(r[2])}</span></a>`).join('')}</nav>` : ''}
    ${faqHtml}
    ${newsletterBlock()}
    <p class="back"><a href="/">Back to Sahra &amp; Beyond &rarr;</a></p>
  </main>`;
  write(`${P.slug}/index.html`, shell({ title: P.title, desc: P.desc, canonical, jsonld, bodyHtml: body, activeNav: navKeyFor(P.slug), bodyClass: 'buy-page' }));
});

/* ---------- /feed/ and /q/<slug>/ (4 Oct 2026) -------------------------------
   /feed/: every Instagram post from content/instagram.json, newest first, each with
   the page on the site it belongs to. One URL for the Instagram bio, crawlable and
   fast, instead of a link-in-bio service. Indexable, low priority in the sitemap.
   /q/<slug>/: a single post as a full step-through with a shop button, for pasting
   into WhatsApp replies instead of retyping the answer. noindex (a tool, not a page). */
(function instagramPages() {
  const posts = IG.all();
  if (posts.length) {
    const canonical = `${SITE}/feed/`;
    const title = 'From our Instagram: every post, and where it lives | Sahra & Beyond';
    const desc = 'Every Sahra & Beyond Instagram post in one place: the fit guide, the places behind each tee, Sahra Trail and Sahel, each linked to its page on the site.';
    const jsonld = [
      { "@context": "https://schema.org", "@type": "CollectionPage", "name": "From our Instagram", "description": desc, "url": canonical, "isPartOf": { "@id": SITE + '/#website' } },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/" },
        { "@type": "ListItem", "position": 2, "name": "From our Instagram", "item": canonical } ] }
    ];
    const body = `
  <main class="feed-main" style="max-width:1180px;margin:0 auto;padding:28px clamp(16px,4vw,40px) 60px">
    <nav class="crumbs" style="margin-bottom:14px"><a href="/">Home</a> &rsaquo; <span>From our Instagram</span></nav>
    ${IG.feedPageHtml()}
    ${newsletterBlock()}
  </main>`;
    write('feed/index.html', shell({ title, desc, canonical, jsonld, bodyHtml: body, activeNav: 'none', bodyClass: 'buy-page feed-page' }));
  }
  for (const Q of (IG.DATA.pages || [])) {
    const post = IG.byId(Q.post);
    if (!post || !post.slides.length || !fs.existsSync(path.join(ROOT, 'uploads', 'ig', post.id + '.webp'))) { console.log('  – /q/' + Q.slug + '/ skipped (no slides yet)'); continue; }
    const canonical = `${SITE}/q/${Q.slug}/`;
    const body = `
  <main class="q-main" style="max-width:640px;margin:0 auto;padding:28px 16px 60px;text-align:center">
    <p class="ig-eyebrow" style="margin-bottom:8px">Sahra &amp; Beyond &middot; quick answer</p>
    <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-size:clamp(30px,5vw,44px);line-height:1.05;margin:0 0 10px;text-wrap:balance">${esc(Q.h1)}</h1>
    <p class="lede" style="color:#5C5346;margin:0 auto 18px;max-width:46ch">${esc(Q.intro)}</p>
    ${IG.card(post, { big: true, eager: true, wear: false, sizes: '(max-width:760px) 92vw, 420px' })}
    <p style="font-size:13px;color:#5C5346;margin:10px 0 18px">Tap the right or left side of the card to step through. ${post.slides.length} slides.</p>
    <p style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="book-btn" href="${esc(Q.shop[0])}">${esc(Q.shop[1])}</a><a class="book-btn alt" href="${esc(Q.second[0])}">${esc(Q.second[1])}</a></p>
    <p style="font-size:13.5px;color:#5C5346;margin-top:22px">Still unsure? <a href="https://wa.me/971585449946?text=${encodeURIComponent('Hi, a question about ' + Q.h1.toLowerCase())}" target="_blank" rel="noopener">WhatsApp us</a> your height and a shirt you like.</p>
  </main>`;
    write(`q/${Q.slug}/index.html`, shell({ title: Q.title + ' | Sahra & Beyond', desc: Q.intro, canonical, jsonld: [], bodyHtml: body, activeNav: 'none', bodyClass: 'buy-page q-page', noindex: true }));
  }
  console.log('  ✓ Instagram: ' + posts.length + ' post(s) with covers; strip ' + IG.strip().length + ', footer ' + IG.footerRow().length + (posts.length ? ', /feed/' : ''));
})();

/* ---------- /hoodies/ (DRAFT, 1 Oct 2026; SEO handover item 19) -------------
   Collection page for the two Sahel hoodies (named 5 Oct 2026: the Shuweihat Hoodie in Salute and
   the Ras Al Khor Hoodie in Estate Blue), built to report 02 section 6.1. It is a
   DRAFT: written to _drafts/hoodies/ locally only (never on Vercel, never in the
   sitemap) until Faheem confirms the fabric weight and the products exist in
   Shopify. Every fact here is from MASTER_BRIEF decisions; unsettled ones are
   visible TODO boxes in the draft. To publish: set HOODIES.draft = false. */
const HOODIES = {
  draft: true,
  slug: 'hoodies',
  title: 'Hoodies in Dubai & UAE — Embroidered Coastline | Sahra & Beyond',
  desc: 'The Shuweihat Hoodie and the Ras Al Khor Hoodie: 400 GSM brushed-back cotton fleece, a relaxed drop-shoulder cut and the UAE coastline embroidered on the back.',
  h1: 'Hoodies in Dubai & the UAE',
  todo: [
    'TODO for Faheem: product photos (not mockups) and the Shopify product URLs, so the grid and ItemList schema can go in.',
    'TODO for Faheem: launch date. Not final; 29 Oct is the likely on-sale date (Faheem, 1 Oct). Confirm the date, and whether the page goes up earlier as a waitlist.'
  ]
};
if (!process.env.VERCEL) {
  const H = HOODIES, canonical = `${SITE}/${H.slug}/`;
  const todoBox = t => `<div style="border:2px dashed #C0392B;background:#FFF4F2;color:#7A1F14;border-radius:10px;padding:10px 14px;margin:12px 0;font-size:14px"><b>DRAFT TODO:</b> ${esc(t)}</div>`;
  const jsonld = [
    { "@context": "https://schema.org", "@type": "CollectionPage", "name": H.h1, "description": H.desc, "url": canonical },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/" },
      { "@type": "ListItem", "position": 2, "name": H.h1, "item": canonical } ] }
  ];
  const body = `
  <section class="loc-hero" style="--hero-grad:${CAT_BG.Coast}">
    <div class="loc-hero-inner">
      <nav class="crumbs"><a href="/">Home</a> &rsaquo; <span>${esc(H.h1)}</span></nav>
      <h1>${esc(H.h1)}</h1>
      <p class="lede">The Shuweihat Hoodie and the Ras Al Khor Hoodie: the UAE coastline, embroidered</p>
    </div>
  </section>
  <main>
    ${H.todo.map(todoBox).join('')}
    <div class="content"><p>The first hoodies from Sahra &amp; Beyond are part of Sahel, the Coast Edition, designed in the UAE: 400 GSM brushed-back fleece in 100% cotton, in a relaxed oversized cut with a dropped shoulder, the UAE coastline embroidered across the back in sand thread, and a printed scene on the lower back. There are two: the Shuweihat Hoodie in Salute and the Ras Al Khor Hoodie in Estate Blue, each in S to XL, at AED 229. Delivery is free and next-day across the UAE, with free 14-day exchanges. See the <a href="/size-guide/">size guide</a> and <a href="/fabric/">how we choose our fabrics</a>.</p></div>
    ${todoBox('Product grid goes here once the Shuweihat Hoodie and the Ras Al Khor Hoodie exist in Shopify as two products (CollectionPage + ItemList schema then).')}
    <section class="guide-sec"><h2>The cut</h2><div class="content"><p>A relaxed oversized pullover with a dropped shoulder and a hip-length body, sized S to XL. The neck label reads the size and the fit, for example "M – OVERSIZED", and is printed rather than sewn in, so there is no tag to scratch.</p></div></section>
    <section class="guide-sec"><h2>The coastline on the back</h2><div class="content"><p>Across the upper back runs the UAE coastline, embroidered in sand thread, with &quot;ساحل · SAHEL&quot;. The Sahra mark is embroidered at the centre of the chest. On the lower back, each hoodie carries its own printed scene. The Shuweihat Hoodie has contour lines where the dunes meet the sea, inspired by <a href="/locations/shuweihat-island/">Shuweihat Island</a>. The Ras Al Khor Hoodie has greater flamingos at dusk at <a href="/locations/ras-al-khor/">Ras Al Khor</a>.</p></div></section>
    <section class="guide-sec"><h2>For cold desert and mountain nights</h2><div class="content"><p>Winter nights in the desert and up in the mountains get properly cold: Jebel Jais has recorded temperatures below freezing. If you are camping this season, our <a href="/camping/">camping guide</a> covers the rules by emirate, and the <a href="/stargazing/">stargazing guide</a> the darkest nights; the <a href="/locations/jebel-jais/">Jebel Jais guide</a> has the month-by-month temperatures.</p></div></section>
    <section class="guide-sec"><h2>Care</h2><div class="content"><p>Wash cold and inside out, no bleach. Tumble dry low, and iron inside out.</p></div></section>
    ${newsletterBlock()}
  </main>`;
  write(`_drafts/hoodies/index.html`, shell({ title: H.title, desc: H.desc, canonical, jsonld, bodyHtml: body, activeNav: 'none', bodyClass: 'buy-page', noindex: true }));
}

const PRODUCT_URLS = buildProducts({ ROOT, SITE, write, arCorePublic: AR_CORE_PUBLIC, launched: LAUNCHED, shopUrl: (LAUNCHED || REVEALED) ? '/shop/' : '/shop-preview.html' });
console.log('  \u2713 ' + PRODUCT_URLS.length + ' product pages');

/* ==========================================================================
   THE JOURNAL  —  /journal/  and  /journal/<slug>/
   ==========================================================================
   Built before any article is written, deliberately. The SEO work order is
   explicit that the hub has to exist first or every article published into it
   orphans itself, and an orphaned page on a domain this size is close to
   invisible.

   TWO RULES ENCODED HERE, both load-bearing:

   1. The author is ALWAYS the Organization, never a Person. The brand is
      faceless and stays that way, so there is no `author.name` to leak. If a
      future article needs a byline, it is "Sahra & Beyond", full stop.

   2. The hub is never allowed to be thin. With no articles it would be an
      empty grid, which is precisely the kind of page the work order warns
      about — so it also carries the guides the site already has. Articles
      slot in above them as they publish; the page is never empty.
   ========================================================================== */
const journalDir = path.join(ROOT, 'content', 'journal');
const JOURNAL = (fs.existsSync(journalDir)
  ? fs.readdirSync(journalDir).filter(f => f.endsWith('.json'))
      .map(f => { try { return JSON.parse(fs.readFileSync(path.join(journalDir, f), 'utf8')); }
                  catch (e) { console.log('  ! skipped content/journal/' + f + ' — ' + e.message); return null; } })
      .filter(Boolean)
      .filter(a => a.slug && a.title && a.draft !== true)
      // The CMS writes FAQs as {q,a} objects; hand-written JSON elsewhere in
      // this repo uses [q,a] pairs. Normalise once here so the renderer only
      // ever sees pairs — otherwise a Faheem-authored article silently loses
      // its FAQ schema, which is the whole reason for asking the questions.
      .map(a => Object.assign({}, a, {
        faqs: (Array.isArray(a.faqs) ? a.faqs : [])
          .map(q => Array.isArray(q) ? q : [q && q.q, q && q.a])
          .filter(q => q[0] && q[1])
      }))
  : []
).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

// The hub's back catalogue: real editorial that already exists on the site.
const JOURNAL_GUIDES = [
  { href: '/fabric/',     kicker: 'Fabric',    name: 'T-shirt GSM explained',
    blurb: 'The full 150–280gsm scale, what 230gsm feels like next to the 180gsm you already own, and which weight actually suits a Gulf summer.' },
  { href: '/size-guide/', kicker: 'Fit',       name: 'Size and fit guide',
    blurb: 'Flat garment measurements for both t-shirt fits, and how to find your size by measuring a shirt you already like rather than yourself.' },
  { href: '/stargazing/', kicker: 'Places',    name: 'Stargazing in the UAE',
    blurb: 'When the Milky Way core is actually visible, where to go for it, and what you can see without a telescope.' },
  { href: '/camping/',    kicker: 'Places',    name: 'Best camping spots in the UAE',
    blurb: 'Desert lakes, mountain wadis and quiet coast, with GPS, season and difficulty for each.' },
  { href: '/wadis/',      kicker: 'Places',    name: 'The best wadis in the Emirates',
    blurb: 'Where the water actually is, when it runs, and which ones are worth the drive.' },
  { href: '/places/',     kicker: 'Places',    name: 'Every place we have mapped',
    blurb: 'The full index — ' + locations.length + ' places, each with coordinates and an honest note on what it is like.' }
];

function journalCardHtml(a) {
  const d = a.date ? `<time datetime="${esc(a.date)}">${esc(fmtDate(a.date))}</time>` : '';
  return `<a class="jcard" href="/journal/${esc(a.slug)}/">
    <span class="jkick">${esc(a.tag || 'Journal')}</span>
    <b>${esc(a.h1 || a.title)}</b>
    <span class="jblurb">${esc(a.dek || a.desc || '')}</span>
    <span class="jmeta">${d}${a.readMins ? `<span class="jdot">&middot;</span>${a.readMins} min read` : ''}</span>
  </a>`;
}
function fmtDate(s) {
  const d = new Date(s + 'T00:00:00Z');
  if (isNaN(d)) return s;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// ---- the hub ----
{
  const canonical = `${SITE}/journal/`;
  const h1 = 'The Journal';
  const title = 'The Journal — Fabric, Fit and Places | Sahra & Beyond';
  const desc = 'How we make what we make, and the places it comes from. Fabric weight, fit, construction and the corners of the Emirates behind each design.';
  const jsonld = [
    { "@context": "https://schema.org", "@type": "CollectionPage", "name": h1, "description": desc, "url": canonical },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/" },
      { "@type": "ListItem", "position": 2, "name": h1, "item": canonical }
    ] }
  ];
  if (JOURNAL.length) {
    jsonld.push({ "@context": "https://schema.org", "@type": "ItemList",
      "itemListElement": JOURNAL.map((a, i) => ({ "@type": "ListItem", "position": i + 1,
        "name": a.h1 || a.title, "url": `${SITE}/journal/${a.slug}/` })) });
  }
  const latest = JOURNAL.length
    ? `<section class="guide-sec"><h2>Latest</h2><div class="jgrid">${JOURNAL.map(journalCardHtml).join('')}</div></section>`
    : '';
  const guides = `<section class="guide-sec"><h2>${JOURNAL.length ? 'Guides' : 'Start here'}</h2>
    <p class="sgintent">The longer reference pieces, kept up to date rather than dated.</p>
    <div class="jgrid">${JOURNAL_GUIDES.map(g => `<a class="jcard" href="${g.href}">
      <span class="jkick">${esc(g.kicker)}</span><b>${esc(g.name)}</b>
      <span class="jblurb">${esc(g.blurb)}</span></a>`).join('')}</div></section>`;
  const body = `
  <section class="loc-hero" style="--hero-grad:${CAT_BG.Mountains}">
    <div class="glow"></div><svg class="dune-far" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true"><path fill="#8B4E63" d="M0,220 C300,150 560,250 820,200 C1080,150 1300,220 1440,190 L1440,320 L0,320 Z"/></svg><svg class="dune-near" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true"><path fill="#3A241C" d="M0,270 C320,210 620,290 940,250 C1180,220 1330,270 1440,255 L1440,320 L0,320 Z"/></svg><div class="grain"></div><div class="loc-hero-inner">
      <nav class="crumbs"><a href="/">Home</a> &rsaquo; <span>${esc(h1)}</span></nav>
      <div class="loc-emoji">✍</div>
      <h1>${esc(h1)}</h1>
      <p class="lede">How we make what we make, and the places it comes from</p>
    </div>
  </section>
  <main>
    <div class="content">${paras("We would rather explain something properly once than repeat an adjective. Most of what gets written about t-shirts in this region is either a spec sheet with no explanation or a page of words like premium and buttery that you cannot check.\n\nSo this is the other thing: what the numbers on a label actually mean, how a garment is put together and why those choices were made, and the places in the Emirates each design comes from. Written to be useful whether or not you buy anything.")}</div>
    ${latest}
    ${guides}
    ${newsletterBlock()}
    <p class="back"><a href="/">Back to Sahra &amp; Beyond &rarr;</a></p>
  </main>`;
  write('journal/index.html', shell({ title, desc, canonical, jsonld, bodyHtml: body, activeNav: 'none' }));
}

// ---- the articles ----
JOURNAL.forEach(a => {
  const canonical = `${SITE}/journal/${a.slug}/`;
  const h1 = a.h1 || a.title;
  const img = a.cover ? (a.cover.startsWith('http') ? a.cover : SITE + (a.cover.startsWith('/') ? '' : '/') + a.cover) : undefined;
  const jsonld = [
    { "@context": "https://schema.org", "@type": "BlogPosting",
      "headline": h1,
      "description": a.desc || a.dek || '',
      "mainEntityOfPage": { "@type": "WebPage", "@id": canonical },
      "url": canonical,
      "datePublished": a.date || undefined,
      "dateModified": a.updated || a.date || undefined,
      // Organization, never Person — the brand does not carry a face or a name.
      "author":    { "@type": "Organization", "name": "Sahra & Beyond", "url": SITE + '/' },
      "publisher": { "@type": "Organization", "name": "Sahra & Beyond", "url": SITE + '/',
                     "logo": { "@type": "ImageObject", "url": SITE + '/icon-512.png' } },
      "image": img || (SITE + '/icon-512.png'),
      "inLanguage": "en"
    },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/" },
      { "@type": "ListItem", "position": 2, "name": "The Journal", "item": SITE + "/journal/" },
      { "@type": "ListItem", "position": 3, "name": h1, "item": canonical }
    ] }
  ];
  if (Array.isArray(a.faqs) && a.faqs.length) {
    jsonld.push({ "@context": "https://schema.org", "@type": "FAQPage",
      "mainEntity": a.faqs.map(q => ({ "@type": "Question", "name": q[0],
        "acceptedAnswer": { "@type": "Answer", "text": q[1] } })) });
  }
  const sectionsHtml = (a.sections || []).map(s =>
    `<section class="guide-sec"><h2>${esc(s.h2)}</h2><div class="content">${paras(s.body)}</div></section>`).join('');
  const faqHtml = (Array.isArray(a.faqs) && a.faqs.length)
    ? `<section class="faq"><h2>Frequently asked questions</h2>${a.faqs.map(q =>
        `<details><summary>${esc(q[0])}</summary><p>${esc(q[1])}</p></details>`).join('')}</section>` : '';
  const others = JOURNAL.filter(x => x.slug !== a.slug).slice(0, 3);
  const moreHtml = others.length
    ? `<section class="guide-sec"><h2>More from the journal</h2><div class="jgrid">${others.map(journalCardHtml).join('')}</div></section>`
    : `<section class="guide-sec"><h2>More from the journal</h2><div class="jgrid">${JOURNAL_GUIDES.slice(0, 3).map(g =>
        `<a class="jcard" href="${g.href}"><span class="jkick">${esc(g.kicker)}</span><b>${esc(g.name)}</b><span class="jblurb">${esc(g.blurb)}</span></a>`).join('')}</div></section>`;
  const body = `
  <section class="loc-hero" style="--hero-grad:${CAT_BG[a.cat] || CAT_BG.Mountains}">
    <div class="glow"></div><svg class="dune-far" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true"><path fill="#8B4E63" d="M0,220 C300,150 560,250 820,200 C1080,150 1300,220 1440,190 L1440,320 L0,320 Z"/></svg><svg class="dune-near" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true"><path fill="#3A241C" d="M0,270 C320,210 620,290 940,250 C1180,220 1330,270 1440,255 L1440,320 L0,320 Z"/></svg><div class="grain"></div><div class="loc-hero-inner">
      <nav class="crumbs"><a href="/">Home</a> &rsaquo; <a href="/journal/">Journal</a> &rsaquo; <span>${esc(h1)}</span></nav>
      <div class="loc-emoji">${esc(a.emoji || '✍')}</div>
      <h1>${esc(h1)}</h1>
      ${a.dek ? `<p class="lede">${esc(a.dek)}</p>` : ''}
    </div>
  </section>
  <main>
    <p class="jbyline">${a.date ? `<time datetime="${esc(a.date)}">${esc(fmtDate(a.date))}</time>` : ''}${a.updated && a.updated !== a.date ? ` <span class="jdot">&middot;</span> updated ${esc(fmtDate(a.updated))}` : ''}${a.readMins ? ` <span class="jdot">&middot;</span> ${a.readMins} min read` : ''}</p>
    <div class="content">${paras(a.intro || '')}</div>
    ${sectionsHtml}
    ${a.productLink ? `<div class="note-box">${esc(a.productLink.before || '')} <a href="${esc(a.productLink.href)}">${esc(a.productLink.label)}</a>${esc(a.productLink.after || '')}</div>` : ''}
    ${faqHtml}
    ${moreHtml}
    ${newsletterBlock()}
    <p class="back"><a href="/journal/">Back to the Journal &rarr;</a></p>
  </main>`;
  write(`journal/${a.slug}/index.html`, shell({ title: a.title, desc: a.desc || a.dek || '', canonical, jsonld, bodyHtml: body, image: img, activeNav: 'none' }));
});
console.log('  ✓ journal hub + ' + JOURNAL.length + ' article(s)');

// ---- sitemap ----
const buildDate = new Date().toISOString().slice(0, 10);
function locMtime(id) { try { return fs.statSync(path.join(locDir, id + '.json')).mtime.toISOString().slice(0, 10); } catch (e) { return buildDate; } }
const entries = [{ u: `${SITE}/`, m: buildDate, p: '1.0' }]
  .concat((LAUNCHED || REVEALED) ? [{ u: `${SITE}/shop/`, m: buildDate, p: '0.9' }] : [])
  .concat([{ u: `${SITE}/places/`, m: buildDate, p: '0.8' }, { u: `${SITE}/about/`, m: buildDate, p: '0.6' }, { u: `${SITE}/contact/`, m: buildDate, p: '0.6' }])
  // policies.html is noindex until launch — listing it earlier would put a
  // noindexed URL in the sitemap, which is the contradiction Ahrefs flags
  .concat(LAUNCHED ? [{ u: `${SITE}/policies.html`, m: buildDate, p: '0.4' }] : [])
  .concat(LANDINGS.map(L => ({ u: `${SITE}/${L.slug}/`, m: buildDate, p: '0.8' })))
  .concat(COMMERCE.map(P => ({ u: `${SITE}/${P.slug}/`, m: buildDate, p: '0.9' })))
  .concat(CATEGORIES.map(C => ({ u: `${SITE}/${C.slug}/`, m: buildDate, p: '0.9' })))
  .concat(locations.map(l => ({ u: `${SITE}/locations/${l.id}/`, m: locMtime(l.id), p: '0.8' })))
  .concat([{ u: `${SITE}/journal/`, m: buildDate, p: '0.7' }])
  .concat([{ u: `${SITE}/trail/`, m: buildDate, p: '0.8' }])
  .concat(['', ...require('./trail-hikes.js').ORDER.concat(require('./trail-hikes.js').EXTRA).map(x => x + '/')].map(x => ({ u: `${SITE}/trail/hikes/${x}`, m: buildDate, p: '0.7' })))   /* Sahra Trail hikes for the QR cards (6 Oct 2026) */
  .concat([{ u: `${SITE}/sahel/`, m: buildDate, p: '0.8' }])   /* Sahel teaser page (6 Oct 2026) */
  .concat(fs.existsSync(path.join(ROOT, 'feed', 'index.html')) ? [{ u: `${SITE}/feed/`, m: buildDate, p: '0.5' }] : [])   /* every Instagram post with where it lives on the site (4 Oct 2026); /q/ pages are noindex */
  /* SEO handover item 11: the three live Arabic pages join the sitemap only once Faheem confirms
     they count as reviewed (he asked on 2 Oct that Arabic stays noindex until he has reviewed it). */
  .concat(AR_CORE_PUBLIC ? ['/ar/', '/ar/about/', '/ar/contact/'].map(u => ({ u: SITE + u, m: buildDate, p: '0.6' })) : [])   /* Sahra Trail coming-soon page (24 Sep 2026); /ar/trail/ is noindex */
  .concat(fs.existsSync(path.join(ROOT, 'tote', 'index.html')) ? [{ u: `${SITE}/tote/`, m: buildDate, p: '0.7' }] : [])   /* the tote's own page is live and indexable (SEO plan, 1 Oct 2026) */
  // Articles carry their own lastmod: an article's updated date is real
  // information, unlike the build date, and re-stamping every URL on every
  // build teaches Google to ignore the field.
  .concat(JOURNAL.map(a => ({ u: `${SITE}/journal/${a.slug}/`, m: a.updated || a.date || buildDate, p: '0.7' })))
  .concat(PRODUCT_URLS.map(x => ({ u: x.url, m: buildDate, p: '0.9' })));
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
  + entries.map(e => `  <url><loc>${e.u}</loc><lastmod>${e.m}</lastmod><priority>${e.p}</priority></url>`).join('\n')
  + `\n</urlset>\n`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);
console.log('  \u2713 sitemap.xml (' + entries.length + ' urls)');

// ---- content feed for the native Android app (one request \u2192 all content) ----
const feed = {
  updated: new Date().toISOString(),
  site: SITE,
  weatherKey: WEATHER_KEY,
  social: settings.social || {},
  locations: locations.map(l => (({ _doubts, ...rest }) => Object.assign(rest, { url: SITE + '/locations/' + l.id + '/' }))(l)),
  packing: PACKING
};
/* Keep the previous `updated` stamp when nothing else in the feed changed.
   Otherwise every single build produces a one-field diff and feed.json shows
   up as modified forever, which is pure noise in the commit list and trains
   you to ignore it. The app only cares that the stamp moves when the CONTENT
   moves. */
{
  const feedPath = path.join(ROOT, 'feed.json');
  const withoutStamp = o => { const c = Object.assign({}, o); delete c.updated; return JSON.stringify(c); };
  try {
    const prev = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
    if (withoutStamp(prev) === withoutStamp(feed) && prev.updated) feed.updated = prev.updated;
  } catch (e) { /* no previous feed, or unreadable - write a fresh stamp */ }
  fs.writeFileSync(feedPath, JSON.stringify(feed));
}
console.log('  \u2713 feed.json (' + locations.length + ' locations)');

console.log('Build complete: ' + locations.length + ' locations, ' + LANDINGS.length + ' landing pages.');
// end of build — brand-consistency pass v2

/* ---------- homepage review band ----------------------------------------
   index.html is hand-maintained rather than generated, so the band is injected
   between markers instead of the whole page being rewritten. Renders to an
   empty string until there are enough real reviews, which leaves the markers
   sitting harmlessly next to each other. */
(function () {
  const MARK = /<!--REVIEWS:START-->[\s\S]*?<!--REVIEWS:END-->/;
  /* classic/index.html: the previous homepage, kept reachable (noindex), carries
     the same band, so the Judge.me sync keeps it current too */
  for (const f of ['index.html', 'homepage-preview.html', 'classic/index.html']) {
    const file = path.join(ROOT, f);
    if (!fs.existsSync(file)) continue;
    let html = fs.readFileSync(file, 'utf8');
    if (!MARK.test(html)) continue;
    const raw = RV.homepageBand({ compact: true });   /* 3 cards, the rest behind Show more (24 Sep 2026: ~4 phone screens of reviews) */
    const band = raw ? '<style>' + RV.CSS + '</style>' + raw : '';
    const next = html.replace(MARK, '<!--REVIEWS:START-->' + band + '<!--REVIEWS:END-->');
    if (next !== html) {
      fs.writeFileSync(file, next);
      console.log(band ? `  \u2713 homepage review band (${f})` : `  \u00b7 homepage review band empty - not enough reviews yet (${f})`);
    }
  }
})();

/* ---------- homepage collection carousel photos (1 Oct 2026) -------------
   Faheem: the carousel must show the same photos as the product pages. index.html
   is hand-maintained, so on every build each .hring-card's photo stack is
   rewritten from its product's content/products/<handle>.json: the main photo
   first, then the other side, exactly the pair the product page opens with.
   A product photo changed in its JSON now reaches the homepage on the next build. */
(function () {
  const file = path.join(ROOT, 'index.html');
  if (!fs.existsSync(file)) return;
  const html = fs.readFileSync(file, 'utf8');
  const webp = src => { const w = String(src).replace(/\.(jpe?g|png)$/i, '.webp'); return fs.existsSync(path.join(ROOT, w.replace(/^\//, ''))) ? w : src; };
  const card = src => { const b = path.basename(webp(src)); const c = '/shirts/card/' + b; return fs.existsSync(path.join(ROOT, c.replace(/^\//, ''))) ? c : null; };
  let n = 0;
  const next = html.replace(/(<a class="hring-card"[^>]*data-handle="([^"]+)"[^>]*><span class="hring-img" data-cycle>)([\s\S]*?)(<\/span>)/g, (all, open, handle, inner, close) => {
    const pf = path.join(ROOT, 'content', 'products', handle + '.json');
    if (!fs.existsSync(pf)) return all;
    const p = JSON.parse(fs.readFileSync(pf, 'utf8'));
    const main = p.imgMain || p.imgFront;
    const other = main === p.imgBack ? p.imgFront : p.imgBack;
    const shots = [[main, main === p.imgBack ? p.altBack : (p.altFront || p.altMain)], [other, other === p.imgBack ? p.altBack : p.altFront]]
      .filter(x => x[0]).filter((x, i, a) => a.findIndex(y => y[0] === x[0]) === i);
    if (!shots.length) return all;
    const imgs = shots.map(([src, alt], i) => {
      const full = webp(src), sm = card(src);
      const set = sm ? ` srcset="${sm} 800w, ${full} 1536w" sizes="(max-width:760px) 46vw, 240px"` : '';
      return `<img loading="${i ? 'lazy' : 'eager'}"${i ? '' : ' class="on"'} src="${full}"${set} decoding="async" alt="${String(alt || p.name).replace(/"/g, '&quot;')}">`;
    }).join('');
    n++;
    return open + imgs + close;
  });
  if (next !== html) { fs.writeFileSync(file, next); }
  console.log(`  ✓ homepage carousel photos from product data (${n} cards)`);
})();

/* ---------- shop page star ratings --------------------------------------
   The shop builds its product blocks client-side from a template string, so
   rather than edit that template (it has broken the whole page before) the
   ratings are attached after render: each block carries id="prod-<handle>",
   which is enough to find it. Emits nothing at all when no product has
   reviews, so the shop is byte-identical to today until reviews exist. */
(function () {
  const MARK = /<!--RV_SHOP:START-->[\s\S]*?<!--RV_SHOP:END-->/;
  const data = {};
  for (const d of RV.loadAll()) data[d.handle] = { a: d.average, n: d.count };

  const payload = Object.keys(data).length ? `<script>
(function(){var RV=${JSON.stringify(data)};
function stars(v){var n=Math.max(0,Math.min(5,Math.floor(v||0)));
 return '<span class="rv-stars" aria-hidden="true">'+'★'.repeat(n)+'☆'.repeat(5-n)+'</span>';}
function paint(){var done=0;
 Object.keys(RV).forEach(function(h){
  var el=document.getElementById('prod-'+h); if(!el||el.querySelector('.pcard-rv'))return;
  var t=el.querySelector('h2'); if(!t)return;
  var d=RV[h],s=document.createElement('span'); s.className='pcard-rv';
  s.innerHTML=stars(d.a)+'<span class="pcard-rv-n">'+d.a.toFixed(1)+' · '+d.n+' review'+(d.n===1?'':'s')+'</span>';
  t.insertAdjacentElement('afterend',s); done++;});
 return done;}
if(!paint()){var n=0,iv=setInterval(function(){if(paint()||++n>40)clearInterval(iv);},250);}
})();
<\/script>` : '';

  const BANDMARK = /<!--RV_BAND:START-->[\s\S]*?<!--RV_BAND:END-->/;
  const bandHtml = RV.homepageBand({ compact: true });
  for (const f of ['shop-preview.html', 'shop/index.html']) {
    const file = path.join(ROOT, f);
    if (!fs.existsSync(file)) continue;
    let html = fs.readFileSync(file, 'utf8');
    if (!MARK.test(html)) continue;
    let next = html.replace(MARK, '<!--RV_SHOP:START-->' + payload + '<!--RV_SHOP:END-->');
    if (BANDMARK.test(next)) next = next.replace(BANDMARK, '<!--RV_BAND:START-->' + (bandHtml ? '<style>' + RV.CSS + '</style>' + bandHtml : '') + '<!--RV_BAND:END-->');
    if (next !== html) {
      fs.writeFileSync(file, next);
      console.log(payload ? `  ✓ shop star ratings (${f})` : `  · shop star ratings: no reviews yet (${f})`);
    }
  }
})();

/* ---------- homepage brand video band -----------------------------------
   Injected between markers because index.html is hand-maintained. Renders to
   an empty string until video/brand.mp4 exists, so the homepage is untouched
   until a cut has actually been prepared. */
(function () {
  const MARK = /<!--VIDEO:START-->[\s\S]*?<!--VIDEO:END-->/;
  /* The CSS lives in its own marked block so it can be REPLACED every build.
     The first version appended it once and skipped thereafter, so restyling
     the band from portrait to widescreen left the original CSS live in
     index.html and the change silently never shipped. */
  const CSSMARK = /\/\*VBAND-CSS-START\*\/[\s\S]*?\/\*VBAND-CSS-END\*\//;
  const payload = VB.exists() ? (VB.band() + VB.JS) : '';

  for (const f of ['index.html', 'homepage-preview.html', 'classic/index.html']) {
    const file = path.join(ROOT, f);
    if (!fs.existsSync(file)) continue;
    const before = fs.readFileSync(file, 'utf8');
    let html = before;
    if (!MARK.test(html)) continue;

    if (payload) {
      if (CSSMARK.test(html)) html = html.replace(CSSMARK, VB.CSS.trim());
      else html = html.replace('</style>', VB.CSS.trim() + '\n</style>');
    } else if (CSSMARK.test(html)) {
      html = html.replace(CSSMARK, '');
    }
    html = html.replace(MARK, '<!--VIDEO:START-->' + payload + '<!--VIDEO:END-->');

    /* compare against the ORIGINAL file, not against the post-CSS string -
       comparing the wrong pair is what threw the restyle away */
    if (html !== before) {
      fs.writeFileSync(file, html);
      console.log(payload ? `  \u2713 brand video band (${f})` : `  \u00b7 no brand video yet (${f})`);
    }
  }
})();

/* ---------- shop page star ratings --------------------------------------
   The shop builds its product blocks client-side from a template string, so
   rather than edit that template (it has broken the whole page before) the
   ratings are attached after render: each block carries id="prod-<handle>",
   which is enough to find it. Emits nothing at all when no product has
   reviews, so the shop is byte-identical to today until reviews exist. */
(function () {
  const MARK = /<!--RV_SHOP:START-->[\s\S]*?<!--RV_SHOP:END-->/;
  const data = {};
  for (const d of RV.loadAll()) data[d.handle] = { a: d.average, n: d.count };

  const payload = Object.keys(data).length ? `<script>
(function(){var RV=${JSON.stringify(data)};
function stars(v){var n=Math.max(0,Math.min(5,Math.floor(v||0)));
 return '<span class="rv-stars" aria-hidden="true">'+'★'.repeat(n)+'☆'.repeat(5-n)+'</span>';}
function paint(){var done=0;
 Object.keys(RV).forEach(function(h){
  var el=document.getElementById('prod-'+h); if(!el||el.querySelector('.pcard-rv'))return;
  var t=el.querySelector('h2'); if(!t)return;
  var d=RV[h],s=document.createElement('span'); s.className='pcard-rv';
  s.innerHTML=stars(d.a)+'<span class="pcard-rv-n">'+d.a.toFixed(1)+' · '+d.n+' review'+(d.n===1?'':'s')+'</span>';
  t.insertAdjacentElement('afterend',s); done++;});
 return done;}
if(!paint()){var n=0,iv=setInterval(function(){if(paint()||++n>40)clearInterval(iv);},250);}
})();
<\/script>` : '';

  for (const f of ['shop-preview.html', 'shop/index.html']) {
    const file = path.join(ROOT, f);
    if (!fs.existsSync(file)) continue;
    let html = fs.readFileSync(file, 'utf8');
    if (!MARK.test(html)) continue;
    const next = html.replace(MARK, '<!--RV_SHOP:START-->' + payload + '<!--RV_SHOP:END-->');
    if (next !== html) {
      fs.writeFileSync(file, next);
      console.log(payload ? `  ✓ shop star ratings (${f})` : `  · shop star ratings: no reviews yet (${f})`);
    }
  }
})();

/* ---------- homepage brand video band -----------------------------------
   Injected between markers because index.html is hand-maintained. Renders to
   an empty string until video/brand.mp4 exists, so the homepage is untouched
   until a cut has actually been prepared. */
(function () {
  const MARK = /<!--VIDEO:START-->[\s\S]*?<!--VIDEO:END-->/;
  const payload = VB.exists() ? (VB.band() + VB.JS) : '';
  for (const f of ['index.html', 'homepage-preview.html', 'classic/index.html']) {
    const file = path.join(ROOT, f);
    if (!fs.existsSync(file)) continue;
    let html = fs.readFileSync(file, 'utf8');
    if (!MARK.test(html)) continue;
    /* Replace the marked CSS block rather than only adding it when absent.
       The first version appended once and skipped thereafter, so restyling the
       band left the ORIGINAL portrait CSS live in index.html and the change
       silently never shipped. */
    const CSSMARK = /\/\*VBAND-CSS-START\*\/[\s\S]*?\/\*VBAND-CSS-END\*\//;
    if (payload) {
      if (CSSMARK.test(html)) html = html.replace(CSSMARK, VB.CSS.trim());
      else html = html.replace('</style>', VB.CSS + '\n</style>');
    } else {
      html = html.replace(CSSMARK, '');
    }
    const next = html.replace(MARK, '<!--VIDEO:START-->' + payload + '<!--VIDEO:END-->');
    if (next !== html) {
      fs.writeFileSync(file, next);
      console.log(payload ? `  \u2713 brand video band (${f})` : `  \u00b7 no brand video yet (${f})`);
    }
  }
})();

/* ==========================================================================
   TikTok pixel — one script tag, every page (12 Sep 2026)
   ==========================================================================
   /assets/tiktok-pixel.js (Pixel ID DAIGE43C77U9J87RH2BG) is inserted right
   after the Meta pixel tag on every built and hand-maintained page, so the
   two pixels always load in that order (tiktok-pixel.js wraps window.sbMeta
   to mirror AddToCart / InitiateCheckout). Idempotent: a page that already
   carries the tag is left alone. Runs BEFORE stampAssets so the tag gets its
   ?v= hash like every other asset. */
(function applyTikTokPixel() {
  const TAG = '<script src="/assets/tiktok-pixel.js" data-ttq defer></script>';
  const META = /<script src="\/assets\/meta-pixel\.js(?:\?v=[0-9a-f]*)?"[^>]*><\/script>/i;
  const pages = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (['node_modules', '.git', '_backup', '.vercel', 'assets', 'admin'].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) pages.push(p);
    }
  })(__dirname);
  let touched = 0, missing = [];
  for (const f of pages) {
    let src = fs.readFileSync(f, 'utf8');
    /* both pixels wait for the parser: neither is called synchronously anywhere */
    const deferred = src
      .replace(/<script src="\/assets\/(meta|tiktok)-pixel\.js(\?v=[0-9a-f]*)?"((?:(?!defer)[^>])*)>/gi,
               (m, w, v, rest) => `<script src="/assets/${w}-pixel.js${v || ''}"${rest} defer>`);
    if (deferred !== src) { fs.writeFileSync(f, deferred); src = deferred; }
    if (src.indexOf('/assets/tiktok-pixel.js') !== -1) continue;
    if (!/<\/head>/i.test(src)) { missing.push(path.relative(__dirname, f)); continue; }
    const out = META.test(src)
      ? src.replace(META, (m) => m + '\n' + TAG)
      : src.replace(/<\/head>/i, TAG + '\n</head>');
    if (out !== src) { fs.writeFileSync(f, out); touched++; }
  }
  console.log(`  ✓ TikTok pixel on ${pages.length - missing.length} page(s)` + (touched ? ` (${touched} added)` : '') + (missing.length ? ` - no <head> in: ${missing.join(', ')}` : ''));
})();


/* ==========================================================================
   Shop mega-menu — one script + sheet on every page (18 Sep 2026)
   ==========================================================================
   assets/sahra-nav.{css,js}. Same pattern as the welcome offer: the header
   markup lives in seven hand-maintained pages and two generators, so the
   menu is built at runtime from the existing "Shop" link rather than written
   into each of them. Nav decision of 18 Sep (MASTER_BRIEF Decision Log):
   Shop dropdown holds type / fit / place / edition; Collection, T-Shirts and
   Polo leave the desktop bar. Idempotent. Runs BEFORE stampAssets.
   ========================================================================== */
/* ==========================================================================
   Arabic commercial core — /ar/  (21 Sep 2026, Faheem)
   ==========================================================================
   Pass 1 is the commercial core only: home, about, contact (shop and the PDPs
   follow). Copy lives in ar-content.js and is TRANSCREATED, not translated.

   Held out of the index with noindex until Faheem has read the Arabic — the
   brief's shipping gate is explicit about Arabic after the Arabic-card
   incident, and a machine-checked page is not a read page. Flip AR_NOINDEX to
   false to publish; hreflang is already wired both ways and starts working the
   moment the noindex comes off.

   The English pages point at their Arabic counterpart via altHref, so the
   pairing is declared from both sides as Google requires. */
const AR = require('./ar-content');
/* LIVE 21 Sep 2026 after five independent Arabic reviews and the fixes recorded
   in ar-content.js. Set back to true to pull /ar/ out of the index. */
const AR_NOINDEX = false;

function arPage({ slug, title, desc, h1, bodyHtml, enHref, jsonld }) {
  const canonical = `${SITE}/ar/${slug}`.replace(/\/$/, '') + '/';
  write(`ar/${slug}${slug ? '/' : ''}index.html`.replace('//', '/'), shell({
    lang: 'ar',
    noindex: AR_NOINDEX,
    altHref: enHref,
    title, desc, canonical,
    jsonld: jsonld || { '@context': 'https://schema.org', '@type': 'WebPage', name: title, inLanguage: 'ar', url: canonical },
    bodyHtml,
    activeNav: 'none'
  }));
}

(function buildArabic() {
  const H = AR.home, A = AR.about, C = AR.contact, U = AR.ui;

  /* ---- home ---- */
  const placeCards = AR.places.map(pl =>
    `<article class="ar-place"><h3>${esc(pl.name)}</h3><p class="ar-emirate">${esc(pl.emirate)}</p><p>${esc(pl.text)}</p></article>`
  ).join('');

  arPage({
    slug: '', enHref: `${SITE}/`,
    title: H.title, desc: H.desc,
    bodyHtml: `
<main class="ar-main">
  <section class="ar-hero">
    <figure class="ar-hero-img"><img src="/shirts/hero-places-b.webp" alt="" width="1200" height="1800" fetchpriority="high" decoding="async"></figure>
    <p class="ar-eyebrow">${esc(H.editionEyebrow)}</p>
    <h1>${esc(H.h1)}</h1>
    <p class="ar-lede">${esc(H.lede)}</p>
    <p class="ar-cta"><a class="ar-btn" href="/ar/shop/">${esc(H.ctaShop)}</a></p>
    <p class="ar-fine">${esc(U.deliveryLine)}</p>
  </section>
  <section class="ar-sec">
    <h2>${esc(H.placesTitle)}</h2>
    <p class="ar-lede">${esc(H.placesText)}</p>
    <div class="ar-places">${placeCards}</div>
  </section>
  <section class="ar-sec ar-edition">
    <p class="ar-eyebrow">${esc(H.editionEyebrow)}</p>
    <h2>${esc(H.editionTitle)}</h2>
    <p>${esc(H.editionText)}</p>
    <p class="ar-fine">${esc(U.gsmTee)} &middot; ${esc(U.gsmPolo)} &middot; ${esc(U.labelPrinted)}</p>
  </section>
</main>`
  });

  /* ---- about ---- */
  arPage({
    slug: 'about', enHref: `${SITE}/about/`,
    title: A.title, desc: A.desc,
    bodyHtml: `
<main class="ar-main">
  <section class="ar-sec">
    <h1>${esc(A.h1)}</h1>
    ${A.body.map(t => `<p>${esc(t)}</p>`).join('\n    ')}
    <p class="ar-fine">${esc(U.gsmTee)} &middot; ${esc(U.labelPrinted)}</p>
  </section>
</main>`
  });

  /* ---- contact ---- */
  arPage({
    slug: 'contact', enHref: `${SITE}/contact/`,
    title: C.title, desc: C.desc,
    bodyHtml: `
<main class="ar-main">
  <section class="ar-sec">
    <h1>${esc(C.h1)}</h1>
    <p class="ar-lede">${esc(C.lede)}</p>
    <p><strong>${esc(C.emailLabel)}:</strong> <a href="mailto:hello@sahraandbeyond.ae" dir="ltr">hello@sahraandbeyond.ae</a></p>
    <p class="ar-fine">${esc(U.deliveryLine)}<br>${esc(U.exchangeLine)}</p>
  </section>
</main>`
  });

  console.log('  ✓ Arabic core: /ar/, /ar/about/, /ar/contact/' + (AR_NOINDEX ? '  (noindex — awaiting review)' : ''));
})();

/* ==========================================================================
   Arabic product pages and shop — /ar/products/<id>/, /ar/shop/  (23 Sep 2026)
   ==========================================================================
   CRO review item 13. Faheem, 23 Sep: "Switch now, I translate, native check
   later". Copy lives in content/products-ar/*.json (+ _strings.json); prices,
   photos, handles and stock come from the English product data and Shopify,
   so the two languages can never disagree on a fact.

   NOT YET READ BY A NATIVE SPEAKER. Held out of the index (noindex) and left
   out of the English pages' hreflang until Faheem has had them checked - the
   same gate /ar/ passed through on 21 Sep. Flip AR_PDP_NOINDEX to false after
   the native check; then add the product pairs to applyArabicHreflang. */
const AR_PDP_NOINDEX = true;
(function buildArabicProducts() {
  const ARDIR = path.join(__dirname, 'content', 'products-ar');
  if (!fs.existsSync(ARDIR)) return;
  const S = JSON.parse(fs.readFileSync(path.join(ARDIR, '_strings.json'), 'utf8'));
  const tpl = (t, o) => String(t).replace(/\{(\w+)\}/g, (m, k) => (o[k] != null ? o[k] : m));
  const T = PRODUCTS_ALL.map(p => {
    const f = path.join(ARDIR, p.id + '.json');
    return fs.existsSync(f) ? { p, a: JSON.parse(fs.readFileSync(f, 'utf8')) } : null;
  }).filter(Boolean).sort((x, y) => (x.p.order || 0) - (y.p.order || 0));
  /* Arabic price badge: '199 درهم', right-to-left; sahra-market.js keeps the Arabic form when it converts currency */
  const priceHtml = p => `<span class="sb-price" dir="rtl" data-handle="${esc(p.id)}" data-aed="${esc(String(p.price))}">${esc(String(p.price))} درهم</span>`;
  const designHandles = p => p.siblingOf ? [p.siblingOf + '-regular', p.siblingOf + '-oversized'] : [p.id];
  const shipLine = `<span class="sb-ship-uae">${esc(S.shipUae)}</span><span class="sb-ship-gcc">${esc(S.shipGcc)}</span><span class="sb-ship-intl">${esc(S.shipIntl)}</span>`;

  function ratingAr(p) {
    const pr = RV.pooled(designHandles(p)); if (!pr) return '';
    const d = pr.d, avg = d.average.toFixed(1);
    const label = pr.scope === 'design'
      ? (d.count === 1 ? tpl(S.reviewsDesignOne, { avg }) : tpl(S.reviewsDesign, { avg, n: d.count }))
      : tpl(S.reviewsCollection, { avg, n: d.count });
    return `<a class="arp-rating" href="/products/${p.id}/#reviews" hreflang="en"><span class="arp-stars" aria-hidden="true">&#9733;&#9733;&#9733;&#9733;&#9733;</span> <span>${esc(label)}</span></a>`;
  }

  /* ---- product pages ---- */
  T.forEach(({ p, a }) => {
    const shots = buildProducts.galShots(p);
    const fitWarn = p.garment === 'polo' ? S.fitPolo : (p.fit === 'oversized' ? S.fitOversized : S.fitRegular);
    const other = p.siblingOf ? (p.fit === 'oversized'
      ? `<a href="/ar/products/${p.siblingOf}-regular/">${esc(S.seeRegular)} &larr;</a>`
      : `<a href="/ar/products/${p.siblingOf}-oversized/">${esc(S.seeOversized)} &larr;</a>`) : '';
    const cards = (arr, tk, bk) => (arr || []).map(c => `<div class="arp-card"><h3>${esc(c[tk])}</h3><p>${esc(c[bk])}</p></div>`).join('');
    const body = `
<main class="ar-main arp">
  <nav class="arp-crumb" aria-label="مسار الصفحة"><a href="/ar/">${esc(S.home)}</a> &lsaquo; <a href="/ar/shop/">${esc(S.shop)}</a> &lsaquo; <span>${esc(a.name)}</span></nav>
  <section class="arp-top">
    <div class="arp-media">
      <div class="arp-main">${shots.map((x, i) => `<img${i === 0 ? ' class="on" fetchpriority="high"' : ' loading="lazy" decoding="async"'} src="${esc(x[0])}" alt="${esc(i === 0 ? (a.altMain || a.name) : a.name)}">`).join('')}</div>
      <div class="arp-thumbs">${shots.map((x, i) => `<button type="button"${i === 0 ? ' class="on"' : ''} data-i="${i}" aria-label="${i + 1}"><img src="${esc(x[0])}" alt="" loading="lazy" decoding="async"></button>`).join('')}</div>
      ${a.modelInfo ? `<p class="arp-model">${esc(a.modelInfo)}</p>` : ''}
    </div>
    <div class="arp-buy">
      ${a.placeName ? `<p class="ar-eyebrow">${esc(tpl(S.inspiredBy, { place: a.placeName, emirate: a.placeEmirate || '' }))}</p>` : ''}
      <h1>${esc(a.name)}</h1>
      <p class="arp-fabric">${esc(p.garment === 'polo' ? S.fabricPolo : S.fabricTee)}</p>
      ${ratingAr(p)}
      <p class="arp-price">${priceHtml(p)}</p>
      ${p.garment !== 'polo' ? `<p class="arp-bundle"><b>${esc(S.bundle)}</b> &middot; ${esc(S.bundleSub)}</p>` : ''}
      <p class="arp-ship">${shipLine}</p>
      <div class="arp-box" id="arpBox" data-handle="${esc(p.id)}">
        <div class="arp-sizes-l">${esc(S.size)} <a href="/size-guide/" hreflang="en">${esc(S.sizeGuide)}</a></div>
        <div class="arp-sizes" id="arpSizes" role="group" aria-label="${esc(S.selectSize)}">${['S', 'M', 'L', 'XL'].map(z => `<button type="button" class="arp-size" aria-pressed="false" dir="ltr">${z}</button>`).join('')}</div>
        <p class="arp-stock" id="arpStock" role="status" hidden></p>
        <p class="arp-fit">${esc(fitWarn)}${other ? ' ' + other : ''}</p>
        <button type="button" class="arp-add" id="arpAdd" disabled>${esc(S.selectSize)}</button>
        <button type="button" class="arp-now" id="arpNow">${esc(S.buyNow)}</button>
        <p class="arp-msg" id="arpMsg" role="status" aria-live="polite"></p>
        <p class="arp-reassure">${esc(S.reassure)} <a href="/policies.html#returns" hreflang="en">${esc(S.fullPolicy)}</a></p>
        <p class="arp-trust"><span>${esc(S.trustReturns)}</span><span>${esc(S.trustDesigned)}</span><span>${esc(S.limited)}</span></p>
      </div>
    </div>
  </section>

  <section class="ar-sec"><p class="ar-eyebrow">${esc(S.secStory)}</p><h2>${a.placeHeading || esc(a.name)}</h2>${a.placeBlurb ? `<p>${esc(a.placeBlurb)}</p>` : ''}<p>${esc(a.lede)}</p>${a.occasion ? `<p class="ar-fine">&#10022; ${esc(a.occasion)}</p>` : ''}</section>
  ${a.designHeading ? `<section class="ar-sec"><p class="ar-eyebrow">${esc(S.secDesign)}</p><h2>${a.designHeading}</h2><p>${esc(a.designIntro || '')}</p><div class="arp-cards">${cards(a.designCards, 'title', 'body')}${a.printCardTitle ? `<div class="arp-card"><h3>${esc(a.printCardTitle)}</h3><p>${esc(a.printCardBody || '')}</p></div>` : ''}${cards(a.constructionCards, 't', 'b')}</div></section>` : ''}
  <section class="ar-sec"><p class="ar-eyebrow">${esc(S.secDetails)}</p><ul class="arp-spec">${(a.specChips || []).map(c => `<li>${esc(c)}</li>`).join('')}${a.decoration ? `<li>${esc(a.decoration)}</li>` : ''}</ul>${a.colourName ? `<p class="arp-colour">${p.colourHex ? `<span class="arp-sw" style="background:${esc(p.colourHex)}"></span>` : ''}${esc(S.colour)}: <b>${esc(a.colourName)}</b>${p.colourPantone ? ` <span dir="ltr">(Pantone ${esc(p.colourPantone)})</span>` : ''}</p>` : ''}${a.edition ? `<p class="ar-fine">${esc(a.edition)}</p>` : ''}</section>
  <section class="ar-sec" id="fit"><p class="ar-eyebrow">${esc(S.secFit)}</p><h2>${a.fitHeading || esc(S.secFit)}</h2><p>${esc(a.fitWho || '')}</p>${a.fitExtra ? `<p>${esc(a.fitExtra)}</p>` : ''}<p><a href="/size-guide/" hreflang="en">${esc(S.sizeGuide)} &larr;</a></p></section>
  ${(a.care || []).length ? `<section class="ar-sec"><p class="ar-eyebrow">${esc(S.secCare)}</p><h2>${a.careHeading || esc(S.secCare)}</h2>${a.careIntro ? `<p>${esc(a.careIntro)}</p>` : ''}<ul class="arp-list">${a.care.map(c => `<li>${esc(c)}</li>`).join('')}</ul></section>` : ''}
  ${(a.faq || []).length ? `<section class="ar-sec"><p class="ar-eyebrow">${esc(S.secFaq)}</p>${a.faq.map(q => `<details class="arp-faq"><summary>${esc(q.q)}</summary><p>${esc(q.a)}</p></details>`).join('')}</section>` : ''}
  <section class="ar-sec"><p class="ar-eyebrow">${esc(S.secDelivery)}</p><p>${shipLine}</p><p>${esc(S.reassure)}</p></section>
  <section class="ar-sec"><p class="ar-eyebrow">${esc(S.secReviews)}</p>${ratingAr(p)}<p class="ar-fine">${esc(S.reviewNote)}</p></section>
  <p class="arp-en"><a href="/products/${p.id}/" hreflang="en" lang="en">${esc(S.readInEnglish)} &larr;</a> &middot; <a href="https://wa.me/971585449946" target="_blank" rel="noopener">${esc(S.whatsapp)}</a></p>
</main>
<script>
(function(){
  var imgs=[].slice.call(document.querySelectorAll('.arp-main img')),th=[].slice.call(document.querySelectorAll('.arp-thumbs button'));
  th.forEach(function(b){b.addEventListener('click',function(){var i=+b.dataset.i;imgs.forEach(function(x,k){x.classList.toggle('on',k===i);});th.forEach(function(x,k){x.classList.toggle('on',k===i);});});});
  var box=document.getElementById('arpBox'); if(!box) return;
  var handle=box.dataset.handle,sizes=document.getElementById('arpSizes'),add=document.getElementById('arpAdd'),now=document.getElementById('arpNow'),msg=document.getElementById('arpMsg');
  var S=${JSON.stringify({ add: S.addToCart, adding: S.adding, added: S.added, sold: S.soldOut, pick: S.selectSize, left1: 'بقيت قطعة واحدة فقط', left2: 'بقيت قطعتان فقط', left3: 'بقيت {n} قطع فقط', leftShort: 'بقي {n}', inSize: 'بمقاس' })};
  var vs=null,sel=null,pendingSize=null,live=false;
  function say(t){msg.textContent=t||'';}
  /* 7 Oct 2026: live remaining count at 3 or fewer. The size is read from the chip's first text node,
     because the chip can now carry a count under the letter. */
  function sz(b){return (b.firstChild&&b.firstChild.nodeValue||'').trim();}
  function left(q){return q===1?S.left1:q===2?S.left2:S.left3.replace('{n}',q);}
  function stock(v){var st=document.getElementById('arpStock'); if(!st) return; var q=v&&v.quantityAvailable;
    if(typeof q==='number'&&q>0&&q<=3){ st.innerHTML=left(q)+' '+S.inSize+' <span dir="ltr">'+v.title+'</span>'; st.hidden=false; } else st.hidden=true; }
  function pick(b){[].forEach.call(sizes.querySelectorAll('.arp-size'),function(x){x.classList.remove('sel');x.setAttribute('aria-pressed','false');});b.classList.add('sel');b.setAttribute('aria-pressed','true');}
  [].forEach.call(sizes.querySelectorAll('.arp-size'),function(b){b.addEventListener('click',function(){
    if(b.disabled) return; pick(b); say('');
    var t=sz(b);
    if(!live){ pendingSize=t; return; }
    sel=(vs||[]).filter(function(v){return v.title===t;})[0]||null;
    stock(sel);
    add.disabled=!sel; add.textContent=sel?S.add:S.pick;
  });});
  function apply(list){
    vs=list; live=true;
    [].forEach.call(sizes.querySelectorAll('.arp-size'),function(b){
      var v=vs.filter(function(x){return x.title===sz(b);})[0];
      if(!v||!v.availableForSale){ b.disabled=true; b.classList.add('out'); b.setAttribute('aria-label',sz(b)+' — '+S.sold); }
      else { var q=v.quantityAvailable;
        if(typeof q==='number'&&q>0&&q<=3){ b.setAttribute('aria-label',sz(b)+' — '+left(q)); b.innerHTML=sz(b)+'<span class="arp-left" dir="rtl">'+S.leftShort.replace('{n}',q)+'</span>'; } }
    });
    if(pendingSize){ var hit=[].filter.call(sizes.querySelectorAll('.arp-size'),function(b){return sz(b)===pendingSize&&!b.disabled;})[0]; pendingSize=null; if(hit) hit.click(); }
  }
  function load(){ if(window.SahraCart&&SahraCart.variants){ SahraCart.variants(handle).then(apply).catch(function(){}); } else setTimeout(load,200); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',load); else load();
  function go(toCheckout){
    if(!sel){ say(S.pick); var f=sizes.querySelector('.arp-size:not([disabled])'); if(f) f.focus(); return; }
    add.disabled=true; add.textContent=S.adding;
    SahraCart.add(sel.id,1,toCheckout?{open:false}:undefined).then(function(){
      if(window.track) try{track(toCheckout?'buy_now':'add_to_cart',{item_id:handle,size:sel.title,lang:'ar'});}catch(e){}
      if(toCheckout){ var st=SahraCart.state&&SahraCart.state(); if(st&&st.checkoutUrl){ location.href=st.checkoutUrl; return; } }
      add.disabled=false; add.textContent=S.add; say(S.added);
    }).catch(function(){ add.disabled=false; add.textContent=S.add; });
  }
  add.addEventListener('click',function(){go(false);});
  now.addEventListener('click',function(){go(true);});
})();
</script>`;
    const canonical = `${SITE}/ar/products/${p.id}/`;
    write(`ar/products/${p.id}/index.html`, shell({
      lang: 'ar', noindex: AR_PDP_NOINDEX, altHref: `${SITE}/products/${p.id}/`,
      title: a.seoTitle || a.name, desc: a.seoDesc || a.lede, canonical,
      image: `${SITE}${p.imgMain}`,
      jsonld: { '@context': 'https://schema.org', '@type': 'WebPage', name: a.name, inLanguage: 'ar', url: canonical },
      bodyHtml: body, activeNav: 'shop'
    }));
  });

  /* ---- shop ---- */
  const grid = T.map(({ p, a }) => {
    const img = (buildProducts.galShots(p)[0] || [])[0] || p.imgMain;
    return `<a class="arp-tile" href="/ar/products/${p.id}/"><span class="arp-tile-img"><img src="${esc(img)}" alt="${esc(a.altMain || a.name)}" loading="lazy" decoding="async"></span><span class="arp-tile-t">${esc(a.name)}</span><span class="arp-tile-p">${priceHtml(p)}</span>${p.garment !== 'polo' ? `<span class="arp-tile-b">${esc(S.bundle)}</span>` : ''}</a>`;
  }).join('');
  write('ar/shop/index.html', shell({
    lang: 'ar', noindex: AR_PDP_NOINDEX, altHref: `${SITE}/shop/`,
    title: 'المتجر | صحراء وما بعدها', desc: S.fabricTee, canonical: `${SITE}/ar/shop/`,
    jsonld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'المتجر', inLanguage: 'ar', url: `${SITE}/ar/shop/` },
    bodyHtml: `
<main class="ar-main arp">
  <nav class="arp-crumb" aria-label="مسار الصفحة"><a href="/ar/">${esc(S.home)}</a> &lsaquo; <span>${esc(S.shop)}</span></nav>
  <h1>${esc(S.shop)}</h1>
  <p class="ar-lede">${esc(S.shipUae)}</p>
  <div class="arp-grid">${grid}</div>
  <p class="arp-en"><a href="/shop/" hreflang="en" lang="en">English &larr;</a></p>
</main>`, activeNav: 'shop'
  }));
  console.log(`  ✓ Arabic product pages: ${T.length} + /ar/shop/` + (AR_PDP_NOINDEX ? '  (noindex — awaiting native review)' : ''));
})();

/* ==========================================================================
   Sahra Trail — /trail/ and /ar/trail/  (24 Sep 2026, Faheem)
   ==========================================================================
   The activewear line's coming-soon page. Faheem's brief: its own page, its
   own top-bar link and Shop-menu column, exciting animated visuals of
   mountain hiking and trail running, the Two Ridges logo animated, "coming
   soon", built to create anticipation.
   Approved choices (24 Sep): night-to-dawn fly-up; the logo
   draws itself then flashes like the reflective print; "this season", no date
   (the brief bars 29 Oct until the factory confirms); the two products as
   silhouettes with a reflective glint only; headline "The trail starts
   here."; sign-up on the house list tagged 'trail'; Arabic built alongside,
   noindex until a native read.
   Claims: none about fabric, UPF, cooling or recycling. The reflective mark
   is real (Decision Log 24 Sep); "designed in the UAE" is the house claim.
   Revision (24 Sep, Faheem: "these still look very fake"): the procedural
   three.js terrain is gone. The scene is now a photographic Hajar plate (a
   wadi-floor view of a limestone face with switchbacks, generated in Magnific
   in night and first-light versions, plus a depth map) moved in 2.5D by one
   raw-WebGL shader: parallax, the climb, first light arriving from the back,
   headlamps drawn on the traced path. Plates in assets/trail/hajar-*.
   The scene lives in assets/sahra-trail.js. The lockup below is the locked
   master's own outlines (print-files/sahra-trail/lockup), never retyped. */
(function buildTrail() {
  const L = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'sahra-trail-lockup.json'), 'utf8'));
  const T = {
    en: {
      title: 'Sahra Trail: Running Tee & 2-in-1 Shorts, Designed in the UAE',
      desc: 'Sahra Trail from Sahra & Beyond: the Trail Tee (AED 139), the 2-in-1 Shorts (AED 169) and the Kit (AED 249), designed in the UAE for its wadis and ridges.',
      eyebrow: 'A new line from Sahra &amp; Beyond',
      kicker: 'Running &amp; trail kit &middot; first run, this season',
      h1: 'Choose the climb.',   /* the Sahra Trail tagline (Faheem, 6 Oct 2026): exactly this, with the full stop */
      cta: 'Get first access',
      scroll: 'Scroll to climb',
      elev: 'Elev', time: 'Time',
      ch: [
        ['01', 'Night', 'Headlamps on', 'On UAE trails the day starts in the dark, ahead of the heat. The Two Ridges mark on the back is reflective, so it catches the light behind you.'],
        ['02', 'Climb', 'Wadi floor to ridge', 'Switchbacks, loose rock and the long pull out of the valley. Sahra Trail is for the <a href="/hiking/">trails</a>, <a href="/wadis/">wadis</a> and ridges of the UAE, from <a href="/locations/wadi-naqab/">Wadi Naqab</a> to <a href="/locations/jebel-jais/">Jebel Jais</a>.'],
        ['03', 'Run', 'Then you run it', 'Trail and run wear from Sahra &amp; Beyond, designed in the UAE.'],
        ['04', 'Dawn', 'First light on the ridge', 'The first run arrives this season: two pieces to start.']
      ],
      firstH: 'The first run', firstSub: 'Two pieces and the Kit.',
      /* 8 Oct 2026 (Faheem): the reveal is public with prices, so the page shows them. Held on the site until confirmed:
         the fabric line and "Lines from the seabed off Khor Fakkan" (both in the Reel). The site loop is cut without them. */
      rv: {
        tee: { name: 'Sahra Trail Tee', price: 'AED 139', line: 'Ocean-inspired print.', feats: ['Raglan sleeves', 'Mesh side panels', 'Covered seams', 'Reflective Two Ridges symbol under the collar'], alt: 'Sahra Trail Tee in teal with the ocean-inspired print, front and back' },
        short: { name: 'Sahra Trail 2-in-1 Shorts', price: 'AED 169', line: 'Wave-inspired graphic.', feats: ['Two shorts in one, with a hidden inner liner', 'Bonded phone pocket in the liner', 'Zip pocket for keys and cards', 'Internal drawcord', 'Reflective Two Ridges symbol'], alt: 'Sahra Trail 2-in-1 Shorts in charcoal with the wave-inspired graphic, front and back' },
        kit: { name: 'The Kit', price: 'AED 249', line: 'The Tee and the 2-in-1 Shorts together.', save: 'Save AED 59', alt: 'The Sahra Trail Kit: the Tee and the 2-in-1 Shorts' },
        renders: 'Pre-production renders', film: 'The reveal', filmAlt: 'Sahra Trail reveal film, muted: the Tee and the 2-in-1 Shorts and their details', pause: 'Pause film', play: 'Play film',
        cta: 'Get early access', ctaSub: 'The list can buy 24 hours before everyone else.'
      },
      tee: 'Sahra Trail Tee', short: 'Sahra Trail 2-in-1 Shorts', reveal: 'Revealed at launch', teeNote: 'Reflective Two Ridges mark under the collar', shortNote: 'Reflective Two Ridges mark on the left leg', flashHint: 'Tap to flash',
      joinH: 'Buy 24 hours before everyone else', joinP: 'Leave your email and your sizes. When Sahra Trail opens, this list can buy a full day before everyone else: the running tee, the 2-in-1 short and the kit.',
      ph: 'you@email.com', btn: 'Get early access', fine: 'Sizes help us plan the run. You will also hear about new places and drops now and then. Unsubscribe any time.',
      sizeTee: 'Tee size', sizeShort: 'Short size', sizeAny: 'Not sure yet',
      ok: 'You are on the list. You can buy 24 hours before everyone else.',
      err: 'Please enter a valid email address.',
      back: 'Meanwhile, the Founding Edition is in the shop &rarr;', backHref: '/shop/',
      hikes: 'Six UAE hikes, by grade &rarr;'
    },
    ar: {
      title: 'صحراء تريل: ملابس رياضية قريبًا | صحراء وما بعدها',
      desc: 'صحراء تريل خط جديد لملابس الجري والمشي الجبلي من صحراء وما بعدها، صُمّم في الإمارات لدروبها ووديانها وقممها. الدفعة الأولى تصل هذا الموسم.',
      eyebrow: 'خط جديد من صحراء وما بعدها',
      kicker: 'ملابس رياضية · الدفعة الأولى هذا الموسم',
      h1: 'الدرب يبدأ من هنا',
      tag: 'Choose the climb.',   /* shown in English under the lockup: no Arabic version is approved (Faheem, 6 Oct 2026) */
      cta: 'كن أول من يعرف',
      scroll: 'مرّر لتصعد',
      elev: 'الارتفاع', time: 'الوقت',
      ch: [
        ['01', 'الليل', 'مصابيح الرأس مضاءة', 'على دروب الإمارات يبدأ اليوم في الظلام، قبل الحرّ. شعار القمّتين على الظهر عاكس، فيلتقط الضوء خلفك.'],
        ['02', 'الصعود', 'من قاع الوادي إلى القمّة', 'منعطفات متعرّجة، وصخور متناثرة، وصعود طويل من الوادي. صحراء تريل لدروب الإمارات ووديانها وقممها.'],
        ['03', 'الجري', 'ثم تجري عليه', 'ملابس للجري والمشي الجبلي من صحراء وما بعدها، صُمّمت في الإمارات.'],
        ['04', 'الفجر', 'أول الضوء على القمّة', 'الدفعة الأولى تصل هذا الموسم: قطعتان للبداية.']
      ],
      firstH: 'الدفعة الأولى', firstSub: 'قطعتان والطقم.',
      rv: {
        tee: { name: 'تيشيرت صحراء تريل', price: '139 درهمًا', line: 'نقشة مستوحاة من البحر.', feats: ['أكمام راجلان', 'ألواح شبكية على الجانبين', 'درزات مغطّاة', 'شعار القمّتين العاكس أسفل الياقة'], alt: 'تيشيرت صحراء تريل باللون الأخضر المزرق بنقشة مستوحاة من البحر، من الأمام والخلف' },
        short: { name: 'شورت صحراء تريل 2 في 1', price: '169 درهمًا', line: 'رسمة مستوحاة من الأمواج.', feats: ['شورتان في واحد، مع بطانة داخلية مخفية', 'جيب للهاتف ملتصق بالبطانة', 'جيب بسحّاب للمفاتيح والبطاقات', 'رباط داخلي', 'شعار القمّتين العاكس'], alt: 'شورت صحراء تريل 2 في 1 باللون الفحمي برسمة مستوحاة من الأمواج، من الأمام والخلف' },
        kit: { name: 'الطقم', price: '249 درهمًا', line: 'التيشيرت والشورت 2 في 1 معًا.', save: 'وفّر 59 درهمًا', alt: 'طقم صحراء تريل: التيشيرت والشورت 2 في 1' },
        renders: 'صور تصميم قبل الإنتاج', film: 'فيلم الكشف', filmAlt: 'فيلم الكشف عن صحراء تريل بلا صوت: التيشيرت والشورت 2 في 1 وتفاصيلهما', pause: 'إيقاف الفيلم', play: 'تشغيل الفيلم',
        cta: 'انضم إلى القائمة', ctaSub: 'يستطيع المسجّلون الشراء قبل الجميع بـ24 ساعة.'
      },
      tee: 'تيشيرت صحراء تريل', short: 'شورت صحراء تريل 2 في 1', reveal: 'يُكشف عنه عند الإطلاق', teeNote: 'شعار القمّتين العاكس أسفل الياقة', shortNote: 'شعار القمّتين العاكس على الساق اليسرى', flashHint: 'انقر للوميض',
      joinH: 'اشترِ قبل الجميع بـ24 ساعة', joinP: 'اترك بريدك الإلكتروني ومقاساتك. عند افتتاح صحراء تريل، يستطيع المسجّلون في هذه القائمة الشراء قبل الجميع بيوم كامل: تيشيرت الجري، والشورت 2 في 1، والطقم.',
      sizeTee: 'مقاس التيشيرت', sizeShort: 'مقاس الشورت', sizeAny: 'لست متأكدًا بعد',
      ph: 'you@email.com', btn: 'انضم إلى القائمة', fine: 'وستصلك أيضًا أخبار الأماكن والإصدارات الجديدة من حين لآخر. يمكنك إلغاء الاشتراك في أي وقت.',
      ok: 'تمّت إضافتك. ستتمكن من الشراء قبل الجميع بـ24 ساعة.',
      err: 'يرجى إدخال بريد إلكتروني صحيح.',
      back: 'حتى ذلك الحين، الإصدار التأسيسي متوفر في المتجر ←', backHref: '/ar/shop/'
    }
  };
  /* centre lines of the two ridges, in the symbol's own units: the reveal masks follow them */
  const NEAR_C = 'M12.6,82.6 Q24.5,63 37.6,49.4 Q58,60.5 77.8,76.6';
  const FAR_C = 'M54.4,32.8 Q61.5,22.2 69.6,17.2 Q80.2,23.3 88.3,31.6';
  const logo = (id) => `
<svg class="tr-logo" id="trLogo" viewBox="${L.vb}" role="img" aria-label="Sahra Trail" tabindex="0">
  <defs>
    <mask id="${id}mN" maskUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="200"><path class="tr-mk tr-mk-n" d="${NEAR_C}" pathLength="1"/></mask>
    <mask id="${id}mF" maskUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="200"><path class="tr-mk tr-mk-f" d="${FAR_C}" pathLength="1"/></mask>
    <clipPath id="${id}clip"><path transform="${L.tr}" d="${L.far} ${L.near}"/></clipPath>
    <linearGradient id="${id}sh" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".95"/>
      <stop offset=".55" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <g class="tr-sym">
    <path class="tr-near" mask="url(#${id}mN)" transform="${L.tr}" fill="#D9C3A5" fill-rule="evenodd" d="${L.near}"/>
    <g class="tr-far"><path mask="url(#${id}mF)" transform="${L.tr}" fill="#D9C3A5" fill-rule="evenodd" d="${L.far}"/></g>
    <g clip-path="url(#${id}clip)"><rect class="tr-shine" x="-120" y="0" width="120" height="244.5" fill="url(#${id}sh)"/></g>
  </g>
  <path class="tr-word" fill="#D9C3A5" d="${L.word}"/>
</svg>`;
  /* The first run: low-key studio shots of the real garments (Magnific, from the v4 placement renders),
     the locked symbol composited at spec size and position, and a reflective flash layered on top.
     Tee: 50 mm, centred on CB, top edge 3 cm below the CB neck seam. Short: 42 mm, front of the
     wearer's LEFT leg, outer edge 3 cm in from the side seam, just above the hem (Decision Log, v4). */
  const shot = (k, alt) => `<div class="tr-shot"><img class="tr-shot-img" src="/assets/trail/trail-${k}-teaser.webp" width="800" height="993" alt="${alt}" loading="lazy" decoding="async"><img class="tr-flash" src="/assets/trail/trail-${k}-flash.png" alt="" aria-hidden="true" style="${k === 'tee' ? 'left:42.73%;top:14.63%;width:13.47%' : 'left:71.71%;top:64.93%;width:13.15%'}"><i class="tr-sweep" aria-hidden="true"></i></div>`;

  function page(lang) {
    const t = T[lang], AR = lang === 'ar', id = AR ? 'tra' : 'tre';
    const chapters = t.ch.map((c, k) => `
  <section class="tr-ch tr-ch-${k + 1}" aria-labelledby="${id}c${k}">
    <div class="tr-rv">
      <p class="tr-num"><span>${c[0]}</span>&mdash; ${c[1]}</p>
      <h2 id="${id}c${k}">${c[2]}</h2>
      <p class="tr-lede">${c[3]}</p>
    </div>
  </section>`).join('');
    return `
<style>
body.trail-page{background:#04070d;color:#EADBC4}
body.trail-page .hdr{background:rgba(6,10,16,.55);border-bottom-color:rgba(217,195,165,.14);color:#EADBC4}
body.trail-page .hdr a,body.trail-page .hdr button,body.trail-page .brand-sahra,body.trail-page .brand-beyond{color:#EADBC4}
body.trail-page .brand img{filter:brightness(0) invert(.88) sepia(.25)}
body.trail-page .ftr{position:relative;z-index:2}
#trGL{position:fixed;inset:0;width:100vw;height:100vh;height:100lvh;display:block;z-index:0;background:#04070d url(data:image/webp;base64,UklGRkQBAABXRUJQVlA4IDgBAAAQCgCdASpAACQAPslSoEunpKMhtVQMAPAZCWUAy2qrUDsgnCOQ3gp9sI2OLK/S4O5m5iJ3bzNc7Lbdh1MSjk0n2GNvJ9764pDWeZjBfANQKAlPCe8cAT5oAAD+7Nfdmo+lgbqxTnxID4B4qGBbL2abEXOfbKBPW+F2jLAh2kphzGvlnxlGD1rHAgvXsN2P07ilXJ8MPfQDVQOXX5AiPBLn1/6PxIiL7C6Q93UaVp8lPdoZeNYmg2l6go4PZF1zZBdYWDSO2RcKjOhGMMqJrYz0NrxslihXPGopfxmpqLxcfu4E7w7Ts7gWPbxL769qKhyX7XY9KfdGqk0kgj1gnMXpuYNL2sKqiitbcmm3L3zIliZLdXgLSNGIdhCsDAUw4jhIskH0RNY9ef5Y/0X8l69B6ZsswYUCAAA=) 50% 66%/cover no-repeat}
.tr-nogl #trGL{background:#04070d url(/assets/trail/hajar-night-m.webp) 50% 62%/cover no-repeat}
main.tr{position:relative;z-index:1;--tr-dawn:0;max-width:none!important;margin:0!important;padding:0!important;background:transparent!important;box-shadow:none!important;border:0!important}
.tr-veil{position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(120% 80% at 50% 110%,rgba(4,7,13,0) 40%,rgba(4,7,13,.55) 100%);opacity:calc(1 - var(--tr-dawn,0)*.8)}
.tr section{position:relative;z-index:1}
.tr-hero{min-height:100vh;min-height:100svh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:90px 20px 110px}
.tr-eyebrow{font-family:'Space Mono',monospace;font-size:12px;letter-spacing:.24em;text-transform:uppercase;color:#D9C3A5;opacity:0;animation:trUp .9s 2.9s forwards}
.tr-logo{width:min(760px,88vw);height:auto;margin:22px 0 10px;overflow:visible;cursor:pointer;outline:none}
.tr-mk{fill:none;stroke:#fff;stroke-width:19;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1 2;stroke-dashoffset:1.1}
.tr-logo.go .tr-mk-n{animation:trDraw 1.5s .35s cubic-bezier(.65,0,.35,1) forwards}
.tr-logo.go .tr-mk-f{animation:trDraw 1.1s 1.35s cubic-bezier(.65,0,.35,1) forwards}
.tr-far{transform-box:fill-box;transform-origin:50% 100%}
.tr-logo.go .tr-far{animation:trLift 1.4s 1.3s cubic-bezier(.2,.8,.2,1) both}
.tr-word{opacity:0;transform:translateX(18px)}
.tr-logo.go .tr-word{animation:trWord 1s 2.25s cubic-bezier(.2,.8,.2,1) forwards}
.tr-shine{transform:translateX(0)}
.tr-logo.flash .tr-shine{animation:trShine .8s cubic-bezier(.4,0,.2,1)}
.tr-logo.flash .tr-sym{animation:trBloom 1.2s ease-out}
.tr-logo.flash .tr-word{animation:trWordGlow 1.2s ease-out;opacity:1;transform:none}
@keyframes trDraw{to{stroke-dashoffset:0}}
@keyframes trLift{0%{transform:translateY(14px)}100%{transform:none}}
@keyframes trWord{to{opacity:1;transform:none}}
@keyframes trShine{0%{transform:translateX(0)}100%{transform:translateX(420px)}}
@keyframes trBloom{0%{filter:none}22%{filter:drop-shadow(0 0 14px rgba(255,255,255,1)) drop-shadow(0 0 44px rgba(210,230,255,.75)) brightness(2.1)}100%{filter:none}}
@keyframes trWordGlow{0%{filter:none}30%{filter:drop-shadow(0 0 12px rgba(255,255,255,.55)) brightness(1.35)}100%{filter:none}}
@keyframes trUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
/* The tagline as the lockup's sign-off (Faheem, 6 Oct 2026, option A): Jost Medium capitals, tracked like TRAIL,
   starting under the S of SAHRA and ending under the L of TRAIL. Every size is a fraction of the lockup's own
   width (min(760px,88vw)): wordmark starts at 29.68% and is 67.14% wide; at .36em tracking the line fills that
   width at a font-size of 4.316% of the lockup. The source stays sentence case with its full stop. */
html body main.tr .tr-hero .tr-tagline{font-family:'Jost','Space Mono',system-ui,sans-serif!important;font-weight:500!important;font-style:normal!important;font-size-adjust:none!important;
  font-size:min(32.8px,3.798vw)!important;letter-spacing:.36em!important;text-transform:uppercase!important;line-height:1!important;white-space:nowrap;
  color:#D9C3A5!important;text-shadow:0 2px 18px rgba(0,0,0,.6)!important;direction:ltr;unicode-bidi:isolate;text-align:left!important;
  box-sizing:border-box;width:min(760px,88vw);max-width:none!important;padding:0 0 0 min(225.6px,26.12vw)!important;
  margin:calc(min(760px,88vw)*-.052 - 10px) 0 calc(min(760px,88vw)*.05) !important;opacity:0;animation:trUp .9s 2.9s forwards}
.tr-kicker{font-family:'Space Mono',monospace;font-size:12.5px;letter-spacing:.2em;text-transform:uppercase;color:#9ED0CB;opacity:0;animation:trUp .9s 3.1s forwards;margin:4px 0 26px}
.tr-hero h1{font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-weight:500;font-size:clamp(40px,7vw,86px);line-height:1.02;margin:0 0 26px;color:#F6ECDD;text-shadow:0 2px 30px rgba(0,0,0,.6);opacity:0;animation:trUp 1.1s 3.35s forwards}
.tr-btn{display:inline-flex;align-items:center;gap:10px;min-height:52px;padding:0 26px;border-radius:999px;background:#D9C3A5;color:#10161d;font-weight:600;font-size:15px;letter-spacing:.06em;text-transform:uppercase;text-decoration:none;opacity:0;animation:trUp .9s 3.7s forwards;box-shadow:0 10px 40px rgba(217,195,165,.25)}
.tr-btn:hover{background:#F3E4CB}
.tr-cue{position:absolute;bottom:92px;left:50%;transform:translateX(-50%);font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:rgba(234,219,196,.7);opacity:0;animation:trUp .9s 4.2s forwards}
.tr-cue i{display:block;width:1px;height:38px;margin:10px auto 0;background:linear-gradient(#EADBC4,transparent);animation:trCue 1.8s 4.2s infinite}
@keyframes trCue{0%{transform:scaleY(0);transform-origin:top}50%{transform:scaleY(1);transform-origin:top}51%{transform-origin:bottom}100%{transform:scaleY(0);transform-origin:bottom}}
.tr-ch{min-height:120vh;display:flex;align-items:center;padding:0 max(22px,8vw)}
.tr-ch:nth-of-type(odd){justify-content:flex-end}
.tr-ch>div{max-width:520px;padding:26px 28px;border-left:1px solid rgba(217,195,165,.35);background:linear-gradient(90deg,rgba(4,7,13,.55),rgba(4,7,13,0))}
[dir=rtl] .tr-ch>div{border-left:0;border-right:1px solid rgba(217,195,165,.35);background:linear-gradient(270deg,rgba(4,7,13,.55),rgba(4,7,13,0))}
.tr-num{font-family:'Space Mono',monospace;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#9ED0CB;margin:0 0 12px}
.tr-num span{color:#D9C3A5;margin-inline-end:10px}
.tr-ch h2{font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-weight:500;font-size:clamp(38px,5.6vw,72px);line-height:1.02;margin:0 0 14px;color:#F6ECDD;text-shadow:0 2px 24px rgba(0,0,0,.55)}
.tr-lede{font-size:18px;line-height:1.6;color:#E6D8C3;margin:0;text-shadow:0 1px 12px rgba(0,0,0,.6)}
.tr-rv{opacity:0;transform:translateY(34px);transition:opacity 1s ease,transform 1.1s cubic-bezier(.2,.8,.2,1)}
.tr-rv.in{opacity:1;transform:none}
.tr-first{padding:18vh 20px 10vh;text-align:center}
.tr-first h2,.tr-join h2{font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-weight:500;font-size:clamp(36px,5vw,64px);margin:0 0 8px;color:#1b1410}
.tr-first>div>p,.tr-join p{color:#2a2016;font-size:17px}
.tr-pieces{display:grid;grid-template-columns:repeat(2,minmax(0,340px));gap:28px;justify-content:center;margin-top:36px}
.tr-piece{position:relative;padding:22px 18px 20px;border-radius:18px;background:rgba(10,16,22,.78);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(217,195,165,.18);color:#EADBC4}
.tr-piece{font:inherit;text-align:center;cursor:pointer;display:block;width:100%}
.tr-piece:focus-visible{outline:2px solid #9ED0CB;outline-offset:3px}
.tr-shot{position:relative;aspect-ratio:800/993;border-radius:12px;overflow:hidden;background:#0b0f14;box-shadow:0 20px 50px rgba(0,0,0,.45)}
.tr-shot-img{display:block;width:100%;height:100%;object-fit:cover}
.tr-flash{position:absolute;height:auto;opacity:0;pointer-events:none;mix-blend-mode:screen;animation:trFlash 5s infinite}
.tr-piece:nth-child(1) .tr-flash{animation-delay:1.2s}.tr-piece:nth-child(2) .tr-flash{animation-delay:3.7s}
.tr-sweep{position:absolute;inset:-10% -60%;pointer-events:none;background:linear-gradient(105deg,transparent 42%,rgba(255,244,228,.10) 49%,rgba(255,244,228,.16) 50%,rgba(255,244,228,.10) 51%,transparent 58%);transform:translateX(-60%);animation:trSweep 5s infinite}
.tr-piece:nth-child(1) .tr-sweep{animation-delay:.95s}.tr-piece:nth-child(2) .tr-sweep{animation-delay:3.45s}
.tr-piece.fl .tr-flash{animation:trFlashTap 1s 1}.tr-piece.fl .tr-sweep{animation:trSweepTap 1s 1}
@keyframes trFlash{0%,100%{opacity:0}3%{opacity:1}9%{opacity:.85}18%{opacity:0}}
@keyframes trSweep{0%{transform:translateX(-60%)}20%,100%{transform:translateX(60%)}}
@keyframes trFlashTap{0%,100%{opacity:0}14%{opacity:1}40%{opacity:.8}}
@keyframes trSweepTap{0%{transform:translateX(-60%)}100%{transform:translateX(60%)}}
.tr-piece b{display:block;font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-size:26px;font-weight:600;color:#F6ECDD;margin-top:8px}
.tr-piece small{display:block;font-family:'Space Mono',monospace;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:#9ED0CB;margin-top:6px}
.tr-piece em{display:block;font-style:normal;font-size:13.5px;color:#CDBEA8;margin-top:4px}
.tr-rvl{display:grid;grid-template-columns:minmax(0,340px) minmax(0,460px);gap:40px;justify-content:center;align-items:start;margin-top:40px;text-align:start}
.tr-film{position:sticky;top:96px;margin:0}
.tr-film video{display:block;width:100%;height:auto;aspect-ratio:9/16;border-radius:22px;background:#0b0f14;box-shadow:0 30px 70px rgba(0,0,0,.5);border:1px solid rgba(217,195,165,.22)}
.tr-film-btn{position:absolute;bottom:42px;inset-inline-end:12px;min-height:36px;padding:0 14px;border-radius:999px;border:0;background:rgba(10,16,22,.72);color:#F6ECDD;font:600 12.5px/1 'Jost',system-ui,sans-serif;letter-spacing:.06em;cursor:pointer}
.tr-film-btn:focus-visible{outline:2px solid #9ED0CB;outline-offset:2px}
.tr-film figcaption{margin-top:10px;text-align:center;font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#CDBEA8}
.tr-cards{display:flex;flex-direction:column;gap:22px}
.tr-card{border-radius:18px;overflow:hidden;background:rgba(10,16,22,.82);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(217,195,165,.18);color:#EADBC4;padding:0 0 18px}
.tr-card img{display:block;width:100%;height:auto;aspect-ratio:1080/820}
.tr-card-t{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:16px 20px 0}
html body main.tr .tr-card h3{font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-weight:600;font-size:26px;line-height:1.15;margin:0;color:#F6ECDD}
.tr-price{margin:0;font-family:'Jost',system-ui,sans-serif;font-weight:600;font-size:19px;color:#F6ECDD;white-space:nowrap}
.tr-line{margin:6px 20px 0;font-size:15.5px;color:#9ED0CB}.tr-line b{color:#E9B978;font-weight:600}
.tr-card ul{margin:10px 20px 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:8px}
.tr-card li{font-size:13px;line-height:1.3;padding:6px 10px;border-radius:999px;border:1px solid rgba(217,195,165,.28);color:#EADBC4}
.tr-kit .tr-btn-sm{margin:14px 20px 0;opacity:1;animation:none}
.tr-cta-sub{margin:8px 20px 0;font-size:13.5px;color:#CDBEA8}
.tr-renders{margin:0;text-align:center;font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#CDBEA8}
@media(max-width:820px){.tr-rvl{grid-template-columns:1fr;max-width:460px;margin-left:auto;margin-right:auto;gap:28px}.tr-film{position:relative;top:auto;max-width:300px;margin:0 auto}}
[dir=rtl] .tr-card h3{font-family:inherit!important;font-weight:700!important;font-size:22px!important}
[dir=rtl] .tr-film figcaption,[dir=rtl] .tr-renders{font-family:inherit;letter-spacing:0;text-transform:none;font-size:13px}
.tr-join{padding:8vh 20px 16vh;text-align:center}
.tr-join>div{max-width:560px;margin:0 auto;padding:34px 26px;border-radius:20px;background:rgba(250,244,234,.92);color:#2a2016;box-shadow:0 30px 80px rgba(0,0,0,.35)}
.tr-form{display:flex;gap:10px;margin:22px 0 10px}
.tr-form-sizes{flex-direction:column}.tr-row{display:flex;gap:10px}.tr-sizes{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.tr-sizes label{display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:#5C5346}.tr-sizes span{font-family:'Space Mono',monospace;font-size:10.5px;letter-spacing:1.6px;text-transform:uppercase}
.tr-sizes select{min-height:46px;padding:0 12px;border-radius:12px;border:1px solid rgba(42,32,22,.3);font:inherit;font-size:15px;background:#fff;color:#2a2016}
@media(max-width:600px){.tr-row{flex-direction:column}}
.tr-form input{flex:1;min-width:0;min-height:52px;padding:0 16px;border-radius:12px;border:1px solid rgba(42,32,22,.3);font-size:16px;background:#fff;color:#2a2016}
.tr-form button{min-height:52px;padding:0 22px;border-radius:12px;border:0;background:#285C5C;color:#F3E7D3;font-weight:600;font-size:15px;cursor:pointer}
.tr-form button:hover{background:#1F4B4B}
.tr-join .tr-fine{font-size:13px;color:#5C5148;margin:0}
.tr-join .tr-ok,.tr-join .tr-err{display:none;font-size:15px;margin:12px 0 0}
[data-waitlist-wrap].done .tr-form,[data-waitlist-wrap].done .tr-fine{display:none}
[data-waitlist-wrap].done .tr-ok{display:block;color:#1F4B4B;font-weight:600}
[data-waitlist-wrap].err .tr-err{display:block;color:#9b3a25}
[data-waitlist-wrap].loading button{opacity:.6}
.tr-back{display:inline-block;margin-top:22px;color:#285C5C;font-weight:600}
.tr-first,.tr-join{background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,0))}
.tr-first h2,.tr-first>div>p{color:#FFF4E4;text-shadow:0 2px 20px rgba(0,0,0,.45)}
.tr-hud{position:fixed;left:18px;bottom:18px;z-index:3;display:flex;gap:18px;align-items:flex-end;padding:10px 14px;border-radius:12px;background:rgba(4,7,13,.45);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(217,195,165,.16);font-family:'Space Mono',monospace;color:#EADBC4;pointer-events:none}
.tr-hud small{display:block;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#9ED0CB}
.tr-hud b{display:block;font-size:17px;font-weight:700;letter-spacing:.02em;font-variant-numeric:tabular-nums;direction:ltr}
.tr-hud i{position:absolute;left:14px;right:14px;bottom:6px;height:2px;background:rgba(217,195,165,.18)}
.tr-hud i b{position:absolute;inset:0;background:#D9C3A5;transform-origin:left;transform:scaleX(0)}
/* Arabic: no letter-spacing or capitals (spacing breaks the joins), the page's Arabic face, a size up */
[dir=rtl] .tr-eyebrow,[dir=rtl] .tr-kicker,[dir=rtl] .tr-num,[dir=rtl] .tr-cue,[dir=rtl] .tr-hud small,[dir=rtl] .tr-piece small,[dir=rtl] .tr-btn{
  font-family:inherit;letter-spacing:0;text-transform:none}
[dir=rtl] .tr-eyebrow,[dir=rtl] .tr-kicker{font-size:16px}
[dir=rtl] .tr-num{font-size:15px}[dir=rtl] .tr-cue{font-size:13px}[dir=rtl] .tr-hud small{font-size:11.5px}
[dir=rtl] .tr-btn{font-size:17px}[dir=rtl] .tr-piece small{font-size:13px}
[dir=rtl] .tr-hero h1,[dir=rtl] .tr-ch h2,[dir=rtl] .tr-first h2,[dir=rtl] .tr-join h2,[dir=rtl] .tr-piece b{font-family:inherit;font-weight:700;line-height:1.3}
[dir=rtl] .tr-hud{direction:ltr}
@media(max-width:700px){
  .tr-hero{padding:80px 18px 120px}
  .tr-ch{min-height:105vh;padding:0 18px;justify-content:flex-start!important}
  .tr-ch>div{padding:20px 18px}
  .tr-lede{font-size:17px}
  .tr-pieces{grid-template-columns:1fr;max-width:340px;margin-left:auto;margin-right:auto}
  .tr-form{flex-direction:column}
  .tr-hud{left:12px;bottom:12px;gap:14px;padding:8px 12px}
  .tr-cue{bottom:96px}
}
@media(prefers-reduced-motion:reduce){
  .tr-eyebrow,.tr-kicker,.tr-tagline,.tr-hero h1,.tr-btn,.tr-cue,.tr-word{animation:none!important;opacity:1!important;transform:none!important}
  .tr-mk{stroke-dashoffset:0!important;animation:none!important}.tr-far{animation:none!important}
  .tr-rv{opacity:1;transform:none;transition:none}
  .tr-flash,.tr-sweep,.tr-cue i{animation:none}
}
</style>
<canvas id="trGL" aria-hidden="true"></canvas>
<div class="tr-veil" aria-hidden="true"></div>
<main class="tr" id="trail">
  <section class="tr-hero">
    <p class="tr-eyebrow">${t.eyebrow}</p>
    ${logo(id)}
    ${t.tag ? `<p class="tr-tagline" lang="en" dir="ltr">${t.tag}</p>` : `<h1 class="tr-tagline">${t.h1}</h1>`}
    <p class="tr-kicker">${t.kicker}</p>
    ${t.tag ? `<h1>${t.h1}</h1>` : ''}
    <a class="tr-btn" href="#first-access">${t.cta} <span aria-hidden="true">&darr;</span></a>
    <div class="tr-cue" aria-hidden="true">${t.scroll}<i></i></div>
  </section>
  ${chapters}
  <section class="tr-first" aria-labelledby="${id}first">
    <div class="tr-rv">
      <h2 id="${id}first">${t.firstH}</h2>
      <p>${t.firstSub}</p>
      ${/* 8 Oct 2026: the reveal on the site. Film (muted loop cut from the Reel) beside three cards with prices. */''}
      <div class="tr-rvl">
        <figure class="tr-film"><video id="${id}film" muted loop playsinline preload="none" poster="/assets/trail/reveal/trail-reveal-poster.jpg" width="720" height="1280" aria-label="${t.rv.filmAlt}"><source src="/assets/trail/reveal/trail-reveal-loop.mp4" type="video/mp4"></video>
          <button type="button" class="tr-film-btn" data-play="${t.rv.play}" data-pause="${t.rv.pause}" aria-controls="${id}film">${t.rv.play}</button>
          <figcaption>${t.rv.film} &middot; ${t.rv.renders}</figcaption></figure>
        <div class="tr-cards">
          ${['tee', 'short'].map(k => { const r = t.rv[k]; return `<article class="tr-card"><img src="/assets/trail/reveal/trail-${k}-720.webp" srcset="/assets/trail/reveal/trail-${k}-720.webp 720w, /assets/trail/reveal/trail-${k}.webp 1080w" sizes="(max-width:700px) 92vw, 420px" width="1080" height="820" alt="${r.alt}" loading="lazy" decoding="async"><div class="tr-card-t"><h3>${r.name}</h3><p class="tr-price">${r.price}</p></div><p class="tr-line">${r.line}</p><ul>${r.feats.map(f => `<li>${f}</li>`).join('')}</ul></article>`; }).join('')}
          <article class="tr-card tr-kit"><img src="/assets/trail/reveal/trail-kit-720.webp" srcset="/assets/trail/reveal/trail-kit-720.webp 720w, /assets/trail/reveal/trail-kit.webp 1080w" sizes="(max-width:700px) 92vw, 420px" width="1080" height="820" alt="${t.rv.kit.alt}" loading="lazy" decoding="async"><div class="tr-card-t"><h3>${t.rv.kit.name}</h3><p class="tr-price">${t.rv.kit.price}</p></div><p class="tr-line">${t.rv.kit.line} <b>${t.rv.kit.save}</b></p>
            <a class="tr-btn tr-btn-sm" href="#first-access">${t.rv.cta} <span aria-hidden="true">&darr;</span></a><p class="tr-cta-sub">${t.rv.ctaSub}</p></article>
          <p class="tr-renders">${t.rv.renders}</p>
        </div>
      </div>
    </div>
  </section>
  <section class="tr-join" id="first-access" aria-labelledby="${id}join">
    <div class="tr-rv" data-waitlist-wrap>
      <h2 id="${id}join">${t.joinH}</h2>
      <p>${t.joinP}</p>
      <form class="tr-form tr-form-sizes" data-waitlist data-source="trail" novalidate>
        ${/* 4 Oct 2026 (CRO panel, idea 17): sizes travel with the address as customer tags; 7 Oct 2026: Faheem approved a 24-hour head start for this list (demand strategy); no dates in the promise */''}
        <div class="tr-sizes"><label><span>${t.sizeTee}</span><select name="tee_size"><option value="">${t.sizeAny}</option><option>S</option><option>M</option><option>L</option><option>XL</option></select></label><label><span>${t.sizeShort}</span><select name="short_size"><option value="">${t.sizeAny}</option><option>S</option><option>M</option><option>L</option><option>XL</option></select></label></div>
        <div class="tr-row"><input type="email" name="email" placeholder="${t.ph}" aria-label="Email address" autocomplete="email" required dir="ltr">
        <button type="submit">${t.btn}</button></div>
      </form>
      <p class="tr-fine">${t.fine}</p>
      <p class="tr-ok" role="status">${t.ok}</p>
      <p class="tr-err" role="alert">${t.err}</p>
      <a class="tr-back" href="${t.backHref}">${t.back}</a>${t.hikes ? `<br><a class="tr-back" href="/trail/hikes/" style="margin-top:10px">${t.hikes}</a>` : ''}
    </div>
  </section>
  <div class="tr-hud" aria-hidden="true"><div><small>${t.elev}</small><b id="trElev">190 m</b></div><i><b id="trBar"></b></i></div>
</main>
<script src="/assets/sahra-trail.js" defer></script>`;
  }

  const canonEn = `${SITE}/trail/`, canonAr = `${SITE}/ar/trail/`;
  write('trail/index.html', shell({
    title: T.en.title, desc: T.en.desc, canonical: canonEn, bodyClass: 'trail-page', activeNav: 'trail',
    image: `${SITE}/assets/trail/sahra-trail-og.png`,
    jsonld: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Sahra Trail', description: T.en.desc, url: canonEn,
      isPartOf: { '@type': 'WebSite', name: 'Sahra & Beyond', url: SITE + '/' } },
    bodyHtml: page('en')
  }));
  write('ar/trail/index.html', shell({
    lang: 'ar', noindex: true, altHref: canonEn,
    title: T.ar.title, desc: T.ar.desc, canonical: canonAr, bodyClass: 'trail-page', activeNav: 'trail',
    image: `${SITE}/assets/trail/sahra-trail-og.png`,
    jsonld: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Sahra Trail', inLanguage: 'ar', url: canonAr },
    bodyHtml: page('ar')
  }));
  console.log('  ✓ Sahra Trail: /trail/ + /ar/trail/ (Arabic noindex, awaiting native review)');
})();

/* Sahel · The Coast Edition (6 Oct 2026): the page lives in sahel-page.js */
require('./sahel-page.js')({ shell, write, SITE });

/* Sahra Trail hikes for the QR cards (6 Oct 2026): six routes, an index and the /h/<n>/ short addresses. PERMANENT URLS. */
require('./trail-hikes.js')({ shell, write, SITE, esc, root: __dirname });

/* hreflang from the ENGLISH side. Google needs the pairing declared BOTH ways or
   it ignores it, and the Arabic pages cannot declare it alone. Injected rather
   than threaded through every page builder because two of the three counterparts
   (the homepage, and anything hand-maintained) never pass through shell().
   Runs only while /ar/ is indexable - pointing English pages at a noindexed page
   would be worse than declaring nothing. */
(function applyArabicHreflang() {
  if (AR_NOINDEX) { console.log('  – hreflang from EN skipped (/ar/ is noindex)'); return; }
  const PAIRS = [
    ['index.html',        '/',         '/ar/'],
    ['about/index.html',  '/about/',   '/ar/about/'],
    ['contact/index.html','/contact/', '/ar/contact/']
  ];
  let n = 0;
  for (const [rel, en, ar] of PAIRS) {
    const fp = path.join(__dirname, rel);
    if (!fs.existsSync(fp)) continue;
    let src = fs.readFileSync(fp, 'utf8');
    if (src.indexOf('rel="alternate" hreflang="ar"') !== -1) continue;   /* the footer's العربية link also carries hreflang="ar" (1 Oct 2026) */
    const tags = `<link rel="alternate" hreflang="en" href="${SITE}${en}">\n`
               + `<link rel="alternate" hreflang="ar" href="${SITE}${ar}">\n`
               + `<link rel="alternate" hreflang="x-default" href="${SITE}${en}">\n`;
    if (!/<\/head>/i.test(src)) continue;
    fs.writeFileSync(fp, src.replace(/<\/head>/i, tags + '</head>'));
    n++;
  }
  console.log(`  ✓ hreflang pairs declared from ${n} English page(s)`);
})();

/* ==========================================================================
   AED 50 first-order offer — bar + email-capture modal on every page.
   ==========================================================================
   assets/sahra-welcome.{css,js}. Injected here rather than hand-written into
   ~60 pages, for the same reason as the TikTok pixel above: a hand-maintained
   tag drifts. Idempotent — a page already carrying the tag is left alone.

   Runs AFTER the Arabic and Trail builds (30 Sep 2026: they were written after this step and never got the bar) and BEFORE stampAssets so both files get their ?v= content hash.

   The script inserts its bar ABOVE .sb-topbar and then owns --topbar-h,
   setting it to the SUM of both bars; body.has-topbar nav{top:var(--topbar-h)}
   positions the fixed nav, so a stale value puts the nav over the page.
   ========================================================================== */
(function applyWelcomeOffer() {
  const CSS = '<link rel="stylesheet" href="/assets/sahra-welcome.css">';
  const JS = '<script src="/assets/sahra-welcome.js" data-sbw defer></script>';
  const SKIP = new Set(['coming-soon.html']);
  const pages = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (['node_modules', '.git', '_backup', '.vercel', 'assets', 'admin'].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html') && !SKIP.has(e.name)) pages.push(p);
    }
  })(__dirname);
  let touched = 0, missing = [];
  for (const f of pages) {
    const src = fs.readFileSync(f, 'utf8');
    if (src.indexOf('/assets/sahra-welcome.js') !== -1) continue;
    if (!/<\/head>/i.test(src)) { missing.push(path.relative(__dirname, f)); continue; }
    const out = src.replace(/<\/head>/i, CSS + '\n' + JS + '\n</head>');
    if (out !== src) { fs.writeFileSync(f, out); touched++; }
  }
  console.log(`  ✓ Welcome offer on ${pages.length - missing.length} page(s)` + (touched ? ` (${touched} added)` : '') + (missing.length ? ` - no <head> in: ${missing.join(', ')}` : ''));
})();

(function applyShopMenu() {
  const CSS = '<link rel="stylesheet" href="/assets/sahra-nav.css">';
  const JS = '<script src="/assets/sahra-nav.js" data-sbn defer></script>';
  const SKIP = new Set(['coming-soon.html']);
  const pages = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (['node_modules', '.git', '_backup', '.vercel', 'assets', 'admin'].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html') && !SKIP.has(e.name)) pages.push(p);
    }
  })(__dirname);
  let touched = 0, missing = [];
  for (const f of pages) {
    const src = fs.readFileSync(f, 'utf8');
    if (src.indexOf('/assets/sahra-nav.js') !== -1) continue;
    if (!/<\/head>/i.test(src)) { missing.push(path.relative(__dirname, f)); continue; }
    const out = src.replace(/<\/head>/i, CSS + '\n' + JS + '\n</head>');
    if (out !== src) { fs.writeFileSync(f, out); touched++; }
  }
  console.log(`  ✓ Shop menu on ${pages.length - missing.length} page(s)` + (touched ? ` (${touched} added)` : '') + (missing.length ? ` - no <head> in: ${missing.join(', ')}` : ''));
})();

/* ==========================================================================
   Asset cache-busting — computed, never hand-written.
   ==========================================================================
   The ?v= hashes used to be hardcoded literals in this file and in the
   hand-maintained pages. Change assets/sahra-cart.js and every page kept
   pointing at the old hash, so browsers served the previous file for a day and
   the fix reached nobody. The cart rewrite would have shipped exactly that way.

   This runs LAST and rewrites every /assets/<file>?v=... reference across all
   built HTML to the current content hash. Nothing to remember, nothing to
   forget. prepush.js independently verifies the result.
   ========================================================================== */
(function stampAssets() {
  const crypto = require('crypto');
  const ver = {};
  const adir = path.join(__dirname, 'assets');
  if (!fs.existsSync(adir)) return;
  for (const a of fs.readdirSync(adir)) {
    if (!/\.(css|js)$/.test(a)) continue;
    ver[a] = crypto.createHash('sha1').update(fs.readFileSync(path.join(adir, a))).digest('hex').slice(0, 8);
  }
  const pages = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (['node_modules', '.git', '_backup', '.vercel', 'assets'].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) pages.push(p);
    }
  })(__dirname);

  let touched = 0;
  for (const f of pages) {
    const src = fs.readFileSync(f, 'utf8');
    const out = src.replace(/\/assets\/([A-Za-z0-9._-]+\.(?:css|js))(\?v=[0-9a-f]*)?/g,
      (m, name) => ver[name] ? `/assets/${name}?v=${ver[name]}` : m);
    if (out !== src) { fs.writeFileSync(f, out); touched++; }
  }
  console.log(`  ✓ asset hashes stamped on ${touched} page(s)`);
})();

/* ==========================================================================
   WebP delivery (23 Sep 2026, CRO review)
   ==========================================================================
   Every photo under shirts/, journey/, assets/places, uploads/ and video/ has a
   .webp sibling at about half the bytes (24.3 MB -> 12.2 MB across 204 files).
   This pass points <img>/<source> src and srcset, image preloads, video
   posters and CSS url() at the sibling when it exists on disk. Share images
   (og:image, JSON-LD, feeds) are untouched: some crawlers still want JPEG.
   Runs on every build, so a new JPEG with no .webp simply stays a JPEG. */
(function applyWebp() {
  const pages = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (['node_modules', '.git', '_backup', '.vercel', 'assets', 'admin'].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) pages.push(p);
    }
  })(__dirname);
  const seen = new Map();
  function swap(ref, file) {
    const m = /^([^?#]+\.)(jpe?g|png)([?#].*)?$/i.exec(ref);
    if (!m || /^(https?:|data:|\/\/)/i.test(ref)) return ref;
    let abs;
    try { abs = ref[0] === '/' ? path.join(__dirname, decodeURI(m[1])) : path.join(path.dirname(file), decodeURI(m[1])); } catch (e) { return ref; }
    const w = abs + 'webp';
    if (!seen.has(w)) seen.set(w, fs.existsSync(w));
    return seen.get(w) ? m[1] + 'webp' + (m[3] || '') : ref;
  }
  const swapSet = (v, f) => v.split(',').map(part => part.replace(/^(\s*)(\S+)/, (x, sp, u) => sp + swap(u, f))).join(',');
  let touched = 0, refs = 0;
  for (const f of pages) {
    const src = fs.readFileSync(f, 'utf8');
    let out = src.replace(/<(img|source|video|link)\b[^>]*>/gi, (tag, name) => {
      if (/^link$/i.test(name) && !(/rel=["']?preload/i.test(tag) && /as=["']?image/i.test(tag))) return tag;
      return tag.replace(/\b(src|srcset|href|imagesrcset|poster|data-src|data-zoom)=(["'])([^"']*)\2/gi, (a, attr, q, v) => {
        const nv = /srcset/i.test(attr) ? swapSet(v, f) : swap(v, f);
        if (nv !== v) refs++;
        return attr + '=' + q + nv + q;
      });
    });
    /* site-root paths quoted inside inline scripts (the homepage journey's
       WebGL plates) - otherwise the page preloads the .webp and the script
       then fetches the .jpg as well. JSON-LD blocks are left alone. */
    out = out.replace(/<script\b(?![^>]*ld\+json)[^>]*>[\s\S]*?<\/script>/gi, blk =>
      blk.replace(/(['"])(\/[^'"\s<>]+\.(?:jpe?g|png))\1/gi, (a, q, v) => {
        const nv = swap(v, f); if (nv !== v) refs++;
        return q + nv + q;
      }));
    out = out.replace(/url\((["']?)([^"')]+\.(?:jpe?g|png))\1\)/gi, (a, q, v) => {
      const nv = swap(v, f); if (nv !== v) refs++;
      return 'url(' + q + nv + q + ')';
    });
    if (out !== src) { fs.writeFileSync(f, out); touched++; }
  }
  console.log(`  ✓ WebP: ${refs} image reference(s) on ${touched} page(s)`);
})();

/* ==========================================================================
   Legibility layer — one stylesheet, every page (5 Sep 2026)
   ==========================================================================
   legibility.js holds the site-wide floors for type size, weight and contrast
   (a customer: "too light and small"). It is injected as the LAST <style> in
   every page's <head>, replaced on every build, so there is exactly one place
   to change it. Hand-maintained pages get it too. */
(function applyLegibility() {
  const LEGIB = require('./legibility');
  const block = '<style data-legib>' + LEGIB.CSS + '</style>';
  const RE = /<style data-legib>[\s\S]*?<\/style>/;
  const pages = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (['node_modules', '.git', '_backup', '.vercel', 'assets', 'admin'].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) pages.push(p);
    }
  })(__dirname);
  let touched = 0, missing = [];
  for (const f of pages) {
    const src = fs.readFileSync(f, 'utf8');
    if (!/<\/head>/i.test(src)) { missing.push(path.relative(__dirname, f)); continue; }
    const out = RE.test(src) ? src.replace(RE, block) : src.replace(/<\/head>/i, block + '\n</head>');
    if (out !== src) { fs.writeFileSync(f, out); touched++; }
  }
  console.log(`  ✓ legibility layer on ${pages.length - missing.length} page(s)` + (touched ? ` (${touched} updated)` : '') + (missing.length ? ` - no <head> in: ${missing.join(', ')}` : ''));
})();

/* ---------- head-tag guard (1 Oct 2026, SEO handover item 4) -------------
   Fails the build if any page ships more than one meta description, og:title,
   twitter:title or robots meta - the /shop/ bug that sat live for a week. */
(function () {
  const bad = [];
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    const f = path.join(d, e.name);
    if (e.isDirectory()) { if (!/^(node_modules|\.git|_backup|_drafts|admin|docs)$/.test(e.name)) walk(f); return; }
    if (!/\.html$/.test(e.name)) return;
    const h = fs.readFileSync(f, 'utf8'); const head = h.split(/<\/head>/i)[0];
    const n = re => (head.match(re) || []).length;
    const c = { description: n(/<meta\s+name="description"/gi), 'og:title': n(/<meta\s+property="og:title"/gi), 'twitter:title': n(/<meta\s+name="twitter:title"/gi), robots: n(/<meta\s+name="robots"/gi) };
    Object.keys(c).forEach(k => { if (c[k] > 1) bad.push(path.relative(ROOT, f) + ': ' + c[k] + ' x ' + k); });
  });
  walk(ROOT);
  if (bad.length) { console.error('\n✗ duplicate head tags:\n  ' + bad.join('\n  ')); process.exit(1); }
  console.log('  ✓ head-tag guard: no duplicate description / og:title / twitter:title / robots');
})();
