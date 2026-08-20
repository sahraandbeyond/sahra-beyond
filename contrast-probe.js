/**
 * contrast-probe.js — the measurement, as a single source of truth.
 *
 * Exported as a string so it can be pasted straight into a browser console on
 * the live site, or evaluated by contrast-audit.js under a headless browser.
 * Keep one copy only; two copies drift.
 *
 * Why each part exists — every one of these was a real wrong answer first:
 *
 *  - Walks EVERY element owning a text node. The old contrast-check.py tested
 *    six hardcoded selectors, so it never saw the PDP size chart, the
 *    breadcrumbs, the stock labels or the footer.
 *
 *  - Parses `color(srgb r g b / a)` as well as rgb()/rgba(). Chrome returns the
 *    modern syntax for some declarations; reading those 0–1 components as
 *    0–255 made a cream header measure as near-black and invented eight
 *    failures in the top nav that did not exist.
 *
 *  - Multiplies opacity down the ancestor chain. A .6 label inside a .8 card
 *    renders at .48, which no single-element check catches.
 *
 *  - Reads gradient colour stops and tests the text against the WORST stop.
 *    Without this, white text on a dark gradient band composites down to the
 *    body colour underneath and reports a false failure.
 *
 *  - Stops motion before forcing reveals. Transitions and animations sit ABOVE
 *    author !important in the cascade, so `opacity:1!important` is silently
 *    ignored while a reveal transition is in flight. Killing motion first is
 *    what took the PDP from 80 measured elements to 210.
 *
 *  - Forces scroll-reveal blocks visible instead of scrolling to them. The site
 *    uses Lenis smooth scroll and body-level scrolling, and background tabs
 *    throttle timers and never fire rAF, so scroll-stepping hangs.
 *
 *  - Reports text over photographs separately, under "over artwork". Those
 *    cannot be measured from the DOM and need an eye, rather than being
 *    silently passed or falsely failed.
 */
