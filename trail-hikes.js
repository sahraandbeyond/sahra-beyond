/* ==========================================================================
   Sahra Trail hikes — /trail/hikes/ and six route pages  (6 Oct 2026, Faheem)
   ==========================================================================
   Sahra Trail orders carry cards with six QR codes, one per UAE hiking route:
   two easy, two moderate, two difficult (MASTER_BRIEF 3.128, handover of
   6 Oct). Faheem confirmed the six on 6 Oct after the shortlist was checked:
   Wadi Naqab and Jebel Yanas were dropped (no official grade, map or
   trailhead; repeated rescues in Wadi Naqab), Al Rafisah moved from Easy to
   Moderate, and Hatta's green trail had no published route total.

   THE URLS ARE PRINTED ON CARDS AND ARE PERMANENT.
     /trail/hikes/<slug>/   the page
     /h/<n>/                the short address the QR encodes (n = 1..6)
   Never rename a slug or renumber a route. If a page must move, change `to`
   for that number below and leave the old page as a redirect. /h/<n>/ is a
   static page as well as a vercel.json redirect, so it works on any host.

   Every fact comes from content/hikes/<slug>.json, which carries the research
   (with sources, a lastChecked date and a _doubts list, kept in the file, not
   printed) and `page`, the short reader-facing text edited from it. Where no source gives a
   figure the page says so; it never fills the gap. No page says a route is
   safe. No product claims: the Trail link names the two pieces only.
   ========================================================================== */
const fs = require('fs'), path = require('path');

const ORDER = ['wadi-shees', 'al-taiba', 'al-rabi', 'al-rafisah', 'al-riham', 'wadi-shah'];   // card numbers 1..6, never reorder
/* 8 Oct 2026 (Faheem): more Ras Al Khaimah hikes, not on the cards and never numbered. Unmarked routes
   carry a status line from their data. Held back (identity or access not confirmed): Wadi Al Yebah,
   Wadi Al Ghail, Jebel Mebrah, in content/hikes/_held/. */
const EXTRA = ['jebel-jais-hike', 'hidden-oasis', 'wadi-naqab-to-wadi-kub', 'jebel-yanas', 'wadi-qadaah'];
const UTM = n => `?utm_source=trail-card&utm_medium=qr&utm_campaign=hike-${n}`;

/* one scale across the six (handover: state the basis, use one scale) */
const SCALE = [
  ['Easy', 'Under 5 km on a marked or obvious path, with steps or a short climb. Two hours or less for most walkers.'],
  ['Moderate', 'About 5 to 8 km with a sustained climb of roughly 300 to 500 m on a marked path. Half a day.'],
  ['Difficult', 'Graded Hard or Challenging by the trail operator, or more than 8 km with 450 m or more of climbing on rough ground where finding the way is part of the work.']
];
const NOTICE = {
  'al-taiba': 'Fujairah trails are open only in the official hiking season, which the operator announces each year. The 2026 to 2027 season opened on 25 September 2026 (Khaleej Times, 1 October 2026). Confirm with Fujairah Adventures before you travel.',
  'al-riham': 'Fujairah trails are open only in the official hiking season, which the operator announces each year. The 2026 to 2027 season opened on 25 September 2026 (Khaleej Times, 1 October 2026). The trailhead and parking for this route are not confirmed by the operator: read the trailhead notes below and confirm with Fujairah Adventures before you travel.',
  'wadi-shah': 'Open status not confirmed. On 6 October 2026 the operator’s hiking page said the trails were open, while its home page still showed a seasonal pause and another source reported all trails closed. Trail works are also reported at the Hidden Oasis, the midpoint of this loop. Ring or email the operator before you travel.',
  'jebel-jais-hike': 'Open status not confirmed. On 8 October 2026 the operator’s hiking page said the trails were open, while its home page still showed a seasonal pause and another source (14 September 2026) listed the Jais Viewing Deck Park, where this trail starts, as closed. Confirm with Visit Jebel Jais before you drive up.',
  'hidden-oasis': 'Open status not confirmed, and trail works are reported at the oasis itself. On 8 October 2026 the operator said the trails were open while another source said they were closed. Confirm with Visit Jebel Jais before you go.'
};

