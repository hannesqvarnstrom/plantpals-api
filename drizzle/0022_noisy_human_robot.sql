CREATE TYPE "public"."preferred_trade_methods" as ENUM('post', 'in_person');
CREATE TABLE IF NOT EXISTS "user_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"bio" varchar(2000),
	"country" varchar(256),
	"city" varchar(256),
	"trades_by_post" boolean DEFAULT true,
	"trades_in_person" boolean DEFAULT false,
	"preferred_trade_method" "preferred_trade_methods",
	"user_id" integer NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_id_index" ON "user_profiles" USING btree ("id");