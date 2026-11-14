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
const SITE_BUILD = 'r127';   /* 11 Nov 2026: site_build and ad_session are now really sent (see track and config below) */
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
/* 29 Oct 2026 (site speed handover): the tag libraries (gtag 190 KB, Meta 270 KB, TikTok 150 KB) were fetched
   while the first screen was still loading on a phone. Their queues (dataLayer, fbq, ttq) exist from the first
   line as before; only the download of the libraries waits for sbLater: the visitor's first touch, scroll or
   key, or the page's load event plus an idle moment (at most 2.5 s), or 8 s, whichever comes first. The cost:
   a visitor who leaves within about 3 s without touching the page is no longer seen by GA4 or TikTok (Meta
   still gets its server-side copy through /api/meta-capi). */
/* 13 Nov 2026 (Faheem, after Claude's test runs on a local copy showed up as adds in Analytics): the tag libraries
   (GA4, Meta, TikTok) load only on the real site, www.sahraandbeyond.ae. Local copies, test runs and Vercel previews
   queue events and never send them. */
const LATER = `window.SB_LIVE=/(^|\\.)sahraandbeyond\\.ae$/i.test(location.hostname);
  window.sbLater=window.sbLater||(window.SB_LIVE?0:function(){})||(function(){var q=[],ran=0;function run(){if(ran)return;ran=1;for(var i=0;i<q.length;i++){try{q[i]()}catch(e){}}q=null;}
    function idle(){(window.requestIdleCallback||function(f){setTimeout(f,1200)})(run,{timeout:2500});}
    if(document.readyState==='complete')idle();else addEventListener('load',idle);setTimeout(run,8000);
    ['pointerdown','touchstart','keydown'].forEach(function(k){addEventListener(k,run,{once:true,passive:true,capture:true});});addEventListener('scroll',run,{once:true,passive:true});
    return function(f){if(ran){try{f()}catch(e){}}else q.push(f);};})();
  sbLater(function(){var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=${GA4_ID}';document.head.appendChild(s);});`;
/* 3 Nov 2026: the product catalogue for analytics, {handle: [name, category, line, fit, full price]}, read from the
   product files at build time (Founding Edition: content/products; Sahel and Sahra Trail: preorder-page.js). */
