/* ==========================================================================
   Sahel + Sahra Trail: pre-order and launch pages (22 Oct 2026, Faheem)
   ==========================================================================
   Decisions (MASTER_BRIEF Decision Log, 22 Oct 2026):
     - Pre-order opens Wed 28 Oct 08:00 UAE for everyone. 20% off until
       Thu 29 Oct 23:59, stacking with nothing (one Shopify automatic discount,
       "Pre-order price, 20% off", on these 14 products only).
     - Launch Fri 30 Oct at full price. Pre-orders ship from Fri 30 Oct.
     - No strike-through, no compare-at price, no timer, no quantity wording.
     - Images are studio mock-ups, labelled "Mock-up" (13 Oct site rule), until
       the real pieces are photographed. Trail close-ups are real photographs.
     - Trail: no size chart until the pieces are measured; no performance claims.

   STAGES (UTC instants; the UAE is UTC+4 with no DST):
     0  until Wed 28 Oct 08:00 UAE   pages exist but are noindex and unlinked,
                                     with no buy box ("Pre-order opens ...")
     1  Wed 28 Oct 08:00 UAE         pre-order open, 20% wording shown
     2  Fri 30 Oct 00:00 UAE         full price; no "off" / "20%" anywhere
   The stage is decided twice: at BUILD time (Vercel runs `node build.js` on
   every deploy, and .github/workflows/stage-switch.yml redeploys just after each
   boundary, so the page source matches), and in the BROWSER by an inline script
   in the page, so the switch happens to the second for every visitor, with no
   flicker. Elements carry st0 / st1 / st2 / st12 / st01 classes.
   SB_NOW=2026-10-28T05:00:00Z node build.js builds any stage locally;
   ?sbstage=0|1|2 previews a stage in the browser (nothing is stored).

   IN HAND: product pages keep "Pre-order. Ships from Fri 30 Oct." and "You pay
   today and we email you when it ships." until Faheem confirms the pieces are
   in hand. Then set IN_HAND = true below and rebuild: the button says "Add to
   bag" and the pre-order lines go.

   Stock: Shopify is the authority (variants fetched live through
   window.SahraCart.variants). A sold-out size is disabled; no counts are shown.
   ========================================================================== */
'use strict';
const T1 = Date.UTC(2026, 9, 28, 4, 0, 0);   /* Wed 28 Oct 08:00 UAE */
const T2 = Date.UTC(2026, 9, 29, 20, 0, 0);  /* Fri 30 Oct 00:00 UAE */
const IN_HAND = false;
const WA = 'https://wa.me/971585449946';

function now() { const s = process.env.SB_NOW; const t = s ? Date.parse(s) : Date.now(); return isNaN(t) ? Date.now() : t; }
function stageNow() { const n = now(); return n >= T2 ? 2 : n >= T1 ? 1 : 0; }
/* Build-time pruning: wording for a stage that has already passed is left out of the page SOURCE, so from
   Fri 30 Oct no "20%" or "pre-order price" text is left in the HTML at all (and nothing from before Wed 28).
   Wording for a stage still to come stays in, hidden by CSS until the visitor's clock reaches it. */
function inc(cls, html) {
  const b = stageNow();
  const gone = b === 2 ? ['st0', 'st1', 'st01'] : b === 1 ? ['st0'] : [];
  return gone.includes(cls) ? '' : html;
}

/* Inline CSS + script for any page that carries staged content. Put it at the
   very top of the body so data-stage is set before anything below paints. */
function stageHead() {
  const b = stageNow();
  const hideFor = { 0: ['st1', 'st2', 'st12'], 1: ['st0', 'st2'], 2: ['st0', 'st1', 'st01'] };
  const rules = [0, 1, 2].map(k => hideFor[k].map(c => `html[data-stage="${k}"] .${c}`).join(',')).join(',');
  const noJs = hideFor[b].map(c => `html:not([data-stage]) .${c}`).join(',');
  return `<style>${rules},${noJs}{display:none!important}</style>
<script>(function(){var d=document.documentElement,T1=${T1},T2=${T2};function k(){var n=Date.now(),s=n>=T2?2:n>=T1?1:0;try{var m=/[?&]sbstage=([012])/.exec(location.search||'');if(m)s=+m[1];}catch(e){}return s;}
function set(){var s=k();if(d.getAttribute('data-stage')!==String(s)){d.setAttribute('data-stage',String(s));try{document.dispatchEvent(new CustomEvent('sb:stage',{detail:{stage:s}}));}catch(e){}}}
set();if(!/[?&]sbstage=/.test(location.search||'')){var n=Date.now(),nx=n<T1?T1:n<T2?T2:0;if(nx&&nx-n<864e5)setTimeout(set,nx-n+300);}})();</script>`;
}

