// Sahra & Beyond — email capture -> Shopify customer with marketing consent
// -----------------------------------------------------------------------
// Replaces the Kit (ConvertKit) capture. Everything that takes an email on the
// site now posts here: the AED 50 welcome modal and every [data-waitlist] form.
//
// Why server-side: the Storefront API has no way to subscribe someone to
// marketing without creating a password-backed account, so consent has to be
// written with the Admin API, and an admin token can never sit in the browser.
//
// REQUIRED env vars in Vercel (Settings > Environment Variables):
//   SHOPIFY_STORE_DOMAIN    tqcc1v-w4.myshopify.com     (no https://, no slash)
//                           NOT sahra-beyond.myshopify.com. 'sahra-beyond' is only the
//                           ADMIN URL handle (admin.shopify.com/store/sahra-beyond);
//                           shop { myshopifyDomain } returns tqcc1v-w4.myshopify.com,
//                           and the OAuth token endpoint matches on that exact subdomain
//                           - a mismatch returns shop_not_permitted.
//   SHOPIFY_CLIENT_ID       Client ID of the Dev Dashboard app
//   SHOPIFY_CLIENT_SECRET   Client secret of that app. KEEP SECRET, never commit.
// OPTIONAL:
//   SHOPIFY_ADMIN_TOKEN     Legacy path. A static Admin API token from an
//                           admin-created custom app. If set it is used as-is and
//                           no token exchange happens. Shopify no longer lets you
//                           CREATE these, so this only covers an existing one.
//   WELCOME_CODE            discount code to hand back (default GOBEYOND50)
//
// Why a client id/secret and not a token (20 Sep 2026): Shopify has retired
// admin-created custom apps - Settings > Apps > App development now only offers
// the Dev Dashboard, and a Dev Dashboard app is not issued a permanent Admin API
// token at all. It gets a client id and secret, and the app exchanges those for
// an access token that expires after 24 hours (expires_in is always 86399).
// Pasting a token into an env var would therefore have worked for one day and
// then failed silently for good. getAccessToken() does the exchange and caches
// the result in module scope, so a warm function reuses one token for a day.
//
// NOTE: the client credentials grant only works when the app and the store are in
// the SAME Shopify organization. If the logs show `shop_not_permitted`, the store
// is not in the org the app was created under - see the Dev Dashboard's Stores
// list. That is a Shopify-side fix, not a code one.
//
// Consent recorded as SINGLE_OPT_IN with a server timestamp: the visitor typed
// their address and submitted it to get the code, which is the explicit,
// specific act UAE PDPL asks for. If you ever want a confirmation step, switch
// marketingState to PENDING and send a confirm email — CONFIRMED_OPT_IN here
// without that email would be a false record.
//
// Fails soft on purpose: if the env vars are missing or Shopify errors, the
// response still carries the code so the offer never breaks in front of a
// customer. `stored:false` in the payload is the signal that consent was NOT
// written — watch it in the Vercel logs.

/* 2026-07 is the latest SUPPORTED version. 2026-10 exists but publicApiVersions
   reports it as the release candidate with supported:false - callable today, but
   unstable by definition and free to change under us. In an endpoint that fails
   soft, a version that breaks does not raise anything a customer or we would see:
   it just returns stored:false and the address is gone. Pin to stable. */
const API_VERSION = '2026-07';
const DEFAULT_CODE = 'GOBEYOND50';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

/* Tokens live 24h. Cache in module scope: Vercel reuses a warm container across
   invocations, so most requests spend no round trip getting one. Refreshed a
   little early so a token cannot expire mid-request. */
let cachedToken = null;   /* { value, expiresAt } */
const TOKEN_SKEW_MS = 5 * 60 * 1000;

async function getAccessToken(domain) {
  /* Legacy static token wins if present - nothing to exchange. */
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN;

  const id = process.env.SHOPIFY_CLIENT_ID;
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!id || !secret) return null;

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - TOKEN_SKEW_MS > now) return cachedToken.value;

  const r = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: id, client_secret: secret, grant_type: 'client_credentials' })
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body.access_token) {
    /* body.error carries Shopify's reason, e.g. shop_not_permitted. Never log
       the secret, and there is no address in scope here to leak. */
    throw new Error('token_http_' + r.status + (body && body.error ? ':' + body.error : ''));
  }
  const ttlMs = (Number(body.expires_in) || 86399) * 1000;
  cachedToken = { value: body.access_token, expiresAt: now + ttlMs };
  return cachedToken.value;
}

function shopify(domain, token, query, variables) {
  return fetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables })
  }).then(async (r) => {
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('shopify_http_' + r.status);
    if (body.errors) throw new Error('shopify_graphql: ' + JSON.stringify(body.errors).slice(0, 300));
    return body.data;
  });
}

