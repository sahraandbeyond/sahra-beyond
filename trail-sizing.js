/* Sahra Trail size charts (10 Nov 2026; Faheem decided to publish the supplier spec now rather than wait for measured
   pieces: claude/HANDOFF-Trail-Tee-and-Short-size-charts-for-website-10-Nov-2026.md).
   Sahra Trail is its own pattern, so it gets its own tables wherever a Trail piece is sold: the Tee page, the Short page,
   the Kit page (a size is chosen for each piece there, so it shows both) and the size guide. Centimetres lead and inches
   follow, as on the supplier chart. The tables reuse the Sahel chart styles (sahel-sizing.js CSS).
   Data: content/trail-sizing.json (S to XL only, customer-facing rows only). The Trailhead Bag is one size: no chart. */
const fs = require('fs');
const path = require('path');

const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'trail-sizing.json'), 'utf8'));
for (const k of ['tee', 'short']) {
  if (!D[k] || !Array.isArray(D[k].rows) || !D[k].rows.length) throw new Error('FATAL: content/trail-sizing.json ' + k + ' has no rows.');
  if (String(D[k].sizes) !== 'S,M,L,XL') throw new Error('FATAL: content/trail-sizing.json ' + k + ': sizes are S, M, L and XL only.');
  if (D[k].rows.some(r => r.length !== 5 || r.slice(1).some(c => !Array.isArray(c) || !(c[0] > 0) || !c[1]))) throw new Error('FATAL: content/trail-sizing.json ' + k + ': every row needs a cm figure and an inch figure for S, M, L and XL.');
}
if (!D.body || D.body.rows.length !== 4) throw new Error('FATAL: content/trail-sizing.json body must have four rows, S to XL.');
/* no fabric weight in customer copy (Decision Log 9 Nov), and no performance claims on Trail */
if (/\bgsm\b|upf|moisture|quick[- ]dry|breathab/i.test(JSON.stringify(D).replace(/"_note":"[^"]*"/, ''))) throw new Error('FATAL: content/trail-sizing.json: no fabric weight or performance claims in the Trail charts.');

const WA = 'https://wa.me/971585449946';
/* which chart a product page shows: 'tee', 'short', 'kit' (both), or null (the Trailhead Bag and everything that is not Trail) */
function keyFor(p) {
  if (!p || p.line !== 'trail' || p.oneSize) return null;
  if (p.kit) return 'kit';
  if (/short/i.test(p.handle || '')) return 'short';
  if (/tee/i.test(p.handle || '')) return 'tee';
  return null;
}
/* a range (91-96) and a fraction (21 1/4) keep their left-to-right order on the Arabic pages, where the cell is right-to-left */
const rng = t => `<bdi dir="ltr">${t}</bdi>`;
const cm = n => (Math.round(n * 10) / 10).toString().replace(/\.0$/, '');
function table(key) {
  const t = D[key];
  return `<div class="ssz-wrap"><table class="ssz ssz-t">
    <caption>${t.label} &middot; the garment, measured flat</caption>
    <thead><tr><th scope="col">Measurement</th>${t.sizes.map(z => `<th scope="col">${z}</th>`).join('')}</tr></thead>
    <tbody>${t.rows.map(r => `<tr><th scope="row">${r[0]}</th>${r.slice(1).map(c => `<td>${cm(c[0])}&nbsp;cm<small dir="ltr">${c[1]}&Prime;</small></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
/* who wears which size: body chest for the tee, body waist for the short, both on the kit page and the size guide */
function body(which) {
  const chest = which !== 'short', waist = which !== 'tee';
  return `<div class="ssz-wrap"><table class="ssz ssz-body">
    <caption>Sahra Trail &middot; your size, by body measurement</caption>
    <thead><tr><th scope="col">Size</th>${chest ? '<th scope="col">Your chest</th>' : ''}${waist ? '<th scope="col">Your waist</th>' : ''}<th scope="col">Height</th></tr></thead>
    <tbody>${D.body.rows.map(r => `<tr><th scope="row">${r[0]}</th>${chest ? `<td>${rng(r[1][0])}&nbsp;cm<small dir="ltr">${r[1][1]}&Prime;</small></td>` : ''}${waist ? `<td>${rng(r[2][0])}&nbsp;cm<small dir="ltr">${r[2][1]}&Prime;</small></td>` : ''}<td>${rng(r[3])}&nbsp;cm</td></tr>`).join('')}</tbody></table></div>
  <p class="ssz-intent ssz-bodyhow">${D.body.how[chest && waist ? 'both' : chest ? 'tee' : 'short']}</p>`;
}
function method(keys) {
  return `<details class="ssz-how"><summary>How these are measured</summary><ul>${keys.map(k => D[k].method.map(m => `<li>${m}</li>`).join('')).join('')}</ul><p>${D.tolerance}</p></details>`;
}
function piece(key, opts = {}) {
  const t = D[key];
  return `${opts.heading ? `<h3 class="ssz-h">${t.label}</h3>` : ''}<p class="ssz-intent">${t.intent}</p>
  ${table(key)}<p class="ssz-intent ssz-note">${t.flat}</p>${t.note ? `<p class="ssz-intent ssz-note">${t.note}</p>` : ''}`;
}
const own = () => `<p class="ssz-diff"><strong>Sahra Trail is its own pattern.</strong> ${D.own}</p>`;
const between = what => `<p class="ssz-intent ssz-note">Between sizes? <a href="${WA}?text=${encodeURIComponent('Hi, a size question about ' + what + ' before I order.')}" target="_blank" rel="noopener">Message us</a>.</p>`;
/* the whole block for a product page ('tee', 'short' or 'kit') or the size guide ('all') */
function block(key) {
  const both = key === 'kit' || key === 'all';
  const keys = both ? ['tee', 'short'] : [key];
  return `${body(both ? 'both' : key)}
  ${keys.map(k => piece(k, { heading: true })).join('')}
  ${own()}
  ${between(key === 'tee' ? 'the Sahra Trail Tee' : key === 'short' ? 'the Sahra Trail 2-in-1 Short' : 'Sahra Trail')}
  ${method(keys)}`;
}
const CSS = `
.ssz-bodyhow,.ssz-note{margin-top:10px;font-size:14.5px}
.ssz-note a,.ssz-bodyhow a{color:#2A2016;text-underline-offset:3px}
table.ssz.ssz-body tbody th{font-size:14.5px}
.ssz-how>p{margin-top:10px}
@media(max-width:520px){table.ssz.ssz-t th,table.ssz.ssz-t td{padding-left:5px;padding-right:5px;font-size:14px}table.ssz.ssz-t tbody th,table.ssz.ssz-t thead th:first-child{padding-left:12px;font-size:13px}table.ssz.ssz-t td small{font-size:11.5px}}
`;
module.exports = { D, keyFor, table, body, block, CSS };
