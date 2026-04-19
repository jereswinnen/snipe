# Price Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Personal price tracker that monitors products on Bol.com, Coolblue, AllYourGames.nl and Nedgame.nl, and sends brrr.now notifications when total cost (price + shipping) changes.

**Architecture:** Single Next.js 16 App Router service on Railway. Postgres + Drizzle for persistence. Cheerio for HTML fallback parsing. Auth via signed HTTP-only cookie. Scraping triggered by a Railway cron job hitting a token-protected API route — no in-process cron.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, Drizzle ORM, `pg`, Cheerio, Zod, `tsx` (runs TS tests), Node native `node:test`.

---

## Next.js 16 conventions used in this plan

AGENTS.md warns that Next.js 16 has breaking changes. The ones that matter here — verified against `node_modules/next/dist/docs/`:

- **`middleware.ts` was renamed to `proxy.ts`.** Must live at project root and export a function named `proxy` (or default export).
- **`cookies()` is async** — `const store = await cookies()`.
- **Dynamic route `params` is a Promise** — type as `{ params: Promise<{ id: string }> }` and `await params`.

Do not deviate from these — older patterns compile but fail at runtime.

---

## File structure

```
app/
  layout.tsx, globals.css                      (exist — touch only to tweak styles)
  page.tsx                                     (product list — replace scaffold)
  login/page.tsx                               (password form)
  products/[id]/page.tsx                       (history + settings)
  api/
    auth/login/route.ts                        (POST set cookie)
    auth/logout/route.ts                       (POST clear cookie)
    products/route.ts                          (GET list / POST add)
    products/[id]/route.ts                     (GET / PATCH / DELETE)
    products/[id]/check/route.ts               (POST force-recheck)
    cron/check/route.ts                        (POST sweep, CRON_SECRET)
proxy.ts                                       (auth gate — NOT middleware.ts)
lib/
  auth.ts                                      (sign/verify cookie)
  env.ts                                       (typed process.env access)
  db/
    schema.ts                                  (Drizzle tables)
    client.ts                                  (pg Pool + drizzle instance)
    queries.ts                                 (typed read/write helpers)
  shipping.ts                                  (pure shipping calculator)
  notify.ts                                    (brrr.now client)
  scrapers/
    fetch.ts                                   (fetch w/ headers + retry)
    jsonld.ts                                  (extract & merge JSON-LD Product)
    bol.ts
    coolblue.ts
    allyourgames.ts
    nedgame.ts
    index.ts                                   (shopFromUrl + dispatch)
    types.ts                                   (ScrapeResult, Shop types)
  check.ts                                     (per-product orchestrator)
  format.ts                                    (money + relative-time formatters)
components/
  Sparkline.tsx
drizzle/
  migrations/                                  (generated)
drizzle.config.ts
test/
  fixtures/{bol,coolblue,allyourgames,nedgame}.html
  shipping.test.ts
  jsonld.test.ts
  scrapers.test.ts
  notify.test.ts
  auth.test.ts
README.md
```

Each scraper file owns one shop. Shared plumbing (`fetch`, `jsonld`) is reused. `check.ts` is the only place that knows the sequence scrape→shipping→notify→db.

---

### Task 1: Install dependencies and configure tooling

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime and dev deps**

Run:
```bash
npm install drizzle-orm pg cheerio zod
npm install -D drizzle-kit @types/pg tsx dotenv
```

- [ ] **Step 2: Add scripts to `package.json`**

Edit `package.json` `"scripts"`:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "tsx --test --test-reporter=spec \"test/**/*.test.ts\"",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx lib/db/migrate.ts"
  }
}
```

- [ ] **Step 3: Verify dev server still starts**

Run: `npm run dev` — hit http://localhost:3000 — should show Next scaffold. Ctrl-C.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add drizzle, cheerio, zod, tsx"
```

---

### Task 2: Typed env accessor

**Files:**
- Create: `lib/env.ts`
- Create: `.env.example`
- Modify: `.gitignore` (ensure `.env*` is ignored; likely already is)

- [ ] **Step 1: Write `.env.example`**

```
DATABASE_URL=postgres://user:pass@localhost:5432/snipe
APP_PASSWORD=changeme
APP_SECRET=replace-with-32-byte-random-hex
CRON_SECRET=replace-with-random
BRRR_WEBHOOK_SECRET=replace-with-brrr-token
APP_URL=http://localhost:3000
ALLYOURGAMES_SHIPPING=5.95
```

- [ ] **Step 2: Write `lib/env.ts`**

```ts
import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  APP_PASSWORD: required("APP_PASSWORD"),
  APP_SECRET: required("APP_SECRET"),
  CRON_SECRET: required("CRON_SECRET"),
  BRRR_WEBHOOK_SECRET: required("BRRR_WEBHOOK_SECRET"),
  APP_URL: optional("APP_URL", "http://localhost:3000"),
  ALLYOURGAMES_SHIPPING: Number(optional("ALLYOURGAMES_SHIPPING", "5.95")),
} as const;
```

- [ ] **Step 3: Confirm `.gitignore` excludes `.env`**

Run: `grep -E '^\.env' .gitignore` — expect at least `.env*` entry. If not, add `.env*.local` and `.env` to `.gitignore`.

- [ ] **Step 4: Commit**

```bash
git add lib/env.ts .env.example .gitignore
git commit -m "feat: typed env accessor"
```

---

### Task 3: Drizzle schema

**Files:**
- Create: `lib/db/schema.ts`
- Create: `drizzle.config.ts`

- [ ] **Step 1: Write schema**

```ts
// lib/db/schema.ts
import {
  pgTable, serial, text, boolean, numeric, timestamp, integer, index,
} from "drizzle-orm/pg-core";

export const shops = ["bol", "coolblue", "allyourgames", "nedgame"] as const;
export type Shop = (typeof shops)[number];

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  url: text("url").notNull().unique(),
  shop: text("shop").$type<Shop>().notNull(),
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  isPreOrder: boolean("is_pre_order").notNull().default(false),
  soldByBol: boolean("sold_by_bol"),
  lastPrice: numeric("last_price", { precision: 10, scale: 2 }).notNull(),
  lastTotalCost: numeric("last_total_cost", { precision: 10, scale: 2 }).notNull(),
  targetPrice: numeric("target_price", { precision: 10, scale: 2 }),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const priceHistory = pgTable(
  "price_history",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    totalCost: numeric("total_cost", { precision: 10, scale: 2 }).notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("price_history_product_idx").on(t.productId, t.checkedAt)],
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type PriceHistoryRow = typeof priceHistory.$inferSelect;
```

- [ ] **Step 2: Write `drizzle.config.ts`**

```ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 3: Commit**

```bash
git add lib/db/schema.ts drizzle.config.ts
git commit -m "feat: drizzle schema for products and price history"
```

---

### Task 4: DB client and migrator

**Files:**
- Create: `lib/db/client.ts`
- Create: `lib/db/migrate.ts`

- [ ] **Step 1: Write db client**

```ts
// lib/db/client.ts
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

