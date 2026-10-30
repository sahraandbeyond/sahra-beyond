/* ==========================================================================
   Sahel · The Coast Edition — /sahel/  (6 Oct 2026, Faheem)
   ==========================================================================
   Faheem's brief: "a sahel page on the site similar to trail ... a page with
   live graphics and an ocean themed scroll journey ending with shadowed
   mockups of all the products of sahel drop", pitched by a marketing
   strategist and a web designer first.

   His calls (6 Oct): the pieces are dark forms; first labelled by type only,
   then, later the same day, with their names under them (still no colours,
   prints, places or prices; seven of them since the hoodie became
   two named products on 5 Oct); NO dates on the page before the reveal
   ("Launching soon", as the teasers say); a top-bar and Shop-menu link like
   Trail; English only for now.

   The journey goes down where Trail goes up: shore, the waterline, reef,
   locals, light, seabed. The pictures are six graded stills from the real
   Snoopy Island footage used in the teasers; the water is drawn live over
   them by assets/sahra-sahel.js. Chapter lines are the teasers' own lines.

   Claims: only what is safe to say. Snoopy Island, Al Aqah, Fujairah's east
   coast, Gulf of Oman. No depths, species, visibility or fees. "A turtle".
   "Designed in the UAE" is the house line (no scarcity wording, 22-23 Oct 2026).

   The wordmark is the hoodie embroidery master's own outlines
   (docs/supplier-specs/hoodie/embroidery), never retyped. The coastline in
   that file is a product detail and is not drawn before the reveal.

   WHAT FLIPS ON 15 OCT (reveal): set STATE = 'reveal'; names, places and prices
   come from content/sahel-pieces.json; add `img` there for each piece
   (the lit mock-ups are NOT in the repo before
   then: anything shipped can be read from the network tab). Add the dates to
   T.joinP / T.ok and the title. WHAT FLIPS ON 29 OCT: href on each piece, the
   CTA becomes "Shop Sahel", "Launching soon" becomes "Now open". */
const fs = require('fs'), path = require('path');

const STATE = 'teaser';   // 'teaser' | 'reveal'
/* Names, places and pins live in content/sahel-pieces.json (Decision Log 5 Oct 2026). In the
   teaser state the name and the type are printed; colour, place and price wait for the reveal. */
const SAHEL = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'sahel-pieces.json'), 'utf8'));
const PIECES = SAHEL.pieces.map(p => ({
  k: p.type, type: p.label, name: p.name, design: p.design.replace(/&/g, '&amp;'),   /* 14 Oct 2026: 'Barr & Bahr' */
  price: p.price ? `AED ${p.price}` : null,
  place: p.placeName, placeSlug: p.placeSlug, inspiredBy: !!p.inspiredBy
}));
for (const p of PIECES) {
  if (/snoopy/i.test(p.name)) throw new Error('Sahel: "Snoopy" must not appear in a garment name (' + p.name + ')');
  if (p.placeSlug && !fs.existsSync(path.join(__dirname, 'content', 'locations', p.placeSlug + '.json'))) throw new Error('Sahel: no place page for pin ' + p.placeSlug);
}
const DIM = { tee: [715, 720], polo: [587, 720], hoodie: [547, 720] };

const T = {
  title: 'Sahel: The Coast Edition | Sahra & Beyond',
  desc: 'Sahel (ساحل) is the Coast Edition from Sahra & Beyond, designed in the UAE and drawn from Fujairah\'s east coast. Pre-order opens Wed 28 Oct.',
  eyebrow: '<span>The Coast Edition</span><i aria-hidden="true"> &middot; </i><span>by Sahra &amp; Beyond</span>',
  h1: 'Beyond the desert, there is a coast',
  kicker: 'Pre-order opens Wed 28 Oct',
  cta: 'Be first to know',
  scroll: 'Scroll to dive',
  hud: 'Al Aqah &middot; Fujairah',
  ch: [
    ['01', 'The Shore', 'Where the sand meets the sea', 'Filmed at Snoopy Island, Al Aqah, on Fujairah&rsquo;s east coast.', 0],
    ['02', 'The Surface', 'The desert is only half the story', 'Cross the waterline. The island above, the reef below.', 1],
    ['03', 'The Reef', 'Below the coast, there is a reef', 'Blue shadows, teal water, warm light on the coral.', 2],
    ['04', 'The Locals', 'Some neighbours were here first', 'A turtle, gliding past. We only borrowed the view.', 3],
    ['05', 'The Light', 'Follow the light to the coast', 'It falls through the water and settles on the seabed.', 4]
  ],
  piecesNum: 'The Seabed',
  piecesH: 'Seven pieces, still in the dark',
  piecesP: 'The Founding Edition came from the desert and the mountains. Sahel is the coast. Designed in the UAE.',
  reveal: 'Revealed soon',
  hint: 'Tap a piece to bring the light',
  /* 22 Oct 2026 (Faheem): the 24-hour head start is withdrawn. The list is told the evening before each release opens. */
  joinH: 'Join the list.',
  joinP: 'We tell you about each release the evening before it opens.',
  size: 'Your size (optional)', sizeAny: 'Not sure yet',
  ph: 'you@email.com', btn: 'Join the list',
  fine: 'You will also hear about new places and drops now and then. Unsubscribe any time.',
  ok: 'You are on the list. We will tell you the evening before it opens.',
  err: 'Please enter a valid email address.',
  back: 'Meanwhile, the Founding Edition is in the shop &rarr;', backHref: '/shop/',
  trail: 'Running kit? Sahra Trail &rarr;', trailHref: '/trail/'
};

