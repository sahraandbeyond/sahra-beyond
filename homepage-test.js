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
 *   5. ONE CARD PER DESIGN — the two fits never open duplicate cards.
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

function scene() {
  const doc = mkDoc();
  const grid = new El('div'); grid.classList.add('grid'); grid.setAttribute('id', 'grid');
  grid.appendChild(mkCard('/products/al-quaa-galaxy-regular/', 'Al Quaa', 'Al Quaa Galaxy Tee', 'al-quaa-galaxy-regular', 199,
    ['/shirts/alquaa-regular-back.jpg', '/shirts/alquaa-regular-front.jpg', '/shirts/alquaa-model-back.jpg', '/shirts/alquaa-model-front.jpg', '/shirts/alquaa-model-dusk.jpg']));
  grid.appendChild(mkCard('/products/empty-quarter-regular/', 'Liwa', 'Empty Quarter Tee', 'empty-quarter-regular', 199,
    ['/shirts/emptyquarter-regular-front.jpg', '/shirts/emptyquarter-regular-back.jpg', '/shirts/emptyquarter-model-front.jpg', '/shirts/emptyquarter-model-stand.jpg', '/shirts/emptyquarter-model-sunset.jpg']));
  grid.appendChild(mkCard('/products/hajar-mountains-regular/', 'Wadi Naqab', 'Hajar Mountains Tee', 'hajar-mountains-regular', 199,
    ['/shirts/hajar-regular-back.jpg', '/shirts/hajar-regular-front.jpg', '/shirts/hajar-model-back.jpg', '/shirts/hajar-model-front.jpg']));
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
  { title: 'Sand Polo', handle: 'sand-polo', place: 'Dubai', img: CDN + 'polo-front.jpg', price: '249.00', cur: 'AED' }
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
    const stem = { 'al-quaa-galaxy': 'alquaa', 'empty-quarter': 'emptyquarter', 'hajar-mountains': 'hajar', 'sand-polo': 'polo' }[key] || key;
    c.querySelectorAll('img').forEach(i => {
      const src = i.getAttribute('src') || '';
      if (src.indexOf(stem) < 0) crossed.push(key + ' <- ' + src);
    });
  });
  check('no card shows another product\'s photograph', crossed.length === 0, crossed.slice(0, 4).join('\n      '));

  // 2. The static stacks were not rewritten from Shopify.
  const cdnInStacks = cards.reduce((n, c) => n + c.querySelectorAll('img').filter(i => (i.getAttribute('src') || '').indexOf('cdn.shopify') > -1 && c.getAttribute('href').indexOf('sand-polo') < 0).length, 0);
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

  // 5. One card per design — fits must not duplicate the grid.
  const keys = cards.map(c => DESIGN(c.getAttribute('href')));
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
  check('one card per design (fits never duplicate)', dupes.length === 0, 'duplicated: ' + dupes.join(', '));

  // 6. A design with no static card gets a clone carrying ITS OWN photo.
  const polo = cards.find(c => DESIGN(c.getAttribute('href')) === 'sand-polo');
  check('a new design gets a card', !!polo, 'polo never appeared');
  if (polo) {
    const srcs = polo.querySelectorAll('img').map(i => i.getAttribute('src'));
    check('the clone carries its own photo, not the template\'s',
      srcs.length === 1 && srcs[0].indexOf('polo') > -1, JSON.stringify(srcs));
    check('the clone is visible', polo.querySelectorAll('img.on').length === 1);
    check('the clone prices itself', (polo.querySelector('.sb-price') || {}).getAttribute('data-handle') === 'sand-polo');
  }
}

/* ---- the engine-level guard in sahra-market.js -------------------------- */
console.log('\n\x1b[1massets/sahra-market.js — normCycle\x1b[0m');
{
  const src = fs.readFileSync(path.join(__dirname, 'assets', 'sahra-market.js'), 'utf8');
  const a = src.indexOf('  function normCycle(h)');
  const b = src.indexOf('  function cycles()');
  check('normCycle exists and runs before cycles()', a > -1 && b > a);
  const norm = new Function(src.slice(a, b) + '\n; return normCycle;')();

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
