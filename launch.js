#!/usr/bin/env node
/* ==========================================================================
   launch.js — the launch cutover, in one command.
   ==========================================================================
   WHY THIS EXISTS
   Going live used to be a manual multi-step sequence (flip a flag, promote the
   homepage, strip noindex tags, rename the shop, rebuild) — exactly the kind of
   checklist where something gets missed on the day. This does it in one go,
   refuses to run if the site isn't legally ready, and can be reversed.

   USAGE
     node launch.js --check      Report readiness. Changes nothing. (default)
     node launch.js --reveal     Make the site public, WITHOUT the cart (no payments yet).
     node launch.js --go         Full launch: shop + cart live. Needs a working payment method.
     node launch.js --rollback   Put the coming-soon page back.

   WHAT --go DOES
     1. Blocks if policies.html still has unfilled [placeholders]  (UAE law)
     2. Backs up index.html            -> _backup/index.coming-soon.html
     3. Promotes homepage-preview.html -> index.html  (noindex stripped,
        relative asset paths rooted, shop links pointed at /shop/)
     4. Flips LAUNCHED = true in build.js  (this generates /shop/, adds Shop to
        the nav and puts the shop + products in the sitemap)
     5. Sets policies.html back to index,follow
     6. Runs build.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const BACKUP = path.join(ROOT, '_backup');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const wr = (f, c) => { fs.mkdirSync(path.dirname(path.join(ROOT, f)), { recursive: true }); fs.writeFileSync(path.join(ROOT, f), c); };
const has = f => fs.existsSync(path.join(ROOT, f));

const C = { ok: '\x1b[32m', bad: '\x1b[31m', warn: '\x1b[33m', dim: '\x1b[2m', off: '\x1b[0m', b: '\x1b[1m' };
const ok = m => console.log(`  ${C.ok}✓${C.off} ${m}`);
const bad = m => console.log(`  ${C.bad}✗${C.off} ${m}`);
const warn = m => console.log(`  ${C.warn}!${C.off} ${m}`);

/* ---------------- readiness checks ---------------- */
function checks() {
  const out = [];
  const push = (fatal, pass, label, detail) => out.push({ fatal, pass, label, detail });

  // 1. Legal placeholders — a hard blocker. Never take orders behind [LICENCE NUMBER].
  const pol = has('policies.html') ? rd('policies.html') : '';
  const todos = (pol.match(/class="todo"/g) || []).length;
  push(true, todos === 0, `policies.html has no unfilled placeholders`,
    todos ? `${todos} placeholder(s) left — trade licence, TRN, address, courier, fees, dates` : 'all filled');

  // 2. Source files present
  push(true, has('homepage-preview.html'), 'homepage-preview.html exists', '');
  push(true, has('shop-preview.html'), 'shop-preview.html exists', '');
  push(true, has('build.js'), 'build.js exists', '');

  // 3. Shopify wired (shop runs in DEMO mode if the token is still a placeholder)
  const shop = has('shop-preview.html') ? rd('shop-preview.html') : '';
  const demo = /YOUR-STORE|YOUR_/.test((shop.match(/var SHOPIFY\s*=\s*\{[^}]*\}/) || [''])[0]);
  push(true, !demo, 'Shopify domain + Storefront token are set', demo ? 'shop would run in DEMO mode' : '');

  // 3b. Graded size spec must be confirmed — wrong measurements drive returns.
  let sizingOk = false, sizingWhy = 'content/sizing.json missing';
  try {
    const sz = JSON.parse(fs.readFileSync(path.join(ROOT,'content/sizing.json'),'utf8'));
    sizingOk = sz.confirmed === true && Array.isArray(sz.regular) && sz.regular.length > 0;
    if (!sizingOk) sizingWhy = 'sizing.json present but not confirmed';
  } catch(e){}
  // We do not produce XXL. Guard against it creeping back in from a spec sheet.
  let hasXXL = false;
  try {
    const sz = JSON.parse(fs.readFileSync(path.join(ROOT,'content/sizing.json'),'utf8'));
    hasXXL = (sz.sizes||[]).includes('XXL') || (sz.regular||[]).some(r=>r[0]==='XXL') || (sz.oversized||[]).some(r=>r[0]==='XXL');
  } catch(e){}
  push(true, !hasXXL, 'no XXL in the size spec', hasXXL ? 'XXL found — we produce S–XL only' : 'S–XL as produced');

  push(true, sizingOk, 'graded size spec confirmed', sizingOk ? 'production chart, S–XL, dual unit' : sizingWhy);

  // 4. Products exist
  const pdir = path.join(ROOT, 'content/products');
  const n = fs.existsSync(pdir) ? fs.readdirSync(pdir).filter(f => f.endsWith('.json')).length : 0;
  push(false, n > 0, `${n} product page(s) defined`, n ? '' : 'no content/products/*.json');

  // 5. Real product photos (soft warning — mockups are still valid files)
  const usesMockups = /design-(black|beige|taupe)-(front|back)\.jpg/.test(has('homepage-preview.html') ? rd('homepage-preview.html') : '');
  push(false, !usesMockups, 'homepage uses final product photos', usesMockups ? 'still referencing design-*.jpg mockups' : '');

  // 6. Already launched?
  const b = rd('build.js');
  push(false, /const LAUNCHED = false/.test(b), 'not already launched', /const LAUNCHED = true/.test(b) ? 'LAUNCHED is already true' : '');

  return out;
}

