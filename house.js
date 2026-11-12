/* ------------------------------------------------------------------------
   THE HOUSE LOOK for listing pages (Stage 3, 10 Nov 2026).
   Faheem, 10 Nov audit: "one house look on every landing page"; then "Execute stage 3".
   The scorecard put listing pages at 5.4 of 10 and visual identity at 6.4: every page opened differently, the
   desktop card ran to 750px of spec chips, products sat in a narrow panel over a purple sky, and pages used 20 or
   more text sizes. This one stylesheet is the last word on a listing page (body.ls-page): it comes after the
   base CSS and the legibility layer, and sets
     - the ground: plain cream, no living sky behind products;
     - the layout: products in a 1240px grid, reading text at 820px;
     - one product card at every width (the phone card: photo, name, rating, price, Quick add; the place line
       joins from 700px);
     - one section head (kicker, heading, one line);
     - seven text sizes and eight text colours, named below.
   The opener is in heroes.js (house()); its photos are in content/openers.json.
   ------------------------------------------------------------------------ */
const CSS = `<style id="house">
body.ls-page{
  /* seven sizes */
  --h-label:11px;   /* mono kickers and tags */
  --h-small:13px;   /* ratings, stock lines, notes, was-prices */
  --h-body:15px;    /* text, chips, buttons */
  --h-lead:17px;    /* card names, prices, first lines */
  --h-h3:22px;      /* small heads */
  --h-h2:clamp(24px,2.3vw,30px);   /* section heads */
  /* the seventh is the opener title (heroes.js) */
  /* eight text colours */
  --h-ink:#2A2016;--h-soft:#4A4136;--h-mute:#6B6256;--h-clay:#7E4114;--h-green:#3F6B3A;--h-gold:#8F6212;--h-cream:#FAF6EF;--h-sand:#F3DDB8;
  --h-line:rgba(42,32,22,.14)}
body.ls-page{background:#FAF6EF}
body.ls-page::before,body.ls-page::after,body.ls-page #sb-sky{display:none!important}

/* layout: products wide, reading text narrow */
html body.ls-page main{display:block;max-width:1240px;margin:0 auto;padding:14px 16px 48px;background:none;border-radius:0;box-shadow:none}
html body.ls-page main>*{max-width:820px;margin-inline:auto}
html body.ls-page main>.pcta,html body.ls-page main>.nb,html body.ls-page main>.prow,html body.ls-page main>.sbf,html body.ls-page main>.news,html body.ls-page main>.sx-bar{max-width:none}
html body.ls-page main>.sx-main{max-width:1240px}
html body.ls-page.shop-page main.sx-wrap{max-width:none;padding:0}

/* one section head */
html body.ls-page .pcta,html body.ls-page .nb{margin:0;padding:22px 0 6px;background:none;border:0;border-radius:0;box-shadow:none}
html body.ls-page .pcta-head{display:block;margin:0 0 4px}
html body.ls-page .pcta-eyebrow,html body.ls-page .nb-k{display:block;margin:0 0 6px;font:400 var(--h-label)/1.5 'Space Mono',ui-monospace,monospace!important;letter-spacing:.2em!important;text-transform:uppercase;color:var(--h-clay)}
html body.ls-page .pcta-head h2,html body.ls-page .nb>h2,html body.ls-page .prow-h,html body.ls-page main>h2,html body.ls-page .faq h2,html body.ls-page .places-h{margin:0 0 8px;font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-weight:500;font-size:var(--h-h2)!important;line-height:1.15!important;letter-spacing:.1px;color:var(--h-ink);text-wrap:balance}
html body.ls-page .nb-l,html body.ls-page .pcta-lede{margin:0 0 4px;max-width:70ch;font:400 var(--h-body)/1.6 Jost,system-ui,sans-serif!important;color:var(--h-soft)}
html body.ls-page .nb-l a,html body.ls-page .content a,html body.ls-page .sx-note a{color:var(--h-clay)}
html body.ls-page .nb-a,html body.ls-page .back a{display:inline-block;margin:14px 0 0;font:500 var(--h-body)/1.4 Jost,system-ui,sans-serif!important;letter-spacing:0!important;text-transform:none!important;color:var(--h-clay);text-decoration:underline;text-underline-offset:3px;border:0}

/* the grid */
html body.ls-page .pcards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:14px 0 8px}
@media(min-width:700px){html body.ls-page .pcards{grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}}
@media(min-width:1000px){html body.ls-page .pcards{grid-template-columns:repeat(4,minmax(0,1fr));gap:22px}}
html body.ls-page .pcards>.pcard:only-child{grid-column:auto;max-width:none;margin-inline:0}

/* one card */
html body.ls-page .pcard{position:relative;display:flex;flex-direction:column;min-width:0;background:#FFFFFF;border:1px solid var(--h-line);border-radius:14px;overflow:hidden;box-shadow:none;transition:box-shadow .25s}
html body.ls-page .sfp>.pcard{display:none}html body.ls-page .sfp>.pcard.on{display:flex}
html body.ls-page .pcard:hover{transform:none;box-shadow:0 10px 26px rgba(42,32,22,.10)}
html body.ls-page .pcard:hover .pcard-img img{transform:none}
html body.ls-page .pcard-b{display:flex;flex-direction:column;flex:1 1 auto;gap:6px;padding:12px 12px 14px}
html body.ls-page .pcard-t{display:block;min-height:2.5em;font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-weight:500;font-size:var(--h-lead)!important;line-height:1.25!important;color:var(--h-ink);text-decoration:none}
html body.ls-page .pcard-t:hover{color:var(--h-clay)}
html body.ls-page .pcard-spec,html body.ls-page .pcard-col,html body.ls-page .pcard-bundle{display:none!important}
html body.ls-page .pcard-place{display:none;font:400 var(--h-label)/1.5 'Space Mono',ui-monospace,monospace!important;letter-spacing:.12em!important;text-transform:uppercase;color:var(--h-mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
html body.ls-page .pcard-rv{display:flex;align-items:center;gap:6px;min-height:0;font-size:var(--h-small)!important}
html body.ls-page .pcard-rv .rv-stars{display:inline;font-size:var(--h-small)!important;letter-spacing:1px;color:var(--h-gold)}
html body.ls-page .pcard-rv-n{font:400 var(--h-small)/1.4 Jost,system-ui,sans-serif!important;color:var(--h-soft)}
html body.ls-page .pcard-st{font:400 var(--h-small)/1.4 Jost,system-ui,sans-serif!important;color:var(--h-green)}
html body.ls-page .pcard-foot{display:flex;flex-direction:column;align-items:stretch;justify-content:flex-end;gap:10px;margin-top:auto;padding-top:10px;border-top:1px solid var(--h-line)}
html body.ls-page .pcard-p,html body.ls-page .pcard-p .sb-price,html body.ls-page .pcard .sb-price{font:600 var(--h-lead)/1.3 Jost,system-ui,sans-serif!important;letter-spacing:.01em!important;color:var(--h-ink);white-space:nowrap}
html body.ls-page .pcard-p .sbs-was{font-weight:400!important;font-size:var(--h-small)!important;color:var(--h-mute)}
html body.ls-page .pcard-p sbs-g{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px}
html body.ls-page .pcard-cta{align-self:flex-start;font:500 var(--h-body)/1.4 Jost,system-ui,sans-serif!important;letter-spacing:0!important;text-transform:none!important;color:var(--h-clay);text-decoration:underline;text-underline-offset:3px;border:0;padding:0}
html body.ls-page .pcard-foot:has(.qa) .pcard-cta{display:none}
html body.ls-page .pcard-foot .qa{flex:none;width:100%}
html body.ls-page .pcard .qa-open{display:block;width:100%;min-height:40px;padding:0 10px;border:1px solid rgba(42,32,22,.45);border-radius:999px;background:#FFFFFF;color:var(--h-ink);font:600 var(--h-small)/1 Jost,system-ui,sans-serif!important;letter-spacing:.06em!important;text-transform:none!important;cursor:pointer}
/* Quick add and its sizes: 40px tap targets, ink on white wherever the card sits */
html body.ls-page .pcard .qa-open{height:40px;min-height:40px!important;font-size:var(--h-small)!important;letter-spacing:.06em!important}
html body.ls-page .pcard .qa-sz,html body.ls-page .pcard .qa-b{height:40px!important;min-height:40px!important;font-size:var(--h-small)!important;color:var(--h-ink)}
html body.ls-page .pcard{color:var(--h-ink)}
html body.ls-page .pcard .qa-open:hover{background:var(--h-ink);color:var(--h-cream);border-color:var(--h-ink)}
html body.ls-page .pcard-img .cut-b{left:8px;bottom:8px;padding:4px 7px;border-radius:4px;background:rgba(250,246,239,.92);color:var(--h-ink);font:400 10px/1.2 'Space Mono',ui-monospace,monospace!important;letter-spacing:.08em!important}
/* the fit switch on the photo: a real tap target */
html body.ls-page .sfp-sw{top:8px;inset-inline-start:8px;padding:3px;gap:2px;max-width:calc(100% - 16px)}
html body.ls-page .sfp-sw button{position:relative;min-height:28px;padding:0 9px;font:500 var(--h-label)/1 Jost,system-ui,sans-serif!important;letter-spacing:.01em!important;text-transform:none!important}
html body.ls-page .sfp-sw button::after{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}
@media(min-width:700px){
  html body.ls-page .pcard-b{gap:7px;padding:14px 16px 16px}
  html body.ls-page .pcard-place{display:block}
  html body.ls-page .sfp-sw button{min-height:30px;padding:0 12px;font-size:12px!important}
}

/* the 11.11 discount row (sale.js; gone with the sale): one quiet scrolling line, its place held from first paint */
html body.ls-page .sbf{flex-wrap:nowrap;justify-content:flex-start;gap:6px;max-width:none;margin:0 -16px 6px;padding:0 16px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
html body.ls-page .sbf::-webkit-scrollbar{display:none}
html body.ls-page .sbf-l{flex:none;font:400 var(--h-label)/1 'Space Mono',ui-monospace,monospace!important;letter-spacing:.12em!important;color:var(--h-clay)}
html body.ls-page .sbf-c{flex:none;min-height:40px;padding:0 13px;font:500 var(--h-small)/1 Jost,system-ui,sans-serif!important;letter-spacing:0!important;text-transform:none!important;background:none;color:var(--h-ink)}
html body.ls-page .sbf-c[aria-pressed="true"]{background:var(--h-ink);color:var(--h-cream)}
html body.ls-page .sbf-n{flex:none;flex-basis:auto;align-self:center;font:400 var(--h-small)/1 Jost,system-ui,sans-serif!important;color:var(--h-mute);padding-inline-start:6px;white-space:nowrap}
html body.ls-page.shop-page .sbf-n{display:none}

/* the one grid of a listing page (houseGrid in build.js), and the line about sizes under it */
html body.ls-page .nb.hg{padding-top:8px}
html body.ls-page .hg-note{max-width:70ch;margin:14px 0 0;font:400 var(--h-small)/1.6 Jost,system-ui,sans-serif;color:var(--h-soft)}
html body.ls-page .hg-note a{color:var(--h-clay);text-underline-offset:3px}
html[data-sale="1"] body.ls-page main:has(.hg-sale):not(:has(.sbf))::before{content:"";display:block;height:46px}

/* reading text under the products */
html body.ls-page .content{padding-top:18px}
html body.ls-page .content p,html body.ls-page .faq p,html body.ls-page .fold .content p{font:400 var(--h-body)/1.7 Jost,system-ui,sans-serif!important;color:var(--h-soft)}

/* every other block on a listing page, brought onto the seven sizes */
html body.ls-page .pcard .pcard-b .pcard-rv .pcard-rv-n,html body.ls-page .pcard .pcard-b .pcard-rv .rv-stars{font-size:var(--h-small)!important}
html body.ls-page .pcard .pcard-img .cut-b{font-size:var(--h-label)!important}
html body.ls-page main h3,html body.ls-page .guide-sec h2,html body.ls-page .fold>summary,html body.ls-page .folds summary{font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-weight:500;font-size:var(--h-h3)!important;line-height:1.2!important;color:var(--h-ink)}
html body.ls-page .faq summary{font:500 var(--h-lead)/1.4 Jost,system-ui,sans-serif!important;color:var(--h-ink)}
html body.ls-page .content li,html body.ls-page .content td,html body.ls-page .content th{font-size:var(--h-body)!important}
html body.ls-page .catnav a b{font:500 var(--h-lead)/1.3 'Cormorant Garamond',Georgia,serif!important;font-size-adjust:.44;color:var(--h-ink)}
html body.ls-page .catnav a span{font:400 var(--h-small)/1.4 Jost,system-ui,sans-serif!important;color:var(--h-mute)}
/* reviews band */
html body.ls-page .rv-band .eyebrow,html body.ls-page .reviews .eyebrow{font:400 var(--h-label)/1.5 'Space Mono',ui-monospace,monospace!important;letter-spacing:.2em!important;color:var(--h-clay)}
html body.ls-page .rv-band .rv-score{font-size:var(--h-h3)!important}
html body.ls-page .rv-band .rv-count,html body.ls-page .rv-band .rv-chip,html body.ls-page .rv-band .rv-more,html body.ls-page .rv-band select,html body.ls-page .rv-band label,html body.ls-page .rv-band .rv-sort span{font-size:var(--h-body)!important}
html body.ls-page .rv-band .rv-text{font-size:var(--h-lead)!important;line-height:1.5!important}
html body.ls-page .rv-band .rv-meta,html body.ls-page .rv-band .rv-card .rv-stars,html body.ls-page .rv-band small,html body.ls-page .rv-band .rv-src{font-size:var(--h-small)!important}
html body.ls-page .rv-band .rv-head .rv-stars{font-size:var(--h-lead)!important}
/* the list block */
html body.ls-page .news h2{font-size:var(--h-h2)!important}
html body.ls-page .news p{font-size:var(--h-lead)!important}
html body.ls-page .news .btn,html body.ls-page .news button,html body.ls-page .news input{font-size:var(--h-body)!important}
html body.ls-page .news .news-eyebrow{font-size:var(--h-label)!important}
</style>`;
/* the grid and the card alone, for a block on a page that is not a listing page (the pieces on /sahel/):
   scoped('body.sahel-page .sh-shop') gives the same card inside that block */
function scoped(sel) {
  const vars = CSS.slice(CSS.indexOf('body.ls-page{'), CSS.indexOf('}', CSS.indexOf('body.ls-page{')) + 1).replace('body.ls-page', sel);
  const a = CSS.indexOf('/* the grid */'), b = CSS.indexOf('/* the 11.11 discount row');
  const more = CSS.slice(CSS.indexOf('html body.ls-page .pcard .pcard-b .pcard-rv .pcard-rv-n'), CSS.indexOf('html body.ls-page main h3'));
  return '<style>' + vars + '\n' + (CSS.slice(a, b) + more).split('html body.ls-page ').join('html ' + sel + ' ') + '</style>';
}
module.exports = { CSS, scoped };
