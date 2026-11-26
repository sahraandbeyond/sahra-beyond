/* Size finder 3 (26 Nov 2026). Faheem: "Simplify the size finder. Instead of it being like a form to fill, make it interactive
   with sliding scales and live animated dummy that adjusts as per the info updated by users. Have a panel review the ux and
   ease of use." He chose inputs "Core up front, extras folded" and, after a panel compared two prototypes (a drawn figure
   and the 3D mannequin), "A: drawn figure" (claude/REVIEW-size-finder-3-sliders-panel-26-Nov-2026.md).

   WHAT THE SHOPPER DOES: taps Man or Woman on the figure; slides height and weight (− and + step by 1 cm / 1 inch, 1 kg /
   1 lb, and repeat when held; cm|ft and kg|lb chips); picks how they like it to fit. Usual size in other brands and a chest
   (or, for the Sahra Trail short, waist) measurement are folded under "Fine-tune". The figure reshapes as they slide and
   wears this piece, in its colour, in the size on show. The size, a "Try on" row (any size can be shown on the figure, with
   the suggested one kept as a dashed outline) and one line of reading (room at the chest, where the hem lands) stay in view
   while the sliders move. The badge carries the one thing that qualifies the answer: between two sizes, the edge of our
   range, or sold out with the nearest size in stock. "Select M" picks the size in the buy area; the other between-size is an
   equal second button. The inputs are remembered for the visit (sessionStorage), so a shopper who moves to another fit or
   piece does not start again.

   METHOD (unchanged from Size finder 2, written down so nobody has to reverse-engineer it):
   - Body chest, cm: man 52 + 0.45 x kg + 0.05 x height; woman 52 + 0.5 x kg + 0.05 x height. Body waist, cm: man
     18 + 0.62 x kg + 0.12 x height; woman 10 + 0.62 x kg + 0.12 x height. A usual size from other brands moves the chest
     halfway to that size's typical chest; a measurement replaces the estimate.
   - A garment piece: room at the chest = full garment chest - body chest. The answer is the size whose room is nearest the
     piece's designed room (target), 5 cm less for "closer", 6 cm more for "roomier". The next size is offered as well when
     the first is a good match (within 6 cm) and the next is nearly as close (within 3 cm), leaves at least 4 cm of room and
     is not more than 8 cm roomier than designed: "between sizes".
   - A Sahra Trail piece: the body ranges the supplier sized it for (chest for the tee, waist for the short). A body figure
     within 1 cm of a range's edge also offers the neighbouring size.
   - The hem: where a tee's length lands for that height, from the top of the legs at about 0.36 x height + 5 cm below the
     shoulder point.
   - The largest or smallest size says so; a sold-out answer shows the nearest size in stock and offers the other fit.
   THE FIGURE is an illustration of fit built from those numbers and the published chart, not a photograph: a quarter of the
   room at the chest shows on each side, the hem sits at the chart's length for that height, drop shoulders drop.
   GA4: size_finder_open; size_finder once an answer settles (height and weight in 5 cm / 5 kg bands, no measurements, no
   names); size_finder_try when a size is tried on the figure; size_finder_select. */
