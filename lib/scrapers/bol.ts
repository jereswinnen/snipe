import { extractProductJsonLd } from "./jsonld";
import type { ShopConnector, ScrapeResult } from "./types";

// If bol starts returning 403s again (Akamai bot detection), try these
// free moves in order of effort before reaching for a paid scraping API:
//   1. Mobile-web UA — swap the desktop UAs in lib/scrapers/fetch.ts for
//      something like "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac
//      OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4
//      Mobile/15E148 Safari/604.1". Mobile pages are often less
//      aggressively protected than desktop.
//   2. Jittered delay between bol requests in the cron loop — bol may
//      be flagging burst patterns, not individual requests. Add a
//      random 1–3 s wait between bol checks in app/api/cron/check.
//   3. Playwright on Railway — heavier memory footprint but free, and
//      a real Chromium matches the TLS / JA3 fingerprint Akamai checks
//      against. Use only for bol, keep fetch-based scraping for the
//      other shops.

export const bol: ShopConnector = {
  shop: "bol",
  hosts: ["bol.com"],
  medium: "physical",

  async scrape(html: string, url: string): Promise<ScrapeResult> {
    const ld = extractProductJsonLd(html, url);
    if (!ld || ld.price == null || !ld.name) {
      const ldCount = (html.match(/application\/ld\+json/g) ?? []).length;
      const looksLikeChallenge = /captcha|are you human|access denied|cloudflare/i.test(html);
      throw new Error(
        `bol: JSON-LD Product not found ` +
          `(html=${html.length}b, ld+json blocks=${ldCount}, ` +
          `name=${ld?.name ?? "—"}, price=${ld?.price ?? "—"}, challenge=${looksLikeChallenge})`,
      );
    }
    const soldByBol = ld.sellerName ? /\bbol(\.com)?\b/i.test(ld.sellerName) : false;
    return { name: ld.name, price: ld.price, imageUrl: ld.image, soldByBol };
  },

  shipping() {
    return 0;
  },
};
