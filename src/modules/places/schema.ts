import { sql } from "drizzle-orm";
import {
	check,
	customType,
	date,
	doublePrecision,
	index,
	integer,
	pgTable,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { entityColumns, hoursState, visibility } from "../../db/schema/common";
import { priceChecks, priceColumns } from "../../shared/price-schema";
import { user } from "../identity/schema";

const geography = customType<{ data: string }>({
	dataType: () => "geography(Point,4326)",
});
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
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id),
		name: text("name").notNull(),
		description: text("description"),
		visibility: visibility("visibility").notNull().default("private"),
		locationId: uuid("location_id")
			.notNull()
			.references(() => locations.id),
		timezone: text("timezone").notNull(),
	},
	(t) => [
		index("places_owner_idx").on(t.ownerId),
		index("places_location_idx").on(t.locationId),
		index("places_visibility_idx").on(t.visibility),
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
