/* instagram-feed.js (4 Oct 2026)
   The brand's Instagram posts on the site, from a curated file rather than Instagram's
   embed or a widget: content/instagram.json plus covers and slides under uploads/ig/.
   No tokens, no third-party scripts, no follower or like counts anywhere (Faheem's
   rule: the date is the proof). Used by build.js (home strip, footer row, guides,
   /feed/, /q/ pages) and build-products.js ("Seen on our feed").

   A post is shown only when its cover file exists, so a half-added post never
   renders as an empty card. Dates are decoded from the Instagram shortcode (the
   media id carries its creation time), so there is nothing to keep in sync. */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'instagram.json'), 'utf8'));
const IG_URL = 'https://www.instagram.com/';
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Instagram shortcode -> Date. Base64 (URL alphabet) of the media id; the top bits
   are milliseconds since Instagram's epoch (1314220021721). Checked against the
   <time> element of a live post on 1 Oct 2026: exact to the second. */
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function dateOf(id) {
  let n = 0n;
  for (const c of id) { const i = ALPHA.indexOf(c); if (i < 0) return null; n = n * 64n + BigInt(i); }
  return new Date(Number(n >> 23n) + 1314220021721);
}

function coverFile(p) { return path.join(ROOT, 'uploads', 'ig', p.id + '.webp'); }
function slidesOf(p) {
  if (p.noSlides) return [];
  const d = path.join(ROOT, 'uploads', 'ig', 's', p.id);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(f => /^\d\d\.(mp4|webp)$/.test(f)).sort().map(f => `/uploads/ig/s/${p.id}/${f}`);
}

/* every post that can be shown, pinned first, then newest first */
let _all = null;
function all() {
  if (_all) return _all;
  _all = DATA.posts
    .filter(p => !p.hidden && fs.existsSync(coverFile(p)))
    .map(p => ({ ...p, date: p.site ? null : dateOf(p.id), slides: slidesOf(p), account: p.account === 'trail' ? DATA.accounts.trail : DATA.accounts.house }))
    .sort((a, b) => (a.pin || 99) - (b.pin || 99) || (b.date || 0) - (a.date || 0));
  return _all;
}
function byId(id) { const p = DATA.posts.find(x => x.id === id); if (!p) return null; return { ...p, date: p.site ? null : dateOf(p.id), slides: slidesOf(p), account: p.account === 'trail' ? DATA.accounts.trail : DATA.accounts.house }; }
function newest(n, skip = []) { return all().filter(p => !p.pin && !skip.includes(p.id)).slice(0, n); }
/* the home strip: the pinned buying-question post(s) first, then the newest */
function strip(n = 6) { const pins = all().filter(p => p.pin === 1); return pins.concat(newest(n - pins.length, pins.map(p => p.id))); }
function footerRow(n = 4) { const s = strip().map(p => p.id); return newest(n, s); }
function forProduct(handle, n = 2) { return all().filter(p => (p.products || []).includes(handle)).slice(0, n); }
function forPlace(id, n = 1) { return all().filter(p => (p.places || []).includes(id)).slice(0, n); }
function forGuide(pathname, n = 1) { return all().filter(p => (p.guides || []).includes(pathname)).slice(0, n); }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TZ = 'Asia/Dubai';
function dubaiParts(d) { const f = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(d); const g = k => +f.find(x => x.type === k).value; return { y: g('year'), m: g('month'), d: g('day') }; }
function dayStamp(d) { const q = dubaiParts(d); return Date.UTC(q.y, q.m - 1, q.d); }
function shortDate(d) { const q = dubaiParts(d); return `${q.d} ${MONTHS[q.m - 1]}`; }
function ago(d, now = new Date()) {
  if (!d) return '';
  const days = Math.round((dayStamp(now) - dayStamp(d)) / 864e5);
  if (days <= 0) return 'Posted today';
  if (days === 1) return 'Posted yesterday';
  if (days < 7) return `Posted ${days} days ago`;
  if (days < 28) return `Posted ${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`;
  return `Posted ${shortDate(d)}`;
}
function postUrl(p) {
  if (p.site) return '';
  const acct = p.account === DATA.accounts.trail ? 'sahratrail' : DATA.accounts.house;
  return `${IG_URL}${acct}/${p.kind === 'reel' ? 'reel' : 'p'}/${p.id}/`;
}
function kindLabel(p) {
  if (p.kind === 'reel') return 'Reel';
  if (p.kind === 'photo') return 'Photo';
  return p.slides.length > 1 ? `Carousel · ${p.slides.length} slides` : 'Carousel';
}

