// proxy.ts — Next.js 16 renamed middleware → proxy
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { env } from "@/lib/env";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/cron/check"];

function tokenFromRequest(request: NextRequest): string | undefined {
  // Bearer takes precedence; native clients never have the cookie.
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return request.cookies.get(SESSION_COOKIE)?.value;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  const token = tokenFromRequest(request);
  if (verifySession(env.APP_SECRET, token)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "unauthorized", message: "Authentication required" },
      { status: 401 },
    );
  }
  // RSC prefetches can't parse an HTML redirect as an RSC payload — the
  // browser logs "Failed to fetch RSC payload". Return 401 so Next treats
  // the prefetch as a miss and the user still gets redirected by the
  // subsequent full navigation.
  if (request.headers.get("RSC") === "1") {
    return new NextResponse(null, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals, HMR, and any path with a file extension (assets).
  matcher: ["/((?!_next/|favicon\\.ico|.*\\.[^/]+$).*)"],
};