const pool = new Pool({ connectionString: env.DATABASE_URL });
export const db = drizzle(pool, { schema });
export { schema };
```

- [ ] **Step 2: Write migrator**

```ts
// lib/db/migrate.ts
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { env } from "@/lib/env";

async function main() {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./drizzle/migrations" });
  await pool.end();
  console.log("migrations applied");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Generate initial migration**

Run: `npm run db:generate`
Expected: a new file under `drizzle/migrations/` — commit it as-is in Step 5.

- [ ] **Step 4: Apply migration (requires a running Postgres)**

If you have a local Postgres, set `DATABASE_URL` in `.env.local` and run `npm run db:migrate`. Otherwise skip and rely on Railway.

- [ ] **Step 5: Commit**

```bash
git add lib/db/client.ts lib/db/migrate.ts drizzle/migrations
git commit -m "feat: drizzle db client and migration runner"
```

---

### Task 5: Auth cookie signing (TDD)

**Files:**
- Create: `lib/auth.ts`
- Test: `test/auth.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// test/auth.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { signSession, verifySession } from "../lib/auth.ts";

const SECRET = "a".repeat(64);

test("signSession and verifySession roundtrip", () => {
  const token = signSession(SECRET, Date.now());
  assert.equal(verifySession(SECRET, token), true);
});

test("verifySession rejects tampered token", () => {
  const token = signSession(SECRET, Date.now());
  const tampered = token.slice(0, -2) + (token.at(-2) === "a" ? "bb" : "aa");
  assert.equal(verifySession(SECRET, tampered), false);
});

test("verifySession rejects expired token", () => {
  const oneYearAgo = Date.now() - 366 * 24 * 60 * 60 * 1000;
  const token = signSession(SECRET, oneYearAgo);
  assert.equal(verifySession(SECRET, token), false);
});

test("verifySession rejects malformed input", () => {
  assert.equal(verifySession(SECRET, ""), false);
  assert.equal(verifySession(SECRET, "garbage"), false);
  assert.equal(verifySession(SECRET, "a.b"), false);
});
```

- [ ] **Step 2: Run test — expect failure**

Run: `npm test -- test/auth.test.ts`
Expected: module-not-found / undefined-export failures.

- [ ] **Step 3: Implement `lib/auth.ts`**

```ts
// lib/auth.ts
import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_COOKIE = "snipe_auth";

function hmac(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

export function signSession(secret: string, issuedAtMs: number): string {
  const payload = String(issuedAtMs);
  return `${payload}.${hmac(secret, payload)}`;
}

export function verifySession(secret: string, token: string | undefined): boolean {
  if (!token) return false;
  const idx = token.indexOf(".");
  if (idx <= 0 || idx === token.length - 1) return false;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = hmac(secret, payload);
  if (sig.length !== expected.length) return false;
  const ok = timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  if (!ok) return false;
  const issued = Number(payload);
  if (!Number.isFinite(issued)) return false;
  return Date.now() - issued < MAX_AGE_MS;
}

export const SESSION_MAX_AGE_SECONDS = MAX_AGE_MS / 1000;
```

- [ ] **Step 4: Run test — expect pass**

Run: `npm test -- test/auth.test.ts`
Expected: all four tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts test/auth.test.ts
git commit -m "feat: signed session cookie helpers"
```

---

### Task 6: Auth proxy (was middleware)

**Files:**
- Create: `proxy.ts` (at project root — NOT `middleware.ts`)

- [ ] **Step 1: Write `proxy.ts`**

```ts
// proxy.ts — Next.js 16 renamed middleware → proxy
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { env } from "@/lib/env";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/cron/check"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (verifySession(env.APP_SECRET, token)) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Commit**

```bash
git add proxy.ts
git commit -m "feat: auth proxy (Next.js 16 proxy.ts)"
```

---

### Task 7: Login page and login/logout routes

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/logout/route.ts`

- [ ] **Step 1: Login page**

```tsx
// app/login/page.tsx
"use client";
import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) window.location.href = "/";
    else setErr("Wrong password");
  }

  return (
    <main className="min-h-screen grid place-items-center bg-neutral-950 text-neutral-100">
      <form onSubmit={onSubmit} className="w-72 space-y-3">
        <h1 className="text-lg font-semibold">Snipe</h1>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded bg-neutral-900 border border-neutral-800 px-3 py-2"
          placeholder="Password"
        />
        <button
          disabled={busy}
          className="w-full rounded bg-emerald-600 py-2 font-medium disabled:opacity-50"
        >
          {busy ? "…" : "Enter"}
        </button>
        {err && <p className="text-sm text-red-400">{err}</p>}
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Login route**

```ts
// app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";

const body = z.object({ password: z.string().min(1) });

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (parsed.data.password !== env.APP_PASSWORD) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const token = signSession(env.APP_SECRET, Date.now());
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
```

- [ ] **Step 3: Logout route**

```ts
// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
```

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`. Visit `/` → redirected to `/login`. Wrong password → red message. Correct password → redirect to `/`.

- [ ] **Step 5: Commit**

```bash
git add app/login app/api/auth
git commit -m "feat: login page and auth routes"
```

---

### Task 8: Shipping calculator (TDD)

**Files:**
- Create: `lib/shipping.ts`
- Test: `test/shipping.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// test/shipping.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { shippingCost } from "../lib/shipping.ts";

test("bol sold-by-third-party is 0", () => {
  assert.equal(shippingCost("bol", 10, { soldByBol: false }), 0);
  assert.equal(shippingCost("bol", 100, { soldByBol: false }), 0);
});

test("bol sold-by-bol under 25 is 2.99", () => {
  assert.equal(shippingCost("bol", 20, { soldByBol: true }), 2.99);
  assert.equal(shippingCost("bol", 24.99, { soldByBol: true }), 2.99);
});

test("bol sold-by-bol at or above 25 is free", () => {
  assert.equal(shippingCost("bol", 25, { soldByBol: true }), 0);
  assert.equal(shippingCost("bol", 99, { soldByBol: true }), 0);
});

test("bol with unknown seller defaults to sold-by-bol rules (conservative)", () => {
  assert.equal(shippingCost("bol", 10, { soldByBol: null }), 2.99);
});

test("coolblue is always free", () => {
  assert.equal(shippingCost("coolblue", 1, {}), 0);
  assert.equal(shippingCost("coolblue", 999, {}), 0);
});

test("allyourgames uses flat configured rate", () => {
  assert.equal(shippingCost("allyourgames", 30, {}, { allYourGamesFlat: 5.95 }), 5.95);
  assert.equal(shippingCost("allyourgames", 30, {}, { allYourGamesFlat: 4.5 }), 4.5);
});

test("nedgame pre-order is free", () => {
  assert.equal(shippingCost("nedgame", 60, { isPreOrder: true }), 0);
});

test("nedgame under 175 is 6.99", () => {
  assert.equal(shippingCost("nedgame", 30, { isPreOrder: false }), 6.99);
  assert.equal(shippingCost("nedgame", 174.99, { isPreOrder: false }), 6.99);
});

test("nedgame at or above 175 is free", () => {
  assert.equal(shippingCost("nedgame", 175, { isPreOrder: false }), 0);
  assert.equal(shippingCost("nedgame", 300, { isPreOrder: false }), 0);
});
```

- [ ] **Step 2: Run — expect fail**

Run: `npm test -- test/shipping.test.ts`. Expect module-not-found.

- [ ] **Step 3: Implement**

```ts
// lib/shipping.ts
import type { Shop } from "@/lib/db/schema";

export type ShippingFlags = {
  soldByBol?: boolean | null;
  isPreOrder?: boolean;
};

export type ShippingConfig = {
  allYourGamesFlat?: number;
};

export function shippingCost(
  shop: Shop,
  price: number,
  flags: ShippingFlags,
  config: ShippingConfig = {},
): number {
  switch (shop) {
    case "bol": {
      if (flags.soldByBol === false) return 0;
      return price >= 25 ? 0 : 2.99;
    }
    case "coolblue":
      return 0;
    case "allyourgames":
      return config.allYourGamesFlat ?? 5.95;
    case "nedgame":
      if (flags.isPreOrder) return 0;
      return price >= 175 ? 0 : 6.99;
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test -- test/shipping.test.ts`. All 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/shipping.ts test/shipping.test.ts
git commit -m "feat: shipping calculator with per-shop rules"
```

---

### Task 9: Shared fetch helper

**Files:**
- Create: `lib/scrapers/fetch.ts`

- [ ] **Step 1: Implement**

```ts
// lib/scrapers/fetch.ts
const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "nl-BE,nl;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
};

export async function fetchPage(url: string, attempts = 3): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(url, { headers: HEADERS, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/scrapers/fetch.ts
git commit -m "feat: shared fetch helper with browser headers + retries"
```

---

### Task 10: JSON-LD extractor (TDD)

**Files:**
- Create: `lib/scrapers/jsonld.ts`
- Create: `lib/scrapers/types.ts`
- Test: `test/jsonld.test.ts`

- [ ] **Step 1: Write types**

```ts
// lib/scrapers/types.ts
import type { Shop } from "@/lib/db/schema";

export type ScrapeResult = {
  name: string;
  price: number;            // EUR
  imageUrl?: string;
  soldByBol?: boolean;      // only set by bol scraper
};

export type Scraper = {
  shop: Shop;
  scrape: (html: string, url: string) => ScrapeResult;
};
```

- [ ] **Step 2: Write failing test**

```ts
// test/jsonld.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { extractProductJsonLd } from "../lib/scrapers/jsonld.ts";

const html = `<!doctype html><html><head>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Zelda TOTK",
    "image": "https://example.com/z.jpg",
    "offers": {
      "@type": "Offer",
      "price": "59.99",
      "priceCurrency": "EUR",
      "seller": { "@type": "Organization", "name": "Bol.com" }
    }
  }
  </script>
</head><body></body></html>`;

test("extractProductJsonLd returns name/price/image", () => {
  const r = extractProductJsonLd(html);
  assert.equal(r?.name, "Zelda TOTK");
  assert.equal(r?.price, 59.99);
  assert.equal(r?.image, "https://example.com/z.jpg");
  assert.equal(r?.sellerName, "Bol.com");
});

test("extractProductJsonLd handles array offers", () => {
  const multi = html.replace(
    /"offers":\s*\{[^}]*\}[^}]*\}/s,
    '"offers":[{"@type":"Offer","price":"49.99","priceCurrency":"EUR"}]',
  );
  const r = extractProductJsonLd(multi);
  assert.equal(r?.price, 49.99);
});

test("extractProductJsonLd handles @graph wrapper", () => {
  const wrapped = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"Product","name":"X","offers":{"price":"10","priceCurrency":"EUR"}}]}</script>`;
  const r = extractProductJsonLd(wrapped);
  assert.equal(r?.name, "X");
  assert.equal(r?.price, 10);
});

