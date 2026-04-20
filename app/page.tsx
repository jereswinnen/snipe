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
    ? rowsRaw.filter((r) => r.cheapest.medium === mediumFilter)
    : rowsRaw;

  const productIds = rows.map((r) => r.cheapest.id);
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
    const groupIds = rowsRaw.map((r) => r.group.id);
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
          {rows.map(({ group, cheapest }) => {
            const image = group.imageUrl ?? cheapest.imageUrl;
            const values = historyByProduct.get(cheapest.id) ?? [];
            const current = Number(cheapest.lastTotalCost);
            const previous = values.length >= 2 ? values[values.length - 2] : null;
            const onSale =
              cheapest.lastSaleEndsAt != null &&
              new Date(cheapest.lastSaleEndsAt).getTime() > Date.now() &&
              cheapest.lastRegularPrice != null;
            const hit =
              group.targetPrice != null &&
              Number(cheapest.lastTotalCost) <= Number(group.targetPrice);
            // Cheapest shop first (known from the main query), then the rest.
            const allShops = shopsByGroup.get(group.id) ?? [cheapest.shop];
            const shops = [cheapest.shop, ...allShops.filter((s) => s !== cheapest.shop)];

            return (
              <li
                key={group.id}
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
                    {cheapest.lastError && (
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full bg-red-500"
                        title={cheapest.lastError}
                      />
                    )}
                    {relativeTime(cheapest.lastCheckedAt)}
                  </span>
                </div>

                <Link href={`/groups/${group.id}`} className="block">
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
                  href={`/groups/${group.id}`}
                  className="text-sm font-medium leading-snug line-clamp-2 hover:underline"
                >
                  {group.title}
                </Link>

                <div className="flex flex-col items-center gap-1">
                  <div className="text-lg font-semibold flex items-center gap-1">
                    {cheapest.medium === "digital" ? (
                      <Download size={14} aria-hidden="true" className="text-muted" />
                    ) : (
                      <Truck size={14} aria-hidden="true" className="text-muted" />
                    )}
                    {money(cheapest.lastTotalCost)}
                    {onSale && (
                      <span className="ml-1 text-muted line-through text-xs font-normal">
                        {money(cheapest.lastRegularPrice!)}
                      </span>
                    )}
                  </div>
                  {onSale ? (
                    <div className="text-xs text-emerald-600 font-medium">
                      sale ends {formatShortDate(cheapest.lastSaleEndsAt)}
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
