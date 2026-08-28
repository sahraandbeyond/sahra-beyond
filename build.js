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
['locations', 'about', 'shop', 'places', 'camping', 'secluded-camping', 'snorkeling', 'stargazing', 'camping-near-dubai', 'wadis', 'desert-camping-beginners', 'mountain-escapes', 'hatta-guide', 'best-beaches', 'desert-safari', 'family-friendly-outdoors', 'outdoor-things-to-do'].forEach(d => { try { fs.rmSync(path.join(ROOT, d), { recursive: true, force: true }); } catch (e) {} });

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
const locations = (fs.existsSync(locDir) ? fs.readdirSync(locDir) : []).filter(f => f.endsWith('.json')).map(f => readJSON(path.join(locDir, f))).filter(Boolean);
const settings = readJSON(path.join(ROOT, 'content/settings.json')) || {};
const PRODUCTS_ALL = buildProducts.loadProducts(ROOT);
const PRODUCT_BY_PLACE = {};
PRODUCTS_ALL.forEach(p => { if (p.placeSlug && p.fit === 'regular') PRODUCT_BY_PLACE[p.placeSlug] = p; });
PRODUCTS_ALL.forEach(p => { if (p.placeSlug && !PRODUCT_BY_PLACE[p.placeSlug]) PRODUCT_BY_PLACE[p.placeSlug] = p; });
// one entry per DESIGN for inline modules, so content pages don't show seven near-identical cards
const DESIGNS = PRODUCTS_ALL.filter(p => p.fit !== 'oversized').sort((a,b)=>(a.order||0)-(b.order||0));
const BY_CATEGORY = cat => PRODUCTS_ALL.filter(p => p.category === cat).sort((a,b)=>(a.order||0)-(b.order||0));
// Instagram only — the single official channel
const social = { instagram: (settings.social && settings.social.instagram) || 'https://instagram.com/sahraandbeyond.ae' };
const CAT_HASH = { Camping: 'camping', Wadis: 'wadis', Mountains: 'mountains', Coast: 'coast', Dunes: 'dunes' };
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
function teeBlock(l) {
  const p = l && l.id ? PRODUCT_BY_PLACE[l.id] : null;
  if (!p) return '';
  const href = `/products/${p.id}/`;
  return `<section class="teecta" style="--tee:${p.theme || '#181109'}">
    <div class="teecta-inner">
      <a class="teecta-img" href="${href}" aria-label="${esc(p.name)}"><img src="${esc(p.imgMain)}" alt="${esc(p.altMain || p.name)}" loading="lazy"></a>
      <div class="teecta-txt">
        <span class="teecta-eyebrow">The tee inspired by this place</span>
        <h2>${esc(p.name)}</h2>
        <p>${esc(p.shareDesc || p.lede || '')}</p>
        <div class="teecta-meta"><span>AED ${esc(String(p.price))}</span><span>${p.printChip || ''}</span><span>&#10022; Limited first run</span></div>
        <a class="btn" href="${href}">See the tee &rarr;</a>
        ${p.siblingOf ? `<p class="teecta-alt">Also in <a href="/products/${p.siblingOf}-oversized/">Oversized</a></p>` : ''}
      </div>
    </div>
  </section>`;
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
    <h2>Wear the <em>wild side</em> of the UAE</h2>
    <p>${line}</p>
    ${cta}</section>`;
}
function collectionBlock(ctxName, allFits) {
  if (!PRODUCTS_ALL.length) return shopBlock(null);
  const lead = ctxName
    ? `Heading to ${esc(ctxName)}? Every t-shirt we make is drawn from a real place in the Emirates.`
    : 'Every t-shirt we make is drawn from a real place in the Emirates \u2014 heavyweight organic cotton, limited runs.';
  // Tees only. The polo is a different garment and this block's copy says
  // "every t-shirt we make" — listing it here was simply wrong.
  // allFits: the t-shirts page lists Regular AND Oversized (6 cards). Content
  // pages keep the deduped one-per-design list so they don't repeat themselves.
  const SRC = allFits ? PRODUCTS_ALL : DESIGNS;
  const TEES = SRC.filter(p => p.garment !== 'polo').sort((a,b)=>(a.order||0)-(b.order||0));
  const cards = TEES.map(productCard).join('');
  return `<section class="pcta">
    <div class="pcta-head">
      <span class="pcta-eyebrow">Sahra &amp; Beyond &middot; UAE t-shirts</span>
      <h2>Wear the <em>wild side</em> of the UAE</h2>
      <p>${lead}</p>
    </div>
    <div class="pcards">${cards}</div>
    <a class="btn shoplink" href="${(LAUNCHED||REVEALED)?'/shop/':'/t-shirts/'}">Shop the collection &rarr;</a><a class="btn ghost" href="/t-shirts/">See all t-shirts &rarr;</a>
  </section>`;
}
function teeFor(placeSlug, ctxName) {
  const p = PRODUCT_BY_PLACE[placeSlug];
  return p ? teeBlock({ id: placeSlug }) : collectionBlock(ctxName);
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
    <h2>Wear the <em>wild side</em> of the UAE</h2><p>${esc(blurb)}</p>
    ${shopCta}
    <form class="news-form" action="${esc(MON.newsletterAction)}" method="post">
      <input type="email" name="email_address" placeholder="you@email.com" required aria-label="Email address">
      <button type="submit">${btn}</button>
    </form>
    <p class="news-ok" style="display:none;margin-top:14px;font-family:'Playfair Display',serif;font-style:italic;font-size:18px;color:#F7DFBE">${ok}</p>
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
  Dunes:     'linear-gradient(160deg,#14102A 0%,#3A2A44 42%,#8B4E63 72%,#C0702E 100%)'
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
body{font-family:'Inter',system-ui,sans-serif;color:#2B2620;line-height:1.65;background:#FAF6EF;background-image:radial-gradient(1200px 600px at 50% -10%,rgba(192,112,46,.07),transparent 60%),radial-gradient(900px 500px at 100% 100%,rgba(58,36,28,.05),transparent 60%);background-attachment:scroll}
a{color:#9C521B}
.hdr{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:11px max(16px,calc((100% - 1240px)/2));border-bottom:1px solid rgba(43,37,32,.1);position:sticky;top:0;background:rgba(250,246,239,.9);backdrop-filter:blur(16px);z-index:50}
.brand{display:flex;align-items:center;gap:9px;text-decoration:none}
.brand img{display:block;height:26px;width:auto}
.brand-text{display:flex;flex-direction:column;line-height:1}
.brand-sahra{font-family:'Playfair Display',serif;font-size:15px;font-weight:900;letter-spacing:3px;color:#33271B;text-transform:uppercase}
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
.faq summary::before{content:'+ ';color:#A25A20;font-weight:800}
.faq details[open] summary::before{content:'– '}
.faq details p{margin:9px 0 2px;color:#5C5346;font-size:14px}
.news{position:relative;overflow:hidden;margin:34px 0;padding:44px 26px;border-radius:18px;background:linear-gradient(180deg,#14102A 0%,#39295A 55%,#8B4E63 92%);text-align:center;color:#fff}
.news-stars{position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(1.6px 1.6px at 12% 26%,#fff,transparent),radial-gradient(1.2px 1.2px at 34% 14%,#fff,transparent),radial-gradient(1.5px 1.5px at 56% 30%,#fff,transparent),radial-gradient(1.2px 1.2px at 74% 16%,#FFE9C4,transparent),radial-gradient(1.6px 1.6px at 90% 32%,#fff,transparent),radial-gradient(1px 1px at 44% 52%,#fff,transparent);animation:nStar 4.5s ease-in-out infinite}
@keyframes nStar{0%,100%{opacity:.9}50%{opacity:.35}}
.news-in{position:relative;z-index:1;max-width:520px;margin:0 auto}
.news-eyebrow{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:3.5px;text-transform:uppercase;color:#F7DFBE}
.news h2{font-family:'Playfair Display',serif;font-weight:900;font-size:clamp(24px,4vw,36px);line-height:1.1;color:#fff;margin:10px 0 8px}
.news h2 em{font-style:italic;color:#F7DFBE}
.news p{margin:0 0 18px;color:rgba(255,255,255,.82);font-size:14.5px}
.news-shop{display:inline-block;margin:4px 0 18px}
.news-form{display:flex;gap:8px;max-width:430px;margin:0 auto;flex-wrap:wrap;justify-content:center}
.news-form input{flex:1;min-width:200px;padding:13px 16px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.96);color:#2B2620;font-size:14px}
.news-form input:focus{outline:none;border-color:#F7DFBE}
.news-form button{padding:13px 24px;border-radius:999px;border:none;background:#E9B978;color:#2A2016;font-weight:700;letter-spacing:.4px;cursor:pointer;transition:background .25s}
.news-form button:hover{background:#fff}
.guide-sec{margin:24px 0}
.guide-sec h2{font-size:20px;margin:0 0 8px}
.ig{margin:30px 0}
.ig-hint{font-size:12px;color:#6B6256;margin:-4px 0 10px}
.ig-strip{display:flex;gap:14px;overflow-x:auto;padding:2px 2px 12px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch}
.ig-strip::-webkit-scrollbar{height:6px}
.ig-strip::-webkit-scrollbar-thumb{background:rgba(43,37,32,.2);border-radius:3px}
.ig-strip .ig-item{flex:0 0 auto;scroll-snap-align:start}
.ig-strip .instagram-media{margin:0!important;min-width:326px!important;width:326px!important;max-width:326px!important}
.hdr-nav{display:flex;gap:3px;min-width:0;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.hdr-nav::-webkit-scrollbar{display:none}
.hdr-nav a{flex:0 0 auto;padding:8px 14px;border-radius:999px;font-family:'Inter',sans-serif;font-size:12.5px;font-weight:600;color:#6B6256;text-decoration:none;white-space:nowrap;transition:all .2s}
.hdr-nav a:hover{background:rgba(192,112,46,.1);color:#9C521B}
.hdr-nav a.active{background:#A95A21;color:#fff;box-shadow:0 4px 12px rgba(192,112,46,.3)}
main{max-width:820px;margin:0 auto;padding:clamp(24px,5vw,56px) clamp(16px,5vw,32px)}
.crumbs{font-size:12px;color:#6B6256;margin-bottom:14px}
.crumbs a{color:#6B6256;text-decoration:none}
h1{font-family:'Playfair Display',serif;font-weight:800;font-size:clamp(28px,5vw,44px);color:#33271B;line-height:1.1;margin-bottom:10px}
.lede{font-size:14px;color:#9C521B;font-weight:600;margin-bottom:22px}
h2{font-family:'Playfair Display',serif;font-weight:700;font-size:24px;color:#33271B;margin:30px 0 12px}
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
.btn{display:inline-block;padding:11px 18px;border-radius:12px;background:#A95A21;color:#fff;text-decoration:none;font-weight:700;font-size:14px}
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
.card-body strong{font-family:'Playfair Display',serif;font-size:17px;color:#33271B}
.card-body em{font-style:normal;font-size:11.5px;color:#9C521B;font-weight:600;margin:2px 0 5px}
.card-body span{font-size:13px;color:#6B6256}
.back{margin-top:26px;font-weight:700}
.ftr{max-width:820px;margin:0 auto;padding:30px clamp(16px,5vw,32px) 48px;border-top:1px solid rgba(43,37,32,.1);text-align:center;color:#645B4F;font-size:12.5px}
.ftr .soc a{margin:0 7px;font-weight:700;color:#9C521B;text-decoration:none}
.ftr .links{margin:12px 0}
.ftr .links a{margin:0 8px;color:#6B6256;text-decoration:none;font-size:12px}
.ftr 
/* premium brand layer */
.ftr-tagline{font-family:'Playfair Display',serif;font-style:italic;font-size:17px;color:#9C521B;margin-bottom:14px}
.ftr .legal{margin-top:10px;font-weight:600}
.ftr .legal a{text-decoration:underline;text-underline-offset:3px}
.loc-hero::before{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.14) 46%,transparent 62%);background-size:240% 100%;animation:heroSweep 9s ease-in-out infinite;pointer-events:none}
@keyframes heroSweep{0%,100%{background-position:110% 0}50%{background-position:-10% 0}}
.loc-hero h1::after{content:"";display:block;width:52px;height:3px;margin-top:12px;background:linear-gradient(90deg,#E9B978,rgba(233,185,120,0))}
.hdr-nav a.shopnav{color:#9C521B;font-weight:700}
/* shop CTA band — living night sky */
/* --- the tee inspired by this place (product cross-link) --- */
.teecta{position:relative;overflow:hidden;margin:34px 0;border-radius:18px;background:var(--tee,#181109);color:#fff;box-shadow:0 24px 60px rgba(0,0,0,.18)}
.teecta-inner{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:0;align-items:stretch}
.teecta-img{display:block;position:relative;overflow:hidden;min-height:100%}
.teecta-img img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .7s ease}
.teecta-img:hover img{transform:scale(1.06)}
.teecta-txt{padding:34px 32px;display:flex;flex-direction:column;justify-content:center;background:rgba(0,0,0,.28);backdrop-filter:blur(2px)}
.teecta-eyebrow{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:3.5px;text-transform:uppercase;color:#F7DFBE;margin-bottom:10px}
.teecta h2{font-family:'Playfair Display',serif;font-size:clamp(24px,3.4vw,34px);font-weight:800;line-height:1.08;color:#fff;margin:0 0 10px}
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
  .logo .mark,.brand img{height:18px}
  .logo,.brand{min-width:0;flex:0 1 auto;overflow:hidden}
  nav,.hdr{padding-left:16px;padding-right:16px;gap:10px}
  .mnav{flex:0 0 auto}

}
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
.pcard-t{font-family:'Playfair Display',serif;font-size:18px;line-height:1.25;color:#2B2620;text-decoration:none}
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
.shopcta h2{position:relative;font-family:'Playfair Display',serif;font-weight:900;font-size:clamp(24px,4.4vw,36px);color:#fff;margin:0 0 8px;line-height:1.12}
.shopcta h2 em{font-style:italic;color:#F7DFBE}
.shopcta p{position:relative;color:rgba(255,255,255,.85);font-size:14.5px;max-width:460px;margin:0 auto 18px}
.shopcta .btn{position:relative;background:#fff;color:#2A2016;border-radius:999px;padding:12px 26px}
.shopcta .btn:hover{background:#E9B978}
@media(prefers-reduced-motion:reduce){.loc-hero::before,.shopcta .stars,.shopcta .stars2,.shopcta .shoot{animation:none}}
`;

// injected: product-card CSS for the collection module
function footerHtml() {
  const soc = ['instagram', 'tiktok', 'youtube'].filter(k => social[k]).map(k => `<a href="${esc(social[k])}" target="_blank" rel="noopener">${k[0].toUpperCase() + k.slice(1)}</a>`).join('');
  return `<div class="ftr-tagline">${esc(TAGLINE)}</div>
  <div class="soc">${soc}</div>
  <div class="links"><a href="https://checkout.sahraandbeyond.ae/account" rel="nofollow">Orders</a><a href="/camping/">Camping in UAE</a> · <a href="/camping-near-dubai/">Camping near Dubai</a> · <a href="/desert-camping-beginners/">Camping for beginners</a> · <a href="/secluded-camping/">Secluded camping</a> · <a href="/wadis/">Best wadis</a> · <a href="/snorkeling/">Snorkeling</a> · <a href="/mountain-escapes/">Mountain escapes</a> · <a href="/hatta-guide/">Hatta guide</a> · <a href="/best-beaches/">Best beaches</a> · <a href="/desert-safari/">Desert safari</a> · <a href="/family-friendly-outdoors/">Family-friendly</a> · <a href="/outdoor-things-to-do/">Things to do</a> · <a href="/stargazing/">Milky Way / stargazing</a> · <a href="/fabric/">Fabric &amp; construction</a> · <a href="/gifts/">Gift ideas</a> · <a href="/about/">About us</a> · <a href="/">Map &amp; planner</a></div>
  <div class="links legal"><a href="/policies.html#shipping">Shipping</a> · <a href="/policies.html#returns">Returns &amp; refunds</a> · <a href="/policies.html#terms">Terms of sale</a> · <a href="/policies.html#privacy">Privacy</a> · <a href="/policies.html#contact">Contact</a> &middot; <a href="https://wa.me/971585449946" target="_blank" rel="noopener">WhatsApp us</a></div>
  <div>© ${new Date().getFullYear()} Sahra &amp; Beyond · UAE Desert &amp; Outdoor Planner · ${LAUNCHED ? '<a href="/shop/" style="color:#9C521B;font-weight:600;text-decoration:none">Shop the tees</a>' : '<a href="/#join" style="color:#9C521B;font-weight:600;text-decoration:none">Join the waitlist</a>'}</div>`;
}

// Which top-nav item should read as current, derived from the page slug.
// Previously every category page claimed 'tshirts' (so /polos/ highlighted T-Shirts)
// and the commerce pages passed nothing (so they fell back to Home).
function navKeyFor(slug) {
  const s = String(slug || '').replace(/\/index\.html$/, '').replace(/^\/|\/$/g, '');
  if (s === 'polos') return 'polos';
  if (s === 't-shirts' || s.startsWith('t-shirts/')) return 'tshirts';
  if (s === 'places' || s.startsWith('locations/')) return 'places';
  if (s === 'about') return 'about';
  if (s === 'shop') return 'shop';
  return 'none';   // guides, gifts, fabric, size guide: nothing highlighted
}
function shell({ title, desc, canonical, jsonld, bodyHtml, image, activeNav = 'none' }) {
  // SERPs truncate around 60 chars; the brand suffix is the first thing to go.
  if (title.length > 60 && / \| Sahra & Beyond$/.test(title)) title = title.replace(/ \| Sahra & Beyond$/, '');

  const ogImg = image || `${SITE}/icon-512.png`;
  const nav = (href, label, key) => `<a href="${href}"${activeNav === key ? ' class="active"' : ''}>${label}</a>`;
  const navHtml = nav('/', 'Home', 'home') + ((LAUNCHED || REVEALED) ? nav('/shop/', 'Shop', 'shop') : '') + nav('/places/', 'Places', 'places') + nav('/t-shirts/', 'T-Shirts', 'tshirts') + nav('/polos/', 'Polo', 'polos') + nav('/about/', 'About', 'about');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="theme-color" content="#C0702E">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImg)}">
