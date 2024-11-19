DO $$ BEGIN
 CREATE TYPE "public"."type" AS ENUM('cutting', 'seed', 'rhizome', 'none');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."provider" AS ENUM('GOOGLE', 'FACEBOOK');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."rank" AS ENUM('VARIETY', 'SUBSPECIES', 'SPECIES');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "families" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" jsonb NOT NULL,
	"gbif_key" varchar NOT NULL,
	"vernacular_names" jsonb,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "federated_identities" (
	"provider" "provider" NOT NULL,
	"providerId" varchar,
	"createdAt" timestamp DEFAULT now(),
	"user_id" integer PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "genera" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" jsonb NOT NULL,
	"family_id" integer NOT NULL,
	"gbif_key" varchar NOT NULL,
	"gbif_family_key" varchar NOT NULL,
	"vernacular_names" jsonb,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "species" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" jsonb NOT NULL,
	"family_id" integer NOT NULL,
	"genus_id" integer NOT NULL,
	"gbif_key" varchar NOT NULL,
	"gbif_family_key" varchar NOT NULL,
	"gbif_genus_key" varchar NOT NULL,
	"vernacular_names" jsonb,
	"rank" "rank" NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"parent_species_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password" varchar,
	"last_log_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "federated_identities" ADD CONSTRAINT "federated_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "genera" ADD CONSTRAINT "genera_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "species" ADD CONSTRAINT "species_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "species" ADD CONSTRAINT "species_genus_id_genera_id_fk" FOREIGN KEY ("genus_id") REFERENCES "public"."genera"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "species_family_index" ON "species" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "species_genus_index" ON "species" USING btree ("genus_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "species_parent_species_index" ON "species" USING btree ("parent_species_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_email_index" ON "users" USING btree ("email");