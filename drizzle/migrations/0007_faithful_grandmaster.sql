CREATE TABLE "devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"apns_token" text NOT NULL,
	"bundle_id" text NOT NULL,
	"environment" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_apns_token_unique" UNIQUE("apns_token")
);
