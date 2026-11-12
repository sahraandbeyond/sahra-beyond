/* ==========================================================================
   ar-reviews.js — Arabic for the parts of a page that come from Judge.me reviews
   ==========================================================================
   12 Nov 2026 (Faheem: "Why does judge me review sync keep failing"). The twice-daily review sync
   (.github/workflows/sync-reviews.yml) publishes on its own, with nobody there to translate. Since the
   Arabic parity rule of 31 Oct 2026, every new review put a dozen English strings on the site with no
   Arabic in content/ar-mirror, so the pre-push check stopped the job: two reviews of 11 Nov never
   went live. Faheem chose: "As written, automatic". Arabic pages show each review in the language
   the buyer wrote it, and the counts and labels around it are written by rule.

   HOW
   reviews-render.js and preorder-page.js mark every review-driven element with
   data-ar-rule="kind|arg|arg". ar-mirror.js lifts those elements out of the page before it cuts
   translation units, so they never become dictionary keys, and calls apply() here to write the
   Arabic. A label looks in the dictionary first (the wording an Emirati reader approved for the
   labels that were already live stays exactly as it was) and only then is written by rule. The
   buyer's own words are never translated: Faheem, 12 Nov 2026, "Show all as written".

   The wording follows the reviewed dictionary entries: "من 19 تقييمًا", "من 7 تقييمات",
   "من تقييمين", "7 مشترين موثّقين", "مشترٍ موثّق", "القطعة: …", "القطعة المشتراة: …",
   "كل التقييمات الـ19", "صورة من عميل: …".
   ========================================================================== */
'use strict';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const norm = s => String(s).replace(/\s+/g, ' ').trim();

/* Arabic number agreement for a counted noun: one, two (dual), 3 to 10 (plural), 11 to 99 (singular
   accusative), and round hundreds (singular genitive). `gen` is the form after a preposition. */
function counted(n, f, gen) {
  n = Number(n) || 0;
  const m = n % 100;
  if (n === 1) return f.one;
  if (n === 2) return gen ? f.twoGen : f.two;
  if (m >= 3 && m <= 10) return `${n} ${f.few}`;
  if (m >= 11) return `${n} ${f.many}`;
  return `${n} ${f.hundred}`;
}
const REVIEW = { one: 'تقييم واحد', two: 'تقييمان', twoGen: 'تقييمين', few: 'تقييمات', many: 'تقييمًا', hundred: 'تقييم' };
const BUYER = { one: 'مشترٍ موثّق واحد', two: 'مشتريان موثّقان', twoGen: 'مشتريَين موثّقَين', few: 'مشترين موثّقين', many: 'مشتريًا موثّقًا', hundred: 'مشترٍ موثّق' };
const reviews = (n, gen) => counted(n, REVIEW, gen);
const buyers = n => counted(n, BUYER, false);
const VERIFIED = 'مشترٍ موثّق';

function month(ym) {
  const m = /^(\d{4})-(\d{2})/.exec(String(ym || ''));
  return m && MONTHS[+m[2] - 1] ? `${MONTHS[+m[2] - 1]} ${m[1]}` : '';
}
/* "November 2026" in a rendered line, when the rule was not given the date */
function monthFromText(s) {
  const m = new RegExp('\\b(' + EN_MONTHS.join('|') + ') (\\d{4})\\b').exec(String(s));
  return m ? `${MONTHS[EN_MONTHS.indexOf(m[1])]} ${m[2]}` : '';
}

