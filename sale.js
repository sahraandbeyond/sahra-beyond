/* ==========================================================================
   11.11 sale (r99, 3 Nov 2026, Faheem)
   ==========================================================================
   From the push until Sun 15 Nov 2026 23:59 UAE. At END (2026-11-15T20:00:00Z,
   Mon 16 Nov 00:00 UAE; the UAE is UTC+4, no DST) everything goes back to full
   price by itself. Shopify already holds the prices (price = sale price,
   compareAtPrice = full price) and a scheduled job restores Shopify at END.

   Faheem's rules for this sale only: the full price is shown struck through
   beside the sale price everywhere these products are priced (this reverses the
   standing "no strike-through" rule for this sale only), with a small "% off"
   tag. A top-bar line (assets/sahra-welcome.js, same END). "Any 2 tees for
   AED 359" is paused in Shopify, so its wording is hidden for the sale and
   comes back after. No exclamation marks, no countdown, no urgency wording.

   HOW THE SWITCH WORKS (the same idea as preorder-page.js):
   - BUILD time: build.js strips any earlier sale markup from every page at the
     start (strip), and, while now() < END, decorates every built page (EN and
     /ar/) after the Arabic mirror has run (decorate). After END the build adds
     nothing, so the page source holds no sale wording at all.
     .github/workflows/stage-switch.yml redeploys just after END.
   - BROWSER: an inline script in <head> sets html[data-sale="1"|"0"] from the
     visitor's clock and flips it at END, to the second, with no redeploy.
     .sbs1 shows only during the sale, .sbs0 only outside it; .sbs-was is struck
     only during the sale.
   Arabic: the sale's own words (the tag, below) are Arabic here; the top bar has its own Arabic in
   sahra-welcome.js; content/ar-mirror/t11.json holds the Arabic of the English sentences that lose
   their "any two ... AED 359" clause during the sale (PAIR_CUTS), so the parity check in prepush.js passes.
   SB_NOW=2026-11-16T01:00:00Z node build.js builds the after-sale site locally;
   ?sbsale=0|1 previews either state in the browser (nothing is stored).
   Safe to delete, with its hooks, after 16 Nov 2026.
   ========================================================================== */
'use strict';
const END = Date.UTC(2026, 10, 15, 20, 0, 0);   /* Mon 16 Nov 00:00 UAE = Sun 15 Nov 23:59:59 + 1 s */
const VALID_UNTIL = '2026-11-15';
/* Shopify handle: [full price, sale price] in AED. Read back from Shopify on 3 Nov 2026. */
const PRICES = {
  'sand-polo': [229, 68.70],                                      /* 70% off */
  'al-quaa-galaxy-regular': [199, 99.50], 'al-quaa-galaxy-oversized': [199, 99.50],   /* Founding Edition tees, 50% off */
  'empty-quarter-regular': [199, 99.50], 'empty-quarter-oversized': [199, 99.50],
  'hajar-mountains-regular': [199, 99.50], 'hajar-mountains-oversized': [199, 99.50],
  'khor-fakkan-bay-tee-regular': [199, 179.10], 'khor-fakkan-bay-tee-super-oversized': [199, 179.10],   /* Sahel, 10% off */
  'al-hamra-pearl-diver-tee-regular': [199, 179.10], 'al-hamra-pearl-diver-tee-super-oversized': [199, 179.10],
  'al-aqah-reef-tee-regular': [199, 179.10], 'al-aqah-reef-tee-super-oversized': [199, 179.10],
  'shams-tee-regular': [139, 125.10], 'shams-tee-super-oversized': [139, 125.10],
  'the-sahel-polo': [229, 206.10], 'barr-and-bahr-hoodie': [229, 206.10], 'ras-al-khor-hoodie': [229, 206.10]
};
const TEXT = {
  en: { tag: p => `${p}% off` },
  ar: { tag: p => `خصم ${p}%` }
};
/* "Any 2 tees for AED 359" sentences in page copy, meta descriptions and FAQ data (generated pages only),
   removed for the sale. The short sb-aed-only lines are hidden by class instead (decorate, step 2). */
const PAIR_CUTS = [
  '; any two Founding Edition tees AED 359', ' Any two Founding Edition tees AED 359.', ', and any two Founding Edition tees are AED 359',
  ' (any two Founding Edition tees AED 359)', ' Any two Founding Edition tees are AED 359.', ', and any two of them are AED 359',
  '؛ وأي تيشيرتين من الإصدار التأسيسي مقابل 359 درهمًا', ' أي تيشيرتين من الإصدار التأسيسي مقابل 359 درهمًا.', '، وأي تيشيرتين من الإصدار التأسيسي بـ359 درهمًا',
  ' (وأي تيشيرتين من الإصدار التأسيسي بـ359 درهمًا)', ' أي تيشيرتين من الإصدار التأسيسي بـ359 درهمًا.', '، وأي تيشيرتين منها بـ359 درهمًا'
];
/* pages kept by hand (build.js splices into them, it does not rewrite them): only reversible changes there */
const HAND = /^(index\.html|homepage-preview\.html|shop-preview\.html|classic\/index\.html|policies\.html|commitment\.html|coming-soon\.html)$/;