function report(list) {
  console.log(`\n${C.b}Launch readiness${C.off}\n`);
  list.forEach(c => {
    const line = c.detail ? `${c.label} ${C.dim}— ${c.detail}${C.off}` : c.label;
    c.pass ? ok(line) : (c.fatal ? bad(line) : warn(line));
  });
  const blockers = list.filter(c => c.fatal && !c.pass);
  const warns = list.filter(c => !c.fatal && !c.pass);
  console.log('');
  if (blockers.length) console.log(`  ${C.bad}${blockers.length} blocker(s)${C.off} — cannot launch yet.`);
  else console.log(`  ${C.ok}No blockers.${C.off}${warns.length ? ` ${warns.length} warning(s) — review, but they won't stop launch.` : ''}`);
  return blockers.length === 0;
}

/* ---------------- the cutover ---------------- */
function promoteHomepage() {
  let h = rd('homepage-preview.html');
  // strip the preview-only robots tag
  h = h.replace(/<meta name="robots"[^>]*>(<!--[^>]*-->)?\n?/, '');
  // root-relative assets so they resolve from / as well as /products/ etc.
  h = h.replace(/(src|href)="(shirts\/)/g, '$1="/$2');
  // point every shop link at the real shop
  h = h.replace(/href="shop-preview\.html/g, 'href="/shop/');
  h = h.replace(/href="\/shop-preview\.html/g, 'href="/shop/');
  h = h.replace(/'shop-preview\.html'/g, "'/shop/'");
  wr('index.html', h);
  return h.length;
}

/* ---------------- reveal: site public, but no commerce ----------------
   Between "coming soon" and "open for business" there is a third state: the whole
   site visible and indexable, products fully browsable, but nothing purchasable
   because payments are not live yet. Running the full launch here would put a
   working Add to Cart in front of a checkout with no payment method — worse than
   staying hidden. So this promotes the homepage and leaves LAUNCHED = false. */
function stripCommerceFromHomepage(h) {
  const before = h;
  const notes = [];
  // 1. the cart icon — there is no cart yet
  const cart = /<a href="[^"]*shop-preview\.html"[^>]*class="nav-cart shoplink"[^>]*>[^<]*<\/a>/;
  if (cart.test(h)) { h = h.replace(cart, ''); notes.push('cart icon removed'); }
  // 2. shop CTAs point at the browsable category hub, not a shop that does not exist
  h = h.replace(/href="\/?shop-preview\.html"/g, 'href="/t-shirts/"');
  // 3. "Shop the collection" promises a transaction we cannot complete
  if (h.includes('>Shop the collection')) {
    h = h.replace(/>Shop the collection/g, '>See the collection');
    notes.push('"Shop the collection" -> "See the collection"');
  }
  // 4. card marks + "Secure checkout" imply you can pay. You cannot, yet.
  const pay = /<div class="paymarks"[\s\S]*?<\/div>\s*/;
  if (pay.test(h)) { h = h.replace(pay, ''); notes.push('payment marks removed'); }
  else {
    const sc = /<span class="paymarks-t">[^<]*<\/span>/;
    if (sc.test(h)) { h = h.replace(sc, ''); notes.push('"Secure checkout" removed'); }
  }
  if (h === before) notes.push('nothing matched — CHECK THE HOMEPAGE BY HAND');
  return { html: h, notes };
}

function reveal() {
  const list = checks();
  if (!report(list)) { console.log(`\n  Fix the blockers, then run ${C.b}node launch.js --reveal${C.off} again.\n`); process.exit(1); }
  console.log(`\n${C.b}Revealing the site${C.off} ${C.dim}(browsable, not purchasable)${C.off}\n`);

  if (has('index.html')) {
    fs.mkdirSync(BACKUP, { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(BACKUP, 'index.coming-soon.html'));
    ok('backed up coming-soon page -> _backup/index.coming-soon.html');
  }

  let h = rd('homepage-preview.html');
  h = h.replace(/<meta name="robots"[^>]*>(<!--[^>]*-->)?\n?/, '');
  h = h.replace(/(src|href)="(shirts\/)/g, '$1="/$2');
  const res = stripCommerceFromHomepage(h);
  wr('index.html', res.html);
  ok(`promoted homepage-preview.html -> index.html (${res.html.length.toLocaleString()} chars)`);
  res.notes.forEach(n => ok(`  ${n}`));

  // flip the build into revealed mode so every generated 'shop' link goes to a
  // browsable page instead of the cart page
  let b0 = rd('build.js').replace(/const REVEALED = false;/, 'const REVEALED = true;');
  wr('build.js', b0);
  ok('build.js: REVEALED = true  (shop links -> /t-shirts/, no cart anywhere)');

  // the hand-written pages are not generated, so fix them directly
  let fixed = 0;
  for (const f of ['commitment.html', 'policies.html']) {
    if (!has(f)) continue;
    let c = rd(f), before = c;
    c = c.replace(/href="\/?shop-preview\.html[^"]*"/g, 'href="/t-shirts/"');
    c = c.replace(/>Shop the collection/g, '>See the collection');
    if (c !== before) { wr(f, c); fixed++; }
  }
  if (fixed) ok(`repointed shop links in ${fixed} static page(s) -> /t-shirts/`);

  // policies must be public the moment the site is
  if (has('policies.html')) {
    let p = rd('policies.html');
    p = p.replace(/<!-- noindex while legal placeholders[\s\S]*?-->\n?/, '');
    p = p.replace(/<meta name="robots" content="noindex,follow">/, '<meta name="robots" content="index,follow">');
    wr('policies.html', p);
    ok('policies.html -> index,follow');
  }
  // the coming-soon page is now stale content on a live site
  if (has('coming-soon.html')) {
    let c = rd('coming-soon.html');
    if (!/name="robots"/.test(c)) {
      c = c.replace(/<head>/i, '<head>\n<meta name="robots" content="noindex,follow">');
      wr('coming-soon.html', c); ok('coming-soon.html -> noindex,follow');
    }
  }
  // retire the two pre-launch URLs. NOT shop-preview.html — /shop/ does not exist yet.
  if (has('vercel.json')) {
    try {
      const v = JSON.parse(rd('vercel.json'));
      v.redirects = v.redirects || [];
      let added = 0;
      for (const [source, destination] of [['/coming-soon.html', '/'], ['/homepage-preview.html', '/'], ['/shop-preview.html', '/t-shirts/']]) {
        if (!v.redirects.some(r => r.source === source)) { v.redirects.push({ source, destination, permanent: true }); added++; }
      }
      if (added) { wr('vercel.json', JSON.stringify(v, null, 2) + '\n'); ok(`vercel.json: ${added} pre-launch URL(s) now 301 to /`); }
    } catch (e) { bad(`vercel.json not updated (${e.message})`); }
  }

  console.log('');
  execFileSync(process.execPath, [path.join(ROOT, 'build.js')], { stdio: 'inherit' });
  console.log(`\n  ${C.ok}${C.b}Site is live.${C.off} Products are browsable; nothing is purchasable.`);
  console.log(`  ${C.dim}When Telr clears, run ${C.off}${C.b}node launch.js --go${C.dim} to turn on the shop and cart.${C.off}\n`);
}

function go() {
  const list = checks();
  if (!report(list)) { console.log(`\n  Fix the blockers, then run ${C.b}node launch.js --go${C.off} again.\n`); process.exit(1); }

  console.log(`\n${C.b}Launching${C.off}\n`);

  // 1. back up the coming-soon page
  if (has('index.html')) {
    fs.mkdirSync(BACKUP, { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(BACKUP, 'index.coming-soon.html'));
    ok('backed up coming-soon page -> _backup/index.coming-soon.html');
  }

  // 2. promote the real homepage
  const size = promoteHomepage();
  ok(`promoted homepage-preview.html -> index.html (${size.toLocaleString()} chars, noindex stripped)`);

  // 3. flip the build flag
  let b = rd('build.js');
  b = b.replace(/const LAUNCHED = false;/, 'const LAUNCHED = true;');
  b = b.replace(/const REVEALED = true;/, 'const REVEALED = false;');
  wr('build.js', b);
  ok('build.js: LAUNCHED = true  (generates /shop/, adds Shop to nav + sitemap)');

  // 4. policies back to indexable
  if (has('policies.html')) {
    let p = rd('policies.html');
    p = p.replace(/<!-- noindex while legal placeholders[\s\S]*?-->\n?/, '');
    p = p.replace(/<meta name="robots" content="noindex,follow">/, '<meta name="robots" content="index,follow">');
    wr('policies.html', p);
    ok('policies.html -> index,follow');
  }

  // 5. repoint shop links in the remaining hand-written pages.
  //    The generated pages get this from SHOP_URL at build time and the homepage
  //    is handled by promoteHomepage(), but these two are static files that would
  //    otherwise keep pointing at /shop-preview.html — which we noindex below.
  let repointed = 0;
  for (const f of ['commitment.html', 'policies.html', 'coming-soon.html']) {
    if (!has(f)) continue;
    let c = rd(f);
    const before = c;
    c = c.replace(/href="\/?shop-preview\.html/g, 'href="/shop/');
    if (c !== before) { wr(f, c); repointed++; }
  }
  if (repointed) ok(`repointed shop links in ${repointed} static page(s) -> /shop/`);

  // 6. the coming-soon page is now stale content on a live store. Keep the file
  //    (old emails and social posts link to it) but take it out of the index and
  //    point it at the homepage.
  if (has('coming-soon.html')) {
    let c = rd('coming-soon.html');
    if (!/name="robots"/.test(c)) {
      c = c.replace(/<head>/i, '<head>\n<meta name="robots" content="noindex,follow">');
      wr('coming-soon.html', c);
      ok('coming-soon.html -> noindex,follow (superseded by the live homepage)');
    }
  }

  // 7. retire the pre-launch URLs. These cannot live in vercel.json before launch
  //    (they would 404 anyone using the preview links while we are still building),
  //    so they are added here, at the cutover, and removed again on rollback.
  if (has('vercel.json')) {
    try {
      const v = JSON.parse(rd('vercel.json'));
      v.redirects = v.redirects || [];
      // if --reveal already pointed this at /t-shirts/, retarget it at the real shop
      v.redirects = v.redirects.filter(r => r.source !== '/shop-preview.html');
      const retire = [
        ['/shop-preview.html', '/shop/'],
        ['/homepage-preview.html', '/'],
        ['/coming-soon.html', '/'],
      ];
      let added = 0;
      for (const [source, destination] of retire) {
        if (!v.redirects.some(r => r.source === source)) {
          v.redirects.push({ source, destination, permanent: true });
          added++;
        }
      }
      if (added) {
        wr('vercel.json', JSON.stringify(v, null, 2) + '\n');
        ok(`vercel.json: ${added} pre-launch URL(s) now 301 to their live equivalent`);
      }
    } catch (e) {
      bad(`vercel.json could not be updated automatically (${e.message}) — add the 301s by hand`);
    }
  }

  // 8. rebuild
  console.log('');
  execFileSync(process.execPath, [path.join(ROOT, 'build.js')], { stdio: 'inherit' });

  console.log(`\n  ${C.ok}${C.b}Live.${C.off} Now: commit + push, then in Search Console request indexing for / and /shop/.\n`);
}

function rollback() {
  const bk = path.join(BACKUP, 'index.coming-soon.html');
  if (!fs.existsSync(bk)) { bad('no backup found at _backup/index.coming-soon.html'); process.exit(1); }
  fs.copyFileSync(bk, path.join(ROOT, 'index.html'));
  ok('restored coming-soon page');
  let b = rd('build.js').replace(/const LAUNCHED = true;/, 'const LAUNCHED = false;').replace(/const REVEALED = true;/, 'const REVEALED = false;');
  wr('build.js', b);
  ok('build.js: LAUNCHED = false');

  // undo the URL retirements — leaving them would 301 the preview pages to a
  // /shop/ that no longer exists, which is worse than the state we started in
  if (has('vercel.json')) {
    try {
      const v = JSON.parse(rd('vercel.json'));
      const retired = new Set(['/shop-preview.html', '/homepage-preview.html', '/coming-soon.html']);
      const before = (v.redirects || []).length;
      v.redirects = (v.redirects || []).filter(r => !retired.has(r.source));
      if (v.redirects.length !== before) {
        wr('vercel.json', JSON.stringify(v, null, 2) + '\n');
        ok(`vercel.json: removed ${before - v.redirects.length} pre-launch 301(s)`);
      }
    } catch (e) { bad(`vercel.json not reverted (${e.message}) — remove the 301s by hand`); }
  }

  // put the coming-soon page back in the index
  if (has('coming-soon.html')) {
    let c = rd('coming-soon.html').replace(/<meta name="robots" content="noindex,follow">\n?/, '');
    wr('coming-soon.html', c);
  }
  console.log('');
  execFileSync(process.execPath, [path.join(ROOT, 'build.js')], { stdio: 'inherit' });
  console.log(`\n  ${C.warn}Rolled back.${C.off} /shop/ is no longer generated. Commit + push.\n`);
}

/* ---------------- entry ---------------- */
const arg = process.argv[2] || '--check';
if (arg === '--go') go();
else if (arg === '--reveal') reveal();
else if (arg === '--rollback') rollback();
else {
  const passed = report(checks());
  console.log(`  ${C.dim}Dry run — nothing changed. Use --go to launch.${C.off}\n`);
  process.exit(passed ? 0 : 1);
}
