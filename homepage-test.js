#!/usr/bin/env node
/**
 * homepage-test.js — regression tests for the homepage Shopify hydrator, fill().
 * Run: node homepage-test.js
 *
 * WHY THIS EXISTS (Faheem, 31 Aug — "wrong photos are showing for wrong shirts
 * on phone... some shirts don't show at all... I'm seeing the mountain shirt
 * photos on empty quarter shirt's thumbnails"):
 *
 * The homepage ships curated static cards and then hydrates live title/price
 * from Shopify. It used to pair card[i] with product[i]. Shopify's order is
 * arbitrary and the grid is curated, so the two lists drifted and one tee's
 * name and price landed on another tee's photographs. Worse, the hydrator
 * replaced the card's image — written when a card held exactly ONE image. Once
 * every card became a multi-photo [data-cycle] stack it deleted the frame
 * carrying .on (the only visible one) and inserted a foreign image without it,
 * so cards rendered BLANK and then cycled a different product's photos.
 *
 * The contracts now under test:
 *   1. PAIRING IS BY IDENTITY, never position — a card takes the product whose
 *      product page matches its own href.
 *   2. PHOTOGRAPHS ARE NEVER HYDRATED — the static stack is authoritative.
 *   3. NO CARD IS EVER BLANK — exactly one .on frame per stack, always.
 *   4. CLONES CARRY THEIR OWN PHOTO — never the template's.
 *   5. ONE CARD PER PRODUCT — Regular and Oversized are separate products
 *      and each keeps its own card; no product is missing and none duplicates.
 *   6. IDENTITY IS NEVER INHERITED — a clone clears any field it cannot fill,
 *      so a product with no place shows no place line.
 *
 * The product list below is deliberately in an order that does NOT match the
 * grid, which is what made the old code fail.
 */
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  \x1b[32m✓\x1b[0m ' + name); }
  else { fail++; console.log('  \x1b[31m✗ ' + name + '\x1b[0m' + (detail ? '\n      ' + detail : '')); }
}

/* ---- a DOM small enough to read, real enough to run fill() -------------- */
function matches(el, sel) {
  sel = sel.trim();
  if (sel.indexOf(',') > -1) return sel.split(',').some(s => matches(el, s));
  let m = /^([a-zA-Z]*)((?:[.#][\w-]+)*)(\[[\w-]+\])?$/.exec(sel);
  if (!m) return false;
  if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
  const bits = m[2] ? m[2].match(/[.#][\w-]+/g) || [] : [];
  for (const b of bits) {
    if (b[0] === '.' && !el.classList.contains(b.slice(1))) return false;
    if (b[0] === '#' && el.getAttribute('id') !== b.slice(1)) return false;
  }
  if (m[3]) { const a = m[3].slice(1, -1); if (el.getAttribute(a) === null) return false; }
  return true;
}

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.attrs = {}; this.children = []; this.parentNode = null;
    this._text = ''; this.style = { cssText: '', opacity: '' };
    const self = this;
    this.classList = {
      contains: c => (self.attrs.class || '').split(/\s+/).indexOf(c) > -1,
      add(...cs) { const s = new Set((self.attrs.class || '').split(/\s+/).filter(Boolean)); cs.forEach(c => s.add(c)); self.attrs.class = [...s].join(' '); },
      remove(...cs) { const s = new Set((self.attrs.class || '').split(/\s+/).filter(Boolean)); cs.forEach(c => s.delete(c)); self.attrs.class = [...s].join(' '); }
    };
  }
  get className() { return this.attrs.class || ''; }
  set className(v) { this.attrs.class = v; }
  // Real elements mirror these properties onto attributes; the shim must too,
  // or `img.src = x` silently sets nothing and the test lies about the product.
  get src() { return this.attrs.src || ''; }
  set src(v) { this.attrs.src = String(v); }
  get alt() { return this.attrs.alt || ''; }
  set alt(v) { this.attrs.alt = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  hasAttribute(k) { return this.getAttribute(k) !== null; }
  removeAttribute(k) { delete this.attrs[k]; }
  appendChild(n) { n.parentNode = this; this.children.push(n); return n; }
  insertBefore(n, ref) {
    n.parentNode = this;
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i < 0) this.children.push(n); else this.children.splice(i, 0, n);
    return n;
  }
  removeChild(n) { const i = this.children.indexOf(n); if (i > -1) this.children.splice(i, 1); n.parentNode = null; return n; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  cloneNode() {
    const c = new El(this.tagName);
    c.attrs = Object.assign({}, this.attrs); c._text = this._text;
    this.children.forEach(k => c.appendChild(k.cloneNode(true)));
    return c;
  }
  get childNodes() { return this.children; }
  get firstChild() { return this.children[0] || null; }
  get descendants() { const out = []; const walk = n => n.children.forEach(c => { out.push(c); walk(c); }); walk(this); return out; }
  querySelectorAll(sel) {
    const parts = sel.trim().split(/\s+(?![^\[]*\])/);
    let pool = this.descendants;
    if (parts.length === 1) return pool.filter(e => matches(e, parts[0]));
    const roots = pool.filter(e => matches(e, parts[0]));
    const out = [];
    roots.forEach(r => r.descendants.forEach(d => { if (matches(d, parts[1]) && out.indexOf(d) < 0) out.push(d); }));
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  get textContent() {
    if (!this.children.length) return this._text;
    return this._text + this.children.map(c => c.textContent).join('');
  }
  set textContent(v) { this._text = String(v); this.children = []; }
}

function mkDoc() {
  const doc = new El('body');
  doc.createElement = t => new El(t);
  doc.getElementById = id => doc.querySelectorAll('[id]').find(e => e.getAttribute('id') === id) || null;
  return doc;
}

function img(src, alt, on, loaded) {
  const i = new El('img');
  i.setAttribute('src', src); i.setAttribute('alt', alt || ''); i.setAttribute('loading', 'lazy');
  i.loading = 'lazy';
  /* the browser's readiness signals - loaded unless a test says otherwise */
  i.complete = loaded !== false; i.naturalWidth = loaded !== false ? 10 : 0;
  if (on) i.classList.add('on');
  return i;
}

/* A card exactly as build/index.html ships it: an <a> to its own PDP wrapping a
   [data-cycle] stack of that product's photographs. */
function mkCard(href, place, name, handle, aed, shots) {
  const a = new El('a'); a.classList.add('card', 'reveal', 'tilt'); a.setAttribute('href', href);
  const ci = new El('div'); ci.classList.add('card-img'); ci.setAttribute('data-cycle', '');
  const tag = new El('span'); tag.classList.add('card-tag'); tag.textContent = 'Limited'; ci.appendChild(tag);
  shots.forEach((s, i) => ci.appendChild(img(s, name, i === 0)));
  a.appendChild(ci);
  const b = new El('div'); b.classList.add('card-body');
  const pl = new El('div'); pl.classList.add('card-place'); pl.textContent = 'Inspired by ' + place;
  const nm = new El('div'); nm.classList.add('card-name'); nm.textContent = name;
  const pr = new El('div'); pr.classList.add('card-price');
  const sp = new El('span'); sp.classList.add('sb-price'); sp.setAttribute('data-handle', handle); sp.setAttribute('data-aed', String(aed)); sp.textContent = 'AED ' + aed;
  pr.appendChild(sp); b.appendChild(pl); b.appendChild(nm); b.appendChild(pr); a.appendChild(b);
  return a;
}

/* The fixture is DERIVED FROM THE CATALOGUE, never hand-typed. Twelve
   fit-labelled images sat unreferenced for five days because a hand-maintained
   list and the CMS drifted apart (Faheem, 31 Aug); a fixture copied by hand is
   the same trap. Rules encoded here:
     - one static card per PRODUCT (Regular and Oversized are separate products)
     - model photos show the OVERSIZED cut, so they appear only on oversized
       cards - a regular card has no disclosure badge to carry the difference
     - a product with no placeName gets no place line at all
   Pass handles to `omit` to model a product that has a PDP but no static card. */
const CMS = fs.readdirSync(path.join(__dirname, 'content', 'products'))
  .filter(n => n.endsWith('.json'))
  .map(n => JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'products', n), 'utf8')))
  .sort((a, b) => (a.order || 9999) - (b.order || 9999) || String(a.id).localeCompare(String(b.id)));

function shotsFor(p) {
  /* imgCard holds the fit-labelled photos. They are used ONLY on the square
     homepage cards: a 4:5 or 4:3 frame crops 153+ px off each side and cuts the
     label to "ULAR FIT", so shop cards, PDP galleries and category blocks keep
     the plain images. */
  const out = (p.imgCard && p.imgCard.length) ? p.imgCard.slice() : [p.imgMain, p.imgFront, p.imgBack];
  if (String(p.fit || '').toLowerCase() === 'oversized') (p.modelShots || []).forEach(m => out.push(m.src));
  return out.filter((v, i, a) => v && a.indexOf(v) === i);
}
const GRID = CMS.map(p => [p.id, p.placeName || '', p.name, Number(p.price), shotsFor(p)]);

function scene(omit) {
  omit = omit || [];
  const doc = mkDoc();
  const grid = new El('div'); grid.classList.add('grid'); grid.setAttribute('id', 'grid');
  GRID.filter(r => omit.indexOf(r[0]) < 0)
      .forEach(r => grid.appendChild(mkCard('/products/' + r[0] + '/', r[1], r[2], r[0], r[3], r[4])));
  doc.appendChild(grid);

  const spot = new El('div'); spot.setAttribute('id', 'spot');
  for (let i = 0; i < 3; i++) { const f = new El('div'); f.classList.add('frame'); spot.appendChild(f); }
  const sl = new El('a'); sl.classList.add('spot-link'); spot.appendChild(sl);
  doc.appendChild(spot);
  const cap = new El('div'); cap.setAttribute('id', 'spotcap'); doc.appendChild(cap);
  return doc;
}

/* Shopify's real shape and a deliberately NON-matching order. */
const CDN = 'https://cdn.shopify.com/s/files/1/0784/5642/2588/files/';
const PRODUCTS = [
  { title: 'Hajar Mountains Tee — Oversized', handle: 'hajar-mountains-oversized', place: 'Wadi Naqab', img: CDN + 'hajar-oversized-back.jpg', price: '199.00', cur: 'AED' },
  { title: 'Empty Quarter Tee — Regular', handle: 'empty-quarter-regular', place: 'Liwa', img: CDN + 'emptyquarter-regular-front.jpg', price: '199.00', cur: 'AED' },
  { title: 'Al Quaa Galaxy Tee — Oversized', handle: 'al-quaa-galaxy-oversized', place: 'Al Quaa', img: CDN + 'alquaa-oversized-back.jpg', price: '209.00', cur: 'AED' },
  { title: 'Hajar Mountains Tee — Regular', handle: 'hajar-mountains-regular', place: 'Wadi Naqab', img: CDN + 'hajar-regular-back.jpg', price: '199.00', cur: 'AED' },
  { title: 'Al Quaa Galaxy Tee — Regular', handle: 'al-quaa-galaxy-regular', place: 'Al Quaa', img: CDN + 'alquaa-regular-back.jpg', price: '199.00', cur: 'AED' },
  { title: 'Empty Quarter Tee — Oversized', handle: 'empty-quarter-oversized', place: 'Liwa', img: CDN + 'emptyquarter-oversized-front.jpg', price: '209.00', cur: 'AED' },
  /* The polo genuinely carries NO place: tag in Shopify (checked against the
     Admin API) and none in the CMS - it is not a location piece. Modelled as
     undefined so the "Inspired by Al Quaa" inheritance bug stays covered. */
  { title: 'Sand Polo', handle: 'sand-polo', img: CDN + 'polo-front.jpg', price: '249.00', cur: 'AED' },
  /* A brand-new Shopify product with no page on the site yet. It must NOT get
     a card - a card would link to a URL that 404s. */
  { title: 'Jebel Jais — Regular', handle: 'jebel-jais-regular', place: 'Jebel Jais', img: CDN + 'jebeljais-regular-front.jpg', price: '199.00', cur: 'AED' }
];

/* ---- load the REAL fill() out of index.html ----------------------------- */
function loadFill(file) {
  const html = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const a = html.indexOf('  var PDP_SLUGS=');
  const b = html.indexOf("  var q='{products(first:12)");
  if (a < 0 || b < 0 || b <= a) throw new Error('could not slice fill() out of ' + file);
  const src = html.slice(a, b);
  const make = new Function('document', 'window', 'SHOP_URL', 'money',
    src + '\n; return { fill: fill, productPageFor: productPageFor };');
  return doc => make(doc, {}, '/shop/', (amt, cur) => (cur || 'AED') + ' ' + Math.round(parseFloat(amt)));
}

const DESIGN = s => String(s || '').toLowerCase().replace(/^.*\/products\//, '').replace(/\/+$/, '').replace(/-(regular|oversized)$/, '');
const PROD   = s => String(s || '').toLowerCase().replace(/^.*\/products\//, '').replace(/\/+$/, '');
/* Every product that must own a card in the static grid. */
const CURATED = ['al-quaa-galaxy-regular', 'al-quaa-galaxy-oversized', 'empty-quarter-regular', 'empty-quarter-oversized', 'hajar-mountains-regular', 'hajar-mountains-oversized', 'sand-polo'];

for (const file of ['index.html', 'classic/index.html', 'homepage-preview.html']) {
  console.log('\n\x1b[1m' + file + '\x1b[0m');
  const doc = scene();
  const api = loadFill(file)(doc);
  api.fill(PRODUCTS.slice());

  const cards = doc.querySelectorAll('#grid .card');

  // 1. Every card's photographs still belong to that card's own design.
  let crossed = [];
  cards.forEach(c => {
    const key = DESIGN(c.getAttribute('href'));
    const stem = { 'al-quaa-galaxy': 'alquaa', 'empty-quarter': 'emptyquarter', 'hajar-mountains': 'hajar', 'sand-polo': 'polo', 'jebel-jais': 'jebeljais' }[key] || key;
    c.querySelectorAll('img').forEach(i => {
      const src = i.getAttribute('src') || '';
      if (src.indexOf(stem) < 0) crossed.push(key + ' <- ' + src);
    });
  });
  check('no card shows another product\'s photograph', crossed.length === 0, crossed.slice(0, 4).join('\n      '));

  // 2. The static stacks were not rewritten from Shopify.
  const cdnInStacks = cards.reduce((n, c) => n + c.querySelectorAll('img').filter(i => (i.getAttribute('src') || '').indexOf('cdn.shopify') > -1).length, 0);
  check('photographs are never hydrated from Shopify', cdnInStacks === 0, cdnInStacks + ' CDN image(s) pushed into a static stack');

  // 3. Nothing is blank: exactly one visible frame per card.
  const blanks = cards.filter(c => c.querySelectorAll('img.on').length !== 1)
    .map(c => c.getAttribute('href') + ' has ' + c.querySelectorAll('img.on').length + ' visible');
  check('every card has exactly one visible frame', blanks.length === 0, blanks.join('\n      '));

  // 4. Names and prices landed on the right card.
  const wrong = [];
  cards.forEach(c => {
    const key = DESIGN(c.getAttribute('href'));
    const nm = (c.querySelector('.card-name') || {}).textContent || '';
    const want = { 'al-quaa-galaxy': /al quaa|galaxy/i, 'empty-quarter': /empty quarter/i, 'hajar-mountains': /hajar/i, 'sand-polo': /polo/i }[key];
    if (want && !want.test(nm)) wrong.push(key + ' titled "' + nm + '"');
  });
  check('titles hydrate onto the matching card, not by position', wrong.length === 0, wrong.join('\n      '));

  // 5. One card per PRODUCT — every product present, none duplicated.
  //    Regular and Oversized are separate products (Faheem, 31 Aug): collapsing
  //    them to one card per design hid half the catalogue.
  const keys = cards.map(c => PROD(c.getAttribute('href')));
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
  check('one card per product (no duplicates)', dupes.length === 0, 'duplicated: ' + dupes.join(', '));
  const missing = CURATED.filter(h => keys.indexOf(h) < 0);
  check('every catalogue product has its own card', missing.length === 0, 'missing: ' + missing.join(', '));
  ['al-quaa-galaxy', 'empty-quarter', 'hajar-mountains'].forEach(d => {
    const fits = keys.filter(k => DESIGN(k) === d);
    check('both fits of ' + d + ' keep separate cards', fits.length === 2, 'got ' + fits.length + ': ' + fits.join(', '));
  });

  // 6. A product with a page but no static card is cloned in, carrying ITS OWN
  //    photo. A product with no page at all is skipped - never linked to a 404.
  check('a product with no page on the site gets no card',
    keys.indexOf('jebel-jais-regular') < 0, 'jebel-jais was given a card');
  {
    const d2 = scene(['hajar-mountains-oversized']);
    loadFill(file)(d2).fill(PRODUCTS.slice());
    const c2 = d2.querySelectorAll('#grid .card');
    const cl = c2.find(c => PROD(c.getAttribute('href')) === 'hajar-mountains-oversized');
    check('a product with no static card gets a clone', !!cl, 'no clone appeared');
    if (cl) {
      const srcs = cl.querySelectorAll('img').map(i => i.getAttribute('src'));
      check('the clone carries its own photo, not the template\'s',
        srcs.length === 1 && srcs[0].indexOf('hajar-oversized') > -1, JSON.stringify(srcs));
      check('the clone is visible', cl.querySelectorAll('img.on').length === 1);
      check('the clone prices itself', (cl.querySelector('.sb-price') || {}).getAttribute('data-handle') === 'hajar-mountains-oversized');
      const pl2 = cl.querySelector('.card-place');
      check('the clone carries its own place, not the template\'s',
        !pl2 || (pl2.textContent || '').trim() === 'Inspired by Wadi Naqab', 'clone says "' + ((pl2 || {}).textContent || '') + '"');
    }
  }

  /* ---- the free tote must never be listed (Faheem, 2 Sep 2026) ------------
     It is a real Shopify product, published to the headless channel so the
     cart can add it - and that is exactly what put it on the shop page with
     its internal notes and "AED 0.0". Tagged not-for-sale / gift-with-purchase
     and priced at zero: fill() must drop it, and must never clone a card for
     it. The same rule guards the shop page (checked below on its source). */
  {
    const TOTE = { title: 'Sahra Tote — Founding Edition gift', handle: 'sahra-tote-founding-edition-gift', place: '', img: CDN + 'sahra-tote-founding-edition.jpg', price: '0.0', cur: 'AED', tags: ['founding-edition', 'gift-with-purchase', 'not-for-sale'] };
    const d3 = scene();
    const api3 = loadFill(file)(d3);
    api3.fill(PRODUCTS.concat([TOTE]));
    const c3 = d3.querySelectorAll('#grid .card');
    check('the free tote never gets a homepage card', !c3.some(c => /tote/i.test(c.getAttribute('href') || '')) && c3.length === CURATED.length, c3.length + ' cards');
    check('the free tote never appears in the hero carousel', !(d3.querySelectorAll('#spot .frame').some(f => /tote/.test(f.style.backgroundImage || ''))));
    /* each signal on its own is enough */
    const byTag = Object.assign({}, TOTE, { price: '49.00', tags: ['not-for-sale'] });
    const byGift = Object.assign({}, TOTE, { price: '49.00', tags: ['gift-with-purchase'] });
    const byPrice = Object.assign({}, TOTE, { price: '0', tags: [] });
    [['tag not-for-sale', byTag], ['tag gift-with-purchase', byGift], ['price zero', byPrice]].forEach(([why, p]) => {
      const d = scene(); loadFill(file)(d).fill(PRODUCTS.concat([p]));
      check('unsellable by ' + why + ' alone is still hidden', !d.querySelectorAll('#grid .card').some(c => /tote/i.test(c.getAttribute('href') || '')));
    });
    /* and the guard must sit on the API path too, before fill() */
    const src3 = fs.readFileSync(path.join(__dirname, file), 'utf8');
    check(file + ': the Storefront list is filtered before it reaches fill()', /,tags:n\.tags\|\|\[\]\};\}\)\.filter\(forSale\);fill\(products\);/.test(src3));
  }

  // 6b. The hand-maintained grid must not drift from the catalogue. This is the
  //     check that would have caught 12 fit-labelled images sitting unused.
  {
    const raw = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const m = raw.match(/<div class="grid" id="grid">([\s\S]*?)\n    <\/div>/);
    check('the static grid block is findable in ' + file, !!m);
    if (m) {
      const got = m[1].split('<a class="card')
        .slice(1)
        .map(chunk => ({
          handle: (chunk.match(/href="\/products\/([^\/]+)\//) || [])[1],
          srcs: (chunk.match(/src="([^"]+)"/g) || []).map(x => x.slice(5, -1))
        }));
      const wantH = GRID.map(r => r[0]).join(',');
      check('the grid lists exactly the catalogue, in order',
        got.map(g => g.handle).join(',') === wantH,
        'html: ' + got.map(g => g.handle).join(',') + '\n      cms:  ' + wantH);
      const drift = [];
      GRID.forEach((r, i) => {
        const want = r[4].join(','), have = (got[i] || {}).srcs ? got[i].srcs.join(',') : '(missing)';
        if (want !== have) drift.push(r[0] + '\n        html: ' + have + '\n        cms:  ' + want);
      });
      check('every card\'s photos match the catalogue exactly', drift.length === 0, drift.join('\n      '));
    }
  }

  // 7. Identity is never inherited: no place tag means no place line.
  //    The polo rendered "Inspired by Al Quaa" because `if(x) set(x)` left the
  //    template's text in place (Faheem, 31 Aug).
  const poloCard = cards.find(c => PROD(c.getAttribute('href')) === 'sand-polo');
  if (poloCard) {
    const pl = poloCard.querySelector('.card-place');
    const txt = pl ? (pl.textContent || '').trim() : '';
    check('a product with no place shows no place line', txt === '', 'polo says "' + txt + '"');
  }
  const strays = cards.filter(c => {
    const p = PRODUCTS.find(x => x.handle === PROD(c.getAttribute('href')));
    const pl = c.querySelector('.card-place');
    const txt = pl ? (pl.textContent || '').trim() : '';
    return p && p.place && txt !== ('Inspired by ' + p.place);
  }).map(c => PROD(c.getAttribute('href')));
  check('every place line matches its own product', strays.length === 0, 'wrong: ' + strays.join(', '));
}

/* ---- the engine-level guard in sahra-market.js -------------------------- */
/* ---- the film-grain overlay must never be the tablet's problem again ------
   A 200%x200% fixed feTurbulence layer stepped 8x per 7s evicted and
   re-rasterised on tablet GPUs, painting one frame without it every ~0.85s:
   the whole page flashed (Faheem's recording, 2 Sep 2026). Every page that
   carries #grain must hide it on touch devices and keep it small on desktop. */
console.log('\n\x1b[1mfilm grain — every page that carries it\x1b[0m');
{
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return (e.name === 'node_modules' || e.name === '_backup' || e.name.startsWith('.')) ? [] : walk(p);
    return e.name.endsWith('.html') ? [p] : [];
  });
  const pages = walk(__dirname).filter(p => fs.readFileSync(p, 'utf8').includes('id="grain"'));
  const oversized = pages.filter(p => /inset:-50%;width:200%;height:200%/.test(fs.readFileSync(p, 'utf8')));
  const unguarded = pages.filter(p => !/pointer:coarse\),\(hover:none\)\{#grain\{display:none\}/.test(fs.readFileSync(p, 'utf8')));
  check('pages carrying the grain overlay were found', pages.length > 0, 'none found');
  check('no page still uses the 200% grain layer', oversized.length === 0, oversized.map(p => path.relative(__dirname, p)).join(', '));
  check('every grain page hides it on touch devices', unguarded.length === 0, unguarded.map(p => path.relative(__dirname, p)).join(', '));

  /* Section-level backdrop-filter over the animated sky: suspended by Android
     during touch scroll, resumed at rest, re-sampled on every card fade -
     "stops while scrolling, resumes when I stop" (Faheem, 2 Sep 2026). Any page
     that blurs a whole section must switch it off for touch devices. */
  const sectionBlur = pages.filter(p => /\.shop,\.story-sec,\.places,\.mission\{[^}]*backdrop-filter:blur/.test(fs.readFileSync(p, 'utf8')));
  const blurUnguarded = sectionBlur.filter(p => !/hover:none\)\{\.shop,\.story-sec,\.places,\.mission\{[^}]*backdrop-filter:none/.test(fs.readFileSync(p, 'utf8')));
  check('section-wide backdrop blur is switched off for touch devices', blurUnguarded.length === 0,
    blurUnguarded.map(p => path.relative(__dirname, p)).join(', '));
}

/* ---- the wordmark was cut to "SAH|" on the shop page on a phone ----------
   (Faheem, 2 Sep 2026). The 18px phone rule for the mark named only the
   homepage's .mark class; the shop and product pages use .logo-img, so their
   195px mark pushed the wordmark under the cart and .logo{overflow:hidden}
   clipped it. Every page that renders a header must carry the phone rules
   for the mark class it actually uses, and the narrow-phone fallbacks. */
console.log('\n\x1b[1mheader on phones - every built page\x1b[0m');
{
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return (e.name === 'node_modules' || e.name === '_backup' || e.name.startsWith('.')) ? [] : walk(p);
    return e.name.endsWith('.html') ? [p] : [];
  });
  const pages = walk(__dirname).filter(p => !/preview\.html$|^admin|^coming-soon\.html$/.test(path.relative(__dirname, p)) && /<a class="(logo|brand)"/.test(fs.readFileSync(p, 'utf8')));
  check('pages with a header were found', pages.length > 20, pages.length + ' found');
  const bad = [];
  pages.forEach(p => {
    const h = fs.readFileSync(p, 'utf8');
    const usesImg = /<a class="logo"[^>]*><img class="logo-img"/.test(h), usesMark = /<img class="mark mark-l"/.test(h), usesBrand = /<a class="brand"[^>]*><img /.test(h);
    const small = (h.match(/\.logo \.mark,\.logo-img,\.brand img\{height:18px\}/) || [])[0];
    const narrow = /@media\(max-width:400px\)\{\.logo-a(,\.brand-sahra)?\{font-size:13px/.test(h);
    const tiny = usesBrand ? /@media\(max-width:340px\)\{\.logo>div,\.logo-text,\.brand-text\{display:none\}\}/.test(h) : /@media\(max-width:340px\)\{\.logo>div,\.logo-text(,\.brand-text)?\{display:none\}\}/.test(h);
    if (!(usesImg || usesMark || usesBrand)) bad.push(path.relative(__dirname, p) + ': unknown header markup');
    else if (!small) bad.push(path.relative(__dirname, p) + ': mark not shrunk to 18px on phones');
    else if (!narrow || !tiny) bad.push(path.relative(__dirname, p) + ': missing narrow-phone wordmark fallback');
  });
  check('every header shrinks its mark on phones and drops the wordmark below 340px', bad.length === 0, bad.slice(0, 5).join('\n      '));
  /* the shop's announcement bar is one line on phones */
  const shop = fs.readFileSync(path.join(__dirname, 'shop-preview.html'), 'utf8');
  check('shop: the announcement extras are wrapped so phones can hide them',
    /<span class=\\'note-x\\'> &nbsp;&middot;&nbsp; no minimum order<\/span>/.test(shop) && /<span class=\\'note-x\\'> &nbsp;&middot;&nbsp; &#9873; Designed in the UAE/.test(shop) && /<span class="note-x"> &middot; all seven emirates/.test(shop) && /@media\(max-width:560px\)\{\.note-x\{display:none\}/.test(shop));
  const pdp = fs.readFileSync(path.join(__dirname, 'build-products.js'), 'utf8');
  check('product pages: the same one-line announcement on phones',
    /<span class="note-x"> &nbsp;·&nbsp; all seven emirates/.test(pdp) && /@media\(max-width:560px\)\{\.note-x\{display:none\}/.test(pdp));
}

console.log('\n\x1b[1mshop page - the free tote is never listed\x1b[0m');
{
  const shop = fs.readFileSync(path.join(__dirname, 'shop-preview.html'), 'utf8');
  const a = shop.indexOf('edges=edges.filter(function(e){'), b = shop.indexOf('PRODUCTS=edges.map(', a);
  check('the shop filters the Storefront list before drawing', a > -1 && b > a);
  if (a > -1) {
    const fn = new Function('return function(edges){' + shop.slice(a, b) + 'return edges;}')();
    const mk = (tags, price) => ({ node: { title: 't', handle: 'h', tags, priceRange: { minVariantPrice: { amount: price, currencyCode: 'AED' } } } });
    const out = fn([mk(['fit:regular'], '199.0'), mk(['founding-edition', 'gift-with-purchase', 'not-for-sale'], '0.0'), mk(['not-for-sale'], '49.0'), mk(['Gift-With-Purchase'], '49.0'), mk([], '0')]);
    check('a paid product stays', out.length === 1 && out[0].node.tags[0] === 'fit:regular', out.length + ' kept');
  }
  const built = path.join(__dirname, 'shop', 'index.html');
  check('the built shop page carries the same guard', fs.existsSync(built) && /edges=edges\.filter\(function\(e\)\{/.test(fs.readFileSync(built, 'utf8')), 'run node build.js');
}

/* ---- the hero->cards scroll freeze on a tablet (Faheem, 2 Sep 2026) -------
   Lenis registers a NON-passive touchmove listener, so on Android every
   scroll frame waits for the main thread - which was decoding seven 1536px
   photos for 230px card slots and firing 22 downloads the moment the grid
   appeared. Touch must scroll natively, the cards must ship a card-sized
   photo, and the warm-up must run ahead of the viewport. */
console.log('\n\x1b[1mhero -> cards on touch\x1b[0m');
['classic/index.html', 'homepage-preview.html'].forEach(pg => {
  const page = fs.readFileSync(path.join(__dirname, pg), 'utf8');
  check(pg + ': Lenis smooth scroll is not started on touch devices',
    /if\(window\.Lenis&&!reduced&&!isTouch\)/.test(page), 'a non-passive touchmove listener will stall native scrolling');
  check(pg + ': the marquee bar is hidden on touch, so hero flows into the collection',
    /hover:none\)\{\.marquee\{display:none\}\}/.test(page));
  /* an earlier .hero::after rule sets inset:0; without top:auto the bottom
     dissolve is positioned at the TOP of the hero and never seen */
  /* an earlier .hero::after rule sets inset:0; with top and bottom both 0
     plus a height, top wins and the bottom dissolve sits invisibly at the top.
     top:auto fixes that - on TOUCH only, where the marquee is gone. Desktop
     is left exactly as it was. */
  const touchBlock = (page.match(/@media\(pointer:coarse\),\(hover:none\)\{\s*\.hero::after\{top:auto\}[\s\S]*?\n\}/) || [''])[0];
  check(pg + ': the hero\'s bottom dissolve is placed at the bottom on touch (top:auto)', touchBlock.length > 0);
  check(pg + ': ...and only on touch - the desktop rule is untouched',
    /\.hero::after\{content:"";position:absolute;left:0;right:0;bottom:0;height:34vh/.test(page) && !/\.hero::after\{content:"";position:absolute;left:0;right:0;top:auto/.test(page));
  check(pg + ': on touch the hero\'s dusk carries on into the collection (no edge)',
    /\.melt\{display:none\}\s*\.shop\{background:linear-gradient\(180deg,rgba\(20,16,42,\.5\) 0,rgba\(20,16,42,0\) 180px\)/.test(touchBlock));
  check(pg + ': touch gets a quick fade reveal, no slide, no stagger',
    /if\(isTouch\)\{[\s\S]{0,400}gsap\.set\('\.reveal',\{y:0,scale:1\}\);[\s\S]{0,300}duration:\.35/.test(page) && !/stagger:/.test(page.slice(page.indexOf('if(isTouch){'), page.indexOf('}else{', page.indexOf('if(isTouch){')))));
  const a = page.indexOf('<div class="grid" id="grid">'), b = page.indexOf('<div class="qual-band', a);
  const imgs = page.slice(a, b).match(/<img [^>]*>/g) || [];
  const noSet = imgs.filter(t => !/srcset="\/shirts\/card\/[^"]+ 800w, \/shirts\/[^"]+ \d+w"/.test(t));
  const noAsync = imgs.filter(t => !/decoding="async"/.test(t));
  /* derive the card width from the page's own CSS rather than trusting a
     constant: wrap max-width and padding, grid columns and gap */
  const wrapMax = +((page.match(/\.wrap\{max-width:(\d+)px;margin:0 auto;padding:0 (\d+)px\}/) || [])[1] || 0);
  const wrapPad = +((page.match(/\.wrap\{max-width:(\d+)px;margin:0 auto;padding:0 (\d+)px\}/) || [])[2] || 0);
  const cols = +((page.match(/\n\.grid\{display:grid;grid-template-columns:repeat\((\d+),1fr\);gap:(\d+)px\}/) || [])[1] || 0);
  const gap = +((page.match(/\n\.grid\{display:grid;grid-template-columns:repeat\((\d+),1fr\);gap:(\d+)px\}/) || [])[2] || 0);
  const chrome = 2 * wrapPad + (cols - 1) * gap;                       // 48 + 52 = 100
  const cardAtMax = Math.round((wrapMax - chrome) / cols);              // 367 at 1200
  const expectSizes = 'sizes="(max-width:760px) 46vw, (max-width:' + wrapMax + 'px) calc((100vw - ' + chrome + 'px)/' + cols + '), ' + (cardAtMax + 3) + 'px"';
  check(pg + ': the grid CSS was read (3 columns inside a 1200px wrap)', cols === 3 && wrapMax === 1200 && chrome === 100, 'cols=' + cols + ' wrap=' + wrapMax + ' chrome=' + chrome);
  const noSizes = imgs.filter(t => t.indexOf(expectSizes) < 0);
  check(pg + ': every card photo offers an 800px card-sized candidate', imgs.length === 22 && noSet.length === 0, imgs.length + ' imgs, ' + noSet.length + ' without srcset');
  check(pg + ': every card photo decodes off the main thread', noAsync.length === 0, noAsync.length + ' without decoding=async');
  check(pg + ': sizes follows the grid at every width (2 columns on tablets, 3 up to the wrap, then fixed)', noSizes.length === 0, noSizes.length + ' wrong sizes; expected ' + expectSizes);
  /* the w descriptor must be the file's real width - 1536w on a 1076px model
     shot lets the browser believe it picked a sharper file than it did */
  const jpegW = f => { const d = fs.readFileSync(path.join(__dirname, f)); let i = 2; while (i < d.length && d[i] === 0xFF) { const m = d[i + 1]; if (m === 0xC0 || m === 0xC1 || m === 0xC2) return d.readUInt16BE(i + 7); i += 2 + d.readUInt16BE(i + 2); } return 0; };
  const wrongW = imgs.filter(t => { const m = t.match(/srcset="\/shirts\/card\/[^ ]+ 800w, (\/shirts\/[^ ]+) (\d+)w"/); return !m || jpegW(m[1]) !== +m[2]; });
  check(pg + ': every full-size candidate declares its true pixel width', wrongW.length === 0, wrongW.length + ' wrong: ' + wrongW.map(t => (t.match(/srcset="[^"]*"/) || [''])[0]).slice(0, 2).join(' '));
  const cardFiles = imgs.map(t => (t.match(/srcset="(\/shirts\/card\/[^ ]+) 800w/) || [])[1]).filter(Boolean);
  const absent = cardFiles.filter(f => !fs.existsSync(path.join(__dirname, f)));
  check(pg + ': every 800px candidate exists on disk', absent.length === 0, absent.join(', '));
  const mismatch = imgs.filter(t => { const m = t.match(/src="\/shirts\/([^"]+)"[^>]*srcset="\/shirts\/card\/([^ ]+) 800w/); return m && m[1] !== m[2]; });
  check(pg + ': the card-sized file is the same photograph as src', mismatch.length === 0, mismatch.length + ' mismatched');
});
{
  const eng = fs.readFileSync(path.join(__dirname, 'assets', 'sahra-market.js'), 'utf8');
  const aheadSrc = (eng.match(/var ahead = new IntersectionObserver\([\s\S]*?\}, \{ rootMargin: '600px 0px' \}\);/) || [''])[0];
  check('the warm-up observer runs 600px ahead of the viewport', aheadSrc.length > 0);
  check('...and it is the one that warms every frame and decodes the lead', /warm\)/.test(aheadSrc) && /lead\.decode\(\)/.test(aheadSrc));
  check('the beat observer has no margin (cards only beat when actually on screen)',
    /var io = new IntersectionObserver\(function \(es\) \{[\s\S]{0,400}\}\);\n\s+hosts\.forEach\(function \(h\) \{ io\.observe\(h\); \}\);/.test(eng) && !/io = new IntersectionObserver\([\s\S]{0,500}rootMargin/.test(eng));
}

console.log('\n\x1b[1massets/sahra-market.js — normCycle\x1b[0m');
(async () => {
  const src = fs.readFileSync(path.join(__dirname, 'assets', 'sahra-market.js'), 'utf8');
  const a = src.indexOf('  function normCycle(h)');
  const b = src.indexOf('  function cycles()');
  check('normCycle exists and runs before cycles()', a > -1 && b > a);
  const norm = new Function(src.slice(a, b) + '\n; return normCycle;')();

  /* ---- THE BEAT: every card turns over together, every 1.5s (3s until 4 Sep) --
     The per-stack cadence + half-tick phase offset (9.50) stopped the A/B
     blink but made the grid change somewhere all the time: "very chaotic,
     doesn't give that premium feel" (Faheem, 2 Sep 2026). Decision: one
     shared beat (1.5s since 4 Sep 2026); if any visible card's next photo is not
     loaded, everyone waits (up to 3 beats), and all switches land in ONE
     synchronous pass so they share a paint. */
  {
    check('the per-stack cadence is gone', src.indexOf('function framePeriod') < 0 && src.indexOf('(tick + n)') < 0,
      'framePeriod / phase offset still present - cards will not change together');
    check('the beat is 1.5 seconds (3s until 4 Sep 2026)', /var BEAT = 1500\b/.test(src));
    check('the grid waits at most 3 beats for a missing photo', /MAX_WAIT = 3\b/.test(src));
    const fr0 = src.indexOf('  function frameReady(img)');
    let eng = null;
    try {
      /* from normCycle: the driver's visibleStacks() repairs each stack first */
      eng = new Function(src.slice(a, b) + '\n; return { beatPlan: beatPlan, flipAll: flipAll, decodeAll: decodeAll, makeBeat: makeBeat, HOLD: HOLD, MAX_WAIT: MAX_WAIT };')();
    } catch (e) {}
    if (!eng) {
      check('the beat engine (beatPlan / decodeAll / flipAll / makeBeat) exists', false, 'could not evaluate it');
    } else {
      const mk = (n, unloadedAt) => {
        const h = new El('div'); h.setAttribute('data-cycle', '');
        for (let i = 0; i < n; i++) {
          const im = img('/shirts/s' + i + '.jpg', '', i === 0, i !== unloadedAt);
          im.parentNode = h; h.appendChild(im);
        }
        return h;
      };
      const onIdx = h => h.querySelectorAll('img').findIndex(i => i.classList.contains('on'));
      /* the real homepage shape: 7 cards, four of them two-frame */
      const FRAMES = [2, 5, 2, 5, 2, 4, 2];
      const grid = FRAMES.map(n => mk(n));
      const stacks = () => grid.map(h => h.querySelectorAll('img'));
      const state = { grace: [] };

      const plan = eng.beatPlan(stacks(), state);
      check('with every photo loaded, all seven cards are due on the beat', !!plan && plan.length === 7, 'due: ' + (plan && plan.length));
      const n = eng.flipAll(plan, false);
      check('all seven switch in one synchronous pass', n === 7 && grid.every(h => onIdx(h) === 1),
        'on-index per card: ' + grid.map(onIdx).join(','));
      check('every card still shows exactly one frame', grid.every(h => h.querySelectorAll('img.on').length === 1));
      check('every outgoing frame is held opaque', grid.every(h => h.querySelectorAll('img.was').length === 1));
      eng.flipAll(eng.beatPlan(stacks(), state), false);
      check('two-frame cards wrap while rich ones move on - still on the same beat',
        grid.map(onIdx).join(',') === '0,2,0,2,0,2,0', 'got ' + grid.map(onIdx).join(','));
      check('the previous hold is released grid-wide on the next flip', grid.every(h => h.querySelectorAll('img.was').length === 1));

      /* EVERYONE WAITS: one card's next photo has no pixels */
      const grid2 = FRAMES.map((n, i) => mk(n, i === 3 ? 1 : -1));
      const st2 = { grace: [] };
      const s2 = () => grid2.map(h => h.querySelectorAll('img'));
      check('one unloaded photo holds the whole grid', eng.beatPlan(s2(), st2) === null && st2.grace.length === 1 && st2.grace[0].beats === 1);
      check('the missing photo is asked for eagerly', grid2[3].querySelectorAll('img')[1].loading === 'eager');
      check('the grid keeps waiting on beats 2 and 3', eng.beatPlan(s2(), st2) === null && eng.beatPlan(s2(), st2) === null && st2.grace[0].beats === 3);
      const esc = eng.beatPlan(s2(), st2);
      check('after 3 beats the ready cards go without it (never a frozen grid)', !!esc && esc.length === 6,
        'due: ' + (esc && esc.length));
      check('the lagging card is left showing its current photo', !esc.some(p => p.out.parentNode === grid2[3]));
      eng.flipAll(esc, false);
      /* the reviewer's catch: a grid-wide counter re-armed the 3-beat wait
         after every escape, so one dead photo throttled everyone to one
         change per 12s. The grace is per frame - a dead photo is skipped
         from then on and the rest keep their 3s beat. */
      const again = eng.beatPlan(s2(), st2);
      check('a photo that never arrives does not hold the grid a second time', !!again && again.length === 6,
        'due on the beat after the escape: ' + (again && again.length));
      const again2 = eng.beatPlan(s2(), st2);
      check('...nor on any later beat', !!again2 && again2.length === 6);
      /* a DIFFERENT photo goes missing later (a card scrolled in): it earns its own wait */
      const lateMiss = grid2[0].querySelectorAll('img');
      const cur0 = lateMiss.findIndex(i => i.classList.contains('on'));
      const nxt0 = lateMiss[(cur0 + 1) % lateMiss.length]; nxt0.complete = false; nxt0.naturalWidth = 0;
      check('a photo that goes missing later gets its own 3-beat wait', eng.beatPlan(s2(), st2) === null && st2.grace.length === 2);
      nxt0.complete = true; nxt0.naturalWidth = 10;
      const back = eng.beatPlan(s2(), st2);
      check('once it lands the grid goes together and its grace is forgotten', !!back && back.length === 6 && st2.grace.length === 1);

      /* the photo arrives mid-wait: nobody waits any longer */
      const grid3 = FRAMES.map((n, i) => mk(n, i === 0 ? 1 : -1));
      const st3 = { grace: [] };
      const s3 = () => grid3.map(h => h.querySelectorAll('img'));
      eng.beatPlan(s3(), st3);
      const late = grid3[0].querySelectorAll('img')[1]; late.complete = true; late.naturalWidth = 10;
      const p3 = eng.beatPlan(s3(), st3);
      check('once the photo lands the whole grid goes together on the next beat', !!p3 && p3.length === 7 && st3.grace.length === 0);

      /* a repair re-elected a different frame while we were decoding: the
         flip must not leave two frames .on (reviewer finding) */
      {
        const h = mk(3); const f = h.querySelectorAll('img');
        const pair = { out: f[0], nxt: f[1] };
        f[0].classList.remove('on'); f[2].classList.add('on');   // normCycle-style re-election
        eng.flipAll([pair], false);
        check('a flip after a re-election still leaves exactly one visible frame',
          h.querySelectorAll('img.on').length === 1 && f[1].classList.contains('on'),
          'on: ' + f.map(i => i.classList.contains('on')).join(','));
      }

      /* ---- the beat driver itself (makeBeat): what the interval runs ---- */
      try {
        const gridB = FRAMES.map(n => mk(n));
        const seenB = new Set(gridB.slice(0, 6));            // the 7th is below the fold
        let decodes = 0;
        gridB.forEach(h => h.querySelectorAll('img').forEach(i => { i.decode = () => { decodes++; return Promise.resolve(); }; }));
        const bt = eng.makeBeat(gridB, h => seenB.has(h));
        const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
        bt.prime(); await flush();
        check('priming decodes the next frame of every visible card ahead of the beat', bt.primedCount() === 6 && decodes === 6, 'primed=' + bt.primedCount() + ' decodes=' + decodes);
        bt.tick();
        check('a primed beat flips synchronously, on the timer', gridB.slice(0, 6).every(h => onIdx(h) === 1) && onIdx(gridB[6]) === 0,
          'on-index: ' + gridB.map(onIdx).join(','));
        await flush();
        check('after a flip the following frames are primed again', bt.primedCount() === 6, 'primed=' + bt.primedCount());
        /* the 7th card scrolls in: it joins the next beat */
        seenB.add(gridB[6]); bt.prime(); await flush();
        bt.tick();
        check('a card that scrolls in joins the very next beat', gridB.every(h => h.querySelectorAll('img.on').length === 1) && onIdx(gridB[6]) === 1);
        /* a finger on a card: it sits out, the others go on */
        gridB[1].setAttribute('data-hold', '1');
        const before1 = onIdx(gridB[1]);
        await flush(); bt.tick();
        check('a held card sits the beat out while the others advance', onIdx(gridB[1]) === before1 && onIdx(gridB[0]) !== 0);
        gridB[1].removeAttribute('data-hold');
        /* an unprimed beat (e.g. after reset) decodes first, then lands once */
        bt.reset(); await flush();
        check('a return from a background tab re-primes from scratch', bt.primedCount() === 7, 'primed=' + bt.primedCount());
        /* two primes in flight at once (scroll-in + post-flip) must not double up */
        bt.prime(); bt.prime(); await flush();
        check('overlapping primes never duplicate a frame', bt.primedCount() === 7, 'primed=' + bt.primedCount());
        /* a prime that was in flight when the grid flipped is stale and dropped */
        let relP; const slow = new Promise(r => { relP = r; });
        gridB.forEach(h => h.querySelectorAll('img').forEach(i => { i.decode = () => slow; }));
        bt.reset();                       // starts a slow prime
        gridB.forEach(h => h.querySelectorAll('img').forEach(i => { i.decode = () => Promise.resolve(); }));
        bt.tick(); await flush();         // unprimed: decodes, lands, primes again (fast)
        relP(); await flush();
        check('a stale prime from before the flip is dropped, not merged',
          bt.primedCount() === 7 && gridB.every(h => h.querySelectorAll('img.on').length === 1), 'primed=' + bt.primedCount());
        /* every flip still exactly one .on per card */
        check('the driver never double-exposes or blanks a card', gridB.every(h => h.querySelectorAll('img.on').length === 1));
        /* hold released after 'HOLD' ms is a real timer: make sure flipAll(hold=true) schedules it */
        const hh = mk(2); const ff = hh.querySelectorAll('img');
        eng.flipAll([{ out: ff[0], nxt: ff[1] }]);
        check('the hold frame is scheduled to release after HOLD ms', ff[0].classList.contains('was'));
        await new Promise(r => setTimeout(r, eng.HOLD + 60));
        check('...and it is released', !ff[0].classList.contains('was') && ff[1].classList.contains('on'));
      } catch (e) { check('the beat driver runs without throwing', false, String(e && e.stack || e)); }

      /* decodeAll: done() exactly once, whatever decode() does */
      {
        let calls = 0; let rel; const pend = new Promise(r => { rel = r; });
        const a1 = img('/shirts/a.jpg'), a2 = img('/shirts/b.jpg'); a1.decode = () => pend; a2.decode = () => Promise.resolve();
        eng.decodeAll([a1, a2], () => calls++);
        await Promise.resolve(); await Promise.resolve();
        check('no card switches until EVERY incoming frame is decoded', calls === 0);
        rel(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
        check('all decoded: the flip fires exactly once', calls === 1, 'calls=' + calls);
        let c2 = 0; const r1 = img('/shirts/r.jpg'); r1.decode = () => Promise.reject(new Error('EncodingError'));
        const r2 = img('/shirts/t.jpg'); r2.decode = () => { throw new Error('boom'); };
        eng.decodeAll([r1, r2, img('/shirts/nodecode.jpg')], () => c2++);
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
        check('a rejected, a throwing and a decode-less frame still let the beat land once', c2 === 1, 'calls=' + c2);
        let c3 = 0; eng.decodeAll([], () => c3++);
        check('an empty beat completes immediately', c3 === 1);
        check('a decode that never settles is capped so the grid cannot freeze', /DECODE_CAP = 1500\b/.test(src) && /setTimeout\(fin, DECODE_CAP\)/.test(src));
      }

      /* the hold must outlast the CSS fade on every page that renders a stack */
      const fadeMs = pg => {
        const m = fs.readFileSync(path.join(__dirname, pg), 'utf8').match(/\[data-cycle\] img\{[^}]*transition:opacity ([\d.]+)s/);
        return m ? Math.round(parseFloat(m[1]) * 1000) : NaN;
      };
      ['index.html', 'classic/index.html', 'homepage-preview.html', 'build.js', 'build-products.js'].forEach(pg => {
        check(pg + ': the engine holds the outgoing frame longer than the fade (' + fadeMs(pg) + 'ms)', eng.HOLD > fadeMs(pg), 'HOLD=' + eng.HOLD);
      });
    }
  }

  const host = new El('div'); host.setAttribute('data-cycle', '');
  ['a.jpg', 'b.jpg', 'c.jpg'].forEach((s, i) => host.appendChild(img('/shirts/' + s, '', i === 0)));

  norm(host);
  check('a healthy stack is left alone', host.querySelectorAll('img.on').length === 1 &&
    host.querySelectorAll('img')[0].classList.contains('on'));

  // the exact corruption the old hydrator caused: the visible frame is removed
  host.removeChild(host.querySelectorAll('img.on')[0]);
  check('reproduces the blank card (no visible frame)', host.querySelectorAll('img.on').length === 0);
  norm(host);
  check('normCycle rescues a blank stack', host.querySelectorAll('img.on').length === 1);

  /* ---- the cross-fade must never uncover the card background ----------
     Both frames used to fade at once, leaving the stack 1 - (.5*.5) = 75%
     covered at the midpoint, so the sand gradient pulsed through on every
     transition. Reported as "the slideshow looks flickery, not smooth"
     (Faheem, 2 Sep 2026). The outgoing frame must be HELD opaque underneath. */
  {
    const as0 = src.indexOf('  function advanceStack(im');
    /* frameReady() and warm() sit just above advanceStack and it depends on
       both - slice from the first of them so the evaluated code is complete */
    const fr0 = src.indexOf('  function frameReady(img)');
    check('advanceStack exists', as0 > -1);
    let advance = null;
    if (as0 > -1) {
      const from = (fr0 > -1 && fr0 < as0) ? fr0 : as0;
      try { advance = new Function(src.slice(from, b) + '\n; return advanceStack;')(); } catch (e) {}
    }
    if (typeof advance !== 'function') {
      check('the engine holds the outgoing frame opaque', false, 'advanceStack not found');
    } else {
      const st = new El('div');
      ['a.jpg', 'b.jpg', 'c.jpg'].forEach((x, i) => st.appendChild(img('/shirts/' + x, '', i === 0)));
      const frames = st.querySelectorAll('img');

      advance(frames, false);
      check('the incoming frame becomes the visible one',
        frames[1].classList.contains('on') && !frames[0].classList.contains('on'));
      check('the OUTGOING frame is held opaque beneath it',
        frames[0].classList.contains('was'), 'no hold frame - the background will pulse through');
      check('exactly one visible and one held frame',
        st.querySelectorAll('img.on').length === 1 && st.querySelectorAll('img.was').length === 1);

      advance(frames, false);
      check('the previous hold is released on the next advance',
        !frames[0].classList.contains('was') && frames[1].classList.contains('was'));
      check('still never two held frames', st.querySelectorAll('img.was').length === 1);

      advance(frames, false);
      check('the stack wraps back to the first frame', frames[0].classList.contains('on'));

      /* ---- THE TABLET BLANK CARD (Faheem's video, 2 Sep 2026) ----------
         Seven cards, 26 lazy images on mobile data, and the cycle switched to
         frames that had no pixels yet. The hold released, and the card went
         white. The engine must refuse to advance onto an unloaded frame. */
      {
        const st2 = new El('div');
        st2.appendChild(img('/shirts/x1.jpg', '', true));
        st2.appendChild(img('/shirts/x2.jpg', '', false, false));   // NOT loaded
        st2.appendChild(img('/shirts/x3.jpg', '', false));
        const fr = st2.querySelectorAll('img');
        const r = advance(fr, false);
        check('the engine refuses to switch onto a frame with no pixels',
          r === null && fr[0].classList.contains('on') && !fr[1].classList.contains('on'),
          'on: ' + fr.map(i => i.classList.contains('on')).join(','));
        check('the current frame is never dropped while waiting',
          st2.querySelectorAll('img.on').length === 1);
        check('the missing frame is asked for eagerly instead of lazily',
          fr[1].loading === 'eager', 'loading=' + fr[1].loading);
        /* the image arrives */
        fr[1].complete = true; fr[1].naturalWidth = 10;
        advance(fr, false);
        check('once the frame has pixels the stack advances onto it',
          fr[1].classList.contains('on') && fr[0].classList.contains('was'));
      }

      /* ---- the decode path: the Android-specific half of the fix ---------
         Every test above passes hold=false, which skips decode() entirely -
         the reviewer was right that the busy-flag guard had no coverage. */
      {
        const mkStack = (decodeImpl) => {
          const h = new El('div'); h.setAttribute('data-cycle', '');
          ['d1.jpg', 'd2.jpg', 'd3.jpg'].forEach((x, i) => {
            const im = img('/shirts/' + x, '', i === 0);
            im.decode = decodeImpl; im.parentNode = h; h.appendChild(im);
          });
          return h;
        };
        /* decode resolves later: the switch must wait, then land exactly once */
        let release; const pending = new Promise(r => { release = r; });
        const h1 = mkStack(() => pending); const f1 = h1.querySelectorAll('img');
        const first = advance(f1);
        check('a decode in flight marks the stack busy', h1.getAttribute('data-busy') === '1');
        check('no switch happens before decode resolves', f1[0].classList.contains('on') && !f1[1].classList.contains('on'));
        check('a second advance while busy is refused', advance(f1) === null);
        release();
        await Promise.resolve(); await Promise.resolve();
        check('after decode the switch lands once', f1[1].classList.contains('on') && h1.querySelectorAll('img.on').length === 1);
        check('the busy flag is cleared afterwards', !h1.getAttribute('data-busy'));

        /* decode REJECTS (Chrome does this for evicted images): still advance, never freeze */
        const h2 = mkStack(() => Promise.reject(new Error('EncodingError'))); const f2 = h2.querySelectorAll('img');
        advance(f2); await Promise.resolve(); await Promise.resolve();
        check('a rejected decode still advances rather than freezing the card', f2[1].classList.contains('on'));
        check('a rejected decode clears the busy flag', !h2.getAttribute('data-busy'));

        /* decode THROWS synchronously: also never freeze */
        const h3 = mkStack(() => { throw new Error('boom'); }); const f3 = h3.querySelectorAll('img');
        advance(f3);
        check('a throwing decode still advances', f3[1].classList.contains('on') && !h3.getAttribute('data-busy'));

        /* the stack is rebuilt while a decode is pending: the stale switch must not fire */
        let rel2; const p2 = new Promise(r => { rel2 = r; });
        const h4 = mkStack(() => p2); const f4 = h4.querySelectorAll('img');
        advance(f4);
        h4.removeChild(f4[1]);                 // the frame we were switching TO is gone
        norm(h4);                              // MutationObserver path repairs the stack
        rel2(); await Promise.resolve(); await Promise.resolve();
        check('a switch whose target vanished does nothing', h4.querySelectorAll('img.on').length === 1 && f4[0].classList.contains('on'));
        check('normCycle clears a busy flag left by a dead switch', !h4.getAttribute('data-busy'));
      }

      /* a repaired stack must not leave a stranded hold frame visible */
      frames.forEach(i => { i.classList.add('on'); i.classList.add('was'); });
      norm(st);
      check('normCycle clears a stranded hold frame', st.querySelectorAll('img.was').length === 0);
    }

    /* The CSS and the engine live in different files and must agree - and the
       rule is duplicated across every page that renders a stack, so check them
       all rather than trusting one. */
    ['index.html', 'classic/index.html', 'homepage-preview.html', 'build.js', 'build-products.js'].forEach(pg => {
      const page = fs.readFileSync(path.join(__dirname, pg), 'utf8');
      const wasRule = (page.match(/\[data-cycle\] img\.was\{([^}]*)\}/) || [])[1] || '';
      const onRule = (page.match(/\[data-cycle\] img\.on\{([^}]*)\}/) || [])[1] || '';
      check(pg + ': the held frame is fully opaque and does not animate',
        /opacity:1/.test(wasRule) && /transition:none/.test(wasRule), 'was rule: "' + wasRule + '"');
      check(pg + ': the incoming frame stacks above the held one',
        /z-index:3/.test(onRule) && /z-index:2/.test(wasRule), 'on: "' + onRule + '" was: "' + wasRule + '"');
      /* the "sudden flashes" (2 Sep 2026): a frame promoted only while its
         opacity animates is re-rasterised when the fade ends. Both active
         frames stay on their own compositor layer for the whole switch. */
      check(pg + ': both active frames stay composited through the switch',
        /will-change:opacity/.test(onRule) && /will-change:opacity/.test(wasRule), 'on: "' + onRule + '" was: "' + wasRule + '"');
    });
  }

  // and the other direction: two frames marked visible
  host.querySelectorAll('img').forEach(i => i.classList.add('on'));
  norm(host);
  check('normCycle collapses a double-exposed stack', host.querySelectorAll('img.on').length === 1);

  const empty = new El('div'); empty.setAttribute('data-cycle', '');
  norm(empty);
  check('an empty stack does not throw', true);
})().then(() => {


/* ---- the scroll-journey homepage (4 Sep 2026) ----------------------------
   index.html is the journey page; the previous homepage lives at /classic/
   (noindex). What must hold on the live homepage, in the order it broke. */
console.log('\n\x1b[1mhomepage - the scroll journey\x1b[0m');
{
  const page = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const head = page.slice(0, page.indexOf('</head>'));
  check('index.html is indexable (no robots noindex)', !/name="robots"[^>]*noindex/.test(head));
  check('index.html title carries no preview suffix', /<title>Sahra &amp; Beyond — Original UAE T-Shirts<\/title>/.test(page));
  check('index.html canonical is the root', /<link rel="canonical" href="https:\/\/www\.sahraandbeyond\.ae\/">/.test(head));
  check('index.html does not load Lenis (native scroll drives the journey)', !/lenis/i.test(head));
  check('the seven grid cards are real links (the missing-quote bug never returns)',
    (page.match(/<a class="card" href="\/products\/[^"]+\/">/g) || []).length === 7 && !/class="card href/.test(page));
  check('the three place cards carry a fit switch', (page.match(/data-fit-pick="regular"/g) || []).length === 3 && (page.match(/data-fit-pick="oversized"/g) || []).length === 3);
  check('every fit on a place card has its own quick-add slot', (page.match(/<div class="qa" data-qa="/g) || []).length === 6);
  check('the quick-add engine is on the page', /function quickAdd\(\)/.test(page) && /SahraCart\.variants\(handle\)/.test(page));
  check('the ring re-collects its cards and clears them once open', /cards = \[\]\.slice\.call\(grid\.querySelectorAll\('\.card'\)\);/.test(page) && /clearProps: 'transform,opacity,zIndex'/.test(page));
  check('the ring front card faces the viewer', /rotateY: Math\.sin\(a\) \* 22 \* \(1 - open\)/.test(page));
  check('the ring cards run their slideshow when the scroll rests (holds only while moving)', /if \(moving\) st\.setAttribute\('data-hold', '1'\)/.test(page) && /function holdRing\(on\)/.test(page) && /restT = setTimeout\(function \(\) \{ moving = false; if \(!settled\) holdRing\(false\); \}, 350\)/.test(page));
  check('the collection section is re-measured as the scroll leaves the pin (phone rows grow at settle)', /onLeave: function \(\) \{ if \(phone\) setTimeout\(function \(\) \{ ScrollTrigger\.refresh\(\); \}, 0\); \}/.test(page) && /if \(!ScrollTrigger\.isRefreshing\) section\.classList\.toggle\('ring-on'/.test(page));
  check('the Made-to-last band is two columns on phones', /@media\(max-width:760px\)\{\.qual\{grid-template-columns:1fr 1fr/.test(page));
  check('the ring can be swiped: a horizontal drag moves the page inside the pin, vertical stays native', /function swipe\(\)/.test(page) && /touch-action:pan-y/.test(page) && /window\.scrollTo\(0, Math\.max\(st\.start, Math\.min\(st\.end,/.test(page) && /dragstart/.test(page));
  check('review filter chips carry no counts (the band caps at 6 while the aggregate counts all)', !/rv-chip[^>]*>All \(/.test(page) && !/★ \(\d+\)<\/button>/.test(page) && /data-star="all">All</.test(fs.readFileSync(path.join(__dirname, 'reviews-render.js'), 'utf8')));
  check('the plates are referenced from /journey/plates/', /\/journey\/plates\/[a-z-]+\.jpg/.test(page));
  check('the Storefront list is filtered before fill() (free tote never listed)', /\.filter\(forSale\);fill\(products\);/.test(page));
  check('the review band markers are present', /<!--REVIEWS:START-->/.test(page) && /<!--REVIEWS:END-->/.test(page));
  check('the film is the live lazy video', /<video class="vband-v" id="brandVideo"/.test(page) && /data-src="\/video\/brand\.mp4/.test(page));
  check('the cart and market engines load', /\/assets\/sahra-cart\.js/.test(page) && /\/assets\/sahra-market\.js/.test(page));
  const classic = fs.readFileSync(path.join(__dirname, 'classic', 'index.html'), 'utf8');
  const chead = classic.slice(0, classic.indexOf('</head>'));
  check('classic/index.html is noindex with its own canonical', /noindex/.test(chead) && /href="https:\/\/www\.sahraandbeyond\.ae\/classic\/"/.test(chead));
  check('journey/index.html is gone (it redirects to /)', !fs.existsSync(path.join(__dirname, 'journey', 'index.html')));
  const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, 'vercel.json'), 'utf8'));
  check('vercel.json redirects /journey/ to /', ['/journey', '/journey/'].every(s => vercel.redirects.some(r => r.source === s && r.destination === '/')));
  const sitemap = fs.existsSync(path.join(__dirname, 'sitemap.xml')) ? fs.readFileSync(path.join(__dirname, 'sitemap.xml'), 'utf8') : '';
  check('the sitemap lists neither /classic/ nor /journey/', !/\/classic\/|\/journey\//.test(sitemap));
}
console.log('\n' + (fail ? '\x1b[31m' : '\x1b[32m') + pass + ' passed, ' + fail + ' failed\x1b[0m');
process.exit(fail ? 1 : 0);
}).catch(e => { console.error(e); process.exit(1); });
