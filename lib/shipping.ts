import type { Shop } from "@/lib/db/schema";

export type ShippingFlags = {
  soldByBol?: boolean | null;
  isPreOrder?: boolean;
};

export type ShippingConfig = {
  allYourGamesFlat?: number;
};

export function shippingCost(
  shop: Shop,
  price: number,
  flags: ShippingFlags,
  config: ShippingConfig = {},
): number {
  switch (shop) {
    case "bol": {
      if (flags.soldByBol === false) return 0;
      return price >= 25 ? 0 : 2.99;
    }
    case "coolblue":
      return 0;
    case "allyourgames":
      return config.allYourGamesFlat ?? 5.95;
    case "nedgame":
      if (flags.isPreOrder) return 0;
      return price >= 175 ? 0 : 6.99;
  }
}
