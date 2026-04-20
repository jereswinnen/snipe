"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ClipboardPaste, LogOut } from "lucide-react";
import UrlPrompt, { productErrorMessage } from "@/components/UrlPrompt";

export default function HeaderActions() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clipboardErr, setClipboardErr] = useState<string | null>(null);
  const router = useRouter();

  async function addUrl(value: string): Promise<string | null> {
    const res = await fetch("/api/products", {
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

  function flashError(message: string) {
    setClipboardErr(message);
    setTimeout(() => setClipboardErr(null), 2500);
  }

  async function pasteAndAdd() {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) return;
      setBusy(true);
      const err = await addUrl(text);
      setBusy(false);
      if (err) flashError(err);
    } catch {
      flashError("Clipboard blocked");
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <IconButton label="Add" onClick={() => setOpen(true)}>
          <Plus size={18} />
        </IconButton>
        <IconButton label="Paste URL" onClick={pasteAndAdd} disabled={busy}>
          <ClipboardPaste size={18} />
        </IconButton>
        <form action="/api/auth/logout" method="post">
          <IconButton label="Logout" type="submit">
            <LogOut size={18} />
          </IconButton>
        </form>
      </div>

      <UrlPrompt open={open} onClose={() => setOpen(false)} onSubmit={addUrl} />

      {clipboardErr && (
        <p
          role="alert"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-500 text-white text-sm px-4 py-2 rounded-full shadow"
        >
          {clipboardErr}
        </p>
      )}
    </>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="h-10 w-10 flex items-center justify-center rounded-full text-fg/70 hover:text-fg hover:bg-fg/5 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