const CATALOG = (function () {
  const out = {};
  const KIND = k => /T-shirt/i.test(k) ? 'T-shirt' : /polo/i.test(k) ? 'Polo' : /hoodie/i.test(k) ? 'Hoodie' : /short/i.test(k) ? 'Shorts' : /kit/i.test(k) ? 'Running kit' : /bag/i.test(k) ? 'Bag' : (k || 'Other');
  try {
    const fs = require('fs'), path = require('path'), dir = path.join(__dirname, 'content', 'products');
    fs.readdirSync(dir).filter(f => f.endsWith('.json')).forEach(f => {
      const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const polo = /polo/.test(p.category || '');
      out[p.id] = [p.name, polo ? 'Polo' : 'T-shirt', 'Founding Edition', polo ? '' : (p.fit ? p.fit[0].toUpperCase() + p.fit.slice(1) : ''), Number(p.price)];
    });
  } catch (e) {}
  try {
    require('./preorder-page.js').products().forEach(p => {
      out[p.handle] = [String(p.plain || p.name).replace(/&amp;/g, '&'), KIND(p.kind), p.line === 'sahel' ? 'Sahel' : 'Sahra Trail', p.fit || '', Number(p.price)];
    });
  } catch (e) {}
  out['sahra-tote'] = ['The Sahra Tote', 'Bag', 'Accessories', '', 50];
  out['sahra-tote-founding-edition-gift'] = ['The Sahra Tote (free gift)', 'Bag', 'Accessories', '', 0];
  return out;
})();
const GA4_HEAD = `<!-- Google Analytics 4 -->
<script>
  ${LATER}
  window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
  ${/* 3 Nov 2026 (Faheem: "currently it says add to cart but we don't know which item was added"): every e-commerce
     event (view_item, view_item_list, select_item, add_to_cart, remove_from_cart, view_cart, begin_checkout) carries GA4's
     standard items[] with the same complete item details wherever it fires: item_id (Shopify handle), item_name,
     item_brand, item_category (T-shirt, Polo, Hoodie, ...), item_category2 (line: Founding Edition, Sahel, Sahra Trail),
     item_category3 (fit), item_category4 (sale tier, e.g. "50% off" or "Full price"), item_variant (size), price paid,
     discount (AED off the full price), item_list_name (where it happened: specimen, shop, bag, ...), plus value and
     currency. CAT is built from the product files at build time (below). */''}window.SB_CAT=${JSON.stringify(CATALOG).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))};
  window.SB_PAGE=function(){var s=location.pathname.split('/').filter(Boolean),ar=s[0]==='ar';if(ar)s.shift();var a=s[0]||'',b=document.body;
    var t=!a?'home':a==='shop'?'shop':a==='products'?'product':((a==='trail'&&s[1]==='hikes')||a==='hiking')?'hikes':(a==='sahel'||a==='trail'||a==='new')?'range':(a==='locations'||a==='places')?'place':a==='journal'?'journal':a==='feed'?'instagram':(b&&(' '+b.className+' ').indexOf(' ls-page ')>=0)?'category':document.getElementById('gbar')?'guide':'other';
    return{type:t,lang:ar?'ar':'en',product:a==='products'?(s[1]||''):''};};
  ${/* a card's place among the cards showing in its grid, counted from 1 (a design with two fits is one place) */''}window.SB_POS=function(card){try{var g=card.closest('.pcards')||card.parentNode,seen=[],n=0,me=card.closest('.sfp')||card,cs=g.querySelectorAll('.pcard[data-handle],.card[data-handle],a.card');
    for(var i=0;i<cs.length;i++){var s=cs[i].closest('.sfp')||cs[i];if(seen.indexOf(s)>=0)continue;seen.push(s);if(!s.offsetParent)continue;n++;if(s===me)return n;}}catch(e){}return 0;};
  window.SB_PLACE={specimen:'Product page','specimen-bar':'Product page bar',pdp:'Product page','product-page':'Product page',card:'Product card',shop:'Shop page',bag:'Bag','second-tee':'Bag suggestion','cart-trail-bag':'Bag suggestion','guide-bar':'Guide page bar','tote-page':'Tote page',home:'Homepage card','journey-grid-quick-add':'Homepage card','journey-ring-quick-add':'Homepage ring','journey-place-quick-add':'Homepage place card','journey-place-card':'Homepage place card','hero-ring':'Homepage ring',related:'Related products',menu:'Menu',instagram:'Instagram block',link:'Text link'};
  window.track=window.track||function(n,p){try{p=p||{};var C=window.SB_CAT||{};
    var ec=/^(view_item|view_item_list|select_item|add_to_cart|remove_from_cart|view_cart|begin_checkout|add_to_wishlist)$/.test(n);
    if(ec){
      if(!p.items){var id=p.item_id||p.item||p.item_name;if(id){var it={item_id:p.item_id||p.item||'',item_name:p.item_name||'',quantity:Number(p.quantity||1)};if(p.size)it.item_variant=String(p.size);if(p.price)it.price=Number(p.price);if(p.position!=null)it.index=Number(p.position);p.items=[it];}}
      if(p.items&&p.items.length){var tot=0,lst=p.via||p.source||p.from||p.item_list_name;
        p.items=p.items.map(function(o,i){o=o||{};var h=o.item_id;
          if(!C[h]&&o.item_name){for(var k in C){if(C[k][0]===o.item_name){h=k;break;}}}
          var c=C[h];if(c){o.item_id=h;o.item_name=c[0];o.item_category=c[1];o.item_category2=c[2];if(c[3])o.item_category3=c[3];
            var pay=c[4];try{var S=window.SB_SALE;if(S&&S.on()&&S.prices&&S.prices[h])pay=S.prices[h][1];}catch(x){}
            if(!o.price)o.price=pay;var off=Math.round((c[4]-Number(o.price))*100)/100;if(off>0.009){o.discount=off;o.item_category4=Math.round(off/c[4]*100)+'% off';}else o.item_category4='Full price';}
          o.item_brand='Sahra & Beyond';if(o.quantity==null)o.quantity=1;if(o.index==null)o.index=i+1;if(lst&&!o.item_list_name)o.item_list_name=String(lst);
          tot+=(Number(o.price)||0)*(Number(o.quantity)||1);return o;});
        p.currency=p.currency||'AED';if(p.value==null&&tot)p.value=Math.round(tot*100)/100;}
    }
    ${/* 11 Nov 2026 (Faheem: "How can I see which product size select is done? Which product is added to cart? ... much more
     structured data"): every event that concerns one product carries the same fields, whatever sent it and whatever it
     named them: product (name), product_design (name without the fit), product_id (Shopify handle), product_line,
     product_category, fit, size. An event with no product of its own, sent on a product page, takes that page's product (not the top bar, menu or header events).
     Every event also carries page_type, site_lang and, where the sender said where it happened (via / source / from),
     placement in plain words. The older fields (via, source, from, item_id) are still sent, so reports built on them keep working. */''}var pg=window.SB_PAGE(),one=p.items&&p.items.length===1?p.items[0]:null;
    var h=p.item_id||p.item||(one&&one.item_id)||'';if(!C[h]&&!p.items&&C[pg.product]&&!/^(view_promotion|select_promotion|menu_|header_|language_switch)/.test(n))h=pg.product;
    var c=C[h];if(c){p.product=c[0];p.product_design=c[0].split(' \\u2014 ')[0];p.product_id=h;p.product_category=c[1];p.product_line=c[2];
      if(c[3]&&(!p.fit||n==='fit_switch'||n==='select_fit'))p.fit=c[3];}
    if(typeof p.fit==='string'&&p.fit)p.fit=p.fit.charAt(0).toUpperCase()+p.fit.slice(1);
    if(p.size==null&&one&&one.item_variant)p.size=String(one.item_variant);
    var w=p.via||p.source||(p.from&&!C[p.from]?p.from:'');if(w&&!p.placement)p.placement=window.SB_PLACE[w]||String(w);
    p.page_type=pg.type;p.site_lang=pg.lang;
    ${/* 11 Nov 2026: gtag('set', ...) in the attention block never put site_build or ad_session on the events (checked on the live
       site: the requests to Google carried neither), so the Site build and Ad session fields registered on 3 Nov stayed empty.
       They are now written onto every event here, and onto the automatic page_view through the config call below. */''}p.site_build='${SITE_BUILD}';p.ad_session=window.SB_AD?1:0;
    gtag('event',n,p);}catch(e){}};
  ${ATTENTION}
  ${/* 10 Nov 2026: links and buttons across the site carry data-track="name", but nothing read it, so those clicks never
     reached GA4 (found while assessing the homepage place stories: no click data existed). One listener sends each as a GA4
     event named by the attribute, with the link it leads to. Sent by beacon so a click that leaves the page still counts. */''}document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('[data-track]');if(!a)return;var n=String(a.getAttribute('data-track')||'').replace(/[^a-zA-Z0-9_]/g,'_').slice(0,40);if(/^[a-zA-Z]/.test(n)&&window.track)window.track(n,{link_url:a.getAttribute('href')||'',transport_type:'beacon'});},true);
  gtag('js',new Date());gtag('config','${GA4_ID}',{site_build:'${SITE_BUILD}',ad_session:window.SB_AD?1:0});
  var _app=(document.referrer||'').indexOf('android-app://')===0||/[?&]platform=android/i.test(location.search);
  gtag('set','user_properties',{platform:_app?'app':'web'});
</script>
${/* Vercel Speed Insights is on (real-visitor LCP and INP). Web Analytics answers 404 until it is
     switched on in the Vercel dashboard (Analytics tab, Enable); the tag then starts counting
     with no further change, including visits that leave before GA4 has loaded. */''}<script defer src="/_vercel/insights/script.js"></script>
<script defer src="/_vercel/speed-insights/script.js"></script>`;
module.exports = { GA4_ID, GA4_HEAD, CLARITY_ID };
