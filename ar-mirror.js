/* ==========================================================================
   ar-mirror.js — the Arabic site, mirrored from the English pages (30 Oct 2026)
   ==========================================================================
   Faheem, 30 Oct 2026: "create Arabic pages for all our site. Have an emirati
   agent review them and make them live immediately."

   HOW IT WORKS
   Every indexable English page (except the three hand-transcreated pages /ar/,
   /ar/about/, /ar/contact/) is mirrored to /ar/<same path>. The page is cut
   into translation units: runs of text and inline markup between block-level
   tags. Each unit's tags are swapped for numbered placeholders (⟦1⟧, ⟦2⟧ ...)
   so translators never touch markup, and the unit is looked up in the
   dictionary content/ar-mirror/*.json (English unit -> Arabic). Attributes a
   reader sees (alt, title, aria-label, placeholder, meta description/og) are
   looked up the same way. A unit with no translation stays English and is
   listed by `node ar-mirror.js extract`, which writes the to-do list to
   content/ar-mirror/_pending.json. So an English copy change shows up as one
   pending line, never as a silently stale Arabic page.

   The mirror also: sets lang="ar" dir="rtl", the canonical/og:url to the
   Arabic URL, og:locale ar_AE; points internal links at their Arabic
   counterparts; loads the Arabic fonts and assets/sahra-rtl.css; declares
   hreflang en/ar/x-default on BOTH pages; and adds the Arabic URLs to
   sitemap.xml. Prices stay as .sb-price spans, which sahra-market.js formats
   in Arabic ("199 درهمًا") on Arabic pages.

   Runs from build.js after the English pages are written and BEFORE the
   site-wide walkers (welcome bar, nav, pixels, asset hashes, WebP, legibility),
   so the Arabic pages get exactly the same treatment as the English ones.
   No dependencies: the HTML is our own generated markup.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SITE = 'https://www.sahraandbeyond.ae';
const DICT_DIR = path.join(ROOT, 'content', 'ar-mirror');

/* pages that have their own hand-transcreated Arabic (reviewed five times, live since 21 Sep) */
const HAND = { '/': '/ar/', '/about/': '/ar/about/', '/contact/': '/ar/contact/' };
const SKIP_DIRS = /^(node_modules|\.git|_backup|_drafts|admin|docs|ar|h|q|classic|api|netlify|tools|uploads|public|content|assets|shirts|fabric-img|logo|video|journey)$/;
const SKIP_FILES = /^(coming-soon|commitment|homepage-preview|shop-preview)\.html$/;

const INLINE = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'img', 'kbd', 'mark', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr']);
const TOKEN = /<!--[\s\S]*?-->|<![^>]*>|<(script|style|svg|noscript|template|textarea|pre)\b[^>]*>[\s\S]*?<\/\1\s*>|<\/?[a-zA-Z][^>]*>|[^<]+|</g;
const LETTERS = /[A-Za-z]{2,}/;
const PRICE_ONLY = /^(AED|USD|SAR|QAR|OMR|BHD|KWD|EUR|GBP)\s?[\d.,]+$/;

/* ---------- dictionary ---------- */
function loadDict() {
  const d = Object.create(null);
  if (!fs.existsSync(DICT_DIR)) return d;
  fs.readdirSync(DICT_DIR).filter(f => /\.json$/.test(f) && !/^_/.test(f)).sort().forEach(f => {
    const o = JSON.parse(fs.readFileSync(path.join(DICT_DIR, f), 'utf8'));
    Object.keys(o).forEach(k => { if (typeof o[k] === 'string' && o[k].trim()) d[k] = o[k]; });
  });
  return d;
}

/* ---------- pages ---------- */
function englishPages() {
  const out = [];
  const walk = (dir, rel) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
      if (e.isDirectory()) { if (!(rel === '' && SKIP_DIRS.test(e.name)) && !/^(node_modules|\.git|_backup)$/.test(e.name)) walk(path.join(dir, e.name), rel + e.name + '/'); return; }
      if (!/\.html$/.test(e.name)) return;
      if (rel === '' && SKIP_FILES.test(e.name)) return;
      const url = '/' + rel + (e.name === 'index.html' ? '' : e.name);
      if (HAND[url]) return;
      if (rel === '' && e.name === 'index.html') return;
      const src = fs.readFileSync(path.join(dir, e.name), 'utf8');
      if (/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(src)) return;
      if (/http-equiv="refresh"/i.test(src)) return;
      out.push({ url, file: path.join(dir, e.name), rel: rel + e.name });
    });
  };
  walk(ROOT, '');
  return out.sort((a, b) => a.url < b.url ? -1 : 1);
}
const arUrl = u => HAND[u] || ('/ar' + u);

