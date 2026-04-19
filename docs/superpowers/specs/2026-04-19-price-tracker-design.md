# Price Tracker — Design

Personal price tracking web app that monitors product prices across Dutch/Belgian shops (Bol.com, Coolblue, AllYourGames.nl, Nedgame.nl) and sends push notifications via brrr.now when the total cost (price + shipping) changes.

Single-user. Deployed to Railway as one Next.js service.

## Stack

- **Next.js 16** (App Router, TypeScript) — UI + API routes in one service
- **Postgres** on Railway, accessed via **Drizzle ORM** (`drizzle-orm`, `drizzle-kit`, `pg`)
- **Cheerio** — HTML parsing fallback when JSON-LD is absent
- **Zod** — URL and form validation
- **Railway Cron** — hits a protected API route on schedule (no in-process cron)

## Architecture

```
Browser ──▶ Next.js (app router)
             ├── /login           (public)
             ├── /                (authed, product list)
             ├── /products/[id]   (authed, history + settings)
             └── api/
                 ├── /auth/login       (POST)
                 ├── /products         (GET/POST)
                 ├── /products/[id]    (GET/PATCH/DELETE)
                 └── /cron/check       (POST, token-protected, scrapes all)
                         │
                         ▼
                    Scrapers (per-shop) ──▶ Postgres (products, priceHistory)
                                              │
                                              └──▶ brrr.now notify (on totalCost change)
```

Railway cron job runs `curl -X POST -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/check` every 4 hours.

## Auth

- Single env var `APP_PASSWORD`.
- `POST /api/auth/login` compares password, sets signed HTTP-only cookie `snipe_auth` (HMAC over a fixed marker + timestamp, 30-day expiry).
- `middleware.ts` verifies cookie on all non-public paths; redirects to `/login` on failure.
- Cron route is gated separately by `CRON_SECRET` bearer token, not the cookie.

## Data model (Drizzle)

```ts
products {
  id           serial pk
  url          text unique not null
  shop         text not null            // 'bol' | 'coolblue' | 'allyourgames' | 'nedgame'
  name         text not null
  imageUrl     text
  isPreOrder   boolean not null default false   // Nedgame, user-toggleable
  soldByBol    boolean                           // nullable; auto-detected from JSON-LD
  lastPrice    numeric(10,2) not null
  lastTotalCost numeric(10,2) not null
  targetPrice  numeric(10,2)                     // nullable, UI highlight only
  lastCheckedAt timestamptz
  lastError    text                              // last scrape error, null on success
  createdAt    timestamptz default now()
  updatedAt    timestamptz default now()
}

priceHistory {
  id         serial pk
  productId  int fk(products) on delete cascade
  price      numeric(10,2) not null
  totalCost  numeric(10,2) not null
  checkedAt  timestamptz default now()
}
```

Store money as `numeric(10,2)`; convert to number at the edges. Every check appends to `priceHistory`; `products` row only updates when `totalCost` changes.

## Scrapers

Each shop exports `{ detect(url), scrape(html, url) }`. Dispatcher picks scraper by hostname.

- **Bol.com**: parse `<script type="application/ld+json">` → `Product.offers`. Detect `soldByBol` from `offers.seller.name` (case-insensitive contains "bol"). When third-party, shipping is €0 (baked in).
- **Coolblue**: JSON-LD `Product.offers.price`. Shipping €0 always.
- **AllYourGames.nl**: JSON-LD (Lightspeed). Shipping flat, configurable via env `ALLYOURGAMES_SHIPPING` (default 5.95).
- **Nedgame.nl**: JSON-LD if present, else DOM fallback (`[itemprop=price]` or OpenGraph). Requires realistic headers (User-Agent, Accept, Accept-Language). If `isPreOrder`, shipping €0; else €6.99 under €175, free ≥€175.

All scrapers share `fetchPage(url)` with realistic browser headers, 10s timeout, and 2 retries with 1s backoff.

## Shipping calculator

Pure function `shippingCost(shop, price, { soldByBol, isPreOrder }) → number`. Table-driven; unit-tested.

