/* Sahra & Beyond — static SEO page generator.
   Reads content/*.json and writes pre-rendered, indexable pages:
   - /locations/<slug>/index.html  (one per location)
   - /camping/, /secluded-camping/, /snorkeling/, /stargazing/  (keyword landing pages)
   - sitemap.xml
   Runs at deploy time on Vercel (build command), so pages stay in sync with the CMS. */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SITE = 'https://sahra-beyond-qo5i.vercel.app';

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

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui,sans-serif;color:#2B2620;background:#FAF6EF;line-height:1.65}
a{color:#9C521B}
.hdr{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px clamp(16px,5vw,48px);border-bottom:1px solid rgba(43,37,32,.1);position:sticky;top:0;background:rgba(250,246,239,.92);backdrop-filter:blur(10px);z-index:5;flex-wrap:wrap}
.brand{display:inline-flex;align-items:center;gap:9px;font-family:'Playfair Display',serif;font-weight:900;letter-spacing:2px;color:#33271B;text-decoration:none;font-size:16px}
.brand img{display:block;width:30px;height:30px}
.hero-img{width:100%;max-height:420px;object-fit:cover;border-radius:18px;margin:0 0 24px}
.ig{margin:28px 0}
.ig .instagram-media{margin:0 auto 14px!important}
.hdr-nav a{margin-left:16px;font-size:13px;font-weight:600;color:#7C7264;text-decoration:none}
.hdr-nav a:hover{color:#C0702E}
main{max-width:820px;margin:0 auto;padding:clamp(24px,5vw,56px) clamp(16px,5vw,32px)}
.crumbs{font-size:12px;color:#7C7264;margin-bottom:14px}
.crumbs a{color:#7C7264;text-decoration:none}
h1{font-family:'Playfair Display',serif;font-weight:800;font-size:clamp(28px,5vw,44px);color:#33271B;line-height:1.1;margin-bottom:10px}
.lede{font-size:14px;color:#9C521B;font-weight:600;margin-bottom:22px}
h2{font-family:'Playfair Display',serif;font-weight:700;font-size:24px;color:#33271B;margin:30px 0 12px}
.content p{margin-bottom:16px;font-size:16.5px;color:#4A4136}
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
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="manifest" href="/manifest.json">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>${CSS}</style>
</head>
<body>
<header class="hdr"><a class="brand" href="/"><img src="/logo/Sahra_and_Beyond_Emblem.svg" alt="" width="30" height="30"> Sahra &amp; Beyond</a><nav class="hdr-nav"><a href="/">Explore</a><a href="/#map">Map</a><a href="/#weather">Weather</a><a href="/#planner">Trip</a></nav></header>
<main>${bodyHtml}</main>
<footer class="ftr">${footerHtml()}</footer>
</body>
</html>`;
}

function igSection(posts) {
  if (!posts || !posts.length) return '';
  const items = posts.map(p => { const u = (typeof p === 'string' ? p : (p && p.url) || '').split('?')[0]; return u ? `<blockquote class="instagram-media" data-instgrm-permalink="${u}" data-instgrm-version="14" style="max-width:540px;width:100%;margin:0 auto 14px"><a href="${u}">View this post on Instagram</a></blockquote>` : ''; }).join('');
  if (!items) return '';
  return `<section class="ig"><h2>On the &rsquo;gram</h2>${items}<script async src="https://www.instagram.com/embed.js"></script></section>`;
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
  const body = `
  <article>
    <nav class="crumbs"><a href="/">Home</a> &rsaquo; ${esc(l.category)} &rsaquo; <span>${esc(l.name)}</span></nav>
    <h1>${esc(l.name)}</h1>
    <p class="lede">${esc(l.emirate)} · ${esc(l.category)} · ${esc(l.difficulty)} · Best ${esc(l.season)}</p>
    ${l.cover ? `<img class="hero-img" src="${esc(l.cover)}" alt="${esc(l.name)}, ${esc(l.category)} in ${esc(l.emirate)}">` : ''}
    <div class="content">${paras(l.body || l.desc)}</div>
    ${igSection(l.igPosts)}
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
        ${hash ? `<a class="btn alt" href="/#${hash}">Plan a trip in the app</a>` : `<a class="btn alt" href="/">Plan a trip in the app</a>`}
      </div>
    </aside>
    ${related.length ? `<section class="related"><h2>More ${esc(l.category)} spots in the UAE</h2><div class="cards">${related.map(locCard).join('')}</div></section>` : ''}
    <p class="back" style="margin-top:26px"><a href="/">← Back to the map &amp; all spots</a></p>
  </article>`;
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
  <div>
    <nav class="crumbs"><a href="/">Home</a> &rsaquo; <span>${esc(L.h1)}</span></nav>
    <h1>${esc(L.h1)}</h1>
    <div class="content">${paras(L.intro)}</div>
    <h2>Our top picks</h2>
    <div class="cards">${L.pick.map(locCard).join('')}</div>
    <p class="back"><a href="/">Explore all spots on the interactive map &amp; trip planner →</a></p>
  </div>`;
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
