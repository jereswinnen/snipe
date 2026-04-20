"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  placeholder?: string;
  /**
   * Called when the user submits a non-empty URL. Return `null` on success
   * (the prompt clears and closes) or a user-facing error string to display
   * inline without closing.
   */
  onSubmit: (url: string) => Promise<string | null>;
};

export default function UrlPrompt({
  open,
  onClose,
  placeholder = "Paste product URL…",
  onSubmit,
}: Props) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = url.trim();
    if (!value) return;
    setBusy(true);
    setErr(null);
    const message = await onSubmit(value);
    setBusy(false);
    if (message) {
      setErr(message);
    } else {
      setUrl("");
      onClose();
    }
  }

  return (
    <div
      aria-hidden={!open}
      onClick={onClose}
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
          onClick={onClose}
          className="absolute top-4 right-4 text-fg/70 hover:text-fg"
        >
          <X size={22} />
        </button>
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={placeholder}
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
  );
}

/** Maps the API's product-create error codes to a user-facing message. */
export function productErrorMessage(body: {
  error?: string;
  detail?: string;
}): string {
  switch (body.error) {
    case "duplicate":
      return "This URL is already tracked";
    case "unsupported_shop":
      return "Unsupported shop";
    default:
      return body.detail || "Failed";
  }
}
