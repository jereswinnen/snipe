import { parseRouteId, respondError, respondJson } from "@/lib/api/errors";
import { getProduct } from "@/lib/db/queries";
import { checkProduct } from "@/lib/check";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { id: rawId } = await params;
  const id = parseRouteId(rawId);
  if (id === null) return respondError("bad_id", 400, "Invalid id");
  const listing = await getProduct(id);
  if (!listing) return respondError("not_found", 404, "Listing not found");
  const outcome = await checkProduct(listing);
  return respondJson(outcome);
}
