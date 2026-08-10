# Farm Ledger deployment guide

vercel-farm-app/
├── api/
│   └── data.js       # serverless function — reads/writes Upstash Redis
├── public/
│   └── index.html    # the app (static, no build step)
├── package.json
└── README.md

## 1. Prerequisites

- A [Vercel](https://vercel.com) account (free tier is enough for this).
- [Node.js](https://nodejs.org) installed locally.
- The [Vercel CLI](https://vercel.com/docs/cli): `npm install -g vercel`

## 2. Set up the project

```bash
cd vercel-farm-app
npm install
vercel login
vercel link        # creates/links a Vercel project for this folder
```

## 3. Add a Redis database (via Marketplace → Upstash)

**Option A — Dashboard:**
1. Open your project on [vercel.com](https://vercel.com/dashboard).
2. Go to the **Storage** tab → **Marketplace Database Providers**.
3. Find **Upstash** → choose **Redis** → **Connect Project** (or **Create
   Database** if you don't have one yet).

**Option B — CLI (faster):**
```bash
vercel install upstash
```
This provisions a Redis database and links it to the currently-linked
project in one step.

Either way, Vercel injects the required environment variables into your
project automatically (`KV_REST_API_URL`/`KV_REST_API_TOKEN` or
`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` depending on how it
was installed — `api/data.js` checks for both, so you don't need to
worry about which one you got).

To run it locally, pull those env vars down first:

```bash
vercel env pull .env.development.local
```

## 4. Run it locally (optional, to test before going live)

```bash
vercel dev
```

This starts the static site **and** the `/api/data` serverless function
together at `http://localhost:3000`, using your real KV database.

## 5. Deploy

```bash
vercel --prod
```

You'll get a live URL like `https://farm-ledger.vercel.app`. Anyone with
the link (employees on-site, grandma abroad) can open it in a phone
browser and it'll work like a normal app.

## 6. (Strongly recommended) Add a simple access key

As shipped, `/api/data` has **no authentication** — anyone who finds the
URL could read or overwrite the farm's records. For a family tool this
is usually fine to skip at first, but it's worth adding a lightweight
shared secret before sharing the link widely:

1. In `api/data.js`, uncomment the `x-app-key` check near the top.
2. In the Vercel dashboard, go to **Settings → Environment Variables**
   and add `APP_SECRET` with a passphrase you choose.
3. In `public/index.html`, near the top of the `<script>` block, add:
   ```js
   const APP_KEY = localStorage.getItem('farm-app-key') || prompt('Enter the farm app passphrase:');
   if (APP_KEY) localStorage.setItem('farm-app-key', APP_KEY);
   ```
   and add `'x-app-key': APP_KEY` to the `headers` in both `fetch('/api/data')`
   calls in `loadAll()` and `saveKind()`.
4. Redeploy (`vercel --prod`). Share the passphrase with whoever needs
   it (e.g. via WhatsApp), separately from the link.

This isn't bank-grade security, but it stops random visitors or search
engines from stumbling onto the data.

## 7. Custom domain (optional)

In the Vercel dashboard: **Settings → Domains** → add your own domain
(e.g. `farm.yourdomain.com`) and follow the DNS instructions shown.

## Updating the app later

Any time you want to change something in `public/index.html`, just edit
the file and run `vercel --prod` again — no database migration needed,
since the data lives in KV, separate from the code.

## Alternative to Upstash Redis

If you'd rather not use a key-value store (e.g. you want a relational
database you can query directly), swap `api/data.js` for a version
backed by **[Neon](https://neon.tech)** (Postgres — this is also what
Vercel's own managed Postgres migrated to) or
**[Supabase](https://supabase.com)** (Postgres with a nice table editor
UI, also available from the same Marketplace tab). The front end doesn't
need to change — it only talks to `/api/data`, so you can change what's
behind that endpoint without touching `index.html`.
