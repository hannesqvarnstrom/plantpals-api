CREATE TABLE IF NOT EXISTS "trade_suggestion_plants" (
	"id" serial PRIMARY KEY NOT NULL,
	"trade_suggestion_id" integer NOT NULL,
	"plant_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trade_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"trade_id" integer NOT NULL,
	"subject_user_id" integer NOT NULL,
	"object_user_id" integer NOT NULL,
	"accepted_at" timestamp,
	"denied_at" timestamp,
	"responded_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "trades" DROP CONSTRAINT "trades_plant_offered_id_plants_id_fk";
--> statement-breakpoint
ALTER TABLE "trades" DROP CONSTRAINT "trades_plant_desired_id_plants_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trade_suggestion_plants" ADD CONSTRAINT "trade_suggestion_plants_trade_suggestion_id_trade_suggestions_id_fk" FOREIGN KEY ("trade_suggestion_id") REFERENCES "public"."trade_suggestions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trade_suggestion_plants" ADD CONSTRAINT "trade_suggestion_plants_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trade_suggestions" ADD CONSTRAINT "trade_suggestions_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trade_suggestions" ADD CONSTRAINT "trade_suggestions_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trade_suggestions" ADD CONSTRAINT "trade_suggestions_object_user_id_users_id_fk" FOREIGN KEY ("object_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "trades" DROP COLUMN IF EXISTS "plant_offered_id";--> statement-breakpoint
ALTER TABLE "trades" DROP COLUMN IF EXISTS "plant_desired_id";