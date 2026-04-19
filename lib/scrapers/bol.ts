import { extractProductJsonLd } from "./jsonld";
import type { Scraper, ScrapeResult } from "./types";

export const bolScraper: Scraper = {
  shop: "bol",
  scrape(html: string): ScrapeResult {
    const ld = extractProductJsonLd(html);
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
};
