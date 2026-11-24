/* brand-entity.js — one description of the brand for search engines (24 Nov 2026).

   Faheem: "Sahra Dubai doesn't lead to us. Sahra doesn't lead to us. We need to be at
   the top of every possible relevant keyword." Search Console (90 days) showed the site
   at about #7 for "sahra" and off page 1 for "sahra dubai". The generic word belongs to
   many businesses (Sahra Group, Sahra Partners, sahrastore.ae), so the lever is to tell
   Google, the same way on every page, that the clothing brand called Sahra is this one:
   - one Organization with every official account in sameAs (before: Instagram only);
   - the names people actually type as alternateName ("Sahra", the Arabic name);
   - Sahra Trail as the brand's activewear line;
   - areaServed naming Dubai and the other emirates. Faheem chose "Serve Dubai, based in
     UAE": we deliver there, we never say we are based there. The registered address
     (Sharjah Publishing City Free Zone) stays as it is.
   The visible "Follow" line in every footer (footer-guides.js) reads the same list. */
const fs = require('fs');
const path = require('path');

const SITE = 'https://www.sahraandbeyond.ae';
let settings = {};
try { settings = JSON.parse(fs.readFileSync(path.join(__dirname, 'content/settings.json'), 'utf8')); } catch (e) {}
const S = settings.social || {};

/* order = the order shown in the footer */
const SOCIAL = [
  ['Instagram', S.instagram || 'https://instagram.com/sahraandbeyond.ae'],
  ['TikTok', S.tiktok],
  ['YouTube', S.youtube],
  ['Facebook', S.facebook]
].filter(([, u]) => u);
const SAME_AS = SOCIAL.map(([, u]) => u);

const NAMES = ['Sahra and Beyond', 'Sahra Beyond', 'Sahra', 'صحراء وما بعدها'];
const AREAS = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain', 'United Arab Emirates']
  .map(n => n === 'United Arab Emirates' ? { '@type': 'Country', name: n } : { '@type': 'City', name: n });
const ADDRESS = { '@type': 'PostalAddress', streetAddress: 'Business Centre, Sharjah Publishing City Free Zone', addressLocality: 'Sharjah', addressCountry: 'AE', postOfficeBox: '73111' };
const TRAIL = { '@type': 'Brand', '@id': SITE + '/trail/#brand', name: 'Sahra Trail', url: SITE + '/trail/', description: 'Running and trail wear designed in the UAE; the activewear line of Sahra & Beyond.' };

function org(extra) {
  return Object.assign({
    '@context': 'https://schema.org', '@type': 'Organization', '@id': SITE + '/#organization',
    name: 'Sahra & Beyond', alternateName: NAMES, legalName: 'SAHRA AND BEYOND FZE LLC',
    description: 'A UAE clothing brand: graphic tees, polos and hoodies drawn from real UAE places, and Sahra Trail running and trail wear. Next-day delivery in Dubai and across the UAE.',
    url: SITE + '/', logo: SITE + '/icon-512.png', slogan: 'Designed in the UAE for everyone who loves it.',
    email: 'hello@sahraandbeyond.ae', telephone: '+971585449946',
    address: ADDRESS, areaServed: AREAS,
    brand: [{ '@type': 'Brand', name: 'Sahra & Beyond' }, { '@id': TRAIL['@id'] }],
    sameAs: SAME_AS
  }, extra || {});
}
function website() {
  return { '@context': 'https://schema.org', '@type': 'WebSite', '@id': SITE + '/#website', name: 'Sahra & Beyond', alternateName: NAMES.slice(0, 3), url: SITE + '/', description: 'Premium tees, polos and hoodies, designed in the UAE for everyone who loves it.', publisher: { '@id': SITE + '/#organization' }, inLanguage: 'en' };
}
function trailBrand() {
  return { '@context': 'https://schema.org', '@type': 'Brand', name: TRAIL.name, '@id': TRAIL['@id'], url: TRAIL.url, description: TRAIL.description, parentOrganization: { '@id': SITE + '/#organization' } };
}

/* the footer line: plain links, the brand names stay in Latin in Arabic too */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
function followHtml() {
  if (!SOCIAL.length) return '';
  return `<p class="fg-soc">Follow Sahra &amp; Beyond: ${SOCIAL.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener me">${n}</a>`).join(' · ')}</p>`;
}
const FOLLOW_CSS = '.foot-guides .fg-soc{margin:6px 0 0;font-size:13px}.foot-guides .fg-soc a{font-weight:600}';

module.exports = { SITE, SOCIAL, SAME_AS, NAMES, org, website, trailBrand, followHtml, FOLLOW_CSS };
