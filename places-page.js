/* ==========================================================================
   Location guide pages (27 Sep 2026)
   Faheem: "realistic, useful guides … accurate … expandable sections instead of
   throwing all the information on the users … relevant graphics … motion design".
   Built from content/locations/<id>.json. Every fact on these pages comes from
   the research files (sources listed on the page); the graphics are drawn from
   the same data (GPS, months) or computed in the browser (sun, moon) — nothing
   on them is invented.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const GEO = JSON.parse(fs.readFileSync(path.join(__dirname, 'content/geo/gulf-map.json'), 'utf8'));
const ORIGINS = {
  dubai: { name: 'Dubai', lat: 25.2048, lng: 55.2708 },
  abudhabi: { name: 'Abu Dhabi', lat: 24.4539, lng: 54.3773 }
};
/* 8 Oct 2026: hike guides that start from a place are linked from that place's page */
const HIKES_BY_PLACE = (() => { const m = {}; const dir = path.join(__dirname, 'content/hikes');
  try { fs.readdirSync(dir).filter(f => f.endsWith('.json')).forEach(f => { const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (d.placeSlug) (m[d.placeSlug] = m[d.placeSlug] || []).push(d); }); } catch (e) {}
  return m; })();
const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function paras(text) { return String(text || '').split(/\n\n+/).filter(Boolean).map(p => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join(''); }
function xy(lat, lng) { return [(lng - GEO.lon0) * GEO.kx * GEO.s, (GEO.lat1 - lat) * GEO.s]; }
function km(a, b) {
  const R = 6371, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function originFor(l) {
  const d = String(l.distance || '');
  const iAD = d.search(/Abu Dhabi/i), iDX = d.search(/Dubai/i);
  if (iAD !== -1 && (iDX === -1 || iAD < iDX)) return ORIGINS.abudhabi;
  if (iDX !== -1) return ORIGINS.dubai;
  return km(l, ORIGINS.abudhabi) < km(l, ORIGINS.dubai) ? ORIGINS.abudhabi : ORIGINS.dubai;
}

/* ---------- icons: one stroke family, 24px grid ---------- */
const I = {
  car: '<path d="M4 15.5V12l2-5h12l2 5v3.5M4 15.5h16M4 15.5V18h2.5v-2.5M20 15.5V18h-2.5v-2.5"/><circle cx="7.5" cy="13" r=".6"/><circle cx="16.5" cy="13" r=".6"/>',
  fourwd: '<path d="M3 14l2-6h11l3 3h2v3M3 14h18M3 14v2M21 14v2"/><circle cx="7" cy="17" r="2.2"/><circle cx="17" cy="17" r="2.2"/>',
  boat: '<path d="M3 15h18l-2.5 4h-13zM12 4v11M12 5l6 8h-6"/>',
  foot: '<path d="M9 21l2-6-2-3 1-5M10 7l4 2 2 3M13 15l2 6M10 4.5a1.5 1.5 0 1 0 0-.01"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  ticket: '<path d="M4 8h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/><path d="M14 8v10" stroke-dasharray="1.6 1.8"/>',
  door: '<path d="M6 21V4h12v17M3 21h18M14.5 12.5h.01"/>',
  wc: '<path d="M7 6.5a1 1 0 1 0 0-.01M17 6.5a1 1 0 1 0 0-.01M5 21v-6H4l1.5-6h3L10 15H9v6M15 21v-7M19 21v-7M14.5 9h5v5h-5z"/>',
  food: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 21V3c-2 1.5-3 4-3 7h3"/>',
  shade: '<path d="M3 11a9 7 0 0 1 18 0zM12 11v10M9 21h6"/>',
  signal: '<path d="M4 20v-3M9 20v-6M14 20v-9M19 20V5"/>',
  pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  shield: '<path d="M12 3l7.5 3v6c0 4.5-3.3 7.8-7.5 9-4.2-1.2-7.5-4.5-7.5-9V6z"/><path d="M12 8.5v4.5M12 16h.01"/>',
  scroll: '<path d="M7 4h11a2 2 0 0 1 2 2v1h-4M7 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7M7 4a2 2 0 0 1 2 2v12M11 10h4M11 14h4"/>',
  bag: '<path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2"/>',
  q: '<circle cx="12" cy="12" r="8.5"/><path d="M9.8 9.5a2.3 2.3 0 1 1 3.2 2.1c-.7.3-1 .8-1 1.5v.4M12 16.5h.01"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  tee: '<path d="M8 4l-5 3 2 4 3-1.5V20h8V9.5l3 1.5 2-4-5-3a4 4 0 0 1-8 0z"/>'
};
function icon(k, cls) { return `<svg class="lg-ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${I[k] || ''}</svg>`; }

const VEHICLE = {
  '2wd': ['car', 'Any car', 'A normal car gets you there'],
  '4wd': ['fourwd', '4x4 needed', 'A 4x4 for the last stretch'],
  'high-clearance': ['fourwd', 'High clearance', 'An SUV or 4x4 is safer on the last stretch'],
  'boat': ['boat', 'By boat', 'The last leg is on the water'],
  'on-foot': ['foot', 'Park and walk', 'The last leg is on foot'],
  'tour-only': ['route', 'Tour only', 'Visits are by booked tour'],
  /* 1 Oct 2026: sources disagree on the last stretch (Al Quaa); shown honestly rather than picked */
  'disputed': ['fourwd', 'Car or 4x4?', 'Sources differ on the last stretch; a 4x4 for the dunes']
};
const FAC = { yes: 'Yes', no: 'None', nearby: 'Nearby', some: 'Some', good: 'Good', patchy: 'Patchy', none: 'None', unknown: 'Not confirmed' };

/* ---------- the month strip (data: months[12] = 2 best / 1 possible / 0 avoid) ---------- */
function monthStrip(l, big) {
  const m = Array.isArray(l.months) && l.months.length === 12 ? l.months : null;
  if (!m) return '';
  const cells = m.map((v, i) => `<li class="lg-m m${v}" style="--i:${i}" title="${MONTHS_LONG[i]}: ${v === 2 ? 'best' : v === 1 ? 'possible' : 'avoid'}"><span aria-hidden="true">${MONTHS[i]}</span><span class="lg-sr">${MONTHS_LONG[i]}: ${v === 2 ? 'best' : v === 1 ? 'possible' : 'avoid'}</span></li>`).join('');
  return `<div class="lg-months${big ? ' big' : ''}" data-months="${m.join('')}"><ol aria-label="Best months to visit">${cells}</ol>${big ? '<p class="lg-mkey"><i class="m2"></i>Best <i class="m1"></i>Possible <i class="m0"></i>Avoid <span class="lg-now">This month is marked</span></p>' : ''}</div>`;
}

/* ---------- the route map: Dubai / Abu Dhabi to the place ---------- */
function routeMap(l) {
  if (typeof l.lat !== 'number' || typeof l.lng !== 'number') return '';
  const o = originFor(l);
  const [x1, y1] = xy(o.lat, o.lng), [x2, y2] = xy(l.lat, l.lng);
  // frame both points, 4:3, at least 380 units wide, inside the map
  let cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  let w = Math.max(380, Math.abs(x2 - x1) * 1.7 + 120, (Math.abs(y2 - y1) * 1.7 + 120) * 4 / 3);
  w = Math.min(w, GEO.w); const h = w * 3 / 4;
  let vx = Math.min(Math.max(cx - w / 2, 0), GEO.w - w), vy = Math.min(Math.max(cy - h / 2, 0), GEO.h - h);
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const bend = Math.min(60, len * 0.22);
  const qx = (x1 + x2) / 2 - dy / len * bend, qy = (y1 + y2) / 2 + dx / len * bend;
  const sw = w / 380; // keep strokes and labels the same apparent size at any zoom
  const lab = (x, y, t, anchor, cls) => { if (anchor === 'start') x = Math.max(x - 10 * sw, vx + 8 * sw); if (anchor === 'end') x = Math.min(x + 10 * sw, vx + w - 8 * sw); return `<text x="${x.toFixed(0)}" y="${y.toFixed(0)}" text-anchor="${anchor}" class="${cls}" style="font-size:${(15 * sw).toFixed(1)}px">${esc(t)}</text>`; };
  const left2 = x2 < x1;
  /* keep labels inside the frame: a point in the right third labels to its left, and vice versa */
  /* labels sit above or below their dot, away from the route line, and never leave the frame */
  const anc = (x, t) => { const half = t.length * 4.3 * sw; return x - half < vx + 8 * sw ? 'start' : x + half > vx + w - 8 * sw ? 'end' : 'middle'; };
  const km0 = Math.round(km(o, l));
  return `<figure class="lg-map" data-km="${km0}">
    <svg viewBox="${vx.toFixed(0)} ${vy.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}" role="img" aria-label="Map: ${esc(l.name)} relative to ${o.name}">
      <rect x="${vx.toFixed(0)}" y="${vy.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" class="lg-sea"/>
      <path class="lg-land2" d="${GEO.SA}${GEO.OM}${GEO.QA}" style="stroke-width:${(1.2 * sw).toFixed(2)}"/>
      <path class="lg-land" d="${GEO.AE}" style="stroke-width:${(1.6 * sw).toFixed(2)}"/>
      <path class="lg-route" d="M${x1.toFixed(1)},${y1.toFixed(1)} Q${qx.toFixed(1)},${qy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}" pathLength="1" style="stroke-width:${(3 * sw).toFixed(2)}"/>
      <circle class="lg-o" cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="${(6 * sw).toFixed(1)}"/>
      <circle class="lg-pulse" cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="${(9 * sw).toFixed(1)}"/>
      <circle class="lg-d" cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="${(7 * sw).toFixed(1)}"/>
      ${lab(x1, y1 + (y1 > y2 ? 24 : -13) * sw, o.name, anc(x1, o.name), 'lg-lo')}
      ${lab(x2, y2 + (y2 >= y1 ? 26 : -15) * sw, l.name, anc(x2, l.name), 'lg-ld')}
    </svg>
    <figcaption><span class="lg-km"><b class="lg-count" data-to="${km0}">${km0}</b> km from ${o.name} as the crow flies</span>${l.distance ? `<span class="lg-road">By road: ${esc(l.distance.replace(/^About /, 'about '))}</span>` : ''}</figcaption>
  </figure>`;
}

/* ---------- flash-flood explainer (wadis and mountains) ---------- */
function floodDiagram() {
  return `<figure class="lg-flood" aria-label="How a flash flood reaches a dry wadi">
    <svg viewBox="0 0 640 200" role="img" aria-hidden="true">
      <path class="fl-mtn" d="M0,150 L70,70 L120,110 L175,40 L240,125 L300,150 Z"/>
      <g class="fl-cloud"><ellipse cx="150" cy="30" rx="54" ry="18"/><ellipse cx="118" cy="36" rx="30" ry="14"/><ellipse cx="186" cy="36" rx="30" ry="14"/></g>
      <g class="fl-rain">${[110, 128, 146, 164, 182].map((x, k) => `<line x1="${x}" y1="50" x2="${x - 8}" y2="72" style="--k:${k}"/>`).join('')}</g>
      <path class="fl-bed" d="M240,150 C330,152 420,160 640,162 L640,200 L240,200 Z"/>
      <path class="fl-water" d="M240,150 C300,138 330,146 380,150 C420,153 440,148 470,152 L470,162 L240,162 Z"/>
      <g class="fl-walker"><circle cx="560" cy="126" r="5"/><path d="M560,131 L560,148 M560,137 L552,143 M560,137 L568,142 M560,148 L554,160 M560,148 L566,160"/></g>
      <text x="150" y="190" class="fl-t">Rain in the mountains</text><text x="560" y="190" class="fl-t" text-anchor="middle">Dry, sunny wadi</text>
    </svg>
    <figcaption>Rain you cannot see, far upstream, can send water down a dry wadi in minutes. If rain is forecast anywhere in the mountains, stay out of wadis and off wadi floors.</figcaption>
  </figure>`;
}

/* ---------- at a glance ---------- */
function glance(l) {
  const a = l.access || {}, v = VEHICLE[a.vehicle];
  const f = l.facilities || {}, gl = l.glance || {};
  const cell = (ic, k, val, sub) => val ? `<div class="lg-g"><span class="lg-gi">${icon(ic)}</span><span class="lg-gk">${k}</span><span class="lg-gv">${val}</span>${sub ? `<span class="lg-gs">${sub}</span>` : ''}</div>` : '';
  /* one short clause for the tile: up to the first full stop, semicolon or dash, then cut at a word */
  const short = (s, n) => { n = n || 48; s = String(s || '').trim(); let m = s.replace(/\s*\([^)]*\)/g, '').split(/(?<=[.;])\s|\s[—–]\s?/)[0].replace(/[.;,:]$/, '');
    if (m.length > n) { const re = /, (?=(?:to|for|then|and|before|after|when|so|but|or|which|ideally|including|plus|with|once|while|as|if|though|depending)\b)/g; let c = -1, x; while ((x = re.exec(m)) && x.index <= n) c = x.index; if (c > n * .4) m = m.slice(0, c); }
    if (m.length > n) { m = m.slice(0, n); m = m.slice(0, m.lastIndexOf(' ')).replace(/[,;:]$/, '') + '…'; } return esc(m); };
  const facs = ['toilets', 'food', 'shade', 'signal'].filter(k => f[k] && f[k] !== 'unknown')
    .map(k => `<span class="lg-f lg-f-${f[k]}">${icon(k === 'toilets' ? 'wc' : k)}<b>${k === 'toilets' ? 'Toilets' : k === 'food' ? 'Food' : k === 'shade' ? 'Shade' : 'Signal'}</b> ${FAC[f[k]] || esc(f[k])}</span>`).join('');
  return `<section class="lg-glance lg-rise" aria-label="At a glance">
    <div class="lg-gg">
      ${v ? cell(v[0], 'Getting there', gl.badge ? esc(gl.badge) : v[1], gl.how ? esc(gl.how) : (short(a.note, 64) || v[2])) : ''}
      ${cell('clock', 'Time needed', gl.time ? esc(gl.time) : short(l.timeNeeded, 56), '')}
      ${cell('sun', 'Best time', gl.best ? esc(gl.best) : short(l.bestTime), '')}
      ${cell('ticket', 'Cost', 'cost' in gl ? esc(gl.cost) : (l.fees ? short(l.fees, 56) : ''), '')}
    </div>
    ${facs ? `<div class="lg-facs">${facs}</div>` : ''}
    ${monthStrip(l, false)}
  </section>`;
}

/* ---------- a fold (expandable section) ---------- */
function fold(id, ic, title, teaser, inner, open) {
  if (!inner) return '';
  return `<details class="lg-fold lg-rise" id="${id}"${open ? ' open' : ''}><summary><span class="lg-fi">${icon(ic)}</span><span class="lg-ft"><h2 class="lg-fh">${title}</h2>${teaser ? `<small>${teaser}</small>` : ''}</span><span class="lg-fx" aria-hidden="true"></span></summary><div class="lg-fb">${inner}</div></details>`;
}
function teaserOf(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); if (s.length <= n) return esc(s); const c = s.slice(0, n); return esc(c.slice(0, c.lastIndexOf(' '))) + '…'; }

