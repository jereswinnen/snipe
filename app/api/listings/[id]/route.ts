import { respondError, respondJson } from "@/lib/api/errors";
import {
  countProductsInGroup,
  deleteProduct,
  deleteProductGroup,
  getProduct,
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) return respondError("bad_id", 400, "Invalid id");
  const listing = await getProduct(id);
  if (!listing) return respondError("not_found", 404, "Listing not found");
  return respondJson({ listing });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) return respondError("bad_id", 400, "Invalid id");
  const listing = await getProduct(id);
  if (!listing) return respondError("not_found", 404, "Listing not found");

  await deleteProduct(id);

  let deletedGroup = false;
  if (listing.groupId != null) {
    const remaining = await countProductsInGroup(listing.groupId);
    if (remaining === 0) {
      await deleteProductGroup(listing.groupId);
      deletedGroup = true;
    }
  }

  return respondJson({ ok: true, deletedGroup });
}
