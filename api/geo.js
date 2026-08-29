// Vercel serverless function — tells the browser which country it is in.
//
// WHY THIS EXISTS INSTEAD OF EDGE MIDDLEWARE
// The site is fully static and framework-less. Middleware would need the
// @vercel/edge package and a build step this repo deliberately does not have,
// and a bug in middleware breaks every page at once. A tiny /api function uses
// the exact pattern already proven here by auth.js / callback.js, and if it
// ever fails the site degrades to the UAE default rather than going down.
//
// Vercel sets x-vercel-ip-country on every request from its edge. Locally and
// in `vercel dev` the header is absent — we return AE so the site behaves as
// its historical UAE self rather than guessing.
//
// CACHING: `private` and nothing shared. An earlier draft used s-maxage and
// review caught why that is a live bug, not a nitpick: a shared cache is keyed
// by URL only, but this response body depends on the caller's country, and one
// Vercel PoP serves a CLUSTER of neighbouring countries — the Gulf states this
// site most needs to tell apart are exactly the countries likely to share one
// Middle East PoP. With s-maxage, the first visitor after a cache miss would
// have decided the country for everyone on that PoP for an hour. Per-browser
// caching costs almost nothing anyway: sahra-market.js already keeps the
// answer in sessionStorage, so each browser asks once per session.
module.exports = (req, res) => {
  const cc = String(req.headers['x-vercel-ip-country'] || 'AE').toUpperCase();
  // Two-letter ISO or bust — never reflect arbitrary header content back out.
  const safe = /^[A-Z]{2}$/.test(cc) ? cc : 'AE';
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ c: safe }));
};
