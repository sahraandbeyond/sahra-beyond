/* Exercise api/subscribe.js against a stubbed Shopify: no network, no store writes.
   Run with `node subscribe-test.js`. Covers the client-credentials exchange, the
   legacy static-token path, shop_not_permitted, a mid-flight 401 retry, and that a
   warm container reuses one 24h token instead of exchanging per request. */
const path = require('path');
function freshHandler() { delete require.cache[require.resolve('./api/subscribe.js')]; return require('./api/subscribe.js'); }
function mkRes() {
  const r = { _s: 0, _j: null, headers: {} };
  r.setHeader = (k,v)=>{r.headers[k]=v;};
  r.status = (c)=>{r._s=c; return r;};
  r.json = (o)=>{r._j=o; return r;};
  r.end = ()=>r;
  return r;
}
const calls = [];
function stub(plan) {
  global.fetch = async (url, opt) => {
    const body = opt && opt.body ? JSON.parse(opt.body) : {};
    if (String(url).includes('/admin/oauth/access_token')) {
      calls.push('TOKEN');
      const t = plan.token.shift();
      return { ok: t.ok, status: t.status, json: async () => t.body };
    }
    calls.push('GQL:' + (body.query||'').trim().split(/[\s(]/)[1]);
    const g = plan.gql.shift();
    return { ok: g.ok, status: g.status, json: async () => g.body };
  };
}
const OK_TOKEN = { ok:true, status:200, body:{ access_token:'shpat_TEST', scope:'write_customers', expires_in:86399 } };
const NO_CUST  = { ok:true, status:200, body:{ data:{ customers:{ edges:[] } } } };
const CREATED  = { ok:true, status:200, body:{ data:{ customerCreate:{ customer:{id:'gid://x/1'}, userErrors:[] } } } };
const UNAUTH   = { ok:false, status:401, body:{ errors:'Unauthorized' } };

async function run(name, env, plan, expect, email) {
  calls.length = 0;
  for (const k of ['SHOPIFY_STORE_DOMAIN','SHOPIFY_CLIENT_ID','SHOPIFY_CLIENT_SECRET','SHOPIFY_ADMIN_TOKEN']) delete process.env[k];
  Object.assign(process.env, env);
  stub(plan);
  const h = freshHandler();
  const res = mkRes();
  await h({ method:'POST', body:{ email: email || 'x@example.com', source:'welcome-bar' } }, res);
  const got = { stored: res._j.stored, reason: res._j.reason, code: res._j.code, calls: calls.join(' ') };
  const pass = Object.entries(expect).every(([k,v]) => String(got[k]) === String(v));
  console.log((pass?'PASS':'FAIL').padEnd(5), name.padEnd(34), JSON.stringify(got));
  if (!pass) { console.log('      expected', JSON.stringify(expect)); process.exitCode = 1; }
}

(async () => {
  await run('nothing configured', {}, {token:[],gql:[]},
    { stored:false, reason:'not_configured', code:'GOBEYOND50', calls:'' });

  await run('domain only, no creds', {SHOPIFY_STORE_DOMAIN:'s.myshopify.com'}, {token:[],gql:[]},
    { stored:false, reason:'not_configured', calls:'' });

  await run('client credentials, new customer',
    {SHOPIFY_STORE_DOMAIN:'s.myshopify.com', SHOPIFY_CLIENT_ID:'id', SHOPIFY_CLIENT_SECRET:'sec'},
    {token:[OK_TOKEN], gql:[NO_CUST, CREATED]},
    { stored:true, calls:'TOKEN GQL:Find GQL:Create' });

  await run('legacy static token skips exchange',
    {SHOPIFY_STORE_DOMAIN:'s.myshopify.com', SHOPIFY_ADMIN_TOKEN:'shpat_legacy'},
    {token:[], gql:[NO_CUST, CREATED]},
    { stored:true, calls:'GQL:Find GQL:Create' });

  await run('shop_not_permitted -> auth_failed',
    {SHOPIFY_STORE_DOMAIN:'s.myshopify.com', SHOPIFY_CLIENT_ID:'id', SHOPIFY_CLIENT_SECRET:'sec'},
    {token:[{ok:false,status:401,body:{error:'shop_not_permitted'}}], gql:[]},
    { stored:false, reason:'auth_failed', code:'GOBEYOND50', calls:'TOKEN' });

  await run('401 mid-flight retries once with fresh token',
    {SHOPIFY_STORE_DOMAIN:'s.myshopify.com', SHOPIFY_CLIENT_ID:'id', SHOPIFY_CLIENT_SECRET:'sec'},
    {token:[OK_TOKEN, OK_TOKEN], gql:[UNAUTH, NO_CUST, CREATED]},
    { stored:true, calls:'TOKEN GQL:Find TOKEN GQL:Find GQL:Create' });

  await run('bad email rejected before any call',
    {SHOPIFY_STORE_DOMAIN:'s.myshopify.com', SHOPIFY_CLIENT_ID:'id', SHOPIFY_CLIENT_SECRET:'sec'},
    {token:[], gql:[]}, { calls:'' }, 'not-an-email');

  /* the 24h token is cached in module scope - a warm container must not
     re-exchange on every request */
  calls.length = 0;
  for (const k of ['SHOPIFY_ADMIN_TOKEN']) delete process.env[k];
  Object.assign(process.env, {SHOPIFY_STORE_DOMAIN:'s.myshopify.com', SHOPIFY_CLIENT_ID:'id', SHOPIFY_CLIENT_SECRET:'sec'});
  stub({ token:[OK_TOKEN], gql:[NO_CUST, CREATED, NO_CUST, CREATED] });
  const warm = freshHandler();
  const r1 = mkRes(), r2 = mkRes();
  await warm({ method:'POST', body:{ email:'a@example.com' } }, r1);
  await warm({ method:'POST', body:{ email:'b@example.com' } }, r2);
  const tokenCalls = calls.filter(c => c === 'TOKEN').length;
  const ok = tokenCalls === 1 && r1._j.stored && r2._j.stored;
  console.log((ok?'PASS':'FAIL').padEnd(5), 'warm container reuses one token'.padEnd(34),
              JSON.stringify({ tokenExchanges: tokenCalls, both: !!(r1._j.stored && r2._j.stored) }));
  if (!ok) process.exitCode = 1;
})();
