import Link from "next/link";
import { Truck, Download } from "lucide-react";
import { desc, asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { money, relativeTime } from "@/lib/format";
import { Sparkline } from "@/components/Sparkline";
import HeaderActions from "./HeaderActions";

export const dynamic = "force-dynamic";

async function getData() {
  const products = await db.select().from(schema.products).orderBy(desc(schema.products.updatedAt));
  const histories = await Promise.all(
    products.map((p) =>
      db
        .select()
        .from(schema.priceHistory)
        .where(eq(schema.priceHistory.productId, p.id))
        .orderBy(asc(schema.priceHistory.checkedAt))
        .limit(30),
    ),
  );
  return products.map((p, i) => ({ product: p, history: histories[i] }));
}

export default async function Home() {
  const rows = await getData();
  return (
    <main className="min-h-screen bg-bg text-fg">
      <div className="p-4 space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Snipe</h1>
          <HeaderActions />
        </header>
        <ul className="grid gap-1 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
          {rows.map(({ product, history }) => {
            const hit =
              product.targetPrice != null &&
              Number(product.lastTotalCost) <= Number(product.targetPrice);
            const values = history.map((h) => Number(h.totalCost));
            const previous = values.length >= 2 ? values[values.length - 2] : null;
            const current = Number(product.lastTotalCost);
            return (
              <li
                key={product.id}
                className={
                  "bg-card rounded-3xl p-5 flex flex-col items-center text-center gap-3 " +
                  (hit ? "ring-2 ring-emerald-500/60" : "")
                }
              >
                <div className="w-full flex items-center justify-between text-[11px] uppercase tracking-wider text-muted">
                  <span>{product.shop}</span>
                  <span className="flex items-center gap-1">
                    {product.lastError && (
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" title={product.lastError} />
                    )}
                    {relativeTime(product.lastCheckedAt)}
                  </span>
                </div>

                <Link href={`/products/${product.id}`} className="block">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt=""
                      className="h-28 w-auto max-w-full object-contain"
                    />
                  ) : (
                    <div className="h-28 w-28" />
                  )}
                </Link>

                <Link
                  href={`/products/${product.id}`}
                  className="text-sm font-medium leading-snug line-clamp-2 hover:underline"
                >
                  {product.name}
                </Link>

                <div className="flex flex-col items-center gap-1">
                  <div className="text-lg font-semibold flex items-center gap-1">
                    {product.medium === "digital" ? (
                      <Download size={14} aria-hidden="true" className="text-muted" />
                    ) : (
                      <Truck size={14} aria-hidden="true" className="text-muted" />
                    )}
                    {money(product.lastTotalCost)}
                  </div>
                  {previous != null && previous !== current && (
                    <div className="text-xs text-muted">was {money(previous)}</div>
                  )}
                </div>

                <Sparkline values={values} width={160} height={28} />
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
