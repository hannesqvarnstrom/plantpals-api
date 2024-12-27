ALTER TYPE "rank" ADD VALUE 'CROSS';--> statement-breakpoint
ALTER TABLE "species" RENAME COLUMN "hybrid_mom_id" TO "cross_mom_id";--> statement-breakpoint
ALTER TABLE "species" RENAME COLUMN "hybrid_dad_id" TO "cross_dad_id";--> statement-breakpoint
DROP INDEX IF EXISTS "hybrid_mom_index";--> statement-breakpoint
DROP INDEX IF EXISTS "hybrid_dad_index";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cross_mom_index" ON "species" USING btree ("cross_mom_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cross_dad_index" ON "species" USING btree ("cross_dad_id");