import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { shopFromUrl, getConnector } from "@/lib/scrapers";
import { fetchPage, canonicalizeUrl } from "@/lib/scrapers/fetch";
import { shippingCost } from "@/lib/shipping";
import { findProductByUrl, insertProduct, listProducts, insertHistory } from "@/lib/db/queries";

const body = z.object({
  url: z.string().url(),
  targetPrice: z.number().positive().optional(),
  isPreOrder: z.boolean().optional(),
});

export async function GET() {
  const rows = await listProducts();
  return NextResponse.json({ products: rows });
}

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { targetPrice, isPreOrder } = parsed.data;
  const url = canonicalizeUrl(parsed.data.url);

  const shop = shopFromUrl(url);
  if (!shop) return NextResponse.json({ error: "unsupported_shop" }, { status: 400 });

  const existing = await findProductByUrl(url);
  if (existing) return NextResponse.json({ error: "duplicate", id: existing.id }, { status: 409 });

  const connector = getConnector(shop);
  let scrape;
  try {
    const html = await fetchPage(url);
    scrape = await connector.scrape(html, url);
  } catch (e) {
    return NextResponse.json(
      { error: "scrape_failed", detail: (e as Error).message },
      { status: 502 },
    );
  }

  const shipping = shippingCost(
    shop,
    scrape.price,
    { soldByBol: scrape.soldByBol ?? null, isPreOrder: isPreOrder ?? false },
    { allYourGamesFlat: env.ALLYOURGAMES_SHIPPING },
  );
  const totalCost = Number((scrape.price + shipping).toFixed(2));
  const price = Number(scrape.price.toFixed(2));

  const inserted = await insertProduct({
    url,
    shop,
    medium: connector.medium,
    name: scrape.name,
    imageUrl: scrape.imageUrl,
    isPreOrder: isPreOrder ?? false,
    soldByBol: scrape.soldByBol ?? null,
    lastPrice: price.toFixed(2),
    lastTotalCost: totalCost.toFixed(2),
    lastRegularPrice:
      scrape.regularPrice != null ? scrape.regularPrice.toFixed(2) : null,
    lastSaleEndsAt: scrape.saleEndsAt ?? null,
    targetPrice: targetPrice !== undefined ? targetPrice.toFixed(2) : null,
    lastCheckedAt: new Date(),
  });
  await insertHistory({
    productId: inserted.id,
    price: price.toFixed(2),
    totalCost: totalCost.toFixed(2),
  });

  return NextResponse.json({ product: inserted });
}
