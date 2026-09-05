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
`;

module.exports = { CSS };
