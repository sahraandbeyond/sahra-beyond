/* Google Analytics 4: the one copy of the tag (9 Oct 2026, shop analytics handover).
   shell() in build.js, the product pages (build-products.js) and /shop/ (built from
   shop-preview.html) all take it from here, so the copies cannot drift. /shop/ had
   no GA4 at all before this, because its template never went through shell(). */
const GA4_ID = 'G-5NVFDWT29F';
/* 13 Oct 2026 (retention audit). Microsoft Clarity project ID: public, not a secret.
   Empty = Clarity is off. Faheem creates the project at clarity.microsoft.com and
   pastes the ID here; recordings then start for paid-ad arrivals only. */
const CLARITY_ID = '';
/* 13 Oct 2026: sent with every GA4 event (with ad_session), so a release can be compared with
   the one before it. Bump it with each site release that changes the landing experience. */
const SITE_BUILD = 'r80';
/* Runs in the head of every page, before anything else:
   - sb_ad: this session arrived from a paid ad (click IDs or utm tags on the landing
     URL). Kept for the session so the code bar and Clarity follow the visitor around.
   - first_interaction: how long after load the visitor first touched, scrolled or
     typed. GA4's own engagement needs 10 seconds, so a 4-second visit that did
     nothing and one that swiped twice looked the same.
   - visit_end (beacon, on leaving): time on page, deepest scroll, whether they touched
     at all - the 2-6 s leavers who never interact were invisible before.
   - every event carries ad_session and site_build.
   - Clarity, for ad arrivals only, with every form field masked. */
const ATTENTION = `(function(){var ad=0;try{ad=/[?&](gclid|gbraid|wbraid|fbclid|ttclid|utm_[a-z]+)=/i.test(location.search);if(ad)sessionStorage.setItem('sb_ad','1');ad=ad||sessionStorage.getItem('sb_ad')==='1';}catch(e){}
    window.SB_AD=!!ad;if(ad)document.documentElement.classList.add('sb-ad');
    gtag('set',{ad_session:ad?1:0,site_build:'${SITE_BUILD}'});
    var done=0,first=0;function fi(e){if(done)return;done=1;first=Math.round(performance.now());['pointerdown','keydown','scroll','touchstart'].forEach(function(k){removeEventListener(k,fi,true);});
      window.track('first_interaction',{ms:first,kind:e.type,ad:ad?1:0});}
    ['pointerdown','keydown','scroll','touchstart'].forEach(function(k){addEventListener(k,fi,{capture:true,passive:true});});
    var maxs=0;addEventListener('scroll',function(){var d=document.documentElement,m=d.scrollHeight-innerHeight;if(m>0)maxs=Math.max(maxs,Math.round(scrollY/m*100));},{passive:true});
    var sent=0;function ve(){if(sent)return;sent=1;window.track('visit_end',{ms:Math.round(performance.now()),max_scroll:maxs,touched:done?1:0,first_ms:first,ad:ad?1:0,transport_type:'beacon'});}
    addEventListener('pagehide',ve);document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')ve();else sent=0;});addEventListener('pageshow',function(e){if(e.persisted)sent=0;});
    var CID='${CLARITY_ID}';if(ad&&CID){document.addEventListener('DOMContentLoaded',function(){[].forEach.call(document.querySelectorAll('form,input,textarea,select,[contenteditable]'),function(x){x.setAttribute('data-clarity-mask','True');});});(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,'clarity','script',CID);}
  })();`;
const GA4_HEAD = `<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA4_ID}"></script>
<script>
  window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
  ${/* 25 Oct 2026 (retention audit): add_to_cart / view_item / remove_from_cart get GA4's standard items[], value and currency, so funnel reports work */''}window.track=window.track||function(n,p){try{p=p||{};var id=p.item_id||p.item_name;if((n==='view_item'||n==='add_to_cart'||n==='remove_from_cart')&&id&&!p.items){var el=p.item_id?document.querySelector('[data-handle="'+p.item_id+'"][data-aed]'):null,sp=(location.pathname.indexOf('/products/'+p.item_id)!==-1&&window.__SB_PRODUCT)||{};var pr=Number(p.price||(el&&el.getAttribute('data-aed'))||sp.price||0),q=Number(p.quantity||1);p.currency=p.currency||'AED';if(pr)p.value=pr*q;p.items=[{item_id:id,item_name:p.item_name||sp.name||id,item_variant:p.size||p.fit||undefined,price:pr||undefined,quantity:q}];}gtag('event',n,p);}catch(e){}};
  ${ATTENTION}
  gtag('js',new Date());gtag('config','${GA4_ID}');
  var _app=(document.referrer||'').indexOf('android-app://')===0||/[?&]platform=android/i.test(location.search);
  gtag('set','user_properties',{platform:_app?'app':'web'});
</script>
${/* Vercel Speed Insights is on (real-visitor LCP and INP). Web Analytics answers 404 until it is
     switched on in the Vercel dashboard (Analytics tab, Enable); the tag then starts counting
     with no further change, including visits that leave before GA4 has loaded. */''}<script defer src="/_vercel/insights/script.js"></script>
<script defer src="/_vercel/speed-insights/script.js"></script>`;
module.exports = { GA4_ID, GA4_HEAD, CLARITY_ID };