<meta property="og:site_name" content="Sahra & Beyond">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(ogImg)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Inter:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
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
<script src="/assets/meta-pixel.js"></script>
<noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=1392180882887027&ev=PageView&noscript=1"></noscript>
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>${CSS}
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
  /* comfortable, thumb-sized targets */
  .foot-links a,.links a,.foot-soc a,.soc a,.crumbs a,.back a,.catnav a,
  .eyebrow.plink,.pm-gps,.read-place,.fitswap,.size-guide-link,.tag-invite a{
    display:inline-flex;align-items:center;min-height:44px;padding-top:2px;padding-bottom:2px}
  .foot-links a,.links a{width:100%}
  button.filt,.filt,.nav-arrow,.pcard-zoom,.pcard-t,.pcard-cta,.filt-clear,.filt-linkish,.chip,.btn,button.cta,.cta,
  .pdp-link,.buy-ghaf,.lb-close,.drawer-close,.mnav,.logo,.skip-link{
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
</head>
<body>
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
<!-- one cart and one sky for the whole site, so pages cannot drift apart -->
<script src="/assets/sahra-sky.js" defer></script>
<script src="/assets/sahra-cart.js" defer></script>
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
  const thumb = l.cover
    ? `<span class="card-thumb" style="background-image:url('${esc(l.cover)}')" role="img" aria-label="${esc(l.name)}"></span>`
    : `<span class="card-emoji">${l.emoji || '📍'}</span>`;
  return `<a class="card" href="/locations/${l.id}/">${thumb}<span class="card-body"><strong>${esc(l.name)}</strong><em>${esc(l.emirate)} · ${esc(l.category)}</em><span>${esc(l.desc)}</span></span></a>`;
}

