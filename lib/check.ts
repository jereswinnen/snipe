import { env } from "@/lib/env";
import { shippingCost } from "@/lib/shipping";
import { getConnector } from "@/lib/scrapers";
import { fetchPage } from "@/lib/scrapers/fetch";
import {
  buildNotification,
  buildSaleEndingNotification,
  buildScrapeFailureNotification,
  sendNotification,
  type NotificationPayload,
} from "@/lib/notify";
import { fanoutApnsNotification } from "@/lib/apns";
import {
  getProductGroup,
  insertHistory,
  updateProduct,
} from "@/lib/db/queries";
import type { Product } from "@/lib/db/schema";

const SALE_ENDING_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Delivers a notification to every configured channel (brrr webhook and
 * all registered APNs devices). Each channel is wrapped independently so
 * one failing doesn't silently drop the other.
 */
async function notifyAll(payload: NotificationPayload): Promise<void> {
  try {
    await sendNotification(payload);
  } catch (e) {
    console.error("brrr notify failed:", (e as Error).message);
  }
  try {
    await fanoutApnsNotification(payload);
  } catch (e) {
    console.error("apns notify failed:", (e as Error).message);
  }
}

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
      await notifyAll(
        buildNotification({
          name: result.name || product.name,
          url: product.url,
          oldTotal: prevTotal,
          newTotal: totalCost,
          imageUrl: result.imageUrl ?? product.imageUrl ?? undefined,
        }),
      );
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
        const group = product.groupId
          ? await getProductGroup(product.groupId)
          : null;
        await notifyAll(
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
      }
    }
    return { ok: true, changed, price, totalCost };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await updateProduct(product.id, { lastCheckedAt: new Date(), lastError: msg });

    // Notify only on the healthy → failing transition. While the error
    // persists we stay silent; once a subsequent check succeeds, the
    // lastError clears and the next failure will fire again.
    if (!product.lastError) {
      const group = product.groupId
        ? await getProductGroup(product.groupId)
        : null;
      const openUrl = product.groupId
        ? `${env.APP_URL}/groups/${product.groupId}`
        : product.url;
      await notifyAll(
        buildScrapeFailureNotification({
          name: group?.title ?? product.name,
          shop: product.shop,
          error: msg,
          openUrl,
          imageUrl: product.imageUrl ?? undefined,
        }),
      );
    }
    return { ok: false, error: msg };
  }
}
