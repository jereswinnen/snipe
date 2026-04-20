import { requireJsonLd } from "./jsonld";
import type { ShopConnector, ScrapeResult } from "./types";

// Dreamland.be — Belgian Colruyt group toy/game retailer.
// Their product pages emit a clean JSON-LD ProductGroup with one variant,
// matching the shape our shared extractor already understands.
// Shipping: €4.99 under €50, free at €50 and above (verified Apr 2026).

export const dreamland: ShopConnector = {
  shop: "dreamland",
  hosts: ["dreamland.be"],
  medium: "physical",

  async scrape(html, url): Promise<ScrapeResult> {
    const ld = requireJsonLd(html, url, "dreamland");
    return { name: ld.name, price: ld.price, imageUrl: ld.image };
  },

  shipping(price) {
    return price >= 50 ? 0 : 4.99;
  },
};
