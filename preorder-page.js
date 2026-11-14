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
     - Trail: its own size charts from 10 Nov 2026 (trail-sizing.js, the supplier spec); no performance claims.

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
const T1 = Date.UTC(2026, 9, 27, 18, 45, 0);   /* 27 Oct 2026 (Faheem: "Open now"): pre-order opened Tue 27 Oct 22:45 UAE, not Wed 28 Oct 08:00 */
const T2 = Date.UTC(2026, 9, 29, 20, 0, 0);  /* Fri 30 Oct 00:00 UAE */
const IN_HAND = true;   /* 30 Oct 2026 (Faheem: "In stock, ships next day") */
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
  const hideFor = { 0: ['st1', 'st2', 'st12'], 1: ['st0', 'st2', 'st02'], 2: ['st0', 'st1', 'st01'] };   /* st02: shown before and after the 20% window, e.g. the full price */
  const rules = [0, 1, 2].map(k => hideFor[k].map(c => `html[data-stage="${k}"] .${c}`).join(',')).join(',');
  const noJs = hideFor[b].map(c => `html:not([data-stage]) .${c}`).join(',');
  return `<style>${rules},${noJs}{display:none!important}</style>
<script>(function(){var d=document.documentElement,T1=${T1},T2=${T2};function k(){var n=Date.now(),s=n>=T2?2:n>=T1?1:0;try{var m=/[?&]sbstage=([012])/.exec(location.search||'');if(m)s=+m[1];}catch(e){}return s;}
function set(){var s=k();if(d.getAttribute('data-stage')!==String(s)){d.setAttribute('data-stage',String(s));try{document.dispatchEvent(new CustomEvent('sb:stage',{detail:{stage:s}}));}catch(e){}}}
set();if(!/[?&]sbstage=/.test(location.search||'')){var n=Date.now(),nx=n<T1?T1:n<T2?T2:0;if(nx&&nx-n<864e5)setTimeout(set,nx-n+300);}
/* 23 Oct 2026: how far off the opening is, in days, by the UAE calendar. Updates on each visit; never a ticking clock. */
function days(){try{var t=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).split('-'),n=Math.round((Date.UTC(2026,9,28)-Date.UTC(+t[0],t[1]-1,+t[2]))/864e5),x=n>1?'That is in '+n+' days.':n===1?'That is tomorrow.':n===0?'That is today.':'';[].forEach.call(document.querySelectorAll('[data-days]'),function(e){e.textContent=x;});}catch(e){}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',days);else days();})();</script>`;
}

const SIZES = ['S', 'M', 'L', 'XL'];
/* 31 Oct 2026 (Faheem): "For all new oversized shirts and hoodies, let's rebrand them as Super Oversized with drop
   shoulder. This becomes a third category on top of regular and oversized." Each Sahel tee has three fits and each
   hoodie two; [handle suffix, fit name]. Oversized is paused (specimen.js PAUSED) until the new production run, cut to
   the original Founding Edition Oversized size; Super Oversized is the current stock, unaltered. The Super Oversized
   hoodie keeps the hoodie's original handle (no suffix), so its links, ads and search listings keep working.
   The order here is the order of the product list (the first fit on sale is the one a one-card-per-design list shows). */
const FITS = { tee: [['regular', 'Regular'], ['super-oversized', 'Super Oversized'], ['oversized', 'Oversized']],
  hoodie: [['', 'Super Oversized'], ['oversized', 'Oversized']],
  /* 14 Nov 2026 (Faheem): the Al Qudra Lakes Tee and the Khor Fakkan Hoodie are made in Oversized only */
  oversizedOnly: [['oversized', 'Oversized']] };
/* 13 Nov 2026 (Faheem: "Al Aqaa tee and Barr and Bahr Hoodie are not coming back in oversized. Remove that fit option for
   these two"). Their Oversized pages are gone; vercel.json sends the old addresses to the fit that is on sale. */
const RETIRED = new Set(['al-aqah-reef-tee-oversized', 'barr-and-bahr-hoodie-oversized']);
const FIT_DETAILS = { Regular: ['Regular fit'], Oversized: ['Oversized fit'], 'Super Oversized': ['Super Oversized fit', 'Drop shoulder'] };
const SZ = require('./sahel-sizing.js');
const TSZ = require('./trail-sizing.js');   /* 10 Nov 2026: Sahra Trail size charts (the Tee, the 2-in-1 Short, both on the Kit) */
const SP = require('./specimen.js');   /* 30 Oct 2026: the Specimen Sheet (product pages) */   /* 27 Oct 2026: the Sahel size charts */
/* 30 Oct 2026 (Faheem: size note for repeat buyers). The Founding Edition and Sahel charts do not line up
   (a Founding Regular L is a Sahel Regular S), so a Sahel tee page translates the customer's Founding size by
   chest, using both real charts. Hoodies and the polo have no Founding equivalent, so they get no note. */
const FSZ = require('./content/sizing.json');
function foundingMatch(key) {
  if (key === 'teeSuperOversized') return SZ.foundingToSuper();
  const fRows = key === 'teeRegular' ? FSZ.regular : null;
  if (!fRows || !SZ.D[key]) return '';
  const sRows = SZ.D[key].rows, fit = 'Regular';
  const minS = Math.min(...sRows.map(r => r[1]));
  const exact = [], near = [], small = [];
  fRows.forEach(([fz, fc]) => {
    const best = sRows.slice().sort((a, b) => Math.abs(a[1] - fc) - Math.abs(b[1] - fc) || a[1] - b[1])[0];
    if (best[1] === fc) exact.push(`Founding ${fz} (${fc}&Prime;) is a Sahel ${best[0]}`);
    else if (fc < minS) small.push(fz);
    else {
      const tie = sRows.filter(r => r !== best && Math.abs(r[1] - fc) === Math.abs(best[1] - fc))[0];
      near.push(tie ? `Founding ${fz} (${fc}&Prime;) sits between Sahel ${best[0]} (${best[1]}&Prime;) and ${tie[0]} (${tie[1]}&Prime;)` : `Founding ${fz} (${fc}&Prime;) is closest to Sahel ${best[0]} (${best[1]}&Prime;)`);
    }
  });
  const smallest = sRows.slice().sort((a, b) => a[1] - b[1])[0];
  const parts = exact.concat(near);
  if (small.length) parts.push(`Founding ${small.join(' and ')} ${small.length > 1 ? 'are' : 'is'} smaller than any Sahel ${fit} size, so Sahel ${smallest[0]} (${smallest[1]}&Prime;) is the closest`);
  return `<p class="po-ask po-match">Already wear our Founding Edition ${fit}? Go by the chest measurement, not the letter: ${parts.join('; ')}.</p>`;
}
const mock = (k, alt) => ({ k, alt, mock: true });
/* 8 Nov 2026 (Faheem: "Remove the mockup tag from trail and polo photos"): the Sahra Trail and Sahel Polo studio images carry no
   Mock-up label or alt note any more; `studio` only stops the copy claiming they were photographed from the real piece. */
const studio = (k, alt) => ({ k, alt, mock: false, studio: true });
/* 8 Nov 2026 (Faheem: "real photos first"): a male model photo leads the Trail cards and pages, before the studio images. No caption. */
const model = (k, alt) => ({ k, alt, mock: false, cap: '' });
/* 27 Oct 2026 (Faheem: the Sahel photos from the 27 Oct shoot): the real photographs, per piece, in content/sahel-photos.json.
   Back first, then front, then details. Real photos carry no Mock-up label (cap '' = no caption); (8 Nov 2026) the Sahel Polo now opens on
   male model photos, then its studio images (the Khor Fakkan Bay front arrived on the evening of 27 Oct). Hoodie location photos are 2:3 and are always
   shown whole (object-fit: contain), so the flamingo and dune prints are never cropped. */
const PHOTOS_JSON = (function () { try { return JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'content', 'sahel-photos.json'), 'utf8')); } catch (e) { return {}; } })();
const PHOTOS = PHOTOS_JSON.pieces || {};
/* 2 Nov 2026 (Faheem approved every photo and its order): the model photos of the 1 Nov shoot, per product PAGE (site
   handle), with the size the model wears. They are not part of p.images, so the cards, place pins and share images keep
   the flat-lay; the product page shows them after its first photo (specimen.js onModel). Paused fits have none. */
const ON_MODEL = PHOTOS_JSON.onModel || {};
const photoList = key => (PHOTOS[key] || []).map(x => Object.assign({}, x, x.mock ? {} : { cap: '' }));
/* one <img> for any pre-order image: its own width and height, the large file's real width in srcset, and contain for 2:3 */
const isTall = im => (im.h || 900) / (im.w || 720) > 1.4;
/* 29 Oct 2026 (site speed): a card is about half a phone screen wide, and on a 3x phone that asked for the
   720 px file (up to 240 KB for a detail crop). Phone card widths are given to the browser at two thirds, so
   phones (up to 600 px) fetch the 480 px file: still about 2.5 device pixels per CSS pixel on the card.
   Tablets, galleries (vw over 50) and desktop sizes are unchanged. */
const capSizes = s => String(s).replace(/(\(max-width:\s*(\d+)px\)\s*)(\d+)vw/, (a, q, mw, v) => +v <= 50 && +mw > 600 ? '(max-width: 600px) ' + Math.round(v * 0.68) + 'vw, ' + a : a);
function imgTag(im, o = {}) {
  const w = im.w || 720, h = im.h || 900, lw = im.lw || 1200;
  const alt = o.alt != null ? o.alt : esc(im.alt) + (im.mock && o.mockAlt !== false ? ', studio mock-up' : '');
  const fit = isTall(im) ? ` style="object-fit:contain;background:${o.bg || '#E5E1D9'}"` : '';
  return `<img${o.cls ? ` class="${o.cls}"` : ''}${o.zoom ? ` data-zoom="/assets/preorder/${im.k}-1200.webp"` : ''} src="/assets/preorder/${im.k}-720.webp" srcset="/assets/preorder/${im.k}-480.webp 480w, /assets/preorder/${im.k}-720.webp ${w}w, /assets/preorder/${im.k}-1200.webp ${lw}w" sizes="${capSizes(o.sizes || '(max-width: 900px) 50vw, 300px')}" width="${w}" height="${h}" alt="${alt}"${o.eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"${fit}>`;
}
const mockTag = (im, cls) => im && im.mock ? `<i${cls ? ` class="${cls}"` : ''}>Mock-up</i>` : '';
/* 28 Oct 2026 (Faheem: "All the product cards across the site need to have an auto slideshow"): a card shows every
   photo of its piece as a [data-cycle] stack, run by the site's shared beat in assets/sahra-market.js (one timer, all
   visible cards turn together, hover or a finger holds). Only photos of the same kind as the cover cycle, so a card
   that opens on a real photo never fades into an unlabelled mock-up, and a mock-up card keeps its label throughout. */
const cardSet = p => { const im = p.images || []; return im.length ? im.filter(x => !!x.mock === !!im[0].mock) : []; };
const cycleImgs = (p, o = {}) => cardSet(p).map((im, i) => imgTag(im, Object.assign({}, o, { cls: i ? '' : 'on' }))).join('');
const CYCLE_CSS = `[data-cycle]{position:relative}
[data-cycle] img{position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity .6s ease-in-out;z-index:1;object-fit:cover;object-position:center 30%;padding:0}
[data-cycle] img.on{opacity:1;z-index:3;will-change:opacity}
[data-cycle] img.was{opacity:1;transition:none;z-index:2;will-change:opacity}
[data-cycle]>i,[data-cycle]>em,[data-cycle]>figcaption{z-index:5!important}`;
const real = (k, alt, cap) => ({ k, alt, mock: false, cap });

