/* Sahel size charts (27 Oct 2026, Faheem supplied the charts).
   Sahel is cut on its own pattern, larger than the Founding Edition, so it gets its own tables
   everywhere a Sahel piece is sold, and every chart says which line it belongs to.
   Data: content/sahel-sizing.json (S to XL only). No chart yet: the Sahel Polo and Sahra Trail. */
const fs = require('fs');
const path = require('path');

const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'sahel-sizing.json'), 'utf8'));
/* the charts in use (31 Oct 2026): teeOversized is kept in the file but not shown until the re-cut Oversized fit returns */
for (const k of ['teeRegular', 'teeSuperOversized', 'hoodie']) {
  if (!D[k] || !D[k].rows || D[k].rows.length !== 4) throw new Error('FATAL: content/sahel-sizing.json ' + k + ' must have four rows, S to XL.');
  if (D[k].rows.some(r => !/^(S|M|L|XL)$/.test(r[0]))) throw new Error('FATAL: content/sahel-sizing.json ' + k + ': sizes are S, M, L and XL only.');
  if (!D.compare || !D.compare[k]) throw new Error('FATAL: content/sahel-sizing.json compare.' + k + ' is missing.');
}

/* which chart a product uses, or null (the Sahel Polo, Sahra Trail, bags, and the paused Oversized fit, whose
   chart is published when it returns: 31 Oct 2026) */
function keyFor(p) {
  if (!p || p.line !== 'sahel') return null;
  const kind = String(p.kind || '');
  if (/polo/i.test(kind)) return null;
  if (/hoodie/i.test(kind)) return p.fit === 'Super Oversized' || !p.fit ? 'hoodie' : null;
  return p.fit === 'Super Oversized' ? 'teeSuperOversized' : p.fit === 'Regular' || !p.fit ? 'teeRegular' : null;
}

const FSZ = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'sizing.json'), 'utf8'));   /* the Founding Edition chart */
/* 31 Oct 2026 (Faheem: the Founding-to-Super size match). Super Oversized runs about one size bigger than our Founding
   Edition Oversized, so a Founding Oversized size maps one size down, by chest: a match is within half an inch; two
   equally close sizes give the smaller, with the larger "for a roomier fit"; a Founding size with no Super Oversized
   size that close points to the closest Sahel Regular. From the real charts (content/sizing.json, content/sahel-sizing.json). */
