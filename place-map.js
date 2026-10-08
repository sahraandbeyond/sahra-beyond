/* ------------------------------------------------------------------------
   The shirt map on the home page (8 Oct 2026, Faheem)
   A web designer and a marketing strategist reviewed where the map should
   live. Faheem chose: a light, drawn map of the UAE replaces the counters and
   the ten place cards in the home page's "Every design starts somewhere real"
   block. No map tiles and no Leaflet: an inline SVG, a few KB, no scroll trap.
   Each pin opens a card with the tee and two links (the tee, the place guide).
   The place guides stay linked from a row of chips under the map. The full
   explorer of every place lives on /places/.

   Data-driven: one pin per place that has a tee (the Regular fit is the
   product link). Sahel pieces are not on the map yet: nothing about them may
   show before the 15 Oct reveal, so they are added after it.
   ------------------------------------------------------------------------ */
const fs = require('fs');
const path = require('path');

const GEO = JSON.parse(fs.readFileSync(path.join(__dirname, 'content/geo/gulf-map.json'), 'utf8'));
const xy = (lat, lng) => [(lng - GEO.lon0) * GEO.kx * GEO.s, (GEO.lat1 - lat) * GEO.s];
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* the home page's own chapter lines for each place: already approved copy */
const LINE = {
  'al-quaa-desert': 'One of the darkest accessible skies in the Emirates.',
  'liwa': 'Where the Empty Quarter begins.',
  'wadi-naqab': 'Red rock, drawn in a single line.'
};
/* hero tiles already on the home page (shirts/hs-<key>-a-720.webp) */
const TILE = { 'al-quaa-desert': 'galaxy', 'liwa': 'eq', 'wadi-naqab': 'hajar' };
/* orientation only: two cities, small and grey */
/* the home page's place and guide links (kept from the 2 Oct SEO block: the home page links every guide) */
const PLACE_LINKS = [["/locations/al-quaa-desert/", "Al Quaa Desert", "Abu Dhabi · Dark sky"], ["/locations/wadi-naqab/", "Wadi Naqab", "RAK · Hajar Mountains"], ["/locations/wadi-showka/", "Wadi Shawka", "RAK · Hajar foothills"], ["/locations/liwa/", "Liwa Dunes", "Abu Dhabi · Desert"], ["/locations/moreeb-dune/", "Moreeb Dune", "Abu Dhabi · Liwa"], ["/locations/empty-quarter/", "Empty Quarter", "Abu Dhabi · Rub' al Khali"], ["/locations/jebel-jais/", "Jebel Jais", "RAK · Mountains"], ["/locations/hajar-mountains/", "Hajar Mountains", "Northern Emirates · Range"], ["/locations/wadi-wurayah/", "Wadi Wurayah", "Fujairah · UNESCO"], ["/locations/khor-fakkan-beach/", "Khor Fakkan Beach", "Sharjah · East coast"]];
const GUIDE_LINKS = [["/stargazing/", "Stargazing in the UAE", "Dark skies · Milky Way"], ["/camping-near-dubai/", "Camping near Dubai", "Desert · Lakes"], ["/wadis/", "Wadis in the UAE", "Hikes · Pools"], ["/best-beaches/", "Best beaches in the UAE", "Coast · Snorkelling"], ["/mountain-escapes/", "Mountain escapes", "Hajar · Jebel Hafeet"], ["/hatta-guide/", "Hatta day trip", "Wadi Hub · Heritage · Dam"], ["/hiking/", "Hiking in the UAE", "Trails · Season · Safety"], ["/fujairah-beaches/", "Fujairah beaches", "East coast · Snorkelling"]];
const CITIES = [['Abu Dhabi', 24.4539, 54.3773], ['Dubai', 25.2048, 55.2708]];

function pinsFrom(root) {
  const loc = id => { try { return JSON.parse(fs.readFileSync(path.join(root, 'content/locations', id + '.json'), 'utf8')); } catch (e) { return null; } };
  const dir = path.join(root, 'content/products');
  const out = [], seen = {};
  fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().forEach(f => {
    const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!p.placeSlug || p.fit !== 'regular' || seen[p.placeSlug]) return;
    const l = loc(p.placeSlug); if (!l || typeof l.lat !== 'number') return;
    seen[p.placeSlug] = 1;
    out.push({
      id: p.placeSlug, place: p.placeName || l.name, emirate: l.emirate || '', lat: l.lat, lng: l.lng,
      tee: String(p.name || '').replace(/\s+[—-]\s+Regular$/, ''), price: p.price, product: `/products/${p.id}/`,
      guide: `/locations/${p.placeSlug}/`, line: LINE[p.placeSlug] || '', img: TILE[p.placeSlug] ? `/shirts/hs-${TILE[p.placeSlug]}-a-720.webp` : (p.imgFront || '')
    });
  });
  /* west to east, so the cards read like the map */
  return out.sort((a, b) => a.lng - b.lng);
}