/* the product the slim buy bar should carry on this place page, if any */
function barProduct(l, ctx) {
  if (ctx.PRODUCT_BY_PLACE[l.id]) return ctx.PRODUCT_BY_PLACE[l.id];
  const pl = l.productLink; const p = pl && pl.slug ? ctx.PRODUCTS_ALL.find(x => x.id === pl.slug) : null; if (p) return p;
  const NEAR = { Mountains: 'hajar-mountains-regular', Wadis: 'hajar-mountains-regular', Dunes: 'empty-quarter-regular', Camping: 'empty-quarter-regular' };
  if (/Coast|Heritage/.test(l.category || '') || /beach|island|coast|khor|corniche/i.test(l.name || '')) return null;
  return NEAR[l.category] ? ctx.PRODUCTS_ALL.find(x => x.id === NEAR[l.category]) : null;
}
/* ---------- product panel: exact place, honest kin link, or none yet ---------- */
function productPanel(l, ctx) {
  const exact = ctx.PRODUCT_BY_PLACE[l.id];
  if (exact) return ctx.teeBlock(l).replace('<section class="teecta"', '<section id="tee" data-match="exact" class="teecta"');
  const pl = l.productLink;
  const p = pl && pl.slug ? ctx.PRODUCTS_ALL.find(x => x.id === pl.slug) : null;
  if (p) {
    const img = ctx.cardShots(p)[0];
    return `<section class="lg-kin lg-rise" id="tee" data-match="kin">
      <a class="lg-kin-img" href="/products/${p.id}/" tabindex="-1" aria-hidden="true">${img ? `<img src="${esc(img[0])}" alt="" loading="lazy" decoding="async" width="400" height="500">` : ''}</a>
      <div class="lg-kin-t"><span class="lg-eye">${icon('tee')} Wear the place</span>
        <h2>${esc(p.name)}</h2>
        <p>${esc(pl.sentence.replace('{{link}}', pl.anchor || p.name))}</p>
        <p class="lg-kin-m"><span class="sb-price" data-handle="${esc(p.id)}" data-aed="${esc(String(p.price))}">AED ${esc(String(p.price))}</span> <span class="sb-aed-only">&middot; 230gsm cotton &middot; any 2 tees AED 359</span><span class="sb-aed-alt">&middot; 230gsm cotton</span></p>
        <a class="btn" href="/products/${p.id}/">See the tee &rarr;</a>
      </div></section>`;
  }
  const cards = ctx.DESIGNS.filter(x => x.garment !== 'polo').slice(0, 3).map(x => {
    const im = ctx.cardShots(x)[0];
    return `<a class="lg-none-c" href="/products/${x.id}/">${im ? `<img src="${esc(im[0])}" alt="" loading="lazy" decoding="async" width="200" height="250">` : ''}<b>${esc(x.name.replace(/ — Regular$/, ''))}</b><span>${esc(x.placeName || '')}</span></a>`;
  }).join('');
  /* 4 Oct 2026 (CRO panel, idea 3): the nearest honest tee for mountain, wadi and dune
     places; the coast and heritage sites ask which place should be drawn next. */
  const NEAR = { Mountains: ['hajar-mountains-regular', 'Our mountain tee: the Hajar range, drawn in one contour line.'], Wadis: ['hajar-mountains-regular', 'Our mountain tee: the Hajar range above Wadi Naqab, drawn in one contour line.'], Dunes: ['empty-quarter-regular', 'Our desert tee: the Liwa sunset, embroidered tone on tone.'], Camping: ['empty-quarter-regular', 'Our desert tee: the Liwa sunset, embroidered tone on tone.'] };
  const near = NEAR[l.category] && ctx.PRODUCTS_ALL.find(x => x.id === NEAR[l.category][0]);
  const coastal = /Coast|Heritage/.test(l.category || '') || /beach|island|coast|khor|corniche/i.test(l.name || '');
  if (near && !coastal) {
    const img = ctx.cardShots(near)[0];
    return `<section class="lg-kin lg-rise" id="tee" data-match="near">
      <a class="lg-kin-img" href="/products/${near.id}/" tabindex="-1" aria-hidden="true">${img ? `<img src="${esc(img[0])}" alt="" loading="lazy" decoding="async" width="400" height="500">` : ''}</a>
      <div class="lg-kin-t"><span class="lg-eye">${icon('tee')} Not this place, but the same kind of ground</span>
        <h2>${esc(near.name)}</h2>
        <p>${esc(NEAR[l.category][1])} We have not drawn ${esc(l.name)} yet.</p>
        <p class="lg-kin-m"><span class="sb-price" data-handle="${esc(near.id)}" data-aed="${esc(String(near.price))}">AED ${esc(String(near.price))}</span> <span class="sb-aed-only">&middot; 230gsm cotton &middot; any 2 tees AED 359</span></p>
        <a class="btn" href="/products/${near.id}/">See the tee &rarr;</a>
      </div></section>`;
  }
  return `${ctx.askBlock ? ctx.askBlock(l.name, l.category).replace('<section class="askcta"', '<section id="tee" data-match="none" class="askcta lg-rise"') : ''}<section class="lg-none lg-rise"><span class="lg-eye">${icon('tee')} The places we have drawn</span>
    <div class="lg-none-g">${cards}</div>
    <a class="btn ghost" href="/t-shirts/">See all t-shirts &rarr;</a></section>`;
}

/* ---------- packing: matched to how you actually get there ---------- */
function packFor(l, PACKING) {
  const v = (l.access || {}).vehicle;
  const wadi = l.category === 'Wadis' || /^wadi-/.test(l.id);
  const allow = tag => {
    if (tag === 'Dunes' || tag === 'Camping') return v === '4wd' || v === 'high-clearance' || v === 'disputed' || l.category === 'Dunes';
    if (tag === 'Wadis') return wadi;
    if (tag === 'Coast') return l.category === 'Coast';
    if (tag === 'Mountains') return l.category === 'Mountains' || wadi;
    return false;
  };
  return PACKING.filter(it => {
    const s = it.show || [];
    if (!s.length) return true;
    if (s.indexOf('Overnight') !== -1) return l.overnight !== false;
    if (/Stargazing/.test(it.group)) return !!l.darkSky;
    return s.some(allow);
  }).map(it => ({ group: it.group.replace(/^\S+\s/, ''), name: it.name, qty: it.qty || '', note: it.note || '', overnight: (it.show || []).indexOf('Overnight') !== -1 }));
}

function safetyExtra(l) {
  return `<div class="lg-sos"><span class="lg-sos-h">${icon('shield')} In an emergency</span>
    <ul><li><b>999</b> Police</li><li><b>998</b> Ambulance</li><li><b>997</b> Civil Defence</li></ul>
    <p>Weather warnings: <a href="https://www.ncm.gov.ae/" target="_blank" rel="noopener">National Center of Meteorology</a>. Tell someone where you are going and when you will be back.</p></div>`;
}


/* 1 Oct 2026: tables inside sections (SEO handover: comparison and climate tables).
   { caption, head:[...], rows:[[...]], note, source:{label,url} }. Cells are plain text;
   a cell written as {t, href} becomes a link. Scrolls sideways inside its own box on phones. */
function tableHtml(t) {
  if (!t || !Array.isArray(t.rows) || !t.rows.length) return '';
  const cell = c => (c && typeof c === 'object' && c.href) ? `<a href="${esc(c.href)}">${esc(c.t)}</a>` : esc(c == null ? '' : c);
  const head = Array.isArray(t.head) ? `<thead><tr>${t.head.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>` : '';
  const body = t.rows.map(r => `<tr>${r.map((c, i) => i === 0 && t.rowHeads !== false ? `<th scope="row">${cell(c)}</th>` : `<td>${cell(c)}</td>`).join('')}</tr>`).join('');
  const src = t.source && t.source.url ? ` Source: <a href="${esc(t.source.url)}" target="_blank" rel="noopener nofollow">${esc(t.source.label || t.source.url)}</a>.` : '';
  const note = (t.note || src) ? `<p class="sb-tnote">${esc(t.note || '')}${src}</p>` : '';
  const wide = Array.isArray(t.head) && t.head.length > 3;
  return `${wide ? '<p class="sb-swipe" aria-hidden="true">Swipe the table sideways to see every column →</p>' : ''}<div class="sb-twrap" role="region" aria-label="${esc(t.caption || 'Table')}" tabindex="0"><table class="sb-table">${t.caption ? `<caption>${esc(t.caption)}</caption>` : ''}${head}<tbody>${body}</tbody></table></div>${note}`;
}
const TABLE_CSS = `.sb-twrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:14px 0 6px;border:1px solid rgba(42,32,22,.14);border-radius:12px;background:#fff}
.sb-table{border-collapse:collapse;width:100%;min-width:520px;font-size:14px;line-height:1.4;font-variant-numeric:tabular-nums}
.sb-table caption{caption-side:top;text-align:left;padding:10px 12px 4px;font-weight:600;font-size:14px;color:#2A2016}
.sb-table th,.sb-table td{padding:8px 10px;border-bottom:1px solid rgba(42,32,22,.1);text-align:left;vertical-align:top}
.sb-table thead th{border-bottom:2px solid rgba(42,32,22,.2);font-size:12.5px;letter-spacing:.02em;color:#4A3C2C;background:#FAF6EF;white-space:nowrap}
.sb-table tbody th{font-weight:600;color:#2A2016}
.sb-table tbody tr:last-child th,.sb-table tbody tr:last-child td{border-bottom:none}
.sb-table a{color:#7A4B0C;text-decoration:underline;text-underline-offset:2px}
.sb-tnote{font-size:13px;color:#5C5346;margin:4px 0 14px}
.sb-tnote a{color:#7A4B0C}
.sb-swipe{display:none;font-size:12.5px;color:#5C5346;margin:12px 0 -6px}
@media (max-width:600px){.sb-swipe{display:block}.sb-table tbody th,.sb-table thead th:first-child{position:sticky;left:0;z-index:1;background:#FAF6EF;box-shadow:1px 0 0 rgba(42,32,22,.1)}.sb-table tbody th{background:#fff;min-width:96px}}`;

