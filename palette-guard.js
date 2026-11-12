#!/usr/bin/env node
/**
 * palette-guard.js — one brand palette on every page (12 Nov 2026).
 *
 * Faheem, 12 Nov 2026, shown two colour sets side by side: "B" (the website's house-look set), for every surface.
 * MASTER_BRIEF §1 "Brand identity and house look" holds the table. This guard reads the CSS of every built page
 * (style blocks and style attributes) and fails when a colour is used that is not in the palette or on the short
 * list of allowed exceptions below. It runs in prepush.js, so a stray colour cannot ship.
 *
 *   node palette-guard.js            all built pages
 *   node palette-guard.js --list     also print every allowed exception that is in use
 *
 * Adding a colour is a brand decision, not a styling one: change MASTER_BRIEF first, then this file.
 */
'use strict';
const fs = require('fs'); const path = require('path'); const ROOT = __dirname;
const PALETTE = { ink: '2A2016', cream: 'FAF6EF', sand: 'F3DDB8', clay: '7E4114', gold: '8F6212', soft: '4A4136', mute: '6B6256' };
/* For function, not branding. */
const FUNCTIONAL = { white: 'FFFFFF', black: '000000' /* shadows only */, green: '3F6B3A' /* in stock, wadis on the map */, 'trail blue': '4096A0' /* thin rule, tag or map dot only */ };
/* Tints of ink on cream, as solid values: hairlines and quiet panels. */
const TINTS = { line: 'E5E1D9' /* ink 10% on cream */, panel: 'F2EDE6' /* ink 4% on cream */ };
/* Garment colours shown as swatches and photo backdrops (product specs, not brand colours), and third-party marks. */
const GARMENT = (() => { const out = new Set(); try { const d = path.join(ROOT, 'content', 'products');
  fs.readdirSync(d).filter(f => f.endsWith('.json')).forEach(f => { const j = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); if (j.colourHex) out.add(String(j.colourHex).replace('#', '').toUpperCase()); }); } catch (e) {} return out; })();
const MARKS = new Set(['EB001B', 'F79E1B', 'FF5F00', '1A1F71', '25D366', '128C7E', '3BFFC1']);   /* Mastercard, Visa, WhatsApp, Tabby */
/* The 11.11 sale display (sale.js) keeps its own bar until the sale ends on 15 Nov 2026; then delete this line. */
const SALE = new Set(['5C4E3C']);
/* Pages that are not linked and not indexed: the old homepage kept for reference. */
const SKIP_PAGE = /^(classic\/|homepage-preview\.html|coming-soon\.html|shop-preview\.html)/;

const OK = new Set([...Object.values(PALETTE), ...Object.values(FUNCTIONAL), ...Object.values(TINTS), ...GARMENT, ...MARKS, ...SALE]);
function pages() { const out = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  if (['node_modules', '.git', 'admin', '.vercel', '_backup', '_drafts', 'content', 'tools', 'uploads', 'assets', 'shirts', 'print-files'].includes(e.name)) continue;
  const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (e.name === 'index.html') out.push(f); } })(ROOT); return out; }
const HEX = /(?<![&\w])#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g;
const RGB = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g;
function scan() {
  const off = new Map(), used = new Set();
  for (const f of pages()) { const rel = path.relative(ROOT, f); if (SKIP_PAGE.test(rel)) continue;
    const html = fs.readFileSync(f, 'utf8'); let css = '';
    html.replace(/<style[^>]*>([\s\S]*?)<\/style>/g, (m, c) => { css += c + '\n'; return m; });
    html.replace(/\sstyle="([^"]*)"/g, (m, c) => { css += c + '\n'; return m; });
    const note = h => { if (OK.has(h)) { used.add(h); return; } if (!off.has(h)) off.set(h, new Set()); off.get(h).add(rel); };
    let m; HEX.lastIndex = 0; while ((m = HEX.exec(css))) { let h = m[1]; if (h.length === 3) h = h.split('').map(c => c + c).join(''); note(h.slice(0, 6).toUpperCase()); }
    RGB.lastIndex = 0; while ((m = RGB.exec(css))) { const v = [m[1], m[2], m[3]].map(Number); if (Math.max(...v) > 255) continue; note(v.map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase()); }
  }
  /* the shared stylesheets (bag, menu, product page, welcome) are files, not inline CSS */
  try { for (const f of fs.readdirSync(path.join(ROOT, 'assets')).filter(f => f.endsWith('.css'))) { const css = fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8'); const rel = 'assets/' + f;
    const note = h => { if (OK.has(h)) { used.add(h); return; } if (!off.has(h)) off.set(h, new Set()); off.get(h).add(rel); };
    let m; HEX.lastIndex = 0; while ((m = HEX.exec(css))) { let h = m[1]; if (h.length === 3) h = h.split('').map(c => c + c).join(''); note(h.slice(0, 6).toUpperCase()); }
    RGB.lastIndex = 0; while ((m = RGB.exec(css))) { const v = [m[1], m[2], m[3]].map(Number); if (Math.max(...v) > 255) continue; note(v.map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase()); } } } catch (e) {}
  return { off, used };
}
if (require.main === module) {
  const { off, used } = scan();
  if (process.argv.includes('--list')) console.log('in use and allowed: ' + [...used].sort().map(h => '#' + h).join(' '));
  if (!off.size) { console.log('palette-guard: every colour on every page is in the brand palette or an allowed exception.'); process.exit(0); }
  console.log(`palette-guard: ${off.size} colour(s) outside the brand palette`);
  [...off.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 40).forEach(([h, s]) => console.log(`  ✗ #${h} on ${s.size} page(s), e.g. ${[...s].slice(0, 2).join(', ')}`));
  console.log('  The palette is in MASTER_BRIEF §1 "Brand identity and house look". Use a palette value, or a tint of ink.');
  process.exit(1);
}
module.exports = { PALETTE, FUNCTIONAL, TINTS, scan };
