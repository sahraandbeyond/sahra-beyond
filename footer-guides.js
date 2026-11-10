/* One list of guides for every footer (2 Oct 2026, SEO handover items 2–3).
   build.js (generated pages), build-products.js (product pages) and the
   hand-maintained index.html / shop-preview.html (filled between
   <!--GUIDES:START--> and <!--GUIDES:END--> on every build) all read this, so a
   new guide only has to be added once and can never be orphaned again. */
const GUIDES = [
  ['/places/', 'All places'],
  ['/camping/', 'Camping in the UAE'],
  ['/camping-near-dubai/', 'Camping near Dubai'],
  ['/desert-camping-beginners/', 'Camping for beginners'],
  ['/secluded-camping/', 'Secluded camping'],
  ['/stargazing/', 'Milky Way / stargazing'],
  ['/wadis/', 'Wadis in the UAE'],
  ['/hiking/', 'Hiking in the UAE'],
  ['/mountain-escapes/', 'Mountain escapes'],
  ['/hatta-guide/', 'Hatta day trip'],
  ['/best-beaches/', 'Best beaches'],
  ['/fujairah-beaches/', 'Fujairah beaches'],
  ['/snorkeling/', 'Snorkeling'],
  ['/desert-safari/', 'Desert safari'],
  ['/family-friendly-outdoors/', 'Family-friendly'],
  ['/outdoor-things-to-do/', 'Things to do']
];
const SHOP_LINKS = [
  /* 23 Oct 2026 (site review): the new pages and the buying categories */
  ['/men/', 'Men'],
  ['/women/', 'Women'],
  ['/new/', 'New: Sahel and Sahra Trail'],
  ['/t-shirts/', 'T-shirts'],
  ['/t-shirts/oversized/', 'Oversized t-shirts'],
  ['/polos/', 'Polos'],
  ['/hoodies/', 'Hoodies'],
  ['/activewear/', 'Activewear'],
  ['/accessories/', 'Accessories'],
  ['/national-day/', 'National Day t-shirts'],
  ['/gifts/', 'Gift ideas'],
  ['/under-150/', 'Under AED 150'],
  ['/trail/', 'Sahra Trail'],
  ['/sahel/', 'Sahel: The Coast Edition'],
  ['/tote/', 'Canvas tote'],
  ['/journal/', 'Journal'],
  ['/fabric/', 'Fabric'],
  ['/size-guide/', 'Size guide']
];
const join = list => list.map(([h, t]) => `<a href="${h}">${t.replace(/&/g, '&amp;')}</a>`).join(' · ');
function guidesHtml(style, arabic) {
  /* 10 Nov 2026 (landing-page audit; Faheem: a short footer with the guide links folded away): each list sits behind its own
     fold, closed by default. The links stay in the page for search engines and open with one tap. */
  return `<div class="foot-guides" role="navigation" aria-label="Guides and more"${style ? ` style="${style}"` : ''}><details class="fg-d"><summary>Guides</summary><div>${join(GUIDES)}</div></details><details class="fg-d"><summary>More</summary><div>${join(SHOP_LINKS)}${arabic ? ' · <a href="/ar/" hreflang="ar" lang="ar">العربية</a>' : ''}</div></details></div>`;
}
const FOOT_GUIDES_CSS = '.foot-guides{position:static;display:block;max-width:980px;margin:14px auto 6px;padding:0 16px;font-size:13px;line-height:1.95;text-align:center}.foot-guides div{margin:2px 0}.foot-guides b{font-weight:600}.foot-guides a{text-decoration:none;white-space:nowrap}.foot-guides a:hover{text-decoration:underline}.foot-guides .fg-d{display:inline-block;vertical-align:top;margin:0 6px}.foot-guides .fg-d[open]{display:block;margin:0}.foot-guides summary{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;cursor:pointer;list-style:none;font-weight:600;letter-spacing:.04em}.foot-guides summary::-webkit-details-marker{display:none}.foot-guides summary::after{content:"+";font-weight:400;font-size:17px;line-height:1}.foot-guides .fg-d[open] summary::after{content:"\\2212"}.foot-guides summary:focus-visible{outline:2px solid currentColor;outline-offset:2px;border-radius:4px}';
module.exports = { GUIDES, SHOP_LINKS, guidesHtml, FOOT_GUIDES_CSS };
