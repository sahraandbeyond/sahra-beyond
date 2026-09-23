/* Shop mega-menu (18 Sep 2026) — see assets/sahra-nav.css.
   Runs deferred, after each page's own inline mobile-menu builder, so it can
   (1) turn the existing "Shop" link into the trigger with a caret button,
   (2) append a full-width panel to the header, (3) hide Collection / T-Shirts /
   Polo from the desktop bar (they live inside the panel now, per the nav
   decision of 18 Sep), and (4) regroup the phone menu with the same links.
   Data lives here in one place; add a group when Sahel pages exist. */
(function () {
  'use strict';
  /* Belt and braces after the 18 Sep incident: one CDN edge answered 404 for the
     hashed stylesheet URL while the script loaded fine, so the page rendered the
     panel unstyled. If our sheet is present but empty, reload it unhashed. */
  try {
    var lk = document.querySelector('link[href*="/assets/sahra-nav.css"]');
    if (lk && lk.sheet && lk.sheet.cssRules.length === 0) {
      var fb = document.createElement('link'); fb.rel = 'stylesheet';
      fb.href = '/assets/sahra-nav.css?r=' + Date.now(); document.head.appendChild(fb);
    }
  } catch (e) {}
  var link = document.querySelector('.nav-links a[href="/shop/"], .hdr-nav a[href="/shop/"]');
  if (!link || document.querySelector('.sbn-panel')) return;
  var host = link.closest('header.hdr') || link.closest('nav');
  if (!host) return;
  var bar = link.parentNode;

  /* ---- data ---- */
  var GROUPS = [
    { h: 'By type', l: [
      ['/t-shirts/', 'T-shirts', 'Regular & Oversized'],
      ['/polos/', 'Polo', '240 GSM piqué'],
      ['/tote/', 'Accessories', 'The Sahra Tote'],
      ['/gifts/', 'Gifts', ''],
      ['/shop/', 'All products', '', 'sbn-all']
    ]},
    { h: 'By fit', l: [
      ['/shop/?fit=regular', 'Regular fit', 'slim, set shoulder'],
      ['/shop/?fit=oversized', 'Oversized fit', 'dropped shoulder'],
      ['/size-guide/', 'Size guide', '', 'sbn-all']
    ]},
    { h: 'By place', l: [
      ['/shop/?place=al-quaa-desert', 'Al Quaa', 'Abu Dhabi'],
      ['/shop/?place=liwa', 'Liwa · Empty Quarter', 'Abu Dhabi'],
      ['/shop/?place=wadi-naqab', 'Wadi Naqab', 'Ras Al Khaimah'],
      ['/places/', 'All places', '', 'sbn-all']
    ]}
  ];
  var FEAT = { href: '/#collection', img: '/shirts/card/alquaa-model-front.webp', badge: 'Founding Edition',
    title: 'The first run', text: 'Three places, three tees, one polo. Limited first run — when a size goes, it is gone.' };
  var FOOT = ['230 GSM tees · 240 GSM polo · printed collar labels', 'Order by 2 pm UAE time → next working day, free'];

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function row(a) {
    return '<a class="sbn-l' + (a[3] ? ' ' + a[3] : '') + '" href="' + esc(a[0]) + '">' + esc(a[1]) +
      (a[2] ? ' <small>' + esc(a[2]) + '</small>' : '') + '</a>';
  }

  /* ---- desktop: trigger + panel ---- */
  var trig = document.createElement('span');
  trig.className = 'sbn-trig';
  link.parentNode.insertBefore(trig, link);
  trig.appendChild(link);
  var caret = document.createElement('button');
  caret.type = 'button'; caret.className = 'sbn-caret';
  caret.setAttribute('aria-label', 'Open the shop menu');
  caret.setAttribute('aria-expanded', 'false');
  caret.setAttribute('aria-controls', 'sbnPanel');
  caret.innerHTML = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4.5l4 4 4-4"/></svg>';
  trig.appendChild(caret);

  var panel = document.createElement('div');
  panel.className = 'sbn-panel'; panel.id = 'sbnPanel';
  panel.setAttribute('aria-label', 'Shop menu');
  panel.innerHTML = GROUPS.map(function (g) {
    return '<div class="sbn-col"><span class="sbn-h">' + esc(g.h) + '</span>' + g.l.map(row).join('') + '</div>';
  }).join('') +
    '<div class="sbn-col"><span class="sbn-h">Edition</span><a class="sbn-feat" href="' + esc(FEAT.href) + '"' + (FEAT.href.indexOf('/#') === 0 ? ' data-ring-jump' : '') + '>' +
    '<img src="' + esc(FEAT.img) + '" alt="" loading="lazy" width="96" height="120">' +
    '<div><span class="sbn-badge">' + esc(FEAT.badge) + '</span><b>' + esc(FEAT.title) + '</b><span>' + esc(FEAT.text) + '</span></div></a></div>' +
    '<div class="sbn-foot"><span>' + esc(FOOT[0]) + '</span><span>' + esc(FOOT[1]) + '</span></div>';
  var pos = getComputedStyle(host).position;
  if (pos === 'static') host.style.position = 'relative';
  host.appendChild(panel);

  /* links that moved into the panel leave the desktop bar */
  ['/#collection', '/t-shirts/', '/polos/'].forEach(function (h) {
    var a = bar.querySelector('a[href="' + h + '"]');
    if (a) a.classList.add('sbn-hide');
  });

  /* ---- open / close ---- */
  var hoverable = window.matchMedia('(hover:hover) and (min-width:821px)');
  var timer = null, open = false;
  function set(o) {
    open = o; host.classList.toggle('sbn-open', o);
    caret.setAttribute('aria-expanded', o ? 'true' : 'false');
  }
  function later(o, ms) { clearTimeout(timer); timer = setTimeout(function () { set(o); }, ms); }
  [trig, panel].forEach(function (el) {
    el.addEventListener('mouseenter', function () { if (hoverable.matches) later(true, 60); });
    el.addEventListener('mouseleave', function () { if (hoverable.matches) later(false, 160); });
  });
  caret.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); clearTimeout(timer); set(!open); });
  document.addEventListener('click', function (e) { if (open && !host.contains(e.target)) set(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) { set(false); caret.focus(); } });
  panel.addEventListener('focusout', function () {
    setTimeout(function () { if (open && !panel.contains(document.activeElement) && document.activeElement !== caret) set(false); }, 0);
  });
  window.addEventListener('scroll', function () { if (open && !panel.matches(':hover')) set(false); }, { passive: true });
  document.addEventListener('mousemove', function (e) { if (open && hoverable.matches && !host.contains(e.target)) later(false, 160); }, { passive: true });

  /* ---- phone: regroup the slide-down menu built by the page ---- */
  var m = document.getElementById('mobileNav');
  if (m) {
    var keep = m.querySelector('.m-close');
    [].slice.call(m.querySelectorAll('a')).forEach(function (a) { a.parentNode.removeChild(a); });
    var cur = location.pathname.replace(/index\.html$/, '');
    function ma(href, label, sub) {
      var a = document.createElement('a');
      a.href = href; a.textContent = label; if (sub) a.className = 'sbn-sub';
      if (href === cur) a.setAttribute('aria-current', 'page');
      return a;
    }
    function mh(t) { var s = document.createElement('span'); s.className = 'sbn-mh'; s.textContent = t; return s; }
    var frag = document.createDocumentFragment();
    frag.appendChild(mh('Shop'));
    frag.appendChild(ma('/shop/', 'All products'));
    frag.appendChild(ma('/t-shirts/', 'T-shirts', true));
    frag.appendChild(ma('/polos/', 'Polo', true));
    frag.appendChild(ma('/tote/', 'Accessories', true));
    frag.appendChild(ma('/shop/?fit=regular', 'Regular fit', true));
    frag.appendChild(ma('/shop/?fit=oversized', 'Oversized fit', true));
    frag.appendChild(ma('/gifts/', 'Gifts', true));
    frag.appendChild(mh('Places'));
    frag.appendChild(ma('/places/', 'All places'));
    frag.appendChild(ma('/shop/?place=al-quaa-desert', 'Al Quaa', true));
    frag.appendChild(ma('/shop/?place=liwa', 'Liwa · Empty Quarter', true));
    frag.appendChild(ma('/shop/?place=wadi-naqab', 'Wadi Naqab', true));
    frag.appendChild(mh('More'));
    frag.appendChild(ma('/#collection', 'The Founding Edition'));
    frag.appendChild(ma('/size-guide/', 'Size guide'));
    frag.appendChild(ma('/about/', 'About'));
    frag.appendChild(ma('/contact/', 'Contact'));
    m.appendChild(frag);
    if (keep && keep !== m.firstChild) m.insertBefore(keep, m.firstChild);
  }
})();
/* Language switch (23 Sep 2026, CRO review): a visible English / عربي link in
   every header. The target is this page's own counterpart where one exists
   (the hreflang alternate, then /products/<id>/ <-> /ar/products/<id>/),
   otherwise the other language's home. */
