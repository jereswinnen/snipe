"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import UrlPrompt, { productErrorMessage } from "@/components/UrlPrompt";

export default function AddStoreButton({ groupId }: { groupId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function addUrl(value: string): Promise<string | null> {
    const res = await fetch(`/api/groups/${groupId}/listings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: value }),
    });
    if (res.ok) {
      router.refresh();
      return null;
    }
    const body = await res.json().catch(() => ({}));
    return productErrorMessage(body);
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
      <UrlPrompt
        open={open}
        onClose={() => setOpen(false)}
        placeholder="Paste store URL for this product…"
        onSubmit={addUrl}
      />
    </>
  );
}
