"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

export default function AddStoreButton({ groupId }: { groupId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = url.trim();
    if (!value) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: value, groupId }),
    });
    setBusy(false);
    if (res.ok) {
      setUrl("");
      setOpen(false);
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setErr(
        j.error === "duplicate"
          ? "This URL is already tracked"
          : j.error === "unsupported_shop"
            ? "Unsupported shop"
            : j.detail || "Failed",
      );
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-muted hover:text-fg"
      >
        <Plus size={14} />
        Add store
      </button>

      <div
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        className={
          "fixed inset-0 z-50 flex items-start justify-center bg-white/40 backdrop-blur-xl px-8 pt-[20vh] transition-opacity duration-200 ease-out " +
          (open ? "opacity-100" : "opacity-0 pointer-events-none")
        }
      >
        <form
          onClick={(e) => e.stopPropagation()}
          onSubmit={submit}
          className="w-full"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 text-fg/70 hover:text-fg"
          >
            <X size={22} />
          </button>
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste store URL for this product…"
            required
            disabled={busy}
            tabIndex={open ? 0 : -1}
            className="w-full bg-transparent text-4xl md:text-5xl font-light tracking-tight text-fg placeholder:text-fg/30 border-b border-fg/10 focus:border-fg/30 outline-none py-4"
          />
          <button type="submit" className="sr-only" tabIndex={open ? 0 : -1}>
            Add
          </button>
          {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
        </form>
      </div>
    </>
  );
}
