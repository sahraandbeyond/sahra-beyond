#!/usr/bin/env python3
"""contrast-check.py — legibility guard for the translucent homepage panes.

Sections sit over one continuously changing sky, so a text colour that is
legible at night can fail at golden hour. Making .stats transparent once
dropped its labels to 1.10:1. This recomputes the worst case across the
whole sky journey. Run it after touching any pane opacity or text colour.
"""
def lum(c):
    def f(v):
        v/=255
        return v/12.92 if v<=0.03928 else ((v+0.055)/1.055)**2.4
    return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2])
def ratio(a,b):
    L1,L2=lum(a),lum(b); return (max(L1,L2)+.05)/(min(L1,L2)+.05)
def blend(fg,bg,a): return tuple(round(fg[i]*a+bg[i]*(1-a)) for i in range(3))

SKY=[(20,16,42),(58,41,90),(122,79,99),(192,112,46),(233,185,120)]
CASES=[
  ('.stats numbers', (0xF7,0xEF,0xE2), (20,16,42), .62, 3.0),
  ('.stats labels',  (0xEB,0xD3,0xAE), (20,16,42), .62, 4.5),
  ('.shop body ink', (51,39,27),  (250,246,239), .955, 4.5),
  ('.shop muted',    (156,82,27), (250,246,239), .955, 4.5),
  ('.places text',   (255,255,255), (36,27,18),  .86,  4.5),
  ('.mission text',  (255,255,255), (44,54,38),  .90,  4.5),
]
fail=0
for name,text,pane,op,need in CASES:
    worst=min(ratio(text, blend(pane,s,op)) for s in SKY)
    ok = worst>=need
    if not ok: fail+=1
    print('  %-16s worst %6.2f:1  needs %.1f  %s'%(name,worst,need,'OK' if ok else '*** FAIL ***'))
print('\n  failures:',fail)
raise SystemExit(1 if fail else 0)
