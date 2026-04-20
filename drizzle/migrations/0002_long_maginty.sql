ALTER TABLE "products" ADD COLUMN "last_regular_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "last_sale_ends_at" timestamp with time zone;