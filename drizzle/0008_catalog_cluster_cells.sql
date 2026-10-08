CREATE TABLE "place_cluster_cells" (
	"run_id" uuid NOT NULL,
	"category" text NOT NULL,
	"cell_x" integer NOT NULL,
	"cell_y" integer NOT NULL,
	"place_count" integer NOT NULL,
	"latitude_sum" double precision NOT NULL,
	"longitude_sum" double precision NOT NULL,
	"west" double precision NOT NULL,
	"east" double precision NOT NULL,
	"south" double precision NOT NULL,
	"north" double precision NOT NULL,
	CONSTRAINT "place_cluster_cells_key_unique" UNIQUE("run_id","category","cell_x","cell_y")
);
--> statement-breakpoint
ALTER TABLE "place_cluster_cells" ADD CONSTRAINT "place_cluster_cells_run_id_place_import_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."place_import_runs"("id") ON DELETE no action ON UPDATE no action;