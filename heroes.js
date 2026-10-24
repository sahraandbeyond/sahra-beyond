/* ------------------------------------------------------------------------
   Photo heroes for the category, guide and shop pages (23 Oct 2026, Faheem:
   "This banner and all the others without hero banners look really basic.
   There need to be appropriate photo realistic graphics... Each banner needs a
   full professional overhaul!"). Every page that used the plain gradient
   .loc-hero gets a full-bleed photograph from the brand's own library: Faheem's
   product shoots (shirts/hero-*), the place-guide covers (uploads/) and the
   cinematic plates already used on the homepage and /trail/ (journey/plates,
   assets/trail). No mock-ups are used as heroes.
   shell() in build.js calls apply(); the images are resized by
   tools/make-heroes.py into assets/heroes/<key>-1920.webp and -960.webp.
   [source, object-position on desktop, object-position on phones, kicker, layout]
   layout 'split': portrait sources sit in the right 58% on desktop and fade into a dark ground
   ------------------------------------------------------------------------ */
const HERO = {
  'accessories':              ['shirts/tote-band.jpg', '55% 45%', '64% 45%', 'Shop · Accessories'],
  'activewear':               ['assets/trail/hajar-dawn-d.webp', '50% 62%', '46% 60%', 'Sahra Trail · Activewear'],
  'best-beaches':             ['uploads/places/khor-fakkan-beach.jpg', '50% 60%', '35% 60%', 'Guide · Beaches'],
  'camping':                  ['uploads/places/zakher-lake.jpg', '50% 55%', '50% 55%', 'Guide · Camping'],
  'camping-near-dubai':       ['uploads/places/love-lake.jpg', '50% 55%', '40% 55%', 'Guide · Camping'],
  'contact':                  ['shirts/hero-trust.webp', '50% 35%', '70% 35%', 'Sahra & Beyond'],
  'desert-camping-beginners': ['uploads/sahra_and_beyond_widedunes_dji_0457_t24.5s.jpg', '50% 55%', '60% 55%', 'Guide · Desert camping'],
  'desert-safari':            ['uploads/places/big-red.jpg', '50% 60%', '55% 60%', 'Guide · Desert'],
  'desert-t-shirts':          ['uploads/places/moreeb-dune.jpg', '50% 55%', '55% 55%', 'Shop · Desert t-shirts'],
  'fabric':                   ['shirts/hero-fabric.webp', '50% 45%', '48% 45%', 'How we make them'],
  'family-friendly-outdoors': ['uploads/places/al-rafisah-dam.jpg', '50% 55%', '40% 55%', 'Guide · Family days out'],
  'fujairah-beaches':         ['uploads/places/dibba.jpg', '50% 55%', '70% 55%', 'Guide · Fujairah coast'],
  'gifts':                    ['shirts/hero-fits.webp', '50% 35%', '62% 35%', 'Shop · Gifts'],
  'hatta-guide':              ['uploads/places/hatta.jpg', '50% 50%', '45% 50%', 'Guide · Hatta'],
  'hiking':                   ['uploads/places/hajar-mountains.jpg', '50% 50%', '45% 50%', 'Guide · Hiking'],
  'hoodies':                  ['uploads/places/ras-al-khor.jpg', '50% 55%', '50% 55%', 'Sahel · Hoodies'],
  'journal':                  ['uploads/places/liwa.jpg', '50% 55%', '50% 55%', 'Journal'],
  'mountain-escapes':         ['uploads/places/jebel-jais.jpg', '50% 50%', '45% 50%', 'Guide · Mountains'],
  'mountain-t-shirts':        ['journey/plates/wadi-naqab.webp', '50% 45%', '50% 45%', 'Shop · Mountain t-shirts'],
  'national-day':             ['journey/plates/liwa-sunset.webp', '50% 55%', '50% 55%', 'Eid Al Etihad · 2 December'],
  'outdoor-things-to-do':     ['uploads/places/jebel-hafeet.jpg', '50% 55%', '60% 55%', 'Guide · Outdoors'],
  'polos':                    ['shirts/polo-dune-sunset.jpg', '50% 52%', '60% 50%', 'Shop · Polos', 'split'],
  'secluded-camping':         ['uploads/places/empty-quarter.jpg', '50% 55%', '50% 55%', 'Guide · Camping'],
  'size-guide':               ['shirts/hero-making.webp', '50% 35%', '42% 35%', 'Size and fit'],
  'snorkeling':               ['uploads/unsorted-no-geotag_01.webp', '50% 45%', '50% 45%', 'Guide · Snorkelling'],
  'stargazing':               ['journey/plates/alquaa-night.webp', '50% 45%', '35% 45%', 'Guide · Stargazing'],
  't-shirts/oversized':       ['shirts/hero-places.webp', '50% 35%', '72% 35%', 'Shop · Oversized fit'],
  't-shirts/regular':         ['shirts/hero-cloth.webp', '50% 40%', '68% 40%', 'Shop · Regular fit'],
  'wadis':                    ['uploads/places/wadi-wurayah.jpg', '50% 55%', '45% 55%', 'Guide · Wadis']
};
let SIZES = {}; try { SIZES = require('./assets/heroes/sizes.json'); } catch (e) {}
const key = slug => slug.replace(/\//g, '-');
const CSS = `
html body .loc-hero.lh-ph.lh-ph{background:#120E0A!important;min-height:clamp(420px,58vh,620px);display:flex;flex-direction:column;justify-content:flex-end;padding:clamp(28px,4vw,48px) clamp(16px,5vw,48px) clamp(34px,5vw,64px)!important;animation:none!important}
html body .loc-hero.lh-ph.lh-ph::before{display:none!important}
html body .loc-hero.lh-ph.lh-ph::after{background:linear-gradient(180deg,rgba(10,8,6,.40) 0%,rgba(10,8,6,.06) 20%,rgba(10,8,6,.30) 44%,rgba(10,8,6,.70) 70%,rgba(10,8,6,.88) 100%),linear-gradient(90deg,rgba(10,8,6,.55) 0%,rgba(10,8,6,.18) 50%,rgba(10,8,6,0) 75%)!important;z-index:1}
html body .loc-hero.lh-ph.lh-ph .lh-img{position:absolute;inset:0;width:100%;height:100%;max-width:none;object-fit:cover;object-position:var(--lh-pos,50% 50%);z-index:0;transform:scale(1.02);animation:lhIn 1.6s cubic-bezier(.2,.7,.2,1) both}
@keyframes lhIn{from{transform:scale(1.07);opacity:.6}to{transform:scale(1.02);opacity:1}}
html body .loc-hero.lh-ph.lh-ph .dune-far,html body .loc-hero.lh-ph.lh-ph .dune-near,html body .loc-hero.lh-ph.lh-ph .glow,html body .loc-hero.lh-ph.lh-ph .loc-emoji{display:none!important}
html body .loc-hero.lh-ph.lh-ph .grain{opacity:.08}
html body .loc-hero.lh-ph.lh-ph .loc-hero-inner{position:relative;z-index:3;width:100%;max-width:820px;margin:0 auto;padding:0 clamp(0px,2.2vw,32px);text-align:left}
html body .loc-hero.lh-ph.lh-ph .crumbs{margin-bottom:18px}
html body .loc-hero.lh-ph.lh-ph .lh-k{display:block;font:700 12px/1.4 'Space Mono',ui-monospace,monospace;letter-spacing:.18em;text-transform:uppercase;color:#FFE0B0;margin:0 0 12px;text-shadow:0 1px 12px rgba(0,0,0,.7)}
html body .loc-hero.lh-ph.lh-ph h1{font-size:clamp(40px,6.4vw,84px)!important;line-height:1.02!important;letter-spacing:-.01em;max-width:18ch;text-wrap:balance;margin:0 0 14px!important;text-shadow:0 2px 28px rgba(0,0,0,.45)}
html body .loc-hero.lh-ph.lh-ph h1::after{margin-top:18px;width:64px}
html body .loc-hero.lh-ph.lh-ph .lede{font-size:clamp(17px,1.6vw,21px)!important;line-height:1.5;max-width:52ch;margin:0!important;color:rgba(255,255,255,.95)}
@media(min-width:821px){
  html body .loc-hero.lh-ph.lh-ph{padding-bottom:clamp(96px,9vw,120px)!important}
  html body .loc-hero.lh-ph.lh-ph+main{margin-top:-64px;position:relative;z-index:4}
}
@media(min-width:821px){
  html body .loc-hero.lh-ph.lh-ph.lh-split{background:#1C1510!important}
  html body .loc-hero.lh-ph.lh-ph.lh-split .lh-img{left:auto;right:0;width:60%;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 38%);mask-image:linear-gradient(90deg,transparent 0,#000 38%)}
  html body .loc-hero.lh-ph.lh-ph.lh-split::after{background:linear-gradient(180deg,rgba(10,8,6,.25) 0%,rgba(10,8,6,0) 30%,rgba(10,8,6,0) 60%,rgba(10,8,6,.55) 100%)!important}
}
@media(max-width:700px){
  html body .loc-hero.lh-ph.lh-ph .crumbs{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  html body .loc-hero.lh-ph.lh-ph{min-height:max(460px,68svh);padding:20px 16px 30px!important}
  html body .loc-hero.lh-ph.lh-ph .loc-hero-inner{padding:0}
  html body .loc-hero.lh-ph.lh-ph .lh-img{object-position:var(--lh-pos-m,50% 50%)}
  html body .loc-hero.lh-ph.lh-ph h1{font-size:clamp(36px,10.5vw,48px)!important;max-width:none}
  html body .loc-hero.lh-ph.lh-ph .crumbs{margin-bottom:12px}
}
@media(prefers-reduced-motion:reduce){html body .loc-hero.lh-ph.lh-ph .lh-img{animation:none}}
`;
/* turn the plain gradient hero into the photo hero for pages in HERO */
function apply(slug, bodyHtml) {
  const h = HERO[slug]; if (!h || !/<section class="loc-hero"/.test(bodyHtml)) return bodyHtml;
  const k = key(slug);
  const W = SIZES[k] || [1920, 960];
  const img = `<img class="lh-img" src="/assets/heroes/${k}-1920.webp" srcset="/assets/heroes/${k}-960.webp ${W[1]}w, /assets/heroes/${k}-1920.webp ${W[0]}w" sizes="100vw" alt="" fetchpriority="high" decoding="async">`;
  return bodyHtml.replace(/<section class="loc-hero"( style="[^"]*")?>/, (m, st) => {
    const style = (st ? st.slice(8, -1) + ';' : '') + `--lh-pos:${h[1]};--lh-pos-m:${h[2]}`;
    return `<style>${CSS}</style><section class="loc-hero lh-ph${h[4] === 'split' ? ' lh-split' : ''}" style="${style}">${img}`;
  }).replace(/(<h1[^>]*>)([^<]*)<\/h1>/, (m, o, t) => o + t.replace(/\bT-Shirts\b/g, '<span style="white-space:nowrap">T-Shirts</span>') + '</h1>')
    .replace(/(<section class="loc-hero lh-ph[^"]*"[^>]*>(?:(?!<\/section>)[\s\S])*?)(<h1[ >])/, `$1<span class="lh-k">${h[3].replace(/&/g, '&amp;')}</span>$2`);
}
module.exports = { HERO, apply, key };
