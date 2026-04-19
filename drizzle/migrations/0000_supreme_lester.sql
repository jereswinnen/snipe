CREATE TABLE "price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"total_cost" numeric(10, 2) NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"shop" text NOT NULL,
	"name" text NOT NULL,
	"image_url" text,
	"is_pre_order" boolean DEFAULT false NOT NULL,
	"sold_by_bol" boolean,
	"last_price" numeric(10, 2) NOT NULL,
	"last_total_cost" numeric(10, 2) NOT NULL,
	"target_price" numeric(10, 2),
	"last_checked_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_url_unique" UNIQUE("url")
);
--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "price_history_product_idx" ON "price_history" USING btree ("product_id","checked_at");