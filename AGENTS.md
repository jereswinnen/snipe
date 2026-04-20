<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices. Middleware is renamed to `proxy` (`proxy.ts` at the repo root).
<!-- END:nextjs-agent-rules -->

# Package manager

This project uses **pnpm**. Always use it — never `npm install`, `npm add`, `npx`, or similar. Use `pnpm install`, `pnpm add <pkg>`, `pnpm add -D <pkg>`, `pnpm dlx <cmd>`, `pnpm test`, `pnpm run <script>`. The lockfile is `pnpm-lock.yaml`.

If you see a `package-lock.json` appear, delete it — it means someone slipped and used npm.

# Repo layout

Monorepo with two deployable surfaces:

- **Web / server** — Next.js 16 app at the repo root. Serves the browser UI and the JSON API consumed by iOS.
- **iOS app** — `ios/Snipe/Snipe.xcodeproj`, SwiftUI, iOS 26 target, Swift Testing. Consumes the same JSON API.

Shared docs:

- `docs/API.md` — canonical API reference. Keep this up to date whenever an endpoint changes; iOS reads it.
- `docs/APNS_SETUP.md` — Apple portal + Railway + Xcode walkthrough for push.

## Server layout

```
app/
  api/                 JSON endpoints (grouped by resource)
    groups/            GET /, POST /, GET /[id], PATCH /[id], DELETE /[id]
      [id]/listings/   POST (attach URL to existing group)
      [id]/trend/      GET (per-listing + cheapest-over-time series)
    listings/
      [id]/            GET, DELETE
      [id]/check/      POST (force rescrape)
      [id]/history/    GET (price points, ?days=)
    devices/           POST / DELETE (APNs token registration)
    auth/              login + logout
    cron/check/        POST, Bearer CRON_SECRET, runs all scrapes
  groups/[id]/         Web group-detail RSC + client components
  login/               Web login page
  page.tsx             Web home (groups grid)
proxy.ts               Auth gate: Bearer token or session cookie
lib/
  api/errors.ts        Stable error codes + respondJson/respondError
  db/                  Drizzle schema, queries, migrate runner
  scrapers/            One connector per shop + shared helpers
  check.ts             Central scrape + notify loop
  notify.ts            brrr payload builders
  apns.ts              APNs JWT + HTTP/2 fan-out
  trend.ts             buildCheapestOverTime + per-listing series
drizzle/migrations/    Versioned SQL + snapshots
```

## iOS layout

```
ios/Snipe/Snipe/
  App/                 SnipeApp, AppDelegate, Config, Session
  Environment/         Device + Platform env value
  Models/              DTOs + ISO parsing (match docs/API.md shapes)
  Networking/          APIClient, APIError, TokenStore (Keychain)
  Utilities/           Formatters, GridLayouts, ShopFavicon, Theme
  Views/
    Groups/            list + card (also hosts ShopFaviconStack)
    GroupDetail/       hero, listings, target, trend, history
    Root / Login / AddURLSheet
  Assets.xcassets/
```

Xcode uses **file-system-synchronized groups** — new files dropped into the right folder are picked up automatically without pbxproj edits.

# Supported shops

Each lives at `lib/scrapers/<shop>.ts` and registers in `lib/scrapers/index.ts`.

| Shop          | Host                     | Medium    | Notes                                                                  |
|---------------|--------------------------|-----------|------------------------------------------------------------------------|
| `bol`         | bol.com                  | physical  | JSON-LD. Always-free shipping. Has diagnostic messaging on scrape fail (Akamai is finicky). |
| `coolblue`    | coolblue.be / .nl        | physical  | JSON-LD. Free shipping.                                                |
| `allyourgames`| allyourgames.nl          | physical  | JSON-LD. Flat fee from `ALLYOURGAMES_SHIPPING` env (€5.95 default).    |
| `nedgame`     | nedgame.nl               | physical  | JSON-LD with cheerio fallback. Free ≥ €175, else €6.99.                |
| `nintendo`    | nintendo.com (all locales) | digital | og:title + og:image + `na_nsuid` extraction → `api.ec.nintendo.com/v1/price`. Free shipping. |
| `dreamland`   | dreamland.be             | physical  | JSON-LD ProductGroup variant. Free ≥ €50, else €4.99.                  |

