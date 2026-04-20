import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { listProducts } from "@/lib/db/queries";
import { checkProduct } from "@/lib/check";

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
    await new Promise((r) => setTimeout(r, 500));
  }
  return NextResponse.json({ checked: products.length, changed, errors });
}
