import type { Shop } from "@/lib/db/schema";

export type Medium = "digital" | "physical";

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
  medium: Medium;           // what this shop sells — digital or physical goods
  scrape: (html: string, url: string) => Promise<ScrapeResult>;
  shipping: (price: number, flags: ShippingFlags, env: ShippingEnv) => number;
};
