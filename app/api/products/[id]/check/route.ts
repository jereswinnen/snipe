import { NextResponse } from "next/server";
import { getProduct } from "@/lib/db/queries";
import { checkProduct } from "@/lib/check";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });
  const product = await getProduct(id);
  if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const outcome = await checkProduct(product);
  return NextResponse.json(outcome);
}