const SIZES = ['S', 'M', 'L', 'XL'];
const FITS = [['regular', 'Regular'], ['oversized', 'Oversized']];
const mock = (k, alt) => ({ k, alt, mock: true });
const real = (k, alt) => ({ k, alt, mock: false });

/* Story paragraphs: the approved card stories (14 Oct handover; content/sahel-pieces.json). */
const SAHEL = [
  { key: 'khor-fakkan-bay-tee', name: 'Khor Fakkan Bay Tee', colour: 'Jet Set', price: 199, fits: true, img: 'kfb', place: ['Khor Fakkan', 'khor-fakkan-beach'],
    story: "On Sharjah's east coast the Hajar Mountains come straight down to the Gulf of Oman. Khor Fakkan sits in the curve between two headlands, and its name is usually read as 'the creek of the two jaws'. We drew the bay the way it holds you: bare ridges, one sweep of pale sand and a dhow resting on still water.",
    details: ['230gsm cotton', 'DTG printed front and back', 'Our mark embroidered at the back neck', 'Printed neck label'] },
  { key: 'al-hamra-pearl-diver-tee', name: 'Al Hamra Pearl Diver Tee', colour: 'Estate Blue', price: 199, fits: true, img: 'pearl', place: ['Al Jazirah Al Hamra', 'al-jazirah-al-hamra'],
    story: 'Al Jazirah Al Hamra, the Red Island, is a coral-stone pearling town on the Ras Al Khaimah coast, left empty around 1970. Every summer the boats of this coast sailed for the big dive, from June to the end of September. A diver went down on a stone weight, filled his basket with oysters and tugged the rope to be hauled up.',
    details: ['230gsm cotton', 'DTG printed', 'Our mark embroidered at the back neck', 'Printed neck label'] },
  { key: 'al-aqah-reef-tee', name: 'Al Aqah Reef Tee', colour: 'Lagoon', price: 199, fits: true, img: 'reef', place: ['Al Aqah', 'snoopy-island'],
    story: "A small rock island sits a few hundred metres off Al Aqah beach, on Fujairah's northern coast. You don't need a boat: people swim, wade or paddle out to snorkel the reef around it, where turtles, blacktip reef sharks and parrotfish are reported. We drew both worlds at once, the rock above the waterline and the reef beneath it.",
    details: ['230gsm cotton', 'DTG printed front and back', 'Our mark embroidered at the back neck', 'Printed neck label'] },
  { key: 'shams-tee', name: 'Shams Tee', colour: 'Jet Set', price: 139, fits: true, img: 'shams', front: true,
    story: 'Shams is the sun, and in this country it decides everything: when to walk, when to rest, when the dunes turn gold. Sahra &amp; Beyond began with nights in the desert and a camera, waiting for it to rise. Our mark keeps that moment, the sun resting on a dune crest with sahra written beneath it, stitched in sand thread on the left chest.',
    details: ['230gsm cotton', 'Our mark embroidered in sand thread on the left chest', 'Back plain', 'Printed neck label'] },
  { key: 'the-sahel-polo', name: 'The Sahel Polo', colour: 'Black', price: 229, img: null,
    story: "After dark on Dubai Creek, the lights of the abras and dhows spill gold onto black water. This polo is cut from that view: black mercerised piqu&eacute;, three buttons, and our mark in antique-gold thread on the left chest. It's the one piece in Sahel made for evenings.",
    details: ['Black mercerised piqu&eacute;', 'Three buttons', 'Our mark in antique-gold thread on the left chest', 'Printed neck label'] },
  { key: 'barr-and-bahr-hoodie', name: 'Barr &amp; Bahr Hoodie', plain: 'Barr & Bahr Hoodie', colour: 'Salute', price: 229, img: 'barr',
    story: 'In the Gulf, barr is the open land, the desert, and bahr is the sea. People say them together because life here has always moved between the two. The lower back carries that crossing: contour-line dunes running down into a stream and a wave. Above it, one line of sand thread traces the whole UAE coast.',
    details: ['The UAE coastline embroidered in sand thread across the back', 'Lower-back artwork DTG printed', 'Printed neck label'] },
  { key: 'ras-al-khor-hoodie', name: 'Ras Al Khor Hoodie', colour: 'Estate Blue', price: 229, img: 'rakh', place: ['Ras Al Khor', 'ras-al-khor'],
    story: 'Ras Al Khor means the head of the creek: a protected wetland where Dubai Creek ends, in the middle of the city. Low on the back, greater flamingos wade there at dusk, with the mangroves behind them. Above them runs the whole UAE coast in a single line of sand thread, with Sahel written beneath it in Arabic and English.',
    details: ['The UAE coastline embroidered in sand thread across the back', 'Lower-back artwork DTG printed', 'Printed neck label'] }
];
/* Trail features: the /trail/ page's own list (build.js, 8 Oct). No performance claims; "reflective", never "glows". */
const TRAIL = [
  { handle: 'sahra-trail-tee', name: 'Sahra Trail Tee', price: 139,
    lede: 'Trail and run wear from Sahra &amp; Beyond, designed in the UAE. Ocean-inspired print.',
    details: ['Raglan sleeves', 'Mesh side panels', 'Covered seams', 'Reflective Two Ridges symbol under the collar'],
    images: [mock('trail-tee-front', 'Sahra Trail Tee, front'), mock('trail-tee-back', 'Sahra Trail Tee, back'),
      real('trail-chest', 'The Sahra Trail chest lockup, close up'), real('trail-mesh', 'The mesh side panel, close up'), real('trail-backsymbol', 'The Two Ridges symbol, close up')] },
  { handle: 'sahra-trail-2-in-1-short', name: 'Sahra Trail 2-in-1 Short', price: 169,
    lede: 'Trail and run wear from Sahra &amp; Beyond, designed in the UAE. Wave-inspired graphic.',
    details: ['Two shorts in one, with a hidden inner liner', 'Bonded phone pocket in the liner', 'Zip pocket for keys and cards', 'Internal drawcord', 'Reflective Two Ridges symbol'],
    images: [mock('trail-short-front', 'Sahra Trail 2-in-1 Short, front'), mock('trail-short-back', 'Sahra Trail 2-in-1 Short, back'),
      real('trail-shortsymbol', 'The Two Ridges symbol and the name on the leg, close up'), real('trail-shortname', 'SAHRA TRAIL on the leg, close up')] },
  { handle: 'sahra-trail-kit', name: 'Sahra Trail Kit', price: 249, kit: true,
    lede: 'The Sahra Trail Tee and the Sahra Trail 2-in-1 Short together. Tee, AED 139. Short, AED 169. Together, the kit: AED 249.',
    details: ['The Sahra Trail Tee', 'The Sahra Trail 2-in-1 Short', 'Choose a size for each'],
    images: [mock('trail-kit-front', 'Sahra Trail Kit, front: the tee and the 2-in-1 short'), mock('trail-kit-back', 'Sahra Trail Kit, back'),
      real('trail-chest', 'The Sahra Trail chest lockup, close up'), real('trail-shortsymbol', 'The Two Ridges symbol on the short, close up')] }
];

