import * as cheerio from "cheerio";
import type { ShopConnector, ScrapeResult } from "./types";

type NintendoPrice = {
  sales_status?: string;
  regular_price?: { raw_value: string; currency: string };
  discount_price?: {
    raw_value: string;
    currency: string;
    start_datetime?: string;
    end_datetime?: string;
  };
};

type NintendoPriceResponse = {
  prices?: NintendoPrice[];
};

function localeFromUrl(url: string): { country: string; lang: string } {
  const m = /\/([a-z]{2})-([a-z]{2})\//.exec(url);
  if (!m) return { country: "BE", lang: "nl" };
  return { country: m[2].toUpperCase(), lang: m[1] };
}

function extractNsuid(html: string): string | null {
  return (
    html.match(/na_nsuid\s*=\s*\[\s*"(\d+)"/)?.[1] ??
    html.match(/nsuid:\s*"(\d+)"/)?.[1] ??
    null
  );
}

export const nintendo: ShopConnector = {
  shop: "nintendo",
  hosts: ["nintendo.com", "nintendo.be", "nintendo.nl"],
  medium: "digital",

  async scrape(html, url): Promise<ScrapeResult> {
    const nsuid = extractNsuid(html);
    if (!nsuid) throw new Error("nintendo: NSUID not found in product page");

    const $ = cheerio.load(html);
    const name =
      $('meta[property="og:title"]').attr("content")?.trim() ||
      $("h1").first().text().trim();
    // Nintendo's Belgian localisations wrap the content attribute with
    // leading whitespace/newlines, which makes URL parsers (Swift's
    // URL(string:) in particular) reject the value. Trim aggressively.
    const imageUrl = $('meta[property="og:image"]').attr("content")?.trim() || undefined;
    if (!name) throw new Error("nintendo: title not found");

    const { country, lang } = localeFromUrl(url);
    const api = `https://api.ec.nintendo.com/v1/price?country=${country}&lang=${lang}&ids=${nsuid}`;
    const res = await fetch(api, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`nintendo: price API HTTP ${res.status}`);
    const body = (await res.json()) as NintendoPriceResponse;
    const entry = body.prices?.[0];
    const discount = entry?.discount_price;
    const regular = entry?.regular_price;
    const raw = discount?.raw_value ?? regular?.raw_value;
    const price = raw ? Number(raw) : NaN;
    if (!Number.isFinite(price)) {
      throw new Error(
        `nintendo: no usable price (status=${entry?.sales_status ?? "—"})`,
      );
    }

    const result: ScrapeResult = { name, price, imageUrl };
    if (discount && regular) {
      result.regularPrice = Number(regular.raw_value);
      if (discount.end_datetime) {
        const end = new Date(discount.end_datetime);
        if (!Number.isNaN(end.getTime())) result.saleEndsAt = end;
      }
    }
    return result;
  },

  shipping() {
    return 0;
  },
};
