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
  'men':                      ['shirts/alquaa-model-dusk.jpg', '50% 30%', '50% 22%', 'Shop · Men', 'split'],
  'women':                    ['shirts/hajar-lake-back-her.jpg', '50% 40%', '50% 30%', 'Shop · Women', 'split'],
  'under-150':                ['shirts/emptyquarter-model-sunset.jpg', '50% 40%', '50% 40%', 'Shop by price', 'split'],
  'mountain-escapes':         ['uploads/places/jebel-jais.jpg', '50% 50%', '45% 50%', 'Guide · Mountains'],
  'mountain-t-shirts':        ['journey/plates/wadi-naqab.webp', '50% 45%', '50% 45%', 'Shop · Mountain t-shirts'],
  'national-day':             ['journey/plates/liwa-sunset.webp', '50% 55%', '50% 55%', 'Eid Al Etihad · 2 December'],
  'outdoor-things-to-do':     ['uploads/places/jebel-hafeet.jpg', '50% 55%', '60% 55%', 'Guide · Outdoors'],
  'polos':                    ['shirts/polo-dune-sunset.jpg', '50% 52%', '60% 50%', 'Shop · Polos', 'split'],
  'secluded-camping':         ['uploads/places/empty-quarter.jpg', '50% 55%', '50% 55%', 'Guide · Camping'],
  'shop':                     ['shirts/hero-print.webp', '50% 45%', '42% 45%', 'Shop · All pieces'],   /* used by the /shop/ hero (shop-preview.html), not apply() */
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

/* ------------------------------------------------------------------------
   THE HOUSE OPENER (Stage 3, 10 Nov 2026; Faheem: "Execute stage 3", after the audit decision "one house look on
   every landing page"). Every listing page opens the same way: a real model photo of a piece sold on that page,
   with the kicker and the title, on a dark ground at every width (his choices: "Photo full width, words over it"
   for phones, "Dark photo, words over it" for desktop). From 600px the one-line description and the breadcrumb join. Photos and crops: content/openers.json, tools/make-open.py.
   The place guides keep the photo hero above: they are reading pages, not shop pages.
   ------------------------------------------------------------------------ */
