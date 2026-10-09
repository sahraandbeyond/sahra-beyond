/* Google Analytics 4: the one copy of the tag (9 Oct 2026, shop analytics handover).
   shell() in build.js, the product pages (build-products.js) and /shop/ (built from
   shop-preview.html) all take it from here, so the copies cannot drift. /shop/ had
   no GA4 at all before this, because its template never went through shell(). */
const GA4_ID = 'G-5NVFDWT29F';
const GA4_HEAD = `<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA4_ID}"></script>
<script>
  window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
  gtag('js',new Date());gtag('config','${GA4_ID}');
  var _app=(document.referrer||'').indexOf('android-app://')===0||/[?&]platform=android/i.test(location.search);
  gtag('set','user_properties',{platform:_app?'app':'web'});
  window.track=window.track||function(n,p){try{gtag('event',n,p||{});}catch(e){}};
</script>`;
module.exports = { GA4_ID, GA4_HEAD };