module.exports = function buildTrailHikes({ shell, write, SITE, esc, root }) {
  const dir = path.join(root, 'content', 'hikes');
  const H = ORDER.map((slug, i) => {
    const d = JSON.parse(fs.readFileSync(path.join(dir, slug + '.json'), 'utf8'));
    if (d.slug !== slug || d.n !== i + 1) throw new Error(`hikes: ${slug} must keep slug and number ${i + 1} (printed on cards)`);
    if (!d.page || !Array.isArray(d.page.route) || !Array.isArray(d.page.notConfirmed)) throw new Error(`hikes: ${slug} needs the reader-facing page text`);
    if (!d.sources || d.sources.length < 3 || !d.lastChecked || !Array.isArray(d._doubts)) throw new Error(`hikes: ${slug} needs sources, lastChecked and _doubts`);
    if (!d.trailhead || typeof d.trailhead.lat !== 'number' || typeof d.trailhead.lng !== 'number') throw new Error(`hikes: ${slug} needs trailhead coordinates`);
    if (/\b(is|are) (perfectly |completely |very )?safe\b/i.test(JSON.stringify([d.intro, d.page]))) throw new Error(`hikes: ${slug} must not call a route safe`);
    return d;
  });
  const E = EXTRA.map(slug => {
    const d = JSON.parse(fs.readFileSync(path.join(dir, slug + '.json'), 'utf8'));
    if (d.slug !== slug || d.n) throw new Error(`hikes: ${slug} is not a card route and must not carry a number`);
    if (!d.page || !Array.isArray(d.page.route) || !Array.isArray(d.page.notConfirmed) || !d.page.status) throw new Error(`hikes: ${slug} needs the reader-facing page text and a status line`);
    if (!d.sources || d.sources.length < 3 || !d.lastChecked || !Array.isArray(d._doubts)) throw new Error(`hikes: ${slug} needs sources, lastChecked and _doubts`);
    if (!d.trailhead || typeof d.trailhead.lat !== 'number' || typeof d.trailhead.lng !== 'number') throw new Error(`hikes: ${slug} needs trailhead coordinates`);
    if (/\b(is|are) (perfectly |completely |very )?safe\b/i.test(JSON.stringify([d.intro, d.page]))) throw new Error(`hikes: ${slug} must not call a route safe`);
    return d;
  });
  const ALL = H.concat(E);
  const list = v => Array.isArray(v) ? v : String(v || '').split(/\n\n+/).filter(Boolean);
  const p = v => list(v).map(x => `<p>${esc(x)}</p>`).join('');
  const na = (v, fallback) => (v === null || v === undefined || v === '') ? `<span class="hk-na">${esc(fallback)}</span>` : esc(v);
  const when = d => { const [y, m, dd] = d.lastChecked.split('-').map(Number); return `${dd} ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]} ${y}`; };
  const gcls = g => 'hk-g-' + g.toLowerCase();
  const mapUrl = d => `https://www.google.com/maps/search/?api=1&query=${d.trailhead.lat},${d.trailhead.lng}`;

  const CSS = `<style>
.hk-hero{position:relative;background:#16110C;color:#F7EFE2;overflow:hidden}
.hk-hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.62}
.hk-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(22,17,12,.5),rgba(22,17,12,.2) 40%,rgba(22,17,12,.86))}
.hk-hero-in{position:relative;z-index:1;max-width:980px;margin:0 auto;padding:clamp(40px,7vw,84px) 20px clamp(26px,4vw,40px)}
.hk-crumbs{font-family:'Space Mono',monospace;font-size:11.5px;letter-spacing:1.4px;text-transform:uppercase;color:#EADBC4;margin:0 0 18px}
.hk-crumbs a{color:#EADBC4;text-underline-offset:3px}
.hk-badge{display:inline-flex;align-items:center;gap:8px;font-family:'Space Mono',monospace;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:700;padding:6px 12px;border-radius:999px;color:#16110C}
.hk-g-easy{background:#BFE3C0}.hk-g-moderate{background:#F2C98C}.hk-g-difficult{background:#F0A58C}
.hk-hero h1{font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-weight:600;font-size:clamp(32px,5.2vw,58px);line-height:1.05;margin:14px 0 8px;color:#FFF8EC;text-wrap:balance}
.hk-where{font-size:16.5px;line-height:1.5;color:#F3E7D3;margin:0;max-width:44em}
.hk-credit{position:relative;z-index:1;max-width:980px;margin:0 auto;padding:0 20px 12px;font-size:12px;color:#E2D3BC}
.hk-credit a{color:#E2D3BC}
.hk-main{max-width:980px;margin:0 auto;padding:0 20px 56px}
.hk-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:-22px 0 26px;position:relative;z-index:2}
.hk-stat{background:#FFFDF8;border:1px solid rgba(43,37,32,.14);border-radius:14px;padding:14px 16px;box-shadow:0 10px 26px rgba(43,37,32,.08)}
.hk-stat small{display:block;font-family:'Space Mono',monospace;font-size:10.5px;letter-spacing:1.6px;text-transform:uppercase;color:#6B5A45;margin-bottom:5px}
.hk-stat b{display:block;font-size:16px;line-height:1.35;color:#2B2018;font-weight:600}
.hk-notice{border:1px solid #B8651B;background:#FFF4E3;color:#4A2A08;border-radius:14px;padding:14px 16px;margin:0 0 24px;font-size:15.5px;line-height:1.55}
.hk-notice b{display:block;font-family:'Space Mono',monospace;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;margin-bottom:4px;color:#7E4114}
.hk-intro{font-size:18px;line-height:1.6;color:#2B2018;margin:0 0 8px}
.hk-sec{margin:34px 0 0}
.hk-sec h2{font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-weight:600;font-size:clamp(25px,3.2vw,32px);line-height:1.15;margin:0 0 12px;color:#2B2018}
.hk-sec p,.hk-sec li{font-size:16.5px;line-height:1.65;color:#33271B}
.hk-sec p{margin:0 0 12px}
.hk-sec ul{margin:0 0 12px;padding-left:20px}
.hk-sec li{margin:0 0 6px}
.hk-dl{display:grid;grid-template-columns:minmax(120px,190px) 1fr;gap:0;border-top:1px solid rgba(43,37,32,.14);margin:0 0 14px}
.hk-dl dt,.hk-dl dd{padding:11px 0;border-bottom:1px solid rgba(43,37,32,.14);margin:0;font-size:16px;line-height:1.55}
.hk-dl dt{font-family:'Space Mono',monospace;font-size:11.5px;letter-spacing:1.4px;text-transform:uppercase;color:#6B5A45;padding-right:14px;padding-top:14px}
.hk-dl dd{color:#33271B}
.hk-na{color:#7A4A12;font-weight:600}
.hk-map{display:inline-flex;align-items:center;gap:8px;min-height:48px;padding:0 20px;border-radius:999px;background:#285C5C;color:#FFF8EC;font-weight:600;font-size:15px;text-decoration:none;margin:2px 0 6px}
.hk-map:hover{background:#1F4B4B}
.hk-coord{font-family:'Space Mono',monospace;font-size:14px;color:#33271B}
.hk-two{display:grid;grid-template-columns:1fr 1fr;gap:26px}
.hk-sos{background:#2B2018;color:#FFF8EC;border-radius:14px;padding:16px 18px;margin:14px 0 0;font-size:16px;line-height:1.55}
.hk-sos b{color:#F2C98C}
.hk-src{font-size:14.5px;line-height:1.6;padding-left:20px}
.hk-src li{font-size:14.5px;margin:0 0 4px}
.hk-src a{color:#7E4114;word-break:break-word}
.hk-doubts li{font-size:15px}
.hk-foot{font-family:'Space Mono',monospace;font-size:12px;letter-spacing:.6px;color:#5C5148;margin:26px 0 0}
.hk-next{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0 0}
.hk-next a{display:block;border:1px solid rgba(43,37,32,.16);border-radius:14px;padding:16px;text-decoration:none;color:#2B2018;background:#FFFDF8}
.hk-next a:hover{border-color:#A95A21}
.hk-next small{display:block;font-family:'Space Mono',monospace;font-size:10.5px;letter-spacing:1.6px;text-transform:uppercase;color:#7E4114;margin-bottom:5px}
.hk-next b{display:block;font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-size:21px;font-weight:600;line-height:1.15}
.hk-next span{display:block;font-size:14px;line-height:1.45;color:#5C5148;margin-top:4px}
.hk-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:18px 0 0}
.hk-card{display:flex;flex-direction:column;border:1px solid rgba(43,37,32,.16);border-radius:16px;overflow:hidden;text-decoration:none;color:#2B2018;background:#FFFDF8}
.hk-card:hover{border-color:#A95A21;box-shadow:0 12px 30px rgba(43,37,32,.1)}
.hk-card-img{aspect-ratio:16/9;background:#2B2018 center/cover;display:block;width:100%;object-fit:cover}
.hk-card-ph{aspect-ratio:16/9;background:linear-gradient(135deg,#3A2A1C,#6B4A2C);display:flex;align-items:flex-end;padding:14px;color:#F3E7D3;font-family:'Space Mono',monospace;font-size:11px;letter-spacing:1.4px;text-transform:uppercase}
.hk-card-b{padding:16px 18px 18px;display:flex;flex-direction:column;gap:6px}
.hk-card-b h3{font-family:'Cormorant Garamond',Georgia,serif;font-size-adjust:.44;font-size:25px;font-weight:600;line-height:1.12;margin:6px 0 0}
.hk-card-b p{font-size:15px;line-height:1.5;color:#4A3D2F;margin:0}
.hk-card-m{font-family:'Space Mono',monospace;font-size:12px;letter-spacing:.4px;color:#33271B}
.hk-scale{margin:14px 0 0;padding:0;list-style:none}
.hk-scale li{display:grid;grid-template-columns:110px 1fr;gap:12px;align-items:start;padding:10px 0;border-bottom:1px solid rgba(43,37,32,.12);font-size:16px;line-height:1.55}
.hk-scale .hk-badge{justify-content:center}
@media(max-width:760px){
  .hk-stats{grid-template-columns:repeat(2,minmax(0,1fr));margin-top:-16px}
  .hk-two,.hk-next,.hk-list{grid-template-columns:1fr}
  .hk-dl{grid-template-columns:1fr}
  .hk-dl dt{border-bottom:0;padding-bottom:0}
  .hk-dl dd{padding-top:4px}
  .hk-scale li{grid-template-columns:1fr}
  .hk-scale .hk-badge{justify-self:start}
}
</style>`;

  const img = (d, cls, lazy) => d.photo ? `<img class="${cls}" src="${esc(d.photo.src)}" alt="${esc(d.photo.alt || d.photo.what || d.name)}"${d.photo.w ? ` width="${d.photo.w}" height="${d.photo.h}"` : ''} ${lazy ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">` : '';
  const credit = d => d.photo ? `<p class="hk-credit">Photo: <a href="${esc(d.photo.page)}" target="_blank" rel="noopener nofollow">${esc(d.photo.author)}</a>, <a href="${esc(d.photo.licenseUrl)}" target="_blank" rel="noopener nofollow">${esc(d.photo.license)}</a>, Wikimedia Commons${d.photo.edits ? ' (' + esc(d.photo.edits) + ')' : ''}. ${esc(d.photo.what || '')}</p>` : '';

  function page(d) {
    const th = d.trailhead, P = d.page, url = `${SITE}/trail/hikes/${d.slug}/`;
    const pool = d.n ? H : E.concat(H);
    const others = pool.filter(x => x.slug !== d.slug && x.grade === d.grade).concat(pool.filter(x => x.slug !== d.slug && x.grade !== d.grade)).slice(0, 3);
    const place = d.placeSlug || d.nearPlace;
    const placeName = place ? JSON.parse(fs.readFileSync(path.join(root, 'content', 'locations', place + '.json'), 'utf8')).name : null;
    const body = `${CSS}
<section class="hk-hero">
  ${img(d, 'hk-hero-img', false)}
  <div class="hk-hero-in">
    <p class="hk-crumbs"><a href="/trail/">Sahra Trail</a> &rsaquo; <a href="/trail/hikes/">UAE hikes</a> &rsaquo; ${d.n ? `Route ${d.n} of 6` : 'Ras Al Khaimah'}</p>
    <span class="hk-badge ${gcls(d.grade)}">${esc(d.grade)}</span>
    <h1>${esc(d.name)}</h1>
    <p class="hk-where">${esc(d.area)}</p>
  </div>
  ${credit(d)}
</section>
<main class="hk-main">
  <div class="hk-stats">
    <div class="hk-stat"><small>Distance</small><b>${esc(d.facts.distance)}</b></div>
    <div class="hk-stat"><small>Total climb</small><b>${esc(d.facts.climb)}</b></div>
    <div class="hk-stat"><small>Typical time</small><b>${esc(d.facts.time)}</b></div>
    <div class="hk-stat"><small>Shape</small><b>${esc(d.facts.shape)}</b></div>
  </div>
  ${!d.n && d.page.status ? `<div class="hk-notice" role="note"><b>${d.official ? 'Route status' : 'Unmarked route'}</b>${esc(d.page.status)}</div>` : ''}
  ${NOTICE[d.slug] ? `<div class="hk-notice" role="note"><b>Check before you go</b>${esc(NOTICE[d.slug])}</div>` : ''}
  <p class="hk-intro">${esc(d.intro)}</p>

  <section class="hk-sec"><h2>Why it is graded ${esc(d.grade)}</h2>
    <p>${esc(P.gradeBasis)}</p>
    <p>We use one scale across all our routes: <a href="/trail/hikes/#scale">how we grade</a>.</p>
  </section>

  <section class="hk-sec"><h2>The route</h2>${p(P.route)}
    <dl class="hk-dl">
      <dt>Distance</dt><dd>${na(P.distance, 'No source gives this.')}</dd>
      <dt>Climb</dt><dd>${na(P.climb, 'No source gives a total climb.')}</dd>
      <dt>Time</dt><dd>${na(P.time, 'No source gives a time.')}</dd>
    </dl>
  </section>

  <section class="hk-sec"><h2>Trailhead</h2>
    <dl class="hk-dl">
      <dt>Start</dt><dd>${na(P.start, 'Not named by any source.')}</dd>
      <dt>Coordinates</dt><dd><span class="hk-coord">${th.lat.toFixed(5)}, ${th.lng.toFixed(5)}</span><br>${esc(P.coordNote || '')}</dd>
      <dt>Parking</dt><dd>${na(P.parking, 'No source describes the parking. Confirm before you travel.')}</dd>
      <dt>Vehicle</dt><dd>${na(P.vehicle, 'No source says whether a 4WD is needed. Confirm before you travel.')}</dd>
      ${P.getting ? `<dt>Getting there</dt><dd>${esc(P.getting)}</dd>` : ''}
    </dl>
    <a class="hk-map" href="${esc(mapUrl(d))}" target="_blank" rel="noopener" data-track="hike_map">Open the trailhead in Google Maps &rarr;</a>
  </section>

  <section class="hk-sec"><h2>When to go</h2>
    <dl class="hk-dl">
      <dt>Best months</dt><dd>${na(P.bestMonths, 'No source gives a season.')}</dd>
      <dt>Start time</dt><dd>${na(P.startTime, 'Start early and be off the route before the heat of the day.')}</dd>
      <dt>Shade</dt><dd>${na(P.shade, 'Unknown: no source describes it.')}</dd>
      <dt>Water</dt><dd>${na(P.water, 'Unknown: assume there is none and carry all you need.')}</dd>
      <dt>Mobile signal</dt><dd>${na(P.signal, 'Unknown: no source reports it. Do not rely on it.')}</dd>
    </dl>
  </section>

  <section class="hk-sec"><h2>Fees, permits, hours and closures</h2>
    <dl class="hk-dl">
      <dt>Fees</dt><dd>${na(P.fees, 'None found.')}</dd>
      <dt>Permits</dt><dd>${na(P.permits, 'None found.')}</dd>
      <dt>Hours</dt><dd>${na(P.hours, 'None published.')}</dd>
      <dt>Closures</dt><dd>${na(P.closure, 'None found.')}</dd>
    </dl>
    <p>Checked on ${when(d)}. Rules and closures change, above all after rain: check the source pages below on the day.</p>
  </section>

  <section class="hk-sec"><h2>Safety</h2>
    <div class="hk-two">
      <div><ul>${list(P.safety).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div><h3 style="font-family:'Space Mono',monospace;font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:#6B5A45;margin:0 0 8px">What to carry</h3><ul>${list(P.carry).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
    </div>
    <p>Tell someone your route and when you expect to be back. Turn around if the weather, the heat or the time is against you. We describe this route from published sources; we have not surveyed it, and nothing here is a statement that it is safe for you on the day.</p>
    <div class="hk-sos"><b>In an emergency</b><br>${esc(P.emergency)}</div>
  </section>

  <section class="hk-sec"><h2>What we could not confirm</h2>
    <ul class="hk-doubts">${P.notConfirmed.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
  </section>

  <section class="hk-sec"><h2>Sources</h2>
    <ul class="hk-src">${d.sources.filter(x => /^https?:\/\//.test(x.url || '')).map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(s.label)}</a></li>`).join('')}</ul>
    <p class="hk-foot">Last checked ${when(d)}${d.n ? ` &middot; Route ${d.n} of 6 &middot; ${esc(SITE.replace('https://', ''))}/h/${d.n}` : ''}</p>
  </section>

  <section class="hk-sec"><h2>More</h2>
    <div class="hk-next">
      ${others.slice(0, 1).map(o => `<a href="/trail/hikes/${o.slug}/"><small>${esc(o.grade)}${o.n ? ` &middot; route ${o.n}` : ' &middot; Ras Al Khaimah'}</small><b>${esc(o.name)}</b><span>${esc(o.facts.distance)}</span></a>`).join('')}
      ${placeName ? `<a href="/locations/${place}/"><small>Place guide</small><b>${esc(placeName)}</b><span>${d.placeSlug ? 'Our guide to the place this route starts from.' : 'Our guide to the nearest place we cover.'}</span></a>` : `<a href="/hiking/"><small>Guide</small><b>Hiking in the UAE</b><span>Season, heat, water and rules by emirate.</span></a>`}
      <a href="/trail/"><small>Sahra Trail</small><b>Sahra Trail Tee and 2-in-1 Shorts</b><span>Our running and trail kit, designed in the UAE.</span></a>
    </div>
    <p style="margin-top:16px"><a href="/trail/hikes/">All our UAE hikes, by grade &rarr;</a></p>
  </section>
