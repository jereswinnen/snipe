import type { Shop } from "@/lib/db/schema";

export type ScrapeResult = {
  name: string;
  price: number;            // EUR
  imageUrl?: string;
  soldByBol?: boolean;      // only set by bol scraper
};

export type Scraper = {
  shop: Shop;
  scrape: (html: string, url: string) => ScrapeResult;
};