/* Story paragraphs: the approved card stories (14 Oct handover; content/sahel-pieces.json). */
const SAHEL = [
  { key: 'khor-fakkan-bay-tee', name: 'Khor Fakkan Bay Tee', seo: 'Khor Fakkan Bay Graphic T-Shirt', kind: 'Graphic T-shirt', md: 'cotton in Jet Set, DTG printed front and back', colour: 'Jet Set', price: 199, fits: 'tee', img: 'kfb', place: ['Khor Fakkan', 'khor-fakkan-beach'],
    story: "On Sharjah's east coast the Hajar Mountains come straight down to the Gulf of Oman. Khor Fakkan sits in the curve between two headlands, and its name is usually read as 'the creek of the two jaws'. We drew the bay the way it holds you: bare ridges, one sweep of pale sand and a dhow resting on still water.",
    details: ['Cotton', 'DTG printed front and back', 'Our mark embroidered at the back neck', 'Printed neck label'] },
  { key: 'al-hamra-pearl-diver-tee', name: 'Al Hamra Pearl Diver Tee', seo: 'Al Hamra Pearl Diver Graphic T-Shirt', kind: 'Graphic T-shirt', md: 'cotton in Estate Blue, DTG printed', colour: 'Estate Blue', price: 199, fits: 'tee', img: 'pearl', place: ['Al Jazirah Al Hamra', 'al-jazirah-al-hamra'],
    story: 'Al Jazirah Al Hamra, the Red Island, is a coral-stone pearling town on the Ras Al Khaimah coast, left empty around 1970. Every summer the boats of this coast sailed for the big dive, from June to the end of September. A diver went down on a stone weight, filled his basket with oysters and tugged the rope to be hauled up.',
    details: ['Cotton', 'DTG printed', 'Our mark embroidered at the back neck', 'Printed neck label'] },
  /* 14 Nov 2026 (Faheem: "We also have one new shirt"; Sahel, AED 199, Oversized only). Studio mock-ups until it is photographed. */
  { key: 'al-qudra-lakes-tee', name: 'Al Qudra Lakes Tee', seo: 'Al Qudra Lakes Flamingo Graphic T-Shirt', kind: 'Graphic T-shirt', md: 'cotton in Demitasse, DTG printed back and left chest', colour: 'Demitasse', price: 199, fits: 'oversizedOnly', img: 'qudra', place: ['Al Qudra Lakes', 'love-lake'],
    story: 'Al Qudra is a chain of man-made lakes in the desert south of Dubai, ringed by ghaf trees and reeds. Late in the day the low sun lays a line of light across the water and the flamingos wade out into it. We drew the far shore at that hour: the trees, the sun on the lake and the flamingos standing in it. The same shore sits small on the chest.',
    details: ['Cotton', 'DTG printed back and left chest', 'Printed neck label'] },
  { key: 'al-aqah-reef-tee', name: 'Al Aqah Reef Tee', seo: 'Al Aqah Reef Graphic T-Shirt', kind: 'Graphic T-shirt', md: 'cotton in Lagoon, DTG printed front and back', colour: 'Lagoon', price: 199, fits: 'tee', img: 'reef', place: ['Al Aqah', 'snoopy-island'],
    story: "A small rock island sits a few hundred metres off Al Aqah beach, on Fujairah's northern coast. You don't need a boat: people swim, wade or paddle out to snorkel the reef around it, where turtles, blacktip reef sharks and parrotfish are reported. We drew both worlds at once, the rock above the waterline and the reef beneath it.",
    details: ['Cotton', 'DTG printed front and back', 'Our mark embroidered at the back neck', 'Printed neck label'] },
  { key: 'shams-tee', name: 'Shams Tee', seo: 'Shams Embroidered T-Shirt', kind: 'Embroidered T-shirt', md: 'cotton in Jet Set, our mark embroidered in sand thread on the left chest', colour: 'Jet Set', price: 139, fits: 'tee', img: 'shams', front: true,
    story: 'Shams is the sun, and in this country it decides everything: when to walk, when to rest, when the dunes turn gold. Sahra &amp; Beyond began with nights in the desert and a camera, waiting for it to rise. Our mark keeps that moment, the sun resting on a dune crest with sahra written beneath it, stitched in sand thread on the left chest.',
    details: ['Cotton', 'Our mark embroidered in sand thread on the left chest', 'Back plain', 'Printed neck label'] },
  { key: 'the-sahel-polo', name: 'The Sahel Polo', seo: 'The Sahel Polo, Black Piqu\u00e9 Polo Shirt', kind: 'Polo shirt', md: 'black mercerised piqu\u00e9, three buttons, antique-gold tipping and our mark in antique-gold thread', colour: 'Black', price: 229, img: 'polo', front: true,
    story: "After dark on Dubai Creek, the lights of the abras and dhows spill gold onto black water. This polo is cut from that view: black mercerised piqu&eacute;, three buttons, and our mark in antique-gold thread on the left chest. It's the one piece in Sahel made for evenings.",
    details: ['Black mercerised piqu&eacute;', 'Three buttons', 'Antique-gold tipping on the collar and cuffs', 'Our mark in antique-gold thread on the left chest', 'Printed neck label'] },
  { key: 'barr-and-bahr-hoodie', name: 'Barr &amp; Bahr Hoodie', seo: 'Barr & Bahr Hoodie, Embroidered UAE Coastline', kind: 'Hoodie', md: 'the UAE coastline embroidered in sand thread across the back, in Salute', plain: 'Barr & Bahr Hoodie', colour: 'Salute', price: 229, fits: 'hoodie', img: 'barr',
    story: 'In the Gulf, barr is the open land, the desert, and bahr is the sea. People say them together because life here has always moved between the two. The lower back carries that crossing: contour-line dunes running down into a stream and a wave. Above it, one line of sand thread traces the whole UAE coast.',
    details: ['The UAE coastline embroidered in sand thread across the back', 'Lower-back artwork DTG printed', 'Printed neck label'] },
  { key: 'ras-al-khor-hoodie', name: 'Ras Al Khor Hoodie', seo: 'Ras Al Khor Hoodie, Flamingos and the UAE Coast', kind: 'Hoodie', md: 'flamingos at Ras Al Khor low on the back and the UAE coastline in sand thread, in Estate Blue', colour: 'Estate Blue', price: 229, fits: 'hoodie', img: 'rakh', place: ['Ras Al Khor', 'ras-al-khor'],
    story: 'Ras Al Khor means the head of the creek: a protected wetland where Dubai Creek ends, in the middle of the city. Low on the back, greater flamingos wade there at dusk, with the mangroves behind them. Above them runs the whole UAE coast in a single line of sand thread, with Sahel written beneath it in Arabic and English.',
    details: ['The UAE coastline embroidered in sand thread across the back', 'Lower-back artwork DTG printed', 'Printed neck label'] },
  /* 14 Nov 2026 (Faheem: "This is actually Khor Fakkan hoodie"; "Color and Front remains same as Barr and Bahr"). Oversized only,
     AED 229, studio mock-ups (front as the Barr & Bahr; back built from the Khor Fakkan Bay print file and the coastline) */
  { key: 'khor-fakkan-hoodie', name: 'Khor Fakkan Hoodie', seo: 'Khor Fakkan Hoodie, Khor Fakkan Bay and the UAE Coast', kind: 'Hoodie', md: 'Khor Fakkan Bay low on the back and the UAE coastline in sand thread, in Salute', colour: 'Salute', price: 229, fits: 'oversizedOnly', img: 'kfh', place: ['Khor Fakkan', 'khor-fakkan-beach'],
    story: "On Sharjah's east coast the Hajar Mountains come straight down to the Gulf of Oman, around one sweep of pale sand. The lower back carries Khor Fakkan Bay as we drew it for the tee: bare ridges, the beach and a dhow on still water. Above it, one line of sand thread traces the whole UAE coast, with Sahel written beneath it in Arabic and English.",
    details: ['Our mark embroidered on the chest', 'The UAE coastline embroidered in sand thread across the back', 'Lower-back artwork DTG printed', 'Printed neck label'] }
];
/* Trail features: the /trail/ page's own list (build.js, 8 Oct). No performance claims; "reflective", never "glows". */
const TRAIL = [
  { handle: 'sahra-trail-tee', name: 'Sahra Trail Tee', seo: 'Sahra Trail Running T-Shirt', kind: 'Running T-shirt', md: 'raglan sleeves, mesh side panels, covered seams and a reflective Two Ridges symbol', price: 139,
    lede: 'Trail and run wear from Sahra &amp; Beyond, designed in the UAE. Ocean-inspired print.',
    details: ['Raglan sleeves', 'Mesh side panels', 'Covered seams', 'Reflective Two Ridges symbol under the collar'],
    images: [model('pm2-sahra-trail-kit-01-lunge', 'Model wearing the Sahra Trail Tee, stretching in a lunge, front view'), model('pm-sahra-trail-tee-01-running-back', 'Model wearing the Sahra Trail Tee, running, back view'), studio('trail-tee-front', 'Sahra Trail Tee, front'), studio('trail-tee-back', 'Sahra Trail Tee, back'),
      real('trail-chest', 'The Sahra Trail chest lockup, close up'), real('trail-mesh', 'The mesh side panel, close up'), real('trail-backsymbol', 'The Two Ridges symbol, close up')] },
  { handle: 'sahra-trail-2-in-1-short', name: 'Sahra Trail 2-in-1 Short', seo: '2-in-1 Running Shorts, Sahra Trail', kind: '2-in-1 running shorts', md: 'a hidden inner liner, a bonded phone pocket, a zip pocket for keys and an internal drawcord', price: 169,
    lede: 'Trail and run wear from Sahra &amp; Beyond, designed in the UAE. Wave-inspired graphic.',
    details: ['Two shorts in one, with a hidden inner liner', 'Bonded phone pocket in the liner', 'Zip pocket for keys and cards', 'Internal drawcord', 'Reflective Two Ridges symbol'],
    images: [model('pm2-sahra-trail-short-04-side', 'Model wearing the Sahra Trail 2-in-1 Short, side view, hand in the pocket'), model('pm-sahra-trail-2-in-1-short-01-leg-close-up', 'Model wearing the Sahra Trail 2-in-1 Short, close-up of the leg'), studio('trail-short-front', 'Sahra Trail 2-in-1 running shorts, front'), studio('trail-short-back', 'Sahra Trail 2-in-1 running shorts, back'),
      real('trail-shortsymbol', 'The Two Ridges symbol and the name on the leg, close up'), real('trail-shortname', 'SAHRA TRAIL on the leg, close up')] },
  { handle: 'sahra-trail-kit', name: 'Sahra Trail Kit', seo: 'Sahra Trail Running Kit: Tee and 2-in-1 Shorts', kind: 'Running kit', md: 'the Sahra Trail Tee and the Sahra Trail 2-in-1 Short together, with a size chosen for each', price: 308, kit: true,   /* 8 Nov 2026 (Faheem): no kit discount; the kit is the tee + short at their own prices (139 + 169) */
    lede: 'The Sahra Trail Tee and the Sahra Trail 2-in-1 Short together in one order, with a size chosen for each. Tee, AED 139. Short, AED 169.',
    details: ['The Sahra Trail Tee', 'The Sahra Trail 2-in-1 Short', 'Choose a size for each'],
    images: [model('pm2-sahra-trail-kit-01-lunge', 'Model wearing the Sahra Trail Kit, stretching in a lunge, front view'), model('pm-sahra-trail-kit-01-running-side', 'Model wearing the Sahra Trail Kit, running, side view'), studio('trail-kit-front', 'Sahra Trail Kit, front: the tee and the 2-in-1 short'), studio('trail-kit-back', 'Sahra Trail Kit, back'),
      real('trail-chest', 'The Sahra Trail chest lockup, close up'), real('trail-shortsymbol', 'The Two Ridges symbol on the short, close up')] },
  /* 23 Oct 2026 (Faheem): the canvas drawstring bag, 100 in hand, AED 50, on sale with Trail from Wed 28 Oct 08:00 UAE.
     Name chosen for Faheem ("come up with an innovative on brand name"): The Trailhead Bag, what you take to the trailhead.
     In hand, so it is not a pre-order: no 20% pre-order price (the Shopify discount covers the 14 pre-order products only),
     ships next working day, one size. On its own it does not earn the free tote (Faheem, 23 Oct; assets/sahra-cart.js).
     The image is Faheem's photo of the real bag, cut out onto the studio backdrop: a real photo, captioned as one. */
  { handle: 'trailhead-bag', name: 'The Trailhead Bag', seo: 'Canvas Drawstring Bag, The Trailhead Bag', kind: 'Canvas drawstring bag', md: 'natural canvas with the Two Ridges mark and SAHRA TRAIL DUBAI printed in sand, rope drawstrings that close the top and carry it on your back', price: 50,
    inHand: true, oneSize: true, noTote: true,
    lede: 'A natural canvas drawstring bag with the Two Ridges mark and SAHRA TRAIL DUBAI printed on the front in sand. Rope drawstrings close the top and carry it on your back. Sized for what you take to the trailhead: a layer, water, keys.',
    details: ['Natural canvas', 'Two Ridges mark and SAHRA TRAIL DUBAI printed in sand', 'Rope drawstrings, worn as shoulder straps', 'One size'],
    images: [real('trail-bag-front', 'The Trailhead Bag: natural canvas drawstring bag with the Sahra Trail Two Ridges mark', 'The real bag')] }
];

/* 8 Nov 2026 (Faheem: "Why are flat lays showing in other slides across the site. Everywhere should be models first"): a Sahel
   tee page that has model photos for its Back, Front and Art tabs (content/sahel-photos.json onModel[handle].stage) leads its
   images with them, the tab shown first leading, so every card, slideshow, place pin and share image opens on the model. The
   flat-lays follow. Paused fits have no model photos and keep the flat-lays. Alts are the product-page alts. */
function modelFirst(handle, nm, images) {
  const M = !SP.PAUSED[handle] && ON_MODEL[handle], ST = M && M.stage; if (!ST) return images;
  const face = /^shams-/.test(handle) ? 'front' : 'back';   /* as the product page: the print side first, the Shams mark from the front */
  const order = [face].concat(['back', 'front', 'art'].filter(k => k !== face)).filter(k => ST[k]);
  const lead = order.map(k => ({ k: ST[k].k, alt: `Model wearing the ${String(nm).replace(/&amp;/g, '&')}, ${ST[k].view}`, mock: false, cap: '', w: 720, h: 900, lw: 1200, lh: 1500 }));
  return lead.concat(images);
}
/* the flat list of product pages */
function products() {
  const out = [];
  SAHEL.forEach(p => {
    const plain = p.plain || p.name;
    const images = PHOTOS[p.key] ? photoList(p.key) : p.img ? (p.front ? [mock(p.img + '-front', plain + ', front'), mock(p.img + '-back', plain + ', back')] : [mock(p.img + '-back', plain + ', back'), mock(p.img + '-front', plain + ', front')]) : [];
    if (p.fits) {
      const fl = FITS[p.fits].map(([f, F]) => ({ fit: F, handle: f ? `${p.key}-${f}` : p.key })).filter(x => !RETIRED.has(x.handle));
      fl.forEach(x => { x.onSale = !SP.PAUSED[x.handle]; });
      fl.forEach(({ fit: F, handle }) => out.push({ line: 'sahel', handle, title: `${p.name} &mdash; ${F}`, plain: `${plain} — ${F}`, name: p.name, fit: F, fitsList: fl,
        colour: p.colour, price: p.price, story: p.story, details: FIT_DETAILS[F].concat(p.details), images: modelFirst(handle, `${p.name.replace(/^The /, '')} in ${F}`, images), place: p.place, key: p.key, seo: p.seo, kind: p.kind, md: p.md,
        onModel: !SP.PAUSED[handle] && ON_MODEL[handle] && ON_MODEL[handle].photos ? ON_MODEL[handle] : null }));
    }
    else out.push({ line: 'sahel', handle: p.key, title: p.name, plain, name: p.name, colour: p.colour, price: p.price, story: p.story, details: p.details, images, place: p.place, key: p.key, seo: p.seo, kind: p.kind, md: p.md,
      onModel: ON_MODEL[p.key] && ON_MODEL[p.key].photos ? ON_MODEL[p.key] : null });
  });
  TRAIL.forEach(p => out.push({ line: 'trail', handle: p.handle, title: p.name, plain: p.name, name: p.name, price: p.price, story: p.lede, details: p.details, images: p.images, kit: !!p.kit, key: p.handle, seo: p.seo, kind: p.kind, md: p.md, inHand: !!p.inHand, oneSize: !!p.oneSize, noTote: !!p.noTote,
    onModel: ON_MODEL[p.handle] && ON_MODEL[p.handle].photos ? ON_MODEL[p.handle] : null }));
  return out;
}
function urls(SITE) { return products().map(p => `${SITE}/products/${p.handle}/`); }

