import { z } from "zod";
import { parseRouteId, respondError, respondJson } from "@/lib/api/errors";
import {
  getProductGroup,
  updateProductGroup,
  deleteProductGroup,
  listProductsByGroup,
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const patch = z.object({
  title: z.string().min(1).optional(),
  imageUrl: z.string().url().nullable().optional(),
  targetPrice: z.number().positive().nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id: rawId } = await params;
  const id = parseRouteId(rawId);
  if (id === null) return respondError("bad_id", 400, "Invalid id");
  const group = await getProductGroup(id);
  if (!group) return respondError("not_found", 404, "Group not found");
  const listings = await listProductsByGroup(id);
  return respondJson({ group, listings });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id: rawId } = await params;
  const id = parseRouteId(rawId);
  if (id === null) return respondError("bad_id", 400, "Invalid id");
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return respondError("bad_request", 400, "Invalid body");

  const patchRow: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) patchRow.title = parsed.data.title;
  if (parsed.data.imageUrl !== undefined) patchRow.imageUrl = parsed.data.imageUrl;
  if (parsed.data.targetPrice === null) patchRow.targetPrice = null;
  else if (parsed.data.targetPrice !== undefined)
    patchRow.targetPrice = parsed.data.targetPrice.toFixed(2);

  await updateProductGroup(id, patchRow);
  return respondJson({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id: rawId } = await params;
  const id = parseRouteId(rawId);
  if (id === null) return respondError("bad_id", 400, "Invalid id");
  await deleteProductGroup(id);
  return respondJson({ ok: true });
}