const PROBE_SRC = `(async function(){
 var px=v=>parseFloat(v)||0;
 function P(c){ if(!c)return null; c=String(c);
  var s=/^color\\(\\s*srgb\\s+([^)]+)\\)/i.exec(c);
  if(s){var m=s[1].replace('/',' ').match(/[\\d.]+/g); if(!m)return null;
   return {r:+m[0]*255,g:+m[1]*255,b:+m[2]*255,a:m.length>3?+m[3]:1};}
  if(/^transparent$/i.test(c))return{r:0,g:0,b:0,a:0};
  var m2=c.match(/[\\d.]+/g); if(!m2||m2.length<3)return null;
  return {r:+m2[0],g:+m2[1],b:+m2[2],a:m2.length>3?+m2[3]:1};}
 function HEX(h){h=h.slice(1); if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  if(h.length<6)return null;
  return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16),
          a:h.length>=8?parseInt(h.slice(6,8),16)/255:1};}
 var O=(f,b)=>({r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1}),
 L=c=>{var t=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};
   return .2126*t(c.r)+.7152*t(c.g)+.0722*t(c.b)},
 R=(a,b)=>{var x=L(a),y=L(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
 function PT(el){var b=[],n=el;
  for(var i=0;n&&n.nodeType===1&&i<3;i++,n=n.parentElement){var s=n.tagName.toLowerCase();
   if(n.id)s+='#'+n.id;
   else if(typeof n.className==='string'&&n.className.trim())s+='.'+n.className.trim().split(/\\s+/).slice(0,3).join('.');
   b.unshift(s);}
  return b.join('>');}
 function stops(bg){var res=[],re=/(rgba?\\([^)]*\\)|color\\(srgb[^)]*\\)|#[0-9a-fA-F]{3,8})/g,m;
  while((m=re.exec(bg))){var c=m[1][0]==='#'?HEX(m[1]):P(m[1]); if(c&&c.a>0)res.push(c);} return res;}

 if(document.getAnimations){ document.getAnimations().forEach(function(a){
   try{a.finish();}catch(e){ try{var d=a.effect&&a.effect.getTiming?a.effect.getTiming().duration:0;
     a.currentTime=(typeof d==='number'&&isFinite(d))?d:1000;}catch(e2){} } }); }

 var ALL=[].slice.call(document.querySelectorAll('body *'));

 var motionOff=document.createElement('style');
 motionOff.textContent='*,*::before,*::after{transition:none!important;animation:none!important}';
 document.head.appendChild(motionOff);

 var hideCls={};
 ALL.forEach(function(el){var cs=getComputedStyle(el);
  if(parseFloat(cs.opacity)===0 && cs.display!=='none' && typeof el.className==='string'){
   el.className.trim().split(/\\s+/).forEach(function(c){ if(c) hideCls[c]=1; });}});
 var revealCss=Object.keys(hideCls), revealStyle=null;
 if(revealCss.length){ revealStyle=document.createElement('style');
  revealStyle.textContent='.'+revealCss.join(',.')+'{opacity:1!important}';
  document.head.appendChild(revealStyle); }

 var sx=window.scrollX, sy=window.scrollY, painted=[];
 [].slice.call(document.querySelectorAll('canvas,img,picture,video')).forEach(function(n){
  var r=n.getBoundingClientRect(); if(r.width>4&&r.height>4)
   painted.push({l:r.left+sx,t:r.top+sy,rt:r.right+sx,bt:r.bottom+sy});});
 ALL.forEach(function(n){var cs=getComputedStyle(n);
  if(cs.backgroundImage&&cs.backgroundImage!=='none'&&!/gradient/i.test(cs.backgroundImage)){
   var r=n.getBoundingClientRect(); if(r.width>4&&r.height>4)
    painted.push({l:r.left+sx,t:r.top+sy,rt:r.right+sx,bt:r.bottom+sy});}});
 function overPainted(r){var l=r.left+sx,t=r.top+sy,rt=r.right+sx,bt=r.bottom+sy;
  for(var i=0;i<painted.length;i++){var p=painted[i];
   if(l<p.rt&&rt>p.l&&t<p.bt&&bt>p.t)return true;} return false;}

 function ctx(el){var layers=[],n=el,o=1;
  while(n&&n.nodeType===1){var cs=getComputedStyle(n);
   o*=(parseFloat(cs.opacity)||0);
   var bi=cs.backgroundImage;
   if(bi&&bi!=='none'&&/gradient/i.test(bi)){var st=stops(bi); if(st.length)layers.push({grad:st});}
   var c=P(cs.backgroundColor); if(c&&c.a>0)layers.push({solid:c});
   n=n.parentElement;}
  var cands=[{r:255,g:255,b:255,a:1}];
  for(var i=layers.length-1;i>=0;i--){var lay=layers[i],next=[];
   for(var j=0;j<cands.length;j++){
    if(lay.solid)next.push(O(lay.solid,cands[j]));
    else lay.grad.forEach(function(g){next.push(O(g,cands[j]));});}
   if(next.length>2){next.sort(function(a,b){return L(a)-L(b);});next=[next[0],next[next.length-1]];}
   cands=next;}
  return {cands:cands,op:o};}

 var out=[],unk=[],ck=0,skipped={};
 function measure(themeLabel){
 ALL.forEach(function(el){
  if(/^(script|style|noscript|template|svg|canvas|title)$/i.test(el.tagName))return;
  var own=[].slice.call(el.childNodes).filter(n=>n.nodeType===3)
    .map(n=>n.textContent.replace(/\\s+/g,' ').trim()).join(' ').trim();
  if(!own)return;
  var cs=getComputedStyle(el), why=null;
  if(cs.display==='none')why='display:none';
  else if(cs.visibility==='hidden')why='visibility:hidden';
  else if(cs.clip==='rect(0px, 0px, 0px, 0px)')why='sr-only';
  else if(px(cs.textIndent)<-900)why='indent-hidden';
  var rc=el.getBoundingClientRect();
  if(!why&&(rc.width<2||rc.height<2))why='zero-size';
  if(why){skipped[why]=(skipped[why]||0)+1;return;}
  var k=ctx(el);
  if(k.op===0){skipped['opacity:0']=(skipped['opacity:0']||0)+1;return;}
  var fg=P(cs.color); if(!fg)return; ck++;
  var f2={r:fg.r,g:fg.g,b:fg.b,a:fg.a*k.op};
  var rr=Infinity, worst=k.cands[0];
  k.cands.forEach(function(cd){var e=O(f2,cd),v=R(e,cd); if(v<rr){rr=v;worst=cd;}});
  var sz=px(cs.fontSize), wt=parseInt(cs.fontWeight)||400;
  var need=(sz>=24||(sz>=18.66&&wt>=700))?3:4.5;
  if(rr>=need-.005)return;
  (overPainted(rc)?unk:out).push({t:own.slice(0,40),p:PT(el),r:+rr.toFixed(2),n:need,
   s:+sz.toFixed(1),c:cs.color,o:+k.op.toFixed(2),th:themeLabel,
   b:'rgb('+Math.round(worst.r)+','+Math.round(worst.g)+','+Math.round(worst.b)+')'});
 });
 }

 /* The page has more than one visual state. A scroll-linked colour journey
    adds body.dark-bg partway down and swaps the whole palette to light text.
    Measuring only the state at scrollY=0 is how a PDP that rendered light
    text on a cream pane at 1.01:1 passed a clean audit. Measure every theme
    the page can put itself in, not just the one it loads in. */
 measure('light');

 /* Toggling the theme class is not enough. body.dark-bg only changes the
    custom property --txt; the computed colour that inherits from it does not
    re-resolve until the page actually paints a frame. Read it synchronously
    and you get the OLD colour and a clean bill of health for text that is
    in fact invisible. Wait for a real frame. */
 function frame(){return new Promise(function(res){
   var done=false, fin=function(){if(!done){done=true;res();}};
   requestAnimationFrame(function(){requestAnimationFrame(fin);});
   setTimeout(fin,150);   /* background tabs never fire rAF */
 });}

 var hadDark=document.body.classList.contains('dark-bg');
 var canDark=/dark-bg/.test(document.documentElement.innerHTML.slice(0,400000));
 if(canDark && !hadDark){
  document.body.classList.add('dark-bg');
  await frame();
  if(getComputedStyle(document.body).getPropertyValue('--txt').trim()){ measure('dark-bg'); }
  document.body.classList.remove('dark-bg');
  await frame();
 }

 if(revealStyle)revealStyle.remove();
 motionOff.remove();

 out.sort(function(a,b){return a.r-b.r;}); unk.sort(function(a,b){return a.r-b.r;});
 window.__cfails=out; window.__cphoto=unk;
 function fmt(list){var seen={},d=[];
  list.forEach(function(f){var k=f.th+'|'+f.p.split('>').pop()+'|'+f.c+'|'+f.b+'|'+f.o;
   if(!seen[k]){seen[k]=1;d.push(f);}else seen[k]++;});
  return d.map(function(f){var k=f.th+'|'+f.p.split('>').pop()+'|'+f.c+'|'+f.b+'|'+f.o;
   return ' ['+(f.th||'light').padEnd(7)+'] '+String(f.r).padStart(5)+'/'+f.n+' '+String(f.s).padStart(4)+'px op'+f.o+' x'+seen[k]+' '+
    f.p.split('>').pop().slice(0,26).padEnd(26)+' '+f.c.replace(/rgba?|[ ()]/g,'')+' on '+
    f.b.replace(/rgb|[ ()]/g,'')+' "'+f.t.slice(0,22)+'"';}).join('\\n');}
 return location.pathname+' ['+innerWidth+'] measured '+ck+' | FAIL '+out.length+
  ' | over-art '+unk.length+' | skipped '+JSON.stringify(skipped)+
  '\\n--- MEASURED FAILURES ---\\n'+fmt(out)+
  (unk.length?'\\n--- over artwork (eyeball) ---\\n'+fmt(unk):'');
})()`;

module.exports = { PROBE_SRC };