/* one card. opts: {sizes, wear:true, big:true, eager:false} */
function card(p, opts = {}) {
  const url = postUrl(p);
  const slides = p.slides;
  const hasSlides = slides.length > 1;
  const sizes = opts.sizes || '(max-width:760px) 62vw, 240px';
  const alt = `${p.label}${p.kind === 'reel' ? ', a Reel' : ''} on @${p.account}`;
  const wear = opts.wear !== false && p.wear ? `<a class="ig-wear" href="${esc(p.wear[0])}">${esc(p.wear[1])} &rarr;</a>` : '';
  const open = url ? `<a class="ig-open" href="${esc(url)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true"></a>` : '';
  return `<article class="ig-card${hasSlides ? ' has-slides' : ''}${opts.big ? ' ig-big' : ''}" data-id="${esc(p.id)}"${p.date ? ` data-date="${p.date.toISOString()}"` : ''}${hasSlides ? ` data-slides="${esc(slides.join('|'))}"` : (slides.length === 1 ? ` data-slides="${esc(slides[0])}"` : '')}>
  <div class="ig-media">
    <img class="ig-cover" src="/uploads/ig/${p.id}-540.webp" srcset="/uploads/ig/${p.id}-540.webp 540w, /uploads/ig/${p.id}.webp 1080w" sizes="${esc(sizes)}" width="540" height="675" loading="${opts.eager ? 'eager' : 'lazy'}" decoding="async" alt="">
    ${hasSlides ? `<div class="ig-seg" aria-hidden="true">${slides.map((s, i) => `<i${i === 0 ? ' class="on"' : ''}></i>`).join('')}</div>` : ''}
    ${open}
    ${hasSlides ? `<button class="ig-tap ig-prev" type="button" aria-label="Previous slide" hidden></button><button class="ig-tap ig-next" type="button" aria-label="Next slide" hidden></button><span class="ig-sr" aria-live="polite"></span>` : ''}
    <span class="ig-kind">${esc(kindLabel(p))}</span>
  </div>
  <div class="ig-txt">
    ${p.date ? `<span class="ig-ago" data-date="${p.date.toISOString()}">${esc(ago(p.date))}</span>` : ''}
    <h3 class="ig-label">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener" aria-label="${esc(alt)}, opens on Instagram">${esc(p.label)}</a>` : esc(p.label)}</h3>
    ${wear}
  </div>
</article>`;
}

/* the home strip, inside the film stop */
function stripHtml() {
  const posts = strip();
  if (posts.length < 3) return '';
  const newestId = newest(1)[0] && newest(1)[0].id;
  return `<section class="ig-strip ig-dark" id="s-feed" aria-labelledby="ig-strip-h">
  <div class="ig-head">
    <h2 id="ig-strip-h" class="ig-eyebrow">From our Instagram</h2>
    <a class="ig-follow" href="${IG_URL}${DATA.accounts.house}/" target="_blank" rel="noopener">@${DATA.accounts.house} &#8599;</a>
  </div>
  <div class="ig-rail" data-newest="${esc(newestId || '')}">${posts.map(p => card(p)).join('')}</div>
  <p class="ig-more"><a href="/feed/">Every post, and where it lives on the site &rarr;</a></p>
</section>`;
}

/* the footer row: four more posts, stills, no autoplay */
function footerRowHtml() {
  const posts = footerRow(4);
  if (posts.length < 4) return '';
  const last = all().filter(p => p.date).sort((a, b) => b.date - a.date)[0];
  return `<nav class="ig-foot ig-dark" aria-label="More from our Instagram">
  <div class="ig-foot-row">${posts.map(p => `<a class="ig-foot-card" href="${esc(postUrl(p))}" target="_blank" rel="noopener" data-slide="${esc(p.slides[0] || '')}"><img src="/uploads/ig/${p.id}-540.webp" width="540" height="675" loading="lazy" decoding="async" alt=""><span class="ig-foot-cap"><span>${esc(p.label)}</span></span></a>`).join('')}</div>
  <p class="ig-foot-line"><a href="${IG_URL}${DATA.accounts.house}/" target="_blank" rel="noopener">Instagram &mdash; @${DATA.accounts.house}</a>${last ? ` <span class="ig-foot-last">· last post ${esc(shortDate(last.date))}</span>` : ''} · <a href="/feed/">all posts</a></p>