## Notification logic

1. Fetch page → extract price → compute totalCost.
2. Read current product row. Compare `totalCost` to `lastTotalCost`.
3. If changed: POST to `https://api.brrr.now/v1/send` with:
   - `title`: product name
   - `message`: `€<old> → €<new>` (2 decimal places)
   - `open_url`: product.url
   - `sound`: `cha_ching` if new < old else `warm_soft_error`
4. Always insert `priceHistory` row. On change: update `products` (lastPrice, lastTotalCost, lastCheckedAt, soldByBol if flipped, clear lastError).
5. On scrape error: update `lastCheckedAt` and `lastError`, do NOT append history, do NOT notify.

`targetPrice` does not trigger extra notifications. UI highlights products where `lastTotalCost ≤ targetPrice`.

## UI

Tailwind v4 (already configured). Minimal, clean, server-rendered where possible.

- **`/login`**: password field → POST → redirect.
- **`/`**: grid of product cards. Each card:
  - Image (if available), name, shop badge
  - Current price, shipping, total cost
  - 30-point inline SVG sparkline of `priceHistory.totalCost`
  - "Last checked" relative timestamp; red dot if `lastError`
  - Target-price highlight (subtle green ring) when hit
- **Add product**: top-of-page input. Paste URL → POST `/api/products` → server detects shop by hostname → scrapes once → inserts with current price → client refreshes list. Errors inline.
- **`/products/[id]`**: full history table, editable target price, `isPreOrder` toggle (Nedgame only), delete button, "Check now" button (calls `/api/products/[id]/check`).

## Cron sweep

`POST /api/cron/check`:
1. Verify `Authorization: Bearer ${CRON_SECRET}`.
2. Select all products. Shuffle to avoid shop-bursts, then process sequentially with 500ms jitter between requests.
3. Per product: run scraper → shipping → notify-if-changed → history insert.
4. Errors per product are caught and logged to the product's `lastError`; do not abort the sweep.
5. Returns JSON summary `{ checked, changed, errors }`.

Railway cron: `0 */4 * * *` → `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/check"`.

## Testing

- Unit tests for shipping calculator (table of cases per shop).
- Unit tests for each scraper against saved HTML fixtures in `test/fixtures/<shop>.html`.
- Integration test for the change-detection path using an in-memory fake db.
- No e2e; single-user app, manual UI check is sufficient.

Run with `node --test` (native Node test runner) to avoid adding a framework.

## Env vars

```
DATABASE_URL            # Railway Postgres
APP_PASSWORD            # login password
APP_SECRET              # HMAC key for auth cookie (32+ bytes random)
CRON_SECRET             # bearer token for /api/cron/check
BRRR_WEBHOOK_SECRET     # brrr.now bearer
APP_URL                 # https://... (used only by the Railway cron command)
ALLYOURGAMES_SHIPPING   # optional, default 5.95
```

## File layout

```
app/
  layout.tsx
  globals.css
  login/page.tsx
  page.tsx                         # product list
  products/[id]/page.tsx
  api/
    auth/login/route.ts
    products/route.ts
    products/[id]/route.ts
    products/[id]/check/route.ts
    cron/check/route.ts
  middleware.ts
lib/
  db/
    schema.ts
    client.ts
    queries.ts
  scrapers/
    index.ts                       # dispatcher + detect(url)
    bol.ts
    coolblue.ts
    allyourgames.ts
    nedgame.ts
    fetch.ts                       # shared fetch w/ headers + retries
    jsonld.ts                      # shared JSON-LD extractor
  shipping.ts
  notify.ts
  auth.ts                          # signCookie/verifyCookie
drizzle/
  migrations/
drizzle.config.ts
test/
  fixtures/
  shipping.test.ts
  scrapers.test.ts
  notify.test.ts
```

## Non-goals

- Amazon, MediaMarkt (anti-bot).
- Multi-user, OAuth, billing.
- Price predictions / analytics.
- Email notifications.
- Self-hosted cron inside Next process.