const esc = s => String(s).replace(/&(?![a-z#0-9]+;)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = n => 'AED ' + (Math.round(n * 100) % 100 === 0 ? String(Math.round(n)) : (Math.round(n * 100) / 100).toFixed(2));
const pre = n => Math.round(n * 80) / 100;   /* the 20% pre-order price, to the fils, as Shopify computes it */
/* 23 Oct 2026 (Faheem: "Show AED 159.20"): in the pre-order window the price shown IS the pre-order price.
   No strike-through and no compare-at price; the full price is named in words beside it. */
/* 30 Oct 2026 (Faheem: "one currency per screen"): the full price carries .sb-price + the Shopify
   handle, so sahra-market.js converts it with the Founding Edition prices beside it. Without a
   handle (or for the pre-order figure) it stays AED. */
const priceAttrs = (n, h) => h ? ` data-handle="${h}" data-aed="${n}"` : '';
const pcls = (c, h) => h ? (c ? `${c} sb-price` : 'sb-price') : c;
const cardPrice = (n, tag, full, h) => full ? `<${tag}${pcls('', h) ? ` class="${pcls('', h)}"` : ''}${priceAttrs(n, h)}>${money(n)}</${tag}>` : inc('st1', `<${tag} class="st1">${money(pre(n))}, pre-order price</${tag}>`) + `<${tag} class="${pcls('st02', h)}"${priceAttrs(n, h)}>${money(n)}</${tag}>`;

function picture(im, eager, sizes, zoom) {
  return imgTag(im, { eager, sizes: sizes || '(max-width: 900px) 100vw, 50vw', mockAlt: false, zoom });
}
function gallery(p) {
  if (!p.images.length) return `<div class="po-gal"><figure class="po-ph"><div><b>${p.title}</b><span>Photo to follow</span></div></figure></div>`;
  return `<div class="po-gal" data-zoom-gallery>${p.images.map((im, i) => `<figure class="po-fig${isTall(im) ? ' po-tall' : ''}">${picture(im, i === 0, null, true)}${im.cap === '' ? '' : `<figcaption class="${im.mock ? 'po-mock' : 'po-real'}">${im.mock ? 'Mock-up' : (im.cap || 'Close-up of the sample')}</figcaption>`}</figure>`).join('')}</div>`;
}

const CSS = `${SZ.CSS}${TSZ.CSS}
.po-size{max-width:760px;margin:34px auto 0;padding:0 2px;scroll-margin-top:96px}.po-size h2{font:600 28px/1.15 'Cormorant Garamond',Georgia,serif;margin:0 0 8px}

.po-page{background:#FAF6EF;color:#2A2016}
.po-wrap{max-width:1180px;margin:0 auto;padding:22px 20px 70px}
.po-crumb{font:12px/1.4 'Space Mono',ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B6256;margin:0 0 16px}
.po-crumb a{color:inherit}
.po-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:40px;align-items:start}
.po-gal{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.po-fig{position:relative;margin:0;background:#F2EDE6;border-radius:10px;overflow:hidden;aspect-ratio:4/5}
.po-fig:first-child{grid-column:1/-1}
.po-fig.po-tall{aspect-ratio:2/3}
.po-gal .po-fig{cursor:zoom-in}.po-gal .po-fig:focus-visible{outline:3px solid #7E4114;outline-offset:3px}
.po-zoomhint{font:12px/1.4 'Space Mono',ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B6256;margin:8px 2px 0}.po-fig.po-tall img{object-fit:contain}
.po-fig img{width:100%;height:100%;object-fit:cover;display:block}
${CYCLE_CSS}
.po-fig figcaption{position:absolute;left:10px;top:10px;font:11px/1 'Space Mono',ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;padding:6px 8px;border-radius:4px;background:rgba(250,246,239,.92);color:#2A2016}
.po-ph{margin:0;aspect-ratio:4/5;border-radius:10px;background:#2A2016;color:#E5E1D9;display:flex;align-items:center;justify-content:center;text-align:center;grid-column:1/-1}
.po-ph b{display:block;font:600 30px/1.1 'Cormorant Garamond',Georgia,serif;margin-bottom:10px}
.po-ph span{font:12px 'Space Mono',ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase}
.po-buy{position:sticky;top:90px}
.po-eyebrow{font:12px/1.4 'Space Mono',ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;color:#7E4114;margin:0 0 8px}
.po-buy h1{font:600 clamp(32px,4vw,46px)/1.05 'Cormorant Garamond',Georgia,serif;margin:0 0 10px;letter-spacing:-.01em}
.po-line{font:500 16px/1.45 Jost,system-ui,sans-serif;margin:0 0 14px;color:#2A2016}
.po-price{font:600 26px/1.2 Jost,system-ui,sans-serif;margin:0 0 6px}
.po-note{font:15px/1.5 Jost,system-ui,sans-serif;margin:0 0 6px;color:#4A4136}
.po-colour{font:14px/1.5 Jost,system-ui,sans-serif;color:#4A4136;margin:0 0 16px}
.po-tabby{font:14px/1.6 Jost,system-ui,sans-serif;margin:10px 0 4px}
.po-tabby img{height:20px;width:auto;display:inline-block;vertical-align:-5px;margin:0 1px 0 5px}
.po-tabby-fine{font:12px/1.5 Jost,system-ui,sans-serif;color:#4A4136;margin:0 0 18px}
.po-sizes{border:0;margin:0 0 14px;padding:0}
.po-sizes legend{font:12px 'Space Mono',ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px;color:#4A4136}
.po-sz{display:flex;gap:8px;flex-wrap:wrap}
.po-sz button{min-width:56px;min-height:46px;border:1px solid rgba(42,32,22,.35);background:#FAF6EF;border-radius:8px;font:500 16px Jost,system-ui,sans-serif;color:#2A2016;cursor:pointer}
.po-sz button[aria-pressed="true"]{background:#2A2016;color:#FAF6EF;border-color:#2A2016}
.po-sz button:disabled{opacity:.5;border-style:dashed;cursor:not-allowed}
.po-sz button:focus-visible,.po-go:focus-visible{outline:3px solid #7E4114;outline-offset:2px}
.po-go{width:100%;min-height:54px;border:0;border-radius:999px;background:#2A2016;color:#FAF6EF;font:600 16px Jost,system-ui,sans-serif;letter-spacing:.04em;cursor:pointer;margin:4px 0 10px}
.po-go:disabled{background:#6B6256;cursor:not-allowed}
.po-msg{font:14px/1.5 Jost,system-ui,sans-serif;color:#7E4114;min-height:1.5em;margin:0 0 8px}
.po-closed{font:500 16px/1.5 Jost,system-ui,sans-serif;background:#F3DDB8;border-radius:10px;padding:14px 16px;margin:6px 0 16px}
.po-wait{margin:0 0 18px}
.po-wait label{display:block;font:12px 'Space Mono',ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px;color:#4A4136}
.po-wait-r{display:flex;gap:8px;flex-wrap:wrap}
.po-wait-r input[type=email]{flex:1 1 200px;min-height:50px;border-radius:999px;border:1px solid rgba(42,32,22,.35);padding:0 18px;font:16px Jost,system-ui,sans-serif;background:#FAF6EF;color:#2A2016}
.po-wait-r button{min-height:50px;padding:0 24px;border:0;border-radius:999px;background:#2A2016;color:#FAF6EF;font:600 15px Jost,system-ui,sans-serif;cursor:pointer}
.po-wait-ok,.po-wait-err{display:none;font:15px/1.5 Jost,system-ui,sans-serif;margin:10px 0 0}
.po-wait-err{color:#7E4114}
.po-wait.done .po-wait-f,.po-wait.done .po-small{display:none}.po-wait.done .po-wait-ok{display:block}.po-wait.err .po-wait-err{display:block}.po-wait.loading button{opacity:.6}
.po-ask{font:15px/1.5 Jost,system-ui,sans-serif;margin:6px 0 14px}
.po-ask a,.po-small a{color:#7E4114}
.po-small{font:14px/1.55 Jost,system-ui,sans-serif;color:#4A4136;margin:0 0 6px}
.po-sib{font:14px/1.5 Jost,system-ui,sans-serif;margin:0 0 14px}
.po-sib a{color:#7E4114}
.po-rv{max-width:760px;margin:30px auto 0;padding:18px 18px 14px;border:1px solid rgba(42,32,22,.14);border-radius:16px;background:#fff}
.po-rv h2{font:600 24px/1.15 'Cormorant Garamond',Georgia,serif;margin:0 0 4px;color:#2A2016}
.po-rv-l{list-style:none;margin:12px 0 8px;padding:0;display:grid;gap:14px}
.po-rv-l li{padding:12px 0 0;border-top:1px solid rgba(42,32,22,.12)}
.po-rv-l p{margin:4px 0 6px;font:400 15.5px/1.55 Jost,system-ui,sans-serif;color:#2A2016}
.po-rv-l span{display:block;font:400 13px/1.4 Jost,system-ui,sans-serif;color:#6B6256}
.po-rv-l .po-rv-on{margin-top:2px}
.po-rv-s{color:#7E4114;font-size:14px;letter-spacing:1px;font-weight:400}
@media(min-width:900px){.po-rv-l{grid-template-columns:1fr 1fr;gap:22px}}
.po-story{margin:44px 0 0;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:40px}
.po-story h2{font:600 28px/1.15 'Cormorant Garamond',Georgia,serif;margin:0 0 12px}
.po-story p{font:17px/1.65 Jost,system-ui,sans-serif;margin:0 0 12px;max-width:62ch}
.po-story ul{margin:0;padding-left:20px;font:16px/1.7 Jost,system-ui,sans-serif}
.po-more{margin:46px 0 0}
.po-more h2{font:600 26px/1.2 'Cormorant Garamond',Georgia,serif;margin:0 0 14px}
.po-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}
@media(max-width:700px){.po-cards{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}}
.po-card{display:block;text-decoration:none;color:#2A2016}
.po-card .po-fig{aspect-ratio:4/5}
.po-card b{display:block;font:500 16px/1.35 Jost,system-ui,sans-serif;margin:8px 0 2px}
.po-card span{font:14px Jost,system-ui,sans-serif;color:#4A4136}
@media(max-width:900px){
  .po-grid,.po-story{grid-template-columns:1fr;gap:22px}
  .po-buy{position:static}
  .po-wrap{padding:14px 16px 56px}
  .po-gal{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:8px;margin:0 -16px;padding:0 16px}
  .po-gal .po-fig,.po-gal .po-ph{flex:0 0 72%;scroll-snap-align:center}
  .po-gal .po-fig.po-tall{flex-basis:60%}
  .po-crumb{margin-bottom:10px}
}
/* 28 Oct 2026 (conversion fixes): trust next to the price, the reassurance a cold visitor needs right above the button,
   and a sticky bar on phones so the buy button is never more than a thumb away */
.po-rate{display:inline-flex;align-items:center;gap:8px;font:14px/1.4 Jost,system-ui,sans-serif;color:#2A2016;text-decoration:none;margin:2px 0 10px}
.po-rate b{color:#7E4114;letter-spacing:1px;font-weight:400}
.po-rate span{text-decoration:underline;text-decoration-color:rgba(126,65,20,.4);text-underline-offset:3px}
.po-assure{list-style:none;margin:6px 0 12px;padding:12px 14px;border-radius:12px;background:#F3DDB8;font:14.5px/1.5 Jost,system-ui,sans-serif;color:#2A2016}
.po-assure li{position:relative;padding-left:22px;margin:3px 0}
.po-assure li::before{content:"";position:absolute;left:2px;top:.45em;width:11px;height:6px;border-left:2px solid #3F6B3A;border-bottom:2px solid #3F6B3A;transform:rotate(-45deg)}
.po-sizes.flash{animation:poFlash 1.1s ease}
@keyframes poFlash{0%,100%{background:transparent}25%,60%{background:rgba(243,221,184,.35)}}
.po-sizes{border-radius:12px;transition:background .3s}
#buybar.po-bar{position:fixed;left:0;right:0;bottom:0;z-index:110;background:rgba(250,246,239,.97);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-top:1px solid rgba(42,32,22,.14);
  padding:10px 14px calc(10px + env(safe-area-inset-bottom,0px));display:none;gap:10px;align-items:center;box-shadow:0 -8px 24px rgba(42,32,22,.08);transform:translateY(110%);transition:transform .3s cubic-bezier(.2,.7,.2,1)}
#buybar.po-bar.on{transform:none}
#buybar .pb-txt{min-width:0;flex:1}
#buybar .pb-p{display:block;font:600 16px/1.2 Jost,system-ui,sans-serif;color:#2A2016}
#buybar .pb-s{display:block;font:12.5px/1.3 Jost,system-ui,sans-serif;color:#4A4136;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#buybar .pb-sz{display:flex;gap:6px}
#buybar .pb-sz button{min-width:40px;min-height:44px;padding:0 6px;border:1px solid rgba(42,32,22,.35);background:#FAF6EF;border-radius:8px;font:500 15px Jost,system-ui,sans-serif;color:#2A2016}
#buybar .pb-sz button[aria-pressed="true"]{background:#2A2016;color:#FAF6EF;border-color:#2A2016}
#buybar .pb-sz button:disabled{opacity:.45;border-style:dashed}
#buybar .pb-go{min-height:48px;padding:0 18px;border:0;border-radius:999px;background:#2A2016;color:#FAF6EF;font:600 15px Jost,system-ui,sans-serif;white-space:nowrap}
#buybar .pb-go:disabled{background:#6B6256}
#buybar.pb-has-sz .pb-txt{display:none}
@media(max-width:900px){#buybar.po-bar{display:flex}}
@media(max-width:360px){#buybar .pb-sz button{min-width:36px;padding:0 4px}}
@media(prefers-reduced-motion:reduce){#buybar.po-bar{transition:none}.po-sizes.flash{animation:none;background:rgba(243,221,184,.3)}}
`;

/* 30 Oct 2026: the old buy box (buyBox) and its script (CLIENT) gave way to the Specimen Sheet: specimen.js + assets/sahra-specimen.js */
/* the shop's real review total (Judge.me, content/reviews), for the line under the product name. Sahel and Sahra Trail
   have no reviews of their own yet, so it says whose they are. */
/* 10 Nov 2026 (site scorecard, six of eight reviewers: no customer voice near the decision on the Sahel pages). Sahel pieces
   are new and have no reviews of their own, so the page shows two real reviews of the Founding Edition and says plainly
   that is what they are, with the piece each buyer bought under each review. Never on Sahra Trail. Picked the same way on every build:
   named, verified, five stars, a comment of 60 to 240 characters, newest first, two different designs. */
function firstReviews() {
  try {
    const RV = require('./reviews-render.js');
    const flat = [];
    for (const d of RV.loadAll()) for (const r of d.reviews) flat.push(Object.assign({}, r, { product: d.handle }));
    const total = flat.length;
    const design = h => String(h).replace(/-(regular|oversized)$/, '');
    /* 12 Nov 2026: Sahel and Sahra Trail pieces now carry reviews of their own; this block and the line
       under the name still speak for the Founding Edition only, as they say */
    const own = new Set(products().map(x => x.handle));
    const ok = flat.filter(r => r.product !== '_shop' && !own.has(r.product) && r.verified && r.name && !/^anonymous$/i.test(r.name.trim()) && Number(r.rating) === 5 && r.body && r.body.length >= 60 && r.body.length <= 240).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(a.name).localeCompare(String(b.name)) || String(a.product).localeCompare(String(b.product)));
    const pick = [];
    for (const r of ok) { if (pick.length < 2 && !pick.some(x => design(x.product) === design(r.product))) pick.push(r); }
    if (pick.length < 2) return '';
    const month = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }); };
    return `<section class="po-rv" id="first-reviews" aria-labelledby="poRvH"><h2 id="poRvH">From buyers of our first pieces</h2>
    <p class="po-small">This piece is new and has no reviews of its own yet. These are from customers who bought the Founding Edition.</p>
    <ul class="po-rv-l">${pick.map(r => `<li><b class="po-rv-s" aria-label="5 out of 5 stars">&#9733;&#9733;&#9733;&#9733;&#9733;</b><p data-ar-rule="ugc">${esc(r.body)}</p><span data-ar-rule="rv-meta|1|${String(r.date || '').slice(0, 7)}">${esc(r.name.trim())} \u00b7 Verified buyer${month(r.date) ? ' \u00b7 ' + month(r.date) : ''}</span><span class="po-rv-on" data-ar-rule="rv-bought|${RV.arg(RV.productName(r.product) || '')}">Bought: ${esc(RV.productName(r.product) || 'a Founding Edition piece')}</span></li>`).join('')}</ul>
    <p class="po-small"><a href="/#s-reviews"><span data-ar-rule="rv-all|${total}">All ${total} reviews &rarr;</span></a></p></section>`;
  } catch (e) { return ''; }
}
const RATING_D = (function () { try { const own = new Set(products().map(x => x.handle)); const a = require('./reviews-render.js').loadAll().filter(d => !own.has(d.handle)); let n = 0, t = 0; a.forEach(d => { n += d.count; t += d.average * d.count; });
  return n >= 5 ? { avg: (t / n).toFixed(1), n } : null; } catch (e) { return null; } })();
const RATING = RATING_D ? `${RATING_D.avg} from ${RATING_D.n} customer reviews of our Founding Edition` : '';

/* 12 Nov 2026 (Faheem: Sahel and Sahra Trail reviews "on their product pages"). A piece's own reviews,
   every fit of the design together, as on the Founding Edition pages. Until a design has one, the page
   keeps the two Founding Edition reviews (Sahel) or nothing (Sahra Trail). */
function designHandlesOf(p) { return p.fitsList ? p.fitsList.map(f => f.handle) : [p.handle]; }
function ownReviews(p) {
  try {
    const RV = require('./reviews-render.js');
    const d = RV.merge(designHandlesOf(p)); if (!d) return null;
    const avg = d.average.toFixed(1), n = d.count, k = RV.starCount(d.average);
    return {
      line: `<a class="po-rate" href="#reviews"><b aria-hidden="true">${'&#9733;'.repeat(k)}${'&#9734;'.repeat(5 - k)}</b><span data-ar-rule="rv-design|${avg}|${n}">${avg} &middot; ${n} review${n === 1 ? '' : 's'} of this design</span></a>`,
      section: `<style>${RV.CSS}.po-rv-own{max-width:900px;padding:22px 18px 16px}.po-rv-own h2{margin:0 0 12px}.po-rv-own .rv-aggregate{margin-bottom:16px}.po-rv-own .rv-card{background:#fff}@media(min-width:900px){.po-rv-own{padding:28px 28px 20px}}</style>` + RV.productSection(p.handle, String(p.plain || p.name).replace(/&amp;/g, '&'), designHandlesOf(p), { bare: true })
    };
  } catch (e) { console.log(`  ! reviews for ${p.handle} could not be shown: ${e.message}`); return null; }
}

