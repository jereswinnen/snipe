# Price Tracker — Build Spec

Build a personal price tracking web app that monitors product prices across Dutch/Belgian shops and sends push notifications when prices change.

## Stack
- **Next.js** (App Router, TypeScript) — UI + API + cron worker in one service
- **Postgres** (Railway-hosted) with **Drizzle ORM**
- **Cheerio** for HTML parsing
- **node-cron** for scheduling
- Deploy to **Railway** (separate project in existing workspace)

## Shops to support

| Shop | Parsing | Shipping to BE |
|---|---|---|
| Bol.com | JSON-LD `Product` schema | €2.99 under €25, free ≥€25 (only if sold by Bol itself; third-party = €0, baked in) |
| Coolblue | JSON-LD | Always €0 (normal delivery free in BE) |
| AllYourGames.nl | JSON-LD (Lightspeed/Webshopapp platform) | Flat ~€5.95 (verify at checkout, make configurable) |
| Nedgame.nl | DOM selectors (JSON-LD may be absent) — **needs realistic User-Agent + Accept headers to avoid 403** | €6.99 under €175, free ≥€175, pre-orders always free |

## Data model (Drizzle)

```ts
products: {
  id, url, shop, name,
  isPreOrder: boolean,        // Nedgame-specific, user-toggleable
  soldByBol: boolean | null,  // Bol-specific, detected from offers.seller
  lastPrice: number,
  lastTotalCost: number,      // price + shipping
  targetPrice: number | null, // optional alert threshold
  createdAt, updatedAt
}
priceHistory: {
  id, productId, price, totalCost, checkedAt
}
```

## Core logic

1. Cron every 3-6 hours (stagger per-shop to avoid bursts).
2. For each product: fetch page → extract price (JSON-LD first, DOM fallback) → calculate totalCost via per-shop shipping rule → compare to lastTotalCost.
3. **Notify only when totalCost changes** (not raw price — handles free shipping threshold crossings cleanly).
4. Always write to priceHistory; update product row only on change.

## Notifications (brrr.now)

POST to `https://api.brrr.now/v1/send` with `Authorization: Bearer <secret>` (secret in env var, not URL).

```json
{
  "title": "<product name>",
  "message": "€<old total> → €<new total>",
  "open_url": "<product url>",
  "sound": "cha_ching"
}
```

Use `cha_ching` if price dropped, `warm_soft_error` if rose. Docs: https://brrr.now/docs

## UI (minimal)

- List of tracked products with current price, total cost, last change, mini sparkline
- Add product: paste URL → detect shop from hostname → fetch once to populate name/price → save
- Per-product: edit target price, toggle isPreOrder, view full price history, delete
- Single-user, protect with a simple env-based password or basic auth

## Parser pattern

```ts
async function checkProduct(product) {
  const html = await fetch(product.url, { headers: realisticBrowserHeaders }).then(r => r.text())
  const priceData = extractJsonLd(html) ?? fallbackParse(html, product.shop)
  const shipping = shippingCost(product.shop, priceData.price, {
    soldByBol: product.soldByBol,
    isPreOrder: product.isPreOrder,
  })
  const totalCost = priceData.price + shipping
  if (totalCost !== product.lastTotalCost) {
    await notify(product, priceData.price, totalCost)
    await db.update(...)
  }
  await db.insertHistory(...)
}
```

## Non-goals (explicitly skip)

- Amazon, MediaMarkt (anti-bot protection, not worth the complexity)
- Multi-user, auth providers, billing
- Price predictions, ML, "best time to buy" analytics
- Email notifications (brrr only)

## Env vars

`DATABASE_URL`, `BRRR_WEBHOOK_SECRET`, `APP_PASSWORD`

## Deliverable

Single Next.js repo, deployable to Railway via GitHub integration. README with local setup + deploy instructions.