test("extractProductJsonLd returns null when no Product", () => {
  assert.equal(extractProductJsonLd("<html></html>"), null);
});
```

- [ ] **Step 3: Run — expect fail**

Run: `npm test -- test/jsonld.test.ts`. Expect module-not-found.

- [ ] **Step 4: Implement**

```ts
// lib/scrapers/jsonld.ts
import * as cheerio from "cheerio";

export type JsonLdProduct = {
  name?: string;
  price?: number;
  image?: string;
  sellerName?: string;
};

function coercePrice(p: unknown): number | undefined {
  if (typeof p === "number") return p;
  if (typeof p === "string") {
    const n = Number(p.replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function firstOffer(offers: unknown): Record<string, unknown> | undefined {
  if (!offers) return undefined;
  if (Array.isArray(offers)) return offers[0] as Record<string, unknown> | undefined;
  if (typeof offers === "object") return offers as Record<string, unknown>;
  return undefined;
}

function nodesFromBlob(blob: unknown): unknown[] {
  if (!blob) return [];
  if (Array.isArray(blob)) return blob.flatMap(nodesFromBlob);
  if (typeof blob === "object") {
    const o = blob as Record<string, unknown>;
    if (Array.isArray(o["@graph"])) return [...nodesFromBlob(o["@graph"]), o];
    return [o];
  }
  return [];
}

function isProduct(node: unknown): node is Record<string, unknown> {
  if (!node || typeof node !== "object") return false;
  const t = (node as Record<string, unknown>)["@type"];
  if (t === "Product") return true;
  if (Array.isArray(t) && t.includes("Product")) return true;
  return false;
}

export function extractProductJsonLd(html: string): JsonLdProduct | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const s of scripts) {
    const text = $(s).contents().text();
    if (!text) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { continue; }
    for (const node of nodesFromBlob(parsed)) {
      if (!isProduct(node)) continue;
      const n = node as Record<string, unknown>;
      const offer = firstOffer(n.offers);
      const price = coercePrice(offer?.price);
      const image = Array.isArray(n.image) ? (n.image[0] as string) : (n.image as string | undefined);
      const sellerRaw = offer?.seller as Record<string, unknown> | undefined;
      return {
        name: typeof n.name === "string" ? n.name : undefined,
        price,
        image,
        sellerName: typeof sellerRaw?.name === "string" ? sellerRaw.name as string : undefined,
      };
    }
  }
  return null;
}
```

- [ ] **Step 5: Run — expect pass**

Run: `npm test -- test/jsonld.test.ts`. All four tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/scrapers/jsonld.ts lib/scrapers/types.ts test/jsonld.test.ts
git commit -m "feat: JSON-LD Product extractor with @graph + array-offer support"
```

---

### Task 11: Bol scraper (TDD with fixture)

**Files:**
- Create: `test/fixtures/bol.html`
- Create: `lib/scrapers/bol.ts`
- Modify: `test/scrapers.test.ts` (create if absent)

- [ ] **Step 1: Capture a fixture**

Run in terminal (NOT through the app):
```bash
curl -sL -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15" \
  "https://www.bol.com/nl/nl/p/the-legend-of-zelda-tears-of-the-kingdom-nintendo-switch/9300000123456789/" \
  -o test/fixtures/bol.html || true
```

If the curl fails (blocked), fall back to saving any real Bol product page via a browser (View Source → save as `test/fixtures/bol.html`). The fixture must contain `<script type="application/ld+json">` with a Product.

- [ ] **Step 2: Write failing test**

```ts
// test/scrapers.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bolScraper } from "../lib/scrapers/bol.ts";

test("bol scraper extracts name + price from fixture", () => {
  const html = readFileSync("test/fixtures/bol.html", "utf8");
  const r = bolScraper.scrape(html, "https://www.bol.com/nl/nl/p/x/12345/");
  assert.ok(r.name.length > 0, `got name: ${r.name}`);
  assert.ok(r.price > 0, `got price: ${r.price}`);
  assert.equal(typeof r.soldByBol, "boolean");
});
```

- [ ] **Step 3: Run — expect fail**

Run: `npm test -- test/scrapers.test.ts`.

- [ ] **Step 4: Implement**

```ts
// lib/scrapers/bol.ts
import { extractProductJsonLd } from "./jsonld";
import type { Scraper, ScrapeResult } from "./types";

export const bolScraper: Scraper = {
  shop: "bol",
  scrape(html: string): ScrapeResult {
    const ld = extractProductJsonLd(html);
    if (!ld || ld.price == null || !ld.name) {
      throw new Error("bol: JSON-LD Product not found");
    }
    const soldByBol = ld.sellerName
      ? /\bbol(\.com)?\b/i.test(ld.sellerName)
      : false;
    return {
      name: ld.name,
      price: ld.price,
      imageUrl: ld.image,
      soldByBol,
    };
  },
};
```

- [ ] **Step 5: Run — expect pass**

Run: `npm test -- test/scrapers.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add test/fixtures/bol.html lib/scrapers/bol.ts test/scrapers.test.ts
git commit -m "feat: Bol.com scraper"
```

---

### Task 12: Coolblue scraper

**Files:**
- Create: `test/fixtures/coolblue.html`
- Create: `lib/scrapers/coolblue.ts`
- Modify: `test/scrapers.test.ts`

- [ ] **Step 1: Capture fixture**

```bash
curl -sL -A "Mozilla/5.0" "https://www.coolblue.be/nl/product/XXXXXX" -o test/fixtures/coolblue.html || true
```

Use any real product page URL. Verify the file contains a `ld+json` Product.

- [ ] **Step 2: Add test**

Append to `test/scrapers.test.ts`:
```ts
import { coolblueScraper } from "../lib/scrapers/coolblue.ts";

test("coolblue scraper extracts name + price from fixture", () => {
  const html = readFileSync("test/fixtures/coolblue.html", "utf8");
  const r = coolblueScraper.scrape(html, "https://www.coolblue.be/nl/product/x");
  assert.ok(r.name.length > 0);
  assert.ok(r.price > 0);
});
```

- [ ] **Step 3: Run — expect fail**

- [ ] **Step 4: Implement**

```ts
// lib/scrapers/coolblue.ts
import { extractProductJsonLd } from "./jsonld";
import type { Scraper, ScrapeResult } from "./types";

export const coolblueScraper: Scraper = {
  shop: "coolblue",
  scrape(html): ScrapeResult {
    const ld = extractProductJsonLd(html);
    if (!ld || ld.price == null || !ld.name) {
      throw new Error("coolblue: JSON-LD Product not found");
    }
    return { name: ld.name, price: ld.price, imageUrl: ld.image };
  },
};
```

- [ ] **Step 5: Run — expect pass**

- [ ] **Step 6: Commit**

```bash
git add test/fixtures/coolblue.html lib/scrapers/coolblue.ts test/scrapers.test.ts
git commit -m "feat: Coolblue scraper"
```

---

### Task 13: AllYourGames scraper

**Files:**
- Create: `test/fixtures/allyourgames.html`
- Create: `lib/scrapers/allyourgames.ts`
- Modify: `test/scrapers.test.ts`

- [ ] **Step 1: Capture fixture**

```bash
curl -sL -A "Mozilla/5.0" "https://www.allyourgames.nl/<any-product>" -o test/fixtures/allyourgames.html || true
```

- [ ] **Step 2: Add test**

```ts
import { allYourGamesScraper } from "../lib/scrapers/allyourgames.ts";

test("allyourgames scraper extracts name + price from fixture", () => {
  const html = readFileSync("test/fixtures/allyourgames.html", "utf8");
  const r = allYourGamesScraper.scrape(html, "https://www.allyourgames.nl/x");
  assert.ok(r.name.length > 0);
  assert.ok(r.price > 0);
});
```

- [ ] **Step 3: Run — expect fail**

- [ ] **Step 4: Implement**

```ts
// lib/scrapers/allyourgames.ts
import { extractProductJsonLd } from "./jsonld";
import type { Scraper, ScrapeResult } from "./types";

export const allYourGamesScraper: Scraper = {
  shop: "allyourgames",
  scrape(html): ScrapeResult {
    const ld = extractProductJsonLd(html);
    if (!ld || ld.price == null || !ld.name) {
      throw new Error("allyourgames: JSON-LD Product not found");
    }
    return { name: ld.name, price: ld.price, imageUrl: ld.image };
  },
};
```

- [ ] **Step 5: Run — expect pass**

- [ ] **Step 6: Commit**

```bash
git add test/fixtures/allyourgames.html lib/scrapers/allyourgames.ts test/scrapers.test.ts
git commit -m "feat: AllYourGames scraper"
```

---

### Task 14: Nedgame scraper (JSON-LD + DOM fallback)

**Files:**
- Create: `test/fixtures/nedgame.html`
- Create: `lib/scrapers/nedgame.ts`
- Modify: `test/scrapers.test.ts`

- [ ] **Step 1: Capture fixture**

Nedgame often returns 403 without a realistic UA. If curl fails, save the page source from a browser.
```bash
curl -sL \
  -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15" \
  -H "Accept: text/html,application/xhtml+xml" \
  -H "Accept-Language: nl-BE,nl;q=0.9" \
  "https://www.nedgame.nl/<any-product>" -o test/fixtures/nedgame.html || true
```

- [ ] **Step 2: Add test**

```ts
import { nedgameScraper } from "../lib/scrapers/nedgame.ts";

test("nedgame scraper extracts name + price from fixture", () => {
  const html = readFileSync("test/fixtures/nedgame.html", "utf8");
  const r = nedgameScraper.scrape(html, "https://www.nedgame.nl/x");
  assert.ok(r.name.length > 0);
  assert.ok(r.price > 0);
});
```

- [ ] **Step 3: Run — expect fail**

- [ ] **Step 4: Implement with DOM fallback**

```ts
// lib/scrapers/nedgame.ts
import * as cheerio from "cheerio";
import { extractProductJsonLd } from "./jsonld";
import type { Scraper, ScrapeResult } from "./types";

function parseMoney(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/[^0-9,.\-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export const nedgameScraper: Scraper = {
  shop: "nedgame",
  scrape(html): ScrapeResult {
    const ld = extractProductJsonLd(html);
    if (ld?.name && ld.price != null) {
      return { name: ld.name, price: ld.price, imageUrl: ld.image };
    }
    const $ = cheerio.load(html);
    const name =
      $('meta[property="og:title"]').attr("content") ||
      $("h1").first().text().trim();
    const priceText =
      $('meta[property="product:price:amount"]').attr("content") ||
      $('[itemprop="price"]').attr("content") ||
      $('[itemprop="price"]').first().text() ||
      $(".product-price, .price").first().text();
    const price = parseMoney(priceText);
    const imageUrl = $('meta[property="og:image"]').attr("content");
    if (!name || price == null) throw new Error("nedgame: could not find price/name");
    return { name, price, imageUrl };
  },
};
```

- [ ] **Step 5: Run — expect pass**

- [ ] **Step 6: Commit**

```bash
git add test/fixtures/nedgame.html lib/scrapers/nedgame.ts test/scrapers.test.ts
git commit -m "feat: Nedgame scraper with DOM fallback"
```

---

### Task 15: Scraper dispatcher

**Files:**
- Create: `lib/scrapers/index.ts`
- Modify: `test/scrapers.test.ts`

- [ ] **Step 1: Add tests**

Append to `test/scrapers.test.ts`:
```ts
import { shopFromUrl, getScraper } from "../lib/scrapers/index.ts";

test("shopFromUrl detects hostnames", () => {
  assert.equal(shopFromUrl("https://www.bol.com/nl/nl/p/x/123/"), "bol");
  assert.equal(shopFromUrl("https://bol.com/p/x"), "bol");
  assert.equal(shopFromUrl("https://www.coolblue.be/nl/product/x"), "coolblue");
  assert.equal(shopFromUrl("https://www.coolblue.nl/product/x"), "coolblue");
  assert.equal(shopFromUrl("https://www.allyourgames.nl/x"), "allyourgames");
  assert.equal(shopFromUrl("https://www.nedgame.nl/x"), "nedgame");
  assert.equal(shopFromUrl("https://example.com/"), null);
});

test("getScraper returns scraper per shop", () => {
  assert.equal(getScraper("bol").shop, "bol");
  assert.equal(getScraper("nedgame").shop, "nedgame");
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement**

```ts
// lib/scrapers/index.ts
import type { Shop } from "@/lib/db/schema";
import type { Scraper } from "./types";
import { bolScraper } from "./bol";
import { coolblueScraper } from "./coolblue";
import { allYourGamesScraper } from "./allyourgames";
import { nedgameScraper } from "./nedgame";

const scrapers: Record<Shop, Scraper> = {
  bol: bolScraper,
  coolblue: coolblueScraper,
  allyourgames: allYourGamesScraper,
  nedgame: nedgameScraper,
};

export function getScraper(shop: Shop): Scraper {
  return scrapers[shop];
}

export function shopFromUrl(url: string): Shop | null {
  let host: string;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return null; }
  if (host.endsWith("bol.com")) return "bol";
  if (host.endsWith("coolblue.be") || host.endsWith("coolblue.nl")) return "coolblue";
  if (host.endsWith("allyourgames.nl")) return "allyourgames";
  if (host.endsWith("nedgame.nl")) return "nedgame";
  return null;
}

