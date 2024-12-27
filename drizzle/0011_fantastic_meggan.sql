ALTER TYPE "rank" ADD VALUE 'HYBRID';--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "species_name" varchar;--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "cultivar_name" varchar;--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "hybrid_mom_id" integer;--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "hybrid_dad_id" integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hybrid_mom_index" ON "species" USING btree ("hybrid_mom_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hybrid_dad_index" ON "species" USING btree ("hybrid_dad_id");