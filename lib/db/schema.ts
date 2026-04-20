import {
  pgTable, serial, text, boolean, numeric, timestamp, integer, index,
} from "drizzle-orm/pg-core";

export const shops = ["bol", "coolblue", "allyourgames", "nedgame", "nintendo"] as const;
export type Shop = (typeof shops)[number];

export const mediums = ["digital", "physical"] as const;
export type Medium = (typeof mediums)[number];

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  url: text("url").notNull().unique(),
  shop: text("shop").$type<Shop>().notNull(),
  medium: text("medium").$type<Medium>().notNull().default("physical"),
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  isPreOrder: boolean("is_pre_order").notNull().default(false),
  soldByBol: boolean("sold_by_bol"),
  lastPrice: numeric("last_price", { precision: 10, scale: 2 }).notNull(),
  lastTotalCost: numeric("last_total_cost", { precision: 10, scale: 2 }).notNull(),
  lastRegularPrice: numeric("last_regular_price", { precision: 10, scale: 2 }),
  lastSaleEndsAt: timestamp("last_sale_ends_at", { withTimezone: true }),
  targetPrice: numeric("target_price", { precision: 10, scale: 2 }),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const priceHistory = pgTable(
  "price_history",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    totalCost: numeric("total_cost", { precision: 10, scale: 2 }).notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("price_history_product_idx").on(t.productId, t.checkedAt)],
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type PriceHistoryRow = typeof priceHistory.$inferSelect;
