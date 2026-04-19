import { notFound } from "next/navigation";
import Link from "next/link";
import { getProduct, getHistory } from "@/lib/db/queries";
import { money, relativeTime } from "@/lib/format";
import ProductControls from "./ProductControls";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) notFound();
  const product = await getProduct(id);
  if (!product) notFound();
  const history = await getHistory(id, 90);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-3xl p-6 space-y-6">
        <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-100">← Back</Link>
        <header className="flex items-start gap-4">
          {product.imageUrl && (
            <img src={product.imageUrl} alt="" className="h-20 w-20 rounded object-cover" />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold">{product.name}</h1>
            <p className="text-xs text-neutral-400">
              <a href={product.url} target="_blank" rel="noreferrer" className="hover:underline">
                {new URL(product.url).hostname}
              </a>
              {" · "}
              {relativeTime(product.lastCheckedAt)}
              {product.lastError && (
                <span className="ml-2 text-red-400">error: {product.lastError}</span>
              )}
            </p>
            <div className="mt-2 text-sm">
              {money(product.lastTotalCost)}{" "}
              <span className="text-neutral-400">
                ({money(product.lastPrice)} + shipping)
              </span>
            </div>
          </div>
        </header>

        <ProductControls
          id={product.id}
          shop={product.shop}
          targetPrice={product.targetPrice ? Number(product.targetPrice) : null}
          isPreOrder={product.isPreOrder}
        />

        <section>
          <h2 className="text-sm font-semibold text-neutral-300 mb-2">History</h2>
          <ul className="text-sm divide-y divide-neutral-800">
            {history.map((h) => (
              <li key={h.id} className="py-1.5 flex justify-between">
                <span className="text-neutral-400">
                  {new Date(h.checkedAt).toLocaleString()}
                </span>
                <span>
                  {money(h.totalCost)}{" "}
                  <span className="text-neutral-500">({money(h.price)})</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
