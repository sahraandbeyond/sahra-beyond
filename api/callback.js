// Vercel serverless function — completes the GitHub OAuth flow and hands the token
// back to the CMS admin window via postMessage (Decap/Netlify CMS handshake).
// Requires env vars in Vercel: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
module.exports = async (req, res) => {
  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) { res.statusCode = 500; res.end('Missing GitHub OAuth env vars'); return; }

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const url = new URL(req.url, 'https://' + host);
    const code = url.searchParams.get('code');
    if (!code) { res.statusCode = 400; res.end('Missing ?code'); return; }

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code })
    });
    const data = await tokenRes.json();

    const status = data.access_token ? 'success' : 'error';
    const content = data.access_token
      ? { token: data.access_token, provider: 'github' }
      : { error: data.error_description || data.error || 'No access token returned' };

    const body = '<!doctype html><html><head><meta charset="utf-8"></head><body>'
      + '<p>Completing sign-in… you can close this window.</p>'
      + '<script>'
      + '(function(){'
      + '  function receiveMessage(e){'
      + '    window.opener.postMessage('
      + "      'authorization:github:" + status + ":" + JSON.stringify(content).replace(/</g, '\\u003c') + "',"
      + '      e.origin'
      + '    );'
      + '    window.removeEventListener("message", receiveMessage, false);'
      + '  }'
      + '  window.addEventListener("message", receiveMessage, false);'
      + '  window.opener && window.opener.postMessage("authorizing:github", "*");'
      + '})();'
      + '</script></body></html>';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.statusCode = 200;
    res.end(body);
  } catch (e) {
    res.statusCode = 500;
    res.end('OAuth error: ' + (e && e.message ? e.message : String(e)));
  }
};
