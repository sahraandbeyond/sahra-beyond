/* ==========================================================================
   Sahra Trail — /trail/ coming-soon scene (24 Sep 2026, rebuilt 24 Sep)
   ==========================================================================
   A photographic Hajar plate, not a computer-made mountain. One wadi-floor
   view of a limestone face near Jebel Jais with a switchback path up it, in
   two lights (moonlit night and first light), plus a depth map of the same
   frame. A single WebGL shader turns those three images into a moving camera:
   near rock and far ridges shift at different rates (parallax), the scroll
   climbs the frame and pulls back to the full range, and first light arrives
   from the back: the far ridges turn gold before the wadi does.

   On top, drawn by the same shader: a pack of headlamps working up the
   switchbacks (the lead one throws a beam and lights the rock around it),
   twinkling stars and the odd shooting star while it is night, dust in the
   lamp light, the sun breaking through the notch at dawn, and a little film
   grain so the plate reads as a photograph.

   No libraries. Phones get a cropped, sharper plate (they only ever see the
   middle of the frame); rendering stops while the tab is hidden or the scene
   is off screen; reduced-motion visitors get a still frame that follows the
   scroll. No WebGL: the night plate is shown as a still background.
   ========================================================================== */
(function () {
  'use strict';
  var canvas = document.getElementById('trGL');
  var root = document.getElementById('trail');
  if (!canvas || !root) return;
  var REDUCED = false;
  try { REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function fail() { document.documentElement.classList.add('tr-nogl'); }
  var gl, GL2 = false, ctxOpt = { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' };
  try { gl = canvas.getContext('webgl2', ctxOpt); GL2 = !!gl; if (!gl) gl = canvas.getContext('webgl', ctxOpt) || canvas.getContext('experimental-webgl', ctxOpt); } catch (e) {}
  if (!gl) { fail(); return; }
  document.documentElement.classList.add('tr-gl');

  var IMG_ASPECT = 16 / 9;
  var BASE = '/assets/trail/';
  /* the phone plates are the middle half of the frame at full resolution */
  var CROP_M = [0.29, 0.0, 0.5, 1.0], CROP_D = [0, 0, 1, 1];

  /* the switchback path, traced off the plate (image uv, v down), bottom to top,
     with the depth map's nearness at each turn */
  var PATH = [[0.5436, 0.8111, 0.910], [0.5260, 0.7750, 0.902], [0.4245, 0.7285, 0.894], [0.5202, 0.6847, 0.886], [0.4323, 0.6486, 0.878],
    [0.5346, 0.6062, 0.867], [0.4323, 0.5688, 0.863], [0.5366, 0.5389, 0.851], [0.4166, 0.5021, 0.843], [0.5241, 0.4764, 0.824]];
  var SUN = [0.6396, 0.332];   /* where the sun breaks through the notch */

  /* ---------- shaders ---------- */
  var VS = 'attribute vec2 aP; varying vec2 vS; void main(){ vS = vec2(aP.x*0.5+0.5, 0.5-aP.y*0.5); gl_Position = vec4(aP,0.0,1.0); }';
  var FS = [
    'precision highp float;',
    'uniform sampler2D tN; uniform sampler2D tD; uniform sampler2D tZ;',
    'uniform vec2 uRes; uniform vec4 uWin; uniform vec4 uCrop; uniform float uK; uniform float uN0; uniform vec2 uOff;',
    'uniform float uDawn; uniform float uTime; uniform float uPx; uniform float uHasD;',
    'uniform vec3 uL[9]; uniform vec4 uLead; uniform vec4 uShoot; uniform float uShootA; uniform vec3 uSun;',
    'varying vec2 vS;',
    'float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }',
    'vec2 toImg(vec2 s, float n){ vec2 q = uWin.xy + (s-0.5)*uWin.zw; float sc = 1.0 + uK*(n-uN0); return uWin.xy + (q-uWin.xy)/sc + uOff*(n-uN0); }',
    'float nearAt(vec2 q){ return texture2D(tZ, clamp(q,0.0,1.0)).r; }',
    'void main(){',
    ' vec2 s = vS; vec2 px = vec2(s.x*uRes.x, s.y*uRes.y);',
    /* find where this pixel lands on the plate: a few fixed-point steps through the depth map */
    ' float n = uN0; vec2 q = toImg(s,n);',
    ' n = nearAt(q); q = toImg(s,n); n = nearAt(q); q = toImg(s,n); n = nearAt(q); q = toImg(s,n);',
    ' q = clamp(q, 0.0005, 0.9995);',
    ' vec2 tq = (q - uCrop.xy)/uCrop.zw;',
    ' vec3 cn = texture2D(tN, tq).rgb; cn = pow(cn, vec3(1.12)) * 0.86;',
    ' vec3 cd = uHasD > 0.5 ? texture2D(tD, tq).rgb : cn;',
    /* first light comes from behind the range: sky and far ridges turn before the wadi */
    ' float m = clamp(uDawn*1.55 - n*0.55, 0.0, 1.0); m = m*m*(3.0-2.0*m);',
    ' vec3 col = mix(cn, cd, m);',
    ' float sky = 1.0 - smoothstep(0.17, 0.24, n);',
    /* stars that twinkle (fixed to the sky, so they drift with it) */
    ' vec2 g = q*vec2(520.0, 292.0); vec2 id = floor(g); float h = hash(id);',
    ' if (h > 0.972) { vec2 c = id + 0.5 + (vec2(hash(id+3.1), hash(id+7.7))-0.5)*0.6; float d = length(g - c);',
    '   float tw = 0.55 + 0.45*sin(uTime*(1.5+h*5.0) + h*40.0);',
    '   col += vec3(0.85,0.9,1.0) * smoothstep(0.32, 0.0, d) * tw * (h-0.972)*26.0 * sky * (1.0-uDawn); }',
    /* shooting star */
    ' if (uShootA > 0.001) { vec2 a = uShoot.xy, b = uShoot.zw, ab = b-a; float t = clamp(dot(px-a, ab)/dot(ab,ab), 0.0, 1.0);',
    '   float d = length(px - (a + ab*t)); col += vec3(0.9,0.95,1.0) * exp(-d*d/(uPx*uPx*0.5)) * t*t * uShootA * sky; }',
    /* the headlamps: a tight core, a soft bloom, and warm light spilling onto the rock */
    ' float pool = 0.0, core = 0.0;',
    ' for (int i = 0; i < 9; i++) { vec2 dd = px - uL[i].xy; float d2 = dot(dd,dd); float r = uPx*0.9;',
    '   core += uL[i].z * (exp(-d2/(r*r))*1.3 + 0.10*exp(-sqrt(d2)/(r*2.4)));',
    '   pool += uL[i].z * exp(-d2/(r*r*45.0)); }',
    ' vec2 v = px - uLead.xy; vec2 dir = uLead.zw; float al = dot(v, dir); float pe = length(v - al*dir);',
    ' float bw = uPx*1.6 + max(al,0.0)*0.42;',
    ' float beam = smoothstep(0.0, uPx*2.0, al) * exp(-max(al,0.0)/(uPx*55.0)) * exp(-pe*pe/(bw*bw)) * (1.0-uDawn*0.9);',
    ' vec3 warm = vec3(1.0,0.86,0.66);',
    ' float lit = pool*0.55 + beam*1.2;',
    ' col += col*warm*lit*2.2 + warm*lit*0.03 + vec3(1.0,0.93,0.80)*core + warm*beam*0.05;',
    /* dust drifting through the lamp light, and catching the sun at dawn */
    ' vec2 dg = px/(uPx*9.0) + vec2(uTime*0.35, uTime*-0.9); vec2 di = floor(dg); float dh = hash(di+11.0);',
    ' if (dh > 0.93) { float dd = length(fract(dg) - 0.5 - (vec2(hash(di+2.0),hash(di+5.0))-0.5)*0.5);',
    '   col += warm * smoothstep(0.12, 0.0, dd) * (lit*2.5 + uDawn*0.06) * (dh-0.93)*14.0; }',
    /* the sun breaks through the notch */
    ' float sd = length((px - uSun.xy)/uRes.y);',
    ' col += vec3(1.0,0.72,0.42) * (exp(-sd*14.0)*0.26 + exp(-sd*70.0)*0.45) * uSun.z;',
    /* a photograph has grain */
    ' col += (hash(px + fract(uTime)*97.0) - 0.5) * 0.028;',
    ' gl_FragColor = vec4(col, 1.0);',
    '}'].join('\n');

  function sh(type, src) { var o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
  var prg;
  try {
    prg = gl.createProgram();
    gl.attachShader(prg, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prg, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prg);
    if (!gl.getProgramParameter(prg, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prg));
  } catch (e) { fail(); return; }
  gl.useProgram(prg);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var aP = gl.getAttribLocation(prg, 'aP'); gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0);
  var U = {};
  ['tN', 'tD', 'tZ', 'uRes', 'uWin', 'uCrop', 'uK', 'uN0', 'uOff', 'uDawn', 'uTime', 'uPx', 'uHasD', 'uL', 'uLead', 'uShoot', 'uShootA', 'uSun'].forEach(function (k) { U[k] = gl.getUniformLocation(prg, k); });
  gl.uniform1i(U.tN, 0); gl.uniform1i(U.tD, 1); gl.uniform1i(U.tZ, 2);

  /* ---------- plates ---------- */
  var tex = [null, null, null], have = [false, false, false];
  function upload(unit, img) {
    var t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (GL2 && unit !== 2) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
    else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    tex[unit] = t; have[unit] = true;
  }
  function load(src, cb) { var im = new Image(); im.decoding = 'async'; im.onload = function () { cb(im); }; im.onerror = function () { if (!have[0]) fail(); }; im.src = src; }
  /* the phone set covers the middle half of the frame; anything wider (tablets
     unfolded, desktops) takes the full frame */
  var maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
  var viewA = innerWidth / innerHeight;
  var MOBILE = viewA / IMG_ASPECT / 1.04 <= 0.34 && Math.min(innerWidth, innerHeight) < 700;
  var CROP = MOBILE ? CROP_M : CROP_D, SET = MOBILE ? 'm' : (maxTex >= 3840 ? 'd' : 'm');
  if (SET === 'm' && !MOBILE) CROP = CROP_M;   /* tiny GPUs: accept the cropped set */
  gl.uniform4f(U.uCrop, CROP[0], CROP[1], CROP[2], CROP[3]);
  load(BASE + 'hajar-depth.png', function (im) {
    upload(2, im);
    load(BASE + 'hajar-night-' + SET + '.webp', function (im2) {
      upload(0, im2); canvas.classList.add('on'); kick();
      load(BASE + 'hajar-dawn-' + SET + '.webp', function (im3) { upload(1, im3); kick(); });
    });
  });

  /* ---------- the camera: keyframes over the scroll, [p, cx, cy, zoom, depth-dolly, rise] ---------- */
  var K_WIDE = [[0, 0.500, 0.640, 1.50, 0.12, 0.000], [0.30, 0.492, 0.545, 1.38, 0.10, -0.008], [0.55, 0.500, 0.480, 1.22, 0.07, -0.016],
    [0.80, 0.520, 0.470, 1.16, 0.035, -0.022], [1, 0.530, 0.500, 1.13, 0.0, -0.025]];
  var K_TALL = [[0, 0.480, 0.690, 1.62, 0.12, 0.000], [0.30, 0.482, 0.575, 1.50, 0.10, -0.008], [0.55, 0.492, 0.490, 1.34, 0.07, -0.016],
    [0.80, 0.550, 0.440, 1.17, 0.035, -0.022], [1, 0.575, 0.450, 1.08, 0.0, -0.025]];
  function ss(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function key(K, p, j) {
    for (var i = 1; i < K.length; i++) if (p <= K[i][0]) { var t = (p - K[i - 1][0]) / (K[i][0] - K[i - 1][0]); t = t * t * (3 - 2 * t); return lerp(K[i - 1][j], K[i][j], t); }
    return K[K.length - 1][j];
  }

  /* ---------- the path, measured ---------- */
  var segL = [], total = 0;
  for (var i = 1; i < PATH.length; i++) { var dx = (PATH[i][0] - PATH[i - 1][0]) * IMG_ASPECT, dy = PATH[i][1] - PATH[i - 1][1]; segL.push(Math.hypot(dx, dy)); total += segL[i - 1]; }
  function onPath(u, out) {
    var d = u * total;
    for (var i = 0; i < segL.length; i++) {
      if (d <= segL[i] || i === segL.length - 1) {
        var t = Math.min(1, d / segL[i]), a = PATH[i], b = PATH[i + 1];
        /* ease round the hairpins so nobody teleports a corner */
        out[0] = lerp(a[0], b[0], t); out[1] = lerp(a[1], b[1], t) - 0.0045; out[2] = lerp(a[2], b[2], t);
        return out;
      }
      d -= segL[i];
    }
    return out;
  }

  /* ---------- state ---------- */
  var target = 0, prog = 0, t0 = performance.now(), last = t0, visible = true, running = true, W = 1, H = 1, DPR = 1;
  var hud = document.querySelector('.tr-hud');
  var hudE = document.getElementById('trElev'), hudBar = document.getElementById('trBar');
  var win = [0.5, 0.5, 1, 1], kk = 0, n0 = 0.88, off = [0, 0];
  var L = new Float32Array(27), tmp = [0, 0, 0], tmp2 = [0, 0, 0];
  var shoot = { t: -1, next: 2.2, ax: 0, ay: 0, dx: 0, dy: 0 };

  function measure() {
    var r = root.getBoundingClientRect(), h = root.offsetHeight - innerHeight;
    target = h > 0 ? Math.min(1, Math.max(0, -r.top / h)) : 0;
  }
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, Math.min(innerWidth, innerHeight) < 700 ? 1.75 : 2);
    W = Math.round(innerWidth * DPR); H = Math.round(innerHeight * DPR);
    canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H);
    measure();
  }
  addEventListener('resize', function () { resize(); kick(); }, { passive: true });
  addEventListener('scroll', function () { measure(); kick(); }, { passive: true });
  document.addEventListener('visibilitychange', function () { running = !document.hidden; if (running) loop(); });
  try { new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) loop(); }).observe(root); } catch (e) {}
  resize();

  /* image uv + nearness -> screen px (the inverse of the shader's lookup) */
  function toScreen(u, v, n, out) {
    var sc = 1 + kk * (n - n0);
    var qx = win[0] + (u - off[0] * (n - n0) - win[0]) * sc, qy = win[1] + (v - off[1] * (n - n0) - win[1]) * sc;
    out[0] = (0.5 + (qx - win[0]) / win[2]) * W; out[1] = (0.5 + (qy - win[1]) / win[3]) * H;
    return out;
  }

  function frame(now) {
    if (!have[0] || !have[2]) return;
    var dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    var time = Math.max(0, (now - t0) / 1000);
    prog += (target - prog) * (REDUCED ? 1 : Math.min(1, dt * 3.2));
    var p = prog, dawn = ss(0.22, 0.9, p), still = REDUCED ? 0 : 1;

    /* the camera: tall screens follow the path up the middle, wide ones take in the range */
    var va = W / H, tw = ss(0.62, 1.25, va), j;
    var c = [0, 0, 0, 0, 0, 0];
    for (j = 1; j < 6; j++) c[j] = lerp(key(K_TALL, p, j), key(K_WIDE, p, j), tw);
    var zoom = Math.max(c[3], 1.13 * va / IMG_ASPECT * (CROP[2] < 1 ? 1 / CROP[2] : 1));
    var hv = 1 / zoom, wv = hv * va / IMG_ASPECT;
    var cx = Math.min(CROP[0] + CROP[2] - wv * 0.55 - 0.015, Math.max(CROP[0] + wv * 0.55 + 0.015, c[1]));
    var cy = Math.min(1 - hv * 0.55 - 0.01, Math.max(hv * 0.55 + 0.01, c[2]));
    win[0] = cx; win[1] = cy; win[2] = wv; win[3] = hv; kk = c[4];
    /* a slow, breathing drift so the first screen is never a still; the far range swings against the near rock */
    off[0] = (Math.sin(time * 0.21) * 0.010 + Math.sin(time * 0.53 + 1.3) * 0.003) * still;
    off[1] = c[5] + (Math.sin(time * 0.17 + 0.6) * 0.005) * still;

    gl.uniform2f(U.uRes, W, H);
    gl.uniform4f(U.uWin, win[0], win[1], win[2], win[3]);
    gl.uniform1f(U.uK, kk); gl.uniform1f(U.uN0, n0); gl.uniform2f(U.uOff, off[0], off[1]);
    gl.uniform1f(U.uDawn, have[1] ? dawn : 0); gl.uniform1f(U.uTime, time); gl.uniform1f(U.uHasD, have[1] ? 1 : 0);
    var pxU = H / 1000 * zoom * 1.2;   /* lamp size follows the zoom */
    gl.uniform1f(U.uPx, Math.max(1.4 * DPR, pxU));

    /* the pack: nine headlamps working up the switchbacks, on a loop */
    var ru = REDUCED ? 0.55 : (time * 0.042) % 1;
    var fade = 1 - ss(0.3, 0.8, dawn);
    for (var q = 0; q < 9; q++) {
      var pu = ru - q * 0.137; pu = pu < 0 ? pu + 1 : pu;
      onPath(pu, tmp); toScreen(tmp[0], tmp[1], tmp[2], tmp2);
      var inout = ss(0, 0.04, pu) * (1 - ss(0.96, 1, pu));
      L[q * 3] = tmp2[0]; L[q * 3 + 1] = tmp2[1];
      L[q * 3 + 2] = q > 6 ? 0 : (q === 0 ? 1.1 : 0.8 + 0.25 * Math.sin(time * 7 + q * 2.3)) * fade * inout * (0.55 + 0.45 * ss(0.82, 0.91, tmp[2]));
      if (q === 0) {
        onPath(Math.min(1, pu + 0.012), tmp); var hx = tmp2[0], hy = tmp2[1];
        toScreen(tmp[0], tmp[1], tmp[2], tmp2);
        var ddx = tmp2[0] - hx, ddy = tmp2[1] - hy + 0.35 * Math.hypot(tmp2[0] - hx, tmp2[1] - hy), dl = Math.hypot(ddx, ddy) || 1;
        gl.uniform4f(U.uLead, hx, hy, ddx / dl, ddy / dl);
      }
    }
    gl.uniform3fv(U.uL, L);

    /* a shooting star every few seconds while it is still night */
    var sa = 0;
    if (!REDUCED && dawn < 0.5) {
      if (shoot.t < 0 && time > shoot.next) {
        shoot.t = 0; shoot.ax = (0.15 + Math.random() * 0.7) * W; shoot.ay = (0.04 + Math.random() * 0.18) * H;
        var ang = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.4);
        shoot.dx = Math.sin(ang) * Math.max(W, H) * 0.5; shoot.dy = Math.cos(ang) * Math.max(W, H) * 0.22;
      }
      if (shoot.t >= 0) {
        shoot.t += dt; var k2 = shoot.t / 0.85;
        var hx2 = shoot.ax + shoot.dx * k2, hy2 = shoot.ay + shoot.dy * k2;
        gl.uniform4f(U.uShoot, hx2 - shoot.dx * 0.28, hy2 - shoot.dy * 0.28, hx2, hy2);
        sa = Math.sin(Math.min(1, k2) * Math.PI) * (1 - dawn * 2);
        if (k2 >= 1) { shoot.t = -1; shoot.next = time + 2.2 + Math.random() * 3.3; }
      }
    }
    gl.uniform1f(U.uShootA, Math.max(0, sa));

    toScreen(SUN[0], SUN[1], 0.05, tmp2);
    gl.uniform3f(U.uSun, tmp2[0], tmp2[1], ss(0.62, 1.0, dawn) * (0.85 + 0.15 * Math.sin(time * 1.3)));

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (hudE) {
      var elev = Math.round(lerp(190, 1850, p) / 10) * 10;
      hudE.textContent = elev.toLocaleString('en-US') + ' m';
      hudBar.style.transform = 'scaleX(' + p.toFixed(3) + ')';
      document.documentElement.style.setProperty('--tr-dawn', dawn.toFixed(3));
      if (hud) hud.style.opacity = (1 - ss(0.9, 0.97, p)).toFixed(2);   /* steps aside for the sign-up */
    }
  }
  var raf = 0, CAPTURE = /[?&]capture\b/.test(location.search);
  function loop() {
    if (raf || CAPTURE) return;
    var step = function (now) { raf = 0; if (!running || !visible) return; frame(now); if (!REDUCED) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
  }
  function kick() { if (REDUCED && !CAPTURE) frame(performance.now()); else loop(); }
  /* ?capture: frame-by-frame rendering for making a preview film (no effect otherwise) */
  if (CAPTURE) {
    running = false;
    var capPrev = -1;
    window.__trReady = function () { return have[0] && have[1] && have[2]; };
    window.__trCap = function (sec) { measure(); prog = target; last = t0 + (capPrev >= 0 && sec > capPrev ? capPrev : sec - 0.016) * 1000; capPrev = sec; frame(t0 + sec * 1000); };
    return;
  }
  loop();
})();

/* ---------- the logo: draw, lift, flash ---------- */
(function () {
  var logo = document.getElementById('trLogo');
  if (!logo) return;
  requestAnimationFrame(function () { logo.classList.add('go'); });
  /* a passing headlamp catches the reflective mark every few seconds, and on a tap */
  var flash = function () { logo.classList.remove('flash'); void logo.offsetWidth; logo.classList.add('flash'); };
  setTimeout(function () { flash(); setInterval(flash, 5000); }, 3300);
  logo.addEventListener('click', flash);
})();

/* ---------- chapters fade in as they arrive ---------- */
(function () {
  var els = document.querySelectorAll('.tr-rv');
  if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.25 });
  els.forEach(function (e) { io.observe(e); });
})();
