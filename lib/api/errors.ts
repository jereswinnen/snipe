import { NextResponse } from "next/server";

/**
 * Stable error codes returned on every 4xx/5xx JSON body. Keep this list
 * short and do not repurpose codes — native clients key localized strings
 * off them. Add new codes by appending to the tuple.
 */
export const API_ERROR_CODES = [
  "bad_request",
  "unauthorized",
  "not_found",
  "duplicate_url",
  "unsupported_shop",
  "scrape_failed",
  "group_not_found",
  "bad_id",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export type ApiErrorBody = {
  error: ApiErrorCode;
  message: string;
};

/** Headers attached to every API response — Snipe data is always live, so
 *  no intermediary (CDN, Service Worker, URL cache) should keep it around. */
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
};

export function respondError(
  code: ApiErrorCode,
  status: number,
  message: string,
): NextResponse {
  return NextResponse.json<ApiErrorBody>(
    { error: code, message },
    { status, headers: NO_STORE_HEADERS },
  );
}

/** JSON response with no-store cache semantics. Replace plain
 *  `NextResponse.json(...)` calls with this in every API handler. */
export function respondJson<T>(body: T, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

/** Postgres `serial` is int4 — 1 .. 2,147,483,647. Anything outside that
 *  range can't possibly match a real row and would otherwise blow up the
 *  query with `value out of range for type integer` (SQLSTATE 22003).
 *  Returns null for invalid input so callers can 400 cleanly. */
const PG_INT4_MAX = 2_147_483_647;
export function parseRouteId(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > PG_INT4_MAX) return null;
  return n;
}
