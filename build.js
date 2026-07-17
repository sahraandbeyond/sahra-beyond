/* Sahra & Beyond — static SEO page generator.
   Reads content/*.json and writes pre-rendered, indexable pages:
   - /locations/<slug>/index.html  (one per location)
   - /camping/, /secluded-camping/, /snorkeling/, /stargazing/  (keyword landing pages)
   - sitemap.xml
   Runs at deploy time on Vercel (build command), so pages stay in sync with the CMS. */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SITE = 'https://www.sahraandbeyond.ae';

// Clean previously-generated output so deleted locations don't leave orphan pages
['locations', 'about', 'shop', 'camping', 'secluded-camping', 'snorkeling', 'stargazing', 'camping-near-dubai', 'wadis', 'desert-camping-beginners', 'mountain-escapes', 'hatta-guide', 'best-beaches', 'desert-safari', 'family-friendly-outdoors', 'outdoor-things-to-do'].forEach(d => { try { fs.rmSync(path.join(ROOT, d), { recursive: true, force: true }); } catch (e) {} });

const TAGLINE = 'Wear the wild side of the UAE';
// Pre-launch mode: the site opens on the coming-soon experience.
// Flip to true on drop day — enables /shop/, the Shop nav link and shop CTAs everywhere.
const LAUNCHED = false;

function readJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }
function metaDesc(s) { s = String(s || ''); if (s.length <= 160) return s; const cut = s.slice(0, 157); return cut.slice(0, cut.lastIndexOf(' ')) + '…'; }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function paras(text) { return String(text || '').split(/\n\n+/).filter(Boolean).map(p => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join(''); }
function write(rel, html) { const fp = path.join(ROOT, rel); fs.mkdirSync(path.dirname(fp), { recursive: true }); fs.writeFileSync(fp, html); console.log('  ✓ ' + rel); }

const locDir = path.join(ROOT, 'content/locations');
const locations = (fs.existsSync(locDir) ? fs.readdirSync(locDir) : []).filter(f => f.endsWith('.json')).map(f => readJSON(path.join(locDir, f))).filter(Boolean);
const settings = readJSON(path.join(ROOT, 'content/settings.json')) || {};
// Instagram only — the single official channel
const social = { instagram: (settings.social && settings.social.instagram) || 'https://instagram.com/sahraandbeyond.ae' };
const disclosure = settings.affiliateDisclosure || 'As an Amazon Associate, Sahra & Beyond earns from qualifying purchases.';
const CAT_HASH = { Camping: 'camping', Wadis: 'wadis', Mountains: 'mountains', Coast: 'coast', Dunes: 'dunes' };
const AMAZON_TAG = settings.amazonTag || 'sahraandbeyon-21';
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
function faqBlock(l) {
  const faqs = faqsFor(l);
  if (!faqs.length) return '';
  return `<section class="faq"><h2>Frequently asked questions</h2>${faqs.map(q => `<details><summary>${esc(q[0])}</summary><p>${esc(q[1])}</p></details>`).join('')}</section>`;
}
function newsletterBlock() {
  if (!MON.newsletterAction) return '';
  const blurb = MON.newsletterBlurb || 'Get the best new UAE spots and seasonal tips in your inbox.';
  return `<section class="news"><h2>Never miss a new spot</h2><p>${esc(blurb)}</p>
    <form class="news-form" action="${esc(MON.newsletterAction)}" method="post">
      <input type="email" name="email_address" placeholder="you@email.com" required aria-label="Email address">
      <button type="submit">Subscribe</button>
    </form>
    <p class="news-ok" style="display:none;margin-top:12px;font-weight:700;color:#0c905c">Thanks! Check your email to confirm your subscription.</p>
    <script>(function(){var s=document.currentScript,sec=s.parentNode,f=sec.querySelector('.news-form');if(!f)return;f.addEventListener('submit',function(e){e.preventDefault();fetch(f.action,{method:'POST',body:new FormData(f),mode:'no-cors'}).finally(function(){f.style.display='none';var ok=sec.querySelector('.news-ok');if(ok)ok.style.display='block';});});})();</script></section>`;
}
// Category hero gradients (echo the app's scene palettes)
const CAT_BG = {
  Camping: 'linear-gradient(140deg,#3A2F66 0%,#7A4F63 45%,#C0702E 100%)',
  Wadis: 'linear-gradient(140deg,#1F8A74 0%,#3FA98E 50%,#7FCBB0 100%)',
  Coast: 'linear-gradient(140deg,#1C7AA2 0%,#3AA0C8 50%,#7EC8E6 100%)',
  Mountains: 'linear-gradient(140deg,#333E5C 0%,#5E6E92 50%,#90A4C8 100%)',
  Dunes: 'linear-gradient(140deg,#9A591A 0%,#C9842F 45%,#EBB36B 100%)'
};
// Packing items that apply to a location's category (always + this category + overnight-only)
function packItemsFor(l) {
  return PACKING.filter(it => {
    const s = it.show || [];
    if (!s.length) return true;
    if (s.indexOf('Overnight') !== -1) return true;
    return s.indexOf(l.category) !== -1;
  }).map(it => ({ group: it.group, name: it.name, qty: it.qty || '', note: it.note || '', query: it.query || '', amazon: it.amazon || '', overnight: (it.show || []).indexOf('Overnight') !== -1 }));
}

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui,sans-serif;color:#2B2620;background:#FAF6EF;line-height:1.65}
a{color:#9C521B}
.hdr{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:11px max(16px,calc((100% - 1240px)/2));border-bottom:1px solid rgba(43,37,32,.1);position:sticky;top:0;background:rgba(250,246,239,.9);backdrop-filter:blur(16px);z-index:50}
.brand{display:flex;align-items:center;gap:9px;text-decoration:none}
.brand img{display:block;width:34px;height:34px}
.brand-text{display:flex;flex-direction:column;line-height:1}
.brand-sahra{font-family:'Playfair Display',serif;font-size:15px;font-weight:900;letter-spacing:3px;color:#33271B;text-transform:uppercase}
.brand-beyond{font-family:'Space Mono',monospace;font-size:7px;letter-spacing:2.5px;color:#C0702E;text-transform:uppercase;margin-top:2px}
.hero-img{width:100%;max-height:420px;object-fit:cover;border-radius:18px;margin:0 0 24px}
.book{margin:26px 0;padding:20px 22px;border:1px solid rgba(192,112,46,.3);background:rgba(255,247,237,.7);border-radius:16px}
.book h2{margin:0 0 6px;font-size:18px}
.book p{margin:0 0 14px;color:#5C5346;font-size:14px}
.book-btn{display:inline-block;background:#C0702E;color:#fff;font-weight:700;padding:11px 20px;border-radius:999px;text-decoration:none}
.book-btn.alt{background:#2E7DA8}
.faq{margin:30px 0}
.faq details{border-bottom:1px solid rgba(43,37,32,.12);padding:12px 2px}
.faq summary{cursor:pointer;font-weight:700;font-size:15px;color:#33271B;list-style:none}
.faq summary::-webkit-details-marker{display:none}
.faq summary::before{content:'+ ';color:#C0702E;font-weight:800}
.faq details[open] summary::before{content:'– '}
.faq details p{margin:9px 0 2px;color:#5C5346;font-size:14px}
.news{margin:30px 0;padding:22px;border-radius:16px;background:linear-gradient(135deg,#FBEAD2,#F4C98E);text-align:center}
.news h2{margin:0 0 6px}
.news p{margin:0 0 14px;color:#5A4326;font-size:14px}
.news-form{display:flex;gap:8px;max-width:420px;margin:0 auto;flex-wrap:wrap;justify-content:center}
.news-form input{flex:1;min-width:200px;padding:12px 14px;border-radius:10px;border:1px solid rgba(43,37,32,.2);font-size:14px}
.news-form button{padding:12px 20px;border-radius:10px;border:none;background:#33271B;color:#fff;font-weight:700;cursor:pointer}
.guide-sec{margin:24px 0}
.guide-sec h2{font-size:20px;margin:0 0 8px}
.ig{margin:30px 0}
.ig-hint{font-size:12px;color:#7C7264;margin:-4px 0 10px}
.ig-strip{display:flex;gap:14px;overflow-x:auto;padding:2px 2px 12px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch}
.ig-strip::-webkit-scrollbar{height:6px}
.ig-strip::-webkit-scrollbar-thumb{background:rgba(43,37,32,.2);border-radius:3px}
.ig-strip .ig-item{flex:0 0 auto;scroll-snap-align:start}
.ig-strip .instagram-media{margin:0!important;min-width:326px!important;width:326px!important;max-width:326px!important}
.hdr-nav{display:flex;gap:3px;min-width:0;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.hdr-nav::-webkit-scrollbar{display:none}
.hdr-nav a{flex:0 0 auto;padding:8px 14px;border-radius:999px;font-family:'Inter',sans-serif;font-size:12.5px;font-weight:600;color:#7C7264;text-decoration:none;white-space:nowrap;transition:all .2s}
.hdr-nav a:hover{background:rgba(192,112,46,.1);color:#9C521B}
.hdr-nav a.active{background:#C0702E;color:#fff;box-shadow:0 4px 12px rgba(192,112,46,.3)}
main{max-width:820px;margin:0 auto;padding:clamp(24px,5vw,56px) clamp(16px,5vw,32px)}
.crumbs{font-size:12px;color:#7C7264;margin-bottom:14px}
.crumbs a{color:#7C7264;text-decoration:none}
h1{font-family:'Playfair Display',serif;font-weight:800;font-size:clamp(28px,5vw,44px);color:#33271B;line-height:1.1;margin-bottom:10px}
.lede{font-size:14px;color:#9C521B;font-weight:600;margin-bottom:22px}
h2{font-family:'Playfair Display',serif;font-weight:700;font-size:24px;color:#33271B;margin:30px 0 12px}
.content p{margin-bottom:16px;font-size:16.5px;color:#4A4136}
/* location hero */
.loc-hero{position:relative;color:#fff;padding:clamp(36px,7vw,76px) clamp(16px,5vw,32px) clamp(30px,5vw,54px);overflow:hidden}
.loc-hero::after{content:"";position:absolute;inset:0;background:radial-gradient(120% 80% at 80% 0%,rgba(255,255,255,.18),transparent 55%),linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.26));pointer-events:none}
.loc-hero-inner{position:relative;z-index:1;max-width:820px;margin:0 auto}
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
.pack-btn.on{background:#C0702E;border-color:#C0702E;color:#fff}
.pack-grp-title{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#9C521B;font-weight:700;margin:18px 0 8px}
.pack-row{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid rgba(43,37,32,.1);border-radius:12px;padding:11px 14px;margin-bottom:8px;box-shadow:0 2px 10px rgba(58,42,28,.04)}
.pack-row .pk-main{flex:1;min-width:0}
.pack-row .pk-name{font-size:14.5px;color:#2B2620;font-weight:500}
.pack-row .pk-note{font-size:11.5px;color:#7C7264;margin-top:2px}
.pack-row .pk-qty{font-family:'Space Mono',monospace;font-size:11px;font-weight:700;color:#9C521B;background:rgba(192,112,46,.12);padding:3px 9px;border-radius:999px;white-space:nowrap}
.pk-amz{padding:6px 12px;border-radius:9px;background:rgba(255,153,0,.14);border:1px solid rgba(255,153,0,.4);color:#C56A00;font-size:11.5px;font-weight:700;text-decoration:none;white-space:nowrap}
.pk-amz:hover{background:rgba(255,153,0,.26)}
.disc-note{font-size:11px;color:#7C7264;margin-top:10px}
.facts{background:#fff;border:1px solid rgba(43,37,32,.1);border-radius:16px;padding:20px 22px;margin:26px 0;box-shadow:0 2px 12px rgba(58,42,28,.06)}
.facts h2{margin-top:0;font-size:18px}
.facts ul{list-style:none}
.facts li{padding:6px 0;border-bottom:1px solid rgba(43,37,32,.06);font-size:14px}
.facts li:last-child{border:0}
.facts strong{color:#33271B}
.cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.btn{display:inline-block;padding:11px 18px;border-radius:12px;background:#C0702E;color:#fff;text-decoration:none;font-weight:700;font-size:14px}
.btn.alt{background:transparent;color:#9C521B;border:1px solid rgba(192,112,46,.4)}
.related{margin-top:34px}
.cards{display:grid;grid-template-columns:1fr;gap:12px;margin-top:8px}
@media(min-width:620px){.cards{grid-template-columns:1fr 1fr}}
.card{display:flex;gap:12px;align-items:flex-start;background:#fff;border:1px solid rgba(43,37,32,.1);border-radius:14px;padding:14px 16px;text-decoration:none;color:inherit;box-shadow:0 2px 12px rgba(58,42,28,.05);transition:transform .2s,box-shadow .2s}
.card:hover{transform:translateY(-3px);box-shadow:0 14px 30px rgba(58,42,28,.14)}
.card-emoji{font-size:26px;line-height:1.2}
.card-body{display:flex;flex-direction:column;min-width:0}
.card-body strong{font-family:'Playfair Display',serif;font-size:17px;color:#33271B}
.card-body em{font-style:normal;font-size:11.5px;color:#9C521B;font-weight:600;margin:2px 0 5px}
.card-body span{font-size:13px;color:#7C7264}
.back{margin-top:26px;font-weight:700}
.ftr{max-width:820px;margin:0 auto;padding:30px clamp(16px,5vw,32px) 48px;border-top:1px solid rgba(43,37,32,.1);text-align:center;color:#7C7264;font-size:12.5px}
.ftr .soc a{margin:0 7px;font-weight:700;color:#9C521B;text-decoration:none}
.ftr .links{margin:12px 0}
.ftr .links a{margin:0 8px;color:#7C7264;text-decoration:none;font-size:12px}
.ftr .disc{margin-top:12px;font-size:11px;opacity:.85}
/* premium brand layer */
.ftr-tagline{font-family:'Playfair Display',serif;font-style:italic;font-size:17px;color:#9C521B;margin-bottom:14px}
.loc-hero::before{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.14) 46%,transparent 62%);background-size:240% 100%;animation:heroSweep 9s ease-in-out infinite;pointer-events:none}
@keyframes heroSweep{0%,100%{background-position:110% 0}50%{background-position:-10% 0}}
.loc-hero h1::after{content:"";display:block;width:52px;height:3px;margin-top:12px;background:linear-gradient(90deg,#E9B978,rgba(233,185,120,0))}
.hdr-nav a.shopnav{color:#9C521B;font-weight:700}
/* shop CTA band — living night sky */
.shopcta{position:relative;overflow:hidden;margin:34px 0;border-radius:18px;padding:34px 26px;text-align:center;color:#fff;background:linear-gradient(180deg,#14102A 0%,#39295A 55%,#8B4E63 90%)}
.shopcta .stars,.shopcta .stars2{content:"";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(1.6px 1.6px at 12% 28%,#fff,transparent),radial-gradient(1.2px 1.2px at 32% 14%,#fff,transparent),radial-gradient(1.6px 1.6px at 54% 34%,#fff,transparent),radial-gradient(1.2px 1.2px at 71% 18%,#fff,transparent),radial-gradient(1.6px 1.6px at 88% 30%,#fff,transparent),radial-gradient(1px 1px at 44% 52%,#fff,transparent);animation:ctaTwinkle 4.5s ease-in-out infinite}
.shopcta .stars2{background-image:radial-gradient(1.2px 1.2px at 22% 44%,#FFE9C4,transparent),radial-gradient(1.5px 1.5px at 62% 12%,#FFE9C4,transparent),radial-gradient(1px 1px at 80% 48%,#fff,transparent),radial-gradient(1.4px 1.4px at 8% 12%,#fff,transparent);animation-delay:2.2s}
@keyframes ctaTwinkle{0%,100%{opacity:.9}50%{opacity:.3}}
.shopcta .shoot{position:absolute;top:16%;left:-12%;width:110px;height:1.5px;background:linear-gradient(90deg,transparent,#FFF6DF);border-radius:2px;transform:rotate(9deg);animation:ctaShoot 7.5s ease-in infinite;pointer-events:none}
@keyframes ctaShoot{0%,64%{left:-12%;opacity:0}68%{opacity:1}78%,100%{left:104%;opacity:0}}
.shopcta-eyebrow{position:relative;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:3.5px;text-transform:uppercase;color:#E9B978;margin-bottom:10px}
.shopcta h2{position:relative;font-family:'Playfair Display',serif;font-weight:900;font-size:clamp(24px,4.4vw,36px);color:#fff;margin:0 0 8px;line-height:1.12}
.shopcta h2 em{font-style:italic;color:#E9B978}
.shopcta p{position:relative;color:rgba(255,255,255,.85);font-size:14.5px;max-width:460px;margin:0 auto 18px}
.shopcta .btn{position:relative;background:#fff;color:#2A2016;border-radius:999px;padding:12px 26px}
.shopcta .btn:hover{background:#E9B978}
@media(prefers-reduced-motion:reduce){.loc-hero::before,.shopcta .stars,.shopcta .stars2,.shopcta .shoot{animation:none}}
`;

function footerHtml() {
  const soc = ['instagram', 'tiktok', 'youtube'].filter(k => social[k]).map(k => `<a href="${esc(social[k])}" target="_blank" rel="noopener">${k[0].toUpperCase() + k.slice(1)}</a>`).join('');
  return `<div class="ftr-tagline">${esc(TAGLINE)}</div>
  <div class="soc">${soc}</div>
  <div class="links"><a href="/camping/">Camping in UAE</a> · <a href="/camping-near-dubai/">Camping near Dubai</a> · <a href="/desert-camping-beginners/">Camping for beginners</a> · <a href="/secluded-camping/">Secluded camping</a> · <a href="/wadis/">Best wadis</a> · <a href="/snorkeling/">Snorkeling</a> · <a href="/mountain-escapes/">Mountain escapes</a> · <a href="/hatta-guide/">Hatta guide</a> · <a href="/best-beaches/">Best beaches</a> · <a href="/desert-safari/">Desert safari</a> · <a href="/family-friendly-outdoors/">Family-friendly</a> · <a href="/outdoor-things-to-do/">Things to do</a> · <a href="/stargazing/">Milky Way / stargazing</a> · <a href="/about/">About us</a> · <a href="/">Map &amp; planner</a></div>
  <div>© ${new Date().getFullYear()} Sahra &amp; Beyond · UAE Desert &amp; Outdoor Planner · ${LAUNCHED ? '<a href="/shop/" style="color:#9C521B;font-weight:600;text-decoration:none">Shop the tees</a>' : '<a href="/#join" style="color:#9C521B;font-weight:600;text-decoration:none">Join the waitlist</a>'}</div>
  <div class="disc">${esc(disclosure)}</div>`;
}

function shell({ title, desc, canonical, jsonld, bodyHtml, image, activeNav = 'discover' }) {
  const ogImg = image || `${SITE}/icon-512.png`;
  const nav = (href, label, key) => `<a href="${href}"${activeNav === key ? ' class="active"' : ''}>${label}</a>`;
  const navHtml = nav('/', 'Home', 'discover') + (LAUNCHED ? nav('/shop/', 'Shop', 'shop') : '') + nav('/about/', 'About us', 'about');
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
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>${CSS}</style>
</head>
<body>
<header class="hdr"><a class="brand" href="/"><img src="/logo/Sahra_and_Beyond_Emblem.svg" alt="Sahra &amp; Beyond" width="34" height="34"><span class="brand-text"><span class="brand-sahra">Sahra</span><span class="brand-beyond">&amp; Beyond</span></span></a><nav class="hdr-nav">${navHtml}</nav></header>
${bodyHtml}
<footer class="ftr">${footerHtml()}</footer>
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
  return `<a class="card" href="/locations/${l.id}/"><span class="card-emoji">${l.emoji || '📍'}</span><span class="card-body"><strong>${esc(l.name)}</strong><em>${esc(l.emirate)} · ${esc(l.category)}</em><span>${esc(l.desc)}</span></span></a>`;
}

// ---- per-location pages ----
locations.forEach(l => {
  const canonical = `${SITE}/locations/${l.id}/`;
  const title = `${l.name}: ${l.category} in ${l.emirate}, UAE | Sahra & Beyond`;
  const desc = metaDesc(l.desc);
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
  <section class="loc-hero" style="background:${CAT_BG[l.category] || CAT_BG.Dunes}">
    <div class="loc-hero-inner">
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
    <div class="content">${paras(l.body || l.desc)}</div>
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
    ${shopBlock(l)}
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
      <p class="disc-note">${esc(disclosure)}</p>
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
    var PACK=${JSON.stringify(packItems)},TAG=${JSON.stringify(AMAZON_TAG)},state={p:4,ov:false};
    function qy(t){if(!t)return '';return String(t).replace(/\\{water\\}/g,4*state.p).replace(/\\{half\\}/g,Math.max(1,Math.ceil(state.p/2))).replace(/\\{p\\}/g,state.p);}
    function amzLink(it){var u=it.amazon;if(u){return u+(u.indexOf('tag=')!==-1?'':(u.indexOf('?')!==-1?'&':'?')+'tag='+TAG);}return it.query?'https://www.amazon.ae/s?k='+encodeURIComponent(it.query)+'&tag='+TAG:'';}
    function he(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
    function render(){var el=document.getElementById('pack-list');if(!el)return;var items=PACK.filter(function(it){return !it.overnight||state.ov;});var groups=[],idx={};items.forEach(function(it){if(!(it.group in idx)){idx[it.group]=groups.length;groups.push({h:it.group,items:[]});}groups[idx[it.group]].items.push(it);});el.innerHTML=groups.map(function(g){return '<div class="pack-grp-title">'+he(g.h)+'</div>'+g.items.map(function(it){var q=qy(it.qty);return '<div class="pack-row"><div class="pk-main"><div class="pk-name">'+he(it.name)+'</div>'+(it.note?'<div class="pk-note">'+he(it.note)+'</div>':'')+'</div>'+(q?'<span class="pk-qty">'+he(q)+'</span>':'')+((it.amazon||it.query)?'<a class="pk-amz" href="'+amzLink(it)+'" target="_blank" rel="noopener sponsored">'+(it.amazon?'Buy on Amazon':'Amazon')+'</a>':'')+'</div>';}).join('');}).join('');}
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
    // Affiliate click tracking → GA4.
    document.addEventListener('click',function(e){
      var a=e.target.closest&&e.target.closest('a.pk-amz, a[rel~="sponsored"]');
      if(a&&window.gtag){gtag('event','affiliate_click',{link_url:a.href,store:/amazon/i.test(a.href)?'amazon':'other',location:${JSON.stringify(l.name)}});}
    },true);
  })();
  </script>`;
  write(`locations/${l.id}/index.html`, shell({ title, desc, canonical, jsonld, bodyHtml: body, image: ogImage }));
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
    title: 'Best Place to View the Milky Way Galaxy in the UAE | Sahra & Beyond',
    desc: 'Where to see the Milky Way in the UAE — the darkest desert skies for stargazing and astrophotography, with GPS and the best months to go.',
    pick: ['al-quaa-desert', 'crescent-moon-lake', 'desert-camping-lake-view', 'mleiha-desert'].map(id => locations.find(l => l.id === id)).filter(Boolean),
    intro: "Want to know the best place to view the Milky Way galaxy in the UAE? It comes down to one thing: darkness. Escape the city glow and the desert delivers some of the clearest night skies in the region, where the Milky Way's core is bright enough to photograph — and on the darkest nights, to cast a faint shadow.\n\nThese are the spots we recommend for stargazing and astrophotography, ranked by how dark and accessible they are. Aim for clear, moonless nights between October and March, bring warm layers and a red-light torch, and give your eyes 20 minutes to adjust."
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
  const body = `
  <main>
    <nav class="crumbs"><a href="/">Home</a> &rsaquo; <span>${esc(L.h1)}</span></nav>
    <h1>${esc(L.h1)}</h1>
    <div class="content">${paras(L.intro)}</div>
    ${L.pick.length ? `<h2>Our top picks</h2><div class="cards">${L.pick.map(locCard).join('')}</div>` : ''}
    ${sectionsHtml}
    ${faqHtml}
    ${shopBlock(null)}
    ${newsletterBlock()}
    <p class="back"><a href="/">Back to Sahra &amp; Beyond &rarr;</a></p>
  </main>`;
  write(`${L.slug}/index.html`, shell({ title: L.title, desc: L.desc, canonical, jsonld, bodyHtml: body }));
});

// ---- About page ----
(function () {
  const canonical = `${SITE}/about/`;
  const title = 'About Sahra & Beyond — Discover the Wild Side of the UAE';
  const desc = 'The story behind Sahra & Beyond — a UAE outdoor adventure guide inspired by the unique landscapes of the Emirates, built to help you discover the wild side of the UAE.';
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
  <section class="loc-hero" style="background:linear-gradient(160deg,#14102A 0%,#39295A 40%,#7A4F63 72%,#C0702E 100%)">
    <div class="stars" style="position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(1.6px 1.6px at 14% 24%,#fff,transparent),radial-gradient(1.2px 1.2px at 36% 12%,#fff,transparent),radial-gradient(1.6px 1.6px at 58% 30%,#fff,transparent),radial-gradient(1.2px 1.2px at 76% 16%,#FFE9C4,transparent),radial-gradient(1.6px 1.6px at 90% 34%,#fff,transparent);animation:ctaTwinkle 4.5s ease-in-out infinite"></div>
    <div class="loc-hero-inner">
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
if (LAUNCHED) (function () {
  try {
    let html = fs.readFileSync(path.join(ROOT, 'shop-preview.html'), 'utf8');
    const canonical = `${SITE}/shop/`;
    const title = 'Shop UAE-Inspired Tees — Wear the Wild Side of the UAE | Sahra & Beyond';
    const desc = 'Original heavyweight organic-cotton tees inspired by real UAE places — the Milky Way over Al Quaa, the dunes of Liwa and the Hajar Mountains. Wear the wild side of the UAE.';
    const prod = (name, img, d) => ({ "@type": "Product", "name": name, "image": SITE + img, "description": d, "brand": { "@type": "Brand", "name": "Sahra & Beyond" }, "offers": { "@type": "Offer", "priceCurrency": "AED", "price": "149", "availability": "https://schema.org/InStock", "url": canonical } });
    const jsonld = [
      { "@context": "https://schema.org", "@type": "WebPage", "name": title, "description": desc, "url": canonical },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/" },
        { "@type": "ListItem", "position": 2, "name": "Shop", "item": canonical }
      ] },
      { "@context": "https://schema.org", "@type": "ItemList", "itemListElement": [
        { "@type": "ListItem", "position": 1, "item": prod('Al Quaa Galaxy Tee', '/shirts/design-black-front.jpg', 'The Milky Way over Al Quaa — the darkest sky in the Emirates. Heavyweight organic cotton.') },
        { "@type": "ListItem", "position": 2, "item": prod('Liwa Dune Tee', '/shirts/design-beige-front.jpg', 'A tonal embroidered sun setting over the dune ridges of Liwa. Heavyweight organic cotton.') },
        { "@type": "ListItem", "position": 3, "item": prod('Hajar Mountains Tee', '/shirts/design-taupe-front.jpg', 'A topographic line drawing of the Hajar peaks. Organic cotton, made to layer.') }
      ] }
    ];
    const meta = `\n<meta name="description" content="${esc(desc)}">\n<link rel="canonical" href="${canonical}">\n<meta name="theme-color" content="#14102A">\n<meta property="og:type" content="website">\n<meta property="og:title" content="${esc(title)}">\n<meta property="og:description" content="${esc(desc)}">\n<meta property="og:url" content="${canonical}">\n<meta property="og:image" content="${SITE}/shirts/design-black-front.jpg">\n<meta property="og:site_name" content="Sahra & Beyond">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="${esc(title)}">\n<meta name="twitter:description" content="${esc(desc)}">\n<meta name="twitter:image" content="${SITE}/shirts/design-black-front.jpg">\n<script type="application/ld+json">${JSON.stringify(jsonld)}</script>`;
    html = html.replace(/<meta name="robots"[^>]*><!--[^>]*-->\n?/, '');
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>` + meta);
    html = html.replace(/(['"])shirts\//g, '$1/shirts/');
    html = html.replace('<a class="logo" href="#">', '<a class="logo" href="/">');
    html = html.replace('<div class="nav-links"><a href="#">Shop</a><a href="#">Places</a><a href="#">About</a>', '<div class="nav-links"><a href="/shop/">Shop</a><a href="/">Places</a><a href="/about/">About</a>');
    html = html.replace(/<footer>© \d{4} Sahra &amp; Beyond · Made in the UAE<\/footer>/, `<footer>${esc(TAGLINE)} · © ${new Date().getFullYear()} Sahra &amp; Beyond · Made in the UAE</footer>`);
    write('shop/index.html', html);
  } catch (e) { console.log('  ! shop page skipped: ' + e.message); }
})();

// ---- sitemap ----
const buildDate = new Date().toISOString().slice(0, 10);
function locMtime(id) { try { return fs.statSync(path.join(locDir, id + '.json')).mtime.toISOString().slice(0, 10); } catch (e) { return buildDate; } }
const entries = [{ u: `${SITE}/`, m: buildDate, p: '1.0' }]
  .concat(LAUNCHED ? [{ u: `${SITE}/shop/`, m: buildDate, p: '0.9' }] : [])
  .concat([{ u: `${SITE}/about/`, m: buildDate, p: '0.6' }])
  .concat(LANDINGS.map(L => ({ u: `${SITE}/${L.slug}/`, m: buildDate, p: '0.8' })))
  .concat(locations.map(l => ({ u: `${SITE}/locations/${l.id}/`, m: locMtime(l.id), p: '0.8' })));
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
  + entries.map(e => `  <url><loc>${e.u}</loc><lastmod>${e.m}</lastmod><priority>${e.p}</priority></url>`).join('\n')
  + `\n</urlset>\n`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);
console.log('  ✓ sitemap.xml (' + entries.length + ' urls)');

// ---- content feed for the native Android app (one request → all content) ----
const feed = {
  updated: new Date().toISOString(),
  site: SITE,
  amazonTag: AMAZON_TAG,
  weatherKey: WEATHER_KEY,
  social: settings.social || {},
  locations: locations.map(l => Object.assign({}, l, { url: SITE + '/locations/' + l.id + '/' })),
  packing: PACKING
};
fs.writeFileSync(path.join(ROOT, 'feed.json'), JSON.stringify(feed));
console.log('  ✓ feed.json (' + locations.length + ' locations)');

console.log('Build complete: ' + locations.length + ' locations, ' + LANDINGS.length + ' landing pages.');
// end of build

