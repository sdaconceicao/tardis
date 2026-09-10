import { and, eq, inArray, sql } from "drizzle-orm";
import type { Connection } from "../../db/client.server";
import { readable } from "../../shared/access";
import { DomainError } from "../../shared/errors";
import { occurrencePricesAt } from "../../shared/prices";
import { addDays } from "../../shared/time";
import type { AvailabilityQuery } from "../../shared/validation";
import type { Actor } from "../identity/contracts";
import { recurringDaysAt } from "./recurrence";
import {
	eventDays,
	eventOccurrences,
	eventPrices,
	eventRecurrenceDays,
	eventRecurrences,
	events,
} from "./schema";

export async function findAvailableEvents(
	db: Connection,
	actor: Actor | null,
	q: AvailabilityQuery,
	locationIds: string[],
) {
	if (!locationIds.length) return [];
	const explicit = await db
		.select({ event: events, occurrence: eventOccurrences, day: eventDays })
		.from(eventDays)
		.innerJoin(
			eventOccurrences,
			eq(eventDays.occurrenceId, eventOccurrences.id),
		)
		.innerJoin(events, eq(eventOccurrences.eventId, events.id))
		.where(
			and(
				readable(events.ownerId, events.visibility, actor),
				inArray(eventOccurrences.locationId, locationIds),
				eq(eventOccurrences.status, "scheduled"),
				sql`${eventDays.timeKind} <> 'unknown'`,
				sql`tstzrange(${eventDays.startsAt},${eventDays.endsAt},'[)') @> ${q.at.toISOString()}::timestamptz`,
			),
		)
		.limit(2001);
	const series = await db
		.select({ event: events, recurrence: eventRecurrences })
		.from(eventRecurrences)
		.innerJoin(events, eq(eventRecurrences.eventId, events.id))
		.where(
			and(
				readable(events.ownerId, events.visibility, actor),
				inArray(events.locationId, locationIds),
				eq(eventRecurrences.mode, "scheduled"),
			),
		)
		.limit(501);
	if (explicit.length > 2000 || series.length > 500)
		throw new DomainError(
			422,
			"Too many nearby events; narrow the search radius",
		);
	const ruleIds = series.map((r) => r.recurrence.id);
	const templates = ruleIds.length
		? await db
				.select()
				.from(eventRecurrenceDays)
				.where(inArray(eventRecurrenceDays.recurrenceId, ruleIds))
		: [];
	const utcDay = q.at.toISOString().slice(0, 10);
	const overrides = ruleIds.length
		? await db
				.select({
					recurrenceId: eventOccurrences.recurrenceId,
					originalAnchor: eventOccurrences.originalAnchor,
				})
				.from(eventOccurrences)
				.where(
					and(
						inArray(eventOccurrences.recurrenceId, ruleIds),
						sql`${eventOccurrences.originalAnchor} BETWEEN ${addDays(utcDay, -368)} AND ${addDays(utcDay, 2)}`,
					),
				)
		: [];
	const overridden = new Set(
		overrides.map((o) => `${o.recurrenceId}:${o.originalAnchor}`),
	);
	const eventIds = [
		...new Set([
			...explicit.map((e) => e.event.id),
			...series.map((r) => r.event.id),
		]),
	];
	const prices = eventIds.length
		? await db
				.select()
				.from(eventPrices)
				.where(inArray(eventPrices.eventId, eventIds))
		: [];
	const result = explicit.map(({ event, occurrence, day }) => ({
		kind: "event" as const,
		id: occurrence.id,
		eventId: event.id,
		title: occurrence.title ?? event.title,
		locationId: occurrence.locationId,
		timezone: occurrence.timezone,
		date: day.date,
		description: day.description ?? occurrence.description ?? event.description,
		startsAt: day.startsAt,
		endsAt: day.endsAt,
		prices: occurrencePricesAt(
			prices.filter((p) => p.eventId === event.id),
			occurrence.id,
			q.at,
			occurrence.timezone,
			event.timezone,
		),
	}));
	for (const { event, recurrence } of series) {
		for (const day of recurringDaysAt(
			recurrence,
			templates.filter((d) => d.recurrenceId === recurrence.id),
			event.timezone,
			q.at,
		)) {
			if (overridden.has(`${recurrence.id}:${day.originalAnchor}`)) continue;
			result.push({
				kind: "event",
				id: `${recurrence.id}:${day.originalAnchor}`,
				eventId: event.id,
				title: event.title,
				locationId: event.locationId,
				timezone: event.timezone,
				date: day.date,
				description: day.description ?? event.description,
				startsAt: day.startsAt,
				endsAt: day.endsAt,
				prices: occurrencePricesAt(
					prices.filter((p) => p.eventId === event.id),
					null,
					q.at,
					event.timezone,
				),
			});
		}
	}
	return [...new Map(result.map((r) => [r.id, r])).values()];
}
