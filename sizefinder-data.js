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

/* 17 Nov 2026 (Faheem, on the blocker audit: a 182 cm, 79 kg man who wants the Founding Edition Oversized tee as designed
   takes M; the finder said S): the Oversized tee is aimed at 23 cm of room (was 20), so a build between S and M lands on M.
   The Sahel Oversized tee is on the same chart, so it follows. The Oversized hoodie keeps its own 20. */
const TARGET = { regular: 10, relaxed: 15, oversized: 23, superOversized: 27, hoodie: 28, hoodieOversized: 20 };   /* 22 Nov 2026 (Faheem: the Sahel Regular is shown as Relaxed): aimed at relaxed room, 15 cm, the middle of 10-18 */   /* 14 Nov 2026: the Oversized hoodie is the original hoodie chart, 1.5 in closer than the Super Oversized */
/* [size, full chest cm, length cm] from a row [size, chest in, chest cm flat, length in, length cm, ...] */
const garmentRows = rows => rows.map(r => [r[0], Math.round(r[2] * 2 * 10) / 10, r[4]]);

function founding(fit) {
  const rows = fit === 'oversized' ? F.oversized : F.regular;
  if (!rows) return null;
  return { kind: 'garment', fitKey: fit === 'oversized' ? 'oversized' : 'regular', id: 'founding-' + fit, label: fit === 'oversized' ? 'Founding Edition, Oversized' : 'Founding Edition, Regular', labelAr: fit === 'oversized' ? 'الإصدار التأسيسي، أوفرسايز' : 'الإصدار التأسيسي، ريجولر', target: fit === 'oversized' ? TARGET.oversized : TARGET.regular, sizes: garmentRows(rows) };
}
function polo() {
  return F.regular ? { kind: 'garment', fitKey: 'regular', id: 'polo', label: 'The Sahra Polo', labelAr: 'بولو صحراء', target: TARGET.regular, sizes: garmentRows(F.regular) } : null;
}
function sahel(key) {
  const d = S[key]; if (!d || !d.rows) return null;
  const target = { hoodie: TARGET.hoodie, hoodieOversized: TARGET.hoodieOversized, teeSuperOversized: TARGET.superOversized, teeOversized: TARGET.oversized, teeRegular: TARGET.relaxed }[key];
  const fitKey = { hoodie: 'superOversized', hoodieOversized: 'oversized', teeSuperOversized: 'superOversized', teeOversized: 'oversized', teeRegular: 'relaxed' }[key];
  if (target == null) return null;
  const label = { teeRegular: 'Sahel tee, Relaxed', teeSuperOversized: 'Sahel tee, Super Oversized', teeOversized: 'Sahel tee, Oversized', hoodie: 'Sahel hoodie, Super Oversized', hoodieOversized: 'Sahel hoodie, Oversized' }[key];
  const labelAr = { teeRegular: 'تيشيرت ساحل، ريلاكسد', teeSuperOversized: 'تيشيرت ساحل، سوبر أوفرسايز', teeOversized: 'تيشيرت ساحل، أوفرسايز', hoodie: 'هودي ساحل، سوبر أوفرسايز', hoodieOversized: 'هودي ساحل، أوفرسايز' }[key];
  return { kind: 'garment', id: 'sahel-' + key, label, labelAr, target, fitKey, sahel: key !== 'teeOversized', sizes: garmentRows(d.rows) };   /* the Sahel Oversized is on the Founding Edition Oversized chart, so no 'cut large' note */
}
/* 18 Nov 2026 (Faheem): the Sahel Polo has the Sahel Regular tee sizes */
function sahelPolo() { const x = sahel('teeRegular'); return x ? Object.assign(x, { id: 'sahel-polo', label: 'The Sahel Polo', labelAr: 'بولو ساحل' }) : null; }
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
  if (sk) { const x = sahel(sk); if (x && /polo/i.test(p.kind || '')) Object.assign(x, { id: 'sahel-polo', label: 'The Sahel Polo', labelAr: 'بولو ساحل' }); return x ? { pieces: [x] } : null; }
  const tk = TSZ.keyFor(p);
  if (tk === 'kit') return { pieces: [trail('tee'), trail('short')], kit: true };
  if (tk) return { pieces: [trail(tk)] };
  return null;
}
/* the size guide: every piece, chosen from a list */
function all() {
  return { pieces: [founding('regular'), founding('oversized'), polo(), sahelPolo(), sahel('teeRegular'), sahel('teeOversized'), sahel('teeSuperOversized'), sahel('hoodieOversized'), sahel('hoodie'), trail('tee'), trail('short')].filter(Boolean), choose: true };
}
/* the markup: an anchor the help line opens, and the data the script reads */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
/* 26 Nov 2026 (Size finder 3): the figure wears the piece in its own cloth colour. Founding Edition products carry a hex
   (content/products/*.json colourHex); the Sahel cloths are named (Pantone TCX), so they are looked up here. */
