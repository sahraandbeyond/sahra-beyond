/**
 * video-band.js — the full-bleed brand film banner at the top of the homepage.
 *
 * Renders nothing at all unless video/brand.mp4 exists, so the homepage is
 * unchanged until a cut has been prepared (node prep-video.js ...).
 *
 * The decisions that matter, and why:
 *
 *  - Muted + playsinline + loop. Browsers only allow autoplay without a gesture
 *    when muted, and iOS needs playsinline or it goes fullscreen.
 *
 *  - NO TOP SCRIM. An earlier version darkened the top of the film to protect
 *    the nav, on the assumption that the fixed header overlaid it. Measured on
 *    the live page, the nav is position:relative, sits in the flow in its own
 *    66px band above the video, and scrolls away - it never covers the film at
 *    all. The scrim was protecting nothing and read as a dark band across the
 *    top third. Check where the header actually sits before darkening footage.
 *
 *  - The video is the first thing on the page, so it is no longer lazy in the
 *    "wait until scrolled near" sense. The poster still paints first and is what
 *    LCP sees; the source is attached by script immediately. Playback still
 *    pauses when the banner scrolls away, which is what actually saves battery.
 *
 *  - prefers-reduced-motion and Save-Data show the poster and never fetch the
 *    video at all. This is a brand film, not functionality.
 *
 *  - A visible pause control, because autoplaying motion that cannot be stopped
 *    fails WCAG 2.2.2 past five seconds. It is a sibling of the link, not inside
 *    it: a <button> inside an <a> is invalid and the click would navigate.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MP4 = path.join(ROOT, 'video', 'brand.mp4');
const POSTER = path.join(ROOT, 'video', 'brand-poster.jpg');

const REEL_URL = 'https://www.instagram.com/p/DcRvwOCI_FR/';

function hash(file) {
  try {
    return require('crypto').createHash('sha1')
      .update(fs.readFileSync(file)).digest('hex').slice(0, 8);
  } catch (e) { return '0'; }
}

function band(opts = {}) {
  if (!fs.existsSync(MP4)) return '';
  const v = hash(MP4);
  const p = fs.existsSync(POSTER) ? `/video/brand-poster.jpg?v=${hash(POSTER)}` : '';
  const reel = opts.reel || REEL_URL;

  return `
  <section class="vband" aria-label="Sahra &amp; Beyond brand film">
    <div class="vband-frame">
      <video class="vband-v" id="brandVideo"
             ${p ? `poster="${p}"` : ''}
             muted loop playsinline preload="none"
             disablepictureinpicture
             data-src="/video/brand.mp4?v=${v}"
             aria-hidden="true" tabindex="-1"></video>
      <span class="vband-scrim" aria-hidden="true"></span>
      <a class="vband-link" href="${reel}" target="_blank" rel="noopener noreferrer">
        <span class="vband-cta">Watch the film on Instagram &#8599;</span>
      </a>
      <button type="button" class="vband-toggle" id="brandVideoToggle"
              aria-controls="brandVideo" aria-pressed="false" hidden>Pause</button>
    </div>
  </section>`;
}

/* Full-bleed by design. The crop is 1080px wide, so on a 1920px display this is
   a 1.78x upscale and will be a little soft - accepted deliberately in exchange
   for an edge-to-edge banner, and the grain reads as filmic on this footage.
   Height is viewport-relative with object-fit:cover so the banner works on a
   phone in portrait as well as a wide desktop. */