function productPage(p, all, SITE, stage) {
  const own = ownReviews(p);
  const others = all.filter(o => o.line === p.line && o.handle !== p.handle && !(o.name === p.name) && onSale(o)).filter((o, i, a) => a.findIndex(x => x.name === o.name) === i).slice(0, 4);   /* 14 Nov 2026: one row of four (review panel) */
  const card = o => `<a class="po-card" href="/products/${o.handle}/">${o.images.length ? `<div class="po-fig" data-cycle>${cycleImgs(o, { sizes: '(max-width: 900px) 50vw, 220px' })}${o.images[0].mock ? '<figcaption class="po-mock">Mock-up</figcaption>' : ''}</div>` : `<div class="po-ph"><div><span>Photo to follow</span></div></div>`}<b>${o.name}</b>${cardPrice(o.price, 'span', o.inHand, o.handle)}</a>`;
  const placeLink = p.place ? `<p class="po-small">The place: <a href="/locations/${p.place[1]}/">${p.place[0]} &rarr;</a></p>` : '';
  /* 30 Oct 2026 (Faheem approved): the Specimen Sheet, the same top and buy sheet as the Founding Edition pages (specimen.js) */
  const S = SP.fromPreorder(p);
  const ask = `<a href="${WA}?text=${encodeURIComponent('Hi, a size question about ' + (/^The /.test(p.plain) ? p.plain : 'the ' + p.plain) + ' before I order.')}" target="_blank" rel="noopener">`;
  /* 31 Oct 2026: the fit line by the sizes on a Super Oversized page; a paused Oversized page has no chart until the fit returns */
  const fitLine = p.fit === 'Super Oversized' ? `<p class="ss-help ss-fitline">${/hoodie/i.test(p.kind) ? 'Roomy, with a dropped shoulder. Most people take one size down from their usual size.' : 'Super Oversized, drop shoulder: about one size bigger than our Founding Edition Oversized. If you know your Founding size, go one size down.'}</p>`
    /* 14 Nov 2026: the Oversized fit is back on the original Oversized charts */
    : p.fit === 'Oversized' && onSale(p) ? `<p class="ss-help ss-fitline">${/hoodie/i.test(p.kind) ? 'Our original Oversized hoodie: relaxed, and closer than the Super Oversized. Take your usual size.' : 'Our original Oversized cut, on the same chart as our Founding Edition Oversized. If you know your Founding size, take the same size.'}</p>` : '';
  const paused = !onSale(p);
  /* 10 Nov 2026 (site scorecard, behavioural review: the fit answer sat four screens below the size buttons): the size the
     model wears is said beside the size help, where every photo on the page is the same size */
  const worn = S.onModel && S.onModel.size ? `The model wears ${S.onModel.size}. ` : '';
  /* 12 Nov 2026 (Size finder 2, Faheem: "On every product page"): the help line leads to the size finder, which opens as a sheet */
  const SFD = require('./sizefinder-data.js'), sf = paused ? '' : SFD.mount(SFD.forNewLine(p, SZ, TSZ), { handle: p.handle });
  const find = sf ? `<a href="#size-finder" class="pdp-chart">Find your fit with our size finder</a>. ` : '';
  const help = p.oneSize || paused ? '' : SZ.keyFor(p) ? `${fitLine}<p class="ss-help">${find}${worn}Still unsure? ${ask}Message us.</a></p>` : TSZ.keyFor(p) ? `<p class="ss-help">${find}Sahra Trail has its own sizes, separate from our tees. Still unsure? ${ask}Message us.</a></p>` : `<p class="ss-help">No size chart for this piece yet. Unsure of your size? ${ask}Message us before you order.</a></p>`;
  const sup = (p.fitsList || []).find(f => f.fit === 'Super Oversized' && f.onSale), reg = (p.fitsList || []).find(f => f.fit === 'Regular' && f.onSale);
  const pausedChart = paused && p.line === 'sahel' && p.fit === 'Oversized'
    ? `<section class="po-size" id="size-chart"><h2>Size chart</h2><p class="po-ask">The Oversized chart will be published when the fit returns. Until then, see ${[sup ? `<a href="/products/${sup.handle}/#size-chart">Super Oversized</a>` : '', reg ? `<a href="/products/${reg.handle}/#size-chart">Regular</a>` : ''].filter(Boolean).join(' and ')}.</p><p class="po-small" style="margin-top:12px">Every chart, both lines: <a href="/size-guide/#sahel">the size guide &rarr;</a></p></section>` : '';
  return `${stageHead()}${SP.preload(S)}${SP.HEAD}<style>${CSS}</style>
<main class="po-main">
  ${SP.top(S, {
    crumb: `<nav class="ss-crumb" aria-label="Breadcrumb"><a href="/">Home</a><i aria-hidden="true">/</i><a href="/new/#${p.line}">${p.line === 'sahel' ? 'Sahel' : 'Sahra Trail'}</a><i aria-hidden="true">/</i><span aria-current="page">${p.title}</span></nav>`,
    h1: p.title,
    /* 14 Nov 2026 (Faheem): Tabby as one line under the price; the widget box is gone (it was on every product page from 13 Nov) */
    rating: own ? own.line : RATING && p.line === 'sahel' ? `<a class="po-rate" href="${firstReviews() ? '#first-reviews' : '/#s-reviews'}"><b aria-hidden="true">${'&#9733;'.repeat(Math.floor(+RATING_D.avg))}${'&#9734;'.repeat(5 - Math.floor(+RATING_D.avg))}</b><span data-ar-rule="rv-founding|${RATING_D.avg}|${RATING_D.n}">${RATING}</span></a>` : '',   /* 10 Nov 2026: not on Sahra Trail, whose running wear has no reviews of its own (Trail merge handoff, step 8) */
    help,
    /* 14 Nov 2026 (review panel): the delivery and returns paragraph repeated the promise line; Tabby's legal line stays */
    extra: `<p class="po-tabby-fine sb-ship-uae">Pay Later (Short Term Credit) is provided by Tabby LLC. Terms and conditions apply. For more information or to contact us, visit tabby.ai.</p>`
  })}
  <div class="po-wrap">
  ${own ? own.section : p.line === 'sahel' ? firstReviews() : ''}
  ${/* 14 Nov 2026 (review panel): the story is the reason to buy, but opt-in: a closed group with its first lines showing */''}<details class="pdp-acc po-acc"><summary class="pdp-acc-h has-ts"><span class="pdp-acc-hr"><span>${p.line === 'sahel' ? 'The story and the design' : 'The piece and the details'}</span><i aria-hidden="true">+</i></span><span class="pdp-acc-ts">${teaser(p.story)} <b>Read the story</b></span></summary>
  <section class="po-story">
    <div><h2>${p.line === 'sahel' ? 'The story' : 'The piece'}</h2><p>${p.story}</p>${placeLink}</div>
    <div><h2>Details</h2><ul>${p.details.map(d => `<li>${d}</li>`).join('')}</ul>
      <p class="po-small" style="margin-top:12px">${p.images.length && p.images.every(i => i.mock) ? 'The studio images are mock-ups. We will add photos of the real pieces when they arrive.' : p.images.some(i => i.mock) ? (p.images[0].mock ? 'The images marked Mock-up are studio mock-ups; the close-ups are photographed from the sample.' : 'Photographed from the real piece. The image marked Mock-up is a studio mock-up until that side is photographed.') : p.inHand ? 'Photographed from the real bag, on a studio backdrop.' : p.images.some(i => i.studio) ? '' : p.line === 'sahel' ? 'Photographed from the real piece.' : ''} Designed in the UAE.</p></div>
  </section></details>
  ${pausedChart}${(SZ.keyFor(p) || TSZ.keyFor(p) || sf) ? `<details class="pdp-acc po-acc" id="size-chart-g"><summary class="pdp-acc-h"><span>${p.kit ? 'Size charts' : 'Size chart'}</span><i aria-hidden="true">+</i></summary>${sf ? sf + SFD.SCRIPT : ''}${SZ.keyFor(p) ? `<section class="po-size" id="size-chart"><h2>Size chart</h2>${/* 30 Oct 2026 (r89): the Founding Edition to Sahel size note sits with the chart */''}${foundingMatch(SZ.keyFor(p))}${SZ.block(SZ.keyFor(p))}<p class="po-small" style="margin-top:12px">Every chart, both lines: <a href="/size-guide/#sahel">the size guide &rarr;</a></p></section>` : ''}${TSZ.keyFor(p) ? `<section class="po-size" id="size-chart"><h2>${p.kit ? 'Size charts' : 'Size chart'}</h2>${TSZ.block(TSZ.keyFor(p))}<p class="po-small" style="margin-top:12px">Every chart: <a href="/size-guide/#trail">the size guide &rarr;</a></p></section>` : ''}</details>` : ''}
  ${others.length ? `<section class="po-more"><h2>${p.line === 'sahel' ? 'More from Sahel' : 'More from Sahra Trail'}</h2><div class="po-cards">${others.map(card).join('')}</div></section>` : ''}
  ${/* 14 Nov 2026 (Faheem: "One row + Next piece"): the other new line and the Founding Edition rows moved to the homepage and shop */''}${require('./capture.js').link('pdp')}
  </div>
  ${SP.nextPiece(S)}
</main>
${SP.SCRIPT}`;
}

/* 27 Oct 2026 (Faheem: "Cross-sell between lines"): every Sahel and Sahra Trail page also shows the other new line
   and the Founding Edition, which is in stock and ships next working day. */
const FOUNDING = [['al-quaa-galaxy-regular', 'Al Quaa Galaxy Tee', 'alquaa-dune-back', 'Al Quaa Galaxy t-shirt in black, back print, worn', 199],
  ['empty-quarter-regular', 'Empty Quarter Tee', 'emptyquarter-dune-front', 'Empty Quarter t-shirt in beige, front, worn', 199],
  ['hajar-mountains-regular', 'Hajar Mountains Tee', 'hajar-dune-back', 'Hajar Mountains t-shirt, back print, worn', 199],
  ['sand-polo', 'The Sahra Polo', 'polo-dune-front', 'The Sahra Polo in sand, worn', 229]];
/* every photo of a Founding piece for its card (the same list build.js gives the run-time code as SB_IMGS),
   using the 800px card copies where they exist */
function foundingImgs(handle, img, alt) {
  const fs = require('fs'), path = require('path');
  let list = [];
  try {
    const fp = require('./build-products.js').loadProducts(__dirname).find(x => x.id === handle);
    if (fp) { const seen = new Set(); for (const [src, a] of [[fp.imgMain, fp.altMain], [fp.imgFront, fp.altFront], [fp.imgBack, fp.altBack]].concat((fp.modelShots || []).map(m => [m.src, m.alt]))) {
      if (!src) continue; const b = path.basename(String(src)).replace(/\.(jpe?g|png)$/i, '.webp'); if (seen.has(b)) continue; seen.add(b);
      if (fs.existsSync(path.join(__dirname, 'shirts', 'card', b))) list.push([`/shirts/card/${b}`, a || alt]); } }
  } catch (e) {}
  if (!list.length) list = [[`/shirts/card/${img}.webp`, alt]];
  return list.map(([src, a], i) => `<img${i ? '' : ' class="on"'} src="${src}" width="800" height="1000" alt="${esc(String(a || alt).replace(/&amp;/g, '&'))}" loading="lazy" decoding="async">`).join('');
}
/* 14 Nov 2026: the first lines of the story, shown under the closed story group (plain text, about 170 characters) */
function teaser(html) {
  const t = String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return t.length > 170 ? t.slice(0, t.lastIndexOf(' ', 165)) + '\u2026' : t;
}
function crossLines(p, card) {
  const other = pickNew(o => o.line !== p.line && o.line !== undefined && !o.inHand, true).slice(0, 4);
  const fe = FOUNDING.map(([h, n, img, alt, pr]) => `<a class="po-card" href="/products/${h}/"><div class="po-fig" data-cycle>${foundingImgs(h, img, alt)}</div><b>${n}</b><span><span class="sb-price" data-handle="${h}" data-aed="${pr}">${money(pr)}</span> &middot; in stock</span></a>`).join('');
  return `${other.length ? `<section class="po-more po-cross"><h2>${p.line === 'sahel' ? (IN_HAND ? 'Also new: Sahra Trail' : 'Also on pre-order: Sahra Trail') : (IN_HAND ? 'Also new: Sahel' : 'Also on pre-order: Sahel')}</h2><div class="po-cards">${other.map(card).join('')}</div></section>` : ''}
  <section class="po-more po-cross"><h2>The Founding Edition, in stock</h2><p class="po-small" style="margin:-4px 0 14px">Ships next working day.<span class="sb-aed-only"> Any two Founding Edition tees for AED 359.</span> They have their own size chart.</p><div class="po-cards">${fe}</div></section>`;
}
/* the reverse row, for the Founding Edition product pages (build-products.js) */
function foundingCross() {
  const list = ['khor-fakkan-bay-tee-regular', 'al-aqah-reef-tee-regular', 'ras-al-khor-hoodie', 'sahra-trail-kit'].map(h => products().find(x => x.handle === h)).filter(Boolean).map(p => onSale(p) ? p : products().find(x => x.handle === 'the-sahel-polo')).filter(Boolean);
  return newBlock({ compact: true, list, heading: 'Also new: Sahel and Sahra Trail', kicker: inc('st1', '<span class="st1">On pre-order &middot; 20% off until Thu 29 Oct</span>') + '<span class="st02">New</span>',
    lede: 'Sahel, the Coast Edition, and Sahra Trail running wear.' + (IN_HAND ? ' In stock, shipping next working day.' : ' Pre-orders ship from Fri 30 Oct.') + ' Sahel has <a href="/size-guide/#sahel">its own size chart</a>.', fitsLabel: true, more: '/new/', moreText: 'See every new piece' });
}

