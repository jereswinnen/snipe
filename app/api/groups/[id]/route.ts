import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getProductGroup,
  updateProductGroup,
  deleteProductGroup,
} from "@/lib/db/queries";

const patch = z.object({
  title: z.string().min(1).optional(),
  imageUrl: z.string().url().nullable().optional(),
  targetPrice: z.number().positive().nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });
  const group = await getProductGroup(id);
  if (!group) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ group });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const patchRow: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) patchRow.title = parsed.data.title;
  if (parsed.data.imageUrl !== undefined) patchRow.imageUrl = parsed.data.imageUrl;
  if (parsed.data.targetPrice === null) patchRow.targetPrice = null;
  else if (parsed.data.targetPrice !== undefined)
    patchRow.targetPrice = parsed.data.targetPrice.toFixed(2);

  await updateProductGroup(id, patchRow);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });
  await deleteProductGroup(id);
  return NextResponse.json({ ok: true });
}
