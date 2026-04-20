import { NextResponse } from "next/server";
import { respondError } from "@/lib/api/errors";
import { deleteDeviceByToken } from "@/lib/db/queries";

type Ctx = { params: Promise<{ token: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const { token } = await params;
  if (!token || !/^[0-9a-fA-F]{16,200}$/.test(token))
    return respondError("bad_request", 400, "Invalid token");
  await deleteDeviceByToken(token);
  return NextResponse.json({ ok: true });
}
