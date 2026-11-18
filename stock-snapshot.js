/* stock-snapshot.js (18 Nov 2026, ad-visitor persona audit; Faheem chose "Honest stock, no flicker")
   Writes content/stock.json: which sizes of each product are for sale, read from Shopify's public Storefront API (the
   same read-only token the bag uses). build.js runs it first, so every product page is built with its sold-out sizes
   already marked; the page script still checks live stock a moment later and corrects anything that changed since.
   If Shopify can't be reached the last snapshot is kept (or none), and the page behaves as before. */
'use strict';
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, 'content', 'stock.json');
const S = { domain: 'sahra-beyond.myshopify.com', token: 'cc42ba8e74eb27c4f3c062d93f893fa0', v: '2024-10' };
const Q = 'query($a:String){products(first:100,after:$a){pageInfo{hasNextPage endCursor}edges{node{handle variants(first:30){edges{node{title availableForSale}}}}}}}';
async function main() {
  const stock = {}; let after = null;
  for (let page = 0; page < 5; page++) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(`https://${S.domain}/api/${S.v}/graphql.json`, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': S.token }, body: JSON.stringify({ query: Q, variables: { a: after } }) });
    clearTimeout(t);
    const j = await r.json(); if (j.errors || !j.data) throw new Error(JSON.stringify(j.errors || j).slice(0, 200));
    j.data.products.edges.forEach(({ node }) => { stock[node.handle] = {}; node.variants.edges.forEach(({ node: v }) => { stock[node.handle][v.title] = !!v.availableForSale; }); });
    if (!j.data.products.pageInfo.hasNextPage) break; after = j.data.products.pageInfo.endCursor;
  }
  if (Object.keys(stock).length < 5) throw new Error('too few products (' + Object.keys(stock).length + ')');
  fs.writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), stock }, null, 1) + '\n');
  console.log(`  ✓ stock snapshot: ${Object.keys(stock).length} products`);
}
main().catch(e => { console.log(`  ! stock snapshot skipped (${e.message}); ${fs.existsSync(OUT) ? 'keeping the last one' : 'pages show live stock only'}`); });
