import type { Shop } from "@/lib/db/schema";
import { getConnector } from "@/lib/scrapers";
import type { ShippingFlags } from "@/lib/scrapers";

export type { ShippingFlags };

export type ShippingConfig = {
  allYourGamesFlat?: number;
};

export function shippingCost(
  shop: Shop,
  price: number,
  flags: ShippingFlags,
  config: ShippingConfig = {},
): number {
  return getConnector(shop).shipping(price, flags, {
    allYourGamesFlat: config.allYourGamesFlat ?? 5.95,
  });
}
