"use client";
import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) window.location.href = "/";
    else setErr("Wrong password");
  }

  return (
    <main className="min-h-screen grid place-items-center bg-neutral-950 text-neutral-100">
      <form onSubmit={onSubmit} className="w-72 space-y-3">
        <h1 className="text-lg font-semibold">Snipe</h1>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded bg-neutral-900 border border-neutral-800 px-3 py-2"
          placeholder="Password"
        />
        <button
          disabled={busy}
          className="w-full rounded bg-emerald-600 py-2 font-medium disabled:opacity-50"
        >
          {busy ? "…" : "Enter"}
        </button>
        {err && <p className="text-sm text-red-400">{err}</p>}
      </form>
    </main>
  );
}
