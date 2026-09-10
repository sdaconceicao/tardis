import { and, eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Connection, Database } from "../../db/client.server";
import { readable } from "../../shared/access";
import { conflict, notFound } from "../../shared/errors";
import { assertPriceWindows } from "../../shared/prices";
import type {
	AvailabilityQuery,
	locationSchema,
} from "../../shared/validation";
import type { Actor } from "../identity/contracts";
import { getPlaceTags, setPlaceTags } from "../taxonomy/index.server";
import type { exceptionSchema, PlaceInput, scheduleSchema } from "./contracts";
import {
	locations,
	placeHoursExceptionIntervals,
	placeHoursExceptions,
	placeHoursIntervals,
	placeHoursSchedules,
	placeHoursWeekdays,
	placePrices,
	places,
} from "./schema";

export async function createLocation(
	db: Connection,
	input: z.infer<typeof locationSchema>,
) {
	const [location] = await db.insert(locations).values(input).returning();
	return location;
}
export async function getLocation(db: Connection, id: string) {
	const [location] = await db
		.select({
			id: locations.id,
			label: locations.label,
			address: locations.address,
			latitude: locations.latitude,
			longitude: locations.longitude,
		})
		.from(locations)
		.where(eq(locations.id, id));
	return location;
}
export async function nearbyLocations(db: Connection, q: AvailabilityQuery) {
	return db
		.select({
			id: locations.id,
			label: locations.label,
			address: locations.address,
			latitude: locations.latitude,
			longitude: locations.longitude,
		})
		.from(locations)
		.where(
			sql`ST_DWithin(${locations.point}, ST_SetSRID(ST_MakePoint(${q.longitude},${q.latitude}),4326)::geography, ${q.radiusMeters})`,
		);
}
// Called by events within the caller's transaction; the places module owns venue validation.
export async function resolvePlaceVenue(
	db: Connection,
	actor: Actor,
	placeId: string,
	eventVisibility: "public" | "private",
) {
	const [place] = await db
		.select()
		.from(places)
		.where(
			and(
				eq(places.id, placeId),
				readable(places.ownerId, places.visibility, actor),
			),
		)
		.for("share");
	if (!place) throw notFound();
	if (eventVisibility === "public" && place.visibility !== "public")
		throw conflict("Public events cannot use a private place");
	return {
		placeId: place.id,
		locationId: place.locationId,
		timezone: place.timezone,
	};
}
export async function ownPlace(db: Connection, actor: Actor, id: string) {
	const [place] = await db
		.select()
		.from(places)
		.where(and(eq(places.id, id), eq(places.ownerId, actor.subject)))
		.for("update");
	if (!place) throw notFound();
	return place;
}
export async function listPlaces(
	db: Connection,
	actor: Actor | null,
	query: { limit: number; offset: number },
) {
	return db
		.select()
		.from(places)
		.where(readable(places.ownerId, places.visibility, actor))
		.orderBy(places.id)
		.limit(query.limit)
		.offset(query.offset);
}
export async function getPlace(
	db: Connection,
	actor: Actor | null,
	id: string,
) {
	const [place] = await db
		.select()
		.from(places)
		.where(
			and(
				eq(places.id, id),
				readable(places.ownerId, places.visibility, actor),
			),
		);
	if (!place) throw notFound();
	const [location, tags, prices, hours] = await Promise.all([
		getLocation(db, place.locationId),
		getPlaceTags(db, id),
		db.select().from(placePrices).where(eq(placePrices.placeId, id)),
		getPlaceHours(db, id),
	]);
	return { ...place, location, tags, prices, ...hours };
}
export async function savePlace(
	db: Database,
	actor: Actor,
	input: PlaceInput,
	id?: string,
) {
	assertPriceWindows(input.prices);
	return db.transaction(async (tx) => {
		const previous = id ? await ownPlace(tx, actor, id) : null;
		const oldLocation = previous
			? await getLocation(tx, previous.locationId)
			: null;
		const sameLocation =
			oldLocation &&
			oldLocation.label === input.location.label &&
			(oldLocation.address ?? null) === (input.location.address ?? null) &&
			oldLocation.latitude === input.location.latitude &&
			oldLocation.longitude === input.location.longitude;
		const location = sameLocation
			? oldLocation
			: await createLocation(tx, input.location);
		const values = {
			name: input.name,
			description: input.description ?? null,
			visibility: input.visibility,
			timezone: input.timezone,
			locationId: location.id,
		};
		const [place] = id
			? await tx.update(places).set(values).where(eq(places.id, id)).returning()
			: await tx
					.insert(places)
					.values({ ...values, ownerId: actor.subject })
					.returning();
		await setPlaceTags(tx, place.id, input.tagIds);
		await tx.delete(placePrices).where(eq(placePrices.placeId, place.id));
		if (input.prices.length)
			await tx
				.insert(placePrices)
				.values(input.prices.map((p) => ({ ...p, placeId: place.id })));
		return place;
	});
}
export async function deletePlace(db: Database, actor: Actor, id: string) {
	return db.transaction(async (tx) => {
		await ownPlace(tx, actor, id);
		await tx.delete(places).where(eq(places.id, id));
	});
}
export async function getPlaceHours(db: Connection, id: string) {
	const schedules = await db
		.select()
		.from(placeHoursSchedules)
		.where(eq(placeHoursSchedules.placeId, id));
	const weekdays = schedules.length
		? await db
				.select()
				.from(placeHoursWeekdays)
				.where(
					inArray(
						placeHoursWeekdays.scheduleId,
						schedules.map((s) => s.id),
					),
				)
		: [];
	const intervals = weekdays.length
		? await db
				.select()
				.from(placeHoursIntervals)
				.where(
					inArray(
						placeHoursIntervals.weekdayId,
						weekdays.map((d) => d.id),
					),
				)
		: [];
	const exceptions = await db
		.select()
		.from(placeHoursExceptions)
		.where(eq(placeHoursExceptions.placeId, id));
	const exceptionIntervals = exceptions.length
		? await db
				.select()
				.from(placeHoursExceptionIntervals)
				.where(
					inArray(
						placeHoursExceptionIntervals.exceptionId,
						exceptions.map((e) => e.id),
					),
				)
		: [];
	return {
		schedules: schedules.map((s) => ({
			...s,
			weekdays: weekdays
				.filter((d) => d.scheduleId === s.id)
				.map((d) => ({
					...d,
					intervals: intervals.filter((i) => i.weekdayId === d.id),
				})),
		})),
		exceptions: exceptions.map((e) => ({
			...e,
			intervals: exceptionIntervals.filter((i) => i.exceptionId === e.id),
		})),
	};
}
export async function replaceSchedules(
	db: Database,
	actor: Actor,
	id: string,
	schedules: z.infer<typeof scheduleSchema>[],
) {
	const sorted = [...schedules].sort((a, b) =>
		a.validFrom.localeCompare(b.validFrom),
	);
	if (
		sorted.some(
			(s, i) => i > 0 && (sorted[i - 1].validTo ?? "9999-12-31") > s.validFrom,
		)
	)
		throw conflict("Seasonal schedules must not overlap");
	return db.transaction(async (tx) => {
		await ownPlace(tx, actor, id);
		await tx
			.delete(placeHoursSchedules)
			.where(eq(placeHoursSchedules.placeId, id));
		for (const input of schedules) {
			const { weekdays, ...fields } = input;
			const [schedule] = await tx
				.insert(placeHoursSchedules)
				.values({ ...fields, placeId: id })
				.returning();
			for (const { intervals, ...day } of weekdays) {
				const [weekday] = await tx
					.insert(placeHoursWeekdays)
					.values({ ...day, scheduleId: schedule.id })
					.returning();
				if (intervals.length)
					await tx
						.insert(placeHoursIntervals)
						.values(intervals.map((i) => ({ ...i, weekdayId: weekday.id })));
			}
		}
		return getPlaceHours(tx, id);
	});
}
export async function saveException(
	db: Database,
	actor: Actor,
	id: string,
	input: z.infer<typeof exceptionSchema>,
) {
	return db.transaction(async (tx) => {
		await ownPlace(tx, actor, id);
		const { intervals, ...fields } = input;
		const [exception] = await tx
			.insert(placeHoursExceptions)
			.values({ ...fields, placeId: id })
			.onConflictDoUpdate({
				target: [placeHoursExceptions.placeId, placeHoursExceptions.date],
				set: { state: input.state, note: input.note ?? null },
			})
			.returning();
		await tx
			.delete(placeHoursExceptionIntervals)
			.where(eq(placeHoursExceptionIntervals.exceptionId, exception.id));
		if (intervals.length)
			await tx
				.insert(placeHoursExceptionIntervals)
				.values(intervals.map((i) => ({ ...i, exceptionId: exception.id })));
		return exception;
	});
}
export async function deleteException(
	db: Database,
	actor: Actor,
	id: string,
	date: string,
) {
	return db.transaction(async (tx) => {
		await ownPlace(tx, actor, id);
		await tx
			.delete(placeHoursExceptions)
			.where(
				and(
					eq(placeHoursExceptions.placeId, id),
					eq(placeHoursExceptions.date, date),
				),
			);
	});
}
