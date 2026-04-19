import { notFound } from "next/navigation";
import { Truck, ExternalLink } from "lucide-react";
import { getProduct, getHistory } from "@/lib/db/queries";
import { money, relativeTime, formatDateTime } from "@/lib/format";
import { Sparkline } from "@/components/Sparkline";
import ProductControls from "./ProductControls";
import ProductHeader from "./ProductHeader";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) notFound();
  const product = await getProduct(id);
  if (!product) notFound();
  const history = await getHistory(id, 90);

  const values = [...history].reverse().map((h) => Number(h.totalCost));
  const current = Number(product.lastTotalCost);
  const previous = values.length >= 2 ? values[values.length - 2] : null;
  const low = values.length ? Math.min(...values) : current;
  const high = values.length ? Math.max(...values) : current;

  return (
    <main className="min-h-screen bg-bg text-fg">
      <div className="p-4 space-y-1 max-w-5xl mx-auto">
        <ProductHeader id={product.id} />

        <section className="bg-card rounded-3xl p-8 flex flex-col items-center text-center gap-4">
          <div className="flex items-center justify-between w-full text-[11px] uppercase tracking-wider text-muted">
            <span>{product.shop}</span>
            <span className="flex items-center gap-1">
              {product.lastError && (
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-red-500"
                  title={product.lastError}
                />
              )}
              {relativeTime(product.lastCheckedAt)}
            </span>
          </div>

          {product.imageUrl && (
            <img
              src={product.imageUrl}
              alt=""
              className="h-48 w-auto max-w-full object-contain"
            />
          )}

          <h1 className="text-2xl font-semibold leading-snug max-w-xl">
            {product.name}
          </h1>

          <a
            href={product.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
          >
            {new URL(product.url).hostname}
            <ExternalLink size={12} />
          </a>

          <div className="flex flex-col items-center gap-1 pt-2">
            <div className="text-4xl font-semibold flex items-center gap-2">
              <Truck size={22} aria-hidden="true" className="text-muted" />
              {money(product.lastTotalCost)}
            </div>
            {previous != null && previous !== current && (
              <div className="text-sm text-muted">was {money(previous)}</div>
            )}
          </div>
        </section>

        <section className="bg-card rounded-3xl p-6">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xs uppercase tracking-wider text-muted">Trend</h2>
            <div className="text-xs text-muted">
              low {money(low)} · high {money(high)}
            </div>
          </div>
          <Sparkline
            values={values}
            width={800}
            height={120}
            className="w-full h-auto"
          />
        </section>

        <ProductControls
          id={product.id}
          shop={product.shop}
          targetPrice={product.targetPrice ? Number(product.targetPrice) : null}
          isPreOrder={product.isPreOrder}
          currentTotal={current}
        />

        <section className="bg-card rounded-3xl p-6">
          <h2 className="text-xs uppercase tracking-wider text-muted mb-3">History</h2>
          <ul className="divide-y divide-border text-sm">
            {history.map((h) => {
              const hasShipping = Number(h.totalCost) !== Number(h.price);
              return (
                <li key={h.id} className="py-2 flex items-center justify-between">
                  <span className="text-muted">{formatDateTime(h.checkedAt)}</span>
                  <span className="tabular-nums">
                    {money(h.totalCost)}
                    {hasShipping && (
                      <span className="text-muted"> ({money(h.price)})</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}
