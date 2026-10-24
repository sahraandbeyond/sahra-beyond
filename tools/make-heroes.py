# Resize the hero photographs listed in heroes.js into assets/heroes/ (1920 and 960 wide, webp).
import json, subprocess, os, sys
from PIL import Image
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
hero = json.loads(subprocess.check_output(['node', '-e', "console.log(JSON.stringify(require('./heroes.js').HERO))"], cwd=root))
out = os.path.join(root, 'assets', 'heroes'); os.makedirs(out, exist_ok=True)
sizes = {}
for slug, (src, *_ ) in hero.items():
    k = slug.replace('/', '-')
    im = Image.open(os.path.join(root, src)).convert('RGB')
    for w, q in ((1920, 74), (960, 72)):
        x = im.copy()
        if x.width > w: x = x.resize((w, round(x.height * w / x.width)), Image.LANCZOS)
        x.save(os.path.join(out, f'{k}-{w}.webp'), quality=q, method=6)
        sizes.setdefault(k, []).append(x.width)
    print(k, im.size)
json.dump(sizes, open(os.path.join(out, 'sizes.json'), 'w'), indent=0)
