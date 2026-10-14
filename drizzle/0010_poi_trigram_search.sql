CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "locations_address_trgm_idx" ON "locations" USING gin ("address" gin_trgm_ops) WHERE "locations"."address" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "places_catalog_name_trgm_idx" ON "places" USING gin ("name" gin_trgm_ops) WHERE management_kind = 'catalog' AND visibility = 'public';
