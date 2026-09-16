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
//   SHOPIFY_STORE_DOMAIN  sahra-beyond.myshopify.com   (no https://, no slash)
//   SHOPIFY_ADMIN_TOKEN   Admin API access token from a custom app with the
//                         write_customers scope. KEEP SECRET. Never commit it.
// OPTIONAL:
//   WELCOME_CODE          discount code to hand back (default GOBEYOND50)
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

const API_VERSION = '2026-10';
const DEFAULT_CODE = 'GOBEYOND50';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

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
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!domain || !token) {
    console.error('[subscribe] SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_TOKEN not set - consent NOT stored');
    return res.status(200).json({ ok: true, stored: false, reason: 'not_configured', code: CODE });
  }

  const tags = ['site-signup', 'welcome-50', 'src-' + source];
  const consent = {
    marketingState: 'SUBSCRIBED',
    marketingOptInLevel: 'SINGLE_OPT_IN',
    consentUpdatedAt: new Date().toISOString()
  };

  try {
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
  } catch (err) {
    /* Never echo the address back into logs. */
    console.error('[subscribe] failed:', err && err.message ? err.message : err);
    return res.status(200).json({ ok: true, stored: false, reason: 'shopify_error', code: CODE });
  }
};
