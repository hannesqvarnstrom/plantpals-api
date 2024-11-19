ALTER TABLE "available_plants" RENAME TO "trade_available_plants";--> statement-breakpoint
ALTER TABLE "trade_available_plants" DROP CONSTRAINT "available_plants_plant_id_plants_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trade_available_plants" ADD CONSTRAINT "trade_available_plants_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
