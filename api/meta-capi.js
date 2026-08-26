// Sahra & Beyond — Meta Conversions API relay
// -----------------------------------------------------------------------
// Receives events from /assets/meta-pixel.js and forwards them to Meta
// server-side. Browser events alone are lost to ad blockers, ITP and iOS —
// typically 20-40% of them. The server copy closes that gap.
//
// REQUIRED env vars in Vercel (Settings > Environment Variables):
//   META_PIXEL_ID    your pixel id, e.g. 1234567890123456
//   META_CAPI_TOKEN  Events Manager > Settings > Conversions API >
//                    Generate access token.  KEEP THIS SECRET. Never commit it.
// OPTIONAL:
//   META_TEST_EVENT_CODE  set while testing so events appear in the
//                         Events Manager "Test events" tab. REMOVE when live.
//
// Deduplication: event_id arrives from the browser and is passed through
// unchanged, so Meta collapses the browser and server copy into one event.

const crypto = require('crypto');

const API_VERSION = 'v21.0';

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

// Meta requires lowercase, trimmed, whitespace-stripped values before hashing.
function hashEmail(v) {
  if (!v) return null;
  return sha256(String(v).trim().toLowerCase());
}

// Phone numbers: digits only, country code included, no leading +.
function hashPhone(v) {
  if (!v) return null;
  const digits = String(v).replace(/[^0-9]/g, '');
  return digits ? sha256(digits) : null;
}

function readCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i < 0) return;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try { return Promise.resolve(JSON.parse(req.body)); } catch (e) { return Promise.resolve({}); }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch (e) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const PIXEL_ID = process.env.META_PIXEL_ID;
  const TOKEN = process.env.META_CAPI_TOKEN;

  if (!PIXEL_ID || !TOKEN) {
    // Fail quietly with 204 so a missing env var never breaks the page.
    console.warn('[meta-capi] META_PIXEL_ID or META_CAPI_TOKEN not set — event dropped');
    res.statusCode = 204;
    return res.end();
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Bad body' }));
  }

  const eventName = body.event_name;
  if (!eventName) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Missing event_name' }));
  }

  const cookies = readCookies(req.headers.cookie);
  const sourceUrl = body.event_source_url || '';

  // _fbc is the click id. If the cookie is missing but fbclid is on the URL,
  // rebuild it — this is the single biggest source of lost ad attribution.
  let fbc = cookies._fbc || null;
  if (!fbc && sourceUrl.indexOf('fbclid=') > -1) {
    try {
      const fbclid = new URL(sourceUrl).searchParams.get('fbclid');
      if (fbclid) fbc = `fb.1.${Date.now()}.${fbclid}`;
    } catch (e) { /* malformed url, skip */ }
  }

  const forwarded = req.headers['x-forwarded-for'] || '';
  const clientIp = forwarded.split(',')[0].trim() || req.socket?.remoteAddress || undefined;

  const incomingUser = body.user_data || {};
  const userData = {
    client_user_agent: req.headers['user-agent'],
    client_ip_address: clientIp
  };
  if (cookies._fbp) userData.fbp = cookies._fbp;
  if (fbc) userData.fbc = fbc;

  const em = hashEmail(incomingUser.email);
  if (em) userData.em = [em];
  const ph = hashPhone(incomingUser.phone);
  if (ph) userData.ph = [ph];

  const event = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: body.event_id,
    event_source_url: sourceUrl || undefined,
    action_source: 'website',
    user_data: userData,
    custom_data: body.custom_data || {}
  };

  const payload = { data: [event] };
  if (process.env.META_TEST_EVENT_CODE) {
    payload.test_event_code = process.env.META_TEST_EVENT_CODE;
  }

  try {
    const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(TOKEN)}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await r.json().catch(() => ({}));

    if (!r.ok) {
      // Log but return 204 — an ad-platform failure must never surface to a shopper.
      console.error('[meta-capi] Meta rejected event:', JSON.stringify(json));
      res.statusCode = 204;
      return res.end();
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, events_received: json.events_received }));
  } catch (err) {
    console.error('[meta-capi] request failed:', err && err.message);
    res.statusCode = 204;
    return res.end();
  }
};
