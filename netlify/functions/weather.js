// Serverless proxy for OpenWeatherMap so the API key stays server-side.
// Set OWM_KEY in Netlify → Site settings → Environment variables.
// Then you can remove the hardcoded key from index.html.
exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const endpoint = ['weather', 'forecast'].includes(q.endpoint) ? q.endpoint : 'weather';
  const key = process.env.OWM_KEY;
  if (!key) return { statusCode: 500, body: JSON.stringify({ error: 'OWM_KEY not configured' }) };

  const params = new URLSearchParams();
  if (q.lat && q.lon) { params.set('lat', q.lat); params.set('lon', q.lon); }
  if (q.q) params.set('q', q.q);
  params.set('appid', key);
  params.set('units', 'metric');

  const url = `https://api.openweathermap.org/data/2.5/${endpoint}?${params.toString()}`;
  try {
    const r = await fetch(url);
    const data = await r.json();
    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=1800',
        'access-control-allow-origin': '*'
      },
      body: JSON.stringify(data)
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: 'weather fetch failed' }) };
  }
};