function now() { const s = process.env.SB_NOW; const t = s ? Date.parse(s) : Date.now(); return isNaN(t) ? Date.now() : t; }
function on() { return now() < END; }
const fils = n => Math.round(Number(n) * 100);
const fmt = n => { const f = fils(n); return f % 100 === 0 ? String(f / 100) : (f / 100).toFixed(2); };
const pct = h => Math.round((1 - PRICES[h][1] / PRICES[h][0]) * 100);
/* the price a buyer pays today, for build-time use */
function price(h, full) { return on() && PRICES[h] && fils(PRICES[h][0]) === fils(full) ? PRICES[h][1] : Number(full); }
/* Tabby's quarter, as specimen.js shows it (full) and to the fils for the sale price */
const quarterFull = n => { const v = Math.round(Number(n) * 25) / 100; return v % 1 === 0 ? v.toFixed(0) : v.toFixed(2); };
const quarterSale = n => { const v = Math.round(fils(n) / 4) / 100; return v % 1 === 0 ? v.toFixed(0) : v.toFixed(2); };

const HEAD = () => `<!--sbs:head--><style>html[data-sale="0"] .sbs1,html[data-sale="1"] .sbs0,html:not([data-sale]) .sbs0{display:none!important}
html[data-sale="1"] .sbs-was{text-decoration:line-through;text-decoration-thickness:1px;font-weight:400!important}
sbs-g{display:inline-block;max-width:100%;white-space:normal}
html[data-sale="1"] sbs-g>.sb-price{display:inline!important;white-space:nowrap}
sbs-t{display:inline-block;padding:1px 6px;border-radius:3px;background:#7E4114;color:#FAF6EF;font:600 11px/1.5 Jost,system-ui,sans-serif;letter-spacing:.04em;text-transform:none;white-space:nowrap;vertical-align:.1em}</style>
<script>(function(){var d=document.documentElement,E=${END};function s(){var o=Date.now()<E;try{var m=/[?&]sbsale=([01])/.exec(location.search||'');if(m)o=m[1]==='1';}catch(e){}if(d.getAttribute('data-sale')!==(o?'1':'0')){d.setAttribute('data-sale',o?'1':'0');try{document.dispatchEvent(new CustomEvent('sb:sale',{detail:{on:o}}));}catch(e){}}}
s();window.SB_SALE={end:E,on:function(){return d.getAttribute('data-sale')==='1';}};var n=Date.now();if(n<E&&E-n<864e5)setTimeout(s,E-n+300);})();</script><!--/sbs:head-->`;

