import { NextResponse } from "next/server";
import { respondError } from "@/lib/api/errors";
import {
  getGroupHistories,
  getProductGroup,
  listProductsByGroup,
} from "@/lib/db/queries";
import { buildCheapestOverTime, buildPerListingSeries } from "@/lib/trend";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) return respondError("bad_id", 400, "Invalid id");
  const group = await getProductGroup(id);
  if (!group) return respondError("not_found", 404, "Group not found");

  const url = new URL(req.url);
  const raw = Number(url.searchParams.get("days"));
  const days = Number.isFinite(raw) && raw > 0 && raw <= 3650 ? raw : 90;

  const listings = await listProductsByGroup(id);
  const histories = await getGroupHistories(id, days);

  const series = buildPerListingSeries(listings, histories);
  const cheapestOverTime = buildCheapestOverTime(
    listings.map((l) => ({
      listingId: l.id,
      history: histories.get(l.id) ?? [],
    })),
  );

  return NextResponse.json({ days, series, cheapestOverTime });
}