/* T = { dict, ui } : the mirror's dictionary, and the runtime UI dictionary as a fallback for product names */
function arName(en, T) {
  const k = norm(en).replace(/&#124;/g, '|');   /* a bar in a name is written &#124; in the marker, where "|" separates the arguments */
  if (!k) return '';
  if (T.dict[k] != null) return T.dict[k];
  /* the same name as the page's own heading writes it: "Khor Fakkan Bay Tee &mdash; Regular" */
  const alt = [k.replace(/ — /g, ' &mdash; '), k.replace(/&(?![a-z#0-9]+;)/gi, '&amp;'), k.replace(/&(?![a-z#0-9]+;)/gi, '&amp;').replace(/ — /g, ' &mdash; ')].find(x => T.dict[x] != null);
  if (alt) return T.dict[alt];
  const amp = k.replace(/&amp;/g, '&');
  if (T.ui && T.ui[amp] != null) return String(T.ui[amp]).replace(/&(?![a-z#0-9]+;)/gi, '&amp;');
  return k;
}
const setAttr = (open, name, val) => {
  const v = String(val).replace(/"/g, '&quot;');
  const re = new RegExp('(\\s)' + name + '="[^"]*"');
  /* function replacements: a "$" in a product title or a name is text, never a replacement pattern */
  return re.test(open) ? open.replace(re, (m, sp) => `${sp}${name}="${v}"`) : open.replace(/\s*\/?>$/, m => ` ${name}="${v}"${m.trim() === '/>' ? ' />' : '>'}`);
};
const plain = s => !/</.test(s);
/* a buyer with no name is shown as "Verified buyer", and Judge.me's own word for a hidden name is "Anonymous" */
const who = n => /^verified( buyer)?$/i.test(n) ? VERIFIED : /^anonymous$/i.test(n) ? 'مجهول' : n;

const RULES = {
  /* words a buyer wrote. Faheem, 12 Nov 2026: "Show all as written". Every review, old and new, reads on the
     Arabic pages in the language its buyer wrote it; dir="auto" lets each one run in its own direction.
     The Arabic translations made earlier for the first 19 reviews stay in content/ar-mirror, unused. */
  ugc(a, el) {
    return { open: /\sdir="/.test(el.open) ? el.open : setAttr(el.open, 'dir', 'auto') };
  },
  /* product card: stars and "5.0 · 2 reviews" */
  'rv-card'(a, el) {
    return { inner: el.inner.replace(/(<span class="pcard-rv-n">)[^<]*(<\/span>)/, `$1${a[0]} · ${reviews(a[1])}$2`) };
  },
  /* "from 20 reviews · 18 verified buyers" */
  'rv-from'(a) {
    return { inner: `من ${reviews(a[0], true)}${+a[1] ? ` &middot; ${buyers(a[1])}` : ''}` };
  },
  /* "Name · Verified buyer · November 2026" */
  'rv-meta'(a, el) {
    const name = who(norm(el.inner).split(' · ')[0]);
    const when = month(a[1]) || monthFromText(el.inner);
    return { inner: `${name}${a[0] === '1' && name !== VERIFIED ? ' · ' + VERIFIED : ''}${when ? ' · ' + when : ''}` };
  },
  /* under a short quote: "Name · verified buyer" */
  'rv-by'(a, el) {
    const name = who(norm(el.inner).split(' · ')[0]);
    return { inner: `${name}${a[0] === '1' && name !== VERIFIED ? ' · ' + VERIFIED : ''}` };
  },
  /* "See it on <piece> →" */
  'rv-see'(a, el, T) { return { inner: a[0] ? `القطعة: ${arName(a[0], T)} &larr;` : 'صفحة القطعة &larr;' }; },
  'rv-read'() { return { inner: 'اقرأ التقييم كاملًا &larr;' }; },
  /* "Bought: <piece>" */
  'rv-bought'(a, el, T) { return { inner: `القطعة المشتراة: ${a[0] ? arName(a[0], T) : 'قطعة من الإصدار التأسيسي'}` }; },
  /* "On <piece>" above a review of another fit or piece */
  'rv-on'(a, el, T) { return { inner: `عن ${arName(a[0], T)}` }; },
  /* "5.0 · 2 reviews of this design" under a Sahel or Sahra Trail piece's name */
  'rv-design'(a) { return { inner: `${a[0]} &middot; ${reviews(a[1])} لهذا التصميم` }; },
  /* "All 20 reviews →" */
  'rv-all'(a) { return { inner: `كل التقييمات الـ${a[0]} &larr;` }; },
  /* "5.0 from 20 customer reviews of our Founding Edition" */
  'rv-founding'(a) { return { inner: `${a[0]} من ${reviews(a[1], true)} من عملاء الإصدار التأسيسي` }; },
  /* the line beside the price: full label, short label and its spoken label */
  'rv-line'(a) {
    const [scope, avg, n] = a;
    const full = scope === 'design' ? `${avg} &middot; ${reviews(n)} لهذا التصميم &larr;` : `${avg} &middot; ${reviews(n)} على كل قطع صحراء وما بعدها &larr;`;
    const short = scope === 'design' ? `${avg} (${n})` : `${avg} · ${n} على كل القطع`;
    const aria = `${avg} من 5، ${reviews(n)}${scope === 'design' ? '' : ' على كل القطع'}`;
    return { inner: `<span class="rl-f">${full}</span><span class="rl-s" aria-label="${aria}">${short}</span>` };
  },
  /* a customer photo's description */
  'rv-alt'(a, el, T) {
    const old = norm((/\salt="([^"]*)"/.exec(el.open) || [])[1] || '');
    if (old && T.dict[old] != null) return { open: setAttr(el.open, 'alt', T.dict[old]) };
    return { open: setAttr(el.open, 'alt', a[0] ? `صورة من عميل: ${arName(a[0], T).replace(/&amp;/g, '&')}` : 'صورة العميل') };
  },
  /* our reply under a review: as we wrote it, like the review above it */
  'rv-reply'(a, el) {
    return { open: /\sdir="/.test(el.open) ? el.open : setAttr(el.open, 'dir', 'auto') };
  },
  /* "How it fits — 6 buyers of this design" and its three rows */
  'fit-h'(a) { return { inner: `كيف يأتي المقاس &mdash; بحسب ${counted(a[0], { one: 'مشترٍ واحد', two: 'مشتريان', twoGen: 'مشتريَين', few: 'مشترين', many: 'مشتريًا', hundred: 'مشترٍ' }, true)} لهذا التصميم` }; },
  'fit-l'(a) { return { inner: { small: 'أصغر من المتوقع', true: 'كما هو متوقع', large: 'أكبر من المتوقع' }[a[0]] || '' }; }
};

/* el = { open, inner, close, tag }. Returns the element as it reads on the Arabic page. */
function apply(el, T) {
  const m = /\sdata-ar-rule="([^"]*)"/.exec(el.open);
  const parts = m ? m[1].split('|') : [];
  const rule = RULES[parts[0]];
  if (!rule) return el.open + el.inner + el.close;
  /* the reviewed wording first: an element whose whole text is a dictionary entry keeps that entry */
  const k = norm(el.inner);
  let r;
  if (parts[0] !== 'ugc' && k && plain(el.inner) && T.dict[k] != null && !/[<>]/.test(T.dict[k])) r = { inner: T.dict[k] };
  else r = rule(parts.slice(1), el, T) || {};
  return (r.open != null ? r.open : el.open) + (r.inner != null ? r.inner : el.inner) + el.close;
}

module.exports = { apply, reviews, buyers, month, RULES };