/* Remove everything decorate() added. Idempotent; run on every page before the build reads it. */
function strip(html) {
  return String(html)
    .replace(/<!--sbs(:head)?-->[\s\S]*?<!--\/sbs\1-->/g, '')
    .replace(/ sbs-was" data-sbsp/g, '"')
    .replace(/ sbs0" data-sbsp/g, '"')
    .replace(/ data-tabby-price="[0-9.]+" data-tabby-full="([0-9.]+)"/g, ' data-tabby-price="$1"');
}

/* rel: the page's path from the repo root, with forward slashes */
function decorate(html, rel) {
  html = strip(html);
  if (!on()) return html;
  const ar = /^ar\//.test(rel) || /<html[^>]*\blang="ar/i.test(html.slice(0, 600));
  const L = ar ? TEXT.ar : TEXT.en;
  const hand = HAND.test(rel);
  const attr = (a, k) => { const m = new RegExp('\\b' + k + '="([^"]*)"').exec(a); return m ? m[1] : null; };

  /* steps 1 and 2 touch markup only, never the inside of <script> or <style> */
  const outside = fn => html.split(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>)/i).map((part, i) => i % 2 ? part : fn(part)).join('');

  /* 1. every price of a sale product: sale price first, full price struck, then the tag. The wrapper and the tag
     are their own elements (sbs-g, sbs-t), so card rules such as `.ph-c span{aspect-ratio:4/5}` never reach them. */
  html = outside(x => x.replace(/<(span|small)\b([^>]*?)\bclass="([^"]*\bsb-price\b[^"]*)"([^>]*)>([^<]*)<\/\1>/g, (all, tag, a1, cls, a2, txt) => {
    if (/\bsbs-(now|was)\b/.test(cls)) return all;
    const h = attr(a1 + a2, 'data-handle'), aed = attr(a1 + a2, 'data-aed');
    if (!h || !PRICES[h] || aed == null || fils(aed) !== fils(PRICES[h][0])) return all;
    const sale = fmt(PRICES[h][1]);
    const sTxt = /\d/.test(txt) ? txt.replace(/\d+(?:\.\d+)?/, sale) : (ar ? `${sale} درهمًا` : `AED ${sale}`);
    const dir = attr(a1 + a2, 'dir');
    return `<!--sbs--><sbs-g class="sbs-grp"><${tag} class="sb-price sbs-now sbs1" data-handle="${h}" data-aed="${sale}"${dir ? ` dir="${dir}"` : ''}>${sTxt}</${tag}> <!--/sbs-->`
      + `<${tag}${a1}class="${cls} sbs-was" data-sbsp${a2}>${txt}</${tag}>`
      + `<!--sbs--> <sbs-t class="sbs-tag sbs1">${L.tag(pct(h))}</sbs-t></sbs-g><!--/sbs-->`;
  }));

  /* 2. the short "Any 2 tees for AED 359" lines: shown again by the browser at END */
  html = outside(x => x.replace(/<span class="([^"]*\bsb-aed-only\b[^"]*)">([^<]*359[^<]*)<\/span>/g, (all, cls, txt) =>
    /\bsbs0\b/.test(cls) ? all : `<span class="${cls} sbs0" data-sbsp>${txt}</span>`));

  if (!hand) {
    /* 3. the pair sentences in copy, meta descriptions and FAQ data */
    PAIR_CUTS.forEach(c => { html = html.split(c).join(''); });

    /* 4. JSON-LD offers: the sale price, valid until the last day of the sale */
    html = html.replace(/(<script type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g, (all, o, body, c) => {
      if (!/"Offer"/.test(body)) return all;
      let j; try { j = JSON.parse(body); } catch (e) { return all; }
      let n = 0;
      const walk = x => {
        if (Array.isArray(x)) return x.forEach(walk);
        if (!x || typeof x !== 'object') return;
        if (x['@type'] === 'Offer' && x.price != null) {
          const m = /\/products\/([a-z0-9-]+)\//.exec(String(x.url || ''));
          const h = m && m[1];
          if (h && PRICES[h] && fils(x.price) === fils(PRICES[h][0])) { x.price = PRICES[h][1].toFixed(2); x.priceValidUntil = VALID_UNTIL; n++; }
        }
        Object.keys(x).forEach(k => walk(x[k]));
      };
      walk(j);
      return n ? o + (/\n\s/.test(body.trim()) ? JSON.stringify(j, null, 2) : JSON.stringify(j)) + c : all;
    });

    /* 5. product pages: Tabby's 4 payments and the GA4 view_item price follow the sale price */
    const pm = /^(?:ar\/)?products\/([a-z0-9-]+)\/index\.html$/.exec(rel);
    const h = pm && pm[1];
    if (h && PRICES[h]) {
      const [full, saleN] = PRICES[h], qf = quarterFull(full), qs = quarterSale(saleN);
      /* the sale quarter shown, the full quarter kept for the browser's switch at END; strip() undoes both */
      const dual = `<!--sbs--><span class="sbs1">${qs}</span><span class="sbs0"><!--/sbs-->${qf}<!--sbs--></span><!--/sbs-->`;
      html = html.replace(/(<span class="ssb-tb[^"]*">[^<]*?4 × )([0-9.]+)/g, (all, pre, q) => q === qf ? pre + dual : all);
      html = html.replace(/(<div class="sb-tabby sb-tabby-pdp[^"]*") data-tabby-price="([0-9.]+)"([^>]*>[\s\S]*?<\/div>)/, (all, pre, p, rest) =>
        fils(p) !== fils(full) ? all : `${pre} data-tabby-price="${fmt(saleN)}" data-tabby-full="${p}"${rest.split(qf).join(dual)}`);
      html = html.replace(new RegExp(`(track\\('view_item',\\{item_id:'${h}'[^}]*?price:)"${full}"`), (all, pre) =>
        `${pre}(document.documentElement.getAttribute('data-sale')==='1'?"${fmt(saleN)}":"${full}")`);
    }
  }

  /* 6. the switch itself, first thing in <head> */
  html = html.replace(/<head(\s[^>]*)?>/i, m => m + HEAD());
  return html;
}

/* build.js: walk every page. phase 'strip' before anything reads the pages, 'decorate' after the Arabic mirror. */
function walkPages(ROOT, fn) {
  const fs = require('fs'), path = require('path');
  let n = 0;
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (['node_modules', '.git', '_backup', '_drafts', '.vercel', 'assets', 'admin'].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) {
        const src = fs.readFileSync(p, 'utf8'), out = fn(src, path.relative(ROOT, p).split(path.sep).join('/'));
        if (out !== src) { fs.writeFileSync(p, out); n++; }
      }
    }
  })(ROOT);
  return n;
}
function stripAll(ROOT) { return walkPages(ROOT, src => src.indexOf('sbs') === -1 ? src : strip(src)); }
function decorateAll(ROOT) { return walkPages(ROOT, (src, rel) => decorate(src, rel)); }

module.exports = { END, VALID_UNTIL, PRICES, on, now, price, strip, decorate, stripAll, decorateAll, pct };
