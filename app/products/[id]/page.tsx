import { redirect, notFound } from "next/navigation";
import { getProduct } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) notFound();
  const product = await getProduct(id);
  if (!product) notFound();
  if (product.groupId == null) notFound();
  redirect(`/groups/${product.groupId}`);
}
