/**
 * legibility.js — the site-wide type floor (5 Sep 2026).
 *
 * A customer wrote that the text is "too light and small and not legible".
 * A phone audit of every key page agreed: 9–11px Space Mono labels, 13px
 * secondary copy at #6B6256, 300-weight body text on the shop and product
 * pages, links at 70% opacity on dark, and gold review stars at 3.97:1.
 *
 * Rather than edit hundreds of rules across eight templates (and drift
 * apart again), this one stylesheet is injected by build.js into EVERY page
 * as the last <style> in <head>, so it wins by source order. It sets floors,
 * not a new design: the fonts, the caps-mono labels, the palette all stay -
 * bigger, darker, heavier.
 *
 * Rules of the layer:
 *   - never use opacity to mute text (contrast-guard.js flags it): use colour
 *   - mono labels: 12px minimum, tracking about half of before
 *   - body copy: 16px, weight 400 (no 300 anywhere)
 *   - secondary copy: #4A4136 on cream (7.9:1), not #6B6256 (5.6:1)
 *   - links on dark: 88% cream, not 70%
 *   - prices and buttons: bold and solid
 *   - !important only where a template rule has higher specificity than a
 *     class can reach; keep it to the floors
 *
 * Also carries the fixes the same audit found: the product page's grid
 * column widening to the thumbnail strip on phones (text clipped at the
 * screen edge), the closed mobile menu's shadow dimming the top bar, and
 * the size tables wider than a phone.
 */
'use strict';

