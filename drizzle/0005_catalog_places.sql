CREATE TYPE "public"."place_import_state" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."place_management_kind" AS ENUM('user', 'catalog');--> statement-breakpoint
CREATE TYPE "public"."place_source_state" AS ENUM('active', 'out_of_scope', 'removed');--> statement-breakpoint
CREATE TABLE "place_import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"run_id" uuid NOT NULL,
	"partition" text NOT NULL,
	"batch_number" integer NOT NULL,
	"state" "place_import_state" DEFAULT 'running' NOT NULL,
	"counts" jsonb,
	CONSTRAINT "place_import_batches_key_unique" UNIQUE("run_id","partition","batch_number")
);
--> statement-breakpoint
CREATE TABLE "place_import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"release" text NOT NULL,
	"profile" text NOT NULL,
	"selection_fingerprint" text NOT NULL,
	"resolved_config" jsonb NOT NULL,
	"manifest_url" text NOT NULL,
	"state" "place_import_state" DEFAULT 'running' NOT NULL,
	"completed_at" timestamp with time zone,
	"report" jsonb,
	CONSTRAINT "place_import_runs_selection_unique" UNIQUE("release","selection_fingerprint")
);
--> statement-breakpoint
CREATE TABLE "place_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"place_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"source_release" text NOT NULL,
	"selection_fingerprint" text NOT NULL,
	"content_hash" text NOT NULL,
	"state" "place_source_state" DEFAULT 'active' NOT NULL,
	"category" text,
	"taxonomy_primary" text,
	"operating_status" text,
	"confidence" double precision,
	"attribution" text NOT NULL,
	CONSTRAINT "place_sources_identity_unique" UNIQUE("provider","external_id")
);
--> statement-breakpoint
ALTER TABLE "places" ALTER COLUMN "owner_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "management_kind" "place_management_kind" DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "place_import_batches" ADD CONSTRAINT "place_import_batches_run_id_place_import_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."place_import_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_sources" ADD CONSTRAINT "place_sources_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "place_sources_place_idx" ON "place_sources" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "place_sources_state_category_idx" ON "place_sources" USING btree ("state","category");--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_management_check" CHECK (("places"."management_kind" = 'user' AND "places"."owner_id" IS NOT NULL) OR ("places"."management_kind" = 'catalog' AND "places"."owner_id" IS NULL AND "places"."visibility" = 'public'));