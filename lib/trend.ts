import type { PriceHistoryRow } from "@/lib/db/schema";

export type TrendPoint = {
  checkedAt: string; // ISO 8601
  value: number;
};

export type PerListingSeries = {
  shop: string;
  listingId: number;
  points: TrendPoint[];
};

export type GroupTrend = {
  series: PerListingSeries[];
  cheapestOverTime: TrendPoint[];
};

/**
 * Given per-listing histories, produce a chronological series of
 * { checkedAt, minTotal } — the cheapest total available across any
 * listing at each moment. Walks the merged timeline once, tracking the
 * latest known total per listing, and emits the running minimum.
 */
export function buildCheapestOverTime(
  perListing: { listingId: number; history: PriceHistoryRow[] }[],
): TrendPoint[] {
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
  const out: TrendPoint[] = [];
  for (const row of all) {
    latest.set(row.listingId, row.total);
    const min = Math.min(...latest.values());
    out.push({ checkedAt: row.checkedAt.toISOString(), value: min });
  }
  return out;
}

/**
 * Turn raw per-listing history rows into chart-ready series, sorted by time
 * ascending within each series.
 */
export function buildPerListingSeries(
  listings: { id: number; shop: string }[],
  historiesByListing: Map<number, PriceHistoryRow[]>,
): PerListingSeries[] {
  return listings
    .map((l) => {
      const rows = historiesByListing.get(l.id) ?? [];
      const points = rows
        .slice()
        .sort(
          (a, b) =>
            new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime(),
        )
        .map((h) => ({
          checkedAt: new Date(h.checkedAt).toISOString(),
          value: Number(h.totalCost),
        }));
      return { shop: l.shop, listingId: l.id, points };
    })
    .filter((s) => s.points.length > 0);
}
