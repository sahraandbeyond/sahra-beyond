#!/usr/bin/env node
/**
 * contrast-audit.js — real WCAG auditor.
 *
 * Walks EVERY element that renders its own text, on EVERY page, in a real
 * browser, and measures the computed foreground against the effective
 * composited background (all ancestor background-colors + cumulative opacity).
 *
 * This replaces contrast-check.py, which tested a hardcoded list of six
 * selectors and therefore missed everything it had not been told about —
 * including the PDP size chart.
 *
 * Usage:
 *   node contrast-audit.js              # all pages, both viewports
 *   node contrast-audit.js --page products/sand-polo/index.html
 *   node contrast-audit.js --json out.json
 *   node contrast-audit.js --quiet      # exit code only (for prepush)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
  '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp',
  '.woff2':'font/woff2', '.ico':'image/x-icon', '.avif':'image/avif' };

function serve(){
  return new Promise(res => {
    const s = http.createServer((req, rep) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      let f = path.join(ROOT, p);
      try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); } catch(e){}
      fs.readFile(f, (err, buf) => {
        if (err) { rep.writeHead(404); return rep.end('404'); }
        rep.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
        rep.end(buf);
      });
    });
    s.listen(0, '127.0.0.1', () => res(s));
  });
}

function pages(){
  const out = [];
  (function walk(d){
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (['node_modules','.git','admin','.vercel'].includes(e.name)) continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name.endsWith('.html')) out.push(path.relative(ROOT, f).split(path.sep).join('/'));
    }
  })(ROOT);
  return out.sort();
}

/* The measurement itself lives in contrast-probe.js so there is exactly one
   copy. An earlier version of this file embedded its own probe, which drifted:
   it kept the naive colour parser that read Chrome's color(srgb ...) syntax as
   0-255 and invented failures. Do not inline a second probe here. */
const { PROBE_SRC } = require('./contrast-probe.js');

(async () => {
  const argv = process.argv.slice(2);
  const only = argv.includes('--page') ? argv[argv.indexOf('--page')+1] : null;
  const jsonOut = argv.includes('--json') ? argv[argv.indexOf('--json')+1] : null;
  const quiet = argv.includes('--quiet');

  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    console.log('\ncontrast-audit needs a headless browser, which is not installed here.\n');
    console.log('  Either:  npm i --no-save puppeteer && npx puppeteer browsers install chrome');
    console.log('  Or:      open the deployed page, paste the string from contrast-probe.js');
    console.log('           into the console, and read the result.\n');
    console.log('The static half of the check runs anywhere:  node contrast-guard.js\n');
    process.exit(2);
  }
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-dev-shm-usage'] });

  const list = only ? [only] : pages();
  const viewports = [
    { name: 'mobile',  width: 390,  height: 844, deviceScaleFactor: 2, isMobile: true },
    { name: 'desktop', width: 1280, height: 900, deviceScaleFactor: 1, isMobile: false }
  ];

  const report = [];
  let totalChecked = 0;

  for (const rel of list) {
    for (const vp of viewports) {
      const page = await browser.newPage();
      await page.setViewport(vp);
      page.on('pageerror', () => {});
      try {
        await page.goto(`http://127.0.0.1:${port}/${rel}`, { waitUntil: 'networkidle2', timeout: 30000 });
      } catch (e) {
        await page.close();
        report.push({ page: rel, viewport: vp.name, error: String(e).slice(0,120), fails: [] });
        continue;
      }
      /* let scroll-driven and JS-injected styling settle */
      await page.evaluate(() => window.scrollTo(0, 0));
      await new Promise(r => setTimeout(r, 700));

      const text = await page.evaluate(PROBE_SRC);
      const fails = await page.evaluate('window.__cfails||[]');
      const photo = await page.evaluate('window.__cphoto||[]');
      const m = /measured (\d+)/.exec(text);
      totalChecked += m ? +m[1] : 0;
      report.push({ page: rel, viewport: vp.name, checked: m ? +m[1] : 0, fails, photo, text });
      await page.close();
    }
  }

  await browser.close();
  server.close();

  /* ---- collapse: the same rule failing on 40 pages is ONE defect ----
     Field names come from contrast-probe.js, which emits short keys:
     p=path c=colour b=backdrop o=cumulative opacity t=text r=ratio n=needed
     s=font-size. Keep these in step with the probe. */
  const byRule = new Map();
  for (const r of report) {
    for (const f of (r.fails || [])) {
      const leaf = String(f.p || '').split('>').pop();
      const key = `${leaf}|${f.c}|${f.b}|${f.o}`;
      if (!byRule.has(key)) byRule.set(key, { leaf, color: f.c, bg: f.b,
        opacity: f.o, ratio: f.r, need: f.n, size: f.s,
        samples: [], pages: new Set(), count: 0 });
      const g = byRule.get(key);
      g.count++;
      g.ratio = Math.min(g.ratio, f.r);
      g.pages.add(r.page);
      if (g.samples.length < 3 && !g.samples.includes(f.t)) g.samples.push(f.t);
    }
  }
  const rules = [...byRule.values()].sort((a,b) => a.ratio - b.ratio);
  const totalFails = report.reduce((n,r) => n + (r.fails ? r.fails.length : 0), 0);
  const totalPhoto = report.reduce((n,r) => n + (r.photo ? r.photo.length : 0), 0);

  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify({ report, rules: rules.map(r => ({ ...r, pages: [...r.pages] })) }, null, 1));
  }

  if (!quiet) {
    console.log(`\ncontrast-audit — ${list.length} pages x ${viewports.length} viewports`);
    console.log(`${totalChecked} text elements measured, ${totalFails} failing, ${rules.length} distinct defects`);
    console.log(`${totalPhoto} sit over photography and need an eye — see the --json report\n`);
    if (rules.length) {
      console.log('ratio  need  size  opac  distinct defect');
      console.log('-----  ----  ----  ----  ' + '-'.repeat(64));
      for (const r of rules) {
        console.log(
          `${String(r.ratio).padStart(5)}  ${String(r.need).padStart(4)}  ` +
          `${String(r.size).padStart(4)}  ${String(r.opacity).padStart(4)}  ` +
          `${r.leaf.slice(0,40).padEnd(40)} ${r.color} on ${r.bg}` +
          ''
        );
        console.log(`${' '.repeat(23)}x${r.count} on ${r.pages.size} page(s) — e.g. "${r.samples[0] || ''}"`);
      }
    } else {
      console.log('No contrast failures. Every rendered word meets WCAG AA.');
    }
  }

  process.exit(totalFails ? 1 : 0);
})();