function collectionPage(all) {
  /* 10 Nov 2026 (Stage 3, the house look): /new/ opens like every other listing page (heroes.js house()) and lists
     Sahel and Sahra Trail in ONE grid of the site's product card, one card per design with its fits on the switch.
     #sahel and #trail still land: on the grid, and on the first Sahra Trail card. The old page had its own heading
     block, two headed sections and the small po-card (kept for the "More from" rails on product pages). */
  const sahel = pickNew(p => p.line === 'sahel', true), trail = pickNew(p => p.line === 'trail');
  const cards = sahel.map(p => designCards(p, true)).join('')
    + trail.map((p, i) => { const h = designCards(p, false); return i ? h : h.replace('<article class="pcard', '<article id="trail" class="pcard'); }).join('');
  return `${require('./heroes.js').house('new', { h1: 'Sahel and Sahra Trail are out', line: 'Designed in the UAE for everyone who loves it.', crumbs: '<a href="/">Home</a> &rsaquo; <span>New</span>' })}
<main>
  ${stageHead()}${NB_CSS}${BIG_CSS}<section class="nb hg${require('./sale.js').on() ? ' hg-sale' : ''}" id="sahel" aria-label="Sahel and Sahra Trail"><div class="pcards nb-pc">${cards}</div><p class="hg-note">${newLede()} Super Oversized has a dropped shoulder; Oversized is our original cut.</p></section>
  <p class="back"><a href="/shop/">All products &rarr;</a></p>
</main>`;
}

/* 23 Oct 2026 (site review): Sahel and Sahra Trail pieces on the category and buying pages
   (/t-shirts/, /t-shirts/regular|oversized/, /polos/, /hoodies/, /gifts/, /national-day/, /shop/).
   pickNew(filter) returns product entries; newBlock() renders them as cards with the Mock-up label,
   the stage-aware price and the pre-order line. One card per design unless both fits are asked for. */
/* paused pieces (specimen.js PAUSED, 30 Oct 2026) keep their own pages but are not listed for sale elsewhere;
   pass keepPaused for a page about that piece itself (/hoodies/) */
const onSale = p => !require('./specimen.js').PAUSED[p.handle];
/* 31 Oct 2026: the one product that stands for its design where a list shows one card per design or place (map pins,
   place pages, /places/, the shop map): on sale, and the design's first fit on sale in the order Regular, Super
   Oversized, Oversized (so a tee is its Regular, a hoodie its Super Oversized). Pieces with no fit stand for themselves. */
const PRIMARY_ORDER = ['Regular', 'Super Oversized', 'Oversized'];
const primaryHandle = p => { if (!p.fitsList) return p.handle; const f = PRIMARY_ORDER.map(F => p.fitsList.find(x => x.fit === F && x.onSale)).find(Boolean); return f ? f.handle : null; };
const primary = p => onSale(p) && primaryHandle(p) === p.handle;
const isTee = p => /T-shirt/.test(p.kind || '') && p.line === 'sahel';
function pickNew(test, perDesign, keepPaused) {
  const list = products().filter(p => test(p) && (keepPaused || onSale(p)));
  return perDesign ? list.filter((p, i, a) => a.findIndex(x => x.name === p.name) === i) : list;
}
const NB_CSS = `<style>
.nb{max-width:1180px;margin:0 auto;padding:34px 20px 10px}
.nb-k{font:12px/1.4 'Space Mono',ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:#7E4114;margin:0 0 8px}
.nb h2{font:600 clamp(26px,3vw,36px)/1.1 'Cormorant Garamond',Georgia,serif;margin:0 0 8px;color:#2A2016}
.nb-l{font:16px/1.55 Jost,system-ui,sans-serif;margin:0 0 16px;color:#4A4136;max-width:62ch}
.nb-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px}
.nb-c{display:block;text-decoration:none;color:#2A2016}
.nb-f{display:block;position:relative;margin:0;background:#F2EDE6;border-radius:10px;overflow:hidden;aspect-ratio:4/5}
.nb-f img{width:100%;height:100%;object-fit:cover;display:block}
${CYCLE_CSS}
.nb-f .cut-b,.pcard-img .cut-b{position:absolute;left:8px;bottom:8px;z-index:2;font:600 10.5px/1 Jost,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;font-style:normal;padding:5px 8px;border-radius:999px;background:rgba(42,32,22,.82);color:#FAF6EF;pointer-events:none}
.nb-f i{position:absolute;left:8px;top:8px;font:10px/1 'Space Mono',ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;font-style:normal;padding:5px 7px;border-radius:4px;background:rgba(250,246,239,.92);color:#2A2016}
.nb-c b{display:block;font:500 16px/1.35 Jost,system-ui,sans-serif;margin:8px 0 2px}
.nb-c small{display:block;font:13px/1.45 Jost,system-ui,sans-serif;color:#4A4136}
.nb-c .nb-p{font:500 14px Jost,system-ui,sans-serif;color:#2A2016;margin-top:2px}
.nb-c:focus-visible{outline:3px solid #7E4114;outline-offset:3px;border-radius:10px}
.nb-a{display:inline-block;margin:16px 0 0;font:600 15px Jost,system-ui,sans-serif;color:#7E4114}
@media(max-width:700px){.nb{padding:26px 16px 6px}.nb-g{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}}
</style>`;
/* 24 Oct 2026 (Faheem, after the navigation panel): who each piece is cut for. Tees and the Sahel hoodies
   are unisex; the Sahel Polo and the Sahra Trail pieces are men's; the bags are one size. Drives the card
   badge and the /men/ and /women/ pages. */
function cut(p) {
  if (p.oneSize) return 'One size';
  if (p.line === 'trail' || /polo/i.test(p.kind || '')) return 'Men\u2019s cut';
  return 'Unisex';
}
const forWomen = p => cut(p) !== 'Men\u2019s cut';
/* the fits a design is on sale in, for a one-card-per-design list (31 Oct 2026): "Regular or Super Oversized" for a Sahel
   tee while its Oversized is being re-cut, "Super Oversized fit" for a hoodie */
const FIT_LIST_ORDER = ['Regular', 'Oversized', 'Super Oversized'];
const bothFits = p => {
  const on = (p && p.fitsList ? p.fitsList.filter(f => f.onSale).map(f => f.fit) : [p && p.fit].filter(Boolean)).sort((a, b) => FIT_LIST_ORDER.indexOf(a) - FIT_LIST_ORDER.indexOf(b));
  return !on.length ? '' : on.length === 1 ? `${on[0]} fit` : on.length === 2 ? on.join(' or ') : on.slice(0, -1).join(', ') + ' or ' + on[on.length - 1];
};
function newCard(p, fitsLabel) {
  const im = p.images[0];
  const fig = im ? `<span class="nb-f" data-cycle>${cycleImgs(p, { sizes: '(max-width: 700px) 50vw, 280px' })}${mockTag(im)}<em class="cut-b">${cut(p)}</em></span>` : '';
  const sub = fitsLabel && p.fit ? `${p.kind} &middot; ${bothFits(p)}` : `${p.kind}${p.fit ? ` &middot; ${p.fit} fit` : ''}`;
  const href = `/products/${p.handle}/`;
  if (p.inHand) return `<a class="nb-c" href="${href}">${fig}<b>${p.name}</b><small>${sub}</small><small class="nb-p">${onSale(p) ? cardPrice(p.price, 'span', true, p.handle) : 'Back soon'}</small>`
    + inc('st0', `<small class="st0">On sale from Wed 28 Oct</small>`) + `<small class="st12">In stock, ships next working day</small></a>`;
  return `<a class="nb-c" href="${href}">${fig}<b>${p.name}</b><small>${sub}</small><small class="nb-p">${onSale(p) ? cardPrice(p.price, 'span', false, p.handle) : 'Back soon'}</small>`
    + inc('st0', `<small class="st0">Pre-order opens Wed 28 Oct</small>`) + inc('st1', `<small class="st1">Pre-order, ships from Fri 30 Oct</small>`)
    + (IN_HAND ? '' : `<small class="st2">Pre-order, ships from Fri 30 Oct</small>`) + `</a>`;
}
/* 3 Nov 2026 (Faheem: "Why don't Sahel items have similar cards. They're different and smaller. We need to highlight
   all our products"): every list block (newBlock) draws Sahel and Sahra Trail pieces as the same product card as the
   Founding Edition (build.js productCard, article.pcard): the photo with zoom, name, rating, "Inspired by", spec chips,
   colour, price and Full details, plus quick add (sahra-cart.js binds to .pcard[data-handle]). The chips come from the
   piece's own details, never assumed. Where a list shows one card per design (fitsLabel), the fits on sale sit behind a
   Regular | Super Oversized switch (.sfp), the way the Founding Edition pairs Regular and Oversized; its own switch, so
   choosing a Founding fit never changes a Sahel card. newCard() stays for the designed line pages (/sahel/, /trail/, the
   home Lines band). Colour swatches: the Pantone TCX colours of the Sahel cloth (Lagoon as in content/sahel-pieces.json). */
