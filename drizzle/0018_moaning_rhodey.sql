ALTER TABLE "trades" RENAME COLUMN "accepted_by_requesting_user" TO "completed_by_requesting_user";--> statement-breakpoint
ALTER TABLE "trades" RENAME COLUMN "accepted_by_receiving_user" TO "completed_by_receiving_user";