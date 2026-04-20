import { eq, desc, asc, inArray, sql } from "drizzle-orm";
import { db, schema } from "./client";
import type {
  Device,
  Product,
  ProductGroup,
  PriceHistoryRow,
} from "./schema";

// --- listings (legacy name: products) ---------------------------------------

export async function listProducts() {
  // Caller (cron) shuffles; no point ordering here.
  return db.select().from(schema.products);
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
  shops: string[]; // cheapest first, then other shops
};

/**
 * Returns every group together with the one listing that currently has the
 * lowest total cost, plus the shop names of every listing in the group
 * (cheapest shop listed first). Groups without listings are excluded.
 * Sorted by most recently updated group.
 */
export async function listGroupsWithCheapest(): Promise<GroupWithCheapest[]> {
  const cheapestRows = await db
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

  if (cheapestRows.length === 0) return [];

  const groupIds = cheapestRows.map((r) => r.group.id);
  const members = await db
    .select({
      groupId: schema.products.groupId,
      shop: schema.products.shop,
    })
    .from(schema.products)
    .where(inArray(schema.products.groupId, groupIds));

  const shopsByGroup = new Map<number, string[]>();
  for (const m of members) {
    if (m.groupId == null) continue;
    const arr = shopsByGroup.get(m.groupId) ?? [];
    arr.push(m.shop);
    shopsByGroup.set(m.groupId, arr);
  }

  const merged = cheapestRows.map(({ group, cheapest }) => {
    const all = shopsByGroup.get(group.id) ?? [cheapest.shop];
    const shops = [cheapest.shop, ...all.filter((s) => s !== cheapest.shop)];
    return { group, cheapest, shops };
  });

  return merged.sort(
    (a, b) => b.group.updatedAt.getTime() - a.group.updatedAt.getTime(),
  );
}

/**
 * Returns every listing's price history within the given window (days),
 * keyed by listingId. Chronological ascending within each listing.
 */
export async function getGroupHistories(
  groupId: number,
  days: number,
): Promise<Map<number, PriceHistoryRow[]>> {
  const listings = await listProductsByGroup(groupId);
  if (listings.length === 0) return new Map();
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db
    .select()
    .from(schema.priceHistory)
    .where(
      sql`${schema.priceHistory.productId} IN (${sql.join(
        listings.map((l) => sql`${l.id}`),
        sql`, `,
      )}) AND ${schema.priceHistory.checkedAt} >= ${since}`,
    )
    .orderBy(asc(schema.priceHistory.checkedAt));
  const out = new Map<number, PriceHistoryRow[]>();
  for (const h of rows) {
    const arr = out.get(h.productId) ?? [];
    arr.push(h);
    out.set(h.productId, arr);
  }
  return out;
}

/**
 * Returns history for one listing within the given window (days).
 * Chronological ascending.
 */
export async function getListingHistory(
  listingId: number,
  days: number,
): Promise<PriceHistoryRow[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  return db
    .select()
    .from(schema.priceHistory)
    .where(
      sql`${schema.priceHistory.productId} = ${listingId} AND ${schema.priceHistory.checkedAt} >= ${since}`,
    )
    .orderBy(asc(schema.priceHistory.checkedAt));
}

// --- devices (APNs push targets) -------------------------------------------

export async function upsertDevice(
  row: typeof schema.devices.$inferInsert,
): Promise<Device> {
  const rows = await db
    .insert(schema.devices)
    .values(row)
    .onConflictDoUpdate({
      target: schema.devices.apnsToken,
      set: {
        bundleId: row.bundleId,
        environment: row.environment,
        lastSeenAt: new Date(),
      },
    })
    .returning();
  return rows[0];
}

export async function deleteDeviceByToken(apnsToken: string): Promise<void> {
  await db
    .delete(schema.devices)
    .where(eq(schema.devices.apnsToken, apnsToken));
}

export async function listDevices(): Promise<Device[]> {
  return db.select().from(schema.devices);
}