const RV = require('./reviews-render.js');
const SWATCH = { 'Jet Set': '#2A2016', 'Estate Blue': '#2A2016', 'Lagoon': '#2A2016', 'Salute': '#2A2016', 'Black': '#2A2016', 'Demitasse': '#2A2016' };
function specChips(p) {
  const det = (p.details || []).filter(x => !/neck label/i.test(x)).join(' | ');
  const c = [];
  if (/(^| \| )Cotton( \| |$)/.test(det)) c.push('Cotton');
  else if (/piqu/i.test(det)) c.push('Mercerised piqu&eacute;');
  else if (/canvas/i.test(det)) c.push('Natural canvas');
  else if (/mesh/i.test(det)) c.push('Mesh side panels');
  else if (/liner/i.test(p.md || '')) c.push('Inner liner');
  if (p.fit) c.push(`${p.fit} fit`);
  const dtg = /DTG/i.test(det), emb = /embroider|thread/i.test(det);
  if (dtg || emb) c.push(dtg && emb ? 'DTG + embroidery' : dtg ? 'DTG print' : 'Embroidered');
  else if (/printed/i.test(det)) c.push('Printed');
  if (p.oneSize) c.push('One size');
  else if (/kit/i.test(p.handle)) c.push('Tee + short');
  else c.push(cut(p) === 'Unisex' ? 'Unisex S&ndash;XL' : 'Men&rsquo;s S&ndash;XL');
  return c;
}
function bigCard(p, i) {
  const im = p.images[0], href = `/products/${p.handle}/`;
  const zoom = `<button type="button" class="pcard-zoom" data-zoom="/assets/preorder/${im ? im.k : ''}-1200.webp" aria-label="Zoom ${esc(p.plain || p.name)}"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.2 15.2 20 20M10.5 7.8v5.4M7.8 10.5h5.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>`;
  const img = im ? `<span class="pcard-img" style="background:#F2EDE6"><a class="pcard-imglink" href="${href}" tabindex="-1" data-cycle>${cycleImgs(p, { sizes: '(max-width: 560px) 50vw, 300px' })}</a>${mockTag(im)}<em class="cut-b">${cut(p).replace('\u2019', '&rsquo;')}</em>${zoom}</span>` : '';
  const place = p.place ? `Inspired by ${p.place[0]}` : p.line === 'trail' ? 'Sahra Trail' : 'Sahel &middot; the Coast Edition';
  const hex = SWATCH[p.colour];
  const colour = p.colour ? `<span class="pcard-col">${hex ? `<span class="pcard-sw" style="background:${hex}"></span>` : ''}${p.colour}</span>` : '';
  const chips = specChips(p).map(c => `<span${/^(Cotton|Unisex S&ndash;XL)$/.test(c) ? ' class="pc-same"' : ''}>${c}</span>`).join('');
  const price = onSale(p) ? cardPrice(p.price, 'span', !!p.inHand, p.handle) : 'Back soon';
  const stock = !onSale(p) ? '' : p.inHand
    ? inc('st0', `<span class="pcard-st st0">On sale from Wed 28 Oct</span>`) + `<span class="pcard-st st12">In stock, ships next working day</span>`
    : inc('st0', `<span class="pcard-st st0">Pre-order opens Wed 28 Oct</span>`) + inc('st1', `<span class="pcard-st st1">Pre-order, ships from Fri 30 Oct</span>`) + (IN_HAND ? '' : `<span class="pcard-st st2">Pre-order, ships from Fri 30 Oct</span>`);
  const noqa = p.oneSize || /kit/i.test(p.handle) ? ' data-noqa' : '';   /* quick add would offer "Default Title", or 16 tee/short pairs */
  return `<article class="pcard${i != null ? (i ? '' : ' on') : ''}" data-handle="${p.handle}"${i != null ? ` data-i="${i}"` : ''}${noqa}>${img}<span class="pcard-b"><a class="pcard-t" href="${href}">${p.name}</a>${RV.cardRating(p.handle)}<span class="pcard-place">${place}</span><span class="pcard-spec">${chips}</span>${colour}${stock}<span class="pcard-foot"><span class="pcard-p">${price}</span><a class="pcard-cta" href="${href}">Full details &rarr;</a></span></span></article>`;
}
/* one design: its fits on sale behind a switch, or the one card */
function designCards(p, fitsLabel) {
  if (!fitsLabel || !p.fitsList) return bigCard(p);
  const all = products();
  const ORD = ['Regular', 'Oversized', 'Super Oversized'];   /* 14 Nov 2026: the fits read in size order on the card's tabs */
  const fits = p.fitsList.filter(f => f.onSale).map(f => all.find(x => x.handle === f.handle)).filter(Boolean).sort((x, y) => ORD.indexOf(x.fit) - ORD.indexOf(y.fit));
  if (fits.length < 2) return bigCard(p);
  return `<div class="sfp"><div class="sfp-sw" role="group" aria-label="Fit">${fits.map((f, i) => `<button type="button"${i ? '' : ' class="on"'} data-i="${i}" aria-pressed="${i ? 'false' : 'true'}">${f.fit}</button>`).join('')}</div>${fits.map((f, i) => bigCard(f, i)).join('')}</div>`;
}
const BIG_CSS = `<style>
.nb .pcards.nb-pc{margin:6px 0 4px}
.pcard-img>i{position:absolute;right:8px;top:8px;z-index:2;font:10px/1 'Space Mono',ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;font-style:normal;padding:5px 7px;border-radius:4px;background:rgba(250,246,239,.92);color:#2A2016;pointer-events:none}
.pcard-st{font:13px/1.4 Jost,system-ui,sans-serif;color:#3F6B3A}
.sfp{position:relative;display:flex;flex-direction:column;min-width:0}.sfp>.pcard{display:none;flex:1}.sfp>.pcard.on{display:flex}
.sfp:not(:has(>.pcard:not(.sbf-off))){display:none}
.sfp-sw{position:absolute;top:10px;inset-inline-start:10px;z-index:3;display:inline-flex;padding:3px;border-radius:999px;background:rgba(42,32,22,.72);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);gap:2px;max-width:calc(100% - 20px)}
.sfp-sw button{font:inherit;font-size:11px;letter-spacing:.3px;padding:5px 10px;border:0;border-radius:999px;background:transparent;color:rgba(250,246,239,.8);cursor:pointer;line-height:1.2;white-space:nowrap}
.sfp-sw button.on{background:#FAF6EF;color:#2A2016;font-weight:600}
.sfp-sw button:focus-visible{outline:2px solid #F3DDB8;outline-offset:1px}
@media(max-width:560px){.sfp-sw{top:6px;inset-inline-start:6px;max-width:calc(100% - 12px);padding:2px}.sfp-sw button{font-size:10px;letter-spacing:0;padding:5px 6px}.pcard-st{font-size:12px}}
</style><script>(function(){if(window.__sfp)return;window.__sfp=1;document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('.sfp-sw button');if(!b)return;e.preventDefault();e.stopPropagation();var w=b.closest('.sfp'),i=b.getAttribute('data-i');
var tgt=[].filter.call(w.children,function(c){return c.classList.contains('pcard')&&c.getAttribute('data-i')===i;})[0];if(tgt&&tgt.classList.contains('sbf-off'))return;   /* 14 Nov 2026: a fit hidden by the discount filter stays hidden */
[].forEach.call(w.querySelectorAll('.sfp-sw button'),function(x){var on=x.getAttribute('data-i')===i;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on?'true':'false');});
[].forEach.call(w.children,function(c){if(c.classList.contains('pcard'))c.classList.toggle('on',c.getAttribute('data-i')===i);});
if(e.detail===0){var nb=w.querySelector('.pcard.on .sfp-sw button[data-i="'+i+'"]');if(nb)nb.focus();}   /* 14 Nov 2026: keyboard focus follows into the card now shown */
var on=w.querySelector('.pcard.on');if(window.track)track('fit_switch',on&&on.getAttribute('data-handle')?{item_id:on.getAttribute('data-handle'),via:'card'}:{fit:b.textContent,via:'card'});},true);})();</script>`;
function newBlock({ list, heading, lede, kicker, fitsLabel, more = '/new/', moreText = 'See every new piece', pre = '', compact = false }) {
  if (!list.length && !pre) return '';
  /* compact: the small cross-sell cards, for the "Also new" rail on a Founding Edition product page (no product-card CSS there) */
  if (compact) return stageHead() + NB_CSS + `<section class="nb" aria-label="${esc(String(heading).replace(/&[a-z]+;/g, ' '))}">
  <p class="nb-k">${kicker || 'New &middot; Sahel and Sahra Trail'}</p><h2>${heading}</h2>${lede ? `<p class="nb-l">${lede}</p>` : ''}
  <div class="nb-g">${pre}${list.map(p => newCard(p, fitsLabel)).join('')}</div>
  ${more ? `<a class="nb-a" href="${more}">${moreText} &rarr;</a>` : ''}
</section>`;
  return stageHead() + NB_CSS + BIG_CSS + `<section class="nb" aria-label="${esc(String(heading).replace(/&[a-z]+;/g, ' '))}">
  <p class="nb-k">${kicker || 'New &middot; Sahel and Sahra Trail'}</p><h2>${heading}</h2>${lede ? `<p class="nb-l">${lede}</p>` : ''}
  <div class="pcards nb-pc">${pre}${list.map(p => designCards(p, fitsLabel)).join('')}</div>
  ${more ? `<a class="nb-a" href="${more}">${moreText} &rarr;</a>` : ''}
</section>`;
}
const newLede = () => inc('st0', `<span class="st0">On pre-order from Wed 28 Oct at 8 AM, UAE time.</span>`)
  + inc('st1', `<span class="st1">Pre-order is open: 20% off these new pieces until Thu 29 Oct, 23:59. Ships from Fri 30 Oct.</span>`)
  + `<span class="st2">${IN_HAND ? '' : 'Pre-orders ship from Fri 30 Oct.'}</span>`
  + ' Sahel has <a href="/size-guide/#sahel">its own size chart</a>, cut larger than the Founding Edition. Sahra Trail has <a href="/size-guide/#trail">its own chart</a> too. No chart yet for the Sahel Polo: <a href="https://wa.me/971585449946" target="_blank" rel="noopener">message us</a> about your size before you order.';

/* 10 Nov 2026 (landing-page audit): the Sahra Trail blocks carried the Sahel lede ("Sahel has its own size chart..."), which
   is about another line. Trail gets its own line: the true state of its sizing, and nothing about Sahel. */
/* 10 Nov 2026 (later): the Trail charts are published (trail-sizing.js), so the line points at them */
const trailLede = () => 'Sahra Trail has <a href="/size-guide/#trail">its own size chart</a>. It is a separate pattern, so your size in our tees does not carry over.';
/* 23 Oct 2026 (site review): a place guide whose place became a Sahel piece shows that piece
   (Khor Fakkan, Al Jazirah Al Hamra, Al Aqah / Snoopy Island, Ras Al Khor), on the place page and on
   the guides that name the place. Same stage rules as everywhere else. */
function pieceFor(placeId) { return products().find(p => p.place && p.place[1] === placeId && primary(p)) || null; }
const PB_CSS = `<style>
.spb{display:grid;grid-template-columns:minmax(0,220px) minmax(0,1fr);gap:24px;align-items:center;max-width:860px;margin:34px auto;padding:20px;border-radius:18px;background:#2A2016;color:#FAF6EF}
.spb-f{position:relative;display:block;aspect-ratio:4/5;border-radius:12px;overflow:hidden;background:#2A2016}
.spb-f img{width:100%;height:100%;object-fit:cover;display:block}
${CYCLE_CSS}
.spb-f i{position:absolute;left:8px;top:8px;font:10px/1 'Space Mono',ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;font-style:normal;padding:5px 7px;border-radius:4px;background:rgba(250,246,239,.92);color:#2A2016}
.spb-k{font:12px/1.4 'Space Mono',ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:#F3DDB8;margin:0 0 8px}
.spb h2{font:600 clamp(26px,3vw,34px)/1.1 'Cormorant Garamond',Georgia,serif;margin:0 0 8px;color:#FAF6EF}
.spb p{font:15.5px/1.55 Jost,system-ui,sans-serif;margin:0 0 8px;color:#E5E1D9}
.spb-p{font-weight:600;color:#FAF6EF!important}
.spb-a{display:inline-block;margin-top:6px;background:#FAF6EF;color:#2A2016;font:600 15px Jost,system-ui,sans-serif;padding:12px 22px;border-radius:999px;text-decoration:none}
.spb-a:focus-visible{outline:3px solid #F3DDB8;outline-offset:3px}
@media(max-width:640px){.spb{grid-template-columns:1fr;margin:26px 16px;padding:16px}.spb-f{max-width:240px}}
</style>`;
function pieceBlock(placeId, lead) {
  const p = pieceFor(placeId); if (!p) return '';
  const im = p.images[0], first = String(p.story).split(/(?<=\.)\s/)[0];
  const tee = isTee(p), noun = tee ? 'tee' : /hoodie/i.test(p.kind) ? 'hoodie' : 'piece';
  return stageHead() + PB_CSS + `<section class="spb" id="tee" data-match="sahel" aria-label="${esc(p.name.replace(/&amp;/g, '&'))}">
  ${im ? `<a class="spb-f" href="/products/${p.handle}/" tabindex="-1" aria-hidden="true" data-cycle>${cardSet(p).map((x, i) => imgTag(x, { alt: '', sizes: '240px', bg: '#2A2016', cls: i ? '' : 'on' })).join('')}${mockTag(im)}</a>` : ''}
  <div><p class="spb-k">${lead || `The ${noun} drawn from this place`} &middot; Sahel</p><h2>${p.name}</h2><p>${first}</p>
  <p class="spb-p">${cardPrice(p.price, 'span', false, p.handle)}${p.fitsList ? ' &middot; ' + bothFits(p) : ''}</p>
  <p>${inc('st0', '<span class="st0">On pre-order from Wed 28 Oct at 8 AM, UAE time. </span>')}${IN_HAND ? '' : 'Pre-orders ship from Fri 30 Oct. '}${im && im.mock ? 'The image is a studio mock-up.' : 'Photographed from the real piece.'}</p>
  <a class="spb-a" href="/products/${p.handle}/">See the ${noun} &rarr;</a></div>
</section>`;
}

/* 23 Oct 2026 (Faheem chose "Launch band, no ticker"): a band near the top of the homepage. The day line
   ("That is in 5 days") updates once per visit by the UAE calendar; there is no ticking countdown (22 Oct no-timer rule). */
function homeBand() {
  const pick = ['khor-fakkan-bay-tee-super-oversized', 'al-aqah-reef-tee-super-oversized', 'barr-and-bahr-hoodie', 'sahra-trail-kit'].map(h => products().find(x => x.handle === h)).filter(Boolean)
    .map(p => onSale(p) ? p : products().find(x => x.handle === (primaryHandle(p) || 'the-sahel-polo'))).filter(Boolean);
  const css = `<style>
.lb{background:#2A2016;color:#FAF6EF;padding:46px 20px 50px;position:relative;z-index:1}
.lb-in{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.6fr);gap:34px;align-items:center}
.lb-k{font:12px/1.5 'Space Mono',ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#F3DDB8;margin:0 0 10px}
.lb h2{font:600 clamp(30px,3.6vw,46px)/1.05 'Cormorant Garamond',Georgia,serif;margin:0 0 12px;color:#FAF6EF;letter-spacing:-.01em}
.lb p{font:16px/1.55 Jost,system-ui,sans-serif;margin:0 0 8px;color:#E5E1D9;max-width:44ch}
.lb-d{color:#F3DDB8!important}
.lb-a{display:inline-block;margin-top:12px;background:#FAF6EF;color:#2A2016;font:600 15px Jost,system-ui,sans-serif;padding:14px 26px;border-radius:999px;text-decoration:none}
.lb-a:focus-visible,.lb-c:focus-visible{outline:3px solid #F3DDB8;outline-offset:3px}
.lb-g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.lb-c{display:block;color:#FAF6EF;text-decoration:none}
.lb-c span{display:block;position:relative;aspect-ratio:4/5;border-radius:10px;overflow:hidden;background:#2A2016}
.lb-c img{width:100%;height:100%;object-fit:cover;display:block}
${CYCLE_CSS}
.lb-c i{position:absolute;left:8px;top:8px;font:10px/1 'Space Mono',ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;font-style:normal;padding:5px 7px;border-radius:4px;background:rgba(250,246,239,.92);color:#2A2016}
.lb-c b{display:block;font:500 15px/1.3 Jost,system-ui,sans-serif;margin:8px 0 1px}
.lb-c small{font:13px Jost,system-ui,sans-serif;color:#F3DDB8}
@media(max-width:860px){.lb{padding:34px 16px 38px}.lb-in{grid-template-columns:1fr;gap:20px}.lb-g{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 -16px;padding:0 16px}.lb-c{flex:0 0 42%;scroll-snap-align:start}}
</style>`;
  return stageHead() + css + `<section class="lb" id="s-launch" aria-labelledby="lbH"><div class="lb-in"><div>
    <p class="lb-k">New &middot; ` + inc('st0', '<span class="st0">on pre-order from Wed 28 Oct</span>') + inc('st1', '<span class="st1">on pre-order now</span>') + `<span class="st2">out now</span></p>
    <h2 id="lbH">Sahel, the Coast Edition, and Sahra Trail running wear</h2>
    ` + inc('st0', '<p class="st0">Pre-order opens Wed 28 Oct at 8 AM, UAE time, for everyone.</p><p class="st0 lb-d" data-days></p>') +
    inc('st1', '<p class="st1">Pre-order is open: 20% off the new pieces until Thu 29 Oct, 23:59. Ships from Fri 30 Oct.</p>') +
    `<p class="st2">Designed in the UAE for everyone who loves it.</p>
    <a class="lb-a" href="/new/">` + inc('st0', '<span class="st0">See the pieces</span>') + inc('st1', '<span class="st1">Pre-order now</span>') + `<span class="st2">Shop the new pieces</span> &rarr;</a>
  </div><div class="lb-g">` + pick.map(p => `<a class="lb-c" href="/products/${p.handle}/"><span data-cycle>${cycleImgs(p, { sizes: '(max-width: 860px) 42vw, 200px', bg: '#2A2016' })}${mockTag(p.images[0])}</span><b>${p.name}</b>${cardPrice(p.price, 'small', false, p.handle)}</a>`).join('') +
  `</div></div></section>`;
}

/* 27 Oct 2026 (Faheem: "We need to prominently publicize that Sahel pre-orders are live with 20% discount";
   "Sahel takes the hero", "Sahel leads, Trail one line below"). The homepage's first screen while the 20%
   runs (stage 1 only; the build leaves it out entirely from Fri 30 Oct). The Al Quaa hero follows it.
   Image: the split-waterline still from the Sahel film (no place is named on it). */