const CSS = `
/* ===== legibility layer: floors for size, weight and contrast (5 Sep 2026) ===== */
:root{--txt-soft:#4A4136;--mist:#4A4136}
/* the product pages flip these when the scroll reaches a dark background (body.dark-bg): keep that, brighter */
body.dark-bg{--txt-soft:rgba(244,239,230,.86);--mist:rgba(244,239,230,.86)}
html{-webkit-text-size-adjust:100%}
body{font-size:16px;font-weight:400}
p,li,dd,td,label,figcaption{font-weight:400}
.lede,.sec p,.care li,.hero-c p,.prod .story,.prod-specs li,.sm-sub,.tl-sub,.fe-card p,.ret-item span,.soon p,.mission p,.chero p{font-weight:400}
.prod-specs li{font-size:15px}
.prod .story,.sec p{font-size:16px}

/* secondary copy: darker, and never under 14px */
.pdp-ans-foot,.qual-item span,.card-body span,.tag-invite,.rv-count,.pk-note,.sgnote,.sz-cm,.crumb,.gal-model,.pm-sky{color:var(--txt-soft,#4A4136)}
/* (.crumbs, .hero-ship and .meta sit on dark heroes and keep their cream) */
.crumbs,.crumbs a{color:rgba(255,255,255,.95)!important}
.hero-ship,.meta{color:rgba(247,239,226,.95)}
.pdp-ans-foot,.qual-item span,.tag-invite,.pk-note,.sgnote,.sz-cm,.gal-model{font-size:14px}
.tag-invite a{color:var(--txt-soft,#4A4136)}

/* Space Mono labels stay a brand element - 12px floor, tracking halved, ink or clay rather than mist */
.eyebrow,.j-eyebrow,.card-place,.pcard-place,.pcard-col,.pcard-cta,.crumb,.crumbs,.rv-meta,.prod-limited,.fitchip,.opt-lab,.filt,.snum,.gal-tag,.gal-fit,.gal-hint,.pm-sky,.pk-qty,.pack-grp-title,.teecta-eyebrow,.news-eyebrow,.place-tag,.qa-l,.qa-w,.scroll-cue,.vband-cap,.vband-cap a,.design-card small,.buy-trust,.buy-ghaf,.sb-price,.size-table th,.sg th,.rv-chip,.rv-sort span,.card-tag,.pcard-rv-n,.rv-more{font-size:12px!important;letter-spacing:.09em!important}
.card-tag{font-size:11px!important;font-weight:700}
.eyebrow,.j-eyebrow,.card-place,.pcard-place,.prod-limited,.design-card small{font-weight:700}
.pcard-place,.pm-sky,.rv-meta,.crumb,.gal-model,.rv-sort span{color:var(--txt-soft,#4A4136)}
.buy-ghaf{color:#3F6A36}
.qa-l{color:#7E4114}

/* the shop's "Details & care" summaries (unclassed) */
.prod details summary{font-size:13px;letter-spacing:.06em}
/* the stragglers the audit still found under 12px */
.sb-ship-uae,.sb-ship-gcc,.sb-ship-intl,.note .sb-rot span,.marquee span,.sm-note,.rv-src,.rv-src a,.trust-row div,.paymarks-t,.pcard-spec span,.limited,.spec-strip li,.spec-strip strong,.cw-txt,.cw-txt strong,.cw-txt em,.pdp-sizes-label,.size-guide-link,.pdp-ans-hint,.shipsub,.pmeta a,.pmeta span,.sky-card small,.sz-cap,table.sz th,.rel-place,.teecta-meta span,.pk-note,.card-body em,.meta span,.meta b,.j-place span,.foot-tag,.buy-limited,.pm-gps,.filt-lab,.buy-trust span{font-size:12px!important}
.pk-note,.card-body em,.shipsub{font-size:13px!important}
.sz-out{font-size:11px!important}
.pcard-spec span{color:var(--ink,#2A2016)}

/* dark panels (shop .prod.dark, the location tee band): secondary text in cream, never ink */
.prod.dark .pm-sky,.prod.dark .pcard-rv-n,.prod.dark .rv-meta,.prod.dark .crumb,.prod.dark .pm-gps,.prod.dark .place-meta,.prod.dark .prod-specs li,.prod.dark .story,.prod.dark .pcard-place{color:rgba(247,239,226,.92)!important}
.prod.dark .rv-stars,.prod.dark .pcard-rv .rv-stars{color:#E9B978!important}
.teecta-txt a:not(.btn),.teecta-meta a:not(.btn),.teecta-meta span{color:#E9B978!important}
.teecta-txt .sb-price{color:rgba(247,239,226,.95)!important}

/* top bar and hero delivery line: readable on phones */
.sb-topbar{font-size:12px!important;letter-spacing:.12em!important;padding:9px 12px!important;line-height:1.35}
@media(max-width:560px){.sb-topbar{font-size:11.5px!important;letter-spacing:.08em!important}}

/* footer links: dark footers (home, shop, product pages) at 88% cream, not 70%; the
   guides' cream footer (.ftr) in ink */
.foot-links a,footer:not(.ftr) .links a,footer .foot-links a{color:rgba(247,239,226,.9)!important;font-size:13px!important;letter-spacing:.08em!important}
.foot-copy,footer .foot-copy{color:rgba(247,239,226,.9)!important;font-size:13px}
.ftr{font-size:14px;color:#4A4136}
.ftr .links a{color:#4A4136!important;font-size:13.5px!important}
.m-panel a{font-size:20px}
nav .nav-links a,.hdr-nav a,.nav-links a{font-size:15px;font-weight:500}

/* review band */
/* the review band's own style block sits in the body, after this layer: a body prefix outranks it,
   and the template's body.dark-bg .rv-stars (gold on dark) still outranks this */
body .rv-stars,body .rv-band .rv-stars,body .pcard-rv .rv-stars{color:#8F6212}
body.dark-bg .rv-stars,body.dark-bg .rv-band .rv-stars{color:#E9B978}
body .rv-text{font-size:16px;line-height:1.6}
body .rv-count{font-size:14px}
.rv-meta{font-size:12.5px!important}

/* prices and buttons: the two things a shopper must never squint at */
.card-price,.card-price .sb-price,.pcard-price,.pcard .sb-price{font-size:16px!important;font-weight:700;letter-spacing:.02em!important;color:var(--ink,#2A2016)}
.price,.buy .price,.buy .sb-price{font-size:24px!important;font-weight:700;letter-spacing:.01em!important}
.btn,button.btn,a.btn{font-size:14px;font-weight:600;letter-spacing:.08em}
.pdp-add{font-size:16px;font-weight:700}
/* disabled = outlined, not faded: still readable, still clearly not the filled button */
.pdp-add:disabled{opacity:1;background:transparent;color:#5C5148;border:1.5px dashed #8A7F73;cursor:not-allowed}
body.dark-bg .pdp-add:disabled{color:#E9D9C4;border-color:#9A8F82}
.qa-b{font-size:12.5px;font-weight:700}
.fit-b{font-size:12px;font-weight:700}
.filt{font-weight:700}

/* homepage journey: copy over the plates */
.lede{font-size:17px}
.scroll-cue{color:rgba(247,239,226,.85)!important}
.vband-cap,.vband-cap a{color:rgba(247,239,226,.9)!important}
.j-stats b{font-size:26px}
.j-stats span{font-size:13px}
.design-card p{font-size:15px;color:rgba(247,239,226,.92)}
.qual-item span{font-size:14px}

/* ===== glass panels behind the text that sits on moving imagery (Faheem, 5 Sep) =====
   The homepage's landscapes and the shop's hero change under the copy as you
   scroll; a sheer frosted panel keeps the words on a steady ground. Dark stops
   only - the cream "paper" stops need none. */
#s-hero .col,#s-alquaa .col,#s-liwa .col,#s-naqab .col,#s-news .col{
  background:rgba(16,12,30,.42);-webkit-backdrop-filter:blur(16px) saturate(1.15);backdrop-filter:blur(16px) saturate(1.15);
  border:1px solid rgba(255,255,255,.14);border-radius:22px;padding:30px 32px;box-shadow:0 24px 60px rgba(0,0,0,.28);
  box-sizing:border-box;max-width:660px}
#s-hero .col{max-width:720px}
@media(max-width:760px){#s-hero .col,#s-alquaa .col,#s-liwa .col,#s-naqab .col,#s-news .col{padding:22px 18px;border-radius:18px}}
@supports not (backdrop-filter:blur(1px)){#s-hero .col,#s-alquaa .col,#s-liwa .col,#s-naqab .col,#s-news .col{background:rgba(16,12,30,.72)}}
/* the design card and waitlist box already carry their own glass: flatten them inside the panel */
.stop .col .design-card{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.16);box-shadow:none}
/* the shop hero */
.hero-c{background:rgba(16,12,30,.42);-webkit-backdrop-filter:blur(16px) saturate(1.15);backdrop-filter:blur(16px) saturate(1.15);
  border:1px solid rgba(255,255,255,.14);border-radius:22px;padding:34px 30px!important;box-shadow:0 24px 60px rgba(0,0,0,.28);
  width:fit-content;max-width:min(92vw,780px);margin:0 auto;box-sizing:border-box}
@media(max-width:760px){.hero-c{padding:26px 18px!important;border-radius:18px;max-width:94vw}}
@supports not (backdrop-filter:blur(1px)){.hero-c{background:rgba(16,12,30,.72)}}

/* ===== homepage and shop: one size up (Faheem, 5 Sep: "still seems small") =====
   The two selling pages get a larger scale than the guides: copy 18-19px,
   labels 13px, buttons 14px, card names and prices up a step. */
.stop .lede,#s-hero .lede{font-size:clamp(18px,1.5vw,21px)!important;line-height:1.6}
.design-card p{font-size:16.5px;line-height:1.55}
.design-card b{font-size:28px}
.design-card small,.j-eyebrow,.place-tag,.meta,.meta span,.meta b,.j-place span,.j-stats span,.card-place,.qa-l,.vband-cap,.vband-cap a,.scroll-cue{font-size:13px!important}
.j-btn{font-size:14px!important;font-weight:600}
.design-card .row .sb-price{font-size:15px!important;font-weight:700}
.design-card .go{font-size:13px!important;font-weight:700}
.qa-b{font-size:13.5px;min-width:42px;height:36px}
.fit-b{font-size:13px}
.collection .card-name,.card-name{font-size:21px}
.card-price,.card-price .sb-price{font-size:17px!important}
.qual-item b{font-size:23px}
.qual-item span{font-size:15.5px}
.j-place b{font-size:22px}
.tag-invite{font-size:15px}
.j-stats b{font-size:28px}
.wl-form input,.wl-form button{font-size:16px}
/* shop */
.hero-c p{font-size:19px!important;line-height:1.6}
.hero-c .eyebrow{font-size:13px!important}
.prod .story{font-size:18px!important;line-height:1.7}
.prod-specs li{font-size:16px!important}
.place-meta,.place-meta a,.place-meta span,.pm-sky,.pm-gps,.pcard-rv-n,.prod-limited,.buy-limited,.opt-lab,.filt,.filt-lab,.fitchip,.trust-row div,.marquee span,.paymarks-t{font-size:13px!important}
.prod-occasion{font-size:14.5px!important}
.size{font-size:15px!important}
.fit{font-size:14px!important}
.fitswap,.size-guide-link{font-size:14px!important}
.sm-sub,.storemap p,.sm-note{font-size:17px!important}
.prod .btn,.prod button.btn{font-size:15px}
.shop .card-name{font-size:21px}
@media(max-width:560px){
  .stop .lede,#s-hero .lede{font-size:17.5px!important}
  .hero-c p{font-size:17.5px!important}
  .prod .story{font-size:17px!important}
  .design-card p{font-size:16px}
}

/* ===== bugs the same audit found ===== */
/* product page on phones: the thumbnail strip (6 x 74px + gaps = 494px) set the
   min-content width of the single grid column, so title, price and copy ran
   past the screen edge and were clipped; the strip now wraps and the column
   may shrink */
.pdp>*{min-width:0}
.gal-thumbs{flex-wrap:wrap}
/* the closed mobile menu is translated off-screen but its 50px shadow still fell
   on the top bar and dimmed it; hidden means hidden */
.m-panel:not(.open){visibility:hidden}
.m-panel{transition:transform .38s cubic-bezier(.4,0,.2,1),visibility 0s linear .38s}
.m-panel.open{visibility:visible;transition:transform .38s cubic-bezier(.4,0,.2,1)}
/* the category pages' fit links (build.js .catnav) shipped with no CSS at all, so
   "Regular fit" and "Slim cut" ran together as one line of text */
.catnav{display:grid;gap:10px;margin:18px 0 26px}
@media(min-width:640px){.catnav{grid-template-columns:repeat(3,1fr)}}
.catnav a{display:flex;flex-direction:column;gap:3px;padding:14px 16px;border:1px solid rgba(43,37,32,.16);border-radius:12px;background:#fff;text-decoration:none;color:#2A2016}
.catnav a b{font-family:'Playfair Display',serif;font-size:19px;font-weight:700}
.catnav a span{font-size:14px;color:#4A4136}
/* size tables wider than a phone */
@media(max-width:480px){
  table.sg{min-width:0;font-size:12.5px}
  .size-table,table.sz{min-width:0}
  .size-table td,.size-table th{padding:9px 6px;font-size:13px}
  table.sz td,table.sz th,.sz th{padding:9px 5px;font-size:13px}
  table.sg td,table.sg th{padding:8px 4px}
}

/* ===== shop page: every word one clear step up (Faheem, 5 Sep: "still very
   small. Enhance it for the entire page. Every single word.") The page body
   carries class shop-page; the rules are ordered small → large so the whole
   scale moves together. !important because the earlier floors above use it. */
body.shop-page{font-size:18px}
/* mono labels: 15px, a little less tracking so they still fit */
body.shop-page .eyebrow,body.shop-page .hero-c .eyebrow,body.shop-page .scroll-cue,body.shop-page .marquee span,body.shop-page .filt-lab,body.shop-page .filt,body.shop-page #filtCount,body.shop-page .filt-meta,body.shop-page .filt-clear,body.shop-page .place-meta,body.shop-page .place-meta a,body.shop-page .place-meta span,body.shop-page .pm-gps,body.shop-page .pm-sky,body.shop-page .prod-limited,body.shop-page .fitchip,body.shop-page .pcard-rv-n,body.shop-page .prod-acc summary,body.shop-page .opt-lab,body.shop-page .buy-limited,body.shop-page .buy-trust,body.shop-page .buy-trust span,body.shop-page .buy-ghaf,body.shop-page .read-place,body.shop-page .pdp-link,body.shop-page .prod-spec-strip li,body.shop-page .prod-spec-strip strong,body.shop-page .sw-row span,body.shop-page .sw-row,body.shop-page .qbuy-lab,body.shop-page .size-guide-link,body.shop-page .trust-row div,body.shop-page .paymarks-t,body.shop-page .foot-links a,body.shop-page .foot-soc a,body.shop-page .rv-meta,body.shop-page .rv-chip,body.shop-page .rv-sort span,body.shop-page .rv-sort select,body.shop-page .rv-more,body.shop-page .rv-src,body.shop-page .rv-src a,body.shop-page .size-table th,body.shop-page .wl-msg,body.shop-page .skip-link,body.shop-page .sm-note{font-size:15px!important;letter-spacing:.06em!important;line-height:1.5}
body.shop-page .note,body.shop-page .note span,body.shop-page .sb-rot span,body.shop-page .note-x{font-size:14px!important;letter-spacing:.04em!important}
body.shop-page .foot-copy{font-size:14.5px!important}
body.shop-page .prod-occasion{font-size:17px!important}
body.shop-page .fabric-line,body.shop-page .fbar{font-size:15px!important;letter-spacing:.04em!important}
body.shop-page .fbar-v{letter-spacing:0!important}
body.shop-page .prod-spec-strip li{padding:7px 13px}
body.shop-page .prod-spec-strip{gap:8px 9px;max-width:none}
body.shop-page .buy-trust{gap:10px 18px}
/* prices and small headings */
body.shop-page .sb-price,body.shop-page .prod .price .sb-price,body.shop-page .qbuy .sb-price{font-size:20px!important;letter-spacing:.04em!important}
body.shop-page .rv-score{font-size:22px!important}
body.shop-page .rv-count{font-size:17px!important}
body.shop-page .fe-card h3{font-size:24px!important}
body.shop-page .ret-item strong{font-size:17px!important}
/* reading copy */
body.shop-page .hero-c p{font-size:21px!important;line-height:1.6}
body.shop-page .prod .story{font-size:20px!important;line-height:1.7;max-width:520px}
body.shop-page .place-lead{font-size:18px!important;line-height:1.7;max-width:520px}
body.shop-page .prod-specs li{font-size:17.5px!important;line-height:1.6}
body.shop-page .prod-acc{max-width:520px}
body.shop-page .fitswap{font-size:16.5px!important}
body.shop-page .tl-sub,body.shop-page .sm-sub{font-size:19.5px!important;line-height:1.65}
body.shop-page .tl-note{font-size:15.5px!important}
body.shop-page .fe-card p,body.shop-page .ret-item span,body.shop-page .ret-item div{font-size:17px!important;line-height:1.6}
body.shop-page .size-table td{font-size:17px!important}
body.shop-page .size-table th,body.shop-page .size-table td{padding:14px 14px}
body.shop-page .rv-text{font-size:18px!important;line-height:1.65}
body.shop-page .soon p,body.shop-page .soon-inner p{font-size:19px!important}
/* controls */
body.shop-page .nav-links a{font-size:17px!important}
body.shop-page .size span,body.shop-page .size{font-size:17px!important}
body.shop-page .size{min-width:52px;height:52px}
body.shop-page .prod .btn,body.shop-page .prod button.btn,body.shop-page .qbuy .btn.add,body.shop-page .wl-form button,body.shop-page .wl-form input{font-size:17px!important}
body.shop-page .btn.add{height:56px}
body.shop-page .filt{padding:9px 16px}
body.shop-page .size-tab{font-size:15px!important;height:46px}
body.shop-page .rv-chip{padding:8px 14px}
body.shop-page .fitchip{padding:6px 14px}
body.shop-page .foot-links{gap:10px 22px}
@media(max-width:560px){
  body.shop-page{font-size:17px}
  body.shop-page .hero-c p{font-size:19px!important}
  body.shop-page .prod .story{font-size:18.5px!important}
  body.shop-page .tl-sub,body.shop-page .sm-sub{font-size:18px!important}
  body.shop-page .prod-specs li{font-size:17px!important}
  body.shop-page .eyebrow,body.shop-page .prod-spec-strip li,body.shop-page .prod-spec-strip strong,body.shop-page .place-meta,body.shop-page .place-meta a,body.shop-page .place-meta span,body.shop-page .pm-gps,body.shop-page .pm-sky,body.shop-page .buy-trust span,body.shop-page .trust-row div,body.shop-page .rv-meta,body.shop-page .marquee span,body.shop-page .filt,body.shop-page .filt-lab,body.shop-page .qbuy-lab,body.shop-page .size-guide-link{font-size:14px!important;letter-spacing:.05em!important}
  body.shop-page .note,body.shop-page .note span,body.shop-page .sb-rot span,body.shop-page .note-x{font-size:13.5px!important}
  body.shop-page .size-table th,body.shop-page .size-table td{padding:11px 8px}
  body.shop-page .size-table td{font-size:15.5px!important}
}

/* ===== buying pages: every word one clear step up (Faheem, 10 Sep: "the text
   on the site STILL looks small"). Product pages, T-Shirts, Polos, Gifts, the
   fabric guide and the size guide carry body.buy-page (build-products.js and
   build.js shell()). Same scale as the shop page: 18px copy, 15px mono labels,
   16-17px controls. !important because the floors above use it. */
body.buy-page{font-size:18px}
body.buy-page .crumb,body.buy-page .crumb a,body.buy-page .crumb span,body.buy-page .crumbs,body.buy-page .crumbs a,body.buy-page .eyebrow,body.buy-page .limited,body.buy-page .fabric-line,body.buy-page .spec-strip li,body.buy-page .spec-strip strong,body.buy-page .cw-txt,body.buy-page .cw-txt strong,body.buy-page .occasion,body.buy-page .pdp-sizes-label,body.buy-page .size-guide-link,body.buy-page .buy-ghaf,body.buy-page .buy-trust,body.buy-page .buy-trust span,body.buy-page .pdp-ans-hint,body.buy-page .snum,body.buy-page .pmeta,body.buy-page .pmeta a,body.buy-page .pmeta span,body.buy-page .sky-card small,body.buy-page .sz-cap,body.buy-page table.sz th,body.buy-page .sz-cm,body.buy-page .rv-meta,body.buy-page .rv-src,body.buy-page .rv-src a,body.buy-page .rv-chip,body.buy-page .rv-more,body.buy-page .rv-sort span,body.buy-page .rv-sort select,body.buy-page .foot-links a,body.buy-page .foot-soc a,body.buy-page .gal-model,body.buy-page .gal-tag,body.buy-page .gal-fit,body.buy-page .gal-hint,body.buy-page .rel-place,body.buy-page .bb-sub,body.buy-page .pcard-place,body.buy-page .pcard-col,body.buy-page .pcard-cta,body.buy-page .pcard-spec span,body.buy-page .pcard-rv-n,body.buy-page .folds-eyebrow,body.buy-page .news-eyebrow,body.buy-page .teecta-eyebrow,body.buy-page .shopcta-eyebrow,body.buy-page .teecta-meta span,body.buy-page .fbar,body.buy-page .stock-lab,body.buy-page .stock-note,body.buy-page .pdp-echo,body.buy-page .wl-msg,body.buy-page table.sg thead th,body.buy-page .gsm-key,body.buy-page .guide-sec h3,body.buy-page .shipsub,body.buy-page .card-tag,body.buy-page .sb-curhint,body.buy-page .jkick,body.buy-page .jmeta,body.buy-page .jbyline{font-size:15px!important;letter-spacing:.06em!important;line-height:1.5}
body.buy-page .eyebrow{letter-spacing:.12em!important}
body.buy-page .cw-txt em{font-size:14px!important;letter-spacing:0!important}
/* the stragglers the audit found: nested spans that carry their own 12px floor above */
body.buy-page .pdp-ans-hint span,body.buy-page .rel-price .sb-price,body.buy-page .bb-sub .sb-price,body.buy-page table.sg th,body.buy-page table.sg tbody th,body.buy-page .rv-showall,body.buy-page .vat .sb-ship-uae,body.buy-page .vat .sb-ship-gcc,body.buy-page .vat .sb-ship-intl{font-size:15px!important}
body.buy-page .bb-sub .sb-price{font-size:15px!important}
body.buy-page .note,body.buy-page .note span,body.buy-page .sb-rot span,body.buy-page .note-x{font-size:14px!important;letter-spacing:.04em!important}
body.buy-page .sz-out{font-size:11.5px!important}
body.buy-page .foot-copy,body.buy-page .ftr{font-size:14.5px!important}
body.buy-page .ftr .links a{font-size:15px!important}
body.buy-page .spec-strip li{padding:8px 14px}
body.buy-page .buy-trust{gap:10px 20px}
body.buy-page .fbar-v{letter-spacing:0!important}
/* prices and small headings */
body.buy-page .price,body.buy-page .buy .price,body.buy-page .buy .sb-price{font-size:26px!important}
body.buy-page .rv-score{font-size:22px!important}
body.buy-page .rv-count{font-size:17px!important}
body.buy-page .pcard-p,body.buy-page .pcard-price,body.buy-page .pcard .sb-price{font-size:18px!important}
body.buy-page .pcard-t{font-size:21px}
body.buy-page .item b{font-size:22px}
body.buy-page .rel-name{font-size:22px}
body.buy-page .bb-name{font-size:17px}
body.buy-page .sky-card b{font-size:22px}
body.buy-page .catnav a b{font-size:21px}
body.buy-page .card-body strong{font-size:19px}
body.buy-page .fold summary h2,body.buy-page .guide-sec h2{font-size:22px}
/* reading copy */
body.buy-page .lede,body.buy-page .buy .lede{font-size:19.5px!important;line-height:1.7;max-width:48ch}
body.buy-page .content .lede{font-size:18px!important;line-height:1.6}
body.buy-page .sec p,body.buy-page .place-band p,body.buy-page .sky-card p,body.buy-page .content p,body.buy-page .content li,body.buy-page .guide-sec p,body.buy-page .fold p,body.buy-page .news p,body.buy-page .teecta p,body.buy-page .shopcta p,body.buy-page .book p{font-size:18px!important;line-height:1.7}
body.buy-page .item span{font-size:16.5px!important;line-height:1.65}
body.buy-page .care li{font-size:17.5px!important}
body.buy-page .faq summary{font-size:18px!important}
body.buy-page .faq p,body.buy-page .faq details p{font-size:17px!important;line-height:1.65}
body.buy-page .note-box{font-size:16.5px!important;line-height:1.65}
body.buy-page .sz-note,body.buy-page .sz-method li,body.buy-page .sz-method summary,body.buy-page .sgintent,body.buy-page .sgnote,body.buy-page .sgmethod,body.buy-page .sgmethod li{font-size:16.5px!important;line-height:1.65}
body.buy-page .pdp-ans summary{font-size:17px!important;padding:15px 2px}
body.buy-page .pdp-ans-foot,body.buy-page .fit-warn,body.buy-page .shipcard,body.buy-page .shipcard span{font-size:16px!important;line-height:1.65}
body.buy-page .shipcard b{font-size:16.5px!important}
body.buy-page .vat,body.buy-page .vat span{font-size:14.5px!important}
body.buy-page .rv-text{font-size:18px!important;line-height:1.65}
body.buy-page .rv-title{font-size:17px!important}
body.buy-page .rv-reply{font-size:15.5px!important}
body.buy-page table.sz td,body.buy-page table.sg td,body.buy-page table.sg.gsm td{font-size:17px!important}
body.buy-page table.sz th,body.buy-page table.sz td{padding:13px 12px}
body.buy-page .rel-price{font-size:16px!important}
body.buy-page .wl-band p.wl-lead{font-size:17px!important}
body.buy-page .pdp-msg{font-size:15.5px!important}
body.buy-page .pdp-loading{font-size:15px!important}
body.buy-page .card-body span,body.buy-page .catnav a span,body.buy-page .jblurb,body.buy-page .facts li,body.buy-page .pk-note,body.buy-page .ig-hint{font-size:15.5px!important;line-height:1.6}
body.buy-page .card-body em{font-size:14px!important}
/* controls */
body.buy-page .nav-links a,body.buy-page .hdr-nav a{font-size:17px!important}
body.buy-page .btn,body.buy-page a.btn,body.buy-page button.btn{font-size:16px!important}
body.buy-page .pdp-add{font-size:17px!important;min-height:56px}
body.buy-page .pdp-size{font-size:17px!important;min-width:56px;height:52px}
body.buy-page #buybar .btn{font-size:15px!important}
body.buy-page .gal-thumbs button{width:80px}
body.buy-page .qa-open{font-size:15px!important}
body.buy-page .pack-btn{font-size:15px!important}
@media(max-width:560px){
  body.buy-page{font-size:17px}
  body.buy-page .lede,body.buy-page .buy .lede{font-size:18px!important}
  body.buy-page .sec p,body.buy-page .place-band p,body.buy-page .sky-card p,body.buy-page .content p,body.buy-page .content li,body.buy-page .guide-sec p,body.buy-page .fold p{font-size:17px!important}
  body.buy-page .crumb,body.buy-page .crumb a,body.buy-page .crumb span,body.buy-page .crumbs,body.buy-page .crumbs a,body.buy-page .eyebrow,body.buy-page .limited,body.buy-page .fabric-line,body.buy-page .spec-strip li,body.buy-page .spec-strip strong,body.buy-page .cw-txt,body.buy-page .cw-txt strong,body.buy-page .occasion,body.buy-page .pdp-sizes-label,body.buy-page .size-guide-link,body.buy-page .buy-ghaf,body.buy-page .buy-trust span,body.buy-page .pdp-ans-hint,body.buy-page .snum,body.buy-page .pmeta a,body.buy-page .pmeta span,body.buy-page .rv-meta,body.buy-page .gal-model,body.buy-page .gal-tag,body.buy-page .gal-fit,body.buy-page .gal-hint,body.buy-page .rel-place,body.buy-page .pcard-place,body.buy-page .pcard-col,body.buy-page .pcard-cta,body.buy-page .pcard-spec span,body.buy-page .fbar,body.buy-page table.sz th,body.buy-page table.sg thead th{font-size:14px!important;letter-spacing:.05em!important}
  body.buy-page .price,body.buy-page .buy .price,body.buy-page .buy .sb-price{font-size:24px!important}
  body.buy-page .pdp-ans summary{font-size:16.5px!important}
  body.buy-page .pdp-ans-foot,body.buy-page .fit-warn,body.buy-page .shipcard,body.buy-page .shipcard span{font-size:15.5px!important}
  body.buy-page .item span{font-size:16px!important}
  body.buy-page table.sz td,body.buy-page table.sg td,body.buy-page table.sg.gsm td{font-size:15.5px!important}
  body.buy-page table.sz th,body.buy-page table.sz td{padding:11px 8px}
  body.buy-page .gal-fit{max-width:calc(100% - 20px);white-space:normal}
}
`;

module.exports = { CSS };
