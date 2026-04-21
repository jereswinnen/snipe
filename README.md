# Snipe — Price Tracker

Personal price tracker for Bol.com, Coolblue, AllYourGames.nl, Nintendo eShop, Dreamland and PlayStation Store. Sends a brrr.now push when total cost (price + shipping) changes.

Design and rationale: [`docs/superpowers/specs/2026-04-19-price-tracker-design.md`](docs/superpowers/specs/2026-04-19-price-tracker-design.md).
Implementation plan: [`docs/superpowers/plans/2026-04-19-price-tracker.md`](docs/superpowers/plans/2026-04-19-price-tracker.md).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Drizzle ORM · Postgres · Cheerio · Zod.

Tests run via `tsx --test` (no extra framework).

## Local setup

1. Install Postgres locally (or point at a remote DB).
2. `cp .env.example .env.local` and fill in real values.
3. `pnpm install`
4. `pnpm db:generate` (only after schema changes)
5. `pnpm db:migrate`
6. `pnpm dev`

Open http://localhost:3000 — you'll be redirected to `/login`.

This project uses **pnpm**. Don't use `npm` or `yarn`.

## Tests

```
pnpm test
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
   pnpm db:migrate
   ```
5. Set up the cron. Easiest: use an external cron service (e.g. cron-job.org, free) that hits
   `POST $APP_URL/api/cron/check` with header `Authorization: Bearer $CRON_SECRET` on whatever
   schedule you want (`0 */4 * * *` is a good default).

   Or run it inside Railway as a separate service: deploy from this repo, set
   `CRON_SECRET` and `APP_URL` as env vars (use `https://` — http redirects downgrade POST to
   GET), cron schedule `0 */4 * * *`, custom start command `node scripts/cron-ping.mjs`.

The cron work is negligible cost — each firing runs a few seconds.

## Supported shops

| Shop | Parsing | Shipping to BE |
|---|---|---|
| Bol.com | JSON-LD | €2.99 under €25 (sold-by-Bol only), free ≥€25, third-party €0 |
| Coolblue | JSON-LD | Always €0 |
| AllYourGames.nl | JSON-LD | Flat (default €5.95) |

Adding a shop:
1. Add the shop key to `shops` in `lib/db/schema.ts`.
2. Create `lib/scrapers/<shop>.ts` exporting a `ShopConnector` (hosts, scrape, shipping all in one file).
3. Register it in the `connectors` array in `lib/scrapers/index.ts`.
4. Drop a fixture at `test/fixtures/<shop>.html` and add a test in `test/scrapers.test.ts`.

## Scraper fixtures

The fixtures in `test/fixtures/` are minimal hand-crafted HTML used to verify the scrapers' parsing logic deterministically. If a shop changes its markup and a scraper starts failing in production, capture a real product page (via `curl` with realistic headers, or save-as from a browser) into the corresponding fixture and adjust the scraper.

## Auth

Single password defined in `APP_PASSWORD`. Successful login sets a 30-day signed HMAC cookie (`snipe_auth`). The `proxy.ts` file (Next.js 16 renamed `middleware.ts` → `proxy.ts`) gates every route except `/login`, `/api/auth/login`, and `/api/cron/check`. The cron endpoint is gated separately by a Bearer token (`CRON_SECRET`).

## Non-goals

No Amazon/MediaMarkt (anti-bot), no multi-user, no email notifications, no ML.
