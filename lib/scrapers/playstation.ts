import type { ShopConnector, ScrapeResult } from "./types";

/**
 * PlayStation Store (store.playstation.com).
 *
 * The product page is server-rendered HTML with Apollo GraphQL hydration
 * payloads inlined as `<script id="env:<uuid>" type="application/json">`
 * blocks. One of them carries the `Product:<id>` node (with the canonical
 * `invariantName`); another carries a `GameCTA:...` node whose `price`
 * object has integer-cent base/discount values and a Unix-ms discount
 * end time. We don't walk every script as JSON — the payloads sit
 * together in one monolithic HTML string, so anchored regexes are both
 * cheaper and resilient to noise from the other hydration blocks.
 *
 * Akamai-backed like bol.com; treat bursts of requests the same way in
 * the cron (see `postRequestDelayMs` in app/api/cron/check/route.ts).
 */
export const playstation: ShopConnector = {
  shop: "playstation",
  hosts: ["store.playstation.com"],
  medium: "digital",

  async scrape(html, _url): Promise<ScrapeResult> {
    const name = html.match(/"invariantName":"([^"]+)"/)?.[1];
    if (!name) throw new Error("playstation: title not found");

    const baseCents = Number(html.match(/"basePriceValue":(\d+)/)?.[1]);
    const discountedCents = Number(
      html.match(/"discountedValue":(\d+)/)?.[1],
    );

    // Live discount ⇔ the discounted value is strictly below the base.
    // PSN emits `discountedValue: basePriceValue` (not zero) when nothing
    // is on offer, so equality is enough to distinguish.
    const onSale =
      Number.isFinite(baseCents) &&
      Number.isFinite(discountedCents) &&
      baseCents > 0 &&
      discountedCents > 0 &&
      discountedCents < baseCents;

    const effectiveCents = onSale ? discountedCents : baseCents;
    if (!Number.isFinite(effectiveCents) || effectiveCents <= 0) {
      throw new Error("playstation: no usable price");
    }

    const result: ScrapeResult = { name, price: effectiveCents / 100 };

    // First PSN CDN URL in the page is the cover art. Other media
    // (screenshots, hero backgrounds, publisher logos) all live on the
    // same host but appear later in the document.
    const imageUrl = html.match(
      /https:\/\/image\.api\.playstation\.com\/[^"\\<>\s]+/,
    )?.[0];
    if (imageUrl) result.imageUrl = imageUrl;

    if (onSale) {
      result.regularPrice = baseCents / 100;
      const endMs = html.match(/"endTime":"(\d+)"/)?.[1];
      if (endMs) {
        const end = new Date(Number(endMs));
        if (!Number.isNaN(end.getTime())) result.saleEndsAt = end;
      }
    }

    return result;
  },

  shipping() {
    return 0;
  },
};
