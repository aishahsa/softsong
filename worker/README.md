# Spotify proxy (Cloudflare Worker)

```
cd worker
npx wrangler login
npx wrangler secret put SPOTIFY_CLIENT_ID
npx wrangler secret put SPOTIFY_CLIENT_SECRET   # paste the NEW secret at the prompt
npx wrangler deploy
```

Copy the printed `*.workers.dev` URL into `SPOTIFY_PROXY_URL` in `Script.js`.
