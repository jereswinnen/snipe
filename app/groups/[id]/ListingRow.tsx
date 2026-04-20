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
    <li className="py-3 flex items-center gap-3">
      <span className="text-muted shrink-0">
        {listing.medium === "digital" ? (
          <Download size={16} />
        ) : (
          <Truck size={16} />
        )}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">
          {listing.shop}
          {isCheapest && (
            <span className="ml-2 text-[10px] uppercase tracking-wider text-emerald-600">
              cheapest
            </span>
          )}
          {listing.isPreOrder && (
            <span className="ml-2 text-[10px] uppercase tracking-wider text-muted">
              pre-order
            </span>
          )}
        </div>
        {onSale && (
          <div className="text-xs text-emerald-600">
            sale ends {formatShortDate(listing.lastSaleEndsAt)}
          </div>
        )}
      </div>
      <div className="text-right tabular-nums">
        <div className="text-sm font-medium">{money(listing.lastTotalCost)}</div>
        {onSale && listing.lastRegularPrice && (
          <div className="text-xs text-muted line-through">
            {money(listing.lastRegularPrice)}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 ml-2">
        <a
          href={listing.url}
          target="_blank"
          rel="noreferrer"
          aria-label="Open store page"
          className="h-8 w-8 flex items-center justify-center rounded-full text-fg/60 hover:text-fg hover:bg-fg/5"
        >
          <ExternalLink size={14} />
        </a>
        <button
          onClick={checkNow}
          disabled={busy !== null}
          aria-label="Reload"
          className="h-8 w-8 flex items-center justify-center rounded-full text-fg/60 hover:text-fg hover:bg-fg/5 disabled:opacity-40"
        >
          <RefreshCw size={14} className={busy === "check" ? "animate-spin" : ""} />
        </button>
        <button
          onClick={remove}
          disabled={busy !== null}
          aria-label="Remove store"
          className="h-8 w-8 flex items-center justify-center rounded-full text-red-500 hover:bg-red-500/10 disabled:opacity-40"
        >
          <X size={14} />
        </button>
      </div>
    </li>
  );
}