export type { Scraper, ScrapeResult } from "./types";
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/index.ts test/scrapers.test.ts
git commit -m "feat: scraper dispatcher and shop-from-url"
```

---

### Task 16: Notify client (TDD)

**Files:**
- Create: `lib/notify.ts`
- Test: `test/notify.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// test/notify.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { buildNotification } from "../lib/notify.ts";

test("buildNotification: drop uses cha_ching", () => {
  const n = buildNotification({
    name: "Zelda",
    url: "https://bol.com/x",
    oldTotal: 70,
    newTotal: 59.99,
  });
  assert.equal(n.sound, "cha_ching");
  assert.equal(n.title, "Zelda");
  assert.match(n.message, /€70\.00/);
  assert.match(n.message, /€59\.99/);
  assert.equal(n.open_url, "https://bol.com/x");
});

test("buildNotification: rise uses warm_soft_error", () => {
  const n = buildNotification({
    name: "X",
    url: "https://example.com",
    oldTotal: 10,
    newTotal: 12.5,
  });
  assert.equal(n.sound, "warm_soft_error");
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement**

```ts
// lib/notify.ts
import { env } from "@/lib/env";

export type NotificationPayload = {
  title: string;
  message: string;
  open_url: string;
  sound: "cha_ching" | "warm_soft_error";
};

export function buildNotification(input: {
  name: string;
  url: string;
  oldTotal: number;
  newTotal: number;
}): NotificationPayload {
  const fmt = (n: number) => `€${n.toFixed(2)}`;
  return {
    title: input.name,
    message: `${fmt(input.oldTotal)} → ${fmt(input.newTotal)}`,
    open_url: input.url,
    sound: input.newTotal < input.oldTotal ? "cha_ching" : "warm_soft_error",
  };
}

export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const res = await fetch("https://api.brrr.now/v1/send", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${env.BRRR_WEBHOOK_SECRET}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`brrr.now ${res.status}: ${await res.text().catch(() => "")}`);
  }
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add lib/notify.ts test/notify.test.ts
git commit -m "feat: brrr.now notification client"
```

---

### Task 17: Check orchestrator

**Files:**
- Create: `lib/check.ts`
- Create: `lib/format.ts`
- Create: `lib/db/queries.ts`

- [ ] **Step 1: Write queries**

```ts
// lib/db/queries.ts
import { eq, desc } from "drizzle-orm";
import { db, schema } from "./client";

export async function listProducts() {
  return db.select().from(schema.products).orderBy(desc(schema.products.updatedAt));
}

export async function getProduct(id: number) {
  const rows = await db.select().from(schema.products).where(eq(schema.products.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getHistory(productId: number, limit = 30) {
  return db
    .select()
    .from(schema.priceHistory)
    .where(eq(schema.priceHistory.productId, productId))
    .orderBy(desc(schema.priceHistory.checkedAt))
    .limit(limit);
}

export async function insertHistory(row: typeof schema.priceHistory.$inferInsert) {
  await db.insert(schema.priceHistory).values(row);
}

export async function updateProduct(
  id: number,
  patch: Partial<typeof schema.products.$inferInsert>,
) {
  await db
    .update(schema.products)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.products.id, id));
}

export async function insertProduct(p: typeof schema.products.$inferInsert) {
  const rows = await db.insert(schema.products).values(p).returning();
  return rows[0];
}

export async function deleteProduct(id: number) {
  await db.delete(schema.products).where(eq(schema.products.id, id));
}

export async function findProductByUrl(url: string) {
  const rows = await db.select().from(schema.products).where(eq(schema.products.url, url)).limit(1);
  return rows[0] ?? null;
}
```

- [ ] **Step 2: Format helpers**

```ts
// lib/format.ts
export const money = (n: number | string) =>
  `€${Number(n).toFixed(2).replace(".", ",")}`;

export function relativeTime(d: Date | string | null | undefined): string {
  if (!d) return "never";
  const when = typeof d === "string" ? new Date(d) : d;
  const diffMs = Date.now() - when.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
```

- [ ] **Step 3: Orchestrator**

```ts
// lib/check.ts
import { env } from "@/lib/env";
import { shippingCost } from "@/lib/shipping";
import { getScraper } from "@/lib/scrapers";
import { fetchPage } from "@/lib/scrapers/fetch";
import { buildNotification, sendNotification } from "@/lib/notify";
import { insertHistory, updateProduct } from "@/lib/db/queries";
import type { Product } from "@/lib/db/schema";

export type CheckOutcome =
  | { ok: true; changed: boolean; price: number; totalCost: number }
  | { ok: false; error: string };

export async function checkProduct(product: Product): Promise<CheckOutcome> {
  try {
    const html = await fetchPage(product.url);
    const scraper = getScraper(product.shop);
    const result = scraper.scrape(html, product.url);
    const shipping = shippingCost(
      product.shop,
      result.price,
      {
        soldByBol: result.soldByBol ?? product.soldByBol,
        isPreOrder: product.isPreOrder,
      },
      { allYourGamesFlat: env.ALLYOURGAMES_SHIPPING },
    );
    const totalCost = Number((result.price + shipping).toFixed(2));
    const price = Number(result.price.toFixed(2));
    const prevTotal = Number(product.lastTotalCost);
    const changed = totalCost !== prevTotal;

    await insertHistory({
      productId: product.id,
      price: price.toFixed(2),
      totalCost: totalCost.toFixed(2),
    });

    const patch: Record<string, unknown> = {
      lastCheckedAt: new Date(),
      lastError: null,
    };
    if (result.soldByBol !== undefined && result.soldByBol !== product.soldByBol) {
      patch.soldByBol = result.soldByBol;
    }
    if (changed) {
      patch.lastPrice = price.toFixed(2);
      patch.lastTotalCost = totalCost.toFixed(2);
      patch.name = result.name;
      if (result.imageUrl) patch.imageUrl = result.imageUrl;
    }
    await updateProduct(product.id, patch);

    if (changed) {
      try {
        await sendNotification(
          buildNotification({
            name: result.name || product.name,
            url: product.url,
            oldTotal: prevTotal,
            newTotal: totalCost,
          }),
        );
      } catch (e) {
        console.error("notify failed:", (e as Error).message);
      }
    }
    return { ok: true, changed, price, totalCost };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await updateProduct(product.id, { lastCheckedAt: new Date(), lastError: msg });
    return { ok: false, error: msg };
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/check.ts lib/format.ts lib/db/queries.ts
git commit -m "feat: per-product check orchestrator"
```

---

### Task 18: POST /api/products (add) and GET /api/products (list)

**Files:**
- Create: `app/api/products/route.ts`

- [ ] **Step 1: Write route**

```ts
// app/api/products/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { shopFromUrl, getScraper } from "@/lib/scrapers";
import { fetchPage } from "@/lib/scrapers/fetch";
import { shippingCost } from "@/lib/shipping";
import { findProductByUrl, insertProduct, listProducts, insertHistory } from "@/lib/db/queries";

const body = z.object({
  url: z.string().url(),
  targetPrice: z.number().positive().optional(),
  isPreOrder: z.boolean().optional(),
});

export async function GET() {
  const rows = await listProducts();
  return NextResponse.json({ products: rows });
}

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { url, targetPrice, isPreOrder } = parsed.data;

  const shop = shopFromUrl(url);
  if (!shop) return NextResponse.json({ error: "unsupported_shop" }, { status: 400 });

  const existing = await findProductByUrl(url);
  if (existing) return NextResponse.json({ error: "duplicate", id: existing.id }, { status: 409 });

  let scrape;
  try {
    const html = await fetchPage(url);
    scrape = getScraper(shop).scrape(html, url);
  } catch (e) {
    return NextResponse.json(
      { error: "scrape_failed", detail: (e as Error).message },
      { status: 502 },
    );
  }

  const shipping = shippingCost(
    shop,
    scrape.price,
    { soldByBol: scrape.soldByBol ?? null, isPreOrder: isPreOrder ?? false },
    { allYourGamesFlat: env.ALLYOURGAMES_SHIPPING },
  );
  const totalCost = Number((scrape.price + shipping).toFixed(2));
  const price = Number(scrape.price.toFixed(2));

  const inserted = await insertProduct({
    url,
    shop,
    name: scrape.name,
    imageUrl: scrape.imageUrl,
    isPreOrder: isPreOrder ?? false,
    soldByBol: scrape.soldByBol ?? null,
    lastPrice: price.toFixed(2),
    lastTotalCost: totalCost.toFixed(2),
    targetPrice: targetPrice !== undefined ? targetPrice.toFixed(2) : null,
    lastCheckedAt: new Date(),
  });
  await insertHistory({
    productId: inserted.id,
    price: price.toFixed(2),
    totalCost: totalCost.toFixed(2),
  });

  return NextResponse.json({ product: inserted });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/products/route.ts
git commit -m "feat: products list + add API"
```

---

### Task 19: GET/PATCH/DELETE /api/products/[id]

**Files:**
- Create: `app/api/products/[id]/route.ts`

- [ ] **Step 1: Write route (remember Next.js 16 async params)**

```ts
// app/api/products/[id]/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getProduct, getHistory, updateProduct, deleteProduct } from "@/lib/db/queries";

const patch = z.object({
  targetPrice: z.number().positive().nullable().optional(),
  isPreOrder: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });
  const product = await getProduct(id);
  if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const history = await getHistory(id, 90);
  return NextResponse.json({ product, history });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const patchRow: Record<string, unknown> = {};
  if (parsed.data.targetPrice === null) patchRow.targetPrice = null;
  else if (parsed.data.targetPrice !== undefined)
    patchRow.targetPrice = parsed.data.targetPrice.toFixed(2);
  if (parsed.data.isPreOrder !== undefined) patchRow.isPreOrder = parsed.data.isPreOrder;
  await updateProduct(id, patchRow);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });
  await deleteProduct(id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/products/[id]/route.ts
git commit -m "feat: per-product GET/PATCH/DELETE API"
```

---

### Task 20: POST /api/products/[id]/check (manual recheck)

**Files:**
- Create: `app/api/products/[id]/check/route.ts`

- [ ] **Step 1: Write route**

```ts
// app/api/products/[id]/check/route.ts
import { NextResponse } from "next/server";
import { getProduct } from "@/lib/db/queries";
import { checkProduct } from "@/lib/check";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });
  const product = await getProduct(id);
  if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const outcome = await checkProduct(product);
  return NextResponse.json(outcome);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/products/[id]/check/route.ts
git commit -m "feat: manual recheck API"
```

---

### Task 21: POST /api/cron/check (scheduled sweep)

**Files:**
- Create: `app/api/cron/check/route.ts`

- [ ] **Step 1: Write route**

```ts
// app/api/cron/check/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { listProducts } from "@/lib/db/queries";
import { checkProduct } from "@/lib/check";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // seconds; Railway is fine with long requests

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const products = shuffle(await listProducts());
  let changed = 0;
  let errors = 0;
  for (const p of products) {
    const outcome = await checkProduct(p);
    if (!outcome.ok) errors++;
    else if (outcome.changed) changed++;
    await new Promise((r) => setTimeout(r, 500));
  }
  return NextResponse.json({ checked: products.length, changed, errors });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/cron/check/route.ts
git commit -m "feat: cron sweep endpoint protected by CRON_SECRET"
```

---

### Task 22: Sparkline component

**Files:**
- Create: `components/Sparkline.tsx`

- [ ] **Step 1: Write component**

```tsx
// components/Sparkline.tsx
type Props = {
  values: number[];           // oldest → newest
  width?: number;
  height?: number;
  className?: string;
};

export function Sparkline({ values, width = 120, height = 28, className }: Props) {
  if (values.length < 2) {
    return <svg width={width} height={height} className={className} />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = values[values.length - 1];
  const first = values[0];
  const stroke = last < first ? "#10b981" : last > first ? "#ef4444" : "#737373";
  return (
    <svg width={width} height={height} className={className} aria-hidden="true">
      <polyline fill="none" stroke={stroke} strokeWidth="1.5" points={points} />
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/Sparkline.tsx
git commit -m "feat: inline SVG sparkline"
```

---

### Task 23: Product list page

**Files:**
- Modify: `app/page.tsx`
- Create: `app/products/actions.ts` (client helpers)

- [ ] **Step 1: Replace `app/page.tsx`**

```tsx
// app/page.tsx
import Link from "next/link";
import { desc, asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { money, relativeTime } from "@/lib/format";
import { Sparkline } from "@/components/Sparkline";
import AddProductForm from "./AddProductForm";

export const dynamic = "force-dynamic";

async function getData() {
  const products = await db.select().from(schema.products).orderBy(desc(schema.products.updatedAt));
  const histories = await Promise.all(
    products.map((p) =>
      db
        .select()
        .from(schema.priceHistory)
        .where(eq(schema.priceHistory.productId, p.id))
        .orderBy(asc(schema.priceHistory.checkedAt))
        .limit(30),
    ),
  );
  return products.map((p, i) => ({ product: p, history: histories[i] }));
}

export default async function Home() {
  const rows = await getData();
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-3xl p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Snipe</h1>
          <form action="/api/auth/logout" method="post">
            <button className="text-sm text-neutral-400 hover:text-neutral-100">Logout</button>
          </form>
        </header>
        <AddProductForm />
        <ul className="space-y-2">
          {rows.map(({ product, history }) => {
            const hit =
              product.targetPrice != null &&
              Number(product.lastTotalCost) <= Number(product.targetPrice);
            const values = history.map((h) => Number(h.totalCost));
            return (
              <li
                key={product.id}
                className={
                  "rounded border border-neutral-800 bg-neutral-900 p-3 flex items-center gap-4 " +
                  (hit ? "ring-1 ring-emerald-500/60" : "")
                }
              >
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt="" className="h-12 w-12 rounded object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded bg-neutral-800" />
                )}
                <div className="flex-1 min-w-0">
                  <Link href={`/products/${product.id}`} className="block truncate hover:underline">
                    {product.name}
                  </Link>
                  <div className="text-xs text-neutral-400 flex items-center gap-2">
                    <span className="uppercase tracking-wide">{product.shop}</span>
                    <span>·</span>
                    <span>{relativeTime(product.lastCheckedAt)}</span>
                    {product.lastError && (
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" title={product.lastError} />
                    )}
                  </div>
                </div>
                <Sparkline values={values} />
                <div className="text-right">
                  <div className="text-sm">{money(product.lastTotalCost)}</div>
                  <div className="text-xs text-neutral-400">{money(product.lastPrice)} + ship</div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Add-product form (client)**

```tsx
// app/AddProductForm.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddProductForm() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
    setBusy(false);
    if (res.ok) {
      setUrl("");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setErr(j.error === "unsupported_shop" ? "Unsupported shop" : j.detail || "Failed");
    }
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste product URL"
        required
        className="flex-1 rounded bg-neutral-900 border border-neutral-800 px-3 py-2"
      />
      <button
        disabled={busy || !url}
        className="rounded bg-emerald-600 px-3 py-2 disabled:opacity-50"
      >
        {busy ? "…" : "Add"}
      </button>
      {err && <p className="text-sm text-red-400 w-full">{err}</p>}
    </form>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx app/AddProductForm.tsx
git commit -m "feat: product list + add form"
```

---

### Task 24: Product detail page

**Files:**
- Create: `app/products/[id]/page.tsx`
- Create: `app/products/[id]/ProductControls.tsx`

- [ ] **Step 1: Server page**

```tsx
// app/products/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProduct, getHistory } from "@/lib/db/queries";
import { money, relativeTime } from "@/lib/format";
import ProductControls from "./ProductControls";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) notFound();
  const product = await getProduct(id);
  if (!product) notFound();
  const history = await getHistory(id, 90);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-3xl p-6 space-y-6">
        <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-100">← Back</Link>
        <header className="flex items-start gap-4">
          {product.imageUrl && (
            <img src={product.imageUrl} alt="" className="h-20 w-20 rounded object-cover" />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold">{product.name}</h1>
            <p className="text-xs text-neutral-400">
              <a href={product.url} target="_blank" rel="noreferrer" className="hover:underline">
                {new URL(product.url).hostname}
              </a>
              {" · "}
              {relativeTime(product.lastCheckedAt)}
              {product.lastError && (
                <span className="ml-2 text-red-400">error: {product.lastError}</span>
              )}
            </p>
            <div className="mt-2 text-sm">
              {money(product.lastTotalCost)}{" "}
              <span className="text-neutral-400">
                ({money(product.lastPrice)} + shipping)
              </span>
            </div>
          </div>
        </header>

        <ProductControls
          id={product.id}
          shop={product.shop}
          targetPrice={product.targetPrice ? Number(product.targetPrice) : null}
          isPreOrder={product.isPreOrder}
        />

        <section>
          <h2 className="text-sm font-semibold text-neutral-300 mb-2">History</h2>
          <ul className="text-sm divide-y divide-neutral-800">
            {history.map((h) => (
              <li key={h.id} className="py-1.5 flex justify-between">
                <span className="text-neutral-400">
                  {new Date(h.checkedAt).toLocaleString()}
                </span>
                <span>
                  {money(h.totalCost)}{" "}
                  <span className="text-neutral-500">({money(h.price)})</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Client controls**

```tsx
// app/products/[id]/ProductControls.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  id: number;
  shop: string;
  targetPrice: number | null;
  isPreOrder: boolean;
};

export default function ProductControls({ id, shop, targetPrice, isPreOrder }: Props) {
  const router = useRouter();
  const [target, setTarget] = useState(targetPrice != null ? String(targetPrice) : "");
  const [preorder, setPreorder] = useState(isPreOrder);
  const [busy, setBusy] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy("save");
    await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    router.refresh();
  }

  async function checkNow() {
    setBusy("check");
    await fetch(`/api/products/${id}/check`, { method: "POST" });
    setBusy(null);
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this product?")) return;
    setBusy("delete");
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    setBusy(null);
    window.location.href = "/";
  }

  return (
    <div className="space-y-3 rounded border border-neutral-800 bg-neutral-900 p-3">
      <div className="flex items-center gap-2">
        <label className="text-sm text-neutral-400 w-32">Target price</label>
        <input
          type="number"
          step="0.01"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-28 rounded bg-neutral-950 border border-neutral-800 px-2 py-1"
          placeholder="—"
        />
        <button
          onClick={() => patch({ targetPrice: target ? Number(target) : null })}
          className="rounded bg-neutral-800 px-3 py-1 text-sm"
          disabled={busy !== null}
        >
          Save
        </button>
      </div>
      {shop === "nedgame" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={preorder}
            onChange={(e) => {
              setPreorder(e.target.checked);
              patch({ isPreOrder: e.target.checked });
            }}
          />
          Pre-order (free shipping)
        </label>
      )}
      <div className="flex gap-2 pt-2">
        <button
          onClick={checkNow}
          disabled={busy !== null}
          className="rounded bg-emerald-600 px-3 py-1 text-sm disabled:opacity-50"
        >
          {busy === "check" ? "Checking…" : "Check now"}
        </button>
        <button
          onClick={remove}
          disabled={busy !== null}
          className="rounded bg-red-900/70 px-3 py-1 text-sm disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/products/[id]
git commit -m "feat: product detail page with controls"
```

---

### Task 25: End-to-end manual verification

- [ ] **Step 1: Start local Postgres** (or point `DATABASE_URL` at Railway dev DB). Run `npm run db:migrate`.

- [ ] **Step 2: Start dev server**

Run: `npm run dev`

- [ ] **Step 3: Login flow** — visit `/`, get redirected to `/login`, enter `APP_PASSWORD`, arrive at `/`.

- [ ] **Step 4: Add a product** — paste a real URL from each of the four shops. Verify rows appear with name, price, total, sparkline starts as a single point (not visible until 2+ history entries).

- [ ] **Step 5: Manual recheck** — open detail page, click "Check now", verify `lastCheckedAt` updates and a new history row appears.

- [ ] **Step 6: Target-price highlight** — set targetPrice above current total → card gets green ring.

- [ ] **Step 7: Force a notification** — temporarily SET `last_total_cost` to a different value in the DB (or point a scraper's fixture at a different price) → run the cron endpoint:
```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/check
```
Expect a brrr.now push and the row to resync.

- [ ] **Step 8: Cron auth check** — same curl without the header returns 401.

- [ ] **Step 9: Run all unit tests**

Run: `npm test`
Expected: all suites pass.

---

### Task 26: README + Railway deploy config

**Files:**
- Create: `README.md` (replace; spec is tracked as the design doc)
- Create: `railway.json` (optional, declares cron job)

- [ ] **Step 1: Write README**

```markdown
# Snipe — Price Tracker

Personal price tracker for Bol.com, Coolblue, AllYourGames.nl and Nedgame.nl. Pushes to brrr.now when total cost (price + shipping) changes.

See `docs/superpowers/specs/2026-04-19-price-tracker-design.md` for design notes.

## Local setup

1. Install Postgres locally (or use a Railway dev DB).
2. `cp .env.example .env.local` and fill values.
3. `npm install`
4. `npm run db:generate` (only if schema changed)
5. `npm run db:migrate`
6. `npm run dev`

## Tests

`npm test`

## Deploy to Railway

1. Create a new project in your existing workspace → "Deploy from GitHub".
2. Add a Postgres plugin. Copy its `DATABASE_URL` into the service's env vars.
3. Add these env vars to the service:
   - `APP_PASSWORD`
   - `APP_SECRET` (32+ random bytes, hex)
   - `CRON_SECRET` (random)
   - `BRRR_WEBHOOK_SECRET`
   - `APP_URL` — the public URL Railway assigns
   - `ALLYOURGAMES_SHIPPING` (optional)
4. After first deploy, run the migration via Railway shell: `npm run db:migrate`.
5. Add a **Cron Job** in the Railway service settings:
   - Schedule: `0 */4 * * *`
   - Command: `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/check"`

## Supported shops

| Shop | Parsing | Shipping to BE |
|---|---|---|
| Bol.com | JSON-LD | €2.99 under €25 (sold-by-Bol only), free ≥€25, third-party €0 |
| Coolblue | JSON-LD | Always €0 |
| AllYourGames.nl | JSON-LD | Flat (default €5.95) |
| Nedgame.nl | JSON-LD + DOM fallback | €6.99 under €175, free ≥€175, pre-orders free |

## Non-goals

No Amazon, MediaMarkt, multi-user, email notifications, or ML.
```

- [ ] **Step 2: Remove the old `README.md` deletion from git status**

If `git status` shows `D README.md`, the new Write will re-add it; stage with `git add README.md`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README with local and Railway setup"
```

- [ ] **Step 4: Final sanity build**

Run: `npm run build`
Expected: succeeds with zero type errors.

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit any final tweaks and tag**

If there are any minor fixes from the build, commit them. Plan complete.
