import { env } from "@/lib/env";
import { shippingCost } from "@/lib/shipping";
import { getConnector } from "@/lib/scrapers";
import { fetchPage } from "@/lib/scrapers/fetch";
import {
  buildNotification,
  buildSaleEndingNotification,
  sendNotification,
} from "@/lib/notify";
import {
  getProductGroup,
  insertHistory,
  updateProduct,
} from "@/lib/db/queries";
import type { Product } from "@/lib/db/schema";

const SALE_ENDING_WINDOW_MS = 24 * 60 * 60 * 1000;

export type CheckOutcome =
  | { ok: true; changed: boolean; price: number; totalCost: number }
  | { ok: false; error: string };

export async function checkProduct(product: Product): Promise<CheckOutcome> {
  try {
    const html = await fetchPage(product.url);
    const result = await getConnector(product.shop).scrape(html, product.url);
    const shipping = shippingCost(
      product.shop,
      result.price,
      { soldByBol: result.soldByBol ?? product.soldByBol },
      { allYourGamesFlat: env.ALLYOURGAMES_SHIPPING },
    );
    const totalCost = Number((result.price + shipping).toFixed(2));
    const price = Number(result.price.toFixed(2));
    const prevTotal = Number(product.lastTotalCost);
    const changed = totalCost !== prevTotal;

    await insertHistory({
      productId: product.id,
      price: price.toFixed(2),
      totalCost: totalCost.toFixed(2),
    });

    const patch: Record<string, unknown> = {
      lastCheckedAt: new Date(),
      lastError: null,
      lastRegularPrice:
        result.regularPrice != null ? result.regularPrice.toFixed(2) : null,
      lastSaleEndsAt: result.saleEndsAt ?? null,
    };
    if (result.soldByBol !== undefined && result.soldByBol !== product.soldByBol) {
      patch.soldByBol = result.soldByBol;
    }
    if (changed) {
      patch.lastPrice = price.toFixed(2);
      patch.lastTotalCost = totalCost.toFixed(2);
      patch.name = result.name;
      if (result.imageUrl) patch.imageUrl = result.imageUrl;
    }
    await updateProduct(product.id, patch);

    if (changed) {
      try {
        await sendNotification(
          buildNotification({
            name: result.name || product.name,
            url: product.url,
            oldTotal: prevTotal,
            newTotal: totalCost,
            imageUrl: result.imageUrl ?? product.imageUrl ?? undefined,
          }),
        );
      } catch (e) {
        console.error("notify failed:", (e as Error).message);
      }
    }

    // Sale-ending reminder: fire once per sale window, within 24 h of end.
    if (result.saleEndsAt && result.regularPrice != null) {
      const end = result.saleEndsAt;
      const msLeft = end.getTime() - Date.now();
      const notifiedFor = product.saleEndNotifiedFor
        ? new Date(product.saleEndNotifiedFor).getTime()
        : null;
      const alreadyNotified = notifiedFor === end.getTime();
      if (msLeft > 0 && msLeft <= SALE_ENDING_WINDOW_MS && !alreadyNotified) {
        try {
          const group = product.groupId
            ? await getProductGroup(product.groupId)
            : null;
          await sendNotification(
            buildSaleEndingNotification({
              name: group?.title ?? result.name ?? product.name,
              url: product.url,
              endsAt: end,
              salePrice: price,
              regularPrice: result.regularPrice,
              imageUrl: result.imageUrl ?? product.imageUrl ?? undefined,
            }),
          );
          await updateProduct(product.id, { saleEndNotifiedFor: end });
        } catch (e) {
          console.error("sale-ending notify failed:", (e as Error).message);
        }
      }
    }
    return { ok: true, changed, price, totalCost };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await updateProduct(product.id, { lastCheckedAt: new Date(), lastError: msg });
    return { ok: false, error: msg };
  }
}
