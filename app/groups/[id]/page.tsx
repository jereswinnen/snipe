import { notFound } from "next/navigation";
import { Truck, Download, ExternalLink } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import {
  getProductGroup,
  listProductsByGroup,
  getHistory,
} from "@/lib/db/queries";
import { money, relativeTime, formatDateTime, formatShortDate } from "@/lib/format";
import { Sparkline } from "@/components/Sparkline";
import GroupHeader from "./GroupHeader";
import GroupControls from "./GroupControls";
import ListingRow from "./ListingRow";
import AddStoreButton from "./AddStoreButton";

export const dynamic = "force-dynamic";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) notFound();
  const group = await getProductGroup(id);
  if (!group) notFound();

  const listings = await listProductsByGroup(id);
  if (listings.length === 0) notFound();

  const cheapest = listings[0]; // listProductsByGroup orders by last_total_cost asc

  const history = await getHistory(cheapest.id, 90);
  const values = [...history].reverse().map((h) => Number(h.totalCost));
  const current = Number(cheapest.lastTotalCost);
  const previous = values.length >= 2 ? values[values.length - 2] : null;
  const low = values.length ? Math.min(...values) : current;
  const high = values.length ? Math.max(...values) : current;

  const saleEndsAt = cheapest.lastSaleEndsAt;
  const onSale =
    saleEndsAt != null &&
    new Date(saleEndsAt).getTime() > Date.now() &&
    cheapest.lastRegularPrice != null;

  return (
    <main className="min-h-screen bg-bg text-fg">
      <div className="p-4 space-y-1 max-w-5xl mx-auto">
        <GroupHeader id={group.id} listingIds={listings.map((l) => l.id)} />

        <section className="bg-card rounded-3xl p-8 flex flex-col items-center text-center gap-4">
          <div className="flex items-center justify-between w-full text-[11px] uppercase tracking-wider text-muted">
            <span>
              cheapest · {cheapest.shop}
              {listings.length > 1 && (
                <span className="ml-1 text-fg/50">· {listings.length} stores</span>
              )}
            </span>
            <span>{relativeTime(cheapest.lastCheckedAt)}</span>
          </div>

          {(group.imageUrl || cheapest.imageUrl) && (
            <img
              src={group.imageUrl ?? cheapest.imageUrl!}
              alt=""
              className="h-48 w-auto max-w-full object-contain"
            />
          )}

          <h1 className="text-2xl font-semibold leading-snug max-w-xl">
            {group.title}
          </h1>

          <div className="flex flex-col items-center gap-1 pt-2">
            <div className="text-4xl font-semibold flex items-center gap-2">
              {cheapest.medium === "digital" ? (
                <Download size={22} aria-hidden="true" className="text-muted" />
              ) : (
                <Truck size={22} aria-hidden="true" className="text-muted" />
              )}
              {money(cheapest.lastTotalCost)}
              {onSale && (
                <span className="text-xl text-muted line-through font-normal">
                  {money(cheapest.lastRegularPrice!)}
                </span>
              )}
            </div>
            {onSale ? (
              <div className="text-sm text-emerald-600 font-medium">
                sale ends {formatShortDate(saleEndsAt)}
              </div>
            ) : (
              previous != null && previous !== current && (
                <div className="text-sm text-muted">was {money(previous)}</div>
              )
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

        <section className="bg-card rounded-3xl p-6 space-y-1">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-xs uppercase tracking-wider text-muted">Stores</h2>
            <AddStoreButton groupId={group.id} />
          </div>
          <ul className="divide-y divide-border">
            {listings.map((l) => (
              <ListingRow
                key={l.id}
                listing={{
                  id: l.id,
                  shop: l.shop,
                  medium: l.medium,
                  url: l.url,
                  isPreOrder: l.isPreOrder,
                  lastTotalCost: l.lastTotalCost,
                  lastRegularPrice: l.lastRegularPrice,
                  lastSaleEndsAt: l.lastSaleEndsAt,
                }}
                isCheapest={l.id === cheapest.id}
                isLast={listings.length === 1}
              />
            ))}
          </ul>
        </section>

        <GroupControls
          id={group.id}
          targetPrice={group.targetPrice ? Number(group.targetPrice) : null}
          currentTotal={current}
        />

        <section className="bg-card rounded-3xl p-6">
          <h2 className="text-xs uppercase tracking-wider text-muted mb-3">
            History · {cheapest.shop}
          </h2>
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
