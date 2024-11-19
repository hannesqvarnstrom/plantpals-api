ALTER TABLE "trade_available_plants" RENAME TO "tradeable_plants";--> statement-breakpoint
ALTER TABLE "tradeable_plants" DROP CONSTRAINT "trade_available_plants_plant_id_plants_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tradeable_plants" ADD CONSTRAINT "tradeable_plants_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