const CLOTH = { 'Jet Set': '#272C2A', 'Estate Blue': '#2A3B57', 'Lagoon': '#0EAAAE', 'Salute': '#282B34', 'Black': '#1C1C1E', 'Demitasse': '#40332B', 'Beige': '#D5BA98' };
const hex = c => (c && /^#[0-9a-f]{6}$/i.test(c)) ? c : (CLOTH[c] || '');
function mount(cfg, opts = {}) {
  if (!cfg || !cfg.pieces || !cfg.pieces.length || cfg.pieces.some(x => !x)) return '';
  const data = Object.assign({}, cfg, opts.handle ? { handle: opts.handle } : {}, hex(opts.color) ? { color: hex(opts.color) } : {});
  return `<div class="sfind" id="size-finder" data-sizefinder${opts.inline ? ' data-inline="1"' : ''} data-sf='${esc(JSON.stringify(data))}'></div>`;
}
/* 18 Nov 2026 (ad-visitor persona audit; Faheem chose "Plain fit guide"): three reference people and the size the size
   finder gives each of them in this piece, as designed, with the finder's own word for the room. Worked out at build time
   by the same script the page runs (assets/sahra-sizefinder.js), so the guide and the finder can never disagree. Plain
   words only: nothing assumes the visitor knows our other charts. No model heights (Faheem, 1 and 18 Nov). */
let FINDER = null;
function finder() {
  if (FINDER) return FINDER;
  const src = fs.readFileSync(path.join(__dirname, 'assets', 'sahra-sizefinder.js'), 'utf8');
  const W = { readyState: 'complete', documentElement: { getAttribute: () => 'en' }, querySelectorAll: () => [], getElementById: () => 1, head: { appendChild() {} }, createElement: () => ({}) };
  const ctx = { window: {}, document: W }; require('vm').runInNewContext(src, ctx);
  FINDER = ctx.window.SBSizeFinder; return FINDER;
}
const PEOPLE = [['m', 172, 68, 'Man, 172 cm, 68 kg'], ['m', 182, 82, 'Man, 182 cm, 82 kg'], ['m', 188, 92, 'Man, 188 cm, 92 kg'], ['w', 160, 55, 'Woman, 160 cm, 55 kg']];
const ROOM = r => r < 4 ? 'close to the body' : r < 10 ? 'a clean, regular fit' : r < 18 ? 'relaxed' : r < 31 ? 'loose and oversized' : 'very roomy';
/* r146 review: a size that is sold out says so, and the smallest size says when it sits roomier than designed */
const STOCKF = (function () { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'stock.json'), 'utf8')).stock || {}; } catch (e) { return {}; } })();
function outOf(handle, z) {
  const st = handle && STOCKF[handle]; if (!st) return false;
  const k = Object.keys(st).filter(x => x.split(' / ').indexOf(z) !== -1); if (!k.length) return false;
  return !k.some(x => st[x]);
}
/* 22 Nov 2026 (Faheem, fit panel: "Fix the fit guide"): the guide said "loose and oversized" under every fit, even Regular,
   and sent all three reference people to a sold-out size on the most-viewed hoodie. Now:
   - each line says how the size sits against THIS fit's design, in the fit's own word ("relaxed, as designed",
     "super oversized, roomier than designed, our smallest size"), so the fits read differently;
   - a sold-out size is never the answer: the nearest size in stock is given, with how it sits, and the sold-out size named;
   - a fourth reference person, 188 cm, 92 kg, for tall men and gift buyers;
   - on Sahel pieces, one line under the heading: Sahel is cut larger, so go by the guide, not the letter you usually take. */
const FIT_WORD = { regular: 'regular', relaxed: 'relaxed', oversized: 'oversized', superOversized: 'super oversized' };
function feel(piece, i, room) {
  const w = FIT_WORD[piece.fitKey] || 'as designed', d = room - piece.target, last = piece.sizes.length - 1;
  if (d > 6) return `${w}, roomier than designed${i === 0 ? ', our smallest size' : ''}`;
  if (d < -6) return `${w}, closer than designed${i === last ? ', our largest size' : ''}`;
  return `${w}, as designed`;
}
function glance(cfg, opts = {}) {
  try {
    if (!cfg || !cfg.pieces || cfg.pieces.length !== 1 || cfg.pieces[0].kind !== 'garment') return '';
    const st = opts.handle && STOCKF[opts.handle];
    if (st && Object.keys(st).length && Object.keys(st).every(k => !st[k])) return '';
    const F = finder(), piece = cfg.pieces[0];
    const li = PEOPLE.map(([who, cm, kg, label]) => {
      const body = F.body({ who, cm, kg }), r = F.garment(piece, body, 'designed');
      let i = r.best.i, z = r.best.size, room = r.best.room, note = '';
      if (outOf(opts.handle, z)) {
        /* the nearest size in stock, by how close its room is to the design */
        const alts = piece.sizes.map((row, k) => ({ k, z: row[0], room: row[1] - body.chest })).filter(a => !outOf(opts.handle, a.z))
          .sort((a, b) => Math.abs(a.room - piece.target) - Math.abs(b.room - piece.target));
        if (alts.length) { note = ` &middot; ${z} is sold out`; i = alts[0].k; z = alts[0].z; room = alts[0].room; }
        else note = ' &middot; sold out';
      }
      return `<li><span>${label}</span> <b data-ar-rule="keep" dir="ltr">${z}</b> <i>${feel(piece, i, room)}${note}</i></li>`;
    }).join('');
    const sahelNote = piece.sahel ? '<p class="ss-gl-n">Sahel is cut large, so go by this guide rather than the size you usually take.</p>' : '';
    return `<div class="ss-glance"><p class="ss-gl-h">Fit guide, as designed</p>${sahelNote}<ul>${li}</ul></div>`;
  } catch (e) { console.log('  ! fit guide: ' + e.message); return ''; }
}
const SCRIPT = '<script src="/assets/sahra-sizefinder.js" defer></script>';

module.exports = { hex, glance, founding, polo, sahel, trail, forFounding, forNewLine, all, mount, SCRIPT, TARGET };
