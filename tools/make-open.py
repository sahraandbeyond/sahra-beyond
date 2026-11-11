#!/usr/bin/env python3
"""House opener images (Stage 3, 10 Nov 2026). Reads content/openers.json and writes, per page slug,
assets/open/<key>-m-780.webp (the phone crop, 5:6) and assets/open/<key>-720.webp / -1076.webp (4:5).
Run from the repo root:  python3 tools/make-open.py [slug ...]"""
import json, os, sys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = json.load(open(os.path.join(ROOT, 'content', 'openers.json'), encoding='utf8'))
only = set(sys.argv[1:])
def crop(im, ratio, y):
    w, h = im.size
    ch = min(h, int(round(w * ratio)))
    y0 = int(round((h - ch) * y))
    return im.crop((0, y0, w, y0 + ch))
for slug, o in C.items():
    if slug.startswith('_') or (only and slug not in only): continue
    key = slug.replace('/', '-')
    im = Image.open(os.path.join(ROOT, o['src'])).convert('RGB')
    m = crop(im, 1.2, o.get('my', 0.3)); m = m.resize((780, int(round(780 * m.size[1] / m.size[0]))), Image.LANCZOS)
    m.save(os.path.join(ROOT, 'assets', 'open', key + '-m-780.webp'), quality=80, method=6)
    d = crop(im, 1.25, o.get('dy', 0.3))
    for w in (720, 1076):
        ww = min(w, d.size[0]); x = d.resize((ww, int(round(ww * d.size[1] / d.size[0]))), Image.LANCZOS)
        x.save(os.path.join(ROOT, 'assets', 'open', '%s-%d.webp' % (key, w)), quality=80, method=6)
    print(key, im.size, '->', m.size, d.size)
