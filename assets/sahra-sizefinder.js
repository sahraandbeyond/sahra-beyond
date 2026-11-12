/* Size finder 2 (12 Nov 2026). Faheem, after a six-person panel review (claude/REVIEW-size-finder-panel-12-Nov-2026.md):
   "On every product page", "Better questions", "Honest answer", "Opens as a sheet".

   The pieces and their charts come from the page (data-sf, written by sizefinder-data.js at build time).
   QUESTIONS: who it is for (man or woman), height and weight (required); the size usually worn in other brands, and a
   chest or waist measurement (optional); how they like it to fit (closer, as designed, roomier).
   METHOD, written down so nobody has to reverse-engineer it:
   - Body chest, cm: man 52 + 0.45 x kg + 0.05 x height; woman 52 + 0.5 x kg + 0.05 x height. Body waist, cm: man
     18 + 0.62 x kg + 0.12 x height; woman 10 + 0.62 x kg + 0.12 x height. Plain rules of thumb from adult proportions.
     A usual size from other brands moves the chest halfway to that size's typical chest; a measurement replaces the
     estimate.
   - A garment piece: room at the chest = full garment chest - body chest. The answer is the size whose room is nearest
     the piece's designed room (target), 5 cm less for "closer", 6 cm more for "roomier". The next size is offered as
     well when the first is a good match (within 6 cm) and the next is nearly as close (within 3 cm), leaves at least
     4 cm of room and is not more than 8 cm roomier than designed: "between sizes".
   - A Sahra Trail piece: the body ranges the supplier sized it for (chest for the tee, waist for the short). A body
     figure within 1 cm of a range's edge also offers the neighbouring size.
   - The hem: where a tee's length lands for that height, from the top of the legs at about 0.36 x height + 5 cm
     below the shoulder point (measured over the body, as the chart's length is).
   - The largest or smallest size says so plainly; a sold-out answer offers the other size, the other fit, or WhatsApp.
   Every answer is a starting point, and the copy says so. GA4: size_finder_open; size_finder once an answer settles
   (height and weight in 5 cm / 5 kg bands, no measurements, no names); size_finder_select. */