/* the flat list of product pages */
function products() {
  const out = [];
  SAHEL.forEach(p => {
    const plain = p.plain || p.name;
    const images = p.img ? (p.front ? [mock(p.img + '-front', plain + ', front'), mock(p.img + '-back', plain + ', back')] : [mock(p.img + '-back', plain + ', back'), mock(p.img + '-front', plain + ', front')]) : [];
    if (p.fits) FITS.forEach(([f, F]) => out.push({ line: 'sahel', handle: `${p.key}-${f}`, title: `${p.name} &mdash; ${F}`, plain: `${plain} — ${F}`, name: p.name, fit: F,
      sibling: `${p.key}-${f === 'regular' ? 'oversized' : 'regular'}`, siblingFit: f === 'regular' ? 'Oversized' : 'Regular',
      colour: p.colour, price: p.price, story: p.story, details: [`${F} fit`].concat(p.details), images, place: p.place }));
    else out.push({ line: 'sahel', handle: p.key, title: p.name, plain, name: p.name, colour: p.colour, price: p.price, story: p.story, details: p.details, images, place: p.place });
  });
  TRAIL.forEach(p => out.push({ line: 'trail', handle: p.handle, title: p.name, plain: p.name, name: p.name, price: p.price, story: p.lede, details: p.details, images: p.images, kit: !!p.kit }));
  return out;
}
function urls(SITE) { return products().map(p => `${SITE}/products/${p.handle}/`); }

