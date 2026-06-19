// Vercel serverless function — starts the GitHub OAuth flow for the Decap/Netlify CMS admin.
// Requires env vars in Vercel: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
const crypto = require('crypto');

module.exports = (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) { res.statusCode = 500; res.end('Missing GITHUB_CLIENT_ID env var'); return; }
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const redirectUri = 'https://' + host + '/api/callback';
  const state = crypto.randomBytes(12).toString('hex');
  const authUrl = 'https://github.com/login/oauth/authorize'
    + '?client_id=' + encodeURIComponent(clientId)
    + '&redirect_uri=' + encodeURIComponent(redirectUri)
    + '&scope=' + encodeURIComponent('repo,user')
    + '&state=' + state;
  res.writeHead(302, { Location: authUrl });
  res.end();
};
