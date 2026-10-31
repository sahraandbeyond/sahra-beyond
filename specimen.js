/* ==========================================================================
   specimen.js: the Specimen Sheet, one product-page layout for every piece
   (30 Oct 2026, Faheem approved the Specimen Sheet and the Fold and Drop bag
   from the design-review prototype; brief SPEC-BAG-BRIEF.md).
   ==========================================================================
   Used by build-products.js (Founding Edition, 7 pages) and preorder-page.js
   (Sahel and Sahra Trail, 21 pages), so both page families open the same way:

     the art side first (the back for back-art pieces), with Back / Front / Art /
     Worn tabs for the photos that exist; numbered notes pinned to the artwork,
     written only from the piece's own story text; a short spec line from real
     data; and one sticky buy sheet with the sizes, Add to bag, the price
     (.sb-price, converted by sahra-market.js), the Tabby line (UAE and AED
     only), free delivery and 14-day returns, and the fit switch.

   Rules kept here: mock-ups always carry a visible "Mock-up" label; no photo is
   captioned with a place; a model's height or size appears only where the site
   already states it; tees 230 GSM, the Sahra Polo 240 GSM; neck labels printed.
   The drag-to-turn interaction of the prototype is deliberately not included.
   Client side: assets/sahra-specimen.js + assets/sahra-specimen.css.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

const esc = s => String(s == null ? '' : s).replace(/&(?![a-z#0-9]+;)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = n => 'AED ' + (Math.round(n * 100) % 100 === 0 ? String(Math.round(n)) : (Math.round(n * 100) / 100).toFixed(2));
const quarter = n => { const v = Math.round(Number(n) * 25) / 100; return v % 1 === 0 ? v.toFixed(0) : v.toFixed(2); };

/* real pixel size of a WebP, so every <img> reserves its box */
const _dims = new Map();
function dims(rel) {
  if (_dims.has(rel)) return _dims.get(rel);
  let out = null;
  try {
    const b = fs.readFileSync(path.join(ROOT, rel.replace(/^\//, '')));
    const t = b.toString('ascii', 12, 16);
    if (t === 'VP8X') out = [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    else if (t === 'VP8L') { const v = b.readUInt32LE(21); out = [1 + (v & 0x3FFF), 1 + ((v >> 14) & 0x3FFF)]; }
    else if (t === 'VP8 ') out = [b.readUInt16LE(26) & 0x3FFF, b.readUInt16LE(28) & 0x3FFF];
  } catch (e) {}
  _dims.set(rel, out);
  return out;
}

/* ---- photographs ----------------------------------------------------------
   An image is { src, srcset, w, h, mock, pos, full }. Founding photos are the
   /shirts/ masters (about 1080 px) with their /shirts/card/ copies (800 px);
   Sahel and Trail photos are the /assets/preorder/ 480/720/1200 set. */
function shirt(name, pos) {
  const full = `/shirts/${name}.webp`, card = `/shirts/card/${name}.webp`;
  const fd = dims(full) || [1080, 1350], cd = dims(card);
  const srcset = cd ? `${card} ${cd[0]}w, ${full} ${fd[0]}w` : `${full} ${fd[0]}w`;
  return { src: cd ? card : full, srcset, srcsetLo: cd ? `${card} ${cd[0]}w` : srcset, w: fd[0], h: fd[1], pos: pos != null ? `50% ${pos}%` : '', full };
}
function pre(k, o = {}) {
  const d7 = dims(`/assets/preorder/${k}-720.webp`) || [720, 900];
  const d12 = dims(`/assets/preorder/${k}-1200.webp`) || [1200, 1500];
  const base = `/assets/preorder/${k}`;
  return { src: `${base}-720.webp`, srcset: `${base}-480.webp 480w, ${base}-720.webp ${d7[0]}w, ${base}-1200.webp ${d12[0]}w`,
    srcsetLo: `${base}-480.webp 480w, ${base}-720.webp ${d7[0]}w`, w: d7[0], h: d7[1], pos: '', full: `${base}-1200.webp`, mock: !!o.mock };
}

/* ---- the art notes ----------------------------------------------------------
   Each note is written only from the piece's own story or description text on
   the site (no new claims). x / y are percentages of the 4:5 Art photo as shown
   (object-fit: cover), placed against each photograph in the design-review
   prototype. Pieces with no printed art carry none (the Sahel Polo and Sahra
   Trail mock-ups); embroidered marks carry one or two. */
const NOTES = {
  'khor-fakkan-bay-tee': [[46, 27, 'Bare ridges: the Hajar Mountains coming straight down to the Gulf of Oman.'], [13, 46, 'One sweep of pale sand, in the curve between two headlands.'], [34, 70, 'A dhow resting on still water.']],
  'al-aqah-reef-tee': [[50, 17, 'The rock above the waterline: a small island a few hundred metres off Al Aqah beach.'], [38, 56, 'The reef beneath it, where turtles, blacktip reef sharks and parrotfish are reported.']],
  'al-hamra-pearl-diver-tee': [[55, 9, 'The boat above. Every summer the boats of this coast sailed for the big dive, from June to the end of September.'], [64, 30, 'The rope he tugged to be hauled up.'], [46, 57, 'A diver going down on a stone weight to fill his basket with oysters.']],
  'shams-tee': [[61, 50, 'The sun, resting on a dune crest.'], [47, 66, 'sahra, written beneath it, stitched in sand thread.']],
  'barr-and-bahr-hoodie': [[22, 40, 'Contour-line dunes: barr, the open land.'], [46, 50, 'Running down into a stream.'], [67, 55, 'And a wave: bahr, the sea.']],
  'ras-al-khor-hoodie': [[33, 5, 'The whole UAE coast in a single line of sand thread.'], [67, 10, 'Sahel, written beneath it in Arabic and English.'], [55, 58, 'Greater flamingos wading at dusk.'], [13, 52, 'The mangroves behind them.']],
  'al-quaa-galaxy': [[57, 30, 'The galaxy, printed large: the part of the sky you only see once you are far enough from the city.'], [27, 72, 'The gold stipple of the Milky Way over the dune line.']],
  'empty-quarter': [[59, 49, 'A low sun setting across the dune lines of Liwa, worked in tonal thread.'], [77, 68, 'A small صحراء mark beneath it: Arabic for “desert”.']],
  'hajar-mountains': [[63, 44, 'The red rock of the Hajar, the colour that gives Wadi Naqab its walls.'], [56, 69, 'The coordinates, printed beneath the art.']],
  'sand-polo': [[50, 63, 'The mark is stitched into the cloth rather than printed onto it: tonal and raised.']]
};

/* ---- the photographs of each piece -----------------------------------------
   face: which side opens the page (the art side). Founding: per fit; the
   Regular dune shoot and the Oversized dune model (182 cm, wears L). */
const FOUNDING = {
  'al-quaa-galaxy': { face: 'back', regular: { back: ['alquaa-dune-back'], front: ['alquaa-dune-front'] }, oversized: { back: ['alquaa-model-back', 55], front: ['alquaa-model-front', 45] }, art: ['alquaa-dune-print'], worn: ['alquaa-lake-back-her'] },
  'empty-quarter': { face: 'front', regular: { back: ['emptyquarter-dune-back'], front: ['emptyquarter-dune-front'] }, oversized: { back: ['emptyquarter-model-sunset', 50], front: ['emptyquarter-model-stand', 35] }, art: ['emptyquarter-dune-chest'], worn: ['emptyquarter-female-3', 35] },
  'hajar-mountains': { face: 'back', regular: { back: ['hajar-dune-back', 40], front: ['hajar-dune-front'] }, oversized: { back: ['hajar-model-back', 55], front: ['hajar-model-front', 40] }, art: ['hajar-lake-back-kneel'], worn: ['hajar-lake-back-her'] },
  'sand-polo': { face: 'front', regular: { back: ['polo-dune-back'], front: ['polo-dune-front'] }, art: ['polo-dune-collar'], worn: ['polo-dune-three-quarter'] }
};
const PRE = {
  'khor-fakkan-bay-tee': { face: 'back', back: 'ph-kfb-01-back', front: 'ph-kfb-06-front', art: 'ph-kfb-02-detail-ridges' },
  'al-aqah-reef-tee': { face: 'back', back: 'ph-reef-01-back', front: 'ph-reef-02-front', art: 'ph-reef-03-detail-reef' },
  'al-hamra-pearl-diver-tee': { face: 'back', back: 'ph2-pearl-01-back', front: 'ph2-pearl-02-front', art: 'ph2-pearl-03-detail-dhow' },
  'shams-tee': { face: 'front', back: 'ph2-shams-04-back', front: 'ph-shams-01-front', art: 'ph-shams-02-detail-mark' },
  'barr-and-bahr-hoodie': { face: 'back', back: 'ph-barr-01-back', front: 'ph-barr-04-front', art: 'ph-barr-05-detail-dunes-wave', worn: 'ph-barr-02-back-hood-down', wornCap: 'Worn with the hood down' },
  'ras-al-khor-hoodie': { face: 'back', back: 'ph-rakh-01-back', front: 'ph-rakh-06-front', art: 'ph-rakh-04-detail-flamingos', worn: 'ph-rakh-05-front-model' },
  'the-sahel-polo': { face: 'front', back: 'polo-back', front: 'polo-front', mock: true },
  'sahra-trail-tee': { face: 'front', back: 'trail-tee-back', front: 'trail-tee-front', art: 'trail-chest', artCap: 'Close-up of the sample', mock: true },
  'sahra-trail-2-in-1-short': { face: 'front', back: 'trail-short-back', front: 'trail-short-front', art: 'trail-shortsymbol', artCap: 'Close-up of the sample', mock: true },
  'sahra-trail-kit': { face: 'front', back: 'trail-kit-back', front: 'trail-kit-front', mock: true },
  'trailhead-bag': { face: 'front', front: 'trail-bag-front', frontCap: 'The real bag' }
};
/* "Next piece" runs through each line in the order of its collection page */
const ORDER = {
  founding: ['al-quaa-galaxy', 'empty-quarter', 'hajar-mountains', 'sand-polo'],
  sahel: ['khor-fakkan-bay-tee', 'al-aqah-reef-tee', 'al-hamra-pearl-diver-tee', 'shams-tee', 'barr-and-bahr-hoodie', 'ras-al-khor-hoodie', 'the-sahel-polo'],
  trail: ['sahra-trail-tee', 'sahra-trail-2-in-1-short', 'sahra-trail-kit', 'trailhead-bag']
};
const FITTED = new Set(['al-quaa-galaxy', 'empty-quarter', 'hajar-mountains', 'khor-fakkan-bay-tee', 'al-aqah-reef-tee', 'al-hamra-pearl-diver-tee', 'shams-tee']);
const NAMES = { 'al-quaa-galaxy': 'Al Quaa Galaxy Tee', 'empty-quarter': 'Empty Quarter Tee', 'hajar-mountains': 'Hajar Mountains Tee', 'sand-polo': 'The Sahra Polo',
  'khor-fakkan-bay-tee': 'Khor Fakkan Bay Tee', 'al-aqah-reef-tee': 'Al Aqah Reef Tee', 'al-hamra-pearl-diver-tee': 'Al Hamra Pearl Diver Tee', 'shams-tee': 'Shams Tee',
  'barr-and-bahr-hoodie': 'Barr &amp; Bahr Hoodie', 'ras-al-khor-hoodie': 'Ras Al Khor Hoodie', 'the-sahel-polo': 'The Sahel Polo',
  'sahra-trail-tee': 'Sahra Trail Tee', 'sahra-trail-2-in-1-short': 'Sahra Trail 2-in-1 Short', 'sahra-trail-kit': 'Sahra Trail Kit', 'trailhead-bag': 'The Trailhead Bag' };
const LINES = { founding: 'Founding Edition', sahel: 'Sahel, the Coast Edition', trail: 'Sahra Trail' };
const FIT_COPY = { founding: { Regular: 'Sits on the shoulder', Oversized: 'Dropped shoulder, wider body' }, sahel: { Regular: 'A straight regular fit', Oversized: 'Looser, wider through the body', 'Super Oversized': 'Drop shoulder, our roomiest cut' } };
/* 31 Oct 2026 (Faheem: Super Oversized with drop shoulder, a third fit): the handle suffix of each fit, per design.
   Sahel tees: Regular, Oversized (paused, being re-cut) and Super Oversized (the current stock). Sahel hoodies:
   Oversized (paused) and Super Oversized, which keeps the hoodie's original handle so its links keep working. */
const HOODIES = new Set(['barr-and-bahr-hoodie', 'ras-al-khor-hoodie']);
const FIT_ORDER = ['Regular', 'Oversized', 'Super Oversized'];
function suffixes(k) {
  if (HOODIES.has(k)) return { Oversized: '-oversized', 'Super Oversized': '' };
  if (FITTED.has(k)) return FOUNDING[k] ? { Regular: '-regular', Oversized: '-oversized' } : { Regular: '-regular', Oversized: '-oversized', 'Super Oversized': '-super-oversized' };
  return null;
}

/* Founding captions: the size of the person in the photo, from the product JSON (tags) or its modelInfo */
let _ftags = null;
function foundingTags() {
  if (_ftags) return _ftags;
  _ftags = {};
  try {
    for (const f of fs.readdirSync(path.join(ROOT, 'content/products'))) {
      const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/products', f), 'utf8'));
      (p.modelShots || []).forEach(m => { if (m.tag) _ftags[path.basename(m.src).replace(/\.\w+$/, '')] = m.tag; });
    }
  } catch (e) {}
  return _ftags;
}
function foundingCap(name, p, fitKey) {
  if (/^(alquaa|emptyquarter|hajar)-model-/.test(name) && /182 cm/.test(p.modelInfo || '')) return 'Model is 182 cm, wears L · Oversized fit';
  if (/-model-/.test(name)) return foundingTags()[name] || '';
  const t = foundingTags()[name]; if (t) return t;
  if (/-dune-(back|front)$/.test(name) && fitKey === 'regular' && !/^polo/.test(name)) {
    const m = /wears (S|M|L|XL)\b/.exec(p.modelInfo || ''); return m ? `Model wears ${m[1]} · Regular fit` : '';
  }
  return '';
}

/* ---- one normalised description of a piece, from either generator ---------- */
function fromFounding(p, all) {
  const key = p.siblingOf || p.id;
  const D = FOUNDING[key]; if (!D) return null;
  const fitKey = p.garment === 'polo' ? 'regular' : (p.fit === 'oversized' ? 'oversized' : 'regular');
  const set = D[fitKey] || D.regular;
  const view = (k, label, a) => a ? Object.assign(shirt(a[0], a[1]), { k, label, cap: foundingCap(a[0], p, fitKey), name: a[0] }) : null;
  const views = [view('back', 'Back', set.back), view('front', 'Front', set.front), view('art', 'Art', D.art), view('worn', 'Worn', D.worn)].filter(Boolean);
  const tee = p.garment !== 'polo';
  const deco = { 'al-quaa-galaxy': ['DTG printed back', 'Embroidered logo on the front'], 'empty-quarter': ['Embroidered throughout, no print'], 'hajar-mountains': ['DTG graphic, with the logo above it embroidered'], 'sand-polo': ['Embroidered mark'] }[key] || [];
  const spec = (tee ? ['230 GSM', '100% combed ring-spun cotton, pre-washed'] : ['240 GSM', '100% cotton piqué, pre-washed']).concat(deco, ['Printed collar label']);   /* S11: the full fabric phrase, as FABRIC_LINE */
  const short = String(p.name).replace(/\s+[—-]\s+(Regular|Oversized)$/, '');
  const mi = /wears (S|M|L|XL)\b/.exec(p.modelInfo || '');
  return {
    handle: p.id, key, line: 'founding', price: Number(p.price), name: short, h1: null,
    fit: tee ? (fitKey === 'oversized' ? 'Oversized' : 'Regular') : null,
    fits: tee && p.siblingOf ? [{ fit: 'Regular', href: `/products/${key}-regular/`, onSale: true }, { fit: 'Oversized', href: `/products/${key}-oversized/`, onSale: true }] : null,
    kind: tee ? 'T-shirt' : 'Polo shirt', cut: tee ? 'Unisex' : 'Men’s cut', colour: p.colourName || '',
    place: p.placeSlug ? [p.placeName, p.placeEmirate === 'RAK' ? 'Ras Al Khaimah' : p.placeEmirate, `/locations/${p.placeSlug}/`] : null,
    face: D.face, views, notes: (NOTES[key] || []).map(n => ({ x: n[0], y: n[1], t: n[2] })), spec,
    pair: tee, gift: true, chart: '#fit', chartNote: tee ? null : 'The polo is graded to the Regular tee chart.',
    model: mi ? `Model wears ${mi[1]}` : '', kit: false, oneSize: false
  };
}
function fromPreorder(p) {
  const D = PRE[p.key]; if (!D) return null;
  const mk = (k, label, file, cap) => file ? Object.assign(pre(file, { mock: !!D.mock && k !== 'art' }), { k, label, cap: cap || '', name: file }) : null;
  const views = [mk('back', 'Back', D.back), mk('front', 'Front', D.front, D.frontCap), mk('art', 'Art', D.art, D.artCap), mk('worn', 'Worn', D.worn, D.wornCap)].filter(Boolean);
  views.forEach(v => { if (v.h / v.w > 1.35) v.tall = true; });
  const fitted = !!(p.fit && p.fitsList);
  const spec = (p.details || []).filter(d => !/ fit$/.test(d)).map(d => String(d).replace(/^(\d{3})gsm/i, '$1 GSM').replace(/^Our mark/, 'Mark'));
  if (spec[0] === 'Drop shoulder' && spec.length > 1) spec.splice(0, 2, spec[1], spec[0]);   /* the cloth first, then the cut (31 Oct 2026) */
  return {
    handle: p.handle, key: p.key, line: p.line, price: Number(p.price), name: p.name, h1: p.title,
    fit: fitted ? p.fit : null,
    fits: fitted ? p.fitsList.slice().sort((a, b) => FIT_ORDER.indexOf(a.fit) - FIT_ORDER.indexOf(b.fit)).map(f => ({ fit: f.fit, href: `/products/${f.handle}/`, onSale: !PAUSED[f.handle] })) : null,
    kind: p.kind, cut: p.oneSize ? 'One size' : (p.line === 'trail' || /polo/i.test(p.kind || '') ? 'Men’s cut' : 'Unisex'), colour: p.colour || '',
    place: p.place ? [p.place[0], null, `/locations/${p.place[1]}/`] : null,
    face: D.face, views, notes: (NOTES[p.key] || []).map(n => ({ x: n[0], y: n[1], t: n[2] })), spec,
    pair: false, gift: !p.noTote, chart: p.line === 'sahel' && !/polo/i.test(p.kind || '') ? '#size-chart' : null,
    chartNote: null, model: '', kit: !!p.kit, oneSize: !!p.oneSize
  };
}

/* ---- markup ---------------------------------------------------------------- */
function imgTag(v, first) {
  const fit = v.tall ? 'contain' : 'cover';
  const style = `object-fit:${fit}${v.pos ? `;object-position:${v.pos}` : ''}`;
  const sizes = '(max-width: 899px) 92vw, 560px';
  const alt = esc(v.alt || '');
  if (first) return `<img class="ss-img" src="${v.src}" srcset="${v.srcset}" sizes="${sizes}" width="${v.w}" height="${v.h}" alt="${alt}" fetchpriority="high" decoding="async" style="${style}">`;
  /* r88 speed: frames after the first carry data-src and are fetched after the page has loaded or at the first tap */
  return `<img class="ss-img" data-src="${v.src}" data-srcset="${v.srcsetLo}" data-sizes="${sizes}" width="${v.w}" height="${v.h}" alt="${alt}" decoding="async" style="${style}">`;
}
function stage(s, altBase) {
  const order = s.views.slice();
  const first = order.find(v => v.k === s.face) || order[0];
  const on = first.k;
  const notes = s.notes.length && s.views.some(v => v.k === 'art');
  /* 30 Oct 2026 (QA B1): the tabs sit ON the photo, at the top, so the buy sheet can never cover them */
  const tabs = s.views.length > 1 ? `<div class="ss-tabs" role="tablist" aria-label="Photos">${s.views.map(v => `<button type="button" role="tab" class="ss-tab${v.k === on ? ' on' : ''}" id="ssT-${v.k}" data-v="${v.k}" aria-selected="${v.k === on}" aria-controls="ssV-${v.k}">${v.label}</button>`).join('')}</div>` : '';
  const pins = notes ? `<div class="ss-pins" aria-label="Numbered notes on the artwork">${s.notes.map((n, i) => `<button type="button" class="ss-pin" data-i="${i}" style="left:${n.x}%;top:${n.y}%" aria-label="Note ${i + 1}: ${esc(n.t)}">${i + 1}</button>`).join('')}</div>` : '';
  const figs = s.views.map(v => {
    v.alt = `${altBase}, ${v.k === 'art' ? 'close-up of the artwork' : v.k === 'worn' ? 'worn' : v.k}${v.mock ? ', studio mock-up' : ''}`;
    const boxed = v.k === 'art' && notes;   /* the annotated photo sits between the tabs and the note, whole, so no pin hides under either */
    const blur = (v.tall || boxed) ? `<span class="ss-blur" aria-hidden="true"${v === first ? ` style="background-image:url(${v.src})"` : ` data-bg="${v.src}"`}></span>` : '';
    return `<figure class="ss-v${v.k === on ? ' on' : ''}${v.tall ? ' tall' : ''}${boxed ? ' boxed' : ''}" id="ssV-${v.k}"${s.views.length > 1 ? ` role="tabpanel" aria-labelledby="ssT-${v.k}"` : ''} data-v="${v.k}" data-cap="${esc(v.cap)}"${v.mock ? ' data-mock="1"' : ''} data-full="${v.full}">${blur}${boxed ? `<div class="ss-artbox">${imgTag(v, v === first)}${pins}</div>` : imgTag(v, v === first)}</figure>`;
  }).join('');
  return `<div class="ss-stage${s.views.some(v => v.tall) ? ' has-tall' : ''}${tabs ? ' has-tabs' : ''}" id="ssStage" tabindex="0" role="group" aria-roledescription="photos" aria-label="${esc(altBase)}: photos. Tap to zoom." data-handle="${s.handle}">
      ${figs}
      ${tabs}
      <span class="ss-mock"${first.mock ? '' : ' hidden'}>Mock-up</span>
      <span class="ss-cap"${first.cap ? '' : ' hidden'}>${esc(first.cap)}</span>
      ${notes ? `<p class="ss-note" id="ssNote" aria-live="polite" hidden></p>` : ''}
    </div>`;
}
function artBlock(s) {
  const hasArt = s.notes.length && s.views.some(v => v.k === 'art');
  const spec = `<p class="ss-spec">${s.spec.map(esc).join('<i aria-hidden="true"> · </i>')}</p>`;
  if (!hasArt) return `<section class="ss-art" aria-label="How it is made">${spec}</section>`;
  return `<section class="ss-art" id="art" aria-labelledby="ssArtH"><p class="ss-k">The artwork, annotated</p><h2 id="ssArtH">What is drawn on it</h2>
      <ol class="ss-notes">${s.notes.map((n, i) => `<li><button type="button" data-i="${i}"><b>${i + 1}</b><span>${esc(n.t)}</span></button></li>`).join('')}</ol>
      ${spec}</section>`;
}
function priceSpan(s) { return `<span class="sb-price" data-handle="${s.handle}" data-aed="${s.price}">${money(s.price)}</span>`; }
/* every fit of the design, in the order Regular, Oversized, Super Oversized (31 Oct 2026). On the page (ss-fits) a fit that is
   not for sale stays listed with "Back soon" as its small line; the compact switch in the buy sheet (ssb-fit) shows only the
   fits on sale, plus the page's own fit. */
const fitHref = (s, f) => { const x = (s.fits || []).find(o => o.fit === f && o.onSale); return x ? x.href : ''; };
function fitSwitch(s, cls) {
  if (!s.fits) return '';
  const copy = FIT_COPY[s.line] || FIT_COPY.sahel;
  const list = cls === 'ss-fits' ? s.fits : s.fits.filter(f => f.onSale || f.fit === s.fit);
  if (list.length < 2) return '';
  return `<div class="${cls}" role="group" aria-label="Fit"${list.length > 2 ? ' data-n="' + list.length + '"' : ''}>${list.map(({ fit: f, href, onSale }) => `<a href="${href}" class="${s.fit === f ? 'on' : ''}"${s.fit === f ? ' aria-current="page"' : ''}><b>${f}</b>${cls === 'ss-fits' ? `<span>${onSale ? copy[f] : 'Back soon'}</span>` : ''}</a>`).join('')}</div>`;
}
/* Handles not for sale (their pages say "Back soon"). 30 Oct 2026: the Sahel Oversized tees and the hoodies ran
   a size large and were withdrawn. 31 Oct 2026 (Faheem): "For all new oversized shirts and hoodies, let's rebrand
   them as Super Oversized with drop shoulder ... Keep oversized as coming back soon and make super oversized drop
   shoulder fits live with our current inventory." The current stock is unaltered and sold as Super Oversized
   (tees: <design>-super-oversized; hoodies: their original handle). The Oversized fit returns later, in a new
   production run cut to the original (Founding Edition) Oversized size; until then these six handles have no
   Shopify product. Remove a handle from this list to sell it again. */
const PAUSED = { 'khor-fakkan-bay-tee-oversized': 1, 'al-aqah-reef-tee-oversized': 1, 'al-hamra-pearl-diver-tee-oversized': 1, 'shams-tee-oversized': 1,
  'barr-and-bahr-hoodie-oversized': 1, 'ras-al-khor-hoodie-oversized': 1 };
/* the note on a paused Oversized page (31 Oct 2026): what is happening, and where the design can be bought now */
function pausedNote(s) {
  const sup = fitHref(s, 'Super Oversized'), reg = fitHref(s, 'Regular');
  if (HOODIES.has(s.key)) return `Our Oversized hoodie is being re-cut and will be back soon. ${sup ? `This hoodie is available now in <a href="${sup}">Super Oversized</a>, with a dropped shoulder.` : '<a href="/sahel/">See what is available from Sahel</a>.'}`;
  const now = [sup ? `<a href="${sup}">Super Oversized</a> (drop shoulder)` : '', reg ? `<a href="${reg}">Regular</a>` : ''].filter(Boolean);
  return `Our Oversized fit is being re-cut to our original Oversized size and will be back soon.${now.length ? ` This design is available now in ${now.join(' and ')}.` : ''}`;
}
function sheet(s) {
  const btn = z => `<button type="button" data-size="${z}" aria-pressed="false">${z}</button>`;
  const group = (g, label, show) => `<div class="ssb-sz" role="group" aria-label="${label}" data-group="${g}">${show ? `<span class="ssb-gl">${show}</span>` : ''}${['S', 'M', 'L', 'XL'].map(btn).join('')}</div>`;
  const sizes = s.oneSize ? `<span class="ssb-one">One size</span>` : s.kit ? `<div class="ssb-kit">${group('tee', 'Tee size', 'Tee')}${group('short', 'Short size', 'Short')}</div>` : group('size', 'Size');
  return `<div class="ssb${s.kit ? ' kit' : ''}${s.oneSize ? ' one' : ''}" id="ssBuy" role="region" aria-label="Buy ${esc(s.name.replace(/&amp;/g, '&'))}" data-handle="${s.handle}" data-kit="${s.kit ? 1 : 0}" data-one="${s.oneSize ? 1 : 0}" data-gift="${s.gift ? 1 : 0}" data-line="${s.line}" data-price="${s.price}"${PAUSED[s.handle] ? ' data-paused="1"' : ''}${(s.fits || []).some(f => f.fit === 'Super Oversized') ? ' data-fitwide="1"' : ''}>
      <div class="ssb-r1">${sizes}<button type="button" class="ssb-add" id="ssAdd"${PAUSED[s.handle] ? ' disabled' : ''}>${PAUSED[s.handle] ? 'Back soon' : 'Add to bag'}</button></div>${PAUSED[s.handle] ? `
      <p class="ssb-paused">${pausedNote(s)}</p>` : ''}
      <div class="ssb-r2"><p class="ssb-meta"><span class="ssb-l1"><span class="ssb-p">${priceSpan(s)}</span><span class="ssb-tb sb-ship-uae sb-aed-only"> · 4 × ${quarter(s.price)} with Tabby</span></span><span class="ssb-dl"><span class="sb-ship-uae">Free delivery</span><span class="sb-ship-gcc">GCC delivery 3–5 days</span><span class="sb-ship-intl">Worldwide delivery</span> · 14-day returns</span></p>${fitSwitch(s, 'ssb-fit')}</div>
      <p class="ssb-msg" id="ssMsg" role="status" aria-live="polite"></p>
    </div>`;
}
/* The top of every product page. o: { crumb, h1, rating, help, extra, tabby } (HTML strings) */
function top(s, o = {}) {
  const altBase = s.name.replace(/&amp;/g, '&') + (s.colour ? ` in ${s.colour}` : '');
  const eyebrow = `<p class="ss-eb"><span>${LINES[s.line]}</span>${s.place ? ` · <a href="${s.place[2]}">Drawn from ${esc(s.place[0])}${s.place[1] ? ', ' + esc(s.place[1]) : ''}</a>` : ''}</p>`;
  const kind = [s.kind, s.colour ? `Colour: ${esc(s.colour)}` : '', s.cut].filter(Boolean).join(' · ');
  const status = PAUSED[s.handle] ? `<p class="ss-stat">Not available to order while this fit is re-cut. Back soon.</p>` : `<p class="ss-stat"><span class="sb-ship-uae">In stock. Order by 2 pm for next-working-day delivery in the UAE.</span><span class="sb-ship-gcc">In stock. GCC delivery in 3–5 working days.</span><span class="sb-ship-intl">In stock. Worldwide delivery in 7–14 working days.</span></p>`;
  return `<section class="ss ss-${s.line}" data-ss style="--ss-top:${s.line === 'founding' ? 151 : 135}px">
  <div class="ss-media">
    ${o.crumb || ''}
    ${stage(s, altBase)}
    ${artBlock(s)}
  </div>
  <div class="ss-info">
    <div class="ss-head">
      ${eyebrow}
      <h1 class="ss-h1">${o.h1 || esc(s.name)}</h1>
      ${o.rating || ''}
      <p class="ss-pr"><span class="ss-price">${priceSpan(s)}</span>${s.pair ? `<span class="ss-pair sb-aed-only">Any two Founding Edition tees, AED 359</span>` : ''}</p>
      <p class="ss-kind">${kind}</p>
    </div>
    <div class="ss-body">
      ${status}
      ${fitSwitch(s, 'ss-fits')}
      ${o.help || ''}
      ${sheet(s)}
      ${o.tabby === false ? '' : `<div class="sb-tabby sb-tabby-pdp ss-tabby sb-aed-only" data-tabby-price="${s.price}" data-tabby-source="product"><span class="sb-tabby-t">Pay in 4 with <b>Tabby</b>: 4 interest-free payments of AED ${quarter(s.price)}</span></div>`}
      <ul class="ss-promise">
        <li><span class="sb-ship-uae">Free next-working-day delivery across the UAE, order by 2 pm.</span><span class="sb-ship-gcc">GCC delivery in 3–5 working days, free over AED 390.</span><span class="sb-ship-intl">Worldwide delivery in 7–14 working days.</span></li>
        <li><span class="sb-ship-uae">Free 14-day returns and size exchanges in the UAE.${s.line === 'founding' ? ' If your size has gone, a full refund.' : ''}</span><span class="sb-ship-gcc">14-day returns; duties, if any, are paid on arrival.</span><span class="sb-ship-intl">14-day returns; duties, if any, are paid on arrival.</span></li>
        ${s.gift ? '<li>The <a href="/tote/">Sahra Tote</a>, free with every order.</li>' : ''}
      </ul>
      <p class="ss-trust">Secure checkout \u00b7 Apple Pay, Google Pay, Shop Pay, Visa, Mastercard<span class="sb-ship-uae">, Tabby</span></p>
      ${o.extra || ''}
    </div>
  </div>
</section>`;
}
/* the last thing before the footer */
function nextPiece(s) {
  const list = ORDER[s.line] || [];
  const i = list.indexOf(s.key); if (i < 0) return '';
  /* skip pieces withdrawn from sale (PAUSED): the next design opens in the same fit where it has one on sale,
     else in Super Oversized, else Regular (31 Oct 2026) */
  let nk = null, suffix = '';
  for (let j = 1; j < list.length; j++) {
    const k = list[(i + j) % list.length], sx = suffixes(k);
    const cands = sx ? [s.fit, 'Super Oversized', 'Regular', 'Oversized'].map(f => sx[f]).filter(x => x != null) : [''];
    const ok = cands.find(x => !PAUSED[k + x]);
    if (ok == null) continue;
    nk = k; suffix = ok; break;
  }
  if (!nk) return '';
  let im, mock = false;
  if (FOUNDING[nk]) { const D = FOUNDING[nk]; const set = D[suffix === '-oversized' ? 'oversized' : 'regular'] || D.regular; const a = set[D.face] || set.back; im = shirt(a[0], a[1]); }
  else { const D = PRE[nk]; im = pre(D[D.face] || D.front || D.back); mock = !!D.mock; }
  return `<div class="ss-next"><a href="/products/${nk}${suffix}/"><span class="ss-next-i"><img src="${im.src}" width="${im.w}" height="${im.h}" alt="" loading="lazy" decoding="async"${im.pos ? ` style="object-position:${im.pos}"` : ''}>${mock ? '<i>Mock-up</i>' : ''}</span><span class="ss-next-t"><small>Next piece</small><b>${NAMES[nk]}</b><span>${LINES[FOUNDING[nk] ? 'founding' : ORDER.sahel.includes(nk) ? 'sahel' : 'trail']}</span></span><span class="ss-next-a" aria-hidden="true">→</span></a></div>`;
}
const HEAD = '<link rel="stylesheet" href="/assets/sahra-specimen.css">';
const SCRIPT = '<script src="/assets/sahra-specimen.js" defer></script>';
/* the first photograph, preloaded so it paints with the page (LCP) */
function preload(s) {
  const v = s.views.find(x => x.k === s.face) || s.views[0]; if (!v) return '';
  return `<link rel="preload" as="image" href="${v.src}" imagesrcset="${v.srcset}" imagesizes="(max-width: 899px) 92vw, 560px" fetchpriority="high">`;
}

module.exports = { PAUSED, fromFounding, fromPreorder, top, sheet, nextPiece, preload, HEAD, SCRIPT, NOTES, LINES, money };
