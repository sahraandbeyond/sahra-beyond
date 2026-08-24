#!/usr/bin/env node
/**
 * contrast-guard.js — static legibility guard. Runs anywhere, no browser.
 *
 * The full auditor (contrast-audit.js / contrast-probe.js) needs a real browser
 * because contrast depends on the composited result of the whole ancestor
 * chain. This guard is the cheap half: it catches the two authoring mistakes
 * that produced every legibility bug on this site, by reading the built HTML.
 *
 *   1. Muting text with `opacity`. Opacity multiplies down the tree, so a .6
 *      label inside a .8 card renders at .48. Even at .85 on cream, the muted
 *      ink measures 3.82:1 and fails. Mute with an explicit colour instead.
 *
 *   2. Reintroducing a retired colour. Each hex below was measured failing
 *      against the surface it is used on; the replacement was measured passing.
 *
 * Wired into prepush.js so it cannot ship.
 */
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

/* Retired colours -> what replaced them, with the measured ratio that
   justified the change. Keyed on the exact literal so a background that
   legitimately still needs the old tone can be excluded by context below. */
const RETIRED = {
  '#7C7365': ['#6B6256', 'muted ink on cream measured 4.33:1'],
  '#7C7264': ['#6B6256', 'muted ink on cream measured 4.33:1'],
  '#8A8073': ['#6B6256', 'muted ink on cream measured 3.60:1'],
};

/* Selectors whose text must never be muted with opacity, and the floor we
   allow elsewhere. Anything below OPACITY_FLOOR on a text rule is flagged. */
const OPACITY_FLOOR = 0.92;

/* Decorative layers are allowed to be faint - they carry no words. */
const DECORATIVE = /\b(glare|grain|stars?|dust|scrim|veil|halo|glow|shade|shadow|vignette|melt|sheen|noise|orb|blob|ring|line|rule|divider|spark|trail|beam)\b/i;

function pages() {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      /* _backup holds retired pages that are never deployed. */
      if (['node_modules', '.git', 'admin', '.vercel', '_backup'].includes(e.name)) continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (/\.(html|css)$/.test(e.name)) out.push(f);
    }
  })(ROOT);
  return out;
}

const problems = [];

/* ---- the dark-theme invariant ----
   A page that switches to light text when its scroll journey goes dark MUST
   also repaint the reading column, or the light text lands on whatever opaque
   pane is sitting above the body. That is precisely what shipped: the journey
   drove body to #181109, body.dark-bg set --txt:#F4EFE6, and sahra-sky.css
   kept main at rgba(250,246,239,.972) — so two thirds of every product page
   rendered at 1.01:1. Background and text colour must move together. */
function darkThemeInvariant(rel, src) {
  const togglesDark = src.includes("classList.toggle('dark-bg'");
  if (!togglesDark) return;
  const paintsPane = /pane\s*\.\s*style\s*\.\s*backgroundColor/.test(src);
  const hasOpaquePane = src.includes('sahra-sky.css');
  if (hasOpaquePane && !paintsPane) {
    problems.push({ file: rel, severity: 'block',
      msg: 'toggles body.dark-bg (light text) and loads sahra-sky.css (opaque cream ' +
           'pane over the body) but never repaints the pane — light text on a light ' +
           'pane, measured 1.01:1' });
  }
}

/* ---- interactive controls need a VISIBLE boundary ----
   Text contrast was never the problem with the shop filters: unselected chip
   text measured 14.8:1 and selected 7.9:1. The chips were bordered with
   var(--line) — rgba(42,32,22,.12), which is 1.26:1. Fine for a decorative
   hairline, invisible as the edge of a button, so nobody could tell what was
   a control or which one was active. Boundaries of interactive components need
   3:1, which is what --edge exists for. Keep the two tokens distinct. */