function sourcesList(l) {
  const s = Array.isArray(l.sources) ? l.sources.filter(x => x && x.url) : [];
  if (!s.length) return '';
  return `<ol class="lg-src">${s.map(x => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener nofollow">${esc(x.label || x.url)}</a></li>`).join('')}</ol>`;
}

function fmtDate(iso) { const d = new Date(iso + 'T00:00:00Z'); return isNaN(d) ? '' : `${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`; }

function renderPlace(l, ctx) {
  const g = l.guide || {};
  const wadiish = l.category === 'Wadis' || l.category === 'Mountains' || /^wadi-/.test(l.id);
  const hasPhoto = !!l.cover;
  const credit = l.photoCredit && l.photoCredit.author
    ? `<p class="lg-credit">Photo: <a href="${esc(l.photoCredit.page || '#')}" target="_blank" rel="noopener nofollow">${esc(l.photoCredit.author)}</a>, <a href="${esc(l.photoCredit.licenseUrl || '#')}" target="_blank" rel="noopener nofollow">${esc(l.photoCredit.license || '')}</a>, Wikimedia Commons (${esc(l.photoCredit.edits || 'resized')})${l.photoCredit.note ? '. ' + esc(l.photoCredit.note) : ''}</p>` : '';
  const nearby = ctx.locations.filter(x => x.id !== l.id && typeof x.lat === 'number')
    .map(x => ({ x, d: km(l, x) })).sort((a, b) => a.d - b.d).slice(0, 4);
  const exact = !!ctx.PRODUCT_BY_PLACE[l.id];
  const tabs = [['overview', 'Overview'], g.gettingThere && ['getting-there', 'Getting there'], (g.whenToGo || l.months) && ['when-to-go', 'When to go'],
    g.safety && ['safety', 'Safety'], ['pack', 'Pack'], ['faq', 'FAQ'], ['tee', 'Wear the place']].filter(Boolean);

  const hero = `
  <section class="loc-hero lg-hero${hasPhoto ? ' has-photo' : ''}" style="--hero-grad:${ctx.CAT_BG[l.category] || ctx.CAT_BG.Dunes}">
    ${hasPhoto ? `<img class="lg-hero-img" src="${esc(l.cover)}" alt="${esc(l.coverAlt || (l.photoCredit && l.photoCredit.what) || l.name)}" fetchpriority="high" decoding="async" style="object-position:${esc(l.coverFocus || '50% 50%')}">` : ''}
    <div class="glow"></div>
    <svg class="dune-far" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true"><path fill="#8B4E63" d="M0,220 C300,150 560,250 820,200 C1080,150 1300,220 1440,190 L1440,320 L0,320 Z"/></svg>
    <svg class="dune-near" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true"><path fill="#FAF6EF" d="M0,270 C320,210 620,290 940,250 C1180,220 1330,270 1440,255 L1440,320 L0,320 Z"/></svg>
    <div class="grain"></div>
    <div class="loc-hero-inner">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/places/">Places</a> &rsaquo; <a href="/places/#cat-${esc(String(l.category || '').toLowerCase())}">${esc(l.category)}</a></nav>
      <h1>${esc(l.name)}</h1>
      ${l.nameAr ? `<p class="lg-ar" lang="ar" dir="rtl">${esc(l.nameAr)}</p>` : ''}
      <p class="lede">${esc(l.area || l.emirate)}${l.area && l.area.indexOf(l.emirate) === -1 ? ' &middot; ' + esc(l.emirate) : ''}</p>
      <div class="lg-chips"><span>${esc(l.category)}</span><span>${esc(l.difficultyLabel || l.difficulty)}</span>${l.season ? `<span>Best ${esc(l.season)}</span>` : ''}</div>
      <div class="lg-hero-row"><div class="wx" id="wx" data-lat="${l.lat}" data-lng="${l.lng}">Loading live weather…</div>
      <button type="button" id="share-btn" class="lg-share">${icon('link')} Share this place</button></div>
    </div>
    ${credit}
  </section>`;

  const main = `
  <nav class="lg-tabs" aria-label="On this page"><div class="lg-tabs-in">${tabs.map(t => `<a href="#${t[0]}">${t[1]}</a>`).join('')}</div></nav>
  <main class="lg-main">
    <div class="lg-side">${exact ? ctx.miniTee(l.id) : ''}
    ${glance(l)}</div>
    <div class="lg-col">
    ${l.notice && (!l.noticeUntil || new Date().toISOString().slice(0, 10) <= l.noticeUntil) ? `<p class="lg-notice" role="note"${l.noticeUntil ? ` data-until="${esc(l.noticeUntil)}"` : ''}><strong>${esc(l.noticeLabel || 'Before you go')}:</strong> ${esc(l.notice)}</p>` : ''}
    ${Array.isArray(l.quick) && l.quick.length ? `<section class="lg-quick" aria-labelledby="lg-quick-h"><h2 id="lg-quick-h">Quick answers</h2><dl>${l.quick.map(q => `<div><dt>${esc(q[0])}</dt><dd>${esc(q[1])}</dd></div>`).join('')}</dl></section>` : ''}
    <section id="overview" class="lg-over lg-rise">
      <div class="content">${ctx.withProductLink(paras(l.body || l.desc), exact ? l.productLink : null)}</div>
      <p class="lg-checked">${icon('eye')} Last checked ${fmtDate(l.lastChecked || '2026-09-27')}. Facts on this page come from the sources listed at the bottom. <a href="https://wa.me/971585449946?text=${encodeURIComponent('Something on the ' + l.name + ' page looks out of date: ')}" target="_blank" rel="noopener">Spotted something out of date?</a></p>
    </section>
    ${Array.isArray(l.sections) ? l.sections.map((x, i) => fold(x.id || ('guide-' + (i + 1)), 'scroll', esc(x.h2), teaserOf(x.body, 90), `<div class="content">${paras(x.body)}</div>${tableHtml(x.table)}`, !!x.open)).join('') : ''}
    ${fold('getting-there', 'route', 'Getting there', teaserOf(g.gettingThere, 90),
      g.gettingThere || typeof l.lat === 'number' ? `${routeMap(l)}<div class="content">${paras(g.gettingThere)}</div>
      <div class="lg-gps">${icon('pin')}<span>GPS <b>${l.lat}, ${l.lng}</b></span></div>
      <div class="cta"><a class="btn" href="https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}" target="_blank" rel="noopener">Open in Google Maps</a><a class="btn alt" href="https://maps.apple.com/?ll=${l.lat},${l.lng}&q=${encodeURIComponent(l.name)}" target="_blank" rel="noopener">Apple Maps</a></div>` : '', false)}
    ${fold('when-to-go', 'cal', 'When to go', teaserOf(g.whenToGo, 90),
      (g.whenToGo || l.months) ? `${monthStrip(l, true)}<div class="content">${paras(g.whenToGo)}</div>
      <div class="lg-day" data-lat="${l.lat}" data-lng="${l.lng}">
        <div class="lg-sky"><svg viewBox="0 0 320 150" aria-hidden="true"><path class="lg-arc" d="M20,130 Q160,-30 300,130"/><line class="lg-hz" x1="0" y1="130" x2="320" y2="130"/><circle class="lg-sunb" r="11" cx="20" cy="130"/></svg>
          <div class="lg-stars" aria-hidden="true"></div></div>
        <label class="lg-slide"><span>Drag through the day</span><input type="range" min="0" max="1000" value="500" aria-label="Time of day"></label>
        <p class="lg-dayt" aria-live="polite"></p>
        <p class="lg-sunt"></p>
      </div>
      ${l.darkSky ? `<div class="lg-moons"><span class="lg-eye">${icon('moon')} The next 14 nights</span><div class="lg-moonrow"></div><p class="lg-moonk">Darkest nights are around the new moon, when the Milky Way shows best. Moon phase is calculated, not forecast weather.</p></div>` : ''}` : '', false)}
    ${fold('on-site', 'eye', 'What to do there', teaserOf(g.onSite, 90), g.onSite ? `<div class="content">${paras(g.onSite)}</div>` : '', false)}
    ${fold('safety', 'shield', 'Safety and rules', teaserOf(g.safety, 90),
      g.safety ? `${wadiish ? floodDiagram() : ''}<div class="content">${paras(g.safety)}</div>${safetyExtra(l)}` : '', false)}
    ${fold('heritage', 'scroll', 'Heritage, nature and etiquette', teaserOf(g.heritage || g.etiquette, 90),
      (g.heritage || g.etiquette) ? `<div class="content">${paras(g.heritage)}${g.etiquette ? `<p class="lg-etq"><b>Etiquette.</b> ${esc(g.etiquette)}</p>` : ''}</div>` : '', false)}
    ${productPanel(l, ctx)}${ctx.guideBar ? ctx.guideBar(barProduct(l, ctx)) : ''}
    <section class="pack lg-rise" id="pack">
      <h2>${icon('bag')} What to pack for ${esc(l.name)}</h2>
      <p class="lg-pack-sub">Matched to how you get there${l.overnight === false ? '' : ' and how long you stay'}. Tap items as you pack them; this list is saved on your phone.</p>
      <div class="pack-controls">
        <div class="grp" role="group" aria-label="Group size">
          <button class="pack-btn" type="button" aria-pressed="false" data-grp="1">Solo</button>
          <button class="pack-btn on" type="button" aria-pressed="true" data-grp="4">2&ndash;4</button>
          <button class="pack-btn" type="button" aria-pressed="false" data-grp="8">5&ndash;10</button>
          <button class="pack-btn" type="button" aria-pressed="false" data-grp="12">10+</button>
        </div>
        ${l.overnight === false ? '' : `<div class="grp" role="group" aria-label="Trip type">
          <button class="pack-btn${l.packDefault === 'overnight' ? '' : ' on'}" type="button" aria-pressed="${l.packDefault === 'overnight' ? 'false' : 'true'}" data-ov="0">Day trip</button>
          <button class="pack-btn${l.packDefault === 'overnight' ? ' on' : ''}" type="button" aria-pressed="${l.packDefault === 'overnight' ? 'true' : 'false'}" data-ov="1">Overnight</button>
        </div>`}
      </div>
      <div class="lg-bagbar"><span class="lg-bag">${icon('bag')}<i class="lg-bagfill"></i></span><span class="lg-bagt" aria-live="polite">0 packed</span></div>
      <div id="pack-list"></div>
      <div class="lg-take" id="take">
        <h3>Take this list with you</h3>
        <p>Send it to yourself or the people you are going with. Ticked items are marked.</p>
        <div class="lg-take-b">
          <a class="btn alt" id="pk-wa" href="https://wa.me/" target="_blank" rel="noopener">${icon('link')} WhatsApp it</a>
          <a class="btn alt" id="pk-mail" href="mailto:">Email it</a>
          <button type="button" class="btn alt" id="pk-copy">Copy</button>
        </div>
        <form class="lg-cap" id="pk-cap" novalidate>
          <label for="pk-email">Emails about new places, drops and offers, and AED 50 off your first order over AED 150. Unsubscribe any time.</label>
          <div class="lg-cap-r"><input type="email" id="pk-email" name="email" inputmode="email" autocomplete="email" placeholder="you@email.com" required><button type="submit" class="btn">Send my code</button></div>
          <p class="lg-cap-m" aria-live="polite"></p>
        </form>
      </div>
    </section>
    ${(() => { const f = ctx.faqsFor(l); return f.length ? `<section class="faq lg-rise" id="faq"><h2>${icon('q')} Questions people ask about ${esc(l.name)}</h2>${f.map(q => `<details class="lg-q"><summary>${esc(q[0])}</summary><p>${esc(q[1])}</p></details>`).join('')}</section>` : ''; })()}
    ${ctx.igFor ? ctx.igFor(l.id).replace('class="ig-rail-sec"', 'class="ig-rail-sec lg-rise"') : ''}
    ${(HIKES_BY_PLACE[l.id] || []).length ? `<nav class="lg-guides lg-rise" aria-label="Hike guides from ${esc(l.name)}"><h2>Hike guides from ${esc(l.name)}</h2><div>${HIKES_BY_PLACE[l.id].map(h => `<a href="/trail/hikes/${h.slug}/">${esc(h.name)} (${esc(h.grade)}${h.n || h.official ? '' : ', unmarked'}) &rarr;</a>`).join('')}</div></nav>` : ''}
    ${ctx.guidesFor && ctx.guidesFor(l.id).length ? `<nav class="lg-guides lg-rise" aria-label="Guides that cover ${esc(l.name)}"><h2>Guides that include ${esc(l.name)}</h2><div>${ctx.guidesFor(l.id).map(g => `<a href="${g[0]}">${esc(g[1])} &rarr;</a>`).join('')}</div></nav>` : ''}
    ${sourcesList(l) ? `<details class="lg-fold lg-srcf lg-rise" id="sources"><summary><span class="lg-fi">${icon('link')}</span><span class="lg-ft"><b>Sources</b><small>Where the facts on this page come from</small></span><span class="lg-fx" aria-hidden="true"></span></summary><div class="lg-fb">${sourcesList(l)}${credit ? credit.replace('lg-credit', 'lg-credit2') : ''}</div></details>` : ''}
    ${nearby.length ? `<section class="related lg-rise"><h2>Near ${esc(l.name)}</h2><div class="cards">${nearby.map(n => ctx.locCard(n.x).replace('</strong>', `</strong><i class="lg-near">about ${Math.max(5, Math.round(n.d / 5) * 5)} km away</i>`)).join('')}</div><p class="lg-all"><a href="/places/">All places on the map &rarr;</a></p></section>` : ''}
    </div>
  </main>`;
  return { hero, main };
}

/* ---------- client script: weather, share, pack, tabs, sun, moon, motion ---------- */
function clientScript(l, ctx, packItems) {
  return `<script>
(function(){
  var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* live weather */
  var wx=document.getElementById('wx');
  if(wx){var lat=wx.getAttribute('data-lat'),lng=wx.getAttribute('data-lng'),k=${JSON.stringify(ctx.WEATHER_KEY)};
    if(lat&&lng&&k){fetch('https://api.openweathermap.org/data/2.5/weather?lat='+lat+'&lon='+lng+'&appid='+k+'&units=metric').then(function(r){return r.json();}).then(function(d){if(d&&d.main){var c=(d.weather&&d.weather[0]&&d.weather[0].icon||'').slice(0,2);var ic={'01':'☀️','02':'🌤','03':'⛅','04':'☁️','09':'🌧','10':'🌦','11':'⛈','13':'❄️','50':'🌫'}[c]||'🌡';wx.classList.add('on');wx.innerHTML='<span class="wx-ic">'+ic+'</span><span class="wx-temp">'+Math.round(d.main.temp)+'°C</span><span class="wx-desc">'+(d.weather&&d.weather[0]?d.weather[0].description:'')+' now</span>';}else{wx.style.display='none';}}).catch(function(){wx.style.display='none';});}else{wx.style.display='none';}}
  /* share */
  var sb=document.getElementById('share-btn');
  if(sb){sb.addEventListener('click',function(){var data={title:${JSON.stringify(l.name + ' — Sahra & Beyond')},text:${JSON.stringify(l.desc || '')},url:location.href};
    if(window.gtag){gtag('event','share',{method:navigator.share?'native':'copy',location:${JSON.stringify(l.name)}});}
    if(navigator.share){navigator.share(data).catch(function(){});}else if(navigator.clipboard){navigator.clipboard.writeText(location.href).then(function(){var t=sb.innerHTML;sb.textContent='Link copied';setTimeout(function(){sb.innerHTML=t;},1800);});}});}
  /* packing list: remembers what you tick */
  var PACK=${JSON.stringify(packItems)},state={p:4,ov:${l.packDefault === 'overnight' ? 'true' : 'false'}},KEY='sb_pack_${l.id}',done={};
  try{done=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(e){}
  function qy(t){if(!t)return '';return String(t).replace(/\\{water\\}/g,4*state.p).replace(/\\{half\\}/g,Math.max(1,Math.ceil(state.p/2))).replace(/\\{p\\}/g,state.p);}
  function he(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function count(){var items=PACK.filter(function(it){return !it.overnight||state.ov;});var n=items.filter(function(it){return done[it.name];}).length;var t=document.querySelector('.lg-bagt'),f=document.querySelector('.lg-bagfill');if(t)t.textContent=n+' of '+items.length+' packed';if(f)f.style.transform='scaleY('+(items.length?n/items.length:0)+')';}
  function render(){var el=document.getElementById('pack-list');if(!el)return;var items=PACK.filter(function(it){return !it.overnight||state.ov;});var groups=[],idx={};items.forEach(function(it){if(!(it.group in idx)){idx[it.group]=groups.length;groups.push({h:it.group,items:[]});}groups[idx[it.group]].items.push(it);});
    el.innerHTML=groups.map(function(g){return '<div class="pack-grp-title">'+he(g.h)+'</div>'+g.items.map(function(it){var q=qy(it.qty);return '<button type="button" class="pack-row'+(done[it.name]?' done':'')+'" data-n="'+he(it.name)+'" aria-pressed="'+(done[it.name]?'true':'false')+'"><span class="pk-box" aria-hidden="true"></span><span class="pk-main"><span class="pk-name">'+he(it.name)+'</span>'+(it.note?'<span class="pk-note">'+he(it.note)+'</span>':'')+'</span>'+(q?'<span class="pk-qty">'+he(q)+'</span>':'')+'</button>';}).join('');}).join('');count();}
  document.addEventListener('click',function(e){var r=e.target.closest&&e.target.closest('.pack-row');if(!r)return;var n=r.getAttribute('data-n');done[n]=!done[n];if(!done[n])delete done[n];r.classList.toggle('done',!!done[n]);r.setAttribute('aria-pressed',done[n]?'true':'false');try{localStorage.setItem(KEY,JSON.stringify(done));}catch(err){}count();});
  document.querySelectorAll('[data-grp]').forEach(function(b){b.addEventListener('click',function(){state.p=parseInt(b.getAttribute('data-grp'),10);document.querySelectorAll('[data-grp]').forEach(function(x){x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',x===b?'true':'false');});render();});});
  document.querySelectorAll('[data-ov]').forEach(function(b){b.addEventListener('click',function(){state.ov=b.getAttribute('data-ov')==='1';document.querySelectorAll('[data-ov]').forEach(function(x){x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',x===b?'true':'false');});render();});});
  render();
  /* take the list with you: WhatsApp, email (their own mail app) or copy */
  function listText(){var items=PACK.filter(function(it){return !it.overnight||state.ov;}),g='',out=['Packing list: '+${JSON.stringify(l.name)}+' ('+state.p+(state.p===1?' person':' people')+(state.ov?', overnight':', day trip')+')'];
    items.forEach(function(it){if(it.group!==g){g=it.group;out.push('');out.push(g.toUpperCase());}var q=qy(it.qty);out.push((done[it.name]?'[x] ':'[ ] ')+it.name+(q?' ('+q+')':''));});
    out.push('');out.push('Guide: '+location.origin+location.pathname);return out.join('\\n');}
  function tg(n,p){try{if(window.gtag)gtag('event',n,p);}catch(e){}}
  var pw=document.getElementById('pk-wa'),pm=document.getElementById('pk-mail'),pc=document.getElementById('pk-copy');
  if(pw)pw.addEventListener('click',function(){pw.href='https://wa.me/?text='+encodeURIComponent(listText());tg('pack_share',{method:'whatsapp',location:${JSON.stringify(l.id)}});});
  if(pm)pm.addEventListener('click',function(){pm.href='mailto:?subject='+encodeURIComponent('Packing list: '+${JSON.stringify(l.name)})+'&body='+encodeURIComponent(listText());tg('pack_share',{method:'email',location:${JSON.stringify(l.id)}});});
  if(pc)pc.addEventListener('click',function(){var t=listText(),say=function(m){pc.textContent=m;setTimeout(function(){pc.textContent='Copy';},1800);};try{navigator.clipboard.writeText(t).then(function(){say('Copied');},function(){say('Copy failed');});}catch(e){say('Copy failed');}tg('pack_share',{method:'copy',location:${JSON.stringify(l.id)}});});
  var cap=document.getElementById('pk-cap');
  if(cap)cap.addEventListener('submit',function(e){e.preventDefault();var inp=cap.querySelector('input'),msg=cap.querySelector('.lg-cap-m'),btn=cap.querySelector('button'),em=(inp.value||'').trim();
    if(!/^[^\\s@]+@[^\\s@]+\\.[a-z]{2,}$/i.test(em)){msg.textContent='That email does not look right. Try again?';inp.focus();return;}
    btn.disabled=true;btn.textContent='Sending…';
    var save=function(){try{var w=JSON.parse(localStorage.getItem('sbw.v2')||'{}')||{};w.won=1;w.seen=1;localStorage.setItem('sbw.v2',JSON.stringify(w));}catch(err){}var tz=document.querySelector('.sbw-teaser');if(tz)tz.remove();};
    var clean=function(c){return String(c||'GOBEYOND50').replace(/[^A-Z0-9-]/gi,'');};
    var win=function(code){code=clean(code);save();cap.classList.add('won');msg.innerHTML='You are on the list. Your code: <b>'+code+'</b>, AED 50 off your first order over AED 150, one use per customer.';tg('guide_signup',{source:'guide-pack',location:${JSON.stringify(l.id)}});
      try{if(window.sbMeta&&window.sbMeta.track)window.sbMeta.track('Lead',{content_name:code});}catch(err){}};
    /* the request failed: be honest that nothing was saved, but keep the promised code (same rule as the offer pop-up) */
    var soft=function(){var code=clean();save();cap.classList.add('won');msg.innerHTML='We could not add you just now, so please try again later. Your code still works: <b>'+code+'</b>, AED 50 off your first order over AED 150, one use per customer.';};
    fetch('/api/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:em,source:'guide-pack-'+${JSON.stringify(l.id)}})}).then(function(r){if(r.status===400)throw new Error('email');if(!r.ok)throw new Error('server');return r.json().catch(function(){return {};}).then(function(j){if(j&&j.stored===false)throw new Error('server');return j&&j.code;});})
      .then(win,function(err){if(err&&err.message==='email'){msg.textContent='That email does not look right. Try again?';btn.disabled=false;btn.textContent='Send my code';return;}soft();});});
  /* tabs: open the fold you jump to, and follow the reader */
  var hdr=document.querySelector('.hdr,#nav');function hh(){var ps=hdr?getComputedStyle(hdr).position:'';var h=(hdr&&(ps==='sticky'||ps==='fixed'))?hdr.getBoundingClientRect().height:0;document.documentElement.style.setProperty('--lg-hdr',Math.max(0,Math.round(h))+'px');}hh();addEventListener('resize',hh,{passive:true});
  function openTo(id){var t=document.getElementById(id);if(!t)return;if(t.tagName==='DETAILS'&&!t.open){t.open=true;}}
  document.querySelectorAll('.lg-tabs a').forEach(function(a){a.addEventListener('click',function(){openTo(a.getAttribute('href').slice(1));if(window.gtag)gtag('event','place_tab',{tab:a.getAttribute('href').slice(1),location:${JSON.stringify(l.id)}});});});
  if(location.hash)openTo(location.hash.slice(1));
  var links=[].slice.call(document.querySelectorAll('.lg-tabs a')),secs=links.map(function(a){return document.getElementById(a.getAttribute('href').slice(1));});
  if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){var i=secs.indexOf(en.target);links.forEach(function(x,j){x.classList.toggle('on',j===i);});var a=links[i];if(a&&a.scrollIntoView&&a.parentNode){var p=a.parentNode;p.scrollTo({left:a.offsetLeft-p.clientWidth/2+a.clientWidth/2,behavior:RM?'auto':'smooth'});}}});},{rootMargin:'-45% 0px -50% 0px'});secs.forEach(function(s){if(s)io.observe(s);});}
  document.querySelectorAll('details.lg-fold').forEach(function(d){d.addEventListener('toggle',function(){if(d.open){d.classList.add('seen');if(window.gtag)gtag('event','place_fold_open',{fold:d.id,location:${JSON.stringify(l.id)}});var m=d.querySelector('.lg-map');if(m)m.classList.add('go');counters(d);}});});
  /* measure the guide-to-tee path: panel seen, and any tee link tapped, tagged by how
     closely the tee matches this place (exact / kin / none) */
  (function(){var tp=document.getElementById('tee'),mt=tp?tp.getAttribute('data-match')||'':'',loc=${JSON.stringify(l.id)};
    function g(n,p){try{if(window.gtag)gtag('event',n,p);}catch(e){}}
    if(tp&&'IntersectionObserver' in window){var seen=false,to=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting&&!seen){seen=true;g('place_tee_view',{match:mt,location:loc});to.disconnect();}});},{threshold:.4});to.observe(tp);}
    document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href*="/products/"],a[href="/t-shirts/"]');if(!a||!a.closest('main'))return;var where=a.closest('#tee')?'panel':(a.closest('.minitee')?'mini':(a.closest('.lg-over,.lg-body')?'story':'other'));g('place_tee_click',{match:mt,where:where,location:loc,href:a.getAttribute('href')});if(where==='panel'||where==='mini')g('wear_the_place_click',{match:mt,where:where,location:loc,product:(a.getAttribute('href').match(/products[/]([^/]+)/)||[])[1]||'all'});});
  })();
  /* motion: gentle rise as sections arrive (once), and number count-ups */
  function counters(root){(root||document).querySelectorAll('.lg-count:not(.done)').forEach(function(c){var to=+c.getAttribute('data-to');c.classList.add('done');if(RM||!to){c.textContent=to;return;}var t0=null;function step(ts){if(!t0)t0=ts;var k=Math.min(1,(ts-t0)/1750);c.textContent=Math.round(to*(1-Math.pow(1-k,3)));if(k<1)requestAnimationFrame(step);}requestAnimationFrame(step);});}
  if('IntersectionObserver' in window&&!RM){document.documentElement.classList.add('lg-anim');var ro=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){en.target.classList.add('in');ro.unobserve(en.target);}});},{rootMargin:'0px 0px -8% 0px'});document.querySelectorAll('.lg-rise').forEach(function(x){ro.observe(x);});}
  /* the month strip marks this month */
  var mo=new Date().getMonth();document.querySelectorAll('.lg-months li').forEach(function(li,i){if(i%12===mo)li.classList.add('now');});
  /* hero parallax: the dunes drift apart, the photo sinks slower than the page */
  var hero=document.querySelector('.lg-hero');
  if(hero&&!RM&&!(window.matchMedia&&matchMedia('(max-width: 760px), (pointer: coarse)').matches)){var far=hero.querySelector('.dune-far'),near=hero.querySelector('.dune-near'),img=hero.querySelector('.lg-hero-img'),tick=false;
    function par(){tick=false;var y=Math.min(scrollY,hero.offsetHeight);if(far)far.style.transform='translateY('+(14+y*0.06)+'%)';if(near)near.style.transform='translateY('+(-y*0.08)+'px)';if(img)img.style.transform='translateY('+(y*0.28)+'px) scale(1.06)';}
    addEventListener('scroll',function(){if(!tick){tick=true;requestAnimationFrame(par);}},{passive:true});par();}
  /* sun through the day (computed for this place and date; Dubai time) */
  var day=document.querySelector('.lg-day');
  if(day){var LAT=+day.getAttribute('data-lat'),LNG=+day.getAttribute('data-lng');
    function sunT(dt){var rad=Math.PI/180,dayMs=864e5,J1970=2440588,J2000=2451545,d=dt.valueOf()/dayMs-0.5+J1970-J2000,lw=rad*-LNG,phi=rad*LAT,n=Math.round(d-0.0009-lw/(2*Math.PI)),ds=0.0009+lw/(2*Math.PI)+n,M=rad*(357.5291+0.98560028*ds),C=rad*(1.9148*Math.sin(M)+0.02*Math.sin(2*M)+0.0003*Math.sin(3*M)),L=M+C+rad*102.9372+Math.PI,dec=Math.asin(Math.sin(rad*23.4397)*Math.sin(L)),Jn=J2000+ds+0.0053*Math.sin(M)-0.0069*Math.sin(2*L),w=Math.acos((Math.sin(rad*-0.833)-Math.sin(phi)*Math.sin(dec))/(Math.cos(phi)*Math.cos(dec))),a=0.0009+(w+lw)/(2*Math.PI)+n,Js=J2000+a+0.0053*Math.sin(M)-0.0069*Math.sin(2*L),Jr=Jn-(Js-Jn);function fj(j){return new Date((j+0.5-J1970)*dayMs);}return{rise:fj(Jr),set:fj(Js)};}
    function hm(dt){return dt.toLocaleTimeString('en-GB',{timeZone:'Asia/Dubai',hour:'2-digit',minute:'2-digit'});}
    var now=new Date(),T=sunT(now),r0=T.rise.getTime()-90*6e4,r1=T.set.getTime()+120*6e4;
    var st=day.querySelector('.lg-sunt');if(st)st.innerHTML='Today: sunrise <b>'+hm(T.rise)+'</b> &middot; sunset <b>'+hm(T.set)+'</b> (UAE time)';
    var arc=day.querySelector('.lg-arc'),sun=day.querySelector('.lg-sunb'),sky=day.querySelector('.lg-sky'),lab=day.querySelector('.lg-dayt'),rg=day.querySelector('input'),L=arc.getTotalLength();
    var stars=day.querySelector('.lg-stars');if(stars){var h='';for(var i=0;i<28;i++){h+='<i style="left:'+(Math.random()*100).toFixed(1)+'%;top:'+(Math.random()*62).toFixed(1)+'%;animation-delay:'+(Math.random()*3).toFixed(2)+'s"></i>';}stars.innerHTML=h;}
    function show(t){var rise=T.rise.getTime(),set=T.set.getTime(),f=(t-rise)/(set-rise),up=f>=0&&f<=1,x,y;
      if(up){var p=arc.getPointAtLength(L*f);x=p.x;y=p.y;}else{x=f<0?20:300;y=146;}
      sun.setAttribute('cx',x.toFixed(1));sun.setAttribute('cy',y.toFixed(1));
      var mins=(t-rise)/6e4,left=(set-t)/6e4,ph;
      if(!up){ph=t<rise?'night':'night';}else if(mins<60||left<60){ph='golden';}else if(f>0.35&&f<0.65){ph='noon';}else{ph='day';}
      if(up&&left<0){ph='night';}
      if(!up&&t>set&&t<set+40*6e4)ph='dusk';if(!up&&t<rise&&t>rise-40*6e4)ph='dawn';
      sky.setAttribute('data-ph',ph);
      var txt={night:'Night. The sky is dark; on a moonless night the stars come out properly away from city light.',dawn:'Before sunrise. The first light, and the coolest hour of the day.',dusk:'After sunset. Twilight fades quickly this far south.',golden:'Golden hour. Low, warm light, long shadows and the best time for photos.',noon:'Midday. The sun is at its highest and the day at its hottest; shade is scarce in the open.',day:'Daylight. Bright, flat light; carry water and plan around the heat.'}[ph];
      lab.innerHTML='<b>'+hm(new Date(t))+'</b> '+txt;rg.setAttribute('aria-valuetext',hm(new Date(t))+', '+ph);}
    function fromRange(){return r0+(r1-r0)*(rg.value/1000);}
    rg.addEventListener('input',function(){show(fromRange());});
    var tNow=Math.min(Math.max(now.getTime(),r0),r1);rg.value=Math.round((tNow-r0)/(r1-r0)*1000);
    var fd=day.closest('details');
    function intro(){if(RM){show(fromRange());return;}var target=+rg.value,t0=null;function step(ts){if(!t0)t0=ts;var k=Math.min(1,(ts-t0)/1400),e=1-Math.pow(1-k,3);rg.value=Math.round(target*e);show(fromRange());if(k<1)requestAnimationFrame(step);else{rg.value=target;show(fromRange());}}requestAnimationFrame(step);}
    if(fd){fd.addEventListener('toggle',function(){if(fd.open&&!fd.dataset.sun){fd.dataset.sun='1';intro();}});if(fd.open)intro();}else{intro();}
    /* moon phases, next 14 nights */
    var mr=document.querySelector('.lg-moonrow');
    if(mr){var syn=29.530588853,ref=Date.UTC(2000,0,6,18,14),out='';for(var dd=0;dd<14;dd++){var dt=new Date(now.getTime()+dd*864e5);dt.setHours(21,0,0,0);var age=((dt.getTime()-ref)/864e5)%syn;if(age<0)age+=syn;var ill=(1-Math.cos(2*Math.PI*age/syn))/2,wax=age<syn/2,rx=Math.abs(1-2*ill)*10,lit=ill>0.5;
      var sh='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" class="mn-d"/>'+(ill<0.02?'':'<path class="mn-l" d="M12,2 A10,10 0 0 '+(wax?1:0)+' 12,22 A'+rx.toFixed(2)+',10 0 0 '+(wax?(lit?1:0):(lit?0:1))+' 12,2 Z"/>')+'</svg>';
      out+='<span class="mn'+(ill<0.25?' dark':'')+'" style="--i:'+dd+'" title="'+Math.round(ill*100)+'% lit">'+sh+'<small>'+dt.toLocaleDateString('en-GB',{weekday:'short',day:'numeric'})+'</small><span class="lg-sr">, moon '+Math.round(ill*100)+'% lit</span></span>';}mr.innerHTML=out;}
  }
})();
</script>`;
}

const PLACE_CSS = `
/* html{font-size-adjust:.5} (legibility layer) stops Chrome scaling SVG text with the viewBox, so map labels rendered at their raw unit size: huge on wide crops */
.lg-page svg text,.lg-page svg tspan{font-size-adjust:none}

