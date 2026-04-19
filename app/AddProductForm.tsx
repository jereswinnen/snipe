"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddProductForm() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
    setBusy(false);
    if (res.ok) {
      setUrl("");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setErr(j.error === "unsupported_shop" ? "Unsupported shop" : j.detail || "Failed");
    }
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste product URL"
        required
        className="flex-1 rounded bg-neutral-900 border border-neutral-800 px-3 py-2"
      />
      <button
        disabled={busy || !url}
        className="rounded bg-emerald-600 px-3 py-2 disabled:opacity-50"
      >
        {busy ? "…" : "Add"}
      </button>
      {err && <p className="text-sm text-red-400 w-full">{err}</p>}
    </form>
  );
}
