import { requireJsonLd } from "./jsonld";
import type { ShopConnector, ScrapeResult } from "./types";

export const coolblue: ShopConnector = {
  shop: "coolblue",
  hosts: ["coolblue.be", "coolblue.nl"],
  medium: "physical",

  async scrape(html, url): Promise<ScrapeResult> {
    const ld = requireJsonLd(html, url, "coolblue");
    return { name: ld.name, price: ld.price, imageUrl: ld.image };
  },

  shipping() {
    return 0;
  },
};
