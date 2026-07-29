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
     node launch.js --go         Perform the cutover, then rebuild.
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

  // 3b. Size measurements confirmed against real samples — fatal, it drives returns.
  let unconf = [];
  try{
    const pdir2 = path.join(ROOT,'content/products');
    if (fs.existsSync(pdir2)) fs.readdirSync(pdir2).filter(f=>f.endsWith('.json')).forEach(f=>{
      const d = JSON.parse(fs.readFileSync(path.join(pdir2,f),'utf8'));
      if (d.sizesConfirmed === false) unconf.push(d.id||f);
    });
  }catch(e){}
  push(true, unconf.length === 0, 'size measurements confirmed against samples',
    unconf.length ? `still provisional: ${unconf.join(', ')} — set sizesConfirmed:true once measured` : '');

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

  // 5. rebuild
  console.log('');
  execFileSync(process.execPath, [path.join(ROOT, 'build.js')], { stdio: 'inherit' });

  console.log(`\n  ${C.ok}${C.b}Live.${C.off} Now: commit + push, then in Search Console request indexing for / and /shop/.\n`);
}

function rollback() {
  const bk = path.join(BACKUP, 'index.coming-soon.html');
  if (!fs.existsSync(bk)) { bad('no backup found at _backup/index.coming-soon.html'); process.exit(1); }
  fs.copyFileSync(bk, path.join(ROOT, 'index.html'));
  ok('restored coming-soon page');
  let b = rd('build.js').replace(/const LAUNCHED = true;/, 'const LAUNCHED = false;');
  wr('build.js', b);
  ok('build.js: LAUNCHED = false');
  console.log('');
  execFileSync(process.execPath, [path.join(ROOT, 'build.js')], { stdio: 'inherit' });
  console.log(`\n  ${C.warn}Rolled back.${C.off} /shop/ is no longer generated. Commit + push.\n`);
}

/* ---------------- entry ---------------- */
const arg = process.argv[2] || '--check';
if (arg === '--go') go();
else if (arg === '--rollback') rollback();
else {
  const passed = report(checks());
  console.log(`  ${C.dim}Dry run — nothing changed. Use --go to launch.${C.off}\n`);
  process.exit(passed ? 0 : 1);
}
