import { extractProductJsonLd } from "./jsonld";
import type { Scraper, ScrapeResult } from "./types";

export const bolScraper: Scraper = {
  shop: "bol",
  scrape(html: string): ScrapeResult {
    const ld = extractProductJsonLd(html);
    if (!ld || ld.price == null || !ld.name) {
      throw new Error("bol: JSON-LD Product not found");
    }
    const soldByBol = ld.sellerName ? /\bbol(\.com)?\b/i.test(ld.sellerName) : false;
    return { name: ld.name, price: ld.price, imageUrl: ld.image, soldByBol };
  },
};
