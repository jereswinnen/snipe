"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { money } from "@/lib/format";

type Props = {
  id: number;
  shop: string;
  targetPrice: number | null;
  isPreOrder: boolean;
  currentTotal: number;
};

export default function ProductControls({
  id,
  shop,
  targetPrice,
  isPreOrder,
  currentTotal,
}: Props) {
  const router = useRouter();
  const [target, setTarget] = useState(targetPrice != null ? String(targetPrice) : "");
  const [preorder, setPreorder] = useState(isPreOrder);
  const [savedPulse, setSavedPulse] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const savedTarget = targetPrice;
  const parsed = target.trim() === "" ? null : Number(target);
  const dirty = (parsed ?? null) !== (savedTarget ?? null);

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    router.refresh();
  }

  async function commitTarget() {
    if (!dirty) return;
    if (parsed != null && !Number.isFinite(parsed)) return;
    await patch({ targetPrice: parsed });
    setSavedPulse(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedPulse(false), 1200);
  }

  const hit = savedTarget != null && currentTotal <= savedTarget;
  const delta =
    savedTarget != null ? Number((currentTotal - savedTarget).toFixed(2)) : null;

  return (
    <section className="bg-card rounded-3xl p-6 space-y-5">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted mb-1">
          Target price
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-light text-muted">€</span>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onBlur={commitTarget}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="—"
            className="min-w-0 flex-1 bg-transparent text-3xl font-light tabular-nums outline-none placeholder:text-fg/20"
          />
          {savedPulse && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
              <Check size={14} /> saved
            </span>
          )}
        </div>
        <div className="mt-1 text-xs">
          {savedTarget == null ? (
            <span className="text-muted">no target set</span>
          ) : hit ? (
            <span className="text-emerald-600 font-medium">
              target reached · {money(currentTotal)}
            </span>
          ) : (
            <span className="text-muted">
              {money(Math.abs(delta!))} above target
            </span>
          )}
        </div>
      </div>

      {shop === "nedgame" && (
        <label className="flex items-center gap-2 text-sm text-muted">
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
    </section>
  );
}