(function () {
  'use strict';
  var AR = /^ar/i.test(document.documentElement.getAttribute('lang') || '');
  var WA = 'https://wa.me/971585449946';
  function inch(cm) { var i = Math.round(cm / 2.54); return Math.floor(i / 12) + '′' + (i % 12) + '″'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var TX = AR ? {
    title: 'اعرف مقاسك', open: 'افتح أداة المقاسات', close: 'إغلاق',
    cardH: '<b>اعرف مقاسك</b> بحسب الطول والوزن',
    start: 'لمن هذه القطعة؟ اضغط للبدء.', man: 'رجل', woman: 'امرأة',
    height: 'الطول', weight: 'الوزن', dec: 'أقل', inc: 'أكثر',
    fit: 'كيف تحب أن تكون القطعة؟', closer: 'أقرب إلى الجسم', designed: 'كما صُمّمت', roomier: 'أوسع',
    fine: 'ضبط أدق (اختياري)', usual: 'مقاسك المعتاد في الماركات الأخرى', chest: 'محيط الصدر (سم)', waist: 'محيط الخصر (سم)',
    piece: 'القطعة', tryOn: 'جرّب', best: 'الأنسب', your: 'مقاسك', or: 'أو', nearestL: 'الأقرب المتوفر',
    soldShort: function (s) { return s + ' نفد'; }, soldWord: 'نفد', smallestShort: 'أصغر مقاس لدينا', largestShort: 'أكبر مقاس لدينا',
    on: function (s) { return '<b>' + s + '</b> عليك: '; },
    room: function (cm, w) { return 'نحو <b><bdi dir="ltr">' + cm + '</bdi> سم</b> من المساحة حول الصدر، ' + w + '.'; },
    tight: function (cm) { return 'أصغر من صدرك بـ<b><bdi dir="ltr">' + cm + '</bdi> سم</b>، فستكون ضيقة.'; },
    roomW: ['قريبة من الجسم', 'قصّة ريجولر مرتبة', 'مريحة', 'قصّة أوفرسايز', 'واسعة جدًا'], roomyDesigned: 'واسعة كما صُمّمت',
    hem: ['تنتهي عند حزام البنطال', 'تنتهي عند الورك', 'تنتهي عند أعلى الساقين تقريبًا', 'تنزل تحت الوركين بقليل', 'تنزل إلى أعلى الفخذ'],
    hemS: function (w) { return 'والقطعة ' + w + '.'; },
    band: function (what, a, b) { return 'صُمّم لـ' + what + ' <bdi dir="ltr">' + a + '–' + b + '</bdi> سم.'; }, bandChest: 'صدر', bandWaist: 'خصر',
    between: function (a, b, w) { return 'أنت بين <b>' + a + '</b> و<b>' + b + '</b>. المقاس ' + b + ' ' + w + '.'; }, closerW: 'أقرب إلى الجسم', roomierW: 'أوسع',
    est: function (k, cm) { return 'قدّرنا ' + (k === 'w' ? 'خصرك' : 'صدرك') + ' بنحو ' + cm + ' سم.'; },
    using: function (k, cm) { return 'نستخدم ' + (k === 'w' ? 'محيط خصرك' : 'محيط صدرك') + ' ' + cm + ' سم.'; },
    largest: function (s) { return s + ' أكبر مقاس لدينا وقد يكون ضيقًا عليك. راسلنا على واتساب قبل الطلب.'; },
    smallest: function (s) { return s + ' أصغر مقاس لدينا، وسيكون أوسع مما صُمّم له.'; },
    gone: function (s) { return 'المقاس ' + s + ' نفد في هذه القطعة.'; }, nearest: function (s) { return 'أقرب مقاس متوفر هو ' + s + '.'; },
    seeFit: function (f) { return 'شاهد قصّة ' + f; }, ask: 'اسألنا على واتساب',
    closerFit: function (f) { return 'تريدها أقرب إلى الجسم؟ جرّب قصّة ' + f; }, roomierFit: function (f) { return 'تريد مساحة أكبر؟ جرّب قصّة ' + f; },
    pick: function (s) { return 'اختر ' + s; }, pickKit: function (a, b) { return 'اختر التيشيرت ' + a + ' والشورت ' + b; },
    suggest: function (s) { return 'ننصح بـ' + s; }, bestMatch: 'الأنسب', atChest: 'عند الصدر', atWaist: 'عند الخصر',
    tee: 'التيشيرت', short: 'الشورت', kitFits: function (z, what, a, b) { return '<b>' + z + '</b> لـ' + what + ' <bdi dir="ltr">' + a + '–' + b + '</bdi> سم.'; },
    fineprint: 'نقطة بداية من قياسات معتادة لهذا الطول والوزن، وليست قياسًا. المجسّم توضيح للمقاس مبني على جدول المقاسات. استبدال المقاس مجاني داخل الإمارات.',
    cm: 'سم', ft: 'قدم', kg: 'كغ', lb: 'رطل', unitH: 'وحدة الطول', unitW: 'وحدة الوزن'
  } : {
    title: 'Find your size', open: 'Open the size finder', close: 'Close',
    cardH: '<b>Find your fit</b> from your height and weight',
    start: 'Who is it for? Tap to start.', man: 'Man', woman: 'Woman',
    height: 'Height', weight: 'Weight', dec: 'less', inc: 'more',
    fit: 'How do you like it to fit?', closer: 'Closer', designed: 'As designed', roomier: 'Roomier',
    fine: 'Fine-tune (optional)', usual: 'Your usual size in other brands', chest: 'Chest, all round (cm)', waist: 'Waist, all round (cm)',
    piece: 'Piece', tryOn: 'Try on', best: 'Best', your: 'Your size', or: 'or', nearestL: 'Nearest in stock',
    soldShort: function (s) { return s + ' sold out'; }, soldWord: 'sold out', smallestShort: 'our smallest', largestShort: 'our largest',
    on: function (s) { return '<b>' + s + '</b> on you: '; },
    room: function (cm, w) { return 'about <b>' + cm + ' cm</b> of room at the chest, ' + w + '.'; },
    tight: function (cm) { return '<b>' + cm + ' cm</b> smaller than your chest, so it will be tight.'; },
    roomW: ['close to the body', 'a clean, regular fit', 'relaxed', 'loose and oversized', 'very roomy'], roomyDesigned: 'roomy, as it is designed',
    hem: ['ends at the waistband', 'ends at the hip', 'ends around the top of the legs', 'falls just below the hips', 'falls to the upper thigh'],
    hemS: function (w) { return 'The hem ' + w + '.'; },
    band: function (what, a, b) { return 'Made for a ' + what + ' of ' + a + '–' + b + ' cm.'; }, bandChest: 'chest', bandWaist: 'waist',
    between: function (a, b, w) { return 'You are between <b>' + a + '</b> and <b>' + b + '</b>. ' + b + ' is ' + w + '.'; }, closerW: 'closer', roomierW: 'roomier',
    est: function (k, cm) { return 'We estimated a ' + (k === 'w' ? 'waist' : 'chest') + ' of about ' + cm + ' cm.'; },
    using: function (k, cm) { return 'Using your ' + cm + ' cm ' + (k === 'w' ? 'waist' : 'chest') + '.'; },
    largest: function (s) { return s + ' is our largest size and may be snug. Message us on WhatsApp before you order.'; },
    smallest: function (s) { return s + ' is our smallest size, and it will sit roomier than it is designed to.'; },
    gone: function (s) { return s + ' is sold out in this piece.'; }, nearest: function (s) { return s + ' is the closest size in stock.'; },
    seeFit: function (f) { return 'See the ' + f + ' fit'; }, ask: 'Ask us on WhatsApp',
    closerFit: function (f) { return 'Want it closer to the body? Try the ' + f + ' fit'; }, roomierFit: function (f) { return 'Want more room? Try the ' + f + ' fit'; },
    pick: function (s) { return 'Select ' + s; }, pickKit: function (a, b) { return 'Select tee ' + a + ' and short ' + b; },
    suggest: function (s) { return 'We suggest ' + s; }, bestMatch: 'best match', atChest: 'at chest', atWaist: 'at waist',
    tee: 'Tee', short: 'Short', kitFits: function (z, what, a, b) { return '<b>' + z + '</b> fits a ' + what + ' of ' + a + '–' + b + ' cm.'; },
    fineprint: 'A starting point from typical measurements for this height and weight, not a fitting. The figure is an illustration of fit drawn from our size chart. Size exchanges are free in the UAE.',
    cm: 'cm', ft: 'ft', kg: 'kg', lb: 'lb', unitH: 'Height unit', unitW: 'Weight unit'
  };

  /* ---------- the method (unchanged from Size finder 2) ---------- */
  var USUAL = { m: { XS: 86, S: 91, M: 98, L: 105, XL: 112, XXL: 120 }, w: { XS: 80, S: 85, M: 91, L: 98, XL: 105, XXL: 112 } };
  function body(a) {
    var c = a.who === 'w' ? 52 + 0.5 * a.kg + 0.05 * a.cm : 52 + 0.45 * a.kg + 0.05 * a.cm;
    var w = (a.who === 'w' ? 10 : 18) + 0.62 * a.kg + 0.12 * a.cm;
    if (a.usual && USUAL[a.who][a.usual]) c = (c + USUAL[a.who][a.usual]) / 2;
    var cm = { c: !!a.chest, w: !!a.waist };
    if (a.chest) c = a.chest; if (a.waist) w = a.waist;
    return { chest: c, waist: w, measured: cm };
  }
  var SHIFT = { closer: -5, designed: 0, roomier: 6 };
  function roomIdx(r) { return r < 4 ? 0 : r < 10 ? 1 : r < 18 ? 2 : r < 31 ? 3 : 4; }
  function hemIdx(len, h) { var d = len - (0.36 * h + 5); return d < -14 ? 0 : d < -5 ? 1 : d <= 3 ? 2 : d <= 10 ? 3 : 4; }
  function garment(p, b, pref) {
    var t = p.target + (SHIFT[pref] || 0), rows = p.sizes;
    var sc = rows.map(function (r, i) { return { i: i, size: r[0], room: r[1] - b.chest, len: r[2] }; });
    sc.forEach(function (s) { s.d = Math.abs(s.room - t); });
    var best = sc.slice().sort(function (x, y) { return x.d - y.d || x.i - y.i; })[0];
    var alt = null;
    /* a second size only when the first is a good match and the second nearly as good: within 3 cm of it, not tight
       (4 cm of room at least), and not far roomier than the piece is designed to be */
    if (best.d <= 6) [best.i - 1, best.i + 1].forEach(function (j) {
      var s = sc[j]; if (!s) return;
      if (s.d - best.d > 3) return;
      if (s.room < 4 || s.room > t + 8) return;
      if (!alt || s.d < alt.d) alt = s;
    });
    return { best: best, alt: alt, over: best.i === rows.length - 1 && best.room < t - 6, under: best.i === 0 && best.room > t + 8 };
  }
  function bands(p, v, pref) {
    var rows = p.sizes, n = rows.length, best = null, alt = null;
    if (v < rows[0][1]) best = 0; else if (v > rows[n - 1][2]) best = n - 1;
    else for (var i = 0; i < n; i++) if (v >= rows[i][1] && v <= rows[i][2]) { best = i; break; }
    if (best == null) best = 0;
    var r = rows[best];
    if (v >= r[2] - 1 && best < n - 1 && v <= rows[best + 1][2]) alt = best + 1;
    else if (v <= r[1] + 1 && best > 0 && v >= rows[best - 1][1]) alt = best - 1;
    /* on an edge, the preference decides which of the two leads */
    if (alt != null && ((pref === 'roomier' && alt > best) || (pref === 'closer' && alt < best))) { var t = best; best = alt; alt = t; }
    var out = { best: { i: best, size: rows[best][0], lo: rows[best][1], hi: rows[best][2] }, alt: alt == null ? null : { i: alt, size: rows[alt][0] },
      over: v > rows[n - 1][2], under: v < rows[0][1] };
    if (p.garment && p.garment[best]) { out.best.room = p.garment[best][1] - v; out.best.len = p.garment[best][2]; }
    return out;
  }

  /* ---------- the page's buy sheet ---------- */
  function sizeBtn(group, s) { return document.querySelector('#ssBuy .ssb-sz[data-group="' + group + '"] button[data-size="' + s + '"]'); }
  function soldOut(group, s) { var b = sizeBtn(group, s); return !!(b && (b.disabled || b.classList.contains('is-out'))); }
  /* 18 Nov 2026 (ad-visitor persona audit): the fits on this page in their order, and the one beside this one */
  function fitLinks() { return [].slice.call(document.querySelectorAll('.ss-fits a[href]')).map(function (a) { var b = a.querySelector('b'); return { href: a.getAttribute('href'), name: (b ? b.textContent : a.textContent).trim(), on: a.classList.contains('on') }; }); }
  function nextFit(step) { var as = fitLinks(), i = -1; as.forEach(function (a, k) { if (a.on) i = k; }); return i < 0 ? null : as[i + step] || null; }


  /* ---------- the figure (prototype A, chosen 26 Nov 2026): a faceless drawn figure in SVG. Units inside the drawing are
     centimetres: x from the body's centre line, y up from the floor. Framed from the head to just below the hem. ---------- */
  var NS = 'http://www.w3.org/2000/svg';
  var VB = { y0: 214 };   /* drawing origin: y in the SVG is 214 cm minus the height above the floor */
  var DROP = { regular: 0, relaxed: 3, oversized: 6, superOversized: 9 };
  var SLEEVE = { regular: 19, relaxed: 21, oversized: 23, superOversized: 25 };

  function lerp(a, b, t) { return a + (b - a) * t; }
  function Y(y) { return VB.y0 - y; }
  function pt(x, y) { return x.toFixed(2) + ' ' + Y(y).toFixed(2); }
  /* a smooth path through points (Catmull-Rom as cubic Béziers) */
  function smooth(ps, close) {
    var n = ps.length, d = 'M' + pt(ps[0][0], ps[0][1]);
    for (var i = 0; i < (close ? n : n - 1); i++) {
      var p0 = ps[(i - 1 + n) % n], p1 = ps[i], p2 = ps[(i + 1) % n], p3 = ps[(i + 2) % n];
      if (!close) { if (i === 0) p0 = p1; if (i + 2 >= n) p3 = p2; }
      var k = 1 / 6;
      d += ' C' + pt(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k) + ',' + pt(p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k) + ',' + pt(p2[0], p2[1]);
    }
    return d + (close ? 'Z' : '');
  }
  function mirror(ps) { return ps.slice().reverse().map(function (p) { return [-p[0], p[1]]; }); }

  /* every number the drawing needs, from the shopper and the garment */
  function geometry(p) {
    var H = p.H, f = p.fem, C = p.C, W = p.W, s = Math.pow(H / 175, 0.55);
    var g = {};
    g.top = H; g.chin = 0.868 * H; g.neckB = 0.842 * H; g.shY = 0.816 * H; g.pitY = 0.738 * H; g.chY = 0.712 * H;
    g.waY = lerp(0.61, 0.625, f) * H; g.hipY = 0.522 * H; g.crY = 0.47 * H; g.wristY = 0.485 * H;
    g.headRx = lerp(7.7, 7.1, f) * Math.pow(H / 175, 0.3); g.headRy = lerp(11.6, 11, f) * Math.pow(H / 175, 0.3);
    g.neck = lerp(6.1, 5.1, f) + (C - 95) * 0.015;
    var cref = lerp(98, 90, f);
    g.sh = lerp(20.6, 18.2, f) * s + (C - cref) * 0.07;
    g.ch = C / lerp(5.7, 5.85, f);
    g.wa = W / lerp(6.0, 6.25, f);
    g.hip = lerp(Math.max(g.wa + 1.4, g.ch * 0.93), Math.max(g.ch * 1.05, g.wa * 1.36), f);
    g.arm = 4.7 * C / 98;
    /* garment */
    var drop = DROP[p.fk] || 0; if (p.hood) drop += 1;
    g.room = p.gC - C;
    g.gHalf = g.ch + Math.max(g.room, -2) * 0.25 + 0.5;   /* round 2 (panel): a quarter of the room shows on each side */
    g.hps = [g.neck + 1.6, g.neckB + 2.6];
    g.seam = [g.sh + drop * 0.95 + 0.6, g.shY - 0.6 - drop * 0.3];
    g.under = [g.gHalf + drop * 0.25 + 0.4, g.pitY - drop * 0.75 - Math.max(g.room, 0) * 0.04];
    g.hemY = p.top ? g.hps[1] - p.gL : g.crY;
    g.hemHalf = Math.max(p.top ? g.gHalf : 0, g.hip + 1.3);
    g.sHem = g.crY - 14; g.sW = p.sW || 0;
    /* arms hang from the shoulder and clear the garment */
    var handX = Math.max(g.hemHalf, p.top ? g.gHalf : 0, p.sOn > 0.5 ? g.hip + 3.2 + g.sW : 0) + 4.6;
    g.A = [g.sh - 1.2, g.shY - 1.5]; g.Wr = [handX, g.wristY];
    var dx = g.Wr[0] - g.A[0], dy = g.Wr[1] - g.A[1], L = Math.sqrt(dx * dx + dy * dy);
    g.u = [dx / L, dy / L]; g.n = [-g.u[1], g.u[0]]; g.armL = L;
    g.slen = p.hood ? L + 2 : (SLEEVE[p.fk] || 20) + (p.polo ? -1 : 0);
    g.open = p.hood ? 4.2 : 5.6 + Math.max(g.room, 0) * 0.07 + drop * 0.15;
    return g;
  }

  function gPath(g, p) {
    var hemC = p.hood ? 0.4 : 1.1, neckDip = p.polo ? 4.2 : 3;
    return 'M' + pt(-g.hps[0], g.hps[1]) + ' L' + pt(-g.seam[0], g.seam[1]) + ' L' + pt(-g.under[0], g.under[1]) +
      ' C' + pt(-g.under[0] + 0.2, g.under[1] - 4) + ',' + pt(-g.gHalf, g.chY - 6) + ',' + pt(-g.gHalf, g.chY - 9) +
      ' L' + pt(-g.hemHalf, g.hemY + 1) + ' Q' + pt(0, g.hemY - hemC) + ',' + pt(g.hemHalf, g.hemY + 1) +
      ' L' + pt(g.gHalf, g.chY - 9) + ' C' + pt(g.gHalf, g.chY - 6) + ',' + pt(g.under[0] - 0.2, g.under[1] - 4) + ',' + pt(g.under[0], g.under[1]) +
      ' L' + pt(g.seam[0], g.seam[1]) + ' L' + pt(g.hps[0], g.hps[1]) + ' Q' + pt(0, g.neckB - neckDip) + ',' + pt(-g.hps[0], g.hps[1]) + 'Z';
  }

  var figN = 0;
  function figure(stage, api) {
    var U = 'sbf' + (++figN);
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'fig'); svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('viewBox', '-60 0 120 150');
    svg.setAttribute('preserveAspectRatio', 'xMidYMax meet');
    svg.innerHTML =
      '<defs><linearGradient id="' + U + 'B" x1="0" x2="1"><stop offset="0" stop-color="var(--bodyline)" stop-opacity=".18"/><stop offset=".5" stop-color="var(--bodyline)" stop-opacity="0"/><stop offset="1" stop-color="var(--bodyline)" stop-opacity=".18"/></linearGradient>' +
      '<linearGradient id="' + U + 'G" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".22" stop-color="#000" stop-opacity="0"/><stop offset=".78" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs>' +
      '<g data-k="ruler" fill="var(--ink3)" font-size="3.2" font-family="Jost,system-ui,sans-serif"></g>' +
      '<g data-k="bodyG" fill="var(--body)" stroke="var(--bodyline)" stroke-width=".45" stroke-linejoin="round">' +
      '<path data-k="fArmL"/><path data-k="fArmR"/><path data-k="fLegs"/><path data-k="fTorso"/><path data-k="fShade" fill="url(#' + U + 'B)" stroke="none"/><path data-k="fNeck"/><ellipse data-k="fHead"/></g>' +
      '<path data-k="sShort" stroke-linejoin="round"/><g data-k="gG" stroke-linejoin="round"><path data-k="gHood"/><path data-k="gBody"/><path data-k="gShade" fill="url(#' + U + 'G)" stroke="none"/><path data-k="gSlL"/><path data-k="gSlR"/><path data-k="gDet" fill="none"/><path data-k="gPocket"/></g>' +
      '<path data-k="gGhost" fill="none" stroke="var(--copper)" stroke-width=".6" stroke-dasharray="2 1.2"/><g data-k="xray" fill="none" stroke="var(--copper)" stroke-width=".55" stroke-dasharray="1.6 1.3" opacity=".85"><path data-k="xL"/><path data-k="xR"/></g>' +
      '<g data-k="dim" stroke="var(--copper)" stroke-width=".55"><path data-k="dimL"/></g>' +
      '<g data-k="mark"><path data-k="hLine" stroke="var(--copper)" stroke-width=".6"/><text data-k="hTxt" fill="var(--copper)" font-size="3.6" font-weight="600" font-family="Jost,system-ui,sans-serif"></text></g>';
    stage.insertBefore(svg, stage.firstChild);
    var q = function (k) { return svg.querySelector('[data-k="' + k + '"]'); };

    var cur = null, tgt = null, raf = 0, g = null;
    function setAttr(id, k, v) { var e = q(id); if (e) e.setAttribute(k, v); }

    function draw(p) {
      g = geometry(p);
      /* body */
      var side = [[-g.neck, g.chin + 0.5], [-g.neck - 0.3, g.neckB], [-(g.neck + g.sh) / 2 - 1, g.neckB - 1.3], [-g.sh, g.shY], [-g.sh + 0.3, g.shY - 3.5], [-g.ch - 0.4, g.pitY], [-g.ch, g.chY - 2], [-g.wa, g.waY], [-g.hip, g.hipY], [-g.hip * 0.985, g.crY + 1], [-g.hip * 0.86, 20]];
      var torso = side.concat(mirror(side));
      setAttr('fTorso', 'd', smooth(torso, true));
      setAttr('fShade', 'd', smooth(torso, true));
      setAttr('fLegs', 'd', 'M' + pt(-0.6, g.crY) + ' L' + pt(-2.4, 20) + ' L' + pt(2.4, 20) + ' L' + pt(0.6, g.crY) + 'Z');
      setAttr('fNeck', 'd', smooth([[-g.neck + 0.4, g.chin + 1.5], [-g.neck, g.neckB + 1], [g.neck, g.neckB + 1], [g.neck - 0.4, g.chin + 1.5]], false));
      var hd = q('fHead'); hd.setAttribute('cx', 0); hd.setAttribute('cy', Y(g.top - g.headRy)); hd.setAttribute('rx', g.headRx); hd.setAttribute('ry', g.headRy);
      /* arms: shoulder to wrist, with a hand */
      function arm(sgn) {
        var A = [g.A[0] * sgn, g.A[1]], u = [g.u[0] * sgn, g.u[1]], n = [g.n[0] * sgn, g.n[1]], L = g.armL;
        var at = function (t, w, side) { return [A[0] + u[0] * L * t + n[0] * w * side, A[1] + u[1] * L * t + n[1] * w * side]; };
        var o = [at(0, g.arm + 0.8, -sgn), at(0.45, g.arm * 0.86, -sgn), at(0.62, g.arm * 0.8, -sgn), at(1, 2.8, -sgn), at(1.14, 3.3, -sgn), at(1.25, 2.2, -sgn), at(1.28, 0, 0)];
        var i = [at(1.25, 2.2, sgn), at(1.14, 3.3, sgn), at(1, 2.7, sgn), at(0.62, g.arm * 0.74, sgn), at(0.45, g.arm * 0.8, sgn), at(0.08, g.arm * 0.95, sgn)];
        return smooth(o.concat(i), true);
      }
      setAttr('fArmL', 'd', arm(-1)); setAttr('fArmR', 'd', arm(1));
      /* shorts (Sahra Trail): waist to mid-thigh, a little wider for a larger size on show */
      if (p.sOn > 0.5) {
        var sw0 = g.sW;
        setAttr('sShort', 'd', 'M' + pt(-g.wa - 0.8, g.waY - 1) + ' L' + pt(-g.hip - 1.4 - sw0, g.hipY) + ' L' + pt(-g.hip * 0.97 - 1.8 - sw0, g.sHem) + ' L' + pt(-0.7, g.sHem) + ' L' + pt(0, g.crY + 1.2) + ' L' + pt(0.7, g.sHem) + ' L' + pt(g.hip * 0.97 + 1.8 + sw0, g.sHem) + ' L' + pt(g.hip + 1.4 + sw0, g.hipY) + ' L' + pt(g.wa + 0.8, g.waY - 1) + 'Z');
      } else setAttr('sShort', 'd', '');
      ['gG', 'gGhost', 'xray', 'dim'].forEach(function (k) { q(k).style.display = p.top ? '' : 'none'; });
      /* garment body */
      var gb = gPath(g, p);
      setAttr('gBody', 'd', gb); setAttr('gShade', 'd', gb);
      /* sleeves follow the arm */
      function sleeve(sgn) {
        var S1 = [g.seam[0] * sgn, g.seam[1]], U = [g.under[0] * sgn, g.under[1]], A = [g.A[0] * sgn, g.A[1]], u = [g.u[0] * sgn, g.u[1]], n = [g.n[0] * sgn, g.n[1]];
        var reach = g.slen + (DROP[p.fk] || 0) * 0.5;
        var E = [A[0] + u[0] * reach, A[1] + u[1] * reach];
        var Eo = [E[0] - n[0] * g.open * sgn, E[1] - n[1] * g.open * sgn], Ei = [E[0] + n[0] * g.open * sgn, E[1] + n[1] * g.open * sgn];
        return 'M' + pt(S1[0], S1[1]) + ' Q' + pt(S1[0] + u[0] * 4 - n[0] * sgn * 1.2, S1[1] + u[1] * 4 - n[1] * sgn * 1.2) + ',' + pt(Eo[0], Eo[1]) + ' L' + pt(Ei[0], Ei[1]) + ' L' + pt(U[0], U[1]) + 'Z';
      }
      setAttr('gSlL', 'd', sleeve(-1)); setAttr('gSlR', 'd', sleeve(1));
      /* details: hood, pocket, collar, rib */
      var det = '';
      if (p.hood) {
        setAttr('gHood', 'd', smooth([[-g.hps[0] - 1, g.hps[1]], [-g.headRx - 3.2, g.chin + 3], [-g.headRx - 2.6, g.top - g.headRy * 0.9], [0, g.top - g.headRy * 0.2 + 1.5], [g.headRx + 2.6, g.top - g.headRy * 0.9], [g.headRx + 3.2, g.chin + 3], [g.hps[0] + 1, g.hps[1]], [0, g.neckB - 2.5]], true));
        var pw = g.gHalf * 0.62, pT = g.hemY + p.gL * 0.36, pB = g.hemY + 5;
        setAttr('gPocket', 'd', 'M' + pt(-pw * 0.72, pT) + ' L' + pt(pw * 0.72, pT) + ' L' + pt(pw, pB) + ' L' + pt(-pw, pB) + 'Z');
        det += 'M' + pt(-g.hemHalf + 0.3, g.hemY + 4.5) + ' L' + pt(g.hemHalf - 0.3, g.hemY + 4.5);
        det += 'M' + pt(-1.4, g.neckB - 2) + ' L' + pt(-2, g.neckB - 13) + 'M' + pt(1.4, g.neckB - 2) + ' L' + pt(2, g.neckB - 13);
      } else { setAttr('gHood', 'd', ''); setAttr('gPocket', 'd', ''); }
      if (p.polo) {
        det += 'M' + pt(-g.hps[0], g.hps[1]) + ' L' + pt(-1, g.neckB - 7.5) + ' L' + pt(0, g.neckB - 4.2) + ' L' + pt(1, g.neckB - 7.5) + ' L' + pt(g.hps[0], g.hps[1]);
        det += 'M' + pt(0, g.neckB - 4.2) + ' L' + pt(0, g.neckB - 13);
      }
      if (!p.hood) det += 'M' + pt(-g.hps[0] + 0.5, g.hps[1] - 0.2) + ' Q' + pt(0, g.neckB - (p.polo ? 4.2 : 3) - 1.6) + ',' + pt(g.hps[0] - 0.5, g.hps[1] - 0.2);
      setAttr('gDet', 'd', det);
      /* the body line under the garment, and the room at the chest */
      var xs = [[-g.ch - 0.4, g.pitY], [-g.ch, g.chY - 2], [-g.wa, g.waY], [-g.hip, Math.max(g.hipY, g.hemY + 0.8)]];
      if (g.hemY < g.hipY) xs = xs.slice(0, 4);
      setAttr('xL', 'd', smooth(xs, false)); setAttr('xR', 'd', smooth(xs.map(function (p) { return [-p[0], p[1]]; }), false));
      var cy = g.chY - 2, x0 = g.ch, x1 = g.gHalf;
      setAttr('dimL', 'd', x1 - x0 > 1 ? 'M' + pt(x0, cy) + ' L' + pt(x1, cy) + 'M' + pt(x0, cy - 1.2) + ' L' + pt(x0, cy + 1.2) + 'M' + pt(x1, cy - 1.2) + ' L' + pt(x1, cy + 1.2) : '');
      /* ghost: the suggested size, dashed, when the shopper tries another size */
      if (p.gOn > 0.5) { var g2 = geometry(Object.assign({}, p, { gC: p.gGC, gL: p.gGL })); setAttr('gGhost', 'd', gPath(g2, p)); } else setAttr('gGhost', 'd', '');
      /* framing (round 2, panel): head to just below the hem, so the shirt is as large as the stage allows and the hem is
         always in view. Height still shows on the ruler, in the head-to-hem proportions and in the hem position. */
      var half = Math.max(g.Wr[0] + 4, g.hemHalf + 1, g.seam[0] + g.open + 2);
      var top = g.top + 5, bot = Math.min(p.top ? g.hemY - 9 : 999, p.sOn > 0.5 ? g.sHem - 8 : 999, g.crY - 6), span = top - bot;
      var asp = (svg.clientWidth || 390) / (svg.clientHeight || 200), need = (half + 16) * 2;
      if (span * asp < need) { span = need / asp; bot = top - span; }
      var w = span * asp;
      svg.setAttribute('viewBox', (-w / 2).toFixed(2) + ' ' + Y(top).toFixed(2) + ' ' + w.toFixed(2) + ' ' + span.toFixed(2));
      g.view = { w: w, half: half };
      var rx = -half - 9, fs = span * 0.05, rh = '<path d="M' + pt(rx, bot) + ' L' + pt(rx, top) + '" stroke="var(--line3)" stroke-width="' + (span * 0.003).toFixed(2) + '"/>';
      var every = 20;
      for (var y = Math.ceil(bot / 10) * 10; y <= top; y += 10) {
        rh += '<path d="M' + pt(rx, y) + ' L' + pt(rx + (y % every === 0 ? 2.4 : 1.2), y) + '" stroke="var(--line2)" stroke-width="' + (span * 0.003).toFixed(2) + '"/>';
        if (y % every === 0 && Math.abs(y - g.top) > fs * 1.6) rh += '<text x="' + (rx - 1).toFixed(2) + '" y="' + (Y(y) + fs * 0.35).toFixed(2) + '" text-anchor="end" font-size="' + fs.toFixed(2) + '">' + y + '</text>';
      }
      q('ruler').innerHTML = rh;
      setAttr('hLine', 'd', 'M' + pt(rx, g.top) + ' L' + pt(-g.headRx - 1.5, g.top));
      q('hLine').setAttribute('stroke-width', (span * 0.004).toFixed(2));
      var ht = q('hTxt'); ht.setAttribute('x', (rx - 1).toFixed(2)); ht.setAttribute('y', (Y(g.top) + fs * 0.35).toFixed(2)); ht.setAttribute('text-anchor', 'end'); ht.setAttribute('font-size', (fs * 1.05).toFixed(2));
      ht.textContent = Math.round(p.H);
      /* stroke widths follow the zoom */
      var sw = (span * 0.0042).toFixed(2);
      q('bodyG').setAttribute('stroke-width', sw); q('xray').setAttribute('stroke-width', (span * 0.005).toFixed(2)); q('dim').setAttribute('stroke-width', (span * 0.005).toFixed(2)); q('gGhost').setAttribute('stroke-width', (span * 0.0065).toFixed(2));
      api.onTag && api.onTag();
    }

    function colours(v) {
      var dark = parseInt(v.color.slice(1, 3), 16) < 128;
      var gl = q('gG');
      gl.setAttribute('fill', v.color);
      gl.setAttribute('stroke', dark ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.22)');
      gl.setAttribute('stroke-width', '.5');
      q('gDet').setAttribute('stroke', dark ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.28)');
      q('gPocket').setAttribute('fill', 'none');
      var sh = q('sShort'); sh.setAttribute('fill', v.shortColor || v.color); sh.setAttribute('stroke', dark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.22)');
    }
    function frame() {
      raf = 0; var k = api.RM ? 1 : 0.2, moving = false;
      for (var key in tgt) {
        if (typeof tgt[key] !== 'number') { cur[key] = tgt[key]; continue; }
        var d = tgt[key] - cur[key]; if (Math.abs(d) > 0.02) { cur[key] += d * k; moving = true; } else cur[key] = tgt[key];
      }
      draw(cur);
      if (moving) raf = requestAnimationFrame(frame);
    }
    return {
      update: function (v) {
        svg.style.opacity = v ? 1 : 0.0;
        if (!v) return;
        var gh = v.ghost || { garmentCm: v.garmentCm, lengthCm: v.lengthCm };
        var nt = { H: v.cm, fem: v.who === 'w' ? 1 : 0, C: v.chest, W: v.waist, gC: v.garmentCm || v.chest + 10, gL: v.lengthCm || 70, fk: v.fitKey, hood: v.hoodie, polo: v.polo, top: v.top !== false, gGC: gh.garmentCm || v.chest + 10, gGL: gh.lengthCm || 70, gOn: v.ghost ? 1 : 0, sOn: v.short ? 1 : 0, sW: v.short ? v.short.w : 0 };
        if (!cur || v.src === 'open' && !tgt) cur = Object.assign({}, nt);
        tgt = nt; colours(v);
        if (!raf) raf = requestAnimationFrame(frame);
      },
      chestPoint: function () {
        if (!g || !svg.getScreenCTM || !cur) return null; var p0 = cur;
        var m = svg.getScreenCTM(); if (!m) return null;
        var p = svg.createSVGPoint(); p.x = Math.min(g.view.half + 9, g.view.w / 2 - 9); p.y = Y(p0.top ? g.chY - 2 : g.waY);
        var s = p.matrixTransform(m), r = stage.getBoundingClientRect();
        return { x: s.x - r.left, y: s.y - r.top };
      },
      destroy: function () { if (raf) cancelAnimationFrame(raf); }
    };
  }

  /* ---------- the finder ---------- */
  var uidN = 0, DEF = { m: [175, 75], w: [163, 60] };
  var SILH = {
    m: '<svg viewBox="0 0 60 120" aria-hidden="true"><g fill="currentColor" opacity=".55"><ellipse cx="30" cy="11" rx="7" ry="8.5"/><path d="M19 24q11-5 22 0l5 3 3 30-5 1-3-22v26l2 52h-8l-4-46-4 46h-8l2-52V36l-3 22-5-1 3-30z"/></g></svg>',
    w: '<svg viewBox="0 0 60 120" aria-hidden="true"><g fill="currentColor" opacity=".55"><ellipse cx="30" cy="11" rx="6.5" ry="8"/><path d="M21 24q9-4 18 0l4 3 3 29-5 1-3-20 1 13 5 17-6 2 2 43h-7l-3-40-3 40h-7l2-43-6-2 5-17 1-13-3 20-5-1 3-29z"/></g></svg>'
  };
  function remember(S) { try { sessionStorage.setItem('sbsf', JSON.stringify({ who: S.who, cm: S.cm, kg: S.kg, pref: S.pref, usual: S.usual, chest: S.chest, waist: S.waist, hu: S.hu, wu: S.wu, tH: S.tH, tK: S.tK })); } catch (e) {} }
  function recall() { try { return JSON.parse(sessionStorage.getItem('sbsf') || 'null'); } catch (e) { return null; } }

  function init(el) {
    if (el.__sf) return; el.__sf = 1;
    var cfg; try { cfg = JSON.parse(el.getAttribute('data-sf')); } catch (e) { return; }
    if (!cfg || !cfg.pieces || !cfg.pieces.length) return;
    var inline = el.getAttribute('data-inline') === '1', u = 'sf' + (++uidN);
    var onPage = !cfg.choose && !!document.getElementById('ssBuy');
    var S = { who: '', cm: 175, kg: 75, pref: 'designed', usual: '', chest: 0, waist: 0, hu: 'cm', wu: 'kg', tH: false, tK: false, pi: 0, tried: {} };
    var mem = recall(); if (mem && (mem.who === 'm' || mem.who === 'w')) for (var k in mem) if (k in S) S[k] = mem[k];
    var hasShort = cfg.pieces.some(function (p) { return p.part === 'short'; });
    var pieceLabel = function (p) { return AR && p.labelAr ? p.labelAr : p.label; };

    /* ---------- markup ---------- */
    var seg = function (name, items, lab) { return '<div class="sf3-seg" role="group" aria-label="' + esc(lab) + '">' + items.map(function (it) { return '<button type="button" data-' + name + '="' + it[0] + '" aria-pressed="false">' + it[1] + '</button>'; }).join('') + '</div>'; };
    var slider = function (k, lab, min, max, units, ul) {
      return '<div class="sf3-row" data-row="' + k + '"><div class="sf3-top"><label for="' + u + k + '">' + lab + '</label><span class="sf3-val" data-v="' + k + '"></span>' +
        '<span class="sf3-unit" role="group" aria-label="' + ul + '">' + units.map(function (x) { return '<button type="button" data-unit="' + k + ':' + x[0] + '" aria-pressed="false">' + x[1] + '</button>'; }).join('') + '</span></div>' +
        '<div class="sf3-sl"><button type="button" class="sf3-st" data-st="' + k + '" data-d="-1" aria-label="' + lab + ', ' + TX.dec + '">&minus;</button><input type="range" id="' + u + k + '" min="' + min + '" max="' + max + '" step="1"><button type="button" class="sf3-st" data-st="' + k + '" data-d="1" aria-label="' + lab + ', ' + TX.inc + '">+</button></div></div>';
    };
    var bodyHtml =
      '<div class="sf3-view"><div class="sf3-stage"><div class="sf3-badge" hidden aria-hidden="true"><span class="sf3-bl"></span><b class="sf3-bs"></b><span class="sf3-bo"></span></div>' +
      '<div class="sf3-tag" hidden></div>' +
      '<div class="sf3-start"><div class="sf3-q">' + TX.start + '</div><button type="button" data-who="m">' + SILH.m + TX.man + '</button><button type="button" data-who="w">' + SILH.w + TX.woman + '</button></div></div>' +
      '<div class="sf3-tries"></div><div class="sf3-read"></div></div>' +
      '<div class="sf3-sr" aria-live="polite"></div>' +
      '<div class="sf3-ctl">' +
      (cfg.choose ? '<div class="sf3-row"><label for="' + u + 'p">' + TX.piece + '</label><select id="' + u + 'p" class="sf3-sel">' + cfg.pieces.map(function (p, i) { return '<option value="' + i + '">' + esc(pieceLabel(p)) + '</option>'; }).join('') + '</select></div>' : '') +
      (inline ? '<div class="sf3-row sf3-whoin">' + seg('who', [['m', TX.man], ['w', TX.woman]], TX.start) + '</div>' : '') +
      '<div class="sf3-nums">' + slider('h', TX.height, 140, 210, [['cm', TX.cm], ['ft', TX.ft]], TX.unitH) + slider('k', TX.weight, 40, 150, [['kg', TX.kg], ['lb', TX.lb]], TX.unitW) + '</div>' +
      '<div class="sf3-row"><span class="sf3-lb">' + TX.fit + '</span>' + seg('pref', [['closer', TX.closer], ['designed', TX.designed], ['roomier', TX.roomier]], TX.fit) + '</div>' +
      '<div class="sf3-notes"></div>' +
      '<details class="sf3-fine"><summary>' + TX.fine + '</summary><div class="sf3-fg"><div><span class="sf3-lb">' + TX.usual + '</span><div class="sf3-usual" role="group" dir="ltr">' +
      ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(function (s) { return '<button type="button" data-usual="' + s + '" aria-pressed="false">' + s + '</button>'; }).join('') + '</div></div>' +
      '<div class="sf3-two"><label><span class="sf3-lb">' + TX.chest + '</span><input type="number" inputmode="numeric" min="60" max="160" data-in="chest"></label>' +
      (hasShort ? '<label><span class="sf3-lb">' + TX.waist + '</span><input type="number" inputmode="numeric" min="50" max="160" data-in="waist"></label>' : '') + '</div></div></details>' +
      '</div><div class="sf3-fp">' + TX.fineprint + '</div>';
    var host, sheet = null, opener = null;
    if (inline) {
      el.innerHTML = '<div class="sf3 sf3-inline"><div class="sf3-h1">' + TX.cardH + '</div>' + bodyHtml + '</div>';
      host = el.firstChild;
    } else {
      el.innerHTML = '<div class="sf-h">' + TX.cardH + '</div><button type="button" class="sf-open">' + TX.open + '</button>';
      sheet = document.createElement('div'); sheet.className = 'sfx'; sheet.hidden = true;
      /* the product's own name, and the fit when the piece has one ("Sahel tee, Relaxed" -> "Relaxed") */
      var h1 = document.querySelector('h1'), fitW = cfg.pieces.length === 1 ? (pieceLabel(cfg.pieces[0]).split(/[,،]\s*/)[1] || '') : '';
      var h1t = h1 ? h1.textContent.replace(/\s+/g, ' ').trim() : '', sub = h1t ? h1t + (fitW && h1t.toLowerCase().indexOf(fitW.toLowerCase()) < 0 ? ' · ' + fitW : '') : cfg.pieces.map(pieceLabel).join(' + ');
      sheet.innerHTML = '<div class="sfx-p sf3' + (cfg.kit ? ' sf3-kit' : '') + '" role="dialog" aria-modal="true" aria-labelledby="' + u + 'T"><div class="sf3-hd"><h2 id="' + u + 'T" tabindex="-1">' + TX.title + '<small>' + esc(sub) + '</small></h2>' +
        '<div class="sf3-whohd" hidden>' + seg('who', [['m', TX.man], ['w', TX.woman]], TX.start) + '</div><button type="button" class="sfx-x" aria-label="' + TX.close + '">&times;</button></div>' +
        '<div class="sf3-body">' + bodyHtml + '</div>' + (onPage ? '<div class="sf3-foot"><button type="button" class="sf3-go" disabled></button><button type="button" class="sf3-alt" hidden></button></div>' : '') + '</div>';
      document.body.appendChild(sheet); host = sheet;
    }
    var q = function (s) { return host.querySelector(s); }, qa = function (s) { return [].slice.call(host.querySelectorAll(s)); };
    var stage = q('.sf3-stage'), hS = q('#' + u + 'h'), kS = q('#' + u + 'k'), pS = q('#' + u + 'p');
    var fig = figure(stage, { AR: AR, RM: matchMedia('(prefers-reduced-motion: reduce)').matches, onTag: function () { placeTag(); } });
    var color = cfg.color || '#2B2D2F';

    /* ---------- answers ---------- */
    var R = null;
    function pieces() { return cfg.choose ? [cfg.pieces[S.pi] || cfg.pieces[0]] : cfg.pieces; }
    function compute() {
      if (!S.who) return null;
      var a = { who: S.who, cm: S.cm, kg: S.kg, usual: S.usual, chest: S.chest, waist: S.waist }, b = body(a);
      var list = pieces().map(function (p, n) {
        var group = onPage ? (cfg.kit ? (p.part === 'short' ? 'short' : 'tee') : 'size') : null, key = p.part || 'size';
        var out = function (s) { return !!group && soldOut(group, s); };
        var r, rows;
        if (p.kind === 'bands') {
          var v = p.part === 'short' ? b.waist : b.chest; r = bands(p, v, S.pref);
          rows = p.sizes.map(function (x, i) { var g = p.garment && p.garment[i]; return { i: i, size: x[0], lo: x[1], hi: x[2], gcm: g ? g[1] : 0, room: g ? g[1] - v : null, len: g ? g[2] : 0 }; });
          r.v = v;
        } else {
          r = garment(p, b, S.pref);
          rows = p.sizes.map(function (x, i) { return { i: i, size: x[0], gcm: x[1], room: x[1] - b.chest, len: x[2] }; });
        }
        r.t = p.target + (SHIFT[S.pref] || 0);
        var best = r.best.size, gone = out(best), show = S.tried[key];
        /* the size on the figure follows the answer, unless the shopper tapped another size and the answer has not moved */
        if (!show || S.tried[key + '_b'] !== best) show = best;
        if (out(show) && show === best) {
          var near = r.alt && !out(r.alt.size) ? rows[r.alt.i] : null;
          for (var j = 1; !near && j < rows.length; j++) [r.best.i + j, r.best.i - j].forEach(function (x) { if (!near && rows[x] && !out(rows[x].size)) near = rows[x]; });
          if (near) show = near.size;
        }
        S.tried[key] = show; S.tried[key + '_b'] = best;
        var tr = rows.filter(function (x) { return x.size === show; })[0] || rows[r.best.i];
        return { p: p, r: r, rows: rows, group: group, key: key, out: out, best: best, gone: gone, tr: tr };
      });
      return { b: b, a: a, list: list };
    }
    function topOf(Rr) { return Rr.list.filter(function (x) { return x.p.part !== 'short'; })[0] || null; }
    function shortOf(Rr) { return Rr.list.filter(function (x) { return x.p.part === 'short'; })[0] || null; }
    function roomTag(v) { v = Math.round(v); return AR ? '<bdi dir="ltr">' + (v >= 0 ? '+' : '') + v + '</bdi> سم' : (v >= 0 ? '+' : '') + v + ' cm'; }

    /* ---------- paint ---------- */
    var lastTries = '', srT = 0, lastBadge = '';
    function setInert(e, on) { if (!e) return; if (on) { e.setAttribute('inert', ''); e.classList.add('sf3-dis'); } else { e.removeAttribute('inert'); e.classList.remove('sf3-dis'); } }
    function paintNums() {
      hS.step = S.hu === 'ft' ? 2.54 : 1; kS.step = S.wu === 'lb' ? 0.45359237 : 1;
      hS.value = S.cm; kS.value = S.kg;
      hS.style.setProperty('--pct', ((S.cm - 140) / 70 * 100) + '%'); kS.style.setProperty('--pct', ((S.kg - 40) / 110 * 100) + '%');
      var cm = Math.round(S.cm), kg = Math.round(S.kg), lb = Math.round(S.kg * 2.20462);
      q('[data-v="h"]').innerHTML = S.hu === 'cm' ? (AR ? '<bdi dir="ltr">' + cm + '</bdi> سم' : cm + ' cm') : '<bdi dir="ltr">' + inch(S.cm) + '</bdi>';
      q('[data-v="k"]').innerHTML = S.wu === 'kg' ? (AR ? '<bdi dir="ltr">' + kg + '</bdi> كغ' : kg + ' kg') : (AR ? '<bdi dir="ltr">' + lb + '</bdi> رطل' : lb + ' lb');
      qa('[data-unit]').forEach(function (b) { var v = b.getAttribute('data-unit').split(':'); b.setAttribute('aria-pressed', String((v[0] === 'h' ? S.hu : S.wu) === v[1])); });
      hS.setAttribute('aria-valuetext', AR ? cm + ' سم، ' + inch(S.cm) : cm + ' cm, ' + inch(S.cm));
      kS.setAttribute('aria-valuetext', AR ? kg + ' كغ، ' + lb + ' رطل' : kg + ' kg, ' + lb + ' lb');
      q('[data-row="h"]').classList.toggle('sf3-idle', !!S.who && !S.tH); q('[data-row="k"]').classList.toggle('sf3-idle', !!S.who && !S.tK);
    }
    function paint(src) {
      var on = !!S.who;
      q('.sf3-start').hidden = on; setInert(q('.sf3-nums'), !on); setInert(q('.sf3-tries'), !on); q('.sf3-badge').hidden = !on;
      if (q('.sf3-whohd')) q('.sf3-whohd').hidden = !on;
      qa('[data-who]').forEach(function (b) { if (b.closest('.sf3-seg')) b.setAttribute('aria-pressed', String(b.getAttribute('data-who') === S.who)); });
      qa('[data-pref]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-pref') === S.pref)); });
      qa('[data-usual]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-usual') === S.usual)); });
      paintNums();
      R = compute();
      var go = q('.sf3-go'), alt = q('.sf3-alt');
      if (!R) {
        lastTries = '';
        q('.sf3-tries').innerHTML = pieces().map(function (p) { return '<div class="sf3-try"><span class="sf3-tl">' + (cfg.kit ? (p.part === 'short' ? TX.short : TX.tee) : TX.tryOn) + '</span><div class="sf3-chips" dir="ltr">' + p.sizes.map(function (x) { return '<button type="button" disabled>' + x[0] + '</button>'; }).join('') + '</div></div>'; }).join('');
        q('.sf3-read').innerHTML = ''; q('.sf3-notes').innerHTML = '';
        if (go) { go.disabled = true; go.textContent = TX.pick('').trim(); alt.hidden = true; }
        fig.update(null); placeTag(); return;
      }
      var T0 = topOf(R), Sh = shortOf(R), main = T0 || Sh;
      /* badge */
      var bl = TX.your, bs, bo = '', warn = false;
      if (cfg.kit && T0 && Sh) { bs = T0.tr.size + ' · ' + Sh.tr.size; bo = (AR ? TX.tee + ' · ' + TX.short : 'tee · short'); if (T0.r.over || Sh.r.over) { bo = TX.largestShort; warn = true; } if (T0.gone || Sh.gone) { bl = TX.nearestL; warn = true; } }
      else {
        bs = main.best;
        if (main.gone) { if (main.tr.size !== main.best) { bl = TX.nearestL; bs = main.tr.size; } bo = TX.soldShort(main.best); warn = true; }
        else if (main.r.under) { bo = TX.smallestShort; warn = true; }
        else if (main.r.over) { bo = TX.largestShort; warn = true; }
        else if (main.r.alt) bo = TX.or + ' ' + main.r.alt.size;
      }
      q('.sf3-bl').textContent = bl; q('.sf3-bs').textContent = bs; q('.sf3-bo').textContent = bo; q('.sf3-badge').classList.toggle('sf3-warn', warn);
      if (src === 'in' && bs !== lastBadge) { var bg = q('.sf3-badge'); bg.classList.remove('sf3-pop'); void bg.offsetWidth; bg.classList.add('sf3-pop'); setTimeout(function () { bg.classList.remove('sf3-pop'); }, 220); }
      lastBadge = bs;
      /* try-on rows, rebuilt only when something on them changes */
      var key = R.list.map(function (x) { return x.p.id + x.best + x.tr.size; }).join('|');
      if (key !== lastTries) {
        lastTries = key;
        q('.sf3-tries').innerHTML = R.list.map(function (x) {
          return '<div class="sf3-try"><span class="sf3-tl">' + (cfg.kit ? (x.p.part === 'short' ? TX.short : TX.tee) : TX.tryOn) + '</span><div class="sf3-chips" role="group" dir="ltr" aria-label="' + esc(cfg.kit ? (x.p.part === 'short' ? TX.short : TX.tee) : TX.tryOn) + '">' + x.rows.map(function (r) {
            var o = x.out(r.size), b = r.size === x.best;
            return '<button type="button" data-try="' + x.key + ':' + r.size + '" aria-pressed="' + (r.size === x.tr.size) + '" class="' + (b ? 'sf3-best' : '') + (o ? ' sf3-out' : '') + '" data-best="' + TX.best + '" aria-label="' + r.size + (b ? ', ' + TX.best : '') + (o ? ', ' + TX.soldWord : '') + '"' + (o ? ' disabled' : '') + '>' + r.size + '</button>';
          }).join('') + '</div></div>';
        }).join('');
      }
      /* one or two lines of reading for what is on the figure */
      var line = '';
      R.list.forEach(function (x) {
        var tr = x.tr, l = '';
        if (x.p.kind === 'bands' && cfg.kit) {
          l = TX.kitFits(tr.size, x.p.part === 'short' ? TX.bandWaist : TX.bandChest, tr.lo, tr.hi);   /* the kit: one short sentence per part, so both sliders stay in view */
        } else if (x.p.kind === 'bands') {
          l = TX.on(tr.size) + TX.band(x.p.part === 'short' ? TX.bandWaist : TX.bandChest, tr.lo, tr.hi) + (tr.len ? ' ' + TX.hemS(TX.hem[hemIdx(tr.len, S.cm)]) : '');
        } else {
          var rr = Math.round(tr.room), ri = roomIdx(tr.room), word = ri === 4 && tr.room <= x.r.t + 6 ? TX.roomyDesigned : TX.roomW[ri];
          l = TX.on(tr.size) + (rr < 0 ? TX.tight(-rr) : TX.room(rr, word)) + ' ' + TX.hemS(TX.hem[hemIdx(tr.len, S.cm)]);
        }
        line += (line ? ' ' : '') + (cfg.kit ? '<span class="sf3-k">' + (x.p.part === 'short' ? TX.short : TX.tee) + '</span> ' : '') + l;
      });
      q('.sf3-read').innerHTML = line;
      /* notes, under the controls */
      var n = '', fits = fitLinks();
      R.list.forEach(function (x) {
        var pre = cfg.kit ? '<span class="sf3-k">' + (x.p.part === 'short' ? TX.short : TX.tee) + '</span> ' : '';
        if (x.gone) {
          n += '<div class="sf3-w">' + pre + TX.gone(x.best) + (x.tr.size !== x.best ? ' ' + TX.nearest(x.tr.size) : '') + '</div>';
          if (!cfg.kit) fits.filter(function (f) { return !f.on; }).slice(0, 2).forEach(function (f) { n += '<div><a href="' + esc(f.href) + '#size-finder" data-fitgo="1">' + esc(TX.seeFit(f.name)) + ' &rarr;</a></div>'; });
          n += '<div><a href="' + WA + '" target="_blank" rel="noopener">' + TX.ask + '</a></div>';
        }
        if (x.r.alt && !x.gone) n += '<div>' + pre + TX.between(x.best, x.r.alt.size, x.r.alt.i > x.r.best.i ? TX.roomierW : TX.closerW) + '</div>';
        if (x.r.over) n += '<div class="sf3-w">' + pre + TX.largest(x.best) + ' <a href="' + WA + '" target="_blank" rel="noopener">WhatsApp</a></div>';
        if (x.r.under) n += '<div class="sf3-w">' + pre + TX.smallest(x.best) + '</div>';
        if (x.p.kind !== 'bands' && onPage && !x.gone) {
          var nf = null;
          if (x.r.under || x.r.best.room > x.r.t + 6) { nf = nextFit(-1); if (nf) n += '<div><a href="' + esc(nf.href) + '#size-finder" data-fitgo="1">' + esc(TX.closerFit(nf.name)) + ' &rarr;</a></div>'; }
          else if (x.r.over || x.r.best.room < 4) { nf = nextFit(1); if (nf) n += '<div><a href="' + esc(nf.href) + '#size-finder" data-fitgo="1">' + esc(TX.roomierFit(nf.name)) + ' &rarr;</a></div>'; }
        }
      });
      var anyC = R.list.some(function (x) { return x.p.part !== 'short'; }), anyW = !!Sh;
      if (anyC) n += '<div>' + (S.chest ? TX.using('c', Math.round(S.chest)) : (S.tH || S.tK ? TX.est('c', Math.round(R.b.chest)) : '')) + '</div>';
      if (anyW) n += '<div>' + (S.waist ? TX.using('w', Math.round(S.waist)) : (S.tH || S.tK ? TX.est('w', Math.round(R.b.waist)) : '')) + '</div>';
      q('.sf3-notes').innerHTML = n.replace(/<div><\/div>/g, '');
      /* footer */
      if (go) {
        if (cfg.kit) {
          var ok = R.list.every(function (x) { return !x.out(x.tr.size); });
          go.disabled = !ok; go.innerHTML = ok ? TX.pickKit(T0.tr.size, Sh.tr.size) : TX.gone(R.list.filter(function (x) { return x.out(x.tr.size); })[0].tr.size); alt.hidden = true;
        } else {
          var pick = main.tr.size;
          if (main.out(pick)) { go.disabled = true; go.textContent = TX.gone(pick); }
          else { go.disabled = false; go.innerHTML = TX.pick(pick) + (pick !== main.best && !main.gone ? '<small>' + TX.suggest(main.best) + '</small>' : ''); }
          var other = pick === main.best ? (main.r.alt ? main.r.alt.size : '') : (!main.gone ? main.best : '');
          if (other && !main.out(other)) {
            var oi = main.rows.filter(function (r) { return r.size === other; })[0], pi2 = main.tr;
            alt.hidden = false; alt.innerHTML = TX.pick(other) + '<small>' + (other === main.best ? TX.bestMatch : (oi.i > pi2.i ? TX.roomierW : TX.closerW)) + '</small>'; alt.setAttribute('data-s', other);
          } else alt.hidden = true;
        }
      }
      /* screen readers: one calm announcement after the shopper stops moving */
      clearTimeout(srT); srT = setTimeout(function () { q('.sf3-sr').textContent = q('.sf3-bl').textContent + ' ' + q('.sf3-bs').textContent + (q('.sf3-bo').textContent ? ', ' + q('.sf3-bo').textContent : '') + '. ' + q('.sf3-read').textContent; }, 900);
      /* the figure */
      var top = T0 && (T0.p.kind !== 'bands' || T0.tr.gcm) ? T0 : null, gh = null;
      if (top && top.tr.size !== top.best && !top.gone) { var br = top.rows[top.r.best.i]; gh = { garmentCm: br.gcm, lengthCm: br.len }; }
      fig.update({ who: S.who, cm: S.cm, kg: S.kg, chest: R.b.chest, waist: R.b.waist, top: !!top, garmentCm: top ? top.tr.gcm : 0, lengthCm: top ? top.tr.len : 0,
        fitKey: top ? (top.p.fitKey || 'regular') : 'regular', hoodie: !!top && /hoodie/i.test(top.p.id), polo: !!top && /polo/i.test(top.p.id), color: color, ghost: gh,
        short: Sh ? { w: 0.8 + (Sh.tr.i - Sh.r.best.i) * 1.6 } : null, src: src });
      placeTag();
      remember(S);
      queue();
    }
    function placeTag() {
      var tag = q('.sf3-tag'), T0 = R && topOf(R);
      if (!R || !T0 || T0.p.kind === 'bands') { tag.hidden = true; return; }
      var pt = fig.chestPoint(); if (!pt) { tag.hidden = true; return; }
      tag.hidden = false; tag.innerHTML = '<span>' + roomTag(T0.tr.room) + '</span><small>' + TX.atChest + '</small>';
      var bg = q('.sf3-badge'), y = pt.y;
      if (!bg.hidden && pt.x > stage.clientWidth / 2) y = Math.max(y, bg.offsetTop + bg.offsetHeight + tag.offsetHeight / 2 + 6);
      tag.style.left = pt.x + 'px'; tag.style.top = y + 'px';
    }

    /* ---------- GA4: one event per settled answer, height and weight in 5 cm / 5 kg bands ---------- */
    function track(name, p) { try { if (window.track) window.track(name, Object.assign({ item_id: cfg.handle || '' }, p)); } catch (e) {} }
    var pending = null, sendT = 0, sent = '';
    function queue() {
      if (!R || !(S.tH || S.tK)) return;
      var bnd = function (v) { var lo = Math.floor(v / 5) * 5; return lo + '-' + (lo + 4); };
      pending = { who: S.who, height: bnd(S.cm), weight: bnd(S.kg), usual: S.usual || '', fit_pref: S.pref, measured: (S.chest || S.waist) ? 1 : 0,
        piece: R.list.map(function (x) { return x.p.id; }).join(' / '), size: R.list.map(function (x) { return x.best; }).join(' / '), between: R.list.some(function (x) { return !!x.r.alt; }) ? 1 : 0, sold_out: R.list.some(function (x) { return x.gone; }) ? 1 : 0, finder: 3 };
      clearTimeout(sendT); sendT = setTimeout(flush, 1500);
    }
    function flush() { clearTimeout(sendT); if (!pending) return; var sig = JSON.stringify(pending); if (sig !== sent) { sent = sig; track('size_finder', pending); } pending = null; }

    /* ---------- open and close ---------- */
    var hideT = 0, app = null;
    function show() {
      if (!sheet) return;
      clearTimeout(hideT);
      if (!sheet.hidden && sheet.classList.contains('on')) return;
      opener = document.activeElement;
      /* opened from a sheet that has just closed (the size chart): focus returns to the finder link instead */
      if (!opener || opener === document.body || !opener.offsetParent) opener = document.querySelector('a.pdp-chart') || document.getElementById('ssBuy');
      sheet.hidden = false; document.documentElement.classList.add('sfx-on');
      app = [].slice.call(document.body.children).filter(function (c) { return c !== sheet && !c.hasAttribute('inert') && c.tagName !== 'SCRIPT'; });
      app.forEach(function (c) { c.setAttribute('inert', ''); });
      q('.sf3-body').scrollTop = 0;
      requestAnimationFrame(function () { sheet.classList.add('on'); var t = sheet.querySelector('h2'); try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } paint('open'); });
      track('size_finder_open', {});
    }
    function hide() {
      if (!sheet || sheet.hidden) return;
      sheet.classList.remove('on'); document.documentElement.classList.remove('sfx-on');
      if (app) app.forEach(function (c) { c.removeAttribute('inert'); }); app = null;
      clearTimeout(hideT); hideT = setTimeout(function () { if (!sheet.classList.contains('on')) sheet.hidden = true; }, 220);
      flush();
      if (opener && opener.focus) try { opener.focus({ preventScroll: true }); } catch (e) {}
    }
    function pickSizes(chosen) {
      var last = null;
      chosen.forEach(function (c) { var x = sizeBtn(c[0], c[1]); if (x && !soldOut(c[0], c[1])) { if (x.getAttribute('aria-pressed') !== 'true') x.click(); last = x; } });
      flush(); track('size_finder_select', { size: chosen.map(function (c) { return c[1]; }).join(' / ') });
      hide();
      var buy = document.getElementById('ssBuy');
      if (buy && getComputedStyle(buy).position !== 'fixed') try { buy.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { buy.scrollIntoView(); }
      if (last) setTimeout(function () { try { last.focus({ preventScroll: true }); } catch (e) {} }, 260);
    }

    /* ---------- events ---------- */
    function step(k, d) {
      if (k === 'h') { S.cm = Math.max(140, Math.min(210, S.hu === 'ft' ? (Math.round(S.cm / 2.54) + d) * 2.54 : Math.round(S.cm) + d)); S.tH = true; }
      else { S.kg = Math.max(40, Math.min(150, S.wu === 'lb' ? (Math.round(S.kg * 2.20462) + d) / 2.20462 : Math.round(S.kg) + d)); S.tK = true; }
      paint('in');
    }
    function setWho(w) {
      var first = !S.who;
      if (first && !S.tH && !S.tK) { S.cm = DEF[w][0]; S.kg = DEF[w][1]; }
      S.who = w; paint('in');
      if (first) setTimeout(function () { try { hS.focus({ preventScroll: true }); } catch (e) {} }, 60);
    }
    var holdT = 0, holdI = 0, fromPointer = false;
    function stopHold() { clearTimeout(holdT); clearInterval(holdI); setTimeout(function () { fromPointer = false; }, 0); }
    host.addEventListener('pointerdown', function (e) {
      var t = e.target.closest('[data-st]'); if (!t) return;
      fromPointer = true; var k = t.getAttribute('data-st'), d = +t.getAttribute('data-d');
      step(k, d); stopHold(); fromPointer = true;
      holdT = setTimeout(function () { holdI = setInterval(function () { step(k, d); }, 85); }, 420);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { host.addEventListener(ev, stopHold, true); });
    host.addEventListener('click', function (e) {
      if (sheet && e.target === sheet) return hide();
      var t = e.target.closest('button,a'); if (!t || !host.contains(t)) return;
      if (t.classList.contains('sfx-x')) return hide();
      if (t.hasAttribute('data-who')) return setWho(t.getAttribute('data-who'));
      if (t.hasAttribute('data-pref')) { S.pref = t.getAttribute('data-pref'); return paint('in'); }
      if (t.hasAttribute('data-usual')) { S.usual = S.usual === t.getAttribute('data-usual') ? '' : t.getAttribute('data-usual'); return paint('in'); }
      if (t.hasAttribute('data-try')) { var v = t.getAttribute('data-try').split(':'); S.tried[v[0]] = v[1]; track('size_finder_try', { size: v[1] }); return paint('try'); }
      if (t.hasAttribute('data-st')) { if (fromPointer) { fromPointer = false; return; } return step(t.getAttribute('data-st'), +t.getAttribute('data-d')); }
      if (t.hasAttribute('data-unit')) { var w = t.getAttribute('data-unit').split(':'); if (w[0] === 'h') S.hu = w[1]; else S.wu = w[1]; remember(S); return paintNums(); }
      if (t.hasAttribute('data-fitgo')) { remember(S); flush(); return; }
      if (t.classList.contains('sf3-go') && R) {
        if (cfg.kit) return pickSizes(R.list.map(function (x) { return [x.group, x.tr.size]; }));
        var m = topOf(R) || shortOf(R); return pickSizes([[m.group, m.tr.size]]);
      }
      if (t.classList.contains('sf3-alt') && R) { var m2 = topOf(R) || shortOf(R); return pickSizes([[m2.group, t.getAttribute('data-s')]]); }
    });
    var raf = 0;
    function soon() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; paint('in'); }); }
    host.addEventListener('input', function (e) {
      var t = e.target;
      if (t === hS) { S.cm = +t.value; S.tH = true; soon(); }
      else if (t === kS) { S.kg = +t.value; S.tK = true; soon(); }
      else if (t.getAttribute('data-in') === 'chest') { var v = +t.value; S.chest = v >= 60 && v <= 160 ? v : 0; soon(); }
      else if (t.getAttribute('data-in') === 'waist') { var w = +t.value; S.waist = w >= 50 && w <= 160 ? w : 0; soon(); }
    });
    if (pS) pS.addEventListener('change', function () { S.pi = +pS.value || 0; S.tried = {}; lastTries = ''; paint('in'); });
    if (S.chest) q('[data-in="chest"]').value = S.chest; if (S.waist && q('[data-in="waist"]')) q('[data-in="waist"]').value = S.waist;
    if (sheet) {
      el.querySelector('.sf-open').addEventListener('click', show);
      document.addEventListener('keydown', function (e) {
        if (sheet.hidden) return;
        if (e.key === 'Escape') { hide(); return; }
        if (e.key === 'Tab') {
          var f = [].filter.call(sheet.querySelectorAll('button,select,input,summary,a[href]'), function (x) { return x.offsetParent !== null && !x.disabled && !x.closest('[inert]') && (x.tagName === 'SUMMARY' || !x.closest('details:not([open])')); });
          if (!f.length) return;
          var first = f[0], last = f[f.length - 1];
          if (e.shiftKey && (document.activeElement === first || !sheet.contains(document.activeElement) || document.activeElement === sheet.querySelector('h2'))) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
          else if (!sheet.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        }
      });
      /* every "Find your fit" link on the page opens the sheet instead of jumping down to it */
      document.addEventListener('click', function (e) {
        if (e.ctrlKey || e.metaKey || e.shiftKey) return;
        var a = e.target.closest && e.target.closest('a[href="#size-finder"]'); if (!a) return;
        e.preventDefault(); e.stopPropagation(); show();
      }, true);
      window.addEventListener('resize', function () { if (!sheet.hidden) placeTag(); });
      if (location.hash === '#size-finder') setTimeout(show, 300);
    }
    paint('init');
  }

  /* house colours; text in rem so it follows the phone's text size; every control at least 44 px (unit chips 32 px);
     no letter-spacing on Arabic; only div and span inside, so no page text rule reaches it */
  var CSS = '.sfind{margin:14px 0 18px;padding:14px 16px;border:1px solid rgba(42,32,22,.18);border-radius:14px;background:#fff;color:#2A2016}' +
    'html body .sfind .sf-h{margin:0 0 10px!important;font-size:1rem!important;line-height:1.4!important;color:#2A2016!important}html body .sfind .sf-h b{font-weight:600}' +
    '.sf-open{min-height:48px;padding:0 20px;border:0;border-radius:999px;background:#2A2016;color:#FAF6EF;font:600 1rem Jost,system-ui,sans-serif;cursor:pointer}' +
    '.sfx[hidden]{display:none!important}' +
    '.sfx{position:fixed;inset:0;z-index:1000;background:rgba(42,32,22,0);display:flex;align-items:flex-end;justify-content:center;transition:background .2s}.sfx.on{background:rgba(42,32,22,.5)}' +
    '.sfx-p.sf3{width:100%;max-width:540px;height:92vh;height:92dvh;max-height:860px;display:flex;flex-direction:column;overflow:hidden;background:#fff;border-radius:18px 18px 0 0;transform:translateY(100%);transition:transform .25s cubic-bezier(.2,.8,.2,1);box-sizing:border-box;padding-bottom:env(safe-area-inset-bottom,0px)}' +
    '.sfx.on .sfx-p.sf3{transform:none}' +
    '.sf3{--ink:#2A2016;--ink2:#4A4136;--ink3:#6B6256;--copper:#7E4114;--cream:#FAF6EF;--sand:#F3DDB8;--sand2:#EFE6D7;--line:rgba(42,32,22,.12);--line2:rgba(42,32,22,.24);--line3:rgba(42,32,22,.4);--track:#A39079;--body:#E6D9C5;--bodyline:#A8977F;--glass:rgba(255,253,249,.92);color:var(--ink);font:400 1rem/1.45 Jost,system-ui,-apple-system,"Segoe UI",sans-serif;text-align:start}' +
    '[dir=rtl] .sf3{font-family:inherit}.sf3 *{box-sizing:border-box}.sf3 bdi{unicode-bidi:isolate}' +
    'html body .sf3 button,html body .sf3 select,html body .sf3 input{font:inherit;color:inherit;letter-spacing:normal;text-transform:none;margin:0}' +
    '.sf3-hd{display:flex;align-items:center;gap:8px;padding:10px 8px 6px 16px}[dir=rtl] .sf3-hd{padding:10px 16px 6px 8px}' +
    'html body .sf3-hd h2{margin:0!important;flex:1;min-width:0;font:600 1.4rem/1.1 "Cormorant Garamond",Georgia,serif!important;color:var(--ink)!important;outline:none;letter-spacing:0!important}[dir=rtl] .sf3-hd h2{font-family:inherit!important;font-size:1.2rem!important}' +
    '.sf3-hd h2 small{display:block;margin-top:2px;font:400 .78rem/1.35 Jost,system-ui,sans-serif;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}[dir=rtl] .sf3-hd h2 small{font-family:inherit}' +
    '.sfx-x{flex:0 0 44px;width:44px;height:44px;border:0;border-radius:50%;background:transparent;color:var(--ink);font-size:26px;line-height:1;cursor:pointer}' +
    '.sf3-whohd[hidden]{display:none}.sf3-whohd .sf3-seg{padding:2px}.sf3-whohd .sf3-seg button{min-height:36px;padding:0 10px;font-size:.82rem}' +
    '.sf3-body{flex:1;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}' +
    '.sf3-view{position:sticky;top:0;z-index:2;background:#fff;border-bottom:1px solid var(--line)}.sf3-inline .sf3-view{position:static}' +
    '.sf3-stage{position:relative;height:clamp(180px,30svh,300px);background:radial-gradient(120% 90% at 50% 100%,#E8DCC8,#F1E9DC 70%);overflow:hidden;border-top:1px solid var(--line)}' +
    'html body .sf3-stage>svg.fig{position:absolute;inset:0;width:100%;height:100%;max-width:none;transition:opacity .2s}' +
    '.sf3-badge{position:absolute;top:10px;inset-inline-end:12px;z-index:3;min-width:74px;padding:6px 12px 7px;text-align:center;background:var(--glass);border:1px solid var(--line);border-radius:10px;transition:transform .2s}' +
    '.sf3-badge[hidden]{display:none}.sf3-badge b{display:block;font:600 2rem/1 "Cormorant Garamond",Georgia,serif;color:var(--ink)}' +
    '.sf3-bl,.sf3-bo{display:block;font-size:.66rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3)}[dir=rtl] .sf3-bl,[dir=rtl] .sf3-bo{letter-spacing:0;font-size:.75rem}' +
    '.sf3-bo:empty{display:none}.sf3-warn .sf3-bo{color:var(--copper);font-weight:600;letter-spacing:0;text-transform:none;font-size:.72rem}.sf3-pop{transform:scale(1.08)}' +
    '.sf3-tag{position:absolute;z-index:3;display:flex;flex-direction:column;align-items:center;padding:3px 8px;line-height:1.1;font-size:.75rem;font-weight:600;color:var(--copper);background:var(--glass);border-radius:99px;white-space:nowrap;transform:translate(-50%,-50%);pointer-events:none}' +
    '.sf3-tag[hidden]{display:none}.sf3-tag small{font-size:.6rem;font-weight:500;color:var(--ink3);text-transform:uppercase;letter-spacing:.08em}[dir=rtl] .sf3-tag small{letter-spacing:0;font-size:.66rem}' +
    '.sf3-start{position:absolute;inset:0;z-index:4;display:flex;align-items:flex-end;justify-content:center;gap:10px;padding:0 16px 14px}.sf3-start[hidden]{display:none}' +
    '.sf3-q{position:absolute;top:10px;left:0;right:0;text-align:center;font-size:.9rem;color:var(--ink2)}' +
    'html body .sf3-start button{flex:1;max-width:150px;height:76%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;padding:8px 6px 10px;border:1px solid var(--line2);border-radius:12px;background:var(--glass);font-weight:600;cursor:pointer}' +
    'html body .sf3-start svg{position:static;display:block;flex:1;width:100%;height:auto;min-height:0;max-height:none;color:var(--ink2)}' +
    '.sf3-tries{padding:10px 16px 2px;display:grid;gap:8px}.sf3-try{display:flex;align-items:center;gap:8px}.sf3-tl{flex:0 0 auto;min-width:3.4em;font-size:.8rem;color:var(--ink3);white-space:nowrap}' +
    '.sf3-chips{display:flex;gap:6px;flex:1}.sf3-chips button{position:relative;flex:1;min-height:44px;border:1px solid var(--line3);border-radius:8px;background:#fff;font-weight:600;cursor:pointer}' +
    '.sf3-chips button[aria-pressed=true]{background:var(--ink);color:#fff;border-color:var(--ink)}.sf3-chips button:disabled{opacity:.45;cursor:default}' +
    '.sf3-chips button.sf3-best::after{content:attr(data-best);position:absolute;top:-8px;left:50%;transform:translateX(-50%);padding:1px 5px;border-radius:99px;background:var(--copper);color:#fff;font-size:.6rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}[dir=rtl] .sf3-chips button.sf3-best::after{letter-spacing:0;font-size:.66rem}' +
    '.sf3 .sf3-chips button.sf3-out:disabled{opacity:1;cursor:not-allowed}.sf3 .sf3-chips button.sf3-out{color:var(--ink3);text-decoration:line-through}' +
    '.sf3-read{padding:6px 16px 8px;min-height:calc(2.8em + 14px);font-size:.85rem;line-height:1.4;color:var(--ink2)}.sf3-read b{color:var(--ink)}.sf3-k{font-weight:600;color:var(--copper)}' +
    '.sf3-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}' +
    '.sf3-ctl{display:grid;gap:14px;padding:10px 16px 14px}.sf3-dis{opacity:.4;pointer-events:none}' +
    '.sf3-seg{display:flex;gap:3px;padding:3px;border:1px solid var(--line3);border-radius:10px;background:#fff}.sf3-seg button{flex:1;min-height:42px;padding:0 6px;border:0;border-radius:7px;background:transparent;font-size:.875rem;font-weight:500;cursor:pointer}' +
    '.sf3-seg button[aria-pressed=true]{background:var(--ink);color:#fff}' +
    '.sf3-top{display:flex;align-items:center;gap:8px}.sf3-top label,.sf3-lb,.sf3-row>label{flex:1;font-size:.82rem;color:var(--ink3)}.sf3-lb{display:block;margin-bottom:4px}' +
    '.sf3-val{font-size:1.06rem;font-weight:600;font-variant-numeric:tabular-nums}' +
    '.sf3-unit{display:inline-flex;gap:2px;padding:2px;border:1px solid var(--line3);border-radius:99px}.sf3-unit button{min-width:40px;min-height:32px;border:0;border-radius:99px;background:transparent;font-size:.78rem;color:var(--ink2);cursor:pointer}.sf3-unit button[aria-pressed=true]{background:var(--sand2);color:var(--ink);font-weight:600}' +
    '.sf3-sl{display:flex;align-items:center;gap:6px}.sf3-st{flex:0 0 44px;width:44px;height:44px;border:1px solid var(--line3);border-radius:50%;background:#fff;font-size:20px;line-height:1;cursor:pointer;touch-action:manipulation;-webkit-user-select:none;user-select:none}' +
    '.sf3 input[type=range]{flex:1;min-width:0;height:44px;margin:0;background:none;-webkit-appearance:none;appearance:none;touch-action:pan-y}' +
    '.sf3 input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:6px;background:linear-gradient(90deg,var(--copper) var(--pct,50%),var(--track) var(--pct,50%))}[dir=rtl] .sf3 input[type=range]::-webkit-slider-runnable-track{background:linear-gradient(270deg,var(--copper) var(--pct,50%),var(--track) var(--pct,50%))}' +
    '.sf3 input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:30px;height:30px;margin-top:-12px;border-radius:50%;background:#fff;border:2px solid var(--ink);box-shadow:0 1px 4px rgba(0,0,0,.18)}' +
    '.sf3 input[type=range]::-moz-range-track{height:6px;border-radius:6px;background:var(--track)}.sf3 input[type=range]::-moz-range-progress{height:6px;border-radius:6px;background:var(--copper)}.sf3 input[type=range]::-moz-range-thumb{width:28px;height:28px;border-radius:50%;background:#fff;border:2px solid var(--ink)}' +
    '.sf3-idle input[type=range]::-webkit-slider-thumb{animation:sf3n 1.6s ease-in-out 2}@keyframes sf3n{50%{box-shadow:0 0 0 8px rgba(126,65,20,.18)}}' +
    '.sf3-notes{display:grid;gap:4px;font-size:.85rem;color:var(--ink2)}.sf3-notes:empty{display:none}.sf3-notes a{color:var(--copper);font-weight:600}.sf3-w{color:var(--copper);font-weight:500}' +
    '.sf3-fine{border-top:1px solid var(--line);padding-top:6px}.sf3-fine summary{min-height:44px;display:flex;align-items:center;cursor:pointer;font-size:.9rem;color:var(--ink2)}' +
    '.sf3-fg{display:grid;gap:12px;padding:6px 0 4px}.sf3-usual{display:flex;flex-wrap:wrap;gap:6px}.sf3-usual button{min-width:48px;min-height:44px;border:1px solid var(--line3);border-radius:8px;background:#fff;cursor:pointer}.sf3-usual button[aria-pressed=true]{background:var(--ink);color:#fff}' +
    '.sf3-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.sf3 input[type=number],.sf3-sel{width:100%;min-height:44px;padding:0 10px;border:1px solid var(--line3);border-radius:8px;background:#fff}' +
    '.sf3-fp{padding:0 16px 14px;font-size:.75rem;line-height:1.45;color:var(--ink3)}' +
    '.sf3-foot{display:flex;gap:10px;align-items:center;padding:10px 16px;border-top:1px solid var(--line);background:#fff}' +
    '.sf3 .sf3-go{flex:1;min-height:52px;border:0;border-radius:8px;background:var(--ink);color:#fff;font-weight:600;font-size:1rem;line-height:1.2;cursor:pointer}.sf3-go:disabled{opacity:.35;cursor:default}' +
    '.sf3 .sf3-alt{flex:0 0 40%;min-height:52px;padding:0 10px;border:1px solid var(--line3);border-radius:8px;background:#fff;font-weight:600;font-size:.95rem;line-height:1.2;cursor:pointer}.sf3-alt[hidden]{display:none}' +
    '.sf3-go small,.sf3-alt small{display:block;margin-top:1px;font-size:.78rem;font-weight:400;opacity:.85}' +
    '.sf3-inline{border:1px solid rgba(42,32,22,.18);border-radius:14px;overflow:hidden;background:#fff;margin:14px 0}.sf3-h1{padding:12px 16px;font-size:1rem}.sf3-h1 b{font-weight:600}.sf3-whoin .sf3-seg{max-width:320px}' +
    '.sf3 :focus-visible,.sf-open:focus-visible{outline:2px solid #7E4114;outline-offset:2px}.sf3-hd h2:focus,.sf3-hd h2:focus-visible{outline:none}' +
    'html.sfx-on{overflow:hidden}' +
    '@media(min-width:900px){.sfx{align-items:center}.sfx-p.sf3{border-radius:18px;height:88vh}}' +
    '@media(max-height:720px) and (min-height:561px){.sf3-stage{height:178px}.sf3-ctl{gap:10px;padding-top:8px}}.sf3-kit .sf3-stage{height:clamp(140px,22svh,240px)}.sf3-kit .sf3-read{font-size:.8rem;min-height:0}.sf3-kit .sf3-tries{gap:6px}.sf3-kit .sf3-chips button{min-height:40px}' +
    '@media(max-height:660px) and (min-height:561px){.sf3-kit .sf3-stage{height:126px}.sf3-stage{height:168px}.sf3-read{min-height:calc(2.7em + 8px);padding-bottom:4px}.sf3-ctl{gap:10px}}' +
    '@media(max-height:560px){.sf3-view{position:static}.sf3-stage{height:200px}}' +
    '@media(prefers-reduced-motion:reduce){.sfx,.sfx-p.sf3,.sf3-badge,.sf3-stage>svg.fig{transition:none}.sf3-idle input[type=range]::-webkit-slider-thumb{animation:none}}';
  function all() {
    if (!document.getElementById('sfCss')) { var s = document.createElement('style'); s.id = 'sfCss'; s.textContent = CSS; document.head.appendChild(s); }
    [].forEach.call(document.querySelectorAll('[data-sizefinder]'), init);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', all); else all();
  window.SBSizeFinder = { body: body, garment: garment, bands: bands };
})();