module.exports = function buildSahel({ shell, write, SITE }) {
  const L = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'sahel-lockup.json'), 'utf8'));
  /* the wordmark: the embroidery master's own outlines, Latin over Arabic. The coastline in the same
     file is the hoodie's back embroidery, so it stays out of sight until the reveal. */
  const mark = `
<svg class="sh-mark" id="shMark" viewBox="-1 -8.4 37 19.6" role="img" aria-label="Sahel, ساحل">
  <g class="sh-la" fill="#F4ECDF">${L.la.map(d => `<path d="${d}"/>`).join('')}</g>
  <g class="sh-ar" fill="#D9C3A5" transform="translate(11.14,7.7) scale(.62)">${L.ar.map(d => `<path d="${d}"/>`).join('')}</g>
</svg>`;

  const chapters = T.ch.map((c, k) => `
  <section class="sh-ch${k === 3 ? ' sh-ch-low' : ''}" data-plate="${c[4]}" data-stop="${c[1]}" aria-labelledby="shc${k}">
    <div class="sh-rv">
      <p class="sh-num"><span>${c[0]}</span>&mdash; ${c[1]}</p>
      <h2 id="shc${k}">${c[2]}</h2>
      <p class="sh-lede">${c[3]}</p>
    </div>
  </section>`).join('');

  const ST = require('./preorder-page.js');
  const SHOP = ST.products().filter(p => p.line === 'sahel');   /* every product, each fit on its own card (Faheem, 25 Oct 2026) */
  const pieces = PIECES.map((p, i) => {
    const n = String(i + 1).padStart(2, '0'), d = DIM[p.k];
    const reveal = STATE === 'reveal' && p.name;
    /* 6 Oct 2026 (Faheem): the names show under the silhouettes before the reveal. Still no colours,
       prints, places or prices. Tees take the short design name with 'Tee' on the line below. */
    const label = p.design;
    const typed = new RegExp('\\b' + p.type + '\\b', 'i').test(p.design);
    /* 23 Oct 2026 (site review): every piece opens its own product page, which is live from 23 Oct */
    const prod = ST.products().find(x => x.name.replace(/&amp;/g, '&') === p.name);
    const href = prod ? `/products/${prod.handle}/` : (reveal ? (p.href || (p.placeSlug ? `/locations/${p.placeSlug}/` : null)) : null);
    const tag = href ? 'a' : 'button';
    const attrs = href ? ` href="${href}"` : ' type="button"';
    return `<${tag}${attrs} class="sh-piece sh-piece-${p.k}" aria-label="Piece ${n}: ${label}.">
        ${/* 24 Oct 2026 (aesthetic panel): the pieces are live on their product pages, so the grid shows the
             same warm-stone studio mock-up as /new/ and the product pages, on a light panel where the black
             tees read. The dark silhouette stays only as a fallback for a piece with no mock-up. */''}${prod && prod.images && prod.images[0]
          ? `<span class="sh-photo"><img src="/assets/preorder/${prod.images[0].k}-720.webp" width="${prod.images[0].w || 720}" height="${prod.images[0].h || 900}" alt="${prod.images[0].mock ? label.replace(/"/g, '') + ', studio mock-up' : prod.images[0].alt.replace(/"/g, '')}" loading="lazy" decoding="async"${(prod.images[0].h || 900) / (prod.images[0].w || 720) > 1.4 ? ' style="object-fit:contain"' : ''}></span>`
          : `<span class="sh-form" style="--sh-m:url(/assets/sahel/sahel-${p.k}.webp);aspect-ratio:${d[0]}/${d[1]}"><img src="${reveal && p.img ? p.img : `/assets/sahel/sahel-${p.k}.webp`}" width="${d[0]}" height="${d[1]}" alt="" loading="lazy" decoding="async"><i class="sh-ca" aria-hidden="true"></i></span>`}
        ${prod && prod.images && prod.images[0] && !prod.images[0].mock ? '' : `<span class="sh-mock">${T.mock || 'Mock-up'}</span>`}
        <span class="sh-n">${n}</span><b>${label}</b><small>${reveal ? [p.place ? (p.inspiredBy ? 'Inspired by ' : '') + p.place : null, p.price].filter(Boolean).join(' · ') || p.type : (typed ? '' : `${p.type} &middot; `) + ST.inc('st0', '<span class="st0">Pre-order 28 Oct</span>') + ST.inc('st1', '<span class="st1">Pre-order</span>') + '<span class="st2">Out now</span>'}</small>
      </${tag}>`;
  }).join('\n      ');

  const css = `
<style>
body.sahel-page{background:#0B1526;color:#F4ECDF}
body.sahel-page .hdr{background:rgba(11,21,38,.55);border-bottom-color:rgba(217,195,165,.14);color:#F4ECDF}
body.sahel-page .hdr a,body.sahel-page .hdr button,body.sahel-page .brand-sahra,body.sahel-page .brand-beyond{color:#F4ECDF}
body.sahel-page .brand img{filter:brightness(0) invert(.9) sepia(.2)}
body.sahel-page .ftr{position:relative;z-index:2}
#shGL{position:fixed;inset:0;width:100vw;height:100vh;height:100lvh;display:block;z-index:0;background:#0B1526}
.sh-fb{position:fixed;inset:0;z-index:0;background:#0B1526}
.sh-fb i{position:absolute;inset:0;background-size:cover;background-repeat:no-repeat;opacity:0;transition:opacity .25s linear}
.sh-fb i:first-child{opacity:1}
.sh-fb::after{content:"";position:absolute;inset:0;background:#0B1526;opacity:calc(max(0,(var(--sh-deep,0) - .83)*3.4))}
main.sh{position:relative;z-index:1;--sh-deep:0;max-width:none!important;margin:0!important;padding:0!important;background:transparent!important;box-shadow:none!important;border:0!important}
.sh-veil{position:fixed;inset:0;z-index:0;pointer-events:none;background:linear-gradient(180deg,rgba(11,21,38,.42) 0,rgba(11,21,38,0) 26%,rgba(11,21,38,0) 62%,rgba(11,21,38,.5) 100%)}
.sh section{position:relative;z-index:1}
.sh-hero{min-height:100vh;min-height:100svh;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;padding:clamp(118px,17vh,170px) 20px 150px}
.sh-top,.sh-bot{display:flex;flex-direction:column;align-items:center;position:relative;z-index:1}
.sh-hero::after{content:"";position:absolute;left:0;right:0;bottom:0;height:55%;background:linear-gradient(to top,rgba(11,21,38,.55),rgba(11,21,38,0));pointer-events:none}
.sh-eyebrow i{font-style:normal}
.sh-eyebrow{font-family:'Space Mono',monospace;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#F1E2C8;margin:0;opacity:0;animation:shUp .9s .1s forwards;text-shadow:0 1px 14px rgba(11,21,38,.75)}
.sh-mark{width:min(440px,70vw);height:auto;margin:22px 0 18px;overflow:visible;filter:drop-shadow(0 2px 22px rgba(11,21,38,.7))}
.sh-la,.sh-ar{opacity:0}
.sh-mark.go .sh-la{animation:shSurf 1.9s .25s cubic-bezier(.2,.8,.2,1) forwards}
.sh-mark.go .sh-ar{animation:shFade 1.4s 1.25s ease forwards}
@keyframes shSurf{0%{opacity:0;letter-spacing:0;filter:blur(1.2px)}100%{opacity:1;filter:none}}
@keyframes shFade{to{opacity:1}}
@keyframes shUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.sh-hero h1{font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-weight:500;font-size:clamp(30px,4.2vw,56px);line-height:1.08;margin:0;max-width:16em;color:#F4ECDF;text-shadow:0 2px 30px rgba(11,21,38,.75);text-wrap:balance;opacity:0;animation:shUp 1.1s 1.9s forwards}
.sh-kicker{font-family:'Space Mono',monospace;font-size:12.5px;letter-spacing:.2em;text-transform:uppercase;color:#F4ECDF;margin:0 0 20px;opacity:0;animation:shUp .9s 2.3s forwards;text-shadow:0 1px 14px rgba(11,21,38,.8)}
.sh-btn{display:inline-flex;align-items:center;gap:10px;min-height:52px;padding:0 26px;border-radius:999px;background:#D9C3A5;color:#0B1526;font-weight:600;font-size:15px;letter-spacing:.06em;text-transform:uppercase;text-decoration:none;opacity:0;animation:shUp .9s 2.5s forwards;box-shadow:0 10px 40px rgba(11,21,38,.35)}
.sh-btn:hover{background:#F3E4CB}
.sh-btn:focus-visible,.sh-piece:focus-visible,.sh-back:focus-visible{outline:2px solid #A9E0DA;outline-offset:3px}
.sh-cue{z-index:1;position:absolute;bottom:92px;left:50%;transform:translateX(-50%);font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:rgba(244,236,223,.82);opacity:0;animation:shUp .9s 3s forwards;text-shadow:0 1px 12px rgba(11,21,38,.8)}
.sh-cue i{display:block;width:1px;height:38px;margin:10px auto 0;background:linear-gradient(#F4ECDF,transparent);animation:shCue 1.8s 3s infinite}
@keyframes shCue{0%{transform:scaleY(0);transform-origin:top}50%{transform:scaleY(1);transform-origin:top}51%{transform-origin:bottom}100%{transform:scaleY(0);transform-origin:bottom}}
.sh-ch{min-height:125vh;display:flex;align-items:center;padding:0 max(22px,8vw)}
.sh-ch:nth-of-type(even){justify-content:flex-end}
.sh-ch>div{max-width:540px;padding:26px 28px;border-left:1px solid rgba(217,195,165,.45);background:linear-gradient(90deg,rgba(11,21,38,.78),rgba(11,21,38,.6) 70%,rgba(11,21,38,.28));-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.sh-num{font-family:'Space Mono',monospace;font-size:12.5px;letter-spacing:.22em;text-transform:uppercase;color:#C9F0EB;margin:0 0 12px}
.sh-num span{color:#D9C3A5;margin-inline-end:10px}
.sh-ch h2{font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-weight:500;font-size:clamp(34px,4.8vw,62px);line-height:1.04;margin:0 0 14px;color:#F4ECDF;text-shadow:0 2px 24px rgba(11,21,38,.7);text-wrap:balance}
.sh-lede{font-size:18px;line-height:1.6;color:#F1E7D6;margin:0;text-shadow:0 1px 12px rgba(11,21,38,.8)}
.sh-rv{opacity:0;transform:translateY(34px);transition:opacity 1s ease,transform 1.1s cubic-bezier(.2,.8,.2,1)}
.sh-rv.in{opacity:1;transform:none}
.sh-pieces{padding:20vh 20px 8vh;text-align:center;min-height:110vh}
.sh-pieces .sh-num{margin-bottom:10px}
.sh-pieces h2,.sh-join h2{font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-weight:500;font-size:clamp(34px,4.6vw,60px);line-height:1.05;margin:0 0 12px;color:#F4ECDF;text-shadow:0 2px 24px rgba(11,21,38,.7);text-wrap:balance}
.sh-pieces .sh-sub{max-width:34em;margin:0 auto;font-size:17px;line-height:1.6;color:#F1E7D6;text-shadow:0 1px 12px rgba(11,21,38,.8)}
.sh-grid{display:flex;flex-wrap:wrap;justify-content:center;gap:34px 22px;max-width:1040px;margin:54px auto 0;align-items:flex-end}
.sh-grid .sh-piece{width:calc(25% - 17px)}
.sh-piece{appearance:none;-webkit-appearance:none;background:none;border:0;padding:0;margin:0;font:inherit;color:inherit;cursor:pointer;text-align:center;display:flex;flex-direction:column;align-items:center;text-decoration:none;-webkit-tap-highlight-color:transparent}
.sh-form{position:relative;display:block;width:100%;max-width:250px;filter:drop-shadow(0 0 .6px rgba(169,224,218,.95)) drop-shadow(0 0 7px rgba(92,184,178,.28)) drop-shadow(0 26px 30px rgba(3,8,16,.6));transition:filter .6s ease,transform .8s cubic-bezier(.2,.8,.2,1)}
.sh-piece-hoodie .sh-form{max-width:230px}.sh-piece-polo .sh-form{max-width:226px}
.sh-form img{display:block;width:100%;height:100%;filter:brightness(.42) saturate(.3);transition:filter .7s ease}
.sh-ca{position:absolute;inset:0;-webkit-mask:var(--sh-m) center/100% 100% no-repeat;mask:var(--sh-m) center/100% 100% no-repeat;
  background:url(/assets/sahel/sahel-caustic.webp) 0 0/340px 340px;mix-blend-mode:screen;opacity:.09;filter:blur(1.5px);animation:shCa 120s linear infinite;transition:opacity .7s ease}
.sh-piece:nth-child(2n) .sh-ca{animation-duration:150s;animation-direction:reverse;background-size:400px 400px}
.sh-piece:nth-child(3n) .sh-ca{animation-duration:100s;background-size:300px 300px}
@keyframes shCa{to{background-position:1200px 2400px}}
.sh-piece:hover .sh-ca{opacity:.2}
.sh-piece.lit .sh-ca{opacity:.36;filter:blur(1px)}
.sh-piece.lit .sh-form{filter:drop-shadow(0 0 .8px rgba(210,246,242,1)) drop-shadow(0 0 16px rgba(92,184,178,.7)) drop-shadow(0 26px 30px rgba(3,8,16,.6));transform:translateY(-6px)}
.sh-piece.lit .sh-form img{filter:brightness(.78) saturate(.3)}
.sh-mock{display:inline-block;margin-top:12px;padding:3px 8px;border:1px solid rgba(230,211,182,.45);border-radius:999px;font-family:'Space Mono',monospace;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#E6D3B6}   /* 13 Oct 2026 (Faheem): renders say so until the samples are shot */
.sh-n{font-family:'Space Mono',monospace;font-size:12px;letter-spacing:.22em;color:#E6D3B6;margin-top:20px}
.sh-piece b{display:block;font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-size:24px;line-height:1.12;font-weight:600;color:#F4ECDF;margin-top:4px;text-wrap:balance}
.sh-piece small{display:block;font-family:'Space Mono',monospace;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:#C9F0EB;margin-top:5px}
.sh-hint{font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:rgba(244,236,223,.8);margin:40px 0 0}
.sh-join{padding:8vh 20px 16vh;text-align:center}
.sh-join>div{max-width:560px;margin:0 auto;padding:36px 28px;border-radius:20px;background:rgba(11,21,38,.74);border:1px solid rgba(217,195,165,.22);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 30px 80px rgba(3,8,16,.45)}
.sh-join p{color:#F1E7D6;font-size:17px;line-height:1.55;margin:0}
.sh-form-el{display:flex;flex-direction:column;gap:10px;margin:22px 0 12px}
.sh-row{display:flex;gap:10px;align-items:flex-end}
.sh-size{display:flex;flex-direction:column;gap:5px;text-align:left;flex:1}
.sh-size span{font-family:'Space Mono',monospace;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:#D9C3A5}
.sh-size select,.sh-form-el input{min-height:52px;padding:0 16px;border-radius:12px;border:1px solid rgba(217,195,165,.4);font:inherit;font-size:16px;background:#F7F1E6;color:#0B1526;min-width:0}

.sh-form-el button{min-height:52px;padding:0 24px;border-radius:12px;border:0;background:#D9C3A5;color:#0B1526;font-weight:700;font-size:15px;letter-spacing:.04em;cursor:pointer;white-space:nowrap}
.sh-form-el button:hover{background:#F3E4CB}
.sh-join .sh-fine{font-size:13px;color:#D8CCB8}
.sh-join .sh-ok,.sh-join .sh-err{display:none;font-size:16px;margin:14px 0 0}
[data-waitlist-wrap].done .sh-form-el,[data-waitlist-wrap].done .sh-fine{display:none}
[data-waitlist-wrap].done .sh-ok{display:block;color:#A9E0DA;font-weight:600}
[data-waitlist-wrap].err .sh-err{display:block;color:#FFB9A3}
[data-waitlist-wrap].loading button{opacity:.6}
.sh-links{display:flex;flex-wrap:wrap;gap:8px 22px;justify-content:center;margin-top:24px}
.sh-back{color:#F4ECDF;font-weight:600;font-size:15px;text-underline-offset:3px;text-decoration-color:rgba(217,195,165,.6)}
.sh-hud{position:fixed;left:18px;bottom:18px;z-index:3;display:flex;align-items:stretch;gap:8px;pointer-events:none;opacity:0;visibility:hidden;transition:opacity .5s ease,visibility 0s linear .5s}
.sh-go .sh-hud{opacity:1;visibility:visible;transition:opacity .5s ease,visibility 0s}
.sh-go.sh-end .sh-hud{opacity:0;visibility:hidden;transition:opacity .5s ease,visibility 0s linear .5s}
.sh-hud-t{position:relative;padding:10px 14px 14px;border-radius:12px;background:rgba(11,21,38,.56);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(217,195,165,.18);font-family:'Space Mono',monospace;color:#F4ECDF;min-width:150px}
.sh-hud small{display:block;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#A9E0DA}
.sh-hud-t>b{display:block;font-size:15px;font-weight:700;letter-spacing:.04em;margin-top:2px}
.sh-hud i{position:absolute;left:14px;right:14px;bottom:7px;height:2px;background:rgba(217,195,165,.2)}
.sh-hud i b{position:absolute;inset:0;margin:0;background:#D9C3A5;transform-origin:left;transform:scaleX(0)}
.sh-pill{pointer-events:auto;display:inline-flex;align-items:center;padding:0 18px;border-radius:12px;background:#D9C3A5;color:#0B1526;font-weight:700;font-size:13px;letter-spacing:.05em;text-transform:uppercase;text-decoration:none;white-space:nowrap;box-shadow:0 8px 26px rgba(3,8,16,.35)}
.sh-pill:hover{background:#F3E4CB}
.sh-pill:focus-visible{outline:2px solid #A9E0DA;outline-offset:3px}
@media(max-width:700px){
  .sh-hero{padding:clamp(104px,15vh,140px) 18px 104px}
  .sh-ch{min-height:112vh;padding:0 18px;justify-content:flex-start!important}
  .sh-ch>div{padding:20px 18px}
  .sh-ch-low{align-items:flex-end;padding-bottom:17vh}
  .sh-lede{font-size:17px}
  .sh-pieces{padding:16vh 16px 6vh}
  .sh-grid{gap:30px 14px;margin-top:40px}
  .sh-grid .sh-piece{width:calc(50% - 7px)}
  .sh-form{max-width:160px}.sh-piece-hoodie .sh-form{max-width:148px}.sh-piece-polo .sh-form{max-width:146px}
  .sh-piece b{font-size:20px;line-height:1.12;min-height:2.24em;display:flex;align-items:flex-start;justify-content:center;text-wrap:balance}
  .sh-row{flex-direction:column;align-items:stretch}
  .sh-join>div{padding:28px 20px}
  .sh-hud{left:12px;bottom:12px;gap:6px}
  .sh-hud-t{padding:8px 12px 13px;min-width:126px}
  .sh-hud-t>b{font-size:13.5px}
  .sh-pill{font-size:11.5px;padding:0 13px;letter-spacing:.03em}
  .sh-cue{display:none}
  .sh-eyebrow{font-size:11px;letter-spacing:.18em;line-height:1.9}
  .sh-eyebrow span{display:block;white-space:nowrap}.sh-eyebrow i{display:none}
  .sh-hero{padding-bottom:104px}
}
@media(max-height:700px){.sh-hero{padding-top:92px}.sh-mark{width:min(300px,62vw);margin:14px 0 12px}.sh-hero h1{font-size:27px}}
/* 25 Oct 2026 (Faheem): a short intro over the waterline still, then every product on cream cards over the
   reef. The cards are the same component as /new/ (preorder-page.js newCard), so price, stage lines, the
   Mock-up label and the cut badge match the rest of the site. */
.sh-strip{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;width:100%;align-self:stretch;box-sizing:border-box;min-width:0;max-width:980px;margin:0 auto 18px;padding:2px 4px 6px;scrollbar-width:none;text-align:left}
.sh-strip::-webkit-scrollbar{display:none}
.sh-hero .sh-bot{width:100%;max-width:100%;min-width:0}
.sh-sc{flex:0 0 100px;scroll-snap-align:start;color:#F4ECDF;text-decoration:none}
.sh-sc span{display:block;position:relative;aspect-ratio:4/5;border-radius:10px;overflow:hidden;background:#E9E0D3}
.sh-sc img{width:100%;height:100%;object-fit:cover;display:block}
.sh-sc i{position:absolute;left:5px;top:5px;font:400 8.5px/1 'Space Mono',ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;font-style:normal;padding:3px 5px;border-radius:3px;background:rgba(250,246,239,.94);color:#2A2016}
.sh-sc b{display:block;font:500 13px/1.25 Jost,system-ui,sans-serif;margin:6px 0 1px;color:#F4ECDF;text-shadow:0 1px 8px rgba(11,21,38,.6)}
.sh-sc small{display:block;font:12px/1.3 Jost,system-ui,sans-serif;color:#E9B978;text-shadow:0 1px 8px rgba(11,21,38,.6)}
.sh-sc:focus-visible{outline:3px solid #E9B978;outline-offset:3px;border-radius:10px}
@media(min-width:900px){.sh-strip{justify-content:center}.sh-sc{flex-basis:118px}}
.sh-intro{position:relative;z-index:2;min-height:78vh;display:flex;align-items:center;justify-content:center;padding:10vh 20px}
.sh-intro>div{max-width:640px;padding:30px 32px;border-radius:16px;background:rgba(11,21,38,.66);border:1px solid rgba(217,195,165,.22);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);text-align:start}
.sh-intro h2{font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-weight:500;font-size:clamp(34px,4.4vw,56px);line-height:1.05;margin:0 0 14px;color:#F4ECDF;text-wrap:balance}
.sh-intro .sh-num{color:#A9E0DA}
.sh-shop{position:relative;z-index:2;padding:6vh 20px 14vh}
.sh-shop-in{max-width:1180px;margin:0 auto}
.sh-shop h2{font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-weight:500;font-size:clamp(32px,4vw,52px);line-height:1.05;margin:0 0 10px;color:#F4ECDF;text-align:center;text-shadow:0 2px 24px rgba(11,21,38,.7);text-wrap:balance}
.sh-shop-l{max-width:62ch;margin:0 auto 26px;text-align:center;font-size:16px;line-height:1.55;color:#F1E7D6;text-shadow:0 1px 12px rgba(11,21,38,.85)}
.sh-shop-l a{color:#F4ECDF;text-decoration-color:#0FAAAF;text-underline-offset:3px}
.sh-shop-h{max-width:720px;margin:0 auto 26px;padding:22px 26px;border-radius:16px;background:rgba(11,21,38,.66);border:1px solid rgba(217,195,165,.22);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.sh-shop-h .sh-shop-l{margin-bottom:0}
.sh-grid2{display:flex;flex-wrap:wrap;justify-content:center;gap:16px;max-width:1040px;margin:0 auto}
.sh-grid2>.nb-c{width:calc(25% - 12px)}
@media(max-width:1000px){.sh-grid2>.nb-c{width:calc(33.333% - 11px)}}
.sh-shop .nb-c{background:var(--sb-cream,#FAF6EF);border-radius:14px;padding:10px 10px 14px;box-shadow:0 18px 40px rgba(3,8,16,.35);transition:transform .35s cubic-bezier(.2,.8,.2,1)}
.sh-shop .nb-c:hover{transform:translateY(-4px)}
.sh-shop .nb-c b{padding:0 4px}.sh-shop .nb-c small{padding:0 4px}
.sh-shop .nb-c:focus-visible{outline:3px solid #A9E0DA;outline-offset:3px}
@media(max-width:700px){.sh-intro{min-height:70vh;padding:8vh 16px}.sh-intro>div{padding:22px 20px}.sh-shop{padding:4vh 12px 10vh}.sh-grid2{gap:10px}.sh-grid2>.nb-c{width:calc(50% - 5px)}.sh-shop .nb-c{padding:7px 7px 11px;border-radius:12px}}
@media(prefers-reduced-motion:reduce){
  .sh-eyebrow,.sh-kicker,.sh-hero h1,.sh-btn,.sh-cue{animation:none!important;opacity:1!important;transform:none!important}
  .sh-la,.sh-ar{animation:none!important;opacity:1!important;filter:none!important}
  .sh-rv{opacity:1;transform:none;transition:none}
  .sh-ca,.sh-cue i{animation:none}
}
</style>
<noscript><style>#shGL{background:#0B1526 url(/assets/sahel/sahel-shore-m.webp) 50% 50%/cover no-repeat}.sh-rv{opacity:1;transform:none}.sh-eyebrow,.sh-kicker,.sh-hero h1,.sh-btn,.sh-la,.sh-ar{opacity:1;animation:none}.sh-hud,.sh-cue,.sh-hint{display:none}</style></noscript>`;

  const body = `${ST.stageHead()}${ST.NB_CSS()}${css}
<canvas id="shGL" aria-hidden="true"></canvas>
<div class="sh-veil" aria-hidden="true"></div>
<main class="sh" id="sahel">
  <section class="sh-hero" data-plate="0" data-stop="The Shore">
    <div class="sh-top">
      <p class="sh-eyebrow">${T.eyebrow}</p>
      ${mark}
      <h1>${T.h1}</h1>
    </div>
    <div class="sh-bot">
      ${/* 28 Oct 2026 (conversion fixes): the pieces and their prices on the first screen, for visitors arriving from an ad */''}${ST.stageNow() >= 1 ? `<div class="sh-strip" role="list" aria-label="The Sahel pieces">${SHOP.filter((p, i, A) => A.findIndex(x => x.name === p.name) === i).map(p => { const im = p.images[0]; return `<a role="listitem" class="sh-sc" href="/products/${p.handle}/"><span><img src="/assets/preorder/${im.k}-480.webp" width="480" height="${Math.round(480 * (im.h || 900) / (im.w || 720))}" alt="${String(im.alt).replace(/"/g, '&quot;')}${im.mock ? ', studio mock-up' : ''}" loading="eager" decoding="async"${(im.h || 900) / (im.w || 720) > 1.4 ? ' style="object-fit:contain"' : ''}>${im.mock ? '<i>Mock-up</i>' : ''}</span><b>${p.name.replace(/ Tee$| Hoodie$/, '')}</b>${ST.cardPrice(p.price, 'small', false, p.handle)}</a>`; }).join('')}</div>` : ''}
      <p class="sh-kicker">${ST.inc('st0', `<span class="st0">${T.kicker}</span>`)}${ST.inc('st1', '<span class="st1">Pre-order open</span>')}<span class="st2">Out now</span></p>
      ${/* 25 Oct 2026 (Faheem): the page is the collection now; every button goes to the pieces */''}${ST.inc('st0', `<a class="sh-btn st0" href="#pieces">See the pieces <span aria-hidden="true">&darr;</span></a>`)}
      ${ST.inc('st1', `<a class="sh-btn st1" href="#pieces">Pre-order Sahel <span aria-hidden="true">&darr;</span></a>`)}
      <a class="sh-btn st2" href="#pieces">Shop Sahel <span aria-hidden="true">&darr;</span></a>
    </div>
    <div class="sh-cue" aria-hidden="true">${T.scroll}<i></i></div>
  </section>
  ${/* 25 Oct 2026 (Faheem: "A brief intro of the collection and then all the pieces. Background needs to
       remain reef inspired."). The five scroll chapters, the waiting list and the "Be first to know" pill
       are gone. The reef scene stays behind: the intro sits on the waterline still, the pieces on the reef. */''}
  <section class="sh-intro" data-plate="1" data-stop="The Surface" aria-labelledby="shIntro">
    <div class="sh-rv">
      <p class="sh-num">The Coast Edition</p>
      <h2 id="shIntro">Seven designs from the UAE coast</h2>
      <p class="sh-lede">Sahel means the coast. The Founding Edition came from the desert and the mountains; Sahel follows the shoreline: the bay at Khor Fakkan, the pearling town of Al Jazirah Al Hamra, the reef off Al Aqah, the flamingos of Ras Al Khor, and the place where the desert meets the sea. Four tees${Object.keys(require('./specimen.js').PAUSED).length ? ' in Regular (the Oversized fit is being adjusted and will be back soon)' : ' in Regular and Oversized'}, a polo and two hoodies. Designed in the UAE.</p>
    </div>
  </section>
  <section class="sh-shop" id="pieces" data-plate="2" data-stop="The Reef" aria-labelledby="shPieces">
    <div class="sh-shop-in">
      <div class="sh-shop-h"><h2 id="shPieces">${ST.inc('st0', '<span class="st0">All the pieces, on <span style="white-space:nowrap">pre-order</span> from Wed 28 Oct</span>')}${ST.inc('st1', '<span class="st1">All the pieces, on <span style="white-space:nowrap">pre-order</span> now</span>')}<span class="st2">All the pieces</span></h2>
      <p class="sh-shop-l">${ST.newLede()}</p></div>
      <div class="nb-g sh-grid2">${SHOP.map(p => ST.newCard(p)).join('')}</div>
    </div>
  </section>
</main>
<script src="/assets/sahra-sahel.js" defer></script>`;

  const canonical = `${SITE}/sahel/`;
  const DESC = ST.stageNow() >= 1 ? 'Sahel (ساحل) is the Coast Edition from Sahra & Beyond: seven pieces designed in the UAE and drawn from the coast. ' + (ST.stageNow() === 1 ? 'Pre-order open.' : 'Out now.') : T.desc;
  write('sahel/index.html', shell({
    title: T.title, desc: DESC, canonical, bodyClass: 'sahel-page', activeNav: 'sahel',
    image: `${SITE}/assets/sahel/sahel-og.jpg`,
    jsonld: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Sahel: The Coast Edition', description: DESC, url: canonical,
      isPartOf: { '@type': 'WebSite', name: 'Sahra & Beyond', url: SITE + '/' } },
    bodyHtml: body
  }));
  console.log(`  ✓ Sahel: /sahel/ (${STATE} state, ${PIECES.length} pieces)`);
};
module.exports.STATE = STATE;
