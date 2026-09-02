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

function img(src, alt, on) {
  const i = new El('img');
  i.setAttribute('src', src); i.setAttribute('alt', alt || ''); i.setAttribute('loading', 'lazy');
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

for (const file of ['index.html', 'homepage-preview.html']) {
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
console.log('\n\x1b[1massets/sahra-market.js — normCycle\x1b[0m');
{
  const src = fs.readFileSync(path.join(__dirname, 'assets', 'sahra-market.js'), 'utf8');
  const a = src.indexOf('  function normCycle(h)');
  const b = src.indexOf('  function cycles()');
  check('normCycle exists and runs before cycles()', a > -1 && b > a);
  const norm = new Function(src.slice(a, b) + '\n; return normCycle;')();

  /* ---- cadence: the tablet "flicker" of 2 Sep 2026 --------------------
     Seven cards fit on screen at 1024x768 and four of them carry exactly two
     frames (Regular cards drop the model shots on purpose). The old engine
     advanced EVERY visible stack on the SAME 1s tick, so those four blinked
     A/B in unison - reported as the homepage flickering. */
  {
    const fp0 = src.indexOf('  function framePeriod(n)');
    check('framePeriod exists', fp0 > -1 && fp0 < a);
    /* If it is missing, FAIL the cadence contract and move on. A regression
       test that throws takes the rest of the suite with it, which is how a
       gate stops being a gate. */
    let framePeriod = null;
    if (fp0 > -1 && fp0 < a) {
      try { framePeriod = new Function(src.slice(fp0, a) + '\n; return framePeriod;')(); } catch (e) {}
    }
    if (typeof framePeriod !== 'function') {
      check('the cycle engine defines a per-stack cadence', false,
        'framePeriod not found - every visible stack still advances on the same tick');
    } else {

    check('a rich stack keeps the 1s rhythm', framePeriod(5) === 2 && framePeriod(4) === 2);
    check('a three-frame stack slows to 2s', framePeriod(3) === 4);
    check('a two-frame stack dwells 3s, so it cannot blink', framePeriod(2) === 6);

    /* the real homepage shape, in half-ticks, over 24 ticks (12 seconds) */
    const FRAMES = [2, 5, 2, 5, 2, 4, 2];
    let worst = 0, twoFrameAdvances = 0, richAdvances = 0;
    for (let tick = 1; tick <= 24; tick++) {
      let together = 0;
      FRAMES.forEach((f, n) => {
        if ((tick + n) % framePeriod(f) === 0) {
          together++;
          if (f === 2) twoFrameAdvances++; else richAdvances++;
        }
      });
      worst = Math.max(worst, together);
    }
    check('the seven cards never all turn over at once', worst < FRAMES.length,
      'worst simultaneous: ' + worst + ' of ' + FRAMES.length);
    check('at most half the grid changes on any tick', worst <= 3, 'worst: ' + worst);
    check('two-frame cards change far less often than rich ones',
      twoFrameAdvances < richAdvances,
      'two-frame: ' + twoFrameAdvances + ' vs rich: ' + richAdvances);
    /* 4 two-frame cards over 12s: 3s dwell => 4 changes each = 16 */
    check('a two-frame card changes every 3s, not twice a second',
      twoFrameAdvances === 16, 'got ' + twoFrameAdvances);
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

  // and the other direction: two frames marked visible
  host.querySelectorAll('img').forEach(i => i.classList.add('on'));
  norm(host);
  check('normCycle collapses a double-exposed stack', host.querySelectorAll('img.on').length === 1);

  const empty = new El('div'); empty.setAttribute('data-cycle', '');
  norm(empty);
  check('an empty stack does not throw', true);
}

console.log('\n' + (fail ? '\x1b[31m' : '\x1b[32m') + pass + ' passed, ' + fail + ' failed\x1b[0m');
process.exit(fail ? 1 : 0);
