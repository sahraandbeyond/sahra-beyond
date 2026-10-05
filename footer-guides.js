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
  ['/national-day/', 'National Day t-shirts'],
  ['/gifts/', 'Gift ideas'],
  ['/trail/', 'Sahra Trail'],
  ['/sahel/', 'Sahel: The Coast Edition'],
  ['/tote/', 'Canvas tote'],
  ['/journal/', 'Journal'],
  ['/fabric/', 'Fabric'],
  ['/size-guide/', 'Size guide']
];
const join = list => list.map(([h, t]) => `<a href="${h}">${t.replace(/&/g, '&amp;')}</a>`).join(' · ');
function guidesHtml(style, arabic) {
  return `<div class="foot-guides" role="navigation" aria-label="Guides and more"${style ? ` style="${style}"` : ''}><div><b>Guides:</b> ${join(GUIDES)}</div><div><b>More:</b> ${join(SHOP_LINKS)}${arabic ? ' · <a href="/ar/" hreflang="ar" lang="ar">العربية</a>' : ''}</div></div>`;
}
const FOOT_GUIDES_CSS = '.foot-guides{position:static;display:block;max-width:980px;margin:14px auto 6px;padding:0 16px;font-size:13px;line-height:1.95;text-align:center}.foot-guides div{margin:2px 0}.foot-guides b{font-weight:600}.foot-guides a{text-decoration:none;white-space:nowrap}.foot-guides a:hover{text-decoration:underline}';
module.exports = { GUIDES, SHOP_LINKS, guidesHtml, FOOT_GUIDES_CSS };