function homeHero() {
  const designs = pickNew(p => p.line === 'sahel', true);
  const css = `<style>
.ph{position:relative;z-index:2;background:#2A2016;color:#FAF6EF;padding:calc(var(--nav-h,62px) + 18px) 0 0;overflow:hidden}
.ph-in{max-width:1240px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);min-height:min(78vh,760px)}
.ph-t{display:flex;flex-direction:column;justify-content:center;padding:40px 48px 40px 24px}
.ph-k{font:400 12px/1.5 'Space Mono',ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;color:#F3DDB8;margin:0 0 14px}
.ph h2{font:500 clamp(42px,5.6vw,76px)/1.0 'Cormorant Garamond',Georgia,serif;margin:0 0 18px;color:#FAF6EF;letter-spacing:-.01em;text-wrap:balance}
.ph-o{display:inline-block;align-self:flex-start;font:600 clamp(18px,2vw,22px)/1.3 Jost,system-ui,sans-serif;color:#2A2016;background:#F3DDB8;padding:10px 16px;border-radius:10px;margin:0 0 16px}
.ph-s{font:17px/1.55 Jost,system-ui,sans-serif;color:#E5E1D9;margin:0 0 22px;max-width:40ch}
.ph-a{align-self:flex-start;display:inline-flex;align-items:center;gap:10px;min-height:52px;padding:0 28px;border-radius:999px;background:#FAF6EF;color:#2A2016;font:600 16px Jost,system-ui,sans-serif;text-decoration:none}
.ph-a:hover{background:#FFFFFF}
.ph-tr{margin:16px 0 0;font:15px/1.5 Jost,system-ui,sans-serif}
.ph-tr a{color:#FAF6EF;text-decoration:underline;text-decoration-color:#2A2016;text-underline-offset:4px}
.ph-a:focus-visible,.ph-tr a:focus-visible,.ph-c:focus-visible{outline:3px solid #F3DDB8;outline-offset:3px}
.ph-img{position:relative;min-height:420px}
.ph-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 46%}
.ph-g{max-width:1240px;margin:0 auto;padding:22px 24px 30px;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:12px}
.ph-c{display:block;color:#FAF6EF;text-decoration:none}
.ph-c span{display:block;position:relative;aspect-ratio:4/5;border-radius:10px;overflow:hidden;background:#E5E1D9}
.ph-c img{width:100%;height:100%;object-fit:cover;display:block}
${CYCLE_CSS}
.ph-c i{position:absolute;left:6px;top:6px;font:400 9.5px/1 'Space Mono',ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;font-style:normal;padding:4px 6px;border-radius:4px;background:rgba(250,246,239,.94);color:#2A2016}
.ph-c b{display:block;font:500 14px/1.3 Jost,system-ui,sans-serif;margin:8px 0 2px}
.ph-c small{display:block;font:13px/1.35 Jost,system-ui,sans-serif;color:#F3DDB8}
@media(max-width:860px){
  .ph{padding-top:calc(var(--nav-h,62px) + 4px)}
  .ph-in{display:block;min-height:0;position:relative}
  .ph-img{position:absolute;inset:0;min-height:0}
  .ph-img::after{content:"";position:absolute;inset:0;background:linear-gradient(to bottom,rgba(42,32,22,.1) 0%,rgba(42,32,22,.55) 34%,rgba(42,32,22,.92) 62%,#2A2016 100%)}
  .ph-t{position:relative;z-index:1;min-height:calc(86vh - var(--nav-h,62px));justify-content:flex-end;padding:120px 18px 24px}
  .ph h2{font-size:clamp(40px,11vw,52px)}
  .ph-s{font-size:16px}
  .ph-a{width:100%;justify-content:center}
  .ph-g{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:10px;padding:14px 18px 26px}
  .ph-c{flex:0 0 38%;scroll-snap-align:start}
}
</style>`;
  /* 3 Nov 2026 (Faheem: "The homepage hero should say Sahel out now, the way it said Sahel on pre order before"):
     the same first screen, back for stage 2 with the out-now wording: no discount, full prices, in stock. */
  const outNow = `<section class="ph st2" id="s-sahel-now" aria-labelledby="phH2">
  <div class="ph-in">
    <div class="ph-img"><picture><source media="(max-width:860px)" srcset="/assets/sahel/sahel-surface-m.webp"><img src="/assets/sahel/sahel-surface-d.webp" width="1296" height="2304" alt="Half above, half below the water: an island on the horizon, the sea underneath" fetchpriority="high" decoding="async"></picture></div>
    <div class="ph-t">
      <p class="ph-k">Sahel &middot; The Coast Edition</p>
      <h2 id="phH2">Sahel is out now</h2>
      <p class="ph-s">Nine designs, from the UAE coast to the Al Qudra lakes: five tees, three hoodies and a polo. Designed in the UAE. In stock, with free next-day delivery across the UAE on orders over AED 100.</p>
      <a class="ph-a" href="/sahel/#pieces" data-track="home_sahel_hero">Shop Sahel <span aria-hidden="true">&rarr;</span></a>
      <p class="ph-tr"><a href="/trail/#pieces" data-track="home_sahel_trail">Sahra Trail running kit is out now too &rarr;</a></p>
    </div>
  </div>
  <div class="ph-g">` + designs.map(p => `<a class="ph-c" href="/products/${p.handle}/"><span data-cycle>${cycleImgs(p, { sizes: '(max-width: 860px) 38vw, 160px', bg: '#2A2016' })}${mockTag(p.images[0])}</span><b>${p.name}</b>${cardPrice(p.price, 'small', true, p.handle)}</a>`).join('') + `</div>
</section>`;
  /* 3 Nov 2026 (Faheem: "Let's put the hero slides back on top of homepage. Sahel out now can have a narrow band below
     it"): from stage 2 the full Sahel first screen is gone; the hero slideshow is first again and homeNowBand() sits
     under it. outNow is kept for reference only. */
  if (stageNow() === 2) return stageHead();
  return stageHead() + inc('st1', css + `<section class="ph st1" id="s-preorder" aria-labelledby="phH">
  <div class="ph-in">
    <div class="ph-img"><picture><source media="(max-width:860px)" srcset="/assets/sahel/sahel-surface-m.webp"><img src="/assets/sahel/sahel-surface-d.webp" width="1296" height="2304" alt="Half above, half below the water: an island on the horizon, the sea underneath" fetchpriority="high" decoding="async"></picture></div>
    <div class="ph-t">
      <p class="ph-k">Sahel &middot; The Coast Edition</p>
      <h2 id="phH">Sahel is on pre-order</h2>
      <p class="ph-o">20% off until Thu 29 Oct, 23:59</p>
      <p class="ph-s">Nine designs, from the UAE coast to the Al Qudra lakes: five tees, three hoodies and a polo. Designed in the UAE. Ships from Fri 30 Oct.</p>
      <a class="ph-a" href="/sahel/#pieces" data-track="home_preorder_hero">Pre-order Sahel <span aria-hidden="true">&rarr;</span></a>
      <p class="ph-tr"><a href="/trail/#pieces" data-track="home_preorder_trail">Sahra Trail running kit is on pre-order too &rarr;</a></p>
    </div>
  </div>
  <div class="ph-g">` + designs.map(p => { const im = p.images[0]; return `<a class="ph-c" href="/products/${p.handle}/"><span data-cycle>${cycleImgs(p, { sizes: '(max-width: 860px) 38vw, 160px', bg: '#2A2016' })}${mockTag(im)}</span><b>${p.name}</b><small>${money(pre(p.price))}, pre-order price</small></a>`; }).join('') + `</div>
</section>`);
}

/* 27 Oct 2026 (Faheem: "only the Founding Edition section is there under the collection. Sahel needs to be
   there too"; "Every line on the homepage"). Two homepage pieces, built from the same product data as the pre-order
   pages so a price or a stage change reaches the homepage on the next build:
   homeRing()  - one card per Sahel design for the 3D collection ring (after the Founding pieces); any mock-up is labelled;
   homeLines() - under the Founding Edition grid: Sahel (seven designs), Sahra Trail (with the Trailhead Bag), and the
                 free Sahra Tote, each with its own heading, so every line we sell is one scroll from the top. */
/* 3 Nov 2026 (Faheem: "Sahel out now can have a narrow band below it"): a narrow band under the homepage hero slideshow,
   stage 2 only. Small photos of the Sahel pieces that have real photographs (a mock-up is never shown without its label,
   and a thumbnail is too small to carry one), the out-now line, Shop Sahel and the Sahra Trail link. */
function homeNowBand() {
  if (stageNow() !== 2) return '';
  const real = pickNew(p => p.line === 'sahel', true).filter(p => p.images[0] && !p.images[0].mock);
  return stageHead() + `<style>
.pn{position:relative;z-index:2;background:#2A2016;color:#FAF6EF;padding:18px 20px;border-bottom:1px solid rgba(243,221,184,.2)}
.pn-in{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px 28px;align-items:center}
.pn-k{font:400 11px/1.4 'Space Mono',ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#F3DDB8;margin:0 0 4px}
.pn h2{font:500 clamp(26px,2.6vw,34px)/1.05 'Cormorant Garamond',Georgia,serif;margin:0 0 4px;color:#FAF6EF}
.pn-s{font:14.5px/1.45 Jost,system-ui,sans-serif;color:#E5E1D9;margin:0}
.pn-g{display:flex;gap:8px;justify-content:center;min-width:0}
.pn-c{display:block;flex:0 0 auto;width:64px;aspect-ratio:4/5;border-radius:8px;overflow:hidden;background:#2A2016}
.pn-c img{width:100%;height:100%;object-fit:cover;display:block}
.pn-a{display:flex;flex-direction:column;align-items:flex-end;gap:8px}.pn-a p{margin:0}.pn-b{gap:8px}
.pn-b{display:inline-flex;align-items:center;min-height:46px;padding:0 24px;border-radius:999px;background:#FAF6EF;color:#2A2016;font:600 15px Jost,system-ui,sans-serif;text-decoration:none;white-space:nowrap}
.pn-b:hover{background:#FFFFFF}
.pn-tr{font:14px/1.4 Jost,system-ui,sans-serif;color:#FAF6EF;text-decoration:underline;text-decoration-color:#2A2016;text-underline-offset:4px}
.pn-b:focus-visible,.pn-tr:focus-visible,.pn-c:focus-visible{outline:3px solid #7E4114;outline-offset:3px}
/* phones: title and Shop Sahel on one row, the photos under them; the delivery line is already in the trust strip above, and Sahra Trail has its own band below */
@media(max-width:860px){.pn{padding:14px 16px 16px}.pn-in{grid-template-columns:minmax(0,1fr) auto;gap:12px}.pn-in>div:first-child{grid-column:1;grid-row:1}.pn-a{grid-column:2;grid-row:1}.pn-g{grid-column:1/-1;grid-row:2;justify-content:space-between}.pn-c{width:calc((100% - 40px) / 6);max-width:64px}.pn-s,.pn-a p+p{display:none}.pn-k{display:none}.pn h2{font-size:27px;margin:0}.pn-b{min-height:44px;padding:0 18px;font-size:14.5px}}
</style><section class="pn st2" id="s-sahel-now" aria-labelledby="pnH">
  <div class="pn-in">
    <div><p class="pn-k">Sahel &middot; The Coast Edition</p><h2 id="pnH">Sahel is out now</h2><p class="pn-s">Nine designs, from the UAE coast to the Al Qudra lakes. In stock, with free next-day UAE delivery over AED 100.</p></div>
    <div class="pn-g">` + real.map(p => `<a class="pn-c" href="/products/${p.handle}/" aria-label="${p.name}">${imgTag(p.images[0], { sizes: '64px', alt: '', bg: '#2A2016' })}</a>`).join('') + `</div>
    <div class="pn-a"><p><a class="pn-b" href="/sahel/#pieces" data-track="home_sahel_band">Shop Sahel <span aria-hidden="true">&rarr;</span></a></p><p><a class="pn-tr" href="/trail/#pieces" data-track="home_sahel_trail">Sahra Trail running kit is out now too &rarr;</a></p></div>
  </div>
</section>`;
}
function homeRing() {
  return pickNew(p => p.line === 'sahel', true).map(p => {
    const nm = p.name.replace(/&amp;/g, '&');
    /* a real first photo cycles only with other real photos, so a mock-up never shows unlabelled */
    const imgs = cardSet(p).map((im, i) => imgTag(im, { cls: i ? '' : 'on', sizes: '(max-width:760px) 46vw, 240px' })).join('');
    const place = p.place ? p.place[0] : 'Sahel';
    const fit = p.fit ? bothFits(p) : cut(p);
    return `<a class="hring-card hring-new" href="/products/${p.handle}/" data-handle="${p.handle}" data-place="${esc(place)}"><span class="hring-img" data-cycle>${imgs}</span>${mockTag(p.images[0], 'hring-mk')}`
      + `<span class="hring-body"><span class="hring-place">Sahel${p.place ? ' &middot; ' + esc(place) : ''}</span><span class="hring-name">${p.name}</span><span class="hring-fit">${fit}</span>`
      + `<span class="hring-price">${cardPrice(p.price, 'span', false, p.handle)}</span><span class="hring-go">` + inc('st1', '<span class="st1">Pre-order &rarr;</span>') + `<span class="st02">View the piece &rarr;</span></span></span></a>`;
  }).join('');
}
/* 11 Nov 2026 (Stage 3 on the homepage; Faheem: "Bring it into the house look next"). The homepage's product blocks
   join the house look without getting shorter:
     - a plain cream ground behind the Founding Edition, Sahel and Sahra Trail blocks (the living sky no longer shows
       through there);
     - Sahel and Sahra Trail use the site's product card (house.js), one card per design with its fits on the switch
       and Quick add, where they had small plain tiles;
     - the Founding Edition cards keep their markup (the homepage grid and its photo beat are built and tested as they
       are), restyled to the same card: radius, type sizes, price line, and the same Quick add button (his choice,
       11 Nov: "Quick add button everywhere"; the script in index.html swaps it for the four sizes on a tap);
     - the block heads use the house kicker and section-head sizes. */
