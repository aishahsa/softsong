// Cloudflare Worker: keeps the Spotify client secret server-side.
// Secrets SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are set with `wrangler secret put`.

const ALLOWED_ORIGINS = ['https://aishahsa.github.io', 'http://localhost:8000', 'http://127.0.0.1:8000'];

let cachedToken = null;
let tokenExpiry = 0;

async function getToken(env) {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`),
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error('Token request failed');
  const json = await res.json();
  cachedToken = json.access_token;
  tokenExpiry = Date.now() + (json.expires_in - 60) * 1000;
  return cachedToken;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
      'Vary': 'Origin',
    };
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!allowed) return json({ error: 'Forbidden' }, 403);

    const m = new URL(request.url).pathname.match(/^\/(track|audio-features)\/([a-zA-Z0-9]{22})$/);
    if (!m) return json({ error: 'Not found' }, 404);

    try {
      const token = await getToken(env);
      const upstream = await fetch(
        m[1] === 'track'
          ? `https://api.spotify.com/v1/tracks/${m[2]}`
          : `https://api.spotify.com/v1/audio-features/${m[2]}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return json(await upstream.json(), upstream.status);
    } catch (e) {
      return json({ error: 'Upstream error' }, 502);
    }
  },
};