function svg(pins) {
  /* frame the UAE: the outline runs x 49..933, y 56..750 in map units */
  const vx = 20, vy = 26, vw = 940, vh = 744;
  const dots = pins.map((p, i) => {
    const [x, y] = xy(p.lat, p.lng); const right = x < 700;
    return `<a class="pm-pin" href="${esc(p.product)}" data-pin="${esc(p.id)}" aria-label="${esc(p.place)}: ${esc(p.tee)}" style="--i:${i}">
      <circle class="pm-hit" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="44"/>
      <circle class="pm-ring" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="22"/>
      <circle class="pm-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11"/>
      <text class="pm-lab" x="${(x + (right ? 30 : -30)).toFixed(1)}" y="${(y + 8).toFixed(1)}" text-anchor="${right ? 'start' : 'end'}">${esc(p.place)}</text></a>`;
  }).join('');
  const cities = CITIES.map(([n, la, lo]) => { const [x, y] = xy(la, lo); return `<circle class="pm-city" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5"/><text class="pm-cityl" x="${(x - 12).toFixed(1)}" y="${(y - 12).toFixed(1)}" text-anchor="end">${n}</text>`; }).join('');
  return `<svg viewBox="${vx} ${vy} ${vw} ${vh}" role="group" aria-label="Map of the UAE with the place behind each design">
    <path class="pm-land2" d="${GEO.SA}${GEO.OM}${GEO.QA}"/><path class="pm-land" d="${GEO.AE}"/>${cities}${dots}</svg>`;
}

const CSS = `
#s-places .pm{display:grid;gap:22px;margin:26px 0 0}
@media(min-width:900px){#s-places .pm{grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);align-items:center;gap:34px}}
.pm-map{margin:0;border-radius:20px;overflow:hidden;background:rgba(12,10,26,.62);border:1px solid rgba(243,235,221,.16);box-shadow:0 24px 60px rgba(0,0,0,.35);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.pm-map svg{display:block;width:100%;height:auto}
.pm-land2{fill:rgba(243,235,221,.07);stroke:rgba(243,235,221,.16);stroke-width:1.5}
.pm-land{fill:rgba(233,185,120,.22);stroke:rgba(242,201,140,.7);stroke-width:2}
.pm-city{fill:rgba(243,235,221,.55)}
.pm-cityl{fill:rgba(243,235,221,.62);font:500 22px 'Jost',system-ui,sans-serif;letter-spacing:.04em}
.pm-pin{cursor:pointer;outline:none}
.pm-hit{fill:transparent}
.pm-ring{fill:none;stroke:#F2C98C;stroke-width:3;opacity:.55;transform-box:fill-box;transform-origin:center;animation:pmPulse 2.6s ease-out infinite;animation-delay:calc(var(--i) * .5s)}
.pm-dot{fill:#F2C98C;stroke:#1A1430;stroke-width:4;transform-box:fill-box;transform-origin:center;transition:transform .25s cubic-bezier(.2,.7,.2,1)}
.pm-lab{fill:#F7EFE2;font:600 30px 'Jost',system-ui,sans-serif;letter-spacing:.02em;paint-order:stroke;stroke:rgba(12,10,26,.75);stroke-width:6px;stroke-linejoin:round}
.pm-pin:hover .pm-dot,.pm-pin:focus-visible .pm-dot,.pm-pin.on .pm-dot{transform:scale(1.45)}
.pm-pin.on .pm-dot{fill:#FFF4E4}
.pm-pin:focus-visible .pm-hit{stroke:#F2C98C;stroke-width:4}
@keyframes pmPulse{0%{transform:scale(.6);opacity:.7}100%{transform:scale(1.9);opacity:0}}
.pm-cards{display:grid;gap:14px}
.pm-card{display:grid;grid-template-columns:96px minmax(0,1fr);gap:14px;align-items:center;padding:14px;border-radius:18px;background:rgba(12,10,26,.72);border:1px solid rgba(243,235,221,.18);color:#F7EFE2;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.pm-card img{width:96px;height:120px;object-fit:cover;border-radius:12px;background:#2A2440}
.pm-card .pm-k{display:block;font:700 11px 'Space Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:#F2C98C}
.pm-card h3{font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-weight:600;font-size:26px;line-height:1.1;margin:4px 0 4px;color:#FFF8EC}
.pm-card p{margin:0 0 10px;font-size:15px;line-height:1.45;color:rgba(247,239,226,.88)}
.pm-acts{display:flex;flex-wrap:wrap;gap:8px}
.pm-acts a{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:999px;font-weight:600;font-size:14px;text-decoration:none}
.pm-acts .pm-shop{background:#F2C98C;color:#1A1430}
.pm-acts .pm-guide{border:1px solid rgba(243,235,221,.4);color:#F7EFE2}
.pm-js .pm-card{display:none}.pm-js .pm-card.on{display:grid;animation:pmIn .35s ease both}
@keyframes pmIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.pm-hint{margin:0;font-size:14px;color:rgba(247,239,226,.78)}
.pm-chips{display:flex;gap:8px;overflow-x:auto;padding:4px 2px 10px;margin:22px 0 0;scrollbar-width:thin;-webkit-overflow-scrolling:touch}
.pm-chips a{flex:0 0 auto;display:inline-flex;flex-direction:column;justify-content:center;min-height:52px;padding:6px 14px;border-radius:14px;border:1px solid rgba(243,235,221,.22);background:rgba(12,10,26,.55);color:#F7EFE2;text-decoration:none;white-space:nowrap}
.pm-chips a b{font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;font-weight:600;line-height:1.1}
.pm-chips a span{font:500 10.5px 'Space Mono',monospace;letter-spacing:.1em;text-transform:uppercase;color:rgba(243,235,221,.7)}
.pm-chips a:hover,.pm-chips a:focus-visible{border-color:#F2C98C}
.pm-more{display:inline-block;margin:6px 0 0;color:#F2C98C;font-weight:600;font-size:15px}
@media(max-width:600px){.pm-lab{font-size:40px;stroke-width:8px}.pm-cityl{font-size:28px}.pm-dot{r:14px}.pm-chips a b{font-size:17px}.pm-card{grid-template-columns:80px minmax(0,1fr)}.pm-card img{width:80px;height:100px}.pm-card h3{font-size:23px}}
@media(prefers-reduced-motion:reduce){.pm-ring{animation:none;opacity:.35}.pm-js .pm-card.on{animation:none}}
`;