const HOME_HOUSE_CSS = `<style id="home-house">
html body #s-collection{background:#FAF6EF}
html body #s-collection .j-eyebrow,html body .hl .nb-k{font:400 11px/1.5 'Space Mono',ui-monospace,monospace!important;letter-spacing:.2em!important;text-transform:uppercase;color:#7E4114}
html body #s-collection h2,html body .hl h3{font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-weight:500!important;font-size:clamp(24px,2.3vw,30px)!important;line-height:1.15!important;color:#2A2016}
html body #s-collection .lede,html body .hl .nb-l{font:400 15px/1.6 Jost,system-ui,sans-serif!important;color:#4A4136;max-width:70ch}
html body .hl .nb-a{font:500 15px/1.4 Jost,system-ui,sans-serif!important;color:#7E4114;text-decoration:underline;text-underline-offset:3px}
/* no zoom overlay on the homepage: the photo and the name open the product */
html body .hl .pcard-zoom{display:none!important}
/* the "All of Sahel" tile fills its cell beside the cards */
html body .hl .pcards .hl-all{aspect-ratio:auto;min-height:220px;border-radius:14px}
/* the Founding Edition card, brought to the house card */
html body .collection .card{display:flex;flex-direction:column;border:1px solid rgba(42,32,22,.14)!important;border-radius:14px!important;box-shadow:none!important;background:#FFFFFF;overflow:hidden}
html body .collection .card:hover{transform:none;box-shadow:0 10px 26px rgba(42,32,22,.10)!important}
html body .collection .card .card-body{display:flex;flex-direction:column;flex:1 1 auto;gap:6px;padding:12px 12px 14px!important}
html body .collection .card .card-name{order:1;min-height:2.5em;margin:0!important;font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-weight:500;font-size:17px!important;line-height:1.25!important;color:#2A2016}
html body .collection .card .card-rv,html body .collection .card .pcard-rv{order:2}
html body .collection .card .card-place{order:3;display:none;margin:0!important;font:400 11px/1.5 'Space Mono',ui-monospace,monospace!important;letter-spacing:.12em!important;text-transform:uppercase;color:#6B6256;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
html body .collection .card .card-price{order:4;margin:auto 0 0!important;padding-top:10px;border-top:1px solid rgba(42,32,22,.14);font:600 17px/1.3 Jost,system-ui,sans-serif!important;color:#2A2016}
html body .collection .card .card-price .sb-price{font:600 17px/1.3 Jost,system-ui,sans-serif!important;letter-spacing:.01em!important;color:#2A2016;white-space:nowrap}
html body .collection .card .card-price .sbs-was{font-weight:400!important;font-size:13px!important;color:#6B6256}
html body .collection .card .card-price sbs-g{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px}
html body .collection .card .qa{order:5;margin:0!important;padding:0!important;border:0!important}
/* Quick add on the Founding Edition card: the same button as the product card; a tap swaps it for the four sizes */
html body .collection .card .qa{display:block}
html body .collection .card .qa-open{display:block;width:100%;height:40px;min-height:40px!important;padding:0 10px;border:1px solid rgba(42,32,22,.45);border-radius:999px;background:#FFFFFF;color:#2A2016;font:600 13px/1 Jost,system-ui,sans-serif!important;letter-spacing:.06em!important;text-transform:none!important;cursor:pointer}
html body .collection .card .qa-open:hover{background:#2A2016;color:#FAF6EF;border-color:#2A2016}
html body .collection .card .qa-open:focus-visible{outline:2px solid #7E4114;outline-offset:2px}
html body .collection .card .qa-open[hidden],html body .collection .card .qa-s[hidden]{display:none!important}
html body .collection .card .qa-s{display:flex;flex-wrap:nowrap!important;gap:4px!important;width:100%;min-height:40px!important}
html body .collection .card .qa-b{flex:1 1 0;min-width:0!important;height:40px!important;min-height:40px!important;padding:0!important;border-radius:999px;font:600 13px/1 Jost,system-ui,sans-serif!important;letter-spacing:.02em!important}
@media(min-width:700px){html body .collection .card .card-body{gap:7px;padding:14px 16px 16px!important}html body .collection .card .card-place{display:block}}
</style>`;
function homeLines() {
  const sahel = pickNew(p => p.line === 'sahel', true);
  const trail = products().filter(p => p.line === 'trail');
  const css = `<style>
.hl{margin:46px 0 0;display:flex;flex-direction:column;gap:44px}
.hl-sec{scroll-margin-top:90px}
.hl .nb-k{margin:0 0 8px}
.hl h3{font:600 clamp(26px,3vw,38px)/1.1 'Cormorant Garamond',Georgia,serif;margin:0 0 8px;color:#2A2016;text-wrap:balance}
.hl .nb-l{margin:0 0 18px}
.hl .nb-l a{color:#2A2016;text-decoration:underline;text-decoration-color:rgba(126,65,20,.45);text-underline-offset:3px}
.hl-g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.hl-all{display:flex;flex-direction:column;justify-content:flex-end;gap:6px;aspect-ratio:4/5;border-radius:10px;padding:18px;text-decoration:none;background:#2A2016;color:#FAF6EF}
.hl-all b{font:600 24px/1.1 'Cormorant Garamond',Georgia,serif}
.hl-all small{font:14px/1.45 Jost,system-ui,sans-serif;color:#F3DDB8}
.hl-all span{font:600 15px Jost,system-ui,sans-serif;margin-top:6px}
.hl-all.trail{background:#2A2016}
.hl-all:focus-visible{outline:3px solid #7E4114;outline-offset:3px}
.hl-tote{display:grid;grid-template-columns:minmax(0,200px) minmax(0,1fr);gap:22px;align-items:center;padding:18px;border-radius:14px;background:#F3DDB8;color:#2A2016;text-decoration:none;max-width:760px}
.hl-tote span{display:block;aspect-ratio:4/5;border-radius:10px;overflow:hidden;background:#E5E1D9}
.hl-tote img{width:100%;height:100%;object-fit:cover;display:block}
.hl-tote b{display:block;font:600 24px/1.15 'Cormorant Garamond',Georgia,serif;margin:0 0 6px}
.hl-tote p{font:15.5px/1.55 Jost,system-ui,sans-serif;margin:0 0 8px;color:#4A4136}
.hl-tote em{font:600 15px Jost,system-ui,sans-serif;font-style:normal;color:#7E4114}
.hl-more{margin:14px 0 0!important}
.hl-tote:focus-visible{outline:3px solid #7E4114;outline-offset:3px}
/* 14 Nov 2026 (r139 scorecard, Faheem: "Sahel + Trail as swipe rows"): on phones and tablets each range is one row you
   swipe sideways, about two and a quarter cards wide, so the next card shows at the edge; desktop keeps the grid */
@media(max-width:860px){html body .hl .hl-g{display:flex!important;grid-template-columns:none!important;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;scroll-padding-inline:16px;gap:12px;margin:0 -16px;padding:2px 16px 10px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
html body .hl .hl-g::-webkit-scrollbar{display:none}
html body .hl .hl-g>*{flex:0 0 max(45%,162px);max-width:230px;min-width:0;scroll-snap-align:start}
html body .hl .pcards.hl-g>.hl-all{flex-basis:max(45%,162px);aspect-ratio:auto;min-height:0}
.hl-more{margin-top:0!important}}
@media(max-width:860px){.hl{gap:36px;margin-top:36px}.hl-g{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.hl-all{padding:14px}.hl-all b{font-size:21px}.hl-tote{grid-template-columns:minmax(0,120px) minmax(0,1fr);gap:14px;padding:12px}.hl-tote b{font-size:21px}.hl-tote p{font-size:14.5px}}
</style>`;
  const k = (line) => line + ' &middot; ' + inc('st0', '<span class="st0">on pre-order from Wed 28 Oct</span>') + inc('st1', '<span class="st1">on pre-order, 20% off until Thu 29 Oct</span>') + '<span class="st2">new</span>';
  /* HOMECARD: build.js fills this with the site's base product-card rules once its stylesheet exists (the homepage is a
     hand-kept page and does not carry them) */
  return stageHead() + NB_CSS + '<!--HOMECARD:START--><!--HOMECARD:END-->' + BIG_CSS + require('./house.js').scoped('body .hl') + css + HOME_HOUSE_CSS + `<div class="hl" id="lines">
  <section class="hl-sec" id="home-sahel" aria-labelledby="hlS">
    <p class="nb-k">${k('Sahel, the Coast Edition')}</p>
    <h3 id="hlS">Sahel: nine designs, from the coast to Al Qudra</h3>
    <p class="nb-l">Five tees, three hoodies and a polo, drawn from Khor Fakkan, Al Aqah, Al Jazirah Al Hamra, Ras Al Khor and the Al Qudra lakes. ${inc('st1', '<span class="st1">Ships from Fri 30 Oct. </span>')}Sahel has <a href="/size-guide/#sahel">its own size chart</a>, cut larger than the Founding Edition.</p>
    <div class="pcards nb-pc hl-g">${sahel.map(p => designCards(p, true)).join('')}<a class="hl-all" href="/sahel/#pieces" data-track="home_lines_sahel"><b>All of Sahel</b><small>Every piece, every fit, the story behind the coast.</small><span>${inc('st1', '<span class="st1">Pre-order Sahel</span>')}<span class="st02">Shop Sahel</span> &rarr;</span></a></div>
  </section>
  <section class="hl-sec" id="home-trail" aria-labelledby="hlT">
    <p class="nb-k">${k('Sahra Trail running wear')}</p>
    <h3 id="hlT">Sahra Trail: the tee, the 2-in-1 short and the kit</h3>
    <p class="nb-l">Running wear marked with the Two Ridges, plus the Trailhead Bag. Men&rsquo;s cuts; the bag is one size. Sahra Trail has <a href="/size-guide/#trail">its own size chart</a>.</p>
    <div class="pcards nb-pc hl-g">${trail.filter(onSale).map(p => designCards(p, false)).join('')}</div>
    <a class="nb-a" href="/trail/#pieces" data-track="home_lines_trail">Shop Sahra Trail &rarr;</a>
  </section>
  <p class="nb-l hl-more"><a href="/accessories/">Accessories</a> &middot; <a href="/gifts/">UAE gifts</a> &middot; <a href="/under-150/">Under AED 150</a> &middot; <a href="/shop/">Shop everything</a></p>
</div>`;
}

/* 23 Oct 2026 (site review, buy-intent SEO): titles carry the product noun a buyer searches for
   (T-Shirt, Polo Shirt, Hoodie, Running Shorts) and the fit; metas say what it is, the price and delivery.
   Metas never carry the 20% wording, so nothing in a search snippet goes stale on Fri 30 Oct. */
const LINE = { sahel: 'Sahel, the Coast Edition', trail: 'Sahra Trail' };
function seoTitle(p) { return `${p.seo}${p.fit ? `, ${p.fit} Fit` : ''} | Sahra & Beyond`; }
const fitPhrase = p => p.fit === 'Super Oversized' ? ', Super Oversized with a dropped shoulder' : '';
function seoDesc(p, stage) {
  const ship = p.inHand ? (stage === 0 ? ' On sale from Wed 28 Oct.' : ' In stock.') : IN_HAND ? '' : stage === 0 ? ' Pre-order opens Wed 28 Oct; ships from Fri 30 Oct.' : ' Pre-order; ships from Fri 30 Oct.';
  return `${p.plain}: ${p.md}${fitPhrase(p)}. ${LINE[p.line]}, designed in the UAE. ${money(p.price)}, free delivery across the UAE on orders over AED 100.${ship}`;
}
const RETURNS = { '@type': 'MerchantReturnPolicy', applicableCountry: 'AE', returnPolicyCountry: 'AE', returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
  merchantReturnDays: 14, returnMethod: 'https://schema.org/ReturnByMail', returnFees: 'https://schema.org/FreeReturn' };
/* 5 Nov 2026: UAE delivery is free from AED 100, AED 15 below (Shopify rate); the offer states the rate for its own price */
const SHIP_UAE = price => ({ '@type': 'OfferShippingDetails', shippingRate: { '@type': 'MonetaryAmount', value: +price < 100 ? '15' : '0', currency: 'AED' }, shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'AE' } });
function productLd(p, url, img, desc, stage, SITE) {
  const inWindow = stage === 1 && !p.inHand;
  const prod = { '@context': 'https://schema.org', '@type': 'Product', name: p.plain, sku: p.handle, description: desc, url, image: img ? [img] : undefined,
    brand: { '@type': 'Brand', name: p.line === 'sahel' ? 'Sahra & Beyond' : 'Sahra Trail' }, color: p.colour || undefined,
    offers: { '@type': 'Offer', price: (inWindow ? pre(p.price) : p.price).toFixed(2), priceCurrency: 'AED', url,
      priceValidUntil: inWindow ? '2026-10-29' : `${new Date(now()).getUTCFullYear() + 1}-12-31`, itemCondition: 'https://schema.org/NewCondition',
      availability: require('./specimen.js').PAUSED[p.handle] ? 'https://schema.org/OutOfStock' : p.inHand ? (stage === 0 ? 'https://schema.org/PreSale' : 'https://schema.org/InStock') : IN_HAND ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder', shippingDetails: [SHIP_UAE(inWindow ? pre(p.price) : p.price)], hasMerchantReturnPolicy: RETURNS } };
  if (p.fitsList) { prod.inProductGroupWithID = p.key;
    prod.isVariantOf = { '@type': 'ProductGroup', productGroupID: p.key, name: p.name.replace(/&amp;/g, '&'), url: `${SITE}/products/${primaryHandle(p) || p.handle}/`, variesBy: ['https://schema.org/size'] }; }
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
    { '@type': 'ListItem', position: 2, name: p.line === 'sahel' ? 'Sahel' : 'Sahra Trail', item: `${SITE}/new/` },
    { '@type': 'ListItem', position: 3, name: p.plain, item: url }] };
  return [prod, crumbs];
}

module.exports = function buildPreorder({ shell, write, SITE }) {
  const stage = stageNow();
  const all = products();
  all.forEach(p => {
    const url = `${SITE}/products/${p.handle}/`;
    const desc = seoDesc(p, stage);
    const img = p.images.length ? `${SITE}/assets/preorder/og/${p.images[0].k}-og.jpg` : undefined;   /* 23 Oct 2026: shares and search show the mock-up WITH its label baked in */
    write(`products/${p.handle}/index.html`, shell({
      title: seoTitle(p), desc, canonical: url, image: img, bodyClass: 'po-page', activeNav: p.line === 'sahel' ? 'sahel' : 'trail',
      noindex: false,   /* 23 Oct 2026 (Faheem): the pages go live before pre-order opens, so they can be found and shared */
      jsonld: productLd(p, url, img, desc, stage, SITE),
      bodyHtml: productPage(p, all, SITE, stage)
    }));
  });
  write('new/index.html', shell({
    title: 'Sahel & Sahra Trail: New Tees, Hoodies, Polo, Running Kit | Sahra & Beyond',
    desc: 'Sahel, the Coast Edition (graphic tees, a polo and three hoodies) and Sahra Trail running wear (tee, 2-in-1 shorts and kit). Designed in the UAE. Free delivery across the UAE on orders over AED 100.',
    canonical: `${SITE}/new/`, bodyClass: 'buy-page ls-page', noindex: false, image: `${SITE}/assets/preorder/og/pm-khor-fakkan-bay-tee-super-oversized-02-back-og.jpg`,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Sahel and Sahra Trail', url: `${SITE}/new/` },
      { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Sahel and Sahra Trail', itemListElement: all.filter(onSale).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/products/${p.handle}/`, name: p.plain })) }],
    bodyHtml: collectionPage(all)
  }));
  console.log(`  ✓ pre-order: ${all.length} product pages + /new/ (stage ${stage}${IN_HAND ? ', in hand' : ''})`);
};
module.exports.stageNow = stageNow;
module.exports.stageHead = stageHead;
module.exports.inc = inc;
module.exports.homeBand = homeBand;
module.exports.homeHero = homeHero;
module.exports.homeNowBand = homeNowBand;
module.exports.homeRing = homeRing;
module.exports.foundingCross = foundingCross;
module.exports.homeLines = homeLines;
module.exports.urls = urls;
module.exports.handles = () => products().map(p => p.handle);
module.exports.products = products;
module.exports.onSale = onSale;
module.exports.primary = primary;
module.exports.primaryHandle = primaryHandle;
module.exports.isTee = isTee;
module.exports.bothFits = bothFits;
module.exports.pickNew = pickNew;
module.exports.pieceFor = pieceFor;
module.exports.pieceBlock = pieceBlock;
module.exports.newBlock = newBlock;
module.exports.newLede = newLede;
module.exports.trailLede = trailLede;
module.exports.newCard = newCard;
module.exports.bigCard = bigCard;
module.exports.designCards = designCards;
module.exports.BIG_CSS = () => BIG_CSS;
module.exports.NB_CSS = () => NB_CSS;
module.exports.cut = cut;
module.exports.forWomen = forWomen;
module.exports.IN_HAND = IN_HAND;
module.exports.cardPrice = cardPrice;
module.exports.money = money;
module.exports.picture = picture;
module.exports.T1 = T1; module.exports.T2 = T2;
