/* Size finder (25 Sep 2026, Faheem after the persona review: "Size helper").
   For people buying for someone else, who can't measure a shirt: height + build in,
   a suggested starting size out, worked from THIS chart's garment chest figures.

   Method, written down so nobody has to reverse-engineer it:
   - estimated body chest (cm, circumference) = 0.36 x height + 36, then
     slim -6 / average 0 / broad +7. A deliberately plain rule of thumb from
     typical adult proportions; it is a starting point, and the copy says so.
   - the garment must be at least body chest + ease: Regular (straight cut) 6 cm,
     Oversized (drop shoulder, roomy by design) 18 cm.
   - the answer is the smallest size whose garment chest (2 x the flat
     pit-to-pit figure in the chart) clears that. Past XL, it says XL may be snug.
   Markup: <div class="sfind" data-sizefinder data-fit="regular|oversized|choose"
            data-chart='{"regular":[["S",48.3],...],"oversized":[...]}'></div>
   On a product page the result offers a button that picks that size in the buy box. */
(function () {
  'use strict';
  var EASE = { regular: 6, oversized: 18 };
  /* Arabic pages (QA B1, 30 Oct 2026): the finder writes its own Arabic, because its strings carry
     numbers and units. Ranges read "من 150 إلى 155 سم" so the digits never reorder; the feet and
     inches sit in an isolate (U+2066..U+2069) so the primes stay with their numbers. */
  var AR = /^ar/i.test(document.documentElement.getAttribute('lang') || '');
  function iso(x) { return '\u2066' + x + '\u2069'; }
  var TX = AR ? {
    height: 'الطول', build: 'البنية', fit: 'القصّة', regular: 'ريجولر', oversized: 'أوفرسايز',
    slim: 'نحيف', average: 'متوسط', broad: 'عريض',
    head: 'تشتري لشخص آخر؟ <b>اعرف مقاسك حسب الطول</b>',
    fine: 'نقطة بداية مبنية على قياسات الصدر المعتادة لهذا الطول وهذه البنية. إن أمكن، قِس قميصًا يناسبك جيدًا وقارنه بالجدول.',
    under: function (h) { return 'أقل من ' + h + ' سم (' + iso(inch(h)) + ')'; },
    over: function (h) { return 'أكثر من ' + h + ' سم (' + iso(inch(h)) + ')'; },
    range: function (a, b) { return 'من ' + a + ' إلى ' + b + ' سم (' + iso(inch(a) + '–' + inch(b)) + ')'; },
    tryIt: function (s, cm, inc) { return 'جرّب المقاس <b>' + s + '</b> &middot; عرض الصدر ' + cm + ' سم (' + inc + ' بوصة) والقطعة مسطّحة.'; },
    largest: function (s, cm) { return 'أكبر مقاس لدينا <b>' + s + '</b> (عرض الصدر ' + cm + ' سم والقطعة مسطّحة) وقد يكون ضيقًا عليك. راجع الجدول، أو راسلنا على واتساب.'; },
    pick: function (s) { return 'اختر ' + s; },
    gone: function (s) { return 'نفدت الكمية من المقاس ' + s + ' في هذا التصميم.'; }
  } : {
    height: 'Height', build: 'Build', fit: 'Fit', regular: 'Regular', oversized: 'Oversized',
    slim: 'Slim', average: 'Average', broad: 'Broad',
    head: 'Buying for someone else? <b>Find a size by height</b>',
    fine: 'A starting point from typical chest sizes for that height and build. If you can, measure a shirt that fits well and match it to the chart.',
    under: function (h) { return 'Under ' + h + ' cm (' + inch(h) + ')'; },
    over: function (h) { return 'Over ' + h + ' cm (' + inch(h) + ')'; },
    range: function (a, b) { return a + '–' + b + ' cm (' + inch(a) + '–' + inch(b) + ')'; },
    tryIt: function (s, cm, inc) { return 'Try <b>' + s + '</b> &middot; ' + cm + ' cm (' + inc + '″) across the chest, flat.'; },
    largest: function (s, cm) { return 'Our largest is <b>' + s + '</b> (' + cm + ' cm across the chest, flat) and may be snug. Check the chart, or message us on WhatsApp.'; },
    pick: function (s) { return 'Select ' + s; },
    gone: function (s) { return s + ' is sold out in this design.'; }
  };
  var BUILD = { slim: -6, average: 0, broad: 7 };
  function inch(cm) { var i = Math.round(cm / 2.54); return Math.floor(i / 12) + '′' + (i % 12) + '″'; }
  function heights() {
    var o = '<option value="">' + TX.height + '</option>';
    o += '<option value="147">' + TX.under(150) + '</option>';
    for (var h = 150; h < 200; h += 5) o += '<option value="' + (h + 2.5) + '">' + TX.range(h, h + 5) + '</option>';
    o += '<option value="202">' + TX.over(200) + '</option>';
    return o;
  }
  function suggest(chart, fit, h, b) {
    var body = 0.36 * h + 36 + (BUILD[b] || 0), need = body + (EASE[fit] || 6);
    for (var i = 0; i < chart.length; i++) if (chart[i][1] * 2 >= need) return { size: chart[i][0], flat: chart[i][1], over: false };
    var last = chart[chart.length - 1];
    return { size: last[0], flat: last[1], over: true };
  }
  function init(el) {
    if (el.__sf) return; el.__sf = 1;
    var chart; try { chart = JSON.parse(el.getAttribute('data-chart')); } catch (e) { return; }
    var fixed = el.getAttribute('data-fit'), uid = 'sf' + Math.random().toString(36).slice(2, 7);
    var fitSel = fixed === 'choose'
      ? '<label class="sf-l" for="' + uid + 'f">' + TX.fit + '</label><select id="' + uid + 'f" class="sf-s"><option value="regular">' + TX.regular + '</option><option value="oversized">' + TX.oversized + '</option></select>'
      : '';
    el.innerHTML =
      '<p class="sf-h">' + TX.head + '</p>' +
      '<div class="sf-row">' + fitSel +
        '<label class="sf-l" for="' + uid + 'h">' + TX.height + '</label><select id="' + uid + 'h" class="sf-s">' + heights() + '</select>' +
        '<label class="sf-l" for="' + uid + 'b">' + TX.build + '</label><select id="' + uid + 'b" class="sf-s"><option value="">' + TX.build + '</option><option value="slim">' + TX.slim + '</option><option value="average">' + TX.average + '</option><option value="broad">' + TX.broad + '</option></select>' +
      '</div>' +
      '<p class="sf-out" id="' + uid + 'o" role="status" aria-live="polite"></p>' +
      '<p class="sf-fine">' + TX.fine + '</p>';
    var hS = document.getElementById(uid + 'h'), bS = document.getElementById(uid + 'b'), fS = document.getElementById(uid + 'f'), out = document.getElementById(uid + 'o');
    function run() {
      var h = parseFloat(hS.value), b = bS.value;
      if (!h || !b) { out.innerHTML = ''; return; }
      var fit = fS ? fS.value : fixed, c = chart[fit] || chart.regular;
      var r = suggest(c, fit, h, b);
      var html = TX.tryIt(r.size, r.flat, Math.round(r.flat / 2.54 * 2) / 2);
      if (r.over) html = TX.largest(r.size, r.flat);
      out.innerHTML = html;
      var sizes = document.getElementById('pdpSizes');
      if (sizes && !r.over) {
        var chip = [].filter.call(sizes.querySelectorAll('.pdp-size'), function (x) { return x.firstChild && x.firstChild.nodeValue === r.size; })[0];
        if (chip && !chip.disabled) {
          var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'sf-pick'; btn.textContent = TX.pick(r.size);
          btn.addEventListener('click', function () { chip.click(); var buy = document.getElementById('pdpBuy') || sizes; try { buy.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { buy.scrollIntoView(); } });
          out.appendChild(document.createTextNode(' ')); out.appendChild(btn);
        } else if (chip && chip.disabled) {
          out.insertAdjacentHTML('beforeend', ' <span class="sf-so">' + TX.gone(r.size) + '</span>');
        }
      }
      try { if (window.track) track('size_finder', { fit: fit, build: b, size: r.size, over: r.over }); } catch (e) {}
    }
    [hS, bS, fS].forEach(function (s) { if (s) s.addEventListener('change', run); });
  }
  var CSS = '.sfind{margin:14px 0 18px;padding:14px 16px 12px;border:1px solid rgba(42,32,22,.18);border-radius:12px;background:rgba(255,255,255,.6);color:#2A2016}' +
    '.sf-h{margin:0 0 10px!important;font-size:15px!important;line-height:1.4!important;color:#2A2016!important}.sf-h b{font-weight:600}' +
    '.sf-row{display:flex;flex-wrap:wrap;gap:8px}.sf-l{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}' +
    '.sf-s{flex:1 1 140px;min-height:44px;padding:0 10px;border:1px solid rgba(42,32,22,.35);border-radius:8px;background:#fff;color:#2A2016;font:15px Jost,system-ui,sans-serif}' +
    '.sf-out{margin:10px 0 0!important;font-size:15px!important;line-height:1.5!important;color:#2A2016!important;min-height:0}.sf-out:empty{display:none}' +
    '.sf-pick{margin-left:4px;min-height:40px;padding:0 14px;border:0;border-radius:6px;background:#2B2520;color:#FAF6EF;font:600 13px Jost,system-ui,sans-serif;letter-spacing:.04em;cursor:pointer}' +
    '.sf-so{color:#7E4114}.sf-fine{margin:8px 0 0!important;font-size:12.5px!important;line-height:1.5!important;color:#5A5046!important}' +
    '[dir=rtl] .sf-pick{margin-left:0;margin-right:4px;font-family:inherit;letter-spacing:0}[dir=rtl] .sf-s{font-family:inherit}';
  function all() {
    if (!document.getElementById('sfCss')) { var st = document.createElement('style'); st.id = 'sfCss'; st.textContent = CSS; document.head.appendChild(st); } [].forEach.call(document.querySelectorAll('[data-sizefinder]'), init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', all); else all();
})();
