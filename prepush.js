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

// ---- 3. what actually changed recently (the safe push manifest) ----
const HOURS = Number(process.argv[2] || 24);
const cutoff = Date.now() - HOURS * 3600e3;
const changed = files.filter(f => fs.statSync(f).mtimeMs > cutoff).map(f => path.relative(ROOT, f)).sort();
console.log(`  ${C.b}Files changed in the last ${HOURS}h — push exactly these:${C.off}\n`);
changed.forEach(f => console.log(`     ${f}`));
console.log(`\n  ${changed.length} file(s).\n`);

process.exit(ghostDirs.size ? 1 : 0);
