import { eq, desc, asc, sql } from "drizzle-orm";
import { db, schema } from "./client";

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

/**
 * Returns every group with the one listing that currently has the lowest
 * total cost. Groups without listings are excluded.
 */
export async function listGroupsWithCheapest() {
  const rows = await db.execute(sql`
    SELECT DISTINCT ON (g.id)
      g.id               AS group_id,
      g.title            AS group_title,
      g.image_url        AS group_image_url,
      g.target_price     AS group_target_price,
      g.updated_at       AS group_updated_at,
      p.*
    FROM product_groups g
    JOIN products p ON p.group_id = g.id
    ORDER BY g.id, p.last_total_cost ASC, p.id ASC
  `);
  type Row = {
    group_id: number;
    group_title: string;
    group_image_url: string | null;
    group_target_price: string | null;
    group_updated_at: Date;
  } & Record<string, unknown>;
  const list = rows.rows as Row[];
  list.sort((a, b) => {
    const au = new Date(a.group_updated_at as Date).getTime();
    const bu = new Date(b.group_updated_at as Date).getTime();
    return bu - au;
  });
  return list;
}
