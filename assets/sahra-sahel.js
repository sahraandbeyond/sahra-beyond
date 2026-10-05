/* Sahel (/sahel/) - the scene behind the page. 6 Oct 2026.
   One fixed canvas. Six graded stills from the real Snoopy Island footage (shore,
   split waterline, reef, turtle, light shafts, seabed) are the only pictures; the
   water is drawn live on top of them by one raw-WebGL fragment shader: a waterline
   that rises as the page crosses the surface, refraction wobble, caustic light,
   sun shafts and drifting specks. Scroll picks the two stills in play and the mix.
   No WebGL, reduced motion or save-data: the same stills crossfade as plain layers.
   Nothing here claims a depth, a species or a distance. */
(function () {
  'use strict';
  var root = document.documentElement, main = document.getElementById('sahel');
  var cv = document.getElementById('shGL');
  if (!main || !cv) return;

  var PL = ['shore', 'surface', 'reef', 'locals', 'light', 'seabed'];
  /* per still: where the subject sits (0 top .. 1 bottom) so a wide screen keeps it; the still's own
     waterline (1 = no water in frame, 0 = all under water); caustic, shaft and speck strength */
  var FOC = [0.48, 0.47, 0.52, 0.50, 0.30, 0.55];
  var WL  = [1.00, 0.415, 0.0, 0.0, 0.0, 0.0];
  var CA  = [0.00, 0.30, 0.42, 0.20, 0.26, 0.55];
  var RAY = [0.00, 0.05, 0.10, 0.22, 0.55, 0.16];
  var SPK = [0.00, 0.35, 0.60, 0.80, 0.90, 0.60];

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var conn = navigator.connection || {};
  var lean = !!conn.saveData || /(^|[^4-9])[23]g$/.test(conn.effectiveType || '');
  var small = Math.min(window.innerWidth, window.innerHeight) <= 820 || lean;
  var src = function (k) { return '/assets/sahel/sahel-' + PL[k] + (small ? '-m' : '-d') + '.webp'; };

  /* ---------- scroll -> which still, how far to the next ---------- */
  var stops = [].slice.call(main.querySelectorAll('[data-plate]'));
  var hudName = document.getElementById('shStop'), hudBar = document.getElementById('shBar');
  var names = stops.map(function (s) { return s.getAttribute('data-stop') || ''; });
  var P = 0, lastName = '';
  function ss(a, b, x) { x = Math.max(0, Math.min(1, (x - a) / (b - a))); return x * x * (3 - 2 * x); }
  function measure() {
    var vh = window.innerHeight, mid = vh * 0.5, best = 0, p = 0, i;
    var cs = stops.map(function (s) { var r = s.getBoundingClientRect(); return r.top + Math.min(r.height, vh * 1.2) * 0.5; });
    if (mid <= cs[0]) { p = +stops[0].getAttribute('data-plate'); best = 0; }
    else if (mid >= cs[cs.length - 1]) { p = +stops[stops.length - 1].getAttribute('data-plate'); best = stops.length - 1; }
    else for (i = 0; i < cs.length - 1; i++) if (mid >= cs[i] && mid < cs[i + 1]) {
      var f = (mid - cs[i]) / (cs[i + 1] - cs[i]);
      var a = +stops[i].getAttribute('data-plate'), b = +stops[i + 1].getAttribute('data-plate');
      p = a + (b - a) * ss(0.22, 0.78, f); best = f < 0.5 ? i : i + 1; break;
    }
    P = p;
    var doc = document.documentElement, max = Math.max(1, doc.scrollHeight - vh);
    var prog = Math.max(0, Math.min(1, (window.scrollY || doc.scrollTop) / max));
    if (hudBar) hudBar.style.transform = 'scaleX(' + prog.toFixed(4) + ')';
    if (hudName && names[best] && names[best] !== lastName) { lastName = names[best]; hudName.textContent = lastName; }
    root.style.setProperty('--sh-deep', Math.min(1, p / 5).toFixed(3));
    main.classList.toggle('sh-end', best >= stops.length - 2);
    main.classList.toggle('sh-go', best >= 1);
  }

  /* ---------- chapter reveals ---------- */
  var rv = [].slice.call(main.querySelectorAll('.sh-rv'));
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.18 });
    rv.forEach(function (el) { io.observe(el); });
  } else rv.forEach(function (el) { el.classList.add('in'); });

  /* ---------- the pieces: tap and the light pools on one ---------- */
  [].forEach.call(main.querySelectorAll('.sh-piece'), function (b) {
    var t = 0;
    b.addEventListener('click', function () { b.classList.remove('lit'); void b.offsetWidth; b.classList.add('lit'); clearTimeout(t); t = setTimeout(function () { b.classList.remove('lit'); }, 2600); });
  });
  var mark = document.getElementById('shMark');
  if (mark) setTimeout(function () { mark.classList.add('go'); }, 120);

  /* ---------- fallback: the same stills as plain layers ---------- */
  function layers() {
    root.classList.add('sh-nogl');
    var box = document.createElement('div'); box.className = 'sh-fb'; box.setAttribute('aria-hidden', 'true');
    var els = PL.map(function (n, k) { var i = document.createElement('i'); if (k === 0) i.style.backgroundImage = 'url(' + src(0) + ')'; i.style.backgroundPosition = '50% ' + Math.round(FOC[k] * 100) + '%'; box.appendChild(i); return i; });
    cv.parentNode.insertBefore(box, cv); cv.style.display = 'none';
    var got = [true];
    function paint() {
      measure();
      var a = Math.floor(Math.min(P, PL.length - 1)), f = P - a;
      for (var k = 0; k < els.length; k++) {
        if (!got[k] && k <= P + 1.3) { got[k] = true; els[k].style.backgroundImage = 'url(' + src(k) + ')'; }
        els[k].style.opacity = k === a ? 1 : (k === a + 1 ? f.toFixed(3) : 0);
      }
    }
    window.addEventListener('scroll', paint, { passive: true }); window.addEventListener('resize', paint); paint();
  }

  var gl = null;
  if (!reduce && !lean) { try { gl = cv.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' }) || cv.getContext('experimental-webgl'); } catch (e) { gl = null; } }
  if (!gl) { layers(); return; }

  var VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;v.y=1.-v.y;gl_Position=vec4(p,0.,1.);}';
  var FS = [
    'precision mediump float;',
    'varying vec2 v;uniform sampler2D A;uniform sampler2D B;uniform vec2 R;uniform float T,M,K,D;',
    'uniform vec2 FOC,WL,CA,RAY,SPK;uniform float RDY;',
    'float h1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    /* cover a 9:16 still, keep its subject on a wide screen, leave a little room to drift */
    'vec2 cov(vec2 uv,float foc,float par){float sa=R.x/R.y,ta=.5625;vec2 t=uv;float z=.94;',
    ' if(sa>ta){float vis=ta/sa*z;float y0=clamp(foc-vis*.5+par,0.,1.-vis);t.y=y0+uv.y*vis;t.x=.5+(uv.x-.5)*z;}',
    ' else{float vis=sa/ta*z;t.x=.5-vis*.5+uv.x*vis;t.y=.5+(uv.y-.5)*z+par;}return t;}',
    'float caus(vec2 uv,float t){vec2 p=mod(uv*6.2831853,6.2831853)-250.;vec2 i=p;float c=1.;',
    ' for(int n=0;n<4;n++){float tt=t*(1.-(3.5/float(n+1)));i=p+vec2(cos(tt-i.x)+sin(tt+i.y),sin(tt-i.y)+cos(tt+i.x));',
    '  c+=1./length(vec2(p.x/(sin(i.x+tt)/.005),p.y/(cos(i.y+tt)/.005)));}',
    ' c/=4.;c=1.17-pow(c,1.4);return pow(abs(c),8.);}',
    'vec3 still(sampler2D s,vec2 uv,float foc,float wl,float ca,float ray,float spk,float par){',
    ' vec2 t=cov(uv,foc,par);float sa=R.x/R.y;',
    ' float under=smoothstep(wl-.006,wl+.012,t.y);',
    ' vec2 w=vec2(sin(t.y*19.+T*1.25)+sin(t.y*7.-T*.7),cos(t.x*15.+T*1.05))*.0026*under;',
    ' vec3 c=texture2D(s,clamp(t+w,0.,1.)).rgb;',
    ' vec2 q=vec2(uv.x*sa,uv.y);',
    ' float k=caus(q*1.15+vec2(0.,T*.012),T*.42)*.75+caus(q*2.1+7.3,T*.3)*.35;',
    ' c+=vec3(.72,.95,1.)*k*ca*under*(.35+.65*smoothstep(.15,.95,uv.y));',
    ' float an=atan(uv.x-.5+.22,uv.y+.55);',
    ' float sh=max(0.,sin(an*38.+T*.21))*max(0.,sin(an*21.-T*.13+1.7));sh=sh*sh*(1.-uv.y*.75);',
    ' c+=vec3(.66,.9,1.)*sh*ray*under;',
    ' vec2 g=q*vec2(9.,9.)+vec2(T*.012,-T*.035);vec2 id=floor(g);vec2 f=fract(g)-.5;',
    ' vec2 o=vec2(h1(id),h1(id+7.1))-.5;float d=length(f-o*.7);float tw=.5+.5*sin(T*1.3+h1(id+3.)*6.28);',
    ' c+=vec3(.8,.95,1.)*smoothstep(.035,0.,d)*.22*tw*spk*under*step(.55,h1(id+1.7));',
    ' return c;}',
    'void main(){',
    ' float par=(M-.5)*.02;',
    ' vec3 a=still(A,v,FOC.x,WL.x,CA.x,RAY.x,SPK.x,-M*.035);',
    ' vec3 b=still(B,v,FOC.y,WL.y,CA.y,RAY.y,SPK.y,(1.-M)*.035);',
    ' float n=sin(v.x*9.+T*1.5)*.011+sin(v.x*23.-T*2.2)*.0045+sin(v.x*4.-T*.6)*.008;',
    ' vec3 c;float glow=0.;',
    ' if(K>.5){',                       /* crossing the surface: the water climbs to the still's own waterline */
    '  float sa=R.x/R.y,ta=.5625,z=.94;float wls;',
    '  if(sa>ta){float vis=ta/sa*z;float y0=clamp(FOC.y-vis*.5,0.,1.-vis);wls=(WL.y-y0)/vis;}else{wls=(WL.y-.5)/z+.5;}',
    '  float e=mix(1.12,wls,smoothstep(0.,.86,M))+n*(1.-smoothstep(.8,1.,M));',
    '  float m=smoothstep(e-.003,e+.003,v.y);',
    '  vec3 top=mix(a,b,smoothstep(.45,1.,M));',
    '  c=mix(top,b,m);float live=1.-smoothstep(.86,1.,M);',
    '  glow=exp(-abs(v.y-e)*460.)*.3*(.5+.5*sin(v.x*71.+T*2.6)*sin(v.x*29.-T*1.9))*live;',
    '  c+=vec3(.16,.34,.38)*smoothstep(.16,0.,v.y-e)*step(e,v.y)*.5*live;',
    ' }else{',                          /* going down: the next still rises from below */
    '  float e=1.2-M*1.55+n*1.6;float m=smoothstep(e-.16,e+.10,v.y);c=mix(a,b,m);',
    ' }',
    ' c+=vec3(.85,.97,1.)*glow;',
    ' vec3 abyss=vec3(.043,.082,.149);',
    ' c=mix(c,abyss+(c-abyss)*.42,D);',
    ' float vg=smoothstep(1.25,.35,length((v-.5)*vec2(1.,1.15)));c*=mix(.72,1.,vg);',
    ' c=mix(vec3(.043,.082,.149),c,RDY);',
    ' gl_FragColor=vec4(c,1.);}'
  ].join('\n');

  function sh(type, s) { var o = gl.createShader(type); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o) || 'shader'); return o; }
  var pr, U = {};
  try {
    pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link');
  } catch (e) { layers(); return; }
  gl.useProgram(pr);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  ['A', 'B', 'R', 'T', 'M', 'K', 'D', 'FOC', 'WL', 'CA', 'RAY', 'SPK', 'RDY'].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
  gl.uniform1i(U.A, 0); gl.uniform1i(U.B, 1);

  /* stills load as the page nears them; until one lands its neighbour stands in */
  var tex = [], state = [];
  function load(k) {
    if (k < 0 || k >= PL.length || state[k]) return;
    state[k] = 1;
    var im = new Image(); im.decoding = 'async';
    im.onload = function () {
      var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im); } catch (e) { state[k] = 0; return; }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      tex[k] = t; state[k] = 2; if (k === 0) { ready = 0.0001; root.classList.add('sh-live'); } dirty = true;
    };
    im.onerror = function () { state[k] = 0; };
    im.src = src(k);
  }
  function pick(k) { for (var d = 0; d < PL.length; d++) { if (tex[k - d]) return tex[k - d]; if (tex[k + d]) return tex[k + d]; } return null; }

  var dpr = 1, ready = 0, dirty = true, running = true, slow = 0, last = 0, t0 = performance.now(), cap = small ? 1.5 : 1.25;
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, cap);
    var w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
    gl.uniform2f(U.R, w, h); dirty = true;
  }
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    var dt = now - last; last = now;
    /* a phone that cannot keep up gets fewer pixels rather than a stutter */
    if (dt > 34 && dt < 400) { if (++slow > 40 && cap > 0.8) { cap = Math.max(0.75, cap - 0.25); slow = 0; size(); } } else if (slow > 0) slow--;
    measure();
    var a = Math.max(0, Math.min(PL.length - 2, Math.floor(P))), m = Math.max(0, Math.min(1, P - a));
    if (P >= PL.length - 1) { a = PL.length - 2; m = 1; }
    load(a); load(a + 1); if (m > 0.2) load(a + 2);
    var ta = pick(a), tb = pick(a + 1);
    if (!ta || !tb) return;
    if (ready < 1) ready = Math.min(1, ready + dt / 900);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, ta);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tb);
    gl.uniform1f(U.T, (now - t0) / 1000); gl.uniform1f(U.M, m); gl.uniform1f(U.K, a === 0 ? 1 : 0);
    gl.uniform1f(U.D, ss(4.15, 5, P)); gl.uniform1f(U.RDY, ready);
    gl.uniform2f(U.FOC, FOC[a], FOC[a + 1]); gl.uniform2f(U.WL, WL[a], WL[a + 1]);
    gl.uniform2f(U.CA, CA[a], CA[a + 1]); gl.uniform2f(U.RAY, RAY[a], RAY[a + 1]); gl.uniform2f(U.SPK, SPK[a], SPK[a + 1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); running = false; layers(); });
  window.addEventListener('resize', size);
  document.addEventListener('visibilitychange', function () { if (document.hidden) running = false; else if (!running && gl && !root.classList.contains('sh-nogl')) { running = true; last = performance.now(); requestAnimationFrame(frame); } });
  size(); load(0); load(1); measure();
  requestAnimationFrame(function (n) { last = n; frame(n); });
})();
