import { NextResponse } from "next/server";
import { z } from "zod";
import { getProduct, getHistory, updateProduct, deleteProduct } from "@/lib/db/queries";

const patch = z.object({
  targetPrice: z.number().positive().nullable().optional(),
  isPreOrder: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });
  const product = await getProduct(id);
  if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const history = await getHistory(id, 90);
  return NextResponse.json({ product, history });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const patchRow: Record<string, unknown> = {};
  if (parsed.data.targetPrice === null) patchRow.targetPrice = null;
  else if (parsed.data.targetPrice !== undefined)
    patchRow.targetPrice = parsed.data.targetPrice.toFixed(2);
  if (parsed.data.isPreOrder !== undefined) patchRow.isPreOrder = parsed.data.isPreOrder;
  await updateProduct(id, patchRow);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });
  await deleteProduct(id);
  return NextResponse.json({ ok: true });
}
