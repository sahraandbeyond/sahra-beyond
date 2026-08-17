const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('fs');
const errs=[];const vc=new VirtualConsole();
vc.on('jsdomError',e=>errs.push(e.message.split('\n')[0]));
const dom=new JSDOM(fs.readFileSync(process.argv[2],'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.ae/',virtualConsole:vc,
 beforeParse(w){w.matchMedia=q=>({matches:false,media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
  w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
  w.IntersectionObserver=class{constructor(cb){this.cb=cb}observe(){}unobserve(){}disconnect(){}};
  w.scrollTo=()=>{};}});
setTimeout(()=>{
 const d=dom.window.document;
 console.log('skyfield present  :', !!d.getElementById('skyfield'));
 console.log('canvas in skyfield:', !!d.querySelector('#skyfield #hero-canvas'));
 console.log('dunes in skyfield :', d.querySelectorAll('#skyfield .dune').length);
 console.log('dust canvas       :', !!d.getElementById('dust'));
 console.log('__skyProgress     :', typeof dom.window.__skyProgress);
 console.log('hero still has sky:', !!d.querySelector('.hero .sky'));
 const real=errs.filter(e=>!/getContext|fetch is not defined|Not implemented|WebGL/i.test(e));
 console.log('real JS errors    :', real.length? real.join(' | ') : 'none');
 dom.window.close();
},800);
