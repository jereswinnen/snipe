"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { money, formatShortDate } from "@/lib/format";
import { shopFaviconUrl } from "@/lib/shops";

type Listing = {
  id: number;
  shop: string;
  medium: "digital" | "physical";
  url: string;
  lastTotalCost: string;
  lastRegularPrice: string | null;
  lastSaleEndsAt: Date | string | null;
};

export default function ListingRow({
  listing,
  isCheapest,
  isLast,
}: {
  listing: Listing;
  isCheapest: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    const msg = isLast
      ? "This is the last store — removing it will delete the product. Continue?"
      : `Remove ${listing.shop} from this product?`;
    if (!confirm(msg)) return;
    setBusy(true);
    const res = await fetch(`/api/products/${listing.id}`, { method: "DELETE" });
    const body = (await res.json().catch(() => ({}))) as { deletedGroup?: boolean };
    if (body.deletedGroup) {
      window.location.href = "/";
    } else {
      setBusy(false);
      router.refresh();
    }
  }

  const onSale =
    listing.lastSaleEndsAt != null &&
    new Date(listing.lastSaleEndsAt).getTime() > Date.now() &&
    listing.lastRegularPrice != null;

  const meta: string[] = [listing.medium];
  if (isCheapest) meta.unshift("cheapest");
  if (onSale) meta.push(`sale ends ${formatShortDate(listing.lastSaleEndsAt)}`);

  return (
    <li className="group relative flex items-center">
      <a
        href={listing.url}
        target="_blank"
        rel="noreferrer"
        className="flex flex-1 items-center gap-4 py-3 pr-10 -mx-2 px-2 rounded-xl hover:bg-fg/[0.03]"
      >
        <img
          src={shopFaviconUrl(listing.shop)}
          alt=""
          aria-hidden="true"
          className="h-5 w-5 shrink-0 rounded-sm"
        />

        <div className="flex-1 min-w-0">
          <div
            className={
              "text-sm capitalize " +
              (isCheapest ? "font-semibold" : "font-medium")
            }
          >
            {listing.shop}
          </div>
          <div className="text-xs text-muted flex items-center gap-1.5 flex-wrap">
            {meta.map((m, i) => (
              <span
                key={i}
                className={m === "cheapest" ? "text-emerald-600 font-medium" : ""}
              >
                {i > 0 && <span className="text-fg/20 mr-1.5">·</span>}
                {m}
              </span>
            ))}
          </div>
        </div>

        <div className="text-right tabular-nums leading-tight">
          <div className="text-sm font-semibold">
            {money(listing.lastTotalCost)}
          </div>
          {onSale && listing.lastRegularPrice && (
            <div className="text-xs text-muted line-through">
              {money(listing.lastRegularPrice)}
            </div>
          )}
        </div>
      </a>

      <button
        onClick={remove}
        disabled={busy}
        aria-label="Remove store"
        title="Remove"
        className="absolute right-0 h-7 w-7 flex items-center justify-center rounded-full text-red-500/80 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 disabled:opacity-40"
      >
        <Trash2 size={14} />
      </button>
    </li>
  );
}