</nav>`;
}

/* a short rail for a product page or a guide: {products:[..]} | {places:[..]} | {guides:[..]} */
function railHtml(posts, { title = 'Seen on our feed', dark = false, sizes } = {}) {
  if (!posts.length) return '';
  return `<section class="ig-rail-sec${dark ? ' ig-dark' : ''}" aria-label="${esc(title)}">
  <div class="ig-head"><h2 class="ig-eyebrow">${esc(title)}</h2><a class="ig-follow" href="/feed/">All posts &rarr;</a></div>
  <div class="ig-rail ig-rail-short">${posts.map(p => card(p, { sizes: sizes || '(max-width:760px) 62vw, 220px' })).join('')}</div>
</section>`;
}

/* /feed/: every post, with chips */
function feedPageHtml() {
  const posts = all();
  const topics = DATA.topics;
  const groups = [];
  for (const p of posts) { const t = topics[p.topic] || 'The brand'; if (!groups.includes(t)) groups.push(t); }
  const slug = s => s.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
  return `<div class="ig-feedhead">
  <p class="ig-eyebrow">@${DATA.accounts.house} &middot; @${DATA.accounts.trail}</p>
  <h1>From our Instagram</h1>
  <p class="lede">Every post, newest first, and where it lives on the site. Tap the sides of a card to step through its slides; tap the middle to open it on Instagram.</p>
  <p class="ig-followrow"><a class="btn-ghost" href="${IG_URL}${DATA.accounts.house}/" target="_blank" rel="noopener">Follow @${DATA.accounts.house} &#8599;</a> <a class="btn-ghost" href="${IG_URL}sahratrail/" target="_blank" rel="noopener">Follow @${DATA.accounts.trail} &#8599;</a></p>
  <div class="ig-chips" role="group" aria-label="Filter posts"><button type="button" class="on" data-chip="all" aria-pressed="true">All</button>${groups.map(g => `<button type="button" data-chip="${slug(g)}" aria-pressed="false">${esc(g)}</button>`).join('')}</div>