// ---- per-location pages ----
locations.forEach(l => {
  const canonical = `${SITE}/locations/${l.id}/`;
  /* Per-location SEO override. The generic "<name>: <category> in <emirate>"
     pattern is fine for most places, but it loses to search intent where the
     query is not about the category: "al quaa" is 42% of all site impressions
     and converts at 0.28% because searchers want the dark sky, not a camping
     listing. seoTitle/seoDesc in the location JSON win when present. */
  const title = l.seoTitle || `${l.name}: ${l.category} in ${l.emirate}, UAE | Sahra & Beyond`;
  const desc = l.seoDesc || metaDesc(l.desc);
  const related = locations.filter(x => x.category === l.category && x.id !== l.id).slice(0, 4);
  const hash = CAT_HASH[l.category] || '';
  // Photos: cover + gallery. Absolute URLs for OG/schema; used for the on-page gallery too.
  const abs = p => (!p ? '' : (String(p).charAt(0) === '/' ? SITE + p : p));
  const galleryRaw = Array.isArray(l.gallery) ? l.gallery.map(g => (g && g.image) || g).filter(Boolean) : [];
  const photos = [l.cover].concat(galleryRaw).filter(Boolean);
  const ogImage = photos.length ? abs(photos[0]) : '';
  const tourist = {
    "@context": "https://schema.org", "@type": "TouristAttraction",
    "name": l.name, "description": l.desc, "url": canonical,
    "address": { "@type": "PostalAddress", "addressRegion": l.emirate, "addressCountry": "AE" },
    "geo": { "@type": "GeoCoordinates", "latitude": l.lat, "longitude": l.lng },
    "isAccessibleForFree": true, "touristType": "UAE residents, outdoor & adventure"
  };
  if (photos.length) tourist.image = photos.map(abs);
  const faqs = faqsFor(l);
  const jsonld = [
    tourist,
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/" },
        { "@type": "ListItem", "position": 2, "name": l.name, "item": canonical }
      ]
    },
    {
      "@context": "https://schema.org", "@type": "FAQPage",
      "mainEntity": faqs.map(q => ({ "@type": "Question", "name": q[0], "acceptedAnswer": { "@type": "Answer", "text": q[1] } }))
    }
  ];
  const packItems = packItemsFor(l);
  // On-page photo gallery (everything after the cover photo).
  const galleryHtml = galleryRaw.length
    ? `<section class="gallery" aria-label="Photos of ${esc(l.name)}"><h2>Photos</h2>
       <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">
       ${galleryRaw.map((g, i) => `<img src="${esc(g)}" alt="${esc(l.name)} — ${esc(l.category)} in ${esc(l.emirate)}, photo ${i + 2}" loading="lazy" style="width:100%;height:140px;object-fit:cover;border-radius:11px;display:block">`).join('')}
       </div></section>`
    : '';
  const body = `
  <section class="loc-hero" style="--hero-grad:${CAT_BG[l.category] || CAT_BG.Dunes}">
    <div class="glow"></div><svg class="dune-far" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true"><path fill="#8B4E63" d="M0,220 C300,150 560,250 820,200 C1080,150 1300,220 1440,190 L1440,320 L0,320 Z"/></svg><svg class="dune-near" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true"><path fill="#3A241C" d="M0,270 C320,210 620,290 940,250 C1180,220 1330,270 1440,255 L1440,320 L0,320 Z"/></svg><div class="grain"></div><div class="loc-hero-inner">
      <nav class="crumbs"><a href="/">Home</a> &rsaquo; ${esc(l.category)} &rsaquo; <span>${esc(l.name)}</span></nav>
      <div class="loc-emoji">${l.emoji || '📍'}</div>
      <h1>${esc(l.name)}</h1>
      <p class="lede">${esc(l.emirate)} · ${esc(l.category)} · ${esc(l.difficulty)} · Best ${esc(l.season)}</p>
      <div class="wx" id="wx" data-lat="${l.lat}" data-lng="${l.lng}">Loading live weather…</div>
      <button type="button" id="share-btn" style="margin-top:12px;display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.5);color:#fff;font-family:'Inter',sans-serif;font-size:13px;font-weight:700;padding:9px 16px;border-radius:999px;cursor:pointer;backdrop-filter:blur(6px)">↗ Share this spot</button>
    </div>
  </section>
  <main>
    ${l.cover ? `<img class="hero-img" src="${esc(l.cover)}" alt="${esc(l.name)}, ${esc(l.category)} in ${esc(l.emirate)}" style="object-position:${esc(l.coverFocus || '50% 50%')}">` : ''}
    ${galleryHtml}
    <div class="content">${withProductLink(paras(l.body || l.desc), l.productLink)}</div>
    ${Array.isArray(l.sections) ? l.sections.map(x => `<section class="guide-sec"><h2>${esc(x.h2)}</h2><div class="content">${paras(x.body)}</div></section>`).join('') : ''}
    <aside class="facts">
      <h2>Quick facts</h2>
      <ul>
        <li><strong>Emirate:</strong> ${esc(l.emirate)}</li>
        <li><strong>Best for:</strong> ${esc(l.category)}</li>
        <li><strong>Difficulty:</strong> ${esc(l.difficulty)}</li>
        <li><strong>Best season:</strong> ${esc(l.season)}</li>
        <li><strong>Distance:</strong> ${esc(l.distance)}</li>
        <li><strong>GPS:</strong> ${l.lat}, ${l.lng}</li>
      </ul>
      <div class="cta">
        <a class="btn" href="https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}" target="_blank" rel="noopener">Google Maps</a>
        <a class="btn alt" href="https://maps.apple.com/?ll=${l.lat},${l.lng}&q=${encodeURIComponent(l.name)}" target="_blank" rel="noopener">Apple Maps</a>
      </div>
    </aside>
    ${toursBlock(l)}
    ${stayBlock(l)}
    ${teeBlock(l) || collectionBlock(l && l.name)}
    ${igSection(l.igPosts)}
    <section class="pack">
      <h2>What to pack for ${esc(l.name)}</h2>
      <div class="pack-controls">
        <div class="grp" role="group" aria-label="Group size">
          <button class="pack-btn" type="button" data-grp="1">Solo</button>
          <button class="pack-btn on" type="button" data-grp="4">2&ndash;4</button>
          <button class="pack-btn" type="button" data-grp="8">5&ndash;10</button>
          <button class="pack-btn" type="button" data-grp="12">10+</button>
        </div>
        <div class="grp" role="group" aria-label="Trip type">
          <button class="pack-btn on" type="button" data-ov="0">Day trip</button>
          <button class="pack-btn" type="button" data-ov="1">Overnight</button>
        </div>
      </div>
      <div id="pack-list"></div>
    </section>
    ${faqBlock(l)}
    ${newsletterBlock()}
    ${related.length ? `<section class="related"><h2>More ${esc(l.category)} spots in the UAE</h2><div class="cards">${related.map(locCard).join('')}</div></section>` : ''}
    <p class="back" style="margin-top:26px"><a href="/">&larr; Back to Sahra &amp; Beyond</a></p>
  </main>
  <script>
  (function(){
    var wx=document.getElementById('wx');
    if(wx){var lat=wx.getAttribute('data-lat'),lng=wx.getAttribute('data-lng'),k=${JSON.stringify(WEATHER_KEY)};
      if(lat&&lng&&k){fetch('https://api.openweathermap.org/data/2.5/weather?lat='+lat+'&lon='+lng+'&appid='+k+'&units=metric').then(function(r){return r.json();}).then(function(d){if(d&&d.main){var c=(d.weather&&d.weather[0]&&d.weather[0].icon||'').slice(0,2);var ic={'01':'☀️','02':'🌤','03':'⛅','04':'☁️','09':'🌧','10':'🌦','11':'⛈','13':'❄️','50':'🌫'}[c]||'🌡';wx.innerHTML='<span class="wx-ic">'+ic+'</span><span class="wx-temp">'+Math.round(d.main.temp)+'°C</span><span class="wx-desc">'+(d.weather&&d.weather[0]?d.weather[0].description:'')+'</span>';}else{wx.style.display='none';}}).catch(function(){wx.style.display='none';});}else{wx.style.display='none';}}
    var PACK=${JSON.stringify(packItems)},state={p:4,ov:false};
    function qy(t){if(!t)return '';return String(t).replace(/\\{water\\}/g,4*state.p).replace(/\\{half\\}/g,Math.max(1,Math.ceil(state.p/2))).replace(/\\{p\\}/g,state.p);}
    function he(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
    function render(){var el=document.getElementById('pack-list');if(!el)return;var items=PACK.filter(function(it){return !it.overnight||state.ov;});var groups=[],idx={};items.forEach(function(it){if(!(it.group in idx)){idx[it.group]=groups.length;groups.push({h:it.group,items:[]});}groups[idx[it.group]].items.push(it);});el.innerHTML=groups.map(function(g){return '<div class="pack-grp-title">'+he(g.h)+'</div>'+g.items.map(function(it){var q=qy(it.qty);return '<div class="pack-row"><div class="pk-main"><div class="pk-name">'+he(it.name)+'</div>'+(it.note?'<div class="pk-note">'+he(it.note)+'</div>':'')+'</div>'+(q?'<span class="pk-qty">'+he(q)+'</span>':'')+'</div>';}).join('');}).join('');}
    document.querySelectorAll('[data-grp]').forEach(function(b){b.addEventListener('click',function(){state.p=parseInt(b.getAttribute('data-grp'),10);document.querySelectorAll('[data-grp]').forEach(function(x){x.classList.toggle('on',x===b);});render();});});
    document.querySelectorAll('[data-ov]').forEach(function(b){b.addEventListener('click',function(){state.ov=b.getAttribute('data-ov')==='1';document.querySelectorAll('[data-ov]').forEach(function(x){x.classList.toggle('on',x===b);});render();});});
    render();
    // Share button: native share sheet where supported (WhatsApp etc.), else copy the link.
    var sb=document.getElementById('share-btn');
    if(sb){sb.addEventListener('click',function(){
      var data={title:${JSON.stringify(l.name + ' — Sahra & Beyond')},text:${JSON.stringify(l.desc || '')},url:location.href};
      if(window.gtag){gtag('event','share',{method:navigator.share?'native':'copy',location:${JSON.stringify(l.name)}});}
      if(navigator.share){navigator.share(data).catch(function(){});}
      else if(navigator.clipboard){navigator.clipboard.writeText(location.href).then(function(){var t=sb.textContent;sb.textContent='✓ Link copied';setTimeout(function(){sb.textContent=t;},1800);});}
    });}
  })();
  </script>`;
  write(`locations/${l.id}/index.html`, shell({ activeNav: 'places', title, desc, canonical, jsonld, bodyHtml: body, image: ogImage }));
});

