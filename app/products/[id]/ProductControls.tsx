"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  id: number;
  shop: string;
  targetPrice: number | null;
  isPreOrder: boolean;
};

export default function ProductControls({ id, shop, targetPrice, isPreOrder }: Props) {
  const router = useRouter();
  const [target, setTarget] = useState(targetPrice != null ? String(targetPrice) : "");
  const [preorder, setPreorder] = useState(isPreOrder);
  const [busy, setBusy] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy("save");
    await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    router.refresh();
  }

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
    setBusy(null);
    window.location.href = "/";
  }

  return (
    <div className="space-y-3 rounded border border-neutral-800 bg-neutral-900 p-3">
      <div className="flex items-center gap-2">
        <label className="text-sm text-neutral-400 w-32">Target price</label>
        <input
          type="number"
          step="0.01"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-28 rounded bg-neutral-950 border border-neutral-800 px-2 py-1"
          placeholder="—"
        />
        <button
          onClick={() => patch({ targetPrice: target ? Number(target) : null })}
          className="rounded bg-neutral-800 px-3 py-1 text-sm"
          disabled={busy !== null}
        >
          Save
        </button>
      </div>
      {shop === "nedgame" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={preorder}
            onChange={(e) => {
              setPreorder(e.target.checked);
              patch({ isPreOrder: e.target.checked });
            }}
          />
          Pre-order (free shipping)
        </label>
      )}
      <div className="flex gap-2 pt-2">
        <button
          onClick={checkNow}
          disabled={busy !== null}
          className="rounded bg-emerald-600 px-3 py-1 text-sm disabled:opacity-50"
        >
          {busy === "check" ? "Checking…" : "Check now"}
        </button>
        <button
          onClick={remove}
          disabled={busy !== null}
          className="rounded bg-red-900/70 px-3 py-1 text-sm disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
