/* ==========================================================================
   sizefinder-data.js — what the size finder knows about each piece (12 Nov 2026)
   ==========================================================================
   Size finder 2 (Faheem, 12 Nov 2026, after a six-person panel review: "On every product page",
   "Better questions", "Honest answer", "Opens as a sheet"; claude/REVIEW-size-finder-panel-12-Nov-2026.md).

   Every figure comes from the charts the site already publishes:
   - Founding Edition tees and the Sahra Polo: content/sizing.json (rows: size, chest in, chest cm FLAT, length in, length cm, ...)
   - Sahel tees and hoodies: content/sahel-sizing.json (same row shape)
   - Sahra Trail: content/trail-sizing.json, whose "body" table gives the body chest and waist each size is made for

   A "garment" piece is matched by the room it leaves at the chest: full chest (2 x flat) minus the wearer's chest,
   aimed at the piece's designed room ("target", cm). A "bands" piece (Sahra Trail) is matched by the body ranges
   the supplier sized it for. The rules and the wording live in assets/sahra-sizefinder.js.

   Designed room at the chest (fit technologist, panel review): Regular 8-12 cm, Oversized 18-22, Super Oversized
   24-30, so the targets below are the middles. Sahel Regular is aimed at the same room as any Regular tee, which is
   why it often answers one size smaller than the letter people are used to: Sahel is cut larger (its S is 22" flat,
   the Founding Edition S is 19"). Tune these against exchanges once there are enough (GA4 event size_finder).
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const J = f => JSON.parse(fs.readFileSync(path.join(__dirname, 'content', f), 'utf8'));
const F = J('sizing.json'), S = J('sahel-sizing.json'), T = J('trail-sizing.json');

const TARGET = { regular: 10, oversized: 20, superOversized: 27, hoodie: 28 };
/* [size, full chest cm, length cm] from a row [size, chest in, chest cm flat, length in, length cm, ...] */
const garmentRows = rows => rows.map(r => [r[0], Math.round(r[2] * 2 * 10) / 10, r[4]]);

function founding(fit) {
  const rows = fit === 'oversized' ? F.oversized : F.regular;
  if (!rows) return null;
  return { kind: 'garment', id: 'founding-' + fit, label: fit === 'oversized' ? 'Founding Edition, Oversized' : 'Founding Edition, Regular', labelAr: fit === 'oversized' ? 'الإصدار التأسيسي، أوفرسايز' : 'الإصدار التأسيسي، ريجولر', target: fit === 'oversized' ? TARGET.oversized : TARGET.regular, sizes: garmentRows(rows) };
}
function polo() {
  return F.regular ? { kind: 'garment', id: 'polo', label: 'The Sahra Polo', labelAr: 'بولو صحراء', target: TARGET.regular, sizes: garmentRows(F.regular) } : null;
}
function sahel(key) {
  const d = S[key]; if (!d || !d.rows) return null;
  const target = key === 'hoodie' ? TARGET.hoodie : key === 'teeSuperOversized' ? TARGET.superOversized : key === 'teeRegular' ? TARGET.regular : null;
  if (target == null) return null;
  const label = { teeRegular: 'Sahel tee, Regular', teeSuperOversized: 'Sahel tee, Super Oversized', hoodie: 'Sahel hoodie, Super Oversized' }[key];
  const labelAr = { teeRegular: 'تيشيرت ساحل، ريجولر', teeSuperOversized: 'تيشيرت ساحل، سوبر أوفرسايز', hoodie: 'هودي ساحل، سوبر أوفرسايز' }[key];
  return { kind: 'garment', id: 'sahel-' + key, label, labelAr, target, sizes: garmentRows(d.rows) };
}
/* "91&ndash;96" -> [91, 96] */
const band = s => String(s).replace(/&ndash;|–/g, '-').split('-').map(Number);
function trail(part) {
  const b = T.body && T.body.rows; if (!b) return null;
  const i = part === 'short' ? 2 : 1;
  const piece = { kind: 'bands', part, id: 'trail-' + part, label: part === 'short' ? 'Sahra Trail 2-in-1 Short' : 'Sahra Trail Tee', labelAr: part === 'short' ? 'شورت صحراء تريل 2 في 1' : 'تيشيرت صحراء تريل', sizes: b.map(r => [r[0]].concat(band(r[i][0]))) };
  /* the tee also gets its room at the chest and its length, from the garment chart */
  if (part === 'tee' && T.tee && T.tee.rows) {
    const chest = T.tee.rows.find(r => /^Chest/.test(r[0])), len = T.tee.rows.find(r => /^Length/.test(r[0]));
    if (chest && len) piece.garment = T.tee.sizes.map((z, k) => [z, Math.round(chest[k + 1][0] * 2 * 10) / 10, len[k + 1][0]]);
  }
  return piece;
}

/* What a product page offers. p is either a Founding Edition product (build-products.js) or a Sahel / Sahra Trail
   product (preorder-page.js). Returns null where there is no chart to work from (the Sahel Polo, the bag, a paused fit). */
function forFounding(p) {
  if (p.garment === 'polo') return { pieces: [polo()] };
  return { pieces: [founding(p.fit === 'oversized' ? 'oversized' : 'regular')] };
}
function forNewLine(p, SZ, TSZ) {
  const sk = SZ.keyFor(p);
  if (sk) { const x = sahel(sk); return x ? { pieces: [x] } : null; }
  const tk = TSZ.keyFor(p);
  if (tk === 'kit') return { pieces: [trail('tee'), trail('short')], kit: true };
  if (tk) return { pieces: [trail(tk)] };
  return null;
}
/* the size guide: every piece, chosen from a list */
function all() {
  return { pieces: [founding('regular'), founding('oversized'), polo(), sahel('teeRegular'), sahel('teeSuperOversized'), sahel('hoodie'), trail('tee'), trail('short')].filter(Boolean), choose: true };
}
/* the markup: an anchor the help line opens, and the data the script reads */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
function mount(cfg, opts = {}) {
  if (!cfg || !cfg.pieces || !cfg.pieces.length || cfg.pieces.some(x => !x)) return '';
  const data = Object.assign({}, cfg, opts.handle ? { handle: opts.handle } : {});
  return `<div class="sfind" id="size-finder" data-sizefinder${opts.inline ? ' data-inline="1"' : ''} data-sf='${esc(JSON.stringify(data))}'></div>`;
}
const SCRIPT = '<script src="/assets/sahra-sizefinder.js" defer></script>';

module.exports = { founding, polo, sahel, trail, forFounding, forNewLine, all, mount, SCRIPT, TARGET };