const DECORATIVE_LINE = /border(?:-[a-z]+)?\s*:\s*[^;}]*var\(--line\)/;
const INTERACTIVE = /cursor\s*:\s*pointer/;
function controlBoundary(rel, src) {
  const ruleRe = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = ruleRe.exec(src))) {
    const sel = m[1].split('\n').pop().trim();
    const body = m[2];
    if (!DECORATIVE_LINE.test(body)) continue;
    /* only flag things a user is meant to click */
    const looksInteractive = INTERACTIVE.test(body) ||
      /^(button\b|\.btn\b|\.filt\b|\.chip\b|\.sz-chip\b|\.size-tab\b|\.pthumb\b|\.opt\b|\.ambient-btn\b|\.gal-thumbs\s+button\b)/.test(sel);
    if (!looksInteractive) continue;
    problems.push({ file: rel, severity: 'block',
      msg: `${sel} is interactive but bordered with var(--line) (1.26:1). ` +
           `Use var(--edge) — a control boundary needs 3:1.` });
  }
}

for (const file of pages()) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const src = fs.readFileSync(file, 'utf8');

  darkThemeInvariant(rel, src);
  controlBoundary(rel, src);

  for (const [hex, [repl, why]] of Object.entries(RETIRED)) {
    /* Match the colour wherever it is DECLARED as a text colour: `color:#X`
       and custom properties like `--mist:#X`. A first version only checked
       `color:` and happily passed a regression that reverted the token — the
       whole point of the token is that it feeds hundreds of `color:` uses. */
    const re = new RegExp('(?:^|[;{\\s"\'])(color|--[a-z0-9-]+)\\s*:\\s*' + hex + '\\b', 'gi');
    const hits = (src.match(re) || []).length;
    if (hits) problems.push({ file: rel, severity: 'block',
      msg: `${hits}x ${hex} declared as a text colour — ${why}; use ${repl}` });
  }

  /* find CSS rules that set a low opacity and also look like text rules */
  const ruleRe = /([^{}]+)\{([^}]*opacity\s*:\s*(?:0?\.\d+)[^}]*)\}/g;
  let m;
  while ((m = ruleRe.exec(src))) {
    const sel = m[1].split('\n').pop().trim();
    const body = m[2];
    const op = parseFloat(/opacity\s*:\s*(0?\.\d+)/.exec(body)[1]);
    if (op >= OPACITY_FLOOR) continue;
    if (DECORATIVE.test(sel)) continue;
    if (/:hover|:focus|:active|:disabled|\[disabled\]|\.out\b|::before|::after/.test(sel)) continue;
    if (/^@|^from\b|^to\b|^\d+%/.test(sel)) continue;
    /* only care if the rule plausibly renders words */
    if (!/font-|letter-spacing|text-transform|line-height|color\s*:/.test(body)) continue;
    /* Below .75 the text fails on every light surface this site uses, whatever
       colour it started as. Above that it depends on the backdrop. */
    problems.push({ file: rel, severity: op < 0.75 ? 'block' : 'warn',
      msg: `${sel} {opacity:${op}} — mute text with a colour, not opacity` });
  }
}

/* Two tiers. Blocking issues are the ones that measured as real failures on
   the live site; advisories are authoring smells that may or may not fail
   depending on what they sit on. Blocking everything would gate every push on
   white-on-black text at .8 opacity, which passes comfortably. */
const blocking = problems.filter(p => p.severity === 'block');
const advisory = problems.filter(p => p.severity === 'warn');

const dedupe = list => {
  const seen = new Set(), out = [];
  for (const p of list) {
    const key = p.msg.replace(/^\d+x /, '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
};

if (advisory.length) {
  const a = dedupe(advisory);
  console.log(`\ncontrast-guard: ${a.length} advisory (text muted with opacity)`);
  a.slice(0, 12).forEach(p => console.log('  ~ ' + p.file + ': ' + p.msg));
  if (a.length > 12) console.log(`  ~ ... and ${a.length - 12} more`);
}

if (blocking.length) {
  const b = dedupe(blocking);
  console.log(`\ncontrast-guard: ${b.length} BLOCKING legibility defect(s)\n`);
  b.forEach(p => console.log('  ! ' + p.file + ': ' + p.msg));
  console.log('\nThese measured below WCAG AA on the live site. Fix, rebuild, then');
  console.log('re-measure with contrast-probe.js before shipping.\n');
  process.exit(1);
}

console.log(`contrast-guard: no retired colours, no severely muted text` +
            (advisory.length ? ` (${advisory.length} advisory above)` : '') + '.');
