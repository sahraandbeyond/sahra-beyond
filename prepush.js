#!/usr/bin/env node
/* ==========================================================================
   prepush.js — integrity check before you push.
   ==========================================================================
   WHY THIS EXISTS
   Twice now, pushing "full folders" has broken live content. The cause is not
   bad edits — it is that this working copy is INCOMPLETE. Images uploaded
   through the Decap CMS are committed straight to GitHub and never land here,
   so a mirror-style push deletes them from the server.

   This refuses to bless a push when a referenced asset is missing locally.

   USAGE:  node prepush.js
   ========================================================================== */
const fs = require('fs'), path = require('path');
const ROOT = __dirname;
const C = { ok:'\x1b[32m', bad:'\x1b[31m', warn:'\x1b[33m', dim:'\x1b[2m', off:'\x1b[0m', b:'\x1b[1m' };

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '_backup', '.git'].includes(e.name)) continue;
    const p = path.join(d, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}
const files = walk(ROOT);
const html = files.filter(f => f.endsWith('.html'));

// ---- 1. every referenced local asset must exist here ----
const missing = new Map();
const EXT = /\.(jpg|jpeg|png|webp|svg|gif|ico)$/i;
html.forEach(f => {
  const s = fs.readFileSync(f, 'utf8');
  const rel = path.relative(ROOT, f);
  const refs = [...s.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1])
    .filter(u => EXT.test(u) && !/^https?:|^\/\//.test(u));
  refs.forEach(u => {
    const clean = u.split(/[?#]/)[0];
    const abs = clean.startsWith('/') ? path.join(ROOT, clean) : path.resolve(path.dirname(f), clean);
    if (!fs.existsSync(abs)) {
      if (!missing.has(clean)) missing.set(clean, []);
      missing.get(clean).push(rel);
    }
  });
});

// ---- 2. folders referenced by content but absent from this working copy ----
const ghostDirs = new Set();
[...missing.keys()].forEach(u => {
  const top = u.replace(/^\//, '').split('/')[0];
  if (!fs.existsSync(path.join(ROOT, top))) ghostDirs.add(top);
});

console.log(`\n${C.b}Pre-push integrity check${C.off}\n`);
if (!missing.size) {
  console.log(`  ${C.ok}✓${C.off} all referenced assets present locally`);
} else {
  console.log(`  ${C.bad}✗ ${missing.size} referenced asset(s) missing from this working copy${C.off}`);
  [...missing.entries()].slice(0, 15).forEach(([u, pages]) =>
    console.log(`     ${u} ${C.dim}(${pages.length} page(s))${C.off}`));
}
if (ghostDirs.size) {
  console.log(`\n  ${C.bad}${C.b}DANGER — these folders exist on the server but NOT here:${C.off}`);
  ghostDirs.forEach(d => console.log(`     ${C.bad}/${d}/${C.off}`));
  console.log(`\n  ${C.warn}A mirror/replace push WILL DELETE them from the live site.${C.off}`);
  console.log(`  Either:  (a) push only the changed files listed below, or`);
  console.log(`           (b) download /${[...ghostDirs][0]}/ from GitHub into this folder first.\n`);
}

// ---- 2b. DELETIONS don't propagate when you upload files ----
// Uploading a folder adds and overwrites; it never removes. A content file you
// deleted locally still sits in the repo, and the Vercel build regenerates the
// page from it. This is how a renamed product came back from the dead.
const prodDir = path.join(ROOT, 'content/products');
const localIds = fs.existsSync(prodDir)
  ? fs.readdirSync(prodDir).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')).sort() : [];
const builtDirs = fs.existsSync(path.join(ROOT, 'products'))
  ? fs.readdirSync(path.join(ROOT, 'products'), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort() : [];
const orphans = builtDirs.filter(d => !localIds.includes(d));
console.log(`\n  ${C.b}Products defined here:${C.off} ${localIds.join(', ') || '(none)'}`);
if (orphans.length) {
  console.log(`  ${C.bad}✗ stale build output with no source JSON: ${orphans.join(', ')}${C.off}`);
  console.log(`    delete products/<id>/ locally, then delete it on GitHub too.`);
} else {
  console.log(`  ${C.ok}✓${C.off} no stale product folders locally`);
}
console.log(`  ${C.warn}!${C.off} ${C.dim}Uploading files never deletes. After a rename, check the live sitemap`);
console.log(`    ${C.dim}for product URLs not in the list above and remove them on GitHub by hand.${C.off}`);

// ---- 2b-ii. the same trap, for journal articles ----
// Setting draft:true on an article removes it from the build and the sitemap,
// but the already-generated journal/<slug>/index.html stays on disk — and once
// pushed, stays live. The result is an unlisted page with no inbound links,
// which is the exact orphan the journal hub exists to prevent. Caught by
// smoke-testing the draft flag rather than assuming it cleaned up after itself.
const jDir = path.join(ROOT, 'content', 'journal');
const liveSlugs = fs.existsSync(jDir)
  ? fs.readdirSync(jDir).filter(f => f.endsWith('.json')).map(f => {
      try { const a = JSON.parse(fs.readFileSync(path.join(jDir, f), 'utf8')); return a.draft === true ? null : a.slug; }
      catch (e) { return null; }
    }).filter(Boolean).sort()
  : [];
const jBuilt = fs.existsSync(path.join(ROOT, 'journal'))
  ? fs.readdirSync(path.join(ROOT, 'journal'), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort() : [];
const jOrphans = jBuilt.filter(d => !liveSlugs.includes(d));
let journalOk = true;
if (jOrphans.length) {
  journalOk = false;
  console.log(`  ${C.bad}✗ journal pages with no published source: ${jOrphans.join(', ')}${C.off}`);
  console.log(`    an article set back to draft leaves its folder behind and it stays live,`);
  console.log(`    unlisted and unlinked. delete journal/<slug>/ locally and on GitHub.`);
} else {
  console.log(`  ${C.ok}✓${C.off} no orphaned journal pages (${liveSlugs.length} published)`);
}

// ---- 2c. cross-faded image stacks must be absolutely positioned ----
// A real customer reported the PDP gallery going blank on views 2 and 3. The
// files all existed and the JS was right; the images simply had no
// position:absolute, so they sat in normal flow — view 1 filled the box and
// views 2 and 3 were pushed below it and clipped by overflow:hidden. Toggling
// the .on class then faded view 1 out and lit an off-screen image. A static
// href/src audit cannot see this, so assert the CSS contract instead: if a
// container cross-fades children via an .on class, those children must be
// absolutely positioned.
const stackIssues = [];
for (const f of html) {
  const src = fs.readFileSync(f, 'utf8');
  const css = (src.match(/<style[\s\S]*?<\/style>/gi) || []).join('\n');
  // find "SEL img{...opacity:0...}" that also has a matching "SEL img.on{...opacity:1...}"
  const re = /([.#][\w-]+)\s+img\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const sel = m[1], body = m[2];
    if (!/opacity\s*:\s*0/.test(body)) continue;
    const hasOn = new RegExp(sel.replace(/[.#]/, '\\$&') + '\\s+img\\.on\\{[^}]*opacity\\s*:\\s*1').test(css);
    if (!hasOn) continue;
    if (!/position\s*:\s*(absolute|fixed)/.test(body)) {
      stackIssues.push(`${path.relative(ROOT, f)}  ${sel} img — cross-faded but not positioned`);
    }
  }
}
if (stackIssues.length) {
  console.log(`\n  ${C.bad}✗ cross-faded image stacks that will render blank:${C.off}`);
  [...new Set(stackIssues)].forEach(i => console.log(`     ${C.bad}${i}${C.off}`));
} else {
  console.log(`  ${C.ok}✓${C.off} cross-faded image stacks are absolutely positioned`);
}

// ---- 2d. shared assets must be cache-busted with their content hash ----
// The cart-drawer and legibility fixes shipped correctly but nobody received
// them: /assets/*.css never changes name, so browsers kept serving the previous
// version for a day. A fix that cannot reach the user is not a fix. Every
// reference must carry ?v=<hash of that file's current contents>.
const crypto = require('crypto');
const assetVer = {};
for (const a of ['sahra-sky.css', 'sahra-cart.css', 'sahra-sky.js', 'sahra-cart.js']) {
  const p = path.join(ROOT, 'assets', a);
  if (fs.existsSync(p)) assetVer[a] = crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0, 8);
}
const staleRefs = [];
for (const f of html) {
  const src = fs.readFileSync(f, 'utf8');
  for (const [name, h] of Object.entries(assetVer)) {
    const re = new RegExp('/assets/' + name.replace('.', '\\.') + '(\\?v=([0-9a-f]+))?', 'g');
    let m;
    while ((m = re.exec(src))) {
      if (m[2] !== h) staleRefs.push(`${path.relative(ROOT, f)}  ${name} -> ${m[2] || 'no ?v='} (should be ${h})`);
    }
  }
}
if (staleRefs.length) {
  console.log(`\n  ${C.bad}✗ stale asset references — users will keep the cached old file:${C.off}`);
  [...new Set(staleRefs)].slice(0, 8).forEach(i => console.log(`     ${C.bad}${i}${C.off}`));
  console.log(`    ${C.dim}re-run the build so every ?v= matches the file's content hash.${C.off}`);
} else {
  console.log(`  ${C.ok}✓${C.off} shared assets cache-busted with current content hashes`);
}

// ---- 2b. legibility ----
// Faheem reported the same illegible-text bug four separate times, most
// recently the PDP size chart. The old contrast-check.py tested six hardcoded
// selectors and so never saw any of them. This runs the static half of the
// real check on every built page; the full measurement lives in
// contrast-probe.js and runs against the deployed site.
let contrastOk = true;
try {
  const out = require('child_process')
    .execSync('node contrast-guard.js', { cwd: ROOT, encoding: 'utf8' });
  const adv = /(\d+) advisory/.exec(out);
  console.log(`  ${C.ok}✓${C.off} legibility: no retired colours, no severely muted text` +
              (adv ? ` ${C.dim}(${adv[1]} advisory)${C.off}` : ''));
} catch (e) {
  contrastOk = false;
  console.log(`\n  ${C.bad}✗ legibility defects — text below WCAG AA will ship:${C.off}`);
  String(e.stdout || '').split('\n').filter(l => l.trim().startsWith('!'))
    .slice(0, 8).forEach(l => console.log(`     ${C.bad}${l.trim()}${C.off}`));
  console.log(`    ${C.dim}run: node contrast-guard.js${C.off}`);
}

// ---- 2e. ONE cart engine, and it must still work ------------------------
// The checkout shipped three independent cart implementations: the shared
// module, an inline one on /shop/ with its own drawer and badge, and a
// fallback on every product page. All three wrote the same `sb_cart` key with
// separate in-memory state, so the badge and the drawer routinely disagreed —
// customers saw items in the badge and an empty cart. Only assets/sahra-cart.js
// may touch a Shopify cart mutation.
// Built from parts so this checker does not match its own source.
const CART_MUTATION = new RegExp('cart' + ['Create', 'LinesAdd', 'LinesUpdate', 'LinesRemove'].join('|cart'));
const CART_TOOLING = ['prepush.js', 'cart-test.js'];   // allowed to name the mutations
const cartOwners = files.filter(f => /\.(html|js)$/.test(f))
  .filter(f => !/[\\/](_backup|node_modules)[\\/]/.test(f))
  .filter(f => CART_MUTATION.test(fs.readFileSync(f, 'utf8')))
  .map(f => path.relative(ROOT, f).split(path.sep).join('/'))
  .filter(f => !CART_TOOLING.includes(f));
let cartOk = true;
if (cartOwners.length === 1 && cartOwners[0] === 'assets/sahra-cart.js') {
  console.log(`  ${C.ok}✓${C.off} one cart engine (assets/sahra-cart.js)`);
} else {
  cartOk = false;
  console.log(`\n  ${C.bad}✗ ${cartOwners.length} file(s) contain cart mutations — there must be exactly one:${C.off}`);
  cartOwners.forEach(f => console.log(`     ${C.bad}${f}${C.off}`));
  console.log(`    ${C.dim}a second cart engine is what made the badge and drawer disagree.${C.off}`);
}

let cartTestOk = true;
try {
  const out = require('child_process').execSync('node cart-test.js', { cwd: ROOT, encoding: 'utf8' });
  const m = /(\d+) passed, (\d+) failed/.exec(out);
  console.log(`  ${C.ok}✓${C.off} cart behaviour: ${m ? m[1] : '?'} test(s) passed`);
} catch (e) {
  cartTestOk = false;
  console.log(`\n  ${C.bad}✗ cart regression tests FAILED — do not push:${C.off}`);
  String(e.stdout || '').split('\n').filter(l => l.includes('✗')).slice(0, 8)
    .forEach(l => console.log(`     ${C.bad}${l.trim()}${C.off}`));
  console.log(`    ${C.dim}run: node cart-test.js${C.off}`);
}

// ---- 2f. market/currency behaviour ------------------------------------
// The market layer decides what every visitor is told about delivery and
// what number sits next to each product. Its gate — never paint a currency
// Shopify did not honour — is exactly the kind of contract a refactor breaks
// silently, so it is exercised on every push like the cart is.
let marketTestOk = true;
try {
  const out = require('child_process').execSync('node market-test.js', { cwd: __dirname, encoding: 'utf8' });
  const m = out.match(/(\d+) passed, (\d+) failed/);
  if (!m || m[2] !== '0') throw Object.assign(new Error('fail'), { stdout: out });
  console.log(`  ${C.ok}✓${C.off} market behaviour: ${m ? m[1] : '?'} test(s) passed`);
} catch (e) {
  marketTestOk = false;
  console.log(`\n  ${C.bad}✗ market regression tests FAILED — do not push:${C.off}`);
  String(e.stdout || '').split('\n').filter(l => l.includes('✗')).slice(0, 8)
    .forEach(l => console.log(`     ${C.bad}${l.trim()}${C.off}`));
  console.log(`    ${C.dim}run: node market-test.js${C.off}`);
}

// ---- 3. what will actually be committed --------------------------------
// This used to list files by MTIME, which was actively misleading: `node
// build.js` rewrites ~124 files with byte-identical content, so every build
// bumped their timestamps and this reported "76 files to push" when git had
// only 7 real changes. Ask git, which is the thing that decides what ships.
// Fall back to mtime only when git is unavailable, and say so plainly.
const { execFileSync } = require('child_process');
let usedGit = false, changed = [];

try {
  const out = execFileSync('git', ['status', '--porcelain'],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  changed = out.split('\n').filter(Boolean).map(l => ({
    status: l.slice(0, 2).trim(),
    file: l.slice(3).replace(/^"|"$/g, '')
  }));
  usedGit = true;
} catch (e) {
  const HOURS = Number(process.argv[2] || 24);
  const cutoff = Date.now() - HOURS * 3600e3;
  changed = files.filter(f => fs.statSync(f).mtimeMs > cutoff)
    .map(f => ({ status: '?', file: path.relative(ROOT, f) })).sort();
}

if (usedGit) {
  const label = { M: 'modified', A: 'added', D: 'deleted', R: 'renamed', '??': 'new' };
  console.log(`  ${C.b}Git will commit these ${changed.length} file(s):${C.off}\n`);
  changed.forEach(c => console.log(`     ${C.dim}${(label[c.status] || c.status).padEnd(8)}${C.off} ${c.file}`));
  if (!changed.length) console.log(`     ${C.dim}(nothing to commit - working tree is clean)${C.off}`);
  const noise = changed.filter(c => /^\.idea\//.test(c.file));
  if (noise.length) {
    console.log(`\n  ${C.dim}${noise.length} of these are .idea/ IDE config. Add a .gitignore if you`);
    console.log(`  do not want editor settings in the repo.${C.off}`);
  }
} else {
  console.log(`  ${C.bad}git unavailable - falling back to modification times.${C.off}`);
  console.log(`  ${C.dim}This OVER-reports: the build rewrites many files unchanged.${C.off}\n`);
  changed.forEach(c => console.log(`     ${c.file}`));
}
console.log(`\n  ${changed.length} file(s).\n`);

process.exit((ghostDirs.size || stackIssues.length || staleRefs.length || !contrastOk || !cartOk || !cartTestOk || !journalOk || !marketTestOk) ? 1 : 0);
