/* IndexNow ping (Bing, Yandex, Seznam, Naver). 1 Oct 2026.
   The key file /768d99bb07dc11484cba9d95de8d7916.txt sits at the site root; it proves we own the domain.
   Usage after a push has deployed:  node indexnow.js /locations/jebel-jais/ /hiking/
   With no arguments it submits every URL in sitemap.xml. */
const fs = require('fs'), https = require('https');
const KEY = '768d99bb07dc11484cba9d95de8d7916', HOST = 'www.sahraandbeyond.ae';
let urls = process.argv.slice(2).map(u => u.startsWith('http') ? u : 'https://' + HOST + u);
if (!urls.length) urls = [...fs.readFileSync(__dirname + '/sitemap.xml', 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const body = JSON.stringify({ host: HOST, key: KEY, keyLocation: 'https://' + HOST + '/' + KEY + '.txt', urlList: urls });
const req = https.request({ hostname: 'api.indexnow.org', path: '/indexnow', method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) } },
  res => { console.log('IndexNow: HTTP ' + res.statusCode + ' for ' + urls.length + ' URLs'); res.resume(); });
req.on('error', e => console.error('IndexNow failed:', e.message));
req.end(body);