const fs = require('fs'), path = require('path');
let OPEN = {}; try { OPEN = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'openers.json'), 'utf8')); delete OPEN._; } catch (e) {}
const HOUSE_CSS = `<style>
.ho{position:relative;display:block;overflow:hidden;background:#1C1610;color:#FAF6EF;height:min(104vw,460px)}
.ho picture{position:absolute;inset:0;display:block}
.ho img{position:absolute;inset:0;width:100%;height:100%;max-width:none;object-fit:cover;object-position:var(--ho-m,50% 30%)}
.ho::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(to top,rgba(20,14,8,.86) 0,rgba(20,14,8,.7) 22%,rgba(20,14,8,.48) 38%,rgba(20,14,8,.16) 50%,rgba(20,14,8,0) 60%)}
.ho.ho-top::after{background:linear-gradient(to bottom,rgba(20,14,8,.72) 0,rgba(20,14,8,.5) 26%,rgba(20,14,8,0) 50%)}
.ho-t{position:absolute;left:0;right:0;bottom:0;z-index:1;padding:0 16px 18px}
.ho-top .ho-t{top:0;bottom:auto;padding:18px 16px 0}
html body .ho .ho-k{display:block;margin:0 0 8px;font:400 11px/1.5 'Space Mono',ui-monospace,monospace!important;letter-spacing:.2em!important;text-transform:uppercase;color:#FFF1DC;text-shadow:0 1px 8px rgba(8,6,4,.75)}
html body .ho h1{margin:0;padding:0;max-width:17ch;font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-weight:500;font-size:clamp(26px,7.4vw,32px)!important;line-height:1.08!important;letter-spacing:.2px;color:#FFFFFF;text-wrap:balance;text-shadow:0 1px 18px rgba(8,6,4,.6)}
html body .ho h1::after{display:none}
.ho h1 .nw{white-space:nowrap}
html body .ho .ho-d{display:none;margin:0;font:400 16px/1.5 Jost,system-ui,sans-serif;color:#F6EDE0;max-width:40ch}
html body .ho .ho-c{display:none;margin:0 0 14px;font:400 13px/1.5 Jost,system-ui,sans-serif;color:#F6EDE0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
html body .ho .ho-c a{color:#F6EDE0;text-decoration:none}
html body .ho .ho-c a:hover{text-decoration:underline}
/* Arabic sets wider: full-width lines keep the words in their band, clear of the model */
@media(max-width:599px){html[dir="rtl"] body .ho h1{max-width:none;font-size:clamp(23px,6.6vw,28px)!important;line-height:1.25!important}}
/* From 600px (Faheem, 10 Nov 2026, shown both: "Dark photo, words over it"): the opener stays dark and full width. The
   photo sits in the right-hand part and fades into the dark ground, and the words sit over the ground on the left,
   so they never cross the model. The one-line description and the breadcrumb join here. */
@media(min-width:600px){
  .ho{height:clamp(360px,50vh,480px);background:#1C1510}
  .ho picture{inset-block:0;inset-inline:auto 0;width:62%;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 42%);mask-image:linear-gradient(90deg,transparent 0,#000 42%)}
  html[dir="rtl"] .ho picture{-webkit-mask-image:linear-gradient(270deg,transparent 0,#000 42%);mask-image:linear-gradient(270deg,transparent 0,#000 42%)}
  .ho img{object-position:var(--ho-d,50% 40%)}
  .ho::after,.ho.ho-top::after{background:linear-gradient(180deg,rgba(10,8,6,.22) 0,rgba(10,8,6,0) 30%,rgba(10,8,6,0) 62%,rgba(10,8,6,.45) 100%)}
  /* the words start on the same line as the product grid below (a 1240px column with a 16px gutter) */
  .ho-t,.ho-top .ho-t{top:auto;bottom:0;padding:0 32px clamp(28px,5vh,46px);padding-inline:max(32px,calc((100vw - 1208px)/2)) 32px}
  html body .ho .ho-k{margin-bottom:12px}
  html body .ho h1{max-width:18ch;font-size:clamp(34px,3.6vw,56px)!important;line-height:1.04!important;margin-bottom:12px;text-shadow:0 2px 26px rgba(8,6,4,.5)}
  html[dir="rtl"] body .ho h1{line-height:1.2!important}
  html body .ho .ho-d{display:block;max-width:44ch;font-size:clamp(16px,1.3vw,18px);color:rgba(255,255,255,.94);text-shadow:0 1px 12px rgba(8,6,4,.5)}
  html body .ho .ho-c{display:block;max-width:50%;color:rgba(255,255,255,.82);text-shadow:0 1px 10px rgba(8,6,4,.5)}
  html body .ho .ho-c a{color:rgba(255,255,255,.82)}
  html body .ho .ho-c a:hover{color:#FFFFFF}
}
</style>`;
const escA = s => String(s).replace(/&(?![a-z]+;|#\d+;)/gi, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
/* the opener for one page: h1 is HTML, line and crumbs are optional HTML */
function house(slug, { h1, line = '', crumbs = '', id = 'hoH' }) {
  const o = OPEN[slug]; if (!o) return '';
  const k = key(slug);
  return `${HOUSE_CSS}
  <section class="ho${o.words === 'top' ? ' ho-top' : ''}" aria-labelledby="${id}" style="--ho-m:${o.mpos || '50% 30%'};--ho-d:${o.dpos || '50% 40%'}">
    <picture><source media="(max-width:599px)" srcset="/assets/open/${k}-m-780.webp" width="780" height="936"><img src="/assets/open/${k}-720.webp" srcset="/assets/open/${k}-720.webp 720w, /assets/open/${k}-1076.webp 1076w" sizes="(min-width:600px) 62vw, 100vw" width="1076" height="1345" alt="${escA(o.alt)}" fetchpriority="high" decoding="async"></picture>
    <div class="ho-t">${crumbs ? `<nav class="ho-c" aria-label="Breadcrumb">${crumbs}</nav>` : ''}<p class="ho-k">${escA(o.kicker)}</p><h1 id="${id}">${h1}</h1>${line ? `<p class="ho-d">${line}</p>` : ''}</div>
  </section>`;
}
/* a listing page built with the old .loc-hero block: lift its breadcrumb, title and line into the house opener */
function applyHouse(slug, bodyHtml) {
  const m = /<section class="loc-hero[^"]*"[^>]*>[\s\S]*?<\/section>/.exec(bodyHtml); if (!m) return bodyHtml;
  const sec = m[0];
  const h1 = (/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(sec) || [])[1]; if (!h1) return bodyHtml;
  const crumbs = (/<nav class="crumbs"[^>]*>([\s\S]*?)<\/nav>/.exec(sec) || [])[1] || '';
  const line = (/<p class="lede"[^>]*>([\s\S]*?)<\/p>/.exec(sec) || [])[1] || '';
  return bodyHtml.replace(sec, house(slug, { h1: /</.test(h1) ? h1 : h1.replace(/\bT-Shirts\b/g, '<span style="white-space:nowrap">T-Shirts</span>'), line, crumbs }));
}
const applyOld = apply;
module.exports = { HERO, OPEN, apply: (slug, bodyHtml) => OPEN[slug] ? applyHouse(slug, bodyHtml) : applyOld(slug, bodyHtml), house, key };