(function () {
  'use strict';
  var AR = /^ar/i.test(document.documentElement.getAttribute('lang') || '');
  var WA = 'https://wa.me/971585449946';
  function iso(x) { return '⁦' + x + '⁩'; }
  function inch(cm) { var i = Math.round(cm / 2.54); return Math.floor(i / 12) + '′' + (i % 12) + '″'; }
  var TX = AR ? {
    title: 'اعثر على مقاسك', open: 'افتح أداة المقاسات', close: 'إغلاق',
    cardH: '<b>اعثر على مقاسك</b> بحسب الطول والوزن',
    who: 'لمن هذه القطعة؟', man: 'رجل', woman: 'امرأة',
    height: 'الطول', weight: 'الوزن', choose: 'اختر',
    usual: 'مقاسك المعتاد في الماركات الأخرى (اختياري)', notSure: 'لست متأكدًا',
    fit: 'كيف تحب أن تكون القطعة؟', closer: 'أقرب إلى الجسم', designed: 'كما صُمّمت', roomier: 'أوسع',
    meas: 'أعرف قياساتي (اختياري)', chest: 'محيط الصدر (سم)', waist: 'محيط الخصر (سم)',
    piece: 'القطعة',
    need: 'اختر لمن هي القطعة والطول والوزن لترى مقاسك.',
    your: function (s) { return 'مقاسك: <b>' + s + '</b>'; },
    orC: function (s) { return 'أو <b>' + s + '</b> لقصّة أقرب إلى الجسم'; },
    orR: function (s) { return 'أو <b>' + s + '</b> لقصّة أوسع'; },
    between: 'أنت بين مقاسين.',
    room: function (cm, w) { return 'نحو ' + cm + ' سم من المساحة حول الصدر: ' + w + '.'; },
    roomW: ['قريبة من الجسم', 'قصّة ريجولر مرتبة', 'مريحة', 'واسعة بأسلوب أوفرسايز', 'واسعة جدًا'],
    hem: ['تنتهي عند حزام البنطال', 'تنتهي عند الورك', 'تنتهي عند أعلى الساقين تقريبًا', 'تنزل تحت الوركين بقليل', 'تنزل إلى أعلى الفخذ'],
    hemS: function (w) { return 'وبطولك ' + w + '.'; },
    band: function (what, cm) { return 'صُمّمت لـ' + what + ' ' + iso(cm) + ' سم.'; }, bandChest: 'صدر', bandWaist: 'خصر',
    est: function (k, cm) { return 'قدّرنا ' + (k === 'w' ? 'خصرك' : 'صدرك') + ' بنحو ' + cm + ' سم.'; },
    largest: function (s) { return '<b>' + s + '</b> أكبر مقاس لدينا وقد يكون ضيقًا عليك. راسلنا على واتساب قبل الطلب.'; },
    smallest: function (s) { return '<b>' + s + '</b> أصغر مقاس لدينا، وسيكون أوسع مما صُمّم له.'; },
    gone: function (s) { return 'المقاس ' + s + ' نفد في هذه القطعة.'; },
    otherFit: function (f) { return 'جرّب ' + f; }, ask: 'اسألنا على واتساب',
    pick: function (s) { return 'اختر ' + s; }, pickKit: function (a, b) { return 'اختر التيشيرت ' + a + ' والشورت ' + b; },
    tee: 'التيشيرت', short: 'الشورت',
    fine: 'نقطة بداية من قياسات معتادة لهذا الطول والوزن، وليست قياسًا. استبدال المقاس مجاني داخل الإمارات.',
    sizesIn: 'المقاس في'
  } : {
    title: 'Find your fit', open: 'Open the size finder', close: 'Close',
    cardH: '<b>Find your fit</b> from your height and weight',
    who: 'Who is it for?', man: 'Man', woman: 'Woman',
    height: 'Height', weight: 'Weight', choose: 'Choose',
    usual: 'Usual size in other brands (optional)', notSure: 'Not sure',
    fit: 'How do you like it to fit?', closer: 'Closer', designed: 'As designed', roomier: 'Roomier',
    meas: 'I know my measurements (optional)', chest: 'Chest, all round (cm)', waist: 'Waist, all round (cm)',
    piece: 'Piece',
    need: 'Choose who it is for, the height and the weight to see a size.',
    your: function (s) { return 'Your size: <b>' + s + '</b>'; },
    orC: function (s) { return 'or <b>' + s + '</b> for a closer fit'; },
    orR: function (s) { return 'or <b>' + s + '</b> for a roomier fit'; },
    between: 'You are between sizes.',
    room: function (cm, w) { return 'About ' + cm + ' cm of room at the chest: ' + w + '.'; },
    roomW: ['close to the body', 'a clean, regular fit', 'relaxed', 'loose and oversized', 'very roomy'],
    hem: ['ends at the waistband', 'ends at the hip', 'ends around the top of the legs', 'falls just below the hips', 'falls to the upper thigh'],
    hemS: function (w) { return 'At this height the hem ' + w + '.'; },
    band: function (what, cm) { return 'Made for a ' + what + ' of ' + cm + ' cm.'; }, bandChest: 'chest', bandWaist: 'waist',
    est: function (k, cm) { return 'We estimated a ' + (k === 'w' ? 'waist' : 'chest') + ' of about ' + cm + ' cm.'; },
    largest: function (s) { return '<b>' + s + '</b> is our largest size and may be snug. Message us on WhatsApp before you order.'; },
    smallest: function (s) { return '<b>' + s + '</b> is our smallest size, and it will sit roomier than it is designed to.'; },
    gone: function (s) { return s + ' is sold out in this piece.'; },
    otherFit: function (f) { return 'Try the ' + f + ' fit'; }, ask: 'Ask us on WhatsApp',
    pick: function (s) { return 'Select ' + s; }, pickKit: function (a, b) { return 'Select tee ' + a + ' and short ' + b; },
    tee: 'Tee', short: 'Short',
    fine: 'A starting point from typical measurements for that height and weight, not a fitting. Size exchanges are free in the UAE.',
    sizesIn: 'Sizes in'
  };

  /* ---------- the method ---------- */
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
  function roomWord(r) { var i = r < 4 ? 0 : r < 10 ? 1 : r < 18 ? 2 : r < 31 ? 3 : 4; return TX.roomW[i]; }
  function hemWord(len, h) { var d = len - (0.36 * h + 5); var i = d < -14 ? 0 : d < -5 ? 1 : d <= 3 ? 2 : d <= 10 ? 3 : 4; return TX.hem[i]; }
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
  function soldOut(group, s) { var b = sizeBtn(group, s); return !!(b && b.disabled); }
  function otherFit() { var a = document.querySelector('.ss-fits a:not(.on)'); if (!a) return null; var b = a.querySelector('b'); return { href: a.getAttribute('href'), name: (b ? b.textContent : a.textContent).trim() }; }

  /* ---------- markup ---------- */
  var uidN = 0;
  function opts(from, to, fmt) { var o = '<option value="">' + TX.choose + '</option>'; for (var v = from; v <= to; v++) o += '<option value="' + v + '">' + fmt(v) + '</option>'; return o; }
  function form(cfg, u) {
    var seg = function (name, items, on) { return '<div class="sf-seg" role="group" aria-labelledby="' + u + name + 'L">' + items.map(function (it) { return '<button type="button" data-' + name + '="' + it[0] + '" aria-pressed="' + (it[0] === on) + '">' + it[1] + '</button>'; }).join('') + '</div>'; };
    var h = '';
    if (cfg.choose) h += '<div class="sf-f"><label class="sf-l" for="' + u + 'p">' + TX.piece + '</label><select id="' + u + 'p" class="sf-s">' + cfg.pieces.map(function (p, i) { return '<option value="' + i + '">' + (AR && p.labelAr ? p.labelAr : p.label) + '</option>'; }).join('') + '</select></div>';
    h += '<div class="sf-f"><span class="sf-l" id="' + u + 'whoL">' + TX.who + '</span>' + seg('who', [['m', TX.man], ['w', TX.woman]], '') + '</div>';
    h += '<div class="sf-two"><div class="sf-f"><label class="sf-l" for="' + u + 'h">' + TX.height + '</label><select id="' + u + 'h" class="sf-s">' + opts(140, 210, function (v) { return AR ? v + ' سم (' + iso(inch(v)) + ')' : v + ' cm (' + inch(v) + ')'; }) + '</select></div>' +
      '<div class="sf-f"><label class="sf-l" for="' + u + 'k">' + TX.weight + '</label><select id="' + u + 'k" class="sf-s">' + opts(40, 150, function (v) { return AR ? v + ' كغ (' + iso(Math.round(v * 2.2046) + ' lb') + ')' : v + ' kg (' + Math.round(v * 2.2046) + ' lb)'; }) + '</select></div></div>';
    h += '<div class="sf-f"><label class="sf-l" for="' + u + 'u">' + TX.usual + '</label><select id="' + u + 'u" class="sf-s"><option value="">' + TX.notSure + '</option>' + ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select></div>';
    h += '<div class="sf-f"><span class="sf-l" id="' + u + 'fitL">' + TX.fit + '</span>' + seg('fit', [['closer', TX.closer], ['designed', TX.designed], ['roomier', TX.roomier]], 'designed') + '</div>';
    h += '<details class="sf-m"><summary>' + TX.meas + '</summary><div class="sf-two"><div class="sf-f"><label class="sf-l" for="' + u + 'c">' + TX.chest + '</label><input id="' + u + 'c" class="sf-s" type="number" inputmode="numeric" min="60" max="160"></div>' +
      '<div class="sf-f"><label class="sf-l" for="' + u + 'w">' + TX.waist + '</label><input id="' + u + 'w" class="sf-s" type="number" inputmode="numeric" min="50" max="160"></div></div></details>';
    h += '<div class="sf-out" id="' + u + 'o" role="status" aria-live="polite"><p class="sf-need">' + TX.need + '</p></div>';
    h += '<p class="sf-fine">' + TX.fine + '</p>';
    return h;
  }

  function init(el) {
    if (el.__sf) return; el.__sf = 1;
    var cfg; try { cfg = JSON.parse(el.getAttribute('data-sf')); } catch (e) { return; }
    if (!cfg || !cfg.pieces || !cfg.pieces.length) return;
    var inline = el.getAttribute('data-inline') === '1';
    var u = 'sf' + (++uidN), host, sheet = null, opener = null;
    if (inline) { el.innerHTML = '<p class="sf-h">' + TX.cardH + '</p>' + form(cfg, u); host = el; }
    else {
      el.innerHTML = '<p class="sf-h">' + TX.cardH + '</p><button type="button" class="sf-open">' + TX.open + '</button>';
      sheet = document.createElement('div'); sheet.className = 'sfx'; sheet.hidden = true;
      sheet.innerHTML = '<div class="sfx-p" role="dialog" aria-modal="true" aria-labelledby="' + u + 'T"><div class="sfx-h"><h2 id="' + u + 'T" tabindex="-1">' + TX.title + '</h2><button type="button" class="sfx-x" aria-label="' + TX.close + '">&times;</button></div>' + form(cfg, u) + '</div>';
      document.body.appendChild(sheet); host = sheet;
    }
    var q = function (s) { return host.querySelector(s); };
    var st = { who: '', fit: 'designed' };
    var hS = q('#' + u + 'h'), kS = q('#' + u + 'k'), uS = q('#' + u + 'u'), pS = q('#' + u + 'p'), cI = q('#' + u + 'c'), wI = q('#' + u + 'w'), out = q('#' + u + 'o');

    var hideT = 0;
    function show() {
      if (!sheet) return;
      clearTimeout(hideT);
      if (!sheet.hidden && sheet.classList.contains('on')) return;
      opener = document.activeElement; sheet.hidden = false; document.documentElement.classList.add('sfx-on');
      requestAnimationFrame(function () { sheet.classList.add('on'); var t = sheet.querySelector('h2'); try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } });
      track('size_finder_open', {});
    }
    function hide() {
      if (!sheet || sheet.hidden) return;
      sheet.classList.remove('on'); document.documentElement.classList.remove('sfx-on');
      clearTimeout(hideT); hideT = setTimeout(function () { if (!sheet.classList.contains('on')) sheet.hidden = true; }, 220);
      flush();
      if (opener && opener.focus) try { opener.focus({ preventScroll: true }); } catch (e) {}
    }
    if (sheet) {
      el.querySelector('.sf-open').addEventListener('click', show);
      sheet.querySelector('.sfx-x').addEventListener('click', hide);
      sheet.addEventListener('click', function (e) { if (e.target === sheet) hide(); });
      document.addEventListener('keydown', function (e) {
        if (sheet.hidden) return;
        if (e.key === 'Escape') { hide(); return; }
        /* keep Tab inside the sheet while it is open */
        if (e.key === 'Tab') {
          var f = [].filter.call(sheet.querySelectorAll('button,select,input,summary,a[href],[tabindex="-1"]'), function (x) { return x.offsetParent !== null || x === document.activeElement; });
          if (!f.length) return;
          var first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
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
      if (location.hash === '#size-finder') setTimeout(show, 300);
    }
    function track(name, p) { try { if (window.track) window.track(name, Object.assign({ item_id: cfg.handle || '' }, p)); } catch (e) {} }

    function line(piece, b, a, group) {
      var pref = st.fit, r, h = '', tag = '';
      if (piece.kind === 'bands') {
        var v = piece.part === 'short' ? b.waist : b.chest; r = bands(piece, v, pref);
        h += '<p class="sf-big">' + TX.your(r.best.size) + (r.alt ? ' <span>' + (r.alt.i < r.best.i ? TX.orC(r.alt.size) : TX.orR(r.alt.size)) + '</span>' : '') + '</p>';
        var why = TX.band(piece.part === 'short' ? TX.bandWaist : TX.bandChest, r.best.lo + '–' + r.best.hi);
        /* no room-at-the-chest line here: the supplier sized Sahra Trail by body ranges, and its relaxed athletic cut reads
           as "oversized" on the chest numbers alone */
        if (r.best.len) why += ' ' + TX.hemS(hemWord(r.best.len, a.cm));
        if (!(piece.part === 'short' ? b.measured.w : b.measured.c)) why += ' ' + TX.est(piece.part === 'short' ? 'w' : 'c', Math.round(v));
        h += '<p class="sf-why">' + why + '</p>';
      } else {
        r = garment(piece, b, pref);
        h += '<p class="sf-big">' + TX.your(r.best.size) + (r.alt ? ' <span>' + (r.alt.i < r.best.i ? TX.orC(r.alt.size) : TX.orR(r.alt.size)) + '</span>' : '') + '</p>';
        var w2 = TX.room(Math.round(r.best.room), roomWord(r.best.room)) + ' ' + TX.hemS(hemWord(r.best.len, a.cm));
        if (!b.measured.c) w2 += ' ' + TX.est('c', Math.round(b.chest));
        h += '<p class="sf-why">' + w2 + '</p>';
      }
      if (r.alt) h += '<p class="sf-note">' + TX.between + '</p>';
      if (r.over) h += '<p class="sf-note">' + TX.largest(r.best.size) + '</p>';
      if (r.under) h += '<p class="sf-note">' + TX.smallest(r.best.size) + '</p>';
      var pick = r.best.size, alt = r.alt ? r.alt.size : null, gone = false;
      if (group && soldOut(group, pick)) {
        gone = true; h += '<p class="sf-note sf-so">' + TX.gone(pick) + '</p>';
        if (alt && !soldOut(group, alt)) { pick = alt; alt = null; }
        else { pick = null; var of = otherFit(); h += '<p class="sf-alts">' + (of ? '<a href="' + of.href + '">' + TX.otherFit(of.name) + ' &rarr;</a> &middot; ' : '') + '<a href="' + WA + '" target="_blank" rel="noopener">' + TX.ask + '</a></p>'; }
      } else if (group && alt && soldOut(group, alt)) alt = null;
      return { html: h, pick: pick, alt: alt, r: r, gone: gone };
    }

    function run() {
      var a = { who: st.who, cm: parseFloat(hS.value), kg: parseFloat(kS.value), usual: uS.value, chest: parseFloat(cI.value) || 0, waist: parseFloat(wI.value) || 0 };
      if (a.chest && (a.chest < 60 || a.chest > 160)) a.chest = 0; if (a.waist && (a.waist < 50 || a.waist > 160)) a.waist = 0;
      if (!a.who || !a.cm || !a.kg) { out.innerHTML = '<p class="sf-need">' + TX.need + '</p>'; return; }
      var b = body(a), pieces = cfg.choose ? [cfg.pieces[+pS.value || 0]] : cfg.pieces, onPage = !cfg.choose && !!document.getElementById('ssBuy');
      var html = '', picks = [];
      pieces.forEach(function (p, i) {
        var group = onPage ? (cfg.kit ? (p.part === 'short' ? 'short' : 'tee') : 'size') : null;
        var L = line(p, b, a, group);
        html += '<div class="sf-res">' + (cfg.kit ? '<p class="sf-k">' + (p.part === 'short' ? TX.short : TX.tee) + '</p>' : '') + L.html + '</div>';
        picks.push({ group: group, pick: L.pick, alt: L.alt, size: L.r.best.size, between: !!L.r.alt, gone: L.gone, id: p.id });
      });
      var btns = '';
      if (onPage) {
        if (cfg.kit) { if (picks[0].pick && picks[1].pick) btns = '<button type="button" class="sf-pick" data-kit="1">' + TX.pickKit(picks[0].pick, picks[1].pick) + '</button>'; }
        else if (picks[0].pick) {
          btns = '<button type="button" class="sf-pick" data-s="' + picks[0].pick + '">' + TX.pick(picks[0].pick) + '</button>';
          if (picks[0].alt) btns += '<button type="button" class="sf-pick sf-pick2" data-s="' + picks[0].alt + '">' + TX.pick(picks[0].alt) + '</button>';
        }
      }
      out.innerHTML = html + (btns ? '<div class="sf-btns">' + btns + '</div>' : '');
      [].forEach.call(out.querySelectorAll('.sf-pick'), function (bt) {
        bt.addEventListener('click', function () {
          var chosen = bt.getAttribute('data-kit') ? picks.map(function (x) { return [x.group, x.pick]; }) : [['size', bt.getAttribute('data-s')]];
          var last = null;
          chosen.forEach(function (c) { var x = sizeBtn(c[0], c[1]); if (x && !x.disabled) { if (x.getAttribute('aria-pressed') !== 'true') x.click(); last = x; } });
          flush(); track('size_finder_select', { size: chosen.map(function (c) { return c[1]; }).join(' / ') });
          hide();
          var buy = document.getElementById('ssBuy');
          if (buy && getComputedStyle(buy).position !== 'fixed') try { buy.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { buy.scrollIntoView(); }
          if (last) setTimeout(function () { try { last.focus({ preventScroll: true }); } catch (e) {} }, 260);
        });
      });
      /* one event per settled answer (not per keystroke), with height and weight in 5 cm and 5 kg bands */
      var bnd = function (v) { var lo = Math.floor(v / 5) * 5; return lo + '-' + (lo + 4); };
      pending = { who: a.who, height: bnd(a.cm), weight: bnd(a.kg), usual: a.usual || '', fit_pref: st.fit, measured: (a.chest || a.waist) ? 1 : 0,
        piece: picks.map(function (x) { return x.id; }).join(' / '), size: picks.map(function (x) { return x.size; }).join(' / '), between: picks.some(function (x) { return x.between; }) ? 1 : 0, sold_out: picks.some(function (x) { return x.gone; }) ? 1 : 0 };
      clearTimeout(sendT); sendT = setTimeout(flush, 1500);
    }
    var pending = null, sendT = 0, sent = '';
    function flush() {
      clearTimeout(sendT); if (!pending) return;
      var sig = JSON.stringify(pending); if (sig !== sent) { sent = sig; track('size_finder', pending); }
      pending = null;
    }
    [].forEach.call(host.querySelectorAll('.sf-seg button'), function (bt) {
      bt.addEventListener('click', function () {
        var k = bt.hasAttribute('data-who') ? 'who' : 'fit';
        st[k] = bt.getAttribute('data-' + k);
        [].forEach.call(bt.parentNode.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', x === bt ? 'true' : 'false'); });
        run();
      });
    });
    [hS, kS, uS, pS].forEach(function (s) { if (s) s.addEventListener('change', run); });
    [cI, wI].forEach(function (s) { if (s) s.addEventListener('input', run); });
  }

  /* text in rem so it follows the phone's text size; every control at least 44 px; no letter-spacing on Arabic */
  var CSS = '.sfind{margin:14px 0 18px;padding:14px 16px;border:1px solid rgba(42,32,22,.18);border-radius:14px;background:#fff;color:#2A2016}' +
    'html body :is(.sfx,.sfind) .sf-h{margin:0 0 10px!important;font-size:1rem!important;line-height:1.4!important;color:#2A2016!important}html body :is(.sfx,.sfind) .sf-h b{font-weight:600}' +
    '.sf-open{min-height:48px;padding:0 20px;border:0;border-radius:999px;background:#2A2016;color:#FAF6EF;font:600 1rem Jost,system-ui,sans-serif;cursor:pointer}' +
    '.sf-f{display:flex;flex-direction:column;gap:6px;margin:0 0 12px;min-width:0}.sf-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
    '.sf-l{font-size:.875rem;font-weight:500;color:#4A4136}' +
    '.sf-s{width:100%;min-height:48px;padding:0 10px;border:1px solid rgba(42,32,22,.35);border-radius:10px;background:#fff;color:#2A2016;font:1rem Jost,system-ui,sans-serif;box-sizing:border-box}' +
    '.sf-seg{display:flex;padding:3px;border-radius:999px;background:#F3DDB8;gap:2px}.sf-seg button{flex:1;min-height:44px;border:0;border-radius:999px;background:transparent;color:#4A4136;font:500 .9375rem Jost,system-ui,sans-serif;cursor:pointer;padding:0 6px}' +
    '.sf-seg button[aria-pressed="true"]{background:#fff;color:#2A2016;box-shadow:0 1px 3px rgba(42,32,22,.18);font-weight:600}' +
    '.sf-m{margin:0 0 12px}.sf-m summary{min-height:44px;display:flex;align-items:center;cursor:pointer;color:#7E4114;font-size:.9375rem;text-decoration:underline;text-underline-offset:3px}.sf-m[open] summary{margin-bottom:8px}' +
    '.sf-out{margin:4px 0 0;padding:14px;border-radius:12px;background:#FAF6EF;border:1px solid rgba(42,32,22,.12)}' +
    'html body :is(.sfx,.sfind) .sf-need{margin:0!important;font-size:.9375rem!important;line-height:1.5!important;color:#6B6256!important}' +
    '.sf-res+.sf-res{margin-top:12px;padding-top:12px;border-top:1px solid rgba(42,32,22,.12)}' +
    'html body :is(.sfx,.sfind) .sf-k{margin:0 0 2px!important;font-size:.8125rem!important;font-weight:600;color:#7E4114!important;text-transform:uppercase;letter-spacing:.06em}[dir=rtl] .sf-k{letter-spacing:0;text-transform:none}' +
    'html body :is(.sfx,.sfind) .sf-big{margin:0 0 6px!important;font-size:1.25rem!important;line-height:1.35!important;color:#2A2016!important}html body :is(.sfx,.sfind) .sf-big b{font-weight:700}html body :is(.sfx,.sfind) .sf-big span{display:block;font-size:1rem;color:#4A4136}' +
    'html body :is(.sfx,.sfind) .sf-why{margin:0 0 6px!important;font-size:.9375rem!important;line-height:1.5!important;color:#2A2016!important}' +
    'html body :is(.sfx,.sfind) .sf-note{margin:6px 0 0!important;font-size:.9375rem!important;line-height:1.5!important;color:#7E4114!important}html body :is(.sfx,.sfind) .sf-alts{margin:6px 0 0!important;font-size:.9375rem!important}.sf-alts a{color:#7E4114}' +
    '.sf-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.sf-pick{flex:1 1 auto;min-height:48px;padding:0 18px;border:0;border-radius:999px;background:#2A2016;color:#FAF6EF;font:600 1rem Jost,system-ui,sans-serif;cursor:pointer}' +
    '.sf-pick2{background:#fff;color:#2A2016;border:1px solid #2A2016}' +
    'html body :is(.sfx,.sfind) .sf-fine{margin:10px 0 0!important;font-size:.8125rem!important;line-height:1.5!important;color:#6B6256!important}' +
    '.sfx[hidden]{display:none!important}' +
    '.sfx{position:fixed;inset:0;z-index:1000;background:rgba(42,32,22,0);display:flex;align-items:flex-end;justify-content:center;transition:background .2s}.sfx.on{background:rgba(42,32,22,.5)}' +
    '.sfx-p{width:100%;max-width:560px;max-height:90vh;max-height:90dvh;overflow:auto;background:#FAF6EF;color:#2A2016;border-radius:22px 22px 0 0;padding:6px 16px calc(18px + env(safe-area-inset-bottom,0px));transform:translateY(100%);transition:transform .25s cubic-bezier(.2,.8,.2,1);box-sizing:border-box;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}' +
    '.sfx.on .sfx-p{transform:none}' +
    '.sfx-h{position:sticky;top:-6px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 0 10px;background:#FAF6EF;z-index:1}' +
    '.sfx-h h2{margin:0;font:600 1.6rem/1.15 "Cormorant Garamond",Georgia,serif;color:#2A2016;outline:none}[dir=rtl] .sfx-h h2{font-family:Amiri,"Cormorant Garamond",serif}' +
    '.sfx-x{width:44px;height:44px;border:0;border-radius:50%;background:#fff;color:#2A2016;font-size:26px;line-height:1;cursor:pointer;box-shadow:0 1px 4px rgba(42,32,22,.18)}' +
    '.sf-seg button:focus-visible,.sf-s:focus-visible,.sf-pick:focus-visible,.sf-open:focus-visible,.sfx-x:focus-visible,.sf-m summary:focus-visible{outline:2px solid #7E4114;outline-offset:2px}' +
    'html.sfx-on{overflow:hidden}' +
    '@media(min-width:900px){.sfx{align-items:center}.sfx-p{border-radius:22px;max-height:86vh;padding-bottom:20px}}' +
    '@media(prefers-reduced-motion:reduce){.sfx,.sfx-p{transition:none}}' +
    '[dir=rtl] .sf-s,[dir=rtl] .sf-seg button,[dir=rtl] .sf-pick,[dir=rtl] .sf-open{font-family:inherit}';
  function all() {
    if (!document.getElementById('sfCss')) { var s = document.createElement('style'); s.id = 'sfCss'; s.textContent = CSS; document.head.appendChild(s); }
    [].forEach.call(document.querySelectorAll('[data-sizefinder]'), init);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', all); else all();
  window.SBSizeFinder = { body: body, garment: garment, bands: bands };
})();