(function () {
  'use strict';
  function place() {
    if (document.querySelector('.sbl-lang')) return;
    var html = document.documentElement, ar = (html.getAttribute('lang') || '').slice(0, 2) === 'ar';
    var p = location.pathname || '/', href;
    var alt = document.querySelector('link[rel="alternate"][hreflang="' + (ar ? 'en' : 'ar') + '"]');
    if (alt) { try { href = new URL(alt.href).pathname; } catch (e) {} }
    if (!href) {
      var m = ar ? /^\/ar\/products\/([^\/]+)\/?$/.exec(p) : /^\/products\/([^\/]+)\/?$/.exec(p);
      if (m) href = ar ? '/products/' + m[1] + '/' : '/ar/products/' + m[1] + '/';
      else if (!ar && /^\/shop\/?$/.test(p)) href = '/ar/shop/';
      else if (ar && /^\/ar\/shop\/?$/.test(p)) href = '/shop/';
      else href = ar ? '/' : '/ar/';
    }
    var hdr = document.querySelector('.hdr') || document.getElementById('nav') || document.querySelector('body > nav') || document.querySelector('nav');
    if (!hdr) return;
    function mk(cls) {
      var a = document.createElement('a');
      a.className = 'sbl-lang ' + cls; a.href = href;
      a.setAttribute('hreflang', ar ? 'en' : 'ar'); a.setAttribute('lang', ar ? 'en' : 'ar');
      a.textContent = ar ? 'English' : 'العربية';   /* the same word the /ar/ pages use */
      a.setAttribute('aria-label', ar ? 'Read this page in English' : 'اقرأ بالعربية — Arabic');
      a.addEventListener('click', function () { try { if (window.track) track('language_switch', { to: ar ? 'en' : 'ar', from_path: p }); } catch (e) {} });
      return a;
    }
    /* desktop: the last item of the link row; phone (the row is hidden): beside the cart */
    var row = hdr.querySelector('.nav-links, .hdr-nav');
    var before = hdr.querySelector('#sbCartBtn, #cartBtn, .cart-btn, .sb-cart-btn, .mnav');
    var m = mk(row ? 'sbl-m' : 'sbl-any');
    if (before && before.parentNode) before.parentNode.insertBefore(m, before); else hdr.appendChild(m);
    if (row) row.appendChild(mk('sbl-d'));
  }
  function later() { setTimeout(place, 0); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', later); else later();
})();
