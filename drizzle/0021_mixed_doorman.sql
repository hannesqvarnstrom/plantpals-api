CREATE TABLE IF NOT EXISTS "species_scientific_names" (
	"id" serial PRIMARY KEY NOT NULL,
	"species_id" integer NOT NULL,
	"name" text NOT NULL,
	"scientific_portions" text[] NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "species_scientific_names" ADD CONSTRAINT "species_scientific_names_species_id_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "species_scientific_name_species_id_index" ON "species_scientific_names" USING btree ("species_id");