import { eq, desc, asc, sql } from "drizzle-orm";
import { db, schema } from "./client";
import type { Product, ProductGroup } from "./schema";

// --- listings (legacy name: products) ---------------------------------------

export async function listProducts() {
  return db.select().from(schema.products).orderBy(desc(schema.products.updatedAt));
}

export async function getProduct(id: number) {
  const rows = await db.select().from(schema.products).where(eq(schema.products.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getHistory(productId: number, limit = 30) {
  return db
    .select()
    .from(schema.priceHistory)
    .where(eq(schema.priceHistory.productId, productId))
    .orderBy(desc(schema.priceHistory.checkedAt))
    .limit(limit);
}

export async function insertHistory(row: typeof schema.priceHistory.$inferInsert) {
  await db.insert(schema.priceHistory).values(row);
}

export async function updateProduct(
  id: number,
  patch: Partial<typeof schema.products.$inferInsert>,
) {
  await db
    .update(schema.products)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.products.id, id));
}

export async function insertProduct(p: typeof schema.products.$inferInsert) {
  const rows = await db.insert(schema.products).values(p).returning();
  return rows[0];
}

export async function deleteProduct(id: number) {
  await db.delete(schema.products).where(eq(schema.products.id, id));
}

export async function findProductByUrl(url: string) {
  const rows = await db.select().from(schema.products).where(eq(schema.products.url, url)).limit(1);
  return rows[0] ?? null;
}

export async function listProductsByGroup(groupId: number) {
  return db
    .select()
    .from(schema.products)
    .where(eq(schema.products.groupId, groupId))
    .orderBy(asc(schema.products.lastTotalCost));
}

export async function countProductsInGroup(groupId: number): Promise<number> {
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.products)
    .where(eq(schema.products.groupId, groupId));
  return rows[0]?.c ?? 0;
}

// --- groups -----------------------------------------------------------------

export async function insertProductGroup(g: typeof schema.productGroups.$inferInsert) {
  const rows = await db.insert(schema.productGroups).values(g).returning();
  return rows[0];
}

export async function getProductGroup(id: number) {
  const rows = await db
    .select()
    .from(schema.productGroups)
    .where(eq(schema.productGroups.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateProductGroup(
  id: number,
  patch: Partial<typeof schema.productGroups.$inferInsert>,
) {
  await db
    .update(schema.productGroups)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.productGroups.id, id));
}

export async function deleteProductGroup(id: number) {
  await db.delete(schema.productGroups).where(eq(schema.productGroups.id, id));
}

export type GroupWithCheapest = {
  group: ProductGroup;
  cheapest: Product;
};

/**
 * Returns every group together with the one listing that currently has the
 * lowest total cost. Groups without listings are excluded. Sorted by most
 * recently updated group.
 */
export async function listGroupsWithCheapest(): Promise<GroupWithCheapest[]> {
  const rows = await db
    .selectDistinctOn([schema.productGroups.id], {
      group: schema.productGroups,
      cheapest: schema.products,
    })
    .from(schema.productGroups)
    .innerJoin(
      schema.products,
      eq(schema.products.groupId, schema.productGroups.id),
    )
    .orderBy(
      asc(schema.productGroups.id),
      asc(schema.products.lastTotalCost),
      asc(schema.products.id),
    );
  return rows.sort(
    (a, b) => b.group.updatedAt.getTime() - a.group.updatedAt.getTime(),
  );
}
