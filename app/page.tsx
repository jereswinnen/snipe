import Link from "next/link";
import { desc, asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { money, relativeTime } from "@/lib/format";
import { Sparkline } from "@/components/Sparkline";
import AddProductForm from "./AddProductForm";

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
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-3xl p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Snipe</h1>
          <form action="/api/auth/logout" method="post">
            <button className="text-sm text-neutral-400 hover:text-neutral-100">Logout</button>
          </form>
        </header>
        <AddProductForm />
        <ul className="space-y-2">
          {rows.map(({ product, history }) => {
            const hit =
              product.targetPrice != null &&
              Number(product.lastTotalCost) <= Number(product.targetPrice);
            const values = history.map((h) => Number(h.totalCost));
            return (
              <li
                key={product.id}
                className={
                  "rounded border border-neutral-800 bg-neutral-900 p-3 flex items-center gap-4 " +
                  (hit ? "ring-1 ring-emerald-500/60" : "")
                }
              >
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt="" className="h-12 w-12 rounded object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded bg-neutral-800" />
                )}
                <div className="flex-1 min-w-0">
                  <Link href={`/products/${product.id}`} className="block truncate hover:underline">
                    {product.name}
                  </Link>
                  <div className="text-xs text-neutral-400 flex items-center gap-2">
                    <span className="uppercase tracking-wide">{product.shop}</span>
                    <span>·</span>
                    <span>{relativeTime(product.lastCheckedAt)}</span>
                    {product.lastError && (
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" title={product.lastError} />
                    )}
                  </div>
                </div>
                <Sparkline values={values} />
                <div className="text-right">
                  <div className="text-sm">{money(product.lastTotalCost)}</div>
                  <div className="text-xs text-neutral-400">{money(product.lastPrice)} + ship</div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