// ---- keyword landing pages ----
const LANDINGS = [
  {
    slug: 'camping', h1: 'Best Camping Spots in the UAE',
    title: 'Best Camping Spots in the UAE — Top Places to Camp | Sahra & Beyond',
    desc: 'Discover the best camping spots in the UAE — from quiet desert lakes to mountain wadis — with GPS, seasons and tips for UAE residents.',
    pick: locations.filter(l => l.category === 'Camping'),
    intro: "Looking for the best camping spots in the UAE? From hidden desert lakes to cool mountain wadis, the Emirates offer far more than the obvious weekend sites. This guide rounds up the spots we love most — chosen for their scenery, seclusion and how easy they are to reach from Dubai, Sharjah and Abu Dhabi.\n\nEvery location below has accurate GPS coordinates, the best season to go, and a difficulty rating, so you can plan a safe overnight. Most are free, wild camping sites with no facilities — so come self-sufficient with water, shade and a pack-it-out mindset."
  },
  {
    slug: 'secluded-camping', h1: 'Secluded Camping Spots in the UAE',
    title: 'Secluded Camping Spots in the UAE — Quiet, Hidden Places | Sahra & Beyond',
    desc: 'The most secluded camping spots in the UAE — quiet desert lakes and hidden corners away from the crowds, with GPS and access tips.',
    pick: locations.filter(l => l.category === 'Camping').sort((a, b) => (/(secret|hidden|secluded|quiet|dark)/i.test(b.body || '') ? 1 : 0) - (/(secret|hidden|secluded|quiet|dark)/i.test(a.body || '') ? 1 : 0)),
    intro: "If the popular Al Qudra sites feel too busy, these secluded camping spots in the UAE trade facilities for peace and privacy. They're the quiet desert lakes and hidden corners where you can pitch a tent, watch the sunset over the water and have the stars almost entirely to yourself.\n\nSeclusion comes with responsibility: there are no toilets, bins or shops out here, so plan carefully, carry plenty of water, travel in convoy where the sand gets soft, and leave no trace so these places stay special."
  },
  {
    slug: 'snorkeling', h1: 'Best Snorkeling in the UAE',
    title: 'Best Snorkeling in the UAE — Top Reefs & Marine Life | Sahra & Beyond',
    desc: 'The best snorkeling in the UAE — coral reefs, turtles and reef sharks you can reach from shore, with seasons and tips for UAE residents.',
    pick: locations.filter(l => l.category === 'Coast'),
    intro: "The UAE's east coast hides some genuinely world-class snorkeling, and the best of it is reachable straight from the beach. Clear Gulf of Oman water, healthy coral and regular sightings of turtles and reef sharks make it a brilliant day out for families and beginners alike.\n\nBelow are our favourite spots for the best snorkeling in the UAE, with the right season, difficulty and access notes. Go early on weekdays for calm, clear water, bring your own mask and fins, and always wear reef-safe sunscreen to protect the coral."
  },
  {
    slug: 'stargazing', h1: 'Best Places to See the Milky Way Galaxy in the UAE',
    productLink: { slug: 'al-quaa-galaxy-regular', anchor: 'the Al Quaa Galaxy tee',
      sentence: 'That view is the one printed on {{link}} — the core as it rises over Al Quaa, mapped rather than illustrated.' },
    title: 'Best Place to View the Milky Way Galaxy in the UAE | Sahra & Beyond',
    desc: 'The Milky Way core is visible over Al Quaa from May to October, not in winter. Moon phases, the drive from Dubai, and what you can see with no telescope.',
    pick: ['al-quaa-desert', 'crescent-moon-lake', 'desert-camping-lake-view', 'mleiha-desert'].map(id => locations.find(l => l.id === id)).filter(Boolean),
    intro: "Want to know the best place to view the Milky Way galaxy in the UAE? It comes down to one thing: darkness. Escape the city glow and the desert delivers some of the clearest night skies in the region, where the Milky Way's core is bright enough to photograph — and on the darkest nights, to cast a faint shadow.\n\nThese are the spots we recommend for stargazing and astrophotography, ranked by how dark and accessible they are. Timing matters more than kit. The Milky Way's bright core is only above the horizon from roughly May to October — in midwinter it is below the horizon at night, so a December trip gives you a beautifully dark sky with no core in it. Winter nights are clearer, cooler and better for constellations; May to October is the window for the galaxy itself. Either way, go on a moonless night, bring a red-light torch, and give your eyes twenty minutes to adjust."
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
      { h2: 'Rules and etiquette', body: "Camping in the desert is a privilege, not a right. Pack out everything you bring in, keep fires small and contained, give wildlife and other campers space, and avoid driving over vegetation. Leaving these places exactly as you found them is what keeps them open and beautiful for the next group." }
    ],
    faqs: [
      ['Where can I camp near Dubai for free?', 'Several desert sites near Dubai — including the lakes and dune areas in this guide — are free, wild camping spots with no booking required. They have no facilities, so you must be fully self-sufficient and pack out all your rubbish.'],
      ['Is it safe to camp in the desert near Dubai?', 'Yes, with preparation. Tell someone your plans, carry plenty of water, avoid driving into soft sand alone, bring a first-aid kit and check the weather. The cooler months (October to April) are far safer and more comfortable than the summer heat.'],
      ['When is the best time to camp near Dubai?', 'October to April. Daytime temperatures are pleasant and nights are cool, sometimes cold, so bring warm layers. Summer desert camping is not recommended due to extreme heat.'],
      ['Do I need a permit to camp in the desert?', 'Most wild desert sites near Dubai do not require a permit, but rules vary by emirate and some protected or private areas do. Always respect signage and local regulations, and never camp in clearly restricted zones.']
    ]
  },
  {
    slug: 'wadis', h1: 'Best Wadis in the UAE for Hiking & Swimming',
    title: 'Best Wadis in the UAE — Hiking & Natural Pools | Sahra & Beyond',
    desc: 'The best wadis in the UAE for hiking and swimming in natural pools, with GPS, the best season, difficulty and essential flash-flood safety tips.',
    pick: locations.filter(l => l.category === 'Wadis'),
    intro: "A wadi is a valley or dry riverbed cut through the mountains — and after the rains, many fill with cool, clear natural pools that are perfect for a swim. The UAE's wadis are some of the most rewarding outdoor escapes in the region: shaded canyons, turquoise pools and scrambly hikes, all within a couple of hours of the cities.\n\nBelow are our favourite wadis in the UAE, with access notes, the best season and difficulty. Wadis are beautiful but demand respect — read the safety section before you go.",
    sections: [
      { h2: 'What makes a good wadi trip', body: "The best wadi days combine an easy-to-moderate hike with a reward at the end: a swimmable pool, a waterfall, or a viewpoint. Wear shoes you can get wet, bring a dry bag for your phone, and start early to beat both the heat and the crowds. Many wadis involve some boulder-hopping or wading, so a reasonable level of fitness helps." },
      { h2: 'Flash-flood safety — read this first', body: "Wadis can flood fast and without warning, even when it isn't raining where you are — rain in the mountains upstream can send a wall of water down a dry valley. Never enter a wadi if rain is forecast anywhere in the catchment, check the weather before you go, keep an eye on the sky, and know your exit route to higher ground. If water starts rising or turning muddy, get out immediately." },
      { h2: 'What to bring', body: "Plenty of water, sun protection, sturdy wet-grip footwear, a dry bag, a small first-aid kit and snacks. A change of clothes for the drive home is welcome after a swim. Each wadi's page has a tailored packing list. Carry out every scrap of rubbish — wadi pools are fragile ecosystems." },
      { h2: 'Best season for wadis', body: "The cooler months (roughly October to April) are ideal — comfortable hiking temperatures and pools topped up by winter rain. Avoid wadis during and immediately after heavy rain because of flash-flood risk, and avoid the peak summer months when the heat makes the approach hikes dangerous." }
    ],
    faqs: [
      ['Can you swim in the wadis in the UAE?', 'Yes — many UAE wadis have natural pools you can swim in, especially after the winter rains. Always check water depth and conditions, never dive into unknown pools, and avoid wadis when rain is forecast due to flash-flood risk.'],
      ['Are the wadis safe?', 'They are safe with preparation, but flash floods are a real danger. Never enter a wadi if rain is forecast anywhere upstream, check the weather, and have an escape route to higher ground. Wear grippy footwear and do not go alone.'],
      ['When is the best time to visit a wadi?', 'October to April offers comfortable temperatures and fuller pools. Avoid the summer heat and steer clear during or right after heavy rain.'],
      ['Do I need a 4x4 to reach the wadis?', 'It depends on the wadi. Some have paved access and car parks; others need a 4x4 for the final stretch. Check the access notes on each location page before you set off.']
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
    slug: 'mountain-escapes', h1: 'Best Mountain Escapes in the UAE',
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
    slug: 'hatta-guide', h1: 'Hatta: A Complete Guide to the Mountain Escape',
    title: 'Hatta Guide — Dam, Kayaking, Hiking & Things to Do | Sahra & Beyond',
    desc: 'A complete guide to Hatta — the Hatta Dam, kayaking, mountain biking, hiking and the best time to visit this mountain escape near Dubai.',
    pick: ['hatta'].map(id => locations.find(l => l.id === id)).filter(Boolean),
    intro: "Tucked into the Hajar mountains as a mountain exclave of Dubai, Hatta is the emirate's favourite high-altitude escape — cooler air, turquoise dam water and a whole hub of outdoor activities, all around a 90-minute drive from the city. It's the easiest way to swap skyscrapers for switchback roads and mountain views without leaving the emirate.\n\nThis guide covers what to do in Hatta, how to get there, the best time to go and what to bring, so you can plan a great day trip or weekend.",
    sections: [
      { h2: 'Things to do in Hatta', body: "Hatta packs a lot in. The headline is the Hatta Dam, where you can hire kayaks and pedal boats on the famously blue water. Nearby, the activity hub offers mountain biking trails, a zipline, archery and more. Add scenic hiking and mountain-bike trails of varying difficulty, the heritage village, and some of the best stargazing and drone scenery in the emirate, and there's easily a full day — or a weekend — here." },
      { h2: 'The Hatta Dam and kayaking', body: "The dam is the postcard shot: vivid blue-green water hemmed in by rocky peaks. Kayaks and pedal boats are available to rent on site, and a slow paddle into the quieter arms of the reservoir is the best way to take it in. Go early in the day for calm water, cooler temperatures and smaller crowds, especially on weekends." },
      { h2: 'Getting there and the best time to go', body: "Hatta sits about 90 minutes to two hours from central Dubai by car along a good, scenic road. The drive passes briefly through territory near the Oman border but the main route stays within the UAE — carry your ID just in case. The cooler months from October to April are by far the best time; summer is hot, though the altitude keeps it a touch cooler than the city." },
      { h2: 'What to bring', body: "Comfortable shoes for walking and trails, sun protection, plenty of water, a hat and a light layer for breezy viewpoints. Bring cash or card for activity rentals, a power bank, and a camera or drone if you have one — the scenery rewards it. If you plan to hike, treat it like any mountain outing: more water than you think, snacks and a charged phone with offline maps." }
    ],
    faqs: [
      ['Is Hatta worth visiting?', 'Yes — Hatta offers mountain scenery, the turquoise Hatta Dam, kayaking, mountain biking and hiking, all within about a 90-minute drive of Dubai. It is one of the best outdoor day trips in the emirate.'],
      ['Can you kayak at Hatta Dam?', 'Yes. Kayaks and pedal boats are available to rent at the Hatta Dam. Go early in the day for calmer water and fewer crowds, especially on weekends.'],
      ['How far is Hatta from Dubai?', 'Hatta is roughly a 90-minute to two-hour drive from central Dubai along a scenic mountain road. Carry your ID, as the route passes close to the Oman border.'],
      ['When is the best time to visit Hatta?', 'October to April, when the weather is cool and comfortable for outdoor activities. The mountain altitude keeps it slightly cooler than the city year-round.']
    ]
  },
  {
    slug: 'best-beaches', h1: 'Best Beaches in the UAE for a Day Out',
    title: 'Best Beaches in the UAE — Swimming, Snorkeling & Calm Water | Sahra & Beyond',
    desc: 'The best beaches in the UAE for swimming, snorkeling and a relaxed day by the sea, with the best season, access notes and tips for residents.',
    pick: locations.filter(l => l.category === 'Coast'),
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
    title: 'Desert Safari & Best Dune Spots in the UAE | Sahra & Beyond',
    desc: 'Where to find the best dunes in the UAE for a desert safari, dune drives, sandboarding and overnight desert camps, with seasons and safety tips.',
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
    pick: ['big-red', 'wadi-shab', 'jebel-hafeet', 'snoopy-island', 'crescent-moon-lake'].map(id => locations.find(l => l.id === id)).filter(Boolean),
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
  }
];

