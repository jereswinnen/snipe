import Link from "next/link";
import { Truck, Download } from "lucide-react";
import { asc, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { listGroupsWithCheapest } from "@/lib/db/queries";
import { money, relativeTime, formatShortDate } from "@/lib/format";
import { Sparkline } from "@/components/Sparkline";
import { shopFaviconUrl } from "@/lib/shops";
import HeaderActions from "./HeaderActions";

export const dynamic = "force-dynamic";

type Search = { m?: string };

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { m } = await searchParams;
  const mediumFilter = m === "digital" || m === "physical" ? m : null;

  const rowsRaw = await listGroupsWithCheapest();
  const rows = mediumFilter
    ? rowsRaw.filter((r) => r.medium === mediumFilter)
    : rowsRaw;

  const productIds = rows.map((r) => r.id as number);
  const historyByProduct = new Map<number, number[]>();
  if (productIds.length) {
    const hist = await db
      .select()
      .from(schema.priceHistory)
      .where(inArray(schema.priceHistory.productId, productIds))
      .orderBy(asc(schema.priceHistory.checkedAt));
    for (const h of hist) {
      const arr = historyByProduct.get(h.productId) ?? [];
      arr.push(Number(h.totalCost));
      historyByProduct.set(h.productId, arr);
    }
  }

  const shopsByGroup = new Map<number, string[]>();
  if (rowsRaw.length) {
    const groupIds = rowsRaw.map((r) => r.group_id as number);
    const memberships = await db
      .select({
        groupId: schema.products.groupId,
        shop: schema.products.shop,
      })
      .from(schema.products)
      .where(inArray(schema.products.groupId, groupIds));
    for (const m of memberships) {
      if (m.groupId == null) continue;
      const arr = shopsByGroup.get(m.groupId) ?? [];
      arr.push(m.shop);
      shopsByGroup.set(m.groupId, arr);
    }
  }

  return (
    <main className="min-h-screen bg-bg text-fg">
      <div className="p-4 space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Snipe</h1>
          <HeaderActions />
        </header>

        <FilterChips active={mediumFilter} />

        <ul className="grid gap-1 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
          {rows.map((row) => {
            const groupId = row.group_id as number;
            const title = (row.group_title as string) ?? (row.name as string);
            const image = (row.group_image_url as string | null) ?? (row.image_url as string | null);
            const productId = row.id as number;
            const medium = row.medium as "digital" | "physical";
            const shop = row.shop as string;
            const lastTotalCost = row.last_total_cost as string;
            const lastRegularPrice = row.last_regular_price as string | null;
            const lastSaleEndsAt = row.last_sale_ends_at as Date | null;
            const lastCheckedAt = row.last_checked_at as Date | null;
            const lastError = row.last_error as string | null;
            const groupTarget = row.group_target_price as string | null;

            const values = historyByProduct.get(productId) ?? [];
            const current = Number(lastTotalCost);
            const previous = values.length >= 2 ? values[values.length - 2] : null;
            const onSale =
              lastSaleEndsAt != null &&
              new Date(lastSaleEndsAt).getTime() > Date.now() &&
              lastRegularPrice != null;
            const hit =
              groupTarget != null && Number(lastTotalCost) <= Number(groupTarget);
            // Cheapest shop first (known from the main query), then the rest.
            const allShops = shopsByGroup.get(groupId) ?? [shop];
            const shops = [shop, ...allShops.filter((s) => s !== shop)];

            return (
              <li
                key={groupId}
                className={
                  "bg-card rounded-3xl p-5 flex flex-col items-center text-center gap-3 " +
                  (hit ? "ring-2 ring-emerald-500/60" : "")
                }
              >
                <div className="w-full flex items-center justify-between text-[11px] uppercase tracking-wider text-muted">
                  <div className="flex items-center">
                    {shops.map((s, i) => (
                      <img
                        key={`${s}-${i}`}
                        src={shopFaviconUrl(s)}
                        alt={s}
                        title={s}
                        className={
                          "h-4 w-4 rounded-sm ring-2 ring-card " +
                          (i > 0 ? "-ml-1.5" : "")
                        }
                        style={{ zIndex: shops.length - i }}
                      />
                    ))}
                  </div>
                  <span className="flex items-center gap-1">
                    {lastError && (
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full bg-red-500"
                        title={lastError}
                      />
                    )}
                    {relativeTime(lastCheckedAt)}
                  </span>
                </div>

                <Link href={`/groups/${groupId}`} className="block">
                  {image ? (
                    <img
                      src={image}
                      alt=""
                      className="h-28 w-auto max-w-full object-contain"
                    />
                  ) : (
                    <div className="h-28 w-28" />
                  )}
                </Link>

                <Link
                  href={`/groups/${groupId}`}
                  className="text-sm font-medium leading-snug line-clamp-2 hover:underline"
                >
                  {title}
                </Link>

                <div className="flex flex-col items-center gap-1">
                  <div className="text-lg font-semibold flex items-center gap-1">
                    {medium === "digital" ? (
                      <Download size={14} aria-hidden="true" className="text-muted" />
                    ) : (
                      <Truck size={14} aria-hidden="true" className="text-muted" />
                    )}
                    {money(lastTotalCost)}
                    {onSale && (
                      <span className="ml-1 text-muted line-through text-xs font-normal">
                        {money(lastRegularPrice!)}
                      </span>
                    )}
                  </div>
                  {onSale ? (
                    <div className="text-xs text-emerald-600 font-medium">
                      sale ends {formatShortDate(lastSaleEndsAt)}
                    </div>
                  ) : (
                    previous != null && previous !== current && (
                      <div className="text-xs text-muted">was {money(previous)}</div>
                    )
                  )}
                </div>

                <Sparkline values={values} height={28} className="w-full h-7" />
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}

function FilterChips({ active }: { active: "digital" | "physical" | null }) {
  const base =
    "px-3 py-1.5 rounded-full text-xs uppercase tracking-wider transition";
  const on = "bg-fg text-bg";
  const off = "bg-card text-muted hover:text-fg";
  return (
    <nav className="flex items-center gap-1">
      <Link href="/" className={`${base} ${active === null ? on : off}`}>
        All
      </Link>
      <Link
        href="/?m=digital"
        className={`${base} ${active === "digital" ? on : off}`}
      >
        Digital
      </Link>
      <Link
        href="/?m=physical"
        className={`${base} ${active === "physical" ? on : off}`}
      >
        Physical
      </Link>
    </nav>
  );
}
