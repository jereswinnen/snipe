import { NextResponse } from "next/server";
import { z } from "zod";
import { respondError } from "@/lib/api/errors";
import { upsertDevice } from "@/lib/db/queries";

const body = z.object({
  apnsToken: z.string().regex(/^[0-9a-fA-F]{16,200}$/),
  bundleId: z.string().min(1),
  environment: z.enum(["sandbox", "production"]),
});

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return respondError("bad_request", 400, "Invalid body");
  const device = await upsertDevice({
    apnsToken: parsed.data.apnsToken,
    bundleId: parsed.data.bundleId,
    environment: parsed.data.environment,
  });
  return NextResponse.json({ device });
}
