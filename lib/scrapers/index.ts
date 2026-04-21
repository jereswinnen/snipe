import type { Shop } from "@/lib/db/schema";
import type { ShopConnector } from "./types";
import { bol } from "./bol";
import { coolblue } from "./coolblue";
import { allYourGames } from "./allyourgames";
import { nintendo } from "./nintendo";
import { dreamland } from "./dreamland";
import { playstation } from "./playstation";

const connectors: ShopConnector[] = [
  bol,
  coolblue,
  allYourGames,
  nintendo,
  dreamland,
  playstation,
];
const byShop = new Map<Shop, ShopConnector>(connectors.map((c) => [c.shop, c]));

export function getConnector(shop: Shop): ShopConnector {
  const c = byShop.get(shop);
  if (!c) throw new Error(`Unknown shop: ${shop}`);
  return c;
}

export function shopFromUrl(url: string): Shop | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  for (const c of connectors) {
    if (c.hosts.some((h) => host === h || host.endsWith("." + h))) {
      return c.shop;
    }
  }
  return null;
}

export type { ShopConnector, ScrapeResult, ShippingFlags, ShippingEnv, Medium } from "./types";