.lg-sr{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;white-space:nowrap!important;border:0!important;display:block!important}
/* hold the header and tab bar at their final height so the web-font swap does not shift the page (CLS) */
.hdr{min-height:67px;box-sizing:border-box}.lg-tabs{min-height:52px;box-sizing:border-box}
@media(max-width:620px){.hdr{min-height:52px}}
/* ===== location guides (27 Sep 2026) ===== */
:root{--lg-ink:#2A2016;--lg-soft:#5A5046;--lg-clay:#9C521B;--lg-deep:#7E4114;--lg-card:#fff;--lg-line:rgba(42,32,22,.12);--lg-hdr:56px;interpolate-size:allow-keywords}
.lg-hero{min-height:clamp(380px,62vh,620px);display:flex;align-items:flex-end}
.lg-hero .loc-hero-inner{width:100%}
.lg-hero.has-photo{background:#1b1410}
.lg-hero.has-photo .dune-far,.lg-hero.has-photo .glow{display:none}
.lg-hero-img{position:absolute;inset:-6% 0 0 0;width:100%;height:112%;object-fit:cover;z-index:0;transform:scale(1.06);will-change:transform}
.lg-hero.has-photo::before{display:none}
.lg-hero.has-photo::after{background:linear-gradient(180deg,rgba(10,6,4,.42) 0%,rgba(10,6,4,.22) 28%,rgba(10,6,4,.45) 52%,rgba(10,6,4,.82) 100%)!important;z-index:1}
.lg-hero.has-photo h1,.lg-hero.has-photo .lede,.lg-hero.has-photo .lg-ar{text-shadow:0 1px 2px rgba(0,0,0,.45),0 2px 18px rgba(0,0,0,.4)}
.lg-hero .dune-near{z-index:3;height:clamp(40px,7vw,90px)}
.lg-hero .loc-hero-inner{z-index:4;padding-bottom:clamp(8px,3vw,24px)}
.lg-hero h1{font-size:clamp(34px,6vw,64px)!important;line-height:1.02!important;margin-bottom:4px}
.lg-hero h1::after{display:none}
.lg-ar{text-align:left;font-family:'Amiri','Noto Naskh Arabic',serif;font-size:22px;color:rgba(255,255,255,.9);margin:0 0 6px;text-shadow:0 1px 12px rgba(0,0,0,.4)}
.lg-hero .lede{font-size:14px;color:rgba(255,255,255,.92)!important;font-weight:500;margin-bottom:12px}
.lg-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}
.lg-chips span{font-size:12.5px;font-weight:600;letter-spacing:.02em;padding:5px 11px;border-radius:999px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.34);color:#fff;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.lg-hero-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.lg-hero .wx{opacity:0;transform:translateY(6px);transition:opacity .45s ease,transform .45s ease}
.lg-hero .wx.on{opacity:1;transform:none}
.lg-share{display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.45);color:#fff;font:600 13px Jost,sans-serif;padding:10px 16px;border-radius:999px;cursor:pointer;backdrop-filter:blur(6px);min-height:44px}
.lg-share .lg-ic{width:17px;height:17px;stroke:#fff}
.lg-credit{position:absolute;right:12px;top:10px;z-index:5;margin:0;max-width:62%;text-align:right;font-size:10.5px;line-height:1.35;color:rgba(255,255,255,.78);text-shadow:0 1px 6px rgba(0,0,0,.5)}
.lg-credit a{color:inherit;text-decoration:underline;text-underline-offset:2px}
.lg-hero:not(.has-photo) .lg-credit{display:none}
@media(max-width:560px){.lg-credit{max-width:calc(100% - 24px);font-size:10px}}
.lg-ic{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;flex:none}
/* sticky in-page tabs */
.lg-tabs{position:sticky;top:var(--lg-hdr);z-index:40;background:rgba(250,246,239,.94);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid var(--lg-line)}
.lg-tabs-in{max-width:820px;margin:0 auto;display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;padding:8px clamp(12px,4vw,24px)}
.lg-tabs-in::-webkit-scrollbar{display:none}
.lg-tabs a{flex:none;font:600 13px Jost,sans-serif;color:var(--lg-soft);text-decoration:none;padding:8px 13px;border-radius:999px;white-space:nowrap;transition:background .25s,color .25s}
.lg-tabs a.on{background:var(--lg-ink);color:#FAF6EF}
.lg-main{padding-top:22px!important}
.lg-main h2 .lg-ic{width:24px;height:24px;vertical-align:-3px;margin-right:6px;color:var(--lg-clay)}
/* at a glance */
.lg-glance{background:var(--lg-card);border:1px solid var(--lg-line);border-radius:18px;padding:16px;margin:0 0 24px;box-shadow:0 2px 14px rgba(58,42,28,.06)}
.lg-gg{display:grid;grid-template-columns:1fr 1fr;gap:14px 16px}
@media(min-width:760px){.lg-gg{grid-template-columns:repeat(4,1fr)}}
.lg-g{display:grid;grid-template-columns:auto 1fr;column-gap:10px;align-items:start}
.lg-gi{grid-row:span 3;width:40px;height:40px;border-radius:12px;background:rgba(192,112,46,.1);color:var(--lg-clay);display:flex;align-items:center;justify-content:center}
.lg-gk{font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--lg-soft)}
.lg-gv{font-weight:600;font-size:15px;color:var(--lg-ink);line-height:1.3}
.lg-gs{font-size:13px;color:var(--lg-soft);line-height:1.4;margin-top:2px}
.lg-facs{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px;padding-top:12px;border-top:1px solid var(--lg-line)}
.lg-f{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--lg-soft);background:#FAF6EF;border:1px solid var(--lg-line);border-radius:999px;padding:5px 11px}
.lg-f .lg-ic{width:16px;height:16px}
.lg-f b{color:var(--lg-ink);font-weight:600}
.lg-f-no b,.lg-f-none b{text-decoration:none}
/* month strip */
.lg-months{margin-top:14px}
.lg-months ol{list-style:none;display:grid;grid-template-columns:repeat(12,1fr);gap:3px;margin:0;padding:0}
.lg-m{height:30px;border-radius:6px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:3px;font:600 11px 'Space Mono',monospace;position:relative;transform-origin:bottom}
.lg-m.m2{background:#A95A21;color:#FFF6EA}
.lg-m.m1{background:#E6C9A2;color:#5A3A1C}
.lg-m.m0{background:#EFE7DB;color:#8A7E70}
.lg-m.now::after{content:"";position:absolute;left:50%;top:-7px;width:6px;height:6px;margin-left:-3px;border-radius:50%;background:var(--lg-ink)}
.lg-months.big .lg-m{height:46px;font-size:12px}
.lg-mkey{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center;font-size:12.5px;color:var(--lg-soft);margin:8px 0 0!important}
.lg-mkey i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:4px;vertical-align:-1px}
.lg-mkey i.m2{background:#A95A21}.lg-mkey i.m1{background:#E6C9A2}.lg-mkey i.m0{background:#EFE7DB;border:1px solid #D9CEBF}
.lg-now{position:relative;padding-left:12px}.lg-now::before{content:"";position:absolute;left:0;top:50%;width:6px;height:6px;margin-top:-3px;border-radius:50%;background:var(--lg-ink)}
/* overview */
.lg-over .content p:first-child{font-size:17.5px;color:var(--lg-ink)}
.lg-checked{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;font-size:13px;color:var(--lg-soft);background:rgba(192,112,46,.06);border-radius:12px;padding:10px 12px;margin:6px 0 22px}
.lg-checked .lg-ic{width:17px;height:17px;color:var(--lg-clay)}
.lg-checked a{color:var(--lg-deep)}
/* folds */
.lg-fold{background:var(--lg-card);border:1px solid var(--lg-line);border-radius:18px;margin:0 0 12px;box-shadow:0 2px 12px rgba(58,42,28,.05);overflow:clip;scroll-margin-top:calc(var(--lg-hdr) + 62px)}
.lg-fold>summary{list-style:none;display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:16px;cursor:pointer;min-height:64px}
.lg-fold>summary::-webkit-details-marker{display:none}
.lg-fi{width:42px;height:42px;border-radius:12px;background:#2A2016;color:#F3D7AE;display:flex;align-items:center;justify-content:center}
.lg-ft{display:flex;flex-direction:column;min-width:0}
.lg-ft b,.lg-ft .lg-fh{font-family:'Cormorant Garamond',Georgia,serif;font-size:21px;font-weight:600;color:var(--lg-ink);line-height:1.15;margin:0;letter-spacing:0;text-transform:none}
.lg-ft small{font-size:13.5px;color:var(--lg-soft);line-height:1.4;margin-top:2px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.lg-fold[open] .lg-ft small{display:none}
.lg-fx{width:30px;height:30px;border-radius:50%;border:1px solid var(--lg-line);position:relative;transition:transform .35s cubic-bezier(.2,.7,.2,1),background .25s}
.lg-fx::before,.lg-fx::after{content:"";position:absolute;left:50%;top:50%;width:12px;height:1.6px;margin:-.8px 0 0 -6px;background:var(--lg-ink);border-radius:2px}
.lg-fx::after{transform:rotate(90deg);transition:transform .35s cubic-bezier(.2,.7,.2,1)}
.lg-fold[open] .lg-fx{background:#2A2016}.lg-fold[open] .lg-fx::before,.lg-fold[open] .lg-fx::after{background:#FAF6EF}
.lg-fold[open] .lg-fx::after{transform:rotate(0)}
.lg-fb{padding:0 16px 18px}
.lg-fb .content p{font-size:16px}
.lg-fold::details-content{block-size:0;overflow:clip;transition:block-size .42s cubic-bezier(.2,.7,.2,1),content-visibility .42s allow-discrete}
.lg-fold[open]::details-content{block-size:auto}
.lg-fold[open] .lg-fb{animation:lgIn .5s cubic-bezier(.2,.7,.2,1) both}
@keyframes lgIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.lg-etq{background:#FAF6EF;border-radius:12px;padding:10px 12px}
.lg-gps{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--lg-soft);margin:6px 0 0}
.lg-gps b{font-family:'Space Mono',monospace;color:var(--lg-ink);font-size:13px}
/* route map */
.lg-map{margin:0 0 14px;max-width:620px}
.lg-road{display:block;margin-top:2px}
.lg-map svg{display:block;width:100%;height:auto;border-radius:14px;background:#DCE6E8}
.lg-sea{fill:#DCE6E8}
.lg-land2{fill:#EFE7D9;stroke:#D2C4AD}
.lg-land{fill:#E8D3B2;stroke:#B98A55}
.lg-route{fill:none;stroke:#7E4114;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:0}
.lg-anim .lg-map .lg-route{stroke-dashoffset:1}
.lg-map.go .lg-route{animation:lgDraw 1.6s cubic-bezier(.45,.05,.2,1) .15s forwards}
@keyframes lgDraw{to{stroke-dashoffset:0}}
.lg-o{fill:#2A2016;stroke:#FAF6EF;stroke-width:2}
.lg-d{fill:#C0702E;stroke:#FFF6EA;stroke-width:2.5}
.lg-pulse{fill:#C0702E;opacity:.35;transform-box:fill-box;transform-origin:center;animation:lgPulse 2.4s ease-out infinite}
@keyframes lgPulse{0%{transform:scale(.6);opacity:.5}100%{transform:scale(2.4);opacity:0}}
.lg-lo,.lg-ld{font-family:Jost,sans-serif;font-weight:600;fill:#2A2016;paint-order:stroke;stroke:#FAF6EF;stroke-width:3px}
.lg-ld{fill:#7E4114}
.lg-map figcaption{font-size:13.5px;color:var(--lg-soft);margin-top:8px}
.lg-km b{font-family:'Space Mono',monospace;color:var(--lg-ink)}
/* day slider */
.lg-day{max-width:560px;margin:16px 0 4px;background:#FAF6EF;border:1px solid var(--lg-line);border-radius:16px;padding:12px}
.lg-sky{position:relative;border-radius:12px;overflow:hidden;background:linear-gradient(180deg,#8FC0DA,#E9F1F2);transition:background .6s ease}
.lg-sky[data-ph=golden]{background:linear-gradient(180deg,#E29A5B,#F6D7A6)}
.lg-sky[data-ph=noon]{background:linear-gradient(180deg,#6FB0D6,#F3F2E6)}
.lg-sky[data-ph=dawn],.lg-sky[data-ph=dusk]{background:linear-gradient(180deg,#3B2C5E,#C98263)}
.lg-sky[data-ph=night]{background:linear-gradient(180deg,#0E0A1F,#2B2150)}
.lg-sky svg{display:block;width:100%;height:auto;position:relative;z-index:1}
.lg-arc{fill:none;stroke:rgba(42,32,22,.28);stroke-width:1.5;stroke-dasharray:4 5}
.lg-sky[data-ph=night] .lg-arc,.lg-sky[data-ph=dawn] .lg-arc,.lg-sky[data-ph=dusk] .lg-arc{stroke:rgba(255,255,255,.3)}
.lg-hz{stroke:rgba(42,32,22,.35);stroke-width:1.5}
.lg-sunb{fill:#FFD27A;stroke:#FFF3D6;stroke-width:3;filter:drop-shadow(0 0 8px rgba(255,190,90,.8))}
.lg-sky[data-ph=night] .lg-sunb{opacity:0}
.lg-stars{position:absolute;inset:0;opacity:0;transition:opacity .6s}
.lg-sky[data-ph=night] .lg-stars{opacity:1}
.lg-stars i{position:absolute;width:2px;height:2px;border-radius:50%;background:#fff;animation:lgTw 3s ease-in-out infinite}
@keyframes lgTw{50%{opacity:.25}}
.lg-slide{display:flex;flex-direction:column;gap:4px;margin:10px 2px 0;font:600 12px 'Space Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--lg-soft)}
.lg-slide input{width:100%;accent-color:#A95A21;min-height:32px}
.lg-dayt{font-size:14.5px!important;color:var(--lg-ink);margin:6px 2px 0!important;min-height:3em}
.lg-dayt b{font-family:'Space Mono',monospace;margin-right:6px}
.lg-sunt{font-size:13px!important;color:var(--lg-soft);margin:4px 2px 0!important}
/* moon row */
.lg-moons{margin:14px 0 0}
.lg-moonrow{display:grid;grid-template-columns:repeat(7,1fr);gap:8px 4px;margin-top:8px}
.mn{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10.5px;color:var(--lg-soft)}
.mn svg{width:30px;height:30px}
.mn-d{fill:#2A2150}.mn-l{fill:#F3E6C8}
.mn.dark small{color:var(--lg-deep);font-weight:700}
.mn.dark svg{filter:drop-shadow(0 0 6px rgba(126,65,20,.45))}
.lg-anim .mn{opacity:0;transform:translateY(6px);animation:lgIn .5s cubic-bezier(.2,.7,.2,1) forwards;animation-delay:calc(var(--i) * 45ms)}
.lg-moonk{font-size:13px!important;color:var(--lg-soft);margin-top:8px!important}
.lg-eye{display:inline-flex;align-items:center;gap:6px;font:700 11.5px 'Space Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--lg-clay)}
.lg-eye .lg-ic{width:17px;height:17px}
/* flood diagram */
.lg-flood{max-width:620px;margin:0 0 14px;background:#EFE7DB;border-radius:14px;padding:10px}
.lg-flood svg{display:block;width:100%;height:auto}
.fl-mtn{fill:#B98A55}.fl-bed{fill:#D9C4A3}.fl-cloud ellipse{fill:#6E6A78}
.fl-rain line{stroke:#5E7C94;stroke-width:2.5;stroke-linecap:round}
.fl-water{fill:#5E7C94;opacity:.85}
.fl-walker{fill:none;stroke:#2A2016;stroke-width:2.4;stroke-linecap:round}.fl-walker circle{fill:#2A2016}
.fl-t{font:600 13px Jost,sans-serif;fill:#2A2016;text-anchor:middle}
.lg-anim .lg-fold[open] .fl-water{animation:lgFlood 5s cubic-bezier(.5,0,.3,1) 3 both}
.lg-anim .lg-fold[open] .fl-rain line{animation:lgRain .9s linear 16;animation-delay:calc(var(--k) * -.18s)}
@keyframes lgFlood{0%,15%{transform:translateX(0) scaleX(.35);transform-origin:240px 150px}70%,100%{transform:translateX(0) scaleX(1.7);transform-origin:240px 150px}}
@keyframes lgRain{from{transform:translate(0,-6px);opacity:0}30%{opacity:1}to{transform:translate(-4px,14px);opacity:0}}
.lg-flood figcaption{font-size:14px;color:var(--lg-ink);margin-top:6px;font-weight:500}
.lg-sos{background:#2A2016;color:#F7EFE2;border-radius:14px;padding:14px 16px;margin-top:12px}
.lg-sos-h{display:flex;align-items:center;gap:8px;font:700 12px 'Space Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#F3D7AE}
.lg-sos ul{list-style:none;display:flex;flex-wrap:wrap;gap:6px 18px;margin:10px 0 6px;padding:0}
.lg-sos li{font-size:14px}.lg-sos li b{font-family:'Space Mono',monospace;font-size:18px;color:#fff;margin-right:6px}
.lg-sos p{font-size:13.5px!important;color:rgba(247,239,226,.85)!important;margin:0!important}
.lg-sos a{color:#F3D7AE}
/* product panels */
.lg-kin{display:grid;grid-template-columns:120px 1fr;gap:16px;align-items:center;background:#2A2016;color:#F7EFE2;border-radius:18px;padding:14px;margin:26px 0;overflow:hidden}
@media(min-width:620px){.lg-kin{grid-template-columns:200px 1fr;padding:18px}}
.lg-kin-img img{width:100%;height:auto;border-radius:12px;display:block;background:#F3EDE3;transition:transform .6s cubic-bezier(.2,.7,.2,1)}
.lg-kin:hover .lg-kin-img img{transform:scale(1.04)}
.lg-kin h2{color:#fff;margin:6px 0 6px!important;font-size:24px!important}
.lg-kin p{color:rgba(247,239,226,.86);font-size:14.5px!important;margin:0 0 8px!important}
.lg-kin .lg-eye{color:#F3D7AE}
.lg-kin-m{font-size:13px!important}
.lg-kin .btn{background:#E9B978;color:#1b1410}
.lg-none{background:var(--lg-card);border:1px solid var(--lg-line);border-radius:18px;padding:18px;margin:26px 0}
.lg-none h2{margin:6px 0 6px!important}
.lg-none-g{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0 14px}
.lg-none-c{display:flex;flex-direction:column;gap:2px;text-decoration:none;color:var(--lg-ink);font-size:13px}
.lg-none-c img{width:100%;height:auto;border-radius:10px;background:#F3EDE3;margin-bottom:4px;transition:transform .5s}
.lg-none-c:hover img{transform:translateY(-3px)}
.lg-none-c b{font-family:'Cormorant Garamond',serif;font-size:16px;line-height:1.1}
.lg-none-c span{color:var(--lg-soft);font-size:12px}
/* packing */
.lg-pack-sub{font-size:14px!important;color:var(--lg-soft)!important}
.pack-row{width:100%;text-align:left;font:inherit;cursor:pointer;transition:background .25s,border-color .25s,transform .15s}
.pack-row:active{transform:scale(.99)}
.pk-box{width:22px;height:22px;border-radius:7px;border:1.6px solid rgba(42,32,22,.35);flex:none;position:relative;transition:background .2s,border-color .2s}
.pack-row.done{background:#F4ECDF;border-color:rgba(169,90,33,.35)}
.pack-row.done .pk-box{background:#A95A21;border-color:#A95A21}
.pack-row.done .pk-box::after{content:"";position:absolute;left:7px;top:3px;width:5px;height:10px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}
.pack-row.done .pk-name{text-decoration:line-through;text-decoration-color:rgba(42,32,22,.35);color:var(--lg-soft)}
.pk-name,.pk-note{display:block}
.lg-bagbar{display:flex;align-items:center;gap:10px;margin:0 0 6px;font:600 13px Jost,sans-serif;color:var(--lg-soft)}
.lg-bag{position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;color:var(--lg-clay)}
.lg-bag .lg-ic{position:relative;z-index:2;width:30px;height:30px}
.lg-bagfill{position:absolute;left:8px;right:8px;bottom:5px;top:13px;background:rgba(169,90,33,.35);border-radius:2px 2px 4px 4px;transform:scaleY(0);transform-origin:bottom;transition:transform .5s cubic-bezier(.2,.7,.2,1)}
/* faq */
.lg-q{border-bottom:1px solid var(--lg-line)}
.lg-q summary{cursor:pointer;list-style:none;padding:14px 30px 14px 0;font-weight:600;font-size:15.5px;color:var(--lg-ink);position:relative}
.lg-q summary::-webkit-details-marker{display:none}
.lg-q summary::after{content:"+";position:absolute;right:4px;top:12px;font-size:20px;color:var(--lg-clay);transition:transform .3s}
.lg-q[open] summary::after{transform:rotate(45deg)}
.lg-q p{padding:0 0 14px;color:var(--lg-soft)}
.lg-q::details-content{block-size:0;overflow:clip;transition:block-size .35s cubic-bezier(.2,.7,.2,1),content-visibility .35s allow-discrete}
.lg-q[open]::details-content{block-size:auto}
.lg-src{margin:0;padding-left:20px;font-size:13.5px}
.lg-src li{margin:0 0 6px}
.lg-src a{color:var(--lg-deep);word-break:break-word}
.lg-credit2{font-size:12.5px;color:var(--lg-soft);margin-top:10px}
.lg-credit2 a{color:var(--lg-deep)}
.lg-near{font-style:normal;font-size:12px;color:var(--lg-soft);font-family:'Space Mono',monospace}
.lg-all{margin-top:14px;font-weight:600}
/* arrival motion */
.lg-anim .lg-rise{opacity:0;transform:translateY(18px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1)}
.lg-anim .lg-rise.in{opacity:1;transform:none}
.lg-anim .lg-glance.in .lg-m{animation:lgBar .5s cubic-bezier(.2,.7,.2,1) both;animation-delay:calc(var(--i) * 35ms)}
.lg-anim .lg-fold[open] .lg-months .lg-m{animation:lgBar .5s cubic-bezier(.2,.7,.2,1) both;animation-delay:calc(var(--i) * 35ms)}
@keyframes lgBar{from{transform:scaleY(.2);opacity:0}to{transform:none;opacity:1}}
@media(prefers-reduced-motion:reduce){.lg-map.go .lg-route,.lg-map .lg-route{animation:none!important;stroke-dashoffset:0!important}.lg-fold[open] .lg-fb{animation:none!important}.lg-pulse,.fl-water,.fl-rain line,.lg-stars i{animation:none!important}.lg-fold::details-content,.lg-q::details-content{transition:none}.lg-hero-img{transform:none}}
@media(max-width:700px){
  .lg-hero{min-height:clamp(340px,56vh,520px)}
  .lg-ar{font-size:19px}
  .lg-main{padding-left:14px!important;padding-right:14px!important}
  .lg-glance{padding:14px}
  .lg-gg{gap:12px}
  .lg-gi{width:34px;height:34px;border-radius:10px}.lg-gi .lg-ic{width:19px;height:19px}
  .lg-gv{font-size:14px}.lg-gs{font-size:12.5px}
  .lg-fold>summary{padding:14px 12px;gap:10px}
  .lg-fi{width:38px;height:38px}
  .lg-ft b,.lg-ft .lg-fh{font-size:19px}
  .lg-fb{padding:0 12px 16px}
  .lg-none-c b{font-size:14px}
}
.lg-take{margin-top:18px;padding:18px;border-radius:16px;background:#fff;border:1px solid var(--lg-line,rgba(43,37,32,.12))}
.lg-take h3{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:600;margin:0 0 4px;color:var(--lg-ink,#2A2016)}
.lg-take>p{margin:0 0 12px;font-size:15px;color:var(--lg-soft,#5A5046)}
.lg-take-b{display:flex;flex-wrap:wrap;gap:8px}
.lg-take-b .btn{min-height:44px;display:inline-flex;align-items:center;gap:6px}
.lg-cap{margin-top:16px;padding-top:14px;border-top:1px solid var(--lg-line,rgba(43,37,32,.12))}
.lg-cap label{display:block;font-size:15px;color:var(--lg-ink,#2A2016);margin-bottom:8px}
.lg-cap-r{display:flex;gap:8px;flex-wrap:wrap}
.lg-cap-r input{flex:1 1 200px;min-height:46px;border-radius:999px;border:1px solid rgba(43,37,32,.25);padding:0 16px;font:16px Jost,system-ui,sans-serif;background:#FAF6EF;color:#2A2016}
.lg-cap-r .btn{min-height:46px}
.lg-cap-m{margin:10px 0 0;font-size:14px;color:#7E4114}
.lg-cap.won .lg-cap-r,.lg-cap.won label{display:none}
.lg-cap.won .lg-cap-m{font-size:15px;color:#2A2016}

/* keyboard focus and jump links land below the sticky header and tab bar (WCAG 2.4.11) */
html:has(.lg-tabs){scroll-padding-top:calc(var(--lg-hdr,67px) + 64px)}
/* laptops with short screens: the sticky side card would be cut off, so it scrolls with the page */
@media(min-width:1120px) and (max-height:860px){.lg-main>.lg-side{position:static;max-height:none;overflow:visible}}
/* text sits bottom-left over the photo: darken that corner too (Liwa, Al Rams contrast) */
.lg-hero.has-photo .loc-hero-inner::before{content:"";position:absolute;inset:-40px -40vw -30px -40vw;background:radial-gradient(ellipse at 20% 70%,rgba(10,6,4,.45),rgba(10,6,4,0) 65%);z-index:-1;pointer-events:none}

/* answer box (SEO plan, 1 Oct 2026): the questions people search, answered in the first screen of the guide */
.lg-notice{background:#FFF6E3;border:1px solid #E7C98B;border-radius:14px;padding:12px 16px;margin:0 0 14px;font-size:15px;line-height:1.5;color:#3A2A14}
.lg-notice strong{color:#7A4B0C}
.lg-guides{margin:18px 0}.lg-guides h2{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:600;margin:0 0 8px;color:#2A2016}.lg-guides div{display:flex;flex-wrap:wrap;gap:8px}.lg-guides a{display:inline-block;padding:9px 14px;border:1px solid rgba(42,32,22,.18);border-radius:999px;background:#fff;color:#2A2016;font-size:14px;text-decoration:none}.lg-guides a:hover{border-color:#B07A3C}
.lg-quick{background:#fff;border:1px solid var(--lg-line,rgba(42,32,22,.12));border-radius:16px;padding:18px 20px;margin:0 0 18px}
.lg-quick h2{font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:600;margin:0 0 10px;color:var(--lg-ink,#2A2016)}
.lg-quick dl{margin:0;display:grid;gap:10px}
.lg-quick dl>div{display:grid;grid-template-columns:150px 1fr;gap:12px;padding-top:10px;border-top:1px solid var(--lg-line,rgba(42,32,22,.1))}
.lg-quick dl>div:first-child{border-top:0;padding-top:0}
.lg-quick dt{font-weight:600;font-size:15px;color:var(--lg-ink,#2A2016)}
.lg-quick dd{margin:0;font-size:15px;line-height:1.55;color:#3E352B}
@media(max-width:560px){.lg-quick{padding:16px}.lg-quick dl>div{grid-template-columns:1fr;gap:2px}}

/* desktop (28 Sep 2026 review: 43% of a 1440 screen sat empty): the guide reads in a
   left column, and the at-a-glance card (plus the tee, where there is one) rides along
   in a sticky right column. Phones and tablets are unchanged. */
@media(min-width:1120px){
  main.lg-main{max-width:1200px;display:grid;grid-template-columns:minmax(0,1fr) 350px;column-gap:48px;align-items:start}
  .lg-main>.lg-col{grid-column:1;grid-row:1;min-width:0}
  .lg-main>.lg-side{grid-column:2;grid-row:1;position:sticky;top:calc(var(--lg-hdr,67px) + 68px);display:flex;flex-direction:column;gap:14px;max-height:calc(100vh - var(--lg-hdr,67px) - 84px);overflow:auto;scrollbar-width:thin}
  .lg-side .lg-glance{margin:0}
  .lg-side .minitee{flex-wrap:wrap;margin:0}
  .lg-side .minitee-txt{flex:1 1 160px}
  .lg-side .minitee-go{flex:1 1 100%;justify-content:center;text-align:center}
  .lg-side .lg-gg{grid-template-columns:1fr}
  .lg-side .lg-g{padding:10px 0}
  .lg-main .content,.lg-over .content{max-width:700px}
  .lg-tabs-in{max-width:1200px}
  .lg-hero .loc-hero-inner{max-width:1200px}

}
`;


/* ---------- /places/ explorer: one map, every pin, filters that act on the cards too ---------- */
const CAT_COL = { Dunes: '#C0702E', Camping: '#7A4F8A', Wadis: '#3E7A73', Mountains: '#7E4114', Coast: '#2F6F95', Heritage: '#9A7B3C' };
function hubExplorer(locations, opts) {
  /* 8 Oct 2026 (map placement review): the full map adds two layers, the places that became tees
     (gold ring, "Shop the tee" in the tip) and the hike trailheads (triangles, off until chosen). */
  opts = opts || {}; const TEES = opts.tees || {}, HIKES = opts.hikes || [];
  /* Spread pins that would overlap (the Al Qudra lakes, the RAK/Fujairah cluster):
     push pairs apart until dots sit at least D units apart, and draw a short leader
     line back to the true spot when a dot moves (places review, 28 Sep 2026). */
  const P = locations.filter(l => typeof l.lat === 'number').map(l => { const [x, y] = xy(l.lat, l.lng); return { l, x0: x, y0: y, x, y }; });
  const D = 34;
  for (let it = 0; it < 120; it++) {
    let moved = false;
    for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) {
      let dx = P[b].x - P[a].x, dy = P[b].y - P[a].y, d = Math.hypot(dx, dy);
      if (d >= D) continue;
      if (d < .01) { dx = 1; dy = .3; d = Math.hypot(dx, dy); }
      const k = (D - d) / 2 / d; P[a].x -= dx * k; P[a].y -= dy * k; P[b].x += dx * k; P[b].y += dy * k; moved = true;
    }
    if (!moved) break;
  }
  const pins = P.map((p, i) => {
    const l = p.l, x = p.x.toFixed(1), y = p.y.toFixed(1), off = Math.hypot(p.x - p.x0, p.y - p.y0) > 6;
    const t = TEES[l.id];
    return `<a class="hx-pin${t ? ' hx-tee' : ''}" href="/locations/${l.id}/" data-id="${l.id}" data-cat="${esc(l.category)}"${t ? ` data-tee="${esc(t.name)}" data-shop="${esc(t.url)}"` : ''} style="--c:${CAT_COL[l.category] || '#7E4114'};--i:${i}" aria-label="${esc(l.name)}, ${esc(l.category)}">${off ? `<line x1="${p.x0.toFixed(1)}" y1="${p.y0.toFixed(1)}" x2="${x}" y2="${y}" class="hx-lead"/><circle cx="${p.x0.toFixed(1)}" cy="${p.y0.toFixed(1)}" r="4" class="hx-true"/>` : ''}<circle cx="${x}" cy="${y}" r="${D / 2 + 6}" class="hx-hit"/>${t ? `<circle cx="${x}" cy="${y}" r="22" class="hx-ring"/>` : ''}<circle cx="${x}" cy="${y}" r="14" class="hx-dot"/><title>${esc(l.name)} (${esc(l.category)})${t ? ' · ' + esc(t.name) + ' tee' : ''}</title></a>`;
  }).join('');
  /* hike trailheads: spread among themselves, drawn as small triangles, hidden until the Hikes chip is on */
  const HP = HIKES.filter(h => typeof h.lat === 'number').map(h => { const [x, y] = xy(h.lat, h.lng); return { h, x0: x, y0: y, x, y }; });
  for (let it = 0; it < 120; it++) { let moved = false;
    for (let a = 0; a < HP.length; a++) for (let b = a + 1; b < HP.length; b++) { let dx = HP[b].x - HP[a].x, dy = HP[b].y - HP[a].y, d = Math.hypot(dx, dy); if (d >= 28) continue; if (d < .01) { dx = 1; dy = .3; d = Math.hypot(dx, dy); } const k = (28 - d) / 2 / d; HP[a].x -= dx * k; HP[a].y -= dy * k; HP[b].x += dx * k; HP[b].y += dy * k; moved = true; }
    if (!moved) break; }
  const hikePins = HP.map(p => { const h = p.h, x = p.x, y = p.y, off = Math.hypot(p.x - p.x0, p.y - p.y0) > 6;
    return `<a class="hx-pin hx-hike" href="/trail/hikes/${esc(h.slug)}/" data-hike="${esc(h.slug)}" data-name="${esc(h.name)}" data-grade="${esc(h.grade)}" aria-label="Hike: ${esc(h.name)}, ${esc(h.grade)}" style="--c:#285C5C">${off ? `<line x1="${p.x0.toFixed(1)}" y1="${p.y0.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="hx-lead"/>` : ''}<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="18" class="hx-hit"/><path class="hx-tri" d="M${x.toFixed(1)},${(y - 11).toFixed(1)} L${(x + 10).toFixed(1)},${(y + 7).toFixed(1)} L${(x - 10).toFixed(1)},${(y + 7).toFixed(1)} Z"/><title>Hike: ${esc(h.name)} (${esc(h.grade)})</title></a>`; }).join('');
  const cats = Object.keys(CAT_COL).filter(c => locations.some(l => l.category === c));
  const chip = (k, v, t) => `<button type="button" class="hx-chip${k === 'all' ? ' on' : ''}" data-f="${k}" data-v="${esc(v)}">${t}</button>`;
  return `<section class="hx" id="explore" aria-label="Explore the places">
    <div class="hx-map"><svg viewBox="0 0 ${GEO.w} ${GEO.h}" role="group" aria-label="Map of the UAE with every place; each pin links to its guide">
      <rect width="${GEO.w}" height="${GEO.h}" class="lg-sea"/><path class="lg-land2" d="${GEO.SA}${GEO.OM}${GEO.QA}"/><path class="lg-land" d="${GEO.AE}"/>${pins}<g class="hx-hikes">${hikePins}</g></svg>
      <div class="hx-tip" hidden></div></div>
    <div class="hx-side">
      <p class="lg-eye">Filter the places</p>
      <div class="hx-chips">${chip('all', '', 'All')}${cats.map(c => chip('cat', c, `<i style="background:${CAT_COL[c]}"></i>${c}`)).join('')}</div>
      <div class="hx-chips">${chip('month', '', 'Good this month')}${chip('car', '', 'Any car')}${chip('easy', '', 'Easy')}</div>
      ${Object.keys(TEES).length || HP.length ? `<p class="lg-eye" style="margin-top:14px">On the map</p><div class="hx-chips">${Object.keys(TEES).length ? chip('tee', '', '<i class="hx-k-tee"></i>Places that became tees') : ''}${HP.length ? chip('hikes', '', '<i class="hx-k-hike"></i>Hike trailheads') : ''}</div>` : ''}
      <p class="hx-count" aria-live="polite"></p>
    </div>
  </section>`;
}
function hubScript() {
  return `<script>(function(){
  var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cards=[].slice.call(document.querySelectorAll('.cards .card[data-id]')),pins=[].slice.call(document.querySelectorAll('.hx-pin')),tip=document.querySelector('.hx-tip'),map=document.querySelector('.hx-map');
  var mo=new Date().getMonth(),f={k:'all',v:''},extra={month:false,car:false,easy:false,tee:false,hikes:false};var TEE={};pins.forEach(function(p){if(p.dataset.tee)TEE[p.dataset.id]=1;});
  function ok(el){var d=el.dataset;if(f.k==='cat'&&d.cat!==f.v)return false;if(extra.month&&(d.m||'').charAt(mo)!=='2')return false;if(extra.car&&d.v!=='2wd')return false;if(extra.easy&&d.diff!=='Easy')return false;if(extra.tee&&!TEE[d.id])return false;return true;}
  function apply(){var n=0;cards.forEach(function(c){var y=ok(c);c.hidden=!y;if(y)n++;});var byId={};cards.forEach(function(c){byId[c.dataset.id]=c;});
    pins.forEach(function(p){if(p.dataset.hike)return;var c=byId[p.dataset.id];p.classList.toggle('off',!!(c&&c.hidden)||(extra.tee&&!p.dataset.tee));});if(map)map.classList.toggle('hx-show-hikes',extra.hikes);
    document.querySelectorAll('.guide-sec[id^=cat-]').forEach(function(s){s.hidden=!s.querySelector('.card:not([hidden])');});
    var t=document.querySelector('.hx-count');if(t)t.textContent=n+' of '+cards.length+' places'+(extra.month?' at their best in '+new Date().toLocaleString('en-GB',{month:'long'}):'');}
  document.querySelectorAll('.hx-chip').forEach(function(b){b.addEventListener('click',function(){var k=b.dataset.f;
    if(k==='all'||k==='cat'){f={k:k,v:b.dataset.v};document.querySelectorAll('.hx-chip[data-f=all],.hx-chip[data-f=cat]').forEach(function(x){x.classList.toggle('on',x===b);});}
    else{extra[k]=!extra[k];b.classList.toggle('on',extra[k]);}
    apply();if(window.gtag)gtag('event','places_filter',{filter:k,value:b.dataset.v||String(extra[k])});});});
  function show(p){if(!tip||!map)return;var c=cards.filter(function(x){return x.dataset.id===p.dataset.id;})[0];var r=p.querySelector('.hx-dot,.hx-tri').getBoundingClientRect(),m=map.getBoundingClientRect();
    if(p.dataset.hike){tip.innerHTML='<b>'+p.dataset.name+'</b><span>Hike &middot; '+p.dataset.grade+'</span><a href="'+p.getAttribute('href')+'">Open the hike guide &rarr;</a>';}
    else{tip.innerHTML='<b>'+(c?c.querySelector('strong').textContent:'')+'</b><span>'+(c?c.dataset.cat+' &middot; '+c.dataset.em:'')+'</span>'+(p.dataset.tee?'<a href="'+p.dataset.shop+'" data-cta="shop">Shop the '+p.dataset.tee+' tee &rarr;</a><br>':'')+'<a href="'+p.getAttribute('href')+'">Open the guide &rarr;</a>';}
    tip.hidden=false;if(window.gtag)gtag('event','map_pin_click',{place:p.dataset.id||p.dataset.hike,surface:'places'});
    var x=r.left-m.left+r.width/2,y=r.top-m.top;tip.style.left=Math.min(Math.max(x,90),m.width-90)+'px';tip.style.top=y+'px';}
  pins.forEach(function(p){p.addEventListener('mouseenter',function(){show(p);});p.addEventListener('focus',function(){show(p);});
    /* touch: first tap shows the tip, a second tap on the same pin follows the link (8 Oct 2026: keyed for hike pins too) */
    p.addEventListener('click',function(e){var key=p.dataset.id||('h:'+p.dataset.hike);if(matchMedia('(hover: none)').matches&&(tip.hidden||tip.dataset.id!==key)){e.preventDefault();show(p);tip.dataset.id=key;}});});
  cards.forEach(function(c){c.addEventListener('mouseenter',function(){pins.forEach(function(p){p.classList.toggle('hot',p.dataset.id===c.dataset.id);});});c.addEventListener('mouseleave',function(){pins.forEach(function(p){p.classList.remove('hot');});});});
  if('IntersectionObserver' in window&&!RM&&map){map.classList.add('pre');var io=new IntersectionObserver(function(es){if(es[0].isIntersecting){map.classList.remove('pre');map.classList.add('drop');io.disconnect();}},{threshold:.25});io.observe(map);}
  apply();})();</script>`;
}
const HUB_CSS = `
@media(max-width:620px){.hdr{min-height:52px!important}}

@media(min-width:1120px){
  main{max-width:1200px}
  .cards{grid-template-columns:repeat(3,minmax(0,1fr))!important}
}
.hdr{min-height:67px;box-sizing:border-box}
.lg-sea{fill:#DCE6E8}.lg-land2{fill:#EFE7D9;stroke:#D2C4AD;stroke-width:1.2}.lg-land{fill:#E8D3B2;stroke:#B98A55;stroke-width:1.6}
.lg-eye{font:700 11.5px 'Space Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#9C521B;margin:0}
.hx{display:grid;gap:14px;margin:0 0 26px}
@media(min-width:860px){.hx{grid-template-columns:2.2fr 1fr;align-items:start}}
.hx-map{position:relative;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(58,42,28,.12)}
.hx-map svg{display:block;width:100%;height:auto}
.hx-pin{cursor:pointer;outline:none}
.hx-pin:focus-visible .hx-hit{fill:none;stroke:var(--lg-ink,#2a1d12);stroke-width:5}
.hx-hit{fill:transparent}
.hx-lead{stroke:var(--c);stroke-width:2.5;opacity:.7}.hx-true{fill:var(--c)}
.hx-pin.off .hx-lead,.hx-pin.off .hx-true{opacity:.15}
.hx-map.pre .hx-lead,.hx-map.pre .hx-true{opacity:0}
.hx-dot{fill:var(--c);stroke:#FFF8EE;stroke-width:3;transform-box:fill-box;transform-origin:center;transition:transform .25s cubic-bezier(.2,.7,.2,1),opacity .3s}
.hx-pin:hover .hx-dot,.hx-pin:focus .hx-dot,.hx-pin.hot .hx-dot{transform:scale(1.55)}
.hx-pin.off .hx-dot{opacity:.18;transform:scale(.7);animation:none!important}   /* 8 Oct 2026: the drop animation's end state was overriding the filter's dimming */
.hx-map.pre .hx-dot{opacity:0;transform:translateY(-14px)}
.hx-map.drop .hx-dot{animation:hxDrop .55s cubic-bezier(.3,1.4,.5,1) both;animation-delay:calc(var(--i) * 45ms)}
@keyframes hxDrop{from{opacity:0;transform:translateY(-16px) scale(.6)}to{opacity:1;transform:none}}
.hx-tip{position:absolute;transform:translate(-50%,calc(-100% - 12px));background:#2A2016;color:#F7EFE2;border-radius:12px;padding:9px 12px;min-width:170px;box-shadow:0 10px 24px rgba(0,0,0,.25);pointer-events:auto;z-index:3}
.hx-tip b{display:block;font-family:'Cormorant Garamond',serif;font-size:18px;line-height:1.1}
.hx-tip span{display:block;font-size:12px;color:rgba(247,239,226,.82);margin:2px 0 6px}
.hx-tip a{color:#F3D7AE;font-size:13px;font-weight:600}
.hx-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0}
.hx-chip{display:inline-flex;align-items:center;gap:6px;font:600 13px Jost,sans-serif;padding:8px 13px;border-radius:999px;border:1px solid rgba(42,32,22,.18);background:#fff;color:#4A4136;cursor:pointer;min-height:40px;transition:background .2s,color .2s}
.hx-chip i{width:10px;height:10px;border-radius:50%;display:inline-block}
.hx-chip.on{background:#2A2016;color:#FAF6EF;border-color:#2A2016}
.hx-count{font-size:14px;color:#5A5046;margin-top:10px}
.card[hidden]{display:none!important}
.hx-ring{fill:none;stroke:#C98A2E;stroke-width:4}.hx-pin.off .hx-ring{opacity:.15}
.hx-hikes{display:none}.hx-show-hikes .hx-hikes{display:inline}
.hx-tri{fill:#285C5C;stroke:#FFF8EE;stroke-width:2.5}.hx-hike:hover .hx-tri,.hx-hike:focus .hx-tri{fill:#1F4B4B}
.hx-k-tee{background:transparent!important;border:2px solid #C98A2E}.hx-k-hike{background:#285C5C!important;border-radius:2px!important;clip-path:polygon(50% 0,100% 100%,0 100%)}
@media(prefers-reduced-motion:reduce){.hx-map.drop .hx-dot{animation:none}}
`;

module.exports = { tableHtml, TABLE_CSS, hubExplorer, hubScript, HUB_CSS, CAT_COL, renderPlace, clientScript, packFor, PLACE_CSS, routeMap, monthStrip };
