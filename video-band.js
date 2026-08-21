/**
 * video-band.js — the brand video band that sits under the homepage hero.
 *
 * Renders nothing at all unless video/brand.mp4 exists, so the homepage is
 * unchanged until a cut is actually prepared (node prep-video.js <file>).
 *
 * The behaviour that matters, and why:
 *
 *  - Muted + playsinline + loop. Browsers only permit autoplay without a
 *    gesture when the video is muted, and iOS additionally needs playsinline
 *    or it takes over the screen in fullscreen.
 *
 *  - The <video> gets preload="none" and its source is attached by script,
 *    NOT in the markup. That is deliberate: the band is below the fold, and a
 *    <video src> in the markup starts fetching during page load and competes
 *    with the hero for bandwidth on exactly the mobile connections we care
 *    most about. The poster shows immediately; the video is fetched only when
 *    the band is near the viewport.
 *
 *  - Playback pauses when the band scrolls out of view. A looping video that
 *    keeps decoding off-screen drains battery for nothing.
 *
 *  - prefers-reduced-motion and Save-Data both fall back to the poster and
 *    never fetch the video. Autoplaying motion is a genuine accessibility
 *    problem for some people, and this is a brand film, not functionality.
 *
 *  - There is a visible play/pause control. Autoplaying motion that cannot be
 *    stopped fails WCAG 2.2.2 when it runs more than five seconds.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MP4 = path.join(ROOT, 'video', 'brand.mp4');
const POSTER = path.join(ROOT, 'video', 'brand-poster.jpg');

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
  const heading = opts.heading || 'The film';
  const line = opts.line || 'Shot across the Emirates — the places the designs come from.';

  return `
  <section class="vband" aria-labelledby="vb-h">
    <div class="wrap vband-in">
      <div class="vband-txt">
        <span class="eyebrow" id="vb-h">${heading}</span>
        <p class="vband-line">${line}</p>
      </div>
      <div class="vband-frame">
        <video class="vband-v" id="brandVideo"
               ${p ? `poster="${p}"` : ''}
               muted loop playsinline preload="none"
               disablepictureinpicture
               data-src="/video/brand.mp4?v=${v}"
               aria-label="Sahra &amp; Beyond brand film, no sound"></video>
        <button type="button" class="vband-toggle" id="brandVideoToggle"
                aria-controls="brandVideo" aria-pressed="false" hidden>Pause</button>
      </div>
      <a class="btn ghost vband-cta" href="/shop/">Shop the collection &rarr;</a>
    </div>
  </section>`;
}

/* The panel is capped at 1120px because the crop is 1080px wide at source.
   Stretching it edge-to-edge on a 1920px display is a 1.78x upscale and looks
   soft; held near native it stays sharp. aspect-ratio matches the 2.39:1 crop
   exactly, so the box never letterboxes or shifts layout while loading. */
const CSS = `
/*VBAND-CSS-START*/
.vband{position:relative;z-index:2;padding:64px 20px 72px;border-top:1px solid var(--line,rgba(43,37,32,.12))}
.vband-in{max-width:1120px;margin:0 auto;text-align:center}
.vband-line{font-size:17px;line-height:1.7;margin:10px auto 22px;max-width:52ch}
.vband-frame{position:relative;width:100%;aspect-ratio:2.39/1;overflow:hidden;
  border-radius:10px;background:#181109;box-shadow:0 26px 64px rgba(20,16,42,.24)}
.vband-v{width:100%;height:100%;object-fit:cover;display:block}
.vband-toggle{position:absolute;right:12px;bottom:12px;z-index:2;border:0;border-radius:999px;
  min-width:44px;min-height:44px;padding:0 16px;cursor:pointer;
  font-family:'Space Mono',monospace;font-size:11px;letter-spacing:1px;text-transform:uppercase;
  background:rgba(24,17,9,.82);color:#FFF6E8;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.vband-toggle:hover{background:rgba(24,17,9,.94)}
.vband-cta{display:inline-block;margin-top:26px}
@media(max-width:700px){
  .vband{padding:48px 16px 56px}
  .vband-line{font-size:15.5px}
  .vband-frame{border-radius:8px}
}
@media(prefers-reduced-motion:reduce){.vband-toggle{display:none}}
/*VBAND-CSS-END*/`;

/* Attached by script so the file is not fetched during page load. */
const JS = `
<script>
(function(){
  var v=document.getElementById('brandVideo'), btn=document.getElementById('brandVideoToggle');
  if(!v) return;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var conn = navigator.connection||{};
  var thrifty = conn.saveData===true || /(^|-)2g$/.test(conn.effectiveType||'');
  /* poster only: never fetch the video at all */
  if(reduced || thrifty){ return; }

  var loaded=false;
  function load(){
    if(loaded) return; loaded=true;
    v.src = v.dataset.src;
    v.play().then(function(){ if(btn) btn.hidden=false; }).catch(function(){
      /* autoplay refused: leave the poster up and offer the control */
      if(btn){ btn.hidden=false; btn.textContent='Play'; btn.setAttribute('aria-pressed','true'); }
    });
  }
  function set(paused){
    if(!btn) return;
    btn.textContent = paused ? 'Play' : 'Pause';
    btn.setAttribute('aria-pressed', paused ? 'true' : 'false');
  }
  if(btn) btn.addEventListener('click', function(){
    if(v.paused){ v.play(); set(false); } else { v.pause(); set(true); }
  });

  var manual=false;
  if(btn) btn.addEventListener('click', function(){ manual=true; });

  if('IntersectionObserver' in window){
    new IntersectionObserver(function(en){
      en.forEach(function(e){
        if(e.isIntersecting){ load(); if(!manual && v.paused && loaded) { v.play().catch(function(){}); } }
        else if(!v.paused){ v.pause(); }   /* stop decoding off-screen */
      });
    },{rootMargin:'200px 0px'}).observe(v);
  } else { load(); }

  document.addEventListener('visibilitychange', function(){
    if(document.hidden && !v.paused) v.pause();
  });
})();
<\/script>`;

module.exports = { band, CSS, JS, exists: () => fs.existsSync(MP4) };
