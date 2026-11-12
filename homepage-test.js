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
          /* build.js serves a .webp sibling where one exists (23 Sep 2026); the
             catalogue names the master file, so compare the image, not the format */
          srcs: (chunk.match(/src="([^"]+)"/g) || []).map(x => x.slice(5, -1).replace(/\.webp$/, '.jpg'))
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
    /<span class=\\'note-x\\'> &nbsp;&middot;&nbsp; order by 2 pm &nbsp;&middot;&nbsp; free over AED 100<\/span>/.test(shop) && /<span class=\\'note-x\\'> &nbsp;&middot;&nbsp; &#10022; Designed in the UAE/.test(shop) && /<span class="note-x"> &middot; order by 2 pm/.test(shop) && /@media\(max-width:560px\)\{\.note-x\{display:none\}/.test(shop));
  const pdp = fs.readFileSync(path.join(__dirname, 'build-products.js'), 'utf8');
  check('product pages: the same one-line announcement on phones',
    /<span class="note-x"> &nbsp;·&nbsp; order by 2 pm/.test(pdp) && /@media\(max-width:560px\)\{\.note-x\{display:none\}/.test(pdp));
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
  /* 10 Nov 2026 (r120): /shop/ is one grid built from the product files, not from Shopify's list, so the guard there is
     structural: no Storefront product loop on the page, and the free gift tote's handle is nowhere in the grid */
  const bs = fs.existsSync(built) ? fs.readFileSync(built, 'utf8') : '';
  const grid = (bs.match(/<div class="pcards nb-pc" id="shopGrid">[\s\S]*?<p class="sx-none"/) || [''])[0];
  check('the built shop page draws its grid from the product files (no Storefront loop)', !!grid && !/PRODUCTS=edges\.map\(/.test(bs), 'run node build.js');
  check('the free gift tote is not in the shop grid', !!grid && !/gift-with-purchase|not-for-sale|free-tote|sahra-tote-gift/i.test(grid));
  check('the only tote in the grid is the paid Sahra Tote (AED 50, linked to /tote/)', (grid.match(/data-handle="sahra-tote"/g) || []).length === 1 && /data-handle="sahra-tote" data-aed="50"/.test(grid));
  console.log('\n\x1b[1mshop page - one grid with category chips (r120)\x1b[0m');
  const items = grid.match(/<div class="sg-i" data-line="[a-z]+" data-kind="[a-z]+">/g) || [];
  const nLine = l => items.filter(x => x.indexOf('data-line="' + l + '"') > -1).length;
  check('16 pieces: 7 Sahel, 4 Founding Edition, 4 Sahra Trail and the tote', items.length === 16 && nLine('sahel') === 7 && nLine('founding') === 4 && nLine('trail') === 4 && nLine('extra') === 1, items.length + ' items');
  check('Polos and hoodies picks out four pieces', items.filter(x => /data-kind="(polo|hoodie)"/.test(x)).length === 4);
  check('five chips, All pressed first', (bs.match(/<button type="button" data-f="(all|sahel|founding|trail|polos-hoodies)"/g) || []).length === 5 && /data-f="all" aria-pressed="true"/.test(bs));
  check('the count in the bar matches the grid', /<span class="sx-n" aria-live="polite">16 pieces<\/span>/.test(bs));
  check('each Founding Edition tee is one card with a Regular / Oversized switch', (grid.match(/<div class="sg-i" data-line="founding" data-kind="tee"><div class="sfp">/g) || []).length === 3);
  check('the chips bar sits inside main, so it stops sticking where the grid ends', bs.indexOf('<main class="sx-wrap" id="products">') > -1 && bs.indexOf('id="shopBar"') > bs.indexOf('<main class="sx-wrap"') && bs.indexOf('id="shopBar"') < bs.indexOf('</main>'));
  check('the opener is a model photo of a product, one h1', /<section class="ho ho-top"[\s\S]*?<img src="\/assets\/open\/shop-720\.webp"[^>]*alt="Model wearing the Al Quaa Galaxy Tee/.test(bs) && (bs.match(/<h1[ >]/g) || []).length === 1);
  check('no spin carousel and no per-product viewers', !/class="sring|id="shopRing|data-viewer=|class="pv-stage|id="filtPanel"|id="filtToggle"|<model-viewer/.test(bs));
  check('the places map is the last block before the footer', bs.indexOf('id="s-places"') > bs.indexOf('</main>') && bs.indexOf('id="s-places"') > bs.indexOf('id="shopGrid"'));
  check('old links still land: #shop-sahel and #shop-trail are mapped', /'shop-sahel':'sahel','shop-trail':'trail'/.test(bs));
  check('no category row on the shop page (the chips do that job)', !/class="sb-cats"|class="op-cats"/.test(bs));
  const ars = fs.readFileSync(path.join(__dirname, 'ar', 'shop', 'index.html'), 'utf8');
  check('/ar/shop/ is the same grid, in Arabic', (ars.match(/<div class="sg-i" /g) || []).length === 16 && /id="shopBar"/.test(ars) && !/UAE graphic|Polos and hoodies|16 pieces|Nothing in this range|Graphic t-shirts, polos/.test(ars));
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
  const expectImgs = GRID.reduce((n, r) => n + r[4].length, 0);   /* 22 before the female shots, 35 after (8 Sep) */
  check(pg + ': every card photo offers an 800px card-sized candidate', imgs.length === expectImgs && noSet.length === 0, imgs.length + ' imgs (want ' + expectImgs + '), ' + noSet.length + ' without srcset');
  check(pg + ': every card photo decodes off the main thread', noAsync.length === 0, noAsync.length + ' without decoding=async');
  check(pg + ': sizes follows the grid at every width (2 columns on tablets, 3 up to the wrap, then fixed)', noSizes.length === 0, noSizes.length + ' wrong sizes; expected ' + expectSizes);
  /* the w descriptor must be the file's real width - 1536w on a 1076px model
     shot lets the browser believe it picked a sharper file than it did */
  /* a .webp is served in place of its JPEG master at the same pixel size (23 Sep 2026): measure the master */
  const jpegW = f => { f = f.replace(/\.webp$/, '.jpg'); const d = fs.readFileSync(path.join(__dirname, f)); let i = 2; while (i < d.length && d[i] === 0xFF) { const m = d[i + 1]; if (m === 0xC0 || m === 0xC1 || m === 0xC2) return d.readUInt16BE(i + 7); i += 2 + d.readUInt16BE(i + 2); } return 0; };
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
  check('...and it is the one that warms the next frames and decodes the lead (28 Oct 2026: next two only; the rest after 3 s on screen)', /warm\(/.test(aheadSrc) && /lead\.decode\(\)/.test(aheadSrc));
  check('the beat observer has no margin (cards only beat when actually on screen)',
    /var io = new IntersectionObserver\(function \(es\) \{[\s\S]{0,1200}\}\);\n\s+hosts\.forEach\(function \(h\) \{ io\.observe\(h\); \}\);/.test(eng) && !/io = new IntersectionObserver\([\s\S]{0,500}rootMargin/.test(eng));
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
    check('the beat is 2 seconds (expert timing, 28 Oct 2026; 1.5s from 4 Sep, 3s before)', /var BEAT = 2000\b/.test(src));
    check('a card rests on its cover at least 1.2 s before joining the beat', /REST = 1200\b/.test(src));
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
  check('index.html title carries no preview suffix', /<title>Sahra &amp; Beyond \| UAE Clothing Brand: Graphic Tees, Polos, Hoodies<\/title>/.test(page));   /* 24 Oct 2026: homepage SEO panel title */
  check('index.html canonical is the root', /<link rel="canonical" href="https:\/\/www\.sahraandbeyond\.ae\/">/.test(head));
  check('index.html does not load Lenis (native scroll drives the journey)', !/lenis/i.test(head));
  check('the seven grid cards are real links (the missing-quote bug never returns)',
    (page.match(/<a class="card" href="\/products\/[^"]+\/">/g) || []).length === 7 && !/class="card href/.test(page));
  check('r116: the place cards with their fit switch and quick-add slots left the homepage with the three stories', !/data-fit-pick="/.test(page) && !/<div class="qa" data-qa="/.test(page));
  check('the quick-add engine is on the page', /function quickAdd\(\)/.test(page) && /SahraCart\.variants\(handle\)/.test(page));
  check('the ring re-collects its cards and clears them once open', /cards = \[\]\.slice\.call\(grid\.querySelectorAll\('\.card'\)\);/.test(page) && /clearProps: 'transform,opacity,zIndex'/.test(page));
  check('the ring front card faces the viewer', /rotateY: Math\.sin\(a\) \* 22 \* \(1 - open\)/.test(page));
  check('the ring cards run their slideshow when the scroll rests (holds only while moving)', /if \(moving\) st\.setAttribute\('data-hold', '1'\)/.test(page) && /function holdRing\(on\)/.test(page) && /restT = setTimeout\(function \(\) \{ moving = false; if \(!settled\) holdRing\(false\); \}, 350\)/.test(page));
  check('the collection section is re-measured as the scroll leaves the pin (phone rows grow at settle)', /onLeave: function \(\) \{ if \(phone\) setTimeout\(function \(\) \{ ScrollTrigger\.refresh\(\); \}, 0\); \}/.test(page) && /if \(!ScrollTrigger\.isRefreshing\) section\.classList\.toggle\('ring-on'/.test(page));
  check('the Made-to-last band is two columns on phones', /@media\(max-width:760px\)\{\.qual\{grid-template-columns:1fr 1fr/.test(page));
  check('the ring can be swiped on a loop (spin on its own axis, snaps to a card); only the scroll opens the grid', /function swipe\(\)/.test(page) && /touch-action:pan-y/.test(page) && /ring\.theta \+ ring\.spin/.test(page) && /ring\.spin = drag\.spin \+ dx \/ step \* stepA/.test(page) && /dragstart/.test(page) && !/window\.scrollTo\(0, Math\.max\(st\.start/.test(page));
  check('review filter chips carry no counts (the band caps at 6 while the aggregate counts all)', !/rv-chip[^>]*>All \(/.test(page) && !/★ \(\d+\)<\/button>/.test(page) && /data-star="all">All</.test(fs.readFileSync(path.join(__dirname, 'reviews-render.js'), 'utf8')));
  check('the plates are referenced from /journey/plates/', /\/journey\/plates\/[a-z-]+\.(jpg|webp)/.test(page));
  check('the Storefront list is filtered before fill() (free tote never listed)', /\.filter\(forSale\);fill\(products\);/.test(page));
  check('the review band markers are present', /<!--REVIEWS:START-->/.test(page) && /<!--REVIEWS:END-->/.test(page));
  /* 10 Nov 2026 (r115, landing-page audit): the homepage went from 22 phone screens to a short page. The brand film, the ring
     section, the place map and the story section left it; the Instagram strip stays in #s-film. */
  check('the film has left the homepage (r115); the Instagram strip stays', !/id="brandVideo"/.test(page) && /<!--IG:STRIP-->/.test(page));
  check('r115: one full-photo opener leads the page and holds the only h1', /<section class="op" id="s-open"/.test(page) && (page.match(/<h1[\s>]/g) || []).length === 1 && /<h1 id="opH">Wear a place, not a logo<\/h1>/.test(page) && page.indexOf('id="s-open"') < page.indexOf('id="s-hero"'));
  /* 10 Nov 2026 (r116; Faheem: one screen, "and do the same for Sahel places"): the three full-screen stories are one row of seven places */
  check('r116: one row of seven places sits between the Sahel band and the collection', /<section class="p7" id="s-origin"/.test(page) && (page.match(/class="p7-t"/g) || []).length === 7 && page.indexOf('id="s-origin"') > page.indexOf('<!--NOWBAND:END-->') && page.indexOf('id="s-origin"') < page.indexOf('id="s-collection"') && !/id="s-alquaa"|id="s-liwa"|id="s-naqab"/.test(page));
  check('r116: place tiles carry no price and use the place photos, with the Commons credits on the page', (function () { var a = page.indexOf('id="s-origin"'), z = page.indexOf('</section>', a), sec = page.slice(a, z); return !/AED|sb-price|% off/.test(sec) && (sec.match(/\/assets\/places\/[a-z-]+-400\.webp" srcset/g) || []).length === 7 && /Kamyana/.test(sec) && /Karachun/.test(sec) && /Mohammed Abdul Haris/.test(sec) && /Xiaotong Gao/.test(sec) && /CC BY-SA 4\.0/.test(sec) && /CC BY-SA 3\.0/.test(sec); })());
  check('r116: data-track clicks are sent to GA4 by one listener in the shared head', /closest\('\[data-track\]'\)/.test(page));
  /* 10 Nov 2026 (r117): Sahra Trail size charts, from the supplier spec (content/trail-sizing.json) */
  (function () {
    var rd = function (f) { return fs.readFileSync(path.join(__dirname, f), 'utf8'); };
    var tee = rd('products/sahra-trail-tee/index.html'), sh = rd('products/sahra-trail-2-in-1-short/index.html'), kit = rd('products/sahra-trail-kit/index.html'), bag = rd('products/trailhead-bag/index.html'), sg = rd('size-guide/index.html');
    var TS = JSON.parse(rd('content/trail-sizing.json'));
    var has = function (h, k) { return TS[k].rows.every(function (r) { return r.slice(1).every(function (c) { return h.indexOf('>' + String(Math.round(c[0] * 10) / 10).replace(/\.0$/, '') + '&nbsp;cm<small dir="ltr">' + c[1] + '&Prime;</small>') > -1; }); }); };
    check('r117: the Trail Tee page carries the tee chart and not the short chart', /id="size-chart"/.test(tee) && has(tee, 'tee') && !/Waist, relaxed/.test(tee));
    check('r117: the Trail Short page carries the short chart and not the tee chart', /id="size-chart"/.test(sh) && has(sh, 'short') && !/Sleeve, from the neck/.test(sh));
    check('r117: the Trail Kit page carries both charts; the one-size bag has none', has(kit, 'tee') && has(kit, 'short') && !/id="size-chart"/.test(bag));
    check('r117: the size guide has a Sahra Trail section with both charts', /<section class="guide-sec" id="trail">/.test(sg) && has(sg, 'tee') && has(sg, 'short') && /href="#trail">Sahra Trail chart</.test(sg));
    check('r117: no Trail page still says there is no size chart', [tee, sh, kit, rd('trail/index.html'), rd('activewear/index.html'), page].every(function (h) { return !/No size chart for this piece yet|No size chart yet|no size chart for these yet/.test(h); }) && !/Sahra Trail have no chart yet/.test(sg));
    check('r117: Trail charts say allow 1 cm, carry no fabric weight and no XXL', /Allow <span dir="ltr">&plusmn;1<\/span>&nbsp;cm/.test(tee) && !/gsm/i.test(tee.slice(tee.indexOf('id="size-chart"'), tee.indexOf('id="size-chart"') + 6000)) && !/XXL|2XL/.test(JSON.stringify(TS.tee.sizes) + JSON.stringify(TS.short.sizes)));
    check('r117: the bag no longer says Trail has no size chart; it links to the Trail chart', (function () { var c = rd('assets/sahra-cart.js'); return !/No size chart yet/.test(c) && /size-guide\/#trail/.test(c) && /trailChart/.test(c); })());
    /* 10 Nov 2026 (r118, site scorecard; Faheem: "Quiet it today", "One-row buy bar", "Reviews and fit line") */
    var kfb = rd('products/khor-fakkan-bay-tee-regular/index.html'), scss = rd('assets/sahra-specimen.css'), wel = rd('assets/sahra-welcome.js');
    check('r118: the filled % off pill is off cards; the percentage shows once, as plain text, beside a product page price', /sbs-t\{display:none/.test(page) && /html\[data-sale="1"\] \.ss-price sbs-t\.sbs-tag/.test(page) && !/sbs-t\{[^}]*background:#7E4114/.test(page) && /<s class="sbs-was|sbs-was/.test(page));
    check('r118: the sale line in the top bar shows on shopping pages only', /var SHOPPING = /.test(wel) && /STAGES\[k\]\.promo && !SHOPPING/.test(wel));
    check('r118: the phone buy bar is one row (its second row is hidden under 900px) and the page carries the Tabby line', /@media\(max-width:899px\)\{\s*html body \.ssb \.ssb-r2\{display:none\}/.test(scss) && !/\.ss-body \.ss-tabby\{display:none!important\}/.test(scss) && /<p class="ss-tbp"><span class="ssb-tb/.test(kfb) && /<p class="ss-tbp">/.test(tee));
    check('r118: Sahel pages show two labelled Founding Edition reviews and the size the model wears; Sahra Trail pages show neither reviews nor a rating', (function () {
      /* 12 Nov 2026: once a piece has reviews of its own (the Judge.me sync brings them in with nobody watching), its page shows those instead, so this check follows the review files */
      var RVt = require('./reviews-render.js'), ownOf = function (hs) { return !!RVt.merge(hs); };
      var kOwn = ownOf(['khor-fakkan-bay-tee-regular', 'khor-fakkan-bay-tee-super-oversized', 'khor-fakkan-bay-tee-oversized']);
      var kOk = kOwn ? (/<section class="po-rv po-rv-own reviews" id="reviews"/.test(kfb) && !/id="first-reviews"/.test(kfb) && /<a class="po-rate" href="#reviews">/.test(kfb))
        : (/id="first-reviews"/.test(kfb) && /no reviews of its own yet/.test(kfb) && (kfb.match(/<li><b class="po-rv-s"/g) || []).length === 2);
      var tOk = function (h, hs) { return ownOf(hs) ? /<a class="po-rate" href="#reviews">/.test(h) && /id="reviews"/.test(h) : !/<a class="po-rate"/.test(h); };
      return kOk && /class="ss-help">The model wears S\. /.test(kfb) && !/id="first-reviews"/.test(tee) && tOk(tee, ['sahra-trail-tee']) && tOk(kit, ['sahra-trail-kit']);
    })());
    /* 10 Nov 2026 (r119, site scorecard; Faheem: "Phone category row", "Lighter pages") */
    var tsh = rd('t-shirts/index.html'), shp = rd('shop/index.html');
    { const act = rd('activewear/index.html'), trl = rd('trail/index.html'), arh = rd('ar/index.html');
      check('category row: the fourth link is named Activewear, a category, not the Sahra Trail sub-brand, and opens the Trail range page (Faheem, 11 Nov 2026)',
        /<a href="\/trail\/" data-track="cat_row">Activewear<\/a><a href="\/shop\/" data-track="cat_row">Shop all<\/a><\/nav>/.test(page) && !/data-track="cat_row">Sahra Trail</.test(page + tsh + act + trl) &&
        /<a href="\/trail\/" aria-current="true" data-track="cat_row">Activewear</.test(act) && /<a href="\/trail\/" aria-current="page" data-track="cat_row">Activewear</.test(trl) && /<a href="\/ar\/trail\/" data-track="cat_row">ملابس رياضية</.test(arh)); }
    check('r119: a category row sits under the header on the listing pages and across the top of the homepage opener (phones only)', /<\/header>\s*<nav class="sb-cats" aria-label="Shop by category"><a href="\/t-shirts\/" aria-current="page"/.test(tsh) && /\.sb-cats\{display:none\}/.test(tsh) && /<nav class="op-cats" aria-label="Shop by category">/.test(page) && /\.op-cats\{display:none\}/.test(page) && !/class="sb-cats"/.test(kfb) && !/class="sb-cats"/.test(rd('sahel/index.html')));
    /* 10 Nov 2026 (r121; Faheem, tablet screenshot: "The category menu gets cut off on tablet"): the homepage row is a <nav>, so it
       inherited the site bar's top offset and sat part-way under the bar (52px on a phone, 66px from about 620px wide). It now
       starts where the bar ends: a rule that outranks `body.has-topbar nav`, fed by the bar's measured height. */
    { const hp = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'), hpa = fs.readFileSync(path.join(__dirname, 'ar', 'index.html'), 'utf8');
      [['/', hp], ['/ar/', hpa]].forEach(([u, h]) => check('r121 ' + u + ': the homepage category row starts below the site bar at every width', /html body nav\.op-cats\{top:var\(--op-nav,52px\)\}/.test(h) && /setProperty\('--op-nav',h\+'px'\)/.test(h) && /new ResizeObserver\(f\)\.observe\(n\)/.test(h))); }

/* ---- Stage 3, the house look (10 Nov 2026; Faheem: "Execute stage 3") -------------------------------------------
   Every listing page opens on the house opener (a real model photo of a piece sold there, heroes.js), carries the
   house stylesheet (house.js: plain ground, one card, seven text sizes) and lists its products ONCE, in one grid. */
console.log('\n\x1b[1mStage 3 - the house look on every listing page\x1b[0m');
{
  const OPEN = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'openers.json'), 'utf8')); delete OPEN._;
  const slugs = Object.keys(OPEN);
  check('seventeen listing and range pages have an opener photo, each with alt text and a kicker', slugs.length === 17 && slugs.every(k => OPEN[k].alt && OPEN[k].kicker && fs.existsSync(path.join(__dirname, OPEN[k].src))), slugs.length + ' pages');
  check('every opener image is built in three sizes', slugs.every(k => ['-m-780', '-720', '-1076'].every(x => fs.existsSync(path.join(__dirname, 'assets', 'open', k.replace(/\//g, '-') + x + '.webp')))));
  check('no opener alt names a place the photo could not vouch for (it says what is worn)', slugs.every(k => /^(Model wearing|Runner stretching in|Runner warming up in|The Sahra Tote)/.test(OPEN[k].alt)));
  slugs.forEach(k => {
    const h = fs.readFileSync(path.join(__dirname, k, 'index.html'), 'utf8'), ar = fs.readFileSync(path.join(__dirname, 'ar', k, 'index.html'), 'utf8');
    const main = h.slice(h.indexOf('<main'), h.indexOf('</main>'));
    check('/' + k + '/: house opener, house stylesheet, one h1, no old hero', /<body[^>]*class="[^"]*\bls-page\b/.test(h) && /<section class="ho( ho-top)?" aria-labelledby=/.test(h) && /<style id="house">/.test(h) && (h.match(/<h1[\s>]/g) || []).length === 1 && !/class="loc-hero/.test(h));
    check('/' + k + '/: products listed once, in one grid', (main.match(/<div class="pcards/g) || []).length === 1 && !/<section class="pcta"/.test(main) && (() => { const hs = (main.match(/<article[^>]*class="pcard[^"]*"[^>]*data-handle="([^"]+)"/g) || []).map(x => /data-handle="([^"]+)"/.exec(x)[1]); return hs.length > 0 && new Set(hs).size === hs.length; })());
    check('/ar/' + k + '/: the same opener and grid in Arabic', /<section class="ho( ho-top)?" aria-labelledby=/.test(ar) && /<style id="house">/.test(ar) && (ar.match(/<div class="pcards/g) || []).length === 1);
  });
  /* 11 Nov 2026 (the Trail merge; Faheem: "Proceed with trail merge"): Sahra Trail is a range inside the house brand */
  {
    const tr = fs.readFileSync(path.join(__dirname, 'trail', 'index.html'), 'utf8'), tar = fs.readFileSync(path.join(__dirname, 'ar', 'trail', 'index.html'), 'utf8');
    check('/trail/: a range page in the house look, with the range line as its title', /<h1 id="hoH">Choose the climb\.<\/h1>/.test(tr) && /<body[^>]*class="[^"]*\bls-page\b/.test(tr) && !/\btrail-page\b/.test(tr));
    check('/trail/: the Two Ridges is a small range mark beside the name, not a brand logo', /<p class="ho-k"><svg class="ho-mk" viewBox="31 31 205 183" aria-hidden="true"/.test(tr) && /<\/svg>Sahra Trail<\/p>/.test(tr) && !/class="tr-lockup|A new line from Sahra/.test(tr));
    check('/trail/: no night scene, no reveal film, no rendered plates', !/sahra-trail\.js|tr-film|hajar-night|hajar-dawn|trail-reveal/.test(tr));
    check('/trail/: the pieces are the house card, and #pieces still lands', /<section id="pieces" class="nb hg/.test(tr) && (tr.match(/<article[^>]*class="pcard/g) || []).length === 4);
    check('/ar/trail/: the automatic mirror of the range page', /<section class="ho" aria-labelledby="hoH"/.test(tar) && /<style id="house">/.test(tar) && (tar.match(/<article[^>]*class="pcard/g) || []).length === 4 && !/sahra-trail\.js/.test(tar));
    const hpT = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'), feed = fs.readFileSync(path.join(__dirname, 'feed', 'index.html'), 'utf8');
    check('/ar/trail/: the range line stays in English (Faheem, 6 Oct and 11 Nov 2026)', /<h1 id="hoH">Choose the climb\.\u200e<\/h1>/.test(tar) && !/اختر الصعود/.test(tar));
    check('posts from the old Trail account are left off the site feed (Faheem, 11 Nov 2026)', (() => { const IGD = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'instagram.json'), 'utf8')); const ids = IGD.posts.filter(p => p.account === 'trail').map(p => p.id); return ids.length > 0 && ids.every(id => !feed.includes('data-id="' + id + '"') && !hpT.includes('data-id="' + id + '"')); })());
    check('the old Trail account is not named anywhere on the built site', ['index.html','feed/index.html','trail/index.html','hiking/index.html','ar/index.html','ar/feed/index.html','ar/trail/index.html','products/sahra-trail-tee/index.html','products/sahra-trail-kit/index.html','products/sahra-trail-2-in-1-short/index.html'].every(f => !/sahratrail/i.test(fs.readFileSync(path.join(__dirname, f), 'utf8'))));
    check('one Instagram account to follow: no "Follow @sahratrail" button on the site', !/Follow @sahratrail/.test(hpT) && !/Follow @sahratrail/.test(feed) && /Follow @sahraandbeyond\.ae/.test(hpT + feed));
  }
  /* 11 Nov 2026 (r126): Google Analytics. Every product event carries the same product fields, and the card Quick add reaches GA4. */
  {
    const vm = require('vm');
    const run = (file, pathname, bodyClass) => {
      const html = fs.readFileSync(path.join(__dirname, file), 'utf8');
      const src = (html.match(/<!-- Google Analytics 4 -->\s*<script>([\s\S]*?)<\/script>/) || [])[1] || '';
      const noop = () => {};
      const sb = { location: { pathname, search: '' }, performance: { now: () => 5 }, sessionStorage: { getItem: () => null, setItem: noop }, setTimeout: noop, addEventListener: noop, removeEventListener: noop, scrollY: 0, innerHeight: 800,
        document: { body: { className: bodyClass }, readyState: 'complete', visibilityState: 'visible', referrer: '', addEventListener: noop, documentElement: { classList: { add: noop }, scrollHeight: 2000 }, createElement: () => ({}), head: { appendChild: noop }, querySelectorAll: () => [] } };
      sb.window = sb; vm.createContext(sb);
      let ok = true; try { vm.runInContext(src, sb); } catch (e) { ok = false; }
      const send = (n, p) => { sb.track(n, p); const a = sb.dataLayer[sb.dataLayer.length - 1]; return a && a[1] === n ? a[2] : {}; };
      return { ok, src, send };
    };
    const A = run('men/index.html', '/ar/men/', 'buy-page ls-page');
    check('analytics: the head script runs and is plain ASCII', A.ok && A.src.length > 3000 && !/[^\x00-\x7f]/.test(A.src));
    const add = A.send('add_to_cart', { item_id: 'hajar-mountains-regular', size: 'L', via: 'card', position: 3 });
    check('analytics: an add from a card carries product, design, line, category, fit, size, placement, page type and language',
      add.product === 'Hajar Mountains — Regular' && add.product_design === 'Hajar Mountains' && add.product_id === 'hajar-mountains-regular' && add.product_line === 'Founding Edition' && add.product_category === 'T-shirt' &&
      add.fit === 'Regular' && add.size === 'L' && add.placement === 'Product card' && add.page_type === 'category' && add.site_lang === 'ar');
    check('analytics: the same add carries GA4 items[] with the size as the variant and the card position', add.items && add.items.length === 1 && add.items[0].item_variant === 'L' && add.items[0].index === 3 && add.items[0].item_category2 === 'Founding Edition' && add.currency === 'AED' && add.value > 0);
    const sz = A.send('size_select', { item_id: 'sahra-trail-tee', size: 'M', via: 'specimen' });
    check('analytics: a size tap names its product', sz.product === 'Sahra Trail Tee' && sz.product_line === 'Sahra Trail' && sz.size === 'M' && sz.placement === 'Product page');
    const fs2 = A.send('fit_switch', { item_id: 'al-quaa-galaxy-oversized', fit: 'whatever the button said', via: 'card' });
    check('analytics: a fit switch takes its fit from the product it switched to, in English', fs2.fit === 'Oversized' && fs2.product_design === 'Al Quaa Galaxy');
    const P = run('products/sahra-trail-kit/index.html', '/products/sahra-trail-kit/', 'buy-page');
    const ve = P.send('size_finder', { size: 'M' });
    check('analytics: an event with no product of its own takes the product page it happened on', ve.product === 'Sahra Trail Kit' && ve.page_type === 'product' && ve.site_lang === 'en');
    const bc = P.send('begin_checkout', { items: [{ item_id: 'sahra-trail-tee', item_variant: 'M', index: 1 }, { item_id: 'sand-polo', item_variant: 'L', index: 2 }] });
    check('analytics: an event about several products is not given one product', bc.product === undefined && bc.items.length === 2 && bc.items[1].item_name === 'The Sahra Polo');
    const promo = P.send('view_promotion', { promotion_name: '11.11' }), end = P.send('visit_end', { ms: 9 });
    check('analytics: top bar, menu and header events are not given the page product; time on page is', promo.product === undefined && end.product === 'Sahra Trail Kit');
    const prodPage = fs.readFileSync(path.join(__dirname, 'products', 'al-quaa-galaxy-regular', 'index.html'), 'utf8');
    check('analytics: related and pair clicks name the product clicked, not the page', /track\('related_click',\{item_id:\(\(a\.getAttribute\('href'\)/.test(prodPage) && /track\('pair_click',\{item_id:/.test(prodPage));
    const cartJs = fs.readFileSync(path.join(__dirname, 'assets', 'sahra-cart.js'), 'utf8'), measJs = fs.readFileSync(path.join(__dirname, 'assets', 'sahra-measure.js'), 'utf8'), specJs = fs.readFileSync(path.join(__dirname, 'assets', 'sahra-specimen.js'), 'utf8');
    check('analytics: the card Quick add sends the open, the size tap and the add', /ga\('quick_add_open'\)/.test(cartJs) && /ga\('size_select', \{ size: v\.title \}\)/.test(cartJs) && /ga\('add_to_cart', \{ size: v\.title \}\)/.test(cartJs));
    check('analytics: a click through to a product is sent as select_item from anywhere', /track\('select_item', o\)/.test(measJs) && /a\[href\*="\/products\/"\]/.test(measJs));
    check('analytics: the product page names the kit part and sends the fit link tap', /sp\.part = g/.test(specJs) && /tr\('fit_switch', \{ item_id: m\[1\]/.test(specJs));
    const menA = fs.readFileSync(path.join(__dirname, 'men', 'index.html'), 'utf8');
    check('analytics: the card fit switch sends the product, not a fixed line', !/line:'sahel'/.test(menA) && /track\('fit_switch',on&&on\.getAttribute\('data-handle'\)/.test(menA));
    check('analytics: the release and the ad-session flag are written onto every event and onto the page view', add.site_build === 'r127' && add.ad_session === 0 && sz.site_build === 'r127' && /gtag\('config','G-[A-Z0-9]+',\{site_build:'r127',ad_session:window\.SB_AD\?1:0\}\)/.test(A.src));
  }
  /* 12 Nov 2026: one brand palette (Faheem: "B"). */
  {
    const PG = require('./palette-guard.js'); const sc = PG.scan();
    check('palette: no colour outside the brand palette on any built page', sc.off.size === 0, [...sc.off.keys()].slice(0, 6).join(' '));
    check('palette: the seven brand colours are the house-look values', PG.PALETTE.ink === '2A2016' && PG.PALETTE.cream === 'FAF6EF' && PG.PALETTE.sand === 'F3DDB8' && PG.PALETTE.clay === '7E4114' && PG.PALETTE.gold === '8F6212' && PG.PALETTE.soft === '4A4136' && PG.PALETTE.mute === '6B6256');
    const ab = fs.readFileSync(path.join(__dirname, 'about', 'index.html'), 'utf8'), sh = fs.readFileSync(path.join(__dirname, 'sahel', 'index.html'), 'utf8');
    check('palette: About and Sahel carry no navy or purple ground', !/#0E0A1F|#14102A|#39295A|#0E1A2E|#0B1526|rgba?\(20, ?16, ?42|rgba?\(14, ?26, ?46/i.test(ab + sh));
    check('palette: the sign-up block is a solid ink ground', /\.news\{[^}]*#2A2016/.test(fs.readFileSync(path.join(__dirname, 'men', 'index.html'), 'utf8')));
  }
  /* 12 Nov 2026 (Faheem: "Why does judge me review sync keep failing"; "As written, automatic"). A new
     Judge.me review must never need a new Arabic dictionary entry, or the twice-daily sync stops at the
     Arabic parity check, as it did from 11 Nov. Review-driven elements carry data-ar-rule and are written
     in Arabic by rule (ar-reviews.js). */
  {
    const AM = require('./ar-mirror.js')._test, AR = require('./ar-reviews.js');
    const dict = AM.loadDict();
    const keysOf = h => { const k = []; AM.extractPage(h, x => k.push(x)); return k; };
    const page = { url: '/x/', rel: 'x/index.html' };
    const mirror = h => AM.mirrorPage('<html><head></head><body>' + h + '</body></html>', page, dict, () => false, new Set(), new Set(), new Set());
    const card = '<li class="rv-card"><span class="rv-stars" aria-hidden="true">★★★★☆</span> <span class="rv-about" data-ar-rule="rv-on|Qqq Piece">On Qqq Piece</span> <strong class="rv-title" data-ar-rule="ugc">Zzq title never seen</strong> <p class="rv-text" data-ar-rule="ugc">Zzq body never seen before.</p> <span class="rv-photos"><a class="rv-photo-a" href="https://x/y.jpg" aria-label="Open customer photo full size"><img class="rv-photo" src="https://x/y.jpg" alt="Customer photo of Qqq Piece" data-ar-rule="rv-alt|Qqq Piece"></a></span> <span class="rv-meta" data-ar-rule="rv-meta|1|2027-01">Zed Buyer · Verified buyer · January 2027</span> <a class="rv-more" href="/products/q/#reviews"><span data-ar-rule="rv-see|Qqq Piece">See it on Qqq Piece &rarr;</span></a> <p class="rv-reply" data-ar-rule="rv-reply"><strong>Sahra &amp; Beyond:</strong> Zzq reply never seen.</p></li>';
    const agg = '<div class="rv-aggregate"><span class="rv-stars" aria-hidden="true">★★★★☆</span> <span class="rv-score">4.8 / 5</span> <span class="rv-count" data-ar-rule="rv-from|41|39">from 41 reviews &middot; 39 verified buyers</span></div>';
    const fresh = keysOf('<ul>' + card + '</ul>' + agg).filter(k => dict[k] == null);
    check('reviews: a review nobody has translated adds no string to the Arabic to-do list', fresh.length === 0, fresh.join(' | ').slice(0, 200));
    const ar = mirror('<ul>' + card + '</ul>' + agg);
    check('reviews: on the Arabic page the review stays as written and its labels are in Arabic', /<p class="rv-text" data-ar-rule="ugc" dir="auto">Zzq body never seen before\.<\/p>/.test(ar) && ar.indexOf('Zed Buyer · مشترٍ موثّق · يناير 2027') > -1 && ar.indexOf('من 41 تقييمًا &middot; 39 مشتريًا موثّقًا') > -1 && ar.indexOf('alt="صورة من عميل: Qqq Piece"') > -1 && !/<arx-/.test(ar), ar.slice(ar.indexOf('<body>'), ar.indexOf('<body>') + 300));
    const name = '<span class="pcard-b"><a class="pcard-t" href="/products/q/">Qqq Piece</a>', rest = '<span class="pcard-place">Inspired by Qqq</span></span>';
    const rated = '<span class="pcard-rv" data-ar-rule="rv-card|5.0|1"><span class="rv-stars" aria-hidden="true">★★★★★</span><span class="pcard-rv-n">5.0 · 1 review</span></span>';
    check('reviews: a card has the same Arabic key with and without its first review', keysOf(name + rated + rest).join('|') === keysOf(name + rest).join('|') && keysOf(name + '\n ' + rated + '\n ' + rest).join('|') === keysOf(name + '\n \n ' + rest).join('|'), keysOf(name + rated + rest).join('|'));
    check('reviews: Arabic counts agree in number', AR.reviews(1) === 'تقييم واحد' && AR.reviews(2) === 'تقييمان' && AR.reviews(2, true) === 'تقييمين' && AR.reviews(7) === '7 تقييمات' && AR.reviews(19) === '19 تقييمًا' && AR.reviews(100) === '100 تقييم' && AR.buyers(2) === 'مشتريان موثّقان' && AR.buyers(7) === '7 مشترين موثّقين');
    const RVsrc = fs.readFileSync(path.join(__dirname, 'reviews-render.js'), 'utf8'), POsrc = fs.readFileSync(path.join(__dirname, 'preorder-page.js'), 'utf8');
    check('reviews: every review-driven element is marked for the Arabic rules', ['class="pcard-rv" data-ar-rule="rv-card|', 'class="pdp-rating-n" data-ar-rule="rv-line|', '<q data-ar-rule="ugc">', 'class="rv-title" data-ar-rule="ugc"', 'class="rv-text" data-ar-rule="ugc"', 'class="rv-meta" data-ar-rule="rv-meta|', 'class="rv-count" data-ar-rule="rv-from|', 'class="rv-about" data-ar-rule="rv-on|', 'class="rv-reply" data-ar-rule="rv-reply"', 'data-ar-rule="rv-alt|'].every(x => RVsrc.indexOf(x) > -1) && (RVsrc.match(/class="rv-text" data-ar-rule="ugc"/g) || []).length === 2 && ['<p data-ar-rule="ugc">', 'data-ar-rule="rv-bought|', 'data-ar-rule="rv-all|', 'data-ar-rule="rv-founding|', 'data-ar-rule="rv-design|'].every(x => POsrc.indexOf(x) > -1));
    const had = fs.readFileSync(path.join(__dirname, 'ar', 'index.html'), 'utf8'), bodies = had.match(/<p class="rv-text"[^>]*>/g) || [];
    check('reviews: every review on the Arabic homepage is shown as its buyer wrote it', bodies.length >= 3 && bodies.every(t => /data-ar-rule="ugc" dir="auto"/.test(t)) && AR.apply({ open: '<p data-ar-rule="ugc">', inner: 'Reviews', close: '</p>', tag: 'p' }, { dict: { Reviews: 'x' }, ui: {} }) === '<p data-ar-rule="ugc" dir="auto">Reviews</p>');
    const hd = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    check('reviews: the built homepage band carries the markers', (hd.match(/<p class="rv-text" data-ar-rule="ugc">/g) || []).length >= 3 && /<span class="rv-count" data-ar-rule="rv-from\|\d+\|0">from \d+ reviews<\/span>/.test(hd));
    const SY = fs.readFileSync(path.join(__dirname, 'sync-reviews.js'), 'utf8');
    check('reviews: the sync knows the Sahel and Sahra Trail products', /require\('\.\/preorder-page\.js'\)\.handles\(\)/.test(SY) && require('./preorder-page.js').handles().indexOf('barr-and-bahr-hoodie') > -1);
    const kinds = s => (s.match(/data-ar-rule="(?:\$\{[^}]*'|\$\{cut \? ')?([a-z-]+)/g) || []).map(x => x.replace(/^.*["']/, ''));
    const used = [...new Set(kinds(RVsrc).concat(kinds(POsrc)).concat(['rv-read', 'rv-see']))].filter(k => k !== 'kind');   /* 'kind' is the word in the explanatory comment */
    check('reviews: every rule named in the page builders exists', used.length >= 14 && used.every(k => typeof AR.RULES[k] === 'function'), used.filter(k => typeof AR.RULES[k] !== 'function').join(' '));
    check('reviews: a dollar sign or a bar in a review cannot break the Arabic page', (function () { const o = AR.apply({ open: '<img alt="x" data-ar-rule="rv-alt|A$&amp;B&#124;C">', inner: '', close: '', tag: 'img' }, { dict: {}, ui: {} }); return o.indexOf('alt="صورة من عميل: A$&B|C"') > -1 && (o.match(/alt="/g) || []).length === 1; })());
    const RV2 = require('./reviews-render.js');
    check('reviews: the stars follow the figure shown beside them', RV2.starCount(4.96) === 5 && RV2.starCount(4.94) === 4 && RV2.starCount(4.5) === 4 && RV2.starCount(5) === 5 && RV2.productName('barr-and-bahr-hoodie') != null);
  }
  /* 12 Nov 2026 (Faheem, two phone screenshots): Founding Edition pages stay cream ("Plain cream, no fade"), and on a
     phone the sizes and Add to bag also sit under the price, with the bar at the bottom when that place is off screen */
  {
    const pq = fs.readFileSync(path.join(__dirname, 'products', 'al-quaa-galaxy-regular', 'index.html'), 'utf8');
    check('product pages: the only scroll colour stop is cream, so the page never fades dark', (pq.match(/data-bg="#[0-9A-Fa-f]{6}"/g) || []).join() === 'data-bg="#FAF6EF"');
    const sjs = fs.readFileSync(path.join(__dirname, 'assets', 'sahra-specimen.js'), 'utf8'), scss2 = fs.readFileSync(path.join(__dirname, 'assets', 'sahra-specimen.css'), 'utf8');
    check('product pages: on a phone the sizes and Add to bag have a place under the price as well as the bar', /phM\.className = 'ssb-ph ssb-ph-m'/.test(sjs) && /head\.parentNode\.insertBefore\(phM, head\.nextSibling\)/.test(sjs) && /\.ssb-ph\.ssb-ph-m\{order:4;height:auto\}/.test(scss2) && /html body \.ssb\.inl\{position:relative/.test(scss2) && /@media\(min-width:900px\)\{\.ssb-ph-m\{display:none\}\}/.test(scss2));
    check('analytics: a size or an add from the bar is told apart from the one under the price', /via: floating \? 'specimen-bar' : 'specimen'/.test(sjs) && /'specimen-bar':'Product page bar'/.test(fs.readFileSync(path.join(__dirname, 'ga4.js'), 'utf8')));
  }
  const men = fs.readFileSync(path.join(__dirname, 'men', 'index.html'), 'utf8');
  check('/men/: each Founding Edition tee is one card with its two fits on the switch', (men.match(/<div class="sfp"><div class="sfp-sw" role="group" aria-label="Fit"><button type="button" class="on" data-i="0" aria-pressed="true">Regular<\/button><button type="button" data-i="1" aria-pressed="false">Oversized<\/button>/g) || []).length === 3);
  ['size-guide', 'fabric'].forEach(k => check('/' + k + '/ is a reading page: no listing stylesheet', !/<style id="house">/.test(fs.readFileSync(path.join(__dirname, k, 'index.html'), 'utf8'))));
  const nw = fs.readFileSync(path.join(__dirname, 'new', 'index.html'), 'utf8');
  check('/new/: #sahel and #trail still land', (nw.match(/id="sahel"/g) || []).length === 1 && (nw.match(/<article id="trail" class="pcard/g) || []).length === 1);
  const sh = fs.readFileSync(path.join(__dirname, 'sahel', 'index.html'), 'utf8'), shop = sh.slice(sh.indexOf('<section class="sh-shop"'));
  check('/sahel/: the pieces are the house card on a plain ground, one per design', /html body\.sahel-page \.sh-shop\{background:#FAF6EF/.test(sh) && (shop.match(/<div class="pcards nb-pc">/g) || []).length === 1 && !/class="nb-c"/.test(shop.slice(0, shop.indexOf('</section>'))) && (shop.match(/<div class="sfp">/g) || []).length === 4);
  const HC = require('./house.js').CSS;
  check('the house stylesheet names seven text sizes and eight text colours', ['--h-label:11px', '--h-small:13px', '--h-body:15px', '--h-lead:17px', '--h-h3:22px', '--h-h2:clamp('].every(x => HC.indexOf(x) > -1) && ['--h-ink', '--h-soft', '--h-mute', '--h-clay', '--h-green', '--h-gold', '--h-cream', '--h-sand'].every(x => HC.indexOf(x + ':') > -1));
  check('the house card hides the spec chips and gives the fit switch a real tap target', /\.pcard-spec,html body\.ls-page \.pcard-col,html body\.ls-page \.pcard-bundle\{display:none!important\}/.test(HC) && /\.sfp-sw button\{position:relative;min-height:28px/.test(HC));
  const hp = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  /* 11 Nov 2026 (r123; Faheem: "Bring it into the house look next"): the homepage's product blocks */
  {
    const lines = hp.slice(hp.indexOf('<div class="hl" id="lines">'), hp.indexOf('id="s-reviews"'));
    check('homepage: Sahel and Sahra Trail are the house product card, one per design, on a plain ground', (lines.match(/<div class="pcards nb-pc hl-g">/g) || []).length === 2 && !/class="nb-c"/.test(lines) && (lines.match(/<div class="sfp">/g) || []).length === 4 && /html body #s-collection\{background:#FAF6EF\}/.test(hp));
    check('homepage: carries the base product-card rules and the house card', /<!--HOMECARD:START--><style>\/\* ---- Product cards/.test(hp) && /<style id="home-house">/.test(hp) && /html body \.hl \.pcard\{/.test(hp));
    check('homepage: its size-chip script leaves the product card\'s Quick add alone', /forEach\(function \(r\) \{ if \(!r\.closest\('\.pcard'\)\) watch\(r\); \}\)/.test(hp));
    check('homepage: the Founding Edition grid keeps its seven cards', (hp.match(/<a class="card" href="\/products\/[^"]+\/">/g) || []).length === 7);
    /* r124 (Faheem: "Quick add button everywhere"): one button on the card; a tap swaps it for the sizes */
    check('homepage: Founding Edition cards show one Quick add button that opens the sizes', /var SHELL = '<button class="qa-open" type="button">Quick add<\/button><span class="qa-s" hidden><\/span>';/.test(hp) && /if \(s\) s\.hidden = false; open\.hidden = true; fill\(row\);/.test(hp) && /html body \.collection \.card \.qa-open\{display:block;width:100%;height:40px/.test(hp) && !/Sizes…<\/span>/.test(hp));
  }
  check('homepage: the lead line is "Wear a place, not a logo", and the Al Quaa tile is the night sky', /<h1 id="opH">Wear a place, not a logo<\/h1>/.test(hp) && /al-quaa-night-400\.webp"[^>]*alt="The Milky Way over the dunes at Al Quaa at night"/.test(hp));
}
    check('r119: the character-set tag is in the first 1,024 bytes of the shop page, and the unused wadi plate is no longer fetched', shp.search(/<meta charset=/i) > -1 && shp.search(/<meta charset=/i) < 1024 && !/var PLATES = \{[^}]*wadi/.test(page) && !/var DEPTHS = \{[^}]*wadi/.test(page));
  })();
  check('r115: the ring, map and story sections are off the homepage', !/id="s-ring"/.test(page) && !/id="s-places"/.test(page) && !/id="s-story"/.test(page));
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

/* ---- the legibility layer (5 Sep 2026) -----------------------------------
   A customer: "too light and small". legibility.js is injected by build.js
   as the last <style> in every page's <head>. */
console.log('\n\x1b[1mlegibility layer - every page\x1b[0m');
{
  const L = require('./legibility');
  check('legibility.js exports the CSS', typeof L.CSS === 'string' && L.CSS.length > 2000);
  check('body copy floor: 16px, weight 400', /body\{font-size:16px;font-weight:400\}/.test(L.CSS));
  check('mono labels floor: 12px', /\.eyebrow,[^{]*\{font-size:12px!important/.test(L.CSS));
  check('secondary copy darker than #6B6256 (via --txt-soft)', /:root\{--txt-soft:#4A4136/.test(L.CSS) && /body\.dark-bg\{--txt-soft:rgba\(250,246,239,\.86\)/.test(L.CSS));
  check('product page: grid column may shrink, thumbs wrap (the phone clipping)', /\.pdp>\*\{min-width:0\}/.test(L.CSS) && /\.gal-thumbs\{flex-wrap:wrap\}/.test(L.CSS));
  check('closed mobile menu is hidden (its shadow dimmed the top bar)', /\.m-panel:not\(\.open\)\{visibility:hidden\}/.test(L.CSS) && /\.m-panel\.open\{visibility:visible/.test(L.CSS));
  check('no text muted by opacity in the layer', !/opacity:0?\.[0-8]\d*/.test(L.CSS.replace(/\.pdp-add:disabled\{opacity:1/g, '')));
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => ['node_modules', '.git', '_backup', '.vercel', 'assets', 'admin'].includes(e.name) ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.html') ? [path.join(d, e.name)] : []);
  const pages = walk(__dirname).filter(p => /<\/head>/i.test(fs.readFileSync(p, 'utf8')));
  const missing = pages.filter(p => (fs.readFileSync(p, 'utf8').match(/<style data-legib>/g) || []).length !== 1);
  check('every built page carries the layer exactly once (' + pages.length + ' pages)', missing.length === 0, missing.slice(0, 5).map(p => path.relative(__dirname, p)).join(', '));
  const stale = pages.filter(p => { const h = fs.readFileSync(p, 'utf8'); const m = h.match(/<style data-legib>([\s\S]*?)<\/style>/); return m && m[1] !== L.CSS; });
  check('the layer on every page matches legibility.js (run node build.js)', stale.length === 0, stale.slice(0, 5).map(p => path.relative(__dirname, p)).join(', '));
  const last = pages.filter(p => { const h = fs.readFileSync(p, 'utf8'); const head = h.slice(0, h.search(/<\/head>/i)); const tags = [...head.matchAll(/<style(?=[\s>])[^>]*>/g)]; return !tags.length || !/data-legib/.test(tags[tags.length - 1][0]); });
  check('the layer is the last <style> in <head> everywhere (it wins by order)', last.length === 0, last.slice(0, 5).map(p => path.relative(__dirname, p)).join(', '));
}

/* ---- buying pages: products first, reading folded (5 Sep 2026) ---------- */
console.log('\n\x1b[1mbuying pages - products first\x1b[0m');
{
  const ts = fs.readFileSync(path.join(__dirname, 't-shirts', 'index.html'), 'utf8');
  const at = s => ts.indexOf(s);
  check('t-shirts: cards come before the review band, the band before the folded essays, the essays before the FAQ',
    at('<section class="nb hg') > 0 && at('<section class="nb hg') < at('class="reviews rv-band"') && at('class="reviews rv-band"') < at('<section class="folds"') && at('<section class="folds"') < at('<section class="faq"'));
  check('t-shirts: the review band is compact (3 shown, a Show-all button)', /rv-list rv-compact/.test(ts) && /class="rv-showall"/.test(ts));
  check('t-shirts: three essays folded under their headings', (ts.match(/class="fold guide-sec"/g) || []).length === 3);   /* 23 Oct 2026: the "Limited runs" essay is gone (no scarcity wording) */
  ['t-shirts/regular', 'polos'].forEach(p => { const h = fs.readFileSync(path.join(__dirname, p, 'index.html'), 'utf8'); check(p + ': products before the folded essays', h.indexOf('<section class="nb hg') > 0 && h.indexOf('<section class="nb hg') < h.indexOf('<section class="folds"')); });   /* 10 Nov 2026 (Stage 3): the one grid of a listing page is section.nb.hg */
  const sg = fs.readFileSync(path.join(__dirname, 'size-guide', 'index.html'), 'utf8');
  check('size guide keeps its essay open (no folds)', !/class="fold guide-sec"/.test(sg));
  const home = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  /* 24 Sep 2026 (Faheem, phone layout review): the homepage and shop bands are compact too - three cards, the rest behind Show more */
  /* 10 Nov 2026 (r120): the one-grid shop carries no review band (the ratings are on the cards), so this is the homepage's check now */
  check('the homepage review band is compact (3 shown, a Show-more button)', /rv-list rv-compact/.test(home));
  /* 25 Sep 2026 (Faheem): no fit warnings - the size chips are followed by a 'Check your size' link to the chart,
     with the design's other fit linked beside it (the polo has one cut, so no other-fit link) */
  /* 12 Nov 2026 (Faheem): the help line leads to the size finder ("Find your fit with our size finder"), which sits in the size section */
  /* 30 Oct 2026 (Specimen Sheet): the fit switch is a Regular | Oversized control on the page and in the buy sheet, the
     size-chart link sits in the help line above the sheet, and the sheet carries the sizes and Add to bag */
  const fw = { 'al-quaa-galaxy-regular': /<div class="ss-fits" role="group" aria-label="Fit"><a href="\/products\/al-quaa-galaxy-regular\/" class="on" aria-current="page">[\s\S]*?<a href="\/products\/al-quaa-galaxy-oversized\/" class="">[\s\S]*?<p class="ss-help">[\s\S]*?<a href="#size-finder" class="pdp-chart">Find your fit with our size finder<\/a>/, 'al-quaa-galaxy-oversized': /<div class="ss-fits" role="group" aria-label="Fit"><a href="\/products\/al-quaa-galaxy-regular\/" class="">[\s\S]*?<a href="\/products\/al-quaa-galaxy-oversized\/" class="on" aria-current="page">[\s\S]*?<p class="ss-help">[\s\S]*?<a href="#size-finder" class="pdp-chart">Find your fit with our size finder<\/a>/, 'sand-polo': /<p class="ss-help">The polo is graded to the Regular tee chart\. <a href="#size-finder" class="pdp-chart">Find your fit with our size finder<\/a>/ };
  Object.entries(fw).forEach(([h, re]) => { const pg = fs.readFileSync(path.join(__dirname, 'products', h, 'index.html'), 'utf8'); check('PDP ' + h + ': a size-finder link above the buy sheet, no slim-fit warning', re.test(pg) && /<div class="sfind" id="size-finder" data-sizefinder/.test(pg) && !/runs slim|one size up/i.test(pg) && (h !== 'sand-polo' || !/class="ss-fits"/.test(pg)) && pg.indexOf('<p class="ss-help">') < pg.indexOf('id="ssBuy"') && pg.indexOf('id="ssBuy"') < pg.indexOf('id="ssAdd"') && /data-size="XL"/.test(pg)); });
}
console.log('\n' + (fail ? '\x1b[31m' : '\x1b[32m') + pass + ' passed, ' + fail + ' failed\x1b[0m');
process.exit(fail ? 1 : 0);
}).catch(e => { console.error(e); process.exit(1); });
