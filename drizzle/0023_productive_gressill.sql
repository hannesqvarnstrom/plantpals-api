CREATE TABLE IF NOT EXISTS "favourite_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"favourite_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DROP INDEX IF EXISTS "user_id_index";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "favourite_users" ADD CONSTRAINT "favourite_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "favourite_users" ADD CONSTRAINT "favourite_users_favourite_user_id_users_id_fk" FOREIGN KEY ("favourite_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "favourite_users_user_id_index" ON "favourite_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "favourite_users_favourite_user_id_index" ON "favourite_users" USING btree ("favourite_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_id_index" ON "user_profiles" USING btree ("user_id");