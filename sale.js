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
sbs-t{display:inline-block;padding:1px 6px;border-radius:3px;background:#7E4114;color:#FAF6EF;font:600 11px/1.5 Jost,system-ui,sans-serif;letter-spacing:.04em;text-transform:none;white-space:nowrap;vertical-align:.1em}
.sbf-off{display:none!important}
.sbf{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;max-width:1180px;margin:18px auto 6px;padding:0 16px;font:500 14px/1.3 Jost,system-ui,sans-serif;color:#2A2016}
.sbf-l{font:400 11px/1 'Space Mono',ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:#7E4114;margin-right:4px}
.sbf-c{min-height:38px;padding:0 15px;border:1px solid rgba(42,32,22,.35);border-radius:999px;background:#FAF6EF;color:#2A2016;font:inherit;cursor:pointer}
.sbf-c:hover{border-color:#7E4114}
.sbf-c[aria-pressed="true"]{background:#2A2016;border-color:#2A2016;color:#FAF6EF}
.sbf-c:focus-visible{outline:2px solid #7E4114;outline-offset:2px}
.sbf-n{flex-basis:100%;text-align:center;font-size:13px;color:#5C4E3C;min-height:1em}
.sbf-shop{margin:0;padding:0;max-width:none;width:100%;font-size:13px;letter-spacing:0;text-transform:none}
.sbf-shop .sbf-c{min-height:34px;padding:0 13px;background:none;color:inherit;border-color:currentColor}
.sbf-shop .sbf-c[aria-pressed="true"]{background:#2A2016;color:#FAF6EF;border-color:#2A2016}
.sbf-shop .sbf-l{color:inherit;opacity:.8}</style>
<script>(function(){var d=document.documentElement,E=${END};function s(){var o=Date.now()<E;try{var m=/[?&]sbsale=([01])/.exec(location.search||'');if(m)o=m[1]==='1';}catch(e){}if(d.getAttribute('data-sale')!==(o?'1':'0')){d.setAttribute('data-sale',o?'1':'0');try{document.dispatchEvent(new CustomEvent('sb:sale',{detail:{on:o}}));}catch(e){}}}
s();window.SB_SALE={end:E,on:function(){return d.getAttribute('data-sale')==='1';}};var n=Date.now();if(n<E&&E-n<864e5)setTimeout(s,E-n+300);})();</script>${RUNTIME()}<!--/sbs:head-->`;
/* 3 Nov 2026 (Faheem: "Wherever prices are mentioned, these should show crossed off till price, discount percent and
   the discounted price"): prices drawn in the browser after the build (the /shop/ sections, its 3D ring and design
   index, anything a script inserts later) get the same three parts as the built pages. A price is decorated when its
   handle is on sale and it reads either the full or the sale price (the /shop/ template reads Shopify's live price,
   which during the sale is the sale price). SB_SALE.pct(handle) gives the discount for the filters (sale-filter in build.js). */
const RUNTIME = () => {
  const P = {}; Object.keys(PRICES).forEach(h => { P[h] = [PRICES[h][0], PRICES[h][1], pct(h)]; });
  return `<script>(function(){var d=document.documentElement,S=window.SB_SALE;if(!S)return;var P=${JSON.stringify(P)};
S.prices=P;S.pct=function(h){return S.on()&&P[h]?P[h][2]:0;};
function f(n){var c=Math.round(n*100);return c%100?(c/100).toFixed(2):String(c/100);}
function txt(t,v,ar){return /\\d/.test(t)?t.replace(/\\d[\\d,]*(\\.\\d+)?/,f(v)):(ar?f(v)+' \u062f\u0631\u0647\u0645\u064b\u0627':'AED '+f(v));}
function deco(){if(!S.on())return;var ar=/^ar/.test(d.getAttribute('lang')||'');
var L=document.querySelectorAll('.sb-price[data-handle]:not(.sbs-now):not(.sbs-was)');
for(var i=0;i<L.length;i++){var el=L[i],h=el.getAttribute('data-handle'),x=P[h];if(!x||(el.closest&&el.closest('.sbs-grp')))continue;
var a=Math.round(parseFloat(el.getAttribute('data-aed'))*100);if(a!==Math.round(x[0]*100)&&a!==Math.round(x[1]*100))continue;
var t=el.textContent,g=document.createElement('sbs-g');g.className='sbs-grp';
var now=el.cloneNode(false);now.className=el.className+' sbs-now sbs1';now.setAttribute('data-aed',f(x[1]));now.textContent=txt(t,x[1],ar);
var tag=document.createElement('sbs-t');tag.className='sbs-tag sbs1';tag.textContent=ar?'\u062e\u0635\u0645 '+x[2]+'%':x[2]+'% off';
el.parentNode.insertBefore(g,el);el.className+=' sbs-was';el.setAttribute('data-sbsp','');el.setAttribute('data-aed',f(x[0]));el.textContent=txt(t,x[0],ar);
g.appendChild(now);g.appendChild(document.createTextNode(' '));g.appendChild(el);g.appendChild(document.createTextNode(' '));g.appendChild(tag);}}
S.deco=deco;
/* 3 Nov 2026 (Faheem: "there should be a discount filter so users can filter things in accordance with discount %"):
   on every product list (EN and /ar/), Discount: All, On sale, 10% off, 50% off, 70% off (only the tiers that the page
   has). Cards are hidden with .sbf-off, never [hidden], so it never fights the /shop/ filters, where it is a row in the
   Filter panel. ?discount=on|10|50|70 opens a page filtered. Gone at END with the sale. */
var PG=/^\\/(ar\\/)?(shop|t-shirts|t-shirts\\/regular|t-shirts\\/oversized|polos|hoodies|sahel|new|gifts|under-150|national-day|desert-t-shirts|mountain-t-shirts)\\/?$/,
CARD='.pcard,.nb-c,.po-card,.sp-card,.prow-c,.sh-sc,.prod,.sidx-card',GRID='.prow-g,.pcards,.nb-g,.po-cards,.sp-grid',cur='all',bar=null;
function hOf(c){var e=c.querySelector('.sb-price[data-handle]');return e?e.getAttribute('data-handle'):'';}
function cards(){return [].slice.call(document.querySelectorAll(CARD)).filter(function(c){return !c.closest('.sring')&&c.querySelector('.sb-price[data-handle]');});}
function okc(c){if(cur==='all')return true;var p=S.pct(hOf(c));return cur==='on'?p>0:p===+cur;}
function apply(){var ar=/^ar/.test(d.getAttribute('lang')||''),n=0,all=cards();
all.forEach(function(c){var v=okc(c);c.classList.toggle('sbf-off',!v);});/* 3 Nov 2026: a Sahel fit switch (.sfp) is one design: if the fit on show is filtered out and the other passes, show that one, and count the design once */[].forEach.call(document.querySelectorAll('.sfp'),function(w){var on=w.querySelector(':scope>.pcard.on');if(!on||!on.classList.contains('sbf-off'))return;var alt=w.querySelector(':scope>.pcard:not(.sbf-off)');if(!alt)return;var i=alt.getAttribute('data-i');[].forEach.call(w.children,function(c){if(c.classList.contains('pcard'))c.classList.toggle('on',c===alt);});[].forEach.call(w.querySelectorAll('.sfp-sw button'),function(x){var k=x.getAttribute('data-i')===i;x.classList.toggle('on',k);x.setAttribute('aria-pressed',k?'true':'false');});});all.forEach(function(c){if(!c.classList.contains('sbf-off')&&(!c.closest('.sfp')||c.classList.contains('on')))n++;});
var secs=[];[].forEach.call(document.querySelectorAll(GRID),function(g){var sec=g.closest('section');if(!sec||sec.classList.contains('prod')||(bar&&sec.contains(bar))||!g.querySelector(CARD))return;
var any=[].some.call(g.querySelectorAll(CARD),function(c){return !c.classList.contains('sbf-off');});var k=secs.indexOf(sec);if(k<0){secs.push(sec);secs.push(any);}else if(any)secs[k+1]=true;});
for(var i=0;i<secs.length;i+=2)secs[i].classList.toggle('sbf-off',cur!=='all'&&!secs[i+1]);
if(bar){var m=bar.querySelector('.sbf-n'),tx=cur==='all'?'':(n?(ar?'\u0639\u062f\u062f \u0627\u0644\u0642\u0637\u0639: '+n:n+(n===1?' piece':' pieces')):(ar?'\u0644\u0627 \u0634\u064a\u0621 \u0628\u0647\u0630\u0627 \u0627\u0644\u062e\u0635\u0645 \u0647\u0646\u0627':'Nothing at this discount here'));if(m&&m.textContent!==tx)m.textContent=tx;
[].forEach.call(bar.querySelectorAll('.sbf-c'),function(b){b.setAttribute('aria-pressed',b.getAttribute('data-v')===cur?'true':'false');});}}
function filt(){if(!S.on()||!PG.test(location.pathname))return;var ar=/^ar/.test(d.getAttribute('lang')||''),all=cards();if(!all.length)return;
var tiers={};all.forEach(function(c){var p=S.pct(hOf(c));if(p)tiers[p]=1;});var T=Object.keys(tiers).map(Number).sort(function(a,b){return a-b;});if(!T.length)return;
var panel=document.getElementById('filtPanel'),shop=/\\/shop\\/?$/.test(location.pathname),key=T.join(',');
if(bar&&document.contains(bar)){if(bar.getAttribute('data-t')!==key)paint(ar,T,key);apply();return;}
if(shop&&!panel)return;
bar=document.createElement('div');bar.className='sbf'+(shop?' sbf-shop':'');bar.setAttribute('role','group');bar.setAttribute('aria-label',ar?'\\u0627\\u0644\\u062a\\u0635\\u0641\\u064a\\u0629 \\u062d\\u0633\\u0628 \\u0627\\u0644\\u062e\\u0635\\u0645':'Filter by discount');
paint(ar,T,key);
bar.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.sbf-c');if(!b)return;cur=b.getAttribute('data-v');apply();try{if(window.track)track('sale_filter',{discount:cur});}catch(x){}});
if(shop)panel.appendChild(bar);else{var g=document.querySelector('main '+GRID.split(',').join(',main '))||document.querySelector(GRID);if(!g){bar=null;return;}var sec=g.closest('section');(sec||g).parentNode.insertBefore(bar,sec||g);}
try{var m=/[?&]discount=(on|\\d+)/.exec(location.search||'');if(m&&(m[1]==='on'||tiers[m[1]])){cur=m[1];if(shop&&panel.hidden){var t=document.getElementById('filtToggle');if(t)t.click();}}}catch(x){}
apply();}
function paint(ar,T,key){if(cur!=='all'&&cur!=='on'&&T.indexOf(+cur)<0)cur='all';bar.setAttribute('data-t',key);
var o=[['all',ar?'\\u0627\\u0644\\u0643\\u0644':'All'],['on',ar?'\\u0639\\u0644\\u064a\\u0647\\u0627 \\u062e\\u0635\\u0645':'On sale']].concat(T.map(function(p){return [String(p),ar?'\\u062e\\u0635\\u0645 '+p+'%':p+'% off'];}));
bar.innerHTML='<span class="sbf-l">'+(ar?'\\u0627\\u0644\\u062e\\u0635\\u0645':'Discount')+'</span>'+o.map(function(x){return '<button type="button" class="sbf-c" data-v="'+x[0]+'" aria-pressed="false">'+x[1]+'</button>';}).join('')+'<span class="sbf-n" role="status" aria-live="polite"></span>';}
var q=0;function later(){if(!q)q=requestAnimationFrame(function(){q=0;deco();filt();});}
function boot(){deco();filt();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
document.addEventListener('sb:sale',function(){deco();if(!S.on()&&bar){cur='all';apply();bar.remove();bar=null;}});
try{new MutationObserver(function(m){for(var i=0;i<m.length;i++)if(m[i].addedNodes.length){later();return;}}).observe(d,{childList:true,subtree:true});}catch(e){}})();</script>`;
};

/* 3 Nov 2026 (Faheem: prices in sentences "Rewrite with sale prices"): during the sale, each sentence below that
   quotes a sale product's price shows the sale price, the full price struck and the % off. The original text stays in
   the page beside it (shown again by the browser at END, put back by strip() at the next build). Text between tags
   only, never attributes, scripts or JSON-LD. [original, sale version]; $ and A give the English and Arabic price. */
const $ = h => `AED ${fmt(PRICES[h][1])} <s class="sbs-s">AED ${fmt(PRICES[h][0])}</s> <sbs-t class="sbs-tag">${pct(h)}% off</sbs-t>`;
const A = h => `${fmt(PRICES[h][1])} درهمًا <s class="sbs-s">${fmt(PRICES[h][0])} درهمًا</s> <sbs-t class="sbs-tag">خصم ${pct(h)}%</sbs-t>`;
const FE = 'al-quaa-galaxy-regular', SH = 'khor-fakkan-bay-tee-regular', SM = 'shams-tee-regular', SP = 'sand-polo', SX = 'the-sahel-polo', HD = 'barr-and-bahr-hoodie', HJ = 'hajar-mountains-regular';
const PROSE = () => [
  ['From AED 199 &middot; 230gsm cotton', `From ${$(FE)} &middot; 230gsm cotton`],
  ['AED 199 each, in Regular or Oversized.', `${$(FE)} each, in Regular or Oversized.`],
  ['the Shams Tee and the Sahra Trail Tee AED 139, the other tees AED 199, the polos and hoodies AED 229,',
    `the Shams Tee ${$(SM)}, the Sahra Trail Tee AED 139, the Founding Edition tees ${$(FE)}, the other Sahel tees ${$(SH)}, the Sahra Polo ${$(SP)}, the Sahel Polo and the hoodies ${$(SX)},`],
  ['The tees are AED 199, apart from the Shams Tee at AED 139. The polos and hoodies are AED 229',
    `The Founding Edition tees are ${$(FE)}, the Sahel tees ${$(SH)} and the Shams Tee ${$(SM)}. The Sahra Polo is ${$(SP)}, the Sahel Polo and the hoodies ${$(SX)}`],
  ['each AED 229 in sizes S to XL.', `each ${$(HD)} in sizes S to XL.`],
  ['Both are AED 229, in sizes S to XL.', `Both are ${$(HD)}, in sizes S to XL.`],
  ['AED 199, in Regular or Oversized. In the UAE', `${$(HJ)}, in Regular or Oversized. In the UAE`],
  ['sizes S to XL: AED 199, or AED 139 for the Shams Tee.', `sizes S to XL: ${$(FE)} for the Founding Edition, ${$(SH)} for the Sahel tees, or ${$(SM)} for the Shams Tee.`],
  ['The Founding Edition tees are AED 199. The Sahel tees are AED 199, the Shams Tee AED 139, the polos and hoodies AED 229 and',
    `The Founding Edition tees are ${$(FE)}. The Sahel tees are ${$(SH)}, the Shams Tee ${$(SM)}, the Sahra Polo ${$(SP)}, the Sahel Polo and the hoodies ${$(SX)} and`],
  ['The Founding Edition tees are AED 199 in Regular or Oversized', `The Founding Edition tees are ${$(FE)} in Regular or Oversized`],
  ['the Sahel tees are AED 199 and the Shams Tee AED 139.', `the Sahel tees are ${$(SH)} and the Shams Tee ${$(SM)}.`],
  ['both in sizes S to XL, both AED 229.', `both in sizes S to XL: the Sahra Polo ${$(SP)} and the Sahel Polo ${$(SX)}.`],
  ['on the left chest, AED 229.', `on the left chest, ${$(SX)}.`],
  ['Sahel in Regular and Super Oversized, from AED 139,', `Sahel in Regular and Super Oversized, from ${$(FE)},`],
  /* Arabic */
  ['ابتداءً من 199 درهمًا &middot;', `ابتداءً من ${A(FE)} &middot;`],
  ['199 درهمًا للتيشيرت، بقصّة', `${A(FE)} للتيشيرت، بقصّة`],
  ['وتيشيرت شمس وتيشيرت صحراء تريل بـ139 درهمًا، وبقية التيشيرتات بـ199 درهمًا، والبولو والهوديات بـ229 درهمًا،',
    `وتيشيرت شمس بـ${A(SM)}، وتيشيرت صحراء تريل بـ139 درهمًا، وتيشيرتات الإصدار التأسيسي بـ${A(FE)}، وبقية تيشيرتات ساحل بـ${A(SH)}، وبولو صحراء بـ${A(SP)}، وبولو ساحل والهوديات بـ${A(SX)}،`],
  ['التيشيرتات بـ199 درهمًا، عدا تيشيرت شمس بـ139 درهمًا. البولو والهوديات بـ229 درهمًا،',
    `تيشيرتات الإصدار التأسيسي بـ${A(FE)}، وتيشيرتات ساحل بـ${A(SH)}، وتيشيرت شمس بـ${A(SM)}. بولو صحراء بـ${A(SP)}، وبولو ساحل والهوديات بـ${A(SX)}،`],
  ['سعر كل منهما 229 درهمًا بمقاسات', `سعر كل منهما ${A(HD)} بمقاسات`],
  ['كلاهما بـ229 درهمًا، بمقاسات', `كلاهما بـ${A(HD)}، بمقاسات`],
  ['199 درهمًا، بقصّة ريجولر أو أوفرسايز. في الإمارات', `${A(HJ)}، بقصّة ريجولر أو أوفرسايز. في الإمارات`],
  ['بمقاسات من S إلى XL: 199 درهمًا، أو 139 درهمًا لتيشيرت شمس.', `بمقاسات من S إلى XL: ${A(FE)} للإصدار التأسيسي، و${A(SH)} لتيشيرتات ساحل، أو ${A(SM)} لتيشيرت شمس.`],
  ['تيشيرتات الإصدار التأسيسي بـ199 درهمًا. تيشيرتات ساحل بـ199 درهمًا، وتيشيرت شمس بـ139 درهمًا، والبولو والهوديات بـ229 درهمًا،',
    `تيشيرتات الإصدار التأسيسي بـ${A(FE)}. تيشيرتات ساحل بـ${A(SH)}، وتيشيرت شمس بـ${A(SM)}، وبولو صحراء بـ${A(SP)}، وبولو ساحل والهوديات بـ${A(SX)}،`],
  ['تيشيرتات الإصدار التأسيسي بـ199 درهمًا بقصّة ريجولر', `تيشيرتات الإصدار التأسيسي بـ${A(FE)} بقصّة ريجولر`],
  ['وتيشيرتات ساحل بـ199 درهمًا وتيشيرت شمس بـ139 درهمًا.', `وتيشيرتات ساحل بـ${A(SH)} وتيشيرت شمس بـ${A(SM)}.`],
  ['، وكلاهما بـ229 درهمًا.', `: بولو صحراء بـ${A(SP)}، وبولو ساحل بـ${A(SX)}.`],
  ['بسعر 229 درهمًا. متوفر', `بسعر ${A(SX)}. متوفر`],
  ['من 139 درهمًا، مع توصيل', `من ${A(FE)}، مع توصيل`]
];
const proseSwap = (orig, sale) => `<!--sbs--><span class="sbs1">${sale}</span><span class="sbs0"><!--/sbs-->${orig}<!--sbs--></span><!--/sbs-->`;

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

    /* 3b. prices in sentences (PROSE): text between tags only */
    const PR = PROSE();
    html = outside(x => x.replace(/>([^<]+)</g, (all, t) => {
      let o = t, hit = false;
      PR.forEach(([from, to]) => { if (o.indexOf(from) > -1) { o = o.split(from).join('\u0000' + PR.indexOf(PR.find(z => z[0] === from)) + '\u0001'); hit = true; } });
      if (!hit) return all;
      o = o.replace(/\u0000(\d+)\u0001/g, (m, k) => proseSwap(PR[+k][0], PR[+k][1]));
      return '>' + o + '<';
    }));

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
          if (h && PRICES[h] && fils(x.price) === fils(PRICES[h][0])) { x.price = PRICES[h][1].toFixed(2); x.priceValidUntil = VALID_UNTIL; n++;
            /* 5 Nov 2026: UAE delivery is free from AED 100, AED 15 below, so the UAE rate follows the sale price */
            (Array.isArray(x.shippingDetails) ? x.shippingDetails : []).forEach(sd => { const d = sd && sd.shippingDestination; if (d && d.addressCountry === 'AE' && sd.shippingRate) sd.shippingRate.value = +x.price < 100 ? '15' : '0'; }); }
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
  /* after <meta charset>, so the charset stays inside the first 1024 bytes (3 Nov 2026: the head block grew) */
  html = /<meta charset="[^"]*">/i.test(html.slice(0, 4000)) ? html.replace(/<meta charset="[^"]*">/i, m => m + HEAD()) : html.replace(/<head(\s[^>]*)?>/i, m => m + HEAD());
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
