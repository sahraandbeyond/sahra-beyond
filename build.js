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
['locations', 'camping', 'secluded-camping', 'snorkeling', 'stargazing'].forEach(d => { try { fs.rmSync(path.join(ROOT, d), { recursive: true, force: true }); } catch (e) {} });

function readJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }
function metaDesc(s) { s = String(s || ''); if (s.length <= 160) return s; const cut = s.slice(0, 157); return cut.slice(0, cut.lastIndexOf(' ')) + '…'; }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function paras(text) { return String(text || '').split(/\n\n+/).filter(Boolean).map(p => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join(''); }
function write(rel, html) { const fp = path.join(ROOT, rel); fs.mkdirSync(path.dirname(fp), { recursive: true }); fs.writeFileSync(fp, html); console.log('  ✓ ' + rel); }

const locDir = path.join(ROOT, 'content/locations');
const locations = (fs.existsSync(locDir) ? fs.readdirSync(locDir) : []).filter(f => f.endsWith('.json')).map(f => readJSON(path.join(locDir, f))).filter(Boolean);
const settings = readJSON(path.join(ROOT, 'content/settings.json')) || {};
const social = settings.social || {};
const disclosure = settings.affiliateDisclosure || 'As an Amazon Associate, Sahra & Beyond earns from qualifying purchases.';
const CAT_HASH = { Camping: 'camping', Wadis: 'wadis', Mountains: 'mountains', Coast: 'coast', Dunes: 'dunes' };
const AMAZON_TAG = settings.amazonTag || 'sahraandbeyon-21';
const WEATHER_KEY = settings.weatherKey || '';
const packingData = readJSON(path.join(ROOT, 'content/packing.json'));
const PACKING = (packingData && Array.isArray(packingData.items)) ? packingData.items : [];
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
.hdr{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px clamp(16px,5vw,48px);border-bottom:1px solid rgba(43,37,32,.1);position:sticky;top:0;background:rgba(250,246,239,.92);backdrop-filter:blur(10px);z-index:5;flex-wrap:wrap}
.brand{display:inline-flex;align-items:center;gap:9px;font-family:'Playfair Display',serif;font-weight:900;letter-spacing:2px;color:#33271B;text-decoration:none;font-size:16px}
.brand img{display:block;width:30px;height:30px}
.hero-img{width:100%;max-height:420px;object-fit:cover;border-radius:18px;margin:0 0 24px}
.ig{margin:30px 0}
.ig-hint{font-size:12px;color:#7C7264;margin:-4px 0 10px}
.ig-strip{display:flex;gap:14px;overflow-x:auto;padding:2px 2px 12px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch}
.ig-strip::-webkit-scrollbar{height:6px}
.ig-strip::-webkit-scrollbar-thumb{background:rgba(43,37,32,.2);border-radius:3px}
.ig-strip .ig-item{flex:0 0 auto;scroll-snap-align:start}
.ig-strip .instagram-media{margin:0!important;min-width:326px!important;width:326px!important;max-width:326px!important}
.hdr-nav a{margin-left:16px;font-size:13px;font-weight:600;color:#7C7264;text-decoration:none}
.hdr-nav a:hover{color:#C0702E}
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
`;

function footerHtml() {
  const soc = ['instagram', 'tiktok', 'youtube'].filter(k => social[k]).map(k => `<a href="${esc(social[k])}" target="_blank" rel="noopener">${k[0].toUpperCase() + k.slice(1)}</a>`).join('');
  return `<div class="soc">${soc}</div>
  <div class="links"><a href="/camping/">Camping in UAE</a> · <a href="/secluded-camping/">Secluded camping</a> · <a href="/snorkeling/">Snorkeling</a> · <a href="/stargazing/">Milky Way / stargazing</a> · <a href="/">Map &amp; planner</a></div>
  <div>© ${new Date().getFullYear()} Sahra &amp; Beyond · UAE Desert &amp; Outdoor Planner</div>
  <div class="disc">${esc(disclosure)}</div>`;
}

function shell({ title, desc, canonical, jsonld, bodyHtml }) {
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
<meta property="og:image" content="${SITE}/icon-512.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Inter:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<link rel="manifest" href="/manifest.json">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>${CSS}</style>
</head>
<body>
<header class="hdr"><a class="brand" href="/"><img src="/logo/Sahra_and_Beyond_Emblem.svg" alt="" width="30" height="30"> Sahra &amp; Beyond</a><nav class="hdr-nav"><a href="/">Explore</a><a href="/#map">Map</a><a href="/#weather">Weather</a><a href="/#planner">Trip</a></nav></header>
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
  const jsonld = [
    {
      "@context": "https://schema.org", "@type": "TouristAttraction",
      "name": l.name, "description": l.desc, "url": canonical,
      "address": { "@type": "PostalAddress", "addressRegion": l.emirate, "addressCountry": "AE" },
      "geo": { "@type": "GeoCoordinates", "latitude": l.lat, "longitude": l.lng },
      "isAccessibleForFree": true, "touristType": "UAE residents, outdoor & adventure"
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/" },
        { "@type": "ListItem", "position": 2, "name": l.name, "item": canonical }
      ]
    }
  ];
  const packItems = packItemsFor(l);
  const body = `
  <section class="loc-hero" style="background:${CAT_BG[l.category] || CAT_BG.Dunes}">
    <div class="loc-hero-inner">
      <nav class="crumbs"><a href="/">Home</a> &rsaquo; ${esc(l.category)} &rsaquo; <span>${esc(l.name)}</span></nav>
      <div class="loc-emoji">${l.emoji || '📍'}</div>
      <h1>${esc(l.name)}</h1>
      <p class="lede">${esc(l.emirate)} · ${esc(l.category)} · ${esc(l.difficulty)} · Best ${esc(l.season)}</p>
      <div class="wx" id="wx" data-lat="${l.lat}" data-lng="${l.lng}">Loading live weather…</div>
    </div>
  </section>
  <main>
    ${l.cover ? `<img class="hero-img" src="${esc(l.cover)}" alt="${esc(l.name)}, ${esc(l.category)} in ${esc(l.emirate)}">` : ''}
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
    ${related.length ? `<section class="related"><h2>More ${esc(l.category)} spots in the UAE</h2><div class="cards">${related.map(locCard).join('')}</div></section>` : ''}
    <p class="back" style="margin-top:26px"><a href="/">&larr; Back to the map &amp; all spots</a></p>
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
  })();
  </script>`;
  write(`locations/${l.id}/index.html`, shell({ title, desc, canonical, jsonld, bodyHtml: body }));
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
  const body = `
  <main>
    <nav class="crumbs"><a href="/">Home</a> &rsaquo; <span>${esc(L.h1)}</span></nav>
    <h1>${esc(L.h1)}</h1>
    <div class="content">${paras(L.intro)}</div>
    <h2>Our top picks</h2>
    <div class="cards">${L.pick.map(locCard).join('')}</div>
    <p class="back"><a href="/">Explore all spots on the interactive map &rarr;</a></p>
  </main>`;
  write(`${L.slug}/index.html`, shell({ title: L.title, desc: L.desc, canonical, jsonld, bodyHtml: body }));
});

// ---- sitemap ----
const urls = [`${SITE}/`]
  .concat(LANDINGS.map(L => `${SITE}/${L.slug}/`))
  .concat(locations.map(l => `${SITE}/locations/${l.id}/`));
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
  + urls.map((u, i) => `  <url><loc>${u}</loc><priority>${i === 0 ? '1.0' : '0.8'}</priority></url>`).join('\n')
  + `\n</urlset>\n`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);
console.log('  ✓ sitemap.xml (' + urls.length + ' urls)');

console.log('Build complete: ' + locations.length + ' locations, ' + LANDINGS.length + ' landing pages.');
