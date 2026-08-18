/* ==========================================================================
   sahra-sky.js — the living sky, on every page.
   ==========================================================================
   The homepage and /shop/ had a WebGL scene; the other 46 pages had flat CSS
   gradients. Going from a 3D hero to a plain 2D page read as unfinished.

   This is a deliberately light sibling of the homepage scene: one fixed
   canvas, a drifting star field and two parallax dune ridges, sharing the
   homepage's six-stop time-of-day ramp so the whole site moves through the
   same night to golden hour as you scroll. No Three.js dependency — plain
   2D canvas, a few hundred points, so it costs almost nothing on a phone.
   ========================================================================== */
(function () {
  if (document.getElementById('skyfield')) return;                 // homepage already has the full scene
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  if (navigator.connection && navigator.connection.saveData) return;

  var STOPS = [[20,16,42],[58,41,90],[122,79,99],[192,112,46],[233,185,120],[92,64,92]];
  function ramp(p) {
    var x = Math.max(0, Math.min(1, p)) * (STOPS.length - 1), i = Math.floor(x), t = x - i;
    var a = STOPS[i], b = STOPS[Math.min(i + 1, STOPS.length - 1)];
    return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
  }

  var c = document.createElement('canvas');
  c.id = 'sb-sky'; c.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(c, document.body.firstChild);
  var x = c.getContext('2d'); if (!x) return;

  var TOUCH = matchMedia('(hover:none)').matches;
  var DPR = Math.min(devicePixelRatio || 1, TOUCH ? 1.25 : 1.6);
  var W = 0, H = 0, stars = [], N = TOUCH ? 90 : 190;
  function size() {
    W = c.width = Math.round(innerWidth * DPR); H = c.height = Math.round(innerHeight * DPR);
    c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px';
  }
  size(); addEventListener('resize', size, { passive: true });
  for (var i = 0; i < N; i++) stars.push({
    x: Math.random(), y: Math.random() * 0.72,
    r: (Math.random() * 1.25 + 0.35) * DPR, a: Math.random() * 0.55 + 0.25, ph: Math.random() * 6.28
  });

  var prog = 0, target = 0, mx = 0, tmx = 0;
  function measure() {
    var h = document.documentElement.scrollHeight - innerHeight;
    target = h > 0 ? Math.max(0, Math.min(1, scrollY / h)) : 0;
  }
  measure(); prog = target;
  addEventListener('scroll', measure, { passive: true });
  addEventListener('resize', measure, { passive: true });
  if (!TOUCH) addEventListener('mousemove', function (e) { tmx = (e.clientX / innerWidth) * 2 - 1; }, { passive: true });

  /* two ridges, drawn from a cheap sine so there is no geometry to load */
  function ridge(yBase, amp, seed, fill, shift) {
    x.beginPath(); x.moveTo(0, H);
    for (var px = 0; px <= W; px += Math.max(6, W / 120)) {
      var t = px / W;
      var y = yBase + Math.sin(t * 6.0 + seed) * amp + Math.sin(t * 13.0 + seed * 2) * amp * 0.35;
      x.lineTo(px + shift, y);
    }
    x.lineTo(W, H); x.closePath(); x.fillStyle = fill; x.fill();
  }

  (function frame() {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    prog += (target - prog) * 0.06;
    mx += (tmx - mx) * 0.05;
    var col = ramp(prog), arc = Math.sin(prog * Math.PI);
    var t = performance.now() * 0.001;

    var g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgb(' + (col[0]|0) + ',' + (col[1]|0) + ',' + (col[2]|0) + ')');
    g.addColorStop(0.62, 'rgb(' + Math.min(255, col[0]*1.25+18|0) + ',' + Math.min(255, col[1]*1.2+14|0) + ',' + Math.min(255, col[2]*1.05+8|0) + ')');
    g.addColorStop(1, 'rgb(' + Math.min(255, col[0]*1.6+40|0) + ',' + Math.min(255, col[1]*1.5+30|0) + ',' + Math.min(255, col[2]*1.15+10|0) + ')');
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    var starA = Math.max(0, 1 - prog * 2.6);
    if (starA > 0.01) {
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i], tw = 0.65 + Math.sin(t * 0.9 + s.ph) * 0.35;
        x.beginPath();
        x.arc(s.x * W + mx * 10 * DPR, s.y * H + prog * 26 * DPR, s.r, 0, 6.2832);
        x.fillStyle = 'rgba(255,246,225,' + (s.a * tw * starA).toFixed(3) + ')';
        x.fill();
      }
    }
    /* sun/moon tracking the same arc as the homepage */
    var sx = (0.18 + prog * 0.64) * W + mx * 16 * DPR, sy = (0.30 - arc * 0.18) * H;
    var rg = x.createRadialGradient(sx, sy, 0, sx, sy, 120 * DPR);
    rg.addColorStop(0, 'rgba(255,240,214,' + (0.30 + arc * 0.34).toFixed(3) + ')');
    rg.addColorStop(1, 'rgba(255,240,214,0)');
    x.fillStyle = rg; x.beginPath(); x.arc(sx, sy, 120 * DPR, 0, 6.2832); x.fill();

    ridge(H * 0.80 + prog * 30 * DPR, 22 * DPR, 1.2, 'rgba(139,78,99,' + (0.36 + arc * 0.16).toFixed(2) + ')', mx * -9 * DPR);
    ridge(H * 0.90 + prog * 44 * DPR, 16 * DPR, 3.4, 'rgba(58,36,28,' + (0.55 + arc * 0.12).toFixed(2) + ')', mx * -16 * DPR);
  })();
})();
