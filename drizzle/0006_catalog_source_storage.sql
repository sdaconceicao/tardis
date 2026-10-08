ALTER TABLE "place_sources" ALTER COLUMN "content_hash" SET DATA TYPE bytea USING decode(content_hash, 'hex');--> statement-breakpoint
ALTER TABLE "place_sources" ADD COLUMN "applied_run_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "place_sources" ADD CONSTRAINT "place_sources_applied_run_id_place_import_runs_id_fk" FOREIGN KEY ("applied_run_id") REFERENCES "public"."place_import_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_sources" DROP COLUMN "source_release";--> statement-breakpoint
ALTER TABLE "place_sources" DROP COLUMN "selection_fingerprint";