Add a new shop by implementing `ShopConnector` (`lib/scrapers/types.ts`), registering it in `index.ts`, adding a mapping in `ios/.../Utilities/ShopFavicon.swift`, and extending the `Shop` enum in `lib/db/schema.ts` + `ios/.../Models/Models.swift`.

# Notifications

Three channels of notification fire from `lib/check.ts → notifyAll(payload)`:

1. **Price changed** — on any `lastTotalCost` delta. `time-sensitive`.
2. **Sale ending** — once per unique sale end, within 24 h of expiry. `time-sensitive`.
3. **Scrape failed** — edge-triggered on the healthy → failing transition. `passive`.

Each payload fans out to **brrr** (existing) AND **APNs** (iOS devices registered via `POST /api/devices`). Both paths are independently try/catch-wrapped — one failing never drops the other. APNs is a no-op when the `APNS_*` env vars are unset, so local dev keeps brrr-only behaviour.

# Error envelope

Every 4xx/5xx response:

```json
{ "error": "<stable_code>", "message": "human readable" }
```

Codes live in `lib/api/errors.ts`. Add new codes by appending to the `API_ERROR_CODES` tuple — do not repurpose existing ones; native clients key localized strings off them.

# Editing conventions

- **Never downgrade data safely**: every migration must be additive unless you are explicitly dropping a dead column (see `0006_old_hitman.sql` for the pattern).
- **Keep `docs/API.md` in sync** whenever you add, remove, or change an endpoint shape. iOS DTOs depend on it.
- **Cache-Control headers**: JSON responses must be no-store. Use `respondJson(body)` / `respondError(code, status, message)` — they attach the headers for you. Routes that return `NextResponse` directly (login/logout for the cookie) add `Cache-Control: no-store` manually.
- **Force-dynamic**: every GET API route exports `export const dynamic = "force-dynamic"`. Without it Next.js may cache at build time.
- **iOS networking**: `APIClient` uses an ephemeral `URLSession` with `reloadIgnoringLocalAndRemoteCacheData`. Don't switch to `URLSession.shared` — the whole point is zero caching.
- **Scrapers**: prefer the shared `extractProductJsonLd` / `requireJsonLd` helpers in `lib/scrapers/jsonld.ts`. Trim `og:*` meta values — Nintendo wraps them in whitespace that Swift's `URL(string:)` rejects.
- **Shipping knobs**: shop-specific shipping env vars (e.g. `ALLYOURGAMES_SHIPPING`) go in `lib/env.ts` as optional with sensible defaults.

# Environment variables

Required:

- `DATABASE_URL` — Neon Postgres connection string.
- `APP_PASSWORD` — the shared sign-in password.
- `APP_SECRET` — HMAC key for session tokens. Any long random string.
- `CRON_SECRET` — Bearer the cron endpoint requires.
- `BRRR_WEBHOOK_SECRET` — brrr.now bearer.
- `APP_URL` — used in notifications' `open_url`, e.g. `https://snipe-production-xxxx.up.railway.app`.

Optional:

- `ALLYOURGAMES_SHIPPING` — flat shipping rate for AllYourGames (default `5.95`).
- `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `APNS_KEY_P8` — all or nothing; unset = APNs disabled, brrr keeps working.

Local dev reads `.env.local` via `lib/env.ts` (Next's default), then falls back to `.env`. Railway populates OS env directly.

# Deploy

Railway auto-deploys on push to `main`. Start command runs `pnpm db:migrate` → `pnpm start`, so additive schema changes go live without manual steps. APNs env var updates trigger a redeploy automatically.

# Testing

- `pnpm test` runs the Node `tsx` tests (schema + scraper fixtures + shipping math + error envelope).
- iOS: `⌘U` in Xcode, or `xcodebuild test -scheme Snipe`. Uses Swift Testing (`@Test` + `#expect`), not XCTest.
