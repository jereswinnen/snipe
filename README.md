# Snipe — Price Tracker

Personal price tracker for Bol.com, Coolblue, AllYourGames.nl and Nedgame.nl. Sends a brrr.now push when total cost (price + shipping) changes.

Design and rationale: [`docs/superpowers/specs/2026-04-19-price-tracker-design.md`](docs/superpowers/specs/2026-04-19-price-tracker-design.md).
Implementation plan: [`docs/superpowers/plans/2026-04-19-price-tracker.md`](docs/superpowers/plans/2026-04-19-price-tracker.md).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Drizzle ORM · Postgres · Cheerio · Zod.

Tests run via `tsx --test` (no extra framework).

## Local setup

1. Install Postgres locally (or point at a remote DB).
2. `cp .env.example .env.local` and fill in real values.
3. `npm install`
4. `npm run db:generate` (only after schema changes)
5. `npm run db:migrate`
6. `npm run dev`

Open http://localhost:3000 — you'll be redirected to `/login`.

## Tests

```
npm test
```

## Deploy to Railway

1. Create a new project in your existing workspace → "Deploy from GitHub" → select this repo, branch `main` (after merge).
2. Add a **Postgres** plugin to the project. Copy its `DATABASE_URL` into the service env vars.
3. Add the rest of the env vars to the Next service:
   - `APP_PASSWORD` — your login password
   - `APP_SECRET` — 32+ random hex bytes (e.g. `openssl rand -hex 32`)
   - `CRON_SECRET` — random string used by the cron job
   - `BRRR_WEBHOOK_SECRET` — your brrr.now bearer token
   - `APP_URL` — the public URL Railway assigns the service
   - `ALLYOURGAMES_SHIPPING` — optional, default `5.95`
4. After the first deploy, run the migration once via the Railway shell:
   ```
   npm run db:migrate
   ```
5. Add a **Cron Job** under the service settings:
   - Schedule: `0 */4 * * *` (every 4 hours)
   - Command: `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/check"`

The cron job adds essentially zero cost — it hits an endpoint on the always-running web service.

## Supported shops

| Shop | Parsing | Shipping to BE |
|---|---|---|
| Bol.com | JSON-LD | €2.99 under €25 (sold-by-Bol only), free ≥€25, third-party €0 |
| Coolblue | JSON-LD | Always €0 |
| AllYourGames.nl | JSON-LD | Flat (default €5.95) |
| Nedgame.nl | JSON-LD + DOM fallback | €6.99 under €175, free ≥€175, pre-orders free |

Adding a shop:
1. Add the shop key to `shops` in `lib/db/schema.ts`.
2. Add a scraper module in `lib/scrapers/<shop>.ts` exporting a `Scraper`.
3. Wire it into the dispatcher in `lib/scrapers/index.ts` (both `scrapers` map and `shopFromUrl`).
4. Extend `shippingCost` in `lib/shipping.ts`.
5. Save a fixture under `test/fixtures/<shop>.html` and add a test in `test/scrapers.test.ts`.

## Scraper fixtures

The fixtures in `test/fixtures/` are minimal hand-crafted HTML used to verify the scrapers' parsing logic deterministically. If a shop changes its markup and a scraper starts failing in production, capture a real product page (via `curl` with realistic headers, or save-as from a browser) into the corresponding fixture and adjust the scraper.

## Auth

Single password defined in `APP_PASSWORD`. Successful login sets a 30-day signed HMAC cookie (`snipe_auth`). The `proxy.ts` file (Next.js 16 renamed `middleware.ts` → `proxy.ts`) gates every route except `/login`, `/api/auth/login`, and `/api/cron/check`. The cron endpoint is gated separately by a Bearer token (`CRON_SECRET`).

## Non-goals

No Amazon/MediaMarkt (anti-bot), no multi-user, no email notifications, no ML.