const FIND = `query Find($q: String!) {
  customers(first: 1, query: $q) { edges { node { id tags emailMarketingConsent { marketingState } } } }
}`;

const CREATE = `mutation Create($input: CustomerInput!) {
  customerCreate(input: $input) { customer { id } userErrors { field message } }
}`;

const CONSENT = `mutation Consent($input: CustomerEmailMarketingConsentUpdateInput!) {
  customerEmailMarketingConsentUpdate(input: $input) {
    customer { id } userErrors { field message }
  }
}`;

const ADD_TAGS = `mutation AddTags($id: ID!, $tags: [String!]!) {
  tagsAdd(id: $id, tags: $tags) { userErrors { field message } }
}`;

/* Shopify's search syntax treats these as operators; an address containing one
   would otherwise silently match the wrong customer or nothing at all. */
function escapeQuery(v) { return String(v).replace(/(["\\:()])/g, '\\$1'); }

function cleanSource(v) {
  return String(v || 'site').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24) || 'site';
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') { res.setHeader('Allow', 'POST'); return res.status(204).end(); }
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, reason: 'method' }); }

  const CODE = process.env.WELCOME_CODE || DEFAULT_CODE;

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const email = String(body.email || '').trim().toLowerCase();
  const source = cleanSource(body.source);

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ ok: false, reason: 'email' });
  }

  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const hasCreds = !!process.env.SHOPIFY_ADMIN_TOKEN ||
                   (!!process.env.SHOPIFY_CLIENT_ID && !!process.env.SHOPIFY_CLIENT_SECRET);
  if (!domain || !hasCreds) {
    console.error('[subscribe] not configured - need SHOPIFY_STORE_DOMAIN plus either ' +
                  'SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET or a legacy SHOPIFY_ADMIN_TOKEN. ' +
                  'Consent NOT stored.');
    return res.status(200).json({ ok: true, stored: false, reason: 'not_configured', code: CODE });
  }

  const tags = ['site-signup', 'welcome-50', 'src-' + source];
  const consent = {
    marketingState: 'SUBSCRIBED',
    marketingOptInLevel: 'SINGLE_OPT_IN',
    consentUpdatedAt: new Date().toISOString()
  };

  /* One pass over Shopify with a given token. Pulled out of the handler so a 401
     - a token revoked or rotated before its 24h was up - can be retried once with
     a fresh one instead of silently dropping the address. */
  async function store(token) {
    const found = await shopify(domain, token, FIND, { q: `email:"${escapeQuery(email)}"` });
    const node = found && found.customers && found.customers.edges[0] && found.customers.edges[0].node;

    if (node) {
      /* Already a customer — most likely someone who has bought before. Update
         consent rather than creating a duplicate, and keep their existing tags
         (customerUpdate's `tags` REPLACES, tagsAdd appends). */
      const up = await shopify(domain, token, CONSENT, {
        input: { customerId: node.id, emailMarketingConsent: consent }
      });
      const errs = up.customerEmailMarketingConsentUpdate.userErrors;
      if (errs && errs.length) throw new Error('consent: ' + errs[0].message);
      await shopify(domain, token, ADD_TAGS, { id: node.id, tags }).catch(() => {});
      return res.status(200).json({ ok: true, stored: true, created: false, code: CODE });
    }

    const made = await shopify(domain, token, CREATE, {
      input: { email: email, tags: tags, emailMarketingConsent: consent }
    });
    const cErrs = made.customerCreate.userErrors;
    if (cErrs && cErrs.length) {
      /* A race, or an address Shopify holds in a state the search missed.
         Taken already is not a failure from the visitor's point of view. */
      const msg = cErrs[0].message || '';
      if (/taken|already/i.test(msg)) return res.status(200).json({ ok: true, stored: true, created: false, code: CODE });
      throw new Error('create: ' + msg);
    }
    return res.status(200).json({ ok: true, stored: true, created: true, code: CODE });
  }

  try {
    let token = await getAccessToken(domain);
    if (!token) throw new Error('no_token');
    try {
      return await store(token);
    } catch (err) {
      if (!/shopify_http_401/.test(err && err.message ? err.message : '')) throw err;
      cachedToken = null;                       /* force a fresh exchange */
      token = await getAccessToken(domain);
      if (!token) throw err;
      return await store(token);
    }
  } catch (err) {
    /* Never echo the address back into logs. */
    const msg = err && err.message ? err.message : String(err);
    console.error('[subscribe] failed:', msg, '- consent NOT stored');
    const reason = /^token_http_/.test(msg) ? 'auth_failed' : 'shopify_error';
    return res.status(200).json({ ok: true, stored: false, reason: reason, code: CODE });
  }
};
