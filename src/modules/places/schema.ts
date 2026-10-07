import { sql } from "drizzle-orm";
import {
	check,
	customType,
	date,
	doublePrecision,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { entityColumns, hoursState, visibility } from "../../db/schema/common";
import { priceChecks, priceColumns } from "../../shared/price-schema";
import { user } from "../identity/schema";

const geography = customType<{ data: string }>({
	dataType: () => "geography(Point,4326)",
});
const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
export const placeManagementKind = pgEnum("place_management_kind", [
	"user",
	"catalog",
]);
export const placeSourceState = pgEnum("place_source_state", [
	"active",
	"out_of_scope",
	"removed",
]);
export const placeImportState = pgEnum("place_import_state", [
	"running",
	"completed",
	"failed",
]);
export const locations = pgTable(
	"locations",
	{
		...entityColumns(),
		label: text("label").notNull(),
		address: text("address"),
		latitude: doublePrecision("latitude").notNull(),
		longitude: doublePrecision("longitude").notNull(),
		point: geography("point").generatedAlwaysAs(
			sql`ST_SetSRID(ST_MakePoint(longitude, latitude),4326)::geography`,
		),
	},
	(t) => [
		check(
			"locations_coordinates_check",
			sql`${t.latitude} BETWEEN -90 AND 90 AND ${t.longitude} BETWEEN -180 AND 180`,
		),
		index("locations_point_idx").using("gist", t.point),
	],
);
export const places = pgTable(
	"places",
	{
		...entityColumns(),
		ownerId: text("owner_id").references(() => user.id),
		managementKind: placeManagementKind("management_kind")
			.notNull()
			.default("user"),
		name: text("name").notNull(),
		description: text("description"),
		visibility: visibility("visibility").notNull().default("private"),
		locationId: uuid("location_id")
			.notNull()
			.references(() => locations.id),
		timezone: text("timezone").notNull(),
	},
	(t) => [
		check(
			"places_management_check",
			sql`(${t.managementKind} = 'user' AND ${t.ownerId} IS NOT NULL) OR (${t.managementKind} = 'catalog' AND ${t.ownerId} IS NULL AND ${t.visibility} = 'public')`,
		),
		index("places_owner_idx").on(t.ownerId),
		index("places_location_idx").on(t.locationId),
		index("places_visibility_idx").on(t.visibility),
	],
);
export const placeImportRuns = pgTable(
	"place_import_runs",
	{
		...entityColumns(),
		release: text("release").notNull(),
		profile: text("profile").notNull(),
		selectionFingerprint: text("selection_fingerprint").notNull(),
		resolvedConfig: jsonb("resolved_config").notNull(),
		manifestUrl: text("manifest_url").notNull(),
		state: placeImportState("state").notNull().default("running"),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		report: jsonb("report"),
	},
	(t) => [
		unique("place_import_runs_selection_unique").on(
			t.release,
			t.selectionFingerprint,
		),
	],
);
export const placeSources = pgTable(
	"place_sources",
	{
		...entityColumns(),
		placeId: uuid("place_id")
			.notNull()
			.references(() => places.id),
		appliedRunId: uuid("applied_run_id")
			.notNull()
			.references(() => placeImportRuns.id),
		provider: text("provider").notNull(),
		externalId: text("external_id").notNull(),
		contentHash: bytea("content_hash").notNull(),
		state: placeSourceState("state").notNull().default("active"),
		category: text("category"),
		taxonomyPrimary: text("taxonomy_primary"),
		operatingStatus: text("operating_status"),
		confidence: doublePrecision("confidence"),
		attribution: text("attribution").notNull(),
	},
	(t) => [
		unique("place_sources_identity_unique").on(t.provider, t.externalId),
		index("place_sources_place_idx").on(t.placeId),
		index("place_sources_state_category_idx").on(t.state, t.category),
	],
);
export const placeClusterCells = pgTable(
	"place_cluster_cells",
	{
		runId: uuid("run_id")
			.notNull()
			.references(() => placeImportRuns.id),
		category: text("category").notNull(),
		cellX: integer("cell_x").notNull(),
		cellY: integer("cell_y").notNull(),
		placeCount: integer("place_count").notNull(),
		latitudeSum: doublePrecision("latitude_sum").notNull(),
		longitudeSum: doublePrecision("longitude_sum").notNull(),
		west: doublePrecision("west").notNull(),
		east: doublePrecision("east").notNull(),
		south: doublePrecision("south").notNull(),
		north: doublePrecision("north").notNull(),
	},
	(t) => [
		unique("place_cluster_cells_key_unique").on(
			t.runId,
			t.category,
			t.cellX,
			t.cellY,
		),
	],
);
export const placeImportBatches = pgTable(
	"place_import_batches",
	{
		...entityColumns(),
		runId: uuid("run_id")
			.notNull()
			.references(() => placeImportRuns.id),
		partition: text("partition").notNull(),
		batchNumber: integer("batch_number").notNull(),
		state: placeImportState("state").notNull().default("running"),
		counts: jsonb("counts"),
	},
	(t) => [
		unique("place_import_batches_key_unique").on(
			t.runId,
			t.partition,
			t.batchNumber,
		),
	],
);
export const placeHoursSchedules = pgTable(
	"place_hours_schedules",
	{
		...entityColumns(),
		placeId: uuid("place_id")
			.notNull()
			.references(() => places.id, { onDelete: "cascade" }),
		label: text("label"),
		validFrom: date("valid_from").notNull(),
		validTo: date("valid_to"),
	},
	(t) => [
		index("place_hours_place_idx").on(t.placeId),
		check(
			"place_hours_dates_check",
			sql`${t.validTo} IS NULL OR ${t.validTo} > ${t.validFrom}`,
		),
	],
);
export const placeHoursWeekdays = pgTable(
	"place_hours_weekdays",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		scheduleId: uuid("schedule_id")
			.notNull()
			.references(() => placeHoursSchedules.id, { onDelete: "cascade" }),
		weekday: integer("weekday").notNull(),
		state: hoursState("state").notNull(),
	},
	(t) => [
		unique("place_hours_weekday_unique").on(t.scheduleId, t.weekday),
		check("place_hours_weekday_check", sql`${t.weekday} BETWEEN 1 AND 7`),
	],
);
export const placeHoursIntervals = pgTable(
	"place_hours_intervals",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		weekdayId: uuid("weekday_id")
			.notNull()
			.references(() => placeHoursWeekdays.id, { onDelete: "cascade" }),
		startMinute: integer("start_minute").notNull(),
		endMinute: integer("end_minute").notNull(),
	},
	(t) => [
		index("place_hours_intervals_day_idx").on(t.weekdayId),
		check(
			"place_hours_interval_check",
			sql`${t.startMinute} BETWEEN 0 AND 1439 AND ${t.endMinute} > ${t.startMinute} AND ${t.endMinute} <= 2880`,
		),
	],
);
export const placeHoursExceptions = pgTable(
	"place_hours_exceptions",
	{
		...entityColumns(),
		placeId: uuid("place_id")
			.notNull()
			.references(() => places.id, { onDelete: "cascade" }),
		date: date("date").notNull(),
		state: hoursState("state").notNull(),
		note: text("note"),
	},
	(t) => [unique("place_hours_exception_unique").on(t.placeId, t.date)],
);
export const placeHoursExceptionIntervals = pgTable(
	"place_hours_exception_intervals",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		exceptionId: uuid("exception_id")
			.notNull()
			.references(() => placeHoursExceptions.id, { onDelete: "cascade" }),
		startMinute: integer("start_minute").notNull(),
		endMinute: integer("end_minute").notNull(),
	},
	(t) => [
		index("place_exception_intervals_day_idx").on(t.exceptionId),
		check(
			"place_exception_interval_check",
			sql`${t.startMinute} BETWEEN 0 AND 1439 AND ${t.endMinute} > ${t.startMinute} AND ${t.endMinute} <= 2880`,
		),
	],
);
export const placePrices = pgTable(
	"place_prices",
	{
		...entityColumns(),
		placeId: uuid("place_id")
			.notNull()
			.references(() => places.id, { onDelete: "cascade" }),
		...priceColumns(),
	},
	(t) => [
		index("place_prices_place_idx").on(t.placeId),
		...priceChecks("place_prices"),
	],
);
