"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Truck, Download, ExternalLink, RefreshCw, X } from "lucide-react";
import { money, formatShortDate } from "@/lib/format";

type Listing = {
  id: number;
  shop: string;
  medium: "digital" | "physical";
  url: string;
  isPreOrder: boolean;
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
  const [busy, setBusy] = useState<"check" | "delete" | null>(null);

  async function checkNow() {
    setBusy("check");
    await fetch(`/api/products/${listing.id}/check`, { method: "POST" });
    setBusy(null);
    router.refresh();
  }

  async function remove() {
    const msg = isLast
      ? "This is the last store — removing it will delete the product. Continue?"
      : `Remove ${listing.shop} from this product?`;
    if (!confirm(msg)) return;
    setBusy("delete");
    await fetch(`/api/products/${listing.id}`, { method: "DELETE" });
    if (isLast) {
      window.location.href = "/";
    } else {
      setBusy(null);
      router.refresh();
    }
  }

  const onSale =
    listing.lastSaleEndsAt != null &&
    new Date(listing.lastSaleEndsAt).getTime() > Date.now() &&
    listing.lastRegularPrice != null;

  return (
    <li
      className={
        "flex items-center gap-4 rounded-2xl p-3 pr-2 transition " +
        (isCheapest
          ? "bg-emerald-500/8 ring-1 ring-emerald-500/30"
          : "bg-bg")
      }
    >
      <div
        className={
          "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center " +
          (isCheapest
            ? "bg-emerald-500/15 text-emerald-600"
            : "bg-card text-muted")
        }
      >
        {listing.medium === "digital" ? (
          <Download size={18} />
        ) : (
          <Truck size={18} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium capitalize">{listing.shop}</span>
          {isCheapest && (
            <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600">
              cheapest
            </span>
          )}
          {listing.isPreOrder && (
            <span className="text-[10px] uppercase tracking-wider text-muted">
              pre-order
            </span>
          )}
        </div>
        {onSale && (
          <div className="text-xs text-emerald-600 mt-0.5">
            sale ends {formatShortDate(listing.lastSaleEndsAt)}
          </div>
        )}
      </div>

      <div className="text-right tabular-nums leading-tight">
        <div className="text-base font-semibold">
          {money(listing.lastTotalCost)}
        </div>
        {onSale && listing.lastRegularPrice && (
          <div className="text-xs text-muted line-through">
            {money(listing.lastRegularPrice)}
          </div>
        )}
      </div>

      <div className="flex items-center rounded-full bg-card p-0.5 ml-1">
        <a
          href={listing.url}
          target="_blank"
          rel="noreferrer"
          aria-label="Open store page"
          title="Open store page"
          className="h-8 w-8 flex items-center justify-center rounded-full text-fg/60 hover:text-fg hover:bg-fg/5"
        >
          <ExternalLink size={14} />
        </a>
        <button
          onClick={checkNow}
          disabled={busy !== null}
          aria-label="Reload"
          title="Reload"
          className="h-8 w-8 flex items-center justify-center rounded-full text-fg/60 hover:text-fg hover:bg-fg/5 disabled:opacity-40"
        >
          <RefreshCw size={14} className={busy === "check" ? "animate-spin" : ""} />
        </button>
        <button
          onClick={remove}
          disabled={busy !== null}
          aria-label="Remove store"
          title="Remove"
          className="h-8 w-8 flex items-center justify-center rounded-full text-red-500/80 hover:text-red-500 hover:bg-red-500/10 disabled:opacity-40"
        >
          <X size={14} />
        </button>
      </div>
    </li>
  );
}