const esc = s => String(s).replace(/&(?![a-z#0-9]+;)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = n => 'AED ' + (Math.round(n * 100) % 100 === 0 ? String(Math.round(n)) : (Math.round(n * 100) / 100).toFixed(2));
const pre = n => Math.round(n * 80) / 100;   /* the 20% pre-order price, to the fils, as Shopify computes it */

function picture(im, eager, sizes) {
  return `<img src="/assets/preorder/${im.k}-720.webp" srcset="/assets/preorder/${im.k}-720.webp 720w, /assets/preorder/${im.k}-1200.webp 1200w" sizes="${sizes || '(max-width: 900px) 100vw, 50vw'}" width="720" height="900" alt="${esc(im.alt)}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;
}
function gallery(p) {
  if (!p.images.length) return `<div class="po-gal"><figure class="po-ph"><div><b>${p.title}</b><span>Photo to follow</span></div></figure></div>`;
  return `<div class="po-gal">${p.images.map((im, i) => `<figure class="po-fig">${picture(im, i === 0)}<figcaption class="${im.mock ? 'po-mock' : 'po-real'}">${im.mock ? 'Mock-up' : 'Close-up of the sample'}</figcaption></figure>`).join('')}</div>`;
}

const CSS = `
.po-page{background:#FAF6EF;color:#2A2016}
.po-wrap{max-width:1180px;margin:0 auto;padding:22px 20px 70px}
.po-crumb{font:12px/1.4 'Space Mono',ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B5B48;margin:0 0 16px}
.po-crumb a{color:inherit}
.po-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:40px;align-items:start}
.po-gal{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.po-fig{position:relative;margin:0;background:#ECE4D6;border-radius:10px;overflow:hidden;aspect-ratio:4/5}
.po-fig:first-child{grid-column:1/-1}
.po-fig img{width:100%;height:100%;object-fit:cover;display:block}
.po-fig figcaption{position:absolute;left:10px;top:10px;font:11px/1 'Space Mono',ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;padding:6px 8px;border-radius:4px;background:rgba(250,246,239,.92);color:#2A2016}
.po-ph{margin:0;aspect-ratio:4/5;border-radius:10px;background:#1C1A18;color:#E9DFCF;display:flex;align-items:center;justify-content:center;text-align:center;grid-column:1/-1}
.po-ph b{display:block;font:600 30px/1.1 'Cormorant Garamond',Georgia,serif;margin-bottom:10px}
.po-ph span{font:12px 'Space Mono',ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase}
.po-buy{position:sticky;top:90px}
.po-eyebrow{font:12px/1.4 'Space Mono',ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;color:#7E4114;margin:0 0 8px}
.po-buy h1{font:600 clamp(32px,4vw,46px)/1.05 'Cormorant Garamond',Georgia,serif;margin:0 0 10px;letter-spacing:-.01em}
.po-line{font:500 16px/1.45 Jost,system-ui,sans-serif;margin:0 0 14px;color:#2A2016}
.po-price{font:600 26px/1.2 Jost,system-ui,sans-serif;margin:0 0 6px}
.po-note{font:15px/1.5 Jost,system-ui,sans-serif;margin:0 0 6px;color:#3E3326}
.po-colour{font:14px/1.5 Jost,system-ui,sans-serif;color:#5C4E3C;margin:0 0 16px}
.po-tabby{font:14px/1.6 Jost,system-ui,sans-serif;margin:10px 0 4px}
.po-tabby img{height:20px;width:auto;display:inline-block;vertical-align:-5px;margin:0 1px 0 5px}
.po-tabby-fine{font:12px/1.5 Jost,system-ui,sans-serif;color:#5C4E3C;margin:0 0 18px}
.po-sizes{border:0;margin:0 0 14px;padding:0}
.po-sizes legend{font:12px 'Space Mono',ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px;color:#3E3326}
.po-sz{display:flex;gap:8px;flex-wrap:wrap}
.po-sz button{min-width:56px;min-height:46px;border:1px solid rgba(42,32,22,.35);background:#FFFDF9;border-radius:8px;font:500 16px Jost,system-ui,sans-serif;color:#2A2016;cursor:pointer}
.po-sz button[aria-pressed="true"]{background:#2A2016;color:#FAF6EF;border-color:#2A2016}
.po-sz button:disabled{opacity:.5;border-style:dashed;cursor:not-allowed}
.po-sz button:focus-visible,.po-go:focus-visible{outline:3px solid #A95A21;outline-offset:2px}
.po-go{width:100%;min-height:54px;border:0;border-radius:999px;background:#2A2016;color:#FAF6EF;font:600 16px Jost,system-ui,sans-serif;letter-spacing:.04em;cursor:pointer;margin:4px 0 10px}
.po-go:disabled{background:#8C8172;cursor:not-allowed}
.po-msg{font:14px/1.5 Jost,system-ui,sans-serif;color:#7E4114;min-height:1.5em;margin:0 0 8px}
.po-closed{font:500 16px/1.5 Jost,system-ui,sans-serif;background:#F0E7D8;border-radius:10px;padding:14px 16px;margin:6px 0 16px}
.po-ask{font:15px/1.5 Jost,system-ui,sans-serif;margin:6px 0 14px}
.po-ask a,.po-small a{color:#7E4114}
.po-small{font:14px/1.55 Jost,system-ui,sans-serif;color:#3E3326;margin:0 0 6px}
.po-sib{font:14px/1.5 Jost,system-ui,sans-serif;margin:0 0 14px}
.po-sib a{color:#7E4114}
.po-story{margin:44px 0 0;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:40px}
.po-story h2{font:600 28px/1.15 'Cormorant Garamond',Georgia,serif;margin:0 0 12px}
.po-story p{font:17px/1.65 Jost,system-ui,sans-serif;margin:0 0 12px;max-width:62ch}
.po-story ul{margin:0;padding-left:20px;font:16px/1.7 Jost,system-ui,sans-serif}
.po-more{margin:46px 0 0}
.po-more h2{font:600 26px/1.2 'Cormorant Garamond',Georgia,serif;margin:0 0 14px}
.po-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}
.po-card{display:block;text-decoration:none;color:#2A2016}
.po-card .po-fig{aspect-ratio:4/5}
.po-card b{display:block;font:500 16px/1.35 Jost,system-ui,sans-serif;margin:8px 0 2px}
.po-card span{font:14px Jost,system-ui,sans-serif;color:#5C4E3C}
@media(max-width:900px){
  .po-grid,.po-story{grid-template-columns:1fr;gap:22px}
  .po-buy{position:static}
  .po-wrap{padding:14px 16px 56px}
  .po-gal{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:8px;margin:0 -16px;padding:0 16px}
  .po-gal .po-fig,.po-gal .po-ph{flex:0 0 86%;scroll-snap-align:center}
}
`;

/* the buy box: static shell; the script below fills sizes from Shopify */
function buyBox(p, stage) {
  const sizeGroup = (id, label) => `<fieldset class="po-sizes" data-group="${id}"><legend>${label}</legend><div class="po-sz">${SIZES.map(s => `<button type="button" data-size="${s}" aria-pressed="false" disabled>${s}</button>`).join('')}</div></fieldset>`;
  const sizes = p.kit ? sizeGroup('tee', 'Tee size') + sizeGroup('short', 'Short size') : sizeGroup('size', 'Size');
  const tab = (price) => `Pay in 4 with<img src="/assets/tabby-badge.svg" alt="Tabby" width="51" height="20">: 4 interest-free payments of ${money(price / 4)}.`;
  return `<div class="po-buy" id="poBuy" data-handle="${p.handle}" data-kit="${p.kit ? 1 : 0}">
      <p class="po-eyebrow">${p.line === 'sahel' ? 'Sahel &middot; The Coast Edition' : 'Sahra Trail'}</p>
      <h1>${p.title}</h1>
      ${IN_HAND ? '' : `<p class="po-line st12">Pre-order. Ships from Fri 30 Oct.</p>` + inc('st0', `<p class="po-line st0">Pre-order opens Wed 28 Oct, 8 AM.</p>`)}
      <p class="po-price">${money(p.price)}</p>
      ${inc('st1', `<p class="po-note st1">Pre-order price, 20% off, until Thu 29 Oct, 23:59. Full price from Fri 30 Oct.</p>`)}
      ${p.colour ? `<p class="po-colour">Colour: ${p.colour}${p.fit ? ` &middot; ${p.fit} fit` : ''}</p>` : ''}
      ${p.sibling ? `<p class="po-sib">Also in <a href="/products/${p.sibling}/">${p.siblingFit} fit &rarr;</a></p>` : ''}
      ${inc('st0', `<div class="st0"><p class="po-closed">Pre-order opens Wed 28 Oct at 8 AM, UAE time. <a href="/sahel/#first-to-know">Join the list</a> and we tell you the evening before.</p></div>`)}
      <div class="st12">
        ${sizes}
        ${p.line === 'trail' ? `<p class="po-ask">Unsure of your size? <a href="${WA}?text=${encodeURIComponent('Hi, a size question about the ' + p.plain + ' before I order.')}" target="_blank" rel="noopener">Message us before you order.</a></p>` : ''}
        <button type="button" class="po-go" id="poGo" disabled>${IN_HAND ? 'Choose a size' : 'Choose a size'}</button>
        <p class="po-msg" id="poMsg" role="status" aria-live="polite"></p>
        ${IN_HAND ? '' : '<p class="po-small">You pay today and we email you when it ships.</p>'}
        ${inc('st1', `<p class="po-tabby sb-ship-uae st1">${tab(pre(p.price))}</p>`)}
        <p class="po-tabby sb-ship-uae st2">${tab(p.price)}</p>
        <p class="po-tabby-fine sb-ship-uae">Pay Later (Short Term Credit) is provided by Tabby LLC. Terms and conditions apply. For more information or to contact us, visit tabby.ai.</p>
      </div>
      <p class="po-small">Free delivery across the UAE. Returns within 14 days of delivery, and free size exchanges within the UAE, subject to stock. You can cancel free of charge any time before your order ships. <a href="/policies.html#returns">Returns and refunds</a></p>
    </div>`;
}

const CLIENT = `<script>
(function(){
  var box=document.getElementById('poBuy');if(!box)return;
  var handle=box.getAttribute('data-handle'),kit=box.getAttribute('data-kit')==='1',go=document.getElementById('poGo'),msg=document.getElementById('poMsg');
  var IN_HAND=${IN_HAND ? 'true' : 'false'},VS=null,sel={};
  function stage(){return +(document.documentElement.getAttribute('data-stage')||0);}
  function label(){return IN_HAND?'Add to bag':'Pre-order';}
  function pick(){
    if(!VS)return null;
    var want=kit?(sel.tee&&sel['short']?sel.tee+' / '+sel['short']:null):sel.size;
    if(!want)return null;
    for(var i=0;i<VS.length;i++)if(VS[i].title===want)return VS[i];
    return null;
  }
  function paint(){
    var v=pick(),ready=kit?(sel.tee&&sel['short']):sel.size;
    if(!VS){go.disabled=true;go.textContent='Loading sizes';return;}
    if(!ready){go.disabled=true;go.textContent=kit?'Choose both sizes':'Choose a size';return;}
    if(!v||!v.availableForSale){go.disabled=true;go.textContent='Sold out in that size';return;}
    go.disabled=false;go.textContent=label();
  }
  /* a size is disabled only when no variant using it can be bought */
  function avail(group,size){
    return VS.some(function(v){if(!v.availableForSale)return false;var t=v.title.split(' / ');
      if(!kit)return t[0]===size;
      if(group==='tee')return t[0]===size&&(!sel['short']||t[1]===sel['short']);
      return t[1]===size&&(!sel.tee||t[0]===sel.tee);});
  }
  function sizes(){
    [].forEach.call(box.querySelectorAll('.po-sizes'),function(fs){var g=fs.getAttribute('data-group');
      [].forEach.call(fs.querySelectorAll('button'),function(b){var s=b.getAttribute('data-size'),ok=VS&&avail(g,s);
        b.disabled=!ok;b.setAttribute('aria-pressed',sel[g]===s?'true':'false');b.setAttribute('aria-label',s+(ok?'':', sold out'));});});
  }
  box.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.po-sizes button');if(!b||b.disabled)return;
    var g=b.closest('.po-sizes').getAttribute('data-group'),s=b.getAttribute('data-size');sel[g]=sel[g]===s?null:s;msg.textContent='';sizes();paint();});
  go.addEventListener('click',function(){var v=pick();if(!v||!window.SahraCart)return;go.disabled=true;go.textContent='Adding';
    window.SahraCart.add(v.id).then(function(){go.textContent=label();go.disabled=false;msg.textContent='';
      try{if(window.track)track('add_to_cart',{item_id:handle,size:v.title,via:'preorder'});}catch(e){}},
      function(){go.disabled=false;go.textContent=label();msg.textContent='That did not go into your bag. Please try again, or message us on WhatsApp.';});});
  var tries=0;
  function load(){
    if(stage()<1)return;
    if(!window.SahraCart){if(tries++<40){setTimeout(load,150);return;}msg.textContent='Sizes are not loading. Refresh the page, or message us on WhatsApp.';return;}
    window.SahraCart.variants(handle).then(function(vs){
      if(!vs||!vs.length){VS=null;go.disabled=true;go.textContent='Unavailable just now';msg.textContent='Sizes are not loading. Refresh the page in a minute, or message us on WhatsApp.';return;}
      VS=vs;sizes();paint();
    },function(){msg.textContent='Sizes are not loading. Refresh the page, or message us on WhatsApp.';});
  }
  document.addEventListener('sb:stage',load);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
</script>`;

function productPage(p, all, SITE, stage) {
  const others = all.filter(o => o.line === p.line && o.handle !== p.handle && !(o.name === p.name)).filter((o, i, a) => a.findIndex(x => x.name === o.name) === i);
  const card = o => `<a class="po-card" href="/products/${o.handle}/">${o.images.length ? `<div class="po-fig">${picture(o.images[0], false, '(max-width: 900px) 50vw, 220px')}<figcaption class="po-mock">Mock-up</figcaption></div>` : `<div class="po-ph"><div><span>Photo to follow</span></div></div>`}<b>${o.name}</b><span>${money(o.price)}</span></a>`;
  const placeLink = p.place ? `<p class="po-small">The place: <a href="/locations/${p.place[1]}/">${p.place[0]} &rarr;</a></p>` : '';
  return `${stageHead()}<style>${CSS}</style>
<main class="po-wrap">
  <p class="po-crumb"><a href="/">Home</a> / <a href="/new/">${p.line === 'sahel' ? 'Sahel' : 'Sahra Trail'}</a> / ${p.title}</p>
  <div class="po-grid">
    ${gallery(p)}
    ${buyBox(p, stage)}
  </div>
  <section class="po-story">
    <div><h2>${p.line === 'sahel' ? 'The story' : 'The piece'}</h2><p>${p.story}</p>${placeLink}</div>
    <div><h2>Details</h2><ul>${p.details.map(d => `<li>${d}</li>`).join('')}</ul>
      <p class="po-small" style="margin-top:12px">${p.images.some(i => i.mock) ? 'The studio images are mock-ups. We will add photos of the real pieces when they arrive.' : 'Photos of the real piece will be added when it arrives.'} Designed in the UAE.</p></div>
  </section>
  ${others.length ? `<section class="po-more"><h2>${p.line === 'sahel' ? 'More from Sahel' : 'More from Sahra Trail'}</h2><div class="po-cards">${others.map(card).join('')}</div></section>` : ''}
</main>
${CLIENT}`;
}

function collectionPage(all) {
  const card = o => `<a class="po-card" href="/products/${o.handle}/">${o.images.length ? `<div class="po-fig">${picture(o.images[0], false, '(max-width: 900px) 50vw, 280px')}<figcaption class="po-mock">Mock-up</figcaption></div>` : `<div class="po-fig po-ph"><div><b>${o.name}</b><span>Photo to follow</span></div></div>`}<b>${o.title}</b><span>${money(o.price)}</span></a>`;
  const sec = (id, h, list) => `<section class="po-more" id="${id}"><h2>${h}</h2><div class="po-cards">${list.map(card).join('')}</div></section>`;
  return `${stageHead()}<style>${CSS}.po-head h1{font:600 clamp(34px,5vw,56px)/1.05 'Cormorant Garamond',Georgia,serif;margin:0 0 10px}.po-head p{font:17px/1.55 Jost,system-ui,sans-serif;max-width:60ch;margin:0 0 8px}</style>
<main class="po-wrap">
  <div class="po-head">
    <p class="po-eyebrow">Sahel &middot; Sahra Trail</p>
    ${inc('st01', `<h1 class="st01">Sahel and Sahra Trail</h1>`)}
    <h1 class="st2">Sahel and Sahra Trail are out</h1>
    ${inc('st0', `<p class="st0">Pre-order opens Wed 28 Oct at 8 AM, UAE time, for everyone. <a href="/sahel/#first-to-know">Join the list</a> and we tell you the evening before.</p>`)}
    ${inc('st1', `<p class="st1">Pre-order is open. 20% off until Thu 29 Oct, 23:59. Ships from Fri 30 Oct.</p>`)}
    ${IN_HAND ? '' : '<p class="st2">Pre-order. Ships from Fri 30 Oct.</p>'}
    <p>Designed in the UAE for everyone who loves it. The studio images are mock-ups until the real pieces are photographed.</p>
  </div>
  ${sec('sahel', 'Sahel &middot; The Coast Edition', all.filter(p => p.line === 'sahel'))}
  ${sec('trail', 'Sahra Trail', all.filter(p => p.line === 'trail'))}
</main>`;
}

module.exports = function buildPreorder({ shell, write, SITE }) {
  const stage = stageNow();
  const all = products();
  all.forEach(p => {
    const url = `${SITE}/products/${p.handle}/`;
    const desc = `${p.plain}, ${money(p.price)}. ${p.line === 'sahel' ? 'Sahel, the Coast Edition' : 'Sahra Trail'} from Sahra & Beyond. Designed in the UAE.`;
    const img = p.images.length ? `${SITE}/assets/preorder/${p.images[0].k}-1200.webp` : undefined;
    write(`products/${p.handle}/index.html`, shell({
      title: `${p.plain} | Sahra & Beyond`, desc, canonical: url, image: img, bodyClass: 'po-page', activeNav: p.line === 'sahel' ? 'sahel' : 'trail',
      noindex: stage < 1,
      jsonld: { '@context': 'https://schema.org', '@type': 'Product', name: p.plain, description: desc, url, image: img ? [img] : undefined,
        brand: { '@type': 'Brand', name: p.line === 'sahel' ? 'Sahra & Beyond' : 'Sahra Trail' },
        offers: { '@type': 'Offer', price: String(p.price), priceCurrency: 'AED', url,
          availability: IN_HAND ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder' } },
      bodyHtml: productPage(p, all, SITE, stage)
    }));
  });
  write('new/index.html', shell({
    title: 'Sahel and Sahra Trail | Sahra & Beyond', desc: 'Sahel, the Coast Edition, and Sahra Trail from Sahra & Beyond. Designed in the UAE.',
    canonical: `${SITE}/new/`, bodyClass: 'po-page', noindex: stage < 1,
    jsonld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Sahel and Sahra Trail', url: `${SITE}/new/` },
    bodyHtml: collectionPage(all)
  }));
  console.log(`  ✓ pre-order: ${all.length} product pages + /new/ (stage ${stage}${IN_HAND ? ', in hand' : ''})`);
};
module.exports.stageNow = stageNow;
module.exports.stageHead = stageHead;
module.exports.inc = inc;
module.exports.urls = urls;
module.exports.handles = () => products().map(p => p.handle);
module.exports.T1 = T1; module.exports.T2 = T2;