/* ---------- units ---------- */
const norm = s => s.replace(/\s+/g, ' ').trim();
function tagName(t) { const m = /^<\/?([a-zA-Z][a-zA-Z0-9-]*)/.exec(t); return m ? m[1].toLowerCase() : ''; }
function isUnitToken(t) {
  if (t[0] !== '<' || t === '<') return 'text';
  if (t.startsWith('<!--')) return null;
  const n = tagName(t);
  if (!n) return null;
  if (/^<(script|style|svg|noscript|template|textarea|pre)\b/i.test(t)) return null;
  return INLINE.has(n) ? 'tag' : null;
}
/* returns {key, lead, trail, tags} or null when the run has nothing to translate */
function unitKey(run) {
  /* markup before the first word and after the last word stays outside the key, so the
     same sentence in a different wrapper is one dictionary entry */
  const isText = t => !(t[0] === '<' && t !== '<');
  let a = 0, b = run.length;
  while (a < b && !(isText(run[a]) && run[a].trim())) a++;
  while (b > a && !(isText(run[b - 1]) && run[b - 1].trim())) b--;
  const pre = run.slice(0, a).join(''), post = run.slice(b).join('');
  const u = unitCore(run.slice(a, b));
  if (!u) return null;
  u.lead = pre + u.lead; u.trail = u.trail + post;
  return u;
}
function unitCore(run) {
  const tags = []; let s = '';
  run.forEach(t => {
    if (t[0] === '<' && t !== '<') { tags.push(t); s += '⟦' + tags.length + '⟧'; }
    else s += t;
  });
  const text = s.replace(/⟦\d+⟧/g, ' ');
  if (!LETTERS.test(text.replace(/&[a-z]+;|&#\d+;/gi, ' '))) return null;
  if (PRICE_ONLY.test(norm(text))) return null;
  const lead = (s.match(/^\s*/) || [''])[0], trail = (s.match(/\s*$/) || [''])[0];
  return { key: norm(s), lead, trail, tags };
}

/* ---------- attributes ---------- */
const ATTRS = /(\s)(alt|title|aria-label|placeholder)="([^"]*)"/g;
const META_TEXT = /^<meta\s+(?:name|property)="(description|og:title|og:description|twitter:title|twitter:description|og:image:alt)"/i;
function attrKeys(tag, add) {
  if (!LETTERS.test(tag)) return;
  tag.replace(ATTRS, (m, sp, a, v) => { if (LETTERS.test(v)) add(norm(v)); return m; });
  if (META_TEXT.test(tag)) { const m = /content="([^"]*)"/.exec(tag); if (m && LETTERS.test(m[1])) add(norm(m[1])); }
}
function attrApply(tag, dict, miss) {
  let t = tag.replace(ATTRS, (m, sp, a, v) => {
    const k = norm(v); if (!LETTERS.test(v)) return m;
    if (dict[k] != null) return `${sp}${a}="${escAttr(dict[k])}"`;
    miss.add(k); return m;
  });
  if (META_TEXT.test(t)) t = t.replace(/content="([^"]*)"/, (m, v) => { const k = norm(v); if (!LETTERS.test(v)) return m; if (dict[k] != null) return `content="${escAttr(dict[k])}"`; miss.add(k); return m; });
  return t;
}
const escAttr = s => String(s).replace(/&(?![a-z]+;|#\d+;)/gi, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ---------- extract: every unit and attribute string on the mirrored pages ---------- */
function extractPage(html, add) {
  const toks = html.match(TOKEN) || [];
  let run = [];
  const flush = () => { if (run.length) { const u = unitKey(run); if (u) add(u.key); } run = []; };
  for (const t of toks) {
    if (t[0] === '<' && t !== '<' && !t.startsWith('<!--') && !/^<(script|style|svg|noscript|template|pre)\b/i.test(t)) attrKeys(t, add);
    const k = isUnitToken(t);
    if (k) run.push(t); else flush();
  }
  flush();
}

/* ---------- translate a unit back into markup ---------- */
function restore(ar, tags) {
  return ar.replace(/⟦(\d+)⟧/g, (m, n) => tags[+n - 1] != null ? tags[+n - 1] : '');
}
function validPlaceholders(key, ar) {
  const a = (key.match(/⟦\d+⟧/g) || []).sort().join(), b = (ar.match(/⟦\d+⟧/g) || []).sort().join();
  return a === b && !/[<>]/.test(ar.replace(/⟦\d+⟧/g, ''));
}

/* ---------- link rewriting ---------- */
function rewriteHref(tag, has) {
  return tag.replace(/(\shref=")(\/[^"#?]*)([^"]*)"/, (m, a, p, rest) => {
    if (/^\/(assets|shirts|uploads|api|ar)\//.test(p) || /\.(webp|jpg|png|svg|pdf|xml|json|css|js)$/.test(p)) return m;
    const u = p === '' ? '/' : p;
    if (has(u)) return `${a}${arUrl(u)}${rest}"`;
    return m;
  });
}

/* ---------- build one Arabic page ---------- */
function mirrorPage(html, page, dict, has, missU, missA, bad) {
  const toks = html.match(TOKEN) || [];
  const out = []; let run = [];
  const flush = () => {
    if (!run.length) return;
    const u = unitKey(run);
    if (!u) { out.push(run.join('')); run = []; return; }
    const ar = dict[u.key];
    if (ar == null) { missU.add(u.key); out.push(run.join('')); }
    else if (!validPlaceholders(u.key, ar)) { bad.add(u.key); out.push(run.join('')); }
    else out.push(u.lead + restore(ar, u.tags) + u.trail);
    run = [];
  };
  for (let t of toks) {
    if (t[0] === '<' && t !== '<' && !t.startsWith('<!--') && !/^<(script|style|svg|noscript|template|pre)\b/i.test(t)) {
      t = attrApply(t, dict, missA);
      if (/^<a\b/i.test(t) || /^<link\b[^>]*rel="(?:prev|next)"/i.test(t)) t = rewriteHref(t, has);
    }
    const k = isUnitToken(t);
    if (k) run.push(t); else { flush(); out.push(t); }
  }
  flush();
  let s = out.join('');
  /* relative URLs ("../../shirts/x.webp") point somewhere else from /ar/..., so resolve them against
     the English page's directory into root-relative paths (in attributes, srcsets, inline scripts and CSS) */
  const segs = page.url.replace(/[^/]*$/, '').split('/').filter(Boolean);
  s = s.replace(/(["'(\s,])((?:\.\.\/)+)(?=[A-Za-z0-9_])/g, (m, pre, ups) => {
    const k = ups.length / 3; if (k > segs.length) return m;
    const base = segs.slice(0, segs.length - k);
    return pre + '/' + (base.length ? base.join('/') + '/' : '');
  });
  const arU = arUrl(page.url), enAbs = SITE + page.url, arAbs = SITE + arU;
  s = s.replace(/<html\b([^>]*)>/i, (m, a) => '<html' + a.replace(/\slang="[^"]*"/i, '').replace(/\sdir="[^"]*"/i, '') + ' lang="ar" dir="rtl" data-ar-mirror>');
  s = s.replace(/<link rel="canonical" href="[^"]*">/i, `<link rel="canonical" href="${arAbs}">`);
  s = s.replace(/<meta property="og:url" content="[^"]*">/i, `<meta property="og:url" content="${arAbs}">`);
  s = s.replace(/<meta property="og:locale" content="[^"]*">/i, '<meta property="og:locale" content="ar_AE">');
  s = s.replace(/<link rel="alternate" hreflang="[^"]*" href="[^"]*">\n?/gi, '');
  const alts = `<link rel="alternate" hreflang="en" href="${enAbs}">\n<link rel="alternate" hreflang="ar" href="${arAbs}">\n<link rel="alternate" hreflang="x-default" href="${enAbs}">\n`;
  const fonts = '<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600&display=swap" rel="stylesheet">\n<link rel="stylesheet" href="/assets/sahra-rtl.css">\n';
  s = s.replace(/<\/head>/i, alts + fonts + '</head>');
  if (!/<meta property="og:locale"/i.test(s)) s = s.replace(/(<meta property="og:url" content="[^"]*">)/i, '$1\n<meta property="og:locale" content="ar_AE">');
  /* JSON-LD (QA S10, 30 Oct 2026): the page's structured data speaks Arabic too - see ldArabic() */
  s = s.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/gi, (m, a, body, c) => a + ldArabic(body, page, dict, has) + c);
  s = s.split(`"url":"${enAbs}"`).join(`"url":"${arAbs}"`);
  /* scripts that need to know which way the page reads (QA S6) */
  (SCRIPT_PATCHES[page.url] || []).forEach(([from, to]) => {
    if (s.indexOf(from) === -1) { console.warn(`  ! ar-mirror: RTL script patch for ${page.url} no longer matches: ${from.slice(0, 60)}`); return; }
    s = s.split(from).join(to);
  });
  /* the footer's language link: on the Arabic page it leads back to this page in English */
  s = s.split('<a href="/ar/" hreflang="ar" lang="ar">العربية</a>').join(`<a href="${page.url}" hreflang="en" lang="en">English</a>`);
  return s;
}

/* ---------- JSON-LD in Arabic (QA S10) ----------
   Each JSON-LD block is parsed and walked. String fields a reader or a search engine shows
   (name, description, headline, FAQ text, colour, material) take the dictionary's Arabic when the
   dictionary has that exact string (entities decoded, whitespace normalised; the runtime UI
   dictionary is a fallback for product names). URLs, prices, SKUs, IDs and dates are untouched,
   except url/item fields that point at an English page with an Arabic version, which follow the
   page to /ar/. The brand, organisation, website and reviewer entities keep their own names and
   URLs, and reviews keep their original language. inLanguage "ar" goes on the page-level
   CreativeWork objects (WebPage family, Article), the types schema.org defines it for. */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', rarr: '→', larr: '←', rsaquo: '›', lsaquo: '‹', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', times: '×', deg: '°', copy: '©', prime: '′', Prime: '″', minus: '−' };
const decodeEnt = s => String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e] != null ? ENT[e] : m));
let LD_INDEX = null;
function ldIndex(dict) {
  if (LD_INDEX && LD_INDEX.dict === dict) return LD_INDEX.map;
  const map = Object.create(null);
  const put = (k, v) => { if (!k || /⟦/.test(k) || /⟦/.test(v)) return; const dk = norm(decodeEnt(k)); if (map[dk] == null) map[dk] = norm(decodeEnt(v)); };
  try { const ui = JSON.parse(fs.readFileSync(path.join(DICT_DIR, 'ui.json'), 'utf8')).exact || {}; Object.keys(ui).forEach(k => { if (k[0] !== '@') put(k, ui[k]); }); } catch (e) {}
  Object.keys(dict).forEach(k => { const dk = norm(decodeEnt(k)); map[dk] = norm(decodeEnt(dict[k])); });
  LD_INDEX = { dict, map };
  return map;
}
const LD_TEXT = new Set(['name', 'description', 'headline', 'alternativeHeadline', 'text', 'caption', 'color', 'material', 'abstract']);
const LD_KEEP = /^(Brand|Organization|Corporation|OnlineStore|WebSite|Person|Review|Rating|AggregateRating)$/;
const LD_LANG = /^(WebPage|CollectionPage|FAQPage|AboutPage|ContactPage|ItemPage|Article|BlogPosting|NewsArticle|HowTo)$/;
function ldArabic(body, page, dict, has) {
  let data; try { data = JSON.parse(body); } catch (e) { return body; }
  const map = ldIndex(dict);
  const tr = s => { const k = norm(String(s)); return map[k] != null ? map[k] : null; };
  const arLink = v => {
    if (typeof v !== 'string' || v.indexOf(SITE + '/') !== 0) return v;
    const m = /^([^?#]*)([\s\S]*)$/.exec(v.slice(SITE.length)), p = m[1] || '/';
    if (/^\/(ar|assets|shirts|uploads|api)\//.test(p) || /\.(webp|jpg|jpeg|png|svg|pdf|xml|json|css|js)$/i.test(p)) return v;
    if (!has(p)) return v;
    return SITE + arUrl(p.slice(-1) === '/' || /\.html$/.test(p) ? p : p + '/') + m[2];
  };
  const walk = (o, top) => {
    if (Array.isArray(o)) { o.forEach(v => walk(v, top)); return; }
    if (!o || typeof o !== 'object') return;
    const t = String(o['@type'] || '');
    if (LD_KEEP.test(t)) return;
    if (top && LD_LANG.test(t) && o.inLanguage == null) o.inLanguage = 'ar';
    Object.keys(o).forEach(k => {
      const v = o[k];
      if (typeof v === 'string') {
        if (LD_TEXT.has(k)) { const a = tr(v); if (a != null) o[k] = a; }
        else if (k === 'url' || k === 'item') o[k] = arLink(v);
      } else walk(v, false);
    });
  };
  if (Array.isArray(data)) data.forEach(v => walk(v, true)); else walk(data, true);
  return JSON.stringify(data).replace(/<\//g, '<\\/');
}

/* ---------- scripts that assume left-to-right (QA S6, 30 Oct 2026) ----------
   The shop's coverflow ring places card k at x = sin(angle) * R, so the next design waits on the
   right and "next" sits at the right. Mirrored here (and only on the Arabic copy): the ring runs
   right-to-left, drag and fling follow the finger and the arrow keys swap; sahra-rtl.css moves the
   buttons to the other side. The glyphs need no change: ‹ and › are bidi-mirrored characters, so
   in a right-to-left page each already points outwards from the side it now sits on. The product
   slideshow on the cards cross-fades, so only its buttons swap sides. */
const SCRIPT_PATCHES = {
  '/shop/': [
    ['x:Math.sin(a)*R,z:Math.cos(a)*R-R,rotateY:Math.sin(a)*22', 'x:-Math.sin(a)*R,z:Math.cos(a)*R-R,rotateY:-Math.sin(a)*22'],
    ["if(e.key==='ArrowLeft'){e.preventDefault();step(1,'key');} else if(e.key==='ArrowRight'){e.preventDefault();step(-1,'key');}", "if(e.key==='ArrowRight'){e.preventDefault();step(1,'key');} else if(e.key==='ArrowLeft'){e.preventDefault();step(-1,'key');}"],
    ['S.a=drag.a+dx/stepPx*stepA;', 'S.a=drag.a-dx/stepPx*stepA;'],
    ['fling=Math.abs(vel)>0.35?vel*260/stepPx*stepA:0', 'fling=Math.abs(vel)>0.35?-vel*260/stepPx*stepA:0']
  ]
};

function addHreflangToEnglish(file, page) {
  let src = fs.readFileSync(file, 'utf8');
  /* the footer's العربية link goes to this page's own Arabic version, not the Arabic home */
  const lk = '<a href="/ar/" hreflang="ar" lang="ar">العربية</a>', lk2 = `<a href="${arUrl(page.url)}" hreflang="ar" lang="ar">العربية</a>`;
  if (src.indexOf(lk) !== -1) { src = src.split(lk).join(lk2); fs.writeFileSync(file, src); }
  if (/rel="alternate" hreflang="ar"/i.test(src.split(/<\/head>/i)[0])) return false;
  const enAbs = SITE + page.url, arAbs = SITE + arUrl(page.url);
  src = src.replace(/<link rel="alternate" hreflang="[^"]*" href="[^"]*">\n?/gi, '');
  src = src.replace(/<\/head>/i, `<link rel="alternate" hreflang="en" href="${enAbs}">\n<link rel="alternate" hreflang="ar" href="${arAbs}">\n<link rel="alternate" hreflang="x-default" href="${enAbs}">\n</head>`);
  fs.writeFileSync(file, src);
  return true;
}

function addToSitemap(urls) {
  const f = path.join(ROOT, 'sitemap.xml');
  if (!fs.existsSync(f)) return 0;
  let x = fs.readFileSync(f, 'utf8'); let n = 0;
  const today = new Date().toISOString().slice(0, 10);
  const add = urls.filter(u => x.indexOf(`<loc>${SITE}${u}</loc>`) === -1).map(u => { n++; return `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod><priority>0.5</priority></url>`; });
  if (add.length) x = x.replace(/<\/urlset>/, add.join('\n') + '\n</urlset>');
  fs.writeFileSync(f, x);
  return n;
}


/* ---------- runtime layer for text that JavaScript writes (menus, footer, bag, widgets) ---------- */
const UI_JS = (ui, links) => `/* sahra-ar-ui.js — GENERATED by ar-mirror.js from content/ar-mirror/ui.json. Do not edit by hand.
   On Arabic pages, swaps the English strings that scripts write into the page (menu, footer, currency
   picker, packing list, sky widget, quick add) for their Arabic. Exact strings first, then patterns.
   It also keeps the reader on the Arabic site: a link that a script writes to an English page which
   has an Arabic version (top bar, shop cards, places map, bag) is pointed at the /ar/ page. The list
   of those pages (L) is written at build time. Language-switch links (hreflang) are left alone. */
(function () {
  if (!/^ar/i.test(document.documentElement.getAttribute('lang') || '')) return;
  var E = ${JSON.stringify(ui.exact || {})};
  var P = ${JSON.stringify(ui.patterns || [])}.map(function (p) { return [new RegExp(p[0]), p[1]]; });
  var L = ${JSON.stringify(links || {})};
  function link(el) {
    if (!el.getAttribute || el.hasAttribute('hreflang') || (el.closest && el.closest('[data-no-ar]'))) return;
    var h = el.getAttribute('href');
    if (!h || h.charAt(0) !== '/' || h.charAt(1) === '/') return;
    var m = /^([^?#]*)([\\s\\S]*)$/.exec(h), p = m[1];
    if (/^\\/ar(\\/|$)/.test(p)) return;
    var t = L[p] || (p.slice(-1) !== '/' ? L[p + '/'] : null);
    if (t) el.setAttribute('href', t + m[2]);
  }
  var SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|CODE)$/;
  function tr(s, at) {
    var k = (at ? '@' : '') + s.replace(/\\s+/g, ' ').trim();
    if (!k || !/[A-Za-z]{2,}/.test(k)) return null;
    if (E[k] != null) return E[k];
    for (var i = 0; i < P.length; i++) if (P[i][0].test(k)) return k.replace(P[i][0], P[i][1]).replace(/^@/, '');
    return null;
  }
  function text(n) {
    var p = n.parentNode; if (!p || p.nodeType !== 1 || SKIP.test(p.nodeName)) return;
    if (p.closest && p.closest('.brand,.brand-text,.wordmark,.logo,[data-no-ar]')) return;
    var v = n.nodeValue, t = tr(v);
    if (t != null) { var m = v.match(/^\\s*/)[0], e = v.match(/\\s*$/)[0]; n.nodeValue = m + t + e; }
  }
  function attrs(el) {
    if (el.nodeName === 'A' || el.nodeName === 'a') link(el);
    ['aria-label', 'placeholder', 'title', 'alt'].forEach(function (a) {
      var v = el.getAttribute && el.getAttribute(a); if (!v) return;
      var t = tr(v, true); if (t != null) el.setAttribute(a, t);
    });
  }
  function walk(root) {
    if (root.nodeType === 3) { text(root); return; }
    if (root.nodeType !== 1 || SKIP.test(root.nodeName)) return;
    attrs(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) text(n); else attrs(n); }
  }
  function start() {
    walk(document.body);
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        if (m.type === 'characterData') text(m.target);
        else if (m.type === 'attributes') attrs(m.target);
        else m.addedNodes.forEach(walk);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'placeholder', 'title', 'alt', 'href'] });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
`;
function writeUiRuntime(links) {
  const f = path.join(DICT_DIR, 'ui.json');
  const ui = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : { exact: {}, patterns: [] };
  fs.writeFileSync(path.join(ROOT, 'assets', 'sahra-ar-ui.js'), UI_JS(ui, links));
  return Object.keys(ui.exact || {}).length + (ui.patterns || []).length;
}
const UI_TAG = '<script src="/assets/sahra-ar-ui.js" defer></script>';
function addUiTag(file) {
  let s = fs.readFileSync(file, 'utf8');
  if (s.indexOf('/assets/sahra-ar-ui.js') !== -1) return false;
  s = s.replace(/<\/head>/i, UI_TAG + '\n</head>');
  fs.writeFileSync(file, s); return true;
}

/* ---------- entry points ---------- */
function build({ quiet } = {}) {
  const dict = loadDict();
  const pages = englishPages();
  const set = new Set(pages.map(p => p.url).concat(Object.keys(HAND)));
  const has = u => set.has(u) || set.has(u.replace(/\/?$/, '/'));
  const missU = new Set(), missA = new Set(), bad = new Set();
  let n = 0, h = 0;
  pages.forEach(p => {
    const html = fs.readFileSync(p.file, 'utf8');
    const ar = mirrorPage(html, p, dict, has, missU, missA, bad);
    const dest = path.join(ROOT, 'ar', p.rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, ar); n++;
    if (addHreflangToEnglish(p.file, p)) h++;
  });
  const sm = addToSitemap(pages.map(p => arUrl(p.url)));
  /* the hand-transcreated pages (/ar/, /ar/about/, /ar/contact/) keep their copy, but their links now
     have Arabic pages to go to */
  Object.values(HAND).forEach(u => {
    const f = path.join(ROOT, u.replace(/^\//, ''), 'index.html');
    if (!fs.existsSync(f)) return;
    const src = fs.readFileSync(f, 'utf8');
    let out = src.replace(/<a\b[^>]*>/gi, t => rewriteHref(t, has));
    /* they carry the 21 Sep RTL rules inline; the shared layer adds the 30 Oct QA fixes (tracking,
       header order, footer direction) so all Arabic pages behave the same */
    if (out.indexOf('/assets/sahra-rtl.css') === -1) out = out.replace(/<\/head>/i, '<link rel="stylesheet" href="/assets/sahra-rtl.css">\n</head>');
    if (out !== src) fs.writeFileSync(f, out);
  });
  const links = {};
  [...set].sort().forEach(u => { links[u] = arUrl(u); });
  const uiN = writeUiRuntime(links);
  /* every Arabic page, the hand-transcreated ones included, gets the runtime layer */
  let tagged = 0;
  (function walk(d) { fs.readdirSync(d, { withFileTypes: true }).forEach(e => { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/\.html$/.test(e.name) && addUiTag(f)) tagged++; }); })(path.join(ROOT, 'ar'));
  if (!quiet) console.log(`  ✓ Arabic mirror: ${n} page(s), ${Object.keys(dict).length} dictionary entries; untranslated: ${missU.size} unit(s), ${missA.size} attribute(s)${bad.size ? `, ${bad.size} rejected (placeholder mismatch)` : ''}; hreflang added to ${h} English page(s); ${sm} sitemap url(s) added; UI layer ${uiN} string(s) on ${tagged} page(s)`);
  return { pages: n, missU: [...missU], missA: [...missA], bad: [...bad] };
}

function extract() {
  const dict = loadDict();
  const keys = new Set();
  englishPages().forEach(p => extractPage(fs.readFileSync(p.file, 'utf8'), k => keys.add(k)));
  const pending = [...keys].filter(k => dict[k] == null || !validPlaceholders(k, dict[k]));
  fs.mkdirSync(DICT_DIR, { recursive: true });
  fs.writeFileSync(path.join(DICT_DIR, '_pending.json'), JSON.stringify(pending, null, 1));
  const words = pending.reduce((a, k) => a + k.replace(/⟦\d+⟧/g, ' ').split(/\s+/).filter(Boolean).length, 0);
  console.log(`pages ${englishPages().length}; unique strings ${keys.size}; pending ${pending.length} (${words} words) -> content/ar-mirror/_pending.json`);
}

module.exports = { build, extract, englishPages, arUrl };
if (require.main === module) {
  if (process.argv[2] === 'extract') extract();
  else if (process.argv[2] === 'list') englishPages().forEach(p => console.log(p.url));
}