</main>`;
    const jsonld = [
      { '@context': 'https://schema.org', '@type': 'Article', headline: d.name, description: d.seoDesc, url, dateModified: d.lastChecked,
        about: { '@type': 'Place', name: d.name, geo: { '@type': 'GeoCoordinates', latitude: th.lat, longitude: th.lng } },
        publisher: { '@type': 'Organization', name: 'Sahra & Beyond', url: SITE + '/' } },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Sahra Trail', item: SITE + '/trail/' },
        { '@type': 'ListItem', position: 2, name: 'UAE hikes', item: SITE + '/trail/hikes/' },
        { '@type': 'ListItem', position: 3, name: d.name, item: url }] }
    ];
    write(`trail/hikes/${d.slug}/index.html`, shell({ title: d.seoTitle, desc: d.seoDesc, canonical: url, jsonld, bodyHtml: body, activeNav: 'trail', bodyClass: 'buy-page hike-page', image: d.photo ? SITE + d.photo.src : undefined }));
  }
  ALL.forEach(page);

  /* ---- the index ---- */
  const iurl = `${SITE}/trail/hikes/`;
  const ititle = 'UAE Hikes by Grade: Sharjah, Fujairah, Ras Al Khaimah', idesc = 'UAE hiking routes by grade, each with distance, climb, time, trailhead coordinates and the sources behind every figure.';
  const card = d => `<a class="hk-card" href="/trail/hikes/${d.slug}/">${d.photo ? img(d, 'hk-card-img', true) : `<span class="hk-card-ph">No photo yet</span>`}<span class="hk-card-b"><span class="hk-badge ${gcls(d.grade)}" style="align-self:flex-start">${esc(d.grade)}${d.n ? ` &middot; ${d.n}` : ''}</span>${!d.n && !d.official ? '<span class="hk-card-m">Unmarked route</span>' : ''}<h3>${esc(d.name)}</h3><p>${esc(d.area)}</p><span class="hk-card-m">${esc(d.report.distance)} &middot; ${esc(d.report.time)}</span></span></a>`;
  const ibody = `${CSS}
