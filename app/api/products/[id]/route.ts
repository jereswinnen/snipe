import { NextResponse } from "next/server";
import {
  getProduct,
  getHistory,
  deleteProduct,
  countProductsInGroup,
  deleteProductGroup,
} from "@/lib/db/queries";

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

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });
  const product = await getProduct(id);
  if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await deleteProduct(id);

  if (product.groupId != null) {
    const remaining = await countProductsInGroup(product.groupId);
    if (remaining === 0) await deleteProductGroup(product.groupId);
  }

  return NextResponse.json({ ok: true });
}
