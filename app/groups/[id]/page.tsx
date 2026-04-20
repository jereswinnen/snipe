import { notFound } from "next/navigation";
import { Truck, Download } from "lucide-react";
import {
  getProductGroup,
  listProductsByGroup,
  getHistory,
} from "@/lib/db/queries";
import { money, relativeTime, formatDateTime, formatShortDate } from "@/lib/format";
import { TrendChart } from "@/components/TrendChart";
import GroupHeader from "./GroupHeader";
import GroupControls from "./GroupControls";
import ListingRow from "./ListingRow";
import AddStoreButton from "./AddStoreButton";

export const dynamic = "force-dynamic";

type HistoryRow = {
  id: number;
  productId: number;
  price: string;
  totalCost: string;
  checkedAt: Date;
};

/**
 * Given per-listing histories, produce a chronological series of
 * { checkedAt, minTotal } — the cheapest total available across any
 * listing at each moment. This is the right thing to plot/summarise
 * for a multi-store group.
 */
function buildCheapestOverTime(
  perListing: { listingId: number; history: HistoryRow[] }[],
): { checkedAt: Date; minTotal: number }[] {
  const all = perListing
    .flatMap(({ listingId, history }) =>
      history.map((h) => ({
        listingId,
        checkedAt: new Date(h.checkedAt),
        total: Number(h.totalCost),
      })),
    )
    .sort((a, b) => a.checkedAt.getTime() - b.checkedAt.getTime());
  const latest = new Map<number, number>();
  const out: { checkedAt: Date; minTotal: number }[] = [];
  for (const row of all) {
    latest.set(row.listingId, row.total);
    const minTotal = Math.min(...latest.values());
    out.push({ checkedAt: row.checkedAt, minTotal });
  }
  return out;
}

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

  const historiesRaw = await Promise.all(
    listings.map((l) => getHistory(l.id, 365)),
  );
  const historiesByListing = new Map(
    listings.map((l, i) => [l.id, historiesRaw[i]]),
  );
  const shopByListing = new Map(listings.map((l) => [l.id, l.shop]));

  const combined = buildCheapestOverTime(
    listings.map((l, i) => ({ listingId: l.id, history: historiesRaw[i] })),
  );
  const trendPoints = combined.map((p) => ({
    t: p.checkedAt.toISOString(),
    v: p.minTotal,
  }));
  const values = combined.map((p) => p.minTotal);
  const current = Number(cheapest.lastTotalCost);
  const previous = values.length >= 2 ? values[values.length - 2] : null;
  const low = values.length ? Math.min(...values) : current;
  const high = values.length ? Math.max(...values) : current;

  // Unified timeline of every per-listing check, newest first.
  const timeline = listings
    .flatMap((l) =>
      (historiesByListing.get(l.id) ?? []).map((h) => ({
        id: h.id,
        listingId: l.id,
        shop: l.shop,
        price: h.price,
        totalCost: h.totalCost,
        checkedAt: h.checkedAt,
      })),
    )
    .sort(
      (a, b) =>
        new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime(),
    )
    .slice(0, 200);

  const saleEndsAt = cheapest.lastSaleEndsAt;
  const onSale =
    saleEndsAt != null &&
    new Date(saleEndsAt).getTime() > Date.now() &&
    cheapest.lastRegularPrice != null;

  const multiStore = listings.length > 1;

  return (
    <main className="min-h-screen bg-bg text-fg">
      <div className="p-4 space-y-1 max-w-5xl mx-auto">
        <GroupHeader id={group.id} listingIds={listings.map((l) => l.id)} />

        <section className="bg-card rounded-3xl p-8 flex flex-col items-center text-center gap-4">
          <div className="flex items-center justify-between w-full text-[11px] uppercase tracking-wider text-muted">
            <span>
              cheapest · {cheapest.shop}
              {multiStore && (
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
            <h2 className="text-xs uppercase tracking-wider text-muted">
              Trend{multiStore && " · cheapest"}
            </h2>
            <div className="text-xs text-muted">
              low {money(low)} · high {money(high)}
            </div>
          </div>
          <TrendChart points={trendPoints} height={160} className="w-full" />
        </section>

        <section className="bg-card rounded-3xl p-6">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xs uppercase tracking-wider text-muted">Stores</h2>
            <AddStoreButton groupId={group.id} />
          </div>
          <ul className="space-y-2">
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
            History
          </h2>
          <ul className="divide-y divide-border text-sm">
            {timeline.map((h) => {
              const hasShipping = Number(h.totalCost) !== Number(h.price);
              return (
                <li key={h.id} className="py-2 flex items-center justify-between gap-3">
                  <span className="text-muted min-w-0 truncate">
                    {formatDateTime(h.checkedAt)}
                  </span>
                  <span className="flex items-center gap-3 tabular-nums">
                    {multiStore && (
                      <span className="text-[11px] uppercase tracking-wider text-muted">
                        {shopByListing.get(h.listingId)}
                      </span>
                    )}
                    <span>
                      {money(h.totalCost)}
                      {hasShipping && (
                        <span className="text-muted"> ({money(h.price)})</span>
                      )}
                    </span>
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
