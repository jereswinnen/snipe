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
