CREATE TABLE IF NOT EXISTS "trade_status_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"value" varchar NOT NULL
);
INSERT INTO "trade_status_types" ("name", "value") VALUES ('Pending', 'pending'), ('Accepted', 'accepted'), ('In transit', 'in_transit'), ('Completed', 'completed');
--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "requesting_user_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "receiving_user_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "plant_offered_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "plant_desired_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "status_id" integer;--> statement-breakpoint
UPDATE "trades" SET "status_id" = 1;
ALTER TABLE "trades" ALTER COLUMN "status_id" SET NOT NULL;
DO $$ BEGIN
 ALTER TABLE "trades" ADD CONSTRAINT "trades_requesting_user_id_users_id_fk" FOREIGN KEY ("requesting_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trades" ADD CONSTRAINT "trades_receiving_user_id_users_id_fk" FOREIGN KEY ("receiving_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trades" ADD CONSTRAINT "trades_plant_offered_id_plants_id_fk" FOREIGN KEY ("plant_offered_id") REFERENCES "public"."plants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trades" ADD CONSTRAINT "trades_plant_desired_id_plants_id_fk" FOREIGN KEY ("plant_desired_id") REFERENCES "public"."plants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trades" ADD CONSTRAINT "trades_status_id_trade_status_types_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."trade_status_types"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
