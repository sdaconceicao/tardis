import { Temporal } from "@js-temporal/polyfill";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Connection, Database } from "../../db/client.server";
import { readable } from "../../shared/access";
import { conflict, DomainError, notFound } from "../../shared/errors";
import { assertPriceWindows } from "../../shared/prices";
import { addDays, dayTimes, localDate } from "../../shared/time";
import type { Actor } from "../identity/contracts";
import {
	createLocation,
	getLocation,
	resolvePlaceVenue,
} from "../places/index.server";
import { getEventTags, setEventTags } from "../taxonomy/index.server";
import type { EventInput, OccurrenceInput, RecurrenceInput } from "./contracts";
import {
	eventDays,
	eventOccurrences,
	eventPrices,
	eventRecurrenceDays,
	eventRecurrences,
	events,
} from "./schema";

export async function ownEvent(db: Connection, actor: Actor, id: string) {
	const [event] = await db
		.select()
		.from(events)
		.where(and(eq(events.id, id), eq(events.ownerId, actor.subject)))
		.for("update");
	if (!event) throw notFound();
	return event;
}
export async function listEvents(
	db: Connection,
	actor: Actor | null,
	q: { limit: number; offset: number },
) {
	return db
		.select()
		.from(events)
		.where(readable(events.ownerId, events.visibility, actor))
		.orderBy(events.id)
		.limit(q.limit)
		.offset(q.offset);
}
export async function getEvent(
	db: Connection,
	actor: Actor | null,
	id: string,
) {
	const [event] = await db
		.select()
		.from(events)
		.where(
			and(
				eq(events.id, id),
				readable(events.ownerId, events.visibility, actor),
			),
		);
	if (!event) throw notFound();
	const [location, tags, prices, recurrences] = await Promise.all([
		getLocation(db, event.locationId),
		getEventTags(db, id),
		db
			.select()
			.from(eventPrices)
			.where(
				and(eq(eventPrices.eventId, id), isNull(eventPrices.occurrenceId)),
			),
		db.select().from(eventRecurrences).where(eq(eventRecurrences.eventId, id)),
	]);
	const days = recurrences.length
		? await db
				.select()
				.from(eventRecurrenceDays)
				.where(
					inArray(
						eventRecurrenceDays.recurrenceId,
						recurrences.map((r) => r.id),
					),
				)
		: [];
	return {
		...event,
		location,
		tags,
		prices,
		recurrences: recurrences.map((r) => ({
			...r,
			days: days.filter((d) => d.recurrenceId === r.id),
		})),
	};
}
export async function saveEvent(
	db: Database,
	actor: Actor,
	input: EventInput,
	id?: string,
) {
	assertPriceWindows(input.prices);
	return db.transaction(async (tx) => {
		if (id) await ownEvent(tx, actor, id);
		let venue: { placeId: string | null; locationId: string };
		if (input.placeId)
			venue = await resolvePlaceVenue(
				tx,
				actor,
				input.placeId,
				input.visibility,
			);
		else if (input.location)
			venue = {
				placeId: null,
				locationId: (await createLocation(tx, input.location)).id,
			};
		else throw new DomainError(400, "A venue is required");
		const values = {
			...venue,
			title: input.title,
			description: input.description ?? null,
			visibility: input.visibility,
			timezone: input.timezone,
		};
		const [event] = id
			? await tx.update(events).set(values).where(eq(events.id, id)).returning()
			: await tx
					.insert(events)
					.values({ ...values, ownerId: actor.subject })
					.returning();
		await setEventTags(tx, event.id, input.tagIds);
		await tx
			.delete(eventPrices)
			.where(
				and(
					eq(eventPrices.eventId, event.id),
					isNull(eventPrices.occurrenceId),
				),
			);
		if (input.prices.length)
			await tx
				.insert(eventPrices)
				.values(input.prices.map((p) => ({ ...p, eventId: event.id })));
		return event;
	});
}
export async function deleteEvent(db: Database, actor: Actor, id: string) {
	return db.transaction(async (tx) => {
		await ownEvent(tx, actor, id);
		await tx.delete(events).where(eq(events.id, id));
	});
}
export async function listOccurrences(
	db: Connection,
	actor: Actor | null,
	eventId: string,
	q: { limit: number; offset: number },
) {
	await getEvent(db, actor, eventId);
	return db
		.select()
		.from(eventOccurrences)
		.where(eq(eventOccurrences.eventId, eventId))
		.orderBy(eventOccurrences.id)
		.limit(q.limit)
		.offset(q.offset);
}
export async function getOccurrence(
	db: Connection,
	actor: Actor | null,
	eventId: string,
	id: string,
) {
	await getEvent(db, actor, eventId);
	const [occurrence] = await db
		.select()
		.from(eventOccurrences)
		.where(
			and(eq(eventOccurrences.eventId, eventId), eq(eventOccurrences.id, id)),
		);
	if (!occurrence) throw notFound();
	const [days, prices, location] = await Promise.all([
		db
			.select()
			.from(eventDays)
			.where(eq(eventDays.occurrenceId, id))
			.orderBy(eventDays.date),
		db.select().from(eventPrices).where(eq(eventPrices.occurrenceId, id)),
		getLocation(db, occurrence.locationId),
	]);
	return { ...occurrence, days, prices, location };
}
export async function saveOccurrence(
	db: Database,
	actor: Actor,
	eventId: string,
	input: OccurrenceInput,
	id?: string,
) {
	assertPriceWindows(input.prices);
	return db.transaction(async (tx) => {
		const event = await ownEvent(tx, actor, eventId);
		const [previous] = id
			? await tx
					.select()
					.from(eventOccurrences)
					.where(
						and(
							eq(eventOccurrences.id, id),
							eq(eventOccurrences.eventId, eventId),
						),
					)
			: [];
		if (id && !previous) throw notFound();
		if (
			previous &&
			((input.recurrenceId ?? null) !== previous.recurrenceId ||
				(input.originalAnchor ?? null) !== previous.originalAnchor)
		)
			throw conflict(
				"An occurrence's original recurrence identity cannot change",
			);
		let recurrence: typeof eventRecurrences.$inferSelect | undefined;
		if (input.recurrenceId) {
			if (!input.originalAnchor)
				throw new DomainError(400, "Original anchor is required");
			const [rule] = await tx
				.select()
				.from(eventRecurrences)
				.where(
					and(
						eq(eventRecurrences.id, input.recurrenceId),
						eq(eventRecurrences.eventId, eventId),
					),
				);
			if (!rule) throw notFound();
			recurrence = rule;
			if (
				input.originalAnchor < rule.anchorDate ||
				(rule.untilDate && input.originalAnchor > rule.untilDate)
			)
				throw conflict("Original anchor is outside the recurrence range");
		}
		const base = previous ?? event;
		let venue = { placeId: base.placeId, locationId: base.locationId };
		if (input.placeId)
			venue = await resolvePlaceVenue(
				tx,
				actor,
				input.placeId,
				event.visibility,
			);
		else if (input.location)
			venue = {
				placeId: null,
				locationId: (
					await createLocation(
						tx,
						input.location ??
							(() => {
								throw new DomainError(400, "A location is required");
							})(),
					)
				).id,
			};
		else if (input.placeId === null && base.placeId)
			throw new DomainError(
				400,
				"Supply a standalone location when detaching a place",
			);
		else if (venue.placeId)
			await resolvePlaceVenue(tx, actor, venue.placeId, event.visibility);
		const timezone = input.timezone ?? base.timezone;
		const days = input.days.map((day) => {
			try {
				return {
					date: day.date,
					description: day.description ?? null,
					timeKind: day.timeKind,
					...dayTimes(
						day.date,
						day.timeKind,
						day.startMinute,
						day.endMinute,
						timezone,
					),
				};
			} catch {
				throw new DomainError(
					400,
					`Invalid or ambiguous local time on ${day.date} in ${timezone}`,
				);
			}
		});
		const dates = days.map((d) => d.date).sort();
		const ends = days
			.map((d) => {
				if (!d.endsAt) return addDays(d.date, 1);
				// The exclusive date range includes any overnight spillover, but not the next midnight itself.
				return addDays(
					localDate(new Date(d.endsAt.getTime() - 1), timezone),
					1,
				);
			})
			.sort();
		const values = {
			eventId,
			...venue,
			timezone,
			title: input.title ?? null,
			description: input.description ?? null,
			status: input.status,
			datePrecision: input.datePrecision,
			startsOn: dates[0] ?? null,
			endsOn: ends.at(-1) ?? null,
			expectedMonth: input.expectedMonth ?? null,
			recurrenceId: input.recurrenceId ?? null,
			originalAnchor: input.originalAnchor ?? null,
		};
		const [occurrence] = id
			? await tx
					.update(eventOccurrences)
					.set(values)
					.where(eq(eventOccurrences.id, id))
					.returning()
			: await tx.insert(eventOccurrences).values(values).returning();
		await tx.delete(eventDays).where(eq(eventDays.occurrenceId, occurrence.id));
		if (days.length)
			await tx
				.insert(eventDays)
				.values(days.map((day) => ({ ...day, occurrenceId: occurrence.id })));
		await tx
			.delete(eventPrices)
			.where(eq(eventPrices.occurrenceId, occurrence.id));
		if (input.prices.length)
			await tx.insert(eventPrices).values(
				input.prices.map((p) => ({
					...p,
					eventId,
					occurrenceId: occurrence.id,
				})),
			);
		if (
			previous?.datePrecision === "month" &&
			input.datePrecision === "exact" &&
			input.status === "scheduled" &&
			recurrence?.mode === "expected" &&
			recurrence.intervalMonths
		) {
			const month = Temporal.PlainDate.from(dates[0])
				.with({ day: 1 })
				.add({ months: recurrence.intervalMonths })
				.toString();
			if (!recurrence.untilDate || month <= recurrence.untilDate)
				await tx
					.insert(eventOccurrences)
					.values({
						eventId,
						recurrenceId: recurrence.id,
						originalAnchor: month,
						datePrecision: "month",
						status: "tentative",
						expectedMonth: month,
						locationId: event.locationId,
						placeId: event.placeId,
						timezone: event.timezone,
					})
					.onConflictDoNothing({
						target: [
							eventOccurrences.recurrenceId,
							eventOccurrences.originalAnchor,
						],
					});
		}
		return { ...occurrence, days };
	});
}
export async function cancelOccurrence(
	db: Database,
	actor: Actor,
	eventId: string,
	id: string,
) {
	return db.transaction(async (tx) => {
		await ownEvent(tx, actor, eventId);
		const [row] = await tx
			.update(eventOccurrences)
			.set({ status: "cancelled" })
			.where(
				and(eq(eventOccurrences.eventId, eventId), eq(eventOccurrences.id, id)),
			)
			.returning();
		if (!row) throw notFound();
		return row;
	});
}
export async function createRecurrence(
	db: Database,
	actor: Actor,
	eventId: string,
	input: RecurrenceInput,
) {
	return db.transaction(async (tx) => {
		const event = await ownEvent(tx, actor, eventId);
		const existing = await tx
			.select()
			.from(eventRecurrences)
			.where(eq(eventRecurrences.eventId, eventId));
		if (
			existing.some(
				(r) =>
					input.anchorDate <= (r.untilDate ?? "9999-12-31") &&
					r.anchorDate <= (input.untilDate ?? "9999-12-31"),
			)
		)
			throw conflict(
				"Recurrence segments must not overlap; end the current rule before adding a replacement",
			);
		const { days, ...values } = input;
		const [recurrence] = await tx
			.insert(eventRecurrences)
			.values({ ...values, eventId })
			.returning();
		if (days.length)
			await tx
				.insert(eventRecurrenceDays)
				.values(days.map((d) => ({ ...d, recurrenceId: recurrence.id })));
		let placeholder = null;
		if (input.mode === "expected") {
			if (!input.intervalMonths)
				throw new DomainError(
					400,
					"Expected recurrence requires a month interval",
				);
			const month = Temporal.PlainDate.from(input.anchorDate)
				.with({ day: 1 })
				.add({ months: input.intervalMonths })
				.toString();
			if (!input.untilDate || month <= input.untilDate)
				[placeholder] = await tx
					.insert(eventOccurrences)
					.values({
						eventId,
						recurrenceId: recurrence.id,
						originalAnchor: month,
						datePrecision: "month",
						status: "tentative",
						expectedMonth: month,
						placeId: event.placeId,
						locationId: event.locationId,
						timezone: event.timezone,
					})
					.returning();
		}
		return { ...recurrence, days, placeholder };
	});
}
export async function endRecurrence(
	db: Database,
	actor: Actor,
	eventId: string,
	id: string,
	untilDate: string,
) {
	return db.transaction(async (tx) => {
		await ownEvent(tx, actor, eventId);
		const [rule] = await tx
			.select()
			.from(eventRecurrences)
			.where(
				and(eq(eventRecurrences.id, id), eq(eventRecurrences.eventId, eventId)),
			);
		if (!rule) throw notFound();
		if (
			untilDate < rule.anchorDate ||
			(rule.untilDate && untilDate > rule.untilDate)
		)
			throw conflict(
				"Only shorten a recurrence; new schedules use a new segment",
			);
		const overrides = await tx
			.select()
			.from(eventOccurrences)
			.where(eq(eventOccurrences.recurrenceId, id));
		if (
			overrides.some(
				(o) =>
					o.originalAnchor !== null &&
					o.originalAnchor > untilDate &&
					o.status !== "cancelled",
			)
		)
			throw conflict(
				"Cancel future explicit occurrences before ending this recurrence",
			);
		const [row] = await tx
			.update(eventRecurrences)
			.set({ untilDate })
			.where(eq(eventRecurrences.id, id))
			.returning();
		return row;
	});
}
