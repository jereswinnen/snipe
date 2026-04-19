import { eq, desc } from "drizzle-orm";
import { db, schema } from "./client";

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
