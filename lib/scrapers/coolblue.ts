import { extractProductJsonLd } from "./jsonld";
import type { ShopConnector, ScrapeResult } from "./types";

export const coolblue: ShopConnector = {
  shop: "coolblue",
  hosts: ["coolblue.be", "coolblue.nl"],

  scrape(html): ScrapeResult {
    const ld = extractProductJsonLd(html);
    if (!ld || ld.price == null || !ld.name) {
      throw new Error("coolblue: JSON-LD Product not found");
    }
    return { name: ld.name, price: ld.price, imageUrl: ld.image };
  },

  shipping() {
    return 0;
  },
};
