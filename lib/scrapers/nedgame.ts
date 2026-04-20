import * as cheerio from "cheerio";
import { extractProductJsonLd } from "./jsonld";
import type { ShopConnector, ScrapeResult } from "./types";

function parseMoney(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const cleaned = text
    .replace(/[^0-9,.\-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export const nedgame: ShopConnector = {
  shop: "nedgame",
  hosts: ["nedgame.nl"],
  medium: "physical",

  async scrape(html, url): Promise<ScrapeResult> {
    const ld = extractProductJsonLd(html, url);
    if (ld?.name && ld.price != null) {
      return { name: ld.name, price: ld.price, imageUrl: ld.image };
    }
    const $ = cheerio.load(html);
    const name =
      $('meta[property="og:title"]').attr("content") ||
      $("h1").first().text().trim();
    const priceText =
      $('meta[property="product:price:amount"]').attr("content") ||
      $('[itemprop="price"]').attr("content") ||
      $('[itemprop="price"]').first().text() ||
      $(".product-price, .price").first().text();
    const price = parseMoney(priceText);
    const imageUrl = $('meta[property="og:image"]').attr("content");
    if (!name || price == null) throw new Error("nedgame: could not find price/name");
    return { name, price, imageUrl };
  },

  shipping(price, flags) {
    if (flags.isPreOrder) return 0;
    return price >= 175 ? 0 : 6.99;
  },
};
