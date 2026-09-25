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
  var BUILD = { slim: -6, average: 0, broad: 7 };
  function inch(cm) { var i = Math.round(cm / 2.54); return Math.floor(i / 12) + '′' + (i % 12) + '″'; }
  function heights() {
    var o = '<option value="">Height</option>';
    o += '<option value="147">Under 150 cm (4′11″)</option>';
    for (var h = 150; h < 200; h += 5) o += '<option value="' + (h + 2.5) + '">' + h + '–' + (h + 5) + ' cm (' + inch(h) + '–' + inch(h + 5) + ')</option>';
    o += '<option value="202">Over 200 cm (6′7″)</option>';
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
      ? '<label class="sf-l" for="' + uid + 'f">Fit</label><select id="' + uid + 'f" class="sf-s"><option value="regular">Regular</option><option value="oversized">Oversized</option></select>'
      : '';
    el.innerHTML =
      '<p class="sf-h">Buying for someone else? <b>Find a size by height</b></p>' +
      '<div class="sf-row">' + fitSel +
        '<label class="sf-l" for="' + uid + 'h">Height</label><select id="' + uid + 'h" class="sf-s">' + heights() + '</select>' +
        '<label class="sf-l" for="' + uid + 'b">Build</label><select id="' + uid + 'b" class="sf-s"><option value="">Build</option><option value="slim">Slim</option><option value="average">Average</option><option value="broad">Broad</option></select>' +
      '</div>' +
      '<p class="sf-out" id="' + uid + 'o" role="status" aria-live="polite"></p>' +
      '<p class="sf-fine">A starting point from typical chest sizes for that height and build. If you can, measure a shirt that fits well and match it to the chart.</p>';
    var hS = document.getElementById(uid + 'h'), bS = document.getElementById(uid + 'b'), fS = document.getElementById(uid + 'f'), out = document.getElementById(uid + 'o');
    function run() {
      var h = parseFloat(hS.value), b = bS.value;
      if (!h || !b) { out.innerHTML = ''; return; }
      var fit = fS ? fS.value : fixed, c = chart[fit] || chart.regular;
      var r = suggest(c, fit, h, b);
      var html = 'Try <b>' + r.size + '</b> &middot; ' + r.flat + ' cm (' + (Math.round(r.flat / 2.54 * 2) / 2) + '″) across the chest, flat.';
      if (r.over) html = 'Our largest is <b>' + r.size + '</b> (' + r.flat + ' cm across the chest, flat) and may be snug. Check the chart, or message us on WhatsApp.';
      out.innerHTML = html;
      var sizes = document.getElementById('pdpSizes');
      if (sizes && !r.over) {
        var chip = [].filter.call(sizes.querySelectorAll('.pdp-size'), function (x) { return x.firstChild && x.firstChild.nodeValue === r.size; })[0];
        if (chip && !chip.disabled) {
          var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'sf-pick'; btn.textContent = 'Select ' + r.size;
          btn.addEventListener('click', function () { chip.click(); var buy = document.getElementById('pdpBuy') || sizes; try { buy.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { buy.scrollIntoView(); } });
          out.appendChild(document.createTextNode(' ')); out.appendChild(btn);
        } else if (chip && chip.disabled) {
          out.insertAdjacentHTML('beforeend', ' <span class="sf-so">' + r.size + ' is sold out in this design.</span>');
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
    '.sf-so{color:#7E4114}.sf-fine{margin:8px 0 0!important;font-size:12.5px!important;line-height:1.5!important;color:#5A5046!important}';
  function all() {
    if (!document.getElementById('sfCss')) { var st = document.createElement('style'); st.id = 'sfCss'; st.textContent = CSS; document.head.appendChild(st); } [].forEach.call(document.querySelectorAll('[data-sizefinder]'), init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', all); else all();
})();
