CREATE INDEX IF NOT EXISTS "genera_name_index" ON "genera" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "species_name_index" ON "species" USING btree ("name");