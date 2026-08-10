// /api/data.js
// Serverless function that reads/writes the farm app's data in Upstash
// Redis (installed via the Vercel Marketplace — Vercel's own "KV" product
// was sunset in Dec 2024 and replaced by this Marketplace integration).
//
// GET  /api/data            -> { "farm-crops": "...", "farm-cows": "...", ... }  (all keys)
// POST /api/data { key, value } -> upserts one key
//
// Requires the @upstash/redis package and an Upstash Redis database
// connected to this project (Vercel dashboard -> Storage -> Marketplace
// Database Providers -> Upstash -> Redis -> Connect Project). Once
// connected, Vercel injects the required env vars automatically.

import { Redis } from '@upstash/redis';

// The Upstash Vercel integration injects either KV_REST_API_URL/TOKEN
// (legacy names, kept for compatibility with old Vercel KV code) or
// UPSTASH_REDIS_REST_URL/TOKEN depending on how it was installed —
// this checks both so it works either way.
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
  // Upstash auto-detects JSON-looking values and parses them for you on
  // .get(). We store values as JSON strings ourselves (via JSON.stringify
  // in the front end) and parse them ourselves too — so we turn this off
  // to avoid a double-parse mismatch (redis.get() returning an already-
  // parsed object instead of the string our code expects).
  automaticDeserialization: false,
});

// All the keys the front end reads/writes (must match STORE_KEYS in index.html)
const KNOWN_KEYS = [
  'farm-crops', 'farm-employees', 'farm-cows', 'farm-pigs',
  'farm-milk', 'farm-births', 'farm-sales', 'farm-feed', 'farm-feedlog',
  'farm-hay', 'farm-haylog', 'farm-supplements', 'farm-tools'
];

export default async function handler(req, res) {
  // --- Optional shared-secret check -----------------------------------
  // Uncomment this block (and set APP_SECRET in your Vercel project's
  // Environment Variables) if you want a simple layer of protection so
  // random visitors can't read/write your farm data. See the deployment
  // guide for how the front end should send this header.
  //
  // const secret = req.headers['x-app-key'];
  // if (secret !== process.env.APP_SECRET) {
  //   return res.status(401).json({ error: 'Unauthorized' });
  // }

  // Quick diagnostic: GET /api/data?debug=1 tells you whether the env
  // vars are even present, without exposing the token itself.
  if (req.method === 'GET' && req.query.debug) {
    return res.status(200).json({
      hasUrl: Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL),
      hasToken: Boolean(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN),
      urlSource: process.env.KV_REST_API_URL ? 'KV_REST_API_URL' : (process.env.UPSTASH_REDIS_REST_URL ? 'UPSTASH_REDIS_REST_URL' : 'none found'),
    });
  }

  try {
    if (req.method === 'GET') {
      const values = await Promise.all(KNOWN_KEYS.map((k) => redis.get(k)));
      const result = {};
      KNOWN_KEYS.forEach((k, i) => { result[k] = values[i] ?? null; });
      return res.status(200).json(result);
    }

    if (req.method === 'POST') {
      const { key, value } = req.body || {};
      if (!key || !KNOWN_KEYS.includes(key)) {
        return res.status(400).json({ error: 'Unknown or missing key', receivedKey: key });
      }
      await redis.set(key, value);
      return res.status(200).json({ key, value });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (err) {
    // Surfaced in the response (not just Vercel's function logs) so it's
    // easy to see from curl or the browser Network tab while debugging.
    // Consider removing `details` once everything is working, so you're
    // not exposing internals publicly.
    console.error('api/data error:', err);
    return res.status(500).json({ error: 'Server error', details: String(err && err.message || err) });
  }
}