const JS = `(function(){var w=document.querySelector('#s-places .pm');if(!w)return;w.classList.add('pm-js');
var pins=[].slice.call(w.querySelectorAll('.pm-pin')),cards=[].slice.call(w.querySelectorAll('.pm-card'));
function on(id,src){pins.forEach(function(p){p.classList.toggle('on',p.dataset.pin===id);});cards.forEach(function(c){c.classList.toggle('on',c.dataset.pin===id);});
 if(src&&window.gtag)gtag('event','map_pin_click',{place:id,surface:'home'});}
pins.forEach(function(p){p.addEventListener('click',function(e){e.preventDefault();on(p.dataset.pin,1);});
 p.addEventListener('keydown',function(e){if(e.key===' '){e.preventDefault();on(p.dataset.pin,1);}});
 if(matchMedia('(hover: hover)').matches)p.addEventListener('mouseenter',function(){on(p.dataset.pin,0);});});
cards.forEach(function(c){c.addEventListener('click',function(e){var a=e.target.closest('a');if(a&&window.gtag)gtag('event','map_card_cta',{place:c.dataset.pin,cta:a.classList.contains('pm-shop')?'shop':'guide',surface:'home'});});});
if(pins[0])on(pins[0].dataset.pin,0);
if('IntersectionObserver' in window&&window.gtag){var io=new IntersectionObserver(function(es){if(es[0].isIntersecting){gtag('event','map_view',{surface:'home'});io.disconnect();}},{threshold:.5});io.observe(w);}
})();`;

/* the block that sits between <!--PLACEMAP:START--> and <!--PLACEMAP:END--> in index.html */
function homeBlock(root) {
  const placeLinks = PLACE_LINKS, guideLinks = GUIDE_LINKS;
  const pins = pinsFrom(root);
  const cards = pins.map(p => `<article class="pm-card" data-pin="${esc(p.id)}"><img src="${esc(p.img)}" alt="${esc(p.tee)} tee" width="96" height="120" loading="lazy" decoding="async"><div><span class="pm-k">${esc(p.place)}${p.emirate ? ' · ' + esc(p.emirate) : ''}</span><h3>${esc(p.tee)}</h3><p>${esc(p.line)} AED ${esc(p.price)}, Regular or Oversized.</p><div class="pm-acts"><a class="pm-shop" href="${esc(p.product)}">Shop the tee</a><a class="pm-guide" href="${esc(p.guide)}">Read the place guide</a></div></div></article>`).join('');
  const chips = placeLinks.map(([href, name, sub]) => `<a href="${esc(href)}"><b>${esc(name)}</b><span>${esc(sub)}</span></a>`).join('');
  return `<style>${CSS}</style>
    <div class="pm rv">
      <figure class="pm-map">${svg(pins)}</figure>
      <div class="pm-cards" aria-live="polite"><p class="pm-hint">${pins.length} designs, ${pins.length} places so far. Tap a pin to see the tee and the place behind it.</p>${cards}</div>
    </div>
    <span class="j-eyebrow rv" style="display:block;margin-top:30px">More places we have explored</span>
    <div class="pm-chips" role="navigation" aria-label="Place guides">${chips}</div>
    <span class="j-eyebrow rv" style="display:block;margin-top:18px">Guides for getting out there</span>
    <div class="pm-chips" role="navigation" aria-label="Guides">${guideLinks.map(([href, name, sub]) => `<a href="${esc(href)}"><b>${esc(name)}</b><span>${esc(sub)}</span></a>`).join('')}</div>
    <a class="pm-more" href="/places/">Explore every place on the map &rarr;</a>
    <script>${JS}</script>`;
}

module.exports = { homeBlock, pinsFrom, xy, GEO };