<section class="hk-hero"><div class="hk-hero-in">
  <p class="hk-crumbs"><a href="/trail/">Sahra Trail</a> &rsaquo; UAE hikes</p>
  <h1>UAE hikes, by grade</h1>
  <p class="hk-where">Two easy, two moderate and two difficult routes in Sharjah, Fujairah and Ras Al Khaimah. Each page gives the distance, the climb, the time, the trailhead and the sources behind every figure.</p>
</div></section>
<main class="hk-main">
  <section class="hk-sec" style="margin-top:26px"><p class="hk-intro">These are the routes on the cards that come with Sahra Trail orders. Each one is a specific walk from a named start, not a general area. Where no source gives a figure, the page says so.</p></section>
  ${['Easy', 'Moderate', 'Difficult'].map(g => `<section class="hk-sec"><h2>${g}</h2><div class="hk-list">${H.filter(d => d.grade === g).map(card).join('')}</div></section>`).join('')}
  <section class="hk-sec" id="more-rak"><h2>More hikes in Ras Al Khaimah</h2>
    <p>Five more routes in the Ras Al Khaimah mountains. They are not on the cards. Most are unmarked, with no official trail or grade, and some have a record of rescues: each page says so at the top. If you have not walked one before, go with a licensed guide.</p>
    <div class="hk-list">${E.map(card).join('')}</div>
  </section>
  <section class="hk-sec" id="scale"><h2>How we grade</h2>
    <p>One scale across every route. Where a trail operator or authority publishes a grade, we start from it and say so on the route page; otherwise the grade rests on distance, climb, ground and how hard the way is to find.</p>
    <ul class="hk-scale">${SCALE.map(([g, t]) => `<li><span class="hk-badge ${gcls(g)}">${g}</span><span>${esc(t)}</span></li>`).join('')}</ul>
  </section>
  <section class="hk-sec"><h2>Before any of them</h2>
    <ul><li>The season is roughly October to April. In summer the heat makes these routes dangerous.</li><li>Start at first light, carry more water than you think you need, and tell someone your route and return time.</li><li>Stay out of wadis in rain or when rain is forecast: they flood fast.</li><li>Police 999, ambulance 998.</li></ul>
    <p>More in our <a href="/hiking/">guide to hiking in the UAE</a>, and our kit for it: <a href="/trail/">Sahra Trail</a>.</p>
  </section>
