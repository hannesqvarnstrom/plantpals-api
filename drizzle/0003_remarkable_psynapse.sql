ALTER TYPE "type" ADD VALUE 'plant';--> statement-breakpoint
ALTER TYPE "rank" ADD VALUE 'CULTIVAR';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "available_plants" (
	"id" serial PRIMARY KEY NOT NULL,
	"plant_id" integer,
	"available_from" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "family_interests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"family_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "genus_interests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"genus_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plants" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"species_id" integer NOT NULL,
	"type" "type" NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "species_interests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"species_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trades" (
	"id" serial PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_species_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"species_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "families" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "genera" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "species" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "user_submitted" boolean DEFAULT false;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "available_plants" ADD CONSTRAINT "available_plants_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "family_interests" ADD CONSTRAINT "family_interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "family_interests" ADD CONSTRAINT "family_interests_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "genus_interests" ADD CONSTRAINT "genus_interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "genus_interests" ADD CONSTRAINT "genus_interests_genus_id_genera_id_fk" FOREIGN KEY ("genus_id") REFERENCES "public"."genera"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plants" ADD CONSTRAINT "plants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plants" ADD CONSTRAINT "plants_species_id_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "species_interests" ADD CONSTRAINT "species_interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "species_interests" ADD CONSTRAINT "species_interests_species_id_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_species_submissions" ADD CONSTRAINT "user_species_submissions_species_id_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_species_submissions" ADD CONSTRAINT "user_species_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
