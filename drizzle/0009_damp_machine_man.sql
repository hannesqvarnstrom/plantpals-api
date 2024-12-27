CREATE TABLE IF NOT EXISTS "trade_status_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"trade_status_type_id" integer NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trade_status_changes" ADD CONSTRAINT "trade_status_changes_trade_status_type_id_trade_status_types_id_fk" FOREIGN KEY ("trade_status_type_id") REFERENCES "public"."trade_status_types"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
INSERT INTO "trade_status_types" ("name", "value") VALUES ('Declined', 'declined'), ('Cancelled', 'cancelled');
