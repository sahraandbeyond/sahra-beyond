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
const calls = [], vars = [];
function stub(plan) {
  global.fetch = async (url, opt) => {
    const body = opt && opt.body ? JSON.parse(opt.body) : {};
    if (String(url).includes('/admin/oauth/access_token')) {
      calls.push('TOKEN');
      const t = plan.token.shift();
      return { ok: t.ok, status: t.status, json: async () => t.body };
    }
    calls.push('GQL:' + (body.query||'').trim().split(/[\s(]/)[1]);
    vars.push(body.variables || {});
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
    { stored:false, reason:'not_configured', code:'undefined', calls:'' });

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
    { stored:false, reason:'auth_failed', code:'undefined', calls:'TOKEN' });

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
  /* 13 Nov 2026: the welcome code. A first-time sign-up earns welcome-code and welcome-code-sent; a buyer, or someone who
     already had the code, earns neither; a sold-out size sign-up carries bis-<handle>-<size>. */
  async function tagsFor(name, found, body, expect) {
    calls.length = 0; vars.length = 0;
    for (const k of ['SHOPIFY_ADMIN_TOKEN','SHOPIFY_CLIENT_ID','SHOPIFY_CLIENT_SECRET']) delete process.env[k];
    Object.assign(process.env, {SHOPIFY_STORE_DOMAIN:'s.myshopify.com', SHOPIFY_ADMIN_TOKEN:'shpat_legacy'});
    const FOUND = found ? { ok:true, status:200, body:{ data:{ customers:{ edges:[{ node: found }] } } } } : NO_CUST;
    const CONSENTED = { ok:true, status:200, body:{ data:{ customerEmailMarketingConsentUpdate:{ customer:{id:'gid://x/2'}, userErrors:[] } } } };
    const TAGGED = { ok:true, status:200, body:{ data:{ tagsAdd:{ userErrors:[] } } } };
    stub({ token:[], gql: found ? [FOUND, CONSENTED, TAGGED] : [FOUND, CREATED] });
    const res = mkRes();
    await freshHandler()({ method:'POST', body }, res);
    const v = vars[vars.length - 1] || {};
    const tags = (v.tags || (v.input && v.input.tags) || []).join(',');
    const got = { welcome: res._j.welcome, tags };
    const pass = String(got.welcome) === String(expect.welcome) && expect.has.every(t => tags.split(',').includes(t)) && (expect.not || []).every(t => !tags.split(',').includes(t));
    console.log((pass?'PASS':'FAIL').padEnd(5), name.padEnd(34), JSON.stringify(got));
    if (!pass) { console.log('      expected', JSON.stringify(expect)); process.exitCode = 1; }
  }
  await tagsFor('welcome: new customer', null, { email:'n@example.com', source:'sheet' },
    { welcome:true, has:['site-signup','src-sheet','welcome-code','welcome-code-sent'] });
  await tagsFor('welcome: no orders yet (abandoned)', { id:'gid://x/2', tags:[], numberOfOrders:'0' }, { email:'a@example.com', source:'pdp' },
    { welcome:true, has:['welcome-code','welcome-code-sent'] });
  await tagsFor('welcome: a buyer gets none', { id:'gid://x/2', tags:[], numberOfOrders:'2' }, { email:'b@example.com', source:'pdp' },
    { welcome:false, has:['site-signup'], not:['welcome-code','welcome-code-sent'] });
  await tagsFor('welcome: never twice (told: sent)', { id:'gid://x/2', tags:['welcome-code-sent'], numberOfOrders:'0' }, { email:'c@example.com', source:'sheet' },
    { welcome:'sent', has:['site-signup'], not:['welcome-code'] });
  await tagsFor('back in stock: piece and size', null, { email:'d@example.com', source:'bis', fields:{ piece:'al-quaa-galaxy-oversized', size:'M' } },
    { welcome:true, has:['src-bis','bis-al-quaa-galaxy-oversized-m','f-piece-al-quaa-galaxy-oversized','f-size-m'] });
  await tagsFor('back in stock: fit back soon', null, { email:'e@example.com', source:'bis', fields:{ piece:'ras-al-khor-hoodie-oversized' } },
    { welcome:true, has:['bis-ras-al-khor-hoodie-oversized'] });
  await tagsFor('back in stock: unknown piece ignored', null, { email:'f@example.com', source:'bis', fields:{ piece:'not-a-piece', size:'m' } },
    { welcome:true, has:['src-bis'], not:['bis-not-a-piece-m'] });
  /* a welcome tag that fails to write is a failed sign-up (no code email would go out), so the visitor is asked to retry */
  {
    calls.length = 0; vars.length = 0;
    Object.assign(process.env, {SHOPIFY_STORE_DOMAIN:'s.myshopify.com', SHOPIFY_ADMIN_TOKEN:'shpat_legacy'});
    const FOUND = { ok:true, status:200, body:{ data:{ customers:{ edges:[{ node:{ id:'gid://x/9', tags:[], numberOfOrders:'0' } }] } } } };
    const CONSENTED = { ok:true, status:200, body:{ data:{ customerEmailMarketingConsentUpdate:{ customer:{id:'gid://x/9'}, userErrors:[] } } } };
    const TAGFAIL = { ok:true, status:200, body:{ data:{ tagsAdd:{ userErrors:[{ field:'tags', message:'nope' }] } } } };
    stub({ token:[], gql:[FOUND, CONSENTED, TAGFAIL] });
    const res = mkRes(); await freshHandler()({ method:'POST', body:{ email:'g@example.com', source:'sheet' } }, res);
    const ok = res._j.stored === false;
    console.log((ok?'PASS':'FAIL').padEnd(5), 'welcome tag not written: not stored'.padEnd(34), JSON.stringify({ stored: res._j.stored }));
    if (!ok) process.exitCode = 1;
  }
  /* Shopify refusing numberOfOrders falls back to the plain search */
  {
    calls.length = 0; vars.length = 0;
    const GQLERR = { ok:true, status:200, body:{ errors:[{ message:"Field 'numberOfOrders' doesn't exist" }] } };
    stub({ token:[], gql:[GQLERR, NO_CUST, CREATED] });
    const res = mkRes(); await freshHandler()({ method:'POST', body:{ email:'h@example.com', source:'sheet' } }, res);
    const ok = res._j.stored === true && res._j.welcome === true;
    console.log((ok?'PASS':'FAIL').padEnd(5), 'numberOfOrders refused: fallback'.padEnd(34), JSON.stringify({ stored: res._j.stored, welcome: res._j.welcome, calls: calls.join(' ') }));
    if (!ok) process.exitCode = 1;
  }
})();
