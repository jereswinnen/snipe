import { extractProductJsonLd } from "./jsonld";
import type { ShopConnector, ScrapeResult } from "./types";

export const allYourGames: ShopConnector = {
  shop: "allyourgames",
  hosts: ["allyourgames.nl"],
  medium: "physical",

  async scrape(html, url): Promise<ScrapeResult> {
    const ld = extractProductJsonLd(html, url);
    if (!ld || ld.price == null || !ld.name) {
      throw new Error("allyourgames: JSON-LD Product not found");
    }
    return { name: ld.name, price: ld.price, imageUrl: ld.image };
  },

  shipping(_price, _flags, env) {
    return env.allYourGamesFlat;
  },
};