</div>
<div class="ig-grid" data-newest="${esc((newest(1)[0] || {}).id || '')}">${posts.map(p => `<div class="ig-cell" data-topic="${slug(topics[p.topic] || 'The brand')}">${card(p, { sizes: '(max-width:760px) 46vw, 270px' })}</div>`).join('')}</div>
<p class="ig-empty" role="status" hidden>Nothing in this group yet.</p><style>.feed-page .ig-foot{display:none}</style>
<script>(function(){var g=document.querySelector('.ig-grid'),e=document.querySelector('.ig-empty');if(!g)return;document.querySelectorAll('.ig-chips button').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('.ig-chips button').forEach(function(x){x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',x===b?'true':'false');});var k=b.getAttribute('data-chip'),n=0;g.querySelectorAll('.ig-cell').forEach(function(c){var show=k==='all'||c.getAttribute('data-topic')===k;c.hidden=!show;if(show)n++;});e.hidden=n>0;window.dispatchEvent(new Event('scroll'));});});})();</script>`;
}

const CSS = `
/* ---- Instagram blocks (instagram-feed.js) ---- */
.ig-strip,.ig-rail-sec,.ig-foot,.ig-feedhead,.ig-grid{--ig-ink:#2B2620;--ig-soft:#5C5346;--ig-line:rgba(43,37,32,.14);--ig-fill:#fff;--ig-accent:#9C521B;--ig-seg:rgba(43,37,32,.25);--ig-segon:#9C521B}
.ig-dark{--ig-ink:#F7EFE2;--ig-soft:rgba(247,239,226,.72);--ig-line:rgba(247,239,226,.22);--ig-fill:rgba(20,16,42,.6);--ig-accent:#E9B978;--ig-seg:rgba(255,255,255,.35);--ig-segon:#fff}
.ig-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:0 0 12px}
.ig-eyebrow,.ig-head h2.ig-eyebrow,.sec .ig-head h2.ig-eyebrow{font-family:'Space Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:2.6px;text-transform:uppercase;color:var(--ig-soft);font-weight:400;margin:0;max-width:none;line-height:1.5;font-style:normal;opacity:1;visibility:visible;transform:none}
.ig-follow{font-family:'Space Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:1.6px;text-transform:uppercase;color:var(--ig-ink);text-decoration:none;border:1px solid var(--ig-line);border-radius:999px;padding:7px 12px;white-space:nowrap}
.ig-follow:hover{border-color:var(--ig-ink)}
.ig-rail{display:flex;gap:12px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;scroll-padding:0 16px;padding:4px 0 10px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.ig-rail::-webkit-scrollbar{display:none}
.ig-card{flex:0 0 62vw;max-width:252px;min-width:0;scroll-snap-align:center;background:var(--ig-fill);border:1px solid var(--ig-line);border-radius:14px;overflow:hidden;position:relative;transition:transform .25s ease,border-color .25s ease}
@media(min-width:761px){.ig-card{flex-basis:calc((100% - 60px)/6);max-width:none}.ig-rail-short .ig-card{flex-basis:220px}.ig-card:hover{transform:translateY(-6px);border-color:var(--ig-ink)}}
.ig-media{position:relative;aspect-ratio:4/5;background:#181109;overflow:hidden}
.ig-media img,.ig-media video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.ig-media video{opacity:0;transition:opacity .6s ease;pointer-events:none}
.ig-media video.on{opacity:1}
.ig-seg{position:absolute;top:8px;left:8px;right:8px;display:flex;gap:3px;z-index:3;pointer-events:none}
.ig-seg i{flex:1;height:2px;border-radius:2px;background:var(--ig-seg);position:relative;overflow:hidden}
.ig-seg i::after{content:'';position:absolute;inset:0;background:var(--ig-segon);transform:scaleX(0);transform-origin:left}
.ig-seg i.done::after{transform:scaleX(1)}
.ig-card.active .ig-seg i.on::after{animation:igFill 5s linear forwards}
.ig-card:not(.active) .ig-seg i.on::after{transform:scaleX(1)}
@keyframes igFill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.ig-open{position:absolute;inset:0;z-index:1}.ig-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.ig-tap{position:absolute;top:0;bottom:0;width:33%;border:0;background:transparent;z-index:2;cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent}
.ig-prev{left:0}.ig-next{right:0}
.ig-tap:focus-visible{outline:2px solid var(--ig-accent);outline-offset:-4px}
.ig-kind{position:absolute;left:10px;bottom:10px;z-index:3;pointer-events:none;font-family:'Space Mono',ui-monospace,monospace;font-size:9.5px;letter-spacing:1.4px;text-transform:uppercase;color:#fff;background:rgba(0,0,0,.42);border-radius:999px;padding:4px 8px;backdrop-filter:blur(4px)}
.ig-card.ig-new .ig-media::before{content:'';position:absolute;top:18px;right:12px;width:8px;height:8px;border-radius:50%;background:#C8703A;box-shadow:0 0 0 0 rgba(200,112,58,.6);z-index:4;animation:igPulse 1.6s ease-in-out 3}
@keyframes igPulse{0%{box-shadow:0 0 0 0 rgba(200,112,58,.6)}70%{box-shadow:0 0 0 10px rgba(200,112,58,0)}100%{box-shadow:0 0 0 0 rgba(200,112,58,0)}}
.ig-txt{padding:10px 12px 12px;display:flex;flex-direction:column;gap:4px}
.ig-ago{font-family:'Space Mono',ui-monospace,monospace;font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:var(--ig-soft)}
.ig-label{font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-size:17px;line-height:1.2;margin:0;color:var(--ig-ink);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;max-width:none;letter-spacing:0}
.ig-label a{color:inherit;text-decoration:none}
.ig-label a:hover{text-decoration:underline;text-underline-offset:3px}
.ig-wear{font-size:12.5px;color:var(--ig-accent);text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ig-wear:hover{text-decoration:underline}
.ig-more{margin:6px 0 0;font-size:13px}.ig-more a{color:var(--ig-accent);text-decoration:none}.ig-more a:hover{text-decoration:underline}
.ig-strip{width:100%;max-width:1180px;margin:28px auto 0;padding:0 clamp(16px,6vw,96px)}
.ig-rail-sec{margin:28px 0}
/* footer row */
.ig-foot{max-width:720px;margin:18px auto 10px;padding:0 16px;text-align:center}
.ig-foot-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
@media(max-width:480px){.ig-foot-row{grid-template-columns:repeat(2,1fr)}}
.ig-foot-card{position:relative;display:block;aspect-ratio:4/5;border-radius:10px;overflow:hidden;border:1px solid var(--ig-line);background:#181109}
.ig-foot-card img,.ig-foot-card video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.ig-foot-card video{opacity:0;transition:opacity .6s}.ig-foot-card video.on{opacity:1}
.ig-foot-cap{position:absolute;left:0;right:0;bottom:0;padding:18px 8px 7px;font-size:11px;line-height:1.3;color:#fff;text-align:left;background:linear-gradient(transparent,rgba(0,0,0,.7))}.ig-foot-cap span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ig-foot-line{margin:12px 0 0;font-family:'Space Mono',ui-monospace,monospace;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:var(--ig-soft)}
.ig-foot-line a{color:var(--ig-ink);text-decoration:none}.ig-foot-line a:hover{text-decoration:underline}
.ig-foot-last{letter-spacing:1px}
/* /feed/ */
.ig-feedhead{max-width:760px;margin:0 auto 22px}
.ig-feedhead h1{font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-size:clamp(32px,5vw,48px);line-height:1.05;margin:8px 0 10px;text-wrap:balance}
.ig-feedhead .lede{color:var(--ig-soft);font-size:15.5px;margin:0 0 14px}
.ig-followrow{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px}
.ig-chips{display:flex;gap:8px;flex-wrap:wrap}
.ig-chips button{font:inherit;font-size:13px;padding:7px 14px;border-radius:999px;border:1px solid var(--ig-line);background:transparent;color:var(--ig-ink);cursor:pointer}
.ig-chips button.on{background:var(--ig-ink);color:#FAF6EF;border-color:var(--ig-ink)}
.ig-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;max-width:1180px;margin:0 auto}.ig-cell{min-width:0}
@media(min-width:761px){.ig-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}}
@media(min-width:1100px){.ig-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
.ig-grid .ig-card{flex:none;max-width:none;width:100%}
.ig-empty{text-align:center;color:var(--ig-soft);margin:30px 0}
/* /q/ pages */
.ig-big{max-width:420px;margin:0 auto}
.ig-big .ig-label{font-size:20px}
@media(prefers-reduced-motion:reduce){.ig-card,.ig-seg i::after,.ig-media video,.ig-card.ig-new .ig-media::before{transition:none;animation:none!important}.ig-card.active .ig-seg i.on::after{transform:scaleX(1)}}
`;

/* client script: one card plays at a time, step through slides, posted-ago, new dot */
const JS = `(function(){
var cards=[].slice.call(document.querySelectorAll('.ig-card'));if(!cards.length&&!document.querySelector('.ig-foot-card'))return;
var reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
var con=navigator.connection||{};var slow=!!con.saveData||/(^|[^4-9])[23]g$/.test(con.effectiveType||'');
var canAuto=!reduced&&!slow;
var MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function dayOf(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();}
/* posted-ago, recomputed on load so a cached page stays honest (calendar days, viewer's clock) */
[].forEach.call(document.querySelectorAll('.ig-ago[data-date]'),function(e){var d=new Date(e.getAttribute('data-date'));if(isNaN(d))return;var days=Math.round((dayOf(new Date())-dayOf(d))/864e5),t;if(days<=0)t='Posted today';else if(days===1)t='Posted yesterday';else if(days<7)t='Posted '+days+' days ago';else if(days<28)t='Posted '+Math.floor(days/7)+' week'+(days<14?'':'s')+' ago';else t='Posted '+d.getDate()+' '+MONTHS[d.getMonth()];e.textContent=t;});
/* the new-post dot: newest card, under 7 days, not seen before */
[].forEach.call(document.querySelectorAll('[data-newest]'),function(r){var id=r.getAttribute('data-newest');if(!id)return;var c=r.querySelector('.ig-card[data-id="'+id+'"]');if(!c)return;var d=new Date(c.getAttribute('data-date')||0);if(Date.now()-d>7*864e5)return;var seen=null;try{seen=localStorage.getItem('sb_ig_seen');}catch(e){}if(seen===id)return;c.classList.add('ig-new');var t=null;try{new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){t=t||setTimeout(function(){try{localStorage.setItem('sb_ig_seen',id);}catch(x){}},2500);}else if(t){clearTimeout(t);t=null;}});},{threshold:.6}).observe(c);}catch(e){}});
/* slides */
function slidesOf(c){var s=c.getAttribute('data-slides');return s?s.split('|'):[];}
function st(c){return c.__ig||(c.__ig={i:0,v:null,img:null,timer:null,manual:false});}
function media(c){return c.querySelector('.ig-media');}
function clearTimer(s){if(s.timer){clearTimeout(s.timer);s.timer=null;}}
function announce(c,i,n){var sr=c.querySelector('.ig-sr');if(sr)sr.textContent='Slide '+(i+1)+' of '+n;}
function dropVideo(v){if(!v)return;try{v.pause();v.removeAttribute('src');v.load();v.remove();}catch(e){}}
function show(c,i,play){var s=st(c),sl=slidesOf(c);if(!sl.length)return;i=(i+sl.length)%sl.length;s.i=i;var src=sl[i];clearTimer(s);
 [].forEach.call(c.querySelectorAll('.ig-seg i'),function(e,k){e.classList.toggle('on',k===i);e.classList.toggle('done',k<i);});
 announce(c,i,sl.length);
 var old=s.v;
 if(/\\.mp4$/.test(src)){if(s.img){s.img.style.opacity=0;}
  var v=document.createElement('video');v.muted=true;v.playsInline=true;v.setAttribute('playsinline','');v.setAttribute('muted','');v.loop=true;v.preload='auto';v.setAttribute('aria-hidden','true');v.tabIndex=-1;v.src=src;media(c).appendChild(v);s.v=v;
  var done=false,ok=function(){if(done)return;done=true;if(v.error){dropVideo(v);if(s.v===v)s.v=null;return;}v.classList.add('on');setTimeout(function(){dropVideo(old);},650);};
  v.addEventListener('playing',ok);v.addEventListener('loadeddata',function(){if(!play)ok();});v.addEventListener('error',function(){done=true;dropVideo(v);if(s.v===v)s.v=null;});
  setTimeout(function(){if(!done){if(v.readyState>=2)ok();else{done=true;dropVideo(v);if(s.v===v)s.v=null;}}},6000);
  if(play){var p=v.play();if(p&&p.catch)p.catch(function(){if(v.readyState>=2)ok();});}else{v.load();}
 }else{var im=s.img;if(!im){im=document.createElement('img');im.className='ig-slide';im.alt='';im.decoding='async';im.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .4s';media(c).appendChild(im);s.img=im;}
  dropVideo(old);s.v=null;im.src=src;im.onload=function(){im.style.opacity=1;};}
 /* a story-style auto-advance while the card is active, until the visitor steps it by hand */
 if(play&&canAuto&&!s.manual&&sl.length>1)s.timer=setTimeout(function(){if(c.classList.contains('active'))show(c,s.i+1,true);},5000);}
function stop(c){var s=c.__ig;if(!s)return;clearTimer(s);dropVideo(s.v);s.v=null;if(s.img)s.img.style.opacity=0;}
function activate(c){if(c.classList.contains('active'))return;c.classList.add('active');if(canAuto&&slidesOf(c).length)show(c,st(c).i,true);}
function deactivate(c){if(!c.classList.contains('active'))return;c.classList.remove('active');stop(c);}
var rails=[].slice.call(document.querySelectorAll('.ig-rail,.ig-grid,.ig-big'));var vis={};
function railOf(c){for(var k=0;k<rails.length;k++){if(rails[k]===c||rails[k].contains(c))return rails[k];}return null;}
/* a tap makes that card the active one, and only that one, until the rail scrolls again */
function step(c,dir){var s=st(c);s.manual=true;var r=railOf(c);if(r)r.__pin=c;cards.forEach(function(x){if(x!==c)deactivate(x);});c.classList.add('active');show(c,s.i+dir,!reduced);}
cards.forEach(function(c){var sl=slidesOf(c);if(sl.length<2)return;
 [].forEach.call(c.querySelectorAll('.ig-tap'),function(b){b.hidden=false;});
 c.querySelector('.ig-prev').addEventListener('click',function(e){e.preventDefault();step(c,-1);});
 c.querySelector('.ig-next').addEventListener('click',function(e){e.preventDefault();step(c,1);});
 c.addEventListener('keydown',function(e){if(e.key==='ArrowRight'){e.preventDefault();step(c,1);}if(e.key==='ArrowLeft'){e.preventDefault();step(c,-1);}});
 if(matchMedia('(hover:hover)').matches){c.addEventListener('mouseenter',function(){if(!canAuto)return;var r=railOf(c);if(r)r.__hover=c;pick();});c.addEventListener('mouseleave',function(){var r=railOf(c);if(r&&r.__hover===c)r.__hover=null;pick();});}
});
/* one active card on the page: the pinned or hovered one, else the card nearest the viewport centre in a visible rail */
function pick(){var best=null,bd=1e9;rails.forEach(function(r,ri){var cs=(r.classList.contains('ig-card')?[r]:[].slice.call(r.querySelectorAll('.ig-card'))).filter(function(c){return !c.hidden&&!(c.parentNode&&c.parentNode.hidden)&&slidesOf(c).length;});if(!cs.length)return;
 if(r.__pin&&cs.indexOf(r.__pin)>=0&&inView(r.__pin)){best=r.__pin;bd=-2;return;}
 if(r.__hover&&cs.indexOf(r.__hover)>=0){if(bd>-1){best=r.__hover;bd=-1;}return;}
 if(!vis[ri])return;var cx=innerWidth/2,cy=innerHeight/2;cs.forEach(function(c){var b=c.getBoundingClientRect();if(b.bottom<0||b.top>innerHeight||b.right<0||b.left>innerWidth)return;var d=Math.abs(b.left+b.width/2-cx)+Math.abs(b.top+b.height/2-cy)*(r.classList.contains('ig-grid')?1:0.15);if(d<bd){bd=d;best=c;}});});
 cards.forEach(function(c){if(c===best)activate(c);else deactivate(c);});}
function inView(c){var b=c.getBoundingClientRect();return b.bottom>0&&b.top<innerHeight&&b.right>0&&b.left<innerWidth;}
var raf=null;function onScroll(){if(raf)return;raf=requestAnimationFrame(function(){raf=null;rails.forEach(function(r){if(r.__pin&&!inView(r.__pin))r.__pin=null;});pick();});}
try{var io=new IntersectionObserver(function(es){es.forEach(function(e){vis[rails.indexOf(e.target)]=e.isIntersecting;});pick();},{threshold:0});rails.forEach(function(r){io.observe(r);r.addEventListener('scroll',function(){r.__pin=null;onScroll();},{passive:true});});}catch(e){rails.forEach(function(r,i){vis[i]=true;});}
addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',onScroll);
document.addEventListener('visibilitychange',function(){if(document.hidden)cards.forEach(deactivate);else pick();});
document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('.ig-chips'))setTimeout(pick,50);});
/* footer row: stills; a hover or focus plays the first slide, nothing on touch */
if(canAuto&&matchMedia('(hover:hover)').matches)[].forEach.call(document.querySelectorAll('.ig-foot-card[data-slide$=".mp4"]'),function(a){var v=null;function on(){if(v)return;v=document.createElement('video');v.muted=true;v.playsInline=true;v.setAttribute('muted','');v.setAttribute('playsinline','');v.loop=true;v.src=a.getAttribute('data-slide');v.setAttribute('aria-hidden','true');a.appendChild(v);v.addEventListener('playing',function(){v.classList.add('on');});var p=v.play();if(p&&p.catch)p.catch(function(){});}
 function off(){dropVideo(v);v=null;}
 a.addEventListener('mouseenter',on);a.addEventListener('focus',on);a.addEventListener('mouseleave',off);a.addEventListener('blur',off);});
pick();
})();`;

module.exports = { DATA, all, byId, strip, footerRow, newest, forProduct, forPlace, forGuide, card, stripHtml, footerRowHtml, railHtml, feedPageHtml, postUrl, ago, dateOf, CSS, JS };