function superRows() {
  const sup = D.teeSuperOversized.rows, reg = D.teeRegular.rows;
  return FSZ.oversized.map(([fz, fc]) => {
    const by = rows => rows.slice().sort((a, b) => Math.abs(a[1] - fc) - Math.abs(b[1] - fc) || a[1] - b[1]);
    const best = by(sup)[0], d = Math.abs(best[1] - fc);
    if (d > 0.5) { const r = by(reg)[0]; return { fz, fc, none: true, reg: r }; }
    const tie = sup.find(r => r !== best && Math.abs(r[1] - fc) === d);
    return { fz, fc, best, tie };
  });
}
function foundingToSuper() {
  if (!D.teeSuperOversized || !FSZ.oversized) return '';
  const q = n => `${n}&Prime;`;
  const rows = superRows().map(r => `<tr><th scope="row">${r.fz} <small>${q(r.fc)}</small></th><td>${r.none ? `No close match. The closest is Sahel Regular ${r.reg[0]} <small>${q(r.reg[1])}</small>` : `${r.best[0]} <small>${q(r.best[1])}</small>${r.tie ? `, or ${r.tie[0]} <small>${q(r.tie[1])}</small> for a roomier fit` : ''}`}</td></tr>`).join('');
  return `<div class="po-match"><p class="po-ask">Already wear our Founding Edition Oversized? Super Oversized runs about one size bigger, so go one size down. By chest, measured flat:</p>
  <div class="ssz-wrap"><table class="ssz ssz-match"><caption>Founding Edition Oversized to Sahel Super Oversized</caption><thead><tr><th scope="col">Founding Edition Oversized</th><th scope="col">Sahel Super Oversized</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
const cell = (i, c) => `${i}&Prime;<small>${Number(c).toFixed(1)}&nbsp;cm</small>`;
function table(key) {
  /* measurements down the side, sizes across (as on the supplied charts), so even the six-row hoodie
     chart fits a phone without sideways scrolling */
  const t = D[key];
  const sizes = t.rows.map(r => r[0]);
  return `<div class="ssz-wrap"><table class="ssz">
    <caption>Sahel &middot; ${t.label.replace(/^Sahel /, '')} &middot; measured flat</caption>
    <thead><tr><th scope="col">Measurement</th>${sizes.map(z => `<th scope="col">${z}</th>`).join('')}</tr></thead>
    <tbody>${t.cols.map((c, ci) => `<tr><th scope="row">${c}</th>${t.rows.map(r => `<td>${cell(r[1 + ci * 2], r[2 + ci * 2])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function method(key) {
  const rows = D.method.filter(m => key === 'hoodie' || !/hoodies/.test(m));
  return `<details class="ssz-how"><summary>How these are measured</summary><ul>${rows.map(m => `<li>${m}</li>`).join('')}</ul><p>${D.tolerance}</p></details>`;
}
/* the block for a product page or the size guide */
function block(key, opts = {}) {
  const t = D[key];
  return `${opts.heading ? `<h3 class="ssz-h">${t.label}</h3>` : ''}<p class="ssz-intent">${t.intent}</p>
  ${table(key)}
  <p class="ssz-diff"><strong>Not the Founding Edition chart.</strong> ${D.compare[key]}</p>
  ${method(key)}`;
}
const CSS = `
.ssz-wrap{overflow-x:auto;border:1px solid rgba(42,32,22,.16);border-radius:12px;background:#fff;margin:10px 0 0}
table.ssz{width:100%;border-collapse:collapse;font-family:Jost,system-ui,sans-serif}
table.ssz caption{caption-side:top;text-align:left;font:400 11px/1.4 'Space Mono',ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:#6B6256;padding:10px 12px 4px}
table.ssz th,table.ssz td{padding:10px 8px;text-align:left;font-size:14.5px;border-bottom:1px solid rgba(42,32,22,.12);vertical-align:top;color:#2A2016}
table.ssz thead th{font:500 12.5px/1.3 Jost,system-ui,sans-serif;color:#6B6256}
table.ssz tbody th{font-weight:600;font-size:13.5px;line-height:1.3;padding-left:12px}
table.ssz thead th:first-child{padding-left:12px}
table.ssz tr:last-child th,table.ssz tr:last-child td{border-bottom:0}
table.ssz td small{display:block;font-size:12px;color:#6B6256}
.ssz-intent{font:15px/1.55 Jost,system-ui,sans-serif;color:#4A4136;margin:0}
.ssz-h{font:600 22px/1.2 'Cormorant Garamond',Georgia,serif;margin:22px 0 6px;color:#2A2016}
.ssz-diff{margin:14px 0 0;padding:12px 14px;border-left:3px solid #0FAAAF;background:rgba(15,170,175,.07);border-radius:0 10px 10px 0;font:14.5px/1.55 Jost,system-ui,sans-serif;color:#2A2016;max-width:62ch}
.ssz-how{margin:12px 0 0;font:14px/1.55 Jost,system-ui,sans-serif;color:#4A4136}
.ssz-how summary{cursor:pointer;font-weight:600;color:#2A2016}
.ssz-how ul{margin:8px 0 6px 18px;padding:0}
.ssz-how li{margin-bottom:4px}
table.ssz.ssz-match td small,table.ssz.ssz-match th small{display:inline;font-size:12.5px;font-weight:400}
.po-match .po-ask,.ssz-match-l{font:15px/1.55 Jost,system-ui,sans-serif;margin:0 0 4px}
`;
module.exports = { D, keyFor, table, block, CSS, foundingToSuper, superRows };