const GUIDE_TEE = {
  stargazing: 'al-quaa-desert', camping: 'al-quaa-desert', 'camping-near-dubai': 'al-quaa-desert',
  'secluded-camping': 'al-quaa-desert', 'desert-camping-beginners': 'liwa', 'desert-safari': 'liwa',
  wadis: 'wadi-naqab', 'mountain-escapes': 'wadi-naqab', 'hatta-guide': 'wadi-naqab'
};
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
    ? L.sections.map(s => `<section class="guide-sec"><h2>${esc(s.h2)}</h2><div class="content">${paras(s.body)}</div></section>`).join('')
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
    'family-friendly-outdoors':{c:'Camping',e:'🌅'}, 'outdoor-things-to-do':{c:'Dunes',e:'🧭'}
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
    <div class="content">${withProductLink(paras(L.intro), L.productLink)}</div>
    ${L.pick.length ? `<h2>Our top picks</h2><div class="cards">${L.pick.map(locCard).join('')}</div>` : ''}
    ${sectionsHtml}
    ${faqHtml}
    ${GUIDE_TEE[L.slug] ? teeFor(GUIDE_TEE[L.slug], L.h1) : collectionBlock(null)}
    ${newsletterBlock()}
    <p class="back"><a href="/">Back to Sahra &amp; Beyond &rarr;</a></p>
  </main>`;
  write(`${L.slug}/index.html`, shell({ title: L.title, desc: L.desc, canonical, jsonld, bodyHtml: body }));
});

// ---- About page ----
(function () {
  const canonical = `${SITE}/about/`;
  const title = 'About Sahra & Beyond — Discover the Wild Side of the UAE';
  const desc = 'The story behind Sahra & Beyond — a UAE outdoor guide inspired by the landscapes of the Emirates, built to help you find the wild side of the country.';
  const sameAs = [social.instagram, social.tiktok, social.youtube].filter(Boolean);
  const jsonld = [
    { "@context": "https://schema.org", "@type": "AboutPage", "name": title, "description": desc, "url": canonical },
    { "@context": "https://schema.org", "@type": "Organization", "name": "Sahra & Beyond", "url": SITE + "/", "logo": SITE + "/icon-512.png", "slogan": TAGLINE, "sameAs": sameAs },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/" },
      { "@type": "ListItem", "position": 2, "name": "About", "item": canonical }
    ] }
  ];
  const body = `
  <section class="loc-hero" style="--hero-grad:linear-gradient(160deg,#14102A 0%,#39295A 40%,#7A4F63 72%,#C0702E 100%)">
    <div class="stars" style="position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(1.6px 1.6px at 14% 24%,#fff,transparent),radial-gradient(1.2px 1.2px at 36% 12%,#fff,transparent),radial-gradient(1.6px 1.6px at 58% 30%,#fff,transparent),radial-gradient(1.2px 1.2px at 76% 16%,#FFE9C4,transparent),radial-gradient(1.6px 1.6px at 90% 34%,#fff,transparent);animation:ctaTwinkle 4.5s ease-in-out infinite"></div>
    <div class="glow"></div><svg class="dune-far" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true"><path fill="#8B4E63" d="M0,220 C300,150 560,250 820,200 C1080,150 1300,220 1440,190 L1440,320 L0,320 Z"/></svg><svg class="dune-near" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true"><path fill="#3A241C" d="M0,270 C320,210 620,290 940,250 C1180,220 1330,270 1440,255 L1440,320 L0,320 Z"/></svg><div class="grain"></div><div class="loc-hero-inner">
      <nav class="crumbs"><a href="/">Home</a> &rsaquo; <span>About</span></nav>
      <div class="loc-emoji">🌌</div>
      <h1>Discover the wild side of the UAE</h1>
      <p class="lede">Inspired by the unique landscapes of the Emirates &mdash; and worn on our backs: <em style="font-family:'Playfair Display',serif">${esc(TAGLINE)}</em></p>
    </div>
  </section>
  <main>
    <div class="content">
      <p>Sahra &amp; Beyond was born out of a love for the wild, quiet corners of the Emirates &mdash; the places most people drive straight past without ever knowing they are there. Inspired by the unique landscapes of the UAE, from rolling dunes and star-filled desert skies to hidden wadis, rugged mountains and empty stretches of coast, we exist to help you get out and experience them for yourself.</p>
    </div>
    <section class="guide-sec"><h2>How it started</h2><div class="content">
      <p>It started with a simple camping trip in the desert. One night under a sky thick with stars was all it took &mdash; that trip lit a spark, and a passion to explore more of this landscape that only grew with every journey after it.</p>
      <p>The further we went, the more we realised how much the UAE holds beyond its cities, and how little of it is mapped for the people who actually want to find it. Sahra &amp; Beyond grew out of that: years of exploring the farthest corners of the country, turned into a guide for everyone who feels the same pull.</p>
    </div></section>
    <section class="guide-sec"><h2>What we are about</h2><div class="content">
      <p>Our mission is simple &mdash; to help you discover the wild side of the UAE. Not the polished, curated version, but the real one: the secluded camp spots, the wadis that flow after the rains, the mountain roads and the dark-sky deserts where the Milky Way still shows.</p>
      <p>We want to make the outdoors feel within reach, so that anyone &mdash; first-timers and seasoned adventurers alike &mdash; can head out prepared, safe and inspired.</p>
    </div></section>
    <section class="guide-sec"><h2>What you will find here</h2><div class="content">
      <p>Every place on Sahra &amp; Beyond is somewhere we would actually go. You will find an interactive map with real GPS coordinates, honest guides to camping, wadis, mountains, coast and dunes, live weather for each spot, and tailored packing lists so you arrive ready. There is a companion Android app too, so your next adventure is always in your pocket.</p>
    </div></section>
    <section class="guide-sec"><h2>The name</h2><div class="content">
      <p>&ldquo;Sahra&rdquo; means desert in Arabic &mdash; and &ldquo;beyond&rdquo; is everything else the Emirates hold once you leave the tarmac behind: the wadis, the mountains, the coast and the quiet. That is the invitation &mdash; come explore it with us.</p>
    </div></section>
    <section class="guide-sec"><h2>Wear it</h2><div class="content">
      <p>The places we explore now live on original tees &mdash; the Milky Way over Al Quaa, the dune ridges of Liwa, the peaks of the Hajar Mountains. Every design carries a place, drawn from the real landscapes on this site.</p>
    </div></section>
    ${shopBlock(null)}
    <p class="back" style="margin-top:26px"><a href="/">Back to Sahra &amp; Beyond &rarr;</a></p>
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
    const desc = 'Original heavyweight organic-cotton tees inspired by real UAE places — the Milky Way over Al Quaa, the dunes of Liwa and the Hajar Mountains.';
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
    const meta = `\n<meta name="description" content="${esc(desc)}">\n<link rel="canonical" href="${canonical}">\n<meta name="theme-color" content="#14102A">\n<meta property="og:type" content="website">\n<meta property="og:title" content="${esc(title)}">\n<meta property="og:description" content="${esc(desc)}">\n<meta property="og:url" content="${canonical}">\n<meta property="og:image" content="${SITE}/shirts/alquaa-regular-front.jpg">\n<meta property="og:site_name" content="Sahra & Beyond">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="${esc(title)}">\n<meta name="twitter:description" content="${esc(desc)}">\n<meta name="twitter:image" content="${SITE}/shirts/alquaa-regular-front.jpg">\n<script type="application/ld+json">${JSON.stringify(jsonld)}</script>`;
    html = html.replace(/<meta name="robots"[^>]*><!--[^>]*-->\n?/, '');
    // shop-preview.html carries its own canonical/og:image so the preview page is
    // correct on its own; strip them here or /shop/ ends up with two of each.
    html = html.replace(/\n?<link rel="canonical"[^>]*>/g, '');
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
        <p class="sp-meta">AED ${esc(String(p.price))} &middot; ${esc(p.garment === 'polo' ? '240 GSM piqué' : '230 GSM cotton')} &middot; unisex S&ndash;XL</p>
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
    </style>`;

    html = html.replace(
      '<main id="products"><div class="loading">Loading the collection&hellip;</div></main>',
      gridCss + '<main id="products"><div class="sp-grid">' + staticGrid + '</div></main>'
    ).replace(
      '<main id="products"><div class="loading">Loading the collection…</div></main>',
      gridCss + '<main id="products"><div class="sp-grid">' + staticGrid + '</div></main>'
    );

    write('shop/index.html', html);
  } catch (e) { console.log('  ! shop page skipped: ' + e.message); }
})();


// ---- Places index (the full directory that replaced the old planner grid) ----
(function () {
  const canonical = `${SITE}/places/`;
  const title = 'All Places — ' + locations.length + ' Deserts, Wadis, Mountains & Beaches in the UAE | Sahra & Beyond';
  const desc = 'The full Sahra & Beyond map: ' + locations.length + ' real places across the Emirates — dunes, wadis, mountains and beaches, each with GPS, live weather and a packing list.';
  const jsonld = [
    { "@context": "https://schema.org", "@type": "CollectionPage", "name": title, "description": desc, "url": canonical },
    { "@context": "https://schema.org", "@type": "ItemList", "itemListElement": locations.map((l, i) => ({ "@type": "ListItem", "position": i + 1, "name": l.name, "url": `${SITE}/locations/${l.id}/` })) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/" },
      { "@type": "ListItem", "position": 2, "name": "Places", "item": canonical }
    ] }
  ];
  const CATS = ['Dunes', 'Camping', 'Wadis', 'Mountains', 'Coast'];
  const seen = new Set();
  const secs = CATS.map(c => {
    const list = locations.filter(l => l.category === c);
    list.forEach(l => seen.add(l.id));
    return list.length ? `<section class="guide-sec"><h2>${esc(c)}</h2><div class="cards">${list.map(locCard).join('')}</div></section>` : '';
  }).join('');
  const rest = locations.filter(l => !seen.has(l.id));
  const restHtml = rest.length ? `<section class="guide-sec"><h2>More places</h2><div class="cards">${rest.map(locCard).join('')}</div></section>` : '';
  const body = `
  <section class="loc-hero" style="--hero-grad:linear-gradient(160deg,#14102A 0%,#39295A 40%,#7A4F63 72%,#C0702E 100%)">
    <div class="stars" style="position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(1.6px 1.6px at 14% 24%,#fff,transparent),radial-gradient(1.2px 1.2px at 36% 12%,#fff,transparent),radial-gradient(1.6px 1.6px at 58% 30%,#fff,transparent),radial-gradient(1.2px 1.2px at 76% 16%,#FFE9C4,transparent),radial-gradient(1.6px 1.6px at 90% 34%,#fff,transparent);animation:ctaTwinkle 4.5s ease-in-out infinite"></div>
    <div class="glow"></div><svg class="dune-far" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true"><path fill="#8B4E63" d="M0,220 C300,150 560,250 820,200 C1080,150 1300,220 1440,190 L1440,320 L0,320 Z"/></svg><svg class="dune-near" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true"><path fill="#3A241C" d="M0,270 C320,210 620,290 940,250 C1180,220 1330,270 1440,255 L1440,320 L0,320 Z"/></svg><div class="grain"></div><div class="loc-hero-inner">
      <nav class="crumbs"><a href="/">Home</a> &rsaquo; <span>Places</span></nav>
      <div class="loc-emoji">🗺️</div>
      <h1>Every place we have explored</h1>
      <p class="lede">${locations.length} real places across the Emirates &mdash; the landscapes behind every design</p>
    </div>
  </section>
  <main>
    <div class="content"><p>This is the map behind the brand: every desert, dune field, wadi, mountain trail and beach we have explored across the UAE. Each place has its own guide with GPS coordinates, live weather, honest difficulty ratings and a packing list tailored to the terrain.</p></div>
    ${secs}
    ${restHtml}
    ${shopBlock(null)}
    <p class="back" style="margin-top:26px"><a href="/">&larr; Back to Sahra &amp; Beyond</a></p>
  </main>`;
  write('places/index.html', shell({ title, desc, canonical, jsonld, bodyHtml: body, activeNav: 'places' }));
})();

// ---- product detail pages (content/products/*.json) ----

/* ============================================================================
   COMMERCE PAGES — the buy-intent surfaces the site was missing entirely.
   /t-shirts/  hub for "UAE t-shirt brand" style queries
   /gifts/     the uncontested lane: meaningful UAE gifts vs. tacky souvenirs
   /fabric/    spec + trust page ("230gsm t shirt", "organic cotton tee UAE")
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
  return tbl('Regular fit','regular',SIZING.regularIntent||'') + tbl('Oversized fit','oversized',SIZING.oversizedIntent||'') + method + polo;
}

const COMMERCE = [
  {
    slug: 't-shirts', emoji: '◈', cat: 'Dunes',
    h1: 'UAE T-Shirts',
    title: 'UAE T-Shirts — Original Designs from Real Places',
    desc: 'Original UAE t-shirts inspired by real places — the dark sky at Al Quaa, the dunes of Liwa, the Hajar mountains. 230gsm organic cotton, limited runs.',
    catNav: true,
    intro: "Most UAE t-shirts fall into two camps: airport souvenirs with a camel and a skyline, or imported fast fashion with nothing to do with this country at all. We wanted a third option — a t-shirt that means something to someone who actually lives here.\n\nEvery Sahra & Beyond t-shirt starts at a real place in the Emirates. Not a landmark you have seen on a postcard, but the places people drive out to on a Friday: the darkest sky in the country, the edge of the Empty Quarter, a wadi in the northern mountains. Each design is original artwork, printed or embroidered on heavyweight 230gsm organic cotton, and made in limited runs.",
    sections: [
      { h2: 'What makes these different from a souvenir t-shirt', body: "A souvenir shirt is designed to be recognised by a tourist. Ours are designed to be recognised by someone who has been there.\n\nThe Al Quaa design maps the Milky Way as it actually rises over one of the darkest skies in the Emirates, far enough south that no city glow reaches it. The Empty Quarter design is a tonal embroidered sun over the dune ridges of Liwa. The Hajar design reduces the peaks above Wadi Naqab to contour lines. If you know the place, the design reads instantly. If you do not, it still works as a graphic." },
      { h2: 'The fabric, plainly', body: "All our t-shirts are 230gsm 100% organic cotton. That is a heavyweight — noticeably more substantial than a standard 150–180gsm shirt — which is what gives it structure so it hangs properly instead of clinging.\n\nEvery piece has a ribbed crew neck that holds its shape, and taped collar and shoulder seams so the shirt survives washing. Printed graphics are direct-to-garment, which sits the ink into the cotton rather than laying a plastic panel across your back, so the fabric still breathes. The Al Quaa and Hajar designs pair that print with an embroidered logo, and the Empty Quarter design is embroidered throughout, with no print at all — so every piece in the range carries stitching somewhere." },
      { h2: 'Regular and oversized fits', body: "Everything is cut unisex — one cut worn by everyone, no separate men's and women's versions — in sizes S to XL. Each t-shirt design comes in both a Regular and an Oversized fit; the polo comes in one. Regular is a classic straight cut that layers cleanly under a shacket or jacket. Oversized is a relaxed, wider cut with a dropped shoulder, designed to be worn on its own.\n\nFull flat-lay measurements for both fits are on our size guide." },
      { h2: 'Limited runs', body: "Each design is produced as a limited first run. When a size sells out, we may or may not make it again — and we will not promise that we will. We would rather make a small number of things properly than keep a warehouse full of everything." }
    ],
    faqs: [
      ['Where do you ship?', 'We currently ship within the United Arab Emirates only. Delivery cost is calculated and shown at checkout before you pay.'],
      ['What size should I order?', 'Every t-shirt design comes in Regular and Oversized fits, S to XL; the polo comes in one fit. Our size guide has full flat-lay measurements, plus a method for measuring a t-shirt you already own to find your match.'],
      ['Are these really organic cotton?', 'Yes — 230gsm 100% organic cotton for every piece in the collection.'],
      ['Will designs be restocked?', 'Each design is a limited run. We may make more of a design later, but we do not promise it. When a size sells out in a run, treat it as gone.']
    ]
  },
  {
    slug: 'gifts', emoji: '✦', cat: 'Camping',
    h1: 'Gifts from the UAE',
    title: 'Gifts from the UAE That Are Not Touristy',
    desc: 'A gift from the UAE that is not a fridge magnet. Original t-shirts tied to real Emirati places — for someone leaving, visiting, or missing the desert.',
    intro: "Buying a gift from the UAE usually means choosing between a fridge magnet, a camel keyring, or a t-shirt with the Dubai skyline printed across the front. All of them say the same thing: I went to a shop at the airport.\n\nA Sahra & Beyond t-shirt says something more specific. Each one is tied to a real place in the Emirates — somewhere the person you are buying for has probably actually been. That is a very different gift from a souvenir.",
    sections: [
      { h2: 'A leaving gift for someone moving away', body: "This is the one we hear about most. Someone has spent five, ten, twenty years here, and they are going home. What do you give them?\n\nA skyline t-shirt is a joke gift. But a shirt carrying the night sky over Al Quaa, or the dune ridges of Liwa, is a specific memory of a specific place — the kind of thing that gets kept and worn rather than put in a drawer. If they camped in the desert, drove out to see the stars, or hiked the wadis, they will recognise it immediately." },
      { h2: 'For someone who loves the outdoors here', body: "If the person you are buying for spends their weekends camping, dune driving, stargazing or hiking, the design will land. Each of our t-shirts comes from a place they can drive to, and every product page tells the story of that place — including the coordinates.\n\nHeavyweight 230gsm organic cotton means it is a shirt they will actually keep wearing, not a novelty they wear once." },
      { h2: 'For a visitor who wants something real', body: "Visitors often want something from the UAE that is not obviously made for visitors. A limited-run t-shirt from a small local brand, tied to a place beyond the city, is a better answer than anything in the departures hall — and it packs flat." },
      { h2: 'Practical things', body: "All our t-shirts are AED 199 and come in Regular and Oversized fits. The Sahra Polo is AED 229 and comes in one fit. Everything is cut unisex, S to XL. We ship across the UAE, and delivery cost is shown at checkout before you pay.\n\nIf you are unsure about size, exchanges within the UAE are free within 14 days of delivery, as long as the piece is unworn with tags attached. If you are buying as a gift and want to be certain, email us and we will help you choose." }
    ],
    faqs: [
      ['What is a good leaving gift for an expat in the UAE?', 'Something tied to a specific place they know rather than a generic city souvenir. Our t-shirts are each based on a real location in the Emirates — the dark sky at Al Quaa, the dunes at Liwa, the Hajar mountains — so the gift is a memory of somewhere they have actually been.'],
      ['Can I exchange it if the size is wrong?', 'Yes. Exchanges within the UAE are free within 14 days of delivery, subject to stock, as long as the item is unworn, unwashed and still has its tags.'],
      ['How much do they cost?', 'Every t-shirt in the collection is AED 199. The Sahra Polo is AED 229. Delivery is calculated at checkout.'],
      ['Do you ship outside the UAE?', 'Not yet — we currently ship within the United Arab Emirates only.']
    ]
  },
  {
    slug: 'fabric', emoji: '▦', cat: 'Mountains',
    h1: 'Our fabric and construction',
    title: '230gsm Organic Cotton — Fabric & Construction',
    desc: 'What 230gsm actually means, why we use ribbed collars and taped seams, and how DTG printing differs from embroidery — the construction behind every piece.',
    intro: "Most t-shirt brands describe fabric in adjectives. Premium. Buttery. Luxe. None of those words mean anything you can check. Here are the actual specifications of what we make, and why each choice was made.",
    sections: [
      { h2: 'What 230gsm means', body: "GSM is grams per square metre — the weight of the fabric. A typical high-street t-shirt runs 150–180gsm. Ours is 230gsm.\n\nThe practical difference is structure. A lightweight shirt drapes onto the body and shows everything underneath; a heavyweight one holds its own shape and hangs away from you. It also survives washing far better, because there is simply more cotton there to begin with. The trade-off is honest: 230gsm is a more substantial shirt, so in peak UAE summer the Regular fit breathes better than the Oversized." },
      { h2: 'Why 100% organic cotton', body: "Organic cotton is grown without synthetic pesticides or fertilisers. It matters here for two reasons beyond the environmental one: it is fully breathable, which is not optional in this climate, and it takes direct-to-garment ink better than a cotton-polyester blend, giving a sharper print.\n\nWe do not blend in polyester. A poly-cotton shirt is cheaper to make and holds a print slightly longer, but it traps heat — which is the wrong trade in the Gulf." },
      { h2: 'Ribbed collar, taped seams', body: "The collar is a ribbed crew neck. Ribbing is knitted with more elasticity than the body fabric, so the neckline returns to shape instead of stretching out and going wavy — which is how most t-shirts visibly die.\n\nThe collar and shoulder seams are taped: a strip of fabric bound over the seam on the inside. It stops the shoulders from twisting over time and takes the strain off the stitching. It is a small manufacturing cost that shows up years later." },
      { h2: 'DTG printing versus embroidery', body: "Two of our designs carry a printed graphic. DTG sprays ink into the fibres rather than laying a film on top, so the graphic stays soft, the fabric keeps breathing, and there is no plastic panel across your back. It flexes with the cotton instead of cracking. On both of those designs the logo itself is embroidered — so a single shirt carries two techniques, ink and thread.\n\nThe Empty Quarter design goes further and is embroidered throughout, with no print at all — thread stitched into the cloth, tonal against the fabric. Embroidery has a raised texture you can feel, catches light differently through the day, and will not fade the way a print eventually can. The polo is embroidered too." },
      { h2: 'How to make it last', body: "Wash cold and inside out. Heat is what fades a print fastest, and washing inside out protects both print and embroidery from abrasion.\n\nHang to dry rather than tumble drying — tumble drying is the main cause of both shrinkage and cracking. Skip fabric softener; it coats the fibres and dulls the finish. Do not iron directly onto a print." },
      { h2: 'Where it is made', body: "Our fabric is sourced from Pakistan, one of the world's major cotton-producing countries. The designs are created here in the UAE. We say designed in the UAE rather than made in the UAE, because that is the accurate description." }
    ],
    faqs: [
      ['Is 230gsm too heavy for UAE weather?', 'It is a heavyweight tee, so it is more substantial than a thin fast-fashion shirt — that is what gives it structure and longevity. It is 100% breathable cotton with no polyester. For peak summer, the Regular fit breathes more than the Oversized.'],
      ['Will the print crack?', 'DTG ink bonds into the cotton rather than sitting on top as a thick layer, so it flexes with the fabric instead of cracking. Washing cold and hanging to dry rather than tumble drying is what makes the difference long term.'],
      ['Will it shrink?', 'The fabric is pre-washed to minimise shrinkage. Wash cold, hang dry, and you should see very little movement. Hot washes and tumble dryers cause shrinkage.'],
      ['Is the cotton certified organic?', 'The fabric is 100% organic cotton sourced through our supplier. We are working on publishing certification details and will add them here once confirmed.']
    ]
  },
  {
    slug: 'size-guide', emoji: '▱', cat: 'Coast',
    h1: 'T-shirt size and fit guide',
    title: 'T-Shirt Size Guide — Regular & Oversized Fit',
    desc: 'Flat-lay measurements for every Sahra & Beyond t-shirt in Regular and Oversized fits, plus how to measure a t-shirt you already own to find your size.',
    intro: "Everything we make is cut unisex — one cut worn by everyone, in sizes S to XL, with no separate men's or women's version. Each t-shirt design comes in two fits, Regular and Oversized; the polo comes in one. Every figure below is a garment measurement taken flat, not a body measurement, and comes straight from the graded specification our manufacturer produced against. Both inches and centimetres are shown.",
    sizeTable: true,
    sections: [
      { h2: 'Regular or oversized?', body: "Regular is a classic straight cut. It sits close to the body without being tight, and layers cleanly under a shacket or jacket. If you normally wear a medium in a high-street t-shirt, take a medium here.\n\nOversized is a deliberately wider cut with a dropped shoulder and more room through the body. It is designed to be worn on its own rather than layered. If you are between sizes and want the relaxed look, size down rather than up — the oversized cut already adds width." },
      { h2: 'How to find your size without guessing', body: "The most reliable method is to measure a t-shirt you already own and like the fit of.\n\nLay it flat on a table and smooth out the wrinkles. Measure the chest straight across, from one armpit seam to the other — that is the flat chest measurement, and it is the number to compare against the tables above. Then measure the length from the highest point of the shoulder straight down to the hem.\n\nMatch those two numbers to the closest size in the table. If you fall between two sizes, go up for the Regular fit and down for the Oversized." },
      { h2: 'If you order the wrong size', body: "Exchanges within the UAE are free within 14 days of delivery, subject to stock, as long as the piece is unworn, unwashed and still has its tags. Email hello@sahraandbeyond.ae with your order number and we will arrange it.\n\nIf you would rather get it right first time, email us before you order and we will talk you through it." }
    ],
    faqs: [
      ['Are these unisex?', 'Yes — every piece is cut unisex, S to XL, with no separate men\'s or women\'s version. Because the tables above give the garment measured flat rather than a body size, measure a t-shirt you already like the fit of and match the numbers. Sizing down gives a closer fit, sizing up a more relaxed one — same garment either way.'],
      ['How do I measure my t-shirt size?', 'Lay a t-shirt you already own flat, measure straight across from armpit seam to armpit seam for the flat chest measurement, then from the top of the shoulder down to the hem for length. Compare both to the tables above.'],
      ['Should I size up for the oversized fit?', 'No — the oversized cut already adds width and a dropped shoulder. If you are between sizes, size down for oversized and up for regular.'],
      ['Are exchanges free?', 'Yes, within the UAE, within 14 days of delivery and subject to stock, as long as the item is unworn, unwashed and still has tags.']
    ]
  }
];


const CATEGORIES = [
  { slug:'t-shirts/regular', cat:'regular-tees', emoji:'▭', catBg:'Dunes',
    h1:'Regular Fit T-Shirts',
    title:'Regular Fit T-Shirts — UAE Designs | Sahra & Beyond',
    desc:'Our regular fit t-shirts — true to size, cut to layer. 230gsm organic cotton, original UAE designs, S–XL. Limited runs, delivered across the UAE.',
    intro:"Regular is the fit to take if you layer. It sits on the shoulder and skims the body rather than hanging off it — a classic straight cut graded to the US/international standard, with a 2″ chest step per size above M.\n\nEvery design in the collection comes in this fit, cut unisex, in sizes S to XL. Same 230gsm organic cotton, same ribbed collar and taped seams as the oversized cut; the difference is entirely in the silhouette.",
    sections: [{"h2": "True to size, measured rather than felt", "body": "\"True to size\" gets used loosely, so here it is in numbers. The Regular fit follows classic US/international grading: the shoulder seam sits at your natural shoulder point rather than dropped below it, and the body skims rather than hanging.\n\nMeasured flat, pit to pit: S is 19″, M is 20″, L is 22″ and XL is 24″ — a 2″ step per size above M. Those are garment measurements taken flat, not body measurements, and they come straight from the graded specification our manufacturer produced against. Every measurement holds a tolerance of ±0.5″; anything outside it is rejected at QC before it ships.\n\nThat precision is the point. If you know the flat chest measurement of a shirt you already like, you know your size here without guessing what a given brand means by Regular."}, {"h2": "How to use the measurements", "body": "Take a t-shirt you already own and wear happily. Lay it flat, smooth out the creases, and measure straight across from armhole seam to armhole seam, about an inch below the armhole. That single number is directly comparable to ours — do not double it. Our chart is flat garment measurements throughout, so 20″ on your shirt means our M.\n\nThe step is fixed and known: 2″ per size above M. If your measurement lands between two sizes, the ±0.5″ tolerance gives some room either way. Take the smaller size for a closer fit through the chest and shoulders, the larger for more ease.\n\nThe cut is unisex, S to XL. There is no separate men's or women's grade, and we do not produce an XXL — so the chart above is the whole range, not a subset of it."}, {"h2": "What the construction is doing", "body": "Every Regular tee is 230 GSM combed, ring-spun cotton. Combing removes the shorter fibres before spinning, which is what gives the cloth its smooth, dense hand instead of a looser, hairier surface.\n\nFrom there the details are about longevity rather than decoration. The shoulders carry woven shoulder taping — not cotton tape — which stops the seam stretching out under the weight of the garment over time. Seams are double-stitched. The body is side-seamed, built from front and back panels joined at the sides rather than a single tube, which holds its shape far better through repeated washing.\n\nThe cotton is pre-shrunk before cutting, so the fit you measure is close to the fit you keep. And the collar label is printed rather than woven, because a woven label against the back of the neck is a common source of irritation and we would rather you forget it is there."}, {"h2": "Layering", "body": "A true-to-size cut is a layering cut. Because the Regular fit follows the measurements rather than adding hidden room, it sits cleanly under an overshirt or light knit without bulking the silhouette — a base layer that disappears rather than competing with what is over it.\n\nIt works alone too. At 230 GSM there is enough substance to stand on its own through the warmer months without clinging or showing every seam beneath an open shirt.\n\nAnd because the grading is fixed and published, building a wardrobe from a few pieces stays simple. Your size in one Sahra & Beyond Regular tee is your size in all of them, and in the polo, which is graded to the same specification."}],
    faqs: [{"q": "Does the Regular fit run true to size?", "a": "Yes, and the numbers are published rather than implied. Measured flat, pit to pit, M is 20″, L is 22″ and XL is 24″, with the shoulder seam at your natural shoulder point. Tolerance is ±0.5″."}, {"q": "How do I measure myself for the right size?", "a": "Do not measure yourself — measure a shirt. Lay a t-shirt you already like flat and measure straight across from armhole seam to armhole seam, an inch below the armhole. Compare that number directly to our chart. Our figures are flat garment measurements, so there is no doubling involved."}, {"q": "My measurement falls between two sizes.", "a": "There is a ±0.5″ tolerance on every measurement, so you have some latitude. Take the smaller size to sit closer to the body, the larger for more ease through the chest. The shoulder seam position does not change between sizes."}, {"q": "What does the fabric feel like?", "a": "Dense and smooth rather than thin. It is 230 GSM combed, ring-spun cotton — combing strips out the shorter fibres before spinning, which is what produces that hand. Enough weight to hold its shape through a day without feeling heavy."}, {"q": "Will it shrink?", "a": "The cotton is pre-shrunk before cutting, so you should not see meaningful shrinkage. A cool wash and air drying will keep both the fabric and the shape at their best."}, {"q": "What are delivery and returns?", "a": "We deliver within the UAE only, free over AED 150. Dispatch is 1–2 working days and delivery typically 2–4. Returns and exchanges are free within the UAE for 14 days, unworn with tags attached."}] },
  { slug:'t-shirts/oversized', cat:'oversized-tees', emoji:'▯', catBg:'Camping',
    h1:'Oversized Fit T-Shirts',
    title:'Oversized T-Shirts UAE — Drop Shoulder | Sahra & Beyond',
    desc:'Oversized drop-shoulder t-shirts. The seam sits 2–3 inches below your natural shoulder — width, not length, makes the silhouette. 230gsm cotton, S–XL.',
    intro:"This is a true oversized cut, not a size up. The shoulder seam is deliberately dropped 2–3″ below your natural shoulder point and the body is cut wider, so the shape reads as a silhouette rather than a big t-shirt.\n\nCut unisex, S to XL. Take your normal size for the intended fit; size down only if you want it slightly loose. Designed to be worn on its own — a fitted jacket fights the drop shoulder. Sizes S to XL.",
    sections: [{"h2": "What a real drop shoulder is", "body": "There is a meaningful difference between an oversized cut and simply buying your usual size up, and it comes down to where the shoulder seam sits.\n\nIn the Regular fit that seam stays at your natural shoulder point at every size. Going up a size adds width through the chest, but the shoulder does not move — you get a roomier version of the same silhouette. A true drop shoulder is a different pattern, not a larger copy of the same one. On the Oversized fit the seam is set 2–3″ below the natural shoulder point, out over the arm.\n\nThat is what creates the shape. Not extra fabric hanging off a standard cut, but a garment drafted from the start to sit differently on the body. It is why sizing up in a Regular and taking the Oversized in your usual size produce genuinely different results, even at a similar chest measurement."}, {"h2": "Width, not length", "body": "At M the Oversized measures 23.5″ across the chest against 20″ for the Regular — 3.5″ more at the same letter, measured flat, pit to pit. That difference is doing the work people often credit to length. The Oversized tee is not dramatically longer; it is wider, and width combined with the dropped seam is what builds the silhouette.\n\nThe full range, flat: S is 22.5″, M is 23.5″, L is 25″ and XL is 26.5″. Note that the step differs from the Regular fit — 1.5″ per size above M here, against 2″ there — so the two charts are not interchangeable and the gap between the fits narrows slightly as the sizes go up. Tolerance is ±0.5″ on every measurement.\n\nThe effect is a garment that sits away from the chest and shoulders rather than skimming them, with the sleeve opening set further along the arm."}, {"h2": "Why a looser cut wears cooler", "body": "In UAE heat, how cloth sits against skin matters as much as the cloth itself. The extra width through the chest and shoulders means the 230 GSM cotton is not pulled taut against the body — there is room for air to move between fabric and skin instead of the shirt sitting flush.\n\nThis is a function of the cut, not of anything special about the fabric. It is the same combed, ring-spun cotton used across the Regular fit and the polo, simply draped more loosely because of the drop shoulder and the wider chest. A looser garment also moves more independently of the body as you do, which is part of why an oversized silhouette tends to feel less close over a long day outdoors.\n\nA practical reason to choose the cut, alongside the look of it."}, {"h2": "Choosing your size", "body": "Because this fit is built on width rather than length, sizing comes down to how much room you want through the chest and shoulders rather than how tall you are.\n\nMeasure an oversized piece you already like the fit of: lay it flat and measure straight across from armhole seam to armhole seam, an inch below the armhole. Compare that number directly to ours — S 22.5″, M 23.5″, L 25″, XL 26.5″. These are flat garment measurements, so there is no doubling involved.\n\nDo not assume your Regular fit letter carries across. The Oversized is a different pattern with a different grading step, so it is worth checking the number rather than defaulting to habit. Between two sizes, the smaller gives a defined drop shoulder and the larger pushes the silhouette looser still. The range is S to XL, unisex; we do not produce an XXL."}],
    faqs: [{"q": "How do I choose a size in the Oversized fit?", "a": "Compare flat chest measurements rather than assuming your usual letter carries across — this is a different pattern from the Regular, not the same shirt made larger. Measured flat, pit to pit: S 22.5″, M 23.5″, L 25″, XL 26.5″."}, {"q": "What is the difference between this and sizing up in the Regular fit?", "a": "Sizing up in the Regular adds chest width but keeps the shoulder seam at your natural shoulder point — a roomier version of the same silhouette. The Oversized sets that seam 2–3″ below it, on a pattern drafted for a drop shoulder. At M it is also 3.5″ wider in the chest. The two are not interchangeable."}, {"q": "Do the two fits use the same size steps?", "a": "No. Above M the Regular fit steps 2″ per size and the Oversized steps 1.5″, so the difference between the fits narrows slightly at the larger end. Read whichever chart applies to the fit you are buying."}, {"q": "Is the fabric different from the Regular tee?", "a": "No. Both are 230 GSM combed, ring-spun cotton with the same double-stitched seams and woven shoulder taping. The difference is entirely in the pattern — a wider chest and a dropped shoulder seam."}, {"q": "Does it need different care?", "a": "No. The cotton is pre-shrunk before cutting, so shrinkage should be minimal. A cool wash and air drying keeps the shape and the fabric at their best."}, {"q": "What are delivery and returns?", "a": "UAE delivery only, free over AED 150. Dispatch 1–2 working days, delivery typically 2–4. Returns and exchanges free within the UAE for 14 days, unworn with tags on."}] },
  { slug:'polos', cat:'polos', emoji:'✦', catBg:'Dunes',
    h1:'Polo Shirts',
    title:'Embroidered Cotton Polo — 240gsm | Sahra & Beyond',
    desc:'The Sahra Polo — 240gsm cotton, embroidered rather than printed. A limited first run. The scarcest piece in the first drop.',
    intro:"One polo, made in a limited run. It is 240gsm rather than the 230 we use on the tees — ten grams that show up in how the collar stands after a season rather than curling.\n\nEmbroidered instead of printed, and deliberately quiet. Cut unisex, S to XL, and sized to the same specification as the Regular fit tees. Made in a smaller run than the tees, counted on its own.",
    sections: [{"h2": "What piqué actually does", "body": "The Sahra Polo is 240 GSM piqué, not the 230 GSM jersey we use for the tees. Piqué is a knit structure rather than a heavier version of the same cloth — the fine waffle texture comes from the way the yarn interlocks, not from anything applied afterwards. That structure is what gives a polo its particular hand: more body than a jersey tee, a little give across the chest, and a surface that sits away from the skin rather than clinging to it.\n\nThe extra ten grams matter as well. At 240 GSM the fabric holds a collar shape rather than curling after a season. Underneath the knit the construction is the same as the tees — woven shoulder taping rather than cotton tape, double-stitched seams, side seams rather than a single tube of fabric, and cotton pre-shrunk before it reaches the cutting table."}, {"h2": "Embroidered, not printed", "body": "The logo on the chest is embroidered. Thread built into the cloth has texture you can feel and does not crack, peel or fade the way a print eventually does. On a garment worn as often as a polo, that is the whole argument: the mark should still read cleanly long after the fabric has softened.\n\nThe back is left plain. Not every piece in the range is decorated the same way — two of the tees carry a DTG graphic across the back and an embroidered logo at the front, while the Empty Quarter tee and this polo are embroidered at the front and plain behind. The technique follows the design rather than a house rule.\n\nThe collar label is a separate decision. Labels across the whole range are printed, never woven, because a woven label sitting against the back of the neck irritates skin over a full day. On a collared piece that sits higher and closer, it matters more than anywhere else."}, {"h2": "How it fits", "body": "The polo is graded to the same specification as the Regular fit tees, so if you know your size in one you know it in the other. The shoulder seam sits at the natural shoulder point, and the polo has a set-in sleeve with no drop shoulder — the oversized chart does not apply to it.\n\nMeasured flat, pit to pit: S is 19″, M is 20″, L is 22″ and XL is 24″. Every measurement carries a tolerance of ±0.5″, and anything outside that is rejected at QC rather than shipped.\n\nThe cut is unisex. There is no separate men's or women's grade, and the range runs S to XL only — we do not produce an XXL. Choose by the chest measurement rather than by the letter you usually reach for."}, {"h2": "Looking after it", "body": "A piqué knit rewards a little care, mostly for the embroidery rather than the cloth. Turn it inside out before washing: that protects the stitching at the chest and stops the piqué texture flattening against everything else in the drum. Beyond that, treat it as any combed cotton piece — a cool, gentle wash is kinder to both the colour and the knit than a hot one.\n\nBecause the cotton is pre-shrunk before cutting, it should not pull in on itself after the first wash the way untreated cotton does. The double-stitched seams and woven shoulder taping are there to hold shape over repeated washing, and a printed collar label cannot crack or scratch the way a stiff woven one does.\n\nAir drying keeps it looking right for longest. The construction is built for ordinary use, though — this is a polo meant to be worn, not preserved."}],
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
  chips.push('Unisex S&ndash;XL');
  const colour = p.colourHex ? `<span class="pcard-col"><span class="pcard-sw" style="background:${esc(p.colourHex)}"></span>${esc(p.colourName || '')} &middot; Pantone ${esc(p.colourPantone || '')}</span>` : '';
  return `
    <article class="pcard" data-handle="${esc(p.id)}">
      <span class="pcard-img" style="background:${p.theme || '#EFEAE0'}">
        <a class="pcard-imglink" href="/products/${p.id}/" tabindex="-1">
          <img src="${esc(p.imgMain)}" alt="${esc(p.altMain || p.name)}" loading="lazy">
        </a>
        <button type="button" class="pcard-zoom" data-zoom="${esc(p.imgMain)}" aria-label="Zoom ${esc(p.name)}">&#9906;</button>
      </span>
      <span class="pcard-b">
        <a class="pcard-t" href="/products/${p.id}/">${esc(p.name)}</a>
        ${RV.cardRating(p.id)}
        ${p.placeName ? `<span class="pcard-place">Inspired by ${esc(p.placeName)}</span>` : '<span class="pcard-place">Sahra &amp; Beyond</span>'}
        <span class="pcard-spec">${chips.map(c => `<span>${c}</span>`).join('')}</span>
        ${colour}
        <span class="pcard-foot"><span class="pcard-p">AED ${esc(String(p.price))}</span><a class="pcard-cta" href="/products/${p.id}/">Full details &rarr;</a></span>
      </span>
    </article>`;
}
function catCards(list) {
  if (!list.length) return '<p>Nothing in this category yet.</p>';
  return `<div class="pcards">${list.map(productCard).join('')}</div>`;
}

CATEGORIES.forEach(C => {
  const items = BY_CATEGORY(C.cat);
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
    <div class="content">${paras(C.intro)}</div>
    ${Array.isArray(C.sections) ? C.sections.map(x => `<section class="guide-sec"><h2>${esc(x.h2)}</h2><div class="content">${paras(x.body)}</div></section>`).join('') : ''}
    ${Array.isArray(C.faqs) && C.faqs.length ? `<section class="faq"><h2>Frequently asked questions</h2>${C.faqs.map(q => `<details><summary>${esc(q.q)}</summary><p>${esc(q.a)}</p></details>`).join('')}</section>` : ''}
    <section class="pcta"><div class="pcta-head"><span class="pcta-eyebrow">${C.h1}</span></div>${catCards(items)}
      <a class="btn shoplink" href="${shopHref}">Shop ${esc(C.h1.replace(/ T-Shirts$/,'').replace(/^Polo Shirts$/,'the polo'))} &rarr;</a><a class="btn ghost" href="/size-guide/">Size &amp; fit guide &rarr;</a></section>
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
  write(`${C.slug}/index.html`, shell({ title: C.title, desc: C.desc, canonical, jsonld: catLd, bodyHtml: body, activeNav: navKeyFor(C.slug) }));
});

COMMERCE.forEach(P => {
  const canonical = `${SITE}/${P.slug}/`;
  const jsonld = [
    { "@context": "https://schema.org", "@type": "WebPage", "name": P.h1, "description": P.desc, "url": canonical },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/" },
      { "@type": "ListItem", "position": 2, "name": P.h1, "item": canonical }
    ] }
  ];
  if (P.faqs && P.faqs.length) {
    jsonld.push({ "@context": "https://schema.org", "@type": "FAQPage",
      "mainEntity": P.faqs.map(q => ({ "@type": "Question", "name": q[0], "acceptedAnswer": { "@type": "Answer", "text": q[1] } })) });
  }
  const sectionsHtml = (P.sections || []).map(x =>
    `<section class="guide-sec"><h2>${esc(x.h2)}</h2><div class="content">${paras(x.body)}</div></section>`).join('');
  const faqHtml = (P.faqs && P.faqs.length)
    ? `<section class="faq"><h2>Frequently asked questions</h2>${P.faqs.map(q => `<details><summary>${esc(q[0])}</summary><p>${esc(q[1])}</p></details>`).join('')}</section>` : '';
  const body = `
  <section class="loc-hero" style="--hero-grad:${CAT_BG[P.cat]}">
    <div class="glow"></div><svg class="dune-far" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true"><path fill="#8B4E63" d="M0,220 C300,150 560,250 820,200 C1080,150 1300,220 1440,190 L1440,320 L0,320 Z"/></svg><svg class="dune-near" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true"><path fill="#3A241C" d="M0,270 C320,210 620,290 940,250 C1180,220 1330,270 1440,255 L1440,320 L0,320 Z"/></svg><div class="grain"></div><div class="loc-hero-inner">
      <nav class="crumbs"><a href="/">Home</a> &rsaquo; <span>${esc(P.h1)}</span></nav>
      <div class="loc-emoji">${P.emoji}</div>
      <h1>${esc(P.h1)}</h1>
      <p class="lede">Inspired by the landscapes of the UAE &mdash; wear the wild side of it</p>
    </div>
  </section>
  <main>
    <div class="content">${paras(P.intro)}</div>
    ${P.catNav ? `<nav class="catnav" aria-label="Shop by category">
      <a href="/t-shirts/regular/"><b>Regular fit</b><span>True to size, cut to layer</span></a>
      <a href="/t-shirts/oversized/"><b>Oversized fit</b><span>True drop shoulder</span></a>
      <a href="/polos/"><b>Polo</b><span>240gsm, embroidered &middot; limited run</span></a>
    </nav>` : ''}
    ${collectionBlock(null, P.slug === 't-shirts')}
    ${P.sizeTable ? `<section class="guide-sec"><h2>Measurements</h2>${sizeTableHtml()}</section>` : ''}
    ${sectionsHtml}
    ${faqHtml}
    ${newsletterBlock()}
    <p class="back"><a href="/">Back to Sahra &amp; Beyond &rarr;</a></p>
  </main>`;
  write(`${P.slug}/index.html`, shell({ title: P.title, desc: P.desc, canonical, jsonld, bodyHtml: body, activeNav: navKeyFor(P.slug) }));
});

const PRODUCT_URLS = buildProducts({ ROOT, SITE, write, launched: LAUNCHED, shopUrl: (LAUNCHED || REVEALED) ? '/shop/' : '/shop-preview.html' });
console.log('  \u2713 ' + PRODUCT_URLS.length + ' product pages');

// ---- sitemap ----
const buildDate = new Date().toISOString().slice(0, 10);
function locMtime(id) { try { return fs.statSync(path.join(locDir, id + '.json')).mtime.toISOString().slice(0, 10); } catch (e) { return buildDate; } }
const entries = [{ u: `${SITE}/`, m: buildDate, p: '1.0' }]
  .concat((LAUNCHED || REVEALED) ? [{ u: `${SITE}/shop/`, m: buildDate, p: '0.9' }] : [])
  .concat([{ u: `${SITE}/places/`, m: buildDate, p: '0.8' }, { u: `${SITE}/about/`, m: buildDate, p: '0.6' },
            { u: `${SITE}/commitment.html`, m: buildDate, p: '0.6' }])
  // policies.html is noindex until launch — listing it earlier would put a
  // noindexed URL in the sitemap, which is the contradiction Ahrefs flags
  .concat(LAUNCHED ? [{ u: `${SITE}/policies.html`, m: buildDate, p: '0.4' }] : [])
  .concat(LANDINGS.map(L => ({ u: `${SITE}/${L.slug}/`, m: buildDate, p: '0.8' })))
  .concat(COMMERCE.map(P => ({ u: `${SITE}/${P.slug}/`, m: buildDate, p: '0.9' })))
  .concat(CATEGORIES.map(C => ({ u: `${SITE}/${C.slug}/`, m: buildDate, p: '0.9' })))
  .concat(locations.map(l => ({ u: `${SITE}/locations/${l.id}/`, m: locMtime(l.id), p: '0.8' })))
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
  locations: locations.map(l => Object.assign({}, l, { url: SITE + '/locations/' + l.id + '/' })),
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
  for (const f of ['index.html', 'homepage-preview.html']) {
    const file = path.join(ROOT, f);
    if (!fs.existsSync(file)) continue;
    let html = fs.readFileSync(file, 'utf8');
    if (!MARK.test(html)) continue;
    const band = RV.homepageBand();
    const next = html.replace(MARK, '<!--REVIEWS:START-->' + band + '<!--REVIEWS:END-->');
    if (next !== html) {
      fs.writeFileSync(file, next);
      console.log(band ? `  \u2713 homepage review band (${f})` : `  \u00b7 homepage review band empty - not enough reviews yet (${f})`);
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
  /* The CSS lives in its own marked block so it can be REPLACED every build.
     The first version appended it once and skipped thereafter, so restyling
     the band from portrait to widescreen left the original CSS live in
     index.html and the change silently never shipped. */
  const CSSMARK = /\/\*VBAND-CSS-START\*\/[\s\S]*?\/\*VBAND-CSS-END\*\//;
  const payload = VB.exists() ? (VB.band() + VB.JS) : '';

  for (const f of ['index.html', 'homepage-preview.html']) {
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
  for (const f of ['index.html', 'homepage-preview.html']) {
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
