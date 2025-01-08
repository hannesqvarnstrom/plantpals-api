ALTER TABLE "trade_suggestion_plants" DROP CONSTRAINT "trade_suggestion_plants_plant_id_plants_id_fk";
--> statement-breakpoint
ALTER TABLE "tradeable_plants" DROP CONSTRAINT "tradeable_plants_plant_id_plants_id_fk";
--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trade_suggestion_plants" ADD CONSTRAINT "trade_suggestion_plants_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tradeable_plants" ADD CONSTRAINT "tradeable_plants_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
