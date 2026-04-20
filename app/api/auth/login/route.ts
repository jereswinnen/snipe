import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { respondError } from "@/lib/api/errors";
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";

const body = z.object({ password: z.string().min(1) });

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return respondError("bad_request", 400, "Invalid body");
  if (parsed.data.password !== env.APP_PASSWORD) {
    return respondError("unauthorized", 401, "Wrong password");
  }
  const token = signSession(env.APP_SECRET, Date.now());
  // Web client reads the cookie; native clients keep the token body value
  // in Keychain and send it as `Authorization: Bearer <token>`.
  const res = NextResponse.json({ ok: true, token });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
