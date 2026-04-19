"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Trash2 } from "lucide-react";

type Props = { id: number };

export default function ProductHeader({ id }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"check" | "delete" | null>(null);

  async function checkNow() {
    setBusy("check");
    await fetch(`/api/products/${id}/check`, { method: "POST" });
    setBusy(null);
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this product?")) return;
    setBusy("delete");
    await fetch(`/api/products/${id}`, { method: "DELETE" });
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
          onClick={checkNow}
          disabled={busy !== null}
          aria-label="Reload now"
          title="Reload now"
          className="h-10 w-10 flex items-center justify-center rounded-full text-fg/70 hover:text-fg hover:bg-fg/5 disabled:opacity-40"
        >
          <RefreshCw size={18} className={busy === "check" ? "animate-spin" : ""} />
        </button>
        <button
          onClick={remove}
          disabled={busy !== null}
          aria-label="Delete"
          title="Delete"
          className="h-10 w-10 flex items-center justify-center rounded-full text-red-500 hover:bg-red-500/10 disabled:opacity-40"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </header>
  );
}
