import type { Shop } from "@/lib/db/schema";

// Primary domain per shop — used to fetch favicons for UI.
// Kept client-safe (no Node-only imports) so it can be used from "use client"
// components without pulling the scraper module.
const SHOP_DOMAIN: Record<Shop, string> = {
  bol: "bol.com",
  coolblue: "coolblue.be",
  allyourgames: "allyourgames.nl",
  nintendo: "nintendo.com",
  dreamland: "dreamland.be",
  playstation: "playstation.com",
};

export function shopFaviconUrl(shop: string, size = 64): string {
  const domain = SHOP_DOMAIN[shop as Shop] ?? `${shop}.com`;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}
