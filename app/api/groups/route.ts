import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { respondError } from "@/lib/api/errors";
import { shopFromUrl, getConnector } from "@/lib/scrapers";
import { fetchPage, canonicalizeUrl } from "@/lib/scrapers/fetch";
import { shippingCost } from "@/lib/shipping";
import {
  findProductByUrl,
  insertProduct,
  insertProductGroup,
  insertHistory,
  listGroupsWithCheapest,
} from "@/lib/db/queries";

const createBody = z.object({
  url: z.string().url(),
  targetPrice: z.number().positive().optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const m = url.searchParams.get("m");
  const mediumFilter = m === "digital" || m === "physical" ? m : null;
  const rows = await listGroupsWithCheapest();
  const filtered = mediumFilter
    ? rows.filter((r) => r.cheapest.medium === mediumFilter)
    : rows;
  return NextResponse.json({ groups: filtered });
}

export async function POST(req: Request) {
  const parsed = createBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return respondError("bad_request", 400, "Invalid body");
  const { targetPrice } = parsed.data;
  const url = canonicalizeUrl(parsed.data.url);

  const shop = shopFromUrl(url);
  if (!shop)
    return respondError(
      "unsupported_shop",
      400,
      "No connector matches this URL's host",
    );

  const existing = await findProductByUrl(url);
  if (existing) {
    return respondError(
      "duplicate_url",
      409,
      "This URL is already tracked",
    );
  }

  const connector = getConnector(shop);
  let scrape;
  try {
    const html = await fetchPage(url);
    scrape = await connector.scrape(html, url);
  } catch (e) {
    return respondError("scrape_failed", 502, (e as Error).message);
  }

  const shipping = shippingCost(
    shop,
    scrape.price,
    { soldByBol: scrape.soldByBol ?? null },
    { allYourGamesFlat: env.ALLYOURGAMES_SHIPPING },
  );
  const totalCost = Number((scrape.price + shipping).toFixed(2));
  const price = Number(scrape.price.toFixed(2));

  const group = await insertProductGroup({
    title: scrape.name,
    imageUrl: scrape.imageUrl,
    targetPrice: targetPrice !== undefined ? targetPrice.toFixed(2) : null,
  });

  const listing = await insertProduct({
    groupId: group.id,
    url,
    shop,
    medium: connector.medium,
    name: scrape.name,
    imageUrl: scrape.imageUrl,
    soldByBol: scrape.soldByBol ?? null,
    lastPrice: price.toFixed(2),
    lastTotalCost: totalCost.toFixed(2),
    lastRegularPrice:
      scrape.regularPrice != null ? scrape.regularPrice.toFixed(2) : null,
    lastSaleEndsAt: scrape.saleEndsAt ?? null,
    lastCheckedAt: new Date(),
  });
  await insertHistory({
    productId: listing.id,
    price: price.toFixed(2),
    totalCost: totalCost.toFixed(2),
  });

  return NextResponse.json({ group, listing });
}
