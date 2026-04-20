CREATE TABLE "product_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"image_url" text,
	"target_price" numeric(10, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "group_id" integer;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_group_id_product_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."product_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Back-fill: create one group per existing product, preserving title/image/target/timestamps.
-- A temporary marker column holds the originating product id so we can link them back
-- without relying on timestamp uniqueness.
ALTER TABLE "product_groups" ADD COLUMN "_migration_product_id" integer;--> statement-breakpoint
INSERT INTO "product_groups" ("title", "image_url", "target_price", "created_at", "updated_at", "_migration_product_id")
  SELECT "name", "image_url", "target_price", "created_at", "updated_at", "id"
  FROM "products";--> statement-breakpoint
UPDATE "products"
  SET "group_id" = "product_groups"."id"
  FROM "product_groups"
  WHERE "product_groups"."_migration_product_id" = "products"."id";--> statement-breakpoint
ALTER TABLE "product_groups" DROP COLUMN "_migration_product_id";