#!/usr/bin/env node
/**
 * prep-video.js — turn a raw export into the web-ready hero band assets.
 *
 *   node prep-video.js "path/to/cut.mov"
 *   node prep-video.js "path/to/cut.mov" --start 7.5 --end 15.3 --y 560
 *
 * Options
 *   --start / --end   trim, in seconds. Default: whole file.
 *   --y               top edge of the crop band in SOURCE pixels.
 *                     Default: centred. See "Why the crop is biased up".
 *   --ratio           output aspect. Default 2.39 (cinemascope).
 *   --no-crop         keep the source framing untouched.
 *
 * Writes video/brand.mp4 and video/brand-poster.jpg.
 *
 * Why the audio goes
 *   The band is muted and looping, so the track is never heard. On the first
 *   clip it was 58% of the file. Removing it also removes any chance a browser
 *   declines to autoplay because an audio track exists.
 *
 * Why the crop is biased up
 *   Landscape footage shot portrait puts the payoff — sky, horizon, a standing
 *   figure — above the vertical centre. A geometric centre crop of the Sahra ad
 *   cut the subject's head off at 8s and removed the sunrise and the Milky Way
 *   entirely at 11s and 14s. Frames were compared before choosing; do the same
 *   before trusting a default on a new cut.
 *
 * Why not upscale
 *   A 1080-wide crop stretched across a 1920px viewport is a 1.78x upscale and
 *   looks soft. The band is capped near the native width instead, so it renders
 *   close to 1:1 and stays sharp.
 *
 * Requires ffmpeg on PATH.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT_DIR = path.join(ROOT, 'video');
const OUT_MP4 = path.join(OUT_DIR, 'brand.mp4');
const OUT_POSTER = path.join(OUT_DIR, 'brand-poster.jpg');

const argv = process.argv.slice(2);
const src = argv[0];
const opt = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const flag = name => argv.includes('--' + name);

if (!src || src.startsWith('--')) {
  console.log('\n  node prep-video.js "path/to/cut.mov" [--start 7.5 --end 15.3 --y 560]\n');
  process.exit(2);
}
if (!fs.existsSync(src)) { console.log(`\n  ✗ not found: ${src}\n`); process.exit(1); }

try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); }
catch (e) { console.log('\n  ✗ ffmpeg is not on PATH.\n'); process.exit(1); }

function probe(file) {
  const out = execFileSync('ffprobe', ['-v', 'error',
    '-show_entries', 'format=duration',
    '-show_entries', 'stream=codec_type,width,height',
    '-of', 'default=noprint_wrappers=1', file], { encoding: 'utf8' });
  const g = k => (new RegExp(k + '=(.+)').exec(out) || [])[1];
  return {
    duration: parseFloat(g('duration')) || 0,
    width: parseInt(g('width')) || 0,
    height: parseInt(g('height')) || 0,
    hasAudio: /codec_type=audio/.test(out)
  };
}

const info = probe(src);
const start = parseFloat(opt('start', '0'));
const end = parseFloat(opt('end', String(info.duration)));
const dur = Math.max(0.5, end - start);
const ratio = parseFloat(opt('ratio', '2.39'));

let vf = [];
let outW = info.width, outH = info.height;
if (!flag('no-crop')) {
  outW = info.width;
  outH = Math.round(info.width / ratio / 2) * 2;        /* even height for h264 */
  const maxY = Math.max(0, info.height - outH);
  const yDefault = Math.round((info.height - outH) / 2);
  let y = Math.round(parseFloat(opt('y', String(yDefault))));
  if (y < 0) y = 0;
  if (y > maxY) { console.log(`  ! --y ${y} exceeds the frame; clamped to ${maxY}`); y = maxY; }
  vf.push(`crop=${outW}:${outH}:0:${y}`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

/* poster: a frame a little into the trimmed range, past any fade-in */
const posterAt = start + Math.min(1.5, dur / 4);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(posterAt), '-i', src,
  '-frames:v', '1', ...(vf.length ? ['-vf', vf.join(',')] : []), '-q:v', '3', OUT_POSTER]);

/* Re-encode rather than stream-copy: the crop and trim both need it, and the
   source here is a 23 Mbps master, which is absurd for a looping web banner.
   CRF 23 with a slow preset holds up well at this size. */
execFileSync('ffmpeg', ['-y', '-v', 'error',
  '-ss', String(start), '-t', String(dur), '-i', src,
  ...(vf.length ? ['-vf', vf.join(',')] : []),
  '-an',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '23',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  OUT_MP4]);

const outInfo = probe(OUT_MP4);
const before = fs.statSync(src).size;
const after = fs.statSync(OUT_MP4).size;
const poster = fs.statSync(OUT_POSTER).size;
const mb = n => (n / 1048576).toFixed(2) + ' MB';
const kb = n => (n / 1024).toFixed(0) + ' KB';

console.log(`\nprep-video`);
console.log(`  source                  ${info.width}x${info.height}, ${info.duration.toFixed(1)}s${info.hasAudio ? ', audio stripped' : ''}`);
if (start || end < info.duration) console.log(`  trimmed to              ${start}s - ${end}s (${dur.toFixed(1)}s loop)`);
console.log(`  video/brand.mp4         ${outInfo.width}x${outInfo.height}, ${kb(after)}  (source ${mb(before)})`);
console.log(`  video/brand-poster.jpg  ${kb(poster)}`);

const warn = [];
if (dur > 15) warn.push(`${dur.toFixed(0)}s is long for a loop; 8-12s is the usual range.`);
if (after > 4 * 1048576) warn.push(`${mb(after)} is heavy for a homepage on mobile data.`);
if (outInfo.width < 1000) warn.push(`${outInfo.width}px wide will look soft on a desktop banner.`);
if (warn.length) { console.log(''); warn.forEach(w => console.log(`  ! ${w}`)); }

console.log(`\n  Now run: node build.js\n`);
