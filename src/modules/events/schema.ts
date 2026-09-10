import { sql } from "drizzle-orm";
import {
	check,
	date,
	foreignKey,
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { entityColumns, timeKind, visibility } from "../../db/schema/common";
import { priceChecks, priceColumns } from "../../shared/price-schema";
import { user } from "../identity/schema";
import { locations, places } from "../places/schema";

export const recurrenceMode = pgEnum("recurrence_mode", [
	"scheduled",
	"expected",
]);
export const occurrenceStatus = pgEnum("occurrence_status", [
	"scheduled",
	"tentative",
	"cancelled",
]);
export const datePrecision = pgEnum("date_precision", ["exact", "month"]);
export const events = pgTable(
	"events",
	{
		...entityColumns(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id),
		title: text("title").notNull(),
		description: text("description"),
		visibility: visibility("visibility").notNull().default("private"),
		locationId: uuid("location_id")
			.notNull()
			.references(() => locations.id),
		placeId: uuid("place_id").references(() => places.id),
		timezone: text("timezone").notNull(),
	},
	(t) => [
		index("events_owner_idx").on(t.ownerId),
		index("events_place_idx").on(t.placeId),
		index("events_location_idx").on(t.locationId),
		index("events_visibility_idx").on(t.visibility),
	],
);
export const eventRecurrences = pgTable(
	"event_recurrences",
	{
		...entityColumns(),
		eventId: uuid("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		mode: recurrenceMode("mode").notNull(),
		anchorDate: date("anchor_date").notNull(),
		untilDate: date("until_date"),
		rrule: text("rrule"),
		intervalMonths: integer("interval_months"),
	},
	(t) => [
		unique("event_recurrence_event_unique").on(t.id, t.eventId),
		index("event_recurrence_event_idx").on(t.eventId),
		check(
			"event_recurrence_mode_check",
			sql`(${t.mode} = 'scheduled' AND ${t.rrule} IS NOT NULL AND ${t.intervalMonths} IS NULL) OR (${t.mode} = 'expected' AND ${t.rrule} IS NULL AND ${t.intervalMonths} IS NOT NULL AND ${t.intervalMonths} > 0)`,
		),
		check(
			"event_recurrence_end_check",
			sql`${t.untilDate} IS NULL OR ${t.untilDate} >= ${t.anchorDate}`,
		),
	],
);
export const eventRecurrenceDays = pgTable(
	"event_recurrence_days",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		recurrenceId: uuid("recurrence_id")
			.notNull()
			.references(() => eventRecurrences.id, { onDelete: "cascade" }),
		dayOffset: integer("day_offset").notNull(),
		description: text("description"),
		timeKind: timeKind("time_kind").notNull(),
		startMinute: integer("start_minute"),
		endMinute: integer("end_minute"),
	},
	(t) => [
		unique("event_template_day_unique").on(t.recurrenceId, t.dayOffset),
		check("event_template_offset_check", sql`${t.dayOffset} BETWEEN 0 AND 365`),
		check(
			"event_template_time_check",
			sql`(${t.timeKind} = 'timed' AND ${t.startMinute} IS NOT NULL AND ${t.endMinute} IS NOT NULL AND ${t.startMinute} BETWEEN 0 AND 1439 AND ${t.endMinute} > ${t.startMinute} AND ${t.endMinute} <= 2880) OR (${t.timeKind} <> 'timed' AND ${t.startMinute} IS NULL AND ${t.endMinute} IS NULL)`,
		),
	],
);
export const eventOccurrences = pgTable(
	"event_occurrences",
	{
		...entityColumns(),
		eventId: uuid("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		recurrenceId: uuid("recurrence_id"),
		originalAnchor: date("original_anchor"),
		status: occurrenceStatus("status").notNull().default("scheduled"),
		datePrecision: datePrecision("date_precision").notNull(),
		startsOn: date("starts_on"),
		endsOn: date("ends_on"),
		expectedMonth: date("expected_month"),
		locationId: uuid("location_id")
			.notNull()
			.references(() => locations.id),
		placeId: uuid("place_id").references(() => places.id),
		timezone: text("timezone").notNull(),
		title: text("title"),
		description: text("description"),
	},
	(t) => [
		unique("event_occurrence_event_unique").on(t.id, t.eventId),
		unique("event_occurrence_anchor_unique").on(
			t.recurrenceId,
			t.originalAnchor,
		),
		foreignKey({
			name: "event_occurrence_recurrence_fk",
			columns: [t.recurrenceId, t.eventId],
			foreignColumns: [eventRecurrences.id, eventRecurrences.eventId],
		}),
		index("event_occurrence_event_idx").on(t.eventId),
		index("event_occurrence_place_idx").on(t.placeId),
		index("event_occurrence_location_idx").on(t.locationId),
		index("event_occurrence_dates_idx")
			.using("gist", sql`daterange(${t.startsOn}, ${t.endsOn}, '[)')`)
			.where(sql`${t.datePrecision} = 'exact'`),
		check(
			"event_occurrence_anchor_check",
			sql`(${t.recurrenceId} IS NULL) = (${t.originalAnchor} IS NULL)`,
		),
		check(
			"event_occurrence_dates_check",
			sql`(${t.datePrecision} = 'exact' AND ${t.startsOn} IS NOT NULL AND ${t.endsOn} IS NOT NULL AND ${t.endsOn} > ${t.startsOn} AND ${t.expectedMonth} IS NULL) OR (${t.datePrecision} = 'month' AND ${t.startsOn} IS NULL AND ${t.endsOn} IS NULL AND ${t.expectedMonth} IS NOT NULL AND extract(day FROM ${t.expectedMonth}) = 1 AND ${t.status} <> 'scheduled')`,
		),
	],
);
export const eventDays = pgTable(
	"event_days",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		occurrenceId: uuid("occurrence_id")
			.notNull()
			.references(() => eventOccurrences.id, { onDelete: "cascade" }),
		date: date("date").notNull(),
		description: text("description"),
		timeKind: timeKind("time_kind").notNull(),
		startsAt: timestamp("starts_at", { withTimezone: true }).$type<Date>(),
		endsAt: timestamp("ends_at", { withTimezone: true }).$type<Date>(),
	},
	(t) => [
		unique("event_day_date_unique").on(t.occurrenceId, t.date),
		check(
			"event_day_time_check",
			sql`(${t.timeKind} = 'unknown' AND ${t.startsAt} IS NULL AND ${t.endsAt} IS NULL) OR (${t.timeKind} <> 'unknown' AND ${t.startsAt} IS NOT NULL AND ${t.endsAt} IS NOT NULL AND ${t.endsAt} > ${t.startsAt})`,
		),
		index("event_day_availability_idx")
			.using("gist", sql`tstzrange(${t.startsAt},${t.endsAt},'[)')`)
			.where(sql`${t.timeKind} <> 'unknown'`),
	],
);
export const eventPrices = pgTable(
	"event_prices",
	{
		...entityColumns(),
		eventId: uuid("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		occurrenceId: uuid("occurrence_id"),
		...priceColumns(),
	},
	(t) => [
		foreignKey({
			name: "event_price_occurrence_fk",
			columns: [t.occurrenceId, t.eventId],
			foreignColumns: [eventOccurrences.id, eventOccurrences.eventId],
		}).onDelete("cascade"),
		index("event_prices_event_idx").on(t.eventId),
		index("event_prices_occurrence_idx").on(t.occurrenceId),
		...priceChecks("event_prices"),
	],
);
