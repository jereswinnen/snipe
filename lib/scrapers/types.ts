import type { Shop } from "@/lib/db/schema";

export type ScrapeResult = {
  name: string;
  price: number;            // EUR
  imageUrl?: string;
  soldByBol?: boolean;      // only set by bol connector
};

export type ShippingFlags = {
  soldByBol?: boolean | null;
  isPreOrder?: boolean;
};

export type ShippingEnv = {
  allYourGamesFlat: number;
};

export type ShopConnector = {
  shop: Shop;
  hosts: string[];          // hostnames this connector matches (suffix match)
  scrape: (html: string, url: string) => ScrapeResult;
  shipping: (price: number, flags: ShippingFlags, env: ShippingEnv) => number;
};
