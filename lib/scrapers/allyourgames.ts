import { requireJsonLd } from "./jsonld";
import type { ShopConnector, ScrapeResult } from "./types";

export const allYourGames: ShopConnector = {
  shop: "allyourgames",
  hosts: ["allyourgames.nl"],
  medium: "physical",

  async scrape(html, url): Promise<ScrapeResult> {
    const ld = requireJsonLd(html, url, "allyourgames");
    return { name: ld.name, price: ld.price, imageUrl: ld.image };
  },

  shipping(_price, _flags, env) {
    return env.allYourGamesFlat;
  },
};
