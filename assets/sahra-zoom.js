/* sahra-zoom.js: the site's photo viewer (28 Oct 2026, Faheem: "every photo needs to be clickable and zoomable").
 *
 * One viewer for every product photo: the pre-order product pages, the Founding Edition product pages and /shop/.
 *   window.SahraZoom.open([{ src, alt }], index)   opens it on a list of photos.
 *   [data-zoom-gallery] blocks are wired automatically: every <img> inside opens the viewer on that block's photos,
 *   using the image's data-zoom (the large file) when it has one.
 *
 * In the viewer: arrows, keyboard (left/right, Esc, + and -), swipe between photos, swipe down to close.
 * Zoom: double-tap or pinch on a phone; click, double-click or the mouse wheel on a computer; drag to look around.
 * Built without a library; no fixed timers; respects reduced motion.
 */
(function () {
  'use strict';
  if (window.SahraZoom) return;

  var CSS = '' +
    '.szm{position:fixed;inset:0;z-index:2147483000;background:rgba(14,10,6,.985);display:none;touch-action:none;-webkit-user-select:none;user-select:none;color:#F4ECDF;font-family:Jost,system-ui,sans-serif}' +
    '.szm.open{display:block}' +
    '.szm-stage{position:absolute;inset:0;overflow:hidden;display:flex;align-items:center;justify-content:center}' +
    '.szm-img{max-width:94vw;max-height:84vh;max-height:84svh;object-fit:contain;transform-origin:0 0;will-change:transform;cursor:zoom-in;transition:opacity .2s ease;-webkit-user-drag:none;user-select:none;border-radius:6px;box-shadow:0 20px 60px rgba(0,0,0,.45)}' +
    '.szm.zoomed .szm-img{cursor:grab;border-radius:0;box-shadow:none}' +
    '.szm.dragging .szm-img{cursor:grabbing}' +
    '.szm.anim .szm-img{transition:transform .28s cubic-bezier(.2,.7,.2,1),opacity .2s ease}' +
    '.szm-btn{position:absolute;z-index:3;width:48px;height:48px;border-radius:50%;border:1px solid rgba(244,236,223,.28);background:rgba(244,236,223,.12);color:#F4ECDF;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;transition:background .2s}' +
    '.szm-btn:hover{background:rgba(244,236,223,.24)}' +
    '.szm-btn:focus-visible{outline:2px solid #E9B978;outline-offset:3px}' +
    '.szm-close{top:max(14px,env(safe-area-inset-top,0px));right:14px}' +
    '.szm-prev{left:14px;top:50%;margin-top:-24px}.szm-next{right:14px;top:50%;margin-top:-24px}' +
    '.szm-zoom{bottom:max(16px,env(safe-area-inset-bottom,0px));right:14px}' +
    '.szm-bar{position:absolute;left:0;right:0;bottom:max(18px,env(safe-area-inset-bottom,0px));z-index:2;text-align:center;font-size:14px;line-height:1.4;pointer-events:none;padding:28px 76px 0;background:linear-gradient(to bottom,rgba(14,10,6,0),rgba(14,10,6,.7))}' +
    '.szm-count{display:block;font:400 12px/1.4 "Space Mono",ui-monospace,monospace;letter-spacing:.12em;color:#D9C3A5}' +
    '.szm-alt{display:block;color:#E9DFCF;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.szm-hint{position:absolute;top:max(22px,env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);z-index:2;font-size:13px;padding:8px 14px;border-radius:999px;background:rgba(244,236,223,.14);pointer-events:none;transition:opacity .6s;white-space:nowrap}' +
    '.szm-hint.gone{opacity:0}' +
    '.szm.single .szm-prev,.szm.single .szm-next{display:none}' +
    '@media(max-width:699px){.szm-prev,.szm-next{display:none}.szm-img{max-width:100vw;max-height:78vh;max-height:78svh;border-radius:0}}' +
    '@media(prefers-reduced-motion:reduce){.szm.anim .szm-img{transition:none}}' +
    '[data-zoom-gallery] img{cursor:zoom-in}';

  var svg = function (d) { return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  var ZIN = svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M11 8v6M8 11h6"/>'), ZOUT = svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M8 11h6"/>');
  var root, stage, img, cnt, altEl, hint, zbtn, list = [], idx = 0, lastFocus = null;
  var S = 1, TX = 0, TY = 0, MAX = 3, CAP = 3, base = { w: 0, h: 0, l: 0, t: 0 };
  var touchDevice = false, seq = 0, pushed = false, inerted = [];

  function build() {
    if (root) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    root = document.createElement('div');
    root.className = 'szm'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Photo viewer');
    root.innerHTML = '<div class="szm-stage"><img class="szm-img" alt="" draggable="false"></div>' +
      '<div class="szm-hint"></div>' +
      '<button type="button" class="szm-btn szm-close" aria-label="Close the photo viewer">' + svg('<path d="M6 6l12 12M18 6L6 18"/>') + '</button>' +
      '<button type="button" class="szm-btn szm-prev" aria-label="Previous photo">' + svg('<path d="M15 5l-7 7 7 7"/>') + '</button>' +
      '<button type="button" class="szm-btn szm-next" aria-label="Next photo">' + svg('<path d="M9 5l7 7-7 7"/>') + '</button>' +
      '<button type="button" class="szm-btn szm-zoom" aria-label="Zoom in">' + svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M11 8v6M8 11h6"/>') + '</button>' +
      '<div class="szm-bar" aria-live="polite"><span class="szm-count"></span><span class="szm-alt"></span></div>';
    document.body.appendChild(root);
    stage = root.querySelector('.szm-stage'); img = root.querySelector('.szm-img');
    cnt = root.querySelector('.szm-count'); altEl = root.querySelector('.szm-alt'); hint = root.querySelector('.szm-hint'); zbtn = root.querySelector('.szm-zoom');
    root.querySelector('.szm-close').addEventListener('click', function () { close(); });
    root.querySelector('.szm-prev').addEventListener('click', function () { go(-1); });
    root.querySelector('.szm-next').addEventListener('click', function () { go(1); });
    zbtn.addEventListener('click', function () { if (S > 1.01) reset(true); else zoomAt(tapZoom(), innerWidth / 2, innerHeight / 2, true); });
    img.addEventListener('load', measure);
    wire();
    document.addEventListener('keydown', function (e) {
      if (!root.classList.contains('open')) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(Math.min(MAX, S * 1.5), innerWidth / 2, innerHeight / 2, true); }
      else if (e.key === '-') { e.preventDefault(); if (S / 1.5 <= 1.01) reset(true); else zoomAt(S / 1.5, innerWidth / 2, innerHeight / 2, true); }
      else if (e.key === 'Tab') {   /* keep focus inside the viewer */
        var f = [].filter.call(root.querySelectorAll('button'), function (b) { return b.offsetParent !== null; });
        if (!f.length) return;
        var i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
    window.addEventListener('popstate', function () { if (root.classList.contains('open')) { pushed = false; close(true); } });
    window.addEventListener('resize', function () { if (root.classList.contains('open')) { reset(false); measure(); } });
  }

  /* the picture's resting box (S = 1), measured without the transform */
  function measure() {
    var t = img.style.transform; img.style.transform = 'none';
    var r = img.getBoundingClientRect(); base = { w: r.width, h: r.height, l: r.left, t: r.top };
    img.style.transform = t;
    /* 28 Oct 2026 (expert review): zoom only as far as the photo has detail for: 1.25x past one photo pixel per
       screen pixel, never below 1.6x or above 3x */
    var dpr = window.devicePixelRatio || 1, nw = img.naturalWidth || 0;
    if (nw && r.width) MAX = Math.max(1.6, Math.min(CAP, nw / (r.width * dpr) * 1.25));
  }
  function tapZoom() { return Math.min(2.5, MAX); }
  function apply(anim) {
    root.classList.toggle('anim', !!anim);
    root.classList.toggle('zoomed', S > 1.01);
    img.style.transform = 'translate(' + TX + 'px,' + TY + 'px) scale(' + S + ')';
    zbtn.setAttribute('aria-label', S > 1.01 ? 'Zoom out' : 'Zoom in');
    zbtn.innerHTML = S > 1.01 ? ZOUT : ZIN;
  }
  /* keep the zoomed picture covering the screen where it can (no empty band dragged into view) */
  function clamp() {
    if (S <= 1.01) { TX = 0; TY = 0; return; }
    var w = base.w * S, h = base.h * S, minX, maxX, minY, maxY;
    if (w <= innerWidth) { minX = maxX = (innerWidth - w) / 2 - base.l; } else { minX = innerWidth - w - base.l; maxX = -base.l; }
    if (h <= innerHeight) { minY = maxY = (innerHeight - h) / 2 - base.t; } else { minY = innerHeight - h - base.t; maxY = -base.t; }
    TX = Math.max(minX, Math.min(maxX, TX)); TY = Math.max(minY, Math.min(maxY, TY));
  }
  /* zoom to scale s, keeping the screen point (cx, cy) still */
  function zoomAt(s, cx, cy, anim) {
    s = Math.max(1, Math.min(MAX, s));
    var px = (cx - base.l - TX) / S, py = (cy - base.t - TY) / S;
    S = s; TX = cx - base.l - px * S; TY = cy - base.t - py * S;
    clamp(); apply(anim);
    if (S > 1.01) dismissHint();
  }
  function reset(anim) { S = 1; TX = 0; TY = 0; apply(anim); }
  function dismissHint() { hint.classList.add('gone'); }

  function show(i) {
    if (!list.length) return;
    idx = (i % list.length + list.length) % list.length;
    var it = list[idx];
    reset(false);
    var my = ++seq;
    img.style.opacity = '0';
    img.alt = it.alt || '';
    var big = new Image();
    var land = function () { if (my !== seq) return; img.src = it.src; img.style.opacity = '1'; measure(); };
    big.onload = land; big.onerror = land; big.src = it.src;
    /* the card or gallery size first, so the frame is never empty while the large file arrives */
    if (it.low && !big.complete) { img.src = it.low; img.style.opacity = '1'; }
    else if (big.complete) land();
    cnt.textContent = list.length > 1 ? (idx + 1) + ' / ' + list.length : '';
    altEl.textContent = it.alt || '';
    root.classList.toggle('single', list.length < 2);
    [idx + 1, idx - 1].forEach(function (k) { var n = list[(k % list.length + list.length) % list.length]; if (n && n.src) { var p = new Image(); p.src = n.src; } });
    if (img.complete) measure();
  }
  function go(d) { if (list.length > 1) show(idx + d); }

  function open(items, i) {
    items = (items || []).map(function (x) { return typeof x === 'string' ? { src: x } : x; }).filter(function (x) { return x && x.src; });
    if (!items.length) return;
    build();
    lastFocus = document.activeElement;
    list = items;
    root.classList.add('open');
    document.documentElement.style.overflow = 'hidden';
    /* the page behind is inert while the viewer is open (Tab and screen readers stay inside it) */
    inerted = [].filter.call(document.body.children, function (el) { return el !== root && !el.hasAttribute('inert'); });
    inerted.forEach(function (el) { el.setAttribute('inert', ''); });
    /* the phone's Back button closes the viewer instead of leaving the page */
    try { if (!pushed) { history.pushState({ szm: 1 }, ''); pushed = true; } } catch (e) {}
    hint.textContent = touchDevice || matchMedia('(hover: none)').matches ? 'Pinch or double-tap to zoom' : 'Click or scroll to zoom';
    hint.classList.remove('gone');
    setTimeout(dismissHint, 2600);
    show(i || 0);
    var c = root.querySelector('.szm-close'); if (c) c.focus({ preventScroll: true });
    if (window.track) try { window.track('image_zoom', { page: location.pathname, photos: items.length }); } catch (e) {}
  }
  function close(fromPop) {
    if (!root || !root.classList.contains('open')) return;
    if (pushed && fromPop !== true) { pushed = false; try { history.back(); } catch (e) {} }
    pushed = false;
    inerted.forEach(function (el) { el.removeAttribute('inert'); }); inerted = [];
    root.classList.remove('open');
    document.documentElement.style.overflow = '';
    reset(false);
    if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
  }

  /* pointers: pinch, pan, swipe, tap and double-tap */
  function wire() {
    var pts = {}, start = null, lastTap = 0, lastTapX = 0, lastTapY = 0, moved = false, pinch = null, clickTimer = null;
    stage.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') touchDevice = true;
      if (!root.contains(document.activeElement)) { var c = root.querySelector('.szm-close'); if (c) try { c.focus({ preventScroll: true }); } catch (x) {} }
      if (e.target.closest && e.target.closest('.szm-btn')) return;
      try { stage.setPointerCapture(e.pointerId); } catch (x) {}
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pts);
      if (ids.length === 2) {
        var a = pts[ids[0]], b = pts[ids[1]];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: S, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
        start = null; dismissHint();
      } else if (ids.length === 1) {
        start = { x: e.clientX, y: e.clientY, tx: TX, ty: TY, t: Date.now() }; moved = false;
      }
    });
    stage.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pts);
      if (pinch && ids.length >= 2) {
        var a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
        zoomAt(pinch.s * d / pinch.d, (a.x + b.x) / 2, (a.y + b.y) / 2, false);
        return;
      }
      if (!start) return;
      var dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved = true;
      if (S > 1.01) { root.classList.add('dragging'); TX = start.tx + dx; TY = start.ty + dy; clamp(); apply(false); }
      else if (moved) { img.style.transform = 'translate(' + dx * (Math.abs(dx) > Math.abs(dy) ? 1 : 0) + 'px,' + (dy > 0 && Math.abs(dy) > Math.abs(dx) ? dy : 0) + 'px)'; root.classList.remove('anim'); }
    });
    function end(e) {
      if (!pts[e.pointerId]) return;
      delete pts[e.pointerId];
      root.classList.remove('dragging');
      if (pinch) { if (Object.keys(pts).length < 2) { pinch = null; if (S < 1.05) reset(true); start = null; } return; }
      if (!start) return;
      var dx = e.clientX - start.x, dy = e.clientY - start.y, dt = Date.now() - start.t; var st = start; start = null;
      if (S <= 1.01 && moved) {
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { go(dx < 0 ? 1 : -1); return; }
        if (dy > 90 && dy > Math.abs(dx)) { close(); return; }
        apply(true); return;
      }
      if (moved || dt > 500) return;
      /* a tap */
      var now = Date.now(), dbl = now - lastTap < 320 && Math.abs(e.clientX - lastTapX) < 30 && Math.abs(e.clientY - lastTapY) < 30;
      lastTap = now; lastTapX = e.clientX; lastTapY = e.clientY;
      /* pointer capture retargets the event to the stage, so hit-test the picture itself */
      var ir = img.getBoundingClientRect(), onImg = e.clientX >= ir.left && e.clientX <= ir.right && e.clientY >= ir.top && e.clientY <= ir.bottom;
      if (e.pointerType === 'mouse') {
        if (!onImg && S <= 1.01) { close(); return; }        /* a click on the dark backdrop closes */
        if (S > 1.01) reset(true); else zoomAt(tapZoom(), e.clientX, e.clientY, true);
        return;
      }
      if (dbl) { clearTimeout(clickTimer); lastTap = 0; if (S > 1.01) reset(true); else zoomAt(tapZoom(), e.clientX, e.clientY, true); return; }
      if (!onImg && S <= 1.01) { clickTimer = setTimeout(function () { if (Date.now() - lastTap >= 300) close(); }, 330); }
    }
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', function (e) { delete pts[e.pointerId]; pinch = null; start = null; root.classList.remove('dragging'); });
    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      var f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022));
      var s = S * f; if (s < 1.02) { reset(false); return; }
      zoomAt(s, e.clientX, e.clientY, false);
    }, { passive: false });
    /* Safari's own pinch gesture would zoom the whole page */
    ['gesturestart', 'gesturechange'].forEach(function (n) { root.addEventListener(n, function (e) { e.preventDefault(); }); });
  }

  /* [data-zoom-gallery] blocks: every photo inside opens the viewer on that block's photos */
  function srcOf(im) {
    var z = im.getAttribute('data-zoom'); if (z) return z;
    var ss = im.getAttribute('srcset') || im.getAttribute('data-srcset') || '', best = '', bw = 0;
    ss.split(',').forEach(function (part) { var m = part.trim().split(/\s+/); var w = parseInt(m[1], 10) || 0; if (m[0] && w >= bw) { bw = w; best = m[0]; } });
    return best || im.currentSrc || im.src || im.getAttribute('data-src');
  }
  function bindGalleries(scope) {
    [].forEach.call((scope || document).querySelectorAll('[data-zoom-gallery]'), function (g) {
      if (g.__szm) return; g.__szm = 1;
      var imgs = function () { return [].slice.call(g.querySelectorAll('img')).filter(function (i) { return !i.closest('[data-zoom-skip]'); }); };
      [].forEach.call(imgs(), function (im, i) {
        var host = im.closest('figure') || im;
        host.setAttribute('tabindex', '0'); host.setAttribute('role', 'button');
        host.setAttribute('aria-label', 'Zoom: ' + (im.alt || 'photo ' + (i + 1)));
      });
      function openFrom(t) {
        var all = imgs(), host = t.closest('figure') || t, im = host.tagName === 'IMG' ? host : host.querySelector('img');
        var i = all.indexOf(im); if (i < 0) return;
        open(all.map(function (x) { return { src: srcOf(x), alt: x.alt, low: x.currentSrc || x.src }; }), i);
      }
      g.addEventListener('click', function (e) { var t = e.target.closest('figure, img'); if (!t || !g.contains(t) || e.target.closest('a,button')) return; e.preventDefault(); openFrom(t); });
      g.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('figure,img')) { e.preventDefault(); openFrom(e.target); } });
    });
  }

  window.SahraZoom = { open: open, close: close, bind: bindGalleries };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { bindGalleries(); });
  else bindGalleries();
})();
