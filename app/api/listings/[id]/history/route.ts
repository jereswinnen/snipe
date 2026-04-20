import { NextResponse } from "next/server";
import { respondError } from "@/lib/api/errors";
import { getListingHistory, getProduct } from "@/lib/db/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) return respondError("bad_id", 400, "Invalid id");
  const listing = await getProduct(id);
  if (!listing) return respondError("not_found", 404, "Listing not found");

  const url = new URL(req.url);
  const raw = Number(url.searchParams.get("days"));
  const days = Number.isFinite(raw) && raw > 0 && raw <= 3650 ? raw : 90;

  const rows = await getListingHistory(id, days);
  const points = rows.map((r) => ({
    checkedAt: new Date(r.checkedAt).toISOString(),
    price: Number(r.price),
    totalCost: Number(r.totalCost),
  }));
  return NextResponse.json({ days, points });
}