const CSS = `
/*VBAND-CSS-START*/
.vband{position:relative;z-index:2;width:100%;margin:0;padding:0;background:#181109}
.vband-frame{position:relative;width:100%;aspect-ratio:1080/608;overflow:hidden}
/* WHOLE-FILM FRAMING on desktop (Faheem, 1 Sep 2026). The film is 1080x608;
   the band is full-bleed with object-fit:cover, so the complete frame is only
   visible when height == width/1.7763. aspect-ratio does exactly that at every
   width, so nothing is ever cropped on desktop. It replaced clamp(320px,58vh,
   660px), which showed ~64% of the frame's height on a laptop.
   Consequence to know: the band is now as tall as the window is wide / 1.78 -
   721px at 1280, 811px at 1440, 1081px at 1920 - so it fills the first screen
   and the hero headline sits below it. That is deliberate. If it ever needs
   reining in, add a max-height in vh here; cropping then resumes top and
   bottom, which is the crop to prefer because it preserves the width.
   PHONES ARE DELIBERATELY NOT ON THIS RULE - see the media query below. */
.vband-v{width:100%;height:100%;object-fit:cover;display:block}
.vband-scrim{position:absolute;inset:0;pointer-events:none;z-index:1;
  background:linear-gradient(to bottom,rgba(24,17,9,0) 62%,rgba(24,17,9,.34) 100%)}
.vband-link{position:absolute;inset:0;z-index:2;display:flex;align-items:flex-end;
  justify-content:flex-start;padding:0 0 22px 84px;text-decoration:none}
/* Left inset is 84px, not 24px: the ambient-sound button is position:fixed at
   left:18px/bottom:18px (44px wide, so it ends at x=62). Once the band became
   whole-film it got tall enough that its bottom edge lands right where that
   button floats on a 1280x800 or 1440x900 window, and the button sat on top of
   this pill. 84px clears it with 22px of air at every desktop width. Phones
   keep 16px in the media query below - the band ends far above the fold there,
   so nothing overlaps. */
.vband-cta{font-family:'Space Mono',monospace;font-size:12px;letter-spacing:1.4px;
  text-transform:uppercase;color:#FFF6E8;background:rgba(24,17,9,.74);
  padding:11px 16px;border-radius:999px;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.vband-link:hover .vband-cta{background:rgba(24,17,9,.86)}
.vband-toggle{position:absolute;right:20px;bottom:22px;z-index:3;border:0;border-radius:999px;
  min-width:44px;min-height:44px;padding:0 16px;cursor:pointer;
  font-family:'Space Mono',monospace;font-size:11px;letter-spacing:1px;text-transform:uppercase;
  background:rgba(24,17,9,.72);color:#FFF6E8;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.vband-toggle:hover{background:rgba(24,17,9,.92)}
@media(max-width:700px){
  .vband-frame{aspect-ratio:auto;height:clamp(260px,46vh,420px)}
  /* Phones keep the taller, side-cropped band by explicit choice (Faheem,
     1 Sep 2026). At 390px wide the whole frame would be only 220px tall;
     the extra height costs ~43% of the film's width but keeps presence on
     the device most visitors arrive on. aspect-ratio:auto makes that
     override explicit instead of relying on height winning by cascade. */
  .vband-link{padding:0 0 18px 16px}
  .vband-cta{font-size:11px;padding:10px 13px}
  .vband-toggle{right:14px;bottom:18px}
}
@media(prefers-reduced-motion:reduce){.vband-toggle{display:none}}
/*VBAND-CSS-END*/`;

const JS = `
<script>
(function(){
  var v=document.getElementById('brandVideo'), btn=document.getElementById('brandVideoToggle');
  if(!v) return;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var conn = navigator.connection||{};
  var thrifty = conn.saveData===true || /(^|-)2g$/.test(conn.effectiveType||'');
  if(reduced || thrifty){ return; }          /* poster only; never fetch the video */

  var loaded=false, manual=false;
  function load(){
    if(loaded) return; loaded=true;
    v.src = v.dataset.src;
    v.play().then(function(){ if(btn) btn.hidden=false; }).catch(function(){
      if(btn){ btn.hidden=false; btn.textContent='Play'; btn.setAttribute('aria-pressed','true'); }
    });
  }
  function set(paused){
    if(!btn) return;
    btn.textContent = paused ? 'Play' : 'Pause';
    btn.setAttribute('aria-pressed', paused ? 'true' : 'false');
  }
  if(btn) btn.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation(); manual=true;
    if(v.paused){ v.play(); set(false); } else { v.pause(); set(true); }
  });

  /* it is the first thing on the page, so start straight away */
  load();

  if('IntersectionObserver' in window){
    new IntersectionObserver(function(en){
      en.forEach(function(e){
        if(e.isIntersecting){ if(!manual && v.paused) v.play().catch(function(){}); }
        else if(!v.paused){ v.pause(); }      /* stop decoding off-screen */
      });
    },{rootMargin:'100px 0px'}).observe(v);
  }

  document.addEventListener('visibilitychange', function(){
    if(document.hidden && !v.paused) v.pause();
  });
})();
<\/script>`;

module.exports = { band, CSS, JS, REEL_URL, exists: () => fs.existsSync(MP4) };
