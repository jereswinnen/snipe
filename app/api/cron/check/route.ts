import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { listProducts } from "@/lib/db/queries";
import { checkProduct } from "@/lib/check";
import type { Shop } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * How long to wait after a given shop's request finishes, before the next
 * product. Bol and PlayStation Store both sit behind Akamai's bot
 * manager; a sub-second gap between requests trips a cooldown that 403s
 * every follow-up for tens of seconds. 8–12 s of jitter + the shuffle
 * (which interleaves them with other shops) keeps consecutive hits
 * ~10–20 s apart, slow enough to avoid the burst trigger in practice.
 */
function postRequestDelayMs(shop: Shop): number {
  if (shop === "bol" || shop === "playstation") {
    return 8000 + Math.random() * 4000;
  }
  return 500;
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: "unauthorized", message: "Cron secret mismatch" },
      { status: 401 },
    );
  }
  const products = shuffle(await listProducts());
  let changed = 0;
  let errors = 0;
  for (const p of products) {
    const outcome = await checkProduct(p);
    if (!outcome.ok) errors++;
    else if (outcome.changed) changed++;
    await new Promise((r) => setTimeout(r, postRequestDelayMs(p.shop)));
  }
  return NextResponse.json({ checked: products.length, changed, errors });
}
