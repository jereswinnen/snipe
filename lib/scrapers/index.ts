import type { Shop } from "@/lib/db/schema";
import type { Scraper } from "./types";
import { bolScraper } from "./bol";
import { coolblueScraper } from "./coolblue";
import { allYourGamesScraper } from "./allyourgames";
import { nedgameScraper } from "./nedgame";

const scrapers: Record<Shop, Scraper> = {
  bol: bolScraper,
  coolblue: coolblueScraper,
  allyourgames: allYourGamesScraper,
  nedgame: nedgameScraper,
};

export function getScraper(shop: Shop): Scraper {
  return scrapers[shop];
}

export function shopFromUrl(url: string): Shop | null {
  let host: string;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return null; }
  if (host.endsWith("bol.com")) return "bol";
  if (host.endsWith("coolblue.be") || host.endsWith("coolblue.nl")) return "coolblue";
  if (host.endsWith("allyourgames.nl")) return "allyourgames";
  if (host.endsWith("nedgame.nl")) return "nedgame";
  return null;
}

export type { Scraper, ScrapeResult } from "./types";
