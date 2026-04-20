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

export function respondError(
  code: ApiErrorCode,
  status: number,
  message: string,
): NextResponse {
  return NextResponse.json<ApiErrorBody>({ error: code, message }, { status });
}
