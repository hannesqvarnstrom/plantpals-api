ALTER TABLE "trades" ADD COLUMN "accepted_by_requesting_user" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "accepted_by_receiving_user" boolean DEFAULT false;