</main>`;
  write('trail/hikes/index.html', shell({ title: ititle, desc: idesc, canonical: iurl, bodyHtml: ibody, activeNav: 'trail', bodyClass: 'buy-page hike-page',
    jsonld: [{ '@context': 'https://schema.org', '@type': 'ItemList', name: 'UAE hikes by grade', url: iurl,
      itemListElement: ALL.map((d, i) => ({ '@type': 'ListItem', position: i + 1, name: d.name, url: `${SITE}/trail/hikes/${d.slug}/` })) }] }));

  /* ---- /h/<n>/ : the address the QR encodes. Static, so it survives a host change. ---- */
  H.forEach(d => {
    const to = `/trail/hikes/${d.slug}/${UTM(d.n)}`;
    write(`h/${d.n}/index.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.name)} | Sahra & Beyond</title><meta name="robots" content="noindex,follow"><link rel="canonical" href="${SITE}/trail/hikes/${d.slug}/"><meta http-equiv="refresh" content="0;url=${to}"><meta name="viewport" content="width=device-width,initial-scale=1"><script>location.replace(${JSON.stringify(to)})</script></head><body style="font-family:system-ui,sans-serif;padding:24px"><p><a href="${to}">${esc(d.name)}: open the route page</a></p></body></html>\n`);
  });

  /* ---- vercel.json: the same redirects at the edge (temporary, so a target can be re-pointed) ---- */
  const vp = path.join(root, 'vercel.json'), V = JSON.parse(fs.readFileSync(vp, 'utf8'));
  const keep = (V.redirects || []).filter(r => !/^\/[hH]\/\d/.test(r.source));
  const mine = [];
  H.forEach(d => { const destination = `/trail/hikes/${d.slug}/${UTM(d.n)}`; [`/h/${d.n}`, `/h/${d.n}/`, `/H/${d.n}`, `/H/${d.n}/`].forEach(source => mine.push({ source, destination, permanent: false })); });
  const next = JSON.stringify(Object.assign({}, V, { redirects: keep.concat(mine) }), null, 2) + '\n';
  if (next !== fs.readFileSync(vp, 'utf8')) fs.writeFileSync(vp, next);

  console.log(`  ✓ Sahra Trail hikes: /trail/hikes/ + ${H.length} card routes (short URLs /h/1 to /h/${H.length}) + ${E.length} more RAK hikes`);
  return ALL.map(d => ({ slug: d.slug, n: d.n, lastChecked: d.lastChecked }));
};
module.exports.ORDER = ORDER;
module.exports.EXTRA = EXTRA;
