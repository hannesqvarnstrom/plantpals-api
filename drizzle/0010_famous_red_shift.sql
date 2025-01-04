DO $$ BEGIN
 CREATE TYPE "public"."status_type_value" AS ENUM('pending', 'accepted', 'completed', 'declined', 'cancelled', 'in_transit');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "trade_status_types" ALTER COLUMN "value" SET DATA TYPE status_type_value USING value::status_type_value ;--> statement-breakpoint
ALTER TABLE "trade_status_changes" ADD COLUMN "trade_id" integer NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trade_status_changes" ADD CONSTRAINT "trade_status_changes_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
