# Snipe API

JSON over HTTPS. Every authenticated request needs either a browser session
cookie **or** a Bearer token (native clients). Both point at the same
HMAC-signed session issued by `POST /api/auth/login`.

Base URL: whatever your Railway deployment URL is (e.g.
`https://snipe.up.railway.app`).

---

## Authentication

### POST /api/auth/login

Exchanges the app password for a session token. On the web the cookie is
set automatically and the token in the body is ignored; on iOS, store the
token in Keychain and send it with every subsequent request.

**Request**

```json
{ "password": "your-shared-app-password" }
```

**Response `200`**

```json
{ "ok": true, "token": "1776638032123.3fa1b2c..." }
```

**Errors**

- `401 unauthorized` — wrong password.

Keep the token client-side for 30 days (that's the server-side lifetime).
After expiry, you'll get a `401` and should prompt the user to log in again.

---

### POST /api/auth/logout

Clears the web cookie. Native clients can just delete the token from
Keychain — there's no server-side revocation — but calling this is safe.

**Response `200`** `{ "ok": true }`

---

### Sending the Bearer token

On every request after login:

```
Authorization: Bearer 1776638032123.3fa1b2c...
```

Tokens that fail to verify return `401 unauthorized` with the standard
error envelope.

---

## Error envelope

Every 4xx/5xx body:

```json
{ "error": "duplicate_url", "message": "This URL is already tracked" }
```

Stable codes (case-sensitive, safe to switch on):

| Code               | Typical status | Meaning                                      |
|--------------------|----------------|----------------------------------------------|
| `bad_request`      | 400            | Body failed validation                       |
| `bad_id`           | 400            | Path param isn't a number                    |
| `unauthorized`     | 401            | Missing/invalid session                      |
| `not_found`        | 404            | Resource doesn't exist                       |
| `group_not_found`  | 404            | Parent group id doesn't exist                |
| `duplicate_url`    | 409            | URL is already attached to a listing         |
| `unsupported_shop` | 400            | No connector matches this URL's host         |
| `scrape_failed`    | 502            | Couldn't read the shop page (`message` has the reason) |

---

## Groups

A **group** represents one product across stores. It owns the title,
image, target price, and aggregates one or more **listings** (per-shop
price trackers).

### GET /api/groups

Every group plus its currently-cheapest listing.

**Query**

- `m=digital` or `m=physical` (optional) — filter by the cheapest
  listing's medium.

**Response `200`**

```json
{
  "groups": [
    {
      "group": {
        "id": 12,
        "title": "Sonic Frontiers",
        "imageUrl": "https://.../sonic.png",
        "targetPrice": "25.00",
        "createdAt": "2026-03-01T10:00:00.000Z",
        "updatedAt": "2026-04-20T09:50:00.000Z"
      },
      "cheapest": { /* full Listing object, see below */ },
      "shops": ["nintendo", "bol"]
    }
  ]
}
```

`shops` is ordered with the cheapest shop first.

---

### POST /api/groups

Create a new group from a single URL. The server scrapes, creates the
group, then creates the first listing inside it.

**Request**

```json
{
  "url": "https://www.nintendo.com/nl-be/Games/.../Sonic-Frontiers-2233221.html",
  "targetPrice": 25.00
}
```

`targetPrice` is optional.

**Response `200`**

```json
{ "group": { /* ProductGroup */ }, "listing": { /* Listing */ } }
```

**Errors:** `bad_request`, `unsupported_shop`, `duplicate_url`, `scrape_failed`.

---

### GET /api/groups/[id]

Full detail for one group.

**Response `200`**

```json
{
  "group": { /* ProductGroup */ },
  "listings": [ /* Listing[], cheapest first */ ]
}
```

**Errors:** `bad_id`, `not_found`.

---

### PATCH /api/groups/[id]

Update any combination of the group-level fields.

**Request**

```json
{
  "title": "Sonic Frontiers (Switch)",
  "imageUrl": "https://.../new.png",
  "targetPrice": 20.00
}
```

All three fields are optional. Pass `targetPrice: null` to clear.

**Response `200`** `{ "ok": true }`

---

### DELETE /api/groups/[id]

Deletes the group and every listing under it (cascades).

**Response `200`** `{ "ok": true }`

---

### POST /api/groups/[id]/listings

Attach a new URL (another store) to an existing group. Same scrape +
validation as creating a group; fails with `duplicate_url` if the URL
is tracked anywhere (including under another group).

**Request**

```json
{ "url": "https://www.bol.com/.../sonic-frontiers/..." }
```

**Response `200`** `{ "listing": { /* Listing */ } }`

**Errors:** `bad_id`, `bad_request`, `group_not_found`, `unsupported_shop`,
`duplicate_url`, `scrape_failed`.

---

### GET /api/groups/[id]/trend

Chart data for the group's detail page.

**Query**

- `days=90` (default 90, max 3650) — window size.

**Response `200`**

```json
{
  "days": 90,
  "series": [
    {
      "shop": "nintendo",
      "listingId": 42,
      "points": [
        { "checkedAt": "2026-04-19T20:05:00.000Z", "value": 17.99 }
      ]
    }
  ],
  "cheapestOverTime": [
    { "checkedAt": "2026-04-19T20:05:00.000Z", "value": 17.99 }
  ]
}
```

`cheapestOverTime` is the min-across-listings at each moment; suitable
for a single hero line on the detail screen. `series` has one entry
per listing for multi-line charts.

---

## Listings

A **listing** is a price tracker for one URL on one shop, owned by a
group.

### GET /api/listings/[id]

Metadata only. For price history, call the `/history` subroute.

**Response `200`** `{ "listing": { /* Listing */ } }`

---

### DELETE /api/listings/[id]

Removes the listing. If it was the last listing in its group, the group
is auto-deleted — watch `deletedGroup` to know whether to pop back to
the list screen.

**Response `200`**

```json
{ "ok": true, "deletedGroup": true }
```

---

### POST /api/listings/[id]/check

Trigger a rescrape for one listing. Runs synchronously (usually 1–3 s).

**Response `200`**

```json
{ "ok": true, "changed": true, "price": 17.99, "totalCost": 17.99 }
```

Or on failure:

```json
{ "ok": false, "error": "bol: JSON-LD Product not found (...)" }
```

(`error` here is the message, not an envelope code — it's the scrape
error text and is meant to surface in the UI.)

---

### GET /api/listings/[id]/history

Price history within a date window.

**Query**

- `days=90` (default 90, max 3650).

**Response `200`**

```json
{
  "days": 90,
  "points": [
    { "checkedAt": "2026-04-19T20:05:00.000Z", "price": 17.99, "totalCost": 17.99 }
  ]
}
```

Points are ordered chronologically (oldest first).

---

## Devices (push)

### POST /api/devices

Register or refresh an APNs device token. Idempotent on `apnsToken`
(same token → updates `lastSeenAt`).

**Request**

```json
{
  "apnsToken": "a1b2c3...64hex",
  "bundleId": "be.jeremys.snipe",
  "environment": "sandbox"
}
```

`environment` is `"sandbox"` for Xcode/TestFlight dev builds and
`"production"` for App Store builds. Wrong values will simply fail to
deliver — Apple returns `BadDeviceToken` and the server prunes the row.

**Response `200`** `{ "device": { /* Device */ } }`

---

### DELETE /api/devices/[token]

Unregister. Call this on sign-out or when the user disables push.

**Response `200`** `{ "ok": true }`

---

## Model shapes

### Group (returned as `group`)

```swift
struct Group: Codable {
  let id: Int
  let title: String
  let imageUrl: String?
  let targetPrice: String?        // decimal as string ("25.00") or null
  let createdAt: String           // ISO 8601
  let updatedAt: String
}
```

### Listing (returned as `listing`, `cheapest`, or elements of `listings`)

```swift
struct Listing: Codable {
  let id: Int
  let groupId: Int?
  let url: String
  let shop: String                // "bol" | "coolblue" | "allyourgames" | "nedgame" | "nintendo" | "dreamland"
  let medium: String              // "digital" | "physical"
  let name: String
  let imageUrl: String?
  let soldByBol: Bool?            // only set for bol listings
  let lastPrice: String           // decimal as string
  let lastTotalCost: String
  let lastRegularPrice: String?   // set when the current price reflects an active discount
  let lastSaleEndsAt: String?     // ISO 8601 end of the active discount, or null
  let saleEndNotifiedFor: String? // internal bookkeeping; safe to ignore on the client
  let lastCheckedAt: String?
  let lastError: String?
  let createdAt: String
  let updatedAt: String
}
```

Prices are strings (not numbers) to avoid float rounding — convert
client-side with `Decimal(string:)`.

### Point (chart data)

```swift
struct PricePoint: Codable {
  let checkedAt: String   // ISO 8601
  let price: Double
  let totalCost: Double
}

struct TrendPoint: Codable {
  let checkedAt: String
  let value: Double       // the cheapest total OR the per-listing total
}

struct TrendSeries: Codable {
  let shop: String
  let listingId: Int
  let points: [TrendPoint]
}
```

### Device

```swift
struct Device: Codable {
  let id: Int
  let apnsToken: String
  let bundleId: String
  let environment: String
  let createdAt: String
  let lastSeenAt: String
}
```

---

## Push payload

APNs pushes delivered to registered devices use this shape:

```json
{
  "aps": {
    "alert": { "title": "Sonic Frontiers", "body": "€22.98 → €17.99" },
    "sound": "default",
    "interruption-level": "time-sensitive"
  },
  "open_url": "https://www.nintendo.com/.../sonic-frontiers",
  "image_url": "https://.../sonic.png"
}
```

Custom keys at the top level (`open_url`, `image_url`) are forwarded
verbatim. Read them in `UNNotificationContent.userInfo`.

Three push types fire today:

- **Price changed** — title = product/group name, body = `oldTotal → newTotal`,
  `interruption-level: time-sensitive`.
- **Sale ending** — title = `"Sale ending in 1 day"`, body =
  `"<name> — €salePrice (was €regularPrice)"`,
  `interruption-level: time-sensitive`.
- **Scrape failed** — title = `"Scrape failed · <shop>"`, body = `<name> — <first line of error>`,
  `interruption-level: passive`. Edge-triggered: fires once per
  success → failure transition.

---

## Worked iOS flow

1. `POST /api/auth/login` → keep `token` in Keychain.
2. On every subsequent request, add `Authorization: Bearer <token>`.
3. After calling `registerForRemoteNotifications`, convert the device
   token data to a lowercase hex string and `POST /api/devices` with
   `bundleId` (use `Bundle.main.bundleIdentifier!`) and
   `environment` (`"sandbox"` for dev builds, `"production"` for
   TestFlight/App Store).
4. Home screen:
   `GET /api/groups` → render list.
5. Tap a card:
   `GET /api/groups/[id]` + `GET /api/groups/[id]/trend?days=90` in
   parallel → render detail.
6. User removes a listing:
   `DELETE /api/listings/[id]` → if `deletedGroup`, pop back to list.
7. User signs out:
   `DELETE /api/devices/[token]` then delete Keychain entry.
