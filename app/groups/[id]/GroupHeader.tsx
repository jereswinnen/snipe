"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Trash2 } from "lucide-react";

type Props = { id: number; listingIds: number[] };

export default function GroupHeader({ id, listingIds }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"check" | "delete" | null>(null);

  async function checkAll() {
    setBusy("check");
    await Promise.all(
      listingIds.map((lid) =>
        fetch(`/api/listings/${lid}/check`, { method: "POST" }),
      ),
    );
    setBusy(null);
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this product and all its tracked stores?")) return;
    setBusy("delete");
    await fetch(`/api/groups/${id}`, { method: "DELETE" });
    window.location.href = "/";
  }

  return (
    <header className="flex items-center justify-between py-2">
      <Link
        href="/"
        aria-label="Back"
        className="h-10 w-10 flex items-center justify-center rounded-full text-fg/70 hover:text-fg hover:bg-fg/5"
      >
        <ArrowLeft size={18} />
      </Link>
      <div className="flex items-center gap-1">
        <button
          onClick={checkAll}
          disabled={busy !== null}
          aria-label="Reload all"
          title="Reload all stores"
          className="h-10 w-10 flex items-center justify-center rounded-full text-fg/70 hover:text-fg hover:bg-fg/5 disabled:opacity-40"
        >
          <RefreshCw size={18} className={busy === "check" ? "animate-spin" : ""} />
        </button>
        <button
          onClick={remove}
          disabled={busy !== null}
          aria-label="Delete"
          title="Delete this product"
          className="h-10 w-10 flex items-center justify-center rounded-full text-red-500 hover:bg-red-500/10 disabled:opacity-40"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </header>
  );
}
