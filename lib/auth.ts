import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_COOKIE = "snipe_auth";

function hmac(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

export function signSession(secret: string, issuedAtMs: number): string {
  const payload = String(issuedAtMs);
  return `${payload}.${hmac(secret, payload)}`;
}

export function verifySession(secret: string, token: string | undefined): boolean {
  if (!token) return false;
  const idx = token.indexOf(".");
  if (idx <= 0 || idx === token.length - 1) return false;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = hmac(secret, payload);
  if (sig.length !== expected.length) return false;
  const ok = timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  if (!ok) return false;
  const issued = Number(payload);
  if (!Number.isFinite(issued)) return false;
  return Date.now() - issued < MAX_AGE_MS;
}

export const SESSION_MAX_AGE_SECONDS = MAX_AGE_MS / 1000;
